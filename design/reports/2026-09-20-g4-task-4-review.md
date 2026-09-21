# G4 task 4 review: the skip

Branch `tiers-g4`, worktree `/Users/earchibald/Worktrees/hamlet-g4`. Date 2026-09-20.
Reviewed `f0700cf..56076d4`, ten commits. I wrote none of the work under review.

**A seam in my own figures.** I read the report and the diff at `eda2434`. `56076d4` landed at 17:23,
before my first gate ran at 17:24. So every gate number, plant and measurement below was taken at
`56076d4`. The tenth commit touches only comments, one assertion *message*, and the report, so nothing
I read at `eda2434` moved under me. I state it rather than paper over it.

## Summary

| # | Finding | Grade |
|---|---|---|
| M1 | `pins.none` cannot be reached, and a third hazard cause lands in `hunter`. The plan's named fault, in the counter built to prevent it. | Critical |
| M2 | `runTo` ships with zero coverage. Gut it and every gate stays green. Three copies of the loop exist and the tested ones are not the one that ships. | Major |
| M3 | Two red tests now sit behind `LONG=1`, so `npm run fast` reads green with them in it. Disclosed in the report. | Major |
| m1 | The exclusion experiment measured three different valleys. Same-valley figures differ by 7 to 17 points. | Minor |
| m2 | The pit case does not catch every burn that leaves the beat, and the guard the report names is not the one that fires. | Minor |
| m3 | The horizon's one assumption rests on a hand list with no completeness check. | Minor |
| m4 | A mean over seventy days is compared with one day's rate at day 50 and called agreement. | Minor |
| m5 | The stranded sample went from every 1,000 ticks to every 1,200. Sound reason, 20 percent less reach. | Minor |
| n1 | The restoration is real: 291 passing tests came back for 24 s. Measured at both ends. | Note |
| n2 | A pre-existing budget skip inside `npm run fast` can never fire, because `fast` runs in parallel. | Note |
| n3 | The two comments that gave way are held by real lints and lost no substance. Both proved by plant. | Note |
| n4 | `CLOCK.every.next` and `dark.slower` moved no number. | Note |
| n5 | `runOn` now reaches past `step`'s `pending` and gods-era guards. | Note |
| n6 | The plan's 4,000 s estimate has no source, so the `LONG=1` ceiling decides nothing. | Note |
| n7 | A lit hearth does not raise `fireCount`. The plan's feared permanent fire pin is genuinely absent. | Note |
| n8 | The bucket order makes `acted` the residual, not `fire` and `hunter`. | Note |
| n9 | No day count was lowered, and the season arithmetic holds. | Note |
| n10 | The structural claim about `tests/snapshot.js` is right, and countable. | Note |
| n11 | Both "plants nothing else could see" reproduce exactly. | Note |
| n12 | The ten commit messages match their diffs. | Note |

**The central claim is confirmed.** The horizon is the next tick on 100.0000 percent of ticks, on all
six seeds over three world days, by an instrument that does not read `pins`. See "The pinned share".

## The pinned share, measured a second way

The report's number comes from `pins`, the counter the same commit added. A counter cannot check its own
number, so I measured it two other ways.

**Instrument one: my own move counter.** A skipping run makes one move per horizon. If every horizon is
the next tick, the run makes exactly as many moves as there are ticks. So I ran my own loop —
`advance(min(nextEvent(), end))` — and counted the moves myself, reading neither `api.pins` nor
`api.moves`. Script at `/Users/earchibald/.claude/jobs/8b2c73e8/tmp/moves.js`.

| seed | my moves | ticks | my jumps | pinned |
|---|---|---|---|---|
| r | 259,200 | 259,200 | 0 | 100.0000% |
| x | 259,200 | 259,200 | 0 | 100.0000% |
| alpha | 259,200 | 259,200 | 0 | 100.0000% |
| beta | 259,200 | 259,200 | 0 | 100.0000% |
| gamma | 259,200 | 259,200 | 0 | 100.0000% |
| delta | 259,200 | 259,200 | 0 | 100.0000% |

At a one-minute load average of 2.57 rising to 3.24. It is exactly 100 percent and not a rounded
99.9996: zero jumps were made on any seed. I agree with the report's figure.

