# Topography phase 1: levels, path search, hills, and the level view

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the world five levels, make walking and path search work across them by slopes, raise plain hills at world start, and let the player view one level at a time.

**Architecture:** Level 0 is today's surface array. Four more arrays of the same size hold the tiles that exist above and below it, mostly `null`. Path search indexes tiles by `idx3(x, y, z)` and gets its neighbours from one function, `steps`, which yields the four tiles beside a walker, the tiles up from a slope, and the slopes down beside it. Beings, items, and fire carry a `z`. Hills are rock at level 0 with floors above, cut by one or two slopes each, made by `uplift()` inside `generate()`.

**Tech Stack:** Plain JavaScript scripts sharing one scope under `src/sim/`, joined by `src/sim/index.js`. Node's built-in test runner. No dependencies.

## Global Constraints

- Spec: `design/specs/2026-09-17-topography-design.md`. Phase 1 delivers "Levels, rock and stone, slopes, `steps`, three-dimensional search, the level control, plain hills from uplift only." Done when the soak is green and hills are visible and climbable on the dev server.
- Levels z from −2 to +2. Hills one or two storeys. Nothing below level 0 exists in this phase.
- Rules read data tables. No rule checks the ground name `rock` or `stone`. Passability reads `GROUND[ground].walk`.
- Files in `src/sim/` are plain scripts. No `import`, no `export`. Function calls between files are free.
- `updateWorld()` keeps its step order. Tasks 1 to 4 must not change any seed's story: the soak's golden record must still match after each of them. Task 5 changes generation and re-blesses the golden record.
- Time budget: the soak stays under 25 seconds a seed.
- Every new behaviour is visible: a tile-card row, a legend entry, or a chronicle line.
- Commit after every task on branch `dev`. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Run `node build.js` before any browser check. The dev server at http://localhost:8700/ rebuilds on its own when `src/` changes.

---

## File map

| File | Responsibility in this phase |
|---|---|
| `src/sim/core.js` | Level constants, `idx3`, ground table with `walk`, state variables `levels`, `raised`, `hills`, and `near`/`nearAt`. |
| `src/sim/world.js` | Tiles with z: `tileAt`, `hasTile`, `makeTile`, `placeTile`, `passable`, `nearFind`, `steps`, `nearestFire`, items with z, `uplift()` and its helpers. |
| `src/sim/path.js` | `bfs`, `reachable`, `legPath` over all levels. |
| `src/sim/species.js` | `zmin`/`zmax` per species. Search and distance call sites. |
| `src/sim/beings.js` | `z` on beings, `runTask` moves in z, search and distance call sites. |
| `src/sim/camps.js`, `src/sim/fae.js`, `src/sim/tasks.js`, `src/sim/goals.js` | Search and distance call sites. |
| `src/sim/weather.js` | Fire on every level, spread across slopes. |
| `src/sim/main.js` | `lightTile` with z. |
| `src/sim/index.js` | New names in the Node API. |
| `src/ui.js`, `src/page.template.html` | Level control, drawing per level, tile cards, tools with z, legend, palette. |
| `tests/terrain.js` | New. Level, slope, species, and hill invariants. |
| `tests/lib/run.js` | The cut-off check in three dimensions. |
| `tests/browser-shot.py` | Visit a hill and switch level. |
| `design/notes.md`, `CLAUDE.md`, `README.md` | Record the model. |

---

### Task 1: Levels, grounds, and distance

**Files:**
- Modify: `src/sim/core.js` (constants after `NEAR`, the `GROUND` table, the state `let` line, after `dist`)
- Modify: `src/sim/world.js` (top: tiles and items; `generate()` tile creation)
- Modify: `src/sim/species.js` (`SPECIES` table)
- Modify: `src/sim/index.js` (API)
- Create: `tests/terrain.js`

**Interfaces:**
- Produces: `ZMIN = -2`, `ZMAX = 2`, `ZOFF = 2`, `NZ = 5`; `idx3(x, y, z)`; `levels` (array of 5 arrays), `raised` (tiles off level 0), `hills` (array); `near(a, b)`, `nearAt(a, x, y, z = 0)`; `tileAt(x, y, z = 0)`, `hasTile(x, y, z)`, `makeTile(x, y, z, ground)`, `placeTile(x, y, z, ground)`, `passable(x, y, z = 0)`, `nearFind(x, y, pred, offs = NEAR, z = 0)`, `itemAt(x, y, z = 0)`, `addItem(kind, x, y, z = 0)`; `SPECIES[s].zmin`, `SPECIES[s].zmax`.

- [ ] **Step 1: Write the failing tests**

Create `tests/terrain.js`:

```js
// Terrain: levels, slopes, species limits, and hills. Fast: one world per test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('the surface is level 0 and the levels below are empty', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.levels.length, 5);
  assert.equal(api.levels[api.ZOFF], api.world);
  for (const z of [-2, -1]) assert.ok(api.levels[z + api.ZOFF].every(t => t === null), `level ${z} should hold nothing yet`);
  const t = api.tileAt(10, 10);
  assert.equal(t.z, 0);
  assert.equal(api.tileAt(10, 10, 1), null);
  assert.equal(api.hasTile(10, 10, -1), false);
  assert.equal(api.idx3(10, 10, 0), 2 * api.world.length + 10 * 280 + 10);
});

test('a level apart counts as six tiles', () => {
  const api = load();
  assert.equal(api.near({ x: 0, y: 0, z: 0 }, { x: 2, y: 1, z: 1 }), 9);
  assert.equal(api.nearAt({ x: 5, y: 5, z: 2 }, 5, 5), 12);
  assert.equal(api.nearAt({ x: 5, y: 5, z: 0 }, 6, 5), 1);
});

test('rock does not walk, stone does', () => {
  const api = load(); api.startWorld('r');
  const t = api.placeTile(20, 20, 1, 'stone');
  assert.equal(t.z, 1);
  assert.equal(api.passable(20, 20, 1), true);
  t.ground = 'rock';
  assert.equal(api.passable(20, 20, 1), false);
  assert.equal(api.raised.includes(t), true);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/terrain.js`
Expected: three failures. The first fails with `api.levels` undefined.

- [ ] **Step 3: Add the constants, the grounds, the state, and the distances to `src/sim/core.js`**

After the `AROUND` line add:

```js
/* Levels. Level 0 is the surface. Above it are hilltops. Below it are caves. A level is an array like the surface, mostly null. */
const ZMIN = -2, ZMAX = 2, ZOFF = 2, NZ = ZMAX - ZMIN + 1;
```

Replace the `GROUND` table with:

```js
const GROUND = {
  grass: { name: 'grass',       fuel: 6, flam: 0.6, walk: true },
  soil:  { name: 'bare soil',   fuel: 0, flam: 0,   walk: true },
  sand:  { name: 'sand',        fuel: 0, flam: 0,   walk: true },
  ash:   { name: 'ash',         fuel: 0, flam: 0,   walk: true },
  water: { name: 'water',       fuel: 0, flam: 0,   walk: false },
  rock:  { name: 'bare rock',   fuel: 0, flam: 0,   walk: false },
  stone: { name: 'stone floor', fuel: 0, flam: 0,   walk: true },
};
```

After the `dist` line add:

```js
const idx3 = (x, y, z) => (z + ZOFF) * W * H + y * W + x;
/* Distance between two beings, or a being and a spot. A level apart counts as six tiles, through the rock. */
const near = (a, b) => dist(a.x, a.y, b.x, b.y) + 6 * Math.abs(a.z - b.z);
const nearAt = (a, x, y, z = 0) => dist(a.x, a.y, x, y) + 6 * Math.abs(a.z - z);
```

Change the state line to:

```js
let world, levels, raised, hills, sectors, beings, items, itemGrid, chronicle, corpses, tick, nextId, fireCount, seedText, camps, camp, goalPriority, namePool, resCache, weather, groves;
```

- [ ] **Step 4: Give tiles and items a level in `src/sim/world.js`**

Replace the tiles block (from `const tileAt` through the end of `nearFind`) with:

```js
const tileAt = (x, y, z = 0) => levels[z + ZOFF][idx(x, y)];
const hasTile = (x, y, z) => inb(x, y) && z >= ZMIN && z <= ZMAX && levels[z + ZOFF][idx(x, y)] !== null;
const sectorOfTile = t => sectors[secIdx(...Object.values(secOf(t.x, t.y)))];
function makeTile(x, y, z, ground){ return { x, y, z, ground, feature: null, berries: 0, fire: 0, struct: null, slope: false }; }
/* Put a tile on a level. Tiles off the surface are also listed in `raised`, so per-tick loops can find them without scanning empty levels. */
function placeTile(x, y, z, ground){ const t = makeTile(x, y, z, ground); levels[z + ZOFF][idx(x, y)] = t; if (z !== 0) raised.push(t); return t; }
function matOf(t){ return t.feature ? FEATURES[t.feature].mat : null; }
function passable(x, y, z = 0){
  if (!hasTile(x, y, z)) return false;
  const t = levels[z + ZOFF][idx(x, y)];
  return GROUND[t.ground].walk && !(t.feature && FEATURES[t.feature].solid) && t.fire <= 0 && !(t.struct && t.struct.type === 'firepit');
}
function nearFind(x, y, pred, offs = NEAR, z = 0){
  for (const [dx, dy] of offs){ const nx = x + dx, ny = y + dy; if (hasTile(nx, ny, z)){ const t = levels[z + ZOFF][idx(nx, ny)]; if (pred(t)) return t; } }
  return null;
}
```

In `tileFlam` and `tileFuel`, replace `itemGrid[idx(t.x, t.y)]` with `itemAt(t.x, t.y, t.z)`.

Replace the loose items block with:

