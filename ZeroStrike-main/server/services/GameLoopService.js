/**
 * Service : boucle de jeu 60 TPS, envoi state_update à 30 Hz.
 *
 * Utilise setTimeout récursif plutôt que setInterval pour deux raisons :
 *   1. Compense le temps passé dans le tick lui-même (évite la dérive).
 *   2. Évite l'accumulation de callbacks en file si le serveur est ralenti.
 *
 * lastStateUpdate est dans la closure (pas module-level) pour permettre
 * un redémarrage propre sans état résiduel.
 */
import * as Observability from '../utils/observability.js';

const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;          // ~16.67 ms
const STATE_UPDATE_INTERVAL = 1000 / 30;   // ~33.33 ms
const MAX_DELTA_MS = 100;                  // plafond anti-death-spiral
const STARTUP_GRACE_MS = 5000;             // pas de warning les 5 premières secondes

/**
 * Démarre la boucle 60 TPS (tick + broadcast dirty + state 30 Hz).
 * @param {import('./GameService.js').GameService | import('../app/GameApp.js').GameApp} gameService
 * @returns {() => void} `stopGameLoop` — annule le prochain `setTimeout` (arrêt propre).
 */
export function startGameLoop(gameService) {
  let lastTick = Date.now();
  const startTime = lastTick;
  let accumulator = 0;
  let lastStateUpdate = 0;
  let timeoutId = null;

  const tick = () => {
    const tickStart = Date.now();

    // Cap du delta : si le serveur a été suspendu (débugger, GC long),
    // on limite la rattrapage plutôt que de spiraler.
    const delta = Math.min(tickStart - lastTick, MAX_DELTA_MS);
    lastTick = tickStart;

    accumulator += delta;

    let ticksExecuted = 0;
    while (accumulator >= TICK_MS && ticksExecuted < 3) {
      gameService.tick(TICK_MS / 1000);
      accumulator -= TICK_MS;
      ticksExecuted++;
    }
    if (ticksExecuted >= 3 && accumulator >= TICK_MS) {
      accumulator = 0;
      if (Date.now() - startTime > STARTUP_GRACE_MS) {
        console.warn(`[GameLoop] Surcharge serveur détectée (delta: ${delta}ms) – ticks abandonnés`);
      }
    }

    // Sync 30 Hz et/ou flush dirty — un seul `broadcastState()` par tick pour éviter
    // deux `buildState()` + doubles émissions quand période ET dirty tombent ensemble.
    const periodicDue = tickStart - lastStateUpdate >= STATE_UPDATE_INTERVAL;
    if (periodicDue) {
      lastStateUpdate = tickStart;
    }
    const dirty = typeof gameService.hasDirtyState === 'function' && gameService.hasDirtyState();
    if (periodicDue || dirty) {
      gameService.broadcastState();
    } else if (typeof gameService.hasDirtyState !== 'function') {
      gameService.broadcastIfDirty?.();
    }

    // Planification du prochain tick : on soustrait le temps déjà écoulé
    // pour rester proche de la cible 60 TPS même si le tick a pris du temps.
    const elapsed = Date.now() - tickStart;
    Observability.recordGameLoopTick({ physicsSteps: ticksExecuted, wallMs: elapsed });
    timeoutId = setTimeout(tick, Math.max(0, TICK_MS - elapsed));
  };

  timeoutId = setTimeout(tick, 0);

  return function stopGameLoop() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}
