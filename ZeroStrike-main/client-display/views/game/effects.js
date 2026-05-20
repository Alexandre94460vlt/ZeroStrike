/**
 * Effets de combat : sons, explosions, killstreaks (bombardement, drone), power-ups.
 */
import * as AudioManager from '../../utils/AudioManager.js';
import { isReduceFx, shake, particleQty } from './reduceFx.js';

/** Recul visuel (rad) — cumul plafonné pour le full-auto */
const SHOOT_KICK_RAD = {
  PISTOL: 0.068,
  SMG: 0.036,
  RIFLE: 0.08,
  SNIPER: 0.15,
  SHOTGUN: 0.108
};

const MUZZLE_SCALE = {
  PISTOL: 1.12,
  SMG: 0.92,
  RIFLE: 1.2,
  SNIPER: 1.7,
  SHOTGUN: 1.42
};

function applyShootRecoil(scene, x, y, weaponId, ownerId) {
  if (!weaponId || SHOOT_KICK_RAD[weaponId] === undefined) {
    throw new Error(`[effects] Recul tir : weaponId inconnu ou non supporté : ${weaponId}`);
  }
  const amt = SHOOT_KICK_RAD[weaponId];
  let best = ownerId ? scene.players.get(ownerId) : null;
  if (!best) {
    let bestD = Infinity;
    for (const [, entry] of scene.players) {
      if (!entry.sprite) continue;
      const d = Phaser.Math.Distance.Between(entry.sprite.x, entry.sprite.y, x, y);
      if (d < bestD && d < 56) { bestD = d; best = entry; }
    }
  }
  if (!best) return;
  const next = (best.shootKickOffset || 0) - amt;
  best.shootKickOffset = Math.max(next, -0.2);
}

export function registerExplosionAnim(scene) {
  if (!scene.textures.exists('explosion_frame_1')) {
    throw new Error('[effects] Textures explosion_frame_* manquantes.');
  }
  if (scene.anims.exists('boom')) return;
  scene.anims.create({
    key: 'boom',
    frames: [1, 2, 3, 4, 5].map(i => ({ key: `explosion_frame_${i}` })),
    frameRate: 14,
    repeat: 0
  });
}

/**
 * @param {import('phaser').Scene} scene
 * @param {{ type: string; x: number; y: number; weaponId?: string; powerUpType?: string }} payload
 */
