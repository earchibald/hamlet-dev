// Snapshots: the streams, the table of references, the round trip, and the oracle.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { load, FILES } = require('../src/sim/index.js');
const { runDays } = require('./lib/run.js');

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
