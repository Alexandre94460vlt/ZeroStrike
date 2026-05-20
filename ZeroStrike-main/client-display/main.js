/**
 * Zero Strike - Client Affichage (Phaser 3)
 * Point d'entrée : charge la config MVC et lance le jeu
 */
import Phaser from 'phaser';
import { phaserConfig } from './config/gameConfig.js';
import '@fontsource/teko/400.css';
import '@fontsource/teko/600.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/600.css';

async function ensureFontsLoaded() {
  // Évite le « flash » fallback → webfont (F5, survol).
  if (!document.fonts || typeof document.fonts.load !== 'function') return;
  const timeoutMs = 2500;
  const load = Promise.all([
    document.fonts.load('16px Teko'),
    document.fonts.load('600 16px Teko'),
    document.fonts.load('500 20px Oswald'),
    document.fonts.load('600 32px Oswald'),
    document.fonts.load('400 16px Rajdhani'),
    document.fonts.load('600 16px Rajdhani')
  ]);
  await Promise.race([
    load,
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

let game = null;

(async () => {
  await ensureFontsLoaded();
  game = new Phaser.Game(phaserConfig);
})();

function refreshScale() {
  if (!game || !game.scale) return;
  // 1) refresh immédiat
  game.scale.refresh();
  // 2) refresh retardé: certains navigateurs appliquent le fullscreen après l'event
  setTimeout(() => {
    try { game.scale.refresh(); } catch { /* ignore */ }
  }, 50);
}

window.addEventListener('resize', refreshScale);
document.addEventListener('fullscreenchange', refreshScale);
window.addEventListener('orientationchange', refreshScale);
