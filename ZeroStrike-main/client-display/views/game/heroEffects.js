/**
 * Effets visuels liés aux compétences des héros (événements socket dédiés).
 */
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/constants.js';
import { shake } from './reduceFx.js';

export function onHeroAbilityDisplay(scene, { heroId, line1, line2, color = 0xffffff }) {
  scene.abilityDisplayBatch.push({ heroId, line1, line2, color });
  if (!scene.abilityDisplayCollectTimer) {
    scene.abilityDisplayCollectTimer = scene.time.delayedCall(280, () => {
      scene.abilityDisplayCollectTimer = null;
      showAbilityDisplayClash(scene, scene.abilityDisplayBatch);
      scene.abilityDisplayBatch = [];
    });
  }
}

function showAbilityDisplayClash(scene, items) {
  if (!items.length) return;
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const count = items.length;
  const scale = count === 1 ? 1 : count === 2 ? 0.85 : count === 3 ? 0.7 : 0.55;
  const slotH = 150 * scale;
  const totalH = (count - 1) * slotH;
  const startY = -totalH / 2;
  const masterContainer = add(scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2)).setDepth(100);
  for (let i = 0; i < items.length; i++) {
    const { heroId, line1, line2, color } = items[i];
    const heroName = heroId ? heroId.charAt(0).toUpperCase() + heroId.slice(1) : '';
    const text1 = line1 || heroName;
    const text2 = line2 || '';
    const y = startY + i * slotH;
    const barW = (GAME_WIDTH + 100) * scale;
    const barH = 70 * scale;
    const fontSize = Math.round(42 * scale);
    const barAlpha = 0.38;
    const bar1 = add(scene.add.rectangle(0, y - barH - 10, barW, barH, 0x000000, barAlpha)).setOrigin(0.5);
    const txt1 = add(scene.add.text(0, y - barH - 10, text1, {
      fontSize: `${fontSize}px`, color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5).setStroke('#000000', 5));
    masterContainer.add([bar1, txt1]);
    if (text2) {
      const bar2 = add(scene.add.rectangle(0, y - 10, barW, barH, 0x000000, barAlpha)).setOrigin(0.5);
      const txt2 = add(scene.add.text(0, y - 10, text2, {
        fontSize: `${fontSize}px`, color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
      }).setOrigin(0.5).setStroke('#000000', 5));
      masterContainer.add([bar2, txt2]);
    }
  }
  const aura = add(scene.add.rectangle(0, 0, GAME_WIDTH * 1.5, GAME_HEIGHT * 1.5, items[0].color, 0.035)).setOrigin(0.5);
  masterContainer.add(aura);
  scene.tweens.add({ targets: masterContainer, alpha: { from: 0, to: 1 }, duration: 100 });
  scene.time.delayedCall(750, () => {
    scene.tweens.add({
      targets: masterContainer,
      alpha: 0,
      duration: 180,
      onComplete: () => masterContainer.destroy()
    });
  });
}

export function onHeroFreeze(scene, { durationMs }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  if (scene.freezeOverlay) {
    scene.freezeOverlay.destroy();
    scene.freezeOverlay = null;
  }
  const overlay = add(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x66ccff, 0.0).setDepth(20));
  scene.freezeOverlay = overlay;
  scene.tweens.add({
    targets: overlay,
    alpha: { from: 0.0, to: 0.35 },
    duration: 200,
    yoyo: false
  });
  scene.time.delayedCall(durationMs, () => {
    if (!overlay.active) return;
    scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 300,
      onComplete: () => overlay.destroy()
    });
    scene.freezeOverlay = null;
  });
}

export function onHeroZone(scene, { type, x, y, radius, durationMs }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const colors = { itachi_flame: 0xff2200, sukuna: 0xff1744, yuta_zone: 0x9e9e9e };
  const color = colors[type] ?? 0xff1744;
  const circle = add(scene.add.circle(x, y, radius, color, 0.18).setDepth(1));
  circle.setStrokeStyle(4, color, 0.9);
  scene.tweens.add({
    targets: circle,
    alpha: { from: 0.3, to: 0.05 },
    scale: { from: 1, to: 1.05 },
    yoyo: true,
    repeat: durationMs / 400
  });
  scene.time.delayedCall(durationMs, () => {
    if (!circle.active) return;
    scene.tweens.add({ targets: circle, alpha: 0, duration: 250, onComplete: () => circle.destroy() });
  });
}

