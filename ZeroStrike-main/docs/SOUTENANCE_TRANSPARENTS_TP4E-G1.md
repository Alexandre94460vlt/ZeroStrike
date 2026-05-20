# Transparentes de soutenance — Zero Strike (TP4E-G1)

**Groupe :** TP4E-G1  
**Échéance :** mercredi 15 avril 2026, 23:59  
**Auteurs document :** Ilian El Bouazzaoui Prieur · Mahamat Ibrahim  

Ce fichier est la **maquette textuelle** des diapositives : export PowerPoint / Google Slides / Impress en respectant la **charte** et les **pieds de page** (nom du **présentateur** par slide, exigence de remise).

**PPTX généré automatiquement** : à la racine du dépôt, `npm run soutenance:pptx` produit `docs/SOUTENANCE_TP4E-G1_ZeroStrike.pptx` (charte sombre, images `docs/screenshots/`, schémas intégrés). Remplacer **Prénom NOM** dans les pieds de page par personne et par slide avant remise.

---

## Alignement avec la grille d’évaluation (cible 3 pts écrit + oral)

| Critère (extrait consigne) | Comment ce document y répond |
|-----------------------------|--------------------------------|
| **Cohérence graphique** (police, titres, sous-texte, images) | Section **Charte graphique** + une palette / une police partout + captures **16:9** identiques. |
| **Qualité de l’expression écrite** | Puces courtes, **3–6 max** par slide, **orthographe** relue (accents, « jusqu’à », S&D, Socket.io). |
| **Structure des transparents** | **Bloc 1 (~2 min)** = GDD + **originalité** · **Bloc 2 (~2 min)** = planif + **partage du travail** + **problèmes techniques et humains** · **Bloc 3** = **une slide d’intro à la démo** puis démo. |
| **Timing oral (~5 min hors démo)** | Tableau **Passage micro** : répartition du temps, **pas de répétition** des mêmes explications. |
| **Partage du discours** | Une colonne **Qui parle** par slide ; chacun annonce **son périmètre** une seule fois. |
| **Vulgariser** | Slide stack = **tableau simple** ; flux « intentions → serveur → écran » en **une phrase** sur la slide originalité. |

**Conditions de remise (rappel)** : transparents **avant** la soutenance, **qualité professionnelle**, pied de page = **nom de la personne qui présente** la slide.

---

## Charte graphique (cohérence professionnelle)

| Élément | Règle |
|--------|--------|
| **Police** | **Une seule** famille sur tout le deck (ex. Calibri ou Montserrat) : titres **gras**, corps regular. Corps **≥ 24 pt** en salle. |
| **Couleurs** | Fond **sombre #0d1117** *ou* clair **#f6f8fa** ; **un** accent (ex. orange **#f97316**) ; texte **contraste fort**. |
| **Titres** | Titre slide : **une ligne**, 36–44 pt. Sous-titre éventuel : 28–32 pt. Éviter le « TOUT EN MAJUSCULES » sur plus de trois mots. |
| **Corps** | **3 à 6 puces max** ; pas de paragraphes ; chiffres clés en **gras**. |
| **Images** | Même style de cadre (coins / ombre) ; captures **16:9** : **Hub /**, **Lobby display**, **Manette mobile**. Nom du jeu **identique** partout (**Zero Strike**). |
| **Pied de page (obligatoire)** | `Zero Strike · BUT 2 · TP4E-G1 · Présentateur : **Prénom NOM**` — le nom change selon la slide. Numéro de slide à droite si possible. |

### Fichiers captures disponibles

Dossier : **`docs/screenshots/`** — insérer dans le deck avec le **même cadre** (coins / ombre) partout.

| Fichier | Rôle |
|---------|------|
| `lobbyDisplay.png` | Lobby **display** (grand écran) |
| `lobbyDisplayAvecJoueurPret.png` | Lobby display, variante **joueur prêt** |
| `ChoixMapMobile.png` | Vote de carte côté **mobile** |
| `mobileFirstPage.png` | Première page / connexion **mobile** |
| `IngameAscension.png` | Partie en cours (ex. map Ascension) |
| `Classement.png` | Écran **classement** (persistance / API) |

*Optionnel charte « Hub » : une capture de **`/`** (hub) si tu la produis ; elle n’est pas encore dans ce dossier.*

---

## Données projet (à respecter sur les slides — cohérence avec le code)

Éviter les durées **inventées** (ex. bombe 45 s, buy 10 s figé, round 2 min partout) : tout dépend des **presets** (`shared/gamePresets.js`).

| Élément | Ordre de grandeur réel |
|--------|-------------------------|
| Buy phase | **10–14 s** selon preset |
| Round (action) | **~65–105 s** selon preset |
| Timer bombe après plant | **~35–38 s** selon preset |
| Simulation | **~60 TPS** serveur |
| État vers display | **~30 Hz** + mises à jour *dirty* (`GameLoopService.js`) |
| Modes | **S&D** (bombe, économie) + **DM** (limite de frags) |
| Sites bombe | **A / B** et **C** selon la carte |
| Cartes (noms jeu) | **Dist2**, Ascension, Maven, **Chadigo** (fichiers `.tmj` ; grille **80×45**) |
| URLs | **Hub /**, **/display**, **/mobile**, **/health** |
| **Hébergement & démo** | Application **déployée sur Render** — **plan gratuit** (free tier), via `render.yaml` ; **démo de soutenance prévue sur cette URL publique** (`https://<votre-service>.onrender.com` — même base pour `/`, `/display`, `/mobile`) |
| Ops | **Docker Compose**, **Render**, **GitHub Actions** |