```js
/* ---------- loose items ---------- */
function rebuildItemGrid(){ itemGrid = new Array(NZ * W * H).fill(null); for (const it of items){ const i = idx3(it.x, it.y, it.z); if (!itemGrid[i]) itemGrid[i] = it; } }
function addItem(kind, x, y, z = 0){ const it = { id: nextId++, kind, x, y, z, reservedBy: null, born: tick }; items.push(it); const i = idx3(x, y, z); if (!itemGrid[i]) itemGrid[i] = it; return it; }
function removeItem(it){ const k = items.indexOf(it); if (k >= 0) items.splice(k, 1); rebuildItemGrid(); }
const itemAt = (x, y, z = 0) => itemGrid[idx3(x, y, z)];
```

In `looseCount` replace `itemGrid[idx(x, y)]` with `itemAt(x, y)`. In `growPlants` replace `!itemGrid[idx(q.x, q.y)]` with `!itemAt(q.x, q.y)` (twice) and `!itemGrid[idx(t.x, t.y)]` with `!itemAt(t.x, t.y)`.

In `generate()` replace `world = new Array(W * H);` with:

```js
  levels = []; for (let z = ZMIN; z <= ZMAX; z++) levels.push(new Array(W * H).fill(null)); world = levels[ZOFF]; raised = []; hills = [];
```

and replace `const t = { x, y, ground: 'grass', feature: null, berries: 0, fire: 0, struct: null };` with `const t = makeTile(x, y, 0, 'grass');`. Replace `items = []; itemGrid = new Array(W * H).fill(null);` with `items = []; itemGrid = new Array(NZ * W * H).fill(null);`.

- [ ] **Step 5: Add level limits to the species table in `src/sim/species.js`**

Replace the `SPECIES` table with:

```js
const SPECIES = {
  human:  { glyph: '@', label: 'human',  decay: { food: 0.035, water: 0.05, rest: 0.03, social: 0.02, warmth: 0 }, stride: 2, zmin: -2, zmax: 2 },
  rabbit: { glyph: 'r', label: 'rabbit', decay: { food: 0.07, rest: 0.03 }, stride: 2, zmin: 0, zmax: 0 },
  fox:    { glyph: 'f', label: 'fox',    decay: { food: 0.025, water: 0.04, rest: 0.02 }, stride: 2, zmin: -2, zmax: 2 },
  wolf:   { glyph: 'w', label: 'wolf',   decay: { food: 0.02, water: 0.03, rest: 0.02 }, stride: 2, zmin: -2, zmax: 2 },
  deer:   { glyph: 'd', label: 'deer',   decay: { food: 0.05, water: 0.04, rest: 0.03 }, stride: 2, zmin: 0, zmax: 2 },
  sprite: { glyph: '¤', label: 'sprite', decay: { glow: 0.03, play: 0.04, rest: 0.02 }, stride: 1, zmin: -2, zmax: 2 },
};
```

- [ ] **Step 6: Expose the names in `src/sim/index.js`**

Replace the `API` string with:

```js
const API = `return {
  startWorld, step, lightTile, poke, pitLit, goalState, GOALS, START, SPECIES, GROUND,
  seasonOf, dayOf, hourOf, isNight, isWinter, stage, ageDays, mood,
  legPath, bfs, reachable, steps, idx, idx3, secOf, secIdx, tileAt, hasTile, placeTile, sectorOfTile, passable, nearestFire,
  near, nearAt, ZMIN, ZMAX, ZOFF, NZ,
  campHumans, humans, stashFood,
  get camp(){ return camp; }, set camp(c){ camp = c; },
  get camps(){ return camps; }, get beings(){ return beings; }, get chronicle(){ return chronicle; },
  get items(){ return items; }, get world(){ return world; }, get levels(){ return levels; }, get raised(){ return raised; }, get hills(){ return hills; },
  get sectors(){ return sectors; },
  get tick(){ return tick; }, get fireCount(){ return fireCount; }, get weather(){ return weather; },
  get groves(){ return groves; }, get corpses(){ return corpses; }, get seedText(){ return seedText; },
  get goalPriority(){ return goalPriority; },
};`;
```

`steps` arrives in Task 2. Until then, add a one-line stub at the end of `src/sim/world.js` so the API resolves: `function steps(){ return []; }`. Task 2 replaces it.

- [ ] **Step 7: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 3 pass.

- [ ] **Step 8: Run the full soak and confirm the golden record still matches**

Run: `node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"`
Expected: `ℹ pass 44`, `ℹ fail 0`. Nothing in this task changes any decision, so every seed's story is unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/sim/core.js src/sim/world.js src/sim/species.js src/sim/index.js tests/terrain.js
git commit -m "Levels: tiles, items, and grounds carry a z; near() counts levels

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Path search over levels

**Files:**
- Modify: `src/sim/world.js` (replace the `steps` stub after `nearFind`)
- Modify: `src/sim/path.js` (whole file)
- Modify: `src/sim/beings.js` (`makeBeing`, `runTask`, every `bfs(` call)
- Modify: `src/sim/species.js`, `src/sim/fae.js`, `src/sim/tasks.js` (every `bfs(` call)
- Modify: `src/sim/camps.js` (`reachable` calls)
- Modify: `tests/lib/run.js` (`cutOff`)
- Test: `tests/terrain.js`

**Interfaces:**
- Consumes: `idx3`, `passable(x, y, z)`, `hasTile`, `levels`, `ZOFF`, `SPECIES[s].zmin/zmax`, `near`, `nearAt`.
- Produces: `steps(x, y, z, out)` fills `out` with flat triples `nx, ny, nz` and returns it. `bfs(sx, sy, sz, goal, maxNodes = 2500, who = null)` where `goal(x, y, z)`; a path is an array of `[x, y, z]`. `reachable(sx, sy, sz, cap = 4000)` returns a `Set` of `idx3` values. `legPath(a, tx, ty, within, tz = 0)`. Beings have `z`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/terrain.js`:

```js
/* A little hill by hand on flat ground: a 3 by 3 block of rock at level 0 with a stone floor above it, and one slope on its west side. */
function makeHill(api, x0, y0, withSlope){
  for (let y = y0 - 2; y <= y0 + 4; y++) for (let x = x0 - 2; x <= x0 + 4; x++){ const t = api.tileAt(x, y); t.ground = 'grass'; t.feature = null; t.struct = null; t.fire = 0; t.slope = false; api.levels[api.ZOFF + 1][api.idx(x, y)] = null; }
  for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++){ api.tileAt(x, y).ground = 'rock'; api.placeTile(x, y, 1, 'stone'); }
  if (withSlope) api.tileAt(x0 - 1, y0 + 1).slope = true;
}

test('a slope joins the ground to the floor above, and a cliff does not', () => {
  const api = load(); api.startWorld('r'); const x0 = 100, y0 = 50;
  makeHill(api, x0, y0, true);
  const out = [];
  api.steps(x0 - 1, y0 + 1, 0, out);
  assert.ok(out.join(',').includes(`${x0},${y0 + 1},1`), 'the slope should offer a step up');
  api.steps(x0, y0 + 1, 1, out);
  assert.ok(out.join(',').includes(`${x0 - 1},${y0 + 1},0`), 'the floor above the slope should offer a step down');
  const walker = { x: x0 - 2, y: y0 + 1, z: 0, species: 'human' };
  const up = api.bfs(walker.x, walker.y, 0, (x, y, z) => z === 1 && x === x0 + 1 && y === y0 + 1, 500, walker);
  assert.ok(up, 'no path up the slope');
  assert.deepEqual(up[0], [x0 - 1, y0 + 1, 0]);
  assert.deepEqual(up[1], [x0, y0 + 1, 1]);
  const leg = api.legPath(walker, x0 + 1, y0 + 1, 0, 1);
  assert.ok(leg && leg.length === up.length, 'legPath should climb too');
  api.tileAt(x0 - 1, y0 + 1).slope = false;
  assert.equal(api.bfs(walker.x, walker.y, 0, (x, y, z) => z === 1, 500, walker), null, 'a cliff should block');
  const region = api.reachable(walker.x, walker.y, 0, 200);
  assert.equal(region.has(api.idx3(x0, y0 + 1, 1)), false);
});

test('rabbits never climb, deer do', () => {
  const api = load(); api.startWorld('r'); const x0 = 100, y0 = 50;
  makeHill(api, x0, y0, true);
  const goal = (x, y, z) => z === 1;
  assert.equal(api.bfs(x0 - 2, y0 + 1, 0, goal, 500, { species: 'rabbit' }), null);
  assert.ok(api.bfs(x0 - 2, y0 + 1, 0, goal, 500, { species: 'deer' }));
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/terrain.js`
Expected: the two new tests fail: the stub `steps` offers no step up.

- [ ] **Step 3: Replace the `steps` stub in `src/sim/world.js`**

Delete the stub and add after `nearFind`:

```js
/* The tiles a walker can step to from here: the four beside it, up from a slope to the level above, and down onto a slope beside it. Fills `out` with flat triples. */
function steps(x, y, z, out){
  out.length = 0;
  for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (passable(nx, ny, z)) out.push(nx, ny, z); }
  const t = levels[z + ZOFF][idx(x, y)];
  if (t && t.slope) for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (passable(nx, ny, z + 1)) out.push(nx, ny, z + 1); }
  for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (passable(nx, ny, z - 1) && levels[z - 1 + ZOFF][idx(nx, ny)].slope) out.push(nx, ny, z - 1); }
  return out;
}
```

- [ ] **Step 4: Rewrite `src/sim/path.js`**

```js
/* ---------- path search ---------- */
/* Search runs over all levels. A tile's index is idx3(x, y, z). Neighbours come from steps(): the four beside,
   up from a slope, down onto one. Visited tiles are marked with a generation counter, never cleared. */
