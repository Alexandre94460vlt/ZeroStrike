# ─────────────────────────────────────────────────────────────────────────────
# Étape 1 : BUILD — installe TOUTES les dépendances (dev + prod) et compile
# les clients Vite (client-display/dist, client-mobile/dist).
# Cette image intermédiaire n'est jamais publiée.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Étape 2 : PRODUCTION — image finale sans devDependencies ni code source brut.
# Contient uniquement : serveur Node, dist/ des clients, assets statiques.
# Gain estimé : ~150 MB (Phaser + Vite + Sharp éliminés).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Dépendances de production uniquement
COPY package*.json ./
RUN npm ci --omit=dev

# Artefacts de build des clients
COPY --from=builder /app/client-display/dist ./client-display/dist
COPY --from=builder /app/client-mobile/dist  ./client-mobile/dist

# Serveur, modules partagés (importés par le serveur), assets statiques
COPY server ./server
COPY --from=builder /app/shared ./shared
COPY public ./public
# Assets cartes (radars/preview) servis sous /map depuis server/index.js
COPY assets ./assets
# Cartes Tiled servies sous /maps
COPY maps ./maps
# Assets Kenney servis sous /Kenney
COPY vendor ./vendor

EXPOSE 3000

CMD ["node", "server/index.js"]
