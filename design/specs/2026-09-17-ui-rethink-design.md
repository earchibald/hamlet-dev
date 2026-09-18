# The interface, rethought

Date: 2026-09-17. Branch: `ui-rethink`. Status: design, awaiting review.

This spec replaces the page layout, the panels, and the controls. It does not change a rule of the simulation. Read `design/notes.md` section 13 for the interface as it is.

## Summary

| Decision | Choice |
|---|---|
| Audience | The player first. Rule internals stay one key away. |
| Frame | Window-filling. The map fills the window. Panels are drawers on the right edge. Nothing scrolls but the panels. |
| Strip | One line on top. World half: clock, season, weather. Camp half: the camp's name, four gauges, alert chips. Camp tabs and speed at the right. |
| Drawers | People, Goals, Chronicle, Camp. Keys 1 to 4. Each pops out into a floating window. |
| Windows | Floating, movable, resizable, scrollable. Several inspectors at once, up to six. Positions persist. |
| Goals | Grouped by stage. A stage appears when reached. Done and idle goals fold to a count. A shows all. |
| Alerts | Chips in the strip for fire and cold, food and water, threats, camp events. Numbered. Jump to cause. Mute per chip, per type, per camp. |
| Map keys | A tile cursor, Dwarf Fortress style. Arrows move it. Enter applies the tool. |
| Views | Sector, nearby, world. M cycles. The cursor works in all three. |
| Tools | Inspect is the default. Light fire and Nudge are one-shot and return to Inspect. Shift makes them stick. Camp site leaves the interface. |
| Focus | Tab cycles map, drawers, windows. Esc goes back. |
| Palette | Cmd-K or Ctrl-K. Fuzzy search over every action and every named thing. Rows show their keys. |
| Hotkeys | Every clickable thing has a key printed on it. Esc, Enter, arrows, and numbers behave the same everywhere. |
| Camp names | Shown wherever a camp appears. A naming system is a separate spec. |

## 1. What is wrong now

The page is a scrolling document. At 1440 px wide and day 21 the fold holds a blurb, a two-row toolbar, a hint line, the map, and the first eight of forty goals. The chronicle, the people, the stash, and the animal counts are below the fold. The fire has no gauge. The weather is grey text after the clock. Decision scores, the best debug tool in the project, live in a hover card that closes on scroll. The three tools are all sticky, and one of them, Camp site, does something the player cannot see the borders of.

## 2. The frame

The page is a CSS grid that fills the window: one strip row and one map row. The map box holds the active canvas and everything that floats over it. The body does not scroll.

```
+--------------------------------------------------------------------------+
| Day 21, 14:00 · Autumn, winter in 11 · Rain | REEDWATER  Hearth ▮▮▮▮▯ 4d  |
|                                             | Food ▮▮▮▮▮ 23/22 Water 31  |
|                                             | Beds ▮▮▮▯ 3/4  ⚠1 ⚠2 ⚠3   | tabs · speed · ? |
+--------------------------------------------------------------------------+
| [Inspect I] [Light fire F] [Nudge N]                          |People 1|  |
| Open meadow 5,3 · Surface · cursor 9,11: Sable                |Goals  2|  |
|                                                    +--------+ |Chron  3|  |
|            map                                     | drawer | |Camp   4|  |
|                              +----------------+    |        |            |
|                              | Sable    [x]   |    |        |            |
|                              | window         |    +--------+            |
|                              +----------------+                          |
| Day 21, 11:00 Sable and Greta can no longer stand each other.   3 chron  |
+--------------------------------------------------------------------------+
```

The strip is one line at any width above 1100 px. Below that the camp half wraps to a second line. Below 800 px the drawers become full-height overlays and only one is open at a time. Touch is out of scope, but the layout must not break.

The blurb, the seed box, the legend, and Things to try leave the main screen. The blurb and seed go to the start dialog. The legend and Things to try go to the help dialog under `?`.

## 3. The strip

The strip has a world half and a camp half, with a visible divider.

