/**
 * Tests — server/services/ProjectileService.js
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerService } from '../server/services/PlayerService.js';
import { ProjectileService } from '../server/services/ProjectileService.js';
import { WEAPONS } from '../server/models/Weapon.js';

describe('ProjectileService.create', () => {
  let players;
  let proj;

  beforeEach(() => {
    players = new PlayerService();
    proj = new ProjectileService(players);
  });

  it('crée un projectile pour PISTOL (1 plomb)', () => {
    const list = proj.create(0, 100, 100, 0, 'ATT', WEAPONS.PISTOL, 0);
    assert.equal(list.length, 1);
    assert.equal(proj.getAll().length, 1);
  });

  it('crée plusieurs plombs pour SHOTGUN', () => {
    const list = proj.create(0, 100, 100, 0, 'ATT', WEAPONS.SHOTGUN, 0);
    assert.ok(list.length >= 2);
    assert.equal(proj.getAll().length, list.length);
  });
});

describe('ProjectileService.tick', () => {
  it('supprime le projectile hors carte', () => {
    const players = new PlayerService();
    const proj = new ProjectileService(players);
    proj.create('owner', 100, 100, 0, 'ATT', WEAPONS.PISTOL, 0);
    const p = proj.getAll()[0];
    p.x = 1950;
    p.y = 100;
    p.speed = 8000;
    proj.tick(1, [], null, null);
    assert.equal(proj.getAll().length, 0);
  });
});
