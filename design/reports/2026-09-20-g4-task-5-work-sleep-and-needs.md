# G4 task 5: work, sleep, and needs in world time

Branch `tiers-g4`, worktree `/Users/earchibald/Worktrees/hamlet-g4`, from `374d055`.
Three commits: `f46eb12`, `24151a2`, `991681b`.

| What | Outcome |
|---|---|
| `workKind`'s `amount` | World time for a person of no skill. Task 3 built the machinery; task 5 wrote the values. |
| `CLOCK.work` | 34 entries in world time, each a whole number of quarter hours. Two are the spec's. |
| The recipes | Nine work durations moved into `CLOCK.work`. Each recipe reads the table by its own id. |
| `CLOCK.task` | 13 entries in world time, each a whole number of quarter hours. |
| A person's needs | Points an hour. Nine meals, 15 or 16 drinks and 3 sleeps over three days, on all six seeds. |
| A night's sleep | `CLOCK.rate.restsAsleep` is 2, not 6. The rule gives eight hours; play measures 5.2 to 6.7. |
| `CLOCK.limit.task` | Three days, up from a day and a half. The watchdog drops nothing either way. |
| The pinned share | Unchanged at 100.0 percent with the animals awake. With the people alone it falls from 30.6 to 14.7 percent of ticks. |
| The soak's record | Red on all six seeds and on the seventh test, as a duration change must be. Neither record was touched. |
| A new fault found and fixed | A sleeper could run out of water and die without waking. One did. |
| **A finding for the plan** | The valley's growth collapses. Seven tests in `SLOW=1 tests/snapshot.js` go red on their own preconditions. |

## The one measurement the brief asked for first

The brief asked me to read the human act rate against `CLOCK.every.body` before changing anything.
The remediation's guess was that the body beat is the period that pins the horizon. It is not.

`tests/skip.js`'s own `pins` counter says the cause is `acted`: a being acted on the previous tick, so
`nextEvent` holds the tick after it. In the still valley of `tests/skip.js` — one world day on seed
`r`, the animals frozen, the people alone — `acted` was 24,310 of the 24,312 pinned asks. The body
beat contributed nothing to that bucket. `CLOCK.every.body` is what a SLEEPER waits on, so it is the
cure and not the cause: a sleeping person is looked at once a world minute, and a walking or gathering
one acts on every tick.

That is why task 5's durations move the number. A person now sleeps about six hours a night instead of
two and a half, which moves a quarter of the day from "acts every tick" into "looked at once a
minute".

| Measured with | Before (`374d055`) | After | Method |
|---|---|---|---|
| Six seeds, three world days, horizon is the next tick | 100.0 % of 259,200 asks, every seed | 100.0 % of 259,200 asks, every seed | `tests/skip.js`, its `pins` counter |
| The still valley, one world day, seed `r`: ticks visited | 26,403 of 86,400, 30.6 % | 12,707 of 86,400, 14.7 % | the same file's positive gate |
| The still valley: pinned asks | 24,312 of 26,403 | 10,198 of 12,707 | `pins.next / pins.asked` |
| The still valley: `acted` bucket | 24,310 | 10,197 | `pins.acted` |
| The still valley: jumps | 2,091 | 2,509 | the same test's diagnostic |

So the people's own pin, measured as a share of all ticks in the day, falls from 28.1 percent
(24,312 / 86,400) to 11.8 percent (10,198 / 86,400). It does not reach zero, and it cannot here:
sprite durations are task 7's and animal rest is task 6's, and with the animals awake every one of
them still acts on every tick, which is why the six real seeds stay at 100.0 percent. I moved the
people's share. I left the animals and the sprites alone.

I did not tune toward any of these numbers. The durations were set from the spec and from today's
world-time meanings, and then measured.

## `CLOCK.work`, before and after

Every value before was `strides(n)`, which task 1 defined as `round(n × 172.8)` world seconds. The
"before" column is that value in hours. The rule for the "after" column is the nearest quarter hour,
which is the finest grain a person says a duration in. Two entries are the spec's and are not
conversions, and they are marked.

