import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/entities/Player.js';
import {
  UPGRADES,
  applyUpgrade,
  draftUpgrades,
  rarityWeight
} from '../src/systems/Upgrades.js';

function makePlayer() {
  const player = new Player(0, 0);
  player.upgradeCounts = Object.create(null);
  return player;
}

test('rarity weighting shifts toward rare modules as level rises', () => {
  assert.ok(rarityWeight(1, 1) > rarityWeight(1, 60));
  assert.ok(rarityWeight(2, 60) > rarityWeight(2, 1));
  assert.ok(rarityWeight(3, 60) > rarityWeight(3, 1));
  assert.equal(rarityWeight(1, 1), 60.65);
  assert.ok(rarityWeight(1, 100) >= 18, 'common weight has a floor');
});

test('drafts return unique, available modules', () => {
  const player = makePlayer();
  const picks = draftUpgrades(player, 3, 1);
  assert.equal(picks.length, 3);
  assert.equal(new Set(picks.map((u) => u.id)).size, 3);
  for (const pick of picks) assert.ok(UPGRADES.includes(pick));
});

test('maxed modules never appear in future drafts', () => {
  const player = makePlayer();
  for (const upgrade of UPGRADES) player.upgradeCounts[upgrade.id] = upgrade.max;
  assert.deepEqual(draftUpgrades(player, 3, 10), []);

  const oneLeft = makePlayer();
  for (const upgrade of UPGRADES) oneLeft.upgradeCounts[upgrade.id] = upgrade.max;
  oneLeft.upgradeCounts.high_caliber = 0;
  for (let i = 0; i < 100; i++) {
    const picks = draftUpgrades(oneLeft, 3, 10);
    assert.equal(picks.length, 1);
    assert.equal(picks[0].id, 'high_caliber');
  }
});

test('draft count is bounded by the available pool', () => {
  const player = makePlayer();
  for (const upgrade of UPGRADES) player.upgradeCounts[upgrade.id] = upgrade.max;
  player.upgradeCounts.high_caliber = 0;
  assert.equal(draftUpgrades(player, 5, 1).length, 1);
});

test('applying an upgrade increments stacks and mutates stats', () => {
  const player = makePlayer();
  const before = player.stats.damage;
  const applied = applyUpgrade('high_caliber', player);
  assert.equal(applied.id, 'high_caliber');
  assert.equal(player.upgradeCounts.high_caliber, 1);
  assert.ok(player.stats.damage > before);
  assert.equal(applyUpgrade('not_a_module', player), null);
});

test('upgrade stacks stop at the module maximum', () => {
  const player = makePlayer();
  for (let i = 0; i < 10; i++) applyUpgrade('high_caliber', player);
  assert.equal(player.upgradeCounts.high_caliber, 5);
});
