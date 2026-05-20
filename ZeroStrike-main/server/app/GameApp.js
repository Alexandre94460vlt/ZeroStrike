/**
 * @fileoverview Couche application : `GameEngine` (domaine pur) + ports (`SocketPort`, `LeaderboardPort`, `SchedulerPort`).
 * Les contrôleurs HTTP/socket appellent `dispatch()` / `tick()` ; la boucle 60 TPS déclenche `broadcastIfDirty` / `broadcastState`.
 */

import { GameEngine } from '../domain/GameEngine.js';
import { applyGameTraceEffect } from '../utils/gameTrace.js';
import { buildDisplayStateDeltaPayload } from '../utils/displayStateDelta.js';
 
/**
 * @param {{
 *  socketPort: import('../domain/ports.js').SocketPort,
 *  leaderboardPort: import('../domain/ports.js').LeaderboardPort,
 *  schedulerPort: import('../domain/ports.js').SchedulerPort,
 *  now?: () => number
 * }} deps
 */
export class GameApp {
  constructor({ socketPort, leaderboardPort, schedulerPort, now = () => Date.now() }) {
    this.socketPort = socketPort;
    this.leaderboardPort = leaderboardPort;
    this.schedulerPort = schedulerPort;
    this.now = now;
 
    this.engine = new GameEngine({ now });
    this.engine.emitDisplay = (event, payload) => {
      this.socketPort.emitNamespace('display', event, payload);
    };
    /** Dernier `buildState()` pour deltas display ; null si aucun client display depuis le boot. */
    this._prevDisplayState = null;
    /** Après changement de phase : N envois pleins pour resync clients (join / patch manqué). */
    this._deltaResyncTicks = 3;
    this._lastEmittedRoundState = null;
    /** Throttle optionnel des `context_update` (Render / faible RAM) : voir MOBILE_CONTEXT_MIN_MS. */
    const ctxMs = parseInt(process.env.MOBILE_CONTEXT_MIN_MS, 10);
    this._mobileContextMinMs = Number.isFinite(ctxMs) && ctxMs > 0 ? ctxMs : 0;
    this._lastMobileContextWaveAt = 0;
  }

  /** Exposé à la game loop : évite un double broadcast quand dirty + tick 30 Hz coïncident. */
  hasDirtyState() {
    return !!this.engine._stateDirty;
  }
 
  init() {
    return this._applyEffects(this.engine.init());
  }
 
  /**
   * Dispatch d'une action "domaine" (join, input, tick...).
   * @param {{ type: string, payload?: any }} action
   */
  dispatch(action) {
    return this._applyEffects(this.engine.dispatch(action));
  }
 
  tick(dtSec) {
    return this._applyEffects(this.engine.tick(dtSec));
  }
 
  broadcastIfDirty() {
    if (!this.engine._stateDirty) return;
    this.broadcastState();
  }
 
