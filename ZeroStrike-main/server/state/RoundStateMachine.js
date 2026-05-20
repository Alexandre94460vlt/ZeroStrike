/**
 * RoundStateMachine — Machine à états finie pour le cycle de vie d'une partie.
 *
 * États :  LOBBY → BUY_PHASE → ACTION_PHASE → ROUND_END → BUY_PHASE (boucle)
 *                                           ↘ MATCH_OVER → LOBBY
 *
 * Avantages vs. chaîne de strings libre :
 *   - Toute transition invalide est détectée immédiatement (dev : exception, prod : log + no-op)
 *   - Les états sont des constantes importables — plus de typos "ACTION_PHASES"
 *   - La table TRANSITIONS documente explicitement le graphe de jeu
 */

/** Enum des états valides (frozen pour prévenir les mutations accidentelles) */
export const RoundState = Object.freeze({
  LOBBY:        'LOBBY',
  BUY_PHASE:    'BUY_PHASE',
  ACTION_PHASE: 'ACTION_PHASE',
  ROUND_END:    'ROUND_END',
  MATCH_OVER:   'MATCH_OVER'
});

/**
 * Table des transitions valides : état courant → liste des états accessibles.
 * Toute transition absente de cette table est considérée invalide.
 *
 * LOBBY est accessible depuis tous les états intermédiaires pour permettre
 * le retour forcé au lobby (bouton hôte, déconnexion, auto-reset).
 */
const TRANSITIONS = {
  [RoundState.LOBBY]:        [RoundState.BUY_PHASE],
  [RoundState.BUY_PHASE]:    [RoundState.ACTION_PHASE, RoundState.LOBBY],
  [RoundState.ACTION_PHASE]: [RoundState.ROUND_END, RoundState.MATCH_OVER, RoundState.LOBBY],
  [RoundState.ROUND_END]:    [RoundState.BUY_PHASE, RoundState.LOBBY],
  [RoundState.MATCH_OVER]:   [RoundState.LOBBY]
};

/**
 * Valide et applique une transition d'état.
 *
 * @param {string} current - État courant (une des valeurs de RoundState)
 * @param {string} next    - État souhaité (une des valeurs de RoundState)
 * @returns {string}       - Le nouvel état si la transition est valide,
 *                           l'état courant inchangé sinon (+ log d'erreur).
 *
 * @example
 *   this.roundState = transitionTo(this.roundState, RoundState.BUY_PHASE);
 */
export function transitionTo(current, next) {
  const allowed = TRANSITIONS[current];
  if (!allowed?.includes(next)) {
    const msg = `[RoundStateMachine] Transition invalide : ${current} → ${next}`;
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(msg);
    }
    console.error(msg);
    return current;
  }
  return next;
}

/**
 * Retourne true si la transition est autorisée sans l'effectuer.
 * Utile pour des gardes conditionnels.
 */
export function canTransitionTo(current, next) {
  return TRANSITIONS[current]?.includes(next) ?? false;
}
