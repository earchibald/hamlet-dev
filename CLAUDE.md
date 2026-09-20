# Hamlet (working title: Hearth)

A small Dwarf-Fortress-style simulation. Read `design/notes.md` first. It holds the design, the rules that were tuned by testing, and the bugs already found and fixed. Do not re-derive them.

## Layout
- `src/sim/`: the simulation core. No DOM. Everything that decides what happens. It is plain scripts that share one scope, joined in the order in `src/sim/index.js`. One file per system: core (constants, tables, state, and the chronicle), clock (the calendar, the units, and every duration and rate), names (the name record, the old tongue, the namer, and the layout guard), field (the countries and their boundaries), marks (what a god did to a country), world, path, camps, tasks (the TASKS table, the tick executor, and human work), beings, species, fae, goals, recipes, weather, gods (the primal gods and the ages), settle (from marks to tiles), main, door. `door.js` is the one way in from outside: `inject(event)`.
- `src/sim/index.js`: the manifest. `source()` joins the files for the page. `load()` runs them in Node for the tests.
- `src/sim/recipes.js`: crafts as data. Add a recipe, get a goal.
- `src/sim/snapshot.js`: the whole world as plain JSON. `REFS`, `takeSnapshot()`, `loadSnapshot(snap)`. The door's `load` act calls `loadSnapshot`.
- `src/ui/`: the canvas interface. Reads state, draws, handles tools. Never changes the rules. Plain scripts in one scope like `src/sim/`, joined by `src/ui/index.js`. `derive.js` and `keys.js` have no DOM and are tested in `tests/ui.js`, though `derive.js` calls `setFocus` from `actions.js`, so a test that drives it must load `actions` too. View state changes in `actions.js`, with four recorded exceptions: the window drag handler in `windows.js`, the palette's own list state in `dialogs.js`, the cursor and hover set by the pointer handlers in `main.js`, and the beat clock (`acc`, `ui.playing`, `beatsLastFrame`) driven by the frame loop in `main.js`. `ui.chronFilter` is written by the drawer pointer handler in `main.js`, and by `restore()` in `state.js`, which writes it with every other persisted view field when it reads the saved state. `ui.focus` is not an exception: `setFocus` in `actions.js` is its one writer, and every file but `actions.js` calls it. An exception here names a field and the function that writes it, so that a grep can settle whether the line is still true. Naming only a file grants more than it means to.
- `src/page.template.html`: the page shell. `__SIM__` and `__UI__` are replaced by `build.js`.
- `dist/hearth-sim.html`: the built single file, and the release. Every push to `dev` publishes it to GitHub Pages at https://earchibald.github.io/hamlet-dev/ by `.github/workflows/pages.yml`, which rebuilds it and copies it to `index.html` at the site root. So a merge into `dev` is a release to the public site, with no further step. It is no longer published as a Claude artifact. Keep it working. Run `node build.js` after every change to `src/`.
- `tests/soak.js`: six seeds for 70 days, with assertions and a golden record. Run it after every change to the core. If the numbers moved and the move is what you meant, bless them with `UPDATE_GOLDEN=1 node tests/soak.js`.
- `tests/lib/run.js`: the shared runner. The script god, the event collector, the counters, and the fingerprint.
- `tests/terrain.js`: the levels, slopes, and hills. Fast. Run it with the soak.
- `tests/crafts.js`: each recipe through the real offers. Fast.
- `tests/names.js`: the name record, the two streams, the old tongue, the namer, who names what and when, epithets and fate, and the layout guard against a moved being or item. Fast.
- `tests/ui.js`: the view model in both eras, the stages, the key map, every button has a key, the field colours, the mark rows, and that a watched creation equals an unwatched one. Run it after every change to `src/ui/`.
- `tests/gnomes.js`: the gnomes, their burrows, and their mushrooms. Fast.
- `tests/wanderer.js`: the valley after the last person. The line that says the people are gone, the wanderer who comes, and winter. Fast.
- `tests/closing.js`: the cave goals, den contention, site scoring, and lightning. Fast.
- `tests/door.js`: every act through `inject()`, logged whether it lands or not. Fast.
- `tests/options.js`: world size and the level range at start. Fast.
- `tests/ages.js`: twenty-four seeds run the creation to settle, with a report. The tuning tool for the grammar of the ages. Fast.
- `tests/settle.js`: the painters, the founding sites, the creatures, the bodies, and the tile check. Fast.
- `tests/clock.js`: the unit helpers, the table's values, and a lint: no bare time literal in a rule. Fast.
- `tests/tasks.js`: the table, the executor, that every task and offer is plain data, and that no file holds a closure task. Fast.
- `tests/snapshot.js`: the streams, `REFS`, `takeSnapshot()`, `loadSnapshot(snap)`, the oracle (save mid-run, load, run on), and the guard that every top-level `let` or `var` is saved or listed with a reason, and every top-level `const` container is named or listed as frozen. Fast.
- `npm run fast` runs them all.

