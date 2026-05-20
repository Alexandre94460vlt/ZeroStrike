/**
 * Ascension — inspiration radar **Ascent** (Valorant), pack visuel cible : Kenney scribble-dungeons.
 * Grille 80×45 : **mid large**, bâtiment central (îlot), **choke « market »** côté T avant mid,
 * site B haut-droite / A bas-droite (pit), CT profond.
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
export function buildAscensionGrid() {
  const g = createSolidGrid(R, C);

  /* Strip T vertical */
  carve(g, 2, 40, 2, 6);
  carve(g, 15, 28, 2, 15);

  /* Voie haute vers B */
  carve(g, 2, 5, 2, 60);

  /* Site B (haut-droite) */
  carve(g, 2, 17, 55, 77);

  /* Short / lien tunnel → CT */
  carve(g, 4, 19, 56, 67);

  /* Zone CT + accès sites */
  carve(g, 13, 31, 63, 77);

  /* Choke « market » : passage étroit avant d’entrer dans le mid complet */
  addWall(g, 14, 26, 6, 11);
  carve(g, 18, 22, 8, 9);

  /* Mid ouvert + approche T */
  carve(g, 16, 28, 7, 65);

  /* Bâtiment central (îlot Ascent) + cour intérieure */
  addWall(g, 17, 27, 33, 39);
  carve(g, 17, 18, 33, 39);
  carve(g, 26, 27, 33, 39);
  carve(g, 21, 22, 33, 39);
  carve(g, 20, 24, 34, 38);

  /* Long A (bas) */
  carve(g, 35, 40, 2, 60);

  /* Site A — pit (légèrement resserré pour lecture « fosse ») */
  carve(g, 28, 40, 55, 77);
  addWall(g, 31, 39, 58, 72);
  carve(g, 32, 38, 58, 72);

  addOuterBorder(g);

  setIfFloor(g, 4, 64, 'B');
  setIfFloor(g, 36, 64, 'A');

  setIfFloor(g, 21, 72, 'C');
  setIfFloor(g, 22, 72, 'C');

  fillSpawnMarkers(g, 17, 26, 4, 12, 'T');

  applyCovers(g, [
    [5, 58], [8, 66], [11, 74],
    [36, 58], [33, 66], [38, 74],
    [3, 24], [3, 48],
    [37, 20], [37, 44],
    [19, 12], [23, 28],
    [19, 58], [24, 50],
    [12, 63],
    [22, 69],
    [16, 14], [25, 10]
  ]);

  setIfFloor(g, 4, 64, 'B');
  setIfFloor(g, 36, 64, 'A');

  return gridToStringRows(g);
}
