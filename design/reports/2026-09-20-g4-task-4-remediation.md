# G4 task 4 remediation: the findings of the review, fixed

**Branch** `tiers-g4`, worktree `/Users/earchibald/Worktrees/hamlet-g4`. Date 2026-09-20.
I wrote neither task 4 nor its review. The tree was current with `dev` at `72c1b96`. HEAD was `90b3abf`.

## Summary

| # | Finding | What was done | Proved by |
|---|---|---|---|
| 1 | Critical: `pins.none` could not be reached | the pass sets a bit for a cause it does not name, and `pinBucket` counts it in `none` | a planted third cause gives `hunter: 0, none: 1`. HEAD gave `hunter: 1, none: 0` |
| 2 | Major: `runTo` shipped with no caller | `runTo` is the one loop. Both harnesses call it. Three copies became one | gutting it reds 15 of 21 tests in `tests/skip.js`, and 10 of 14 in the soak |
| 3 | Minor: the pit case's net was residue-dependent | the out-tick's residue is asserted, read off the stepped run | the `=== 1` plant that stayed green now reds, and names "1 mod 60" |
| 4 | Minor: `WORLD_PERIODS` had no completeness check | every `tick %` site in `src/sim/` is read out of the source and matched to the list | a planted new period reds. A listed period no rule reads also reds |
| 5 | Minor: a mean was called agreement with a rate | the claim is corrected where it stands, with the arithmetic beside it | arithmetic on the reported numbers. Nothing was re-run |
| 6 | Minor: the stranded sampler's reach | the interval stays. The sample count is written beside it in both files | 4,320 samples on each of six seeds, and 10,080 over seventy days, found **0 strandings**. Unsettled |
| 7 | Major: a budget that could never fire | the budget is in reference units, taken in the same process. No load check is left | a tight budget **fails** inside a parallel `npm run fast`, at load 15.08 |

| Record | md5 | Moved? |
|---|---|---|
| `tests/soak-golden.json` | `142f6c9a78d07e74d945648ccce70e6c` | no |
| `tests/soak-working.json` | `c71523b7838226c3b1618ab295dfdcfb` | no |

`UPDATE_GOLDEN=1` was never run. Neither record was hand-edited. `git status --porcelain` is empty.

## The gates

The machine was busy with another session's work throughout. Two long runs of my own were also in
flight. Every timing carries the one-minute load average.

| gate | result | wall | load (1 min) |
|---|---|---|---|
| `node build.js`, then `git status --porcelain` | wrote 731,458 bytes. Status empty | — | 4.2 |
| `npm run fast` | 751 tests, 691 pass, **0 fail**, 60 skipped | 199.7 s | 4.42 to 8.63 |
| `node tests/soak.js` | 86 tests, 65 pass, **0 fail**, 21 skipped | 129.7 s | 4.42 to 4.46 |
| `node --test tests/clock.js` | 22, 22, 0, 0 | — | 3.08 |
| `node --test tests/tasks.js` | 23, 23, 0, 0 | — | 3.08 |
| `node --test tests/setclock.js` | 3, 3, 0, 0 | — | 4.06 |
| `node --test tests/beings-lazy.js` | 18, 18, 0, **0** | 12.4 s | 4.40 |
| `node --test tests/skip.js` | 21, 20, 0, 1 | 123.2 s | 4.06 |
| `node --test tests/types.js` | 2, 2, 0, **0** | — | 4.40 |
| `SLOW=1 node --test tests/snapshot.js` | 49 tests, 49 pass, **0 fail**, 0 skipped | 1,105.7 s | 3.8 to 6.3 |

The 300 s ceiling on `npm run fast` is met. Two long runs of mine ran beside it. So 199.7 s is an upper
bound. The merge-back report's 174.81 s was taken quiet.

`node_modules/.bin/tsc` is present and executable at version 7.0.2. `tests/types.js` reports **0
skipped**, so the type check ran.

