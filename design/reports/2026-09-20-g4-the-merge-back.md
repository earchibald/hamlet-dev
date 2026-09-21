# G4: the merge back

**Branch** `tiers-g4`, worktree `/Users/earchibald/Worktrees/hamlet-g4`. Date 2026-09-20.
Merged `dev` at `72c1b96` into `tiers-g4` at `7228c8a`. Merge base `811ab06`.

## Summary

| What | Result |
|---|---|
| The merge | Five conflicts, all resolved by hand. No file took a side wholesale. |
| `tests/snapshot.js` | dev's **measured** save points on this branch's **per-test gating**. This branch's two reds were pointing at its own arithmetic, and dev had already measured the answer. |
| `package.json`'s `fast` line | Hand-built union, **30 files**, counted by script against **36** `.js` files under `tests/`. The other six are two libraries, two perf tools, the soak and the trace tool. No suite lost. |
| `npm run fast` | **434.49 s at load 3.30** against a **300 s** ceiling. **MISSED by 134 s.** 749 tests, 689 pass, 0 fail, 60 skipped. |
| The cause of the miss | Not the sum of many files. `node --test` runs the files in parallel, so the wall time is the **slowest single file**. See "The ceiling is a maximum, not a sum". |
| The tie-break | Applied by the plan's sixth rule, in descending order of measured seconds. See "The tie-break". |
| The golden | `tests/soak-golden.json` md5 **`142f6c9a78d07e74d945648ccce70e6c`**, arrived by merge from `72c1b96`, byte-identical to dev's. `UPDATE_GOLDEN=1` was never run and the file was never hand-edited. |
| The working record | `tests/soak-working.json` md5 **`c71523b7838226c3b1618ab295dfdcfb`**, also dev's, also by merge. |

## What each conflicted file got, and why

| File | Resolution |
|---|---|
| `src/sim/index.js` | Union of the two export lines. This branch's `advance`, `nextEvent`, `runTo`, `resetPins`, `pins`, `moves`; dev's `SEASONS`. The untouched lines had already merged and carry dev's `rebuildItemGrid`, `gardenLives` and `DIRS`. |
| `package.json` | Hand-built union of the `fast` line, plus dev's `types` script and `devDependencies`. Neither side was taken. |
| `tests/snapshot.js` | dev's measured save points and its four `want` hooks, on this branch's per-test `LONG=1` gating. Details below. |
| `tests/soak.js` | Union. dev's `seasonsSeen` set, this branch's 1200-tick stranded sampler. dev's sampler was broken; see below. |
| `CLAUDE.md` | Union of the two file lists, with one rewritten `tests/snapshot.js` line describing the merged shape. |

## `tests/snapshot.js`: a green tally and a crossing are different claims

Both sides converted the file's old 1,000-tick spans, and they converted them **differently**.

- dev **measured** every save point. It ran each seed with the oracle's own script god, sampled the
  world, and wrote down the tick at which the case's own sentence is true.
- This branch **multiplied**: an old count of N ticks became N/1000 world days.

The arithmetic is not wrong about world time, and it is wrong about the world. Two save points landed
where the case's sentence is false. Those are this branch's two red tests, and they were reporting a
real thing about their own spans.

The resolution keeps dev's measured tick at every save point, and dev's `want` hooks with it, because
a sentence in a comment cannot fail and a `want` can. It keeps this branch's gating, because dev
skipped the whole file without `SLOW=1`, so dev's cheap tests never ran in the fast suite at all.

## The stranded sampler dev would have lost

dev's soak sampled the stranded-being check on `api.tick % api.DAY === 0`. `DAY` is 86,400 and a
70-day run ends near tick 70,292. So that test is true at tick 0 and at **no later tick in the run**:
the check ran once. This branch's `% 1200` keeps it at 58 samples in the same run. The merged file
keeps 1200 and keeps dev's season watcher, and the comment says why.

This is the same shape of fault as the spans above. A unit change moved a test out of its own range,
the suite stayed green, and nothing said so.

## `tests/lib/claims.js`

The file arrived from dev already tuned to the 365-day year: `SEASON_CLAIM_DAYS` is 365 and
`OLD_AGE_CLAIM_DAYS` is 70, with its comment refusing the arithmetic 24 on the ground that an
intermittent soak failure reads as a fault in the sim. Nothing was retuned.

