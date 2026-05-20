/**
 * Tests unitaires — Logique de jeu (state machine, sanitisation)
 *
 * Couvre :
 *   - RoundStateMachine : transitions valides / invalides
 *   - Sanitisation du nom joueur
 *
 * Exécution :  node --test tests/gameLogic.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePlayerDisplayName, sanitizeLeaderboardKey } from '../server/utils/sanitizePlayerName.js';

// ─── RoundStateMachine ────────────────────────────────────────────────────────

import { transitionTo, canTransitionTo, RoundState } from '../server/state/RoundStateMachine.js';

describe('RoundStateMachine', () => {

  it('accepte la transition LOBBY → BUY_PHASE', () => {
    const next = transitionTo(RoundState.LOBBY, RoundState.BUY_PHASE);
    assert.equal(next, RoundState.BUY_PHASE);
  });

  it('accepte la transition BUY_PHASE → ACTION_PHASE', () => {
    assert.equal(transitionTo(RoundState.BUY_PHASE, RoundState.ACTION_PHASE), RoundState.ACTION_PHASE);
  });

  it('accepte la transition ACTION_PHASE → ROUND_END', () => {
    assert.equal(transitionTo(RoundState.ACTION_PHASE, RoundState.ROUND_END), RoundState.ROUND_END);
  });

  it('accepte la transition ACTION_PHASE → MATCH_OVER', () => {
    assert.equal(transitionTo(RoundState.ACTION_PHASE, RoundState.MATCH_OVER), RoundState.MATCH_OVER);
  });

  it('accepte la transition ROUND_END → BUY_PHASE (rebouclage)', () => {
    assert.equal(transitionTo(RoundState.ROUND_END, RoundState.BUY_PHASE), RoundState.BUY_PHASE);
  });

  it('accepte la transition MATCH_OVER → LOBBY', () => {
    assert.equal(transitionTo(RoundState.MATCH_OVER, RoundState.LOBBY), RoundState.LOBBY);
  });

  it('lève une erreur pour LOBBY → ACTION_PHASE (transition invalide)', () => {
    assert.throws(
      () => transitionTo(RoundState.LOBBY, RoundState.ACTION_PHASE),
      /Transition invalide/
    );
  });

  it('accepte BUY_PHASE → LOBBY (retour forcé lobby / hôte)', () => {
    assert.equal(transitionTo(RoundState.BUY_PHASE, RoundState.LOBBY), RoundState.LOBBY);
  });

  it('lève une erreur pour BUY_PHASE → ROUND_END (saut de phase interdit)', () => {
    assert.throws(
      () => transitionTo(RoundState.BUY_PHASE, RoundState.ROUND_END),
      /Transition invalide/
    );
  });

  it('canTransitionTo retourne true pour une transition valide', () => {
    assert.ok(canTransitionTo(RoundState.LOBBY, RoundState.BUY_PHASE));
  });

  it('canTransitionTo retourne false pour une transition invalide', () => {
    assert.ok(!canTransitionTo(RoundState.LOBBY, RoundState.MATCH_OVER));
  });
});

// ─── Sanitisation du nom joueur ───────────────────────────────────────────────

describe('Sanitisation du nom joueur', () => {
  it('supprime les balises HTML (XSS)', () => {
    const result = sanitizePlayerDisplayName('<script>alert(1)</script>');
    assert.ok(!result.includes('<') && !result.includes('>'));
  });

  it("supprime les guillemets (injection d'attribut)", () => {
    const result = sanitizePlayerDisplayName('foo"bar\'baz');
    assert.ok(!result.includes('"') && !result.includes("'"));
  });

  it('supprime le & (entité HTML)', () => {
    assert.ok(!sanitizePlayerDisplayName('foo&bar').includes('&'));
  });

  it('limite à 24 caractères', () => {
    assert.ok(sanitizePlayerDisplayName('A'.repeat(50)).length <= 24);
  });

  it('retourne "Joueur" pour un nom vide', () => {
    assert.equal(sanitizePlayerDisplayName(''), 'Joueur');
    assert.equal(sanitizePlayerDisplayName('   '), 'Joueur');
  });

  it('retourne "Joueur" pour un non-string', () => {
    assert.equal(sanitizePlayerDisplayName(null), 'Joueur');
    assert.equal(sanitizePlayerDisplayName(42), 'Joueur');
  });

  it('préserve un nom normal sans modification', () => {
    assert.equal(sanitizePlayerDisplayName('PlayerOne'), 'PlayerOne');
  });
});

describe('sanitizeLeaderboardKey (API classement)', () => {
  it('autorise jusqu’à 64 caractères (contrairement au display 24)', () => {
    const long = 'A'.repeat(50);
    assert.equal(sanitizeLeaderboardKey(long).length, 50);
    assert.equal(sanitizePlayerDisplayName(long).length, 24);
  });
});
