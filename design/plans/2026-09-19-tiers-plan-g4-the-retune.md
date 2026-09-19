# The Retune Implementation Plan (G4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: ready to start.** The user has ruled on all seven questions. See "The rulings". Two of the four late rulings name work this plan must not do: pack hunting, and child mortality. Both are recorded there and both are somebody else's. One question is deliberately left open: whether the soak keeps its floors. Task 4 measures it and takes a number to the user. No task removes a floor before that.

**Goal:** Move the engine to real units, and keep the game playable at real units. A tick is one world second, a day is 86,400 ticks, a year is 365 days, a person lives about 70 years, and a walking person moves one tile a tick. The golden is blessed once, at the end, by the user.

**Architecture:** The four legacy markers of plan G1 (`ticks`, `strides`, `tickRate`, `strideRate`) first become converters, so the whole table keeps today's world-time meaning at the new tick. The engine's beats then move off the tick: cellular systems run once a world minute, camp rules roll at hourly rates, and a being's state is computed from elapsed time. Once every being and every system carries the tick of its next act, the engine can jump to that tick instead of stepping through the ticks between, so world time costs what happens in it rather than what it spans. Each group of the table is then rewritten in real units and its marker removed. The plan is done when no marker is left and dev is playable.

**Tech stack:** Plain JS scripts in one shared scope, `node --test`, no dependencies.

| Task | Delivers | Gate |
|---|---|---|
| 1 | The calendar at real units, the markers as converters, walking at a tile a tick, the soak reshaped | determinism, invariants, the oracle |
| 2 | The beats: cellular systems once a world minute, camp rules at hourly rates, periods in world time | the same, and plant and fire counts a world day within a table of tolerances |
| 3 | A being's head off the tick: state from elapsed time, a cheap proximity pass each tick | the same, and a world day in under 5 s |
| 4 | The skip: the engine jumps to the next tick at which anything happens | a skipped run and a stepped run give the same fingerprint, chronicle, and layout; the floors measured and reported |
| 5 | Work, sleep, and needs in world time | the same, and the crafts tests in world units |
| 6 | Lives, ages, births, and plants | the same |
| 7 | Chases, embers, brands, and the hazards | the same, and no odd death in the long run |
| 8 | The interface's clock: the speed ladder, the Hour button, the calendar display, the autosave's beat | `tests/ui.js` |
| 9 | Playability: the watch list in the days era, and the chronicle's filters | `tests/door.js`, `tests/ui.js`, and a person reaches winter in under a minute |
| 10 | The rest of the test suite in world units | `npm run fast` |
| 11 | The tuning pass, the markers gone, the record, and the before and after report for the user | the long run's report; the user blesses |

The spec is `design/specs/2026-09-18-time-and-tiers-design.md`, sections 0, 1, 10, and the G4 row of section 12. The survey is `design/reports/2026-09-19-g4-survey.md`. It holds the measurements this plan rests on, with file and line. Every task reads it. The survey was written before the user ruled, so its last row is now wrong; see "What the survey found".

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
| ~~At the top speed of the new ladder, a season takes about 4 wall hours~~ | superseded | The user rejected this as a thing to live with. A ladder cannot reach a year; task 4 and task 9 are the answer instead. |

Two numbers in that table are Node numbers, not browser numbers. The 26 to 52 seconds a world day is measured by `tests/lib/run.js` stepping `load()` in a bare loop. Nothing in `src/sim/` throttles. `TPS` is declared at `src/sim/clock.js:4` but no rule reads it; `speed` and the frame budget live only in `src/ui/`. So headless parity at unlimited speed is already true today, and the wall is tick count alone.

The 26 to 52 seconds has a second measurement behind it, taken a different way. While surveying for issue 48, patcher measured a headless world day on seed `r` at about 240 ms on today's clock, which is 0.24 ms a tick, which predicts about 21 seconds at 86,400 ticks. That number comes from today's per-tick cost multiplied out, not from running the retune, so it is independent of the survey and it agrees with it. This plan's central timing claim rests on two measurements and not on one.

`load()` gives a fresh scope on every call, which patcher verified. So two worlds with two different `CLOCK` tables run side by side in one process, and a before-and-after comparison needs no second process. Tasks 4 and 11 both want this.

## The rulings

### Ruled by the user

| # | Question | The ruling |
|---|---|---|
| 1 | When does G4 reach dev? | Build it, and fix the playability inside G4. |
| 2 | May the soak drop its floors, because 800 world days a seed is too slow? | The premise is rejected. Make the simulation fast. Variable tick speed is an engine requirement. |
| 7 | How much of the retuned table does the pull request show? | Big movers are enough. |
| 3 | How long is a wolf chase? | A short opportunistic sprint, measured as distance. Pack hunting is real and is **not** G4's. |
| 4 | How fast does the forest change in a life? | Visibly, within one life. Plants scale to years as animals do. |
| 5 | How fast does a camp grow? | A child every two years as a base, not as a metronome. |
| 6 | How often is danger checked? | Every world second. Today's rule exactly. |

The user's words, because the gloss is not the ruling.

> **On 1.** "let's build G4. G4 also needs to include considerations of UI/UX changes and improvements, and continuing improvement on things like breakpoints and filters, to make things playable. Higher speeds also become absolutely necessary."

> **On 2.** "again - more speed - not just speed from a UI perspective, which changes the way backend things are processed - but SPEED OF TICK should be variable. 'real' gametime is sped up, for user-skipping-time or for testing and debugging. PARTICULARLY for agents running the simulation (there is no need to run it in a browser! They should be the same!! This is a simulation!) speed should be effectively unlimited."

> **On 7.** "Big movers are fine."

**What ruling 1 changes.** The draft held G4 out of dev until G5 was ready, because at real units a player cannot reach summer, winter, a grown child, or a death of old age. The user did not take that trade. G4 merges into dev like any plan, and fixes the playability itself. A merge into dev publishes to GitHub Pages, so G4's merge is a release. dev must be playable on the day it merges, not eventually.

Playability is not a task at the end. It is three things, and they are spread through the plan:

| The player's problem | Where it is solved |
|---|---|
| Waiting is too slow | Tasks 3 and 4. World time costs what happens in it. |
| Watching is too slow | Task 8. The ladder's top rung is what task 4 makes possible. |
| Naming where to stop | Task 9. The watch list, which `door.js` already names twice and does not build. |
| Reading what happened | Task 9. The chronicle drowns the player at 86,400 ticks a day. Filter it. |

**What ruling 2 changes.** Variable tick speed is a property of the engine, not a setting of the view. The demand is not that the page draws faster. It is that a world second costs nothing when nothing happens in it, whether a player or an agent asks for it. Task 4 is that work, and it is why the floors question is not answered yet.

### Rulings 3 to 6, now ruled

The user has ruled on all four. Two confirmed the default. Two answered past the question, and those two are written out in full below, because in both cases the answer names work this plan must **not** do.

| # | Question | The ruling |
|---|---|---|
| 4 | **Plant lives.** A bush dies at 60 of today's days, about two of today's years. | Confirmed: plants scale as animals do, by the year. A bush about 2 years, a pine about 100, `grove.oldPine` 40 years. Berry growth stays seasonal. The user's aim, in their words, is that change is visible within one life. |
| 6 | **The proximity beat.** A check once a world minute can miss a wolf that walks 60 tiles in that minute. | Confirmed: every world second, which is today's rule exactly. The user took this knowing the cost, which is that the engine cannot skip while a predator is near, so tense stretches play slowest. |

**Ruling 3, the chases.** The user rejected both options offered and described the animal instead:

> "Wolves run in packs. A single wilf will chase something for an opportunistic short sprint if it comes across one, but otherwise wolves will take a longer group preparation, using little energy, and then do a short attack in concert."

That is two behaviours, and only the first exists in the code. Every wolf in `src/sim/species.js` hunts alone; `chase.stalk` is one wolf stalking one person, and nothing anywhere coordinates two.

