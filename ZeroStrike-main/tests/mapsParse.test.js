/**
 * Vérifie que les grilles S&D générées se parsent correctement (sites, spawns 20v20).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAP_LIST, parseGrid, getMapData } from '../server/models/maps/Maps.js';

const GRID_ROWS = 45;
const GRID_COLS = 80;
/** Marge pour 20 joueurs par équipe + dispersion */
const MIN_SPAWN_PER_TEAM = 40;

describe('Maps — grilles générées (80×45)', () => {
  for (const m of MAP_LIST) {
    it(`${m.id}: dimensions, sites bombe, zones de spawn`, () => {
      if (m.tiledFile) {
        const d = getMapData(m.id);
        assert.ok(d.tiledDebugGrid?.cells?.length === 80 * 45);
        if (m.id === 'maven') {
          assert.equal(d.bombSites.length, 3);
          const siteIdsMaven = [...d.bombSites.map((b) => b.id)].sort().join('');
          assert.equal(siteIdsMaven, 'ABC');
        } else {
          assert.equal(d.bombSites.length, 2);
          const siteIds = [...d.bombSites.map((b) => b.id)].sort().join('');
          assert.equal(siteIds, 'AB');
        }
        assert.ok(d.spawnCTPoints.length >= 1, 'spawn DEF (Tiled)');
        assert.ok(d.spawnTPoints.length >= 1, 'spawn ATT (Tiled)');
        assert.ok(d.walls.length > 50, 'murs Tiled présents');
        assert.equal(d.width, 1920);
        assert.equal(d.height, 1080);
        return;
      }

      const grid = m.grid;
      assert.equal(grid.length, GRID_ROWS, 'nombre de lignes');
      assert.ok(grid.every((row) => row.length === GRID_COLS), 'largeur uniforme 80');

      const d = parseGrid(grid, { spawnFromMarkersOnly: m.spawnFromMarkersOnly === true });
      const wantSites = m.id === 'maven' ? 3 : 2;
      assert.equal(d.bombSites.length, wantSites);
      const siteIds = [...d.bombSites.map((b) => b.id)].sort().join('');
      assert.equal(siteIds, m.id === 'maven' ? 'ABC' : 'AB');

      assert.ok(
        d.spawnCTPoints.length >= MIN_SPAWN_PER_TEAM,
        `spawn DEF (CT): ${d.spawnCTPoints.length} < ${MIN_SPAWN_PER_TEAM}`
      );
      assert.ok(
        d.spawnTPoints.length >= MIN_SPAWN_PER_TEAM,
        `spawn ATT (T): ${d.spawnTPoints.length} < ${MIN_SPAWN_PER_TEAM}`
      );

      assert.ok(d.walls.length > 200, 'murs/obstacles présents');
      assert.equal(d.width, 1920);
      assert.equal(d.height, 1080);
    });
  }

  it('getMapData rejette un mapId inconnu', () => {
    assert.throws(() => getMapData('carte_inexistante'), /mapId inconnu/);
  });

  it('parseGrid rejette une grille vide', () => {
    assert.throws(() => parseGrid([]), /Grille vide/);
  });
});
