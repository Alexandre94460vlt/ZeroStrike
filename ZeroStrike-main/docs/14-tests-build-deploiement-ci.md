# Tests, build, déploiement et CI

## Scripts npm ([`package.json`](../package.json))

| Script | Action |
|--------|--------|
| `npm start` | `node server/index.js` |
| `npm run dev` | `node --watch server/index.js` |
| `npm run build` | `build:display` + `build:mobile` (Vite) |
| `npm run dev:display` / `dev:mobile` | Vite en mode dev |
| `npm test` | [`scripts/run-tests.mjs`](../scripts/run-tests.mjs) — tous les `tests/*.test.js` |
| `npm run test:coverage` | Couverture expérimentale Node |
| `npm run test:watch` | Watch tests |
| `npm run test:e2e` | Playwright |
| `npm run validate` | `npm test` + `npm run build` |
| `npm run ci:local` | tests + build + e2e |
| `npm run tiled-to-ascii` | Conversion carte Tiled → ASCII (`scripts/tiled-to-ascii.mjs`) |
| `npm run spritesheet` | `scripts/make-spritesheet.js` |

## Tests unitaires / intégration

- Répertoire **`tests/`** : fichiers `*.test.js` découverts automatiquement (tri par nom).
- Runner : **API native** `node --test` (Node 20+).

## Tests e2e

- **`tests/e2e/`** — Playwright (`@playwright/test`).
- Ex. santé HTTP : chargement de `/health` ou pages publiques selon les specs du projet.

## CI

- **[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)** (si présent) : typiquement install, tests, build.

## Docker

- **`Dockerfile`** / **`docker-compose.yml`** à la racine — détails d’usage dans [`INSTALL.md`](../INSTALL.md).

## Render

- **`render.yaml`** — blueprint services web, variables d’environnement à renseigner dans le dashboard.

## Prérequis release

1. `npm install`
2. `npm run build` (obligatoire avant `npm start` en prod sans prebuild).
3. Vérifier `.env` sur l’hébergeur.

## Maintenance

Voir [`MAINTENANCE.md`](../MAINTENANCE.md) pour la cartographie des fichiers « config jeu » et conventions MVC.
