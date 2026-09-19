# The Retune Implementation Plan (G4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: a draft that waits for the user.** Section "Rulings the user must make" lists seven decisions. No task starts before the user has ruled on them. Every ruling has a default, and the tasks below are written for the defaults.

**Goal:** Move the engine to real units. A tick is one world second, a day is 86,400 ticks, a year is 365 days, a person lives about 70 years, and a walking person moves one tile a tick. The golden is blessed once, at the end, by the user.

**Architecture:** The four legacy markers of plan G1 (`ticks`, `strides`, `tickRate`, `strideRate`) first become converters, so the whole table keeps today's world-time meaning at the new tick. The engine's beats then move off the tick: cellular systems run once a world minute, camp rules roll at hourly rates, and a being's state is computed from elapsed time. Each group of the table is then rewritten in real units and its marker removed. The plan is done when no marker is left.

**Tech stack:** Plain JS scripts in one shared scope, `node --test`, no dependencies.

| Task | Delivers | Gate |
|---|---|---|
| 1 | The calendar at real units, the markers as converters, walking at a tile a tick, the soak reshaped | determinism, invariants, the oracle |
| 2 | The beats: cellular systems once a world minute, camp rules at hourly rates, periods in world time | the same, and plant and fire counts a world day within a table of tolerances |
| 3 | A being's head off the tick: state from elapsed time, a cheap proximity pass each tick | the same, and a world day in under 5 s |
| 4 | Work, sleep, and needs in world time | the same, and the crafts tests in world units |
| 5 | Lives, ages, births, and plants | the same |
| 6 | Chases, embers, brands, and the hazards | the same, and no odd death in the long run |
| 7 | The interface: the speed ladder, the Hour button, the calendar display, the autosave's beat | `tests/ui.js` |
| 8 | The rest of the test suite in world units | `npm run fast` |
| 9 | The tuning pass, the markers gone, the record, and the before and after report for the user | the long run's report; the user blesses |

The spec is `design/specs/2026-09-18-time-and-tiers-design.md`, sections 0, 1, 10, and the G4 row of section 12. The survey is `design/reports/2026-09-19-g4-survey.md`. It holds the measurements this plan rests on, with file and line. Every task reads it.

## What the survey found

| Fact | Number | What it forces |
|---|---|---|
| A world day today | 0.12 to 0.6 s for 1,000 ticks | |
| The same day with only the constants changed | 26 to 52 s | The beats must change, not only the numbers. |
| `updateBeing`'s head, left on the tick | 3.6 to 5.9 s a world day, alone over the 5 s budget | Task 3. |
| Everything else (choices, searches, camp rules, cellular systems) | already priced per world day; unchanged | |
| `growPlants` | 92 percent of the random stream | No middle commit can hold the golden. Bless once, at the end. |
| `CLOCK` | 284 entries: 136 plain durations, 53 stride counts or distances, 31 chances a tick, 17 periods, 12 ages, 6 amounts a stride, 1 calendar length, 11 flagged as unclear | Each category converts by its own rule. |
| Six seeds for three world days today | 9 people, 0 births, 0 huts, 0 far-country events | A three-day soak cannot hold today's floors. |
| At the top speed of the new ladder | a season takes about 4 wall hours, a year about 15 | Before plan G5, the tick tier shows a camp's first days and no more. |

## Rulings the user must make

