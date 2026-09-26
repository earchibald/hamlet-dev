// Snapshots: the streams, the table of references, the round trip, and the oracle.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { load, FILES } = require('../src/sim/index.js');
const { runDays, collect, runOn, fingerprint, DAY } = require('./lib/run.js');
/* The sim's own converter from the old 1,000-tick day to world ticks, used for every span in this
   file whose only meaning was an amount of world time. It is asked of the sim, never written down
   here, for the reason `tests/lib/run.js` gives about the day itself. */
const ticks = load().ticks;

/* BEHIND SLOW=1, PERMANENTLY. The oracle here saves a world in the middle of its life and runs two
   copies of it on, so it pays for the same world time three times over, and its longest world is
   forty days old. Measured on this branch: the seconds named in the skip below, for 49 tests. No day count here
   was cut to reduce them. The flag carries the cost; a shorter run would be a different test wearing
   this one's name.

   Every step count in this file was once a count of the old 1,000-tick day, so `12400` meant day
   12.4. G4 made a day 86,400 ticks, and the same numbers then meant a quarter of an hour. They are
   converted two ways, and each site says which it used:

     by measurement, where the step was chosen because something is true of the world there. Every
       save point is one of these. The oracle asks that somebody be walking and somebody at work at
       the save, and each case asks for more beside, in the sentence written next to it. The step is
       the one where that sentence is true, found by running the seed with the same god and watching
       the world, not by multiplying the old number. The ticks in those sentences are measurements
       and will move if a rule moves; each one names what it is a measurement OF, so the next reader
       can take it again.
     by `api.ticks(n)`, where the number was a span of world time and nothing else: a cap on a wait,
       a warm-up, a run-on long enough for the world to move. `ticks` is the sim's own legacy
       converter and holds the span's meaning in the world exactly where it was.

   Two numbers here are neither, and are left as they are: `n < 4000` in `steeredWorld` and `n < 200`
   in the open-turn test count attempts at a thing, not world time, and both stop long before the cap.

   The plan names the snapshot oracle as one of the three gates standing in for the golden between
   task 1 and the bless. The flag does NOT remove that gate: the oracle also runs in `tests/soak.js`
   as "seed x saved on day 1.5, loaded into a fresh sim, tells the same story to day 3", which runs
   at every task's gate. The gate moves; it does not go. */
const SLOW_SECS = 1120;
const TOO_SLOW = process.env.SLOW ? false
  : `the oracle saves a world mid-life and runs two copies of it on, and its longest world is 40 days old: about ${SLOW_SECS} s on this branch (18m36s measured with \`time SLOW=1 node --test tests/snapshot.js\` on an 18-core Mac at one-minute load average 12.4, with other runs of the sim on the machine). SLOW=1 runs it. The soak runs a save-and-load oracle of its own at every gate.`;
if (TOO_SLOW){
  test('tests/snapshot.js runs behind SLOW=1', { skip: TOO_SLOW }, () => {});
  return;
}


test('a stream gives the numbers it gave before', () => {
  const api = load(); const f = api.mulberry32(12345);
  assert.deepEqual([f(), f(), f()], [0.9797282677609473, 0.3067522644996643, 0.484205421525985]);
});
test('a stream set back to a position gives the same numbers again', () => {
  const api = load(); const f = api.mulberry32(99); f(); f();
  const at = api.streamState(f), a = [f(), f(), f()];
  api.setStreamState(f, at); assert.deepEqual([f(), f(), f()], a);
  const g = api.mulberry32(1); api.setStreamState(g, at); assert.deepEqual([g(), g(), g()], a);
  assert.ok(Number.isInteger(at));
});

/* A world with history in it: lit fires, snares, dens, a grove, perhaps a second camp. Run once, shared. */
let late; const lateWorld = () => late || (late = runDays('r', 40).api);

test('a snapshot goes through JSON whole', () => {
  const api = lateWorld(), snap = api.takeSnapshot();
  const text = JSON.stringify(snap); assert.deepStrictEqual(JSON.parse(text), snap);   // fails on an undefined field, which JSON drops
  assert.equal(snap.version, api.SNAPSHOT_VERSION);
});
test('a snapshot holds no number JSON cannot hold, no undefined, and no function', () => {
  const bad = []; const walk = (v, p) => {
    if (typeof v === 'number' && !Number.isFinite(v)) bad.push(p);
    else if (v === undefined || typeof v === 'function') bad.push(p);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, p + '[' + i + ']'));
    else if (v && typeof v === 'object'){ if (Object.getPrototypeOf(v) !== Object.prototype) bad.push(p + ' (not plain)'); for (const k of Object.keys(v)) walk(v[k], p + '.' + k); }
  };
  walk(lateWorld().takeSnapshot(), 'snap'); assert.deepEqual(bad.slice(0, 5), []);
});
test('taking a snapshot changes nothing and draws nothing', () => {
  const api = lateWorld(), a = JSON.stringify(api.takeSnapshot()), b = JSON.stringify(api.takeSnapshot());
  assert.equal(a, b);
});
test('REFS names every field that points at a record', () => {
  assert.deepEqual(lateWorld().unnamedRefs().slice(0, 10), []);
});
test('a snapshot is small enough to keep', () => {
  const n = JSON.stringify(lateWorld().takeSnapshot()).length;
  assert.ok(n < 6e6, `a day-40 snapshot of seed r is ${n} characters`);
});
test('a snapshot is taken only once the world is made', () => {
  const api = load(); api.startWorld('r'); api.beginCreation();
  assert.equal(api.era, 'gods');
  assert.throws(() => api.takeSnapshot(), /only once the world is made/);
});

/* ---------- the round trip ---------- */
const through = snap => JSON.parse(JSON.stringify(snap));
let loaded; const loadedWorld = () => { if (!loaded){ loaded = load(); assert.equal(loaded.loadSnapshot(through(lateWorld().takeSnapshot())), null); } return loaded; };

test('a loaded world gives the snapshot it was loaded from', () => {
  assert.deepStrictEqual(through(loadedWorld().takeSnapshot()), through(lateWorld().takeSnapshot()));
});
test('a loaded world has its records joined as the saved one had', () => {
  const api = loadedWorld(), was = lateWorld();
  for (const c of api.camps){
    for (const s of c.snares) assert.equal(api.world[s.y * api.W + s.x].struct.snare, s);
    for (const p of c.pitfalls) assert.equal(api.world[p.y * api.W + p.x].struct.pit, p);
  }
  for (const c of api.caves) for (const t of c.tiles) assert.equal(t.cave, c);
  for (const g of api.groves) assert.ok(api.sectors.includes(g.sector));
  for (const b of api.beings) if (b.camp) assert.ok(api.camps.includes(b.camp));
  const sharedLines = w => w.beings.flatMap(b => b.history).filter(l => w.chronicle.includes(l)).length;
  assert.ok(sharedLines(was) > 0); assert.equal(sharedLines(api), sharedLines(was));
  const sharedMarks = w => w.hills.filter(h => h.mark && w.field.regions.some(r => r.marks.includes(h.mark))).length;
  assert.ok(sharedMarks(was) > 0); assert.equal(sharedMarks(api), sharedMarks(was));
  assert.equal(api.camps.indexOf(api.camp), was.camps.indexOf(was.camp));
});
/* Seed r has no pitfall at day 40, so the pitfall assertion above cannot fail there. A small world on
   seed alpha has one from day 6.2 and two from day 7.1.

   This run takes the script god, which every other run in this file already takes, because measuring
   it showed that without one this valley digs nothing at all: no snare and no pitfall in fifteen
   world days, since the camp's pit is never lit. With the god it lays its first snare on day 0.3 and
   digs its first pitfall at tick 535,000. The save goes at 600,000, day 6.9, with one pitfall in the
   ground. The old run was 20,000 bare steps, day 20 of the 1,000-tick day, and after the merge it was
   a quarter of an hour, which is what the failure "this world was meant to have a pitfall" was
   reporting. */
test('a world with pitfalls in it round-trips and keeps each pitfall in its tile', () => {
  const was = load(); const wasEvents = collect(was); was.startWorld('alpha', { sw: 8, sh: 5 }); runOn(was, 0, 600000, wasEvents);
  assert.ok(was.camps.reduce((n, c) => n + c.pitfalls.length, 0) > 0, 'this world was meant to have a pitfall');
  const api = load(); assert.equal(api.loadSnapshot(through(was.takeSnapshot())), null);
  for (const c of api.camps) for (const p of c.pitfalls){
    const t = api.world[p.y * api.W + p.x];
    assert.equal(t.struct.pit, p); assert.equal(t.struct.camp, c); assert.equal(p.camp, c);
  }
  assert.deepStrictEqual(through(api.takeSnapshot()), through(was.takeSnapshot()));
});
/* A hand-edited save can carry a forged x, y, or z inside a tile. The tile's index must still win, so a
   forged position cannot move a tile to a place it never held. */