| Item | Half | Content | Source |
|---|---|---|---|
| Clock | world | `Day 21, 14:00` | `stamp()` |
| Season | world | `Autumn, winter in 11` | `seasonOf()` and the day count |
| Weather | world | `Rain`, `Sleet`, `Night`, or nothing | `weather.storm`, `isNight()` |
| Camp name | camp | `Reedwater`, as a heading. Click or F1 to F6 to switch | `camp.name` |
| Hearth | camp | gauge of fuel, `4 days of wood` from the woodpile at the burn rate | `camp.pit`, `camp.stash.stick`, `camp.stash.log`, `PIT_MAX` |
| Food | camp | gauge of meals against the aim, `23 of 22` | the stock food goal's numbers |
| Water | camp | gauge of drinks against the aim | the keep water goal's numbers, hidden until the waterskin |
| Beds | camp | gauge of sleeping places against people, `3 for 4` | `camp.shelter`, huts, member count |
| Chips | camp | alert chips, numbered 1 to 9 | section 4 |
| Tabs | right | one per camp when there are two or more | `camps` |
| Speed | right | Pause, Step, Hour, 1×, 4×, 16× | view state |
| Help | right | `?` | opens the help dialog |

A gauge is a bar with a number. The bar turns amber below the aim and red at a quarter of it. A gauge that has no meaning yet, such as water before the waterskin, is not drawn.

## 4. Alerts

An alert is a condition read from sim state each frame. When it holds, a chip shows in the strip. When it stops holding, the chip goes. Camp events are pulses: they show for 1500 ticks and then go.

| Type | Condition | Colour |
|---|---|---|
| fire | hearth under a day of wood, hearth out, a wildfire within the camp's sector | red |
| cold | a member below 30 warmth | red |
| food | meals below the aim in autumn or winter, a member below 25 food | amber |
| water | no water at camp after the waterskin, a member below 25 water | amber |
| spoil | food went off in the last 500 ticks | amber |
| threat | a wolf within 12 tiles of the hearth, a raid or a mauling in the last 1500 ticks | red |
| sprites | first sight, favour below -20, a grove out for revenge | amber |
| event | newcomer arrived, child born, death, goal unlocked, founding party left | blue, pulse |

A chip reads `1 Sable is cold`. The number is its key. Alt+number, or a click, moves the cursor to the cause, opens the view that shows it, and opens the inspector for a being. Shift+Alt+number, or a right click, opens the mute menu: this chip, this type here, this type everywhere. Numbers pick. Mutes persist. A muted chip still counts in the palette so nothing is lost.

A chip from a camp that is not on screen carries the camp's name: `2 Pinehill: hearth is out`.

Alerts read existing state. No new field is stored in the sim by this spec. Two alerts wait on the naming spec: the spoil chip reads the `tag` that spec puts on chronicle lines, and the People rule that keeps a dead member for a day reads the `diedAt` stamp that spec adds.

## 5. The drawers

Four tabs stand on the right edge of the map. Keys 1 to 4 toggle them. More than one may be open. Open drawers stack in a column and share the height. Each has a header with its name, its count, a pop-out button, and its keys.

**People.** One row per member of the viewed camp: a number, the name, a stage tag for young or old, a mood bar, and the status word. Rows sort by trouble first: a red need, then a cold or hungry, then the rest by name. Dead members show for a day, then leave the list and stay in the chronicle. Enter or a click opens the inspector window for the row. F follows.

**Goals.** Grouped by stage. A stage is a heading with a fold count: `Food · 2 done`. Under it, the live goals: active and idle standing goals, and blocked goals whose prerequisite is a goal in a reached stage. Done goals fold into the count. Idle recipes fold into the count too, with `5 idle`. Enter on a heading unfolds it. Left and Right set the priority of the focused goal. A toggles the full ladder.

| Stage | Goals |
|---|---|
| fire | make camp, fire pit, keep the fire, three days |
| food | stock food, cook, snares, hunt deer, drying rack, smoke meat, fish the river |
| tools | axe, firestones, spear, waterskin, water at camp |
| shelter | lean-to, storehouse, huts |
| crafts | every recipe in `recipes.js` except fish the river |
| sprites | the sprites of the groves, offering stone, gifts, ward, drive off |
| settlement | become a village, found a second camp, keep wolves off |

Two rules, both read from data:

- A stage is reached when any goal in it is not blocked. The fire stage is always reached.
- In a reached stage, a blocked goal shows only when the goal named in its `after` field is done. Recipes carry `after` today. The hand-written goals get the same field. A blocked goal with no `after` always shows.

The `stage` and `after` fields are data on each entry in `GOALS` and each recipe. They change no rule and move no number in the golden record.

**Chronicle.** The full log, newest first, as today. Kinds keep their colours. A filter row at the top: all, this camp, major only. When the drawer is shut, the newest line shows in the map foot.

**Camp.** What today is one sentence under People: the stash as a table, the tools, sprite favour when known, the count of each animal in the world, tiles burning. The camp's age and its founding line from the chronicle.

