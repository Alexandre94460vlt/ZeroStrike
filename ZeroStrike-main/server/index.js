/**
 * Zero Strike — Serveur Authoritative
 *
 * Architecture :
 *   Express (HTTP static) + Socket.io (/display, /mobile)
 *   → GameApp (domaine pur + adaptateurs I/O, 60 TPS via GameLoopService)
 *   → SQLite (classement)
 *   Maps : grilles ASCII locales (`models/maps/`, pas de base de données externe)
 *
 * Découpage type MVC : controllers/ (HTTP + sockets), services/ (orchestration),
 * domain/ (moteur), models/ (+ models/maps/ pour les cartes), middleware/, infra/, database/.
 *
 * Ordre de démarrage :
 *   1. main() : classement SQLite + init GameService
 *   2. startGameLoop() : boucle 60 TPS (après init complète)
 *   3. httpServer.listen() : écoute les connexions
 *
 * Arrêt (SIGINT / SIGTERM) : métriques + boucle jeu → flush SQLite →
 * io.close() (Engine.io + fermeture HTTP). Second signal = sortie forcée.
 */
import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startGameLoop } from './services/GameLoopService.js';
import { GameApp } from './app/GameApp.js';
import { registerDisplayController } from './controllers/DisplayController.js';
import { registerMobileController } from './controllers/MobileController.js';
import { getMetricsSnapshot, startPeriodicMetrics } from './utils/observability.js';
import { SocketIoAdapter } from './infra/SocketIoAdapter.js';
import { TimeoutScheduler } from './infra/TimeoutScheduler.js';
import { SqlJsLeaderboardAdapter } from './infra/SqlJsLeaderboardAdapter.js';
import {
  getAllowedOrigins,
  createCorsMiddleware,
  apiGeneralLimiter,
  apiProxyLimiter,
  apiMetricsLimiter
} from './middleware/httpSecurity.js';
import {
  parseLeaderboardLimit,
  parseLeaderboardOrderBy,
  parsePlayerNameParam,
  parseGiphyQuerySegment
} from './utils/apiInput.js';
import * as LeaderboardService from './database/LeaderboardService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(gameService) {
  await gameService.leaderboardPort.init();
  gameService.init();
}

const app = express();
/** Derrière Render / reverse proxy : IP correcte pour le rate limiting */
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1) || 1);
app.use(createCorsMiddleware());

// Évite les vieux bundles en cache pendant le dev (Ctrl+F5 non requis).
function noStore(res) {
  res.setHeader('Cache-Control', 'no-store');
}

const httpServer = createServer(app);
const socketCorsOrigin = getAllowedOrigins();
const socketCompress =
  process.env.SOCKET_COMPRESS !== '0' && process.env.SOCKET_COMPRESS !== 'false';
const io = new Server(httpServer, {
  cors: {
    origin: socketCorsOrigin === '*' ? true : socketCorsOrigin
  },
  // Tolérance mobile / onglet en arrière-plan / pics CPU (évite ping timeout trop agressifs).
  pingInterval: 25000,
  pingTimeout: 30000,
  ...(socketCompress
    ? {
        perMessageDeflate: {
          threshold: 256,
          zlibDeflateOptions: { level: 6 },
          zlibInflateOptions: { chunkSize: 10 * 1024 }
        }
      }
    : {})
});

// --- Vue : fichiers statiques (HTML/JS/CSS des clients) ---
const rootDir = join(__dirname, '..');
app.use(express.static(join(rootDir, 'public')));
app.use('/display', express.static(join(rootDir, 'client-display', 'dist'), { setHeaders: noStore }));
app.use('/mobile', express.static(join(rootDir, 'client-mobile', 'dist'), { setHeaders: noStore }));
// Assets cartes servis sous /map/ (fichiers dans assets/served/map/)
app.use('/map', express.static(join(rootDir, 'assets', 'served', 'map')));
/** Cartes Tiled (.tmj, .tsx) pour le display — chemins /maps/tiled/... */
app.use('/maps', express.static(join(rootDir, 'maps')));
// Packs Kenney — URL publique inchangée /Kenney/ (fichiers dans vendor/kenney/)
app.use('/Kenney', express.static(join(rootDir, 'vendor', 'kenney')));
/** Tuiles jeu (scribble-dungeons) : display charge `/tiles/*.png`. */
const scribbleTilesDir = join(
  rootDir,
  'vendor',
  'kenney',
  'kenney_scribble-dungeons',
  'PNG',
  'Default (64px)'
);
app.use('/tiles', express.static(scribbleTilesDir));

// --- Health check (Render / orchestrateurs) ---
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'zero-strike' });
});

/** Page d’accueil : `public/index.html` (hub) servie par express.static pour GET / */
app.get('/display', (req, res) => {
  noStore(res);
  res.sendFile(join(rootDir, 'client-display', 'dist', 'index.html'));
});
app.get('/mobile', (req, res) => {
  noStore(res);
  res.sendFile(join(rootDir, 'client-mobile', 'dist', 'index.html'));
});

