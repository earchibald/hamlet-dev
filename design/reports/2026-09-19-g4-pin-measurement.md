# The pinned horizon: ruling 1 answered, and the question restated

Measured on `tiers-g4` at `884e66f`, six seeds, three world days, with later-day windows on two
seeds. **This is not a gate on task 4.** A predicate that later becomes the rule cannot also be the
thing that validates the rule.

## The short answer

| question | answer |
|---|---|
| Does anything structurally forbid the skip? | **No.** All eleven per-tick systems can be given a next beat; nine have one in the source today |
| Is the counter inert? | **Proved**, not assumed. Identical fingerprints with it on and off |
| Does the pinned share rise with population? | **Yes**, and the growth is entirely predator |
| Is fire the permanent cost we feared? | **No.** 0.00% on both seeds late. The 38% that prompted the worry was a bug |
| Is there a single pinned percentage? | **No, and that is the finding.** It is a function of a design parameter |

## Why ruling 1's question cannot be answered as asked

Ruling 1 assumed `p` is a property of the world: `p = 0.60 → 1.7×`, `p = 0.05 → 20×`. It is not. It
is a function of the hazard reach, and the reach is bounded below by the jump it is meant to enable.

A jump of N ticks is safe only if nothing can close on a person inside it. A running wolf covers two
tiles a tick, so a safe reach is about `2N`. **The skip is self-limiting: the longer the jump, the
wider the hazard circle, the more often it is occupied, the more often the horizon pins.**

Measured, six seeds, three world days. `speedup = 1 / (p + (1 − p) / N)`:

| reach | jump N | pinned `p` | fire | storm | predator | speedup |
|---|---|---|---|---|---|---|
| 2 | 1 | 9.79% | 1.79% | 9.74% | 0.05% | 1.00× |
| 5 | 2 | 9.94% | 1.79% | 9.74% | 0.20% | 1.82× |
| 10 | 5 | 10.43% | 1.79% | 9.74% | 0.71% | 3.53× |
| **20** | **10** | **13.23%** | 1.79% | 9.74% | 3.56% | **4.56×** |
| 30 | 15 | 17.79% | 1.79% | 9.74% | 8.66% | 4.30× |
| 60 | 30 | 36.41% | 1.79% | 9.74% | 28.98% | 2.60× |

**There is a real optimum, and it is about 4.6× at a jump of ten ticks.** Not the 1.7× that would
have killed the plan, and not the 20× that would have made it comfortable.

## The finding that matters more: this measurement was taken too early

Look down the fire and storm columns. **They do not move with reach.** They are a flat floor of
about 11.5 per cent, and `storm` alone is 9.74 per cent of it. That floor caps the whole thing at
10.2× however small the reach.

**That floor is exactly what task 2 removes.** The plan's task 2 puts every cellular system on a
one-minute beat and rolls each chance inside them with `rollFor(rate, CLOCK.every.cellular)`. Its own
checklist names them: `growPlants`, `spreadFire`, `updateWeather`, `strayLightning`, `rotCarcasses`,
`groveTick`. **`spreadFire`, `strayLightning` and `tryLightning` are the entire fire and storm
floor.** Once they roll over a span instead of once a tick, they have a known beat and they stop
pinning anything.

So after task 2 the only pin left is predator proximity:

| reach | jump N | predator-only `p` | speedup |
|---|---|---|---|
| 10 | 5 | 0.71% | 4.9× |
| **20** | **10** | **3.56%** | **7.6×** |
| 30 | 15 | 8.66% | 6.8× |

**The pinned fraction measured before task 2 measures the thing task 2 is built to delete.** Two
thirds of today's floor is scheduled for removal by the task that comes before the skip is written.

## What this means for the order of work

1. **Tasks 2 and 3 are not blocked.** Nothing structural forbids the skip, which is what ruling 1
   most needed to know, and it is answered.
2. **The pin measurement should be re-taken after task 2, and that re-take is the real go/no-go.**
   Today's numbers bound the answer from below: 4.6× with the floor, about 7.6× without it.
3. **The reach is task 4's to choose and cannot be measured out of the world.** It belongs in
   `CLOCK` with the jump it licenses written beside it, because the two are one decision.
4. **Predator is the only bucket that grows with population.** Seed `alpha`, reach 30: 2.91% over
   days 1 to 3 against 21.78% over days 28 to 30, with 57 alive. At reach 5 the same windows are
   0.00% and 1.15%. The trend is real at every reach; only its size is a design choice.

## Against the cost curve, which is the sober part

The budget is 5 s a world day. The long run measured **57 s a world day averaged over seventy days**,
rising with population, against 15 s at days 1 to 3. Task 3 carries its own reduction and task 4's
skip multiplies it, so the two must be read together and neither alone reaches the budget:

| | seconds a world day |
|---|---|
| measured, days 1 to 3 | 15 |
| measured, averaged over 70 days | 57 |
| 57 with today's 4.6× | 12.4 |
| 57 with a post-task-2 7.6× | 7.5 |
| the budget | **5** |

**The skip alone does not reach the budget on a grown valley.** Task 3 has to carry the rest. That is
not a new risk — the plan always had both — but it is now a number rather than a hope, and the
number says neither task has slack.

