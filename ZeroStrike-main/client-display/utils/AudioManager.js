/**
 * AudioManager — Sons procéduraux via Web Audio API.
 * Aucun fichier externe : tir, explosion, defuse, powerup générés à la volée.
 * Volume global : setMasterVolume (0–1), appliqué à toutes les sorties.
 */
let ctx = null;
let masterVolume = 1;

export function setMasterVolume(v) {
  masterVolume = Math.max(0, Math.min(1, Number(v) || 0));
}

export function getMasterVolume() {
  return masterVolume;
}

function getContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

function playTone(freq, duration, type = 'square', vol = 0.08) {
  const c = getContext();
  if (c.state === 'suspended') c.resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.frequency.value = freq;
  osc.type = type;
  const out = vol * masterVolume;
  gain.gain.setValueAtTime(out, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
}

/**
 * Identité sonore par arme (procédural, Web Audio).
 */
export function playWeaponShoot(weaponId) {
  const w = String(weaponId || '').toUpperCase();
  if (!w) {
    throw new Error('[AudioManager] playWeaponShoot : weaponId requis');
  }
  switch (w) {
    case 'PISTOL':
      playTone(740, 0.038, 'square', 0.055);
      setTimeout(() => playTone(520, 0.032, 'square', 0.042), 22);
      break;
    case 'SMG':
      playTone(1180, 0.018, 'square', 0.048);
      setTimeout(() => playTone(920, 0.016, 'square', 0.038), 12);
      break;
    case 'RIFLE':
      playTone(620, 0.042, 'square', 0.068);
      setTimeout(() => playTone(380, 0.028, 'triangle', 0.045), 28);
      break;
    case 'SNIPER':
      playTone(160, 0.1, 'sawtooth', 0.1);
      setTimeout(() => playTone(95, 0.14, 'triangle', 0.07), 45);
      setTimeout(() => playTone(55, 0.08, 'sine', 0.05), 120);
      break;
    case 'SHOTGUN': {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          playTone(280 - i * 35, 0.035, 'square', 0.05 - i * 0.008);
        }, i * 18);
      }
      break;
    }
    default:
      throw new Error(`[AudioManager] Profil son tir inconnu : ${w}`);
  }
}

/**
 * Rechargement — profils mécaniques distincts (clics, glissières, pompe).
 */
export function playWeaponReload(weaponId) {
  const w = String(weaponId || '').toUpperCase();
  if (!w) {
    throw new Error('[AudioManager] playWeaponReload : weaponId requis');
  }
  switch (w) {
    case 'PISTOL':
      playTone(520, 0.04, 'square', 0.06);
      setTimeout(() => playTone(380, 0.05, 'triangle', 0.055), 45);
      break;
    case 'SMG':
      playTone(700, 0.028, 'square', 0.055);
      setTimeout(() => playTone(920, 0.022, 'square', 0.05), 35);
      setTimeout(() => playTone(600, 0.03, 'triangle', 0.045), 70);
      break;
    case 'RIFLE':
      playTone(420, 0.045, 'square', 0.065);
      setTimeout(() => playTone(280, 0.055, 'sawtooth', 0.06), 55);
      setTimeout(() => playTone(640, 0.03, 'square', 0.05), 120);
      break;
    case 'SNIPER':
      playTone(200, 0.08, 'triangle', 0.07);
      setTimeout(() => playTone(150, 0.12, 'sawtooth', 0.08), 90);
      setTimeout(() => playTone(480, 0.04, 'square', 0.055), 220);
      break;
    case 'SHOTGUN':
      playTone(180, 0.07, 'sawtooth', 0.08);
      setTimeout(() => playTone(240, 0.09, 'square', 0.075), 60);
      setTimeout(() => playTone(320, 0.05, 'triangle', 0.05), 140);
      break;
    default:
      throw new Error(`[AudioManager] Profil son reload inconnu : ${w}`);
  }
}

/** Explosion : boom bas */
export function playExplosion() {
  const c = getContext();
  if (c.state === 'suspended') c.resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, c.currentTime + 0.15);
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const out = 0.15 * masterVolume;
  gain.gain.setValueAtTime(out, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.2);
}

/** Defuse : clic satisfaisant */
export function playDefuse() {
  playTone(523, 0.06, 'sine', 0.1);
  setTimeout(() => playTone(784, 0.08, 'sine', 0.08), 50);
}

/** Power-up : petit jingle */
export function playPowerup() {
  [523, 659, 784].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.1, 'sine', 0.07), i * 80);
  });
}

/** Impact sur joueur — feedback léger (game feel, ne pas surcharger avec les tirs) */
export function playHitFeedback(isKill = false) {
  /* Kill : deux tons un peu plus discrets pour ne pas dominer le mix sur grand écran */
  playTone(isKill ? 220 : 440, 0.035, 'triangle', isKill ? 0.075 : 0.05);
  if (isKill) {
    setTimeout(() => playTone(110, 0.07, 'sawtooth', 0.045), 40);
  }
}
