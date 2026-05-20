/**
 * Zero Strike - Client Mobile (Manette)
 * Point d'entrée MVC : initialise le contrôleur de l'écran de connexion
 */
import { initJoinController } from './controllers/JoinController.js';

// ─── Anti-zoom double-tap (évite le zoom involontaire, impossible à annuler) ───
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

// ─── Plein écran ──────────────────────────────────────────────────────────────
function toggleFullscreen(targetEl) {
  const doc = document;
  const docEl = doc.documentElement;
  if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
    const el = targetEl || docEl;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.webkitRequestFullScreen) el.webkitRequestFullScreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  } else {
    if (doc.exitFullscreen) doc.exitFullscreen();
    else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    else if (doc.msExitFullscreen) doc.msExitFullscreen();
  }
}

function updateFullscreenButtonState() {
  const doc = document;
  const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
  document.querySelectorAll('.fullscreen-btn, .fullscreen-btn-join').forEach((btn) => {
    btn.classList.toggle('is-fullscreen', isFs);
    btn.title = isFs ? 'Quitter le plein écran' : 'Plein écran';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
    toggleFullscreen(document.getElementById('app'));
  });
  document.getElementById('fullscreen-btn-join')?.addEventListener('click', () => {
    toggleFullscreen(document.getElementById('app'));
  });
  document.addEventListener('fullscreenchange', updateFullscreenButtonState);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButtonState);
  document.addEventListener('MSFullscreenChange', updateFullscreenButtonState);
});

// ─── Overlay rotation ─────────────────────────────────────────────────────────
function updateOrientationLock() {
  const overlay = document.getElementById('rotate-overlay');
  const app = document.getElementById('app');
  const gameScreen = document.getElementById('game-screen');
  if (!overlay || !app) return;
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  const isInGame = gameScreen && !gameScreen.classList.contains('hidden');
  if (isPortrait && isInGame) {
    overlay.classList.remove('hidden');
    app.classList.add('hidden');
  } else {
    overlay.classList.add('hidden');
    app.classList.remove('hidden');
  }
}

updateOrientationLock();
window.addEventListener('orientationchange', updateOrientationLock);
window.addEventListener('resize', updateOrientationLock);

initJoinController();
