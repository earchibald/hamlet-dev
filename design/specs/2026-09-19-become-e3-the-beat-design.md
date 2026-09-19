# Become E3: the beat

The third slice of piece E. It makes one act, not one age, the unit the player watches and steps
through. It adds no new power to the player; it changes the rate at which the creation is handed to
them.

| Part | What changes | Where |
|---|---|---|
| The beat | One act is one unit of playback. An age is as long as it has acts. | `src/ui/derive.js` |
| The suspension | The age stops after every act, not only at a player's turn. | `src/sim/gods.js` |
| Step | `.` plays one act and holds. It never cuts. | `src/ui/actions.js`, `src/ui/map.js` |
| The pace ladder | 1/4, 1/2, 1, 2. Nothing faster; `H` hurries. | `src/ui/state.js`, `src/ui/panels.js` |
| The field | Redrawn after each act, from the state that act left. | `src/ui/map.js` |
| The caption | Names the act being played, not the age. | `src/ui/map.js` |
| The timeline | Lights the cell of the act being played. | `src/ui/timeline.js` |
| The gate | Act by act equals age by age, on twenty-four seeds. | `tests/ages.js`, `tests/ui.js` |

## Why

E2 put the whole record of a creation on the screen and answered the question the slice existed to
ask. Section 19 of `design/notes.md` holds the figures: about eighty decisions by up to eight gods,
over in about forty seconds, and a third of every creation is the same act. The finding was that the
information was never missing. It was never held still.

The user named the two halves of the fault exactly:

> we need the animations when we step! if we jerk forward to the next frame we are back to an
> impenetrable slideshow. if we let it run in realtime, it is much, much too fast to process.

Both halves are true, and they have different causes.

**Stepping cuts.** `ACTIONS.step()` is `setPaused(true); step(); renderUI(true)`. `drawField()` then
reads `const still = paused || anyDialogOpen()` and forces the tween fraction to 1. The tween's clock
is `acc`, which the frame loop advances only while the world runs. So the cross-fade, the walk, the
act's figure, the caption and the intent cue — all built for issue #11, all tested — have never once
run on a stepped age. The comment on that line was written for a world the player paused mid-tween.
It was never reconsidered for a world the player stepped. This is a switch in the wrong position, not
a missing feature.

**Running crowds.** `TWEEN.stagger` is `1/3`, so the gestures of an age overlap by design. On a seed
with eight gods, eight acts are drawn over each other inside two seconds. Slowing that down gives the
player longer to watch eight things at once. The density is the fault, not only the speed.

## The beat

One act is one beat. An age of four acts is four beats and then a fifth, its close. An age of one act
is two beats. An age is as long as it has something to say.

`BEAT_MS` is 1000 and replaces `AGE_MS` as the view's unit. A creation of about eighty acts and about
twenty age closes is about a hundred beats, so about a hundred seconds at single speed.

The tiers are unchanged and keep reading the length of the unit at run time, now `BEAT_MS / pace`. No
branch names a pace, as before.

| Beat length | What runs | On the new ladder |
|---|---|---|
| 1000 ms or more | The intent cue, the walk, the figure, the caption, the cross-fade. | 1/4, 1/2, 1 |
| 300 to 1000 ms | The same, without the intent cue. | 2 |
| 100 to 300 ms | The walk and the cross-fade. | — |
| Under 100 ms | Nothing. The field snaps. | a hurry |

The last two tiers keep their code. A hurry, a thrown-back valley, a new world, and a frame that ran
two or more beats still snap.

## What the simulation gives

The view cannot invent a half-finished age, and it must not. The user was explicit: an age is a
linear series of moves, not a snapshot. So the simulation stops between the moves.

`ageDecide()` already stops mid-age. That is how `openTurn` hands a turn to the player. E3 needs the
same stop on a different trigger: advance one god, then return. `agePos` already carries the position,
the snapshot of the age's gods, `prepared`, and the drawn matrix, so a resume needs nothing new.

