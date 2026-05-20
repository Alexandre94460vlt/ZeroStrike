/**
 * Observabilité : logs structurés JSON, métriques boucle de jeu (TPS) et latence socket (RTT).
 */

const INTERVAL_MS = Math.max(5000, Number(process.env.METRICS_LOG_INTERVAL_MS) || 15000);
const DISABLED = process.env.METRICS_DISABLE === '1' || process.env.METRICS_DISABLE === 'true';

let sumPhysicsSteps = 0;
let outerLoopCount = 0;
let maxWallMs = 0;

/** Dernier snapshot émis (servi par GET /api/metrics) */
let lastSnapshot = null;

const rttByNs = { display: [], mobile: [] };
const MAX_RTT = 64;

/**
 * Log une ligne JSON sur stdout (filtrable par outils type Loki / journald).
 * @param {'info'|'warn'|'error'} level
 * @param {string} event
 * @param {Record<string, unknown>} data
 */
export function logStructured(level, event, data = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    service: 'zero-strike',
    ...data
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function trimRtt(arr) {
  while (arr.length > MAX_RTT) arr.shift();
}

/**
 * Enregistre une mesure RTT client → serveur (événement metrics_rtt).
 * @param {'display'|'mobile'} ns
 * @param {number} rttMs
 */
export function recordSocketRtt(ns, rttMs) {
  if (!Number.isFinite(rttMs) || rttMs < 0 || rttMs > 120000) return;
  const bucket = rttByNs[ns];
  if (!bucket) return;
  bucket.push(rttMs);
  trimRtt(bucket);
}

/**
 * Appelé à chaque itération de la boucle de jeu (GameLoopService).
 * @param {{ physicsSteps: number, wallMs: number }} p
 */
export function recordGameLoopTick({ physicsSteps, wallMs }) {
  if (DISABLED) return;
  sumPhysicsSteps += physicsSteps;
  outerLoopCount += 1;
  maxWallMs = Math.max(maxWallMs, wallMs);
}

/**
 * Throttle par socket pour metrics_rtt (anti-flood).
 */
export function registerSocketMetricsHandler(socket, namespace) {
  socket.on('metrics_rtt', (clientTs) => {
    if (typeof clientTs !== 'number' || !Number.isFinite(clientTs)) return;
    const now = Date.now();
    if (now - (socket._metricsRttLast || 0) < 1500) return;
    socket._metricsRttLast = now;
    const rtt = now - clientTs;
    recordSocketRtt(namespace, rtt);
  });
}

function buildSnapshot(gameService, io) {
  const d = rttByNs.display;
  const m = rttByNs.mobile;
  return {
    ts: new Date().toISOString(),
    round_state: gameService.roundState,
    players_connected: gameService.playerService.players.size,
    sockets: {
      display: io.of('/display').sockets.size,
      mobile: io.of('/mobile').sockets.size
    },
    rtt_ms: {
      display: d.length ? { p50: median(d), max: Math.max(...d), n: d.length } : null,
      mobile: m.length ? { p50: median(m), max: Math.max(...m), n: m.length } : null
    },
    last_loop: lastSnapshot?.loop || null
  };
}

/**
 * Snapshot pour GET /api/metrics (sans secrets).
 */
export function getMetricsSnapshot(gameService, io) {
  return buildSnapshot(gameService, io);
}

/**
 * Démarre l'émission périodique de logs structurés (TPS physique, fréquence boucle externe, etc.).
 */
export function startPeriodicMetrics(io, gameService) {
  if (DISABLED) {
    logStructured('info', 'metrics_disabled', { reason: 'METRICS_DISABLE=1' });
    return () => {};
  }

  const intervalId = setInterval(() => {
    const elapsedSec = INTERVAL_MS / 1000;
    const physicsTps = sumPhysicsSteps / elapsedSec;
    const outerHz = outerLoopCount / elapsedSec;

    const snap = {
      physics_tps: Math.round(physicsTps * 10) / 10,
      outer_loop_hz: Math.round(outerHz * 10) / 10,
      max_tick_wall_ms: maxWallMs,
      round_state: gameService.roundState,
      players: gameService.playerService.players.size,
      sockets_display: io.of('/display').sockets.size,
      sockets_mobile: io.of('/mobile').sockets.size
    };

    const d = rttByNs.display;
    const m = rttByNs.mobile;
    if (d.length) {
      snap.rtt_display_ms_p50 = median(d);
      snap.rtt_display_ms_max = Math.max(...d);
    }
    if (m.length) {
      snap.rtt_mobile_ms_p50 = median(m);
      snap.rtt_mobile_ms_max = Math.max(...m);
    }

    lastSnapshot = { loop: { ...snap }, at: new Date().toISOString() };
    logStructured('info', 'game_metrics', snap);

    sumPhysicsSteps = 0;
    outerLoopCount = 0;
    maxWallMs = 0;
  }, INTERVAL_MS);

  return function stopPeriodicMetrics() {
    clearInterval(intervalId);
  };
}
