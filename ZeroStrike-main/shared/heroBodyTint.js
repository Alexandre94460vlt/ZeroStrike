/**
 * Teinte du corps (sprite unique Kenney) par héros — aligné sur server/models/Heroes.js (couleurs roster).
 * Valeurs 0xRRGGBB pour Phaser setTint.
 */
export const HERO_BODY_TINT_BY_ID = Object.freeze({
  gojo: 0x4fc3f7,
  sukuna: 0xf06292,
  yuta: 0x9e9e9e,
  ichigo: 0x9c27b0,
  toji: 0xa5d6a7,
  jotaro: 0x90caf9,
  dio: 0xffee58,
  naruto: 0xffb74d,
  itachi: 0xce93d8,
  goku: 0xff8a65
});

/**
 * @param {string|null|undefined} heroId
 * @returns {number}
 */
export function getHeroBodyTint(heroId) {
  if (!heroId) return 0xffffff;
  return HERO_BODY_TINT_BY_ID[heroId] ?? 0xffffff;
}
