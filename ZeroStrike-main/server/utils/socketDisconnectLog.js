/**
 * Log structuré des déconnexions Socket.io (observabilité : Render, Wi‑Fi, ping timeout).
 * Une ligne JSON par événement — facile à greper dans les logs Render sans PII lourde.
 *
 * @param {'mobile' | 'display'} namespace
 * @param {string} socketId
 * @param {string} [reason] — fourni par Socket.io (ex. transport close, ping timeout, client namespace disconnect)
 * @param {Record<string, unknown>} [extra] — champs optionnels (jamais de mot de passe)
 */
export function logSocketDisconnect(namespace, socketId, reason, extra = {}) {
  const sid = typeof socketId === 'string' && socketId.length > 8
    ? `${socketId.slice(0, 8)}…`
    : String(socketId || '');
  const line = {
    zs: 'socket_disconnect',
    ns: namespace,
    sid,
    reason: reason != null ? String(reason) : '',
    t: Date.now(),
    ...extra
  };
  console.log(JSON.stringify(line));
}
