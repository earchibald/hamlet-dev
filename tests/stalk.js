// Stalk: the wolf's lone-person pick. The hand-built cases are fast; the two real runs are fifteen
// world days each and take 115 s together, which is inside the budget, so the file carries no flag.
// The point of this file is equivalence, not behaviour: the old expression called
// api.humans() once per candidate; the fix calls it once. Both must pick the same
// people, in the same order, every time.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
/* DAY comes from the sim through the runner. This file wrote `DAYS * 1000`, dev's day, and after G4
   made the day 86,400 ticks that loop ran 0.17 of a world day while still reporting fifteen. */
const { runDays, scriptGod, DAY } = require('./lib/run');

/* The old expression, written out here rather than borrowed from the sim, so a slip in the
   extraction shows up as a mismatch. Calls api.humans() itself, once per candidate, the way
   the pre-fix code did. */
function oldLone(api, a){
  return api.humans().filter(h =>
    !(api.tick < (h.cooldown.stalked || 0)) &&
    !api.humans().some(o => o !== h && api.near(o, h) <= 5) &&
    !(h.camp && h.camp.pit && api.tileAt(...h.camp.pit).struct.lit && api.nearAt(h, ...h.camp.pit) <= 8) &&
    api.near(h, a) <= 30 &&
    !(h.carrying && h.carrying.kind === 'ember')
  );
}

function sameList(a, b){
  return a.length === b.length && a.every((h, i) => h === b[i]);
}

function assertSame(api, a, why){
  const want = oldLone(api, a);
  const got = api.loneHumans(a);
  assert.ok(sameList(want, got), `${why}: old picked [${want.map(h => h.id)}], new picked [${got.map(h => h.id)}]`);
  return got;
}

function freshWorld(seed = 'r'){
  const api = load();
  api.startWorld(seed);
  api.beings.length = 0; // direct cases build their own cast
  return api;
}

function human(api, x, y){
  const h = api.makeBeing('human', x, y, null, 0);
  h.camp = null; h.carrying = null; h.cooldown = {};
  api.beings.push(h);
  return h;
}

function wolf(api, x, y){
  const w = api.makeBeing('wolf', x, y, null, 0);
  api.beings.push(w);
  return w;
}

test('several people spread out: all are lone', () => {
  const api = freshWorld();
  const w = wolf(api, 10, 10);
  human(api, 12, 10); human(api, 10, 20); human(api, 20, 10);
  const got = assertSame(api, w, 'spread out');
  assert.equal(got.length, 3);
});

test('two people within 5 of each other: neither is lone', () => {
  const api = freshWorld();
  const w = wolf(api, 10, 10);
  const p = human(api, 12, 10); const q = human(api, 13, 10); // 1 apart
  human(api, 30, 30); // out of range of the wolf entirely
  const got = assertSame(api, w, 'paired up');
  assert.ok(!got.includes(p) && !got.includes(q), 'the pair is excluded');
});

test('a person by a lit fire pit is not lone', () => {
  const api = freshWorld();
  const w = wolf(api, 10, 10);
  const h = human(api, 12, 10);
  const t = api.tileAt(12, 12); t.struct = { type: 'firepit', fuel: 100, lit: true };
  h.camp = { pit: [12, 12] };
  assertSame(api, w, 'lit pit nearby');
  assert.ok(!api.loneHumans(w).includes(h), 'excluded by the lit pit');
});

test('a person on stalk cooldown is not lone', () => {
  const api = freshWorld();
  const w = wolf(api, 10, 10);
  const h = human(api, 12, 10);
  h.cooldown.stalked = api.tick + 5000;
  assertSame(api, w, 'on cooldown');
  assert.ok(!api.loneHumans(w).includes(h), 'excluded by cooldown');
});

test('a person carrying an ember is not lone', () => {
  const api = freshWorld();
  const w = wolf(api, 10, 10);
  const h = human(api, 12, 10);
  h.carrying = { kind: 'ember' };
  assertSame(api, w, 'carrying an ember');
  assert.ok(!api.loneHumans(w).includes(h), 'excluded by the ember');
});

test('a person more than 30 away from the wolf is not lone', () => {
  const api = freshWorld();
  const w = wolf(api, 10, 10);
  const h = human(api, 60, 10);
  assertSame(api, w, 'far away');
  assert.ok(!api.loneHumans(w).includes(h), 'excluded by distance');
});

/* A real run, with the script god as the soak uses it. Seeds r and x never have a god make wolves
   (checked with api.wasMade('wolf')), so this uses alpha and beta instead, the next two soak seeds,
   both of which do. Every CHECK_EVERY ticks, every wolf's pick is checked against the old expression,
   computed fresh on the same api at the same instant.

   What the run must cross is a changing cast, because a cached humans() list is caught by nothing
   else. Measured on this branch, with the script god above:

     ticks              alpha                       beta
     15,000 (0.17 day)  0 deaths, 0 births, cast never changed
     15 days            74 deaths, 1 birth          66 deaths, 0 births
                        cast changed 9 times        cast changed 10 times

   The first row is what this file did after the merge, with `DAYS * 1000` in the loop: the stated
   mechanism was not exercised at all, and the test was green. A death here is any being's, counted by
   a live-id set taken each tick; none of these deaths reaches the chronicle as a `death` line, which
   is why the guard below counts the cast and not the log. Births stay rare at this length, so the
   guard asks for a cast that moves, which is the claim that matters, and not for a birth. */
const CHECK_EVERY = 100;
const DAYS = 15;
/* Fifteen world days of two seeds cost 115 s together, measured on this branch with
   `time LONG=1 node --test tests/stalk.js` on an 18-core Mac at one-minute load average 11.1, with
   three other runs of the sim on the machine. That is inside the 120 s a restored file may take, so
   this one stays in the fast suite and behind no flag. garden.js and itemgrid.js, which are not
   inside it, carry a LONG=1 gate instead. Neither file's day count was cut to buy the difference. */
for (const seed of ['alpha', 'beta']){
  test(`seed ${seed}: the wolf's pick matches the old expression through a real run of ${DAYS} days`, t => {
    const api = load();
    api.startWorld(seed);
    let checks = 0, castChanges = 0, was = null;
    const cast = () => api.beings.filter(b => b.alive && b.species === 'human').map(b => b.id).join(',');
    for (let i = 0; i < DAYS * DAY; i++){
      api.step(); scriptGod(api, i);
      if (i % CHECK_EVERY !== 0) continue;
      const now = cast();
      if (was !== null && now !== was) castChanges++;
      was = now;
      for (const w of api.beings.filter(b => b.alive && b.species === 'wolf')){
        assertSame(api, w, `seed ${seed} tick ${api.tick} wolf ${w.id}`);
        checks++;
      }
    }
    t.diagnostic(`seed ${seed}: ${checks} wolf picks checked, the cast of people changed ${castChanges} times`);
    assert.ok(checks > 0, `seed ${seed} never had a live wolf to check`);
    /* The vacuity guard. A cached list of people is only wrong once the people change, so a run that
       crossed no change checked the fix against a world it could not have broken. Both seeds change
       the cast nine or ten times in fifteen days, and neither changes it once in 15,000 ticks. */
    assert.ok(castChanges > 0, `seed ${seed}: the cast of people never changed in ${DAYS} days, so a stale humans() cache could not have shown; ${checks} picks were compared against an unchanging world`);
  });
}
