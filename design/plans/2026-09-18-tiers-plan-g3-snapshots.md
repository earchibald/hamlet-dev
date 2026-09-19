# Snapshots Implementation Plan (G3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save the whole state of a world as JSON, load it into a fresh sim, and run on to the same story as a straight run.

**Architecture:** One new file, `src/sim/snapshot.js`, holds a table `REFS` that names every field that points at another record. `takeSnapshot()` copies the state and turns each named field into an id, an index, or coordinates. `loadSnapshot(snap)` builds every record in a staging area, turns the ids back into the records, and only then replaces the state. The door gains one act, `load`. The page gains Save, Load, and one autosave slot.

**Tech stack:** Plain JS scripts in one shared scope (`src/sim/`, `src/ui/`), `node --test`, no dependencies.

| Task | Delivers | Golden |
|---|---|---|
| 1 | Random streams whose position can be read and set | holds |
| 2 | `REFS`, `takeSnapshot()`, and a test that finds a reference `REFS` does not name | holds |
| 3 | `loadSnapshot(snap)`: staged, refuses bad input, restores identity | holds |
| 4 | The oracle: save in the middle of a task, load, run on, equal a straight run. A seventh soak test. | holds |
| 5 | The `load` act at the door, and a replay that passes over it | holds |
| 6 | The page: Save, Load, the autosave at dawn, Continue | holds |
| 7 | The notes, the spec's as-built paragraph, `CLAUDE.md`, the settings register, and the measured budgets | holds |

The spec is `design/specs/2026-09-18-time-and-tiers-design.md`, section 3, the Snapshot row of section 10, and the G3 row of section 12. The survey of the state is `.superpowers/sdd/g3-state-survey.md` (gitignored, in the worktree). Every task reads it.

## Global Constraints

