/**
 * Contrôleur : écran de jeu (joysticks, boutons d'action, HUD, shop, bouton contextuel)
 * Reçoit game_phase, ui_update, context_update et envoie input_move, input_aim, input_action, shop_buy
 */
import nipplejs from 'nipplejs';
import { setupDisconnectOverlay } from './connectionUi.js';
import { getStoredSession, saveSession, clearStoredSession } from '../../utils/session.js';

// ── Service audio synthétique (Web Audio API — aucun fichier externe) ────────
const _audio = (() => {
  let ctx = null;
  const gc = () => {
    if (!ctx) try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    return ctx;
  };
  const tone = (freq, dur, type = 'sine', gain = 0.22) => {
    const c = gc(); if (!c) return;
    const osc = c.createOscillator(), g = c.createGain();
    osc.connect(g); g.connect(c.destination);
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.start(c.currentTime); osc.stop(c.currentTime + dur + 0.01);
  };
  return {
    hitConfirm()      { tone(880, 0.07, 'square', 0.1); },
    killConfirm()     { tone(440, 0.1, 'sine', 0.2); setTimeout(() => tone(660, 0.12, 'sine', 0.16), 65); },
    reload()          { tone(220, 0.09, 'triangle', 0.1); },
    buy()             { tone(660, 0.1, 'sine', 0.12); },
    death()           { tone(180, 0.4, 'sawtooth', 0.14); },
    countdown(n)      { tone(n === 0 ? 1100 : 440, 0.12, 'sine', n === 0 ? 0.32 : 0.18); },
    readyToggle(on)   { tone(on ? 550 : 330, 0.1, 'sine', 0.15); },
    victory()         { [0,150,300].forEach(d => setTimeout(() => tone(880 + d*2, 0.18, 'sine', 0.2), d)); },
    defeat()          { tone(220, 0.5, 'sawtooth', 0.15); },
  };
})();

/** Aligné sur server/models/Weapon.js (id, nom affiché, prix). */
const SHOP_WEAPONS = [
  { id: 'PISTOL', name: 'Pistolet', price: 0 },
  { id: 'SMG', name: 'SMG', price: 1500 },
  { id: 'RIFLE', name: 'Fusil', price: 2900 },
  { id: 'SNIPER', name: 'Sniper', price: 4500 },
  { id: 'SHOTGUN', name: 'Shotgun', price: 2000 }
];

/**
 * Roster des héros (Battlefront-style) — doit rester aligné sur server/models/Heroes.js
 * (ids, noms, coûts, couleurs) pour que l’UI mobile reflète la vérité serveur.
 */
const HEROES_ROSTER = [
  { id: 'gojo', name: 'Satoru Gojo', cost: 2000, color: '#4FC3F7' },
  { id: 'sukuna', name: 'Sukuna', cost: 2200, color: '#F06292' },
  { id: 'yuta', name: 'Yuta Okkotsu', cost: 2500, color: '#9E9E9E' },
  { id: 'ichigo', name: 'Ichigo Kurosaki', cost: 2300, color: '#9C27B0' },
  { id: 'toji', name: 'Toji Fushiguro', cost: 1800, color: '#A5D6A7' },
  { id: 'jotaro', name: 'Jotaro', cost: 1900, color: '#90CAF9' },
  { id: 'dio', name: 'Dio', cost: 2200, color: '#FFEE58' },
  { id: 'naruto', name: 'Naruto', cost: 1800, color: '#FFB74D' },
  { id: 'itachi', name: 'Itachi', cost: 2000, color: '#CE93D8' },
  { id: 'goku', name: 'Goku', cost: 2500, color: '#FF8A65' }
];

const healthEl = document.getElementById('health');
const ammoEl = document.getElementById('ammo');
const ammoReserveEl = document.getElementById('ammo-reserve');
const moneyEl = document.getElementById('money');
const statusEl = document.getElementById('status');
const powerupToastEl = document.getElementById('powerup-toast');
const shopOverlay = document.getElementById('shop-overlay');
const shopMoneyEl = document.getElementById('shop-money');
const shopWeaponsEl = document.getElementById('shop-weapons');
const actionBtn = document.getElementById('action-btn');
const actionRingEl = document.getElementById('action-progress-ring');
const actionRingFgEl = document.getElementById('action-progress-fg');
const heroRosterEl = document.getElementById('hero-roster');
const heroGridEl = document.getElementById('hero-grid');
const heroSelectionHintEl = document.getElementById('hero-selection-hint');
const heroPowerBtn  = document.getElementById('hero-power-btn');
const heroPowerBBtn = document.getElementById('hero-power-b-btn');
const mobileTopbarRoot = document.getElementById('mobile-topbar');
const topbarTimerEl = document.getElementById('mobile-topbar-timer');
const topbarScoreDefEl = document.getElementById('mobile-topbar-score-def');
const topbarScoreAttEl = document.getElementById('mobile-topbar-score-att');
const topbarAttEl = document.getElementById('mobile-topbar-att');
const topbarDefEl = document.getElementById('mobile-topbar-def');

let leftStick = null;
let rightStick = null;
let currentContext = {
  canPlant: false,
  canDefuse: false,
  needReload: false,
  inDomain: false,
  domainInterior: null
};
let currentMoney = 800;
let powerupToastTimer = null;
let currentWeapon = 'PISTOL';
let contextPollInterval = null;
let lockedHeroes = {};
let _phaseTimerInterval = null;
let _pingInterval = null;
let _pingSentAt = 0;
let _isReady = false;

let _hudStateCache = null;

