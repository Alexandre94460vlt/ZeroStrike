/**
 * HeroService — Gestion des pouvoirs de héros (activation + ticks IA).
 *
 * Extrait de GameService pour réduire la taille du God Class.
 * Reçoit une référence au GameService (gs) pour accéder aux dépendances partagées.
 */
import { resolveMoveThroughWalls } from '../utils/physics.js';
import { assignPlayerDomainSide, clampPlayerAgainstDomainBarrier } from '../utils/domainBarrier.js';
import {
  GOJO_FREEZE_DURATION_MS, GOJO_DOMAIN_RADIUS, GOJO_VIOLET_DAMAGE, GOJO_VIOLET_RADIUS, GOJO_VIOLET_SPEED,
  SUKUNA_ZONE_RADIUS, SUKUNA_ZONE_DURATION_SEC, SUKUNA_ZONE_DPS,
  SUKUNA_DISMANTLE_COUNT, SUKUNA_DISMANTLE_DAMAGE, SUKUNA_DISMANTLE_SPEED, SUKUNA_DISMANTLE_SPREAD,
  TOJI_BURST_DURATION_MS, TOJI_WEAPON_DAMAGE, TOJI_WEAPON_SPEED, TOJI_WEAPON_RADIUS,
  JOTARO_DASH_DIST, JOTARO_STUN_RADIUS, JOTARO_STUN_DURATION_MS,
  JOTARO_WARUDO_RADIUS, JOTARO_WARUDO_DURATION_MS,
  DIO_WARUDO_DURATION_MS, DIO_KNIFE_COUNT,
  DIO_ROADROLLER_RADIUS, DIO_ROADROLLER_DAMAGE, DIO_ROADROLLER_STUN_MS,
  NARUTO_CLONE_COUNT, NARUTO_CLONE_SPEED, NARUTO_CLONE_LIFETIME_SEC,
  NARUTO_CLONE_EXPLODE_RADIUS, NARUTO_CLONE_EXPLODE_DAMAGE,
  NARUTO_RASENGAN_DAMAGE, NARUTO_RASENGAN_SPEED, NARUTO_RASENGAN_RADIUS,
  ITACHI_FLAME_COUNT, ITACHI_FLAME_RADIUS, ITACHI_FLAME_DURATION_SEC, ITACHI_FLAME_DPS,
  ITACHI_REVERSE_RADIUS, ITACHI_REVERSE_DURATION_MS,
  GOKU_LASER_DAMAGE, GOKU_LASER_WIDTH,
  YUTA_ZONE_RADIUS, YUTA_ZONE_DURATION_SEC, YUTA_ZONE_DPS,
  YUTA_FAMILIAR_SPEED, YUTA_FAMILIAR_LIFETIME_SEC,
  YUTA_FAMILIAR_EXPLODE_RADIUS, YUTA_FAMILIAR_EXPLODE_DAMAGE,
  ICHIGO_GETSUGA_DAMAGE, ICHIGO_GETSUGA_SPEED, ICHIGO_GETSUGA_RADIUS,
  ICHIGO_BANKAI_DURATION_MS,
  PLAYER_HITBOX_RADIUS,
} from '../config/constants.js';

export class HeroService {
  /** @param {import('./GameService.js').GameService} gs */
  constructor(gs) {
    this.gs = gs;
    this.heroZones       = []; // { id, ownerId, team, x, y, radius, expiresAt, type }
    /** Domaines avec barrière (Gojo / Yuta uniquement) : { id, ownerId, heroId, cx, cy, r, expiresAt } */
    this.activeDomains   = [];
    this.narutoClones    = []; // { id, x, y, ownerId, ownerTeam, spawnAt, health, exploded }
    this.yutaFamiliars   = []; // Rika : même logique de poursuite + explosion
    this._entityId       = 0;
  }

  /** Remet à zéro toutes les entités héros (fin de round, retour lobby). */
  reset() {
    this.heroZones      = [];
    this.activeDomains  = [];
    this.narutoClones   = [];
    this.yutaFamiliars  = [];
    for (const p of this.gs.playerService.getAll()) {
      p.domainSides = {};
    }
  }

