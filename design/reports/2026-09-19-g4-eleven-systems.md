# The eleven per-tick systems: can each be given a next beat?

The reading half of ruling 1, and the half that can invalidate the other half. `updateBeing` is not
here: this is `updateWorld` only, the eleven systems that run before any being moves.

**The question.** The skip jumps from tick A to tick B. A system can be jumped over when the tick it
next needs to run can be named at A. A system that must run at every tick whatever else is true pins
the horizon at every tick, and a horizon pinned at every tick is a skip with a ceiling of 1.

**The answer: all eleven can be given a next beat.** Nine have one already, in the source, today. Two
have one except under a named condition, and those two conditions are the same two the pinned
percentages are being measured for. **Nothing here forbids the skip.**

| # | system | what decides whether it works | draws a random number unconditionally? | next beat |
|---|---|---|---|---|
| 1 | `spreadFire` | `if (fireCount <= 0) return` | no, and nothing at all when nothing burns | **while anything burns, every tick.** Otherwise never, until something is lit |
| 2 | `updateWeather` | `tick >= weather.next`, `tick >= weather.until` | no | **stored in state**: `weather.storm ? weather.until : weather.next` |
| 3 | `updateCamps` | see the breakdown below | only inside `tryLightning`, and only in a storm | the earliest of its parts, below |
| 4 | `growPlants` | a closed form of `tick` | no. Task 1 made the look count `floor(at + rate) - floor(at)` for exactly this reason | **any tick.** The looks from A to B are `floor(B·r) − floor(A·r)`, so a jump takes them in one batch |
| 5 | `strayLightning` | `weather.storm && rng() < rate` | **yes, in a storm.** Outside one the `&&` short-circuits and nothing is drawn | outside a storm, `weather.next`. In a storm, every tick unless rolled over the span |
| 6 | `rotCarcasses` | `tick % CLOCK.every.carcassRot === 0` | no | exact: the next multiple |
| 7 | `groveTick` | `tick % CLOCK.grove.every === 0` | no | exact: the next multiple |
| 8 | `denTick` | `tick % CLOCK.den.birthEvery === 0 && spring` | no | exact: the next multiple, and it can skip to spring |
| 9 | `gnomeTick` | `tick % CLOCK.gnome.every !== 0` returns | no | exact: the next multiple |
| 10 | `spawnWildlife` | five blocks, each `tick % N` | no. Every roll sits behind a period guard | exact: the earliest of the five |
| 11 | `godsTick` | `tick % CLOCK.every.godsRest !== 0` returns | no | exact: the next multiple |

## `updateCamps`, the only one that needed reading rather than looking

It is the one system with no guard at its head, so it is the one that looked most likely to pin.
It does not. Its parts:

| part | kind | next beat |
|---|---|---|
| `afterTheLast` | sets `wanderAt = tick + …` | an explicit future tick |
| `theLoneFounder` | sets `doomAt` the same way | an explicit future tick |
| the pit burn | `p.fuel -= rate × modifiers`, `litTicks++`, `streak++` | **closed form.** No roll. The fire going out is not random: it is `fuel / (rate × modifiers)` ticks away, and each modifier — storm, winter, the sprites' favour — changes at a tick that is itself known |
| `spoilFood`, `faeTick` | `tick % CLOCK.every.{spoil,fae}` | exact multiples |
| the village promotion | state, not the clock | changes only when a storehouse, a hut or a member does |
| births | `tick % CLOCK.birth.every` then `rng()` | exact multiple; the roll is behind the guard |
| `tryLightning` | `camp.site && weather.storm && rng()` | **in a storm, every tick.** Otherwise nothing is drawn |
| arrivals | `tick >= camp.nextArrival` | **stored in state** |
| `nameTick` | `tick % DAY !== CLOCK.names.nameHour` | exact: once a night |

**The pit burn is the important line in this table.** It is the one part of the engine that changes a
camp's state on every single tick, and it was the obvious candidate for a structural pin. It is not
one, because it is arithmetic rather than a roll: the tick a fire goes out can be computed at the
moment it is lit. A system whose next event is a division does not need to be stepped to reach it.

## What this leaves

Two conditions, both episodic, both already named as the buckets to measure:

1. **Anything burning** — `spreadFire` must run each tick.
2. **A storm** — `strayLightning` and `tryLightning` each draw once a tick.

Neither is structural. Both are states the world enters and leaves, and both are rewritable as a roll
over a span, which is what task 2 does to every chance inside a cellular system. **So the fire and
predator percentages are the whole question after all**, which is the answer ruling 1 hoped for and
was right not to assume.

## The caveat that should travel with this table

This is a reading of the source, not a measurement, and it says what CAN be given a beat, not what
HAS one. Nine of the eleven have an exact beat today. Two need task 2's rewrite before their beat
exists. **A system that can be given a beat is not a system that has one**, and the distinction is
the same one this report has been wrong about twice: a rule that reads correct is not a rule that
runs correct. The pinned percentages measure what actually happens; this table only says that nothing
makes the measurement pointless before it is taken.
