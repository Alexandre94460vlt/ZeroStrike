/**
 * Mode « réduire les effets » : secousses caméra, particules, flashs.
 */

export function isReduceFx(scene) {
  return !!scene.registry?.get('reduceVisualEffects');
}

const SHAKE_INTENSITY_MUL = 0.22;

/**
 * Secousse caméra atténuée si option accessibilité activée.
 */
export function shake(scene, duration, intensity) {
  const m = isReduceFx(scene) ? SHAKE_INTENSITY_MUL : 1;
  scene.cameras.main.shake(duration, intensity * m);
}

/**
 * Quantité de particules réduite (minimum 0).
 */
export function particleQty(scene, n) {
  const v = Math.floor(Number(n) || 0);
  if (!isReduceFx(scene)) return v;
  if (v <= 0) return 0;
  return Math.max(0, Math.min(v, Math.max(1, Math.floor(v * 0.2))));
}