One line was corrected. The file said G4 task 4 owed the old-age measurement. Task 4 has landed, and
it measured seconds a world day and not old-age deaths, so the debt moved rather than being paid. The
comment now names task 6, "Lives, ages, births, and plants", which is the task that rules on `LIFE`.

## The merged `fast` line, counted

The union names **30** files. A script walked `tests/` recursively and found **36** `.js` files. The
six the line does not name, and why each is right to leave out:

| File | Why it is not a suite |
|---|---|
| `tests/lib/run.js` | The shared runner. A library. |
| `tests/lib/claims.js` | The two day-count guards. A library. |
| `tests/perf/measure.js` | The profile tool, run by `npm run perf`. |
| `tests/perf/draw-harness.js` | The draw harness the profile tool loads. |
| `tests/soak.js` | The soak, run by `npm run soak`, with its own ceiling. |
| `tests/trace-deaths.js` | The death tracer, run by hand on a seed. |

Counted by script, not by eye. This branch's side named 23 and dev's named 29, with `tests/skip.js`
only on this side and seven files only on dev's. A union of the two is 30, so nothing was lost either
way. The `types` script and the `typescript` devDependency came from dev with it.

`node_modules/.bin/tsc` was **absent** when the merge landed, because `package-lock.json` and the
devDependency arrive from dev and nothing had installed them. `tests/types.js` skips when tsc is
missing, and a skip reads as a pass. `npm install` fixed it: tsc 7.0.2, and `tests/types.js` then
reported **2 pass, 0 skipped**. The second of those two is the probe, which fails unless tsc catches a
misspelt field, so it is a positive gate and not a silent one.

## The ceiling is a maximum, not a sum

The tie-break was projected as arithmetic: 191 s here, plus 92 s for `tests/stalk.js`, plus three
unmeasured files, giving 283 s and a warning that 300 s was "close and probably short". The model was
wrong, and so were the numbers.

`node --test` runs the named files **in parallel**, eighteen at a time on this machine. The first
merged run took **434.49 s** of wall time while spending **1,465 s** of user time, a parallelism of
3.4. So the gate's wall time is not the sum of its files. It is the **slowest single file**, plus
whatever the rest queue behind it.

That changes what the sixth rule's descending order means. Moving the second-largest file off the list
buys nothing at all while the largest is still there.

## Every file's own seconds, measured

Each file run alone, sequentially, one after another. The load average is the one-minute figure at that
file's start. Total 1,082 s sequential against 434 s in parallel.

| File | Seconds | Load |
|---|---|---|
| `tests/names.js` | **411.6** | 2.26 |
| `tests/door.js` | **142.1** | 3.96 |
| `tests/skip.js` | 104.4 | 4.34 |
| `tests/stalk.js` | 76.5 | 2.65 |
| `tests/snapshot.js` | 73.3 | 3.81 |
| `tests/ages.js` | 44.1 | 6.23 |
| `tests/tasks.js` | 40.2 | 3.02 |
| `tests/ui.js` | 37.4 | 2.93 |
| `tests/terrain.js` | 28.8 | 2.96 |
| `tests/beats.js` | 22.1 | 3.86 |
| `tests/chronicle.js` | 20.1 | 2.74 |
| `tests/settle.js` | 18.9 | 5.16 |
| `tests/beings-lazy.js` | 10.9 | 4.49 |
| `tests/become.js` | 10.0 | 5.72 |
| `tests/gnomes.js` | 8.3 | 3.84 |
| `tests/dwellers.js` | 7.3 | 3.62 |
| `tests/crafts.js` | 4.8 | 3.66 |
| `tests/closing.js` | 4.7 | 3.45 |
| `tests/gods.js` | 4.2 | 5.87 |
| `tests/field.js` | 3.2 | 6.04 |
| `tests/reachable.js` | 2.5 | 4.02 |
| `tests/options.js` | 2.3 | 4.21 |
| `tests/clock.js` | 1.9 | 3.02 |
| `tests/garden.js` | 1.6 | 2.80 |
| `tests/itemgrid.js` | 0.4 | 2.80 |
| `tests/types.js` | 0.2 | 4.02 |
| `tests/setclock.js` | 0.2 | 4.34 |
| `tests/wanderer.js` | 0.1 | 3.81 |
| `tests/soak-guards.js` | 0.1 | 3.02 |
| `tests/build.js` | 0.1 | 3.02 |

