/**
 * Tests — shared/gamePresets.js (profils, tuning, HUD)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_PRESET_IDS,
  applyPresetToSettings,
  getGunplayTuning,
  getPresetDisplayLabel,
  formatGameModeHudLine,
  PRESET_BUNDLES
} from '../shared/gamePresets.js';

describe('gamePresets.getGunplayTuning', () => {
  it('FUN adoucit la marche et le spray vs défaut', () => {
    const t = getGunplayTuning('FUN');
    assert.equal(t.moveMult < 1, true);
    assert.equal(t.sprayPerShot < 1, true);
    assert.equal(t.sprayDecay > 1, true);
  });

  it('COMPETE renforce pénalités (move / spray)', () => {
    const t = getGunplayTuning('COMPETE');
    assert.equal(t.moveMult > 1, true);
    assert.equal(t.sprayPerShot > 1, true);
    assert.equal(t.sprayDecay < 1, true);
  });

  it('CUSTOM / inconnu = multiplicateurs neutres', () => {
    const c = getGunplayTuning('CUSTOM');
    assert.deepEqual(c, { moveMult: 1, sprayPerShot: 1, sprayMax: 1, sprayDecay: 1 });
  });
});

describe('gamePresets.applyPresetToSettings', () => {
  it('applique le bundle FUN', () => {
    const s = { gamePreset: 'COMPETE', roundsToWin: 5 };
    applyPresetToSettings(s, 'FUN');
    assert.equal(s.gamePreset, 'FUN');
    assert.equal(s.roundsToWin, PRESET_BUNDLES.FUN.roundsToWin);
    assert.equal(s.startingMoney, PRESET_BUNDLES.FUN.startingMoney);
  });

  it('CUSTOM ne modifie pas roundsToWin', () => {
    const s = { gamePreset: 'FUN', roundsToWin: 7 };
    applyPresetToSettings(s, 'CUSTOM');
    assert.equal(s.gamePreset, 'CUSTOM');
    assert.equal(s.roundsToWin, 7);
  });

  it('ignore id inconnu', () => {
    const s = { gamePreset: 'FUN', roundsToWin: 3 };
    applyPresetToSettings(s, 'NOT_A_PRESET');
    assert.equal(s.gamePreset, 'FUN');
    assert.equal(s.roundsToWin, 3);
  });
});

describe('gamePresets.HUD labels', () => {
  it('getPresetDisplayLabel couvre les ids connus', () => {
    assert.equal(getPresetDisplayLabel('DEMO_BUT'), 'DÉMO BUT');
    assert.equal(getPresetDisplayLabel('COMPETE'), 'COMPÈTE');
  });

  it('formatGameModeHudLine combine mode et preset', () => {
    assert.equal(formatGameModeHudLine({ mode: 'SND', gamePreset: 'FUN' }), 'S&D · FUN');
    assert.equal(formatGameModeHudLine({ mode: 'DM', gamePreset: 'COMPETE' }), 'DM · COMPÈTE');
  });
});

describe('gamePresets.GAME_PRESET_IDS', () => {
  it('liste figée pour validation serveur', () => {
    assert.equal(GAME_PRESET_IDS.includes('CUSTOM'), true);
    assert.equal(GAME_PRESET_IDS.length, 4);
  });
});
