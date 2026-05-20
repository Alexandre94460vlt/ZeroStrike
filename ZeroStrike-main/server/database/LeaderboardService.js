/**
 * Service : classement et statistiques joueurs (SQLite via sql.js)
 * Agrégation par nom de joueur. Fichier : data/leaderboard.db (sauvegardé après chaque écriture).
 */
import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { CREATE_TABLE, INDEX_LAST_PLAYED } from './schema.js';
import { sanitizePlayerDisplayName, sanitizeLeaderboardKey } from '../utils/sanitizePlayerName.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
const DB_PATH = process.env.DB_PATH || join(rootDir, 'data', 'leaderboard.db');

let db = null;
let SQL = null;

/** À appeler au démarrage du serveur (async). */
export async function init() {
  if (db) return;
  SQL = await initSqlJs();
  if (IS_IN_MEMORY) {
    db = new SQL.Database();
  } else {
    const dataDir = join(rootDir, 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    if (existsSync(DB_PATH)) {
      const buf = readFileSync(DB_PATH);
      db = new SQL.Database(buf);
    } else {
      db = new SQL.Database();
    }
  }
  db.run(CREATE_TABLE);
  db.run(INDEX_LAST_PLAYED);
}

function getDb() {
  if (!db) throw new Error('LeaderboardService: init() must be called first');
  return db;
}

const IS_IN_MEMORY = DB_PATH === ':memory:';

/** Délai (ms) avant écriture disque après la dernière mutation — réduit les fsync répétés. 0 = synchrone immédiat. */
function saveDebounceMs() {
  const n = parseInt(process.env.LEADERBOARD_SAVE_DEBOUNCE_MS, 10);
  if (Number.isFinite(n) && n >= 0) return Math.min(2000, n);
  return 75;
}

let _saveTimer = null;

function persistToDisk() {
  try {
    writeFileSync(DB_PATH, getDb().export());
  } catch (e) {
    console.error('[Leaderboard] save failed', e.message);
  }
}

/**
 * Écriture immédiate (vide le timer en attente). Utile avant arrêt process si besoin.
 */
export function flushLeaderboardToDisk() {
  if (IS_IN_MEMORY) return;
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  persistToDisk();
}

/** Sauvegarde débouncée : une écriture disque après un court délai sans nouvelle mutation. */
function save() {
  if (IS_IN_MEMORY) return;
  const ms = saveDebounceMs();
  if (ms === 0) {
    persistToDisk();
    return;
  }
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    persistToDisk();
  }, ms);
}

function run(sql, params = []) {
  getDb().run(sql, params);
}

function execToRows(sql) {
  const result = getDb().exec(sql);
  if (!result.length || !result[0].values.length) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((c, i) => obj[c] = row[i]);
    return obj;
  });
}

/** +1 kill pour killer, +1 death pour victim */
export function recordKill(killerName, victimName) {
  const k = sanitizePlayerDisplayName(killerName);
  const v = sanitizePlayerDisplayName(victimName);
  run('INSERT OR IGNORE INTO player_stats (name) VALUES (?)', [k]);
  run('INSERT OR IGNORE INTO player_stats (name) VALUES (?)', [v]);
  run('UPDATE player_stats SET kills = kills + 1, last_played_at = datetime(\'now\') WHERE name = ?', [k]);
  run('UPDATE player_stats SET deaths = deaths + 1, last_played_at = datetime(\'now\') WHERE name = ?', [v]);
  save();
}

/** +1 plant */
export function addPlant(name) {
  const n = sanitizePlayerDisplayName(name);
  run('INSERT OR IGNORE INTO player_stats (name) VALUES (?)', [n]);
  run('UPDATE player_stats SET plants = plants + 1, last_played_at = datetime(\'now\') WHERE name = ?', [n]);
  save();
}

/** +1 defuse */
export function addDefuse(name) {
  const n = sanitizePlayerDisplayName(name);
  run('INSERT OR IGNORE INTO player_stats (name) VALUES (?)', [n]);
  run('UPDATE player_stats SET defuses = defuses + 1, bomb_defused_rounds = bomb_defused_rounds + 1, last_played_at = datetime(\'now\') WHERE name = ?', [n]);
  save();
}

