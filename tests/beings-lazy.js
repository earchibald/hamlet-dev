// The being's head off the tick. `catchUp` against a tick-by-tick reference. Fast.
//
// Task 3 of the retune moves a being's body off the tick: needs, warmth, hp and thoughts are no
// longer stepped 86,400 times a world day but computed from the time that has passed since the
// being was last seen. That is a closed form standing in for a loop, and the only honest test of a
// closed form is the loop it replaces.
//
// So `refTick` below is the OLD head, transcribed. It is a test-only function and nothing in
// `src/sim/` calls it. It holds every line of `updateBeing`'s head that touched needs, warmth, hp or
// thoughts, in the order the head ran them, and it counts thoughts down the way the head did. What
// it leaves out, it leaves out on purpose, and each omission is named beside it.
//
// The reference is driven by moving the world's tick and nothing else. The world itself is held
// still: the pit, the weather and the tiles do not change under either side, so a difference between
// them is `catchUp`'s and cannot be the world's.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { load } = require('../src/sim');

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/* The old head's thought bookkeeping: a duration counts down one a tick and the thought goes when it
   reaches zero. `catchUp` keeps a tick instead. The two agree on when a thought is gone to within
   one tick, and the test 'a thought ends at its until' pins which. */
function refThought(b, key, text, value, dur){
  const t = b.thoughts.find(t => t.key === key);
  if (t){ t.left = dur; t.value = value; t.text = text; } else b.thoughts.push({ key, text, value, left: dur });
}

/* One tick of the old head, for one being. Left out, and why:
     the gnome sighting, the burrow count, learnNamesHere, defendDen   they move no need and no hp
     the old-age roll                                                  task 3 makes it a daily roll
     fire underfoot, the fire and wolf sightings, the flee             the proximity pass, tested below
     the task machinery (force, timeout, chooseTask, runTask)          not the body
   Everything else is here, in the head's own order. */
function refTick(api, b){
  const C = api.CLOCK, sp = api.SPECIES[b.species], n = b.needs, night = api.isNight();
  for (const k in sp.decay) n[k] = Math.max(0, n[k] - sp.decay[k] * (k === 'rest' && b.asleep ? -6 : 1));
  if (b.species === 'human'){
    const camp = api.camp, hereTile = api.tileAt(b.x, b.y, b.z);
    const season = api.seasonOf(), under = b.z < 0 || !!hereTile.cave;
    const cold = under ? C.cold.under : season === 'winter' ? (night ? C.cold.winterNight : C.cold.winterDay) : season === 'summer' ? C.cold.summer : (night ? C.cold.night : C.cold.day);
    const byFire = camp && api.pitLit() && api.nearAt(b, ...camp.pit) <= 3;
    const beds = camp ? [camp.shelter, ...camp.huts].filter(Boolean) : [];
    const roofed = under || api.hasTile(b.x, b.y, b.z + 1) || beds.some(pl => api.nearAt(b, ...pl) <= 1);
    n.warmth = clamp(n.warmth - cold * (1.3 - b.traits.hardiness * 0.6) * (api.weather.storm && !roofed ? 1.5 : 1) * (roofed ? 0.4 : 1) * (b.homeless ? 0.3 : 1) * (b.clothes ? 0.6 : 1) * (api.stage(b) === 'adult' ? 1 : 1.3) + (byFire ? C.rate.fireWarms : 0), 0, 100);
    if (n.warmth < 20){ refThought(b, 'cold', 'Is freezing', -15, C.thought.cold); b.hp -= C.rate.freezeHurts; }
    if (api.weather.storm && !roofed && !b.asleep) refThought(b, 'wet', 'Soaked by the rain', -4, C.thought.wet);
    else if (api.weather.storm && roofed && b.z >= 0) refThought(b, 'dry', 'Dry under the roof while it pours', 3, C.thought.dry);
  }
  if (b.asleep) n.rest = Math.min(100, n.rest);
  for (const t of b.thoughts) t.left--; b.thoughts = b.thoughts.filter(t => t.left > 0);
  if (n.food <= 0 || (n.water !== undefined && n.water <= 0)){
    b.hp -= C.rate.starveHurts;
    if (b.species === 'human') refThought(b, 'starving', n.water <= 0 ? 'Is dying of thirst' : 'Is starving', -25, C.thought.starving);
  }
  else if (b.hp < 100) b.hp = Math.min(100, b.hp + C.rate.heals * (0.6 + b.traits.hardiness * 0.8));
  if (b.hp <= 0){ b.dead = true; return; }
  if (b.species === 'human' && api.camp && api.pitLit() && api.nearAt(b, ...api.camp.pit) <= 3) refThought(b, 'warm', 'Warm by the fire', 5, C.thought.warm);
  if (b.asleep && (n.rest >= 100 || (!night && n.rest >= 60))){
    b.asleep = false;
    const camp = api.camp, beds = camp ? [camp.shelter, ...camp.huts].filter(Boolean) : [];
    const roof = beds.some(pl => api.nearAt(b, ...pl) <= 1), warm = camp && api.pitLit() && api.nearAt(b, ...camp.pit) <= 4;
    refThought(b, 'slept', roof ? 'Slept under a roof' : warm ? 'Slept warm beside the fire' : 'Slept cold on the bare ground', roof ? 6 : warm ? 3 : -4, C.thought.slept);
  }
}

