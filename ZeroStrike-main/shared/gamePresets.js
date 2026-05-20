/**
 * Profils de partie (Fun / Compétitif / Démo BUT) — partagé logique doc ↔ serveur.
 * CUSTOM = valeurs manuelles (champs numériques modifiés côté client → bascule en PERSO).
 */

export const GAME_PRESET_IDS = ['FUN', 'COMPETE', 'DEMO_BUT', 'CUSTOM'];

/**
 * Applique un profil au settings serveur (écrase les champs du bundle ; CUSTOM ne change que l’étiquette).
 */
export function applyPresetToSettings(s, preset) {
  if (!GAME_PRESET_IDS.includes(preset)) return;
  s.gamePreset = preset;
  if (preset === 'CUSTOM') return;
  const b = PRESET_BUNDLES[preset];
  if (b) Object.assign(s, { ...b });
}

/** Paquets appliqués côté serveur quand gamePreset ≠ CUSTOM */
export const PRESET_BUNDLES = {
  FUN: {
    gamePreset: 'FUN',
    roundsToWin: 3,
    roundDuration: 105,
    buyPhaseDuration: 14,
    bombTimer: 38,
    startingMoney: 4000,
    enablePowerUps: true,
    dmKillLimit: 30
  },
  COMPETE: {
    gamePreset: 'COMPETE',
    roundsToWin: 5,
    roundDuration: 95,
    buyPhaseDuration: 12,
    bombTimer: 38,
    startingMoney: 800,
    enablePowerUps: false,
    dmKillLimit: 35
  },
  DEMO_BUT: {
    gamePreset: 'DEMO_BUT',
    roundsToWin: 1,
    roundDuration: 65,
    buyPhaseDuration: 10,
    bombTimer: 35,
    startingMoney: 5000,
    enablePowerUps: false,
    dmKillLimit: 0
  }
};

/**
 * Multiplicateurs gunplay (spray + move) — pas persistés, dérivés du preset.
 */
/** Libellés courts pour HUD grand écran (évite les clés brutes type DEMO_BUT) */
export function getPresetDisplayLabel(gamePreset) {
  switch (gamePreset) {
    case 'FUN':
      return 'FUN';
    case 'COMPETE':
      return 'COMPÈTE';
    case 'DEMO_BUT':
      return 'DÉMO BUT';
    case 'CUSTOM':
      return 'PERSO';
    default:
      return 'FUN';
  }
}

/**
 * Ligne HUD : mode de jeu + profil (ex. « S&D · COMPÈTE »).
 * @param {{ mode?: string, gamePreset?: string }} settings — extrait de state.settings
 */
export function formatGameModeHudLine(settings) {
  if (!settings || typeof settings !== 'object') return '';
  const mode = settings.mode === 'DM' ? 'DM' : 'S&D';
  const preset = getPresetDisplayLabel(settings.gamePreset);
  return `${mode} · ${preset}`;
}

export function getGunplayTuning(gamePreset) {
  switch (gamePreset) {
    case 'FUN':
      return { moveMult: 0.72, sprayPerShot: 0.52, sprayMax: 0.62, sprayDecay: 1.4 };
    case 'COMPETE':
      return { moveMult: 1.12, sprayPerShot: 1.22, sprayMax: 1.12, sprayDecay: 0.78 };
    case 'DEMO_BUT':
      return { moveMult: 0.8, sprayPerShot: 0.58, sprayMax: 0.68, sprayDecay: 1.25 };
    case 'CUSTOM':
    default:
      return { moveMult: 1, sprayPerShot: 1, sprayMax: 1, sprayDecay: 1 };
  }
}