test('a forged x on a saved tile loads, and the tile keeps the x its index gives', () => {
  const was = load(); was.startWorld('r', { sw: 8, sh: 5 });
  const snap = through(was.takeSnapshot());
  const lv = snap.levels[was.ZOFF], i = lv.findIndex(t => t);
  /* A saved tile holds no x of its own. The index gives it. */
  const realX = i % was.W;
  lv[i].x = realX + 1; lv[i].y = 9999; lv[i].z = 3;
  const api = load(); assert.equal(api.loadSnapshot(snap), null);
  const t = api.levels[api.ZOFF][i];
  assert.equal(t.x, realX); assert.equal(t.y, (i - realX) / was.W); assert.equal(t.z, 0);
});
test('a loaded world has its derived state', () => {
  const api = loadedWorld(), was = lateWorld();
  assert.equal(api.tick, was.tick); assert.equal(api.W, was.W); assert.equal(api.world, api.levels[api.ZOFF]);
  assert.equal(api.field.byId.size, was.field.byId.size);
  for (const r of api.field.regions) assert.equal(api.field.byId.get(r.id), r);
});
/* The round trip cannot see a field the encoder drops as a default, because a loaded record that lacks
   it encodes the same way. The rules would read undefined. So compare the keys, in order, record by record. */
test('a loaded record has the same keys, in the same order, as the record it came from', () => {
  const api = loadedWorld(), was = lateWorld();
  const keys = r => Object.keys(r).join(',');
  const pairs = [['tile', api.levels.flat(), was.levels.flat()], ['being', api.beings, was.beings], ['camp', api.camps, was.camps],
    ['cave', api.caves, was.caves], ['hill', api.hills, was.hills], ['grove', api.groves, was.groves],
    ['sector', api.sectors, was.sectors], ['item', api.items, was.items], ['region', api.field.regions, was.field.regions],
    ['boundary', api.boundaries, was.boundaries]];
  const wrong = [];
  for (const [what, now, then] of pairs){
    if (now.length !== then.length){ wrong.push(`${what}: ${now.length} of them, not ${then.length}`); continue; }
    for (let i = 0; i < now.length; i++){
      if ((now[i] === null) !== (then[i] === null)){ wrong.push(`${what} ${i}: one is null`); break; }
      if (now[i] && keys(now[i]) !== keys(then[i])){ wrong.push(`${what} ${i}: ${keys(now[i])} not ${keys(then[i])}`); break; }
    }
  }
  assert.deepEqual(wrong, []);
  const withStruct = was.levels.flat().filter(t => t && t.struct).length, withCave = was.levels.flat().filter(t => t && t.cave).length;
  assert.ok(withStruct > 0 && withCave > 0, 'this world was meant to have a built tile and a cave tile');
});
/* A world where the plain numbers are not all zero. A save carries them, so a load gives them back. */
test('a loaded world gives back every plain number the save holds', () => {
  const api = load(), good = through(lateWorld().takeSnapshot());
  /* goalPriority, gestureFallbacks, and corpses are empty in this world, so each is given a value here. */
  const marked = { ...good, nextId: good.nextId + 7, fireCount: 3, wanderAt: 9001, doomAt: 8002, age: 5, pulseAge: 2,
    goalPriority: { fire: 2 }, gestureFallbacks: { uplift: 3 }, corpses: [{ x: 4, y: 5, z: 0, name: 'Someone' }] };
  assert.equal(api.loadSnapshot(marked), null);
  const back = api.takeSnapshot();
  for (const k of ['tick', 'nextId', 'fireCount', 'wanderAt', 'doomAt', 'age', 'pulseAge', 'rng', 'godRng', 'seed']) assert.equal(back[k], marked[k], k);
  for (const k of ['namePool', 'weather', 'resCache', 'startRegion', 'doorLog', 'gestureFallbacks', 'godNamePool', 'goalPriority', 'corpses']) assert.deepEqual(back[k], marked[k], k);
});
test('a save that cannot be read is refused and the world stays as it was', () => {
  const api = load(); api.startWorld('x'); const before = JSON.stringify(api.takeSnapshot());
  const good = through(lateWorld().takeSnapshot());
  for (const bad of [null, {}, 'text', { ...good, version: 99 }, { ...good, era: 'gods' }, { ...good, options: { sw: -1 } }, { ...good, beings: [{ ...good.beings[0], camp: 9999 }] }, { ...good, caves: 'no' }]){
    assert.equal(typeof api.loadSnapshot(bad), 'string');
    assert.equal(JSON.stringify(api.takeSnapshot()), before);
  }
});
test('a world of another size loads into a sim of the default size', () => {
  /* Both spans were counts of the old day and mean only "a world that has been running"; they
     convert with the sim's converter and keep the world time they had. */
  const small = load(); small.startWorld('r', { sw: 8, sh: 5 }); for (let i = 0; i < ticks(3000); i++) small.step();
  const api = load(); api.startWorld('x'); assert.equal(api.loadSnapshot(through(small.takeSnapshot())), null);
  assert.equal(api.W, small.W); for (let i = 0; i < ticks(500); i++) api.step();
});

/* ---------- the oracle ---------- */
/* The round trip proves a save can be read back. The oracle proves the save was whole: run N steps,
   save, load into a fresh sim, and run both worlds on for M more. The loaded world must tell the
   same story, line for line, and end holding the same snapshot. The last part is the strong one: it
   compares the streams, the caches, and every record, so a piece of state the save lost shows up
   here even when the story has not yet noticed it.

   The steps are counted on from the save, not from zero, because the script god reads the loop index. */
function oracle(seed, N, M, opts = {}, before = null){
  const a = load(); const ca = collect(a); a.startWorld(seed, opts);
  runOn(a, 0, N, ca);
  let at = before ? before(a, ca, N) : N;
  /* The save must be taken where the world is moving, because a save with nobody walking and nobody
     at work does not test the fields that carry a path or a job, which is what `sameStory` says. A
     save point named in CASES is already such a step, measured, and this loop turns over nothing
     there. It is for the runs that reach their save through a `before` hook: a hook waits for a fire
     or a burn-out, and where that wait ends is not something the case can choose. Both grove runs
     ended theirs in the small hours with the valley asleep. Half a world day is the cap, which is
     longer than a night; `sameStory` still fails if the world never woke. */
  const moving = () => a.beings.some(b => b.alive && b.task && b.task.path && b.task.path.length)
    && a.beings.some(b => b.alive && b.task && b.task.progress > 0);
  for (let i = 0; i < ticks(500) && !moving(); i++){ runOn(a, at, 1, ca); at++; }
  const midTask = a.beings.filter(b => b.alive && b.task && b.task.path && b.task.path.length).length;
  const working = a.beings.filter(b => b.alive && b.task && b.task.progress > 0).length;
  const denless = a.beings.filter(b => b.alive && b.oldDen && !b.den).length;
  const snap = through(a.takeSnapshot());
  const b = load(); assert.equal(b.loadSnapshot(snap), null);
  const cb = collect(b);
  const cut = ca.events.length;
  runOn(a, at, M, ca); runOn(b, at, M, cb);
  return { a, b, after: ca.events.slice(cut), loaded: cb.events, midTask, working, denless, snap };
}
/* What the two worlds must share once both have run on. */
function sameStory(o){
  assert.ok(o.midTask > 0 && o.working > 0, 'nobody was walking and nobody was at work at the save; pick another step');
  assert.deepEqual(o.loaded.map(e => e.text), o.after.map(e => e.text));
  assert.deepEqual(fingerprint(o.b, o.loaded), fingerprint(o.a, o.after));
  /* The two snapshots are compared twice: by value, which says what differs, and then as text, which
     also holds the two worlds to the same key order in every object. */
  const ja = JSON.stringify(o.a.takeSnapshot()), jb = JSON.stringify(o.b.takeSnapshot());
  assert.deepStrictEqual(JSON.parse(jb), JSON.parse(ja));
  assert.ok(jb === ja, 'the two worlds hold the same state, but one writes an object\'s keys in another order');
}
/* What each case was picked for is in the comment beside it. The steps are kept as low as the case
   allows, because each one runs its world once whole and then twice more from the save.

   Every N and M here is measured, not multiplied. Each seed was run with the script god the oracle
   uses, sampled every 5,000 ticks, and the tick written down is one where the case's own sentence is
   true: somebody walking and somebody at work, plus whatever else the sentence names. The measured
   ticks are quoted beside each row so the next reader can take them again rather than trust them.
   The old numbers were 12,400, 12,400, 30,300 and 20,000 steps of the 1,000-tick day, and after the
   merge they were a quarter of an hour of world time each, at which no case's sentence was true and
   all four failed on "nobody was walking and nobody was at work at the save". */
