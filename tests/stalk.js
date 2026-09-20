// Stalk: the wolf's lone-person pick. Fast: hand-built cases, then a real run.
// The point of this file is equivalence, not behaviour: the old expression called
// api.humans() once per candidate; the fix calls it once. Both must pick the same
// people, in the same order, every time.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const { runDays, scriptGod } = require('./lib/run');

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
   both of which do. Every N ticks, every wolf's pick is checked against the old expression, computed
   fresh on the same api at the same instant. 15 days x 2 seeds, checked every 100 ticks, runs in a
   couple of seconds and still crosses several births and deaths, which is what a broken cache needs
   to be caught by. */
const CHECK_EVERY = 100;
const DAYS = 15;
for (const seed of ['alpha', 'beta']){
  test(`seed ${seed}: the wolf's pick matches the old expression through a real run`, () => {
    const api = load();
    api.startWorld(seed);
    let checks = 0;
    for (let i = 0; i < DAYS * 1000; i++){
      api.step(); scriptGod(api, i);
      if (i % CHECK_EVERY !== 0) continue;
      for (const w of api.beings.filter(b => b.alive && b.species === 'wolf')){
        assertSame(api, w, `seed ${seed} tick ${api.tick} wolf ${w.id}`);
        checks++;
      }
    }
    assert.ok(checks > 0, `seed ${seed} never had a live wolf to check`);
  });
}
