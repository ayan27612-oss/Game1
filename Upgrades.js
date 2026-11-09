const SAVE_KEY = 'protocol_swarm_save_v1';
const RARITY_WEIGHT = { 1: 62, 2: 30, 3: 12 };

export const RARITY_NAMES = { 1: 'COMMON', 2: 'RARE', 3: 'EPIC' };

export const UPGRADES = [
  {
    id: 'high_caliber',
    name: 'High Caliber',
    rarity: 1,
    max: 5,
    desc: 'Weapon damage +18%. Rounds hit harder.',
    apply: (p) => { p.stats.damage *= 1.18; }
  },
  {
    id: 'overclock',
    name: 'Overclock',
    rarity: 1,
    max: 5,
    desc: 'Fire rate +15%. Heat per shot +4%.',
    apply: (p) => { p.stats.fireRate *= 1.15; p.stats.heatPerShot *= 1.04; }
  },
  {
    id: 'twin_barrels',
    name: 'Twin Barrels',
    rarity: 2,
    max: 3,
    desc: '+1 projectile per volley. Spread widens. Damage -8%.',
    apply: (p) => { p.stats.multishot += 1; p.stats.spread += 0.035; p.stats.damage *= 0.92; }
  },
  {
    id: 'piercing',
    name: 'Piercing Rounds',
    rarity: 2,
    max: 3,
    desc: 'Rounds pierce +1 enemy before dissipating.',
    apply: (p) => { p.stats.pierce += 1; }
  },
  {
    id: 'ricochet',
    name: 'Ricochet Rounds',
    rarity: 2,
    max: 3,
    desc: 'Rounds bounce off arena walls +1 time.',
    apply: (p) => { p.stats.ricochet += 1; p.stats.bulletLife *= 1.1; }
  },
  {
    id: 'chain',
    name: 'Chain Lightning',
    rarity: 3,
    max: 3,
    desc: 'Hits have a 35% chance to arc to nearby targets. +10 arc damage.',
    apply: (p) => { p.stats.chain += 1; p.stats.chainDamage += 10; }
  },
  {
    id: 'orbital',
    name: 'Orbital Blades',
    rarity: 3,
    max: 4,
    desc: 'Deploy +1 orbiting blade that shreds nearby swarm.',
    apply: (p) => { p.stats.orbitalBlades += 1; }
  },
  {
    id: 'singularity',
    name: 'Singularity Dash',
    rarity: 3,
    max: 2,
    desc: 'Dashing leaves a gravity well that pulls and detonates.',
    apply: (p) => { p.stats.singularityDash += 1; }
  },
  {
    id: 'coolant',
    name: 'Phase Coolant',
    rarity: 1,
    max: 4,
    desc: 'Cooling rate +30%. Heat per shot -12%.',
    apply: (p) => { p.stats.coolRate *= 1.3; p.stats.heatPerShot *= 0.88; }
  },
  {
    id: 'plating',
    name: 'Kinetic Plating',
    rarity: 2,
    max: 4,
    desc: 'Incoming damage reduced by 7% (cap 60%).',
    apply: (p) => { p.stats.armor = Math.min(0.6, p.stats.armor + 0.07); }
  },
  {
    id: 'repair',
    name: 'Nanite Repair',
    rarity: 1,
    max: 5,
    desc: 'Max HP +18. Immediately restore 35 HP.',
    apply: (p) => { p.stats.maxHp += 18; p.hp = Math.min(p.stats.maxHp, p.hp + 35); }
  },
  {
    id: 'afterburner',
    name: 'Afterburner',
    rarity: 1,
    max: 4,
    desc: 'Dash cooldown -18%. Dash speed +7%.',
    apply: (p) => { p.stats.dashCooldown *= 0.82; p.stats.dashSpeed *= 1.07; }
  },
  {
    id: 'vampiric',
    name: 'Vampiric Rounds',
    rarity: 2,
    max: 3,
    desc: 'Heal for 3% of damage dealt.',
    apply: (p) => { p.stats.lifesteal += 0.03; }
  },
  {
    id: 'targeting',
    name: 'Targeting Array',
    rarity: 2,
    max: 3,
    desc: 'Critical chance +7%.',
    apply: (p) => { p.stats.crit = Math.min(0.7, p.stats.crit + 0.07); }
  },
  {
    id: 'magnet',
    name: 'Magnetic Core',
    rarity: 1,
    max: 3,
    desc: 'Pickup radius +70. XP gain +10%.',
    apply: (p) => { p.stats.pickupRadius += 70; p.stats.xpGain += 0.1; }
  },
  {
    id: 'blink',
    name: 'Phase Capacitor',
    rarity: 2,
    max: 2,
    desc: '+1 dash charge. Charges refill over time.',
    apply: (p) => { p.stats.maxDashCharges += 1; p.dashCharges = p.stats.maxDashCharges; }
  },
  {
    id: 'hyperdrive',
    name: 'Hyperdrive',
    rarity: 1,
    max: 4,
    desc: 'Move speed +10%. Acceleration +10%.',
    apply: (p) => { p.stats.moveSpeed *= 1.1; p.stats.accel *= 1.1; }
  },
  {
    id: 'railgun',
    name: 'Railgun',
    rarity: 3,
    max: 2,
    desc: 'Damage +50%, pierce +2, bullet speed +25%. Fire rate -15%.',
    apply: (p) => {
      p.stats.damage *= 1.5;
      p.stats.pierce += 2;
      p.stats.bulletSpeed *= 1.25;
      p.stats.fireRate *= 0.85;
    }
  },
  {
    id: 'scatter',
    name: 'Scatter Core',
    rarity: 2,
    max: 3,
    desc: '+2 projectiles. Wider spread. Damage -20%.',
    apply: (p) => { p.stats.multishot += 2; p.stats.spread += 0.09; p.stats.damage *= 0.8; }
  },
  {
    id: 'reactor',
    name: 'Fusion Reactor',
    rarity: 3,
    max: 2,
    desc: 'Damage +25%, fire rate +20%, cooling +10%. Heat +15%.',
    apply: (p) => {
      p.stats.damage *= 1.25;
      p.stats.fireRate *= 1.2;
      p.stats.coolRate *= 1.1;
      p.stats.heatPerShot *= 1.15;
    }
  },
  {
    id: 'ghost',
    name: 'Ghost Protocol',
    rarity: 3,
    max: 2,
    desc: 'Dash i-frames +0.1s and dash duration +0.03s.',
    apply: (p) => { p.stats.dashIFrames += 0.1; p.stats.dashDuration += 0.03; }
  },
  {
    id: 'regen',
    name: 'Self-Repair',
    rarity: 2,
    max: 3,
    desc: 'Regenerate 0.6 HP per second.',
    apply: (p) => { p.stats.regen += 0.6; }
  },
  {
    id: 'accelerator',
    name: 'Accelerator',
    rarity: 1,
    max: 4,
    desc: 'Bullet speed +12%. Projectile lifetime +5%.',
    apply: (p) => { p.stats.bulletSpeed *= 1.12; p.stats.bulletLife *= 1.05; }
  },
  {
    id: 'crit_core',
    name: 'Critical Core',
    rarity: 3,
    max: 2,
    desc: 'Critical damage +0.5x.',
    apply: (p) => { p.stats.critMult += 0.5; }
  },
  {
    id: 'seeker',
    name: 'Seeker Rounds',
    rarity: 2,
    max: 3,
    desc: 'Rounds curve toward nearby swarm targets.',
    apply: (p) => { p.stats.homing += 0.7; }
  },
  {
    id: 'cryo',
    name: 'Cryo Rounds',
    rarity: 2,
    max: 3,
    desc: 'Hits chill enemies, slowing them briefly.',
    apply: (p) => { p.stats.frost += 1; }
  },
  {
    id: 'thorns',
    name: 'Reactive Plating',
    rarity: 2,
    max: 3,
    desc: 'When hit, vent a shockwave that damages nearby enemies.',
    apply: (p) => { p.stats.thorns += 1; }
  },
  {
    id: 'nova',
    name: 'Pulse Emitter',
    rarity: 3,
    max: 3,
    desc: 'Emit a damaging energy pulse every few seconds.',
    apply: (p) => { p.stats.nova += 1; p.stats.novaDamage += 8; }
  },
  {
    id: 'berserk',
    name: 'Berserker Core',
    rarity: 2,
    max: 3,
    desc: 'Damage scales up to +18% per stack as HP drops.',
    apply: (p) => { p.stats.berserk += 0.18; }
  },
  {
    id: 'glass',
    name: 'Glass Cannon',
    rarity: 3,
    max: 2,
    desc: 'Damage +45%, but max HP -18%.',
    apply: (p) => {
      p.stats.damage *= 1.45;
      p.stats.maxHp *= 0.82;
      p.hp = Math.min(p.hp, p.stats.maxHp);
    }
  },
  {
    id: 'heavy',
    name: 'Heavy Slugs',
    rarity: 1,
    max: 3,
    desc: 'Bullet size +25%, damage +6%, speed -4%.',
    apply: (p) => {
      p.stats.bulletRadius *= 1.25;
      p.stats.damage *= 1.06;
      p.stats.bulletSpeed *= 0.96;
    }
  },
  {
    id: 'reactor_matrix',
    name: 'Reactor Matrix',
    rarity: 2,
    max: 3,
    desc: 'Superpower cooldowns -12%. Superpower damage +12%.',
    apply: (p) => { p.stats.cooldownMult *= 0.88; p.stats.abilityPower *= 1.12; }
  },
  {
    id: 'nova_core',
    name: 'Nova Core',
    rarity: 3,
    max: 3,
    desc: 'Nova Burst gains +26 damage and +16 radius.',
    apply: (p) => { p.stats.novaBonus += 26; p.stats.abilityPower *= 1.05; }
  },
  {
    id: 'aegis_matrix',
    name: 'Aegis Matrix',
    rarity: 2,
    max: 3,
    desc: 'Aegis Field and Overdrive last 0.7s longer.',
    apply: (p) => { p.stats.shieldBonus += 0.7; }
  },
  {
    id: 'wingman_link',
    name: 'Wingman Link',
    rarity: 2,
    max: 3,
    desc: 'Bot teammate deals +25% damage and fires faster.',
    apply: (p) => { p.stats.allyDamage += 0.25; p.stats.allyRate += 0.25; }
  }
];

