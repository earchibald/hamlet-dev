// The beats: the cellular systems run off one beat, not off every tick. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

/* The six systems the plan calls cellular. They look at the world rather than at a being, and none
   of them needs to run at a tick's resolution: a minute of world time is finer than anything a
   player can see in a plant growing or a fire spreading. Task 4 needs each one's next beat, which is
   why `beats` records it rather than the count alone. */
const CELLULAR = ['growPlants', 'spreadFire', 'updateWeather', 'strayLightning', 'rotCarcasses', 'groveTick'];

test('the cellular beat is a minute of world time', () => {
  const api = load();
  assert.equal(api.CLOCK.every.cellular, api.mins(1));
  assert.equal(api.CLOCK.every.cellular, 60);
  assert.equal(api.DAY / api.CLOCK.every.cellular, 1440, 'a world day holds 1,440 minutes');
});

test('each cellular system runs 1,440 times in a world day, not 86,400', () => {
  const api = load();
  api.startWorld('r', {});
  const from = { };
  for (const k of CELLULAR) from[k] = api.beats[k].runs;
  for (let i = 0; i < api.DAY; i++) api.step();
  for (const k of CELLULAR){
    const runs = api.beats[k].runs - from[k];
    assert.equal(runs, 1440, `${k} ran ${runs} times in a world day, not 1,440`);
  }
});

/* The look count is the one number that must NOT change with the beat. Sixty thousand looks a world
   day was the world's rate before the retune and it is still the world's rate: the beat changes how
   they are spent, not how many there are. Task 1's finding 5 is why this is checked by counting the
   looks rather than by reading `plant.samples`. */
test('growPlants still looks at sixty thousand tiles a world day, spent 42 a run', () => {
  const api = load();
  api.startWorld('r', {});
  const from = api.beats.growPlants.looks;
  for (let i = 0; i < api.DAY; i++) api.step();
  const looks = api.beats.growPlants.looks - from;
  assert.ok(Math.abs(looks - 60000) / 60000 < 0.02, `${looks} looks a world day, want 60,000 within 2 percent`);
  const perRun = looks / 1440;
  assert.ok(Math.abs(perRun - 41.7) < 2, `${perRun.toFixed(1)} looks a run, want about 42`);
});

/* Task 4 reads `next` to build its horizon. A beat that cannot be named ahead of time is a beat that
   pins the skip, so every one of the six must carry a tick in the future and it must be a multiple
   of the beat. */
test('every cellular system names the tick of its next beat', () => {
  const api = load();
  api.startWorld('r', {});
  for (let i = 0; i < 500; i++) api.step();
  for (const k of CELLULAR){
    const n = api.beats[k].next;
    assert.equal(typeof n, 'number', `${k} has no next beat`);
    assert.ok(n > api.tick, `${k}'s next beat ${n} is not ahead of tick ${api.tick}`);
    assert.equal(n % api.CLOCK.every.cellular, 0, `${k}'s next beat ${n} is not on the beat`);
  }
});

/* ---------- the calibration ----------
   The beats must not have moved the world's rates. `tests/calibrate-beats.json` holds one world day
   on each of the six seeds, measured on the commit BEFORE the beats landed, and this checks the same
   day against it.

   IT COMPARES SUMS ACROSS THE SIX SEEDS, NOT SEED BY SEED, and the reason is the whole point of the
   test. Putting a system on a beat changes the order in which random numbers are drawn, so every
   seed tells a different story afterwards. Seed by seed the differences here run from -29 to +32 per
   cent on berries and -56 to +18 on bushes, and none of that is a rate: it is one stream against
   another. Summed, the six seeds are a measurement of the rate itself, and the rate is what the beat
   was supposed to leave alone. A per-seed threshold would fail on noise, and a test that fails on
   noise is a test people learn to re-run until it passes.

   Bushes seeded is the small number -- about 100 across six seeds -- so it carries the most noise.
   If it drifts far outside the band, look for a chance that was rolled when it should not have been:
   a chance for one LOOK must not be rolled over the beat, because the look count already carries the
   world time. That was task 1's finding 5 and it is the fault this test is shaped to catch. */
const BAND = 0.15;
test('the beats leave the world\'s rates where they were', () => {
  const base = require('./calibrate-beats.json');
  const api = load();
  const seeds = Object.keys(base);
  let wasBerries = 0, isBerries = 0, wasBushes = 0, isBushes = 0;
  for (const seed of seeds){
    const a = load(); a.startWorld(seed, {});
    const count = () => { let b = 0, s = 0; for (const t of a.world){ b += t.berries || 0; if (t.feature === 'bush') s++; } return { b, s }; };
    const c0 = count();
    for (let i = 0; i < a.DAY; i++) a.step();
    const c1 = count();
    isBerries += c1.b - c0.b; isBushes += c1.s - c0.s;
    wasBerries += base[seed].berriesGrown; wasBushes += base[seed].bushesSeeded;
  }
  const off = (now, was) => Math.abs(now - was) / was;
  assert.ok(off(isBerries, wasBerries) < BAND,
    `berries grown across six seeds: ${wasBerries} before the beats, ${isBerries} after, ${(100 * off(isBerries, wasBerries)).toFixed(1)} percent apart`);
  assert.ok(off(isBushes, wasBushes) < BAND,
    `bushes seeded across six seeds: ${wasBushes} before the beats, ${isBushes} after, ${(100 * off(isBushes, wasBushes)).toFixed(1)} percent apart`);
});

/* Two cellular systems keep a longer period of their own INSIDE the beat: `rotCarcasses` asks
   `tick % CLOCK.every.carcassRot` and `groveTick` asks `tick % CLOCK.grove.every`. A tick only
   reaches those lines when it is already a multiple of the beat, so a period that is not itself a
   multiple of the beat is never hit and the system stops happening in silence. Nothing goes red: the
   carcasses simply never rot and the groves never bear. That is task 1's berry fault wearing a
   different coat, and this is the guard that would catch it. */
test('every period nested inside the beat is a multiple of the beat', () => {
  const api = load();
  const beat = api.CLOCK.every.cellular;
  const nested = { 'CLOCK.every.carcassRot': api.CLOCK.every.carcassRot, 'CLOCK.grove.every': api.CLOCK.grove.every };
  for (const [name, period] of Object.entries(nested)){
    assert.equal(typeof period, 'number', `${name} must be a number to be nested inside the beat`);
    assert.equal(period % beat, 0,
      `${name} is ${period}, which is not a multiple of the ${beat}-tick beat, so the rule behind it never runs`);
  }
});
