import sharp from 'sharp';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const charsDir = join(__dirname, '../public/characters');

const HEROES = ['gojo', 'sukuna', 'yuta', 'ichigo', 'toji', 'jotaro', 'dio', 'naruto', 'itachi', 'goku'];

const aliasMap = {};

const size = 64; // Using 64x64 canvas to allow space for auras and bobbing

async function processHero(h) {
  const origName = aliasMap[h] || h;
  const srcPath = join(charsDir, `char_${origName}.png`);
  if (!fs.existsSync(srcPath)) {
    console.log(`[SKIP] Original high-res art missing for: ${h} (char_${origName}.png)`);
    return;
  }

  // 1. STAND: Centered, scaled down to 52x52 over 64x64 canvas
  const paddedBase = await sharp(srcPath)
    .resize(52, 52, { fit: 'inside' })
    .toBuffer();
    
  const standFrame = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: paddedBase, gravity: 'center' }])
    .png()
    .toBuffer();
    
  await sharp(standFrame).toFile(join(charsDir, `hero_${h}_stand.png`));

  // 2. RUN: Rotated slightly back, wobbled
  const runImgLayer = await sharp(paddedBase)
    .rotate(-15, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: runImgLayer, top: 4, left: 2 }]) // simulating the run step bob
    .png()
    .toFile(join(charsDir, `hero_${h}_run.png`));

  // 3. COMPETENCE: Intense aura behind the character
  const auraSvg = `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="26" fill="rgba(80, 200, 255, 0.45)" filter="blur(4px)" /><circle cx="${size/2}" cy="${size/2}" r="18" fill="rgba(255, 255, 255, 0.8)" filter="blur(2px)" /></svg>`;
  
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([
      { input: Buffer.from(auraSvg) },
      { input: paddedBase, gravity: 'center' }
    ])
    .png()
    .toFile(join(charsDir, `hero_${h}_competence.png`));
    
  console.log(`✅ Converted high-res to sprites for: ${h}`);
}

async function run() {
  for (const h of HEROES) {
    await processHero(h);
  }
}

run().catch(console.error);
