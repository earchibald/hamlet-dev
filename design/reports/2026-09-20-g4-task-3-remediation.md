# G4 task 3 remediation: the review's findings answered

The fixes for the task 3 review, on branch `tiers-g4` in the worktree `/Users/earchibald/Worktrees/hamlet-g4`.
This session wrote none of task 3 and none of its review.

## What was done

| # | Grade | Finding | Outcome |
|---|---|---|---|
| 1 | Critical | `setClock` credits a clock jump as work done | **Fixed.** `setClock` now moves `worked` as well as `seen`. Reproduced first at 4061.928 against 1.128, then two new tests watched failing. Every other field a jump leaves in the past was measured; none charges or credits a quantity. |
| 2 | Major | The budget test cannot fail | **Fixed.** A loaded machine now skips loudly and names the load average. The assertion was proved able to bite in a throwaway copy. Three more silent-pass guards were found elsewhere in `tests/` and are reported, not changed. |
| 3 | Major | The `threatsFor` kept list rests on a comment | **Fixed.** Three tests, one a key. Each key's removal reds exactly its own test and leaves the other two green. No staleness path was found in play, and the cache's behaviour is unchanged. |
| 4 | Minor | Four species get new behaviour with nothing the player can see | **Fixed.** Every roused being now gets the `woken` thought, and a live thought is no longer renewed, so its half hour ends. Three Sonnet reviewers passed the new line unchanged. |
| 5 | Notes | The day-3 figure, `CLAUDE.md`'s test list, the clock lint | **Done.** The plan carries a range with its method. `CLAUDE.md` gains three test lines. The lint was measured in three parts and not widened. |
| — | New | `types/sim/records.d.ts` on dev declares none of task 3's six new record fields | **Reported, not fixed.** No `types/` directory exists on this branch. The exact edits are named for the merge. |

## The gates

Every figure is this session's own run in `/Users/earchibald/Worktrees/hamlet-g4`, at the head of this
work. The machine carries several agent sessions, so the one-minute load average is given beside every
timing figure.

| gate | result |
|---|---|
| `node build.js` | built, then `git status --porcelain` was empty, so `dist/hearth-sim.html` is byte-identical to the committed one. Load average 2.22 |
| `npm run fast` | 360 tests, 353 pass, 0 fail, 7 skipped. Load average 2.22 |
| `node tests/soak.js` | 73 tests, 65 pass, 0 fail, 8 skipped, 1 m 49 s. Load average 4.26. The working record did not move |
| `node --test tests/clock.js` | 22 tests, 22 pass, 0 fail, 0 skipped. Load average 2.16 |
| `node --test tests/tasks.js` | 23 tests, 23 pass, 0 fail, 0 skipped. Load average 2.16 |
| `node --test tests/beings-lazy.js` | 18 tests, 17 pass, 0 fail, 1 skipped. Load average 2.16 |
| `node --test tests/setclock.js` | 3 tests, 3 pass, 0 fail, 0 skipped (new file). Load average 2.16 |
| `SLOW=1 node --test tests/snapshot.js` | 49 tests, 38 pass, **11 fail**, 0 skipped. Red before task 3 and red now, with the same eleven names |
| `tests/soak-golden.json` md5 | `1e1248d47dd2aabc9d430fd49275c665`, unchanged. Tool: `md5 -q` |

`npm run fast` was 352 tests and 346 pass before this work, and is 360 and 353 now. Eight tests were
added: three in `tests/setclock.js` and five in `tests/beings-lazy.js`.

### Every skipped file, and why it skips

Seven skips in `npm run fast`. Six are the files task 1 suspended, and each prints its own reason.
Method: the reasons below are quoted from the run's own output, not from a report.