Against the projection: `tests/stalk.js` is **76.5 s, not 92**; `tests/snapshot.js` **73.3 s, not 106**;
`tests/ui.js` **37.4 s, not 63**. All three were overestimates. And the two largest files in the suite,
`tests/names.js` and `tests/door.js`, were **not on the projected list at all**. A move made on that
list would have flagged three cheap files and left the expensive one running.

## The tie-break, applied

One move. The rule orders by seconds, and the largest number by a factor of three is `tests/names.js`.

Inside it, the cost is not spread. **One test is 371.8 s of the file's 411.6 s**, and the next slowest
test in the file is 4.1 s. It is `a source word that would have won bare wins in its distinct form,
measured on seed r`, an ungated `runDays('r', 45)` at `tests/names.js:935`. It was written on the
naming branch when a world day cost 0.31 s, where 45 days was fourteen seconds.

So the move is that one test, behind `LONG=1`, by rule 2's instrument: a public skip that states its
day count, its measured seconds and the flag. Every other test in `tests/names.js` still runs in the
fast suite. That is the same treatment dev gave `tests/garden.js` and `tests/itemgrid.js`, and it keeps
the naming gate in the suite instead of exiling it.

**The day count is untouched.** Day 45 is the day on which the sky's word beats the people's word on
seed r, which is the tie-break the test exists to hold. The skip carries the measured 372 s and 8.3 s a
world day rather than `slow(45)`'s generic figure, which would have said 131 s and understated it by
2.8 times.

| Move | File and test | Measured seconds |
|---|---|---|
| 1 | `tests/names.js:935`, `a source word that would have won bare wins in its distinct form` | **371.8 s** of that file's 411.6 s |

**Result: `npm run fast` is 174.81 s at load 2.35, against a 300 s ceiling. Met.** One move was enough,
and the rule says to stop when it fits. For comparison the same gate was 171.15 s on this branch before
the merge, measured quiet, so once that one test is flagged the whole merge costs the gate about four
seconds.

`tests/door.js` at **142.1 s** is over the plan's 120 s per-file ceiling and is **not** moved, because
the suite fits without moving it. Its cost is spread, not concentrated: its slowest test is 94.1 s, then
18.4, 12.9 and 12.5. That is a finding for a later task, with a number behind it.

## `tests/snapshot.js` reaches 49 pass, 0 fail — and here are the two spans

`SLOW=1 node --test tests/snapshot.js`: **49 tests, 49 pass, 0 fail, 0 skipped, 977.29 s**, load 4.30
at the start and 2.53 at the end. dev reported 49 and 0 at 1,120 s. The merged file is 143 s faster,
because its wait loops step on the world's beat rather than a tick at a time.

The tally is not the finding. This branch's two reds were crossing-failures, and dev's measured spans
reach what this branch's arithmetic did not. **Which spans:**

**The den dig.** `a world that digs a wolf den after the load runs on as the straight run does`.
This branch ran `oracle('r', d(6), d(2.5), SMALL)` — a save on world day 6. dev measured the valley:
it digs exactly one new den in thirty days, at **tick 1,315,375, day 15.2**, and three wolves are
den-less **from day 12 on**. So a save on day 6 is two full days before the first wolf is even
den-less, and nine days before the dig. The span that reaches it is **save at tick 1,255,000, day
14.5, and 70,000 ticks of run-on**. The diagnostic went from "0 wolves were den-less at the save" to
`3 wolves were den-less at the save; after the load: The wolves have dug a new den under another hill.`

**The burrow holding.** `a grown valley of the default size, saved late, runs on as the straight run
does`. This branch ran `oracle('beta', d(13.779), d(2.5), {})` — a save on day 13.78. dev measured
that seed beta has a second camp from **tick 760,000, day 8.8**, and a burrow holding something from
**tick 1,005,000, day 11.6**. The span that reaches it is **save at tick 1,010,000, day 11.7**, the
first sample past both. The diagnostic went from "7 caves, 0 of them holding something" to
`beta at the save: 2 camps, 7 caves, 1 of them holding something, 60 beings`.

