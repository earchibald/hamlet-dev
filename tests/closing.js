// Closing: cave goals, den contention, site scoring. Fast: hand-built situations on a real world.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
/* These tests build a situation and then put the world at the hour it is about: midday for a wolf that
   should be asleep, hour 22 for one that should be out. `setClock` is the one function that moves the
   clock (ruling 8 of plan G4); it also brings every being's body with it, because since task 3 a being
   charged for a jump it was not alive for arrives starving. See tests/lib/run.js. */
const { setClock } = require('./lib/run.js');

function readyCamp(seed = 'r'){
  const api = load(); api.startWorld(seed);
  const a = api.firstPerson(); const c = api.camps[0]; api.camp = c;
  api.setSite(a.x, a.y);
  const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: true }; c.pit = [t.x, t.y];
  c.everLit = true; c.bestStreak = 4000; c.tools.axe = 1; c.tools.spear = 1;
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){ const q = api.tileAt(t.x + dx, t.y + dy); q.ground = 'soil'; q.feature = null; q.struct = null; q.fire = 0; }
  a.x = c.stashTile[0]; a.y = c.stashTile[1]; a.z = 0; a.task = null; a.asleep = false; a.homeless = false; a.cooldown = {}; a.traits.bravery = 0.9;
  for (const k in a.needs) a.needs[k] = 90;
  return { api, a, c };
}
/* A wolf den is dug only in the country where a god made wolves, and only if that country holds a hill, so a
   seed may have none. A den test takes the first soak seed that has one. */
const SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];
let wolfDenSeed;
function seedWithWolfDen(){
  if (wolfDenSeed !== undefined) return wolfDenSeed;
  for (const s of SEEDS){ const api = load(); api.startWorld(s); if (api.caves.some(k => k.kind === 'den' && k.owner === 'wolf')) return wolfDenSeed = s; }
  return wolfDenSeed = null;
}
function readyDenCamp(){ const s = seedWithWolfDen(); return s ? readyCamp(s) : null; }

test('some soak seed digs a wolf den', () => { assert.ok(seedWithWolfDen(), 'no soak seed digs a wolf den'); });

/* `ticks` is a budget in ticks of the old 1000-tick day, which is what every caller below was
   written in. G4 task 1 made a tick one world second, so the budget converts here rather than at
   each call site: the world time each caller meant is unchanged, and no caller had to be re-read. */
function doOffer(api, a, label, ticks = 2000){
  const o = api.offersFor(a).find(o => o.label === label || o.label.startsWith(label));
  assert.ok(o, `no offer "${label}"; offers: ${api.offersFor(a).map(o => o.label).join(', ')}`);
  assert.ok(api.startTask(a, o.task.kind, o.task.args), `offer "${label}" would not start`);
  a.task.started = api.tick; a.task.key = label;
  const budget = api.ticks(ticks);
  for (let k = 0; k < budget && a.task; k++){ api.camp = a.camp; api.updateBeing(a); api.tick = api.tick + 1; }
  assert.equal(a.task, null, `"${label}" did not finish in ${ticks} old ticks, which is ${(budget / api.DAY).toFixed(1)} world days`);
}
/* Move the camp near a cave's exit so the walk is short. `gap` is how far off the exit the site sits: two tiles
   for a cave nobody lives in, and further for a den, so a wolf standing in its own mouth is not already a threat
   at the fire and the party is not sent running before it sets out. */
function campByCave(api, c, a, cave, gap = 2){
  const e = cave.exit;
  /* Any open tile about `gap` off the mouth will do. A cave near the map edge or in a thicket has no room in the
     four compass directions, so the eight around it, out to two tiles further, are tried in order of how near
     they sit to the gap asked for. */
  const cands = [];
  for (let dx = -gap - 2; dx <= gap + 2; dx++) for (let dy = -gap - 2; dy <= gap + 2; dy++){
    const d = Math.hypot(dx, dy); if (d < gap || d > gap + 2) continue;
    cands.push([e.x + dx, e.y + dy, Math.abs(d - gap)]);
  }
  cands.sort((p, q) => p[2] - q[2]);
  const spot = cands.find(([x, y]) => api.hasTile(x, y, 0) && api.passable(x, y) && x > 2 && y > 2 && x < api.W - 3 && y < api.H - 3);
  assert.ok(spot, `no room for a camp ${gap} tiles off the cave mouth at ${e.x},${e.y}`);
  api.setSite(spot[0], spot[1]); const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: true }; c.pit = [t.x, t.y];
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){ const q = api.tileAt(t.x + dx, t.y + dy); if (q.mouth) continue; q.ground = 'soil'; q.feature = null; q.struct = null; }
  a.x = c.stashTile[0]; a.y = c.stashTile[1]; a.z = 0;
}