| file | the reason it prints |
|---|---|
| `tests/gnomes.js` | asks for 70 world days at about 15 s a day, not dev's 0.31 s. `SLOW=1` runs it. Task 4 restores it |
| `tests/names.js` | asks for 202 world days, 342 under `SLOW=1`, at about 15 s a day. Task 4 restores it |
| `tests/settle.js` | asks for 50 world days at about 15 s a day. Task 4 restores it |
| `tests/snapshot.js` | asks for 40 world days at about 15 s a day. `SLOW=1` runs it. Task 4 restores it |
| `tests/ui.js` | asks for 25 world days at about 15 s a day. `SLOW=1` runs it. Task 4 restores it |
| `tests/wanderer.js` | asks for 493 world days across 15 runs at about 25 s a day. `SLOW=1` takes hours |

The seventh skip is new and is finding 2's fix: `a world day at day 3 costs under five seconds` in
`tests/beings-lazy.js` skips above a one-minute load average of 2, and its message names the load
average and the seconds the day took. Before this work it reported a pass.

The soak's 8 skips are its two 70-day floors, suspended pending task 4, and six "not the default run"
guards. Nothing was added to them.

`SLOW=1 node --test tests/snapshot.js` is red and the eleven names are the eleven the review lists,
compared line for line. Task 4 owns the conversion of task 1's oracle spans. Nothing here touched it.

## 1. Critical: `setClock` credits a clock jump as work done

`/Users/earchibald/Worktrees/hamlet-g4/tests/lib/run.js` wrote the world's tick and each being's
`seen`, and left `worked` behind. `/Users/earchibald/Worktrees/hamlet-g4/src/sim/tasks.js:123` reads
`const ran = t.worked === undefined ? 1 : Math.max(1, tick - t.worked)`, so the first look after a jump
put the whole jumped stretch into the job.

### Reproduced once, before any change

Method: a world on seed `r` at the size `tests/beings-lazy.js` uses, a person started on `setSnare`,
walked to the tile and given enough looks to put the first work in. Then `setClock`, then one look. Run
against a `git archive` of HEAD under `/Users/earchibald/.claude/jobs/8b2c73e8/tmp/`, so the worktree
was never touched.

| jump | progress before | progress after |
|---|---|---|
| 0 ticks | 1.1280 | 2.2560 |
| 3,600 ticks, one world hour | 1.1280 | **4063.0560** |
| 86,400 ticks, one world day | 1.1280 | **the job finished** |

That reproduces the reviewer's 4061.9280 to within one extra look's worth of work, which is the
difference between their probe and this one. The defect is the same.

### Which fix, and why

**Write the field.** `setClock` moves `worked` on the task a being holds, as it already moved `seen`.

The choice rests on two measurements, not on taste.

A refusal costs nothing today. A plant that made `setClock` throw whenever any being held a task with a
`worked` value was run against every existing jump site: `node --test tests/closing.js tests/dwellers.js`
gave **29 tests, 29 pass, 0 fail**. So the refusal reds none of the 21 existing jumps. All 21 jump in
small early worlds where nobody is at a job yet.

A refusal forbids the jump that tasks 4 and 10 need. Method: a three-day run on seed `r` with the soak's
own pit-lighting god, sampled every world minute. **4,334 samples, and a refusal would have fired on
4,245 of them, 97.9 percent**, with 74 tasks held per sample. The 17 new jumps the plan hands tasks 4
and 10 go into `tests/gnomes.js`, `tests/ui.js` and `tests/names.js`, which jump in settled valleys. A
refusal there is not a test saying what it wants out loud; it is a function that cannot be called.

The criterion is also small and closed, which was the reviewer's doubt. An **accrual marker** is a tick
on a record whose gap to the present is multiplied into a quantity. Every other elapsed read in the
rules is a threshold. There are exactly two accrual markers, `seen` and `worked`, and the inventory test
below makes a third one go red the day a rule adds it.

### Every other field a jump leaves in the past

Method: two identical worlds on seed `r`, each run 260,000 ticks, about three world days, with the
soak's pit-lighting god. One was jumped one world day with `setClock` and stepped once. The other was
stepped once. Every difference is the jump's.

