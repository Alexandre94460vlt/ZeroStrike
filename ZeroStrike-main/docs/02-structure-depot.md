# Structure du dépôt

Arborescence logique (non exhaustive : seuls les dossiers les plus importants sont listés).

## Racine

| Élément | Rôle |
|---------|------|
| `package.json` | Scripts npm, dépendances, `engines.node >= 20` |
| `server/index.js` | Point d’entrée serveur : Express, Socket.io, `GameApp`, boucle jeu |
| `README.md`, `INSTALL.md`, `MAINTENANCE.md`, `AUDIT_TECHNIQUE.md` | Doc utilisateur / ops / audit |
| `.env.example` | Variables d’environnement documentées |
| `render.yaml` | Blueprint déploiement Render |
| `docker-compose.yml` | Stack conteneurisée (si présent) |

## `server/`

| Dossier / fichier | Rôle |
|-------------------|------|
| `index.js` | HTTP, namespaces Socket.io, routes API, static |
| `app/GameApp.js` | Colle domaine + ports : ticks, broadcast, effets |
| `domain/GameEngine.js` | Moteur : dispatch actions, tick simulation |
| `domain/effects.js` | Types d’effets déclaratifs (emit, stats, schedule, log, game_trace) |
| `domain/ports.js` | Interfaces `SocketPort`, `LeaderboardPort`, `SchedulerPort` |
| `controllers/` | `DisplayController.js`, `MobileController.js` — événements socket → `dispatch` |
| `services/` | `GameLoopService.js` (60 TPS / 30 Hz state), `GameService.js`, `HeroService.js`, `PlayerService.js`, `ProjectileService.js` |
| `models/` | `Player.js`, `Weapon.js`, `Projectile.js`, `Heroes.js`, `maps/` |
| `models/maps/` | `Maps.js`, `Map.js`, builders ASCII, `tiledMapParser.js` |
| `state/RoundStateMachine.js` | États de round et transitions valides |
| `middleware/httpSecurity.js` | CORS, rate limiting Express |
| `config/` | `constants.js` (gameplay), `displayAuth.js` |
| `database/` | Schéma SQLite, `LeaderboardService.js` |
| `infra/` | `SocketIoAdapter.js`, `SqlJsLeaderboardAdapter.js`, `TimeoutScheduler.js` |
| `utils/` | Physique, delta display, barrière domaine, API input, observabilité, traces partie |

## `client-display/`

Build Vite → `dist/` servi sous `/display`.

| Zone | Rôle |
|------|------|
| `main.js` | Phaser.Game + polices |
| `config/` | `gameConfig.js` (scènes), `constants.js`, `uiTheme.js` |
| `views/` | `BootScene`, `LobbyScene`, `GameScene` ; sous `game/` : HUD, map, sprites héros, effets, `stateUpdate`, `updateLoop` |
| `controllers/gameSocketController.js` | Connexion `/display`, handlers `state_update`, auth display |
| `services/SocketService.js` | Client socket.io |
| `utils/` | Audio, merge delta, sanitize, préférences, gate mot de passe display |

## `client-mobile/`

Build Vite → `dist/` servi sous `/mobile`.

| Zone | Rôle |
|------|------|
| `js/main.js` | Plein écran, anti double-tap zoom, init `JoinController` |
| `js/controllers/` | `JoinController`, `GameController`, `connectionUi` |
| `js/services/SocketService.js` | Namespace `/mobile` |

## `public/`

Hub, assets légers, éventuellement fichiers statiques non bundlés par Vite (selon évolution du projet).

## `maps/`

Fichiers **Tiled** exportés (`.tmj`, `.tsx`, tuiles) consommés par le parseur serveur et chargés côté display pour le rendu décor.

## `assets/served/map/`

Assets cartes servis sous **`/map/`** (chemins publics configurés dans `server/index.js`).

## `vendor/kenney/`

Packs graphiques (ex. scribble-dungeons) ; certaines routes Express exposent `/Kenney/`, `/tiles/`.

## `shared/`

Modules importables **serveur + clients** (ESM) :

- `gamePresets.js` — IDs presets et `applyPresetToSettings`
- `heroBodyTint.js` — teinte sprite corps par `heroId`

## `tests/`

- `*.test.js` — tests Node (lancés par `scripts/run-tests.mjs`)
- `e2e/` — scénarios Playwright

## `scripts/`

Utilitaires : tests, spritesheet, conversion Tiled → ASCII (`tiled-to-ascii.mjs`), etc.

## `docs/`

Documentation projet (ce dossier) + sous-dossiers `maps/`, `design/`, `screenshots/`.
