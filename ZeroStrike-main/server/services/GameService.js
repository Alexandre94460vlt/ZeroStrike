/**
 * GameService — Noyau de logique de partie.
 *
 * ⚠️ Legacy (référence historique).
 * La version actuelle du serveur utilise `server/domain/GameEngine.js` (domaine pur)
 * + `server/app/GameApp.js` (exécution des effets via ports I/O).
 * Conserver `GameService` uniquement pour faciliter la comparaison et les tests existants.
 *
 * Responsabilités :
 *   - Cycle de vie de la partie (LOBBY → BUY_PHASE → ACTION_PHASE → ROUND_END → MATCH_OVER)
 *   - Gestion des rounds, de la bombe, des scores et du kill feed
 *   - Orchestration de PlayerService, ProjectileService, PowerUpManager
 *   - Killstreaks (bombardement, mini-drones, drone tueur)
 *   - Système de héros (sélection, verrouillage, pouvoirs actifs)
 *   - Persistance des stats via LeaderboardService (SQLite)
 *
 * Convention :
 *   - Méthodes préfixées `on` → handlers d'événements Socket.io
 *   - Méthodes préfixées `tick` → appelées à 60 TPS par GameLoopService
 *   - Méthodes préfixées `_` → utilitaires internes
 */
import { PlayerService } from './PlayerService.js';
import { ProjectileService } from './ProjectileService.js';
import { HeroService } from './HeroService.js';
import { getMapData, MAP_LIST, mapDataForSocket } from '../models/maps/Map.js';
import { getWeapon, WEAPONS } from '../models/Weapon.js';
import { PowerUpManager } from '../managers/PowerUpManager.js';
import { getHero } from '../models/Heroes.js';
import {
  ROUND_DURATION, BUY_PHASE_DURATION, ROUND_END_DURATION,
  BOMB_TIMER, DEFUSE_RADIUS, MONEY_WIN, MONEY_LOSS, MONEY_KILL, ROUNDS_TO_WIN,
  PLAYER_MAX_HEALTH, PLAYER_HITBOX_RADIUS, TOJI_SPEED_MULT, TOJI_BURST_SPEED_MULT, ICHIGO_BANKAI_SPEED_MULT,
  DM_KILL_LIMIT_DEFAULT,
  LOSS_STREAK_BONUS,
  OVERTIME_BONUS_MONEY,
  MOVE_INACCURACY_MAX_RAD,
  MOVE_INACCURACY_SNIPER_MULT,
  SPRAY_PER_SHOT_RAD_BASE,
  SPRAY_MAX_RAD_BASE,
  SPRAY_DECAY_PER_SEC_BASE,
  LOBBY_PRESTART_COUNTDOWN_SEC
} from '../config/constants.js';
import { applyPresetToSettings, GAME_PRESET_IDS, getGunplayTuning } from '../../shared/gamePresets.js';
import * as LeaderboardService from '../database/LeaderboardService.js';
import { transitionTo, RoundState } from '../state/RoundStateMachine.js';
import { logStructured } from '../utils/observability.js';
import { generateRoomCode, normalizeRoomCodeInput } from '../utils/roomCode.js';
import { nudgeSpawnClearOfWalls } from '../utils/physics.js';
import {
  assignSpawnPositionsGreedy,
  getSpawnPointsAndFaceForPlayer,
  pickSpawnPointMaxMinDist
} from '../utils/spawnPlacement.js';
import { randomUUID } from 'crypto';
import { sanitizePlayerDisplayName } from '../utils/sanitizePlayerName.js';

const MAP_REVEAL_DELAY_MS = 2500;
const MATCH_OVER_DELAY_MS = 10000;

export class GameService {
  constructor(displayNamespace, mobileNamespace) {
    this.displayNamespace = displayNamespace;
    this.mobileNamespace = mobileNamespace;
    this.playerService = new PlayerService();
    this.projectileService = new ProjectileService(this.playerService);
    this.stats = LeaderboardService;
    this.currentMapId = 'dist2';
    this.currentMapData = null;
    this.walls = [];
    this.powerUpManager = null;
    this.roundState = RoundState.LOBBY;
    this.phaseTime = 0;   // compte à rebours de la phase courante (s)
    this.roundTime = ROUND_DURATION;
    this.bomb = null;
    this.scores = { DEF: 0, ATT: 0 };
    this.killFeed = [];
    this.votes = new Map(); // socketId -> mapId
    this._countdownTimeout = null;
    // Paramètres dynamiques de partie (surchargent les constantes si définis)
    this.settings = {
      mode: 'SND', // 'SND' (Search & Destroy) ou 'DM' (Deathmatch)
      /** Profil Fun / Compète / Démo BUT / Perso — voir shared/gamePresets.js */
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
      /** DM : manche gagnée au premier équipe à N frags (0 = uniquement fin au timer) */
      dmKillLimit: DM_KILL_LIMIT_DEFAULT
    };
    applyPresetToSettings(this.settings, 'FUN');

    // Stats de manche (pour le mode Deathmatch)
    this.roundKills = { ATT: 0, DEF: 0 };
    /** SND : manches perdues d’affilée par équipe (loss bonus économique) */
    this.teamLossStreak = { ATT: 0, DEF: 0 };
    /** SND : score à égalité au dernier point de réglementation → prolongation + bonus $ */
    this.inOvertime = false;
    this.hostId = null;
    /** ID du premier socket /display connecté — seul lui peut lancer/configurer la partie */
    this.displayHostId = null;
    /** Héros verrouillés pour la manche courante : heroId -> playerId */
    this.lockedHeroes = {};
    this._autoResetTimeout = null;
    /** Handles des setTimeout de respawn — pour annulation sur forceBackToLobby */
    this._respawnTimeouts = new Set();
    /** Flag dirty : positionné par les event handlers, consommé par la game loop */
    this._stateDirty = false;

    /** Sessions persistantes : sessionId → { name, team, money, currentWeapon, expiresAt } */
    this._sessions = new Map();
    /** Timer de grâce display : 30 s pour se reconnecter avant session_ended */
    this._displayGraceTimer = null;
    /** Joueurs prêts dans le lobby (socket IDs) */
    this.readyPlayers = new Set();
    /** Code affiché sur le display ; requis pour un premier join mobile (rejoin session exempté) */
    this.roomCode = generateRoomCode(5);

    this.heroService = new HeroService(this);
  }