function _fmtClock(sec) {
  const t = Math.max(0, Math.ceil(Number(sec) || 0));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function _setMobileTopbarFromHudState(hs) {
  if (!hs) return;
  if (mobileTopbarRoot?.classList.contains('hidden')) return;
  if (topbarScoreDefEl) topbarScoreDefEl.textContent = String(hs.scores?.DEF ?? 0);
  if (topbarScoreAttEl) topbarScoreAttEl.textContent = String(hs.scores?.ATT ?? 0);
  const showActionTimer = hs.roundState === 'ACTION_PHASE';
  if (topbarTimerEl) topbarTimerEl.textContent = showActionTimer ? _fmtClock(hs.roundTime) : '';

  const players = Array.isArray(hs.players) ? hs.players : [];
  const att = players.filter(p => p.team === 'ATT').sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, 6);
  const def = players.filter(p => p.team === 'DEF').sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, 6);

  const render = (rootEl, list) => {
    if (!rootEl) return;
    rootEl.innerHTML = '';
    for (const p of list) {
      const wrap = document.createElement('div');
      wrap.className = `mobile-topbar-avatar${p.isDead ? ' is-dead' : ''}`;
      const img = document.createElement('img');
      img.alt = '';
      if (p.avatar) img.src = p.avatar;
      wrap.appendChild(img);
      rootEl.appendChild(wrap);
    }
  };
  render(topbarAttEl, att);
  render(topbarDefEl, def);
}

let _bombAction = null; // { type, startedAt, durationMs }
let _bombActionRaf = null;

function _setActionRingProgress(p01) {
  if (!actionRingEl || !actionRingFgEl) return;
  const p = Math.max(0, Math.min(1, Number(p01) || 0));
  const r = 18;
  const C = 2 * Math.PI * r;
  actionRingFgEl.style.strokeDasharray = `${Math.round(C * p)} ${Math.round(C)}`;
}

function _stopBombActionUi() {
  _bombAction = null;
  if (_bombActionRaf) { cancelAnimationFrame(_bombActionRaf); _bombActionRaf = null; }
  if (actionRingEl) actionRingEl.classList.add('hidden');
  if (actionBtn) actionBtn.classList.remove('is-interacting');
  _setActionRingProgress(0);
}

function _startBombActionUi(type, durationMs) {
  _bombAction = { type, startedAt: performance.now(), durationMs: Math.max(1, Number(durationMs) || 1) };
  if (actionRingEl) actionRingEl.classList.remove('hidden');
  if (actionBtn) actionBtn.classList.add('is-interacting');
  const tick = () => {
    if (!_bombAction) return;
    const t = (performance.now() - _bombAction.startedAt) / _bombAction.durationMs;
    _setActionRingProgress(t);
    if (t < 1) _bombActionRaf = requestAnimationFrame(tick);
  };
  if (_bombActionRaf) cancelAnimationFrame(_bombActionRaf);
  _bombActionRaf = requestAnimationFrame(tick);
}

const mobileLobbyEl = document.getElementById('mobile-lobby');
const mobileLobbySettingsEl = document.getElementById('mobile-lobby-settings');
const mobileLobbyPlayerCountEl = document.getElementById('mobile-lobby-player-count');
const mobileQuitBtn = document.getElementById('mobile-quit-btn');
const hudHealthBarEl = document.getElementById('hud-health-bar');

// Références écran de connexion (retour après session_ended)
const _joinScreen  = document.getElementById('join-screen');
const _gameScreen  = document.getElementById('game-screen');
const _joinStatusEl = document.getElementById('join-status');

/** Ordre des cartes lobby (ids = serveur MAP_LIST + random) */
const MAP_VOTE_IDS = ['dist2', 'ascension', 'maven', 'chadigo', 'random'];

function getLobbyMapVoteCards() {
  return document.querySelectorAll('#mobile-lobby .map-vote-list .map-card[data-mapid]');
}

let isHost = false;
let currentRoundState = 'LOBBY';
let myHeroId = null;
let myMapVote = null; // mapId pour lequel ce joueur a voté
/** Derniers compteurs reçus du serveur (pour rafraîchir l’UI sans tout remettre à 0 au tap) */
let _lobbyVoteCountsCache = {};

// Héros avec pouvoir B défini (tous les ids du roster actuel)
const HEROES_WITH_B_POWER = new Set(HEROES_ROSTER.map((h) => h.id));

const POWERUP_LABELS = {
  heal:      '❤️ +40 HP',
  speed:     '⚡ SPEED x1.5',
  damage:    '🔥 DAMAGE x1.5',
  shield:    '🛡️ SHIELD +50',
  multishot: '🔫 MULTISHOT',
  ricochet:  '💥 RICOCHET',
  ghost:     '👻 GHOST',
  magnet:    '🧲 MAGNET'
};

function showPowerupToast(type) {
  if (!powerupToastEl) return;
  if (powerupToastTimer) clearTimeout(powerupToastTimer);
  const label = POWERUP_LABELS[type] || `✨ ${type.toUpperCase()}`;
  powerupToastEl.textContent = label;
  powerupToastEl.dataset.type = type;
  powerupToastEl.classList.remove('hidden');
  if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
  powerupToastTimer = setTimeout(() => {
    powerupToastEl.classList.add('hidden');
    powerupToastTimer = null;
  }, 2500);
}

function updateUI(data) {
  if (data.health !== undefined && healthEl) {
    const hp = Math.max(0, data.health);
    healthEl.textContent = hp;
    // Barre de vie : rouge sous 30%, jaune sous 60%, vert sinon
    if (hudHealthBarEl) {
      const pct = Math.min(100, hp);
      hudHealthBarEl.style.width = `${pct}%`;
      hudHealthBarEl.style.background =
        hp <= 30 ? 'linear-gradient(90deg,#ff2222,#cc0000)' :
        hp <= 60 ? 'linear-gradient(90deg,#ffcc00,#ff9900)' :
                   'linear-gradient(90deg,#00ff88,#00cc66)';
    }
  }
  if (data.ammo !== undefined && ammoEl) ammoEl.textContent = data.ammo;
  if (data.ammoReserve !== undefined && ammoReserveEl) ammoReserveEl.textContent = data.ammoReserve;
  if (data.money !== undefined) {
    currentMoney = data.money;
    if (moneyEl) moneyEl.textContent = data.money;
    if (shopMoneyEl) shopMoneyEl.textContent = data.money;
    updateHeroRosterUI(); // recalcule l'abordabilité des héros
  }
  if (data.currentWeapon !== undefined) currentWeapon = data.currentWeapon;
  if (data.isDead !== undefined && statusEl) {
    statusEl.textContent = data.isDead ? 'MORT - Prochain round' : '';
  }
  if (data.powerUpCollected) {
    showPowerupToast(data.powerUpCollected);
  }
  refreshShopButtons();
}