---

## Timing global (oral — cible grille)

| Phase | Durée cible | Contenu |
|--------|-------------|---------|
| **Bloc 1 — GDD** | **~2 min** | Concept, modes, boucle, **originalité** (mis en valeur) |
| **Bloc 2 — Planification** | **~2 min** | **Partage du travail** explicite, jalons, **problèmes techniques**, **problèmes humains** |
| **Bloc 3 — Intro démo** | **~30 s – 1 min** | **Un** transparent d’introduction, puis **démo** |
| **Démo** | Selon enseignant | Slide « Démo » possible en fond pendant le jeu |

**Objectif oral total hors démo : ~5 min**, parole **équitable** (ex. **~2 min 30** chacun si vous êtes **2**). **Aucune répétition** : si l’autre a dit « serveur autoritaire », toi tu enchaînes sur **ton** lot (display, mobile, etc.).

### Passage micro (exemple à 2 — à ajuster avant remise)

| Plage | Slides | Intervenant suggéré | Sujet |
|--------|--------|---------------------|--------|
| Bloc 1 début | 1–3 | Ilian | Titre, pitch, modes |
| Bloc 1 fin | 4–6 | Mahamat | Boucle, **originalité**, stack |
| Bloc 2 | 7–10 | Ilian puis Mahamat | Organisation (Ilian), planning (Ilian), **problèmes tech** (Mahamat), **problèmes humains** (Mahamat) |
| Transition | 11 | Celui qui pilote la démo | Intro démo |
| Démo | — | Pilote + autres silencieux ou compléments brefs | Jeu |

---

## Bloc 1 — Game Design Document (**~2 minutes**)

*Inclure : concept, modes, boucle, public, et **mettre en valeur l’originalité**.*

---

### Slide 1 — Titre

**Zero Strike**  
Jeu de tir tactique multijoueur sur **LAN** — jusqu’à **40 joueurs**

- **Grand écran** (Phaser 3) : `/display` — arène visible par tout le monde  
- **Smartphone** : `/mobile` — manette (joystick, tir, shop)  
- **Hub** `/` — orientation joueurs · **TP4E-G1** · Ilian El Bouazzaoui Prieur · Mahamat Ibrahim

_Pied de page : Présentateur : **Prénom NOM**_

**Visuels** (`docs/screenshots/`) : grande **`lobbyDisplay.png`** (ou **`lobbyDisplayAvecJoueurPret.png`**) ; vignette **`mobileFirstPage.png`** ou **`ChoixMapMobile.png`** à côté pour montrer display + mobile.

**Schémas** : *optionnel* — trois blocs avec flèches : **Mobile** → **Serveur** → **Display** (vulgarisation architecture salle).

---

### Slide 2 — Pitch & public cible