test('a brave person takes a brand, walks to the deep chamber, and brings the find home', () => {
  const { api, a, c } = readyCamp();
  const cave = api.caves.find(k => k.kind === 'water' && !k.blocked); assert.ok(cave, 'an open water cave on seed r');
  campByCave(api, c, a, cave);
  const find = api.items.find(i => i.x === cave.deep.x && i.y === cave.deep.y && i.z === -2); assert.ok(find);
  setClock(api, api.ticks(9 * 1000));
  assert.equal(api.goalState(api.GOALS.find(g => g.id === 'caves')).s, 'active');
  doOffer(api, a, 'search the cave with a brand', 3000);
  assert.equal(cave.searched, c);
  assert.ok(!api.items.includes(find), 'the find was picked up');
  if (find.kind === 'firestones') assert.equal(c.tools.firestones, 1);
  else if (find.kind === 'moss') assert.ok(c.stash.moss >= 1);
  else assert.ok(api.chronicle.some(e => e.text.includes('old bones')));
  assert.ok(api.chronicle.some(e => e.text.includes('into the dark') || e.text.includes('comes up out of')), 'the search is in the chronicle');
  assert.equal(a.z, 0, 'and comes home');
});

test('a cave is claimed once the search begins; interrupted, it releases and nothing counted as searched', () => {
  const { api, a, c } = readyCamp();
  const cave = api.caves.find(k => k.kind === 'water' && !k.blocked); assert.ok(cave, 'an open water cave on seed r');
  campByCave(api, c, a, cave);
  const mate = api.makeBeing('human', a.x, a.y, 'Mate', 0); mate.camp = c; mate.traits.bravery = 0.9; mate.homeless = false; mate.hp = 100;
  api.beings.push(mate);
  setClock(api, api.ticks(9 * 1000));
  const o = api.offersFor(a).find(o => o.label === 'search the cave with a brand');
  assert.ok(o, 'no search offer'); assert.ok(api.startTask(a, o.task.kind, o.task.args));
  a.task.started = api.tick; a.task.key = 'search the cave with a brand';
  for (let k = 0, b = api.ticks(3000); k < b && a.task && a.task.type !== 'search'; k++){ api.camp = a.camp; api.updateBeing(a); api.tick = api.tick + 1; }
  assert.ok(a.task && a.task.type === 'search', 'never reached the search task');
  assert.equal(cave.claimed, a.id, 'the cave is claimed while the search runs');
  assert.ok(!api.offersFor(mate).some(o => o.label === 'search the cave with a brand'), 'a claimed cave still offers a search to a second person');

  api.failTask(a);
  assert.equal(cave.claimed, null, 'the claim did not clear on interruption');
  assert.equal(cave.searched, null, 'an interrupted search counted as done');
  const find = api.items.find(i => i.x === cave.deep.x && i.y === cave.deep.y && i.z === -2);
  assert.ok(find, 'the find left the deep tile though nobody reached it');
  assert.ok(api.offersFor(mate).some(o => o.label === 'search the cave with a brand'), 'the offer did not return once the claim cleared');
});