export const META_UNLOCKS = [
  {
    id: 'hull',
    name: 'Reinforced Hull',
    desc: '+25 starting max HP.',
    cost: 140,
    apply: (p) => { p.stats.maxHp += 25; p.hp = p.stats.maxHp; }
  },
  {
    id: 'barrel',
    name: 'Hot Barrel',
    desc: '+8% weapon damage.',
    cost: 180,
    apply: (p) => { p.stats.damage *= 1.08; }
  },
  {
    id: 'capacitor',
    name: 'Phase Capacitor',
    desc: '+1 starting dash charge.',
    cost: 240,
    apply: (p) => { p.stats.maxDashCharges += 1; p.dashCharges = p.stats.maxDashCharges; }
  },
  {
    id: 'neural',
    name: 'Neural Link',
    desc: '+15% XP gain.',
    cost: 260,
    apply: (p) => { p.stats.xpGain += 0.15; }
  },
  {
    id: 'cryo',
    name: 'Cryo Loop',
    desc: '+15% weapon cooling.',
    cost: 280,
    apply: (p) => { p.stats.coolRate *= 1.15; }
  },
  {
    id: 'servo',
    name: 'Servo Legs',
    desc: '+5% movement speed.',
    cost: 300,
    apply: (p) => { p.stats.moveSpeed *= 1.05; }
  },
  {
    id: 'salvage',
    name: 'Salvage Protocol',
    desc: '+20% meta-credits earned at run end.',
    cost: 340,
    apply: () => {}
  }
];

