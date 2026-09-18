# Mythos plan 1: the door and the options

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make world size and the level range start options, and route every outside act through one logged door so a seed plus its log replays the same story.

**Architecture:** The size and level constants in `core.js` become variables that `startWorld(seed, options)` sets before anything is allocated. The path search buffers are allocated per world instead of at load. A new file, `src/sim/door.js`, holds `inject(event)`, a table of acts, and the log. The two player acts, light and poke, become entries in that table. The UI and the test runner's script god call `inject`. The soak gains a replay test: run a seed with the script god, take the log, run the seed again with the log alone, and compare fingerprints.

**Tech Stack:** Plain JavaScript scripts sharing one scope under `src/sim/`, joined by `src/sim/index.js`. Node's built-in test runner. No dependencies.

## Global Constraints

- Spec: `design/specs/2026-09-17-mythos-design.md`, sections 0, 7, 8, and plan 1 of section 10. Done when the soak is green on defaults with the fingerprint unmoved, and the replay test is green.
- Work in `/Users/earchibald/Worktrees/hamlet-mythos` on branch `mythos`. Never touch `~/Code/hamlet`; another session works there.
- Files in `src/sim/` are plain scripts. No `import`, no `export`. Function calls between files are free.
- `updateWorld()` keeps its step order. No task in this plan may move any seed's story: the golden record must match after every task. Do not bless the golden in this plan.
- Options default to today's numbers: `sw` 10, `sh` 6, `zmin` −2, `zmax` 2. The spec's `ageLimit` option belongs to plan 2, which adds the ages; it stays `idea` in the register.
- Every perturbation is visible: the chronicle names the source in the game's voice.
- Prose in the game's text is plain English, one idea per sentence.
- Run `node build.js` after every change to `src/`.
- Commit after every task on branch `mythos`. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File map

| File | Change |
|---|---|
| `src/sim/core.js` | `SW, SH, W, H, ZMIN, ZMAX, ZOFF, NZ` become `let`. `DEFAULT_OPTIONS`, `options`, `setOptions()`. |
| `src/sim/path.js` | Search buffers become `let`, allocated by `allocSearch()`. |
| `src/sim/main.js` | `startWorld(seed, options)` calls `setOptions` and `allocSearch` first. `poke` gains a chronicle line. |
| `src/sim/door.js` | New. `DOOR_ACTS`, `doorLog`, `inject(event)`. |
| `src/sim/index.js` | `door` joins `FILES`. The API exposes `inject`, `options`, `log`, and the size and level values as getters. |
| `src/ui.js` | `newWorld` passes `{}`. Light and poke go through `inject`. |
| `tests/lib/run.js` | The script god calls `inject`. `logGod(log)` replays a log. `runDays` takes a god. |
| `tests/options.js` | New. A wider level range and a bigger world generate and hold a person. |
| `tests/soak.js` | The replay test. |
| `design/settings.md` | Size and level lines move from idea to hook. Sources at the door: player built. |
| `design/notes.md`, `CLAUDE.md` | The contract, restated. |

---

### Task 1: Size and level range as start options

**Files:**
- Modify: `src/sim/core.js:13-20`
- Modify: `src/sim/path.js:4`
- Modify: `src/sim/main.js:2-11`
- Modify: `src/sim/index.js:21-34`
- Modify: `src/ui.js:336`
- Modify: `design/settings.md`
- Test: `tests/options.js`

**Interfaces:**
- Produces: `startWorld(seed, options = {})`. `options` keys: `sw`, `sh` (sectors), `zmin`, `zmax` (levels). Missing keys take `DEFAULT_OPTIONS`. `setOptions(o)` sets the variables. `allocSearch()` sizes the search buffers. The API exposes `get options()`, `get W()`, `get H()`, `get ZMIN()`, `get ZMAX()`, `get ZOFF()`, `get NZ()`.

- [ ] **Step 1: Write the failing test**

Create `tests/options.js`:

