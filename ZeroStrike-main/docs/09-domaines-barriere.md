# Domaines (Gojo / Yuta) — barrière circulaire

## Fichier utilitaire : [`server/utils/domainBarrier.js`](../server/utils/domainBarrier.js)

Fonctions **pures** (sans dépendance socket) :

1. **`assignPlayerDomainSide(px, py, pr, cx, cy, R)`**  
   Détermine si le joueur est **`in`** ou **`out`** du disque au moment de l’activation, en tenant compte du **centre** `(cx, cy)`, du **rayon domaine** `R` et du **rayon hitbox** `pr` :  
   `in` si la distance au centre ≤ `R - pr`.

2. **`clampPlayerAgainstDomainBarrier(px, py, pr, cx, cy, R, side)`**  
   Après activation :
   - côté **`in`** : le joueur ne peut pas **sortir** du disque (clamp vers l’intérieur si `d > R - pr`) ;
   - côté **`out`** : le joueur ne peut pas **entrer** dans le disque (repoussé si `d < R + pr`).

Cela matérialise une **barrière** : ceux à l’intérieur restent piégés jusqu’à la fin du domaine ; ceux à l’extérieur ne traversent pas le mur circulaire.

## Intégration gameplay

La logique complète (gel des ennemis dans la zone Gojo, durées, synchronisation fin de domaine, **Yuta** / variantes) vit dans **`GameEngine`** + **`HeroService`** (collisions, états `activeDomains`, dégâts, etc.).

## Client mobile : `inDomain`

En **`ACTION_PHASE`**, `GameApp.broadcastState` envoie par socket mobile un **`context_update`** avec le contexte renvoyé par **`engine.getPlayerContext(p)`** — notamment pour rafraîchir l’UI (plant/defuse/reload) et le flag **`inDomain`** afin que la manette reflète les restrictions **hors scope** de ce document si le gameplay évolue.

## Constantes

Exemples dans `constants.js` : **`GOJO_DOMAIN_RADIUS`**, **`GOJO_FREEZE_DURATION_MS`**, paramètres Yuta / autres héros dans la même section.

## Audit sécurité (rappel)

Rien ici n’expose de secret : ce sont des règles géométriques. La **validation serveur** des positions reste dans le moteur ; le client ne fait que afficher / adapter l’UI.
