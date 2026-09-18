# Mythos plan 3: settle, from marks to tiles

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every world begins with its creation. `startWorld` runs the ages, and when the last god sleeps, settle paints the valley from the marks: biomes per country, the river along the wet god's boundaries, hills from height marks, caves from depth, scars, and creatures from the makings. The gods sleep in their bodies on the map. The golden record moves, once per task, and is blessed each time after the counts are read.

**Architecture:** `src/sim/settle.js` holds `settle()` and the painters, in a fixed order, each reading marks and writing tiles. `generate()` is taken apart: its ground loop becomes the ground painter, `uplift`, `cutWaterCaves`, `digDens`, `digGnomeBurrows`, and the grove and animal spawns each gain a `within` argument (a set of tile indices) so a painter can point them at a country. Settle runs outside the god stream, so painting draws from the people's stream where `resetState` left it. A tile check at the end of settle decides whether the world holds a life; if not, settle is discarded and the last sleeper wakes. `startWorld(seed, opts)` becomes `resetState`, `beginCreation`, `runAges`, and the ages end in settle.

**Tech Stack:** Plain JavaScript scripts sharing one scope under `src/sim/`. Node's built-in test runner.

## Global Constraints

- Spec: `design/specs/2026-09-17-mythos-design.md`, sections 3 (the gate, amended below), 4, 5 (bodies, the stream, the `godsTick` slot only), 8, 9, and plan 3 of section 10. Read the end of `design/plans/2026-09-17-mythos-plan-2-field-and-gods.md`, "Known and deferred to plan 3", first.
- Work in `/Users/earchibald/Worktrees/hamlet-mythos` on branch `mythos`. Never touch `~/Code/hamlet`.
- Files in `src/sim/` are plain scripts. No `import`, no `export`. `settle.js` loads after `world.js` and `gods.js` and before `main.js`.
- Rules read tables. No painter reads a god's name. No painter checks a species name: what to spawn comes from the making marks and the `SPECIES` table. Noise stays for texture inside a country; nothing but marks shapes the world.
- Settle runs outside `withGodRng`. Painters draw from the people's stream. This is a decision: a seed's valley depends on its marks and its seed, never on how many ages the gods took.
- Every task moves every seed's story, because `startWorld` now runs the creation. After a task's own tests pass, run `node tests/soak.js`, read the printed counts against the previous task's, and if every assertion holds and the move is what the task meant, bless with `UPDATE_GOLDEN=1 node tests/soak.js`. The PR says the golden moved. A soak assertion that fails is a bug, not a number to bless.
- The soak's death rule holds: any death that is not old age is a bug until traced with `tests/trace-deaths.js`.
- Time budget: 25 seconds per seed in the soak, ages and settle included.
- Every behaviour visible: a hill, cave, scar, grove, and sector carries the mark that made it, and its card (plan 4) reads it.
- Commit after every task on branch `mythos`. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn`.
- Run `node build.js` after every change to `src/` and commit `dist/hearth-sim.html` with it.

## Decisions this plan makes, to be written into the spec by Task 5

1. **The gate needs a hill and a cave.** The day era's life dens, digs, and hides finds in the deep. The checker gains two items: a height mark and a depth mark exist somewhere on the field. Lacks `height` and `depth` strain `above` and `below`.
2. **Who makes what, widened.** `MAKES = { wet: ['deer'], above: ['deer'], dark: ['sprite', 'fox'], light: ['sprite'], still: ['fox'], cold: ['wolf'], moving: ['wolf'], hot: ['rabbit'], dry: ['rabbit'], below: ['gnome'] }`. The gnomes are the below god's people. `tests/ages.js` asserts every soak seed makes every species.
3. **A country's hills and caves.** A height mark of value n paints one to three hills in the country, storeys `min(n, ZMAX)`. A depth mark of value n paints caves under that country's hills, levels `min(n, -ZMIN)`, and raises one low hill first if the country has none, since a cave mouth needs rock.
4. **The river.** Every live boundary drawn by a wet god is river: the boundary tiles and their far-side neighbours are water, the next ring is sand, and every forty-seventh tile along the line is a ford of sand. A pool mark paints a lake in the country's middle, a blob of about a seventh of the country's area. Marsh is the wetland biome's own texture.
5. **Scars.** Burned: the country's ground is ash and it has no features. Cut: a chasm of rock along the country's longer axis with a gap of stone floor in the middle so the world stays joined. Drowned: three water blobs with dead pines around them, a new feature `deadpine` (solid, wood, fuel 30). Broken: boulders on a third of the tiles. Hallowed: nothing painted; the tile keeps the mark.
6. **The first person** stands in the gate's start country, at its most central passable tile. The start region's sector is not forced to meadow.
7. **A discarded settle** resets `levels`, `world`, `raised`, `hills`, `caves`, `groves`, `items`, `itemGrid`, `sectors`, removes every being that is not a god, and wakes the last sleeper with rest 60 and the thought "The world would not hold." The people's stream stays where the failed paint left it, so the next paint differs. That is deterministic and acceptable.
8. **Bodies.** A sleeping god stands at its body: above on its country's tallest hill at its top storey, below at a cave's deep tile, wet on a river tile, still on a lake tile, and any other at the anchor of its rest mark. The hill, cave, or region record gets `god: id`. Dead gods stay in `beings`. Nothing in the day era ticks a god; `godsTick()` runs once a day at the end of `updateWorld()` inside `withGodRng` and, in this plan, does nothing but exist.

---

## File map

| File | Change |
|---|---|
| `src/sim/gods.js` | Gate items 6 and 7, `STRAIN` rows, `MAKES` widened, `settle()` moved out, `ageStep` calls settle after the stream wrapper, `godsTick()`. |
| `src/sim/settle.js` | New. `settle()`, the painters, the tile check, `discardSettle()`, `placeBodies()`. |
| `src/sim/world.js` | `generate()` removed. Its ground loop becomes `paintGround(within, biome)`. `uplift(within, storeys, count)`, `cutWaterCaves(hillsOf, levels, wetUnder)`, `digDens(within)`, `digGnomeBurrows(within)`, `spawnAnimal(sp, within, n)`, `placeGrove(within)` all take a tile set. `FEATURES.deadpine`. |
| `src/sim/core.js` | `GROUND.ash` already exists. `FEATURES.deadpine`. |
| `src/sim/main.js` | `startWorld` runs the creation. `updateWorld` gains `godsTick()` last. The beings filter keeps gods. |
| `src/sim/index.js` | `settle` in `FILES`. API additions. |
| `tests/lib/run.js` | `legends` in the fingerprint. |
| `tests/soak.js` | Creation assertions. |
| `tests/terrain.js`, `tests/gnomes.js`, `tests/dwellers.js`, `tests/closing.js` | Fixed-shape assertions read the marks. |
| `tests/settle.js` | New. The painters, one at a time, on a hand-marked field. |
| `tests/ages.js` | Soak seeds make every species; every seed has a height and a depth mark. |
| `design/notes.md`, `design/specs/2026-09-17-mythos-design.md`, `design/settings.md` | Task 5. |

---

### Task 1: The gate needs a hill and a cave, and every people is made

**Files:**
- Modify: `src/sim/gods.js` (`MAKES`, `STRAIN`, `restGate`, `backstop`)
- Modify: `tests/gods.js`, `tests/ages.js`

**Interfaces:**
- Produces: `restGate()` lacks now include `height` and `depth`, checked after `people`. `MAKES` as in decision 2. `backstop` handles the two new lacks by marking the largest live region with `height` 1 or `depth` 1.

- [ ] **Step 1: Write the failing tests**

Append to `tests/gods.js`:

```js
test('the gate wants a hill and a cave, and the lacks strain above and below', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const [a] = api.awakeGods(); const r = api.regionById(a.region);
  /* Build a world that passes every old item, then check the two new ones in order. */
  api.setPole(r, 'dry', a, ''); for (const n of api.neighboursOf(r)) api.setPole(n, 'wet', a, '');
  api.setPole(r, 'hot', a, '');
  api.mark(r, 'making', 'rabbit', a, ''); api.mark(r, 'making', 'human', a, '');
  assert.equal(api.restGate().lack, 'height');
  api.mark(r, 'height', 1, a, '');
  assert.equal(api.restGate().lack, 'depth');
  api.mark(r, 'depth', 1, a, '');
  assert.equal(api.restGate().ok, true);
  assert.deepEqual(api.STRAIN.height, ['above']); assert.deepEqual(api.STRAIN.depth, ['below']);
  assert.deepEqual(api.MAKES.below, ['gnome']); assert.ok(api.MAKES.light.includes('sprite'));
});
```

Note: `r` has a height mark now, so `isStart(r)` is false; the gate's start must be another region. Make the test robust: mark `height` and `depth` on a *neighbour* `n0 = api.neighboursOf(r)[0]` instead of `r`. Use that in the two `api.mark(...)` lines.

In `tests/ages.js`, after the existing per-seed assertions, add:

```js
    assert.ok(api.liveRegions().some(r => api.marksOf(r, 'height').length), 'nothing raised');
    assert.ok(api.liveRegions().some(r => api.marksOf(r, 'depth').length), 'nothing dug');
    if (SOAK_SEEDS.includes(seed)) for (const sp of ['rabbit', 'deer', 'fox', 'wolf', 'sprite', 'gnome', 'human']) assert.ok(species.includes(sp), `soak seed ${seed} never made the ${api.SPECIES[sp].plural}`);
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/gods.js tests/ages.js 2>&1 | grep -E "^not ok|ℹ (pass|fail)"`
Expected: the new gods test fails on `lack`, and the ages test fails on seeds without a height mark.

- [ ] **Step 3: Implement**

In `src/sim/gods.js`:

```js
const MAKES = { wet: ['deer'], above: ['deer'], dark: ['sprite', 'fox'], light: ['sprite'], still: ['fox'], cold: ['wolf'], moving: ['wolf'], hot: ['rabbit'], dry: ['rabbit'], below: ['gnome'] };
const STRAIN = { start: ['dry'], water: ['wet'], fuel: ['hot', 'cold'], food: ['hot', 'wet'], people: [], height: ['above'], depth: ['below'] };
```

In `restGate`, after `people` is computed, add `const raised = live.some(r => marksOf(r, 'height').length), dug = live.some(r => marksOf(r, 'depth').length);` and change the pass condition to `if (water && fuel && food && people && raised && dug) return { ok: true, start: s };` and the lack line to `if (!lack) lack = !water ? 'water' : !fuel ? 'fuel' : !food ? 'food' : !people ? 'people' : !raised ? 'height' : 'depth';`. Update the comment above `restGate`: "and a hill and a cave somewhere, since the life the day era knows dens, digs, and hides its finds in the deep."

In `backstop`, add two branches: `else if (gate.lack === 'height'){ const r = live.slice().sort((p, q) => q.area - p.area)[0]; mark(r, 'height', 1, g, 'Raised so the world could hold a life.'); } else if (gate.lack === 'depth'){ const r = live.slice().sort((p, q) => q.area - p.area)[0]; mark(r, 'depth', 1, g, 'Dug so the world could hold a life.'); }`.

`strain(lack)` needs no change: `STRAIN[lack]` now exists for every lack, and the `people` branch returns before reading it.

- [ ] **Step 4: Run, read the ages report, tune only `MAKES`**

Run: `node --test tests/gods.js tests/ages.js 2>&1 | grep -E "ages |^not ok|ℹ (pass|fail)"`
Expected: all pass. If a soak seed lacks a species, add that species to one more pole in `MAKES` (a table change, no rule change), rerun, and note it in the report. Do not touch scores or the gate.

Then: `npm run fast && node tests/soak.js`. Expected: green, golden unmoved (nothing in the day era changed).

- [ ] **Step 5: Build and commit**

```bash
node build.js
git add src/sim/gods.js tests/gods.js tests/ages.js dist/hearth-sim.html
git commit -m "The gate wants a hill and a cave, and every people is made

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn"
```

---

### Task 2: Settle paints the ground, and every world begins with its creation

**Files:**
- Create: `src/sim/settle.js`
- Modify: `src/sim/world.js` (`generate` → painters), `src/sim/gods.js` (`settle` moved, `ageStep`), `src/sim/main.js` (`startWorld`), `src/sim/index.js`
- Modify: `tests/lib/run.js` (fingerprint)
- Test: `tests/settle.js`

**Interfaces:**
- Consumes: `creation.gate.start`, `liveRegions`, `regionAt`, `regionOf`, `liveBoundaries`, `biomeOf`, `marksOf`, `hasMark`, `makeNoise`, `makeTile`, `takeName`, `makeBeing`.
- Produces: `settle()` in `settle.js`: paints, places the first person, flips the era, and logs the first day-era line. `paintSectors()`: each sector gets `biome` (the biome of the region covering most of its tiles), `name`, and `country` (that region's id). `paintGround()`: the tile loop, per tile `biomeOf(regionAt(x, y))`, plus `paintRivers()`, `paintLakes()`. `placeFirstPerson()`: in `creation.gate.start`. `startWorld(seed, opts)` = `resetState`, `beginCreation()`, `runAges()`. `beginCreation()` is `startCreation` without the reset. In `ageStep`, settle is called after the `withGodRng` wrapper via a flag. The old `uplift`, `cutWaterCaves`, `rockfall`, `digDens`, `placeFinds`, animal spawns, `digGnomeBurrows`, and groves still run in this task, as today, after the ground, from `settle()`; Tasks 3 and 4 make them read marks.

- [ ] **Step 1: Write the failing test**

Create `tests/settle.js`:

```js
// Settle: from marks to tiles. Each painter on a hand-marked field, then a whole world.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('every world begins with its creation, and the first person stands in the start country', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.era, 'days');
  assert.ok(api.creation.settled && api.creation.gate.ok);
  assert.ok(api.legends.length > 5);
  assert.ok(api.chronicle.some(e => /walks alone into the/.test(e.text)), 'no first day-era line');
  const a = api.beings.find(b => b.species === 'human');
  assert.ok(a, 'no first person');
  assert.equal(api.regionAt(a.x, a.y).id, api.creation.gate.start.id);
  assert.ok(api.passable(a.x, a.y, 0));
  for (const g of api.gods()) assert.ok(g.status === 'asleep' || g.status === 'dead');
});

