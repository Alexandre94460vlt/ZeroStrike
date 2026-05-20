/**
 * Sanitisation unique des pseudonymes (join mobile/display, stats SQLite).
 * — Retire les caractères typiques XSS / injection d’attribut HTML.
 * — Borne à 24 caractères (affichage HUD / lobby).
 * @param {unknown} raw
 * @returns {string} Jamais vide : défaut « Joueur ».
 */
export function sanitizePlayerDisplayName(raw) {
  return (typeof raw === 'string' ? raw : '')
    .replace(/[<>"'&]/g, '')
    .trim()
    .slice(0, 24) || 'Joueur';
}

/**
 * Clé pour lecture API `/api/leaderboard/player/:name` (param ≤64 côté `parsePlayerNameParam`).
 * Même strip que l’affichage ; conserve jusqu’à 64 caractères pour compatibilité base existante.
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizeLeaderboardKey(raw) {
  const s = (typeof raw === 'string' ? raw : '')
    .replace(/[<>"'&]/g, '')
    .trim()
    .slice(0, 64);
  return s || 'Joueur';
}
