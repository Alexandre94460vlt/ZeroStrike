/**
 * Génère le PPTX de soutenance à partir de la maquette docs/SOUTENANCE_TRANSPARENTS_TP4E-G1.md
 * Charte : fond #0d1117, texte #f6f8fa, accent #f97316 — 16:9
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PptxGenJS from 'pptxgenjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'SOUTENANCE_TP4E-G1_ZeroStrike.pptx');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');

const BG = '0d1117';
const FG = 'f6f8fa';
const ACCENT = 'f97316';
const MUTED = '8b949e';
const CARD = '21262d';

function stripMd(s) {
  return String(s).replace(/\*\*/g, '');
}

function shot(name) {
  const p = path.join(SHOTS, name);
  return fs.existsSync(p) ? p : null;
}

function footer(slide, slideNum, extra = '') {
  const base = `Zero Strike · BUT 2 · TP4E-G1 · Présentateur : Prénom NOM${extra}`;
  slide.addText(base, {
    x: 0.45,
    y: 5.32,
    w: 8.8,
    h: 0.28,
    fontSize: 9,
    color: MUTED,
    fontFace: 'Calibri'
  });
  slide.addText(String(slideNum), {
    x: 9.35,
    y: 5.32,
    w: 0.5,
    h: 0.28,
    fontSize: 9,
    color: MUTED,
    align: 'right',
    fontFace: 'Calibri'
  });
}

function title(slide, t) {
  slide.addText(stripMd(t), {
    x: 0.45,
    y: 0.35,
    w: 9.1,
    h: 0.55,
    fontSize: 26,
    bold: true,
    color: ACCENT,
    fontFace: 'Calibri'
  });
}

function bullets(slide, lines, y, w = 9, h = 2.2, size = 14) {
  const body = lines.map((line) => ({
    text: stripMd(line).replace(/^[-•]\s*/, '') + '\n',
    options: { bullet: true, fontSize: size, color: FG, fontFace: 'Calibri', breakLine: true }
  }));
  slide.addText(body, { x: 0.45, y, w, h, valign: 'top' });
}

function flowBox(slide, text, x, y, w, h) {
  slide.addText(text, {
    x,
    y,
    w,
    h,
    fontSize: 10,
    bold: true,
    color: FG,
    align: 'center',
    valign: 'middle',
    fontFace: 'Calibri',
    fill: { color: CARD }
  });
}

function arrowText(slide, x, y) {
  slide.addText('→', { x, y, w: 0.35, h: 0.35, fontSize: 14, color: ACCENT, align: 'center' });
}

function safeImage(slide, file, opts) {
  if (!file) return;
  try {
    slide.addImage({ path: file, ...opts });
  } catch (e) {
    console.warn('[pptx] Image ignorée:', file, e.message);
  }
}

const pres = new PptxGenJS();
pres.layout = 'LAYOUT_16x9';
pres.author = 'TP4E-G1';
pres.title = 'Zero Strike — Soutenance';
pres.subject = 'Transparentes BUT 2';

// --- Slide 1 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  s.addText('Zero Strike', {
    x: 0.45,
    y: 0.35,
    w: 9.1,
    h: 0.55,
    fontSize: 36,
    bold: true,
    color: ACCENT,
    fontFace: 'Calibri'
  });
  s.addText('Jeu de tir tactique multijoueur sur LAN — jusqu’à 40 joueurs', {
    x: 0.45,
    y: 0.95,
    w: 9.1,
    h: 0.4,
    fontSize: 16,
    color: FG,
    fontFace: 'Calibri'
  });
  bullets(
    s,
    [
      '- Grand écran (Phaser 3) : /display — arène visible par tout le monde',
      '- Smartphone : /mobile — manette (joystick, tir, shop)',
      '- Hub / — orientation joueurs · TP4E-G1 · Ilian El Bouazzaoui Prieur · Mahamat Ibrahim'
    ],
    1.38,
    9.1,
    1.15,
    13
  );
  const yArch = 2.38;
  const bw = 2.05;
  const bh = 0.42;
  let x0 = 1.15;
  flowBox(s, 'Mobile', x0, yArch, bw, bh);
  arrowText(s, x0 + bw + 0.02, yArch + 0.04);
  x0 += bw + 0.38;
  flowBox(s, 'Serveur', x0, yArch, bw, bh);
  arrowText(s, x0 + bw + 0.02, yArch + 0.04);
  x0 += bw + 0.38;
  flowBox(s, 'Display', x0, yArch, bw, bh);
  const yImg = 3.02;
  safeImage(s, shot('lobbyDisplay.png'), { x: 0.45, y: yImg, w: 5.15, h: 2.05 });
  safeImage(s, shot('mobileFirstPage.png'), { x: 5.75, y: yImg, w: 3.85, h: 2.05 });
  footer(s, 1);
}

