// Fuzzy matching utilities for entity resolution

import { normalizeForComparison } from "./slug";

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 100;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return Math.round((1 - distance / maxLength) * 100);
}

export interface FuzzyMatchResult {
  score: number;
  titleScore: number;
  artistScore: number;
  normalizedTitle: string;
  normalizedArtist: string;
}

export function fuzzyMatchTrack(
  candidate: { title: string; primaryArtist: string },
  query: { title: string; artist: string }
): FuzzyMatchResult {
  const normalizedCandidateTitle = normalizeForComparison(candidate.title);
  const normalizedCandidateArtist = normalizeForComparison(candidate.primaryArtist);
  const normalizedQueryTitle = normalizeForComparison(query.title);
  const normalizedQueryArtist = normalizeForComparison(query.artist);

  const titleScore = levenshteinSimilarity(
    normalizedCandidateTitle,
    normalizedQueryTitle
  );
  const artistScore = levenshteinSimilarity(
    normalizedCandidateArtist,
    normalizedQueryArtist
  );

  // Weighted score: title is more important
  const score = Math.round(titleScore * 0.6 + artistScore * 0.4);

  return {
    score,
    titleScore,
    artistScore,
    normalizedTitle: normalizedCandidateTitle,
    normalizedArtist: normalizedCandidateArtist,
  };
}

export type MatchConfidence = "exact" | "high" | "medium" | "low";

export function getMatchConfidence(score: number): MatchConfidence {
  if (score >= 100) return "exact";
  if (score >= 90) return "high";
  if (score >= 70) return "medium";
  return "low";
}

export function shouldAcceptMatch(score: number): boolean {
  return score >= 70;
}

export function shouldWarnMatch(score: number): boolean {
  return score >= 70 && score < 90;
}