export function onHeroViolet(scene, { x, y, angle }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const orb = add(scene.add.circle(x, y, 40, 0xaa00ff, 0.9).setDepth(22));
  orb.setStrokeStyle(6, 0xff00ff, 1);
  const trail = add(scene.add.particles(x, y, 'projectile', {
    speed: 0, scale: { start: 1.5, end: 0 }, alpha: { start: 0.6, end: 0 },
    lifespan: 350, tint: 0xaa00ff, quantity: 3, frequency: 30
  })).setDepth(21);
  scene.tweens.add({
    targets: orb,
    x: x + Math.cos(angle) * 1920, y: y + Math.sin(angle) * 1920,
    duration: 2800, ease: 'Linear',
    onUpdate: () => trail.setPosition(orb.x, orb.y),
    onComplete: () => { orb.destroy(); trail.destroy(); }
  });
  shake(scene, 150, 0.008);
}

export function onHeroDash(scene, { x, y, ownerTeam }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const flash = add(scene.add.circle(x, y, 60, ownerTeam === 'DEF' ? 0x00ffff : 0xff4500, 0.6).setDepth(20));
  scene.tweens.add({ targets: flash, alpha: 0, scale: 3, duration: 350, onComplete: () => flash.destroy() });
  shake(scene, 80, 0.005);
}

export function onHeroWarudoLocal(scene, { x, y, radius, durationMs }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const ring = add(scene.add.circle(x, y, radius, 0x90caf9, 0.15).setDepth(19));
  ring.setStrokeStyle(4, 0x90caf9, 0.8);
  scene.tweens.add({ targets: ring, alpha: { from: 0.4, to: 0.1 }, yoyo: true, repeat: durationMs / 300, duration: 300 });
  scene.time.delayedCall(durationMs, () => { if (ring.active) ring.destroy(); });
}

export function onHeroDioKnives(scene, { x, y }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const flash = add(scene.add.circle(x, y, 90, 0xffee58, 0.5).setDepth(20));
  scene.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 400, onComplete: () => flash.destroy() });
  const overlay = add(scene.add.rectangle(960, 540, 1920, 1080, 0xffee58, 0.12).setDepth(23));
  scene.time.delayedCall(300, () => { scene.tweens.add({ targets: overlay, alpha: 0, duration: 400, onComplete: () => overlay.destroy() }); });
}

export function onHeroClonesSpawn(scene, { x, y, count }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const cx = x + Math.cos(angle) * 40;
    const cy = y + Math.sin(angle) * 40;
    const puff = add(scene.add.circle(cx, cy, 20, 0xffb74d, 0.8).setDepth(15));
    scene.tweens.add({ targets: puff, alpha: 0, scale: 2.5, duration: 400, onComplete: () => puff.destroy() });
  }
}

export function onHeroRasengan(scene, { x, y }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const spiral = add(scene.add.circle(x, y, 35, 0x4fc3f7, 0.7).setDepth(15));
  spiral.setStrokeStyle(5, 0xffffff, 0.9);
  scene.tweens.add({ targets: spiral, scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: 300, onComplete: () => spiral.destroy() });
}

export function onHeroFlames(scene, { x, y, angle, count, radius, durationMs }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  for (let i = 0; i < count; i++) {
    const dist = 80 + i * 120;
    const fx = x + Math.cos(angle) * dist;
    const fy = y + Math.sin(angle) * dist;
    const flame = add(scene.add.circle(fx, fy, radius, 0xff2200, 0.25).setDepth(2));
    flame.setStrokeStyle(3, 0xff6600, 0.9);
    scene.tweens.add({ targets: flame, alpha: { from: 0.35, to: 0.15 }, yoyo: true, repeat: durationMs / 500, duration: 500 });
    scene.time.delayedCall(durationMs, () => { if (flame.active) scene.tweens.add({ targets: flame, alpha: 0, duration: 300, onComplete: () => flame.destroy() }); });
  }
}

export function onHeroTsukuyomi(scene, { x, y, radius, durationMs }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const ring = add(scene.add.circle(x, y, radius, 0xce93d8, 0.18).setDepth(19));
  ring.setStrokeStyle(4, 0xce93d8, 0.9);
  const overlay = add(scene.add.rectangle(960, 540, 1920, 1080, 0x330033, 0.2).setDepth(18));
  scene.tweens.add({ targets: overlay, alpha: 0, duration: durationMs, ease: 'Linear', onComplete: () => overlay.destroy() });
  scene.time.delayedCall(durationMs, () => { if (ring.active) ring.destroy(); });
}

