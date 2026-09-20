// The soak: six seeds for THREE world days by default, with assertions.
//   node tests/soak.js                     the default run, six seeds, three world days
//   LONG=1 node tests/soak.js              seed r, seventy world days, about 67 minutes
//   LONG=1 SEEDS=r,x,alpha,beta,gamma,delta node tests/soak.js   the six-seed seventy-day run
//   SEEDS=r DAYS=10 node tests/soak.js     a quick run
//   UPDATE_GOLDEN=1 node tests/soak.js     rewrite the WORKING record after an intended change
//
// WHAT THE DEFAULT RUN ACTUALLY GATES, measured rather than assumed. At three
// world days each seed holds 2 to 3 people, no births and no deaths:
//
//   r 2   x 3   alpha 3   beta 2   gamma 3   delta 2      born 0   deaths {} on every seed
//
// So every assertion here that needs a population or a death is suspended or
// VACUOUS. "nobody dies of anything but old age" asserts a property of an
// empty set and passes, which is worse than a skip: a skip announces itself
// and a vacuous pass reads as coverage. The same is true to varying degrees of
// the den deaths, the walk home, and the lit-fire chronicle.
//
// What this run really gates is the working record -- the fingerprint and its
// 62 counters -- and that nothing throws. That is a very sensitive change
// DETECTOR: one one-line fault has been seen to move 21 of 33 counters. What it
// cannot do is say which direction is wrong. Detection without discrimination.
//
// The seventy-day gate is LONG=1 on seed r. The six-seed sums are owed once,
// as late as possible, before the G4 pull request opens.
//
// THE GAP THAT REMAINS, so it is not discovered at the merge: LONG=1 runs seed
// r ONLY. Every duration-dependent PER-SEED assertion -- deaths, den deaths,
// cut-off, the lit fire -- is therefore covered on r and on no other seed for
// the whole of G4. A fault that kills people only on gamma's stream is caught
// by nothing until the six-seed seventy-day run.
//
// The BLESSED record (tests/soak-golden.json) holds a fingerprint of each
// seed's run. Any change to the rules changes it. That is the point: after a
// change to the core, look at the printed numbers, decide the change is what
// you meant, then bless it. During G4 the comparison is against the WORKING
// record (tests/soak-working.json), which a task may rewrite and must say so in
// its report. No task writes the blessed one; the user blesses at task 11.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('../src/sim');
const { DAY, runDays, collect, runOn, countEvents, fingerprint, oddDeaths, denDeaths, cutOff, campLine, logGod, replayGod } = require('./lib/run');

/* Plan G4 made a world day 86,400 ticks, so a world day costs about fifteen seconds of real time
   until tasks 3 and 4 take the head off the tick and add the skip. Six seeds for seventy days would
   be near two hours. So the everyday soak is six seeds for three world days, which is about four and
   a half minutes, and the seventy-day run is kept behind LONG=1 on one seed.
   Three days is not a smaller seventy days. It is a different question: the first three days are the
   ones a new player sees, and a fire by day 3 is the first thing that must work. Every floor that
   three days cannot hold is suspended below rather than deleted, because a deleted floor is a gate
   nobody can find again. */
const LONG = !!process.env.LONG;
const DEFAULT_SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'], DEFAULT_DAYS = 3;
const SEEDS = process.env.SEEDS ? process.env.SEEDS.split(',') : LONG ? ['r'] : DEFAULT_SEEDS;
const DAYS = process.env.DAYS ? Number(process.env.DAYS) : LONG ? 70 : DEFAULT_DAYS;
const isDefault = !LONG && DAYS === DEFAULT_DAYS && SEEDS.join() === DEFAULT_SEEDS.join();
/* The record this run answers to. G4 moves the golden once, at the bless, and no task may write it:
   `tests/soak-golden.json` is the blessed record and this plan does not touch it. Until the bless,
   the soak answers to a working record that each task may rewrite and must say so in its report. */
const GOLDEN = path.join(__dirname, 'soak-working.json');
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
    /* Sampled on a multiple of the world's own beat, `CLOCK.every.cellular`, and not on a round 1000.
       The engine jumps from one horizon to the next now, and every horizon is a multiple of the beat or
       earlier, so a tick on the beat's grid is always visited and a tick off it may not be. A sample
       tick the run can skip is a sample that silently stops firing. 1200 ticks is twenty world
       minutes. It reads the world and changes nothing, so it moves no record. */
    const { api, events } = runDays(seed, DAYS, (api, i) => { if (api.tick % 1200 === 0) stranded.push(...cutOff(api)); });
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
    /* SUSPENDED, pending G4 task 4. A camp does not grow in three world days: nobody is born and the
       newcomers have not come. The floor is not deleted, because a deleted floor is a gate nobody can
       find again -- it is skipped here and run in full under LONG=1, and task 4 reports what a long
       run costs once the skip works so the user can rule on where it belongs. */
    await t.test('the camps grow', { skip: !LONG && 'suspended: three world days is too short. LONG=1 runs it' }, () => {
      assert.ok(counts.alive >= (ALIVE_FLOOR[seed] || 8) && counts.born >= 1, `only ${counts.alive} alive at day ${DAYS}, ${counts.born} born`);
    });
    /* The sums are gathered on every run, suspended or not: a skipped assertion must not also stop
       the counting, or the six-seed floors below would silently see zero and pass. */
    await t.test('the counts are gathered', () => {
      sums.humans += counts.humans; sums.born += counts.born;
      for (const k in FAR_FLOOR) sums[k] += counts[k];
      t.diagnostic(`${seed}: alive ${counts.alive}, ever ${counts.humans}, born ${counts.born}`);
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
      assert.deepEqual(diffs, [], `the story changed for seed ${seed}. Counts that moved: ${changed.join('; ') || 'none'}. This is the working record, not the blessed one: if the change is intended, run UPDATE_GOLDEN=1 node tests/soak.js and say so in the task report.`);
    });
  });
}

