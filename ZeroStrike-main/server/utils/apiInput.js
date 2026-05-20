/**
 * Validation stricte des entrées HTTP pour les routes API (défense en profondeur).
 */

const LEADERBOARD_ORDER = new Set([
  'kills', 'deaths', 'wins', 'losses', 'plants', 'defuses',
  'rounds_played', 'last_played_at', 'kd_ratio', 'win_rate'
]);

/**
 * @param {unknown} raw
 * @returns {number} entre 1 et 100
 */
export function parseLeaderboardLimit(raw) {
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(1, n));
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function parseLeaderboardOrderBy(raw) {
  const s = typeof raw === 'string' ? raw : 'kills';
  return LEADERBOARD_ORDER.has(s) ? s : 'kills';
}

/**
 * Nom joueur pour URL /api/leaderboard/player/:name
 * @param {unknown} raw
 * @returns {string|null} null si invalide
 */
export function parsePlayerNameParam(raw) {
  if (raw == null) return null;
  let s;
  try {
    s = decodeURIComponent(String(raw)).trim();
  } catch {
    return null;
  }
  if (!s || s.length > 64) return null;
  if (/[\u0000-\u001F\u007F]/.test(s)) return null;
  return s;
}

/**
 * Segment URL Giphy — évite chemins / injection
 * @param {unknown} raw
 * @returns {string}
 */
export function parseGiphyQuerySegment(raw) {
  const s = String(raw ?? 'headshot').slice(0, 50);
  return s.replace(/[^\p{L}\p{N}\s._-]/gu, ' ').replace(/\s+/g, ' ').trim() || 'headshot';
}
