# Spécification — cartes Tiled `.tmj` (ZeroStrike)

## Calques attendus (carte pilote `dist2.tmj`)

Les noms sont comparés **sans tenir compte de la casse**.

| Calque (nom Tiled) | Type | Rôle display (debug couleur) | Rôle physique |
|--------------------|------|------------------------------|----------------|
| `ground` | tuiles | Couleur « sol » | Libre si pas mur |
| `walls` | tuiles | Couleur « mur » (prioritaire) | `gid != 0` → collision |
| `decor` | tuiles | Couleur « décor » | Aucune collision |
| `bombeA` / `bombeB` | tuiles | Couleur site bombe | Centroïde → site **A** / **B** |
| `bombeC` | tuiles | Couleur (optionnel) | Affichage seulement si présent |
| `spawnDefense` | tuiles | Couleur spawn DEF | Centres → `spawnCTPoints` |
| `spawnAttaque` | tuiles | Couleur spawn ATT | Centres → `spawnTPoints` |

Cartes **non infinies** ; grille **80×45** ; monde **1920×1080** px (cellule = `1920/80` × `1080/45`).

## Collision

**Règle** : toute tuile non vide sur le calque `walls` est un obstacle plein (même hitbox que les murs ASCII).

Les calques `bombe*`, `spawn*` ne créent pas de collision ; seulement des métadonnées gameplay.

## Parse serveur

Implémentation : [`server/models/maps/tiledMapParser.js`](../../server/models/maps/tiledMapParser.js).

- Produit `walls`, `freeCells`, `bombSites`, spawns comme `parseGrid()`.
- Produit `tiledDebugGrid: { width, height, cells }` où `cells` est une chaîne de **3600** caractères (`'0'`–`'8'`), un code par case (priorité affichage : mur > bombes > spawns > décor > sol > vide). Constantes exportées : `TILED_DEBUG_CELL_*`.

## Données réseau (`map_data`)

[`mapDataForSocket`](../../server/models/maps/Maps.js) inclut `tiledDebugGrid` pour les cartes issues d’un `.tmj`.

Le display ([`client-display/views/game/mapLayer.js`](../../client-display/views/game/mapLayer.js) — `drawTiledDebugGrid`) n’utilise **pas** les PNG des tilesets : uniquement des rectangles colorés alignés sur la grille serveur.

## Extensions futures

- Propriétés `collides` par tuile dans le tileset.
- Calque `Objects` Tiled (comme `scripts/tiled-to-ascii.mjs`).
- Cartes infinies / chunks.
- Optionnel : réintroduire un rendu Phaser Tilemap avec textures si besoin.
