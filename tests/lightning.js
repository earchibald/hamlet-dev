// The first fire from the sky. A camp that the player leaves alone must still get its hearth: a storm,
// lightning near the camp, and a person who runs to the burning pine for an ember.
// design/notes.md, section 4 and section 9: "the player, then lightning and embers".
//
// The soak cannot see this, because its script god lights every pit. The first run below has no god at
// all and arrives at the lighting by simulating. It never sets the clock.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const { collect } = require('./lib/run');

/* The bound comes from the rates in CLOCK, not from the design note. design/notes.md says a strike near a
   cold camp comes about once in 2.5 days. The code gives less than that, and the user will rule on which is
   right. In spring the code gives this:
     - a storm lasts `length + lengthSpread / 2` on average, and the next one starts `gap + gapSpread / 2`
       after it ends, so a storm begins about every 3.8 world days;
     - during a storm, a strike near a cold camp comes at `rate.lightningOut` a tick, so a storm of average
       length brings one with the chance 1 - (1 - rate)^length, about 0.65;
     - so a storm that brings a strike comes about once in 5.8 world days.
   The bound is three of those gaps after the pit is laid. Before the fix this seed never lit: every strike
   near the camp fell on a pine deep inside a wood, where nobody can stand beside the fire. */
function strikeGapDays(api){
  const { storm, rate } = api.CLOCK;
  const length = storm.length + storm.lengthSpread / 2, cycle = storm.gap + storm.gapSpread / 2 + length;
  const bringsOne = api.rollFor(rate.lightningOut, Math.round(length));
  return cycle / bringsOne / api.DAY;
}
const GAPS = 3;
const LAID = /It only needs a spark\./, STRIKE = /^Lightning strikes a pine .* near the camp\./, GRAB = /grabs a burning branch from the blaze/, HEARTH = /sets the ember in the pit\. The wood catches, and the camp has a hearth\./;

/* Step the seed with nobody lighting anything, until the first camp's pit is lit or the bound passes. */
function leftAlone(seed){
  const api = load(), c = collect(api);
  api.startWorld(seed, {});
  const gap = strikeGapDays(api);
  let laidAt = null, limit = Infinity;
  for (;;){
    api.step();
    const camp = api.camps[0];
    if (laidAt === null && camp && camp.pit){ laidAt = api.tick; limit = laidAt + GAPS * gap * api.DAY; }
    if (camp && camp.everLit) break;
    if (api.tick > limit) break;
  }
  c.check(seed);
  return { api, events: c.events, laidAt, limit, gap };
}

test('the bound reads the code\'s own rate: a storm with a strike about once in 5.8 world days in spring', () => {
  const gap = strikeGapDays(load());
  assert.ok(gap > 5 && gap < 7, `the gap is ${gap.toFixed(2)} days; if the rates were retuned, rewrite the comment above strikeGapDays`);
});

test('a camp left alone gets its first fire from lightning, on seed moss-crag-87', () => {
  const { api, events, laidAt, limit } = leftAlone('moss-crag-87');
  const at = re => events.findIndex(e => re.test(e.text));
  assert.ok(laidAt !== null, 'the founder never built a pit');
  assert.ok(at(LAID) >= 0, 'no line says the pit waits for a spark');
  /* Nobody from outside acted after the creation. Every act enters by the door, so an empty log is proof. */
  const played = api.doorLog.filter(e => e.tick > 0 && e.act !== 'load');
  assert.deepEqual(played, [], 'something outside the world acted');
  const camp = api.camps[0];
  const day = t => (t / api.DAY + 1).toFixed(2);
  assert.ok(camp.everLit, `the pit was laid on day ${day(laidAt)} and was still cold on day ${day(api.tick)}, past the bound of day ${day(limit)}`);
  const s = at(STRIKE), g = at(GRAB), h = at(HEARTH);
  assert.ok(s >= 0, 'the pit is lit, but no lightning struck near the camp');
  assert.ok(g > s, 'nobody took an ember from the strike');
  assert.ok(h > g, `the hearth line did not follow the ember: ${events.filter(e => e.kind === 'major').map(e => e.text).slice(-3).join(' / ')}`);
});

