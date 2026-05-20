// Slug generation utility

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/^the\s+/i, "") // Remove leading "The"
    .replace(/\s+\((feat\.?|ft\.?|featuring).*\)$/i, "") // Remove featuring suffix
    .replace(/\s+(-\s*)?(remix|edit|version|remaster|remastered)$/i, "") // Remove remix suffixes
    .trim();
}
