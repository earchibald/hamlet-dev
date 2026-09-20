# The suite never reaches winter

**No test on this branch simulates a single winter day.** The longest run anywhere is 70 days.
Winter begins on day 274. Fifteen rules across seven files are gated on `isWinter()`, and every one
of them is now unreachable by the whole suite, including the soak and its golden record.

The suite is green. This is the berry class exactly: the rule did not fail, it stopped happening.

## Answered, 2026-09-20: set the date

The user ruled on the open question below: "we can set the date directly if we need to." The year
stays 365 days and the seasons stay 91/91/91/92. A seasonal test jumps the clock instead of paying
274 days. Two things follow, and the plan now carries both as ruling 8:

1. A date-set test proves a rule runs at that date. It does not prove the date is reachable by play.
   So the suite keeps one run that arrives at a season by simulating, and sets the date in the rest.
2. The setter is a new writer of the clock. One named function, in `tests/lib/run.js`, not in
   `src/sim/`, and written into `CLAUDE.md` beside the rule it bends.

Task 10 does the work. The three red tests in `tests/wanderer.js` are fixed by giving them the
calendar they assert under, not by moving their day numbers.

## How it happened, and why nothing caught it

The change is intended and is written in the plan: a year is 365 days, seasons of 91/91/91/92 from
`SEASON_LENGTHS`. On `dev` a year was 32 days, four seasons of `SEASON_DAYS = 8`.

| | 70-day run | day 28 | day 70 |
|---|---|---|---|
| dev | **16 winter days** | winter | spring |
| G4 | **0 winter days** | spring | spring |

Nobody removed a test. Nobody shortened a run. The day counts are exactly as they were; the year
grew elevenfold underneath them, and every run that used to cross two winters now ends inside the
first spring. A test that asserts on winter behaviour cannot fail, because the condition it asserts
under never arrives.

## What is no longer exercised

Fifteen `isWinter()` call sites: `camps.js` (6), `species.js` (3), `world.js` (2), `beings.js`,
`fae.js`, `goals.js`, `weather.js`.

## The three red tests in `tests/wanderer.js`, and what they are not

Under `SLOW=1`: 15 pass, 3 fail. The same file on `dev` is 18 pass, 0 fail — run as a control, on
the clone, without a checkout.

| test | assertion |
|---|---|
| `winter blocks the wanderer until spring` (`:89`) | the wanderer came on day 28, inside the wait |
| `winter blocks the founder until spring` (`:247`) | the founder came on day 28, inside the wait |
| `a line begun out of the hills does not start another while it lives` (`:269`) | the test never killed the hermit after the new camp stood |

**The rule is not broken.** `afterTheLast` in `src/sim/camps.js:182` is byte-identical on the two
branches, `isWinter()` included, and it behaves correctly: it lets the wanderer come on day 28
because day 28 really is spring now. The test's own comment carries the old calendar — "Days 25 to
32 are winter" — which was true of a 32-day year and is not true of a 365-day one. The third
failure is the same cause one step removed: the arrivals that winter used to hold back now proceed,
so the sequence the test waits for happens earlier than its expected ordering.

These are tests encoding a calendar that no longer exists. `tests/wanderer.js` belongs to task 10.

## What this means for the population finding

It supplies a measured mechanism for something reported earlier without one. The camp arrival gate
at `src/sim/camps.js:336` carries `!isWinter()`. Over 70 days that gate is closed on 16 days on
`dev` and on none here. That is a real contributor to the difference reported earlier — dev 24
camp-days passing 63%, G4 48 camp-days passing 94% — and it is **not the whole of it**: food still
blocks 8 camp-days on `dev` and 2 here. A contributor, measured; not a complete explanation.

## What it means for the bless

The golden record cannot see a winter. Any winter rule may be changed, broken, or deleted by tasks 3
to 11 and the six-seed record will agree with itself afterwards. Task 11's bless is blind here, and
the blindness is new: it did not exist before task 1.

## What is owed, and by whom

- **Task 10** owns `tests/wanderer.js`. The three tests need the calendar they assert under, not a
  rewritten expectation. Do not "fix" them by moving the day numbers until the question below is
  answered, because the day numbers are not the fault.