/* A camp on seed r, with its founder standing at the stash, and a cold, laid pit on the site. */
function coldCamp(){
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(), c = api.camps[0]; api.camp = c;
  api.setSite(a.x, a.y);
  const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: false }; c.pit = [t.x, t.y];
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){ const q = api.tileAt(t.x + dx, t.y + dy); q.ground = 'soil'; q.feature = null; q.struct = null; q.fire = 0; }
  a.x = c.stashTile[0]; a.y = c.stashTile[1]; a.z = 0; a.task = null; a.asleep = false; a.homeless = false; a.cooldown = {};
  for (const k in a.needs) a.needs[k] = 90;
  return { api, a, c };
}

test('lightning near a camp strikes the one pine people can reach, never one deep in the wood', () => {
  const { api, c } = coldCamp();
  const [sx, sy] = c.site, sc = api.secOf(sx, sy);
  /* Every tile of the three by three block of sectors around the camp becomes pine wood. */
  const x0 = Math.max(0, (sc.sx - 1) * api.LW), x1 = Math.min(api.W, (sc.sx + 2) * api.LW);
  const y0 = Math.max(0, (sc.sy - 1) * api.LH), y1 = Math.min(api.H, (sc.sy + 2) * api.LH);
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++){ const t = api.tileAt(x, y); t.ground = 'grass'; t.feature = 'tree'; t.struct = null; t.fire = 0; t.slope = false; }
  /* A bare clearing round the site, walled by rock, with one pine in the wall. Every other pine has only
     pines or rock beside it, so nobody can stand next to it. */
  let reachable = null;
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++){
    const t = api.tileAt(sx + dx, sy + dy), wall = Math.max(Math.abs(dx), Math.abs(dy)) === 3;
    t.feature = null; t.ground = wall ? 'rock' : 'soil';
    if (dx === 3 && dy === 0){ t.ground = 'grass'; t.feature = 'tree'; reachable = t; }
  }
  for (const it of api.items.filter(i => i.z === 0 && i.x >= x0 && i.x < x1 && i.y >= y0 && i.y < y1)) api.removeItem(it);
  api.tileAt(...c.pit).struct = { type: 'firepit', fuel: 300, lit: false };
  api.weather.storm = true; api.weather.until = Infinity;
  /* A strike on every roll, so the test sees many picks. The rate itself is not what this test is about. */
  api.CLOCK.rate.lightningOut = 1; api.CLOCK.rate.lightningLit = 1;
  let strikes = 0;
  for (let k = 0; k < 400; k++){
    api.tick = api.tick + 1;
    const before = api.chronicle.length;
    api.tryLightning();
    const burning = [];
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) if (api.tileAt(x, y).fire > 0) burning.push(api.tileAt(x, y));
    if (api.chronicle.length > before){
      strikes++;
      assert.deepEqual(burning.map(t => [t.x, t.y]), [[reachable.x, reachable.y]], 'lightning struck a pine nobody can reach');
      assert.equal(api.nearbyBlaze(), reachable, 'the goal cannot see the one fire an ember can come from');
    }
    for (const t of burning) t.fire = 0;
  }
  assert.ok(strikes >= 3, `only ${strikes} strikes in 400 rolls; the pick found the reachable pine too rarely to test`);
});

test('the goal offers no ember from a fire nobody can reach', () => {
  const { api, a, c } = coldCamp();
  const [sx, sy] = c.site;
  /* Open ground from the site out to ten tiles east, then a pine twelve tiles off, walled in by pines. */
  for (let dx = 0; dx <= 10; dx++) for (let dy = -2; dy <= 2; dy++){ const t = api.tileAt(sx + dx, sy + dy); if (t.struct) continue; t.ground = 'soil'; t.feature = null; t.fire = 0; t.slope = false; }
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++){ const t = api.tileAt(sx + 12 + dx, sy + dy); t.ground = 'grass'; t.feature = 'tree'; t.fire = 0; t.slope = false; }
  const deep = api.tileAt(sx + 12, sy); api.tick = api.tick + 1;
  /* The player's strike: it lights the pine through the door, as the sky's would, and counts the fire. */
  api.inject({ source: 'player', act: 'light', x: deep.x, y: deep.y, z: 0 });
  assert.ok(deep.fire > 0 && api.fireCount > 0, 'the pine did not catch');
  assert.equal(api.nearbyBlaze(), null, 'a pine walled in by pines counts as a blaze to fetch from');
  assert.ok(!api.offersFor(a).some(o => o.label.startsWith('fetch an ember')), 'an ember is offered from a fire nobody can reach');
  /* Open the ground beside it, and the same fire becomes one to fetch from. */
  const side = api.tileAt(sx + 11, sy); side.feature = null; side.ground = 'soil';
  api.tick = api.tick + 1;
  assert.equal(api.nearbyBlaze(), deep);
});