## Rules of work
- Write in plain English in the game's text. One idea per sentence.
- Rules read data tables (materials, species, goals). Rules do not check names.
- Every new behaviour must be visible to the player: a chronicle line, a thought, a goal state, or a tooltip row.
- Any death in a 70-day soak that is not old age is a bug until proven otherwise. Trace it with `tests/trace-deaths.js`.
- The engine step is pure. Every outside act enters by `inject()` in `src/sim/door.js` and is logged. A seed, its options, and its log replay the same story.
- A duration or a rate goes in `CLOCK` in `src/sim/clock.js`, or in a `SPECIES`, `LIFE`, or `RECIPES` row written in the unit helpers or in days. `tests/clock.js` fails on a bare one.
- A task is a plain record. Its behaviour goes in `TASKS` in `src/sim/tasks.js`. Name a thing by id or by coordinates, never by reference.
- A field that points at another record goes in `REFS` in `src/sim/snapshot.js`. `tests/snapshot.js` fails on one that is missing.
- A new top-level `let` or `var` in `src/sim/` goes in `SAVED_STATE` or `NOT_SAVED` in `src/sim/snapshot.js`. A new top-level `const` that holds a container goes in `KNOWN_CONSTS` or `FROZEN_TABLES` in `tests/snapshot.js`.
- State lives in plain objects and arrays. A `Map` or a `Set` a snapshot must save is a fault the guard reports.
- Naming moves no being and no item, adds no thought, and changes no need; only `chronicle` and `chronicleLines` may move for naming work.
- A rule never reads a name's text to decide anything. It reads data tables instead.
- Text a player reads, and developer documentation, goes through a review panel before it lands. Dispatch three or more Sonnet reviewers on the text alone. Each one judges three things: does it sound human, is it plain English, is it readable. Rewrite on their findings. This applies to every element of gameplay, not only to a batch of new phrases.

- Execute a plan with subagent-driven development. A fresh implementer per task, a task review after
  each, and a broad review of the whole branch at the end. Do not ask which mode to use, and do not
  execute a plan inline: the per-task review is what caught the two Criticals in Become E1 task 4 and
  the four production changes made to satisfy bad tests in E2 task 3.
- Name a file by its absolute worktree path in chat, in a report, in a review finding, in a PR body,
  and in a message to another session. A bare relative path opens the primary clone, which is the
  wrong copy. Inside these documents, repo-relative paths are correct and stay.

## Rules of the split
- Files in `src/sim/` are not ES modules. They share one scope. Do not add `import` or `export`.
- Load-time order matters three times: `core.js` first, `clock.js` directly after it, and `tasks.js` before `beings.js`, `species.js`, and `fae.js`, which add kinds to `TASKS`.
- `updateWorld()` in `main.js` calls the per-tick steps in a fixed order. The order fixes the random number stream. Do not reorder it.
- Passability, search, and fire read levels. A tile has a z. Use `tileAt(x, y, z)`, `passable(x, y, z)`, and `near(a, b)` for beings. Do not index `world` for anything that can be off the surface.

## First task (done)
`src/sim.js` was split into `src/sim/`, and `tests/soak.js` got assertions and a golden record. The six-seed fingerprint matched before and after, line for line.
