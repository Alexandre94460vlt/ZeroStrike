/**
 * @fileoverview PlayerService — joueurs en mémoire (Map `socketId` → `Player`) et déplacement.
 * @see {@link Player} Modèle joueur ; cache interne pour `getAll()` (invalidé sur add/remove).
 */
/**
 * PlayerService — Gestion CRUD des joueurs + physique de déplacement.
 *
 * Responsabilités :
 *   - Ajout / suppression de joueurs (Map socketId → Player)
 *   - Mise à jour des inputs de mouvement (angle, force)
 *   - Résolution des collisions AABB joueur ↔ murs (axes X/Y séparés)
 *   - Requêtes de liste (getAll, getAliveByTeam)
 */
import { aabbCollision } from '../utils/physics.js';
import { Player } from '../models/Player.js';

export class PlayerService {
  constructor() {
    this.players = new Map(); // socketId -> Player
    this.maxPlayers = 40;
    // Cache de Array.from(players.values()) — invalidé uniquement sur add/remove.
    // Évite ~1200 allocations/seconde à 60 TPS avec getAll() appelé 20× par tick.
    this._cache = [];
    this._cacheDirty = true;
  }

  add(socketId, name, team) {
    if (this.players.size >= this.maxPlayers) return null;
    const player = new Player(socketId, name, team);
    this.players.set(socketId, player);
    this._cacheDirty = true;
    return player;
  }

  remove(socketId) {
    const deleted = this.players.delete(socketId);
    if (deleted) this._cacheDirty = true;
    return deleted;
  }

  get(socketId) {
    return this.players.get(socketId);
  }

  updateInputMove(socketId, { angle, force }) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;
    player.lastInputMove = { angle, force };
    player.lastInputTime = Date.now();
    const magnitude = force * player.speed;
    player.vx = Math.cos(angle) * magnitude;
    player.vy = Math.sin(angle) * magnitude;
  }

  updatePosition(player, dt, walls) {
    if (player.isDead || (player.vx === 0 && player.vy === 0)) return;

    const newX = player.x + player.vx * dt;
    const newY = player.y + player.vy * dt;
    const r = player.radius;

    if (!walls?.length) {
      player.x = newX;
      player.y = newY;
      return;
    }

    /** Hitbox centrée sur (cx, cy) chevauche au moins un mur. */
    const overlapsWalls = (cx, cy) => {
      const box = { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
      for (const wall of walls) {
        if (aabbCollision(box, wall)) return true;
      }
      return false;
    };

    // 1) Destination diagonale si libre
    if (!overlapsWalls(newX, newY)) {
      player.x = newX;
      player.y = newY;
      return;
    }

    // 2) Sinon glissades sur un axe (comportement historique)
    const canSlideX = !overlapsWalls(newX, player.y);
    const canSlideY = !overlapsWalls(player.x, newY);

    // 3) Anti-coin : les deux axes séparés peuvent passer alors que la diagonale est dans le mur
    if (canSlideX && canSlideY) {
      if (Math.abs(player.vx) >= Math.abs(player.vy)) {
        player.x = newX;
      } else {
        player.y = newY;
      }
      return;
    }
    if (canSlideX) {
      player.x = newX;
      return;
    }
    if (canSlideY) {
      player.y = newY;
    }
  }

  /**
   * Retourne le tableau des joueurs. Le même tableau est réutilisé tant que
   * add/remove n'ont pas été appelés — les appelants ne doivent PAS le muter.
   */
  getAll() {
    if (this._cacheDirty) {
      this._cache = Array.from(this.players.values());
      this._cacheDirty = false;
    }
    return this._cache;
  }

  getAliveByTeam(team) {
    const result = [];
    for (const p of this.players.values()) {
      if (p.team === team && !p.isDead) result.push(p);
    }
    return result;
  }
}