**Instrument two: the records, not the horizon.** A stepped run of one world day on seed r, and after
each tick I asked the records directly whether anything falls due on the next tick — did a being act on
this tick, does a being name the next tick, is a tile on fire. `nextEvent` was not called. The answer is
100.00 percent of 86,400 ticks. Script at `/Users/earchibald/.claude/jobs/8b2c73e8/tmp/pin.js`.

**Seconds a world day, on the way past.** 1.04 on delta, 2.10 on x, 2.17 on alpha, 2.34 on gamma, 3.02
on r, 3.26 on beta, mean 2.32, at load 2.57 to 3.24. The report's 1.1 to 5.3, mean 2.9, was taken at
load 3.05 on a busier machine. Both refute task 1's fifteen seconds a world day.

**Does the pinned share rise with population?** It cannot. It is already exactly 100 percent at day 1.
The report is right and the plan's question dissolves.

**Seventy days.** Not re-run, per the brief. The report's own seventy-day buckets sum to 5,876,908 +
82,591 + 88,500 + 1 = 6,048,000, which is exactly the tick count, so its table asserts 100 percent
pinned over seventy days as well. The commit message's "the same 6,048,000 moves" agrees. I take it as
internally consistent, not as verified.

## Critical

### M1. `pins.none` is unreachable, and a third hazard cause is absorbed into `hunter`

`/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js` line 584:

    if (pinAt !== tick){ pinAt = tick; pinMask = 0; }
    pinMask |= cause === 'fire' ? 1 : 2;

`/Users/earchibald/Worktrees/hamlet-g4/src/sim/main.js` line 184:

    if (pinAt === tick){ pins[pinMask === 1 ? 'fire' : pinMask === 2 ? 'hunter' : pinMask === 3 ? 'both' : 'none']++; ... }

`senseBeings` sets `cause` only where it also sets `found`, and every value that is not `'fire'` maps to
bit 2. So `pinMask` is never 0 once `pinAt === tick`, and `none` requires `pinMask === 0`. The bucket
cannot be reached.

**Method, not reading.** I planted a third cause in a throwaway copy of `56076d4` by relabelling the
rouser branch from `cause = 'hunter'` to `cause = 'thirdCause'`. Arrangement: seed r, animals off the
tick, the clock set to night on day 4, every person asleep, an awake wolf two tiles from the first
sleeper, 600 ticks. The counters came back

    HEAD:    {"asked":35,"next":16,"fire":0,"hunter":1,"both":0,"none":0,"acted":14,"being":10,"stored":0,"beat":10}
    planted: {"asked":35,"next":16,"fire":0,"hunter":1,"both":0,"none":0,"acted":14,"being":10,"stored":0,"beat":10}

Byte for byte the same. A third cause was counted as a hunter and `none` stayed 0.

**Why this is Critical rather than Major.** The plan does not ask for a third bucket as a nicety. It
names this exact failure by name: "Count any third cause separately rather than letting it fall into one
of the two. A two-way split silently absorbing a third case is this plan's recurring fault, and here it
would make a permanent cost look episodic." The report answers that requirement with a claim, at lines
150 to 152: "`both` is its own bucket and `none` is the bucket for a pin with no cause, so a third case
cannot be absorbed by a two-way split." The same claim sits in the source comment in `main.js`. It is
false. The bucket is decoration.

The report then reads the constant as a result, at lines 166 to 167: "**`none` is zero on every seed.**
The third bucket the plan asked for is empty, which is the answer it was there to get." An empty bucket
is a real result or an unreachable one, and this one is unreachable.

No conclusion in the report changes today, because there is no third cause yet. What is lost is the
guard against the next one.

## Major

### M2. `runTo` ships with zero coverage, and three copies of the loop exist

`/Users/earchibald/Worktrees/hamlet-g4/src/sim/main.js` line 213.

The plan says: "`runTo` is what the soak, the long run, and `tests/lib/run.js` use." That is not what
happened. `tests/lib/run.js:runOn` holds a second copy of the loop with a god folded into the horizon,
and `tests/skip.js:skipOn` holds a third. Nothing calls `runTo`. `src/ui/main.js` calls `step`, which the
report states.

