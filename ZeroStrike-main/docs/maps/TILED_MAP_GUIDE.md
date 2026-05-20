# Guide Complet — Créer une vraie map pour ZeroStrike avec Tiled

> **Moteur actuel (à respecter pour jouer la carte)** : grilles ASCII **80×45** cellules, monde 1920×1080 px (~24×24 px par case). Voir le **cahier des charges livrable** : [`TILED_DELIVERY_CDC.md`](TILED_DELIVERY_CDC.md) et le gabarit [`tiled-package-template/README.md`](tiled-package-template/README.md).

> **Sections 3 à 8 ci-dessous** : exemple historique en **32×18** tuiles **64×64 px** (Dead Ops) — utile pour le **workflow Tiled** (calques, export JSON, propriétés), mais **pas** les dimensions du serveur ZeroStrike aujourd’hui. Pour une nouvelle carte, crée plutôt une map **80×45** (tuiles 24×24 px recommandées) ou prévois une conversion manuelle.

> **Note** : le gameplay utilise des grilles ASCII (`server/models/maps/`). Conversion depuis export JSON : [`scripts/tiled-to-ascii.mjs`](../../scripts/tiled-to-ascii.mjs). Tileset : `vendor/kenney/kenney_scribble-dungeons/`.

> **Affichage display (cartes `.tmj`)** : la **source de vérité** est le fichier Tiled parsé par le serveur (`server/models/maps/tiledMapParser.js`). Le client ne charge plus les PNG des tilesets : il reçoit une grille `tiledDebugGrid` (80×45 codes par case) dans `map_data` et dessine des **rectangles colorés** par calque (`ground`, `walls`, `decor`, bombes, spawns) pour valider que la carte jouée correspond à ton édition Tiled. Un rendu « vraies textures » pourra être réactivé plus tard si besoin.

> Style cible (référence visuelle) : **Dead Ops Arcade (BO2)** — pierre sombre, murs épais, couloirs tactiques  
> Tileset disponible : `kenney_scribble-dungeons` (154 tuiles 64×64px dans le pack ; en 80×45 tu peux utiliser la même feuille en l’important avec une grille 24×24 dans Tiled si tu redécoupes, ou garder 64×64 pour l’édition puis exporter — l’important est la **grille 80×45** côté logique)

---

## Table des matières