export function onHeroLaser(scene, { x, y, angle, width }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const len = 1920;
  const endX = x + Math.cos(angle) * len;
  const endY = y + Math.sin(angle) * len;
  const g = add(scene.add.graphics().setDepth(25));
  g.lineStyle(width * 3, 0xff8a65, 0.8);
  g.beginPath(); g.moveTo(x, y); g.lineTo(endX, endY); g.strokePath();
  g.lineStyle(width, 0xffffff, 1);
  g.beginPath(); g.moveTo(x, y); g.lineTo(endX, endY); g.strokePath();
  scene.tweens.add({ targets: g, alpha: 0, duration: 500, onComplete: () => g.destroy() });
  shake(scene, 300, 0.02);
}

export function onHeroTeleport(scene, { x, y, ownerTeam }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const ring = add(scene.add.circle(x, y, 30, ownerTeam === 'DEF' ? 0x00ffff : 0xff4500, 0.8).setDepth(20));
  scene.tweens.add({ targets: ring, alpha: 0, scaleX: 4, scaleY: 4, duration: 350, onComplete: () => ring.destroy() });
}

export function onHeroDismantle(scene, { x, y, angle }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const spread = 0.6;
  for (let i = 0; i < 5; i++) {
    const t = (i / 4) - 0.5;
    const a = angle + t * spread;
    const g = add(scene.add.graphics().setDepth(22));
    g.lineStyle(8, 0xff1744, 0.9);
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 200, y + Math.sin(a) * 200);
    g.strokePath();
    scene.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
  }
  shake(scene, 120, 0.01);
}

export function onHeroTojiBurst(scene, { durationMs }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const overlay = add(scene.add.rectangle(960, 540, 1920, 1080, 0xa5d6a7, 0.0).setDepth(18));
  scene.tweens.add({ targets: overlay, alpha: 0.06, duration: 200, yoyo: true, repeat: (durationMs / 400) - 1 });
  scene.time.delayedCall(durationMs, () => { if (overlay.active) overlay.destroy(); });
}

export function onHeroTojiWeapon(scene, { x, y, angle }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const orb = add(scene.add.circle(x, y, 28, 0xa5d6a7, 0.8).setDepth(15));
  orb.setStrokeStyle(4, 0x66bb6a, 1);
  scene.tweens.add({
    targets: orb,
    x: x + Math.cos(angle) * 800, y: y + Math.sin(angle) * 800,
    duration: 1400, ease: 'Linear',
    onComplete: () => orb.destroy()
  });
  shake(scene, 80, 0.006);
}

/** Invocation du familier Rika (poursuite côté serveur ; affichage = state yutaFamiliars). */
export function onHeroYutaFamiliarSpawn(scene, { x, y }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const puff = add(scene.add.circle(x, y, 22, 0xe1bee7, 0.75).setDepth(16));
  puff.setStrokeStyle(3, 0x9e9e9e, 1);
  scene.tweens.add({ targets: puff, alpha: 0, scale: 2.2, duration: 380, onComplete: () => puff.destroy() });
}

export function onHeroIchigoGetsuga(scene, { x, y, angle }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const orb = add(scene.add.circle(x, y, 35, 0x9c27b0, 0.9).setDepth(15));
  orb.setStrokeStyle(5, 0xe1bee7, 1);
  scene.tweens.add({
    targets: orb,
    x: x + Math.cos(angle) * 1000, y: y + Math.sin(angle) * 1000,
    duration: 1470, ease: 'Linear', onComplete: () => orb.destroy()
  });
  shake(scene, 150, 0.01);
}

export function onHeroIchigoBankai(scene, { durationMs }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const overlay = add(scene.add.rectangle(960, 540, 1920, 1080, 0x9c27b0, 0.0).setDepth(18));
  scene.tweens.add({ targets: overlay, alpha: 0.05, duration: 200, yoyo: true, repeat: (durationMs / 400) - 1 });
  scene.time.delayedCall(durationMs, () => { if (overlay.active) overlay.destroy(); });
}

export function onHeroRoadroller(scene, { x, y, radius }) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const ring = add(scene.add.circle(x, y, radius, 0xffee58, 0.35).setDepth(20));
  ring.setStrokeStyle(6, 0xffc107, 1);
  scene.tweens.add({ targets: ring, alpha: 0, scale: 1.3, duration: 500, onComplete: () => ring.destroy() });
  shake(scene, 250, 0.02);
}

