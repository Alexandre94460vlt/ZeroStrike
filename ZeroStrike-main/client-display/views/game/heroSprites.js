/**
 * Affichage héros : une seule texture Kenney (BootScene `hero_player_base`), teinte par perso.
 * Les poses stand/run/compétence ne changent plus de fichier (léger bob en course).
 */

const HERO_BASE_TEXTURE = 'hero_player_base';

/**
 * @param {Phaser.Scene} scene
 * @param {string} _heroId
 * @param {string} _pose 'stand' | 'run' | 'competence'
 * @returns {string} clé texture
 */
export function heroTextureKey(scene, _heroId, _pose) {
  if (!scene.textures.exists(HERO_BASE_TEXTURE)) {
    throw new Error(`[heroSprites] Texture base héros manquante : ${HERO_BASE_TEXTURE}`);
  }
  return HERO_BASE_TEXTURE;
}

/**
 * Met à jour pose, flip et taille pour un joueur héros (appelé chaque frame depuis updateLoop).
 * @param {Phaser.Scene} scene
 * @param {object} entry entrée scene.players
 * @param {number} aimBase rotation visée (rad), cohérente avec le serveur
 * @param {boolean} moving déplacement interpolé visible
 * @param {number} nowMs temps jeu ms
 */
export function updateHeroSpriteFrame(scene, entry, aimBase, moving, nowMs) {
  const { heroId, sprite } = entry;
  if (!heroId || !sprite) return;

  let pose = 'stand';
  if (entry._shootUntil && nowMs < entry._shootUntil) pose = 'competence';
  else if (moving) pose = 'run';

  /* Sprites profil « regardent vers la droite » : flip quand la visée pointe à gauche */
  const facingRight = Math.cos(aimBase) >= 0;
  sprite.setFlipX(!facingRight);

  const key = heroTextureKey(scene, heroId, pose);

  if (sprite.texture.key !== key) sprite.setTexture(key);
  sprite.setScale(1);
  sprite.setOrigin(0.5, 0.5);
  sprite.setDisplaySize(52, 52);

  /* Léger roulis en course (après setDisplaySize pour ne pas combattre l’échelle) */
  if (moving && pose !== 'competence') {
    entry._heroBobPhase = (entry._heroBobPhase || 0) + 0.22;
    sprite.setRotation(Math.sin(entry._heroBobPhase) * 0.045);
  } else {
    sprite.setRotation(0);
  }
}