const SMALL = { sw: 8, sh: 5 };
/* Each row carries a `want`, and it is the point of the conversion. The sentence beside a row used
   to be a comment alone, and a comment cannot fail: when the merge left these runs at a quarter of
   an hour of world time, nothing in the row noticed that its valley had no second camp and its sky
   no storm. `want` asserts the sentence, on the save or on the lines after it, so a row that stops
   being the case it was kept for says so. */
const storms = o => o.after.filter(e => /storm rolls in|Sleet drives/.test(e.text)).length;
const spears = snap => snap.camps.reduce((n, c) => n + (c.tools.spear || 0), 0) + snap.items.filter(i => i.kind === 'spear').length;
const CASES = [
  /* Seed r, day 7.06: 9 people walking, 30 at work. A storm rolls in at tick 651,420 and the camp
     founds a second between 700,000 and 705,000, so 100,000 steps after the save hold both. */
  ['r', 610000, 100000, {}, o => {
    assert.ok(storms(o) > 0, 'no storm rolled in after the load, and this row is kept for one');
    assert.ok(o.a.camps.length > 1, 'no second camp was founded after the load, and this row is kept for that');
  }],
  /* Seed x, day 4.51: 3 walking, 29 at work. Storms roll in at 419,220 and at 633,060, so 250,000
     steps after the save hold the two this row was kept for. */
  ['x', 390000, 250000, {}, o => {
    assert.ok(storms(o) >= 2, `only ${storms(o)} storm(s) after the load, and this row is kept for two`);
  }],
  /* Seed gamma, day 8.04, the first sample at which it is the grown valley this row names: two
     camps, two huts and a spear, with 2 walking and 8 at work. */
  ['gamma', 695000, ticks(2000), {}, o => {
    assert.ok(o.snap.camps.length > 1, 'this row is kept for a valley of two camps');
    assert.ok(o.snap.camps.some(c => c.huts.length), 'this row is kept for a valley with huts in it');
    assert.ok(spears(o.snap) > 0, 'this row is kept for a valley that has made a spear');
  }],
  /* Seed alpha small, day 8.04: two camps, four snares and two pitfalls in the ground, 1 walking and
     8 at work. */
  ['alpha', 695000, ticks(3000), SMALL, o => {
    assert.ok(o.snap.camps.length > 1, 'this row is kept for a small valley of two camps');
    assert.ok(o.snap.camps.some(c => c.snares.length), 'this row is kept for snares in the ground');
    assert.ok(o.snap.camps.some(c => c.pitfalls.length), 'this row is kept for pitfalls in the ground');
  }],
];
for (const [seed, N, M, opts, want] of CASES)
  test(`seed ${seed}: saved on day ${(N / DAY).toFixed(1)}, loaded, and run on, the story is the straight run's`, t => {
    const o = oracle(seed, N, M, opts);
    t.diagnostic(`${seed}: ${o.midTask} walking, ${o.working} at work, ${o.a.camps.length} camps, ${storms(o)} storm(s) and ${o.after.length} lines after the save`);
    sameStory(o);
    want(o);
  });

/* A burning world. Every soak seed has fireCount 0 at the save, so the fire path would go untested:
   spreadFire walks the surface and then `raised`, and draws from rng for each tile beside a burning
   one. The woods are lit through the door, before the save, so the loaded world inherits the fire. */
function lightTheWoods(a, ca, N){
  const trees = a.world.filter(t => t.feature === 'tree' && t.fire === 0);
  const high = a.raised.filter(t => t.fire === 0 && (t.feature === 'tree' || t.feature === 'hollow' || t.ground === 'grass'));
  assert.ok(trees.length > 6 && high.length > 3, 'this world was meant to have woods and tiles off the surface that burn');
  for (const t of trees.slice(0, 6)) a.inject({ source: 'player', act: 'light', x: t.x, y: t.y, z: 0 });
  for (const t of high.slice(0, 3)) a.inject({ source: 'player', act: 'light', x: t.x, y: t.y, z: t.z });
  /* Long enough for the fire to spread, short enough that it still burns. Sixty ticks was a minute
     and a half of the old day; a minute of world time now lights nothing, so the span converts with
     the sim's own converter and stays the world time it was. The two assertions in the test below
     are what say it landed: fire at the save, and some of it off the surface. */
  const spread = ticks(60);
  runOn(a, N, spread, ca);
  return N + spread;
}
test('a world saved while the woods burn runs on as the straight run does', t => {
  /* Seed r small, saved on day 5.84 with the woods alight. The old 6,000 was day 6 of the old
     clock, and the save point is measured from the same intent: an early valley that is up and
     working, here 505,000 with 2 walking and 22 at work, plus the spread window above. */
  const o = oracle('r', 505000, ticks(3000), SMALL, lightTheWoods);
  const alight = lv => lv.filter(t => t && t.fire > 0).length;
  const offSurface = o.snap.levels.reduce((n, lv, i) => n + (i === o.a.ZOFF ? 0 : alight(lv)), 0);
  t.diagnostic(`fire at the save: ${o.snap.fireCount} tiles, ${offSurface} of them off the surface; grove anger ${JSON.stringify(o.a.groves.map(g => g.anger))}`);
  assert.ok(o.snap.fireCount > 0, 'the fire was out before the save');
  assert.ok(offSurface > 0, 'nothing off the surface was alight, so the raised walk in spreadFire went untested');
  sameStory(o);
});

/* A wolf den dug after the load. digDen reads startRegion through rimExits, and startRegion is a Set
   of about thirty thousand numbers that the save carries whole. A world that digs no den after the
   load would never touch it, and the assertion below says so rather than passing quietly.

   Measured: this small valley digs exactly one new den in thirty days, at tick 1,315,375, day 15.2,
   and three wolves are den-less from day 12 on. The save goes at 1,255,000, day 14.5, where 4 people
   are walking and 43 at work, and 70,000 steps after it hold the dig. The old pair, 6,000 and 2,500,
   was chosen when a den was cleared at 4,994 and dug at 7,994 on the 1,000-tick day; after the merge
   those steps were an hour and a half of world time and no den was dug at all. */
test('a world that digs a wolf den after the load runs on as the straight run does', t => {
  const o = oracle('r', 1255000, 70000, SMALL);
  const dug = o.loaded.filter(e => /dug a new den/.test(e.text));
  t.diagnostic(`${o.denless} wolves were den-less at the save; after the load: ${dug.map(e => e.text).join(' ')}`);
  assert.equal(dug.length, 1, 'no den was dug after the load, so startRegion and rimExits went untested');
  assert.equal(o.b.startRegion.size, o.a.startRegion.size);
  sameStory(o);
});

/* A late save of a world of the default size. The three cases above are early or small, so a grown
   valley with a gnome burrow holding a thing and two camps went untested. */
/* Measured: seed beta has a second camp from tick 760,000, day 8.8, and a burrow holding something
   from 1,005,000, day 11.6. The save goes at 1,010,000, day 11.7, the first sample past both, with
   2 people walking and 10 at work. The old 13,779 was day 13.8 of the 1,000-tick day; after the
   merge it was ten minutes of world time, one camp, and nothing held. */
test('a grown valley of the default size, saved late, runs on as the straight run does', t => {
  const o = oracle('beta', 1010000, ticks(2500), {});
  /* The preconditions are read off the save, not off the world after it ran on: a burrow gives up
     what it holds, and a camp is founded later. */
  const holding = o.snap.caves.filter(c => c.holding).length;
  t.diagnostic(`beta at the save: ${o.snap.camps.length} camps, ${o.snap.caves.length} caves, ${holding} of them holding something, ${o.snap.beings.length} beings`);
  assert.ok(o.snap.camps.length > 1, 'this world was meant to have more than one camp at the save');
  assert.ok(holding > 0, 'no burrow held a thing, so cave.holding went untested');
  sameStory(o);
});