  /**
   * Événements grand écran : GameService utilise displayNamespace ;
   * GameEngine (domaine) n’a pas de Socket.io — GameApp injecte emitDisplay → /display.
   */
  _emitDisplay(event, payload) {
    const ns = this.gs.displayNamespace;
    if (ns && typeof ns.emit === 'function') {
      ns.emit(event, payload);
      return;
    }
    if (typeof this.gs.emitDisplay === 'function') {
      this.gs.emitDisplay(event, payload);
    }
  }

  activateHeroPower(player, variant = 'A') {
    if (!player || player.isDead || !player.heroId) return;
    const now = Date.now();
    const enemyTeam = player.team === 'DEF' ? 'ATT' : 'DEF';
    const enemies = this.gs.playerService.getAliveByTeam(enemyTeam);

    if (variant === 'A' && player.heroPowerUsed)  return;
    if (variant === 'B' && player.heroPowerBUsed) return;

    switch (player.heroId) {

      case 'gojo': {
        if (variant === 'A') {
          player.heroPowerUsed = true;
          this._emitDisplay('hero_ability_display', { heroId: 'gojo', line1: '0.2', line2: 'UNLIMITED VOID', color: 0x4fc3f7 });
          const domId = `gojo_domain_${++this._entityId}`;
          const expiresAt = now + GOJO_FREEZE_DURATION_MS;
          this.activeDomains.push({
            id: domId,
            ownerId: player.id,
            heroId: 'gojo',
            cx: player.x,
            cy: player.y,
            r: GOJO_DOMAIN_RADIUS,
            expiresAt
          });
          this._registerDomainSides(domId, player.x, player.y, GOJO_DOMAIN_RADIUS);
          for (const e of enemies) {
            if (e.domainSides?.[domId] === 'in')
              e.frozenUntil = Math.max(e.frozenUntil, now + GOJO_FREEZE_DURATION_MS);
          }
          this._emitDisplay('sound_event', { type: 'powerup_collect', x: player.x, y: player.y });
        } else {
          player.heroPowerBUsed = true;
          this.gs.projectileService.create(player.id, player.x, player.y, player.rot, player.team, {
            damage: GOJO_VIOLET_DAMAGE, speed: GOJO_VIOLET_SPEED,
            projectileRadius: GOJO_VIOLET_RADIUS, pellets: 1, id: 'HERO_VIOLET', name: 'VioletCreux'
          });
          this._emitDisplay('hero_violet', { x: player.x, y: player.y, angle: player.rot });
          this._emitDisplay('sound_event', { type: 'explosion', x: player.x, y: player.y });
        }
        break;
      }

      case 'sukuna': {
        if (variant === 'A') {
          player.heroPowerUsed = true;
          this._emitDisplay('hero_ability_display', { heroId: 'sukuna', line1: 'MALEVOLENT', line2: 'SHRINE', color: 0xf06292 });
          const durationMs = SUKUNA_ZONE_DURATION_SEC * 1000;
          this.heroZones.push({
            id: `sukuna_${++this._entityId}`, ownerId: player.id, team: player.team,
            x: player.x, y: player.y, radius: SUKUNA_ZONE_RADIUS,
            expiresAt: now + durationMs, type: 'sukuna'
          });
          this._emitDisplay('hero_zone', { type: 'sukuna', x: player.x, y: player.y, radius: SUKUNA_ZONE_RADIUS, durationMs });
          this._emitDisplay('sound_event', { type: 'explosion', x: player.x, y: player.y });
        } else {
          player.heroPowerBUsed = true;
          const spread = SUKUNA_DISMANTLE_SPREAD;
          for (let i = 0; i < SUKUNA_DISMANTLE_COUNT; i++) {
            const t = SUKUNA_DISMANTLE_COUNT === 1 ? 0 : (i / (SUKUNA_DISMANTLE_COUNT - 1) - 0.5);
            this.gs.projectileService.create(player.id, player.x, player.y, player.rot + t * spread, player.team, {
              damage: SUKUNA_DISMANTLE_DAMAGE, speed: SUKUNA_DISMANTLE_SPEED,
              projectileRadius: 12, pellets: 1, id: 'HERO_DISMANTLE', name: 'Dismantle'
            });
          }
          this._emitDisplay('hero_dismantle', { x: player.x, y: player.y, angle: player.rot });
          this._emitDisplay('sound_event', { type: 'explosion', x: player.x, y: player.y });
        }
        break;
      }

      case 'yuta': {
        if (variant === 'A') {
          player.heroPowerUsed = true;
          this._emitDisplay('hero_ability_display', { heroId: 'yuta', line1: 'DOMAIN', line2: 'EXPANSION', color: 0x9e9e9e });
          const durationMs = YUTA_ZONE_DURATION_SEC * 1000;
          const zoneId = `yuta_${++this._entityId}`;
          this.heroZones.push({
            id: zoneId, ownerId: player.id, team: player.team,
            x: player.x, y: player.y, radius: YUTA_ZONE_RADIUS,
            expiresAt: now + durationMs, type: 'yuta_zone'
          });
          this.activeDomains.push({
            id: zoneId,
            ownerId: player.id,
            heroId: 'yuta',
            cx: player.x,
            cy: player.y,
            r: YUTA_ZONE_RADIUS,
            expiresAt: now + durationMs
          });
          this._registerDomainSides(zoneId, player.x, player.y, YUTA_ZONE_RADIUS);
          this._emitDisplay('hero_zone', { type: 'yuta_zone', x: player.x, y: player.y, radius: YUTA_ZONE_RADIUS, durationMs });
          this._emitDisplay('sound_event', { type: 'explosion', x: player.x, y: player.y });
        } else {
          player.heroPowerBUsed = true;
          this._emitDisplay('hero_ability_display', { heroId: 'yuta', line1: 'RIKA', line2: '', color: 0xbdbdbd });
          this.yutaFamiliars.push({
            id: `rika_${++this._entityId}`,
            x: player.x,
            y: player.y,
            ownerId: player.id,
            ownerTeam: player.team,
            spawnAt: now,
            health: 80,
            exploded: false
          });
          this._emitDisplay('hero_yuta_familiar_spawn', { x: player.x, y: player.y, ownerTeam: player.team });
          this._emitDisplay('sound_event', { type: 'powerup_collect', x: player.x, y: player.y });
        }
        break;
      }

      case 'ichigo': {
        if (variant === 'A') {
          player.heroPowerUsed = true;
          this._emitDisplay('hero_ability_display', { heroId: 'ichigo', line1: 'BANKAI', line2: '', color: 0x9c27b0 });
          player.ichigoBankaiUntil = now + ICHIGO_BANKAI_DURATION_MS;
          this._emitDisplay('hero_ichigo_bankai', { id: player.id, durationMs: ICHIGO_BANKAI_DURATION_MS, ownerTeam: player.team });
        } else {
          player.heroPowerBUsed = true;
          this.gs.projectileService.create(player.id, player.x, player.y, player.rot, player.team, {
            damage: ICHIGO_GETSUGA_DAMAGE, speed: ICHIGO_GETSUGA_SPEED,
            projectileRadius: ICHIGO_GETSUGA_RADIUS, pellets: 1, id: 'HERO_GETSUGA', name: 'GetsugaTensho'
          });
          this._emitDisplay('hero_ichigo_getsuga', { x: player.x, y: player.y, angle: player.rot });
          this._emitDisplay('sound_event', { type: 'explosion', x: player.x, y: player.y });
        }
        break;
      }

      case 'toji': {
        if (variant === 'A') {
          player.heroPowerUsed = true;
          this._emitDisplay('hero_ability_display', { heroId: 'toji', line1: 'RESTRICTION', line2: 'CÉLESTE', color: 0xa5d6a7 });
          player.tojiBurstUntil = now + TOJI_BURST_DURATION_MS;
          this._emitDisplay('hero_toji_burst', { id: player.id, durationMs: TOJI_BURST_DURATION_MS, ownerTeam: player.team });
        } else {
          player.heroPowerBUsed = true;
          this.gs.projectileService.create(player.id, player.x, player.y, player.rot, player.team, {
            damage: TOJI_WEAPON_DAMAGE, speed: TOJI_WEAPON_SPEED,
            projectileRadius: TOJI_WEAPON_RADIUS, pellets: 1, id: 'HERO_TOJI', name: 'PlayfulCloud'
          });
          this._emitDisplay('hero_toji_weapon', { x: player.x, y: player.y, angle: player.rot });
          this._emitDisplay('sound_event', { type: 'explosion', x: player.x, y: player.y });
        }
        break;
      }

      case 'jotaro': {
        if (variant === 'A') {
          player.heroPowerUsed = true;
          this._emitDisplay('hero_ability_display', { heroId: 'jotaro', line1: 'ZA WARUDO', line2: 'LOCAL', color: 0x90caf9 });
          for (const e of enemies) {
            if (Math.hypot(e.x - player.x, e.y - player.y) < JOTARO_WARUDO_RADIUS)
              e.frozenUntil = Math.max(e.frozenUntil, now + JOTARO_WARUDO_DURATION_MS);
          }
          this._emitDisplay('hero_warudo_local', { x: player.x, y: player.y, radius: JOTARO_WARUDO_RADIUS, durationMs: JOTARO_WARUDO_DURATION_MS });
        } else {
          player.heroPowerBUsed = true;
          const rawX = Math.max(0, Math.min(1920, player.x + Math.cos(player.rot) * JOTARO_DASH_DIST));
          const rawY = Math.max(0, Math.min(1080, player.y + Math.sin(player.rot) * JOTARO_DASH_DIST));
          const walls = this.gs.walls;
          const resolved = resolveMoveThroughWalls(player.x, player.y, rawX, rawY, player.radius, walls);
          player.x = resolved.x;
          player.y = resolved.y;
          for (const e of enemies) {
            if (Math.hypot(e.x - player.x, e.y - player.y) < JOTARO_STUN_RADIUS)
              e.stunUntil = Math.max(e.stunUntil, now + JOTARO_STUN_DURATION_MS);
          }
          this._emitDisplay('hero_dash', { x: player.x, y: player.y, ownerTeam: player.team });
        }
        break;
      }

      case 'dio': {
        if (variant === 'A') {
          player.heroPowerUsed = true;
          this._emitDisplay('hero_ability_display', { heroId: 'dio', line1: 'ZA WARUDO', line2: '', color: 0xffee58 });
          for (const e of enemies) e.frozenUntil = Math.max(e.frozenUntil, now + DIO_WARUDO_DURATION_MS);
          this._emitDisplay('hero_freeze', { durationMs: DIO_WARUDO_DURATION_MS, color: 0xffee58 });
          const arcSpread = (2 * Math.PI) / 3;
          for (let i = 0; i < DIO_KNIFE_COUNT; i++) {
            const t = DIO_KNIFE_COUNT === 1 ? 0 : (i / (DIO_KNIFE_COUNT - 1) - 0.5);
            this.gs.projectileService.create(player.id, player.x, player.y, player.rot + t * arcSpread, player.team, {
              damage: 40, speed: 700, projectileRadius: 8, pellets: 1, id: 'HERO_DIO_KNIFE', name: 'Couteau'
            });
          }
          this._emitDisplay('hero_dio_knives', { x: player.x, y: player.y, angle: player.rot });
        } else {
          player.heroPowerBUsed = true;
          for (const e of enemies) {
            if (Math.hypot(e.x - player.x, e.y - player.y) < DIO_ROADROLLER_RADIUS) {
              this.gs.onProjectileHit(e, DIO_ROADROLLER_DAMAGE, player.id, 'RoadRoller');
              e.stunUntil = Math.max(e.stunUntil, now + DIO_ROADROLLER_STUN_MS);
            }
          }
          this._emitDisplay('hero_roadroller', { x: player.x, y: player.y, radius: DIO_ROADROLLER_RADIUS });
          this._emitDisplay('sound_event', { type: 'explosion', x: player.x, y: player.y });
        }
        break;
      }

      case 'naruto': {
        if (variant === 'A') {
          player.heroPowerUsed = true;
          this._emitDisplay('hero_ability_display', { heroId: 'naruto', line1: 'MULTI', line2: 'CLONAGE', color: 0xffb74d });
          for (let i = 0; i < NARUTO_CLONE_COUNT; i++) {
            const t = NARUTO_CLONE_COUNT === 1 ? 0 : (i / (NARUTO_CLONE_COUNT - 1) - 0.5);
            const offAngle = player.rot + t * 1.0;
            this.narutoClones.push({
              id: `clone_${++this._entityId}`,
              x: player.x + Math.cos(offAngle) * 30,
              y: player.y + Math.sin(offAngle) * 30,
              ownerId: player.id, ownerTeam: player.team,
              spawnAt: now, health: 50, exploded: false
            });
          }
          this._emitDisplay('hero_clones_spawn', { x: player.x, y: player.y, count: NARUTO_CLONE_COUNT, ownerTeam: player.team });
        } else {
          player.heroPowerBUsed = true;
          this.gs.projectileService.create(player.id, player.x, player.y, player.rot, player.team, {
            damage: NARUTO_RASENGAN_DAMAGE, speed: NARUTO_RASENGAN_SPEED,
            projectileRadius: NARUTO_RASENGAN_RADIUS, pellets: 1, id: 'HERO_RASENGAN', name: 'Rasengan'
          });
          this._emitDisplay('hero_rasengan', { x: player.x, y: player.y, angle: player.rot });
        }
        break;
      }

      case 'itachi': {
        if (variant === 'A') {
          player.heroPowerUsed = true;
          this._emitDisplay('hero_ability_display', { heroId: 'itachi', line1: 'TSUKUYOMI', line2: '', color: 0xce93d8 });
          for (const e of enemies) {
            if (Math.hypot(e.x - player.x, e.y - player.y) < ITACHI_REVERSE_RADIUS)
              e.reversedUntil = Math.max(e.reversedUntil, now + ITACHI_REVERSE_DURATION_MS);
          }
          this._emitDisplay('hero_tsukuyomi', { x: player.x, y: player.y, radius: ITACHI_REVERSE_RADIUS, durationMs: ITACHI_REVERSE_DURATION_MS });
        } else {
          player.heroPowerBUsed = true;
          const durationMs = ITACHI_FLAME_DURATION_SEC * 1000;
          for (let i = 0; i < ITACHI_FLAME_COUNT; i++) {
            const dist = 80 + i * 120;
            this.heroZones.push({
              id: `flame_${++this._entityId}`, ownerId: player.id, team: player.team,
              x: player.x + Math.cos(player.rot) * dist,
              y: player.y + Math.sin(player.rot) * dist,
              radius: ITACHI_FLAME_RADIUS, expiresAt: now + durationMs, type: 'itachi_flame'
            });
          }
          this._emitDisplay('hero_flames', {
            x: player.x, y: player.y, angle: player.rot,
            count: ITACHI_FLAME_COUNT, radius: ITACHI_FLAME_RADIUS, durationMs
          });
        }
        break;
      }

      case 'goku': {
        if (variant === 'A') {
          player.heroPowerUsed = true;
          this._emitDisplay('hero_ability_display', { heroId: 'goku', line1: 'KAMEHAMEHA', line2: '', color: 0xff8a65 });
          const dir = { x: Math.cos(player.rot), y: Math.sin(player.rot) };
          for (const e of enemies) {
            const ex = e.x - player.x, ey = e.y - player.y;
            const proj = ex * dir.x + ey * dir.y;
            if (proj >= 0 && Math.abs(ex * dir.y - ey * dir.x) < GOKU_LASER_WIDTH)
              this.gs.onProjectileHit(e, GOKU_LASER_DAMAGE, player.id, 'Kamehameha');
          }
          this._emitDisplay('hero_laser', { x: player.x, y: player.y, angle: player.rot, width: GOKU_LASER_WIDTH, ownerTeam: player.team });
          this._emitDisplay('sound_event', { type: 'explosion', x: player.x, y: player.y });
        } else {
          player.heroPowerBUsed = true;
          let nearest = null, nearestDist = Infinity;
          for (const e of enemies) {
            const d = Math.hypot(e.x - player.x, e.y - player.y);
            if (d < nearestDist) { nearestDist = d; nearest = e; }
          }
          if (nearest) {
            const offsetAngle = Math.random() * Math.PI * 2;
            const tpX = Math.max(0, Math.min(1920, nearest.x + Math.cos(offsetAngle) * 50));
            const tpY = Math.max(0, Math.min(1080, nearest.y + Math.sin(offsetAngle) * 50));
            const walls = this.gs.walls;
            const resolved = resolveMoveThroughWalls(player.x, player.y, tpX, tpY, player.radius, walls);
            player.x = resolved.x;
            player.y = resolved.y;
          }
          this._emitDisplay('hero_teleport', { x: player.x, y: player.y, ownerTeam: player.team });
        }
        break;
      }

      default: break;
    }
  }

