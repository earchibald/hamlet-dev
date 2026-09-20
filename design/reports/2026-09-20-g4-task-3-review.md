# G4 task 3 review: the head off the tick

The task review of task 3 on branch `tiers-g4`, worktree `/Users/earchibald/Worktrees/hamlet-g4`.
A fresh implementer wrote the task. This reviewer wrote none of it.

The implementer's report is unusually honest. It names two of its own process mistakes, one control
that came back blind, and two cache keys that rest on an argument rather than on a red test. This
review confirms most of its numbers and disagrees with three of its conclusions.

## The findings

| # | Grade | What | Where | Owner |
|---|---|---|---|---|
| 1 | Critical | `setClock` credits a jump as work done. A one-hour jump takes a job's progress from 1.1280 to 4061.9280. `CLAUDE.md` and the function's own comment both state it writes two things and no others, and that the world arrives as it stood. | `/Users/earchibald/Worktrees/hamlet-g4/tests/lib/run.js:94` | before task 4 |
| 2 | Major | The kept threat list is guarded by nothing. Its tick key can be deleted and the thirteen lazy tests stay green and the six-seed soak stays green, records and all. | `/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js:275` | task 4 |
| 3 | Major | The budget test asserts nothing above load average 2 and reports a **pass**, not a skip. An impossible budget of 0.0001 s still passes. The guard rises with the quantity it guards. | `/Users/earchibald/Worktrees/hamlet-g4/tests/beings-lazy.js:349` | task 4 |
| 4 | Major | Five suites that exist on dev do not exist on this branch, so they have never run against G4's clock. | `/Users/earchibald/Worktrees/hamlet-g4/package.json` | the merge |
| 5 | Minor | The new waking is player-visible for a person only. A gnome, a rabbit or a deer roused by a person or a hunter gets no thought and no line. | `/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js:572` | task 4 |
| 6 | Minor | `senseBeings` builds `movers` once and then invalidates it inside its own loop, by waking a sleeper and by killing a being. | `/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js:567` | task 4 |
| 7 | Minor | The report's stated cause for `campsThatSawGnomes` 0 to 1 is wrong. Traced here. It is one encounter a seed, not a rate change. | `/Users/earchibald/Worktrees/hamlet-g4/design/reports/2026-09-20-g4-task-3-the-head-off-the-tick.md:196` | nobody |
| 8 | Note | Three numbers in the report do not match a re-run: clock 21 against 22, the soak's 8 skips unstated, day 3 quoted at 3.05 s where the report's own table's best row is 3.33 s. | the report | task 11 |
| 9 | Note | The clock lint catches a bare literal in a duration argument but not a bare tick count returned from a function. | `/Users/earchibald/Worktrees/hamlet-g4/tests/clock.js` | task 10 |
| 10 | Note | `SNAPSHOT_VERSION` at 2 is safe today, and the reason expires at the merge. | `/Users/earchibald/Worktrees/hamlet-g4/src/sim/snapshot.js:13` | task 11 |
| 11 | Note | `CLAUDE.md`'s test list names neither `tests/beats.js` nor `tests/beings-lazy.js`, nor five other suites that exist. | `/Users/earchibald/Worktrees/hamlet-g4/CLAUDE.md:16` | task 11 |

Confirmed sound, with the method beside each: the reference oracle is independent and can fail; the
plan asks for the sleeper's waking and gets it; the five-tile figure breaks no rule; the snapshot
suite is red on both sides of task 3; the test tree holds no orphan suite; `beats.js` passes at task 2's
own commit; the commit messages tell the truth. Each is written up below.

## The gates

Every number here is this reviewer's own run in `/Users/earchibald/Worktrees/hamlet-g4`, at HEAD
`0db105d`, on a machine whose one-minute load average ran between 3.4 and 6.2 through the work.

| gate | result |
|---|---|
| `node build.js` | built 696,925 bytes. `git status --porcelain` stayed empty, so `dist/hearth-sim.html` is byte-identical to the committed one |
| `npm run fast` | 352 tests, 346 pass, 0 fail, 6 skipped |
| `node tests/soak.js` | 73 tests, 65 pass, 0 fail, 8 skipped |
| `node --test tests/clock.js` | 22 tests, 22 pass, 0 fail |
| `node --test tests/snapshot.js` | 1 test, 0 pass, 0 fail, 1 skipped |
| `SLOW=1 node --test tests/snapshot.js` | 49 tests, 38 pass, 11 fail |
| `node --test tests/beings-lazy.js` | 13 tests, 13 pass, 0 fail |
| `tests/soak-golden.json` md5 | `1e1248d47dd2aabc9d430fd49275c665`, the value the brief names |

