/**
 * Crée une sprite sheet (images en ligne) à partir d'un dossier de PNG.
 * Usage: node scripts/make-spritesheet.js <dossier_images> <nom_sortie> [frameSize] [maxFrames]
 * Exemple: node scripts/make-spritesheet.js "D:\Rifle Run" hero_run 64
 * Exemple (garder 8 frames sur 93): node scripts/make-spritesheet.js "D:\death" hero_death 64 8
 * → Génère public/characters/<nom>.png (frames redimensionnées, collées en ligne)
 */

import { existsSync } from 'fs';
import { readdir, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

async function main() {
  const inputDir = process.argv[2];
  const outputName = process.argv[3] || 'sprite';
  const frameSize = parseInt(process.argv[4], 10) || 64;
  const maxFrames = process.argv[5] ? parseInt(process.argv[5], 10) : null;

  if (!inputDir) {
    console.log('Usage: node scripts/make-spritesheet.js <dossier_images> <nom_sortie> [frameSize] [maxFrames]');
    console.log('Exemple: node scripts/make-spritesheet.js "D:\\Rifle Run" hero_run 64');
    console.log('Exemple (8 frames sur beaucoup): node scripts/make-spritesheet.js "D:\\death" hero_idle 64 8');
    process.exit(1);
  }

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('Installe sharp: npm install sharp');
    process.exit(1);
  }

  if (!existsSync(inputDir)) {
    console.error('Dossier introuvable:', inputDir);
    console.error('Vérifie le chemin (ex. D:\\Zero Strike\\Rifle Run si tu as exporté depuis Blender là).');
    process.exit(1);
  }

  const files = await readdir(inputDir);
  const pngs = files
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

  if (pngs.length === 0) {
    console.error('Aucun PNG trouvé dans', inputDir);
    process.exit(1);
  }

  // Garder seulement maxFrames frames, réparties uniformément (ex. 8 frames sur 93)
  let selectedPngs = pngs;
  if (maxFrames != null && maxFrames > 0 && pngs.length > maxFrames) {
    const indices = [];
    for (let i = 0; i < maxFrames; i++) {
      indices.push(Math.floor((i * (pngs.length - 1)) / (maxFrames - 1)));
    }
    selectedPngs = indices.map((i) => pngs[i]);
    console.log(`${pngs.length} images → ${maxFrames} frames gardées (indices: ${indices.join(', ')})`);
  } else {
    console.log(`${pngs.length} images trouvées:`, pngs.slice(0, 3).join(', '), '...');
  }

  const outDir = join(projectRoot, 'public', 'characters');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, outputName.endsWith('.png') ? outputName : `${outputName}.png`);

  const frames = await Promise.all(
    selectedPngs.map((f) =>
      sharp(join(inputDir, f))
        .resize(frameSize, frameSize)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
    )
  );

  const width = frameSize * frames.length;
  const height = frameSize;
  const channels = 4;
  const buffer = Buffer.alloc(width * height * channels);

  for (let i = 0; i < frames.length; i++) {
    const { data, info } = frames[i];
    const x0 = i * frameSize;
    for (let y = 0; y < frameSize; y++) {
      const src = y * frameSize * channels;
      const dest = (y * width + x0) * channels;
      data.copy(buffer, dest, src, src + frameSize * channels);
    }
  }

  await sharp(buffer, {
    raw: { width, height, channels }
  })
    .png()
    .toFile(outPath);

  console.log('OK:', outPath, `(${width}×${height}, ${frames.length} frames)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