function freshSave() {
  return {
    version: 2,
    currency: 0,
    highScores: [],
    unlocks: [],
    runs: 0,
    totalScore: 0,
    ship: { style: 0, palette: 0, ally: 0 }
  };
}

function sanitizeShip(raw) {
  const ship = { style: 0, palette: 0, ally: 0 };
  if (raw && typeof raw === 'object') {
    if (Number.isFinite(raw.style)) ship.style = Math.max(0, Math.floor(raw.style));
    if (Number.isFinite(raw.palette)) ship.palette = Math.max(0, Math.floor(raw.palette));
    if (Number.isFinite(raw.ally)) ship.ally = Math.max(0, Math.floor(raw.ally));
  }
  return ship;
}

export class SaveData {
  constructor(data) {
    const base = freshSave();
    if (data && typeof data === 'object') {
      base.currency = Number.isFinite(data.currency) ? Math.max(0, data.currency) : 0;
      base.runs = Number.isFinite(data.runs) ? Math.max(0, data.runs) : 0;
      base.totalScore = Number.isFinite(data.totalScore) ? Math.max(0, data.totalScore) : 0;
      if (Array.isArray(data.unlocks)) {
        base.unlocks = data.unlocks.filter((u) => typeof u === 'string');
      }
      if (Array.isArray(data.highScores)) {
        base.highScores = data.highScores
          .filter((s) => s && Number.isFinite(s.score))
          .map((s) => ({
            score: Math.floor(s.score),
            time: Number.isFinite(s.time) ? s.time : 0,
            level: Number.isFinite(s.level) ? s.level : 1,
            date: typeof s.date === 'string' ? s.date : ''
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
      }
    }
    this.version = base.version;
    this.currency = base.currency;
    this.highScores = base.highScores;
    this.unlocks = base.unlocks;
    this.runs = base.runs;
    this.totalScore = base.totalScore;
    this.ship = sanitizeShip(data && data.ship);
  }

  static load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return new SaveData(null);
      return new SaveData(JSON.parse(raw));
    } catch (err) {
      return new SaveData(null);
    }
  }

  save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        version: this.version,
        currency: this.currency,
        highScores: this.highScores,
        unlocks: this.unlocks,
        runs: this.runs,
        totalScore: this.totalScore,
        ship: this.ship
      }));
    } catch (err) {
      /* storage may be unavailable in private mode */
    }
  }

  setShip(part, value) {
    if (!this.ship) this.ship = { style: 0, palette: 0, ally: 0 };
    if (part === 'style' || part === 'palette' || part === 'ally') {
      this.ship[part] = Math.max(0, Math.floor(value));
      this.save();
    }
  }

  getShipConfig() {
    return sanitizeShip(this.ship);
  }

  hasUnlock(id) {
    return this.unlocks.includes(id);
  }

  buyUnlock(id) {
    const meta = META_UNLOCKS.find((m) => m.id === id);
    if (!meta || this.hasUnlock(id) || this.currency < meta.cost) return false;
    this.currency -= meta.cost;
    this.unlocks.push(id);
    this.save();
    return true;
  }

  addCurrency(amount) {
    const n = Math.max(0, Math.floor(amount));
    this.currency += n;
    this.save();
    return n;
  }

  addScore(score, time, level) {
    this.highScores.push({
      score: Math.floor(score),
      time,
      level,
      date: new Date().toISOString().slice(0, 10)
    });
    this.highScores.sort((a, b) => b.score - a.score);
    this.highScores = this.highScores.slice(0, 5);
    this.runs++;
    this.totalScore += Math.floor(score);
    this.save();
  }

  get bestScore() {
    return this.highScores.length ? this.highScores[0].score : 0;
  }

  currencyMultiplier() {
    return this.hasUnlock('salvage') ? 1.2 : 1;
  }
}