| entry | before, strides | before, hours | after | after, hours |
|---|---|---|---|---|
| firepit | 70 | 3.36 | `hours(3.25)` | 3.25 |
| feedFire | 6 | 0.29 | `mins(15)` | 0.25 |
| strikeSparks | 40 | 1.92 | `hours(2)` | 2.00 |
| mossLight | 10 | 0.48 | `mins(30)` | 0.50 |
| layFire | 15 | 0.72 | `mins(45)` | 0.75 |
| butcherDeer | 60 | 2.88 | `hours(3)` | 3.00 |
| cookFish | 25 | 1.20 | `hours(1.25)` | 1.25 |
| cookCatch | 35 | 1.68 | `hours(1.75)` | 1.75 |
| setSnare | 30 | 1.44 | `hours(1.5)` | 1.50 |
| checkSnare | 4 | 0.19 | `mins(15)` | 0.25 |
| rearmSnare | 10 | 0.48 | `mins(30)` | 0.50 |
| haulDeer | 12 | 0.58 | `mins(30)` | 0.50 |
| **knapAxe** | 70 | 3.36 | `hours(1)` | **1.00, the spec** |
| testRocks | 50 | 2.40 | `hours(2.5)` | 2.50 |
| spear | 50 | 2.40 | `hours(2.5)` | 2.50 |
| waterskin | 60 | 2.88 | `hours(3)` | 3.00 |
| **leanTo** | 110 | 5.28 | `hours(4)` | **4.00, the spec** |
| storehouse | 140 | 6.72 | `hours(6.75)` | 6.75 |
| hut | 120 | 5.76 | `hours(5.75)` | 5.75 |
| offeringStone | 30 | 1.44 | `hours(1.5)` | 1.50 |
| leaveBerries | 8 | 0.38 | `mins(30)` | 0.50 |
| wardPosts | 60 | 2.88 | `hours(3)` | 3.00 |
| rack | 50 | 2.40 | `hours(2.5)` | 2.50 |
| smokeMeat | 45 | 2.16 | `hours(2.25)` | 2.25 |
| smokeFish | 40 | 1.92 | `hours(2)` | 2.00 |
| fish | 110 | 5.28 | `hours(5.25)` | 5.25 |
| quarry | 25 | 1.20 | `hours(1.25)` | 1.25 |
| breakRockfall | 60 | 2.88 | `hours(3)` | 3.00 |
| cutTree | 60 | 2.88 | `hours(3)` | 3.00 |
| fillWaterskin | 12 | 0.58 | `mins(30)` | 0.50 |
| berryEvery | 6 | 0.29 | `mins(15)` | 0.25 |
| fibreEvery | 8 | 0.38 | `mins(30)` | 0.50 |
| clayEvery | 10 | 0.48 | `mins(30)` | 0.50 |
| cuttingsEvery | 6 | 0.29 | `mins(15)` | 0.25 |

Thirty-two of the thirty-four are conversions and I changed none of them beyond the rounding. Each is
a stretch a person would recognise: a quarter of an hour to feed a fire or check a snare, three hours
to butcher a deer or fell a pine, five and a quarter to fish a day away. The four that end in `Every`
are periods inside a gathering task, so a berry every quarter of an hour and a handful of clay every
half hour.

The two spec values are the ones that moved. Knapping an axe was 3.36 hours and is an hour, so a camp
gets its axe in a third of the time it used to. A lean-to was 5.28 hours and is four, which is a day's
work for one person and half a day for two.

### The recipes

All nine moved into `CLOCK.work` and each recipe now reads `CLOCK.work.<its id>`. They were the only
durations in `src/sim/` outside the table. Putting them in kept the lint's one rule for every file,
rather than granting `recipes.js` an exemption that nothing else has.

