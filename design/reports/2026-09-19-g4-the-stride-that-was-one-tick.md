# The stride that was one tick

`strides()` on G4 is `n => Math.round(n * 172.8)`, which is `2 x 86.4`. It encodes one claim: **a
task stop was two old ticks.** That claim is true for most of the table and false in two places, and
where it is false the value comes out at twice its old world meaning.

The finding is patcher's. The mechanism and the arithmetic below were verified in both trees before
this report was written, because a constant is branch-local and reading one on `dev` to reason about
G4 is the error four sessions made on 2026-09-19.

## The rule

| dev gate | who | `strides()` |
|---|---|---|
| 2 | a normal task, any species but the sprite | correct |
| 1 | **every sprite task** — `stride: ticks(1)` at `src/sim/species.js:11` on dev | **doubled** |
| none | **every `fast` task, any species** — `beings.js:394` skips the gate | **doubled** |

The gate on dev reads `if (!fast && (tick + a.id) % sp.stride) return;`. It sits above `chooseTask`
and `runTask`, so it decides how often a being's head runs at all. A sprite cleared it every tick.
A `fast` task never met it. Both accrued one progress a tick, not one every two.

Every species carries `stride: ticks(2)` on dev. The sprite alone carries `ticks(1)`. The whole
`CLOCK.sprite` block is byte-identical on the two branches; only the helper under it changed.

## What is doubled

Five durations, all consumed as `t.progress` inside the sprite's own tasks in `src/sim/fae.js`:

| value | written | consumer |
|---|---|---|
| `dance` | `strides(240)` | `fae.js:37` |
| `danceSeen` | `strides(40)` | `fae.js:34`, a modulo of the same progress |
| `mossEvery` | `strides(200)` | `fae.js:36`, likewise |
| `visit` | `strides(160)` | `fae.js:58` |
| `visitGift` | `strides(120)` | `fae.js:57` |

Four rates, all applied once per run of the same tasks, and so **halved**, not doubled:
`danceGlows`, `danceRests`, `dancePlays` (`fae.js:33,35`) and `visitPlays` (`fae.js:55`), written
`strideRate` at `clock.js:97`.

Five progress limits on `fast` tasks, which the sprite reading does not reach and which patcher
named as the next place to look:

| value | written | task | `fast` at |
|---|---|---|---|
| `chase.spearSprite` | `strides(90)` | going after the sprite with the spear | `fae.js:4` |
| `chase.wolf` | `strides(140)` | a wolf stalking prey | `species.js:40` |
| `chase.wolfPerSkill` | `strides(30)` | the same limit, per skill | — |
| `chase.stalk` | `strides(160)` | stalking someone alone in the dark | `species.js:77` |
| `chase.guard` | `strides(200)` | grabbing a firebrand | `tasks.js:411` |

## What is not

`chase.deer`, `chase.deerPerSkill` and `chase.deerMissed` are correct as written. The deer hunt
declares `fast: false` explicitly at `src/sim/tasks.js:392`, so it met the gate and its stop was two
ticks. The author distinguished the two cases. The converter did not.

## What a player would see

A dance is `240` sprite stops. On dev that is 240 ticks. On G4 it is `240 x 172.8 = 41472` ticks,
and a tick is a world second, so **11.5 hours**. Night runs 20:00 to 06:00, ten hours
(`clock.js:84`). Nothing in `fae.js:37` bounds the dance by night. So a dance now outlasts the
night it belongs to, where before it filled a little over half of one.

A gift on the offering stone lands at `visitGift`, now 5.8 hours into a visit that itself runs to
7.7 hours or dawn, whichever comes first. It is still reachable, and it asks for twice the watch
inside a night that did not get longer. That gift is the payoff of the `stone` and `offer` goals.

The five `fast` limits let a predator press a chase twice as long. That is a change in how often a
hunt ends in a kill, and any death in a 70-day soak that is not old age is a bug until proven
otherwise. The population finding runs the other way and no link is claimed here; this is named as
a thing to measure, not a thing concluded.

## The remedy, and the test that must come first

The conversion for all fourteen is `ticks()` for a duration and `tickRate()` for a rate: a stop was
one old tick, so the factor is `86.4`.

Write the failing test before the change. Assert a converted value against its world meaning on dev
and watch it go red on G4 first. A still-green suite proves nothing here, and a doubled duration
blessed into the working record as a sprite balance change is exactly the berry-class fault this
branch exists to catch: the rule did not fail, it stopped happening on time.

## Credit

patcher found the leak, decided the sprite's stride question that sat behind it, and named the
`fast` tasks as the next place to look. The design decision — no species gets a movement advantage
back, and the sprite's character is its needs, its hours and its glow, not its feet — is theirs and
stands. The `fast` half of the table and the `deer` exception were verified here.
