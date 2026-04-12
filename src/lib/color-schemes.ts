export interface ColorScheme {
  id: string;
  name: string;
  accent: string;
  accentGlow: string;
  accentDim: string;
  accentSubtle: string;
  secondary: string;
  secondaryGlow: string;
  secondaryDim: string;
  secondarySubtle: string;
  waveform: string;
  gradient: string;
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: "ember",
    name: "Ember",
    accent: "#FF6B35",
    accentGlow: "#FF8A5B",
    accentDim: "#CC5529",
    accentSubtle: "rgba(255, 107, 53, 0.15)",
    secondary: "#7B68EE",
    secondaryGlow: "#9D8FFF",
    secondaryDim: "#6354C7",
    secondarySubtle: "rgba(123, 104, 238, 0.15)",
    waveform: "rgba(255, 107, 53, 0.6)",
    gradient: "linear-gradient(135deg, #FF6B35 0%, #7B68EE 100%)",
  },
  {
    id: "ocean",
    name: "Ocean",
    accent: "#0EA5E9",
    accentGlow: "#38BDF8",
    accentDim: "#0284C7",
    accentSubtle: "rgba(14, 165, 233, 0.15)",
    secondary: "#14B8A6",
    secondaryGlow: "#2DD4BF",
    secondaryDim: "#0D9488",
    secondarySubtle: "rgba(20, 184, 166, 0.15)",
    waveform: "rgba(14, 165, 233, 0.6)",
    gradient: "linear-gradient(135deg, #0EA5E9 0%, #14B8A6 100%)",
  },
  {
    id: "rose",
    name: "Rose",
    accent: "#F43F5E",
    accentGlow: "#FB7185",
    accentDim: "#E11D48",
    accentSubtle: "rgba(244, 63, 94, 0.15)",
    secondary: "#EC4899",
    secondaryGlow: "#F472B6",
    secondaryDim: "#DB2777",
    secondarySubtle: "rgba(236, 72, 153, 0.15)",
    waveform: "rgba(244, 63, 94, 0.6)",
    gradient: "linear-gradient(135deg, #F43F5E 0%, #EC4899 100%)",
  },
  {
    id: "forest",
    name: "Forest",
    accent: "#22C55E",
    accentGlow: "#4ADE80",
    accentDim: "#16A34A",
    accentSubtle: "rgba(34, 197, 94, 0.15)",
    secondary: "#10B981",
    secondaryGlow: "#34D399",
    secondaryDim: "#059669",
    secondarySubtle: "rgba(16, 185, 129, 0.15)",
    waveform: "rgba(34, 197, 94, 0.6)",
    gradient: "linear-gradient(135deg, #22C55E 0%, #10B981 100%)",
  },
  {
    id: "sunset",
    name: "Sunset",
    accent: "#F97316",
    accentGlow: "#FB923C",
    accentDim: "#EA580C",
    accentSubtle: "rgba(249, 115, 22, 0.15)",
    secondary: "#EAB308",
    secondaryGlow: "#FACC15",
    secondaryDim: "#CA8A04",
    secondarySubtle: "rgba(234, 179, 8, 0.15)",
    waveform: "rgba(249, 115, 22, 0.6)",
    gradient: "linear-gradient(135deg, #F97316 0%, #EAB308 100%)",
  },
  {
    id: "midnight",
    name: "Midnight",
    accent: "#6366F1",
    accentGlow: "#818CF8",
    accentDim: "#4F46E5",
    accentSubtle: "rgba(99, 102, 241, 0.15)",
    secondary: "#8B5CF6",
    secondaryGlow: "#A78BFA",
    secondaryDim: "#7C3AED",
    secondarySubtle: "rgba(139, 92, 246, 0.15)",
    waveform: "rgba(99, 102, 241, 0.6)",
    gradient: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
  },
  {
    id: "cherry",
    name: "Cherry",
    accent: "#DC2626",
    accentGlow: "#EF4444",
    accentDim: "#B91C1C",
    accentSubtle: "rgba(220, 38, 38, 0.15)",
    secondary: "#BE185D",
    secondaryGlow: "#DB2777",
    secondaryDim: "#9D174D",
    secondarySubtle: "rgba(190, 24, 93, 0.15)",
    waveform: "rgba(220, 38, 38, 0.6)",
    gradient: "linear-gradient(135deg, #DC2626 0%, #BE185D 100%)",
  },
  {
    id: "arctic",
    name: "Arctic",
    accent: "#06B6D4",
    accentGlow: "#22D3EE",
    accentDim: "#0891B2",
    accentSubtle: "rgba(6, 182, 212, 0.15)",
    secondary: "#3B82F6",
    secondaryGlow: "#60A5FA",
    secondaryDim: "#2563EB",
    secondarySubtle: "rgba(59, 130, 246, 0.15)",
    waveform: "rgba(6, 182, 212, 0.6)",
    gradient: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)",
  },
];

export function getSchemeById(id: string): ColorScheme {
  return COLOR_SCHEMES.find((s) => s.id === id) || COLOR_SCHEMES[0];
}

export function applyColorScheme(scheme: ColorScheme): void {
  const root = document.documentElement;

  root.style.setProperty("--ember", scheme.accent);
  root.style.setProperty("--ember-glow", scheme.accentGlow);
  root.style.setProperty("--ember-dim", scheme.accentDim);
  root.style.setProperty("--ember-subtle", scheme.accentSubtle);

  root.style.setProperty("--twilight", scheme.secondary);
  root.style.setProperty("--twilight-glow", scheme.secondaryGlow);
  root.style.setProperty("--twilight-dim", scheme.secondaryDim);
  root.style.setProperty("--twilight-subtle", scheme.secondarySubtle);

  root.style.setProperty("--waveform", scheme.waveform);
  root.style.setProperty("--personal-glow", scheme.gradient);
}
