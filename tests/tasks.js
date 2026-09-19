// Tasks as data: the table, the executor, and a ratchet that counts what is still a closure.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load, FILES } = require('../src/sim');

/* A value a task record may hold: numbers, strings, booleans, null, and arrays and plain objects of those. */
function plain(v, at = 'task'){
  if (v === null || ['number', 'string', 'boolean'].includes(typeof v)) return [];
  if (typeof v === 'undefined') return [];
  if (Array.isArray(v)) return v.flatMap((x, i) => plain(x, `${at}[${i}]`));
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return Object.keys(v).flatMap(k => plain(v[k], `${at}.${k}`));
  return [`${at} holds a ${typeof v === 'function' ? 'function' : 'reference'}`];
}

test('tasks.js loads before beings.js, which adds kinds to TASKS', () => {
  assert.ok(FILES.indexOf('tasks') < FILES.indexOf('beings'));
});

test('startTask builds a plain record from the table', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.failTask(a);
  assert.ok(api.startTask(a, 'rest'));
  assert.equal(a.task.kind, 'rest'); assert.equal(a.task.type, 'rest'); assert.equal(a.task.stop, 0);
  assert.equal(a.task.wait, api.CLOCK.task.doze); assert.deepEqual(a.task.path, []);
  assert.deepEqual(plain(a.task), []);
});

test('startTask copies its args, and an unknown kind is an error', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.failTask(a);
  const args = {}; api.startTask(a, 'rest', args);
  assert.notEqual(a.task.args, args);
  assert.throws(() => api.startTask(a, 'no such kind'), /No task kind/);
});

test('the executor runs a record to its end', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.failTask(a); a.needs.rest = 10;
  api.startTask(a, 'rest');
  for (let k = 0; k < api.CLOCK.task.doze + 2 && a.task; k++) api.runTask(a);
  assert.equal(a.task, null); assert.equal(a.needs.rest, 50);
});

test('goTo is null within reach, and sets a path when it is not', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.failTask(a); api.startTask(a, 'rest');
  assert.equal(api.goTo(a, a.task, a.x, a.y, 1, a.z), null);
  const [sx, sy] = a.camp && a.camp.site ? a.camp.site : [a.x, a.y];
  const far = api.beings.find(b => b.alive && b !== a && api.nearAt(b, a.x, a.y, a.z) > 6 && b.z === 0);
  if (far){ const r = api.goTo(a, a.task, far.x, far.y, 1, 0); assert.ok(r === 'continue' || r === 'fail'); if (r === 'continue') assert.ok(a.task.path.length > 0); }
});

test('flee, wander, and sleep go through the table', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.failTask(a);
  assert.ok(api.startTask(a, 'wander')); assert.equal(a.task.kind, 'wander'); assert.deepEqual(plain(a.task), []);
  api.failTask(a);
  assert.ok(api.startTask(a, 'sleep'));
  assert.ok(a.asleep || (a.task && a.task.kind === 'sleep'));
});

test('the base kinds of a person are in the table', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['drink', 'eat', 'socialize', 'shelter', 'sit', 'rest', 'wander', 'flee', 'sleep']) assert.ok(api.TASKS[k], k);
  const a = api.firstPerson(); api.failTask(a); a.needs.water = 5;
  assert.ok(api.startTask(a, 'drink')); assert.equal(a.task.kind, 'drink'); assert.equal(a.task.type, 'drink');
  assert.deepEqual(plain(a.task), []);
});

test('the animals and the gnomes are in the table', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['hunt', 'raid', 'stalk', 'herd', 'scavenge', 'home', 'carryHome', 'shrooms', 'huddle', 'borrow', 'repay', 'walk', 'walkTo']) assert.ok(api.TASKS[k], k);
  assert.equal(Object.keys(api.START).filter(k => ['hunt', 'raid', 'stalk', 'herd', 'scavenge', 'home', 'carryHome', 'shrooms', 'huddle', 'borrow', 'repay'].includes(k)).length, 0);
});

test('the sprites are in the table, and START is empty', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['dance', 'forage', 'watch', 'collect', 'prank', 'fightSprite']) assert.ok(api.TASKS[k], k);
  assert.deepEqual(Object.keys(api.START), []);
});

/* ---------- the ratchet ---------- */
const SIM = path.join(__dirname, '..', 'src', 'sim');
/* `start: ` followed by a function or an offer's start. A plain field named start (the gods' rest gate has one) is not a task. */
const OLD = /\barrive\b|\bcleanup\b|\bstart: (a =>|o\.|r\.|g\b)|\bSTART\b/g;
/* What each file may still hold. Each task of the plan lowers its files. The close removes the ratchet. */
const PENDING = {
  camps: 1, tasks: 40, beings: 5, species: 0, fae: 0, goals: 54, recipes: 4,
};
test('no file holds more closure tasks than the ratchet allows', () => {
  const over = [];
  for (const f of FILES){
    const n = (fs.readFileSync(path.join(SIM, f + '.js'), 'utf8').match(OLD) || []).length, allowed = PENDING[f] || 0;
    if (n > allowed) over.push(`${f}.js holds ${n}, and ${allowed} are allowed`);
    if (PENDING[f] !== undefined && n < allowed) over.push(`${f}.js holds ${n}. Lower its PENDING count from ${allowed}.`);
  }
  assert.equal(over.length, 0, over.join('\n'));
});

/* Every task of kind in a short run is plain data. The close extends this to every task. */
test('every record the table starts is plain data', () => {
  const api = load(); api.startWorld('r');
  const bad = new Set();
  for (let k = 0; k < 6000; k++){
    api.step();
    for (const b of api.beings) if (b.alive && b.task && b.task.kind) for (const s of plain(b.task)) bad.add(`${b.task.kind}: ${s}`);
  }
  assert.deepEqual([...bad], []);
});
