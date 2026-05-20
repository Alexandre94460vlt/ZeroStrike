/**
 * Contrôleur : namespace Socket.io /mobile
 * join_game, input_move, input_aim, input_action, ping, disconnect → délègue au GameService
 */
import { registerSocketMetricsHandler } from '../utils/observability.js';
import { logSocketDisconnect } from '../utils/socketDisconnectLog.js';

/**
 * Crée un throttle par événement pour un socket donné.
 * Retourne un handler qui ignore les appels plus fréquents que `minIntervalMs`.
 * Protège contre les clients malveillants qui envoient des floods d'événements.
 */
function throttle(fn, minIntervalMs) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall < minIntervalMs) return;
    lastCall = now;
    fn(...args);
  };
}

export function registerMobileController(mobileNamespace, gameApp) {
  mobileNamespace.on('connection', (socket) => {
    console.log('[Mobile] Joueur connecté:', socket.id);
    registerSocketMetricsHandler(socket, 'mobile');

    // join_game : 1 seule fois par connexion suffit (500 ms de garde anti double-tap)
    socket.on('join_game', throttle((data) => {
      gameApp.dispatch({ type: 'player_join', payload: { ...data, socketId: socket.id } });
    }, 500));

    // vote_map : 1 vote toutes les 300 ms max
    socket.on('vote_map', throttle((data) => {
      gameApp.dispatch({ type: 'vote_map', payload: { socketId: socket.id, mapId: data?.mapId } });
    }, 300));

    // shop_buy : 1 achat toutes les 200 ms (évite double-tap accidentel)
    socket.on('shop_buy', throttle((data) => {
      gameApp.dispatch({ type: 'shop_buy', payload: { socketId: socket.id, data } });
    }, 200));

    // hero_select : 1 sélection toutes les 300 ms
    socket.on('hero_select', throttle((data) => {
      gameApp.dispatch({ type: 'hero_select', payload: { socketId: socket.id, data } });
    }, 300));

    socket.on('force_lobby', throttle((cb) => {
      if (gameApp.engine.hostId !== socket.id) {
        if (typeof cb === 'function') cb({ ok: false, error: 'not_mobile_host' });
        return;
      }
      gameApp.dispatch({ type: 'force_lobby', payload: { requesterId: socket.id, reason: 'mobile_host' } });
      if (typeof cb === 'function') cb({ ok: true });
    }, 1000));

    socket.on('get_context', throttle(() => {
      gameApp.dispatch({ type: 'get_context', payload: { socketId: socket.id } });
    }, 100));

    // Inputs temps-réel : throttle sur les mouvements, mais JAMAIS sur l'arrêt (force=0)
    // Sinon le joueur continue de bouger après avoir relâché le joystick
    let lastInputMove = 0;
    socket.on('input_move', (data) => {
      const force = Math.max(0, Math.min(1, Number(data?.force) ?? 0));
      const isStop = force === 0;
      const now = Date.now();
      if (!isStop && now - lastInputMove < 16) return;
      if (!isStop) lastInputMove = now;
      if (process.env.DEBUG) console.log('[input_move]', socket.id, data);
      gameApp.dispatch({ type: 'input_move', payload: { socketId: socket.id, data } });
    });

    socket.on('input_aim', throttle((data) => {
      gameApp.dispatch({ type: 'input_aim', payload: { socketId: socket.id, data } });
    }, 16));

    // input_action : 50 ms (cadence max des armes = 50 ms pour le SMG)
    socket.on('input_action', throttle((data) => {
      gameApp.dispatch({ type: 'input_action', payload: { socketId: socket.id, data } });
    }, 50));

    // Relai domaine → display uniquement (pas de broadcast aux autres mobiles).
    socket.on('player_comment', throttle((data) => {
      gameApp.dispatch({ type: 'player_comment', payload: { socketId: socket.id, data } });
    }, 500));

    socket.on('player_ready', (data) => {
      gameApp.dispatch({ type: 'player_ready', payload: { socketId: socket.id, ready: data?.ready !== false } });
    });

    socket.on('ping', () => {
      socket.emit('pong', Date.now());
    });

    socket.on('disconnect', (reason) => {
      logSocketDisconnect('mobile', socket.id, reason);
      gameApp.dispatch({ type: 'player_disconnect', payload: { socketId: socket.id } });
    });
  });
}
