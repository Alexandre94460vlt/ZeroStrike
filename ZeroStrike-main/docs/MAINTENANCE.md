# Zero Strike — Manuel de maintenance

## Redémarrage du serveur

- **Lancement manuel** : arrêter le processus (Ctrl+C dans le terminal) puis relancer `npm start` (après un éventuel `npm run build` si le code des clients a changé).
- **Docker** : `docker-compose down` puis `docker-compose up --build` (ou `docker-compose up -d` pour lancer en arrière-plan).

---

## Accès (hub et LAN)

- **Adresse à partager sur le réseau** : `http://<IP>:<PORT>/` — page d’accueil (choix **Grand écran** ou **Manette**). Raccourcis directs : `/display`, `/mobile` (équivalent après navigation).
- **QR code (lobby display)** : pointe vers l’accueil `…/` ; l’URL affichée en texte peut rester le lien direct `…/mobile` (voir [INSTALL.md](INSTALL.md#5-accéder-au-jeu)).
- **Si `/` ne s’affiche pas** : confirmer que le **serveur Node** est lancé (`npm start` ou Docker), le bon **port** (`PORT`), et la présence de `public/index.html`. Le hub **n’est pas** servi par le seul client Vite (`npm run dev:display`, ex. port 5173) — pour tester l’accueil comme en LAN, utiliser le port du serveur (souvent 3000).

---

## Logs

- Les messages du serveur s’affichent dans la **console** où `npm start` (ou `docker-compose up`) a été lancé.
- Exemples de logs utiles :
  - `[Display] Client connecté: <id>` — un affichage s’est connecté
  - `[Mobile] Joueur connecté: <id>` — un joueur mobile s’est connecté
  - Erreurs Node (stack traces) en cas de crash

Il n’y a pas de fichiers de log par défaut ; pour les conserver, rediriger la sortie (ex. `npm start > server.log 2>&1`) ou utiliser un outil de gestion de processus (PM2, etc.).

### Observabilité (métriques & JSON structuré)

- **Logs JSON** : toutes les `METRICS_LOG_INTERVAL_MS` (défaut **15 s**), une ligne `game_metrics` est émise sur stdout avec notamment `physics_tps` (ticks de simulation `GameEngine.tick` / s, cible ~60), `outer_loop_hz` (fréquence de la boucle planifiée, cible ~60), `max_tick_wall_ms`, `round_state`, compteurs de sockets, et latences RTT agrégées (`rtt_display_ms_p50`, `rtt_mobile_ms_p50`, etc.) si les clients envoient `metrics_rtt`.
- **Événements de partie** : `match_countdown_started`, `round_phase`, `match_force_lobby` (voir `server/utils/observability.js` et le moteur `server/domain/GameEngine.js`).
- **HTTP** : `GET /api/metrics` — instantané (état partie, sockets, dernière ligne `game_metrics` si déjà émise). En **production**, si `METRICS_TOKEN` est défini dans `.env`, l’endpoint exige `Authorization: Bearer <token>`. Rate limiting global sur `/api/*` (voir `.env.example`).
- Variables : `METRICS_LOG_INTERVAL_MS`, `METRICS_DISABLE=1` (désactive les logs périodiques `game_metrics`, pas l’endpoint ni le RTT côté clients), `METRICS_TOKEN` (optionnel, prod). Voir [`.env.example`](.env.example).

### Affichage & audio (client Display)

- Menu lobby **AFFICHAGE & AUDIO** : réduction des effets (flashs, particules, secousses, vignette, etc.) et curseur de volume des effets sonores (Web Audio).
- Stockage **localStorage** (`zs_display_reduce_fx`, `zs_display_room_mode`, `zs_display_master_volume`) — pas de serveur. Les options s’appliquent au **chargement de la scène de jeu** ; après modification dans le lobby, lancer une nouvelle partie pour voir l’effet visuel complet.
- **Mode salle** : vignette allégée, **sans** mélange MULTIPLY (meilleure lisibilité des couleurs sur vidéoprojecteur). Indépendant de « réduire les effets » (particules / secousses).

---

## Fichiers de configuration et de jeu (MVC)

| Fichier / dossier | Rôle |
|-------------------|------|
| `server/models/Map.js` | Carte (dimensions, murs, sites de bombe). Modifier pour changer la géométrie (ex. 1920×1080). `server/data/map.js` réexporte pour compatibilité. |
| `server/config/constants.js` | Constantes de partie : `ROUND_DURATION`, `BOMB_TIMER`, `DEFUSE_RADIUS`, précision (`MOVE_INACCURACY_*`, `SPRAY_*` pour rafale / récupération). |
| `shared/gamePresets.js` | Profils **FUN / COMPETE / DEMO_BUT / CUSTOM** : paquets de paramètres (BO, argent, power-ups, DM kill limit) et multiplicateurs gunplay (spray, marche). Le host envoie `gamePreset` via `update_settings` ; le serveur applique le bundle (sauf **CUSTOM**). |
| `server/models/Player.js` | Modèle joueur (vitesse, rayon, munitions par défaut). |
| `server/models/Projectile.js` | Modèle projectile (vitesse, dégâts). |
| `server/domain/GameEngine.js` | **Moteur domaine (pur)** : règles de partie (rounds, bombe, scores) + effets déclaratifs (pas de Socket.io/DB). |
| `server/app/GameApp.js` | **Application** : exécute les effets via les ports (Socket, leaderboard, scheduler). |
| `server/infra/` | Adaptateurs I/O (`SocketIoAdapter`, `SqlJsLeaderboardAdapter`, `TimeoutScheduler`). |
| `server/services/GameService.js` | Legacy (référence historique / tests existants). Ne plus ajouter de features ici. |
| `server/services/PlayerService.js` | Gestion des joueurs (spawn, déplacement, collisions). |
| `server/services/ProjectileService.js` | Gestion des projectiles (création, collisions). |
| `public/` | Hub d’accueil (`index.html` sur `/`), assets statiques : images (ex. `LobbyImage.png`), vidéo (ex. `lobby_bg.mp4`), `characters/` pour les sprites. |
| `client-display/`, `client-mobile/` | Code des clients ; après modification, refaire `npm run build` puis redémarrer le serveur. |
| `.github/workflows/ci.yml` | **GitHub Actions** : sur push/PR (`main`/`master`) — `npm ci` → `npm test`, puis job **build** (`npm run build`) + artefact `client-dist` (7 jours). Nécessite un `package-lock.json` commité. |
| `server/database/LeaderboardService.js` | Stats SQLite : `LEADERBOARD_SAVE_DEBOUNCE_MS` (voir `.env.example`) espace les écritures disque ; `flushLeaderboardToDisk()` pour forcer une sauvegarde (ex. arrêt propre). |

---

## Mises à jour des dépendances

- Voir les mises à jour disponibles : `npm outdated`
- Mettre à jour (dans les limites du `package.json`) : `npm update`
- Après mise à jour, relancer un build et des tests :  
  `npm run build` puis `npm start`

Pour une mise à jour majeure (ex. nouvelle version de Phaser ou Socket.io), modifier les versions dans `package.json` puis exécuter `npm install` et vérifier que le jeu et le build fonctionnent.

---

## Modifications courantes

### Changer le port du serveur

- Variable d’environnement : `PORT=8080 npm start`
- Ou dans le code : `server/index.js` (constante ou `process.env.PORT`).

### Changer la carte ou la résolution

- Éditer `server/models/Map.js` (coordonnées des murs et des bomb sites).
- Les clients Display et le serveur utilisent la même résolution logique (1920×1080) ; si la carte change, les spawns dans `server/config/constants.js` et la logique dans `server/services/GameService.js` peuvent être à ajuster.

### Ajouter des assets (images, vidéos)

- Placer les fichiers dans `public/` (ou sous-dossiers, ex. `public/characters/`).
- Ils sont servis à la racine (ex. `http://localhost:3000/lobby_bg.mp4`). Adapter les chemins dans le code des clients si besoin.

### Flux profils (FUN / COMPÈTE / DÉMO BUT / PERSO)

1. **Lobby** : l’hôte **display** envoie `update_settings` (Socket.io). Seul le socket **`displayHostId`** est accepté (`server/controllers/DisplayController.js`) — les autres clients display sont ignorés.
2. **Serveur** : `GameService.updateSettings` appelle `applyPresetToSettings` (`shared/gamePresets.js`) puis valide les champs numériques (bornes inchangées).
3. **Partie** : `buildState()` inclut **`settings` à chaque tick** (pas seulement en lobby) : mode, `gamePreset`, BO, durées, etc. Le **HUD** affiche une ligne **« S&D · … »** ou **« DM · … »** (`formatGameModeHudLine` dans `shared/gamePresets.js`, texte sous la phase dans `gameScene/hud.js` / `stateUpdate.js`).

### Ajuster le ressenti de combat (TTK, pacing SND/DM)

- **Armes** : `server/models/Weapon.js` — dégâts, cadence (`fireCooldownMs`), gerbe shotgun. Viser ~100 PV (`PLAYER_MAX_HEALTH` dans `server/config/constants.js`).
- **Manche / bombe / défuse / économie / killstreaks** : mêmes constantes ; le lobby peut encore surcharger durées et `dmKillLimit` (DM).
- **Feedback grand écran** : événement `damage_indicator` → chiffres flottants + son court dans `client-display/scenes/gameScene/effects.js` (`onDamageIndicator`).
- **Sons de tir** : `sound_event` avec `weaponId` (serveur) → `AudioManager.playWeaponShoot` ; recul sprite via `shootKickOffset` dans `gameScene/updateLoop.js`.
- **Rechargement** : `sound_event` `type: 'reload'` + `weaponId` → `playWeaponReload` ; **mobile** : `haptic` en pattern après reload. **Projectiles** : `weaponId` → teinte / taille (`PROJ_TINT` / `PROJ_SCALE`) + traînée `createProjectileTrail` (pas de traînée **shotgun** ; mode **LAN chargé** si beaucoup de projectiles : seuils `TRAIL_LAN_BUSY` / `TRAIL_LAN_DROP_SMG_PISTOL` dans `stateUpdate.js`).
- **SND type CS** : `LOSS_STREAK_BONUS` + `teamLossStreak` (serveur) ; prolongation `inOvertime` + `OVERTIME_BONUS_MONEY` à l’égalité match point ; dispersion tir en mouvement `MOVE_INACCURACY_*` + `ProjectileService.create(..., moveSpreadRad)`.

### Rebuild après modification du code client

```bash
npm run build
```

Puis redémarrer le serveur. En développement, `npm run dev:display` et `npm run dev:mobile` rechargent automatiquement sans rebuild manuel.

---

## Sauvegarde et déploiement

- Pour sauvegarder l’état du projet : versionner le code (Git) et ne pas committer `node_modules` ni les fichiers sensibles.
- Pour déployer sur une autre machine : suivre le [manuel d’installation](INSTALL.md) (Node.js + `npm install`, `npm run build`, `npm start`, ou Docker).
- Les parties ne sont pas persistées : à chaque redémarrage du serveur, l’état du jeu est réinitialisé.
