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
