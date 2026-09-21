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
/* One guard per claim, each with its own number, neither read off DEFAULT_DAYS. See tests/lib/claims.js. */
const { seasonClaimSkip, oldAgeClaimSkip } = require('./lib/claims');

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
    /* Sampled on a multiple of the world's own beat, `CLOCK.every.cellular`, and not on a round 1000.
       The engine jumps from one horizon to the next now, and every horizon is a multiple of the beat or
       earlier, so a tick on the beat's grid is always visited and a tick off it may not be. A sample
       tick the run can skip is a sample that silently stops firing. It reads the world and changes
       nothing, so it moves no record.

       THE COST IS THE SAMPLE COUNT AND NOT THE INTERVAL, so both are written down. 1200 ticks is twenty
       world minutes, which is 72 samples a world day: 216 in the everyday three-day seed and 5,040 in a
       seventy-day LONG=1 seed. Each sample is a flood fill from every camp's stash and one more for the
       caves, measured at 7.4 to 9.0 ms a sample on the six default seeds, so the sampler is about 1.8 s
       of a seed's three days and at least 42 s of its seventy. "Every 1,200 ticks" hides that. Dev
       samples on `api.tick % api.DAY`, which is once a world day, or 3 and 70 samples in the same two
       runs. An earlier note here said dev's sampler fires once in a whole run; that rested on a run
       ending near tick 70,292, which is the pre-G4 day, and it is wrong.

       WHETHER THE FREQUENT SAMPLE CATCHES ANYTHING THE DAILY ONE MISSES IS UNSETTLED, and the interval
       stays where it is until somebody settles it. Sampled every 60 ticks -- the beat itself, 4,320
       samples a seed -- `cutOff` was EMPTY at every sample on all six default seeds over three world
       days. No stranding occurred, so the two intervals agree, and their agreement says only that the
       instrument found nothing. It is not evidence that a daily sample would do. See
       design/reports/2026-09-20-g4-task-4-remediation.md.

       `seasonOf()` reads the tick and draws no random number, so it cannot move the stream either. */
    const seasonsSeen = new Set();
    const { api, events } = runDays(seed, DAYS, (api, i) => { seasonsSeen.add(api.seasonOf()); if (api.tick % 1200 === 0) stranded.push(...cutOff(api)); });
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

       `diedAt` is stamped in `die()` (src/sim/beings.js:76) and nowhere else, so `lastAge` is NaN
       for a being taken off the board another way. Three paths do that today: the snared rabbit
       (beings.js:369), the deer in the pitfall (beings.js:377) and an unmade god (gods.js:467).
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
       age.` (src/sim/beings.js:94), so a gnome feeds it. `counts.oldAge` itself is left as it is:
       the golden record holds it.

       Read why this count is human-only, because it is not what it looks like. The tag does NOT
       name a species. `die()` is handed `warm ? 'old' : 'oldCold'` for every species that passes
       its span (beings.js:510), and a gnome is never `warm`, so a gnome's death is an 'oldCold'
       death. What separates them is one line: the human branch calls `log(text, [a], 'death', tag)`
       (beings.js:80) and the gnome branch calls `log(text, [], 'death')` (beings.js:94) with no
       tag argument at all. A death EVENT carries a tag only because the gnome line forgets to pass
       one. Add a tag to beings.js:94 and this count silently takes gnomes back in.

       The event has nothing better to filter on. `log()` builds `{ tick, when, text, kind, tag,
       camp }` (src/sim/core.js:181) and the `who` array it is given feeds only `a.history` and
       `a.deeds`, so no being id and no species reaches the chronicle line. A run's events were
       enumerated to check it: the fields are age, camp, kind, nameKnown, names, tag, text, tick,
       when. So the count rests on the tag, and the assertion below carries a guard against the day
       beings.js:94 changes.

       That guard is dormant at `DEFAULT_DAYS`. A tag added to beings.js:94 leaves all six seeds
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
    /* The sums are gathered on every run, suspended or not: a skipped assertion must not also stop
       the counting, or the six-seed floors below would silently see zero and pass. They are gathered
       in a test of their own rather than inline, so that the gathering is named in the output and a
       run that stopped counting says so. */
    await t.test('the counts are gathered', () => {
      sums.humans += counts.humans; sums.born += counts.born; sums.grown += grown.length;
      for (const k in FAR_FLOOR) sums[k] += counts[k];
      t.diagnostic(`${seed}: alive ${counts.alive}, ever ${counts.humans}, born ${counts.born}`);
    });
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
       and a long `SEEDS=r DAYS=...` is the common quick check, which is exactly where a calendar
       change would otherwise slip past. The guard does not read the calendar either. A guard of
       `DAYS * DAY >= years(1)` would switch the claim off on the very change it is here to report:
       a year of 1460 days is not crossed by 365, so the claim would skip instead of failing.

       The guard is `SEASON_CLAIM_DAYS`, one year, in tests/lib/claims.js. It is this claim's own
       number, not the soak's run length: a 365-day run visits every season and makes the claim,
       whatever `DEFAULT_DAYS` happens to be. No run this branch affords reaches it, so the claim
       skips here and says so. */
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
    /* SUSPENDED, pending G4 task 4. A camp does not grow in three world days: nobody is born and the
       newcomers have not come. The floors themselves were measured on 70 of dev's days and no number
       here has been measured at the new clock. The floor is not deleted, because a deleted floor is a
       gate nobody can find again -- it is skipped here and run in full under LONG=1, and task 4
       reports what a long run costs once the skip works so the user can rule on where it belongs. */
    await t.test('the camps grow', { skip: !LONG && 'suspended: three world days is too short. LONG=1 runs it' }, () => {
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
       (src/sim/beings.js:507). Other causes end a life a few lines further down, where hp at or
       below zero kills by fire, thirst, hunger or cold (beings.js:490). The one place is the old-age
       roll, and that is all this claim needs.

       The count is human-only, and it is a tag count for that reason. `counts.oldAge` is a
       substring match over the whole chronicle: `ev` at tests/lib/run.js:126, summed at :138. The
       gnome branch of `die()` writes `A gnome died of old age.` into that same chronicle
       (beings.js:94), so the text match would count a gnome's death as a person's. It reads
       species-exact today for one reason only. `LIFE.gnome.life` is 110 days
       (src/sim/species.js:2), a gnome walks in between 20 and 35 days old (beings.js:12), and 70
       days cannot carry it past the span. Raise DAYS to about 90, or lower that 110, and the text
       count takes gnomes in. Of the five species branches in `die()`, only human (:80) and gnome
       (:94) put `cause` into a chronicle line, so the gnome is the single contaminant.

       Two plants measured it, on seed r unless stated. Drop the `tag` argument from the human line
       at beings.js:80: the tag count falls to 0 while `counts.oldAge` holds at 12, so the tag
       reading goes red where the text reading stays green. Add a tag to beings.js:94 instead: all
       six seeds stay green at 70 days, and all six go red at 90. That second pair is the dormancy
       above, arriving, and it is the same fact the `humanOldAge` guard note records.

       A future mourning line that logged a dead elder's full name would open the text count another
       way: `FATE_EPITHETS.oldCold` is the string 'who died of old age' (src/sim/names.js:767),
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

       The guard is `OLD_AGE_CLAIM_DAYS` in tests/lib/claims.js, 70 days. It is a separate number
       from the season claim's above, which needs a year. On dev that 70 was a measured floor. On
       this branch it is a lower bound that nobody has re-measured at the 86,400-tick day, and
       claims.js says so at length. G4 task 4 owes the measurement. `LONG=1` sets DAYS to 70 and so
       still makes the claim; the default three-day run skips it. */
    await t.test('somebody dies of old age', { skip: oldAgeClaimSkip(DAYS) }, () => {
      assert.ok(humanOldAge >= 1, `no person died of old age in ${DAYS} days, though ${pastSpan.length} people passed LIFE.human.life (${LH.life} days) and the oldest reached ${oldestHuman.toFixed(1)}. The rule below, that a death which is not old age is a bug, has nothing to filter until this fires.`);
      assert.ok(humanOldAge <= humanOldDead, `${humanOldAge} death lines carry an old-age tag, but only ${humanOldDead} people are dead and past the span. A tagged old-age death that is nobody's means the tag is no longer a person's alone: src/sim/beings.js:94 logs a gnome's death, and the count above is human-only only while that line passes no tag.`);
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