export function draftUpgrades(player, count = 3) {
  const available = UPGRADES.filter((u) => {
    const stacks = player.upgradeCounts[u.id] || 0;
    return stacks < u.max;
  });
  const picks = [];
  const pool = available.slice();
  while (picks.length < count && pool.length > 0) {
    let total = 0;
    for (let i = 0; i < pool.length; i++) {
      total += RARITY_WEIGHT[pool[i].rarity] || 1;
    }
    let roll = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      roll -= RARITY_WEIGHT[pool[i].rarity] || 1;
      if (roll <= 0) {
        idx = i;
        break;
      }
    }
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picks;
}

export function applyUpgrade(id, player, game) {
  const up = UPGRADES.find((u) => u.id === id);
  if (!up) return null;
  const stacks = player.upgradeCounts[id] || 0;
  if (stacks >= up.max) return null;
  player.upgradeCounts[id] = stacks + 1;
  up.apply(player, game);
  if (game) {
    game.particles.ring(player.x, player.y, '#46f4ff', 16, 380, 0.55, 3);
    game.particles.sparkBurst(player.x, player.y, 22, '#8be9ff', 340, 2.6, 0.7);
    game.particles.text(player.x, player.y - 44, up.name.toUpperCase(), '#dffbff', 15, 1.2);
  }
  return up;
}