- **G4 converts the first and only the first.** A lone wolf's opportunistic chase is a distance: it gives up after it has run `CLOCK.chase.*` tiles, and the numbers start at today's stride counts, which are today's tiles. That is a short sprint, which is what the ruling asks for.
- **Pack hunting is new behaviour and is not G4's.** A long group preparation at low energy, then a short attack in concert, is a design for how wolves decide and act together. It is not a unit conversion and no retune produces it. Task 7 must not reach for it. If a task finds itself tempted, the rule above applies: report it and leave it alone.

**Ruling 5, births.** The user confirmed two years and then qualified it:

> "a child every two years is a good start. some people will have no children, others will miss intervals, some children will die early. this is the wilderness, practically."

So two years is a floor between children and not a schedule. Task 6 writes it that way and says so: `birth.gap` is the earliest a mother may have another child, and `birth.chance` is what decides whether she does. Those two together already give "some people will have no children, others will miss intervals" without a new rule — the chance is rolled, not a metronome. Task 6 reports the spread it actually produces over the long run, so the user can see whether it reads as the wilderness or as a queue.

**Child mortality is flagged, not built.** "Some children will die early" conflicts with a standing rule of this repository: any death in a soak that is not old age is a bug until proven otherwise. That rule is what has caught real faults. Adding a death cause inside G4 would blunt the plan's own safety net at the moment the clock moves under it, and it is not a unit conversion. It needs its own decision and its own piece of work. Task 6 names it in its report and does not build it.

Ruling 6 and task 4 meet, and task 4 says how. A pass that must run every tick is a pass that forbids a jump. The resolution is in "The skip" below, and it does not weaken ruling 6.

### Left open on purpose: the floors

The draft asked the user to drop the soak's floors, because 800 world days a seed is too slow to run. The user's answer attacks the slowness. That does not by itself save the floors, and the plan must not pretend it does. Even unthrottled and headless, 800 world days at 30 seconds a day is hours.

Tasks 2, 3, and 4 are what buy the speed, because they take systems off the per-tick beat and then let the engine skip the ticks with nothing in them. Their measured result decides the floors.

So: do not drop the floors and do not promise to keep them. Task 4 measures seconds a world day and seconds for a 70-day and an 800-day run, and puts those numbers in front of the user. Nothing is removed before the user has read them. If the skip brings a world day down far enough, the question dissolves and nothing was lost.

## Global Constraints

- Work in `/Users/earchibald/Worktrees/hamlet-tiers` on branch `tiers-g4`, cut from dev at cb903eb and behind it. **Merge dev before task 1 starts.** The collector fix of "The instrument" is already in dev at 6a7e427. Issue 25's `theLoneFounder` fix is the one thing still outstanding; neither is G4's work, and if it is still open when task 1 is ready, say so and do not work around it. Never check out, stash, or commit in `~/Code/hamlet`.
- G4 merges into dev through dev-coordinator, which is the only session that merges. A merge into dev publishes the built page to GitHub Pages within about three minutes, so the merge is a release to the public site. There is no staging step and nobody looks at it in between. Ruling 1 means dev must be playable at that merge, and so must the published page one minute later.
- **G4 lands as one merge.** Build it on the branch, in as many commits as it takes, and merge once. A retune that reaches dev in pieces publishes every piece, and an intermediate state of this plan is exactly the state that can hold neither the golden nor the playability. This reverses the usual preference for landing early: for inert work early is cheap, and for this work every intermediate landing is a public release of a half-retuned world.
- **The playability gate is a gate, not a report.** "The player's gate" below says what playable means in numbers a person can check on the built page. Task 9 measures it and task 11 repeats it. A task that cannot meet it says so and does not open the pull request.
- G4 moves the golden once. No task runs `UPDATE_GOLDEN=1`. Task 11 prepares the report; the user blesses. Until then `tests/soak.js` compares against a working record, `tests/soak-working.json`, which each task may rewrite and must say so in its report with the reason.
- Between the first task and the bless, three gates stand in for the golden: a seed run twice gives the same fingerprint; the snapshot oracle (`tests/snapshot.js`) holds; and no death in the soak or the long run has a cause other than old age.
- From task 4 on, a fourth gate joins them: a run that skips and a run that steps give the same fingerprint, the same chronicle, and the same layout. A skip that changes the story is a bug in the skip, never a new golden.
- Speed is an engine property. No rule in `src/sim/` reads a wall clock, a frame, or a rate of play. The page's speed and the agent's absence of one must reach the same world from the same seed.
- **A task that meets a cheap improvement belonging to somebody else's ruling reports it and leaves it alone.** This covers more than the clock table. "A marker flags a decision" is the same rule for constants; issue 53 is the case for an act's score. A god can make the same creature many ages running, so the legends repeat. The cure is the making act's score once every country of a pole is full, the user has ruled that it lands after G4's bless, and it is not in G4's scope. The retune touches the ages and the grammar, so a task may well meet it and be tempted, because the change is small and plainly an improvement. That is exactly what makes it dangerous: it is cheap, it is right, and it is not this plan's to make. Name it in the task's report and move on.
- **One plan moves the record at a time.** Issue 25 landed before G4 because a refactor can only be proved inert while the record is still. Issue 53 lands after the bless for the same reason running backwards: it must move the record on purpose, and it cannot do that inside a plan already moving it for its own reasons. A report that showed both at once could not say which part was the retune and which was the gods choosing differently, and the user is asked to bless exactly that report. So each gets its own before and after.
- No task adds a way to change a constant while a world runs. `CLOCK` is fixed before a world exists. This is not a cost the plan pays for replay; it is how the user intends to work. Their words, to patcher, on the developer suite: "I do not intend to tweak a running game! This is to tune parameters to *bake into* a new run of the game, and when desired, into the build." Tuning has two lifetimes and they are complementary. A named set of values handed to `startWorld(seed, options)` is how a value is **tried**, and the options record is already part of what replay reads, so nothing is added to the door. A commit to `src/sim/clock.js` is how a value stops being a trial and **becomes what the game is**. Task 11 uses both.
- A duration or a rate goes in `CLOCK`, or in a `SPECIES`, `LIFE`, or `RECIPES` row, in the unit helpers. `tests/clock.js` fails on a bare one. A legacy marker may only be removed, never added.
- A new top-level `let` or `var` in `src/sim/` goes in `SAVED_STATE` or `NOT_SAVED`. A field that points at a record goes in `REFS`. A field added to a saved record is read as optional with a default, and `SNAPSHOT_VERSION` stays 1, unless the meaning of a saved field changes. The meaning of `tick` changes in this plan, so **the version rises to 2 in task 1**, and a version 1 save is refused with its sentence.
- The naming plan landed before G4 and blessed the chronicle fields of the golden. Merge dev before G4's first task, so that G4's diff shows only G4's moves. `tests/names.js` holds a layout record, `tests/names-layout.json` (the tick-0 layout, and the day-70 `beings` and `items` under `SLOW=1`). G4 moves those on purpose. Task 11 measures the layout file again with `UPDATE_LAYOUT=1` in the same commit as the bless, and says so. Read the comment at the top of `tests/names.js` first. Naming adds a third random stream, `nrng`; `catchUp` and every new beat must draw from `rng` only.
- The names landed in dev at 68b7061 and blessed `chronicle` and `chronicleLines`. Take G4's before fingerprints from the dev commit this plan branches off, not from a remembered number. dev was at cb903eb when this plan was last revised, released and verified byte identical to its committed build, and nothing since the naming bless has moved the golden. Issue 25 landed at 7c62d70. The survey counted chronicle lines before the names, so its line counts are low by 49 to 99 a seed. `CLOCK.names` holds `nameHour`, `eventMemory`, and `epithetAfter`; task 6 rules on them with the ages. The naming pass runs at hour 20 each night, and `log` takes a tag that rules read. A person's `deeds` counts acts by tag; plan G6 reads it before it designs the annals.
- `updateWorld()`'s order of calls does not change. A system that moves to a slower beat keeps its place in the list and returns at once off its beat.
- The engine step stays pure. Every outside act enters by `inject()`. Where to run to is an act and passes the door. How fast to draw it is view state and never passes the door. Plan E3 settled that line; G4 keeps it.
- Files in `src/sim/` and `src/ui/` are plain scripts in one scope. No `import`, no `export`. Do not change the body of `load()` in `src/sim/index.js`. If a security hook blocks a legitimate edit, stop and report it.
- Run `node build.js` after every change to `src/` and commit the built page.
- Game text is plain English, one idea per sentence. Documents follow the house style: one idea per sentence, 25 words at most, active voice, one word for one meaning, paragraphs of six sentences or fewer, a summary table at the top.
- The budgets: a tick-tier world day in under 5 s in Node on seed `r` at day 3 and at day 50 of the long run, before the skip; after task 4, a world day in which little happens costs far less, and task 4 reports the figure rather than assuming one. `npm run fast` in about its present time; the soak in about two minutes.
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

