# Joueurs, mouvements, armes et économie

## Modèle joueur ([`server/models/Player.js`](../server/models/Player.js))

Contient position, équipe, santé, argent, arme équipée, état mort/vivant, chargeurs, **identité de session** stable en reconnexion, champs liés aux héros / pouvoirs (selon évolution du code). La hitbox utilise **`PLAYER_HITBOX_RADIUS`** depuis `constants.js`.

## Armes ([`server/models/Weapon.js`](../server/models/Weapon.js))

Dictionnaire **`WEAPONS`** : pour chaque arme, prix, dégâts, `fireCooldownMs`, vitesse et rayon des projectiles, nombre de **pellets** (shotgun), taille des chargeurs et réserves max.

Rôles documentés dans le fichier : pistolet (eco), SMG (DPS), rifle (polyvalent), sniper (one-shot skill), shotgun (burst LAN).

## Projectiles ([`server/models/Projectile.js`](../server/models/Projectile.js) + [`ProjectileService.js`](../server/services/ProjectileService.js))

Gestion du cycle de vie des tirs : création à l’`input_action`, collisions joueurs / murs, dommages.

## Physique et déplacements

- Entrées **`input_move`** / **`input_aim`** : le moteur interprète force et angle (voir handlers `GameEngine`).
- **Collisions murs** : utilitaires dans [`server/utils/physics.js`](../server/utils/physics.js) (spawn, nudge, etc.).
- **Précision** : pénalité de tir en mouvement, courbes de **spray** (constantes `MOVE_INACCURACY_*`, `SPRAY_*` dans `constants.js`).

## Machine à états des rounds ([`server/state/RoundStateMachine.js`](../server/state/RoundStateMachine.js))

États : **`LOBBY`**, **`BUY_PHASE`**, **`ACTION_PHASE`**, **`ROUND_END`**, **`MATCH_OVER`**.  
La table **`TRANSITIONS`** définit les passages autorisés ; une transition invalide lève une erreur en dev ou log en prod.

## Search & Destroy

- **Sites bombe** : dérivés des données carte (`bombSites`).
- **Plant / defuse** : durées en ms (`BOMB_PLANT_DURATION_MS`, `BOMB_DEFUSE_DURATION_MS`), rayon de defuse (`DEFUSE_RADIUS`), timer bombe (`BOMB_TIMER` dans settings).
- **Économie** : gains manche (`MONEY_WIN` / `MONEY_LOSS`), kill (`MONEY_KILL`), **loss streak bonus** (`LOSS_STREAK_BONUS`), bonus prolongation (`OVERTIME_BONUS_MONEY`).

## Deathmatch

- `settings.mode === 'DM'` : logique de score par kills ; **`dmKillLimit`** (0 = fin au timer seulement).

## Power-ups ([`server/managers/PowerUpManager.js`](../server/managers/PowerUpManager.js) + domaine)

Spawn périodique, durée sur carte, effets temporaires — paramètres dans `constants.js` (`POWERUP_*`). Peuvent être désactivés selon preset / réglages host.

## Paramètres modifiables en lobby

Champs dans `engine.settings` (nom, durées, argent, mode, preset…) mis à jour via **`update_settings`** depuis le display authentifié, uniquement en **`LOBBY`**.