| field or family | jump | before the jump | jumped and stepped | stepped only | verdict |
|---|---|---|---|---|---|
| a job's `worked`, and its progress | 1 world hour | 1.1280 | 4063.0560 | 2.2560 | **charges work nobody did. Fixed** |
| `b.seen` | 1 world day | lag 0 | lag 0 | lag 0 | already written by `setClock`. Sound |
| a thought's `until` | 1 world day | 5 held | 2 held | 5 held | forgives. An arrived world's thoughts are gone too. Sound |
| a being's cooldowns | 1 world day | 0 live | 0 live | 0 live | absolute deadlines, so they expire. Sound. No live cooldown in the sample, so this rests on the read and not on a number |
| `a.born`, so age and life stage | 1 world day | 35 days | 36 days | 35 days | charges a day of age, which is the point of a date jump. Sound |
| `a.lastHurtAt`, the remembered wound | 1 world day | 0 held | 0 held | 0 held | a jump past `CLOCK.limit.hurtRemembered` forgets it, as the days would. Sound |
| `a.task.started`, the task timeout | 1 world day | min 272701 | min 272701 | min 272701 | `CLOCK.limit.task` is 1.5 world days, so a one-day jump abandons nothing. A longer jump abandons every held task, which is honest elapsed time |
| `t.waitUntil` | 1 world day | — | a wait in the past is over | — | forgives a wait. A wait is a deadline, not an accrual. Sound |
| the camp's food rot deadlines | 1 world day | 0 past | 14 past | 0 past | charges a day of spoilage, as the days would. Sound |
| the pit's fuel | 1 world day | 234.72 | 234.72 | 234.72 | not burnt. Fuel burns on the cellular beat, so the jump forgives it. Consistent with "nothing accrues" |
| plant growth: trees, saplings, bushes, berries | 1 world day | 2917 / 144 / 938 / 2699 | unchanged | unchanged | not grown. On the beat, so forgiven. Consistent |
| fire | 1 world day | 0 tiles | 0 tiles | 0 tiles | on the beat. No fire in the sample, so this rests on the beat reading |
| weather: `storm`, `until`, `next` | 1 world day | false / 0 / 288940 | unchanged | unchanged | absolute ticks read by `tick >= x`. A jump past both ends a storm and starts the next. Sound |
| the cellular beats' next-beat records | 1 world day | 0 past | **6 past** | 0 past | all six systems owe one beat and run once, not 1,440 times. Forgiven, and consistent |
| an item's rot, `i.born` | 1 world day | 0 perishable | 0 perishable | 0 perishable | `tick - i.born` against a keeping time. Charges, as the days would. No perishable item in the sample, so this rests on the read |
| `a.next`, the tick a being acts again | 1 world day | 6 owed | 6 owed | 6 owed | left in the past, so every being is owed an act and all act on the jump tick. A difference in act order, not a charge. The review reports the same. Left alone |

**Nothing else charges or credits a quantity.** The claim is held by a count and not by reading. The
scan in `tests/setclock.js` finds every `tick - X` in `src/sim/`: **30 sites**, of which `t.worked` in
`src/sim/tasks.js` is the only one whose gap is multiplied into an accumulator. The other 29 compare the
gap with a threshold. `a.seen` is the second accrual marker and does not appear in that scan, because
`catchUp` reads it as `a.seen < tick`; the test holds it by name instead.

**Four fields could not be measured from a number**, because the three-day sample held none of them
live: a being's cooldown, a fire, a perishable item and a live `waitUntil`. Each verdict above rests on
how the rule reads the field, which is stated beside it. A cooldown, a fire's fuel and an item's rot are
all read against an absolute tick or on a beat, so none of them can accrue across a jump.

### The test, and what was broken to see it fail

`/Users/earchibald/Worktrees/hamlet-g4/tests/setclock.js` is new and is named in `npm run fast`.

