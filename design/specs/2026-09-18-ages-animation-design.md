# The ages in motion: a god that moves, an act that shows, and a country that changes before the eye

Design spec, 2026-09-18. It answers issue #11 of `earchibald/hamlet-dev`. It is a follow-up to mythos plan 4, watching the creation, and to section 6 of the mythos spec. Implementation follows in a plan. Nothing here is built yet.

## Summary

| Item | Answer |
|---|---|
| The problem | The Before Time and the ages read as a slideshow. A god teleports, a country changes colour in one frame, and the chronicle is the only account of what happened. |
| The cause | An age is one discrete step, and the field cache is keyed on the age number. Nothing is drawn between two ages. A god has no place finer than a region. |
| What changes in the sim | A god gains an anchor tile, `g.at`. Each act records a plain gesture in `creation.gestures`. No rule reads either. No act changes. |
| What changes in the view | The field draws with a cross-fade between the last age and this one, a god walks from its old anchor to its new one, and each gesture draws its own figure across the same fraction. |
| Files in `src/sim/` | `field.js` (`heartTile` alone; `splitRegion` is not touched), `gods.js` (`g.at`, the recorder, one call per act), and the reset of `creation` in `beginCreation`. |
| Files in `src/ui/` | `state.js` (the tween table, the second cache), `derive.js` (the pure tween functions), `map.js` (`drawField`, the gesture layer). `main.js` does not change. |
| What does not change | `ageStep`, the act table's decisions, `standsIn`, `AGE_MS`, `pace`, `SPEEDS`, the door, the chronicle text. |
| What does not move | The six-seed soak golden, `tests/ages.js`, and the `standsIn` rows in `tests/ui.js`. The fingerprint hashes text, kind, and age, so added fields cannot reach it. |
| Where a duration lives | In the view. `AGE_MS` stays in `src/ui/state.js` and the tween tiers join it there. No duration and no rate enters `src/sim/`, so `tests/clock.js` has nothing new to lint. |
| Determinism | An act records its own gesture. The recorder draws no random number and reorders no state. The view only reads. A watched creation still equals an unwatched one. |
| Reviewed | The `hamlet-mythos` session read this against `dev`. Its required change is in sections 0, 3, 8, and 9: `boundary.tiles` is state, so the recorder sorts a copy of it. |
| Deferred | A wash that spreads from the anchor, a Legends row that lights its own country, animating settle, animating the day era, gestures kept as history. |

## 0. What is true today

Read this. Do not re-derive it.

| Fact | Where |
|---|---|
| One `step()` in the gods era is one age. Every awake god acts in the same instant, eldest first. | `ageStep()`, `src/sim/gods.js` |
| The frame loop already holds the fraction between two ages in `acc`, from `agesDue(acc, dt, pace)`. | `src/ui/main.js`, `src/ui/derive.js` |
| The field cache is keyed on `[seedText, age, creation.discards, liveRegions().length]`. | `drawField()`, `src/ui/map.js` |
| A god draws at the centre of the bounding box of the region `standsIn(g)` returns. | `drawField()`, `src/ui/map.js` |
| A mark carries an anchor tile in `at`. `mark()` gives `at` as `null` when the target holds no tiles. | `mark()`, `src/sim/marks.js` |
| `splitRegion()` returns `cut.boundary.tiles`: the real line of the cut. | `src/sim/field.js` |
| **The order of `boundary.tiles` is state.** `paintRivers` places a ford by the index along the list, and then draws `rng()` for each ring tile in the list's order. Reorder the list and the fords move and the people's stream moves with them. | `paintRivers()`, `src/sim/world.js` |
| A raise and a dig hold `left` and `done` in ages, not in ticks. | `spendAges()`, `src/sim/gods.js` |
| `g.lastChoice` holds the options weighed, their scores, and the one picked. | `decideGod()`, `src/sim/gods.js` |
| The soak fingerprint hashes a legend as `age|kind|text`. | `fingerprint()`, `tests/lib/run.js` |
| `frame()` clamps `dt` to 250 ms, and `agesDue` caps a frame at eight ages. | `src/ui/main.js`, `src/ui/derive.js` |

