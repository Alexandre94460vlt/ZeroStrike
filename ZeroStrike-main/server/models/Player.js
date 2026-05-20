import { getWeapon, DEFAULT_WEAPON_ID } from './Weapon.js';
import { PLAYER_MAX_HEALTH, PLAYER_HITBOX_RADIUS } from '../config/constants.js';

/**
 * Modèle domaine : Joueur
 * Données et état d'un joueur connecté (équipe, position, vie, munitions, arme)
 */
export class Player {
  constructor(id, name, team = 'DEF') {
    this.id = id;
    this.name = name || `Player_${id.slice(0, 6)}`;
    /** 'LOBBY' = en attente d’assignation ; 'ATT' | 'DEF' en partie */
    this.team = team;
    /** Identifiant de session stable entre reconnexions (attribué par GameService) */
    this.sessionId = null;
    this.x = 0;
    this.y = 0;
    this.rot = 0; // Angle de visée en radians
    this.vx = 0;
    this.vy = 0;
    this.baseSpeed = 200;
    this.speed = this.baseSpeed;
    this.radius = PLAYER_HITBOX_RADIUS;
    this.health = PLAYER_MAX_HEALTH;
    this.maxHealth = PLAYER_MAX_HEALTH;
    this.isDead = false;
    this.money = 0;
    this.currentWeapon = DEFAULT_WEAPON_ID;
    const w = getWeapon(this.currentWeapon);
    this.ammo = w.magSize;
    this.ammoReserve = w.reserveMax;
    this.lastShotAt = 0; // anti-spam / cadence (ms)
    /** Accumulation de dispersion « rafale » (rad), décroît avec le temps en phase d’action */
    this.sprayAccumRad = 0;
    this.lastInputMove = { angle: 0, force: 0 };
    this.lastInputTime = 0;
    /** Stats du round en cours — reset à chaque début de round */
    this.roundKills  = 0;
    this.roundDeaths = 0;
    /** Power-ups actifs */
    this.speedBoostUntil = 0;
    this.tojiBurstUntil = 0;
    this.ichigoBankaiUntil = 0;
    this.damageBoostUntil = 0;
    this.shieldUntil = 0;
    this.shieldHealth = 0;
    this.multishotUntil = 0;
    this.ricochetUntil = 0;
    this.ghostUntil = 0;
    this.magnetUntil = 0;
    /** Héros actuellement incarné (Battlefront-style) */
    this.heroId = null;
    this.heroPowerUsed  = false; // pouvoir A utilisé ce round
    this.heroPowerBUsed = false; // pouvoir B utilisé ce round

    /** Avatar (optionnel) — data URL validée côté serveur (petite taille). */
    this.avatar = null;

    /** États de contrôle altérés */
    this.frozenUntil   = 0; // gelé (ne peut ni bouger ni tirer)
    this.stunUntil     = 0; // stun (ne peut pas bouger)
    this.silencedUntil = 0; // silence (ne peut pas tirer)
    this.reversedUntil = 0; // contrôles inversés
    this.invincibleUntil = 0; // invincible (pas de dégâts)

    /** Luffy Gear 5 — rayon élargi */
    this.giantUntil  = 0;
    this.baseRadius  = PLAYER_HITBOX_RADIUS;

    /** Domaines actifs : id domaine → 'in' | 'out' (figé à la création du domaine). */
    this.domainSides = {};
  }

  get color() {
    return this.team === 'DEF' ? 0x00FFFF : 0xFF4500; // Cyan / Orange
  }
}
