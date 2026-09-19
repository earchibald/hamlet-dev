// The soak: six seeds for 70 days, with assertions.
//   node tests/soak.js                     full run, about 15 seconds a seed
//   SEEDS=r DAYS=10 node tests/soak.js     a quick run
//   UPDATE_GOLDEN=1 node tests/soak.js     bless new numbers after a rule change
//
// The golden record (tests/soak-golden.json) holds a fingerprint of each
// seed's run. Any change to the rules changes it. That is the point: after a
// change to the core, look at the printed numbers, decide the change is what
// you meant, then bless it. The record is only checked on the default run.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('../src/sim');
const { DAY, runDays, collect, runOn, countEvents, fingerprint, oddDeaths, denDeaths, cutOff, campLine, logGod, replayGod } = require('./lib/run');

const DEFAULT_SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'], DEFAULT_DAYS = 70;
const SEEDS = process.env.SEEDS ? process.env.SEEDS.split(',') : DEFAULT_SEEDS;
const DAYS = process.env.DAYS ? Number(process.env.DAYS) : DEFAULT_DAYS;
const isDefault = DAYS === DEFAULT_DAYS && SEEDS.join() === DEFAULT_SEEDS.join();
const GOLDEN = path.join(__dirname, 'soak-golden.json');
const golden = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : {};
let goldenDirty = false;

/* Deaths that are not old age, seen in the soak and not yet traced, by seed. Each is a bug until
   proven otherwise. Trace with tests/trace-deaths.js <seed>. Remove an entry when the bug is fixed. */
const KNOWN_DEATHS = {};

/* `humans` (everyone ever) is a roughly 2x random variable across commits that never touch
   camp rules: a single seed has moved 34 -> 69, 57 -> 41 on unrelated changes, with 20 inside
   its tail. A per-seed floor on it goes red on good changes and stays green on bad ones. Watch
   `alive` per seed instead (a seed that actually collapses), and the sum of `humans` and `born`
   across all six seeds together, so a change that halves every population (as fishing once did)
   still fails. */
const sums = { humans: 0, born: 0, searched: 0, finds: 0, repaid: 0, benches: 0 };

/* The far country counters. A single seed may never send anyone to a cave, a den or a bench in 70 days,
   because the dens, caves and burrows sit in their makers' countries now. So each is floored across the six
   seeds together, at about a third of the measured sum, which catches a change that shuts a chain off
   everywhere without going red on one seed's stream. `densCleared` is a printed diagnostic only
   (design/notes.md, Known weak spots). */
const FAR_FLOOR = { searched: 2, finds: 1, repaid: 5, benches: 1 };

/* gamma's camp is capped by beds until one snare catch brings the hide for a hut (design/notes.md, Known weak spots); its floor is lower so an unrelated stream shift does not go red. */
const ALIVE_FLOOR = { gamma: 6 };

