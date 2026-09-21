# The valley fills two to three times faster, and why that is not a bug

Found while running `tests/ui.js`, one of the six files suspended for G4, after merging dev
`c567971`. The test failed. Chasing it produced a real finding that has nothing to do with the test.

## The short answer

| day 25, seed x | dev `82ef65c` | G4 |
|---|---|---|
| humans | 7 | **25** |
| camps | 1 | 3 |
| arrivals over the hills | 6 | **22** |
| arrival gate passes | 63% | **94%** |
| gate blocked by food | 33% | **4%** |
| sleeping places built | 3 | 5 / 6 / 3 |

Population at day 25 across seeds: dev 7, 7, 7, 8, 13, 16. G4 19, 25, 26. **G4's minimum is above
dev's maximum.** This is not seed variance, and it was checked against six dev seeds before it was
called anything.

## The chain, and which link is still inference

1. The rise is **arrivals, not births**. Both branches start from one human and one camp.
2. The arrival cadence is **identical in world time**. `wait` and `spread` are 0.9 days on both,
   `chance` is 0.7 and `villageChance` 0.85 on both. Nothing in the arrival block converted wrongly.
3. The **gate stops blocking**. `pitLit() && stashFood() >= foodTarget() && campHumans().length <
   4 + bedsFor() && !isWinter()` at `src/sim/camps.js:336`. On dev, food blocks a third of camp-days.
   On G4 it blocks one in twenty-five.
4. The camps **provision faster**: more food held, more sleeping places built.
5. The driver is the retune's two deliberate per-tick quantities. **This link is inference.**

## The two quantities, both deliberate and both task 3's

`src/sim/beings.js:393` — the stride gate is gone. It was one number doing two jobs, the cadence of a
being's thinking and the speed of its walk. The head now runs **every tick** until task 3 sets its
cadence. The comment says it plainly: "slow on purpose and is reported, not hidden".

`src/sim/tasks.js:46` — a tick is one world second and a tile is a stride, so walking is **one tile a
tick**. A 57-step path cost about 82 world minutes on dev. It costs 57 world seconds here.

Travel is therefore about 86x cheaper relative to work, and the head re-decides about 86x more often.
Gathering food is travel-bound; felling is not. That is why felling is flat per head — 100 against 54
with twice the people — while food stops being the limiter.

**Felling being flat was the number that nearly killed the travel reading.** It looked like proof that
people were no more productive. It is not, because felling is bound by trees and the axe and food is
bound by walking. One number was being used to test a claim about a different kind of work.

## What closes the last link, and where it cannot be run

A walk-speed sweep: two or three speeds, not one, because a single point can be fitted by any story.
Hold the head's cadence fixed across the sweep, or the two quantities move together and the result
names neither.

**It cannot be run on dev.** There `stride` is one number doing both jobs, which is the thing the
retune separated. Varying it moves both. The sweep has to run on G4, where `stride` is speed alone.

## Why this outranks the eleven-systems table

The table decides whether tasks 2 and 3 are built. Until task 3 restores the head's cadence, the
retune changes **how fast the valley fills**. That is a gameplay change sitting inside a performance
plan. A ruling on which systems are cellular, made without knowing the valley now fills two to three
times faster, is a ruling made on a false picture.

The table's structural argument does not change. Every number beside it does.

## What this cost, and what it says about the suspension

`tests/ui.js` is suspended for G4 on grounds of wall-clock cost. It is also the only file that
watches this surface. `npm run fast` has been green through two tasks over a valley growing at two to
three times dev's rate.

The suspended set is not random: a file is slow because it exercises a lot. Suspending for time
removes the most surface, during the one kind of change whose characteristic failure is a rule
quietly ceasing to fire. Filed by patcher as #82.

## Retracted on the way here

Six readings died to measurements tonight and none to an argument. None reached the tracker.

| reading | killed by |
|---|---|
| sprites stopped being seen | the sighting fires correctly; camp 0 was never visited |
| dev wins a coincidence the retune loses | all three G4 arrivals had awake humans present |
| felling stopped, so the search never ends | G4 fells 100 to dev's 54 |
| 22 founders against 13 | nobody is a founder; both start from one human |
| the chronicle is 36x too long | seed r alone; x and alpha are about 3x |
| the item search and the sector counter disagree on reservations | `world.js:55` carries the same predicate |

Two of those are the same error made twice in one hour: generalising from seed r, the one seed that
bursts. The guard against it is the one that worked every time — take the control first.

## A sixth consequence, found while checking a number for another session

`stride` meant one thing on dev and means another here, and the change was named while one of its
effects was not.

| species | dev `stride` | G4 `stride` |
|---|---|---|
| human, rabbit, fox, wolf, deer, gnome | 2 | 1 |
| **sprite** | **1** | **1** |

On dev, `stride` was the **gate interval**: a being moved one tile every `stride` ticks. So a human
moved one tile per 172.8 world seconds, and **the sprite was the only thing in the valley that walked
at double speed.** On G4, `stride` is a **speed in tiles a tick**, and every species is 1.

The flattening is intended. The plan's task 5 says the `stride` column becomes "a speed in tiles a
tick: 1 for a walk, 2 for a run". What the plan does not say, because nobody noticed, is that one
species was already distinguished by that column. **Sprites now move like people.**

This is a question for the user and not a fix to make quietly. A sprite that keeps pace with a human
is a different creature from one that flits, and the difference is visible in play.

It also corrected the travel ratio, in dev-coordinator's favour and against mine. I had travel at
86.4x cheaper and was about to send a correction saying so. The true figure is **172.8x** for every
species but the sprite, whose travel is 86.4x cheaper. I had assumed `stride` was 1 on dev without
opening it.

That is the same error three sessions have now made in one evening, in three directions: reading a
constant on one branch and reasoning about another. A legacy marker's definition is branch-local, and
on this branch the markers are the whole subject.