- **The open question, which is a design question and not a task's to settle alone:** a run that
  reaches winter now costs 274 days where it used to cost 25. Either the suite gets one long run
  that crosses a winter and every other run stays short, or winter rules are tested by setting the
  day directly rather than by arriving there, or the seasons are not 91 days. The plan chose 365
  days deliberately and task 9 already promises a player reaches winter in under a minute over the
  skipping engine. The suite has no such promise and needs one.
- **Task 11** must not bless a record that has never seen a winter without saying so in the report.

## Standard of evidence

Verified: the seasons on both calendars, computed rather than read. The 70-day winter-day counts,
0 against 16. The control run on `dev`, 18/18 on the same file. `afterTheLast` identical across the
branches. The longest run in any test file, counted through the parameterised helpers. The fifteen
call sites, counted.

Not verified: that all fifteen call sites are behaviourally dead in the suite rather than merely
unreached on the seeds tested. The day arithmetic makes it certain for any run bounded by day 70,
and every run is.

## The same mechanism, caught honestly: `tests/snapshot.js`

Run under `SLOW=1` the same night: **38 pass, 11 fail.** Every one of the eleven fails at a
*precondition*, not at a round trip. The oracle's save points are bare step counts.

| save | dev | G4 |
|---|---|---|
| step 12400 | day 12.4 | 3.4 hours |
| step 20000 | day 20.0 | 5.6 hours |
| step 30300 | day 30.3 | 8.4 hours |

The row for seed `gamma` is commented "a grown valley: two camps, huts, and a spear". That save now
lands 8.4 hours into day one. So the tests say, correctly:

- `nobody was walking and nobody was at work at the save; pick another step` (four seeds)
- `this world was meant to have a pitfall`
- `no den was dug after the load, so startRegion and rimExits went untested`

This is the same fault as the winter one — a fixed number that meant one thing under the old clock
and means another now — and it is the case that went **right**. These tests assert their own
preconditions, so when the condition stopped arising they went red and named it. The winter rules
have no such guard, so they went quiet instead.

That contrast is the transferable lesson. A test that checks the world it was given before asserting
on it fails loudly when a unit change moves the world out from under it. A test that simply asserts
passes, or never runs the branch at all, and says nothing.

Task 4 already owes "convert the snapshot oracle's four bare spans". This is that item, with the
failures named and the arithmetic done.

## It is not only winter: a 70-day run never leaves spring

Winter is the case that is wholly unreachable. It is not the only branch that has stopped being
taken. There are 15 `seasonOf()` read sites on top of the 15 `isWinter()` ones, and over a 70-day
run the seasons now fall like this:

| | spring | summer | autumn | winter |
|---|---|---|---|---|
| dev | 22 | 16 | 16 | 16 |
| G4 | **70** | 0 | 0 | 0 |

So a spring-gated rule fires **3.2 times more often** than it did, and every summer, autumn and
winter branch in the engine is dead for the whole suite. Rules that require spring — the fawn spawn
(`species.js:220`), the den birth (`species.js:242`), the grove birth (`fae.js:117`) — are no longer
gated at all in any test. Rules that require spring *or* summer, or autumn *or* spring, are likewise
always true.

## This explains the population finding, and supersedes the reading given for it

The camp arrival gate is `src/sim/camps.js:338`, and it carries **two** season-dependent conditions:

```
if (pitLit() && stashFood() >= foodTarget() && campHumans().length < 4 + bedsFor() && !isWinter() && rng() < ...)
```

- `!isWinter()` is false on 16 days in 70 on `dev` and on no day here.
- `foodTarget()` at `camps.js:29` is `(autumn ? 12 : winter ? 10 : 6) + ...`. On `dev` it rises to 12
  in autumn and 10 in winter. Here it is **always 6**, the lowest it can be.

That is a direct, measured account of the arrival-gate difference reported earlier — `dev` 24
camp-days passing 63%, G4 48 camp-days passing 94% — including the part previously left unexplained:
food blocked 8 camp-days on `dev` and 2 here **because the food target on `dev` was up to twice as
high for 32 days in 70.**

