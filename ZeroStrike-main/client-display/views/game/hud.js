/**
 * HUD : scores, timer, kill feed, commentaires, fin de match.
 * Lisibilité « grand écran » : Teko, contours épais, panneau derrière le feed.
 */
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/constants.js';
import { sanitizeHudText } from '../../utils/sanitizeDisplay.js';
import { UITheme, Palette } from '../../config/uiTheme.js';

const FONT_UI = 'Teko';
/** HUD minimaliste : équipes froid / chaud soft */
const HUD = {
  timerSize: '46px',
  killSize: '19px',
  commentSize: '15px',
  killLineHeight: 28,
  killBottomPad: 14,
  commentLineHeight: 24,
  commentBlockTop: 200
};

/** Flash bref quand le serveur annonce la prolongation (égalité au match point) */
export function onOvertimeStart(scene) {
  const w = GAME_WIDTH / 2;
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const banner = add(scene.add.text(w, 108, 'PROLONGATION', {
    fontSize: '38px',
    fontFamily: FONT_UI,
    fontStyle: '700',
    color: '#ECE8E4',
    stroke: '#000000',
    strokeThickness: 8
  }).setOrigin(0.5, 0.5).setDepth(100).setAlpha(0.95));
  const sub = add(scene.add.text(w, 152, 'Égalité · dernier point en jeu', {
    fontSize: '22px',
    fontFamily: FONT_UI,
    color: '#B85C3E',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5, 0.5).setDepth(100).setAlpha(0.9));
  scene.tweens.add({
    targets: [banner, sub],
    alpha: 0,
    y: '+= -24',
    duration: 2800,
    delay: 400,
    ease: 'Sine.easeIn',
    onComplete: () => {
      banner.destroy();
      sub.destroy();
    }
  });
}

export function createHUD(scene) {
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  const w = GAME_WIDTH;
  const h = GAME_HEIGHT;

  // ── Top bar (HUD compact, semi-transparent, centré haut) ────────────────────
  scene.topBar = add(scene.add.container(w / 2, 46).setDepth(92));
  scene.topBar.setScrollFactor(0);

  const topBarW = 920;
  const topBarH = 70;
  const topBg = scene.add.rectangle(0, 0, topBarW, topBarH, 0x000000, 0.38)
    .setOrigin(0.5, 0.5)
    .setStrokeStyle(2, 0xffffff, 0.08);
  scene.topBar.add(topBg);

  // Timer au centre
  scene.timerText = scene.add.text(0, -12, '0:00', {
    fontSize: '44px',
    fontFamily: FONT_UI,
    fontStyle: '600',
    color: '#ECE8E4',
    stroke: '#000000',
    strokeThickness: 10
  }).setOrigin(0.5, 0.5).setShadow(0, 4, '#000000', 14, true, false);
  scene.topBar.add(scene.timerText);

  /** Visible uniquement en BUY_PHASE : indique que le chrono central = temps d’achat */
  scene.timerPhaseCaption = scene.add.text(0, -40, 'ACHAT', {
    fontSize: '15px',
    fontFamily: FONT_UI,
    fontStyle: '600',
    color: Palette.terracotta,
    stroke: '#000000',
    strokeThickness: 5,
    letterSpacing: '0.12em'
  }).setOrigin(0.5, 0.5).setAlpha(0.92).setVisible(false);
  scene.topBar.add(scene.timerPhaseCaption);

  // Scores sous le timer (ATT à gauche, DEF à droite)
  scene.scoreAtt = scene.add.text(-34, 20, '0', {
    fontSize: '40px',
    fontFamily: FONT_UI,
    fontStyle: '600',
    color: UITheme.attString,
    stroke: UITheme.hudStroke,
    strokeThickness: 8
  }).setOrigin(0.5, 0.5).setShadow(0, 3, '#000000', 12, true, false);
  scene.topBar.add(scene.scoreAtt);

  const scoreSep = scene.add.text(0, 20, '–', {
    fontSize: '34px',
    fontFamily: FONT_UI,
    fontStyle: '600',
    color: '#E6E1DC',
    stroke: '#000000',
    strokeThickness: 7
  }).setOrigin(0.5, 0.5).setAlpha(0.85);
  scene.topBar.add(scoreSep);

  scene.scoreDef = scene.add.text(34, 20, '0', {
    fontSize: '40px',
    fontFamily: FONT_UI,
    fontStyle: '600',
    color: UITheme.defString,
    stroke: UITheme.hudStroke,
    strokeThickness: 8
  }).setOrigin(0.5, 0.5).setShadow(0, 3, '#000000', 12, true, false);
  scene.topBar.add(scene.scoreDef);

  // Avatars: rails gauche (ATT) / droite (DEF) — alignés sur les scores du bandeau
  // DOM elements (img) car on supporte data URL facilement.
  scene._topBarAvatars = { ATT: [], DEF: [] };
  scene._topBarAvatarMax = 6;

  // Killfeed en haut-droite (texte seul, sans panneau — les lignes restent lisibles avec ombre)
  scene.killFeedContainer = add(scene.add.container(w - 12, 304));
  scene.killFeedContainer.setScrollFactor(0);
  scene.killFeed = [];
  scene.commentFeed = [];

  // Quit en bas-gauche inchangé
  const quitBg = add(scene.add.rectangle(90, h - 28, 156, 36, 0x3d2820, 0.88).setDepth(100));
  const quitText = add(scene.add.text(90, h - 28, '⏹ QUITTER', {
    fontSize: '17px',
    fontFamily: 'monospace',
    color: '#E8A078'
  }).setOrigin(0.5, 0.5).setDepth(101));
  quitBg.setInteractive({ useHandCursor: true });
  quitBg.on('pointerover', () => quitBg.setFillStyle(0x5c3d30, 0.95));
  quitBg.on('pointerout', () => quitBg.setFillStyle(0x3d2820, 0.88));
  let quitClicks = 0;
  let quitTimer = null;
  quitBg.on('pointerdown', () => {
    quitClicks++;
    if (quitClicks === 1) {
      quitText.setText('⏹ CONFIRMER ?');
      quitTimer = setTimeout(() => { quitClicks = 0; quitText.setText('⏹ QUITTER'); }, 3000);
    } else if (quitClicks >= 2) {
      clearTimeout(quitTimer);
      quitClicks = 0;
      quitText.setText('⏹ RETOUR...');
      scene.socket.emit('force_lobby', (res) => {
        if (!res?.ok) {
          quitText.setText('⏹ REFUSÉ');
          setTimeout(() => quitText.setText('⏹ QUITTER'), 1200);
        }
      });
    }
  });
}

function makeAvatarDom(scene, x, y) {
  const el = document.createElement('div');
  el.style.width = '44px';
  el.style.height = '44px';
  el.style.borderRadius = '6px';
  el.style.overflow = 'hidden';
  el.style.border = '2px solid rgba(255,255,255,0.15)';
  el.style.background = 'rgba(0,0,0,0.35)';
  el.style.boxShadow = '0 8px 18px rgba(0,0,0,0.45)';
  el.style.display = 'grid';
  el.style.placeItems = 'center';
  const img = document.createElement('img');
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';
  img.alt = '';
  el.appendChild(img);
  const initials = document.createElement('div');
  initials.textContent = '?';
  initials.style.position = 'absolute';
  initials.style.inset = '0';
  initials.style.display = 'grid';
  initials.style.placeItems = 'center';
  initials.style.fontFamily = FONT_UI;
  initials.style.fontWeight = '700';
  initials.style.fontSize = '20px';
  initials.style.color = 'rgba(236,232,228,0.92)';
  initials.style.textShadow = '0 3px 10px rgba(0,0,0,0.6)';
  el.style.position = 'relative';
  el.appendChild(initials);
  const dom = scene.add.dom(x, y, el).setDepth(93);
  scene.rootScale.add(dom);
  return { dom, el, img, initials, playerId: null, team: null, isDead: false };
}

export function updateTopBarAvatars(scene, players = []) {
  if (!scene?._topBarAvatars) return;

  const att = players.filter(p => p.team === 'ATT').sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const def = players.filter(p => p.team === 'DEF').sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const max = scene._topBarAvatarMax ?? 6;
  const attList = att.slice(0, max);
  const defList = def.slice(0, max);

  const baseY = 46;
  const centerX = GAME_WIDTH / 2;
  const spacing = 52;
  const leftStartX = centerX - 380;
  const rightStartX = centerX + 380;

  const ensure = (team, i) => {
    const arr = scene._topBarAvatars[team];
    while (arr.length <= i) {
      arr.push(makeAvatarDom(scene, 0, 0));
    }
    return arr[i];
  };

  const apply = (slot, p) => {
    slot.playerId = p?.id ?? null;
    slot.team = p?.team ?? null;
    slot.isDead = !!p?.isDead;
    const avatar = p?.avatar || null;
    const name = String(p?.name || '').trim();
    const initial = (name[0] || '?').toUpperCase();
    if (avatar) {
      slot.img.src = avatar;
      slot.img.style.display = 'block';
      slot.initials.style.display = 'none';
    } else {
      slot.img.removeAttribute('src');
      slot.img.style.display = 'none';
      slot.initials.textContent = initial;
      slot.initials.style.display = 'grid';
    }
    slot.el.style.filter = slot.isDead ? 'grayscale(80%)' : 'none';
    slot.el.style.opacity = slot.isDead ? '0.6' : '0.92';
  };

  for (let i = 0; i < max; i++) {
    const p = attList[i];
    const slot = ensure('ATT', i);
    if (p) {
      const x = leftStartX + i * spacing;
      slot.dom.setPosition(x, baseY);
      slot.dom.setVisible(true);
      apply(slot, p);
    } else {
      slot.dom.setVisible(false);
    }
  }
  for (let i = 0; i < max; i++) {
    const p = defList[i];
    const slot = ensure('DEF', i);
    if (p) {
      const x = rightStartX - i * spacing;
      slot.dom.setPosition(x, baseY);
      slot.dom.setVisible(true);
      apply(slot, p);
    } else {
      slot.dom.setVisible(false);
    }
  }
}

export function onMatchEnd(scene, data) {
  const winner = data?.winner === 'ATT' ? 'ATTAQUE' : 'DÉFENSE';
  const add = (obj) => { scene.rootScale.add(obj); return obj; };
  scene.matchOverlay = add(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH + 200, GAME_HEIGHT + 200, 0x000000, 0.7).setDepth(90));
  scene.matchOverlayText = add(scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `VICTOIRE ${winner}`, {
    fontSize: '80px',
    fontFamily: 'monospace',
    color: data?.winner === 'ATT' ? UITheme.attString : UITheme.defString,
    stroke: '#0a0a0a',
    strokeThickness: 12
  }).setOrigin(0.5).setDepth(91));
}

