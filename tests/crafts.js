// Crafts: each recipe through the real goal offers, on a hand-built camp. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

/* A camp that has come far enough to craft: site, lit pit, three-day hearth, the axe, and a person standing by the stash. */
function readyCamp(seed = 'r'){
  const api = load(); api.startWorld(seed);
  const a = api.beings[0]; const c = api.camps[0]; api.camp = c;
  api.setSite(a.x, a.y);
  const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: true }; c.pit = [t.x, t.y];
  c.everLit = true; c.bestStreak = 4000; c.tools.axe = 1;
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){ const q = api.tileAt(t.x + dx, t.y + dy); q.ground = 'soil'; q.feature = null; q.struct = null; q.fire = 0; }
  a.x = c.stashTile[0]; a.y = c.stashTile[1]; a.z = 0; a.task = null; a.asleep = false; a.homeless = false; a.cooldown = {};
  for (const k in a.needs) a.needs[k] = 90;
  return { api, a, c };
}
/* Take one offer by label and run the person until the task ends or 600 ticks pass. */
function doOffer(api, a, label){
  const o = api.offersFor(a).find(o => o.label === label);
  assert.ok(o, `no offer "${label}"; offers: ${api.offersFor(a).map(o => o.label).join(', ')}`);
  assert.ok(o.start(a), `offer "${label}" would not start`);
  a.task.started = api.tick; a.task.key = label;
  for (let k = 0; k < 600 && a.task; k++){ api.runTask(a); api.tick = api.tick + 1; }
  assert.equal(a.task, null, `"${label}" did not finish in 600 ticks`);
}
const goal = (api, id) => api.GOALS.find(g => g.id === id);

test('the recipe goals sit on the panel before the wolf guard, in ladder order', () => {
  const { api } = readyCamp();
  const ids = api.GOALS.map(g => g.id);
  assert.ok(ids.indexOf('fibre') < ids.indexOf('cord'));
  assert.ok(ids.indexOf('cord') < ids.indexOf('guard'));
  assert.equal(api.goalState(goal(api, 'fibre')).s, 'active');
  assert.equal(api.goalState(goal(api, 'cord')).s, 'blocked', 'cord needs fibre first');
});

test('fibre is picked from the reeds and cord is twisted at the stash', () => {
  const { api, a, c } = readyCamp();
  /* Reeds two tiles from the stash. */
  const r = api.tileAt(c.stashTile[0] + 2, c.stashTile[1]); r.ground = 'grass'; r.feature = 'reeds'; r.struct = null;
  doOffer(api, a, 'gather fibre from the reeds');
  assert.ok(c.stash.fibre >= 3, `fibre ${c.stash.fibre}`);
  assert.equal(r.feature, 'reeds', 'reeds stay');
  c.stash.fibre = 4;
  assert.equal(api.goalState(goal(api, 'cord')).s, 'active');
  doOffer(api, a, 'twist cord');
  assert.equal(c.stash.cord, 2); assert.equal(c.stash.fibre, 0);
  assert.ok(api.chronicle[0].text.includes('twists'), api.chronicle[0].text);
});

test('the workshop is built by the pit, then a basket and a rod are made there', () => {
  const { api, a, c } = readyCamp();
  c.stash.log = 6; c.stash.stick = 10; c.stash.rock = 4; c.stash.cord = 5; c.stash.fibre = 6;
  assert.equal(api.goalState(goal(api, 'workshop')).s, 'active');
  assert.equal(api.goalState(goal(api, 'basket')).s, 'blocked', 'no workshop yet');
  doOffer(api, a, 'build the workshop');
  assert.ok(c.workshop, 'no workshop site'); assert.equal(api.tileAt(...c.workshop).struct.type, 'workshop');
  assert.equal(c.stash.log, 0); assert.equal(c.stash.stick, 0); assert.equal(c.stash.rock, 0);
  assert.equal(api.goalState(goal(api, 'workshop')).s, 'done');
  assert.equal(api.goalState(goal(api, 'basket')).s, 'active');
  doOffer(api, a, 'weave a basket');
  assert.equal(c.tools.basket, 1); assert.equal(c.stash.cord, 2);
  c.stash.stick = 1;
  doOffer(api, a, 'make a fishing rod');
  assert.equal(c.tools.rod, 1); assert.equal(c.stash.cord, 0); assert.equal(c.stash.stick, 0);
  assert.equal(api.chronicle[0].kind, 'major');
});

