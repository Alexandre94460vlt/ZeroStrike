/**
 * Constantes de jeu — toutes les valeurs numériques clés en un seul endroit.
 *
 * Modifier ici pour tuner le gameplay sans toucher à la logique.
 * Note : certaines valeurs sont surchargées par `gameService.settings`
 *        quand le host modifie les paramètres via l'écran de lobby.
 *
 * Spawns : définis par la carte dans server/models/maps/Map.js (spawnCT / spawnT).
 */

// ── Durées de phase (secondes) ───────────────────────────────────────────────
/** Compte à rebours affiché côté display pour le vote de carte en lobby (cosmétique) */
/** Délai max. affichage du vote carte (lobby) avant que l’hôte lance — même ordre de grandeur que le timer display. */
export const MAP_LOBBY_VOTE_DISPLAY_SEC = 100;

/**
 * Secondes affichées (N…0) après « Lancer la partie » sur le grand écran :
 * tirage des équipes puis compte à rebours avant le choix de carte.
 */
export const LOBBY_PRESTART_COUNTDOWN_SEC = 10;

/** Phase de combat : rythme légèrement plus serré qu’un FPS AAA pour garder la tension en LAN */
export const ROUND_DURATION      = 105;
export const BUY_PHASE_DURATION  = 14;  // Moins d’attente morte avant l’action
export const ROUND_END_DURATION  = 5;   // Pause entre deux rounds
export const BOMB_TIMER          = 38;  // CT un peu plus pénalisés s’ils retardent le retake

// ── Bombe (SND) ───────────────────────────────────────────────────────────────
/** Temps de pose (ms) — évite le plant instantané, crée une fenêtre de contestation. */
export const BOMB_PLANT_DURATION_MS = 3000;
/** Temps de désamorçage (ms) — plus long que la pose pour favoriser la défense de zone. */
export const BOMB_DEFUSE_DURATION_MS = 4500;

// ── Géométrie ────────────────────────────────────────────────────────────────
/** Rayon un peu plus large : défuse moins frustrant sur manette / grand écran */
export const DEFUSE_RADIUS = 118;

// ── Power-ups (bonus) ─────────────────────────────────────────────────────────
/** Intervalle entre spawns (sec). */
export const POWERUP_SPAWN_INTERVAL_SEC = 18;
/** Nombre max simultané sur la carte. */
export const POWERUP_MAX_SIMULTANEOUS = 4;
/** Durée de vie sur la carte (sec) avant despawn si non ramassé. */
export const POWERUP_MAP_LIFE_SEC = 45;
/** Durée des effets (sec). */
export const POWERUP_EFFECT_DURATION_SEC = 18;

// ── Argent — récompense un peu mieux les frags et les rounds gagnés (économie plus lisible) ──
export const MONEY_WIN  = 3100;
export const MONEY_LOSS = 1400;
export const MONEY_KILL = 325;

/** DM : premier équipe à N kills remporte la manche (0 = désactivé, fin uniquement au timer) */
export const DM_KILL_LIMIT_DEFAULT = 30;

/** Bonus $ selon les manches perdues d’affilée (index = streak 0..5) — style CS loss bonus */
export const LOSS_STREAK_BONUS = [0, 500, 1000, 1500, 2000, 2400];

/** Argent bonus pour tous à l’entrée en prolongation (score à égalité au « match point ») */
export const OVERTIME_BONUS_MONEY = 2000;

// ── Précision : dispersion supplémentaire si tir en mouvement (rad max à vitesse pleine) ──
export const MOVE_INACCURACY_MAX_RAD = 0.1;
/** Sniper : pénalité mobilité plus forte (style CS AWP) */
export const MOVE_INACCURACY_SNIPER_MULT = 1.4;

/** Rafale (spray) : accumulation angulaire par coup — multipliée par le profil (Fun / Compète / …) */
export const SPRAY_PER_SHOT_RAD_BASE = 0.017;
/** Plafond de spray (rad) avant tuning preset */
export const SPRAY_MAX_RAD_BASE = 0.092;
/** Récupération de précision : rad/s en phase d’action (hors cadence de tir) */
export const SPRAY_DECAY_PER_SEC_BASE = 0.44;

// ── Victoire ─────────────────────────────────────────────────────────────────
export const ROUNDS_TO_WIN = 3; // Premier à ROUNDS_TO_WIN manches remporte le match

// ── Santé ────────────────────────────────────────────────────────────────────
export const PLAYER_MAX_HEALTH = 100;

/** Rayon hitbox joueur (murs, balles, domaines). < 12 px pour passer dans un couloir d’1 case (24 px). */
export const PLAYER_HITBOX_RADIUS = 11;

/**
 * Distance centre-centre minimale visée entre deux joueurs au spawn (sélection parmi les points
 * `spawnCTPoints` / `spawnTPoints`). Si aucun couple de tuiles ne l’atteint, on prend le meilleur effort.
 */
export const SPAWN_PLAYER_MIN_SEPARATION = Math.max(40, Math.ceil(PLAYER_HITBOX_RADIUS * 3.5));

