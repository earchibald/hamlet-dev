# Mythos plan 2: the field and the gods

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A creation that runs age by age from one formless region to a field of marked countries, driven by gods that are mobs, and ends when the last god sleeps in a world that can hold a life. No tiles are painted yet.

**Architecture:** The state gains an `era`. `startCreation(seed, options)` resets the state as `startWorld` does and opens the gods era instead of generating tiles. In that era one `step()` is one age: every awake god scores its acts over the live regions and does the best one. Regions live in `src/sim/field.js`, marks and the biome table in `src/sim/marks.js`, the god mob, its acts, the rest gate, and the age loop in `src/sim/gods.js`. Everything the gods do draws from a second seeded stream. When the last god sleeps, `settle()` flips the era to days. Plan 3 makes settle paint. `startWorld` is unchanged in effect, so the golden record does not move.

**Tech Stack:** Plain JavaScript scripts sharing one scope under `src/sim/`, joined by `src/sim/index.js`. Node's built-in test runner. No dependencies.

## Global Constraints

- Spec: `design/specs/2026-09-17-mythos-design.md`, sections 1, 2, 3, 8 (`tests/ages.js`), 9, and plan 2 of section 10. Done when the ages end on every seed in `tests/ages.js` with the backstop firing on none of the six soak seeds, and the soak fingerprint is unmoved.
- Work in `/Users/earchibald/Worktrees/hamlet-mythos` on branch `mythos`. Never touch `~/Code/hamlet`.
- Files in `src/sim/` are plain scripts. No `import`, no `export`. Function calls between files are free. Load order: `core.js` first; `field.js` and `marks.js` before `world.js`; `gods.js` after `beings.js` and `species.js`, since it adds a row to `SPECIES` and `LIFE`, and before `main.js`.
- `updateWorld()` keeps its step order. No task in this plan may move any seed's story: `node tests/soak.js` must match the golden record after every task. Do not bless the golden.
- Rules read tables. No rule checks a god's name, a pole's name, or a species' name. Poles, contrasts, bodies, scars, and makings are tables in `marks.js` and `gods.js`.
- Everything the gods do draws from the god stream, `godRng`, seeded from `seedText + ':gods'`. Every god-era function that draws runs inside `withGodRng`. The people's stream is never touched in the gods era.
- Every act writes a chronicle line in plain English, one idea per sentence, and every god-era line also goes to `legends`, which is never trimmed.
- Refinements of the spec, decided by this plan: acts live in a `GOD_ACTS` table, not in `START`, because `START` entries build tick tasks with `arrive()` and an age act is instant. Freeze, hide, and show write marks of kind `freeze`, `hide`, `show`, since `cold`, `dark`, and `light` are pole values. The people are made by a mingling, and a lack of people draws every awake god toward every other by five opinion points an age, so lovers, and so people, come. Settle in this plan flips the era and paints nothing.
- Options gain `ageLimit`, default 200. Past it the backstop acts once an age. At twice the limit every awake god is put to sleep and the creation is marked failed; `tests/ages.js` asserts that never happens.
- Commit after every task on branch `mythos`. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn`.
- Run `node build.js` after every change to `src/` and commit `dist/hearth-sim.html` with it.

---

## File map

| File | Change |
|---|---|
| `src/sim/core.js` | State: `era`, `age`, `pulseAge`, `godRng`, `legends`, `creation`, `field`, `boundaries`. `stamp()` and `log()` read the era. `ageLimit` option. |
| `src/sim/field.js` | New. Regions, splits, boundaries, neighbours. |
| `src/sim/marks.js` | New. Contrasts and poles, marks, `BIOME_OF`, `biomeOf`, `poleShare`. |
| `src/sim/gods.js` | New. The god mob, needs, scoring, `GOD_ACTS`, relations, the rest gate, strain, `ageStep`, `settle`, the backstop, `startCreation`, `runAges`. |
| `src/sim/species.js` | `prey: true` on rabbit and deer. |
| `src/sim/main.js` | `resetState`, `startWorld` on it, `step()` dispatching on `era` and skipping species with `perTick: false`. |
| `src/sim/index.js` | `field`, `marks`, `gods` in `FILES`. API additions. |
| `tests/field.js` | New. Regions and marks. |
| `tests/gods.js` | New. The god mob, the gate, the first ages. |
| `tests/ages.js` | New. Many seeds to settle, a report, assertions. |
| `tests/options.js` | The defaults test learns `ageLimit`. |
| `design/settings.md` | `ageLimit` to hook. |

---

### Task 1: The era, the field, and the marks

**Files:**
- Modify: `src/sim/core.js` (the options block, the state line, `stamp`, `log`)
- Create: `src/sim/field.js`
- Create: `src/sim/marks.js`
- Modify: `src/sim/main.js` (`startWorld`, `step`)
- Modify: `src/sim/species.js:5-13`
- Modify: `src/sim/index.js` (`FILES`, API)
- Modify: `tests/options.js` (the defaults test)
- Test: `tests/field.js`

**Interfaces:**
- Produces: state `era` (`'days'` or `'gods'`), `age` (integer), `pulseAge` (integer or null), `godRng` (function or null), `legends` (array of chronicle entries), `creation` (object or null), `field` (`{ regions, root, byId }` or null), `boundaries` (array). `resetState(seed, opts)`. `initField()` returns the root region. Region: `{ id, tiles: number[], area, bbox: { x0, y0, x1, y1 }, parent, by, age, marks: [], children: null | [idA, idB], lastBy, lastAge }`. `splitRegion(r, god)` returns `{ a, b, boundary }` or null; `god` needs `id`, `pole`, `traits.patience`. Boundary: `{ id, a, b, tiles, by, pole, age }`. `regionById(id)`, `liveRegions()`, `regionAt(x, y)`, `canSplit(r)`, `neighboursOf(r)`, `SECTOR_AREA`. `CONTRASTS`, `POLES`, `mark(target, kind, value, god, why)`, `marksOf(t, kind)`, `hasMark(t, kind, value?)`, `setPole(r, pole, god, why)`, `poleOf(r, contrast)`, `hasPole(r, pole)`, `BIOME_OF`, `biomeOf(r)`, `GROWS`, `poleShare(pole)`. `SPECIES[x].prey`, `SPECIES[x].perTick`.

- [ ] **Step 1: Write the failing test**

Create `tests/field.js`:

```js
// The field that divides, and the marks on it. Fast: no tiles are painted.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

const patient = { id: 900, pole: 'wet', traits: { patience: 1 } };
const restless = { id: 901, pole: 'hot', traits: { patience: 0 } };

function fresh(seed = 'r'){ const api = load(); api.startWorld(seed); api.initField(); return api; }

test('the field starts as one region holding every tile', () => {
  const api = fresh();
  const root = api.field.root;
  assert.equal(api.liveRegions().length, 1);
  assert.equal(root.area, api.W * api.H);
  assert.deepEqual(root.bbox, { x0: 0, y0: 0, x1: api.W - 1, y1: api.H - 1 });
  assert.deepEqual(root.marks, []);
  assert.equal(api.regionAt(5, 5), root);
  assert.equal(api.canSplit(root), true);
});

test('a patient god draws a straight line and both children keep a sector of tiles', () => {
  const api = fresh();
  const root = api.field.root;
  const cut = api.splitRegion(root, patient);
  assert.ok(cut, 'no cut');
  assert.deepEqual(root.children, [cut.a.id, cut.b.id]);
  assert.equal(cut.a.area + cut.b.area, root.area);
  assert.ok(cut.a.area >= api.SECTOR_AREA && cut.b.area >= api.SECTOR_AREA);
  assert.equal(api.liveRegions().length, 2);
  assert.equal(cut.a.parent, root.id); assert.equal(cut.a.by, 900);
  /* The root is wider than tall, so the cut runs across x: a straight line is one column. */
  const xs = new Set(cut.boundary.tiles.map(i => i % api.W));
  assert.equal(xs.size, 1);
  assert.equal(cut.boundary.pole, 'wet');
  assert.ok(cut.boundary.tiles.length >= api.H - 1);
  /* Every boundary tile is in a and touches b. */
  for (const i of cut.boundary.tiles){
    assert.equal(api.regionAt(i % api.W, Math.floor(i / api.W)), cut.a);
    const x = i % api.W, y = Math.floor(i / api.W);
    assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => api.regionAt(x + dx, y + dy) === cut.b));
  }
  assert.deepEqual(api.neighboursOf(cut.a).map(r => r.id), [cut.b.id]);
});

test('a restless god draws a winding line', () => {
  const api = fresh();
  const cut = api.splitRegion(api.field.root, restless);
  const xs = new Set(cut.boundary.tiles.map(i => i % api.W));
  assert.ok(xs.size >= 3, `the line used ${xs.size} columns`);
});

