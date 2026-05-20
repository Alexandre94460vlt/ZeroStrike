/**
 * Synchronisation de l'état serveur → entités affichées (joueurs, projectiles, bombe, streaks).
 */
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/constants.js';
import { charSlot } from './helpers.js';
import { refreshKillFeed, updateTopBarAvatars } from './hud.js';
import { isReduceFx } from './reduceFx.js';
import { UITheme, Palette } from '../../config/uiTheme.js';
import { getHeroBodyTint } from '../../../shared/heroBodyTint.js';
import { sanitizeHudText } from '../../utils/sanitizeDisplay.js';

/** Pseudo au-dessus de la barre de vie (caractères max après sanitization) */
const PLAYER_NAME_TAG_MAX = 18;
const PLAYER_NAME_FONT = 'Teko';

/** Intervalle entre particules de traînée (ms) — plus bas = traînée plus dense (pas de shotgun : 5 plombs) */
const TRAIL_EMIT_MS = {
  PISTOL: 70,
  SMG: 38,
  RIFLE: 58,
  SNIPER: 92
};

/** Au-delà de ce nombre de projectiles en vol, on éclaircit les traînées (LAN chargé) */
const TRAIL_LAN_BUSY = 30;
/** Au-delà : on coupe SMG / pistolet (gros volume de balles), on garde fusil / sniper lisibles */
const TRAIL_LAN_DROP_SMG_PISTOL = 46;

/**
 * Traînée légère (blend ADD) derrière le projectile — désactivée si « réduire les effets ».
 * @param {number} projectileCount — projectiles présents dans l’état (adapte la charge GPU)
 */
function createProjectileTrail(scene, x, y, angleRad, tint, wid, projectileCount = 0) {
  if (isReduceFx(scene)) return null;
  // Shotgun : 5 plombs × traînée = trop d’émetteurs ; la teinte / taille du sprite suffisent
  if (wid === 'SHOTGUN') return null;

  let emitMs = TRAIL_EMIT_MS[wid] ?? 62;
  if (projectileCount > TRAIL_LAN_BUSY) {
    emitMs = Math.min(240, Math.floor(emitMs * (1.75 + (projectileCount - TRAIL_LAN_BUSY) * 0.02)));
  }
  if (projectileCount > TRAIL_LAN_DROP_SMG_PISTOL && (wid === 'SMG' || wid === 'PISTOL')) {
    return null;
  }

  const backDeg = Phaser.Math.RadToDeg(angleRad) + 180;
  const speed =
    wid === 'SNIPER'
      ? { min: 35, max: 90 }
      : wid === 'SMG'
        ? { min: 12, max: 48 }
        : { min: 18, max: 62 };
  const life = wid === 'SNIPER' ? 210 : wid === 'SMG' ? 105 : 145;
  const scale0 = wid === 'SMG' ? 0.32 : 0.36;

  const emitter = scene.add.particles(x, y, 'projectile', {
    angle: { min: backDeg - 38, max: backDeg + 38 },
    speed,
    scale: { start: scale0, end: 0 },
    alpha: { start: 0.38, end: 0 },
    lifespan: life,
    frequency: emitMs,
    quantity: 1,
    tint,
    blendMode: Phaser.BlendModes.ADD,
    emitting: true
  });
  emitter.setDepth(4);
  scene.rootScale.add(emitter);
  return emitter;
}

/** Teinte de secours si le serveur n’envoie pas `team` sur un vieux état */
const PROJ_TINT_FALLBACK = {
  PISTOL: 0xece8e4,
  SMG: 0xc8c4c0,
  RIFLE: 0xd07050,
  SNIPER: 0xa8a8b0,
  SHOTGUN: 0xd9481c
};

/** Teinte affichée : équipe (vert ATT / rouge DEF), sinon repli par arme */
function projectileDisplayTint(proj, weaponIdUpper) {
  if (proj.team === 'DEF') return UITheme.projectileTintDef;
  if (proj.team === 'ATT') return UITheme.projectileTintAtt;
  return PROJ_TINT_FALLBACK[weaponIdUpper] ?? 0xffffff;
}

const PROJ_SCALE = {
  PISTOL: 1,
  SMG: 0.86,
  RIFLE: 1,
  SNIPER: 1.14,
  SHOTGUN: 0.68
};