// ── Pouvoirs de héros ────────────────────────────────────────────────────────

// Gojo A — Domaine (disque + barrière) : gel uniquement des ennemis dans le disque
export const GOJO_FREEZE_DURATION_MS  = 4000;
/** Rayon du domaine Gojo (mur + overlay display), aligné ordre de grandeur Yuta / Sukuna. */
export const GOJO_DOMAIN_RADIUS         = 200;
// Gojo B — Violet Creux (orbe one-shot)
export const GOJO_VIOLET_DAMAGE       = 999;
export const GOJO_VIOLET_RADIUS       = 40;
export const GOJO_VIOLET_SPEED        = 650;

// Sukuna A — Autel Démoniaque (zone DoT)
export const SUKUNA_ZONE_RADIUS       = 220;
export const SUKUNA_ZONE_DURATION_SEC = 10;
export const SUKUNA_ZONE_DPS          = 40;
// Sukuna B — Dismantle (projectiles en éventail)
export const SUKUNA_DISMANTLE_COUNT   = 5;
export const SUKUNA_DISMANTLE_DAMAGE  = 55;
export const SUKUNA_DISMANTLE_SPEED   = 720;
export const SUKUNA_DISMANTLE_SPREAD  = 0.6;

// Toji — Vitesse Céleste (passif)
export const TOJI_SPEED_MULT          = 2.0;
// Toji A — Restriction Céleste (burst de vitesse)
export const TOJI_BURST_DURATION_MS   = 2500;
export const TOJI_BURST_SPEED_MULT    = 2.5;
// Toji B — Nuage Enjoué (projectile)
export const TOJI_WEAPON_DAMAGE       = 70;
export const TOJI_WEAPON_SPEED        = 580;
export const TOJI_WEAPON_RADIUS       = 28;

// Jotaro A — ORA Rush (dash + stun)
export const JOTARO_DASH_DIST         = 200;
export const JOTARO_STUN_RADIUS       = 70;
export const JOTARO_STUN_DURATION_MS  = 1500;
// Jotaro B — Za Warudo Local (gel local)
export const JOTARO_WARUDO_RADIUS     = 160;
export const JOTARO_WARUDO_DURATION_MS = 1500;

// Dio A — Za Warudo (gel global + couteaux)
export const DIO_WARUDO_DURATION_MS   = 2000;
export const DIO_KNIFE_COUNT          = 15;
// Dio B — Road Roller (AoE dégâts + stun)
export const DIO_ROADROLLER_RADIUS    = 180;
export const DIO_ROADROLLER_DAMAGE    = 90;
export const DIO_ROADROLLER_STUN_MS   = 1200;

// Naruto A — Multi-Clonage (2 clones IA)
export const NARUTO_CLONE_COUNT         = 2;
export const NARUTO_CLONE_SPEED         = 190;
export const NARUTO_CLONE_LIFETIME_SEC  = 15;
export const NARUTO_CLONE_EXPLODE_RADIUS = 50;
export const NARUTO_CLONE_EXPLODE_DAMAGE = 40;
// Naruto B — Rasengan (projectile lent knockback)
export const NARUTO_RASENGAN_DAMAGE     = 80;
export const NARUTO_RASENGAN_SPEED      = 180;
export const NARUTO_RASENGAN_RADIUS     = 35;

// Itachi A — Amaterasu (flammes sol persistantes)
export const ITACHI_FLAME_COUNT         = 3;
export const ITACHI_FLAME_RADIUS        = 55;
export const ITACHI_FLAME_DURATION_SEC  = 10;
export const ITACHI_FLAME_DPS           = 30;
// Itachi B — Tsukuyomi (contrôles inversés)
export const ITACHI_REVERSE_RADIUS      = 200;
export const ITACHI_REVERSE_DURATION_MS = 3000;

// Goku A — Kamehameha (laser perçant)
export const GOKU_LASER_DAMAGE          = 120;
export const GOKU_LASER_WIDTH           = 32;

// Yuta A — extension de domaine (zone DPS)
export const YUTA_ZONE_RADIUS            = 190;
export const YUTA_ZONE_DURATION_SEC     = 8;
export const YUTA_ZONE_DPS               = 30;
// Yuta B — Rika (familier : court vers l’ennemi le plus proche, explose au contact)
export const YUTA_FAMILIAR_SPEED         = 220;
export const YUTA_FAMILIAR_LIFETIME_SEC  = 12;
export const YUTA_FAMILIAR_EXPLODE_RADIUS = 52;
export const YUTA_FAMILIAR_EXPLODE_DAMAGE = 72;

// Ichigo A — Getsuga Tensho (projectile)
export const ICHIGO_GETSUGA_DAMAGE       = 90;
export const ICHIGO_GETSUGA_SPEED        = 680;
export const ICHIGO_GETSUGA_RADIUS       = 35;
// Ichigo B — Bankai (burst vitesse)
export const ICHIGO_BANKAI_DURATION_MS   = 3000;
export const ICHIGO_BANKAI_SPEED_MULT    = 2.2;