### A marker flags a decision, not a number

`ticks`, `strides`, `tickRate` and `strideRate` do not say what a value is. They say **nobody has decided yet what it means in real time**. That makes them a to-do list, and the plan is done when the list is empty.

So a marked value is never converted because it happens to equal a real-unit expression. The arithmetic is free and the meaning is not: the conversion removes the flag that says nobody has decided, without anybody deciding. The value then looks settled, and the task that owed it a reading passes over it.

`CLOCK.den.digRetry` is the worked example, raised by patcher and dev-coordinator while fixing `theLoneFounder` in PR 52. It is `ticks(500)`. Its new neighbour `CLOCK.arrival.foundRetry` is `hours(12)`, and at `DAY` of 1000 those are the same number, so the two sit in one table with one value and disagree about their own nature. Converting `digRetry` looks like tidying and is not.

Two things settle it, and the second is the one that generalises.

It buys nothing. Task 1 makes `ticks(n)` the converter `secs(n * 86.4)`, so `ticks(500)` becomes 43,200 world seconds, which is 12 hours exactly. The value G4 reaches by leaving it alone is the value the conversion would write today. The inconsistency dissolves in task 1 at no cost.

It costs a reading. `digRetry` belongs to the den group, which task 6 rules on. Written `hours(12)` it arrives at task 6 already looking decided, and the question task 6 owes it — is half a world day right for a driven-out wolf to wait before trying for a hill again? — is the question a settled-looking value does not get asked. Note that `digAfter: days(3)` sits on the same line already in real units. The mixed line is the marker working, not a mess.

**Arithmetic is not a reading, and the table is built to hide the difference.** patcher counted `src/sim/clock.js`: of its 150 `ticks()` entries, 30 land on a whole number of days and 36 on a whole number of hours. So **about 44 percent of the marked table converts to a round, human duration by arithmetic alone.** `guardEmber: ticks(500)` is `hours(12)`. `swarm: ticks(4000)` is `days(4)`. `blight: ticks(5000)` is `days(5)`.

That is a risk and not a convenience. A task told to convert its group will find that most of its values convert mechanically into something round and plausible, and a round plausible answer feels finished. `ticks(4000)` becomes `days(4)` without anybody asking whether four days is the right time for a swarm to last. A wrong conversion is visible in the diff; a mechanically correct one is indistinguishable from a considered one. The values most at risk are the tidiest: `hours(13.7)` gets argued about and therefore gets read, and `days(4)` sails through.

**So each task's report says what each value means in world time and why that is right — not what it converts to.** The conversion is the easy half and the helpers already did it.

**The gate.** A task names every value it converted **without changing**, because that is where an unread value hides. A group where everything converted and nothing moved is either well tuned or never read, and only the task can say which. Saying "I converted these nine and changed none, and here is why each is right" is the report. A silent group is not.

The worked example above is the case in point. `hours(12)` for `digRetry` is not wrong — it is exactly right, and task 1 reaches the same number on its own. The objection was that task 6 owes the value a question: is half a world day right for a driven-out wolf to wait before trying for a hill again? The arithmetic could never answer that, and it would have looked as though it had.

**The arrival group holds two waits, and they must stay two.** `theLoneFounder` answers two different failures with two different durations, and the comments in `src/sim/camps.js` say which is which. No candidate ground reachable from any edge of the world is terrain, terrain does not change tick to tick, and looking again soon costs a camp record and a flood fill per site for nothing, so that failure waits `CLOCK.arrival.afterTheLast`, the whole stretch. Running short of loose rock and sticks is a passing state, so that failure waits `CLOCK.arrival.foundRetry`, half a day. **The retune scales two durations here. It does not unify them.** A retune that makes them one value removes a distinction the rule depends on, and the diff will look like a simplification.

There is a second pin, and it is not protection. `tests/clock.js:51` asserts the whole arrival group as literals in one `assert.deepEqual`, `foundRetry: 500` among eleven numbers. It looks like it closes the gap above and it does not. G4 retunes every arrival value, so that one line goes red for all eleven at once and is rewritten wholesale — and a wholesale rewrite of eleven numbers is exactly where a collapse passes unnoticed. It is the failure this plan already names one section down: a check that fails on every retune of values it does not care about teaches the reader to update it rather than read it. dev-coordinator reached the same conclusion from the other side. So the two-wait rule lives in this plan, as a thing task 1 must not do, and not in a test that the task which could do it will rewrite in passing.

**Before you grep `tests/clock.js`, read this.** The file holds two raw NUL bytes at lines 186 and 188, used as a key separator inside string literals and written as the byte rather than as `\0`. They work. But `file` reports the file as `data`, so BSD `grep` treats it as binary and prints **no match and exit 1** instead of reporting a binary match. That is indistinguishable from a real absence. `git grep`, `grep -a`, `sed`, `cat` and node all read it correctly; plain `grep` does not, and it has been this way since before 8ef6e88. dev-coordinator and this session each reached a wrong conclusion about this file within an hour, independently, and neither doubted the tool. Every task in this plan greps, and `tests/clock.js` is named in tasks 1, 6, 8 and 11. **Use `git grep` throughout, or `grep -a` on this file.** A sweep that reports a clean file here has probably not read it. The NUL bytes themselves are patcher's, not G4's, and this note stands whether or not they are gone by the time you read it — check rather than assume.

What guards it, and how far. `tests/wanderer.js:349` and `:350` run the same body twice, once per failure, and assert `longestWait` equals `CLOCK.arrival[waitKey]` read from the loaded table. Because it reads the table rather than a literal, **it follows the retune instead of failing against it**: task 1 may scale either value and the test stays green, which is the behaviour to want from a test of which constant a path uses. Note its limit. It pins the key each path reads, not that the two keys differ. Set `foundRetry` equal to `afterTheLast` and both cases still pass. So the test catches a rule that reads the wrong constant and not a table that has collapsed the two. That second one is this plan's to catch, which is why it is written down here rather than left to the suite.

**The rule.** Only the task that owns a group converts that group's markers, and it converts them having read the value. No other task, and no fix passing through, converts a marked value for consistency with a neighbour. A new value is never written with a marker, so a new neighbour in real units beside a marked one is the normal and correct state. If a passing fix finds the inconsistency jarring, it says so in a comment and leaves the value alone: an inconsistency on the record is cheaper than a decision nobody remembers making.

### The conversion rule for each category (survey, part 3)

| Category | Count | Rule |
|---|---|---|
| (a) a plain duration | 136 | `ticks(n)` holds it in world time at once. Its task rewrites it in `mins`, `hours`, or `days`, rounded to a value a person would say. |
| (b) a stride count or a distance | 53 | Work becomes world time (task 5). Walking distances become tiles (task 7). A chase follows ruling 3. |
| (c) a chance a tick | 31 | A rate for each world hour, rolled with `rollFor` at the rule's beat. |
| (d) an amount a stride | 6 | An amount for each world hour of the act. |
| (e) a period and its phase | 17 | World time, by hand (task 2). |
| (f) an age or a life stage | 12 | Years (task 6). Births follow ruling 5, plants ruling 4. |
| (g) the calendar | 1 | Task 1. |
| unclear | 11 | Each is named in its task with its ruling: `limit.ember` and `limit.guardEmber` with the chases; `limit.task` with work; `cooldown.stalked` is derived again from the healing rate; `limit.resourceCache` becomes 10 world minutes; `plant.samples` is fixed by the minute beat. |