## How much of this to believe

The three-day figures are six seeds; the later-day figures are two. Seed variance is large: the union
at reach 30 runs from 0.69% on `r` to 39.29% on `beta`. **`beta` at 28.23% predator over days 1 to 3
is the seed to watch**, and it is the one I would re-measure first after task 2.

And one caution earned today. The first version of this measurement reported fire at 20.76% and a
ceiling of 3.4×, because `CLOCK.fire.strikeFuel` had been converted as a duration when it is a stock,
and lightning fires were burning for 20.7 world days instead of 0.24. Those numbers were plausible
and wrong. **They were caught because a bucket was too large to believe, not because anything went
red.** Treat every figure here as provisional until it is taken again on a world that task 2 has
finished with.

## The re-take, and the retraction it forces (added after task 2)

I said the fire and storm buckets would vanish once `spreadFire`, `strayLightning` and `tryLightning`
came off the per-tick path, and that a re-take would show the floor gone. **The re-take shows the
floor still there. The prediction was wrong, and it was wrong for a reason worth more than the
prediction.**

Six seeds, three world days, after the beats:

| reach | union | fire | storm | pred | before: fire | before: storm | before: pred |
|---|---|---|---|---|---|---|---|
| 2 | 9.82% | 3.18% | 8.43% | 0.14% | 1.79% | 9.74% | 0.05% |
| 5 | 10.59% | 3.18% | 8.43% | 0.92% | 1.79% | 9.74% | 0.20% |
| 10 | 11.76% | 3.18% | 8.43% | 2.13% | 1.79% | 9.74% | 0.71% |
| 20 | 13.96% | 3.18% | 8.43% | 5.16% | 1.79% | 9.74% | 3.56% |
| 30 | 16.15% | 3.18% | 8.43% | 7.83% | 1.79% | 9.74% | 8.66% |
| 60 | 34.48% | 3.18% | 8.43% | 29.08% | 1.79% | 9.74% | 28.98% |

Fire went **up**, from 1.79% to 3.18%. Storm barely moved. The floor is 11.5% before and 11.6% after.

### Why the instrument could not have shown what I claimed

Read the probe in `pin.js` rather than the numbers it prints:

```js
const fire  = api.fireCount > 0;
const storm = !!api.weather.storm;
```

**Those are hazard presence, not per-tick work.** A tile is burning or it is not; a storm is on or it
is not. Task 2 changed how often the rules *look* at a burning tile. It did not change whether a tile
is burning. So this predicate was never sensitive to the thing task 2 does, and the re-take was not
the test I described. **I named it the direct test of task 2's purpose. It is not a test of it at
all.**

The pinning claim lived in the probe's own header comment — `fire: anything burning, so spreadFire
must run at every tick` — and that sentence is now false, because `spreadFire` runs on a one-minute
beat. The predicate outlived its justification and kept printing the same shape.

The small movements are real world changes from the beats: `rollFor` compounds where the old code
multiplied, and the draw order moved. They say nothing about pinning either way.

### What the numbers do support, stated as argument and not as measurement

After task 2, fire and storm resolve at known ticks. A horizon that knows the next beat does not need
to pin for them. **That is an argument from the code's structure, and I am labelling it as one,
because the measurement above cannot back it.** Under it, the predator column alone sets the ceiling:

| reach | jump N | union `p` | union speedup | predator-only `p` | predator-only speedup |
|---|---|---|---|---|---|
| 5 | 2 | 10.59% | 1.81× | 0.92% | 1.98× |
| 10 | 5 | 11.76% | 3.40× | 2.13% | 4.61× |
| 20 | 10 | 13.96% | 4.43× | 5.16% | 6.83× |
| **30** | **15** | **16.15%** | **4.60×** | **7.83%** | **7.16×** |
| 60 | 30 | 34.48% | 2.73× | 29.08% | 3.18× |

The optimum moves from 4.6× at jump 10 to **7.16× at jump 15**, and the curve is flatter at the top,
so reach 20 to 30 is a band rather than a point. That is close to the 7.6× predicted earlier, by a
different route, and it should be treated as the weaker kind of evidence.

### What task 4 owes because of this

1. **Rewrite the probe before it is trusted again.** A pin predicate must ask *is there unresolved
   per-tick work inside the jump*, not *is a hazard present*. For fire and storm that is now: does a
   beat fall inside the jump. Write it that way and re-run; that run is the go/no-go, not this one.
2. **The reach band is 20 to 30**, worth 6.8× to 7.2×, and the top of the curve is flat enough that
   the choice can be made on safety instead of speed.
3. **`beta` is still the seed to watch**, and the predator term is still the only bucket that grows
   with population.

### The honest summary of task 2

Task 2 bought **no speed** — a paired run against the base tree measured 1.00×, and the six cellular
systems are at most 0.4% of runtime. It bought two structural things task 4 needs: every cellular
system names the tick of its next beat, and the three per-tick rollers are off that path. Whether
that second thing lifts the ceiling is **not yet measured**, and the measurement that was supposed to
settle it asked the wrong question.
