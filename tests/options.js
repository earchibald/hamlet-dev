// Start options: world size and the level range. Fast: one world per test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('the defaults are today\'s numbers', () => {
  const api = load(); api.startWorld('r');
  assert.deepEqual(api.options, { sw: 10, sh: 6, zmin: -2, zmax: 2 });
  assert.equal(api.W, 280); assert.equal(api.H, 120); assert.equal(api.levels.length, 5); assert.equal(api.ZOFF, 2);
});

test('a wider level range makes more levels, and the surface is still level 0', () => {
  const api = load(); api.startWorld('r', { zmin: -3, zmax: 3 });
  assert.equal(api.levels.length, 7); assert.equal(api.ZOFF, 3); assert.equal(api.NZ, 7);
  assert.equal(api.levels[api.ZOFF], api.world);
  assert.equal(api.tileAt(10, 10).z, 0);
  assert.equal(api.hasTile(10, 10, 3), false);
  assert.equal(api.hasTile(10, 10, -3), false);
});

test('a bigger world generates, and the first person can reach water', () => {
  const api = load(); api.startWorld('r', { sw: 12, sh: 8 });
  assert.equal(api.W, 336); assert.equal(api.H, 160); assert.equal(api.sectors.length, 96);
  const a = api.beings[0]; assert.equal(a.species, 'human');
  const wet = (x, y, z) => z === 0 && api.passable(x, y, 0) && [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => api.hasTile(x + dx, y + dy, 0) && api.tileAt(x + dx, y + dy).ground === 'water');
  assert.ok(api.bfs(a.x, a.y, 0, wet, api.NZ * api.W * api.H), 'no path from the first person to water');
  for (let i = 0; i < 1000; i++) api.step();
  assert.ok(a.alive, 'the first person died on day one');
});

test('an unlawful range or size is refused with a sentence', () => {
  const api = load();
  assert.throws(() => api.startWorld('r', { zmin: -1 }), /level range/);
  assert.throws(() => api.startWorld('r', { sw: 0 }), /at least one sector/);
});

test('one engine can start a big world and then a small one', () => {
  const api = load(); api.startWorld('r', { sw: 12, sh: 8 });
  assert.equal(api.W, 336);
  api.startWorld('r');
  assert.equal(api.W, 280); assert.equal(api.world.length, 280 * 120);
  const a = api.beings[0];
  const region = api.reachable(a.x, a.y, 0, api.NZ * api.W * api.H);
  assert.ok(region.size > 1000, 'the search buffers were not re-sized for the smaller world');
});
