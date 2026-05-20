/**
 * Tests unitaires — server/database/LeaderboardService.js
 *
 * Verifie :
 *   - Initialisation de la base SQLite in-memory
 *   - Enregistrement de stats (recordKill, recordRoundResult)
 *   - Recuperation des stats (getPlayerStats)
 *   - Resistance aux injections SQL dans getPlayerStats
 *   - Leaderboard trie
 *
 * Execution : node --test tests/leaderboard.test.js
 *
 * Note : process.env.DB_PATH doit etre positionne AVANT l'import du module
 * (le module lit la var a l'evaluation).
 */
process.env.DB_PATH = ':memory:';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const {
  init,
  closeDb,
  recordKill,
  recordRoundResult,
  getPlayerStats,
  getLeaderboard
} = await import('../server/database/LeaderboardService.js');

// ─── Initialisation ───────────────────────────────────────────────────────────

describe('LeaderboardService', () => {

  before(async () => {
    closeDb();     // remet db = null pour garantir un état propre
    await init();  // recrée la DB en mémoire
  });

  after(() => {
    closeDb();
  });

  // ─── recordKill ─────────────────────────────────────────────────────────────

  it('recordKill cree un joueur s il nexiste pas encore', () => {
    recordKill('Alice', 'Bob');
    const alice = getPlayerStats('Alice');
    assert.ok(alice !== null, 'Alice devrait exister');
    assert.equal(alice.kills, 1);
  });

  it('recordKill incremente les deaths de la victime', () => {
    const bob = getPlayerStats('Bob');
    assert.ok(bob !== null);
    assert.equal(bob.deaths, 1);
  });

  it('recordKill cumule les kills sur plusieurs appels', () => {
    recordKill('Alice', 'Charlie');
    recordKill('Alice', 'Charlie');
    const alice = getPlayerStats('Alice');
    assert.equal(alice.kills, 3); // 1 (Bob) + 2 (Charlie)
  });

  // ─── recordRoundResult ───────────────────────────────────────────────────────

  it('recordRoundResult incremente wins pour les vainqueurs ATT', () => {
    const before = getPlayerStats('Alice')?.wins ?? 0;
    recordRoundResult('ATT', { ATT: ['Alice'], DEF: ['Bob'] });
    const after = getPlayerStats('Alice').wins;
    assert.ok(after > before);
  });

  it('recordRoundResult incremente rounds_played pour les perdants', () => {
    const before = getPlayerStats('Bob')?.rounds_played ?? 0;
    recordRoundResult('ATT', { ATT: ['Alice'], DEF: ['Bob'] });
    const after = getPlayerStats('Bob').rounds_played;
    assert.ok(after > before);
  });

  it('recordRoundResult incremente wins pour les vainqueurs DEF', () => {
    const before = getPlayerStats('Bob')?.wins ?? 0;
    recordRoundResult('DEF', { ATT: ['Alice'], DEF: ['Bob'] });
    const after = getPlayerStats('Bob').wins;
    assert.ok(after > before);
  });

  // ─── getPlayerStats ──────────────────────────────────────────────────────────

  it('getPlayerStats retourne null pour un joueur inconnu', () => {
    assert.equal(getPlayerStats('InconnuXYZ'), null);
  });

  it('getPlayerStats calcule le kd_ratio (kills / deaths)', () => {
    const alice = getPlayerStats('Alice');
    assert.ok(typeof alice.kd_ratio === 'number');
    assert.ok(alice.kd_ratio >= 0);
  });

  it('getPlayerStats kd_ratio egal kills si deaths = 0', () => {
    recordKill('FreshPlayer', 'Dummy');
    const p = getPlayerStats('FreshPlayer');
    assert.equal(p.kd_ratio, p.kills);
  });

  // ─── Injection SQL ───────────────────────────────────────────────────────────

  it("resistance injection SQL : quote simple dans le nom", () => {
    assert.doesNotThrow(() => {
      const result = getPlayerStats("' OR '1'='1");
      assert.equal(result, null);
    });
  });

  it("resistance injection SQL : terminaison + commentaire SQL", () => {
    assert.doesNotThrow(() => {
      const result = getPlayerStats("'; DROP TABLE player_stats; --");
      assert.equal(result, null);
      // Verifier que la table nna pas ete droppee
      const alice = getPlayerStats('Alice');
      assert.ok(alice !== null, 'La table doit toujours exister');
    });
  });

  it("resistance injection SQL : UNION SELECT", () => {
    assert.doesNotThrow(() => {
      const result = getPlayerStats("x' UNION SELECT * FROM player_stats --");
      assert.equal(result, null);
    });
  });

  // ─── getLeaderboard ──────────────────────────────────────────────────────────

  it('getLeaderboard retourne un tableau', () => {
    const board = getLeaderboard();
    assert.ok(Array.isArray(board));
    assert.ok(board.length >= 1);
  });

  it('getLeaderboard trie par kills decroissant', () => {
    const board = getLeaderboard();
    for (let i = 1; i < board.length; i++) {
      assert.ok(board[i - 1].kills >= board[i].kills,
        `row ${i-1} (${board[i-1].kills}) devrait avoir >= kills que row ${i} (${board[i].kills})`);
    }
  });

  it('getLeaderboard respecte la limite fournie', () => {
    const board = getLeaderboard(2);
    assert.ok(board.length <= 2);
  });
});
