/**
 * Définition des héros "Battlefront" côté serveur.
 * Gardé simple : uniquement coût et métadonnées d'affichage.
 */

export const HEROES_ROSTER = [
  { id: 'gojo', name: 'Satoru Gojo', cost: 2000, color: '#4FC3F7' },
  { id: 'sukuna', name: 'Sukuna', cost: 2200, color: '#F06292' },
  { id: 'yuta', name: 'Yuta Okkotsu', cost: 2500, color: '#9E9E9E' },
  { id: 'ichigo', name: 'Ichigo Kurosaki', cost: 2300, color: '#9C27B0' },
  { id: 'toji', name: 'Toji Fushiguro', cost: 1800, color: '#A5D6A7' },
  { id: 'jotaro', name: 'Jotaro', cost: 1900, color: '#90CAF9' },
  { id: 'dio', name: 'Dio', cost: 2200, color: '#FFEE58' },
  { id: 'naruto', name: 'Naruto', cost: 1800, color: '#FFB74D' },
  { id: 'itachi', name: 'Itachi', cost: 2000, color: '#CE93D8' },
  { id: 'goku', name: 'Goku', cost: 2500, color: '#FF8A65' }
];

export function getHero(heroId) {
  return HEROES_ROSTER.find((h) => h.id === heroId) || null;
}
