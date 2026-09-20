// Dwellers: wolves and foxes at home in their dens. Fast: hand-built situations on a real world.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
/* These tests build a situation and then put the world at the hour it is about: midday for a wolf that
   should be asleep, hour 22 for one that should be out. `setClock` is the one function that moves the
   clock (ruling 8 of plan G4); it also brings every being's body with it, because since task 3 a being
   charged for a jump it was not alive for arrives starving. See tests/lib/run.js. */
const { setClock } = require('./lib/run.js');

/* A den is dug in the country where a god made foxes or wolves, so not every seed has one. A test takes the
   first soak seed that does. `some soak seed digs dens` below keeps that honest: if a change leaves every seed
   without a den, that test goes red rather than the rest going quiet. */
const SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];
const denSeed = {};
function seedWithDen(species){
  if (species in denSeed) return denSeed[species];
  for (const s of SEEDS){ const api = load(); api.startWorld(s); if (api.beings.some(b => b.species === species && b.den)) return denSeed[species] = s; }
  return denSeed[species] = null;
}
function denned(species){
  const seed = seedWithDen(species); if (!seed) return null;
  const api = load(); api.startWorld(seed);
  const b = api.beings.find(b => b.species === species && b.den);
  return { api, b, den: b.den };
}

test('some soak seed digs dens for the foxes and the wolves that were made', () => {
  assert.ok(seedWithDen('wolf'), 'no soak seed has a wolf in a den');
  assert.ok(seedWithDen('fox'), 'no soak seed has a fox in a den');
});
/* `n` is a budget in ticks of the old 1000-tick day, which is what every caller is written in.
   G4 task 1 converts it here so no call site had to be re-read. */
const run = (api, b, n) => { for (let k = 0, b2 = api.ticks(n); k < b2 && b.alive; k++){ api.camp = api.camps[0]; api.updateBeing(b); api.tick = api.tick + 1; } };
const inDen = (b) => b.den.tiles.some(t => t.x === b.x && t.y === b.y && t.z === b.z);

test('a wolf rests in its den by day', ctx => {
  const home = denned('wolf'); if (!home) return ctx.skip('no soak seed has a wolf in a den');
  const { api, b, den } = home;
  const out = den.exit; b.x = out.x; b.y = out.y; b.z = 0; b.task = null; b.asleep = false;
  for (const k in b.needs) b.needs[k] = 90; b.needs.rest = 30;
  setClock(api, api.ticks(10 * 1000 + 500)); /* midday */
  /* A wolf that has slept its fill leaves the den again, so the run stops at the rest, not at a fixed tick. */
  let rested = false;
  for (let k = 0, b2 = api.ticks(400); k < b2 && !rested; k++){ api.camp = api.camps[0]; api.updateBeing(b); api.tick = api.tick + 1; rested = inDen(b) && b.needs.rest > 30; }
  assert.ok(rested, `the wolf should be home and resting; it is at ${b.x},${b.y},${b.z} doing ${b.task && b.task.label} with rest ${Math.round(b.needs.rest)}`);
});

test('a wolf carries a kill home to its den before eating', ctx => {
  const home = denned('wolf'); if (!home) return ctx.skip('no soak seed has a wolf in a den');
  const { api, b, den } = home;
  const out = den.exit; b.x = out.x; b.y = out.y; b.z = 0; b.task = null; b.asleep = false;
  for (const k in b.needs) b.needs[k] = 90; b.needs.food = 20;
  setClock(api, api.ticks(22 * 1000 + 100)); /* night */
  const r = api.beings.find(o => o.species === 'rabbit' && o.alive); r.x = out.x + 2; r.y = out.y; r.z = 0; r.task = null;
  for (const t of [[out.x + 1, out.y], [out.x + 2, out.y]]){ const q = api.tileAt(...t); q.feature = null; q.struct = null; if (q.ground === 'water') q.ground = 'grass'; }
  let carried = false;
  for (let k = 0, b2 = api.ticks(400); k < b2 && !(carried && !b.carrying); k++){ api.camp = api.camps[0]; api.updateBeing(b); if (b.carrying && b.carrying.kind === 'carcass') carried = true; api.tick = api.tick + 1; }
  assert.ok(carried, 'the wolf never picked up the kill');
  assert.equal(b.carrying, null, 'the kill was eaten at home');
  assert.ok(inDen(b), 'eaten in the den');
  assert.equal(b.needs.food, 100);
  assert.ok(api.chronicle.some(e => e.text.includes('drags')));
});

