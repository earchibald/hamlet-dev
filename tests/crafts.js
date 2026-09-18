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
