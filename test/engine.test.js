import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAU,
  angleDiff,
  clamp,
  damp,
  formatTime,
  lineCircle,
  midiToFreq,
  normalize,
  normalizeAngle
} from '../src/engine/MathUtils.js';
import { Quadtree } from '../src/engine/Quadtree.js';
import { CAM_TILT, projectAngle, screenDirToWorld } from '../src/engine/Projection.js';

test('math helpers behave on edges and wrapping angles', () => {
  assert.equal(clamp(-1, 0, 1), 0);
  assert.equal(clamp(9, 0, 1), 1);
  assert.equal(damp(0, 10, 10, 1), 10 - 10 * Math.exp(-10));
  assert.equal(normalizeAngle(Math.PI * 3), Math.PI);
  assert.equal(normalizeAngle(-Math.PI * 3), -Math.PI);
  assert.ok(Math.abs(angleDiff(0.1, 0.4) - 0.3) < 1e-9);
  assert.ok(Math.abs(normalize(3, 4).x - 0.6) < 1e-9);
  assert.deepEqual(normalize(0, 0), { x: 0, y: 0 });
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(65.9), '01:05');
  assert.equal(midiToFreq(69), 440);
  assert.ok(Math.abs(midiToFreq(81) - 880) < 1e-9);
  assert.ok(Math.abs(TAU - Math.PI * 2) < 1e-12);
});

test('line-circle intersection returns the first entry point', () => {
  const t = lineCircle(-10, 0, 10, 0, 0, 0, 5);
  assert.ok(Math.abs(t - 0.25) < 1e-9);
  assert.equal(lineCircle(-10, 10, 10, 10, 0, 0, 5), -1);
  assert.equal(lineCircle(0, 0, 0, 0, 0, 0, 5), 0);
  assert.equal(lineCircle(20, 20, 20, 20, 0, 0, 5), -1);
});

test('screen-to-world aim respects camera tilt', () => {
  const angle = projectAngle(Math.PI / 4);
  assert.ok(Math.abs(angle - Math.atan(CAM_TILT)) < 1e-9);
  assert.ok(Math.abs(projectAngle(Math.PI / 2) - Math.PI / 2) < 1e-9);
  assert.equal(screenDirToWorld(0, 0).x, 0);
  const dir = screenDirToWorld(1, 1);
  assert.ok(Math.abs(Math.hypot(dir.x, dir.y) - 1) < 1e-9);
  assert.ok(dir.y > dir.x, 'vertical screen input should stretch into world space');
});

test('quadtree indexes points and answers broad-phase queries', () => {
  const tree = new Quadtree(0, 0, 1000, 1000, 2, 0, 4);
  Quadtree.resetStats();
  const near = [
    { x: 100, y: 100, r: 10 },
    { x: 120, y: 100, r: 10 },
    { x: 110, y: 130, r: 10 }
  ];
  const far = { x: 800, y: 800, r: 10 };
  for (const point of [...near, far]) assert.equal(tree.insert(point), true);
  assert.equal(tree.insert({ x: -1, y: 50, r: 4 }), false, 'outside points are rejected');

  assert.equal(tree.countObjects(), 4);
  assert.ok(tree.countNodes() > 1, 'tree should subdivide past capacity');

  const out = [];
  const hits = tree.query(110, 110, 20, out);
  assert.ok(Quadtree.queryCount > 0);
  assert.equal(hits, out);
  assert.equal(hits.length, near.length);
  for (const point of near) assert.ok(hits.includes(point));
  assert.ok(!hits.includes(far));

  const empty = tree.query(500, 500, 10, []);
  assert.equal(empty.length, 0);
  tree.clear();
  assert.equal(tree.countObjects(), 0);
});

test('quadtree rebuild after clear is stable', () => {
  const tree = new Quadtree(0, 0, 200, 200, 4);
  const points = Array.from({ length: 40 }, (_, i) => ({
    x: (i * 37) % 200,
    y: (i * 71) % 200,
    r: 5
  }));
  for (const point of points) tree.insert(point);
  assert.equal(tree.countObjects(), points.length);
  tree.clear();
  for (const point of points) tree.insert(point);
  assert.equal(tree.countObjects(), points.length);
});
