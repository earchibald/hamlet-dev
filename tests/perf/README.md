# Performance measurement

This folder holds the repeatable performance tools for `src/sim`. It is step 1
of the proposal at `design/proposals/2026-09-19-core-paths.html`. It never
changes `src/` or `dist/`.

| Tool | What it measures | Run it with |
|---|---|---|
| `measure.js` | One world size: tick cost, snapshot cost, and a CPU profile | `npm run perf` |
| `measure.js --ladder` | Three world sizes side by side | `npm run perf:ladder` |
| `draw-harness.js` | The browser's canvas draw cost | `node tests/perf/draw-harness.js`, then open the file it writes |

## `measure.js`

It starts a world the way the tests do (`tests/lib/run.js`, with the script
god that lights each camp's pit, so the run is a real story, not a silent
one). It steps the world forward, then times a snapshot round trip.

Arguments:

| Flag | Meaning | Default |
|---|---|---|
| `--seed` | The world seed | `r` |
| `--days` | Game days to step | `10` |
| `--sw`, `--sh` | World size in sectors | the game's own defaults |
| `--runs` | How many full runs to time | `3` |
| `--profile` | Also capture a CPU profile of one more run | off |
| `--ladder` | Ignore `--sw`/`--sh` and run three sizes: default, 4x area, 9x area | off |

Run it from the repo root:

```
node tests/perf/measure.js --seed r --days 10 --runs 3 --profile
node tests/perf/measure.js --ladder
npm run perf
npm run perf:ladder
```

It prints a table to stdout and writes a full JSON record to
`tests/perf/out/measure-<timestamp>.json`. That folder is in `.gitignore`:
raw runs are not checked in. A baseline worth keeping goes in
`design/perf/`, written by hand from a run's output.

### Why minimum and median

Each number is reported two ways: the MINIMUM across the runs, and the
MEDIAN. A shared machine runs other jobs at the same time as this one, and a
run can catch a slow moment. The minimum is the least contaminated reading:
it is the closest this machine got to running the sim alone. The median
shows what a normal run looks like, load included. Neither number means
anything without the load average beside it. Read both, and read the load.

### Report the load average

Every run prints `os.loadavg()` before and after, the CPU model and core
count, the Node version, and the git commit. Copy the whole header when you
quote a result, not only the number. A number without its load average is
not a number: the same code on the same machine gives different timings ten
minutes apart if other jobs are running.

### What each number means

| Field | Meaning |
|---|---|
| `totalMs` | Wall time to step every tick in the run |
| `creationMs` | Time to build the world before the first tick |
| `meanUs`, `p50Us`, `p95Us`, `p99Us`, `maxUs` | Microseconds per tick: the average, the middle, and three tails |
| `beingsCount`, `itemsCount` | Living and dead beings, and items, at the end of the run |
| `snapshotBytes` | The size of the saved game as JSON |
| `takeSnapshotMs` | Time to build the snapshot object from the running world |
| `stringifyMs` | Time to turn that object into a JSON string |
| `loadSnapshotMs` | Time to read a fresh world back in from that string |

### The CPU profile

`--profile` runs the world once more under `node:inspector`'s CPU profiler.
It takes two profiles. PLAY covers the ticks only. CREATION covers `startWorld` only.
World creation runs once and is costly, so one profile of both would mix its functions into the shares of daily play.
It prints the top 25 functions by SELF time (time in the function's own
lines). It prints the top 15 by INCLUSIVE time (the function plus everything
it calls). Each line names a file and a line number you can open.

The sim's files are joined into one script before they run (see
`src/sim/index.js`). The line number the profiler sees is a line in that
joined script, not a line in the file on disk. This tool converts it back
before it prints.

## `measure.js --ladder`

World size is set by `sw` and `sh` (sectors wide and high). The default is
10x6, so 4x area is 20x12 and 9x area is 30x18. `tests/options.js` allows any
positive integer size, so both sizes are legal without a code change.

`--ladder` runs the default world, a 4x-area world, and a 9x-area world. It
prints one table of median µs/tick and the top 5 self-time functions for
each size.

## `draw-harness.js`

Nobody has measured what the canvas redraw costs in a real browser. This
script writes a copy of `dist/hearth-sim.html` to
`tests/perf/out/draw-harness.html`, with one small script appended before
`</body>`. It does not touch `dist/hearth-sim.html` itself.

The sim and the UI are joined into a single classic `<script>` block with no
modules (see `CLAUDE.md`). Classic scripts in one page share one global
scope. The appended script can call the page's own top-level functions
(`draw`, `step`, `onSettle`, `closeDialogs`, `newWorld`) directly. It can
also read top-level state (`era`, `camps`, `W`, `H`, `beings`, `items`)
directly. The shipped page needs no change for this to work.

Run it, then open the file it wrote in a browser:

```
node tests/perf/draw-harness.js
open tests/perf/out/draw-harness.html
```

The page starts seed `r` and steps past the ages on its own. It times 200
calls to `draw()` and 2000 calls to `step()` with `performance.now()`. It
shows the result two ways: as a box on the page, and as one JSON line in the
console, prefixed `PERF_RESULT`. `drawMsAvg` and `stepMsAvg` are
milliseconds per call.

This harness does not wait on `requestAnimationFrame`. A background tab can
throttle or skip animation frames entirely, so it also works in a tab that
is not in the foreground.
