import { normalizeMarkId } from './Doctrines.js';

export const SAVE_KEY = 'protocol_warforge_save_v3';
export const LEGACY_KEYS = ['protocol_swarm_save_v2', 'protocol_swarm_save_v1'];
export const SAVE_VERSION = 4;

export const META_UNLOCKS = [
  {
    id: 'hull', name: 'Reinforced Plating', desc: '+25 starting max hull.', cost: 140,
    apply: (p) => { p.stats.maxHp += 25; p.hp = p.stats.maxHp; }
  },
  {
    id: 'barrel', name: 'Repulsor Calibration', desc: '+8% weapon damage.', cost: 180,
    apply: (p) => { p.stats.damage *= 1.08; }
  },
  {
    id: 'capacitor', name: 'Arc Capacitor', desc: '+1 starting dash charge.', cost: 240,
    apply: (p) => { p.stats.maxDashCharges += 1; p.dashCharges = p.stats.maxDashCharges; }
  },
  {
    id: 'neural', name: 'Targeting Suite', desc: '+5% critical chance.', cost: 260,
    apply: (p) => { p.stats.crit = Math.min(0.7, p.stats.crit + 0.05); }
  },
  {
    id: 'cryo', name: 'Cryo Coolant', desc: '+15% weapon cooling.', cost: 280,
    apply: (p) => { p.stats.coolRate *= 1.15; }
  },
  {
    id: 'servo', name: 'Servo Actuators', desc: '+5% movement speed.', cost: 300,
    apply: (p) => { p.stats.moveSpeed *= 1.05; }
  },
  {
    id: 'salvage', name: 'Salvage Protocol', desc: '+20% credits earned at run end.', cost: 340,
    apply: () => {}
  },
  {
    id: 'plating', name: 'Ablative Layer', desc: '+6% starting armor.', cost: 380,
    apply: (p) => { p.stats.armor = Math.min(0.6, p.stats.armor + 0.06); }
  },
  {
    id: 'overclock', name: 'Missile Pod', desc: '+1 missile in every barrage.', cost: 520,
    apply: (p) => { p.stats.missileCount += 1; }
  },
  {
    id: 'armor_bleeding_edge', name: 'Bleeding Edge Armor', desc: 'Unlocks the BLEEDING EDGE armor mark.', cost: 650,
    apply: () => {}
  },
  {
    id: 'emergency', name: 'Emergency Protocol', desc: 'Survive one fatal hit per run at 35% hull.', cost: 780,
    apply: (p) => { p.stats.reviveCharges += 1; }
  }
];

const LEGACY_UNLOCK_MAP = {
  doctrine_phantom: 'armor_bleeding_edge'
};

export const DEFAULT_SETTINGS = {
  music: 0.7,
  sfx: 0.9,
  muted: false,
  screenShake: true,
  damageNumbers: true,
  reducedMotion: false,
  scanlines: true,
  quality: 'auto',
  autoFire: true
};

function clamp01(v, fallback) {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

function sanitizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === 'object') {
    s.music = clamp01(raw.music, s.music);
    s.sfx = clamp01(raw.sfx, s.sfx);
    s.muted = !!raw.muted;
    s.screenShake = raw.screenShake !== false;
    s.damageNumbers = raw.damageNumbers !== false;
    s.reducedMotion = !!raw.reducedMotion;
    s.scanlines = raw.scanlines !== false;
    s.autoFire = raw.autoFire !== false;
    if (raw.quality === 'high' || raw.quality === 'medium' || raw.quality === 'low' || raw.quality === 'auto') {
      s.quality = raw.quality;
    }
  }
  return s;
}

function freshSave() {
  return {
    version: SAVE_VERSION,
    currency: 0,
    highScores: [],
    unlocks: [],
    runs: 0,
    totalScore: 0,
    totalKills: 0,
    totalTime: 0,
    bestCombo: 0,
    bestThreat: 1,
    ship: { frame: 0, palette: 0, ally: 0, callsign: 'TONY' },
    mark: 'mark3',
    settings: { ...DEFAULT_SETTINGS },
    seenBriefing: false,
    achievements: []
  };
}

function sanitizeShip(raw) {
  const ship = { frame: 0, palette: 0, ally: 0, callsign: 'TONY' };
  if (raw && typeof raw === 'object') {
    const frame = Number.isFinite(raw.frame) ? raw.frame : raw.style;
    if (Number.isFinite(frame)) ship.frame = Math.max(0, Math.floor(frame));
    if (Number.isFinite(raw.palette)) ship.palette = Math.max(0, Math.floor(raw.palette));
    if (Number.isFinite(raw.ally)) ship.ally = Math.max(0, Math.floor(raw.ally));
    if (typeof raw.callsign === 'string') {
      const cs = raw.callsign.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
      if (cs) ship.callsign = cs;
    }
  }
  return ship;
}

function sanitizeScore(s) {
  if (!s || !Number.isFinite(s.score)) return null;
  const threat = Number.isFinite(s.threat) ? s.threat : s.level;
  return {
    score: Math.max(0, Math.floor(s.score)),
    time: Number.isFinite(s.time) ? Math.max(0, s.time) : 0,
    threat: Number.isFinite(threat) ? Math.max(1, Math.floor(threat)) : 1,
    kills: Number.isFinite(s.kills) ? Math.max(0, Math.floor(s.kills)) : 0,
    combo: Number.isFinite(s.combo) ? Math.max(0, Math.floor(s.combo)) : 0,
    mark: normalizeMarkId(typeof s.mark === 'string' ? s.mark : s.doctrine),
    date: typeof s.date === 'string' ? s.date.slice(0, 10) : ''
  };
}

