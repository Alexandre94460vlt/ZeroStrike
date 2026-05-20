/**
 * Utilitaires de physique serveur - Authoritative
 * Collisions AABB et Cercle-Cercle
 */

/** Monde logique des cartes (aligné sur tiledMapParser / Maps). */
const MAP_WORLD_W = 1920;
const MAP_WORLD_H = 1080;

/**
 * Résout une position cible (dash/TP) en testant les murs sur le trajet.
 * Avance par pas de `stepSize` depuis (fromX, fromY) vers (toX, toY)
 * et retourne la dernière position valide (pas dans un mur).
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @param {number} radius - rayon du joueur
 * @param {Array} walls - { x, y, width, height }[]
 * @returns {{ x: number, y: number }}
 */
export function resolveMoveThroughWalls(fromX, fromY, toX, toY, radius, walls) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { x: fromX, y: fromY };

  const stepSize = radius * 0.8;
  const steps = Math.ceil(dist / stepSize);
  let lastGoodX = fromX;
  let lastGoodY = fromY;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx = fromX + dx * t;
    const cy = fromY + dy * t;
    const box = { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 };
    let blocked = false;
    for (const wall of walls) {
      if (aabbCollision(box, wall)) { blocked = true; break; }
    }
    if (blocked) break;
    lastGoodX = cx;
    lastGoodY = cy;
  }

  return { x: lastGoodX, y: lastGoodY };
}

/**
 * Boîte AABB du joueur centrée sur (cx, cy), même convention que PlayerService.updatePosition.
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 */
function playerBoxAt(cx, cy, radius) {
  return { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 };
}

function playerOverlapsAnyWall(cx, cy, radius, walls) {
  const box = playerBoxAt(cx, cy, radius);
  for (const wall of walls) {
    if (aabbCollision(box, wall)) return true;
  }
  return false;
}

/**
 * Décale légèrement le spawn pour que la hitbox ne chevauche aucun mur.
 * (Case 24×24 : si le rayon du joueur > 12, la hitbox déborde sur les cases voisines et un mur adjacent bloque.)
 *
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {Array<{x:number,y:number,width:number,height:number}>} walls
 * @param {{ x: number, y: number }[] | null} [freeCells] — centres de cases libres, le plus proche utilisé en dernier recours
 * @returns {{ x: number, y: number }}
 */
export function nudgeSpawnClearOfWalls(x, y, radius, walls, freeCells = null) {
  if (!walls?.length) return { x, y };
  if (!playerOverlapsAnyWall(x, y, radius, walls)) return { x, y };

  const tryStep = (step) => {
    const offs = [
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step],
      [step, step],
      [step, -step],
      [-step, step],
      [-step, -step]
    ];
    for (const [dx, dy] of offs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < radius || nx > MAP_WORLD_W - radius || ny < radius || ny > MAP_WORLD_H - radius) {
        continue;
      }
      if (!playerOverlapsAnyWall(nx, ny, radius, walls)) return { x: nx, y: ny };
    }
    return null;
  };
  /** Petits décalages d’abord (comportement historique, murs voisins 24×24). */
  for (let s = 4; s <= 24; s += 4) {
    const hit = tryStep(s);
    if (hit) return hit;
  }
  /** Puis pas plus grands : spawns Tiled dont le centre est sous le mur mais le couloir libre reste proche (ex. chadigo). */
  for (let s = 28; s <= 160; s += 4) {
    const hit = tryStep(s);
    if (hit) return hit;
  }

  if (freeCells?.length) {
    let bestX = x;
    let bestY = y;
    let bestD = Infinity;
    for (const c of freeCells) {
      const cx = c.x;
      const cy = c.y;
      if (playerOverlapsAnyWall(cx, cy, radius, walls)) continue;
      const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
      if (d < bestD) {
        bestD = d;
        bestX = cx;
        bestY = cy;
      }
    }
    if (bestD < Infinity) return { x: bestX, y: bestY };
  }

  return { x, y };
}

/**
 * Collision Axis-Aligned Bounding Box (AABB)
 * @param {Object} a - { x, y, width, height }
 * @param {Object} b - { x, y, width, height }
 * @returns {boolean}
 */
export function aabbCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Collision Cercle-Cercle
 * @param {Object} a - { x, y, radius }
 * @param {Object} b - { x, y, radius }
 * @returns {boolean}
 */
export function circleCollision(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distSq = dx * dx + dy * dy;
  const minDist = a.radius + b.radius;
  return distSq <= minDist * minDist;
}

/**
 * Collision Point-Rectangle
 * @param {number} px 
 * @param {number} py 
 * @param {Object} rect - { x, y, width, height }
 * @returns {boolean}
 */
export function pointInRect(px, py, rect) {
  return (
    px >= rect.x &&
    px <= rect.x + rect.width &&
    py >= rect.y &&
    py <= rect.y + rect.height
  );
}

/**
 * Normalise un angle en radians [0, 2π]
 * @param {number} angle 
 * @returns {number}
 */
export function normalizeAngle(angle) {
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

/**
 * Vérifie si un segment (projectile) intersecte un rectangle (mur).
 * Algorithme Liang-Barsky avec traitement explicite des axes dégénérés (dx ou dy = 0)
 * pour éviter toute division 0/0 → NaN.
 * @param {number} x1 - Début segment
 * @param {number} y1
 * @param {number} x2 - Fin segment
 * @param {number} y2
 * @param {Object} rect - { x, y, width, height }
 * @returns {boolean}
 */
export function segmentRectCollision(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  let tIn = 0;
  let tOut = 1;

  if (dx === 0) {
    if (x1 < rect.x || x1 > rect.x + rect.width) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.width - x1) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tIn = Math.max(tIn, t1);
    tOut = Math.min(tOut, t2);
    if (tIn > tOut) return false;
  }

  if (dy === 0) {
    if (y1 < rect.y || y1 > rect.y + rect.height) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.height - y1) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tIn = Math.max(tIn, t1);
    tOut = Math.min(tOut, t2);
    if (tIn > tOut) return false;
  }

  return tOut >= 0 && tIn <= 1;
}
