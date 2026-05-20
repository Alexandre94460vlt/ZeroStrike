# Assets du dépôt

## `served/` — fichiers exposés par le serveur (via Express)

- **`served/map/`** — miniatures / previews des cartes. URL publique : **`/map/*`** (inchangée pour le client).

## `references/` — non servis en HTTP (travail design)

- **`references/radars/`** — captures « vue du dessus » pour caler les grilles (`*GridBuilder.js`). Voir [`docs/design/radar-references.md`](../docs/design/radar-references.md).

Les chemins **URL** du jeu (`/map/`, `/Kenney/`, `/tiles/`) restent stables ; seuls les emplacements **sur disque** ont été regroupés ici et sous `vendor/`.