test('a wolf eats a kill where it fell when the den floor is unreachable', ctx => {
  const home = denned('wolf'); if (!home) return ctx.skip('no soak seed has a wolf in a den');
  const { api, b, den } = home;
  const out = den.exit; b.x = out.x; b.y = out.y; b.z = 0; b.task = null; b.asleep = false;
  b.den = Object.assign({}, den, { tiles: [] }); /* no floor tile to carry the kill to */
  for (const k in b.needs) b.needs[k] = 90; b.needs.food = 20;
  setClock(api, api.ticks(22 * 1000 + 100)); /* night */
  const r = api.beings.find(o => o.species === 'rabbit' && o.alive); r.x = out.x + 2; r.y = out.y; r.z = 0; r.task = null;
  for (const t of [[out.x + 1, out.y], [out.x + 2, out.y]]){ const q = api.tileAt(...t); q.feature = null; q.struct = null; if (q.ground === 'water') q.ground = 'grass'; }
  let killed = false;
  for (let k = 0, b2 = api.ticks(400); k < b2 && !killed && b.alive; k++){ api.camp = api.camps[0]; api.updateBeing(b); killed = !r.alive; api.tick = api.tick + 1; }
  assert.ok(killed, 'the wolf never made the kill');
  assert.equal(b.carrying, null, 'nothing left carried when the den could not be reached');
  assert.equal(b.needs.food, 100, 'the wolf ate the kill where it fell');
  assert.ok(api.items.some(i => i.kind === 'carcass' && i.x === r.x && i.y === r.y), 'the carcass stays on the ground when it cannot be carried home');
});

test('a denned wolf whose den floor is unreachable still gets a rest task, not a stuck home task', ctx => {
  const home = denned('wolf'); if (!home) return ctx.skip('no soak seed has a wolf in a den');
  const { api, b, den } = home;
  b.den = Object.assign({}, den, { tiles: [] }); /* no floor tile to go home to */
  b.task = null; b.asleep = false;
  const ok = api.startTask(b, 'home');
  assert.ok(ok, 'startTask home should fall back to resting rather than fail');
  assert.equal(b.task.type, 'rest', `expected a rest task, got ${b.task && b.task.type}`);
});

test('an edge-arrived fox joins the fox den with room for a pair', ctx => {
  const home = denned('fox'); if (!home) return ctx.skip('no soak seed has a fox in a den');
  const { api, den } = home;
  const before = api.beings.filter(b => b.alive && b.species === 'fox' && b.den === den).length;
  assert.ok(before < 2, 'the fox den should start short of a pair');
  const t = den.exit; const f = api.makeBeing('fox', t.x, t.y, null, 0);
  api.beings.push(f);
  api.adoptDen(f);
  assert.equal(f.den, den, 'the arriving fox should join the den with room for it');
});

test('an edge-arrived wolf does not join a den already home to a pair', ctx => {
  const home = denned('wolf'); if (!home) return ctx.skip('no soak seed has a wolf in a den');
  const { api, den } = home; /* the wolf den on seed r starts with two grown owners */
  const t = den.exit; const w = api.makeBeing('wolf', t.x, t.y, null, 0);
  api.beings.push(w);
  api.adoptDen(w);
  assert.notEqual(w.den, den, 'a full den should not take a third owner');
});

test('an edge-arrived wolf does not join a den the camp holds', ctx => {
  const home = denned('wolf'); if (!home) return ctx.skip('no soak seed has a wolf in a den');
  const { api, den } = home;
  den.cleared = api.camps[0];
  const t = den.exit; const w = api.makeBeing('wolf', t.x, t.y, null, 0);
  api.beings.push(w);
  api.adoptDen(w);
  assert.equal(w.den, null, 'a cleared den should give the arrival no den');
});

test('a den with two adults bears one young in spring, once a year', ctx => {
  const home = denned('wolf'); if (!home) return ctx.skip('no soak seed has a wolf in a den');
  const { api, den } = home;
  const adults = api.beings.filter(b => b.alive && b.species === 'wolf' && b.den === den);
  assert.equal(adults.length, 2);
  setClock(api, api.ticks(1000)); /* spring, and before either den wolf on seed r ages into 'old' */
  for (const w of adults){ const t = den.tiles[0]; w.x = t.x; w.y = t.y; w.z = t.z; }
  const before = api.beings.filter(b => b.species === 'wolf').length;
  api.denTick(); setClock(api, api.tick + api.ticks(500)); api.denTick();
  const after = api.beings.filter(b => b.species === 'wolf').length;
  assert.equal(after, before + 1, 'one pup, not two');
  const pup = api.beings[api.beings.length - 1];
  assert.equal(pup.den, den); assert.equal(pup.born, api.tick - api.ticks(500)); assert.ok(inDen(pup));
  assert.ok(api.chronicle.some(e => e.text.includes('pup') || e.text.includes('kit')));
});

