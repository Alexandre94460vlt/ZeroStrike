# Glossaire et références croisées

## Termes fréquents

| Terme | Signification |
|-------|----------------|
| **Authoritative server** | Le serveur possède l’état canonique ; les clients proposent des actions. |
| **Namespace** | Chemin Socket.io isolé : `/display` ou `/mobile`. |
| **TPS** | Ticks par seconde (simulation serveur, typiquement 60). |
| **Delta state** | Patch JSON d’état display vs tick précédent (`DISPLAY_STATE_DELTA`). |
| **SND / S&D** | Search & Destroy — bombe, sites, équipes ATT/DEF. |
| **DM** | Deathmatch — score par éliminations. |
| **Lobby** | Phase `LOBBY` : vote carte, réglages, prêt, QR. |
| **sql.js** | SQLite compilé en WebAssembly ; fichier ou `:memory:` pour les tests. |

## Fichiers « source de vérité » par sujet

| Sujet | Fichiers clés |
|-------|----------------|
| Entrée serveur | `server/index.js` |
| Boucle temps réel | `server/services/GameLoopService.js` |
| Moteur | `server/domain/GameEngine.js` |
| Application / réseau | `server/app/GameApp.js` |
| Sockets | `server/controllers/DisplayController.js`, `MobileController.js` |
| Cartes | `server/models/maps/Maps.js`, `tiledMapParser.js` |
| Armes | `server/models/Weapon.js` |
| Héros roster | `server/models/Heroes.js` |
| Capacités | `server/services/HeroService.js` |
| Constantes gameplay | `server/config/constants.js` |
| Presets | `shared/gamePresets.js` |
| Teintes sprites | `shared/heroBodyTint.js` |
| États de round | `server/state/RoundStateMachine.js` |

## Documentation interne (hors série `01–15`)

| Document | Contenu |
|----------|---------|
| [`README.md`](../README.md) | Vue produit, badges, liens rapides |
| [`INSTALL.md`](../INSTALL.md) | Installation, LAN, IP, Docker |
| [`MAINTENANCE.md`](../MAINTENANCE.md) | Exploitation, structure MVC, fichiers sensibles |
| [`AUDIT_TECHNIQUE.md`](../AUDIT_TECHNIQUE.md) | Sécurité, risques, mitigations |
| [`docs/GUIDE_VALIDATION.md`](GUIDE_VALIDATION.md) | Validation |
| [`docs/maps/*`](maps/README.md) | Pipeline Tiled complet |

## Index de la série courante

Retour à l’[**index `docs/README.md`**](README.md).
