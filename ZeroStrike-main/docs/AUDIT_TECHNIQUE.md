# Audit technique — Zero Strike

**Date :** 16 mars 2025 (mis à jour avril 2026 — sécurité HTTP, deps, E2E, sanitisation)  
**Version :** 1.0.0  
**Auditeur :** Senior Software Engineer

---

## 1. Vue d’ensemble du projet

### 1.1 Architecture

Zero Strike est un jeu de tir tactique multijoueur local (jusqu’à 40 joueurs) inspiré de Call of Duty (Search & Destroy). L’architecture est **client-serveur authoritative** :

- **Serveur Node.js** : logique de jeu, physique, état des rounds, WebSockets
- **Client Display** : grand écran (Phaser 3), lobby et rendu de la partie
- **Client Mobile** : smartphones comme manettes (HTML/CSS/JS, nipplejs pour les joysticks)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Express + Socket.io                           │
│  / (hub) · /display · /mobile · /api/leaderboard · /health      │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌────────────────┐   ┌──────────────────┐
│ DisplayCtrl   │   │ MobileController│   │ Leaderboard API  │
└───────┬───────┘   └────────┬───────┘   └────────┬─────────┘
        │                    │                     │
        └────────────────────┼─────────────────────┘
                             ▼
                    ┌────────────────┐
                    │  GameService   │
                    │  (60 TPS loop) │
                    └────────┬───────┘
                             │
    ┌────────────┬───────────┼───────────┬──────────────┐
    ▼            ▼           ▼           ▼              ▼