// --- Slide 2 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  title(s, 'Pitch & public cible');
  bullets(
    s,
    [
      '- Pitch : affrontement tactique temps réel, pensé salle de cours, LAN party, soutenance jury (vidéoprojecteur).',
      '- Objectif joueur : gagner la manche (S&D) ou dominer au score (DM).',
      '- Public : casual à compétitif ; 1 serveur + téléphones ; démo Render (plan gratuit) HTTPS ou LAN secours.'
    ],
    1.05,
    6.2,
    2.35,
    13
  );
  safeImage(s, shot('lobbyDisplay.png'), { x: 6.85, y: 1.05, w: 2.75, h: 1.55 });
  footer(s, 2);
}

// --- Slide 3 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  title(s, 'Modes de jeu (GDD)');
  bullets(
    s,
    [
      '- Search & Destroy (S&D) : attaque / défense, plantage / désamorçage, sites A/B (+ C selon carte), économie entre manches (règles serveur).',
      '- Deathmatch (DM) : victoire par limite de frags configurable.',
      '- Lobby : équipe, vote de carte, prêt ; lancement par l’hôte sur le display.'
    ],
    1.05,
    5.15,
    2.85,
    12
  );
  safeImage(s, shot('ChoixMapMobile.png'), { x: 5.75, y: 1.0, w: 3.85, h: 3.95 });
  const y = 3.55;
  const w = 1.35;
  flowBox(s, 'S&D', 0.55, y, w, 0.38);
  flowBox(s, 'DM', 2.05, y, w, 0.38);
  footer(s, 3);
}

// --- Slide 4 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  title(s, 'Boucle d’une manche');
  const steps = [
    '1. Lobby — QR / URL, pseudo, équipe, vote map, lancement hôte',
    '2. Buy phase — armes / héros, budget ; durée selon preset',
    '3. Action — déplacements, tirs, bombe (S&D) ; durée selon preset',
    '4. Fin de round — score, économie, manche suivante'
  ];
  bullets(s, steps, 1.05, 9.1, 1.35, 13);
  const yt = 2.52;
  const tw = 1.85;
  const th = 0.4;
  const labels = ['Lobby', 'Buy', 'Action', 'Fin'];
  let xx = 0.55;
  for (let i = 0; i < 4; i++) {
    flowBox(s, labels[i], xx, yt, tw, th);
    if (i < 3) arrowText(s, xx + tw + 0.02, yt + 0.05);
    xx += tw + 0.35;
  }
  safeImage(s, shot('lobbyDisplayAvecJoueurPret.png'), { x: 0.45, y: 3.15, w: 4.65, h: 2.05 });
  safeImage(s, shot('IngameAscension.png'), { x: 5.25, y: 3.15, w: 4.35, h: 2.05 });
  footer(s, 4);
}