export function onKillFeed(scene, killer, victim, weapon) {
  scene.killFeed.unshift({
    killer: sanitizeHudText(killer, 32),
    victim: sanitizeHudText(victim, 32),
    weapon: sanitizeHudText(weapon, 24)
  });
  if (scene.killFeed.length > 5) scene.killFeed.pop();
  refreshKillFeed(scene);
}

export function onPlayerComment(scene, name, text) {
  scene.commentFeed.unshift({
    name: sanitizeHudText(name, 28),
    text: sanitizeHudText(text, 72)
  });
  if (scene.commentFeed.length > 3) scene.commentFeed.pop();
  refreshCommentFeed(scene);
}

export function refreshCommentFeed(scene) {
  if (!scene._commentFeedPool) {
    scene._commentFeedPool = [];
    for (let i = 0; i < 3; i++) {
      const t = scene.add.text(0, -HUD.commentBlockTop - i * HUD.commentLineHeight, '', {
        fontSize: HUD.commentSize,
        fontFamily: FONT_UI,
        fontStyle: '400',
        color: '#B8B8B8',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(1, 1).setShadow(0, 1, '#000000', 4, true, false);
      scene.killFeedContainer.add(t);
      scene._commentFeedPool.push(t);
    }
  }
  scene._commentFeedPool.forEach((t, i) => {
    const entry = scene.commentFeed[i];
    t.setText(entry ? `${entry.name}: ${entry.text}` : '');
    t.setY(-HUD.commentBlockTop - i * HUD.commentLineHeight);
  });
}

export function refreshKillFeed(scene) {
  if (!scene._killFeedPool) {
    scene._killFeedPool = [];
    for (let i = 0; i < 5; i++) {
      const t = scene.add.text(0, -HUD.killBottomPad - i * HUD.killLineHeight, '', {
        fontSize: HUD.killSize,
        fontFamily: FONT_UI,
        fontStyle: '600',
        color: '#f2f4f8',
        stroke: '#000000',
        strokeThickness: 5
      }).setOrigin(1, 1).setShadow(0, 2, '#000000', 8, true, false);
      scene.killFeedContainer.add(t);
      scene._killFeedPool.push(t);
    }
  }
  scene._killFeedPool.forEach((t, i) => {
    const entry = scene.killFeed[i];
    t.setText(entry ? `${entry.killer} [${entry.weapon}] ${entry.victim}` : '');
    t.setY(-HUD.killBottomPad - i * HUD.killLineHeight);
  });
}
