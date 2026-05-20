# Client display (Phaser 3)

## Build et URL

- Code : **`client-display/`**
- Build Vite : `npm run build:display` → **`client-display/dist/`**
- Servi en production sous **`/display`** (voir `server/index.js`).

Dev : `npm run dev:display` — config [`client-display/vite.config.js`](../client-display/vite.config.js) (proxy socket vers le serveur selon réglages du fichier).

## Point d’entrée ([`client-display/main.js`](../client-display/main.js))

- Précharge les **polices** (`@fontsource/teko`, `oswald`, `rajdhani`) pour éviter le flash typographique.
- Instancie **`new Phaser.Game(phaserConfig)`** depuis [`config/gameConfig.js`](../client-display/config/gameConfig.js).

## Scènes Phaser (ordre typique)

Définies dans `gameConfig.js` :

1. **`BootScene`** — chargement textures / atlas, audio, assets carte, transition vers lobby ou jeu.
2. **`LobbyScene`** — QR code, liste joueurs, paramètres, vote (affichage), lancement partie.
3. **`GameScene`** — rendu carte, entités, HUD, kill feed.

## Socket ([`controllers/gameSocketController.js`](../client-display/controllers/gameSocketController.js) + [`services/SocketService.js`](../client-display/services/SocketService.js))

- Connexion au namespace **`/display`** (URL dérivée de `window.location`).
- Si **`DISPLAY_PASSWORD`** côté serveur : flux **`display_request_auth_status`** → **`display_login`** avant d’attacher les gros handlers (voir `displayAuthGate.js`).
- Handler principal **`state_update`** : fusion éventuelle avec [`utils/mergeDisplayStateDelta.js`](../client-display/utils/mergeDisplayStateDelta.js) puis dispatch vers la logique jeu ([`views/game/stateUpdate.js`](../client-display/views/game/stateUpdate.js)).

## Boucle rendu jeu

- **`views/game/updateLoop.js`** — synchronisé sur le moteur Phaser (`update`).
- **`mapLayer.js`** — couches tuiles / obstacles / sites.
- **`heroSprites.js`** — sprites joueurs (base + teinte).
- **`heroEffects.js`**, **`effects.js`** — VFX.
- **`hud.js`** — scores, timer, messages.

## Audio

[`utils/AudioManager.js`](../client-display/utils/AudioManager.js) — volumes, préférences [`displayPreferences.js`](../client-display/utils/displayPreferences.js).

## Kill feed / Giphy

Si configuré côté serveur, le display peut solliciter **`/api/giphy/:query`** via le proxy (clé jamais exposée au navigateur pour la clé API — reste server-side).

## Sécurité côté display

- **`sanitizeDisplay.js`** — limiter XSS / injection dans les chaînes affichées (selon implémentation).
- Ne jamais faire confiance aux noms joueurs : affichage après sanitization.

## Constantes UI

[`client-display/config/constants.js`](../client-display/config/constants.js) et **`views/game/constants.js`** — tailles, couleurs, limites affichage.