  init() {
    this.currentMapData = getMapData(this.currentMapId);
    this.walls = this.currentMapData.walls;
    this.powerUpManager = new PowerUpManager(this.displayNamespace, this.currentMapData);
    this.roundKills = { ATT: 0, DEF: 0 };
  }

  /** Au moins un client /display connecté (évite un booléen faux négatif si plusieurs onglets). */
  hasDisplayClients() {
    return !!(this.displayNamespace && this.displayNamespace.sockets.size > 0);
  }

  onDisplayConnect(socket) {
    // Annuler le timer de grâce si le display se reconnecte à temps
    if (this._displayGraceTimer) {
      clearTimeout(this._displayGraceTimer);
      this._displayGraceTimer = null;
      console.log('[GameService] Display reconnecté — timer de grâce annulé');
    }
    if (!this.displayHostId) {
      this.displayHostId = socket.id;
      console.log('[GameService] Display hôte enregistré:', socket.id);
    }
    socket.emit(
      'map_data',
      mapDataForSocket(this.currentMapId, this.currentMapData, this.walls)
    );
    socket.emit('state_update', this.buildState());
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

  onVoteMap(socketId, mapId) {
    if (this.roundState !== 'LOBBY') return;
    const valid = MAP_LIST.some(m => m.id === mapId) || mapId === 'random';
    if (valid) {
      this.votes.set(socketId, mapId);
      this.markDirty();
    }
  }

  _shufflePlayersInPlace(players) {
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
  }

  /** Évite une hitbox spawn dans un mur (aligné GameEngine / `nudgeSpawnClearOfWalls`). */
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

  _repositionPlayerForMap(player) {
    const mapData = this.currentMapData;
    if (!mapData) return;
    const all = this.playerService.getAll();
    const { faceCT } = getSpawnPointsAndFaceForPlayer(player, mapData, all);
    const points = faceCT ? mapData.spawnCTPoints : mapData.spawnTPoints;
    if (!points?.length) {
      throw new Error('[GameService] spawnCTPoints / spawnTPoints requis sur mapData.');
    }
    const others = all.filter((p) => p.id !== player.id);
    const pt = pickSpawnPointMaxMinDist(points, others, player.id);
    player.x = pt.x;
    player.y = pt.y;
    this._snapPlayerSpawnToClearWalls(player);
    player.rot = faceCT ? 0 : Math.PI;
  }

  /** Tirage aléatoire équilibré ATT/DEF puis reposition + ui_update mobiles. */
  _assignBalancedTeams() {
    const list = this.playerService.getAll().slice();
    const n = list.length;
    if (n === 0) return;
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
    } else {
      for (const p of list) {
        this._repositionPlayerForMap(p);
      }
    }
    for (const p of list) {
      this._emitPlayerUpdate(p);
    }
  }

  async startGameWithVote() {
    if (this.roundState !== 'LOBBY') return;
    if (this._countdownTimeout) return;
    this._assignBalancedTeams();
    this.readyPlayers.clear();
    this._broadcastReadyState();

    logStructured('info', 'match_countdown_started', {
      players: this.playerService.players.size,
      map_id: this.currentMapId
    });

    const emitCountdown = async (n) => {
      this.displayNamespace.emit('countdown', n);
      this.mobileNamespace.emit('countdown', n);
      if (n > 0) {
        this._countdownTimeout = setTimeout(() => emitCountdown(n - 1), 1000);
      } else {
        this._countdownTimeout = null;
        const counts = this.getVoteCounts();
        const ids = [...MAP_LIST.map(m => m.id), 'random'];
        const maxVotes = Math.max(...ids.map(id => counts[id] || 0));
        const tied = ids.filter(id => (counts[id] || 0) === maxVotes);
        if (!tied.length) {
          throw new Error('[GameService] Vote carte : liste des candidats vide (incohérence compteurs).');
        }
        let chosenId = tied[Math.floor(Math.random() * tied.length)];
        if (chosenId === 'random') {
          chosenId = MAP_LIST[Math.floor(Math.random() * MAP_LIST.length)].id;
        }

        this.currentMapId = chosenId;
        this.currentMapData = getMapData(chosenId);
        this.walls = this.currentMapData.walls;
        if (this.powerUpManager) {
          this.powerUpManager.setMap(this.currentMapData);
        }
        this.votes.clear();

        // Repositionner tous les joueurs sur des cellules libres dans la zone de spawn
        const all = this.playerService.getAll();
        const spawnCTPoints = this.currentMapData.spawnCTPoints;
        const spawnTPoints = this.currentMapData.spawnTPoints;
        if (!spawnCTPoints?.length || !spawnTPoints?.length) {
          throw new Error('[GameService] Spawns carte invalides après vote.');
        }
        assignSpawnPositionsGreedy(this.currentMapData, all);
        for (const player of all) {
          const { faceCT } = getSpawnPointsAndFaceForPlayer(player, this.currentMapData, all);
          this._snapPlayerSpawnToClearWalls(player);
          player.rot = faceCT ? 0 : Math.PI;
        }
        this.markDirty();

        this.displayNamespace.emit('map_chosen', { mapId: chosenId, voteCounts: counts });
        this.displayNamespace.emit(
          'map_data',
          mapDataForSocket(this.currentMapId, this.currentMapData, this.walls)
        );

        setTimeout(() => {
          this.startRound();
          this.displayNamespace.emit('game_starting');
        }, MAP_REVEAL_DELAY_MS);
      }
    };
    emitCountdown(LOBBY_PRESTART_COUNTDOWN_SEC);
  }

