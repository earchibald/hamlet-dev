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

/* The first person stands in the widest part of the start country, not in a pocket cut off from it. */
const SOAK_SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];
/* Every pocket of the start country, largest first, and the one the first person stands in. */
function startPockets(api){
  const W = api.W, s = api.creation.gate.start;
  const a = api.beings.find(b => b.species === 'human');
  const open = s.tiles.filter(i => api.passable(i % W, (i - i % W) / W));
  const mine = new Set(open), seen = new Set(), sizes = [];
  for (const i of mine){
    if (seen.has(i)) continue;
    const region = api.reachable(i % W, (i - i % W) / W, 0, api.NZ * W * api.H);
    let n = 0; for (const j of mine) if (region.has(api.idx3(j % W, (j - j % W) / W, 0))){ seen.add(j); n++; }
    sizes.push(n);
  }
  const here = api.reachable(a.x, a.y, 0, api.NZ * W * api.H);
  const held = open.filter(i => here.has(api.idx3(i % W, (i - i % W) / W, 0))).length;
  return { open: open.length, sizes: sizes.sort((p, q) => q - p), held };
}

for (const seed of SOAK_SEEDS) test(`seed ${seed}: the first person stands in the start country's largest pocket`, () => {
  const api = load(); api.startWorld(seed);
  const { sizes, held } = startPockets(api);
  assert.equal(held, sizes[0], `the person holds ${held} start tiles, and the largest pocket has ${sizes[0]}`);
});

/* The gate says nothing about tiles, so a country can pass it and still be shattered into pockets by the
   water the painters lay down. Seed gamma's start country breaks into 450, 127, 83, 48 and smaller.
   Task 5's tile check is what discards such a settle. */
for (const seed of SOAK_SEEDS) test(`seed ${seed}: the first person can walk most of the start country`, { todo: 'plan 3 task 5: the tile check discards a settle whose start pocket is too small; seed gamma is shattered' }, () => {
  const api = load(); api.startWorld(seed);
  const { open, held } = startPockets(api);
  assert.ok(held >= open / 2, `${held} of ${open} passable start tiles are reachable`);
});