### The calendar

`DAY = 86400`. `TPS` leaves the sim; the interface owns wall time. A year is 365 days. The seasons are spring 91, summer 91, autumn 91, winter 92, from one table `SEASON_LENGTHS`, and `seasonOf`, `isWinter`, `dayOfYear`, and `yearOf` read it. `SEASON_DAYS` goes. The survey's part 4 lists every read site. A world starts at 07:00 on day 1 of spring of year 1. The chronicle's `when` shows the year once a world has more than one.

### A being between acts

Today `updateBeing` runs its head on every being every tick. Under G4 a being holds `a.seen`, the tick its state was last brought up to date. `catchUp(a)` brings needs, warmth, hp, thoughts, age, and the status up to `tick` from `a.seen`, in stretches that break at dawn, at dusk, at a season's turn, at a change to the camp's pit, and at the moment a need reaches zero. It runs when the being next acts, when another rule reads the being's state, and once a world minute at the latest.

A thought holds `until`, a tick, and no longer counts down. A record that changes shape changes in the snapshot with it; `tests/snapshot.js` must stay green.

A being's next act has a known tick when it walks (every tick), works or sleeps (the tick its work or its rest ends, from the rate), or waits. The executor keeps that tick on the being and skips the being until then. The proximity pass of ruling 6 can wake it sooner.

### The skip

Task 3 gives every being the tick of its next act. Task 2 gives every system the tick of its next beat. Between them the engine can name the next tick at which anything at all happens. Task 4 makes it jump there instead of stepping through the ticks between, so a world second costs what happens in it and not what it spans.

**The horizon.** `nextEvent()` returns the earliest of: the next being's next-act tick, the next system beat, and the next calendar break a rule reads (dawn, dusk, a season's turn). `runTo(t)` advances to `min(nextEvent(), t)` in one move, resolves what is owed there, and repeats.

**What forbids a jump.** Ruling 6 puts a proximity pass on every tick, and a pass on every tick is a pass that cannot be skipped. It is only a real constraint when it has work. So a burning tile, or an awake predator within its own reach of a sleeping or working person, pins the horizon to the next tick. Nothing else does. When something dangerous stands near people the engine steps one tick at a time, which is right: that is the part of the world worth watching. When nothing does, the pass has nothing to find and the engine jumps. Ruling 6 is not weakened; it is given a precondition that is cheap to test and that names exactly today's rule.

**What proves it.** A seed run by `runTo` and the same seed run tick by tick give the same fingerprint, the same chronicle, and the same layout. That test is the task.

**This gate needs the collector fixed first.** See "The instrument", which is a precondition of this plan and not a part of this task. A gate built on the present collector measures the harness.

The comparison is against the stepped run and never against a stored record. A stored record remembers the numbers, and a broken skip that draws the same numbers agrees with it. The golden fixes the random number stream, so anything that moves no number is invisible to it, and the skip's horizon is exactly that kind of thing: a missed beat or a season turned over without a rule reading it can leave the stream untouched and the world wrong. Compare against the thing being preserved, not against a file that only remembers what was drawn. Every way a skip can be wrong — a beat missed, a need that crosses zero inside a jump, a season turned over without a rule reading it — shows as a difference there.

**What the skip is not.** It is not pacing and it does not pass the door. A jump is the engine deciding that it has nothing to do, and it gives the same story either way, which is what the fingerprint test proves. What passes the door is where to run to, and that is the watch list's business.

### The watch list

`src/sim/door.js` returns the same sentence twice today, at line 87 and line 98: "Only a run to an age is built. A run to an event waits for the watch list." The ages era has `run` and `watch`, `runUntil` and `stops`, a stop that clears itself when it fires, and a line that says why the run ended. G4 does not invent this. It builds the days-era half that the code already names.

Task 9 gives the days era `run({ what: 'day' | 'season' | 'year', at })` and stops on events as well as on times: a death, a birth, a hearth gone out, a person cut off, a newcomer, a goal reached. Each is a tag `log` already takes. A stop fires once, is spent, and writes its line. That is the ages' rule and it does not change.

This is what lets a player reach winter. A ladder cannot: at an hour a wall second, a season is still 36 wall minutes. A run to winter over a skipping engine is seconds, and it stops with a sentence that says where the world got to.

### The instrument

**Fixed in dev at 6a7e427, by PR 50, issue 49.** It was a present defect and not G4's to carry; it is recorded here because G4 would have made it worse, because every gate in this plan reads through it, and because task 4 depends on it. The seed prohibition below is lifted: a long creation now fingerprints in full. Read the rest of this section as the reason the instrument is trustworthy, not as work owed.

`log()` at `src/sim/core.js:165` trims: `chronicle.unshift(e); if (chronicle.length > 300) chronicle.pop();`. The live chronicle holds the last 300 lines. The collector in `tests/lib/run.js` takes lines by scraping that window, and its own comment at line 29 states the condition it depends on: "a run that wants them all must take each line as it appears."

Two callers do not honour it.

| Where | What is lost |
|---|---|
| `runDays` calls `api.startWorld(seed, opts)` and only then builds the collector, so the whole creation is logged before the collector exists | On seed `sweep23`, 300 lines held against 965 in `legends`: two thirds of the creation gone from the `chronicle` field, and `chronicleLines` wrong by the same amount. Measured by dev-coordinator over 40 creations; the next four worst are 224, 203, 190, 167. The six soak seeds sit at 73 to 121, so nothing is wrong today. |
| G4's skip makes one step cover a span, so `drain()` runs once for the span | A span that writes more than 300 lines loses its oldest. `drain()` walks newest-first until it meets a seen line; if that line was popped it does not see a gap, it takes the newest 300 and calls it the span. |

Both are the same fault: a gap between when a line is written and when the harness looks. One fix closes both.

The creation case is the more dangerous of the two, because nothing is red. The six soak seeds are short enough that the record is honest, so the fingerprint silently covers less than it claims only for whoever next picks a long-creation seed. **That was an argument against adding a soak seed until it was fixed**, because a seed with a long creation gave a truncated fingerprint and a weaker gate that reported itself as a pass. Fixed at 6a7e427, so a seed may now be added on its merits.

For task 4 the same fault threatens the skip's gate in both directions. The stepped side keeps everything and the skipped side can drop lines, so the fingerprints differ for a reason that is the harness and not the skip, and the task hunts a horizon fault that is not there. Worse, a real defect that suppressed lines could be masked by a trim that dropped the same region, and the gate passes a broken skip. That is the stored-record problem one level down: a comparison is sound only if the instrument sees everything on both sides.

**Do not raise the 300.** It is a display limit for the player's drawer, and a display limit that moves to satisfy a test stops being one. Close the gap instead, so that lines are observed as they are written rather than scraped afterwards. Then the creation, a single step, and a jump over a thousand ticks all give the same list by construction. The straightforward shape is a sink in `log()` that the harness sets and that is null otherwise: no rule reads it, it draws no random number, and it goes in `NOT_SAVED` with its reason.

**Assert the instrument too.** Count lines written against lines collected and require them equal at the end of every run, so this cannot come back silently.

The proof is `startWorld('sweep23')`, which drops 665 lines today with no new engine behaviour. That is better than a constructed jump: it exercises the real path, and it goes on working as a regression test after the skip exists.

