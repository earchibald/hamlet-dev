# Hamlet (working title: Hearth)

A small Dwarf-Fortress-style simulation. Read `design/notes.md` first. It holds the design, the rules that were tuned by testing, and the bugs already found and fixed. Do not re-derive them.

## Layout
- `src/sim/`: the simulation core. No DOM. Everything that decides what happens. It is plain scripts that share one scope, joined in the order in `src/sim/index.js`. One file per system: core (constants, tables, state, and the chronicle), clock (the calendar, the units, and every duration and rate), field (the countries and their boundaries), marks (what a god did to a country), world, path, camps, beings, species, fae, tasks, goals, weather, gods (the primal gods and the ages), settle (from marks to tiles), main, door. `door.js` is the one way in from outside: `inject(event)`.
- `src/sim/index.js`: the manifest. `source()` joins the files for the page. `load()` runs them in Node for the tests.
- `src/sim/recipes.js`: crafts as data. Add a recipe, get a goal.
- `src/ui/`: the canvas interface. Reads state, draws, handles tools. Never changes the rules. Plain scripts in one scope like `src/sim/`, joined by `src/ui/index.js`. `derive.js` and `keys.js` have no DOM and are tested in `tests/ui.js`. View state changes in `actions.js`, with three recorded exceptions: the window drag handler in `windows.js`, the palette's own list state in `dialogs.js`, and the cursor and hover set by the pointer handlers in `main.js`.
- `src/page.template.html`: the page shell. `__SIM__` and `__UI__` are replaced by `build.js`.
- `dist/hearth-sim.html`: the built single file. It is what gets published as the Claude artifact. Keep it working. Run `node build.js` after every change to `src/`.
- `tests/soak.js`: six seeds for 70 days, with assertions and a golden record. Run it after every change to the core. If the numbers moved and the move is what you meant, bless them with `UPDATE_GOLDEN=1 node tests/soak.js`.
- `tests/lib/run.js`: the shared runner. The script god, the event collector, the counters, and the fingerprint.
- `tests/terrain.js`: the levels, slopes, and hills. Fast. Run it with the soak.
- `tests/crafts.js`: each recipe through the real offers. Fast.
- `tests/ui.js`: the view model in both eras, the stages, the key map, every button has a key, the field colours, the mark rows, and that a watched creation equals an unwatched one. Run it after every change to `src/ui/`.
- `tests/gnomes.js`: the gnomes, their burrows, and their mushrooms. Fast.
- `tests/closing.js`: the cave goals, den contention, site scoring, and lightning. Fast.
- `tests/door.js`: every act through `inject()`, logged whether it lands or not. Fast.
- `tests/options.js`: world size and the level range at start. Fast.
- `tests/ages.js`: twenty-four seeds run the creation to settle, with a report. The tuning tool for the grammar of the ages. Fast.
- `tests/settle.js`: the painters, the founding sites, the creatures, the bodies, and the tile check. Fast.
- `tests/clock.js`: the unit helpers, the table's values, and a lint: no bare time literal in a rule. Fast.
- `npm run fast` runs them all.

## Rules of work
- Write in plain English in the game's text. One idea per sentence.
- Rules read data tables (materials, species, goals). Rules do not check names.
- Every new behaviour must be visible to the player: a chronicle line, a thought, a goal state, or a tooltip row.
- Any death in a 70-day soak that is not old age is a bug until proven otherwise. Trace it with `tests/trace-deaths.js`.
- The engine step is pure. Every outside act enters by `inject()` in `src/sim/door.js` and is logged. A seed, its options, and its log replay the same story.
- A duration or a rate goes in `CLOCK` in `src/sim/clock.js`, or in a species or recipe row written with the unit helpers. `tests/clock.js` fails on a bare one.

## Rules of the split
- Files in `src/sim/` are not ES modules. They share one scope. Do not add `import` or `export`.
- Load-time order matters only twice: `core.js` first, and `beings.js` before `species.js` and `fae.js`, which add actions to `START`.
- `updateWorld()` in `main.js` calls the per-tick steps in a fixed order. The order fixes the random number stream. Do not reorder it.
- Passability, search, and fire read levels. A tile has a z. Use `tileAt(x, y, z)`, `passable(x, y, z)`, and `near(a, b)` for beings. Do not index `world` for anything that can be off the surface.

## First task (done)
`src/sim.js` was split into `src/sim/`, and `tests/soak.js` got assertions and a golden record. The six-seed fingerprint matched before and after, line for line.