Nothing was broken to watch it fail. Both tests were written against the unfixed `setClock` and were
red on the real code:

```
✖ a jump of one world hour puts no work into a job
  the look after a one-hour jump put in 4061.9280000000003 where a look is worth 1.1280000000000001
✖ a jump of one world day leaves no accrual marker in the past
  human 19 last worked on 118815 and the world is on 205215
ℹ pass 1   ℹ fail 2
```

The first figure is the reviewer's own 4061.9280, reached independently. After the fix: 3 pass, 0 fail.

The third test is the inventory. It is the gate the reviewer's finding asks for: `worked` reached the
branch with nobody asked whether a jump owed it a write, and a rule that adds a new elapsed gap now goes
red in a file whose comment says what the decision is.

### The document and the code now agree

Both said the world arrives at the date as it stood, and named one field. `CLAUDE.md` line 15 and the
function's own comment now state the criterion, name both fields, and say what a jump leaves alone: a
deadline already set expires, and nothing accrues.

## 2. Major: the budget test cannot fail

`/Users/earchibald/Worktrees/hamlet-g4/tests/beings-lazy.js` stood the budget down above a one-minute
load average of 2 with a bare `return`, which printed a green tick and 0 skipped.

The threshold is unchanged. The stand-down is now `ctx.skip()`, which the same file already used for a
genuine precondition, and the message names the load average that caused it and the seconds the day
took. On this machine:

```
    day 3 on seed r: 3.07 s, one-minute load average 2.84
﹣ a world day at day 3 costs under five seconds # the budget went unmeasured at a one-minute load
  average of 2.84, which is over 2; the day took 3.07 s. Run it again on a quiet machine.
ℹ tests 18   ℹ pass 17   ℹ fail 0   ℹ skipped 1
```

### The assertion can now fail

Method: in a `git archive` copy of HEAD, the load threshold was raised to 99 so the assertion would run,
and the budget was lowered from 5 s to 0.0001 s.

```
    day 3 on seed r: 3.28 s, one-minute load average 3.29
✖ a world day at day 3 costs under five seconds
  AssertionError: a world day at day 3 took 3.28 s at a one-minute load average of 3.29
ℹ pass 12   ℹ fail 1   ℹ skipped 0
```

So the assertion path bites, and the copy was deleted. Before this work the same budget of 0.0001 s gave
13 pass, 0 fail, 0 skipped.

### Three more silent passes, and one escape clause, found in `tests/`

Method: `git grep` for `os.loadavg`, `process.hrtime`, `Date.now`, `performance.now`, `ctx.skip` and a
bare `return` in a test body, across every file under `tests/`.

**No other guard is derived from the quantity it guards.** The load average was the only one. The 14
`ctx.skip()` calls in `tests/closing.js` and `tests/dwellers.js` are genuine world preconditions. The
six suspension guards use `{ skip: … }` and report honestly. `tests/ages.js` and `tests/soak.js` measure
wall time and assert nothing on it.

Three bare returns in a test body do report a pass where a skip is the honest answer. None of them is
derived from a measured quantity, so none of them disarms on the change it would report. They are
recorded and not changed, because they are not this remediation's.

| site | the precondition | what it prints today |
|---|---|---|
| `/Users/earchibald/Worktrees/hamlet-g4/tests/settle.js:47` | no wet boundary in the world | a pass |
| `/Users/earchibald/Worktrees/hamlet-g4/tests/settle.js:57` | no pooled country in the world | a pass |
| `/Users/earchibald/Worktrees/hamlet-g4/tests/tasks.js:128` | the camp has no pit | a pass |

One escape clause deserves a separate line, because it is the same family as finding 2 rather than the
same as the three above. `/Users/earchibald/Worktrees/hamlet-g4/tests/settle.js:51` asserts
`ford > 0 || wet.every(b => b.tiles.length < 47)`. The escape is computed from the very boundaries the
test measures, so a world whose rivers are all short satisfies the assertion whether or not it has a
ford. It is weaker than it reads.

