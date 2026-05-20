/**
 * Grilles des cartes — monde logique toujours 1920×1080 px.
 * ─────────────────────────────────────────────────────────────────────────────
 * Légende  :  X = mur   .= sol libre   A / B = sites bombe (une lettre = un site)
 *             c = 3e site bombe (id « C » en jeu, ex. Maven/Haven — ne pas confondre avec spawn)
 *             C = spawn CT (DEF)   T = spawn T (ATT)   O = obstacle (caisse, collision)
 *
 * Cartes S&D : grilles 80×45 (cellules 24×24 px) générées par les builders ASCII (`*GridBuilder.js`).
 */
import { buildAscensionGrid } from './ascensionGridBuilder.js';
import { buildDustStrikeGrid } from './dustStrikeGridBuilder.js';
import { buildHarborStrikeGrid } from './harborStrikeGridBuilder.js';
import { buildUrbanStrikeGrid } from './urbanStrikeGridBuilder.js';
import { parseTiledMapFile, resolveTiledMapPath } from './tiledMapParser.js';

/** Grille ASCII Dist2 (outil / fallback) — la carte jouée est le fichier Tiled `dist2.tmj`. */
export const dustStrikeGrid = buildDustStrikeGrid();

/** MAP 2 : Ascension */
export const ascensionGrid = buildAscensionGrid();

/** MAP 3 : Maven */
export const urbanStrikeGrid = buildUrbanStrikeGrid();

/** MAP 4 : Chadigo */
export const chadigoGrid = buildHarborStrikeGrid();

// ─── CONSTANTES DE PARSING ───────────────────────────────────────────────────
const BOMB_SITE_RADIUS = 55;
/** Rayon (en cases) autour des marqueurs C/T pour remplir les zones de spawn (cartes ASCII « classiques »). */
const SPAWN_ZONE_RADIUS = 6;

// ─── LISTE MAÎTRE ────────────────────────────────────────────────────────────
export const MAP_LIST = [
  /**
   * Carte Dist2 : parse `dist2.tmj` par défaut (`tiledDebugGrid` côté display).
   * Repli ASCII : même `dustStrikeGrid` que l’ancien builder si le .tmj échoue, ou si
   * `process.env.ZS_USE_ASCII_MAP === 'dist2'`.
   */
  {
    id: 'dist2',
    name: 'Dist2',
    tiledFile: 'dist2.tmj',
    asciiFallbackGrid: dustStrikeGrid,
  },
  {
    id: 'ascension',
    name: 'Ascension',
    tiledFile: 'ascension.tmj',
    asciiFallbackGrid: ascensionGrid,
  },
  {
    id: 'maven',
    name: 'Maven',
    tiledFile: 'maven.tmj',
    asciiFallbackGrid: urbanStrikeGrid,
  },
  {
    id: 'chadigo',
    name: 'Chadigo',
    tiledFile: 'chadigo.tmj',
    asciiFallbackGrid: chadigoGrid,
  },
];

/**
 * Parse une grille ASCII → données de carte (murs, sites, spawns, cases libres).
 * Dimensions déduites de la grille (ex. 80×45) ; monde 1920×1080.
 *
 * @param {object} [options]
 * @param {boolean} [options.spawnFromMarkersOnly] — si true : un point de spawn par case `C` / `T` uniquement ;
 *   sinon : zones élargies autour des marqueurs (20v20).
 */
