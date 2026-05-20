/**
 * GameScene — Vue Phaser (partie en cours).
 * Détails affichage : ./game/ ; événements réseau : ../controllers/gameSocketController.js
 */
import { getOrCreateDisplaySocket } from '../services/SocketService.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { loadDisplayPreferences } from '../utils/displayPreferences.js';
import * as AudioManager from '../utils/AudioManager.js';
import { registerGameSceneSockets } from '../controllers/gameSocketController.js';
import * as MapLayer from './game/mapLayer.js';
import * as Hud from './game/hud.js';
import * as Effects from './game/effects.js';
import { gameSceneUpdate } from './game/updateLoop.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.registry.remove('lastDisplayGameState');
    const prefs = loadDisplayPreferences();
    this.registry.set('reduceVisualEffects', prefs.reduceVisualEffects);
    this.registry.set('roomMode', prefs.roomMode);
    AudioManager.setMasterVolume(prefs.masterVolume);

    this.players = new Map();
    this.projectiles = new Map();
    this.walls = [];
    this.powerUps = new Map();
    this.bombSprite = null;
    this.playerDustEmitters = new Map();
    this.freezeOverlay = null;

    const md0 = this.registry.get('mapData');
    if (!md0?.mapId || !Array.isArray(md0.walls) || md0.walls.length === 0) {
      throw new Error(
        '[GameScene] mapData invalide : mapId et walls requis (map_data doit précéder l’entrée en jeu).'
      );
    }

    // Fond : image exportée Tiled si dispo, sinon rectangle neutre.
    const bgKeyByMapId = {
      dist2: 'map_bg_dist2',
      ascension: 'map_bg_ascension',
      maven: 'map_bg_maven',
      chadigo: 'map_bg_chadigo'
    };
    const bgKey = bgKeyByMapId[md0.mapId];
    if (bgKey && this.textures.exists(bgKey)) {
      this.mapBgImage = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDepth(-13);
      this.mapBgImage.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.mapBgRect = null;
    } else {
      this.mapBgImage = null;
      this.mapBgRect = this.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH + 100, GAME_HEIGHT + 100, 0x2a2a1e)
        .setDepth(-13);
    }

    this.rootScale = this.add.container(0, 0);
    const syncViewportScale = () => {
      const sx = this.scale.width / GAME_WIDTH;
      const sy = this.scale.height / GAME_HEIGHT;
      this.rootScale.setScale(sx, sy);
      if (this.mapBgRect && !this.mapBgRect.destroyed) {
        this.mapBgRect.setScale(sx, sy);
      }
      if (this.mapBgImage && !this.mapBgImage.destroyed) {
        this.mapBgImage.setScale(sx, sy);
      }
    };
    this.scale.on('resize', syncViewportScale);
    syncViewportScale();

    const add = (obj) => { this.rootScale.add(obj); return obj; };

    this.abilityDisplayBatch = [];
    this.abilityDisplayCollectTimer = null;
    this.bombOverlay = null;
    this.bombTimerText = null;
    this.matchOverlay = null;

    this.socket = getOrCreateDisplaySocket(this.registry);

    const finishGameSceneSetup = () => {
      registerGameSceneSockets(this);
      Hud.createHUD(this);
      Effects.registerExplosionAnim(this);
      MapLayer.createVignette(this);
    };

    const backgroundOnly = !!this.mapBgImage;
    if (!backgroundOnly) {
      if (md0.tiledDebugGrid?.cells) {
        MapLayer.drawTiledDebugGrid(this, add);
        MapLayer.drawBombZone(this);
      } else {
        MapLayer.drawFloorVariants(this, add);
        MapLayer.drawWalls(this);
        MapLayer.drawDecorations(this);
        MapLayer.drawBombZone(this);
      }
    }
    finishGameSceneSetup();
  }

  update() {
    gameSceneUpdate(this);
  }
}
