/**
 * Configuration Phaser (résolution logique : voir config/constants.js)
 * Scènes = couche Vue (MVC client display).
 */
import Phaser from 'phaser';
import BootScene from '../views/BootScene.js';
import LobbyScene from '../views/LobbyScene.js';
import GameScene from '../views/GameScene.js';
import { GAME_WIDTH, GAME_HEIGHT } from './constants.js';

export const phaserConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  /** Requis pour `scene.add.dom()` (avatars HUD) — sinon erreur « No DOM Container set in game config ». */
  dom: {
    createContainer: true
  },
  backgroundColor: '#050508',
  physics: {
    default: 'arcade'
  },
  scene: [BootScene, LobbyScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    // En RESIZE, le canvas doit coller au parent: pas de centrage (évite bandes).
    autoCenter: Phaser.Scale.NO_CENTER,
    // Défense en profondeur: force un parent expansé si le navigateur renvoie 0px au boot.
    expandParent: true
  }
};
