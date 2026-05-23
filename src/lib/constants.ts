// App-wide constants for the text-first / audio-optional model.

/**
 * Fallback duration for songs with no known/real duration (3 minutes).
 * Powers the timer-based channel playhead so audioless songs still advance.
 */
export const DEFAULT_TRACK_DURATION_MS = 180_000;

/**
 * Slug of the canonical "Unknown" artist (seeded in migration 013).
 * Used when a song is added with no artist.
 */
export const UNKNOWN_ARTIST_SLUG = "unknown";