export function onSoundEvent(scene, payload) {
  if (!payload || typeof payload !== 'object' || payload.type == null) return;
  const { type, x, y, weaponId } = payload;
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const red = isReduceFx(scene);
  if (type === 'shoot') {
    if (!weaponId) {
      throw new Error('[effects] sound_event shoot sans weaponId');
    }
    AudioManager.playWeaponShoot(weaponId);
    applyShootRecoil(scene, x, y, weaponId, payload.ownerId);
    if (!red) {
      if (MUZZLE_SCALE[weaponId] === undefined) {
        throw new Error(`[effects] MUZZLE_SCALE manquant pour ${weaponId}`);
      }
      const scaleBase = MUZZLE_SCALE[weaponId];
      const flash = add(scene.add.image(x, y, 'muzzle_flash').setDepth(11).setScale(scaleBase));
      scene.tweens.add({ targets: flash, alpha: 0, scale: scaleBase * 1.45, duration: 85 });
      scene.time.delayedCall(100, () => flash.destroy());
    }
  } else if (type === 'reload') {
    if (!weaponId) {
      throw new Error('[effects] sound_event reload sans weaponId');
    }
    AudioManager.playWeaponReload(weaponId);
  } else if (type === 'explosion') {
    AudioManager.playExplosion();
    shake(scene, 200, 0.018);
    if (!scene.anims.exists('boom')) {
      throw new Error('[effects] Animation boom manquante (registerExplosionAnim).');
    }
    if (!red) {
      const expl = add(scene.add.sprite(x, y, 'explosion_frame_1').setDepth(20).setScale(2.5));
      expl.play('boom');
      expl.once('animationcomplete', () => expl.destroy());
      const ring = add(scene.add.circle(x, y, 10, 0xff8800, 0.9).setDepth(19));
      scene.tweens.add({ targets: ring, scaleX: 8, scaleY: 8, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
    }
  } else if (type === 'impact') {
    const q0 = particleQty(scene, 4);
    if (q0 > 0) {
      const baseEmitter = add(scene.add.particles(x, y, 'projectile', {
        speed: { min: 30, max: 80 },
        scale: { start: 0.5, end: 0 },
        lifespan: 200,
        quantity: q0
      }));
      scene.time.delayedCall(250, () => baseEmitter.destroy());
    }

    const mapData = scene.registry.get('mapData');
    const walls = mapData?.walls;
    if (!walls?.length) return;
    let nearest = null;
    let nearestDistSq = Infinity;
    for (const w of walls) {
      if (w.kind && w.kind !== 'bordure') continue;
      const cx = w.x + w.width / 2;
      const cy = w.y + w.height / 2;
      const dx = cx - x;
      const dy = cy - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearestDistSq) {
        nearestDistSq = d2;
        nearest = { x: cx, y: cy };
      }
    }
    if (nearest && nearestDistSq <= 60 * 60) {
      const ex = nearest.x;
      const ey = nearest.y;
      const qb = particleQty(scene, 12);
      if (qb > 0) {
        const burst = add(scene.add.particles(ex, ey, 'projectile', {
          speed: { min: 80, max: 200 },
          scale: { start: 0.8, end: 0 },
          lifespan: 320,
          quantity: qb,
          angle: { min: 0, max: 360 }
        }));
        scene.time.delayedCall(350, () => burst.destroy());
      }
    }
  } else if (type === 'powerup_collect') {
    AudioManager.playPowerup();
    if (!red) {
      const ring = add(scene.add.circle(x, y, 24, 0xffffff, 0.2).setDepth(12));
      ring.setStrokeStyle(3, 0xffff66, 0.9);
      scene.tweens.add({ targets: ring, alpha: 0, scale: 1.8, duration: 260 });
      scene.time.delayedCall(270, () => ring.destroy());
    }
  } else if (type === 'defuse') {
    AudioManager.playDefuse();
    if (!red) {
      const flash = add(scene.add.circle(x, y, 20, 0x00ffff, 0.4).setDepth(14));
      scene.tweens.add({ targets: flash, alpha: 0, scale: 1.5, duration: 250 });
      scene.time.delayedCall(260, () => flash.destroy());
    }
  }
}

/**
 * Éclaboussure sang (particules rouges) au point de mort — pas de GIF, pas de requête réseau.
 */
function spawnBloodBurst(scene, x, y) {
  const add = (obj) => {
    scene.rootScale.add(obj);
    return obj;
  };
  const q = particleQty(scene, 26);
  if (q <= 0) return;
  const blood = add(
    scene.add.particles(x, y, 'projectile', {
      speed: { min: 60, max: 220 },
      scale: { start: 0.55, end: 0 },
      lifespan: 340,
      quantity: q,
      angle: { min: 0, max: 360 },
      tint: 0x9a0a12,
      blendMode: Phaser.BlendModes.NORMAL
    })
  );
  blood.setDepth(24);
  scene.time.delayedCall(400, () => blood.destroy());
}

/**
 * Dégâts non fatals : chiffres flottants + léger shake. Mort : **son + sang uniquement** (pas de chiffres / shake).
 */
export function onDamageIndicator(scene, data) {
  if (!data) return;
  const { x, y, hp = 0, shield = 0, isKill = false } = data;
  const add = (obj) => {
    scene.rootScale.add(obj);
    return obj;
  };
  const red = isReduceFx(scene);

  if (isKill) {
    AudioManager.playHitFeedback(true);
    if (!red) spawnBloodBurst(scene, x, y);
    return;
  }

  AudioManager.playHitFeedback(false);

  const parts = [];
  if (hp > 0) {
    const t = add(
      scene.add
        .text(x, y - 36, `−${hp}`, {
          fontSize: '19px',
          fontFamily: 'monospace',
          color: '#ffaa55',
          stroke: '#000000',
          strokeThickness: 5
        })
        .setOrigin(0.5, 0.5)
        .setDepth(26)
    );
    parts.push(t);
  }
  if (shield > 0) {
    const t = add(
      scene.add
        .text(x, y - (hp > 0 ? 58 : 36), `−${shield} 🛡`, {
          fontSize: '17px',
          fontFamily: 'monospace',
          color: '#66ddff',
          stroke: '#000000',
          strokeThickness: 4
        })
        .setOrigin(0.5, 0.5)
        .setDepth(25)
    );
    parts.push(t);
  }
  if (!parts.length) return;

  if (!red) shake(scene, 72, 0.007);
  parts.forEach((text, i) => {
    scene.tweens.add({
      targets: text,
      y: text.y - 38 - i * 10,
      alpha: 0,
      duration: 480 + i * 60,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });
  });
}

/**
 * Affiche un power-up sur la carte (sprite animé type arcade).
 * data: { id, x, y, type, effectDurationSec }
 */
export function spawnPowerUp(scene, data) {
  if (!data || !data.id) return;
  if (scene.powerUps.has(data.id)) return;
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const colorByType = {
    heal: 0x55ff88,
    speed: 0x00ffff,
    damage: 0xff3344,
    shield: 0x4488ff,
    multishot: 0xffaa00,
    ricochet: 0xff6600,
    ghost: 0xccccff,
    magnet: 0xff55ff
  };
  const c = colorByType[data.type] ?? 0xffff66;
  const sprite = add(scene.add.circle(data.x, data.y, 16, c, 0.85).setDepth(8));
  sprite.setStrokeStyle(3, 0xffffff, 0.9);

  const iconByType = { heal: '❤', speed: '⚡', damage: '🔥', shield: '🛡', multishot: '✦', ricochet: '⟳', ghost: '👻', magnet: '⊕' };
  const icon = iconByType[data.type] || '?';
  const label = add(scene.add.text(data.x, data.y - 26, icon, {
    fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 2
  }).setOrigin(0.5, 0.5).setDepth(9));

  if (!isReduceFx(scene)) {
    scene.tweens.add({
      targets: [sprite, label],
      scale: { from: 0.85, to: 1.15 },
      alpha: { from: 0.8, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1
    });
  }
  scene.powerUps.set(data.id, {
    id: data.id,
    type: data.type,
    sprite,
    label,
    effectDurationSec: data.effectDurationSec ?? 10,
    collected: false
  });
}

export function despawnPowerUp(scene, data) {
  if (!data || !data.id) return;
  const entry = scene.powerUps.get(data.id);
  if (!entry) return;
  const targets = [entry.sprite, entry.label].filter(Boolean);
  if (targets.length) {
    scene.tweens.killTweensOf(targets);
    scene.tweens.add({
      targets,
      alpha: 0,
      scale: 0.2,
      duration: 200,
      onComplete: () => targets.forEach(t => t?.destroy())
    });
  }
  scene.powerUps.delete(data.id);
}
