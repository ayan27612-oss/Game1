import { rand } from '../engine/MathUtils.js';

/**
 * Iron Man weapon rack. Each entry owns its firing pattern, heat cost and
 * projectile profile so the player entity stays a thin weapons platform.
 * Damage values are base numbers; player.stats.damage is a multiplier.
 */

function spawnRound(game, player, angle, cfg) {
  const over = player.buffs.overcharge > 0;
  const crit = Math.random() < player.stats.crit;
  const damage = cfg.damage
    * player.stats.damage
    * (over ? 1.22 : 1)
    * (crit ? player.stats.critMult : 1);
  const speed = cfg.speed * (player.stats.projectileSpeed || 1) * (over ? 1.06 : 1);
  const life = cfg.life * (player.stats.projectileLife || 1);
  const offset = cfg.offset != null ? cfg.offset : 20;
  const side = cfg.side || 0;
  const sx = player.x + Math.cos(angle) * offset + Math.cos(angle + Math.PI * 0.5) * side;
  const sy = player.y + Math.sin(angle) * offset + Math.sin(angle + Math.PI * 0.5) * side;
  const color = crit ? '#ffe066' : (cfg.color || '#8fe8ff');

  game.spawnPlayerBullet(
    sx,
    sy,
    Math.cos(angle) * speed,
    Math.sin(angle) * speed,
    cfg.radius || 4,
    damage,
    life,
    cfg.pierce || 0,
    cfg.ricochet || 0,
    (cfg.chain || 0) + (player.stats.chainBonus || 0),
    color,
    (cfg.size || 3.2) * (crit ? 1.25 : 1),
    cfg.homing || 0,
    cfg.kind || 'bolt',
    (cfg.splash || 0) + (player.stats.splashBonus || 0),
    crit
  );

  if (cfg.muzzle !== false) {
    game.particles.directionalSparks(
      sx,
      sy,
      Math.cos(angle),
      Math.sin(angle),
      cfg.kind === 'beam' ? 5 : 2,
      color,
      cfg.kind === 'beam' ? 420 : 240,
      cfg.kind === 'beam' ? 3 : 1.7,
      0.2
    );
  }
}

function fired(player, game, cfg) {
  const over = player.buffs.overcharge > 0;
  player.fireCooldown = 1 / Math.max(0.35, (cfg.fireRate || 5) * player.stats.fireRate * (over ? 1.35 : 1));
  player.heat += (cfg.heat || 0.04) * player.stats.heatMult * (over ? 0.8 : 1);
  player.vx -= Math.cos(player.angle) * (cfg.recoil || 18);
  player.vy -= Math.sin(player.angle) * (cfg.recoil || 18);
  if (cfg.shake) game.particles.addShake(cfg.shake);

  if (player.heat >= 1) {
    player.heat = 1;
    if (!player.overheated) {
      player.overheated = true;
      game.audio.overheat();
      game.particles.text(player.x, player.y - 34, 'CORE OVERHEAT', '#ff3b30', 14, 1.1);
      game.particles.sparkBurst(player.x, player.y, 16, '#ffc857', 240, 2.6, 0.5);
    }
  }
}

