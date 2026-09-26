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

/* The bound comes from the rates in CLOCK. design/notes.md says a strike near a cold camp comes about once in
   2.5 days. The code once gave less than that, and the user ruled for the design: the code now matches it.
   The test below, 'a cold camp waits about 2.5 days', checks the design's figure. This function gives the
   bound for the run on moss-crag-87. In spring the code gives this:
     - a storm lasts `length + lengthSpread / 2` on average, and the next one starts `gap + gapSpread / 2`
       after it ends, so a storm begins about every 3.8 world days;
     - during a storm, a strike near a cold camp comes at `rate.lightningOut` a tick, so a storm of average
       length brings one with the chance 1 - (1 - rate)^length, about 0.93;
     - so a storm that brings a strike comes about once in 4.1 world days.
   The bound is three of those gaps after the pit is laid.
   On the code before PR 135 this seed never lit in twenty days. At each of the four strikes near the camp,
   on days 8.00, 12.40, 19.14 and 19.16, the founder had no path to any tile beside the fire, measured at
   the moment of the strike. The second task review measured more. The day-8.00 fire later spread to the edge
   of the wood. With only the new nearbyBlaze and emberPath, and the old pick, the camp lit on day 8.04.
   The day-12.40 strike failed because the founder was too far away for the old 3,500-tile search. So this
   run needs the far search, and the pick then makes it light sooner. */
function strikeGapDays(api){
  const { storm, rate } = api.CLOCK;
  const length = storm.length + storm.lengthSpread / 2, cycle = storm.gap + storm.gapSpread / 2 + length;
  const bringsOne = api.rollFor(rate.lightningOut, Math.round(length));
  return cycle / bringsOne / api.DAY;
}
/* The mean wait, in world days, from a moment the pit is laid and cold to the first strike near the camp.
   This is the figure the player lives through, and the one design/notes.md gives. It is exact for the
   weather model in updateWeather and the roll in tryLightning, not a sample, with two limits. It takes each
   season alone, though a storm that ends in the next season draws that season's gap. It assumes each roll
   finds a pine to strike; on three seeds, 1,000 forced rolls struck 999 times or more. A map with few
   reachable pines would wait longer than this says:
     - storms start and end on a beat, so a storm lasts ceil(len / beat) beats and a gap ceil(gap / beat),
       for each value `rint` can draw;
     - during a storm, the camp's beat rolls `rollFor(rate.lightningOut, beat)` once;
     - the pit is laid at a moment spread evenly over the weather's cycle, in one season. Summer's gap is
       `summerGap`. Sleet is a storm too, so winter is like spring and autumn.
   Es is the mean wait from the first beat of a storm. A storm with no strike costs its length and a gap,
   and the wait starts again at the next storm. */