test('children inherit marks, and a region stops splitting at sector size', () => {
  const api = fresh();
  const root = api.field.root;
  api.setPole(root, 'dark', restless, 'test');
  const cut = api.splitRegion(root, patient);
  assert.ok(api.hasPole(cut.a, 'dark') && api.hasPole(cut.b, 'dark'));
  assert.ok(cut.a.marks[0].inherited);
  /* Split down until nothing can split. Every live region keeps at least a sector. */
  let n = 0;
  for (let guard = 0; guard < 200; guard++){ const r = api.liveRegions().find(api.canSplit); if (!r) break; if (api.splitRegion(r, patient)) n++; }
  assert.ok(n >= 10, `only ${n} splits`);
  for (const r of api.liveRegions()){ assert.ok(r.area >= api.SECTOR_AREA); assert.equal(api.canSplit(r), false); }
  assert.equal(api.liveRegions().reduce((s, r) => s + r.area, 0), api.W * api.H);
});

test('a region holds one pole per contrast', () => {
  const api = fresh();
  const r = api.field.root;
  api.setPole(r, 'wet', patient, 'first');
  api.setPole(r, 'dry', restless, 'second');
  assert.equal(api.poleOf(r, 'water'), 'dry');
  assert.equal(api.marksOf(r, 'pole').length, 1);
  api.setPole(r, 'hot', restless, 'third');
  assert.equal(api.marksOf(r, 'pole').length, 2);
  assert.equal(api.hasPole(r, 'wet'), false);
  assert.equal(api.POLES.wet.other, 'dry'); assert.equal(api.POLES.above.contrast, 'height');
});

test('biomes come from the mark table', () => {
  const api = fresh();
  const r = api.field.root;
  assert.equal(api.biomeOf(r), 'meadow');
  api.setPole(r, 'wet', patient, ''); api.setPole(r, 'moving', patient, ''); assert.equal(api.biomeOf(r), 'river');
  api.setPole(r, 'still', patient, ''); assert.equal(api.biomeOf(r), 'wetland');
  api.setPole(r, 'dry', patient, ''); api.setPole(r, 'cold', patient, ''); assert.equal(api.biomeOf(r), 'forest');
  api.setPole(r, 'hot', patient, ''); assert.equal(api.biomeOf(r), 'meadow');
  api.setPole(r, 'above', patient, ''); assert.equal(api.biomeOf(r), 'rocky');
  api.mark(r, 'scar', 'burned', patient, ''); assert.equal(api.biomeOf(r), 'ash');
  assert.equal(api.GROWS.forest, true); assert.equal(api.GROWS.ash, false);
});

test('poleShare is the share of the live field that carries a pole', () => {
  const api = fresh();
  const cut = api.splitRegion(api.field.root, patient);
  api.setPole(cut.a, 'wet', patient, '');
  const share = api.poleShare('wet');
  assert.ok(Math.abs(share - cut.a.area / (api.W * api.H)) < 1e-9);
  assert.equal(api.poleShare('dry'), 0);
});

test('the era, the age, and the stamp', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.era, 'days'); assert.equal(api.age, 0); assert.deepEqual(api.legends, []);
  assert.equal(api.SPECIES.rabbit.prey, true); assert.equal(api.SPECIES.deer.prey, true); assert.equal(api.SPECIES.wolf.prey, undefined);
  assert.deepEqual(api.options, { sw: 10, sh: 6, zmin: -2, zmax: 2, ageLimit: 200 });
});
```

In `tests/options.js`, change the defaults assertion to `assert.deepEqual(api.options, { sw: 10, sh: 6, zmin: -2, zmax: 2, ageLimit: 200 });`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/field.js`
Expected: FAIL with `api.initField is not a function`.

- [ ] **Step 3: The state and the option in `core.js`**

Change `DEFAULT_OPTIONS` and add a guard line inside `setOptions`, after the level-range guard:

```js
const DEFAULT_OPTIONS = { sw: 10, sh: 6, zmin: -2, zmax: 2, ageLimit: 200 };
```

```js
  if (!Number.isInteger(options.ageLimit) || options.ageLimit < 1) throw new Error(`The age limit must be a whole number of ages, at least 1. Got ${options.ageLimit}.`);
```

Replace the world state line with:

```js
/* World state */
let world, levels, raised, hills, caves, sectors, beings, items, itemGrid, chronicle, corpses, tick, nextId, fireCount, seedText, camps, camp, goalPriority, namePool, resCache, weather, groves;
/* The eras. In the gods era a step is an age and nothing has a tile yet. field and boundaries are the
   regions the gods made; legends keeps every god-era line and is never trimmed; creation is the record
   of the run. godRng is the gods' own stream. */
let era = 'days', age = 0, pulseAge = null, godRng = null, legends = [], creation = null, field = null, boundaries = [];
```

Replace `stamp` and `log`:

```js
/* Before the Pulse there is no "when", only "then". After it the ages count. */
function stamp(){
  if (era === 'gods') return pulseAge === null ? 'Before time' : `Age ${age - pulseAge + 1}`;
  return `Day ${dayOf()}, ${String(Math.floor(hourOf())).padStart(2, '0')}:00`;
}
function log(text, who = [], kind = 'info'){
  const e = { tick, when: stamp(), text, kind };
  if (era === 'gods'){ e.age = age; legends.push(e); }
  chronicle.unshift(e); if (chronicle.length > 300) chronicle.pop();
  for (const a of who){ a.history.unshift(e); if (a.history.length > 40) a.history.pop(); }
}
```

- [ ] **Step 4: The field**

Create `src/sim/field.js`:

```js
/* ---------- the field that divides ----------
   Before the world has tiles it has regions. One region holds everything at the start. A god's act
   splits a region in two along a line the god draws, and place is made by division. A region stops
   splitting at sector size. Sectors stay as they are for viewing; at settle a sector takes its biome
   from the region that covers most of it. regionOf maps each tile to the live region that holds it. */
const SECTOR_AREA = LW * LH;
let regionOf = null;
function initField(){
  regionOf = new Int32Array(W * H);
  const tiles = new Array(W * H); for (let i = 0; i < W * H; i++) tiles[i] = i;
  field = { regions: [], root: null, byId: new Map() };
  boundaries = [];
  field.root = addRegion(tiles, null, null, 0);
  return field.root;
}
function addRegion(tiles, parent, by, at){
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (const i of tiles){ const x = i % W, y = (i - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const r = { id: nextId++, tiles, area: tiles.length, bbox: { x0, y0, x1, y1 }, parent, by, age: at, marks: [], children: null, lastBy: null, lastAge: -1 };
  field.regions.push(r); field.byId.set(r.id, r);
  for (const i of tiles) regionOf[i] = r.id;
  return r;
}
const regionById = id => field.byId.get(id);
const liveRegions = () => field.regions.filter(r => !r.children);
const regionAt = (x, y) => regionById(regionOf[idx(x, y)]);
const canSplit = r => !r.children && r.area >= 2 * SECTOR_AREA;
/* The live regions that share an edge with r. */
function neighboursOf(r){
  const seen = new Set();
  for (const i of r.tiles){ const x = i % W, y = (i - x) / W;
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const id = regionOf[idx(nx, ny)]; if (id !== r.id) seen.add(id); } }
  return [...seen].map(regionById);
}
/* Split r across its longer side. A patient god draws a straight line; a restless one draws a winding
   one from noise. Each child keeps at least a sector of tiles, and inherits the parent's marks. The
   boundary is the line of a's tiles that touch b: a place of its own. Returns null when no cut in eight
   tries leaves both sides big enough. A child of a ragged parent may lie in two pieces; that is accepted. */
function splitRegion(r, god){
  if (!canSplit(r)) return null;
  const { x0, y0, x1, y1 } = r.bbox;
  const alongX = (x1 - x0) >= (y1 - y0);
  const wobble = Math.round((1 - god.traits.patience) * 6);
  const lo = alongX ? x0 : y0, hi = alongX ? x1 : y1;
  for (let tries = 0; tries < 8; tries++){
    const cut = lo + Math.round((0.3 + rng() * 0.4) * (hi - lo));
    const noise = wobble ? makeNoise(12) : null;
    const side = i => { const x = i % W, y = (i - x) / W; const along = alongX ? x : y, across = alongX ? y : x; const off = noise ? Math.round((noise(across, 0) - 0.5) * 2 * wobble) : 0; return along < cut + off ? 0 : 1; };
    const a = [], b = [];
    for (const i of r.tiles) (side(i) === 0 ? a : b).push(i);
    if (a.length < SECTOR_AREA || b.length < SECTOR_AREA) continue;
    const ca = addRegion(a, r.id, god.id, age), cb = addRegion(b, r.id, god.id, age);
    for (const c of [ca, cb]) c.marks = r.marks.map(m => ({ ...m, inherited: true }));
    r.children = [ca.id, cb.id];
    const line = a.filter(i => { const x = i % W, y = (i - x) / W; return DIRS.some(([dx, dy]) => inb(x + dx, y + dy) && regionOf[idx(x + dx, y + dy)] === cb.id); });
    const boundary = { id: nextId++, a: ca.id, b: cb.id, tiles: line, by: god.id, pole: god.pole, age };
    boundaries.push(boundary);
    return { a: ca, b: cb, boundary };
  }
  return null;
}
```

- [ ] **Step 5: The marks**

Create `src/sim/marks.js`:

