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
/* One guard per claim, each with its own number, neither read off DEFAULT_DAYS. See tests/lib/claims.js. */
const { seasonClaimSkip, oldAgeClaimSkip } = require('./lib/claims');

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
const sums = { humans: 0, born: 0, searched: 0, finds: 0, repaid: 0, benches: 0, grown: 0 };

/* The other end of the life table: a child born in the run who is alive at the end and past
   'young'. Measured on the six default seeds at 70 days: r 2, x 1, alpha 3, beta 6, gamma 3,
   delta 3, 18 together, out of 37 born. A per-seed floor of 1 rests on seed x's single child, and
   `born` is the same swinging variable the comment above describes, so the claim is floored across
   the six seeds together, at about a third of the measured sum.

   The reason for summing is margin, not reachability. Beta alone made 6, so a single seed can carry
   the whole summed floor. That is unlike `FAR_FLOOR` below, where a seed may genuinely never send
   anyone to a cave in 70 days and the sum is the only way to make a claim at all. Here the sum only
   buys room for the swing in `born`. */
const GROWN_FLOOR = 6;

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
    /* `seasonOf()` reads the tick and draws no random number, so watching it cannot move the stream. */
    const seasonsSeen = new Set();
    const { api, events } = runDays(seed, DAYS, (api, i) => { seasonsSeen.add(api.seasonOf()); if (api.tick % 1000 === 0) stranded.push(...cutOff(api)); });
    const counts = countEvents(api, events), fp = fingerprint(api, events);
    t.diagnostic(`${seed}: ${Date.now() - t0} ms, ${events.length} chronicle lines`);
    t.diagnostic(api.camps.map(c => campLine(api, c)).join(' | '));
    t.diagnostic(JSON.stringify(counts));
    /* The creation, and the counters the countries swallowed. The dens, caves and burrows now sit in their own
       countries, and a camp may never reach them in 70 days. Printed, not asserted: see the plan-3 report. */
    t.diagnostic(`${seed}: creation ages ${api.creation.ages}, discards ${api.creation.discards}, made ${Object.keys(api.creation.made).sort().join(',')}`);
    t.diagnostic(`${seed}: seasons visited: ${[...seasonsSeen].join(', ') || 'none'}`);
    t.diagnostic(`${seed}: far country reach: densCleared ${counts.densCleared}, searched ${counts.searched}, finds ${counts.finds}, borrowed ${counts.borrowed}, repaid ${counts.repaid}, benches ${counts.benches}`);
    /* The life table, read off the beings at the end. A dead being's last age comes from `diedAt`,
       because `ageDays()` measures from the live tick and goes on counting after the death. A human
       with parents was born inside the run; everyone else walked into the valley already grown, at
       an age between `adult` and `old` (src/sim/beings.js, makeBeing). The day counts are read from
       LIFE, never copied, so the numbers follow the table when it moves to real units.

       `diedAt` is stamped in `die()` (src/sim/beings.js:65) and nowhere else, so `lastAge` is NaN
       for a being taken off the board another way. Three paths do that today: the snared rabbit
       (beings.js:330), the deer in the pitfall (beings.js:338) and an unmade god (gods.js:467).
       All three are non-human, so no number here is touched. A human killed down a path like
       those would answer NaN to every comparison below. It drops out of `grown` and `pastSpan`
       in silence. It does not leave quietly, though: `oldestHuman` spreads the NaN through
       `Math.max`, and the diagnostic below prints `NaN` days. So a fourth such path needs
       `diedAt` with it. */
    const LH = api.LIFE.human;
    const lastAge = b => ((b.alive ? api.tick : b.diedAt) - b.born) / api.DAY;
    const bornHere = api.beings.filter(b => b.species === 'human' && b.parents);
    /* `grown` asks `stage()`, the function every rule in the sim consults, rather than recomputing
       the age against `LIFE.human.adult`. An assertion on the arithmetic would hold while `stage()`
       was frozen at 'young', which is one of the mechanisms the claim below names. `stage()` reads
       the live tick, so it is asked only of a being still alive: for a dead child it would answer
       for the age that child would have been, and a run that killed every child would still count
       them as grown. */
    const grown = bornHere.filter(b => b.alive && api.stage(b) !== 'young');
    const pastSpan = api.beings.filter(b => b.species === 'human' && lastAge(b) > LH.life);
    const oldestHuman = Math.max(0, ...api.beings.filter(b => b.species === 'human').map(lastAge));
    /* Human old-age deaths, counted by tag and not by text. `counts.oldAge` in tests/lib/run.js is
       a substring count over every chronicle line, and a gnome's death line is `A gnome died of old
       age.` (src/sim/beings.js:83), so a gnome feeds it. `counts.oldAge` itself is left as it is:
       the golden record holds it.

       Read why this count is human-only, because it is not what it looks like. The tag does NOT
       name a species. `die()` is handed `warm ? 'old' : 'oldCold'` for every species that passes
       its span (beings.js:374), and a gnome is never `warm`, so a gnome's death is an 'oldCold'
       death. What separates them is one line: the human branch calls `log(text, [a], 'death', tag)`
       (beings.js:69) and the gnome branch calls `log(text, [], 'death')` (beings.js:83) with no
       tag argument at all. A death EVENT carries a tag only because the gnome line forgets to pass
       one. Add a tag to beings.js:83 and this count silently takes gnomes back in.

       The event has nothing better to filter on. `log()` builds `{ tick, when, text, kind, tag,
       camp }` (src/sim/core.js:181) and the `who` array it is given feeds only `a.history` and
       `a.deeds`, so no being id and no species reaches the chronicle line. A run's events were
       enumerated to check it: the fields are age, camp, kind, nameKnown, names, tag, text, tick,
       when. So the count rests on the tag, and the assertion below carries a guard against the day
       beings.js:83 changes.

       That guard is dormant at `DEFAULT_DAYS`. A tag added to beings.js:83 leaves all six seeds
       green at 70 days, and turns all six red at 90 days. The arithmetic behind the two numbers is
       written out at the old-age claim below. Read the guard as a tripwire for a longer run, not
       as a check the default soak performs. */
    const humanOldAge = events.filter(e => e.kind === 'death' && (e.tag === 'old' || e.tag === 'oldCold')).length;
    /* The guard's other half, read off the beings, where the species IS named. The old-age roll
       fires at `ageDays(a) > LIFE[a.species].life` and `diedAt` is that same tick, so every human
       killed by the roll is a dead human whose last age passed the span. The count can only be the
       larger of the two. It is one-directional on purpose: a human who passes the span and is then
       killed by something else lifts this number and not the tag count, and that death is the
       sibling claim's business, not this one's. */
    const humanOldDead = api.beings.filter(b => b.species === 'human' && !b.alive && lastAge(b) > LH.life).length;
    t.diagnostic(`${seed}: life table (adult ${LH.adult}, old ${LH.old}, span ${LH.life} days): ${bornHere.length} born here, ${grown.length} of them alive and grown up; ${pastSpan.length} passed the span, ${humanOldAge} people died of old age (${counts.oldAge} lines of old age all told, gnomes too, if any); oldest ${oldestHuman.toFixed(1)} days`);

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
    /* The sums feed two claims that only the default run makes, so they are gathered outside the
       guarded test below, which does not run on a short run. */
    sums.humans += counts.humans; sums.born += counts.born; sums.grown += grown.length;
    for (const k in FAR_FLOOR) sums[k] += counts[k];
    /* Every season, not just winter. The soak floors outcomes, and an outcome can hold while the
       mechanism behind it never fires: a year long enough to swallow the run leaves every
       `seasonOf()` and `isWinter()` read site dead, with no failing test and no diff (issue #94).
       A claim that winter was reached would pass a calendar that had lost summer and autumn, so
       every season is named, and the message names the ones that went missing.

       The seasons are read from `api.SEASONS`, not copied here: a fifth season added to the table
       must widen this claim, not leave the soak asserting four for ever. The table cannot widen
       today: `seasonOf()` takes `% 4` and `years()` multiplies by `* 4`, both hardcoded in
       `src/sim/clock.js` (issue #103). So do not read this line as proof that the sim is
       season-count-agnostic. It is not.

       Guarded on the day count alone, not on `isDefault`. The claim does not depend on the seed,
       and `SEEDS=r DAYS=70` is the common quick check, which is exactly where a calendar change
       would otherwise slip past. The guard does not read the calendar either. A guard of
       `DAYS * DAY >= years(1)` would switch the claim off on the very change it is here to report:
       a year of 1460 days is not crossed by 70, so the claim would skip instead of failing.

       The guard is `SEASON_CLAIM_DAYS`, one year, in tests/lib/claims.js. It is this claim's own
       number, not the soak's run length: a 40-day run visits every season and makes the claim. */
    await t.test('the run visits every season', { skip: seasonClaimSkip(DAYS) }, () => {
      const missing = api.SEASONS.filter(s => !seasonsSeen.has(s));
      assert.deepEqual(missing, [], `the ${DAYS}-day run never reached ${missing.join(', ')}. It saw ${[...seasonsSeen].join(', ') || 'no season at all'}. A season nobody reaches leaves every rule that reads it dead.`);
      /* The order too, tolerant of where the year starts. `seasonsSeen` is a Set in first-sight
         order, so it reads spring, summer, autumn, winter only because every seed begins at tick
         293, which is day 1. A world-gen change that moved the start tick would rotate that list,
         and a fixed sequence would go red for the wrong reason. So the claim is that the seasons
         arrive in `SEASONS` order from wherever the run begins. */
      const seen = [...seasonsSeen], from = api.SEASONS.indexOf(seen[0]);
      const inOrder = api.SEASONS.map((_, i) => api.SEASONS[(from + i) % api.SEASONS.length]);
      assert.deepEqual(seen, inOrder, `the seasons arrived as ${seen.join(', ')}, which is not ${api.SEASONS.join(', ')} read round from ${seen[0]}`);
    });
    /* The floors are measured on 70 days. A shorter run cannot reach them, and a floor invented to
       fit ten days would be a number nobody has measured. So the claim is not made, and the skip
       says so, as the golden record and the two sum tests already do. */
    await t.test('the camps grow', { skip: !isDefault && 'not the default run' }, () => {
      assert.ok(counts.alive >= (ALIVE_FLOOR[seed] || 8) && counts.born >= 1, `only ${counts.alive} alive at day ${DAYS}, ${counts.born} born`);
    });
    await t.test('nobody dies of anything but old age', { todo: KNOWN_DEATHS[seed] ? `known: ${KNOWN_DEATHS[seed].join(' ')}` : false }, () => {
      assert.deepEqual(oddDeaths(events), [], 'a death that is not old age is a bug until proven otherwise');
    });
    /* The soak's headline rule is that any death which is not old age is a bug. That rule filters
       the deaths by cause, and a filter agrees with an empty set: if old-age death stopped firing
       altogether, `oddDeaths` would stay empty and every seed would still be green (issue #94). So
       the mechanism answers for itself. Old age is rolled in one place, at `ageDays(a) >
       LIFE[a.species].life`, behind `CLOCK.rate.oldAgeDeath` divided by hardiness
       (src/sim/beings.js:371). Other causes end a life a few lines further down, where hp at or
       below zero kills by fire, thirst, hunger or cold (beings.js:378). The one place is the old-age
       roll, and that is all this claim needs.

       The count is human-only, and it is a tag count for that reason. `counts.oldAge` is a
       substring match over the whole chronicle: `ev` at tests/lib/run.js:81, summed at :93. The
       gnome branch of `die()` writes `A gnome died of old age.` into that same chronicle
       (beings.js:83), so the text match would count a gnome's death as a person's. It reads
       species-exact today for one reason only. `LIFE.gnome.life` is 110 days
       (src/sim/species.js:2), a gnome walks in between 20 and 35 days old (beings.js:12), and 70
       days cannot carry it past the span. Raise DAYS to about 90, or lower that 110, and the text
       count takes gnomes in. Of the five species branches in `die()`, only human (:69) and gnome
       (:83) put `cause` into a chronicle line, so the gnome is the single contaminant.

       Two plants measured it, on seed r unless stated. Drop the `tag` argument from the human line
       at beings.js:69: the tag count falls to 0 while `counts.oldAge` holds at 12, so the tag
       reading goes red where the text reading stays green. Add a tag to beings.js:83 instead: all
       six seeds stay green at 70 days, and all six go red at 90. That second pair is the dormancy
       above, arriving, and it is the same fact the `humanOldAge` guard note records.

       A future mourning line that logged a dead elder's full name would open the text count another
       way: `FATE_EPITHETS.oldCold` is the string 'who died of old age' (src/sim/names.js:766),
       which reaches no sim path today because `fullName()` is read only in src/ui/. A tag count
       closes both, and see `humanOldAge` above for why it is human-only, which is not the reason a
       reader expects.

       Measured on the six default seeds at 70 days: 12, 6, 5, 15, 6, 8 old-age deaths, out of 14,
       6, 7, 16, 7, 8 people who passed the span. Every seed reaches it several times over, so the
       claim is made per seed and not summed.

       Guarded on the day count alone, like the season claim above, because it does not depend on
       the seed: a newcomer walks in between `adult` and `old` days old, so 70 days carries the
       older ones past a span of `life` whatever the valley looks like. The guard does not read
       LIFE. A guard of `DAYS >= LIFE.human.life - LIFE.human.old` would switch the claim off on a
       table change, which is the change it is here to report.

       The guard is `OLD_AGE_CLAIM_DAYS` in tests/lib/claims.js, a measured floor of 70 days. It is a
       separate number from the season claim's above, which needs a year and no more. */
    await t.test('somebody dies of old age', { skip: oldAgeClaimSkip(DAYS) }, () => {
      assert.ok(humanOldAge >= 1, `no person died of old age in ${DAYS} days, though ${pastSpan.length} people passed LIFE.human.life (${LH.life} days) and the oldest reached ${oldestHuman.toFixed(1)}. The rule below, that a death which is not old age is a bug, has nothing to filter until this fires.`);
      assert.ok(humanOldAge <= humanOldDead, `${humanOldAge} death lines carry an old-age tag, but only ${humanOldDead} people are dead and past the span. A tagged old-age death that is nobody's means the tag is no longer a person's alone: src/sim/beings.js:83 logs a gnome's death, and the count above is human-only only while that line passes no tag.`);
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

test('the six camps together grow', { skip: !isDefault && 'not the default run' }, t => {
  t.diagnostic(`sums across ${SEEDS.join(', ')}: humans ${sums.humans}, born ${sums.born}`);
  assert.ok(sums.humans >= 180 && sums.born >= 15, `sum of humans ${sums.humans} (want >= 180), sum of born ${sums.born} (want >= 15)`);
});

/* The young end of the life table. `born >= 1` is already floored per seed, but a birth is only the
   start of the passage: nothing said a child ever grew up, so the whole young-to-adult transition
   was unnamed, and a change that killed every child, or froze `stage()` at 'young', would leave the
   soak green (issue #94). `stage()` writes no chronicle line when it turns, so the claim is read off
   the beings at the end instead of counted from the events, and it asks `stage()` itself rather
   than recomputing the age: an age comparison would hold while `stage()` was frozen, which is one
   of the two mechanisms named here. Summed across the six seeds, for the reason GROWN_FLOOR
   gives. */
test('a child born in the run grows up', { skip: !isDefault && 'not the default run' }, t => {
  t.diagnostic(`children born in the run who are alive and past 'young' across ${SEEDS.join(', ')}: ${sums.grown} of ${sums.born} born`);
  assert.ok(sums.grown >= GROWN_FLOOR, `${sums.grown} of ${sums.born} children are alive at the end and past 'young' by stage() (want >= ${GROWN_FLOOR}). A birth that never grows up leaves every rule that reads a being's stage untested on its far side.`);
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
