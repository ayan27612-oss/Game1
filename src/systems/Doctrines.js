/**
 * Armor marks. A mark is chosen in the armory before deployment and injects a
 * distinct opening profile, so every run has an identity from the first frame.
 * No in-run levelling, drafting or ability unlocks — the mark is the build.
 */
export const ARMOR_MARKS = [
  {
    id: 'mark3',
    name: 'MARK III',
    role: 'BALANCED',
    color: '#ffd76a',
    desc: 'The classic combat suit. Reliable plating, stable reactor output, forgiving on every front.',
    bonus: ['+30 MAX HULL', '+4% ARMOR', '+5% FIRE RATE'],
    apply: (p) => {
      p.stats.maxHp += 30;
      p.stats.armor = Math.min(0.6, p.stats.armor + 0.04);
      p.stats.fireRate *= 1.05;
    }
  },
  {
    id: 'mark42',
    name: 'MARK XLII',
    role: 'STRIKE',
    color: '#ff4b3a',
    desc: 'Segmented prehensile plating. Built to close distance and hit first, trading shell mass for speed.',
    bonus: ['+16% DAMAGE', '+8% FIRE RATE', '+6% CRIT', '-10 MAX HULL'],
    apply: (p) => {
      p.stats.damage *= 1.16;
      p.stats.fireRate *= 1.08;
      p.stats.crit = Math.min(0.7, p.stats.crit + 0.06);
      p.stats.maxHp -= 10;
      p.stats.moveSpeed *= 1.04;
    }
  },
  {
    id: 'hulkbuster',
    name: 'HULKBUSTER',
    role: 'SIEGE',
    color: '#c99a52',
    desc: 'Heavy siege chassis with a shoulder missile pod. Slower, but almost impossible to break.',
    bonus: ['+60 MAX HULL', '+14% ARMOR', '+1 MISSILE', '-8% FIRE RATE', '-6% SPEED'],
    apply: (p) => {
      p.stats.maxHp += 60;
      p.stats.armor = Math.min(0.6, p.stats.armor + 0.14);
      p.stats.fireRate *= 0.92;
      p.stats.moveSpeed *= 0.94;
      p.stats.missileCount += 1;
      p.stats.missileDamage *= 1.1;
    }
  },
  {
    id: 'bleeding_edge',
    name: 'BLEEDING EDGE',
    role: 'PROTOTYPE',
    color: '#8fe8ff',
    unlock: 'armor_bleeding_edge',
    desc: 'Next-generation nanite armor. Bleeding-edge mobility and targeting, unlocked in the Fabricator.',
    bonus: ['+1 DASH CHARGE', '+10% SPEED', '+8% CRIT', '+0.05s I-FRAMES', '-15 MAX HULL'],
    apply: (p) => {
      p.stats.maxDashCharges += 1;
      p.stats.moveSpeed *= 1.1;
      p.stats.crit = Math.min(0.7, p.stats.crit + 0.08);
      p.stats.dashIFrames += 0.05;
      p.stats.maxHp -= 15;
    }
  }
];

const BY_ID = new Map(ARMOR_MARKS.map((mark) => [mark.id, mark]));

const LEGACY_MARK_MAP = {
  vanguard: 'mark3',
  lancer: 'mark42',
  warden: 'hulkbuster',
  phantom: 'bleeding_edge',
  mark3: 'mark3',
  mark42: 'mark42',
  hulkbuster: 'hulkbuster',
  bleeding_edge: 'bleeding_edge'
};

export function normalizeMarkId(id) {
  return LEGACY_MARK_MAP[String(id || '').toLowerCase()] || 'mark3';
}

export function getArmorMark(id) {
  return BY_ID.get(normalizeMarkId(id)) || ARMOR_MARKS[0];
}

export function isArmorMarkUnlocked(mark, save) {
  return !mark.unlock || (save && save.hasUnlock(mark.unlock));
}

export function armorMarkSummary(mark) {
  return mark.bonus.join('  ·  ');
}

// Backwards-compatible aliases for older imports.
export const DOCTRINES = ARMOR_MARKS;
export const getDoctrine = getArmorMark;
export const isDoctrineUnlocked = isArmorMarkUnlocked;
export const doctrineSummary = armorMarkSummary;
