# Time and tiers: a real clock, tasks as data, and a day that runs in one step

Design spec, 2026-09-18. Approved in conversation, section by section. Implementation follows in plans. This spec is piece G of the program that follows the mythos. It gives the world a real clock, makes a task a record, adds the day tier, and makes zoom an act. It also fixes the rules that the pieces after it must keep.

## Summary

| Decision | Choice |
|---|---|
| The program | Three pieces, each with its own spec and plans. G: time and tiers (this spec). H: history, where a settlement is a mob at the season tier. The climb: content packs, one for each step of knowledge. |
| The destination | A settled fantasy world. It is not placed. It arises. Knowledge decides who wins and who loses, and a chance of fate succeeds only where knowledge supports it. The engine does not cap the climb. |
| Nothing decided is lost | A coarse tier may summarise how things happen, never what was decided. Zooming out loses positions and paths, and nothing else. |
| Realtime | A tick is one world second. That is the engine's truth. The default play speed is 60 times that. True realtime is the slowest speed. |
| Scale | A tile is 1.5 m. A person walks one tile a tick. A year is 365 days. Lives are in years. |
| Tiers | Tick, day, and season. G builds the first two. The season tier is H's. |
| How the day tier works | One rule set, two executors. The chooser is shared. The tick executor runs a task tick by tick. The day executor runs the same task in one step. Measured rates cover only hazards, encounters, and the numbers of uncounted mobs. |
| Tasks | Plain records. One `TASKS` table holds the behaviour of each kind. |
| Individuals | `individual` is a flag on the mob, not on the species. Any intelligent mob can carry it, human or not. A mob that carries it is never collapsed into a count. |
| Determinism | The tier is part of the story. A tier change and a watch-list change pass the door and are logged. Different zooms give different, equally valid histories. A replay of the log gives the same story. |
| Zoom | One ladder of speeds: 1, 6, 60, 600, Days, Seasons. The tier follows the speed. |
| Breakpoints | A watch list of who and what. A breakpoint fires before the event, drops to the default speed, and pauses on the line that says why. |
| Save and load | Snapshots of the whole state, through a table of reference fields. Loading passes the door. |
| The record | The annals keep every major line and every deed for ever. A deed is a mark. |
| Out of scope here | The season tier, settlements as mobs, knowledge, trade, conflict, culture (H). New recipes and structures (the climb). Painting a country into tiles on first visit (H). Lingering gods that wake (after H's years exist). Inhabit modes (E). |

## 0. The rules that carry forward

These hold for G, for H, and for every later piece.

| Rule | Meaning |
|---|---|
| Nothing decided is lost. | A decision taken at a fine tier stays a real input at every coarser tier. A played character's acts do not vanish when the timescale is zoomed out. |
| One state, shared by all tiers. | No tier keeps private state that another tier drops. Opinions, feuds, family, skills, priorities, a chosen site, and pending events are data on a being or a camp. Every tier's rules read that data. |
| Deeds are marks. | A deed writes a mark with who, when, and why, on a camp, a country, a structure, or a being. Rules read marks. Rules never read a name. |
| A deed makes an individual. | A mob with a deed mark carries `individual`. Its record outlives its death. The dead stay in the record, as dead gods do. |
| The land stays true. | At every tier the tiles, items, structures, and trees are the real ones. A zoom in never invents the land. |
| Effects land at a task's end. | At every tier. So the state is consistent at any moment, and a being can change tier in the middle of a task. |
| The fine tier is the measure. | A coarse tier that disagrees with the tier below it, beyond a stated tolerance, is a failing test. |
| The tier is part of the story. | How closely the world was watched is part of what happened. It is in the log. |

The determinism contract of the mythos spec, section 0, stands. This spec adds three acts to the door: `tier`, `watch`, and `load`.

## 1. The clock

One table, `CLOCK`, holds every duration and every rate, in world units. No rule holds a bare tick count.

| Quantity | Today | Under G |
|---|---|---|
| A tick | about 86 world seconds | 1 world second |
| A tile | unstated | 1.5 m |
| Walking | a step every 2 ticks | 1 tile a tick, about 5 km/h. A run is 2. |
| A day | 1000 ticks | 86,400 ticks |
| A year | 32 days | 365 days, four seasons of 91, 91, 91, and 92 |
| A human life | 84 days | about 70 years. Adult at 16. Old at 55. |
| Other lives | 20 to 200 days | Rabbit 3 years, fox 5, wolf 8, deer 12. Sprites and gnomes live for centuries. |
| Work | bare tick counts | World time from the table. Knap an axe: 1 hour. Build a lean-to: 4 hours. Sleep: 8 hours. |
| Needs | decay per tick | decay per world hour |
| Camp rules | a roll per tick | a rate per world hour. Each tier rolls at its own step from the same number. |
| Cellular systems | every tick | once a world minute: growth, fire checks, weather |

Helpers turn units into ticks at load: `secs(n)`, `mins(n)`, `hours(n)`, `days(n)`, `years(n)`. A rate is `perHour(p)`, and `rollFor(rate, ticks)` gives the chance over a step of any length.

The first values are real-world guesses. The retune plan tunes them against the soak floors. A floor is not lowered without the user's word.

**The speed ladder.**

| Step | Tier | A day takes | What reads well |
|---|---|---|---|
| 1 | tick | 24 hours | True realtime. |
| 6 | tick | 4 hours | People walk at the pace the eye follows today. |
| 60 | tick | 24 minutes | The default. Walking is a blur. Work and the day's shape read well. |
| 600 | tick | about 2.5 minutes | The length of day that speed 1 has today. |
| Days | day | about a tenth of a second | A year in under a minute. |
| Seasons | season | | H builds it. The step is shown and disabled until then. |

This is the cost of a real clock. At a speed where a walk can be watched, a day is long. At a speed where a day is short, a walk is a blur.

**The world's scale.** At 1.5 m a tile the default world is 420 m by 180 m: a hamlet and its fields. That is right for G. H needs a land. The field already covers the whole world in countries, so H can paint a country into tiles when someone first goes there. The register records it as H's.

**As built (G1).** `SPECIES`, `LIFE`, and `RECIPES` keep their own rows rather than moving into `CLOCK`; each row is written with the same unit helpers, so a per-species decay or a recipe's work reads the same way a `CLOCK` entry does. `perHour` is linear: it turns a rate for each world hour into a rate for each tick, exact for an amount and only an approximate form for a chance. It is built for the retune; no rule reads it yet. Four legacy markers remain in the code once G1 closes: `ticks`, `strides`, `tickRate`, and `strideRate`. Each returns its argument unchanged and marks a value still in today's units. G4, the retune, replaces every marker with a world unit; it is complete when the source holds none of the four. A chance that sits beside its period, such as `birth.chance` or `arrival.villageChance`, carries no marker; the retune changes it together with its period, and `rollFor` is the tool.

## 2. Tasks as data

Today a task is a closure. `startBuild(a, at, 70, label, done)` builds an object with an `arrive` function, and the effect, the chronicle line, and the thoughts are written inline. A goal offers `start: a => ...`. A closure cannot be saved, cannot be handed to another executor, and cannot be read without running it.

**A task is a plain record.** `{ kind, args, stop, progress, started, ends }`. Numbers, strings, ids, and coordinates only. A path is a list of coordinates and can always be found again.

**One table holds the behaviour.**

| Entry of `TASKS[kind]` | Meaning |
|---|---|
| `stops(a, args)` | The places the task visits, in order. Each stop says how near the being must get and what it does there. |
| `work` | The world time from `CLOCK`, and the skill that speeds it. |
| `check(a, args)` | Whether the task is still worth doing. False fails it. |
| `effect(a, args)` | What changes at the end: stocks, a structure, thoughts, a chronicle line, a mark. |
| `fail(a, args)` | What happens when it cannot be done. |

A goal offers `{ label, score, task: { kind, args } }`. A recipe nearly does this already, so recipes change least. Animals, sprites, and gnomes use the same table.

**The tick executor** runs a task one tick at a time. It moves the being along the path to each stop, adds work there, and calls `effect` at the end. It is today's behaviour, reached through the table. `legPath` becomes `pathToStop`, so the code and this spec use the same words.

The conversion is a refactor, kind by kind. The golden holds through all of it.

**As built (G2).** `TASKS[kind]` holds `type`, `begin`, `stops`, `release`, and, for a job done at one place, `work` and `effect`. `begin` and `stops` are this section's `stops(a, args)`, split in two: `begin` runs the search and the first move, and each entry of `stops` is the behaviour at one stop, called again each stride once the walk there is done. `release` is this section's `fail`; it also runs when a task ends well, where the old code called `cleanup`, so one function now covers both. `check` is not a separate entry; each stop function tests what it needs and returns `'fail'` itself. A job done at one place, such as building the fire pit or knapping the axe, also declares `work` (the world time from `CLOCK` and the skill that speeds it) and `effect` (what changes when the work ends); the chases and the loops of gathering have no single place and no declared `work`, so they stay stride by stride, and plan G5 decides how the day tier answers them. The record keeps `type` beside `kind`: `kind` is the key into `TASKS`, and `type` is the category `a.task.type` that the rest of the rules already read.

## 3. Snapshots, save, and load

A story is the seed, the options, and the log, so a replay is always a valid load. A replay is too slow after hours of tick-tier play. G builds true snapshots as well.

- A snapshot is the whole state as JSON: the tick, the tier, both random streams, the placement stream's seed, the levels, the items, the beings, the camps, the counts, the field, the marks, the legends, the annals, the chronicle, the pending events, the watch list, and the door log.
- Records point at each other today. A tile points at its cave, and the cave points back at its tiles. A person points at a camp. One table, `REFS`, names every reference field for each record type. The serializer turns those fields into ids and back. No other record changes shape.
- The snapshot test is the oracle. Run N ticks, take a snapshot, load it into a fresh sim, run M more. The fingerprint equals a straight run of N plus M. It holds with a person in the middle of a task.
- In the page: Save writes a file. Load reads one. The browser keeps one autosave slot, written at each dawn. `load` passes the door.

**As built (G3).** A snapshot holds the tick, both random streams' positions, and the rest of the state a made world carries today, including who the player is. This list names a placement stream, but G3 built none; when a later plan adds one, its position joins the snapshot beside `rng` and `godRng`. `REFS`, in `src/sim/snapshot.js`, names every reference field found by a guard test that walks the whole state. A grove that leaves `groves` under a living sprite is the one record named apart, as a stray.

The oracle (a save mid-run, a load into a fresh sim, a run-on compared to a straight run) found no fault over eight cases and a ninth soak test, and a sabotage pass proved five of six broken loaders would be caught. `load` passes the door as `DOOR_ACTS.load`, marked `replacesWorld`: it applies before logging and is the one lawful act a refusal does not log, because it carries no tick of its own and its snapshot can run to megabytes. The page writes Save to a file, reads Load from one, and keeps one autosave slot in IndexedDB, written at the first frame of each new day; every storage call sits in a try, so a sandboxed page still plays. `design/notes.md`, section 18, has the full account.

## 4. The day tier

**The land stays true.** A stick gathered is a real stick taken from a real tile. A lean-to built stands on a real tile.

**A person's day.** Each individual has a clock of its own within the day. A queue holds every individual by the time its task ends.

1. Take the earliest. Its task ends now, so its effect lands now.
2. Ask the chooser for the next task. It is the same chooser as the tick tier: needs, goals, priorities, traits, opinions.
3. Give the task to the day executor. It takes the travel time from the distance to each stop, the work time from `CLOCK` and the skill, and the decay of needs over that time. It sets when the task ends. The being stands at the last stop, on a real tile.
4. Put the being back in the queue.

Night, sleep, the fire, and the roof are in the same loop. A cold night with no fire costs warmth, as now. The day executor finds a resource by the sector counts the sim already keeps, takes a real item from the nearest sector that has one, and searches no path.

**Camp rules run once, at two step sizes.** Newcomers, births, founding a daughter camp, and the village rule are rolls against a rate in `CLOCK`. The tick tier rolls for a tick. The day tier rolls for a day.

**The cellular systems run for real, in batch.** Plants grow by a day at once. Weather is decided by the day. A strike at the day tier runs the real fire spread over its own patch until it is out, with no beings stepped. The burned tiles are true.

**Mobs without `individual` become counts.** One count for each kind in each country, and for each den and grove. Births, deaths, and predation come from rates measured at the tick tier. A hunt draws on the count. A count keeps the mean of what its members learned. A flagged animal stays a record with a place.

**Encounters are sampled** from measured rates, under the conditions the rules state: a wolf and a lone person at night away from fire, a bite in a den, a sprite's prank, a gnome that borrows and repays. Each writes its chronicle line.

**What the day tier does not have.** Paths, collisions, flight step by step, and any decision by an uncounted animal.

## 5. Individuals

- `individual` is a field on the being. No species table decides it.
- Every person is born with it.
- Any other mob gets it when something makes it matter, and keeps it for life: it goes on the watch list, it does a deed, or the chronicle names it. Later pieces add their own causes: being inhabited, and belief.
- When the player sets it, the act passes the door. When a rule sets it, the rule is in the engine.
- A camp's record does not assume its people are human. It holds beings that carry `individual` and call the camp home.

## 6. Zoom both ways

**A tier change is an act.** `{ act: 'tier', to: 'day' }`, stamped and logged. The speed ladder sends it when the speed crosses a threshold.

**Zoom out, tick to day.** Every task record is handed over as it stands, and the day executor finishes it from its progress. Mobs without `individual` become counts. What is dropped: paths, flight and chase states, and the positions of uncounted mobs. Nothing decided is dropped.

**Zoom in, day to tick.** A being in the middle of travel is placed along a real path, at the fraction of the travel time that has passed. A being in the middle of work stands at the stop with its progress. Counts become bodies on valid tiles of their habitat. Placement draws from its own stream, seeded from the seed and the tick. The same state at the same moment gives the same bodies, and the people's stream is not disturbed.

**Pending events.** A decision made at one tier can be carried out at another. A pending event is data: what, who, and when it is due. Every tier honours it.

## 7. The watch list and breakpoints

- An entry names who and what. Who: a being, a camp, a country, or the world. What: one or more event kinds, or all.
- Every chronicle line gains an `event` kind from one table, and the ids of those it concerns. First kinds: birth, death, pairing, arrival, founding, deed, encounter, fire, first sight, goal done. H adds its own.
- Following a being puts it on the list for all kinds. A being's window has Watch beside Follow.
- A watch-list change passes the door.

**A breakpoint fires before the event.**

| Event | What the day tier does |
|---|---|
| Decided: a task a being chooses, or a camp rule whose roll succeeds (a birth, a founding) | It writes a pending event, due within the hour. It zooms in, drops to the default speed, and pauses on the line that says why. The tick tier carries the event out. |
| Sampled: an encounter (a wolf comes for a watched person at night) | It does not apply the outcome. It sets the scene: the wolf is a body near the person, in the dark. It zooms in and pauses. The tick tier's rules play, and the person may reach the fire. |

Space goes on. The speed before the breakpoint is one key away.

## 8. Deeds and the annals

- A deed is a mark by a mob. First deeds: founding a camp, lighting a camp's first fire, building a camp's first structure of each kind, killing a hunter, first sight of the sprites or the gnomes, and dying for a cause the rules can name. H and the climb add more.
- The mark record is the mythos's: kind, value, by, when, why, at. `when` is the tick. The card prints the day and the year.
- The annals keep every major line and every deed for ever, from the first day. The chronicle keeps its 300 newest lines. The legends keep the ages.
- Hover reads a deed as it reads a god's mark. A lean-to says who built it and when.

## 9. The interface

- The speed control becomes the ladder. `-` and `=` walk it. The tier's name shows beside the clock.
- The clock shows the day, the season, and the year.
- At the day tier the map shows beings at their stops. The tile tools are off, as in the ages. Goal priorities and camp sites stay, through the door.
- A Watches drawer lists the entries, and removes one on a key.
- An Annals drawer joins Legends. Both never trim.
- Save and Load are in the palette and on keys.

## 10. Tests and the record

Seventy days at a one-second tick is six million ticks a seed. The soak changes shape.

| Test | What runs | What it asserts |
|---|---|---|
| Tick soak | Six seeds, three days, tick tier | Invariants, a golden fingerprint, and that any death other than old age is a bug. |
| Day soak | Six seeds, ten years, day tier | The floors on people, births, and the goal ladder. The allowed causes of death. Its own golden. |
| Calibration | Three seeds. One snapshot each, then three days through each executor | Stock flows, tasks done by kind, skill gains, needs, births, and deaths agree within a table of tolerances. |
| Rates | `tests/measure-rates.js` measures hazards and animal numbers at the tick tier | The saved rates table matches a fresh measure within tolerance. It is blessed by hand, like the golden. |
| Snapshot | Save in the middle of a task, load, run on | The result equals a straight run. |
| Zoom round trip | Tick to day to tick | Every decided thing survives: people, opinions, skills, stocks, marks, priorities, annals, pending events. |
| Replay | A log with tier and watch changes | The same story twice. |
| Monument | A deed at the tick tier, a century at the day tier, a zoom in | The mark and the annals line remain, and a rule that reads the mark changed an outcome. |
| Breakpoint | A watched birth and a watched encounter | The engine pauses before the event. The birth then happens at the tick tier. The encounter plays by the tick rules. |

**Budgets.** A tick-tier world day in under 5 seconds in Node. A day-tier year in under half a second. `npm run fast` stays fast. The two soaks together in a few minutes. Each budget is measured in the plan that makes it real, and the spec is corrected if one does not hold.

## 11. Files

| File | Holds |
|---|---|
| `src/sim/clock.js` | `CLOCK`, the unit helpers, `rollFor`, the calendar |
| `src/sim/tasks.js` | `TASKS`, the tick executor |
| `src/sim/daytier.js` | the queue, the day executor, the batch steps, counts, sampled encounters |
| `src/sim/rates.js` | the measured rates table, as data |
| `src/sim/snapshot.js` | `REFS`, the serializer, `save()`, `load()` |
| `src/sim/zoom.js` | tier acts, the hand-over both ways, placement, pending events |
| `src/sim/watch.js` | event kinds, the watch list, breakpoints |
| `src/sim/marks.js` | gains deeds and the annals |
| `src/sim/door.js` | gains `tier`, `watch`, `load` |
| `tests/day-soak.js`, `tests/calibrate.js`, `tests/measure-rates.js`, `tests/snapshot.js`, `tests/zoom.js` | as in section 10 |

Load order: `clock.js` directly after `core.js`. The rest follow the files they read.

## 12. Phasing

| Plan | Delivers | The golden | Done when |
|---|---|---|---|
| G1. The clock table | Every duration and rate in `CLOCK`, at today's values. | holds | No bare tick count is left in a rule. Soak green, fingerprint unmoved. |
| G2. Tasks as data | `TASKS`, the tick executor, goals that offer records, `pathToStop`. | holds | No task holds a function. Soak green, fingerprint unmoved. |
| G3. Snapshots | `REFS`, save and load through the door, the snapshot test. | holds | A world saved in the middle of a task loads and runs on to the same fingerprint. |
| G4. The retune | Real units, the speed ladder, the calendar, the reshaped tick soak. | blessed once | The floors hold at real units, or the user has ruled on each that does not. |
| G5. The day tier | The day executor, the queue, camp rules at two step sizes, batch steps, `individual` and counts, the rates table, calibration, the day soak. | day golden made | Ten years run on six seeds inside the budget, and calibration is green. |
| G6. Zoom and watching | Tier acts, pending events, placement, event kinds, the watch list, breakpoints, deeds, the annals, the monument test, the ladder, the Watches and Annals drawers. | holds | The built page runs a century, stops on a watched birth, and shows it. Design notes updated. |

The three refactors come first, so an unmoving golden checks them. The retune then moves the golden once, on code already in its final shape. Every plan leaves dev working and playable.

## 13. What G hands to H

- The camp is the unit at the day tier, and its record does not assume its people are human.
- What a camp knows is data on the camp: its tools, its goals, and later its knowledge.
- People leave marks, and the annals keep them.
- The rates method is proven. The season tier measures its rates from the day tier, as the day tier measures its hazards from the tick tier.
- Pending events carry a decision across tiers.
- The register holds the line for painting a country into tiles on first visit.

## Later

- H: history. The season tier. A settlement is a mob with needs, opinions of other settlements, and acts in a table: found, trade, raid, ally, migrate, abandon, resettle a ruin. Knowledge is held by a settlement, spreads by trade, marriage, and migration, and a collapse can lose it. Family lines run through it. The lingering gods and the gods born of belief join here.
- The climb: content packs. Each step of knowledge with its recipes, goals, structures, and the acts it opens. No fixed end.
- A setting for each watch: pause, or play the scene and climb back.
- The inhabit modes, through the door.
