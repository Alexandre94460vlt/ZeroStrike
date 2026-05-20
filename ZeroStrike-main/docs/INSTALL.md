# Zero Strike — Manuel d'installation

## Prérequis

- **Node.js** : version **20** ou supérieure ([nodejs.org](https://nodejs.org)) — aligné sur `engines` dans `package.json`
- **npm** : fourni avec Node.js (v9+)
- **Optionnel — Docker** : pour lancer sans installer Node ([docker.com](https://www.docker.com))

---

## Installation (sans Docker)

### 1. Récupérer le code source

- Cloner le dépôt ou extraire l’archive du livrable.
- Ouvrir un terminal dans le dossier du projet (racine, où se trouve `package.json`).

### 2. Installer les dépendances

```bash
npm install
```

### 3. Construire les clients

Les clients Display (Phaser) et Mobile doivent être compilés avant de lancer le serveur :

```bash
npm run build
```

Cela génère :
- `client-display/dist/` (affichage grand écran)
- `client-mobile/dist/` (interface manette smartphone)

### 4. Démarrer le serveur

```bash
npm start
```

Le serveur écoute par défaut sur le port **3000** et l’adresse **0.0.0.0** (accessible depuis le réseau local).

### 5. Accéder au jeu

**Une seule adresse à retenir** sur le réseau local : **`http://IP_DU_PC:3000/`** (page d’accueil).  
Tu y choisis **Grand écran** ou **Manette** — plus besoin de mémoriser deux chemins différents.

- **Accueil (choix du rôle)** : [http://localhost:3000/](http://localhost:3000/) (ou `http://IP_DU_PC:3000/` depuis un autre appareil).

- **Liens directs** (équivalent) :  
  - Affichage : [http://localhost:3000/display](http://localhost:3000/display)  
  - Manette : **http://IP_DU_PC:3000/mobile**

**QR code (lobby sur le grand écran)** : il pointe vers **l’accueil** (`…/`) — après scan, choisir **Manette**. Pour un lien direct sans passer par le hub, saisir **http://IP_DU_PC:3000/mobile** (voir liens directs ci-dessus).

Pour connaître l’IP du PC :
- **Windows** : `ipconfig` (adresse IPv4 de la carte Wi‑Fi)
- **macOS / Linux** : `ip addr` ou `ifconfig`

---

## Installation avec Docker

Si Docker et Docker Compose sont installés :

```bash
docker-compose up --build
```

Au premier lancement, l’image est construite puis le serveur démarre. Les clients sont buildés dans l’image.  
Accès : **http://localhost:3000/** (hub) puis **Grand écran** ou **Manette**, ou liens directs **/display** et **/mobile**.

---

## Variables d’environnement (optionnel)

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3000` | Port HTTP et WebSocket |
| `HOST` | `0.0.0.0` | Adresse d’écoute du serveur |
| `DB_PATH` | `data/leaderboard.db` | Fichier SQLite (classement via **sql.js**). Valeur `:memory:` = pas de fichier disque. |
| `ALLOWED_ORIGINS` | (voir serveur) | Origines CORS Socket.io (séparées par des virgules), important en production. |
| `GIPHY_API_KEY` | — | Optionnel : GIFs du kill feed sur le display ([Giphy](https://developers.giphy.com/)). |

Exemple :

```bash
PORT=8080 npm start
```

Le classement est stocké en **SQLite** localement ; ce n’est **pas** MongoDB. Détails et déploiement : [README.md](README.md) (sections *Classement* et *Déploiement sur Render*).

---

## Dépannage

### Le port 3000 est déjà utilisé

- Fermer l’application qui utilise le port, ou
- Changer de port : `PORT=3001 npm start` puis utiliser `http://...:3001/display` et `...:3001/mobile`.

### Le smartphone ne se connecte pas

- Vérifier que le téléphone est sur le **même réseau Wi‑Fi** que le PC.
- Utiliser l’**IP locale** du PC (pas `localhost`) dans l’URL mobile.
- Vérifier qu’aucun pare-feu Windows/Mac ne bloque le port 3000 (entrant).

### La page Display ou Mobile ne s’affiche pas correctement

- S’assurer d’avoir bien exécuté `npm run build` avant `npm start`.
- En développement, si vous utilisez Vite (`npm run dev:display`), l’affichage est sur le port du serveur Vite ; pour un déploiement type livrable, utiliser `npm start` et accéder via le port 3000.

### Erreur « Cannot find module » au démarrage

- Exécuter à nouveau `npm install` à la racine du projet.
- Ne pas supprimer le dossier `node_modules`.

---

## Contenu du livrable (exécutable)

Pour fournir une version “exécutable” sans avoir à cloner le dépôt :

1. Copier tout le projet **sans** le dossier `node_modules`.
2. Inclure les dossiers **buildés** : `client-display/dist` et `client-mobile/dist` (générés par `npm run build`), ou indiquer dans le manuel qu’il faut lancer `npm run build` une fois après `npm install`.
3. L’utilisateur devra avoir Node.js installé, puis exécuter :  
   `npm install` → `npm run build` (si les dist/ ne sont pas fournis) → `npm start`.

Ou fournir les fichiers Docker et la commande `docker-compose up --build` pour un lancement sans Node sur la machine cible (Docker requis).