### The skipped files, and why each skips

The six skips in `npm run fast` are the six files task 1 suspended. Each prints its own reason, and
each reason is quoted from the file rather than from the implementer's report.

Method: `grep -l "is suspended" tests/*.js` names seven files, of which `tests/soak.js` is not in `fast`,
leaving exactly six. Each guards itself with `SUSPENDED_FOR_G4 = process.env.SLOW ? false : '<reason>'`.

| file | the reason it prints |
|---|---|
| `tests/gnomes.js` | asks for 70 world days at about 15 s a day, not dev's 0.31 s. `SLOW=1` runs it. Task 4 restores it |
| `tests/names.js` | asks for 202 world days, 342 under `SLOW=1`, at about 15 s a day. Task 4 restores it |
| `tests/settle.js` | asks for 50 world days at about 15 s a day. Task 4 restores it |
| `tests/snapshot.js` | asks for 40 world days at about 15 s a day. `SLOW=1` runs it. Task 4 restores it |
| `tests/ui.js` | asks for 25 world days at about 15 s a day. `SLOW=1` runs it. Task 4 restores it |
| `tests/wanderer.js` | asks for 493 world days across 15 runs at about 25 s a day. `SLOW=1` takes hours |

So `tests/crafts.js` is **not** suspended; it runs in full. The table above corrects a guess this
reviewer made before measuring.

The soak's 8 skips are its two 70-day floors, suspended pending task 4, and six "not the default run"
guards. The implementer's report gives the soak as "65 pass, 0 fail" and does not state the 8.

## 1. Critical: `setClock` credits a jump as work done

`/Users/earchibald/Worktrees/hamlet-g4/tests/lib/run.js:94`.

```
function setClock(api, at){
  api.tick = at;
  for (const b of api.beings) b.seen = at;
  return at;
}
```

Task 3 made a job accrue work from elapsed time.
`/Users/earchibald/Worktrees/hamlet-g4/src/sim/tasks.js:124`:

```
const ran = t.worked === undefined ? 1 : Math.max(1, tick - t.worked);
```

`setClock` writes `seen` and not `worked`, so a jump leaves `worked` in the past and the next look
credits the whole gap.

**Method.** A world on seed `r`, a person started on `setSnare`, walked to the tile and given one tick
of work. Then the clock jumped by `setClock` and the being looked at once. The script is
`/tmp/g4c-exp/exp-worked.js`, run against a `git archive` of HEAD so the worktree was never touched.

| jump | `worked` | `tick` | progress before | progress after |
|---|---|---|---|---|
| 0 ticks | 118815 | 118815 | 1.1280 | 2.2560 |
| 3,600 ticks (one world hour) | 118815 | 122415 | 1.1280 | **4061.9280** |
| 86,400 ticks (one world day) | 118815 | 205215 | 1.1280 | **the job finished** |

4061.9280 is 3,600 times one tick's 1.1280. The jump was credited tick for tick as work.

**Why this is Critical and not Major.** The defect is a false claim written into `CLAUDE.md`, and
three later tasks are told to build on it. `/Users/earchibald/Worktrees/hamlet-g4/CLAUDE.md:15` says
the function "writes two things", and `tests/lib/run.js:82` says "A jumped clock means the world
arrives at that date as it stood." Neither is true for a being that holds a job. Twenty-one jumps in
`tests/closing.js` and `tests/dwellers.js` already ride on the claim, which this review confirmed by
count: 11 call lines in `closing.js` and 10 in `dwellers.js`. The implementer's own note 2 hands task 4
twelve more jumps in `tests/gnomes.js` and five in `tests/ui.js` and `tests/names.js`, to be routed
through the same function. Each of those will silently finish whatever job the being held.

**What is sound.** A cooldown, a thought's `until` and a plant's `planted` are absolute ticks, so a
forward jump expires them, which is what an arrived world would also have done. Those need no write.
Two task fields do need a decision. `t.waitUntil` in the past forgives a wait. `t.worked` in the past
charges work nobody did. The first is arguable and the second is not.

**A second gap, not demonstrated as harmful.** `setClock` does not write `a.next`, so after a jump
every being is owed an act and all of them act on the same tick. An arrived world spreads `next`
across the body beat. This changes which being acts first and so the order of the random stream, but
this reviewer found no test that reads it, and reports it as a difference rather than as a fault.

