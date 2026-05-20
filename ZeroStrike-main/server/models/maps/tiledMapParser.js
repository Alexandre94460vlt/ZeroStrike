/**
 * Parse une carte Tiled JSON (.tmj) → même forme que parseGrid() pour le moteur.
 * Grille debug display (`tiledDebugGrid`) : codes par case (TILED_DEBUG_CELL_*).
 */
/** Codes envoyés au display (chaîne de caractères '0'–'8', un caractère par case). */
export const TILED_DEBUG_CELL_EMPTY = 0;
export const TILED_DEBUG_CELL_GROUND = 1;
export const TILED_DEBUG_CELL_DECOR = 2;
export const TILED_DEBUG_CELL_SPAWN_DEF = 3;
export const TILED_DEBUG_CELL_SPAWN_ATT = 4;
export const TILED_DEBUG_CELL_BOMBE_A = 5;
export const TILED_DEBUG_CELL_BOMBE_B = 6;
export const TILED_DEBUG_CELL_BOMBE_C = 7;
export const TILED_DEBUG_CELL_WALL = 8;
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GID_TILE_MASK = 0x1fffffff;
const BOMB_SITE_RADIUS = 55;

function stripGid(gid) {
  return (Number(gid) >>> 0) & GID_TILE_MASK;
}

function cellHasTile(gid) {
  return stripGid(gid) !== 0;
}

function findLayer(layers, name) {
  if (!layers) return null;
  const n = name.toLowerCase();
  return layers.find((l) => String(l.name).toLowerCase() === n) ?? null;
}

function getTileLayerData(map, layerName) {
  const layer = findLayer(map.layers, layerName);
  if (!layer || layer.type !== 'tilelayer' || !layer.data) {
    return null;
  }
  const w = map.width;
  const h = map.height;
  if (layer.data.length !== w * h) {
    throw new Error(`[tiledMapParser] Calque "${layerName}" : data.length invalide.`);
  }
  return { layer, w, h, data: layer.data };
}

/**
 * @param {number[]} data
 * @param {number} w
 * @param {number} h
 * @returns {{ col: number, row: number }[]}
 */
function cellsWithTiles(data, w, h) {
  const out = [];
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      if (cellHasTile(data[row * w + col])) out.push({ col, row });
    }
  }
  return out;
}

function centroidWorld(cells, cellW, cellH) {
  if (!cells.length) return null;
  let sx = 0;
  let sy = 0;
  for (const { col, row } of cells) {
    sx += col * cellW + cellW / 2;
    sy += row * cellH + cellH / 2;
  }
  return { x: sx / cells.length, y: sy / cells.length };
}

/**
 * Centroïde du plus grand îlot 4-voisins de tuiles (ignore marqueurs isolés / 2ᵉ grappe).
 * Sinon le centroïde global peut tomber hors de la zone jouable → plant impossible sur un site.
 */
function centroidLargestTileComponentWorld(data, w, h, cellW, cellH) {
  const cells = cellsWithTiles(data, w, h);
  if (!cells.length) return null;
  const tileKey = (col, row) => row * w + col;
  const inTile = new Set(cells.map(({ col, row }) => tileKey(col, row)));
  const visited = new Set();
  let best = null;
  let bestLen = 0;
  const neigh = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0]
  ];
  for (const start of cells) {
    const sk = tileKey(start.col, start.row);
    if (visited.has(sk)) continue;
    const stack = [start];
    visited.add(sk);
    const comp = [start];
    while (stack.length) {
      const { col, row } = stack.pop();
      for (const [dc, dr] of neigh) {
        const nc = col + dc;
        const nr = row + dr;
        const nk = tileKey(nc, nr);
        if (!inTile.has(nk) || visited.has(nk)) continue;
        visited.add(nk);
        const cell = { col: nc, row: nr };
        comp.push(cell);
        stack.push(cell);
      }
    }
    if (comp.length > bestLen) {
      bestLen = comp.length;
      best = comp;
    }
  }
  return best?.length ? centroidWorld(best, cellW, cellH) : null;
}

function cellCentersWorld(cells, cellW, cellH) {
  return cells.map(({ col, row }) => ({
    x: col * cellW + cellW / 2,
    y: row * cellH + cellH / 2
  }));
}

/**
 * @param {boolean[][]} isWall
 */
/**
 * Grille 80×45 : priorité d’affichage mur > bombes > spawns > décor > sol > vide.
 * @param {object} map
 * @param {boolean[][]} isWall
 * @param {number} w
 * @param {number} h
 * @returns {string} longueur w*h
 */