/* A world small enough to build in a tenth of a second, with a lit pit under the founder's feet and
   the founder standing on it. The pit is laid by hand because a world three days old has not built
   one yet, and the warmth rules turn on whether a fire is within three tiles. */
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
/* The reference's copy of the being's body. It shares no object with the being, and it holds only
   what the body reads. */
function twin(a){
  return { species: a.species, needs: { ...a.needs }, hp: a.hp, thoughts: [], traits: { ...a.traits },
    asleep: a.asleep, x: a.x, y: a.y, z: a.z, clothes: a.clothes, homeless: a.homeless, born: a.born };
}
/* Step the reference from the tick the being was last seen on to `to`, one tick at a time, exactly as
   the old head was stepped. Then bring the being itself up to `to` in one call. */
function bothTo(api, a, b, from, to){
  a.seen = from;
  for (let t = from + 1; t <= to; t++){ api.tick = t; refTick(api, b); }
  api.tick = to;
  api.catchUp(a);
}
const near1e6 = (got, want, what) => assert.ok(Math.abs(got - want) < 1e-6, `${what}: ${got} against the reference's ${want}`);
function sameBody(a, b, what){
  for (const k in b.needs) near1e6(a.needs[k], b.needs[k], `${what}: needs.${k}`);
  near1e6(a.hp, b.hp, `${what}: hp`);
  assert.equal(a.asleep, b.asleep, `${what}: asleep`);
  const keys = x => x.thoughts.map(t => `${t.key}=${t.value}`).sort().join(',');
  assert.equal(keys(a), keys(b), `${what}: thoughts`);
}

test('a person asleep eight hours by a lit pit, across a dawn, agrees with the tick-by-tick head', () => {
  const { api, a } = world();
  const from = api.days(1) + api.hours(22);            // 22:00 on day 2, eight hours short of dawn
  api.tick = from;
  a.asleep = true; a.needs.rest = 20; a.needs.food = 70; a.needs.water = 70; a.needs.warmth = 60; a.hp = 90;
  const b = twin(a);
  bothTo(api, a, b, from, from + api.hours(8));
  sameBody(a, b, 'eight hours asleep');
  assert.equal(a.asleep, false, 'eight hours of rest by the fire ends at dawn, not later');
});

test('a person who starves to zero food inside the stretch agrees with the tick-by-tick head', () => {
  const { api, a } = world();
  const from = api.days(1) + api.hours(10);
  api.tick = from;
  /* Food runs out about a third of the way through, so the stretch holds the crossing and both
     sides must break on it: before it the person heals, after it the person loses hp. */
  a.needs.food = 1.2; a.needs.water = 90; a.needs.rest = 80; a.needs.warmth = 80; a.hp = 95;
  const b = twin(a);
  bothTo(api, a, b, from, from + api.hours(3));
  sameBody(a, b, 'starving');
  assert.equal(a.needs.food, 0, 'the food ran out');
  assert.ok(a.hp < 95, 'a person with no food loses hp');
});

test('a person who freezes agrees with the tick-by-tick head', () => {
  const { api, a } = world();
  /* Away from the fire, in winter, at night. Warmth crosses twenty inside the stretch, which turns
     the freezing hp loss on partway through. */
  const from = api.days(275) + api.hours(23);
  api.tick = from;
  api.camp.pit = null;
  a.needs.warmth = 25; a.needs.food = 80; a.needs.water = 80; a.needs.rest = 80; a.hp = 100;
  const b = twin(a);
  bothTo(api, a, b, from, from + api.hours(2));
  sameBody(a, b, 'freezing');
  assert.ok(a.needs.warmth < 20, 'the cold got through');
  assert.ok(a.hp < 100, 'freezing costs hp');
});

