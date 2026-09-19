/* The chronicle test seam.

   `chronicle` keeps its last 300 lines and drops the rest. So a harness that reads it after the
   fact sees only what survived, and a run whose fingerprint covers two thirds of the story reports
   itself as a pass. Nothing goes red. These tests are what make that impossible. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const { collect, runDays } = require('./lib/run');

/* Seed `sweep23` writes 965 creation lines, which is the longest of 40 creations measured on dev
   cb903eb. The next four are 224, 203, 190 and 167, and the six soak seeds are 73 to 121. So this
   seed is the one that shows the fault and the soak's own seeds are the reason nobody saw it. */
const LONG_SEED = 'sweep23';

test('a long creation overruns the chronicle, which is why the sink exists', () => {
  const api = load(); api.startWorld(LONG_SEED);
  assert.equal(api.chronicle.length, 300, 'the chronicle no longer trims at 300; this test is stale');
  assert.ok(api.chronicleWritten > 900, `the creation wrote ${api.chronicleWritten} lines, so the seed has changed`);
  /* `legends` never trims, so it holds what the chronicle dropped. The gap is the loss. */
  assert.ok(api.legends.length > api.chronicle.length + 600,
    `only ${api.legends.length - api.chronicle.length} lines were beyond the chronicle's window`);
});

test('the collector takes every line of a long creation', () => {
  const api = load();
  const c = collect(api);
  api.startWorld(LONG_SEED);
  assert.equal(c.from, 0, 'the collector was watching before the world began');
  assert.equal(c.events.length, api.chronicleWritten, 'the collector missed a line');
  /* The point of the whole change: more than the chronicle could have held. */
  assert.ok(c.events.length > 900, `only ${c.events.length} lines were taken`);
  c.check(LONG_SEED);
});

test('a collector that starts after the world does is caught, not tolerated', () => {
  const api = load(); api.startWorld(LONG_SEED);
  const c = collect(api);
  assert.ok(c.from > 900, 'the creation should already have been written');
  /* `check` proves only that nothing was dropped since it started watching, which is true here and
     says nothing about the 965 lines it never saw. `from` is what says that. */
  c.check('late collector');
});

test('runDays refuses a run it did not watch from the start', () => {
  /* The guard is in `runDays` itself, so this is the regression test for the caller order. The run
     is one day, which is enough for the creation to be logged. */
  const { api, events } = runDays(LONG_SEED, 1);
  assert.equal(events.length, api.chronicleWritten, 'the run lost lines');
  assert.ok(events.length > 900, `a one-day run on ${LONG_SEED} took only ${events.length} lines`);
});

test('the sink is off unless a harness asks, and it is not world state', () => {
  const api = load();
  api.startWorld('r');
  /* Nothing in the game sets it: a world nobody watches counts its lines and keeps no array. */
  assert.ok(api.chronicleWritten > 0);
  const snap = api.takeSnapshot();
  assert.ok(!('chronicleSink' in snap) && !('chronicleWritten' in snap), 'the seam reached the save');
  const b = load();
  assert.equal(b.loadSnapshot(JSON.parse(JSON.stringify(snap))), null, 'the save was refused');
  /* A loaded world has written nothing of its own, so a collector built now sees the whole of what
     follows and none of what the snapshot restored. */
  const c = collect(b);
  assert.equal(c.from, 0);
  assert.equal(c.events.length, 0);
});