function buildTiledDebugGridString(map, isWall, w, h) {
  const ground = getTileLayerData(map, 'ground');
  const decor = getTileLayerData(map, 'decor');
  const spawnDef = getTileLayerData(map, 'spawnDefense');
  const spawnAtt = getTileLayerData(map, 'spawnAttaque');
  const bombeA = getTileLayerData(map, 'bombeA');
  const bombeB = getTileLayerData(map, 'bombeB');
  const bombeC = getTileLayerData(map, 'bombeC');

  const at = (info, col, row) =>
    info && cellHasTile(info.data[row * w + col]);

  let s = '';
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      let code = TILED_DEBUG_CELL_EMPTY;
      if (at(ground, col, row)) code = TILED_DEBUG_CELL_GROUND;
      if (at(decor, col, row)) code = TILED_DEBUG_CELL_DECOR;
      if (at(spawnDef, col, row)) code = TILED_DEBUG_CELL_SPAWN_DEF;
      if (at(spawnAtt, col, row)) code = TILED_DEBUG_CELL_SPAWN_ATT;
      if (at(bombeA, col, row)) code = TILED_DEBUG_CELL_BOMBE_A;
      if (at(bombeB, col, row)) code = TILED_DEBUG_CELL_BOMBE_B;
      if (at(bombeC, col, row)) code = TILED_DEBUG_CELL_BOMBE_C;
      if (isWall[row][col]) code = TILED_DEBUG_CELL_WALL;
      s += String(code);
    }
  }
  return s;
}

function wallSpriteRotationDeg(isWall, row, col, R, C) {
  const neighborIsWall = (rr, cc) =>
    rr >= 0 && rr < R && cc >= 0 && cc < C && isWall[rr][cc];

  function wallRun(r, c, dRow, dCol) {
    let len = 0;
    let r2 = r + dRow;
    let c2 = c + dCol;
    while (neighborIsWall(r2, c2)) {
      len++;
      r2 += dRow;
      c2 += dCol;
    }
    return len;
  }

  const vSpan = 1 + wallRun(row, col, -1, 0) + wallRun(row, col, 1, 0);
  const hSpan = 1 + wallRun(row, col, 0, -1) + wallRun(row, col, 0, 1);
  if (vSpan > hSpan) return 90;
  if (hSpan > vSpan) return 0;
  return 0;
}

/**
 * @param {object} map — objet JSON Tiled (carte)
 * @returns {object} — même structure que parseGrid()
 */