## 6. Windows

A window is a panel that floats over the map. It has a title bar, a close button, a body that scrolls, and a resize grip. Drag the bar to move it. Esc closes the focused window. Positions and sizes persist per window kind.

Sources of windows:

- A drawer popped out with its button or O. The drawer's tab shows a dot while it is out. O on the window docks it back.
- An inspector, pinned from the map with Enter or a click, or from a People row. Up to six at once. The seventh closes the oldest. Each follows its target and updates every 250 ms as the panels do.

The inspector keeps today's content and order: head, needs, thoughts, last decision, history. Personality, skills, and relationships fold under one heading for a person. The tile card stays a table. Hover still shows an unpinned card, as today, and it goes when the pointer leaves.

## 7. The map and the cursor

Three views, as the mid-map branch has them: sector at 26 px a tile, nearby at 9 px, world at 3 px. M cycles them. The mid-map branch merges into this branch before the map work starts.

A tile cursor lives on the map in all three views. In the sector view it is one tile. In the nearby and world views it is one sector. Arrows move it. Shift+arrows move it five tiles. Ctrl+arrows move it one sector. When it crosses the edge of the sector view, the view follows. Home puts it on the viewed camp's hearth. W opens the world view with the cursor on the viewed camp.

The mouse moves the cursor too. A hover card shows what the cursor is on, as today.

Enter applies the active tool at the cursor. In the nearby and world views, Enter opens the sector.

The map foot is a line at the bottom of the map: the sector name and coordinates, the level, what the cursor is on in one phrase, and the newest chronicle line when the chronicle drawer is shut.

Movement keys are provisional. A feedback pass follows the first build, and the key map is one table so it can change in one place.

## 8. Tools

| Tool | Key | Does | Mode |
|---|---|---|---|
| Inspect | I | Hover shows a card. Enter or click pins a window. | default, sticky |
| Light fire | F | Lights the fire pit under the cursor. Anything else starts a wildfire. The hover card says what will burn. | one-shot |
| Nudge | N | A person drops their task, wakes, and thinks again. An animal startles. | one-shot |

A one-shot tool returns to Inspect after one use. Shift+key, or Shift+click on the button, makes it stick until another tool is chosen. The button shows a pin while stuck.

Camp site leaves the interface. `setSite` stays in the sim for tests and scripts. The chronicle line for a player-moved site stays for them.

## 9. The hotkey language

Rules:

- Esc goes back. Close the focused window, else return a drawer's focus to the map, else close a modal. Esc never leaves a view without something to close.
- Enter acts. On the map, apply the tool. In a list, open the row. In a dialog, take the default.
- Arrows move: the cursor, the row, the choice.
- Every button prints its key. A button without a key is a bug, and `tests/ui.js` fails on it.
- Numbers pick from dynamic lists: chips, drawers, rows, camps, dialog choices.
- A chord is a leader key and a lettered choice in a small modal. The modal is the reference card.

| Key | Map focus | Drawer focus | Window focus |
|---|---|---|---|
| Arrows | move cursor | move row | scroll |
| Shift+arrows | move 5 tiles | | |
| Ctrl+arrows | move a sector | | |
| Enter | apply tool | open row | |
| Esc | close topmost window | back to map | close window |
| Tab, Shift+Tab | next, previous focus | same | same |
| 1 to 4 | toggle drawer | pick row 1 to 9 | |
| I, F, N | choose tool | same | same |
| Shift+F, Shift+N | choose tool, sticky | same | same |
| M | cycle view | same | same |
| [ and ] | level down, up | same | same |
| Space | pause, resume | same | same |
| . | step one tick | same | same |
| > | step one hour | same | same |
| - and = | slower, faster | same | same |
| Left, Right | move cursor | goals: priority down, up | |
| A | | goals: show all | |
| O | | pop out | dock back |
| Alt+1 to 9 | jump to chip | same | same |
| Shift+Alt+1 to 9 | mute menu for chip | same | same |
| F1 to F6 | switch camp | same | same |
| Home | cursor to hearth | | |
| W | world view on the camp | | |
| G, then a letter | open a stage in Goals | same | same |
| Cmd-K, Ctrl-K | command palette | same | same |
| ? | help | same | same |

## 10. The command palette

Cmd-K on a Mac, Ctrl-K elsewhere. A modal with a text box and a list. Fuzzy match on words. Arrows and numbers move, Enter runs, Esc closes.

