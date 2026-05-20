# Configuration, environnement et sécurité

## Fichier `.env`

Copier [`.env.example`](../.env.example) vers **`.env`** à la racine. Variables principales :

| Variable | Rôle |
|----------|------|
| `PORT`, `HOST` | Écoute HTTP/WebSocket |
| `DISPLAY_STATE_DELTA` | `0`/`false` = toujours état complet display |
| `SOCKET_COMPRESS` | Désactiver compression WS si besoin |
| `DISPLAY_PASSWORD` | Protège le namespace `/display` |
| `DB_PATH`, `LEADERBOARD_SAVE_DEBOUNCE_MS` | SQLite sql.js |
| `NODE_ENV`, `ALLOWED_ORIGINS` | CORS strict en prod |
| `DEBUG` | Logs inputs verbeux |
| `GAME_TRACE` | Traces JSON partie |
| `METRICS_*`, `METRICS_TOKEN` | Observabilité / protection métriques |
| `GIPHY_API_KEY` | Proxy Giphy |
| `RATE_LIMIT_*` | Fenêtres rate limit API |
| `TRUST_PROXY` | Confiance reverse proxy (IP client) |

## CORS et origines

- `getAllowedOrigins()` + `createCorsMiddleware()` : en production sans liste explicite, comportement documenté dans le code (ex. domaine Render par défaut).
- Socket.io **cors.origin** aligné sur la même logique.

## Rate limiting

`express-rate-limit` sur les routes API générales, proxy et métriques — seuils surchargeables par env.

## Sanitization

- Noms joueurs : [`server/utils/sanitizePlayerName.js`](../server/utils/sanitizePlayerName.js).
- Paramètres API : [`server/utils/apiInput.js`](../server/utils/apiInput.js).

## Authentification display

[`server/config/displayAuth.js`](../server/config/displayAuth.js) — si `DISPLAY_PASSWORD` est non vide après trim, le contrôleur display exige `display_login` ; la comparaison est une égalité de chaînes classique (usage type : salle de cours / anti-onglet projecteur, pas secret haute criticité).

## Référence audit

Le document **[`AUDIT_TECHNIQUE.md`](../AUDIT_TECHNIQUE.md)** à la racine complète cette fiche avec la menace modèle, cookies, headers, recommandations déploiement.

## Bonnes pratiques déploiement

- HTTPS terminé par la plateforme (Render, etc.).
- Secrets dans les **variables d’environnement** du PaaS, pas dans le git.
- Limiter `ALLOWED_ORIGINS` aux domaines réels du hub/display/mobile.
