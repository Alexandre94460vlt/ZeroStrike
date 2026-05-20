# Sockets : namespaces et événements

Socket.io est configuré avec deux namespaces : **`/display`** et **`/mobile`**. L’adaptateur `SocketIoAdapter` (`server/infra/SocketIoAdapter.js`) relie `GameApp` aux émissions côté serveur.

## Namespace `/display` — [`DisplayController.js`](../server/controllers/DisplayController.js)

### Authentification optionnelle

Si `DISPLAY_PASSWORD` est défini (`server/config/displayAuth.js`) :

- le socket n’envoie pas `display_connect` tant que **`display_login`** n’a pas réussi ;
- **`display_request_auth_status`** → **`display_auth_status`** (`required`, `authed`) ;
- **`display_login`** (payload + callback ack) : max **10** tentatives puis déconnexion ;
- l’ack **succès** est envoyé **avant** `display_connect` pour éviter une course avec le premier `state_update` / `map_data`.

### Événements entrants (client → serveur)

| Événement | Condition | Action `dispatch` / effet |
|-----------|-----------|---------------------------|
| `display_login` | si mot de passe requis | vérif secret puis `display_connect` |
| `start_game` | authed + hôte display | `start_game` si `LOBBY` |
| `update_settings` | authed, `LOBBY` | `update_settings` |
| `force_lobby` | authed + hôte display | `force_lobby` |
| `kick_player` | authed + hôte display | `kick_player` |
| `get_leaderboard` | authed | lecture classement (callback ou emit `leaderboard`) |

**Vote carte** : uniquement depuis **mobile** (`vote_map`), pas depuis le display (lecture seule cartes côté projecteur).

### Déconnexion

`disconnect` → `display_disconnect` avec `socketId`.

### Rôle « hôte display »

`ensureDisplayHost` : le socket courant devient `displayHostId` si l’ancien hôte n’est plus connecté — permet de reprendre le projecteur si l’onglet hôte se ferme.

---

## Namespace `/mobile` — [`MobileController.js`](../server/controllers/MobileController.js)

### Throttling

Plusieurs handlers sont **throttlés** pour limiter le flood réseau / malveillant :

| Événement | Intervalle min. (indicatif) |
|-----------|-----------------------------|
| `join_game` | 500 ms |
| `vote_map` | 300 ms |
| `shop_buy` | 200 ms |
| `hero_select` | 300 ms |
| `force_lobby` | 1000 ms (hôte mobile) |
| `get_context` | 100 ms |
| `input_aim` | 16 ms |
| `input_action` | 50 ms (cadence max armes) |
| `player_comment` | 500 ms |

**`input_move`** : throttle **uniquement** quand `force > 0` ; **`force === 0`** (arrêt joystick) n’est **jamais** ignoré — sinon le joueur « glisse » après relâchement.

### Événements principaux

- `join_game` → `player_join`
- `vote_map` → `vote_map`
- `shop_buy` → `shop_buy`
- `hero_select` → `hero_select`
- `input_move` / `input_aim` / `input_action` → actions moteur
- `player_ready` → `player_ready`
- `player_comment` → relais vers display (effet domaine)
- `ping` → `pong` (timestamp)
- `disconnect` → `player_disconnect`

---

## Événements sortants (serveur → clients) — aperçu

Gérés par `GameApp.broadcastState` et `_applyEffects` :

| Cible | Événement | Contenu (résumé) |
|-------|-----------|------------------|
| display | `state_update` | état complet ou **delta** JSON (voir `DISPLAY_STATE_DELTA`) |
| mobile | `hud_state` | `roundState`, timers, scores, liste joueurs allégée |
| mobile | `context_update` | contexte gameplay (plant/defuse/reload, **inDomain**, etc.) en `ACTION_PHASE` |
| mobile | `lobby_state` | vote, maps, host, settings, room code, héros verrouillés… en `LOBBY` |

D’autres événements ponctuels (ex. `map_data`, effets, kill feed) sont émis via les **effets** du domaine ou des helpers dédiés — voir le code de `GameEngine` / `GameApp._applyEffects` et les handlers côté `gameSocketController.js` (display).

Pour la fusion des deltas côté display : `client-display/utils/mergeDisplayStateDelta.js`.