// --- Slide 5 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  title(s, 'Originalité du projet');
  bullets(
    s,
    [
      '- Spectacle : grand écran public / entrée joueur mobile.',
      '- Serveur autoritaire : ~60 TPS ; display ~30 Hz + dirty ; intentions (anti-triche simple).',
      '- Cartes : Tiled .tmj 80×45 + repli ASCII.',
      '- Produit : SQLite (sql.js), API /api/*, CI + Playwright, Docker, Render (plan gratuit).'
    ],
    1.05,
    5.0,
    2.45,
    12
  );
  safeImage(s, shot('IngameAscension.png'), { x: 5.55, y: 1.0, w: 4.05, h: 2.05 });
  safeImage(s, shot('Classement.png'), { x: 5.55, y: 3.15, w: 4.05, h: 1.85 });
  const yf = 4.68;
  const bw = 2.35;
  let xf = 0.65;
  flowBox(s, 'Intentions\n(mobile)', xf, yf, bw, 0.52);
  arrowText(s, xf + bw + 0.02, yf + 0.12);
  xf += bw + 0.38;
  flowBox(s, 'Serveur\n~60 TPS', xf, yf, bw, 0.52);
  arrowText(s, xf + bw + 0.02, yf + 0.12);
  xf += bw + 0.38;
  flowBox(s, 'Display\n~30 Hz', xf, yf, bw, 0.52);
  footer(s, 5);
}

// --- Slide 6 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  title(s, 'Stack & accès');
  const rows = [
    [
      { text: 'Rôle', options: { bold: true, color: FG, fill: { color: CARD } } },
      { text: 'Technologie', options: { bold: true, color: FG, fill: { color: CARD } } }
    ],
    [{ text: 'Serveur', options: { color: FG } }, { text: 'Node.js 20+ (ESM), Express, Socket.io v4', options: { color: FG } }],
    [{ text: 'Display', options: { color: FG } }, { text: 'Phaser 3, Vite', options: { color: FG } }],
    [{ text: 'Mobile', options: { color: FG } }, { text: 'HTML5, Nipple.js, Vite', options: { color: FG } }],
    [{ text: 'Web', options: { color: FG } }, { text: 'Hub /, santé /health', options: { color: FG } }],
    [{ text: 'Données', options: { color: FG } }, { text: 'sql.js, /api/*', options: { color: FG } }],
    [
      { text: 'Déploiement', options: { color: FG } },
      { text: 'Docker Compose, Render (render.yaml, plan gratuit) — démo HTTPS', options: { color: FG } }
    ]
  ];
  s.addTable(rows, {
    x: 0.45,
    y: 1.0,
    w: 9.1,
    colW: [2.2, 6.9],
    border: { type: 'solid', color: CARD, pt: 1 },
    fontSize: 11,
    fontFace: 'Calibri',
    fill: { color: '161b22' }
  });
  const yl = 3.55;
  const lw = 1.55;
  const cols = ['Display', 'Mobile', 'Serveur', 'Données', 'Déploiement'];
  let xc = 0.5;
  for (const c of cols) {
    flowBox(s, c, xc, yl, lw, 0.42);
    xc += lw + 0.12;
  }
  safeImage(s, shot('lobbyDisplay.png'), { x: 0.45, y: 4.25, w: 2.35, h: 0.95 });
  safeImage(s, shot('mobileFirstPage.png'), { x: 2.95, y: 4.25, w: 2.35, h: 0.95 });
  footer(s, 6);
}

