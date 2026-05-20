/**
 * Service : URL du serveur et socket namespace /display
 * Centralise la logique de connexion pour les vues (scènes)
 */
import { io } from 'socket.io-client';

/**
 * Mesure RTT vers le serveur (observabilité). Throttle côté serveur.
 * @param {import('socket.io-client').Socket} socket
 */
function attachMetricsRttPing(socket) {
  if (socket.__zsMetricsRtt) return;
  socket.__zsMetricsRtt = true;
  socket.on('connect', () => {
    const send = () => {
      if (socket.connected) socket.emit('metrics_rtt', Date.now());
    };
    send();
    if (socket.__zsMetricsInterval) clearInterval(socket.__zsMetricsInterval);
    socket.__zsMetricsInterval = setInterval(send, 5000);
  });
}

/**
 * Retourne l'URL de base du serveur (protocol + host + port)
 * En dev Vite (5173/5174) on cible le serveur sur 3000.
 */
export function getServerUrl() {
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  let port = window.location.port || (protocol === 'https:' ? 443 : 3000);
  if (port === '5173' || port === '5174') port = 3000;
  return `${protocol}//${host}:${port}`;
}

/**
 * URL absolue de la manette mobile.
 * Toujours sous-chemin /mobile sur le même hôte que l’API.
 */
export function getMobileJoinUrl() {
  return `${getServerUrl()}/mobile`;
}

/**
 * URL de la page d’accueil (hub : grand écran / manette) — pour QR code unique.
 */
export function getHubUrl() {
  const base = getServerUrl();
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * URL manette avec code partie (QR lobby).
 * @param {string} roomCode
 */
export function getMobileJoinUrlWithRoom(roomCode) {
  const c = String(roomCode || '').trim();
  if (!c) return `${getServerUrl()}/mobile`;
  return `${getServerUrl()}/mobile?r=${encodeURIComponent(c)}`;
}

/**
 * URL de base pour charger des assets (images, vidéo) depuis le serveur.
 */
export function getLobbyBaseUrl() {
  return getServerUrl() + '/';
}

/**
 * Crée ou récupère le socket namespace /display (singleton via registry).
 * @param {Phaser.Data.DataManager} registry - this.registry de la scène
 * @returns {import('socket.io-client').Socket}
 */
export function getOrCreateDisplaySocket(registry) {
  let socket = registry.get('socket');
  if (!socket) {
    // Aligné sur client-mobile : cold start / Wi‑Fi capricieux (ex. Render gratuit, campus).
    socket = io(`${getServerUrl()}/display`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 60000
    });
    attachMetricsRttPing(socket);
    socket.on('disconnect', () => {
      registry.set('displayGatePassed', false);
    });
    registry.set('socket', socket);
  }
  return socket;
}
