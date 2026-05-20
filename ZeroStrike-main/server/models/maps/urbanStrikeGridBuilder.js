/**
 * Maven — inspiration radar **Haven** (Valorant), pack visuel cible : Kenney top-down-shooter.
 * Grille 80×45 : T gauche, **cour centrale à 3 entrées** (piliers), sites en poches DEF droite
 * (B haut / A bas). 3e site bombe (`c` → id C en jeu) au milieu pour alignement Haven / tests.
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
export function buildUrbanStrikeGrid() {
  const g = createSolidGrid(R, C);

  /* Cour attaquants (large, façon spawn Haven côté une entrée) */
  carve(g, 9, 35, 2, 20);

  /* Trois débouchés : haut → B, milieu → cour, bas → A */
  carve(g, 2, 9, 12, 36);
  carve(g, 10, 27, 8, 38);
  carve(g, 33, 42, 10, 38);

  /* Cour centrale ouverte (duel mid Haven) */
  carve(g, 7, 36, 22, 66);

  /* Poche site B — haut droit */
  carve(g, 2, 17, 48, 76);
  carve(g, 3, 16, 42, 52);

  /* Poche site A — bas droit */
  carve(g, 28, 42, 46, 76);
  carve(g, 26, 38, 40, 52);

  /* Rotations CT / lien sites */
  carve(g, 11, 33, 60, 77);
  carve(g, 14, 30, 52, 68);

  /* Piliers = portes / chokes dans la cour (3 passages) */
  addWall(g, 17, 23, 36, 42);
  carve(g, 18, 22, 36, 42);
  addWall(g, 11, 16, 44, 47);
  carve(g, 12, 15, 44, 47);
  addWall(g, 26, 31, 44, 47);
  carve(g, 27, 30, 44, 47);

  addOuterBorder(g);

  setIfFloor(g, 7, 64, 'B');
  setIfFloor(g, 36, 64, 'A');

  setIfFloor(g, 21, 71, 'C');
  setIfFloor(g, 22, 71, 'C');

  fillSpawnMarkers(g, 12, 32, 3, 17, 'T');

  applyCovers(g, [
    [4, 58], [6, 64], [9, 70], [12, 74],
    [37, 56], [35, 62], [38, 70], [33, 74],
    [4, 16], [4, 28], [5, 48],
    [35, 12], [35, 28], [35, 48],
    [18, 8], [21, 18], [20, 30],
    [18, 54], [21, 50], [20, 40],
    [10, 62], [15, 66], [24, 58],
    [21, 68], [24, 72],
    [15, 34], [28, 38], [19, 52]
  ]);

  setIfFloor(g, 7, 64, 'B');
  setIfFloor(g, 36, 64, 'A');
  /* 3e site bombe (cour centrale), distinct des spawns CT (`C` majuscule) */
  setIfFloor(g, 20, 44, 'c');

  return gridToStringRows(g);
}
