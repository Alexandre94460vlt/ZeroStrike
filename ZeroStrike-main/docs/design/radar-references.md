# Références radar (optionnel)

Fichiers image : **`assets/references/radars/`** (non servis par le serveur — usage local / moodboard).

Place-y des captures **vue du dessus** des maps officielles pour caler les itérations de grille :

| Fichier suggéré | Carte ZeroStrike | Référence |
|-----------------|------------------|-----------|
| `haven.png` | Maven | Haven (Valorant) |
| `dust2.png` | Dist2 | Dust II (CS:GO) |
| `vertigo.png` | Chadigo | Vertigo (CS:GO) |
| `ascent.png` | Ascension | Ascent (Valorant) |

Les grilles logiques (`server/models/*GridBuilder.js`) sont conçues pour **évoquer** ces radars sur une grille **80×45** ; ce dossier sert de **moodboard** pour les prochains ajustements.

**Packs Kenney par carte (visuel cible)** — chemins disque sous `vendor/kenney/` :

- Maven → `vendor/kenney/kenney_top-down-shooter/`
- Dist2 → `vendor/kenney/kenney_tower-defense-top-down/`
- Chadigo → `vendor/kenney/kenney_rpg-urban-pack/` (si présent dans le dépôt)
- Ascension → `vendor/kenney/kenney_scribble-dungeons/`

Le client display charge les tuiles **scribble-dungeons** via **`/tiles/*`** (fichiers du pack ci-dessus). Un branchement **par `mapId`** pour d’autres packs reste optionnel.
