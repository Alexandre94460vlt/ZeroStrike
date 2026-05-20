/**
 * Effets produits par le domaine (moteur de jeu) et exécutés par l'application/infrastructure.
 * Objectif: domaine 100% sans I/O (pas de Socket.io, pas de DB, pas de timers réels).
 *
 * Convention:
 * - Le domaine renvoie une liste d'effets "déclaratifs".
 * - L'application les interprète (emit socket, persistance, scheduling...).
 */
 
/**
 * @typedef {{ type: 'emit_namespace', ns: 'display'|'mobile', event: string, payload: any }} EmitNamespaceEffect
 * @typedef {{ type: 'emit_socket', ns: 'display'|'mobile', socketId: string, event: string, payload: any }} EmitSocketEffect
 * @typedef {{ type: 'stats', op: 'recordKill'|'addPlant'|'addDefuse'|'recordRoundResult', args: any[] }} StatsEffect
 * @typedef {{ type: 'schedule', key: string, delayMs: number, action: DomainAction }} ScheduleEffect
 * @typedef {{ type: 'cancel_schedule', key: string }} CancelScheduleEffect
 * @typedef {{ type: 'log', level: 'info'|'warn'|'error', msg: string, data?: Record<string, any> }} LogEffect
 * @typedef {{ type: 'game_trace', event: string, data?: Record<string, unknown> }} GameTraceEffect
 *
 * @typedef {EmitNamespaceEffect|EmitSocketEffect|StatsEffect|ScheduleEffect|CancelScheduleEffect|LogEffect|GameTraceEffect} DomainEffect
 */
 
/**
 * @typedef {{ type: string, payload?: any }} DomainAction
 */
 
export {};