```js
// Start options: world size and the level range. Fast: one world per test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('the defaults are today\'s numbers', () => {
  const api = load(); api.startWorld('r');
  assert.deepEqual(api.options, { sw: 10, sh: 6, zmin: -2, zmax: 2 });
  assert.equal(api.W, 280); assert.equal(api.H, 120); assert.equal(api.levels.length, 5); assert.equal(api.ZOFF, 2);
});

test('a wider level range makes more levels, and the surface is still level 0', () => {
  const api = load(); api.startWorld('r', { zmin: -3, zmax: 3 });
  assert.equal(api.levels.length, 7); assert.equal(api.ZOFF, 3); assert.equal(api.NZ, 7);
  assert.equal(api.levels[api.ZOFF], api.world);
  assert.equal(api.tileAt(10, 10).z, 0);
  assert.equal(api.hasTile(10, 10, 3), false);
  assert.equal(api.hasTile(10, 10, -3), false);
});

test('a bigger world generates, and the first person can reach water', () => {
  const api = load(); api.startWorld('r', { sw: 12, sh: 8 });
  assert.equal(api.W, 336); assert.equal(api.H, 160); assert.equal(api.sectors.length, 96);
  const a = api.beings[0]; assert.equal(a.species, 'human');
  const wet = (x, y, z) => z === 0 && api.passable(x, y, 0) && [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => api.hasTile(x + dx, y + dy, 0) && api.tileAt(x + dx, y + dy).ground === 'water');
  assert.ok(api.bfs(a.x, a.y, 0, wet, api.NZ * api.W * api.H), 'no path from the first person to water');
  for (let i = 0; i < 1000; i++) api.step();
  assert.ok(a.alive, 'the first person died on day one');
});

test('one engine can start a big world and then a small one', () => {
  const api = load(); api.startWorld('r', { sw: 12, sh: 8 });
  assert.equal(api.W, 336);
  api.startWorld('r');
  assert.equal(api.W, 280); assert.equal(api.world.length, 280 * 120);
  const a = api.beings[0];
  const region = api.reachable(a.x, a.y, 0, api.NZ * api.W * api.H);
  assert.ok(region.size > 1000, 'the search buffers were not re-sized for the smaller world');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/options.js`
Expected: FAIL. `api.options` is undefined, and the wider range gives 5 levels.

- [ ] **Step 3: Make the constants variables, set by options**

In `src/sim/core.js`, replace lines 13 and 20:

```js
const LW = 28, LH = 20, DAY = 1000, TPS = 12;
/* World size in sectors and the level range are start options. startWorld sets them before anything is allocated. */
let SW = 10, SH = 6, W = SW * LW, H = SH * LH;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const RING = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
const NEAR = [[0,0], ...DIRS];
/* The eight neighbours in order around the ring, so a walk along it stays on adjacent tiles. */
const AROUND = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
/* Levels. Level 0 is the surface. Above it are hilltops. Below it are caves. A level is an array like the surface, mostly null. */
let ZMIN = -2, ZMAX = 2, ZOFF = 2, NZ = ZMAX - ZMIN + 1;
const DEFAULT_OPTIONS = { sw: 10, sh: 6, zmin: -2, zmax: 2 };
let options;
function setOptions(o){
  options = { ...DEFAULT_OPTIONS, ...o };
  SW = options.sw; SH = options.sh; W = SW * LW; H = SH * LH;
  ZMIN = options.zmin; ZMAX = options.zmax; ZOFF = -ZMIN; NZ = ZMAX - ZMIN + 1;
}
```

Keep every other line of the file as it is. `idx`, `inb`, and `idx3` read `W`, `H`, and `ZOFF` when called, so they need no change.

In `src/sim/path.js`, replace line 4:

```js
let bfsPrev, bfsSeen, bfsGen = 0; const bfsOut = [];
/* The search buffers cover every level of the world. startWorld sizes them once the options are set. */
function allocSearch(){ bfsPrev = new Int32Array(NZ * W * H); bfsSeen = new Uint32Array(NZ * W * H); bfsGen = 0; }
```