**Should it write the field or refuse?** Refusing is the stronger answer, because the list of stale
fields will grow with every task that puts a tick on a record. `setClock` cannot enumerate them, and
the function that tries will be wrong one task later. A refusal to jump while any being holds a task
with a tick in it makes each such test say what it wants out loud. Writing `t.worked = at` alongside
`b.seen = at` is the smaller change and closes the measured hole. This review does not choose; task 4
or the coordinating session does.

## 2. Major: the kept threat list is guarded by nothing

`/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js:275`.

```
let threatSources = [], threatSourcesAt = -1, threatSourcesOf = null, threatSourcesLen = -1;
function sourcesNow(){
  if (threatSourcesAt !== tick || threatSourcesOf !== beings || threatSourcesLen !== beings.length){
```

The comment above it enumerates four ways the list can go stale and names the key that catches each.
The fourth reads "the tick moving on / the list is rebuilt". The list is load bearing: the report
says task 3 misses its budget without it.

**Method.** The tick key was deleted in a `git archive` copy of HEAD at `/tmp/g4c-head`, leaving only
the array identity and the length. Then the two checks that could plausibly hold it were run.

| check, with the tick key deleted | result |
|---|---|
| `node --test tests/beings-lazy.js` | 13 pass, 0 fail, 0 skipped |
| `node tests/soak.js`, the full six seeds | 65 pass, 0 fail, and all six "the run matches the golden record" green |

So the list is now rebuilt only when `beings` is replaced or grows, it can therefore be a whole day
stale, and the repository is silent. The working record did not move, which is the sharper half of the
result: the fingerprint is the branch's between-task gate and it does not see this.

**What this review could not find, and looked for.** No production path was found that makes the list
stale under the shipped three keys. A being's `species` is never reassigned anywhere in `src/` — the
only assignment in the tree is `tests/snapshot.js:627`, a loader-rejection fixture. The only two
removals from `beings` are `src/sim/main.js:88` and `src/sim/settle.js:99`, and both replace the array
rather than splice it, so the identity key catches them. `fox` and `wolf` both carry `hunter: true` at
`src/sim/species.js:10` and `:11`, and no other species does, so the filter selects exactly the three
species the six branches read. The cache looks correct.

**So the finding is not that the cache is wrong. It is that its correctness rests on an enumeration
in a comment, and the enumeration's own fourth row is a claim no test in the repository holds.** The
implementer said as much for two of the three keys. This measurement extends it to the third and shows
that the soak does not cover the gap either. Task 4 lengthens a stretch past a world minute, which is
exactly the change that would turn a day-stale list into a wolf nobody saw.

## 3. Major: the budget test cannot fail

`/Users/earchibald/Worktrees/hamlet-g4/tests/beings-lazy.js:349`.

```
if (load1m > 2){
  console.log(`    the budget is not asserted at a load average of ${load1m.toFixed(2)}: ...`);
  return;
}
assert.ok(secs < 5, ...);
```

**Method.** In the `/tmp/g4c-head` copy the budget was changed from `secs < 5` to `secs < 0.0001` and
the file was run.

```
    day 3 on seed r: 3.40 s, one-minute load average 3.86
    the budget is not asserted at a load average of 3.86: run it again on a quiet machine
✔ a world day at day 3 costs under five seconds
ℹ pass 13   ℹ fail 0   ℹ skipped 0
```

Three separate things are wrong with this, and they compound.

**The guard rises with the quantity it guards.** Load average and wall seconds move together. The
assertion therefore stands down in precisely the condition that would make it fail. This is the
pattern the plan's own "check a change cannot run on itself" section describes, and the project memory
records as "a guard derived from the measured quantity disarms on the change it reports".

**It reports a pass, not a skip.** `ctx.skip()` is available and the same file already uses it at line
287. A bare `return` leaves a green tick and a suite count of 13 pass, 0 skipped, so nothing in the
suite's numbers records that the budget went unmeasured. A reader of `npm run fast` sees a named
budget gate that held.

**On this machine the assertion is effectively dead.** Every load average this reviewer observed
across the whole review ran from 3.4 to 6.2, on a machine that carries several agent sessions. The
implementer's own seven-row budget table has no row at or below 2. The test has, to this reviewer's
knowledge, never asserted anything.