function refreshHeroPowerButtons() {
  const hasHero = !!myHeroId;
  if (heroPowerBtn) heroPowerBtn.classList.toggle('hidden', !hasHero);
  const hasBPower = hasHero && HEROES_WITH_B_POWER.has(myHeroId);
  if (heroPowerBBtn) heroPowerBBtn.classList.toggle('hidden', !hasBPower);
  if (heroPowerBtn && myHeroId) {
    const heroName = myHeroId.charAt(0).toUpperCase() + myHeroId.slice(1);
    heroPowerBtn.textContent = `${heroName.toUpperCase()} A`;
    if (hasBPower) heroPowerBBtn.textContent = `${heroName.toUpperCase()} B`;
  } else if (heroPowerBtn) {
    heroPowerBtn.textContent = 'POUVOIR A';
  }
}

function refreshShopButtons() {
  const btns = shopWeaponsEl?.querySelectorAll('.shop-weapon-btn');
  btns?.forEach((btn) => {
    const weaponId = btn.dataset.weaponId;
    const price = Number(btn.dataset.price);
    const name = btn.dataset.name || weaponId;
    const isEquipped = weaponId === currentWeapon;
    if (isEquipped) {
      btn.textContent = `REVENDRE (+$${price})`;
      btn.disabled = false;
      btn.classList.remove('disabled');
      btn.classList.add('equipped');
    } else {
      btn.textContent = `${name} ($${price})`;
      btn.disabled = price > currentMoney;
      btn.classList.toggle('disabled', price > currentMoney);
      btn.classList.remove('equipped');
    }
  });
}

function initJoysticks(socket) {
  const leftZone = document.getElementById('joystick-left');
  const rightZone = document.getElementById('joystick-right');
  if (!leftZone || !rightZone) return;

  leftStick?.destroy?.();
  rightStick?.destroy?.();

  leftStick = nipplejs.create({
    zone: leftZone,
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: '#00ffff',
    size: 120,
    threshold: 0.05,
    lockX: false,
    lockY: false
  });

  const DEADZONE_PX = 6;
  const MAX_DIST_PX = 55; // zone 150px → rayon ~75, on vise ~55 pour force max

  leftStick.on('start', () => {
    if (socket?.connected) socket.emit('input_move', { angle: 0, force: 0 });
  });

  leftStick.on('move', (evt, data) => {
    if (!socket?.connected) return;
    const dist = Number(data?.distance ?? 0);
    if (!Number.isFinite(dist) || dist < DEADZONE_PX) {
      socket.emit('input_move', { angle: 0, force: 0 });
      return;
    }
    const vx = Number(data?.vector?.x ?? 0);
    const vy = Number(data?.vector?.y ?? 0);
    /**
     * nipplejs : vector.y > 0 = stick vers le haut (écran).
     * Serveur : vy = sin(angle) avec y monde qui augmente vers le bas (comme Phaser).
     * atan2(vy, vx) mélange les deux repères → diagonales « haut* » deviennent « bas* » ; on inverse Y.
     */
    const angle = Math.atan2(-vy, vx);
    const force = Math.max(0, Math.min(1, dist / MAX_DIST_PX));
    socket.emit('input_move', { angle: Number.isFinite(angle) ? angle : 0, force });
  });

  leftStick.on('end', () => {
    if (socket?.connected) socket.emit('input_move', { angle: 0, force: 0 });
  });

  rightStick = nipplejs.create({
    zone: rightZone,
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: '#ff4500',
    size: 120,
    threshold: 0.05,
    lockX: false,
    lockY: false
  });

  // Visée : même atan2 que le déplacement (arme orientée « vers la droite » à rot=0 côté display).
  rightStick.on('move', (evt, data) => {
    if (!socket?.connected) return;
    const vx = Number(data?.vector?.x ?? 0);
    const vy = Number(data?.vector?.y ?? 0);
    if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) return;
    const angle = Math.atan2(-vy, vx);
    socket.emit('input_aim', { angle: Number.isFinite(angle) ? angle : 0 });
  });
}

/** Met à jour les cartes de vote du lobby (vote actif, en tête, compteurs) */
function syncLobbyMapCards(voteCounts) {
  if (voteCounts != null && typeof voteCounts === 'object') {
    _lobbyVoteCountsCache = { ...voteCounts };
  }
  const counts =
    _lobbyVoteCountsCache != null && typeof _lobbyVoteCountsCache === 'object'
      ? _lobbyVoteCountsCache
      : {};

  const cards = MAP_VOTE_IDS.map((id) => ({
    id,
    el: document.querySelector(`#mobile-lobby .map-card[data-mapid="${id}"]`),
    countEl: document.getElementById(`vote-count-${id}`)
  }));

  let maxVotes = 0;
  let leadingId = null;
  cards.forEach(({ id }) => {
    const n = counts[id] ?? 0;
    if (n > maxVotes) { maxVotes = n; leadingId = id; }
  });

  cards.forEach(({ el, id, countEl }) => {
    if (!el) return;
    const n = counts[id] ?? 0;
    if (countEl) countEl.textContent = String(n);
    el.classList.toggle('voted', id === myMapVote);
    el.classList.toggle('leading', id === leadingId && maxVotes > 0);
  });
}

function setShopVisible(visible) {
  if (shopOverlay) shopOverlay.classList.toggle('hidden', !visible);
  if (heroRosterEl) heroRosterEl.classList.toggle('hidden', !visible);
}

