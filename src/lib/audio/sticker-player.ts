let audioElement: HTMLAudioElement | null = null;

// Hardcoded stickers - no database needed
export const STICKERS = {
  "bestest-friend": {
    src: "/audio/stickers/bestest-friend.mp3",
    label: "Send Love",
  },
} as const;

export type StickerId = keyof typeof STICKERS;

export async function playSticker(stickerId: StickerId): Promise<void> {
  const sticker = STICKERS[stickerId];
  if (!sticker) {
    console.error("Sticker not found:", stickerId);
    return;
  }

  if (!audioElement) {
    audioElement = new Audio();
  }

  audioElement.src = sticker.src;
  audioElement.volume = 0.8;

  try {
    await audioElement.play();
    console.log("Playing sticker:", stickerId);
  } catch (error) {
    console.error("Failed to play sticker:", stickerId, error);
  }
}

export function getAvailableStickers() {
  return Object.entries(STICKERS).map(([id, data]) => ({
    id,
    label: data.label,
  }));
}
