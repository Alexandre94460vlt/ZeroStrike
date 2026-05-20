/**
 * Overlay déconnexion + tentatives de reconnexion Socket.io (écran jeu).
 * @param {import('socket.io-client').Socket} socket
 */
export function setupDisconnectOverlay(socket) {
  const overlay = document.getElementById('disconnect-overlay');
  const hint = document.getElementById('disconnect-hint');
  const retryBtn = document.getElementById('disconnect-retry-btn');
  if (!overlay) return;

  const show = (message) => {
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    if (hint && message) hint.textContent = message;
    retryBtn?.classList.add('hidden');
  };

  const hide = () => {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    retryBtn?.classList.add('hidden');
  };

  socket.on('disconnect', (reason) => {
    const msg =
      reason === 'io server disconnect'
        ? 'Déconnecté par le serveur — reconnexion…'
        : 'Connexion interrompue — reconnexion automatique…';
    show(msg);
  });

  socket.on('connect', () => {
    hide();
  });

  socket.on('reconnect_attempt', (n) => {
    if (hint) hint.textContent = `Reconnexion… (tentative ${n})`;
  });

  socket.on('reconnect_failed', () => {
    if (hint) hint.textContent = 'Impossible de rétablir la connexion.';
    retryBtn?.classList.remove('hidden');
  });

  retryBtn?.addEventListener('click', () => {
    retryBtn?.classList.add('hidden');
    if (hint) hint.textContent = 'Nouvelle tentative…';
    socket.connect();
  });

  if (socket.connected) hide();
}
