# Become a god: the first inhabit mode, and the timeline

Design spec, 2026-09-18. Approved in conversation, section by section. Implementation follows in plans.

This spec is the first slice of piece E, the inhabit modes. It builds one of the four: **Become**, where the player is the mob. It builds it for a god in the creation ages, not for a person in the days. It also builds the **timeline**, the widget that carries the record of what happened and the marks for what the player waits for. The timeline is built once here and inherited by every later slice of E.

`design/settings.md` is the register. The mythos spec named the four modes and reserved the Locked clock. This spec builds the lock.

## Summary

| Decision | Choice |
|---|---|
| What is built | Become, for a god, in the ages. And the timeline. |
| Why a god first | The ages are the part of the game a watcher cannot read. Playing them is the instrument for finding out why. |
| A turn | The clock locks when a choice is open and runs free between. Combat has its own timescale; it is not in this slice. |
| The acts | Four at the door: `become`, `choose`, `run`, `watch`. Shaped to hold Possess, Vessel, and Manifestation. |
| The choice matrix | `godOptions(g)`, unchanged. The interface scores nothing. |
| Agency | Needs bite. Traits bar options. There is no veto: what the player takes, the god does. |
| Force Actions | A setting. `Alt` takes a barred option with no penalty. Off, the row is shown, disabled, with its reason. |
| Autopilot | The engine's own chooser, every turn. An autopiloted creation is an unwatched creation. |
| The screen | The strip, the map, the timeline, the foot. The map holds 7:3 and never gives width to a panel. |
| The timeline | Folded to one row, unfolded to a row for each god, zoomable. Left of now is the record. Right of now are the marks. |
| Starting | A second button on the start dialog: `Take a god`. You become the first god that wakes. |
| Determinism | Every act passes the door and is logged. A seed, its options, and its log replay the same story. |
| The gate | Twenty-four autopiloted creations equal twenty-four unwatched ones, fingerprint for fingerprint. |
| Out of scope here | Everything person-scale. What a character knows. Death and continuation. Combat. The other three modes. Stops on an event, which wait on G section 7. |

## 0. What this slice is for

The ages are impenetrable to the player who watches them. That is the reported fault, and the cause is not known. This slice is the instrument for finding the cause, not the cure for it.

So the measure of success is not that the mechanic works. It is that after playing a creation the player can say why the ages did not read. Three guesses are already built into the design, and each is cheap:

| Guess | What the design does about it |
|---|---|
| The player cannot see what the gods want. | The turn card shows the matrix: every act, every target, every score. |
| The player cannot see what the creation is steering toward. | The strip shows the rest gate as `4/7`. The unfolded timeline gives the gate its own row. |
| The player cannot see why the *other* gods did what they did. | Every god's choice is kept, age by age. Any chip on the timeline opens the matrix that produced it. |

If the fault is none of these, the instrument still says so, because the player will have held all three and still not read the ages.

## 1. The four acts

Every act from outside enters by `inject()` in `src/sim/door.js`. This spec adds four. `watch` is shaped as G's act will be, and is cut down to what exists.

| Act | Payload | Meaning |
|---|---|---|
| `become` | `{ id, mode }` | Inhabit this being. `mode` is `become` here; `possess`, `vessel`, and `manifest` are refused until their specs are built. `id` of `null` leaves. A god can be taken only in the gods era; leaving works in either era. |
| `choose` | `{ id, opt }` | Take this option from the open matrix. |
| `run` | `{ what, at }` | Autopilot until a mark. In this slice `what` is `age` only. |
| `watch` | `{ what, at }` | Set or clear a stop. In this slice `what` is `age` only. |

**A run and a stop are the same shape.** Both name a mark ahead of now, so both take `{ what, at }`. Only `age` is built, and either act refuses any other `what` by name.

**An option is named, never numbered.** `opt` is `{ type, region }`: the act and the country it falls on. An index into a sorted list is not a name, and a list sorted by score is not stable across a replay.