| # | Question | Default in this plan | Why it is the user's |
|---|---|---|---|
| 1 | **When does G4 reach dev?** At real units and before the day tier (G5), a player cannot reach summer, winter, a grown child, or a death of old age. 24 rules read `isWinter()`. The spec says every plan leaves dev playable. | Build G4 on branch `tiers-g4` and hold it out of dev until G5 is ready. Merge the two one after the other. dev keeps today's clock until then. | It changes what the released game is for some weeks, or it delays every merge of G. |
| 2 | **The floors.** Today's floors (people, births, the goal ladder, the far countries) need about 70 of today's days, which is more than two of today's years. At real units that span is about 800 world days a seed. The spec moves these floors to G5's day soak. | The tick soak keeps only what three days can show: a site, a pit, a lit hearth, someone alive, nobody cut off, no odd death, determinism, and the snapshot oracle. A long run (`LONG=1`, one seed, 70 world days, about 21 to 42 s) reports counts but asserts no floor. The old floors return in G5 in the day soak. | The spec says a floor is not lowered without the user's word. This removes floors for the length of one plan. |
| 3 | **The chases.** A chase is a count of strides today. Kept as a count, a wolf chase becomes a sprint of 2.3 world minutes. Kept as world time, it becomes a pursuit of 6.7 hours over a map a person crosses in 5 minutes. | A chase is a distance. Write each as tiles run: the hunter gives up after it has run `CLOCK.chase.*` tiles. The numbers start at today's stride counts, which are today's tiles. | It decides how dangerous a wolf is and how a hunt feels. |
| 4 | **Plant lives.** The spec scales animal lives to real years and says nothing of plants. A bush dies at 60 of today's days, which is about two of today's years. | Plants scale as animals do: by the year. A bush lives about 2 years, a pine about 100 years, and `grove.oldPine` is 40 years. Berry growth stays seasonal. | It sets how a valley changes over a lifetime, and the sprites' births hang on old pines. |
| 5 | **Birth intervals.** `birth.gap` is 16 of today's days. Scaled by the life it would be 13 years. | Real intervals: 2 years between a mother's children, a den's litter once a year in spring, a grove's sprite once in 5 years. | It sets how fast a camp grows, which H builds on. |
| 6 | **The proximity beat.** Fire on a tile, a wolf within 5 tiles, and a den's bite cannot be computed from elapsed time. A check once a world minute can miss a wolf that walks 60 tiles in that minute. | A cheap pass every tick checks only proximity and fire, for beings that are awake or on a burning tile's level. Everything else about a being is computed when it next acts. | It trades cost against the chance that a threat goes unseen. The default keeps today's rule exactly. |
| 7 | **The values themselves.** The spec gives a few: an axe 1 hour, a lean-to 4 hours, sleep 8 hours, adult at 16, old at 55. The other 250 are guesses until tuned. | Task 9 tunes against the long run and a calibration table, and the pull request shows every value that moved by more than a factor of two from its world-time meaning today. | The user may want to read that table before the bless. |

## Global Constraints

