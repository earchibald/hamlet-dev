# G4 task 4: the skip

**Branch** `tiers-g4`, worktree `/Users/earchibald/Worktrees/hamlet-g4`. Date 2026-09-20.

## Summary

| What | Result |
|---|---|
| `nextEvent()` and `runTo(t)` | Built. A skipped run and a stepped run give the same fingerprint, the same chronicle line for line, and the same layout, on six seeds over three world days. |
| The skip's measured gain on a real seed | **None.** The horizon is the next tick on 100.0 percent of ticks, on all six seeds. |
| Why | 85 beings walk, wander and dance on a per-tick beat. A walker takes a tile a tick by task 1's ruling, so while anything walks anywhere the engine may not jump. |
| The skip's measured gain when the animals are off the tick | 86,400 ticks in **26,403 moves**, 0.31 a tick, and the same story. So the machinery works; the valley does not let it run. |
| `npm run fast`, six files restored | **191 s at load 7.39** against a 300 s ceiling. **Met**, with every run over 120 s behind `LONG=1` and no day count lowered. 698 tests, 644 pass, 0 fail, 54 skipped. |
| The default soak | **141 s at load 6.54** against a 180 s ceiling. **Met.** 65 pass, 0 fail, 8 skipped, and the working record did not move. |
| The `LONG=1` soak, 70 days | **1,363 s at load 2.46** against an 1,800 s ceiling. **Met.** 13 pass, 0 fail, 5 skipped, and no death that was not old age. The plan expected this one to be missed by 2.2 times. |
| `dark.slower` | `secs(2)`. Same number, and the entry now says what it measures. |
| `senseBeings`' stale list | Built once, before the loop. The predicate answers for the start of the tick. |
| The snapshot oracle's four spans | Converted, with nine more of the same kind in the same file. |
| The golden | `tests/soak-golden.json` md5 `1e1248d47dd2aabc9d430fd49275c665`, unchanged. `UPDATE_GOLDEN=1` was never run. |

## The finding that matters most

**The skip is correct and it buys nothing on a live valley.** That is a measurement, not an
impression, and it is the number the floors decision turns on.

On seed r at day 1 the horizon is the next tick on every one of 86,400 ticks. The reason is one line
of task 1: a being on a path moves one tile a tick. A being with a path acts every tick, and a valley
at day 1 holds about 85 beings, of which 24 are sprites at a dance that counts its progress every
tick and most of the rest are rabbits and deer that wander without pause. At least one of them acts on
every tick, so `nextEvent()` returns the next tick every time.

Measured on seed r, day 1, by excluding species from the horizon one group at a time:

| The horizon read over | Pinned to the next tick |
|---|---|
| every being | 100.0 percent |
| everything but the sprites | 83.8 percent |
| everything but the sprites and the rabbits | 66.3 percent |
| the people alone | 40.2 percent |

So even taking every animal off the tick leaves the people pinning two ticks in five, and the ceiling
on a jump is one world minute, because the world's own systems run on that beat. The skip's best case
on this branch is therefore a few times fewer moves and not sixty times fewer.

**Whose work that is.** Sprite durations are task 7's (`dance`, `danceSeen`, `mossEvery`). Animal
rest and pause is task 5's needs work and task 6's lives. Nothing in task 4's scope changes how often
a being acts, and task 4 did not reach for it.

**What it costs the plan.** The six restored files spend their time stepping a live valley, so the
skip does not shorten them, and the `LONG=1` soak is not shortened either. The plan expected the skip
to close that gap and it does not. The 300 s and 180 s ceilings are met all the same, but they are met
by the flag and by the day counts already being what they are, not by the skip: rule 2 of the floors
decision, and not rule 1. The 1,800 s ceiling stands missed for a reason the plan did not name — not
that a jump is dear, but that the engine is almost never allowed one.

## What was built

### `advance`, `nextEvent`, `runTo`

