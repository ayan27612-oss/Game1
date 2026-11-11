import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_KEYS,
  SAVE_KEY,
  SAVE_VERSION,
  SaveData
} from '../src/systems/Upgrades.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    }
  };
}

test('fresh saves use the current schema with sane defaults', () => {
  const save = new SaveData(null);
  assert.equal(save.version, SAVE_VERSION);
  assert.equal(save.currency, 0);
  assert.deepEqual(save.highScores, []);
  assert.deepEqual(save.unlocks, []);
  assert.equal(save.doctrine, 'vanguard');
  assert.equal(save.settings.quality, 'auto');
  assert.equal(save.settings.music, 0.7);
  assert.equal(save.bestLevel, 1);
});

test('legacy v1 saves migrate to the current key', () => {
  const legacy = JSON.stringify({
    currency: 420,
    runs: 3,
    totalScore: 900,
    totalKills: 70,
    bestCombo: 22,
    highScores: [{ score: 500, level: 5, combo: 22, kills: 30, time: 90 }],
    settings: { music: 0.2, sfx: 0.4, muted: true, quality: 'low' }
  });
  const store = memoryStorage({ [LEGACY_KEYS[0]]: legacy });
  const save = SaveData.load(store);

  assert.equal(save.currency, 420);
  assert.equal(save.runs, 3);
  assert.equal(save.bestScore, 500);
  assert.equal(save.settings.music, 0.2);
  assert.equal(save.settings.muted, true);
  assert.ok(store.getItem(SAVE_KEY), 'migration should write the current save key');
  assert.equal(JSON.parse(store.getItem(SAVE_KEY)).version, SAVE_VERSION);
});

test('current save key wins over legacy data', () => {
  const store = memoryStorage({
    [SAVE_KEY]: JSON.stringify({ currency: 9001, doctrine: 'lancer' }),
    [LEGACY_KEYS[0]]: JSON.stringify({ currency: 5, doctrine: 'warden' })
  });
  const save = SaveData.load(store);
  assert.equal(save.currency, 9001);
  assert.equal(save.doctrine, 'lancer');
});

test('corrupt data falls back to a fresh save', () => {
  const store = memoryStorage({ [SAVE_KEY]: '{not json' });
  const save = SaveData.load(store);
  assert.equal(save.currency, 0);
  assert.deepEqual(save.unlocks, []);
});

test('untrusted save fields are sanitized', () => {
  const save = new SaveData({
    currency: -100,
    runs: -2,
    highScores: [
      { score: 'nope' },
      { score: 10, level: -5, kills: -1, doctrine: 'x'.repeat(60) },
      ...Array.from({ length: 12 }, (_, i) => ({ score: 100 + i, level: 2 }))
    ],
    unlocks: ['hull', 42, null, 'barrel'],
    doctrine: '../../etc/passwd',
    settings: { music: 4, sfx: -2, quality: 'ultra', muted: 1 },
    ship: { callsign: 'n0va!!', style: -4, palette: 2 }
  });

  assert.equal(save.currency, 0);
  assert.equal(save.runs, 0);
  assert.equal(save.doctrine, 'vanguard');
  assert.equal(save.highScores.length, 8);
  assert.ok(save.highScores.every((entry) => Number.isFinite(entry.score)));
  assert.equal(save.highScores[0].score, 111);
  assert.equal(save.highScores.at(-1).score, 104);
  assert.deepEqual(save.unlocks, ['hull', 'barrel']);
  assert.equal(save.settings.music, 1);
  assert.equal(save.settings.sfx, 0);
  assert.equal(save.settings.quality, 'auto');
  assert.equal(save.ship.callsign, 'N0VA');
  assert.equal(save.ship.style, 0);
});

test('run records update career aggregates and cap the leaderboard', () => {
  const save = new SaveData(null);
  for (let i = 0; i < 10; i++) {
    save.addScore({ score: i * 100, time: 10, level: i + 1, kills: 2, combo: i, doctrine: 'lancer' });
  }
  assert.equal(save.highScores.length, 8);
  assert.equal(save.bestScore, 900);
  assert.equal(save.runs, 10);
  assert.equal(save.totalKills, 20);
  assert.equal(save.totalTime, 100);
  assert.equal(save.bestCombo, 9);
  assert.equal(save.bestLevel, 10);
  assert.equal(save.averageScore, 450);
});

test('settings, purchases, and currency are validated', () => {
  const save = new SaveData(null);
  save.setSetting('quality', 'medium');
  save.setSetting('doofus', 'yes');
  assert.equal(save.settings.quality, 'medium');
  assert.ok(!('doofus' in save.settings));

  assert.equal(save.buyUnlock('hull'), false, 'cannot buy without credits');
  save.addCurrency(139.9);
  assert.equal(save.currency, 139);
  assert.equal(save.buyUnlock('hull'), false);
  save.addCurrency(1);
  assert.equal(save.buyUnlock('hull'), true);
  assert.equal(save.hasUnlock('hull'), true);
  assert.equal(save.currency, 0);
  assert.equal(save.buyUnlock('hull'), false, 'cannot buy twice');
});

test('salvage unlock modifies the credit multiplier', () => {
  const save = new SaveData(null);
  assert.equal(save.currencyMultiplier(), 1);
  save.unlocks.push('salvage');
  assert.equal(save.currencyMultiplier(), 1.2);
});