| recipe | before, strides | before, hours | after, hours |
|---|---|---|---|
| cord | 30 | 1.44 | 1.50 |
| workshop | 140 | 6.72 | 6.75 |
| basket | 60 | 2.88 | 3.00 |
| rod | 40 | 1.92 | 2.00 |
| clothes | 70 | 3.36 | 3.25 |
| kiln | 120 | 5.76 | 5.75 |
| pot | 50 | 2.40 | 2.50 |
| garden | 80 | 3.84 | 3.75 |
| pitfall | 90 | 4.32 | 4.25 |

`RECIPES` divides its amount by a place's speed, so a workshop craft is 1.3 times faster. That
division is unchanged, and `workKind`'s progress is a float, so a non-whole amount is safe there.

### `CLOCK.task`

The plan lists this group under task 5's files. All thirteen are durations of an act, so they belong
with work. What an animal's rest NEED should be is task 6's, and I left every animal decay row alone.

| entry | before, strides | before, hours | after, hours | what it is |
|---|---|---|---|---|
| nibble | 15 | 0.72 | 0.75 | a rabbit grazes |
| talk | 10 | 0.48 | 0.50 | two people stop and talk |
| shelterWait | 60 | 2.88 | 3.00 | waiting out the rain |
| sit | 90 | 4.32 | 4.25 | an evening by the fire |
| sitChat | 25 | 1.20 | 1.25 | a period inside it |
| sitTeach | 30 | 1.44 | 1.50 | a period inside it |
| sitTeachAt | 15 | 0.72 | 0.75 | its phase |
| standStill | 20 | 0.96 | 1.00 | a being with nowhere to be |
| doze | 60 | 2.88 | 3.00 | an animal's daytime doze |
| eatCarcass | 25 | 1.20 | 1.25 | a wolf at a carcass |
| eatShrooms | 8 | 0.38 | 0.50 | a gnome at a patch |
| denRest | 60 | 2.88 | 3.00 | a beast lying up |
| kinChat | 20 | 0.96 | 1.00 | two gnomes talking |

`CLOCK.rate.sitRests` and `sitWarms` were the last two category-(d) amounts outside the sprites. They
are `perHour(1)` and `perHour(8)` now, which is the 1.04 and 8.33 an hour they always were, at a whole
point an hour. The four sprite rates keep their `strideRate` marker for task 7.

## Needs, in points an hour

| need | before | before, an hour | after | after, an hour |
|---|---|---|---|---|
| food | `tickRate(0.035)` | 1.46 | `perHour(7)` | 7 |
| water | `tickRate(0.05)` | 2.08 | `perHour(16)` | 16 |
| rest | `tickRate(0.03)` | 1.25 | `perHour(2.5)` | 2.5 |
| social | `tickRate(0.02)` | 0.83 | `perHour(1)` | 1 |
| warmth | `tickRate(0)` | 0 | `perHour(0)` | 0 |
| rest gained asleep | the bare `-6` in `beings.js` | 7.5 | `CLOCK.rate.restsAsleep` = 2 | 5 |

How each was read. A need runs from 100 to 0 and urgency starts at 60.

- **Food, 7.** A meal off the stash is worth 55 points, and three meals is 165, which is a day at 7 an
  hour. Full to empty is fourteen hours.
- **Water, 16.** A drink fills the skin to 100. A person puts thirst off until the work stops paying,
  which measures out at about 70 points; five of those is 350, and 16 an hour with one of the five
  taken in the night lands on it. Full to empty is six and a quarter hours.
- **Rest, 2.5.** The arithmetic alone says 1.25: sixteen waking hours to fall from 100 to the 80 at
  which a person lies down at night. But sitting by the fire returns rest, and at 1.25 an hour the
  top-ups kept a person above 80 for days. I measured one sleep in three days on five of six seeds. At
  2.5 the top-ups cannot keep up and every seed sleeps once a night.
- **Social, 1.** A person who sees nobody wants company again inside two days.
- **`restsAsleep`, 2.** Sixteen waking hours paid back in eight. It was 6, which gave a night of under
  three hours and let a person sleep twice.

### The measured counts, per seed