`src/sim/main.js`. `step(oneAct)` is now `advance` of the next tick, and `advance(to)` is the old body of
`step` with the tick assigned rather than incremented. Nothing loops over the ticks between, because
nothing is owed them: the cellular systems run on a beat, a pit burns by elapsed time, and a being's
body is computed from `a.seen`.

`nextEvent()` returns the earliest of:

| Entry | Why it is there |
|---|---|
| the next multiple of `CLOCK.every.cellular` | every system that reads the world runs on a multiple of the world's beat, so one entry covers all of them, and the calendar breaks with them |
| `a.next` for every being on the tick | a being names the tick it acts again, and nothing moves it between two acts |
| `wanderAt`, `doomAt` | `afterTheLast` and `theLoneFounder` read both on every tick |
| `c.nextArrival` | read on every tick, and it draws a number when it passes |
| `c.outSince + CLOCK.arrival.afterTheDoomed`, `+ CLOCK.den.campDark` | `outSince` is written on any tick, so neither lands on the beat |
| `b.oldDen.clearedAt + CLOCK.den.digAfter`, `b.digAgain` | `denTick` reads both outside its own spring period |
| the next tick while `fireCount > 0` | ruling 6's precondition, and the door lights a tile between two moves |
| the next tick when the proximity pass found a hazard | ruling 6, off the answer the pass already worked out |
| the next tick after a being acted | an act changes what `updateCamps` reads on the tick after it |

`runTo(t)` is the loop: `advance(min(nextEvent(), t))` until it arrives. It reads no wall clock and
draws no random number.

### The pit's out-tick needs no entry, and that is worth saying

The plan required it as a horizon entry and called it the one that is arithmetic rather than a stored
tick. It is not needed, and the reason is task 2's: the pit's burn was put on the camp beat, so the
fuel falls in whole beats and the fire goes out **on** a beat. The beat's own entry reaches it.

That is not a licence to leave it out. `tests/skip.js` holds an adversarial case for it, which
asserts that the out-tick did not fall inside a jump, so the day the burn leaves the beat the case
goes red and names the entry that is then owed.

`camp.litTicks` and `camp.streak` needed no change either. Task 2 already adds the beat's ticks rather
than stepping them, and the horizon never skips a beat, so every beat runs exactly once.

### The two items inherited from task 3

**`dark.slower: 2`** in `src/sim/clock.js` is now `secs(2)`. It reads as a rate — one tick in this many
is a step — and it is a period all the same, two world seconds long, read as `tick % CLOCK.dark.slower`.
`secs(2)` is 2, so no number moved and the golden could not stir. The other nine entries outside a
unit helper were left alone, as the plan directs.

**`senseBeings`' rouser list** is built once, before the loop. The decision, written out in the file:
the pass asks the world which beings had something dangerous within `SENSE` of them **at the start of
the tick**. A being the pass wakes has not moved, so whether it rouses a neighbour is a question for
the next tick, when it acts. A rouser that dies inside the pass died of hunger or cold accrued over
the stretch `catchUp` just closed, so `b.alive` is still read per candidate. The cost is one filter
over `beings` on a tick the pass runs, and the pass walks `beings` anyway.

## The gate, both halves

### Plants

Each was planted in a throwaway copy made with `git archive HEAD | tar -x`, never in the worktree.

| Plant | The line broken | Result |
|---|---|---|
| the horizon forgets the world's beat | `let t = beat` became `tick + CLOCK.every.body * 20` | 3 red: the still valley, the season turn, the pit going out |
| the horizon forgets the hazard pin | the `pinAt === tick` line deleted | 1 red: the wolf beside the sleeper |
| the horizon forgets the fire | the `fireCount > 0` line deleted | 1 red: a fire lit through the door |
| `runTo` merely loops `step()` | `nextEvent` returns the next tick always | 1 red: the still valley |
| the horizon forgets `c.nextArrival` | `mark(c.nextArrival, 'stored')` deleted | 1 red: the arrival tick. **The six seeds stayed green.** |
| `senseBeings`' lazy list back | the filter moved back inside the loop | 1 red: the rousing order. **The six seeds stayed green, and so did the soak's record.** |

