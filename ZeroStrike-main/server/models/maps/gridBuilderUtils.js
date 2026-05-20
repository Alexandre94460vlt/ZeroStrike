/**
 * Utilitaires partagés pour les grilles S&D 1920×1080 (lignes × colonnes).
 * Monde logique : rows × cols → cellules 1920/cols × 1080/rows.
 */

export const DEFAULT_GRID_ROWS = 45;
export const DEFAULT_GRID_COLS = 80;

/**
 * @param {number} [rows]
 * @param {number} [cols]
 * @returns {string[][]}
 */
export function createSolidGrid(rows = DEFAULT_GRID_ROWS, cols = DEFAULT_GRID_COLS) {
  return Array.from({ length: rows }, () => Array(cols).fill('X'));
}

/**
 * @param {string[][]} g
 * @param {number} r0
 * @param {number} r1
 * @param {number} c0
 * @param {number} c1
 */
export function carve(g, r0, r1, c0, c1) {
  const R = g.length;
  const C = g[0].length;
  for (let r = Math.max(0, r0); r <= Math.min(R - 1, r1); r++)
    for (let c = Math.max(0, c0); c <= Math.min(C - 1, c1); c++)
      g[r][c] = '.';
}

/**
 * @param {string[][]} g
 * @param {number} r0
 * @param {number} r1
 * @param {number} c0
 * @param {number} c1
 */
export function addWall(g, r0, r1, c0, c1) {
  const R = g.length;
  const C = g[0].length;
  for (let r = Math.max(0, r0); r <= Math.min(R - 1, r1); r++)
    for (let c = Math.max(0, c0); c <= Math.min(C - 1, c1); c++)
      g[r][c] = 'X';
}

/**
 * @param {string[][]} g
 * @returns {string[]}
 */
export function gridToStringRows(g) {
  return g.map((row) => row.join(''));
}

/**
 * Bordure extérieure classique (murs sur le pourtour, intérieur 1..R-2, 1..C-2 laissé tel quel).
 * @param {string[][]} g
 */
export function addOuterBorder(g) {
  const R = g.length;
  const C = g[0].length;
  addWall(g, 0, 0, 0, C - 1);
  addWall(g, R - 1, R - 1, 0, C - 1);
  addWall(g, 1, R - 2, 0, 0);
  addWall(g, 1, R - 2, C - 1, C - 1);
}

/**
 * Remplit une zone de marqueurs T ou C sur le sol (pour spawns 20v20).
 * @param {string[][]} g
 * @param {number} r0
 * @param {number} r1
 * @param {number} c0
 * @param {number} c1
 * @param {'T'|'C'} marker
 */
export function fillSpawnMarkers(g, r0, r1, c0, c1, marker) {
  const R = g.length;
  const C = g[0].length;
  for (let r = Math.max(0, r0); r <= Math.min(R - 1, r1); r++)
    for (let c = Math.max(0, c0); c <= Math.min(C - 1, c1); c++)
      if (g[r][c] === '.') g[r][c] = marker;
}

/**
 * @param {string[][]} g
 * @param {number} r
 * @param {number} c
 * @param {string} ch
 */
export function setIfFloor(g, r, c, ch) {
  const R = g.length;
  const C = g[0].length;
  if (r >= 0 && r < R && c >= 0 && c < C && g[r][c] === '.') g[r][c] = ch;
}

/**
 * @param {string[][]} g
 * @param {Array<[number, number]>} positions
 */
export function applyCovers(g, positions) {
  for (const [r, c] of positions) setIfFloor(g, r, c, 'O');
}