**Method.** I replaced the body of `runTo` with `return tick;` in a throwaway copy and ran the gates.

| gate | HEAD | with `runTo` gutted |
|---|---|---|
| `npm run fast` | 698 tests, 644 pass, 0 fail, 54 skipped | 698, 644, 0, 54 |
| `node tests/soak.js` | 73, 65, 0, 8 | 73, 65, 0, 8 |

At load 1.98. Identical. Grep confirms no caller in `src/` or `tests/`; the `runToDays` hits in
`tests/ui.js` are that file's own local function.

The two loops that are tested are not the loop that ships, and they differ from it: `runTo` checks
`pending` and folds in no god. The report's summary line "`nextEvent()` and `runTo(t)` | Built" cites a
proof that never calls `runTo`. Task 8 is named as the task that puts `runTo` behind the ladder; it will
be the first thing to run it.

### M3. Two red tests now live behind `LONG=1`, and `npm run fast` reads green

`/Users/earchibald/Worktrees/hamlet-g4/tests/snapshot.js`.

`SLOW=1 node --test tests/snapshot.js`: **49 tests, 47 pass, 2 fail, 0 skipped, 1,239.6 s**, at a
one-minute load average of 2.49 rising to 3.20. Both ends of the report's claim are confirmed, and so is
dev-coordinator's correction: 47/2 is this branch, 49/0 is dev's tree.

The two reds are red for the stated reason and no other. Their own diagnostics:

- `a world that digs a wolf den after the load runs on as the straight run does` — "0 wolves were
  den-less at the save; after the load: "
- `a grown valley of the default size, saved late, runs on as the straight run does` — "beta at the save:
  2 camps, 7 caves, 0 of them holding something, 54 beings"

Both are preconditions about what the span produces, as the report says. Both are behind `LONG=1` and not
silenced: they appear in `npm run fast`'s skip list as skips 36 and 37 of 54, each naming its day count
and its flag.

The grade is Major because the gate this task exists to restore now reads 0 fail with two known reds
inside it. It is not Critical because the report names both, gives their words, and says neither
assertion was touched — which I confirmed against the diff.

## Minor

### m1. The exclusion experiment measured three different valleys

Report lines 32 to 39. The report excludes species by taking them off the tick, which changes the world
and the random stream. I repeated the experiment without changing the world, by excluding species from
the *question* rather than from the valley: one stepped run of seed r, day 1, and for each tick I asked
whether any being of the included species acted on this tick or names the next one.

| the horizon read over | mine, one unchanged valley | the report, species off the tick |
|---|---|---|
| every being | 100.00% | 100.0% |
| everything but the sprites | 94.67% | 83.8% |
| everything but the sprites and the rabbits | 83.67% | 66.3% |
| the people alone | 33.33% | 40.2% |

Every row differs, by 7 to 17 points, and the last differs in the opposite direction from the others. So
the report's three exclusion rows are shares of three different valleys and are not comparable with each
other or with the first row. The conclusion they carry survives — the animals dominate, and the people
alone still pin a third of ticks — but the figure to quote for the people alone is **33.33 percent**, not
40.2. That 33.33 is exactly one tick in three, which reads as a period and not a coincidence; whoever
takes tasks 5 to 7 should find out which one.

### m2. The pit case does not catch every burn that leaves the beat

`/Users/earchibald/Worktrees/hamlet-g4/tests/skip.js`, the test `a pit that goes out inside a span writes
its line at the same tick`, and the line the report leans on:

    assert.ok(!inAJump(b, out), 'the out-tick fell inside a jump, so the burn has left the beat and nextEvent owes it an entry');

The positive half of the report's argument is sound. `/Users/earchibald/Worktrees/hamlet-g4/src/sim/camps.js`
line 291 sets `onCampBeat = tick % CLOCK.every.cellular === 0` and line 298 gates the burn on it, so the
fuel falls in whole beats and the fire goes out on a beat. Confirmed.

The safety net is not. I planted the burn off the beat, twice, in throwaway copies.

| plant at camps.js:291 | the out-tick | the case |
|---|---|---|
| `=== 1` | moved from 331,920 to 331,861, which is 1 mod 60 | **green** |
| `=== 30` | never reached in the skipped run | red |

