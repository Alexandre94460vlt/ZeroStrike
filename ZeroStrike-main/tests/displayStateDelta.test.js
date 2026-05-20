/**
 * Tests — delta `state_update` display (serveur + merge client).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDisplayStateDeltaPayload } from '../server/utils/displayStateDelta.js';
import { applyDisplayStateDelta } from '../client-display/utils/mergeDisplayStateDelta.js';

const base = () => ({
  players: [{ id: 'a', x: 1, y: 2, name: 'P' }],
  projectiles: [],
  bomb: null,
  roundState: 'ACTION_PHASE',
  phaseTime: 10,
  roundTime: 60,
  scores: { DEF: 0, ATT: 0 },
  inOvertime: false,
  teamLossStreak: { ATT: 0, DEF: 0 },
  narutoClones: [],
  yutaFamiliars: [],
  activeDomains: [],
  settings: { mode: 'SND' }
});

describe('buildDisplayStateDeltaPayload', () => {
  it('renvoie le plein état si changement de phase', () => {
    const prev = base();
    const next = { ...base(), roundState: 'BUY_PHASE' };
    assert.equal(buildDisplayStateDeltaPayload(prev, next), next);
  });

  it('omits sections inchangées (patch plus léger que full)', () => {
    const prev = base();
    const next = {
      ...base(),
      phaseTime: 9,
      roundTime: 59,
      players: [{ id: 'a', x: 5, y: 2, name: 'P' }]
    };
    const p = buildDisplayStateDeltaPayload(prev, next);
    assert.ok(p._patch);
    assert.equal(p.projectiles, undefined);
    assert.ok(Array.isArray(p.players));
    assert.ok(JSON.stringify(p).length < JSON.stringify(next).length);
  });
});

describe('applyDisplayStateDelta', () => {
  it('fusionne un patch sur l’état précédent', () => {
    const prev = base();
    const patch = {
      _patch: true,
      roundState: 'ACTION_PHASE',
      phaseTime: 8,
      roundTime: 58,
      scores: { DEF: 1, ATT: 0 },
      inOvertime: false,
      teamLossStreak: { ATT: 0, DEF: 0 },
      players: [{ id: 'a', x: 99, y: 2, name: 'P' }]
    };
    const m = applyDisplayStateDelta(prev, patch);
    assert.equal(m.projectiles.length, 0);
    assert.equal(m.players[0].x, 99);
    assert.equal(m.phaseTime, 8);
  });

  it('retourne null si patch sans état précédent', () => {
    assert.equal(applyDisplayStateDelta(null, { _patch: true, scores: {} }), null);
  });
});
