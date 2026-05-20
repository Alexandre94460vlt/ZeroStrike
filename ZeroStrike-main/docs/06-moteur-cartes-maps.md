# Cartes et monde logique

## Dimensions et coordonnées

Le monde de jeu logique est documenté comme **1920×1080 px** dans les commentaires de [`server/models/maps/Maps.js`](../server/models/maps/Maps.js). Les grilles ASCII classiques sont **80×45** cases de **24×24 px**.

## Liste des cartes (`MAP_LIST`)

Définie dans **`Maps.js`** : chaque entrée comporte typiquement :

- **`id`** — identifiant interne (ex. `dist2`, `ascension`, `maven`, `chadigo`)
- **`name`** — libellé affiché
- **`tiledFile`** — fichier sous `maps/` (ex. `dist2.tmj`)
- **`asciiFallbackGrid`** — grille de secours si parse Tiled échoue ou si variable d’env force l’ASCII

### Builders ASCII

Fichiers du type `*GridBuilder.js` (`dustStrike`, `ascension`, `urbanStrike`, `harborStrike`…) produisent des chaînes de grille selon la légende :

- `X` mur, `.` sol, `O` obstacle
- `A` / `B` / `c` sites bombe
- `C` / `T` spawns CT / T (avec logique de zones élargies ou marqueurs seuls selon options)

## Parsing

- **`parseGrid`** — convertit une grille ASCII en murs, sites, spawns, cellules libres.
- **`parseTiledMapFile` / `resolveTiledMapPath`** — pipeline Tiled côté serveur (`tiledMapParser.js`).

Variable utile en dev : **`ZS_USE_ASCII_MAP`** (ex. `dist2` pour forcer le repli ASCII sur une carte donnée — voir commentaires dans `Maps.js`).

## Modèle `Map.js`

Réexporte `MAP_LIST`, `getMapData`, `mapDataForSocket` — façade pour le reste du serveur.

## Affichage côté client display

- Couche tuiles / décor : chargement depuis **`/maps/...`** et chemins **`/tiles/`** selon la config Phaser (`mapLayer.js`, `BootScene.js`).
- Mode debug : possible affichage grille alignée sur le parse Tiled (`tiledDebugGrid` mentionné en commentaire serveur).

## Documentation Tiled détaillée

Le sous-dossier **[`docs/maps/`](maps/README.md)** contient guides d’intégration, spec de rendu, template de livraison — complément indispensable aux cartes.

## Collision et hitbox joueur

Le **rayon hitbox** joueur est centralisé dans [`server/config/constants.js`](../server/config/constants.js) : **`PLAYER_HITBOX_RADIUS`** (ex. 11 px pour franchir des couloirs d’une case de 24 px). Utilisé par `Player`, physique, moteur, services héros, etc.

La physique mur / projectile est documentée dans [`server/utils/physics.js`](../server/utils/physics.js) (commentaires sur les conventions).