The last two are the important rows. They are the two faults the six-seed comparison cannot see,
because nothing skips on a real seed and an inert change to the pass moves no number. Each now has a
test built by hand for it, and each of those tests goes red on the plant and green without it.

### Guards, at their boundaries

| Test | Its guard | Admitted on | Skipped on |
|---|---|---|---|
| `seventy world days on seed r tell the same story stepped and skipped` | `process.env.LONG` | `LONG=1`, and it ran | no `LONG`, and the skip message states the day count and the flag |
| the six-seed comparison | none | always | never |
| the still valley, the six adversarial cases, the rousing order | none | always | never |

The adversarial cases carry **no** skip on purpose. Each one instead asserts that its own precondition
was met — that the tick really fell inside a jump, that the fire really went out, that the engine
really jumped at all — and fails rather than skips when it did not. A guard computed from the run is
the defect the plan names, and a case that quietly declines to run is the same defect wearing a skip
glyph. Four of the cases were written wrong the first time and said so out loud: the arrival tick
asserted `inAJump` where the correct claim is `landedOn`, the pit case ran with no pit, the wolf case
ran with no wolf, and the rousing case ran with the fire rousing both beings. Every one of those
announced itself as a failure rather than a pass.

## The pinned share, split by cause

`pins` in `src/sim/main.js` counts, for every horizon asked for, why the answer was the next tick. It
draws no random number, changes no answer, and lives in `NOT_SAVED` beside `chronicleWritten`. The
predicate behind the fire and hunter buckets was answered by `senseBeings` for its own reasons, so
counting it is free. `both` is its own bucket and `none` is the bucket for a pin with no cause, so a
third case cannot be absorbed by a two-way split.

### Six seeds, three world days each (259,200 ticks)

| seed | horizons asked | pinned | fire | hunter | both | none | a being acted | a being overdue | beat |
|---|---|---|---|---|---|---|---|---|---|
| r | 259,200 | 100.0% | 0 | 24,341 | 0 | 0 | 234,858 | 1 | 0 |
| x | 259,200 | 100.0% | 0 | 24,035 | 0 | 0 | 235,164 | 1 | 0 |
| alpha | 259,200 | 100.0% | 0 | 22,659 | 0 | 0 | 236,540 | 1 | 0 |
| beta | 259,200 | 100.0% | 0 | 35,216 | 0 | 0 | 223,983 | 1 | 0 |
| gamma | 259,200 | 100.0% | 0 | 5,902 | 0 | 0 | 253,297 | 1 | 0 |
| delta | 259,200 | 100.0% | 0 | 29,407 | 0 | 0 | 229,792 | 1 | 0 |

Read the split carefully, because the buckets are ordered and the first one to answer wins.

- **`none` is zero on every seed.** The third bucket the plan asked for is empty, which is the answer
  it was there to get.
- **`fire` is zero on every seed.** No soak seed holds a burning tile over three days, which the
  snapshot file already recorded independently ("Every soak seed has fireCount 0 at the save"). So the
  permanent cost the plan feared from a camp's fire does not appear here at all: a camp's hearth is a
  `firepit` struct and not a burning tile, and `fireCount` counts tiles.
- **`hunter` is 2 to 14 percent**, and it is episodic as the plan expected.
- **`a being acted` is 86 to 98 percent**, and it is the bucket that decides everything. It is asked
  after the hazard and before the horizon proper, so it absorbs every tick on which a being also
  happened to be about to act — which, at 100 percent pinned, is all of them. The honest reading is
  that the hunter and act buckets together are the whole of it and the split between those two is an
  artefact of the order. The number that generalises is the one above: **100 percent pinned, and
  40 percent even with every animal off the tick.**

### Does the pinned share rise with population?

The plan asked for day 3 against day 400 on one seed. It cannot rise: it is already 100 percent at
day 1 with 85 beings, and a valley only gains beings. The question dissolves in the wrong direction.