```js
/* ---------- marks ----------
   A mark is a record on a region, and after settle on a hill, a cave, a scar, or a tile: kind, value,
   who, age, and a why sentence for the card. Rules read marks. Nothing reads a god's name. */
const CONTRASTS = { height: ['above', 'below'], water: ['wet', 'dry'], heat: ['hot', 'cold'], motion: ['still', 'moving'], sight: ['light', 'dark'] };
const POLES = {};
for (const c in CONTRASTS){ const [p, q] = CONTRASTS[c]; POLES[p] = { contrast: c, other: q }; POLES[q] = { contrast: c, other: p }; }
function mark(target, kind, value, god, why){ const m = { kind, value, by: god ? god.id : null, age, why }; target.marks.push(m); return m; }
const marksOf = (t, kind) => t.marks.filter(m => m.kind === kind);
const hasMark = (t, kind, value) => t.marks.some(m => m.kind === kind && (value === undefined || m.value === value));
/* A region holds one pole per contrast. Setting a pole drops the other pole of its contrast. */
function setPole(r, pole, god, why){
  const c = POLES[pole].contrast;
  r.marks = r.marks.filter(m => !(m.kind === 'pole' && POLES[m.value].contrast === c));
  return mark(r, 'pole', pole, god, why);
}
const poleOf = (r, contrast) => { const m = r.marks.find(m => m.kind === 'pole' && POLES[m.value].contrast === contrast); return m ? m.value : null; };
const hasPole = (r, pole) => poleOf(r, POLES[pole].contrast) === pole;
/* Biomes come from mark combinations, not from noise. The first row whose needs are all present wins.
   A burned scar is ash whatever else is there. */
const BIOME_OF = [
  { needs: ['wet', 'moving'], biome: 'river' },
  { needs: ['wet', 'still'], biome: 'wetland' },
  { needs: ['wet'], biome: 'wetland' },
  { needs: ['dry', 'above'], biome: 'rocky' },
  { needs: ['dry', 'cold'], biome: 'forest' },
  { needs: ['dry', 'hot'], biome: 'meadow' },
  { needs: [], biome: 'meadow' },
];
function biomeOf(r){
  if (hasMark(r, 'scar', 'burned')) return 'ash';
  for (const row of BIOME_OF) if (row.needs.every(p => hasPole(r, p))) return row.biome;
  return 'meadow';
}
/* Where things grow, there is fuel. */
const GROWS = { forest: true, meadow: true, wetland: true, rocky: false, river: false, ash: false };
/* How much of the live field carries a pole, 0 to 1. */
function poleShare(pole){ let n = 0, all = 0; for (const r of liveRegions()){ all += r.area; if (hasPole(r, pole)) n += r.area; } return all ? n / all : 0; }
```

- [ ] **Step 6: `resetState`, the era in `step`, and the tables**

In `src/sim/main.js`, replace `startWorld` with:

```js
/* Everything a fresh world needs before either era begins. The draw order here is the old startWorld's,
   so the golden record holds. */
function resetState(seed, opts){
  setOptions(opts); allocSearch();
  seedText = String(seed); rng = mulberry32(hashSeed(seedText));
  tick = Math.round(DAY * 7 / 24); nextId = 1; fireCount = 0;
  chronicle = []; beings = []; corpses = []; resCache = new Map(); namePool = shuffle(NAMES);
  camps = []; camp = makeCamp('The first camp'); weather = { storm: false, until: 0, next: 1500 + rint(2000) };
  goalPriority = {};
  resetDoor();
  era = 'days'; age = 0; pulseAge = null; godRng = null; legends = []; creation = null; field = null; boundaries = [];
}
function startWorld(seed, opts = {}){
  resetState(seed, opts);
  generate();
  const a = beings[0];
  log(`${a.name} walks alone into the ${sectorOfTile(tileAt(a.x, a.y)).name.toLowerCase()} with nothing but two hands.`, [a], 'major');
}
```

Replace `step`:

```js
/* In the gods era a step is an age. In the days era it is a tick. A species with perTick false is not
   stepped by the tick: the gods keep their own clock. */
function step(){
  if (era === 'gods') return ageStep();
  tick++; updateWorld(); camp = camps[0];
  for (const a of beings) if (a.alive && SPECIES[a.species].perTick !== false) updateBeing(a);
  if (tick % 200 === 0) beings = beings.filter(b => b.alive || b.species === 'human');
}
```

`ageStep` is written in Task 2. Until then the gods era is never entered, so the call is never reached.

In `src/sim/species.js`, add `prey: true` to the rabbit and deer rows:

```js
  rabbit: { glyph: 'r', label: 'rabbit', decay: { food: 0.07, rest: 0.03 }, stride: 2, zmin: 0, zmax: 0, prey: true },
  deer:   { glyph: 'd', label: 'deer',   decay: { food: 0.05, water: 0.04, rest: 0.03 }, stride: 2, zmin: 0, zmax: 2, prey: true },
```

In `src/sim/index.js`, change `FILES`:

```js
const FILES = ['core', 'field', 'marks', 'world', 'path', 'camps', 'beings', 'species', 'fae', 'tasks', 'goals', 'recipes', 'weather', 'main', 'door'];
```

and add to the API, after the `near, nearAt, dist,` line:

```js
  initField, splitRegion, regionById, liveRegions, regionAt, canSplit, neighboursOf, SECTOR_AREA,
  CONTRASTS, POLES, mark, marksOf, hasMark, setPole, poleOf, hasPole, BIOME_OF, biomeOf, GROWS, poleShare,
  get era(){ return era; }, get age(){ return age; }, get pulseAge(){ return pulseAge; }, get legends(){ return legends; }, get creation(){ return creation; },
  get field(){ return field; }, get boundaries(){ return boundaries; },
```

- [ ] **Step 7: Run the tests**

Run: `node --test tests/field.js tests/options.js tests/door.js tests/terrain.js tests/crafts.js tests/gnomes.js && node tests/soak.js`
Expected: all PASS. The golden matches on every seed.

- [ ] **Step 8: Build, register, commit**

Run: `node build.js`

In `design/settings.md`, change the `ageLimit` line's state to `hook` and its notes to `Default 200. startWorld and startCreation take it. Past it the backstop acts once an age; at twice it the creation is marked failed.`

```bash
git add src/sim/core.js src/sim/field.js src/sim/marks.js src/sim/main.js src/sim/species.js src/sim/index.js tests/field.js tests/options.js design/settings.md dist/hearth-sim.html
git commit -m "The field that divides: regions, splits, boundaries, marks, and the era in the state

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn"
```

---

### Task 2: The gods, the first acts, the gate, and the ages

**Files:**
- Create: `src/sim/gods.js`
- Modify: `src/sim/index.js` (`FILES`, API)
- Test: `tests/gods.js`

**Interfaces:**
- Consumes: everything Task 1 produces; `makeBeing`, `beingById`, `shuffle`, `rint`, `clamp`, `log`, `makeNoise`.
- Produces: `SPECIES.god` (`perTick: false`), `LIFE.god` (`death: 'killable'`), `GOD_NAMES`, `EPITHET`, `BODY`, `SCAR_OF`, `MAKES`, `STRAIN`. `gods()`, `awakeGods()`, `godOf(pole)`, `withGodRng(fn)`, `makeGod(pole, region, why)`. God fields beyond a being's: `pole`, `contrast`, `epithet`, `region` (id or null), `status` in `awake | asleep | dead`, `acted`. Needs `expression`, `company`, `rest`, `calm`, 0 to 100. `godNeeds(g)`, `settleHome(g)`, `godOptions(g)` returns `[{ type, label, region, score }]` sorted; `decideGod(g)`; `GOD_ACTS[name] = { poles: null | string[], targets(g) -> region[], score(g, r) -> number, apply(g, r) -> boolean, continue?(g, task) }`. `noteBeside(g, r)`, `offend(r, g)`, `setRelation(g, o)`. `restGate()` returns `{ ok, lack?, start? }` with `lack` in `start | water | fuel | food | people`. `strain(lack)`. `ageStep()`, `firstGod()`, `settle()`, `backstop()`. `startCreation(seed, opts = {})`, `runAges(max?)` returns the age reached. `creation = { ages, backstops, settled, failed, gate }`.

- [ ] **Step 1: Write the failing test**

Create `tests/gods.js`:

```js
// The gods as mobs: coming into being, the first ages, the gate, and a creation that ends. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('a creation opens the gods era with one formless region and no god', () => {
  const api = load(); api.startCreation('r');
  assert.equal(api.era, 'gods'); assert.equal(api.age, 0);
  assert.equal(api.liveRegions().length, 1);
  assert.equal(api.gods().length, 0);
  assert.deepEqual(api.legends, []);
  assert.deepEqual(api.creation, { ages: 0, backstops: 0, settled: false, failed: false, gate: null });
  assert.ok(api.godRng);
});

test('the first age: a god comes into being, sunders the formless, and the far side gets its own god', () => {
  const api = load(); api.startCreation('r');
  api.step();
  assert.equal(api.age, 1);
  const gs = api.gods();
  assert.equal(gs.length, 2, 'the splitter and its counterpart');
  const [first, second] = gs;
  assert.equal(api.POLES[first.pole].other, second.pole);
  assert.equal(first.status, 'awake'); assert.equal(second.status, 'awake');
  assert.equal(first.species, 'god'); assert.equal(api.SPECIES.god.perTick, false); assert.equal(api.LIFE.god.death, 'killable');
  assert.ok(api.GOD_NAMES.includes(first.name)); assert.equal(first.epithet, api.EPITHET[first.pole]);
  assert.deepEqual(Object.keys(first.needs), ['expression', 'company', 'rest', 'calm']);
  assert.equal(api.liveRegions().length, 2);
  const [a, b] = api.liveRegions();
  assert.ok(api.hasPole(a, first.pole) && api.hasPole(b, second.pole));
  assert.equal(first.region, a.id); assert.equal(second.region, b.id);
  assert.equal(api.boundaries.length, 1);
  assert.ok(api.legends.some(e => e.text.startsWith('The Sundering')), 'no Sundering line');
  assert.ok(api.legends.every(e => e.when === 'Before time'));
  assert.ok(first.lastChoice && first.lastChoice.picked === 'split');
});

test('the second age is the Pulse, and the ages count from it', () => {
  const api = load(); api.startCreation('r');
  api.step(); api.step();
  assert.equal(api.pulseAge, 2);
  const pulse = api.legends.find(e => e.text.startsWith('The Pulse'));
  assert.ok(pulse, 'no Pulse line'); assert.equal(pulse.when, 'Age 1');
  api.step();
  const third = api.legends.filter(e => e.age === 3);
  assert.ok(third.every(e => e.when === 'Age 2'), 'a line from the third age is not stamped Age 2');
});

test('the gate names the lack, and a god cannot sleep until it passes', () => {
  const api = load(); api.startCreation('r');
  const gate0 = api.restGate();
  assert.equal(gate0.ok, false); assert.equal(gate0.lack, 'start');
  api.step();
  const gate1 = api.restGate();
  assert.equal(gate1.ok, false); assert.ok(['start', 'water', 'fuel', 'food', 'people'].includes(gate1.lack));
  for (const g of api.awakeGods()) assert.ok(!api.godOptions(g).some(o => o.type === 'sleep'), `${g.name} could sleep with the gate shut`);
});

test('a lack of people draws the gods together, and a lack of water calls the wet god', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const [a, b] = api.awakeGods();
  const before = a.opinions[b.id] || 0;
  api.withGodRng(() => api.strain('people'));
  assert.equal(a.opinions[b.id], before + 5);
  if (!api.godOf('wet')){ api.withGodRng(() => api.strain('water')); assert.ok(api.godOf('wet'), 'no wet god after the strain'); assert.equal(api.godOf('wet').region, null); }
});

test('everything the gods do draws from their own stream', () => {
  /* The people's stream after two ages sits where it sat before them: the next draw is the same number. */
  const d = load(); d.startCreation('r');
  const e = load(); e.startCreation('r'); e.step(); e.step();
  assert.ok(e.legends.length >= 3, 'two ages wrote nothing');
  assert.equal(d.rint(1000000), e.rint(1000000), 'the ages moved the people\'s stream');
});

test('a creation ends: every god sleeps, the gate passes, the era flips, and the same seed tells the same myth', () => {
  const api = load(); api.startCreation('r');
  const ages = api.runAges();
  assert.equal(api.era, 'days');
  assert.equal(api.creation.settled, true); assert.equal(api.creation.failed, false);
  assert.ok(ages <= api.options.ageLimit, `${ages} ages`);
  assert.ok(api.gods().length >= 2);
  for (const g of api.gods()) assert.ok(g.status === 'asleep' || g.status === 'dead', `${g.name} is ${g.status}`);
  assert.equal(api.creation.gate.ok, true);
  assert.ok(api.liveRegions().some(r => api.hasMark(r, 'making', 'human')), 'no people were made');
  assert.ok(api.liveRegions().some(r => api.marksOf(r, 'rest').length), 'no god sleeps in a region');
  const spark = api.legends.find(e => e.text === 'A spark stayed.');
  if (api.gods().some(g => g.pole === 'hot')) assert.ok(spark, 'the hot god slept without the spark');
  const again = load(); again.startCreation('r'); again.runAges();
  assert.deepEqual(again.legends.map(e => e.text), api.legends.map(e => e.text));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/gods.js`
Expected: FAIL with `api.startCreation is not a function`.

- [ ] **Step 3: Write the gods**

Create `src/sim/gods.js`:

```js
/* ---------- the primal gods ----------
   A god is a being in the beings list with the same shape as a person. Its place is a region, not a
   tile. Gods come into being from contrasts: the seed makes the first, and every other is made by a
   lack. In the gods era a step is an age; every awake god scores its acts over the live regions and
   does the best one, eldest first. Everything here draws from the gods' own stream. */
SPECIES.god = { glyph: '✶', label: 'god', decay: { expression: 0, company: 0, rest: 0, calm: 0 }, stride: 0, zmin: 0, zmax: 0, perTick: false };
LIFE.god = { adult: 0, old: Infinity, life: Infinity, death: 'killable' };
const GOD_NAMES = ['Ondru', 'Sael', 'Ashka', 'Veyl', 'Morrow', 'Ilse', 'Thrum', 'Kesh', 'Ubbe', 'Nyr', 'Tamsa', 'Orun'];
const EPITHET = { above: 'who is Above', below: 'who is Below', wet: 'who is Wet', dry: 'who is Dry', hot: 'who is Hot', cold: 'who is Cold', still: 'who is Still', moving: 'who Moves', light: 'who is Light', dark: 'who is Dark' };
/* What a god becomes when it sleeps. */
const BODY = { above: 'a hill', below: 'the deep', wet: 'the river', dry: 'the plain', hot: 'an ember', cold: 'the frost', still: 'a lake', moving: 'the wind', light: 'the day', dark: 'a cave' };
/* The scar a winner's pole leaves on what it beat. */
const SCAR_OF = { hot: 'burned', cold: 'broken', wet: 'drowned', dry: 'burned', above: 'cut', below: 'cut', still: 'broken', moving: 'cut', light: 'broken', dark: 'broken' };
/* Who makes what. The people are made by a mingling. */
const MAKES = { wet: ['deer'], dark: ['sprite', 'fox'], cold: ['wolf'], hot: ['rabbit'], dry: ['rabbit'] };
/* The pole a lack calls for. */
const STRAIN = { start: 'dry', water: 'wet', fuel: 'hot', food: 'hot' };
let godNamePool = [];
const gods = () => beings.filter(b => b.species === 'god');
const awakeGods = () => gods().filter(g => g.status === 'awake');
const godOf = pole => gods().find(g => g.pole === pole && g.status !== 'dead');
function withGodRng(fn){ const keep = rng; rng = godRng; try { return fn(); } finally { rng = keep; } }

function makeGod(pole, region, why){
  if (!godNamePool.length) godNamePool = shuffle(GOD_NAMES);
  const g = makeBeing('god', 0, 0, null, 0);
  g.name = godNamePool.pop(); g.pole = pole; g.contrast = POLES[pole].contrast; g.epithet = EPITHET[pole];
  g.region = region ? region.id : null; g.status = 'awake'; g.born = age; g.acted = 0;
  g.needs = { expression: 60, company: 60, rest: 90, calm: 80 };
  g.skills = {}; for (const k in GOD_ACTS) g.skills[k] = 0;
  beings.push(g);
  log(`${why} ${g.name} comes into being, ${g.epithet}.`, [g], 'major');
  return g;
}
/* A god stands in a live region. If its region was split, it stands in the child that carries its pole. */
function settleHome(g){
  let r = g.region === null ? null : regionById(g.region);
  while (r && r.children){ const kids = r.children.map(regionById); r = kids.find(k => hasPole(k, g.pole)) || kids[0]; }
  g.region = r ? r.id : null;
  return r;
}
/* Needs fall each age. Expression falls when the pole is scarce. Company falls alone. Rest falls as the
   field fills, slower for the hardy. Calm drifts back up. */
function godNeeds(g){
  const n = g.needs, live = liveRegions();
  const filled = live.length ? live.filter(r => r.marks.length).length / live.length : 0;
  n.expression = clamp(n.expression - 12 + 40 * poleShare(g.pole), 0, 100);
  n.company = clamp(n.company - 6, 0, 100);
  n.rest = clamp(n.rest - 3 - 12 * filled * (1 - g.traits.hardiness * 0.5), 0, 100);
  n.calm = clamp(n.calm + 2, 0, 100);
}
function gainGodXp(g, act){ g.xp[act] = (g.xp[act] || 0) + 0.7 + g.traits.curiosity * 0.6; if (g.xp[act] >= (g.skills[act] + 1) * 3){ g.xp[act] = 0; g.skills[act]++; } }

/* ---------- relations ---------- */
function setRelation(g, o){
  const mine = g.opinions[o.id] || 0, theirs = o.opinions[g.id] || 0;
  if (mine >= 40 && theirs >= 40 && g.rel[o.id] !== 'lover'){ g.rel[o.id] = o.rel[g.id] = 'lover'; log(`${g.name} and ${o.name} are lovers now.`, [g, o], 'good'); }
  else if ((mine <= -40 || theirs <= -40) && g.rel[o.id] !== 'rival'){ g.rel[o.id] = o.rel[g.id] = 'rival'; log(`${g.name} and ${o.name} are rivals now.`, [g, o], 'bad'); }
}
/* Acting beside a god you like feeds company and warms both opinions. */
function noteBeside(g, r){
  for (const n of neighboursOf(r)){
    if (n.lastAge !== age || n.lastBy === g.id || n.lastBy === null) continue;
    const o = beingById(n.lastBy); if (!o || o.status !== 'awake' || (g.opinions[o.id] || 0) < 0) continue;
    g.needs.company = clamp(g.needs.company + 25, 0, 100); o.needs.company = clamp(o.needs.company + 15, 0, 100);
    g.opinions[o.id] = clamp((g.opinions[o.id] || 0) + 4, -100, 100); o.opinions[g.id] = clamp((o.opinions[g.id] || 0) + 4, -100, 100);
    setRelation(g, o);
  }
}
/* Marking over another god's region offends it. */
function offend(r, g){
  const who = new Set(r.marks.filter(m => m.by !== null && m.by !== g.id && !m.inherited).map(m => m.by));
  for (const id of who){ const o = beingById(id); if (!o || o.status !== 'awake') continue;
    o.needs.calm = clamp(o.needs.calm - 20, 0, 100); o.opinions[g.id] = clamp((o.opinions[g.id] || 0) - 10, -100, 100);
    addThought(o, 'over' + g.id, `${g.name} marked over my country`, -10, 4); setRelation(o, g); }
}

/* ---------- the acts ----------
   name: { poles: who may (null is anyone), targets(g): regions, score(g, r), apply(g, r): true if done,
   continue(g, task) for acts that take ages }. */
const GOD_ACTS = {
  split: {
    poles: null,
    targets: g => liveRegions().filter(canSplit),
    score: (g, r) => (100 - g.needs.expression) * 0.8 + 30 * r.area / (W * H) + (g.region === r.id ? 10 : 0) + rng() * 8,
    apply(g, r){
      const wasRoot = r === field.root;
      const cut = splitRegion(r, g); if (!cut) return false;
      const other = POLES[g.pole].other;
      offend(r, g);
      setPole(cut.a, g.pole, g, `${g.name} drew the line, and this was the near side.`);
      setPole(cut.b, other, g, `${g.name} drew the line, and this was the far side.`);
      cut.a.lastBy = g.id; cut.a.lastAge = age; g.region = cut.a.id;
      if (wasRoot) log(`The Sundering. ${g.name} parts the formless: ${g.pole} from ${other}. There is a here and a there.`, [g], 'major');
      else log(`${g.name} parts a country: ${g.pole} from ${other}.`, [g]);
      if (!godOf(other)) makeGod(other, cut.b, 'The far side has nobody to hold it.');
      return true;
    },
  },
  make: {
    poles: Object.keys(MAKES),
    targets: g => liveRegions().filter(r => hasPole(r, g.pole) && MAKES[g.pole].some(sp => !hasMark(r, 'making', sp))),
    score(g, r){ const unmade = MAKES[g.pole].filter(sp => !liveRegions().some(q => hasMark(q, 'making', sp))); return (100 - g.needs.expression) * 0.3 + g.traits.curiosity * 30 + (unmade.length ? 40 : 0) - 10 + rng() * 8; },
    apply(g, r){
      const sp = MAKES[g.pole].find(s => !liveRegions().some(q => hasMark(q, 'making', s))) || MAKES[g.pole].find(s => !hasMark(r, 'making', s));
      if (!sp) return false;
      mark(r, 'making', sp, g, `${g.name} made the ${SPECIES[sp].label} here.`);
      r.lastBy = g.id; r.lastAge = age;
      log(`${g.name} makes the ${SPECIES[sp].label}s, and sets them in a ${biomeOf(r)} country.`, [g], 'major');
      return true;
    },
  },
  mingle: {
    poles: null,
    targets(g){
      const out = [];
      for (const o of awakeGods()){ if (o === g || g.rel[o.id] !== 'lover' || o.contrast === g.contrast) continue;
        const near = new Set(); for (const id of [g.region, o.region]){ const r = id === null ? null : regionById(id); if (!r) continue; near.add(r); for (const n of neighboursOf(r)) near.add(n); }
        for (const r of near) if (!(hasPole(r, g.pole) && hasPole(r, o.pole))) out.push(r); }
      return out;
    },
    score: (g, r) => (100 - g.needs.company) * 0.7 + g.traits.sociability * 20 + (liveRegions().some(q => hasMark(q, 'making', 'human')) ? 0 : 30) + rng() * 8,
    apply(g, r){
      const o = awakeGods().find(o => o !== g && g.rel[o.id] === 'lover' && o.contrast !== g.contrast); if (!o) return false;
      setPole(r, g.pole, g, `${g.name} and ${o.name} mingled here.`); setPole(r, o.pole, o, `${g.name} and ${o.name} mingled here.`);
      r.lastBy = g.id; r.lastAge = age;
      for (const p of [g, o]) p.needs.company = clamp(p.needs.company + 30, 0, 100);
      log(`${g.name} and ${o.name} mingle, and the country between them is ${g.pole} and ${o.pole} at once: a ${biomeOf(r)}.`, [g, o], 'major');
      if (!liveRegions().some(q => hasMark(q, 'making', 'human'))){ mark(r, 'making', 'human', g, `Where ${g.name} and ${o.name} mingled, the people were made.`); log('Where they mingled, something stood up on two legs and looked about. The people are made.', [g, o], 'major'); }
      return true;
    },
  },
  sleep: {
    poles: null,
    targets: g => restGate().ok ? [settleHome(g) || liveRegions()[0]] : [],
    score: (g, r) => (100 - g.needs.rest) * 1.2 - 20 + rng() * 8,
    apply(g, r){
      mark(r, 'rest', g.id, g, `${g.name} sleeps here, and is ${BODY[g.pole]}.`);
      g.status = 'asleep'; g.asleep = true; g.needs.rest = 100; g.region = r.id; r.lastBy = g.id; r.lastAge = age;
      log(`${g.name} lies down and sleeps, and is ${BODY[g.pole]}.`, [g], 'major');
      if (g.pole === 'hot') log('A spark stayed.', [g], 'major');
      return true;
    },
  },
};

function godOptions(g){
  const opts = [];
  for (const name in GOD_ACTS){ const act = GOD_ACTS[name]; if (act.poles && !act.poles.includes(g.pole)) continue;
    for (const r of act.targets(g)){ const s = act.score(g, r); if (s > 0) opts.push({ type: name, label: name, region: r, score: Math.round(s) }); } }
  opts.sort((p, q) => q.score - p.score);
  return opts;
}
function decideGod(g){
  if (g.task){ const t = g.task;
    if (g.needs.calm < 20 || g.needs.expression < 15){ log(`${g.name} leaves the ${t.type} unfinished.`, [g]); g.task = null; }
    else { GOD_ACTS[t.type].continue(g, t); return; } }
  const opts = godOptions(g); g.lastChoice = { opts: opts.map(o => ({ type: o.type, label: o.label, score: o.score, region: o.region.id })), picked: null };
  for (let k = 0; k < opts.length; k++){ const o = opts[k];
    if (GOD_ACTS[o.type].apply(g, o.region)){ g.lastChoice.picked = o.type; g.acted++; gainGodXp(g, o.type); noteBeside(g, o.region); return; }
    g.lastChoice.opts[k].failed = true; }
}

/* ---------- the rest gate ---------- */
function ring(r, d){ const set = new Set([r]); for (let k = 0; k < d; k++) for (const q of [...set]) for (const n of neighboursOf(q)) set.add(n); return [...set]; }
function touchesWet(r){ return boundaries.some(b => b.pole === 'wet' && b.tiles.some(i => regionOf[i] === r.id)); }
/* A god may sleep only when the world can hold a life: a start region that is dry, level, unscarred,
   and a sector or more; water beside it; fuel and food within two neighbours; and the people made. */
function restGate(){
  const live = liveRegions();
  const starts = live.filter(r => hasPole(r, 'dry') && !poleOf(r, 'height') && !hasMark(r, 'scar', 'burned') && !hasMark(r, 'scar', 'drowned') && r.area >= SECTOR_AREA);
  if (!starts.length) return { ok: false, lack: 'start' };
  const people = live.some(r => hasMark(r, 'making', 'human'));
  let lack = null;
  for (const s of starts){
    const one = ring(s, 1), two = ring(s, 2);
    const water = one.some(r => hasPole(r, 'wet') || touchesWet(r));
    const fuel = two.some(r => GROWS[biomeOf(r)]);
    const food = two.some(r => marksOf(r, 'making').some(m => SPECIES[m.value].prey));
    if (water && fuel && food && people) return { ok: true, start: s };
    if (!lack) lack = !water ? 'water' : !fuel ? 'fuel' : !food ? 'food' : 'people';
  }
  return { ok: false, lack, start: starts[0] };
}
/* The lack strains a contrast. A missing god comes into being to hold the pole; a present one is
   pressed to act. A lack of people draws every god toward every other. */
function strain(lack){
  if (lack === 'people'){ const gs = awakeGods(); for (const g of gs) for (const o of gs) if (o !== g){ g.opinions[o.id] = clamp((g.opinions[o.id] || 0) + 5, -100, 100); setRelation(g, o); } return; }
  let pole = STRAIN[lack];
  if (godOf(pole) && lack === 'fuel') pole = 'cold';
  if (godOf(pole) && lack === 'food') pole = 'wet';
  const g = godOf(pole);
  if (!g) makeGod(pole, null, `The world cannot yet hold a life: it lacks ${lack}.`);
  else if (g.status === 'awake') g.needs.expression = Math.max(0, g.needs.expression - 10);
}

/* ---------- the ages ---------- */
function firstGod(){
  const cs = Object.keys(CONTRASTS); const c = cs[rint(cs.length)]; const pole = CONTRASTS[c][rint(2)];
  log('Before the world had time and place, all was formless.', [], 'major');
  makeGod(pole, field.root, 'Out of the formless, a difference.');
}
function settle(){
  log(`The last of the gods sleeps. The world is ${age} ages old, and holds its breath.`, [], 'major');
  creation.ages = age; creation.settled = true; creation.gate = restGate();
  era = 'days';
}
/* Past the age limit the eldest awake god does what has to be done, once an age, and every awake god
   wearies. At twice the limit the creation fails and everyone sleeps. */
function backstop(){
  const gate = restGate(); const g = awakeGods()[0]; if (!g || gate.ok) return;
  creation.backstops++;
  log(`Wearied, ${g.name} does what has to be done. The world lacks ${gate.lack}.`, [g], 'major');
  const live = liveRegions();
  if (gate.lack === 'start'){ const r = live.slice().sort((p, q) => q.area - p.area)[0]; r.marks = r.marks.filter(m => !(m.kind === 'pole' && POLES[m.value].contrast === 'height') && m.kind !== 'scar'); setPole(r, 'dry', g, 'Made dry so the world could hold a life.'); }
  else if (gate.lack === 'water'){ const n = neighboursOf(gate.start)[0] || gate.start; setPole(n, 'wet', g, 'Made wet so the world could hold a life.'); }
  else if (gate.lack === 'fuel'){ setPole(gate.start, 'hot', g, 'Made warm so things would grow.'); }
  else if (gate.lack === 'food'){ mark(gate.start, 'making', 'rabbit', g, 'Rabbits, so the world could hold a life.'); }
  else if (gate.lack === 'people'){ mark(gate.start, 'making', 'human', g, 'The people, made alone.'); }
  for (const o of awakeGods()) o.needs.rest = Math.max(0, o.needs.rest - 20);
}
function ageStep(){
  withGodRng(() => {
    age++;
    if (age === 1) firstGod();
    if (pulseAge === null && field.root.children){ pulseAge = age; log('The Pulse. Something already made is changed, and so there is a before and an after. Time begins.', [], 'major'); }
    for (const g of gods()) if (g.status === 'awake'){ settleHome(g); godNeeds(g); decideGod(g); }
    const gate = restGate(); creation.gate = gate;
    if (!gate.ok) strain(gate.lack);
    if (!awakeGods().length){ settle(); return; }
    if (age >= 2 * options.ageLimit){ creation.failed = true; for (const g of awakeGods()){ g.status = 'asleep'; g.asleep = true; } log('The gods sleep unfinished. The world would not hold.', [], 'bad'); settle(); return; }
    if (age >= options.ageLimit) backstop();
  });
}
function startCreation(seed, opts = {}){
  resetState(seed, opts);
  era = 'gods'; age = 0; pulseAge = null; legends = []; godNamePool = [];
  godRng = mulberry32(hashSeed(seedText + ':gods'));
  creation = { ages: 0, backstops: 0, settled: false, failed: false, gate: null };
  withGodRng(() => initField());
}
function runAges(max = options.ageLimit * 2 + 2){ let n = 0; while (era === 'gods' && n++ < max) step(); return age; }
```

