# G4 task 1: the calendar, the markers, the walk, and the soak's new shape

Task 1's report. Started 2026-09-19 as a handoff at `afdbe49`, finished the same day. The handoff's
five owed items are closed and two findings were added after it was written, one of them a live
regression. Read the findings before the table: findings 2 and 5 are the same class of fault, caught
twice in one task, and the second was invisible to the gate the first one built.

| | |
|---|---|
| Branch | `tiers-g4` |
| Worktree | `/Users/earchibald/Worktrees/hamlet-g4` |
| Plan | `/Users/earchibald/Worktrees/hamlet-g4/design/plans/2026-09-19-tiers-plan-g4-the-retune.md` |
| Branched from | dev at `d3bcfcb`; dev `a311825` merged in, clean |
| Soak | **green**: 73 tests, 64 pass, 0 fail, 9 skipped, 5 min 5 s |
| `tests/clock.js` | **green**: 21 of 21, two of them new gates from finding 5 |
| Rest of the fast suite | see "The suite, measured": every measurable failure converted to green, six files suspended for G4 with no day count changed |

## Where the plan lives now

`tiers-g4-plan` is **frozen**. The plan was merged into `tiers-g4` so that dev never gains the
retune without the plan it was measured against, and so the checkboxes are ticked in place as each
task lands. Edit the plan in this worktree only. PR #36 is a redundant draft: close it as superseded
when the work PR opens, with the reason stated, because its review history is most of what it is
still worth.

## What task 1 changed

**The calendar.** `DAY = 86400` and a tick is one world second. A year is 365 days from
`SEASON_LENGTHS` of 91, 91, 91, 92, so winter carries the odd day and no season is derived by
subtraction. `seasonOf`, `dayOfYear`, `yearOf` and `isWinter` each take a day and fall back to
today's, so a rule or a panel can ask about another day without moving the world, and the calendar
can be checked without a world at all. `SEASON_DAYS` is gone.

**Wall time left the sim.** `TPS` is now `TICKS_A_SECOND` in `src/ui/state.js`. Speed is view state
and never passes the door.

**Every legacy marker is a converter, except one.** An old tick is 86.4 world seconds and an old
stride is two of those. `ticks` and `strides` multiply **and round**; `tickRate` and `strideRate`
divide. This is a rebasing, not a reading: every marked value keeps exactly the world meaning it
already had, and the marker still says nobody has decided what it should be.

`lookRate` is the exception and it does **not** convert. A chance for one look is not a chance a
tick: the rule draws a number of looks, that count carries the world time, and the chance rides on
top of it unchanged. Converting one of these divides it a second time, which is finding 5.

**The walk.** `stride` is a speed in tiles a tick, one for a walk and two at a run, read in
`runTask`. The old stride gate is gone: it ran a being's whole head on one tick in `stride`, so one
number was both how fast a being walked and how often it thought. The cadence of the head is task
3's. `darkStep` is gone; the dark reads `CLOCK.dark.slower`.

**`SNAPSHOT_VERSION = 2`.** A version 1 save holds a tick and every stamp beside it meaning 86.4
times less, which no per-field default can rescue.

**The soak is six seeds for three world days**, with the 70-day run behind `LONG=1` on one seed, and
answers to `tests/soak-working.json`. `tests/soak-golden.json` is untouched and no task writes it.

## The findings worth carrying

### 1. The rates had to convert, or the world would have broken silently

If `tickRate` had stayed an identity, a chance of 0.0006 a tick — about once in two world days —
would have become about once every half hour. Lightning would have struck camps eighty-six times as
often **and nothing would have gone red**, because a rate is a number and a number survives any
rebasing.

### 2. A duration is a whole number of world seconds, or the rule stops happening

The fire-pit regression, and the largest finding of the task. `src/sim/tasks.js:198` reads
`++t.progress % CLOCK.work.berryEvery === 0`, and the converter made `berryEvery` 1036.8. A whole
`progress` modulo 1036.8 is never zero, so the berry was never picked and the task never ended.

Measured, seed `gamma`, one person, world day 1:

| | dev | `tiers-g4` before the fix |
|---|---|---|
| deliver | 31.4% of person-ticks | 0.0% |
| work | 30.2% | — |
| gather | 30.0% | **99.9%** |
| status changes in a day | 156 | 16 |
| ticks on "Picking berries" | — | 86,257 of 86,400 |
| sticks / rocks at day 1 | 10 / 6 | 3 / 0 |
| fire pit | by day 2 | never |

