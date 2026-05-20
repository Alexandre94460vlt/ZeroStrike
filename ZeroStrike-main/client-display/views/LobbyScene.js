/**
 * LobbyScene - Menu hôte projecteur (thème minimaliste, aligné hub public).
 */
import QRCode from 'qrcode';
import { getOrCreateDisplaySocket, getMobileJoinUrlWithRoom } from '../services/SocketService.js';
import { runDisplayPasswordGate } from '../utils/displayAuthGate.js';
import * as AudioManager from '../utils/AudioManager.js';
import { loadDisplayPreferences, saveDisplayPreferences } from '../utils/displayPreferences.js';
import { sanitizeHudText } from '../utils/sanitizeDisplay.js';
import { applyDisplayStateDelta } from '../utils/mergeDisplayStateDelta.js';
import { applyPresetToSettings, PRESET_BUNDLES } from '../../shared/gamePresets.js';
import { UITheme, Palette } from '../config/uiTheme.js';

const MAX_PLAYERS = 40;

/** Payload strict pour update_settings (évite clés parasites / undefined). */
function buildSettingsServerPayload(state) {
  return {
    gamePreset: state.gamePreset || 'FUN',
    mode: state.mode === 'DM' ? 'DM' : 'SND',
    roundsToWin: Number(state.roundsToWin),
    roundDuration: Number(state.roundDuration),
    buyPhaseDuration: Number(state.buyPhaseDuration),
    bombTimer: Number(state.bombTimer),
    startingMoney: Number(state.startingMoney),
    dmKillLimit: Number(state.dmKillLimit),
    enablePowerUps: !!state.enablePowerUps
  };
}

/** Cartes votables (ids = server MAP_LIST) + clé texture preload BootScene map_lobby_* */
const VOTE_MAP_DEFS = [
  {
    id:       'dist2',
    name:     'DIST2',
    tag:      'SEARCH & DESTROY',
    thumbKey: 'map_lobby_dist2'
  },
  {
    id:       'ascension',
    name:     'ASCENSION',
    tag:      'SEARCH & DESTROY',
    thumbKey: 'map_lobby_ascension'
  },
  {
    id:       'maven',
    name:     'MAVEN',
    tag:      'SEARCH & DESTROY',
    thumbKey: 'map_lobby_maven'
  },
  {
    id:       'chadigo',
    name:     'CHADIGO',
    tag:      'SEARCH & DESTROY',
    thumbKey: 'map_lobby_chadigo'
  }
];

const BO2 = {
  text:       UITheme.text,
  white:      UITheme.white,
  gray:       UITheme.gray,
  orange:     UITheme.accent,
  orangeHex:  UITheme.accentHex,
  panelAlpha: UITheme.panelAlpha,
  fontTitle:  UITheme.fontTitle,
  fontUi:     UITheme.fontUi
};

/** Blanc pur lobby (le `white` du thème reste nacré ailleurs). */
const LOBBY_WHITE = Palette.white;

