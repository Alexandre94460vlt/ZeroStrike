/**
 * Modèle : Données de la carte (géométrie, murs, sites bombe, spawns)
 * Source : grilles ASCII locales dans server/models/maps/Maps.js
 */
import { getMapData, MAP_LIST, mapDataForSocket } from './Maps.js';

export function getBombSitesFromData(mapData) {
  return (mapData && mapData.bombSites) ? mapData.bombSites : [];
}

export { MAP_LIST, getMapData, mapDataForSocket };
