/**
 * Contrôleur : écran de connexion (pseudo, code partie, bouton Rejoindre)
 * L’équipe ATT/DEF est assignée par le serveur au lancement (tous prêts).
 */
import { createMobileSocket, getServerUrl } from '../services/SocketService.js';
import { initGameController } from './GameController.js';
import { getStoredSession, saveSession, clearStoredSession } from '../../utils/session.js';

const joinScreen  = document.getElementById('join-screen');
const gameScreen  = document.getElementById('game-screen');
const nameInput   = document.getElementById('name-input');
const joinBtn     = document.getElementById('join-btn');
const joinStatusEl = document.getElementById('join-status');
const roomCodeInput = document.getElementById('room-code-input');
const avatarInput = document.getElementById('avatar-input');
const avatarPreview = document.getElementById('avatar-preview');
const avatarClearBtn = document.getElementById('avatar-clear-btn');

// Légèrement au-dessus du timeout Socket.io (60s) pour laisser finir un handshake lent.
const JOIN_CONNECT_TIMEOUT_MS = 68000;
const REJOIN_TIMEOUT_MS       = 68000;

/** Extrait ?r= ou ?room= pour préremplir le code (lien du QR lobby). */
function getRoomCodeFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search);
    return (p.get('r') || p.get('room') || '').trim();
  } catch {
    return '';
  }
}

function normalizeClientRoomCode(raw) {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

/**
 * Émet join_game dès que le transport est prêt (évite la course si déjà connecté).
 * @param {import('socket.io-client').Socket} socket
 * @param {Record<string, unknown>} payload
 */
function emitJoinWhenReady(socket, payload) {
  const send = () => {
    socket.emit('join_game', payload);
  };
  if (socket.connected) send();
  else socket.once('connect', send);
}

let joinInProgress = false;

/** Reconnexion auto en cours : annulation si l'utilisateur clique sur Rejoindre */
let autoRejoinAbort = null;

function stopAutoRejoin() {
  if (typeof autoRejoinAbort !== 'function') return;
  autoRejoinAbort();
  autoRejoinAbort = null;
}

// ─── Rejoin automatique ───────────────────────────────────────────────────────

/**
 * Tente un rejoin silencieux avec la session sauvegardée.
 * Le bouton « Rejoindre » reste actif : un clic annule cette tentative et lance une connexion manuelle.
 */
function attemptAutoRejoin(savedSession) {
  stopAutoRejoin();

  if (joinStatusEl) joinStatusEl.textContent = 'Reconnexion en cours… (ou appuyez sur Rejoindre pour le code)';

  const socket = createMobileSocket();
  let settled = false;

  const finish = () => {
    autoRejoinAbort = null;
  };

  const abort = (msg = '', clearSession = true) => {
    if (settled) return;
    settled = true;
    clearTimeout(rejoinTimer);
    socket.off('session_confirmed', onSessionConfirmed);
    socket.off('ui_update', onUiUpdate);
    socket.off('connect_error', onConnectError);
    try {
      socket.disconnect();
    } catch { /* */ }
    finish();
    if (clearSession) clearStoredSession();
    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.classList.remove('join-btn--waiting');
    }
    if (joinStatusEl && msg !== '') joinStatusEl.textContent = msg;
    if (nameInput && savedSession.name) nameInput.value = savedSession.name;
  };

  autoRejoinAbort = () => abort('', true);

  const rejoinTimer = setTimeout(() => {
    abort('Délai dépassé (réseau ou serveur lent) — saisissez le code et appuyez sur Rejoindre.', true);
  }, REJOIN_TIMEOUT_MS);

  function onSessionConfirmed({ sessionId }) {
    // Toujours LOBBY ici : l’équipe réelle vient du 1er ui_update (initGameController).
    saveSession(sessionId, savedSession.name, 'LOBBY', savedSession.avatarDataUrl ?? null);
  }

  function onUiUpdate(data) {
    if (settled) return;
    settled = true;
    clearTimeout(rejoinTimer);
    socket.off('session_confirmed', onSessionConfirmed);
    socket.off('ui_update', onUiUpdate);
    socket.off('connect_error', onConnectError);
    finish();

    if (data?.error) {
      try {
        socket.disconnect();
      } catch { /* */ }
      clearStoredSession();
      if (joinBtn) {
        joinBtn.disabled = false;
        joinBtn.classList.remove('join-btn--waiting');
      }
      if (joinStatusEl) joinStatusEl.textContent = String(data.error);
      if (nameInput && savedSession.name) nameInput.value = savedSession.name;
      return;
    }

    joinScreen?.classList.add('hidden');
    gameScreen?.classList.remove('hidden');
    if (joinStatusEl) joinStatusEl.textContent = '';
    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.classList.remove('join-btn--waiting');
    }
    initGameController(socket, data);
  }

  function onConnectError() {
    abort('Connexion impossible (Wi‑Fi, pare-feu ou serveur en démarrage). Réessayez.', true);
  }

  socket.once('session_confirmed', onSessionConfirmed);
  socket.on('ui_update', onUiUpdate);
  socket.once('connect_error', onConnectError);

  /* Un seul emit (évite le throttle 500 ms serveur si double join_game) */
  emitJoinWhenReady(socket, {
    name:      savedSession.name,
    sessionId: savedSession.sessionId,
    avatarDataUrl: savedSession.avatarDataUrl ?? null
  });
}

function setAvatarPreview(dataUrl) {
  if (!avatarPreview) return;
  if (!dataUrl) {
    avatarPreview.style.backgroundImage = '';
    avatarPreview.classList.remove('has-avatar');
    avatarClearBtn?.classList.add('hidden');
    return;
  }
  avatarPreview.style.backgroundImage = `url("${dataUrl}")`;
  avatarPreview.classList.add('has-avatar');
  avatarClearBtn?.classList.remove('hidden');
}

