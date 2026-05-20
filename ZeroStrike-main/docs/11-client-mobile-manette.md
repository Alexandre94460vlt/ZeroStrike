# Client mobile (manette web)

## Build et URL

- Code : **`client-mobile/`**
- Build : `npm run build:mobile` → **`client-mobile/dist/`**
- Servi sous **`/mobile`**.

Dev : `npm run dev:mobile`.

## Point d’entrée ([`client-mobile/js/main.js`](../client-mobile/js/main.js))

- **Anti double-tap zoom** navigateur (`dblclick` preventDefault).
- Boutons **plein écran** sur `#app` (compat préfixes webkit/ms).
- Au **`DOMContentLoaded`** : branchements UI globaux + **`initJoinController`** ([`JoinController.js`](../client-mobile/js/controllers/JoinController.js)).

## Connexion ([`JoinController.js`](../client-mobile/js/controllers/JoinController.js) + [`connectionUi.js`](../client-mobile/js/controllers/connectionUi.js))

Saisie URL serveur / pseudo / avatar, QR optionnel, connexion Socket.io namespace **`/mobile`**.

## Pendant la partie ([`GameController.js`](../client-mobile/js/controllers/GameController.js))

- **Nipple.js** : joystick mouvement → **`input_move`** (force 0 à relâcher — critique, voir throttle serveur).
- Visée / tir / actions selon boutons — événements **`input_aim`**, **`input_action`**.
- **`hud_state`** : timer, scores, état mort des coéquipiers (léger).
- **`context_update`** : contexte pour boutons plant/defuse/reload et états dérivés (ex. domaine).
- **`lobby_state`** : vote carte, settings, room code, etc. en lobby.

## Socket ([`js/services/SocketService.js`](../client-mobile/js/services/SocketService.js))

Même principe que le display : URL du serveur, reconnexion, écoute des événements listés dans la doc [Sockets](04-sockets-namespaces-evenements.md).

## UX mobile

- Zones tactiles larges, feedback visuel, éviter dépendre du hover.
- Latence : le gameplay reste **serveur** ; la manette n’est qu’une télécommande.

## Sécurité

Aucune clé API dans le bundle mobile pour les intégrations externes : tout passe par le **serveur** (`/api/...`).