Affected: every test that builds a collector — `tests/soak.js`, `tests/names.js`, `tests/door.js`, `tests/gnomes.js`, `tests/settle.js`, `tests/wanderer.js`, `tests/snapshot.js`, `tests/ui.js`, `tests/trace-deaths.js`. **`tests/ages.js` is not affected**, which I confirmed rather than assumed: it calls `load()` directly, builds no collector, and takes no fingerprint. Grepping `fingerprint` in the tests does return `tests/ages.js`, which looks like it contradicts that. It does not: the only match is the word inside a comment at line 70, and there is no call. dev-coordinator hit the same false positive, so it is recorded here rather than left for the next person to re-derive.

### The check a change cannot run on itself

Three faults met while writing this plan turned out to be one fault. Each was a test that lived inside the condition it was meant to verify, so it agreed with the thing it was supposed to catch.

| The test | The condition it lived inside | What it could not see |
|---|---|---|
| The golden record | the random number stream | anything that moves no number: a suspension point, a stop position, who acted when, the skip's horizon |
| A skip compared against a stored record | the numbers that were drawn | a broken skip that draws the same numbers and agrees with the file |
| The chronicle sink's own tests | a sink that is set | that it stays null where it must, which only a run of the built page could show |

None of the three was caught by care. Each was caught by somebody outside the change asking what ran in the state the change's own tests never entered.

**So every task answers this before it opens its pull request**, in one or two sentences in the commit, and names what it ran:

- What state does this change have that its tests never enter? A flag off, a seam absent, a branch not taken, a rate not used.
- What runs in that state, and who checked it? If the answer is only the built page, say so and run the page.
- Is any comparison here made against a record rather than against the thing being preserved? If so, say why the record cannot agree with the fault.

A task with no such state says so in a sentence. The wrong answer is silence, because silence and "there is none" look the same in a diff and only one of them is true.

This check is structurally one an author is worst placed to run, so a task reporting it honestly is worth more than a task passing it. Answering "I did not check that" is a result.

### The player's gate

Ruling 1 makes playability a condition of the merge, so it needs a threshold somebody else can check. These are measured in a browser on the built `dist/hearth-sim.html`, on seed `r` and on one other named seed, from a new world.

| What | Threshold |
|---|---|
| A new world to the first day of winter (day 274), by a run | under 60 wall seconds, ending on a line that says where the world got to |
| A new world to day 3, by a run | under 2 wall seconds |
| The top ladder rung held for a world day | a world day in 24 wall seconds, within a fifth |
| The page answers a click while a run is in flight | under 200 ms, and the run can be stopped by the player |
| The chronicle at the `major` filter, on reaching winter | under 200 lines, each one a sentence a newcomer can read |
| A line in it that the retune made false | none of "The prose that states a duration", checked one by one |
| A camp's first ten days | a fire by day 3, tools by day 5, a shelter by day 7, a newcomer by day 10, as task 11 tunes for |

Two honest limits on this table. A wall-time number measured in a browser is a property of the machine, so it is a floor to be met on the machine that merges and not a benchmark to be compared across machines. And the last rows are read by a person, not asserted by a test; the task reports what it saw and pastes the lines, so the reader can disagree.

**Record the load average beside every wall time, and re-run a miss once.** This repository already learned the other way round. PR 31 (issue 26, merged 9e7d859) removed the suite's one wall-clock assertion, 3000 ms in `tests/ages.js`, because it failed under parallel load and taught everyone to re-run a red gate. That habit makes every other gate worthless. So the licence here is narrow, and written down rather than invented at the gate:

- Print the one-minute load average with each wall time. A miss cannot be read without it.
- A row that misses is re-run **once**, on a machine at a load average of 2 or below, with no soak running. Report both numbers.
- A row that misses twice under those conditions is a real failure. Report it as one and do not open the pull request.
- Nothing else in this plan may be re-run because it was red. This licence covers these rows and no others, because a player's experience genuinely is a wall time and nothing else here is.

### The prose that states a duration

The lint in `tests/clock.js` reads rules, not strings. So a string that states a duration in words, governed by no constant, passes every gate and turns false the moment this plan moves the value. Issue 37 was this class: it put the length of the year on the page as the length of winter.

A promise to check all of the game's prose is not checkable. This list is. It was swept on dev cb903eb with a deliberately noisy grep, because the noise is read once by a person at the gate and not by a test on every run:

```
grep -rnE "(day|days|night|week|season|winter|summer|spring|autumn|year|hour|minute)s?\b" src/sim/*.js src/ui/*.js \
  | grep -iE "\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|every|each|[0-9]+)\b[^']{0,20}(day|night|week|season|winter|year|hour|minute)"
```

Re-run it at task 11 and add whatever is new. Do not trust this list to still be complete: it replaced an earlier sweep of mine that had missed two of these nine.

**Two classes, and the list mixes them.** A goal row and an interface string are free to reword: nothing hashes them. A chronicle line is hashed. `fingerprint()` at `tests/lib/run.js:106` builds its `chronicle` field from `${e.tick}|${e.kind}|${e.text}` for every event, so rewording anything written through `log()` moves the record on every seed where that line fires. Row 6 is the only one of the nine in that class. Read the **Class** column before touching a row.

| # | Line | Class | What it says | The constant | Verdict, and what it must say after |
|---|---|---|---|---|---|
| 1 | `src/sim/goals.js:184` | goal row | "Keep the hearth three days without a break" | `CLOCK.limit.hearthProven` = `days(3)` | True today, unlinked. Read the constant. |
| 2 | `src/sim/goals.js:319` | goal row | "Cooked meat spoils in two days" | `CLOCK.limit.cookedKeeps` = 1.8 days | True today, because 1.8 rounds to two. Read the constant. |
| 3 | `src/sim/goals.js:326` | goal row | "Winter is `${SEASON_DAYS}` days long... That is one strip a day" | `SEASON_DAYS`, and an aim of 8 | **Breaks in task 1, not task 11.** Task 1 deletes `SEASON_DAYS`. The arithmetic behind "one strip a day" holds only by chance. dev 898db4e marks it with a comment naming this work; the comment goes when the fault does. |
| 4 | `src/sim/goals.js:371` | goal row | a den "goes back to the beasts if the fire is out for a day" | `CLOCK.den.campDark` = `days(1)` | True today, unlinked. Read the constant. |
| 5 | `src/sim/goals.js:376` | goal row | beasts "come back if the fire fails for a day" | `CLOCK.den.campDark` | As 4. |
| 6 | `src/sim/species.js:271` | **chronicle, hashed** | "With the fire out a day, the wolves are back in the den under the hill." | `CLOCK.den.campDark` | As 4, and it is a chronicle line, so it outlives its moment and it is in the fingerprint. **The earlier sweep missed this one.** Reword it inside the blessed change, in task 11, and not early as a tidy-up. It fires on zero of the six seeds over 70 days today, measured by dev-coordinator, so it is golden-neutral **by accident** — the same accident that hid the doomed line. This retune changes fire and den timing, which is what decides whether it ever fires. Expect the possibility that it starts firing and that the reword is then visible in the diff, and do not read that as a fault in the reword. |
| 7 | `src/ui/inspect.js:52` | interface | a person's age as `${Math.floor(ageDays(a))} days` | `DAY` | Derived, so never false, but unreadable after the retune: a person of 70 reads as 25,550 days. Years. Task 8. |
| 8 | `src/ui/inspect.js:84` | interface | a bush or tree's age as `${...} days` | `DAY` | As 7, same fix, and **the earlier sweep missed this one too.** Task 8. |
| 9 | `src/ui/keys.js:23` | interface | "Step one hour" | `hours(1)` | True, and must stay true. Task 8 changes what the button does, not what it says. |

Two lines the sweep raised and cleared, recorded so a later reader does not re-raise them. `src/sim/goals.js:188` prints `camp.streak / DAY`, and `src/ui/derive.js:126` and `:199` print `daysOfWood()`, which divides by `CLOCK.rate.pitBurn * DAY`. Both derive from the constants they describe and cannot go false.

### The soak