function applyShadow(obj) {
  if (obj.setShadow) obj.setShadow(2, 2, 'rgba(0,0,0,0.8)', 4);
}

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
  }

  create() {
    const { width, height } = this.cameras.main;
    this.registry.remove('lastDisplayGameState');
    this.lobbyState = { players: [], roundState: 'LOBBY', voteCounts: {}, maps: [] };
    this.mapBlocks = [];
    /** Réservé si un jour le display vote ; aujourd’hui vote uniquement sur mobile (panneau cartes visuel). */
    this.myDisplayVote = null;
    /** Compte à rebours 10→1 avant choix map : le panneau cartes affiche ça (plus de gros chiffre au centre). */
    this._prestartCountdownActive = false;
    this.chosenMapId = null;
    this.settingsOverlay = null;
    this.a11yOverlay = null;
    this.playerActionOverlay = null;
    this.startDeniedText = null;
    /** Messages mobiles (affichés ici uniquement, pas sur les autres manettes) */
    this.lobbyCommentFeed = [];
    this._lobbyCommentLineObjs = [];
    /** Dernier état « peut lancer » pour ne pas recâbler le bouton à chaque state_update */
    this._lastStartCanStart = undefined;
    this.leftMenu = null;
    this.settingsState = {
      mode: 'SND',
      ...PRESET_BUNDLES.FUN
    };
    this._lobbySettingsRefresh = null;

    const paddingLeft = 50;
    const paddingRight = 50;
    this.leftZoneWidth = width * 0.30;
    this.rightZoneWidth = 350;
    this.leftZoneX = paddingLeft;
    /** Bord gauche unique pour titre, menu et vote map (alignement visuel). */
    this.leftAlignX = this.leftZoneX;
    this.rightZoneX = width - paddingRight - this.rightZoneWidth;

    const dp = loadDisplayPreferences();
    AudioManager.setMasterVolume(dp.masterVolume);

    /* UI d’abord : un state_update Socket peut arriver tout de suite ; sinon updatePlayerList() lit des refs null. */
    this.showLobbyReturnReasonIfAny(width);
    this.drawBackground(width, height);
    this.drawVignette(width, height);
    this.drawTitle(width, height);
    this.drawLeftMenu(width, height);
    this.drawPlayerList(width, height);
    this.drawMapVoteBlocks(width, height);
    this.drawMobileUrl(width, height);
    this.connectSocket(width, height);
    this.updatePlayerList();

    this._onLobbyResize = (gameSize) => {
      const cam = this.cameras?.main;
      const w = gameSize?.width ?? cam?.width ?? this.scale.width;
      const h = gameSize?.height ?? cam?.height ?? this.scale.height;
      this._resizeLobbyBackground(w, h);
    };
    this.scale.off('resize', this._onLobbyResize);
    this.scale.on('resize', this._onLobbyResize);
    this._resizeLobbyBackground(width, height);
  }

  drawVignette(width, height) {
    const g = this.add.graphics().setDepth(5);
    /* Teinte chaude très légère sur la vidéo (éviter saturation orange type « filtre »). */
    const tint = this.add.rectangle(width / 2, height / 2, width + 200, height + 200, 0x0c0a08, 0.12).setDepth(5);
    this._vignetteGfx = g;
    this._vignetteTint = tint;
    this._resizeLobbyBackground(width, height);
  }

  _resizeLobbyBackground(width, height) {
    if (!this.cameras?.main) return;
    if (this._vignetteGfx) {
      this._vignetteGfx.clear();
      this._vignetteGfx.fillStyle(0x000000, 0.5);
      this._vignetteGfx.fillRect(0, 0, width, height);
    }
    if (this._vignetteTint && !this._vignetteTint.destroyed && this._vignetteTint.scene) {
      this._vignetteTint.setPosition(width / 2, height / 2);
      this._vignetteTint.setSize(width + 200, height + 200);
    }
    if (this._lobbyBgVideo) {
      this._lobbyBgVideo.setPosition(width / 2, height / 2);
      const el = this._lobbyBgVideo.getVideo ? this._lobbyBgVideo.getVideo() : this._lobbyBgVideo.video;
      const vw = el?.videoWidth || width;
      const vh = el?.videoHeight || height;
      const scale = Math.max(width / vw, height / vh);
      this._lobbyBgVideo.setDisplaySize(vw * scale, vh * scale);
    }
    if (this._lobbyCommentLineObjs?.length) {
      this._lobbyCommentLineObjs.forEach((line, i) => {
        line.setPosition(width - 14, height - 20 - i * 22);
      });
    }
  }

  connectSocket(width, height) {
    this.socket = getOrCreateDisplaySocket(this.registry);
    this._enteringGameScene = false;

    const bindLobbySocketHandlers = () => {
      this.registry.set('displayGatePassed', true);
      this.socket.off('map_data');
      this.socket.on('map_data', (data) => {
        if (!data?.mapId || !data.walls?.length) {
          console.error('[LobbyScene] map_data rejeté : mapId et walls requis', data);
          return;
        }
        this.registry.set('mapData', data);
        this._tryEnterGameSceneAfterMapChoice();
      });
      // Enregistrer tout de suite (avant state_update) : évite de rater game_starting si l’événement
      // arrive pendant le reste de create() (lourd) ou si le paquet est perdu côté client.
      this.setupGameStartListeners();
      this.socket.off('state_update');
      this.socket.on('state_update', (state) => {
        const prev = this.registry.get('lastDisplayGameState') || null;
        const merged = applyDisplayStateDelta(prev, state);
        if (!merged) return;
        this.registry.set('lastDisplayGameState', merged);
        this.lobbyState = merged;
        // Synchroniser les paramètres avec le serveur — sauf si le panneau est ouvert (sinon chaque
        // state_update ~30 Hz écrase S&D/DM et les champs avant « APPLIQUER »).
        if (merged.settings && !this.settingsOverlay) {
          Object.assign(this.settingsState, merged.settings);
          if (this._lobbySettingsRefresh) this._lobbySettingsRefresh();
        }
        if (merged.roundState === 'LOBBY' && merged.roomCode) {
          const cam = this.cameras?.main;
          if (cam) this.syncLobbyRoomJoin(merged.roomCode, cam.width, cam.height);
        }
        if (this.playerListTitle) this.updatePlayerList();
        if (this.mapBlocks.length) this.updateMapVoteCounts(merged.voteCounts || {});
        if (this.voteCountdownText && !this._prestartCountdownActive) {
          const sec = merged.voteTimeLeft;
          const label = sec != null && Number.isFinite(sec)
            ? String(Math.max(0, Math.ceil(sec)))
            : '—';
          this.voteCountdownText.setText(`TEMPS RESTANT: ${label}`);
        }
        if (this.settingsOverlay && merged.roundState !== 'LOBBY') {
          this.closeSettings();
        }
        if (this.a11yOverlay && merged.roundState !== 'LOBBY') {
          this.closeAccessibility();
        }
        this.maybeEnterGameSceneFromServerState(merged);
      });

      this.socket.off('start_denied');
      this.socket.on('start_denied', (data) => {
        const r = data?.ready ?? 0;
        const req = data?.required ?? 0;
        this.showStartDenied(`JOUEURS PRÊTS: ${r}/${req} — TOUS DOIVENT ÊTRE PRÊTS`);
      });

      this.socket.off('player_comment');
      this.socket.on('player_comment', ({ name, text }) => {
        const n = sanitizeHudText(String(name ?? ''), 28);
        const t = sanitizeHudText(String(text ?? ''), 72);
        if (!t) return;
        this.lobbyCommentFeed.unshift({ name: n, text: t });
        if (this.lobbyCommentFeed.length > 5) this.lobbyCommentFeed.pop();
        this.refreshLobbyCommentFeed();
      });
    };

    if (this.registry.get('displayGatePassed')) {
      bindLobbySocketHandlers();
      return;
    }

    const afterAuthStatus = (msg) => {
      if (!msg?.required || msg.authed) {
        bindLobbySocketHandlers();
        return;
      }
      runDisplayPasswordGate(
        (password) =>
          new Promise((resolve) => {
            this.socket.emit('display_login', { password }, (r) => {
              resolve({ ok: !!r?.ok, error: r?.error });
            });
          })
      )
        .then(() => {
          bindLobbySocketHandlers();
        })
        .catch(() => {
          /* Annulation : pas de handlers réseau tant que la page n’est pas rechargée. */
        });
    };

    this.socket.once('display_auth_status', afterAuthStatus);
    const requestStatus = () => this.socket.emit('display_request_auth_status');
    requestStatus();
    if (!this.socket.connected) {
      this.socket.once('connect', requestStatus);
    }
  }

  refreshLobbyCommentFeed() {
    const cam = this.cameras?.main;
    if (!cam) return;
    const { width, height } = cam;
    if (!this._lobbyCommentLineObjs.length) {
      for (let i = 0; i < 5; i++) {
        const line = this.add.text(width - 14, height - 20 - i * 22, '', {
          fontSize: '14px',
          fontFamily: BO2.fontUi,
          color: LOBBY_WHITE,
          stroke: '#000000',
          strokeThickness: 3
        }).setOrigin(1, 1).setDepth(92);
        applyShadow(line);
        this._lobbyCommentLineObjs.push(line);
      }
    }
    this._lobbyCommentLineObjs.forEach((line, i) => {
      const e = this.lobbyCommentFeed[i];
      line.setText(e ? `${e.name}: ${e.text}` : '');
    });
  }

  /**
   * Après `back_to_lobby`, le jeu enregistre `lobbyReturnReason` dans le registry (voir controllers/gameSocketController.js).
   */
  showLobbyReturnReasonIfAny(width) {
    const reason = this.registry.get('lobbyReturnReason');
    this.registry.remove('lobbyReturnReason');
    if (!reason) return;
    const messages = {
      display_disconnect:
        'Grand écran déconnecté trop longtemps — partie annulée. Gardez un seul onglet /display ouvert.',
      no_players: 'Tous les joueurs ont quitté — retour au salon.',
      match_over: 'Fin du match — vous pouvez relancer une partie.',
      host_menu: 'Retour au salon (bouton Quitter).',
      mobile_host: 'Retour au salon demandé depuis la manette hôte.',
      host: 'Retour au salon.',
      unknown: 'Retour au salon.'
    };
    const text = messages[reason] || messages.unknown;
    const banner = this.add
      .text(width / 2, 56, text, {
        fontSize: '18px',
        fontFamily: BO2.fontUi,
        color: LOBBY_WHITE,
        align: 'center',
        wordWrap: { width: width - 80 }
      })
      .setOrigin(0.5, 0)
      .setDepth(250);
    applyShadow(banner);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 7000,
      duration: 2200,
      onComplete: () => {
        try {
          banner.destroy();
        } catch {
          /* */
        }
      }
    });
  }

  showStartDenied(msg) {
    const cam = this.cameras?.main;
    if (!cam) return;
    const { width } = cam;
    if (!this.startDeniedText) {
      this.startDeniedText = this.add.text(width / 2, 112, '', {
        fontSize: '20px',
        fontFamily: BO2.fontUi,
        color: LOBBY_WHITE
      }).setOrigin(0.5, 0.5).setDepth(90);
      applyShadow(this.startDeniedText);
    }
    this.startDeniedText.setText(String(msg || ''));
    this.startDeniedText.setAlpha(1);
    this.tweens.killTweensOf(this.startDeniedText);
    this.tweens.add({
      targets: this.startDeniedText,
      alpha: 0,
      duration: 1800,
      ease: 'Sine.easeOut',
      delay: 900
    });
  }

  /**
   * Bascule vers GameScene (une seule fois). Utilisé par game_starting et en secours par state_update.
   */
  goToGameSceneFromLobby() {
    if (this._enteringGameScene) return;
    this._enteringGameScene = true;
    this._prestartCountdownActive = false;
    this.socket.off('countdown');
    this.socket.off('map_chosen');
    this.socket.off('game_starting');
    this.socket.off('player_comment');
    try {
      this.scene.start('GameScene');
    } catch (err) {
      console.error('[LobbyScene] Échec lancement GameScene:', err);
      this._enteringGameScene = false;
    }
  }

  /** Si game_starting a été manqué, le premier state en phase de manche suffit à ouvrir la vue jeu. */
  maybeEnterGameSceneFromServerState(state) {
    const rs = state?.roundState;
    if (rs !== 'BUY_PHASE' && rs !== 'ACTION_PHASE' && rs !== 'ROUND_END') return;
    this.goToGameSceneFromLobby();
  }

  setupGameStartListeners() {
    this.socket.off('countdown');
    this.socket.off('map_chosen');
    this.socket.off('game_starting');
    this.socket.on('countdown', (n) => this.showCountdown(n));
    this.socket.on('map_chosen', (data) => this.onMapChosen(data));
    this.socket.on('game_starting', () => this.goToGameSceneFromLobby());
  }

  drawBackground(width, height) {
    const setVideoCover = (vid, vw, vh) => {
      const w = vw || (vid.getVideo && vid.getVideo().videoWidth) || width;
      const h = vh || (vid.getVideo && vid.getVideo().videoHeight) || height;
      const scale = Math.max(width / w, height / h);
      vid.setDisplaySize(w * scale, h * scale);
    };
    const setupLoop = (vid) => {
      const el = vid.getVideo ? vid.getVideo() : vid.video;
      if (el) el.loop = true;
      vid.on('complete', () => vid.play(true));
    };

    // Vidéo préchargée (BootScene)
    const videoKey = this.registry.get('lobbyVideoKey');
    if (videoKey && this.cache.video.exists(videoKey)) {
      const vid = this.add.video(width / 2, height / 2, videoKey).setDepth(-1);
      this._lobbyBgVideo = vid;
      vid.setMute(true);
      vid.on(Phaser.GameObjects.Events.VIDEO_CREATED, (video, vw, vh) => {
        setVideoCover(video, vw, vh);
        setupLoop(video);
      });
      vid.on(Phaser.GameObjects.Events.VIDEO_METADATA, (video, w, h) => {
        if (w && h) setVideoCover(video, w, h);
      });
      vid.on(Phaser.GameObjects.Events.VIDEO_ERROR, () => {
        // Si la vidéo échoue (rare), on reste sur fond noir (pas de fallback visuel).
        try { vid.destroy(); } catch {}
      });
      setupLoop(vid);
      vid.play(true);
      const el = vid.getVideo ? vid.getVideo() : vid.video;
      if (el && el.videoWidth) setVideoCover(vid, el.videoWidth, el.videoHeight);
      else this.time.delayedCall(200, () => {
        const e = vid.getVideo ? vid.getVideo() : vid.video;
        if (e && e.videoWidth && vid.scene) setVideoCover(vid, e.videoWidth, e.videoHeight);
      });
      return;
    }

    // Vidéo via loadURL (si préload a échoué)
    const videoUrl = this.registry.get('lobbyVideoUrl');
    if (videoUrl) {
      const vid = this.add.video(width / 2, height / 2).setDepth(-1);
      this._lobbyBgVideo = vid;
      vid.setMute(true);
      vid.on(Phaser.GameObjects.Events.VIDEO_CREATED, (video, vw, vh) => {
        setVideoCover(video, vw, vh);
        setupLoop(video);
        video.play(true);
      });
      vid.on(Phaser.GameObjects.Events.VIDEO_ERROR, () => {
        try { vid.destroy(); } catch {}
      });
      vid.loadURL(videoUrl, true);
      return;
    }
  }

  drawTitle(width, height) {
    const x = this.leftAlignX;
    const y = 48;
    const titleFont = { fontSize: '52px', fontFamily: BO2.fontTitle };

    // Même ligne, même taille : « ZERO STRIKE / » + « CODE … » (code mis à jour via state_update)
    const prefixStr = 'ZERO STRIKE / ';
    const tPrefix = this.add.text(x, y, prefixStr, {
      ...titleFont,
      color: LOBBY_WHITE
    }).setOrigin(0, 0).setDepth(10);
    applyShadow(tPrefix);

    // Dégradé uniquement sur le préfixe (le code reste blanc franc)
    try {
      const ctx = tPrefix.context;
      if (ctx && typeof ctx.createLinearGradient === 'function') {
        const g = ctx.createLinearGradient(0, 0, Math.max(1, tPrefix.width), 0);
        g.addColorStop(0, LOBBY_WHITE);
        g.addColorStop(0.18, '#FFF6F0');
        g.addColorStop(0.42, '#FFC9A8');
        g.addColorStop(0.68, Palette.orangeVivid);
        g.addColorStop(1, Palette.orangeBurnt);
        tPrefix.setFill(g);
        tPrefix.updateText();
      }
    } catch {
      tPrefix.setColor(LOBBY_WHITE);
    }

    this._lobbyTitlePrefix = tPrefix;
    this.lobbyRoomCodeText = this.add.text(x + tPrefix.width, y, 'CODE ···', {
      ...titleFont,
      color: LOBBY_WHITE
    }).setOrigin(0, 0).setDepth(10);
    applyShadow(this.lobbyRoomCodeText);
  }

  drawLeftMenu(width, height) {
    const ax = this.leftAlignX;
    const gap = 12;
    const triSize = 8;
    const triX = ax - triSize - gap;
    let y = 140;

    const items = [
      { key: 'start', label: 'LANCER LA PARTIE', action: () => this.startGame() },
      { key: 'params', label: 'PARAMÈTRES', action: () => this.openSettings(width, height) },
      { key: 'a11y', label: 'AFFICHAGE & AUDIO', action: () => this.openAccessibilitySettings(width, height) },
      { key: 'leaderboard', label: 'CLASSEMENT', action: () => this.openLeaderboard(width, height) }
    ];

    this.leftMenu = {};
    items.forEach((item) => {
      const tri = this.add.graphics().setDepth(11);
      tri.fillStyle(BO2.orangeHex, 1);
      tri.fillTriangle(0, -4, triSize, -4, triSize / 2, 4);
      tri.setPosition(triX, y).setVisible(false);
      const text = this.add.text(ax, y, item.label, {
        fontSize: '32px',
        fontFamily: BO2.fontUi,
        color: LOBBY_WHITE
      }).setOrigin(0, 0.5).setDepth(11);
      applyShadow(text);

      // Hitbox = triangle + libellé (+ petite marge), pas toute la colonne gauche
      const zonePadR = 14;
      const zoneW = (ax - triX) + text.width + zonePadR;
      const zone = this.add.rectangle(triX, y, zoneW, 40, 0x000000, 0)
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .setDepth(10);
      zone.on('pointerover', () => {
        tri.setVisible(true);
        text.setColor(BO2.orange);
      });
      zone.on('pointerout', () => {
        tri.setVisible(false);
        text.setColor(LOBBY_WHITE);
      });
      if (item.action) zone.on('pointerdown', item.action);
      this.leftMenu[item.key] = { tri, text, zone };
      y += 48;
    });
  }

  openAccessibilitySettings(width, height) {
    if (this.a11yOverlay || !this.socket) return;
    if (this.settingsOverlay) this.closeSettings();

    const prefs = loadDisplayPreferences();
    let vol = prefs.masterVolume;
    let reduce = prefs.reduceVisualEffects;
    let room = prefs.roomMode;

    const container = this.add.container(width / 2, height / 2).setDepth(85);
    const bg = this.add.rectangle(0, 0, 460, 320, 0x000000, 0.93).setStrokeStyle(2, BO2.orangeHex, 1);
    container.add(bg);

    const title = this.add.text(0, -128, 'AFFICHAGE & AUDIO', {
      fontSize: '26px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setOrigin(0.5, 0.5);
    applyShadow(title);
    container.add(title);

    const cbY = -68;
    const cb = this.add.rectangle(-200, cbY, 18, 18, 0x111111, 1).setOrigin(0, 0.5).setStrokeStyle(1, 0xffffff, 0.3);
    cb.setInteractive({ useHandCursor: true });
    const cbMark = this.add.text(-200 + 9, cbY, '✓', {
      fontSize: '16px',
      fontFamily: BO2.fontUi,
      color: BO2.orange
    }).setOrigin(0.5, 0.5);
    cbMark.setVisible(reduce);
    cb.on('pointerdown', () => {
      reduce = !reduce;
      cbMark.setVisible(reduce);
    });
    const cbLabel = this.add.text(-175, cbY, 'Réduire flashs, particules et secousses', {
      fontSize: '16px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setOrigin(0, 0.5);
    applyShadow(cbLabel);
    container.add([cb, cbMark, cbLabel]);

    const roomY = -28;
    const cbR = this.add.rectangle(-200, roomY, 18, 18, 0x111111, 1).setOrigin(0, 0.5).setStrokeStyle(1, 0xffffff, 0.3);
    cbR.setInteractive({ useHandCursor: true });
    const cbRMark = this.add.text(-200 + 9, roomY, '✓', {
      fontSize: '16px',
      fontFamily: BO2.fontUi,
      color: BO2.orange
    }).setOrigin(0.5, 0.5);
    cbRMark.setVisible(room);
    cbR.on('pointerdown', () => {
      room = !room;
      cbRMark.setVisible(room);
    });
    const cbRLabel = this.add.text(-175, roomY, 'Mode salle (vidéoprojecteur) — vignette légère, sans assombrissement MULTIPLY', {
      fontSize: '14px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE,
      wordWrap: { width: 360 }
    }).setOrigin(0, 0.5);
    applyShadow(cbRLabel);
    container.add([cbR, cbRMark, cbRLabel]);

    const barW = 260;
    const barY = 52;
    const bar = this.add.rectangle(0, barY, barW, 16, 0x222222, 1).setInteractive({ useHandCursor: true });
    const fill = this.add.rectangle(-barW / 2, barY, Math.max(8, vol * barW), 16, BO2.orangeHex).setOrigin(0, 0.5);
    const volHint = this.add.text(0, 18, 'Volume effets sonores', {
      fontSize: '15px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setOrigin(0.5, 0.5);
    applyShadow(volHint);
    const volText = this.add.text(0, 82, `${Math.round(vol * 100)} %`, {
      fontSize: '20px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setOrigin(0.5, 0.5);
    applyShadow(volText);
    container.add([volHint, bar, fill, volText]);

    const applyVolFromPointer = (pointer) => {
      const lp = container.getLocalPoint(pointer.x, pointer.y);
      vol = Phaser.Math.Clamp((lp.x + barW / 2) / barW, 0, 1);
      fill.width = Math.max(8, vol * barW);
      volText.setText(`${Math.round(vol * 100)} %`);
    };
    bar.on('pointerdown', (p) => applyVolFromPointer(p));
    bar.on('pointermove', (p) => {
      if (p.isDown) applyVolFromPointer(p);
    });

    const btnY = 128;
    const makeA11yBtn = (label, offsetX, onClick) => {
      const bw = 130;
      const bh = 34;
      const btnBg = this.add.rectangle(offsetX, btnY, bw, bh, 0x111111, 1).setOrigin(0.5, 0.5);
      btnBg.setStrokeStyle(2, BO2.orangeHex, 0.85);
      const btnText = this.add.text(offsetX, btnY, label, {
        fontSize: '17px',
        fontFamily: BO2.fontUi,
        color: LOBBY_WHITE
      }).setOrigin(0.5, 0.5);
      applyShadow(btnText);
      btnBg.setInteractive({ useHandCursor: true });
      btnBg.on('pointerover', () => btnBg.setFillStyle(0x222222, 1));
      btnBg.on('pointerout', () => btnBg.setFillStyle(0x111111, 1));
      btnBg.on('pointerdown', onClick);
      container.add([btnBg, btnText]);
    };

    makeA11yBtn('FERMER', -80, () => this.closeAccessibility());
    makeA11yBtn('ENREGISTRER', 90, () => {
      saveDisplayPreferences({ reduceVisualEffects: reduce, roomMode: room, masterVolume: vol });
      AudioManager.setMasterVolume(vol);
      this.closeAccessibility();
    });

    this.a11yOverlay = container;
  }

  closeAccessibility() {
    if (!this.a11yOverlay) return;
    this.a11yOverlay.destroy(true);
    this.a11yOverlay = null;
  }

  openSettings(width, height) {
    if (this.settingsOverlay || !this.socket) return;
    if (this.a11yOverlay) this.closeAccessibility();
    const w = Math.max(this.leftZoneWidth + 260, 540);
    const h = 530;
    const x = this.leftZoneX + w / 2;
    const y = height / 2;

    const container = this.add.container(x, y).setDepth(80);
    const bg = this.add.rectangle(0, 0, w, h, 0x000000, 0.9);
    bg.setStrokeStyle(2, BO2.orangeHex, 1);
    container.add(bg);

    const title = this.add.text(0, -h / 2 + 22, 'PARAMÈTRES DE PARTIE', {
      fontSize: '24px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setOrigin(0.5, 0.5);
    applyShadow(title);
    container.add(title);

    const labelConfig = { fontSize: '16px', fontFamily: BO2.fontUi, color: LOBBY_WHITE };
    const inputBgColor = 0x111111;
    const presetDefs = [
      { id: 'FUN', label: 'FUN' },
      { id: 'COMPETE', label: 'COMPÈTE' },
      { id: 'DEMO_BUT', label: 'DÉMO BUT' },
      { id: 'CUSTOM', label: 'PERSO' }
    ];
    const modeDefs = [
      { id: 'SND', label: 'S&D' },
      { id: 'DM', label: 'DM' }
    ];
    const presetButtons = [];
    const modeButtons = [];

    const startY = -h / 2 + 124;
    const lineH = 36;

    const fields = [
      { key: 'roundsToWin', label: 'Manches pour gagner (BO)', min: 1, max: 15, step: 1 },
      { key: 'roundDuration', label: 'Durée manche (s)', min: 30, max: 300, step: 5 },
      { key: 'buyPhaseDuration', label: 'Durée achat (s)', min: 0, max: 60, step: 5 },
      { key: 'bombTimer', label: 'Timer bombe (s)', min: 10, max: 90, step: 5 },
      { key: 'startingMoney', label: 'Argent départ', min: 0, max: 16000, step: 250 },
      { key: 'dmKillLimit', label: 'DM : frags/manche (0 = timer)', min: 0, max: 200, step: 5 }
    ];

    const inputRefs = {};

    const syncPresetStrokes = () => {
      presetButtons.forEach((pb, j) => {
        const on = this.settingsState.gamePreset === presetDefs[j].id;
        pb.bg.setStrokeStyle(2, on ? BO2.orangeHex : 0x444444, on ? 1 : 0.6);
      });
    };

    const syncModeStrokes = () => {
      const m = this.settingsState.mode === 'DM' ? 'DM' : 'SND';
      modeButtons.forEach((mb, j) => {
        const on = m === modeDefs[j].id;
        mb.bg.setStrokeStyle(2, on ? BO2.orangeHex : 0x444444, on ? 1 : 0.6);
      });
    };

    const bumpField = (f, sign) => {
      const step = f.step || 1;
      let v = Number(this.settingsState[f.key]) + sign * step;
      v = Math.max(f.min, Math.min(f.max, Math.floor(v)));
      this.settingsState[f.key] = v;
      this.settingsState.gamePreset = 'CUSTOM';
      const ref = inputRefs[f.key];
      if (ref && ref.text) ref.text.setText(String(v));
      syncPresetStrokes();
    };

    const makeStepBtn = (cx, fy, sym, onClick) => {
      const btnW = 28;
      const btnH = 24;
      const btnBg = this.add.rectangle(cx, fy, btnW, btnH, 0x1a1a1a, 1).setOrigin(0.5, 0.5);
      btnBg.setStrokeStyle(1, 0xffffff, 0.25);
      const t = this.add.text(cx, fy, sym, {
        fontSize: '16px',
        fontFamily: BO2.fontUi,
        color: LOBBY_WHITE
      }).setOrigin(0.5, 0.5);
      applyShadow(t);
      btnBg.setInteractive({ useHandCursor: true });
      btnBg.on('pointerover', () => { btnBg.setFillStyle(0x2a2a2a, 1); });
      btnBg.on('pointerout', () => { btnBg.setFillStyle(0x1a1a1a, 1); });
      btnBg.on('pointerdown', onClick);
      container.add(btnBg);
      container.add(t);
    };

    fields.forEach((f, idx) => {
      const fy = startY + idx * lineH;
      const label = this.add.text(-w / 2 + 16, fy, f.label, labelConfig).setOrigin(0, 0.5);
      applyShadow(label);
      container.add(label);

      const valW = 52;
      const gap = 6;
      const rightPad = 14;
      const plusX = w / 2 - rightPad - 14;
      const valX = plusX - gap - 14 - valW / 2;
      const minusX = valX - valW / 2 - gap - 14;

      makeStepBtn(minusX, fy, '−', () => bumpField(f, -1));
      makeStepBtn(plusX, fy, '+', () => bumpField(f, 1));

      const box = this.add.rectangle(valX, fy, valW, 26, inputBgColor, 1).setOrigin(0.5, 0.5);
      box.setStrokeStyle(1, 0xffffff, 0.2);
      container.add(box);

      const text = this.add.text(box.x, box.y, String(this.settingsState[f.key]), {
        fontSize: '15px',
        fontFamily: BO2.fontUi,
        color: LOBBY_WHITE
      }).setOrigin(0.5, 0.5);
      applyShadow(text);
      container.add(text);

      inputRefs[f.key] = { box, text };
    });

    const powerY = startY + fields.length * lineH + 4;
    const cbSize = 18;
    const cb = this.add.rectangle(-w / 2 + 24, powerY, cbSize, cbSize, 0x111111, 1).setOrigin(0, 0.5);
    cb.setStrokeStyle(1, 0xffffff, 0.3);
    container.add(cb);
    const cbMark = this.add.text(cb.x + cbSize / 2, powerY, '✓', {
      fontSize: '16px',
      fontFamily: BO2.fontUi,
      color: BO2.orange
    }).setOrigin(0.5, 0.5);
    cbMark.setVisible(this.settingsState.enablePowerUps);
    container.add(cbMark);

    const cbLabel = this.add.text(cb.x + cbSize + 8, powerY, 'Power-ups fun', labelConfig).setOrigin(0, 0.5);
    applyShadow(cbLabel);
    container.add(cbLabel);

    cb.setInteractive({ useHandCursor: true });
    cb.on('pointerdown', () => {
      this.settingsState.enablePowerUps = !this.settingsState.enablePowerUps;
      this.settingsState.gamePreset = 'CUSTOM';
      cbMark.setVisible(this.settingsState.enablePowerUps);
      syncPresetStrokes();
    });

    const refreshFieldTexts = () => {
      for (const f of fields) {
        const ref = inputRefs[f.key];
        if (ref && ref.text) ref.text.setText(String(this.settingsState[f.key]));
      }
      cbMark.setVisible(this.settingsState.enablePowerUps);
      syncModeStrokes();
    };

    const modeLabel = this.add.text(-w / 2 + 16, -h / 2 + 52, 'Mode jeu', {
      fontSize: '14px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setOrigin(0, 0.5);
    applyShadow(modeLabel);
    container.add(modeLabel);

    const modeBtnW = 88;
    const modeBtnH = 28;
    const modeGap = 8;
    const modeRowW = modeDefs.length * modeBtnW + modeGap;
    const modeStartX = -modeRowW / 2 + modeBtnW / 2;
    modeDefs.forEach((md, i) => {
      const bx = modeStartX + i * (modeBtnW + modeGap);
      const by = -h / 2 + 52;
      const btnBg = this.add.rectangle(bx, by, modeBtnW, modeBtnH, 0x151515, 1).setOrigin(0.5, 0.5);
      const active = (this.settingsState.mode === 'DM' ? 'DM' : 'SND') === md.id;
      btnBg.setStrokeStyle(2, active ? BO2.orangeHex : 0x444444, active ? 1 : 0.6);
      const btnText = this.add.text(bx, by, md.label, {
        fontSize: '13px',
        fontFamily: BO2.fontUi,
        color: LOBBY_WHITE
      }).setOrigin(0.5, 0.5);
      applyShadow(btnText);
      btnBg.setInteractive({ useHandCursor: true });
      btnBg.on('pointerover', () => {
        if ((this.settingsState.mode === 'DM' ? 'DM' : 'SND') !== md.id) btnBg.setFillStyle(0x222222, 1);
      });
      btnBg.on('pointerout', () => {
        btnBg.setFillStyle(0x151515, 1);
      });
      btnBg.on('pointerdown', () => {
        this.settingsState.mode = md.id;
        syncModeStrokes();
      });
      container.add(btnBg);
      container.add(btnText);
      modeButtons.push({ bg: btnBg, id: md.id });
    });

    const presetLabel = this.add.text(-w / 2 + 16, -h / 2 + 88, 'Profil', {
      fontSize: '14px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setOrigin(0, 0.5);
    applyShadow(presetLabel);
    container.add(presetLabel);

    const presetBtnW = 108;
    const presetBtnH = 28;
    const presetGap = 8;
    const presetRowW = presetDefs.length * presetBtnW + (presetDefs.length - 1) * presetGap;
    const presetStartX = -presetRowW / 2 + presetBtnW / 2;
    presetDefs.forEach((pd, i) => {
      const bx = presetStartX + i * (presetBtnW + presetGap);
      const by = -h / 2 + 88;
      const btnBg = this.add.rectangle(bx, by, presetBtnW, presetBtnH, 0x151515, 1).setOrigin(0.5, 0.5);
      const active = this.settingsState.gamePreset === pd.id;
      btnBg.setStrokeStyle(2, active ? BO2.orangeHex : 0x444444, active ? 1 : 0.6);
      const btnText = this.add.text(bx, by, pd.label, {
        fontSize: '13px',
        fontFamily: BO2.fontUi,
        color: LOBBY_WHITE
      }).setOrigin(0.5, 0.5);
      applyShadow(btnText);
      btnBg.setInteractive({ useHandCursor: true });
      btnBg.on('pointerover', () => {
        if (this.settingsState.gamePreset !== pd.id) btnBg.setFillStyle(0x222222, 1);
      });
      btnBg.on('pointerout', () => {
        btnBg.setFillStyle(0x151515, 1);
      });
      btnBg.on('pointerdown', () => {
        applyPresetToSettings(this.settingsState, pd.id);
        this.socket.emit('update_settings', buildSettingsServerPayload(this.settingsState));
        syncPresetStrokes();
        refreshFieldTexts();
      });
      container.add(btnBg);
      container.add(btnText);
      presetButtons.push({ bg: btnBg, id: pd.id });
    });

    const btnY = h / 2 - 28;
    const makeButton = (label, offsetX, onClick) => {
      const bw = 120;
      const bh = 32;
      const btnBg = this.add.rectangle(offsetX, btnY, bw, bh, 0x111111, 1).setOrigin(0.5, 0.5);
      btnBg.setStrokeStyle(2, BO2.orangeHex, 0.8);
      const btnText = this.add.text(offsetX, btnY, label, {
        fontSize: '18px',
        fontFamily: BO2.fontUi,
        color: LOBBY_WHITE
      }).setOrigin(0.5, 0.5);
      applyShadow(btnText);
      btnBg.setInteractive({ useHandCursor: true });
      btnBg.on('pointerover', () => { btnBg.setFillStyle(0x222222, 1); });
      btnBg.on('pointerout', () => { btnBg.setFillStyle(0x111111, 1); });
      btnBg.on('pointerdown', onClick);
      container.add(btnBg);
      container.add(btnText);
    };

    makeButton('ANNULER', -70, () => this.closeSettings());
    makeButton('APPLIQUER', 70, () => {
      this.socket.emit('update_settings', buildSettingsServerPayload(this.settingsState));
      this.closeSettings();
    });

    this._lobbySettingsRefresh = () => {
      refreshFieldTexts();
      syncPresetStrokes();
    };

    this.settingsOverlay = container;
  }

  closeSettings() {
    if (!this.settingsOverlay) return;
    this.settingsOverlay.destroy(true);
    this.settingsOverlay = null;
    this._lobbySettingsRefresh = null;
  }

  drawPlayerList(width, height) {
    const listX = this.rightZoneX;
    const listY = 100;
    const listW = 350;
    const listH = height - 220;
    // Objectif UX: cellules visibles uniquement si joueurs présents.
    // On conserve un max 40 joueurs, mais on n'affiche pas 40 lignes vides.
    const rowHeight = 30;
    const emptyRowCount = 0;

    this.playerListTitle = this.add.text(listX, listY, '0 Joueurs (40 Max)', {
      fontSize: '22px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setDepth(10);
    applyShadow(this.playerListTitle);

    const panelBg = this.add.rectangle(
      listX + listW / 2,
      listY + 24 + (emptyRowCount * rowHeight) / 2,
      listW,
      emptyRowCount * rowHeight + 8,
      0x000000,
      0.7
    ).setOrigin(0.5, 0).setDepth(9);
    this.playerListPanelBg = panelBg;

    this.playerListContainer = this.add.container(listX, listY + 44);
    this.playerListContainer.setDepth(10);
    this.playerListLines = [];
    this.playerListRowHeight = rowHeight;
    this.playerListWidth = listW;
    this.playerListMaxH = listH;
    this.playerListEmptyRows = emptyRowCount;
  }

  updatePlayerList() {
    if (!this.playerListTitle || !this.playerListPanelBg || this.playerListPanelBg.destroyed) return;
    if (!this.playerListContainer || this.playerListContainer.destroyed) return;

    const state = this.lobbyState;
    const players = state.players || [];
 
    const hostId = state.hostId || null;
    const requiredPlayers = players.filter(p => p && p.id !== hostId);
    const required = requiredPlayers.length;
    const ready = requiredPlayers.filter(p => p && p.isReady).length;
    const canStart = state.roundState === 'LOBBY' && players.length >= 2 && ready >= required;
 
    this.playerListTitle.setText(
      `${players.length} Joueurs (40 Max)  —  PRÊTS: ${ready}/${required}`
    );
    this.refreshStartButton(canStart);

    this.playerListContainer.removeAll(true);
    this.playerListLines = [];
    const listW = this.playerListWidth;
    const rowCount = Math.min(MAX_PLAYERS, players.length);
    // Ajuster la hauteur des cellules selon le nombre de joueurs affichés (reste facilement cliquable).
    const rowHeight = Math.max(20, Math.min(30, Math.floor((this.playerListMaxH || 400) / Math.max(1, rowCount))));
    this.playerListRowHeight = rowHeight;

    // 0 joueur => 0 cellule visible
    if (rowCount === 0) {
      this.playerListPanelBg.setVisible(false);
      return;
    }
    this.playerListPanelBg.setVisible(true);
    // Ajuster le fond pour couvrir exactement les lignes visibles
    const listY = 100;
    this.playerListPanelBg.setPosition(this.rightZoneX + listW / 2, listY + 24 + (rowCount * rowHeight) / 2);
    this.playerListPanelBg.setSize(listW, rowCount * rowHeight + 8);

    for (let i = 0; i < rowCount; i++) {
      const y = i * rowHeight;
      const g = this.add.graphics();
      g.fillStyle(Palette.orangeBurntHex, 0.07);
      g.fillRect(0, y, listW, rowHeight);
      g.fillStyle(0x2a2826, 0.35);
      g.fillRect(0, y, listW, rowHeight);
      g.lineStyle(1, 0x555555, 0.2);
      g.lineBetween(0, y + rowHeight, listW, y + rowHeight);
      this.playerListContainer.add(g);

      const p = players[i];
      if (p) {
        const isHost = state.hostId ? p.id === state.hostId : i === 0;
        const nameColor = isHost ? BO2.orange : LOBBY_WHITE;
        const label = (p.team === 'ATT' ? 'ATT' : (p.team === 'DEF' ? 'DEF' : ''));
        const name = (p.name || 'Joueur').toUpperCase();
        const leftText = label ? `[${label}] ` : '';
        const score = (p.score != null ? p.score : (p.ping != null ? p.ping : 0)).toString();
        const readyDotColor = p.isReady ? '#44ff88' : '#666666';

        // Indicateur prêt (●)
        const dot = this.add.text(8, y + rowHeight / 2, '●', {
          fontSize: '16px',
          fontFamily: BO2.fontUi,
          color: readyDotColor
        }).setOrigin(0, 0.5);
        applyShadow(dot);

        const leftPart = this.add.text(8, y + rowHeight / 2, leftText, {
          fontSize: '16px',
          fontFamily: BO2.fontUi,
          color: LOBBY_WHITE
        }).setOrigin(0, 0.5);
        applyShadow(leftPart);
        // Décalage après le point
        leftPart.setX(24);
        const namePart = this.add.text(24 + leftPart.width, y + rowHeight / 2, name, {
          fontSize: '16px',
          fontFamily: BO2.fontUi,
          color: nameColor
        }).setOrigin(0, 0.5);
        applyShadow(namePart);
        const scorePart = this.add.text(listW - 8, y + rowHeight / 2, score, {
          fontSize: '16px',
          fontFamily: BO2.fontUi,
          color: LOBBY_WHITE
        }).setOrigin(1, 0.5);
        applyShadow(scorePart);

        this.playerListContainer.add([dot, leftPart, namePart, scorePart]);
      }

      // Hitbox pleine ligne: ajoutée en dernier pour être 100% cliquable (cellule entière).
      const hit = this.add.rectangle(listW / 2, y + rowHeight / 2, listW, rowHeight, 0x000000, 0)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: !!p });
      hit.on('pointerover', () => g.setAlpha(0.85));
      hit.on('pointerout', () => g.setAlpha(1));
      if (p) hit.on('pointerdown', () => this.openPlayerActions(p));
      this.playerListContainer.add(hit);
    }
  }

  refreshStartButton(canStart) {
    const item = this.leftMenu?.start;
    if (!item) return;
    const enabled = !!canStart;
    // Ne pas recâbler à chaque tick serveur : sinon survol / triangle clignotent ou se réinitialisent.
    if (this._lastStartCanStart === enabled) return;
    this._lastStartCanStart = enabled;

    // Réinitialiser complètement : sinon pointerover/out restent actifs quand désactivé
    // et forcent l’orange au survol par-dessus le gris « impossible ».
    item.zone.removeAllListeners();
    item.zone.disableInteractive();
    item.tri.setVisible(false);
    item.text.setColor(enabled ? LOBBY_WHITE : '#666666');
    if (!enabled) return;

    item.zone.setInteractive({ useHandCursor: true });
    item.zone.on('pointerover', () => {
      item.tri.setVisible(true);
      item.text.setColor(BO2.orange);
    });
    item.zone.on('pointerout', () => {
      item.tri.setVisible(false);
      item.text.setColor(LOBBY_WHITE);
    });
    item.zone.on('pointerdown', () => this.startGame());
  }

  openPlayerActions(player) {
    if (!player || !this.socket) return;
    if (this.lobbyState?.roundState !== 'LOBBY') return;
    // Ne pas ouvrir pour une ligne vide ou si pas d'id
    if (!player.id) return;

    if (this.playerActionOverlay) {
      this.playerActionOverlay.destroy(true);
      this.playerActionOverlay = null;
    }

    const cam = this.cameras?.main;
    if (!cam) return;
    const { width } = cam;
    const container = this.add.container(width - 260, 190).setDepth(95);
    const bg = this.add.rectangle(0, 0, 320, 160, 0x000000, 0.92).setStrokeStyle(2, BO2.orangeHex, 1);
    container.add(bg);

    const title = this.add.text(0, -54, (player.name || 'Joueur').toUpperCase(), {
      fontSize: '18px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setOrigin(0.5, 0.5);
    applyShadow(title);
    container.add(title);

    const mkBtn = (label, y, color, onClick) => {
      const r = this.add.rectangle(0, y, 220, 34, 0x111111, 1).setStrokeStyle(1, 0xffffff, 0.15);
      r.setInteractive({ useHandCursor: true });
      const t = this.add.text(0, y, label, {
        fontSize: '16px',
        fontFamily: BO2.fontUi,
        color
      }).setOrigin(0.5, 0.5);
      applyShadow(t);
      r.on('pointerdown', onClick);
      container.add([r, t]);
    };

    mkBtn('EXCLURE', -4, BO2.orange, () => {
      this.socket.emit('kick_player', { playerId: player.id });
      this.showStartDenied(`${(player.name || 'Joueur').toUpperCase()} EXCLU`);
      container.destroy(true);
      this.playerActionOverlay = null;
    });

    mkBtn('ANNULER', 44, LOBBY_WHITE, () => {
      container.destroy(true);
      this.playerActionOverlay = null;
    });

    this.playerActionOverlay = container;
  }

  drawMapVoteBlocks(width, height) {
    // Style BO2 épuré : timer en haut à gauche, 3 lignes empilées, séparateurs noirs, peu d’accent couleur
    const ROW_H = 72;
    const PAD = 10;
    const HEADER_H = 28;
    const BOT = 42;
    const panelW = Math.min(Math.max(300, this.leftZoneWidth), 440);
    const innerW = panelW;
    const mapRowCount = VOTE_MAP_DEFS.length;
    const panelH = PAD + HEADER_H + (mapRowCount + 1) * ROW_H;
    const sx = this.leftAlignX;
    const sy = height - panelH - BOT;

    const back = this.add.graphics().setDepth(48);
    back.fillStyle(0x080808, 0.82);
    back.fillRect(sx, sy, panelW, panelH);

    const headerY = sy + PAD + HEADER_H / 2;
    this.voteCountdownText = this.add.text(sx, headerY, 'TEMPS RESTANT: —', {
      fontSize: '14px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE,
      letterSpacing: 1
    }).setOrigin(0, 0.5).setDepth(50);

    let rowY = sy + PAD + HEADER_H;
    for (let i = 0; i < mapRowCount; i++) {
      const def = VOTE_MAP_DEFS[i];
      this._drawBo2MapVoteRow(def, {
        x: sx,
        y: rowY,
        w: innerW,
        h: ROW_H,
        showDivider: true
      });
      rowY += ROW_H;
    }
    this._drawBo2RandomVoteRow({
      x: sx, y: rowY, w: innerW, h: ROW_H, showDivider: false
    });

    this.updateMapVoteCounts(this.lobbyState.voteCounts || {});
    this.refreshMapBlockSelection();
  }

  /**
   * Ligne carte : aperçu en fond (ligne entière), carré noir + nombre de votes, nom + tag alignés à droite.
   */
  _drawBo2MapVoteRow(def, { x, y, w, h, showDivider }) {
    const SQ = 30;
    const depth = 50;

    let rowThumb = null;
    if (def.thumbKey && this.textures.exists(def.thumbKey)) {
      rowThumb = this.add.image(x + w / 2, y + h / 2, def.thumbKey).setDepth(depth - 2);
      const scale = Math.max(w / rowThumb.width, h / rowThumb.height);
      rowThumb.setScale(scale);
      const maskG = this.add.graphics().setDepth(depth - 3);
      maskG.fillStyle(0xffffff);
      maskG.fillRect(x, y, w, h);
      maskG.setVisible(false);
      rowThumb.setMask(maskG.createGeometryMask());
      rowThumb.setAlpha(0.78);
    }

    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(0x000000, 0.52);
    g.fillRect(x, y, w, h);

    const boxLeft = x + 10;
    const ny = y + h / 2;
    const numG = this.add.graphics().setDepth(depth + 1);
    numG.fillStyle(0x000000, 1);
    numG.fillRect(boxLeft, ny - SQ / 2, SQ, SQ);

    const voteText = this.add.text(boxLeft + SQ / 2, ny, '0', {
      fontSize: '16px',
      fontFamily: BO2.fontTitle,
      color: LOBBY_WHITE
    }).setOrigin(0.5, 0.5).setDepth(depth + 2);

    const nameText = this.add.text(x + w - 10, y + h / 2 - 9, def.name, {
      fontSize: '17px',
      fontFamily: BO2.fontTitle,
      color: LOBBY_WHITE,
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(depth + 2);

    const tagText = this.add.text(x + w - 10, y + h / 2 + 11, def.tag.toUpperCase(), {
      fontSize: '10px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE,
      letterSpacing: 0.5
    }).setOrigin(1, 0.5).setDepth(depth + 2);

    if (showDivider) {
      const div = this.add.graphics().setDepth(depth + 3);
      div.lineStyle(1, 0x000000, 1);
      div.lineBetween(x, y + h, x + w, y + h);
    }

    const leadingBorder = this.add.graphics().setDepth(depth + 2);

    /* Pas de clic sur le display : le vote se fait sur les mobiles. */

    this.mapBlocks.push({
      mapId: def.id,
      bg: g,
      rowThumb,
      rowImage: null,
      nameText,
      tagText,
      voteText,
      barFill: null,
      barMaxW: 0,
      accentColor: 0xffffff,
      accentHex: '#ffffff',
      badgeBg: null,
      leadingBorder,
      x,
      y,
      w,
      h,
      isRandom: false
    });
  }

  /** Ligne aléatoire : fond terne type BO2, gauche votes + RANDOM, droite CLASSIFIED. */
  _drawBo2RandomVoteRow({ x, y, w, h, showDivider }) {
    const SQ = 30;
    const depth = 50;

    const g = this.add.graphics().setDepth(depth);
    g.fillGradientStyle(0x121416, 0x121416, 0x1c1e22, 0x1c1e22, 1, 1, 1, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(0x000000, 0.25);
    g.fillRect(x, y, w, h);

    const boxLeft = x + 10;
    const ny = y + h / 2;
    const numG = this.add.graphics().setDepth(depth + 1);
    numG.fillStyle(0x000000, 1);
    numG.fillRect(boxLeft, ny - SQ / 2, SQ, SQ);

    const voteText = this.add.text(boxLeft + SQ / 2, ny, '0', {
      fontSize: '16px',
      fontFamily: BO2.fontTitle,
      color: LOBBY_WHITE
    }).setOrigin(0.5, 0.5).setDepth(depth + 2);

    const nameText = this.add.text(x + w - 10, y + h / 2 - 9, 'MAP CLASSIFIED', {
      fontSize: '17px',
      fontFamily: BO2.fontTitle,
      color: LOBBY_WHITE,
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(depth + 2);

    const tagText = this.add.text(x + w - 10, y + h / 2 + 11, 'SEARCH & DESTROY', {
      fontSize: '10px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE,
      letterSpacing: 0.5
    }).setOrigin(1, 0.5).setDepth(depth + 2);

    if (showDivider) {
      const div = this.add.graphics().setDepth(depth + 3);
      div.lineStyle(1, 0x000000, 1);
      div.lineBetween(x, y + h, x + w, y + h);
    }

    const leadingBorder = this.add.graphics().setDepth(depth + 2);

    /* Pas de clic sur le display (ligne RANDOM = lecture seule). */

    this.mapBlocks.push({
      mapId: 'random',
      bg: g,
      rowImage: null,
      nameText,
      tagText,
      voteText,
      barFill: null,
      barMaxW: 0,
      accentColor: 0xffffff,
      accentHex: '#ffffff',
      badgeBg: null,
      leadingBorder,
      x,
      y,
      w,
      h,
      isRandom: true
    });
  }

  updateMapVoteCounts(voteCounts) {
    const counts = voteCounts || {};
    const total = Math.max(1, Object.values(counts).reduce((s, v) => s + (v || 0), 0));
    this.mapBlocks.forEach(block => {
      const n = counts[block.mapId] ?? 0;
      block.voteText?.setText(String(n));
      // Mise à jour barre de progression
      if (block.barFill && block.barMaxW > 0) {
        const filled = Math.max(3, Math.floor((n / total) * block.barMaxW));
        block.barFill.setSize(filled, 5);
      }
      // Badge fond : s'éclaircit avec les votes
      if (block.badgeBg && n > 0) {
        block.badgeBg.setFillStyle(block.accentColor, Math.min(0.4, 0.1 + n * 0.06));
      }
    });
    this.refreshMapBlockSelection();
  }

  refreshMapBlockSelection() {
    const voteCounts = this.lobbyState?.voteCounts || {};
    let maxVotes = 0;
    let leadingId = null;
    for (const block of this.mapBlocks) {
      const n = voteCounts[block.mapId] ?? 0;
      if (n > maxVotes) { maxVotes = n; leadingId = block.mapId; }
    }

    this.mapBlocks.forEach(block => {
      const isChosen  = block.mapId === this.chosenMapId;
      const isLeading = block.mapId === leadingId && maxVotes > 0;
      const isMyVote  = block.mapId === this.myDisplayVote;

      // Texte bien lisible : blanc franc quand actif / en tête, léger gris sinon (pas « boue »)
      let titleCol = '#D8D8D8';
      let subCol = '#C0C0C0';
      if (isChosen || isLeading) {
        titleCol = LOBBY_WHITE;
        subCol = '#F2F2F2';
      } else if (isMyVote) {
        titleCol = '#F5F5F5';
        subCol = '#E0E0E0';
      }
      block.nameText.setColor(titleCol);
      if (block.tagText) block.tagText.setColor(subCol);

      if (block.bg) block.bg.setAlpha(isLeading ? 0.32 : 0.52);
      if (block.rowThumb) {
        block.rowThumb.setAlpha(
          isLeading ? 1 : isMyVote ? 0.92 : isChosen ? 0.88 : 0.78
        );
      }

      if (block.leadingBorder) {
        block.leadingBorder.clear();
        if (isLeading) {
          block.leadingBorder.lineStyle(1, 0xffffff, 0.35);
          block.leadingBorder.strokeRect(block.x + 0.5, block.y + 0.5, block.w - 1, block.h - 1);
        }
      }
    });
  }

  showCountdown(n) {
    /* Même bandeau que « TEMPS RESTANT » au-dessus des cartes (plus de compte géant au centre). */
    if (n > 0) {
      this._prestartCountdownActive = true;
      if (this.voteCountdownText) {
        this.voteCountdownText.setText(`DÉPART DANS : ${n}`);
      }
      return;
    }
    this._prestartCountdownActive = false;
    if (!this.voteCountdownText) return;
    const sec = this.lobbyState?.voteTimeLeft;
    const label = sec != null && Number.isFinite(sec)
      ? String(Math.max(0, Math.ceil(sec)))
      : '—';
    this.voteCountdownText.setText(`TEMPS RESTANT: ${label}`);
  }

  onMapChosen(data) {
    this.chosenMapId = data?.mapId || null;
    const voteCounts = data?.voteCounts || {};
    this.updateMapVoteCounts(voteCounts);
    /**
     * Ne pas appeler goToGameSceneFromLobby() ici : map_chosen arrive avant map_data sur le fil.
     * GameScene exige mapData à jour (murs / freeCells de la carte tirée au vote) — sinon échec ou état incohérent.
     * La transition part dès que map_data a rempli le registry (_tryEnterGameSceneAfterMapChoice).
     * Secours : game_starting (~2,5 s) et maybeEnterGameSceneFromServerState (BUY_PHASE).
     */
    this._tryEnterGameSceneAfterMapChoice();
  }

  /**
   * Lance GameScene uniquement quand le snapshot `mapData` correspond à la carte choisie (après map_data).
   */
  _tryEnterGameSceneAfterMapChoice() {
    if (!this.chosenMapId) return;
    const md = this.registry.get('mapData');
    if (!md?.mapId || md.mapId !== this.chosenMapId) return;
    if (!Array.isArray(md.walls) || md.walls.length === 0) return;
    this.goToGameSceneFromLobby();
  }

  /**
   * Affiche le code partie + QR vers /mobile?r=CODE (reçu via state_update).
   */
  syncLobbyRoomJoin(roomCode, width, height) {
    if (!roomCode || !this.lobbyRoomCodeText) return;
    this.lobbyRoomCodeText.setText(`CODE ${roomCode}`);
    if (roomCode === this._lastLobbyQrRoom) return;
    this._lastLobbyQrRoom = roomCode;

    const qrDisplay = this._lobbyQrDisplaySize ?? 168;
    const qrCenterY = this._lobbyQrCenterY ?? height - 36 - (168 + 28) / 2;
    const mobileUrl = getMobileJoinUrlWithRoom(roomCode);
    const qrKey = `lobby_mobile_qr_${roomCode}`;

    if (this.lobbyQrPlaceholder) {
      this.lobbyQrPlaceholder.destroy();
      this.lobbyQrPlaceholder = null;
    }
    if (this.lobbyQrImage) {
      try {
        this.lobbyQrImage.destroy();
      } catch { /* */ }
      this.lobbyQrImage = null;
    }

    QRCode.toDataURL(mobileUrl, {
      width: 256,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#0a0a12', light: '#ffffff' }
    })
      .then((dataUrl) => {
        const img = new Image();
        img.onload = () => {
          try {
            if (!this.textures || !this.add) return;
            if (this.textures.exists(qrKey)) this.textures.remove(qrKey);
            this.textures.addImage(qrKey, img);
            this.lobbyQrImage = this.add
              .image(width / 2, qrCenterY, qrKey)
              .setDepth(10)
              .setDisplaySize(qrDisplay, qrDisplay);
          } catch {
            /* scène détruite */
          }
        };
        img.onerror = () => {};
        img.src = dataUrl;
      })
      .catch(() => {});
  }

  drawMobileUrl(width, height) {
    /* QR en bas d’écran + cadre discret (contenu généré après state_update). */
    const bottomMargin = 36;
    const qrDisplay = 168;
    const qrCenterY = height - bottomMargin - qrDisplay / 2;
    const qrPad = 10;
    const frameW = qrDisplay + qrPad * 2;
    const frameH = qrDisplay + qrPad * 2;
    const frameX = width / 2 - frameW / 2;
    const frameY = qrCenterY - frameH / 2;

    this._lobbyQrDisplaySize = qrDisplay;
    this._lobbyQrCenterY = qrCenterY;
    this._lastLobbyQrRoom = null;

    const qrFrame = this.add.graphics().setDepth(9);
    qrFrame.fillStyle(0x000000, 0.35);
    qrFrame.fillRoundedRect(frameX, frameY, frameW, frameH, 10);
    qrFrame.lineStyle(1, 0xffffff, 0.4);
    qrFrame.strokeRoundedRect(frameX + 0.5, frameY + 0.5, frameW - 1, frameH - 1, 10);
    this.lobbyQrFrame = qrFrame;

    this.lobbyQrPlaceholder = this.add.text(width / 2, qrCenterY, 'QR…', {
      fontSize: '14px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setOrigin(0.5, 0.5).setDepth(10);

    if (this.lobbyState?.roomCode) {
      this.syncLobbyRoomJoin(this.lobbyState.roomCode, width, height);
    }
  }

  startGame() {
    if (!this.socket) return;
    // Gating UI (le serveur vérifie aussi)
    const state = this.lobbyState || {};
    const players = state.players || [];
    const hostId = state.hostId || null;
    const requiredPlayers = players.filter(p => p && p.id !== hostId);
    const required = requiredPlayers.length;
    const ready = requiredPlayers.filter(p => p && p.isReady).length;
    const canStart = state.roundState === 'LOBBY' && players.length >= 2 && ready >= required;
    if (!canStart) {
      this.showStartDenied(`JOUEURS PRÊTS: ${ready}/${required} — IMPOSSIBLE DE LANCER`);
      return;
    }
    this.socket.emit('start_game');
  }

  openLeaderboard(width, height) {
    if (this.leaderboardOverlay) return;

    const pad = (v, n) => String(v).padStart(n).slice(0, n);
    const padR = (v, n) => String(v).padEnd(n).slice(0, n);

    const panelW = Math.min(900, width - 80);
    const panelH = Math.min(700, height - 80);
    const panelX = width / 2;
    const panelY = height / 2;

    const overlay = this.add.rectangle(panelX, panelY, width + 100, height + 100, 0x000000, 0.75)
      .setInteractive({ useHandCursor: false })
      .setDepth(100);

    const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0x0d0d14, 0.98)
      .setStrokeStyle(3, BO2.orangeHex)
      .setDepth(101);

    const title = this.add.text(panelX, panelY - panelH / 2 + 28, 'CLASSEMENT', {
      fontSize: '26px',
      fontFamily: BO2.fontTitle,
      color: LOBBY_WHITE
    }).setOrigin(0.5).setDepth(102);
    applyShadow(title);

    const header = this.add.text(panelX - panelW / 2 + 24, panelY - panelH / 2 + 62,
      'RANG  NOM              K    D    K/D    V    L   PLANT DEFUSE  WIN%', {
      fontSize: '13px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setOrigin(0, 0).setDepth(102);
    applyShadow(header);

    const loadingText = this.add.text(panelX, panelY, 'CHARGEMENT...', {
      fontSize: '16px',
      fontFamily: BO2.fontUi,
      color: LOBBY_WHITE
    }).setOrigin(0.5).setDepth(102);
    applyShadow(loadingText);

    const closeBtn = this.add.rectangle(panelX, panelY + panelH / 2 - 36, 140, 36, BO2.orangeHex, 0.95)
      .setStrokeStyle(2, 0xbbbbbb)
      .setInteractive({ useHandCursor: true })
      .setDepth(102);
    const closeText = this.add.text(panelX, panelY + panelH / 2 - 36, 'FERMER', {
      fontSize: '18px',
      fontFamily: BO2.fontUi,
      color: '#000000'
    }).setOrigin(0.5).setDepth(103);
    applyShadow(closeText);

    const lineHeight = 22;
    const tableTop = panelY - panelH / 2 + 88;
    const tableLeft = panelX - panelW / 2 + 24;
    const maxRows = 18;

    const closePanel = () => {
      if (this.leaderboardOverlay) {
        this.leaderboardOverlay.destroy();
        this.leaderboardOverlay = null;
      }
    };

    closeBtn.on('pointerover', () => closeBtn.setAlpha(1));
    closeBtn.on('pointerout', () => closeBtn.setAlpha(0.9));
    closeBtn.on('pointerdown', closePanel);
    overlay.on('pointerdown', closePanel);

    this.leaderboardOverlay = this.add.container(0, 0, [overlay, panel, title, header, loadingText, closeBtn, closeText]);
    this.leaderboardOverlay.setDepth(100);

    this.socket.emit('get_leaderboard', { limit: 50, orderBy: 'kills' }, (res) => {
      if (!this.leaderboardOverlay || !loadingText.scene) return;
      loadingText.destroy();

      const list = (res && res.leaderboard) ? res.leaderboard : [];
      const rowsContainer = this.add.container(tableLeft, tableTop).setDepth(102);
      this.leaderboardOverlay.add(rowsContainer);

      if (list.length === 0) {
        const emptyT = this.add.text(0, 0, 'AUCUNE STATISTIQUE ENREGISTRÉE.', {
          fontSize: '14px',
          fontFamily: BO2.fontUi,
          color: LOBBY_WHITE
        });
        applyShadow(emptyT);
        rowsContainer.add(emptyT);
        return;
      }

      for (let i = 0; i < Math.min(list.length, maxRows); i++) {
        const row = list[i];
        const rank = i + 1;
        const name = (row.name || 'Joueur').slice(0, 14);
        const k = row.kills != null ? row.kills : 0;
        const d = row.deaths != null ? row.deaths : 0;
        const kd = row.kd_ratio != null ? row.kd_ratio : (d > 0 ? (k / d).toFixed(2) : k);
        const w = row.wins != null ? row.wins : 0;
        const l = row.losses != null ? row.losses : 0;
        const plant = row.plants != null ? row.plants : 0;
        const defuse = row.defuses != null ? row.defuses : 0;
        const winPct = row.win_rate != null ? row.win_rate : (row.rounds_played > 0 ? ((row.wins || 0) / row.rounds_played * 100).toFixed(1) : '0');

        const line = this.add.text(0, i * lineHeight,
          `${pad(rank, 4)} ${padR(name, 16)} ${pad(k, 4)} ${pad(d, 4)} ${pad(String(kd), 6)} ${pad(w, 4)} ${pad(l, 4)} ${pad(plant, 5)} ${pad(defuse, 6)}  ${winPct}%`,
          {
            fontSize: '13px',
            fontFamily: BO2.fontUi,
            color: LOBBY_WHITE,
            fontStyle: i < 3 ? 'bold' : 'normal'
          }
        ).setOrigin(0, 0);
        applyShadow(line);
        rowsContainer.add(line);
      }
    });
  }
}