PlayerSvc  ProjectileSvc  HeroSvc  KillstreakSvc  SQLite (sql.js)
```

### 1.2 Technologies

| Composant | Stack |
|-----------|-------|
| Serveur | Node.js 20+, Express 4.18, Socket.io 4.7, `cors`, `express-rate-limit` |
| Base de données | sql.js (SQLite in-memory/disk) |
| Display | Phaser 3.70, Vite 7 |
| Mobile | Vanilla JS, nipplejs 0.10, Vite 7 |
| Build | Vite (ESM) |

### 1.3 Structure des dossiers

```
ZeroStrike/
├── server/                 # Backend
│   ├── config/constants.js
│   ├── controllers/        # DisplayController, MobileController
│   ├── database/           # LeaderboardService, schema
│   ├── managers/           # PowerUpManager.js
│   ├── models/             # Player, Projectile, Weapon, Heroes, Maps
│   ├── services/           # GameService, PlayerService, ProjectileService, etc.
│   ├── state/              # RoundStateMachine
│   ├── middleware/         # httpSecurity (CORS HTTP, rate limit)
│   ├── utils/physics.js, apiInput.js, sanitizePlayerName.js
│   └── index.js            # Point d'entrée serveur
├── client-display/         # Phaser (grand écran)
│   ├── scenes/             # BootScene, LobbyScene, GameScene
│   ├── services/SocketService.js
│   └── main.js
├── client-mobile/          # Manette smartphone
│   ├── js/controllers/     # JoinController, GameController
│   ├── js/services/SocketService.js
│   └── main.js
├── public/                 # Hub d’accueil (index.html) + assets statiques partagés
├── assets/
│   ├── served/map/         # Previews cartes (servies sous /map/)
│   └── references/radars/  # Captures radar (design, non servies)
├── vendor/kenney/          # Packs Kenney (servis sous /Kenney/ ; tuiles jeu sous /tiles/)
├── data/                   # leaderboard.db (SQLite)
├── tests/                  # gameLogic, leaderboard, physics ; tests/e2e (Playwright)
└── package.json
```

### 1.4 Points d’entrée

| Composant | Fichier | Rôle |
|-----------|---------|------|
| Serveur | `server/index.js` | Express, Socket.io, boucle 60 TPS, routes statiques |
| Hub (accueil) | `public/index.html` | Page statique : choix grand écran (`/display`) ou manette (`/mobile`) |
| Display | `client-display/main.js` | Phaser.Game → BootScene → LobbyScene / GameScene |
| Mobile | `client-mobile/main.js` | JoinController, orientation paysage |
| Tests | `npm test` ; `npm run validate` (test+build) ; `npm run ci:local` (+ e2e) ; voir `docs/GUIDE_VALIDATION.md` | Unitaires + build + smoke HTTP |

---

## 2. Détection de bugs

### 2.1 ~~Critique — Accumulation de strokes sur les cartes de vote (Display)~~ — **Corrigé**

**Fichier :** `client-display/scenes/LobbyScene.js`

Un `Graphics` dédié `leadingBorder` avec `clear()` avant redessinage ; la bordure « en tête » n’est plus empilée sur `block.bg`. Voir `_drawMapCard` et `refreshMapBlockSelection`.

### 2.2 ~~Critique — `force_lobby` sans vérification display host~~ — **Corrigé**

- **DisplayController** : vérifie `socket.id === gameService.displayHostId` avant `forceBackToLobby` (avec réponse d’erreur au client).
- **GameService.forceBackToLobby** : contrôle supplémentaire — seuls `displayHostId`, `hostId` (mobile) ou le reset automatique (`auto-reset`) sont acceptés.

### 2.3 ~~Moyen — Risque de crash si `voteCounts` undefined~~ — **Corrigé**

`updateMapVoteCounts` utilise `const counts = voteCounts || {}` ; `refreshMapBlockSelection` lit `this.lobbyState?.voteCounts || {}`.

### 2.4 ~~Faible — `syncLobbyMapCards` et éléments DOM potentiellement absents~~ — **Corrigé**

**Fichier :** `client-mobile/js/controllers/GameController.js` — garde `countEl`, cache `voteCounts` typé objet, `syncLobbyMapCards({})` après vote ; **Display** `LobbyScene` : `voteText?.setText`.

### 2.5 ~~Faible — `get_context` sans vérification de phase~~ — **Partiellement traité**

**Fichier :** `server/domain/GameEngine.js` — `sendContextToMobile` retourne immédiatement en `LOBBY` / `MATCH_OVER` (chemin prod `GameApp` / `MobileController`). Le `GameService` legacy reste inchangé.

---

## 3. Qualité du code

### 3.1 Duplication

- **GameService** : `_emitPlayerUpdate` et `buildState` sont appelés à de nombreux endroits ; des helpers plus ciblés pourraient réduire la duplication.
- ~~**Logique de sanitisation**~~ : centralisée dans `server/utils/sanitizePlayerName.js` (`sanitizePlayerDisplayName`) — utilisée par `GameEngine`, `GameService`, `LeaderboardService`.

### 3.2 Fonctions complexes

- **GameService.tick()** : ~200 lignes, gère plusieurs phases, bombe, power-ups, killstreaks. À découper en `tickBuyPhase`, `tickActionPhase`, `tickRoundEnd`.
- **GameScene.onStateUpdate()** : mise à jour de nombreux joueurs, projectiles, HUD. Extraire des sous-fonctions (`updatePlayers`, `updateProjectiles`, etc.).

### 3.3 Conventions de nommage

- Globalement cohérent (`camelCase`, `PascalCase` pour les classes).
- `PowerUpManager` dans `GameManager.js` : nom de fichier trompeur.

### 3.4 Recommandations

- Extraire les constantes magiques (ex. `0.35` pour LERP dans GameScene) dans des constantes nommées.
- Documenter les types JSDoc pour les fonctions publiques des services.

---

## 4. Optimisation des performances

### 4.1 Broadcast state à 30 Hz

- `broadcastState()` sérialise tout l’état à chaque tick. Avec 40 joueurs, le payload est volumineux.
- **Piste :** diff uniquement des changements (delta) pour les joueurs/projectiles.

### 4.2 Réaffectation répétée

- **PlayerService.getAll()** : `Array.from(players.values())` à chaque appel si le cache est invalidé. Le cache est déjà utilisé ; vérifier qu’il n’est pas invalidé trop souvent.
- **GameScene** : `this.players = new Map()` puis recréation à chaque `state_update`. Utiliser `Map` avec mise à jour incrémentale.

### 4.3 Appels bloquants

- **LeaderboardService.save()** : `writeFileSync` à chaque kill/plant/defuse. En partie intense, cela peut bloquer.
- **Piste :** bufferiser les écritures et sauvegarder toutes les 100 ms ou toutes les N modifications.

### 4.4 Exemple d’optimisation

```javascript
// LeaderboardService.save() — débouncer
let saveScheduled = false;
function save() {
  if (IS_IN_MEMORY) return;
  if (saveScheduled) return;
  saveScheduled = true;
  setImmediate(() => {
    try {
      writeFileSync(DB_PATH, getDb().export());
    } catch (e) {
      console.error('[Leaderboard] save failed', e.message);
    } finally {
      saveScheduled = false;
    }
  });
}
```

---

## 5. Audit de sécurité

### 5.1 CORS — HTTP (Express) et WebSocket (Socket.io)

- **Source de vérité :** `getAllowedOrigins()` dans `server/middleware/httpSecurity.js` — variable `ALLOWED_ORIGINS` (liste séparée par virgules), sinon en production défaut `https://zerostrike.onrender.com`, sinon `*` en développement.
- **Express :** `cors` appliqué au middleware global (`createCorsMiddleware()`) pour les requêtes `GET` / `HEAD` / `OPTIONS` vers `/api/*` depuis un navigateur tiers.
- **Socket.io :** même politique d’origines sur le serveur HTTP (`Server` options `cors.origin`).

