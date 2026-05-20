/**
 * Texte affiché dans le HUD Phaser (kill feed, commentaires).
 * Phaser ne parse pas le HTML, mais on neutralise caractères de contrôle
 * et longueurs excessives (homogénéité UI, défense en profondeur).
 */

const CTRL = /[\u0000-\u001F\u007F]/g;

/**
 * @param {unknown} str
 * @param {number} maxLen
 * @returns {string}
 */
export function sanitizeHudText(str, maxLen = 120) {
  if (str == null) return '';
  return String(str).replace(CTRL, '').slice(0, maxLen);
}