function buildShopWeapons(socket) {
  if (!shopWeaponsEl) return;
  shopWeaponsEl.innerHTML = '';
  for (const w of SHOP_WEAPONS) {
    const btn = document.createElement('button');
    btn.className = 'shop-weapon-btn';
    btn.dataset.weaponId = w.id;
    btn.dataset.price = w.price;
    btn.dataset.name = w.name;
    btn.textContent = `${w.name} ($${w.price})`;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const equipped = w.id === currentWeapon;
      if (!equipped && w.price > currentMoney) return;
      _audio.buy();
      socket?.emit('shop_buy', { weaponId: w.id });
    }, { passive: false });
    shopWeaponsEl.appendChild(btn);
  }
  refreshShopButtons();
}

function initCommentBar(socket) {
  const dock = document.getElementById('mobile-chat-dock');
  const bar = document.getElementById('comment-bar');
  const input = document.getElementById('comment-input');
  const sendBtn = document.getElementById('comment-send');
  const toggle = document.getElementById('comment-chat-toggle');
  const gameScreen = document.getElementById('game-screen');
  if (!input || !sendBtn || !dock || !bar || !toggle || !gameScreen) return;

  const closeCommentBar = () => {
    bar.classList.add('comment-bar--collapsed');
    bar.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    dock.classList.remove('comment-chat-expanded');
    input.blur();
  };

  const openCommentBar = () => {
    bar.classList.remove('comment-bar--collapsed');
    bar.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    dock.classList.add('comment-chat-expanded');
    requestAnimationFrame(() => {
      try { input.focus(); } catch (_) { /* ignore */ }
    });
  };

  const isExpanded = () => !bar.classList.contains('comment-bar--collapsed');

  toggle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  }, { passive: true });
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isExpanded()) closeCommentBar();
    else openCommentBar();
  });

  /** Fermeture au tap hors dock (phase capture : avant les joysticks / boutons). */
  const onGamePointerDown = (e) => {
    if (!isExpanded()) return;
    if (dock.contains(e.target)) return;
    closeCommentBar();
  };
  gameScreen.addEventListener('pointerdown', onGamePointerDown, true);

  const send = () => {
    const text = (input.value || '').trim();
    if (!text || !socket?.connected) return;
    socket.emit('player_comment', { text: text.slice(0, 60) });
    input.value = '';
    closeCommentBar();
  };

  sendBtn.addEventListener('pointerdown', (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    send();
  }, { passive: false });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  });
}

function buildHeroRoster(socket) {
  if (!heroGridEl) return;
  heroGridEl.innerHTML = '';
  HEROES_ROSTER.forEach((hero) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'hero-card';
    card.dataset.heroId = hero.id;
    card.style.borderColor = hero.color;
    card.style.boxShadow = `0 0 16px ${hero.color}55`;
    card.style.backgroundImage = `linear-gradient(135deg, ${hero.color}22, #050510)`;

    const title = document.createElement('div');
    title.className = 'hero-card-title';
    title.textContent = hero.name;

    const cost = document.createElement('div');
    cost.className = 'hero-card-cost';
    cost.textContent = `$${hero.cost}`;

    card.appendChild(title);
    card.appendChild(cost);
    card.setAttribute('aria-label', `${hero.name}, ${hero.cost} dollars`);

    card.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (card.classList.contains('disabled')) return;
      if (currentMoney < hero.cost) return;
      socket?.emit('hero_select', { heroId: hero.id });
    }, { passive: false });

    heroGridEl.appendChild(card);
  });
  updateHeroRosterUI();
}

function updateHeroRosterUI() {
  if (!heroGridEl) return;
  const cards = heroGridEl.querySelectorAll('.hero-card');
  cards.forEach((card) => {
    const heroId = card.dataset.heroId;
    const hero = HEROES_ROSTER.find((h) => h.id === heroId);
    const isLocked = !!lockedHeroes[heroId];
    const tooExpensive = hero && hero.cost > currentMoney;
    // .locked = héros pris par quelqu'un (affiche "PRIS")
    card.classList.toggle('locked', isLocked);
    // .disabled = grisé (trop cher ou pris) mais sans texte "PRIS"
    card.classList.toggle('disabled', isLocked || tooExpensive);
    const isMine = myHeroId === heroId;
    card.classList.toggle('hero-card--selected', isMine);
    card.setAttribute('aria-pressed', isMine ? 'true' : 'false');
  });
  if (heroSelectionHintEl) {
    const sel = myHeroId && HEROES_ROSTER.find((h) => h.id === myHeroId);
    if (sel) {
      heroSelectionHintEl.textContent =
        `Héros actif : ${sel.name} — touchez une autre carte pour changer si disponible.`;
      heroSelectionHintEl.classList.add('hero-selection-hint--ok');
    } else {
      heroSelectionHintEl.textContent =
        'Touchez une carte (nom + prix). Grisé = trop cher ou déjà pris par un joueur.';
      heroSelectionHintEl.classList.remove('hero-selection-hint--ok');
    }
  }
}

function updateActionButton() {
  if (!actionBtn) return;
  if (currentContext.canDefuse) {
    actionBtn.textContent = 'DEFUSE';
    actionBtn.dataset.action = 'DEFUSE';
  } else if (currentContext.canPlant) {
    actionBtn.textContent = 'PLANT';
    actionBtn.dataset.action = 'PLANT';
  } else if (currentContext.needReload) {
    actionBtn.textContent = 'RELOAD';
    actionBtn.dataset.action = 'RELOAD';
  } else {
    actionBtn.textContent = '—';
    actionBtn.dataset.action = '';
  }
}