The `=== 1` plant is the one that matters. Measured why: in that arrangement the engine visits only
residues 0, 1 and 2 mod 60, because the beat tick is followed by the `acted` pin and then by another. So
the burn can leave the beat and land on a tick the engine already always visits, and the named guard does
not fire. At `=== 30` the case does go red, but on the equality assertion — "the skipped run never put the
fire out" — and not on `!inAJump`, which is the assertion the report says will name the owed entry.

So the plan's REQUIRED pit entry is absent, and the substitute is a test whose sensitivity depends on
which residue the burn lands on. The report's sentence "the day the burn leaves the beat the case goes
red and names the entry that is then owed" is true for some of those days and not all of them.

### m3. The horizon's one assumption rests on a hand list with no completeness check

`/Users/earchibald/Worktrees/hamlet-g4/tests/skip.js`, `WORLD_PERIODS`, and the test `every period the
world itself runs on lies on the cellular grid`. Two plants, both in throwaway copies.

| plant | result |
|---|---|
| a LISTED period taken off the beat: `CLOCK.grove.every` from `ticks(500)` to `7` | **red** — "a world period off the beat is a rule the skip can jump over" |
| a NEW off-beat period: `CLOCK.every.freshPeriod: 7`, read by `tick % CLOCK.every.freshPeriod` in a new function in `world.js` | **green** |