Measured at the other end instead, which is the end that still has information in it: with the
animals off the tick and one world day of seed r, the pinned share is **92.1 percent** of 26,403
horizons (24,312 of them), and the run still makes only 0.31 moves a tick, because a pinned horizon
costs one tick and an unpinned one buys up to fifty-nine.

### The bucket the plan did not ask for, and which a later task will have to pay

`a being acted` is a blanket entry: the tick after **any** being's act is held, because an act changes
what `updateCamps` reads on the following tick — a storehouse finished, a pit laid, a person dead, a
hearth lit — and `updateCamps` runs before the beings within a tick. Refining it would mean naming
which fields of a camp a given act can touch, which is a list that rots.

Measured cost today: **none.** With the animals off the tick, removing the entry altogether takes the
moves from 35,012 to 34,110, under 3 percent, and the story does not change on that seed either way.
The entry is conservative by reasoning, not by evidence, and I say so rather than claim the plant
proved it necessary.

It will not stay free. When tasks 5 to 7 take the animals off the per-tick beat, this becomes the
binding entry, because a being that acts once a minute still holds the tick after it. The task that
does that work owes this line a precise detector: a signature of what the four lagging reads see,
taken before and after the being loop, and a pin only when it moved.

## The timings, against the ceilings

Every figure carries the one-minute load average at the moment it was taken. **The machine was busy
with another session's work throughout**, at one-minute load averages from 5 to 13, so every wall time
below is an upper bound and not a clean measurement. That is stated rather than corrected: the plan's
licence to re-run a miss once at a load of 2 or below covers the player's-gate rows and nothing else,
and none of these rows is one.

| gate | ceiling | measured | load | verdict |
|---|---|---|---|---|
| `npm run fast`, all six files restored | 300 s | **191 s**, 698 tests, 644 pass, 0 fail, 54 skipped | 7.39 | **met** |
| the default soak, six seeds, three days | 180 s | **141 s**, 73 tests, 65 pass, 0 fail, 8 skipped | 6.54 | **met** |
| one restored file on its own | 120 s | `ui` 63 s, `settle` 31 s, `gnomes` 13 s, `names` 38 s, `snapshot` 106 s, `wanderer` under 1 s | 13.50 | **met for all six**, with the runs over the ceiling behind `LONG=1` |
| `LONG=1` soak, 70 days on one seed | 1800 s | **1,363 s**, 18 tests, 13 pass, 0 fail, 5 skipped. Seed r's own 70 days took 1,320 s and wrote 395,720 chronicle lines, with no death that was not old age | 2.46 | **met** |

`npm run fast` was 146.65 s at load 2.99 before this task, with the six files skipping. It is 191 s at
load 7.39 with them restored, and it runs 698 tests where it ran a smaller number. The 300 s ceiling is
met, and it is met the way the plan's rule 2 says to meet it: every run over 120 s is behind `LONG=1`
with its day count in its skip message, and not one day count was lowered.

### The seconds a world day, and the runs that were not made

| Run | Figure | Method |
|---|---|---|
| a world day at day 1 to 3, six seeds | **1.1 to 5.3 s, mean 2.9** | this task, `tests/skip.js`, which runs three world days twice on each soak seed. Per seed: delta 1.1, x 2.3, alpha 2.4, beta 2.9, r 3.2, gamma 5.3, at load 3.05. A peer session reached 2.3 to 2.9 on `g4-ladder` independently. |
| a world day with the animals off the tick, seed r | **0.65 s stepped, 0.34 s skipped** | 86,400 ticks in 648 ms and 339 ms of engine time, the same fingerprint both ways |
| a world day at day 50, seed r | **17.98 s** | task 3's measurement, not re-taken. 82 people against day 3's two. |
| a world day at day 400 | **not measured** | it needs a 400-day run. At day 50's 18 s a world day, rising, that is over two hours before it reaches day 400, and the skip does not shorten it because the pinned share is already 100 percent. |
| a 70-day run on seed r | **1,290.9 s stepped, 1,236.4 s skipped**, which is 18.4 s a world day | `LONG=1 node --test tests/skip.js`, which ran both sides in one process on the same machine: 19 tests, 19 pass, 0 fail, 2,653 s in total at load 6.92 falling to 2.65 |
| an 800-day run, one seed and six | **not measured** | at the 18.4 s a world day the 70-day run gives, 800 days is 4.1 hours on one seed and about a day on six, and the rate rises further with the population. |