/* ---------- a grove that left its list ----------
   burnOut takes a grove out of `groves` when its hollow pine burns, and the sprites of that grove
   keep pointing at it until the last of them dies. The snapshot names such a grove `{ stray: i }` and
   writes it whole, once, so the sprites that shared it share it still. */
/* The save point the three grove runs share: seed r small at tick 345,000, day 4, where 8 people are
   walking and 28 at work, the first sample of that valley at which the oracle's own precondition is
   comfortably true. The old number was 4,000, day 4 of the 1,000-tick day, so the world is the same
   age it was; the tick is written from the measurement and not from the arithmetic, because the
   arithmetic alone would have landed on 345,600, where nobody is walking. */
function burnAHollow(a, ca, N){
  const hollow = a.levels.flat().filter(t => t && t.feature === 'hollow');
  assert.ok(hollow.length > 0, 'this world was meant to have a hollow pine');
  const t = hollow[0];
  a.inject({ source: 'player', act: 'light', x: t.x, y: t.y, z: t.z });
  const orphaned = () => a.beings.some(b => b.alive && b.grove && !a.groves.includes(b.grove));
  let at = N;
  /* The wait is a span of world time and converts as one: 800 ticks of the old day was a fifth of a
     day, and a pine takes world time to burn through whatever the day is worth in ticks. The
     assertion under the loop is what says the wait was long enough. */
  const wait = ticks(800);
  for (let i = 0; i < wait && !orphaned(); i++){ runOn(a, at, 1, ca); at++; }
  assert.ok(orphaned(), 'the hollow never burned out under a living sprite, so the stray path went untested');
  return at;
}
test('a world whose hollow pine burned out under its sprites saves, loads, and runs on', t => {
  const o = oracle('r', 345000, ticks(1500), SMALL, burnAHollow);
  t.diagnostic(`${o.snap.strayGroves.length} stray grove(s) in the save; ${o.b.groves.length} groves left in the world`);
  assert.ok(o.snap.strayGroves.length > 0, 'the save was meant to hold a grove that is in no list');
  /* Several sprites can share one dead grove, and the rules compare `o.grove === g`. */
  const strays = o.b.beings.filter(b => b.grove && !o.b.groves.includes(b.grove)).map(b => b.grove);
  assert.ok(strays.length > 0);
  assert.equal(new Set(strays).size, new Set(o.a.beings.filter(b => b.grove && !o.a.groves.includes(b.grove)).map(b => b.grove)).size,
    'one stray grove in the saved world must be one stray grove in the loaded one');
  sameStory(o);
});

/* A stray grove carries an old name: `nameTheLand` names every grove there is. The index must still
   hold that text after a load, and hold it against the one object the sprites share, or a later
   naming would hand the dead grove's name to something else. */
test('a grove that burnt out under its sprites keeps its name, held against the grove the sprites share', t => {
  const o = oracle('r', 345000, ticks(1500), SMALL, burnAHollow);
  const strays = w => [...new Set(w.beings.filter(b => b.grove && !w.groves.includes(b.grove)).map(b => b.grove))];
  const was = o.a, api = o.b, sa = strays(was), sb = strays(api);
  const texts = sa.flatMap(g => (g.names || []).map(r => r.text));
  t.diagnostic(`${sa.length} stray grove(s), named ${texts.join(', ') || 'nothing'}`);
  assert.ok(texts.length > 0, 'the stray grove was meant to carry an old name');
  assert.equal(sb.length, sa.length);
  for (const text of texts){
    assert.equal(api.nameTaken(text), true, text);
    assert.deepEqual(api.nameRecordOf(text), was.nameRecordOf(text), text);
    assert.ok(sb.includes(api.nameIndex.get(text.toLowerCase())), `${text} must still name the grove the sprites share`);
    /* And so a later naming cannot take it: a candidate another thing owns scores zero. */
    const score = w => w.scoreCandidates([{ text, axis: 'land', base: 30 }], null, w.camps[0])[0].score;
    assert.equal(score(api), 0, text); assert.equal(score(was), 0, text);
  }
});
/* The end of that grove: the last sprite of it dies, the prune drops the dead from `beings`, and then
   no list and no being holds the grove at all. Only the name index still points at it, and the text
   stays taken. The grove itself holds its cave, and the cave holds its tiles, which point back at the
   cave, so a snapshot that saved the thing would walk a cycle. */
function burnAndEmptyAGrove(a, ca, N){
  let at = burnAHollow(a, ca, N);
  const stray = a.beings.filter(b => b.alive && b.grove && !a.groves.includes(b.grove))[0].grove;
  for (const b of a.beings) if (b.alive && b.grove === stray) a.die(b, 'went out with the grove');
  for (let i = 0; i < ticks(4000) && a.beings.some(b => b.grove === stray); i++){ runOn(a, at, 1, ca); at++; }
  assert.ok(!a.beings.some(b => b.grove === stray), 'the dead sprites were meant to be pruned out of beings');
  assert.ok(!a.groves.includes(stray), 'the grove was meant to be in no list');
  assert.ok(a.nameOf(stray), 'the grove was meant to carry a name');
  return at;
}
test('a named grove that no list and no being holds any more saves, loads, and keeps its text taken', t => {
  const o = oracle('r', 345000, ticks(1200), SMALL, burnAndEmptyAGrove);
  const was = o.a, api = o.b;
  const lost = o.snap.lostNames.flatMap(h => h.names.map(r => r.text));
  t.diagnostic(`${o.snap.lostNames.length} name(s) the index alone holds: ${lost.join(', ')}`);
  assert.ok(lost.length > 0, 'the save was meant to hold a name no thing of it accounts for');
  assert.equal(o.snap.strayGroves.length, 0, 'no being holds the grove any more, so no stray is saved');
  assert.deepEqual(o.snap.lostNames.map(h => Object.keys(h)), o.snap.lostNames.map(() => ['names']),
    'a name the index alone holds is saved as its records, never as the thing');
  for (const text of lost){
    assert.equal(api.nameTaken(text), true, text);
    assert.deepEqual(api.nameRecordOf(text), was.nameRecordOf(text), text);
    const score = w => w.scoreCandidates([{ text, axis: 'land', base: 30 }], null, w.camps[0])[0].score;
    assert.equal(score(api), 0, text); assert.equal(score(was), 0, text);
  }
  sameStory(o);
});
/* The grove of the run above holds no cave, so the worst of saving the thing did not show there. A
   grove that holds one drags in a cycle: the cave holds its tiles, and each tile points back at the
   cave. This hangs that shape on a world by hand, as the guard tests above hang a Map on a being. */
test('a name the index alone holds is saved as its name records, never as the thing', () => {
  const a = load(); a.startWorld('r', SMALL); for (let i = 0; i < ticks(200); i++) a.step();
  const g = a.groves[0];
  assert.ok(g && a.nameOf(g), 'a grove was meant to carry an old name');
  assert.ok(a.caves.length, 'this world was meant to have a cave');
  g.cave = a.caves[0];
  a.groves.splice(a.groves.indexOf(g), 1);
  for (const b of a.beings) if (b.grove === g) b.grove = null;
  const snap = through(a.takeSnapshot());
  assert.deepEqual(snap.lostNames.map(h => Object.keys(h)), [['names']]);
  const api = load();
  assert.equal(api.loadSnapshot(snap), null);
  assert.equal(api.nameTaken(a.nameOf(g)), true);
  assert.deepStrictEqual(through(api.takeSnapshot()), snap);
});

/* ---------- the names ----------
   The naming work hung state on the world the snapshot had to learn: the name stream, the lore, the
   valley, the water, the ponds, the crossings, a name record on every thing that has a name, and an
   epithet on a person. The index from a text to the thing that holds it is derived, so the loader
   rebuilds it, and these tests hold the rebuilt one to the live one. */

/* Every name the world holds, in a shape two worlds can be compared by. `nameThings` gives the same
   list in the same order in both, so a thing is named by its place in it, and a named event by its
   place in the chronicle. The index is compared sorted, because what it must give back is the same
   thing for the same text, not the same order of insertion. */
