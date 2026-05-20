Zero Strike — dossier images Tiled (optionnel)
==============================================

Les fichiers .tsx dans ../tilesets/ pointent désormais vers les PNG **canoniques**
sous vendor/kenney/ (pas de copie obligatoire ici).

Correspondance packs :
  dist2.tsx     → vendor/kenney/kenney_tower-defense-top-down/Tilesheet/
  ascension.tsx → vendor/kenney/kenney_scribble-dungeons/Tilesheet/
  maven.tsx     → vendor/kenney/kenney_top-down-shooter/Spritesheet/
  chadigo.tsx   → vendor/kenney/kenney_rolling-ball-assets/Spritesheet/

Tu peux garder des copies locales dans ce dossier pour des tests hors dépôt,
mais Tiled résout les textures via les chemins relatifs dans chaque .tsx.

Note : le serveur ZeroStrike ne sert pas automatiquement le dossier /maps/ ;
les URLs d’aperçu navigateur dépendent d’une config static dédiée si tu en ajoutes une.
