/**
 * Ports (interfaces) côté application/infrastructure.
 * En JS, on documente le contrat: le domaine n'importe jamais l'implémentation.
 */
 
/**
 * @typedef {Object} SocketPort
 * @property {(ns: 'display'|'mobile', event: string, payload: any) => void} emitNamespace
 * @property {(ns: 'display'|'mobile', socketId: string, event: string, payload: any) => void} emitSocket
 * @property {() => { display: number, mobile: number }} getSocketCounts
 */
 
/**
 * @typedef {Object} LeaderboardPort
 * @property {(killerName: string, victimName: string) => void} recordKill
 * @property {(name: string) => void} addPlant
 * @property {(name: string) => void} addDefuse
 * @property {(winnerTeam: string, playerNamesByTeam: {ATT: string[], DEF: string[]}) => void} recordRoundResult
 * @property {(limit: number, orderBy: string) => any[]} getLeaderboard
 * @property {(name: string) => any|null} getPlayerStats
 */
 
/**
 * @typedef {Object} SchedulerPort
 * @property {(key: string, delayMs: number, fn: () => void) => void} schedule
 * @property {(key: string) => void} cancel
 */
 
export {};
