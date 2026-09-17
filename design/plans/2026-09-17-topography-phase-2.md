# Topography phase 2: pre-history, caves, dens, groves under hills, finds, and the rules of the dark

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every world caves cut by water under its tall hills, dens dug by foxes and wolves, sprite hollows under forest hills, finds in the deep chambers, and the rules that make the underground rainless, mild, and dark.

**Architecture:** A cave is a record (`kind`, `owner`, `tiles`, `mouth`, `exit`, `deep`, `blocked`, `story`) in a new state list `caves`, and every carved tile points back at its record through `t.cave`. The surface tile you step out onto points at the cave through `t.mouth`. Carving reuses phase 1's `placeTile` and slopes: a mouth is a slope on level −1 under a hill tile beside a walkable surface tile. The pre-history runs inside `generate()` after `uplift()`, in the spec's order: water, rockfall, dens, groves, finds, populate. Rules for the dark live in `updateBeing` and `runTask` and read a being's `z`.

**Tech Stack:** Plain JavaScript scripts sharing one scope under `src/sim/`, joined by `src/sim/index.js`. Node's built-in test runner. No dependencies.

## Global Constraints

- Spec: `design/specs/2026-09-17-topography-design.md`, sections 1 (Weather and fire underground), 3 (Pre-history: Water, Rockfall, Dens, Groves, Finds, Populate), 6 (tile cards), 7 (terrain test), 8 row "2. Pre-history". Done when the terrain test and the soak are green.
- Levels z from −2 to +2. A cave is `stone` floor carved out of `rock`. A mouth is a slope on the lower level whose upper neighbours are outside the hill.
- Water: every medium hill (two storeys) had a spring. A winding passage 8 to 20 tiles long from under the hill to a mouth at the foot, one or two chambers, a drop to level −2 with a chamber at the bottom. One in three streams still runs and leaves a pond at the mouth. Story: "Water cut this passage when the river ran higher."
- Rockfall: boulders at hill feet. One passage in four is blocked by fallen rock, a `rock` tile inside the passage. Story: "Fallen rock blocks the way."
- Dens: each wolf pair and each fox gets a den in a hillside: a pocket of 2 to 6 tiles at level 0 inside the rock, or a burrow of 2 to 4 tiles at level −1 under a slope. One mouth. Stories: "Dug by foxes long before anyone came." "Widened by wolves."
- Groves: a forest sector that holds a hill gets its hollow under the hill instead of in a pine. Story: "The oldest hollow in the valley." A person inside the hollow costs 5 favour per visit and a thought for the sprites.
- Finds: each deep chamber holds one item: firestones, glowing moss, or old bones.
- Populate: wolves spawn in wolf dens, foxes in fox dens, sprites at their hollow. Each remembers its home.
- Rain never reaches a tile with rock or another tile above it. Underground warmth falls at the spring-night rate all year. Below level 0 it is dark: a person there without a burning ember walks at half speed and their task fails, so they turn back.
- Rules read data tables. No rule checks a ground name. Files in `src/sim/` are plain scripts, no `import` or `export`. `updateWorld()` keeps its step order.
- Every task that changes generation re-blesses the golden record (`UPDATE_GOLDEN=1 node tests/soak.js`) after reading the counts. The soak must stay green: no death that is not old age, nobody cut off, each seed under 25 seconds.
- Every new behaviour is visible: a tile-card row, a legend entry, a thought, or a chronicle line.
- Commit after every task on branch `dev`. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Line numbers in this plan come from the files as they are now; match on text.

---

## File map

| File | Responsibility in this phase |
|---|---|
| `src/sim/core.js` | `caves` state, `firestones` and `bones` item kinds. |
| `src/sim/world.js` | Cave records and carving, `keepsPaths`, water caves, rockfall, dens, hollows under hills, finds, the new steps in `generate()`. |
| `src/sim/beings.js` | `den` on beings, rain and warmth under a roof, the dark. |
| `src/sim/tasks.js` | Gathering ignores items below the surface. |
| `src/sim/fae.js` | Favour for standing in a hollow. |
| `src/sim/index.js` | New names in the Node API. |
| `src/ui.js`, `src/page.template.html` | Cave mouths, cave and den rows on tile cards, the dark row, the den chip, legend. |
| `tests/terrain.js` | Cave, den, hollow, find, and dark-rule tests. |
| `tests/browser-shot.py` | Visit a cave mouth and go down a level. |
| `design/notes.md`, `README.md` | Record the pre-history and the rules of the dark. |

---

### Task 1: Cave records, carving, and a path-keeping check

**Files:**
- Modify: `src/sim/core.js` (state line, `ITEMS` table)
- Modify: `src/sim/world.js` (`makeTile`, before `uplift`, `saplingMayGrow`, `generate`)
- Modify: `src/sim/index.js` (API)
- Test: `tests/terrain.js`

**Interfaces:**
- Produces: state `caves` (array, reset per world); tile fields `cave: null`, `mouth: null`; `ITEMS.firestones`, `ITEMS.bones`; `makeCave(kind, hill)` returns `{ id, kind, hill, owner: null, tiles: [], mouth: null, exit: null, deep: null, blocked: null, story: [] }` and pushes it on `caves`; `carve(c, x, y, z)` turns a tile into cave floor (creating it below the surface) and returns it; `keepsPaths(t)` is true when making `t` solid leaves its open neighbours joined around it; `saplingMayGrow(t)` now calls `keepsPaths`; `rimExits(h, set)` lists `[surfaceTile, footprintIndex]` pairs where a walkable outside tile touches the footprint.

- [ ] **Step 1: Write the failing tests**

Append to `tests/terrain.js`:

```js
test('a cave is carved as stone floor and remembers its record', () => {
  const api = load(); api.startWorld('r');
  assert.ok(Array.isArray(api.caves));
  const before = api.caves.length;
  const c = api.makeCave('water', null);
  assert.equal(api.caves.length, before + 1);
  const t = api.carve(c, 150, 66, -1);
  assert.equal(t.ground, 'stone'); assert.equal(t.z, -1); assert.equal(t.cave, c); assert.ok(c.tiles.includes(t));
  assert.equal(api.carve(c, 150, 66, -1), t, 'carving twice returns the same tile');
  const s = api.tileAt(151, 66); s.ground = 'rock'; s.feature = 'tree';
  const u = api.carve(c, 151, 66, 0);
  assert.equal(u, s); assert.equal(u.ground, 'stone'); assert.equal(u.feature, null); assert.equal(u.cave, c);
  assert.equal(api.passable(150, 66, -1), true);
  assert.ok(api.ITEMS.firestones && api.ITEMS.bones);
});

test('keepsPaths refuses a solid that would cut the last way through', () => {
  const api = load(); api.startWorld('r'); const x0 = 150, y0 = 74;
  for (let y = y0 - 2; y <= y0 + 2; y++) for (let x = x0 - 2; x <= x0 + 2; x++){ const t = api.tileAt(x, y); t.ground = 'grass'; t.feature = null; t.struct = null; t.fire = 0; t.slope = false; }
  for (const dy of [-1, 1]) for (let x = x0 - 1; x <= x0 + 1; x++) api.tileAt(x, y0 + dy).feature = 'boulder';
  assert.equal(api.keepsPaths(api.tileAt(x0, y0)), false, 'the middle of a one-wide corridor');
  api.tileAt(x0, y0 - 1).feature = null;
  assert.equal(api.keepsPaths(api.tileAt(x0, y0)), true, 'with the north open the sides still join');
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/terrain.js`
Expected: the two new tests fail; `api.caves` is undefined.

