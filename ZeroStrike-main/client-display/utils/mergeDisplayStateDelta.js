/**
 * Reconstitue l’état complet à partir d’un éventuel `state_update` partiel (`_patch`).
 * @param {object|null} prev — dernier état fusionné (même forme que le serveur `buildState`)
 * @param {object} incoming — payload socket `state_update`
 * @returns {object|null} état à passer à `onStateUpdate` ; `null` = ignorer cette frame (en attente d’un full)
 */
export function applyDisplayStateDelta(prev, incoming) {
  if (!incoming || typeof incoming !== 'object') return incoming;
  if (!incoming._patch) return incoming;
  if (!prev || !Array.isArray(prev.players)) return null;

  const out = { ...prev };
  for (const [k, v] of Object.entries(incoming)) {
    if (k === '_patch') continue;
    out[k] = v;
  }
  return out;
}
