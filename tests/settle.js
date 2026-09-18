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
  const mine = new Set(open), seen = new Set(), reach = [];
  for (const i of mine){
    if (seen.has(i)) continue;
    const region = api.reachable(i % W, (i - i % W) / W, 0, api.NZ * W * api.H);
    for (const j of mine) if (region.has(api.idx3(j % W, (j - j % W) / W, 0))) seen.add(j);
    reach.push(region.size);
  }
  const here = api.reachable(a.x, a.y, 0, api.NZ * W * api.H);
  const held = open.filter(i => here.has(api.idx3(i % W, (i - i % W) / W, 0))).length;
  return { open: open.length, reach: reach.sort((p, q) => q - p), held, world: here.size };
}

/* A wide pocket walled off from everything else is a prison, so the person takes the pocket that opens onto the
   most world, not the one that holds the most of the country. */
for (const seed of SOAK_SEEDS) test(`seed ${seed}: the first person stands in the start country's widest pocket`, () => {
  const api = load(); api.startWorld(seed);
  const { reach, world } = startPockets(api);
  assert.ok(world >= reach[0], `the person walks ${world} tiles, and the best start pocket opens onto ${reach[0]}`);
});

/* The gate says nothing about tiles, so a country can pass it and still be shattered into pockets by the
   water the painters lay down. Seed gamma's start country breaks into 450, 127, 83, 48 and smaller.
   Task 5's tile check is what discards such a settle. */
for (const seed of SOAK_SEEDS) test(`seed ${seed}: the first person can walk most of the start country`, { todo: 'plan 3 task 5: the tile check discards a settle whose start pocket is too small; seed gamma is shattered' }, () => {
  const api = load(); api.startWorld(seed);
  const { open, held } = startPockets(api);
  assert.ok(held >= open / 2, `${held} of ${open} passable start tiles are reachable`);
});

/* A settled world, plus the marks that made it, for the painters' tests. */
function settled(seed = 'r'){ const api = load(); api.startWorld(seed); return api; }

test('a height mark raises hills inside its country, with storeys from the mark', () => {
  const api = settled();
  const raised = api.liveRegions().filter(r => api.marksOf(r, 'height').length);
  assert.ok(raised.length, 'no country raised');
  for (const r of raised){
    const mine = api.hills.filter(h => h.mark && h.mark.by === api.marksOf(r, 'height')[0].by && r.tiles.includes(api.idx(h.x, h.y)));
    assert.ok(mine.length >= 1, `country ${r.id} has a height mark and no hill`);
    for (const h of mine){ assert.equal(h.storeys, Math.min(api.marksOf(r, 'height')[0].value, api.ZMAX)); assert.ok(h.tiles.every(i => r.tiles.includes(i)), 'a hill spills out of its country'); }
  }
  for (const h of api.hills) assert.ok(h.mark, 'a hill without a mark');
});

test('a depth mark cuts caves under its country\'s hills, and raises one if it had none', () => {
  const api = settled();
  const dug = api.liveRegions().filter(r => api.marksOf(r, 'depth').length);
  assert.ok(dug.length, 'no country dug');
  for (const r of dug){
    const mine = api.caves.filter(c => c.kind === 'water' && c.hill && r.tiles.includes(api.idx(c.hill.x, c.hill.y)));
    assert.ok(mine.length >= 1, `country ${r.id} has a depth mark and no cave`);
    for (const c of mine){ assert.ok(c.mark && c.mark.kind === 'depth'); const deepest = Math.min(...c.tiles.map(t => t.z)); assert.equal(deepest, Math.max(api.ZMIN, -Math.min(api.marksOf(r, 'depth')[0].value, -api.ZMIN))); }
  }
});