// --- Slide 7 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  title(s, 'Organisation — partage du travail');
  s.addText('À 2 personnes (adapter si besoin) :', {
    x: 0.45,
    y: 0.98,
    w: 9,
    h: 0.25,
    fontSize: 12,
    color: MUTED,
    fontFace: 'Calibri'
  });
  const rows = [
    [
      { text: 'Domaine', options: { bold: true, color: FG, fill: { color: CARD } } },
      { text: 'Responsable principal', options: { bold: true, color: FG, fill: { color: CARD } } }
    ],
    [
      { text: 'Serveur, gameplay, Socket.io, server/domain/', options: { color: FG } },
      { text: 'Ilian El Bouazzaoui Prieur', options: { color: FG } }
    ],
    [
      { text: 'Display Phaser + client mobile (UX, shop, sync)', options: { color: FG } },
      { text: 'Mahamat Ibrahim', options: { color: FG } }
    ],
    [
      { text: 'Transversal : Tiled, DevOps, tests', options: { color: FG } },
      { text: 'À préciser à l’oral', options: { color: FG } }
    ]
  ];
  s.addTable(rows, {
    x: 0.45,
    y: 1.28,
    w: 9.1,
    colW: [4.5, 4.6],
    border: { type: 'solid', color: CARD, pt: 1 },
    fontSize: 11,
    fontFace: 'Calibri',
    fill: { color: '161b22' }
  });
  flowBox(s, 'Ilian', 1.2, 3.35, 2.4, 0.45);
  flowBox(s, 'Mahamat', 5.8, 3.35, 2.4, 0.45);
  s.addText('← Tiled, DevOps, tests (transversal) →', {
    x: 2.8,
    y: 3.92,
    w: 4.4,
    h: 0.3,
    fontSize: 11,
    color: ACCENT,
    align: 'center',
    fontFace: 'Calibri'
  });
  footer(s, 7);
}

// --- Slide 8 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  title(s, 'Planning — jalons');
  const rows = [
    [
      { text: 'Phase', options: { bold: true, color: FG, fill: { color: CARD } } },
      { text: 'Livrable', options: { bold: true, color: FG, fill: { color: CARD } } }
    ],
    [
      { text: 'Jalon 1', options: { color: ACCENT, bold: true } },
      { text: 'HTTP + Socket.io, lobby minimal, architecture domaine / app', options: { color: FG } }
    ],
    [
      { text: 'Jalon 2', options: { color: ACCENT, bold: true } },
      { text: 'Display + mobile ; déplacements, collisions serveur', options: { color: FG } }
    ],
    [
      { text: 'Jalon 3', options: { color: ACCENT, bold: true } },
      { text: 'Tirs, projectiles, S&D (bombe, économie), scoreboard', options: { color: FG } }
    ],
    [
      { text: 'Jalon 4', options: { color: ACCENT, bold: true } },
      { text: 'Tiled, presets, polish UX, Docker / Render, stabilisation, stress LAN', options: { color: FG } }
    ]
  ];
  s.addTable(rows, {
    x: 0.45,
    y: 1.0,
    w: 9.1,
    colW: [1.35, 7.75],
    border: { type: 'solid', color: CARD, pt: 1 },
    fontSize: 11,
    fontFace: 'Calibri',
    fill: { color: '161b22' }
  });
  const yj = 3.45;
  const jw = 1.65;
  let xj = 0.85;
  for (const lab of ['J1', 'J2', 'J3', 'J4']) {
    flowBox(s, lab, xj, yj, jw, 0.42);
    if (lab !== 'J4') arrowText(s, xj + jw + 0.02, yj + 0.08);
    xj += jw + 0.38;
  }
  footer(s, 8);
}

// --- Slide 9 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  title(s, 'Problèmes techniques rencontrés');
  bullets(
    s,
    [
      '- Build / prod : chemins assets (maps/ vs Docker / Render) ; dépendances front (polices) et Vite.',
      '- Gameplay : spawns sur obstacles ; axes joystick ; économie alignée serveur.',
      '- Réseau / perf : free tier (cold start), charge ; logs 60 TPS ; Phaser destroy/clear.',
      '- Mitigation : npm run build, npm test, docs/, audit.'
    ],
    1.05,
    6.4,
    2.85,
    12
  );
  safeImage(s, shot('IngameAscension.png'), { x: 6.95, y: 3.35, w: 2.65, h: 1.45 });
  s.addText('Chemins maps/ → image Docker → solution : chemins relatifs + tests build', {
    x: 0.45,
    y: 4.35,
    w: 8.5,
    h: 0.45,
    fontSize: 10,
    color: MUTED,
    fontFace: 'Calibri',
    italic: true
  });
  footer(s, 9);
}

