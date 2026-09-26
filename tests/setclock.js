// `setClock` in `tests/lib/run.js`: what a jumped clock moves, and what it must not charge. Fast.
//
// Ruling 8 of plan G4 lets a test set the date rather than pay the days to reach it. Since task 3 a
// being's body is worked out from the time that has passed since a marker on the record, so a jump
// that leaves a marker in the past charges the being for time it was never alive for. `seen` is one
// such marker and `setClock` has always written it. `worked`, the tick a job last had work put into
// it, is a second one, and it was missed: a jump of one world hour put 3,600 ticks of work into a
// snare nobody touched.
//
// The rule this file holds is the one the function's own comment states. A jump moves the date and
// every accrual marker with it. Nothing accrues across a jump: no hunger, no work, no fuel burnt. A
// deadline already set is left where it is and so expires, which is what an arrived world would also
// have done.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('../src/sim');
const { setClock } = require('./lib/run.js');

/* A small world with a lit pit under the founder, as `tests/beings-lazy.js` builds it. */
function world(seed = 'r'){
  const api = load();
  api.startWorld(seed, { sw: 3, sh: 2 });
  const a = api.humans()[0];
  const c = api.camp;
  c.pit = [a.x, a.y]; c.site = [a.x, a.y];
  api.tileAt(a.x, a.y, 0).struct = { type: 'firepit', fuel: 200, lit: true };
  a.task = null; a.asleep = false;
  return { api, a };
}

/* A person on a snare two tiles off, walked to the tile and given enough looks to put the first work
   in. The snare is a `workKind` job, which is the only kind that accrues by elapsed time, so a job
   built any other way is a misleading probe. */
function atWork(api, a){
  api.tick = api.days(1) + api.hours(9); a.seen = api.tick;
  for (const k in a.needs) a.needs[k] = 90;
  const at = [a.x + 2, a.y, 0];
  const t = api.tileAt(at[0], at[1], 0); t.feature = null; t.struct = null; t.ground = 'soil'; t.fire = 0;
  api.failTask(a);
  assert.ok(api.startTask(a, 'setSnare', { at }), 'the job should start');
  const step = () => { api.tick = api.tick + 1; api.catchUp(a); if (a.task) api.runTask(a); };
  for (let k = 0; k < 60 && a.task && !(a.task.progress > 0); k++) step();
  assert.ok(a.task && a.task.progress > 0, 'the work has begun');
  return step;
}

test('a jump of one world hour puts no work into a job', () => {
  const stepped = world(), jumped = world();
  atWork(stepped.api, stepped.a);
  atWork(jumped.api, jumped.a);
  const before = jumped.a.task.progress;
  assert.equal(stepped.a.task.progress, before, 'the two worlds start level');

  setClock(jumped.api, jumped.api.tick + jumped.api.hours(1));
  /* One look on each side. The stepped side is the control: one tick of work is what one look is
     worth, and the jumped side must gain the same. */
  stepped.api.tick++; stepped.api.catchUp(stepped.a); stepped.api.runTask(stepped.a);
  jumped.api.tick++; jumped.api.catchUp(jumped.a); jumped.api.runTask(jumped.a);

  assert.ok(jumped.a.task, `the job finished across the jump, from ${before} of ${jumped.a.status}`);
  const oneLook = stepped.a.task.progress - before;
  assert.ok(oneLook > 0, 'a look at a job should put work in');
  assert.ok(Math.abs((jumped.a.task.progress - before) - oneLook) < 1e-9,
    `the look after a one-hour jump put in ${jumped.a.task.progress - before} where a look is worth ${oneLook}: the jump was credited as work`);
});

test('a jump of one world day leaves no accrual marker in the past', () => {
  const { api, a } = world();
  atWork(api, a);
  const at = api.tick + api.DAY;
  setClock(api, at);
  assert.equal(api.tick, at, 'the world is on the date');
  for (const b of api.beings){
    assert.equal(b.seen, at, `${b.species} ${b.id} was last seen on ${b.seen} and the world is on ${at}`);
    if (b.task && b.task.worked !== undefined)
      assert.equal(b.task.worked, at, `${b.species} ${b.id} last worked on ${b.task.worked} and the world is on ${at}`);
  }
});

/* The inventory. Every `tick - X` in the rules is a read of elapsed world time, and each one is
   either a threshold — has enough time passed? — or an accrual marker, whose gap is multiplied into
   a quantity. A jump must move the accrual markers and must leave the thresholds alone.
 *
 * `t.worked` is the one accrual marker in this list. `a.seen`, the other, is read as `a.seen < tick`
 * and so does not appear here; the test above holds it by name.
 *
 * This list goes red when a rule reads a new elapsed gap. That is the point: the task that adds one
 * must say which kind it is, and `worked` reached the branch without anybody being asked. */
const ELAPSED_READS = [
  '(CLOCK.plant.grovePineAge  world.js', '(a.campSince  names.js', '(a.task.started  beings.js',
  '(t.planted  fae.js', '(t.planted  world.js', 'CLOCK.plant.grovePineAge  world.js',
  'CLOCK.plant.hollowAge  world.js', 'Math.round  beings.js', 'a.den.holding.since  beings.js',
  'a.lastHurtAt  beings.js', 'c.fae.lastPrank  fae.js', 'c.holding.since  species.js',
  'c.lastBirth  species.js', 'c.lastRepaid  species.js', 'c.leaving  species.js',
  'c.outSince  camps.js', 'c.t  world.js', 'c.wolfLogged  species.js', 'camp.founded  goals.js',
  'camp.guardLogged  tasks.js', 'camp.rotLogged  camps.js', 'e.tick  names.js',
  'g.lastBirth  fae.js', 'h.lastChild  camps.js', 'i.born  world.js', 'k.outSince  species.js',
  'rint  world.js', 't.planted  world.js', 't.worked  tasks.js', 'w.oldDen.clearedAt  species.js',
  /* A threshold: a miracle's sign is dropped once it is older than CLOCK.faith.signKeep. A jump that
     passes the keep drops it, as the days would have. */
  's.tick  faith.js',
];

test('the rules read no elapsed gap that this file has not been shown', () => {
  const dir = path.join(__dirname, '..', 'src', 'sim');
  const found = new Set();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'index.js' && f !== 'snapshot.js')){
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of s.matchAll(/\btick\s*-\s*([A-Za-z_$(][\w$.]*)/g)) found.add(`${m[1]}  ${f}`);
  }
  assert.ok(found.size > 20, `the scan found only ${found.size} elapsed reads, so it is probably broken`);
  assert.deepEqual([...found].sort(), [...ELAPSED_READS].sort());
});