- [ ] **Step 3: State and item kinds in `src/sim/core.js`**

Change the state line to:

```js
let world, levels, raised, hills, caves, sectors, beings, items, itemGrid, chronicle, corpses, tick, nextId, fireCount, seedText, camps, camp, goalPriority, namePool, resCache, weather, groves;
```

In the `ITEMS` table, after the `moss` line, add:

```js
  firestones: { name: 'pair of firestones', plural: 'firestones', mat: 'stone', fuel: 0 },
  bones:   { name: 'old bones',       plural: 'old bones', mat: 'stone', fuel: 0 },
```

- [ ] **Step 4: Tile fields, records, carving, and the path check in `src/sim/world.js`**

In `makeTile`, change the literal to end `struct: null, slope: false, hill: null, cave: null, mouth: null };`.

Before `/* ---------- uplift: hills ---------- */` add:

```js
/* ---------- caves ---------- */
/* A cave is a record. kind: water, den, or hollow. tiles: every carved tile, on any level. mouth: the slope on the
   lower level you climb out by, or the pocket tile beside the outside for a den at level 0. exit: the surface tile
   you step out onto; it points back through t.mouth. deep: the find spot. blocked: a rock tile in the passage. */
function makeCave(kind, hill){ const c = { id: nextId++, kind, hill, owner: null, tiles: [], mouth: null, exit: null, deep: null, blocked: null, story: [] }; caves.push(c); return c; }
/* Turn a tile into cave floor for cave c. Below the surface the tile is made; on the surface the rock is cut. */
function carve(c, x, y, z){
  let t = hasTile(x, y, z) ? tileAt(x, y, z) : null;
  if (t && t.cave === c) return t;
  if (!t) t = placeTile(x, y, z, 'stone'); else { t.ground = 'stone'; t.feature = null; t.berries = 0; t.loose = null; }
  t.cave = c; c.tiles.push(t); return t;
}
/* Making this tile solid keeps every path if its open sides still touch each other around the ring. */
function keepsPaths(t){
  const open = AROUND.map(([dx, dy]) => passable(t.x + dx, t.y + dy, t.z));
  const sides = [0, 2, 4, 6].filter(i => open[i]);
  if (sides.length < 2) return true;
  const joined = new Set([sides[0]]);
  for (const step of [1, -1]){ let i = sides[0]; for (let k = 0; k < 7; k++){ i = (i + step + 8) % 8; if (!open[i]) break; joined.add(i); } }
  return sides.every(i => joined.has(i));
}
/* Walkable surface tiles just outside a hill, each with the footprint tile it touches. Mouths and slopes are skipped. */
function rimExits(h, set){
  const out = [];
  for (const i of h.tiles){ const x = i % W, y = (i - x) / W;
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || set.has(idx(nx, ny))) continue; const t = tileAt(nx, ny); if (passable(nx, ny) && !t.slope && !t.mouth) out.push([t, i]); } }
  return out;
}
```

Replace the body of `saplingMayGrow` so it reads:

```js
function saplingMayGrow(t){ return keepsPaths(t); }
```

In `generate()`, change `raised = []; hills = [];` to `raised = []; hills = []; caves = [];`.

- [ ] **Step 5: API in `src/sim/index.js`**

Add to the API list: `ITEMS,` after `GROUND,`; `makeCave, carve, keepsPaths, rimExits,` after `placeTile,`; `get caves(){ return caves; },` after the `hills` getter.

- [ ] **Step 6: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 16 pass.

- [ ] **Step 7: Run the soak and confirm the golden record still matches**

Run: `node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"`
Expected: `ℹ pass 44`, `ℹ fail 0`. Nothing generated changes yet.

- [ ] **Step 8: Commit**

```bash
git add src/sim tests/terrain.js
git commit -m "Cave records, carving, and a path-keeping check shared with saplings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Water cuts a cave under every tall hill

**Files:**
- Modify: `src/sim/world.js` (after `rimExits`, and `generate`)
- Modify: `tests/soak-golden.json` (re-blessed)
- Test: `tests/terrain.js`

**Interfaces:**
- Consumes: `makeCave`, `carve`, `keepsPaths`, `rimExits`, `hills`, `component`, `placeTile`, `shuffle`, `rint`, `rng`.
- Produces: `cutWaterCaves()`; `chamber(c, x, y, z, set)` carves a room around a tile and returns the carved tiles; caves of kind `water` with `mouth` (slope at z −1), `exit` (surface tile with `mouth` set), `deep` (a floor tile at z −2), story lines.

- [ ] **Step 1: Write the failing tests**

Append to `tests/terrain.js`:

```js
const SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];
const stepList = (api, t) => { const out = []; api.steps(t.x, t.y, t.z, out); const r = []; for (let k = 0; k < out.length; k += 3) r.push([out[k], out[k + 1], out[k + 2]]); return r; };