// --- API classement (stats joueurs) ---
app.get('/api/leaderboard', apiGeneralLimiter, (req, res) => {
  try {
    const limit = parseLeaderboardLimit(req.query.limit);
    const orderBy = parseLeaderboardOrderBy(req.query.orderBy);
    const rows = LeaderboardService.getLeaderboard(limit, orderBy);
    res.json({ leaderboard: rows });
  } catch (err) {
    console.error('[API] leaderboard', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
app.get('/api/leaderboard/player/:name', apiGeneralLimiter, (req, res) => {
  try {
    const name = parsePlayerNameParam(req.params.name);
    if (!name) return res.status(400).json({ error: 'Nom invalide' });
    const stats = LeaderboardService.getPlayerStats(name);
    if (!stats) return res.status(404).json({ error: 'Joueur inconnu' });
    res.json(stats);
  } catch (err) {
    console.error('[API] player stats', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Proxy APIs externes (clés côté serveur uniquement) ---
app.get('/api/giphy/:query', apiProxyLimiter, async (req, res) => {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return res.status(503).json({ error: 'Giphy non configuré' });
  const query = encodeURIComponent(parseGiphyQuerySegment(req.params.query));
  try {
    const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${query}&limit=1&rating=g`);
    const data = await r.json();
    const url = data?.data?.[0]?.images?.fixed_height_small?.url || data?.data?.[0]?.images?.downsized?.url;
    if (!url) return res.status(404).json({ error: 'Aucun GIF trouvé' });
    res.json({ url });
  } catch (err) {
    console.error('[API] giphy', err);
    res.status(500).json({ error: 'Erreur Giphy' });
  }
});

app.get('/api/randomuser', apiProxyLimiter, async (req, res) => {
  try {
    const r = await fetch('https://randomuser.me/api/?results=1&inc=name');
    const data = await r.json();
    const u = data?.results?.[0]?.name;
    const name = u ? `${u.first} ${u.last}`.trim() : 'Joueur';
    res.json({ name });
  } catch (err) {
    console.error('[API] randomuser', err);
    res.status(500).json({ name: 'Joueur' });
  }
});

// --- Namespaces Socket.io ---
const displayNamespace = io.of('/display');
const mobileNamespace = io.of('/mobile');

// --- App : moteur (domaine) + ports I/O ---
const socketPort = new SocketIoAdapter({ displayNamespace, mobileNamespace });
const schedulerPort = new TimeoutScheduler();
const leaderboardPort = new SqlJsLeaderboardAdapter();
const gameService = new GameApp({ socketPort, schedulerPort, leaderboardPort });

// --- Métriques HTTP (optionnel : METRICS_TOKEN + Bearer en production) ---
function metricsAuth(req, res, next) {
  const tok = process.env.METRICS_TOKEN;
  if (!tok || process.env.NODE_ENV !== 'production') return next();
  const auth = req.headers.authorization;
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (bearer !== tok) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.get('/api/metrics', apiMetricsLimiter, metricsAuth, (req, res) => {
  try {
    res.json(getMetricsSnapshot(gameService.engine, io));
  } catch (err) {
    console.error('[API] metrics', err);
    res.status(500).json({ error: 'metrics_unavailable' });
  }
});

// --- Contrôleurs : liaison Socket.io → GameService ---
registerDisplayController(displayNamespace, gameService);
registerMobileController(mobileNamespace, gameService);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Attend que SQLite et le GameService soient prêts AVANT de démarrer
await main(gameService);

let stopGameLoop = () => {};
let stopPeriodicMetrics = () => {};
let shuttingDown = false;
/** @type {ReturnType<typeof setTimeout> | null} */
let shutdownForceTimer = null;

function gracefulShutdown(signal) {
  if (shuttingDown) {
    console.error(`[shutdown] ${signal} forced exit (second signal)`);
    process.exit(1);
  }
  shuttingDown = true;
  stopPeriodicMetrics();
  stopGameLoop();
  try {
    LeaderboardService.flushLeaderboardToDisk();
  } catch (e) {
    console.error(`[shutdown] ${signal} leaderboard flush`, e);
  }

  shutdownForceTimer = setTimeout(() => {
    shutdownForceTimer = null;
    console.error(`[shutdown] ${signal} forced exit (timeout)`);
    process.exit(1);
  }, 10000);

  io.close((err) => {
    if (shutdownForceTimer !== null) {
      clearTimeout(shutdownForceTimer);
      shutdownForceTimer = null;
    }
    if (err) console.error(`[shutdown] ${signal} io.close`, err);
    process.exit(err ? 1 : 0);
  });
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Boucle de jeu 60 TPS — démarrée après l'init complète
stopGameLoop = startGameLoop(gameService);

httpServer.listen(PORT, HOST, () => {
  console.log(`Zero Strike Server running on http://${HOST}:${PORT}`);
  console.log(`  Accueil (hub): http://localhost:${PORT}/`);
  console.log(`  Display: http://localhost:${PORT}/display`);
  console.log(`  Mobile:  http://localhost:${PORT}/mobile`);
  console.log(`  API classement: http://localhost:${PORT}/api/leaderboard`);
  console.log(`  Métriques: http://localhost:${PORT}/api/metrics`);
  stopPeriodicMetrics = startPeriodicMetrics(io, gameService.engine);
});
