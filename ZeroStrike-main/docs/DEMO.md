# Zero Strike — Scénario de démo (soutenance)

Objectif : dérouler une partie **sans friction** (connexion, lobby, lancement, fin, classement) en ~3–5 minutes.

---

## Matériel / setup recommandé

- 1 PC (**serveur + display**) relié au vidéoprojecteur / écran.
- 2 smartphones (minimum) sur le **même Wi‑Fi** que le PC.
- Connaître l’IP du PC : sous Windows `ipconfig` → IPv4 Wi‑Fi.

---

## Pré-démarrage (à faire avant d’entrer dans la salle)

1. Ouvrir un terminal à la racine.
2. Lancer :

```bash
npm install
npm run build
npm start
```

3. Vérifier la page d’accueil sur le PC : `http://localhost:3000/`
4. Vérifier depuis un téléphone : `http://IP_DU_PC:3000/`

---

## Démo “standard” (le plus simple)

### 1) Connexion & lobby

1. Sur le PC (projecteur) : ouvrir `http://localhost:3000/` → choisir **Grand écran**.
2. Depuis chaque téléphone : ouvrir `http://IP_DU_PC:3000/` → choisir **Manette**.
3. Dans le lobby, faire rejoindre les joueurs et les passer en **Prêt**.

### 2) Paramètres rapides

- Choisir un preset simple (**DEMO BUT** si disponible, sinon **FUN**).
- Lancer une partie courte (mode par défaut ou Deathmatch si vous voulez une fin rapide).

### 3) Lancement et “moment gameplay”

Objectif : montrer en 30–60s :
- déplacements/tir, feedbacks visuels/sons côté display
- un kill (kill feed / effets)
- une mécanique de mode (ex. objectif / bombe si S&D)

### 4) Fin de partie & classement

- Finir la manche / atteindre la limite (en Deathmatch, c’est généralement le plus rapide).
- Afficher le classement (leaderboard) / écran de fin si présent.

---

## Plan B (si Wi‑Fi instable)

- Relancer le serveur : Ctrl+C puis `npm start`.
- Forcer un autre port : `PORT=3001 npm start` puis utiliser `http://IP_DU_PC:3001/`.
- Si un téléphone n’accède pas au hub, vérifier pare-feu Windows (port entrant 3000/3001).