test('a basket lets a gatherer carry three more', () => {
  const { api, a, c } = readyCamp();
  for (let k = 0; k < 12; k++) api.addItem('stick', c.stashTile[0] + 3 + (k % 4), c.stashTile[1] + 2 + Math.floor(k / 4));
  for (const t of api.world) if (t.struct === null && Math.abs(t.x - c.stashTile[0]) <= 8 && Math.abs(t.y - c.stashTile[1]) <= 8){ t.feature = null; if (t.ground === 'water') t.ground = 'grass'; }
  a.skills.gather = 0; c.stash.stick = 0;
  api.startGather(a, 'stick'); for (let k = 0; k < 400 && a.task; k++){ api.runTask(a); api.tick = api.tick + 1; }
  assert.equal(c.stash.stick, 3, 'three sticks a trip without a basket');
  c.tools.basket = 1; c.stash.stick = 0;
  api.startGather(a, 'stick'); for (let k = 0; k < 600 && a.task; k++){ api.runTask(a); api.tick = api.tick + 1; }
  assert.equal(c.stash.stick, 6, 'six a trip with a basket');
});

test('startBuild speeds work by the passed skill, not just the label', () => {
  const runs = craft => {
    const { api, a, c } = readyCamp();
    a.skills.craft = craft;
    assert.ok(api.startBuild(a, c.stashTile, 30, 'twist cord', () => {}, 'craft'));
    let n = 0; for (; n < 200 && a.task; n++) api.runTask(a);
    return n;
  };
  assert.ok(runs(4) < runs(0), 'craft 4 should finish in fewer runTask calls than craft 0');
});

test('with a rod the camp fishes when food is short, and fish cook to two meals', () => {
  const { api, a, c } = readyCamp();
  c.tools.rod = 1;
  const w = api.tileAt(c.stashTile[0] + 3, c.stashTile[1]); w.ground = 'water'; w.feature = null; w.struct = null;
  c.stash.berries = 0; c.stash.cooked = 0; c.stash.smoked = 0;
  assert.equal(api.goalState(goal(api, 'fish')).s, 'active');
  let caught = 0;
  for (let tries = 0; tries < 12 && !c.stash.fish; tries++){ doOffer(api, a, 'fish the river'); }
  assert.ok(c.stash.fish >= 1, 'no fish in twelve casts');
  assert.ok(api.chronicle.some(e => e.text.includes('lands a fish')));
  c.stash.berries = 30;
  assert.equal(api.goalState(goal(api, 'fish')).s, 'idle', 'plenty of food, no need to fish');
  c.stash.fish = 1; c.stash.cooked = 0;
  doOffer(api, a, 'cook the fish');
  assert.equal(c.stash.fish, 0); assert.equal(c.stash.cooked, 2);
  c.stash.fish = 1; c.rack = c.stashTile; api.tileAt(...c.rack).struct = { type: 'rack', camp: c };
  c.stash.smoked = 0; c.stash.carcass = 0;
  doOffer(api, a, 'smoke a fish over the fire');
  assert.equal(c.stash.smoked, 2);
});

test('hide clothes go to the coldest person and keep them warmer', () => {
  const { api, a, c } = readyCamp();
  c.workshop = [c.pit[0] + 2, c.pit[1]]; api.tileAt(...c.workshop).struct = { type: 'workshop', camp: c };
  c.stash.hide = 3; c.stash.cord = 1; a.needs.warmth = 40;
  assert.equal(api.goalState(goal(api, 'clothes')).s, 'active');
  c.stash.hide = 0;
  assert.equal(api.goalState(goal(api, 'clothes')).s, 'active', 'short of hides it stays active, not blocked on itself');
  c.stash.hide = 3;
  doOffer(api, a, 'sew hide clothes');
  assert.equal(a.clothes, true); assert.equal(c.stash.hide, 0);
  assert.equal(api.goalState(goal(api, 'clothes')).s, 'idle', 'everyone is clothed');
  api.tick = 60 * 1000 + 100; /* a winter night */
  const bare = api.beings.find(b => b.species === 'human' && b !== a) || api.makeBeing('human', a.x, a.y, 'Test', 0);
  if (!api.beings.includes(bare)) api.beings.push(bare);
  bare.camp = c; bare.clothes = false; bare.needs.warmth = 60; a.needs.warmth = 60; bare.x = a.x; bare.y = a.y; bare.z = 0; bare.traits.hardiness = a.traits.hardiness; bare.homeless = false; bare.asleep = false; a.asleep = false; bare.born = a.born;
  api.updateBeing(a); api.updateBeing(bare);
  assert.ok(60 - a.needs.warmth < 60 - bare.needs.warmth, `clothed loss ${60 - a.needs.warmth} should be less than bare ${60 - bare.needs.warmth}`);
});