**The rule did not fail. It stopped happening**, which no test could see — 642 green tests and a
villager picking berries for a whole world day. Every duration and every rate checked out under the
conversion and they all really were right; the fault was the type, not the value.

Fixed by making `ticks` and `strides` round. **The gate matters more than the fix:**
`tests/clock.js` now asserts every duration in `CLOCK` is a whole number of ticks.

**How it was missed, which the next reader should know.** This exact failure was considered and
cleared. `CLOCK.every` was checked, found to be all multiples of 50 and so all whole after
conversion, and passed over. `CLOCK.work.*Every` is the same pattern in another table and was never
looked at. A sweep defined by where somebody looked rather than by what the pattern was.

Rocks at zero was **not** a second fault. Sticks and rocks go through the same `gather` task and the
pit goal only asks for rocks once its stick threshold is met, so the rocks figure was downstream and
carried no information. It was read as a second symptom for longer than it should have been.

### 3. The tests cannot wait for task 10

About forty fast tests went red the moment the clock was rebased. None is a fault in the rules: they
count steps in old ticks. As the plan was written, task 10 fixed them, which left tasks 2 to 9
running against a suite that was already red — nine tasks changing the rules core with nothing able
to go red, each report able to say truthfully that the failures were not its own.

**The plan is amended**: the mechanical half of task 10 moves into task 1. A test that fails only
because a day got longer is converted by the task that made the day longer. A test whose assertion
needs a *reading* still waits for task 10. Task 1 reports the suite's pass count before and after and
names every test it leaves red.

Sixteen of `tests/snapshot.js`'s failures were **one line**: `tests/lib/run.js` held
`const DAY = 1000`, its own copy of the day, so every test asking for seventy days ran for a fifth of
one while still reporting in days. It now reads `load().DAY`.

### 4. Speed, and why the soak was reshaped

**15.0, 14.6, 14.7 seconds per world day**, seed `r`, days 1 to 3, ~86 beings, against a 5 s budget.
Flat, so the cost tracks beings alive rather than elapsed time. Roughly 48× slower than dev's
~0.31 s. This is expected — the plan says task 1 is "expected to be far over the 5 s budget. Report
the number" — and is what tasks 3 and 4 are for. Six seeds × 70 days × 15 s is near two hours, which
is why the everyday soak is three days.

The suspended floors keep their **original measured numbers** and run under `LONG=1`. They were not
rescaled to fit three days: a floor guessed at a new length is a floor nobody measured, which reads
as a gate and is not one.

One trap caught: the six-seed sums were gathered **inside** the `camps grow` assertion, so skipping
it would have stopped the counting and left the sum floors below seeing zero and passing.

### 5. A count is a whole number too, and a chance for one look is not a chance a tick

The second regression of the same class as finding 2, found after the handoff was written, on a
branch whose soak was green and whose `tests/clock.js` was green including its new whole-number rule.

`CLOCK.plant.samples` is looks a tick. It was 60 and the converter made it `tickRate(60)`, which is
0.694. `growPlants` spends it as `for (let k = 0; k < samples; k++)`, and a `for` bound truncates a
fraction, so the loop ran **once** a tick rather than 0.694 times. That alone was a 1.44 times
overshoot and harmless. The second half was not. Every one of the eleven chances in the plant block
had been converted by `tickRate` as though it were a chance a tick. Each is a chance for **one
look**, and the look count already carries the world time, so each was divided by 86.4 a second time.

The two compounded to about sixty times fewer plant events a world day. Measured, seed `r`, one
world day, against dev `a311825`:

| | dev | `tiers-g4` before | after the fix |
|---|---|---|---|
| berries | +134 | **-91** | +144 |
| bushes seeded | +21 | **0** | +18 |
| saplings sprouted | +49 | **1** | +39 |

Berries went **down** because growth had stopped while people kept picking. Nothing went red.

**Why the existing gates could not see it.** Finding 2's gate asserts every duration in `CLOCK` is a
whole number of ticks. That is a rule about durations, and this fault was in a count and in a chance.
More to the point, **every value in the table was correct on both sides of this fault.** The fault
was in how two correct numbers were used together. No lint on the table could have caught it, and
the whole-number rule that came out of finding 2 would not have caught it either.

**The fix.** `lookRate` is a new marker in `src/sim/clock.js` that deliberately does **not** convert,
and the eleven plant chances carry it. A marker that does nothing is normally the mistake the marker
test exists to catch, so the exception is asserted by name in `tests/clock.js` rather than left to
the absence of an assertion. `growPlants` now draws a whole number of looks from the fractional rate.

