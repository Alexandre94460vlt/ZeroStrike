/**
 * Palette capsule : noir pur → orange vif → bruns → gris → blanc nacré.
 * DEF = côté gris (slate/silver), ATT = côté orange chaud.
 */
export const Palette = {
  black: '#000000',
  orangeVivid: '#FF4F00',
  orangeBurnt: '#D9481C',
  terracotta: '#B85C3E',
  chocolate: '#5C3D30',
  espresso: '#241A16',
  charcoal: '#1E1E1E',
  slate: '#6E6E6E',
  silver: '#B8B8B8',
  pearl: '#ECE8E4',
  white: '#FFFFFF',
  orangeVividHex: 0xff4f00,
  orangeBurntHex: 0xd9481c,
  terracottaHex: 0xb85c3e,
  chocolateHex: 0x5c3d30,
  espressoHex: 0x241a16,
  charcoalHex: 0x1e1e1e,
  slateHex: 0x6e6e6e,
  silverHex: 0xb8b8b8,
  pearlHex: 0xece8e4
};

export const UITheme = {
  text: Palette.silver,
  white: Palette.pearl,
  gray: Palette.slate,
  accent: Palette.orangeVivid,
  accentHex: Palette.orangeVividHex,
  accentSoftHex: Palette.orangeBurntHex,
  panelAlpha: 0.78,
  /** Lobby / titres « militaires » */
  fontTitle: 'Oswald',
  /** Interface lecture (labels, listes, boutons lobby) */
  fontUi: 'Rajdhani',
  /** @deprecated Préférer fontUi ; conservé pour HUD jeu (Teko) tant que non migré */
  font: 'Teko',
  /** DEF = neutre froid (gris palette) — scores / HUD, pas les sprites monde */
  defHex: 0x9ca0a8,
  attHex: 0xff6b35,
  defString: '#9CA0A8',
  attString: '#FF6B35',
  /** Teinte multiplicative sur les sprites joueurs (ATT chaud, DEF bleu) */
  spriteTintAtt: 0xff782e,
  spriteTintDef: 0x5ca8f0,
  /** Halo discret sous les pieds (même lecture d’équipe que les teintes) */
  spriteGlowAtt: 0xff6b35,
  spriteGlowDef: 0x4a9fe8,
  /** Couleur du pseudo au-dessus du personnage */
  playerNameAtt: '#FF9D6B',
  playerNameDef: '#8CC8FF',
  /** Projectiles (Phaser tint + particules) : ATT vert, DEF rouge — lecture type Star Wars */
  projectileTintAtt: 0x52ff7a,
  projectileTintDef: 0xff3d4d,
  /** Sites / bombe — chauds */
  siteFill: Palette.terracottaHex,
  siteStroke: Palette.orangeBurntHex,
  bombCore: Palette.orangeVividHex,
  hudStroke: Palette.black,
  killFeedBorder: Palette.orangeBurntHex,
  panelDark: Palette.espressoHex
};
