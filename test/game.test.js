import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/Game.js';
import { SaveData } from '../src/systems/Upgrades.js';
import { WEAPONS } from '../src/systems/Weapons.js';

const noopAudio = new Proxy({}, { get: () => () => {} });

function makeInput(overrides = {}) {
  return {
    mouse: { x: 640, y: 360, down: false },
    usingTouch: false,
    usingPad: false,
    fireHeld: false,
    getMove: () => ({ x: 0, y: 0 }),
    getAimDir: () => null,
    isFiring: () => false,
    consumeDash: () => false,
    consumeMissile: () => false,
    consumeWeapon: () => null,
    ...overrides
  };
}

function makeGame(options = {}) {
  return new Game({
    view: { w: 1280, h: 720, dpr: 1 },
    input: options.input || makeInput(),
    audio: noopAudio,
    save: options.save || new SaveData(null),
    settings: options.settings || {},
    mark: options.mark || 'mark3'
  });
}

test('game boots with Mark III stats and the full weapon rack', () => {
  const game = makeGame();
  assert.equal(game.mark.id, 'mark3');
  assert.equal(game.player.stats.maxHp, 170);
  assert.equal(game.player.hp, 170);
  assert.equal(game.player.weapon.id, 'repulsor');
  assert.equal(game.player.weaponIndex, 0);
  assert.equal(game.player.stats.missileCount, 4);
  assert.equal(WEAPONS.length, 5);
});

test('meta unlocks modify the opening armor frame', () => {
  const save = new SaveData({ unlocks: ['hull', 'overclock', 'capacitor'] });
  const game = makeGame({ save });
  assert.equal(game.player.stats.maxHp, 195);
  assert.equal(game.player.hp, 195);
  assert.equal(game.player.stats.missileCount, 5);
  assert.equal(game.player.stats.maxDashCharges, 2);
  assert.equal(game.player.dashCharges, 2);
});

test('armor marks inject distinct opening profiles', () => {
  const strike = makeGame({ mark: 'mark42' });
  assert.equal(strike.mark.id, 'mark42');
  assert.equal(strike.player.stats.maxHp, 130);
  assert.ok(strike.player.stats.damage > 1.1);
  assert.ok(strike.player.stats.crit > 0.1);

  const siege = makeGame({ mark: 'hulkbuster' });
  assert.equal(siege.mark.id, 'hulkbuster');
  assert.equal(siege.player.stats.maxHp, 200);
  assert.equal(siege.player.stats.missileCount, 5);
});

test('locked armor marks fall back to Mark III', () => {
  const game = makeGame({ mark: 'bleeding_edge' });
  assert.equal(game.mark.id, 'mark3');
});

test('unlocked prototype mark applies its bonus profile', () => {
  const save = new SaveData({ unlocks: ['armor_bleeding_edge'] });
  const game = makeGame({ save, mark: 'bleeding_edge' });
  assert.equal(game.mark.id, 'bleeding_edge');
  assert.equal(game.player.stats.maxHp, 125);
  assert.equal(game.player.stats.maxDashCharges, 2);
});

test('firing consumes heat and spawns a projectile', () => {
  const game = makeGame();
  game.player.fireCooldown = 0;
  game.player.angle = 0;
  const weapon = game.player.fire(game);
  assert.equal(weapon.id, 'repulsor');
  assert.ok(game.player.heat > 0);
  assert.ok(game.bullets.active > 0);
});

test('weapon selection cycles through the rack', () => {
  const game = makeGame();
  assert.equal(game.player.cycleWeapon(1), true);
  assert.equal(game.player.weapon.id, 'unibeam');
  assert.equal(game.player.setWeapon(4), true);
  assert.equal(game.player.weapon.id, 'scatter');
  assert.equal(game.player.cycleWeapon(1), true);
  assert.equal(game.player.weapon.id, 'repulsor');
});

test('missile barrage spends its cooldown and launches the pod count', () => {
  const game = makeGame();
  game.player.missileCooldown = 0;
  assert.equal(game.player.launchBarrage(game), true);
  assert.ok(game.bullets.active >= 4);
  assert.equal(game.player.missileCooldown, 7);
  assert.equal(game.player.launchBarrage(game), false);
});

test('sustained fire triggers an overheat lockout', () => {
  const game = makeGame();
  game.player.heat = 0.99;
  game.player.fireCooldown = 0;
  game.player.fire(game);
  assert.equal(game.player.overheated, true);
  assert.equal(game.player.heat, 1);
});

test('dash spends a charge and grants i-frames', () => {
  const game = makeGame();
  game.player.dashCharges = 1;
  assert.equal(game.player.tryDash(game), true);
  assert.equal(game.player.dashCharges, 0);
  assert.ok(game.player.invuln > 0);
  assert.ok(game.player.dashTimer > 0);
});

test('run finalization awards credits, records the mark, and is idempotent', () => {
  const game = makeGame();
  game.score = 12345;
  game.threat = 9;
  game.elapsed = 42;
  game.kills = 7;
  game.comboBest = 12;

  const earned = game.finalizeRun();
  assert.equal(earned, 198);
  assert.equal(game.save.currency, 198);
  assert.equal(game.save.runs, 1);
  assert.equal(game.save.bestScore, 12345);
  assert.equal(game.save.bestThreat, 9);
  const record = game.save.highScores[0];
  assert.equal(record.kills, 7);
  assert.equal(record.combo, 12);
  assert.equal(record.threat, 9);
  assert.equal(record.mark, 'mark3');

  assert.equal(game.finalizeRun(), 0);
  assert.equal(game.save.runs, 1);
  assert.equal(game.save.currency, 198);
});

test('salvage protocol multiplies run earnings', () => {
  const save = new SaveData({ unlocks: ['salvage'] });
  const game = makeGame({ save });
  game.score = 12345;
  game.threat = 9;
  game.kills = 7;
  assert.equal(game.finalizeRun(), 238);
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
