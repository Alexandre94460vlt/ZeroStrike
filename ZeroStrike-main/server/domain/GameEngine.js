/**
 * Domaine (pur): moteur de jeu. Zéro I/O: pas de Socket.io, pas de DB, pas de timers réels.
 *
 * Migration: on va déplacer progressivement la logique de `server/services/GameService.js`
 * vers ce moteur en remplaçant les I/O par des effets déclaratifs.
 */
 
import { PlayerService } from '../services/PlayerService.js';
import { ProjectileService } from '../services/ProjectileService.js';
import { HeroService } from '../services/HeroService.js';
import { getMapData, MAP_LIST, mapDataForSocket } from '../models/maps/Map.js';
import { getWeapon, WEAPONS } from '../models/Weapon.js';
import { getHero } from '../models/Heroes.js';
import {
  ROUND_DURATION, BUY_PHASE_DURATION, ROUND_END_DURATION,
  BOMB_TIMER, DEFUSE_RADIUS, BOMB_PLANT_DURATION_MS, BOMB_DEFUSE_DURATION_MS,
  POWERUP_SPAWN_INTERVAL_SEC, POWERUP_MAX_SIMULTANEOUS, POWERUP_MAP_LIFE_SEC, POWERUP_EFFECT_DURATION_SEC,
  MONEY_WIN, MONEY_LOSS, MONEY_KILL, ROUNDS_TO_WIN,
  PLAYER_MAX_HEALTH, PLAYER_HITBOX_RADIUS, TOJI_SPEED_MULT, TOJI_BURST_SPEED_MULT, ICHIGO_BANKAI_SPEED_MULT,
  DM_KILL_LIMIT_DEFAULT,
  MAP_LOBBY_VOTE_DISPLAY_SEC,
  LOBBY_PRESTART_COUNTDOWN_SEC,
  LOSS_STREAK_BONUS,
  OVERTIME_BONUS_MONEY,
  MOVE_INACCURACY_MAX_RAD,
  MOVE_INACCURACY_SNIPER_MULT,
  SPRAY_PER_SHOT_RAD_BASE,
  SPRAY_MAX_RAD_BASE,
  SPRAY_DECAY_PER_SEC_BASE
} from '../config/constants.js';
import { applyPresetToSettings, GAME_PRESET_IDS, getGunplayTuning } from '../../shared/gamePresets.js';
import { transitionTo, RoundState } from '../state/RoundStateMachine.js';
import { generateRoomCode, normalizeRoomCodeInput } from '../utils/roomCode.js';
import { nudgeSpawnClearOfWalls } from '../utils/physics.js';
import {
  assignSpawnPositionsGreedy,
  getSpawnPointsAndFaceForPlayer,
  pickSpawnPointMaxMinDist
} from '../utils/spawnPlacement.js';
import { randomUUID } from 'crypto';
import { sanitizePlayerDisplayName } from '../utils/sanitizePlayerName.js';
 
/**
 * @param {{ now: () => number }} deps
 */
export class GameEngine {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
 
    // --- état: identique au GameService (migration progressive) ---
    this.playerService = new PlayerService();
    this.projectileService = new ProjectileService(this.playerService);
 
    this.currentMapId = 'dist2';
    this.currentMapData = null;
    this.walls = [];
    // Power-ups (domaine): spawn/expire sans I/O, effets d'affichage via DomainEffect.
    this.powerUps = []; // { id, x, y, type, effectDurationSec, mapLifeSec, spawnedAt }
    this._nextPowerUpId = 0;
    this._powerUpTimerSec = 0;
    this._powerUpSpawnIntervalSec = POWERUP_SPAWN_INTERVAL_SEC;
    this._powerUpMaxSimultaneous = POWERUP_MAX_SIMULTANEOUS;
    this._powerUpMapLifeSec = POWERUP_MAP_LIFE_SEC;
    this._powerUpEffectDurationSec = POWERUP_EFFECT_DURATION_SEC;
    this.roundState = RoundState.LOBBY;
    this.phaseTime = 0;
    this.roundTime = ROUND_DURATION;
    this.bomb = null;
    this.scores = { DEF: 0, ATT: 0 };
    this.killFeed = [];
    this.votes = new Map();
    this.settings = {
      mode: 'SND',
      gamePreset: 'FUN',
      roundsToWin: ROUNDS_TO_WIN,
      roundDuration: ROUND_DURATION,
      buyPhaseDuration: BUY_PHASE_DURATION,
      bombTimer: BOMB_TIMER,
      startingMoney: 2500,
      moneyWin: MONEY_WIN,
      moneyLoss: MONEY_LOSS,
      moneyKill: MONEY_KILL,
      enablePowerUps: true,
      dmKillLimit: DM_KILL_LIMIT_DEFAULT
    };
    applyPresetToSettings(this.settings, 'FUN');
 
    this.roundKills = { ATT: 0, DEF: 0 };
    this.teamLossStreak = { ATT: 0, DEF: 0 };
    this.inOvertime = false;
 
    this.hostId = null;
    this.displayHostId = null;
    this.lockedHeroes = {};
 
    // Sessions + ready
    this._sessions = new Map();
    this.readyPlayers = new Set();
 
    // Domaine: pas de handles setTimeout, on utilisera des effets schedule/cancel.
    // Clés standardisées:
    // - countdown
    // - display_grace
    // - auto_reset
    // - respawn:<playerId>
 
    this._stateDirty = false;
 
    this.roomCode = generateRoomCode(5);

    /** Fin du compte à rebours « vote carte » affiché en lobby (ms, domaine pur : cosmétique côté client) */
    this.mapVoteDeadlineMs = null;

    /** Utilisé par HeroService ; GameApp assigne l’émission vers /display (no-op en tests isolés). */
    this.emitDisplay = () => {};