for (const seed of SEEDS) test(`seed ${seed}: water cut a cave under every tall hill`, () => {
  const api = load(); api.startWorld(seed);
  const full = api.levels.length * api.world.length;
  const tall = api.hills.filter(h => h.storeys === 2);
  const water = api.caves.filter(c => c.kind === 'water');
  assert.equal(water.length, tall.length, `${tall.length} tall hills, ${water.length} water caves`);
  for (const c of water){
    assert.ok(c.mouth && c.mouth.slope && c.mouth.z === -1, 'the mouth is a slope on level -1');
    assert.ok(c.exit && c.exit.z === 0 && c.exit.mouth === c && api.passable(c.exit.x, c.exit.y), 'the exit is a walkable surface tile that knows its cave');
    assert.ok(stepList(api, c.mouth).some(([x, y, z]) => x === c.exit.x && y === c.exit.y && z === 0), 'the mouth leads up to the exit');
    assert.ok(c.deep && c.deep.z === -2 && api.passable(c.deep.x, c.deep.y, -2), 'a deep chamber at level -2');
    const floors = c.tiles.filter(t => api.GROUND[t.ground].walk);
    assert.ok(floors.length >= 10, `a passage of ${floors.length} tiles is too short`);
    const region = api.reachable(c.exit.x, c.exit.y, 0, full);
    for (const t of floors) assert.ok(region.has(api.idx3(t.x, t.y, t.z)), `cave under hill ${c.hill.x},${c.hill.y}: floor ${t.x},${t.y},${t.z} cannot be reached from the exit`);
    for (const t of c.tiles) assert.ok(c.hill.tiles.includes(api.idx(t.x, t.y)), 'every cave tile lies under the hill');
    assert.ok(c.story.some(s => s.includes('Water cut')), 'the story says water cut it');
  }
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/terrain.js`
Expected: six failures, `N tall hills, 0 water caves`.

- [ ] **Step 3: Add the water step to `src/sim/world.js` after `rimExits`**

```js
/* ---------- pre-history ---------- */
/* Every tall hill had a spring. Its stream cut a winding passage from under the hill out to a mouth at the foot, with
   one or two chambers, and a drop to level -2 with a chamber at the bottom. One stream in three still runs. */
function cutWaterCaves(){
  for (const h of hills){
    if (h.storeys < 2) continue;
    const set = new Set(h.tiles);
    const rim = rimExits(h, set); if (!rim.length) continue;
    const [exit, under] = rim[rint(rim.length)];
    const c = makeCave('water', h);
    let x = under % W, y = (under - x) / W;
    const mouth = carve(c, x, y, -1); mouth.slope = true; c.mouth = mouth; c.exit = exit; exit.mouth = c;
    const len = 8 + rint(13);
    for (let k = 0; k < len; k++){
      const opts = shuffle(DIRS).map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => set.has(idx(nx, ny)) && !(hasTile(nx, ny, -1) && tileAt(nx, ny, -1).cave === c) && dist(nx, ny, exit.x, exit.y) >= dist(x, y, exit.x, exit.y));
      if (!opts.length) break;
      [x, y] = opts[0]; carve(c, x, y, -1);
      if (k === Math.floor(len / 2) && rng() < 0.5) chamber(c, x, y, -1, set);
    }
    chamber(c, x, y, -1, set);
    /* The drop: a slope on level -2 under the last chamber, with a chamber around it. */
    const drop = carve(c, x, y, -2); drop.slope = true;
    const bottom = chamber(c, x, y, -2, set);
    c.deep = bottom[rint(bottom.length)];
    c.story.push('Water cut this passage when the river ran higher.');
    if (rng() < 1 / 3){
      const pond = RING.map(([dx, dy]) => [exit.x + dx, exit.y + dy]).filter(([px, py]) => inb(px, py) && !set.has(idx(px, py)) && passable(px, py) && !tileAt(px, py).slope && !tileAt(px, py).mouth && keepsPaths(tileAt(px, py)));
      if (pond.length){ const [px, py] = pond[rint(pond.length)]; const t = tileAt(px, py); t.ground = 'water'; t.feature = null; t.berries = 0; t.loose = null; c.story.push('A spring still runs at its mouth.'); }
    }
  }
}
/* A room around a tile: its four sides first, so the room touches the tile, then the corners, each with four chances in five. Returns the carved tiles. */
function chamber(c, x, y, z, set){
  const out = [];
  for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (set.has(idx(nx, ny)) && (rng() < 0.8 || !out.length)) out.push(carve(c, nx, ny, z)); }
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const nx = x + dx, ny = y + dy; if (set.has(idx(nx, ny)) && rng() < 0.8) out.push(carve(c, nx, ny, z)); }
  return out;
}
```

In `generate()`, change the line `uplift();` to:

```js
  uplift(); cutWaterCaves();
```

Note on the walk: the filter keeps the passage under the footprint, never re-enters its own floor, and never steps closer to the exit, so it winds inward. `chamber` forces at least one side tile, so the drop slope on level −2 always has a floor beside it on level −1 to climb to, and `c.deep` is always a floor at level −2. A pond tile is only made where `keepsPaths` says the surface stays joined.

- [ ] **Step 4: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 22 pass. If a floor cannot be reached from the exit, print the cave's tiles by level and check that every carved level −1 tile is four-connected to the mouth (the walk only moves by `DIRS`, so a break means `carve` returned an existing tile of another cave, which cannot happen under one hill unless two caves share it).

- [ ] **Step 5: Run the soak, read the counts, and bless**

Run: `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"`
Expected: `ℹ fail 0`, each seed under 25000 ms, no death that is not old age, nobody cut off. Compare `alive`, `caught`, `born` per seed against `git show HEAD:tests/soak-golden.json`; they move a little because the random stream shifted.

- [ ] **Step 6: Commit**

