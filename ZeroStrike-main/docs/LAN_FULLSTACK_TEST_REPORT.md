# Rapport — session de test LAN full stack Zero Strike

**Date de la vérification automatisée :** 2026-04-15 (machine de développement, Windows).  
**Durée totale (automatisé) :** ~15 min (install déjà à jour, build, tests, smoke HTTP).  
**Important :** aucune session LAN réelle avec plusieurs téléphones / manettes n’a été menée dans cet environnement. Les sections « scénario 1–8 » et « charge multijoueur » sont donc explicitement marquées **non réalisées (N/A)** — sans résultats inventés.

---

## 1. En-tête (comptages clients)

| Métrique | Valeur constatée |
|----------|------------------|
| Clients `/mobile` connectés pendant un jeu | **0** (aucune partie multijoueur lancée) |
| Clients `/display` | **0** en jeu ; smoke HTTP `GET /display` uniquement |
| Durée d’une partie multijoueur | **N/A** |
| Mode(s) de jeu testés (S&D / DM) | **N/A** (pas de lobby / pas de match) |
| Nombre de manches / rounds joués | **0** |

---

## 2. Environnement (machine où les commandes ont été exécutées)

| Rôle | OS / shell | Node / npm | Réseau |
|------|----------------|------------|--------|
| Serveur + CI locale | Windows (PowerShell) | Node **v24.13.0**, npm **11.6.2** | Serveur écoutait `0.0.0.0:3000` ; IPv4 LAN relevée sur l’hôte : **192.168.1.148** (second segment 169.254.x.x = APIPA, non utilisé pour le plan) |
| Variables d’environnement (shell courant) | — | — | `NODE_ENV`, `PORT`, `HOST`, `ALLOWED_ORIGINS`, `DISPLAY_PASSWORD`, `METRICS_TOKEN`, `METRICS_DISABLE` : **toutes non définies** dans la session (comportement par défaut : CORS `*` côté origines, pas d’auth display, métriques HTTP sans Bearer) |

**Navigateurs / manettes :** **N/A** (pas d’ouverture manuelle de hub/display/mobile pour cette session).

---

## 3. Prérequis (plan section A) — résultats

| Vérification | Résultat |
|--------------|----------|
| `npm install` | **OK** — `up to date`, 0 vulnérabilités signalées |
| `npm run build` | **OK** — `build:display` + `build:mobile` (Vite 7.3.2) |
| `npm start` | **OK** — message serveur sur `http://0.0.0.0:3000` |
| Accès LAN depuis téléphones | **Non testé** — l’IP LAN a été relevée pour usage futur : `http://192.168.1.148:3000/` |

---

## 4. Scénario obligatoire (plan section B) — état d’exécution

| Étape | Statut | Notes factuelles |
|-------|--------|-------------------|
| 1 Hub `/` | **Partiel (automatisé)** | Playwright `tests/e2e/hub.spec.js` : `GET /` contient `href="/display"` et `href="/mobile"` — **3 tests e2e passés** dont ce scénario |
| 2 Display `/display` | **Partiel (automatisé)** | E2E : `GET /display` — **200** ; pas de création de salle ni QR |
| 3 Mobile pseudos / latence UI | **N/A** | Aucun client `/mobile` connecté |
| 4 Lobby (vote, prêt, transitions) | **N/A** | — |
| 5 En jeu 2–3 min inputs | **N/A** | — |
| 6 Fin de manche, ≥2 rounds | **N/A** | — |
| 7 Quitte brutale / reconnexion | **N/A** | — |
| 8 Charge max + CPU/RAM + FPS display | **N/A** | Aucune charge multijoueur ; **CPU/RAM sous charge** non relevés |

**Tests automatisés additionnels :** `npm test` — **152 tests, 0 échec** (logique serveur / domaine / maps / sanitisation, etc.).

---

## 5. Évidence collectée (plan — collecte)

### 5.1 `GET /health` (localhost)

```json
{"ok":true,"service":"zero-strike"}
```

### 5.2 `GET /api/metrics` — premier snapshot (LOBBY vide)

```json
{"ts":"2026-04-15T15:06:51.069Z","round_state":"LOBBY","players_connected":0,"sockets":{"display":0,"mobile":0},"rtt_ms":{"display":null,"mobile":null},"last_loop":null}
```