test("a person across a season's turn agrees with the tick-by-tick head", () => {
  const { api, a } = world();
  /* Day 273 is the last of autumn and day 274 the first of winter, so the cold rate changes inside
     the stretch and nothing in the world moves but the calendar. */
  const from = api.days(272) + api.hours(23);
  api.tick = from;
  api.camp.pit = null;
  assert.equal(api.seasonOf(), 'autumn');
  a.needs.warmth = 90; a.needs.food = 80; a.needs.water = 80; a.needs.rest = 80; a.hp = 100;
  const b = twin(a);
  bothTo(api, a, b, from, from + api.hours(3));
  api.tick = from + api.hours(3);
  assert.equal(api.seasonOf(), 'winter');
  sameBody(a, b, "the season's turn");
});

test('a thought ends at its until, and not before', () => {
  const { api, a } = world();
  const from = api.days(1);
  api.tick = from;
  a.needs.food = 80; a.needs.water = 80; a.needs.rest = 80; a.needs.warmth = 80; a.hp = 100;
  a.seen = from;
  api.addThought(a, 'test', 'A thought put there by a test', 1, api.mins(5));
  const t = a.thoughts.find(t => t.key === 'test');
  assert.equal(t.until, from + api.mins(5), 'a thought holds the tick it is gone on');
  assert.equal(t.left, undefined, 'a thought no longer counts down');
  api.tick = t.until - 1; api.catchUp(a);
  assert.ok(api.threatsFor && a.thoughts.some(q => q.key === 'test'), 'the thought is still there the tick before its until');
  api.tick = t.until; api.catchUp(a);
  assert.ok(!a.thoughts.some(q => q.key === 'test'), 'the thought is gone on its until');
});

test('a sleeper on a tile that catches fire wakes on that tick', () => {
  const { api, a } = world();
  api.tick = api.days(1) + api.hours(23);
  a.asleep = true; a.needs.rest = 30; a.hp = 100; a.seen = api.tick;
  /* Nothing else is near, so the being's next act is hours away. */
  api.step();
  /* The body beat is the ceiling on any next act, so a sleeper's is a world minute off and not a tick. */
  assert.equal(a.next, api.tick + api.CLOCK.every.body, `a sleeper should wait out the body beat, and this one acts at ${a.next} from ${api.tick}`);
  const t = api.tileAt(a.x, a.y, a.z);
  t.fire = api.CLOCK.fire.strikeFuel;
  const at = api.tick + 1;
  api.step();
  assert.equal(a.seen, at, 'the sleeper was looked at on the tick the tile caught');
  assert.ok(a.thoughts.some(q => q.key === 'woken'), 'the fire roused the sleeper');
  assert.ok(a.thoughts.some(q => q.key === 'burned'), 'a person in a fire knows about it');
  assert.ok(a.hp < 100, 'a person in a fire is burned on the tick it catches');
  /* This hand-built valley gives the flee no way out, so the person lies back down. The gate is that
     the fire reached them on the tick it caught, not what they did about it. */
});

test('a sleeper with a wolf five tiles off wakes on that tick', () => {
  const { api, a } = world();
  api.tick = api.days(1) + api.hours(23);
  a.asleep = true; a.needs.rest = 30; a.hp = 100; a.seen = api.tick;
  api.step();
  assert.ok(a.next > api.tick + 1, 'a sleeper with nothing near does not act every tick');
  const w = api.makeBeing('wolf', a.x + 5, a.y);
  w.asleep = false; api.beings.push(w);
  const at = api.tick + 1;
  api.step();
  assert.equal(api.tick, at);
  assert.equal(a.seen, at, 'the sleeper was looked at on the tick the wolf came');
  assert.equal(a.asleep, false, 'a person does not sleep through a wolf at five tiles');
  assert.ok(a.thoughts.some(t => t.key === 'woken'), 'being woken by a wolf is something the player can see');
});

/* The human branch of the body is the long one, and every test above is a person. A sprite has no
   warmth and no food at all, and a rabbit has no water, so the branch that reads them must not reach
   for a need that is not there. Both are stepped by the tick like anyone else. */