for (const seed of SEEDS){
  test(`seed ${seed}, ${DAYS} days`, async t => {
    const t0 = Date.now();
    const stranded = [];
    const { api, events } = runDays(seed, DAYS, (api, i) => { if (api.tick % 1000 === 0) stranded.push(...cutOff(api)); });
    const counts = countEvents(api, events), fp = fingerprint(api, events);
    t.diagnostic(`${seed}: ${Date.now() - t0} ms, ${events.length} chronicle lines`);
    t.diagnostic(api.camps.map(c => campLine(api, c)).join(' | '));
    t.diagnostic(JSON.stringify(counts));
    /* The creation, and the counters the countries swallowed. The dens, caves and burrows now sit in their own
       countries, and a camp may never reach them in 70 days. Printed, not asserted: see the plan-3 report. */
    t.diagnostic(`${seed}: creation ages ${api.creation.ages}, discards ${api.creation.discards}, made ${Object.keys(api.creation.made).sort().join(',')}`);
    t.diagnostic(`${seed}: far country reach: densCleared ${counts.densCleared}, searched ${counts.searched}, finds ${counts.finds}, borrowed ${counts.borrowed}, repaid ${counts.repaid}, benches ${counts.benches}`);

    await t.test('the first camp has a site, a pit, and a fire that was lit', () => {
      const c = api.camps[0];
      assert.ok(c.site, 'no site chosen'); assert.ok(c.pit, 'no fire pit built'); assert.ok(c.everLit, 'the pit was never lit');
    });
    await t.test('the creation ended on its own, and the valley holds a life', () => {
      const c = api.creation;
      assert.ok(c.settled && !c.failed, 'the creation did not settle');
      assert.equal(c.backstops, 0, 'the backstop fired');
      assert.ok(c.ages <= api.options.ageLimit, `${c.ages} ages`);
      /* A settle at the cap is kept whatever it lacks, so a seed that walks up to the cap hides a bad valley. */
      assert.ok(c.discards < api.MAX_DISCARDS, `${c.discards} discards`);
      assert.equal(c.gate.ok, true);
      for (const g of api.gods()) assert.ok(g.status === 'asleep' || g.status === 'dead', `${g.name} is ${g.status}`);
      for (const h of api.hills) assert.ok(h.mark && api.beingById(h.mark.by), 'a hill with no god behind it');
      for (const cv of api.caves.filter(cv => cv.kind === 'water')) assert.ok(cv.mark, 'a cave with no mark');
      for (const sc of api.sectors) assert.ok(api.regionById(sc.country), 'a sector with no country');
      assert.equal(events.filter(e => e.age !== undefined && /walks alone/.test(e.text)).length, 0, 'the first day line was stamped in the ages');
    });
    await t.test('someone is alive at the end', () => {
      assert.ok(counts.alive > 0, `all ${counts.humans} people are dead`);
    });
    await t.test('the camps grow', () => {
      sums.humans += counts.humans; sums.born += counts.born;
      for (const k in FAR_FLOOR) sums[k] += counts[k];
      assert.ok(counts.alive >= (ALIVE_FLOOR[seed] || 8) && counts.born >= 1, `only ${counts.alive} alive at day 70, ${counts.born} born`);
    });
    await t.test('nobody dies of anything but old age', { todo: KNOWN_DEATHS[seed] ? `known: ${KNOWN_DEATHS[seed].join(' ')}` : false }, () => {
      assert.deepEqual(oddDeaths(events), [], 'a death that is not old age is a bug until proven otherwise');
    });
    await t.test('at most one person a seed dies in a den', () => {
      const d = denDeaths(events); if (d.length) t.diagnostic(`${seed}: den deaths: ${d.join('; ')}`);
      assert.ok(d.length <= 1, `den deaths: ${d.join('; ')}`);
    });
    await t.test('nobody is cut off from their camp', () => {
      assert.deepEqual(stranded, [], 'a person who cannot walk home is trapped, and a trap is a bug');
    });
    await t.test('every camp with a pit keeps a chronicle of a lit fire', () => {
      for (const c of api.camps) if (c.pit) assert.ok(c.everLit, `${c.name} built a pit that was never lit`);
    });
    await t.test('the run matches the golden record', { skip: !isDefault && 'not the default run' }, () => {
      const g = golden[seed];
      if (!g || process.env.UPDATE_GOLDEN){ golden[seed] = { days: DAYS, ...fp, counts }; goldenDirty = true; t.diagnostic(`${seed}: golden record ${g ? 'updated' : 'written'}`); return; }
      const diffs = Object.keys(fp).filter(k => JSON.stringify(g[k]) !== JSON.stringify(fp[k]));
      const changed = Object.keys(counts).filter(k => JSON.stringify(g.counts[k]) !== JSON.stringify(counts[k])).map(k => `${k}: ${JSON.stringify(g.counts[k])} -> ${JSON.stringify(counts[k])}`);
      assert.deepEqual(diffs, [], `the story changed for seed ${seed}. Counts that moved: ${changed.join('; ') || 'none'}. If the change is intended, run UPDATE_GOLDEN=1 node tests/soak.js`);
    });
  });
}