## 3. Major: the kept threat list rests on a comment

`sourcesNow()` at `/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js:275` keeps the tick's people,
foxes and wolves between calls, keyed on the tick, the `beings` array and its length.

**The cache's behaviour is unchanged.** No production path was found that makes the list stale under the
three shipped keys, which agrees with the review. What changed is that the claim is now held by three
red-able tests instead of by an enumeration in a comment.

Three tests are in `/Users/earchibald/Worktrees/hamlet-g4/tests/beings-lazy.js`, each against an oracle
written out in the test: `beings.filter(b => b.species === 'human' || SPECIES[b.species].hunter)`.
`sourcesNow` was added to the API in `/Users/earchibald/Worktrees/hamlet-g4/src/sim/index.js` so a test
can read the kept list.

Method: each key was deleted in turn in a `git archive` copy of the branch head, one at a time, with the
file restored between plants.

| key deleted | `node --test tests/beings-lazy.js` | which test went red |
|---|---|---|
| the tick | 14 pass, 1 fail | the tick rebuilds the kept threat list when nothing else can |
| the `beings` array | 14 pass, 1 fail | a load replaces the beings array, and the kept threat list goes with it |
| `beings.length` | 14 pass, 1 fail | a being pushed inside a tick joins the kept threat list |

Each plant reds exactly its own test and leaves the other two green, which is what a targeted test
should do. Before this work, deleting the tick key left the whole suite and the full six-seed soak green.

### Why each key is needed

The comment beside the tests says this, so a reader meets it where the keys are.

| key | what breaks without it |
|---|---|
| `beings.length` | a being pushed inside a tick joins the valley without the tick moving and without the array being replaced. Births, litters and arrivals all push. The new wolf would be invisible to every threat read until the next tick |
| the `beings` array | the prune, the settle and a loaded save all replace the array rather than splice it, and a load can land on the same tick with the same count. The list would hold records the valley no longer has |
| the tick | the backstop for any change to the contents of `beings` that keeps both the array and its length: a member replaced in place, a species reassigned. No production path of that shape exists today, and without the key such a change is never corrected at all, so the list can be a whole world day stale |

## 4. Minor: four species get new behaviour with nothing the player can see

`rousedBy` at `/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js` rouses a gnome, a rabbit and a
deer as well as a person, and only the person got a thought.

**The waking should be visible, so it now is.** The inspector's Thoughts panel at
`/Users/earchibald/Worktrees/hamlet-g4/src/ui/inspect.js:36` is drawn for every species, and the rules
already give thoughts to a wolf and to a gnome, so a thought is the row that shows this. The animal's
line does not name the night, because a person rouses an animal in daylight too. The person's line is
unchanged.

The line: **Woke to something moving close by**

### The review panel

Three Sonnet reviewers judged the line on its own, with no access to the code, each asked the same three
questions: does it sound human, is it plain English, is it readable at a glance in a small panel row.

| reviewer | verdict | what they said |
|---|---|---|
| 1 | ship as written | shares the register of "Woke in the night to something moving" and does not jar; one idea, active voice, no padding; six words, one clause, no comma to trip on |
| 2 | ship as written | no register mismatch; "close by" is two words where "nearby" is one, but it carries the five-tile meaning and so is not filler; 33 characters, no stumble points |
| 3 | ship as written | sounds like a thought and not a system message; same skeleton as the person's line minus the time-of-day clause the new case cannot claim; shorter than several existing thoughts |

None proposed a rewrite, so nothing was rewritten. All three noted on their own that the line claims no
time of day, which is the point of it.

### The refresh

`addThought` moves `until` to `tick + dur` on every call. A tired person beside a lingering wolf sleeps,
is roused, and sleeps again, so the thought was re-added on almost every tick and the half hour of
`CLOCK.thought.woken` never ended.