/* The work of an offer, done by stepping the one being, as tests/closing.js does. */
function doOffer(api, a, label, budget){
  const o = api.offersFor(a).find(o => o.label === label);
  assert.ok(o, `no offer "${label}"; offers: ${api.offersFor(a).map(o => o.label).join(', ')}`);
  assert.ok(api.startTask(a, o.task.kind, o.task.args), `offer "${label}" would not start`);
  a.task.started = api.tick; a.task.key = label;
  for (let k = 0; k < budget && a.task; k++){ api.camp = a.camp; api.updateBeing(a); api.tick = api.tick + 1; }
}

test('a cold camp lit by glowing moss waits for its first newcomer', () => {
  const { api, a, c } = coldCamp();
  c.stash.moss = 1; assert.equal(c.nextArrival, 0);
  doOffer(api, a, 'light the pit with glowing moss', api.CLOCK.work.mossLight * 4);
  assert.ok(c.everLit, 'the moss did not light the pit');
  assert.ok(c.nextArrival > 0, 'the moss lit the first hearth and no newcomer will ever come');
});

test('a cold camp lit by firestones waits for its first newcomer', () => {
  const { api, a, c } = coldCamp();
  c.tools.firestones = 1; a.skills.craft = 10; a.traits.patience = 1;
  assert.equal(c.nextArrival, 0);
  doOffer(api, a, 'strike sparks', api.CLOCK.work.strikeSparks * 4);
  assert.ok(c.everLit, 'the sparks did not light the pit');
  assert.ok(c.nextArrival > 0, 'the sparks lit the first hearth and no newcomer will ever come');
});

test('a founder far from the camp still sets out for the ember, and takes it', () => {
  const { api, a, c } = coldCamp();
  const [sx, sy] = c.site;
  /* A pine on open ground beside the site, struck by the player through the door. */
  const pine = api.tileAt(sx + 2, sy); pine.ground = 'grass'; pine.feature = 'tree'; pine.fire = 0;
  api.inject({ source: 'player', act: 'light', x: pine.x, y: pine.y, z: 0 });
  assert.equal(api.nearbyBlaze(), pine);
  /* The founder stands on the surface a long walk away: the tile a search from the site reaches after
     twenty thousand others. A search of 3,500 tiles from there, the old limit, does not find the fire. */
  const order = [...api.reachable(sx, sy, 0, 40000)].filter(i => i >= api.ZOFF * api.W * api.H && i < (api.ZOFF + 1) * api.W * api.H);
  const far = order[20000] - api.ZOFF * api.W * api.H;
  a.x = far % api.W; a.y = Math.floor(far / api.W); a.z = 0;
  const nextToFire = (x, y, z) => [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => { const t = api.tileAt(x + dx, y + dy, z); return t && t.fire > 0; });
  assert.equal(api.bfs(a.x, a.y, a.z, nextToFire, 3500, a), null, `the founder at ${a.x},${a.y} is close enough for the old search, so this test proves nothing`);
  const o = api.offersFor(a).find(o => o.label === 'fetch an ember from the blaze');
  assert.ok(o, 'no ember is offered');
  assert.ok(api.startTask(a, o.task.kind, o.task.args), 'the founder does not set out for a fire that is far off');
  a.task.started = api.tick; a.task.key = o.label;
  const budget = api.CLOCK.limit.task;
  for (let k = 0; k < budget && a.task && !a.carrying; k++){ api.camp = a.camp; api.updateBeing(a); api.tick = api.tick + 1; }
  assert.ok(a.carrying && a.carrying.kind === 'ember', `the founder did not reach the fire; now at ${a.x},${a.y}, ${a.task ? a.task.label : 'no task'}`);
});