export function parseGrid(grid, options = {}) {
  const spawnFromMarkersOnly = options.spawnFromMarkersOnly === true;
  const walls      = [];
  const bombSites  = [];
  const freeCells  = [];
  let spawnCT = null, spawnT = null;
  let spawnCTCol = 0, spawnCTRow = 0;
  let spawnTCol  = 0, spawnTRow  = 0;

  const GRID_ROWS = grid.length;
  if (GRID_ROWS === 0) {
    throw new Error('[Maps] Grille vide (0 ligne) — aucune carte valide.');
  }
  const GRID_COLS = grid[0].length;
  for (let r = 1; r < GRID_ROWS; r++) {
    if (grid[r].length !== GRID_COLS) {
      throw new Error(`[Maps] Grille incohérente ligne ${r} : ${grid[r].length} cols ≠ ${GRID_COLS}`);
    }
  }
  const CELL_W = 1920 / GRID_COLS;
  const CELL_H = 1080 / GRID_ROWS;

  const cellAt = (rr, cc) => {
    if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) return 'X';
    return grid[rr][cc];
  };

  /** Voisin « mur » uniquement dans la grille (hors carte ≠ mur) — pour orientation visuelle des tuiles. */
  const neighborIsWall = (rr, cc) =>
    rr >= 0 && rr < GRID_ROWS && cc >= 0 && cc < GRID_COLS && grid[rr][cc] === 'X';

  /** Longueur de la ligne de X continue depuis (row,col) dans une direction. */
  function wallRun(row, col, dRow, dCol) {
    let len = 0;
    let r = row + dRow;
    let c = col + dCol;
    while (neighborIsWall(r, c)) {
      len++;
      r += dRow;
      c += dCol;
    }
    return len;
  }

  /**
   * 0 = barre Kenney « horizontale », 90 = tourner pour aligner un mur vertical.
   * Les murs épais (2+ cases) avaient autant de voisins H que V → toujours 0° : on compare
   * la portée verticale vs horizontale du segment de mur qui passe par cette case.
   */
  function wallSpriteRotationDeg(row, col) {
    const vSpan = 1 + wallRun(row, col, -1, 0) + wallRun(row, col, 1, 0);
    const hSpan = 1 + wallRun(row, col, 0, -1) + wallRun(row, col, 0, 1);
    if (vSpan > hSpan) return 90;
    if (hSpan > vSpan) return 0;
    return 0;
  }

  for (let row = 0; row < GRID_ROWS; row++) {
    const line = grid[row];
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = line[col];
      const x  = col * CELL_W;
      const y  = row * CELL_H;
      const cx = x + CELL_W / 2;
      const cy = y + CELL_H / 2;

      switch (cell) {
        case 'X': {
          const up    = cellAt(row - 1, col);
          const down  = cellAt(row + 1, col);
          const left  = cellAt(row, col - 1);
          const right = cellAt(row, col + 1);
          const isBorder = [up, down, left, right].some(c => c !== 'X');
          walls.push({
            x, y, width: CELL_W, height: CELL_H,
            kind: isBorder ? 'bordure' : 'mur_plein',
            rotation: wallSpriteRotationDeg(row, col)
          });
          break;
        }
        case 'A':
          bombSites.push({ id: 'A', x: cx, y: cy, radius: BOMB_SITE_RADIUS });
          freeCells.push({ x: cx, y: cy, col, row });
          break;
        case 'B':
          bombSites.push({ id: 'B', x: cx, y: cy, radius: BOMB_SITE_RADIUS });
          freeCells.push({ x: cx, y: cy, col, row });
          break;
        case 'c':
          bombSites.push({ id: 'C', x: cx, y: cy, radius: BOMB_SITE_RADIUS });
          freeCells.push({ x: cx, y: cy, col, row });
          break;
        case 'C':
          if (!spawnCT) { spawnCT = { x: cx, y: cy }; spawnCTCol = col; spawnCTRow = row; }
          freeCells.push({ x: cx, y: cy, col, row });
          break;
        case 'T':
          if (!spawnT)  { spawnT  = { x: cx, y: cy }; spawnTCol  = col; spawnTRow  = row; }
          freeCells.push({ x: cx, y: cy, col, row });
          break;
        case 'O':
          walls.push({
            x, y, width: CELL_W, height: CELL_H,
            kind: 'obstacle',
            rotation: 0
          });
          freeCells.push({ x: cx, y: cy, col, row });
          break;
        case '.':
          freeCells.push({ x: cx, y: cy, col, row });
          break;
        default: break;
      }
    }
  }

  let spawnCTPoints;
  let spawnTPoints;

  if (spawnFromMarkersOnly) {
    spawnCTPoints = [];
    spawnTPoints = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const ch = grid[row][col];
        if (ch !== 'C' && ch !== 'T') continue;
        const x = col * CELL_W + CELL_W / 2;
        const y = row * CELL_H + CELL_H / 2;
        if (ch === 'C') spawnCTPoints.push({ x, y });
        if (ch === 'T') spawnTPoints.push({ x, y });
      }
    }
  } else {
    const allCTCols = new Set();
    const allCTRows = new Set();
    const allTCols = new Set();
    const allTRows = new Set();
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (grid[row][col] === 'C') {
          allCTCols.add(col);
          allCTRows.add(row);
        }
        if (grid[row][col] === 'T') {
          allTCols.add(col);
          allTRows.add(row);
        }
      }
    }

    const inSpawnZone = (c, cols, rows) => {
      for (const sc of cols) {
        for (const sr of rows) {
          if (Math.abs(c.col - sc) <= SPAWN_ZONE_RADIUS && Math.abs(c.row - sr) <= SPAWN_ZONE_RADIUS) return true;
        }
      }
      return false;
    };

    spawnCTPoints = freeCells
      .filter((c) => inSpawnZone(c, allCTCols, allCTRows))
      .map((c) => ({ x: c.x, y: c.y }));

    spawnTPoints = freeCells
      .filter((c) => inSpawnZone(c, allTCols, allTRows))
      .map((c) => ({ x: c.x, y: c.y }));
  }

  if (bombSites.length < 2) {
    throw new Error('[Maps] Au moins deux sites bombe (A et B) sont requis dans la grille.');
  }
  if (!spawnCTPoints.length) {
    throw new Error('[Maps] Aucun spawn DEF (marqueurs C / calque SpawnDefense).');
  }
  if (!spawnTPoints.length) {
    throw new Error('[Maps] Aucun spawn ATT (marqueurs T / calque SpawnAttaque).');
  }

  const spawnCTFinal = spawnCT ?? spawnCTPoints[0];
  const spawnTFinal = spawnT ?? spawnTPoints[0];

  return {
    width: 1920,
    height: 1080,
    walls,
    bombSites,
    spawnCT: spawnCTFinal,
    spawnT: spawnTFinal,
    spawnCTPoints,
    spawnTPoints,
    freeCells: freeCells.map(c => ({ x: c.x, y: c.y }))
  };
}

