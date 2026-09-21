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
  for (const k in sp.decay) n[k] = Math.max(0, n[k] - sp.decay[k] * (k === 'rest' && b.asleep ? -C.rate.restsAsleep : 1));
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
  /* A sleeper whose food or water falls under `NEED_LOW` wakes, so the force in `updateBeing` can send
     them to drink or eat. Task 5 added it, because water at 17 points an hour empties a full skin in
     under six hours and a night is longer than that. The threshold is read from the sim and not
     copied: a second copy of a constant in a test agrees with whatever it was last set to. */
  if (b.asleep && (n.food < api.NEED_LOW || (n.water !== undefined && n.water < api.NEED_LOW))) b.asleep = false;
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

/* Eight hours from 22:00 to dawn. The person no longer stays asleep for all of it, and the reason is
   task 5's water rate: 17 points an hour empties a full skin in under six hours, so a sleeper crosses
   `NEED_LOW` before dawn and wakes to drink. The span is kept at eight hours and the crossing is
   inside it on purpose, because that is the night a person now has. The claim that the sleep ends at
   dawn and not later moves to the next test, which holds the water up and keeps it. */
test('a person who lies down at 22:00 by a lit pit, across a dawn, agrees with the tick-by-tick head', () => {
  const { api, a } = world();
  const from = api.days(1) + api.hours(22);            // 22:00 on day 2, eight hours short of dawn
  api.tick = from;
  /* The water is 70.3 and not 70, and the third of a point is load-bearing. Water falls 16 points an
     hour, so 225 ticks to the point, and a whole starting value puts the crossing of `NEED_LOW`
     exactly on a tick. There the closed form and a sum of 12,375 separate subtractions cannot be made
     to agree: the sum's own drift decides which side of 15 that tick lands on, and the two wake one
     tick apart. The third of a point moves the crossing off the tick boundary, where the question the
     test is asking -- does the body agree with the head -- has an answer that is not a rounding. */
  a.asleep = true; a.needs.rest = 20; a.needs.food = 70; a.needs.water = 70.3; a.needs.warmth = 60; a.hp = 90;
  const b = twin(a);
  bothTo(api, a, b, from, from + api.hours(8));
  sameBody(a, b, 'eight hours from 22:00');
  assert.equal(a.asleep, false, 'the person is not still asleep eight hours later');
  assert.ok(a.needs.water < api.NEED_LOW, 'the water ran low inside the eight hours, which is what woke them');
});

/* THE EIGHT-HOUR SLEEP ITSELF, with the water held up so that thirst never wakes the sleeper. The
   world is still, so nothing here drinks; the test tops the skin up at each tick on both sides
   equally, which is what an unbroken night looks like from the body's side. The claim is the one the
   previous test used to carry: a sleeper by the fire is up at dawn and not later. */
test('a person asleep eight hours with the water held up is up at dawn, and agrees with the head', () => {
  const { api, a } = world();
  const from = api.days(1) + api.hours(22);
  api.tick = from;
  a.asleep = true; a.needs.rest = 20; a.needs.food = 90; a.needs.water = 90; a.needs.warmth = 60; a.hp = 90;
  const b = twin(a);
  a.seen = from;
  for (let t = from + 1; t <= from + api.hours(8); t++){
    api.tick = t; refTick(api, b); b.needs.water = 90; b.needs.food = 90;
    api.catchUp(a); a.needs.water = 90; a.needs.food = 90;
  }
  sameBody(a, b, 'eight hours asleep, watered');
  assert.equal(a.asleep, false, 'eight hours of rest by the fire ends at dawn, not later');
  assert.ok(a.needs.rest >= api.WAKE_LIGHT, 'the sleeper woke because it was light and they were rested enough');
});

/* THE WAKE AT ITS OWN BOUNDARY, admitted and refused. The first run puts the water just over the
   threshold with an hour to fall through it, so the wake must fire. The second holds the water high
   for the same hour, so it must not. The two differ in one number. */
