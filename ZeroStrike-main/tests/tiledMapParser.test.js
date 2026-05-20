/**
 * Parseur Tiled serveur — aligné avec dist2.tmj.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapDataForSocket } from '../server/models/maps/Maps.js';
import {
  parseTiledMapFile,
  resolveTiledMapPath,
  TILED_DEBUG_CELL_WALL,
  TILED_DEBUG_CELL_GROUND,
} from '../server/models/maps/tiledMapParser.js';

describe('tiledMapParser', () => {
  it('parse dist2.tmj → mapData + tiledDebugGrid + map_data', () => {
    const abs = resolveTiledMapPath('dist2.tmj');
    const d = parseTiledMapFile(abs, { mapId: 'dist2' });
    assert.equal(d.mapId, 'dist2');
    assert.ok(Array.isArray(d.walls) && d.walls.length > 0);
    assert.equal(d.bombSites.length, 2);

    assert.ok(d.tiledDebugGrid);
    assert.equal(d.tiledDebugGrid.width, 80);
    assert.equal(d.tiledDebugGrid.height, 45);
    assert.equal(d.tiledDebugGrid.cells.length, 80 * 45);

    const wallChar = String(TILED_DEBUG_CELL_WALL);
    const groundChar = String(TILED_DEBUG_CELL_GROUND);
    assert.ok(d.tiledDebugGrid.cells.includes(wallChar));
    assert.ok(d.tiledDebugGrid.cells.includes(groundChar));

    const sock = mapDataForSocket('dist2', d, d.walls);
    assert.ok(sock.tiledDebugGrid);
    assert.equal(sock.tiledDebugGrid.cells.length, 3600);
    assert.equal(sock.tiledNativeRender, undefined);
    assert.equal(sock.tiledMapPath, undefined);
    assert.ok(sock.freeCells.length > 100);
  });
});