`addThought(o, key, text, value, dur)` is the people's thought function; a god's thought with duration 4 is four ages, and nothing decays it in this plan. It shows on the card. That is enough.

- [ ] **Step 4: Join the file and expose the API**

In `src/sim/index.js`, `FILES` becomes:

```js
const FILES = ['core', 'field', 'marks', 'world', 'path', 'camps', 'beings', 'species', 'fae', 'tasks', 'goals', 'recipes', 'weather', 'gods', 'main', 'door'];
```

Add to the API:

```js
  startCreation, runAges, ageStep, restGate, strain, godOptions, decideGod, godNeeds, settleHome, GOD_ACTS, GOD_NAMES, EPITHET, BODY, SCAR_OF, MAKES, STRAIN,
  gods, awakeGods, godOf, makeGod, withGodRng, rint, unmake,
  get godRng(){ return godRng; },
```

- [ ] **Step 5: Run the tests and tune until a creation ends**

Run: `node --test tests/gods.js`
Expected: PASS. If the last test fails because seed r's creation does not end within the age limit, or the backstop fired, print the legends (`api.legends.map(e => e.when + ' ' + e.text)`) and look for the lack in `creation.gate`. The knobs, in the order to try them: the `rest` fall in `godNeeds` (faster fall makes sleep more urgent), the `+5` in `strain('people')`, the `40` bonus in `make.score` for an unmade species, the `-20` in `sleep.score`. Change one number, rerun, and keep the change that makes the run end without the backstop. Do not change the gate.

Then: `node --test tests/field.js tests/gods.js tests/options.js tests/door.js tests/terrain.js tests/crafts.js tests/gnomes.js && node tests/soak.js`
Expected: all PASS. Golden unmoved.

- [ ] **Step 6: Build and commit**

Run: `node build.js`

```bash
git add src/sim/gods.js src/sim/index.js tests/gods.js dist/hearth-sim.html
git commit -m "The primal gods: coming into being, the split, the making, the mingling, the gate, and sleep

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn"
```

---

### Task 3: The rest of the acts: raising, digging, water, fire, frost, dark, light, battle, twist, and unmaking

**Files:**
- Modify: `src/sim/gods.js` (`GOD_ACTS`, `ageStep`)
- Test: `tests/gods.js` (append)

**Interfaces:**
- Consumes: Task 2's `GOD_ACTS` shape, `offend`, `setRelation`, `mark`, `setPole`, `marksOf`, `hasMark`, `neighboursOf`, `regionById`.
- Produces: acts `raise`, `dig`, `flow`, `pool`, `burn`, `freeze`, `hide`, `show`, `battle`, `twist`. Marks: `height` (value: storeys), `depth` (value: levels), `flow` (value `surface` or `under`), `pool` (same), `scar` (value from `SCAR_OF` or `burned`), `freeze`, `hide`, `show` (value `true`), `twist` (value: a species). `unmake(g)`: a god whose pole is gone from the live field dies. A god's `task` for a multi-age act: `{ type, region, left, done }`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/gods.js`:

```js
/* A god of a pole, standing in a region that carries the pole, with its needs where the test wants them. */
function godWith(api, pole, needs = {}){
  const r = api.liveRegions()[0];
  const g = api.withGodRng(() => api.makeGod(pole, r, 'Test.'));
  api.setPole(r, pole, g, 'test'); Object.assign(g.needs, needs);
  return { g, r };
}

test('raising takes ages and leaves a height mark; digging leaves depth', () => {
  const api = load(); api.startCreation('r');
  const { g, r } = godWith(api, 'above', { expression: 10 });
  g.traits.diligence = 1;
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.raise.apply(g, r)); });
  assert.ok(g.task && g.task.type === 'raise' && g.task.left === 4 && g.task.done === 1);
  assert.equal(api.marksOf(r, 'height')[0].value, 1);
  api.withGodRng(() => { for (let k = 0; k < 3; k++) api.GOD_ACTS.raise.continue(g, g.task); });
  assert.equal(g.task, null);
  assert.equal(api.marksOf(r, 'height')[0].value, 4);
  assert.ok(api.legends.some(e => /raised a mountain/.test(e.text)));
  const { g: d, r: q } = godWith(api, 'below');
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.dig.apply(d, q)); });
  assert.equal(api.marksOf(q, 'depth')[0].value, 1);
});

test('flow runs through neighbouring countries, and pool marks one', () => {
  const api = load(); api.startCreation('r');
  api.step(); api.step(); api.step();
  const { g, r } = godWith(api, 'wet');
  const flows = () => api.liveRegions().reduce((n, q) => n + api.marksOf(q, 'flow').length, 0);
  const before = flows();
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.flow.apply(g, r)); });
  assert.ok(flows() >= before + 2, 'flow touched fewer than two countries');
  const { g: s, r: p } = godWith(api, 'still');
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.pool.apply(s, p)); });
  assert.ok(api.hasMark(p, 'pool'));
  assert.equal(api.GOD_ACTS.pool.targets(s).includes(p), false, 'a pooled region is offered again');
});

test('burning scars another god\'s country and offends it', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const [a, b] = api.awakeGods();
  const hot = api.withGodRng(() => api.makeGod('hot', null, 'Test.'));
  /* The splitter wrote the poles on both children, so burning b's country offends a, the marker. */
  const target = api.regionById(b.region);
  const calm = a.needs.calm;
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.burn.apply(hot, target)); });
  assert.ok(api.hasMark(target, 'scar', 'burned'));
  assert.equal(api.biomeOf(target), 'ash');
  assert.equal(a.needs.calm, calm - 20);
  assert.equal(a.opinions[hot.id], -10);
});

test('freeze, hide, and show write their own mark kinds', () => {
  const api = load(); api.startCreation('r');
  for (const [pole, act] of [['cold', 'freeze'], ['dark', 'hide'], ['light', 'show']]){
    const { g, r } = godWith(api, pole);
    api.withGodRng(() => { assert.ok(api.GOD_ACTS[act].apply(g, r)); });
    assert.ok(api.hasMark(r, act, true), `${act} left no mark`);
  }
});

test('rivals battle, the winner marks the country, and the loser\'s mark is a scar', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const [a, b] = api.awakeGods();
  a.opinions[b.id] = -50; b.opinions[a.id] = -50; api.withGodRng(() => api.strain('people')); /* setRelation runs inside strain: -45 each, rivals */
  assert.equal(a.rel[b.id], 'rival');
  /* b marks its own country, so a has something of b's to fight over. */
  const target = api.regionById(b.region);
  api.setPole(target, b.pole, b, 'mine');
  assert.ok(api.GOD_ACTS.battle.targets(a).includes(target), 'the rival\'s country is not offered');
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.battle.apply(a, target)); });
  const winnerPole = api.poleOf(target, a.contrast);
  const winner = winnerPole === a.pole ? a : b, loser = winner === a ? b : a;
  assert.ok(api.hasMark(target, 'scar', api.SCAR_OF[winner.pole]), 'no scar of the winner\'s kind');
  assert.ok(api.legends.some(e => e.text.includes(`${winner.name} wins`)));
  assert.equal(loser.opinions[winner.id], -60);
  assert.equal(winner.opinions[loser.id], -50);
});

test('a twist needs a scar and a making', () => {
  const api = load(); api.startCreation('r');
  const { g, r } = godWith(api, 'hot');
  assert.equal(api.GOD_ACTS.twist.targets(g).length, 0);
  api.mark(r, 'scar', 'burned', g, ''); api.mark(r, 'making', 'rabbit', g, '');
  assert.ok(api.GOD_ACTS.twist.targets(g).includes(r));
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.twist.apply(g, r)); });
  assert.ok(api.hasMark(r, 'twist', 'rabbit'));
});

test('a god whose pole is unmade from the whole field dies, and leaves a scar', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const [a, b] = api.awakeGods();
  /* Take b's pole off the field, then run the unmaking as ageStep would. */
  for (const r of api.liveRegions()) if (api.hasPole(r, b.pole)) api.setPole(r, a.pole, a, 'over');
  assert.equal(api.poleShare(b.pole), 0);
  api.withGodRng(() => api.unmake(b));
  assert.equal(b.status, 'dead'); assert.equal(b.alive, false);
  assert.deepEqual(api.awakeGods(), [a]);
  assert.ok(api.legends.some(e => e.text.includes(`${b.name} is no more`)));
  assert.ok(api.liveRegions().some(q => api.marksOf(q, 'scar').some(m => m.by === b.id)), 'no scar for the dead god');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/gods.js`
Expected: the new tests FAIL with `Cannot read properties of undefined (reading 'apply')`.

- [ ] **Step 3: Add the acts**

In `src/sim/gods.js`, add these entries to `GOD_ACTS`, between `make` and `mingle`. A helper for the two multi-age acts goes above the table:

```js
/* Raising and digging spend one age a storey or a level. The diligent spend more ages. */
function spendAges(kind, verb, done){
  return {
    apply(g, r){ const left = 1 + Math.round(g.traits.diligence * 3); g.task = { type: kind === 'height' ? 'raise' : 'dig', region: r.id, left, done: 0 }; log(`${g.name} begins to ${verb}.`, [g]); this.continue(g, g.task); return true; },
    continue(g, t){
      const r = regionById(t.region); let m = marksOf(r, kind)[0]; if (!m) m = mark(r, kind, 0, g, `${g.name} ${verb === 'raise the land' ? 'raised' : 'dug'} it.`);
      m.value++; t.done++; r.lastBy = g.id; r.lastAge = age;
      if (t.done >= t.left){ g.task = null; log(done(g, m.value), [g], 'major'); }
    },
  };
}
```

```js
  raise: {
    poles: ['above'],
    targets: g => liveRegions().filter(r => hasPole(r, 'above')),
    score: (g, r) => (100 - g.needs.expression) * 0.5 + 20 * g.traits.diligence + (marksOf(r, 'height').length ? -10 : 10) + rng() * 8,
    ...spendAges('height', 'raise the land', (g, n) => n >= 3 ? `${g.name} has raised a mountain, ${n} storeys of stone.` : `${g.name} has raised a hill of ${n} ${n === 1 ? 'storey' : 'storeys'}.`),
  },
  dig: {
    poles: ['below'],
    targets: g => liveRegions().filter(r => hasPole(r, 'below')),
    score: (g, r) => (100 - g.needs.expression) * 0.5 + 20 * g.traits.diligence + (marksOf(r, 'depth').length ? -10 : 10) + rng() * 8,
    ...spendAges('depth', 'dig into the dark', (g, n) => n >= 3 ? `${g.name} has dug a deep, ${n} levels down.` : `${g.name} has dug a cave of ${n} ${n === 1 ? 'level' : 'levels'}.`),
  },
  flow: {
    poles: ['wet', 'moving'],
    targets: g => { const r = settleHome(g); return r ? [r] : []; },
    score: (g, r) => (100 - g.needs.expression) * 0.5 + 15 + rng() * 8,
    apply(g, r){
      const path = [r]; let cur = r;
      const len = 2 + rint(3);
      for (let k = 0; k < len; k++){ const next = shuffle(neighboursOf(cur)).find(n => !path.includes(n)); if (!next) break; path.push(next); cur = next; }
      if (path.length < 2) return false;
      for (const p of path){ mark(p, 'flow', marksOf(p, 'depth').length ? 'under' : 'surface', g, `${g.name} flowed through.`); p.lastBy = g.id; p.lastAge = age; }
      log(`${g.name} flows through ${path.length} countries${path.some(p => marksOf(p, 'depth').length) ? ', and under one of them' : ''}.`, [g], 'major');
      return true;
    },
  },
  pool: {
    poles: ['wet', 'still'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'pool') && (hasPole(r, 'wet') || hasPole(r, 'still') || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.4 + 10 + rng() * 8,
    apply(g, r){ mark(r, 'pool', marksOf(r, 'depth').length ? 'under' : 'surface', g, `${g.name} pooled here.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} pools in a country, and the water is still.`, [g]); return true; },
  },
  burn: {
    poles: ['hot'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'scar', 'burned') && r.marks.some(m => m.by !== null && m.by !== g.id && !m.inherited)),
    score: (g, r) => (100 - g.needs.calm) * 0.6 + g.traits.temper * 20 - 15 + rng() * 8,
    apply(g, r){ offend(r, g); mark(r, 'scar', 'burned', g, `${g.name} burned it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} burns a country to ash.`, [g], 'bad'); return true; },
  },
  freeze: {
    poles: ['cold'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'freeze') && (marksOf(r, 'height').length || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.4 + (marksOf(r, 'height').length ? 15 : 0) + rng() * 8,
    apply(g, r){ mark(r, 'freeze', true, g, `${g.name} froze it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} breathes on a country, and the frost stays.`, [g]); return true; },
  },
  hide: {
    poles: ['dark'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'hide') && (marksOf(r, 'depth').length || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.4 + (marksOf(r, 'depth').length ? 15 : 0) + rng() * 8,
    apply(g, r){ mark(r, 'hide', true, g, `${g.name} hid it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} draws the dark over a country, and things hide in it.`, [g]); return true; },
  },
  show: {
    poles: ['light'],
    targets: g => { const r = settleHome(g); return r ? [r, ...neighboursOf(r)].filter(q => !hasMark(q, 'show')) : []; },
    score: (g, r) => (100 - g.needs.expression) * 0.4 + rng() * 8,
    apply(g, r){ mark(r, 'show', true, g, `${g.name} showed it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} opens a country to the light, and it can be seen from far off.`, [g]); return true; },
  },
  battle: {
    poles: null,
    targets(g){ const out = []; for (const o of awakeGods()) if (o !== g && g.rel[o.id] === 'rival') for (const r of liveRegions()) if (r.marks.some(m => m.kind === 'pole' && m.by === o.id && !m.inherited)) out.push(r); return out; },
    score: (g, r) => (100 - g.needs.calm) * 0.7 + g.traits.bravery * 20 - 25 + rng() * 8,
    apply(g, r){
      const v = awakeGods().find(o => o !== g && g.rel[o.id] === 'rival' && r.marks.some(m => m.kind === 'pole' && m.by === o.id && !m.inherited)); if (!v) return false;
      const might = p => p.traits.bravery + (p.skills.battle || 0) * 0.1 + rng() * 0.6;
      const win = might(g) > might(v) ? g : v, lose = win === g ? v : g;
      const lost = r.marks.filter(m => m.kind === 'pole' && m.by === lose.id);
      r.marks = r.marks.filter(m => !lost.includes(m));
      mark(r, 'scar', SCAR_OF[win.pole], win, `${win.name} beat ${lose.name} here.`);
      setPole(r, win.pole, win, `${win.name} won it from ${lose.name}.`);
      r.lastBy = win.id; r.lastAge = age;
      lose.opinions[win.id] = clamp((lose.opinions[win.id] || 0) - 15, -100, 100); win.opinions[lose.id] = clamp((win.opinions[lose.id] || 0) - 5, -100, 100);
      win.needs.calm = clamp(win.needs.calm + 30, 0, 100); lose.needs.calm = clamp(lose.needs.calm - 20, 0, 100);
      log(`${g.name} and ${v.name} fight over a country. ${win.name} wins, and the ground there is ${SCAR_OF[win.pole]}.`, [g, v], 'bad');
      return true;
    },
  },
  twist: {
    poles: null,
    targets: g => liveRegions().filter(r => marksOf(r, 'scar').length && marksOf(r, 'making').some(m => !hasMark(r, 'twist', m.value))),
    score: (g, r) => g.traits.curiosity * 25 - 15 + rng() * 8,
    apply(g, r){
      const m = marksOf(r, 'making').find(m => !hasMark(r, 'twist', m.value)); if (!m) return false;
      mark(r, 'twist', m.value, g, `${g.name} twisted the ${SPECIES[m.value].label}s on the scar.`); r.lastBy = g.id; r.lastAge = age;
      log(`${g.name} bends the ${SPECIES[m.value].label}s that live on the scar. They will not be quite like the others.`, [g], 'bad');
      return true;
    },
  },
```

