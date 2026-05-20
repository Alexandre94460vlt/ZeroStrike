# Guide de validation — Zero Strike

Ce document décrit **pas à pas** ce que faire après un changement de code (local, CI, prod) et comment interpréter les résultats.

---

## 1. Sur ta machine (développeur)

### Étape 1.1 — Dépendances

```bash
npm ci
```

Utilise `npm ci` (pas seulement `install`) pour reproduire le lockfile à l’identique, comme en CI.

### Étape 1.2 — Tests unitaires

```bash
npm test
```

- **Succès** : tous les fichiers `tests/*.test.js` passent (Node `--test`).
- **Échec** : lire le nom du fichier et du cas ; corriger puis relancer.

### Étape 1.3 — Build des clients (Vite)

```bash
npm run build
```

Équivalent à `build:display` + `build:mobile`. Les sorties vont dans :

- `client-display/dist/`
- `client-mobile/dist/`

Le serveur (`npm start`) sert ces dossiers sous `/display` et `/mobile`. **Sans rebuild**, les joueurs qui utilisent le `dist` ne voient pas les derniers changements JS/CSS.

### Étape 1.4 — Smoke HTTP (Playwright)

```bash
npm run test:e2e
```

- Démarre un serveur éphémère (voir `playwright.config.js`, `DB_PATH=:memory:`).
- Vérifie au minimum `GET /health`.

Si le port **3000** est déjà pris par ton `npm run dev`, Playwright réutilise le serveur existant (`reuseExistingServer: true`). Pour forcer un serveur dédié aux tests, libère le port ou définis `PLAYWRIGHT_BASE_URL`.

Pour **sauter** le lancement automatique du serveur (tu lances `node server/index.js` toi-même) :

```bash
set PLAYWRIGHT_SKIP_WEBSERVER=1
npm run test:e2e
```

(PowerShell : `$env:PLAYWRIGHT_SKIP_WEBSERVER='1'`.)

### Étape 1.4 bis — Couverture (optionnel)

```bash
npm run test:coverage
```

Même liste de fichiers que `npm test`, avec **`--experimental-test-coverage`** (résumé lignes/fonctions en fin de log). La **CI GitHub** exécute cette variante dans le job `test`.

### Étape 1.5 — Tout en une commande

| Commande        | Contenu                          |
|----------------|-----------------------------------|
| `npm run validate`  | `npm test` puis `npm run build`   |
| `npm run ci:local`  | tests + build + `test:e2e`       |

À lancer avant un merge ou une release. Pour coller à la CI sur les tests uniquement : `npm run test:coverage` au lieu de `npm test` dans ta routine locale.

---

## 2. Validation « jeu réel » (LAN / salle)

1. **Serveur** : `npm start` (ou `npm run dev` avec rebuild si tu modifies le display/mobile).
2. **Display** : navigateur sur `http://<ip>:3000/display` — mot de passe si `DISPLAY_PASSWORD` est défini.
3. **Mobiles** : `http://<ip>:3000/mobile?r=<CODE>` (code affiché sur le projecteur).
4. **Scénario minimal** : 2 joueurs → Prêt (hôte peut ne pas être « prêt » selon les règles) → Lancer → vote carte → partie.
5. **Deltas `state_update`** (optionnel) : avec `DISPLAY_STATE_DELTA` actif (défaut), observer fluidité ; en cas de glitch visuel, tester avec `DISPLAY_STATE_DELTA=0` dans `.env` pour revenir au full JSON chaque tick.

---

## 3. CI GitHub Actions

Fichier : `.github/workflows/ci.yml`. Cache **`npm`** activé via `actions/setup-node` (`cache: npm`).

| Job    | Rôle                                      |
|--------|--------------------------------------------|
| `test` | `npm ci` + `npm run test:coverage`         |
| `e2e`  | après `test` : `npm run build` puis Playwright + `test:e2e` (le hub `/` et `/display` servent le `dist`) |
| `build`| après `test` : `npm run build` + artefact `client-dist` (7 jours) |

Les branches déclenchées : `main`, `master`, et toute **pull_request**.

**Dependabot** : `.github/dependabot.yml` — PR hebdomadaires pour les dépendances **npm** et les **GitHub Actions** utilisées dans les workflows.

---

## 4. Production (ex. Render)

1. **Variables** : copier depuis `.env.example` — notamment `NODE_ENV=production`, `ALLOWED_ORIGINS` (URL `https://…onrender.com`), `METRICS_TOKEN` si `/api/metrics` est exposé, `DB_PATH` si volume persistant.
2. **`DISPLAY_PASSWORD`** : avec le blueprint [`render.yaml`](../render.yaml), la clé est en `sync: false` — **à renseigner une fois dans le dashboard Render** (jamais en clair dans le dépôt).
3. **Santé** : `GET /health` pour les sondes.
4. **Trust proxy** : `TRUST_PROXY` selon le nombre de hops (Render : souvent `1`).
5. **Arrêt** : le serveur enregistre `SIGINT`/`SIGTERM` → flush SQLite + `io.close()` (voir `server/index.js`).

---

## 5. Dépannage rapide

| Symptôme | Piste |
|----------|--------|
| API classement 500 | Vérifier import `LeaderboardService` et `DB_PATH` |
| CORS / WebSocket refusé | `ALLOWED_ORIGINS` + URL exacte (schéma + host) |
| Display figé après déploiement | Rebuild + cache navigateur ; vérifier `state_update` / deltas |
| Playwright CI échoue | Logs du job `e2e` ; si tu ajoutes des tests **navigateur**, réintroduis `npx playwright install chromium` dans le workflow |

---

## 6. Références dans le dépôt

- Audit : `AUDIT_TECHNIQUE.md`
- Variables : `.env.example`
- Tests : `tests/*.test.js`, lanceur `scripts/run-tests.mjs`