test('fallen rock is cleared with the axe before the search', () => {
  const { api, a, c } = readyCamp();
  const cave = api.caves.find(k => k.kind === 'water' && k.blocked) || (() => { const k = api.caves.find(k => k.kind === 'water'); const t = k.tiles.find(t => t.z === -1 && t !== k.mouth && !t.slope); t.ground = 'rock'; k.blocked = t; k.story.push('Fallen rock blocks the way.'); return k; })();
  assert.ok(!api.keepsPaths(cave.blocked), 'the forced rock tile does not sit at a real chokepoint, unlike the ones world generation picks');
  campByCave(api, c, a, cave);
  /* A mark-painted world can put a second cave within reach of the same camp. The others count as searched, so
     the only cave on offer is the one with rock in it. */
  for (const k of api.caves) if (k !== cave && k.kind === 'water') k.searched = c;
  setClock(api, api.ticks(9 * 1000));
  const labels = api.offersFor(a).map(o => o.label);
  assert.ok(labels.includes('clear the fallen rock'), labels.join(', ')); assert.ok(!labels.includes('search the cave with a brand'));
  doOffer(api, a, 'clear the fallen rock', 3000);
  assert.equal(cave.blocked, null); assert.ok(cave.story.some(s => s.includes('cleared')));
});

test('two brave people with brands and the spear clear a wolf den; the wolves dig a new one, and take the old back when the fire fails', ctx => {
  const ready = readyDenCamp(); if (!ready) return ctx.skip('no soak seed digs a wolf den a camp can be built beside');
  const { api, a, c } = ready;
  const den = api.caves.find(k => k.kind === 'den' && k.owner === 'wolf');
  campByCave(api, c, a, den, 8);
  const mate = api.makeBeing('human', a.x, a.y, 'Mate', 0); mate.camp = c; mate.traits.bravery = 0.8; mate.homeless = false; api.beings.push(mate);
  const wolves = api.beings.filter(b => b.species === 'wolf' && b.den === den);
  for (const w of wolves){ const t = den.tiles.find(t => api.passable(t.x, t.y, t.z)); w.x = t.x; w.y = t.y; w.z = t.z; w.task = null; }
  setClock(api, api.ticks(9 * 1000));
  assert.equal(api.goalState(api.GOALS.find(g => g.id === 'dens')).s, 'active');
  doOffer(api, a, 'clear the den with brands', 3000);
  assert.equal(den.cleared, c);
  for (const w of wolves) assert.equal(w.den, null);
  assert.ok(api.chronicle.some(e => e.text.includes('drive the wolves')));
  /* Three days on, the wolves have a new den on another hill. */
  setClock(api, api.tick + api.ticks(3 * 1000 + 10)); for (let k = 0; k < 4; k++){ setClock(api, api.tick + api.ticks(500)); api.denTick(); }
  const fresh = wolves[0].den; assert.ok(fresh && fresh !== den && fresh.hill !== den.hill, 'a new den on another hill');
  /* The fire goes out for a day: the old den goes back to wolves. */
  api.tileAt(...c.pit).struct.lit = false; c.outSince = api.tick - 1000 - 1;
  for (let k = 0; k < 2; k++){ setClock(api, api.tick + api.ticks(500)); api.denTick(); }
  assert.equal(den.cleared, null);
  assert.ok(api.chronicle.some(e => e.text.includes('back in the den')));
});

test('a den reverts to homeless owners too, when the fire fails before they redig', ctx => {
  const ready = readyDenCamp(); if (!ready) return ctx.skip('no soak seed digs a wolf den a camp can be built beside');
  const { api, a, c } = ready;
  const den = api.caves.find(k => k.kind === 'den' && k.owner === 'wolf');
  campByCave(api, c, a, den, 8);
  const mate = api.makeBeing('human', a.x, a.y, 'Mate', 0); mate.camp = c; mate.traits.bravery = 0.8; mate.homeless = false; api.beings.push(mate);
  const wolves = api.beings.filter(b => b.species === 'wolf' && b.den === den);
  for (const w of wolves){ const t = den.tiles.find(t => api.passable(t.x, t.y, t.z)); w.x = t.x; w.y = t.y; w.z = t.z; w.task = null; }
  setClock(api, api.ticks(9 * 1000));
  doOffer(api, a, 'clear the den with brands', 3000);
  assert.equal(den.cleared, c);
  for (const w of wolves) assert.equal(w.den, null);
  /* The fire goes out for a day, well within the three-day redig window: the homeless owners come home. */
  api.tileAt(...c.pit).struct.lit = false; c.outSince = api.tick - 1000 - 1;
  for (let k = 0; k < 2; k++){ setClock(api, api.tick + api.ticks(500)); api.denTick(); }
  assert.equal(den.cleared, null);
  for (const w of wolves) assert.equal(w.den, den);
  assert.ok(api.chronicle.some(e => e.text.includes('back in the den')));
});

