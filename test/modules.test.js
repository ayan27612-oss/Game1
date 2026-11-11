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
  'src/systems/Abilities.js',
  'src/systems/Customization.js',
  'src/systems/Doctrines.js',
  'src/systems/Particles.js',
  'src/systems/Synergies.js',
  'src/systems/Upgrades.js',
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

test('core systems expose the expected API surface', async () => {
  const upgrades = await import(pathToFileURL(join(ROOT, 'src/systems/Upgrades.js')));
  const synergies = await import(pathToFileURL(join(ROOT, 'src/systems/Synergies.js')));
  const doctrines = await import(pathToFileURL(join(ROOT, 'src/systems/Doctrines.js')));
  const game = await import(pathToFileURL(join(ROOT, 'src/Game.js')));

  assert.equal(typeof upgrades.draftUpgrades, 'function');
  assert.equal(typeof upgrades.applyUpgrade, 'function');
  assert.equal(typeof upgrades.SaveData, 'function');
  assert.equal(typeof synergies.checkSynergies, 'function');
  assert.equal(typeof doctrines.getDoctrine, 'function');
  assert.equal(typeof game.Game, 'function');
});
