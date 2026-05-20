/**
 * Dist2 — inspiration radar **Dust II** (CS:GO), pack visuel cible : Kenney tower-defense-top-down.
 * Grille 80×45 : T gauche, **long A** bas, **short/cat** haut, **tunnels B**, mid **xbox**,
 * sites A/B et CT à droite (lecture radar classique).
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
export function buildDustStrikeGrid() {
  const g = createSolidGrid(R, C);

  /* Tunnels B (haut) — choke T */
  carve(g, 2, 40, 2, 5);
  carve(g, 17, 24, 2, 13);

  /* Short / cat (haut) — séparation longue vers CT */
  carve(g, 2, 4, 2, 58);

  /* Long A (bas) — corridor radar « long » élargi */
  carve(g, 2, 16, 56, 77);

  /* Raccourci A (pizza) */
  carve(g, 4, 18, 57, 66);

  /* Profondeur CT + A */
  carve(g, 15, 29, 64, 77);

  /* Mid + xbox (bâtiment double porte) */
  carve(g, 17, 23, 8, 64);

  addWall(g, 17, 23, 34, 38);
  carve(g, 17, 18, 34, 38);
  carve(g, 22, 23, 34, 38);
  carve(g, 20, 20, 34, 38);

  /* Long A plein pied vers site */
  carve(g, 36, 40, 2, 62);

  /* Site A et espace plant */
  carve(g, 29, 40, 56, 77);

  addOuterBorder(g);

  setIfFloor(g, 3, 62, 'B');
  setIfFloor(g, 37, 62, 'A');

  setIfFloor(g, 21, 70, 'C');
  setIfFloor(g, 21, 71, 'C');

  fillSpawnMarkers(g, 18, 22, 4, 9, 'T');

  /* Mur léger « séparation cat / mid » côté radar (lisibilité choke) */
  addWall(g, 5, 9, 26, 30);
  carve(g, 6, 8, 26, 30);

  applyCovers(g, [
    [4, 59], [7, 63], [9, 73],
    [37, 59], [32, 63], [38, 73],
    [3, 20], [3, 42],
    [38, 18], [38, 42],
    [18, 14], [21, 22],
    [18, 52], [21, 47],
    [10, 61],
    [21, 68],
    [12, 28], [8, 50]
  ]);

  setIfFloor(g, 3, 62, 'B');
  setIfFloor(g, 37, 62, 'A');

  return gridToStringRows(g);
}
