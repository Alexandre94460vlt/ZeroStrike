/**
 * Sol, murs, décorations, sites de bombe.
 * Autotiling 4-bits : pour chaque cellule mur on regarde ses 4 voisins
 * (N/S/E/O) et on choisit le bon asset Kenney + rotation.
 *
 * Textures : un seul pack Kenney scribble-dungeons (clés Phaser `dg_*`), toutes les cartes.
 */
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/constants.js';
import { UITheme } from '../../config/uiTheme.js';

/** Aligné sur server/models/maps/tiledMapParser.js (TILED_DEBUG_CELL_*). */
const TILED_DEBUG_PALETTE = {
  0: 0x1e1e18,
  1: 0x3a4d32,
  2: 0x4a3d58,
  3: 0x1e4a6e,
  4: 0x6e3a1e,
  5: 0x6e6e1a,
  6: 0x8a5a12,
  7: 0x6e2a6e,
  8: 0x2c2c28,
};

/** Préfixe unique des tuiles chargées dans BootScene (plus de packs dupliqués par mapId). */
const TILE_TEXTURE_PREFIX = 'dg';

/** Taille de cellule déduite d’un mur serveur (non obstacle). */
export function inferMapCellSize(mapData) {
  const walls = mapData?.walls;
  const w = walls?.find((x) => x && x.kind !== 'obstacle');
  if (!w || !Number.isFinite(w.width) || w.width <= 0) {
    throw new Error('[mapLayer] Taille de case indéductible : attendu au moins un mur dans mapData.walls.');
  }
  return w.width;
}

/** @param {string} base Sans préfixe (ex. wall, tiles_cracked, decor_crate). */
export function themedTextureKey(scene, base) {
  const key = `${TILE_TEXTURE_PREFIX}_${base}`;
  return scene.textures.exists(key) ? key : null;
}

export function createVignette(scene) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  add(
    scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.12)
      .setDepth(11.5)
  );
}

export function clearFloorSprites(scene) {
  if (!scene.floorTileSprites?.length) return;
  for (const o of scene.floorTileSprites) {
    if (o && !o.destroyed && typeof o.destroy === 'function') o.destroy();
  }
  scene.floorTileSprites = [];
}

export function clearBombSiteSprites(scene) {
  if (!scene.bombSiteSprites?.length) return;
  for (const o of scene.bombSiteSprites) {
    if (o && !o.destroyed && typeof o.destroy === 'function') o.destroy();
  }
  scene.bombSiteSprites = [];
}

export function clearTiledDebugGridSprites(scene) {
  if (!scene.tiledDebugGridSprites?.length) return;
  for (const o of scene.tiledDebugGridSprites) {
    if (o && !o.destroyed && typeof o.destroy === 'function') o.destroy();
  }
  scene.tiledDebugGridSprites = [];
}

/**
 * Aperçu fidèle aux calques Tiled (sans textures) : une couleur par type de case.
 * @param {Phaser.Scene} scene
 * @param {(obj: Phaser.GameObjects.GameObject) => Phaser.GameObjects.GameObject} addFn
 */
export function drawTiledDebugGrid(scene, addFn) {
  const mapData = scene.registry.get('mapData');
  const td = mapData?.tiledDebugGrid;
  if (!td?.cells || !Number.isFinite(td.width) || !Number.isFinite(td.height)) {
    throw new Error('[mapLayer] tiledDebugGrid invalide (map_data).');
  }
  const W = td.width;
  const H = td.height;
  const wantLen = W * H;
  if (td.cells.length !== wantLen) {
    throw new Error(`[mapLayer] tiledDebugGrid.cells longueur ${td.cells.length}, attendu ${wantLen}.`);
  }

  const add = addFn || ((obj) => { scene.rootScale.add(obj); return obj; });
  const cw = inferMapCellSize(mapData);
  const ref = mapData.walls?.find((w) => w && w.kind !== 'obstacle') ?? mapData.walls?.[0];
  const ch = ref?.height ?? cw;

  clearTiledDebugGridSprites(scene);
  if (!scene.tiledDebugGridSprites) scene.tiledDebugGridSprites = [];

  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const code = td.cells.charCodeAt(row * W + col) - 48;
      const fill = TILED_DEBUG_PALETTE[code] ?? 0xff00ff;
      const x = col * cw + cw / 2;
      const y = row * ch + ch / 2;
      const r = add(
        scene.add.rectangle(x, y, cw, ch, fill, 0.92).setStrokeStyle(1, 0x000000, 0.15).setDepth(-10)
      );
      scene.tiledDebugGridSprites.push(r);
    }
  }
}