**Forcing is not an act.** A forced choice is a `choose` on a barred option. The door reads the Force Actions setting and refuses the act when the setting is off. So a replay cannot force what the setting forbade, and the log says plainly what was taken and what was barred.

**Refusals.** `become` on a being that is not a live god is refused in this slice, with a message that says so. `choose` with no turn open is refused. `choose` on an option that is not in the open matrix is refused. Every refusal is logged, as the door already logs every lawful act whether it lands or not.

## 2. The turn lock

The mythos spec reserved a locked clock: the engine ticks only when an inhabiting player moves. This builds it.

**`pending` is state, not an act.** It holds whose turn is open and the matrix that god was given. While `pending` is set the engine will not step. `choose` clears it. `run` clears it and sets it again at the mark.

**The clock is hybrid.** It locks when a choice is open. It runs free while the age plays out, and free during an autopilot. The speed ladder is untouched: it is what runs the world between choices.

**`ageStep` becomes resumable.** Today `ageStep` runs the whole age inside one `withGodRng` closure, and every awake god decides inside it, in order. A player's turn must suspend in the middle of that.

- The age keeps a position: which god is next to decide.
- `ageStep` runs gods from that position. When it reaches the inhabited god and that god has a free choice, it fills `pending` and returns.
- `choose` applies the option and calls `ageStep` again, which resumes from the position after that god.
- `withGodRng` swaps the stream and swaps it back. Entering it twice in one age draws the same numbers in the same order as entering it once. This is the whole reason the split is safe, and a test asserts it.

**A god with a task in hand has no choice.** `decideGod` continues a running act and returns. The turn does not lock. The timeline says the god continued.

## 3. The choice matrix

**The sim owns it.** `godOptions(g)` returns every `(act, region)` pair whose score is above zero, sorted. It is called once, stored on `pending`, shown, and applied. The interface scores nothing and sorts nothing.

**`godOptions` draws from the god stream.** It already does, once per option, on the autonomous path. Calling it once and keeping the result costs no extra draw. Calling it twice would, so it is called once.

**A barred option is shown.** A trait may bar an option. A barred row is in the matrix, disabled, with the trait and the number that barred it. It is not hidden: the player must see what this god will not do, because that is what makes one god different from another to play.

**Needs bite, and there is no veto.** A god's needs fall as they do now, and a god that never rests is unmade by the same rule that unmakes it today. What the player takes, the god does. Refusal, drift, and the rewriting of a character by play are reserved for Possess and Vessel.

**A chosen option may fail to apply.** `GOD_ACTS[type].apply` returns false when the act cannot land. The autonomous god falls to the next option silently. The played god does not: the row is marked failed, the matrix is shown again, and the turn stays open. The player learns the ground refused them, which the autonomous god never has to be told.

## 4. Autopilot, and the marks ahead of now

**Autopilot is the engine's chooser.** Every turn it takes the top of the matrix, exactly as `decideGod` does. There is no second scoring path, no standing order, and no player bias. This is what keeps an autopiloted creation identical to an unwatched one.

**Three kinds of mark sit ahead of the now-line.**

| Mark | Name | What it is |
|---|---|---|
| Run | run to | Where the autopilot ends and the matrix comes back. |
| Time | a stop on a time | An age. The only kind this slice builds. |
| Event | a stop on an event | Who and what. **Not built here.** It needs an `event` kind on every chronicle line, which is G section 7 and is not written yet. Building it here would duplicate G. |

Several stand at once. The run reaches whichever comes first. The rest stay set.

**A stop is a watch.** Setting a stop is the `watch` act. Clearing one is the same act.

**The act is shaped for what comes, and refuses what is not built.** `watch` takes `{ what, at }`, and `run` takes the same pair, because both name a mark ahead of now. `what` of `age` is built. Any other `what` is refused at the door with a message that says the watch list is not built yet. When G writes event kinds onto chronicle lines, the event form drops into both acts and the same timeline marks, and nothing in the interface changes.