function nameState(api){
  const things = api.nameThings(), lines = api.chronicle;
  const where = t => { const i = things.indexOf(t); return i >= 0 ? 'thing ' + i : 'line ' + lines.indexOf(t); };
  const recs = t => (t.names || []).map(r => [r.text, r.tongue, r.meaning, r.since, r.by, r.why, JSON.stringify(r.scores)].join('|'));
  return {
    stream: api.streamState(api.nrng),
    lore: api.lore, tongue: api.tongue,
    valley: api.nameOf(api.valley),
    things: things.map(t => [api.nameOf(t), t.nameKnown === undefined ? 'plain' : String(t.nameKnown), ...recs(t)].join(' / ')),
    events: lines.filter(e => e.names).map(e => where(e) + ' ' + recs(e).join(' / ')),
    index: [...api.nameIndex].map(([k, t]) => k + ' -> ' + where(t) + ' = ' + api.nameOf(t)).sort(),
    epithets: api.beings.map(b => [b.epithet || '', ...(b.epithets || []).map(r => r.text)].join('|')),
  };
}
/* Measured, in the order the kinds of name arrive in the small valley of seed alpha: a sector on day
   0.06, the water from the moment the land is made, a camp's former name on day 3.6, a named
   chronicle line on day 5.6, the valley and its first village together at tick 1,430,000, day 16.6,
   and last of all a name the index alone holds, at tick 1,540,000, day 17.8, when the chronicle drops
   the named line off the end of the three hundred it keeps. The save goes at 1,545,000, just past the
   last of them, because this test asks for every kind at once. The old 23,000 was day 23 of the
   1,000-tick day; after the merge it was a quarter of an hour, the valley had no name, and the test
   threw on the `undefined` where that name should have been. */
test('a world with every kind of name, saved, loaded, and run on, names as the straight run does', t => {
  const o = oracle('alpha', 1545000, ticks(1500), SMALL);
  const snap = o.snap;
  t.diagnostic(`at the save: the valley is ${snap.valley.names[0].text}, ${snap.sectors.filter(s => s.names && s.names.length).length} sector(s) named, ${snap.lostNames.length} name(s) the index alone holds, ${snap.nrng} in the name stream`);
  /* What the save was picked for. Each is read off the save itself. */
  assert.ok(snap.valley.names.length, 'the valley was meant to have a name at the save');
  assert.ok(snap.camps.some(c => c.villageNamed), 'a village was meant to have named itself');
  assert.ok(snap.camps.some(c => c.names && c.names.length > 1), 'a camp was meant to carry a former name');
  assert.ok(snap.sectors.some(s => s.names && s.names.length), 'a sector was meant to be named');
  assert.ok(snap.lines.some(e => e.names && e.names.length), 'an event was meant to be named');
  assert.ok(snap.beings.some(b => b.epithet), 'somebody was meant to carry an epithet');
  assert.ok(snap.stillWater && snap.stillWater.names.length, 'the water was meant to carry an old name');
  assert.ok(snap.lostNames.length > 0, 'the chronicle was meant to have dropped a line that only the index still holds');
  assert.equal(typeof snap.nrng, 'number');
  sameStory(o);
  /* And the names themselves, once both worlds have run on. */
  assert.deepEqual(nameState(o.b), nameState(o.a));
  /* The rebuilt index answers for every text, the former ones with it. */
  const was = o.a, api = o.b;
  const texts = was.nameThings().flatMap(x => (x.names || []).map(r => r.text));
  assert.ok(texts.length > 10);
  for (const text of texts){
    assert.equal(api.nameTaken(text), true, text);
    assert.deepEqual(api.nameRecordOf(text), was.nameRecordOf(text), text);
  }
  const former = was.camps.flatMap(c => was.formerNames(c)).map(r => r.text);
  assert.ok(former.length > 0, 'a camp was meant to carry a former name');
  for (const text of former) assert.equal(api.nameTaken(text), true, text);
  /* The water comes back as the one record its tiles point at. */
  assert.ok(was.world.filter(t => t.water).length > 100);
  assert.equal(api.world.filter(t => t.water).length, was.world.filter(t => t.water).length);
  for (const t of api.world) if (t.water) assert.equal(t.water, api.stillWater);
  assert.equal(api.lore.unknown, was.lore.unknown);
});
/* The other end: a world saved on the day it was made. The land carries its old names, and nobody
   living has named anything yet. The default size of seed alpha is the one world with a river, a
   crossing, and ponds in it, so its tiles are the ones that point at all three kinds of water. */
test('a world saved before anybody living has named a thing round-trips whole', () => {
  const was = load(); was.startWorld('alpha');
  assert.equal(was.nameOf(was.valley), null, 'the valley was meant to have no name yet');
  assert.ok(was.camps.every(c => !c.names || !c.names.length), 'no camp was meant to be named yet');
  assert.ok(was.river && was.fords.length && was.ponds.length, 'this world was meant to have a river, a crossing, and a pond');
  const api = load();
  assert.equal(api.loadSnapshot(through(was.takeSnapshot())), null);
  assert.deepStrictEqual(through(api.takeSnapshot()), through(was.takeSnapshot()));
  assert.deepEqual(nameState(api), nameState(was));
  /* Every water tile, every pond tile, and the crossing point at the one record they did. */
  for (const t of api.world) if (t.water) assert.equal(t.water, api.river);
  for (const p of api.ponds){ assert.ok(p.tiles.length); for (const t of p.tiles) assert.equal(t.pond, p); }
  for (const f of api.fords) assert.equal(api.world[f.y * api.W + f.x].ford, f);
  /* And it names things from there as the straight run does. */
  const named = w => w.nameThings().filter(x => w.nameOf(x)).length;
  const before = named(api);
  for (let i = 0; i < ticks(4000); i++){ was.step(); api.step(); }
  assert.deepEqual(nameState(api), nameState(was));
  assert.ok(named(api) > before, `nothing was named after the load: ${named(api)} things named, as before`);
});
/* The versioning policy again: a save written before the naming work holds none of these fields, and
   the loader seeds the name stream as a fresh world does. Such a save names no water, no pond, and no
   crossing, so no tile of it points at one.
   G4 task 1 rebased this test from version 1 to version 2. The version rose because the meaning of
   `tick` changed, so a version 1 save is now refused outright, which the refusal test below asserts.
   What this test is about is not the number: it is that the decoder tolerates a save missing fields
   added after it was written. That policy did not change with the version, so the test follows the
   version up rather than being deleted with it. */
test('a save written before the names loads, and the world starts its names afresh', () => {
  const api = load(), old = through(lateWorld().takeSnapshot());
  for (const k of ['nrng', 'lore', 'tongue', 'valley', 'river', 'stillWater', 'ponds', 'fords']) delete old[k];
  for (const lv of old.levels) for (const t of lv){ if (!t) continue; delete t.water; delete t.pond; delete t.ford; }
  for (const list of ['hills', 'caves', 'sectors', 'groves', 'camps', 'beings', 'lines'])
    for (const r of old[list]){ delete r.names; delete r.nameKnown; delete r.epithet; delete r.epithets; }
  assert.equal(old.version, api.SNAPSHOT_VERSION);
  assert.equal(api.loadSnapshot(old), null);
  assert.equal(api.lore, null);
  assert.equal(api.nameOf(api.valley), null);
  assert.equal(api.river, null); assert.equal(api.stillWater, null);
  assert.deepEqual(api.ponds, []); assert.deepEqual(api.fords, []);
  assert.equal(api.nameIndex.size, 0);
  assert.equal(api.usedMeanings.size, 0);
  assert.equal(typeof api.streamState(api.nrng), 'number');
  /* Minor 22: a fifth of a world day says that a world loaded with no names runs on and names again.
     The index starts empty above and holds something here, so the run is doing the work.
     This was two hundred ticks of the old 1000-tick day. Two hundred ticks of the G4 day is three
     minutes of world time, and the naming pass runs once a night, so the run never reached one and
     the world named nothing. The span converts; the assertion does not change. */
  const span = api.ticks(200);
  for (let i = 0; i < span; i++) api.step();
  assert.ok(api.nameIndex.size > 0, `the loaded world named nothing in ${span} ticks, a fifth of a world day`);
});

/* Minor 15: TILE_DEFAULTS is the shape every fresh tile starts in, and `makeTile` and the decoder
   both read it. The naming work gave a tile three new fields and left them out, so a water tile
   carried a different shape from a dry one. The fields listed here are the ones a painter or a
   rule hangs on some tiles only, and never on a fresh one; anything else must join the table. */