| Run | What | Asserts |
|---|---|---|
| `node tests/soak.js` | six seeds, three world days | a site, a pit, a lit hearth, someone alive, nobody cut off, no odd death, the same fingerprint twice, the working record (the golden after the bless), and the seventh test (save at day 1.5, load, run to day 3) |
| `LONG=1 node tests/soak.js` | seed `r`, 70 world days | no odd death; prints people, births, goals reached, far-country counts, and seconds a world day |

The floors that the three-day run cannot hold are **not** removed until task 4 has measured the cost and the user has read it. See "Left open on purpose".

`scriptGod` lights a pit when the step count passes `c.coals`. `c.coals` is a tick, so the comparison holds at any scale; task 1 checks it.

---

### Task 1: The calendar, the markers, the walk, and the soak's new shape

**Files:** `src/sim/clock.js`, `src/sim/core.js`, `src/sim/beings.js` and `src/sim/tasks.js` (the stride gate and the walk), `src/sim/species.js` (the `stride` column becomes a speed in tiles a tick: 1 for a walk, 2 for a run), `src/sim/snapshot.js` (`SNAPSHOT_VERSION = 2`), `tests/clock.js`, `tests/soak.js`, `tests/lib/run.js`, `tests/soak-working.json` (new).

- [ ] Write the failing tests in `tests/clock.js`: `DAY` is 86400; `hours(1)` is 3600; `seasonOf` gives spring on day 1 and day 91, summer on day 92, winter on day 274 and day 365, spring again on day 366; `isNight` holds at 23:00 and not at 12:00; `ticks(1000)` is `days(1)`; every chance-a-tick entry of the survey's list is now an hourly rate below 1.
- [ ] Change the calendar and the markers as "The design" says. Replace each of the 31 chances with its hourly rate and roll it with `rollFor(rate, 1)` where the rule still runs each tick; task 2 moves the beat.
- [ ] Walking: a being on a path moves one tile a tick, two at a run (`fast`). The stride gate stays for acts that are not steps, reading the converted stride. Remove `darkStep`; a person in the dark walks at half speed by moving on even ticks only. Rewrite the two tests in `tests/terrain.js` that count steps.
- [ ] Reshape the soak as "The soak" says. Keep every floor that three days can still hold, and mark the rest as suspended pending task 4, not deleted. Write `tests/soak-working.json` from the first green run and say so in the report.
- [ ] Gates: `node --test tests/clock.js tests/snapshot.js`, the soak, and a note of seconds a world day. This task is expected to be far over the 5 s budget. Report the number.
- [ ] Commit.

### Task 2: The beats

**Files:** `src/sim/main.js`, `src/sim/weather.js`, `src/sim/world.js` (`growPlants`, `rotCarcasses`), `src/sim/camps.js`, `src/sim/fae.js`, `src/sim/species.js`, `src/sim/clock.js`.

- [ ] Write a failing test: over one world day on seed `r`, `growPlants`, `spreadFire`, `updateWeather`, `strayLightning`, `rotCarcasses`, and `groveTick` each run 1,440 times, and the count of tiles `growPlants` looks at is within 2 percent of 60,000.
- [ ] Add `CLOCK.every.cellular = mins(1)`. Each cellular system returns at once off that beat. `plant.samples` becomes looks a run (about 42). Every chance inside those systems is rolled with `rollFor(rate, CLOCK.every.cellular)`.
- [ ] `updateCamps`: the pit burns by elapsed time; spoilage, births, arrivals, storms, and lightning roll hourly rates at their own beats. Rewrite the 17 periods of category (e) in world time, each with its phase. The survey's part 8, row 8, lists the 16 `tick % N` sites.
- [ ] Each system keeps the tick of its next beat where task 4 can read it. A system whose beat cannot be named ahead of time is reported, not hidden: task 4 needs the list.
- [ ] Calibration test: one world day at this commit against one of today's days on the base commit, six seeds, from a saved table in `tests/calibrate-beats.json`: berries grown, bushes seeded, tiles burnt after one forced lightning strike, fuel burnt by a lit pit. Each within 15 percent.
- [ ] Gates as task 1. Commit.

### Task 3: The head off the tick

**Files:** `src/sim/beings.js`, `src/sim/tasks.js`, `src/sim/snapshot.js`, `tests/beings-lazy.js` (new), `package.json`.

- [ ] Write the failing tests in `tests/beings-lazy.js`. For a person who sleeps 8 hours by a lit pit across a dawn: needs, warmth, hp, and thoughts after `catchUp` equal, within 1e-6, the values a tick-by-tick reference gives (keep the old head as a test-only function for this). The same for a person who starves to zero food mid-stretch, for one who freezes, and across a season's turn. A thought ends at its `until`. A sleeper on a tile that catches fire wakes on that tick. A sleeper with a wolf at 5 tiles wakes on that tick.
- [ ] Build `catchUp`, `a.seen`, the next-act tick, and the proximity pass, as "A being between acts" says. The old-age roll runs once a world day for a being past its span, with `rollFor`.
- [ ] Budget test: a world day on seed `r` at day 3 in under 5 s. Report seconds for day 3 and, from the long run, day 50.
- [ ] Gates as task 1, plus `tests/snapshot.js` green with the new fields. Commit.

### Task 4: The skip

**Files:** `src/sim/main.js`, `src/sim/beings.js`, `src/sim/clock.js`, `src/sim/index.js`, `tests/skip.js` (new), `tests/soak.js`, `tests/lib/run.js`.

This task answers ruling 2. It is also the task whose numbers decide the floors, so its report goes to the user and the plan waits for a word before task 5 removes anything.

- [ ] Check that the collector fix has landed, as "The instrument" says. Do not build this gate on the old collector: it would measure the harness. If the fix has not landed, stop and say so rather than working around it.
- [ ] Write the failing test in `tests/skip.js`, and write it so that it fails against a `runTo` that merely loops `step()`. Six seeds, three world days, skipped and stepped: the same fingerprint, the same chronicle line for line, and the same `tests/names.js` layout. Then the same over 70 days on seed `r`.
- [ ] Write the adversarial cases as their own tests, each of which must fail if the horizon ignores it: a need that crosses zero inside a jump; a season that turns inside a jump; a pit that goes out inside a jump; a thought whose `until` falls inside a jump; a stop set inside a jump (task 9 reads this one again).
- [ ] Build `nextEvent()` and `runTo(t)` as "The skip" says. `nextEvent()` reads the next-act ticks of task 3 and the next-beat ticks of task 2. Nothing in it reads a wall clock.
- [ ] The hazard precondition: a burning tile, or an awake predator within reach of a sleeping or working person, pins the horizon to the next tick. Write the test that a wolf closing on a sleeper is never skipped over, and that its absence is.
- [ ] `runTo` is what the soak, the long run, and `tests/lib/run.js` use. A stepped run stays available and the skip test is what keeps the two honest.
- [ ] **Measure and report, do not decide.** Use two `load()` scopes in one process for the before and after, so the two runs meet the same machine on the same day. Seconds a world day at day 3, day 50, and day 400. Seconds for a 70-day run and for an 800-day run, on one seed and on six. The wall time of `npm run fast` and of the soak. Put the table in the pull request, name the floors that the numbers would let the soak keep, and say plainly which ones still cost more than the budget.
- [ ] Do not remove a floor. Tell dev-coordinator that the floors question is with the user, and carry on with task 5.
- [ ] Gates as task 1, plus `tests/skip.js`. Commit.

### Task 5: Work, sleep, and needs in world time

**Files:** `src/sim/clock.js` (`CLOCK.work`, `CLOCK.task`, `CLOCK.rate` needs), `src/sim/tasks.js` (`workKind`), `src/sim/recipes.js`, `src/sim/species.js` (decay rows), `tests/crafts.js`, `tests/tasks.js`.

