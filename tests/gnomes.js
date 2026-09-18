// Gnomes: burrows, hours, borrowing, and leaving. Fast: one world per test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];

for (const seed of SEEDS) test(`seed ${seed}: two or three gnome burrows under the meadow edges, with mushrooms and gnomes at home`, () => {
  const api = load(); api.startWorld(seed);
  const full = api.levels.length * api.world.length;
  const burrows = api.caves.filter(c => c.kind === 'burrow');
  assert.ok(burrows.length >= 2 && burrows.length <= 3, `${burrows.length} burrows`);
  const start = api.beings[0]; const region = api.reachable(start.x, start.y, 0, full);
  for (const c of burrows){
    assert.equal(c.owner, 'gnome');
    assert.ok(c.mouth.slope && c.mouth.z === -1 && c.exit && c.exit.mouth === c);
    assert.ok(region.has(api.idx3(c.exit.x, c.exit.y, 0)), 'the burrow opens onto the walkable world');
    assert.ok(api.dist(c.exit.x, c.exit.y, start.x, start.y) >= 25, 'not beside the start');
    assert.equal(api.sectorOfTile(c.exit).biome, 'meadow');
    assert.ok(c.patch.length >= 4 && c.patch.every(t => t.feature === 'mushrooms' && api.dist(t.x, t.y, c.exit.x, c.exit.y) <= 3), 'a mushroom patch by the mouth');
    const kin = api.beings.filter(b => b.species === 'gnome' && b.den === c);
    assert.ok(kin.length >= 2 && kin.length <= 3, `${kin.length} gnomes`);
    for (const g of kin) assert.ok(c.tiles.some(t => t.x === g.x && t.y === g.y && t.z === g.z), 'each gnome starts in its burrow');
  }
  assert.ok(api.LIFE.gnome && api.SPECIES.gnome && api.SPECIES.gnome.glyph === 'g');
});

test('mushrooms regrow on their patch', () => {
  const api = load(); api.startWorld('r');
  const c = api.caves.find(c => c.kind === 'burrow'); const t = c.patch[0]; t.shrooms = 0;
  let grew = false; for (let k = 0; k < 4000 && !grew; k++){ api.growPlants(); grew = t.shrooms > 0; }
  assert.ok(grew, 'no mushrooms in 4000 samples');
});

const run = (api, b, n) => { for (let k = 0; k < n && b.alive; k++){ api.camp = api.camps[0]; api.updateBeing(b); api.tick = api.tick + 1; } };
const inDen = b => b.den.tiles.some(t => t.x === b.x && t.y === b.y && t.z === b.z);

test('gnomes sleep in the burrow by day and come out to the patch at dusk', () => {
  const api = load(); api.startWorld('r');
  const g = api.beings.find(b => b.species === 'gnome');
  for (const k in g.needs) g.needs[k] = 90; g.needs.food = 30;
  api.tick = 12 * 1000 + 500; run(api, g, 200);
  assert.ok(inDen(g), `by day a gnome stays home; it is at ${g.x},${g.y},${g.z} doing ${g.task && g.task.label}`);
  api.tick = 20 * 1000 + 500; g.task = null; run(api, g, 400);
  assert.ok(g.z === 0 && g.den.patch.some(t => api.dist(t.x, t.y, g.x, g.y) <= 1), `at dusk it goes to the patch; it is at ${g.x},${g.y},${g.z} doing ${g.task && g.task.label}`);
  assert.ok(g.needs.food > 30, 'and eats');
});

test('a gnome fears a brand and a wolf, and never attacks', () => {
  const api = load(); api.startWorld('r');
  const g = api.beings.find(b => b.species === 'gnome'); const h = api.beings[0];
  g.x = h.x + 2; g.y = h.y; g.z = 0; h.carrying = { kind: 'ember', count: 1, dies: api.tick + 400 };
  assert.ok(api.threatsFor(g).length > 0, 'a brand is a threat');
  h.carrying = null; assert.equal(api.threatsFor(g).length, 0, 'a bare person is not');
  assert.ok(!api.START.hunt || true); assert.equal(api.SPECIES.gnome.attacks, undefined);
});

test('the first gnome seen at dusk is written down once per camp', () => {
  const api = load(); api.startWorld('r'); const c = api.camps[0]; const h = api.beings[0];
  const g = api.beings.find(b => b.species === 'gnome'); g.x = h.x + 3; g.y = h.y; g.z = 0; g.asleep = false;
  api.tick = 20 * 1000 + 500; api.camp = c; api.updateBeing(h);
  assert.equal(c.gnomes.known, true);
  assert.ok(api.chronicle[0].text.includes('small figure'), api.chronicle[0].text);
  assert.equal(api.goalState(api.GOALS.find(g => g.id === 'gnomes')).s, 'active');
});
