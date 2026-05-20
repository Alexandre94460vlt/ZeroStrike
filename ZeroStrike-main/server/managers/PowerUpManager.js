/**
 * Gestionnaire de power-ups (server-side, authoritative sur les spawns)
 * Fait apparaître périodiquement des items sur des cellules libres de la carte.
 * Chaque item porte un type (speed, damage, shield) et une durée d'effet prévue,
 * même si l'application détaillée de l'effet est laissée à GameService.
 */

export class PowerUpManager {
  /**
   * @param {import('socket.io').Namespace} displayNamespace
   * @param {Object} mapData - Résultat de parseGrid (contient freeCells)
   */
  constructor(displayNamespace, mapData) {
    this.displayNamespace = displayNamespace;
    this.powerUps = []; // { id, x, y, type, effectDurationSec, mapLifeSec, spawnedAt }
    this.nextId = 0;
    this.spawnIntervalSec = 18; // délai entre apparitions
    this.maxSimultaneous = 4;
    this.mapLifeSec = 45;       // durée d'affichage sur la carte (avant expiration auto)
    this.effectDurationSec = 18; // durée de l'effet sur le joueur après ramassage
    this.timerSec = 0;
    this.setMap(mapData);
  }

  setMap(mapData) {
    this.mapData = mapData || {};
    // freeCells: { x, y }
    this.freeCells = Array.isArray(this.mapData.freeCells) ? this.mapData.freeCells : [];
    this.powerUps = [];
    this.timerSec = 0;
  }

  /**
   * Tick appelé depuis GameService.tick(dt)
   * @param {number} dt - delta temps en secondes
   */
  tick(dt) {
    if (!this.freeCells.length) return;

    this.timerSec += dt;

    // Nettoyage des power-ups expirés côté carte (mapLifeSec, distinct de l'effet joueur)
    const now = Date.now();
    const stillAlive = [];
    for (const pu of this.powerUps) {
      if (now - pu.spawnedAt > pu.mapLifeSec * 1000) {
        this.displayNamespace.emit('powerup_despawn', { id: pu.id });
      } else {
        stillAlive.push(pu);
      }
    }
    this.powerUps = stillAlive;

    if (this.powerUps.length >= this.maxSimultaneous) return;

    if (this.timerSec >= this.spawnIntervalSec) {
      this.timerSec = 0;
      this.spawnRandomPowerUp();
    }
  }

  spawnRandomPowerUp() {
    if (!this.freeCells.length) return;
    const cell = this.freeCells[Math.floor(Math.random() * this.freeCells.length)];
    // Types avec poids : heal et speed plus fréquents (utiles et fun)
    const types = [
      'heal', 'heal',            // Soin : fréquent
      'speed', 'speed',          // Vitesse : fréquent
      'damage',                  // Boost dégâts
      'shield',                  // Bouclier
      'multishot',               // Tir multiple
      'ricochet',                // Rafale large
      'ghost',                   // Intangibilité
      'magnet'                   // Attraction power-ups
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    const id = `pu_${this.nextId++}`;
    const pu = {
      id,
      x: cell.x,
      y: cell.y,
      type,
      effectDurationSec: this.effectDurationSec,
      mapLifeSec: this.mapLifeSec,
      spawnedAt: Date.now()
    };
    this.powerUps.push(pu);

    this.displayNamespace.emit('powerup_spawn', {
      id: pu.id,
      x: pu.x,
      y: pu.y,
      type: pu.type,
      effectDurationSec: pu.effectDurationSec,
      mapLifeSec: pu.mapLifeSec
    });
  }

  /**
   * Suppression d'un power-up (ex: ramassé par un joueur)
   * Notifie le display pour faire disparaître le sprite.
   */
  removePowerUpById(id) {
    const idx = this.powerUps.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const [pu] = this.powerUps.splice(idx, 1);
    if (pu) {
      this.displayNamespace.emit('powerup_despawn', { id: pu.id });
    }
  }
}