The implementer's stated reason — PR 31 removed this repository's one wall-clock assertion, and a red
gate under parallel load teaches everyone to re-run a red gate — is a good reason not to assert. It is
not a reason to name the test after an assertion it does not make. A skip states the same thing
honestly and costs nothing.

**The number itself is sound.** This reviewer's own re-measurement of the plan's day-3 budget, by the
test's own harness, is **3.40 s at load average 3.86**, against the implementer's 3.05 s at 4.36. The
budget is 5 s and day 3 meets it. Two independent measurements agree.

**On the day-50 miss.** The method attributes it fairly. Seconds a person a world day is 0.53 at day
10, 0.19 at day 25, 0.28 at day 40 and 0.22 at day 50, which is flat from day 25 on, so the rise from
5.88 s to 17.98 s tracks the population and not the body. The report calls it missed rather than
explaining it away, and hands task 4 the per-person figure. That is the right handling. Day 50 was not
re-run here.

## 4. Major: five suites on dev do not exist on this branch

Method: `git ls-tree -r --name-only 812dde0 tests/` in `/Users/earchibald/Code/hamlet`, read only, against
`find tests -name '*.js'` in the worktree.

Under `tests/` **recursively**, dev at `812dde0` holds 29 `.js` files and `tiers-g4` at HEAD holds 24.
The seven that dev has and this branch does not:

| file | kind |
|---|---|
| `tests/garden.js` | suite |
| `tests/itemgrid.js` | suite |
| `tests/reachable.js` | suite |
| `tests/stalk.js` | suite |
| `tests/types.js` | suite |
| `tests/perf/measure.js` | tool |
| `tests/perf/draw-harness.js` | tool |

Five suites have therefore never run against G4's rebased clock. This branch predates them and it is
not task 3's doing. It is recorded here because a merge into dev is a release to the public site, and
because `tests/types.js` in particular is the only thing that holds `src/sim/`'s annotations, which
task 3 changed by adding `seen`, `next`, `waitUntil`, `due`, `worked` and a thought's `until`. There is
no `tests/perf/` directory on this branch at any depth.

## 5. Minor: the new waking is visible for a person only

`/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js:572`.

```
if (a.asleep){
  catchUp(a);
  if (!a.alive) continue;
  a.asleep = false;
  if (a.species === 'human') addThought(a, 'woken', 'Woke in the night to something moving', -6, CLOCK.thought.woken);
}
```

`rousedBy` at line 549 rouses an animal too: a hunter rouses anything but its own kind, and a person
rouses every animal. A gnome, a rabbit or a deer pulled out of sleep gets no thought, no chronicle
line, no goal state and no tooltip row. The project rule says every new behaviour must be visible to
the player, and rousing an animal is new behaviour: the old head returned at the sleep check before it
ever looked. The letter of the rule is not met for four species out of five.

**The human half is correct, and the plan asks for it.** The plan's task 3 says "A sleeper with a wolf
at 5 tiles wakes on that tick" in as many words, so the behaviour is asked for and not invented.

**Method for the behaviour itself.** A person asleep by a lit pit at 23:00, a wolf pinned at a fixed
distance, 200 ticks, in `/tmp/g4c-exp/exp-wolf2.js`:

| wolf at | person acted on | `threatsFor` saw it | fled | `woken` thought | `sawwolf` thought |
|---|---|---|---|---|---|
| 1 tile | 12 of 200 ticks | yes | yes | yes | yes |
| 2 tiles | 12 of 200 | no | yes | yes | yes |
| 3 tiles | 12 of 200 | no | yes | yes | yes |
| 4 tiles | 1 of 200 | no | no | yes | no |
| 5 tiles | 1 of 200 | no | no | yes | no |
| 6 tiles | 4 of 200 | no | no | no | no |

So the waking works, and at 4 and 5 tiles it is a thought and nothing more, because `threatsFor`'s
human branch reads a wolf at 3 tiles or nearer. That is coherent rather than wrong: the person stirs,
finds nothing, and goes back to sleep. One consequence is worth a line. While the wolf stays within
five tiles the `woken` thought is refreshed every tick, so `CLOCK.thought.woken` of half a world hour
never expires and the mood penalty of −6 becomes permanent instead of temporary. Over 1800 ticks with
a wolf held at four tiles the person still slept and rest still rose from 10.0 to 13.7, so this is not
insomnia. It is a mood tax that outlives its stated duration.

