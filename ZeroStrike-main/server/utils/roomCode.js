/**
 * Code partie court (affiché sur le projecteur, saisi sur la manette).
 * Alphabet sans I/O/0/1 pour limiter les confusions à la lecture.
 */

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * @param {number} [len=5]
 * @returns {string}
 */
export function generateRoomCode(len = 5) {
  const n = Math.min(Math.max(Number(len) || 5, 4), 8);
  let s = '';
  for (let i = 0; i < n; i++) {
    s += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return s;
}

/**
 * Normalise la saisie joueur (majuscules, alphanumérique seul).
 * @param {unknown} raw
 * @returns {string | null} null si vide après nettoyage
 */
export function normalizeRoomCodeInput(raw) {
  if (raw == null) return null;
  const s = String(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  return s.length ? s : null;
}