- **Pitch :** affrontement **tactique temps réel**, pensé **salle de cours**, LAN party, **soutenance jury** (vidéoprojecteur).  
- **Objectif joueur :** gagner la manche (**S&D**) ou dominer au score (**DM**).  
- **Public :** du casual au compétitif ; **1 serveur + téléphones** ; pour la soutenance, **démo sur l’instance Render (plan gratuit)** en HTTPS, ou **LAN** en secours (`http://<IP>:3000/...`).

_Pied de page : Présentateur : **Prénom NOM**_

**Visuels** : *aucune image obligatoire* ; au plus une **`lobbyDisplay.png`** si la slide reste aérée.

**Schémas** : *non* (slide texte).

---

### Slide 3 — Modes de jeu (extrait GDD)

- **Search & Destroy (S&D)** : attaque / défense, **plantage / désamorçage**, sites **A / B** (+ **C** selon carte), **économie** entre manches (**règles serveur**).  
- **Deathmatch (DM)** : victoire par **limite de frags** configurable.  
- **Lobby** : équipe, **vote de carte**, prêt ; **lancement par l’hôte** sur l’onglet **display**.

_Pied de page : Présentateur : **Prénom NOM**_

**Visuels** : **`ChoixMapMobile.png`** (vote carte sur manette).

**Schémas** : *optionnel* — deux pictos ou cases **S&D** vs **DM** + courte légende (sans paragraphe).

---

### Slide 4 — Boucle d’une manche

1. **Lobby** — QR / URL, pseudo, équipe, vote map, attente **lancement hôte**  
2. **Buy phase** — armes / héros, budget ; **durée selon preset** (voir encadré données projet)  
3. **Action** — déplacements, tirs, bombe (S&D) ; **durée de round selon preset**  
4. **Fin de round** — score, **économie**, manche suivante

_Pied de page : Présentateur : **Prénom NOM**_

**Visuels** : **`lobbyDisplayAvecJoueurPret.png`** pour l’étape lobby ; si la slide reste lisible, ajouter **`IngameAscension.png`** pour l’étape action (sinon une seule image).

**Schémas** : **recommandé** — **timeline horizontale** à 4 étapes : Lobby | Buy | Action | Fin de round (flèches entre les cases).

---

### Slide 5 — **Originalité** (à mettre en avant — exigence consigne)

- **Spectacle** : séparation nette **grand écran public** / **entrée joueur** sur mobile — peu courant en TP « solo écran ».  
- **Serveur autoritaire** : **~60 TPS** ; état synchronisé vers le display **~30 Hz** + *dirty* ; les clients envoient des **intentions**, pas une position « magique » (anti-triche simple).  
- **Cartes** : **Tiled** (`.tmj`, **80×45**) + **repli ASCII** si besoin — design et robustesse.  
- **Produit** : classement **SQLite** (`sql.js`), **API** `/api/*`, **CI** + **Playwright**, **Docker** ; **mise en ligne sur Render (plan gratuit)** pour tester et **passer la démo** devant le jury sans dépendre uniquement du LAN.

_Pied de page : Présentateur : **Prénom NOM**_

**Visuels** : **`IngameAscension.png`** (spectacle / Phaser) ; **`Classement.png`** (persistance / produit). Si trop chargé : **une seule** des deux.

**Schémas** : **recommandé** — flux **intentions** (mobile) → **Serveur (~60 TPS)** → **Display (~30 Hz)** (trois blocs, flèches ; pas de code).

---

### Slide 6 — Stack & accès (vulgarisation en **un** tableau)