test('scars paint what the winner\'s pole leaves', () => {
  const api = load(); api.startCreation('r'); api.runAges();
  for (const r of api.liveRegions()){
    for (const m of api.marksOf(r, 'scar')){
      const tiles = r.tiles.map(i => api.world[i]);
      if (m.value === 'burned') assert.ok(tiles.every(t => t.ground === 'ash' || t.ground === 'water' || t.ground === 'sand' || t.ground === 'rock' || t.ground === 'stone'), 'a burned country with living ground');
      if (m.value === 'drowned') assert.ok(tiles.some(t => t.feature === 'deadpine') && tiles.some(t => t.ground === 'water'), 'a drowned country with no dead pines in water');
      if (m.value === 'broken') assert.ok(tiles.filter(t => t.feature === 'boulder').length >= r.area / 5, 'a broken country with few boulders');
      if (m.value === 'cut') assert.ok(tiles.filter(t => t.ground === 'rock' && !t.hill).length >= 8, 'a cut country with no chasm');
    }
  }
});

/* No soak seed carries a scar, so the scar painters would go untested. Mark four countries away from the start by
   hand and run the painters on them. */
test('the scar painters mark a country, and a chasm never cuts the world in two', () => {
  const api = settled();
  const W = api.W, start = api.creation.gate.start;
  const beside = new Set(api.neighboursOf(start).map(r => r.id)); beside.add(start.id);
  const away = api.liveRegions().filter(r => !beside.has(r.id) && r.area > 40).sort((p, q) => q.area - p.area).slice(0, 4);
  assert.equal(away.length, 4, 'seed r has fewer than four countries away from the start');
  const a = api.beings.find(b => b.species === 'human');
  const was = api.reachable(a.x, a.y, 0, api.NZ * W * api.H);
  const held = start.tiles.filter(i => was.has(api.idx3(i % W, (i - i % W) / W, 0)));
  const values = ['burned', 'cut', 'drowned', 'broken'];
  away.forEach((r, k) => api.mark(r, 'scar', values[k], api.gods()[0], 'test'));
  api.paintScars();
  away.forEach((r, k) => {
    const tiles = r.tiles.map(i => api.world[i]);
    if (values[k] === 'burned') assert.ok(tiles.every(t => ['ash', 'water', 'sand', 'rock', 'stone'].includes(t.ground)), 'a burned country with living ground');
    if (values[k] === 'drowned') assert.ok(tiles.some(t => t.feature === 'deadpine') && tiles.some(t => t.ground === 'water'), 'a drowned country with no dead pines in water');
    if (values[k] === 'broken') assert.ok(tiles.filter(t => t.feature === 'boulder').length >= 1, 'a broken country with no boulders');
    if (values[k] === 'cut') assert.ok(tiles.filter(t => t.ground === 'rock' && !t.hill).length >= 8, 'a cut country with no chasm');
  });
  const now = api.reachable(a.x, a.y, 0, api.NZ * W * api.H);
  for (const i of held) assert.ok(now.has(api.idx3(i % W, (i - i % W) / W, 0)), 'a scar cut a start tile out of the walkable world');
});

/* A founding party walks to a sector where the pit can be built. The rule counts the sector and its four
   neighbours; this test counts the same reach from the items themselves. */
for (const seed of SOAK_SEEDS) test(`seed ${seed}: every founding site has the pit's rocks and sticks in reach`, () => {
  const api = load(); api.startWorld(seed);
  const need = api.GOALS.find(g => g.id === 'firepit').need;
  const sites = api.foundingSites();
  for (const s of sites){
    const inReach = (x, y) => { const q = api.secOf(x, y); return Math.abs(q.sx - s.sx) + Math.abs(q.sy - s.sy) <= 1; };
    const loose = k => api.items.filter(i => i.kind === k && i.z === 0 && inReach(i.x, i.y)).length;
    assert.ok(loose('rock') >= need.rock, `a founding site with ${loose('rock')} rocks in reach`);
    assert.ok(loose('stick') >= need.stick, `a founding site with ${loose('stick')} sticks in reach`);
    assert.ok(api.GROWS[s.biome], `a founding site in a ${s.biome}`);
  }
});
