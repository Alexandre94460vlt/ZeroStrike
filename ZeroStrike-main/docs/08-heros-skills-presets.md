# Héros, compétences et presets

## Roster ([`server/models/Heroes.js`](../server/models/Heroes.js))

Tableau **`HEROES_ROSTER`** : pour chaque héros, `id`, `name`, `cost` (économie), `color` (UI). Exemples d’`id` : `gojo`, `sukuna`, `yuta`, `ichigo`, `toji`, `jotaro`, `dio`, `naruto`, `itachi`, `goku`.

Fonction **`getHero(heroId)`** pour résoudre une entrée.

## Presets de partie ([`shared/gamePresets.js`](../shared/gamePresets.js))

- **`GAME_PRESET_IDS`** : `FUN`, `COMPETE`, `DEMO_BUT`, `CUSTOM`.
- **`PRESET_BUNDLES`** : valeurs numériques (rounds pour gagner, durées, argent de départ, power-ups, limite kills DM…).
- **`applyPresetToSettings(settings, preset)`** : applique un bundle sauf `CUSTOM` (étiquette seulement).
- **`getGunplayTuning(settings)`** : coefficients fun / compète pour spray, etc.

Le display / lobby envoie le preset choisi ; le serveur valide et applique.

## `HeroService` ([`server/services/HeroService.js`](../server/services/HeroService.js))

Concentre la logique des **capacités** (cooldowns, zones, projectiles spéciaux, passifs type vitesse Toji / Bankai Ichigo, etc.). Il reçoit une référence au moteur pour lire joueurs, carte, état bombe, etc.

Les constantes numériques des pouvoirs (rayons, dégâts, durées) sont en majorité dans **`server/config/constants.js`** (section commentée par héros / capacité).

## Affichage sprite corps (display)

Un **sprite de base** unique (asset Kenney) est **teinté** par héros via [`shared/heroBodyTint.js`](../shared/heroBodyTint.js) (`HERO_BODY_TINT_BY_ID`, `getHeroBodyTint`) — aligné sur les couleurs du roster. Voir `client-display/views/game/heroSprites.js` et chargement dans `BootScene.js`.

## Effets visuels display

Fichiers tels que **`heroEffects.js`**, **`effects.js`**, **`reduceFx.js`** : particules, flashes, optimisation des effets selon préférences.

Pour le détail exact de chaque skill (A/B par héros), se référer au code de `HeroService` + branches dans `GameEngine` (recherche par `heroId` ou nom de méthode).