Rows come from two tables:

- Static: every action in the key map, named in plain English, with its key.
- Dynamic, built when the palette opens: `Inspect Sable`, `Follow Sable`, `Smoke meat: High`, `Go to Pinehill`, `Go to Pine forest 3,2`, `Jump to: Sable is cold`, `Unmute: cold`.

With an empty query the list is: Help, then the open chips, then the tools and drawers, then the last five commands run. Every row prints its key when it has one, so the palette teaches the keys.

## 11. Dialogs

- **Start.** Shown on load and from the palette. The blurb, the seed box, Make world, and a random seed. Enter makes the world.
- **Help.** The key map as a table, the legend, and Things to try. `?` opens it, Esc closes it.
- **Mute.** Three choices, numbered.

A dialog is modal. It takes focus, and Esc closes it. Only one dialog is open at a time.

## 12. Architecture

`src/ui.js` becomes `src/ui/`, joined by a manifest as `src/sim/` is. The files are plain scripts in one scope, no modules.

| File | Owns | DOM |
|---|---|---|
| `index.js` | the join order and `source()` | no |
| `state.js` | view state: cursor, view, level, followed being, open drawers, windows, focus, mutes, speed | no |
| `derive.js` | pure functions from sim state to view data: alerts, stages with folds, gauges, camp summary, people rows, palette rows | no |
| `keys.js` | the key map table and the dispatcher that reads focus and returns an action name | no |
| `actions.js` | the only functions that change view state, one per action name | yes |
| `map.js` | the three canvases, the cursor, the foot | yes |
| `strip.js` | the strip, chips, tabs, gauges | yes |
| `panels.js` | the four drawers | yes |
| `windows.js` | floating windows: create, move, resize, focus, persist | yes |
| `inspect.js` | the person and tile cards, as today | yes |
| `dialogs.js` | start, help, mute, palette | yes |
| `page.template.html` | the shell as a fixed grid, and the CSS | |

`build.js` joins `src/ui/` as it joins `src/sim/`. `dist/hearth-sim.html` stays one file.

**Data flow.** Each frame, `derive.js` builds a view model from sim state. The strip and panels render from it when its fingerprint changes, as the chronicle does today. The map draws every frame. A key goes to `keys.js`, which reads `state.focus` and returns an action name. `actions.js` runs it. Clicks call the same actions. There is no second path.

**Sim changes.** Three, all data:

- A `stage` field on every entry in `GOALS` and every recipe, and an `after` field on the hand-written goals that have a prerequisite goal.
- A `stageReached(stage)` reader beside `goalState`, from the rules in section 5.
- The `poke` function keeps its name in the sim. The interface calls it Nudge.

None moves a number. The golden record must not change. If it does, that is a bug in this work.

**Persistence.** `localStorage` under one key, `hearth.ui`: window positions and sizes, open drawers, mutes, speed. Every read and write is in a try block. The page works with storage blocked.

## 13. Testing

- `tests/ui.js`, fast, in Node. Loads `derive.js`, `keys.js`, and the template. Asserts: at day 1 only the fire and food stages show; at day 21 of seed r the stages and folds match a written expectation; a member below 30 warmth raises a cold chip and a muted type raises nothing; every `id` on a button in the template has a key in the map; every key map entry names an action in `actions.js`; Esc from each focus state lands where section 9 says; the palette lists every static action.
- The soak, terrain, and crafts stay green and the golden record does not move.
- A Safari check of the built page at 1440 and 1024 wide: drawers open and shut, one window floated, dark and light. Screenshots go in the pull request.

## 14. Out of scope

- The naming system for camps, sectors, and the world. Own spec. This spec shows `camp.name` wherever a camp appears and leaves what sets it alone.
- Touch. The layout must not break on a narrow window, and that is all.
- A save format. Window positions persist. The world does not.
- New rules of any kind.

## 15. Order of work

1. Merge the mid-map branch into `ui-rethink`.
2. Split `src/ui.js` into `src/ui/` with no change in behaviour. Build and check the page.
3. The `stage` field and reader in the sim. Soak stays green, golden unchanged.
4. `derive.js`, `keys.js`, `actions.js`, and `tests/ui.js` for them.
5. The frame and the strip.
6. The drawers.
7. Windows and inspectors.
8. The cursor and the map foot.
9. Tools: one-shot, sticky, Nudge, Camp site out.
10. Palette and dialogs.
11. Safari check, screenshots, notes section 13 rewritten.