| Rôle | Technologie |
|------|-------------|
| Serveur | Node.js **20+** (ESM), Express, **Socket.io** v4 |
| Display | **Phaser 3**, Vite |
| Mobile | HTML5, **Nipple.js**, Vite |
| Web | **Hub /**, santé **`/health`** |
| Données | **sql.js**, `/api/*` |
| Déploiement | **Docker Compose**, **Render** (`render.yaml`, **plan gratuit**) — **site hébergé sur Render** ; **démo soutenance prévue sur l’URL HTTPS du service** |

_Pied de page : Présentateur : **Prénom NOM**_

**Visuels** : *pas obligatoire* ; éventuellement petites vignettes **`lobbyDisplay.png`** + **`mobileFirstPage.png`** sous le tableau.

**Schémas** : **recommandé** — empilement ou colonnes : **Display** | **Mobile** | **Serveur** | **Données** | **Déploiement** (cinq bandes, libellés courts).

---

## Bloc 2 — Planification de projet (**~2 minutes**)

*Partage du travail **clair et explicite** ; **problèmes techniques** ; **problèmes humains**.*

---

### Slide 7 — Organisation — **partage du travail**

À **2 personnes** (adapter si vous êtes plus) :

| Domaine | Responsable principal |
|---------|------------------------|
| Serveur, gameplay, Socket.io, `server/domain/` (ex. `GameEngine.js`) | **Ilian El Bouazzaoui Prieur** |
| Display Phaser (HUD, lobby, scènes) + client **mobile** (UX, shop, sync) | **Mahamat Ibrahim** |
| *Transversal* | Cartes **Tiled**, **DevOps** (Docker, Render), **tests** : **répartir explicitement** à l’oral qui a fait quoi (évite « on a tous fait »). |

_Pied de page : Présentateur : **Prénom NOM**_

**Visuels** : *non* (slide tableau organisation).

**Schémas** : *optionnel* — deux colonnes **Ilian** / **Mahamat** + ligne ou flèche « transversal » (Tiled, DevOps, tests).

---

### Slide 8 — Planning (documents de planification / jalons)

| Phase | Livrable |
|--------|----------|
| **Jalon 1** | HTTP + Socket.io, lobby minimal, architecture domaine / app |
| **Jalon 2** | Display + mobile ; déplacements, **collisions serveur** |
| **Jalon 3** | Tirs, projectiles, **S&D** (bombe, économie), scoreboard |
| **Jalon 4** | Tiled, presets, polish UX, **Docker / Render**, stabilisation, stress test LAN |

_Pied de page : Présentateur : **Prénom NOM**_

**Visuels** : *non*.

**Schémas** : **recommandé** — **frise** ou chemin **J1 → J2 → J3 → J4** (dates optionnelles si vous les ajoutez).

---

### Slide 9 — Problèmes **techniques** rencontrés

- **Build / prod** : chemins **assets** (`maps/` vs image Docker / Render) ; dépendances front (ex. polices) bloquant **Vite**.  
- **Gameplay** : spawns sur obstacles ; **axes joystick** ; **économie** : prix / plafonds **alignés serveur** (pas seulement le mobile).  
- **Réseau / perf** : **free tier** (cold start Render, charge) ; logs si **surcharge** de la boucle 60 TPS ; **Phaser** : éviter accumulation d’objets graphiques (**destroy / clear**).  
- **Mitigation** : `npm run build` avant push, `npm test`, documentation `docs/`, audit.

_Pied de page : Présentateur : **Prénom NOM**_

**Visuels** : *optionnel* — petite **`IngameAscension.png`** en coin si la slide reste lisible.

**Schémas** : *optionnel* — une ligne **problème → cause → solution** pour **un** exemple (ex. chemins `maps/` en Docker).

---

### Slide 10 — Problèmes **humains** & organisation

- **Coordination** : branches, intégration sur `main`, déploiement **Render**.  
- **Arbitrage du temps** : **gameplay** vs **UI** vs **maps**.  
- **Solutions** : messages de commit clairs, **pair programming** sur zones sensibles (socket + display), checklist **build + test + démo** avant merge.

_Pied de page : Présentateur : **Prénom NOM**_

**Visuels** : *non*.

**Schémas** : *non* (ou picto minimal Git / `main` si besoin de visuel sans bruit).

---

## Bloc 3 — Introduction à la démo (**un transparent**)

---

### Slide 11 — Démo : ce que vous allez voir

**Démonstration Zero Strike**

- **Choix retenu pour la soutenance :** le jeu est **hébergé sur Render (plan gratuit)** ; la **démo se fera sur cette instance** — URL type **`https://<votre-service>.onrender.com`** : grand écran sur **`…/display`**, manettes sur **`…/mobile`**, hub **`…/`** (HTTPS). **Réveiller** le service une fois avant l’oral (**cold start** du free tier).  
- **Matériel salle :** vidéoprojecteur sur le navigateur **display** ; téléphones sur le **même URL** (Wi‑Fi / données selon la salle).  
- **Plan B (secours) :** PC local `npm start` + `http://<IP_LAN>:3000/...` si Render ou le réseau bloque.  
- **Déroulé annoncé :** connexion → vote carte → **buy** → **action** (tir, HUD, bombe si S&D) → fin de manche.  
- *Phrase de transition : « Nous lançons la partie maintenant. »*

_Pied de page : Présentateur : **Prénom NOM** (souvent le pilote machine)_

**Visuels** : **`ChoixMapMobile.png`** et/ou **`lobbyDisplay.png`** ; petite **`mobileFirstPage.png`** pour rappeler les deux clients sur la même URL.

**Schémas** : **recommandé** — **plan salle** : vidéoprojecteur = navigateur **display** ; téléphones = **mobile** ; flèche « même hôte » (URL Render ou IP LAN).

---

### Slide 12 (optionnelle) — Scénario démo pas à pas (aide-mémoire)

| Étape | Action |
|-------|--------|
| 1 | **Render (plan gratuit)** : hub `https://<service>.onrender.com/` ou **`/display`** (hôte) — ou plan B LAN |
| 2 | Chaque joueur : **`…/mobile`** (même hôte Render) |
| 3 | Vote map → lancement hôte |
| 4 | Achat + combat + bombe ou fin timer |

_Pied de page : Présentateur : **Prénom NOM**_

**Visuels** : *non* (aide-mémoire ; éviter de dupliquer les captures des slides 1–11).

**Schémas** : *non*.

---

## Annexe — Check-list veille de remise

- [ ] **Pied de page** : sur **chaque** slide, le **bon** prénom de la personne qui **présente** cette slide.  
- [ ] **Cohérence visuelle** : police, couleurs, cadres d’images respectent la charte ; **visuels / schémas** alignés avec les blocs **Visuels** / **Schémas** sous chaque slide (ci-dessus).  
- [ ] **Orthographe** relue (accents, S&D, Socket.io, **Chadigo**, **Dist2**, **jusqu’à**).  
- [ ] **Chronomètre** : ~2 min + ~2 min + intro démo ; pas **> 6 min d’écart** vs consigne enseignant.  
- [ ] **Pas de répétition** : chaque intervenant sait **quoi dire** sur ses slides uniquement.  
- [ ] **Render (plan gratuit)** : URL notée ; service **réveillé** avant l’oral ; **`/health`** OK ; affichage **display** + **mobiles** testés sur l’URL publique.  
- [ ] **Plan B** : `npm install` → `npm run build` → `npm start` sur un PC si la démo cloud échoue ; **Wi‑Fi** ; batterie téléphones ; **un** onglet hôte **display**.  
- [ ] Fichier **PDF ou PPTX** déposé plateforme avant **23:59** le 15/04/2026.

---

## Annexe — Commandes & URLs démo

### Démo prévue — **Render (plan gratuit)**

Remplacer `<service>` par le nom réel du Web Service (dashboard Render après déploiement depuis `render.yaml`).

- Hub : `https://<service>.onrender.com/`  
- Display : `https://<service>.onrender.com/display`  
- Mobile : `https://<service>.onrender.com/mobile`  
- Santé : `https://<service>.onrender.com/health`  

### Plan B — **local (LAN)**

```bash
cd ZeroStrike
npm install
npm run build
npm start
```

- Hub : `http://localhost:3000/` · Display : `.../display` · Mobile : `.../mobile` · Santé : `.../health`  
- Sur LAN : remplacer `localhost` par **`http://<IP_PC>:3000/...`** pour les téléphones.

---

## Oral — ce que la grille pénalise (à éviter)

- Ton **trop familier**, « on », improvisé sans structure.  
- **Répéter** deux fois la même explication (ex. 60 TPS sur trois slides d’affilée).  
- **Sur-technique** sans phrase de liaison pour le jury non dev : toujours **une phrase « donc pour le joueur… »** après un terme technique.  
- **Trop de texte** sur une slide : si tout est écrit, le jury lit au lieu de vous écouter — **alléger** et **parler**.

---

*Document aligné sur le dépôt Zero Strike et sur les modalités de remise / grille d’évaluation décrites par l’enseignant. Mettre à jour les **Prénom NOM** des pieds de page avant export PPTX.*
