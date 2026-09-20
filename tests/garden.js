// Garden liveness: gardenLives() must give the same answer as the old whole-map scan,
// in every case, because PLACES.garden.spot picks a new spot with gardenSpot(), which calls
// rng(). A different boolean there moves the random stream and the whole story. The hand-built cases
// are fast; the two real runs are behind LONG=1, and say below what they cost.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
/* The day comes from the sim, through the shared runner, and is never written down here. A second
   copy of a constant in a test is not a check on the first: it agrees with whatever it was last set
   to. This file held `const DAY = 1000`, and when G4 made the world day 86,400 ticks the two real
   runs below asked for fifteen days and ran four world hours. */
const { DAY } = require('./lib/run');

/* The old predicate, kept here so the test does not trust the code it is checking. */
const oldLives = (api, c) => !!(c.garden && api.world.some(t => t.garden === c && t.feature === 'bush'));

/* A camp with a pit, standing at a chosen spot, ready to hold a hand-built garden. */
function readyCamp(seed = 'r'){
  const api = load(); api.startWorld(seed);
  const c = api.camps[0]; api.camp = c;
  const a = api.firstPerson(); api.setSite(a.x, a.y);
  const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: true }; c.pit = [t.x, t.y];
  c.everLit = true; c.tools.axe = 1;
  return { api, c };
}
/* Plant a garden by hand, the way MAKERS.garden does: four bush tiles, the DIRS neighbours of `at`. */
function plantGarden(api, c, at){
  c.garden = at;
  for (const [dx, dy] of api.DIRS){ const t = api.tileAt(at[0] + dx, at[1] + dy); t.feature = 'bush'; t.berries = 2; t.garden = c; }
}
function killBush(api, at){ const t = api.tileAt(...at); t.feature = null; t.berries = 0; t.garden = null; }

test('no garden yet: both predicates say false, and a spot is offered', () => {
  const { api, c } = readyCamp();
  assert.equal(oldLives(api, c), false);
  assert.equal(api.gardenLives(), false);
  assert.ok(api.placeFor(api.RECIPES.find(r => r.id === 'garden')) !== null, 'a garden not yet planted must be offered a spot');
});

test('a garden with four live bushes: both predicates say true, and no new spot is offered', () => {
  const { api, c } = readyCamp();
  const at = [c.pit[0] + 10, c.pit[1] + 10];
  plantGarden(api, c, at);
  assert.equal(oldLives(api, c), true);
  assert.equal(api.gardenLives(), true);
  assert.equal(api.placeFor(api.RECIPES.find(r => r.id === 'garden')), null, 'a live garden must not be offered a new spot');
});

test('three of four bushes dead: the garden still lives, on both predicates', () => {
  const { api, c } = readyCamp();
  const at = [c.pit[0] + 10, c.pit[1] + 10];
  plantGarden(api, c, at);
  for (const [dx, dy] of api.DIRS.slice(0, 3)) killBush(api, [at[0] + dx, at[1] + dy]);
  assert.equal(oldLives(api, c), true);
  assert.equal(api.gardenLives(), true);
});

test('all four bushes dead: both predicates say false, and a new spot is offered', () => {
  const { api, c } = readyCamp();
  const at = [c.pit[0] + 10, c.pit[1] + 10];
  plantGarden(api, c, at);
  for (const [dx, dy] of api.DIRS) killBush(api, [at[0] + dx, at[1] + dy]);
  assert.equal(oldLives(api, c), false);
  assert.equal(api.gardenLives(), false);
  assert.ok(api.placeFor(api.RECIPES.find(r => r.id === 'garden')) !== null, 'a dead garden must be offered a new spot again');
});

test('a garden at the map edge: no throw, and both predicates agree', () => {
  const { api, c } = readyCamp();
  const at = [0, 0];
  c.garden = at;
  /* Only the in-bounds DIRS neighbours of a corner tile can hold a bush. */
  for (const [dx, dy] of api.DIRS){
    const x = at[0] + dx, y = at[1] + dy;
    if (!api.hasTile(x, y, 0)) continue;
    const t = api.tileAt(x, y); t.feature = 'bush'; t.berries = 2; t.garden = c;
  }
  assert.equal(oldLives(api, c), true);
  assert.doesNotThrow(() => api.gardenLives());
  assert.equal(api.gardenLives(), true);
  for (const [dx, dy] of api.DIRS){
    const x = at[0] + dx, y = at[1] + dy;
    if (!api.hasTile(x, y, 0)) continue;
    killBush(api, [x, y]);
  }
  assert.equal(oldLives(api, c), false);
  assert.equal(api.gardenLives(), false);
});

/* A real run: seeds r and x, with the script god that lights each camp's pit, run long enough for a
   garden to be planted and a few days past it, comparing the old scan and the new helper for every
   camp. Checking every tick over many days is too slow, since the old predicate alone reads the whole
   map, so the run checks forty times a day: enough to catch a garden planted mid-run or a bush burned
   by lightning. Forty a day is the number this file was written with; it was `N = 25` when a day was
   1,000 ticks, and it is `DAY / 40` now, so the cadence is the one that was chosen and not the
   integer that expressed it.

   The fifteen days are the ones that were chosen too. Measured on this branch with the script god
   above: seed r plants its first garden at tick 479,634, which is day 5.55, and seed x at tick
   547,692, day 6.34. Fifteen days holds both plantings and more than eight days past the later one.
   Before the conversion the loop ran 15,000 ticks, 0.17 of a world day, and neither seed reached a
   garden at all: the vacuity guard below was the only thing still speaking. */
function scriptGod(api, i){
  for (const c of api.camps) if (c.pit && !c.everLit && c.coals <= i) api.inject({ source: 'player', act: 'light', x: c.pit[0], y: c.pit[1], z: 0 });
}
function checkAllCamps(api, seed, tick){
  for (const c of api.camps){
    api.camp = c;
    assert.equal(api.gardenLives(), oldLives(api, c), `seed ${seed} tick ${tick} camp ${c.name || '(unnamed)'}: gardenLives diverged from the whole-map scan`);
  }
  api.camp = api.camps[0];
}

const DAYS = 15, CHECKS_A_DAY = 40, N = Math.round(DAY / CHECKS_A_DAY);
/* Fifteen world days of two seeds costs more than a fast test may take, and the answer is the flag,
   never a smaller day count: a run cut to fit the clock keeps the green and drops the claim.
   MEASURED_SECS is what the two runs took together on the branch, at the load average named. */
const MEASURED_SECS = 133;
const TOO_LONG = process.env.LONG ? false
  : `${DAYS} world days on each of two seeds: ${MEASURED_SECS} s together, measured on this branch with \`time LONG=1 node --test tests/garden.js\` on an 18-core Mac at one-minute load average 8.3. LONG=1 runs it. The hand-built cases above run every time.`;

for (const seed of ['r', 'x']){
  test(`real run, seed ${seed}: gardenLives matches the whole-map scan for every camp, ${CHECKS_A_DAY} times a day over ${DAYS} days`, { skip: TOO_LONG }, () => {
    const api = load(); api.startWorld(seed);
    let sawGarden = false;
    for (let i = 0; i < DAYS * DAY; i++){
      api.step(); scriptGod(api, i);
      if (i % N === 0){
        checkAllCamps(api, seed, i);
        if (api.camps.some(c => c.garden)) sawGarden = true;
      }
    }
    assert.ok(sawGarden, `seed ${seed}: no camp ever planted a garden in ${DAYS} days; the comparison had nothing live to check`);
  });
}