### 5.2 Rate limiting et endpoint métriques

- **`express-rate-limit`** : limites distinctes pour l’API générale, les proxies (`/api/giphy`, `/api/randomuser`) et `/api/metrics` (fenêtre et plafonds configurables via `.env`, voir `.env.example`).
- **`trust proxy`** : `app.set('trust proxy', …)` pour une IP client correcte derrière Render / reverse proxy.
- **`GET /api/metrics`** : en **production**, si `METRICS_TOKEN` est défini, accès réservé à `Authorization: Bearer <token>`.

### 5.3 Routes API — validation (`server/utils/apiInput.js`)

- **Leaderboard** : `parseLeaderboardLimit`, `parseLeaderboardOrderBy` (whitelist alignée sur `LeaderboardService`).
- **Joueur** : `parsePlayerNameParam` (longueur, caractères de contrôle, `decodeURIComponent` sécurisé) — réponse `400` si invalide.
- **Giphy** : `parseGiphyQuerySegment` avant encodage URL vers l’API externe.
- Tests : `tests/apiInput.test.js`.

### 5.4 Variables d’environnement

- `.env` : hors dépôt (`.gitignore`) — OK.
- **`.env.example`** : documente PORT, HOST, DB, CORS, rate limits, `METRICS_TOKEN`, `GIPHY_API_KEY`, observabilité, etc.

### 5.5 Affichage (Display) — texte utilisateur

- Kill feed et commentaires : `sanitizeHudText` dans `client-display/utils/sanitizeDisplay.js` (caractères de contrôle, longueur) avant affichage Phaser — défense en profondeur (le rendu reste canvas, pas du HTML).

### 5.6 Sanitisation des entrées temps réel (serveur)

- **Nom joueur** : suppression de `<>"'&`, limitation à 24 caractères — OK.
- **mapId** : vérifié dans `MAP_LIST` ou `'random'` — OK.
- **weaponId** : vérifié dans `WEAPONS` — OK.

### 5.7 Injection SQL

- **LeaderboardService** : `run()` avec paramètres préparés ; `orderBy` whitelisté ; `limit` numérique — OK.
- Tests d’injection dans `leaderboard.test.js`.

### 5.8 Dépendances npm

- Exécuter `npm audit` régulièrement ; à la mise à jour mars 2026, `npm audit fix` a levé l’avis **high** sur `socket.io-parser` (pièces jointes binaires) — **0 vulnérabilité** après correction.