In `src/sim/main.js`, replace the start of `startWorld`:

```js
function startWorld(seed, opts = {}){
  setOptions(opts); allocSearch();
  seedText = String(seed); rng = mulberry32(hashSeed(seedText));
```

The rest of `startWorld` is unchanged.

- [ ] **Step 4: Expose the values through the API as getters**

In `src/sim/index.js`, change the API line that reads `near, nearAt, dist, ZMIN, ZMAX, ZOFF, NZ, W, H,` to:

```js
  near, nearAt, dist,
  get ZMIN(){ return ZMIN; }, get ZMAX(){ return ZMAX; }, get ZOFF(){ return ZOFF; }, get NZ(){ return NZ; }, get W(){ return W; }, get H(){ return H; },
  get options(){ return options; },
```

- [ ] **Step 5: Pass options from the UI**

In `src/ui.js` line 336, change `startWorld(seed);` to `startWorld(seed, {});`. The UI has no options control yet. The canvases are sized at page load from `W` and `H`, so a later options control must resize them; that goes in the register, not in code, in this plan.

- [ ] **Step 6: Run the tests**

Run: `node --test tests/options.js && node --test tests/terrain.js && node tests/soak.js`
Expected: all PASS. The soak's golden record matches on every seed. The soak's diagnostic lines show no count moved.

- [ ] **Step 7: Build and update the register**

Run: `node build.js`
Expected: `built dist/hearth-sim.html <bytes> bytes`.

In `design/settings.md`, change the `sw`, `sh` line's state to `hook` and its notes to `Defaults 10 and 6. startWorld(seed, { sw, sh }). The UI passes {}. The canvases are sized at page load, so an options control must resize them.` Change the `zmin`, `zmax` line's state to `hook` and its notes to `Defaults −2 and 2. startWorld(seed, { zmin, zmax }). Generation still cuts caves to −2 and raises two storeys, so a range narrower than the default is not yet lawful.`

- [ ] **Step 8: Commit**

```bash
git add src/sim/core.js src/sim/path.js src/sim/main.js src/sim/index.js src/ui.js tests/options.js design/settings.md dist/hearth-sim.html
git commit -m "World size and the level range are start options

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The door

**Files:**
- Create: `src/sim/door.js`
- Modify: `src/sim/index.js:13` and the API block
- Modify: `src/sim/main.js:29-33` (poke)
- Modify: `src/ui.js:340,346`
- Modify: `tests/lib/run.js:8-24`
- Modify: `design/settings.md`
- Test: `tests/door.js`

**Interfaces:**
- Consumes: `lightTile(x, y, z)`, `poke(a)`, `beingById(id)`, `tick`, `log()`.
- Produces: `inject(event)`. An event is `{ source, act, ...args }`. `source` is one of `'player'` now, with `'chance'`, `'llm'`, `'human'` reserved. `act` is a key of `DOOR_ACTS`. `inject` stamps `tick`, applies the act, appends the event to `doorLog` only if the act applied, and returns the act's message. `DOOR_ACTS.light({ x, y, z })` and `DOOR_ACTS.poke({ id })`. `api.inject`, `api.log` (the door log), `api.DOOR_ACTS`.

- [ ] **Step 1: Write the failing test**

Create `tests/door.js`:

```js
// The door: every outside act enters by inject(), is logged, and shows in the chronicle. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('an unknown act or source is refused and not logged', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.inject({ source: 'player', act: 'smite', x: 1, y: 1 }), 'Nothing answers.');
  assert.equal(api.inject({ source: 'weather', act: 'light', x: 1, y: 1, z: 0 }), 'Nothing answers.');
  assert.deepEqual(api.log, []);
});