function initButtons(socket) {
  const shootBtn = document.getElementById('btn-shoot');
  shootBtn?.addEventListener('pointerdown', (e) => {
    e?.preventDefault();
    socket?.emit('input_action', { type: 'SHOOT', data: {} });
  }, { passive: false });

  actionBtn?.addEventListener('pointerdown', (e) => {
    e?.preventDefault();
    const action = actionBtn?.dataset.action;
    if (action) socket?.emit('input_action', { type: action, data: {} });
  }, { passive: false });

  heroPowerBtn?.addEventListener('pointerdown', (e) => {
    e?.preventDefault();
    socket?.emit('input_action', { type: 'HERO_POWER', data: {} });
  }, { passive: false });

  heroPowerBBtn?.addEventListener('pointerdown', (e) => {
    e?.preventDefault();
    socket?.emit('input_action', { type: 'HERO_POWER_B', data: {} });
  }, { passive: false });

  buildShopWeapons(socket);

  // Vote de map — cartes lobby (miniatures + compteurs)
  getLobbyMapVoteCards().forEach((card) => {
    card.addEventListener('pointerdown', (e) => {
      e?.preventDefault();
      const mapId = card.dataset.mapid;
      if (!mapId) return;
      socket?.emit('vote_map', { mapId });
      myMapVote = mapId;
      syncLobbyMapCards({});
    }, { passive: false });
  });

}

