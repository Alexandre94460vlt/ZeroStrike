import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const artifactsDir = 'C:\\Users\\ilian\\.gemini\\antigravity\\brain\\d35b286b-d7e3-495f-af4e-ec7ca5c0316a';
const outDir = 'd:\\ZeroStrike\\public\\characters';

const size = 64;

async function processDalleFile(filePath, heroName) {
  console.log(`Processing ${heroName} ...`);
  const image = sharp(filePath).ensureAlpha();
  const info = await image.metadata();
  const rawBuffer = await image.raw().toBuffer();

  const width = info.width;
  const height = info.height;
  const data = Buffer.from(rawBuffer); // clone

  // Chroma-key algorithm: Remove Magenta (#FF00FF)
  // DALL-E magenta might not be strictly 255, 0, 255 due to antialiasing or noise
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 150 && g < 100 && b > 150) {
      // It's magenta-ish, make it transparent
      data[i + 3] = 0;
    }
  }

  // Convert modified raw buffer to PNG Buffer
  const pngBuffer = await sharp(data, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();

  // Try to trim empty space
  let croppedBuffer;
  try {
    croppedBuffer = await sharp(pngBuffer).trim().toBuffer();
  } catch (e) {
    console.log(`Trim failed for ${heroName}, using uncropped`);
    croppedBuffer = pngBuffer;
  }

  // Resize tightly to fit within a ~48x48 box so it matches the 52x52 spacing
  const paddedBase = await sharp(croppedBuffer)
    .resize(48, 48, { fit: 'inside' })
    .toBuffer();

  // 1. STAND (centered in 64x64 canvas)
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: paddedBase, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, `hero_${heroName}_stand.png`));

  // 2. RUN (rotated slightly back to simulate sprinting body angle, bobbed)
  const runImgLayer = await sharp(paddedBase)
    .rotate(-15, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: runImgLayer, top: 4, left: 3 }])
    .png()
    .toFile(path.join(outDir, `hero_${heroName}_run.png`));

  // 3. COMPETENCE (glow aura behind)
  const auraSvg = `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="26" fill="rgba(80, 200, 255, 0.45)" filter="blur(4px)" /><circle cx="${size/2}" cy="${size/2}" r="18" fill="rgba(255, 255, 255, 0.8)" filter="blur(2px)" /></svg>`;
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([
      { input: Buffer.from(auraSvg) },
      { input: paddedBase, gravity: 'center' }
    ])
    .png()
    .toFile(path.join(outDir, `hero_${heroName}_competence.png`));
    
  console.log(`✅ Saved ${heroName} frames (stand, run, competence)`);
}

async function run() {
  const files = fs.readdirSync(artifactsDir);
  for (const f of files) {
    if (f.startsWith('dalle_') && f.endsWith('.png')) {
      const parts = f.split('_');
      const heroName = parts[1]; // e.g. gojo
      await processDalleFile(path.join(artifactsDir, f), heroName);
    }
  }
}

run().catch(console.error);
