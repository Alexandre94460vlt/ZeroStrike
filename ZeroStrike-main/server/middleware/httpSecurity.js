/**
 * CORS HTTP (aligné sur Socket.io) + rate limiting des routes /api.
 * trust proxy : nécessaire derrière Render / nginx pour l’IP client (rate limit).
 */
import cors from 'cors';
import rateLimit from 'express-rate-limit';

/** @returns {string[]|'*'} */
export function getAllowedOrigins() {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (process.env.NODE_ENV === 'production') {
    return ['https://zerostrike.onrender.com'];
  }
  return '*';
}

export function createCorsMiddleware() {
  const origins = getAllowedOrigins();
  if (origins === '*') {
    return cors({ origin: true, methods: ['GET', 'HEAD', 'OPTIONS'] });
  }
  return cors({
    origin: origins,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    credentials: false
  });
}

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

function numEnv(key, def) {
  const n = parseInt(process.env[key], 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

/** Routes API générales (leaderboard, etc.) */
export const apiGeneralLimiter = rateLimit({
  windowMs,
  max: numEnv('RATE_LIMIT_API_MAX', 200),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' }
});

/** Proxies externes (Giphy, randomuser) — plus restrictif */
export const apiProxyLimiter = rateLimit({
  windowMs,
  max: numEnv('RATE_LIMIT_PROXY_MAX', 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' }
});

/** Métriques (scraping / DoS) */
export const apiMetricsLimiter = rateLimit({
  windowMs,
  max: numEnv('RATE_LIMIT_METRICS_MAX', 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' }
});
