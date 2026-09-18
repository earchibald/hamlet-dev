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