// --- Slide 10 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  title(s, 'Problèmes humains & organisation');
  bullets(
    s,
    [
      '- Coordination : branches, intégration sur main, déploiement Render.',
      '- Arbitrage du temps : gameplay vs UI vs maps.',
      '- Solutions : commits clairs, pair programming (socket + display), checklist build + test + démo avant merge.'
    ],
    1.05,
    9.1,
    2.8,
    14
  );
  footer(s, 10);
}

// --- Slide 11 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  title(s, 'Démonstration Zero Strike');
  bullets(
    s,
    [
      '- Démo sur Render (plan gratuit) : https://<service>.onrender.com — /display, /mobile, /. Réveiller le service (cold start).',
      '- Salle : vidéoprojecteur = display ; téléphones = même URL (Wi-Fi ou données).',
      '- Plan B : npm start + http://<IP_LAN>:3000/... si Render ou réseau bloque.',
      '- Déroulé : connexion → vote carte → buy → action → fin de manche. « Nous lançons la partie maintenant. »'
    ],
    1.05,
    5.05,
    2.35,
    11
  );
  safeImage(s, shot('lobbyDisplay.png'), { x: 5.55, y: 1.0, w: 2.05, h: 1.05 });
  safeImage(s, shot('ChoixMapMobile.png'), { x: 7.75, y: 1.0, w: 1.85, h: 1.65 });
  safeImage(s, shot('mobileFirstPage.png'), { x: 5.55, y: 2.15, w: 1.85, h: 1.25 });
  s.addText('Projecteur\n(display)', { x: 0.55, y: 3.55, w: 1.8, h: 0.55, fontSize: 11, bold: true, color: FG, align: 'center', valign: 'middle', fill: { color: CARD }, fontFace: 'Calibri' });
  s.addText('→', { x: 2.42, y: 3.68, w: 0.35, h: 0.3, fontSize: 16, color: ACCENT });
  s.addText('Téléphones\n(mobile)', { x: 2.85, y: 3.55, w: 1.8, h: 0.55, fontSize: 11, bold: true, color: FG, align: 'center', valign: 'middle', fill: { color: CARD }, fontFace: 'Calibri' });
  s.addText('Même hôte (URL Render ou IP LAN)', {
    x: 0.45,
    y: 4.35,
    w: 4.5,
    h: 0.35,
    fontSize: 11,
    color: ACCENT,
    fontFace: 'Calibri'
  });
  footer(s, 11, ' (pilote machine)');
}

// --- Slide 12 ---
{
  const s = pres.addSlide({ background: { color: BG } });
  title(s, 'Scénario démo (aide-mémoire)');
  const rows = [
    [
      { text: 'Étape', options: { bold: true, color: FG, fill: { color: CARD } } },
      { text: 'Action', options: { bold: true, color: FG, fill: { color: CARD } } }
    ],
    [{ text: '1', options: { color: ACCENT, bold: true } }, { text: 'Render : hub ou /display (hôte) — ou plan B LAN', options: { color: FG } }],
    [{ text: '2', options: { color: ACCENT, bold: true } }, { text: 'Chaque joueur : …/mobile (même hôte)', options: { color: FG } }],
    [{ text: '3', options: { color: ACCENT, bold: true } }, { text: 'Vote map → lancement hôte', options: { color: FG } }],
    [{ text: '4', options: { color: ACCENT, bold: true } }, { text: 'Achat + combat + bombe ou fin timer', options: { color: FG } }]
  ];
  s.addTable(rows, {
    x: 0.45,
    y: 1.0,
    w: 9.1,
    colW: [0.75, 8.35],
    border: { type: 'solid', color: CARD, pt: 1 },
    fontSize: 12,
    fontFace: 'Calibri',
    fill: { color: '161b22' }
  });
  footer(s, 12);
}

await pres.writeFile({ fileName: OUT });
console.log('PPTX généré :', OUT);