test('clay is dug from the riverbank, the kiln is raised, and pots are fired in it', () => {
  const { api, a, c } = readyCamp();
  c.workshop = [c.pit[0] + 2, c.pit[1]]; api.tileAt(...c.workshop).struct = { type: 'workshop', camp: c };
  const s = api.tileAt(c.stashTile[0] + 3, c.stashTile[1]); s.ground = 'sand'; s.feature = null; s.struct = null;
  assert.equal(api.goalState(goal(api, 'clay')).s, 'active');
  doOffer(api, a, 'dig clay');
  assert.ok(c.stash.clay >= 2, `clay ${c.stash.clay}`);
  c.stash.clay = 4; c.stash.rock = 8;
  assert.equal(api.goalState(goal(api, 'kiln')).s, 'active');
  doOffer(api, a, 'build the kiln');
  assert.ok(c.kiln); assert.equal(api.tileAt(...c.kiln).struct.type, 'kiln'); assert.equal(c.stash.clay, 0); assert.equal(c.stash.rock, 0);
  c.stash.clay = 3; c.stash.stick = 2; c.stash.pot = 0;
  doOffer(api, a, 'fire pots');
  assert.equal(c.stash.pot, 1); assert.equal(c.stash.stick, 0); assert.equal(api.tileAt(...c.kiln).struct.fired, 1);
  /* Aim is three pots: one is not done. Clay is now empty and clay is another recipe's output,
     so by the design rule (design/notes.md:105) the goal is blocked, not active, until clay is dug again. */
  assert.equal(api.goalState(goal(api, 'pot')).s, 'blocked', 'aim is three pots');
});

test('cuttings from wild bushes make a garden of four near the fire', () => {
  const { api, a, c } = readyCamp();
  const wild = api.tileAt(c.stashTile[0] + 3, c.stashTile[1] + 1); wild.ground = 'grass'; wild.feature = 'bush'; wild.berries = 3; wild.struct = null;
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++){ const t = api.tileAt(c.pit[0] + dx, c.pit[1] + dy); if (t !== wild && !t.struct && t.ground !== 'water'){ t.feature = null; t.ground = Math.abs(dx) + Math.abs(dy) > 2 ? 'soil' : t.ground; } }
  assert.equal(api.goalState(goal(api, 'garden')).s, 'active');
  doOffer(api, a, 'take cuttings');
  assert.ok(c.stash.cuttings >= 2, `cuttings ${c.stash.cuttings}`);
  c.stash.cuttings = 4;
  doOffer(api, a, 'plant a garden');
  assert.ok(c.garden, 'no garden'); assert.equal(c.stash.cuttings, 0);
  const planted = api.world.filter(t => t.feature === 'bush' && t.garden === c);
  assert.equal(planted.length, 4);
  for (const t of planted) assert.ok(api.dist(t.x, t.y, ...c.pit) <= 8);
  assert.equal(api.goalState(goal(api, 'garden')).s, 'done');
  assert.ok(api.chronicle.some(e => e.text.includes('plants a garden')));
});

test('a deer pit catches a deer that steps in, and the camp hauls it home', () => {
  const { api, a, c } = readyCamp();
  c.stash.log = 4; c.stash.cord = 2;
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++){ const t = api.tileAt(c.site[0] + dx, c.site[1] + dy); if (!t.struct && t.ground !== 'water'){ t.feature = null; if (Math.abs(dx) + Math.abs(dy) > 3) t.ground = 'grass'; } }
  const bush = api.tileAt(c.site[0] + 11, c.site[1]); bush.feature = 'bush'; bush.berries = 0;
  const d = api.beings.find(b => b.species === 'deer'); d.alive = true;
  /* Deer traffic, not a deer standing about, sites the pit: walk deer feet over the intended tile and its ring. */
  const spot = api.tileAt(c.site[0] + 12, c.site[1]);
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]]) api.tileAt(spot.x + dx, spot.y + dy).deer = 6;
  assert.equal(api.goalState(goal(api, 'pitfall')).s, 'active');
  doOffer(api, a, 'dig a deer pit');
  assert.equal(c.pitfalls.length, 1); const p = c.pitfalls[0]; assert.equal(api.tileAt(p.x, p.y).struct.type, 'pitfall');
  d.x = p.x; d.y = p.y; d.z = 0; d.alive = true;
  let caught = false; for (let k = 0; k < 80 && !caught; k++){ api.checkPitfall(d); caught = !!p.catch; }
  assert.ok(caught, 'no catch in eighty steps at one in eight');
  assert.equal(d.alive, false);
  assert.ok(api.chronicle.some(e => e.text.includes('falls into the pit')));
  doOffer(api, a, 'haul the deer from the pit');
  assert.equal(p.catch, null); assert.equal(c.stash.venison, 1);
});