**The five-tile figure and the waking delay.** `const SENSE = 5` at `src/sim/beings.js:545` is a module
constant, not a `CLOCK` entry. That breaks no rule: the project rule and `tests/clock.js`'s lint govern
a duration or a rate, and five tiles is a distance. It sits beside `FREEZING = 20` and `WAKE_LIGHT = 60`
in the same file, which is the file's existing habit. The waking delay is `CLOCK.thought.woken = mins(30)`
at `src/sim/clock.js:285`, which is in the table, written in a unit helper, and carries its own comment.

**The lint was tested rather than trusted**, in the `/tmp/g4c-exp` copy:

| plant | `node --test tests/clock.js` |
|---|---|
| none (control) | 22 pass, 0 fail |
| `CLOCK.thought.woken` replaced by a bare `1800` | **20 pass, 2 fail**: "no rule holds a bare time literal" and "every entry of the table is read by a rule" |
| `return CLOCK.every.body` in `nextAct` replaced by `return 60` | 22 pass, 0 fail |

So the lint holds the waking delay, and finding 9 records what it does not hold.

## 6. Minor: `senseBeings` invalidates its own list inside its own loop

`/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js:567`.

```
if (movers === null) movers = beings.filter(b => b.alive && !b.asleep && (SPECIES[b.species].hunter || b.species === 'human'));
```

`movers` is built once per call. Two things inside the same loop then contradict it. A sleeper woken at
line 574 becomes a qualifying mover, and is absent from `movers` for every being considered after it.
A being killed by the `catchUp` at line 571 stops qualifying, and stays in `movers` for every being
considered after it.

The pass is deterministic, so this is not a reproducibility fault and it moves no random number. It
does mean that whether a woken person rouses the animal beside it on the same tick depends on the
order of the `beings` array. The comment above the function says the pass "decides nothing"; it does
decide the truth of its own list. Recorded so that task 4, which reads this predicate as the skip's
horizon, knows the list is a snapshot of the tick's start and not of the tick.

## 7. Minor: the gnome sighting traced, and the report's cause is wrong

The implementer flagged `campsThatSawGnomes` 0 to 1 on `gamma` and `delta` and left it as a
hypothesis: a person roused at night by a wolf is awake and outdoors, which is the sighting's
precondition. This review traced it. **The hypothesis is wrong.**

**Method.** Three world days on each seed, the soak's own pit-lighting god, at HEAD and at a `git archive`
of `f8c7c71`, in `/tmp/exp-gnomedist.js` and `/tmp/g4c-exp/exp-gnome.js`.

**What was ruled out, and how.**

The sighting rule did not change. `git show f8c7c71:src/sim/beings.js` line 356 holds the predicate
byte for byte as `src/sim/beings.js:589` holds it now, hour guard included. Task 3 moved when it runs
and changed nothing about what it asks.

The seer was not roused. On both seeds the camp learns of the gnomes at night with the seer awake and
carrying no `woken` thought: `gamma` at tick 184866, hour 03:35, seer Bram; `delta` at tick 191059,
hour 05:07, seer Mott. The report's chain requires a roused sleeper and there is none.

The gnome was not roused from sleep either. Gnomes spend **0.0 percent** of a three-day run asleep,
before task 3 and after, across 1,555,200 gnome ticks on `gamma` and 1,296,000 on `delta`. There was
no sleep for the pass to interrupt.

Gnome travel did not change systematically. Tiles stepped by gnomes over three days moves from 178,307
to 146,954 on `gamma` and from 94,370 to 111,660 on `delta` — down 18 percent on one seed and up 18
percent on the other. A change in the same direction on both seeds would have been a mechanism; opposite
directions are noise.

The proximity pass is not the cause. With `SENSE` set to 0, so that nothing is roused at all, the
qualifying gnome-person night pairs do not return to zero: `gamma` 359 to 144 and `delta` 200 to 300.
Disabling the suspected cause does not restore the old figure.

**What it is.** One encounter a seed. Before task 3 the closest an awake gnome ever came to an awake
person at night over three days was 7 tiles on `gamma` and 24 tiles on `delta`, with zero pairs inside
the rule's 6. After task 3 a gnome reaches 0 tiles on both, and the pairs inside 6 number 359 on
`gamma` and 200 on `delta`. Three hundred and fifty-nine person-ticks is about six minutes of world
time: it is one gnome loitering near one person, not a change of rate.