function coldWaitDays(api, season){
  const { storm } = api.CLOCK, beat = api.CLOCK.every.cellular;
  const q = 1 - api.rollFor(api.CLOCK.rate.lightningOut, beat);
  const beatsOf = (base, spread) => { const out = []; for (let k = 0; k < spread; k++) out.push(Math.ceil((base + k) / beat)); return out; };
  const Ls = beatsOf(storm.length, storm.lengthSpread), Gs = beatsOf(season === 'summer' ? storm.summerGap : storm.gap, storm.gapSpread);
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  /* With m beats of storm left: the mean beats until the strike, or m if none comes, and the chance of none. */
  const upTo = m => q * (1 - Math.pow(q, m)) / (1 - q), none = m => Math.pow(q, m);
  const EG = mean(Gs), EL = mean(Ls);
  const Es = (mean(Ls.map(upTo)) + mean(Ls.map(none)) * EG) / (1 - mean(Ls.map(none)));
  /* Laid in a gap: wait out the rest of it, then Es. Laid in a storm: roll the beats left, then as above. */
  const inGap = mean(Gs.map(g => g * (g + 1) / 2 + g * Es));
  const inStorm = mean(Ls.map(L => { let s = 0; for (let m = 1; m <= L; m++) s += upTo(m) + none(m) * (EG + Es); return s; }));
  return (inGap + inStorm) / (EL + EG) * beat / api.DAY;
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

test('the bound reads the code\'s own rate: a storm with a strike about once in 4.1 world days in spring', () => {
  const gap = strikeGapDays(load());
  assert.ok(gap > 3.8 && gap < 4.4, `the gap is ${gap.toFixed(2)} days; if the rates were retuned, rewrite the comment above strikeGapDays`);
});

/* design/notes.md, section 4: with the hearth out, lightning strikes near a camp about once in 2.5 days.
   The mean over the year, each season weighted by its length, must be near that. */
test('a cold camp waits about 2.5 days for a strike, as the design says', () => {
  const api = load();
  const per = api.SEASONS.map(s => coldWaitDays(api, s));
  const year = per.reduce((s, w, i) => s + w * api.SEASON_LENGTHS[i], 0) / api.SEASON_LENGTHS.reduce((a, b) => a + b, 0);
  const told = api.SEASONS.map((s, i) => `${s} ${per[i].toFixed(2)}`).join(', ');
  assert.ok(year > 2.2 && year < 2.8, `a cold camp waits ${year.toFixed(2)} days on average for a strike (${told}); the design says about 2.5`);
});

/* The run that arrives by simulating. It does not tell which part of the fix it needs; the hand-built tests
   below check each part alone. */
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

/* The reach behind nearbyBlaze is kept for a tick. A door act and a load can both change the ground inside
   one tick, so neither may leave the old ground in place: a watched run and its replay would then offer
   different work, draw different numbers, and tell different stories. Built on the second task review's
   probe (staleload.js). */
test('a load at the same tick reads the loaded ground, as a fresh sim loaded from the same save does', () => {
  const { api, a, c } = coldCamp();
  const [sx, sy] = c.site;
  for (let dx = -1; dx <= 11; dx++) for (let dy = -2; dy <= 2; dy++){ const q = api.tileAt(sx + dx, sy + dy); if (q.struct) continue; q.ground = 'soil'; q.feature = null; q.fire = 0; q.slope = false; }
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++){ const q = api.tileAt(sx + 12 + dx, sy + dy); q.ground = 'grass'; q.feature = 'tree'; q.fire = 0; q.slope = false; }
  /* One grass tile is the only way to stand beside the pine. */
  const side = api.tileAt(sx + 11, sy); side.feature = null; side.ground = 'grass';
  const pine = api.tileAt(sx + 12, sy);
  api.tick = api.tick + 1;
  api.inject({ source: 'player', act: 'light', x: pine.x, y: pine.y, z: 0 });
  const snap = JSON.parse(JSON.stringify(api.takeSnapshot()));
  /* The player sets the grass beside the pine alight, at the same tick. The pine can no longer be reached,
     because a burning tile cannot be walked; the burning grass itself can. */
  api.inject({ source: 'player', act: 'light', x: side.x, y: side.y, z: 0 });
  const lit = api.nearbyBlaze();
  assert.deepEqual(lit && [lit.x, lit.y], [side.x, side.y], 'after the second strike the goal should see the burning grass');
  /* The player loads the save, still at the same tick. */
  api.inject({ source: 'player', act: 'load', snapshot: snap });
  const api2 = load(); api2.startWorld('r'); api2.inject({ source: 'player', act: 'load', snapshot: snap });
  const after = api.nearbyBlaze(), fresh = api2.nearbyBlaze();
  assert.ok(fresh, 'the fresh sim sees no blaze, so this test proves nothing');
  assert.deepEqual(after && [after.x, after.y], [fresh.x, fresh.y], 'after a same-tick load the goal reads the ground from before the load');
  const offered = s => s.offersFor(s.beingById(a.id)).some(o => o.label.startsWith('fetch an ember'));
  assert.equal(offered(api), offered(api2), 'the loaded world and a fresh load of the same save offer different work');
  /* The same again through loadSnapshot itself, which the tests and the door both call. */
  api.inject({ source: 'player', act: 'light', x: side.x, y: side.y, z: 0 });
  assert.deepEqual((t => t && [t.x, t.y])(api.nearbyBlaze()), [side.x, side.y]);
  assert.equal(api.loadSnapshot(JSON.parse(JSON.stringify(snap))), null);
  const direct = api.nearbyBlaze();
  assert.deepEqual(direct && [direct.x, direct.y], [fresh.x, fresh.y], 'after loadSnapshot at the same tick the goal reads the ground from before the load');
});