const bfsPrev = new Int32Array(NZ * W * H), bfsSeen = new Uint32Array(NZ * W * H); let bfsGen = 0; const bfsOut = [];
const unpack = i => { const z = ((i / (W * H)) | 0) + ZMIN, r = i - (z - ZMIN) * W * H, x = r % W; return [x, (r - x) / W, z]; };
function bfs(sx, sy, sz, goal, maxNodes = 2500, who = null){
  if (goal(sx, sy, sz)) return [];
  const lo = who ? SPECIES[who.species].zmin : ZMIN, hi = who ? SPECIES[who.species].zmax : ZMAX;
  const start = idx3(sx, sy, sz);
  const prev = bfsPrev, seen = bfsSeen, gen = ++bfsGen; prev[start] = start; seen[start] = gen;
  const q = [start]; let head = 0;
  while (head < q.length && head < maxNodes){
    const c = q[head++]; const cz = ((c / (W * H)) | 0) + ZMIN, cr = c - (cz - ZMIN) * W * H, cx = cr % W, cy = (cr - cx) / W;
    const st = steps(cx, cy, cz, bfsOut);
    for (let k = 0; k < st.length; k += 3){
      const nx = st[k], ny = st[k + 1], nz = st[k + 2];
      if (nz < lo || nz > hi) continue;
      const ni = idx3(nx, ny, nz);
      if (seen[ni] === gen) continue;
      seen[ni] = gen; prev[ni] = c;
      if (goal(nx, ny, nz)){ const path = []; let j = ni; while (j !== start){ path.push(unpack(j)); j = prev[j]; } return path.reverse(); }
      q.push(ni);
    }
  }
  return null;
}
function reachable(sx, sy, sz, cap = 4000){
  const s = idx3(sx, sy, sz); const seen = new Set([s]); const q = [s]; const out = [];
  for (let head = 0; head < q.length && head < cap; head++){
    const c = q[head]; const cz = ((c / (W * H)) | 0) + ZMIN, cr = c - (cz - ZMIN) * W * H, cx = cr % W, cy = (cr - cx) / W;
    const st = steps(cx, cy, cz, out);
    for (let k = 0; k < st.length; k += 3){ const ni = idx3(st[k], st[k + 1], st[k + 2]); if (seen.has(ni)) continue; seen.add(ni); q.push(ni); }
  }
  return seen;
}
/* One leg of a long walk. Far targets are approached in steps of about 16 tiles. */
function legPath(a, tx, ty, within, tz = 0){
  if (nearAt(a, tx, ty, tz) <= within) return [];
  const goal = (x, y, z) => z === tz && dist(x, y, tx, ty) <= within;
  let p = bfs(a.x, a.y, a.z, goal, 4000, a);
  if (p) return p;
  /* Far away, or the straight way is blocked. Search the whole world once and walk the first stretch. */
  p = bfs(a.x, a.y, a.z, goal, NZ * W * H, a);
  return p ? p.slice(0, 48) : null;
}
```

The old `bfs` checked `!passable` before marking a tile seen. `steps` already yields only passable tiles, in the same `DIRS` order, so on flat ground the paths are identical.

- [ ] **Step 5: Give beings a z and move them in z, in `src/sim/beings.js`**

In `makeBeing`, change `hue, x, y, hp: 100,` to `hue, x, y, z: 0, hp: 100,`.

In `runTask`, replace:

```js
    const [nx, ny] = t.path[0];
    if (!passable(nx, ny)){ a.cooldown[t.key] = tick + 40; failTask(a); return; }
    a.x = nx; a.y = ny; t.path.shift();
```

with:

```js
    const [nx, ny, nz] = t.path[0];
    if (!passable(nx, ny, nz)){ a.cooldown[t.key] = tick + 40; failTask(a); return; }
    a.x = nx; a.y = ny; a.z = nz; t.path.shift();