**The gate, which matters more than the fix.** It is behavioural, not a lint, because a lint was
structurally incapable here. `tests/clock.js` calls `growPlants` for a tenth of a world day and
asserts berries appear: **0 before the fix, 23 after, 24 on dev.** It fails against the old code,
which is the only evidence that a gate is a gate. A second test splits the two halves so a failure
says which one broke: the look count is 60,000 a world day within 2 percent, and no chance in the
plant block carries `tickRate`.

**What the class costs, which is the part worth carrying.** Two regressions of "the rule stopped
happening" landed inside one task. One was in the task system and one was not. patcher checked the
scope rather than taking my word for it and found that **none of the eleven per-tick steps in
`updateWorld` is a task** — `growPlants`, `spreadFire`, `updateWeather`, `updateCamps`,
`strayLightning`, `rotCarcasses`, `groveTick`, `denTick`, `gnomeTick`, `spawnWildlife`, `godsTick`.
So a detector that watches task records cannot see the per-tick engine at all. The shape that caught
this one generalises and a table lint does not: **call the rule and ask whether it still happens.**

### 5b. A number that was correctly two things at once, and the detector that read clean

The third fault of the berry class in this task, and a **sub-species of its own**, named here because
the first two do not describe it. Finding 2 was a value that went fractional. Finding 5 was a value
converted that should not have been. This one is different: **`strikeFuel: ticks(240)` was correct as
a fuel stock and correct as a tick count at the same time**, because `fire.burn` is `tickRate(1)` —
exactly one fuel a tick. Both readings agreed, so nothing in the source could say which one the
constant was.

The rebasing broke a **coincidence**, not a value. `burn` correctly became a rate a tick and divided;
converting the stock as well multiplied the burn time by 86.4. A lightning fire lasted **20.74 world
days against dev's 0.24**, and the whole-number rule from finding 2 passed the whole time, because
20,736 is a whole number of ticks.

**No marker can flag a number whose two meanings agree.** The general form is worth carrying: *a unit
rate makes two quantities numerically identical and hides which one a constant is.* That gives a
cheap positive check rather than a search for the next one by disbelief — sweep the table for every
rate of exactly 1 and look at what it drains. Run here with a control, and the answer is small:

| rate of exactly 1 | its stock | state |
|---|---|---|
| `fire.burn = tickRate(1)` | `strikeFuel`, and tile fuel from `FEATURES`, `GROUND`, `ITEMS` | fixed; the data-table fuels were never converted, because the rebasing only ever touched `CLOCK` |

**One unit rate in the whole table, and its only converted stock is the one that broke.** There is no
fourth instance of this sub-species.

### 5c. The detector was broken and read as clean, and only the control said so

This belongs beside the fault because it is the more portable half. Sweeping for stocks that read
`CLOCK`, my first search returned **zero**. There is a matching line at `src/sim/main.js:37`. The
search was broken in the argument layer and its silence read exactly like cleanliness — and it would
have ended the sweep, because a sweep that finds nothing is a sweep that feels finished.

It was caught by running a **positive control**: asking the detector to find a thing known to exist
before believing it about things that might not. The finding is not "there was a bug". It is that
**a detector that reads clean has said nothing until a control has been run through it**, and that a
load-bearing absence must be confirmed by a different KIND of method — here a Node scan of the source
rather than a second search.

### 6. The suite's cost is one number, and it is the number task 4 exists to move

Finding 3 recorded that sixteen `tests/snapshot.js` failures were one line: `tests/lib/run.js` held
`const DAY = 1000`, its own copy of the day, so a test asking for seventy days ran for a fifth of
one. It now reads `load().DAY`.

**A first reading of that was wrong and is corrected here, because the wrong reading argues for
cutting tests.** It is tempting to say those tests were always fast and wrong, and that the fix
merely revealed what they cost. They were not. On dev, `src/sim/clock.js` line 4 reads
`const DAY = 1000, TPS = 12`, and `tests/lib/run.js` read `const DAY = 1000`. **The two matched
exactly.** A test asking `runDays(..., 70)` on dev got seventy world days and reported seventy. The
private copy was a duplicated constant — a latent fault, and a real one, which is why finding 3
records it — but it was not a wrong number until something changed the original.

