// Snapshots: the streams, the table of references, the round trip, and the oracle.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { load, FILES } = require('../src/sim/index.js');
const { runDays, collect, runOn, fingerprint } = require('./lib/run.js');

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
   seed alpha digs four by day 21, and it runs in a few seconds. */
test('a world with pitfalls in it round-trips and keeps each pitfall in its tile', () => {
  const was = load(); was.startWorld('alpha', { sw: 8, sh: 5 }); for (let i = 0; i < 20000; i++) was.step();
  assert.ok(was.camps.reduce((n, c) => n + c.pitfalls.length, 0) > 0, 'this world was meant to have a pitfall');
  const api = load(); assert.equal(api.loadSnapshot(through(was.takeSnapshot())), null);
  for (const c of api.camps) for (const p of c.pitfalls){
    const t = api.world[p.y * api.W + p.x];
    assert.equal(t.struct.pit, p); assert.equal(t.struct.camp, c); assert.equal(p.camp, c);
  }
  assert.deepStrictEqual(through(api.takeSnapshot()), through(was.takeSnapshot()));
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
  const small = load(); small.startWorld('r', { sw: 8, sh: 5 }); for (let i = 0; i < 3000; i++) small.step();
  const api = load(); api.startWorld('x'); assert.equal(api.loadSnapshot(through(small.takeSnapshot())), null);
  assert.equal(api.W, small.W); for (let i = 0; i < 500; i++) api.step();
});

/* ---------- the oracle ---------- */
/* The round trip proves a save can be read back. The oracle proves the save was whole: run N steps,
   save, load into a fresh sim, and run both worlds on for M more. The loaded world must tell the
   same story, line for line, and end holding the same snapshot. The last part is the strong one: it
   compares the streams, the caches, and every record, so a piece of state the save lost shows up
   here even when the story has not yet noticed it.

   The steps are counted on from the save, not from zero, because the script god reads the loop index. */
function oracle(seed, N, M, opts = {}, before = null){
  const a = load(); a.startWorld(seed, opts);
  const ca = collect(a); ca.drain(); runOn(a, 0, N, ca);
  const at = before ? before(a, ca, N) : N;
  const midTask = a.beings.filter(b => b.alive && b.task && b.task.path && b.task.path.length).length;
  const working = a.beings.filter(b => b.alive && b.task && b.task.progress > 0).length;
  const denless = a.beings.filter(b => b.alive && b.oldDen && !b.den).length;
  const snap = through(a.takeSnapshot());
  const b = load(); assert.equal(b.loadSnapshot(snap), null);
  const cb = collect(b); cb.skipPresent();
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
   allows, because each one runs its world once whole and then twice more from the save. */
const SMALL = { sw: 8, sh: 5 };
const CASES = [
  ['r', 12400, 8000, {}],        // one camp founds a second after the load, and a storm rolls in
  ['x', 12400, 4000, {}],        // another valley, two storms after the load
  ['gamma', 30300, 2000, {}],    // a grown valley: two camps, huts, and a spear
  ['alpha', 20000, 3000, SMALL], // a small valley with snares and pitfalls in the ground, and two camps
];
for (const [seed, N, M, opts] of CASES)
  test(`seed ${seed}: saved at step ${N}, loaded, and run on, the story is the straight run's`, t => {
    const o = oracle(seed, N, M, opts);
    t.diagnostic(`${seed}: ${o.midTask} walking, ${o.working} at work, ${o.a.camps.length} camps, ${o.after.length} lines after the save`);
    sameStory(o);
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
  runOn(a, N, 60, ca);   // long enough for the fire to spread, short enough that it still burns
  return N + 60;
}
test('a world saved while the woods burn runs on as the straight run does', t => {
  const o = oracle('r', 6000, 3000, SMALL, lightTheWoods);
  const alight = lv => lv.filter(t => t && t.fire > 0).length;
  const offSurface = o.snap.levels.reduce((n, lv, i) => n + (i === o.a.ZOFF ? 0 : alight(lv)), 0);
  t.diagnostic(`fire at the save: ${o.snap.fireCount} tiles, ${offSurface} of them off the surface; grove anger ${JSON.stringify(o.a.groves.map(g => g.anger))}`);
  assert.ok(o.snap.fireCount > 0, 'the fire was out before the save');
  assert.ok(offSurface > 0, 'nothing off the surface was alight, so the raised walk in spreadFire went untested');
  sameStory(o);
});

/* A wolf den dug after the load. digDen reads startRegion through rimExits, and startRegion is a Set
   of about thirty thousand numbers that the save carries whole. A world that digs no den after the
   load would never touch it. This small valley clears a den at tick 4994 and digs a new one at 7994. */
test('a world that digs a wolf den after the load runs on as the straight run does', t => {
  const o = oracle('r', 6000, 2500, SMALL);
  const dug = o.loaded.filter(e => /dug a new den/.test(e.text));
  t.diagnostic(`${o.denless} wolves were den-less at the save; after the load: ${dug.map(e => e.text).join(' ')}`);
  assert.equal(dug.length, 1, 'no den was dug after the load, so startRegion and rimExits went untested');
  assert.equal(o.b.startRegion.size, o.a.startRegion.size);
  sameStory(o);
});

/* The guard: every piece of top-level state is either saved or listed with the reason it is not.
   A new `let` in the sim fails this test until someone decides which list it belongs in. */
const KNOWN_CONSTS = {
  TASKS: 'a table, filled at load time', POLES: 'a table, filled at load time', REF_PLAN: 'a table, filled at load time',
  bfsOut: 'search scratch',
};
function declared(kw){
  const out = [];
  for (const f of FILES){
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'sim', f + '.js'), 'utf8');
    for (const line of src.split('\n')){
      if (!line.startsWith(kw + ' ')) continue;
      const body = line.slice(kw.length + 1).split(';')[0];
      let depth = 0, part = '';
      const take = () => { const n = part.split('=')[0].trim(); if (n) out.push({ name: n, file: f }); part = ''; };
      for (const ch of body){
        if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
        if (ch === ',' && depth === 0) take(); else part += ch;
      }
      take();
    }
  }
  return out;
}
test('every top-level let in the sim is saved or listed with a reason', () => {
  const api = load(), saved = api.SAVED_STATE, not = api.NOT_SAVED;
  const missing = declared('let').filter(d => !(d.name in saved) && !(d.name in not)).map(d => d.file + '.js: ' + d.name);
  assert.deepEqual(missing, []);
  const names = new Set(declared('let').map(d => d.name));
  const stale = [...Object.keys(saved), ...Object.keys(not)].filter(n => !names.has(n));
  assert.deepEqual(stale, [], 'SAVED_STATE and NOT_SAVED name a variable the sim no longer declares');
  for (const k in saved) assert.ok(!(k in not), `${k} is in both lists`);
  for (const k in not) assert.ok(typeof not[k] === 'string' && not[k].length > 3, `${k} needs a reason`);
});
test('every top-level const the sim writes to is accounted for', () => {
  /* The mutable containers, verified by hand: an empty array, object, Map, or Set at the top level. */
  const empties = [];
  for (const f of FILES){
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'sim', f + '.js'), 'utf8');
    for (const line of src.split('\n')){ if (/^\s/.test(line)) continue; for (const m of line.matchAll(/const ([A-Za-z_$][\w$]*) = (\[\]|\{\}|new Map\(\)|new Set\(\))/g)) empties.push(m[1]); }
  }
  assert.deepEqual(empties.filter(n => !(n in KNOWN_CONSTS)), []);
  assert.deepEqual(Object.keys(KNOWN_CONSTS).filter(n => !empties.includes(n)), []);
});
