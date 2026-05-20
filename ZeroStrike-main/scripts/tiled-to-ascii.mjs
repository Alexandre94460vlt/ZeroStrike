#!/usr/bin/env node
/**
 * Convertit un export JSON Tiled (carte orthogonale) en grille ASCII 80×45
 * compatible avec parseGrid() dans server/models/maps/Maps.js.
 *
 * Calque tuiles : toute tuile non vide → 'X'. Calque objets : bombSite, spawn, obstacle.
 *
 * Usage :
 *   node scripts/tiled-to-ascii.mjs chemin/vers/map.json
 *   node scripts/tiled-to-ascii.mjs map.json -o grille.txt
 */

import fs from 'fs';

const EXPECTED_W = 80;
const EXPECTED_H = 45;
/** Masque Tiled sur les 3 bits de retournement (flip) du GID. */
const GID_TILE_MASK = 0x1fffffff;

function stripGid(gid) {
  return (Number(gid) >>> 0) & GID_TILE_MASK;
}

function cellHasTile(gid) {
  return stripGid(gid) !== 0;
}

function propsToMap(properties) {
  const m = Object.create(null);
  if (!Array.isArray(properties)) return m;
  for (const p of properties) {
    let v = p.value;
    if (v !== undefined && v !== null && typeof v === 'object' && 'value' in v) v = v.value;
    m[p.name] = v;
  }
  return m;
}

function findLayer(layers, type, name, caseInsensitive) {
  if (!layers) return null;
  const match = (a, b) => (caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b);
  return layers.find((l) => l.type === type && match(String(l.name), name)) ?? null;
}

function parseArgs(argv) {
  const args = {
    wallsLayer: 'Walls',
    objectsLayer: 'Objects',
    output: null,
    file: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--walls-layer' && argv[i + 1]) {
      args.wallsLayer = argv[++i];
      continue;
    }
    if (a === '--objects-layer' && argv[i + 1]) {
      args.objectsLayer = argv[++i];
      continue;
    }
    if ((a === '-o' || a === '--output') && argv[i + 1]) {
      args.output = argv[++i];
      continue;
    }
    if (a === '--help' || a === '-h') {
      args.help = true;
      continue;
    }
    if (!a.startsWith('-') && !args.file) {
      args.file = a;
      continue;
    }
    console.error(`[tiled-to-ascii] Argument inconnu : ${a}`);
    args.help = true;
    break;
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/tiled-to-ascii.mjs <map.json> [options]

Options:
  --walls-layer <nom>     Calque tuiles des murs (défaut: Walls)
  --objects-layer <nom>   Calque objets (défaut: Objects)
  -o, --output <fichier>  Écrire la grille dans un fichier (sinon stdout)

Contraintes:
  - Carte non "infinite" (pas de chunks)
  - Dimensions exactes ${EXPECTED_W}×${EXPECTED_H} tuiles

Propriétés d'objets reconnues:
  - type=bombSite, siteId=A|B|C  → A, B, c
  - type=spawn, team=DEF|ATT (ou CT|T) → C, T
  - type=obstacle → O

Voir docs/maps/TILED_DELIVERY_CDC.md et TILED_INTEGRATION_STEPS.md.
`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.file) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  let map;
  try {
    map = JSON.parse(fs.readFileSync(args.file, 'utf8'));
  } catch (e) {
    console.error(`[tiled-to-ascii] Lecture JSON impossible : ${e.message}`);
    process.exit(1);
  }

  if (map.infinite) {
    console.error(
      '[tiled-to-ascii] Carte infinie non supportée. Désactive "Infinite" dans les propriétés de la carte Tiled.'
    );
    process.exit(1);
  }

  const w = map.width;
  const h = map.height;
  if (w !== EXPECTED_W || h !== EXPECTED_H) {
    console.error(
      `[tiled-to-ascii] Dimensions ${w}×${h} — requis ${EXPECTED_W}×${EXPECTED_H} pour ZeroStrike.`
    );
    process.exit(1);
  }

  const tw = map.tilewidth || 1;
  const th = map.tileheight || 1;

  const wallsLayer = findLayer(map.layers, 'tilelayer', args.wallsLayer, true);
  if (!wallsLayer?.data) {
    console.error(
      `[tiled-to-ascii] Calque tuiles "${args.wallsLayer}" introuvable ou sans tableau "data".`
    );
    process.exit(1);
  }

  if (wallsLayer.data.length !== w * h) {
    console.error(
      `[tiled-to-ascii] Longueur "data" ${wallsLayer.data.length} ≠ ${w * h} (largeur×hauteur).`
    );
    process.exit(1);
  }

  /** @type {string[][]} */
  const grid = Array.from({ length: h }, () => Array(w).fill('.'));

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const gid = wallsLayer.data[row * w + col];
      if (cellHasTile(gid)) grid[row][col] = 'X';
    }
  }

  const warnings = [];
  const objLayer = findLayer(map.layers, 'objectgroup', args.objectsLayer, true);

  if (objLayer?.objects?.length) {
    for (const obj of objLayer.objects) {
      const pm = propsToMap(obj.properties);
      const t = pm.type;
      if (!t) continue;

      const ox = obj.x ?? 0;
      const oy = obj.y ?? 0;
      const ow = obj.width ?? 0;
      const oh = obj.height ?? 0;
      const cx = ox + ow / 2;
      const cy = oy + oh / 2;
      const col = Math.floor(cx / tw);
      const row = Math.floor(cy / th);

      if (col < 0 || col >= w || row < 0 || row >= h) {
        warnings.push(`Objet "${t}" hors carte (centre tuile approx. ${col},${row})`);
        continue;
      }

      let ch = null;
      if (t === 'bombSite') {
        const id = String(pm.siteId ?? '').toUpperCase();
        if (id === 'A') ch = 'A';
        else if (id === 'B') ch = 'B';
        else if (id === 'C') ch = 'c';
        else warnings.push(`bombSite sans siteId A|B|C : ${pm.siteId}`);
      } else if (t === 'spawn') {
        const team = String(pm.team ?? '').toUpperCase();
        if (team === 'DEF' || team === 'CT') ch = 'C';
        else if (team === 'ATT' || team === 'T') ch = 'T';
        else warnings.push(`spawn sans team DEF|ATT (ou CT|T) : ${pm.team}`);
      } else if (t === 'obstacle') {
        ch = 'O';
      }

      if (!ch) continue;

      const prev = grid[row][col];
      if (prev === 'X') {
        warnings.push(`Objet "${t}" sur mur à tuile (${col},${row}) — ignoré`);
        continue;
      }
      if (prev !== '.' && prev !== ch) {
        warnings.push(`Tuile (${col},${row}) : '${prev}' remplacé par '${ch}'`);
      }
      grid[row][col] = ch;
    }
  }

  for (const msg of warnings) {
    console.error(`[tiled-to-ascii] Avertissement : ${msg}`);
  }

  const text = grid.map((line) => line.join('')).join('\n') + '\n';

  if (args.output) {
    fs.writeFileSync(args.output, text, 'utf8');
    console.error(
      `[tiled-to-ascii] Grille écrite : ${args.output} (${w}×${h} tuiles, ${tw}×${th} px/tuile)`
    );
  } else {
    process.stdout.write(text);
  }
}

main();