test('a sleeper wakes when the water crosses NEED_LOW, and not when it stays above it', () => {
  const run = water => {
    const { api, a } = world();
    const from = api.days(1) + api.hours(23);
    api.tick = from; a.seen = from;
    a.asleep = true; a.needs.rest = 40; a.needs.food = 90; a.needs.water = water; a.needs.warmth = 60; a.hp = 90;
    api.tick = from + api.hours(1);
    api.catchUp(a);
    return a;
  };
  /* An hour at 17 points an hour costs 17, so 20 falls through 15 and 40 does not. */
  const woken = run(20), left = run(40);
  assert.equal(woken.asleep, false, `a sleeper at ${woken.needs.water.toFixed(2)} water did not wake`);
  assert.equal(left.asleep, true, `a sleeper at ${left.needs.water.toFixed(2)} water woke, and nothing was wrong`);
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

/* `rousedBy` rouses an animal too: a hunter rouses anything but its own kind, and a person rouses
   every animal. That waking is new — the old head returned at the sleep check before it ever looked —
   and a new behaviour the player cannot see is a behaviour that is not there. The inspector's Thoughts
   panel is drawn for every species, so a thought is the row that shows it. */
test('an animal roused out of sleep gets a thought too', () => {
  for (const species of ['gnome', 'rabbit', 'deer']){
    const { api, a } = world();
    api.tick = api.days(1) + api.hours(23);
    const b = api.makeBeing(species, a.x + 20, a.y);
    b.asleep = true; b.seen = api.tick; b.thoughts = []; api.beings.push(b);
    api.step();
    const w = api.makeBeing('wolf', b.x + 3, b.y);
    w.asleep = false; api.beings.push(w);
    api.step();
    assert.equal(b.asleep, false, `a ${species} does not sleep through a wolf three tiles off`);
    const t = b.thoughts.find(q => q.key === 'woken');
    assert.ok(t, `a roused ${species} gets nothing the player can see`);
    assert.equal(t.text, 'Woke to something moving close by', `the ${species}'s line names no time of day, because a person rouses an animal by day too`);
  }
});

/* The thought must not outlive its own duration. `addThought` moves `until` to `tick + dur` on every
   call, and the pass calls it on every tick a threat is still there, so the half hour of
   `CLOCK.thought.woken` became permanent and its mood penalty of −6 with it. */
test('the woken thought ends at its until, even while the wolf stays', () => {
  const { api, a } = world();
  api.tick = api.days(1) + api.hours(22);
  /* Tired enough to go straight back to sleep, and wanting nothing else, so the person sleeps, is
     roused, and sleeps again for as long as the wolf is there. That loop is what renewed the thought:
     each waking moved `until` to `tick + CLOCK.thought.woken`. */
  a.asleep = true; a.hp = 100; a.seen = api.tick;
  a.needs.rest = 10;
  for (const k of ['food', 'water', 'warmth', 'social']) if (a.needs[k] !== undefined) a.needs[k] = 90;
  api.tileAt(a.x, a.y, 0).struct.fuel = 20000;
  api.step();
  const w = api.makeBeing('wolf', a.x + 4, a.y);
  w.asleep = false; api.beings.push(w);
  api.step();
  const t = a.thoughts.find(q => q.key === 'woken');
  assert.ok(t, 'the wolf roused the sleeper');
  const until = t.until;
  assert.equal(until, api.tick + api.CLOCK.thought.woken, 'the thought names the tick it is gone on');
  /* The wolf is held four tiles off and fed, so it neither leaves nor attacks, and the world runs a
     long way past the thought's own tick. Two things are watched. A live thought's `until` must never
     move, and the thought must lapse at least once: a waking that lands after it has gone starts a
     fresh half hour, which is honest, and that is why the test asks for a lapse rather than for the
     thought to stay away. */
  let cur = until, lapses = 0, extended = 0;
  while (api.tick < until + api.hours(2)){
    w.x = a.x + 4; w.y = a.y; w.asleep = false; w.needs.food = 90;
    api.step();
    const q = a.thoughts.find(q => q.key === 'woken');
    if (!q){ if (cur !== null) lapses++; cur = null; continue; }
    if (cur === null){ cur = q.until; lapses++; continue; }
    if (q.until === cur) continue;
    /* A new `until` is honest only if the old one had run out. A being roused on the very tick its
       thought expires lapses and wakes again inside one step, which is a lapse this loop cannot see
       from the outside, so it is read off the old tick instead. */
    if (cur <= api.tick) lapses++; else extended++;
    cur = q.until;
  }
  assert.equal(extended, 0, `a live woken thought had its until pushed forward ${extended} times, so its half hour never ends`);
  assert.ok(lapses > 0, `the woken thought never lapsed across ${api.tick - until} ticks past its own until, so the half hour of CLOCK.thought.woken means nothing`);
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

/* The kept threat list, and the three keys that say when it must be built again. The list is load
   bearing: task 3 misses its budget without it, because `threatsFor` runs for every being on every
   tick and the list turns a walk of seventy into a walk of three to eight.
 *
 * Nothing in the suite saw the list go wrong. The task 3 review deleted the tick key in a copy and got
 * `tests/beings-lazy.js` 13 pass, 0 fail and the full six-seed soak 65 pass, 0 fail with every working
 * record green. A stale list here is a wolf nobody saw, so each key now has a check that reds when
 * that key alone is gone.
 *
 * The oracle is the filter the cache stands in for: `beings.filter(b => b.species === 'human' ||
 * SPECIES[b.species].hunter)`, written out here so a change to the predicate must be made twice.
 *
 * Why each key is needed, and what breaks without it:
 *   `beings.length`   a being pushed inside a tick joins the valley without the tick moving and
 *                     without the array being replaced. Births, litters and arrivals all push. Without
 *                     this key the new wolf is invisible to every threat read until the next tick.
 *   `beings`          the prune at `src/sim/main.js`, the settle, and a loaded save all replace the
 *                     array rather than splice it, and a load can land on the same tick with the same
 *                     count. Without this key the list holds records that are no longer in the valley,
 *                     so a threat read answers about a world that no longer exists.
 *   the tick          the backstop for every other change to the contents of `beings` that keeps both
 *                     the array and its length — a member replaced in place, a species reassigned.
 *                     The review found no production path of that shape today, and that is worth
 *                     holding rather than trusting: without this key such a change is never corrected
 *                     at all, and the list can be a whole world day stale. */
const sourcesOracle = api => api.beings.filter(b => b.species === 'human' || api.SPECIES[b.species].hunter);

test('a being pushed inside a tick joins the kept threat list', () => {
  const { api, a } = world();
  const at = api.tick;
  assert.deepEqual(api.sourcesNow(), sourcesOracle(api), 'the warm list should match the filter');
  const w = api.makeBeing('wolf', a.x + 3, a.y, null, 0);
  api.beings.push(w);
  assert.equal(api.tick, at, 'the tick has not moved');
  assert.ok(api.sourcesNow().includes(w), 'a wolf pushed inside the tick is not in the kept list');
  assert.deepEqual(api.sourcesNow(), sourcesOracle(api));
});

test('a load replaces the beings array, and the kept threat list goes with it', () => {
  const { api } = world();
  const at = api.tick, n = api.beings.length;
  const old = api.sourcesNow();
  assert.ok(old.length > 0, 'the valley holds a threat source to begin with');
  api.loadSnapshot(api.takeSnapshot());
  assert.equal(api.tick, at, 'the load lands on the same tick');
  assert.equal(api.beings.length, n, 'the load lands on the same count');
  for (const b of api.sourcesNow()) assert.ok(api.beings.includes(b), `the kept list holds a ${b.species} the valley does not`);
  assert.deepEqual(api.sourcesNow(), sourcesOracle(api));
});

test('the tick rebuilds the kept threat list when nothing else can', () => {
  const { api, a } = world();
  assert.deepEqual(api.sourcesNow(), sourcesOracle(api), 'the warm list should match the filter');
  /* A member replaced in place: the array is the same array and it is the same length, so neither of
     the other two keys can see the change. Only the tick moving on rebuilds the list. */
  const i = api.beings.findIndex(b => b !== a && !(b.species === 'human' || api.SPECIES[b.species].hunter));
  assert.ok(i >= 0, 'the valley holds a being that is no threat source');
  const w = api.makeBeing('wolf', a.x + 3, a.y, null, 0);
  const was = api.beings.length;
  api.beings[i] = w;
  assert.equal(api.beings.length, was, 'the array is the same length');
  api.tick = api.tick + 1;
  assert.ok(api.sourcesNow().includes(w), 'the tick moved on and the kept list was not built again');
  assert.deepEqual(api.sourcesNow(), sourcesOracle(api));
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

/* ---------- the budget ----------
   THE BUDGET IS IN REFERENCE UNITS, NOT IN WALL SECONDS, AND IT NO LONGER STANDS DOWN. A wall second
   is a property of the machine, so this test used to print the seconds and then skip above a
   one-minute load average of 2. `node --test` runs the files of `npm run fast` in parallel -- eighteen
   at a time on the machine this was written on -- so the load inside the gate is always above 2 and
   the budget could never fire there. The task 4 review watched it skip at load 9.39 having measured
   5.02 s against a budget of five: it simulated three world days, held a figure over its own budget,
   and reported a skip. A guard that both measures and refuses to judge is the worst of the three
   shapes, because the summary reads as a pass and the figure sits in the detail.

   SO THE MEASUREMENT IS MADE LOAD-INDEPENDENT INSTEAD OF BEING ABANDONED. `refUnit` is a fixed lump of
   arithmetic, timed in this same process on each side of the day. Contention slows the day and the
   reference loop by the same factor, so their ratio holds while the raw seconds do not. Measured on
   seed r, day 3, on 18 cores:

     | one-minute load | the day, wall s | one reference unit, s | the day, in units |
     | 5.17            | 2.876           | 0.2343                | 12.27             |
     | 11.97           | 4.819           | 0.3925                | 12.28             |
     | 12.13           | 4.543           | 0.3770                | 12.05             |
     | 12.59           | 4.431           | 0.3532                | 12.55             |

   The three loaded rows were taken with `npm run fast` running beside them. The wall seconds moved by
   1.68 times and the units by 4 percent, which is the whole reason the budget is written in units.

   WHERE THE CEILING COMES FROM. One reference unit costs 0.235 s on a quiet machine of this kind,
   measured as the mean of eight repeats at a one-minute load average of 5.12 with a spread of 1
   percent. The budget was five wall seconds, so it is 5 / 0.235 = 21.3 units, and the ceiling is the
   whole number below that: 21 units, or 4.94 s quiet. That is the same budget read in another unit,
   rounded the strict way, and nothing was widened to make it fire.

   WHAT WOULD FOOL IT. The reference loop is arithmetic and the engine also walks the world's arrays,
   so a machine whose memory system is far slower than its arithmetic, relative to this one, reads a
   little high. The wall seconds and the load average are printed beside the units for that reason. The
   assertion is on the units, and it is made on every run: no load check remains, so there is no
   condition under which this test measures the day and then declines to judge it. */
const REF_ITERATIONS = 3e7;
const REF_QUIET_SECS = 0.235;   // what one reference unit costs on a quiet machine of this kind
const BUDGET_SECS = 5;          // the budget as it was written, in wall seconds
const BUDGET_UNITS = Math.floor(BUDGET_SECS / REF_QUIET_SECS);
function refUnit(){ let s = 0; for (let i = 1; i <= REF_ITERATIONS; i++) s += Math.sqrt(i) % 1.7; return s; }
function refSecs(){ const t0 = process.hrtime.bigint(); refUnit(); return Number(process.hrtime.bigint() - t0) / 1e9; }
test(`a world day at day 3 costs under ${BUDGET_UNITS} reference units, which is ${BUDGET_SECS} s on a quiet machine`, () => {
  refUnit();                                        // warm the loop, so the first timed pass is not the first run
  const ref1 = refSecs();
  const api = load();
  api.startWorld('r');
  const god = i => { for (const c of api.camps) if (c.pit && !c.everLit && c.coals <= i) api.inject({ source: 'player', act: 'light', x: c.pit[0], y: c.pit[1], z: 0 }); };
  let i = 0, secs = 0;
  for (let d = 1; d <= 3; d++){
    const t0 = process.hrtime.bigint();
    for (const end = i + api.DAY; i < end; i++){ api.step(); god(i); }
    secs = Number(process.hrtime.bigint() - t0) / 1e9;
  }
  /* One reference reading on each side of the day, so a machine that grew busier or quieter during the
     run is averaged rather than believed at one end. */
  const ref = (ref1 + refSecs()) / 2;
  const units = secs / ref;
  const load1m = os.loadavg()[0];
  console.log(`    day 3 on seed r: ${units.toFixed(2)} reference units of a budget of ${BUDGET_UNITS}; ` +
    `${secs.toFixed(2)} wall s, one reference unit ${ref.toFixed(4)} s, one-minute load average ${load1m.toFixed(2)}`);
  assert.ok(ref > 0.05 && ref < 5, `one reference unit took ${ref.toFixed(4)} s, which is nothing like the 0.235 s it is calibrated at: the yardstick itself is wrong and the reading below means nothing`);
  assert.ok(units < BUDGET_UNITS, `a world day at day 3 took ${units.toFixed(2)} reference units and the budget is ${BUDGET_UNITS} (${secs.toFixed(2)} wall s at a one-minute load average of ${load1m.toFixed(2)}, one reference unit ${ref.toFixed(4)} s)`);
});