const TILE_EXTRAS = ['country', 'river', 'planted', 'loose', 'shrooms'];
test('TILE_DEFAULTS names every field a fresh tile has, the three naming fields among them', () => {
  const api = load(); api.startWorld('alpha');
  const base = new Set(['x', 'y', 'z', 'ground', ...Object.keys(api.TILE_DEFAULTS), ...TILE_EXTRAS]);
  const seen = new Set();
  for (const t of api.world) for (const k in t) seen.add(k);
  assert.ok(seen.size > 8, `a tile carries only ${[...seen].join(', ')}`);
  for (const k of seen) assert.ok(base.has(k), `a tile carries ${k}, which TILE_DEFAULTS does not name`);
  for (const k of ['water', 'pond', 'ford']) assert.ok(k in api.TILE_DEFAULTS, `TILE_DEFAULTS omits ${k}`);
  /* Every tile of a fresh seed carries the whole table, so no two tiles differ in shape. */
  for (const t of api.world) for (const k in api.TILE_DEFAULTS) assert.ok(k in t, `a tile has no ${k}`);
});

/* ---------- Become ----------
   The player can be a god, and the days era keeps that: `inhabited` and `inhabitedTold` are saved.
   Nothing else of the ages is. A load resets the four ages-only names, so a save loaded while a
   god's turn is open leaves no turn standing. */

/* A creation the player steers: they take the first awake god, choose for it a few times, then let
   it run on alone to the valley. */
function steeredWorld(seed = 'gamma', turns = 3){
  const api = load(); api.startCreation(seed, {});
  api.step();
  const g = api.awakeGods()[0];
  assert.equal(api.inject({ source: 'player', act: 'become', id: g.id }), `You are ${g.name}, ${g.epithet}.`);
  let taken = 0;
  for (let n = 0; api.era === 'gods' && n < 4000; n++){
    if (!api.pending){ api.step(); continue; }
    if (taken < turns){ const o = api.pending.opts[0]; api.inject({ source: 'player', act: 'choose', opt: { type: o.type, region: o.region } }); taken++; continue; }
    api.inject({ source: 'player', act: 'run', what: 'age', at: 2 * api.options.ageLimit + 1 });
  }
  assert.equal(api.era, 'days', 'the steered creation was meant to reach the valley');
  assert.ok(taken > 0, 'the player was meant to take at least one turn');
  return api;
}

test('a steered creation makes a world the guard finds nothing in, and it round-trips whole', t => {
  const was = steeredWorld();
  t.diagnostic(`${was.creation.choices.length} choices kept, ${was.creation.choices.filter(c => c.byPlayer).length} of them the player's`);
  assert.ok(was.creation.choices.some(c => c.byPlayer), 'the record was meant to hold a choice the player made');
  assert.deepEqual(was.unnamedRefs(), [], 'creation.choices must be plain data');
  assert.ok(was.inhabited && typeof was.inhabited.id === 'number', 'the player is still the god in the days');
  const api = load();
  assert.equal(api.loadSnapshot(through(was.takeSnapshot())), null);
  assert.deepEqual(api.inhabited, was.inhabited);
  assert.deepStrictEqual(through(api.takeSnapshot()), through(was.takeSnapshot()));
});
test('an unwatched creation leaves the guard nothing to say either', () => {
  const plain = load(); plain.startWorld('gamma');
  assert.deepEqual(plain.unnamedRefs(), []);
});
test('a save carries who the player is and whether they have been told', () => {
  const api = load(), good = through(lateWorld().takeSnapshot());
  const marked = { ...good, inhabited: { id: 7, mode: 'become' }, inhabitedTold: true };
  assert.equal(api.loadSnapshot(marked), null);
  assert.deepEqual(api.inhabited, { id: 7, mode: 'become' });
  assert.equal(api.inhabitedTold, true);
  const back = api.takeSnapshot();
  assert.deepEqual(back.inhabited, marked.inhabited);
  assert.equal(back.inhabitedTold, true);
});
/* The versioning policy: a field added after the current version is read as optional, with the value
   a world that never had it holds. The version does not rise for a new field, so a rebuilt page does
   not refuse every autosave. It rises only when a saved field changes meaning, as `tick` did in G4. */
test('a save written before Become loads, and the player is nobody', () => {
  const api = load(), old = through(lateWorld().takeSnapshot());
  delete old.inhabited; delete old.inhabitedTold; delete old.strayGroves;
  assert.equal(old.version, api.SNAPSHOT_VERSION);
  assert.equal(api.loadSnapshot(old), null);
  assert.equal(api.inhabited, null);
  assert.equal(api.inhabitedTold, false);
});
test('a load while a god\'s turn is open leaves no turn standing, and the world steps', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  api.inject({ source: 'player', act: 'become', id: g.id });
  for (let n = 0; !api.pending && n < 200; n++) api.step();
  assert.ok(api.pending, 'a turn was meant to be open');
  assert.equal(api.step(), 'The turn is yours.');
  const answer = api.inject({ source: 'player', act: 'load', snapshot: through(lateWorld().takeSnapshot()) });
  assert.match(answer, /^The world is as it was/);
  assert.equal(api.pending, null);
  assert.equal(api.agePos, null);
  assert.equal(api.runUntil, null);
  assert.deepEqual(api.stops, []);
  const was = api.tick; api.step();
  assert.equal(api.tick, was + 1, 'the loaded world must step');
});
test('a world made with forced acts round-trips, and the option comes back', () => {
  const was = load(); was.startWorld('alpha', { sw: 8, sh: 5, force: true });
  for (let i = 0; i < ticks(2000); i++) was.step();
  assert.equal(was.options.force, true);
  const api = load();
  assert.equal(api.loadSnapshot(through(was.takeSnapshot())), null);
  assert.equal(api.options.force, true);
  assert.deepStrictEqual(through(api.takeSnapshot()), through(was.takeSnapshot()));
});

/* ---------- what the guard now catches ----------
   Each case hangs a reference, a Map, a Set, or a class instance on a live world, and the guard must
   name it. The encoder turns a Map or a Set into {}, and a round trip then agrees because both sides
   lost it, so nothing but the guard can catch those two. */
test('the guard names a Map, a Set, and anything that is not plain data', () => {
  const cases = {
    'a Map on a being':          (a, out) => { a.beings[0].seen = new Map([['a', a.camps[0]]]); out.push('being.seen -> a Map or a Set, which a snapshot cannot hold'); },
    'a Set on a being':          (a, out) => { a.beings[0].seen = new Set([a.camps[0]]); out.push('being.seen -> a Map or a Set, which a snapshot cannot hold'); },
    'a Map of numbers':          (a, out) => { a.beings[0].tally = new Map([['wolf', 3]]); out.push('being.tally -> a Map or a Set, which a snapshot cannot hold'); },
    'a class instance':          (a, out) => { class Box { constructor(c){ this.c = c; } } a.beings[0].box = new Box(a.camps[0]); out.push('being.box -> not plain data, which a snapshot cannot hold'); },
    'a typed array':             (a, out) => { a.beings[0].seen = new Int32Array(4); out.push('being.seen -> not plain data, which a snapshot cannot hold'); },
  };
  for (const name in cases){
    const a = load(); a.startWorld('r', { sw: 8, sh: 5 }); for (let i = 0; i < ticks(200); i++) a.step();
    const want = [];
    cases[name](a, want);
    assert.deepEqual(a.unnamedRefs(), want, name);
  }
});
test('the guard walks every saved global, not only creation and the field', () => {
  const cases = {
    'on weather':      (a, out) => { a.weather.blamed = a.camps[0]; out.push('weather.blamed -> camp'); },
    'on a corpse':     (a, out) => { a.corpses.push({ x: 1, y: 1, z: 0, name: 'X', by: a.camps[0] }); out.push('corpses.[].by -> camp'); },
    'on goalPriority': (a, out) => { a.goalPriority.blamed = a.camps[0]; out.push('goalPriority.blamed -> camp'); },
    'on inhabited':    (a, out) => { a.loadSnapshot({ ...through(a.takeSnapshot()), inhabited: { id: 1, mode: 'become' } }); a.inhabited.on = a.camps[0]; out.push('inhabited.on -> camp'); },
    'in a resCache value': (a, out) => { a.resCache.set('made up', { home: a.camps[0] }); out.push('resCache.[made up].home -> camp'); },
  };
  for (const name in cases){
    const a = load(); a.startWorld('r', { sw: 8, sh: 5 }); for (let i = 0; i < ticks(200); i++) a.step();
    const want = [];
    cases[name](a, want);
    assert.deepEqual(a.unnamedRefs(), want, name);
  }
});

/* ---------- a save file is outside data ----------
   A refusal is enough when the save is merely wrong. These are the ones that loaded and then killed
   the page a step later, so the loader must refuse each in the stage. */