**A stop fires once.** The stop that ends a run is taken off the list, so a later run past that age is not stopped again by a mark the player already saw reached. A `watch` on an age already passed is refused: a mark behind the now-line can never fire.

## 5. The record of every god's choice

`decideGod` already builds `g.lastChoice`: every option with its type, its label, its score, which was picked, and which ones failed. Today the next age overwrites it.

**It is kept instead.** Each age appends one entry for each god that decided: who, the age, the matrix, what was picked, and what failed. That record is what the timeline draws. It is also what the annals inherit in H, so it is written in the shape H will want: who, when, and why.

No new scoring. No new rules. The decision the engine already makes is kept instead of discarded.

## 6. The screen

Down the screen: **the strip**, **the map**, **the foot**, **the timeline**. Each part keeps one job.

**The map never gives width to a panel.** The world map is 280 by 120 tiles, which is 7:3, wider than any screen. A sector is 28 by 20, which is 7:5. A right-hand column steals from the one dimension the world map cannot spare. So the ledger lies flat under the map and ages run left to right.

**The strip gains no readout.** The gate is the condition the whole creation is steering toward, and nothing on screen said so. It was built as a row of the timeline instead: the last row, under the now-line, which reads "the world will hold" when the gate is met and `wants <lack>` when it is not.

**The foot is unchanged and sits above the timeline.** It names what the cursor is on, and it shows the matrix of any chip the player opens on the timeline.

## 7. The timeline

One widget. Its view model lives in `src/ui/derive.js`, which touches no DOM and is tested in `tests/ui.js`.

| | |
|---|---|
| Folded | One row. Every act in age order, prefixed by whose it was. The default. |
| Unfolded | A row for each god, and a row for the gate. The map shrinks and keeps its shape. |
| Left of now | The record. A chip opens in the foot the matrix that produced it. |
| Right of now | The marks. |
| Zoom | The near past and the near future are large by default. Zoomed out, the whole creation fits one row. |

**Folded and unfolded, not a new word.** Goal stages already fold and unfold. The interface speaks one vocabulary.

**It outlives this slice.** In the days the rows are the people on the watch list instead of the gods. Nothing about the widget changes.

## 8. The turn card

The interface already has live floating windows: up to six stand at once, each follows, each keeps its place. The turn card is one of that family.

- It opens when `pending` is set, and it cannot be closed while the turn is open.
- It holds the god's name and epithet, its needs, and the matrix.
- Enter takes the best row. A number takes that row. `Alt` with a number or a click forces a barred row.
- A row hovered rings its country on the field beneath.

## 9. Keys and settings

**Two clashes, settled.**

| Want | Taken by | Given |
|---|---|---|
| Zoom the timeline | `−` and `=` step the speed ladder | `[` and `]` |
| Force a barred option | `F` follows, `Shift+F` follows in a window | `Alt` with the click or the row's number |

`T` folds and unfolds the timeline. Every new key goes in `KEYMAP` and nowhere else. `tests/ui.js` already fails on a button without a key, and every button this spec adds has one.

**The register gains one setting.**

| Setting | Effect |
|---|---|
| Force Actions | On: `Alt` takes an option the traits barred, with no penalty. Off: the row is shown, disabled, with its reason, and the door refuses a `choose` on it. |

## 10. Starting in control

The start dialog is one form: a seed and a `Make world` button. It gains a second button.

```
World seed [________]   [ Make world ⏎ ]   [ Take a god ⇧⏎ ]
```

**`Take a god` makes the world and begins the ages paused, in step-time.**

**You cannot pick which god at the dialog, because none exist yet.** `firstGod()` runs at age 1, inside the first `ageStep`. So the first god that wakes is yours. You may switch to any awake god afterwards with `become`, and leave with `become` and no id.

