// Dwellers: wolves and foxes at home in their dens. Fast: hand-built situations on a real world.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

function denned(species){
  const api = load(); api.startWorld('r');
  const b = api.beings.find(b => b.species === species && b.den);
  assert.ok(b, `no ${species} with a den on seed r`);
  return { api, b, den: b.den };
}
const run = (api, b, n) => { for (let k = 0; k < n && b.alive; k++){ api.camp = api.camps[0]; api.updateBeing(b); api.tick = api.tick + 1; } };
const inDen = (b) => b.den.tiles.some(t => t.x === b.x && t.y === b.y && t.z === b.z);

test('a wolf rests in its den by day', () => {
  const { api, b, den } = denned('wolf');
  const out = den.exit; b.x = out.x; b.y = out.y; b.z = 0; b.task = null; b.asleep = false;
  for (const k in b.needs) b.needs[k] = 90; b.needs.rest = 30;
  api.tick = 10 * 1000 + 500; /* midday */
  run(api, b, 300);
  assert.ok(inDen(b), `the wolf should be home; it is at ${b.x},${b.y},${b.z} doing ${b.task && b.task.label}`);
  assert.ok(b.needs.rest > 30, 'and rested');
});

test('a wolf carries a kill home to its den before eating', () => {
  const { api, b, den } = denned('wolf');
  const out = den.exit; b.x = out.x; b.y = out.y; b.z = 0; b.task = null; b.asleep = false;
  for (const k in b.needs) b.needs[k] = 90; b.needs.food = 20;
  api.tick = 22 * 1000 + 100; /* night */
  const r = api.beings.find(o => o.species === 'rabbit' && o.alive); r.x = out.x + 2; r.y = out.y; r.z = 0; r.task = null;
  for (const t of [[out.x + 1, out.y], [out.x + 2, out.y]]){ const q = api.tileAt(...t); q.feature = null; q.struct = null; if (q.ground === 'water') q.ground = 'grass'; }
  let carried = false;
  for (let k = 0; k < 400 && !(carried && !b.carrying); k++){ api.camp = api.camps[0]; api.updateBeing(b); if (b.carrying && b.carrying.kind === 'carcass') carried = true; api.tick = api.tick + 1; }
  assert.ok(carried, 'the wolf never picked up the kill');
  assert.equal(b.carrying, null, 'the kill was eaten at home');
  assert.ok(inDen(b), 'eaten in the den');
  assert.equal(b.needs.food, 100);
  assert.ok(api.chronicle.some(e => e.text.includes('drags')));
});

test('a wolf eats a kill where it fell when the den floor is unreachable', () => {
  const { api, b, den } = denned('wolf');
  const out = den.exit; b.x = out.x; b.y = out.y; b.z = 0; b.task = null; b.asleep = false;
  b.den = Object.assign({}, den, { tiles: [] }); /* no floor tile to carry the kill to */
  for (const k in b.needs) b.needs[k] = 90; b.needs.food = 20;
  api.tick = 22 * 1000 + 100; /* night */
  const r = api.beings.find(o => o.species === 'rabbit' && o.alive); r.x = out.x + 2; r.y = out.y; r.z = 0; r.task = null;
  for (const t of [[out.x + 1, out.y], [out.x + 2, out.y]]){ const q = api.tileAt(...t); q.feature = null; q.struct = null; if (q.ground === 'water') q.ground = 'grass'; }
  let killed = false;
  for (let k = 0; k < 400 && !killed && b.alive; k++){ api.camp = api.camps[0]; api.updateBeing(b); killed = !r.alive; api.tick = api.tick + 1; }
  assert.ok(killed, 'the wolf never made the kill');
  assert.equal(b.carrying, null, 'nothing left carried when the den could not be reached');
  assert.equal(b.needs.food, 100, 'the wolf ate the kill where it fell');
  assert.ok(api.items.some(i => i.kind === 'carcass' && i.x === r.x && i.y === r.y), 'the carcass stays on the ground when it cannot be carried home');
});

test('a denned wolf whose den floor is unreachable still gets a rest task, not a stuck home task', () => {
  const { api, b, den } = denned('wolf');
  b.den = Object.assign({}, den, { tiles: [] }); /* no floor tile to go home to */
  b.task = null; b.asleep = false;
  const ok = api.START.home(b);
  assert.ok(ok, 'START.home should fall back to resting rather than fail');
  assert.equal(b.task.type, 'rest', `expected a rest task, got ${b.task && b.task.type}`);
});

test('an edge-arrived fox joins the fox den with room for a pair', () => {
  const { api, den } = denned('fox');
  const before = api.beings.filter(b => b.alive && b.species === 'fox' && b.den === den).length;
  assert.ok(before < 2, 'the fox den should start short of a pair');
  const t = den.exit; const f = api.makeBeing('fox', t.x, t.y, null, 0);
  api.beings.push(f);
  api.adoptDen(f);
  assert.equal(f.den, den, 'the arriving fox should join the den with room for it');
});