1. [Installer Tiled](#1-installer-tiled)
2. [Comprendre les fichiers dispo](#2-comprendre-les-fichiers-dispo)
3. [Créer la map — configuration initiale](#3-créer-la-map--configuration-initiale)
4. [Importer le tileset](#4-importer-le-tileset)
5. [Architecture des calques (layers)](#5-architecture-des-calques-layers)
6. [Dessiner la map — technique Dead Ops](#6-dessiner-la-map--technique-dead-ops)
7. [Ajouter les zones de jeu (propriétés custom)](#7-ajouter-les-zones-de-jeu-propriétés-custom)
8. [Exporter en JSON (format Phaser)](#8-exporter-en-json-format-phaser)
9. [Intégrer dans ZeroStrike (code Phaser)](#9-intégrer-dans-zerostrike-code-phaser)
10. [Activer Lights2D (effet Dead Ops)](#10-activer-lights2d-effet-dead-ops)
11. [Référence des tuiles utiles](#11-référence-des-tuiles-utiles)

---

## 1. Installer Tiled

1. Va sur **[mapeditor.org](https://www.mapeditor.org/)**
2. Clique **"Download Tiled"** → version **Windows Installer** (.exe)
3. Installe normalement (gratuit, open-source)
4. Lance Tiled

---

## 2. Comprendre les fichiers dispo

Dans `vendor/kenney/kenney_scribble-dungeons/` tu as :

```text
Tilesheet/
  tilesheet.png      ← 896×704px, 154 tuiles de 64×64px (14 colonnes × 11 lignes)
  tilesheet@2.png    ← Version double résolution (optionnel)

Tiled/
  sampleSheet.tsx    ← Tileset Tiled déjà configuré (réutilise-le !)
  sampleMap.tmx      ← Exemple de map 16×16 (pour voir comment ça marche)

PNG/Default (64px)/  ← Toutes les tuiles individuelles en PNG si besoin
  tile.png, wall.png, wall_corner.png, tiles_cracked.png, ...
```

**Paramètres du jeu :**

- Canvas logique : **1920 × 1080 px**
- Taille d'une cellule : **60 × 60 px**
- Grille de la map : **32 colonnes × 18 lignes**
- Taille du tileset : tuiles **64×64px** (Tiled les scale automatiquement à 60×60 en jeu)

---

## 3. Créer la map — configuration initiale

Dans Tiled : **File → New → New Map**

| Paramètre | Valeur |
| --- | --- |
| Orientation | Orthogonal |
| Tile layer format | CSV |
| Tile render order | Right Down |
| Map width | **32** tiles |
| Map height | **18** tiles |
| Tile width | **64** px |
| Tile height | **64** px |

> ⚠️ On utilise 64px (taille réelle des tuiles Kenney) même si le jeu affiche en 60px. Phaser fait la conversion automatiquement via `tileWidth: 60` dans le code.

Clique **OK** → une grille 32×18 apparaît.

---

## 4. Importer le tileset

1. Dans le panneau **Tilesets** (en bas à droite) → clique le `+` (New Tileset)
2. **"Based on existing tileset file"** → Browse → sélectionne :

   ```text
   vendor/kenney/kenney_scribble-dungeons/Tiled/sampleSheet.tsx
   ```

3. Clique **OK**

Tu verras le tileset `tilesheet.png` avec les 154 tuiles apparaître.

> Si Tiled demande "où est `tilesheet.png`", pointe vers :
> `vendor/kenney/kenney_scribble-dungeons/Tilesheet/tilesheet.png`

### Repère visuel des tuiles importantes

```text
Ligne 1 (y=0) :  Tuiles de sol (tile, tiles, tiles_cracked, tiles_decorative...)
Ligne 2 (y=1) :  Murs (wall, wall_corner, wall_edge, wall_half, wall_curve...)
Ligne 3 (y=2) :  Transitions sol/mur (floor_wall, floor_wall_corner...)
Ligne 4 (y=3) :  Chemins, eau, herbe...
Ligne 5-8     :  Items (barils, caisses, coffres, escaliers...)
```

---

## 5. Architecture des calques (layers)

C'est LA partie la plus importante. Crée **4 calques** dans cet ordre (de bas en haut) :

```text
Layer 4 — Objects    (Object Layer)   ← Spawns, sites de bombe, zones custom
Layer 3 — Decor      (Tile Layer)     ← Barils, caisses, détails (depth > walls)
Layer 2 — Walls      (Tile Layer)     ← Murs, obstacles (avec collision)
Layer 1 — Floor      (Tile Layer)     ← Sol, carrelage, variations
```

### Créer les calques

1. **Layer menu → Add Tile Layer** → renomme en `Floor`
2. Répète pour `Walls`
3. Répète pour `Decor`
4. **Layer menu → Add Object Layer** → renomme en `Objects`

### Propriété de collision sur `Walls`

1. Sélectionne le calque `Walls`
2. **Layer Properties** (panneau propriétés) → `+` → Ajoute :
   - Name : `collides`
   - Type : `bool`
   - Value : `true`

---

## 6. Dessiner la map — technique Dead Ops

### Étape 1 : Remplis tout le sol (calque Floor)

1. Sélectionne le calque **Floor**
2. Choisis la tuile `tile.png` (carré de pierre de base, colonne 1 ligne 1 du tileset)
3. Utilise l'outil **Fill (Bucket)** → clique sur la map → tout est rempli
4. Ajoute de la variation : prends `tiles_cracked.png` et peins **aléatoirement** 15-20% des cellules
5. Pour les zones centrales/mid : utilise `tiles_decorative.png` (motifs en croix)

### Étape 2 : Dessine les murs extérieurs (calque Walls)

1. Sélectionne le calque **Walls**
2. **Fais une bordure de 2 cellules** tout autour de la map (lignes 0-1, 16-17, colonnes 0-1, 30-31)
3. Tuile à utiliser : `wall.png` ou `wall_edge.png`
4. Pour les **coins** : utilise `wall_corner.png` (rotation dans Tiled avec la touche `X` / `Y` ou `Z`)

> 💡 **Astuce rotation** : Sélectionne une tuile → presse `Z` pour tourner 90°

### Étape 3 : Architecture Dead Ops (murs intérieurs)

La structure type Dead Ops Arcade :

- **3 couloirs verticaux** (B lane, Mid, A lane)
- **Pinch points** (étranglements) en haut et en bas
- **Cover boxes** au milieu
- **Sites de bombe** dans les coins hauts

```text
Schéma visuel Dead Ops (32×18) :
╔══╦══════╦═════╦══════╦═════╦══════╦══╗
║  ║  B   ║     ║ Mid  ║     ║  A   ║  ║  row 0 (border)
║  ║ [B]  ║█████║  CC  ║█████║ [A]  ║  ║  row 1 (sites B et A)
║  ║      ║█████║  CC  ║█████║      ║  ║  row 2 (rotation CT)
║  ║      ║█████║      ║█████║      ║  ║  row 3
║  ╠══════╣     ╠══════╣     ╠══════╣  ║  row 4 (PINCH)
║  ╠══════╣     ╠══════╣     ╠══════╣  ║  row 5 (PINCH)
║  ║      ║     ║      ║     ║      ║  ║  rows 6-10 (combat zone)
║  ╠══════╣     ╠══════╣     ╠══════╣  ║  row 11 (PINCH)
║  ╠══════╣     ╠══════╣     ╠══════╣  ║  row 12 (PINCH)
║  ║      ║     ║      ║     ║      ║  ║  rows 13-14 (approche T)
║  ║      ║     ║[T]   ║     ║      ║  ║  row 15 (spawn T)
╚══╩══════╩═════╩══════╩═════╩══════╩══╝

[B] = Site bombe B (haut gauche)   [A] = Site bombe A (haut droite)
CC  = Caisse couverte mid          [T] = Spawn attaquants (bas)
```

### Étape 4 : Ajouter du détail (calque Decor)

1. Sélectionne le calque **Decor**
2. Place des `barrel.png`, `crate.png`, `chest.png` contre les murs
3. Ajoute `campfire.png` près des spawns (ambiance)
4. Utilise `trapdoor_square.png` pour des détails au sol
5. Quelques `water.png` ou `puddle.png` dans des zones mortes

> ⚠️ Ne mets jamais de décors sur un chemin de joueur (les décors sont visuels uniquement)

### Conseils Dead Ops Arcade

| Technique | Comment |
| --- | --- |
| **Coins arrondis** | Utilise `wall_curve.png` aux angles intérieurs |
| **Murs endommagés** | `wall_damaged.png` ou `wall_demolished.png` pour la diversité |
| **Transitions sol→mur** | `floor_wall.png` sur le calque Floor, juste devant les murs |
| **Détail mid** | `inner_round.png` au centre de la map (circle ornemental) |
| **Cover boxes** | 2×2 blocs de `wall.png` au milieu des couloirs |

---

## 7. Ajouter les zones de jeu (propriétés custom)

C'est ici qu'on place les **infos logiques** que Phaser va lire.

### Sur le calque Objects

1. Sélectionne le calque **Objects**
2. Utilise l'outil **Rectangle** (raccourci `R`)

#### Site de bombe A

- Dessine un rectangle sur les cellules du site A (environ 3×3 cellules)
- Dans Properties → Ajoute :
  - `type` = `bombSite`
  - `siteId` = `A`

#### Site de bombe B

- Idem pour le site B :
  - `type` = `bombSite`
  - `siteId` = `B`

#### Spawn CT (Défenseurs)

- Rectangle 2×2 cellules haut-centre :
  - `type` = `spawn`
  - `team` = `DEF`

#### Spawn T (Attaquants)

- Rectangle 2×2 cellules bas-centre :
  - `type` = `spawn`
  - `team` = `ATT`

---

## 8. Exporter en JSON (format Phaser)

1. **File → Export As** (pas "Save As")
2. Format : **JSON Map Files (*.json)**
3. Sauvegarde dans : `D:\ZeroStrike\public\maps\dist2.json` (id carte serveur : `dist2`)

> ⚠️ Utilise **Export As** et non Save, sinon ça sauvegarde en .tmx (format Tiled natif)

### Vérifier l'export

Ouvre `dist2.json` dans VS Code — tu dois voir :

```json
{
  "height": 18,
  "width": 32,
  "tilewidth": 64,
  "tileheight": 64,
  "layers": [
    { "name": "Floor", "type": "tilelayer", "data": [...] },
    { "name": "Walls", "type": "tilelayer", "data": [...] },
    { "name": "Decor", "type": "tilelayer", "data": [...] },
    { "name": "Objects", "type": "objectgroup", "objects": [...] }
  ],
  "tilesets": [{ "name": "tilesheet", ... }]
}
```

### Copier aussi le tileset

Le JSON référence `tilesheet.png` — copie-le dans le dossier maps :

```text
D:\ZeroStrike\public\maps\tilesheet.png
```

(ou ajuste le chemin dans le JSON)

---

## 9. Intégrer dans ZeroStrike (code Phaser)

### Dans `BootScene.js`

```javascript
preload() {
  // ... (existant)

  // Charger la tilemap JSON
  this.load.tilemapTiledJSON('map_dust', '/maps/dist2.json');

  // Charger l'image tileset (chemin doit correspondre à ce que le JSON indique)
  this.load.image('dungeon_tiles', '/maps/tilesheet.png');
}
```

### Dans `GameScene.js` — remplacer drawWalls() par un vrai tilemap

```javascript
create() {
  // ... (init existant)

  const mapData = this.registry.get('mapData');
  const mapKey = mapData?.mapId || 'dist2';
  const tilemapKey = `map_${mapKey}`;

  if (this.cache.tilemap.exists(tilemapKey)) {
    this._createTilemap(tilemapKey);
  } else {
    // Fallback : ancienne méthode ASCII
    this.drawWalls();
    this.drawDecorations();
  }

  this.drawBombZone();
  this.createHUD();
  this._registerExplosionAnim();
}

_createTilemap(key) {
  const map = this.make.tilemap({ key });

  // Le nom du tileset doit correspondre à "name" dans le JSON Tiled
  const tileset = map.addTilesetImage('tilesheet', 'dungeon_tiles', 64, 64, 0, 0);

  // Créer les layers dans l'ordre (bas → haut)
  const floorLayer = map.createLayer('Floor', tileset, 0, 0);
  const wallsLayer = map.createLayer('Walls', tileset, 0, 0);
  const decorLayer = map.createLayer('Decor', tileset, 0, 0);

  // Scale : tuiles 64px → cellules 60px (ratio = 60/64 = 0.9375)
  const scale = 60 / 64;
  floorLayer.setScale(scale);
  wallsLayer.setScale(scale);
  decorLayer.setScale(scale);

  // Teinte sombre Dead Ops
  floorLayer.setTint(0x2a2a3e);
  wallsLayer.setTint(0x1a1a2a);
  decorLayer.setTint(0x2e2e3e);

  // Ajouter les layers au rootScale container
  this.rootScale.add(floorLayer);
  this.rootScale.add(wallsLayer);
  this.rootScale.add(decorLayer);

  // Lire les objets (spawns, bomb sites) depuis le layer Objects
  const objectLayer = map.getObjectLayer('Objects');
  if (objectLayer) {
    for (const obj of objectLayer.objects) {
      if (obj.type === 'bombSite') {
        this._drawBombSiteMarker(obj.x * scale, obj.y * scale, obj.properties?.siteId);
      }
    }
  }
}

_drawBombSiteMarker(x, y, id) {
  const add = (o) => { this.rootScale.add(o); return o; };
  add(this.add.rectangle(x, y, 120, 120, 0xff4500, 0.2))
    .setStrokeStyle(3, 0xff4500, 0.7).setDepth(-0.5);
  add(this.add.text(x, y, id || '?', {
    fontSize: '28px', fontFamily: 'monospace', color: '#ff4500'
  }).setOrigin(0.5).setDepth(1));
}
```

---

## 10. Activer Lights2D (effet Dead Ops)

C'est ce qui donne **l'ambiance visuelle** : le sol s'illumine autour des joueurs, les coins restent sombres.

### Dans `GameScene.js`

```javascript
create() {
  // ... AVANT de créer les layers ...

  // Activer le pipeline lumières
  this.lights.enable();
  this.lights.setAmbientColor(0x111122); // très sombre, quasi noir bleuté

  // Lumières statiques (torches sur les murs, une par couloir)
  this.lights.addLight(320,  540, 180, 0xff6600, 0.6);  // torche couloir B
  this.lights.addLight(960,  540, 220, 0x4466ff, 0.5);  // lumière bleutée mid
  this.lights.addLight(1600, 540, 180, 0xff6600, 0.6);  // torche couloir A

  // ... créer le tilemap ...

  // Appliquer le pipeline lumières aux layers
  floorLayer.setPipeline('Light2D');
  wallsLayer.setPipeline('Light2D');
  decorLayer.setPipeline('Light2D');

  // ... rest du create ...
}

// Dans la boucle update des joueurs (dans onStateUpdate) :
// Mettre à jour la lumière qui suit chaque joueur
_ensurePlayerLight(playerId, x, y, isDef) {
  if (!this._playerLights) this._playerLights = new Map();
  if (!this._playerLights.has(playerId)) {
    const color = isDef ? 0x00aaff : 0xff4400;
    const light = this.lights.addLight(x, y, 120, color, 1.2);
    this._playerLights.set(playerId, light);
  }
  const light = this._playerLights.get(playerId);
  light.setPosition(x, y);
}
```

> 🔦 Résultat : chaque joueur projette une lumière colorée (DEF = bleu, ATT = rouge), les murs bloquent la lumière, les coins restent dans l'ombre. C'est exactement l'effet Dead Ops Arcade.

---

## 11. Référence des tuiles utiles

### Sol (Floor layer)

| Tuile | Usage |
| --- | --- |
| `tile.png` | Sol de base (rempli partout) |
| `tiles.png` | Sol décoré (10-15% des cellules) |
| `tiles_cracked.png` | Sol fissuré (5-8%, zones de combat) |
| `tiles_decorative.png` | Motifs ornementaux (milieu de map) |
| `tiles_center.png` | Centre de couloir |
| `planks.png` | Planches en bois (zones différentes) |
| `floor_wall.png` | Transition sol → mur (TOUJOURS devant les murs) |
| `floor_wall_corner.png` | Coin de transition |
| `inner_round.png` | Ornement circulaire (mid de map) |

### Murs (Walls layer)

| Tuile | Usage |
| --- | --- |
| `wall.png` | Mur standard (la majorité des murs) |
| `wall_corner.png` | Coin extérieur (angle 90°) |
| `wall_curve.png` | Coin arrondi (plus fluide visuellement) |
| `wall_edge.png` | Bord de mur (transition) |
| `wall_half.png` | Demi-mur (cover mi-hauteur) |
| `wall_damaged.png` | Mur endommagé (diversité visuelle) |
| `wall_demolished.png` | Mur partiellement détruit |
| `wall_diagonal.png` | Mur diagonal (angles 45°) |

### Décors (Decor layer)

| Tuile | Usage |
| --- | --- |
| `barrel.png` / `barrels.png` | Barils (near walls) |
| `crate.png` | Caisse de transport |
| `chest.png` | Coffre (near spawns) |
| `campfire.png` | Feu de camp (near spawn CT) |
| `trapdoor_square.png` | Trappe (zones spéciales) |
| `coffin.png` | Cercueil (ambiance sombre) |
| `puddle.png` | Flaque d'eau (détail sol) |

---

## Workflow recommandé

```text
1. Ouvre Tiled
2. Crée map 32×18, tuiles 64×64
3. Importe sampleSheet.tsx
4. Remplis Floor avec tile.png (bucket fill)
5. Dessine les murs extérieurs sur Walls
6. Dessine les corridors B / Mid / A
7. Ajoute les pinch points (rows 4-5 et 11-12)
8. Ajoute cover boxes dans le Mid
9. Peins des variations sur Floor (cracked, decorated)
10. Ajoute décors sur Decor
11. Place les objets (Sites A/B, Spawns DEF/ATT) sur Objects
12. Export As JSON → public/maps/nom_map.json
13. Copie tilesheet.png → public/maps/tilesheet.png
14. Ajoute le load dans BootScene.js
15. Lance : cd client-display && npx vite build
16. Redémarre le serveur
```

---

## Résumé en 1 image

```text
TILED                           PHASER
─────────────────────           ─────────────────────────────
Floor Layer (tile.png) ──────→  floorLayer.setPipeline('Light2D')
Walls Layer (wall.png) ──────→  wallsLayer.setCollision(true)
Decor Layer            ──────→  decorLayer (z-index > walls)
Objects (spawns/sites) ──────→  Lus par code → markers, collisions

+ this.lights.enable()         → Lumières dynamiques sur les joueurs
+ this.lights.setAmbientColor  → Ambiance sombre Dead Ops
```

**Temps estimé par map : 45 minutes à 2 heures** selon la complexité.