- G3 changes no rule. The six-seed golden in `tests/soak.js` must not move. Never run `UPDATE_GOLDEN=1`. Do not lower a floor. Do not park a test.
- Work in `/Users/earchibald/Worktrees/hamlet-tiers` on branch `tiers-g3`. Never check out, stash, or commit in `~/Code/hamlet`.
- Files in `src/sim/` and `src/ui/` are plain scripts in one scope. No `import`, no `export`. The sim and the UI share one scope on the built page, so a new global name must be new in both. Check with `grep -rnw NAME src/`.
- The body of `load()` in `src/sim/index.js` (the one line that runs the joined source) must not change. Edit only `FILES`, the `API` string, and the header comment there. If a security hook blocks a legitimate edit, stop and report it. Do not work around it with another tool.
- Run `node build.js` after every change to `src/`. Commit the built `dist/hearth-sim.html`.
- The gates for every task: `npm run fast` all green, and `node tests/soak.js` 66 of 66 (67 of 67 from task 4 on) with the golden unmoved.
- `updateWorld()`'s order, the order of `beings`, `items`, `camps`, `caves`, `raised`, `groves`, `field.regions`, `boundaries`, every `region.marks`, every `boundary.tiles`, and the key order of every object in the state must survive a round trip.
- A snapshot is taken only between steps and only in the days era (`era === 'days'`). In the ages, the seed replays the creation, so no snapshot is needed.
- A task record and an offer stay plain data (plan G2). Do not add a function or a record reference to one.
- A duration or a rate goes in `CLOCK` (`src/sim/clock.js`). `tests/clock.js` fails on a bare one.
- Game text is plain English, one idea per sentence.
- Documents use the house style: one idea per sentence, active voice, one word for one meaning, paragraphs of six sentences or fewer, a summary table at the top where one helps.
- Commit messages are a plain sentence that says what changed. End each with:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn`

## The design every task follows

### Names

| Name | File | What it is |
|---|---|---|
| `SNAPSHOT_VERSION` | `snapshot.js` | The number `1`. `loadSnapshot` refuses any other. |
| `REFS` | `snapshot.js` | For each record type, the fields that hold a reference, and the kind of record each points at. |
| `REF_KINDS` | `snapshot.js` | For each kind of target, `toId(record)` and `fromId(id, stage)`. |
| `takeSnapshot()` | `snapshot.js` | Returns a plain object. `JSON.stringify` of it never throws. It changes nothing in the state and draws nothing from `rng`. |
| `loadSnapshot(snap)` | `snapshot.js` | Returns `null` when it loaded, or a sentence that says why it did not. On a refusal the state is untouched. |
| `streamState(f)`, `setStreamState(f, n)` | `core.js` | Read and set the position of a `mulberry32` stream. |

`snapshot.js` loads after `main` and before `door` in `FILES`. It reads no other file's tables at load time.

### How a reference is named

A reference field holds, in the snapshot, the value in the third column. `null` stays `null`. A missing field stays missing.

| Kind | Target | In the snapshot |
|---|---|---|
| `camp` | a camp | its index in `camps` |
| `cave` | a cave | its index in `caves` |
| `hill` | a hill | its index in `hills` |
| `grove` | a grove | its index in `groves` |
| `sector` | a sector | its index in `sectors` |
| `region` | a region of the field | its `id` |
| `tile` | a tile | `idx3(x, y, z)`, one number |
| `tiles` | an array of tiles | an array of those numbers, in order |
| `mark` | a mark that lives in a `region.marks` | `[regionId, indexInMarks]`. A mark found in no region is saved whole as `{ whole: mark }`; nothing shares it. |
| `snare` | a snare that lives in a `camp.snares` | `[campIndex, indexInSnares]` |
| `pit` | a pitfall that lives in a `camp.pitfalls` | `[campIndex, indexInPitfalls]` |
| `body` | a god's body: a hill, a cave, or a region | `{ hill: i }`, `{ cave: i }`, or `{ region: id }` |
| `line` / `lines` | a chronicle line | its index in the snapshot's `lines` list (see below) |

`toId` throws when it cannot name its record (an `indexOf` of -1, a tile that `tileAt` does not return). A snapshot that cannot be exact must fail loudly in the tests, never quietly in play.

A chronicle line is one object that sits in `chronicle`, in `legends`, and in each `being.history`. The snapshot holds every distinct line once, in `lines`, in the order first met (walk `chronicle`, then `legends`, then each being's `history` in `beings` order). `chronicle`, `legends`, and each `history` are saved as arrays of indexes. The loader gives back one object for one index, so the sharing survives.

### What `REFS` holds (from the survey; task 2 verifies each against the code)

| Record | Reference fields |
|---|---|
| tile | `hill: hill`, `cave: cave`, `mouth: cave`, `garden: camp`, `struct.camp: camp`, `struct.snare: snare`, `struct.pit: pit` |
| being | `camp: camp`, `grove: grove`, `target: camp`, `den: cave`, `oldDen: cave`, `shyOf: camp`, `body: body`, `history: lines` |
| camp | none of its own. `snares[]` and `pitfalls[]` are owned here. |
| snare, pitfall | `camp: camp` |
| cave | `tiles: tiles`, `patch: tiles`, `mouth: tile`, `exit: tile`, `deep: tile`, `blocked: tile`, `hill: hill`, `searched: camp`, `cleared: camp`, `disturbedBy: camp`, `from: cave`, `mark: mark`, `holding.camp: camp` |
| hill | `mark: mark` |
| grove | `sector: sector`, `cave: cave`, `mark: mark` |
| creation | `gate.start: region` |
| field | `root: region` |

A dotted name is a path into a plain object that the record owns. The encoder copies the objects along that path; it never writes to the live record.

### What the snapshot holds

```
{ version, seed, options,
  tick, nextId, fireCount, wanderAt, era, age, pulseAge,
  rng, godRng,                       // stream positions; godRng is null when the stream is null
  levels,                            // see "Tiles" below
  raised,                            // kind `tiles`, in the live order
  hills, caves, sectors, groves, camps, campNow,   // campNow: index of the global `camp`
  beings, items, corpses,
  lines, chronicle, legends,
  weather, goalPriority, namePool, godNamePool, gestureFallbacks,
  creation, field, boundaries,       // field is { regions, root }; byId is rebuilt
  resCache,                          // an array of [key, value] in the Map's order
  startRegion,                       // an array of the Set's numbers in its order, or null
  doorLog }