---

## 6. Revue d’architecture

### 6.1 Points forts

- Séparation claire Display / Mobile / Serveur.
- GameService centralisé et authoritative.
- RoundStateMachine pour les transitions d’état.
- Tests unitaires pour physique, leaderboard et logique de jeu.

### 6.2 Couplage

- **GameService** : dépend de nombreux services (Player, Projectile, Hero, Killstreak, PowerUp, Leaderboard). Un God Object difficile à tester en isolation.
- **Piste :** extraire des modules (RoundManager, BombManager, PowerUpManager déjà utilisé) et injecter les dépendances.

### 6.3 Abstractions

- `PowerUpManager` dans `GameManager.js` : nom de fichier trompeur. Renommer en `PowerUpManager.js` ou déplacer le contenu.

### 6.4 Scalabilité

- Architecture monolithique adaptée à un jeu local (LAN). Pour du cloud, envisager un scaling horizontal avec Redis pour l’état partagé.

---

## 7. Dépendances et configuration

### 7.1 Dépendances

| Package | Version | Risque |
|---------|---------|--------|
| express | ^4.18.2 | OK, maintenance active |
| cors | ^2.x | CORS HTTP |
| express-rate-limit | ^8.x | Limitation de débit `/api` |
| socket.io | ^4.7.2 | OK (audit npm à jour) |
| sql.js | ^1.11.0 | OK |
| nipplejs | ^0.10.0 | OK |
| phaser | ^3.70.0 | OK |
| vite | ^7.3.1 | OK |
| sharp | ^0.33.0 | OK |
| dotenv | ^17.3.1 | OK |

### 7.2 Configuration

- **Hub** : `GET /` sert `public/index.html` via Express ; le hub n’est pas produit par le build Vite du display (test LAN / prod : `npm start` sur `PORT`).
- **Vite** : proxy configuré pour les devs (display, mobile).
- **Dockerfile** : multi-stage, build puis production.
- **docker-compose** : volume `public` en lecture seule.

### 7.3 Recommandations

- Exécuter `npm audit` avant chaque release.
- En production Internet : définir `ALLOWED_ORIGINS`, `METRICS_TOKEN` (si exposition de `/api/metrics`), ne pas commiter `.env`.

---

## 8. Couverture des tests

### 8.1 Tests existants

| Fichier | Couverture |
|---------|------------|
| `physics.test.js` | segmentRectCollision, circleCollision, aabbCollision, normalizeAngle |
| `leaderboard.test.js` | init, recordKill, recordRoundResult, getPlayerStats, injection SQL |
| `gameLogic.test.js` | RoundStateMachine, KillstreakService, sanitisation nom |
| `apiInput.test.js` | parseLeaderboardLimit, orderBy, player name, requête Giphy |

### 8.2 Tests manquants

- **GameService** : ~~`updateSettings`~~, ~~`onPlayerJoin`~~, ~~`onInputMove`~~ couverts.
- **GameEngine** : ~~`startGameWithVote`~~ (refus / countdown / hors lobby) — `tests/gameEngine.test.js`.
- **ProjectileService** : ~~création + tick hors carte~~ — `tests/projectileService.test.js`.
- **PlayerService** : ~~`updateInputMove`, `updatePosition`~~ — `tests/playerService.test.js`.
- **PowerUpManager** : ~~tick vide, setMap, spawn~~ — `tests/powerUpManager.test.js`.
- **Tests E2E** : smoke HTTP `GET /health` (`npm run test:e2e`) ; flux navigateur complet (join → round) reste optionnel.

### 8.3 Exemple de test utile

```javascript
// tests/gameService.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('GameService.updateSettings', () => {
  let gameService;
  beforeEach(() => {
    // Mock displayNamespace, mobileNamespace
    gameService = new GameService(mockDisplay, mockMobile);
    gameService.init();
  });

  it('rejette roundsToWin hors limites', () => {
    const before = gameService.settings.roundsToWin;
    gameService.updateSettings({ roundsToWin: 999 });
    assert.equal(gameService.settings.roundsToWin, before);
  });

  it('accepte roundsToWin dans [1, 15]', () => {
    gameService.updateSettings({ roundsToWin: 5 });
    assert.equal(gameService.settings.roundsToWin, 5);
  });
});
```

