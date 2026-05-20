/**
 * Chadigo — inspiration radar **Vertigo** (CS:GO), pack visuel cible : Kenney rpg-urban-pack.
 * Grille 80×45 : **deux masses verticales** (tours) avec **fente + passerelle** façon zone grue,
 * site B haut / A bas, T gauche — lecture « deux niveaux » en une seule couche abstraite.
 */

import {
  DEFAULT_GRID_COLS as C,
  DEFAULT_GRID_ROWS as R,
  addOuterBorder,
  applyCovers,
  carve,
  addWall,
  createSolidGrid,
  fillSpawnMarkers,
  gridToStringRows,
  setIfFloor
} from './gridBuilderUtils.js';

/**
 * @returns {string[]}
 */
export function buildHarborStrikeGrid() {
  const g = createSolidGrid(R, C);

  carve(g, 2, 40, 2, 5);
  carve(g, 17, 24, 2, 13);

  carve(g, 2, 4, 2, 58);

  /* Site B (plateforme haute — radar Vertigo nord) */
  carve(g, 2, 15, 56, 77);
  carve(g, 4, 17, 52, 58);

  carve(g, 15, 31, 63, 77);

  /* Approche mid côté T */
  carve(g, 17, 23, 8, 48);

  /* Tour A + Tour B : fente centrale (cols 47–49) pour « allée grue » */
  addWall(g, 6, 33, 36, 46);
  carve(g, 17, 22, 36, 46);
  addWall(g, 6, 33, 50, 63);
  carve(g, 17, 22, 50, 63);

  /* Passerelle horizontale reliant les deux côtés au-dessus de la fente */
  carve(g, 14, 18, 44, 55);

  /* Mid droit après les tours */
  carve(g, 17, 23, 52, 66);

  /* Petit îlot mid (reprise lecture radar) */
  addWall(g, 17, 23, 34, 38);
  carve(g, 17, 18, 34, 38);
  carve(g, 22, 23, 34, 38);
  carve(g, 20, 20, 34, 38);

  carve(g, 36, 40, 2, 58);

  /* Site A (bas — radar Vertigo sud) */
  carve(g, 30, 40, 56, 77);

  addOuterBorder(g);

  setIfFloor(g, 5, 64, 'B');
  setIfFloor(g, 36, 66, 'A');

  setIfFloor(g, 21, 71, 'C');
  setIfFloor(g, 22, 71, 'C');

  fillSpawnMarkers(g, 18, 22, 4, 10, 'T');

  applyCovers(g, [
    [6, 60], [9, 68], [12, 74],
    [34, 60], [32, 66], [37, 72],
    [3, 22], [3, 40],
    [38, 18], [38, 50],
    [18, 14], [21, 26],
    [18, 58], [21, 56],
    [14, 48], [25, 48],
    [21, 67],
    [20, 47], [20, 52]
  ]);

  setIfFloor(g, 5, 64, 'B');
  setIfFloor(g, 36, 66, 'A');

  return gridToStringRows(g);
}
