import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSpotifyTrackId } from "./parse-spotify-query";

export interface SearchTrackArtist {
  id: number;
  name: string;
  role?: string;
}

export interface SearchTrackResult {
  id: number;
  title: string;
  duration_ms: number;
  cover_url: string | null;
  has_audio: boolean;
  spotify_uri: string | null;
  spotify_id: string | null;
  artists: SearchTrackArtist[];
  playlist_count: number;
}

interface RawTrack {
  id: number;
  title: string;
  duration_ms: number;
  cover_url: string | null;
  file_url: string | null;
  spotify_uri: string | null;
  spotify_id: string | null;
}

const TRACK_SELECT =
  "id, title, duration_ms, cover_url, file_url, spotify_uri, spotify_id";

export async function searchTracks(
  supabase: SupabaseClient,
  query: string,
  options: { limit?: number; hasAudio?: boolean } = {}
): Promise<SearchTrackResult[]> {
  const limit = options.limit ?? 20;
  const spotifyId = parseSpotifyTrackId(query);
  const pattern = `%${query}%`;

  const byId = new Map<number, RawTrack>();

  const addTracks = (rows: RawTrack[] | null) => {
    for (const row of rows ?? []) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  };

  const { data: byTitle } = await supabase
    .from("tracks")
    .select(TRACK_SELECT)
    .ilike("title", pattern)
    .limit(limit);
  addTracks(byTitle as RawTrack[] | null);

  if (spotifyId) {
    const [{ data: bySpotifyId }, { data: bySpotifyUri }] = await Promise.all([
      supabase.from("tracks").select(TRACK_SELECT).eq("spotify_id", spotifyId).limit(limit),
      supabase.from("tracks").select(TRACK_SELECT).ilike("spotify_uri", `%${spotifyId}%`).limit(limit),
    ]);
    addTracks(bySpotifyId as RawTrack[] | null);
    addTracks(bySpotifyUri as RawTrack[] | null);
  } else if (query.includes("spotify")) {
    const { data: byUri } = await supabase
      .from("tracks")
      .select(TRACK_SELECT)
      .ilike("spotify_uri", pattern)
      .limit(limit);
    addTracks(byUri as RawTrack[] | null);
  }

  const { data: matchedArtists } = await supabase
    .from("artists")
    .select("id")
    .ilike("name", pattern)
    .limit(50);

  const artistIds = (matchedArtists ?? []).map((a) => a.id);
  if (artistIds.length > 0) {
    const { data: trackArtistRows } = await supabase
      .from("track_artists")
      .select("track_id")
      .in("artist_id", artistIds)
      .limit(200);

    const trackIdsFromArtists = [...new Set((trackArtistRows ?? []).map((r) => r.track_id))];
    if (trackIdsFromArtists.length > 0) {
      const { data: byArtist } = await supabase
        .from("tracks")
        .select(TRACK_SELECT)
        .in("id", trackIdsFromArtists)
        .limit(limit);
      addTracks(byArtist as RawTrack[] | null);
    }
  }

  let tracks = [...byId.values()];
  if (options.hasAudio === true) {
    tracks = tracks.filter((t) => !!t.file_url);
  } else if (options.hasAudio === false) {
    tracks = tracks.filter((t) => !t.file_url);
  }

  tracks = tracks.slice(0, limit);
  if (tracks.length === 0) return [];

  const trackIds = tracks.map((t) => t.id);

  const [{ data: artistRows }, { data: playlistRows }] = await Promise.all([
    supabase
      .from("track_artists")
      .select("track_id, role, artists:artist_id(id, name)")
      .in("track_id", trackIds)
      .order("position"),
    supabase.from("playlist_tracks").select("track_id").in("track_id", trackIds),
  ]);

  const artistsByTrack = new Map<number, SearchTrackArtist[]>();
  for (const row of artistRows ?? []) {
    const raw = row as { track_id: number; role: string | null; artists: { id: number; name: string } | { id: number; name: string }[] | null };
    const artist = Array.isArray(raw.artists) ? raw.artists[0] : raw.artists;
    if (!artist) continue;
    const list = artistsByTrack.get(raw.track_id) ?? [];
    list.push({ id: artist.id, name: artist.name, role: raw.role ?? undefined });
    artistsByTrack.set(raw.track_id, list);
  }

  const playlistCount = new Map<number, number>();
  for (const row of playlistRows ?? []) {
    playlistCount.set(row.track_id, (playlistCount.get(row.track_id) ?? 0) + 1);
  }

  return tracks.map((t) => ({
    id: t.id,
    title: t.title,
    duration_ms: t.duration_ms,
    cover_url: t.cover_url,
    has_audio: !!t.file_url,
    spotify_uri: t.spotify_uri,
    spotify_id: t.spotify_id,
    artists: artistsByTrack.get(t.id) ?? [],
    playlist_count: playlistCount.get(t.id) ?? 0,
  }));
}