Method: a person at 22:00 with rest 10 and every other need at 90, a wolf held four tiles off and fed so
it neither left nor attacked, 2,600 ticks.

| ticks in | asleep | rest | the thought's `until` | the first `until` |
|---|---|---|---|---|
| 0 | yes | 10.0 | 167402 | 167402 |
| 800 | yes | 11.7 | 168202 | 167402 |
| 1600 | yes | 13.3 | 169002 | 167402 |
| 2400 | yes | 15.0 | 169802 | 167402 |

The `until` tracked the tick, 1,800 ticks ahead of it, for ever. The waking now leaves a live thought
alone, and a waking after the thought has lapsed starts a fresh half hour, which is what a second waking
is. The reviewer's reading is confirmed on the rest column: rest rises, so this was a mood tax and not
insomnia.

Two tests in `tests/beings-lazy.js`, each watched failing first. The animal test reds against the branch
head. The duration test reds with the new gate removed and nothing else changed: 5,037 pushes forward of
a live thought, against 0 with the gate.

The soak did not move: 65 pass, 0 fail, 8 skipped, and the working record was not rewritten. An animal's
mood is read by no rule — `mood()` is called once in `src/sim/beings.js`, inside the human branch of
`chooseTask` — and the thought sweep draws no random number.

## 5. The notes

### The day-3 figure

The plan's task 3 checkbox and its summary row both carried 3.05 s, the best of one seven-row table. Six
measurements now exist, all by the budget test's own harness: three world days on seed `r` in Node, the
third day timed.

| seconds | one-minute load average | who measured it |
|---|---|---|
| 3.05 | 4.36 | the task 3 implementer |
| 3.33 | not stated | the task 3 implementer, the before-and-after table's best row |
| 3.40 | 3.86 | the task 3 review |
| 2.99 | 2.62 | this remediation |
| 3.28 | 3.29 | this remediation, in the plant copy |
| 3.07 | 2.84 | this remediation |

The plan now says **2.99 to 3.40 s across six runs, at one-minute load averages from 2.62 to 4.36**,
against dev's 9.86 s, with the method named and every figure listed. It also says the test skips rather
than asserts above a load average of 2, so each figure is a measurement and not an assertion. The budget
is 5 s and every run meets it.

### `CLAUDE.md`'s test list

Three lines were added, in the file's own voice: `tests/beats.js`, `tests/beings-lazy.js` and the new
`tests/setclock.js`. Each names what the file tests. The `beats.js` line was written from the file's six
test names and not from a guess.

### What the clock lint does not hold, measured in three parts

**The lint was not widened.** Three counts, all from `/Users/earchibald/Worktrees/hamlet-g4` at this
branch's head. `tests/clock.js:290` and `:301` both exclude `clock` from the lint, so the table is the
one place a number may be a number, and nothing checks that a table entry is written in a unit helper.

**Count 1: table entries not written in a unit helper. Ten of 294.** Tool: a script that strips comments
and strings from `src/sim/clock.js`, takes the `CLOCK` object from `const CLOCK = {` to its matching
brace, and classifies every leaf `key: value` by whether the value calls `secs`, `mins`, `hours`, `days`,
`years`, `perHour`, `tickRate`, `strideRate`, `lookRate`, `stock`, `ticks` or `strides`. 284 call one.
Ten do not.