### 5.3 `GET /api/metrics` — après quelques secondes (boucle de jeu)

```json
{"ts":"2026-04-15T15:07:18.909Z","round_state":"LOBBY","players_connected":0,"sockets":{"display":0,"mobile":0},"rtt_ms":{"display":null,"mobile":null},"last_loop":{"physics_tps":60,"outer_loop_hz":34.1,"max_tick_wall_ms":1,"round_state":"LOBBY","players":0,"sockets_display":0,"sockets_mobile":0}}
```

### 5.4 Logs serveur (stdout, événement `game_metrics`)

Extrait du terminal `npm start` :

```text
{"ts":"2026-04-15T15:06:58.936Z","level":"info","event":"game_metrics","service":"zero-strike","physics_tps":60,"outer_loop_hz":34.9,"max_tick_wall_ms":1,"round_state":"LOBBY","players":0,"sockets_display":0,"sockets_mobile":0}
{"ts":"2026-04-15T15:07:13.946Z","level":"info","event":"game_metrics","service":"zero-strike","physics_tps":60,"outer_loop_hz":34.1,"max_tick_wall_ms":1,"round_state":"LOBBY","players":0,"sockets_display":0,"sockets_mobile":0}
```

### 5.5 Consoles navigateur (F12)

**N/A** — aucune session navigateur instrumentée pour cette exécution (hors workers Playwright non journalisés ici).

---

## 6. Bugs observés

**Aucun** pendant les étapes réellement exécutées (`npm install`, `npm run build`, `npm start`, `npm test`, `npm run test:e2e`, requêtes `curl` vers `/health` et `/api/metrics`).

---

## 7. Régressions réseau (multijoueur / display vs mobile)

**Non observées** — **N/A** (pas de trafic multijoueur).

---

## 8. Verdict GO / NO-GO et correctifs

| Portée | Verdict | Justification |
|--------|---------|---------------|
| Chaîne **build + démarrage serveur + smoke HTTP + tests** | **GO** | Build OK, serveur joignable, `/health` et `/api/metrics` cohérents à vide ; 152 tests unitaires + 3 e2e passés |
| **Démo / LAN party multijoueur (10–40 joueurs)** | **NO-GO** | Le scénario humain complet (hub → display → N mobiles → lobby → jeu → rounds → reconnexions → charge) **n’a pas été exécuté** ; impossible d’attester fluidité, désync, ou robustesse réseau |

**P0 (bloquant avant démo LAN réelle)**

1. Mener la session manuelle décrite dans le plan sur le LAN (`http://<IP>:3000`, pas `localhost` sur les téléphones), avec comptage exact des clients et capture F12 / logs serveur en incident.

**P1**

1. Si déploiement avec `NODE_ENV=production` sur le LAN : configurer `ALLOWED_ORIGINS` pour les origines `http://<IP>:3000` (voir `server/middleware/httpSecurity.js`).
2. Documenter les limites des onglets multiples (throttling WebSocket, sommeil d’onglet) si utilisation d’onglets `/mobile` de secours.

---

## 9. Synthèse (10 lignes max)

1. **Prérequis** : Node 24, `npm install` / `npm run build` / `npm start` validés sur la machine de test.  
2. **Réseau** : serveur sur `0.0.0.0:3000` ; IPv4 LAN relevée **192.168.1.148** (non validée avec des clients physiques).  
3. **Hub / display (smoke)** : e2e confirme liens hub et `GET /display` 200.  
4. **Métriques à vide** : `physics_tps` ≈ 60, `outer_loop_hz` ≈ 34–35, pas de joueurs ni sockets.  
5. **Tests** : 152 tests unitaires OK ; 3 tests Playwright OK (`/health`, hub, `/display`).  
6. **Scénario multijoueur 1–8** : **non exécuté** (0 mobile, 0 partie).  
7. **Charge 10–40 joueurs / CPU-RAM / FPS display** : **non mesuré**.  
8. **Bugs** : aucun sur la portion automatisée.  
9. **Verdict technique local** : **GO** pour intégration continue locale ; **NO-GO** pour une démo LAN multijoueur sans la session manuelle.  
10. **Charge max sans dégradation** : **N/A** (aucun test de charge multijoueur réalisé).

---

*Ce document peut être complété après une vraie session LAN en recopiant les sections N/A avec des mesures réelles, sans modifier les résultats ci-dessus.*
