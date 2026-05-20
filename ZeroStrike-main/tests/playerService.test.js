/**
 * Tests — server/services/PlayerService.js
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerService } from '../server/services/PlayerService.js';

describe('PlayerService.updateInputMove', () => {
  let svc;

  beforeEach(() => {
    svc = new PlayerService();
    svc.add('p1', 'Test', 'ATT');
  });

  it('met à jour vx/vy selon angle et force', () => {
    const p = svc.get('p1');
    p.speed = 200;
    svc.updateInputMove('p1', { angle: 0, force: 1 });
    assert.equal(p.vx, 200);
    assert.ok(Math.abs(p.vy) < 0.001);
  });

  it('ignore si joueur mort', () => {
    const p = svc.get('p1');
    p.isDead = true;
    svc.updateInputMove('p1', { angle: 1, force: 1 });
    assert.equal(p.vx, 0);
    assert.equal(p.vy, 0);
  });

  it('ignore socket inconnu', () => {
    svc.updateInputMove('nope', { angle: 0, force: 1 });
    assert.equal(svc.get('p1').vx, 0);
  });
});

function playerOverlapsAnyWall(p, walls) {
  const r = p.radius;
  const box = { x: p.x - r, y: p.y - r, width: r * 2, height: r * 2 };
  for (const w of walls) {
    const hit =
      box.x < w.x + w.width &&
      box.x + box.width > w.x &&
      box.y < w.y + w.height &&
      box.y + box.height > w.y;
    if (hit) return true;
  }
  return false;
}

describe('PlayerService.updatePosition', () => {
  it('ne bouge pas si vx=vy=0', () => {
    const svc = new PlayerService();
    svc.add('p1', 'T', 'DEF');
    const p = svc.get('p1');
    const x0 = p.x;
    svc.updatePosition(p, 0.016, []);
    assert.equal(p.x, x0);
  });

  it('sans murs applique le déplacement complet', () => {
    const svc = new PlayerService();
    svc.add('p1', 'T', 'DEF');
    const p = svc.get('p1');
    p.x = 100;
    p.y = 200;
    p.vx = 300;
    p.vy = -400;
    svc.updatePosition(p, 0.1, []);
    assert.ok(Math.abs(p.x - 130) < 0.01);
    assert.ok(Math.abs(p.y - 160) < 0.01);
  });

  it('ne termine pas à l’intérieur d’un mur sur diagonale (anti-coin)', () => {
    const svc = new PlayerService();
    svc.add('p1', 'T', 'DEF');
    const p = svc.get('p1');
    p.radius = 8;
    p.x = 70;
    p.y = 100;
    p.vx = 600;
    p.vy = 600;
    const walls = [
      { x: 100, y: 72, width: 48, height: 14 },
      { x: 100, y: 86, width: 14, height: 48 }
    ];
    svc.updatePosition(p, 0.05, walls);
    assert.equal(playerOverlapsAnyWall(p, walls), false);
  });
});