| entry | value | read at | a widened lint should |
|---|---|---|---|
| `dark.slower` | 2 | `src/sim/tasks.js:59`, `tick % CLOCK.dark.slower` | **report it.** It is a period of two world seconds, written as a bare number. A person in the dark moves on every second tick, and nobody has read that value in world time |
| `spawn.rabbitLitter.chance` | 0.8 | `src/sim/species.js:216` | pass it. Rolled once on `spawn.rabbitLitter.every`, so the beat carries the world time and the chance is per event |
| `gnome.copyChance` | 0.3 | `src/sim/species.js:300` | pass it. Rolled on the gnome beat |
| `grove.birthChance` | 0.5 | `src/sim/fae.js:117` | pass it. Rolled on the grove beat |
| `sprite.mossChance` | 0.35 | `src/sim/fae.js:36` | pass it. Rolled once every `mossEvery` strides |
| `arrival.chance` | 0.7 | `src/sim/camps.js:338` | pass it. Rolled once on an arrival check |
| `arrival.villageChance` | 0.85 | `src/sim/camps.js:338` | pass it. Same roll |
| `thought.over` | 4 | `src/sim/gods.js:154` | pass it. A god's thought. Its own comment says nothing counts it down, because the tick does not step a god |
| `thought.wouldnothold` | 4 | `src/sim/settle.js:112` | pass it. The same |

So **one of ten is a genuine hit** and nine are legitimate: seven dimensionless chances whose beat
carries the time, and two god thoughts that already carry a comment saying why.

The peer session's plant reproduces on this branch. `/Users/earchibald/Worktrees/hamlet-g4/src/sim/clock.js:148`
is `spoil: ticks(100)`. Replace it with `spoil: 8640`, the same value with the helper simply gone, and
`node --test tests/clock.js` is **22 pass, 0 fail**. The control is what makes it a finding: change the
value too, to `spoil: 60`, and one test fails, `the camp rules and the cellular systems read the table`,
`60 !== 100`. So a hand-written equality pins each value and nothing checks the form. Both runs were in a
`git archive` copy, since removed.

**Count 2: bare counts returned from a function, outside `clock.js`. Seven sites, of which three are
durations.** Tool: `grep -nE "return -?[0-9]+(\.[0-9]+)?\s*;"` over every file in `src/sim/` but
`clock.js` and `index.js`.

| site | returns | is it a duration? |
|---|---|---|
| `/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js:531` | `return 1` in `nextAct` | yes, one tick |
| `/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js:535` | `return 1` in `nextAct` | yes, one tick |
| `/Users/earchibald/Worktrees/hamlet-g4/src/sim/beings.js:537` | `return 1` in `nextAct` | yes, one tick |
| `/Users/earchibald/Worktrees/hamlet-g4/src/sim/goals.js:5` | `return 0` | no, a count of huts wanted |
| `/Users/earchibald/Worktrees/hamlet-g4/src/sim/goals.js:6` | `return 1` | no, the same |
| `/Users/earchibald/Worktrees/hamlet-g4/src/sim/world.js:38` | `return -1` | no, "no fire found" |
| `/Users/earchibald/Worktrees/hamlet-g4/src/sim/world.js:659` | `return 0` | no, a tile count |

The exposure is much wider than the seven, and that is the number the plan should weigh. There are **338
`CLOCK.` reads at 292 distinct paths** in `src/sim/` outside `clock.js`. Tool: `git grep -oh "CLOCK\.[A-Za-z.]*"`
over `src/sim/` excluding `clock.js` and `index.js`. Any one of them could be replaced by a bare literal
of the same value and the lint would not see it, which is exactly the review's `return CLOCK.every.body`
to `return 60` plant.

**Count 3: what a widened lint would report, and what it must not.** A blanket widening is unusable. A
count of every bare numeric literal of 2 or more in `src/sim/`, outside `clock.js` and `index.js`, with
comments and strings stripped, is **1,291**, led by `beings.js` at 260, `goals.js` at 184 and `gods.js`
at 129. Nearly all are distances, tile counts, scores, mood values and percentages, and a count with no
helper is not automatically wrong: `DAY` itself, a ratio, a dimensionless number and a distance are not
durations, and `SENSE = 5` is a distance the review already cleared.

So a widening has to be targeted, and there are two targets, of different sizes:

| a widened lint that reports | would report | of which faults |
|---|---|---|
| a `CLOCK` entry not written in a unit helper | 10 | 1: `dark.slower` |
| a bare literal returned where a sibling `return` reads `CLOCK` | 3 | 0: all three are `return 1`, meaning "next tick" and not a tuned duration |

