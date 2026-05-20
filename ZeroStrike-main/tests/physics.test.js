/**
 * Tests unitaires — server/utils/physics.js
 *
 * Couvre les fonctions pures de physique :
 *   - segmentRectCollision (cas normaux, projectile horizontal/vertical, bord)
 *   - circleCollision
 *   - aabbCollision
 *   - normalizeAngle
 *
 * Exécution :  node --test tests/physics.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  segmentRectCollision,
  circleCollision,
  aabbCollision,
  normalizeAngle,
  resolveMoveThroughWalls,
  nudgeSpawnClearOfWalls
} from '../server/utils/physics.js';

// ─── segmentRectCollision ─────────────────────────────────────────────────────

describe('segmentRectCollision', () => {

  const wall = { x: 100, y: 100, width: 200, height: 50 };

  it('détecte une collision directe (traversée de gauche à droite)', () => {
    assert.ok(segmentRectCollision(50, 125, 350, 125, wall));
  });

  it('ne détecte pas de collision quand le segment passe au-dessus', () => {
    assert.ok(!segmentRectCollision(50, 50, 350, 50, wall));
  });

  it('ne détecte pas de collision quand le segment passe en-dessous', () => {
    assert.ok(!segmentRectCollision(50, 200, 350, 200, wall));
  });

  it('détecte une collision avec un projectile horizontal (dy = 0)', () => {
    // Cas critique : division par zéro avec l'ancienne implémentation
    assert.ok(segmentRectCollision(50, 125, 350, 125, wall));
  });

  it('détecte une collision avec un projectile vertical (dx = 0)', () => {
    // Cas critique : division par zéro avec l'ancienne implémentation
    assert.ok(segmentRectCollision(150, 50, 150, 200, wall));
  });

  it('ne détecte pas de collision pour un segment vertical hors du mur', () => {
    assert.ok(!segmentRectCollision(50, 50, 50, 200, wall)); // x=50 < wall.x=100
  });

  it('détecte une collision pour un segment diagonal', () => {
    assert.ok(segmentRectCollision(50, 50, 250, 150, wall));
  });

  it('ne détecte pas de collision pour un segment diagonal qui rate', () => {
    assert.ok(!segmentRectCollision(50, 50, 90, 90, wall));
  });

  it('retourne true pour un point immobile à l\'intérieur du rectangle', () => {
    assert.ok(segmentRectCollision(150, 125, 150, 125, wall));
  });

  it('segment vertical sur le bord gauche exact du rectangle (0/0)', () => {
    // x1 === rect.x, dx === 0 → anciennement NaN
    assert.ok(segmentRectCollision(100, 50, 100, 200, wall));
  });

  it('segment vertical sur le bord droit exact du rectangle (0/0)', () => {
    assert.ok(segmentRectCollision(300, 50, 300, 200, wall));
  });

  it('segment horizontal sur le bord haut exact du rectangle (0/0)', () => {
    // y1 === rect.y, dy === 0
    assert.ok(segmentRectCollision(50, 100, 350, 100, wall));
  });

  it('segment horizontal sur le bord bas exact du rectangle (0/0)', () => {
    assert.ok(segmentRectCollision(50, 150, 350, 150, wall));
  });

  it('point immobile sur le coin exact du rectangle', () => {
    assert.ok(segmentRectCollision(100, 100, 100, 100, wall));
  });

  it('segment court entièrement à l\'intérieur du rectangle', () => {
    assert.ok(segmentRectCollision(150, 120, 160, 130, wall));
  });
});

// ─── circleCollision ──────────────────────────────────────────────────────────
// Signature : circleCollision({x, y, radius}, {x, y, radius})

describe('circleCollision', () => {

  it('détecte une collision quand les cercles se chevauchent', () => {
    assert.ok(circleCollision({ x: 0, y: 0, radius: 10 }, { x: 5, y: 0, radius: 10 }));
  });

  it('détecte une collision exactement à la limite (r1 + r2 = distance)', () => {
    assert.ok(circleCollision({ x: 0, y: 0, radius: 5 }, { x: 10, y: 0, radius: 5 }));
  });

  it('ne détecte pas de collision quand les cercles sont séparés', () => {
    assert.ok(!circleCollision({ x: 0, y: 0, radius: 5 }, { x: 20, y: 0, radius: 5 }));
  });

  it('détecte une collision entre deux cercles au même point', () => {
    assert.ok(circleCollision({ x: 100, y: 100, radius: 10 }, { x: 100, y: 100, radius: 1 }));
  });
});

// ─── aabbCollision ────────────────────────────────────────────────────────────
// Signature : aabbCollision({x, y, width, height}, {x, y, width, height})

describe('aabbCollision', () => {

  it('détecte une collision entre deux AABB qui se chevauchent', () => {
    assert.ok(aabbCollision(
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 25, y: 25, width: 50, height: 50 }
    ));
  });

  it('ne détecte pas de collision quand les AABB sont séparées', () => {
    assert.ok(!aabbCollision(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 20, width: 10, height: 10 }
    ));
  });

  it('ne détecte pas de collision pour des AABB qui se touchent au bord (strict)', () => {
    // Les AABB se touchent en x=10 mais ne se chevauchent pas (a.x + a.width > b.x → 10 > 10 = false)
    assert.ok(!aabbCollision(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 10 }
    ));
  });
});

// ─── resolveMoveThroughWalls ──────────────────────────────────────────────

describe('resolveMoveThroughWalls', () => {
  const wall = { x: 200, y: 0, width: 24, height: 200 };

  it('arrête le joueur avant un mur sur le trajet (dash)', () => {
    const result = resolveMoveThroughWalls(100, 100, 300, 100, 16, [wall]);
    assert.ok(result.x < 200, `x devrait être < 200, got ${result.x}`);
    assert.equal(result.y, 100);
  });

  it('laisse passer si aucun mur', () => {
    const result = resolveMoveThroughWalls(100, 100, 300, 100, 16, []);
    assert.equal(result.x, 300);
    assert.equal(result.y, 100);
  });

  it('retourne la position d\'origine si le mur est adjacent', () => {
    const tightWall = { x: 117, y: 84, width: 24, height: 32 };
    const result = resolveMoveThroughWalls(100, 100, 200, 100, 16, [tightWall]);
    assert.equal(result.x, 100);
    assert.equal(result.y, 100);
  });

  it('gère distance zéro (pas de déplacement)', () => {
    const result = resolveMoveThroughWalls(100, 100, 100, 100, 16, [wall]);
    assert.equal(result.x, 100);
    assert.equal(result.y, 100);
  });
});

// ─── nudgeSpawnClearOfWalls ────────────────────────────────────────────────

function assertPlayerClearOfWalls(x, y, r, walls) {
  const box = { x: x - r, y: y - r, width: r * 2, height: r * 2 };
  for (const w of walls) assert.ok(!aabbCollision(box, w), `chevauche mur ${JSON.stringify(w)}`);
}

describe('nudgeSpawnClearOfWalls', () => {
  it('laisse la position si aucun chevauchement', () => {
    const p = nudgeSpawnClearOfWalls(100, 100, 16, [{ x: 500, y: 500, width: 24, height: 24 }]);
    assert.equal(p.x, 100);
    assert.equal(p.y, 100);
  });

  it('décale depuis le centre d’une case quand un mur voisin empiète sur la hitbox (24×24, r=16)', () => {
    // Centre loin du bord x=0 : sinon le seul dégagement « court » sort du monde et est rejeté (r=16).
    const wallRight = { x: 96, y: 0, width: 24, height: 24 };
    const p = nudgeSpawnClearOfWalls(84, 12, 16, [wallRight]);
    assertPlayerClearOfWalls(p.x, p.y, 16, [wallRight]);
    assert.ok(Math.abs(p.x - 84) <= 24 && Math.abs(p.y - 12) <= 24, 'décalage raisonnable');
  });

  it('repli freeCells : choisit le centre libre le plus proche du spawn nominal', () => {
    const walls = [{ x: 0, y: 0, width: 400, height: 1080 }];
    const freeCells = [
      { x: 600, y: 400 },
      { x: 500, y: 400 }
    ];
    const p = nudgeSpawnClearOfWalls(12, 12, 16, walls, freeCells);
    assertPlayerClearOfWalls(p.x, p.y, 16, walls);
    assert.equal(p.x, 500);
    assert.equal(p.y, 400);
  });
});

// ─── normalizeAngle ───────────────────────────────────────────────────────────

describe('normalizeAngle', () => {

  it('retourne 0 pour un angle nul', () => {
    assert.equal(normalizeAngle(0), 0);
  });

  it('retourne π pour un angle négatif de -π', () => {
    assert.ok(Math.abs(normalizeAngle(-Math.PI) - Math.PI) < 1e-10);
  });

  it('normalise un angle > 2π', () => {
    const result = normalizeAngle(3 * Math.PI);
    assert.ok(result >= 0 && result < 2 * Math.PI, `got ${result}`);
  });

  it('normalise un angle très négatif', () => {
    const result = normalizeAngle(-10 * Math.PI);
    assert.ok(result >= 0 && result < 2 * Math.PI, `got ${result}`);
  });

  it('est idempotent : normaliser deux fois donne le même résultat', () => {
    const once = normalizeAngle(7.5);
    const twice = normalizeAngle(once);
    assert.ok(Math.abs(once - twice) < 1e-10);
  });

  it('préserve un angle déjà dans [0, 2π[', () => {
    const angle = Math.PI / 4;
    assert.equal(normalizeAngle(angle), angle);
  });
});
