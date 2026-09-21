# What the tiles field is expected to move for, written before the bless

Dev's `tileHash` (PR #76, dev at c567971) adds tile state to the soak fingerprint: ground, feature,
berries, fire, and a structure's type, fuel and lit flag. It is merged into `tiers-g4`.

**This list exists because a hash cannot be read.** At task 11 the golden is regenerated and the
tiles hashes regenerate with it, so an unintended tile change gets blessed in the same stroke as the
intended ones. The only defence is an argument made from the change, and an argument is worth more
written now, while each cause is still fresh, than reconstructed at the bless.

## The short answer

| # | cause | tile fields it moves | task |
|---|---|---|---|
| 1 | the plant block's chances are per look, not per tick | `berries`, `feature` (bush, sapling) | 1 |
| 2 | `strikeFuel` is a stock, not a duration | `fire`, and `feature` downstream of burning | 1 |
| 3 | the fire pit's fuel and lit flag | `struct.fuel`, `struct.lit` | 1 (pre-existing) |
| 4 | the cellular beat re-orders the draw stream | all of them, indirectly | 2 |

Causes 1 to 3 are **corrections**: the tiles field moves because the old behaviour was wrong. Cause 4
is a **re-ordering**: no rule changed its answer, but the random stream moved, so every downstream
tile differs. Cause 4 is the one that makes the other three impossible to isolate by the hash alone.

## The three corrections, with the sizes measured at the time

**1. The plant block.** Eleven chances in `CLOCK.plant` were converted as per-tick rates when each is
a chance for one LOOK, and the look count already carries the world time. Over one world day across
six seeds the effect was: berries +134 on dev against **-91** on the unfixed branch, bushes 21
against **0**, saplings 49 against **1**. The plants had stopped growing and nothing went red. The
marker `lookRate` now names these as identities so the conversion cannot be repeated.

**2. `strikeFuel`.** Converted as `ticks(240)` when 240 is an amount of fuel held, not a span. A
lightning fire burned for **20.74 world days** instead of dev's **0.24**. Now `stock(240)`.

**3. The fire pit.** Carried in from the task 1 handoff, not introduced by it.

Each of those three is a tile change the OLD fingerprint could not see. That is the point worth
making to whoever reviews the bless: **the tiles field is not going to move for the first time at
task 11 — it has been moving all along, unwatched.** Had `tileHash` landed a week earlier, the soak
would have caught all three instead of a hand search.

## Cause 4, and why it limits what this list can promise

The beat changes when a chance is drawn, so it changes the order of draws, so every seed walks a
different path through the same rules. The world after the beats is not the world before it with
three corrections applied — it is a different sample of the same distribution.

**So this list cannot promise that the tiles hash moves ONLY for these four reasons.** It can promise
what was found and fixed, and that the rate-level behaviour is held: `tests/beats.js` compares sums
across six seeds over a world day against a pre-beats baseline and fails outside 15 per cent. Berries
came in at +3.8 per cent and bushes at -8.7 per cent.

That test is the real guard on cause 4, because it asks about rates rather than about a hash.

## What is still owed before the bless

1. **A fourth and later re-take of the rate calibration**, on a grown valley rather than one world
   day. The plant rates are measured at day 1 and the population term is not.
2. **The six-seed 70-day run** (`LONG=1 SEEDS=r,x,alpha,beta,gamma,delta`), run as late as possible.
3. **Nothing in this list is a reason to bless.** It is a reason to be able to answer the question.