test('the party keeps its brands lit until home, and the guard goal leaves a just-driven wolf alone', ctx => {
  const ready = readyDenCamp(); if (!ready) return ctx.skip('no soak seed digs a wolf den a camp can be built beside');
  const { api, a, c } = ready;
  const den = api.caves.find(k => k.kind === 'den' && k.owner === 'wolf');
  campByCave(api, c, a, den, 8);
  const mate = api.makeBeing('human', a.x, a.y, 'Mate', 0); mate.camp = c; mate.traits.bravery = 0.8; mate.homeless = false; mate.hp = 100; api.beings.push(mate);
  const wolves = api.beings.filter(b => b.species === 'wolf' && b.den === den);
  for (const w of wolves){ const t = den.tiles.find(t => api.passable(t.x, t.y, t.z)); w.x = t.x; w.y = t.y; w.z = t.z; w.task = null; }
  setClock(api, api.ticks(9 * 1000));
  const o = api.offersFor(a).find(o => o.label.startsWith('clear the den with brands'));
  assert.ok(o, 'no den-clearing offer'); assert.ok(api.startTask(a, o.task.kind, o.task.args));
  a.task.started = api.tick; a.task.key = 'clear the den with brands';
  let k = 0;
  for (; k < 6000 && !(a.task === null && mate.task === null); k++){
    api.camp = c;
    if (a.alive && a.task) api.updateBeing(a);
    if (mate.alive && mate.task) api.updateBeing(mate);
    api.tick = api.tick + 1;
  }
  assert.ok(a.task === null && mate.task === null, `the party never finished within ${k} ticks`);
  assert.equal(den.cleared, c);
  assert.equal(a.z, 0, 'the leader is home, not left at the mouth'); assert.equal(mate.z, 0, 'the mate is home too');
  assert.equal(a.carrying, null, 'the leader still carries the ember'); assert.equal(mate.carrying, null, 'the mate still carries the ember');

  /* The guard goal does not chase the wolf it just displaced back into its old den: the livelock this
     used to cause had a brave camper cycle "Running at the wolf with fire" for days. */
  let sawChase = false;
  for (let n = 0; n < 2000; n++){
    api.step();
    if ([a, mate].some(h => h.alive && h.task && h.task.label === 'Running at the wolf with fire')) sawChase = true;
  }
  assert.ok(!sawChase, 'a brave camper cycled "Running at the wolf" against the beast it just drove off');
});

test('withBrand ends with no live ember when the chain does not start', () => {
  const { api, a, c } = readyCamp();
  setClock(api, api.ticks(9 * 1000));
  api.TASKS.never = { type: 'work', begin: () => false, stops: [() => 'done'] };
  assert.ok(api.withBrand(a, 'Testing', { kind: 'never', args: {} }));
  for (let k = 0; k < 20 && a.task; k++){ api.camp = a.camp; api.updateBeing(a); api.tick = api.tick + 1; }
  assert.equal(a.task, null);
  assert.equal(a.carrying, null);
  assert.equal(c.stash.ember || 0, 0);
});