**And the direction argument does not apply.** The report reasons that moving the sighting off the tick
should make it rarer. It would, if the rule were rate-limited. It is not. An encounter lasts hundreds
of ticks and the rule needs one hit, and a person acts at least once every world minute because
`CLOCK.every.body` caps `nextAct`. So an encounter of 359 ticks offers at least five chances where one
suffices, and the lost chances were chances the rule never needed. Whether the encounter happens at all
turns on the shifted stream, and on `gamma` it was one tile short before.

So: not a defect, and nothing for a later task to fix. Recorded because the report asks the next
session who meets odd gnome behaviour to start from a hypothesis that does not hold.

## The reference oracle in `tests/beings-lazy.js`

Three questions, three answers.

**Is the reference independent?** Yes. `refTick` at
`/Users/earchibald/Worktrees/hamlet-g4/tests/beings-lazy.js:35` transcribes the old head and calls
none of `catchUp`, `bodyStretch` or `bodyBreak`. It reads the shared helpers — `api.CLOCK`,
`api.SPECIES`, `api.isNight`, `api.seasonOf`, `api.stage`, `api.tileAt`, `api.pitLit`, `api.nearAt`,
`api.hasTile`, `api.weather` — which are the inputs to the code under test and not the code itself.
`twin(a)` at line 84 copies the body into an object that shares nothing with the being. The world is
held still while both sides run, as the header claims. This is a genuine independent copy.

**Can each of the thirteen fail?** Three faults were planted in `/tmp/g4c-head`, one at a time, each
restored before the next:

| plant | red |
|---|---|
| the dawn and dusk break deleted from `bodyBreak` | 1: "a person asleep eight hours by a lit pit, across a dawn, agrees with the tick-by-tick head" |
| the need-reaches-zero break deleted from `bodyStretch` | 1: "a person who starves to zero food inside the stretch agrees with the tick-by-tick head" |
| `SENSE` set to 0 | 1: "a sleeper with a wolf five tiles off wakes on that tick" |

Each plant put exactly one test red and left twelve green, which is what a targeted suite should do.
The implementer's own control table reports two red per plant; this reviewer measured one. The
difference is not important and the direction is the same: the reference disagrees when `catchUp` is
wrong. The fourth plant, the cache key, is finding 2 and put nothing red.

**Is a tolerance or a guard computed from the quantity under test?** The `1e-6` is a fixed literal at
line 93 and is not derived from anything measured. The `1e-9` at lines 264 and 291 is the same. The one
guard that is derived from its own measurement is the budget test's load average, which is finding 3.
One `ctx.skip()` at line 285 is a genuine precondition — no passable tile five tiles from the work —
and is not derived from a measurement.

**One limit, named by the file itself.** `sameBody` at line 95 compares a thought by key and value and
not by its remaining life, because the reference keeps `left` and the being keeps `until` and the two
cannot be compared directly. The header says so and a separate test, "a thought ends at its until",
pins the timing. This is handled honestly.

## The snapshot suite: the control checked independently

The implementer's claim is 38 pass and 11 fail under `SLOW=1`, identically on the source before task 3.

**Method.** This reviewer did not check out anything. `git archive f8c7c71 | tar -x -C /tmp/g4c-pre3`
produced the pre-task-3 tree, and `SLOW=1 node --test tests/snapshot.js` ran there and in the worktree.

| tree | result |
|---|---|
| `f8c7c71`, before task 3 | 49 tests, 38 pass, 11 fail |
| HEAD `0db105d` | 49 tests, 38 pass, 11 fail |

**The eleven failing names are the same set on both sides**, compared by `diff` of the two sorted
lists of `✖` lines: identical, no line added and none removed. The implementer's claim is confirmed by
an independent method — the implementer rebuilt a checkout, this reviewer ran a `git archive` copy in
`/tmp`, so the worktree was never touched on either side.

The eleven at `f8c7c71`:

```
a grove that burnt out under its sprites keeps its name, held against the grove the sprites share
a grown valley of the default size, saved late, runs on as the straight run does
a named grove that no list and no being holds any more saves, loads, and keeps its text taken
a world that digs a wolf den after the load runs on as the straight run does
a world whose hollow pine burned out under its sprites saves, loads, and runs on
a world with every kind of name, saved, loaded, and run on, names as the straight run does
a world with pitfalls in it round-trips and keeps each pitfall in its tile
seed alpha: saved at step 20000, loaded, and run on, the story is the straight run's
seed gamma: saved at step 30300, loaded, and run on, the story is the straight run's
seed r: saved at step 12400, loaded, and run on, the story is the straight run's
seed x: saved at step 12400, loaded, and run on, the story is the straight run's
```

