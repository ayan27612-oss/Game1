/**
 * Starting doctrines. A doctrine is picked in the hangar before a run and
 * injects a distinct opening build so every run has an identity from second 0.
 */
export const DOCTRINES = [
  {
    id: 'vanguard',
    name: 'VANGUARD',
    role: 'BALANCED',
    color: '#46f4ff',
    desc: 'A stable all-rounder hull. Forgiving, flexible, and strong with any draft.',
    bonus: ['+25 MAX HULL', '+6% ARMOR', '+5% FIRE RATE'],
    apply: (p) => {
      p.stats.maxHp += 25;
      p.stats.armor = Math.min(0.6, p.stats.armor + 0.06);
      p.stats.fireRate *= 1.05;
    }
  },
  {
    id: 'lancer',
    name: 'LANCER',
    role: 'GLASS CANNON',
    color: '#ff2f8e',
    desc: 'A stripped-down strike frame. Trades hull integrity for raw burst damage.',
    bonus: ['+18% DAMAGE', '+8% FIRE RATE', '+6% CRIT', '-12 MAX HULL'],
    apply: (p) => {
      p.stats.damage *= 1.18;
      p.stats.fireRate *= 1.08;
      p.stats.crit = Math.min(0.7, p.stats.crit + 0.06);
      p.stats.maxHp -= 12;
    }
  },
  {
    id: 'warden',
    name: 'WARDEN',
    role: 'BULWARK',
    color: '#59ffa8',
    desc: 'A siege platform built to outlast the swarm. Slower trigger, tougher shell.',
    bonus: ['+45 MAX HULL', '+12% ARMOR', '-10% COOLDOWNS', '-8% FIRE RATE'],
    apply: (p) => {
      p.stats.maxHp += 45;
      p.stats.armor = Math.min(0.6, p.stats.armor + 0.12);
      p.stats.cooldownMult *= 0.9;
      p.stats.fireRate *= 0.92;
      p.stats.regen += 0.3;
    }
  },
  {
    id: 'phantom',
    name: 'PHANTOM',
    role: 'EVASION',
    color: '#b06bff',
    unlock: 'doctrine_phantom',
    desc: 'A prototype phase-frame that never stands still. Unlocked in the Meta Lab.',
    bonus: ['+1 DASH CHARGE', '+12% MOVE SPEED', '+0.06s I-FRAMES', '-20 MAX HULL'],
    apply: (p) => {
      p.stats.maxDashCharges += 1;
      p.stats.moveSpeed *= 1.12;
      p.stats.dashIFrames += 0.06;
      p.stats.maxHp -= 20;
    }
  }
];

const BY_ID = new Map(DOCTRINES.map((d) => [d.id, d]));

export function getDoctrine(id) {
  return BY_ID.get(id) || DOCTRINES[0];
}

export function isDoctrineUnlocked(doctrine, save) {
  return !doctrine.unlock || (save && save.hasUnlock(doctrine.unlock));
}

export function doctrineSummary(doctrine) {
  return doctrine.bonus.join('  ·  ');
}
