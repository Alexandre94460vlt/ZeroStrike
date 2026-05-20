import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLeaderboardLimit,
  parseLeaderboardOrderBy,
  parsePlayerNameParam,
  parseGiphyQuerySegment
} from '../server/utils/apiInput.js';

test('parseLeaderboardLimit borne 1-100', () => {
  assert.equal(parseLeaderboardLimit(''), 50);
  assert.equal(parseLeaderboardLimit('200'), 100);
  assert.equal(parseLeaderboardLimit('0'), 1);
  assert.equal(parseLeaderboardLimit('42'), 42);
});

test('parseLeaderboardOrderBy whitelist', () => {
  assert.equal(parseLeaderboardOrderBy('kills'), 'kills');
  assert.equal(parseLeaderboardOrderBy('inject'), 'kills');
});

test('parsePlayerNameParam refuse contrôle / trop long', () => {
  assert.equal(parsePlayerNameParam('bob'), 'bob');
  assert.equal(parsePlayerNameParam('a\u0000b'), null);
  assert.equal(parsePlayerNameParam('x'.repeat(70)), null);
});

test('parseGiphyQuerySegment alphanum', () => {
  assert.equal(parseGiphyQuerySegment('rifle'), 'rifle');
  assert.equal(parseGiphyQuerySegment('a<script>'), 'a script');
});