test('sectors take the biome of the country that covers most of them', () => {
  const api = load(); api.startWorld('r');
  for (const s of api.sectors){
    assert.ok(['meadow', 'forest', 'rocky', 'wetland', 'river', 'ash'].includes(s.biome), s.biome);
    assert.ok(api.regionById(s.country), 'a sector without a country');
    assert.equal(s.name, api.BIOMES[s.biome].name);
  }
});

test('the river runs along the wet god\'s live boundaries, with fords', () => {
  const api = load(); api.startWorld('r');
  const wet = api.liveBoundaries().filter(b => b.pole === 'wet');
  if (!wet.length) return;
  let water = 0, ford = 0;
  for (const b of wet) for (const i of b.tiles){ const t = api.world[i]; if (t.ground === 'water') water++; else if (t.ground === 'sand') ford++; }
  assert.ok(water > 0, 'no water on a wet boundary');
  assert.ok(ford > 0 || wet.every(b => b.tiles.length < 47), 'a long river with no ford');
});

test('a pool mark paints a lake', () => {
  const api = load(); api.startCreation('r'); api.runAges();
  const pooled = api.liveRegions().find(r => api.hasMark(r, 'pool', 'surface'));
  if (!pooled) return;
  const n = pooled.tiles.filter(i => api.world[i].ground === 'water').length;
  assert.ok(n >= pooled.area / 12, `a pooled country with ${n} water tiles`);
});

