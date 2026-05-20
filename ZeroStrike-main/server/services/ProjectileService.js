/**
 * @fileoverview ProjectileService — projectiles en vol (création, tick, collisions murs/joueurs).
 * @see {@link Projectile} Limite carte 1920×1080 ; `tick` mutile la liste (hors map / impact).
 */
/**
 * Service : gestion des projectiles (création, trajectoire, collisions)
 * Utilise le modèle Projectile et la physique (utils). Support multi-plombs (SHOTGUN).
 */
import { circleCollision, segmentRectCollision } from '../utils/physics.js';
import { Projectile } from '../models/Projectile.js';

const PELLET_SPREAD_RAD = 0.12; // écart angulaire max par plomb (rad)
const MAP_W = 1920;
const MAP_H = 1080;

export class ProjectileService {
  constructor(playerService) {
    this.projectiles = [];
    this.playerService = playerService;
    this.nextId = 0;
  }

  /**
   * @param {number} [moveSpreadRad] — dispersion aléatoire ± (style run-and-gun), appliquée avant la gerbe shotgun
   */
  create(ownerId, x, y, angle, team, weapon, moveSpreadRad = 0) {
    const pellets = weapon.pellets ?? 1;
    const weaponName = weapon.name || weapon.id || 'Rifle';
    const weaponId = weapon.id || 'RIFLE';
    const baseAngle = angle + (Math.random() * 2 - 1) * moveSpreadRad;
    const list = [];
    for (let i = 0; i < pellets; i++) {
      const spread = pellets > 1 ? (Math.random() * 2 - 1) * PELLET_SPREAD_RAD : 0;
      const id = `proj_${this.nextId++}`;
      const speed = weapon.speed ?? weapon.projectileSpeed ?? 800;
      const proj = new Projectile(
        id, ownerId, x, y, baseAngle + spread, team,
        weapon.damage, speed, weapon.projectileRadius, weaponName, weaponId
      );
      this.projectiles.push(proj);
      list.push(proj);
    }
    return list;
  }

  tick(dt, walls, onHit, onSound) {
    const toRemove = new Set();
    const now = Date.now();

    // Capture players une seule fois pour tout le tick
    const players = this.playerService.getAll();

    for (const proj of this.projectiles) {
      const dx = Math.cos(proj.angle) * proj.speed * dt;
      const dy = Math.sin(proj.angle) * proj.speed * dt;
      const newX = proj.x + dx;
      const newY = proj.y + dy;

      // Hors limites de la map → supprimer silencieusement
      if (newX < 0 || newX > MAP_W || newY < 0 || newY > MAP_H) {
        toRemove.add(proj);
        continue;
      }

      // Collision murs
      for (const wall of walls) {
        if (segmentRectCollision(proj.x, proj.y, newX, newY, wall)) {
          toRemove.add(proj);
          if (onSound) onSound('impact', proj.x, proj.y);
          break;
        }
      }
      if (toRemove.has(proj)) continue;

      // Collision joueurs
      for (const player of players) {
        if (player.id === proj.ownerId || player.isDead || player.team === proj.team) continue;
        // Ghost : le joueur est intangible aux projectiles adverses
        if (player.ghostUntil && player.ghostUntil > now) continue;
        if (circleCollision({ x: newX, y: newY, radius: proj.radius }, { x: player.x, y: player.y, radius: player.radius })) {
          toRemove.add(proj);
          if (onHit) onHit(player, proj.damage, proj.ownerId, proj.weaponName || 'Rifle');
          break;
        }
      }
      if (toRemove.has(proj)) continue;

      proj.x = newX;
      proj.y = newY;
    }

    if (toRemove.size > 0) {
      this.projectiles = this.projectiles.filter(p => !toRemove.has(p));
    }
  }

  getAll() {
    return [...this.projectiles];
  }

  clear() {
    this.projectiles = [];
  }
}