test('a sprite and a rabbit agree with the tick-by-tick head', () => {
  const { api } = world();
  for (const species of ['sprite', 'rabbit']){
    const a = api.beings.find(b => b.alive && b.species === species);
    assert.ok(a, `the valley has no ${species}`);
    const from = api.days(1) + api.hours(9);
    api.tick = from;
    for (const k in a.needs) a.needs[k] = 40;
    a.hp = 80; a.thoughts = []; a.asleep = false;
    const b = twin(a);
    bothTo(api, a, b, from, from + api.hours(4));
    sameBody(a, b, species);
  }
});

/* Work is the one accumulator a jump touches: a job gains progress for each tick that passed rather
   than one for each look. So a job that names the tick it finishes on must finish on the tick a job
   looked at every tick finishes on. The walk to the work tile is in the run, because crediting a walk
   as work would show up here and nowhere else. */
test('a job that names its finishing tick finishes when a job stepped every tick does', () => {
  const ends = jump => {
    const { api, a } = world();
    api.tick = api.days(1) + api.hours(9); a.seen = api.tick;
    for (const k in a.needs) a.needs[k] = 90;
    const at = [a.x + 2, a.y, 0];
    const t = api.tileAt(at[0], at[1], 0); t.feature = null; t.struct = null; t.ground = 'soil'; t.fire = 0;
    api.failTask(a);
    assert.ok(api.startTask(a, 'setSnare', { at }), 'the job should start');
    let ticks = 0, last = 0;
    const gains = [];
    a.next = api.tick;
    while (a.task && ticks < api.hours(4)){
      api.tick = api.tick + 1; ticks++;
      if (jump && api.tick < a.next) continue;
      api.catchUp(a); api.runTask(a);
      if (a.task && a.task.progress > last){ gains.push(a.task.progress - last); last = a.task.progress; }
      if (a.task) a.next = api.tick + api.nextAct(a);
    }
    assert.ok(ticks < api.hours(4), 'the job should have finished');
    return { ticks, gains };
  };
  const stepped = ends(false), jumped = ends(true);
  assert.equal(jumped.ticks, stepped.ticks, `the job took ${jumped.ticks} ticks when jumped and ${stepped.ticks} when stepped`);
  /* The comparison above cannot see a fault the two runs share, and crediting the walk as work is
     exactly that fault: both runs would credit it and both would finish early together. So the first
     tick of work is read on its own. In the stepped run every act is one tick, so the second gain is
     what one tick of work is worth, and the first must equal it. */
  const perTick = stepped.gains[1];
  assert.ok(perTick > 0, 'the job should gain progress');
  assert.ok(Math.abs(stepped.gains[0] - perTick) < 1e-9,
    `the first tick of work put in ${stepped.gains[0]} where a tick of work is ${perTick}: the walk to the work tile was credited as work`);
});

/* The comparison above cannot see a fault that both cadences share, and crediting the walk as work is
   one: both would finish early together. So the walk is read on its own, with the worker pushed off a
   job it has already begun. On the tick it gets back it must put in one tick of work and not the walk. */
test('work put in after a walk back is one tick of work, and not the walk', ctx => {
  const { api, a } = world();
  api.tick = api.days(1) + api.hours(9); a.seen = api.tick;
  for (const k in a.needs) a.needs[k] = 90;
  const at = [a.x + 2, a.y, 0];
  const t = api.tileAt(at[0], at[1], 0); t.feature = null; t.struct = null; t.ground = 'soil'; t.fire = 0;
  api.failTask(a);
  assert.ok(api.startTask(a, 'setSnare', { at }), 'the job should start');
  const step = () => { api.tick = api.tick + 1; api.catchUp(a); if (a.task) api.runTask(a); };
  for (let k = 0; k < 60 && a.task; k++) step();
  assert.ok(a.task && a.task.progress > 0, 'the job has begun');
  /* Five tiles off, on the level, wherever the ground allows. */
  const away = [4, 5, 6, -4, -5, -6].map(d => [at[0] + d, at[1]]).find(([x, y]) => api.passable(x, y, 0));
  if (!away) return ctx.skip('no passable tile five tiles from the work');
  a.x = away[0]; a.y = away[1];
  const gains = [];
  let last = a.task.progress;
  for (let k = 0; k < 80 && a.task; k++){ step(); if (a.task && a.task.progress > last){ gains.push(a.task.progress - last); last = a.task.progress; } }
  assert.ok(gains.length >= 2, `the person should have walked back and worked again; gains ${gains.length}`);
  assert.ok(Math.abs(gains[0] - gains[1]) < 1e-9,
    `the first tick of work after the walk back put in ${gains[0]} where a tick of work is ${gains[1]}: the walk was credited as work`);
});