export const WEAPONS = [
  {
    id: 'repulsor',
    name: 'REPULSOR',
    short: 'REP',
    key: '1',
    color: '#8fe8ff',
    desc: 'Twin palm repulsors. Fast, accurate, low heat.',
    fireRate: 7.4,
    heat: 0.026,
    recoil: 14,
    fire(player, game, angle) {
      this._side = (this._side || 0) ? 0 : 1;
      const side = this._side ? -1 : 1;
      const a = angle + rand(-0.016, 0.016);
      spawnRound(game, player, a, {
        damage: 14,
        speed: 1380,
        life: 0.98,
        radius: 4.2,
        size: 3.4,
        offset: 19,
        side: side * 9,
        color: '#a9f2ff'
      });
      game.audio.repulsor();
    }
  },
  {
    id: 'unibeam',
    name: 'UNIBEAM',
    short: 'BEAM',
    key: '2',
    color: '#d7fbff',
    desc: 'Chest reactor lance. Heavy damage, wide pierce, slow cycle.',
    fireRate: 2.15,
    heat: 0.105,
    recoil: 46,
    shake: 2.6,
    fire(player, game, angle) {
      spawnRound(game, player, angle, {
        damage: 62,
        speed: 2050,
        life: 1.15,
        radius: 7.5,
        size: 7,
        offset: 24,
        pierce: 7,
        kind: 'beam',
        color: '#d7fbff'
      });
      game.particles.ring(player.x, player.y, '#8fe8ff', 10, 240, 0.28, 3);
      game.particles.text(player.x, player.y - 30, 'UNIBEAM', '#d7fbff', 12, 0.55);
      game.audio.unibeam();
    }
  },
  {
    id: 'micro',
    name: 'MICRO MISSILES',
    short: 'MSL',
    key: '3',
    color: '#ffd27a',
    desc: 'Shoulder micro-missiles. Homing, splash damage.',
    fireRate: 2.9,
    heat: 0.072,
    recoil: 22,
    fire(player, game, angle) {
      for (let i = 0; i < 2; i++) {
        const a = angle + (i === 0 ? -0.12 : 0.12) + rand(-0.03, 0.03);
        spawnRound(game, player, a, {
          damage: 23,
          speed: 760,
          life: 1.9,
          radius: 4.6,
          size: 3,
          offset: 14,
          side: i === 0 ? -11 : 11,
          homing: 2.8,
          kind: 'missile',
          splash: 54,
          color: '#ffd27a'
        });
      }
      game.audio.microMissiles();
    }
  },
  {
    id: 'arc',
    name: 'ARC CHAIN',
    short: 'ARC',
    key: '4',
    color: '#7fd8ff',
    desc: 'Arc reactor discharge. Jumps between nearby targets.',
    fireRate: 3.6,
    heat: 0.065,
    recoil: 20,
    fire(player, game, angle) {
      spawnRound(game, player, angle, {
        damage: 27,
        speed: 1180,
        life: 1.0,
        radius: 5.2,
        size: 4,
        offset: 20,
        chain: 4,
        kind: 'arc',
        color: '#7fd8ff'
      });
      game.particles.lightning(
        player.x,
        player.y,
        player.x + Math.cos(angle) * 34,
        player.y + Math.sin(angle) * 34,
        '#7fd8ff',
        2.2,
        0.12
      );
      game.audio.arc();
    }
  },
  {
    id: 'scatter',
    name: 'PLASMA SCATTER',
    short: 'PLAS',
    key: '5',
    color: '#ff9b4a',
    desc: 'Wide plasma burst. Devastating at point blank.',
    fireRate: 2.05,
    heat: 0.118,
    recoil: 54,
    shake: 2.2,
    fire(player, game, angle) {
      const pellets = 8;
      for (let i = 0; i < pellets; i++) {
        const a = angle + (i / (pellets - 1) - 0.5) * 0.44 + rand(-0.02, 0.02);
        spawnRound(game, player, a, {
          damage: 10.5,
          speed: 1040,
          life: 0.42,
          radius: 3.6,
          size: 3.2,
          offset: 22,
          color: i % 2 ? '#ffd27a' : '#ff9b4a'
        });
      }
      game.particles.ring(player.x, player.y, '#ff9b4a', 8, 300, 0.24, 2);
      game.audio.scatter();
    }
  }
];

export const WEAPON_BY_ID = new Map(WEAPONS.map((weapon) => [weapon.id, weapon]));

export const MISSILE_BARRAGE = {
  id: 'barrage',
  name: 'MISSILE BARRAGE',
  count: 4,
  damage: 28,
  speed: 680,
  life: 2.4,
  radius: 5.4,
  splash: 92,
  homing: 3.1,
  cooldown: 7,
  color: '#ffb347'
};

export function fireWeapon(player, game, angle) {
  const weapon = WEAPONS[player.weaponIndex] || WEAPONS[0];
  weapon.fire(player, game, angle);
  fired(player, game, weapon);
  return weapon;
}

export function fireBarrage(player, game, angle) {
  const cfg = MISSILE_BARRAGE;
  const count = Math.max(1, Math.round(player.stats.missileCount));
  for (let i = 0; i < count; i++) {
    const spread = count > 1 ? (i / (count - 1) - 0.5) * 0.9 : 0;
    const a = angle + spread + rand(-0.05, 0.05);
    const crit = Math.random() < player.stats.crit;
    const damage = cfg.damage * player.stats.damage * player.stats.missileDamage * (crit ? player.stats.critMult : 1);
    game.spawnPlayerBullet(
      player.x + Math.cos(a) * 18,
      player.y + Math.sin(a) * 18,
      Math.cos(a) * cfg.speed,
      Math.sin(a) * cfg.speed,
      cfg.radius,
      damage,
      cfg.life,
      0,
      0,
      0,
      crit ? '#ffe066' : cfg.color,
      5,
      cfg.homing,
      'missile',
      cfg.splash + (player.stats.splashBonus || 0),
      crit
    );
  }
  game.particles.ring(player.x, player.y, cfg.color, 12, 420, 0.4, 3);
  game.particles.text(player.x, player.y - 44, 'MISSILE BARRAGE', '#ffd27a', 14, 1.1);
  game.audio.missileBarrage();
  game.particles.addShake(4);
  return true;
}