  /**
   * Met à jour les paramètres de gameplay depuis le lobby (display).
   * data peut contenir: roundsToWin, roundDuration, buyPhaseDuration, bombTimer,
   * startingMoney, moneyWin, moneyLoss, moneyKill, enablePowerUps, dmKillLimit (DM).
   */
  updateSettings(data) {
    if (this.roundState !== 'LOBBY') return;
    if (!data || typeof data !== 'object') return;
    const s = this.settings;
    if (typeof data.gamePreset === 'string' && GAME_PRESET_IDS.includes(data.gamePreset)) {
      applyPresetToSettings(s, data.gamePreset);
    }
    if (Number.isFinite(data.roundsToWin) && data.roundsToWin >= 1 && data.roundsToWin <= 15) {
      s.roundsToWin = Math.floor(data.roundsToWin);
    }
    if (Number.isFinite(data.roundDuration) && data.roundDuration >= 30 && data.roundDuration <= 300) {
      s.roundDuration = Math.floor(data.roundDuration);
    }
    if (Number.isFinite(data.buyPhaseDuration) && data.buyPhaseDuration >= 0 && data.buyPhaseDuration <= 60) {
      s.buyPhaseDuration = Math.floor(data.buyPhaseDuration);
    }
    if (Number.isFinite(data.bombTimer) && data.bombTimer >= 10 && data.bombTimer <= 90) {
      s.bombTimer = Math.floor(data.bombTimer);
      if (this.bomb) this.bomb.timer = s.bombTimer;
    }
    if (Number.isFinite(data.startingMoney) && data.startingMoney >= 0 && data.startingMoney <= 16000) {
      s.startingMoney = Math.floor(data.startingMoney);
    }
    if (Number.isFinite(data.moneyWin)  && data.moneyWin  >= 0 && data.moneyWin  <= 10000) s.moneyWin  = Math.floor(data.moneyWin);
    if (Number.isFinite(data.moneyLoss) && data.moneyLoss >= 0 && data.moneyLoss <= 10000) s.moneyLoss = Math.floor(data.moneyLoss);
    if (Number.isFinite(data.moneyKill) && data.moneyKill >= 0 && data.moneyKill <= 1000)  s.moneyKill = Math.floor(data.moneyKill);
    if (typeof data.enablePowerUps === 'boolean') s.enablePowerUps = data.enablePowerUps;
    if (typeof data.mode === 'string' && (data.mode === 'SND' || data.mode === 'DM')) {
      s.mode = data.mode;
    }
    if (Number.isFinite(data.dmKillLimit) && data.dmKillLimit >= 0 && data.dmKillLimit <= 200) {
      s.dmKillLimit = Math.floor(data.dmKillLimit);
    }

    this.markDirty();
    // Retour immédiat au lobby (sync champs / profil sans attendre la game loop)
    this.broadcastState();
  }

  onDisplayDisconnect(socket) {
    if (socket && this.displayHostId === socket.id) {
      this.displayHostId = null;
      console.log('[GameService] Display hôte déconnecté — timer de grâce 30 s');
      if (this._displayGraceTimer) clearTimeout(this._displayGraceTimer);
      // Laisser 30 s au display pour revenir avant de terminer la session
      this._displayGraceTimer = setTimeout(() => {
        this._displayGraceTimer = null;
        if (!this.hasDisplayClients() && this.roundState !== 'LOBBY') {
          console.log('[GameService] Display absent > 30 s — session terminée');
          this.mobileNamespace.emit('session_ended', { reason: 'display_left' });
          this.forceBackToLobby('auto-reset');
        }
      }, 30_000);
    }
  }

  /**
   * Force le retour immédiat au lobby (host display ou host mobile).
   * Utilisé via le bouton "QUITTER LA PARTIE".
   */
  forceBackToLobby(requesterId = null) {
    if (this.roundState === 'LOBBY') return;
    // Défense en profondeur : seuls l’hôte display, l’hôte mobile ou le reset auto sont autorisés
    if (requesterId && requesterId !== 'auto-reset') {
      const ok =
        requesterId === this.displayHostId ||
        requesterId === this.hostId;
      if (!ok) {
        console.warn('[GameService] forceBackToLobby ignoré (requester non hôte):', requesterId);
        return;
      }
    }
    console.log(`[GameService] Force retour lobby demandé par: ${requesterId || 'système'}`);
    logStructured('info', 'match_force_lobby', {
      requester: requesterId || 'system',
      round_state: this.roundState
    });
    // Annuler tous les timeouts en cours (compte à rebours, grâce display, respawns)
    if (this._countdownTimeout) { clearTimeout(this._countdownTimeout); this._countdownTimeout = null; }
    if (this._displayGraceTimer) { clearTimeout(this._displayGraceTimer); this._displayGraceTimer = null; }
    for (const h of this._respawnTimeouts) clearTimeout(h);
    this._respawnTimeouts.clear();
    this.heroService.reset();
    this.projectileService.clear();
    this.backToLobby();
  }

  /**
   * Vérifie si la partie doit être auto-annulée (0 joueurs pendant la partie).
   * Appelé à chaque déconnexion de joueur.
   */
  _checkAutoReset() {
    if (this.roundState === 'LOBBY' || this.roundState === 'MATCH_OVER') return;
    const players = this.playerService.getAll();
    if (players.length === 0) {
      console.log('[GameService] Tous les joueurs ont quitté – retour automatique au lobby dans 5s');
      if (this._autoResetTimeout) clearTimeout(this._autoResetTimeout);
      this._autoResetTimeout = setTimeout(() => {
        if (this.playerService.getAll().length === 0 && this.roundState !== 'LOBBY') {
          this.forceBackToLobby('auto-reset');
        }
        this._autoResetTimeout = null;
      }, 5000);
    }
  }

