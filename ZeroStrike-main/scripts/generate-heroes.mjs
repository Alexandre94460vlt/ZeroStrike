import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const destDir = join(__dirname, '../public/characters');

const width = 49;
const height = 43;

// Definition des couleurs signatures pour chaque héros
// Format: { id: string, skin: hex, hair: hex, primary: hex, secondary: hex, aura: hex, accessory: function }
const heroesData = {
  gojo: { skin: '#ffdfc4', hair: '#f5f5f5', p: '#1a1a1a', s: '#2d2d2d', a: '#b3e0ff',
          acc: () => `<rect x="19" y="14" width="22" height="6" fill="#111" rx="2" style="transform: rotate(15deg);" />` },
  sukuna: { skin: '#ffd1b3', hair: '#ff8080', p: '#f5f5f5', s: '#4d4d4d', a: '#ff3333',
            acc: () => `<line x1="22" y1="18" x2="33" y2="18" stroke="#1a1a1a" stroke-width="1.5" />` },
  yuta: { skin: '#ffdfc4', hair: '#1a1a1a', p: '#f2f2f2', s: '#404040', a: '#ccccff' },
  ichigo: { skin: '#ffdfc4', hair: '#ff9900', p: '#1a1a1a', s: '#333333', a: '#ff4d4d' },
  toji: { skin: '#e6b89c', hair: '#1a1a1a', p: '#333333', s: '#8c8c8c', a: '#404040' },
  jotaro: { skin: '#ffd699', hair: '#1a1a1a', p: '#000033', s: '#00004d', a: '#cc00ff',
            acc: () => `<path d="M 20 10 L 32 10 L 32 18 L 20 18 Z" fill="#000033" /><rect x="20" y="8" width="14" height="3" fill="#ffcc00" />` },
  dio: { skin: '#ffdfc4', hair: '#ffcc00', p: '#ffcc00', s: '#808000', a: '#ffff00',
         acc: () => `<circle cx="28" cy="15" r="3" fill="#ff3300" />` },
  naruto: { skin: '#ffd699', hair: '#ffff66', p: '#ff6600', s: '#1a1a1a', a: '#66ccff',
            acc: () => `<rect x="22" y="11" width="12" height="4" fill="#1a1a1a" /><rect x="24" y="12" width="8" height="2" fill="#808080" />` },
  itachi: { skin: '#ffccb3', hair: '#1a1a1a', p: '#1a1a1a', s: '#404040', a: '#ff3333',
            acc: () => `<path d="M 17 25 Q 24 35 33 25" fill="none" stroke="#cc0000" stroke-width="2" />` },
  goku: { skin: '#ffcc80', hair: '#1a1a1a', p: '#ff8c1a', s: '#0059b3', a: '#ffff33',
          acc: () => `<path d="M 23 8 L 27 2 L 32 8" fill="#1a1a1a" />` }
};

// Fonction utilitaire pour générer le SVG de base
function buildSVG(hero, headX, headY, leftShoulderX, leftShoulderY, rightShoulderX, rightShoulderY, leftLegX, leftLegY, rightLegX, rightLegY, extra) {
  const acc = hero.acc ? hero.acc() : '';
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Shadow -->
      <ellipse cx="${width/2}" cy="${height/2 + 2}" rx="16" ry="10" fill="rgba(0,0,0,0.3)" />
      
      <!-- Aura & Extras -->
      ${extra}
      
      <!-- Legs -->
      <ellipse cx="${leftLegX}" cy="${leftLegY}" rx="4" ry="5" fill="${hero.s}" />
      <ellipse cx="${rightLegX}" cy="${rightLegY}" rx="4" ry="5" fill="${hero.s}" />
      
      <!-- Torso -->
      <rect x="18" y="20" width="13" height="13" rx="4" fill="${hero.p}" />
      <rect x="21" y="22" width="7" height="11" fill="${hero.s}" />
      
      <!-- Shoulders/Arms -->
      <ellipse cx="${leftShoulderX}" cy="${leftShoulderY}" rx="4" ry="6" fill="${hero.p}" />
      <ellipse cx="${rightShoulderX}" cy="${rightShoulderY}" rx="4" ry="6" fill="${hero.p}" />
      
      <!-- Head -->
      <circle cx="${headX}" cy="${headY}" r="7" fill="${hero.skin}" />
      <!-- Hair -->
      <path d="M ${headX - 8} ${headY} A 8 8 0 0 1 ${headX + 8} ${headY} A 4 4 0 0 1 ${headX - 8} ${headY}" fill="${hero.hair}" />
      
      <!-- Accessories -->
      ${acc}
    </svg>
  `;
}

// Générer les poses
function generatePoses(key, hero) {
  const poses = [];
  
  const cx = width/2; // 24.5
  const cy = height/2; // 21.5

  // 1. STAND (au repos)
  poses.push({
    pose: 'stand',
    svg: buildSVG(hero, 
      25, 15,          // Head
      18, 24, 30, 24,  // Shoulders
      21, 32, 27, 32,  // Legs
      ''
    )
  });

  // 2. RUN (mouvement des épaules et jambes décalées)
  poses.push({
    pose: 'run',
    svg: buildSVG(hero, 
      26, 16,          // Head (slightly bobbed down/forward)
      19, 23, 29, 25,  // Shoulders (twisted)
      20, 31, 28, 34,  // Legs (running step)
      ''
    )
  });

  // 3. COMPETENCE (effet d'aura brillante + bras écartés)
  const auraSize = `<circle cx="25" cy="22" r="16" fill="${hero.a}" opacity="0.6" filter="blur(2px)" />`;
  poses.push({
    pose: 'competence',
    svg: buildSVG(hero, 
      25, 14,          // Head (looking up slightly)
      16, 23, 33, 23,  // Shoulders (hands raised/spread)
      22, 33, 27, 33,  // Legs (planted)
      auraSize
    )
  });

  return poses;
}

async function run() {
  await mkdir(destDir, { recursive: true });
  
  for (const [key, hero] of Object.entries(heroesData)) {
    const poses = generatePoses(key, hero);
    for (const p of poses) {
      const filename = join(destDir, `hero_${key}_${p.pose}.png`);
      await sharp(Buffer.from(p.svg))
        .png()
        .toFile(filename);
    }
  }
  console.log(`✅ Generated ${Object.keys(heroesData).length * 3} hero frames!`);
}

run().catch(console.error);
