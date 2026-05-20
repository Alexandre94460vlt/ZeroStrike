/**
 * Utilitaires de persistance de session joueur (localStorage).
 * La session permet le rejoin automatique après rechargement ou reconnexion réseau.
 *
 * Format stocké : { sessionId, name, team?, avatarDataUrl? }
 * team : 'LOBBY' en file d’attente ; 'ATT' | 'DEF' une fois assigné par le serveur.
 */

const SESSION_KEY = 'zs_session';

/**
 * Retourne la session sauvegardée, ou null si absente / corrompue.
 * @returns {{ sessionId: string, name: string, team?: string, avatarDataUrl?: string | null } | null}
 */
export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.sessionId || !parsed?.name) return null;
    // avatarDataUrl peut être null/undefined, on le garde tel quel
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Sauvegarde une session en localStorage.
 * @param {string} sessionId
 * @param {string} name
 * @param {string} [team] — défaut 'LOBBY' si omis
 * @param {string|null} [avatarDataUrl] — data URL (petite), optionnelle
 */
export function saveSession(sessionId, name, team = 'LOBBY', avatarDataUrl = null) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId, name, team, avatarDataUrl }));
  } catch {
    // Navigation privée ou stockage plein : on ignore silencieusement
  }
}

/**
 * Efface la session sauvegardée (déconnexion volontaire ou session expirée).
 */
export function clearStoredSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