/**
 * Retourne les données parsées d'une map depuis la liste locale.
 */
export function getMapData(mapId) {
  const entry = MAP_LIST.find(m => m.id === mapId);
  if (!entry) {
    throw new Error(`[Maps] mapId inconnu : ${String(mapId)} (attendu un id de MAP_LIST).`);
  }
  if (entry.tiledFile) {
    const forceAscii =
      entry.asciiFallbackGrid &&
      typeof process !== 'undefined' &&
      process.env &&
      process.env.ZS_USE_ASCII_MAP === entry.id;
    if (forceAscii) {
      console.warn(
        `[Maps] Carte "${entry.id}" : ZS_USE_ASCII_MAP=${entry.id} — parse grille ASCII (pas le .tmj).`
      );
      return parseGrid(entry.asciiFallbackGrid, {
        spawnFromMarkersOnly: entry.spawnFromMarkersOnly === true,
      });
    }
    const abs = resolveTiledMapPath(entry.tiledFile);
    try {
      return parseTiledMapFile(abs, { mapId });
    } catch (err) {
      if (entry.asciiFallbackGrid) {
        console.warn(
          `[Maps] Parse Tiled "${entry.tiledFile}" échoué, repli ASCII : ${err?.message || err}`
        );
        return parseGrid(entry.asciiFallbackGrid, {
          spawnFromMarkersOnly: entry.spawnFromMarkersOnly === true,
        });
      }
      throw err;
    }
  }
  if (!entry.grid) {
    throw new Error(`[Maps] Carte "${entry.id}" : ni tiledFile ni grille ASCII.`);
  }
  return parseGrid(entry.grid, { spawnFromMarkersOnly: entry.spawnFromMarkersOnly === true });
}

/**
 * Payload `map_data` Socket.io (display) — grille couleur Tiled si carte .tmj.
 */
export function mapDataForSocket(mapId, mapData, walls) {
  const o = {
    mapId,
    walls,
    bombSites: mapData.bombSites,
    freeCells: mapData.freeCells,
  };
  if (mapData.tiledDebugGrid) {
    o.tiledDebugGrid = mapData.tiledDebugGrid;
  }
  return o;
}