**The review's M3 does not reproduce here.** It recorded 47 pass and 2 fail for
`SLOW=1 node --test tests/snapshot.js` at `56076d4`, and said that dev's tree gives 49 and 0. This HEAD
is after the merge-back, and it gives 49 and 0. I did not touch either of those two tests. So the two
reds are gone with the merge, and `npm run fast` no longer holds a known red behind `LONG=1`.

### Every skip, reconciled

`npm run fast` skips 60 tests. Every one of them is a day count behind `LONG=1` or `SLOW=1`.

| group | count |
|---|---|
| a `LONG=1` day count, with its days and its seconds in the message | 52 |
| `tests/garden.js`, two seeds behind `LONG=1` | 2 |
| `tests/itemgrid.js`, two seeds behind `LONG=1` | 2 |
| `tests/skip.js`, seventy days run twice, behind `LONG=1` | 1 |
| `tests/gnomes.js`, seventy days behind `LONG=1` | 1 |
| `tests/wanderer.js`, 493 world days behind `LONG=1` | 1 |
| `tests/names.js`, the six long runs behind `SLOW=1` | 1 |

The merge-back report counted 61. The one that is gone is `tests/beings-lazy.js`'s load-average guard.
Finding 7 removed it. **No skip in the gate is now guarded by the machine's load.**

I added no skip to any test. So this task leaves no new guard to walk to a boundary. Finding 7 holds the
one boundary that moved, and it moved from a guard to no guard at all.

`node tests/soak.js` skips 21 tests, in four groups. All four are day counts.

| group | count |
|---|---|
| "three world days is too short", behind `LONG=1` | 6 |
| the season claim, which needs runs of 91 days or more | 6 |
| the old-age claim, which needs more days than these | 6 |
| seventy days on six seeds, behind `LONG=1` with `SEEDS=` | 3 |

## 1. `pins.none` could not be reached

`/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js` held one line:

    pinMask |= cause === 'fire' ? 1 : 2;

Every cause that was not fire was counted as a hunter. So `pinMask` was never 0 once the pass had
pinned. And `none` in `/Users/earchibald/Worktrees/hamlet-g4/src/sim/main.js` required a mask of 0. The
bucket was a constant.

**What the source comment claimed before.** The comment above `pins` said the counters are "split by
cause with a bucket for a pin with no cause". It gave the plan's reason for that. It described a guard
the code did not have. The line beside `pins` went further: `none` "is a pin that pass made with no cause
recorded and **must stay zero**". That sentence turned an unreachable bucket into a rule. A later count in
`none` would then have read as a fault rather than as news. I corrected the same claim twice in the task
4 report, at its lines 151 and 167, where each one stands.

**The fix.** The pass sets bit 4 for a cause it does not name. `pinBucket(mask)` sends every mask that
carries bit 4 to `none`. The masks are 4, 5, 6 and 7. The mapping is a named function, because a chain
inside `nextEvent` cannot be asked a question.

**The bucket can be reached.** I planted a third cause in a throwaway copy of `0714b47`. The plant
relabels the rouser branch from `cause = 'hunter'` to `cause = 'thirdCause'`. Then I ran the wolf case of
`tests/skip.js`, which is the review's own arrangement. That case holds seed r, the animals off the tick,
and the night of day 4. Everyone is asleep. An awake wolf stands two tiles from the first sleeper. The run
is 600 ticks.

| tree | the counters |
|---|---|
| `56076d4`, with the review's plant | `{"asked":35,"next":16,"fire":0,"hunter":1,"both":0,"none":0,"acted":14,...}` |
| `0714b47`, unplanted | `{"asked":35,"next":16,"fire":0,"hunter":1,"both":0,"none":0,"acted":14,...}` |
| `0714b47`, with the same plant | `{"asked":35,"next":16,"fire":0,"hunter":0,"both":0,"none":1,"acted":14,...}` |

