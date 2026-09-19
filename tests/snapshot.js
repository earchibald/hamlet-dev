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