The test is in `tests/tasks.js`, one test per seed, no skip and no guard. It builds a camp under the
founder's feet with a lit pit and a full stash beside it, so neither food nor water is ever the thing
that stops the person acting. A meal is a rise in `food`, a drink a rise in `water`, a sleep the tick
`asleep` turns on. Needs only fall, so a rise is an act and nothing else. Sampling happens on every
tick the engine visits, which is every tick a being acted on and the tick after it.

A sleep counts only when the person had been awake for an hour first. That is stated in the test and
it is not a loosening: a sleeper roused by a wolf at five tiles lies back down within seconds and has
not slept twice. Without the rule seed `x` reported fourteen sleeps in three days, twelve of them
under a minute, all inside one wolf's visit.

| seed | meals | drinks | sleeps | hours asleep | longest stretch |
|---|---|---|---|---|---|
| r | 9 | 16 | 3 | 17.39 | 4.61 |
| x | 9 | 16 | 4 | 15.73 | 5.32 |
| alpha | 9 | 16 | 4 | 17.65 | 5.32 |
| beta | 9 | 16 | 3 | 18.09 | 5.32 |
| gamma | 9 | 16 | 3 | 19.60 | 5.32 |
| delta | 9 | 15 | 3 | 20.05 | 5.12 |

Three days of three meals is nine, of five drinks is fifteen, of one sleep is three. Every seed is
inside one of all three counts. The assertions are 8 to 10 meals, 14 to 16 drinks, 2 to 4 sleeps, and
15 to 27 hours asleep.

The same six seeds with dev's need rates in the same harness: 2 meals every time, 2 or 3 drinks, 1 to
3 sleeps. That is the control, planted in a throwaway copy, and the meal assertion fails on all six.

**The sleep count is blind to the length, and I measured that it is.** Planting the old multiplier of
6 back, with the new decay rates, left every seed's sleep COUNT inside its range: 3 or 4 lie-downs in
three days, exactly as now. The hours abed were 7.04 to 8.57 over the three days, under two and a half
a night. So the count alone would have passed a three-hour night. The hours asleep are therefore their
own assertion, and that one fails on all six seeds with the old multiplier.

**The spec asks for an eight-hour night and play gives 5.2 to 6.7.** The shortfall is not the rate,
and reducing `restsAsleep` does not close it. I measured 1.6 as well: 18.35 to 23.53 hours over three
days, a mean of 7.1 a night against 6.5 at 2. Two other rules cap the night and neither is task 5's:
a person lies down only once the sleep score of 55 beats every work offer, which is late in the
evening, and `WAKE_LIGHT` wakes a sleeper at dawn once rest reaches 60. So the night is bounded by
"when work stops paying" and "dawn", not by the rate. I kept `restsAsleep` at the number its own
derivation gives, and I am naming the two levers rather than pulling either.

### In the real valley, not the harness

Six seeds, three world days, the soak's own arrangement, counted with a probe in a throwaway copy.
These are camp totals over two to four people, not per person, and the walk to the river is real.

| | before | after |
|---|---|---|
| meals begun | 2 to 5 | 11 to 15 |
| drinks begun | 1 to 5 | 18 to 25 |

## `CLOCK.limit.task`, and the watchdog's drops

`ticks(1500)`, which is 129,600 world seconds or a day and a half, becomes `days(3)`. The longest job
in `CLOCK.work` is 6.75 hours, so the watchdog is there for a task that has stopped making progress.
It must not cut off a person who was broken off by a night, a storm and a wolf and went back to the
same job.

Measured with a counter on the watchdog line itself, in throwaway copies of both commits:

| run | sample | drops before, at 1.5 days | drops after, at 3 days |
|---|---|---|---|
| six seeds, three world days | 6 runs | 0, every seed | 0, every seed |
| seed `r`, seventy world days | 1 run | 0 | 0 |

**The watchdog fires on nothing.** Not once in seventy world days before the change, and not once
after. So the figure this task was asked for is zero to zero, and the number that matters is the one
behind it: the watchdog has never been the thing that ends a task on these seeds, at either length.
Raising it to three days therefore costs nothing measurable and buys the margin the comment claims. A
later task that wants to know whether the watchdog earns its keep has the method here.