---

## 9. Opportunités de refactorisation

| Priorité | Description | Impact |
|----------|-------------|--------|
| ~~High~~ | ~~Vérifier `displayHostId` dans `force_lobby`~~ | Fait (DisplayController + `GameService`) |
| ~~High~~ | ~~Accumulation de strokes (LobbyScene)~~ | Fait (`leadingBorder`) |
| ~~High~~ | ~~Débouncer `LeaderboardService.save()`~~ | Fait (debounce ms + `flushLeaderboardToDisk`) |
| ~~Medium~~ | ~~Restreindre CORS en production~~ | Fait (`ALLOWED_ORIGINS`, CORS HTTP + Socket.io) |
| ~~Medium~~ | ~~Découper `GameService.tick()`~~ | Déjà `_tickBuyPhase` / `_tickActionPhase` / `_tickRoundEnd` |
| ~~Medium~~ | ~~`GameManager.js` → `PowerUpManager.js`~~ | Doublon `GameManager.js` supprimé ; source unique `PowerUpManager.js` |
| ~~Low~~ | ~~Créer `.env.example`~~ | Fait |
| ~~Low~~ | ~~Centraliser `sanitizeName`~~ | `server/utils/sanitizePlayerName.js` |
| Low | Compléter JSDoc (ProjectileService, contrôleurs…) | Documentation — amorcé (`GameApp`, `GameLoopService`, util sanitisation) |

---

## 10. Plan d’action priorisé

### Phase 1 — Urgent (1–2 jours)

1. ~~**Corriger DisplayController.force_lobby**~~ — fait (+ garde-fou `GameService`).
2. ~~**Corriger LobbyScene** (bordure en tête)~~ — fait.
3. ~~**Débouncer LeaderboardService.save()**~~ — fait (`LEADERBOARD_SAVE_DEBOUNCE_MS`, export `flushLeaderboardToDisk`).

### Phase 2 — Court terme (1 semaine)

4. ~~**Restreindre CORS**~~ : fait (`server/middleware/httpSecurity.js`, variable `ALLOWED_ORIGINS`).
5. ~~**Protéger contre voteCounts undefined**~~ — fait (`LobbyScene`, `GameController`).
6. ~~**Créer `.env.example`**~~ : fait (voir racine du dépôt).

### Phase 3 — Moyen terme (2–4 semaines)

7. ~~**Refactoriser GameService.tick()**~~ — déjà découpé (`_tickBuyPhase`, `_tickActionPhase`, `_tickRoundEnd`).
8. ~~**Tests GameService**~~ — `updateSettings`, `onPlayerJoin`, `onInputMove` couverts (`tests/gameService.test.js`).
9. ~~**Renommer GameManager.js**~~ — fichier doublon supprimé ; `PowerUpManager.js` seul.

### Phase 4 — Long terme

10. ~~**Optimisation broadcast**~~ — **fait** : `DISPLAY_STATE_DELTA` (patch JSON + fusion display, resync 3 ticks après changement de phase) ; `SOCKET_COMPRESS` (permessage-deflate). Désactiver : `DISPLAY_STATE_DELTA=0`, `SOCKET_COMPRESS=0`.
11. ~~**Tests E2E**~~ — smoke API : `npm run test:e2e` (Playwright `request`, `tests/e2e/health.spec.js`, `DB_PATH=:memory:` via `playwright.config.js`).
12. **Documentation** : JSDoc — **partiel** (`GameApp`, `GameLoopService`, `sanitizePlayerName.js`, `PlayerService`, `ProjectileService`) ; guide opérationnel `docs/GUIDE_VALIDATION.md`.

---

*Rapport généré à des fins d’audit technique. Les corrections proposées sont des recommandations et doivent être validées avant implémentation.*
