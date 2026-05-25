// Shared palette for the brain/graph views so Brain 3 and Brain 4 tell the same story.
// dprsh ("sad") coloring rule, applied per song by PLAYLIST membership:
//   - song in a dprsh playlist AND a non-dprsh playlist  → SEA_GREEN (a "bridge")
//   - song in dprsh playlist(s) ONLY                     → SAD_BLUE  (a pure-sad island)
//   - song in no dprsh playlist                          → GREEN (default brain color)
// Playlist nodes + any edge touching a dprsh playlist are SAD_BLUE.
export const BRAIN_GREEN = "#3ecf8e";
export const BRAIN_SAD_BLUE = "#5C82B0";
export const BRAIN_SEA_GREEN = "#2E8B57";