The unnamed cause moved out of `hunter` and into `none`. Every other field is unchanged. So nothing but
the bucket moved. The test goes red under the plant too. Its message is "the proximity pass never found
the wolf at two tiles". That message is the case's own precondition, failed.

**A test of its own runs every time.** It is named `a hazard cause the engine does not name is counted in
none`. It puts all eight masks to `pinBucket` and reads the answers. It then reads the line in
`senseBeings` out of the source. A right mapping buys nothing if the pass never sets the bit.

An unnamed cause cannot be arranged from outside the engine. `senseBeings` finds the only two causes
there are. So the plant proves the whole chain, and the test holds the two halves.

`none` is still zero on the six seeds. That is now a measurement.

## 2. `runTo` had no caller, and there were three copies of its loop

**I made `runTo` the one loop, and put both harnesses on it.** Deleting it would have left two copies,
and the page with no loop. Keeping three was the worst of the three outcomes. The review had measured
that gutting the shipping loop cost nothing. The two loops under test were not the loop in the product,
and they differed from it.

`runTo(t, atTick)` hands control back at every tick it visits. `atTick.wants()` brings the horizon
forward to the tick the caller wants. Both are what the two copies did by hand. A god is an outside actor
and must be asked at every visited tick. Otherwise the act is late. The skipped run then differs from the
stepped one. An act still enters through `inject`, so the door's rule is untouched. A caller
with no `atTick` runs from horizon to horizon, as the page's faster rungs do.

`runOn` in `/Users/earchibald/Worktrees/hamlet-g4/tests/lib/run.js` is now four lines around that call.
So is `skipOn` in `/Users/earchibald/Worktrees/hamlet-g4/tests/skip.js`. Both assert that the run reached
the tick it was asked for. `runTo` stops on `pending` and the copies did not. A short run is now named
rather than shrugged at. That closes the seam the review recorded at its n5.

**Gutting the shipping loop reds a test.** In a throwaway copy of `0714b47` I replaced the body with
`return tick;`.

| gate | at `0714b47` | with `runTo` gutted |
|---|---|---|
| `node --test tests/skip.js` | 21 tests, 20 pass, 0 fail, 1 skipped | 21 tests, 5 pass, **15 fail**, 1 skipped |
| `node tests/soak.js` | 86 tests, 65 pass, 0 fail, 21 skipped | 14 tests, 1 pass, **10 fail** |

The fifteen reds are the six seed comparisons, the positive gate on jumping, all five adversarial cases,
both ruling 6 cases, and the walking wolf. In the soak every one of the six seeds fails, and the snapshot
oracle with them. The soak fails in 0.3 s a seed rather than 20 s. A loop that runs nothing finishes
quickly, which is its own evidence.

## 3. The pit case now catches a burn at any residue

The case asserted `!inAJump(b, out)`. That asks whether the skipped run happened to land on the out-tick.
The review moved the burn to 1 mod 60 and the case stayed green. In that arrangement the engine already
visits residues 0, 1 and 2 mod 60.

The claim is now about the burn and not about the run. The out-tick is read off the **stepped** run, which
visits every tick. The assertion is that it is a multiple of `CLOCK.every.cellular`. Task 2 put the fuel
on the camp beat, so it is. The beat's own horizon entry reaches it whatever else happens.

| plant at `camps.js:293` | before | now |
|---|---|---|
| `=== 1`, a residue the engine already visits | **green** | **red**: "the fire went out at tick 331861, which is 1 mod 60: the burn has left the camp beat, so nextEvent owes the out-tick an entry of its own" |
| `=== 30` | red, on the equality assertion | red, on the equality assertion: "the skipped run never put the fire out" |

Two residues, and both red. One of them is a residue the engine already visits. Under the `=== 30` plant
the stepped out-tick is 331890, which is 30 mod 60. So the residue line would fire there too, if the
skipped run reached the tick. `!inAJump` is kept. It was not wrong, only insufficient.