What changed the original was task 1, on this branch. For the window between the commit that made
`DAY` 86,400 and the runner fix, every day-denominated test ran a fraction of what it claimed. That
window is G4-internal and it is closed.

**So the suite's cost is a pure function of one number, and no test grew.** Each file's cost is the
world days it asks for, which have not changed, multiplied by the seconds a world day, which task 1
moved and task 4 is built to move back. `tests/names.js` asks for 202 world days, 342 under `SLOW=1`:

| seconds a world day | `tests/names.js` |
|---|---|
| dev, about 0.31 s | about 63 seconds |
| this branch, 15 s measured | about 50 minutes |
| task 3's budget, under 5 s | about 17 minutes |
| task 4's target, under 1 s | about 3 minutes |

Every file in the unmeasurable list behaves the same way, which is what the table below shows: each
is slow in exact proportion to the world time it asks for, and for no interesting reason.

**The two-hour suite is a transient of an unfinished retune, not a new property of the tests.** That
is why this report recommends cutting nothing. Cutting a day count now would trade a permanent loss
of coverage for a temporary cost, and it is the same act the soak's floors were deliberately spared:
a count reduced to fit a slow engine is a gate nobody measured. `tests/names.js`'s 70-day layout
guard is the one thing in this repository that has caught a moved being or item.

dev-coordinator is taking the shape to the user: the slow files go behind a flag **for the duration
of G4**, named as suspended with the reason and the flag in the skip message, and they come back at
task 4. Not cut, not rescaled, not guessed. If task 4 misses the budget, the question becomes real
then, with a measured number behind it.

## What task 1 closed, of the five things it owed

### 1. The version 1 save tests: ruled, and not as the handoff proposed

The handoff said three tests must assert the refusal rather than the load. That is right for one of
them and wrong for two, and the difference matters enough to write down.

The plan rules at line 133 that the version rises to 2 and a version 1 save is refused. So
`the version refusal names both versions` is rebased: it now asserts `SNAPSHOT_VERSION` is 2, that a
version 1 save is refused with `This save is version 1. This world reads version 2.`, and that a
version 3 save is refused the same way. The loader's sentence was already generic and needed no
change.

The other two tests do **not** become refusal tests. Neither loads a v1 fixture from disk. Each takes
a snapshot of a live world, deletes the fields that a save written before some later work would not
have held, and asserts it still loads. Their subject is not the version number. It is that **the
decoder tolerates a save missing fields added after it was written**, which is the same policy line
133 restates and which did not change when the version rose. Converting them to refusal tests would
have deleted that coverage and left the branch looking greener. They follow the version up to 2
instead, and each carries the reason in place.

### 2. The mechanical test conversions

See finding 6 and the table below. The measurement came first because the handoff's numbers were
taken at `433938a`, before both the runner fix and the rounding fix, and it said so.

### 3. dev `a311825` merged

Clean, no conflict, despite the handoff's warning that `tests/clock.js` had been edited heavily on
both sides. The two NUL separators are present as the escape `\0` at `tests/clock.js:296` and `:298`,
and **no raw NUL byte remains**. That was confirmed by reading the file's bytes in Node, not by
grepping: the first attempt, `git grep -c $'\0'`, reported 300 matching lines, because the shell
strips a NUL from an argument and the pattern reached git as the empty string, which matches every
line. A search can fail in the argument layer before the tool runs, and a false positive reads as
confidently as a true one.

### 4. The 31 chances: the deviation stands, and here is what it costs

The plan's task 1 asks for each chance-a-tick to be rewritten as an hourly rate rolled with
`rollFor(rate, 1)`. This was not done. The handoff asked the next context to revisit it deliberately
rather than assume an oversight. I have, and I am keeping the deviation. Three reasons, in order of
weight.

**It is 31 readings task 1 does not own.** The plan's own marker rule at line 168 says a marked value
is never converted because it happens to equal a real-unit expression, because the conversion removes
the flag that says nobody has decided without anybody deciding. Rewriting 31 chances as hourly rates
is that, 31 times.

**Task 2 re-touches every one of them anyway.** Task 2's checklist rolls every chance inside a
cellular system with `rollFor(rate, CLOCK.every.cellular)`, and gives spoilage, births, arrivals,
storms and lightning their own beats. Doing the work in task 1 at `rollFor(rate, 1)` is work task 2
undoes.