The birth rule at `camps.js:317` compounds it: it requires spring or summer *and* `stashFood() >=
foodTarget()`, so both of its gates are now permanently at their most permissive.

**This supersedes the earlier reading.** The population difference was attributed to travel being
172.8x cheaper and the head re-deciding 86.4x more often. Those remain true and documented, and they
are no longer the leading account of the arrival difference. The calendar is, and unlike the travel
reading it is arithmetic rather than inference. The walk-speed sweep is still worth running, but it
now answers a different and smaller question than the one it was proposed for.

## `tests/names.js`: two more of the same class, and one that is not

Under `SLOW=1`: **72 pass, 3 fail.** `tests/names.js` is not in task 10's file list, so none of these
has an owner yet.

**1. A magic number that used to mean "more than enough".** `tests/names.js:927` throws
`TypeError: Cannot read properties of null (reading 'type')` — reading `.struct.type` of a tile with
no structure. The hut was not built. The test hands the task `progress: 9999`. `CLOCK.work.hut` is
`strides(120)`, which is 120 on `dev` and **20736** here. So 9999 went from 83 times more than enough
to less than half of enough, and the failure surfaces as a `TypeError` at the line after the one
that mattered. There are five `progress: 9999` sites in the file; `leanTo` (110) and `storehouse`
(140) are over the same line.

**2. A frozen record that predates the retune.** `a 70-day run still ends with the baseline beings
and items` fails with `seed r: beings moved by day 70`. That message names the rule in CLAUDE.md —
naming moves no being and no item — and it is **not** what happened. The guard compares a live run
against `tests/names-layout.json`, a record committed on `dev` at `aa3a426` before this branch
existed. G4 changes the world legitimately, so the day-70 fingerprints differ for the retune's
reasons. Same shape as the stale `tests/soak-working.json`. The guard is dead until the record is
re-taken, and re-taking it is a bless-class act, not a task's to do quietly.

**3. Unexplained, and left that way.** `by day 40 every person with ten days in a camp has an
epithet` fails with `Esk has no epithet`. Checked and ruled out: `CLOCK.names.epithetAfter` is
exactly 10 days on both branches (864000 here, 10000 on `dev`); `nameTick`'s gate
`tick % DAY !== CLOCK.names.nameHour` is identical on both; `CLOCK.names.nameHour` resolves to 20:00
on both. So the pass runs, daily, at the same world hour, with the same threshold, and Esk still has
no epithet. `epithetPass` skips anyone for whom `epithetCandidates` returns nothing.

The tempting explanation is the population: three times the people, each with fewer standout deeds.
That is a guess. It has not been measured and is not claimed here.

## `progress: 9999` as a finding in its own right

The hut failure is one symptom. The pattern deserves naming, because the other four sites are
passing today and are passing by luck rather than by design.

`tests/names.js` hands a task `progress: 9999` five times, meaning "already finished". It is the
only magic progress number in the whole suite — a search across every file in `tests/` finds these
five and nothing else. Against the real costs on this branch:

| line | task | needs | 9999 |
|---|---|---|---|
| 888 | `checkSnare` | 691 | 14x enough |
| 925 | `feedFire` | 1037 | 9.6x enough |
| 873, 912 | `setSnare` | 5184 | **1.9x enough** |
| 933 | `buildHut` | 20736 | **short by 10737** |

On `dev` all four cost 4 to 120, so 9999 was between 83 and 2400 times enough and the number read as
"a big number, obviously finished". One unit change moved one of them past it. `setSnare` now has
less than a factor of two in hand: any further growth of that duration, in task 5 or task 7, breaks
two more sites, and the breakage will again present as a `TypeError` one line past the cause.

The fix is not a bigger number. It is to ask the engine: set progress from the task's own cost in
`CLOCK.work`, so the test says "finished" rather than guessing a number that means finished.

`leanTo` (110) and `storehouse` (140) were named elsewhere as also being over the line. They are
over the line as durations, but neither appears in `tests/names.js` and neither is driven by a
`progress: 9999`. They are not at risk from this.