Nothing was fixed. Task 4 owns the conversion, as the report says.

## `SNAPSHOT_VERSION` stays 2

Safe today. The judgement rests on two searches, both run in the worktree.

No saved artefact holds a thought's `left`. `grep -o '"left"'` over `tests/soak-golden.json`,
`tests/soak-working.json`, `tests/calibrate-beats.json` and `tests/names-layout.json` returns nothing,
and no other `.json` under `tests/` exists.

Nothing reads a thought's `left` any more. `grep -rn "\.left" src/` returns only DOM geometry in
`src/ui/actions.js`, `src/ui/windows.js` and `src/ui/inspect.js`, and `t.left` in `src/sim/gods.js:174`
and `:175`, which is a god's task step count and not a thought.

So a version-2 save that holds `left` exists nowhere in the repository, and the implementer's reason —
version 2 has never left this branch — holds while the branch is unmerged. The reason expires at the
merge, because a merge into dev publishes the page within minutes and a player's save written from a
version-2 build would then exist outside the branch. Task 11 should either raise it to 3 at the merge
or record that no version-2 build was ever published. This is a Note and not a Major because the
consequence the implementer names is small and correct: a loaded pre-task-3 save loses its thoughts and
nothing else.

## The test tree, walked recursively

`find tests -name '*.js' -type f` at any depth, at HEAD `0db105d`. **24 files under `tests/`
recursively**, in two directories, `tests` and `tests/lib`. `package.json` was read from the commit
with `git show HEAD:package.json` and not off disk. A file is a suite if it loads `node:test`.

| on disk | suite or tool | named by `npm run fast` | named by any script | state |
|---|---|---|---|---|
| `tests/ages.js` | suite | yes | yes | named suite |
| `tests/beats.js` | suite | yes | yes | named suite |
| `tests/become.js` | suite | yes | yes | named suite |
| `tests/beings-lazy.js` | suite | yes | yes | named suite |
| `tests/chronicle.js` | suite | yes | yes | named suite |
| `tests/clock.js` | suite | yes | yes | named suite |
| `tests/closing.js` | suite | yes | yes | named suite |
| `tests/crafts.js` | suite | yes | yes | named suite, skips internally |
| `tests/door.js` | suite | yes | yes | named suite |
| `tests/dwellers.js` | suite | yes | yes | named suite |
| `tests/field.js` | suite | yes | yes | named suite |
| `tests/gnomes.js` | suite | yes | yes | named suite, skips internally |
| `tests/gods.js` | suite | yes | yes | named suite |
| `tests/lib/run.js` | tool | no | no | out of scope |
| `tests/names.js` | suite | yes | yes | named suite, skips internally |
| `tests/options.js` | suite | yes | yes | named suite |
| `tests/settle.js` | suite | yes | yes | named suite |
| `tests/snapshot.js` | suite | yes | yes | named suite, skips internally |
| `tests/soak.js` | suite | no | yes, by `test`, `soak`, `soak:quick`, `bless` | named suite, correctly outside `fast` |
| `tests/tasks.js` | suite | yes | yes | named suite |
| `tests/terrain.js` | suite | yes | yes | named suite |
| `tests/trace-deaths.js` | tool | no | yes, by `trace` | out of scope |
| `tests/ui.js` | suite | yes | yes | named suite, skips internally |
| `tests/wanderer.js` | suite | yes | yes | named suite, skips internally |

**Named by a script but missing from disk: none.** Every `tests/*.js` path in `HEAD:package.json`
resolves to a file.

**Orphan suites at HEAD: none.** This is the clean result the brief asked for and it is worth stating
plainly, because the branch's habit would predict otherwise.

**The one orphan that existed, confirmed.** `git show dabe8a3:package.json` shows `tests/beats.js`
absent from `fast`. Task 2 wrote the file at `dabe8a3` and never named it, so task 2's "fast is green"
gate never ran it. Task 3 named it, at `5599b67`, together with its own `tests/beings-lazy.js`, which
was named from birth.

**Would it have passed at task 2's own commit?** Yes. `node --test tests/beats.js` in a `git archive`
of `dabe8a3` at `/tmp/g4c-t2` gives **6 tests, 6 pass, 0 fail** in 65.5 s. It passes now too, inside
the `fast` run above. So task 2's gate verified nothing and also concealed nothing. The fault was real
and its cost this time was zero.

