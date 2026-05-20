/**
 * Adaptateur LeaderboardService (sql.js) → LeaderboardPort
 */
 
import * as LeaderboardService from '../database/LeaderboardService.js';
 
export class SqlJsLeaderboardAdapter {
  async init() {
    await LeaderboardService.init();
  }
 
  recordKill(killerName, victimName) {
    LeaderboardService.recordKill(killerName, victimName);
  }
 
  addPlant(name) {
    LeaderboardService.addPlant(name);
  }
 
  addDefuse(name) {
    LeaderboardService.addDefuse(name);
  }
 
  recordRoundResult(winnerTeam, playerNamesByTeam) {
    LeaderboardService.recordRoundResult(winnerTeam, playerNamesByTeam);
  }
 
  getLeaderboard(limit, orderBy) {
    return LeaderboardService.getLeaderboard(limit, orderBy);
  }
 
  getPlayerStats(name) {
    return LeaderboardService.getPlayerStats(name);
  }
}