```bash
git add src/sim/world.js tests/terrain.js tests/soak-golden.json
git commit -m "Water cuts a winding cave under every tall hill, with a drop to a deep chamber

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Rockfall

**Files:**
- Modify: `src/sim/world.js` (after `chamber`, and `generate`)
- Modify: `tests/soak-golden.json` (re-blessed)
- Test: `tests/terrain.js`

**Interfaces:**
- Consumes: `rimExits`, `keepsPaths`, `caves`, `hills`.
- Produces: `rockfall()`; boulders at hill feet; one water cave in four has `blocked` set to a `rock` tile in its passage.

- [ ] **Step 1: Write the failing tests**

Append to `tests/terrain.js`:

```js
for (const seed of SEEDS) test(`seed ${seed}: rock fell at the hill feet and blocked some passages`, () => {
  const api = load(); api.startWorld(seed);
  const full = api.levels.length * api.world.length;
  let feet = 0;
  for (const h of api.hills){ const set = new Set(h.tiles);
    let n = 0; for (const i of h.tiles){ const x = i % api.W, y = (i - x) / api.W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const t = api.tileAt(Math.min(api.W - 1, Math.max(0, x + dx)), Math.min(api.H - 1, Math.max(0, y + dy))); if (!set.has(api.idx(t.x, t.y)) && t.feature === 'boulder') n++; } }
    if (n) feet++;
  }
  assert.ok(feet >= api.hills.length / 2, `only ${feet} of ${api.hills.length} hills have boulders at the foot`);
  for (const c of api.caves.filter(c => c.kind === 'water')){
    const region = api.reachable(c.exit.x, c.exit.y, 0, full);
    if (c.blocked){
      assert.equal(c.blocked.ground, 'rock'); assert.ok(c.tiles.includes(c.blocked)); assert.notEqual(c.blocked, c.mouth);
      assert.ok(region.has(api.idx3(c.mouth.x, c.mouth.y, -1)), 'the mouth is still reachable');
      assert.equal(region.has(api.idx3(c.deep.x, c.deep.y, -2)), false, 'the deep chamber is sealed off');
      assert.ok(c.story.some(s => s.includes('Fallen rock')));
    } else {
      assert.ok(region.has(api.idx3(c.deep.x, c.deep.y, -2)), 'an open cave reaches its deep chamber');
    }
  }
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/terrain.js`
Expected: six failures on the boulder count.

- [ ] **Step 3: Add rockfall to `src/sim/world.js` after `chamber`**

```js
/* Rock fell from the hills. Boulders lie at the feet where they cut no path, and one water passage in four is blocked. */
function rockfall(){
  for (const h of hills){
    const set = new Set(h.tiles);
    const rim = shuffle(rimExits(h, set)); let want = 2 + rint(3);
    for (const [t] of rim){ if (!want) break; if (t.feature || t.struct || t.mouth) continue; if (!keepsPaths(t)) continue; t.feature = 'boulder'; t.loose = null; want--; }
  }
  for (const c of caves){
    if (c.kind !== 'water' || rng() >= 0.25) continue;
    const passage = c.tiles.filter(t => t.z === -1 && t !== c.mouth && !t.slope);
    if (passage.length < 4) continue;
    const t = passage[1 + rint(passage.length - 3)];
    t.ground = 'rock'; c.blocked = t; c.story.push('Fallen rock blocks the way.');
  }
}
```

In `generate()`, change `uplift(); cutWaterCaves();` to `uplift(); cutWaterCaves(); rockfall();`.

Why the block always seals the deep chamber: the passage is a single four-connected walk from the mouth with chambers hung on it, and `passage[1 .. length-3]` is a walk tile before the last chamber, so cutting it separates everything carved after it, including the drop. If the test's "sealed off" assertion fails on a seed, the block landed on a chamber tile beside the walk; restrict the choice to tiles with exactly two open neighbours on level −1.

- [ ] **Step 4: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 28 pass.

- [ ] **Step 5: Run the soak, read the counts, and bless**

Run: `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"`
Expected: `ℹ fail 0`, every seed under 25000 ms.

- [ ] **Step 6: Commit**

```bash
git add src/sim/world.js tests/terrain.js tests/soak-golden.json
git commit -m "Rockfall: boulders at the hill feet, and one passage in four blocked

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Dens, and the foxes and wolves that start in them

**Files:**
- Modify: `src/sim/world.js` (after `rockfall`, and `generate`)
- Modify: `src/sim/beings.js` (`makeBeing`)
- Modify: `src/sim/index.js` (API)
- Modify: `tests/soak-golden.json` (re-blessed)
- Test: `tests/terrain.js`

**Interfaces:**
- Consumes: `makeCave`, `carve`, `rimExits`, `erodedBy`, `hills`, `caves`, `sectorOfTile`.
- Produces: `digDens()`; caves of kind `den` with `owner` `'wolf'` or `'fox'`, one mouth each; `spawnInDens(species, n)` returns how many were placed; beings of species fox and wolf have `den` (a cave or null).

- [ ] **Step 1: Write the failing tests**

Append to `tests/terrain.js`:

```js
for (const seed of SEEDS) test(`seed ${seed}: foxes and wolves have dens with one mouth, and start in them`, () => {
  const api = load(); api.startWorld(seed);
  const full = api.levels.length * api.world.length;
  const dens = api.caves.filter(c => c.kind === 'den');
  assert.ok(dens.length >= 1 && dens.length <= 4, `${dens.length} dens`);
  assert.equal(dens.filter(c => c.owner === 'wolf').length, 1, 'one wolf den');
  for (const c of dens){
    const floors = c.tiles.filter(t => api.GROUND[t.ground].walk);
    assert.ok(floors.length >= 2 && floors.length <= 6, `den of ${floors.length} tiles`);
    const tileSet = new Set(c.tiles);
    let mouths = 0; for (const t of floors) if (stepList(api, t).some(([x, y, z]) => !tileSet.has(api.tileAt(x, y, z)))) mouths++;
    assert.equal(mouths, 1, `den at ${c.mouth.x},${c.mouth.y},${c.mouth.z} has ${mouths} tiles touching the outside`);
    assert.ok(c.exit && c.exit.mouth === c && api.passable(c.exit.x, c.exit.y));
    const region = api.reachable(c.exit.x, c.exit.y, 0, full);
    for (const t of floors) assert.ok(region.has(api.idx3(t.x, t.y, t.z)), `den floor ${t.x},${t.y},${t.z} cannot be reached`);
    assert.ok(c.story.some(s => s.includes('Dug by foxes')));
    if (c.owner === 'wolf') assert.ok(c.story.some(s => s.includes('Widened by wolves')));
  }
  for (const sp of ['wolf', 'fox']){
    const homed = api.beings.filter(b => b.species === sp && b.den);
    assert.ok(homed.length >= 1, `no ${sp} starts in a den`);
    for (const b of homed) assert.ok(b.den.tiles.some(t => t.x === b.x && t.y === b.y && t.z === b.z), `${b.name} is not standing in its den`);
  }
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/terrain.js`
Expected: six failures, `0 dens`.

- [ ] **Step 3: Add dens to `src/sim/world.js` after `rockfall`**

```js
/* Foxes and wolves dug into the hillsides over generations. A den is a pocket of 2 to 6 tiles at level 0 inside the
   rock, or a burrow of 2 to 4 tiles on level -1 under a slope. One mouth. The wolf den is on a forest hill when there is one. */
function digDens(){
  const forest = hills.filter(h => sectorOfTile(world[h.tiles[0]]).biome === 'forest');
  const order = shuffle(forest).concat(shuffle(hills.filter(h => !forest.includes(h))));
  const wants = ['wolf', 'fox', 'fox', 'fox'];
  for (const owner of wants){
    for (const h of order){
      if (digDen(h, owner)) break;
    }
  }
}
function digDen(h, owner){
  const set = new Set(h.tiles);
  const rim = shuffle(rimExits(h, set));
  for (const [exit, under] of rim){
    const ux = under % W, uy = (under - ux) / W;
    const burrow = rng() < 0.5, z = burrow ? -1 : 0;
    /* A pocket must stay off the rim except at its mouth, so its other tiles sit one tile inside the footprint. */
    const inside = i => set.has(i) && (z === -1 || erodedBy(i, set, 1));
    if (z === 0 && tileAt(ux, uy).cave) continue;
    const c = makeCave('den', h); c.owner = owner;
    const mouth = carve(c, ux, uy, z); if (burrow) mouth.slope = true; c.mouth = mouth; c.exit = exit; exit.mouth = c;
    const size = burrow ? 2 + rint(3) : 2 + rint(5);
    let x = ux, y = uy;
    for (let k = 1; k < size; k++){
      const opts = shuffle(DIRS).map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => inb(nx, ny) && inside(idx(nx, ny)) && !(hasTile(nx, ny, z) && tileAt(nx, ny, z).cave));
      if (!opts.length) break;
      [x, y] = opts[0]; carve(c, x, y, z);
    }
    if (c.tiles.length < 2){ /* too cramped here: give the tiles back and try another spot */
      for (const t of c.tiles){ t.cave = null; if (t.z === 0) t.ground = 'rock'; else { levels[t.z + ZOFF][idx(t.x, t.y)] = null; const k = raised.indexOf(t); if (k >= 0) raised.splice(k, 1); } }
      exit.mouth = null; caves.splice(caves.indexOf(c), 1); continue;
    }
    c.story.push('Dug by foxes long before anyone came.');
    if (owner === 'wolf') c.story.push('Widened by wolves.');
    return c;
  }
  return null;
}
/* Put n animals of a species in its dens, two to a wolf den and one to a fox den. Returns how many were placed. */
function spawnInDens(species, n){
  let placed = 0;
  for (const c of caves){
    if (c.kind !== 'den' || c.owner !== species) continue;
    const floors = c.tiles.filter(t => passable(t.x, t.y, t.z)); if (!floors.length) continue;
    const per = species === 'wolf' ? 2 : 1;
    for (let j = 0; j < per && placed < n; j++, placed++){ const t = floors[j % floors.length]; const b = makeBeing(species, t.x, t.y, null, 0); b.z = t.z; b.den = c; beings.push(b); }
  }
  return placed;
}
```

In `generate()`, change `uplift(); cutWaterCaves(); rockfall();` to `uplift(); cutWaterCaves(); rockfall(); digDens();`, and replace the two lines

```js
  spawnAnimal('fox', ['forest', 'rocky'], 3);
  spawnAnimal('wolf', ['forest'], 2);
```

with

```js
  spawnAnimal('fox', ['forest', 'rocky'], 3 - spawnInDens('fox', 3));
  spawnAnimal('wolf', ['forest'], 2 - spawnInDens('wolf', 2));
```

Why one mouth: a level −1 burrow touches the outside only through its slope, because level −1 tiles have no same-level neighbours outside the cave. A level 0 pocket touches the outside only at the mouth tile, because every other tile is one tile inside the footprint, where all four neighbours are rock or cave. A water cave's mouth is on level −1 under a footprint tile; a pocket at level 0 can sit above it without touching it, since nothing joins level 0 to level −1 but a slope.

- [ ] **Step 4: Give foxes and wolves a den field, in `src/sim/beings.js`**

In `makeBeing`, after the `if (species === 'sprite'){ ... }` line, add:

```js
  if (species === 'fox' || species === 'wolf') b.den = null;
```

- [ ] **Step 5: API**

In `src/sim/index.js` add `digDens, spawnInDens,` after `rimExits,`.

- [ ] **Step 6: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 34 pass. If a seed has fewer than four dens, that is allowed (`>= 1`), but if it has no wolf den, look at whether `rimExits` was empty for every hill after rockfall took the rim tiles; if so, place boulders only on rim tiles that are not the last two exits of a hill.

- [ ] **Step 7: Run the soak, read the counts, and bless**

Run: `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"`
Expected: `ℹ fail 0`, every seed under 25000 ms. `wolfRaids`, `mauled`, and `deerByWolves` may move, since wolves now start on hills instead of random forest tiles.

- [ ] **Step 8: Commit**

```bash
git add src/sim tests/terrain.js tests/soak-golden.json
git commit -m "Dens: foxes and wolves dug into the hillsides, and start at home

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Groves under hills, and the cost of walking into a hollow

**Files:**
- Modify: `src/sim/world.js` (after `spawnInDens`, and the grove loop in `generate`)
- Modify: `src/sim/fae.js` (`faeTick`)
- Modify: `tests/soak-golden.json` (re-blessed)
- Test: `tests/terrain.js`

**Interfaces:**
- Consumes: `makeCave`, `carve`, `rimExits`, `erodedBy`, `hills`, `groves`, `campHumans`, `addThought`.
- Produces: `hollowUnderHill(sc, h)` returns a grove record `{ x, y, sector, anger, swarmUntil, lastBirth, cave }` or null; caves of kind `hollow` with `owner: 'sprite'`; the grove's hollow feature stands on the innermost pocket tile; `groves[i].cave` (null for a pine hollow).

- [ ] **Step 1: Write the failing tests**

Append to `tests/terrain.js`:

```js
for (const seed of SEEDS) test(`seed ${seed}: a grove on a forest hill lives in a hollow under it`, () => {
  const api = load(); api.startWorld(seed);
  let under = 0;
  for (const g of api.groves){
    const hill = api.hills.find(h => api.secOf(h.x, h.y).sx === g.sector.sx && api.secOf(h.x, h.y).sy === g.sector.sy);
    if (!hill){ assert.equal(g.cave, null); assert.equal(api.tileAt(g.x, g.y).feature, 'hollow'); continue; }
    under++;
    assert.ok(g.cave && g.cave.kind === 'hollow' && g.cave.owner === 'sprite', 'the grove has a hollow cave');
    const hollowTile = api.tileAt(g.x, g.y);
    assert.equal(hollowTile.feature, 'hollow'); assert.equal(hollowTile.cave, g.cave);
    assert.ok(g.cave.tiles.filter(t => api.passable(t.x, t.y, t.z)).length >= 2, 'room to dance');
    assert.ok(g.cave.exit && g.cave.exit.mouth === g.cave);
    for (const sp of api.beings.filter(b => b.species === 'sprite' && b.grove === g)) assert.ok(g.cave.tiles.some(t => t.x === sp.x && t.y === sp.y && t.z === sp.z), `${sp.name} is not in the hollow`);
    assert.ok(g.cave.story.some(s => s.includes('oldest hollow')));
  }
});

test('standing in a hollow costs the camp favour and the sprites notice', () => {
  /* Use the first test seed whose groves include one under a hill. */
  let A = null, g = null;
  for (const s of SEEDS){ const api = load(); api.startWorld(s); g = api.groves.find(g => g.cave); if (g){ A = api; break; } }
  assert.ok(g, 'no grove under a hill on any test seed');
  const person = A.beings[0]; const floor = g.cave.tiles.find(t => A.passable(t.x, t.y, t.z));
  person.x = floor.x; person.y = floor.y; person.z = floor.z; person.camp.fae.known = true;
  const before = person.camp.fae.favor;
  A.camp = person.camp; A.faeTick();
  assert.equal(person.camp.fae.favor, before - 5);
  assert.ok(person.thoughts.some(t => t.key === 'inhollow'));
  assert.ok(A.beings.some(b => b.species === 'sprite' && b.grove === g && b.thoughts.some(t => t.key === 'intruder')));
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/terrain.js`
Expected: the seed tests fail on a grove without `cave` on a hill sector; the favour test fails on `A.faeTick` not being a function.

- [ ] **Step 3: Add hollows under hills to `src/sim/world.js` after `spawnInDens`**

```js
/* A forest sector with a hill keeps its grove under the hill: a pocket of 3 to 5 tiles at level 0, the hollow on the innermost tile. */
function hollowUnderHill(sc, h){
  const set = new Set(h.tiles);
  const rim = shuffle(rimExits(h, set));
  for (const [exit, under] of rim){
    const ux = under % W, uy = (under - ux) / W;
    if (tileAt(ux, uy).cave) continue;
    const c = makeCave('hollow', h); c.owner = 'sprite';
    const mouth = carve(c, ux, uy, 0); c.mouth = mouth; c.exit = exit; exit.mouth = c;
    let x = ux, y = uy; const size = 3 + rint(3);
    for (let k = 1; k < size; k++){
      const opts = shuffle(DIRS).map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => inb(nx, ny) && set.has(idx(nx, ny)) && erodedBy(idx(nx, ny), set, 1) && !tileAt(nx, ny).cave);
      if (!opts.length) break;
      [x, y] = opts[0]; carve(c, x, y, 0);
    }
    if (c.tiles.length < 3){ for (const t of c.tiles){ t.cave = null; t.ground = 'rock'; } exit.mouth = null; caves.splice(caves.indexOf(c), 1); continue; }
    const inner = c.tiles[c.tiles.length - 1]; inner.feature = 'hollow'; inner.planted = tick - 300 * DAY;
    c.story.push('The oldest hollow in the valley.');
    const g = { x: inner.x, y: inner.y, sector: sc, anger: 0, swarmUntil: 0, lastBirth: tick, cave: c }; groves.push(g);
    for (const t of c.tiles){ if (t === inner || !passable(t.x, t.y, 0) || beings.some(b => b.x === t.x && b.y === t.y && b.z === 0)) continue; if (beings.filter(b => b.species === 'sprite' && b.grove === g).length >= 3) break; const sp = makeBeing('sprite', t.x, t.y, null, 0); sp.grove = g; beings.push(sp); }
    while (beings.filter(b => b.species === 'sprite' && b.grove === g).length < 3){ const t = c.tiles.find(t => t !== inner && passable(t.x, t.y, 0)); if (!t) break; const sp = makeBeing('sprite', t.x, t.y, null, 0); sp.grove = g; beings.push(sp); }
    return g;
  }
  return null;
}
```

In `generate()`, the grove loop reads:

```js
  for (const { sc } of forests){
    for (let tries = 0; tries < 300; tries++){
```

Change it to:

```js
  for (const { sc } of forests){
    const hill = hills.find(h => secOf(h.x, h.y).sx === sc.sx && secOf(h.x, h.y).sy === sc.sy);
    if (hill && hollowUnderHill(sc, hill)) continue;
    for (let tries = 0; tries < 300; tries++){
```

and in the pine branch, change `const g = { x: t.x, y: t.y, sector: sc, anger: 0, swarmUntil: 0, lastBirth: tick }; groves.push(g);` to `const g = { x: t.x, y: t.y, sector: sc, anger: 0, swarmUntil: 0, lastBirth: tick, cave: null }; groves.push(g);`.

The sprites dance with `legPath(a, g.x, g.y, 2)` at level 0, and the hollow tile is solid like the pine, so the pocket's other tiles are where they dance. A hill pocket is roofed by the floor above it, which Task 7 makes count.

- [ ] **Step 4: Favour for walking in, in `src/sim/fae.js`**

In `faeTick`, after the line that handles snares in a grove sector (the `for (const g of groves) if (camp.snares.some(...` line), add:

```js
  for (const g of groves) if (g.cave) for (const h of campHumans()){ const t = tileAt(h.x, h.y, h.z); if (!t || t.cave !== g.cave) continue;
    camp.fae.favor = Math.max(-100, camp.fae.favor - 5); addThought(h, 'inhollow', 'Stood in the sprites\' hollow. It felt watched', -3, 600);
    for (const o of beings) if (o.alive && o.species === 'sprite' && o.grove === g) addThought(o, 'intruder', `${h.name} came into our hollow`, -8, 1500); }
```

Add `faeTick,` to the API list in `src/sim/index.js` after `spawnInDens,`.

- [ ] **Step 5: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 41 pass.

- [ ] **Step 6: Run the soak, read the counts, and bless**

Run: `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"`
Expected: `ℹ fail 0`, every seed under 25000 ms. `seen`, `gifts`, `pranks`, and `favor` may move on seeds whose groves moved under a hill.

- [ ] **Step 7: Commit**

```bash
git add src/sim tests/terrain.js tests/soak-golden.json
git commit -m "Groves on forest hills live in a hollow under the hill; walking in costs favour

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Finds in the deep chambers

**Files:**
- Modify: `src/sim/world.js` (after `hollowUnderHill`, and `generate`)
- Modify: `src/sim/tasks.js` (`startGather`)
- Modify: `tests/soak-golden.json` (re-blessed)
- Test: `tests/terrain.js`

**Interfaces:**
- Consumes: `caves`, `addItem`, `rint`.
- Produces: `placeFinds()`; one item of kind `firestones`, `moss`, or `bones` on each water cave's `deep` tile.

- [ ] **Step 1: Write the failing tests**

Append to `tests/terrain.js`:

```js
for (const seed of SEEDS) test(`seed ${seed}: each deep chamber holds one find`, () => {
  const api = load(); api.startWorld(seed);
  for (const c of api.caves.filter(c => c.kind === 'water')){
    const here = api.items.filter(i => i.x === c.deep.x && i.y === c.deep.y && i.z === -2);
    assert.equal(here.length, 1, `deep chamber under hill ${c.hill.x},${c.hill.y} holds ${here.length} items`);
    assert.ok(['firestones', 'moss', 'bones'].includes(here[0].kind), here[0].kind);
    assert.equal(api.itemAt(c.deep.x, c.deep.y, -2), here[0]);
  }
  assert.ok(api.items.every(i => i.z >= 0 || (api.hasTile(i.x, i.y, i.z) && api.tileAt(i.x, i.y, i.z).cave)), 'no item lies in solid earth');
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/terrain.js`
Expected: six failures, `holds 0 items`.

- [ ] **Step 3: Place the finds, in `src/sim/world.js` after `hollowUnderHill`**

```js
/* Every deep chamber holds one thing worth the walk: firestones, glowing moss, or old bones. */
function placeFinds(){
  for (const c of caves) if (c.deep) addItem(['firestones', 'moss', 'bones'][rint(3)], c.deep.x, c.deep.y, c.deep.z);
}
```

In `generate()`, after the line `for (const t of world){ if (t.loose){ addItem(t.loose, t.x, t.y); delete t.loose; } }` add:

```js
  placeFinds();
```

- [ ] **Step 4: Gathering stays above ground, in `src/sim/tasks.js`**

In `startGather`, the first search goal reads `(x, y, z) => { const it = itemAt(x, y, z); if (it && it.kind === kind && !it.reservedBy){ found = it; return true; } return false; }`. Change the condition to `if (z >= 0 && it && it.kind === kind && !it.reservedBy)`. The second goal (the next item within 8) reads `const j = itemAt(x, y, z); if (j && j.kind === kind && ...`; change it to `if (z >= 0 && j && j.kind === kind && ...`. Searching the caves is phase 4's work, with a brand.

- [ ] **Step 5: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 47 pass.

- [ ] **Step 6: Run the soak, read the counts, and bless**

Run: `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"`
Expected: `ℹ fail 0`, every seed under 25000 ms, and `moss` unchanged or lower (nobody fetches moss from a cave).

- [ ] **Step 7: Commit**

```bash
git add src/sim tests/terrain.js tests/soak-golden.json
git commit -m "Finds in the deep chambers; gathering stays above ground

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The rules of the dark: no rain under rock, mild underground, and darkness without a brand

**Files:**
- Modify: `src/sim/beings.js` (`updateBeing`, `runTask`)
- Modify: `src/sim/index.js` (API)
- Modify: `tests/soak-golden.json` (re-blessed only if the record moves)
- Test: `tests/terrain.js`

**Interfaces:**
- Consumes: `hasTile`, `carve`, `makeCave`, `placeTile`.
- Produces: in `updateBeing`, `roofed` is true under any tile and underground; `cold` is 0.012 underground; a human below level 0 without an ember gets `a.inDark = true`, a `dark` thought, and their task fails; `runTask` moves a being in the dark every other call.

- [ ] **Step 1: Write the failing tests**

Append to `tests/terrain.js`:

```js
/* A hand-made cave: three stone tiles on level -1 under the start sector, the first a slope up to the surface. */
function makeCave3(api, x0, y0){
  for (let x = x0 - 1; x <= x0 + 4; x++) for (let y = y0 - 1; y <= y0 + 1; y++){ const t = api.tileAt(x, y); t.ground = 'grass'; t.feature = null; t.struct = null; t.fire = 0; t.slope = false; t.mouth = null; }
  const c = api.makeCave('water', null);
  const m = api.carve(c, x0, y0, -1); m.slope = true; c.mouth = m; c.exit = api.tileAt(x0 - 1, y0); c.exit.mouth = c;
  api.carve(c, x0 + 1, y0, -1); api.carve(c, x0 + 2, y0, -1);
  return c;
}

test('no rain falls under rock, and the ground below stays mild', () => {
  const api = load(); api.startWorld('r'); const x0 = 160, y0 = 62;
  makeCave3(api, x0, y0);
  api.tick = 60 * 1000 + 100; api.weather.storm = true; api.weather.until = api.tick + 500;
  const inside = api.beings[0]; inside.x = x0 + 1; inside.y = y0; inside.z = -1; inside.asleep = false; inside.needs.warmth = 50; inside.thoughts = [];
  api.updateBeing(inside);
  assert.ok(!inside.thoughts.some(t => t.key === 'wet'), 'no rain underground');
  assert.ok(inside.thoughts.some(t => t.key === 'dry'), 'dry under the rock');
  const under = 50 - inside.needs.warmth;
  const probe = api.beings[0]; probe.x = x0 - 1; probe.y = y0; probe.z = 0; probe.needs.warmth = 50; probe.thoughts = []; probe.task = null;
  api.updateBeing(probe);
  const above = 50 - probe.needs.warmth;
  assert.ok(under < above, `underground loss ${under} should be less than a winter night's ${above}`);
});

test('below the surface without a brand it is too dark to work, and walking is slow', () => {
  const api = load(); api.startWorld('r'); const x0 = 160, y0 = 62;
  makeCave3(api, x0, y0);
  const a = api.beings[0]; a.x = x0 + 2; a.y = y0; a.z = -1; a.asleep = false; a.carrying = null; a.thoughts = []; a.cooldown = {};
  for (const k in a.needs) a.needs[k] = 90;
  a.task = { type: 'wander', label: 'Feeling along the wall', path: [[x0 + 1, y0, -1], [x0, y0, -1]], arrive: () => 'done', started: api.tick, key: 'wander' };
  api.updateBeing(a);
  assert.ok(a.thoughts.some(t => t.key === 'dark'), 'a dark thought');
  assert.equal(a.inDark, true);
  const x1 = a.x; let moved = 0;
  a.task = { type: 'wander', label: 'Feeling along the wall', path: [[x0 + 1, y0, -1], [x0, y0, -1]], arrive: () => 'done', started: api.tick, key: 'wander' };
  for (let k = 0; k < 4; k++){ const bx = a.x; api.runTask(a); if (a.x !== bx) moved++; }
  assert.equal(moved, 2, 'two steps in four calls: half speed');
  a.x = x0 + 2; a.carrying = { kind: 'ember', count: 1, dies: api.tick + 400 }; a.thoughts = [];
  a.task = { type: 'wander', label: 'Going in with a brand', path: [[x0 + 1, y0, -1]], arrive: () => 'done', started: api.tick, key: 'wander' };
  api.updateBeing(a);
  assert.ok(!a.thoughts.some(t => t.key === 'dark'), 'a brand lights the way');
  assert.ok(a.task, 'the task goes on with a brand');
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/terrain.js`
Expected: both new tests fail (`api.tick` cannot be set, or `wet` is present).

- [ ] **Step 3: Rain and warmth under a roof, in `src/sim/beings.js` `updateBeing`**

Replace the two lines

```js
    const season = seasonOf(), cold = season === 'winter' ? (night ? 0.06 : 0.025) : season === 'summer' ? 0 : (night ? 0.012 : 0.003);
    const byFire = camp && pitLit() && nearAt(a, ...camp.pit) <= 3, roofed = camp && sleepPlaces().some(pl => nearAt(a, ...pl) <= 1);
```

with

```js
    const season = seasonOf(), under = a.z < 0, cold = under ? 0.012 : season === 'winter' ? (night ? 0.06 : 0.025) : season === 'summer' ? 0 : (night ? 0.012 : 0.003);
    const byFire = camp && pitLit() && nearAt(a, ...camp.pit) <= 3, roofed = under || hasTile(a.x, a.y, a.z + 1) || (camp && sleepPlaces().some(pl => nearAt(a, ...pl) <= 1));
```

Underground the rate is the spring-night rate all year, and a roof of rock or floor counts like a roof of logs: no rain, warmth held.

- [ ] **Step 4: The dark, in `src/sim/beings.js`**

In `updateBeing`, directly after the block

```js
  if (a.asleep){
    ...
    else { a.status = 'Sleeping'; return; }
  }
```

add:

```js
  /* Below the surface it is dark. Without a burning ember a person cannot see to work, and feels their way out at half speed. */
  a.inDark = a.species === 'human' && a.z < 0 && !(a.carrying && a.carrying.kind === 'ember');
  if (a.inDark && !hasThought(a, 'dark')){ addThought(a, 'dark', 'It is too dark down here to see', -6, 400); if (a.task) failTask(a); }
```

In `runTask`, change

```js
  if (t.path.length){
    const [nx, ny, nz] = t.path[0];
```

to

```js
  if (t.path.length){
    if (a.inDark){ a.darkStep = !a.darkStep; if (a.darkStep) return; }
    const [nx, ny, nz] = t.path[0];
```

- [ ] **Step 5: API**

In `src/sim/index.js`, add `updateBeing,` after `runTask,`, and change `get tick(){ return tick; },` to `get tick(){ return tick; }, set tick(v){ tick = v; },`.

- [ ] **Step 6: Run the terrain tests**

Run: `node tests/terrain.js`
Expected: 49 pass. The warmth test compares one tick underground against one tick on the surface for the same person on a winter night; if `under` is not less than `above`, check that `api.tick = 60100` landed in winter (day 61 is the second winter day) and at night (hour 2).

- [ ] **Step 7: Run the soak**

Run: `node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"`
Expected: `ℹ pass 44`, `ℹ fail 0`. Nobody goes underground yet and `hasTile(a.x, a.y, 1)` is false everywhere people stand, so the golden record should still match. If it moved, someone stood on a pocket tile at level 0 under a hill (a den mouth beside a path is walkable); read the counts and bless with `UPDATE_GOLDEN=1 node tests/soak.js`.

- [ ] **Step 8: Commit**

```bash
git add src/sim tests/terrain.js tests/soak-golden.json
git commit -m "The rules of the dark: no rain under rock, mild underground, and no work without a brand

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Cave mouths, cave and den cards, and the dark, in the page

**Files:**
- Modify: `src/ui.js` (`drawLoc`, `drawWorldCache`, `sectorSummary`, `inspectTile`, `inspectBeing`)
- Modify: `src/page.template.html` (legend)
- Modify: `tests/browser-shot.py`

**Interfaces:**
- Consumes: `t.mouth`, `t.cave`, `cave.kind/owner/story/blocked`, `a.den`, `a.inDark`, `caves`.

- [ ] **Step 1: Legend in `src/page.template.html`**

After `<span><b>◢</b>slope</span>` add `<span><b>◠</b>cave mouth</span>`.

- [ ] **Step 2: Drawing in `src/ui.js`**

In `drawLoc`, after the line `if (t.ground === 'stone'){ bg = P.stone; if (h % 5 === 0){ g = '·'; fg = P['stone-fg']; } }` add:

```js
    if (t.mouth && t.z === 0){ g = '◠'; fg = P['hill-fg']; }
```

In `drawWorldCache`, after the line `if (t.ground === 'rock'){ const up = ...; }` add:

```js
    if (t.mouth) c = P['hill-fg'];
```

In `sectorSummary`, after the `const hs = hills.filter(...)` line add:

```js
  const cs = caves.filter(c => c.exit && secOf(c.exit.x, c.exit.y).sx === s.sx && secOf(c.exit.x, c.exit.y).sy === s.sy);
```

and after the hills entry in `parts` add: `cs.length ? `${cs.length} cave mouth${cs.length > 1 ? 's' : ''}` : ''`.

- [ ] **Step 3: Tile cards in `src/ui.js` `inspectTile`**

After the `Slope` row line add:

```js
  if (t.mouth) rows.push(['Cave mouth', `a way ${t.mouth.kind === 'den' && t.mouth.mouth.z === 0 ? 'in' : 'down'}. ${t.mouth.story.join(' ')}`]);
  if (t.cave) rows.push([t.cave.kind === 'den' ? 'Den' : t.cave.kind === 'hollow' ? 'Hollow' : 'Cave', `${t.cave.story.join(' ')}${t.cave.owner ? ` ${t.cave.owner === 'sprite' ? 'Sprites' : t.cave.owner === 'wolf' ? 'Wolves' : 'Foxes'} live here.` : ''}`]);
  if (t.cave && t.cave.blocked === t) rows.push(['Fallen rock', 'blocks the way. Tools could clear it.']);
  if (z < 0) rows.push(['Dark', 'People need a burning ember down here.']);
```

In the open-air branch at the top of `inspectTile`, the text for `z < 0` already says "Solid earth. Nothing is dug here."; leave it.

- [ ] **Step 4: Being cards in `src/ui.js` `inspectBeing`**

In the non-human `extra` chips, after the `a.grove` chip expression add:

```js
${a.den ? `<span class="chip">den under the hill at ${a.den.hill.x},${a.den.hill.y}</span>` : ''}
```

In the human `extra`, before `<h3>Personality</h3>` add: `${a.inDark ? '<div class="muted">In the dark without a brand.</div>' : ''}`.

- [ ] **Step 5: Build and check in the browser**

Run: `node --check src/ui.js && node build.js`

Replace the body of `tests/browser-shot.py` after the `print('camps', ...)` line with:

```python
    c=pg.evaluate("(()=>{const c=caves.find(c=>c.kind==='water'); const s=secOf(c.exit.x,c.exit.y); goto(s.sx,s.sy); return [c.exit.x,c.exit.y,c.mouth.x,c.mouth.y,s.sx,s.sy,c.story.join(' ')]})()")
    print('cave', c, pg.inner_text('#where'))
    box=pg.query_selector('#map').bounding_box()
    pg.mouse.move(box['x']+((c[0]-c[4]*28)+.5)*box['width']/28, box['y']+((c[1]-c[5]*20)+.5)*box['height']/20); pg.wait_for_timeout(300)
    print('mouth card:', pg.inner_text('#tip').replace('\n',' | ')[:220])
    pg.screenshot(path='cave-surface.png')
    pg.keyboard.press('['); pg.wait_for_timeout(300); print('level', pg.inner_text('#level'))
    pg.mouse.move(box['x']+((c[2]-c[4]*28)+.5)*box['width']/28, box['y']+((c[3]-c[5]*20)+.5)*box['height']/20); pg.wait_for_timeout(300)
    print('inside card:', pg.inner_text('#tip').replace('\n',' | ')[:220])
    pg.screenshot(path='cave-level-1.png')
    print('errors', errs); b.close()
```

Run: `python3 tests/browser-shot.py`
Expected: `mouth card:` mentions "Cave mouth" and "Water cut", `level Level -1`, `inside card:` mentions "stone floor", "Cave", and "Dark", `errors []`. Open both PNGs with the Read tool: the surface view shows a `◠` at the hill foot; level −1 shows the passage as stone floor in a field of dark earth. Delete the PNGs.

- [ ] **Step 6: Commit**

```bash
git add src/ui.js src/page.template.html dist/hearth-sim.html tests/browser-shot.py
git commit -m "Cave mouths on the map, cave and den cards, and the dark row

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Record the pre-history

**Files:**
- Modify: `design/notes.md` (sections 2, 10, 11, 14, known weak spots)
- Modify: `README.md`

- [ ] **Step 1: Design notes**

In section 2, after the slopes bullet, add:

```
- Under every tall hill a stream once ran. It cut a winding passage 8 to 20 tiles long from under the hill to a mouth at the foot, with a chamber or two and a drop to level −2. One stream in three still runs and leaves a pond at the mouth. Rock fell after: boulders at the feet, and one passage in four blocked by fallen rock until someone has tools.
- Foxes and wolves dug dens into the hillsides: pockets of two to six tiles inside the rock, or burrows under a slope. Each has one mouth. The wolf pair and the three foxes start at home and remember it.
- Every deep chamber holds one find: firestones, glowing moss, or old bones. Gathering never goes below the surface. Fetching a find is a later goal.
- Below the surface there is no rain, the warmth falls at the spring-night rate all year, and it is dark. A person down there without a burning ember cannot see to work: their task fails and they feel their way out at half speed. Foxes, wolves, and sprites see in the dark.
```

In section 11 (The sprites), after the first paragraph add: `A grove on a forest hill lives in a hollow under the hill instead of a pine: a pocket in the rock with the hollow on its innermost tile and a mouth at the foot. A person who stands in the hollow costs the camp 5 favour every 300 ticks, and the sprites remember who came in.`

In section 14, extend the terrain-test sentence: after "out of the start sector" add `, every tall hill has a water cave whose floors can be reached from its exit unless rock blocks it, every den has one mouth and its owners start in it, a grove on a forest hill is in a hollow under it, every deep chamber holds one find, and no rain or work reaches the dark`.

In "Known weak spots", replace the bullet that begins `- Some readers still see only the surface` with:

```
- Some readers still see only the surface: plants grow on the surface, sector resource counts read the surface, lightning strikes surface tiles, and ash on a hill floor never returns to grass.
- Dens exist but nobody uses them yet. Sleeping in a den, carrying prey home, births, and defence are phase 3 of topography. Finds lie in the deep until phase 4 gives people a reason to go.
```

- [ ] **Step 2: README**

Nothing in the commands changed. Add one sentence to the description line in `README.md` if it lists features; otherwise leave it.

- [ ] **Step 3: Run everything once more**

Run: `node tests/terrain.js 2>&1 | grep -E "^ℹ (pass|fail)" && node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail)|✖" && node build.js`
Expected: terrain 49 pass, soak `ℹ pass 44`, `ℹ fail 0`, page built.

- [ ] **Step 4: Commit**

```bash
git add design/notes.md README.md
git commit -m "Notes: caves, dens, hollows under hills, finds, and the rules of the dark

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

- Spec coverage for phase 2: Water (Task 2: winding passage 8 to 20, chambers, drop to −2, pond one in three, story), Rockfall (Task 3: boulders at feet, one in four blocked, story), Dens (Task 4: pockets 2 to 6 at level 0 or burrows 2 to 4 at −1, one mouth, stories, wolves and foxes start there and remember), Groves (Task 5: hollow under a forest hill, story, favour for walking in and a thought for the sprites; axes and snares in the sector already count through `g.sector`), Finds (Task 6), Populate (Tasks 4 and 5), weather and fire underground (Task 7: rain, mild warmth, dark; fire underground needs no change since caves hold nothing that burns), tile cards and legend (Task 8), terrain test rows (Tasks 2 to 7), notes (Task 9). Cave mouths on the world map (Task 8).
- Not in this phase: sleeping in dens, carrying prey home, den births, defence, contention, deer on high ground (phase 3); quarrying, searching the cave, clearing a den, camp-site scoring, the god-interface changes (phase 4).
- Names used across tasks: `caves`, `makeCave`, `carve`, `keepsPaths`, `rimExits`, `cutWaterCaves`, `chamber`, `rockfall`, `digDens`, `digDen`, `spawnInDens`, `hollowUnderHill`, `placeFinds`, `faeTick` (existing), tile fields `cave`, `mouth`, cave fields `kind`, `hill`, `owner`, `tiles`, `mouth`, `exit`, `deep`, `blocked`, `story`, being fields `den`, `inDark`, `darkStep`, grove field `cave`, item kinds `firestones`, `bones`. Each is defined in the task that first uses it.
- The Task 5 favour test looks across the six seeds for a grove under a hill, because not every seed has a forest hill.
