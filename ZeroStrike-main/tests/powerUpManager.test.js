/**
 * Tests — server/managers/PowerUpManager.js
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PowerUpManager } from '../server/managers/PowerUpManager.js';

describe('PowerUpManager', () => {
  let emits;

  beforeEach(() => {
    emits = [];
  });

  function ns() {
    return {
      emit(ev, data) {
        emits.push([ev, data]);
      }
    };
  }

  it('tick sans freeCells ne lève pas et n’émet pas', () => {
    const mgr = new PowerUpManager(ns(), { freeCells: [] });
    mgr.tick(10);
    assert.equal(emits.length, 0);
  });

  it('setMap réinitialise la liste et le timer', () => {
    const mgr = new PowerUpManager(ns(), { freeCells: [{ x: 10, y: 20 }] });
    mgr.powerUps.push({ id: 'x', spawnedAt: Date.now() });
    mgr.timerSec = 99;
    mgr.setMap({ freeCells: [{ x: 1, y: 2 }] });
    assert.equal(mgr.powerUps.length, 0);
    assert.equal(mgr.timerSec, 0);
  });

  it('spawnRandomPowerUp émet powerup_spawn quand freeCells non vide', () => {
    const mgr = new PowerUpManager(ns(), { freeCells: [{ x: 50, y: 60 }] });
    mgr.spawnRandomPowerUp();
    assert.ok(emits.some((e) => e[0] === 'powerup_spawn'));
    assert.equal(mgr.powerUps.length, 1);
  });
});