test('a person who walks into a wolf den is attacked, brand or no brand, by day', ctx => {
  const home = denned('wolf'); if (!home) return ctx.skip('no soak seed has a wolf in a den');
  const { api, b, den } = home;
  const t = den.tiles.find(t => api.passable(t.x, t.y, t.z)); b.x = t.x; b.y = t.y; b.z = t.z; b.task = null; b.asleep = false;
  for (const k in b.needs) b.needs[k] = 90;
  setClock(api, api.ticks(10 * 1000 + 500));
  const h = api.firstPerson(); h.x = t.x; h.y = t.y; h.z = t.z; h.carrying = { kind: 'ember', count: 1, dies: api.tick + 400 }; h.hp = 100; h.thoughts = [];
  api.camp = api.camps[0]; api.updateBeing(b);
  assert.ok(h.hp < 100, 'the wolf should have bitten');
  assert.ok(h.thoughts.some(t => t.key === 'denbite'));
  assert.ok(api.chronicle.some(e => e.text.includes('in its den')));
});

test('one bite per den per 150 ticks: two adult wolves at home only bite once between them', ctx => {
  const home = denned('wolf'); if (!home) return ctx.skip('no soak seed has a wolf in a den');
  const { api, b, den } = home;
  const owners = api.beings.filter(o => o.alive && o.species === 'wolf' && o.den === den);
  assert.equal(owners.length, 2, 'the wolf den on seed r starts with two grown owners');
  const t = den.tiles.find(t => api.passable(t.x, t.y, t.z));
  for (const w of owners){ w.x = t.x; w.y = t.y; w.z = t.z; w.task = null; w.cooldown = {}; }
  setClock(api, api.ticks(10 * 1000 + 500));
  const h = api.firstPerson(); h.x = t.x; h.y = t.y; h.z = t.z; h.hp = 60; h.thoughts = [];
  api.camp = api.camps[0];
  for (const w of owners) api.updateBeing(w);
  assert.ok(h.hp >= 60 - 34, `the person lost more than 34 hp: ${60 - h.hp}`);
});

test('a cross sprite steals a pot, and a pleased one leaves cord on the stone', () => {
  const api = load(); api.startWorld('r');
  const c = api.camps[0]; api.camp = c; const a = api.firstPerson();
  api.setSite(a.x, a.y); const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: true }; c.pit = [t.x, t.y]; c.everLit = true;
  c.fae.known = true; c.fae.favor = -30; c.stash.pot = 1; c.stash.berries = 5; c.fae.lastPrank = 0;
  const sp = api.beings.find(b => b.species === 'sprite');
  sp.x = c.stashTile[0]; sp.y = c.stashTile[1]; sp.z = 0; sp.task = null;
  setClock(api, api.ticks(22 * 1000));
  let stolen = false;
  for (let k = 0; k < 40 && !stolen; k++){ c.stash.pot = 1; c.fae.lastPrank = 0; api.startTask(sp, 'prank'); api.taskStop(sp); stolen = c.stash.pot === 0; }
  assert.ok(stolen, 'the pot was never taken in forty pranks');
  assert.ok(api.chronicle.some(e => e.text.includes('pot is gone')));
  /* The sprites leave nothing on a stone that already has something on it, so the tile is cleared first.
     The watch is wound to one tick short of the gift, which the rule spends as `++t.progress ===
     CLOCK.sprite.visitGift`. That was written as a bare 119 and G4 task 1 made the gift 10,368 ticks
     rather than 120, so the number is now read from the table and cannot rot again. */
  c.fae.favor = 50; c.stone = [c.pit[0] + 3, c.pit[1]];
  for (const i of api.items.filter(i => i.x === c.stone[0] && i.y === c.stone[1] && i.z === 0)) api.removeItem(i);
  api.tileAt(...c.stone).struct = { type: 'stone', camp: c, offering: 0 };
  let cord = false;
  for (let k = 0; k < 40 && !cord; k++){ sp.task = null; api.startTask(sp, 'watch'); sp.task.progress = api.CLOCK.sprite.visitGift - 1; sp.x = c.pit[0] + 5; sp.y = c.pit[1]; api.taskStop(sp); cord = !!api.items.find(i => i.kind === 'cord' && i.x === c.stone[0] && i.y === c.stone[1]); for (const i of api.items.filter(i => i.kind === 'moss' && i.x === c.stone[0])) api.removeItem(i); }
  assert.ok(cord, 'no cord on the stone in forty nights');
  assert.ok(api.chronicle.some(e => e.text.includes('coil of cord lies')));
});

