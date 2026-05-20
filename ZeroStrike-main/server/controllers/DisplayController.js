/**
 * Contrôleur : namespace Socket.io /display
 * Connexion, start_game, disconnect → délègue au GameService
 * Si DISPLAY_PASSWORD est défini : pas de display_connect tant que display_login OK.
 */
import { registerSocketMetricsHandler } from '../utils/observability.js';
import { logSocketDisconnect } from '../utils/socketDisconnectLog.js';
import { getDisplayPasswordSecret, isDisplayAuthEnabled } from '../config/displayAuth.js';

const displayPasswordSecret = getDisplayPasswordSecret();
const needsDisplayAuth = isDisplayAuthEnabled();
const MAX_DISPLAY_LOGIN_ATTEMPTS = 10;

/**
 * Hôte projecteur : soit le socket enregistré s'il est encore connecté,
 * sinon promotion du socket courant (onglet hôte fermé → autre onglet peut lancer).
 */
function ensureDisplayHost(displayNamespace, gameApp, socket) {
  const hid = gameApp.engine.displayHostId;
  if (hid != null && displayNamespace.sockets.has(hid) && hid !== socket.id) {
    return false;
  }
  gameApp.engine.displayHostId = socket.id;
  return true;
}

function verifyDisplayPassword(candidateTrimmed) {
  if (typeof candidateTrimmed !== 'string') return false;
  return candidateTrimmed === displayPasswordSecret;
}

export function registerDisplayController(displayNamespace, gameApp) {
  displayNamespace.on('connection', (socket) => {
    console.log('[Display] Client connecté:', socket.id);
    registerSocketMetricsHandler(socket, 'display');

    socket.data.displayAuthed = !needsDisplayAuth;
    socket.data.displayLoginAttempts = 0;

    if (!needsDisplayAuth) {
      gameApp.dispatch({ type: 'display_connect', payload: { socketId: socket.id } });
    }

    socket.on('display_request_auth_status', () => {
      socket.emit('display_auth_status', {
        required: needsDisplayAuth,
        authed: !!socket.data.displayAuthed
      });
    });

    socket.on('display_login', (payload, cb) => {
      if (!needsDisplayAuth) {
        if (typeof cb === 'function') cb({ ok: true });
        return;
      }
      if (socket.data.displayAuthed) {
        if (typeof cb === 'function') cb({ ok: true });
        return;
      }
      if (socket.data.displayLoginAttempts >= MAX_DISPLAY_LOGIN_ATTEMPTS) {
        if (typeof cb === 'function') cb({ ok: false, error: 'locked' });
        socket.disconnect(true);
        return;
      }
      socket.data.displayLoginAttempts += 1;
      const pwd = typeof payload?.password === 'string' ? payload.password.trim() : '';
      const ok = verifyDisplayPassword(pwd);
      if (!ok) {
        if (typeof cb === 'function') cb({ ok: false, error: 'invalid' });
        if (socket.data.displayLoginAttempts >= MAX_DISPLAY_LOGIN_ATTEMPTS) {
          socket.disconnect(true);
        }
        return;
      }
      socket.data.displayAuthed = true;
      // Ack **avant** display_connect : le client enregistre les handlers `state_update` dans le
      // callback de `display_login`. Sinon map_data / premier état peuvent arriver avant les
      // listeners → lobby sans code / QR (race réseau + ordre des paquets).
      if (typeof cb === 'function') cb({ ok: true });
      gameApp.dispatch({ type: 'display_connect', payload: { socketId: socket.id } });
    });

    socket.on('start_game', () => {
      if (!socket.data.displayAuthed) return;
      if (!ensureDisplayHost(displayNamespace, gameApp, socket)) return;
      if (gameApp.engine.roundState === 'LOBBY') gameApp.dispatch({ type: 'start_game' });
    });

    /* vote_map : uniquement depuis /mobile — le display est lecture seule pour les cartes. */

    socket.on('update_settings', (data) => {
      if (!socket.data.displayAuthed) return;
      if (gameApp.engine.roundState !== 'LOBBY') return;
      gameApp.dispatch({ type: 'update_settings', payload: { data } });
    });

    socket.on('force_lobby', (cb) => {
      if (!socket.data.displayAuthed) {
        if (typeof cb === 'function') cb({ ok: false, error: 'not_authenticated' });
        return;
      }
      if (!ensureDisplayHost(displayNamespace, gameApp, socket)) {
        if (typeof cb === 'function') cb({ ok: false, error: 'not_display_host' });
        return;
      }
      gameApp.dispatch({ type: 'force_lobby', payload: { requesterId: socket.id, reason: 'host_menu' } });
      if (typeof cb === 'function') cb({ ok: true });
    });

    socket.on('kick_player', (data, cb) => {
      if (!socket.data.displayAuthed) {
        if (typeof cb === 'function') cb({ ok: false, error: 'not_authenticated' });
        return;
      }
      if (!ensureDisplayHost(displayNamespace, gameApp, socket)) {
        if (typeof cb === 'function') cb({ ok: false, error: 'not_display_host' });
        return;
      }
      const playerId = data?.playerId;
      if (!playerId || typeof playerId !== 'string') {
        if (typeof cb === 'function') cb({ ok: false, error: 'invalid_player' });
        return;
      }
      gameApp.dispatch({ type: 'kick_player', payload: { playerId, by: socket.id } });
      if (typeof cb === 'function') cb({ ok: true });
    });

    socket.on('get_leaderboard', (data, cb) => {
      if (!socket.data.displayAuthed) {
        if (typeof cb === 'function') cb({ error: 'not_authenticated' });
        return;
      }
      try {
        const limit = Math.min(parseInt(data?.limit, 10) || 50, 100);
        const orderBy = data?.orderBy || 'kills';
        const leaderboard = gameApp.leaderboardPort.getLeaderboard(limit, orderBy);
        if (typeof cb === 'function') cb({ leaderboard });
        else socket.emit('leaderboard', { leaderboard });
      } catch (err) {
        if (typeof cb === 'function') cb({ error: 'Erreur classement' });
      }
    });

    socket.on('disconnect', (reason) => {
      logSocketDisconnect('display', socket.id, reason, {
        displayAuthed: !!socket.data.displayAuthed
      });
      gameApp.dispatch({ type: 'display_disconnect', payload: { socketId: socket.id } });
    });
  });
}