The shape of the change belongs to the session that owns `src/sim/gods.js`. This spec records only
what is required of it:

- Advance exactly one god of the age, then return, without ending the age.
- Leave `agePos` fit to resume, as it already is for an abandoned turn.
- Do not run once-per-god work twice. `agePos.prepared` and `agePos.opts` already hold this.
- End the age as its own step, so the close can be drawn as its own beat.

Nothing else in `src/sim/` is in scope. `AGE_MS` lives in `src/ui/state.js`, so every pacing decision
in this spec is view state and none of it passes the door.

## Step

`.` advances one beat and lets it play while the world is paused.

- The `still` rule splits in two. A world the player paused *mid*-beat holds where it stands, so
  nothing sits half drawn. A world the player *stepped* plays its beat to the end and then holds.
- A stepped beat always plays at the full tier, whatever the pace buttons say. Step is the reading
  mode; the pace buttons govern running.
- `.` pressed again while a beat plays finishes that beat at once and starts the next. Holding the
  key flips through acts, each one started properly.
- `.` reads "Step one act" in the gods era. In the days era it is unchanged.

The clock for a stepped beat cannot be `acc`, which the frame loop advances only while the world
runs. The beat carries its own clock, advanced by the frame loop whether or not the world runs, and
the frame loop keeps drawing while it has a beat to play.

## Running, and the pace ladder

The pace buttons become 1/4, 1/2, 1 and 2. Single speed is the default and the readable one. The two
slow settings are for study. Two is a second pass and drops the intent cue.

Nothing above two. `H` hurries the rest of the creation to the valley, and that is what a player in a
hurry wants. The ages are minutes of a game measured in hours, so a setting that skims them and still
draws them serves nobody.

`agesDue` becomes `beatsDue` and keeps its cap: more than eight beats in one frame is a tab that
slept, and it snaps.

## The field

Each beat cross-fades from the field as it was before that act to the field as it is after it. The
state is the simulation's own, taken after each act rather than after each age.

The existing two-cache cross-fade in `drawField()` carries over unchanged in shape. What changes is
its key: the field is now redrawn when the beat count moves, not when the age moves. A cut is still
held out of the field cache until its own stroke finishes.

The gestures of a beat are that beat's act alone. `TWEEN.stagger` and `gestureSlice` are no longer
needed for the gods era and come out; one act has no one to be staggered against. They stay only if
some other caller needs them, and none does.

## The caption

The caption names the act being played. Each record in `creation.gestures` carries `said`, the index
of the legend line that act wrote, so the line is read from the record rather than guessed from the
age. Where a gesture has no `said`, the caption is empty for that beat.

The age's close takes the newest major line of the close, which is where the rest gate, the strain
and a backstop speak.

## The timeline

The cell of the act being played is lit, in the folded row and in the unfolded grid. Nothing else
about the timeline changes.

This is the whole point of the slice: what the player watches and what the player reads name the same
act at the same moment.

## Determinism and tests

A creation watched act by act must equal a creation watched age by age, line for line. Pacing is view
state and never passes the door, so a failure here means something has leaked into the rules.

- `tests/ages.js` gains the gate: all twenty-four seeds run act by act and match the fingerprint of
  the same seed run whole. This extends the gate E1 built, which already suspends and resumes every
  age.
- `tests/ui.js` covers the new pure parts in `derive.js`: the beat count of an age, the beat at a
  fraction, the tier of a beat at each pace, and the close counted as a beat.
- `tests/ui.js` covers the split `still` rule: a paused world holds, a stepped world plays.
- `npm run soak` must not move. No number in this slice enters `src/sim/`.

## What is deferred

- The turn card, and `Take a god` on the start dialog. E3 was specced as these before E2 measured the
  fault. The measurement said the fault was reading, not acting, so they wait for a later slice.
- Stepping backwards through beats. The record holds what happened, but the field does not, and
  running the rules backwards is not a thing this engine does.
- A stop on an event, which still needs an event kind on every chronicle line. That is G section 7.
- The other three inhabit modes, as before.
