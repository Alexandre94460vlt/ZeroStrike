/**
 * Tests unitaires — server/services/GameService.js
 *
 * Couvre :
 *   - updateSettings : validation des bornes, rejet hors limites
 *   - _tickBuyPhase, _tickRoundEnd : transitions de phase
 *   - onInputMove : phase ACTION, stun, données invalides
 *
 * Exécution : node --test tests/gameService.test.js
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameService } from '../server/services/GameService.js';
import { RoundState } from '../server/state/RoundStateMachine.js';

function createMockNamespaces() {
  return {
    emit: () => {},
    sockets: { get: () => null }
  };
}

describe('GameService.updateSettings', () => {
  let gameService;

  beforeEach(() => {
    const displayNs = createMockNamespaces();
    const mobileNs = createMockNamespaces();
    gameService = new GameService(displayNs, mobileNs);
    gameService.init();
    gameService.roundState = RoundState.LOBBY;
  });

  it('accepte roundsToWin dans [1, 15]', () => {
    gameService.updateSettings({ roundsToWin: 5 });
    assert.equal(gameService.settings.roundsToWin, 5);
  });

  it('rejette roundsToWin hors limites', () => {
    const before = gameService.settings.roundsToWin;
    gameService.updateSettings({ roundsToWin: 999 });
    assert.equal(gameService.settings.roundsToWin, before);
  });

  it('rejette roundsToWin = 0', () => {
    gameService.updateSettings({ roundsToWin: 1 });
    gameService.updateSettings({ roundsToWin: 0 });
    assert.equal(gameService.settings.roundsToWin, 1);
  });

  it('accepte roundDuration dans [30, 300]', () => {
    gameService.updateSettings({ roundDuration: 120 });
    assert.equal(gameService.settings.roundDuration, 120);
  });

  it('rejette roundDuration hors limites', () => {
    gameService.updateSettings({ roundDuration: 120 });
    gameService.updateSettings({ roundDuration: 500 });
    assert.equal(gameService.settings.roundDuration, 120);
  });

  it('accepte bombTimer dans [10, 90]', () => {
    gameService.updateSettings({ bombTimer: 45 });
    assert.equal(gameService.settings.bombTimer, 45);
  });

  it('accepte enablePowerUps boolean', () => {
    gameService.updateSettings({ enablePowerUps: false });
    assert.equal(gameService.settings.enablePowerUps, false);
  });

  it('accepte mode SND et DM', () => {
    gameService.updateSettings({ mode: 'DM' });
    assert.equal(gameService.settings.mode, 'DM');
    gameService.updateSettings({ mode: 'SND' });
    assert.equal(gameService.settings.mode, 'SND');
  });

  it('accepte dmKillLimit dans [0, 200]', () => {
    gameService.updateSettings({ dmKillLimit: 50 });
    assert.equal(gameService.settings.dmKillLimit, 50);
    gameService.updateSettings({ dmKillLimit: 0 });
    assert.equal(gameService.settings.dmKillLimit, 0);
  });

  it('rejette dmKillLimit hors limites', () => {
    gameService.updateSettings({ dmKillLimit: 30 });
    gameService.updateSettings({ dmKillLimit: 999 });
    assert.equal(gameService.settings.dmKillLimit, 30);
  });

  it('rejette mode invalide', () => {
    gameService.updateSettings({ mode: 'SND' });
    gameService.updateSettings({ mode: 'INVALID' });
    assert.equal(gameService.settings.mode, 'SND');
  });

  it('rejette les mises à jour hors LOBBY', () => {
    gameService.roundState = RoundState.BUY_PHASE;
    gameService.updateSettings({ roundsToWin: 10 });
    assert.notEqual(gameService.settings.roundsToWin, 10);
  });

  it('ignore data null ou non-object', () => {
    const before = gameService.settings.roundsToWin;
    gameService.updateSettings(null);
    gameService.updateSettings(42);
    gameService.updateSettings('string');
    assert.equal(gameService.settings.roundsToWin, before);
  });

  it('applique le preset COMPETE (bundle)', () => {
    gameService.updateSettings({ gamePreset: 'COMPETE' });
    assert.equal(gameService.settings.gamePreset, 'COMPETE');
    assert.equal(gameService.settings.roundsToWin, 5);
    assert.equal(gameService.settings.startingMoney, 800);
    assert.equal(gameService.settings.enablePowerUps, false);
  });

  it('ignore gamePreset inconnu', () => {
    gameService.updateSettings({ gamePreset: 'COMPETE' });
    gameService.updateSettings({ gamePreset: 'INVALID' });
    assert.equal(gameService.settings.gamePreset, 'COMPETE');
  });

  it('CUSTOM ne réécrit pas les champs numériques', () => {
    gameService.updateSettings({ gamePreset: 'FUN' });
    gameService.updateSettings({ roundsToWin: 7 });
    gameService.updateSettings({ gamePreset: 'CUSTOM' });
    assert.equal(gameService.settings.gamePreset, 'CUSTOM');
    assert.equal(gameService.settings.roundsToWin, 7);
  });
});

describe('GameService.onPlayerJoin — code partie', () => {
  let gameService;

  function makeSocket(id = 'mob1') {
    return {
      id,
      _emits: [],
      emit(ev, data) {
        this._emits.push([ev, data]);
      },
      join() {}
    };
  }

  beforeEach(() => {
    const displayNs = createMockNamespaces();
    const mobileNs = createMockNamespaces();
    gameService = new GameService(displayNs, mobileNs);
    gameService.init();
    gameService.roundState = RoundState.LOBBY;
    gameService.roomCode = 'ABCDE';
  });

  it('refuse un premier join sans code', () => {
    const socket = makeSocket();
    gameService.onPlayerJoin(socket, { name: 'T', team: 'DEF' });
    const ui = socket._emits.find((e) => e[0] === 'ui_update');
    assert.ok(ui);
    assert.ok(String(ui[1].error).length > 0);
    assert.equal(gameService.playerService.getAll().length, 0);
  });

  it('refuse un code incorrect', () => {
    const socket = makeSocket();
    gameService.onPlayerJoin(socket, { name: 'T', team: 'DEF', roomCode: 'ZZZZZ' });
    const ui = socket._emits.find((e) => e[0] === 'ui_update');
    assert.ok(ui[1].error.includes('incorrect'));
    assert.equal(gameService.playerService.getAll().length, 0);
  });

  it('accepte le code correct (casse ignorée côté serveur)', () => {
    const socket = makeSocket();
    gameService.onPlayerJoin(socket, { name: 'T', team: 'DEF', roomCode: 'abcde' });
    const uiErr = socket._emits.find((e) => e[0] === 'ui_update' && e[1].error);
    assert.equal(uiErr, undefined);
    const players = gameService.playerService.getAll();
    assert.equal(players.length, 1);
    assert.equal(players[0].team, 'LOBBY');
  });

  it('rejoin en LOBBY ignore l’équipe sauvegardée (ATT → LOBBY)', () => {
    const sid = 'test-session-lobby-rejoin';
    gameService._sessions.set(sid, {
      sessionId: sid,
      name: 'LobbyR',
      team: 'ATT',
      money: 800,
      currentWeapon: 'PISTOL',
      expiresAt: Date.now() + 60_000
    });
    const socket = makeSocket();
    gameService.onPlayerJoin(socket, { sessionId: sid });
    const p = gameService.playerService.getAll()[0];
    assert.equal(p.team, 'LOBBY');
  });

  it('rejoin avec sessionId valide sans code', () => {
    const sid = 'test-session-rejoin-id';
    gameService._sessions.set(sid, {
      sessionId: sid,
      name: 'R',
      team: 'DEF',
      money: 800,
      currentWeapon: 'RIFLE',
      expiresAt: Date.now() + 60_000
    });
    const socket = makeSocket();
    gameService.onPlayerJoin(socket, { name: 'Autre', team: 'ATT', sessionId: sid });
    const uiErr = socket._emits.find((e) => e[0] === 'ui_update' && e[1].error);
    assert.equal(uiErr, undefined);
    const players = gameService.playerService.getAll();
    assert.equal(players.length, 1);
    assert.equal(players[0].name, 'R');
    assert.equal(players[0].team, 'LOBBY');
  });
});

describe('GameService.onInputMove', () => {
  let gameService;

  beforeEach(() => {
    const displayNs = createMockNamespaces();
    const mobileNs = createMockNamespaces();
    gameService = new GameService(displayNs, mobileNs);
    gameService.init();
    gameService.playerService.add('m1', 'Test', 'ATT');
  });

  it('ignore hors ACTION_PHASE', () => {
    gameService.roundState = RoundState.BUY_PHASE;
    gameService.onInputMove('m1', { angle: 1, force: 1 });
    const p = gameService.playerService.get('m1');
    assert.equal(p.vx, 0);
    assert.equal(p.vy, 0);
  });

  it('ignore data null ou non-object', () => {
    gameService.roundState = RoundState.ACTION_PHASE;
    gameService.onInputMove('m1', null);
    gameService.onInputMove('m1', 'bad');
    const p = gameService.playerService.get('m1');
    assert.equal(p.vx, 0);
  });

  it('applique angle et force en ACTION_PHASE', () => {
    gameService.roundState = RoundState.ACTION_PHASE;
    gameService.onInputMove('m1', { angle: 0, force: 1 });
    const p = gameService.playerService.get('m1');
    assert.ok(Math.abs(p.vx - p.speed) < 0.001);
    assert.ok(Math.abs(p.vy) < 0.001);
  });

  it('force à zéro si stun actif', () => {
    gameService.roundState = RoundState.ACTION_PHASE;
    const p = gameService.playerService.get('m1');
    p.stunUntil = Date.now() + 60_000;
    gameService.onInputMove('m1', { angle: 2, force: 1 });
    assert.equal(p.lastInputMove.force, 0);
    assert.equal(p.lastInputMove.angle, 0);
  });
});

describe('GameService._tickBuyPhase', () => {
  let gameService;

  beforeEach(() => {
    const displayNs = createMockNamespaces();
    const mobileNs = createMockNamespaces();
    gameService = new GameService(displayNs, mobileNs);
    gameService.init();
    gameService.roundState = RoundState.BUY_PHASE;
    gameService.phaseTime = 2;
  });

  it('décrémente phaseTime', () => {
    gameService._tickBuyPhase(0.5);
    assert.equal(gameService.phaseTime, 1.5);
  });

  it('passe en ACTION_PHASE quand phaseTime <= 0', () => {
    gameService.phaseTime = 0.1;
    gameService._tickBuyPhase(0.2);
    assert.equal(gameService.roundState, RoundState.ACTION_PHASE);
  });
});

describe('GameService._tickRoundEnd', () => {
  let gameService;

  beforeEach(() => {
    const displayNs = createMockNamespaces();
    const mobileNs = createMockNamespaces();
    gameService = new GameService(displayNs, mobileNs);
    gameService.init();
    gameService.roundState = RoundState.ROUND_END;
    gameService.phaseTime = 3;
  });

  it('décrémente phaseTime', () => {
    gameService._tickRoundEnd(1);
    assert.equal(gameService.phaseTime, 2);
  });

  it('appelle startRound quand phaseTime <= 0', () => {
    let startRoundCalled = false;
    gameService.startRound = () => { startRoundCalled = true; };
    gameService.phaseTime = 0.05;
    gameService._tickRoundEnd(0.1);
    assert.ok(startRoundCalled);
  });
});
