/**
 * Service : URL du serveur et création du socket namespace /mobile
 */
import { io } from 'socket.io-client';

/**
 * Mesure RTT vers le serveur (observabilité).
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

export function getServerUrl() {
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const host = window.location.hostname;
  let port = window.location.port || (protocol === 'https' ? 443 : 3000);
  if (port === '5173' || port === '5174') port = 3000;
  return `${protocol}://${host}:${port}`;
}

/**
 * Crée une connexion Socket.io vers le namespace /mobile
 * @returns {import('socket.io-client').Socket}
 */
/** Options client : cold start possible sur hébergement gratuit (ex. Render après veille). */
const MOBILE_SOCKET_OPTIONS = {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 25,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  // Handshake Engine.IO : laisser ~1 min avant d’abandonner la première connexion
  timeout: 60000
};

export function createMobileSocket() {
  const socket = io(`${getServerUrl()}/mobile`, MOBILE_SOCKET_OPTIONS);
  attachMetricsRttPing(socket);
  return socket;
}
