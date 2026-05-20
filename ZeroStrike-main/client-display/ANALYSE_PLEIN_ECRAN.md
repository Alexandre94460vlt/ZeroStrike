# Analyse : pourquoi le jeu ne prend pas toute la page (bandes à gauche/droite)

## Résumé

Les bandes grises viennent du **Scale Manager** de Phaser et de la **taille du parent** au moment du boot.

## 1. Comment Phaser calcule la taille du canvas

- Phaser utilise la taille du **parent** (`#game-container`) via `getBoundingClientRect()`.
- Avec les modes **FIT** ou **ENVELOP**, il applique un **aspect ratio** (1920/1080) via `displaySize.setAspectMode(scaleMode)`.
- La taille affichée du canvas est donc dérivée de la taille du parent et de ce mode.

## 2. Problème : parent sans taille au boot

- Au premier `parseConfig()`, Phaser appelle `getParentBounds()` tout de suite.
- Si le parent est un **div vide** avec seulement `width: 100vw; height: 100vh` en CSS :
  - selon le navigateur et le moment du layout, `getBoundingClientRect()` peut renvoyer **0×0** (parent “sans taille”);
  - la doc Phaser dit : *"if the parent has no defined width or height, auto-centering and other scaling operations will fail"* et *"This can often set a height of zero (especially for un-styled divs)"*.
- Quand `parentSize` est (0, 0) :
  - `displaySize.setParent(this.parentSize)` n’est **pas** appelé (à cause du test `parentSize.width > 0 && parentSize.height > 0`);
  - la taille d’affichage reste celle du **jeu** (1920×1080), pas celle de la fenêtre;
  - le canvas est donc rendu en **1920×1080 px** et centré avec **CENTER_BOTH**;
  - sur un écran **plus large** que 1920 px, il y a des **bandes à gauche et à droite**.

## 3. Pourquoi le CSS “100%” sur le canvas ne suffit pas

- Le Scale Manager **réécrit** les styles du canvas (`style.width`, `style.height`, `marginLeft`, `marginTop`) à chaque `refresh()`.
- Même avec `width: 100% !important` en CSS, le calcul de Phaser a déjà fixé une taille (1920×1080) et le centrage, donc le comportement “plein écran” ne s’applique pas correctement tant que la **source** (taille du parent) est fausse.

## 4. Solution appliquée

1. **Donner au parent une taille explicite en pixels avant le boot de Phaser**  
   Un script inline, exécuté juste après `#game-container`, fixe :
   - `#game-container.style.width = window.innerWidth + 'px'`
   - `#game-container.style.height = window.innerHeight + 'px'`  
   Ainsi, au premier `getParentBounds()`, le parent a déjà la bonne taille.

2. **`expandParent: true`** dans la config scale pour que Phaser tente de corriger `body`/`html` si le parent n’a pas de hauteur.

3. **Écouter `resize`** et appeler `game.scale.refresh()` pour que le redimensionnement de la fenêtre mette à jour la taille et supprime les bandes après un resize.

Résultat : le parent a toujours une taille correcte, ENVELOP peut “envelopper” toute la zone, et le canvas remplit la page sans bandes.