function migrateUnlocks(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    if (typeof list[i] !== 'string') continue;
    const id = LEGACY_UNLOCK_MAP[list[i]] || list[i];
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export class SaveData {
  constructor(data) {
    const base = freshSave();
    if (data && typeof data === 'object') {
      base.currency = Number.isFinite(data.currency) ? Math.max(0, data.currency) : 0;
      base.runs = Number.isFinite(data.runs) ? Math.max(0, data.runs) : 0;
      base.totalScore = Number.isFinite(data.totalScore) ? Math.max(0, data.totalScore) : 0;
      base.totalKills = Number.isFinite(data.totalKills) ? Math.max(0, data.totalKills) : 0;
      base.totalTime = Number.isFinite(data.totalTime) ? Math.max(0, data.totalTime) : 0;
      base.bestCombo = Number.isFinite(data.bestCombo) ? Math.max(0, data.bestCombo) : 0;
      const threat = Number.isFinite(data.bestThreat) ? data.bestThreat : data.bestLevel;
      base.bestThreat = Number.isFinite(threat) ? Math.max(1, Math.floor(threat)) : 1;
      base.seenBriefing = !!data.seenBriefing;
      base.unlocks = migrateUnlocks(data.unlocks);
      if (Array.isArray(data.achievements)) {
        base.achievements = data.achievements.filter((u) => typeof u === 'string');
      }
      if (Array.isArray(data.highScores)) {
        base.highScores = data.highScores.map(sanitizeScore).filter(Boolean)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);
      }
      base.mark = normalizeMarkId(data.mark || data.doctrine);
      base.settings = sanitizeSettings(data.settings);
    }
    this.version = SAVE_VERSION;
    this.currency = base.currency;
    this.highScores = base.highScores;
    this.unlocks = base.unlocks;
    this.runs = base.runs;
    this.totalScore = base.totalScore;
    this.totalKills = base.totalKills;
    this.totalTime = base.totalTime;
    this.bestCombo = base.bestCombo;
    this.bestThreat = base.bestThreat;
    this.ship = sanitizeShip(data && data.ship);
    this.mark = base.mark;
    this.settings = base.settings;
    this.seenBriefing = base.seenBriefing;
    this.achievements = base.achievements;
  }

  static load(storage) {
    const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return new SaveData(null);
    try {
      const current = store.getItem(SAVE_KEY);
      if (current) return new SaveData(JSON.parse(current));
      for (let i = 0; i < LEGACY_KEYS.length; i++) {
        const raw = store.getItem(LEGACY_KEYS[i]);
        if (!raw) continue;
        const migrated = new SaveData(JSON.parse(raw));
        migrated.save(store);
        return migrated;
      }
      return new SaveData(null);
    } catch (err) {
      return new SaveData(null);
    }
  }

  save(storage) {
    const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return;
    try {
      store.setItem(SAVE_KEY, JSON.stringify({
        version: this.version,
        currency: this.currency,
        highScores: this.highScores,
        unlocks: this.unlocks,
        runs: this.runs,
        totalScore: this.totalScore,
        totalKills: this.totalKills,
        totalTime: this.totalTime,
        bestCombo: this.bestCombo,
        bestThreat: this.bestThreat,
        ship: this.ship,
        mark: this.mark,
        settings: this.settings,
        seenBriefing: this.seenBriefing,
        achievements: this.achievements
      }));
    } catch (err) {
      /* private mode / full storage */
    }
  }

  reset() {
    const fresh = freshSave();
    this.version = fresh.version;
    this.currency = 0;
    this.highScores = [];
    this.unlocks = [];
    this.runs = 0;
    this.totalScore = 0;
    this.totalKills = 0;
    this.totalTime = 0;
    this.bestCombo = 0;
    this.bestThreat = 1;
    this.ship = { frame: 0, palette: 0, ally: 0, callsign: 'TONY' };
    this.mark = 'mark3';
    this.settings = { ...DEFAULT_SETTINGS };
    this.seenBriefing = false;
    this.achievements = [];
    this.save();
  }

  setShip(part, value) {
    if (!this.ship) this.ship = { frame: 0, palette: 0, ally: 0, callsign: 'TONY' };
    const key = part === 'style' ? 'frame' : part;
    if (key === 'frame' || key === 'palette' || key === 'ally') {
      this.ship[key] = Math.max(0, Math.floor(value));
      this.save();
    } else if (key === 'callsign') {
      const cs = String(value).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
      this.ship.callsign = cs || 'TONY';
      this.save();
    }
  }

  getShipConfig() {
    return sanitizeShip(this.ship);
  }

  setMark(id) {
    this.mark = normalizeMarkId(id);
    this.save();
  }

  // Legacy alias.
  setDoctrine(id) {
    this.setMark(id);
  }

  setSetting(key, value) {
    if (!(key in DEFAULT_SETTINGS)) return;
    this.settings = sanitizeSettings({ ...this.settings, [key]: value });
    this.save();
  }

  markBriefingSeen() {
    this.seenBriefing = true;
    this.save();
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

  addScore(record) {
    const entry = sanitizeScore(record) || sanitizeScore({ score: 0 });
    this.highScores.push(entry);
    this.highScores.sort((a, b) => b.score - a.score);
    this.highScores = this.highScores.slice(0, 8);
    this.runs++;
    this.totalScore += entry.score;
    this.totalKills += entry.kills;
    this.totalTime += entry.time;
    this.bestCombo = Math.max(this.bestCombo, entry.combo);
    this.bestThreat = Math.max(this.bestThreat, entry.threat);
    this.save();
  }

  get bestScore() {
    return this.highScores.length ? this.highScores[0].score : 0;
  }

  get averageScore() {
    return this.runs ? Math.round(this.totalScore / this.runs) : 0;
  }

  currencyMultiplier() {
    return this.hasUnlock('salvage') ? 1.2 : 1;
  }
}
