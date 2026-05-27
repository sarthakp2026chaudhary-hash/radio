/** Extract a Spotify track ID from a search query (URI or bare 22-char ID). */
export function parseSpotifyTrackId(query: string): string | null {
  const trimmed = query.trim();
  const uriMatch = trimmed.match(/spotify:track:([A-Za-z0-9]{22})/i);
  if (uriMatch) return uriMatch[1];
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
  return null;
}
