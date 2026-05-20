# Serveur : racine HTTP et fichiers statiques

Le fichier [`server/index.js`](../server/index.js) constitue le point d’entrée unique après `npm start` / `node server/index.js`.

## Ordre de démarrage (commenté dans le code)

1. Initialisation **sql.js** + **GameApp** (`main(gameService)`).
2. Démarrage de la **boucle de jeu** (`startGameLoop`) — 60 TPS, diffusion d’état ~30 Hz.
3. **`httpServer.listen`** sur `HOST` (défaut `0.0.0.0`) et `PORT` (défaut `3000`).

Arrêt propre sur **SIGINT** / **SIGTERM** : métriques, arrêt boucle, flush SQLite, fermeture Socket.io + HTTP.

## Express

- **`trust proxy`** : configurable via `TRUST_PROXY` (important pour le rate limiting derrière Render/nginx).
- **CORS** : middleware dédié (`createCorsMiddleware` depuis `middleware/httpSecurity.js`).
- **Headers `Cache-Control: no-store`** sur les SPAs display/mobile pour éviter bundles obsolètes en cache.

## Routes statiques principales

| Préfixe | Répertoire physique | Usage |
|---------|---------------------|--------|
| `/` (défaut) | `public/` | Hub, fichiers publics |
| `/display` | `client-display/dist/` | SPA grand écran |
| `/mobile` | `client-mobile/dist/` | SPA manette |
| `/map` | `assets/served/map/` | Assets cartes |
| `/maps` | `maps/` | Fichiers Tiled (`.tmj`, etc.) |
| `/Kenney` | `vendor/kenney/` | Pack Kenney (chemins historiques) |
| `/tiles` | sous-dossier PNG scribble-dungeons | Tuiles décor display |

Les routes **`GET /display`** et **`GET /mobile`** renvoient explicitement `index.html` du build (en plus du static), pour le routage SPA.

## Health check

`GET /health` → `200` + JSON `{ ok: true, service: 'zero-strike' }` — utilisé par les plateformes type Render.

## Configuration Socket.io (aperçu)

- Namespaces : **`/display`** et **`/mobile`** (voir [Sockets](04-sockets-namespaces-evenements.md)).
- **CORS** aligné sur `getAllowedOrigins()`.
- **Compression** WebSocket (`perMessageDeflate`) sauf si `SOCKET_COMPRESS` vaut `0` / `false`.
- `pingInterval` / `pingTimeout` fixés dans `index.js` pour la détection de déconnexion.

## Enregistrement des contrôleurs

Après instanciation de `GameApp` avec les adaptateurs (`SocketIoAdapter`, `TimeoutScheduler`, `SqlJsLeaderboardAdapter`) :

- `registerDisplayController(displayNamespace, gameService)`
- `registerMobileController(mobileNamespace, gameService)`

Voir le même fichier pour les routes **`/api/leaderboard`**, **`/api/giphy/:query`**, **`/api/randomuser`**, **`/api/metrics`** (détail dans [API et observabilité](12-api-base-donnees-observabilite.md)).
