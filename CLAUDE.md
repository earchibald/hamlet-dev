# Hamlet (working title: Hearth)

A small Dwarf-Fortress-style simulation. Read `design/notes.md` first. It holds the design, the rules that were tuned by testing, and the bugs already found and fixed. Do not re-derive them.

## Layout
- `src/sim/`: the simulation core. No DOM. Everything that decides what happens. It is plain scripts that share one scope, joined in the order in `src/sim/index.js`. One file per system: core (constants, tables, state, time, chronicle), world, path, camps, beings, species, fae, tasks, goals, weather, main, door. `door.js` is the one way in from outside: `inject(event)`.
- `src/sim/index.js`: the manifest. `source()` joins the files for the page. `load()` runs them in Node for the tests.
- `src/sim/recipes.js`: crafts as data. Add a recipe, get a goal.
- `src/ui.js`: the canvas interface. Reads state, draws, handles tools. Never changes the rules.
- `src/page.template.html`: the page shell. `__SIM__` and `__UI__` are replaced by `build.js`.
- `dist/hearth-sim.html`: the built single file. It is what gets published as the Claude artifact. Keep it working. Run `node build.js` after every change to `src/`.
- `tests/soak.js`: six seeds for 70 days, with assertions and a golden record. Run it after every change to the core. If the numbers moved and the move is what you meant, bless them with `UPDATE_GOLDEN=1 node tests/soak.js`.
- `tests/lib/run.js`: the shared runner. The script god, the event collector, the counters, and the fingerprint.
- `tests/terrain.js`: the levels, slopes, and hills. Fast. Run it with the soak.
- `tests/crafts.js`: each recipe through the real offers. Fast.
- `tests/gnomes.js`: the gnomes, their burrows, and their mushrooms. Fast.

## Rules of work
- Write in plain English in the game's text. One idea per sentence.
- Rules read data tables (materials, species, goals). Rules do not check names.
- Every new behaviour must be visible to the player: a chronicle line, a thought, a goal state, or a tooltip row.
- Any death in a 70-day soak that is not old age is a bug until proven otherwise. Trace it with `tests/trace-deaths.js`.
- The engine step is pure. Every outside act enters by `inject()` in `src/sim/door.js` and is logged. A seed, its options, and its log replay the same story.

## Rules of the split
- Files in `src/sim/` are not ES modules. They share one scope. Do not add `import` or `export`.
- Load-time order matters only twice: `core.js` first, and `beings.js` before `species.js` and `fae.js`, which add actions to `START`.
- `updateWorld()` in `main.js` calls the per-tick steps in a fixed order. The order fixes the random number stream. Do not reorder it.
- Passability, search, and fire read levels. A tile has a z. Use `tileAt(x, y, z)`, `passable(x, y, z)`, and `near(a, b)` for beings. Do not index `world` for anything that can be off the surface.

## First task (done)
`src/sim.js` was split into `src/sim/`, and `tests/soak.js` got assertions and a golden record. The six-seed fingerprint matched before and after, line for line.