function setupSocketListeners(socket) {
  if (!socket) return;
  socket.on('haptic', (payload) => {
    if (typeof navigator.vibrate !== 'function') return;
    if (payload && Array.isArray(payload.pattern)) {
      navigator.vibrate(payload.pattern);
    } else {
      const d = payload?.duration ?? 50;
      navigator.vibrate(d);
    }
  });

  // ── Bombe : pose/défuse temporisés (UI cercle) ──────────────────────────────
  socket.on('bomb_action', (payload = {}) => {
    const state = payload?.state;
    if (state === 'start') {
      _startBombActionUi(payload?.type, payload?.durationMs);
      return;
    }
    if (state === 'progress') {
      if (payload?.progress !== undefined) _setActionRingProgress(payload.progress);
      return;
    }
    if (state === 'complete') {
      _stopBombActionUi();
      return;
    }
    if (state === 'cancel') {
      _stopBombActionUi();
    }
  });

  // HUD global (timer/score/avatars) — envoyé en continu par le serveur (léger).
  socket.on('hud_state', (hs) => {
    _hudStateCache = hs || null;
    _setMobileTopbarFromHudState(_hudStateCache);
  });

  // Mise à jour du sessionId sauvegardé (confirmé par le serveur après rejoin)
  socket.on('session_confirmed', ({ sessionId }) => {
    const saved = getStoredSession();
    if (saved && sessionId) saveSession(sessionId, saved.name, saved.team ?? 'LOBBY', saved.avatarDataUrl ?? null);
  });

  // Fin de session : display hôte parti ou partie terminée → retour à l'écran de connexion
  socket.on('session_ended', ({ reason } = {}) => {
    clearStoredSession();

    // Arrêter les joysticks et les intervalles actifs
    leftStick?.destroy?.();
    rightStick?.destroy?.();
    leftStick  = null;
    rightStick = null;
    if (contextPollInterval) { clearInterval(contextPollInterval); contextPollInterval = null; }
    if (_phaseTimerInterval)  { clearInterval(_phaseTimerInterval); _phaseTimerInterval = null; }
    if (_pingInterval)        { clearInterval(_pingInterval); _pingInterval = null; }

    // Réinitialiser les variables d'état pour une prochaine connexion propre
    currentRoundState = 'LOBBY';
    isHost            = false;
    myHeroId          = null;
    myMapVote = null;
    _lobbyVoteCountsCache = {};
    currentMoney      = 800;
    currentWeapon     = 'PISTOL';
    currentContext    = { canPlant: false, canDefuse: false, needReload: false };
    lockedHeroes      = {};
    _stopBombActionUi();

    const msg =
      reason === 'kicked'
        ? "Vous avez été exclu par l'hôte. Vous pouvez rejoindre à nouveau."
        : reason === 'display_left'
          ? "L'hôte (grand écran) a quitté la session."
          : 'La partie est terminée.';
    if (_joinStatusEl) _joinStatusEl.textContent = msg;

    _gameScreen?.classList.add('hidden');
    _joinScreen?.classList.remove('hidden');
 
    // Réactiver le formulaire de join au cas où un état \"waiting\" serait resté (UX).
    const joinBtn = document.getElementById('join-btn');
    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.classList.remove('join-btn--waiting');
    }
    try {
      window.dispatchEvent(new CustomEvent('zs:session_ended', { detail: { reason } }));
    } catch { /* ignore */ }

    // Supprimer tous les listeners et fermer le socket proprement
    socket.off();
    socket.disconnect();
  });

  // Rejoin automatique après reconnexion réseau (socket.io gère la reconnexion,
  // mais le serveur perd le joueur → il faut se ré-enregistrer avec le sessionId)
  socket.on('connect', () => {
    const saved = getStoredSession();
    if (!saved?.sessionId) return;
    socket.emit('join_game', {
      name: saved.name,
      sessionId: saved.sessionId,
      avatarDataUrl: saved.avatarDataUrl ?? null
    });
  });

  // ── Kill confirmation ────────────────────────────────────────────────────────
  const killToastEl = document.getElementById('kill-toast');
  let _killToastTimer = null;
  socket.on('kill_confirmed', ({ victimName } = {}) => {
    _audio.killConfirm();
    if (!killToastEl) return;
    if (_killToastTimer) clearTimeout(_killToastTimer);
    killToastEl.textContent = `☠ ${victimName}`;
    killToastEl.classList.remove('hidden', 'toast-show');
    void killToastEl.offsetWidth;
    killToastEl.classList.add('toast-show');
    _killToastTimer = setTimeout(() => {
      killToastEl.classList.add('hidden');
      _killToastTimer = null;
    }, 1700);
  });

  // ── Countdown 3-2-1 avant partie ─────────────────────────────────────────────
  const countdownOverlayEl = document.getElementById('countdown-overlay');
  const countdownNumberEl  = document.getElementById('countdown-number');
  let _countdownHideTimer = null;
  socket.on('countdown', (n) => {
    _audio.countdown(n);
    if (!countdownOverlayEl || !countdownNumberEl) return;
    if (_countdownHideTimer) { clearTimeout(_countdownHideTimer); _countdownHideTimer = null; }
    if (n > 0) {
      countdownNumberEl.textContent = String(n);
      countdownNumberEl.classList.remove('go');
      countdownOverlayEl.classList.remove('hidden');
    } else {
      countdownNumberEl.textContent = 'GO !';
      countdownNumberEl.classList.add('go');
      _countdownHideTimer = setTimeout(() => {
        countdownOverlayEl.classList.add('hidden');
        _countdownHideTimer = null;
      }, 900);
    }
  });

  // ── Fin de match ─────────────────────────────────────────────────────────────
  const matchEndOverlayEl  = document.getElementById('match-end-overlay');
  const matchEndResultEl   = document.getElementById('match-end-result');
  const matchEndScoresEl   = document.getElementById('match-end-scores');
  const matchEndBodyEl     = document.getElementById('match-end-body');
  socket.on('match_end', ({ winner, scores, scoreboard } = {}) => {
    const myT = getStoredSession()?.team;
    const isMyTeam = (myT === 'ATT' || myT === 'DEF') && winner === myT;
    if (isMyTeam) _audio.victory(); else _audio.defeat();
    if (matchEndResultEl) {
      const label = winner === 'DEF' ? '🛡 VICTOIRE DÉFENSE' : '⚔ VICTOIRE ATTAQUE';
      matchEndResultEl.textContent = label;
      matchEndResultEl.dataset.team = (winner || 'def').toLowerCase();
    }
    if (matchEndScoresEl) matchEndScoresEl.textContent = `${scores?.DEF ?? 0} – ${scores?.ATT ?? 0}`;
    if (matchEndBodyEl && Array.isArray(scoreboard)) {
      matchEndBodyEl.innerHTML = '';
      const hdr = document.createElement('div');
      hdr.className = 'sb-row sb-header';
      hdr.innerHTML = '<span>JOUEUR</span><span>K</span><span>M</span>';
      matchEndBodyEl.appendChild(hdr);
      for (const row of scoreboard) {
        const div = document.createElement('div');
        div.className = `sb-row sb-${(row.team||'def').toLowerCase()}`;
        const n = document.createElement('span'); n.className = 'sb-name'; n.textContent = row.name || '???';
        const k = document.createElement('span'); k.className = 'sb-kills'; k.textContent = row.kills ?? 0;
        const d = document.createElement('span'); d.className = 'sb-deaths'; d.textContent = row.deaths ?? 0;
        div.append(n, k, d); matchEndBodyEl.appendChild(div);
      }
    }
    matchEndOverlayEl?.classList.remove('hidden');
  });

  // ── Système Prêt (lobby) ──────────────────────────────────────────────────────
  const readyBtnEl      = document.getElementById('ready-btn');
  const readyCountEl    = document.getElementById('ready-count-text');
  const readyStatusEl   = document.getElementById('ready-status');
  readyBtnEl?.addEventListener('pointerdown', (e) => {
    e?.preventDefault();
    _isReady = !_isReady;
    _audio.readyToggle(_isReady);
    readyBtnEl.classList.toggle('is-ready', _isReady);
    socket.emit('player_ready', { ready: _isReady });
  }, { passive: false });
  socket.on('ready_update', ({ ready, total, allReady } = {}) => {
    if (readyCountEl) readyCountEl.textContent = `${ready} / ${total} prêts`;
    if (readyStatusEl) readyStatusEl.classList.toggle('all-ready', !!allReady);
    if (readyCountEl && allReady) {
      readyCountEl.textContent = 'Tous prêts — lancez sur le grand écran';
    }
  });

  // ── Ping / latence ────────────────────────────────────────────────────────────
  const pingEl = document.getElementById('hud-ping');
  if (_pingInterval) clearInterval(_pingInterval);
  const doPing = () => { _pingSentAt = Date.now(); socket.emit('ping'); };
  socket.on('pong', () => {
    const ms = Date.now() - _pingSentAt;
    if (pingEl) {
      pingEl.textContent = `${ms}ms`;
      pingEl.style.color = ms < 60 ? '#00ff88' : ms < 130 ? '#ffcc00' : '#ff4444';
    }
  });
  _pingInterval = setInterval(doPing, 4000);
  setTimeout(doPing, 1000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) socket.emit('get_context');
  });

  // ── Flash dégâts reçus ──────────────────────────────────────────────────────
  const damageFlashEl = document.getElementById('damage-flash');
  socket.on('damage_received', ({ angle } = {}) => {
    if (!damageFlashEl) return;
    // Positionner le gradient du côté d'où vient le tir
    const px = (angle !== null && angle !== undefined) ? Math.round(50 + Math.cos(angle) * 72) : 50;
    const py = (angle !== null && angle !== undefined) ? Math.round(50 + Math.sin(angle) * 72) : 50;
    damageFlashEl.style.background = [
      `radial-gradient(ellipse at ${px}% ${py}%, rgba(220,0,0,0.78), transparent 58%)`,
      `radial-gradient(ellipse at center, transparent 45%, rgba(170,0,0,0.42) 100%)`
    ].join(',');
    damageFlashEl.classList.remove('flash-active');
    void damageFlashEl.offsetWidth; // force reflow pour relancer l'animation
    damageFlashEl.classList.add('flash-active');
  });

  // ── Écran de mort ────────────────────────────────────────────────────────────
  const deathOverlayEl      = document.getElementById('death-overlay');
  const deathKillerEl       = document.getElementById('death-killer-name');
  const deathWeaponEl       = document.getElementById('death-weapon-label');
  const deathRespawnTextEl  = document.getElementById('death-respawn-text');
  let _respawnCountdown = null;

  socket.on('you_died', ({ killerName, weaponName, respawnMs } = {}) => {
    _audio.death();
    if (deathKillerEl)      deathKillerEl.textContent  = killerName  || '???';
    if (deathWeaponEl)      deathWeaponEl.textContent  = weaponName  || '???';

    if (_respawnCountdown) { clearInterval(_respawnCountdown); _respawnCountdown = null; }

    if (respawnMs) {
      let remaining = Math.ceil(respawnMs / 1000);
      if (deathRespawnTextEl) deathRespawnTextEl.textContent = `Respawn dans ${remaining}s`;
      _respawnCountdown = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(_respawnCountdown);
          _respawnCountdown = null;
          if (deathRespawnTextEl) deathRespawnTextEl.textContent = 'Respawn…';
        } else {
          if (deathRespawnTextEl) deathRespawnTextEl.textContent = `Respawn dans ${remaining}s`;
        }
      }, 1000);
    } else {
      if (deathRespawnTextEl) deathRespawnTextEl.textContent = 'PROCHAIN ROUND';
    }

    deathOverlayEl?.classList.remove('hidden');
    deathOverlayEl?.setAttribute('aria-hidden', 'false');
  });

  // ── Scoreboard post-manche ──────────────────────────────────────────────────
  const scoreboardOverlayEl  = document.getElementById('scoreboard-overlay');
  const scoreboardWinnerEl   = document.getElementById('scoreboard-winner-banner');
  const scoreboardScoresEl   = document.getElementById('scoreboard-scores-line');
  const scoreboardBodyEl     = document.getElementById('scoreboard-body');

  socket.on('round_summary', ({ winner, scores, scoreboard } = {}) => {
    if (scoreboardWinnerEl) {
      scoreboardWinnerEl.textContent = winner === 'DEF' ? '🛡 VICTOIRE DÉFENSE' : '⚔ VICTOIRE ATTAQUE';
      scoreboardWinnerEl.dataset.team = (winner || 'def').toLowerCase();
    }
    if (scoreboardScoresEl) {
      scoreboardScoresEl.textContent = `${scores?.DEF ?? 0} – ${scores?.ATT ?? 0}`;
    }
    if (scoreboardBodyEl && Array.isArray(scoreboard)) {
      scoreboardBodyEl.innerHTML = '';
      const header = document.createElement('div');
      header.className = 'sb-row sb-header';
      header.innerHTML = '<span>JOUEUR</span><span>K</span><span>M</span>';
      scoreboardBodyEl.appendChild(header);
      for (const row of scoreboard) {
        const div = document.createElement('div');
        div.className = `sb-row sb-${(row.team || 'def').toLowerCase()}`;
        const nameSpan   = document.createElement('span');
        nameSpan.className = 'sb-name';
        nameSpan.textContent = row.name || '???';
        const killsSpan  = document.createElement('span');
        killsSpan.className = 'sb-kills';
        killsSpan.textContent = row.kills ?? 0;
        const deathsSpan = document.createElement('span');
        deathsSpan.className = 'sb-deaths';
        deathsSpan.textContent = row.deaths ?? 0;
        div.append(nameSpan, killsSpan, deathsSpan);
        scoreboardBodyEl.appendChild(div);
      }
    }
    scoreboardOverlayEl?.classList.remove('hidden');
    scoreboardOverlayEl?.setAttribute('aria-hidden', 'false');
  });

  // ── ui_update : mise à jour HUD + masquage death overlay au respawn ─────────
  socket.on('ui_update', (data) => {
    updateUI(data);
    const st = getStoredSession();
    if (st?.sessionId && (data.team === 'ATT' || data.team === 'DEF')) {
      saveSession(st.sessionId, st.name, data.team, st.avatarDataUrl ?? null);
    }
    // Masquer l'écran de mort dès que le joueur est de nouveau en vie
    if (data.isDead === false) {
      if (_respawnCountdown) { clearInterval(_respawnCountdown); _respawnCountdown = null; }
      deathOverlayEl?.classList.add('hidden');
      deathOverlayEl?.setAttribute('aria-hidden', 'true');
    }
  });

  socket.on('game_phase', ({ roundState, phaseTime, roundTime }) => {
    currentRoundState = roundState;
    setShopVisible(roundState === 'BUY_PHASE');

    // `lobby_state` n'est émis par le serveur qu'en phase LOBBY — sans ça, le panneau « choix de carte »
    // reste visible au lancement (BUY / ACTION / …) car aucun event ne le masquait.
    if (roundState === 'LOBBY') {
      mobileLobbyEl?.classList.remove('hidden');
    } else {
      mobileLobbyEl?.classList.add('hidden');
    }

    // Masquer le scoreboard dès qu'on sort de ROUND_END
    if (roundState !== 'ROUND_END') {
      scoreboardOverlayEl?.classList.add('hidden');
      scoreboardOverlayEl?.setAttribute('aria-hidden', 'true');
    }
    // Masquer l'écran de mort au début d'une nouvelle manche
    if (roundState === 'BUY_PHASE' || roundState === 'LOBBY') {
      if (_respawnCountdown) { clearInterval(_respawnCountdown); _respawnCountdown = null; }
      deathOverlayEl?.classList.add('hidden');
    }
    // Masquer l'écran de fin de match au retour en lobby
    if (roundState === 'LOBBY' || roundState === 'BUY_PHASE') {
      matchEndOverlayEl?.classList.add('hidden');
      // Réinitialiser le bouton Prêt
      _isReady = false;
      readyBtnEl?.classList.remove('is-ready');
    }

    // ── Timer de phase ─────────────────────────────────────────────────────────
    const timerEl = document.getElementById('hud-phase-timer');
    if (_phaseTimerInterval) { clearInterval(_phaseTimerInterval); _phaseTimerInterval = null; }
    if (timerEl) {
      const fmtBuy = s => `ACHAT ${s}s`;
      const fmtAction = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
      if (roundState === 'BUY_PHASE' && phaseTime > 0) {
        let rem = Math.ceil(phaseTime);
        timerEl.textContent = fmtBuy(rem); timerEl.dataset.state = 'BUY_PHASE';
        _phaseTimerInterval = setInterval(() => {
          rem = Math.max(0, rem - 1);
          timerEl.textContent = fmtBuy(rem);
          if (rem <= 0) { clearInterval(_phaseTimerInterval); _phaseTimerInterval = null; }
        }, 1000);
      } else if (roundState === 'ACTION_PHASE' && roundTime > 0) {
        let rem = Math.ceil(roundTime);
        timerEl.textContent = fmtAction(rem); timerEl.dataset.state = 'ACTION_PHASE';
        _phaseTimerInterval = setInterval(() => {
          rem = Math.max(0, rem - 1);
          timerEl.textContent = fmtAction(rem);
          if (rem <= 0) { clearInterval(_phaseTimerInterval); _phaseTimerInterval = null; }
        }, 1000);
      } else {
        timerEl.textContent = '';
        timerEl.dataset.state = '';
      }
    }

    if (roundState === 'ACTION_PHASE') {
      if (!contextPollInterval) {
        contextPollInterval = setInterval(() => socket.emit('get_context'), 500);
      }
    } else {
      if (contextPollInterval) {
        clearInterval(contextPollInterval);
        contextPollInterval = null;
      }
      _gameScreen?.classList.remove('domain-interior');
      currentContext = { ...currentContext, inDomain: false, domainInterior: null };
    }
  });
  socket.on('sync_roster', (payload) => {
    lockedHeroes = payload?.lockedHeroes || {};
    // Déduire notre héros en cherchant notre socket.id dans lockedHeroes
    myHeroId = null;
    for (const [hId, pId] of Object.entries(lockedHeroes)) {
      if (pId === socket.id) { myHeroId = hId; break; }
    }
    updateHeroRosterUI();
    refreshHeroPowerButtons();
  });
  socket.on('lobby_state', (state) => {
    if (!state) return;
    const { roundState, voteCounts, hostId, settings, playerCount } = state;
    isHost = !!(hostId && hostId === socket.id);
    currentRoundState = roundState;

    // Bouton quitter : visible hors lobby (host mobile seulement)
    if (mobileQuitBtn) {
      const inGame = roundState !== 'LOBBY' && roundState !== 'MATCH_OVER';
      mobileQuitBtn.classList.toggle('hidden', !(inGame && isHost));
    }

    if (roundState === 'LOBBY') {
      mobileLobbyEl?.classList.remove('hidden');
    } else {
      mobileLobbyEl?.classList.add('hidden');
      // Secours : lobby_state inclut roundState à chaque broadcast ; aligne le shop si game_phase manque.
      setShopVisible(roundState === 'BUY_PHASE');
      return;
    }

    // Compteur de joueurs
    if (mobileLobbyPlayerCountEl && playerCount != null) {
      mobileLobbyPlayerCountEl.textContent = `${playerCount} joueur${playerCount > 1 ? 's' : ''}`;
    }

    // Résumé des paramètres
    if (mobileLobbySettingsEl && settings) {
      mobileLobbySettingsEl.textContent =
        `BO${settings.roundsToWin} · ${settings.roundDuration}s · ` +
        `Achat ${settings.buyPhaseDuration}s · $${settings.startingMoney}` +
        (settings.enablePowerUps ? ' · PU ON' : '');
    }

    // Mise à jour des cartes de vote (compteurs + en tête + mon vote)
    syncLobbyMapCards(voteCounts || {});
  });
  socket.on('context_update', (ctx) => {
    currentContext = {
      canPlant: !!ctx?.canPlant,
      canDefuse: !!ctx?.canDefuse,
      needReload: !!ctx?.needReload,
      inDomain: !!ctx?.inDomain,
      domainInterior: ctx?.domainInterior && typeof ctx.domainInterior === 'object'
        ? { cx: ctx.domainInterior.cx, cy: ctx.domainInterior.cy, r: ctx.domainInterior.r }
        : null
    };
    _gameScreen?.classList.toggle('domain-interior', currentContext.inDomain);
    updateActionButton();
  });
}