## 4. `WORLD_PERIODS` is checked against the source

The list was a hand grep with no completeness check. An off-beat period added by a later task, and never
written down, was never checked. The file's own header called the list "the horizon's one assumption".

The new test is `every tick-modulo rule in src/sim names a period this file checks`. It reads every
`tick %` site out of `src/sim/`. A site's period is the left operand. Its phase is the comparand, where
that is a name rather than a number.

A site in a comment is not a rule, so the comments are stripped first. The stripper is crude. So each
stripped file is then compiled by `vm.Script`, which parses and runs nothing. A stripper that ate into a
string breaks that parse, and the test says so. Otherwise it would scan less than it claims to.

Two periods are exempt, each with a reason beside it. `CLOCK.dark.slower` is a being's own act rate, and
not a period of the world. `DAY` is asserted against the beat by the neighbouring test.

| plant | result |
|---|---|
| `CLOCK.every.freshPeriod: 7`, read by a new `tick %` rule in `world.js` | **red**: "src/sim/world.js reads CLOCK.every.freshPeriod as a tick period, and WORLD_PERIODS does not name it" |
| `grove.every` taken out of the list | **red**, naming the file that reads it |
| `tick % CLOCK.grove.every` taken out of `fae.js`, the list untouched | **red**: "CLOCK.grove.every is in WORLD_PERIODS and no tick-modulo rule in src/sim/ reads it" |

The third plant is the stale direction. That is why the check runs both ways. The stale assertion is also
the instrument's positive gate. A scan that read nothing would satisfy the first claim, and would fail the
second, naming all seventeen periods.

**A floor I wrote and then removed.** I first asserted that at least 19 `tick %` sites were found. The
third plant reds it, because a legitimately removed rule drops the count. A later task could then clear
it only by lowering a floor, which this branch forbids. So the count is a diagnostic now, and the stale
assertion does the work. Today it prints 19 sites over 19 periods, of which the list names 17.

## 5. A mean is not an instantaneous rate

Line 255 of `/Users/earchibald/Worktrees/hamlet-g4/design/reports/2026-09-20-g4-task-4-the-skip.md` read
"That is **18.4 s a world day** at seventy days, which agrees with task 3's 17.98 s at day 50". The clause
is struck, and a correction stands in its place.

18.4 s is 1,290.9 s divided by 70. It is a mean over days 1 to 70. 17.98 s is one world day measured at
day 50. It is a rate. They are different quantities. Their near-equality is a coincidence of the
arithmetic and not corroboration.

If both hold, the late days follow. Days 1 to 50 cannot cost more than 50 x 18 = 900 s. So days 51 to 70
cost at least 391 s, which is **19.6 s a world day at the least**. The report describes a curve from about
3 s a day at day 3 to 18 s at day 50. On that curve the late days are nearer **35 s a day**. The two
figures fit a steep late curve. They do not corroborate each other.

The 70-day figure was not re-run. This is arithmetic on the numbers already reported.

## 6. The stranded sampler: measured, and left where it is

The brief asked me to restore the sampler's reach. The coordinator then corrected the premise twice, and
the item became a measurement. Both corrections were right. The second one decides the outcome.

**The sample counts, which are the cost, and never the interval on its own.** A sample is a flood fill from
every camp's stash, plus one from the first camp for the caves.

| interval | samples, a three-day seed | samples, a seventy-day seed | the sampler's cost, three days | at seventy days |
|---|---|---|---|---|
| `% api.DAY`, which is dev's | 3 | 70 | 0.03 s | 2.1 s |
| `% 1200`, which is this branch's | 216 | 5,040 | 1.8 s | 154 s |
| `% 1000`, before the merge | 259 | 6,048 | 2.2 s | 185 s |
| `% 60`, the beat, my own probe | 4,320 | 100,800 | 36 s | 3,079 s |