/* The seventh: the snapshot held to the golden record. The world is saved halfway through, loaded into
   a fresh sim, and run on to day 70. Its story, from the first line to the last, must be the straight
   run's, which is what the golden line for this seed already holds. It runs the cheapest of the six
   seeds, and it reads the golden line; it never writes one. A run that is not the default run has no
   golden line to answer to, so it skips, as the six seeds' own golden test does. */
const SAVE_SEED = 'x', SAVE_DAY = 35;
test(`seed ${SAVE_SEED} saved on day ${SAVE_DAY}, loaded into a fresh sim, tells the same story to day ${DEFAULT_DAYS}`,
  { skip: !isDefault ? 'not the default run' : !golden[SAVE_SEED] ? `no golden line for seed ${SAVE_SEED} yet` : false }, t => {
  const t0 = Date.now(), half = SAVE_DAY * DAY;
  const a = load(); a.startWorld(SAVE_SEED);
  const ca = collect(a); ca.drain(); runOn(a, 0, half, ca);
  const snap = JSON.parse(JSON.stringify(a.takeSnapshot()));
  const b = load();
  assert.equal(b.loadSnapshot(snap), null, 'the save was refused');
  const cb = collect(b); cb.skipPresent();
  runOn(b, half, DEFAULT_DAYS * DAY - half, cb);
  const events = ca.events.concat(cb.events), fp = fingerprint(b, events);
  t.diagnostic(`${SAVE_SEED}: ${Date.now() - t0} ms, saved on day ${SAVE_DAY}, ${events.length} chronicle lines`);
  const g = golden[SAVE_SEED];
  const diffs = Object.keys(fp).filter(k => JSON.stringify(g[k]) !== JSON.stringify(fp[k]));
  assert.deepEqual(diffs, [], `the world saved on day ${SAVE_DAY} and loaded told another story. The snapshot lost or rebuilt something.`);
});

test('the six camps together grow', { skip: !isDefault && 'not the default run' }, t => {
  t.diagnostic(`sums across ${SEEDS.join(', ')}: humans ${sums.humans}, born ${sums.born}`);
  assert.ok(sums.humans >= 180 && sums.born >= 15, `sum of humans ${sums.humans} (want >= 180), sum of born ${sums.born} (want >= 15)`);
});

test('the far countries are reached', { skip: !isDefault && 'not the default run' }, t => {
  t.diagnostic(`far country sums across ${SEEDS.join(', ')}: ` + Object.keys(FAR_FLOOR).map(k => `${k} ${sums[k]}`).join(', '));
  for (const k in FAR_FLOOR) assert.ok(sums[k] >= FAR_FLOOR[k], `sum of ${k} ${sums[k]} (want >= ${FAR_FLOOR[k]})`);
});

test('the same seed tells the same story twice', () => {
  const a = runDays('r', 2), b = runDays('r', 2);
  assert.deepEqual(b.events.map(e => e.text), a.events.map(e => e.text));
  assert.deepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events));
});

test('a seed and its log replay the same story', () => {
  const a = runDays('r', 2);
  assert.ok(a.api.doorLog.length >= 1, 'the script god never lit a pit in two days');
  const b = runDays(a.api.replay.seed, 2, null, replayGod(a.api.replay), a.api.replay.options);
  assert.deepEqual(b.api.doorLog, a.api.doorLog);
  assert.deepEqual(b.events.map(e => e.text), a.events.map(e => e.text));
  assert.deepEqual(b.api.legends.map(e => e.text), a.api.legends.map(e => e.text));
  assert.deepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events));
});

test('a different log tells a different story', () => {
  const a = runDays('r', 2);
  const late = a.api.doorLog.map(e => ({ ...e, tick: e.tick + 300 }));
  const b = runDays('r', 2, null, logGod(late));
  assert.equal(b.api.doorLog.length, a.api.doorLog.length, 'the moved lighting was dropped, so the test proves nothing');
  assert.notDeepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events));
});

test('write the golden record', { skip: !isDefault && 'not the default run' }, () => {
  if (goldenDirty) fs.writeFileSync(GOLDEN, JSON.stringify(golden, null, 1) + '\n');
});