**The arithmetic cost is small and now measured, which it was not before.** The plan's exact
conversion is `1 - (1 - p) ** (3600 / OLD_TICK)`; `tickRate` divides, which is its linear
approximation. For every chance rolled once a tick the two differ by **under 0.2 percent**:
`lightningLit` and `oldAgeDeath` at 0.0006 differ by 0.03 percent, `lightningOut` at 0.0035 by 0.17
percent, `strayLightning` at 0.0008 by 0.04 percent. The two fire chances are the largest at about 1
percent. The approximation is only poor for a large `p`, and every value that large in the table is
an amount, not a chance, where the linear divide is exactly right.

**One thing the deviation did cost, and it is the reason to report it rather than bury it.** Sweeping
for large conversion error is what led to the plant block, and the plant block was genuinely broken —
finding 5. So the deviation is not free: it left `tickRate` doing double duty as the amount converter
and the chance converter, and that is what let eleven per-look chances be converted as per-tick
chances without anybody noticing. `lookRate` now separates the third case. If a later task does
rewrite the 31, it should keep that separation rather than collapse it again.

### 5. This report

Finished here, as the handoff directed, rather than started again in a new file.


## The suite, measured

Measured on this branch, `node --test` per file, with a 420 s cap. The "before" column is this
branch as the handoff left it; the "after" column is after task 1's conversions. The handoff's
numbers were taken at `433938a`, before both the runner fix and the rounding fix, and it said so, so
everything here was re-measured rather than carried forward.

| file | before | after | seconds | what was wrong |
|---|---|---|---|---|
| `clock` | 21/21 | **21/21** | 3 | two gates added by finding 5 |
| `options` | 5/5 | 5/5 | 2 | — |
| `field` | 10/10 | 10/10 | 3 | — |
| `gods` | 31/31 | 31/31 | 5 | — |
| `become` | 34/34 | 34/34 | 12 | — |
| `ages` | 76/76 | 76/76 | 51 | — |
| `chronicle` | 5/5 | 5/5 | 82 | — |
| `crafts` | 6/14 | **14/14** | 36 | a 600-old-tick budget |
| `closing` | 8/11 | **11/11** | 61 | old-day literals, old-tick budgets |
| `dwellers` | 9/18 | **18/18** | 71 | old-day literals; a bare 119 that is now read from `CLOCK` |
| `tasks` | 21/23 | **23/23** | 273 | a nine-old-day span and its sampling period |
| `terrain` | 61/63 | **63/63** | 44 | a winter day that is no longer winter; the dark walk |
| `door` | 13/15 | **15/15** | 476 | two more private copies of the day |
| `ui` | not measurable | **suspended** | — | asks for 25 world days |
| `settle` | not measurable | **suspended** | — | asks for 50 world days |
| `snapshot` | not measurable | **suspended** | — | asks for 40 world days |
| `wanderer` | not measurable | **suspended** | — | asks for 48 world days |
| `gnomes` | not measurable | **suspended** | — | asks for 70 world days |
| `names` | not measurable | **suspended** | — | asks for 202 world days, 342 under `SLOW=1` |

**Every failure converted above was a test counting in old ticks. Not one was a fault in the rules.**

Final state of the whole suite, run file by file at `99ead34`:

| | |
|---|---|
| passing | **326** |
| failing | **0** |
| suspended | **6 files**, listed below |

### `LONG=1`, run because task 1 is the task that most needs it

Ruling 2 makes `LONG=1` on seed `r` a gate at every task. Task 1 was committed before the ruling
reached this session, and the right answer was not to treat the gate as starting at task 2: the
ruling exists **because of** what task 1 did, and everything from task 2 on stands on this
foundation. Run at `99ead34`. Seed `r`, 70 world days.

| | |
|---|---|
| passing | 13 |
| failing | **2** |
| skipped | 3 |
| wall clock | **67 minutes**, not the 17 the ruling assumed |
| chronicle lines | 372,157 |
| alive at day 70 | 135, of 162 ever |
| deaths | 21 "died in their sleep, old and warm by the fire", 6 "died of old age" |

**The gate that matters passed. Every death in seventy days was old age.** After two berry-class
regressions inside this one task, that is the number worth having, and it is the one the three-day
soak cannot reach.

**The two failures are structural and are not a regression.** Both are cross-seed sum floors:

```
sum of humans 162 (want >= 180), sum of born 20 (want >= 15)
sum of repaid 0 (want >= 5)
```