/* The two counters the budget rests on. `seen` is the tick a being's body was last brought up to,
   and `next` is the tick it acts again. Both are ticks on a saved record, so a load must bring them
   back or a loaded world would replay a day of body time or skip one. */
test('no being goes unseen, or unacted, for longer than the body beat', () => {
  const { api } = world();
  const beat = api.CLOCK.every.body;
  for (let i = 0; i < 200; i++) api.step();
  for (const a of api.beings){
    if (!a.alive || api.SPECIES[a.species].perTick === false) continue;
    assert.equal(typeof a.seen, 'number', `${a.species} ${a.id} names no tick it was seen on`);
    assert.ok(api.tick - a.seen <= beat, `${a.species} ${a.id} was last seen on tick ${a.seen} and the world is on ${api.tick}`);
    assert.equal(typeof a.next, 'number', `${a.species} ${a.id} names no next act`);
    assert.ok(a.next >= api.tick, `${a.species} ${a.id} is owed an act from the past`);
    assert.ok(a.next - api.tick <= beat, `${a.species} ${a.id} does not act again for ${a.next - api.tick} ticks, past the body beat of ${beat}`);
  }
});

/* The old-age roll was rolled once a tick against a chance for a tick. Off the tick it is rolled once
   a world day, compounded with `rollFor`, so a person past their span dies at the same rate in world
   time as before. The gate is that it is rolled on a day's turn and on no other tick. */
test('the old-age roll runs once a world day', () => {
  const { api, a } = world();
  const L = api.LIFE.human;
  a.born = api.tick - Math.round((L.life + 20) * api.DAY);
  assert.ok(api.ageDays(a) > L.life, 'the person is past their span');
  let rolls = 0;
  const seen = [];
  /* Count the rolls by watching the stream move on a tick where nothing else draws. The day's turn
     is the only tick a being past its span may draw on. */
  for (let i = 0; i < 3; i++){
    const at = api.days(api.dayOf() + i) - 1;
    api.tick = at; a.seen = at;
    const before = api.rng.state ? api.rng.state() : null;
    api.tick = at + 1; api.catchUp(a);
    if (before !== null && api.rng.state() !== before){ rolls++; seen.push(api.tick % api.DAY); }
  }
  assert.equal(rolls, 3, 'a being past its span rolls on each day it crosses');
  assert.deepEqual(seen, [0, 0, 0], 'the roll lands on the turn of the day');
});

/* The budget. A wall time is a property of the machine, so the load average is printed beside it and
   the assertion stands down on a busy machine rather than teach the reader to re-run a red gate.
   PR 31 removed this repository's one wall-clock assertion for exactly that reason.
 *
 * Standing down is a skip and not a pass. The load average and the wall seconds rise together, so the
 * guard stands down in exactly the condition that would make the assertion bite. A bare `return` had
 * printed a green tick and a suite count of 0 skipped, and the task 3 review set the budget to
 * 0.0001 s and still got 13 pass, 0 fail, 0 skipped. So the suite's own numbers must say when the
 * budget went unmeasured, and the skip names the load average that caused it. */
test('a world day at day 3 costs under five seconds', ctx => {
  const api = load();
  api.startWorld('r');
  const god = i => { for (const c of api.camps) if (c.pit && !c.everLit && c.coals <= i) api.inject({ source: 'player', act: 'light', x: c.pit[0], y: c.pit[1], z: 0 }); };
  let i = 0, secs = 0;
  for (let d = 1; d <= 3; d++){
    const t0 = process.hrtime.bigint();
    for (const end = i + api.DAY; i < end; i++){ api.step(); god(i); }
    secs = Number(process.hrtime.bigint() - t0) / 1e9;
  }
  const load1m = os.loadavg()[0];
  console.log(`    day 3 on seed r: ${secs.toFixed(2)} s, one-minute load average ${load1m.toFixed(2)}`);
  if (load1m > 2) return ctx.skip(`the budget went unmeasured at a one-minute load average of ${load1m.toFixed(2)}, which is over 2; the day took ${secs.toFixed(2)} s. Run it again on a quiet machine.`);
  assert.ok(secs < 5, `a world day at day 3 took ${secs.toFixed(2)} s at a one-minute load average of ${load1m.toFixed(2)}, and the budget is 5 s`);
});