A sample costs **7.4 to 9.0 ms** on the six default seeds over three days, at load 3.6 to 4.7. It costs
**30.55 ms** over seventy days on seed r, which is 3.4 times as much. A seventy-day valley holds more
camps, and a sample is one fill per camp. The seventy-day column uses the measured 30.55 ms.

So the everyday soak spends about 11 s of its 129.7 s on this sampler. A seventy-day `LONG=1` seed spends
about 154 s. My own seventy-day probe took 1,525.7 s, of which 307.9 s was fill. Both costs are
affordable.

**One number that falls out of the probe.** Seventy world days of seed r cost 1,217.8 s without the
sampler, at load 4.1. That is a mean of **17.4 s a world day**. It is a mean and not a rate, so it stands
beside the 18.4 s of finding 5 and not beside the 17.98 s. I did not run the soak three times at three intervals. The fill cost times the sample count
answers the question, and that is what I did.

**Does the frequent sample catch anything the daily one misses? UNSETTLED.** I instrumented runs to record
every tick at which `cutOff` is non-empty.

| seed | days | interval | samples | non-empty samples | windows |
|---|---|---|---|---|---|
| r | 3 | 60 | 4,320 | **0** | none |
| x | 3 | 60 | 4,320 | **0** | none |
| alpha | 3 | 60 | 4,320 | **0** | none |
| beta | 3 | 60 | 4,320 | **0** | none |
| gamma | 3 | 60 | 4,320 | **0** | none |
| delta | 3 | 60 | 4,320 | **0** | none |
| r | 70 | 600 | 10,080 | **0** | none |

**No stranding occurred. There is no window whose length could be measured. The result is
inconclusive.** On these runs the daily interval and the 1,200-tick interval give the same answer, which is nothing. That
agreement says only that the instrument found nothing. It is not evidence that a daily sample would do. Zero non-empty
windows is the absence of evidence.

**So the interval does not move.** Keeping it risks nothing and weakens nothing. Both files now carry the honest record. Each holds the sample count
beside the interval, and the cost of a sample. Each says in a sentence that the question is open. The task that settles it must first produce a stranding. A built
one must be labelled as built. Then it must measure how long the stranding lasts.

The review's m5 is superseded. Its "86.4 samples a world day against 72" compares two intervals truthfully
and argues for neither. Dev's sampler does not fire once at tick 0, as the brief described. It fires once
a world day: 3 samples in a three-day run and 70 in a seventy-day one. The old claim rested on a run
ending near tick 70,292, which is 70 times the pre-G4 day of 1,004. The stale note that carried it is
corrected in `tests/soak.js`.

## 7. The budget can fire inside a parallel `npm run fast`

The old guard in `/Users/earchibald/Worktrees/hamlet-g4/tests/beings-lazy.js` was a one-minute load average
of 2. Above that the five-second budget stood down. `node --test` runs the files of `npm run fast` in parallel. It runs eighteen
at a time here. So the load inside the gate is always above 2, and the budget could never be measured
there.

The review watched it skip at load 9.39, having measured 5.02 s against a budget of five. Another session
watched it skip on dev, having measured 4.44 s, which is under budget. That reading cost 14.78 s of a
159 s gate. In both cases the suite's summary showed a skip, and the measured figure sat in the detail. A
reader of the summary saw neither 5.02 s nor 4.44 s.

**Shape chosen: spend and judge.** No load check is left to place. If the day is simulated, the figure is
asserted.

**Why that is now reliable.** A wall second is a property of the machine. So the reading is taken relative
to another reading, made in the same process. `refUnit` is a fixed lump of arithmetic. It is timed on each
side of the day, and the day is reported as a ratio to it. Contention slows both by the same factor.

| one-minute load | the day, wall s | one reference unit, s | the day, in units |
|---|---|---|---|
| 5.17 | 2.876 | 0.2343 | 12.27 |
| 11.97 | 4.819 | 0.3925 | 12.28 |
| 12.13 | 4.543 | 0.3770 | 12.05 |
| 12.59 | 4.431 | 0.3532 | 12.55 |
| 15.08 | 5.65 | 0.4267 | 13.24 |