## 1. The anchor: where a god stands

A god has no tile, by design. The view still needs a point. Today that point is the bounding box centre of a region, and it jumps twice: when the god's region is split, and when any region is split under it.

**A god carries its own anchor tile.** Add one field to a god: `g.at`, a tile index or `null`. It is a place on the field, not a place in the rules. No rule reads it.

| Case | The anchor |
|---|---|
| A god comes into being | `heartTile(r)` of the region it holds. |
| A god acts | The anchor tile of the mark the act wrote. A split takes the middle tile of the cut's own line. |
| An act wrote no mark, or the mark's `at` is `null` | `heartTile` of the act's own region. `mark()` gives `null` for a target with no tiles, so the fallback is written and tested, not assumed. |
| A god's region is split under it | The god keeps its tile while the tile lies in the live region `settleHome` gives. Otherwise `heartTile` of that region. |
| A god sleeps | The anchor of its rest mark. |
| A god is unmade | The anchor it last held. |

`heartTile(r)` is the tile of `r` nearest to the mean of the coordinates of `r.tiles`. A tie goes to the lowest tile index. It is a scan and a comparison. It draws no random number, so it cannot move a stream.

**Why this anchor is stable.** It is a property of the god, not of a region. A split changes a region's bounding box and its centroid, and neither is read. The anchor moves on two events only: the god acts somewhere, or a split cuts the god's own tile away from it. Both are real movement, and both are what this design wants to show.

**A mark's anchor costs no draw.** `mark()` already picks a tile when the caller gives none, and that pick already consumes `rint` on the gods' stream, inside `withGodRng`. The recorder reads the mark that the act wrote. It never calls `mark()` again and never picks a tile of its own. The fallback is `heartTile`, which is a scan.

**The fallback is measured, not assumed.** "Every act writes a usable mark" is a claim about thirteen acts and three events, and the anchor rule rests on it. Section 9 counts the gestures that take the fallback over the twenty-four seeds of `tests/ages.js`. A count of zero proves the claim. Any other count is the list of exceptions, and the list goes in the notes.

**Two gods in one country.** Their anchors are usually different tiles. The view nudges two stars apart only when their pixels are within the glyph's own width. The present fixed offset of 46 pixels goes.

## 2. The gesture record

**A gesture lives in `creation.gestures`.** It is an array, replaced at the head of each age. `creation.gestureAge` holds the age it belongs to.

**Why beside the mark, not on it.** A mark is history and is kept for ever. A gesture is a replay of one age and is worth nothing after it. Some acts write several marks, and one act, a failed apply, writes none. Keeping gestures off the mark leaves the mark lean and leaves history nothing to undo later.

**Every field is plain.** Numbers, strings, and arrays of numbers. A tile is an index. A god is an id. A region is an id. Nothing points at an object, so the snapshots of plan G3 serialize `creation` as it stands.

The head of every record:

| Field | Holds |
|---|---|
| `kind` | The gesture's own kind, from the table in section 3. |
| `god` | The acting god's id. |
| `age` | The age it happened in. |
| `from`, `to` | The god's anchor tile before the act and after it. Either may be `null`. |
| `said` | The index in `legends` of the line the act wrote, or `null`. |
| `weighed` | The three best options as `{ type, region, score }`, and `picked`, copied from `g.lastChoice` at the moment of the act. `null` when the act was not decided this age. |

`weighed` is copied, not read live, because `decideGod` returns early for a god with a running task and leaves `lastChoice` standing from an earlier age. A cue that read the god would show a stale intent.

**Only an `apply` copies `lastChoice`.** A `raise` or a `dig` that goes on through `continue` was decided in an earlier age. No decision of this age stands behind it. Its gesture carries `weighed: null`, and the view shows no intent cue for it. The work itself still draws, and the caption still names its line.

**The recorder.** One function in `gods.js`, `gesture(g, kind, fields)`. Each act calls it once, at the end of a successful `apply` or `continue`. An act that returns `false` records nothing. `ageStep` empties the list at the head of the age, inside `withGodRng`.

