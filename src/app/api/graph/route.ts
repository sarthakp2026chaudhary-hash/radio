import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type NodeType = "folder" | "playlist" | "song" | "artist";
interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
}
interface GraphLink {
  source: string;
  target: string;
}

// GET /api/graph — the whole "brain": folders → playlists → songs ← artists.
// A song/artist appears once and links to every playlist/song it belongs to,
// so shared nodes form the cross-connections.
export async function GET() {
  const supabase = await createClient();

  const [foldersR, playlistsR, ptR, taR] = await Promise.all([
    supabase.from("folders").select("id, name, parent_id"),
    supabase.from("playlists").select("id, name, folder_id").neq("name", "__defaults__"),
    supabase.from("playlist_tracks").select("playlist_id, track_id"),
    supabase.from("track_artists").select("track_id, artist_id"),
  ]);

  const folders = foldersR.data || [];
  const playlists = playlistsR.data || [];
  const pt = ptR.data || [];
  const ta = taR.data || [];

  const songIds = new Set<number>(pt.map((r: { track_id: number }) => r.track_id));
  const artistIds = new Set<number>(
    ta.filter((r: { track_id: number }) => songIds.has(r.track_id)).map((r: { artist_id: number }) => r.artist_id)
  );

  const [tracksR, artistsR] = await Promise.all([
    songIds.size
      ? supabase.from("tracks").select("id, title").in("id", Array.from(songIds))
      : Promise.resolve({ data: [] as { id: number; title: string }[] }),
    artistIds.size
      ? supabase.from("artists").select("id, name").in("id", Array.from(artistIds))
      : Promise.resolve({ data: [] as { id: number; name: string }[] }),
  ]);
  const trackTitle = new Map<number, string>((tracksR.data || []).map((t: { id: number; title: string }) => [t.id, t.title]));
  const artistName = new Map<number, string>((artistsR.data || []).map((a: { id: number; name: string }) => [a.id, a.name]));

  const nodes: GraphNode[] = [
    ...folders.map((f: { id: number; name: string }) => ({ id: `f${f.id}`, type: "folder" as const, label: f.name })),
    ...playlists.map((p: { id: number; name: string }) => ({ id: `p${p.id}`, type: "playlist" as const, label: p.name })),
    ...Array.from(songIds).map((id) => ({ id: `s${id}`, type: "song" as const, label: trackTitle.get(id) || "Unknown" })),
    ...Array.from(artistIds).map((id) => ({ id: `a${id}`, type: "artist" as const, label: artistName.get(id) || "Unknown" })),
  ];

  const nodeIds = new Set(nodes.map((n) => n.id));
  const links: GraphLink[] = [];
  const add = (a: string, b: string) => {
    if (nodeIds.has(a) && nodeIds.has(b)) links.push({ source: a, target: b });
  };

  folders.forEach((f: { id: number; parent_id: number | null }) => f.parent_id && add(`f${f.parent_id}`, `f${f.id}`));
  playlists.forEach((p: { id: number; folder_id: number | null }) => p.folder_id && add(`f${p.folder_id}`, `p${p.id}`));
  pt.forEach((r: { playlist_id: number; track_id: number }) => add(`p${r.playlist_id}`, `s${r.track_id}`));
  ta.forEach((r: { track_id: number; artist_id: number }) => songIds.has(r.track_id) && add(`s${r.track_id}`, `a${r.artist_id}`));

  return NextResponse.json({
    nodes,
    links,
    counts: { folders: folders.length, playlists: playlists.length, songs: songIds.size, artists: artistIds.size, links: links.length },
  });
}
