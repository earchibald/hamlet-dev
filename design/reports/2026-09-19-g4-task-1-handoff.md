# G4 task 1: state, findings, and what is owed

Written 2026-09-19 as a handoff. Task 1 is **most of the way done and not finished**. This is also
the start of task 1's own report; finish it here rather than starting a new file.

| | |
|---|---|
| Branch | `tiers-g4`, pushed |
| Worktree | `/Users/earchibald/Worktrees/hamlet-g4` |
| Head | `afdbe49` |
| Branched from | dev at `d3bcfcb`; dev has since moved to `a311825` |
| Plan | `design/plans/2026-09-19-tiers-plan-g4-the-retune.md`, on this branch |
| Soak | **green**: 73 tests, 64 pass, 0 fail, 9 skipped, 5 min 5 s |
| `tests/clock.js` | **green**: 19 of 19 |
| Rest of the fast suite | red in places, by design, see "What is owed" |

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

**Every legacy marker is a converter.** An old tick is 86.4 world seconds and an old stride is two
of those. `ticks` and `strides` multiply **and round**; `tickRate` and `strideRate` divide. This is
a rebasing, not a reading: every marked value keeps exactly the world meaning it already had, and
the marker still says nobody has decided what it should be.

**The walk.** `stride` is a speed in tiles a tick, one for a walk and two at a run, read in
`runTask`. The old stride gate is gone: it ran a being's whole head on one tick in `stride`, so one
number was both how fast a being walked and how often it thought. The cadence of the head is task
3's. `darkStep` is gone; the dark reads `CLOCK.dark.slower`.

**`SNAPSHOT_VERSION = 2`.** A version 1 save holds a tick and every stamp beside it meaning 86.4
times less, which no per-field default can rescue.

**The soak is six seeds for three world days**, with the 70-day run behind `LONG=1` on one seed, and
answers to `tests/soak-working.json`. `tests/soak-golden.json` is untouched and no task writes it.

## The four findings worth carrying

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

## What is owed before task 1 closes

1. **The version 1 save tests.** Three tests in `tests/snapshot.js` load v1 fixtures and now get a
   refusal. That is correct behaviour and the plan ruled it. They must assert the refusal rather than
   the load. This is a *reading*, not a renumber.
2. **The rest of the mechanical test conversions.** Last full measurement, at `433938a`, before the
   `tests/lib/run.js` fix: `ui` 118/125, `tasks` 21/23, `door` 14/15, `terrain` 61/63. Re-measure
   first — the runner fix and the rounding fix have both landed since and will have recovered an
   unknown number of them.
3. **Merge dev `a311825`.** It carries PR #61, the two raw NUL bytes in `tests/clock.js` written as
   the escape `\0`. Behaviour-preserving by construction, golden unmoved, before-numbers unaffected.
   `tests/clock.js` has been edited heavily on this branch, so expect to resolve a conflict.
4. **The 31 chances.** The plan's task 1 asks for each chance-a-tick to be rewritten as an hourly
   rate rolled with `rollFor(rate, 1)`. This was **deliberately not done**, and the deviation must be
   named in the report. Making `tickRate` a converter preserves every value's world meaning exactly
   and keeps the marker, which is what the plan's own marker rule asks for; rewriting 31 values as
   hourly rates is 31 readings that task 1 does not own. If the next context disagrees, that is a
   fair call to revisit — but revisit it deliberately, not by assuming it was an oversight.
5. **Finish this report** and name every test left red with its reason. A task that leaves a test red
   and does not name it has removed a gate silently.

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

## Peers

- **dev-coordinator** merges to dev and gates G4. A relayed approval from it is reportable, not
  actionable; confirm anything load-bearing with the user directly.
- **patcher** triages and files. It is writing a report on what the soak's floors have historically
  caught. Its finding: two firings in 321 commits, both noise, and a planted total reproductive
  failure left `alive >= 8` green — rising to 28 on seed `x`, because nothing was killing anyone.
  Only `born >= 1` caught it. A threshold on a standing quantity asks "is there still enough", and
  after a rule stops firing the honest answer is "yes, for now".