function formatHudClock(totalSeconds) {
  const t = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function onStateUpdate(scene, state) {
  // Reset killfeed à chaque nouvelle manche (entrée en BUY_PHASE).
  const prevRoundState = scene._lastRoundState;
  const rs = state.roundState;
  if (rs === 'BUY_PHASE' && prevRoundState && prevRoundState !== 'BUY_PHASE') {
    scene.killFeed = [];
    refreshKillFeed(scene);
    // Reset multi-kill (double/triple/...) à chaque manche.
    scene._multiKill = null;
  }

  scene.scoreDef.setText(String(state.scores?.DEF || 0));
  scene.scoreAtt.setText(String(state.scores?.ATT || 0));
  const isBuy = rs === 'BUY_PHASE';
  const isAction = rs === 'ACTION_PHASE';
  const showTimer = isBuy || isAction;
  scene.timerText.setVisible(showTimer);
  if (scene.timerPhaseCaption) scene.timerPhaseCaption.setVisible(isBuy);

  if (isAction) {
    scene.timerText.setColor('#ECE8E4');
    scene.timerText.setText(formatHudClock(state.roundTime ?? 0));
  } else if (isBuy) {
    scene.timerText.setColor(Palette.terracotta);
    scene.timerText.setText(formatHudClock(state.phaseTime ?? 0));
  }

  updateTopBarAvatars(scene, state.players);

  for (const p of state.players) {
    let entry = scene.players.get(p.id);
    if (!entry) {
      const isDef = p.team === 'DEF';

      const slot = charSlot(p.id);
      const kenneyKey = isDef ? `char_def_${slot}` : `char_att_${slot}`;
      if (!scene.textures.exists(kenneyKey)) {
        throw new Error(`[stateUpdate] Texture Kenney manquante : ${kenneyKey}`);
      }
      const texKey = kenneyKey;
      const usesKenney = true;
      const usesHero = false;

      const sprite = scene.add.image(p.x, p.y, texKey).setDepth(10);

      sprite.setOrigin(0.5, 0.5);
      sprite.setScale(1);
      sprite.setDisplaySize(52, 52);

      const shadowW = 34;
      const shadowH = 18;
      const shadow = scene.add.ellipse(p.x + 3, p.y + 5, shadowW, shadowH, 0x000010, 0.45).setDepth(8);
      const glowR = 28;
      const glow = scene.add.circle(p.x, p.y, glowR,
        isDef ? UITheme.spriteGlowDef : UITheme.spriteGlowAtt, 0.18).setDepth(9);
      const weaponLine = scene.add.graphics().setDepth(10);
      if (usesKenney) weaponLine.setAlpha(0);
      const healthBar = scene.add.graphics().setDepth(11);
      const nameTag = sanitizeHudText(p.name, PLAYER_NAME_TAG_MAX) || 'Joueur';
      const nameLabel = scene.add
        .text(p.x, p.y, nameTag, {
          fontSize: '11px',
          fontFamily: PLAYER_NAME_FONT,
          fontStyle: '600',
          color: isDef ? UITheme.playerNameDef : UITheme.playerNameAtt,
          stroke: '#0a0a0a',
          strokeThickness: 3
        })
        .setOrigin(0.5, 1)
        .setDepth(12);
      scene.rootScale.add(shadow);
      scene.rootScale.add(sprite);
      scene.rootScale.add(glow);
      scene.rootScale.add(weaponLine);
      scene.rootScale.add(healthBar);
      scene.rootScale.add(nameLabel);
      entry = {
        sprite,
        shadow,
        glow,
        weaponLine,
        healthBar,
        nameLabel,
        _nameTag: nameTag,
        usesKenney,
        usesHero,
        targetX: p.x,
        targetY: p.y,
        targetRot: p.rot,
        lastX: p.x,
        lastY: p.y,
        isDef,
        slot,
        heroId: p.heroId || null,
        weapon: p.weapon || 'PISTOL',
        stepPhase: 0,
        _poseState: 'gun'
      };
      scene.players.set(p.id, entry);
    }

    if (p.heroId !== entry.heroId) {
      entry.heroId = p.heroId || null;
      entry.usesHero = false;
      entry.usesKenney = true;
      if (entry.shadow) entry.shadow.setSize(34, 18);
    }

    const onDef = p.team === 'DEF';
    if (p.heroId) {
      entry.sprite.setTint(getHeroBodyTint(p.heroId));
    } else {
      entry.sprite.setTint(onDef ? UITheme.spriteTintDef : UITheme.spriteTintAtt);
    }
    entry.glow.setFillStyle(onDef ? UITheme.spriteGlowDef : UITheme.spriteGlowAtt, p.isDead ? 0.08 : 0.22);
    if (entry.nameLabel) {
      entry.nameLabel.setStyle({ color: onDef ? UITheme.playerNameDef : UITheme.playerNameAtt });
    }

    const maxH = p.maxHealth ?? 100;
    const h = Math.max(0, p.health ?? maxH);
    const ratio = maxH > 0 ? h / maxH : 0;
    entry.healthBar.clear();
    entry.healthBar.setPosition(p.x, p.y - 28);
    entry.healthBar.fillStyle(0x333333, 0.9);
    entry.healthBar.fillRect(-18, -3, 36, 5);
    entry.healthBar.fillStyle(ratio > 0.5 ? 0x00aa00 : ratio > 0.25 ? 0xcc8800 : 0xcc0000, 0.95);
    entry.healthBar.fillRect(-18, -3, 36 * ratio, 5);
    if (p.isDead) entry.healthBar.setVisible(false);
    else entry.healthBar.setVisible(true);

    const barLift = 28;
    const nameY = p.y - barLift - 5;
    if (entry.nameLabel) {
      const tag = sanitizeHudText(p.name, PLAYER_NAME_TAG_MAX) || 'Joueur';
      if (tag !== entry._nameTag) {
        entry._nameTag = tag;
        entry.nameLabel.setText(tag);
      }
      entry.nameLabel.setPosition(p.x, nameY);
      if (p.isDead) entry.nameLabel.setVisible(false);
      else entry.nameLabel.setVisible(true);
    }
    const newWeapon = p.weapon || 'PISTOL';
    if (newWeapon !== entry.weapon) {
      entry.weapon = newWeapon;
    }
    entry.weaponLine.setPosition(p.x, p.y);
    entry.weaponLine.setRotation(p.rot);
    entry.targetX = p.x;
    entry.targetY = p.y;
    entry.targetRot = p.rot;
    if (entry.usesKenney) {
      entry.sprite.setRotation(p.rot);
    }
    const nowT = scene.game.loop.time;
    if (entry.usesKenney) {
      const prevAmmo = entry._ammo ?? p.ammo ?? 30;
      if (p.ammo !== undefined && p.ammo < prevAmmo) {
        entry._shootUntil = nowT + (p.heroId ? 320 : 220);
        const shootKey = `char_${entry.isDef ? 'def' : 'att'}_${entry.slot}_gun`;
        if (!scene.textures.exists(shootKey)) {
          throw new Error(`[stateUpdate] Texture tir manquante : ${shootKey}`);
        }
        entry._poseState = 'gun';
        entry.sprite.setTexture(shootKey);
        entry.sprite.setScale(1);
        entry.sprite.setDisplaySize(52, 52);
      }
      if (p.ammo !== undefined && p.ammo > prevAmmo && (p.ammo - prevAmmo) > 1) {
        entry._reloadUntil = nowT + 600;
        const reloadKey = `char_${entry.isDef ? 'def' : 'att'}_${entry.slot}_reload`;
        if (!scene.textures.exists(reloadKey)) {
          throw new Error(`[stateUpdate] Texture reload manquante : ${reloadKey}`);
        }
        entry._poseState = 'reload';
        entry.sprite.setTexture(reloadKey);
        entry.sprite.setScale(1);
        entry.sprite.setDisplaySize(52, 52);
      }
      entry._ammo = p.ammo ?? prevAmmo;
    }
    entry.lastX = p.x;
    entry.lastY = p.y;

    entry.sprite.setAlpha(p.isDead ? 0.25 : 1);
    entry.glow.setAlpha(p.isDead ? 0.08 : 0.22);
    if (entry.shadow) entry.shadow.setAlpha(p.isDead ? 0.1 : 0.35);
    entry.glow.setPosition(entry.sprite.x, entry.sprite.y);
  }

  for (const [id] of scene.players) {
    if (!state.players.find(p => p.id === id)) {
      const entry = scene.players.get(id);
      entry.sprite.destroy();
      if (entry.shadow) entry.shadow.destroy();
      entry.glow.destroy();
      entry.weaponLine.destroy();
      if (entry.healthBar) entry.healthBar.destroy();
      if (entry.nameLabel) entry.nameLabel.destroy();
      if (scene.playerDustEmitters) {
        const emitter = scene.playerDustEmitters.get(entry);
        if (emitter) { emitter.destroy(); scene.playerDustEmitters.delete(entry); }
      }
      scene.players.delete(id);
    }
  }

  const projectileList = state.projectiles || [];
  const projectileCount = projectileList.length;

  for (const proj of projectileList) {
    const wid = String(proj.weaponId || 'RIFLE').toUpperCase();
    const tint = projectileDisplayTint(proj, wid);
    const sc = PROJ_SCALE[wid] ?? 1;
    let entry = scene.projectiles.get(proj.id);
    if (!entry) {
      const sprite = scene.add.image(proj.x, proj.y, 'projectile').setDepth(5).setTint(tint).setScale(sc);
      scene.rootScale.add(sprite);
      const trail = createProjectileTrail(scene, proj.x, proj.y, proj.angle, tint, wid, projectileCount);
      entry = { sprite, trail };
      scene.projectiles.set(proj.id, entry);
    }
    entry.sprite.setTint(tint);
    entry.sprite.setScale(sc);
    entry.sprite.x = proj.x;
    entry.sprite.y = proj.y;
    entry.sprite.rotation = proj.angle;
    if (entry.trail) {
      entry.trail.setPosition(proj.x, proj.y);
    }
  }
  for (const [id, entry] of scene.projectiles) {
    if (!state.projectiles.find(p => p.id === id)) {
      entry.sprite.destroy();
      if (entry.trail) entry.trail.destroy();
      scene.projectiles.delete(id);
    }
  }

  if (!scene.narutoClones) scene.narutoClones = new Map();
  const clones = state.narutoClones || [];
  for (const c of clones) {
    if (!scene.narutoClones.has(c.id)) {
      const s = scene.add.circle(c.x, c.y, 14, 0xffb74d, 0.85).setDepth(11);
      s.setStrokeStyle(3, 0xffffff, 0.8);
      scene.rootScale.add(s);
      scene.narutoClones.set(c.id, s);
    }
    const cs = scene.narutoClones.get(c.id);
    cs.setPosition(c.x, c.y);
  }
  for (const [id, s] of scene.narutoClones) {
    if (!clones.find(c => c.id === id)) { s.destroy(); scene.narutoClones.delete(id); }
  }

  if (!scene.yutaFamiliars) scene.yutaFamiliars = new Map();
  const fams = state.yutaFamiliars || [];
  for (const b of fams) {
    if (!scene.yutaFamiliars.has(b.id)) {
      const s = scene.add.circle(b.x, b.y, 16, 0xe1bee7, 0.92).setDepth(11);
      s.setStrokeStyle(3, 0x9e9e9e, 1);
      scene.rootScale.add(s);
      scene.yutaFamiliars.set(b.id, s);
    }
    const fs = scene.yutaFamiliars.get(b.id);
    fs.setPosition(b.x, b.y);
  }
  for (const [id, s] of scene.yutaFamiliars) {
    if (!fams.find((b) => b.id === id)) { s.destroy(); scene.yutaFamiliars.delete(id); }
  }

  // Domaines Gojo/Yuta : disque noir masquant l’intérieur pour le public (sync état serveur).
  const doms = Array.isArray(state.activeDomains) ? state.activeDomains : [];
  if (!scene.domainBarrierDisks) scene.domainBarrierDisks = new Map();
  for (const d of doms) {
    let disk = scene.domainBarrierDisks.get(d.id);
    if (!disk) {
      disk = scene.add.circle(d.cx, d.cy, d.r, 0x030308, 0.9).setDepth(44);
      scene.rootScale.add(disk);
      scene.domainBarrierDisks.set(d.id, disk);
    }
    disk.setPosition(d.cx, d.cy);
    disk.setRadius(d.r);
    disk.setVisible(true);
  }
  for (const [id, disk] of scene.domainBarrierDisks) {
    if (!doms.find((d) => d.id === id)) {
      disk.destroy();
      scene.domainBarrierDisks.delete(id);
    }
  }

  if (state.bomb?.planted) {
    if (!scene.bombSprite) {
      scene.bombSprite = scene.add.circle(state.bomb.x, state.bomb.y, 14, UITheme.bombCore, 0.9).setDepth(15);
      scene.bombSprite.setStrokeStyle(4, UITheme.siteStroke, 1);
      scene.rootScale.add(scene.bombSprite);
    }
    scene.bombSprite.setPosition(state.bomb.x, state.bomb.y);
    if (!scene.bombOverlay) {
      scene.bombOverlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH + 100, GAME_HEIGHT + 100, 0x3d2018, 0).setDepth(14);
      scene.rootScale.add(scene.bombOverlay);
    }
    {
      const pulse = 0.03 + 0.02 * Math.sin(scene.game.loop.time * 0.008);
      scene.bombOverlay.setAlpha(isReduceFx(scene) ? pulse * 0.35 : pulse);
    }
    if (!scene.bombTimerText) {
      scene.bombTimerText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '40', {
        fontSize: '72px',
        fontFamily: 'monospace',
        color: '#FF6B35',
        stroke: '#0a0a0a',
        strokeThickness: 8
      }).setOrigin(0.5).setDepth(16);
      scene.rootScale.add(scene.bombTimerText);
    }
    const bt = Math.ceil(state.bomb.timer ?? 0);
    scene.bombTimerText.setText(String(bt));
    scene.bombTimerText.setAlpha(0.85 + 0.15 * Math.sin(scene.game.loop.time * 0.01));
  } else {
    if (scene.bombSprite) {
      scene.bombSprite.destroy();
      scene.bombSprite = null;
    }
    if (scene.bombOverlay) {
      scene.bombOverlay.destroy();
      scene.bombOverlay = null;
    }
    if (scene.bombTimerText) {
      scene.bombTimerText.destroy();
      scene.bombTimerText = null;
    }
  }

  scene._lastRoundState = rs;
}