- Work in `/Users/earchibald/Worktrees/hamlet-tiers` on branch `tiers-g4`, cut from dev after `naming` has landed. Never check out, stash, or commit in `~/Code/hamlet`.
- G4 moves the golden once. No task runs `UPDATE_GOLDEN=1`. Task 9 prepares the report; the user blesses. Until then `tests/soak.js` compares against a working record, `tests/soak-working.json`, which each task may rewrite and must say so in its report with the reason.
- Between the first task and the bless, three gates stand in for the golden: a seed run twice gives the same fingerprint; the snapshot oracle (`tests/snapshot.js`) holds; and no death in the soak or the long run has a cause other than old age.
- A duration or a rate goes in `CLOCK`, or in a `SPECIES`, `LIFE`, or `RECIPES` row, in the unit helpers. `tests/clock.js` fails on a bare one. A legacy marker may only be removed, never added.
- A new top-level `let` or `var` in `src/sim/` goes in `SAVED_STATE` or `NOT_SAVED`. A field that points at a record goes in `REFS`. A field added to a saved record is read as optional with a default, and `SNAPSHOT_VERSION` stays 1, unless the meaning of a saved field changes. The meaning of `tick` changes in this plan, so **the version rises to 2 in task 1**, and a version 1 save is refused with its sentence.
- The naming plan lands before G4 and blesses the chronicle fields of the golden. Merge dev before G4's first task, so that G4's diff shows only G4's moves. `tests/names.js` holds a layout record, `tests/names-layout.json` (the tick-0 layout, and the day-70 `beings` and `items` under `SLOW=1`). G4 moves those on purpose. Task 9 measures the layout file again with `UPDATE_LAYOUT=1` in the same commit as the bless, and says so. Read the comment at the top of `tests/names.js` first. Naming adds a third random stream, `nrng`; `catchUp` and every new beat must draw from `rng` only.
- The names landed in dev at 68b7061 and blessed `chronicle` and `chronicleLines`. Take G4's before fingerprints from the dev commit this plan branches off, not from a remembered number. Nothing since 68b7061 has moved the golden, and dev is at 4bb1b36, but issue 25 lands before task 1 starts. The survey counted chronicle lines before the names, so its line counts are low by 49 to 99 a seed. `CLOCK.names` holds `nameHour`, `eventMemory`, and `epithetAfter`; task 5 rules on them with the ages. The naming pass runs at hour 20 each night, and `log` takes a tag that rules read. A person's `deeds` counts acts by tag; plan G6 reads it before it designs the annals.
- `updateWorld()`'s order of calls does not change. A system that moves to a slower beat keeps its place in the list and returns at once off its beat.
- The engine step stays pure. Every outside act enters by `inject()`.
- Files in `src/sim/` and `src/ui/` are plain scripts in one scope. No `import`, no `export`. Do not change the body of `load()` in `src/sim/index.js`. If a security hook blocks a legitimate edit, stop and report it.
- Run `node build.js` after every change to `src/` and commit the built page.
- Game text is plain English, one idea per sentence. Documents follow the house style: one idea per sentence, 25 words at most, active voice, one word for one meaning, paragraphs of six sentences or fewer, a summary table at the top.
- The budgets: a tick-tier world day in under 5 s in Node on seed `r` at day 3 and at day 50 of the long run; `npm run fast` in about its present time; the soak in about two minutes.
- Commit messages are a plain sentence. End each with:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn`

## The design every task follows

### The markers become converters

Today a tick is 86.4 world seconds. So in task 1 the markers change from identities to conversions, and the whole table keeps its world-time meaning at the new tick:

```js
const OLD_TICK = 86.4;                                   // world seconds in a tick before the retune
const ticks = n => secs(n * OLD_TICK);                   // a duration, kept in world time
const tickRate = p => p / OLD_TICK;                      // an amount a tick, kept per world second
const strides = n => n;                                  // a count of acts; each use is ruled on in its task
const strideRate = p => p;                               // an amount an act
```

A chance a tick does not convert by division. Each of the 31 becomes a rate for each world hour in the table, and the rule rolls it with `rollFor(rate, step)` at the beat the rule runs on. `tickRate` is for amounts only (fuel burnt, warmth gained, a need's decay). Task 1 lists the 31 and gives each its hourly rate: `1 - (1 - p) ** (3600 / OLD_TICK)`.

A period (`every`, with a phase `at`) is rewritten in world time by hand in task 2. The survey's part 3 lists the 17. A carried number would fire 86 times too often.

### The conversion rule for each category (survey, part 3)

| Category | Count | Rule |
|---|---|---|
| (a) a plain duration | 136 | `ticks(n)` holds it in world time at once. Its task rewrites it in `mins`, `hours`, or `days`, rounded to a value a person would say. |
| (b) a stride count or a distance | 53 | Work becomes world time (task 4). Walking distances become tiles (task 6). A chase follows ruling 3. |
| (c) a chance a tick | 31 | A rate for each world hour, rolled with `rollFor` at the rule's beat. |
| (d) an amount a stride | 6 | An amount for each world hour of the act. |
| (e) a period and its phase | 17 | World time, by hand (task 2). |
| (f) an age or a life stage | 12 | Years (task 5). Births follow ruling 5, plants ruling 4. |
| (g) the calendar | 1 | Task 1. |
| unclear | 11 | Each is named in its task with its ruling: `limit.ember` and `limit.guardEmber` with the chases; `limit.task` with work; `cooldown.stalked` is derived again from the healing rate; `limit.resourceCache` becomes 10 world minutes; `plant.samples` is fixed by the minute beat. |

### The calendar

`DAY = 86400`. `TPS` leaves the sim; the interface owns wall time. A year is 365 days. The seasons are spring 91, summer 91, autumn 91, winter 92, from one table `SEASON_LENGTHS`, and `seasonOf`, `isWinter`, `dayOfYear`, and `yearOf` read it. `SEASON_DAYS` goes. The survey's part 4 lists every read site. A world starts at 07:00 on day 1 of spring of year 1. The chronicle's `when` shows the year once a world has more than one.

### A being between acts

Today `updateBeing` runs its head on every being every tick. Under G4 a being holds `a.seen`, the tick its state was last brought up to date. `catchUp(a)` brings needs, warmth, hp, thoughts, age, and the status up to `tick` from `a.seen`, in stretches that break at dawn, at dusk, at a season's turn, at a change to the camp's pit, and at the moment a need reaches zero. It runs when the being next acts, when another rule reads the being's state, and once a world minute at the latest.

A thought holds `until`, a tick, and no longer counts down. A record that changes shape changes in the snapshot with it; `tests/snapshot.js` must stay green.

A being's next act has a known tick when it walks (every tick), works or sleeps (the tick its work or its rest ends, from the rate), or waits. The executor keeps that tick on the being and skips the being until then. The proximity pass of ruling 6 can wake it sooner.

### The soak

| Run | What | Asserts |
|---|---|---|
| `node tests/soak.js` | six seeds, three world days | a site, a pit, a lit hearth, someone alive, nobody cut off, no odd death, the same fingerprint twice, the working record (the golden after the bless), and the seventh test (save at day 1.5, load, run to day 3) |
| `LONG=1 node tests/soak.js` | seed `r`, 70 world days | no odd death; prints people, births, goals reached, far-country counts, and seconds a world day |

`scriptGod` lights a pit when the step count passes `c.coals`. `c.coals` is a tick, so the comparison holds at any scale; task 1 checks it.

---

### Task 1: The calendar, the markers, the walk, and the soak's new shape

**Files:** `src/sim/clock.js`, `src/sim/core.js`, `src/sim/beings.js` and `src/sim/tasks.js` (the stride gate and the walk), `src/sim/species.js` (the `stride` column becomes a speed in tiles a tick: 1 for a walk, 2 for a run), `src/sim/snapshot.js` (`SNAPSHOT_VERSION = 2`), `tests/clock.js`, `tests/soak.js`, `tests/lib/run.js`, `tests/soak-working.json` (new).

- [ ] Write the failing tests in `tests/clock.js`: `DAY` is 86400; `hours(1)` is 3600; `seasonOf` gives spring on day 1 and day 91, summer on day 92, winter on day 274 and day 365, spring again on day 366; `isNight` holds at 23:00 and not at 12:00; `ticks(1000)` is `days(1)`; every chance-a-tick entry of the survey's list is now an hourly rate below 1.
- [ ] Change the calendar and the markers as "The design" says. Replace each of the 31 chances with its hourly rate and roll it with `rollFor(rate, 1)` where the rule still runs each tick; task 2 moves the beat.
- [ ] Walking: a being on a path moves one tile a tick, two at a run (`fast`). The stride gate stays for acts that are not steps, reading the converted stride. Remove `darkStep`; a person in the dark walks at half speed by moving on even ticks only. Rewrite the two tests in `tests/terrain.js` that count steps.
- [ ] Reshape the soak as "The soak" says. Write `tests/soak-working.json` from the first green run and say so in the report.
- [ ] Gates: `node --test tests/clock.js tests/snapshot.js`, the soak, and a note of seconds a world day. This task is expected to be far over the 5 s budget. Report the number.
- [ ] Commit.

### Task 2: The beats

**Files:** `src/sim/main.js`, `src/sim/weather.js`, `src/sim/world.js` (`growPlants`, `rotCarcasses`), `src/sim/camps.js`, `src/sim/fae.js`, `src/sim/species.js`, `src/sim/clock.js`.

- [ ] Write a failing test: over one world day on seed `r`, `growPlants`, `spreadFire`, `updateWeather`, `strayLightning`, `rotCarcasses`, and `groveTick` each run 1,440 times, and the count of tiles `growPlants` looks at is within 2 percent of 60,000.
- [ ] Add `CLOCK.every.cellular = mins(1)`. Each cellular system returns at once off that beat. `plant.samples` becomes looks a run (about 42). Every chance inside those systems is rolled with `rollFor(rate, CLOCK.every.cellular)`.
- [ ] `updateCamps`: the pit burns by elapsed time; spoilage, births, arrivals, storms, and lightning roll hourly rates at their own beats. Rewrite the 17 periods of category (e) in world time, each with its phase. The survey's part 8, row 8, lists the 16 `tick % N` sites.
- [ ] Calibration test: one world day at this commit against one of today's days on the base commit, six seeds, from a saved table in `tests/calibrate-beats.json`: berries grown, bushes seeded, tiles burnt after one forced lightning strike, fuel burnt by a lit pit. Each within 15 percent.
- [ ] Gates as task 1. Commit.

### Task 3: The head off the tick

**Files:** `src/sim/beings.js`, `src/sim/tasks.js`, `src/sim/snapshot.js`, `tests/beings-lazy.js` (new), `package.json`.

- [ ] Write the failing tests in `tests/beings-lazy.js`. For a person who sleeps 8 hours by a lit pit across a dawn: needs, warmth, hp, and thoughts after `catchUp` equal, within 1e-6, the values a tick-by-tick reference gives (keep the old head as a test-only function for this). The same for a person who starves to zero food mid-stretch, for one who freezes, and across a season's turn. A thought ends at its `until`. A sleeper on a tile that catches fire wakes on that tick. A sleeper with a wolf at 5 tiles wakes on that tick.
- [ ] Build `catchUp`, `a.seen`, the next-act tick, and the proximity pass, as "A being between acts" says. The old-age roll runs once a world day for a being past its span, with `rollFor`.
- [ ] Budget test: a world day on seed `r` at day 3 in under 5 s. Report seconds for day 3 and, from the long run, day 50.
- [ ] Gates as task 1, plus `tests/snapshot.js` green with the new fields. Commit.

### Task 4: Work, sleep, and needs in world time

**Files:** `src/sim/clock.js` (`CLOCK.work`, `CLOCK.task`, `CLOCK.rate` needs), `src/sim/tasks.js` (`workKind`), `src/sim/recipes.js`, `src/sim/species.js` (decay rows), `tests/crafts.js`, `tests/tasks.js`.

- [ ] `workKind`'s `amount` is world time for a person of no skill. `workSpeed` divides it. Progress is elapsed time, so a worker is skipped until the end tick. The spec's values: knap an axe 1 hour, a lean-to 4 hours, a night's sleep 8 hours. The rest of `CLOCK.work` and every recipe keep their world-time meaning of today, rounded to a quarter hour, and the report lists them.
- [ ] Needs decay for each world hour. A person eats three times a day, drinks five, sleeps once. Write those as the test: over three days a fed, watered person's acts fall within one of those counts.
- [ ] `limit.task` becomes 3 days. Report how many tasks the watchdog drops in the long run, before and after.
- [ ] Gates. Commit.

### Task 5: Lives, ages, births, and plants

**Files:** `src/sim/beings.js` (`LIFE`), `src/sim/clock.js` (`birth`, `den`, `grove`, `plant`), `src/sim/camps.js`, `src/sim/species.js`, `src/sim/world.js`, `tests/dwellers.js`, `tests/gnomes.js`.

- [ ] `LIFE` in years: human adult 16, old 55, life about 70; rabbit 3, fox 5, wolf 8, deer 12; sprites and gnomes centuries. Ages given at world generation scale with them.
- [ ] Births by ruling 5. Plants by ruling 4.
- [ ] Every test that ages a being sets `born` directly and does not run the years.
- [ ] Gates. Commit.

### Task 6: Chases, embers, brands, and the hazards

**Files:** `src/sim/clock.js` (`chase`, `limit.ember`, `limit.guardEmber`, `party.coalsLast`, `cooldown`), `src/sim/species.js`, `src/sim/tasks.js`, `tests/closing.js`, `tests/dwellers.js`.

- [ ] Chases count tiles run, by ruling 3. An ember lasts 20 world minutes, which is 1,200 tiles and no limit on this map; the long run must show a person bringing fire home. A brand outlasts its chase by a quarter, as today.
- [ ] `cooldown.stalked`: derive it again. A maul takes 20 to 34 hit points; the healing rate is per world hour after task 4; the cooldown is the time to heal the worst maul at middling hardiness, and the test says so in numbers.
- [ ] The long run shows no death by mauling on seed `r`, and on `birch-crag-41` for 40 days with no fire lit by the player. Report maulings a day against today's.
- [ ] Gates. Commit.

### Task 7: The interface

**Files:** `src/ui/state.js` (`SPEEDS`), `src/ui/main.js` (`acc`, the cap on steps a frame), `src/ui/strip.js` and `src/ui/derive.js` (the date), `src/ui/keys.js`, `src/page.template.html`, `tests/ui.js`. The interface belongs to the feedback-pass session; tell it before this task starts.

- [ ] The ladder: 1, 6, 60 (the default), 600, then Days and Seasons shown and disabled with a tooltip that says the day tier is not built. The interface owns ticks a second: a speed of `n` is `n` ticks a wall second.
- [ ] At 600 the page runs 10 ticks a frame. The cap on steps a frame becomes a cap on milliseconds a frame (8 ms), and the page says "The world cannot keep up at this speed." once when the cap bites for a whole second.
- [ ] The Hour button steps 3,600 ticks over several frames under the same cap.
- [ ] The date reads "Day 12 of spring, year 1, 14:05". The autosave still writes once a world day, which at 600 is every 2.4 wall minutes.
- [ ] An age is printed in years, not days. `src/ui/panels.js:98` prints `${c.age} days` and `src/ui/inspect.js:52` prints `${Math.floor(ageDays(a))} days`. At real units a person of 70 reads as 25,550 days.
- [ ] `tests/ui.js`: the ladder, the default, the disabled steps, the date string, the age in years, the keys. Gates. Commit.

### Task 8: The rest of the tests in world units

**Files:** `tests/crafts.js`, `tests/closing.js`, `tests/gnomes.js`, `tests/dwellers.js`, `tests/wanderer.js`, `tests/snapshot.js`, `tests/door.js`, `tests/tasks.js`, `tests/terrain.js`, `tests/settle.js`.

- [ ] Every step count in a test becomes a call of a unit helper (`api.hours(6)`), and every run length is set by what the test must see, not by a number of today's ticks. The survey's part 5 lists the assertions by file. No assertion is dropped. One that cannot hold at real units within a test's time is reported, not parked.
- [ ] The snapshot oracle's save points move to world times with the same preconditions (someone walking, someone at work, a fire, a den dug after the load).
- [ ] `npm run fast` green, and its seconds reported against today's.
- [ ] Commit.

### Task 9: The tuning pass, the markers gone, and the report

**Files:** `src/sim/clock.js`, `tests/clock.js`, `design/notes.md`, `design/specs/2026-09-18-time-and-tiers-design.md`, `CLAUDE.md`, `design/settings.md`, and `design/reports/2026-09-g4-before-and-after.md` (new).

- [ ] Remove the four markers. `tests/clock.js` fails if one is left in `src/`.
- [ ] Re-read every player-facing string that states a time. The lint sees a bare literal in a rule. It does not see a correct constant used for the wrong quantity in prose, which is how issue 37 put the length of the year on the page as the length of winter. A sweep of dev 4bb1b36 found three in `src/sim/` to fix. `src/sim/goals.js:319` says "Cooked meat spoils in two days" and reads no constant, while `CLOCK.limit.cookedKeeps` is 1.8 days. `src/sim/goals.js:326` derives "That is one strip a day" from `SEASON_DAYS` and an aim of eight, so it lies if either moves; dev 898db4e marks it with a comment that names this task, and the comment goes when the fault does. `src/sim/goals.js:371` and `:376` say a den goes back to the beasts if the fire is out "for a day" and read no limit. Make each string read its constant. The two interface strings are task 7's.
- [ ] Tune against the long run on three seeds until a camp's first ten days read as today's do: a fire by day 3, tools by day 5, a shelter by day 7, a newcomer by day 10. Change a value only in the table, and log each change with its reason.
- [ ] Write the report: for each seed, today's golden line beside the new three-day line; the long run's counts beside today's at the same world age of the camp; every value whose world-time meaning moved by more than a factor of two, with the reason; seconds a world day at day 3 and day 50; the floors that were removed and where G5 puts them back.
- [ ] The notes gain a section on the real clock, the spec gains "As built (G4)", and `CLAUDE.md`'s soak paragraph says three days and `LONG=1`.
- [ ] Watch the hermit rule. The branch in `src/sim/camps.js` that fires when one person is left holds on zero ticks of all six seeds for 70 days today, measured by dev-coordinator, and every seed does fall to one living person. The hearth condition is the only thing that prevents it. This retune changes when a pit goes out, so the rule can start to fire. Report it in the long run if it does. Issue 25 lands before this plan starts, by dev-coordinator's ruling, so read the rule under its new name and expect a second camp to be founded rather than the old false line to be printed.
- [ ] Do not bless. Open the pull request with the report, and tell dev-coordinator that it waits for the user.

**An option, not a task.** Nothing catches prose that states a duration. `tests/clock.js` reads rules, not strings, so issue 37 and the six strings above all passed it. A lint that flags a number word beside "day", "days", "winter" or "year" in a player-facing string would have caught all seven. It would also be noisy. Offer it to the user with the report; do not build it inside G4.

## Self-review

| Spec line | Task |
|---|---|
| A tick is a world second, a day 86,400, a year 365 with seasons 91, 91, 91, 92 | 1 |
| Walking a tile a tick, a run two | 1 |
| Cellular systems once a world minute | 2 |
| Camp rules as rates an hour, rolled at the step | 2 |
| Needs an hour; work in world time; an axe 1 hour, a lean-to 4, sleep 8 | 4 |
| Lives in years | 5 |
| The speed ladder | 7 |
| The reshaped tick soak; a world day under 5 s | 1, 3 |
| Blessed once; the floors hold or the user has ruled | 9, and rulings 1 and 2 |

Not in G4: the day tier, the day soak and its floors, calibration between tiers, the rates table, and zoom. They are G5 and G6.