test('the same seed paints the same valley twice', () => {
  const a = load(); a.startWorld('x'); const b = load(); b.startWorld('x');
  assert.deepEqual(a.world.map(t => t.ground + (t.feature || '')).join(''), b.world.map(t => t.ground + (t.feature || '')).join(''));
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/settle.js`
Expected: FAIL: `api.creation` is null after `startWorld`.

- [ ] **Step 3: Take `generate()` apart**

In `src/sim/world.js`:

1. Add `FEATURES.deadpine` in `src/sim/core.js`: `deadpine: { name: 'dead pine, drowned standing', solid: true, mat: 'wood', fuel: 30 },`. Add to `BIOMES`: `river: { name: 'Riverside' }, ash: { name: 'Burnt ground' }`.
2. Replace the top of `generate()` (the sectors loop through the end of the tile loop) with three functions. Keep the rest of `generate()`'s body as `generateRest(best)`, for this task only, taking the first person's tile.

```js
/* ---------- settle's ground painters ---------- */
/* A sector takes the biome of the country that covers most of its tiles, and remembers that country. */
function paintSectors(){
  sectors = [];
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < SW; sx++){
    const count = new Map();
    for (let y = sy * LH; y < (sy + 1) * LH; y++) for (let x = sx * LW; x < (sx + 1) * LW; x++){ const id = regionOf[idx(x, y)]; count.set(id, (count.get(id) || 0) + 1); }
    const top = [...count.entries()].sort((p, q) => q[1] - p[1])[0][0];
    const r = regionById(top); const biome = biomeOf(r);
    sectors.push({ sx, sy, biome, name: BIOMES[biome].name, country: r.id });
  }
}
/* The tile texture of a biome. Noise decides where the trees stand; the biome comes from the country's marks. */
function paintTile(t, biome, e, f){
  let loose = null;
  switch (biome){
    case 'forest':
      if (f > 0.4 && rng() < 0.55) t.feature = 'tree';
      else if (rng() < 0.12) loose = 'stick';
      else if (rng() < 0.02){ t.feature = 'bush'; t.berries = rint(3); }
      break;
    case 'meadow': case 'river':
      if (f > 0.7 && rng() < 0.3) t.feature = 'tree';
      else if (rng() < 0.045){ t.feature = 'bush'; t.berries = 1 + rint(4); }
      else if (rng() < 0.02) loose = 'stick';
      else if (rng() < 0.015) loose = 'rock';
      else if (e < 0.3 && rng() < 0.2) t.ground = 'soil';
      break;
    case 'rocky':
      if (e > 0.55 && rng() < 0.5) t.feature = 'boulder';
      else if (rng() < 0.11) loose = 'rock';
      else if (rng() < 0.03) t.feature = 'tree';
      else if (rng() < 0.01){ t.feature = 'bush'; t.berries = rint(3); }
      else if (rng() < 0.3) t.ground = 'soil';
      break;
    case 'wetland':
      if (e < 0.42) t.ground = 'water';
      else if (e < 0.5 && rng() < 0.5) t.feature = 'reeds';
      else if (rng() < 0.03){ t.feature = 'bush'; t.berries = 1 + rint(3); }
      else if (rng() < 0.03) loose = 'stick';
      else if (rng() < 0.04) t.feature = 'tree';
      break;
    case 'ash':
      t.ground = 'ash';
      if (rng() < 0.05) loose = 'stick';
      break;
  }
  if (t.feature === 'tree') t.planted = tick - rint(100 * DAY); else if (t.feature === 'bush') t.planted = tick - rint(60 * DAY);
  if (loose) t.loose = loose;
}
/* Every tile of the surface, from its country's biome. Levels are made fresh. */
function paintGround(){
  const en = makeNoise(9), fn = makeNoise(5);
  levels = []; for (let z = ZMIN; z <= ZMAX; z++) levels.push(new Array(W * H).fill(null)); world = levels[ZOFF]; raised = []; hills = []; caves = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const t = makeTile(x, y, 0, 'grass'); const r = regionAt(x, y);
    t.country = r.id;
    paintTile(t, biomeOf(r), en(x, y), fn(x, y));
    world[idx(x, y)] = t;
  }
}
/* The river: every live boundary a wet god drew. The line and its far side are water, the next ring is sand,
   and every forty-seventh tile along the line is a ford. */
function paintRivers(){
  for (const b of liveBoundaries()){
    if (b.pole !== 'wet') continue;
    b.tiles.forEach((i, k) => {
      const x = i % W, y = (i - x) / W; const ford = k % 47 >= 23 && k % 47 < 26;
      /* The line tile itself, and its neighbours on the far side of the cut. */
      const wet = [[0, 0]].concat(DIRS.filter(([dx, dy]) => inb(x + dx, y + dy) && regionOf[idx(x + dx, y + dy)] === b.b));
      for (const [dx, dy] of wet){ const t = world[idx(x + dx, y + dy)]; t.ground = ford ? 'sand' : 'water'; t.feature = null; t.berries = 0; t.loose = null; t.river = b.id; }
    });
    for (const i of b.tiles){ const x = i % W, y = (i - x) / W;
      for (const [dx, dy] of RING){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const t = world[idx(nx, ny)]; if (t.ground !== 'water' && !t.river){ t.ground = 'sand'; t.feature = null; t.berries = 0; if (rng() < 0.08) t.loose = 'rock'; } } }
  }
}
/* A lake in the middle of a pooled country: a blob of about a seventh of its area. */
function paintLakes(){
  for (const r of liveRegions()){
    if (!hasMark(r, 'pool', 'surface')) continue;
    const { x0, y0, x1, y1 } = r.bbox; const cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1;
    const want = Math.round(r.area / 7); const jit = makeNoise(6); const set = new Set(r.tiles);
    const rad = Math.sqrt(want / Math.PI);
    for (const i of r.tiles){ const x = i % W, y = (i - x) / W; const d = Math.hypot(x - cx, y - cy) / rad + (jit(x, y) - 0.5) * 0.6; if (d <= 1){ const t = world[i]; t.ground = 'water'; t.feature = null; t.berries = 0; t.loose = null; t.lake = r.id; } }
    for (const i of r.tiles){ const t = world[i]; if (t.ground === 'water') continue; if (RING.some(([dx, dy]) => inb(t.x + dx, t.y + dy) && world[idx(t.x + dx, t.y + dy)].lake)){ t.ground = 'sand'; t.feature = t.feature === 'tree' ? null : t.feature; } }
  }
}
/* The first person: the start country's most central passable tile. */
function placeFirstPerson(){
  const s = creation.gate.start; const { x0, y0, x1, y1 } = s.bbox; const cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1;
  let best = null;
  for (const i of s.tiles){ const x = i % W, y = (i - x) / W; if (!passable(x, y)) continue; const d = dist(x, y, cx, cy); if (!best || d < best.d) best = { x, y, d }; }
  const first = makeBeing('human', best.x, best.y, takeName(), rint(360)); first.camp = camp; beings.push(first);
  return best;
}
```

`generateRest(best)` keeps, in order, exactly what followed the tile loop in `generate()`: the `startRegion` from `best`, `uplift()`, `startRegion`, `cutWaterCaves(); rockfall();`, `startRegion`, `digDens()`, items from `t.loose`, `placeFinds()`, the animals (`spawnAnimal` as today, with `best`), `digGnomeBurrows()`, the groves, and the deer. Delete the old first-person block from it (the person is placed before it now) and the sectors and tile loops. `generate()` itself is deleted.

3. Create `src/sim/settle.js`:

```js
/* ---------- settle: from marks to tiles ----------
   When the last god sleeps, the marks become a valley. Painters run in a fixed order, each reading marks and
   writing tiles. Settle runs outside the god stream: painting draws from the people's stream where resetState
   left it, so a seed's valley depends on its marks and its seed, never on how many ages the gods took. */