test('a save that would kill the page a step later is refused, and the world stays as it was', () => {
  const was = load(); was.startWorld('r', { sw: 8, sh: 5 }); for (let i = 0; i < ticks(2000); i++) was.step();
  const good = through(was.takeSnapshot());
  const spoil = {
    'a species no table knows':  s => { s.beings[0].species = 'elf'; },
    'a ground no table knows':   s => { const i = s.levels[was.ZOFF].findIndex(t => t); s.levels[was.ZOFF][i].ground = 'zzz'; },
    'a tile with no ground':     s => { const i = s.levels[was.ZOFF].findIndex(t => t); delete s.levels[was.ZOFF][i].ground; },
    'a feature no table knows':  s => { const i = s.levels[was.ZOFF].findIndex(t => t); s.levels[was.ZOFF][i].feature = 'zzz'; },
    'an item kind no table knows': s => { s.items[0].kind = 'zzz'; },
    'a camp with no stash':      s => { s.camps[0].stash = null; },
    'a camp with no fae':        s => { s.camps[0].fae = null; },
    'a camp with no tools':      s => { s.camps[0].tools = null; },
    'a fire pit off the map':    s => { s.camps[0].pit = [1e9, 1e9]; },
    'a region tile past the end': s => { s.field.regions[0].tiles = [...s.field.regions[0].tiles, 99999999]; },
    'a region tile below zero':  s => { s.field.regions[0].tiles = [-5]; },
    'a tick below zero':         s => { s.tick = -1; },
    'a tick that is no integer': s => { s.tick = 1.5; },
    'a tick past what adds up':  s => { s.tick = 1e18; },
    'a nextId below zero':       s => { s.nextId = -3; },
    'a name stream that is no number': s => { s.nrng = null; },
    'a lost name that is no list': s => { s.lostNames = [{ names: 'no' }]; },
  };
  for (const name in spoil){
    const api = load(); api.startWorld('x', { sw: 8, sh: 5 });
    const before = JSON.stringify(api.takeSnapshot());
    const s = through(good); spoil[name](s);
    assert.equal(typeof api.loadSnapshot(s), 'string', name);
    assert.equal(JSON.stringify(api.takeSnapshot()), before, name);
    assert.equal(typeof api.lastLoadFault === 'string' || api.lastLoadFault === null, true);
  }
  /* The good save still loads, so the checks above refuse nothing a real world writes. */
  const api = load();
  assert.equal(api.loadSnapshot(through(good)), null);
  for (let i = 0; i < ticks(200); i++) api.step();
});
/* A version 1 save is refused, and this is the test that says so. G4 task 1 made a tick 86.4 world
   seconds, so a version 1 save holds a tick and every stamp beside it meaning 86.4 times less. No
   per-field default rescues that, so the save is refused whole rather than read wrong. */
test('the version refusal names both versions, and a version that is no number says so plainly', () => {
  const api = load(), good = through(lateWorld().takeSnapshot());
  assert.equal(api.SNAPSHOT_VERSION, 2);
  assert.equal(api.loadSnapshot({ ...good, version: 1 }), 'This save is version 1. This world reads version 2.');
  assert.equal(api.loadSnapshot({ ...good, version: 3 }), 'This save is version 3. This world reads version 2.');
  assert.equal(api.loadSnapshot({ ...good, version: '2' }), 'This file is not a save this world can read.');
  assert.equal(api.loadSnapshot({ ...good, version: null }), 'This file is not a save this world can read.');
});
test('a refused load keeps the reason it threw, and a load that lands clears it', () => {
  const api = load(); api.startWorld('x', { sw: 8, sh: 5 });
  const good = through(lateWorld().takeSnapshot());
  assert.equal(api.loadSnapshot({ ...good, caves: 'no' }), 'This save cannot be read.');
  assert.equal(typeof api.lastLoadFault, 'string');
  assert.ok(api.lastLoadFault.length > 3);
  assert.equal(api.loadSnapshot(good), null);
  assert.equal(api.lastLoadFault, null);
});

/* ---------- the lints ----------
   Every piece of top-level state is either saved or listed with the reason it is not. A new `let`,
   `var`, or mutable `const` in the sim fails a lint here until someone decides which list it is in.

   The scanner reads the whole file text, not line by line, so a second declaration on one line, a
   declarator on a continued line, a tab after the keyword, and a destructuring pattern are all seen.
   Comments, strings, and regular expressions are blanked first, so a keyword inside one is not read
   as code. Top level means depth zero of every bracket. */