```

Derived state is not saved. The loader rebuilds it: `world` (`levels[ZOFF]`), `itemGrid` (`rebuildItemGrid()`), `regionOf` and `field.byId` (walk `field.regions` in order), the search scratch (`allocSearch()`), and `replayHead` (`resetDoor()`, then put `doorLog` back). `deciding`, `saidFrom`, and `settleNow` live only inside one step; the loader sets them as `beginCreation` does.

`resCache`, `startRegion`, `raised`, and `fireCount` are saved as they stand. Each can be rebuilt, and each rebuilt value can differ from the live one and move the random stream. The survey, section 1d, says how.

### Tiles

Tiles are the bulk: about 5.8 MB of a 13 MB naive snapshot. Save a level as an array of `W * H` entries. An entry is `null` for no tile. Otherwise it is the tile without `x`, `y`, and `z`, and without any field whose value equals the default that `makeTile` gives it (`feature: null`, `berries: 0`, `fire: 0`, `struct: null`, `slope: false`, `hill: null`, `cave: null`, `mouth: null`). `ground` is always saved. The loader builds `{ x, y, z, ground, ...defaults, ...saved }` with an object spread, in that order, so the key order of a loaded tile equals a made one's for the fields `makeTile` sets. Take the defaults from one table, `TILE_DEFAULTS`, that `makeTile` also reads, so the two cannot drift.

Use object spread, not `Object.assign`, to copy a parsed record. A save file is outside data, and a spread defines an own key named `__proto__` where `Object.assign` would call the setter.

### The loader works in a stage

`loadSnapshot(snap)`:

1. Checks `snap.version === SNAPSHOT_VERSION`, that `snap.era === 'days'`, and that `snap.options` passes the same checks as `setOptions` without setting anything. A failure returns a sentence.
2. Inside one `try`, builds a `stage` object: every array of records, copied from the snapshot, with sizes taken from `snap.options`, not from the live `W` and `H`. Then it walks `REFS` and turns every id into the staged record. `fromId` throws on an id out of range.
3. A throw returns `'This save cannot be read.'` and the state is as it was.
4. Only then commits: `setOptions`, `allocSearch`, every global from the stage, the two streams, the derived state, the door log.

It calls none of `makeBeing`, `makeCamp`, `makeCave`, `addItem`, `addRegion`, `placeTile`, because each draws from `nextId` or from `rng`.

### The door

`inject({ source, act: 'load', snapshot })` is the one way a load enters. The act calls `loadSnapshot`. The snapshot carries its own `doorLog`, and the load puts it back, so the story so far is the saved world's story. `inject` then appends `{ source, act: 'load', tick }` with the new tick and without the snapshot. For this act alone `inject` skips the `event.tick !== tick` guard and logs after the act, not before. A refused load leaves the state and the log as they were, plus no entry.

A replay passes over a `load` entry. The saved world's story is the seed, the options, and the entries before it, and the oracle of task 4 proves that a loaded world runs on as the straight one does. `logGod` in `tests/lib/run.js` skips an entry whose act is `load`.

### The page

| Piece | Behaviour |
|---|---|
| Save | Writes `hearth-<seed>-day-<n>.json` through a Blob and a link with `download`. In the ages it shows "The world is not made yet. There is nothing to save." |
| Load | Opens a file picker, reads the file, parses it, and sends `inject({ source: 'player', act: 'load', snapshot })`. A refusal shows the door's sentence. |
| Autosave | One slot, written at each dawn, in IndexedDB (database `hearth`, store `saves`, key `autosave`). A snapshot is larger than `localStorage` allows. Every IndexedDB call sits in `try`/`catch`; a page that cannot store still plays, and says once in the status line that it cannot keep an autosave. |
| Continue | The start dialog shows "Continue the last world" when the slot holds a save. |
| After a load | One function, `onLoad()` in `src/ui/actions.js`, resets the view as `onSettle()` does: `viewCamp = camps[0]`, `followId`, the inspect windows, `ui.pulses`, `ui.seenTick`, `ui.lastStates`, `worldDirty`, the field cache, and it clamps `cursor` and `lvl`. |

The interface belongs to the feedback-pass session. Keep the change small, put the storage code in one new file `src/ui/saves.js`, and change view state only in `actions.js`. `tests/ui.js` holds that every button has a key; give Save and Load palette rows and keys by the pattern the file already uses.

---

### Task 1: Random streams that can be read and set

**Files:**
- Modify: `src/sim/core.js` (`mulberry32`, near line 96), `src/sim/index.js` (the `API` string: add `mulberry32`, `streamState`, `setStreamState` if absent)
- Test: `tests/snapshot.js` (create), `package.json` (`fast` gains `tests/snapshot.js`, before `tests/ui.js`)

**Interfaces:**
- Produces: `streamState(f) -> number` and `setStreamState(f, n)`. `mulberry32(seed)` still returns a function that returns a number in `[0, 1)`, with the same sequence as today.

- [ ] **Step 1: Write the failing tests** in a new `tests/snapshot.js`:

```js
// Snapshots: the streams, the table of references, the round trip, and the oracle.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('../src/sim/index.js');

