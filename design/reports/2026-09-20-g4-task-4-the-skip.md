# G4 task 4: the skip

**Branch** `tiers-g4`, worktree `/Users/earchibald/Worktrees/hamlet-g4`. Date 2026-09-20.

## Summary

| What | Result |
|---|---|
| `nextEvent()` and `runTo(t)` | Built. A skipped run and a stepped run give the same fingerprint, the same chronicle line for line, and the same layout, on six seeds over three world days. |
| The skip's measured gain on a real seed | **None.** The horizon is the next tick on 100.0 percent of ticks, on all six seeds. |
| Why | 85 beings walk, wander and dance on a per-tick beat. A walker takes a tile a tick by task 1's ruling, so while anything walks anywhere the engine may not jump. |
| The skip's measured gain when the animals are off the tick | 86,400 ticks in **26,403 moves**, 0.31 a tick, and the same story. So the machinery works; the valley does not let it run. |
| `npm run fast`, six files restored | See "The gates". The 300 s ceiling is **missed**, by the day counts and not by the skip. |
| The default soak | 115.3 s at load 3.95, against a 180 s ceiling. **Met.** The working record did not move. |
| `dark.slower` | `secs(2)`. Same number, and the entry now says what it measures. |
| `senseBeings`' stale list | Built once, before the loop. The predicate answers for the START of the tick. |
| The snapshot oracle's four spans | Converted, with nine more of the same kind in the same file. |
| The golden | `tests/soak-golden.json` md5 `1e1248d47dd2aabc9d430fd49275c665`, unchanged. `UPDATE_GOLDEN=1` was never run. |

## The finding that matters most

**The skip is correct and it buys nothing on a live valley.** That is a measurement, not an
impression, and it is the number the floors decision turns on.

On seed r at day 1 the horizon is the next tick on every one of 86,400 ticks. The reason is one line
of task 1: a being on a path moves one tile a tick. A being with a path acts every tick, and a valley
at day 1 holds about 85 beings, of which 24 are sprites at a dance that counts its progress every
tick and most of the rest are rabbits and deer that wander without pause. At least one of them acts on
every tick, so `nextEvent()` returns `tick + 1` every time.

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
skip does not shorten them. The `LONG=1` soak is not shortened either. The 1800 s ceiling stands
missed by about the factor the plan predicted, and for a reason the plan did not: not that jumping is
dear, but that the engine is almost never allowed one.

## What was built

### `advance`, `nextEvent`, `runTo`

`src/sim/main.js`. `step(oneAct)` is now `advance(tick + 1)`, and `advance(to)` is the old body of
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
| `tick + 1` while `fireCount > 0` | ruling 6's precondition, and the door lights a tile between two moves |
| `tick + 1` when the proximity pass found a hazard | ruling 6, off the answer the pass already worked out |
| `tick + 1` after a being acted | an act changes what `updateCamps` reads on the tick after it |

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
| `runTo` merely loops `step()` | `nextEvent` returns `tick + 1` always | 1 red: the still valley |
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

Every figure carries the one-minute load average at the moment it was taken, and the tool beside it.

## The six restored files

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