`SEEDS` under `LONG=1` is `['r']` — **one seed**. Both floors were measured as sums **across six
seeds** over 70 days. A six-seed sum compared against one seed's counts cannot pass, whatever the
world does. `born 20 >= 15` passed; `humans 162 >= 180` failed on a floor that six seeds set; and
`repaid` is gnome borrowing, which seed `r` never does at all — it ends with 2 gnomes, 0 borrowed.

So **ruling 2 is not quite true as written.** `LONG=1` on one seed does not run all nine suspended
assertions at their original measured values. It runs seven of them. The remaining two cannot be
satisfied by the data the gate provides, and an assertion that cannot pass on the data it is given is
not a gate: it is a red line that teaches the next reader to skip past red.

**Ruled by patcher, who holds the floors, and now done.** The two assertions are guarded on
`!LONG || SEEDS.join() !== DEFAULT_SEEDS.join()` — **both** conditions, because they need seventy
days *and* the six seeds. The message says which is missing: *"needs the six seeds; this run has r"*.

**It is a dropped guard restored, not a new precondition.** On dev these floors carried a data-shape
question and this branch swapped it for a duration question. Both belong. `!isDefault` is the wrong
way to write it here, because `isDefault` already contains `!LONG`: using it would skip these under
`LONG=1` as well, which is today's broken state reached by another road.

**patcher's sentence, which is the one to carry:**

> Under `LONG=1` the gate runs seven of the nine suspended assertions. The two that skip are the
> cross-seed sums, and on this branch there is no run in which they are evaluated on six seeds over
> seventy days — the default soak is three days and skips them, and the long gate is one seed. A
> uniform sag across every seed is therefore caught by nothing during G4. It is covered by a single
> six-seed seventy-day run, owed before the PR opens and recorded in its body.

That run is now a checkbox on task 11, with the floors written into it: `sums.humans` and `sums.born`
against 180 and 15, the four far-country sums against 2, 1, 5, 1, and dev's measured 255, 37 and
8, 5, 15, 4 beside them. It runs as late as possible, for coverage rather than for cheapness.

### What the three-day default actually gates, measured

patcher flagged this and it is worse than "thin". Read from `tests/soak-working.json` rather than
reasoned about:

| seed | r | x | alpha | beta | gamma | delta |
|---|---|---|---|---|---|---|
| alive at day 3 | 2 | 3 | 3 | 2 | 3 | 2 |
| born | 0 | 0 | 0 | 0 | 0 | 0 |
| deaths | none | none | none | none | none | none |

Fifteen people across all six seeds. **No births anywhere and no deaths anywhere.** So *"nobody dies
of anything but old age"* is not nearly vacuous, it is **exactly vacuous**: it asserts a property of
an empty set on every seed, and it passes. **That is worse than a skip, because a passing test reads
as coverage and a skipped one announces itself.** The den deaths, the walk home, and the lit-fire
chronicle sit in the same position to varying degrees.

What the three-day run does gate is the working record — the fingerprint and its 62 counters — and
that nothing throws. That is a very sensitive change **detector**: one one-line fault has been seen
to move 21 of 33 counters. What it cannot do is say which direction is wrong. **Detection without
discrimination**, which is this report's own finding arriving in our own scaffolding for the third
time in one day. The numbers are now in the header of `tests/soak.js`, because a number in a comment
can be checked and can go stale loudly, and "this is a smoke test" cannot.

**And the gap that remains, named here so it is not discovered at the merge.** `LONG=1` runs seed `r`
**only**. Every duration-dependent *per-seed* assertion — deaths, den deaths, cut-off, the lit fire —
is covered on `r` and on no other seed for the whole of G4. A fault that kills people only on
`gamma`'s stream is caught by nothing until the six-seed run. This is not a request for more runs. It
is a request that the sentence exist.

**And the cost of ruling 2 is four times what was assumed.** 67 minutes, not 17. The average is 57
seconds a world day across the seventy, against the 15 s measured at days 1 to 3. The cost tracks
beings alive — 86 at day 3, 135 at day 70 — so it climbs as the valley fills. A gate people skip
stops being a gate, which is ruling 2's own argument, and an hour a task is a different proposition
from a quarter of one. That is dev-coordinator's and the user's to weigh, with the number now
measured rather than estimated.



### What is switched off, in one place

The user approved this shape through dev-coordinator: **cut nothing.** These six files are suspended
for the duration of G4 and **not one day count in them was changed**. Each names itself, its day
count, the reason and the flag in its own skip message, so a reader of the suite sees what is off and
what has to become true for it to return.