test('a stream gives the numbers it gave before', () => {
  const api = load(); const f = api.mulberry32(12345);
  assert.deepEqual([f(), f(), f()], PINNED);
});
test('a stream set back to a position gives the same numbers again', () => {
  const api = load(); const f = api.mulberry32(99); f(); f();
  const at = api.streamState(f), a = [f(), f(), f()];
  api.setStreamState(f, at); assert.deepEqual([f(), f(), f()], a);
  const g = api.mulberry32(1); api.setStreamState(g, at); assert.deepEqual([g(), g(), g()], a);
  assert.ok(Number.isInteger(at));
});
```

  `PINNED` is three numbers that you print from the code as it stands, before you change `mulberry32`: add `mulberry32` to `API` first if it is absent, then run `node -e "const f=require('./src/sim/index.js').load().mulberry32(12345);console.log(f(),f(),f())"` and write the printed values into the test as a literal array. The test pins today's sequence.

- [ ] **Step 2: Run** `node --test tests/snapshot.js`. Expected: the second test fails, `api.streamState is not a function`.
- [ ] **Step 3: Implement.** In `core.js`:

```js
/* Seeded random numbers. A stream's whole state is one 32-bit number, and a snapshot reads it and sets it. */
function mulberry32(a){
  const f = function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.state = () => a | 0; f.setState = n => { a = n | 0; };
  return f;
}
const streamState = f => f.state(), setStreamState = (f, n) => f.setState(n);
```

- [ ] **Step 4: Run** `node --test tests/snapshot.js` (pass), `node build.js`, `npm run fast`, `node tests/soak.js`. Expected: all green, golden unmoved. Time seed `r` three times before and after with a 20-day run in `node -e`; report both. The stream is the hottest function in the sim, so a slowdown above 2 percent is a finding to report.
- [ ] **Step 5: Commit.**

### Task 2: `REFS` and `takeSnapshot()`

**Files:**
- Create: `src/sim/snapshot.js`
- Modify: `src/sim/index.js` (`FILES`: `'snapshot'` after `'main'`; `API`: `REFS`, `REF_KINDS`, `SNAPSHOT_VERSION`, `takeSnapshot`, `unnamedRefs`, `TILE_DEFAULTS`, and getters for any state the tests below need and the API lacks, such as `field`, `boundaries`, `creation`, `legends`, `era`; the header comment gains one sentence on where `snapshot.js` loads), `src/sim/core.js` (`TILE_DEFAULTS`), `src/sim/world.js` (`makeTile` reads `TILE_DEFAULTS`)
- Test: `tests/snapshot.js`

**Interfaces:**
- Consumes: `streamState` from task 1.
- Produces: `takeSnapshot() -> object` with the fields listed in the design, `REFS`, `REF_KINDS[kind].toId(record)`, `unnamedRefs() -> string[]`.

- [ ] **Step 1: Verify the table.** For every row of "What `REFS` holds", find the line that writes the field (the survey gives file and line) and confirm the kind. Then hunt for a reference the table lacks: run the completeness test of step 2 against a first, empty `REFS` and read what it reports. Record each addition or correction in your report.
- [ ] **Step 2: Write the failing tests.** Add to `tests/snapshot.js`:

```js
const { runDays } = require('./lib/run.js');
/* A world with history in it: lit fires, snares, dens, a grove, perhaps a second camp. Run once, shared. */
let late; const lateWorld = () => late || (late = runDays('r', 40).api);