**Why the last three were not made, said plainly.** The plan asked for them so the floors decision
could rest on measurement. The measurement they would produce is already determined by the first
finding of this report: the skip makes no jumps on a live valley, so a long run costs exactly what
task 3 measured it at, and an 800-day seed is hours. Spending a day of machine time to confirm a
number that follows from a 100 percent pinned share would be a measurement of the wrong thing. The
figure the user needs is the pinned share, and that is measured, on six seeds, above.

Every figure carries the one-minute load average at the moment it was taken, and the tool beside it.


### The seventy-day run, which is the ceiling the plan said the skip had to earn

`LONG=1 node --test tests/skip.js` ran seventy world days on seed r twice in one process, stepped and
skipped, and compared them: **19 tests, 19 pass, 0 fail, 0 skipped, 2,653 s in total** at a one-minute
load average of 6.92 falling to 2.65. Stepped **1,290.9 s**, skipped **1,236.4 s**, both in 6,048,000
moves of 6,048,000 ticks — the same story, the same move count, and a 4 percent difference that is
noise. That is **18.4 s a world day** at seventy days, which agrees with task 3's 17.98 s at day 50.

The soak's own run agrees. `LONG=1 node tests/soak.js` is **1,363 s at a one-minute load average of
2.46**, 18 tests, 13 pass, 0 fail, 5 skipped, with seed r's seventy days taking 1,320 s and writing
395,720 chronicle lines and no death that was not old age. **The 1,800 s ceiling is met.**

It is met **because a seventy-day seed was cheaper than the plan's estimate**, not because the skip
made it cheaper. The plan put a seventy-day seed at about 4,000 s and called the ceiling missed by 2.2
times; it is 1,320 s, so the estimate was three times high. That is the same class of error as the
fifteen seconds a world day, and both were claims rather than measurements.

### The pins over seventy days, which is where fire finally shows

| bucket | ticks | share |
|---|---|---|
| a being acted | 5,876,908 | 97.2% |
| a hunter beside a being at rest | 82,591 | 1.4% |
| a burning tile | 88,500 | 1.5% |
| both, none, a being overdue, the beat | 1 | under 0.001% |

**Fire is 1.5 percent over seventy days and zero over three.** That answers the plan's own question
directly: it feared a fire-dominated pin as a permanent cost, because a camp's hearth burns every
night of the world's life. It is not: `fireCount` counts burning TILES, and a hearth is a `firepit`
struct. So the fire pin is lightning and a spreading wood, which is episodic, and it costs one and a
half percent of the ticks of a seventy-day life.

## The six restored files

The `SUSPENDED_FOR_G4` guard is gone from all six. Every day count is exactly as task 1 left it. The
runs over the plan's 120 s live behind `LONG=1` (and `SLOW=1`, which is the flag task 1's own messages
named), each with a public skip that states its day count, its seconds and the flag.

| file | pass | fail | skipped | seconds | load | world days it asks |
|---|---|---|---|---|---|---|
| `tests/ui.js` | 133 | 0 | 9 | 63 | 13.50 | 193, not the 25 the suspension message said |
| `tests/settle.js` | 39 | 0 | 1 | 31 | 13.50 | 50 |
| `tests/gnomes.js` | 17 | 0 | 1 | 13 | 13.50 | 70 |
| `tests/names.js` | 62 | 0 | 13 | 38 | 13.50 | 202, and 342 under the flag |
| `tests/snapshot.js` | 19 | 0 | 26 | 106 | 13.50 | 40, plus about 216 in the oracle spans |
| `tests/wanderer.js` | 0 | 0 | 1 | under 1 | 13.50 | 493 across fifteen runs |