| file | world days asked for | flag | restored by |
|---|---|---|---|
| `tests/names.js` | 202, and 342 under `SLOW=1` | `SLOW=1` | task 4 |
| `tests/gnomes.js` | 70 | `SLOW=1` | task 4 |
| `tests/settle.js` | 50 | `SLOW=1` | task 4 |
| `tests/wanderer.js` | 48 | `SLOW=1` | task 4 |
| `tests/snapshot.js` | 40 | `SLOW=1` | task 4 |
| `tests/ui.js` | 25 | `SLOW=1` | task 4 |

Task 4 carries a checkbox to remove every one of these guards and report each file's pass count and
seconds. Until that box is ticked, `npm run fast` is not the gate it reads as.

**A suspended test that says only "skipped" is indistinguishable from a test nobody wrote.** So each
skip message gives the reason and the flag: *"this file asks for N world days and a world day costs
about 15 s on this branch, not dev's 0.31 s. SLOW=1 runs it. Task 4 restores it."* That sentence is
the difference between a suspension and a quiet deletion.

**One gate moved, did not go, and is thinner. Here is by how much.** The plan names the snapshot
oracle, `tests/snapshot.js`, as one of the three gates standing in for the golden between task 1 and
the bless. Suspending that file does not remove the oracle: it also runs inside `tests/soak.js` as
*"seed x saved on day 1.5, loaded into a fresh sim, tells the same story to day 3"*. The gate
relocates in kind. It does not relocate in span, and the difference is the part worth writing down.

`tests/snapshot.js`'s oracle runs four cases, saving at 12,400, 12,400, 30,300 and 20,000 steps and
running on for 2,000 to 8,000 more. **On dev those were 12 to 30 world days before the save.** The
soak's oracle saves at 1.5 world days and runs to 3. A snapshot fault that needs time to show —
something rebuilt lazily, a counter that drifts, a field written only on a season's turn — is
invisible in 1.5 days and would have been caught in twelve. **That leg is thinner by about an order
of magnitude, not merely moved.**

**And a fifth bare old-tick count, found while checking that claim.** Those four spans are raw step
counts and **were never converted**. On this branch 12,400 steps is 0.14 of a world day, not 12.4
days. So the oracle in `tests/snapshot.js` is, right now, weaker than the soak's — the thing that
replaced it covers more world time than it does. Restoring the file at task 4 without converting
those four numbers would restore an oracle far weaker than dev's while reading as a restored gate.
Task 4's checkbox says so.

**Which run carries the oracle.** The soak's oracle is gated `skip: !isDefault`, and `isDefault`
requires `!LONG`, so **it does not run under `LONG=1`**. The long run and the oracle never run in the
same invocation. "The soak runs at every gate" is therefore not enough on its own: it is the
**default three-day soak** that carries the oracle, and the `LONG=1` run that carries the 70-day
assertions. Both are gates, and they cover different things.

### The tests left red, named

**Task 1 leaves no test red.** Every failure it could measure is now green, and every one of them was
a test counting in old ticks rather than a fault in the rules. What it leaves is six files
suspended, listed above, whose state is **unknown rather than green**. Nobody should read the suite
as a clean bill for them.

The three version tests inside `tests/snapshot.js` were run on their own, outside the cap, because
they are what owed item 1 changed. Two passed at once. **The third failed, and it is worth recording
why, because it is the same fault a fourth time.** `a save written before the names loads` ends by
stepping the loaded world and asserting that it names something again. The span was 200 ticks of the
old day. Two hundred ticks of the G4 day is three minutes of world time, and the naming pass runs
once a night, so the run never reached one and the world named nothing. The span converts to
`ticks(200)`, a fifth of a world day, and the assertion is untouched.

That is four separate places where a bare old-tick count survived into this branch: `tests/lib/run.js`,
two in `tests/door.js`, and this one — plus the thirty-one in the files converted above. Each was
found by looking, none by a rule — and a fifth, the snapshot oracle's four spans, is recorded under
"What is switched off" and owed to task 4.

**This is the most portable thing task 1 produced, so it is stated plainly.** A bare tick count is a
number. A number survives any rebasing intact. No lint can tell a duration from a magic constant,
because at the point the lint looks they are the same token. **Only a test that asserts the world DID
something can find one.** That is finding 1 restated, it is finding 2 and finding 5 restated, and it
is the floors report's finding arriving in a fifth place: a threshold on a standing quantity asks "is
there still enough", and after a rule stops firing the honest answer is "yes, for now".