test('a first fire from moss or firestones says the camp has a hearth; a relight does not', () => {
  for (const [how, setup, label, first, again] of [
    ['moss', (a, c) => { c.stash.moss = 1; }, 'light the pit with glowing moss', /tucks the glowing moss into the pit and blows\. The fire takes, and the camp has a hearth\./, /blows\. The fire takes\. No lightning, no sky\./],
    ['firestones', (a, c) => { c.tools.firestones = 1; a.skills.craft = 10; a.traits.patience = 1; }, 'strike sparks', /coaxes a spark into flame\. The wood takes light, and the camp has a hearth\./, /coaxes a spark into flame\. The fire is back\./],
  ]){
    for (const everLit of [false, true]){
      const { api, a, c } = coldCamp(); c.everLit = everLit; setup(a, c);
      const from = api.chronicle.length;
      doOffer(api, a, label, api.CLOCK.work.mossLight * 20);
      const line = api.chronicle.slice(0, api.chronicle.length - from).find(e => (everLit ? again : first).test(e.text));
      assert.ok(line, `${how}, ${everLit ? 'a relight' : 'the first fire'}: no fitting line in ${api.chronicle.slice(0, 3).map(e => e.text).join(' / ')}`);
      assert.equal(line.kind, everLit && how === 'firestones' ? 'good' : 'major', `${how}: the line is ${line.kind}`);
    }
  }
});

test('a strike through the door inside a tick changes what the goal can reach at once', () => {
  const { api, c } = coldCamp();
  const [sx, sy] = c.site;
  const set = (dx, dy, ground, feature = null) => { const q = api.tileAt(sx + dx, sy + dy); if (q.struct) return q; q.ground = ground; q.feature = feature; q.fire = 0; q.slope = false; return q; };
  /* Rock all round, the site's own ring left open, and one winding way out to a pine. */
  for (let dx = -2; dx <= 15; dx++) for (let dy = -8; dy <= 3; dy++) set(dx, dy, Math.max(Math.abs(dx), Math.abs(dy)) <= 1 ? 'soil' : 'rock');
  for (let dx = 2; dx <= 10; dx++) set(dx, 0, 'soil');
  for (let dy = -5; dy <= 0; dy++) set(10, dy, 'soil');
  for (let dx = 10; dx <= 12; dx++) set(dx, -5, 'grass');
  for (let dy = -5; dy <= 0; dy++) set(12, dy, 'soil');
  const pine = set(13, 0, 'grass', 'tree');
  const gate = api.tileAt(sx + 11, sy - 5);   // on the only way to the pine, and further from the site than the pine
  api.tick = api.tick + 1;
  api.inject({ source: 'player', act: 'light', x: pine.x, y: pine.y, z: 0 });
  assert.equal(api.nearbyBlaze(), pine, 'the pine at the end of the way is not a blaze to fetch from');
  /* The player sets the way alight, at the same tick. A burning tile cannot be walked, so the pine is cut off.
     The burning grass on the way is still a blaze to fetch from. */
  api.inject({ source: 'player', act: 'light', x: gate.x, y: gate.y, z: 0 });
  assert.ok(gate.fire > 0, 'the grass on the way did not catch');
  const now = api.nearbyBlaze();
  assert.deepEqual(now && [now.x, now.y], [gate.x, gate.y], 'the goal still reads the ground from before the strike');
});
