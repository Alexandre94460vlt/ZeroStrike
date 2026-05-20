/**
 * Préférences d'affichage / audio du client Display (localStorage, persistant).
 */

const KEY_REDUCE_FX = 'zs_display_reduce_fx';
const KEY_ROOM_MODE = 'zs_display_room_mode';
const KEY_VOLUME = 'zs_display_master_volume';

function clamp01(v) {
  if (!Number.isFinite(v)) return 1;
  return Math.max(0, Math.min(1, v));
}

/**
 * @returns {{ reduceVisualEffects: boolean, roomMode: boolean, masterVolume: number }}
 */
export function loadDisplayPreferences() {
  return {
    reduceVisualEffects: localStorage.getItem(KEY_REDUCE_FX) === '1',
    roomMode: localStorage.getItem(KEY_ROOM_MODE) === '1',
    masterVolume: clamp01(parseFloat(localStorage.getItem(KEY_VOLUME) ?? '1'))
  };
}

/**
 * @param {{ reduceVisualEffects?: boolean, roomMode?: boolean, masterVolume?: number }} p
 */
export function saveDisplayPreferences(p) {
  if (p.reduceVisualEffects !== undefined) {
    localStorage.setItem(KEY_REDUCE_FX, p.reduceVisualEffects ? '1' : '0');
  }
  if (p.roomMode !== undefined) {
    localStorage.setItem(KEY_ROOM_MODE, p.roomMode ? '1' : '0');
  }
  if (p.masterVolume !== undefined) {
    localStorage.setItem(KEY_VOLUME, String(clamp01(p.masterVolume)));
  }
}