## 3. One row per act

The `drawn as` column is the view's contract. It is what section 4 tweens.

| Act | `kind` | Fields beyond the head | Drawn as |
|---|---|---|---|
| `split` | `split` | `near`, `far` (region ids), `line` (a sorted copy of the cut's tiles), `pole`, `other` | The god walks to the middle of the cut. The line strokes from one end to the other. The two colours fade in behind it. |
| `claim` | `claim` | `region`, `pole` | The god walks to the country's anchor. The country's colour fades in. |
| `make` | `make` | `region`, `species` | The species glyph rises at the anchor and settles. |
| `raise` | `raise` | `region`, `step`, `of`, `value` | A ring swells outward at the anchor, one ring for this age's storey. `step` of `of` says how much of the work is done. |
| `dig` | `dig` | `region`, `step`, `of`, `value` | A ring sinks inward at the anchor, one ring for this age's level. |
| `flow` | `flow` | `path` (one anchor tile per region, in order) | A line runs from anchor to anchor along the path. |
| `pool` | `pool` | `region`, `under` | A ring widens and holds at the anchor. |
| `burn` | `burn` | `region` | The scar hatching fills outward from the anchor. |
| `freeze` | `wash` | `region`, `value: 'freeze'` | A wash crosses the country from the anchor. |
| `hide` | `wash` | `region`, `value: 'hide'` | The same wash, in the dark ink. |
| `show` | `wash` | `region`, `value: 'show'` | The same wash, in the light ink. |
| `battle` | `battle` | `region`, `other` (the rival's id), `otherFrom` (the rival's anchor), `winner`, `loser`, `scar` | Both stars meet at the anchor. The loser's star returns to its own anchor, faded. The scar fills. |
| `twist` | `twist` | `region`, `species` | The species glyph at the anchor bends and holds. |
| `mingle` | `mingle` | `region`, `with` (the other god's id), `otherFrom` | Both stars meet at the anchor and part. |
| `sleep` | `sleep` | `region`, `body` | The star sinks to the anchor and dims to the sleeping alpha. |
| A god comes into being | `born` | `region`, `pole` | The star fades in at the anchor. |
| A god is unmade | `unmade` | `region` | The star fades out at its anchor. |
| The backstop acts | `backstop` | `region`, `lack` | The wearied god walks and marks, as in any act. |
| A strain makes a god | covered by `born` | | |

**Every gesture has an acting god.** `born` holds the new god's id, with `from: null`: the star fades in where it is made and nothing walks. `backstop` holds the id of the wearied god, which `backstop()` takes as `awakeGods()[0]`; that god acts, marks, and moves like any other. `unmade` holds the id of the god that is unmade. No gesture carries `god: null`.

**The recorder sorts the split's line. `splitRegion` does not.**

Caution: `boundary.tiles` is state, not a drawing order. `paintRivers` places a ford by the index along that list, and then draws `rng()` for each tile of the ring beside it, in the list's order. A reorder moves every ford and shifts the people's stream, which moves the six-seed golden and the settle tests. So `splitRegion` keeps the list exactly as it builds it, row-major, and `field.js` gains `heartTile` and nothing else.

The recorder makes `line` as a **sorted copy**. It takes the spread of the tiles in x and in y, sorts along the wider one, and breaks a tie on the other coordinate and then on the tile index. That is a scan and a sort of a copy. It draws nothing, and the sim state it reads is unchanged.

**A strain that presses a god records nothing.** When the pole already has a god, `strain` lowers that god's expression and writes no mark and no line. Nothing happened on the field, so nothing is drawn.

## 4. The tween

**The tween's clock is `acc`.** `main.js` already keeps it. `drawField` reads it. Nothing new is plumbed and `main.js` does not change.

**The tween replays the age that just ran.** `step()` applies a whole age at once, and `acc` then runs from 0 to 1 toward the next age. So the state on screen is already the new state when the tween begins. The view holds the last drawn field and fades to the new one across the fraction, so the eye sees the gesture and the result together.

**Two caches, one swap.** `drawField` keys its cache as it does today. When the key changes, the current offscreen canvas becomes the previous one and the new state is drawn into the other. The previous cache is therefore always the last state drawn. `drawField` then draws the previous cache, and the current cache over it at the eased fraction.

A cross-fade of two identical images gives the same image, so only the countries that changed appear to change. Nothing else flickers.

**A discard breaks the fade.** A thrown-back valley moves `creation.discards`, and the previous cache is then a different world. The view suppresses the cross-fade for that one key change and snaps.

**The new boundary is held out of the cache.** `drawFieldCache` takes a set of boundary ids to skip. A split's own boundary is skipped while its gesture runs, and the gesture layer strokes it instead. At the end of the tween the cache holds it and the gesture layer is empty.

**The stagger.** Several gods act in one age. The view gives gesture `i` of `n` a start offset of `i * S / n` of the tween, where `S` is at most a third. The gestures overlap and the last one still finishes by the end.

The order is the order `ageStep` ran them: eldest god first, which is the order of the list and the order of the chronicle. The rules call an age one instant, but they execute the acts in that order, and a god that acts later sees what the earlier one did. The stagger therefore shows a true order, and the drawer beside the map lists the same acts in the same order.

**The pure parts are testable.** `derive.js` gains `tweenTier(ms)`, `gestureSlice(i, n, f)`, `pointAt(from, to, f)`, and `lineSoFar(line, f)`. They touch no DOM, and `tests/ui.js` runs them in Node. `map.js` holds the drawing alone.

**A long gap is safe.** The tween is a pure function of `acc`, not of elapsed frames. A tab that slept wakes with a clamped `dt`, `acc` jumps forward, and the drawing jumps with it. The field cache always holds a whole state, so a dropped frame leaves nothing half-drawn. A frame that runs more than one age keeps only the newest gestures, and section 5 makes that frame snap.

## 5. Behaviour at speed

**Key the animation off the tween's length in milliseconds.** That length is `AGE_MS / pace`, read at run time. No rule and no branch names a pace value. Plan G4 retunes the day-era ladder only, so this holds through it, and it holds if a new rung is ever added to the ages.

| Tween length | What runs | On today's ladder |
|---|---|---|
| 1000 ms or more | The intent cue, the walk, the act's figure, the caption, the cross-fade. | pace 1, 2000 ms |
| 300 to 1000 ms | Everything above, without the intent cue. | pace 4, 500 ms |
| 100 to 300 ms | The walk and the cross-fade. No figure and no caption. | pace 16, 125 ms |
| Under 100 ms | Nothing. The field snaps as it does today. | pace 64, 31 ms |

Two more cases snap, whatever the length: a frame that ran two or more ages, and a hurry to settle.

**What is dropped first.** The intent cue. It is a reading of a decision, not the event, and it is the only part that asks the eye to wait before something happens.

**What survives to the fastest setting.** The field itself, the boundaries, and each god's star at its own anchor. That is today's picture, which is the right picture at thirty milliseconds an age.

**Where the numbers live.** A table `TWEEN` in `src/ui/state.js`, beside `AGE_MS` and `SPEEDS`. They are view durations in real milliseconds. No duration enters `src/sim/`, and `tests/clock.js` lints `src/sim/` alone.

## 6. Clarity beyond motion

Motion alone says that something moved. The tester asked for the process. Two things carry it.

**The caption ties a line to its place.** A gesture holds `said`, the index of the line the act wrote in `legends`. While the gesture runs, the view prints that line beside the gesture's anchor. The player reads the words and sees the ground they name in the same glance. The Legends drawer keeps every line as it does today.

One caption at a time. With five gods acting, five captions fight. The view prints the caption of the newest gesture whose line is `major`, and falls back to the newest gesture that wrote a line at all.

**The intent cue earns its place, at the slow tier only.** It costs no new sim data beyond `weighed`, which the head already carries, and it turns a decision into something the player can see.

In the first quarter of the tween, before the figure draws: a faint ring on each weighed country, brightest on the one picked, and one line under the god's star.

> Ondru weighs three countries.

The line is plain English and one idea. It is the only new game text this design proposes.

The cue shows a decision that has already been taken. It is a replay, not a prediction, and the sim is not asked to look ahead. The cue is the first thing dropped as the pace rises, per section 5.

## 7. What does not move

| Golden or test | Moves? | Why |
|---|---|---|
| The six-seed soak golden | No | The fingerprint hashes `age\|kind\|text` for a legend and `tick\|kind\|text` for a chronicle line. `g.at` and `creation.gestures` reach neither. No act changes, and the recorder draws no random number. |
| `tests/ages.js` | No | It runs the creation to settle and reports. The decisions it reports are unchanged. |
| The `standsIn` rows in `tests/ui.js` | No | `standsIn` is not touched. It still returns the live region the god's pole leads to. `openGodAt` still resolves a god by region, not by anchor. |
| The watched-equals-unwatched test | No | It compares the legends, the first person, and the tick. The recorder runs in the sim, at the same point, watched or not. |

**Nothing moves. That is the intent.** The one visible change on the field is where a god's star is drawn: its own anchor tile, in place of the bounding box centre. That is a view change, and no test asserts that pixel.

**The two changes stay apart.** The sim records. The view reads. `src/ui/` writes no gesture and changes no rule, as the split rules require.

## 8. Files

| File | Change |
|---|---|
| `src/sim/field.js` | `heartTile(r)`, and nothing else. `splitRegion` and `boundary.tiles` are left exactly as they are. |
| `src/sim/gods.js` | `g.at` on a god, `gesture(g, kind, fields)`, one call per act, the sorted copy of a split's line, the anchor update in `settleHome`, the list emptied at the head of `ageStep`. |
| `src/sim/gods.js`, `beginCreation` | `creation` gains `gestures: []` and `gestureAge: -1`. |
| `src/ui/state.js` | `TWEEN`, the second offscreen canvas. |
| `src/ui/derive.js` | `tweenTier`, `gestureSlice`, `pointAt`, `lineSoFar`. |
| `src/ui/map.js` | `drawField`: the cache swap, the cross-fade, the god's anchor, the gesture layer, the caption, the cue. `drawFieldCache` takes the boundaries to skip. `drawBoundaries` is unchanged. |
| `tests/ages.js` | Every act of an age leaves one gesture. A JSON round trip of `creation.gestures` equals itself. No gesture holds an object. |
| `tests/ui.js` | The four pure tween functions, the tier table against the whole pace ladder, and the anchor of a god after a split. |
| `design/notes.md`, `design/settings.md` | The record, in the plan's last task. |

## 9. Tests

| Test | Asserts |
|---|---|
| Gestures are plain | `JSON.parse(JSON.stringify(creation.gestures))` deep-equals the list, on several seeds and several ages. |
| One gesture an act | Over a whole creation, the count of gestures in an age equals the count of gods that acted in it. |
| No draw is spent | Two runs of the same seed, one with the recorder and one without, give the same fingerprint. Proven once, in the plan, then dropped. |
| The anchor is stable | Step a creation. For each age, a god's anchor changes only when it acted, or when its tile left its live region. |
| The fallback is counted | Over the twenty-four seeds of `tests/ages.js`, count the gestures whose anchor came from `heartTile` because the act wrote no mark, or the mark's `at` was `null`. Zero proves that every act writes a usable mark. Any other count is the list of exceptions, and the report prints it by act. |
| The boundary is untouched | After a creation, every `boundary.tiles` is in ascending tile order, as `splitRegion` built it. A split gesture's `line` holds the same tiles and a different order. |
| The tier table | `tweenTier(AGE_MS / p)` for every `p` in `SPEEDS` gives the four tiers in order. |
| The tween is pure | `pointAt` and `lineSoFar` at `f = 0` and `f = 1` give the ends. `gestureSlice` gives every gesture a slice inside `[0, 1]`. |
| The golden | `npm run fast` and the six-seed soak, unblessed. |

## 10. Phasing

| Plan | Delivers | Done when |
|---|---|---|
| 1. The record | `heartTile`, `g.at`, the recorder, one row per act, the sim tests. | Every act leaves a plain gesture. The soak fingerprint has not moved, and no test was blessed. |
| 2. The motion | The anchor on the field, the cross-fade, the gesture layer, the tiers, the caption, the cue, the view tests, the page check in Safari. | A creation at pace 1 shows a god walking, a line drawn, and a country filling. At pace 64 it is today's picture. |

Each plan leaves `dev` working and playable. Plan 1 alone changes nothing the player sees, so it does not stand alone as a release; the two land together.

**Coordination.** Tell the `feedback-pass` session before plan 2 touches `state.js`, `derive.js`, or `map.js`. It works in `src/ui/`, and on a naming plan in `src/sim/`. The `hamlet-mythos` session owns `gods.js`, `field.js`, and the ages view, and it reviewed this design. Nothing in plans G1 to G6 touches `gods.js`, `field.js`, or `drawField`, so branch `tiers` does not conflict.

## 11. Out of scope

| Left out | Why |
|---|---|
| Animating settle | Settle is one step from marks to tiles. It is its own problem and its own issue. |
| Animating the day era | The day era already moves. Plan G4 retunes its ladder and owns what it looks like. |
| A new rung on the ages ladder | `AGE_MS`, `pace`, and `SPEEDS` stay as they are, per the issue. The tiers degrade on the ladder there is. |
| Gestures as history | A gesture is a replay of one age. Marks are history, and they already carry the who, the when, and the why. |
| A Legends row that lights its country | It needs a region on a legend line, which is a change to `log`. Worth doing, and not needed to fix the slideshow. |
| Sound, a replay scrubber, a god's portrait | None is needed to read the process. |
| A god's act through the door | The door does not take a god act, and pace and hurry still do not pass it. |

## 12. Settled in review

The `hamlet-mythos` session reviewed this design against `dev`. It owns `gods.js`, `field.js`, and the ages view. Three questions closed.

| Question | Settled |
|---|---|
| The split's line | `boundary.tiles` is state, not a drawing order, and it is left alone. The recorder sorts a copy. Section 3 holds the decision. |
| The stagger | Keep it. The order is the order `ageStep` runs the gods, eldest first, which is the chronicle's order, so the stagger shows a true order of execution. Section 4 holds it. |
| The count of gestures in an age | Set no cap now. `REGIONS_PER_GOD` bounds the gods by the size of the field. Count the gestures per age in `tests/ages.js` first, and design a cap only against a real number. |

## 13. Open questions

Each has a recommendation. None is settled. The reviewer had no objection to any recommendation here.

**1. Cross-fade, or a wash that spreads from the anchor?**
A cross-fade is cheap and exactly correct, but a country's colour arrives everywhere at once. A wash that spreads outward from the anchor reads more like a god's hand on the ground. It costs a distance order over the region's tiles for each act that paints one.
*Recommendation:* build the cross-fade first. Measure a wash for `claim` and `burn` alone, on the largest region a default world makes, before it lands.

**2. Is the field allowed to read ahead of the picture?**
The state is the new state when the tween begins, so a hover card during a fade names a country that the eye has not seen change yet.
*Recommendation:* accept it. Holding the card back an age would make the card disagree with the drawer beside it, which is worse. Revisit after a play test.

**3. Does the flow path cross a country it never entered?**
`flow` marks a chain of neighbours. A line drawn anchor to anchor may cut a corner of a third country.
*Recommendation:* accept it for now, and check it against the twenty-four seeds `tests/ages.js` runs. If it reads as a lie, draw the flow as a pulse on each country in turn instead of a line.

**4. Does a winding cut read as one stroke?**
A restless god draws a winding line, and a child of a ragged parent may lie in two pieces, which the field spec already accepts. A sort along the cut's long axis gives a stroke order; it does not promise the stroke looks continuous.
*Recommendation:* stroke it and look. If a two-piece child reads as a stutter, fade that one gesture in place of stroking it.
