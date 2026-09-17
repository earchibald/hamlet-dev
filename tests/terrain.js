// Terrain: levels, slopes, species limits, and hills. Fast: one world per test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('the surface is level 0 and the levels below are empty', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.levels.length, 5);
  assert.equal(api.levels[api.ZOFF], api.world);
  for (const z of [-2, -1]) assert.ok(api.levels[z + api.ZOFF].every(t => t === null), `level ${z} should hold nothing yet`);
  const t = api.tileAt(10, 10);
  assert.equal(t.z, 0);
  assert.equal(api.tileAt(10, 10, 1), null);
  assert.equal(api.hasTile(10, 10, -1), false);
  assert.equal(api.idx3(10, 10, 0), 2 * api.world.length + 10 * 280 + 10);
});

test('a level apart counts as six tiles', () => {
  const api = load();
  assert.equal(api.near({ x: 0, y: 0, z: 0 }, { x: 2, y: 1, z: 1 }), 9);
  assert.equal(api.nearAt({ x: 5, y: 5, z: 2 }, 5, 5), 12);
  assert.equal(api.nearAt({ x: 5, y: 5, z: 0 }, 6, 5), 1);
});

test('rock does not walk, stone does', () => {
  const api = load(); api.startWorld('r');
  const t = api.placeTile(20, 20, 1, 'stone');
  assert.equal(t.z, 1);
  assert.equal(api.passable(20, 20, 1), true);
  t.ground = 'rock';
  assert.equal(api.passable(20, 20, 1), false);
  assert.equal(api.raised.includes(t), true);
});
