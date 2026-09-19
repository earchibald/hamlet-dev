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
| The hurry | `H` asks before it skips. It cannot be taken back. | `src/ui/actions.js`, `src/ui/dialogs.js` |
| The act's face | Every act draws a figure and a word, not only lines and colour. | `src/ui/map.js` |
| Take a god | A second button on the start dialog. No longer deferred. | `src/ui/dialogs.js`, `src/ui/actions.js` |
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

The session that owns `src/sim/gods.js` has read the change and set its shape. It holds four
conditions, and they are requirements, not preferences.

**A flag on `ageDecide`, not a second entry point.** A second entry point is a second copy of the
`while (agePos.i < list.length)` loop and of the `prepared`/`opts` invariant. The file already avoids
that on purpose: both paths that advance the age call `agePass()`, and there is one copy of the
invariant. `ageStep` passes the flag through.

**The return goes after `agePass()`, and inside the awake branch.** Return before the position
advances and the resume re-enters the same god with `prepared` already true, so `decideGod` runs
twice on one god against a matrix drawn once. That moves the stream. Return outside the awake branch
and an asleep god yields a beat in which nothing happened. A local `acted` in the awake branch, and
`if (oneAct && acted) return false;` after `agePass()`.

**`ageDecide`'s `false` becomes ambiguous, and the file must say so.** Today `false` means one thing:
a turn is open and `pending` is set. After the change it means a turn is open *or* one act is done.
`pending` tells them apart, but only by implication, and `takeTurn` and `ageStep` both rely on the
old meaning. The invariant goes in the comment above `ageDecide`, in that file's voice.

**The age's close is one beat and is not subdivided.** `ageEnd` runs `unmake` over the pantheon
first and `restGate()` second. Draw between the two and the field shows gods already gone against a
gate that still counts them, and `strain` and `outgrown` then read that gate. The three sites that
set `settleNow` or `creation.failed` are worse to observe mid-way, because the view would draw a
world that is already discarded.

### One line moves, and it is meant to

`ageDecide` opens with `tellIfGone()`. Today it runs once an age. Act by act it runs after every act,
so the line that tells the player their god is gone — "acts no more. Take another god, or watch." —
arrives one act after the god goes rather than at the next age boundary.

This is deliberate and it is the better behaviour. It is safe: `inhabitedTold` makes it idempotent,
it draws no random number, and `inhabited` is null in every headless run, so the golden's `chronicle`
and `chronicleLines` cannot move. It is recorded here because `note()` writes the chronicle, so this
is a real change to when a player-facing line appears.

The general rule it stands for: `ageDecide` stops being a once-an-age entry point. Anything inside it
that assumed otherwise must be re-read. `tellIfGone` is the only one today.

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

## The hurry confirms

`H` skips the rest of the creation and cannot be undone. Under E3 it throws away the thing the slice
exists to show, so it asks first. The dialog names what is lost — the rest of the creation, drawn —
and offers to go on or to stay. The ages hold while it is open, as they hold behind any dialog.

A hurry is still a hurry once confirmed: it snaps, draws nothing, and ends in the day era.

## The act's face

Colour, lines and a moving star do not say what a god did. A split and a claim both recolour a
country. A burn, a freeze, a hiding and a showing all wash it. The player is asked to read fifteen
acts from four visual devices, and cannot.

So each act draws its own figure and its own word, on the ground it names, for the length of its
beat. Fifteen acts need fifteen faces:

`split`, `claim`, `make`, `raise`, `dig`, `flow`, `pool`, `burn`, `freeze`, `hide`, `show`,
`battle`, `twist`, `mingle`, `sleep` — and the three gestures that are not acts: `born`, `unmade`,
`backstop`.

The figure is drawn on the map canvas, in the palette already defined, and fades with its beat. It is
never a sprite sheet and never an emoji: the game draws its own marks, so the interface draws in the
same hand.

The design of those marks is a visual question and is settled by mockup, not by prose. The mockups
decide: the shape of each figure, where the word sits relative to the figure and the ground, how a
figure reads against a dark country and a light one, and what happens when two acts in consecutive
beats touch the same country.

## Take a god

Not deferred. E3 cannot be tested by hand without it, and a slice about what the player experiences
must be reachable by a player.

The start dialog gains a second button beside `Make world`: `Take a god`. It makes the world, takes
the first god, and opens in control and paused, so the creation begins on the player's own step.

This is E1's `become` act through the door, with no new power behind it. The turn card is still
deferred; a player who takes a god this way sees the matrix in the foot, as E2 already draws it, and
chooses through the existing acts.

## Determinism and tests

A creation watched act by act must equal a creation watched age by age, line for line. Pacing is view
state and never passes the door, so a failure here means something has leaked into the rules.

- `tests/ages.js` gains the gate: all twenty-four seeds run act by act and match the fingerprint of
  the same seed run whole. This extends the gate E1 built, which already suspends and resumes every
  age. Two sharpenings, both required:
  - **At least one seed runs with a god inhabited.** Act-by-act alone never sets `pending`, so a gate
    without it never interleaves the two reasons an age suspends. That interleaving, through one
    `agePos`, is where `prepared` and `opts` would break.
  - **Assert the stop count, not only the fingerprint.** Equal fingerprints prove the stream did not
    move. They do not prove the stops are where the view thinks they are. Count the suspensions and
    compare against the awake gods advanced. A stop that skips a god, or fires twice on one, passes a
    fingerprint check and breaks playback.
- The ages gate is not the golden gate. If the soak's creation-to-settle path runs through this,
  prove it with a field-by-field diff against the commit this work branches from — not against a
  remembered number, because dev moves underneath. Expecting nothing is not measuring nothing.
- `tests/ui.js` covers the new pure parts in `derive.js`: the beat count of an age, the beat at a
  fraction, the tier of a beat at each pace, and the close counted as a beat.
- `tests/ui.js` covers the split `still` rule: a paused world holds, a stepped world plays.
- `tests/ui.js` covers that every gesture kind has a face and a word, so a new act cannot reach the
  map with nothing to draw. This is the same shape as the rule that every button has a key.
- `tests/ui.js` covers that the hurry asks before it skips, and that declining leaves the creation
  where it stood.
- `npm run soak` must not move. No number in this slice enters `src/sim/`.

## What is deferred

- The turn card. E3 was specced as the card before E2 measured the fault, and the measurement said
  the fault was reading rather than acting. `Take a god` is no longer deferred with it: without a way
  in, E3 cannot be tested by hand. The card itself waits for a later slice.
- Stepping backwards through beats. The record holds what happened, but the field does not, and
  running the rules backwards is not a thing this engine does.
- A stop on an event, which still needs an event kind on every chronicle line. That is G section 7.
- The other three inhabit modes, as before.