    this.heroService = new HeroService(this);
  }
 
  /** @returns {import('./effects.js').DomainEffect[]} */
  init() {
    this.currentMapData = getMapData(this.currentMapId);
    this.walls = this.currentMapData.walls;
    this.powerUps = [];
    this._powerUpTimerSec = 0;
    this.roundKills = { ATT: 0, DEF: 0 };
    this._stateDirty = true;
    /* Compte à rebours vote carte : démarre seulement après « Lancer la partie » (start_game). */
    return [];
  }

  /** Démarre / remet le délai d’affichage du vote carte (host a lancé la partie). */
  _resetMapVoteDeadline() {
    this.mapVoteDeadlineMs = this.now() + MAP_LOBBY_VOTE_DISPLAY_SEC * 1000;
  }
 
  /**
   * Dispatch d'actions de haut niveau (migration: remplacer les appels directs `on*`).
   * @param {{ type: string, payload?: any }} action
   * @returns {import('./effects.js').DomainEffect[]}
   */
  dispatch(action) {
    switch (action?.type) {
      case 'display_connect':
        return this.onDisplayConnect(action.payload?.socketId);
      case 'display_disconnect':
        return this.onDisplayDisconnect(action.payload?.socketId);
      case 'player_join':
        return this.onPlayerJoin(action.payload);
      case 'player_disconnect':
        return this.onPlayerDisconnect(action.payload?.socketId);
      case 'vote_map':
        return this.onVoteMap(action.payload?.socketId, action.payload?.mapId);
      case 'update_settings':
        return this.updateSettings(action.payload?.data);
      case 'start_game':
        return this.startGameWithVote();
      case 'kick_player':
        return this.kickPlayer(action.payload?.playerId, action.payload?.by);
      case 'input_move':
        return this.onInputMove(action.payload?.socketId, action.payload?.data);
      case 'input_aim':
        return this.onInputAim(action.payload?.socketId, action.payload?.data);
      case 'input_action':
        return this.onInputAction(action.payload?.socketId, action.payload?.data);
      case 'shop_buy':
        return this.onShopBuy(action.payload?.socketId, action.payload?.data);
      case 'hero_select':
        return this.onHeroSelect(action.payload?.socketId, action.payload?.data);
      case 'player_comment':
        return this.onPlayerComment(action.payload?.socketId, action.payload?.data);
      case 'get_context':
        return this.sendContextToMobile(action.payload?.socketId);
      case 'player_ready':
        return this.onPlayerReady(action.payload?.socketId, action.payload?.ready);
      case 'countdown_tick':
        return this._onCountdownTick(action.payload?.n);
      case 'start_round_after_reveal':
        return [
          ...this._emitNs('display', 'game_starting', undefined),
          ...this.startRound()
        ];
      case 'force_lobby':
        return this.forceBackToLobby(action.payload?.requesterId, action.payload?.reason);
      case 'respawn':
        return this._onRespawn(action.payload?.playerId);
      case 'auto_reset_fire':
        return this._onAutoResetFire();
      case 'display_grace_fire':
        return this._onDisplayGraceFire();
      default:
        return [];
    }
  }

  /**
   * Condition de lancement (choix: tous prêts sauf l'hôte mobile).
   * @returns {{ ok: boolean, ready: number, required: number }}
   */
  canStartGame() {
    if (this.roundState !== 'LOBBY') return { ok: false, ready: 0, required: 0 };
    const players = this.playerService.getAll();
    // Exclure l'hôte mobile de l'obligation de prêt (règle choisie).
    const requiredPlayers = players.filter(p => p.id !== this.hostId);
    const required = requiredPlayers.length;
    const ready = requiredPlayers.filter(p => this.readyPlayers.has(p.id)).length;
    // Min 2 joueurs au total (hôte inclus)
    const minOk = players.length >= 2;
    return { ok: minOk && required > 0 ? ready >= required : minOk && required === 0, ready, required };
  }
 
  /** @returns {import('./effects.js').DomainEffect[]} */
  tick(dt) {
    if (this.roundState === 'LOBBY' || this.roundState === 'MATCH_OVER') return [];
    if (this.roundState === 'BUY_PHASE') return this._tickBuyPhase(dt);
    if (this.roundState === 'ROUND_END') return this._tickRoundEnd(dt);
    if (this.roundState === 'ACTION_PHASE') return this._tickActionPhase(dt);
    return [];
  }
 
  // --- Helpers/IO via effets (stubs init) ---
  /** @returns {import('./effects.js').DomainEffect[]} */
  _emitNs(ns, event, payload) {
    return [{ type: 'emit_namespace', ns, event, payload }];
  }
  /** @returns {import('./effects.js').DomainEffect[]} */
  _emitSock(ns, socketId, event, payload) {
    return [{ type: 'emit_socket', ns, socketId, event, payload }];
  }
  /** @returns {import('./effects.js').DomainEffect[]} */
  _stats(op, ...args) {
    return [{ type: 'stats', op, args }];
  }
  markDirty() { this._stateDirty = true; }

  /**
   * Traçabilité démo / debug : effet `game_trace` (JSON sur stdout si GAME_TRACE=1).
   * Pas de noms, codes partie ni secrets — uniquement ids techniques et état de manche.
   * @param {string} event
   * @param {Record<string, unknown>} [extra]
   * @returns {import('./effects.js').DomainEffect[]}
   */
  _gameTrace(event, extra = {}) {
    const ex = extra && typeof extra === 'object' ? extra : {};
    return [{
      type: 'game_trace',
      event,
      data: {
        round_state: this.roundState,
        player_count: this.playerService.players.size,
        ...ex
      }
    }];
  }
 
  /** @returns {import('./effects.js').DomainEffect[]} */
  _emitPlayerUpdate(player, extra = {}) {
    if (!player?.id) return [];
    return this._emitSock('mobile', player.id, 'ui_update', {
      money: player.money,
      ammo: player.ammo,
      ammoReserve: player.ammoReserve,
      isDead: player.isDead,
      currentWeapon: player.currentWeapon,
      health: player.health,
      maxHealth: player.maxHealth,
      team: player.team,
      ...extra
    });
  }

  /** Mélange Fisher–Yates (en place). */
  _shufflePlayersInPlace(players) {
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
  }

  /** Évite de naître avec la hitbox dans un mur (rayon > demi-case). */
  _snapPlayerSpawnToClearWalls(player) {
    const walls = this.walls;
    if (!walls?.length) return;
    const r = player.radius ?? PLAYER_HITBOX_RADIUS;
    const pos = nudgeSpawnClearOfWalls(
      player.x,
      player.y,
      r,
      walls,
      this.currentMapData?.freeCells ?? null
    );
    player.x = pos.x;
    player.y = pos.y;
  }

  /**
   * Place un joueur sur un spawn de la carte.
   * DEF → spawn CT ; ATT → spawn T ; LOBBY → moitié sur base CT, moitié sur base T (évite tout le monde côté ATT).
   * Indices stables : tri par `player.id` (ne dépend pas de l’ordre de connexion brut).
   * @param {import('../models/Player.js').Player} player
   */
  _repositionPlayerForMap(player, mapData) {
    if (!mapData) return;
    const all = this.playerService.getAll();
    const { points, faceCT } = getSpawnPointsAndFaceForPlayer(player, mapData, all);
    if (!points?.length) {
      throw new Error('[GameEngine] spawnCTPoints / spawnTPoints requis sur mapData.');
    }
    const others = all.filter((p) => p.id !== player.id);
    const pt = pickSpawnPointMaxMinDist(points, others, player.id);
    player.x = pt.x;
    player.y = pt.y;
    this._snapPlayerSpawnToClearWalls(player);
    player.rot = faceCT ? 0 : Math.PI;
  }

  /**
   * Répartition aléatoire équilibrée ATT/DEF (écart max 1 joueur), puis reposition + ui_update.
   * @returns {import('./effects.js').DomainEffect[]}
   */
  _assignBalancedTeamsAndNotify() {
    const effects = [];
    const list = this.playerService.getAll().slice();
    const n = list.length;
    if (n === 0) return effects;
    this._shufflePlayersInPlace(list);
    const nAtt = Math.floor(n / 2);
    for (let i = 0; i < n; i++) {
      list[i].team = i < nAtt ? 'ATT' : 'DEF';
    }
    if (this.currentMapData) {
      const everyone = this.playerService.getAll();
      assignSpawnPositionsGreedy(this.currentMapData, everyone);
      for (const p of everyone) {
        const { faceCT } = getSpawnPointsAndFaceForPlayer(p, this.currentMapData, everyone);
        this._snapPlayerSpawnToClearWalls(p);
        p.rot = faceCT ? 0 : Math.PI;
      }
    }
    for (const p of list) {
      effects.push(...this._emitPlayerUpdate(p));
    }
    return effects;
  }
 
  /** @returns {import('./effects.js').DomainEffect[]} */
  emitSound(type, x, y, extra = {}) {
    return this._emitNs('display', 'sound_event', { type, x, y, ...extra });
  }
 
  // --- Migrations: méthodes clés (version minimaliste au début) ---
  onDisplayConnect(socketId) {
    // Domaine: on ne peut pas socket.emit directement; on demande au controller d'émettre via effet.
    // Pour l’instant, on se contente de marquer dirty; buildState sera émis par l’app layer.
    const effects = [];
    // Annuler le timer de grâce si le display se reconnecte
    effects.push({ type: 'cancel_schedule', key: 'display_grace' });
    if (!this.displayHostId) this.displayHostId = socketId;
    this.markDirty();
    // Snapshot initial display: map_data + state_update
    effects.push(
      ...this._emitSock(
        'display',
        socketId,
        'map_data',
        mapDataForSocket(this.currentMapId, this.currentMapData, this.walls)
      ),
      ...this._emitSock('display', socketId, 'state_update', this.buildState())
    );
    const flat = effects.flat();
    return [...flat, ...this._gameTrace('display_connected', { socket_id: socketId })];
  }
 
  onDisplayDisconnect(socketId) {
    const wasHost = !!(socketId && this.displayHostId === socketId);
    const trace = this._gameTrace('display_disconnected', {
      socket_id: socketId || null,
      was_display_host: wasHost
    });
    if (wasHost) {
      this.displayHostId = null;
      return [
        { type: 'schedule', key: 'display_grace', delayMs: 30_000, action: { type: 'display_grace_fire' } },
        ...trace
      ];
    }
    return trace;
  }
 
  _onDisplayGraceFire() {
    if (this.roundState === 'LOBBY') return [];
    // Dans l'ancien code: vérifier absence display clients.
    // Ici, l'app layer devra annuler ce timer s'il y a un display reconnecté; on le fait en cancel ailleurs.
    return this.forceBackToLobby('auto-reset', 'display_disconnect');
  }
 
  onVoteMap(socketId, mapId) {
    if (this.roundState !== 'LOBBY') return [];
    const valid = MAP_LIST.some(m => m.id === mapId) || mapId === 'random';
    if (valid) {
      this.votes.set(socketId, mapId);
      this.markDirty();
    }
    return [];
  }
 
  startGameWithVote() {
    if (this.roundState !== 'LOBBY') return [];
    const gate = this.canStartGame();
    if (!gate.ok) {
      // Feedback côté display (UI peut afficher ce message)
      return this._emitNs('display', 'start_denied', {
        reason: 'not_all_ready',
        ready: gate.ready,
        required: gate.required
      });
    }
    const teamFx = this._assignBalancedTeamsAndNotify();
    /* À partir d’ici : le timer « TEMPS RESTANT » (vote carte) côté display démarre. */
    this._resetMapVoteDeadline();
    // Démarre un compte à rebours (5..0)
    this.readyPlayers.clear();
    this.markDirty();
    return [
      ...teamFx,
      { type: 'schedule', key: 'countdown', delayMs: 0, action: { type: 'countdown_tick', payload: { n: LOBBY_PRESTART_COUNTDOWN_SEC } } }
    ];
  }
 
  _onCountdownTick(n) {
    const effects = [];
    effects.push(...this._emitNs('display', 'countdown', n));
    effects.push(...this._emitNs('mobile', 'countdown', n));
    if (n > 0) {
      effects.push({ type: 'schedule', key: 'countdown', delayMs: 1000, action: { type: 'countdown_tick', payload: { n: n - 1 } } });
      return effects;
    }
    // À 0: choisir la map et démarrer round après reveal delay
    const counts = this.getVoteCounts();
    const ids = [...MAP_LIST.map(m => m.id), 'random'];
    const maxVotes = Math.max(...ids.map(id => counts[id] || 0));
    const tied = ids.filter(id => (counts[id] || 0) === maxVotes);
    if (!tied.length) {
      throw new Error('[GameEngine] Vote carte : liste des candidats vide (incohérence compteurs).');
    }
    let chosenId = tied[Math.floor(Math.random() * tied.length)];
    if (chosenId === 'random') chosenId = MAP_LIST[Math.floor(Math.random() * MAP_LIST.length)].id;
 
    this.currentMapId = chosenId;
    this.currentMapData = getMapData(chosenId);
    this.walls = this.currentMapData.walls;
    this.votes.clear();
    /* Coordonnées étaient celles de la carte lobby (dist2) : sans ça, le display affiche la nouvelle carte
     * avec des persos « en l’air » jusqu’au startRound (~2,5 s) → effet téléportation. */
    const allAfterMap = this.playerService.getAll();
    assignSpawnPositionsGreedy(this.currentMapData, allAfterMap);
    for (const p of allAfterMap) {
      const { faceCT } = getSpawnPointsAndFaceForPlayer(p, this.currentMapData, allAfterMap);
      this._snapPlayerSpawnToClearWalls(p);
      p.rot = faceCT ? 0 : Math.PI;
    }
    this.markDirty();

    effects.push(...this._emitNs('display', 'map_chosen', { mapId: chosenId, voteCounts: counts }));
    effects.push(
      ...this._emitNs(
        'display',
        'map_data',
        mapDataForSocket(this.currentMapId, this.currentMapData, this.walls)
      )
    );
 
    effects.push({ type: 'schedule', key: 'map_reveal_start_round', delayMs: 2500, action: { type: 'start_round_after_reveal' } });
    return effects;
  }
 
  getVoteCounts() {
    const counts = {};
    for (const m of MAP_LIST) counts[m.id] = 0;
    counts.random = 0;
    for (const mapId of this.votes.values()) {
      if (counts[mapId] !== undefined) counts[mapId]++;
    }
    return counts;
  }
 
  updateSettings(data) {
    if (this.roundState !== 'LOBBY') return [];
    if (!data || typeof data !== 'object') return [];
    const s = this.settings;
    if (typeof data.gamePreset === 'string' && GAME_PRESET_IDS.includes(data.gamePreset)) {
      applyPresetToSettings(s, data.gamePreset);
    }
    if (Number.isFinite(data.roundsToWin) && data.roundsToWin >= 1 && data.roundsToWin <= 15) s.roundsToWin = Math.floor(data.roundsToWin);
    if (Number.isFinite(data.roundDuration) && data.roundDuration >= 30 && data.roundDuration <= 300) s.roundDuration = Math.floor(data.roundDuration);
    if (Number.isFinite(data.buyPhaseDuration) && data.buyPhaseDuration >= 0 && data.buyPhaseDuration <= 60) s.buyPhaseDuration = Math.floor(data.buyPhaseDuration);
    if (Number.isFinite(data.bombTimer) && data.bombTimer >= 10 && data.bombTimer <= 90) s.bombTimer = Math.floor(data.bombTimer);
    if (Number.isFinite(data.startingMoney) && data.startingMoney >= 0 && data.startingMoney <= 16000) s.startingMoney = Math.floor(data.startingMoney);
    if (Number.isFinite(data.moneyWin)  && data.moneyWin  >= 0 && data.moneyWin  <= 10000) s.moneyWin  = Math.floor(data.moneyWin);
    if (Number.isFinite(data.moneyLoss) && data.moneyLoss >= 0 && data.moneyLoss <= 10000) s.moneyLoss = Math.floor(data.moneyLoss);
    if (Number.isFinite(data.moneyKill) && data.moneyKill >= 0 && data.moneyKill <= 1000)  s.moneyKill = Math.floor(data.moneyKill);
    if (typeof data.enablePowerUps === 'boolean') s.enablePowerUps = data.enablePowerUps;
    if (typeof data.mode === 'string' && (data.mode === 'SND' || data.mode === 'DM')) s.mode = data.mode;
    if (Number.isFinite(data.dmKillLimit) && data.dmKillLimit >= 0 && data.dmKillLimit <= 200) s.dmKillLimit = Math.floor(data.dmKillLimit);
    this.markDirty();
    return [];
  }
 
  // --- Join / disconnect (version reprise, sans socket direct) ---
  onPlayerJoin(payload) {
    const socketId = payload?.socketId;
    const socketEmit = [];
    const { name, team, sessionId, roomCode: clientRoomCode, avatarDataUrl } = payload || {};
    const rawSessionId = typeof sessionId === 'string' ? sessionId.slice(0, 64) : null;
    const savedSession = rawSessionId ? this._sessions.get(rawSessionId) : null;
    const isRejoin = !!savedSession && savedSession.expiresAt > this.now();
    if (rawSessionId) this._sessions.delete(rawSessionId);
 
    if (!isRejoin) {
      const entered = normalizeRoomCodeInput(clientRoomCode);
      if (!entered || entered !== this.roomCode) {
        if (socketId) {
          socketEmit.push(...this._emitSock('mobile', socketId, 'ui_update', {
            error: entered ? 'Code partie incorrect.' : 'Indiquez le code affiché sur le grand écran.'
          }));
        }
        return socketEmit;
      }
    }
 
    let validTeam;
    if (isRejoin && this.roundState !== 'LOBBY') {
      const t = savedSession.team;
      validTeam = t === 'ATT' || t === 'DEF' ? t : 'DEF';
    } else {
      validTeam = 'LOBBY';
    }
    const rawName = isRejoin ? savedSession.name : name;
    const safeName = sanitizePlayerDisplayName(rawName);
 
    const player = this.playerService.add(socketId, safeName, validTeam);
    if (!player) {
      if (socketId) socketEmit.push(...this._emitSock('mobile', socketId, 'ui_update', { error: 'Serveur plein' }));
      return socketEmit;
    }
 
    const validateAvatarDataUrl = (raw) => {
      if (raw == null || raw === '') return null;
      if (typeof raw !== 'string') return null;
      // data:image/(png|jpeg|webp);base64,...
      if (!raw.startsWith('data:image/')) return null;
      const m = raw.match(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/);
      if (!m) return null;
      // Limite de taille (approx) : on borne le payload total.
      // 80KB de string => ~60KB binaire. Suffisant pour un 96×96 compressé.
      if (raw.length > 80_000) return null;
      return raw;
    };

    player.sessionId = isRejoin ? savedSession.sessionId : randomUUID();
    if (socketId) socketEmit.push(...this._emitSock('mobile', socketId, 'session_confirmed', { sessionId: player.sessionId }));
 
    if (!this.hostId) this.hostId = socketId;
 
    player.money = this.settings.startingMoney ?? 2500;
    if (isRejoin && this.roundState !== 'LOBBY') {
      player.money = savedSession.money;
      player.currentWeapon = savedSession.currentWeapon;
      const w = getWeapon(player.currentWeapon);
      player.ammo = w.magSize;
      player.ammoReserve = w.reserveMax;
    }

    // Avatar (optionnel): restauré au rejoin, sinon validation du payload client.
    if (isRejoin) {
      player.avatar = savedSession.avatar || null;
    } else {
      player.avatar = validateAvatarDataUrl(avatarDataUrl);
    }
 
    this._repositionPlayerForMap(player, this.currentMapData);

    if (this.roundState !== 'LOBBY') {
      player.isDead = true;
      player.health = 0;
      player.vx = 0;
      player.vy = 0;
      player.lastInputMove = { angle: 0, force: 0 };
    } else {
      player.isDead = false;
      player.health = player.maxHealth;
    }
 
    // IMPORTANT: le client mobile attend un 1er `ui_update` pour valider le join.
    // Sans ça, il déclenche un timeout "serveur injoignable" et ferme la socket.
    socketEmit.push(...this._emitPlayerUpdate(player, { roundState: this.roundState }));
    socketEmit.push(...this.syncHeroRoster());
    // Snapshot minimal à l'arrivée
    if (socketId) socketEmit.push(...this._emitSock('mobile', socketId, 'game_phase', {
      roundState: this.roundState,
      phaseTime: Math.ceil(this.phaseTime),
      roundTime: Math.ceil(this.roundTime)
    }));

    if (this.roundState === 'LOBBY') {
      socketEmit.push(...this._broadcastReadyState());
    }

    this.markDirty();
    socketEmit.push(
      ...this._gameTrace('player_joined', {
        socket_id: socketId || null,
        player_id: player.id,
        rejoin: !!isRejoin
      })
    );
    return socketEmit;
  }
 
  onPlayerDisconnect(socketId) {
    const now = this.now();
    const leavingPlayer = this.playerService.get(socketId);
    if (leavingPlayer?.sessionId) {
      this._sessions.set(leavingPlayer.sessionId, {
        sessionId: leavingPlayer.sessionId,
        name: leavingPlayer.name,
        team: leavingPlayer.team,
        money: leavingPlayer.money,
        currentWeapon: leavingPlayer.currentWeapon,
        avatar: leavingPlayer.avatar || null,
        expiresAt: now + 30 * 60 * 1000
      });
    }
 
    // Libérer le héros verrouillé par ce joueur
    let heroReleased = false;
    for (const heroId of Object.keys(this.lockedHeroes)) {
      if (this.lockedHeroes[heroId] === socketId) {
        delete this.lockedHeroes[heroId];
        heroReleased = true;
      }
    }
 
    this.votes.delete(socketId);
    const wasHost = this.hostId === socketId;
    this.playerService.remove(socketId);
    if (wasHost) {
      const remaining = this.playerService.getAll();
      this.hostId = remaining.length ? remaining[0].id : null;
    }
 
    this.readyPlayers.delete(socketId);
    this.markDirty();
 
    const eff = [];
    eff.push(
      ...this._gameTrace('player_disconnected', {
        socket_id: socketId || null,
        player_id: leavingPlayer?.id ?? null
      })
    );
    if (this.roundState === 'LOBBY') eff.push(...this._broadcastReadyState());
    if (heroReleased) eff.push(...this.syncHeroRoster());
    eff.push(...this._checkAutoReset());
    return eff;
  }
 
  /**
   * Exclut un joueur mobile (host display only côté controller).
   * @param {string} playerId
   * @param {string} [by] - socketId display (audit/debug)
   */
  kickPlayer(playerId, by = null) {
    if (this.roundState !== 'LOBBY') {
      // On peut autoriser hors lobby, mais pour la deadline on limite au lobby (moins risqué).
      return this._emitNs('display', 'kick_denied', { reason: 'not_in_lobby' });
    }
    const player = this.playerService.get(playerId);
    if (!player) return [];
 
    const effects = [];
    // Notifier le mobile pour retour écran join
    effects.push(...this._emitSock('mobile', playerId, 'session_ended', { reason: 'kicked' }));
 
    // Nettoyage état
    this.readyPlayers.delete(playerId);
    this.votes.delete(playerId);
    // Libérer héros verrouillé
    for (const heroId of Object.keys(this.lockedHeroes)) {
      if (this.lockedHeroes[heroId] === playerId) delete this.lockedHeroes[heroId];
    }
 
    this.playerService.remove(playerId);
    if (this.hostId === playerId) {
      const remaining = this.playerService.getAll();
      this.hostId = remaining.length ? remaining[0].id : null;
    }
 
    effects.push(...this._broadcastReadyState());
    effects.push(...this.syncHeroRoster());
    effects.push({ type: 'log', level: 'info', msg: 'player_kicked', data: { playerId, by } });
    this.markDirty();
    return effects;
  }
 
  _checkAutoReset() {
    if (this.roundState === 'LOBBY' || this.roundState === 'MATCH_OVER') return [];
    const players = this.playerService.getAll();
    if (players.length === 0) {
      return [{ type: 'schedule', key: 'auto_reset', delayMs: 5000, action: { type: 'auto_reset_fire' } }];
    }
    return [];
  }
 
  _onAutoResetFire() {
    if (this.playerService.getAll().length === 0 && this.roundState !== 'LOBBY') {
      return this.forceBackToLobby('auto-reset', 'no_players');
    }
    return [];
  }
 
  onPlayerReady(socketId, ready) {
    if (this.roundState !== 'LOBBY') return [];
    const player = this.playerService.get(socketId);
    if (!player) return [];
    const pid = player.id;
    const wantReady = ready !== false;
    const already = this.readyPlayers.has(pid);
    // Idempotence : évite rebroadcast inutile si spam / double événement (même état demandé).
    if (wantReady === already) return [];
    if (wantReady) this.readyPlayers.add(pid);
    else this.readyPlayers.delete(pid);
    this.markDirty();

    const all = this.playerService.getAll();
    const total = all.length;
    const readyCount = all.filter(p => this.readyPlayers.has(p.id)).length;
    const allReady = total >= 2 && readyCount >= total;
 
    return [
      ...this._emitNs('display', 'ready_update', { ready: readyCount, total, allReady }),
      ...this._emitNs('mobile', 'ready_update', { ready: readyCount, total, allReady })
    ];
  }
 
  _broadcastReadyState() {
    const all = this.playerService.getAll();
    const total = all.length;
    const ready = all.filter(p => this.readyPlayers.has(p.id)).length;
    const allReady = total >= 2 && ready >= total;
    const payload = { ready, total, allReady };
    return [
      ...this._emitNs('display', 'ready_update', payload),
      ...this._emitNs('mobile', 'ready_update', payload)
    ];
  }
 
  // --- inputs (stubs: on garde la logique, en retirant les socket accès directs plus tard) ---
  onInputMove(socketId, data) {
    if (this.roundState !== 'ACTION_PHASE') return [];
    const player = this.playerService.get(socketId);
    const now = this.now();
    if (!player) return [];
    if (player.frozenUntil > now) return [];
    if (player.stunUntil > now) {
      this.playerService.updateInputMove(socketId, { angle: 0, force: 0 });
      return [];
    }
    let angle = Number(data?.angle);
    const force = Math.max(0, Math.min(1, Number(data?.force) || 0));
    if (player.reversedUntil > now) angle = angle + Math.PI;
    this.playerService.updateInputMove(socketId, { angle: isNaN(angle) ? 0 : angle, force });
    return [];
  }
 
  onInputAim(socketId, data) {
    const player = this.playerService.get(socketId);
    if (!player || player.isDead) return [];
    const now = this.now();
    if (player.frozenUntil && player.frozenUntil > now) return [];
    const raw = Number(data?.angle);
    player.rot = Number.isFinite(raw) ? raw : player.rot;
    return [];
  }
 
  onInputAction(socketId, data) {
    const type = data?.type;
    const payload = data?.data;
    const player = this.playerService.get(socketId);
    if (!player || player.isDead) return [];
    if (type !== 'RELOAD' && this.roundState !== 'ACTION_PHASE') return [];
    const now = this.now();
    if (player.frozenUntil > now) return [];
 
    const effects = [];
    const weapon = getWeapon(player.currentWeapon);

    const cancelBombInteract = (reason) => {
      if (!player.bombInteract) return;
      player.bombInteract = null;
      player._bombInteractLastEmitAt = 0;
      effects.push(...this._emitSock('mobile', socketId, 'bomb_action', { state: 'cancel', reason }));
    };
 
    switch (type) {
      case 'SHOOT': {
        // Pas de tir pendant une pose/défuse : annuler l'interaction.
        cancelBombInteract('shoot');
        if (player.silencedUntil > now) break;
        if (now - (player.lastShotAt || 0) < weapon.fireCooldownMs) break;
        player.lastShotAt = now;
 
        if (player.ammo > 0) {
          const hasMultishot = player.multishotUntil && player.multishotUntil > now;
          const hasRicochet = player.ricochetUntil && player.ricochetUntil > now;
          const moveSpd = Math.hypot(player.vx || 0, player.vy || 0);
          const maxSpd = Math.max(player.speed || 200, 1);
          const moveFactor = Math.min(1, moveSpd / maxSpd);
          const sniperMult = weapon.id === 'SNIPER' ? MOVE_INACCURACY_SNIPER_MULT : 1;
          const tuning = getGunplayTuning(this.settings.gamePreset || 'FUN');
          const moveSpreadRad = moveFactor * MOVE_INACCURACY_MAX_RAD * sniperMult * tuning.moveMult;
          const sprayMax = SPRAY_MAX_RAD_BASE * tuning.sprayMax;
          const sprayAdd = SPRAY_PER_SHOT_RAD_BASE * tuning.sprayPerShot;
          const sprayBefore = Math.min(sprayMax, player.sprayAccumRad || 0);
          const totalSpreadRad = moveSpreadRad + sprayBefore;
          player.sprayAccumRad = Math.min(sprayMax, sprayBefore + sprayAdd);
 
          if (hasMultishot || hasRicochet) {
            const baseAngle = player.rot;
            const spread = hasRicochet ? 0.5 : 0.18;
            const count = hasRicochet ? 5 : 3;
            for (let i = 0; i < count; i++) {
              const t = count === 1 ? 0 : (i / (count - 1) - 0.5);
              const a = baseAngle + t * spread;
              this.projectileService.create(player.id, player.x, player.y, a, player.team, weapon, totalSpreadRad);
            }
          } else {
            this.projectileService.create(player.id, player.x, player.y, player.rot, player.team, weapon, totalSpreadRad);
          }
 
          player.ammo--;
          effects.push(...this.emitSound('shoot', player.x, player.y, { weaponId: weapon.id, ownerId: player.id }));
          effects.push(...this._emitPlayerUpdate(player));
          effects.push(...this._emitSock('mobile', socketId, 'haptic', { duration: 50 }));
          this.markDirty();
        } else if (player.ammoReserve > 0 && player.ammo < weapon.magSize) {
          const need = weapon.magSize - player.ammo;
          const fill = Math.min(need, player.ammoReserve);
          player.ammo += fill;
          player.ammoReserve -= fill;
          effects.push(...this.emitSound('reload', player.x, player.y, { weaponId: weapon.id }));
          effects.push(...this._emitSock('mobile', socketId, 'haptic', { pattern: [22, 38, 28, 45] }));
          effects.push(...this._emitPlayerUpdate(player));
          this.markDirty();
        }
        break;
      }
      case 'RELOAD': {
        // Reload annule aussi une interaction bombe.
        cancelBombInteract('reload');
        if (player.ammoReserve > 0 && player.ammo < weapon.magSize) {
          const need = weapon.magSize - player.ammo;
          const reload = Math.min(need, player.ammoReserve);
          player.ammo += reload;
          player.ammoReserve -= reload;
          effects.push(...this.emitSound('reload', player.x, player.y, { weaponId: weapon.id }));
          effects.push(...this._emitSock('mobile', socketId, 'haptic', { pattern: [22, 38, 28, 45] }));
          effects.push(...this._emitPlayerUpdate(player));
          this.markDirty();
        }
        break;
      }
      case 'PLANT': {
        // Démarrer une pose temporisée (si dans une zone bombe Tiled)
        if (player.team === 'ATT' && !this.bomb?.planted) {
          for (const site of this.currentMapData.bombSites) {
            const dx = player.x - site.x;
            const dy = player.y - site.y;
            if (Math.sqrt(dx * dx + dy * dy) < site.radius) {
              player.bombInteract = {
                type: 'PLANT',
                siteId: site.id,
                startedAt: now,
                durationMs: BOMB_PLANT_DURATION_MS
              };
              player._bombInteractLastEmitAt = 0;
              effects.push(...this._emitSock('mobile', socketId, 'bomb_action', { state: 'start', type: 'PLANT', durationMs: BOMB_PLANT_DURATION_MS }));
              effects.push(...this._emitSock('mobile', socketId, 'haptic', { duration: 40 }));
              this.markDirty();
              break;
            }
          }
        }
        break;
      }
      case 'DEFUSE': {
        // Démarrer un défuse temporisé (si proche de la bombe posée)
        if (player.team === 'DEF' && this.bomb?.planted) {
          const dx = player.x - this.bomb.x;
          const dy = player.y - this.bomb.y;
          if (Math.sqrt(dx * dx + dy * dy) < DEFUSE_RADIUS) {
            player.bombInteract = {
              type: 'DEFUSE',
              startedAt: now,
              durationMs: BOMB_DEFUSE_DURATION_MS
            };
            player._bombInteractLastEmitAt = 0;
            effects.push(...this._emitSock('mobile', socketId, 'bomb_action', { state: 'start', type: 'DEFUSE', durationMs: BOMB_DEFUSE_DURATION_MS }));
            effects.push(...this._emitSock('mobile', socketId, 'haptic', { duration: 40 }));
            this.markDirty();
          }
        }
        break;
      }
      case 'HERO_POWER':
        effects.push(...this.activateHeroPower(player, 'A'));
        break;
      case 'HERO_POWER_B':
        effects.push(...this.activateHeroPower(player, 'B'));
        break;
      default:
        break;
    }
 
    return effects;
  }
 
  sendContextToMobile(socketId) {
    // Hors partie : pas de plant/defuse/reload contextuel — évite travail et emits inutiles.
    if (this.roundState === 'LOBBY' || this.roundState === 'MATCH_OVER') return [];
    const player = this.playerService.get(socketId);
    if (!player) return [];
    const ctx = this.getPlayerContext(player);
    return this._emitSock('mobile', socketId, 'context_update', ctx);
  }
 
  getPlayerContext(player) {
    const weapon = getWeapon(player.currentWeapon);
    const needReload = player.ammo < weapon.magSize && player.ammoReserve > 0;
    let canPlant = false;
    if (player.team === 'ATT' && !this.bomb?.planted && this.roundState === 'ACTION_PHASE') {
      for (const site of this.currentMapData.bombSites) {
        const dx = player.x - site.x;
        const dy = player.y - site.y;
        if (Math.sqrt(dx * dx + dy * dy) < site.radius) { canPlant = true; break; }
      }
    }
    let canDefuse = false;
    if (player.team === 'DEF' && this.bomb?.planted) {
      const dx = player.x - this.bomb.x;
      const dy = player.y - this.bomb.y;
      canDefuse = Math.sqrt(dx * dx + dy * dy) < DEFUSE_RADIUS;
    }
    const { inDomain, domainInterior } = this._getDomainUiContextForPlayer(player);
    return { canPlant, canDefuse, needReload, inDomain, domainInterior };
  }

  /**
   * Contexte mobile : joueur physiquement dans un domaine barrière (Gojo/Yuta).
   * @param {import('../models/Player.js').Player} player
   * @returns {{ inDomain: boolean, domainInterior: { cx: number, cy: number, r: number } | null }}
   */
  _getDomainUiContextForPlayer(player) {
    const now = this.now();
    const pr = player.radius || PLAYER_HITBOX_RADIUS;
    const list = this.heroService.activeDomains.filter((d) => d.expiresAt > now);
    for (const d of list) {
      const dist = Math.hypot(player.x - d.cx, player.y - d.cy);
      if (dist <= d.r - pr + 1e-6) {
        return { inDomain: true, domainInterior: { cx: d.cx, cy: d.cy, r: d.r } };
      }
    }
    return { inDomain: false, domainInterior: null };
  }
 
  onShopBuy(socketId, data) {
    const weaponId = data?.weaponId;
    if (this.roundState !== 'BUY_PHASE') return [];
    const player = this.playerService.get(socketId);
    if (!player) return [];
    if (!weaponId || !WEAPONS[weaponId]) return [];
    const weapon = WEAPONS[weaponId];
 
    if (player.currentWeapon === weaponId) {
      player.money += weapon.price;
      const pistol = WEAPONS.PISTOL;
      player.currentWeapon = pistol.id;
      player.ammo = pistol.magSize;
      player.ammoReserve = pistol.reserveMax;
      this.markDirty();
      return this._emitPlayerUpdate(player);
    }
 
    if (weapon.price > player.money) return [];
    player.money -= weapon.price;
    player.currentWeapon = weapon.id;
    player.ammo = weapon.magSize;
    player.ammoReserve = Math.min(player.ammoReserve, weapon.reserveMax);
    this.markDirty();
    return this._emitPlayerUpdate(player);
  }
 
  onHeroSelect(socketId, data) {
    const heroId = data?.heroId;
    if (this.roundState !== 'BUY_PHASE') return [];
    if (!heroId) return [];
    const player = this.playerService.get(socketId);
    if (!player || player.isDead) return [];
    const hero = getHero(heroId);
    if (!hero) return [];
    if (this.lockedHeroes[heroId]) return [];
    if (player.money < hero.cost) return [];
 
    player.money -= hero.cost;
    player.heroId = hero.id;
    player.heroPowerUsed = false;
    player.heroPowerBUsed = false;
    this.lockedHeroes[hero.id] = player.id;
 
    if (hero.id === 'toji') {
      player.baseSpeed = 200 * TOJI_SPEED_MULT;
      player.speed = player.baseSpeed;
    }
 
    this.markDirty();
    return [
      ...this._emitPlayerUpdate(player),
      ...this.syncHeroRoster()
    ];
  }
 
  syncHeroRoster() {
    return this._emitNs('mobile', 'sync_roster', { lockedHeroes: this.lockedHeroes });
  }
 
  onPlayerComment(socketId, data) {
    const text = data?.text;
    const player = this.playerService.get(socketId);
    if (!player || !text || typeof text !== 'string') return [];
    const safe = String(text).slice(0, 60).replace(/[<>]/g, '');
    if (!safe.trim()) return [];
    return this._emitNs('display', 'player_comment', { name: player.name, text: safe.trim() });
  }
 
  // --- phases: minimal (transitions) ---
  _tickBuyPhase(dt) {
    this.phaseTime -= dt;
    if (this.phaseTime <= 0) {
      this.roundState = transitionTo(this.roundState, RoundState.ACTION_PHASE);
      this.roundTime = this.settings.roundDuration ?? ROUND_DURATION;
      this.markDirty();
      // Indispensable : sinon les mobiles ne reçoivent jamais game_phase (marché reste affiché).
      return [...this.emitGamePhaseToMobiles(), ...this._gameTrace('round_phase', { phase: this.roundState, map_id: this.currentMapId })];
    }
    return [];
  }
 
  _tickRoundEnd(dt) {
    this.phaseTime -= dt;
    if (this.phaseTime <= 0) {
      const eff = this.startRound();
      this.markDirty();
      return eff;
    }
    return [];
  }
 
  _tickActionPhase(dt) {
    const effects = [];
    this.roundTime -= dt;
    if (this.roundTime <= 0) {
      if (this.settings.mode === 'DM') {
        const attKills = this.roundKills.ATT || 0;
        const defKills = this.roundKills.DEF || 0;
        const winner = attKills >= defKills ? 'ATT' : 'DEF';
        effects.push(...this.endRound(winner));
      } else {
        effects.push(...this.endRound('DEF'));
      }
      return effects;
    }
 
    if (this.bomb?.planted) {
      this.bomb.timer -= dt;
      if (this.bomb.timer <= 0) {
        effects.push(...this.endRound('ATT'));
        return effects;
      }
    }
 
    const allPlayers = this.playerService.getAll();
    const now = this.now();

    // ── Bombe : pose / défuse temporisés ───────────────────────────────────────
    for (const p of allPlayers) {
      if (p.isDead || !p.bombInteract) continue;

      // Annulation si mouvement (joystick) : interaction “hold”.
      const force = Number(p.lastInputMove?.force ?? 0);
      if (Number.isFinite(force) && force > 0.05) {
        p.bombInteract = null;
        p._bombInteractLastEmitAt = 0;
        effects.push(...this._emitSock('mobile', p.id, 'bomb_action', { state: 'cancel', reason: 'move' }));
        continue;
      }

      const it = p.bombInteract;
      const elapsed = now - (it.startedAt || now);
      const progress = Math.max(0, Math.min(1, elapsed / Math.max(1, it.durationMs || 1)));

      // Validité selon type (distance / état de bombe)
      let valid = true;
      if (it.type === 'PLANT') {
        if (p.team !== 'ATT' || this.bomb?.planted) valid = false;
        const site = this.currentMapData?.bombSites?.find((s) => s.id === it.siteId);
        if (!site) valid = false;
        else {
          const dx = p.x - site.x;
          const dy = p.y - site.y;
          if (Math.sqrt(dx * dx + dy * dy) >= site.radius) valid = false;
        }
      } else if (it.type === 'DEFUSE') {
        if (p.team !== 'DEF' || !this.bomb?.planted) valid = false;
        const dx = p.x - (this.bomb?.x ?? 0);
        const dy = p.y - (this.bomb?.y ?? 0);
        if (Math.sqrt(dx * dx + dy * dy) >= DEFUSE_RADIUS) valid = false;
      } else {
        valid = false;
      }

      if (!valid) {
        p.bombInteract = null;
        p._bombInteractLastEmitAt = 0;
        effects.push(...this._emitSock('mobile', p.id, 'bomb_action', { state: 'cancel', reason: 'invalid' }));
        continue;
      }

      // Émettre la progression à ~10 Hz pour l'UI mobile.
      const last = Number(p._bombInteractLastEmitAt || 0);
      if (!last || now - last >= 100) {
        p._bombInteractLastEmitAt = now;
        effects.push(...this._emitSock('mobile', p.id, 'bomb_action', { state: 'progress', type: it.type, progress }));
      }

      if (progress >= 1) {
        p.bombInteract = null;
        p._bombInteractLastEmitAt = 0;
        effects.push(...this._emitSock('mobile', p.id, 'bomb_action', { state: 'complete', type: it.type }));
        effects.push(...this._emitSock('mobile', p.id, 'haptic', { pattern: [30, 40, 30] }));

        if (it.type === 'PLANT') {
          const site = this.currentMapData.bombSites.find((s) => s.id === it.siteId);
          this.bomb = {
            planted: true,
            siteId: site?.id || 'A',
            x: p.x,
            y: p.y,
            timer: this.settings.bombTimer ?? BOMB_TIMER,
            planterName: p.name
          };
          effects.push(...this._stats('addPlant', p.name));
          this.markDirty();
        } else if (it.type === 'DEFUSE') {
          effects.push(...this.defuseBomb(p));
          this.markDirty();
        }
      }
    }

    const sprayDecay = SPRAY_DECAY_PER_SEC_BASE * getGunplayTuning(this.settings.gamePreset || 'FUN').sprayDecay;
    for (const player of allPlayers) {
      if (!player.isDead && (player.sprayAccumRad || 0) > 0) {
        player.sprayAccumRad = Math.max(0, player.sprayAccumRad - sprayDecay * dt);
      }
      let speedMult = 1;
      if (player.speedBoostUntil && player.speedBoostUntil > now) speedMult = 1.5;
      if (player.tojiBurstUntil && player.tojiBurstUntil > now) speedMult = TOJI_BURST_SPEED_MULT;
      if (player.ichigoBankaiUntil && player.ichigoBankaiUntil > now) speedMult = ICHIGO_BANKAI_SPEED_MULT;
      player.speed = player.baseSpeed * speedMult;
      if (player.shieldUntil && player.shieldUntil <= now) {
        player.shieldHealth = 0;
      }
      this.playerService.updatePosition(player, dt, this.walls);
      this.heroService.clampPlayerDomainBarriers(player);
    }
 
    this.projectileService.tick(
      dt,
      this.walls,
      (target, damage, killerId, weapon) => {
        effects.push(...this.onProjectileHit(target, damage, killerId, weapon));
      },
      (type, x, y) => {
        effects.push(...this.emitSound(type, x, y));
      }
    );
 
    if (this.settings.enablePowerUps) {
      effects.push(...this._tickPowerUps(dt));
      effects.push(...this.handlePowerUpPickups());
    }
    this.heroService.tick(dt);
 
    if (this.settings.mode !== 'DM' && allPlayers.length > 0) {
      const defAlive = this.playerService.getAliveByTeam('DEF').length;
      const attAlive = this.playerService.getAliveByTeam('ATT').length;
      if (defAlive === 0) { effects.push(...this.endRound('ATT')); return effects; }
      if (attAlive === 0 && !this.bomb?.planted) { effects.push(...this.endRound('DEF')); return effects; }
    }
 
    this.markDirty();
    return effects;
  }
 
  onProjectileHit(target, damage, killerId, weaponName = 'Rifle') {
    const effects = [];
    const now = this.now();
    if (target.invincibleUntil > now) return effects;
    const killer = this.playerService.get(killerId);
    let finalDamage = damage;
    if (killer && killer.damageBoostUntil && killer.damageBoostUntil > now) {
      finalDamage = Math.floor(damage * 1.5);
    }
 
    const healthBefore = target.health ?? PLAYER_MAX_HEALTH;
    let remaining = finalDamage;
    let shieldDamage = 0;
    if (target.shieldHealth && target.shieldUntil && target.shieldUntil > now) {
      const absorbed = Math.min(remaining, target.shieldHealth);
      shieldDamage = absorbed;
      target.shieldHealth -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) {
      target.health = Math.max(0, healthBefore - remaining);
      effects.push(...this._emitSock('mobile', target.id, 'damage_received', {
        damage: remaining,
        angle: killer ? Math.atan2(killer.y - target.y, killer.x - target.x) : null,
        isDead: target.health <= 0
      }));
      effects.push(...this._emitSock('mobile', target.id, 'haptic',
        target.health <= 0 ? { pattern: [30, 40, 50, 70] } : { pattern: [18, 12, 42] }
      ));
    }
 
    const hpLost = Math.max(0, healthBefore - Math.max(0, target.health ?? 0));
    if (hpLost > 0 || shieldDamage > 0) {
      effects.push(...this._emitNs('display', 'damage_indicator', {
        x: target.x,
        y: target.y,
        hp: hpLost,
        shield: shieldDamage,
        isKill: target.health <= 0
      }));
    }
 
    if (target.health <= 0) {
      target.isDead = true;
      target.sprayAccumRad = 0;
      if (this.settings.mode === 'DM' && killer && killer.team) {
        this.roundKills[killer.team] = (this.roundKills[killer.team] || 0) + 1;
      }
    }
 
    const killerName = killer?.name || 'Player';
    const victimName = target.name || 'Player';
    if (target.health <= 0) {
      target.roundDeaths = (target.roundDeaths || 0) + 1;
      effects.push(...this._stats('recordKill', killerName, victimName));
      if (killer) {
        killer.roundKills = (killer.roundKills || 0) + 1;
        killer.money += this.settings.moneyKill ?? MONEY_KILL;
        effects.push(...this._emitPlayerUpdate(killer));
        effects.push(...this._emitSock('mobile', killer.id, 'kill_confirmed', {
          victimName,
          weaponName
        }));
      }
      this.killFeed.unshift({ killer: killerName, victim: victimName, weapon: weaponName });
      if (this.killFeed.length > 5) this.killFeed.pop();
      effects.push(...this._emitNs('display', 'kill_feed', { killer: killerName, victim: victimName, weapon: weaponName }));
      effects.push(...this._emitNs('display', 'sound_event', { type: 'explosion', x: target.x, y: target.y }));
 
      const dmLimit = this.settings.dmKillLimit ?? DM_KILL_LIMIT_DEFAULT;
      if (
        this.settings.mode === 'DM' &&
        dmLimit > 0 &&
        killer &&
        killer.team &&
        (this.roundKills[killer.team] || 0) >= dmLimit
      ) {
        effects.push(...this._emitPlayerUpdate(target));
        effects.push(...this._emitSock('mobile', target.id, 'you_died', { killerName, weaponName, respawnMs: null }));
        effects.push(...this.endRound(killer.team));
        return effects;
      }
 
      effects.push(...this._emitSock('mobile', target.id, 'you_died', {
        killerName,
        weaponName,
        respawnMs: this.settings.mode === 'DM' ? 2000 : null
      }));
 
      if (this.settings.mode === 'DM') {
        effects.push(...this.scheduleRespawn(target.id));
      }
    }
    effects.push(...this._emitPlayerUpdate(target));
    this.markDirty();
    return effects;
  }
 
  startRound() {
    const effects = [];
    this.roundState = transitionTo(this.roundState, RoundState.BUY_PHASE);
    this.phaseTime = this.settings.buyPhaseDuration ?? BUY_PHASE_DURATION;
    this.bomb = null;
    this.lockedHeroes = {};
    this.heroService.reset();
    this.markDirty();
    effects.push(...this._gameTrace('round_phase', { phase: this.roundState, map_id: this.currentMapId }));
    effects.push(...this.respawnAllPlayers());
    effects.push(...this.emitGamePhaseToMobiles());
    effects.push(...this.syncHeroRoster());
    return effects;
  }
 
  buildState() {
    const hs = this.heroService;
    const projectiles = this.projectileService.getAll().map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      angle: p.angle,
      weaponId: p.weaponId || 'RIFLE',
      team: p.team
    }));
    const players = this.playerService.getAll().map(p => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      rot: p.rot,
      team: p.team,
      isDead: p.isDead,
      weapon: p.currentWeapon,
      health: p.health ?? p.maxHealth,
      maxHealth: p.maxHealth,
      heroId: p.heroId || null,
      avatar: p.avatar || null,
      // Lobby: indicateur prêt (pour le display)
      isReady: this.roundState === 'LOBBY' ? this.readyPlayers.has(p.id) : undefined
    }));
    const state = {
      players,
      projectiles,
      bomb: this.bomb,
      roundState: this.roundState,
      phaseTime: Math.ceil(this.phaseTime),
      roundTime: Math.ceil(this.roundTime),
      scores: this.scores,
      inOvertime: this.settings.mode === 'SND' ? !!this.inOvertime : false,
      teamLossStreak: this.settings.mode === 'SND' ? { ...this.teamLossStreak } : { ATT: 0, DEF: 0 },
      narutoClones: hs.narutoClones.map(c => ({ id: c.id, x: c.x, y: c.y, ownerTeam: c.ownerTeam, health: c.health })),
      yutaFamiliars: hs.yutaFamiliars.map((b) => ({ id: b.id, x: b.x, y: b.y, ownerTeam: b.ownerTeam, health: b.health })),
      activeDomains: hs.activeDomains
        .filter((d) => d.expiresAt > this.now())
        .map((d) => ({
          id: d.id,
          ownerId: d.ownerId,
          heroId: d.heroId,
          cx: d.cx,
          cy: d.cy,
          r: d.r,
          expiresAt: d.expiresAt
        })),
      settings: {
        mode: this.settings.mode,
        gamePreset: this.settings.gamePreset ?? 'FUN',
        roundsToWin: this.settings.roundsToWin,
        roundDuration: this.settings.roundDuration,
        buyPhaseDuration: this.settings.buyPhaseDuration,
        bombTimer: this.settings.bombTimer,
        startingMoney: this.settings.startingMoney,
        enablePowerUps: this.settings.enablePowerUps,
        dmKillLimit: this.settings.dmKillLimit ?? DM_KILL_LIMIT_DEFAULT
      }
    };
    if (this.roundState === 'LOBBY') {
      state.voteCounts = this.getVoteCounts();
      state.maps = MAP_LIST.map(m => ({ id: m.id, name: m.name }));
      state.hostId = this.hostId;
      state.roomCode = this.roomCode;
      state.lockedHeroes = this.lockedHeroes;
      state.playerCount = this.playerService.getAll().length;
      state.voteTimeLeft =
        this.mapVoteDeadlineMs != null
          ? Math.max(0, (this.mapVoteDeadlineMs - this.now()) / 1000)
          : null;
    }
    return state;
  }
 
  emitGamePhaseToMobiles() {
    const payload = {
      roundState: this.roundState,
      phaseTime: Math.ceil(this.phaseTime),
      roundTime: Math.ceil(this.roundTime),
      inOvertime: !!this.inOvertime
    };
    return this._emitNs('mobile', 'game_phase', payload);
  }
 
  _resetPlayerCombatState(player) {
    player.isDead = false;
    player.health = player.maxHealth;
    player.speedBoostUntil = 0;
    player.tojiBurstUntil = 0;
    player.ichigoBankaiUntil = 0;
    player.damageBoostUntil = 0;
    player.shieldUntil = 0;
    player.shieldHealth = 0;
    player.multishotUntil = 0;
    player.ricochetUntil = 0;
    player.ghostUntil = 0;
    player.magnetUntil = 0;
    player.heroId = null;
    player.heroPowerUsed = false;
    player.heroPowerBUsed = false;
    player.frozenUntil = 0;
    player.stunUntil = 0;
    player.silencedUntil = 0;
    player.reversedUntil = 0;
    player.invincibleUntil = 0;
    player.giantUntil = 0;
    player.baseSpeed = 200;
    player.speed = 200;
    player.radius = PLAYER_HITBOX_RADIUS;
    player.baseRadius = PLAYER_HITBOX_RADIUS;
    player.domainSides = {};
    player.sprayAccumRad = 0;
    player.roundKills = 0;
    player.roundDeaths = 0;
  }
 
  respawnAllPlayers() {
    const effects = [];
    const all = this.playerService.getAll();
    const md = this.currentMapData;
    if (!md?.spawnCTPoints?.length || !md?.spawnTPoints?.length) {
      throw new Error('[GameEngine] respawnAllPlayers : spawns carte invalides.');
    }
    for (const player of all) {
      this._resetPlayerCombatState(player);
    }
    assignSpawnPositionsGreedy(md, all);
    for (const player of all) {
      const { faceCT } = getSpawnPointsAndFaceForPlayer(player, md, all);
      this._snapPlayerSpawnToClearWalls(player);
      player.rot = faceCT ? 0 : Math.PI;
      player.invincibleUntil = this.now() + 1500;
      effects.push(...this._emitPlayerUpdate(player));
    }
    return effects;
  }
 
  forceBackToLobby(requesterId = null, lobbyReason = 'host') {
    if (this.roundState === 'LOBBY') return [];
    // Domaine: règle d'autorisation conservée
    if (requesterId && requesterId !== 'auto-reset') {
      const ok = requesterId === this.displayHostId || requesterId === this.hostId;
      if (!ok) return [{ type: 'log', level: 'warn', msg: 'forceBackToLobby ignored: requester not host', data: { requesterId } }];
    }
    // Annuler timers
    return [
      { type: 'cancel_schedule', key: 'countdown' },
      { type: 'cancel_schedule', key: 'display_grace' },
      { type: 'cancel_schedule', key: 'auto_reset' },
      { type: 'cancel_schedule', key: 'match_over_back_to_lobby' },
      ...this._forceBackToLobbyInternal(lobbyReason)
    ];
  }
 
  _forceBackToLobbyInternal(lobbyReason = 'unknown') {
    const effects = [];
    this.heroService.reset();
    this.projectileService.clear();
    effects.push(...this.backToLobby(lobbyReason));
    this.markDirty();
    return effects;
  }
 
  backToLobby(lobbyReason = 'unknown') {
    const effects = [];
    this.roundState = transitionTo(this.roundState, RoundState.LOBBY);
    effects.push(...this._gameTrace('round_phase', { phase: this.roundState, lobby_reason: String(lobbyReason || 'unknown').slice(0, 48) }));
    this.scores = { DEF: 0, ATT: 0 };
    this.teamLossStreak = { ATT: 0, DEF: 0 };
    for (const [sid, s] of this._sessions) {
      if (s.expiresAt <= this.now()) this._sessions.delete(sid);
    }
    this.inOvertime = false;
    this.readyPlayers.clear();
    this.lockedHeroes = {};
    /* Nouveau lobby : pas de timer vote tant que l’hôte n’a pas recliqué « Lancer la partie ». */
    this.mapVoteDeadlineMs = null;
    const all = this.playerService.getAll();
    for (const p of all) {
      this._resetPlayerCombatState(p);
      p.team = 'LOBBY';
      p.money = this.settings.startingMoney ?? 2500;
      p.currentWeapon = 'PISTOL';
      const w = getWeapon(p.currentWeapon);
      p.ammo = w.magSize;
      p.ammoReserve = w.reserveMax;
    }
    if (this.currentMapData) {
      assignSpawnPositionsGreedy(this.currentMapData, all);
      for (const p of all) {
        const { faceCT } = getSpawnPointsAndFaceForPlayer(p, this.currentMapData, all);
        this._snapPlayerSpawnToClearWalls(p);
        p.rot = faceCT ? 0 : Math.PI;
      }
    }
    for (const p of all) {
      effects.push(...this._emitPlayerUpdate(p, { roundState: 'LOBBY' }));
    }
    effects.push(...this.emitGamePhaseToMobiles());
    effects.push(...this._emitNs('display', 'back_to_lobby', { reason: lobbyReason }));
    return effects;
  }
 
  endRound(winner) {
    const effects = [];
    this.scores[winner] = (this.scores[winner] || 0) + 1;
    const all = this.playerService.getAll();
 
    // stats: résultat de manche
    const byTeam = { ATT: [], DEF: [] };
    for (const p of all) {
      if (p.team === 'ATT') byTeam.ATT.push(p.name);
      else if (p.team === 'DEF') byTeam.DEF.push(p.name);
    }
    effects.push(...this._stats('recordRoundResult', winner, byTeam));
 
    this.bomb = null;
    this.projectileService.clear();
 
    const snd = this.settings.mode === 'SND';
    if (snd) {
      const loser = winner === 'ATT' ? 'DEF' : 'ATT';
      this.teamLossStreak[loser] = Math.min(5, (this.teamLossStreak[loser] || 0) + 1);
      this.teamLossStreak[winner] = 0;
    }
 
    // Argent
    const lossBase = this.settings.moneyLoss ?? MONEY_LOSS;
    const winBase = this.settings.moneyWin ?? MONEY_WIN;
    for (const player of all) {
      const won = player.team === winner;
      if (won) {
        player.money += winBase;
      } else if (snd) {
        const st = Math.min(5, this.teamLossStreak[player.team] || 0);
        const bonus = LOSS_STREAK_BONUS[st] ?? 0;
        player.money += lossBase + bonus;
      } else {
        player.money += lossBase;
      }
    }
 
    // Overtime
    const roundsToWin = this.settings.roundsToWin ?? ROUNDS_TO_WIN;
    if (
      snd &&
      !this.inOvertime &&
      this.scores.ATT === roundsToWin - 1 &&
      this.scores.DEF === roundsToWin - 1 &&
      this.scores.ATT === this.scores.DEF
    ) {
      this.inOvertime = true;
      effects.push(...this._emitNs('display', 'overtime_start', { scores: { ...this.scores } }));
      for (const p of all) p.money += OVERTIME_BONUS_MONEY;
    }
 
    // Victoire match
    if (this.scores.ATT === roundsToWin || this.scores.DEF === roundsToWin) {
      this.roundState = transitionTo(this.roundState, RoundState.MATCH_OVER);
      const matchWinner = this.scores.ATT === roundsToWin ? 'ATT' : 'DEF';
      effects.push(...this._gameTrace('round_phase', {
        phase: this.roundState,
        map_id: this.currentMapId,
        match_winner: matchWinner,
        scores_att: this.scores.ATT,
        scores_def: this.scores.DEF
      }));
      effects.push(...this._emitNs('display', 'match_end', { winner: matchWinner, scores: this.scores }));
      const finalBoard = all.map(p => ({
        name: p.name, team: p.team, kills: p.roundKills || 0, deaths: p.roundDeaths || 0
      })).sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths));
      effects.push(...this._emitNs('mobile', 'match_end', {
        winner: matchWinner,
        scores: { ...this.scores },
        scoreboard: finalBoard
      }));
 
      // Retour lobby après délai
      effects.push({
        type: 'schedule',
        key: 'match_over_back_to_lobby',
        delayMs: 10_000,
        action: { type: 'force_lobby', payload: { requesterId: 'auto-reset', reason: 'match_over' } }
      });
      this.markDirty();
      return effects;
    }
 
    this.roundState = transitionTo(this.roundState, RoundState.ROUND_END);
    this.roundKills = { ATT: 0, DEF: 0 };
    effects.push(...this._gameTrace('round_phase', {
      phase: this.roundState,
      map_id: this.currentMapId,
      round_winner: winner
    }));
 
    const scoreboard = all.map(p => ({
      name: p.name,
      team: p.team,
      kills: p.roundKills || 0,
      deaths: p.roundDeaths || 0
    })).sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths));
    effects.push(...this._emitNs('mobile', 'round_summary', {
      winner,
      scores: { ...this.scores },
      scoreboard
    }));
 
    this.phaseTime = ROUND_END_DURATION;
    this.lockedHeroes = {};
    this.heroService.reset();
    effects.push(...this.respawnAllPlayers());
    effects.push(...this.syncHeroRoster());
    effects.push(...this.emitGamePhaseToMobiles());
    this.markDirty();
    return effects;
  }
 
  defuseBomb(player) {
    if (!this.bomb?.planted) return [];
    const effects = [];
    effects.push(...this.emitSound('defuse', this.bomb.x, this.bomb.y));
    effects.push(...this._stats('addDefuse', player.name));
    effects.push(...this.endRound('DEF'));
    return effects;
  }
 
  activateHeroPower(player, variant = 'A') {
    this.heroService.activateHeroPower(player, variant);
    this.markDirty();
    return this._emitPlayerUpdate(player);
  }
 
  _onRespawn(playerId) {
    const effects = [];
    if (this.roundState !== 'ACTION_PHASE' || !this.currentMapData) return effects;
    const player = this.playerService.get(playerId);
    if (!player || !player.isDead) return effects;
    const spawnPoints =
      player.team === 'DEF' ? this.currentMapData.spawnCTPoints : this.currentMapData.spawnTPoints;
    if (!spawnPoints?.length) {
      throw new Error('[GameEngine] _onRespawn : points de spawn absents.');
    }
    const alive = this.playerService.getAll().filter((p) => !p.isDead && p.id !== playerId);
    const pt = pickSpawnPointMaxMinDist(spawnPoints, alive, player.id);
    player.x = pt.x;
    player.y = pt.y;
    this._snapPlayerSpawnToClearWalls(player);
    player.isDead = false;
    player.health = player.maxHealth;
    player.invincibleUntil = this.now() + 1500;
    effects.push(...this._emitPlayerUpdate(player));
    this.markDirty();
    return effects;
  }
 
  scheduleRespawn(playerId, delayMs = 2000) {
    return [{ type: 'schedule', key: `respawn:${playerId}`, delayMs, action: { type: 'respawn', payload: { playerId } } }];
  }
 
  _tickPowerUps(dt) {
    const effects = [];
    const freeCells = Array.isArray(this.currentMapData?.freeCells) ? this.currentMapData.freeCells : [];
    if (!freeCells.length) return effects;
 
    this._powerUpTimerSec += dt;
 
    // Expiration côté carte
    const now = this.now();
    const stillAlive = [];
    for (const pu of this.powerUps) {
      if (now - pu.spawnedAt > pu.mapLifeSec * 1000) {
        effects.push(...this._emitNs('display', 'powerup_despawn', { id: pu.id }));
      } else {
        stillAlive.push(pu);
      }
    }
    this.powerUps = stillAlive;
 
    if (this.powerUps.length >= this._powerUpMaxSimultaneous) return effects;
    if (this._powerUpTimerSec < this._powerUpSpawnIntervalSec) return effects;
 
    this._powerUpTimerSec = 0;
    const cell = freeCells[Math.floor(Math.random() * freeCells.length)];
    const types = [
      'heal', 'heal',
      'speed', 'speed',
      'damage',
      'shield',
      'multishot',
      'ricochet',
      'ghost',
      'magnet'
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    const id = `pu_${this._nextPowerUpId++}`;
    const pu = {
      id,
      x: cell.x,
      y: cell.y,
      type,
      effectDurationSec: this._powerUpEffectDurationSec,
      mapLifeSec: this._powerUpMapLifeSec,
      spawnedAt: now
    };
    this.powerUps.push(pu);
    effects.push(...this._emitNs('display', 'powerup_spawn', {
      id: pu.id,
      x: pu.x,
      y: pu.y,
      type: pu.type,
      effectDurationSec: pu.effectDurationSec,
      mapLifeSec: pu.mapLifeSec
    }));
    return effects;
  }
 
  removePowerUpById(id) {
    const idx = this.powerUps.findIndex((p) => p.id === id);
    if (idx === -1) return [];
    const [pu] = this.powerUps.splice(idx, 1);
    if (!pu) return [];
    return this._emitNs('display', 'powerup_despawn', { id: pu.id });
  }
 
  handlePowerUpPickups() {
    const effects = [];
    if (!this.powerUps.length) return effects;
    const players = this.playerService.getAll().filter((p) => !p.isDead);
    if (!players.length) return effects;
    const now = this.now();
    const powerUps = this.powerUps.slice();
    const removedIds = new Set();
    for (const player of players) {
      const hasMagnet = player.magnetUntil && player.magnetUntil > now;
      const radiusSq = hasMagnet ? 90 * 90 : 50 * 50;
      for (const pu of powerUps) {
        if (removedIds.has(pu.id)) continue;
        const dx = pu.x - player.x;
        const dy = pu.y - player.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= radiusSq) {
          effects.push(...this.applyPowerUpEffect(player, pu, now));
          effects.push(...this.removePowerUpById(pu.id));
          removedIds.add(pu.id);
          break;
        }
      }
    }
    if (effects.length) this.markDirty();
    return effects;
  }
 
  applyPowerUpEffect(player, powerUp, now) {
    const effects = [];
    const durationMs = (powerUp.effectDurationSec ?? 10) * 1000;
    switch (powerUp.type) {
      case 'heal':
        player.health = Math.min((player.health || 0) + 40, player.maxHealth);
        break;
      case 'speed':
        player.speedBoostUntil = now + durationMs;
        break;
      case 'damage':
        player.damageBoostUntil = now + durationMs;
        break;
      case 'shield': {
        player.shieldUntil = now + durationMs;
        const baseShield = 50;
        player.shieldHealth = Math.min((player.shieldHealth || 0) + baseShield, baseShield * 2);
        break;
      }
      case 'multishot':
        player.multishotUntil = now + durationMs;
        break;
      case 'ricochet':
        player.ricochetUntil = now + durationMs;
        break;
      case 'ghost':
        player.ghostUntil = now + durationMs;
        break;
      case 'magnet':
        player.magnetUntil = now + durationMs;
        break;
      default:
        break;
    }
    effects.push(...this._emitPlayerUpdate(player, { powerUpCollected: powerUp.type }));
    effects.push(...this._emitNs('display', 'sound_event', {
      type: 'powerup_collect',
      x: player.x,
      y: player.y,
      powerUpType: powerUp.type
    }));
    return effects;
  }
}
