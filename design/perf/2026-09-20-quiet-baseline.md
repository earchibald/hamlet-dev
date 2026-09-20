# A quiet-machine baseline, with play and creation measured apart

| | |
|---|---|
| What this is | The quiet run that step 1 of the core-paths plan still owed. The first baseline (`2026-09-20-baseline.md`) ran on a busy machine. |
| Machine | Apple M5 Max, 18 cores, Node v26.9.0 |
| Code | `dev` at a86c9ee. That includes fixes 1, 2, and 3 of step 2, and the type checks. It does not include fix 4. |
| Load average | 1.7 to 1.9 over one minute, and 2.9 to 3.0 over five, during both runs. The first baseline ran at 17 to 24. |
| Two runs | Run A is `npm run perf`. Run B is `npm run perf:ladder`, which repeats the default size and adds two larger maps. Both use seed `r`, 10 days, 3 runs each, with the script god. |
| Default size, run A | 107.7 microseconds a tick at the lowest of 3 runs, and 108.6 at the median. |
| Default size, run B | 106.1 microseconds a tick at the median. Run A and run B are separate runs, so they differ by a little. |

## Words used on this page
| Word | Meaning |
|---|---|
| Tick | One step of the simulation. A day on `dev` is 1,000 ticks. |
| µs | A microsecond, a millionth of a second. A millisecond (ms) is 1,000 of them. |
| Load average | How many programs wanted a processor core at once, averaged over a minute or five. This machine has 18 cores, so 2 is quiet and 20 is busy. |
| Script god | A test helper. It lights a camp's fire pit once, if the pit stands laid and cold. The soak uses it too, so that a run leaves a real story. |
| Snapshot | The whole world saved as one JSON text. It is the save file. |
| Self time | The time spent inside a function's own lines. It leaves out the time spent in the functions it calls. |
| Slowest tick in a hundred | The 99th percentile. Out of every hundred ticks, ninety-nine were faster than this. |

## Do not read a fix's gain from these two documents
The busy baseline ran on `dev` before fixes 1 to 3. This one ran after them. The load also changed, by far more than any fix. So the two documents differ in two ways at once. To size a fix, profile before and after at the same load, as each fix's PR did.

## The tool now profiles play and creation apart
The first baseline took one CPU profile of the whole run. World creation (`startWorld`: the ages of the gods, then the settling) runs once and is costly. So the functions of creation were counted in with the functions of daily play. `neighboursOf` read as 26% of a run at nine times the area. Only the gods call it.

`tests/perf/measure.js --profile` now takes two profiles. PLAY covers the ticks only. CREATION covers `startWorld` only. The ladder summary shows the top five of play and the top two of creation.

## The size ladder (run B)
| | Default (280 x 120 tiles) | 4 times the area | 9 times the area |
|---|---|---|---|
| Median tick, in µs | 106.1 | 124.2 | 152.7 |
| Slowest tick in a hundred, in µs (lowest of 3 runs) | 392 | 811 | 1,149 |
| Worst single tick, in ms (lowest of 3 runs) | 5.3 | 20.3 | 15.0 |
| Creation, in ms (lowest of 3 runs) | 304 | 2,023 | 2,029 |
| Beings at the end | 75 | 65 | 84 |
| Items at the end | 2,036 | 6,875 | 18,295 |
| Snapshot, in bytes | 3,539,288 | 14,805,755 | 30,411,856 |

| Most self time in PLAY | Default | 4 times | 9 times |
|---|---|---|---|
| 1 | `updateBeing` 29.2% | `bfs` 20.7% | `updateBeing` 29.2% |
| 2 | `threatsFor` 10.3% | `updateBeing` 13.9% | `threatsFor` 11.4% |
| 3 | `updateWorld` 7.0% | `steps` 10.1% | `updateWorld` 9.9% |
| 4 | `step` 6.5% | `passable` 7.6% | `step` 5.2% |
| 5 | `bfs` 5.9% | `updateWorld` 6.4% | `bfs` 5.1% |

| Most self time in CREATION | Default | 4 times | 9 times |
|---|---|---|---|
| 1 | `neighboursOf` 24.5% | `reachable` 25.5% | `neighboursOf` 52.2% |
| 2 | `reachable` 17.0% | `steps` 14.2% | `inb` 11.3% |

What the named functions do: `updateBeing` is one being's turn. `threatsFor` lists what a being should fear. `bfs` is the path search. `steps` and `passable` are helpers that the path search and the flood fill use for each tile. `reachable` is the flood fill that answers "can I walk there". `neighboursOf` lists the countries that border a country. `inb` tests whether a tile is inside the map.

## What this says
- The average tick grows slowly with the map. It costs 1.44 times as much at 9 times the area.
- The slow ticks grow faster. The slowest tick in a hundred is 2.9 times as long at 9 times the area.
- The snapshot grows almost in step with the map: 8.6 times the bytes at 9 times the area. It is 30 MB there.
- In play, `updateBeing` is the top cost at the default size and at 9 times the area. At 4 times the area, `bfs` is the top cost and `updateBeing` is second.
- `threatsFor` is second at two of the three sizes. Work on it is held until G4 task 3, which changes how often a being decides.
- `reachable` is a cost of creation, not of play. It is in no play top five. So fix 4, which speeds up `reachable`, shortens creation and hardly touches a tick.
- `neighboursOf` (`src/sim/field.js:48`) is half of creation at 9 times the area. It reads every tile of a country each time a god asks for that country's neighbours. It is a candidate for a fix, and it touches no tick.

## Oddities
- Creation takes the same time at 4 times and at 9 times the area: 2.02 s and 2.03 s. Both are 6.7 times the default. I did not chase why. How much the gods do differs from world to world, so area alone does not set the time.
- The worst single tick is longer at 4 times the area than at 9 times: 20.3 ms and 15.0 ms. One world's worst moment is not a trend. The slowest tick in a hundred is the steadier figure.
- The world at 4 times the area ends with fewer beings (65) than the default world (75). Each size is a different world grown from the same seed.

## Still not measured
- The browser's paint. The draw figure in the first baseline times only the JavaScript in `draw()`.
- Anything on G4. A 70-day run there never leaves spring, so it is a different workload.
