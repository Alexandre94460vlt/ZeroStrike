# Intégration d’une carte Tiled — parcours A (grille ASCII)

Après réception d’un export JSON **80×45** conforme au [`TILED_DELIVERY_CDC.md`](TILED_DELIVERY_CDC.md).

## 1. Vérifications rapides

- Dimensions dans le JSON : `width` = 80, `height` = 45.
- Calque tuiles des murs : nom par défaut `Walls` (ou indiquer `--walls-layer`).
- Calque objets : `Objects` avec propriétés `type` / `siteId` / `team` si besoin.

## 2. Générer la grille ASCII

Depuis la racine du dépôt :

```bash
node scripts/tiled-to-ascii.mjs chemin/vers/ta_carte.json -o tmp/grille.txt
```

Sans `-o`, la grille est imprimée sur la sortie standard (pratique pour copier-coller).

## 3. Brancher la carte côté serveur

1. Créer un module du type [`server/models/maps/dustStrikeGridBuilder.js`](../../server/models/maps/dustStrikeGridBuilder.js) qui retourne un `string[]` de **45** lignes de **80** caractères (comme `gridToStringRows` / littéraux), **ou** importer les lignes depuis `grille.txt` via `fs` en dev (moins idéal pour la prod — préfère des chaînes en dur ou un build step).
2. Enregistrer la carte dans [`MAP_LIST`](../../server/models/maps/Maps.js) avec un nouvel `id` et `name`.
3. Vérifier que `parseGrid` reçoit bien la même légende (`.`, `X`, `A`, `B`, `c`, `C`, `T`, `O`).

## 4. Client et sélection de carte

- Si nouvelle carte : exposer l’`id` dans l’UI / le flux de choix de map (selon l’existant du projet).
- Le rendu Kenney suit automatiquement la grille parsée ; les tuiles du fichier Tiled ne sont pas rendues telles quelles sans **parcours B** (chargeur Tiled natif).

## 5. Parcours B — carte `.tmj` directe (`tiledFile` dans `MAP_LIST`)

Voir [`TILED_NATIVE_RENDER_SPEC.md`](TILED_NATIVE_RENDER_SPEC.md) : le serveur parse `maps/tiled/tilesets/<fichier>.tmj` et envoie dans `map_data` une grille `tiledDebugGrid` (codes par case). Le display dessine des **rectangles colorés** par calque (pas de chargement PNG tileset). Pour une **nouvelle** carte : ajouter `tiledFile: 'nom.tmj'` dans [`MAP_LIST`](../../server/models/maps/Maps.js) avec le fichier sous `maps/tiled/tilesets/`.