  /** Appelé à chaque tick — délègue aux sous-ticks. */
  tick(dt) {
    this._tickActiveDomains();
    this._tickZones(dt);
    this._tickNarutoClones(dt);
    this._tickYutaFamiliars(dt);
  }

  _registerDomainSides(domainId, cx, cy, R) {
    for (const p of this.gs.playerService.getAll()) {
      if (p.isDead) continue;
      if (!p.domainSides) p.domainSides = {};
      p.domainSides[domainId] = assignPlayerDomainSide(p.x, p.y, p.radius, cx, cy, R);
    }
  }

  _tickActiveDomains() {
    const now = Date.now();
    const removed = [];
    const keep = [];
    for (const d of this.activeDomains) {
      if (now >= d.expiresAt) removed.push(d.id);
      else keep.push(d);
    }
    this.activeDomains = keep;
    if (!removed.length) return;
    for (const p of this.gs.playerService.getAll()) {
      if (!p.domainSides) continue;
      for (const id of removed) delete p.domainSides[id];
    }
  }

  /**
   * Après déplacement : empêche de franchir le bord du domaine (règle in/out figée).
   * @param {import('../models/Player.js').Player} player
   */
  clampPlayerDomainBarriers(player) {
    if (player.isDead) return;
    const now = Date.now();
    const pr = player.radius || PLAYER_HITBOX_RADIUS;
    for (const dom of this.activeDomains) {
      if (now >= dom.expiresAt) continue;
      let side = player.domainSides?.[dom.id];
      if (side !== 'in' && side !== 'out') {
        side = assignPlayerDomainSide(player.x, player.y, pr, dom.cx, dom.cy, dom.r);
        if (!player.domainSides) player.domainSides = {};
        player.domainSides[dom.id] = side;
      }
      const { x, y } = clampPlayerAgainstDomainBarrier(
        player.x, player.y, pr, dom.cx, dom.cy, dom.r, side
      );
      player.x = x;
      player.y = y;
    }
  }