- [ ] `workKind`'s `amount` is world time for a person of no skill. `workSpeed` divides it. Progress is elapsed time, so a worker is skipped until the end tick. The spec's values: knap an axe 1 hour, a lean-to 4 hours, a night's sleep 8 hours. The rest of `CLOCK.work` and every recipe keep their world-time meaning of today, rounded to a quarter hour, and the report lists them.
- [ ] Needs decay for each world hour. A person eats three times a day, drinks five, sleeps once. Write those as the test: over three days a fed, watered person's acts fall within one of those counts.
- [ ] `limit.task` becomes 3 days. Report how many tasks the watchdog drops in the long run, before and after.
- [ ] Gates, including `tests/skip.js`. Commit.

### Task 6: Lives, ages, births, and plants

**Files:** `src/sim/beings.js` (`LIFE`), `src/sim/clock.js` (`birth`, `den`, `grove`, `plant`), `src/sim/camps.js`, `src/sim/species.js`, `src/sim/world.js`, `tests/dwellers.js`, `tests/gnomes.js`.

- [ ] `LIFE` in years: human adult 16, old 55, life about 70; rabbit 3, fox 5, wolf 8, deer 12; sprites and gnomes centuries. Ages given at world generation scale with them.
- [ ] Births by ruling 5. Plants by ruling 4.
- [ ] Every test that ages a being sets `born` directly and does not run the years.
- [ ] Gates. Commit.

### Task 7: Chases, embers, brands, and the hazards

**Files:** `src/sim/clock.js` (`chase`, `limit.ember`, `limit.guardEmber`, `party.coalsLast`, `cooldown`), `src/sim/species.js`, `src/sim/tasks.js`, `tests/closing.js`, `tests/dwellers.js`.

- [ ] Chases count tiles run, by ruling 3. An ember lasts 20 world minutes, which is 1,200 tiles and no limit on this map; the long run must show a person bringing fire home. A brand outlasts its chase by a quarter, as today.
- [ ] `cooldown.stalked`: derive it again. A maul takes 20 to 34 hit points; the healing rate is per world hour after task 5; the cooldown is the time to heal the worst maul at middling hardiness, and the test says so in numbers.
- [ ] A chase is a hazard, so it pins task 4's horizon. Check that a chase over a skipping engine and the same chase stepped give the same outcome, and add the case to `tests/skip.js`.
- [ ] The long run shows no death by mauling on seed `r`, and on `birch-crag-41` for 40 days with no fire lit by the player. Report maulings a day against today's.
- [ ] Gates. Commit.

### Task 8: The interface's clock

**Files:** `src/ui/state.js` (`SPEEDS`), `src/ui/main.js` (`acc`, the cap on steps a frame), `src/ui/strip.js` and `src/ui/derive.js` (the date), `src/ui/keys.js`, `src/page.template.html`, `tests/ui.js`. The interface belongs to the feedback-pass session; tell it before this task starts.

- [ ] The ladder: 1, 10, 60 (the default), 600, 3600. The interface owns ticks a second: a speed of `n` is `n` ticks a wall second. At 3600 a world day takes 24 wall seconds. The disabled Days and Seasons rungs of the draft are gone; a ladder cannot reach a year, and task 9 is how the player gets there instead.
- [ ] Above 60 the page advances with `runTo`, not with a loop of `step`, so a quiet stretch costs a frame rather than 600. The cap on steps a frame becomes a cap on milliseconds a frame (8 ms), and the page says "The world cannot keep up at this speed." once when the cap bites for a whole second.
- [ ] The Hour button calls `runTo(tick + 3600)` under the same cap.
- [ ] The date reads "Day 12 of spring, year 1, 14:05". The autosave still writes once a world day, which at 3600 is every 24 wall seconds; move it to a wall-time beat if that is too often, and say which you chose.
- [ ] An age is printed in years, not days. `src/ui/panels.js:98` prints `${c.age} days` and `src/ui/inspect.js:52` prints `${Math.floor(ageDays(a))} days`. At real units a person of 70 reads as 25,550 days.
- [ ] `tests/ui.js`: the ladder, the default, the date string, the age in years, the keys. Gates. Commit.

### Task 9: Playability, the watch list and the filters

**Files:** `src/sim/door.js`, `src/sim/main.js`, `src/sim/core.js` (`log` tags), `src/sim/snapshot.js`, `src/ui/state.js`, `src/ui/panels.js`, `src/ui/derive.js`, `src/ui/main.js`, `src/ui/keys.js`, `tests/door.js`, `tests/ui.js`. Tell the feedback-pass session before this task starts; the chronicle panel is theirs.

This task is ruling 1's substance. Read "The watch list" first.

- [ ] Write the failing tests in `tests/door.js`: a run to a day ahead lands on that day; a run to a day behind is refused with its sentence; a stop on a death fires once, is spent, and writes its line; the same stop set twice clears it; a run and a stop both appear in the door's log, because both are acts.
- [ ] Build `run` and `watch` for the days era, in the shape the ages use. Delete both "waits for the watch list" sentences at `src/sim/door.js:87` and `:98`; a marker comment or a deferring sentence is removed by the task that does the work.
- [ ] A stop is a mark ahead of now: `{ what, at }`. Times are `day`, `season`, `year`. Events are the tags `log` already carries: a death, a birth, a hearth gone out, a person cut off, a newcomer, a goal reached. List the tags the task supports and say which it does not.
- [ ] `runUntil` and `stops` are already in `NOT_SAVED` with the reason "lives only in the ages". That reason is now false. Give them a true one or save them, and say which you chose.
- [ ] A run stops on the first stop reached, clears it, and writes the line that says why. A run interrupted by a stop leaves the world where the stop fired, not where the run was aimed.
- [ ] Task 4's horizon must never jump over a stop. Add the case to `tests/skip.js`: a run to day 30 with a stop on day 12 ends on day 12, skipped and stepped alike.
- [ ] The chronicle's filter: `ui.chronFilter` is `'all'` or `'major'` today. At 86,400 ticks a day that is not enough. Filter by tag and by person, on top of the `ui.chronSearch` that exists. A filter is view state and does not pass the door.
- [ ] The interface: a place to set a stop, a place to see the stops that are set, and a Run button that says where it is running to. A run in progress shows what it is waiting for, and can be stopped by the player.
- [ ] Measure "The player's gate" in full, in a browser on the built page. Put the table in the commit with the numbers you saw, the machine, and the one-minute load average beside each wall time. Paste the chronicle you read on reaching winter. Re-run a miss once under the conditions that section names, and report both numbers. If a row misses twice, say which and by how much; do not round it into a pass.
- [ ] Walk "The prose that states a duration" for rows 7, 8 and 9, which are this task's interface strings. Re-run the sweep command there and report anything it finds that the list does not hold.
- [ ] Gates: `tests/door.js`, `tests/ui.js`, `tests/skip.js`, `tests/snapshot.js`. Commit.

### Task 10: The rest of the tests in world units

**Files:** `tests/crafts.js`, `tests/closing.js`, `tests/gnomes.js`, `tests/dwellers.js`, `tests/wanderer.js`, `tests/snapshot.js`, `tests/door.js`, `tests/tasks.js`, `tests/terrain.js`, `tests/settle.js`.

- [ ] Every step count in a test becomes a call of a unit helper (`api.hours(6)`), and every run length is set by what the test must see, not by a number of today's ticks. The survey's part 5 lists the assertions by file. No assertion is dropped. One that cannot hold at real units within a test's time is reported, not parked.
- [ ] A test that ran long because it waited may now use `runTo`. A test that measures a rule's own behaviour must still step, and must say so.
- [ ] The snapshot oracle's save points move to world times with the same preconditions (someone walking, someone at work, a fire, a den dug after the load).
- [ ] `npm run fast` green, and its seconds reported against today's.
- [ ] Commit.

### Task 11: The tuning pass, the markers gone, and the report

**Files:** `src/sim/clock.js`, `tests/clock.js`, `design/notes.md`, `design/specs/2026-09-18-time-and-tiers-design.md`, `CLAUDE.md`, `design/settings.md`, and `design/reports/2026-09-g4-before-and-after.md` (new).

