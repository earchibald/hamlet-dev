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

test('gnomes start young: every gnome on seed r is between 20 and 35 days old at the start', () => {
  const api = load(); api.startWorld('r');
  const gnomes = api.beings.filter(b => b.species === 'gnome');
  assert.ok(gnomes.length > 0, 'no gnomes to check');
  for (const g of gnomes){
    const age = api.ageDays(g);
    assert.ok(age >= 20 && age <= 35, `gnome ${g.name} is ${age} days old, expected 20 to 35`);
  }
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
  assert.equal(api.SPECIES.gnome.attacks, undefined);
});

test('the first gnome seen at dusk is written down once per camp', () => {
  const api = load(); api.startWorld('r'); const c = api.camps[0]; const h = api.beings[0];
  const g = api.beings.find(b => b.species === 'gnome'); g.x = h.x + 3; g.y = h.y; g.z = 0; g.asleep = false;
  /* Hour 20 of day 20, and one tick past it so (tick + h.id) is even: Hal's stride of 2
     must land on this tick, or the single updateBeing call below never reaches chooseTask
     at all, and a bystanding "picks a spot for the camp" log would otherwise beat the sighting to chronicle[0]. */
  api.tick = 20 * 1000 + Math.round(20 / 24 * 1000) + 1; api.camp = c; api.updateBeing(h);
  assert.equal(c.gnomes.known, true);
  assert.ok(api.chronicle[0].text.includes('small figure'), api.chronicle[0].text);
  assert.equal(api.goalState(api.GOALS.find(g => g.id === 'gnomes')).s, 'active');
});

test('gnomes copy a workshop, borrow a pot at night, and bring it back with a gift two days later', () => {
  const api = load(); api.startWorld('r');
  const burrow = api.caves.find(c => c.kind === 'burrow'); const c = api.camps[0]; api.camp = c; const h = api.beings[0];
  /* Put the camp beside the burrow with a workshop and a pot. */
  api.setSite(burrow.exit.x + 3, burrow.exit.y); const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: false }; c.pit = [t.x, t.y];
  c.workshop = [t.x + 1, t.y]; api.tileAt(...c.workshop).struct = { type: 'workshop', camp: c }; c.stash.pot = 1; c.everLit = true;
  api.tick = 5 * 1000; for (let k = 0; k < 40 && !burrow.bench; k++){ api.tick = api.tick + 500; api.gnomeTick(); }
  assert.ok(burrow.bench, 'no bench after twenty days beside a workshop');
  assert.ok(api.chronicle.some(e => e.text.includes('clink')));
  const g = api.beings.find(b => b.species === 'gnome' && b.den === burrow); g.x = burrow.exit.x; g.y = burrow.exit.y; g.z = 0; g.task = null; for (const k in g.needs) g.needs[k] = 90;
  api.tick = 22 * 1000; assert.ok(api.START.borrow(g), 'the borrow should start');
  for (let k = 0; k < 300 && g.task; k++){ api.runTask(g); api.tick = api.tick + 1; }
  assert.equal(c.stash.pot, 0); assert.ok(burrow.holding && burrow.holding.kind === 'pot');
  assert.ok(api.chronicle.some(e => e.text.includes('Small footprints')));
  api.tick = api.tick + 2 * 1000 + 10; g.x = burrow.exit.x; g.y = burrow.exit.y; g.task = null;
  assert.ok(api.START.repay(g), 'the repayment should start');
  for (let k = 0; k < 300 && g.task; k++){ api.runTask(g); api.tick = api.tick + 1; }
  assert.equal(c.stash.pot, 1); assert.equal(burrow.holding, null);
  assert.ok(c.stash.cord + c.stash.clay + c.stash.pot >= 2, 'a gift beside it');
  assert.ok(api.chronicle.some(e => e.text.includes('Neighbours, then')));
});

test('two gnomes of the same burrow cannot both borrow the same night', () => {
  const api = load(); api.startWorld('r');
  const burrow = api.caves.find(c => c.kind === 'burrow'); const c = api.camps[0]; api.camp = c;
  api.setSite(burrow.exit.x + 3, burrow.exit.y); const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: false }; c.pit = [t.x, t.y];
  c.workshop = [t.x + 1, t.y]; api.tileAt(...c.workshop).struct = { type: 'workshop', camp: c }; c.stash.pot = 1; c.stash.cord = 1; c.everLit = true;
  burrow.bench = 1; burrow.lastRepaid = 0;
  const kin = api.beings.filter(b => b.species === 'gnome' && b.den === burrow);
  assert.ok(kin.length >= 2, 'need two gnomes in the burrow to test the race');
  for (const g of kin){ g.x = burrow.exit.x; g.y = burrow.exit.y; g.z = 0; g.task = null; for (const k in g.needs) g.needs[k] = 90; }
  api.tick = 22 * 1000;
  const potBefore = c.stash.pot, cordBefore = c.stash.cord, basketBefore = c.tools.basket;
  for (const g of kin) assert.ok(api.START.borrow(g), 'each borrow should be able to start');
  for (let k = 0; k < 300 && kin.some(g => g.task); k++){ for (const g of kin) if (g.task) api.runTask(g); api.tick = api.tick + 1; }
  const taken = (potBefore - c.stash.pot) + (cordBefore - c.stash.cord) + (basketBefore - c.tools.basket);
  assert.equal(taken, 1, `expected exactly one thing gone from the stash, stash pot=${c.stash.pot} cord=${c.stash.cord} basket=${c.tools.basket}`);
  assert.ok(burrow.holding, 'the burrow should record the one thing it took');
});

test('a gnome does not borrow again for six days after repaying', () => {
  const api = load(); api.startWorld('r');
  const burrow = api.caves.find(c => c.kind === 'burrow'); const c = api.camps[0]; api.camp = c;
  api.setSite(burrow.exit.x + 3, burrow.exit.y); const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: false }; c.pit = [t.x, t.y];
  c.workshop = [t.x + 1, t.y]; api.tileAt(...c.workshop).struct = { type: 'workshop', camp: c }; c.stash.pot = 1; c.everLit = true;
  burrow.bench = 1;
  const g = api.beings.find(b => b.species === 'gnome' && b.den === burrow); g.x = burrow.exit.x; g.y = burrow.exit.y; g.z = 0; g.task = null; for (const k in g.needs) g.needs[k] = 90;
  api.tick = 22 * 1000; assert.ok(api.START.borrow(g), 'the borrow should start');
  for (let k = 0; k < 300 && g.task; k++){ api.runTask(g); api.tick = api.tick + 1; }
  api.tick = api.tick + 2 * 1000 + 10; g.x = burrow.exit.x; g.y = burrow.exit.y; g.task = null;
  assert.ok(api.START.repay(g), 'the repayment should start');
  for (let k = 0; k < 300 && g.task; k++){ api.runTask(g); api.tick = api.tick + 1; }
  assert.equal(burrow.holding, null);
  g.task = null; assert.equal(api.START.borrow(g), false, 'right after repaying, no new borrow yet');
  api.tick = api.tick + 6 * 1000; g.task = null;
  assert.ok(api.START.borrow(g), 'six days later, a new borrow can start');
});