  broadcastState() {
    this.engine._stateDirty = false;
    const fullState = this.engine.buildState();
    const counts = this.socketPort.getSocketCounts();
    if (counts.display > 0) {
      if (this._lastEmittedRoundState !== fullState.roundState) {
        this._deltaResyncTicks = 3;
        this._lastEmittedRoundState = fullState.roundState;
      }
      // Après une période sans display, _prevDisplayState est nul : forcer N envois pleins pour
      // que le client ne reçoive pas un patch avant d’avoir un état de fusion (mergeDisplayStateDelta).
      if (!this._prevDisplayState) {
        this._deltaResyncTicks = 3;
      }
      let displayPayload = fullState;
      const deltaOn = process.env.DISPLAY_STATE_DELTA !== '0' && process.env.DISPLAY_STATE_DELTA !== 'false';
      if (deltaOn) {
        if (this._deltaResyncTicks > 0) {
          this._deltaResyncTicks--;
        } else if (this._prevDisplayState) {
          displayPayload = buildDisplayStateDeltaPayload(this._prevDisplayState, fullState);
        }
        this._prevDisplayState = fullState;
      } else {
        this._prevDisplayState = null;
      }
      this.socketPort.emitNamespace('display', 'state_update', displayPayload);
    } else {
      this._prevDisplayState = null;
    }
    if (counts.mobile <= 0) {
      return;
    }
    // HUD léger pour mobiles (timer/score/avatars) — utile en partie (hors lobby).
    // On évite d'envoyer le fullState à tous les mobiles (plus lourd).
    this.socketPort.emitNamespace('mobile', 'hud_state', {
      roundState: fullState.roundState,
      phaseTime: fullState.phaseTime,
      roundTime: fullState.roundTime,
      scores: fullState.scores,
      players: Array.isArray(fullState.players)
        ? fullState.players.map((p) => ({
          id: p.id,
          team: p.team,
          isDead: p.isDead,
          name: p.name,
          avatar: p.avatar || null,
        }))
        : [],
    });
    // Contexte mobile (plant/defuse/reload + domaine). Par défaut chaque broadcast (~30 Hz).
    // MOBILE_CONTEXT_MIN_MS (ex. 45–66) limite la cadence des vagues d’émissions (N joueurs × moins souvent).
    if (fullState.roundState === 'ACTION_PHASE') {
      const now = this.now();
      const allowContext =
        this._mobileContextMinMs === 0 || now - this._lastMobileContextWaveAt >= this._mobileContextMinMs;
      if (allowContext) {
        this._lastMobileContextWaveAt = now;
        for (const p of this.engine.playerService.getAll()) {
          if (p.isDead) continue;
          const ctx = this.engine.getPlayerContext(p);
          this.socketPort.emitSocket('mobile', p.id, 'context_update', ctx);
        }
      }
    }
    if (fullState.roundState === 'LOBBY') {
      const lobbyPayload = {
        roundState: fullState.roundState,
        voteCounts: fullState.voteCounts,
        maps: fullState.maps,
        hostId: this.engine.hostId,
        settings: fullState.settings,
        roomCode: this.engine.roomCode,
        lockedHeroes: this.engine.lockedHeroes,
        playerCount: this.engine.playerService.getAll().length
      };
      this.socketPort.emitNamespace('mobile', 'lobby_state', lobbyPayload);
    }
  }
 
  /**
   * Exécute les effets déclaratifs renvoyés par le domaine.
   * @param {import('../domain/effects.js').DomainEffect[]} effects
   */
  _applyEffects(effects) {
    if (!effects || !effects.length) return;
    for (const eff of effects) {
      switch (eff.type) {
        case 'emit_namespace':
          this.socketPort.emitNamespace(eff.ns, eff.event, eff.payload);
          break;
        case 'emit_socket':
          this.socketPort.emitSocket(eff.ns, eff.socketId, eff.event, eff.payload);
          break;
        case 'stats': {
          const lb = this.leaderboardPort;
          const [a0, a1] = eff.args || [];
          if (eff.op === 'recordKill') lb.recordKill(a0, a1);
          else if (eff.op === 'addPlant') lb.addPlant(a0);
          else if (eff.op === 'addDefuse') lb.addDefuse(a0);
          else if (eff.op === 'recordRoundResult') lb.recordRoundResult(eff.args?.[0], eff.args?.[1]);
          break;
        }
        case 'schedule':
          this.schedulerPort.schedule(eff.key, eff.delayMs, () => {
            this.dispatch(eff.action);
          });
          break;
        case 'cancel_schedule':
          this.schedulerPort.cancel(eff.key);
          break;
        case 'log':
          // logs structurés restent côté infra; ici fallback simple
          if (eff.level === 'error') console.error(eff.msg, eff.data || {});
          else if (eff.level === 'warn') console.warn(eff.msg, eff.data || {});
          else console.log(eff.msg, eff.data || {});
          break;
        case 'game_trace':
          applyGameTraceEffect(eff);
          break;
        default:
          break;
      }
    }
  }
}