test('a wolf raid takes fish as it takes meat', () => {
  const api = load(); api.startWorld('r');
  const c = api.camps[0]; api.camp = c; const a = api.firstPerson();
  api.setSite(a.x, a.y); const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: false }; c.pit = [t.x, t.y];
  c.stash.fish = 2; c.stash.carcass = 0; c.stash.cooked = 0; c.stash.smoked = 0;
  /* Seed r's gods never made wolves, so the raider is put there by hand. */
  let w = api.beings.find(b => b.species === 'wolf');
  if (!w){ w = api.makeBeing('wolf', c.stashTile[0], c.stashTile[1], null, 0); api.beings.push(w); }
  w.x = c.stashTile[0]; w.y = c.stashTile[1]; w.z = 0; w.task = null; w.needs.food = 20; w.cooldown = {};
  setClock(api, api.ticks(22 * 1000));
  assert.ok(api.startTask(w, 'raid'), 'the raid should start with fish in the stash');
  api.taskStop(w);
  assert.equal(c.stash.fish, 1);
});

/* The stalk in the dark. A wolf keeps `cooldown.stalk` and the person keeps `cooldown.stalked`: the first
   spaces out one wolf's maulings, the second spaces out one person's. Seed r's gods never made wolves, so
   the wolves are put there by hand, and the other people are taken out of the valley so the victim is alone. */
function lonePerson(){
  const api = load(); api.startWorld('r');
  setClock(api, api.ticks(22 * 1000));                       // hour 0, which is night
  const h = api.firstPerson();
  for (const o of api.beings) if (o.species === 'human' && o !== h) o.alive = false;
  h.hp = 100; h.thoughts = []; h.carrying = null; h.cooldown = {}; h.task = null; h.asleep = false;
  api.camp = h.camp;
  return { api, h };
}
function wolfBeside(api, h, dx){
  const w = api.makeBeing('wolf', h.x + dx, h.y, null, 0);
  w.z = h.z; w.task = null; w.asleep = false; w.needs.food = 20; w.cooldown = {}; w.traits.bravery = 0.9;
  api.beings.push(w);
  return w;
}
function maul(api, w){ assert.ok(api.startTask(w, 'stalk'), 'the stalk should start'); api.taskStop(w); }

test('a maul sets the wait on the person as well as on the wolf', () => {
  const { api, h } = lonePerson();
  const w = wolfBeside(api, h, 1);
  maul(api, w);
  assert.ok(h.hp <= 80, `the maul should cost at least 20 hp: ${100 - h.hp}`);
  assert.equal(w.cooldown.stalk, api.tick + api.CLOCK.cooldown.stalk);
  assert.equal(h.cooldown.stalked, api.tick + api.CLOCK.cooldown.stalked);
  assert.ok(h.thoughts.some(t => t.key === 'mauled'), 'the mauled thought shows the player the wait');
});

test('a mauled person cannot be stalked again within the wait', () => {
  const { api, h } = lonePerson();
  maul(api, wolfBeside(api, h, 1));
  const hurt = h.hp;
  const w2 = wolfBeside(api, h, -1);
  api.tick += api.CLOCK.cooldown.stalked - 1;
  assert.equal(api.startTask(w2, 'stalk'), false, 'the gate should refuse a person still under the wait');
  assert.equal(h.hp, hurt);
});

test('a mauled person can be stalked once the wait passes', () => {
  const { api, h } = lonePerson();
  maul(api, wolfBeside(api, h, 1));
  const hurt = h.hp; h.hp = 100;
  assert.ok(hurt <= 80);
  api.tick += api.CLOCK.cooldown.stalked;
  const w2 = wolfBeside(api, h, -1);
  maul(api, w2);
  assert.ok(h.hp <= 80, 'the second maul should land once the wait has passed');
});

test('two wolves already in flight cannot halve the wait on one person', () => {
  const { api, h } = lonePerson();
  const w1 = wolfBeside(api, h, 1), w2 = wolfBeside(api, h, -1);
  /* Both are past the gate before either maul lands, which is how four wolves killed a founder in three ticks. */
  assert.ok(api.startTask(w1, 'stalk')); assert.ok(api.startTask(w2, 'stalk'));
  api.taskStop(w1);
  const hurt = h.hp; assert.ok(hurt <= 80);
  api.tick += 2;
  api.taskStop(w2);
  assert.equal(h.hp, hurt, 'the second wolf should find the person still under the wait');
});

test('the wolf keeps its own cooldown, and it is the shorter of the two', () => {
  const { api, h } = lonePerson();
  const w = wolfBeside(api, h, 1);
  maul(api, w);
  assert.ok(api.CLOCK.cooldown.stalk < api.CLOCK.cooldown.stalked, 'the person waits longer than the wolf');
  /* The person's wait is cleared, so only the wolf's own cooldown is left to refuse the choice. */
  h.cooldown.stalked = 0; h.hp = 100;
  api.tick += 10; w.task = null; w.needs.food = 20;
  api.updateBeing(w);
  assert.ok(w.lastChoice, 'the wolf should have chosen');
  assert.notEqual(w.lastChoice.picked, 'stalk');
  assert.equal(h.hp, 100);
});
