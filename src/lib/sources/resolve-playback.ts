import type { Track } from "@/lib/supabase/types";

export type PlaybackSource =
  | { type: "r2"; url: string }
  | { type: "spotify"; uri: string }
  | { type: "silent"; duration_ms: number };

/** Resolve how a track should play. R2 is the only implemented broadcast source today. */
export function resolvePlayback(track: Pick<Track, "file_url" | "spotify_uri" | "duration_ms">): PlaybackSource {
  if (track.file_url) return { type: "r2", url: track.file_url };
  if (track.spotify_uri) return { type: "spotify", uri: track.spotify_uri };
  return { type: "silent", duration_ms: track.duration_ms };
}