test('a snapshot goes through JSON whole', () => {
  const api = lateWorld(), snap = api.takeSnapshot();
  const text = JSON.stringify(snap); assert.deepStrictEqual(JSON.parse(text), snap);   // fails on an undefined field, which JSON drops
  assert.equal(snap.version, api.SNAPSHOT_VERSION);
});
test('a snapshot holds no number JSON cannot hold, no undefined, and no function', () => {
  const bad = []; const walk = (v, p) => {
    if (typeof v === 'number' && !Number.isFinite(v)) bad.push(p);
    else if (v === undefined || typeof v === 'function') bad.push(p);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, p + '[' + i + ']'));
    else if (v && typeof v === 'object'){ if (Object.getPrototypeOf(v) !== Object.prototype) bad.push(p + ' (not plain)'); for (const k of Object.keys(v)) walk(v[k], p + '.' + k); }
  };
  walk(lateWorld().takeSnapshot(), 'snap'); assert.deepEqual(bad.slice(0, 5), []);
});
test('taking a snapshot changes nothing and draws nothing', () => {
  const api = lateWorld(), a = JSON.stringify(api.takeSnapshot()), b = JSON.stringify(api.takeSnapshot());
  assert.equal(a, b);
});
test('REFS names every field that points at a record', () => {
  assert.deepEqual(lateWorld().unnamedRefs().slice(0, 10), []);
});
test('a snapshot is small enough to keep', () => {
  const n = JSON.stringify(lateWorld().takeSnapshot()).length;
  assert.ok(n < 6e6, `a day-40 snapshot of seed r is ${n} characters`);
});
```

  An `undefined` field on a live record (the survey names `tile.planted`) must not reach the snapshot as `undefined`: leave the key out, since every reader treats a missing one the same way. `unnamedRefs()` lives in `snapshot.js`. It registers every record of the state by identity (each tile, being, item, camp, snare, pitfall, cave, hill, grove, sector, region, boundary, mark, line) with its type. It then walks every record's own fields, down through plain objects and arrays the record owns, and returns a list of `type.path` strings where a value is a registered record and `REFS[type]` does not name that path. The owning lists (`camp.snares`, `camp.pitfalls`, `region.marks`) are the homes of their records and are not references. A future field that points at a record then fails this test until someone names it in `REFS`. If the 6e6 bound does not hold, report the measured size and what takes the space; do not raise the bound on your own.

- [ ] **Step 3: Run** the tests; expected: they fail on `api.takeSnapshot is not a function`.
- [ ] **Step 4: Implement** `snapshot.js`: `SNAPSHOT_VERSION`, `REFS`, `REF_KINDS` with `toId` for each kind, an `encode(record, type)` that returns a shallow copy with each `REFS` path replaced (copy the objects along a dotted path; never write to the live record), the tile and level encoder with `TILE_DEFAULTS`, the `lines` table, `takeSnapshot()`, and `unnamedRefs()`. `takeSnapshot()` throws when `era !== 'days'`. In `world.js`, `makeTile` becomes `{ x, y, z, ground, ...TILE_DEFAULTS }`; put `TILE_DEFAULTS` in `core.js` beside the other tables, with the keys in `makeTile`'s present order.
- [ ] **Step 5: Run** the tests (pass), `node build.js`, `npm run fast`, `node tests/soak.js`. Golden unmoved.
- [ ] **Step 6: Commit.**

### Task 3: `loadSnapshot(snap)`

**Files:**
- Modify: `src/sim/snapshot.js`, `src/sim/index.js` (`API`: `loadSnapshot`), `src/sim/core.js` only if `setOptions`'s checks must be split into a pure check and a set
- Test: `tests/snapshot.js`

**Interfaces:**
- Consumes: `takeSnapshot`, `REFS`, `REF_KINDS`.
- Produces: `loadSnapshot(snap) -> null | string`, `REF_KINDS[kind].fromId(id, stage)`.

- [ ] **Step 1: Write the failing tests:**

```js
const through = snap => JSON.parse(JSON.stringify(snap));
let loaded; const loadedWorld = () => { if (!loaded){ loaded = load(); assert.equal(loaded.loadSnapshot(through(lateWorld().takeSnapshot())), null); } return loaded; };