  _tickNarutoClones(dt) {
    if (!this.narutoClones.length) return;
    const now = Date.now();
    const toRemove = [];
    for (const clone of this.narutoClones) {
      if (now - clone.spawnAt > NARUTO_CLONE_LIFETIME_SEC * 1000 || clone.exploded) {
        toRemove.push(clone); continue;
      }
      const enemies = this.gs.playerService.getAliveByTeam(clone.ownerTeam === 'DEF' ? 'ATT' : 'DEF');
      let nearest = null, nearestDist = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(e.x - clone.x, e.y - clone.y);
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }
      if (nearest) {
        const dx = nearest.x - clone.x, dy = nearest.y - clone.y;
        const dist = Math.hypot(dx, dy) || 1;
        clone.x += (dx / dist) * Math.min(NARUTO_CLONE_SPEED * dt, dist);
        clone.y += (dy / dist) * Math.min(NARUTO_CLONE_SPEED * dt, dist);
        if (nearestDist < NARUTO_CLONE_EXPLODE_RADIUS) {
          clone.exploded = true;
          const owner = this.gs.playerService.get(clone.ownerId);
          if (owner) this.gs.onProjectileHit(nearest, NARUTO_CLONE_EXPLODE_DAMAGE, clone.ownerId, 'CloneExplosion');
          this._emitDisplay('sound_event', { type: 'explosion', x: clone.x, y: clone.y });
          toRemove.push(clone);
        }
      }
    }
    if (toRemove.length) {
      const rm = new Set(toRemove);
      this.narutoClones = this.narutoClones.filter(c => !rm.has(c));
    }
  }

  _tickYutaFamiliars(dt) {
    if (!this.yutaFamiliars.length) return;
    const now = Date.now();
    const toRemove = [];
    for (const bot of this.yutaFamiliars) {
      if (now - bot.spawnAt > YUTA_FAMILIAR_LIFETIME_SEC * 1000 || bot.exploded) {
        toRemove.push(bot);
        continue;
      }
      const enemies = this.gs.playerService.getAliveByTeam(bot.ownerTeam === 'DEF' ? 'ATT' : 'DEF');
      let nearest = null;
      let nearestDist = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(e.x - bot.x, e.y - bot.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = e;
        }
      }
      if (nearest) {
        const dx = nearest.x - bot.x;
        const dy = nearest.y - bot.y;
        const dist = Math.hypot(dx, dy) || 1;
        bot.x += (dx / dist) * Math.min(YUTA_FAMILIAR_SPEED * dt, dist);
        bot.y += (dy / dist) * Math.min(YUTA_FAMILIAR_SPEED * dt, dist);
        const newDist = Math.hypot(nearest.x - bot.x, nearest.y - bot.y);
        if (newDist < YUTA_FAMILIAR_EXPLODE_RADIUS) {
          bot.exploded = true;
          const owner = this.gs.playerService.get(bot.ownerId);
          if (owner) this.gs.onProjectileHit(nearest, YUTA_FAMILIAR_EXPLODE_DAMAGE, bot.ownerId, 'Rika');
          this._emitDisplay('sound_event', { type: 'explosion', x: bot.x, y: bot.y });
          toRemove.push(bot);
        }
      }
    }
    if (toRemove.length) {
      const rm = new Set(toRemove);
      this.yutaFamiliars = this.yutaFamiliars.filter((b) => !rm.has(b));
    }
  }

  _tickZones(dt) {
    if (!this.heroZones.length) return;
    const now = Date.now();
    const stillActive = [];
    for (const zone of this.heroZones) {
      if (now >= zone.expiresAt) continue;
      const owner = this.gs.playerService.get(zone.ownerId);
      if (!owner) { stillActive.push(zone); continue; }
      const enemies = this.gs.playerService.getAliveByTeam(zone.team === 'DEF' ? 'ATT' : 'DEF');
      let dps = SUKUNA_ZONE_DPS;
      let weaponName = 'SukunaZone';
      if (zone.type === 'itachi_flame') { dps = ITACHI_FLAME_DPS; weaponName = 'Amaterasu'; }
      else if (zone.type === 'yuta_zone') { dps = YUTA_ZONE_DPS; weaponName = 'YutaDomain'; }
      for (const target of enemies) {
        if (Math.hypot(target.x - zone.x, target.y - zone.y) <= zone.radius)
          this.gs.onProjectileHit(target, dps * dt, owner.id, weaponName);
      }
      stillActive.push(zone);
    }
    this.heroZones = stillActive;
  }
}