## The plan's checkboxes and the commit messages

The four checkboxes of task 3 are marked `[x] [x] [x] [~]`. Each one's note is accurate against the
change. The fourth is correctly `[~]` and not `[x]`: it says `tests/snapshot.js` was suspended by task
1 and not run, and names the soak's oracle as the snapshot gate that did run. That is the honest mark.

The plan's summary-table row for task 3 was edited to carry the two budget figures. That is a plan
document recording a measured result, which the plan's own shape invites.

**The commit messages tell the truth.** Each was read against its own `git diff --stat`.

| commit | claim checked | verdict |
|---|---|---|
| `a8dcbee` | "Twenty-one jumps in `tests/closing.js` and `tests/dwellers.js` go through the function" | holds. 11 call lines in `closing.js`, 10 in `dwellers.js` |
| `a8dcbee` | writes `CLAUDE.md` beside the rule it bends | holds, and ruling 8 requires it. The content of what it wrote is finding 1 |
| `cb7ceee` | the source change, with `dist/hearth-sim.html` rebuilt in the same commit | holds. `node build.js` reproduces the committed bytes |
| `5599b67` | the reference and `package.json` only | holds |
| `ae973bf` | `tests/soak-working.json` only, 59 lines each way | holds. `tests/soak-golden.json` is not in the diff |
| `74eaf38` | the plan and the report only | holds |
| `0db105d` | the control's numbers | holds. Independently reproduced above |

One message states a cause that this review disproves: `ae973bf` gives the roused sleeper as the
likely chain for `campsThatSawGnomes`, and labels it "Untraced". The label is honest and the cause is
wrong. Finding 7.

## Three numbers in the report that a re-run does not match

Small, and worth correcting before task 11 quotes them.

| the report says | a re-run says |
|---|---|
| `node --test tests/clock.js` 21 pass | 22 pass |
| `node tests/soak.js` 65 pass, 0 fail | 65 pass, 0 fail, **8 skipped** |
| day 3 at 3.05 s, in the top table and in the plan's checkbox | the report's own budget table's best row is 3.33 s; this reviewer measured 3.40 s at load 3.86 |

The day-3 figure is not a contradiction: 3.05 s is one row of the seven-row day-by-day table and 3.33 s
is one row of the four-row before-and-after table, taken at a different moment. But quoting the single
best of seven into the plan's permanent checkbox overstates it. The honest summary is "3.0 to 4.2 s
across five measurements at load averages from 2.3 to 9.8, against a 5 s budget", which is what the
report's own prose says and its headline does not.

## What the clock lint does not hold

Finding 9, with its method in finding 5's table. A bare literal passed as a duration argument is
caught. A bare tick count returned from a function is not: `return 60` in place of
`return CLOCK.every.body` leaves `tests/clock.js` at 22 pass, 0 fail. `nextAct` and `bodyBreak` are
new and are full of tick arithmetic, so the gap is larger after task 3 than before it. Task 10 owns
the lint. This is a Note and not a Major because no bare count was actually left behind: every
duration this task added reads `CLOCK`.

## `CLAUDE.md`

Task 3 was right to edit it. Ruling 8 obliges the task that adds the date-setter to write it down
beside the rule it bends, and the paragraph at line 15 does that and names the fields it writes. The
content of the claim is finding 1.

Two gaps, for task 11 rather than task 4. The file's test list names neither `tests/beats.js` nor
`tests/beings-lazy.js`, and it already omitted `tests/become.js`, `tests/chronicle.js`,
`tests/field.js`, `tests/gods.js` and `tests/dwellers.js`. And the paragraph at line 10 records five
exceptions to the view-state rule where dev's copy of the same file records four and names the writing
function for each. Neither is task 3's doing beyond the two new files. This review did not edit the
file.

## What this review did not do

Day 50 was not re-measured; the report's attribution to population was checked against its own
per-person figures and accepted. The built page was not driven in a browser; the implementer's Safari
run is taken on its own account. `LONG=1 node tests/soak.js` was not run. `tests/ui.js`,
`tests/names.js`, `tests/gnomes.js` and `tests/crafts.js` were not run under `SLOW=1`.

Every fault planted in this review was planted in a `git archive` copy under `/tmp`, never in the
worktree. No committed file in `/Users/earchibald/Worktrees/hamlet-g4` was changed.