**This is a finding for the plan and not a change.** G4's central claim is that every duration and rate
lives in `CLOCK` written in the unit helpers. Today the form is unchecked in both directions: inside
`clock.js` because the lint excludes the file by design, and outside it because a bare literal in a
return is invisible. The claim rests on the care of each task and not on a gate. Task 10 owns the lint,
and the decision about a widening that names nine legitimate exceptions is the plan's.

## New: dev's record types do not know task 3's fields

Not in the brief. Raised by a peer session, verified here independently, and **not fixed**, with the
reason stated.

**There is no `types/` directory on this branch.** No `tsconfig.sim.json`, no `tsconfig.probe.json`, no
`npm run types` script in `package.json`, and no `node_modules/.bin/tsc`. This branch's `CLAUDE.md` does
not mention `types/sim` or `tsconfig` at all: `grep -c` answers 0. So the whole type-check apparatus
arrives at the merge, exactly as `tests/types.js` does, and there is no file here to edit and no checker
here to run.

**The gap is real and it is wider than four errors.** Method: `git show origin/dev:types/sim/records.d.ts`
read against this branch's source, and each field counted on both sides with `grep -c` over
`src/sim/beings.js`, `src/sim/tasks.js` and `src/sim/main.js`.

| field | on the record | reads on dev | reads on `tiers-g4` | declared in dev's `records.d.ts`? |
|---|---|---|---|---|
| `next` | Being | 1 | 5 | no. `nextArrival` is declared, `next` is not |
| `seen` | Being | 0 | 7 | no |
| `until` | Thought | 0 | 2 | no. `left: number` is declared and is dead on this branch |
| `worked` | Task | 0 | 4 | no |
| `due` | Task | 0 | 2 | no |
| `waitUntil` | Task | 0 | 3 | no |

So the peer's four `TS2339` errors for `next` are the first of six fields, and the merge should expect
more once `next` is declared. The edits the merge owes, in `types/sim/records.d.ts`: `next: number` and
`seen: number` on `Being`; `until: number` on `Thought`, with `left` removed; `worked?: number`,
`due?: number` and `waitUntil?: number` on `Task`. No catch-all index signature, because `CLAUDE.md` on
dev records that one hid a misspelt field from tsc.

**Which check was used, and what it does not cover.** None. No TypeScript is installed in this worktree
and no tsconfig exists here, so nothing was run and nothing is claimed as proved. The finding rests on
reading dev's declaration file against a count of reads on both branches. Even where the apparatus does
exist, `npm run types` alone is not a gate: if an annotation is lost the variable falls back to `any`,
its errors vanish, and the run still reports zero. Only the probe half of `tests/types.js` sees that, and
that file is not on this branch.

## What was not done, and what is left alone

- `tests/snapshot.js` is 38 pass and 11 fail under `SLOW=1`, and was red before task 3. Task 4 owns the
  conversion of task 1's oracle spans. The eleven names are unchanged.
- Five suites on dev do not exist on this branch: `garden.js`, `itemgrid.js`, `reachable.js`,
  `stalk.js`, `types.js`. The merge owns that, and so does the `types/` directory above.
- `senseBeings` invalidates `movers` inside its own loop. Untouched. A note for task 4.
- `campsThatSawGnomes` moving 0 to 1 is traced in the review and is not a defect.
- `SNAPSHOT_VERSION` staying at 2 is safe until the merge.
- `tests/soak-golden.json` was never edited and `UPDATE_GOLDEN=1` was never run. Its md5 is
  `1e1248d47dd2aabc9d430fd49275c665`, the value the brief names.
- `tests/soak-working.json` was not rewritten. Nothing in this work moved the fingerprint.
- Every fault planted in this work was planted in a `git archive` copy under
  `/Users/earchibald/.claude/jobs/8b2c73e8/tmp/`, and every copy was deleted.
  `git status --porcelain` in the worktree is empty.
