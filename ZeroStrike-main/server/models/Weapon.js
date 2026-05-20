/**
 * Dictionnaire des armes — identités de TTK distinctes (100 PV de base).
 *
 * Rôles :
 * - PISTOL : arme de repli / eco — cadence modérée, ~4 balles pour éliminer.
 * - SMG : arène courte, DPS élevé, tombe vite mais exige le suivi.
 * - RIFLE : polyvalent mid, 3 balles corps si full connecté.
 * - SNIPER : one-shot skill, cadence lente (risque si raté).
 * - SHOTGUN : burst très court, one-tap si la gerbe complète (LAN / fun).
 *
 * Champs : price, damage, fireCooldownMs, projectileSpeed, projectileRadius, pellets, magSize, reserveMax
 */
export const WEAPONS = {
  PISTOL: {
    id: 'PISTOL',
    name: 'Pistolet',
    price: 0,
    damage: 28,
    fireCooldownMs: 300,
    projectileSpeed: 780,
    projectileRadius: 4,
    pellets: 1,
    magSize: 12,
    reserveMax: 48
  },
  SMG: {
    id: 'SMG',
    name: 'SMG',
    price: 1500,
    damage: 17,
    fireCooldownMs: 76,
    projectileSpeed: 920,
    projectileRadius: 4,
    pellets: 1,
    magSize: 32,
    reserveMax: 120
  },
  RIFLE: {
    id: 'RIFLE',
    name: 'Fusil',
    price: 2900,
    damage: 34,
    fireCooldownMs: 92,
    projectileSpeed: 1180,
    projectileRadius: 4,
    pellets: 1,
    magSize: 30,
    reserveMax: 90
  },
  SNIPER: {
    id: 'SNIPER',
    name: 'Sniper',
    price: 4500,
    damage: 100,
    fireCooldownMs: 1450,
    projectileSpeed: 2550,
    projectileRadius: 2,
    pellets: 1,
    magSize: 5,
    reserveMax: 30
  },
  SHOTGUN: {
    id: 'SHOTGUN',
    name: 'Shotgun',
    price: 2000,
    damage: 20,
    fireCooldownMs: 780,
    projectileSpeed: 880,
    projectileRadius: 4,
    pellets: 5,
    magSize: 8,
    reserveMax: 32
  }
};

export const DEFAULT_WEAPON_ID = 'PISTOL';

export function getWeapon(weaponId) {
  return WEAPONS[weaponId] || WEAPONS[DEFAULT_WEAPON_ID];
}