test('an edge-arrived fox does not join a den already home to a pair', () => {
  const { api, den } = denned('wolf'); /* the wolf den on seed r starts with two grown owners */
  const t = den.exit; const w = api.makeBeing('wolf', t.x, t.y, null, 0);
  api.beings.push(w);
  api.adoptDen(w);
  assert.notEqual(w.den, den, 'a full den should not take a third owner');
});

test('a den with two adults bears one young in spring, once a year', () => {
  const { api, den } = denned('wolf');
  const adults = api.beings.filter(b => b.alive && b.species === 'wolf' && b.den === den);
  assert.equal(adults.length, 2);
  api.tick = 1000; /* spring, and before either den wolf on seed r ages into 'old' */
  for (const w of adults){ const t = den.tiles[0]; w.x = t.x; w.y = t.y; w.z = t.z; }
  const before = api.beings.filter(b => b.species === 'wolf').length;
  api.denTick(); api.tick = api.tick + 500; api.denTick();
  const after = api.beings.filter(b => b.species === 'wolf').length;
  assert.equal(after, before + 1, 'one pup, not two');
  const pup = api.beings[api.beings.length - 1];
  assert.equal(pup.den, den); assert.equal(pup.born, api.tick - 500); assert.ok(inDen(pup));
  assert.ok(api.chronicle.some(e => e.text.includes('pup') || e.text.includes('kit')));
});

test('a person who walks into a wolf den is attacked, brand or no brand, by day', () => {
  const { api, b, den } = denned('wolf');
  const t = den.tiles.find(t => api.passable(t.x, t.y, t.z)); b.x = t.x; b.y = t.y; b.z = t.z; b.task = null; b.asleep = false;
  for (const k in b.needs) b.needs[k] = 90;
  api.tick = 10 * 1000 + 500;
  const h = api.beings[0]; h.x = t.x; h.y = t.y; h.z = t.z; h.carrying = { kind: 'ember', count: 1, dies: api.tick + 400 }; h.hp = 100; h.thoughts = [];
  api.camp = api.camps[0]; api.updateBeing(b);
  assert.ok(h.hp < 100, 'the wolf should have bitten');
  assert.ok(h.thoughts.some(t => t.key === 'denbite'));
  assert.ok(api.chronicle.some(e => e.text.includes('in its den')));
});

test('a cross sprite steals a pot, and a pleased one leaves cord on the stone', () => {
  const api = load(); api.startWorld('r');
  const c = api.camps[0]; api.camp = c; const a = api.beings[0];
  api.setSite(a.x, a.y); const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: true }; c.pit = [t.x, t.y]; c.everLit = true;
  c.fae.known = true; c.fae.favor = -30; c.stash.pot = 1; c.stash.berries = 5; c.fae.lastPrank = 0;
  const sp = api.beings.find(b => b.species === 'sprite');
  sp.x = c.stashTile[0]; sp.y = c.stashTile[1]; sp.z = 0; sp.task = null;
  api.tick = 22 * 1000;
  let stolen = false;
  for (let k = 0; k < 40 && !stolen; k++){ c.stash.pot = 1; c.fae.lastPrank = 0; api.START.prank(sp); sp.task.arrive(sp, sp.task); stolen = c.stash.pot === 0; }
  assert.ok(stolen, 'the pot was never taken in forty pranks');
  assert.ok(api.chronicle.some(e => e.text.includes('pot is gone')));
  c.fae.favor = 50; c.stone = [c.pit[0] + 3, c.pit[1]]; api.tileAt(...c.stone).struct = { type: 'stone', camp: c, offering: 0 };
  let cord = false;
  for (let k = 0; k < 40 && !cord; k++){ sp.task = null; api.START.watch(sp); sp.task.progress = 119; sp.x = c.pit[0] + 5; sp.y = c.pit[1]; sp.task.arrive(sp, sp.task); cord = !!api.items.find(i => i.kind === 'cord' && i.x === c.stone[0] && i.y === c.stone[1]); for (const i of api.items.filter(i => i.kind === 'moss' && i.x === c.stone[0])) api.removeItem(i); }
  assert.ok(cord, 'no cord on the stone in forty nights');
  assert.ok(api.chronicle.some(e => e.text.includes('coil of cord lies')));
});

test('a wolf raid takes fish as it takes meat', () => {
  const api = load(); api.startWorld('r');
  const c = api.camps[0]; api.camp = c; const a = api.beings[0];
  api.setSite(a.x, a.y); const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: false }; c.pit = [t.x, t.y];
  c.stash.fish = 2; c.stash.carcass = 0; c.stash.cooked = 0; c.stash.smoked = 0;
  const w = api.beings.find(b => b.species === 'wolf'); w.x = c.stashTile[0]; w.y = c.stashTile[1]; w.z = 0; w.task = null; w.needs.food = 20; w.cooldown = {};
  api.tick = 22 * 1000;
  assert.ok(api.START.raid(w), 'the raid should start with fish in the stash');
  w.task.arrive(w, w.task);
  assert.equal(c.stash.fish, 1);
});