The assertion fires, and the list is not exhaustive. A world period added by a later task and not written
into `WORLD_PERIODS` is never checked, and the file's own header calls this "the horizon's one
assumption". The list does guard itself against a path that *disappears* (`is not a number, so the list
has gone stale`), which is half of what is needed.

### m4. A mean is compared with an instantaneous rate and called agreement

Report line 254: "That is **18.4 s a world day** at seventy days, which agrees with task 3's 17.98 s at
day 50."

18.4 is 1,290.9 s divided by 70, a mean over days 1 to 70. 17.98 is one world day measured at day 50.
They are different quantities, and their near-equality is not corroboration. Worse, if both are right and
the cost rises with population as the report says elsewhere, then days 1 to 50 cannot cost more than
50 x 18 = 900 s, so days 51 to 70 cost at least 391 s, or 19.6 s a day — and on a curve that runs from
3 s a day at day 3 to 18 s at day 50, days 51 to 70 are nearer 35 s a day. The two figures are
consistent with a steep late curve, not with each other.

### m5. The stranded sample lost 20 percent of its reach

`/Users/earchibald/Worktrees/hamlet-g4/tests/soak.js` line 92 and
`/Users/earchibald/Worktrees/hamlet-g4/tests/gnomes.js`: `api.tick % 1000 === 0` became
`api.tick % 1200 === 0`.

The reason given is correct and I checked it: 1,000 is not a multiple of the 60-tick beat, so a skipping
run may never visit it, while 1,200 is twenty world minutes and always visited. The cost is that the
stranded-being check now runs 72 times a world day where it ran 86.4. Nothing was caught either way on
these seeds — the golden did not move, and I re-ran the soak. It is the one place in the diff where a
check's reach was reduced, and the plan forbids widening or lowering one, so it belongs on the record
rather than in a footnote.

## Notes

**n1. The restoration is real, and the ceiling is met at the load the ceiling assumes.** Measured at both
ends, by me, on a quiet machine.

| tree | wall time | load (1 min) | tests | pass | fail | skipped |
|---|---|---|---|---|---|---|
| `f0700cf`, the branch point | 147.46 s | 2.06 | 360 | 353 | 0 | 7 |
| `56076d4`, HEAD | 171.15 s | 2.83 | 698 | 644 | 0 | 54 |

338 tests came back, 291 of them running, for 24 s. The 300 s ceiling is met with 43 percent of headroom
at a load of 2.8. The report's 191 s at load 7.39 was an honest upper bound and it said so.

**n2. A budget skip inside `npm run fast` can never fire.**
`/Users/earchibald/Worktrees/hamlet-g4/tests/beings-lazy.js`'s `a world day at day 3 costs under five
seconds` skipped in my run with "the budget went unmeasured at a one-minute load average of 9.39, which
is over 2; the day took 5.02 s." `node --test` runs the files in parallel, so the load inside `npm run
fast` is always above 2 and that budget is never measured there. The day also took 5.02 s against a
budget of five. Not this task's file and not changed by it, but it is a live instance of a test that stops
happening, sitting inside the gate this task restored.

**n3. The two comments that gave way are held by real lints, and lost no substance.** Both proved by
plant, in a throwaway copy.

| plant | result |
|---|---|
| `tick + 1` put back into a comment in `src/sim/main.js` | `no rule holds a bare time literal` goes red |
| `START` in capitals put back into a comment in `src/sim/beings.js` | `no file holds a closure task` goes red and names `beings` |

Both lints read the raw file text; neither strips comments. The rewritten comments say the same thing in
other words — `main.js` says "a step is `advance` of the next tick", `beings.js` says "at the start of
this tick" in lower case. Nothing was weakened to get green, and "the lint belongs to another task" is
here a correct reading and not an excuse.

**n4. No number moved.** `CLOCK.dark.slower` is 2 and `secs(2)` is 2; `f0700cf` had `dark: { slower: 2 }`.
`CLOCK.every.next` is 1 and `secs(1)` is 1. `node --test tests/clock.js` is 22 pass, 0 fail, 0 skipped,
and `every entry of the table is read by a rule` is one of the 22, so the new entry is not dead weight.
`CLOCK.every.next` is 1 and so is not on the beat grid, which is right — it is not a world period — and
`tests/beats.js` is unchanged and checks only a named pair, so nothing there was bent to admit it.

**n5. `runOn` now reaches past two of `step`'s guards.** `/Users/earchibald/Worktrees/hamlet-g4/tests/lib/run.js`
calls `api.advance(to)` where it used to call `api.step()`. `step` refuses while `pending` is set and
hands a gods-era world to `ageStep`; `advance` does neither. No test reaches that state today —
`runDays` starts in the days era and `loadSnapshot` clears `pending` — and `runTo` keeps the check. It is
a seam the harness opened and worth one line to whichever task next touches the door.

**n6. The 4,000 s estimate has no source, so the ceiling it set decides nothing.** The plan says only
"the bless estimate puts a 70-day seed at about 4,000 s" (line 576). That is 57 s a world day, which
matches nothing measured: task 1 claimed 15 s a day, or 1,050 s, and task 3 measured 18 s at day 50, or
1,260 s. The reported 1,320 s agrees with task 3. So the `LONG=1` ceiling was set to be "missed today by
about 2.2 times" on the strength of a number nobody took, and at 1,320 s against 1,800 s it now decides
nothing — the state the plan says a ceiling must not be in. The implementer says this plainly and is
right. It is the plan's fault, not the task's.

**n7. A lit hearth does not raise `fireCount`, so the feared permanent pin is genuinely absent.**
Measured: I laid a firepit struct by hand and lit it through `lightTile`. It answered "The fire pit is
lit.", `t.struct.lit` was true, `t.fire` was 0 and `fireCount` was 0. `fireCount` is raised only by
`ignite()` at `/Users/earchibald/Worktrees/hamlet-g4/src/sim/weather.js:2`, which sets `t.fire` from
`tileFuel(t)`, and `spreadFire` recounts tiles with `fire > 0`. So the fire pin is lightning and burning
woods and never a camp's hearth. Zero over three days on all six seeds, which my own runs confirm; the
1.5 percent over seventy days I did not re-measure.

**n8. The bucket order makes `acted` the residual, not `fire` and `hunter`.** The order in `nextEvent` is:
a burning tile, then the pass's pin, then `acted`, then the horizon proper. So `pins.fire` is an exact
count of ticks with a burning tile, `pins.hunter` is exact bar the fire ticks, and `pins.acted` is what is
left over. The brief had this the other way round. Measured: a being acted on 100.00 percent of the
86,400 ticks of seed r day 1, while the report's three-day table gives `acted` 90.6 percent; the 24,342
difference is exactly `hunter` 24,341 plus `being` 1. The table is a first-match partition and can be read
only as one. The report says so at lines 164 and 173 to 178, and its "the honest reading is that the
hunter and act buckets together are the whole of it" is the right reading.

**n9. No day count was lowered, and the season arithmetic holds.** I diffed every changed line of the six
files against `f0700cf`. The only numeric changes are: `progress: 9999` to `DONE(api)`, which is
`max(CLOCK.work) + 1 = 20,737` and so larger; the pitfall span from 20 to 30 world days, larger; the
sample grid 1,000 to 1,200 in `gnomes.js` (m5); and `api.tick = …` to `setClock(api, …)` with the same
argument. Every other change is a comment or a `{ skip: slow(n) }` whose `n` matches the run.
`SUSPENDED_FOR_G4` appears nowhere in `src/` or `tests/`, only in the plan and in two reports.

The season claim I checked myself rather than take. `SEASON_LENGTHS` is `[91,91,91,92]` of a 365-day year.
Day 91 is spring and day 92 is summer. `isWinter(d)` is false for every `d` from 1 to 70. Every day count
the six files use — 12, 18, 21, 22, 24, 25, 26, 30, 32, 33, 34, 36, 40, 45, 48, 50, 70 — returns spring.
So no single run in the six crosses a season turn, and the two `tests/wanderer.js` winter tests cross no
winter. The tenth commit is correct and its fix is comments plus one assertion message; the number 18
stands untouched.

**n10. The structural claim about `tests/snapshot.js` is right, and countable.** Precondition-failure
messages per file, by grep for the phrases those messages use:

| file | assert calls | messages that say the precondition was not met |
|---|---|---|
| `tests/snapshot.js` | 205 | 7 |
| `tests/names.js` | 319 | 2 |
| `tests/gnomes.js` | 55 | 0 |
| `tests/settle.js` | 101 | 0 |
| `tests/wanderer.js` | 91 | 0 |
| `tests/ui.js` | 636 | 0 |
| `tests/skip.js` (new) | 58 | 15 |

So `tests/snapshot.js` is the only one of the six that asserts what its span must produce, which is why
its conversion gave reds where the other five gave silent passes. The new `tests/skip.js` carries the
habit at a high density, which is the best thing in the diff.

**The five could carry it cheaply.** `tests/wanderer.js`'s two winter tests need one line each — an
assertion that some tick of the run is in winter — which costs nothing, would have gone red at the branch
point, and would have caught this. I did not write it.

**n11. Both "plants nothing else could see" reproduce exactly.**

| plant | `node --test tests/skip.js` | the one red | the six seeds |
|---|---|---|---|
| `mark(c.nextArrival, 'stored')` deleted | 19 tests, 17 pass, 1 fail, 1 skipped | `an arrival tick that falls inside a span is read on its own tick` | all six green |
| the lazy rouser list put back | 19, 17, 1, 1 | `a sleeper the pass wakes does not rouse its neighbour until the next tick` | all six green |

And in the lazy-list copy, `node tests/soak.js` is 73 tests, 65 pass, 0 fail, 8 skipped, with
`tests/soak-working.json` md5 `d57614812690b6a2fc1c384fd0d1c6d6`, identical to the worktree's. So the soak
and its record are blind to that change, exactly as the report says. Both claims hold, and they are the
strongest part of the task: two faults the six-seed gate cannot see, each with a test built for it by
hand.

**n12. The ten commit messages match their diffs.** I read each against its change. `fa23c3e`'s causal
claims — the gnome charged for the hours of a hand-shoved clock, `progress: 9999` short of
`CLOCK.work.hut`'s 20,736, the two lints that read comments — are each supported beside the change, and
the lints I confirmed by plant (n3). `eda2434`'s "the same 6,048,000 moves" agrees with the report's
seventy-day bucket sums. `56076d4`'s claims I verified in n9.

## On dev-coordinator's two questions

**Was it right not to apply the 300 s tie-break?** Yes. The five suites it concerns are not on this
branch, so the total cannot be measured, and the projection rests on 191 s taken at load 7.39. My own
figure at load 2.83 is 171 s, so the projection's base was 20 s high and the arithmetic becomes 171 + 92
= 263 s plus three unmeasured files. The projection is uncertain in both directions, and moving a suite
behind a flag on that basis is a move made on a claim. Re-measure quiet after the merge-back and use 171
s, not 191 s, as the base.

**The floors.** No floor was removed, no day count lowered, no assertion weakened, except as m5 records.
The floors question stands with the user on the numbers above, and the pinned share is now measured twice
by two people with three instruments.

## Gates, run by me, at `56076d4`

| gate | result | wall | load (1 min) |
|---|---|---|---|
| `node build.js`, then `git status --porcelain` | wrote 710,738 bytes; status empty | — | 2.50 |
| `npm run fast` | 698 tests, 644 pass, 0 fail, 54 skipped | 171.15 s | 2.83 to 5.88 |
| `node tests/soak.js` | 73 tests, 65 pass, 0 fail, 8 skipped | 104.59 s | 4.49 to 2.93 |
| `node --test tests/clock.js` | 22 tests, 22 pass, 0 fail, 0 skipped | — | 2.86 |
| `node --test tests/tasks.js` | 23, 23, 0, 0 | — | 2.86 |
| `node --test tests/setclock.js` | 3, 3, 0, 0 | — | 2.96 |
| `node --test tests/beings-lazy.js` | 18, 17, 0, 1 | — | 2.96 |
| `node --test tests/skip.js` | 19, 18, 0, 1 | — | 2.74 |
| `SLOW=1 node --test tests/snapshot.js` | 49, 47, **2 fail**, 0 skipped | 1,239.6 s | 2.49 to 3.20 |
| `npm run fast` at `f0700cf`, for comparison | 360, 353, 0, 7 | 147.46 s | 2.06 |

The 300 s and 180 s ceilings are met on a quiet machine, which is the condition the plan attaches to
them. `SLOW=1 node --test tests/snapshot.js` at 1,239.6 s is ten times the 120 s one-file ceiling; that is
what `LONG=1` is for and the plan allows it, but the number belongs on the record.

### The 54 skips in `npm run fast`, all of them

| group | count | why |
|---|---|---|
| `tests/snapshot.js` | 27 | behind `LONG=1`, spans of 11 to 40 world days, each skip naming its day count, its seconds and the flag |
| `tests/names.js` | 13 | 12 behind `LONG=1` at 12, 40 and 70 world days; 1 (`a 70-day run still ends with the baseline beings and items`) behind `SLOW=1` and pre-existing |
| `tests/ui.js` | 9 | behind `LONG=1`, 21 and 25 world days |
| `tests/settle.js` | 1 | behind `LONG=1`, 50 world days |
| `tests/gnomes.js` | 1 | behind `LONG=1`, 70 world days |
| `tests/wanderer.js` | 1 | the flag is on the file: 493 world days across fifteen runs |
| `tests/skip.js` | 1 | the seventy-day run, behind `LONG=1` |
| `tests/beings-lazy.js` | 1 | the load-average budget guard, pre-existing. See n2 |

The branch point had 7 skips: the six `SUSPENDED_FOR_G4` file guards and `tests/beings-lazy.js`'s budget.
So 47 skips are new, and every one of them is inside the six restored files or `tests/skip.js`. The count
reconciles exactly.

### The guards at their boundaries

The task's own new file carries one skip, on `seventy world days on seed r tell the same story stepped and
skipped`, guarded by `process.env.LONG`. Admitted on `LONG=1`; skipped without it, with a message that
states the day count and the flag. There is no smaller input that can satisfy a seventy-day claim, so the
boundary is the flag itself. The other eighteen tests in the file carry no skip, which is the right
choice: each asserts its own precondition and fails rather than shrugs. I read the skip messages rather
than the counts throughout, which is how n2 was found.

## What I did not do

- The seventy-day `LONG=1` soak, as instructed. Judged instead at n6 and m4.
- The seventy-day pin table. Judged for internal consistency only.
- The per-file 120 s timings. The report's were taken at load 13.50 and are upper bounds; my `npm run
  fast` total at load 2.83 bounds them all.
- Any fix. I changed no committed file.

`tests/soak-golden.json` md5 `1e1248d47dd2aabc9d430fd49275c665`, unchanged. `UPDATE_GOLDEN=1` was never
run. Every plant was made in a throwaway copy under
`/Users/earchibald/.claude/jobs/8b2c73e8/tmp/`, made with `git archive HEAD | tar -x`, and all of them are
deleted. `git status --porcelain` is empty.
