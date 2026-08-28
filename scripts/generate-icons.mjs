import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const brandDirectory = resolve('public/assets/brand');
const sourceIcon = resolve(brandDirectory, 'allenlin-icon.svg');

async function generateIcon(filename, size) {
  const output = resolve(brandDirectory, filename);
  const icon = await sharp(sourceIcon)
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: icon, gravity: 'centre' }])
    .png()
    .toFile(output);
}

await mkdir(dirname(sourceIcon), { recursive: true });
await Promise.all([
  generateIcon('favicon-32.png', 32),
  generateIcon('apple-touch-icon.png', 180),
]);
