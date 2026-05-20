/**
 * Schéma SQLite : classement et statistiques des joueurs
 * Une ligne par nom de joueur (clé d'agrégation des parties)
 */
export const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS player_stats (
  name TEXT PRIMARY KEY,

  -- Combat
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  headshots INTEGER NOT NULL DEFAULT 0,
  damage_dealt INTEGER NOT NULL DEFAULT 0,

  -- Bomb
  plants INTEGER NOT NULL DEFAULT 0,
  defuses INTEGER NOT NULL DEFAULT 0,
  bomb_explosions INTEGER NOT NULL DEFAULT 0,
  bomb_defused_rounds INTEGER NOT NULL DEFAULT 0,

  -- Rounds / parties
  rounds_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  rounds_won_att INTEGER NOT NULL DEFAULT 0,
  rounds_won_def INTEGER NOT NULL DEFAULT 0,

  -- Bonus / divers
  first_bloods INTEGER NOT NULL DEFAULT 0,
  clutches_1v1 INTEGER NOT NULL DEFAULT 0,
  clutches_1v2 INTEGER NOT NULL DEFAULT 0,
  clutches_1v3_plus INTEGER NOT NULL DEFAULT 0,
  survival_rounds INTEGER NOT NULL DEFAULT 0,
  time_played_seconds INTEGER NOT NULL DEFAULT 0,

  -- Métadonnées
  last_played_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const INDEX_LAST_PLAYED = `
CREATE INDEX IF NOT EXISTS idx_player_stats_last_played ON player_stats(last_played_at);
`;
