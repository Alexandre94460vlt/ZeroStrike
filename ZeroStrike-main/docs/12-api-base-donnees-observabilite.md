# API HTTP, SQLite, observabilité

Toutes les routes ci-dessous sont montées dans [`server/index.js`](../server/index.js). Les routes **`/api/*`** passent par des **rate limiters** (`middleware/httpSecurity.js`).

## Classement

| Méthode | Route | Description |
|---------|--------|-------------|
| GET | `/api/leaderboard` | Query : `limit`, `orderBy` — parsing strict dans `utils/apiInput.js` |
| GET | `/api/leaderboard/player/:name` | Stats d’un joueur ; `404` si inconnu |

Implémentation SQL : **`server/database/LeaderboardService.js`** + schéma **`schema.js`**. Persistance via **`SqlJsLeaderboardAdapter`** (`infra/`) ; chemin fichier **`DB_PATH`** (voir `.env.example`).

## Proxys externes

| Route | Usage |
|-------|--------|
| `GET /api/giphy/:query` | Recherche GIF (clé `GIPHY_API_KEY`) — segment de query sanitizé (`parseGiphyQuerySegment`) |
| `GET /api/randomuser` | Nom aléatoire pour placeholder UI |

Les **clés** ne doivent exister que dans `.env` / secrets hébergeur, jamais dans le dépôt.

## Métriques

`GET /api/metrics` — snapshot interne (`getMetricsSnapshot(gameService.engine, io)`).

- En **production**, si **`METRICS_TOKEN`** est défini : header **`Authorization: Bearer <token>`** requis (sinon `401`).
- Rate limit dédié : `apiMetricsLimiter`.

## Health

`GET /health` — pas de secret, usage orchestration.

## Observabilité ([`server/utils/observability.js`](../server/utils/observability.js))

- Métriques sockets / boucle (TPS, latences agrégées).
- **`METRICS_LOG_INTERVAL_MS`**, **`METRICS_DISABLE`** dans `.env.example`.
- Handlers enregistrés par **`registerSocketMetricsHandler`** sur chaque connexion display/mobile.

## Traces de partie ([`server/utils/gameTrace.js`](../server/utils/gameTrace.js))

Si **`GAME_TRACE`** activé : événements structurés (phases, joins…) — **sans** noms sensibles ni code partie, pour analyse post-mortem.

## Socket : leaderboard depuis display

`get_leaderboard` sur le namespace display (callback) — alternative JSON à l’API REST pour l’UI Phaser.