/* The young end of the life table. `born >= 1` is already floored per seed, but a birth is only the
   start of the passage: nothing said a child ever grew up, so the whole young-to-adult transition
   was unnamed, and a change that killed every child, or froze `stage()` at 'young', would leave the
   soak green (issue #94). `stage()` writes no chronicle line when it turns, so the claim is read off
   the beings at the end instead of counted from the events, and it asks `stage()` itself rather
   than recomputing the age: an age comparison would hold while `stage()` was frozen, which is one
   of the two mechanisms named here. Summed across the six seeds, for the reason GROWN_FLOOR
   gives.

   SUSPENDED under `SUM_SKIP`, like the two floors above, and for the same two reasons: nobody is
   born in three world days, and `GROWN_FLOOR` is a sum across the six seeds measured over seventy of
   dev's days. The floor is not lowered to fit the short run. */
test('a child born in the run grows up', { skip: SUM_SKIP }, t => {
  t.diagnostic(`children born in the run who are alive and past 'young' across ${SEEDS.join(', ')}: ${sums.grown} of ${sums.born} born`);
  assert.ok(sums.grown >= GROWN_FLOOR, `${sums.grown} of ${sums.born} children are alive at the end and past 'young' by stage() (want >= ${GROWN_FLOOR}). A birth that never grows up leaves every rule that reads a being's stage untested on its far side.`);
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