function stripCode(src){
  let out = '', i = 0, prev = '';
  const n = src.length;
  while (i < n){
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/'){ while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*'){ i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`'){ i++; while (i < n && src[i] !== c){ if (src[i] === '\\') i++; i++; } i++; out += '""'; prev = '"'; continue; }
    /* A slash after a value divides. A slash after an operator, a comma, or an opening bracket opens
       a regular expression, which can hold a brace or a quote that would throw the depth off. */
    if (c === '/' && (prev === '' || '=(,:[!&|?{};+-*%<>~^'.includes(prev))){
      i++;
      let inClass = false;
      while (i < n && (inClass || src[i] !== '/')){ if (src[i] === '\\') i++; else if (src[i] === '[') inClass = true; else if (src[i] === ']') inClass = false; i++; }
      i++; while (i < n && /[a-z]/.test(src[i])) i++;
      out += '0'; prev = '0'; continue;
    }
    out += c; if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}
/* The names one declarator binds. A plain name is itself. A pattern gives every name it binds, and a
   key before a colon is not one of them. */
function namesIn(text){
  const t = text.trim();
  if (!/^[{[]/.test(t)){ const m = t.match(/^[A-Za-z_$][\w$]*/); return m ? [m[0]] : []; }
  const out = [];
  let key = false;
  for (const m of t.matchAll(/([A-Za-z_$][\w$]*)(\s*:)?/g)){
    if (key){ out.push(m[1]); key = !!m[2]; continue; }
    if (m[2]){ key = true; continue; }
    out.push(m[1]);
  }
  return out;
}
/* Every top-level declaration of one of the keywords, with the text of its initialiser. */
function declarations(src, words){
  const code = stripCode(src), out = [];
  let depth = 0, i = 0;
  while (i < code.length){
    const c = code[i];
    if ('{(['.includes(c)){ depth++; i++; continue; }
    if ('})]'.includes(c)){ depth--; i++; continue; }
    if (!/[A-Za-z_$]/.test(c)){ i++; continue; }
    const word = code.slice(i).match(/^[A-Za-z_$][\w$]*/)[0];
    const before = i === 0 ? '' : code[i - 1];
    if (depth !== 0 || !words.includes(word) || /[\w$.]/.test(before)){ i += word.length; continue; }
    /* The declarator list runs to the first semicolon at the depth the keyword stands at. */
    let j = i + word.length, d = 0, part = '';
    const take = () => {
      const eq = part.indexOf('='), head = eq < 0 ? part : part.slice(0, eq), init = eq < 0 ? '' : part.slice(eq + 1);
      for (const n of namesIn(head)) out.push({ name: n, init: init.trim() });
      part = '';
    };
    for (; j < code.length; j++){
      const ch = code[j];
      if ('{(['.includes(ch)) d++; else if ('})]'.includes(ch)) d--;
      if (ch === ';' && d === 0) break;
      if (ch === ',' && d === 0) take(); else part += ch;
    }
    take();
    i = j + 1;
  }
  return out;
}
/* A top-level const that holds a container. Whether the sim writes into it is decided by reading. */
function isContainer(init){ return /^(\{|\[|new Map\(|new Set\(|Object\.create\()/.test(init); }
const simSource = f => fs.readFileSync(path.join(__dirname, '..', 'src', 'sim', f + '.js'), 'utf8');
function declaredIn(words){
  const out = [];
  for (const f of FILES) for (const d of declarations(simSource(f), words)) out.push({ ...d, file: f });
  return out;
}

test('the declaration scanner sees every shape a declaration takes', () => {
  const names = src => declarations(src, ['let', 'var']).map(d => d.name);
  assert.deepEqual(names('let tier = 0;'), ['tier']);
  assert.deepEqual(names('let tier = 0, queue = [];'), ['tier', 'queue']);
  assert.deepEqual(names('let tier = 0; let queue = [];'), ['tier', 'queue']);
  assert.deepEqual(names('let tier = 0,\n    queue = [];'), ['tier', 'queue']);
  assert.deepEqual(names('let\ttier = 0;'), ['tier']);
  assert.deepEqual(names('let  tier = 0;'), ['tier']);
  assert.deepEqual(names('var tier = 0;'), ['tier']);
  assert.deepEqual(names('let tier;'), ['tier']);
  assert.deepEqual(names('let { tier, queue } = start();'), ['tier', 'queue']);
  assert.deepEqual(names('let { tier: rank } = start();'), ['rank']);
  assert.deepEqual(names('let [head, tail] = start();'), ['head', 'tail']);
  /* Not top-level declarations: inside a block, a comment, a string, or a regular expression. */
  assert.deepEqual(names('function f(){ let inner = 1; }'), []);
  assert.deepEqual(names('/* let ghost = 1; */'), []);
  assert.deepEqual(names('const s = "let ghost = 1;";'), []);
  assert.deepEqual(names('const re = /let \\{ghost}/; let tier = 0;'), ['tier']);
  assert.deepEqual(names('outlet = 1;'), []);
});
test('the container scanner sees a full container and every name of a multi-name const', () => {
  const found = src => declarations(src, ['const']).filter(d => isContainer(d.init)).map(d => d.name);
  assert.deepEqual(found('const COUNTS = {};'), ['COUNTS']);
  assert.deepEqual(found('const COUNTS = { wolves: 0 };'), ['COUNTS']);
  assert.deepEqual(found('const COUNTS = new Map([["a", 1]]);'), ['COUNTS']);
  assert.deepEqual(found('const COUNTS = Object.create(null);'), ['COUNTS']);
  assert.deepEqual(found('const COUNTS = new Map(), SEEN = new Set();'), ['COUNTS', 'SEEN']);
  assert.deepEqual(found('const QUEUE =  [];'), ['QUEUE']);
  assert.deepEqual(found('const near = (a, b) => a - b;'), []);
  assert.deepEqual(found('const DAY = 24;'), []);
});

/* The containers the sim writes into, each with the reason it is not world state. Each write was
   found by grep for `NAME.x =`, `NAME[...] =`, a list method on it, and `Object.assign(NAME`. */
const KNOWN_CONSTS = {
  TASKS: 'a table, filled at load time', POLES: 'a table, filled at load time', REF_PLAN: 'a table, filled at load time',
  GOALS: 'a table, filled at load time by recipes.js', SPECIES: 'a table, the god row added at load time',
  LIFE: 'a table, the god row added at load time',
  bfsOut: 'search scratch',
  /* G4 task 2. The tick each cellular system next runs on, and counters for the tests. No rule reads
     it, so it is not saved: a loaded world refills it on its first beat, and `resetBeats` empties and
     refills the same object rather than reassigning it, because the manifest takes the API's
     references once at load. */
  beats: 'the cellular beats, rebuilt by resetBeats at every world start',
};
/* The containers nothing writes into after load time. Each was checked by the same grep, and none of
   them was hit. A table needs no reason beyond being a table, so this is a list of names. */
const FROZEN_TABLES = new Set(['SEASON_LENGTHS', 'DIRS', 'RING', 'NEAR', 'AROUND', 'DEFAULT_OPTIONS', 'MATERIALS', 'GROUND', 'FEATURES',
  'ITEMS', 'BIOMES', 'TILE_DEFAULTS', 'STAGES', 'SEASONS', 'CLOCK', 'CONTRASTS', 'INHERITED', 'BIOME_OF', 'GROWS',
  'NAMES', 'GATHERERS', 'RECIPES', 'PLACES', 'MAKERS', 'GOD_NAMES', 'EPITHET', 'BODY', 'LEAVES', 'SCAR_OF', 'MAKES',
  'KINDS', 'STRAIN', 'GOD_ACTS', 'GOD_BARS', 'SCAR_PAINTERS', 'SPAWN', 'REFS', 'REF_HOMES', 'REF_DERIVED', 'REF_KINDS',
  'SAVED_STATE', 'NOT_SAVED', 'WALK_HOME', 'DOOR_SOURCES', 'DOOR_ACTS',
  /* G4 task 2: the names of the systems that run on the cellular beat. Read by `resetBeats`, written by nothing. */
  'CELLULAR',
  /* The naming tables. The namer reads each one and writes into none of them. */
  'OLD_ONSETS', 'OLD_VOWELS', 'OLD_CODAS', 'OLD_FORBID', 'LAND_WORDS', 'LAND_WORD_KINDS', 'LORE_BUILT', 'LORE_TOOK', 'SKY_MEANINGS',
  'SPRITE_MEANINGS', 'OLD_CAVE_KINDS', 'BIOME_WORD', 'LAND_MARKS', 'WORD_TAIL', 'WORD_PHRASE', 'NOTABLE_TAILS',
  'CAMP_NAMED_LINES',
  'AXIS_TRAIT', 'EVENT_NAMES', 'EVENT_KINDS', 'WORK_WORDS', 'DEED_EPITHETS', 'FATE_EPITHETS', 'DESCRIBE_KIND', 'DISTINCT_FORM',
  /* The creation's words in gods.js. `tell` reads them and writes into none of them; the count of tellings is in `creation.told`. */
  'POLE_WORD', 'GOD_OF', 'LACK_WORD', 'BIOME_PLACE', 'SCAR_TEXT', 'COUNT_WORD', 'TELL',
  /* The sky's tables in faith.js. The rules read them; the record they write is `faith`, which is saved. */
  'FAITH', 'FAITH_TEXT', 'PRAYERS']);

test('every top-level let or var in the sim is saved or listed with a reason', () => {
  const api = load(), saved = api.SAVED_STATE, not = api.NOT_SAVED;
  const all = declaredIn(['let', 'var']);
  const missing = all.filter(d => !(d.name in saved) && !(d.name in not)).map(d => d.file + '.js: ' + d.name);
  assert.deepEqual(missing, []);
  const names = new Set(all.map(d => d.name));
  const stale = [...Object.keys(saved), ...Object.keys(not)].filter(n => !names.has(n));
  assert.deepEqual(stale, [], 'SAVED_STATE and NOT_SAVED name a variable the sim no longer declares');
  for (const k in saved) assert.ok(!(k in not), `${k} is in both lists`);
  for (const k in not) assert.ok(typeof not[k] === 'string' && not[k].length > 3, `${k} needs a reason`);
});
test('every saved global has a value in savedValues, and nothing else has', () => {
  const api = load(); api.startWorld('r', { sw: 8, sh: 5 });
  assert.deepEqual(Object.keys(api.savedValues()).sort(), Object.values(api.SAVED_STATE).sort(),
    'savedValues holds one entry for each name SAVED_STATE saves, so the guard walks every new one');
});
test('every top-level const container in the sim is a table or is listed with a reason', () => {
  const found = declaredIn(['const']).filter(d => isContainer(d.init));
  const loose = found.filter(d => !(d.name in KNOWN_CONSTS) && !FROZEN_TABLES.has(d.name)).map(d => d.file + '.js: ' + d.name);
  assert.deepEqual(loose, [], 'a top-level const container is state until someone reads it and says it is a table');
  const names = new Set(found.map(d => d.name));
  assert.deepEqual(Object.keys(KNOWN_CONSTS).filter(n => !names.has(n)), []);
  assert.deepEqual([...FROZEN_TABLES].filter(n => !names.has(n)), [], 'FROZEN_TABLES names a const the sim no longer declares');
});
/* State hung on a function object or a table is no declaration, so no parser above catches it. A grep
   does, for the shape the sim uses: an assignment into a dotted name at the start of a line. */
const KNOWN_TOP_ASSIGNMENTS = {
  'TASKS.': 'the task table, filled at load time by each file that owns a kind',
  'SPECIES.god': 'the god row, added at load time',
  'LIFE.god': 'the god row, added at load time',
  'DOOR_ACTS.load.replacesWorld': 'the one act that replaces the world, marked at load time',
};
test('nothing hangs state on a function or a table at the top level but the known ones', () => {
  const found = [];
  for (const f of FILES) for (const line of simSource(f).split('\n')){
    const m = line.match(/^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*=[^=]/);
    if (m) found.push(m[1]);
  }
  const keys = Object.keys(KNOWN_TOP_ASSIGNMENTS);
  const covers = n => keys.some(k => k.endsWith('.') ? n.startsWith(k) : n === k);
  assert.deepEqual([...new Set(found.filter(n => !covers(n)))], []);
  assert.deepEqual(keys.filter(k => !found.some(n => k.endsWith('.') ? n.startsWith(k) : n === k)), []);
  for (const k in KNOWN_TOP_ASSIGNMENTS) assert.ok(KNOWN_TOP_ASSIGNMENTS[k].length > 3, `${k} needs a reason`);
});