## The fault I found, and fixed

`updateBeing` forces a thirsty person off their work and sends them to drink, below 15 points. It
never reaches a sleeper, because a sleeping being returns before it. That cost nothing while water
took two world days to empty; no night was long enough.

At 16 points an hour a full skin empties in six and a quarter hours and a night is longer. So a person
could run dry asleep and lie there taking the starving damage. One did: **Iva died of thirst at 23:00
on day 29 of seed `r`**, in a seventy-day run measured before the fix. `CLAUDE.md` calls any death but
old age a bug until somebody proves otherwise.

The fix is in `bodyStretch`: a sleeper whose food or water falls under `NEED_LOW` wakes.

- `NEED_LOW` is 15, named once, and the force reads the same constant. It was a bare 15 there.
- The threshold is not zero. Zero is where the body takes harm and where the thought reads "Is dying
  of thirst". A person woken there would lose hit points every night.
- The stretch gained a break that lands on the crossing, with `floor + 1` and not `ceil`. At 17 points
  an hour the division never came out whole and `ceil` looked right. At 16 it does come out whole,
  `ceil` stopped the stretch at exactly 15, the wake read `< 15` and did not fire, and the sleeper ran
  on to nought 53 minutes later. The zero edge keeps its own `j - 1`, because that one feeds a
  predicate read a tick ahead. Both conventions carry a comment.
- The wake adds no player-facing text. On the same tick the person already holds the `starving`
  thought. **No text a player reads changed in this task, so no review panel was owed.**

The same seventy days after the fix: four deaths, all of old age.

`tests/beings-lazy.js` carries the wake in its reference head and reads `NEED_LOW` out of the sim
rather than holding a copy. Two tests are new. One holds the water up through an eight-hour sleep and
keeps the claim that a sleeper by the fire is up at dawn and not later. The other takes the wake at
its own boundary: admitted at 20 points of water with an hour to fall through 15, refused at 40 over
the same hour, the two runs differing in one number.

That file's eight-hour run starts at 70.3 points of water and not 70. Water falls 16 points an hour,
so 225 ticks to the point, and a whole starting value puts the crossing exactly on a tick. There a
closed form and a sum of 12,375 separate subtractions cannot be made to agree: the sum's own drift
decides which side of 15 that tick falls on, and the two wake one tick apart. The third of a point
moves the crossing off the boundary.

## The finding for the plan: the valley stops growing

This is the largest effect of task 5 and it is not a test problem.

Seventy world days on seed `r`, measured at `374d055` and at `991681b`, with the same probe:

| | `374d055` | after |
|---|---|---|
| people alive at day 70 | 118 | 3 |
| people who ever lived | 147 | 7 |
| birth lines | 27 | 0 |
| deaths | 29, all of old age | 4, all of old age |
| chronicle lines | 395,724 | 486 |
| goals reached | 17 | 10 |
| wall time | 1,159.9 s | 209.4 s |

The cause is arithmetic, not a bug. A person who eats three times a day and drinks five has far less
of the day left, so work that scores low never wins. The offer "dig a deer pit" scores 34: I measured
a valley with the logs and the cord in its stash for twenty-five world days that never dug one, where
`374d055` dug its first at tick 535,000.

Two readings of this are both defensible, and the plan has to pick one. 118 people in seventy days was
itself absurd, and ruling 5 asks for a child every two years, so a valley of three is closer to what
the user described than a valley of 118. On the other side, the goal ladder and every offer score were
tuned against a world where needs cost almost nothing, and nothing has retuned them. **That retune is
task 11's, and I did not start it.** I set the rates from the spec, measured, and am reporting.

What it costs today, exactly: **seven tests in `SLOW=1 node --test tests/snapshot.js` go red, every one
of them on its own precondition and none on a story that differs.** That file was 49 pass, 0 fail at
`374d055` and is 42 pass, 7 fail now. Their messages:

- `no second camp was founded after the load, and this row is kept for that`
- `only 1 storm(s) after the load, and this row is kept for two`
- `this row is kept for a valley of two camps` (twice)
- `this world was meant to have more than one camp at the save`
- `no den was dug after the load, so startRegion and rimExits went untested`
- one `TypeError` downstream of the same empty world

These are the class the brief warns about, and they behave correctly: each asserts its own
precondition, so the suite goes red rather than silent. I weakened none of them and shortened no run.
They belong with the tuning decision, because hand-building seven worlds now would bake in a valley
the tuning pass may undo. I fixed only the eighth, `a world with pitfalls in it round-trips`, which is
in the fast suite's `LONG=1` set and which digs its pit through the real offer after the run.

**The snapshot itself is sound.** The soak's seventh test is red, and it compares against the golden
line rather than against a straight run, so it must be. I checked the claim the test is named for with
a probe: seed `x` saved on day 1.5, loaded into a fresh sim and run on to day 3 gives the straight
run's fingerprint field for field, `diffs []`, on the final code.

## Which fields of the soak's fingerprint moved

`node tests/soak.js` is red on all six seeds and on the seventh test. That is the expected outcome of
a duration change. **I did not run `UPDATE_GOLDEN=1` and I hand-edited neither record.**

| seed | fields that moved | counts that moved |
|---|---|---|
| r | chronicleLines, chronicle, beings, items, tiles | rabbits 38 → 43; caught 9 → 4; dragged 1 → 0 |
| x | chronicle, beings, items, tiles | strikes 0 → 1; taught 2 → 0; rabbits 9 → 10; caught 3 → 2 |
| alpha | chronicleLines, chronicle, beings, items, tiles | rabbits 42 → 41; caught 7 → 8 |
| beta | chronicleLines, chronicle, beings, items, tiles | strikes 0 → 2; taught 2 → 1; rabbits 23 → 26; caught 15 → 10 |
| gamma | chronicleLines, chronicle, beings, items, tiles | strikes 0 → 1; drivenOff 3 → 2; taught 3 → 0; deer 5 → 4; caught 2 → 1; alive 4 → 3; humans 4 → 3 |
| delta | chronicleLines, chronicle, beings, items, tiles | deer 8 → 6; caught 7 → 5; campsThatSawGnomes 1 → 0 |

`tick` and `legends` moved on no seed. The creation is untouched, which is what a table of durations
inside the settled world should do. Seed `x` kept its line count and changed its lines, which is the
same story told at different ticks.

Both records, unchanged, at the end of this task:

- `tests/soak-working.json` md5 `c71523b7838226c3b1618ab295dfdcfb`
- `tests/soak-golden.json` md5 `142f6c9a78d07e74d945648ccce70e6c`

## What state this change has that its tests never enter

The first two commits add no flag, no seam and no branch: they move numbers a rule already read, and
the built page reads the same table. The third adds one branch, the wake, and it has its own test at
its own boundary, admitted and refused.

The state the tests do not enter is the built page in a browser. Nothing in this task is view state
and no interface file changed, so `dist/hearth-sim.html` differs only by the table it embeds. I did
not open it in a browser. That is the honest answer and not a claim that it is fine.

Every comparison here that is made against a record is named as one: the soak's six golden lines and
its seventh test. The thing the seventh test is for, a save-and-load run against a straight run, I
checked separately, because a stored record agrees with any fault that draws the same numbers.

## Gates

Every count is pass / fail / skip. Every wall time carries the one-minute load average before and
after. All in `/Users/earchibald/Worktrees/hamlet-g4` at `991681b`.

| gate | result | wall | load 1 min |
|---|---|---|---|
| `node build.js`, then `git status --porcelain` | 740,039 bytes written, clean but for this report | — | — |
| `npm run fast` | 700 / 0 / 60 | 172.85 s, ceiling 300 | 2.02 → 5.37 |
| `node tests/soak.js` | 52 / 13 / 21 | 121.55 s, ceiling 180 | 4.63 → 3.36 |
| `node --test tests/clock.js` | 23 / 0 / 0 | — | — |
| `node --test tests/tasks.js` | 29 / 0 / 0 | — | — |
| `node --test tests/crafts.js` | 14 / 0 / 0 | — | — |
| `node --test tests/setclock.js` | 3 / 0 / 0 | — | — |
| `node --test tests/beings-lazy.js` | 20 / 0 / 0 | — | — |
| `node --test tests/skip.js` | 20 / 0 / 1 | 117.07 s | 2.70 → 2.38 |
| `node --test tests/types.js` | 2 / 0 / 0 | — | — |
| `SLOW=1 node --test tests/snapshot.js` | 42 / 7 / 0 | 643.14 s | 3.24 |