export function parseTiledMapJson(map) {
  if (map.infinite) {
    throw new Error('[tiledMapParser] Carte infinie non supportée.');
  }
  const GRID_COLS = map.width;
  const GRID_ROWS = map.height;
  if (GRID_COLS !== 80 || GRID_ROWS !== 45) {
    throw new Error(`[tiledMapParser] Dimensions ${GRID_COLS}×${GRID_ROWS} — requis 80×45.`);
  }

  const tw = map.tilewidth;
  const th = map.tileheight;
  if (!Number.isFinite(tw) || !Number.isFinite(th) || tw <= 0 || th <= 0) {
    throw new Error('[tiledMapParser] tilewidth / tileheight invalides.');
  }

  const CELL_W = 1920 / GRID_COLS;
  const CELL_H = 1080 / GRID_ROWS;

  const wallInfo = getTileLayerData(map, 'walls');
  if (!wallInfo) {
    throw new Error('[tiledMapParser] Calque tuiles "walls" introuvable.');
  }

  const { data } = wallInfo;
  /** @type {boolean[][]} */
  const isWall = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (cellHasTile(data[row * GRID_COLS + col])) isWall[row][col] = true;
    }
  }

  const cellAt = (rr, cc) => {
    if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) return 'X';
    return isWall[rr][cc] ? 'X' : '.';
  };

  const walls = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (!isWall[row][col]) continue;
      const x = col * CELL_W;
      const y = row * CELL_H;
      const up = cellAt(row - 1, col);
      const down = cellAt(row + 1, col);
      const left = cellAt(row, col - 1);
      const right = cellAt(row, col + 1);
      const isBorder = [up, down, left, right].some((c) => c !== 'X');
      walls.push({
        x,
        y,
        width: CELL_W,
        height: CELL_H,
        kind: isBorder ? 'bordure' : 'mur_plein',
        rotation: wallSpriteRotationDeg(isWall, row, col, GRID_ROWS, GRID_COLS)
      });
    }
  }

  // Free cells = uniquement les cases jouables.
  // Problème observé : certaines maps Tiled ont des zones “vide” hors arène (hors murs),
  // non marquées walls. Sans filtre, les power-ups peuvent spawn “dehors”.
  // → On privilégie les cases où le calque ground/decor/spawn/bombe a une tuile.
  const ground = getTileLayerData(map, 'ground');
  const decor = getTileLayerData(map, 'decor');
  const spawnDefForFree = getTileLayerData(map, 'spawnDefense');
  const spawnAttForFree = getTileLayerData(map, 'spawnAttaque');
  const bombeAForFree = getTileLayerData(map, 'bombeA');
  const bombeBForFree = getTileLayerData(map, 'bombeB');
  const bombeCForFree = getTileLayerData(map, 'bombeC');

  const at = (info, col, row) => info && cellHasTile(info.data[row * GRID_COLS + col]);
  const hasPlayableTile = (col, row) =>
    at(ground, col, row) ||
    at(decor, col, row) ||
    at(spawnDefForFree, col, row) ||
    at(spawnAttForFree, col, row) ||
    at(bombeAForFree, col, row) ||
    at(bombeBForFree, col, row) ||
    at(bombeCForFree, col, row);

  const useFilter =
    !!ground?.data ||
    !!decor?.data ||
    !!spawnDefForFree?.data ||
    !!spawnAttForFree?.data ||
    !!bombeAForFree?.data ||
    !!bombeBForFree?.data ||
    !!bombeCForFree?.data;

  const freeCells = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (isWall[row][col]) continue;
      // Si aucun calque “jouable” n’est présent, on repli sur “non-wall”
      if (useFilter && !hasPlayableTile(col, row)) continue;
      freeCells.push({
        x: col * CELL_W + CELL_W / 2,
        y: row * CELL_H + CELL_H / 2
      });
    }
  }

  const bombSites = [];

  const layerA = getTileLayerData(map, 'bombeA');
  const layerB = getTileLayerData(map, 'bombeB');
  const layerC = getTileLayerData(map, 'bombeC');
  if (layerA) {
    const c = centroidLargestTileComponentWorld(layerA.data, GRID_COLS, GRID_ROWS, CELL_W, CELL_H);
    if (c) bombSites.push({ id: 'A', x: c.x, y: c.y, radius: BOMB_SITE_RADIUS });
  }
  if (layerB) {
    const c = centroidLargestTileComponentWorld(layerB.data, GRID_COLS, GRID_ROWS, CELL_W, CELL_H);
    if (c) bombSites.push({ id: 'B', x: c.x, y: c.y, radius: BOMB_SITE_RADIUS });
  }
  if (layerC) {
    const c = centroidLargestTileComponentWorld(layerC.data, GRID_COLS, GRID_ROWS, CELL_W, CELL_H);
    if (c) bombSites.push({ id: 'C', x: c.x, y: c.y, radius: BOMB_SITE_RADIUS });
  }

  if (bombSites.length < 2) {
    throw new Error(
      '[tiledMapParser] Au moins deux sites bombe (tuiles sur au moins deux calques parmi bombeA, bombeB, bombeC).'
    );
  }

  const spawnDef = getTileLayerData(map, 'spawnDefense');
  const spawnAtt = getTileLayerData(map, 'spawnAttaque');
  if (!spawnDef || !spawnAtt) {
    throw new Error('[tiledMapParser] Calques spawnDefense et spawnAttaque requis.');
  }

  const spawnCTPoints = cellCentersWorld(
    cellsWithTiles(spawnDef.data, GRID_COLS, GRID_ROWS),
    CELL_W,
    CELL_H
  );
  const spawnTPoints = cellCentersWorld(
    cellsWithTiles(spawnAtt.data, GRID_COLS, GRID_ROWS),
    CELL_W,
    CELL_H
  );

  if (!spawnCTPoints.length) {
    throw new Error('[tiledMapParser] Aucune tuile sur spawnDefense.');
  }
  if (!spawnTPoints.length) {
    throw new Error('[tiledMapParser] Aucune tuile sur spawnAttaque.');
  }

  const spawnCT = spawnCTPoints[0];
  const spawnT = spawnTPoints[0];

  const tiledDebugGrid = {
    width: GRID_COLS,
    height: GRID_ROWS,
    cells: buildTiledDebugGridString(map, isWall, GRID_COLS, GRID_ROWS),
  };

  return {
    width: 1920,
    height: 1080,
    walls,
    bombSites,
    spawnCT,
    spawnT,
    spawnCTPoints,
    spawnTPoints,
    freeCells,
    tiledDebugGrid,
  };
}

/**
 * @param {string} absolutePath — chemin absolu vers le .tmj
 * @param {object} [options]
 * @param {string} [options.mapId]
 */
export function parseTiledMapFile(absolutePath, options = {}) {
  const raw = readFileSync(absolutePath, 'utf8');
  const json = JSON.parse(raw);
  const base = parseTiledMapJson(json);
  return {
    ...base,
    mapId: options.mapId,
  };
}

/** Racine dépôt → chemin absolu vers maps/tiled/tilesets/<file> */
export function resolveTiledMapPath(filename) {
  const root = join(__dirname, '..', '..', '..');
  return join(root, 'maps', 'tiled', 'tilesets', filename);
}