**And this one was found by luck, which is worth more in the report than the fix is.** The three
version tests were run individually, outside the cap, only because they were what owed item 1
changed. Had they been left inside `tests/snapshot.js` they would have been suspended twenty minutes
later and the fault would have gone to dev behind a green suite, exactly as the other two of its
class did. Nothing in the process caught it. The next one of these will not be caught by being more
careful.

### The working record moved, deliberately

The plant fix of finding 5 changes what grows in every seed, so every seed's fingerprint moved and
two record comparisons in `tests/soak.js` went red against `tests/soak-working.json`. That is the fix
working. The working record is rewritten by this task with `UPDATE_GOLDEN=1 node tests/soak.js`,
which on this branch writes `tests/soak-working.json` and which `tests/soak.js`'s own failure message
names as the thing to do when the change is intended.

**`tests/soak-golden.json` is untouched.** No task writes it. Task 11 prepares the bless and the user
gives it.


## Standing constraints

- Never check out, stash or commit in `~/Code/hamlet`.
- No task runs `UPDATE_GOLDEN=1` against `tests/soak-golden.json`. Task 11 prepares the report; the
  user blesses. The working record may be rewritten by any task that says so in its report.
- `node build.js` after every change to `src/`, and commit the built page.
- **Use `git grep`, not plain `grep`.** `tests/clock.js` is clean now but the history is not: `git
  diff` on the repair prints the raw NUL bytes again on its own removal lines, so the diff of the fix
  is itself binary to plain grep.
- Tell dev-coordinator **before** the pull request opens, not after. It will not merge G4 on a
  routine gate pass: the merge publishes to the live site and the moment is the user's to pick.
- The user's three return points: the floors after task 4 measures, the bless at task 11, and the
  release moment. Nothing else comes back to them.
- Announce a task at its start, not its end. Several sessions run in parallel and a stale statement
  about who owns what cost four duplicate issues this morning.
- **A search that finds nothing is weak evidence of nothing**, and the argument layer is a place a
  search can fail before the tool runs. Checking that no raw NUL byte survived the merge,
  `git grep -c $'\0' -- tests/clock.js` reported 300 matching lines: the shell strips a NUL from an
  argument, so the pattern reached git as the empty string and matched every line. Reading the file's
  bytes in Node gave the true answer, zero. Confirm a load-bearing absence by a different KIND of
  method, not by a second search.

## Rulings received during this task

From **dev-coordinator**, relayed as the user's. They are recorded because they bind the tasks after
this one, not because task 1 acted on them.

1. **Measure the pinned fraction before tasks 2 and 3 are built.** The skip's payoff has a ceiling
   set by the share of ticks that must be stepped one at a time, and that share is knowable now for
   the cost of one run. Union and each cause separately, with a genuine third bucket, on `tiers-g4`.
   The predicate draws no random number, lives in `NOT_SAVED`, and the fingerprint must be proved
   identical with the counter on and off. **It is not a gate on task 4**: a predicate that later
   becomes the rule cannot also be what validates the rule.
2. **Widened after finding 5.** Before the fire-and-predator percentages, count how many of the
   eleven per-tick systems in `updateWorld` can be given a next beat at all. If even one cannot, the
   pinned fraction is 100 percent and the other numbers do not matter. This is reading, not running.
   It is why `growPlants` takes its look count as a closed form of the tick rather than as a rolled
   fraction: a roll would spend a random number every tick and leave the system with no next beat.
3. **`LONG=1` on seed `r` at every task gate** until the suspended floors return. It runs all nine
   suspended assertions at their original measured values.
4. **Task 4's timing number goes to the user through dev-coordinator**, with a recommendation.
5. **The floors decision is made**: every floor stays through G4 and no number is re-tuned during the
   retune, because re-flooring from a post-G4 measurement derives the floor from the thing it exists
   to check. Task 1's suspend-rather-than-rescale call is now the standing rule.

## Peers

- **dev-coordinator** merges to dev and gates G4. A relayed approval from it is reportable, not
  actionable; confirm anything load-bearing with the user directly.
- **patcher** triages and files. It is writing a report on what the soak's floors have historically
  caught. Its finding: two firings in 321 commits, both noise, and a planted total reproductive
  failure left `alive >= 8` green — rising to 28 on seed `x`, because nothing was killing anyone.
  Only `born >= 1` caught it. A threshold on a standing quantity asks "is there still enough", and
  after a rule stops firing the honest answer is "yes, for now".