async function fileToAvatarDataUrl(file, size = 96) {
  if (!file) return null;
  if (!file.type?.startsWith('image/')) return null;

  const srcUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = srcUrl;
    await new Promise((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('image_load_failed'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    const s = Math.min(sw, sh);
    const sx = Math.max(0, Math.floor((sw - s) / 2));
    const sy = Math.max(0, Math.floor((sh - s) / 2));
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);

    return canvas.toDataURL('image/jpeg', 0.86);
  } catch {
    return null;
  } finally {
    try { URL.revokeObjectURL(srcUrl); } catch { /* ignore */ }
  }
}

function getTmpAvatarDataUrl() {
  try {
    const raw = localStorage.getItem('zs_avatar_tmp');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.avatarDataUrl === 'string' ? parsed.avatarDataUrl : null;
  } catch {
    return null;
  }
}

function setTmpAvatarDataUrl(avatarDataUrl) {
  try {
    if (!avatarDataUrl) localStorage.removeItem('zs_avatar_tmp');
    else localStorage.setItem('zs_avatar_tmp', JSON.stringify({ avatarDataUrl }));
  } catch {
    // ignore
  }
}

function setupAvatarField() {
  const saved = getStoredSession();
  const initial = saved?.avatarDataUrl ?? getTmpAvatarDataUrl();
  if (initial) setAvatarPreview(initial);

  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput?.files?.[0];
    const dataUrl = await fileToAvatarDataUrl(file, 96);
    setAvatarPreview(dataUrl);
    const st = getStoredSession();
    if (st?.sessionId) saveSession(st.sessionId, st.name, st.team ?? 'LOBBY', dataUrl);
    else setTmpAvatarDataUrl(dataUrl);
  });

  avatarClearBtn?.addEventListener('click', () => {
    if (avatarInput) avatarInput.value = '';
    setAvatarPreview(null);
    const st = getStoredSession();
    if (st?.sessionId) saveSession(st.sessionId, st.name, st.team ?? 'LOBBY', null);
    setTmpAvatarDataUrl(null);
  });
}

// ─── Bouton Rejoindre (premier join) ─────────────────────────────────────────

function setupJoinButton() {
  joinBtn?.addEventListener('click', async () => {
    /* Annule une reconnexion auto bloquée et force le flux manuel avec code partie */
    if (autoRejoinAbort) {
      stopAutoRejoin();
      clearStoredSession();
      if (joinStatusEl) joinStatusEl.textContent = 'Connexion…';
    }

    if (joinInProgress) return;
    joinInProgress = true;
    joinBtn.disabled = true;
    joinBtn.classList.add('join-btn--waiting');
    if (joinStatusEl) joinStatusEl.textContent = 'Connexion au serveur…';

    let name = nameInput?.value?.trim();
    if (!name) {
      try {
        const r = await fetch(`${getServerUrl()}/api/randomuser`);
        const d = await r.json();
        name = d?.name || 'Joueur';
      } catch {
        name = 'Joueur';
      }
    }

    const socket = createMobileSocket();

    let joinTimeoutId;
    const resetJoinForm = () => {
      clearTimeout(joinTimeoutId);
      joinInProgress = false;
      joinBtn.disabled = false;
      joinBtn.classList.remove('join-btn--waiting');
    };

    joinTimeoutId = setTimeout(() => {
      if (joinStatusEl) {
        joinStatusEl.textContent =
          'Délai dépassé — réseau lent ou serveur en réveil. Réessayez dans un instant.';
      }
      socket.close();
      resetJoinForm();
    }, JOIN_CONNECT_TIMEOUT_MS);

    const roomCode = normalizeClientRoomCode(roomCodeInput?.value);
    const avatarDataUrl = getStoredSession()?.avatarDataUrl ?? getTmpAvatarDataUrl();
    emitJoinWhenReady(socket, { name, roomCode, avatarDataUrl });

    socket.once('connect_error', () => {
      if (joinStatusEl) {
        joinStatusEl.textContent =
          'Connexion impossible (réseau ou serveur en réveil). Réessayez dans quelques secondes.';
      }
      resetJoinForm();
    });

    socket.once('session_confirmed', ({ sessionId }) => {
      const avatarDataUrl = getTmpAvatarDataUrl();
      saveSession(sessionId, name, 'LOBBY', avatarDataUrl);
      setTmpAvatarDataUrl(null);
    });

    socket.once('ui_update', (data) => {
      clearTimeout(joinTimeoutId);
      if (data.error) {
        if (joinStatusEl) joinStatusEl.textContent = data.error;
        resetJoinForm();
        return;
      }
      joinScreen?.classList.add('hidden');
      gameScreen?.classList.remove('hidden');
      if (joinStatusEl) joinStatusEl.textContent = '';
      initGameController(socket, data);
    });
  });
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export function initJoinController() {
  const fromUrl = getRoomCodeFromUrl();
  if (roomCodeInput && fromUrl) {
    roomCodeInput.value = fromUrl.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }

  setupJoinButton();
  setupAvatarField();

  // Reset robuste du formulaire quand on revient depuis une session terminée (kicked, display_left, etc.)
  // GameController déclenche cet event.
  window.addEventListener('zs:session_ended', () => {
    joinInProgress = false;
    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.classList.remove('join-btn--waiting');
    }
  });

  const savedSession = getStoredSession();
  if (savedSession?.sessionId) {
    attemptAutoRejoin(savedSession);
  }
}
