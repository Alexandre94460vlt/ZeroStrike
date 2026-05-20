/**
 * Contrôleur display : branche les événements Socket.io sur la vue jeu (Phaser).
 * Séparation MVC : la scène reste une vue ; la logique d’écoute réseau vit ici.
 */
import * as Hud from '../views/game/hud.js';
import * as Effects from '../views/game/effects.js';
import * as HeroEffects from '../views/game/heroEffects.js';
import * as MapLayer from '../views/game/mapLayer.js';
import { onStateUpdate } from '../views/game/stateUpdate.js';
import { applyDisplayStateDelta } from '../utils/mergeDisplayStateDelta.js';

/** Événements réservés à la GameScene : retirés avant ré-enregistrement (socket singleton → évite doublons). */
const GAME_SCENE_SOCKET_EVENTS = [
  'map_data',
  'state_update',
  'sound_event',
  'damage_indicator',
  'kill_feed',
  'player_comment',
  'match_end',
  'overtime_start',
  'back_to_lobby',
  'powerup_spawn',
  'powerup_despawn',
  'hero_freeze',
  'hero_zone',
  'hero_violet',
  'hero_dash',
  'hero_warudo_local',
  'hero_dio_knives',
  'hero_clones_spawn',
  'hero_rasengan',
  'hero_flames',
  'hero_tsukuyomi',
  'hero_laser',
  'hero_teleport',
  'hero_dismantle',
  'hero_toji_burst',
  'hero_toji_weapon',
  'hero_roadroller',
  'hero_ability_display',
  'hero_yuta_familiar_spawn',
  'hero_ichigo_getsuga',
  'hero_ichigo_bankai'
];

export function registerGameSceneSockets(scene) {
  const s = scene.socket;
  for (const ev of GAME_SCENE_SOCKET_EVENTS) s.off(ev);
  // Multi-kill : les kills doivent s'enchaîner vite (sinon pas d'annonce).
  // Ajustable : plus petit = plus strict.
  const MULTIKILL_WINDOW_MS = 1400;
  const playMultiKillSfx = (killer) => {
    if (!killer) return;
    const now = scene?.game?.loop?.time ?? Date.now();
    if (!scene._multiKill) {
      scene._multiKill = { killer: null, count: 0, lastAt: 0 };
    }
    const mk = scene._multiKill;
    const same = mk.killer === killer && (now - (mk.lastAt || 0)) <= MULTIKILL_WINDOW_MS;
    mk.killer = killer;
    mk.count = same ? (mk.count + 1) : 1;
    mk.lastAt = now;

    // 2=double, 3=triple, 4=quadra, 5=penta, 6+=legendary
    const n = mk.count;
    let key = null;
    if (n === 2) key = 'mk_double';
    else if (n === 3) key = 'mk_triple';
    else if (n === 4) key = 'mk_quadra';
    else if (n === 5) key = 'mk_penta';
    else if (n >= 6) key = 'mk_legendary';
    if (!key) return;
    if (!scene.sound || !scene.cache?.audio?.exists?.(key)) return;
    try {
      scene.sound.play(key, { volume: 0.75 });
    } catch (e) {
      // Audio désactivé / autoplay policy : ignorer silencieusement.
    }
  };

  s.on('map_data', (data) => {
    if (!data?.mapId || !data.walls?.length) {
      console.error('[GameScene] map_data rejeté : mapId et walls requis', data);
      return;
    }
    scene.registry.set('mapData', data);
    const add = (obj) => {
      scene.rootScale.add(obj);
      return obj;
    };
    MapLayer.redrawAllMapVisuals(scene, add);
  });
  s.on('state_update', (payload) => {
    const prev = scene.registry.get('lastDisplayGameState') || null;
    const merged = applyDisplayStateDelta(prev, payload);
    if (!merged) return;
    scene.registry.set('lastDisplayGameState', merged);
    onStateUpdate(scene, merged);
  });
  s.on('sound_event', (payload) => Effects.onSoundEvent(scene, payload));
  s.on('damage_indicator', (data) => Effects.onDamageIndicator(scene, data));
  s.on('kill_feed', ({ killer, victim, weapon }) => {
    playMultiKillSfx(killer);
    Hud.onKillFeed(scene, killer, victim, weapon);
  });
  s.on('player_comment', ({ name, text }) => Hud.onPlayerComment(scene, name, text));
  s.on('match_end', (data) => Hud.onMatchEnd(scene, data));
  s.on('overtime_start', () => Hud.onOvertimeStart(scene));
  s.on('back_to_lobby', (payload) => {
    scene.registry.set('lobbyReturnReason', payload?.reason ?? null);
    scene.scene.start('LobbyScene');
  });
  s.on('powerup_spawn', (data) => Effects.spawnPowerUp(scene, data));
  s.on('powerup_despawn', (data) => Effects.despawnPowerUp(scene, data));

  s.on('hero_freeze', (data) => HeroEffects.onHeroFreeze(scene, data));
  s.on('hero_zone', (data) => HeroEffects.onHeroZone(scene, data));
  s.on('hero_violet', (data) => HeroEffects.onHeroViolet(scene, data));
  s.on('hero_dash', (data) => HeroEffects.onHeroDash(scene, data));
  s.on('hero_warudo_local', (data) => HeroEffects.onHeroWarudoLocal(scene, data));
  s.on('hero_dio_knives', (data) => HeroEffects.onHeroDioKnives(scene, data));
  s.on('hero_clones_spawn', (data) => HeroEffects.onHeroClonesSpawn(scene, data));
  s.on('hero_rasengan', (data) => HeroEffects.onHeroRasengan(scene, data));
  s.on('hero_flames', (data) => HeroEffects.onHeroFlames(scene, data));
  s.on('hero_tsukuyomi', (data) => HeroEffects.onHeroTsukuyomi(scene, data));
  s.on('hero_laser', (data) => HeroEffects.onHeroLaser(scene, data));
  s.on('hero_teleport', (data) => HeroEffects.onHeroTeleport(scene, data));
  s.on('hero_dismantle', (data) => HeroEffects.onHeroDismantle(scene, data));
  s.on('hero_toji_burst', (data) => HeroEffects.onHeroTojiBurst(scene, data));
  s.on('hero_toji_weapon', (data) => HeroEffects.onHeroTojiWeapon(scene, data));
  s.on('hero_roadroller', (data) => HeroEffects.onHeroRoadroller(scene, data));
  s.on('hero_ability_display', (data) => HeroEffects.onHeroAbilityDisplay(scene, data));
  s.on('hero_yuta_familiar_spawn', (data) => HeroEffects.onHeroYutaFamiliarSpawn(scene, data));
  s.on('hero_ichigo_getsuga', (data) => HeroEffects.onHeroIchigoGetsuga(scene, data));
  s.on('hero_ichigo_bankai', (data) => HeroEffects.onHeroIchigoBankai(scene, data));
}
