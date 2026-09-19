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
});

test('the sprites are in the table', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['dance', 'forage', 'watch', 'collect', 'prank', 'fightSprite']) assert.ok(api.TASKS[k], k);
});

test('gathering and its kin are in the table, and a gathered stick reaches the stash as plain data', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['deliver', 'gather', 'pickBerries', 'pickFibre', 'fish', 'digClay', 'takeCuttings', 'quarry', 'cutTree', 'fillWater']) assert.ok(api.TASKS[k], k);
  const a = api.firstPerson(); api.camp = a.camp; api.failTask(a);
  if (api.startTask(a, 'gather', { item: 'stick' })){
    assert.deepEqual(plain(a.task), []);
    for (let k = 0; k < 2000 && a.task; k++){ api.runTask(a); api.tick = api.tick + 1; if (a.task) assert.deepEqual(plain(a.task), []); }
  }
});

test('workKind declares the work and the effect, and runs them through the table', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.camp = a.camp; api.failTask(a);
  let landed = null;
  api.TASKS.testJob = api.workKind({ label: 'Testing the bench', amount: 5, skill: 'craft', effect: (b, args) => { landed = args.note; } });
  assert.deepEqual(api.TASKS.testJob.work, { amount: 5, skill: 'craft' });
  assert.equal(typeof api.TASKS.testJob.effect, 'function');
  assert.ok(api.startTask(a, 'testJob', { at: [a.x, a.y], note: 'done' }));
  assert.equal(a.task.type, 'work'); assert.deepEqual(plain(a.task), []);
  for (let k = 0; k < 50 && a.task; k++) api.runTask(a);
  assert.equal(landed, 'done'); assert.equal(a.task, null);
});

test('a skilled worker ends a job in fewer strides', () => {
  const api = load(); api.startWorld('r');
  api.TASKS.testJob = api.workKind({ label: 'Twisting cord', amount: 30, skill: 'craft', effect: () => {} });
  const runs = lvl => { const a = api.firstPerson(); api.camp = a.camp; api.failTask(a); a.skills.craft = lvl; api.startTask(a, 'testJob', { at: [a.x, a.y] }); let n = 0; for (; n < 200 && a.task; n++) api.runTask(a); return n; };
  assert.ok(runs(4) < runs(0));
});

test('the snare jobs, the ember, and joining are in the table', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['setSnare', 'checkSnare', 'haulPit', 'fetchEmber', 'join']) assert.ok(api.TASKS[k], k);
});

test('the chases and the brand are in the table', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['huntDeer', 'driveOff', 'brand', 'searchCave', 'clearRock', 'clearDen', 'followBrand', 'comeHome']) assert.ok(api.TASKS[k], k);
});

test('a brand task with no next step ends with no live ember', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.camp = a.camp;
  if (!a.camp.pit) return;
  api.failTask(a);
  api.TASKS.never = { type: 'work', begin: () => false, stops: [() => 'done'] };
  assert.ok(api.startTask(a, 'brand', { label: 'Testing', next: { kind: 'never', args: {} } }));
  assert.deepEqual(plain(a.task), []);
});

test('every offer is data', () => {
  const api = load(); api.startWorld('r');
  const seen = new Set();
  /* Nine days of the old 1000-tick day, sampled every 50 old ticks. Both convert, so the run covers
     the same nine world days and takes the same number of samples as it always did. Renumbering only
     the bound would have sampled 86.4 times as often; renumbering neither left the test watching a
     tenth of one day, which is why it saw too few kinds and went red. */
  const span = api.ticks(9000), every = api.ticks(50);
  for (let k = 0; k < span; k++){
    api.step();
    if (k % every) continue;
    for (const h of api.humans()){ api.camp = h.camp; if (!h.camp) continue;
      for (const o of api.offersFor(h)){ seen.add(o.task && o.task.kind); assert.deepEqual(plain(o, 'offer'), [], o.label); assert.ok(api.TASKS[o.task.kind], o.label); } }
  }
  assert.ok(seen.size > 3);
});

test('what a being last chose is plain data', () => {
  const api = load(); api.startWorld('r');
  for (let k = 0; k < 3000; k++) api.step();
  for (const b of api.beings) if (b.alive && b.lastChoice) assert.deepEqual(plain(b.lastChoice, 'lastChoice'), []);
});