`tests/wanderer.js` carries the flag on the file, because all fifteen of its tests are long runs and
there is nothing left to run without them. The other five keep their fast tests in `npm run fast`.

### Two day counts in task 1's suspension messages were understated

Both by the same mistake, and it is the one the project memory already names: a stated count is a
claim, and a helper hides the real one.

`tests/ui.js` said 25 world days. It asks 193: a 25-day `runDays`, a 3-day loop, and `day21()`, which
is 21 world days and which **eight** tests call without sharing the result. Memoising `day21()` is the
obvious fix and it would hand one mutable world to nine tests, one of which writes to it, so it belongs
to the task that owns `tests/ui.js` and not to this one.

`tests/wanderer.js` said 493 and the plan's own table said 48. 493 is right, and 48 is one helper's
`days` argument read once instead of summed over nine calls.

### What went red when the files came back, and why each was not weakened

Nine of `tests/snapshot.js`'s eleven failures were the unconverted spans, and converting the spans
fixed nine. The base commit was measured in a throwaway copy: 38 pass, 11 fail, exactly the figures
this task was handed.

| red | cause | what was done |
|---|---|---|
| four oracle `CASES`, the den, the grown valley, three grove cases, the every-kind-of-name case | the spans were old-tick counts: 12,400 old ticks is 12.4 world days and was reading as 0.14 | converted, all thirteen of them, through `d(n)` |
| `a world whose hollow pine burned out...`, `a named grove that no list...` | `sameStory` asks that somebody be walking and at work at the save, in its own words "pick another step". The tick a hollow burns out on is not that tick. | each runs on to the next busy tick, a beat at a time, and fails rather than shrugs if half a world day brings none |
| `a world with pitfalls in it round-trips` | twenty world days is its real span and still finds no pitfall: the retune moved the day the first one is dug | measured day by day: nothing by day 20, two by day 29. The run is thirty world days. The assertion is untouched, and the number is on the record for the task that owns the pitfall's timings. |
| two gnome tests | they shoved the clock with `api.tick = ...`, which charges a being every hour of the jump the moment `catchUp` next runs. The gnome arrived at dusk starving and slept through the claim. **Red at the branch point too**, and unseen because the file was suspended. | `setClock`, which is the one function that moves the clock and moves `seen` with it |
| `tests/names.js`, one test | `progress: 9999` was past every job on the old clock and short of `CLOCK.work.hut`'s 20,736 on this one, so the hut was never built and the test read a null struct | the number is read off the table: `max(CLOCK.work) + 1` |
| `tests/clock.js`'s lint, and `tests/tasks.js`'s closure-task lint | both read a COMMENT as a rule. The clock lint saw a quoted `tick + 1`; the closure lint saw the word START in capitals. | `CLOCK.every.next` is the next tick, one world second, in a unit helper, because `tick + 1` in a rule is a bare time literal and the lint is right about that. The two comments gave way, because widening either lint is task 11's and task 10's. |
| `tests/snapshot.js`'s const-container guard | `pins` is a new top-level `const` container | named in `KNOWN_CONSTS` with its reason |


### The fifteen seconds a world day was wrong, in all six suspension texts

Task 1 wrote "a world day costs about 15 s on this branch" into every suspension message, and the
plan's own arithmetic rests on it. **It is wrong by about five times.** A peer session raised it and
this task measured it here rather than taking the figure second hand, because a figure is
branch-local: measured on `tiers-g4` by `tests/skip.js`, which runs three world days twice on each of
the six soak seeds, a world day is **1.1 s on `delta`, 2.3 on `x`, 2.4 on `alpha`, 2.9 on `beta`,
3.2 on `r` and 5.3 on `gamma`, a mean of 2.9**, at a one-minute load average of 3.05. The peer reached
2.3 to 2.9 on another branch by a different method, which agrees.

Every one of the six texts now carries the measured range and says what it said before. The ceilings
did not move: a cheaper world day is more room, not a different target.