- [ ] Remove the four markers. `tests/clock.js` fails if one is left in `src/`.
- [ ] Walk "The prose that states a duration" line by line and close every row. Rows 3 to 6 are this task's; rows 7 to 9 were task 8's and are checked again here, because this task moves values that task 8 measured against. Re-run the sweep command in that section on the final build and add whatever is new: the list was swept on cb903eb and it replaced an earlier sweep that had missed two of its nine, so treat it as a floor and not as the whole truth.
- [ ] Tune against the long run on three seeds until a camp's first ten days read as today's do: a fire by day 3, tools by day 5, a shelter by day 7, a newcomer by day 10. Change a value only in the table, and log each change with its reason.
- [ ] **Decide how a tuned value is recorded before tuning starts, not after.** A changed constant is recorded nowhere today. The door log carries acts, and `startWorld(seed, options)` carries the world settings, but a turned knob carries neither. So a run with a tuned value cannot be replayed from its seed and its log, and the project's central guarantee does not reach it. patcher found this while surveying issue 48; it is the suite's problem and it is this task's problem too. A report of prose notes is not a record. **The rule for G4, in two lifetimes.** Try a value by handing a named set to `startWorld(seed, options)`. That is the inner loop, it is cheap, and it needs nothing new: the options record is already part of what a replay reads, so a trial run is reproducible from its seed and its options the moment it is made. Keep the option set beside the run that used it. Then **a value that survives its trials becomes a commit** to `src/sim/clock.js`, and every number in the bless report names the commit it came from, so any line of the report is reproducible from the repository alone. Nothing in G4 changes a constant while a world runs. Issue 48's developer suite works the same way, which patcher confirmed with the user, so this is a description of the tuner's workflow and not a constraint laid on top of it.
- [ ] Write the report: for each seed, today's golden line beside the new three-day line; the long run's counts beside today's at the same world age of the camp; every value whose world-time meaning moved by more than a factor of two, with the reason (ruling 7: big movers are enough); seconds a world day at day 3 and day 50, skipped and stepped; the floors that were suspended, what task 4 measured, and what the user ruled about them.
- [ ] **Sweep `design/notes.md` for durations stated in ticks and rewrite them in world units.** Found by patcher, who checked they are all correct on dev 8ef6e88 and so belong to the plan that makes them false rather than to a bug report. Today it is 13 statements on 12 lines: 41, 43, 44, 90, 106, 127, 142, 143, 144, 153, 175, and 396 twice. Re-grep rather than trust that list; the notes grow. `grep -nE "[0-9]+ ?ticks?" design/notes.md` finds them.
  - **Do line 41 first, and do not treat it as one of thirteen.** Raised by dev-coordinator and carried by patcher. Line 41 reads "1000 ticks per day". It is not an instance of the fault; it is the definition the other twelve are read against. Every other line states a duration in a unit that line 41 gives the size of, so a pass that fixes the twelve and leaves the definition makes the document contradict itself, which is worse than leaving all thirteen stale together. Stale-together is at least a document about the old engine. Half-swept is a document about no engine.
  - This is the same fault the rest of this task is about, one level out: **a sweep defined by what it reads rather than by what must end up true.** A grep for tick counts returns the definition and its consequences in one flat list, in line order, with nothing to say which is which. A line-by-line pass therefore touches them alike and has no reason to do the definition first. Order the work by what depends on what, then read the list.
  - **One call for all of them: world units in the prose, never a raw tick count.** The notes are a document, so a reader cannot follow `CLOCK.den.campDark` to its value the way a reader of the code can. "Half a day" survives a retune and means something on the page; a constant's name means nothing to somebody reading the design. Where the exact value matters to a rule, the code holds it.
  - Line 144 is `digRetry`, the constant this plan deliberately does not convert. Note that the prose and the constant answer to different rules: the prose must be true and readable now, and the constant carries a decision task 6 owes it.
  - The "Left for the retune (G4)" list at line 396 is a marker in prose. Every entry it holds is this plan's work, so it goes when the work is done, by the rule above. Do not leave it describing faults that are fixed.
- [ ] Why task 11's other sweep does not reach this, and what to do about it. The lint reads rules and not strings. The prose sweep above reads strings in `src/` and not documents. Each is narrower than its name, and the same thing falls through both: a correct number in prose that no constant governs. That is how issue 37 happened. Say in the report whether a third gap is left, and where.
- [ ] The notes gain a section on the real clock and the skip, the spec gains "As built (G4)", and `CLAUDE.md`'s soak paragraph says three days and `LONG=1`.
- [ ] Watch the hermit rule. The branch in `src/sim/camps.js` that fires when one person is left holds on zero ticks of all six seeds for 70 days today, measured by dev-coordinator, and every seed does fall to one living person. The hearth condition is the only thing that prevents it. This retune changes when a pit goes out, so the rule can start to fire. Report it in the long run if it does. Issue 25 landed at 7c62d70 before this plan starts, by dev-coordinator's ruling, so read the rule under its new name and expect a second camp to be founded rather than the old false line to be printed.
- [ ] Watch `theLoneFounder` for an unbounded retry, and read this before you chase a slow seed. Issue 25 left a known path that patcher flagged rather than buried: if no candidate ground can be reached from any edge of the world, the rule falls through without clearing `doomAt`, so it retries every tick. Each retry makes a fresh camp record, calls `setSite`, and runs a full `reachable()` flood fill for every candidate, while `nextId` climbs by one a tick forever. It cannot be reached on any soak seed today. It belongs to this plan because the retune changes when a pit goes out, which is what decides whether the outer rule fires at all. If it starts firing under G4 and a seed has a walled-off founding site, **this presents as a performance regression and not as a logic fault**, so anyone chasing a slow seed will read the tick loop and not a founding rule. dev-coordinator asked patcher to close it with a one-line fix before task 1, so it should be gone by the time you read this. Check that it is. If the fix slipped, this note is the diagnosis, and a slow seed with a climbing `nextId` is the symptom to look for.
- [ ] Measure "The player's gate" again on the final build, because task 11 moves values that tasks 8 and 9 measured against. The same rule on load averages and on re-running a miss once.
- [ ] Tell dev-coordinator before the pull request opens, not after. dev-coordinator will not merge G4 on a routine gate pass, and this is right: the merge changes what the published game is, and the moment of that change is the user's to pick, not a coordinator's and not mine. The standing rule covers landing work in dev; it does not cover changing the character of a live site.
- [ ] Do not bless. Open the pull request with the report, and tell dev-coordinator that it waits for the user on two counts: the golden, and the timing of the release.

**An option, not a task.** Nothing catches prose that states a duration. `tests/clock.js` reads rules, not strings, so issue 37 and the strings above all passed it. A lint that flags a number word beside "day", "days", "winter" or "year" in a player-facing string would have caught all of them. It would also be noisy. Offer it to the user with the report; do not build it inside G4.

**Related, and not a G4 deliverable.** The user has asked for a local developer suite site: tabs for tweaking, review, knobs, name pools and text synthesis, and access to the simulation's internals. patcher is filing the issue. It overlaps task 11's knob tuning. Read it when it lands; do not absorb it.

## Self-review

| Spec line or ruling | Task |
|---|---|
| A tick is a world second, a day 86,400, a year 365 with seasons 91, 91, 91, 92 | 1 |
| Walking a tile a tick, a run two | 1 |
| Cellular systems once a world minute | 2 |
| Camp rules as rates an hour, rolled at the step | 2 |
| Needs an hour; work in world time; an axe 1 hour, a lean-to 4, sleep 8 | 5 |
| Lives in years | 6 |
| The reshaped tick soak; a world day under 5 s | 1, 3 |
| Blessed once | 11 |
| Ruling 1: G4 reaches dev playable | 8, 9 |
| Ruling 2: tick speed is variable and effectively unlimited | 4 |
| Ruling 2: the floors are measured before they are moved | 4, then the user |
| Ruling 7: the report shows the big movers | 11 |

Not in G4: the day tier, the day soak and its floors, calibration between tiers, the rates table, and zoom. They are G5 and G6.
