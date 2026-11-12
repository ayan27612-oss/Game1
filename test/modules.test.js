import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODULES = [
  'src/Game.js',
  'src/engine/AudioSynth.js',
  'src/engine/MathUtils.js',
  'src/engine/Projection.js',
  'src/engine/Quadtree.js',
  'src/entities/Ally.js',
  'src/entities/Enemies.js',
  'src/entities/Player.js',
  'src/systems/Customization.js',
  'src/systems/Doctrines.js',
  'src/systems/Particles.js',
  'src/systems/Upgrades.js',
  'src/systems/Weapons.js',
  'src/ui/Hud.js',
  'src/ui/Input.js',
  'src/ui/Menu.js',
  'src/ui/Touch.js'
];

test('every runtime ES module imports cleanly in Node', async () => {
  for (const file of MODULES) {
    const module = await import(pathToFileURL(join(ROOT, file)));
    assert.ok(module, `${file} should load`);
  }
});

test('core systems expose the WARFORGE API surface', async () => {
  const upgrades = await import(pathToFileURL(join(ROOT, 'src/systems/Upgrades.js')));
  const weapons = await import(pathToFileURL(join(ROOT, 'src/systems/Weapons.js')));
  const marks = await import(pathToFileURL(join(ROOT, 'src/systems/Doctrines.js')));
  const custom = await import(pathToFileURL(join(ROOT, 'src/systems/Customization.js')));
  const game = await import(pathToFileURL(join(ROOT, 'src/Game.js')));
  const input = await import(pathToFileURL(join(ROOT, 'src/ui/Input.js')));

  assert.equal(typeof upgrades.SaveData, 'function');
  assert.equal(upgrades.SAVE_VERSION, 4);
  assert.ok(Array.isArray(upgrades.META_UNLOCKS));

  assert.equal(weapons.WEAPONS.length, 5);
  assert.equal(typeof weapons.fireWeapon, 'function');
  assert.equal(typeof weapons.fireBarrage, 'function');
  assert.ok(weapons.WEAPON_BY_ID instanceof Map);
  assert.equal(weapons.WEAPON_BY_ID.size, 5);

  assert.equal(marks.ARMOR_MARKS.length, 4);
  assert.equal(typeof marks.getArmorMark, 'function');
  assert.equal(typeof marks.isArmorMarkUnlocked, 'function');
  assert.equal(marks.getArmorMark('lancer').id, 'mark42');
  assert.equal(marks.getArmorMark('warden').id, 'hulkbuster');
  assert.equal(marks.getArmorMark('phantom').id, 'bleeding_edge');

  assert.equal(typeof custom.drawArmorBody, 'function');
  assert.equal(typeof game.Game, 'function');
  assert.equal(typeof input.Input, 'function');
  assert.equal(input.TOUCH_LAYOUT.fire.id, 'fire');
  assert.equal(input.TOUCH_LAYOUT.missile.id, 'missile');
});

test('weapon rack ids, keys, and heat profiles are unique and sane', async () => {
  const { WEAPONS } = await import(pathToFileURL(join(ROOT, 'src/systems/Weapons.js')));
  const ids = new Set();
  const keys = new Set();
  for (let i = 0; i < WEAPONS.length; i++) {
    const weapon = WEAPONS[i];
    assert.ok(!ids.has(weapon.id), `duplicate weapon id ${weapon.id}`);
    assert.ok(!keys.has(weapon.key), `duplicate weapon key ${weapon.key}`);
    ids.add(weapon.id);
    keys.add(weapon.key);
    assert.equal(typeof weapon.fire, 'function');
    assert.ok(weapon.fireRate > 0);
    assert.ok(weapon.heat > 0 && weapon.heat < 1);
    assert.ok(weapon.damage === undefined || weapon.damage > 0);
  }
  assert.deepEqual([...keys].sort(), ['1', '2', '3', '4', '5']);
});

test('armor marks all declare a name, role, color, and bonus list', async () => {
  const { ARMOR_MARKS } = await import(pathToFileURL(join(ROOT, 'src/systems/Doctrines.js')));
  for (const mark of ARMOR_MARKS) {
    assert.equal(typeof mark.apply, 'function');
    assert.ok(mark.name);
    assert.ok(mark.role);
    assert.ok(mark.color);
    assert.ok(Array.isArray(mark.bonus) && mark.bonus.length > 0);
  }
});