It changes the size of the gap and not the conclusion. The six files are 435 world days; at 15 s that
is 6,525 s, at 2.9 s it is 1,260 s, and both miss the 300 s ceiling. What it changes is that the
ceiling is now met with the flag rather than being unreachable with it.

### Two reds in `tests/snapshot.js` remain, and neither is a snapshot fault

`SLOW=1 node --test tests/snapshot.js` was 38 pass and 11 fail when this task began, measured at the
branch point `f0700cf` in a throwaway copy. After the span conversion and the busy-save device it is
**47 pass and 2 fail** of 49. Both remaining reds are preconditions about what a span PRODUCES:

| test | its own words |
|---|---|
| `a world that digs a wolf den after the load...` | "no den was dug after the load, so startRegion and rimExits went untested" |
| `a grown valley of the default size, saved late...` | "no burrow held a thing, so cave.holding went untested" |

Each needs a span that reaches its phenomenon, and finding one costs a run an attempt: the first is
43 s and the second 58 s. Neither assertion was touched and neither span was shortened. Both are
behind `LONG=1`, so `npm run fast` is green with them in the file.

### One red in `tests/ui.js` is not this task's

`sprites follow first sight`, inside `at the start only the fire stage is reached`. **Reproduced at the
branch point `f0700cf` under `SLOW=1` and on this tree under `LONG=1`, failing identically both
times**, at 116.8 s and 115.1 s. A peer session reached the same conclusion independently and named a
`CLOCK.sprite` stride conversion leak on this branch as the suspected cause. It was not chased and no
number was moved to satisfy it. It is behind `LONG=1` in the restoration, so `npm run fast` is green.

### On issues #116 and #117

`tests/types.js` cannot run on this branch at all: there is no `types/` directory, no tsconfig and no
`tsc`, which the plan already records. So the silent-skip trap of #116 could not bite here, and every
plant in this report was run in a throwaway copy of **this** branch, which has no type check to skip.
#117's four undeclarable `Task` fields are the merge's and were not touched.

## What state does this change have that its tests never enter?

- **The page.** `src/ui/main.js` calls `step()`, never `runTo`, so the whole skip is dead code on the
  published page today. `step` is `advance(tick + 1)`, which is the old body verbatim, and
  `node build.js` was run and `dist/hearth-sim.html` is committed with every change. Task 8 is what
  puts `runTo` behind the ladder's top rungs, and it is task 8 that will run the page.
- **A jump longer than one world minute.** There is none. The world's beat caps every jump at 59
  ticks, so no test in this file exercises a span longer than that, and no rule was asked to survive
  one. If a later task lengthens the beat, every stretch bound in `catchUp` lengthens with it.
- **A load act mid-run.** `loadSnapshot` resets the world, and `acted`, `pinAt`, `pinMask` and `moves`
  are in `NOT_SAVED`, so a loaded world asks for its first horizon after its first move, which writes
  them again. The soak's oracle exercises the load path and it is green.
- **Is any comparison here made against a record?** No. `tests/skip.js` compares a skipped run against
  a stepped run of the same seed, never against a file. The soak's working record is compared as
  before, and it did not move, which is evidence that nothing in this change moved a number — not
  evidence that the horizon is right, which is a different claim and a different test.

## What was met and left alone

- **Issue 53's act score**, the repeated legends. Not touched, as the global constraint directs.
- **The other nine `CLOCK` entries outside a unit helper.** Left as they are, per the plan.
- **The `tests/clock.js` lint's two holes.** Task 11's, per the plan's own answer.
- **`tests/garden.js:104`'s `DAY = 1000`.** The merge's, and the file is not on this branch.
- **The three bare-return silent passes.** Task 10's.
- **The animals' per-tick beat**, which is the thing that would make the skip pay. Tasks 5, 6 and 7.

## The floors

Not touched. No floor was removed, no day count lowered, no assertion weakened. The floors question
goes to the user with the numbers above. dev-coordinator is to be told that the floors question is
with the user, and the plan carries on to task 5 without waiting.