**The dialog needs two promises.** Its paragraph is written for a watcher: "You are the sky... and watch". That text is a lie under the second button. The second button's promise is about making the valley, not watching it. The wording is written with the implementation.

## 11. Determinism and tests

The determinism contract of the mythos spec, section 0, stands. The engine step is pure. Every act from outside enters by one door and is logged with its tick, applied or not. A seed, its options, and its log replay the same story.

**A creation the player steered is a different story, and an equally lawful one.** It replays exactly from its seed and its log.

**The gods-era replayer is not built.** Nothing replays a steered creation today, and no test claims it does. `replayGod` in `tests/lib/run.js` selects the acts of a tick, every gods-era act shares one tick, and `runDays` only starts after settle. The door already stamps the age beside the tick and refuses an act from another age, so the record is there; what is missing is a runner. It needs three things: a replayer that selects by age as well as by tick, a drain point inside the gods era where the acts of an age are offered in their logged order, and a creation-scale runner that starts before settle instead of after it. Until then the claim above is a contract the door keeps, not a tested one.

**A player's act is a chronicle line and never a legend.** In the gods era every logged line joins the legends, and the legends are the creation's own story. A hand reaching in is not part of that story, and a legend that differed would break the equality autopilot rests on. The door log is the record of what the player did.

**The gate for the whole slice.** `tests/ui.js` already asserts that a watched creation equals an unwatched one. That assertion is restated: an **autopiloted** creation equals an unwatched one. `tests/ages.js` runs twenty-four seeds from creation to settle; it gains the same equality, fingerprint for fingerprint, on all twenty-four.

| Test | What it gains |
|---|---|
| `tests/ages.js` | Twenty-four creations the player drove, turn by turn, equal twenty-four unwatched ones, line for line. Every age suspends at the player's god and resumes through the door, so a resumed `ageStep` draws what an unbroken one drew. A run that opens no turn fails the test. |
| `tests/become.js` | The four acts, landing and refused: a `become` on a being that is not a god, a `choose` with no turn open, a `choose` outside the open matrix, a forced `choose` with the setting off. |
| `tests/ui.js` | The timeline view model folded, unfolded, and zoomed. The marks ahead of now. The matrix rows, including a barred one with its reason. A key on every new button. |

## 12. What this slice does not build

Each of these is its own spec. None is designed here, and the four acts and the timeline are shaped to carry them.

| Deferred | Note |
|---|---|
| Everything person-scale | The local map, the world and region map, markers and filters, movement, inventory, the immediate goal and the available goals, quests. |
| What a character knows | The largest of them. Today the player sees every tile, every being, and every score. A person should not. Without a knowledge limit, playing a person is the god view with the camera moved. Piece H is about knowledge, and this belongs beside it. |
| Death and continuation | What happens when the played character dies: return to watching, inherit a child, take another person, or end. It decides whether Become is a mode or a campaign. |
| Combat | It needs its own timescale. One task is one turn everywhere else; in a fight it is not. |
| Speech as an action | Talk, teach, ask, argue. The rules already exist — opinions, company, arguments that raise temper, lessons passed at one fire — and none of it is reachable by a player. The cheapest content in the project, once a person can be played. |
| The cost of an option in time | Under a real clock a choice is a bet on hours. The matrix should show duration beside score. It waits for G's clock retune. |
| Quests | A camp goal is already a quest: it has a state, it offers work, and it takes a priority. A quest is a goal a person adopts. No new system. |
| The other three modes | Possess, Vessel, Manifestation. Refusal, drift, and the rewriting of a character by play belong to them, not to Become. |
| Undo | Never. The door log is the record and determinism forbids it. |
| A gods-era replayer | The door logs every act with its age. Nothing replays it: `replayGod` selects by tick, and one age is one tick. See section 11. |
| A stop on an event | It needs an `event` kind on every chronicle line. That is G section 7, and it is not written. The `watch` act and the timeline marks are built to take it the day it exists. |