test('a walled-off mate carries no ember, and an ember can never be stashed', ctx => {
  const ready = readyDenCamp(); if (!ready) return ctx.skip('no soak seed digs a wolf den a camp can be built beside');
  const { api, a, c } = ready;
  const den = api.caves.find(k => k.kind === 'den' && k.owner === 'wolf');
  campByCave(api, c, a, den, 8);
  const mate = api.makeBeing('human', a.x, a.y, 'Mate', 0); mate.camp = c; mate.traits.bravery = 0.8; mate.homeless = false; mate.hp = 100; api.beings.push(mate);
  /* Wall the mate into an isolated pocket: no path anywhere, so startClearDen must fail cleanly. */
  let iso = null;
  for (const t of api.world){ if (t.ground === 'grass' && !t.feature && !t.struct && api.dist(t.x, t.y, a.x, a.y) > 10){ iso = t; break; } }
  assert.ok(iso, 'no open tile far from the leader');
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ if (!api.hasTile(iso.x + dx, iso.y + dy, 0)) continue; const q = api.tileAt(iso.x + dx, iso.y + dy, 0); q.ground = 'water'; q.feature = null; q.struct = null; }
  mate.x = iso.x; mate.y = iso.y; mate.z = 0;
  setClock(api, api.ticks(9 * 1000));
  assert.ok(api.startClearDen(a, den), 'the leader\'s walk to the fire should still start');
  a.task.started = api.tick; a.task.key = 'clear the den with brands';
  for (let k = 0, b = api.ticks(3000); k < b && a.task; k++){ api.camp = a.camp; api.updateBeing(a); api.tick = api.tick + 1; }
  assert.equal(a.task, null, 'the leader\'s task never ended');
  assert.equal(a.carrying, null, 'the leader is left holding an ember after the chain failed');
  assert.equal(mate.carrying, null, 'the mate holds an ember though its own leg never started');
  assert.ok(!den.cleared, 'the den was cleared though the mate never reached it');

  /* An ember can never be delivered to the stash. */
  a.carrying = { kind: 'ember', count: 1, dies: api.tick + 400 };
  assert.equal(api.startDeliver(a), false, 'an ember must never be stashed');
});

test('a camp site likes stone close by and dislikes a wolf den', () => {
  const api = load(); api.startWorld('r'); const a = api.firstPerson(); const c = api.camps[0]; api.camp = c;
  api.chooseSite(a); const base = c.siteReason;
  assert.ok(typeof base === 'string');
  /* A rock face beside the chosen spot. */
  const [sx, sy] = c.site; const q = api.tileAt(sx + 3, sy); q.ground = 'rock'; q.feature = null; q.hill = { x: q.x, y: q.y, r: 1, storeys: 1, tiles: [api.idx(q.x, q.y)] };
  c.site = null; c.siteReason = ''; api.chooseSite(a);
  assert.ok(c.siteReason.includes('stone close by'), c.siteReason);
});

test('lightning strikes a tree, smoulders open ground with nothing to burn, and lights the pit', () => {
  const { api, a, c } = readyCamp();
  /* A bare, cleared tile beside the pit: nothing here will burn. */
  const [px, py] = c.pit; const bare = api.tileAt(px + 1, py);
  assert.equal(bare.feature, null); assert.equal(bare.ground, 'soil');
  const nothing = api.inject({ source: 'player', act: 'light', x: bare.x, y: bare.y, z: 0 });
  assert.equal(nothing, 'Nothing here will burn.');

  /* Find a pine tree tile at the surface to strike. */
  let tree = null;
  for (let x = 0; x < api.W && !tree; x++) for (let y = 0; y < api.H && !tree; y++){
    const t = api.tileAt(x, y); if (t.feature === 'tree') tree = t;
  }
  assert.ok(tree, 'a pine tree exists on seed r');
  const before = api.chronicle.length;
  const msg = api.inject({ source: 'player', act: 'light', x: tree.x, y: tree.y, z: 0 });
  assert.equal(msg, 'Lightning. Something is burning, and it will smoulder a while.');
  assert.ok(tree.fire >= 240, `fire is ${tree.fire}`);
  assert.ok(api.chronicle.length > before, 'a chronicle line was added');
  assert.ok(api.chronicle[0].text.startsWith('Lightning strikes a pine'), api.chronicle[0].text);

  /* The pit: unchanged return text, new chronicle wording. */
  api.tileAt(...c.pit).struct.lit = false; c.everLit = false;
  const pitMsg = api.inject({ source: 'player', act: 'light', x: px, y: py, z: 0 });
  assert.equal(pitMsg, 'The fire pit is lit.');
  assert.ok(api.chronicle[0].text.includes('Lightning strikes the pit'), api.chronicle[0].text);
});
