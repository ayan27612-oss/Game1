import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/Game.js';
import { SaveData } from '../src/systems/Upgrades.js';

const noopAudio = new Proxy({}, { get: () => () => {} });
const inputStub = {
  getMove: () => ({ x: 0, y: 0 }),
  getAim: () => ({ x: 1, y: 0 }),
  isFiring: () => false,
  consumeDash: () => false,
  consumeAbilities: () => []
};

function makeGame(options = {}) {
  return new Game({
    view: { w: 1280, h: 720 },
    input: inputStub,
    audio: noopAudio,
    save: options.save || new SaveData(null),
    settings: {},
    doctrine: options.doctrine || 'vanguard'
  });
}

test('game boots with doctrine stats and full reroll charges', () => {
  const game = makeGame();
  assert.equal(game.player.stats.maxHp, 155);
  assert.equal(game.player.hp, 155);
  assert.equal(game.rerolls, 2);
  assert.equal(game.rerollCap, 2);
  assert.equal(game.doctrine.id, 'vanguard');
});

test('meta unlocks modify the opening frame', () => {
  const save = new SaveData({ unlocks: ['hull', 'overclock'] });
  const game = makeGame({ save });
  assert.equal(game.player.stats.maxHp, 180);
  assert.equal(game.rerolls, 3);
  assert.equal(game.rerollCap, 3);
});

test('spent rerolls are not refunded when the cap is unchanged', () => {
  const game = makeGame();
  game.rerollDraft();
  assert.equal(game.rerolls, 1);
  game.player.stats.rerolls = 2;
  game.applyChosen('high_caliber');
  assert.equal(game.rerolls, 1);
  assert.equal(game.rerollCap, 2);
});

test('raising the reroll cap grants only the new charge', () => {
  const game = makeGame();
  game.rerollDraft();
  assert.equal(game.rerolls, 1);
  game.player.stats.rerolls = 3; // FLEET PROTOCOL / Draft Overclock
  game.applyChosen('heavy');
  assert.equal(game.rerolls, 2);
  assert.equal(game.rerollCap, 3);
});

test('multiple pending level-ups draft down to zero', () => {
  const game = makeGame();
  let levelUpCallbacks = 0;
  game.onLevelUp = () => { levelUpCallbacks++; };
  game.gainXp(1000);
  const pending = game.pendingLevelUps;
  assert.ok(game.level > 1);
  assert.ok(pending > 1);
  assert.equal(game.draftOpen, true);
  assert.equal(levelUpCallbacks, 1);

  let selections = 0;
  while (game.pendingLevelUps > 0 && selections++ < 100) {
    const choices = game.createDraft();
    assert.equal(choices.length, 3);
    game.applyChosen(choices[0].id);
  }
  assert.equal(selections, pending);
  assert.equal(game.pendingLevelUps, 0);
  assert.equal(game.draftOpen, false);
});

test('run finalization awards credits, records the score, and is idempotent', () => {
  const game = makeGame();
  game.score = 12345;
  game.level = 9;
  game.elapsed = 42;
  game.kills = 7;
  game.comboBest = 12;

  const earned = game.finalizeRun();
  assert.equal(earned, 150);
  assert.equal(game.save.currency, 150);
  assert.equal(game.save.runs, 1);
  assert.equal(game.save.bestScore, 12345);
  const record = game.save.highScores[0];
  assert.equal(record.kills, 7);
  assert.equal(record.combo, 12);
  assert.equal(record.doctrine, 'vanguard');

  assert.equal(game.finalizeRun(), 0);
  assert.equal(game.save.runs, 1);
  assert.equal(game.save.currency, 150);
});

test('locked doctrines fall back to vanguard', () => {
  const game = makeGame({ doctrine: 'phantom' });
  assert.equal(game.doctrine.id, 'vanguard');
});

test('death callback fires once', () => {
  const game = makeGame();
  let deaths = 0;
  game.onGameOver = () => { deaths++; };
  game.onPlayerDeath();
  game.onPlayerDeath();
  assert.equal(deaths, 1);
  assert.equal(game.over, true);
});
