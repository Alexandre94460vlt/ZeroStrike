# Cahier des charges — livraison de cartes Tiled pour ZeroStrike

Ce document fixe **ce que tu dois fournir** et **sous quelles contraintes** pour qu’une carte Tiled puisse être intégrée au jeu (conversion vers grille ASCII ou future pipeline native).

---

## Contexte technique (état du dépôt)

- **Logique de carte** (collisions, spawns, sites bombe) : grilles ASCII **80 colonnes × 45 lignes**, monde logique **1920×1080 px** (cellule ≈ **24×24 px**). Voir [`server/models/maps/Maps.js`](../../server/models/maps/Maps.js) et [`server/models/maps/gridBuilderUtils.js`](../../server/models/maps/gridBuilderUtils.js).
- **Affichage** : sprites Kenney dérivés de cette grille — [`client-display/views/game/mapLayer.js`](../../client-display/views/game/mapLayer.js), chargement [`client-display/views/BootScene.js`](../../client-display/views/BootScene.js).
- **Tiled à l’exécution** : pas de chargeur `.tmx` / JSON Tiled dans le jeu ; la voie prévue aujourd’hui est le **parcours A** (conversion ASCII). Voir [`scripts/tiled-to-ascii.mjs`](../../scripts/tiled-to-ascii.mjs) et [`docs/maps/TILED_INTEGRATION_STEPS.md`](TILED_INTEGRATION_STEPS.md).
- **Guide Tiled historique** : [`TILED_MAP_GUIDE.md`](TILED_MAP_GUIDE.md) décrit encore une carte **32×18** à titre d’archive / workflow Tiled — **non aligné** avec le moteur 80×45. Utiliser ce CDC pour les **dimensions** et le **package livré**.

---

## 1. Fichiers à fournir (package minimal)

| Livrable | Description | Obligatoire |
|----------|-------------|-------------|
| **Carte Tiled** | `.tmx` **ou** export **JSON** (Map → Export As → JSON) | Oui |
| **Tileset** | `.tsx` + image(s) `.png` référencées, ou PNG seul si embarqué dans le JSON | Oui (chemins relatifs cohérents dans l’archive) |
| **README** | Nom de la carte, id jeu souhaité, dimensions en tuiles, taille d’une tuile en px, liste des calques | Fortement recommandé |
| **Capture d’écran** | Vue globale dans Tiled | Optionnel |

**Bonnes pratiques d’export**

- Zip avec **structure de dossiers stable** : ex. `ma_carte/map.json` + `ma_carte/tileset.tsx` + `ma_carte/tilesheet.png` pour ne pas casser les chemins relatifs.
- Tileset Kenney du dépôt : `vendor/kenney/kenney_scribble-dungeons/Tiled/sampleSheet.tsx` — préciser si ta carte l’utilise ou un tileset externe (licence).

Un gabarit de README est fourni dans [`tiled-package-template/README.md`](tiled-package-template/README.md).

---

## 2. Contraintes dimensionnelles (critique)

Pour une intégration **sans refonte moteur**, la carte doit être **80 tuiles × 45 tuiles** (conversion 1:1 vers le serveur).

**Légende ASCII** (voir `Maps.js`) :

| Caractère | Signification |
|-----------|----------------|
| `.` | Sol libre |
| `X` | Mur |
| `A` / `B` / `c` | Sites bombe (ids A, B, C — `c` = 3e site) |
| `C` / `T` | Marqueurs spawn CT (défense) / T (attaque) |
| `O` | Obstacle (caisse, collision) |

**Recommandation** : tuiles **24×24 px** dans Tiled (aligné sur 1920÷80 et 1080÷45). Autre taille d’image possible si **homogène** et documentée — ce qui compte est le **nombre de cellules 80×45**.

Si tu livres une autre taille (ex. 32×18), prévoir **retilage / mise à l’échelle** ou évolution du code (hors « livraison simple »).

---

## 3. Organisation des calques (recommandée)

1. **Floor** — sol (non collision)
2. **Walls** — murs et obstacles bloquants (source des `X` pour l’outil de conversion)
3. **Decor** — décor pur (ignoré par défaut pour la physique)
4. **Objects** — calque d’objets avec propriétés :
   - Sites bombe : `type` = `bombSite`, `siteId` = `A` | `B` | `C`
   - Spawns : `type` = `spawn`, `team` = `DEF` | `ATT`
   - Obstacle caisse : `type` = `obstacle` (optionnel, produit `O`)

Les noms de calques par défaut attendus par le script : `Walls`, `Objects` (voir `scripts/tiled-to-ascii.mjs --help`).

---

## 4. Parcours après réception

**Parcours A — Compatible jeu actuel**

1. Vérifier **80×45** et cohérence des calques.
2. Exporter en JSON Tiled et lancer la conversion : voir [`TILED_INTEGRATION_STEPS.md`](TILED_INTEGRATION_STEPS.md).
3. Intégrer la grille générée dans un `*GridBuilder.js` et [`MAP_LIST`](../../server/models/maps/Maps.js).

**Parcours B — Tiled natif**

Chargeur JSON côté serveur/client, mapping tuiles → collisions : **non implémenté** ; à traiter comme chantier séparé.

---

## 5. Checklist livrable

- [ ] Archive : `map.json` ou `map.tmx` + tileset(s) + PNG
- [ ] Dimensions : largeur × hauteur en tuiles + taille tuile
- [ ] Liste des calques et rôle
- [ ] Si Objects : propriétés `bombSite` / `spawn` / `obstacle`
- [ ] Licence du tileset respectée
- [ ] Id carte cible : `dist2`, `ascension`, `maven`, `chadigo` ou nouvelle id (code + UI)

---

## 6. Sécurité et bonnes pratiques

- Pas de secrets dans les fichiers (tokens, URLs internes sensibles).
- Livrables **statiques** uniquement (pas d’exécutable dans le zip).
- Respecter les licences des assets (ex. `License.txt` sous `vendor/kenney/`).

---

## Synthèse

Fournir des fichiers Tiled **ne suffit pas** à jouer la carte : il faut une grille **80×45** cohérente avec `Maps.js`. Ce CDC définit le **package**, les **dimensions**, les **calques** ; l’outil [`scripts/tiled-to-ascii.mjs`](../../scripts/tiled-to-ascii.mjs) et [`TILED_INTEGRATION_STEPS.md`](TILED_INTEGRATION_STEPS.md) couvrent la **conversion** et l’**intégration**.