/** Round gagné : +1 win ou +1 loss par joueur */
export function recordRoundResult(winnerTeam, playerNamesByTeam) {
  const att = playerNamesByTeam.ATT || [];
  const def = playerNamesByTeam.DEF || [];

  for (const name of att) {
    const n = sanitizePlayerDisplayName(name);
    run('INSERT OR IGNORE INTO player_stats (name) VALUES (?)', [n]);
    if (winnerTeam === 'ATT') {
      run("UPDATE player_stats SET wins = wins + 1, rounds_played = rounds_played + 1, rounds_won_att = rounds_won_att + 1, last_played_at = datetime('now') WHERE name = ?", [n]);
    } else {
      run("UPDATE player_stats SET losses = losses + 1, rounds_played = rounds_played + 1, last_played_at = datetime('now') WHERE name = ?", [n]);
    }
  }
  for (const name of def) {
    const n = sanitizePlayerDisplayName(name);
    run('INSERT OR IGNORE INTO player_stats (name) VALUES (?)', [n]);
    if (winnerTeam === 'DEF') {
      run("UPDATE player_stats SET wins = wins + 1, rounds_played = rounds_played + 1, rounds_won_def = rounds_won_def + 1, last_played_at = datetime('now') WHERE name = ?", [n]);
    } else {
      run("UPDATE player_stats SET losses = losses + 1, rounds_played = rounds_played + 1, last_played_at = datetime('now') WHERE name = ?", [n]);
    }
  }
  save();
}

/** Classement */
export function getLeaderboard(limit = 50, orderBy = 'kills') {
  const allowed = ['kills', 'deaths', 'wins', 'losses', 'plants', 'defuses', 'rounds_played', 'last_played_at', 'kd_ratio', 'win_rate'];
  const col = allowed.includes(orderBy) ? orderBy : 'kills';
  const limitNum = Math.min(limit, 100);

  let sql;
  if (col === 'kd_ratio') {
    sql = `SELECT name, kills, deaths, rounds_played, wins, losses, plants, defuses,
           CASE WHEN deaths > 0 THEN ROUND(1.0 * kills / deaths, 2) ELSE kills END AS kd_ratio,
           CASE WHEN rounds_played > 0 THEN ROUND(100.0 * wins / rounds_played, 1) ELSE 0 END AS win_rate,
           last_played_at FROM player_stats ORDER BY kd_ratio DESC, kills DESC LIMIT ${limitNum}`;
  } else if (col === 'win_rate') {
    sql = `SELECT name, kills, deaths, rounds_played, wins, losses, plants, defuses,
           CASE WHEN deaths > 0 THEN ROUND(1.0 * kills / deaths, 2) ELSE kills END AS kd_ratio,
           CASE WHEN rounds_played > 0 THEN ROUND(100.0 * wins / rounds_played, 1) ELSE 0 END AS win_rate,
           last_played_at FROM player_stats ORDER BY win_rate DESC, wins DESC LIMIT ${limitNum}`;
  } else {
    sql = `SELECT name, kills, deaths, rounds_played, wins, losses, plants, defuses,
           CASE WHEN deaths > 0 THEN ROUND(1.0 * kills / deaths, 2) ELSE kills END AS kd_ratio,
           CASE WHEN rounds_played > 0 THEN ROUND(100.0 * wins / rounds_played, 1) ELSE 0 END AS win_rate,
           last_played_at FROM player_stats ORDER BY ${col} DESC, kills DESC LIMIT ${limitNum}`;
  }
  return execToRows(sql);
}

/** Ferme et efface la connexion — utile pour les tests ou l'arrêt propre du serveur. */
export function closeDb() {
  if (db) { try { db.close(); } catch { /* ignore */ } db = null; }
}

/** Stats d'un joueur */
export function getPlayerStats(name) {
  const n = sanitizeLeaderboardKey(name);
  const stmt = getDb().prepare(
    `SELECT *,
      CASE WHEN deaths > 0 THEN ROUND(1.0 * kills / deaths, 2) ELSE kills END AS kd_ratio,
      CASE WHEN rounds_played > 0 THEN ROUND(100.0 * wins / rounds_played, 1) ELSE 0 END AS win_rate
     FROM player_stats WHERE name = ?`
  );
  stmt.bind([n]);
  if (!stmt.step()) { stmt.free(); return null; }
  const obj = stmt.getAsObject();
  stmt.free();
  return obj;
}
