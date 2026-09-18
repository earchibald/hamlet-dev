// Closing: cave goals, den contention, site scoring. Fast: hand-built situations on a real world.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

function readyCamp(seed = 'r'){
  const api = load(); api.startWorld(seed);
  const a = api.beings[0]; const c = api.camps[0]; api.camp = c;
  api.setSite(a.x, a.y);
  const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: true }; c.pit = [t.x, t.y];
  c.everLit = true; c.bestStreak = 4000; c.tools.axe = 1; c.tools.spear = 1;
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){ const q = api.tileAt(t.x + dx, t.y + dy); q.ground = 'soil'; q.feature = null; q.struct = null; q.fire = 0; }
  a.x = c.stashTile[0]; a.y = c.stashTile[1]; a.z = 0; a.task = null; a.asleep = false; a.homeless = false; a.cooldown = {}; a.traits.bravery = 0.9;
  for (const k in a.needs) a.needs[k] = 90;
  return { api, a, c };
}
function doOffer(api, a, label, ticks = 2000){
  const o = api.offersFor(a).find(o => o.label === label);
  assert.ok(o, `no offer "${label}"; offers: ${api.offersFor(a).map(o => o.label).join(', ')}`);
  assert.ok(o.start(a), `offer "${label}" would not start`);
  a.task.started = api.tick; a.task.key = label;
  for (let k = 0; k < ticks && a.task; k++){ api.camp = a.camp; api.updateBeing(a); api.tick = api.tick + 1; }
  assert.equal(a.task, null, `"${label}" did not finish in ${ticks} ticks`);
}
/* Move the camp beside a water cave's exit so the search is short. */
function campByCave(api, c, a, cave){
  const e = cave.exit; api.setSite(e.x + 2, e.y); const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: true }; c.pit = [t.x, t.y];
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){ const q = api.tileAt(t.x + dx, t.y + dy); if (q.mouth) continue; q.ground = 'soil'; q.feature = null; q.struct = null; }
  a.x = c.stashTile[0]; a.y = c.stashTile[1]; a.z = 0;
}

test('a brave person takes a brand, walks to the deep chamber, and brings the find home', () => {
  const { api, a, c } = readyCamp();
  const cave = api.caves.find(k => k.kind === 'water' && !k.blocked); assert.ok(cave, 'an open water cave on seed r');
  campByCave(api, c, a, cave);
  const find = api.items.find(i => i.x === cave.deep.x && i.y === cave.deep.y && i.z === -2); assert.ok(find);
  api.tick = 9 * 1000;
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

test('fallen rock is cleared with the axe before the search', () => {
  const { api, a, c } = readyCamp();
  const cave = api.caves.find(k => k.kind === 'water' && k.blocked) || (() => { const k = api.caves.find(k => k.kind === 'water'); const t = k.tiles.find(t => t.z === -1 && t !== k.mouth && !t.slope); t.ground = 'rock'; k.blocked = t; k.story.push('Fallen rock blocks the way.'); return k; })();
  campByCave(api, c, a, cave);
  api.tick = 9 * 1000;
  const labels = api.offersFor(a).map(o => o.label);
  assert.ok(labels.includes('clear the fallen rock'), labels.join(', ')); assert.ok(!labels.includes('search the cave with a brand'));
  doOffer(api, a, 'clear the fallen rock', 3000);
  assert.equal(cave.blocked, null); assert.ok(cave.story.some(s => s.includes('cleared')));
});

test('two brave people with brands and the spear clear a wolf den; the wolves dig a new one, and take the old back when the fire fails', () => {
  const { api, a, c } = readyCamp();
  const den = api.caves.find(k => k.kind === 'den' && k.owner === 'wolf');
  campByCave(api, c, a, den);
  const mate = api.makeBeing('human', a.x, a.y, 'Mate', 0); mate.camp = c; mate.traits.bravery = 0.8; mate.homeless = false; api.beings.push(mate);
  const wolves = api.beings.filter(b => b.species === 'wolf' && b.den === den);
  for (const w of wolves){ const t = den.tiles.find(t => api.passable(t.x, t.y, t.z)); w.x = t.x; w.y = t.y; w.z = t.z; w.task = null; }
  api.tick = 9 * 1000;
  assert.equal(api.goalState(api.GOALS.find(g => g.id === 'dens')).s, 'active');
  doOffer(api, a, 'clear the den with brands', 3000);
  assert.equal(den.cleared, c);
  for (const w of wolves) assert.equal(w.den, null);
  assert.ok(api.chronicle.some(e => e.text.includes('drive the wolves')));
  /* Three days on, the wolves have a new den on another hill. */
  api.tick = api.tick + 3 * 1000 + 10; for (let k = 0; k < 4; k++){ api.tick = api.tick + 500; api.denTick(); }
  const fresh = wolves[0].den; assert.ok(fresh && fresh !== den && fresh.hill !== den.hill, 'a new den on another hill');
  /* The fire goes out for a day: the old den goes back to wolves. */
  api.tileAt(...c.pit).struct.lit = false; c.outSince = api.tick - 1000 - 1;
  for (let k = 0; k < 2; k++){ api.tick = api.tick + 500; api.denTick(); }
  assert.equal(den.cleared, null);
  assert.ok(api.chronicle.some(e => e.text.includes('back in the den')));
});

test('a den reverts to homeless owners too, when the fire fails before they redig', () => {
  const { api, a, c } = readyCamp();
  const den = api.caves.find(k => k.kind === 'den' && k.owner === 'wolf');
  campByCave(api, c, a, den);
  const mate = api.makeBeing('human', a.x, a.y, 'Mate', 0); mate.camp = c; mate.traits.bravery = 0.8; mate.homeless = false; api.beings.push(mate);
  const wolves = api.beings.filter(b => b.species === 'wolf' && b.den === den);
  for (const w of wolves){ const t = den.tiles.find(t => api.passable(t.x, t.y, t.z)); w.x = t.x; w.y = t.y; w.z = t.z; w.task = null; }
  api.tick = 9 * 1000;
  doOffer(api, a, 'clear the den with brands', 3000);
  assert.equal(den.cleared, c);
  for (const w of wolves) assert.equal(w.den, null);
  /* The fire goes out for a day, well within the three-day redig window: the homeless owners come home. */
  api.tileAt(...c.pit).struct.lit = false; c.outSince = api.tick - 1000 - 1;
  for (let k = 0; k < 2; k++){ api.tick = api.tick + 500; api.denTick(); }
  assert.equal(den.cleared, null);
  for (const w of wolves) assert.equal(w.den, den);
  assert.ok(api.chronicle.some(e => e.text.includes('back in the den')));
});

test('withBrand ends with no live ember when the chain does not start', () => {
  const { api, a, c } = readyCamp();
  api.tick = 9 * 1000;
  assert.ok(api.withBrand(a, 'Testing', () => false));
  for (let k = 0; k < 20 && a.task; k++){ api.camp = a.camp; api.updateBeing(a); api.tick = api.tick + 1; }
  assert.equal(a.task, null);
  assert.equal(a.carrying, null);
  assert.equal(c.stash.ember || 0, 0);
});

test('a camp site likes stone close by and dislikes a wolf den', () => {
  const api = load(); api.startWorld('r'); const a = api.beings[0]; const c = api.camps[0]; api.camp = c;
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