/* The seventh: the snapshot held to the working record. The world is saved halfway through, loaded into
   a fresh sim, and run on to the end. Its story, from the first line to the last, must be the straight
   run's, which is what the golden line for this seed already holds. It runs the cheapest of the six
   seeds, and it reads the golden line; it never writes one. A run that is not the default run has no
   golden line to answer to, so it skips, as the six seeds' own golden test does. */
/* Halfway through whatever the run is, so the oracle keeps its preconditions at any length: people
   walking, people at work, a fire alight. A fixed day 35 would be past the end of a three-day run. */
const SAVE_SEED = 'x', SAVE_DAY = DAYS / 2;
test(`seed ${SAVE_SEED} saved on day ${SAVE_DAY}, loaded into a fresh sim, tells the same story to day ${DEFAULT_DAYS}`,
  { skip: !isDefault ? 'not the default run' : !golden[SAVE_SEED] ? `no golden line for seed ${SAVE_SEED} yet` : false }, t => {
  const t0 = Date.now(), half = SAVE_DAY * DAY;
  const a = load(); const ca = collect(a); a.startWorld(SAVE_SEED);
  runOn(a, 0, half, ca);
  const snap = JSON.parse(JSON.stringify(a.takeSnapshot()));
  const b = load();
  assert.equal(b.loadSnapshot(snap), null, 'the save was refused');
  /* The collector goes on after the load, so it takes the loaded world's own new lines and not the
     window the snapshot restored. */
  const cb = collect(b);
  runOn(b, half, DEFAULT_DAYS * DAY - half, cb);
  ca.check(`${SAVE_SEED} before the save`); cb.check(`${SAVE_SEED} after the load`);
  const events = ca.events.concat(cb.events), fp = fingerprint(b, events);
  t.diagnostic(`${SAVE_SEED}: ${Date.now() - t0} ms, saved on day ${SAVE_DAY}, ${events.length} chronicle lines`);
  const g = golden[SAVE_SEED];
  const diffs = Object.keys(fp).filter(k => JSON.stringify(g[k]) !== JSON.stringify(fp[k]));
  assert.deepEqual(diffs, [], `the world saved on day ${SAVE_DAY} and loaded told another story. The snapshot lost or rebuilt something.`);
});

/* SUSPENDED, pending G4 task 4. Both floors were measured over seventy days and nothing like them
   happens in three. The numbers are left in the assertion rather than lowered to fit: a floor
   guessed at the new length would be a floor nobody measured, which reads as a gate and is not one.
   Task 4 reports what a long run costs once the skip works, and the user rules on where these sit.

   These two are SUMS ACROSS THE SIX SEEDS, so they need two things and not one: seventy days AND the
   six seeds. `LONG=1` gives the days and sets SEEDS to `['r']` alone, so under it these floors were
   being compared against one seed's counts and could not pass whatever the world did. `repaid >= 5`
   is gnome borrowing, and seed `r` ends seventy days with two gnomes and nothing borrowed, so that
   one is unreachable on `r` by construction.

   This is a DROPPED GUARD RESTORED, not a new precondition. On dev these carried a data-shape
   question and this branch swapped it for a duration question. Both belong. Note that `!isDefault`
   is the wrong way to write it here, because `isDefault` already contains `!LONG`: using it would
   skip these under LONG as well, which is the broken state reached by another road.

   Run them with: LONG=1 SEEDS=r,x,alpha,beta,gamma,delta node tests/soak.js
   That run is OWED ONCE before the G4 pull request opens, as late as possible, after the last task
   that can move population. A red there is a finding to diagnose, never a number to update, and it
   is the only place in G4 where these two floors are evaluated at all. */
const SIX_SEEDS = SEEDS.join() === DEFAULT_SEEDS.join();
const SUM_SKIP = LONG && SIX_SEEDS ? false
  : !LONG ? 'suspended: measured over 70 days on six seeds. LONG=1 SEEDS=r,x,alpha,beta,gamma,delta runs it'
  : `needs the six seeds; this run has ${SEEDS.join(', ')}`;
test('the six camps together grow', { skip: SUM_SKIP }, t => {
  t.diagnostic(`sums across ${SEEDS.join(', ')}: humans ${sums.humans}, born ${sums.born}`);
  assert.ok(sums.humans >= 180 && sums.born >= 15, `sum of humans ${sums.humans} (want >= 180), sum of born ${sums.born} (want >= 15)`);
});

/* SUSPENDED for the same two reasons: nobody walks to a far country in three days, and these are
   sums across the six seeds. */
test('the far countries are reached', { skip: SUM_SKIP }, t => {
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