  onPlayerJoin(socket, data) {
    const { name, team, sessionId, roomCode: clientRoomCode } = data || {};
    // Session sauvegardée : rejoin après déconnexion réseau / rechargement de page
    const rawSessionId = typeof sessionId === 'string' ? sessionId.slice(0, 64) : null;
    const savedSession = rawSessionId ? this._sessions.get(rawSessionId) : null;
    const isRejoin = !!savedSession && savedSession.expiresAt > Date.now();
    if (rawSessionId) this._sessions.delete(rawSessionId); // nettoyage systématique

    // Premier join : code partie obligatoire (rejoin avec sessionId valide : pas de code)
    if (!isRejoin) {
      const entered = normalizeRoomCodeInput(clientRoomCode);
      if (!entered || entered !== this.roomCode) {
        socket.emit('ui_update', {
          error: entered ? 'Code partie incorrect.' : 'Indiquez le code affiché sur le grand écran.'
        });
        return;
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
    const player = this.playerService.add(socket.id, safeName, validTeam);

    if (!player) {
      socket.emit('ui_update', { error: 'Serveur plein' });
      return;
    }

    // Attribuer un sessionId stable (persistant entre reconnexions)
    player.sessionId = isRejoin ? savedSession.sessionId : randomUUID();
    socket.emit('session_confirmed', { sessionId: player.sessionId });

    // Premier joueur mobile connecté devient host si aucun host défini
    if (!this.hostId) {
      this.hostId = socket.id;
    }

    // Argent initial : aligne sur startingMoney (même si join en cours de manche)
    // → le joueur pourra acheter à la prochaine BUY_PHASE.
    player.money = this.settings.startingMoney ?? 2500;
    // Rejoin en cours de partie : restaurer l'état économique du joueur
    if (isRejoin && this.roundState !== 'LOBBY') {
      player.money = savedSession.money;
      player.currentWeapon = savedSession.currentWeapon;
      const w = getWeapon(player.currentWeapon);
      player.ammo = w.magSize;
      player.ammoReserve = w.reserveMax;
    }

    this._repositionPlayerForMap(player);

    // Rejoin en cours de partie : il est connecté tout de suite côté UI,
    // mais il jouera/spawn à la prochaine manche (respawnAllPlayers()).
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

    socket.join('game');

    // Snapshot immédiat au joueur qui rejoint (évite UI bloquée sur un ancien écran)
    this._emitPlayerUpdate(player, { roundState: this.roundState });
    socket.emit('sync_roster', { lockedHeroes: this.lockedHeroes });
    socket.emit('game_phase', {
      roundState: this.roundState,
      phaseTime: Math.ceil(this.phaseTime),
      roundTime: Math.ceil(this.roundTime)
    });
    socket.emit('lobby_state', {
      roundState: this.roundState,
      voteCounts: this.roundState === 'LOBBY' ? this.getVoteCounts() : undefined,
      maps: this.roundState === 'LOBBY' ? MAP_LIST.map(m => ({ id: m.id, name: m.name })) : undefined,
      hostId: this.hostId,
      settings: this.roundState === 'LOBBY'
        ? {
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
        : undefined,
      roomCode: this.roomCode,
      lockedHeroes: this.lockedHeroes,
      playerCount: this.playerService.getAll().length
    });

    // Mettre à jour l'état Prêt (compte de joueurs changé)
    if (this.roundState === 'LOBBY') this._broadcastReadyState();

    this.markDirty();
  }

  onHeroSelect(socketId, { heroId }) {
    if (this.roundState !== 'BUY_PHASE') return;
    if (!heroId) return;
    const player = this.playerService.get(socketId);
    if (!player || player.isDead) return;
    const hero = getHero(heroId);
    if (!hero) return;
    // Déjà pris pour cette manche ?
    if (this.lockedHeroes[heroId]) return;
    // Pas assez de points (on réutilise l'argent comme "points héros")
    if (player.money < hero.cost) return;

    player.money -= hero.cost;
    player.heroId = hero.id;
    player.heroPowerUsed  = false;
    player.heroPowerBUsed = false;
    this.lockedHeroes[hero.id] = player.id;

    // Toji : passif permanent — vitesse double dès la sélection
    if (hero.id === 'toji') {
      player.baseSpeed = 200 * TOJI_SPEED_MULT;
      player.speed = player.baseSpeed;
    }

    this._emitPlayerUpdate(player);
    this.syncHeroRoster();
  }

  onInputMove(socketId, data) {
    if (this.roundState !== 'ACTION_PHASE') return;
    if (!data || typeof data !== 'object') return;
    const player = this.playerService.get(socketId);
    const now = Date.now();
    if (!player) return;
    if (player.frozenUntil > now) return;
    if (player.stunUntil > now) {
      this.playerService.updateInputMove(socketId, { angle: 0, force: 0 });
      return;
    }
    let angle = Number(data.angle);
    const force = Math.max(0, Math.min(1, Number(data.force) || 0));
    // Itachi Tsukuyomi — contrôles inversés
    if (player.reversedUntil > now) angle = angle + Math.PI;
    this.playerService.updateInputMove(socketId, { angle: isNaN(angle) ? 0 : angle, force });
  }

  onInputAim(socketId, { angle }) {
    const player = this.playerService.get(socketId);
    if (!player || player.isDead) return;
    const now = Date.now();
    if (player.frozenUntil && player.frozenUntil > now) return;
    player.rot = angle;
  }

  onInputAction(socketId, { type, data }) {
    const player = this.playerService.get(socketId);
    if (!player || player.isDead) return;
    if (type !== 'RELOAD' && this.roundState !== 'ACTION_PHASE') return; // PLANT/DEFUSE/SHOOT uniquement en ACTION_PHASE
    const now = Date.now();
    if (player.frozenUntil > now) return;

    const socket = this.mobileNamespace.sockets.get(socketId);
    if (!socket) return;

    const weapon = getWeapon(player.currentWeapon);

    switch (type) {
      case 'SHOOT': {
        // Silence (Luffy A) — impossible de tirer
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
          const moveSpreadRad =
            moveFactor * MOVE_INACCURACY_MAX_RAD * sniperMult * tuning.moveMult;
          const sprayMax = SPRAY_MAX_RAD_BASE * tuning.sprayMax;
          const sprayAdd = SPRAY_PER_SHOT_RAD_BASE * tuning.sprayPerShot;
          const sprayBefore = Math.min(sprayMax, player.sprayAccumRad || 0);
          const totalSpreadRad = moveSpreadRad + sprayBefore;
          player.sprayAccumRad = Math.min(sprayMax, sprayBefore + sprayAdd);

          if (hasMultishot || hasRicochet) {
            // Tir arcade : cône de balles
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
          this.emitSound('shoot', player.x, player.y, { weaponId: weapon.id });
          this._emitPlayerUpdate(player);
          socket.emit('haptic', { duration: 50 });
        } else if (player.ammoReserve > 0 && player.ammo < weapon.magSize) {
          // Auto-rechargement : chargeur vide, munitions disponibles
          const need = weapon.magSize - player.ammo;
          const fill = Math.min(need, player.ammoReserve);
          player.ammo += fill;
          player.ammoReserve -= fill;
          this.emitSound('reload', player.x, player.y, { weaponId: weapon.id });
          socket.emit('haptic', { pattern: [22, 38, 28, 45] });
          this._emitPlayerUpdate(player);
        }
        break;
      }
      case 'RELOAD':
        if (player.ammoReserve > 0 && player.ammo < weapon.magSize) {
          const need = weapon.magSize - player.ammo;
          const reload = Math.min(need, player.ammoReserve);
          player.ammo += reload;
          player.ammoReserve -= reload;
          this.emitSound('reload', player.x, player.y, { weaponId: weapon.id });
          // Feedback tactile : chargeur / culasse (distinct du tir court)
          socket.emit('haptic', { pattern: [22, 38, 28, 45] });
          this._emitPlayerUpdate(player);
        }
        break;
      case 'PLANT':
        if (player.team === 'ATT' && !this.bomb?.planted) {
          for (const site of this.currentMapData.bombSites) {
            const dx = player.x - site.x;
            const dy = player.y - site.y;
            if (Math.sqrt(dx * dx + dy * dy) < site.radius) {
              this.bomb = { planted: true, siteId: site.id, x: player.x, y: player.y, timer: this.settings.bombTimer ?? BOMB_TIMER, planterName: player.name };
              socket.emit('haptic', { duration: 80 });
              if (this.stats) this.stats.addPlant(player.name);
              break;
            }
          }
        }
        break;
      case 'DEFUSE':
        if (player.team === 'DEF' && this.bomb?.planted) {
          const dx = player.x - this.bomb.x;
          const dy = player.y - this.bomb.y;
          if (Math.sqrt(dx * dx + dy * dy) < DEFUSE_RADIUS) this.defuseBomb(player);
        }
        break;
      case 'HERO_POWER':
        this.activateHeroPower(player, 'A');
        break;
      case 'HERO_POWER_B':
        this.activateHeroPower(player, 'B');
        break;
      default:
        break;
    }
  }

  sendContextToMobile(socketId) {
    const player = this.playerService.get(socketId);
    if (!player) return;
    const ctx = this.getPlayerContext(player);
    const socket = this.mobileNamespace.sockets.get(socketId);
    if (socket) socket.emit('context_update', ctx);
  }

  getPlayerContext(player) {
    const weapon = getWeapon(player.currentWeapon);
    const needReload = player.ammo < weapon.magSize && player.ammoReserve > 0;
    let canPlant = false;
    if (player.team === 'ATT' && !this.bomb?.planted && this.roundState === 'ACTION_PHASE') {
      for (const site of this.currentMapData.bombSites) {
        const dx = player.x - site.x;
        const dy = player.y - site.y;
        if (Math.sqrt(dx * dx + dy * dy) < site.radius) {
          canPlant = true;
          break;
        }
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
   * @param {import('../models/Player.js').Player} player
   * @returns {{ inDomain: boolean, domainInterior: { cx: number, cy: number, r: number } | null }}
   */
  _getDomainUiContextForPlayer(player) {
    const now = Date.now();
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

  onShopBuy(socketId, { weaponId }) {
    if (this.roundState !== 'BUY_PHASE') return;
    const player = this.playerService.get(socketId);
    if (!player) return;
    if (!weaponId || !WEAPONS[weaponId]) return;
    const weapon = WEAPONS[weaponId];
    const socket = this.mobileNamespace.sockets.get(socketId);

    if (player.currentWeapon === weaponId) {
      // Revendre : récupérer l'argent, repasser au pistolet
      player.money += weapon.price;
      const pistol = WEAPONS.PISTOL;
      player.currentWeapon = pistol.id;
      player.ammo = pistol.magSize;
      player.ammoReserve = pistol.reserveMax;
      this._emitPlayerUpdate(player);
      return;
    }

    if (weapon.price > player.money) return;
    player.money -= weapon.price;
    player.currentWeapon = weapon.id;
    player.ammo = weapon.magSize;
    player.ammoReserve = Math.min(player.ammoReserve, weapon.reserveMax);
    this._emitPlayerUpdate(player);
  }

  /** Relaie un commentaire mobile vers le display (kill feed) */
  onPlayerComment(socketId, { text }) {
    const player = this.playerService.get(socketId);
    if (!player || !text || typeof text !== 'string') return;
    const safe = String(text).slice(0, 60).replace(/[<>]/g, '');
    if (!safe.trim()) return;
    this.displayNamespace.emit('player_comment', { name: player.name, text: safe.trim() });
  }

  onPlayerDisconnect(socketId) {
    const wasHost = this.hostId === socketId;

    // Sauvegarder la session pour permettre le rejoin (valable 30 minutes)
    const leavingPlayer = this.playerService.get(socketId);
    if (leavingPlayer?.sessionId) {
      this._sessions.set(leavingPlayer.sessionId, {
        sessionId: leavingPlayer.sessionId,
        name: leavingPlayer.name,
        team: leavingPlayer.team,
        money: leavingPlayer.money,
        currentWeapon: leavingPlayer.currentWeapon,
        expiresAt: Date.now() + 30 * 60 * 1000
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

    // Retirer son vote de carte pour ne pas polluer les comptages
    this.votes.delete(socketId);

    this.playerService.remove(socketId);

    if (wasHost) {
      const remaining = this.playerService.getAll();
      this.hostId = remaining.length ? remaining[0].id : null;
      if (this.hostId) {
        console.log('[GameService] Nouveau host mobile:', this.hostId);
      }
    }

    this.readyPlayers.delete(socketId);
    this._broadcastReadyState();
    this.markDirty();
    if (heroReleased) this.syncHeroRoster();

    this._checkAutoReset();
  }

  onPlayerReady(socketId, isReady) {
    if (this.roundState !== 'LOBBY') return;
    const player = this.playerService.get(socketId);
    if (!player) return;
    if (isReady) this.readyPlayers.add(socketId);
    else this.readyPlayers.delete(socketId);
    this._broadcastReadyState();
    // Le lancement se fait uniquement via « Lancer la partie » sur le display (start_game).
  }

  _broadcastReadyState() {
    const all = this.playerService.getAll();
    const total = all.length;
    const ready = all.filter(p => this.readyPlayers.has(p.id)).length;
    const allReady = total >= 2 && ready >= total;
    const payload = { ready, total, allReady };
    this.displayNamespace.emit('ready_update', payload);
    this.mobileNamespace.emit('ready_update', payload);
  }

  tick(dt) {
    if (this.roundState === 'LOBBY' || this.roundState === 'MATCH_OVER') return;

    if (this.roundState === 'BUY_PHASE') {
      this._tickBuyPhase(dt);
      return;
    }
    if (this.roundState === 'ROUND_END') {
      this._tickRoundEnd(dt);
      return;
    }
    if (this.roundState === 'ACTION_PHASE') {
      this._tickActionPhase(dt);
    }
  }

  _tickBuyPhase(dt) {
    this.phaseTime -= dt;
    if (this.phaseTime <= 0) {
      this.roundState = transitionTo(this.roundState, RoundState.ACTION_PHASE);
      this.roundTime = this.settings.roundDuration ?? ROUND_DURATION;
      this.emitGamePhaseToMobiles();
    }
  }

  _tickRoundEnd(dt) {
    this.phaseTime -= dt;
    if (this.phaseTime <= 0) this.startRound();
  }

  _tickActionPhase(dt) {
    this.roundTime -= dt;
    if (this.roundTime <= 0) {
      if (this.settings.mode === 'DM') {
        const attKills = this.roundKills.ATT || 0;
        const defKills = this.roundKills.DEF || 0;
        const winner = attKills >= defKills ? 'ATT' : 'DEF';
        this.endRound(winner);
      } else {
        this.endRound('DEF');
      }
      return;
    }

    if (this.bomb?.planted) {
      this.bomb.timer -= dt;
      if (this.bomb.timer <= 0) {
        this.endRound('ATT');
        return;
      }
    }

    const allPlayers = this.playerService.getAll();
    const now = Date.now();
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
      (target, damage, killerId, weapon) => this.onProjectileHit(target, damage, killerId, weapon),
      (type, x, y) => this.emitSound(type, x, y)
    );

    if (this.powerUpManager && this.settings.enablePowerUps) {
      this.powerUpManager.tick(dt);
      this.handlePowerUpPickups();
    }
    this.heroService.tick(dt);

    if (this.settings.mode !== 'DM' && allPlayers.length > 0) {
      const defAlive = this.playerService.getAliveByTeam('DEF').length;
      const attAlive = this.playerService.getAliveByTeam('ATT').length;
      if (defAlive === 0) { this.endRound('ATT'); return; }
      if (attAlive === 0 && !this.bomb?.planted) { this.endRound('DEF'); return; }
    }
  }

  onProjectileHit(target, damage, killerId, weaponName = 'Rifle') {
    const now = Date.now();
    // Killua Godspeed — invincible
    if (target.invincibleUntil > now) return;
    const killer = this.playerService.get(killerId);
    let finalDamage = damage;
    // Boost de dégâts
    if (killer && killer.damageBoostUntil && killer.damageBoostUntil > now) {
      finalDamage = Math.floor(damage * 1.5);
    }

    const healthBefore = target.health ?? PLAYER_MAX_HEALTH;

    // Bouclier : absorbe une partie des dégâts avant la vie
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
      const victimSock = this.mobileNamespace.sockets.get(target.id);
      if (victimSock) {
        // Retour haptique mobile : toucher reçu (plus marqué si élimination)
        victimSock.emit(
          'haptic',
          target.health <= 0
            ? { pattern: [30, 40, 50, 70] }
            : { pattern: [18, 12, 42] }
        );
        // Flash directionnel : angle depuis la victime vers le tireur (coordonnées monde)
        const dmgAngle = killer ? Math.atan2(killer.y - target.y, killer.x - target.x) : null;
        victimSock.emit('damage_received', { damage: remaining, angle: dmgAngle, isDead: target.health <= 0 });
      }
    }

    const hpLost = Math.max(0, healthBefore - Math.max(0, target.health ?? 0));
    if (hpLost > 0 || shieldDamage > 0) {
      this.displayNamespace.emit('damage_indicator', {
        x: target.x,
        y: target.y,
        hp: hpLost,
        shield: shieldDamage,
        isKill: target.health <= 0
      });
    }

    if (target.health <= 0) {
      target.isDead = true;
      target.sprayAccumRad = 0;
      // Compter les kills par manche pour le mode Deathmatch
      if (this.settings.mode === 'DM' && killer && killer.team) {
        this.roundKills[killer.team] = (this.roundKills[killer.team] || 0) + 1;
      }
    }

    const killerName = killer?.name || 'Player';
    const victimName = target.name || 'Player';
    if (target.health <= 0) {
      // Stats individuelles du round (pour le scoreboard post-manche)
      target.roundDeaths = (target.roundDeaths || 0) + 1;
      if (this.stats) this.stats.recordKill(killerName, victimName);
      if (killer) {
        killer.roundKills = (killer.roundKills || 0) + 1;
        killer.money += this.settings.moneyKill ?? MONEY_KILL;
        this._emitPlayerUpdate(killer);
        const killerSock = this.mobileNamespace.sockets.get(killer.id);
        if (killerSock) killerSock.emit('kill_confirmed', { victimName, weaponName });
      }
      this.killFeed.unshift({ killer: killerName, victim: victimName, weapon: weaponName });
      if (this.killFeed.length > 5) this.killFeed.pop();
      this.displayNamespace.emit('kill_feed', { killer: killerName, victim: victimName, weapon: weaponName });
      this.displayNamespace.emit('sound_event', { type: 'explosion', x: target.x, y: target.y });

      const dmLimit = this.settings.dmKillLimit ?? DM_KILL_LIMIT_DEFAULT;
      if (
        this.settings.mode === 'DM' &&
        dmLimit > 0 &&
        killer &&
        killer.team &&
        (this.roundKills[killer.team] || 0) >= dmLimit
      ) {
        this._emitPlayerUpdate(target);
        // Notifier la mort avant de terminer le round
        const vsockEnd = this.mobileNamespace.sockets.get(target.id);
        if (vsockEnd) vsockEnd.emit('you_died', { killerName, weaponName, respawnMs: null });
        this.endRound(killer.team);
        return;
      }

      // Notifier le joueur de sa mort (écran de mort + timer de respawn côté mobile)
      const vsock = this.mobileNamespace.sockets.get(target.id);
      if (vsock) {
        vsock.emit('you_died', {
          killerName,
          weaponName,
          respawnMs: this.settings.mode === 'DM' ? 2000 : null
        });
      }

      if (this.settings.mode === 'DM') {
        this.scheduleRespawn(target.id);
      }
    }
    this._emitPlayerUpdate(target);
  }

  /**
   * @param {string} type
   * @param {number} x
   * @param {number} y
   * @param {Record<string, unknown>} [extra] — ex. { weaponId: 'RIFLE' } pour le display (son + recul)
   */
  emitSound(type, x, y, extra = {}) {
    this.displayNamespace.emit('sound_event', { type, x, y, ...extra });
  }

  /**
   * Émet un `ui_update` complet au joueur mobile.
   * Centralise tous les champs usuels ; `extra` permet d'y ajouter des champs
   * contextuels (roundState, powerUpCollected, etc.).
   */
  _emitPlayerUpdate(player, extra = {}) {
    const socket = this.mobileNamespace.sockets.get(player.id);
    if (!socket) return;
    socket.emit('ui_update', {
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

  /**
   * Réinitialise l'état combat d'un joueur (appelé entre chaque round et en lobby).
   * Ne touche pas à l'argent, à l'arme ni à la position — ces resets sont
   * gérés par l'appelant selon le contexte (round vs lobby).
   */
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
    player.radius = player.baseRadius ?? PLAYER_HITBOX_RADIUS;
    player.sprayAccumRad = 0;
    player.roundKills  = 0;
    player.roundDeaths = 0;
    player.domainSides = {};
  }

  defuseBomb(player) {
    if (!this.bomb?.planted) return;
    this.displayNamespace.emit('sound_event', { type: 'defuse', x: this.bomb.x, y: this.bomb.y });
    if (this.stats) this.stats.addDefuse(player.name);
    this.endRound('DEF');
  }

  scheduleRespawn(playerId, delayMs = 2000) {
    const handle = setTimeout(() => {
      this._respawnTimeouts.delete(handle);
      if (this.roundState !== 'ACTION_PHASE' || !this.currentMapData) return;
      const player = this.playerService.get(playerId);
      if (!player || !player.isDead) return;
      const spawnPoints =
        player.team === 'DEF' ? this.currentMapData.spawnCTPoints : this.currentMapData.spawnTPoints;
      if (!spawnPoints?.length) {
        throw new Error('[GameService] scheduleRespawn : spawns absents.');
      }
      const alive = this.playerService.getAll().filter((p) => !p.isDead && p.id !== playerId);
      const pt = pickSpawnPointMaxMinDist(spawnPoints, alive, player.id);
      player.x = pt.x;
      player.y = pt.y;
      this._snapPlayerSpawnToClearWalls(player);
      player.isDead = false;
      player.health = player.maxHealth;
      player.invincibleUntil = Date.now() + 1500; // 1.5 s d'invincibilité au respawn DM
      this._emitPlayerUpdate(player);
      this.markDirty();
    }, delayMs);
    this._respawnTimeouts.add(handle);
  }

  handlePowerUpPickups() {
    if (!this.powerUpManager || !this.powerUpManager.powerUps.length) return;
    const players = this.playerService.getAll().filter((p) => !p.isDead);
    if (!players.length) return;
    const now = Date.now();
    // Snapshot avant modifications + Set des IDs déjà ramassés ce tick (anti double-pickup)
    const powerUps = this.powerUpManager.powerUps.slice();
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
          this.applyPowerUpEffect(player, pu, now);
          this.powerUpManager.removePowerUpById(pu.id);
          removedIds.add(pu.id);
          break;
        }
      }
    }
  }

  applyPowerUpEffect(player, powerUp, now) {
    const durationMs = (powerUp.effectDurationSec ?? 10) * 1000;
    switch (powerUp.type) {
      case 'heal':
        // Soin immédiat : +40 HP, plafonné à la vie max
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
        // Intangibilité : les projectiles ennemis traversent le joueur
        player.ghostUntil = now + durationMs;
        break;
      case 'magnet':
        player.magnetUntil = now + durationMs;
        break;
      default:
        break;
    }
    this._emitPlayerUpdate(player, { powerUpCollected: powerUp.type });
    // Feedback visuel/audio sur le display
    this.displayNamespace.emit('sound_event', {
      type: 'powerup_collect',
      x: player.x,
      y: player.y,
      powerUpType: powerUp.type
    });
  }

  endRound(winner) {
    this.scores[winner] = (this.scores[winner] || 0) + 1;
    const all = this.playerService.getAll();
    if (this.stats) {
      const byTeam = { ATT: [], DEF: [] };
      for (const p of all) {
        if (p.team === 'ATT') byTeam.ATT.push(p.name);
        else if (p.team === 'DEF') byTeam.DEF.push(p.name);
      }
      this.stats.recordRoundResult(winner, byTeam);
    }
    this.bomb = null;
    this.projectileService.clear();

    const snd = this.settings.mode === 'SND';
    if (snd) {
      const loser = winner === 'ATT' ? 'DEF' : 'ATT';
      this.teamLossStreak[loser] = Math.min(5, (this.teamLossStreak[loser] || 0) + 1);
      this.teamLossStreak[winner] = 0;
    }

    // Distribution d'argent : gagnants / perdants + loss bonus (SND)
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

    // Prolongation : égalité au match point (ex. 2–2 en BO3)
    const roundsToWin = this.settings.roundsToWin ?? ROUNDS_TO_WIN;
    if (
      snd &&
      !this.inOvertime &&
      this.scores.ATT === roundsToWin - 1 &&
      this.scores.DEF === roundsToWin - 1 &&
      this.scores.ATT === this.scores.DEF
    ) {
      this.inOvertime = true;
      this.displayNamespace.emit('overtime_start', { scores: { ...this.scores } });
      const otMoney = OVERTIME_BONUS_MONEY;
      for (const p of all) {
        p.money += otMoney;
      }
    }

    // Victoire BO paramétrable
    if (this.scores.ATT === roundsToWin || this.scores.DEF === roundsToWin) {
      this.roundState = transitionTo(this.roundState, RoundState.MATCH_OVER);
      const matchWinner = this.scores.ATT === roundsToWin ? 'ATT' : 'DEF';
      this.displayNamespace.emit('match_end', { winner: matchWinner, scores: this.scores });
      // Écran de fin de match sur les mobiles
      const finalBoard = all.map(p => ({
        name: p.name, team: p.team, kills: p.roundKills || 0, deaths: p.roundDeaths || 0
      })).sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths));
      this.mobileNamespace.emit('match_end', {
        winner: matchWinner,
        scores: { ...this.scores },
        scoreboard: finalBoard
      });
      this.markDirty();
      setTimeout(() => this.backToLobby(), MATCH_OVER_DELAY_MS);
      return;
    }

    this.roundState = transitionTo(this.roundState, RoundState.ROUND_END);
    this.roundKills = { ATT: 0, DEF: 0 };

    // Scoreboard post-manche — émis AVANT respawnAllPlayers qui reset les stats individuelles
    const scoreboard = all.map(p => ({
      name:   p.name,
      team:   p.team,
      kills:  p.roundKills  || 0,
      deaths: p.roundDeaths || 0
    })).sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths));
    this.mobileNamespace.emit('round_summary', {
      winner,
      scores: { ...this.scores },
      scoreboard
    });

    this.phaseTime = ROUND_END_DURATION;
    this.lockedHeroes = {};
    this.heroService.reset();
    this.respawnAllPlayers();
    this.syncHeroRoster();
    this.emitGamePhaseToMobiles();
    this.markDirty();
  }

  backToLobby() {
    this.roundState = transitionTo(this.roundState, RoundState.LOBBY);
    this.scores = { DEF: 0, ATT: 0 };
    this.teamLossStreak = { ATT: 0, DEF: 0 };
    // Nettoyer les sessions expirées (les sessions valides restent pour permettre le rejoin en lobby)
    for (const [sid, s] of this._sessions) {
      if (s.expiresAt <= Date.now()) this._sessions.delete(sid);
    }
    this.inOvertime = false;
    this.readyPlayers.clear();
    this.lockedHeroes = {};
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
      this._emitPlayerUpdate(p, { roundState: 'LOBBY' });
    }
    // Forcer la remise en état de l'UI mobile (shop off, lobby on)
    this.emitGamePhaseToMobiles();
    this.displayNamespace.emit('back_to_lobby');
    this.markDirty();
  }

  respawnAllPlayers() {
    if (this.powerUpManager) {
      this.powerUpManager.setMap(this.currentMapData);
    }
    const all = this.playerService.getAll();
    const spawnCTPoints = this.currentMapData.spawnCTPoints;
    const spawnTPoints = this.currentMapData.spawnTPoints;
    if (!spawnCTPoints?.length || !spawnTPoints?.length) {
      throw new Error('[GameService] respawnAllPlayers : spawns invalides.');
    }
    for (const player of all) {
      this._resetPlayerCombatState(player);
    }
    assignSpawnPositionsGreedy(this.currentMapData, all);
    for (const player of all) {
      const { faceCT } = getSpawnPointsAndFaceForPlayer(player, this.currentMapData, all);
      this._snapPlayerSpawnToClearWalls(player);
      player.rot = faceCT ? 0 : Math.PI;
      player.invincibleUntil = Date.now() + 1500; // 1.5 s d'invincibilité au spawn
      this._emitPlayerUpdate(player);
    }
  }

  emitGamePhaseToMobiles() {
    const payload = {
      roundState: this.roundState,
      phaseTime: Math.ceil(this.phaseTime),
      roundTime: Math.ceil(this.roundTime),
      inOvertime: !!this.inOvertime
    };
    this.mobileNamespace.emit('game_phase', payload);
  }

  startRound() {
    this.roundState = transitionTo(this.roundState, RoundState.BUY_PHASE);
    logStructured('info', 'round_phase', {
      phase: 'BUY_PHASE',
      map_id: this.currentMapId,
      players: this.playerService.players.size
    });
    this.phaseTime = this.settings.buyPhaseDuration ?? BUY_PHASE_DURATION;
    this.bomb = null;
    this.lockedHeroes = {};
    this.heroService.reset();
    this.respawnAllPlayers();
    this.emitGamePhaseToMobiles();
    // Notifier tous les mobiles que le roster est réinitialisé
    this.syncHeroRoster();
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
      heroId: p.heroId || null
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
        .filter((d) => d.expiresAt > Date.now())
        .map((d) => ({
          id: d.id,
          ownerId: d.ownerId,
          heroId: d.heroId,
          cx: d.cx,
          cy: d.cy,
          r: d.r,
          expiresAt: d.expiresAt
        })),
      /** Toujours présent : HUD display (mode / preset) pendant la partie */
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
    }
    return state;
  }

  /**
   * Marque l'état comme modifié. Appelé par les event handlers pour signaler
   * qu'une diffusion est nécessaire sans la déclencher immédiatement.
   * La game loop (GameLoopService) consomme ce flag via broadcastIfDirty().
   */
  markDirty() {
    this._stateDirty = true;
  }

  /**
   * Envoie l'état uniquement si markDirty() a été appelé depuis la dernière émission.
   * Appelé à 60 Hz par la game loop pour un flush rapide (< 16 ms après l'événement).
   */
  broadcastIfDirty() {
    if (!this._stateDirty) return;
    this.broadcastState();
  }

  /**
   * Sérialise et diffuse l'état complet à tous les clients.
   * Appelé à 30 Hz par la game loop (sync garantie) et via broadcastIfDirty().
   */
  broadcastState() {
    this._stateDirty = false;
    const fullState = this.buildState();
    if (this.hasDisplayClients()) {
      this.displayNamespace.emit('state_update', fullState);
    }
    // Mini état lobby pour les mobiles
    const lobbyPayload = {
      roundState: fullState.roundState,
      voteCounts: fullState.voteCounts,
      maps: fullState.maps,
      hostId: this.hostId,
      settings: fullState.settings,
      roomCode: this.roomCode,
      lockedHeroes: this.lockedHeroes,
      playerCount: this.playerService.getAll().length
    };
    this.mobileNamespace.emit('lobby_state', lobbyPayload);
  }

  syncHeroRoster() {
    this.mobileNamespace.emit('sync_roster', { lockedHeroes: this.lockedHeroes });
  }

  /** Wrapper public — délègue à HeroService */
  activateHeroPower(player, variant = 'A') {
    this.heroService.activateHeroPower(player, variant);
  }

}
