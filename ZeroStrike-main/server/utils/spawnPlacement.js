/**
 * Choix de point de spawn : rester sur les tuiles définies par la carte tout en
 * maximisant l’écart avec les joueurs déjà placés (évite les spawns collés).
 */
import { SPAWN_PLAYER_MIN_SEPARATION } from '../config/constants.js';

function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Liste de candidats + orientation pour un joueur (même règles que GameEngine : LOBBY alterné CT/T).
 *
 * @param {{ team: string, id: string }} player
 * @param {{ spawnCTPoints: {x:number,y:number}[], spawnTPoints: {x:number,y:number}[] }} mapData
 * @param {{ id: string, team: string }[]} allPlayers
 * @returns {{ points: {x:number,y:number}[], faceCT: boolean }}
 */
export function getSpawnPointsAndFaceForPlayer(player, mapData, allPlayers) {
  const sortedAll = [...allPlayers].sort((a, b) => a.id.localeCompare(b.id));
  const ctPts = mapData.spawnCTPoints;
  const ttPts = mapData.spawnTPoints;
  if (!ctPts?.length || !ttPts?.length) {
    throw new Error('[spawnPlacement] spawnCTPoints / spawnTPoints requis sur mapData.');
  }

  if (player.team === 'LOBBY') {
    const posAll = sortedAll.findIndex((p) => p.id === player.id);
    const faceCT = posAll % 2 === 0;
    const points = faceCT ? ctPts : ttPts;
    return { points, faceCT };
  }

  const faceCT = player.team === 'DEF';
  return { points: faceCT ? ctPts : ttPts, faceCT };
}

/**
 * Parmi `spawnPoints`, retourne le centre qui maximise la distance minimale aux joueurs de référence.
 * Si au moins un point respecte `minCenterDist`, seuls ces points sont considérés ; sinon meilleur effort.
 *
 * @param {{ x: number, y: number }[]} spawnPoints
 * @param {{ x: number, y: number, id?: string }[]} referencePlayers
 * @param {string | null} excludeId — joueur à exclure des références (ex. soi-même)
 * @param {number} [minCenterDist]
 * @returns {{ x: number, y: number }}
 */
export function pickSpawnPointMaxMinDist(
  spawnPoints,
  referencePlayers,
  excludeId = null,
  minCenterDist = SPAWN_PLAYER_MIN_SEPARATION
) {
  if (!spawnPoints?.length) {
    throw new Error('[spawnPlacement] spawnPoints vide.');
  }
  const refs = referencePlayers.filter(
    (p) => p && (excludeId == null || p.id !== excludeId) && Number.isFinite(p.x) && Number.isFinite(p.y)
  );
  const minSq = minCenterDist * minCenterDist;

  /** @type {{ pt: {x:number,y:number}, minD: number }[]} */
  const scored = [];
  for (const pt of spawnPoints) {
    let minD = Infinity;
    for (const p of refs) {
      const d = distSq(pt.x, pt.y, p.x, p.y);
      if (d < minD) minD = d;
    }
    if (minD === Infinity) minD = Number.MAX_SAFE_INTEGER;
    scored.push({ pt, minD });
  }

  const good = scored.filter((s) => s.minD >= minSq);
  const pool = good.length ? good : scored;
  let best = pool[0];
  for (let i = 1; i < pool.length; i++) {
    const c = pool[i];
    if (c.minD > best.minD) best = c;
    else if (c.minD === best.minD) {
      // Tie-break déterministe : ordre des tuiles spawn sur la carte
      const idxC = spawnPoints.indexOf(c.pt);
      const idxB = spawnPoints.indexOf(best.pt);
      if (idxC < idxB) best = c;
    }
  }
  return best.pt;
}

/**
 * Place une liste de joueurs en une passe (ordre stable par `id`) : chaque joueur
 * maximise l’écart avec ceux déjà positionnés dans ce batch.
 *
 * @param {{ spawnCTPoints: {x:number,y:number}[], spawnTPoints: {x:number,y:number}[] }} mapData
 * @param {{ id: string, team: string, x?: number, y?: number }[]} players
 */
export function assignSpawnPositionsGreedy(mapData, players) {
  const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id));
  /** @type {typeof sorted} */
  const placed = [];
  for (const player of sorted) {
    const { points } = getSpawnPointsAndFaceForPlayer(player, mapData, players);
    const pt = pickSpawnPointMaxMinDist(points, [...placed], player.id);
    player.x = pt.x;
    player.y = pt.y;
    placed.push(player);
  }
}
