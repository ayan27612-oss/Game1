import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/entities/Player.js';
import {
  SYNERGY_TIERS,
  checkSynergies,
  synergyStatus,
  tagCounts
} from '../src/systems/Synergies.js';

function makePlayer() {
  const player = new Player(0, 0);
  player.upgradeCounts = Object.create(null);
  return player;
}

test('tag counts include every tag on a stacked module', () => {
  const player = makePlayer();
  player.upgradeCounts.high_caliber = 2;
  player.upgradeCounts.overclock = 1;
  player.upgradeCounts.ricochet = 3;
  const counts = tagCounts(player);
  assert.equal(counts.ballistic, 6);
  assert.equal(counts.tech, 1);
  assert.equal(counts.phase, 3);
  assert.equal(counts.bio, 0);
  assert.equal(counts.command, 0);
});

test('ballistic tiers activate once at 4 / 8 / 12 stacks', () => {
  const player = makePlayer();
  player.upgradeCounts.high_caliber = 4;
  const baseDamage = player.stats.damage;
  const basePierce = player.stats.pierce;

  let activated = checkSynergies(player);
  assert.equal(activated.length, 1);
  assert.equal(activated[0].name, 'KINETIC ARRAY');
  assert.ok(Math.abs(player.stats.damage - baseDamage * 1.12) < 1e-9);

  assert.equal(checkSynergies(player).length, 0, 'a tier must never apply twice');
  assert.ok(Math.abs(player.stats.damage - baseDamage * 1.12) < 1e-9);

  player.upgradeCounts.high_caliber = 8;
  activated = checkSynergies(player);
  assert.deepEqual(activated.map((tier) => tier.name), ['RAILNET']);
  assert.equal(player.stats.pierce, basePierce + 1);

  player.upgradeCounts.high_caliber = 12;
  activated = checkSynergies(player);
  assert.deepEqual(activated.map((tier) => tier.name), ['SIEGE PROTOCOL']);
  assert.equal(player.stats.pierce, basePierce + 2);
});

test('multiple tags can activate in a single draft', () => {
  const player = makePlayer();
  player.upgradeCounts.high_caliber = 4;
  player.upgradeCounts.magnet = 4;
  const activated = checkSynergies(player);
  assert.deepEqual(activated.map((tier) => tier.name).sort(), ['KINETIC ARRAY', 'TACTICAL UPLINK']);
});

test('command tier 12 grants a draft reroll and XP', () => {
  const player = makePlayer();
  player.upgradeCounts.magnet = 12;
  const rerolls = player.stats.rerolls;
  const xp = player.stats.xpGain;
  const activated = checkSynergies(player);
  assert.equal(activated.length, 3);
  assert.equal(activated[2].name, 'FLEET PROTOCOL');
  assert.equal(player.stats.rerolls, rerolls + 1);
  assert.ok(player.stats.xpGain > xp);
});

test('synergy status exposes current count and next threshold', () => {
  const player = makePlayer();
  player.upgradeCounts.high_caliber = 5;
  const status = synergyStatus(player);
  const ballistic = status.find((entry) => entry.tag === 'ballistic');
  assert.equal(ballistic.count, 5);
  assert.equal(ballistic.next.at, 8);
  assert.equal(status.find((entry) => entry.tag === 'bio').next.at, 4);
});

test('tier table is internally ordered and unique', () => {
  const seen = new Set();
  for (const tier of SYNERGY_TIERS) {
    const key = `${tier.tag}:${tier.at}`;
    assert.ok(!seen.has(key), `duplicate tier ${key}`);
    seen.add(key);
    assert.ok([4, 8, 12].includes(tier.at));
  }
});
