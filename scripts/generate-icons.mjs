import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../public/icons');

// Create a simple radio icon with ember color
const createIcon = async (size) => {
  // Create a simple circular icon with gradient-like effect
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#1a1a1c"/>
          <stop offset="100%" stop-color="#0a0a0b"/>
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="70%" r="60%">
          <stop offset="0%" stop-color="#e85d04" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#e85d04" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#glow)"/>
      <g transform="translate(${size * 0.25}, ${size * 0.25})">
        <circle cx="${size * 0.25}" cy="${size * 0.25}" r="${size * 0.15}" fill="none" stroke="#e85d04" stroke-width="${size * 0.02}"/>
        <circle cx="${size * 0.25}" cy="${size * 0.25}" r="${size * 0.08}" fill="#e85d04"/>
        <path d="M${size * 0.35} ${size * 0.15} Q${size * 0.45} ${size * 0.25} ${size * 0.35} ${size * 0.35}"
              fill="none" stroke="#e85d04" stroke-width="${size * 0.02}" stroke-linecap="round"/>
        <path d="M${size * 0.42} ${size * 0.1} Q${size * 0.55} ${size * 0.25} ${size * 0.42} ${size * 0.4}"
              fill="none" stroke="#e85d04" stroke-width="${size * 0.02}" stroke-linecap="round"/>
      </g>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(iconsDir, `icon-${size}x${size}.png`));

  console.log(`Created icon-${size}x${size}.png`);
};

// Create icons directory
await mkdir(iconsDir, { recursive: true });

// Generate all required sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
for (const size of sizes) {
  await createIcon(size);
}

console.log('All icons generated!');
