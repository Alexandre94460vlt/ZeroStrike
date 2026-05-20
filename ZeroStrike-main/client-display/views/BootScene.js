/**
 * BootScene - Chargement et génération procédurale de tous les assets visuels.
 * Soldats top-down dessinés via Canvas API (sans Blender, sans spritesheet).
 * Héros top-down personnalisés (plus de Y Bot / X Bot).
 */
import { getLobbyBaseUrl } from '../services/SocketService.js';
/**
 * Clés `decor_*` / `MAP_DECOR_SUFFIXES` → noms de fichiers réels du pack Kenney (pas de préfixe decor_).
 */
const KENNEY_DECOR_FILE = {
  decor_barrel: 'barrel',
  decor_barrels: 'barrels',
  decor_chest: 'chest',
  decor_crate: 'crate',
  decor_campfire: 'campfire',
  decor_coffin: 'coffin',
  decor_table: 'table'
};

const CHAR_PATH = '/characters/';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const baseUrl = getLobbyBaseUrl();
    // loadAsBlob: false = streaming (évite de charger 25 Mo en mémoire → moins de lag)
    this.load.video('lobby_video', baseUrl + '5921369-hd_1920_1080_30fps.mp4', false);
    /* Previews cartes : fichiers sous assets/served/map/, URL /map/ */
    this.load.image('game_map_dust', '/map/preview-dist2.png');
    this.load.image('map_thumb_dust', '/map/preview-dist2.png');
    this.load.image('map_thumb_ascension', '/map/preview-ascension.png');
    /* Miniatures vote lobby — alignées sur map/preview-*.png */
    this.load.image('map_lobby_dist2', '/map/preview-dist2.png');
    this.load.image('map_lobby_ascension', '/map/preview-ascension.png');
    this.load.image('map_lobby_maven', '/map/preview-Maven.png');
    this.load.image('map_lobby_chadigo', '/map/preview-chadigo.png');
    // ── Fonds de map (export Tiled) — servis par express sous /maps/ ────────────
    this.load.image('map_bg_ascension', '/maps/tiled/tilesets/ascension.png');
    this.load.image('map_bg_dist2', '/maps/tiled/tilesets/dist2.png');
    this.load.image('map_bg_maven', '/maps/tiled/tilesets/maven.png');
    this.load.image('map_bg_chadigo', '/maps/tiled/tilesets/chadigo.png');
    // ── Héros : un seul sprite (silhouette défenseur type Kenney) + teinte par perso en jeu ──
    this.load.image('hero_player_base', CHAR_PATH + 'char_def_0_stand.png');

    // ── Personnages top-down shooter (Kenney) ────────────────────────────────
    const ANIM_POSES = ['stand', 'gun', 'hold', 'machine', 'reload'];
    for (let i = 0; i < 4; i++) {
      this.load.image(`char_def_${i}`, `/characters/char_def_${i}.png`);
      this.load.image(`char_att_${i}`, `/characters/char_att_${i}.png`);
      for (const pose of ANIM_POSES) {
        this.load.image(`char_def_${i}_${pose}`, `/characters/char_def_${i}_${pose}.png`);
        this.load.image(`char_att_${i}_${pose}`, `/characters/char_att_${i}_${pose}.png`);
      }
    }

    // ── Tuiles de donjon (Kenney Scribble Dungeons) ──────────────────────────
    const tileNames = [
      'wall', 'wall_corner', 'wall_damaged', 'wall_demolished',
      'wall_diagonal', 'wall_edge', 'wall_half',
      'tile', 'tiles', 'tiles_cracked', 'tiles_decorative', 'tiles_center',
      'planks', 'inner_round'
    ];
    for (const t of tileNames) {
      this.load.image(`dg_${t}`, `/tiles/${t}.png`);
    }

    // ── Décorations intégrées ─────────────────────────────────────────────────
    const decoNames = ['barrel', 'barrels', 'chest', 'crate', 'campfire', 'coffin', 'table'];
    for (const d of decoNames) {
      const kenneyFile = KENNEY_DECOR_FILE[`decor_${d}`];
      this.load.image(`dg_decor_${d}`, `/tiles/${kenneyFile}.png`);
    }

    // ── Explosions (Kenney Top-Down Tanks Redux) ─────────────────────────────
    for (let i = 1; i <= 5; i++) {
      this.load.image(`explosion_frame_${i}`, `/objects/explosion${i}.png`);
    }

    // ── SFX : multi-kill (fichiers sous /public/sfx/multikill) ────────────────
    this.load.audio('mk_double',    '/sfx/multikill/league-of-legends-double-kill-2.mp3');
    this.load.audio('mk_triple',    '/sfx/multikill/league-of-legends-trible-kill-2.mp3');
    this.load.audio('mk_quadra',    '/sfx/multikill/league-of-legends-quadra-kill-1.mp3');
    this.load.audio('mk_penta',     '/sfx/multikill/league-of-legends-penta-kill-1.mp3');
    this.load.audio('mk_legendary', '/sfx/multikill/league-of-legends-legendary-kill-2.mp3');

    // ── Objets map (barils/caisses) ───────────────────────────────────────────
    this.load.image('obj_barrel_red',   '/objects/barrel_red.png');
    this.load.image('obj_barrel_black', '/objects/barrel_black.png');
    this.load.image('obj_crate_wood',   '/objects/crate_wood.png');
    this.load.image('obj_crate_metal',  '/objects/crate_metal.png');
    this.load.image('obj_sandbag',      '/objects/sandbag.png');
    this.load.image('obj_barricade',    '/objects/barricade.png');

    this.load.on('loaderror', (file) => {
      throw new Error(`[BootScene] Asset obligatoire introuvable : ${file?.src ?? file}`);
    });
  }

  create() {
    this.registry.set('lobbyVideoUrl', getLobbyBaseUrl() + '5921369-hd_1920_1080_30fps.mp4');
    if (this.cache.video.exists('lobby_video')) {
      this.registry.set('lobbyVideoKey', 'lobby_video');
    }
    this.createAllTextures();
    this.scene.start('LobbyScene');
  }

  // ─────────────────────────────────────────────────────────────────────
  //  POINT D'ENTRÉE : génère tous les assets procéduraux
  // ─────────────────────────────────────────────────────────────────────
  createAllTextures() {
    // Soldats — palette : DEF gris, ATT orange / terracotta
    this._createSoldierTex('player_def', '#A8ACB0', '#3A3E42', '#6E7278');
    this._createSoldierTex('player_att', '#FF6B35', '#6B2814', '#C44D28');

    this._createDroneTex('drone_def', '#8A9098');
    this._createDroneTex('drone_att', '#FF5A28');

    // Sol tuile répétée (Dead Ops dark grid)
    this._createFloorTile();

    // Murs vue isométrique top-down
    this._createWallTile('wall_full_tile', false);
    this._createWallTile('wall_edge_tile', true);

    // Projectile (tracer lumineux)
    this._createProjectileTex();

    // Particules
    this._createParticleTex('muzzle_flash', ['rgba(255,255,200,1)', 'rgba(255,200,80,0.7)', 'rgba(255,80,0,0)'], 24);
    this._createParticleTex('explosion_particle', ['rgba(255,180,50,0.9)', 'rgba(255,60,0,0.6)', 'rgba(200,0,0,0)'], 24);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  SOLDAT TOP-DOWN (64×64, neutre orienté vers la DROITE = est)
  //  Le sprite sera tourné pour suivre l'angle de visée via sprite.rotation
  // ─────────────────────────────────────────────────────────────────────
  _createSoldierTex(key, mainHex, darkHex, helmetHex) {
    const size = 64;
    const cvs = this.textures.createCanvas(key, size, size);
    const ctx = cvs.getContext('2d');
    // Le personnage regarde à DROITE (est). Centre = (32,32).
    const cx = 30, cy = 32;

    // ── Ombre au sol ──────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000010';
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy + 5, 18, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Jambes (deux cylindres vus du dessus) ────────────────
    const legColor = '#141428';
    ctx.fillStyle = legColor;
    ctx.beginPath(); ctx.ellipse(cx - 7, cy - 7, 5, 8, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - 7, cy + 7, 5, 8, 0.25, 0, Math.PI * 2);  ctx.fill();

    // Chaussures (légèrement plus sombres, arrondies)
    ctx.fillStyle = '#0d0d20';
    ctx.beginPath(); ctx.ellipse(cx - 10, cy - 7, 5, 4, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - 10, cy + 7, 5, 4, 0.1, 0, Math.PI * 2);  ctx.fill();

    // ── Corps / gilet tactique ───────────────────────────────
    ctx.fillStyle = darkHex;
    this._rr(ctx, cx - 16, cy - 11, 26, 22, 6);
    ctx.fill();

    // Lignes du gilet
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = this._darken(darkHex, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 9); ctx.lineTo(cx - 5, cy + 9);
    ctx.moveTo(cx + 1, cy - 9); ctx.lineTo(cx + 1, cy + 9);
    ctx.stroke();
    // Poche
    ctx.strokeStyle = this._darken(darkHex, 0.4);
    ctx.strokeRect(cx - 14, cy - 2, 6, 6);
    ctx.restore();

    // ── Épaulettes ──────────────────────────────────────────
    ctx.fillStyle = mainHex;
    ctx.globalAlpha = 0.88;
    ctx.beginPath(); ctx.ellipse(cx - 12, cy - 11, 7, 5, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - 12, cy + 11, 7, 5, 0.5, 0, Math.PI * 2);  ctx.fill();
    ctx.globalAlpha = 1;

    // ── Bras droit (tenant l'arme, vers la droite) ──────────
    ctx.fillStyle = this._darken(darkHex, 0.1);
    ctx.beginPath(); ctx.ellipse(cx + 7, cy + 3, 11, 5, 0.15, 0, Math.PI * 2); ctx.fill();

    // ── Tête ────────────────────────────────────────────────
    // Peau
    ctx.fillStyle = '#c8855a';
    ctx.beginPath(); ctx.arc(cx + 13, cy, 11, 0, Math.PI * 2); ctx.fill();

    // Casque (demi-cercle)
    ctx.fillStyle = helmetHex;
    ctx.globalAlpha = 0.93;
    ctx.beginPath(); ctx.arc(cx + 13, cy, 11, Math.PI, 0); ctx.fill();
    // Bande frontale casque
    ctx.fillStyle = this._darken(helmetHex, 0.25);
    ctx.fillRect(cx + 2, cy - 2, 22, 4);
    ctx.globalAlpha = 1;

    // Masque / lunettes tactiques
    ctx.fillStyle = '#0d0d22';
    ctx.globalAlpha = 0.72;
    ctx.fillRect(cx + 4, cy - 2, 16, 5);
    // Reflet verre
    ctx.fillStyle = 'rgba(80,200,255,0.25)';
    ctx.fillRect(cx + 5, cy - 1, 6, 2);
    ctx.globalAlpha = 1;

    // ── Indicateur de direction (dot brillant = "nez") ──────
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.arc(cx + 23, cy, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // ── Contour néon équipe (reflet sur le sol) ──────────────
    ctx.strokeStyle = mainHex;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.18;
    ctx.beginPath(); ctx.ellipse(cx, cy, 22, 16, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;

    cvs.refresh();
  }

  // ─────────────────────────────────────────────────────────────────────
  //  MINI-DRONE (32×32 vue de dessus, style quadcopter)
  // ─────────────────────────────────────────────────────────────────────
  _createDroneTex(key, hexColor) {
    const size = 32;
    const cvs = this.textures.createCanvas(key, size, size);
    const ctx = cvs.getContext('2d');
    const cx = 16, cy = 16;

    // Ombre
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.ellipse(cx + 2, cy + 3, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Bras en croix
    ctx.fillStyle = this._darken(hexColor, 0.3);
    ctx.fillRect(cx - 12, cy - 2, 24, 4); // horizontal
    ctx.fillRect(cx - 2, cy - 12, 4, 24); // vertical

    // Corps central (hexagone simplifié = arrondi)
    ctx.fillStyle = this._darken(hexColor, 0.15);
    this._rr(ctx, cx - 6, cy - 6, 12, 12, 3);
    ctx.fill();

    // Rotors (4 ellipses semi-transparentes = illusion rotation)
    const rotorPos = [[-9, -9], [9, -9], [-9, 9], [9, 9]];
    rotorPos.forEach(([rx, ry]) => {
      ctx.fillStyle = 'rgba(180,220,255,0.22)';
      ctx.beginPath(); ctx.ellipse(cx + rx, cy + ry, 7, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = hexColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(cx + rx, cy + ry, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // DEL centrale (LED de position)
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
    // Halo LED
    ctx.fillStyle = hexColor;
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    cvs.refresh();
  }

  // ─────────────────────────────────────────────────────────────────────
  //  SOL — tuile 64×64, style Dead Ops Arcade (dalles sombres)
  // ─────────────────────────────────────────────────────────────────────
  _createFloorTile() {
    const size = 64;
    const cvs = this.textures.createCanvas('floor_tile', size, size);
    const ctx = cvs.getContext('2d');

    // Base sombre
    ctx.fillStyle = '#0b0b17';
    ctx.fillRect(0, 0, size, size);

    // Grille subtile
    ctx.strokeStyle = '#111126';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

    // Diagonales légères (grain / usure)
    ctx.strokeStyle = '#0e0e20';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    for (let i = -size; i < size * 2; i += 14) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Rivets de coin (style métal industriel)
    ctx.fillStyle = '#181835';
    [2, size - 4].forEach(bx => [2, size - 4].forEach(by => {
      ctx.beginPath(); ctx.arc(bx + 1, by + 1, 2, 0, Math.PI * 2); ctx.fill();
    }));

    // Légère variation de couleur au centre (vieilli)
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(30,30,50,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    cvs.refresh();
  }

  // ─────────────────────────────────────────────────────────────────────
  //  MUR — vue isométrique top-down (effet 3D avec face éclairée)
  // ─────────────────────────────────────────────────────────────────────
  _createWallTile(key, isEdge) {
    const size = 60;
    const cvs = this.textures.createCanvas(key, size, size);
    const ctx = cvs.getContext('2d');

    if (isEdge) {
      // Mur de bordure : béton avec relief
      ctx.fillStyle = '#141428';
      ctx.fillRect(0, 0, size, size);

      // Face HAUT (éclairée)
      ctx.fillStyle = '#252548';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(size, 0);
      ctx.lineTo(size - 8, 8); ctx.lineTo(8, 8); ctx.closePath();
      ctx.fill();

      // Face GAUCHE (éclairée, moins)
      ctx.fillStyle = '#1e1e40';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(8, 8);
      ctx.lineTo(8, size - 8); ctx.lineTo(0, size); ctx.closePath();
      ctx.fill();

      // Face DROITE (ombre)
      ctx.fillStyle = '#0c0c1e';
      ctx.beginPath();
      ctx.moveTo(size, 0); ctx.lineTo(size, size);
      ctx.lineTo(size - 8, size - 8); ctx.lineTo(size - 8, 8); ctx.closePath();
      ctx.fill();

      // Face BAS (ombre forte)
      ctx.fillStyle = '#0a0a18';
      ctx.beginPath();
      ctx.moveTo(0, size); ctx.lineTo(size, size);
      ctx.lineTo(size - 8, size - 8); ctx.lineTo(8, size - 8); ctx.closePath();
      ctx.fill();

      // Surface centrale (intérieur du mur)
      ctx.fillStyle = '#141428';
      ctx.fillRect(8, 8, size - 16, size - 16);

      // Texture brique légère sur la surface
      ctx.strokeStyle = '#1c1c36';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.strokeRect(10, 10, size - 20, size - 20);
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(8, 24); ctx.lineTo(size - 8, 24);
      ctx.moveTo(8, 38); ctx.lineTo(size - 8, 38);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Contour néon bleuté (Dead Ops glow)
      ctx.strokeStyle = '#2a2a5a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(1, 1, size - 2, size - 2);

    } else {
      // Mur plein : très sombre (zone inaccessible)
      ctx.fillStyle = '#060612';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#0f0f22';
      ctx.lineWidth = 1;
      ctx.strokeRect(2, 2, size - 4, size - 4);
      // Bruit subtil
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, size / 2, size / 2);
      ctx.fillRect(size / 2, size / 2, size / 2, size / 2);
    }

    cvs.refresh();
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PROJECTILE — tracer lumineux (bullet trail, orienté horizontal)
  // ─────────────────────────────────────────────────────────────────────
  _createProjectileTex() {
    const cvs = this.textures.createCanvas('projectile', 20, 8);
    const ctx = cvs.getContext('2d');
    const grad = ctx.createLinearGradient(0, 4, 20, 4);
    grad.addColorStop(0, 'rgba(255,255,150,0)');
    grad.addColorStop(0.4, 'rgba(255,255,120,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(12, 4, 9, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cœur blanc brillant
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(18, 4, 2, 0, Math.PI * 2); ctx.fill();
    cvs.refresh();
  }

  // ─────────────────────────────────────────────────────────────────────
  //  PARTICULE générique (dégradé radial)
  // ─────────────────────────────────────────────────────────────────────
  _createParticleTex(key, stops, size) {
    const cvs = this.textures.createCanvas(key, size, size);
    const ctx = cvs.getContext('2d');
    const cx = size / 2;
    const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    stops.forEach((color, i) => grad.addColorStop(i / (stops.length - 1), color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    cvs.refresh();
  }

  // ─────────────────────────────────────────────────────────────────────
  //  UTILITAIRES
  // ─────────────────────────────────────────────────────────────────────

  /** Rectangle arrondi (canvas 2d) */
  _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /** Assombrit une couleur hex d'un facteur (0-1) */
  _darken(hex, amount = 0.2) {
    const c = hex.replace('#', '');
    const r = Math.max(0, Math.round(parseInt(c.substr(0, 2), 16) * (1 - amount)));
    const g = Math.max(0, Math.round(parseInt(c.substr(2, 2), 16) * (1 - amount)));
    const b = Math.max(0, Math.round(parseInt(c.substr(4, 2), 16) * (1 - amount)));
    return `rgb(${r},${g},${b})`;
  }

}