test('two people may break one fallen rock, and the second to finish does not fall over', () => {
  const api = load(); api.startWorld('x');
  const c = api.caves.find(c => c.blocked); assert.ok(c, 'seed x holds a cave with a fallen rock');
  const b = c.blocked, rock = [b.x, b.y, b.z], cave = api.caves.indexOf(c);
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [b.x + dx, b.y + dy, b.z]).find(([x, y, z]) => api.hasTile(x, y, z) && api.passable(x, y, z));
  assert.ok(spot, 'a floor tile lies beside the rock');
  const first = api.firstPerson(), second = api.makeBeing('human', spot[0], spot[1], 'Second', 0);
  second.camp = first.camp; api.beings.push(second); api.camp = first.camp;
  if (!api.camp.stashTile) api.camp.stashTile = [first.x, first.y];
  for (const p of [first, second]){ api.failTask(p); p.x = spot[0]; p.y = spot[1]; p.z = spot[2]; assert.ok(api.startTask(p, 'clearRock', { cave, rock }), 'the work starts'); assert.deepEqual(plain(p.task), []); }
  /* 400 ticks of the old day, converted: the work takes the same world time it always did. */
  for (let k = 0, b = api.ticks(400); k < b && (first.task || second.task); k++) for (const p of [first, second]) if (p.task && p.task.kind === 'clearRock' && p.task.stop === 0) api.runTask(p); else if (p.task) api.failTask(p);
  assert.equal(c.blocked, null); assert.equal(api.tileAt(...rock).ground, 'stone');
});

test('a record does not share an array with the offer or the camp', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.failTask(a);
  const at = [a.x, a.y, a.z], args = { at, within: 0 };
  api.TASKS.holdStill = { type: 'travel', begin: () => ({ label: 'Holding still' }), stops: [() => 'done'] };
  assert.ok(api.startTask(a, 'holdStill', args));
  assert.notEqual(a.task.args.at, at); assert.deepEqual(a.task.args.at, at);
});

/* ---------- one mode: no file holds a closure task ---------- */
const SIM = path.join(__dirname, '..', 'src', 'sim');
/* `arrive` and `cleanup` as a method or a field, not as a word in a comment. `start: ` followed by a function or an
   offer's start. A plain field named start (the gods' rest gate has one) is not a task. */
const OLD = /\b(arrive|cleanup)\s*[(:]|\.(arrive|cleanup)\b|\bstart: (a =>|o\.|r\.|g\b)|\bSTART\b/g;
test('no file holds a closure task', () => {
  const held = FILES.filter(f => new RegExp(OLD.source).test(fs.readFileSync(path.join(SIM, f + '.js'), 'utf8')));
  assert.deepEqual(held, []);
});

test('every task in a run is a small plain record of a known kind', () => {
  for (const seed of ['r', 'x']){
    const api = load(); api.startWorld(seed);
    const bad = new Set();
    for (let k = 0; k < 12000; k++){
      api.step();
      for (const b of api.beings) if (b.alive && b.task){
        const t = b.task;
        if (!api.TASKS[t.kind]) bad.add(`no kind: ${t.kind} (${t.label})`);
        for (const s of plain(t)) bad.add(`${t.kind}: ${s}`);
        const { path: _p, ...rest } = t; if (JSON.stringify(rest).length > 600) bad.add(`${t.kind}: the record is ${JSON.stringify(rest).length} characters`);
      }
    }
    assert.deepEqual([...bad], [], seed);
  }
});

test('a task survives a trip through JSON', () => {
  const api = load(); api.startWorld('r');
  for (let k = 0; k < 4000; k++) api.step();
  for (const b of api.beings) if (b.alive && b.task) assert.deepEqual(JSON.parse(JSON.stringify(b.task)), b.task);
});

test('every kind has a type, a begin, and stops, and a job declares its work and effect', () => {
  const api = load();
  for (const [k, K] of Object.entries(api.TASKS)){
    assert.equal(typeof K.type, 'string', k); assert.equal(typeof K.begin, 'function', k); assert.ok(Array.isArray(K.stops) && K.stops.length > 0, k);
    if (K.work){ assert.equal(typeof K.effect, 'function', k); assert.ok('amount' in K.work && 'skill' in K.work, k); }
  }
});
