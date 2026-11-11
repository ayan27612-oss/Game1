import { UPGRADES } from './Upgrades.js';

/**
 * Upgrades carry tags. Stacking tags unlocks automatic "protocol" bonuses at
 * 4 / 8 / 12 stacks, giving drafts a second layer of planning.
 */
export const SYNERGY_TAGS = {
  ballistic: { name: 'BALLISTIC', color: '#ff8a66', icon: 'B' },
  phase: { name: 'PHASE', color: '#46f4ff', icon: 'P' },
  tech: { name: 'TECH', color: '#b06bff', icon: 'T' },
  bio: { name: 'BIO', color: '#59ffa8', icon: 'V' },
  command: { name: 'COMMAND', color: '#ffc857', icon: 'C' }
};

export const SYNERGY_TIERS = [
  {
    tag: 'ballistic', at: 4, name: 'KINETIC ARRAY',
    desc: '+12% weapon damage.',
    apply: (p) => { p.stats.damage *= 1.12; }
  },
  {
    tag: 'ballistic', at: 8, name: 'RAILNET',
    desc: '+1 pierce and +10% bullet speed.',
    apply: (p) => { p.stats.pierce += 1; p.stats.bulletSpeed *= 1.1; }
  },
  {
    tag: 'ballistic', at: 12, name: 'SIEGE PROTOCOL',
    desc: '+25% weapon damage and +1 pierce.',
    apply: (p) => { p.stats.damage *= 1.25; p.stats.pierce += 1; }
  },
  {
    tag: 'phase', at: 4, name: 'VECTOR CONTROL',
    desc: '-15% dash recharge time.',
    apply: (p) => { p.stats.dashCooldown *= 0.85; }
  },
  {
    tag: 'phase', at: 8, name: 'PHASE RESERVOIR',
    desc: '+1 dash charge.',
    apply: (p) => {
      p.stats.maxDashCharges += 1;
      p.dashCharges = p.stats.maxDashCharges;
    }
  },
  {
    tag: 'phase', at: 12, name: 'ZERO POINT',
    desc: '+20% dash speed and -10% ability cooldowns.',
    apply: (p) => { p.stats.dashSpeed *= 1.2; p.stats.cooldownMult *= 0.9; }
  },
  {
    tag: 'tech', at: 4, name: 'CIRCUIT BLOOM',
    desc: '+12% ability power and -8% ability cooldowns.',
    apply: (p) => { p.stats.abilityPower *= 1.12; p.stats.cooldownMult *= 0.92; }
  },
  {
    tag: 'tech', at: 8, name: 'DRONE LINK',
    desc: 'Deploy +1 orbital blade.',
    apply: (p) => { p.stats.orbitalBlades += 1; }
  },
  {
    tag: 'tech', at: 12, name: 'SINGULARITY CORE',
    desc: '+25% ability power and +1 chain lightning arc.',
    apply: (p) => { p.stats.abilityPower *= 1.25; p.stats.chain += 1; }
  },
  {
    tag: 'bio', at: 4, name: 'NANITE BLOOM',
    desc: '+25 max hull and immediately restore 25 hull.',
    apply: (p) => {
      p.stats.maxHp += 25;
      p.hp = Math.min(p.stats.maxHp, p.hp + 25);
    }
  },
  {
    tag: 'bio', at: 8, name: 'REGENERATIVE MATRIX',
    desc: 'Regenerate +1.2 hull per second.',
    apply: (p) => { p.stats.regen += 1.2; }
  },
  {
    tag: 'bio', at: 12, name: 'IMMORTAL SHELL',
    desc: '+60 max hull, +2 hull/s regeneration.',
    apply: (p) => {
      p.stats.maxHp += 60;
      p.stats.regen += 2;
      p.hp = Math.min(p.stats.maxHp, p.hp + 60);
    }
  },
  {
    tag: 'command', at: 4, name: 'TACTICAL UPLINK',
    desc: '+15% XP gain and +40 pickup radius.',
    apply: (p) => { p.stats.xpGain += 0.15; p.stats.pickupRadius += 40; }
  },
  {
    tag: 'command', at: 8, name: 'SQUAD DOCTRINE',
    desc: 'Wingman damage +35% and fire rate +35%.',
    apply: (p) => { p.stats.allyDamage += 0.35; p.stats.allyRate += 0.35; }
  },
  {
    tag: 'command', at: 12, name: 'FLEET PROTOCOL',
    desc: '+1 draft reroll and +20% XP gain.',
    apply: (p) => { p.stats.rerolls += 1; p.stats.xpGain += 0.2; }
  }
];

const UPGRADE_TAGS = new Map(UPGRADES.map((u) => [u.id, u.tags || []]));

export function upgradeTags(id) {
  return UPGRADE_TAGS.get(id) || [];
}

export function tagCounts(player) {
  const counts = { ballistic: 0, phase: 0, tech: 0, bio: 0, command: 0 };
  const seen = player.upgradeCounts || {};
  for (const id in seen) {
    const stacks = seen[id] || 0;
    if (!stacks) continue;
    const tags = upgradeTags(id);
    for (let i = 0; i < tags.length; i++) {
      if (counts[tags[i]] != null) counts[tags[i]] += stacks;
    }
  }
  return counts;
}

export function synergyStatus(player) {
  const counts = tagCounts(player);
  return Object.keys(SYNERGY_TAGS).map((tag) => {
    const tiers = SYNERGY_TIERS.filter((t) => t.tag === tag);
    const count = counts[tag] || 0;
    const next = tiers.find((t) => count < t.at) || null;
    return { tag, count, tiers, next };
  });
}

/**
 * Applies any newly reached synergy tiers. Mutates player stats exactly once
 * per tier and returns the list of activations for UI feedback.
 */
export function checkSynergies(player, game) {
  if (!player.synergies) player.synergies = new Set();
  const counts = tagCounts(player);
  const activated = [];

  for (let i = 0; i < SYNERGY_TIERS.length; i++) {
    const tier = SYNERGY_TIERS[i];
    const key = `${tier.tag}:${tier.at}`;
    if (player.synergies.has(key)) continue;
    if ((counts[tier.tag] || 0) < tier.at) continue;
    player.synergies.add(key);
    tier.apply(player, game);
    activated.push(tier);
    if (game) {
      const meta = SYNERGY_TAGS[tier.tag];
      game.particles.ring(player.x, player.y, meta.color, 18, 560, 0.7, 4);
      game.particles.ring(player.x, player.y, '#ffffff', 10, 340, 0.5, 2);
      game.particles.sparkBurst(player.x, player.y, 26, meta.color, 380, 2.8, 0.8);
      game.particles.text(player.x, player.y - 58, `${meta.name} PROTOCOL`, meta.color, 16, 1.5);
      game.particles.text(player.x, player.y - 40, tier.name, '#dffbff', 12, 1.5);
      game.particles.addShake(5);
      if (game.audio) game.audio.levelUp();
    }
  }

  player.hp = Math.min(player.hp, player.stats.maxHp);
  return activated;
}