test('a pot holds water at camp and keeps berries longer', () => {
  const { api, a, c } = readyCamp();
  c.tools.waterskin = 1; c.stash.water = 8;
  assert.equal(api.goalState(goal(api, 'water')).s, 'idle' , 'eight drinks meet the aim of six without a pot');
  c.stash.pot = 1;
  assert.equal(api.goalState(goal(api, 'water')).s, 'active', 'with a pot the aim is twelve');
  api.camp = c; c.rot.berries = []; c.stash.berries = 0;
  api.stashAdd('berries', 1); const withPot = c.rot.berries[0] - api.tick;
  c.stash.pot = 0; c.rot.berries = []; c.stash.berries = 0;
  api.stashAdd('berries', 1); const without = c.rot.berries[0] - api.tick;
  assert.equal(withPot, without * 2);
});

test('with the axe, rocks are quarried from a rock face within thirty tiles', () => {
  const { api, a, c } = readyCamp();
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++){ const t = api.tileAt(c.site[0] + 6 + dx, c.site[1] + dy); if (!t.struct){ t.feature = null; t.ground = 'grass'; } }
  const face = api.tileAt(c.site[0] + 6, c.site[1]); face.ground = 'rock'; face.hill = { x: face.x, y: face.y, r: 1, storeys: 1, tiles: [api.idx(face.x, face.y)] };
  c.stash.rock = 0;
  assert.equal(api.goalState(goal(api, 'quarry')).s, 'active');
  doOffer(api, a, 'quarry rocks');
  assert.equal(c.stash.rock, 2);
  assert.ok(api.chronicle.some(e => e.text.includes('quarries')));
  c.stash.rock = 6;
  assert.equal(api.goalState(goal(api, 'quarry')).s, 'idle');
  /* A face on a hill that hides a hollow costs favour, once. */
  c.fae.known = true; c.fae.favor = 0; c.stash.rock = 0;
  const cave = api.makeCave('hollow', face.hill); cave.owner = 'sprite';
  doOffer(api, a, 'quarry rocks');
  assert.equal(c.fae.favor, -10);
  doOffer(api, a, 'quarry rocks');
  assert.equal(c.fae.favor, -10, 'the same face is not paid for twice');
});

test('a dead pit with no ignition source sends a brave adult for firestones before firewood', () => {
  const { api, a, c } = readyCamp();
  a.traits.bravery = 0.8;
  c.stash.log = 0; c.stash.rock = 0;
  /* A tree nearby so "cut a tree for logs" is on offer too, not just "haul". */
  const tree = api.tileAt(c.site[0] + 4, c.site[1]); tree.ground = 'grass'; tree.feature = 'tree'; tree.struct = null;
  const t = api.tileAt(...c.pit); t.struct.lit = false;
  const byGoal = id => id === 'firewood' || id === 'firestones';
  const topOf = id => api.offersFor(a).filter(o => o.goal.id === id).reduce((b, o) => !b || o.score > b.score ? o : b, null);

  assert.equal(api.goalState(goal(api, 'firestones')).text.includes('cold'), true, 'the card says the camp puts fire first');
  let stones = topOf('firestones'), wood = topOf('firewood');
  assert.ok(stones, 'no firestones offer with a cold pit'); assert.ok(wood, 'no firewood offer to compare against');
  assert.ok(stones.score > wood.score, `cold pit: firestones (${stones.score}) should outscore firewood (${wood.score})`);

  t.struct.lit = true;
  stones = topOf('firestones'); wood = topOf('firewood');
  assert.ok(stones && wood, 'both offers should still be on the table with the pit lit');
  assert.ok(wood.score > stones.score, `lit pit: firewood (${wood.score}) should outrank firestones (${stones.score}), as before`);
});
