/**
 * Modèle domaine : Projectile
 * Données d'un projectile (position, angle, équipe, dégâts) — stats venant de l'arme
 */
export class Projectile {
  constructor(
    id,
    ownerId,
    x,
    y,
    angle,
    team,
    damage = 25,
    speed = 800,
    radius = 4,
    weaponName = 'Rifle',
    weaponId = 'RIFLE'
  ) {
    this.id = id;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.team = team;
    this.damage = damage;
    this.speed = speed;
    this.radius = radius;
    this.weaponName = weaponName;
    /** Id arme (PISTOL, RIFLE, …) — affichage client (teinte traînée) */
    this.weaponId = weaponId;
  }
}
