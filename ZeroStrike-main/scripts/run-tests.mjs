#!/usr/bin/env node
/**
 * Lance tous les tests dans tests/*.test.js (sans glob shell — compatible Linux CI + Windows).
 * Usage : node scripts/run-tests.mjs [--watch] [--coverage]
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
const testsDir = join(root, '..', 'tests');
const watch = process.argv.includes('--watch');
const coverage = process.argv.includes('--coverage');

const files = readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => join(testsDir, f))
  .sort();

if (files.length === 0) {
  console.error('Aucun fichier tests/*.test.js trouvé.');
  process.exit(1);
}

if (watch && coverage) {
  console.error('Incompatible : --watch et --coverage ensemble.');
  process.exit(1);
}

/** @type {string[]} */
let args;
if (coverage) {
  args = ['--experimental-test-coverage', '--test', ...files];
} else if (watch) {
  args = ['--test', '--watch', ...files];
} else {
  args = ['--test', ...files];
}

const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
