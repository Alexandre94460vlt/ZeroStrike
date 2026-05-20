/**
 * Payload « patch » pour le display : mêmes clés que `buildState()`, mais seules les sections
 * modifiées (égalité JSON) sont reprises ; le client fusionne avec le dernier état complet.
 */

function jsonEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @param {object|null} prev — dernier état complet émis (référence tick précédent)
 * @param {object} next — `GameEngine.buildState()`
 * @returns {object} soit `next` (plein), soit `{ _patch: true, ... }` si gain net
 */
export function buildDisplayStateDeltaPayload(prev, next) {
  if (!prev || typeof prev !== 'object' || typeof next !== 'object') return next;
  if (prev.roundState !== next.roundState) return next;

  const always = ['scores', 'phaseTime', 'roundTime', 'inOvertime', 'teamLossStreak', 'roundState'];
  /* `players` n’est pas comparé au patch : on l’inclut toujours si présent.
   * Sinon un merge client peut garder un joueur sans `heroId` alors que le serveur
   * a déjà enregistré le héros (symptôme : sprite Kenney + grossissement en marche). */
  const optional = [
    'projectiles',
    'bomb',
    'narutoClones',
    'yutaFamiliars',
    'activeDomains',
    'settings',
    'voteCounts',
    'maps',
    'hostId',
    'roomCode',
    'lockedHeroes',
    'playerCount',
    'voteTimeLeft'
  ];

  const patch = { _patch: true };
  let omitted = 0;
  for (const k of always) {
    patch[k] = next[k];
  }
  for (const k of optional) {
    if (!(k in next)) continue;
    if (jsonEq(prev[k], next[k])) omitted++;
    else patch[k] = next[k];
  }
  if (Array.isArray(next.players)) {
    patch.players = next.players;
  }

  if (omitted === 0) return next;

  const patchBytes = JSON.stringify(patch).length;
  const fullBytes = JSON.stringify(next).length;
  if (patchBytes >= fullBytes * 0.92) return next;

  return patch;
}
