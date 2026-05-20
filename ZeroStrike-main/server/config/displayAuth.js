/**
 * Mot de passe du namespace Socket.io /display (projecteur).
 * Chaîne vide ou variable absente = pas d’authentification (pratique en dev local).
 * Pour la démo / Render : définir DISPLAY_PASSWORD (voir .env.example, render.yaml).
 */
export function getDisplayPasswordSecret() {
  const v = process.env.DISPLAY_PASSWORD;
  if (v == null) return '';
  const t = String(v).trim();
  return t;
}

export function isDisplayAuthEnabled() {
  return getDisplayPasswordSecret().length > 0;
}