test('a loaded world gives the snapshot it was loaded from', () => {
  assert.deepStrictEqual(through(loadedWorld().takeSnapshot()), through(lateWorld().takeSnapshot()));
});
test('a loaded world has its records joined as the saved one had', () => {
  const api = loadedWorld(), was = lateWorld();
  for (const c of api.camps){
    for (const s of c.snares) assert.equal(api.world[s.y * api.W + s.x].struct.snare, s);
    for (const p of c.pitfalls) assert.equal(api.world[p.y * api.W + p.x].struct.pit, p);
  }
  for (const c of api.caves) for (const t of c.tiles) assert.equal(t.cave, c);
  for (const g of api.groves) assert.ok(api.sectors.includes(g.sector));
  for (const b of api.beings) if (b.camp) assert.ok(api.camps.includes(b.camp));
  const sharedLines = w => w.beings.flatMap(b => b.history).filter(l => w.chronicle.includes(l)).length;
  assert.ok(sharedLines(was) > 0); assert.equal(sharedLines(api), sharedLines(was));
  const sharedMarks = w => w.hills.filter(h => h.mark && w.field.regions.some(r => r.marks.includes(h.mark))).length;
  assert.equal(sharedMarks(api), sharedMarks(was));
  assert.equal(api.camps.indexOf(api.camp), was.camps.indexOf(was.camp));
});
test('a loaded world has its derived state', () => {
  const api = loadedWorld(), was = lateWorld();
  assert.equal(api.tick, was.tick); assert.equal(api.W, was.W); assert.equal(api.world, api.levels[api.ZOFF]);
  assert.equal(api.field.byId.size, was.field.byId.size);
  for (const r of api.field.regions) assert.equal(api.field.byId.get(r.id), r);
});
test('a save that cannot be read is refused and the world stays as it was', () => {
  const api = load(); api.startWorld('x'); const before = JSON.stringify(api.takeSnapshot());
  const good = through(lateWorld().takeSnapshot());
  for (const bad of [null, {}, 'text', { ...good, version: 99 }, { ...good, era: 'gods' }, { ...good, options: { sw: -1 } }, { ...good, beings: [{ ...good.beings[0], camp: 9999 }] }, { ...good, caves: 'no' }]){
    assert.equal(typeof api.loadSnapshot(bad), 'string');
    assert.equal(JSON.stringify(api.takeSnapshot()), before);
  }
});
test('a world of another size loads into a sim of the default size', () => {
  const small = load(); small.startWorld('r', { sw: 8, sh: 5 }); for (let i = 0; i < 3000; i++) small.step();
  const api = load(); api.startWorld('x'); assert.equal(api.loadSnapshot(through(small.takeSnapshot())), null);
  assert.equal(api.W, small.W); for (let i = 0; i < 500; i++) api.step();
});
```

  Add to `API` what these tests read and the API lacks (`W`, `ZOFF`, `field`). Check that `{ sw: 8, sh: 5 }` is a size `setOptions` allows, and pick one it allows if not. Every assertion must be able to fail; if one cannot on seed `r` at day 40 (no pitfall yet, no shared mark), say so in the report and pick a world where it can.

- [ ] **Step 2: Run**; expected: fail on `api.loadSnapshot is not a function`.
- [ ] **Step 3: Implement** the loader as "The loader works in a stage" says. Keep decode pure: it reads `snap` and writes only `stage`. Then commit in one block. Rebuild `world`, `itemGrid`, `regionOf`, `field.byId`, the search scratch, and `replayHead`. Restore both streams: make each with `mulberry32(0)` and `setStreamState`; `godRng` stays `null` when the snapshot says `null`.
- [ ] **Step 4: Run** the tests (pass), `node build.js`, `npm run fast`, `node tests/soak.js`. Golden unmoved.
- [ ] **Step 5: Commit.**

### Task 4: The oracle

**Files:**
- Modify: `tests/lib/run.js` (a collector that can start on a world already running), `tests/snapshot.js`, `tests/soak.js` (a seventh test), and `src/sim/snapshot.js` for whatever the oracle finds
- Test: `tests/snapshot.js`, `tests/soak.js`

**Interfaces:**
- Consumes: `takeSnapshot`, `loadSnapshot`.
- Produces: in `tests/lib/run.js`, `collect(api) -> { events, drain, skipPresent }` (the collector `runDays` uses today, made a function; `skipPresent()` marks every line now in `api.chronicle` as seen), and `runOn(api, fromStep, steps, collector, god = scriptGod)`, which steps the world, calls `god(api, i)` with `i` counted on from `fromStep`, and drains. `runDays` is rebuilt on these two and returns what it returned before.

- [ ] **Step 1: Write the failing tests** in `tests/snapshot.js`:

```js
const { collect, runOn, fingerprint } = require('./lib/run.js');
/* Run N steps, save, load into a fresh sim, run M more. The end equals a straight run of N + M. */
function oracle(seed, N, M, opts = {}){
  const a = load(); a.startWorld(seed, opts); const ca = collect(a); runOn(a, 0, N, ca);
  const midTask = a.beings.filter(b => b.alive && b.task && b.task.path && b.task.path.length).length;
  const working = a.beings.filter(b => b.alive && b.task && b.task.progress > 0).length;
  const snap = JSON.parse(JSON.stringify(a.takeSnapshot()));
  const b = load(); assert.equal(b.loadSnapshot(snap), null); const cb = collect(b); cb.skipPresent();
  const cut = ca.events.length; runOn(a, N, M, ca); runOn(b, N, M, cb);
  return { a, b, after: ca.events.slice(cut), loaded: cb.events, midTask, working };
}
for (const [seed, N, M] of [['r', 12400, 8000], ['x', 12400, 8000], ['gamma', 30300, 6000], ['alpha', 45150, 5000]])
  test(`seed ${seed}: saved at step ${N}, loaded, and run on, the story is the straight run's`, () => {
    const o = oracle(seed, N, M);
    assert.ok(o.midTask > 0 && o.working > 0, 'nobody was walking and nobody was at work at the save; pick another step');
    assert.deepEqual(o.loaded.map(e => e.text), o.after.map(e => e.text));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(o.b.takeSnapshot())), JSON.parse(JSON.stringify(o.a.takeSnapshot())));
  });