```

- [ ] **Step 6: Update every `bfs` call**

Every call gains the walker's `z` after `a.y`, the goal takes `(x, y, z)`, and the walker is passed last. Line numbers are from the current files. Replace exactly:

`src/sim/beings.js`

| Line | Old | New |
|---|---|---|
| 92 | `bfs(a.x, a.y, (x, y) => !!nearFind(x, y, t => t.ground === 'water'), 3000)` | `bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, t => t.ground === 'water', NEAR, z), 3000, a)` |
| 110 | `bfs(a.x, a.y, (x, y) => !!nearFind(x, y, bushy), 400)` | `bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, bushy, NEAR, z), 400, a)` |
| 111 | `bfs(a.x, a.y, (x, y) => !!nearFind(x, y, hasFood), a.species === 'rabbit' ? 200 : 2500)` | `bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, hasFood, NEAR, z), a.species === 'rabbit' ? 200 : 2500, a)` |
| 132 | `bfs(a.x, a.y, (x, y) => { target = others.find(o => dist(o.x, o.y, x, y) <= 1); return !!target; }, 1500)` | `bfs(a.x, a.y, a.z, (x, y, z) => { target = others.find(o => o.z === z && dist(o.x, o.y, x, y) <= 1); return !!target; }, 1500, a)` |
| 161-162 (wander) | `if (!passable(tx, ty)) continue;` and `bfs(a.x, a.y, (x, y) => x === tx && y === ty, 250)` | `if (!passable(tx, ty, a.z)) continue;` and `bfs(a.x, a.y, a.z, (x, y, z) => x === tx && y === ty && z === a.z, 250, a)` |
| 173 (flee) | `if (!passable(tx, ty)) continue;` | `if (!passable(tx, ty, a.z)) continue;` |
| 177 | `bfs(a.x, a.y, (x, y) => x === best.tx && y === best.ty, 250)` | `bfs(a.x, a.y, a.z, (x, y, z) => x === best.tx && y === best.ty && z === a.z, 250, a)` |

`src/sim/fae.js`

| Line | Old | New |
|---|---|---|
| 19 | `bfs(a.x, a.y, (x, y) => dist(x, y, sp.x, sp.y) <= 1, 400)` | `bfs(a.x, a.y, a.z, (x, y, z) => z === sp.z && dist(x, y, sp.x, sp.y) <= 1, 400, a)` |
| 39 | `bfs(a.x, a.y, (x, y) => !!nearFind(x, y, hasFood), 800)` | `bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, hasFood, NEAR, z), 800, a)` |

`src/sim/species.js`

| Line | Old | New |
|---|---|---|
| 41 | `bfs(a.x, a.y, (x, y) => dist(x, y, prey.x, prey.y) <= 1, 400)` | `bfs(a.x, a.y, a.z, (x, y, z) => z === prey.z && dist(x, y, prey.x, prey.y) <= 1, 400, a)` |
| 68 | `bfs(a.x, a.y, (x, y) => dist(x, y, h.x, h.y) <= 1, 500)` | `bfs(a.x, a.y, a.z, (x, y, z) => z === h.z && dist(x, y, h.x, h.y) <= 1, 500, a)` |
| 75 | `bfs(a.x, a.y, (x, y) => dist(x, y, kin.x, kin.y) <= 3, 600)` | `bfs(a.x, a.y, a.z, (x, y, z) => z === kin.z && dist(x, y, kin.x, kin.y) <= 3, 600, a)` |
| 79 | `bfs(a.x, a.y, (x, y) => { const it = itemGrid[idx(x, y)]; if (it && ...` | `bfs(a.x, a.y, a.z, (x, y, z) => { const it = itemAt(x, y, z); if (it && ...` and the call's last arguments `500)` become `500, a)` |

`src/sim/tasks.js`

| Line | Old | New |
|---|---|---|
| 3 | `bfs(a.x, a.y, (x, y) => !!nearFind(x, y, t => t.fire > 0, DIRS), 3500)` | `bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, t => t.fire > 0, DIRS, z), 3500, a)` |
| 55 | `bfs(a.x, a.y, (x, y) => { const it = itemGrid[idx(x, y)]; ... }, 2500)` | `bfs(a.x, a.y, a.z, (x, y, z) => { const it = itemAt(x, y, z); ... }, 2500, a)` |
| 74 | `bfs(a.x, a.y, (x, y) => { const j = itemGrid[idx(x, y)]; ... }, 300)` | `bfs(a.x, a.y, a.z, (x, y, z) => { const j = itemAt(x, y, z); ... }, 300, a)` |
| 85 | `bfs(a.x, a.y, (x, y) => !!nearFind(x, y, hasFood), 2500)` | `bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, hasFood, NEAR, z), 2500, a)` |
| 134 | `bfs(a.x, a.y, (x, y) => dist(x, y, d.x, d.y) <= 2, 700)` | `bfs(a.x, a.y, a.z, (x, y, z) => z === d.z && dist(x, y, d.x, d.y) <= 2, 700, a)` |
| 147 | `bfs(a.x, a.y, (x, y) => dist(x, y, w.x, w.y) <= 2, 500)` | `bfs(a.x, a.y, a.z, (x, y, z) => z === w.z && dist(x, y, w.x, w.y) <= 2, 500, a)` |
| 156 | `bfs(a.x, a.y, (x, y) => { for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (inb(nx, ny)){ const t = tileAt(nx, ny); if (t.feature === 'tree' ...` and `}, 2500)` | `bfs(a.x, a.y, a.z, (x, y, z) => { for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (hasTile(nx, ny, z)){ const t = tileAt(nx, ny, z); if (t.feature === 'tree' ...` and `}, 2500, a)` |
| 174 | `bfs(a.x, a.y, (x, y) => !!nearFind(x, y, t => t.ground === 'water'), 3000)` | `bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, t => t.ground === 'water', NEAR, z), 3000, a)` |

Check with: `grep -n "bfs(a.x, a.y, (" src/sim/*.js` — expected: no output.

- [ ] **Step 7: Update `reachable` calls and region lookups in `src/sim/camps.js`**

| Line | Old | New |
|---|---|---|
| 31 | `region = reachable(a.x, a.y, 3000)` | `region = reachable(a.x, a.y, a.z, 3000)` |
| 33 | `if (!region.has(idx(x, y)) \|\| t.feature) continue;` | `if (!region.has(idx3(x, y, 0)) \|\| t.feature) continue;` |
| 86 | `reachable(camp.site[0], camp.site[1], W * H)` | `reachable(camp.site[0], camp.site[1], 0, NZ * W * H)` |
| 87 | `region.has(idx(...secCenter(s)))` | `region.has(idx3(...secCenter(s), 0))` |
| 156 | `reachable(camp.site[0], camp.site[1], W * H)` | `reachable(camp.site[0], camp.site[1], 0, NZ * W * H)` |
| 157 | `edges.push(idx(x, 0), idx(x, H - 1))` and `edges.push(idx(0, y), idx(W - 1, y))` | `edges.push(idx3(x, 0, 0), idx3(x, H - 1, 0))` and `edges.push(idx3(0, y, 0), idx3(W - 1, y, 0))` |
| 160 | `const i = ok[rint(ok.length)], x = i % W, y = (i - x) / W;` | `const i = ok[rint(ok.length)] - ZOFF * W * H, x = i % W, y = (i - x) / W;` |

- [ ] **Step 8: Make the cut-off check three-dimensional in `tests/lib/run.js`**

Replace the two lines inside `cutOff`:

```js
    const region = api.reachable(c.stashTile[0], c.stashTile[1], 0, api.levels.length * api.world.length);
    for (const h of api.beings) if (h.alive && h.species === 'human' && h.camp === c && !region.has(api.idx3(h.x, h.y, h.z))) out.push(`${h.name} at ${h.x},${h.y},${h.z} on day ${api.dayOf()}, ${api.seasonOf()}, cut off from ${c.name}`);
```

- [ ] **Step 9: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 5 pass.

- [ ] **Step 10: Run the full soak and confirm the golden record still matches**

Run: `node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,"`
Expected: `ℹ pass 44`, `ℹ fail 0`. Note the per-seed times in the `ms` lines. If any seed is over 25000 ms, profile `steps` before going on: the likely cost is the `passable` calls for the level below, and the fix is to test `levels[z - 1 + ZOFF][idx(nx, ny)]` for a non-null entry before calling `passable`.

- [ ] **Step 11: Commit**

```bash
git add src/sim tests/lib/run.js tests/terrain.js
git commit -m "Path search over levels: steps(), bfs and reachable by idx3, beings carry z

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Distances between beings count levels

**Files:**
- Modify: `src/sim/beings.js`, `src/sim/fae.js`, `src/sim/goals.js`, `src/sim/tasks.js`, `src/sim/species.js`, `src/sim/camps.js`, `src/sim/index.js`

**Interfaces:**
- Consumes: `near(a, b)`, `nearAt(a, x, y, z = 0)` from Task 1.

The rule: a `dist` between two beings becomes `near`. A `dist` between a being and a spot on the ground becomes `nearAt`. A `dist` between two tiles, two spots, or a tile and a spot stays `dist`. On flat ground every `near` equals the old `dist`, so the golden record must still match.

- [ ] **Step 1: Write the failing test**

Append to `tests/terrain.js`:

```js
test('a wolf on a hilltop is not near a person below it', () => {
  const api = load(); api.startWorld('r'); const x0 = 100, y0 = 50;
  makeHill(api, x0, y0, false);
  const wolf = api.beings.find(b => b.species === 'wolf'); wolf.x = x0 + 1; wolf.y = y0 + 1; wolf.z = 1; wolf.needs.food = 10;
  const person = api.beings[0]; person.x = x0 + 1; person.y = y0 + 3; person.z = 0;
  assert.equal(api.near(wolf, person), 8);
  const threats = api.threatsFor(person);
  assert.equal(threats.some(([x, y]) => x === wolf.x && y === wolf.y), false, 'a wolf one level up should not be a threat at three tiles');
});
```

Add `threatsFor,` to the API list in `src/sim/index.js` after `mood,`.

- [ ] **Step 2: Run the test to see it fail**

Run: `node tests/terrain.js`
Expected: the new test fails: the wolf is listed as a threat because `threatsFor` still uses `dist`.

- [ ] **Step 3: Replace the calls**

Line numbers are from the current files. Replace exactly. Where a line holds several calls, replace each.

`src/sim/beings.js`

| Line | Old | New |
|---|---|---|
| 66 | `dist(h.x, h.y, a.x, a.y) <= 12` | `near(h, a) <= 12` |
| 69 | `dist(o.x, o.y, a.x, a.y) <= 10` | `near(o, a) <= 10` |
| 90 | `dist(a.x, a.y, sx, sy) > 1` | `nearAt(a, sx, sy) > 1` |
| 100 | `dist(a.x, a.y, sx, sy) > 1` | `nearAt(a, sx, sy) > 1` |
| 122 | `dist(b.x, b.y, ...pl) <= 1` | `nearAt(b, ...pl) <= 1` |
| 122 | `dist(a.x, a.y, ...p) - dist(a.x, a.y, ...q)` | `nearAt(a, ...p) - nearAt(a, ...q)` |
| 123 | `dist(a.x, a.y, ...place) > 1` | `nearAt(a, ...place) > 1` |
| 134 | `dist(target.x, target.y, a.x, a.y) > 2` | `near(target, a) > 2` |
| 139 | `dist(a.x, a.y, hx, hy) > 1` | `nearAt(a, hx, hy) > 1` |
| 147 | `dist(a.x, a.y, px, py) > 1` | `nearAt(a, px, py) > 1` |
| 149 | `dist(o.x, o.y, a.x, a.y) <= 2` | `near(o, a) <= 2` |
| 152 | `dist(o.x, o.y, a.x, a.y) <= 2` | `near(o, a) <= 2` |
| 187 | `dist(b.x, b.y, a.x, a.y)` | `near(b, a)` |
| 188 | `dist(b.x, b.y, a.x, a.y)` | `near(b, a)` |
| 191 | `dist(b.x, b.y, a.x, a.y) <= (ember(b) ? 7 : r)` | `near(b, a) <= (ember(b) ? 7 : r)` |
| 192 | `dist(a.x, a.y, ...c.pit) <= (a.species === 'fox' ? 6 : 8)` and `dist(a.x, a.y, ...c.pit) <= 20` | `nearAt(a, ...c.pit) <= (a.species === 'fox' ? 6 : 8)` and `nearAt(a, ...c.pit) <= 20` |
| 194 | `dist(b.x, b.y, a.x, a.y) <= 3` | `near(b, a) <= 3` |
| 196 | `dist(b.x, b.y, a.x, a.y) <= 5 + timid` | `near(b, a) <= 5 + timid` |
| 197 | `dist(a.x, a.y, ...c.pit) <= 9` | `nearAt(a, ...c.pit) <= 9` |
| 225 | `dist(a.x, a.y, a.grove.x, a.grove.y)` | `nearAt(a, a.grove.x, a.grove.y)` |
| 281 | `dist(a.x, a.y, ...camp.pit) <= 3` and `dist(a.x, a.y, ...pl) <= 1` | `nearAt(a, ...camp.pit) <= 3` and `nearAt(a, ...pl) <= 1` |
| 293 | `dist(a.x, a.y, ...camp.pit) <= 4` | `nearAt(a, ...camp.pit) <= 4` |
| 299 | `dist(a.x, a.y, ...camp.pit) <= 3` | `nearAt(a, ...camp.pit) <= 3` |
| 301 | `dist(a.x, a.y, ...pl) <= 1` and `dist(a.x, a.y, ...camp.pit) <= 4` | `nearAt(a, ...pl) <= 1` and `nearAt(a, ...camp.pit) <= 4` |

`src/sim/fae.js`

| Line | Old | New |
|---|---|---|
| 2 | `dist(b.x, b.y, ...camp.pit) <= 8` and `dist(p.x, p.y, ...camp.pit) - dist(q.x, q.y, ...camp.pit)` | `nearAt(b, ...camp.pit) <= 8` and `nearAt(p, ...camp.pit) - nearAt(q, ...camp.pit)` |
| 7 | `dist(sp.x, sp.y, a.x, a.y) > 14` | `near(sp, a) > 14` |
| 8 | `dist(a.x, a.y, sp.x, sp.y) <= 1` | `near(a, sp) <= 1` |
| 30 | `dist(a.x, a.y, g.x, g.y) > 2` | `nearAt(a, g.x, g.y) > 2` |
| 32 | `dist(h.x, h.y, a.x, a.y) <= 7` | `near(h, a) <= 7` |
| 33 | `dist(o.x, o.y, a.x, a.y) <= 3` | `near(o, a) <= 3` |
| 47 | `dist(a.x, a.y, ...c.pit) > r` | `nearAt(a, ...c.pit) > r` |
| 49 | `dist(h.x, h.y, a.x, a.y) <= 7` | `near(h, a) <= 7` |
| 57 | `dist(a.x, a.y, ...c.stone) > 1` | `nearAt(a, ...c.stone) > 1` |
| 68 | `dist(a.x, a.y, ...c.stashTile) > 1` | `nearAt(a, ...c.stashTile) > 1` |

`src/sim/goals.js`

| Line | Old | New |
|---|---|---|
| 155 | `dist(sp.x, sp.y, ...camp.pit)` | `nearAt(sp, ...camp.pit)` |
| 171 | `dist(d.x, d.y, ...camp.site)` | `nearAt(d, ...camp.site)` |
| 181 | `dist(w.x, w.y, ...camp.pit)` | `nearAt(w, ...camp.pit)` |

`src/sim/tasks.js`

| Line | Old | New |
|---|---|---|
| 13 | `dist(a.x, a.y, px, py) > 1` | `nearAt(a, px, py) > 1` |
| 32 | `dist(a.x, a.y, at[0], at[1]) > 1` | `nearAt(a, at[0], at[1]) > 1` |
| 46 | `dist(a.x, a.y, sx, sy) > 1` | `nearAt(a, sx, sy) > 1` |
| 62 | `dist(a.x, a.y, cx, cy) > 6` | `nearAt(a, cx, cy) > 6` |
| 87 | `dist(a.x, a.y, cx, cy) > 6` | `nearAt(a, cx, cy) > 6` |
| 109 | `dist(b.x, b.y, x, y) <= 12` | `nearAt(b, x, y) <= 12` |
| 123 | `dist(b.x, b.y, ...camp.site) <= 34` and `dist(p.x, p.y, ...camp.site) - dist(q.x, q.y, ...camp.site)` | `nearAt(b, ...camp.site) <= 34` and `nearAt(p, ...camp.site) - nearAt(q, ...camp.site)` |
| 129 | `dist(a.x, a.y, d.x, d.y) <= 2` | `near(a, d) <= 2` |
| 134 | `t.fast = dist(a.x, a.y, d.x, d.y) <= 8` | `t.fast = near(a, d) <= 8` |
| 139 | `dist(b.x, b.y, ...camp.pit) <= 11` and `dist(p.x, p.y, ...camp.pit) - dist(q.x, q.y, ...camp.pit)` | `nearAt(b, ...camp.pit) <= 11` and `nearAt(p, ...camp.pit) - nearAt(q, ...camp.pit)` |
| 144 | `dist(a.x, a.y, px, py) > 1` | `nearAt(a, px, py) > 1` |
| 145 | `dist(w.x, w.y, ...camp.pit) > 22` (twice) | `nearAt(w, ...camp.pit) > 22` (twice) |
| 146 | `dist(a.x, a.y, w.x, w.y) <= 2` | `near(a, w) <= 2` |

`src/sim/species.js`

| Line | Old | New |
|---|---|---|
| 28 | `dist(b.x, b.y, a.x, a.y) <= (a.species === 'wolf' ? 50 : 40)` | `near(b, a) <= (a.species === 'wolf' ? 50 : 40)` |
| 29 | `(dist(p.x, p.y, a.x, a.y) - ...) - (dist(q.x, q.y, a.x, a.y) - ...)` | `(near(p, a) - ...) - (near(q, a) - ...)` |
| 31 | `dist(a.x, a.y, prey.x, prey.y) > 9` | `near(a, prey) > 9` |
| 37 | `dist(a.x, a.y, prey.x, prey.y) <= 4` | `near(a, prey) <= 4` |
| 38 | `dist(a.x, a.y, prey.x, prey.y) <= 1` | `near(a, prey) <= 1` |
| 52 | `dist(a.x, a.y, sx, sy) > 1` | `nearAt(a, sx, sy) > 1` |
| 62 | `dist(o.x, o.y, h.x, h.y) <= 5`, `dist(h.x, h.y, ...h.camp.pit) <= 8`, `dist(h.x, h.y, a.x, a.y) <= 30` | `near(o, h) <= 5`, `nearAt(h, ...h.camp.pit) <= 8`, `near(h, a) <= 30` |
| 63 | `dist(p.x, p.y, a.x, a.y) - dist(q.x, q.y, a.x, a.y)` | `near(p, a) - near(q, a)` |
| 67 | `dist(a.x, a.y, h.x, h.y) <= 1` | `near(a, h) <= 1` |
| 73 | `dist(b.x, b.y, a.x, a.y) <= 30` and `dist(p.x, p.y, a.x, a.y) - dist(q.x, q.y, a.x, a.y)` | `near(b, a) <= 30` and `near(p, a) - near(q, a)` |
| 74 | `dist(kin.x, kin.y, a.x, a.y) <= 4` | `near(kin, a) <= 4` |
| 90 | `dist(o.x, o.y, r.x, r.y) <= 10` | `near(o, r) <= 10` |
| 95, 99, 102, 105 | `dist(h.x, h.y, t.x, t.y) < N` | `nearAt(h, t.x, t.y) < N` |

`src/sim/camps.js`

| Line | Old | New |
|---|---|---|
| 116 | `dist(a.x, a.y, cx, cy) > within` | `nearAt(a, cx, cy) > within` |

Leave these as `dist`, they compare tiles or spots: `beings.js` 132 (inside the search goal), 173 (flee spots); `camps.js` 50, 69, 89; `fae.js` 19 and 34; `goals.js` 51; `tasks.js` 74, 105, 108, 156; `species.js` 41, 68, 75.

Check with: `grep -n "dist([a-z]*\.x, [a-z]*\.y, [a-z]*\.x, [a-z]*\.y)" src/sim/*.js` — expected: nothing but `camps.js:50`. Anything else is a miss.

- [ ] **Step 4: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 6 pass.

- [ ] **Step 5: Run the full soak and confirm the golden record still matches**

Run: `node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"`
Expected: `ℹ pass 44`, `ℹ fail 0`. A mismatch means a `dist` with a different meaning was changed, or one between beings was missed. Find it with the grep above and the diff of counts the test prints.

- [ ] **Step 6: Commit**

```bash
git add src/sim tests/terrain.js
git commit -m "Distances between beings count levels

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Fire on every level

**Files:**
- Modify: `src/sim/weather.js` (`spreadFire`, `burnOut`)
- Modify: `src/sim/world.js` (`nearestFire`)
- Modify: `src/sim/beings.js` (`threatsFor`, `updateBeing`, `checkSnare`)
- Modify: `src/sim/main.js` (`lightTile`)
- Test: `tests/terrain.js`

**Interfaces:**
- Produces: `nearestFire(x, y, r, z = 0)`, `lightTile(x, y, z = 0)`, `burnTile(t)`, `spreadTo(nx, ny, nz, mult)`.

- [ ] **Step 1: Write the failing test**

Append to `tests/terrain.js`:

```js
test('fire on a hilltop burns and is seen from the hilltop, not from below', () => {
  const api = load(); api.startWorld('r'); const x0 = 100, y0 = 50;
  makeHill(api, x0, y0, true);
  const top = api.tileAt(x0 + 1, y0 + 1, 1); top.ground = 'grass';
  assert.equal(api.lightTile(x0 + 1, y0 + 1, 1), 'The ground is burning. This fire is not contained.');
  assert.ok(top.fire > 0);
  assert.equal(api.nearestFire(x0 + 1, y0 + 2, 2, 1), 1);
  assert.equal(api.nearestFire(x0 + 1, y0 + 4, 3, 0), -1, 'a fire one level up is not on this level');
  const before = top.fire; api.step();
  assert.ok(top.fire < before, 'the hilltop fire should burn down each tick');
  assert.equal(api.lightTile(x0 + 1, y0 + 1, 2), 'Nothing here but air.');
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `node tests/terrain.js`
Expected: the new test fails at `lightTile` with z, which today ignores the level and lights the surface tile.

- [ ] **Step 3: Make `nearestFire` read a level, in `src/sim/world.js`**

Replace `nearestFire` with:

```js
function nearestFire(x, y, r, z = 0){
  if (fireCount <= 0) return -1;
  let best = -1;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
    const nx = x + dx, ny = y + dy; if (!hasTile(nx, ny, z)) continue;
    const t = levels[z + ZOFF][idx(nx, ny)]; if (t.fire <= 0) continue;
    const d = Math.abs(dx) + Math.abs(dy); if (d <= r && (best < 0 || d < best)) best = d;
  }
  return best;
}
```

- [ ] **Step 4: Spread fire on every level and across slopes, in `src/sim/weather.js`**

Replace `spreadFire` with:

```js
/* Fire spreads to neighbours and burns down. Rain slows it. Surface tiles first, then the tiles off the surface. */
function spreadFire(){
  let count = 0;
  for (const t of world) if (t.fire > 0){ count++; burnTile(t); }
  for (const t of raised) if (t.fire > 0){ count++; burnTile(t); }
  fireCount = count;
}
/* One burning tile: spread to the four beside it, up from a slope, and down onto a slope. Uphill is 1.5 times as likely. */
function burnTile(t){
  t.fire--;
  for (const [dx, dy] of DIRS) spreadTo(t.x + dx, t.y + dy, t.z, 1);
  if (t.slope) for (const [dx, dy] of DIRS) spreadTo(t.x + dx, t.y + dy, t.z + 1, 1.5);
  for (const [dx, dy] of DIRS){ const nx = t.x + dx, ny = t.y + dy; if (hasTile(nx, ny, t.z - 1) && tileAt(nx, ny, t.z - 1).slope) spreadTo(nx, ny, t.z - 1, 1); }
  if (weather.storm) t.fire -= 2;
  if (t.fire <= 0) burnOut(t);
}
function spreadTo(nx, ny, nz, mult){
  if (!hasTile(nx, ny, nz)) return; const nb = tileAt(nx, ny, nz); if (nb.fire > 0) return;
  const f = tileFlam(nb); if (f > 0 && rng() < f * (weather.storm ? 0.012 : 0.08) * mult) ignite(nb);
}
```

In `burnOut`, replace `items.filter(i => i.x !== t.x || i.y !== t.y || MATERIALS[...` with `items.filter(i => i.x !== t.x || i.y !== t.y || i.z !== t.z || MATERIALS[...`.

The old loop called `rng()` once per flammable neighbour in `DIRS` order and nothing else. `burnTile` does the same on flat ground, so the golden record holds.

- [ ] **Step 5: Read fire on the being's level, in `src/sim/beings.js`**

In `threatsFor`, replace:

```js
  const f = nearestFire(a.x, a.y, 4); if (f >= 0) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (inb(a.x + dx, a.y + dy) && world[idx(a.x + dx, a.y + dy)].fire > 0) out.push([a.x + dx, a.y + dy]);
```

with:

```js
  const f = nearestFire(a.x, a.y, 4, a.z); if (f >= 0) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (hasTile(a.x + dx, a.y + dy, a.z) && tileAt(a.x + dx, a.y + dy, a.z).fire > 0) out.push([a.x + dx, a.y + dy]);
```

In `updateBeing`, replace `const here = tileAt(a.x, a.y);` with `const here = tileAt(a.x, a.y, a.z);` and `const d = nearestFire(a.x, a.y, 5);` with `const d = nearestFire(a.x, a.y, 5, a.z);`.

In `checkSnare`, replace `const t = tileAt(r.x, r.y);` with `const t = tileAt(r.x, r.y, r.z);`.

- [ ] **Step 6: Light a tile on a level, in `src/sim/main.js`**

Replace the first two lines of `lightTile` with:

```js
function lightTile(x, y, z = 0){
  const t = hasTile(x, y, z) ? tileAt(x, y, z) : null;
  if (!t) return 'Nothing here but air.';
```

- [ ] **Step 7: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 7 pass.

- [ ] **Step 8: Run the full soak and confirm the golden record still matches**

Run: `node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"`
Expected: `ℹ pass 44`, `ℹ fail 0`.

- [ ] **Step 9: Commit**

```bash
git add src/sim tests/terrain.js
git commit -m "Fire burns on every level and runs uphill over slopes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Uplift: hills at world start

**Files:**
- Modify: `src/sim/world.js` (add the uplift block before `generate`, call it inside `generate`)
- Modify: `tests/soak-golden.json` (re-blessed)
- Test: `tests/terrain.js`

**Interfaces:**
- Consumes: `placeTile`, `passable`, `tileAt`, `makeNoise`, `shuffle`, `rint`, `rng`, `secOf`.
- Produces: `uplift()`, `hills` entries `{ x, y, r, storeys, tiles }` where `tiles` are level-0 indices of the footprint; every hill tile on every level has `t.hill` pointing at its record; slope tiles have `slope = true`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/terrain.js`:

```js
for (const seed of ['r', 'x', 'alpha', 'beta', 'gamma', 'delta']) test(`seed ${seed}: the hills are sound`, () => {
  const api = load(); api.startWorld(seed);
  assert.ok(api.hills.length >= 6 && api.hills.length <= 10, `${api.hills.length} hills`);
  const start = { sx: 5, sy: 3 };
  const full = api.levels.length * api.world.length;
  const slopes = []; for (const t of api.world) if (t.slope) slopes.push(t); for (const t of api.raised) if (t.slope) slopes.push(t);
  const out = [];
  for (const s of slopes){ api.steps(s.x, s.y, s.z, out); assert.ok(out.some((v, k) => k % 3 === 2 && v === s.z + 1), `slope at ${s.x},${s.y},${s.z} leads nowhere`); }
  for (const h of api.hills){
    const floors = api.raised.filter(t => t.hill === h && api.GROUND[t.ground].walk);
    assert.ok(floors.length > 0, `hill at ${h.x},${h.y} has no floor`);
    assert.ok(floors.some(t => t.z === h.storeys), `hill at ${h.x},${h.y} should reach level ${h.storeys}`);
    for (const i of h.tiles){
      const t = api.world[i];
      assert.equal(t.ground, 'rock', `hill at ${h.x},${h.y}: footprint tile ${t.x},${t.y} is ${t.ground}`);
      const s = api.secOf(t.x, t.y); assert.ok(!(s.sx === start.sx && s.sy === start.sy), 'a hill in the start sector');
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++){ const q = api.tileAt(Math.min(279, Math.max(0, t.x + dx)), Math.min(119, Math.max(0, t.y + dy))); assert.notEqual(q.ground, 'water', `hill at ${h.x},${h.y} touches water`); }
    }
    const base = slopes.find(s => s.z === 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const u = api.tileAt(s.x + dx, s.y + dy, 1); return u && u.hill === h; }));
    assert.ok(base, `hill at ${h.x},${h.y} has no slope up from the ground`);
    const region = api.reachable(base.x, base.y, 0, full);
    for (const t of floors) assert.ok(region.has(api.idx3(t.x, t.y, t.z)), `hill at ${h.x},${h.y}: floor ${t.x},${t.y},${t.z} cannot be reached`);
  }
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/terrain.js`
Expected: six failures, `0 hills`.

- [ ] **Step 3: Add uplift to `src/sim/world.js` before `generate`**

```js
/* ---------- uplift: hills ---------- */
/* Six to ten hills on rocky and forest ground, never on the river, never in the start sector. A hill is rock at
   level 0 with a floor above it. A tall hill has a second storey: the footprint eroded inward by 2, rock at
   level 1 with a floor at level 2. Each storey gets one or two slopes on its rim. The rest of the rim is cliff. */
function uplift(){
  const start = { sx: SW >> 1, sy: SH >> 1 };
  const cands = shuffle(sectors.filter(s => (s.biome === 'rocky' || s.biome === 'forest') && !(s.sx === start.sx && s.sy === start.sy)));
  const want = 6 + rint(5), jit = makeNoise(6);
  for (const s of cands){
    if (hills.length >= want) break;
    for (let tries = 0; tries < 12; tries++){
      const r = 3 + rint(12), ry = Math.max(3, Math.round(r * (0.6 + rng() * 0.4)));
      const cx = s.sx * LW + r + rint(Math.max(1, LW - 2 * r)), cy = s.sy * LH + ry + rint(Math.max(1, LH - 2 * ry));
      let foot = [];
      for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - r; x <= cx + r; x++){
        if (!inb(x, y)) continue;
        const e = ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 + (jit(x, y) - 0.5) * 0.5;
        if (e <= 1) foot.push(idx(x, y));
      }
      if (!foot.includes(idx(cx, cy))) continue;
      foot = component(foot, idx(cx, cy));
      if (foot.length < 12 || !hillFits(foot, start)) continue;
      const h = { x: cx, y: cy, r, storeys: r >= 8 ? 2 : 1, tiles: foot };
      raiseHill(h); hills.push(h); break;
    }
  }
}
/* The tiles of `list` joined to `seed` by four-way steps within the list. */
function component(list, seed){
  const set = new Set(list), seen = new Set([seed]), q = [seed];
  for (let head = 0; head < q.length; head++){ const i = q[head], x = i % W, y = (i - x) / W;
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (set.has(j) && !seen.has(j)){ seen.add(j); q.push(j); } } }
  return [...seen];
}
/* A footprint fits if it stays off the map edge, out of the start sector, off other hills, and three tiles from any water or riverbank. */
function hillFits(foot, start){
  const set = new Set(foot);
  for (const i of foot){
    const x = i % W, y = (i - x) / W;
    const sc = secOf(x, y); if (sc.sx === start.sx && sc.sy === start.sy) return false;
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return false;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++){
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const q = world[idx(nx, ny)];
      if (q.ground === 'water' || q.ground === 'sand' || (q.hill && !set.has(idx(nx, ny)))) return false;
    }
  }
  return true;
}
/* A tile is inside the shape eroded by d if every tile within d of it is in the set. */
function erodedBy(i, set, d){ const x = i % W, y = (i - x) / W; for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (Math.abs(dx) + Math.abs(dy) <= d && !set.has(idx(x + dx, y + dy))) return false; return true; }
function raiseHill(h){
  const set = new Set(h.tiles);
  let inner = h.storeys === 2 ? h.tiles.filter(i => erodedBy(i, set, 2)) : [];
  if (inner.length){ inner = component(inner, inner[0]); if (inner.length < 4){ inner = []; h.storeys = 1; } }
  const innerSet = new Set(inner);
  for (const i of h.tiles){ const t = world[i]; t.ground = 'rock'; t.feature = null; t.berries = 0; t.loose = null; t.hill = h; }
  for (const i of h.tiles){ const x = i % W, y = (i - x) / W; const t = placeTile(x, y, 1, innerSet.has(i) ? 'rock' : (rng() < 0.5 ? 'grass' : 'stone')); t.hill = h; }
  for (const i of inner){ const x = i % W, y = (i - x) / W; const t = placeTile(x, y, 2, rng() < 0.5 ? 'grass' : 'stone'); t.hill = h; }
  cutSlopes(h, 0, i => !set.has(i), i => set.has(i) && !innerSet.has(i));
  if (inner.length) cutSlopes(h, 1, i => set.has(i) && !innerSet.has(i), i => innerSet.has(i));
}
/* One or two slopes on level z at a rim: a walkable low tile beside a high tile whose floor is one level up. Slopes sit at least six tiles apart. */
function cutSlopes(h, z, isLow, isHigh){
  const rim = [];
  for (const i of h.tiles){ const x = i % W, y = (i - x) / W; if (!isHigh(i)) continue;
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny);
      if (isLow(j) && passable(nx, ny, z) && !tileAt(nx, ny, z).slope) rim.push([nx, ny]); } }
  if (!rim.length) return;
  const want = 1 + rint(2), picked = [];
  for (let k = 0; k < 40 && picked.length < want; k++){ const [x, y] = rim[rint(rim.length)]; if (picked.every(([px, py]) => dist(px, py, x, y) >= 6)){ const t = tileAt(x, y, z); t.slope = true; t.feature = null; picked.push([x, y]); } }
}
```

In `generate()`, after the tile loop ends (the line `if (loose) t.loose = loose; }` and its closing brace) and before `items = []; ...`, add:

```js
  uplift();
```

Note the ordering: rock tiles drop their `loose` before items are made, and trees under rock are gone before the groves are chosen.

- [ ] **Step 4: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 13 pass. If a hill's floor is unreachable, the usual cause is a slope whose high tile is in `innerSet` (rock at level 1); the `isHigh` for level 0 excludes it, so check `cutSlopes` was pasted whole.

- [ ] **Step 5: Run the soak, read the numbers, and bless the golden record**

Run: `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"`
Expected: `ℹ fail 0`, every seed's story changes (hills change generation), each seed under 25000 ms, no death that is not old age, nobody cut off. Read each seed's counts line against the previous golden values in `git show HEAD:tests/soak-golden.json`. Numbers should move a little, not collapse: if `alive` falls or `caught` goes to zero on every seed, hills are pinching the meadows, and `hillFits` needs a larger margin.

- [ ] **Step 6: Commit**

```bash
git add src/sim/world.js tests/terrain.js tests/soak-golden.json
git commit -m "Uplift: six to ten hills of rock with floors above and slopes on their rims

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The level view

**Files:**
- Modify: `src/page.template.html` (palette, toolbar, legend)
- Modify: `src/ui.js` (state, palette, drawing, tile card, tools, level control, keys, follow)
- Modify: `tests/browser-shot.py`

**Interfaces:**
- Consumes: `levels`, `raised`, `hills`, `tileAt`, `hasTile`, `passable`, `itemAt`, `lightTile(x, y, z)`, `ZMIN`, `ZMAX`, `ZOFF`, `GROUND[g].walk`.
- Produces: UI state `lvl`; `setLevel(z)`; `cellFrom(e)` returns `{ lx, ly, x, y, z }`; `inspectTile(x, y, z)`.

- [ ] **Step 1: Palette, toolbar, and legend in `src/page.template.html`**

In the light `:root` block, after `--map-grid:rgba(27,38,49,.35);` add:

```
--map-hill:#a9a297; --map-hill-fg:#6f685d; --map-stone:#d3cec4; --map-stone-fg:#9a9388;
```

In both dark blocks, after `--map-grid:rgba(227,233,237,.3);` add:

```
--map-hill:#3a3630; --map-hill-fg:#6b6458; --map-stone:#4a4640; --map-stone-fg:#7a736a;
```

In the toolbar, after the `#nav` span, add:

```html
<span class="group" id="levels"><button class="btn" id="lvDown" title="Down a level">▽<kbd>[</kbd></button><span id="level" class="muted"></span><button class="btn" id="lvUp" title="Up a level">△<kbd>]</kbd></button></span>
```

In the legend, after `<span><b>#</b>boulder</span>`, add:

```html
<span><b>▒</b>rock</span><span><b>·</b>stone floor</span><span><b>◢</b>slope</span>
```

- [ ] **Step 2: State, palette, and level control in `src/ui.js`**

After `let viewCamp = null;` add `let lvl = 0;`.

In `readPalette`, add `'hill','hill-fg','stone','stone-fg'` to the list of names.

After `setPaused`, add:

```js
function setLevel(z){ lvl = clamp(z, ZMIN, ZMAX); hideTip(); hover = null; renderUI(true); }
const levelName = z => z === 0 ? 'Surface' : z > 0 ? `Level +${z}` : `Level ${z}`;
```

In `renderUI`, after `$('nav').hidden = view === 'world';` add:

```js
  $('levels').hidden = view === 'world';
  $('level').textContent = levelName(lvl); $('lvUp').disabled = lvl >= ZMAX; $('lvDown').disabled = lvl <= ZMIN;
```

In `initUI`, after the `$('nS').onclick` line, add:

```js
  $('lvUp').onclick = () => setLevel(lvl + 1); $('lvDown').onclick = () => setLevel(lvl - 1);
```

In the keydown handler, before the `TOOLS.find` line, add:

```js
    if (view === 'loc' && e.key === ']'){ setLevel(lvl + 1); return; }
    if (view === 'loc' && e.key === '['){ setLevel(lvl - 1); return; }
```

In `frame`, replace the follow line with:

```js
  if (followId){ const a = beingById(followId); if (a && a.alive){ const s = secOf(a.x, a.y); if (view !== 'loc' || s.sx !== cur.sx || s.sy !== cur.sy) setView('loc', s); if (a.z !== lvl) setLevel(a.z); } else followId = null; }
```

In `newWorld`, add `lvl = 0;` after `followId = null;`.

- [ ] **Step 3: Draw one level in `drawLoc`**

Replace the cell loop body of `drawLoc` (from `const x = ox + lx, y = oy + ly, t = world[idx(x, y)], ...` through the `else if (g){ ctx.fillStyle = fg; ... }` line) with:

```js
    const x = ox + lx, y = oy + ly, px = lx * T, py = ly * T, h = hash(x, y);
    let t = tileAt(x, y, lvl), below = 0;
    while (!t && lvl - below > 0){ below++; t = tileAt(x, y, lvl - below); }
    if (!t){ ctx.fillStyle = P.hill; ctx.fillRect(px, py, T, T); if (h % 3 === 0){ ctx.fillStyle = P['hill-fg']; ctx.fillText('▒', px + T / 2, py + T / 2 + 1); } continue; }
    let bg = P[t.ground] || P.stone, g = null, fg = null;
    if (t.ground === 'grass' && h % 4 === 0){ g = '"'; fg = P['grass-fg']; }
    if (t.ground === 'ash' && h % 2 === 0){ g = ','; fg = P['ash-fg']; }
    if (t.ground === 'water'){ g = (h + Math.floor(tick / 25)) % 4 === 0 ? '≈' : '~'; fg = P['water-fg']; }
    if (t.ground === 'rock'){ bg = P.hill; if (h % 3 === 0){ g = '▒'; fg = P['hill-fg']; } }
    if (t.ground === 'stone'){ bg = P.stone; if (h % 5 === 0){ g = '·'; fg = P['stone-fg']; } }
    if (t.feature === 'tree'){ g = '♣'; fg = P.tree; } else if (t.feature === 'sapling'){ g = 'ʌ'; fg = P.tree; } else if (t.feature === 'hollow'){ g = '♠'; fg = P.sprite; } else if (t.feature === 'bush'){ g = '*'; fg = t.berries > 0 ? P.berry : P.bush; }
    else if (t.feature === 'boulder'){ bg = P.boulder; g = '#'; fg = P['boulder-fg']; } else if (t.feature === 'reeds'){ g = '"'; fg = P.reeds; }
    const it = itemAt(x, y, t.z);
    if (it && !t.feature){ g = it.kind === 'stick' ? '/' : it.kind === 'rock' ? 'o' : it.kind === 'log' ? '=' : '%'; fg = it.kind === 'stick' || it.kind === 'log' ? P.stick : it.kind === 'rock' ? P.rock : P.carcass; }
    if (t.struct){
      if (t.struct.type === 'firepit'){ bg = P.pit; g = t.struct.lit ? null : (t.struct.fuel > 0 ? '≡' : '○'); fg = t.struct.fuel > 0 ? P.stick : P.rock; }
      else if (t.struct.type === 'leanto'){ bg = P.pit; g = '⌂'; fg = P.stick; }
      else if (t.struct.type === 'hut'){ bg = P.pit; g = '⌂'; fg = P.snare; }
      else if (t.struct.type === 'storehouse'){ bg = P.pit; g = '▦'; fg = P.stick; }
      else if (t.struct.type === 'stone'){ g = '⊙'; fg = t.struct.offering ? P.berry : P.rock; }
      else if (t.struct.type === 'ward'){ g = 'ǂ'; fg = P['ash-fg']; }
      else if (t.struct.type === 'rack'){ bg = P.pit; g = 'Ξ'; fg = P.stick; }
      else { g = '∩'; fg = t.struct.snare.catch ? P.carcass : t.struct.snare.armed ? P.snare : P['ash-fg']; }
    }
    ctx.fillStyle = bg; ctx.fillRect(px, py, T, T);
    if (t.z === 0 && camps.some(c => c.stashTile && c.stashTile[0] === x && c.stashTile[1] === y)){ ctx.fillStyle = P.stash; ctx.fillRect(px + 2, py + 2, T - 4, T - 4); if (!g){ g = '▤'; fg = P.stick; } }
    if (t.fire > 0 || (t.struct && t.struct.type === 'firepit' && t.struct.lit)) fires.push([lx, ly, x, y]);
    else if (g){ ctx.fillStyle = fg; ctx.fillText(g, px + T / 2, py + T / 2 + 1); }
    if (t.slope){
      const up = DIRS.find(([dx, dy]) => passable(x + dx, y + dy, t.z + 1)) || [1, 0];
      ctx.fillStyle = P['hill-fg']; ctx.globalAlpha = 0.55; ctx.beginPath();
      const cx = px + T / 2, cy = py + T / 2, hx = cx + up[0] * T / 2, hy = cy + up[1] * T / 2;
      ctx.moveTo(hx + up[1] * T / 2, hy + up[0] * T / 2); ctx.lineTo(hx - up[1] * T / 2, hy - up[0] * T / 2); ctx.lineTo(cx - up[0] * T / 2, cy - up[1] * T / 2); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (below > 0){ ctx.fillStyle = P.halo; ctx.globalAlpha = 0.45; ctx.fillRect(px, py, T, T); ctx.globalAlpha = 1; }
```

The cell loop is a plain `for` loop, so the `continue` in the open-air branch is legal.

In the camp-site dashed rectangle loop, add `lvl === 0 &&` to its condition: `if (lvl === 0 && c.site && !c.pit && ...`. In the corpses line, wrap it: `if (lvl === 0){ ctx.fillStyle = P.corpse; for (const c of corpses){ ... } }`. In the firelight-glow loop, add `lvl === 0 &&` after `if (`.

In the beings loop, replace `if (!a.alive || a.x < ox || ...) continue;` with:

```js
    if (!a.alive || a.x < ox || a.x >= ox + LW || a.y < oy || a.y >= oy + LH) continue;
    if (a.z !== lvl && !(a.z < lvl && !tileAt(a.x, a.y, lvl))) continue;
    ctx.globalAlpha = a.z === lvl ? 1 : 0.5;
```

and after the loop add `ctx.globalAlpha = 1;`.

- [ ] **Step 4: World map shading in `drawWorldCache`**

Replace the loop with:

```js
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const i = idx(x, y), t = world[i]; let c = tileColor(t);
    if (t.ground === 'rock'){ const up = levels[ZOFF + 1][i]; c = up && up.ground === 'rock' ? P['hill-fg'] : P.hill; }
    octx.fillStyle = c; octx.fillRect(x * WS, y * WS, WS, WS);
  }
```

In `tileColor`, change the last line to `return P[t.ground] || P.stone;`.

In `sectorSummary`, after the `water` line add:

```js
  const hs = hills.filter(h => secOf(h.x, h.y).sx === s.sx && secOf(h.x, h.y).sy === s.sy);
```

and add to `parts`, after the water entry: `hs.length ? `${hs.length} hill${hs.length > 1 ? 's' : ''}` : ''`, and change `parts.join('; ')` to `parts.filter(Boolean).join('; ')`.

- [ ] **Step 5: Tile cards, cells, and tools with a level**

Replace `cellFrom` with:

```js
function cellFrom(e){ const r = cv.getBoundingClientRect(); const lx = clamp(Math.floor((e.clientX - r.left) / r.width * LW), 0, LW - 1), ly = clamp(Math.floor((e.clientY - r.top) / r.height * LH), 0, LH - 1); return { lx, ly, x: cur.sx * LW + lx, y: cur.sy * LH + ly, z: lvl }; }
```

Replace `targetForCell` with:

```js
const targetForCell = c => { const a = beings.find(a => a.alive && a.x === c.x && a.y === c.y && a.z === c.z) || (c.z === 0 && beings.find(a => !a.alive && a.species === 'human' && a.x === c.x && a.y === c.y)); return a ? { being: a.id, cell: [c.x, c.y, c.z] } : { tile: [c.x, c.y, c.z], cell: [c.x, c.y, c.z] }; };
```

In `pinCell`, extend the `same` test: `tipTarget.tile && tipTarget.tile[0] === c.x && tipTarget.tile[1] === c.y && tipTarget.tile[2] === c.z`. In `tipForCell`, extend: `tipTarget.cell[0] === c.x && tipTarget.cell[1] === c.y && tipTarget.cell[2] === c.z`. In `renderTip`, change `inspectTile(tipTarget.tile[0], tipTarget.tile[1])` to `inspectTile(tipTarget.tile[0], tipTarget.tile[1], tipTarget.tile[2])`.

Replace the first line of `inspectTile` with:

```js
function inspectTile(x, y, z = 0){
  const s = secOf(x, y), where = `${sectors[secIdx(s.sx, s.sy)].name}, ${x - s.sx * LW},${y - s.sy * LH}`;
  if (!hasTile(x, y, z)) return `<table class="kv"><tr><td>Where</td><td>${where}</td></tr><tr><td>Level</td><td>${levelName(z)}. ${z > 0 ? 'Open air. The ground is below.' : 'Solid earth. Nothing is dug here.'}</td></tr></table>`;
  const t = tileAt(x, y, z), rows = [['Where', where], ['Level', levelName(z)], ['Ground', GROUND[t.ground].name + (GROUND[t.ground].walk || t.ground === 'water' ? '' : '. Nothing walks through it.')]];
```

After the `Feature` row add:

```js
  if (t.hill) rows.push(['Hill', `${t.hill.storeys === 2 ? 'A tall hill' : 'A low hill'} of old stone, ${t.hill.storeys === 2 ? 'two storeys' : 'one storey'} high. Cliffs all round but for the slopes.`]);
  if (t.slope) rows.push(['Slope', `a way up to ${levelName(z + 1).toLowerCase()}.`]);
```

Change the `Loose` row to `items.filter(i => i.x === x && i.y === y && i.z === z)`, and the `Here` row to `beings.filter(a => a.alive && a.x === x && a.y === y && a.z === z)`. Guard the camp rows: change `const c = camps.find(...)` to `const c = z === 0 ? camps.find(...) : null;` and add `z === 0 &&` at the front of the `camp.site` condition and the `camp.stashTile` condition.

In `applyTool`, change the `light` case to `say(lightTile(c.x, c.y, c.z));`, add to the `camp` case before the `passable` check: `if (c.z !== 0){ say('The camp must be on the valley floor.'); break; }`, and change the `poke` lookup to `beings.find(a => a.alive && a.x === c.x && a.y === c.y && a.z === c.z)`.

Replace the remaining `world[idx(x, y)]` and `itemGrid[idx(x, y)]` reads in `src/ui.js`: `grep -n "world\[idx\|itemGrid\[" src/ui.js` must print nothing.

- [ ] **Step 6: Build and check the page in the browser**

Run: `node --check src/ui.js && node build.js`
Expected: no syntax error, then `built dist/hearth-sim.html ...`.

Replace `tests/browser-shot.py` with:

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':1000}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://'+__import__('os').path.abspath('dist/hearth-sim.html')+''); pg.wait_for_timeout(1200)
    pg.evaluate("newWorld('q'); paused=true; for(let i=0;i<20500;i++){step(); for(const c of camps){ if(c.pit&&!c.everLit&&c.coals<=tick) lightTile(...c.pit);} } renderUI(true)")
    pg.wait_for_timeout(400)
    print('camps', pg.evaluate("camps.map(c=>c.name)"), pg.inner_text('#clock'))
    h=pg.evaluate("(()=>{const h=hills[0]; const s=secOf(h.x,h.y); goto(s.sx,s.sy); return [h.x,h.y,h.storeys,s.sx,s.sy]})()")
    print('hill', h, pg.inner_text('#where'))
    pg.screenshot(path='hill-surface.png')
    pg.keyboard.press(']'); pg.wait_for_timeout(300); print('level', pg.inner_text('#level'))
    box=pg.query_selector('#map').bounding_box()
    pg.mouse.move(box['x']+((h[0]-h[3]*28)+.5)*box['width']/28, box['y']+((h[1]-h[4]*20)+.5)*box['height']/20); pg.wait_for_timeout(300)
    print('hill card:', pg.inner_text('#tip').replace('\n',' | ')[:220])
    pg.screenshot(path='hill-level1.png')
    print('errors', errs); b.close()
```

Run: `python3 tests/browser-shot.py`
Expected: `level Level +1`, a hill card that mentions "A low hill" or "A tall hill", `errors []`. Open `hill-level1.png` and confirm: rock drawn dark on the surface view, floor drawn on level +1 with the surface dimmed around it, and a wedge on each slope. Delete the two PNGs afterwards (git ignores them anyway).

- [ ] **Step 7: Walk a hill on the dev server**

Open http://localhost:8700/ in a browser. Make a world, press M for the world map, and click a grey hill. Press `]` to go up a level. Hover the hill: the card names the hill and its storeys. Hover a slope: the card says "a way up". Follow a deer with Inspect and Follow, and wait until it climbs: the level control follows it.

- [ ] **Step 8: Commit**

```bash
git add src/ui.js src/page.template.html dist/hearth-sim.html tests/browser-shot.py
git commit -m "Level view: one level at a time, rock and stone and slopes drawn, tile cards with a level

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Record the model

**Files:**
- Modify: `design/notes.md` (sections 2, 3, 14)
- Modify: `CLAUDE.md` (Layout, Rules of the split)
- Modify: `README.md`

- [ ] **Step 1: Design notes**

In section 2 (Scale), add after the river bullet:

```
- The world has five levels, −2 to +2. Level 0 is the surface. A level is an array like the surface, mostly empty: open air above, solid earth below. Six to ten hills stand on rocky and forest ground: rock at level 0 with a floor of stone or grass above it, and a second storey on the tall ones. Each storey has one or two slopes on its rim. Everything else is cliff.
- Slopes are the only way between levels. From a slope you step to any of its four neighbours one level up, and from those you step back down onto it. Rabbits never climb. Deer climb hills. Everyone else goes anywhere.
- Distance between beings adds six tiles per level apart. A wolf on a hilltop is not near a person at its foot.
- Fire burns on every level and is half again as likely to run uphill over a slope.
```

In section 3 (Materials and tiles), after the first paragraph add: `Two grounds are terrain: rock, which nothing walks through, and stone, a bare floor. Passability reads the ground table's walk flag.`

In section 14 (Testing), add after the soak paragraph:

```
`tests/terrain.js` checks the levels: the surface is level 0, a slope joins two floors and a cliff does not, rabbits never climb and deer do, a wolf a level up is not a threat, fire burns on a hilltop, and every hill on every seed is rock with reachable floors, off the water, and out of the start sector.
```

- [ ] **Step 2: CLAUDE.md and README**

In `CLAUDE.md` Layout, add after the `tests/lib/run.js` line: `- \`tests/terrain.js\`: the levels, slopes, and hills. Fast. Run it with the soak.` In Rules of the split, add: `- Passability, search, and fire read levels. A tile has a z. Use \`tileAt(x, y, z)\`, \`passable(x, y, z)\`, and \`near(a, b)\` for beings. Do not index \`world\` for anything that can be off the surface.`

In `README.md`, add after the soak line: `    node tests/terrain.js            # levels, slopes, hills: about two seconds`

- [ ] **Step 3: Run everything once more**

Run: `node tests/terrain.js && node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail)|✖" && node build.js`
Expected: terrain all pass, `ℹ pass 44`, `ℹ fail 0`, page built.

- [ ] **Step 4: Commit**

```bash
git add design/notes.md CLAUDE.md README.md
git commit -m "Notes: levels, slopes, hills, and the terrain test

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

- Spec coverage for phase 1: levels and empty entries (Task 1), rock and stone read from the table (Task 1), slopes and `steps` (Task 2), search over levels (Task 2), species limits (Tasks 1 and 2), `near` with six per level and the audit (Task 3), fire across slopes and uphill (Task 4), uplift with storeys, slopes, cliffs, off the river, out of the start sector (Task 5), level control, dimmed level below, rock and stone and slope drawing, follow changes level, world map shading, tile-card rows, legend (Task 6), notes (Task 7). Rain and wind under rock, cold underground, and darkness below level 0 belong to phase 2, where the first tiles below the surface appear.
- Not in this phase, and noted for phase 2: plants do not grow on hill floors; `nearbyBlaze` and the sector resource counts read the surface only; `sectorSummary` counts hills but not what is on them.
- Names used across tasks: `ZMIN`, `ZMAX`, `ZOFF`, `NZ`, `idx3`, `levels`, `raised`, `hills`, `near`, `nearAt`, `tileAt(x, y, z)`, `hasTile`, `makeTile`, `placeTile`, `passable(x, y, z)`, `nearFind(..., z)`, `itemAt`, `addItem(kind, x, y, z)`, `steps(x, y, z, out)`, `bfs(sx, sy, sz, goal, maxNodes, who)`, `reachable(sx, sy, sz, cap)`, `legPath(a, tx, ty, within, tz)`, `nearestFire(x, y, r, z)`, `lightTile(x, y, z)`, `burnTile`, `spreadTo`, `uplift`, `component`, `hillFits`, `erodedBy`, `raiseHill`, `cutSlopes`, `lvl`, `setLevel`, `levelName`, `inspectTile(x, y, z)`. Each is defined in the task that first uses it.