test('lighting the ground through the door burns it, logs the event with its tick, and writes the chronicle', () => {
  const api = load(); api.startWorld('r');
  const a = api.beings[0];
  let t = null;
  for (let dy = -6; dy <= 6 && !t; dy++) for (let dx = -6; dx <= 6 && !t; dx++){ const q = api.hasTile(a.x + dx, a.y + dy, 0) && api.tileAt(a.x + dx, a.y + dy); if (q && q.ground === 'grass' && !q.feature) t = q; }
  assert.ok(t, 'no grass near the first person');
  const before = api.chronicle.length;
  const msg = api.inject({ source: 'player', act: 'light', x: t.x, y: t.y, z: 0 });
  assert.equal(msg, 'The ground is burning. This fire is not contained.');
  assert.ok(t.fire > 0);
  assert.deepEqual(api.log, [{ tick: api.tick, source: 'player', act: 'light', x: t.x, y: t.y, z: 0 }]);
  assert.equal(api.chronicle.length, before + 1);
  assert.match(api.chronicle[0].text, /from the sky/);
});

test('a lighting that does nothing is not logged', () => {
  const api = load(); api.startWorld('r');
  let t = null;
  for (const q of api.world) if (q.ground === 'water'){ t = q; break; }
  assert.equal(api.inject({ source: 'player', act: 'light', x: t.x, y: t.y, z: 0 }), 'Nothing here will burn.');
  assert.deepEqual(api.log, []);
});

test('a poke through the door names the person in the chronicle and is logged by id', () => {
  const api = load(); api.startWorld('r');
  const a = api.beings[0];
  const msg = api.inject({ source: 'player', act: 'poke', id: a.id });
  assert.equal(msg, `${a.name} looks up, then gets to it.`);
  assert.deepEqual(api.log, [{ tick: api.tick, source: 'player', act: 'poke', id: a.id }]);
  /* chooseTask runs after the nudge and may write its own lines, so look for the line, not at the top. */
  assert.ok(api.chronicle.some(e => e.text === `${a.name} feels a nudge from above.`), 'no chronicle line for the nudge');
  assert.equal(api.inject({ source: 'player', act: 'poke', id: -1 }), 'Nobody is there to poke.');
  assert.equal(api.log.length, 1);
});

