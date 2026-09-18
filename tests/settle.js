// Settle: from marks to tiles. Each painter on a hand-marked field, then a whole world.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('every world begins with its creation, and the first person stands in the start country', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.era, 'days');
  assert.ok(api.creation.settled && api.creation.gate.ok);
  assert.ok(api.legends.length > 5);
  assert.ok(api.chronicle.some(e => /walks alone into the/.test(e.text)), 'no first day-era line');
  const a = api.beings.find(b => b.species === 'human');
  assert.ok(a, 'no first person');
  assert.equal(api.regionAt(a.x, a.y).id, api.creation.gate.start.id);
  assert.ok(api.passable(a.x, a.y, 0));
  for (const g of api.gods()) assert.ok(g.status === 'asleep' || g.status === 'dead');
});

test('sectors take the biome of the country that covers most of them', () => {
  const api = load(); api.startWorld('r');
  for (const s of api.sectors){
    assert.ok(['meadow', 'forest', 'rocky', 'wetland', 'river', 'ash'].includes(s.biome), s.biome);
    assert.ok(api.regionById(s.country), 'a sector without a country');
    assert.equal(s.name, api.BIOMES[s.biome].name);
  }
});

test('the river runs along the wet god\'s live boundaries, with fords', () => {
  const api = load(); api.startWorld('r');
  const wet = api.liveBoundaries().filter(b => b.pole === 'wet');
  if (!wet.length) return;
  let water = 0, ford = 0;
  for (const b of wet) for (const i of b.tiles){ const t = api.world[i]; if (t.ground === 'water') water++; else if (t.ground === 'sand') ford++; }
  assert.ok(water > 0, 'no water on a wet boundary');
  assert.ok(ford > 0 || wet.every(b => b.tiles.length < 47), 'a long river with no ford');
});

test('a pool mark paints a lake', () => {
  const api = load(); api.startCreation('r'); api.runAges();
  const pooled = api.liveRegions().find(r => api.hasMark(r, 'pool', 'surface'));
  if (!pooled) return;
  const n = pooled.tiles.filter(i => api.world[i].ground === 'water').length;
  assert.ok(n >= pooled.area / 12, `a pooled country with ${n} water tiles`);
});

test('the same seed paints the same valley twice', () => {
  const a = load(); a.startWorld('x'); const b = load(); b.startWorld('x');
  assert.deepEqual(a.world.map(t => t.ground + (t.feature || '')).join(''), b.world.map(t => t.ground + (t.feature || '')).join(''));
});