Add `unmake` above `ageStep`, and call it in `ageStep` after the gods act and before the gate:

```js
/* A god whose pole is gone from the whole live field is unmade. Its death is a scar. */
function unmake(g){
  g.status = 'dead'; g.alive = false; g.asleep = false;
  const r = settleHome(g) || liveRegions()[0];
  mark(r, 'scar', SCAR_OF[g.pole], g, `${g.name} died here, unmade.`);
  log(`Nothing on the field is ${g.pole} any more. ${g.name} is no more, and where ${g.name} stood the ground is ${SCAR_OF[g.pole]}.`, [g], 'death');
}
```

```js
    for (const g of gods()) if (g.status === 'awake'){ settleHome(g); godNeeds(g); decideGod(g); }
    for (const g of awakeGods()) if (g.acted > 0 && poleShare(g.pole) === 0) unmake(g);
    const gate = restGate(); creation.gate = gate;
```

Every act that writes a pole on a region another god marked calls `offend`; `split`, `burn`, and `battle` do. The others write their own mark kinds and do not.

- [ ] **Step 4: Run the tests and the soak**

Run: `node --test tests/gods.js`
Expected: PASS. The convergence test from Task 2 may now take more ages, since gods have more to do before they tire. If it stops ending within the limit, the knob is the `rest` fall in `godNeeds`; if the backstop fires, print the legends and the final gate and tune as Task 2 step 5 says.

Then: `node --test tests/field.js tests/gods.js tests/options.js tests/door.js tests/terrain.js tests/crafts.js tests/gnomes.js && node tests/soak.js`
Expected: all PASS. Golden unmoved.

- [ ] **Step 5: Build and commit**

Run: `node build.js`

```bash
git add src/sim/gods.js tests/gods.js dist/hearth-sim.html
git commit -m "The gods raise, dig, flow, pool, burn, freeze, hide, show, battle, and twist, and a god can be unmade

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn"
```

---

### Task 4: Many seeds to settle, and the report

**Files:**
- Create: `tests/ages.js`
- Modify: `package.json` (scripts)
- Modify: `design/settings.md`

**Interfaces:**
- Consumes: `startCreation`, `runAges`, `creation`, `gods`, `legends`, `liveRegions`, `marksOf`, `hasMark`, `CONTRASTS`.

- [ ] **Step 1: Write the test and the report**

Create `tests/ages.js`:

```js
// The ages: many seeds run to settle, fast, with a report. This is the tuning tool for the grammar.
//   node tests/ages.js                 24 seeds
//   SEEDS=r,x node tests/ages.js       a few
//   VERBOSE=1 SEEDS=r node tests/ages.js   print the legends
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

const SOAK_SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];
const MORE = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'moss-marsh-1', 'ash', 'reed', 'stone', 'pine', 'ford'];
const SEEDS = process.env.SEEDS ? process.env.SEEDS.split(',') : [...SOAK_SEEDS, ...MORE];

function creationOf(seed){
  const api = load(); api.startCreation(seed);
  const t0 = Date.now(); api.runAges(); const ms = Date.now() - t0;
  const gs = api.gods();
  const contrasts = Object.keys(api.CONTRASTS).filter(c => gs.some(g => g.contrast === c));
  const species = new Set(); for (const r of api.liveRegions()) for (const m of api.marksOf(r, 'making')) species.add(m.value);
  const scars = api.liveRegions().filter(r => api.marksOf(r, 'scar').length).length;
  return { api, ms, gs, contrasts, species: [...species].sort(), scars };
}

const rows = [];
for (const seed of SEEDS){
  test(`seed ${seed}: the ages end`, t => {
    const { api, ms, gs, contrasts, species, scars } = creationOf(seed);
    const c = api.creation;
    const line = `${seed.padEnd(14)} ages ${String(c.ages).padStart(3)}  gods ${gs.length}  asleep ${gs.filter(g => g.status === 'asleep').length}  dead ${gs.filter(g => g.status === 'dead').length}  regions ${api.liveRegions().length}  scars ${scars}  backstops ${c.backstops}  ${ms} ms  contrasts ${contrasts.join(',')}  made ${species.join(',')}`;
    rows.push(line); t.diagnostic(line);
    if (process.env.VERBOSE) for (const e of api.legends) t.diagnostic(`${e.when}: ${e.text}`);
    assert.equal(api.era, 'days', 'the era never flipped');
    assert.equal(c.settled, true); assert.equal(c.failed, false, 'the creation failed at twice the limit');
    assert.ok(c.ages <= api.options.ageLimit, `${c.ages} ages is past the limit`);
    assert.equal(c.gate.ok, true, `the gate is shut: ${c.gate.lack}`);
    for (const g of gs) assert.ok(g.status === 'asleep' || g.status === 'dead', `${g.name} is ${g.status}`);
    for (const g of gs) assert.ok(api.legends.some(e => e.text.includes(g.name)), `${g.name} never appears in the legends`);
    assert.ok(species.includes('human'), 'no people');
    assert.ok(species.some(sp => api.SPECIES[sp].prey), 'nothing to eat');
    assert.ok(api.legends.length >= 5);
    assert.ok(ms < 3000, `${ms} ms is too slow for a creation`);
    if (SOAK_SEEDS.includes(seed)) assert.equal(c.backstops, 0, 'the backstop fired on a soak seed');
  });
}

test('report', t => { for (const line of rows) t.diagnostic(line); });
```

- [ ] **Step 2: Run it and read the report**

Run: `node --test tests/ages.js 2>&1 | grep -E "ages |not ok|# (pass|fail)"`
Expected: every seed passes. Read the rows. If a soak seed fires the backstop, run it with `VERBOSE=1 SEEDS=<seed>` and read the legends: the last gate lack says what the gods never did. Tune one knob (Task 2 step 5 lists them), rerun the whole file, and keep the change that makes every soak seed pass without moving any other seed into failure. If a seed fails the `ms` bound, the cost is in `neighboursOf` inside the gate; cache `neighboursOf` per region per age by storing `r.nbAge` and `r.nb` on the region and returning `r.nb` when `r.nbAge === age`.

- [ ] **Step 3: Scripts and the register**

In `package.json` `scripts`, add `"ages": "node --test tests/ages.js"` and `"fast": "node --test tests/field.js tests/gods.js tests/ages.js tests/options.js tests/door.js tests/terrain.js tests/crafts.js tests/gnomes.js"`.

In `design/settings.md`, add a row: `| Pace of the ages, hurry to settle | mythos, section 6 | hook | runAges(max) runs to settle in Node; the page steps ages in plan 4. |` replacing the existing pace row.

- [ ] **Step 4: Run everything once**

Run: `npm run fast && node tests/soak.js`
Expected: all PASS. Golden unmoved.

- [ ] **Step 5: Commit**

```bash
git add tests/ages.js package.json design/settings.md
git commit -m "The ages test: many seeds run to settle, with a report

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn"
```

---

## Done when

- `npm run fast` is green: field, gods, ages, options, door, terrain, crafts, gnomes.
- `node tests/soak.js` is green with the golden record unmoved.
- `tests/ages.js` shows every seed settling within the age limit, and no backstop on the six soak seeds.
- `dist/hearth-sim.html` is rebuilt. The page still starts a world as before; the creation is reachable only from Node until plan 4.

## Known and deferred to plan 3

- Settle paints nothing. `startWorld` never enters the gods era.
- The gnomes (a second people from the dwellers work) have no making yet. Plan 3 adds them to `MAKES` or to the mingling.
- Dead gods are filtered out of `beings` every 200 ticks by the day-era `step`. Plan 3 keeps them.
- A god's thoughts never expire, since nothing ticks them in the ages.
- A region may lie in two pieces after a winding cut of a ragged parent.