```

  The last assertion is the strongest: after the run-on, the two worlds give equal snapshots, streams and caches included. Also compare with `fingerprint` from `tests/lib/run.js`; read its real signature and call it as it is written. If `gamma` and `alpha` are not among the soak's six seeds, use the soak's own.

- [ ] **Step 2: Run.** Some will fail. Each failure is a piece of state the snapshot lost or rebuilt differently. Find the first tick where the two worlds part: step both one tick at a time from the load and compare `streamState(rng)`, then the snapshots, field by field. Fix the snapshot or the loader, never the rule. The survey's section 1d and risks 9, 11, 12, and 13 name the likely causes: `resCache`, `startRegion`, the order of `raised`, and the order of number-like keys in `opinions`, `rel`, and `fae.grudges`. For the key order, first prove a rule reads it; if one does, save such an object as a list of pairs.
- [ ] **Step 3: The seventh soak test.** In `tests/soak.js`, after the six seeds, add one test. It runs the soak's cheapest seed (time them; name the seed and its seconds in your report) for 35 days, takes a snapshot, loads it into a fresh sim, goes on to day 70 with the same event list, and asserts that the fingerprint equals that seed's golden line. It reads the golden; it never writes it. The count goes from 66 to 67.
- [ ] **Step 4: Run** `npm run fast` and `node tests/soak.js`. Report the soak's seconds before and after.
- [ ] **Step 5: Commit.**

### Task 5: The `load` act at the door

**Files:**
- Modify: `src/sim/door.js`, `tests/lib/run.js` (`logGod` passes over a `load` entry), `design/settings.md` (the Save and load row: state `hook`)
- Test: `tests/door.js`

**Interfaces:**
- Consumes: `loadSnapshot`.
- Produces: `inject({ source, act: 'load', snapshot }) -> string`. On success the sentence is `'The world is as it was on day N.'` with the loaded day. On a refusal it is `loadSnapshot`'s sentence.

- [ ] **Step 1: Write the failing tests** in `tests/door.js`, in that file's own style:
  - A load through the door puts the saved world in place: the tick, the people, and the saved `doorLog` followed by one entry `{ source: 'player', act: 'load', tick }` whose tick is the loaded tick, and which has no `snapshot` key.
  - A refused load (`snapshot: {}`) returns a sentence, leaves `doorLog` exactly as it was, and leaves the tick as it was.
  - A load from an unknown source is refused as every act is: `'Nothing answers.'`.
  - A story with a load in it replays: run seed `r` with `scriptGod` to step 9000, save, load through the door into a fresh sim, run to step 14000, take `api.replay`, and run `runDays(replay.seed, ..., replayGod(replay), replay.options)` for the same steps. The two fingerprints are equal, and the replay never sends the `load` entry to the door.
- [ ] **Step 2: Run**; expected: fail, `'Nothing answers.'` for the act.
- [ ] **Step 3: Implement** as "The door" in the design says. Keep `inject` short: mark the act in `DOOR_ACTS` (for example `load.replacesWorld = true`) and let `inject` read the mark, so `inject` checks no act name.
- [ ] **Step 4: Run** `node --test tests/door.js tests/snapshot.js`, `node build.js`, `npm run fast`, `node tests/soak.js`.
- [ ] **Step 5: Commit.**

### Task 6: The page: Save, Load, the autosave, Continue

**Files:**
- Create: `src/ui/saves.js`
- Modify: `src/ui/index.js` (the manifest), `src/ui/actions.js` (`onLoad`, `saveWorld`, `loadWorldFile`, `continueWorld`), `src/ui/keys.js` and the palette list (rows and keys for Save and Load), `src/ui/main.js` (the dawn hook: write the autosave when the day number rises; use the calendar helpers in `clock.js`, no bare number), `src/page.template.html` (a hidden file input, the Continue button in the start dialog), `src/ui/derive.js` (`saveName(seed, tick)`, pure)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `takeSnapshot`, `inject` with `act: 'load'`.
- Produces: `saveName(seed, tick) -> 'hearth-<seed>-day-<n>.json'`, with the seed in lower case and each run of characters outside `[a-z0-9]` replaced by one `-`.

- [ ] **Step 1: Read** `src/ui/actions.js` (`onSettle`), `src/ui/keys.js`, `src/ui/dialogs.js`, and the tests in `tests/ui.js` that hold "every button has a key" and the key map. Follow their pattern exactly.
- [ ] **Step 2: Write the failing tests** in `tests/ui.js`: `saveName('Hollow Moor 52', <a tick on day 12>)` is `'hearth-hollow-moor-52-day-12.json'`; the key map holds Save and Load and no key is bound twice; the palette lists both.
- [ ] **Step 3: Implement.** `saves.js` holds only storage: `writeSaveFile(name, text)`, `readSaveFile(file) -> Promise<object>`, `putAutosave(text)`, `getAutosave() -> Promise<string | null>`, each IndexedDB and Blob call in `try`/`catch`. `actions.js` holds the acts and `onLoad()`. A load that the door refuses shows the door's sentence where the page shows other door answers. The autosave writes `JSON.stringify(takeSnapshot())`; measure in Node how long that takes on a day-40 world and report it. If it takes more than 50 ms, write it from a `setTimeout` after the frame, and say so.
- [ ] **Step 4: Run** `node --test tests/ui.js`, `node build.js`, `npm run fast`.
- [ ] **Step 5: State plainly in the report** that you did not drive the page. The controller checks the page in Safari.
- [ ] **Step 6: Commit.**

### Task 7: The record

**Files:**
- Modify: `design/notes.md` (a new section "Snapshots" after "Tasks as data"; renumber "Next"), `design/specs/2026-09-18-time-and-tiers-design.md` (an "As built (G3)" paragraph under section 3, beside the G1 and G2 ones), `CLAUDE.md` (the layout list gains `snapshot.js` and `tests/snapshot.js`; the rules gain the `REFS` rule), `design/settings.md` (Save and load: `in UI`)

- [ ] **Step 1: Write the notes section.** A summary table at the top. Then: what a snapshot holds and what it rebuilds; the table of reference kinds; why `resCache`, `startRegion`, `raised`, and `fireCount` are saved though they can be rebuilt; the stage and the refusal; the door's `load` and the replay rule; the oracle and the seventh soak test; every fault the oracle found in task 4, one line each, in the manner of the notes' other lists of bugs found; the measured numbers (snapshot characters at day 40 of seed `r`, milliseconds to take, to stringify, to parse, and to load). Correct the spec's word where it differs: no placement stream exists yet, so the snapshot holds two streams.
- [ ] **Step 2: `CLAUDE.md`.** Add to "Rules of work": "A field that points at another record goes in `REFS` in `src/sim/snapshot.js`. `tests/snapshot.js` fails on one that is missing." Add the two files to the layout in the file's own words.
- [ ] **Step 3: Run** `npm run fast` and `node tests/soak.js` one last time and put the counts in the report.
- [ ] **Step 4: Commit.**

## Self-review

| Spec line (section 3) | Task |
|---|---|
| The whole state as JSON, both streams | 1, 2 |
| `REFS` names every reference field; no other record changes shape | 2 |
| The snapshot test is the oracle, with a person in the middle of a task | 4 |
| Save writes a file, Load reads one, one autosave slot at dawn | 6 |
| `load` passes the door | 5 |
| The golden holds (section 12) | every task's gates |

Not in G3, because they do not exist yet: the tier, the placement stream, the counts, the annals, the pending events, and the watch list. Each later plan adds its state to the snapshot and its references to `REFS`, and the completeness test and the oracle hold it to that.