The three middle rows were taken with `npm run fast` running beside them. The last was taken inside it.
**The wall seconds move by 1.96 times and the units by 10 percent.** That is the whole argument for the
unit.

**Where the ceiling comes from.** One reference unit costs 0.235 s quiet. That is the mean of eight
repeats at load 5.12 on 18 cores, with a spread of 1 percent. The budget was five wall seconds. So it is
5 / 0.235 = 21.3 units, and the ceiling is the whole number below. That is **21 units, or 4.94 s quiet**.
It is the same budget in another unit, rounded the strict way. Nothing was widened. The day measures 12.9
to 13.5 units in the gate, so the headroom is 1.6 times. It was 1.7 times before.

**The assertion fires inside a parallel `npm run fast`.** In a throwaway copy I set the budget to 2.35 s,
which is 10 units. The measured figure is 13. Then I ran the whole suite.

    ✖ a world day at day 3 costs under 10 reference units, which is 2.35 s on a quiet machine
      AssertionError: a world day at day 3 took 13.24 reference units and the budget is 10
      (5.65 wall s at a one-minute load average of 15.08, one reference unit 0.4267 s)

    tests 751, pass 688, fail 1, skipped 62

That is a **fail** and not a skip. It came at load 15.08, on a reading of 5.65 wall seconds. The old guard
would have skipped over that reading. The file reports 18 pass and **0 skipped** on the real tree.

The throwaway copy skips 62 where the worktree skips 60. A `git archive` copy has no `node_modules`, and so no
`tsc`. The two checks in `tests/types.js` are skipped there for that reason. Every other skip matches.

**What would fool it.** The reference loop is arithmetic, and the engine also walks the world's arrays. A
machine whose memory system is far slower than its arithmetic, relative to this one, reads a little high.
The test prints the units, the wall seconds, the unit's own cost and the load average for that reason. It
also asserts that the unit itself came in between 0.05 s and 5 s. A yardstick that measures nothing like
0.235 s makes the reading beside it meaningless.

### The sweep for other guards driven by the suite's own parallelism

I read every `skip` and every `os.loadavg` site in `/Users/earchibald/Worktrees/hamlet-g4/tests/`.

| what | where | verdict |
|---|---|---|
| `os.loadavg()` as a guard | nowhere, after this change | `tests/beings-lazy.js` held the only one |
| `os.loadavg()` read at all | `tests/beings-lazy.js` | printed beside the figure, and decides nothing |
| `os.cpus()`, free memory or a wall clock as a guard | nowhere | searched by name |
| every other skip | 60 in `fast`, 21 in the soak | each is a day count behind `LONG=1` or `SLOW=1` |

The suite's parallelism does not touch a day count. So one guard of this kind existed, and it is gone.

**The method, beside the count.** I grepped `tests/` for `loadavg`, `cpus`, `freemem`, `Date.now`,
`hrtime` and `skip`. Then I read each hit rather than counting them.

## What I did not do

- The floors ceilings, which are the plan's.
- The seventy-day `LONG=1` soak, and the seventy-day pin table. The brief excluded both.
- `tests/door.js`, which rule 7 settles.
- The exclusion experiment's 33.33 percent, which belongs to tasks 5 to 7.

**One thing seen for free, and named rather than chased.** The people alone pin exactly one tick in three
at day 1 on seed r. A person on a path takes a tile a tick. `CLOCK.every.body` is the beat a being's body
is brought up on, so a being that is not walking still names a tick inside that beat. Whoever takes task
5 should read the human act rate against `CLOCK.every.body` first. I did not measure it.

Every plant was made in a throwaway copy under `/Users/earchibald/.claude/jobs/8b2c73e8/tmp/`. Each copy
was made with `git archive HEAD | tar -x`, and every one is deleted. `git status --porcelain` is empty.