`node_modules/.bin/tsc` is a live symlink to `../typescript/bin/tsc` and `tests/types.js` reports two
passes and no skip, so TypeScript ran and neither check was waved through.

The 13 red in the soak are the six seeds' parent suites, their six `the run matches the golden record`
tests, and the seventh test. Nothing else in the soak is red: `nobody dies of anything but old age`
and `nobody is cut off from their camp` pass on all six seeds.

The 7 red under `SLOW=1` are the preconditions listed above.

### The skips, reconciled

- **60 in `npm run fast`.** The same 60 the task 4 remediation grouped, and the same count. They are
  the `LONG=1` and `SLOW=1` bodies of `tests/snapshot.js`, `tests/names.js`, `tests/ui.js` and the
  rest, each naming its own day count, its seconds and its flag in its skip line. Task 5 added none
  and removed none.
- **21 in the soak.** The same 21, unchanged: the floors task 1 suspended pending task 4, and the
  seeds and lengths that are not the default run.
- **1 in `tests/skip.js`.** `seventy world days on seed r tell the same story stepped and skipped`,
  which its own message puts behind `LONG=1`.

Every test I wrote or changed in this task carries no skip. The guard-boundary discipline the brief
asks for therefore applies to the one branch I added rather than to a skip, and the boundary test is
the one named above: admitted at 20 points of water, refused at 40.

### What each changed test crosses

- `tests/tasks.js`, the six new tests: three world days each, from 07:00 on day 1 to 07:00 on day 4.
  Each crosses three nights and three dawns, and the diagnostics print the hours asleep, so a run that
  stopped crossing a night would show as a count of one or two rather than three.
- `tests/beings-lazy.js`, the renamed eight-hour test: 22:00 on day 2 to 06:00 on day 3, so it crosses
  one dusk-to-dawn and the `NEED_LOW` crossing inside it. The new held-water test crosses the same
  eight hours and the dawn wake. The new boundary test crosses 23:00 to midnight and no dawn, by
  design: the claim is the threshold and not the light.
- `tests/crafts.js`: the per-offer budget is `hours(15)` where it was `ticks(600)`, which is 54,000
  ticks against 51,840. It crosses no season and no year; it is a budget for one craft and the longest
  job for a person of no skill is 6.75 hours.
- `tests/snapshot.js`, the pitfall test: 600,000 ticks, day 6.9, unchanged, plus at most 20 hours of
  one person's work afterwards. It crosses no season.
- `tests/clock.js`: no run at all. It reads the table and the files.

## What I left alone, and for whom

- **Every animal, sprite and gnome decay row** in `SPECIES` keeps its `tickRate` marker. Task 6.
- **The four sprite amounts** `danceGlows`, `danceRests`, `dancePlays`, `visitPlays` keep
  `strideRate`. Task 7.
- **The chase distances** `chase.*` keep `strides`. Task 7, under ruling 3.
- **`CLOCK.den.digRetry`** keeps its marker, as the plan instructs and `tests/clock.js` records.
- **The goal ladder's offer scores.** They are what the needs now outbid, and retuning them is the
  tuning pass. Task 11.
- **The night's length.** The sleep score of 55 and `WAKE_LIGHT` of 60 are what cap it at 6.5 hours
  instead of the spec's 8. Both are choices in `chooseTask` and `bodyStretch`, not rates, and neither
  is a unit conversion.

## The tree

`git status --porcelain` in `/Users/earchibald/Worktrees/hamlet-g4` is clean.
