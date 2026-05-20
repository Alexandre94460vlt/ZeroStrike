# GameApp et domaine (effets, tick, état)

## Rôle de `GameApp` ([`server/app/GameApp.js`](../server/app/GameApp.js))

`GameApp` est la **couche application** entre :

- le **domaine** : `GameEngine` (pur, sans socket ni fichier) ;
- les **ports** : `SocketPort`, `LeaderboardPort`, `SchedulerPort`.

Responsabilités principales :

1. **`dispatch(action)`** — délègue à `engine.dispatch`, puis **`_applyEffects`** sur le résultat.
2. **`tick(dtSec)`** — idem pour la simulation temps réel.
3. **`broadcastState` / `broadcastIfDirty`** — construit l’état via `engine.buildState()`, envoie aux clients, gère le **delta display** et les payloads **mobile** (HUD, lobby, contexte).

`GameEngine` reçoit aussi un hook **`emitDisplay`** pour effets directs display (configuré dans le constructeur de `GameApp`).

## Effets déclaratifs ([`server/domain/effects.js`](../server/domain/effects.js))

Le moteur ne parle pas à Socket.io directement. Il renvoie une liste d’effets, par exemple :

- **`emit_namespace`** — `ns: 'display'|'mobile'`, `event`, `payload`
- **`emit_socket`** — ciblage d’un socket précis
- **`stats`** — `recordKill`, `addPlant`, `addDefuse`, `recordRoundResult`…
- **`schedule` / `cancel_schedule`** — timers différés (clé + action à rejouer en `dispatch`)
- **`log`** — niveau + message
- **`game_trace`** — traçabilité structurée (`gameTrace.js` si activé)

`GameApp._applyEffects` interprète chaque effet (délégation `leaderboardPort`, `socketPort`, `schedulerPort`, etc.).

## Boucle temporelle ([`server/services/GameLoopService.js`](../server/services/GameLoopService.js))

- **60 TPS** : `tick(TICK_MS/1000)` avec accumulateur ; **plafond de delta** (`MAX_DELTA_MS`) pour éviter la spirale si le process est suspendu.
- **Cap à 3 ticks** par passage de boucle si gros retard — évite de bloquer longtemps.
- **~30 Hz** pour `broadcastState` périodique (`STATE_UPDATE_INTERVAL`).
- Entre deux envois 30 Hz : **`broadcastIfDirty()`** après les ticks — au plus une synchro supplémentaire si l’état a été marqué dirty (join, shop, etc.).

## État « dirty »

`engine._stateDirty` contrôle si un broadcast est nécessaire (`broadcastIfDirty`), pour ne pas spammer inutilement.

## Delta `state_update` (display)

Variable d’environnement **`DISPLAY_STATE_DELTA`** (défaut : activé ; `0` / `false` = toujours état complet).

- `GameApp` garde **`_prevDisplayState`** pour calculer un patch via `buildDisplayStateDeltaPayload` (`server/utils/displayStateDelta.js`).
- Après changement de **`roundState`** ou si aucun display n’était connecté, **3 envois pleins** consécutifs (`_deltaResyncTicks`) garantissent une resync (évite client sans base de fusion).

## `GameEngine` (rappel)

Fichier volumineux : **`server/domain/GameEngine.js`**. Il orchestre :

- machine d’état des rounds (`RoundStateMachine`) ;
- services injectés ou composés (joueurs, projectiles, héros, carte courante) ;
- validation des **actions** (`type` + `payload`) : join, input, bombe, shop, fin de round, etc.

Pour le détail des actions, la meilleure source reste les **`case`** / handlers dans `dispatch` et les appels depuis `GameService` si couche intermédiaire.

## `GameService.js` (legacy)

Fichier encore présent pour **référence / tests / migration** (commentaire en tête de fichier). L’exécution **`npm start`** instancie **`GameApp`** + **`GameEngine`** ; les contrôleurs socket appellent `gameApp.dispatch`. `HeroService` reçoit une référence au moteur (`new HeroService(this)` dans `GameEngine`) — le paramètre est typé « GameService » dans certains JSDoc historiques mais l’objet effectif est le **`GameEngine`** en production.