Note what that second one shows. dev's save is **earlier** than this branch's, not later. A burrow
gives up what it holds, so "a burrow holding something" is a **transient** state and not a monotonic
one. Running the world longer does not make the condition more likely; it can walk straight past it.
That is exactly why a save point has to be measured and cannot be multiplied, and it is why the row
now asserts its own sentence instead of stating it in a comment.

## Gates, on the merged tree

Every count is pass/fail/skip as the runner printed it. The load average is the one-minute figure.

| Gate | Result | Wall | Load |
|---|---|---|---|
| `node build.js` | `built dist/hearth-sim.html 728495 bytes` (the figure build.js prints; `ls -l` agrees) | — | — |
| `git status --porcelain` | empty | — | — |
| `npm run fast` **before** the tie-break | 749 tests, **689 pass, 0 fail, 60 skipped** | 434.49 s | 3.30 start, 2.89 end |
| `npm run fast` **after** the tie-break | 749 tests, **688 pass, 0 fail, 61 skipped** | **174.81 s** | 2.35 start, 4.43 end |
| `node tests/soak.js` | 86 tests, **65 pass, 0 fail, 21 skipped** | 112.09 s | 3.92 start, 2.31 end |
| `SLOW=1 node --test tests/snapshot.js` | 49 tests, **49 pass, 0 fail, 0 skipped** | 977.29 s | 4.30 start, 2.53 end |
| `node --test tests/clock.js` | 22 tests, **22 pass, 0 fail, 0 skipped** | 1.9 s | 3.02 |
| `node --test tests/tasks.js` | 23 tests, **23 pass, 0 fail, 0 skipped** | 40.2 s | 3.02 |
| `node --test tests/setclock.js` | 3 tests, **3 pass, 0 fail, 0 skipped** | 0.2 s | 4.34 |
| `node --test tests/beings-lazy.js` | 18 tests, **17 pass, 0 fail, 1 skipped** | 10.9 s | 4.49 |
| `node --test tests/skip.js` | 19 tests, **18 pass, 0 fail, 1 skipped** | 104.4 s | 4.34 |
| `node --test tests/types.js` | 2 tests, **2 pass, 0 fail, 0 skipped** | 0.2 s | 4.02 |

The soak's working record did not move: `git status --porcelain` on `tests/soak-working.json` is empty
after the run, so the merged tree reproduces dev's record exactly.

### Every skip accounted for

`npm run fast`, **61 skips**:

| Group | Count |
|---|---|
| `LONG=1` day-count skips from `slow(days)` | 52 |
| `tests/wanderer.js`, fifteen runs, 493 world days | 1 |
| `tests/names.js:935`, the test this report moved | 1 |
| `tests/garden.js`, two real runs, 133 s together | 2 |
| `tests/itemgrid.js`, two real runs, 347 s together | 2 |
| `tests/skip.js`, seventy world days run twice | 1 |
| `tests/soak-guards.js`, the six 70-day runs behind `SLOW=1` | 1 |
| `tests/beings-lazy.js`, its own load guard | 1 |
| **Total** | **61** |

`node tests/soak.js`, **21 skips**, all six seeds over three groups plus three whole-suite ones:

| Group | Count |
|---|---|
| "three world days is too short", per seed | 6 |
| the season claim needs 365 days, per seed | 6 |
| the old-age claim needs 70 days, per seed | 6 |
| "measured over 70 days on six seeds" | 3 |
| **Total** | **21** |

`tests/beings-lazy.js`'s one skip is its own load guard: the machine was at 4.49 and the guard wants
under 2. It reports the day it measured anyway (2.99 s, then 4.86 s on a busier run). That guard is
computed from the machine and not from the table it measures, so it does not disarm on the change it
would report — but it does mean the budget went unchecked on this run. Another session was running the
same merge in `/Users/earchibald/Worktrees/hamlet-g4-merge` throughout, so no measurement here met a
truly idle machine, and every load average above says so.

## Two things left for somebody else

- **`tests/door.js` costs 142.1 s**, over the plan's 120 s per-file ceiling. Not moved, because the
  suite fits without it. Its cost is spread across four tests: 94.1, 18.4, 12.9 and 12.5 s.
- **Every finding of the task 4 review is left unfixed**, as instructed. `pins` and `pinMask` in
  `src/sim/beings.js` and `src/sim/main.js` are untouched, and `runTo` is still unwired.
