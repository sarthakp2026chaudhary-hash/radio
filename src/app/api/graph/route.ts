import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type NodeType = "folder" | "playlist" | "song" | "artist";
interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  color: string | null; // brain color, or null = white/loose (client applies a default per type)
}
interface GraphLink {
  source: string;
  target: string;
  color: string | null;
}

// GET /api/graph — the whole "brain". A "brain" is any folder you give a color;
// playlists/songs inherit the color of their nearest colored ancestor folder.
// A song in exactly one brain takes that color; in none/many it stays white and
// its (brain-colored) edges show which brains it bridges.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const folderParam = request.nextUrl.searchParams.get("folder");
  const excludeAudio = request.nextUrl.searchParams.get("excludeAudio") === "1";

  const [foldersR, playlistsR, ptR, taR] = await Promise.all([
    supabase.from("folders").select("id, name, parent_id, color"),
    supabase.from("playlists").select("id, name, folder_id").neq("name", "__defaults__"),
    supabase.from("playlist_tracks").select("playlist_id, track_id"),
    supabase.from("track_artists").select("track_id, artist_id"),
  ]);

  const allFolders = (foldersR.data || []) as { id: number; name: string; parent_id: number | null; color: string | null }[];
  let playlists = (playlistsR.data || []) as { id: number; name: string; folder_id: number | null }[];
  let pt = (ptR.data || []) as { playlist_id: number; track_id: number }[];
  const ta = (taR.data || []) as { track_id: number; artist_id: number }[];

  // Optional scope: a folder's whole subtree (used by brain 2). Default = whole library.
  let folders = allFolders;
  if (folderParam) {
    const root = parseInt(folderParam);
    const childrenByParent = new Map<number, number[]>();
    allFolders.forEach((f) => {
      if (f.parent_id != null) {
        if (!childrenByParent.has(f.parent_id)) childrenByParent.set(f.parent_id, []);
        childrenByParent.get(f.parent_id)!.push(f.id);
      }
    });
    const sub = new Set<number>();
    const stack = [root];
    while (stack.length) {
      const id = stack.pop()!;
      if (sub.has(id)) continue;
      sub.add(id);
      (childrenByParent.get(id) || []).forEach((c) => stack.push(c));
    }
    folders = allFolders.filter((f) => sub.has(f.id));
    playlists = playlists.filter((p) => p.folder_id != null && sub.has(p.folder_id));
    const plIds = new Set(playlists.map((p) => p.id));
    pt = pt.filter((r) => plIds.has(r.playlist_id));
  }

  // nearest colored ancestor (incl. self) → brain color (walk the FULL tree)
  const folderById = new Map(allFolders.map((f) => [f.id, f]));
  const folderColor = new Map<number, string | null>();
  for (const f of folders) {
    let cur: typeof f | undefined = f;
    const seen = new Set<number>();
    let color: string | null = null;
    while (cur && !seen.has(cur.id)) {
      if (cur.color) { color = cur.color; break; }
      seen.add(cur.id);
      cur = cur.parent_id != null ? folderById.get(cur.parent_id) : undefined;
    }
    folderColor.set(f.id, color);
  }
  const playlistColor = new Map<number, string | null>();
  playlists.forEach((p) => playlistColor.set(p.id, p.folder_id != null ? folderColor.get(p.folder_id) ?? null : null));

  let songIds = new Set<number>(pt.map((r) => r.track_id));

  const tracksR = songIds.size
    ? await supabase.from("tracks").select("id, title, file_url").in("id", Array.from(songIds))
    : { data: [] as { id: number; title: string; file_url: string | null }[] };
  const tracksData = (tracksR.data || []) as { id: number; title: string; file_url: string | null }[];

  // brain 2 excludes songs that have an uploaded audio file (text-only curation view)
  if (excludeAudio) {
    const audio = new Set(tracksData.filter((t) => t.file_url).map((t) => t.id));
    songIds = new Set(Array.from(songIds).filter((id) => !audio.has(id)));
  }

  const artistIds = new Set<number>(ta.filter((r) => songIds.has(r.track_id)).map((r) => r.artist_id));

  // a song's brain set (distinct colors from the playlists it's in)
  const songBrains = new Map<number, Set<string>>();
  pt.forEach((r) => {
    if (!songIds.has(r.track_id)) return;
    const c = playlistColor.get(r.playlist_id);
    if (!c) return;
    if (!songBrains.has(r.track_id)) songBrains.set(r.track_id, new Set());
    songBrains.get(r.track_id)!.add(c);
  });
  const songColor = (id: number): string | null => {
    const b = songBrains.get(id);
    return b && b.size === 1 ? [...b][0] : null; // 0 or 2+ → white
  };

  const artistsR = artistIds.size
    ? await supabase.from("artists").select("id, name").in("id", Array.from(artistIds))
    : { data: [] as { id: number; name: string }[] };
  const trackTitle = new Map<number, string>(tracksData.map((t) => [t.id, t.title]));
  const artistName = new Map<number, string>((artistsR.data || []).map((a: { id: number; name: string }) => [a.id, a.name]));

  const nodes: GraphNode[] = [
    ...folders.map((f) => ({ id: `f${f.id}`, type: "folder" as const, label: f.name, color: folderColor.get(f.id) ?? null })),
    ...playlists.map((p) => ({ id: `p${p.id}`, type: "playlist" as const, label: p.name, color: playlistColor.get(p.id) ?? null })),
    ...Array.from(songIds).map((id) => ({ id: `s${id}`, type: "song" as const, label: trackTitle.get(id) || "Unknown", color: songColor(id) })),
    ...Array.from(artistIds).map((id) => ({ id: `a${id}`, type: "artist" as const, label: artistName.get(id) || "Unknown", color: null })),
  ];

  const nodeIds = new Set(nodes.map((n) => n.id));
  const links: GraphLink[] = [];
  const add = (a: string, b: string, color: string | null) => {
    if (nodeIds.has(a) && nodeIds.has(b)) links.push({ source: a, target: b, color });
  };
  folders.forEach((f) => f.parent_id != null && add(`f${f.parent_id}`, `f${f.id}`, folderColor.get(f.id) ?? null));
  playlists.forEach((p) => p.folder_id != null && add(`f${p.folder_id}`, `p${p.id}`, playlistColor.get(p.id) ?? null));
  pt.forEach((r) => add(`p${r.playlist_id}`, `s${r.track_id}`, playlistColor.get(r.playlist_id) ?? null));
  ta.forEach((r) => songIds.has(r.track_id) && add(`s${r.track_id}`, `a${r.artist_id}`, null));

  return NextResponse.json({
    nodes,
    links,
    counts: { folders: folders.length, playlists: playlists.length, songs: songIds.size, artists: artistIds.size, links: links.length },
  });
}
