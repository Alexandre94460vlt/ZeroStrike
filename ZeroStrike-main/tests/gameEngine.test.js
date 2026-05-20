/**
 * Tests unitaires — server/domain/GameEngine.js (domaine pur)
 *
 * Objectif: valider la séparation domaine/I-O (pas besoin de Socket.io/DB).
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../server/domain/GameEngine.js';
import { RoundState } from '../server/state/RoundStateMachine.js';
 
describe('GameEngine.updateSettings', () => {
  let engine;
  beforeEach(() => {
    engine = new GameEngine({ now: () => Date.now() });
    engine.init();
    engine.roundState = RoundState.LOBBY;
  });
 
  it('accepte roundsToWin dans [1, 15]', () => {
    engine.updateSettings({ roundsToWin: 5 });
    assert.equal(engine.settings.roundsToWin, 5);
  });
 
  it('rejette roundsToWin hors limites', () => {
    const before = engine.settings.roundsToWin;
    engine.updateSettings({ roundsToWin: 999 });
    assert.equal(engine.settings.roundsToWin, before);
  });
});
 
describe('GameEngine.onInputAim — validation NaN', () => {
  let engine;
  beforeEach(() => {
    engine = new GameEngine({ now: () => Date.now() });
    engine.init();
    engine.roundState = RoundState.LOBBY;
    engine.roomCode = 'ABCDE';
    engine.onPlayerJoin({ socketId: 'mob1', name: 'T', roomCode: 'ABCDE' });
    const p = engine.playerService.get('mob1');
    p.isDead = false;
    p.rot = 1.5;
  });

  it('convertit null en 0 (Number(null) = 0, angle valide)', () => {
    engine.onInputAim('mob1', { angle: null });
    assert.equal(engine.playerService.get('mob1').rot, 0);
  });

  it('garde la rotation précédente si angle = "abc"', () => {
    engine.onInputAim('mob1', { angle: 'abc' });
    assert.equal(engine.playerService.get('mob1').rot, 1.5);
  });

  it('garde la rotation précédente si angle = undefined', () => {
    engine.onInputAim('mob1', {});
    assert.equal(engine.playerService.get('mob1').rot, 1.5);
  });

  it('garde la rotation précédente si angle = NaN', () => {
    engine.onInputAim('mob1', { angle: NaN });
    assert.equal(engine.playerService.get('mob1').rot, 1.5);
  });

  it('garde la rotation précédente si angle = Infinity', () => {
    engine.onInputAim('mob1', { angle: Infinity });
    assert.equal(engine.playerService.get('mob1').rot, 1.5);
  });

  it('accepte un angle numérique valide', () => {
    engine.onInputAim('mob1', { angle: 3.14 });
    assert.equal(engine.playerService.get('mob1').rot, 3.14);
  });

  it('accepte angle = 0', () => {
    engine.onInputAim('mob1', { angle: 0 });
    assert.equal(engine.playerService.get('mob1').rot, 0);
  });
});

describe('GameEngine.sendContextToMobile', () => {
  it('ne renvoie aucun effet en LOBBY (évite poll inutile)', () => {
    const engine = new GameEngine({ now: () => Date.now() });
    engine.init();
    engine.roundState = RoundState.LOBBY;
    const effects = engine.sendContextToMobile('mob_inexistant');
    assert.equal(effects.length, 0);
  });

  it('ne renvoie aucun effet en MATCH_OVER', () => {
    const engine = new GameEngine({ now: () => Date.now() });
    engine.init();
    engine.roundState = RoundState.MATCH_OVER;
    assert.equal(engine.sendContextToMobile('x').length, 0);
  });
});

describe('GameEngine.onPlayerJoin — code partie', () => {
  let engine;
  beforeEach(() => {
    engine = new GameEngine({ now: () => Date.now() });
    engine.init();
    engine.roundState = RoundState.LOBBY;
    engine.roomCode = 'ABCDE';
  });
 
  it('refuse un premier join sans code (effet ui_update)', () => {
    const eff = engine.onPlayerJoin({ socketId: 'mob1', name: 'T', team: 'DEF' });
    assert.ok(eff.some(e => e.type === 'emit_socket' && e.event === 'ui_update'));
    assert.equal(engine.playerService.getAll().length, 0);
  });
 
  it('accepte le code correct (casse ignorée)', () => {
    const eff = engine.onPlayerJoin({ socketId: 'mob1', name: 'T', team: 'DEF', roomCode: 'abcde' });
    assert.ok(!eff.some(e => e.type === 'emit_socket' && e.event === 'ui_update' && e.payload?.error));
    const players = engine.playerService.getAll();
    assert.equal(players.length, 1);
    assert.equal(players[0].team, 'LOBBY');
  });

  it('rejoin en LOBBY : session avec ATT → joueur LOBBY', () => {
    const sid = 'sid-lobby';
    engine._sessions.set(sid, {
      sessionId: sid,
      name: 'R',
      team: 'ATT',
      money: 800,
      currentWeapon: 'PISTOL',
      expiresAt: Date.now() + 60_000
    });
    engine.onPlayerJoin({ socketId: 'mob1', sessionId: sid });
    assert.equal(engine.playerService.getAll()[0].team, 'LOBBY');
  });
});

describe('GameEngine.startGameWithVote', () => {
  let engine;

  beforeEach(() => {
    engine = new GameEngine({ now: () => Date.now() });
    engine.init();
    engine.roundState = RoundState.LOBBY;
    engine.roomCode = 'ABCDE';
    engine.onPlayerJoin({ socketId: 'host', name: 'Hote', roomCode: 'ABCDE' });
    engine.onPlayerJoin({ socketId: 'guest', name: 'Inv', roomCode: 'ABCDE' });
    engine.readyPlayers.add('guest');
  });

  it('refuse si un joueur non-hôte n’est pas prêt', () => {
    engine.readyPlayers.clear();
    const eff = engine.startGameWithVote();
    assert.ok(eff.some((e) => e.type === 'emit_namespace' && e.event === 'start_denied'));
  });

  it('démarre le compte à rebours quand prêt (effet schedule countdown)', () => {
    const eff = engine.startGameWithVote();
    assert.ok(eff.some((e) => e.type === 'schedule' && e.action?.type === 'countdown_tick'));
    assert.equal(engine.readyPlayers.size, 0);
  });

  it('ne fait rien hors LOBBY', () => {
    engine.roundState = RoundState.ACTION_PHASE;
    assert.equal(engine.startGameWithVote().length, 0);
  });
});
 