/**
 * Initialise l'écran de jeu après un join réussi (joysticks, boutons, listeners)
 * @param {import('socket.io-client').Socket} socket
 * @param {Object} [initialUI] - Données ui_update initiales (ammo, money, etc.)
 */
export function initGameController(socket, initialUI) {
  // Reconnexion : forcer un état UI neutre avant les events serveur
  mobileLobbyEl?.classList.add('hidden');

  if (initialUI) {
    updateUI(initialUI);
    if (initialUI.roundState) {
      currentRoundState = initialUI.roundState;
      setShopVisible(initialUI.roundState === 'BUY_PHASE');
    }
    const st = getStoredSession();
    if (st?.sessionId && (initialUI.team === 'ATT' || initialUI.team === 'DEF')) {
      saveSession(st.sessionId, st.name, initialUI.team, st.avatarDataUrl ?? null);
    }
  }
  setupSocketListeners(socket);
  initJoysticks(socket);
  initButtons(socket);
  initCommentBar(socket);
  buildHeroRoster(socket);
  updateActionButton();

  // Bouton QUITTER LA PARTIE (host mobile uniquement — retour au lobby)
  let quitTaps = 0;
  let quitTimer = null;
  setupDisconnectOverlay(socket);

  mobileQuitBtn?.addEventListener('pointerdown', (e) => {
    e?.preventDefault();
    if (!isHost || currentRoundState === 'LOBBY') return;
    quitTaps++;
    if (quitTaps === 1) {
      mobileQuitBtn.textContent = '?';
        quitTimer = setTimeout(() => {
        quitTaps = 0;
        mobileQuitBtn.textContent = '✕';
      }, 3000);
    } else if (quitTaps >= 2) {
      clearTimeout(quitTimer);
      quitTaps = 0;
      mobileQuitBtn.textContent = '↩';
      socket.emit('force_lobby', (res) => {
        if (!res?.ok) {
          mobileQuitBtn.textContent = '✕';
          if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
        }
      });
    }
  }, { passive: false });

  // Bouton RETOUR ARRIÈRE (quitter le lobby pour changer de nom / code partie)
  const lobbyBackBtn = document.getElementById('mobile-back-btn');
  lobbyBackBtn?.addEventListener('pointerdown', (e) => {
    e?.preventDefault();
    if (navigator.vibrate) navigator.vibrate(30);
    clearStoredSession();
    socket.disconnect();
    window.location.reload();
  }, { passive: false });
}
