# Documentation Zero Strike

Index des fiches techniques du projet. Pour une vue marketing et « démarrage rapide », voir le [`README.md`](../README.md) à la racine du dépôt.

## Parcours recommandé

1. [Vue d’ensemble](01-vue-ensemble.md) — objectif, contraintes, stack.
2. [Structure du dépôt](02-structure-depot.md) — dossiers et rôles.
3. [Serveur HTTP et statique](03-serveur-racine-et-http.md) — Express, chemins, health.
4. [Sockets : namespaces et événements](04-sockets-namespaces-evenements.md) — `/display`, `/mobile`, throttling.
5. [GameApp et domaine](05-application-gameapp-et-domain.md) — effets, ticks, deltas.
6. [Cartes et monde logique](06-moteur-cartes-maps.md) — ASCII, Tiled, `MAP_LIST`.
7. [Joueurs, armes, économie](07-joueurs-mouvements-armes-economie.md) — physique, S&D, DM.
8. [Héros et presets](08-heros-skills-presets.md) — roster, `HeroService`, presets partagés.
9. [Domaines (barrière)](09-domaines-barriere.md) — Gojo/Yuta, `domainBarrier`, mobile `inDomain`.
10. [Client display (Phaser)](10-clients-display-phaser.md) — scènes, socket, rendu.
11. [Client mobile](11-client-mobile-manette.md) — joystick, lobby, HUD.
12. [API, SQLite, observabilité](12-api-base-donnees-observabilite.md) — classement, métriques, traces.
13. [Configuration et sécurité](13-configuration-environnement-securite.md) — `.env`, CORS, rate limit.
14. [Tests, build, déploiement, CI](14-tests-build-deploiement-ci.md) — npm, Playwright, Docker, Render.
15. [Glossaire et références](15-glossaire-et-references.md) — fichiers racine, docs existantes.

## Documentation déjà présente dans `docs/`

| Chemin | Sujet |
|--------|--------|
| [`GUIDE_VALIDATION.md`](GUIDE_VALIDATION.md) | Validation / checklist |
| [`maps/README.md`](maps/README.md) | Index pipeline Tiled |
| [`maps/TILED_MAP_GUIDE.md`](maps/TILED_MAP_GUIDE.md) | Guide cartes Tiled |
| [`maps/TILED_INTEGRATION_STEPS.md`](maps/TILED_INTEGRATION_STEPS.md) | Intégration pas à pas |
| [`maps/TILED_DELIVERY_CDC.md`](maps/TILED_DELIVERY_CDC.md) | Livrable / cahier des charges cartes |
| [`maps/TILED_NATIVE_RENDER_SPEC.md`](maps/TILED_NATIVE_RENDER_SPEC.md) | Spec rendu natif |
| [`maps/tiled-package-template/README.md`](maps/tiled-package-template/README.md) | Template package cartes |
| [`design/radar-references.md`](design/radar-references.md) | Références design radar |

## Fichiers à la racine utiles en complément

- [`INSTALL.md`](../INSTALL.md) — installation détaillée, LAN, IP.
- [`MAINTENANCE.md`](../MAINTENANCE.md) — maintenance, config jeu, MVC.
- [`AUDIT_TECHNIQUE.md`](../AUDIT_TECHNIQUE.md) — audit sécurité / architecture.
