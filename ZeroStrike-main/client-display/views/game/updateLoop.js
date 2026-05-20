/**
 * Boucle update : interpolation des sprites, animations, particules, collisions power-up (visuel).
 */
import { LERP_FACTOR } from './constants.js';
import { isReduceFx } from './reduceFx.js';

export function gameSceneUpdate(scene) {
  for (const [, entry] of scene.players) {
    const sprite = entry.sprite;
    const prevX = sprite.x;
    const prevY = sprite.y;
    sprite.x += (entry.targetX - sprite.x) * LERP_FACTOR;
    sprite.y += (entry.targetY - sprite.y) * LERP_FACTOR;

    const aimBase = entry.targetRot + (entry.shootKickOffset || 0);

    entry.glow.setPosition(sprite.x, sprite.y);
    if (entry.shadow) entry.shadow.setPosition(sprite.x + 3, sprite.y + 5);
    if (entry.healthBar) {
      const barLift = 28;
      entry.healthBar.setPosition(sprite.x, sprite.y - barLift);
      if (entry.nameLabel) {
        entry.nameLabel.setPosition(sprite.x, sprite.y - barLift - 5);
      }
    }

    const speed = Math.hypot(sprite.x - prevX, sprite.y - prevY);
    const moving = speed > 0.3;

    if (entry.usesKenney) {
      const nowMs = scene.game.loop.time;
      const WALK_MS = 180;

      if (moving) {
        entry.stepPhase += speed * 0.32;
        const tilt = Math.sin(entry.stepPhase) * 0.05;
        const scaleB = 1 + Math.abs(Math.sin(entry.stepPhase)) * 0.045;
        sprite.rotation = aimBase + tilt;
        sprite.setScale(scaleB);

        const offset = (entry.slot * 83) % WALK_MS;
        const walkFrame = Math.floor((nowMs + offset) / WALK_MS) % 2 === 0 ? 'gun' : 'hold';
        const shootPoseActive = entry._shootUntil && nowMs < entry._shootUntil;
        if (!shootPoseActive && entry._poseState !== walkFrame) {
          entry._poseState = walkFrame;
          const texKey = `char_${entry.isDef ? 'def' : 'att'}_${entry.slot}_${walkFrame}`;
          if (!scene.textures.exists(texKey)) {
            throw new Error(`[updateLoop] Texture animation marche manquante : ${texKey}`);
          }
          sprite.setTexture(texKey);
          sprite.setDisplaySize(52, 52);
        }
      } else {
        sprite.rotation = aimBase;
        sprite.setScale(1);
        const specialActive = (entry._shootUntil && nowMs < entry._shootUntil) ||
          (entry._reloadUntil && nowMs < entry._reloadUntil);
        if (!specialActive && entry._poseState !== 'gun') {
          entry._poseState = 'gun';
          const texKey = `char_${entry.isDef ? 'def' : 'att'}_${entry.slot}_gun`;
          if (!scene.textures.exists(texKey)) {
            throw new Error(`[updateLoop] Texture pose gun manquante : ${texKey}`);
          }
          sprite.setTexture(texKey);
          sprite.setDisplaySize(52, 52);
        }
      }
    } else {
      throw new Error('[updateLoop] Joueur sans sprite Kenney (usesKenney attendu).');
    }

    if (entry.weaponLine) {
      entry.weaponLine.setPosition(sprite.x, sprite.y);
      entry.weaponLine.setRotation(aimBase);
    }

    if (!isReduceFx(scene)) {
      let emitter = scene.playerDustEmitters.get(entry);
      if (!emitter) {
        emitter = scene.add.particles(sprite.x, sprite.y + 18, 'projectile', {
          speed: { min: 10, max: 35 },
          scale: { start: 0.25, end: 0 },
          alpha: { start: 0.4, end: 0 },
          lifespan: 260,
          quantity: 1,
          frequency: 80,
          tint: 0xaaaaaa
        });
        emitter.setDepth(5);
        scene.rootScale.add(emitter);
        scene.playerDustEmitters.set(entry, emitter);
      }
      emitter.setPosition(sprite.x, sprite.y + 18);
      if (moving && !emitter.emitting) emitter.start();
      else if (!moving && emitter.emitting) emitter.stop();
    }

    if (entry.shootKickOffset) {
      entry.shootKickOffset *= 0.78;
      if (Math.abs(entry.shootKickOffset) < 0.002) entry.shootKickOffset = 0;
    }
  }
  // Power-up collection supprimée côté client : la collecte est gérée
  // exclusivement par le serveur (handlePowerUpPickups → powerup_despawn).
}
