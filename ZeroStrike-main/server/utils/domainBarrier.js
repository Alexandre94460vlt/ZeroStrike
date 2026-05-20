/**
 * Barrière circulaire « domaine » (Gojo / Yuta) : côté joueur in/out figé à l’activation,
 * puis clamp position (option B : pas de sortie pour les dedans, pas d’entrée pour les dehors).
 */

/**
 * @param {number} px
 * @param {number} py
 * @param {number} pr — rayon hitbox joueur
 * @param {number} cx
 * @param {number} cy
 * @param {number} R — rayon du domaine (mur au bord du disque)
 * @returns {'in'|'out'}
 */
export function assignPlayerDomainSide(px, py, pr, cx, cy, R) {
  const d = Math.hypot(px - cx, py - cy);
  return d <= R - pr ? 'in' : 'out';
}

/**
 * @param {number} px
 * @param {number} py
 * @param {number} pr
 * @param {number} cx
 * @param {number} cy
 * @param {number} R
 * @param {'in'|'out'} side
 * @returns {{ x: number, y: number }}
 */
export function clampPlayerAgainstDomainBarrier(px, py, pr, cx, cy, R, side) {
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return { x: px, y: py };
  if (side === 'in') {
    const maxD = Math.max(0, R - pr);
    if (d <= maxD) return { x: px, y: py };
    const k = maxD / d;
    return { x: cx + dx * k, y: cy + dy * k };
  }
  if (side === 'out') {
    const minD = R + pr;
    if (d >= minD) return { x: px, y: py };
    const k = minD / d;
    return { x: cx + dx * k, y: cy + dy * k };
  }
  return { x: px, y: py };
}