export function drawFloorVariants(scene, addFn) {
  const mapData = scene.registry.get('mapData');
  if (!mapData?.freeCells) return;
  const CELL = inferMapCellSize(mapData);
  const add = addFn || ((obj) => { scene.rootScale.add(obj); return obj; });

  clearFloorSprites(scene);
  if (!scene.floorTileSprites) scene.floorTileSprites = [];

  for (const cell of mapData.freeCells) {
    const col = Math.round((cell.x - CELL / 2) / CELL);
    const row = Math.round((cell.y - CELL / 2) / CELL);
    const seed = Math.abs((col * 73 + row * 37)) % 100;

    let key;
    if (seed < 20) key = themedTextureKey(scene, 'tiles_cracked');
    else if (seed < 50) key = themedTextureKey(scene, 'tiles');
    else if (seed < 65) key = themedTextureKey(scene, 'tiles_center');
    else if (seed < 75) key = themedTextureKey(scene, 'tiles_decorative');
    else key = themedTextureKey(scene, 'tiles');
    if (!key) {
      throw new Error(`[mapLayer] Texture de sol manquante pour le préfixe courant (case ${col},${row}).`);
    }

    const img = add(scene.add.image(cell.x, cell.y, key).setDepth(-9));
    img.setDisplaySize(CELL, CELL);
    scene.floorTileSprites.push(img);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  AUTOTILING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construit un Set "row,col" de toutes les cellules mur (hors obstacles)
 * pour les lookups de voisins en O(1).
 */
function buildWallGrid(walls, cw, ch) {
  const grid = new Set();
  for (const w of walls) {
    if (w.kind === 'obstacle') continue;
    const c = Math.round(w.x / cw);
    const r = Math.round(w.y / ch);
    grid.add(`${r},${c}`);
  }
  return grid;
}

/**
 * Renvoie { key, deg } pour un asset Kenney et une rotation en degrés.
 */
function autoTile(row, col, wallGrid, scene) {
  const N = wallGrid.has(`${row - 1},${col}`);
  const S = wallGrid.has(`${row + 1},${col}`);
  const E = wallGrid.has(`${row},${col + 1}`);
  const W = wallGrid.has(`${row},${col - 1}`);

  const vCount = (N ? 1 : 0) + (S ? 1 : 0);
  const hCount = (E ? 1 : 0) + (W ? 1 : 0);

  const wallK = themedTextureKey(scene, 'wall');
  if (!wallK) {
    throw new Error('[mapLayer] Texture wall manquante pour l’autotiling.');
  }
  const edgeK = themedTextureKey(scene, 'wall_edge');
  const halfK = themedTextureKey(scene, 'wall_half');
  const hasEdge = !!edgeK;
  const hasHalf = !!halfK;

  // ── Cellule isolée ──────────────────────────────────────────────────
  if (vCount === 0 && hCount === 0) {
    const k = halfK ?? wallK;
    if (!k) throw new Error('[mapLayer] Textures wall_half / wall requises pour mur isolé.');
    return { key: k, deg: 0 };
  }

  // ── Segment purement vertical ───────────────────────────────────────
  if (hCount === 0) return { key: wallK, deg: 90 };

  // ── Segment purement horizontal ─────────────────────────────────────
  if (vCount === 0) return { key: wallK, deg: 0 };

  // ── Coin en L (1 voisin V + 1 voisin H) ────────────────────────────
  if (hasEdge && vCount === 1 && hCount === 1) {
    if (S && E) return { key: edgeK, deg: 0   };
    if (S && W) return { key: edgeK, deg: 90  };
    if (N && W) return { key: edgeK, deg: 180 };
    if (N && E) return { key: edgeK, deg: 270 };
  }

  // ── Jonction en T ou croix : direction dominante ────────────────────
  if (vCount > hCount) return { key: wallK, deg: 90  };
  if (hCount > vCount) return { key: wallK, deg: 0   };

  // ── Croix parfaite (2V + 2H) ────────────────────────────────────────
  const crossK = halfK ?? wallK;
  if (!crossK) throw new Error('[mapLayer] Textures wall_half / wall requises pour jonction mur.');
  return { key: crossK, deg: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────

export function drawWalls(scene) {
  // Nettoyer les sprites précédents (map_data peut arriver plusieurs fois)
  if (scene.walls?.length) {
    for (const o of scene.walls) {
      if (o && !o.destroyed && typeof o.destroy === 'function') o.destroy();
    }
  }
  scene.walls = [];

  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const mapData = scene.registry.get('mapData');
  const walls = mapData?.walls?.length ? mapData.walls : [];
  if (!walls.length) return;

  if (!themedTextureKey(scene, 'wall')) {
    throw new Error('[mapLayer] Pack de tuiles mur introuvable pour le préfixe courant.');
  }

  const firstStruct = walls.find((w) => w && w.kind !== 'obstacle');
  const firstAny = walls[0];
  const ref = firstStruct || firstAny;
  if (!ref?.width || !ref?.height) {
    throw new Error('[mapLayer] Données mur invalides (width/height).');
  }
  const cw = ref.width;
  const ch = ref.height;
  const wallGrid = buildWallGrid(walls, cw, ch);

  for (const w of walls) {
    const cx = w.x + w.width / 2;
    const cy = w.y + w.height / 2;
    const kind = w.kind;
    if (!kind) {
      throw new Error('[mapLayer] Segment de carte sans propriété kind (données serveur).');
    }

    // ── Obstacles (caisses, barils) ──────────────────────────────────
    if (kind === 'obstacle') {
      const seed = Math.abs((w.x * 7 + w.y * 13)) % 4;
      const bases = ['decor_crate', 'decor_barrels', 'decor_barrel', 'decor_chest'];
      const resolved = bases.map((b) => themedTextureKey(scene, b));
      const key = resolved[seed];
      if (!key) {
        throw new Error(`[mapLayer] Texture décor obstacle manquante (essayé ${bases[seed]}).`);
      }
      const img = add(scene.add.image(cx, cy, key).setDepth(1));
      img.setDisplaySize(w.width * 0.88, w.height * 0.88);
      scene.walls.push(img);
      continue;
    }

    const col = Math.round(w.x / cw);
    const row = Math.round(w.y / ch);
    const { key, deg } = autoTile(row, col, wallGrid, scene);
    if (!key) {
      throw new Error(`[mapLayer] Autotiling : clé texture nulle (${row},${col}).`);
    }

    const img = add(scene.add.image(cx, cy, key).setDepth(-5));
    img.setDisplaySize(w.width + 1, w.height + 1);
    img.setRotation(Phaser.Math.DegToRad(deg));
    scene.walls.push(img);
  }
}

export function drawDecorations(scene) {
  // Désactivé : obstacles 'O' dans la grille remplacent les décos aléatoires
}

/**
 * Réaffiche sol / murs (ou tilemap Tiled) + sites bombe. Utilisé au `map_data` et en GameScene.
 * @param {Phaser.Scene} scene
 * @param {(obj: Phaser.GameObjects.GameObject) => Phaser.GameObjects.GameObject} add
 * @param {() => void} [onDone] — appelé après chargement async Tiled (sinon immédiat).
 */
export function redrawAllMapVisuals(scene, add, onDone) {
  clearFloorSprites(scene);
  clearBombSiteSprites(scene);
  clearTiledDebugGridSprites(scene);
  if (scene.walls?.length) {
    for (const o of scene.walls) {
      if (o && !o.destroyed && typeof o.destroy === 'function') o.destroy();
    }
  }
  scene.walls = [];

  const md = scene.registry.get('mapData');
  if (md?.tiledDebugGrid?.cells) {
    drawTiledDebugGrid(scene, add);
    drawBombZone(scene);
    onDone?.();
    return;
  }
  drawFloorVariants(scene, add);
  drawWalls(scene);
  drawDecorations(scene);
  drawBombZone(scene);
  onDone?.();
}

export function drawBombZone(scene) {
  // Option A : masquer complètement l’overlay visuel des sites A/B sur le display.
  // Les zones de plant/défuse restent gérées côté serveur via les calques Tiled bombeA/bombeB.
  return;
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const mapData = scene.registry.get('mapData');
  const bombSites = mapData?.bombSites;
  if (!bombSites?.length || bombSites.length < 2) {
    throw new Error('[mapLayer] bombSites requis : au moins deux sites (données serveur).');
  }
  const cell = inferMapCellSize(mapData);
  const labelPx = Math.max(22, Math.min(40, Math.round(cell * 1.15)));

  clearBombSiteSprites(scene);
  if (!scene.bombSiteSprites) scene.bombSiteSprites = [];

  for (const site of bombSites) {
    const r = site.radius;
    if (!Number.isFinite(r) || r <= 0) {
      throw new Error(`[mapLayer] Site bombe ${site.id} : radius invalide.`);
    }
    const size = r * 2;
    scene.bombSiteSprites.push(
      add(scene.add.rectangle(site.x, site.y, size, size, UITheme.siteFill, 0.2))
        .setStrokeStyle(3, UITheme.siteStroke, 0.55)
        .setDepth(0.3)
    );
    scene.bombSiteSprites.push(
      add(scene.add.text(site.x, site.y, site.id, {
        fontSize: `${labelPx}px`, fontFamily: 'Arial Black', fontStyle: 'bold', color: '#ECE8E4'
      }).setOrigin(0.5).setAlpha(0.9).setDepth(1))
    );
  }
}