test('a new world empties the log', () => {
  const api = load(); api.startWorld('r');
  api.inject({ source: 'player', act: 'poke', id: api.beings[0].id });
  api.startWorld('x');
  assert.deepEqual(api.log, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/door.js`
Expected: FAIL with `api.inject is not a function`.

- [ ] **Step 3: Write the door**

Create `src/sim/door.js`:

```js
/* ---------- the door ----------
   Every act from outside the engine enters here: the player now, and later chance, an LLM, or a
   human inhabiting a mob. The engine step is pure. The door is the one place the outside touches
   the state, and it keeps a log, so a seed plus its log replays the same story. An act that does
   nothing is not logged. Each act returns a message for whoever asked. */
const DOOR_SOURCES = ['player', 'chance', 'llm', 'human'];
let doorLog = [];
/* Acts by name. Each takes the event and returns { ok, msg }. ok is false when the world did not change. */
const DOOR_ACTS = {
  light(e){
    /* lightTile answers with a message. Two of its answers mean the world changed. */
    const msg = lightTile(e.x, e.y, e.z || 0);
    return { ok: msg === 'The fire pit is lit.' || msg === 'The ground is burning. This fire is not contained.', msg };
  },
  poke(e){
    const a = beingById(e.id);
    if (!a || !a.alive) return { ok: false, msg: 'Nobody is there to poke.' };
    return { ok: true, msg: poke(a) };
  },
};
function inject(event){
  const act = DOOR_ACTS[event.act];
  if (!act || !DOOR_SOURCES.includes(event.source)) return 'Nothing answers.';
  const { ok, msg } = act(event);
  if (ok) doorLog.push({ tick, ...event });
  return msg;
}
```

In `src/sim/main.js`, make `poke` write a chronicle line. Replace the function:

```js
function poke(a){
  if (!a.alive) return 'Nothing stirs.';
  if (a.species === 'human'){ camp = a.camp; failTask(a); a.asleep = false; a.pokedUntil = tick + 400; addThought(a, 'poked', 'Felt a nudge from above', 2, 400); log(`${a.name} feels a nudge from above.`, [a]); chooseTask(a); return `${a.name} looks up, then gets to it.`; }
  failTask(a); a.asleep = false; a.task = null; START.flee(a) || START.wander(a); log(`The ${SPECIES[a.species].label} startles at a nudge from above.`); return `The ${SPECIES[a.species].label} startles.`;
}
```

In `startWorld`, after `goalPriority = {};`, add `doorLog = [];`.

In `src/sim/index.js`, add `'door'` to `FILES` after `'main'`:

```js
const FILES = ['core', 'world', 'path', 'camps', 'beings', 'species', 'fae', 'tasks', 'goals', 'recipes', 'weather', 'main', 'door'];
```

and add to the API, on the first line after `startWorld, step,`: `inject, DOOR_ACTS,` and among the getters: `get log(){ return doorLog; },`.

- [ ] **Step 4: Run the door test**

Run: `node --test tests/door.js`
Expected: PASS, five tests.

- [ ] **Step 5: Send the UI and the script god through the door**

In `src/ui.js` line 340, replace the light case:

```js
    case 'light': say(inject({ source: 'player', act: 'light', x: c.x, y: c.y, z: c.z })); camp = viewCamp; break;
```

Line 346, replace the poke case:

```js
    case 'poke': { const a = beings.find(a => a.alive && a.x === c.x && a.y === c.y && a.z === c.z); say(a ? inject({ source: 'player', act: 'poke', id: a.id }) : 'Nobody is there to poke.'); break; }
```

In `tests/lib/run.js`, replace `scriptGod` and `runDays`:

```js
/* The script god lights each camp's pit once, the first time it stands laid
   and cold, through the door, so the run leaves a log. A founding party carries
   coals, so its pit is lit on its own; the god steps in only after the coals
   value (a tick) has passed. The loop index is compared, as the first soak did,
   so old numbers still line up. */
function scriptGod(api, i){
  for (const c of api.camps) if (c.pit && !c.everLit && c.coals <= i) api.inject({ source: 'player', act: 'light', x: c.pit[0], y: c.pit[1], z: 0 });
}
/* A god that replays a log: every event with this tick goes through the door, in order, and nothing else happens. */
function logGod(log){
  let k = 0;
  return api => { while (k < log.length && log[k].tick === api.tick){ const { tick, ...e } = log[k++]; api.inject(e); } };
}

/* Run one seed. Returns the api and the full list of chronicle events in order. */
function runDays(seed, days, onTick, god = scriptGod){
  const api = load(); api.startWorld(seed);
  const events = []; const seen = new WeakSet();
  const drain = () => { const ch = api.chronicle; let n = 0; while (n < ch.length && !seen.has(ch[n])) n++; for (let j = n - 1; j >= 0; j--){ seen.add(ch[j]); events.push(ch[j]); } };
  drain();
  for (let i = 0; i < days * DAY; i++){
    api.step(); god(api, i); drain();
    if (onTick) onTick(api, i, events);
  }
  return { api, events };
}
```

Add `logGod` to the `module.exports` line.

- [ ] **Step 6: Run everything**

Run: `node --test tests/door.js tests/options.js tests/terrain.js tests/crafts.js tests/gnomes.js && node tests/soak.js`
Expected: all PASS. The golden record matches on every seed, because the script god's lightings are the same calls at the same ticks, and the soak never pokes.

- [ ] **Step 7: Build and update the register**

Run: `node build.js`

In `design/settings.md`, change the "Sources at the door" line's state to `hook` and its notes to `player built: light and poke. chance, llm, human reserved in DOOR_SOURCES. The log is api.log.`

- [ ] **Step 8: Commit**

```bash
git add src/sim/door.js src/sim/main.js src/sim/index.js src/ui.js tests/door.js tests/lib/run.js design/settings.md dist/hearth-sim.html
git commit -m "The door: every outside act enters by inject() and is logged

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Replay, and the contract in writing

**Files:**
- Modify: `tests/soak.js:74-78`
- Modify: `design/notes.md:169` and the paragraph after the assertion list
- Modify: `CLAUDE.md` (the rules of work line on determinism)

**Interfaces:**
- Consumes: `runDays(seed, days, onTick, god)`, `logGod(log)`, `fingerprint`, `api.log`.

- [ ] **Step 1: Write the replay test**

In `tests/soak.js`, replace the test `the same seed tells the same story twice` with:

```js
test('the same seed tells the same story twice', () => {
  const a = runDays('r', 2), b = runDays('r', 2);
  assert.deepEqual(b.events.map(e => e.text), a.events.map(e => e.text));
  assert.deepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events));
});

test('a seed and its log replay the same story', () => {
  const a = runDays('r', 2);
  assert.ok(a.api.log.length >= 1, 'the script god never lit a pit in two days');
  const b = runDays('r', 2, null, logGod(a.api.log));
  assert.deepEqual(b.api.log, a.api.log);
  assert.deepEqual(b.events.map(e => e.text), a.events.map(e => e.text));
  assert.deepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events));
});

test('a different log tells a different story', () => {
  const a = runDays('r', 2);
  const late = a.api.log.map(e => ({ ...e, tick: e.tick + 300 }));
  const b = runDays('r', 2, null, logGod(late));
  assert.notDeepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events));
});
```

Add `logGod` to the `require('./lib/run')` destructuring at the top of the file.

- [ ] **Step 2: Run the replay tests alone**

Run: `SEEDS=r DAYS=1 node tests/soak.js`
Expected: PASS for the three replay tests and the one-day seed test. If the first camp's pit is not lit within two days on seed r, the first assertion says so; then raise the days in the two replay tests to 4, and no further.

- [ ] **Step 3: Write the contract into the notes**

In `design/notes.md`, replace the line `- The same seed tells the same story twice.` with:

```
- The same seed tells the same story twice, and a seed plus its door log tells the same story twice. A moved log tells a different one.
```

After the assertion list in section 14, before `\`tests/terrain.js\` checks the levels`, add:

```
The determinism contract, since the mythos spec: the engine step is pure. Given a state, the next state is fixed. Every act from outside enters by one door, `inject(event)` in `src/sim/door.js`, which logs the event with its tick when the act changed the world. The player's light and poke go through it; chance, an LLM, and a human inhabiting a mob are reserved sources. A perturbation is checked against the state's invariants, never against what the engine would have done. Every perturbation is visible in the chronicle in the game's voice. `startWorld(seed, options)` takes the world size in sectors and the level range; `design/settings.md` is the register of start options and future settings.
```

In `CLAUDE.md`, replace `- The simulation must stay deterministic for a seed until the player acts.` with:

```
- The engine step is pure. Every outside act enters by `inject()` in `src/sim/door.js` and is logged. A seed plus its log replays the same story.
```

- [ ] **Step 4: Run the full soak**

Run: `node tests/soak.js`
Expected: all PASS. Golden matches on every seed.

- [ ] **Step 5: Commit**

```bash
git add tests/soak.js design/notes.md CLAUDE.md
git commit -m "Replay: a seed and its door log tell the same story, and the contract is written down

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Done when

- `node tests/soak.js` is green on all six seeds with the golden record unmoved.
- `node --test tests/options.js tests/door.js tests/terrain.js tests/crafts.js tests/gnomes.js` is green.
- `dist/hearth-sim.html` is rebuilt and lighting and poking work on the dev server.
- `design/settings.md` shows size, range, and the door's sources as hooks.