function settle(){
  log(`The last of the gods sleeps. The world is ${age} ages old, and holds its breath.`, [], 'major');
  creation.ages = age; creation.settled = true; creation.gate = restGate();
  paintSectors();
  paintGround();
  paintRivers();
  paintLakes();
  const best = placeFirstPerson();
  generateRest(best);
  era = 'days';
  const a = beings.find(b => b.species === 'human');
  log(`${a.name} walks alone into the ${sectorOfTile(tileAt(a.x, a.y)).name.toLowerCase()} with nothing but two hands.`, [a], 'major');
}
```

4. In `src/sim/gods.js`: delete the old `settle()`. In `ageStep`, replace both `settle(); return;` sites with `settleNow = true; return;` and declare `let settleNow = false;` above `ageStep`. After the `withGodRng(() => { ... })` call inside `ageStep`, add `if (settleNow){ settleNow = false; settle(); }`. Split `startCreation` into `beginCreation()` (everything after `resetState`) and `startCreation(seed, opts)` = `resetState(seed, opts); beginCreation();`. Reset `settleNow = false` in `beginCreation`.

5. In `src/sim/main.js`:

```js
/* Every world begins with its creation. The ages run to settle, and settle paints the valley and opens the days. */
function startWorld(seed, opts = {}){
  resetState(seed, opts);
  beginCreation();
  runAges();
}
```

6. In `src/sim/index.js`, `FILES` gains `'settle'` after `'gods'`. The API gains `settle, beginCreation, paintSectors, paintGround, paintRivers, paintLakes, placeFirstPerson, BIOMES, FEATURES,` and `liveBoundaries` if not present.

7. In `tests/lib/run.js` `fingerprint`, add `legends: fnv(api.legends.map(e => \`${e.age}|${e.kind}|${e.text}\`).join('\n')),`.

- [ ] **Step 4: Run the tests, then the soak, and bless**

Run: `node --test tests/settle.js tests/field.js tests/gods.js tests/ages.js tests/options.js tests/door.js`
Expected: PASS. If `tests/options.js`'s bigger-world test fails on reachability, the start country is fine but the river cut it off; the tile check in Task 5 handles that; for now widen nothing and note it.

Run: `node --test tests/terrain.js tests/crafts.js tests/gnomes.js tests/dwellers.js tests/closing.js`. Some fixed-shape assertions will fail on seeds whose countries have no hills yet, since `uplift` still picks rocky and forest sectors from the new biomes. Read each failure. A test that asserts the old world's shape (hill counts, "every tall hill", burrow counts) is adapted in Task 5; for now, mark those specific tests `{ todo: 'plan 3 task 5' }` with the reason, and leave every other assertion strict. A test that fails for another reason is a bug: fix it.

Run: `node tests/soak.js`. Expected: every assertion but the golden passes on every seed. Read the counts. Then `UPDATE_GOLDEN=1 node tests/soak.js`. If a seed dies of anything but old age, trace it with `node tests/trace-deaths.js <seed>` before blessing; a person who starts on a country with no water in reach is Task 5's tile check, and until then the report should say so.

- [ ] **Step 5: Build and commit**

```bash
node build.js
git add -A src tests dist/hearth-sim.html
git commit -m "Settle paints the ground: every world begins with its creation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn"
```

---

### Task 3: Hills from height, caves from depth, and scars

**Files:**
- Modify: `src/sim/world.js` (`uplift`, `cutWaterCaves`, `rockfall`), `src/sim/settle.js`
- Modify: `tests/settle.js`

**Interfaces:**
- Produces: `uplift(within, storeys, count, mark)`: raises up to `count` hills whose feet lie inside the tile set `within`, each with `storeys`, and stamps `h.mark = mark`; returns the hills made. `cutWaterCaves(hillList, levels, wetUnder)`: cuts a cave under each hill in the list, `levels` deep (1 or 2, capped by `-ZMIN`), and the stream still runs (a pond at the mouth) when `wetUnder` is true; stamps `c.mark`. `paintHeights()`, `paintDepths()`, `paintScars()` in `settle.js`. Scar painters `scarBurned(r)`, `scarCut(r)`, `scarDrowned(r)`, `scarBroken(r)`.

- [ ] **Step 0: Forests everywhere there is dark or cold, and the gate wants a forest near the start**

Task 2 found that a mark-painted world has almost no forest: `BIOME_OF` made forest only from dry and cold, and the gods rarely make cold. Trees grow where the dark god hides things as much as where it is cold, and the day era needs wood. Two table changes and one gate change, before the painters:

In `src/sim/marks.js`, `BIOME_OF` becomes:

```js
const BIOME_OF = [
  { needs: ['wet', 'moving'], biome: 'river' },
  { needs: ['wet', 'still'], biome: 'wetland' },
  { needs: ['wet'], biome: 'wetland' },
  { needs: ['dry', 'cold'], biome: 'forest' },
  { needs: ['dry', 'dark'], biome: 'forest' },
  { needs: ['dry', 'hot'], biome: 'meadow' },
  { needs: ['dry', 'light'], biome: 'meadow' },
  { needs: ['dry', 'above'], biome: 'rocky' },
  { needs: [], biome: 'meadow' },
];
```

and `biomeOf` treats a `hide` mark as the dark pole for this purpose: before the table loop, `if (hasPole(r, 'dry') && !poleOf(r, 'heat') && !poleOf(r, 'sight') && hasMark(r, 'hide')) return 'forest';`.

In `src/sim/gods.js` `restGate`, the fuel item becomes a forest within two neighbours of the start: `const fuel = two.some(r => biomeOf(r) === 'forest');` with the comment "fuel is a forest: the day era needs wood, not only grass". `STRAIN.fuel` becomes `['cold', 'dark']`. `GROWS` stays for other readers.

Tests: in `tests/field.js`'s biome test, after the forest assertion add `api.setPole(r, 'dark', patient, ''); r.marks = r.marks.filter(m => !(m.kind === 'pole' && m.value === 'cold')); assert.equal(api.biomeOf(r), 'forest');` and `r.marks = r.marks.filter(m => !(m.kind === 'pole' && m.value === 'dark')); api.mark(r, 'hide', true, patient, ''); assert.equal(api.biomeOf(r), 'forest');`. In `tests/gods.js`'s gate test, the fuel step must set a neighbour to dry and cold (or dark) rather than hot; adjust the setup so the lack sequence still reads water, fuel, food, people, height, depth, kinds. Run `node --test tests/ages.js`: every seed must still settle with no backstop on the soak seeds; report the age range. Update the spec's biome sentence in section 1 and gate item 3 to match.

- [ ] **Step 1: Write the failing tests**

Append to `tests/settle.js`:

```js
/* A settled world, plus the marks that made it, for the painters' tests. */
function settled(seed = 'r'){ const api = load(); api.startWorld(seed); return api; }

test('a height mark raises hills inside its country, with storeys from the mark', () => {
  const api = settled();
  const raised = api.liveRegions().filter(r => api.marksOf(r, 'height').length);
  assert.ok(raised.length, 'no country raised');
  for (const r of raised){
    const mine = api.hills.filter(h => h.mark && h.mark.by === api.marksOf(r, 'height')[0].by && r.tiles.includes(api.idx(h.x, h.y)));
    assert.ok(mine.length >= 1, `country ${r.id} has a height mark and no hill`);
    for (const h of mine){ assert.equal(h.storeys, Math.min(api.marksOf(r, 'height')[0].value, api.ZMAX)); assert.ok(h.tiles.every(i => r.tiles.includes(i)), 'a hill spills out of its country'); }
  }
  for (const h of api.hills) assert.ok(h.mark, 'a hill without a mark');
});

test('a depth mark cuts caves under its country\'s hills, and raises one if it had none', () => {
  const api = settled();
  const dug = api.liveRegions().filter(r => api.marksOf(r, 'depth').length);
  assert.ok(dug.length, 'no country dug');
  for (const r of dug){
    const mine = api.caves.filter(c => c.kind === 'water' && c.hill && r.tiles.includes(api.idx(c.hill.x, c.hill.y)));
    assert.ok(mine.length >= 1, `country ${r.id} has a depth mark and no cave`);
    for (const c of mine){ assert.ok(c.mark && c.mark.kind === 'depth'); const deepest = Math.min(...c.tiles.map(t => t.z)); assert.equal(deepest, Math.max(api.ZMIN, -Math.min(api.marksOf(r, 'depth')[0].value, -api.ZMIN))); }
  }
});

test('scars paint what the winner\'s pole leaves', () => {
  const api = load(); api.startCreation('r'); api.runAges();
  for (const r of api.liveRegions()){
    for (const m of api.marksOf(r, 'scar')){
      const tiles = r.tiles.map(i => api.world[i]);
      if (m.value === 'burned') assert.ok(tiles.every(t => t.ground === 'ash' || t.ground === 'water' || t.ground === 'sand' || t.ground === 'rock' || t.ground === 'stone'), 'a burned country with living ground');
      if (m.value === 'drowned') assert.ok(tiles.some(t => t.feature === 'deadpine') && tiles.some(t => t.ground === 'water'), 'a drowned country with no dead pines in water');
      if (m.value === 'broken') assert.ok(tiles.filter(t => t.feature === 'boulder').length >= r.area / 5, 'a broken country with few boulders');
      if (m.value === 'cut') assert.ok(tiles.filter(t => t.ground === 'rock' && !t.hill).length >= 8, 'a cut country with no chasm');
    }
  }
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/settle.js`
Expected: the three new tests FAIL (`h.mark` undefined, or hills outside their countries).

- [ ] **Step 3: Refactor `uplift` and `cutWaterCaves` to take a country**

In `src/sim/world.js`, `uplift` becomes:

```js
/* Hills inside a country. A hill is rock at level 0 with a floor above it, and a storey more for each level of
   the mark up to the range. Each storey gets one or two slopes on its rim. The rest of the rim is cliff.
   `within` is the set of tile indices the foot may use; the start country is never used. */
function uplift(within, storeys, count, mark){
  const made = [];
  const startTiles = new Set(creation.gate.start.tiles);
  const jit = makeNoise(6);
  const inside = [...within].filter(i => !startTiles.has(i));
  for (let tries = 0; tries < 40 * count && made.length < count; tries++){
    const c = inside[rint(inside.length)]; const cx = c % W, cy = (c - cx) / W;
    const r = 3 + rint(12), ry = Math.max(3, Math.round(r * (0.6 + rng() * 0.4)));
    let foot = [];
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - r; x <= cx + r; x++){
      if (!inb(x, y) || !within.has(idx(x, y))) continue;
      const e = ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 + (jit(x, y) - 0.5) * 0.5;
      if (e <= 1) foot.push(idx(x, y));
    }
    if (!foot.includes(idx(cx, cy))) continue;
    foot = component(foot, idx(cx, cy));
    if (foot.length < 12 || !hillFits(foot)) continue;
    const h = { x: cx, y: cy, r, storeys, tiles: foot, mark };
    const shape = hillShape(h); if (!hillClimbable(shape)) continue;
    raiseHill(h, shape); hills.push(h); made.push(h);
  }
  return made;
}
```

`hillFits(foot, start)` loses its `start` argument and its start-sector check (the start country is excluded by `uplift`). `hillShape`/`raiseHill`/`cutSlopes` already loop storeys from `h.storeys`; confirm they handle `storeys` up to `ZMAX` (they erode the foot inward by 2 per storey; a hill with `r` 3 and 3 storeys has no room, so `hillShape` returns a shape with an empty top and `hillClimbable` refuses it; `uplift` then tries another spot). If `raiseHill` hardcodes two storeys, generalise the loop to `for (let z = 1; z <= h.storeys; z++)`.

`cutWaterCaves` becomes `cutWaterCaves(hillList, levels, wetUnder)`: the loop runs over `hillList` instead of `hills`, drops the `if (h.storeys < 2) continue;` guard, digs to `-levels` instead of `-2` (the drop to level −2 and its chamber only when `levels >= 2`), replaces `if (rng() < 1 / 3)` for the running stream with `if (wetUnder)`, and stamps `c.mark = h.mark`. `rockfall()` is unchanged.

- [ ] **Step 4: The painters**

In `src/sim/settle.js`, add and call them in `settle()` after `paintLakes()` and before `placeFirstPerson()` (the first person needs the ground, but hills must not take the start country: `uplift` reads `creation.gate.start`, which settle set first):

```js
/* Hills from height marks: one to three per country by area, storeys from the mark up to the range. */
function paintHeights(){
  for (const r of liveRegions()){
    const m = marksOf(r, 'height')[0]; if (!m) continue;
    const count = clamp(Math.round(r.area / (4 * SECTOR_AREA)), 1, 3), storeys = clamp(m.value, 1, ZMAX);
    uplift(new Set(r.tiles), storeys, count, m);
  }
}
/* Caves from depth marks, under the country's hills. A country dug but never raised gets one low hill first,
   since a cave mouth needs rock. The stream still runs when water flowed or pooled under the country. */
function paintDepths(){
  for (const r of liveRegions()){
    const m = marksOf(r, 'depth')[0]; if (!m) continue;
    const set = new Set(r.tiles);
    let mine = hills.filter(h => set.has(idx(h.x, h.y)));
    if (!mine.length) mine = uplift(set, 1, 1, m);
    const levels = clamp(m.value, 1, -ZMIN);
    const wetUnder = hasMark(r, 'flow', 'under') || hasMark(r, 'pool', 'under');
    cutWaterCaves(mine, levels, wetUnder);
  }
}
/* Scars: what the winner's pole left. */
function scarBurned(r){ for (const i of r.tiles){ const t = world[i]; if (t.ground === 'grass' || t.ground === 'soil'){ t.ground = 'ash'; t.feature = null; t.berries = 0; t.loose = rng() < 0.05 ? 'stick' : null; } } }
function scarCut(r){
  const { x0, y0, x1, y1 } = r.bbox; const alongX = (x1 - x0) >= (y1 - y0);
  const set = new Set(r.tiles); const line = r.tiles.filter(i => { const x = i % W, y = (i - x) / W; return alongX ? y === ((y0 + y1) >> 1) : x === ((x0 + x1) >> 1); });
  const gap = line.length >> 1;
  line.forEach((i, k) => { const t = world[i]; if (Math.abs(k - gap) <= 1){ t.ground = 'stone'; t.feature = null; } else if (keepsPaths(t)){ t.ground = 'rock'; t.feature = null; t.loose = null; t.chasm = r.id; } });
}
function scarDrowned(r){
  const jit = makeNoise(5); const picks = shuffle(r.tiles).slice(0, 3);
  for (const c of picks){ const cx = c % W, cy = (c - cx) / W;
    for (const i of r.tiles){ const x = i % W, y = (i - x) / W; const d = Math.hypot(x - cx, y - cy) / 5 + (jit(x, y) - 0.5) * 0.6; const t = world[i];
      if (d <= 1){ t.ground = 'water'; t.feature = null; t.berries = 0; t.loose = null; } else if (d <= 1.4 && t.ground === 'grass' && rng() < 0.5 && keepsPaths(t)){ t.feature = 'deadpine'; t.berries = 0; } } }
}
function scarBroken(r){ for (const i of r.tiles){ const t = world[i]; if (t.ground === 'grass' && !t.feature && rng() < 0.34 && keepsPaths(t)){ t.feature = 'boulder'; t.loose = null; } } }
const SCAR_PAINTERS = { burned: scarBurned, cut: scarCut, drowned: scarDrowned, broken: scarBroken };
function paintScars(){ for (const r of liveRegions()) for (const m of marksOf(r, 'scar')){ const p = SCAR_PAINTERS[m.value]; if (p) p(r); } }
```

Order in `settle()`: `paintSectors(); paintGround(); paintRivers(); paintLakes(); paintScars(); paintHeights(); paintDepths(); rockfall();` then `placeFirstPerson()` and the remainder of `generateRest` without its `uplift`/`cutWaterCaves`/`rockfall` calls. Scars go before hills so a chasm never cuts through a hill; `keepsPaths` in `scarCut` and `scarBroken` keeps the map joined as the tile check will demand.

The `startRegion` recomputations that `generateRest` did around uplift move to just after `placeFirstPerson()` (one computation) and after `rockfall()` is no longer needed since rockfall now precedes the person. Keep one `startRegion = reachable(best.x, best.y, 0, NZ * W * H);` right after the person is placed, before dens.

- [ ] **Step 5: Run, soak, bless, build, commit**

Run: `node --test tests/settle.js tests/terrain.js 2>&1 | grep -E "^not ok|ℹ (pass|fail)"`. Read every failure. The terrain tests `hills.length >= 6 && <= 10` and "every tall hill has a water cave" no longer describe the world: adapt them now to "at least one hill" and "every cave sits under a hill of its country with a depth mark"; a terrain rule (slopes join floors, cliffs do not, rabbits never climb, fire on a hilltop) must stay green.

Then `npm run fast && node tests/soak.js`, read the counts, trace any odd death, and bless.

```bash
node build.js
git add -A src tests dist/hearth-sim.html
git commit -m "Hills from height, caves from depth, and the scars the gods left

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn"
```

---

### Task 4: Creatures from the makings, groves, dens, burrows, finds, and the gods' bodies

**Files:**
- Modify: `src/sim/world.js` (`digDens`, `digGnomeBurrows`, `spawnAnimal`, the grove block → `placeGrove`), `src/sim/settle.js`, `src/sim/main.js` (`updateWorld`, the beings filter), `src/sim/gods.js` (`godsTick`)
- Modify: `tests/settle.js`, `tests/gnomes.js`, `tests/dwellers.js`, `tests/closing.js`

**Interfaces:**
- Produces: `paintCreatures()`: for each making mark, spawns its species in its country by a `SPAWN` table keyed by species: `{ rabbit: { n: 6, dens: false }, deer: { n: 3, herd: true }, fox: { n: 1, dens: true }, wolf: { n: 2, dens: true }, sprite: { grove: true }, gnome: { burrows: true }, human: null }`. `digDens(within, owner)` digs one den for `owner` in a hill inside `within`, or returns null. `digGnomeBurrows(within)` digs two or three burrows under `within`'s meadow tiles. `placeGrove(within)`: a hollow pine, or a hollow under a hill of the country, with three sprites. `spawnAnimal(sp, within, n, avoid)`. `placeBodies()`. `godsTick()`. `SPECIES.god.perTick` keeps gods out of `updateBeing`; the beings filter keeps them.

- [ ] **Step 1: Write the failing tests**

Append to `tests/settle.js`:

```js
test('every made species has a living member in its country, and nothing unmade exists', () => {
  const api = settled();
  const made = new Set(); for (const r of api.liveRegions()) for (const m of api.marksOf(r, 'making')) made.add(m.value);
  for (const sp of ['rabbit', 'deer', 'fox', 'wolf', 'sprite', 'gnome']){
    const alive = api.beings.filter(b => b.alive && b.species === sp);
    if (made.has(sp)) assert.ok(alive.length >= 1, `the ${api.SPECIES[sp].plural} were made and none lives`);
    else assert.equal(alive.length, 0, `the ${api.SPECIES[sp].plural} were never made and yet live`);
  }
  for (const r of api.liveRegions()) for (const m of api.marksOf(r, 'making')){
    if (m.value === 'human') continue;
    const here = api.beings.filter(b => b.alive && b.species === m.value && b.z === 0 && api.regionAt(b.x, b.y) === r);
    const denned = api.beings.filter(b => b.alive && b.species === m.value && b.z !== 0);
    assert.ok(here.length + denned.length >= 1, `the ${api.SPECIES[m.value].plural} made in country ${r.id} are not there`);
  }
});

test('sprites live in a grove of their country, foxes and wolves in dens, gnomes in burrows', () => {
  const api = settled();
  for (const g of api.groves) assert.ok(g.mark && g.mark.kind === 'making' && g.mark.value === 'sprite');
  for (const c of api.caves.filter(c => c.kind === 'den')) assert.ok(['fox', 'wolf'].includes(c.owner));
  const gn = api.beings.filter(b => b.alive && b.species === 'gnome');
  if (gn.length) assert.ok(api.caves.some(c => c.kind === 'burrow'), 'gnomes with no burrow');
});

test('a sleeping god stands at its body, and stays in the world through the days', () => {
  const api = settled();
  for (const g of api.gods()){
    if (g.status !== 'asleep') continue;
    assert.ok(api.hasTile(g.x, g.y, g.z), `${g.name} stands off the map`);
    const body = g.body; assert.ok(body, `${g.name} has no body`);
    assert.equal(body.god, g.id);
  }
  for (let i = 0; i < 400; i++) api.step();
  assert.equal(api.gods().length, api.beings.filter(b => b.species === 'god').length);
  for (const g of api.gods()) assert.ok(g.status !== 'awake');
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/settle.js`
Expected: the three new tests FAIL.

- [ ] **Step 3: Implement**

In `src/sim/world.js`:

- `digDens(within, owner)`: the hills considered are `hills.filter(h => within.has(idx(h.x, h.y)))`, forest hills first as today; digs one den for `owner` and returns the cave or null. The old `wants` loop goes; the painter calls it once per den wanted.
- `digGnomeBurrows(within)`: candidates are the sectors whose `country`'s tiles intersect `within` and whose biome is meadow, as today with `forestBeside` or a hill; `want = 2 + rint(2)` as today.
- `spawnAnimal(sp, within, n, avoid)`: picks `within`'s tiles at random, passable, at least 12 from `avoid` (the first person), as today.
- `placeGrove(within, mark)`: the grove block from `generateRest`, on the country: if a hill of the country exists and `hollowUnderHill` succeeds, use it; else the tree-richest tile of `within`; if the country has fewer than 8 trees, plant a ring of trees around the hollow first (`t.feature = 'tree'; t.planted = tick - 60 * DAY` on the ring tiles that `keepsPaths`). The grove record gets `mark`, and its three sprites as today. Deer as today but inside `within`.

In `src/sim/settle.js`:

```js
/* Who is spawned for a making, and how. Read by paintCreatures. */
const SPAWN = { rabbit: { n: 6 }, deer: { n: 3 }, fox: { n: 1, den: true }, wolf: { n: 2, den: true }, sprite: { grove: true }, gnome: { burrows: true }, human: null };
function paintCreatures(first){
  for (const r of liveRegions()) for (const m of marksOf(r, 'making')){
    const how = SPAWN[m.value]; if (!how) continue;
    const within = new Set(r.tiles);
    if (how.grove){ placeGrove(within, m); continue; }
    if (how.burrows){ digGnomeBurrows(within); continue; }
    let placed = 0;
    if (how.den){ const c = digDens(within, m.value); if (c) placed = spawnInDens(m.value, how.n, c); }
    if (placed < how.n) spawnAnimal(m.value, within, how.n - placed, first);
  }
}
```

`spawnInDens(species, n, cave)` gains an optional cave argument to fill that den only. `digGnomeBurrows` spawns its gnomes as today.

The gods' bodies:

```js
/* A sleeping god stands at its body: a hill, a cave's deep, the river, a lake, or where it lay down. */
function placeBodies(){
  for (const g of gods()){
    if (g.status !== 'asleep') continue;
    const r = settleHome(g); const set = r ? new Set(r.tiles) : new Set();
    let at = null, body = null;
    const mine = hills.filter(h => set.has(idx(h.x, h.y))).sort((p, q) => q.storeys - p.storeys);
    const caves_ = caves.filter(c => c.kind === 'water' && c.hill && set.has(idx(c.hill.x, c.hill.y)));
    if (g.pole === 'above' && mine.length){ body = mine[0]; const top = raised.find(t => t.hill === body && t.z === body.storeys && passable(t.x, t.y, t.z)) || raised.find(t => t.hill === body); at = top ? [top.x, top.y, top.z] : [body.x, body.y, 0]; }
    else if (g.pole === 'below' && caves_.length && caves_[0].deep){ body = caves_[0]; at = [body.deep.x, body.deep.y, body.deep.z]; }
    else if (g.pole === 'wet'){ const riv = world.find(t => t.river); if (riv){ body = r; at = [riv.x, riv.y, 0]; } }
    else if (g.pole === 'still'){ const lake = world.find(t => t.lake === (r && r.id)); if (lake){ body = r; at = [lake.x, lake.y, 0]; } }
    if (!at){ const m = marksOf(r, 'rest').find(m => m.value === g.id) || (r && r.marks.find(m => m.kind === 'rest')); const i = m && m.at !== null ? m.at : (r ? r.tiles[0] : 0); body = body || r; at = [i % W, Math.floor(i / W), 0]; }
    g.x = at[0]; g.y = at[1]; g.z = at[2]; g.body = body; if (body) body.god = g.id;
  }
}
```

`raised` tiles carry `hill` already (check `raiseHill`; if not, set `t.hill = h` there). The wet god's body is the river itself; the record that carries `god` is its region.

`settle()` order becomes: sectors, ground, rivers, lakes, scars, heights, depths, rockfall, first person, `startRegion`, items from `t.loose`, `placeFinds()`, `paintCreatures(best)`, `placeBodies()`, era flip, first line. Delete `generateRest`.

In `src/sim/gods.js`, add:

```js
/* Once a day, the sleeping gods stir in their bodies. Built here so the fingerprint moves once; the waking rules
   come after the time model (spec section 5). Draws nothing yet. */
function godsTick(){ if (tick % DAY !== 0) return; withGodRng(() => { for (const g of gods()) if (g.status === 'asleep') g.needs.rest = 100; }); }
```

In `src/sim/main.js`, `updateWorld()` gains `godsTick();` as its last line, and the beings filter in `step()` becomes `beings = beings.filter(b => b.alive || b.species === 'human' || SPECIES[b.species].perTick === false);`.

- [ ] **Step 4: Adapt the tests that assumed the old world**

`tests/gnomes.js`: burrows are two or three when a gnome making exists, else zero; keep every other assertion. `tests/dwellers.js` and `tests/closing.js`: where a test needs a den or a cave, take the first seed that has one (loop the soak seeds and `return` if none has; assert that at least one does). `tests/terrain.js`: any remaining `{ todo }` from Task 2 is resolved now: rewrite each against the marks.

- [ ] **Step 5: Run, soak, bless, build, commit**

`npm run fast && node tests/soak.js`, counts read, deaths traced, blessed.

```bash
node build.js
git add -A src tests dist/hearth-sim.html
git commit -m "Creatures from the makings, groves and dens and burrows in their countries, and the gods asleep in their bodies

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn"
```

---

### Task 5: The tile check, the creation assertions, and the record

**Files:**
- Modify: `src/sim/settle.js` (`tileCheck`, `discardSettle`), `src/sim/gods.js` (`ageStep` on a failed settle)
- Modify: `tests/soak.js`, `tests/settle.js`, `tests/ages.js`
- Modify: `design/notes.md`, `design/specs/2026-09-17-mythos-design.md`, `design/settings.md`, `CLAUDE.md`

**Interfaces:**
- Produces: `tileCheck(first)` returns `{ ok, lack }` with `lack` in `water | ground | fuel | food`: from the first person's tile by a real path search (`bfs` over the whole map), water within reach, a passable tile with no feature within 12 tiles, a tree, bush, or loose stick within reach, and a berry bush or a prey being within reach. `discardSettle()` per decision 7. `creation.discards` counts failed settles. `ageStep`: if settle failed, the last sleeper wakes and the ages go on.

- [ ] **Step 1: Write the failing tests**

Append to `tests/settle.js`:

```js
test('the tile check names what the first person cannot reach', () => {
  const api = settled();
  const a = api.beings.find(b => b.species === 'human');
  assert.deepEqual(api.tileCheck(a), { ok: true });
  /* Wall the person in with rock: nothing is in reach, and the check names the first lack it meets. */
  for (const t of api.world) if (api.dist(t.x, t.y, a.x, a.y) <= 14 && !(t.x === a.x && t.y === a.y)) { t.ground = 'rock'; t.feature = null; }
  const r = api.tileCheck(a); assert.equal(r.ok, false); assert.ok(['water', 'ground', 'fuel', 'food'].includes(r.lack));
});

test('a settle that fails is discarded, the last sleeper wakes, and the ages go on', () => {
  const api = load(); api.startCreation('r');
  /* Force the first paint to fail: make every tile check fail by lying once. */
  const real = api.tileCheck; let lied = false;
  api.setTileCheck(a => { if (!lied){ lied = true; return { ok: false, lack: 'water' }; } return real(a); });
  api.runAges();
  assert.equal(api.creation.discards, 1);
  assert.ok(api.legends.some(e => /would not hold/.test(e.text)));
  assert.equal(api.era, 'days'); assert.ok(api.creation.settled);
  assert.ok(api.beings.some(b => b.species === 'human'));
});
```

`setTileCheck(fn)` is a test seam: `settle.js` calls `tileCheckImpl(first)` where `let tileCheckImpl = tileCheck;` and `function setTileCheck(fn){ tileCheckImpl = fn; }`. Export both.

In `tests/soak.js`, add per-seed assertions after `the first camp has a site...`:

```js
    await t.test('the creation ended on its own, and the valley holds a life', () => {
      const c = api.creation;
      assert.ok(c.settled && !c.failed, 'the creation did not settle');
      assert.equal(c.backstops, 0, 'the backstop fired');
      assert.ok(c.ages <= api.options.ageLimit, `${c.ages} ages`);
      assert.equal(c.gate.ok, true);
      for (const g of api.gods()) assert.ok(g.status === 'asleep' || g.status === 'dead', `${g.name} is ${g.status}`);
      for (const h of api.hills) assert.ok(h.mark && api.beingById(h.mark.by), 'a hill with no god behind it');
      for (const cv of api.caves.filter(cv => cv.kind === 'water')) assert.ok(cv.mark, 'a cave with no mark');
      for (const s of api.sectors) assert.ok(api.regionById(s.country), 'a sector with no country');
      assert.equal(events.filter(e => e.age !== undefined && /walks alone/.test(e.text)).length, 0, 'the first day line was stamped in the ages');
    });
```

And the replay test `a seed and its log replay the same story` keeps passing because the creation is deterministic per seed; add `assert.deepEqual(b.api.legends.map(e => e.text), a.api.legends.map(e => e.text));` to it.

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/settle.js`
Expected: FAIL: `api.tileCheck is not a function`.

- [ ] **Step 3: Implement**

In `src/sim/settle.js`:

```js
/* The real test of a world: from where the first person stands, by a real path search, water, ground to camp on,
   fuel, and food are all in reach. The gate checks marks; this checks tiles. */
function tileCheck(a){
  const full = NZ * W * H;
  const wet = (x, y, z) => z === 0 && !!nearFind(x, y, t => t.ground === 'water', NEAR, 0);
  if (!bfs(a.x, a.y, 0, wet, full, a)) return { ok: false, lack: 'water' };
  const ground = (x, y, z) => z === 0 && dist(x, y, a.x, a.y) <= 12 && passable(x, y, 0) && !tileAt(x, y).feature && tileAt(x, y).ground !== 'sand';
  if (!bfs(a.x, a.y, 0, ground, full, a)) return { ok: false, lack: 'ground' };
  const fuel = (x, y, z) => z === 0 && !!nearFind(x, y, t => t.feature === 'tree' || t.feature === 'bush' || t.loose === 'stick' || (itemAt(t.x, t.y) && itemAt(t.x, t.y).kind === 'stick'), NEAR, 0);
  if (!bfs(a.x, a.y, 0, fuel, full, a)) return { ok: false, lack: 'fuel' };
  const food = (x, y, z) => z === 0 && (!!nearFind(x, y, t => t.feature === 'bush' && t.berries > 0, NEAR, 0) || beings.some(b => b.alive && SPECIES[b.species].prey && b.z === 0 && dist(b.x, b.y, x, y) <= 2));
  if (!bfs(a.x, a.y, 0, food, full, a)) return { ok: false, lack: 'food' };
  return { ok: true };
}
let tileCheckImpl = tileCheck;
function setTileCheck(fn){ tileCheckImpl = fn; }
/* A failed settle is undone: the tiles, the hills, the caves, the items, and every being that is not a god. */
function discardSettle(){
  levels = null; world = null; raised = []; hills = []; caves = []; groves = []; items = []; itemGrid = null; sectors = [];
  beings = beings.filter(b => b.species === 'god');
}
```

`tileCheck` runs before `placeBodies()` and before the loose items are placed? No: after items and creatures, since fuel reads loose sticks and food reads prey. Order in `settle()`: ... `paintCreatures(best)`, then `const check = tileCheckImpl(first)`; if `!check.ok`: `creation.discards++`, `discardSettle()`, wake the last sleeper: `const last = gods().filter(g => g.status === 'asleep').sort((p, q) => q.sleptAt - p.sleptAt)[0]; last.status = 'awake'; last.asleep = false; last.needs.rest = 60; for (const r of liveRegions()) r.marks = r.marks.filter(m => !(m.kind === 'rest' && m.value === last.id)); addThought(last, 'wouldnothold', 'The world would not hold', -10, 4); log(\`${last.name} wakes. The world would not hold a life: it lacks ${check.lack}. The ages go on.\`, [last], 'bad'); creation.settled = false; return;` and `sleep.apply` records `g.sleptAt = age`. Since settle is now called from `ageStep` after the stream wrapper, a return leaves `era` as `gods` and `runAges` continues. `settle()` only flips the era after the check passes and bodies are placed. `creation.discards` starts at 0 in `beginCreation`.

Note for the wake: the region's `rest` mark is removed so `canSplit` frees the country again.

- [ ] **Step 4: The record**

- `design/notes.md`: section 2, Scale, gets a new first paragraph: the world begins with its creation; the field, the marks, the gods, the gate, settle, and the tile check in six sentences, pointing at the spec. Section 14 gains the creation assertions. Section 15 (the door) is unchanged. The `## 16. Next` list drops "a scenario runner" if present and adds "plan 4: watching the creation".
- The spec: section 3's checker gains items 6 and 7 (a hill, a cave) and the `MAKES` table from decision 2 replaces its sentence; section 4 gets decisions 3 to 7 in its table and paragraph; section 5's bodies paragraph names `g.body` and `body.god`.
- `design/settings.md`: the `zmin`,`zmax` row's note says the painters cap storeys and levels by the range.
- `CLAUDE.md` Layout: `settle` joins the file list: "field, marks (the countries and their marks), gods (the primal gods and the ages), settle (from marks to tiles)". The tests bullet names `tests/ages.js` and `tests/settle.js`.

- [ ] **Step 5: Run everything, bless, build, commit**

`npm run fast` (add `tests/settle.js` to the `fast` script) `&& node tests/soak.js`, then bless.

```bash
node build.js
git add -A src tests design CLAUDE.md package.json dist/hearth-sim.html
git commit -m "The tile check: a settle that will not hold a life is undone, and the creation is in the record

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn"
```

---

## Done when

- `npm run fast` (field, gods, ages, settle, options, door, terrain, crafts, gnomes, dwellers, closing) is green.
- `node tests/soak.js` is green on all six seeds with every assertion, the golden blessed at the end of Task 5, and no death but old age.
- `tests/ages.js`: every seed has a height and a depth mark; every soak seed makes every species; no backstop on the soak seeds.
- The built page starts a world that begins with a creation and shows a valley with hills, caves, a river, and creatures, checked in Safari.
- The spec, the notes, the register, and CLAUDE.md say what the code does.

## Deferred to plan 4 and after

- Watching: the ages in the UI, the field view, the legends drawer, hover on marks. Plan 4, on the interface frame from `ui-rethink`.
- Waking gods and day-era acts with omens: after G (time and tiers).
- Country names.
- Twists have marks and no effect. D, later.
- A god-era stamp for the door (`design/settings.md`).
