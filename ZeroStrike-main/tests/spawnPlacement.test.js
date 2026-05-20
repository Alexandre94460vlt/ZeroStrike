import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickSpawnPointMaxMinDist,
  assignSpawnPositionsGreedy,
  getSpawnPointsAndFaceForPlayer
} from '../server/utils/spawnPlacement.js';
import { SPAWN_PLAYER_MIN_SEPARATION } from '../server/config/constants.js';

describe('spawnPlacement', () => {
  const mapData = {
    spawnCTPoints: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 400, y: 0 }
    ],
    spawnTPoints: [{ x: 1000, y: 1000 }]
  };

  it('pickSpawnPointMaxMinDist évite le joueur déjà sur la première tuile', () => {
    const refs = [{ id: 'a', x: 0, y: 0 }];
    const pt = pickSpawnPointMaxMinDist(mapData.spawnCTPoints, refs, null, SPAWN_PLAYER_MIN_SEPARATION);
    assert.notEqual(pt.x, 0);
    assert.ok(pt.x === 200 || pt.x === 400);
  });

  it('assignSpawnPositionsGreedy espace deux DEF sur plusieurs tuiles CT', () => {
    const p1 = { id: 'z1', team: 'DEF' };
    const p2 = { id: 'z2', team: 'DEF' };
    assignSpawnPositionsGreedy(mapData, [p1, p2]);
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const d = Math.hypot(dx, dy);
    assert.ok(d >= SPAWN_PLAYER_MIN_SEPARATION - 1e-6, `distance ${d} < min`);
  });

  it('getSpawnPointsAndFaceForPlayer LOBBY alterne CT / T', () => {
    const all = [
      { id: 'm1', team: 'LOBBY' },
      { id: 'm2', team: 'LOBBY' }
    ];
    const a = getSpawnPointsAndFaceForPlayer(all[0], mapData, all);
    const b = getSpawnPointsAndFaceForPlayer(all[1], mapData, all);
    assert.equal(a.faceCT, true);
    assert.equal(b.faceCT, false);
    assert.equal(a.points, mapData.spawnCTPoints);
    assert.equal(b.points, mapData.spawnTPoints);
  });
});
