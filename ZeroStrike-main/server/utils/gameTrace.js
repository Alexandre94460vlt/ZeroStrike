/**
 * Traçabilité légère pour déboguer une partie (logs JSON sur stdout).
 * Activé uniquement si GAME_TRACE=1 (ou true / yes) — pas de bruit en prod par défaut.
 * Ne jamais y mettre de secrets (mot de passe display, room code, noms joueurs, tokens).
 */
import { logStructured } from './observability.js';

export function isGameTraceEnabled() {
  const v = process.env.GAME_TRACE;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * @param {{ type: 'game_trace', event: string, data?: Record<string, unknown> }} eff
 */
export function applyGameTraceEffect(eff) {
  if (!isGameTraceEnabled() || !eff?.event) return;
  const data = { trace: 'game', ...(eff.data && typeof eff.data === 'object' ? eff.data : {}) };
  logStructured('info', eff.event, data);
}
