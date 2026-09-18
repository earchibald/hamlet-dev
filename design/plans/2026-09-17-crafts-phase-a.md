# Crafts phase A: the recipe model, cord, the workshop, baskets, fishing, and hide clothes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make crafts data. A recipe table drives generic goals, and the first rungs of the deeper stone age come with it: fibre and cord, the workshop, baskets, a fishing rod and fishing, and hide clothes.

**Architecture:** `RECIPES` in `src/sim/recipes.js` is a table. One builder, `recipeGoal(r)`, turns each row into a goal object shaped like the hand-written ones in `src/sim/goals.js`: a `state()` and an `offers(a)`. Offers reuse the existing starters (`startGather`, `startBuild`, `startDeliver`) plus two new ones for picking fibre and fishing. New things are stash kinds, tools, a struct, and a wearable, each visible on the panel, the map, or a card.

**Tech Stack:** Plain JavaScript scripts sharing one scope under `src/sim/`, joined by `src/sim/index.js`. Node's built-in test runner.

## Global Constraints

- Spec: `design/specs/2026-09-17-crafts-and-neighbours-design.md`, sections 1, 2 (rows Gather fibre to Sew hide clothes), 6, 7 row A.
- Rules read data tables. A recipe's fields drive its goal; no rule checks a recipe's id except the tests.
- Files in `src/sim/` are plain scripts, no `import` or `export`. `src/sim/index.js` lists them in join order; the new file `recipes.js` joins after `goals.js` and before `weather.js`, because it reads `GOALS` at load.
- Every new behaviour is visible: a goal on the panel, a chronicle line, a thought, a chip, a tile-card row, or a legend entry. Text is plain English, one idea per sentence.
- Every task that changes behaviour re-blesses the golden record after reading the counts. The soak must stay green: no death that is not old age, nobody cut off, each seed under 25 seconds.
- Commit after every task on branch `dev`. Commit messages end with your attribution trailer. Line numbers come from the files as they are now; match on text.

---

## File map

| File | Responsibility |
|---|---|
| `src/sim/core.js` | New item kinds in `ITEMS`. |
| `src/sim/camps.js` | New stash kinds and tools in `makeCamp`. |
| `src/sim/recipes.js` | New. `RECIPES`, `recipeGoal`, `placeFor`, the splice into `GOALS`. |
| `src/sim/tasks.js` | `startPickFibre`, `startFish`, the basket's carry bonus. |
| `src/sim/goals.js` | Cook and smoke fish. |
| `src/sim/beings.js` | Clothes and warmth. |
| `src/sim/world.js`, `src/sim/weather.js` | The workshop burns like a hut. |
| `src/sim/index.js` | Join order and API. |
| `src/ui.js`, `src/page.template.html` | Workshop glyph and card, clothes chip, legend. |
| `tests/crafts.js` | New. One test per recipe through the real offers. |
| `design/notes.md`, `README.md` | Record the model and the ladder. |

---

### Task 1: The recipe model, fibre, and cord

**Files:**
- Modify: `src/sim/core.js` (`ITEMS`)
- Modify: `src/sim/camps.js` (`makeCamp` stash)
- Create: `src/sim/recipes.js`
- Modify: `src/sim/tasks.js` (after `startPickBerries`)
- Modify: `src/sim/index.js` (`FILES`, API)
- Create: `tests/crafts.js`

**Interfaces:**
- Produces: `ITEMS.fibre`, `ITEMS.cord`; stash kinds `fibre`, `cord`; `RECIPES` (array); `recipeGoal(r)` returning a goal `{ id, title, standing, recipe, state(), offers(a) }`; `placeFor(r)` returning `[x, y]` or null; `startPickFibre(a)`; the recipe goals spliced into `GOALS` before the goal with id `guard`; helper `stashHas(needs)` and `takeNeeds(needs)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/crafts.js`:

```js
// Crafts: each recipe through the real goal offers, on a hand-built camp. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

/* A camp that has come far enough to craft: site, lit pit, three-day hearth, the axe, and a person standing by the stash. */
function readyCamp(seed = 'r'){
  const api = load(); api.startWorld(seed);
  const a = api.beings[0]; const c = api.camps[0]; api.camp = c;
  api.setSite(a.x, a.y);
  const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: true }; c.pit = [t.x, t.y];
  c.everLit = true; c.bestStreak = 4000; c.tools.axe = 1;
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){ const q = api.tileAt(t.x + dx, t.y + dy); q.ground = 'soil'; q.feature = null; q.struct = null; q.fire = 0; }
  a.x = c.stashTile[0]; a.y = c.stashTile[1]; a.z = 0; a.task = null; a.asleep = false; a.homeless = false; a.cooldown = {};
  for (const k in a.needs) a.needs[k] = 90;
  return { api, a, c };
}
/* Take one offer by label and run the person until the task ends or 600 ticks pass. */
function doOffer(api, a, label){
  const o = api.offersFor(a).find(o => o.label === label);
  assert.ok(o, `no offer "${label}"; offers: ${api.offersFor(a).map(o => o.label).join(', ')}`);
  assert.ok(o.start(a), `offer "${label}" would not start`);
  a.task.started = api.tick; a.task.key = label;
  for (let k = 0; k < 600 && a.task; k++){ api.runTask(a); api.tick = api.tick + 1; }
  assert.equal(a.task, null, `"${label}" did not finish in 600 ticks`);
}
const goal = (api, id) => api.GOALS.find(g => g.id === id);

test('the recipe goals sit on the panel before the wolf guard, in ladder order', () => {
  const { api } = readyCamp();
  const ids = api.GOALS.map(g => g.id);
  assert.ok(ids.indexOf('fibre') < ids.indexOf('cord'));
  assert.ok(ids.indexOf('cord') < ids.indexOf('guard'));
  assert.equal(api.goalState(goal(api, 'fibre')).s, 'active');
  assert.equal(api.goalState(goal(api, 'cord')).s, 'blocked', 'cord needs fibre first');
});

test('fibre is picked from the reeds and cord is twisted at the stash', () => {
  const { api, a, c } = readyCamp();
  /* Reeds two tiles from the stash. */
  const r = api.tileAt(c.stashTile[0] + 2, c.stashTile[1]); r.ground = 'grass'; r.feature = 'reeds'; r.struct = null;
  doOffer(api, a, 'gather fibre from the reeds');
  assert.ok(c.stash.fibre >= 3, `fibre ${c.stash.fibre}`);
  assert.equal(r.feature, 'reeds', 'reeds stay');
  c.stash.fibre = 4;
  assert.equal(api.goalState(goal(api, 'cord')).s, 'active');
  doOffer(api, a, 'twist cord');
  assert.equal(c.stash.cord, 2); assert.equal(c.stash.fibre, 0);
  assert.ok(api.chronicle[0].text.includes('twists'), api.chronicle[0].text);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/crafts.js`
Expected: both fail; `api.setSite` or `offersFor` missing, or no goal `fibre`.

- [ ] **Step 3: Items and stash kinds**

In `src/sim/core.js`, in `ITEMS`, after the `bones` line add:

```js
  fibre:   { name: 'bundle of reed fibre', plural: 'fibre', mat: 'plant', fuel: 4 },
  cord:    { name: 'coil of cord',     plural: 'cord',  mat: 'plant', fuel: 2 },
```

In `src/sim/camps.js`, in `makeCamp`, change the stash literal to end `water: 0, moss: 0, fibre: 0, cord: 0 }` (append the two kinds).

- [ ] **Step 4: Picking fibre, in `src/sim/tasks.js` after `startPickBerries`**

```js
/* Fibre comes from reeds. Reeds are not used up. */
function startPickFibre(a){
  if (a.carrying && a.carrying.kind !== 'fibre') return startDeliver(a);
  const hasReeds = t => t.feature === 'reeds';
  const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, hasReeds, NEAR, z), 2500, a);
  if (!p){ if (a.carrying) return startDeliver(a); return false; }
  a.task = { type: 'gather', label: 'Going to the reeds for fibre', path: p, progress: 0,
    arrive(a, t){
      if (!nearFind(a.x, a.y, hasReeds, NEAR, a.z)) return a.carrying ? (chain(a, t, startDeliver(a)) || 'done') : 'fail';
      t.label = 'Pulling fibre from the reeds';
      if (++t.progress % 8 === 0){ if (a.carrying) a.carrying.count++; else a.carrying = { kind: 'fibre', count: 1 }; }
      if (a.carrying && a.carrying.count >= 3){ gainXp(a, 'gather'); return chain(a, t, startDeliver(a)) || 'done'; }
      return 'continue';
    } };
  return true;
}
```

- [ ] **Step 5: The recipe table and builder: create `src/sim/recipes.js`**

```js
/* ---------- recipes ---------- */
/* Crafts are data. Each row becomes a goal with a state and offers, built by recipeGoal. Fields:
   id, title: the goal. needs: stash kinds and counts consumed. tools: camp tools that must exist.
   place: where the work happens: 'stash', 'pit' (lit), 'workshop', 'water', 'reeds'. skill, work: the work.
   makes: { item, n } | { tool } | { struct } | { wear }. after: a goal id, tool, or struct that must be done first.
   standing: { stash, n } keeps the goal open until the stash holds n. active(): an extra condition for standing goals.
   gather: a starter for goals that fetch something instead of making it. blurb: panel text. */
const RECIPES = [
  { id: 'fibre', title: 'Gather fibre', after: 'firepit', place: 'reeds', gather: a => startPickFibre(a), standing: { stash: 'fibre', n: 6 }, score: 30,
    blurb: 'Reed fibre twists into cord. Reeds grow in the marsh and along the water.' },
  { id: 'cord', title: 'Twist cord', after: 'firepit', needs: { fibre: 4 }, place: 'stash', skill: 'craft', work: 30, makes: { item: 'cord', n: 2 }, standing: { stash: 'cord', n: 4 }, score: 40,
    verb: 'twists', blurb: 'Four bundles of fibre make two coils. Cord binds a rod, a basket, and clothes.' },
];

const stashHas = needs => Object.entries(needs || {}).every(([k, n]) => (camp.stash[k] || 0) >= n);
const takeNeeds = needs => { for (const [k, n] of Object.entries(needs || {})) stashTake(k, n); };
const needsText = needs => Object.entries(needs || {}).map(([k, n]) => `${ITEMS[k].plural} ${Math.min(camp.stash[k] || 0, n)}/${n}`).join(', ');
/* Has the thing this recipe waits on been done? A goal id, a tool, or a struct. */
function recipeUnlocked(r){
  if (!r.after) return true;
  if (r.after === 'firepit') return camp.everLit;
  if (camp.tools[r.after] !== undefined) return !!camp.tools[r.after];
  if (camp[r.after] !== undefined) return !!camp[r.after];
  const g = GOALS.find(g => g.id === r.after); return !!g && goalState(g).s === 'done';
}
/* Where a recipe's work happens. Null when the place is not built yet. */
function placeFor(r){
  if (r.place === 'stash') return camp.stashTile;
  if (r.place === 'pit') return pitLit() ? camp.pit : null;
  if (r.place === 'workshop') return camp.workshop;
  return null;
}
const recipeDone = r => r.makes && ((r.makes.tool && camp.tools[r.makes.tool]) || (r.makes.struct && camp[r.makes.struct]));
/* What the offer of a missing input is: the existing gatherers for loose things, or nothing for things another recipe makes. */
function gatherOffer(kind){
  if (['stick', 'rock', 'log', 'moss'].includes(kind)) return a => startGather(a, kind);
  if (kind === 'fibre') return a => startPickFibre(a);
  return null;
}
function recipeGoal(r){
  return { id: r.id, title: r.title, standing: !!r.standing, recipe: r,
    state(){
      if (!recipeUnlocked(r)) return { s: 'blocked', text: r.blurb };
      if (recipeDone(r)) return { s: 'done', text: r.done || r.blurb };
      if (r.standing){ const have = camp.stash[r.standing.stash] || 0; const on = r.active ? r.active() : have < r.standing.n; return { s: on ? 'active' : 'idle', text: `${have}/${r.standing.n} ${ITEMS[r.standing.stash].plural} stored. ${r.blurb}` }; }
      return { s: 'active', text: `${needsText(r.needs)}. ${r.blurb}` };
    },
    offers(a){
      if (this.state().s !== 'active') return [];
      if (r.gather) return [{ label: `${r.title.toLowerCase()} from the ${r.place}`, score: r.score || 35, start: r.gather }];
      const out = [];
      for (const [k, n] of Object.entries(r.needs || {})) if ((camp.stash[k] || 0) < n){ const g = gatherOffer(k); if (g) out.push({ label: `gather ${ITEMS[k].plural} to ${r.title.toLowerCase()}`, score: (r.score || 40) - 5, start: g }); }
      if (out.length) return out;
      if (!stashHas(r.needs) || (r.tools || []).some(t => !camp.tools[t])) return [];
      const at = placeFor(r); if (!at) return [];
      const work = r.work / (r.place === 'workshop' ? 1.3 : 1);
      return [{ label: r.title.toLowerCase(), score: r.score || 45, start: a => startBuild(a, at, work, r.title, a => {
        if (!stashHas(r.needs) || recipeDone(r)) return;
        takeNeeds(r.needs);
        if (r.makes.item) stashAdd(r.makes.item, r.makes.n);
        if (r.makes.tool) camp.tools[r.makes.tool] = 1;
        if (r.skill) gainXp(a, r.skill);
        log(`${a.name} ${r.verb || 'makes'} ${r.makes.item ? `${r.makes.n} ${ITEMS[r.makes.item].plural}` : r.title.toLowerCase().replace(/^\w+ /, '')}.`, [a], r.makes.tool ? 'major' : 'info');
      }) }];
    } };
}
/* The recipe goals sit on the panel after the hand-written ladder and before the standing wolf guard. */
GOALS.splice(GOALS.findIndex(g => g.id === 'guard'), 0, ...RECIPES.map(recipeGoal));
```

Note: `startBuild` picks the skill for experience from the label with a pattern; the recipe adds its own `gainXp(a, r.skill)` in the done callback, and the label passed is the title, so `startBuild`'s pattern gives build experience too. That is acceptable: making things is building.

- [ ] **Step 6: Join order and API in `src/sim/index.js`**

Change `FILES` to `['core', 'world', 'path', 'camps', 'beings', 'species', 'fae', 'tasks', 'goals', 'recipes', 'weather', 'main']`. Add to the API list: `RECIPES, recipeGoal, placeFor, offersFor, setSite, startPickFibre,` after `threatsFor,`.

- [ ] **Step 7: Run the tests**

Run: `node tests/crafts.js`
Expected: 2 pass. If `doOffer` reports the task never finished, the person's path or work is stalled: print `a.task.label` each loop.

- [ ] **Step 8: Run the soak, read the counts, and bless**

Run: `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"`
Expected: `ℹ fail 0`, each seed under 25000 ms. People now spend some time on fibre and cord, so `caught`, `huts`, and `taught` may move a little; `alive` must not fall on every seed.

- [ ] **Step 9: Commit**

```bash
git add src/sim tests/crafts.js tests/soak-golden.json
git commit -m "Crafts are data: a recipe table drives goals, starting with fibre and cord"
```

(with your attribution trailer)

---

### Task 2: The workshop, the basket, and the fishing rod

**Files:**
- Modify: `src/sim/recipes.js` (`RECIPES`, `placeFor`, `recipeGoal` struct branch)
- Modify: `src/sim/camps.js` (`makeCamp`)
- Modify: `src/sim/tasks.js` (`startGather` carry cap)
- Modify: `src/sim/world.js`, `src/sim/weather.js` (burnable structs)
- Modify: `src/ui.js`, `src/page.template.html`
- Test: `tests/crafts.js`

**Interfaces:**
- Produces: `camp.workshop` (site or null), `camp.tools.basket`, `camp.tools.rod`; struct type `workshop`; recipes `workshop`, `basket`, `rod`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/crafts.js`:

```js
test('the workshop is built by the pit, then a basket and a rod are made there', () => {
  const { api, a, c } = readyCamp();
  c.stash.log = 6; c.stash.stick = 10; c.stash.rock = 4; c.stash.cord = 5; c.stash.fibre = 6;
  assert.equal(api.goalState(goal(api, 'workshop')).s, 'active');
  assert.equal(api.goalState(goal(api, 'basket')).s, 'blocked', 'no workshop yet');
  doOffer(api, a, 'build the workshop');
  assert.ok(c.workshop, 'no workshop site'); assert.equal(api.tileAt(...c.workshop).struct.type, 'workshop');
  assert.equal(c.stash.log, 0); assert.equal(c.stash.stick, 0); assert.equal(c.stash.rock, 0);
  assert.equal(api.goalState(goal(api, 'workshop')).s, 'done');
  assert.equal(api.goalState(goal(api, 'basket')).s, 'active');
  doOffer(api, a, 'weave a basket');
  assert.equal(c.tools.basket, 1); assert.equal(c.stash.cord, 2);
  c.stash.stick = 1;
  doOffer(api, a, 'make a fishing rod');
  assert.equal(c.tools.rod, 1); assert.equal(c.stash.cord, 0); assert.equal(c.stash.stick, 0);
  assert.equal(api.chronicle[0].kind, 'major');
});

test('a basket lets a gatherer carry three more', () => {
  const { api, a, c } = readyCamp();
  for (let k = 0; k < 12; k++) api.addItem('stick', c.stashTile[0] + 3 + (k % 4), c.stashTile[1] + 2 + Math.floor(k / 4));
  for (const t of api.world) if (t.struct === null && Math.abs(t.x - c.stashTile[0]) <= 8 && Math.abs(t.y - c.stashTile[1]) <= 8){ t.feature = null; if (t.ground === 'water') t.ground = 'grass'; }
  a.skills.gather = 0; c.stash.stick = 0;
  api.startGather(a, 'stick'); for (let k = 0; k < 400 && a.task; k++){ api.runTask(a); api.tick = api.tick + 1; }
  assert.equal(c.stash.stick, 3, 'three sticks a trip without a basket');
  c.tools.basket = 1; c.stash.stick = 0;
  api.startGather(a, 'stick'); for (let k = 0; k < 600 && a.task; k++){ api.runTask(a); api.tick = api.tick + 1; }
  assert.equal(c.stash.stick, 6, 'six a trip with a basket');
});
```

Add `startGather, addItem,` to the API list in `src/sim/index.js`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/crafts.js`
Expected: the two new tests fail; no goal `workshop`.

- [ ] **Step 3: Camp fields**

In `src/sim/camps.js`, in `makeCamp`, change `tools: { axe: 0, waterskin: 0, spear: 0, firestones: 0 }` to `tools: { axe: 0, waterskin: 0, spear: 0, firestones: 0, basket: 0, rod: 0 }`, and after `storehouse: null,` add `workshop: null,`.

- [ ] **Step 4: Recipes**

In `src/sim/recipes.js`, append to `RECIPES` after the `cord` row:

```js
  { id: 'workshop', title: 'Build the workshop', after: 'axe', needs: { log: 6, stick: 10, rock: 4 }, tools: ['axe'], place: 'site', skill: 'build', work: 140, makes: { struct: 'workshop' }, score: 50,
    verb: 'raises', done: 'A roofed bench beside the fire. Work here goes faster, and cord, baskets, rods, and clothes are made here.', blurb: 'A roofed bench beside the fire. Six logs, ten sticks, four rocks.' },
  { id: 'basket', title: 'Weave a basket', after: 'workshop', needs: { cord: 3 }, place: 'workshop', skill: 'craft', work: 60, makes: { tool: 'basket' }, score: 44,
    verb: 'weaves', done: 'A basket of cord and reed. Gatherers carry three more.', blurb: 'Three coils of cord. A gatherer with a basket carries three more.' },
  { id: 'rod', title: 'Make a fishing rod', after: 'workshop', needs: { stick: 1, cord: 2 }, place: 'workshop', skill: 'craft', work: 40, makes: { tool: 'rod' }, score: 44,
    verb: 'binds', done: 'A stick, a line of cord, a bone hook. The river feeds the camp now.', blurb: 'A stick and two coils of cord. Opens fishing.' },
```

In `placeFor`, add before `return null;`: `if (r.place === 'site') return openSpotNear(camp.pit, 2, 5);`.

In `recipeGoal`'s done callback, after `if (r.makes.tool) camp.tools[r.makes.tool] = 1;` add:

```js
        if (r.makes.struct){ const t = tileAt(...at); if (t.struct) return; t.feature = null; t.struct = { type: r.makes.struct, camp }; camp[r.makes.struct] = at; }
```

and change the log line's kind to `r.makes.tool || r.makes.struct ? 'major' : 'info'`.

- [ ] **Step 5: The basket's carry bonus, in `src/sim/tasks.js`**

In `startGather`, change `Math.min(6, 3 + Math.floor(a.skills.gather / 2))` to `Math.min(9, 3 + Math.floor(a.skills.gather / 2) + (camp.tools.basket ? 3 : 0))`.

- [ ] **Step 6: The workshop burns like a hut**

In `src/sim/world.js` (two places, `tileFlam` and `tileFuel`) and `src/sim/weather.js` (`burnOut`), change `['rack', 'leanto', 'hut', 'storehouse']` to `['rack', 'leanto', 'hut', 'storehouse', 'workshop']`. In `burnOut`, in the chain `if (k === 'rack') c.rack = null; else if (k === 'leanto') c.shelter = null; else if (k === 'storehouse') c.storehouse = null; else c.huts = ...`, insert `else if (k === 'workshop') c.workshop = null;` before the `else c.huts` branch. The log line's name map `k === 'leanto' ? 'lean-to' : k === 'rack' ? 'drying rack' : k` already prints `workshop`.

- [ ] **Step 7: The page**

In `src/ui.js` `drawLoc`, in the struct branch, before `else if (t.struct.type === 'stone')` add: `else if (t.struct.type === 'workshop'){ bg = P.pit; g = '⊞'; fg = P.stick; }`. In `inspectTile`, after the `Storehouse` row add: `if (t.struct && t.struct.type === 'workshop') rows.push(['Workshop', 'a roofed bench. Cord, baskets, rods, and clothes are made here, faster than by the fire.']);`. In `src/page.template.html`'s legend, after the storehouse entry add `<span><b>⊞</b>workshop</span>`. In `inspectTile`'s `camps.find(...)` that picks the camp for a tile, add `|| (c.workshop && c.workshop[0] === x && c.workshop[1] === y)` to the condition.

- [ ] **Step 8: Run the tests**

Run: `node tests/crafts.js`
Expected: 4 pass.

- [ ] **Step 9: Soak, bless, build, commit**

Run: `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"` then `node --check src/ui.js && node build.js`.
Expected: `ℹ fail 0`, each seed under 25000 ms, and at least one seed with a workshop: check the counts line for `huts` and `storehouses`, and run `node -e "const {runDays}=require('./tests/lib/run');const {api}=runDays('x',70);console.log(api.camps.map(c=>[c.name,!!c.workshop,c.tools.basket,c.tools.rod]))"`. Report what it prints.

```bash
git add src/sim src/ui.js src/page.template.html dist/hearth-sim.html tests/crafts.js tests/soak-golden.json
git commit -m "The workshop, the basket, and the fishing rod"
```

---

### Task 3: Fishing

**Files:**
- Modify: `src/sim/core.js` (`ITEMS.fish`)
- Modify: `src/sim/camps.js` (stash `fish`)
- Modify: `src/sim/tasks.js` (`startFish` after `startPickFibre`)
- Modify: `src/sim/recipes.js` (`RECIPES`, `placeFor`)
- Modify: `src/sim/goals.js` (cook and smoke)
- Test: `tests/crafts.js`

**Interfaces:**
- Produces: `ITEMS.fish`, stash `fish`, `startFish(a)`, recipe `fish` (standing while food is short), the cook goal's "cook the fish" offer, the smoke goal's fish offer.

- [ ] **Step 1: Write the failing tests**

Append to `tests/crafts.js`:

```js
test('with a rod the camp fishes when food is short, and fish cook to two meals', () => {
  const { api, a, c } = readyCamp();
  c.tools.rod = 1;
  const w = api.tileAt(c.stashTile[0] + 3, c.stashTile[1]); w.ground = 'water'; w.feature = null; w.struct = null;
  c.stash.berries = 0; c.stash.cooked = 0; c.stash.smoked = 0;
  assert.equal(api.goalState(goal(api, 'fish')).s, 'active');
  let caught = 0;
  for (let tries = 0; tries < 12 && !c.stash.fish; tries++){ doOffer(api, a, 'fish the river'); }
  assert.ok(c.stash.fish >= 1, 'no fish in twelve casts');
  assert.ok(api.chronicle.some(e => e.text.includes('lands a fish')));
  c.stash.berries = 30;
  assert.equal(api.goalState(goal(api, 'fish')).s, 'idle', 'plenty of food, no need to fish');
  c.stash.fish = 1; c.stash.cooked = 0;
  doOffer(api, a, 'cook the fish');
  assert.equal(c.stash.fish, 0); assert.equal(c.stash.cooked, 2);
  c.stash.fish = 1; c.rack = c.stashTile; api.tileAt(...c.rack).struct = { type: 'rack', camp: c };
  c.stash.smoked = 0; c.stash.carcass = 0;
  doOffer(api, a, 'smoke a fish over the fire');
  assert.equal(c.stash.smoked, 2);
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `node tests/crafts.js`
Expected: fails; no goal `fish`.

- [ ] **Step 3: The fish**

In `src/sim/core.js` `ITEMS`, after `cord` add: `  fish:    { name: 'fish',             plural: 'fish',  mat: 'flesh', fuel: 0 },`. In `src/sim/camps.js` `makeCamp`, add `fish: 0` to the stash literal after `cord: 0`.

- [ ] **Step 4: Fishing, in `src/sim/tasks.js` after `startPickFibre`**

```js
/* Fishing: stand by the water, cast for a while, and land a fish by hunting skill and patience. */
function startFish(a){
  if (a.carrying && a.carrying.kind !== 'fish') return startDeliver(a);
  const water = t => t.ground === 'water';
  const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, water, DIRS, z), 3000, a); if (!p) return false;
  a.task = { type: 'work', label: 'Going to the water with the rod', path: p, progress: 0,
    arrive(a, t){
      if (!nearFind(a.x, a.y, water, DIRS, a.z)) return 'fail';
      t.label = 'Casting from the bank'; t.progress += workSpeed(a, 'hunt');
      if (t.progress < 60) return 'continue';
      if (rng() < 0.35 + a.skills.hunt * 0.08 + a.traits.patience * 0.25){ a.carrying = { kind: 'fish', count: 1 }; gainXp(a, 'hunt'); log(`${a.name} lands a fish.`, [a], 'good'); addThought(a, 'fish', 'Caught a fish', 3, 500); return chain(a, t, startDeliver(a)) || 'done'; }
      addThought(a, 'nofish', 'Nothing bit', -1, 300); return 'done';
    } };
  return true;
}
```

- [ ] **Step 5: The recipe and the cook and smoke offers**

In `src/sim/recipes.js`, append to `RECIPES` after the `rod` row:

```js
  { id: 'fish', title: 'Fish the river', after: 'rod', tools: ['rod'], place: 'water', gather: a => startFish(a), standing: { stash: 'fish', n: 4 }, active: () => stashFood() < foodTarget(), score: 46,
    blurb: 'A fish cooks to two meals or smokes on the rack. People fish when food is short.' },
```

In `recipeGoal`'s `offers`, the gather label reads `${r.title.toLowerCase()} from the ${r.place}`; change it to `r.place === 'reeds' ? 'gather fibre from the reeds' : r.title.toLowerCase()` so the fishing offer is "fish the river".

In `src/sim/goals.js`, in the goal with id `cook`: change its `state()` so the active text counts fish too: replace `s: camp.stash.carcass > 0 ? 'active' : 'idle', text: camp.stash.carcass > 0 ? `${camp.stash.carcass} carcass waiting.`` with `s: camp.stash.carcass > 0 || camp.stash.fish > 0 ? 'active' : 'idle', text: camp.stash.carcass > 0 || camp.stash.fish > 0 ? `${camp.stash.carcass} carcass and ${camp.stash.fish} fish waiting.``. In its `offers(a)`, after the venison branch and before `if (camp.stash.carcass <= 0) return [];`, add:

```js
      if (camp.stash.fish > 0) return [{ label: 'cook the fish', score: camp.stash.cooked === 0 ? 55 : 35, start: a => startBuild(a, camp.pit, 25, 'Cooking fish over the fire', a => { if (camp.stash.fish > 0){ stashTake('fish'); stashAdd('cooked', 2); gainXp(a, 'cook'); log(`${a.name} cooks a fish over the fire.`, [a], 'good'); } }) }];
```

In the goal with id `smoke`, change the offer guard `camp.stash.carcass < 1` to `camp.stash.carcass < 1 && camp.stash.fish < 1`, and replace the single offer with two: keep the existing rabbit offer under `if (camp.stash.carcass >= 1)`, and add:

```js
      if (camp.stash.fish >= 1) out.push({ label: 'smoke a fish over the fire', score: seasonOf() === 'autumn' ? 64 : camp.stash.smoked < 4 ? 58 : 28, start: a => startBuild(a, camp.rack, 40, 'Smoking fish', a => { if (camp.stash.fish < 1) return; stashTake('fish'); stashAdd('smoked', 2); gainXp(a, 'cook'); log(`${a.name} hangs a fish in the smoke. It will keep.`, [a]); }) });
```

with `const out = [];` before and `return out;` after, so the function returns both.

Add `startFish,` to the API list.

- [ ] **Step 6: Run the tests**

Run: `node tests/crafts.js`
Expected: 5 pass.

- [ ] **Step 7: Soak, bless, commit**

Run: `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"`.
Expected: `ℹ fail 0`, each seed under 25000 ms. Add `fished: ev('lands a fish')` to `countEvents` in `tests/lib/run.js` (after `caught`) so the counts show fishing, and report the per-seed `fished` numbers.

```bash
git add src/sim tests/crafts.js tests/lib/run.js tests/soak-golden.json
git commit -m "Fishing: a rod, the river, and fish that cook or smoke"
```

---

### Task 4: Hide clothes

**Files:**
- Modify: `src/sim/recipes.js` (`RECIPES`, `recipeGoal` wear branch, `recipeDone`)
- Modify: `src/sim/beings.js` (`makeBeing`, `updateBeing` warmth)
- Modify: `src/ui.js` (`inspectBeing`)
- Test: `tests/crafts.js`

**Interfaces:**
- Produces: `a.clothes` (boolean on humans), recipe `clothes` (active while hides suffice and someone lacks clothes), warmth loss 0.6 for the wearer.

- [ ] **Step 1: Write the failing test**

Append to `tests/crafts.js`:

```js
test('hide clothes go to the coldest person and keep them warmer', () => {
  const { api, a, c } = readyCamp();
  c.workshop = [c.pit[0] + 2, c.pit[1]]; api.tileAt(...c.workshop).struct = { type: 'workshop', camp: c };
  c.stash.hide = 3; c.stash.cord = 1; a.needs.warmth = 40;
  assert.equal(api.goalState(goal(api, 'clothes')).s, 'active');
  doOffer(api, a, 'sew hide clothes');
  assert.equal(a.clothes, true); assert.equal(c.stash.hide, 0);
  assert.equal(api.goalState(goal(api, 'clothes')).s, 'idle', 'everyone is clothed');
  api.tick = 60 * 1000 + 100; /* a winter night */
  const bare = api.beings.find(b => b.species === 'human' && b !== a) || api.makeBeing('human', a.x, a.y, 'Test', 0);
  if (!api.beings.includes(bare)) api.beings.push(bare);
  bare.camp = c; bare.clothes = false; bare.needs.warmth = 60; a.needs.warmth = 60; bare.x = a.x; bare.y = a.y; bare.z = 0; bare.traits.hardiness = a.traits.hardiness; bare.homeless = false; bare.asleep = false; a.asleep = false; bare.born = a.born;
  api.updateBeing(a); api.updateBeing(bare);
  assert.ok(60 - a.needs.warmth < 60 - bare.needs.warmth, `clothed loss ${60 - a.needs.warmth} should be less than bare ${60 - bare.needs.warmth}`);
});
```

Add `makeBeing,` to the API list in `src/sim/index.js`.

- [ ] **Step 2: Run the test to see it fail**

Run: `node tests/crafts.js`
Expected: fails; no goal `clothes`.

- [ ] **Step 3: The recipe**

In `src/sim/recipes.js`, append to `RECIPES`:

```js
  { id: 'clothes', title: 'Sew hide clothes', after: 'workshop', needs: { hide: 3, cord: 1 }, place: 'workshop', skill: 'craft', work: 70, makes: { wear: 'clothes' }, standing: { stash: 'hide', n: 0 }, active: () => campHumans().some(h => !h.clothes), score: 42,
    verb: 'sews', blurb: 'Three hides and a coil of cord. The coldest person wears them, and loses warmth slower.' },
```

The standing entry keeps the goal open; `active` decides when it is active. In `recipeGoal`'s `state()`, the standing text reads `${have}/${r.standing.n} ...`; guard it: when `r.standing.n === 0`, use the text `${campHumans().filter(h => h.clothes).length} of ${campHumans().length} clothed. ${r.blurb}` instead. In the done callback, after the struct branch add:

```js
        if (r.makes.wear){ const who = campHumans().filter(h => !h[r.makes.wear]).sort((p, q) => p.needs.warmth - q.needs.warmth)[0] || a; who[r.makes.wear] = true; addThought(who, 'clothes', 'Warm in new hide clothes', 5, 1500); log(`${a.name} sews hide clothes, and ${who === a ? 'wears them' : `${who.name} wears them`}.`, [a, who], 'good'); return; }
```

placed before the generic log line, so a wear recipe logs once.

- [ ] **Step 4: Warmth, in `src/sim/beings.js`**

In `makeBeing`, after `if (species === 'human') b.needs.warmth = 80 + rint(20);` add `if (species === 'human') b.clothes = false;`. In `updateBeing`, in the warmth line, change `* (a.homeless ? 0.3 : 1)` to `* (a.homeless ? 0.3 : 1) * (a.clothes ? 0.6 : 1)`.

- [ ] **Step 5: The chip, in `src/ui.js` `inspectBeing`**

In the human `extra`, in the Personality chips line, before the closing `</div>` of the chips, add `${a.clothes ? '<span class="chip">wearing hide clothes</span>' : ''}`.

- [ ] **Step 6: Tests, soak, bless, build, commit**

Run: `node tests/crafts.js` (6 pass), `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"`, `node --check src/ui.js && node build.js`.
Expected: `ℹ fail 0`, each seed under 25000 ms, `froze` stays 0.

```bash
git add src/sim src/ui.js dist/hearth-sim.html tests/crafts.js tests/soak-golden.json
git commit -m "Hide clothes: the coldest person wears them"
```

---

### Task 5: Record the model

**Files:**
- Modify: `design/notes.md` (section 8 and a new section), `CLAUDE.md` (Layout), `README.md`

- [ ] **Step 1: Notes**

In `design/notes.md`, after section 8's chain list, add a paragraph: `Crafts after the village are data. A recipe in src/sim/recipes.js names what it needs, where it is made, and what it makes, and one builder turns it into a goal. The panel shows recipes after the hand-written ladder: gather fibre, twist cord, build the workshop, weave a basket, make a fishing rod, fish the river, sew hide clothes. Work at the workshop goes 1.3 times as fast. A basket carries three more. A fish cooks to two meals or smokes to two strips. Hide clothes cut the wearer's warmth loss to 0.6.`

In section 14, add: `` `tests/crafts.js` runs each recipe through the real goal offers on a hand-built camp: the offer appears, the person does the work, the thing exists, and the goal moves from blocked to active to done or idle. ``

- [ ] **Step 2: CLAUDE.md and README**

In `CLAUDE.md` Layout, add `- \`src/sim/recipes.js\`: crafts as data. Add a recipe, get a goal.` after the `src/sim/index.js` line, and `- \`tests/crafts.js\`: each recipe through the real offers. Fast.` after the terrain line. In `README.md`, add `    node tests/crafts.js             # every recipe through the real offers: under a second` after the terrain line.

- [ ] **Step 3: Run everything, commit**

Run: `node tests/terrain.js 2>&1 | grep -E "^ℹ (pass|fail)" && node tests/crafts.js 2>&1 | grep -E "^ℹ (pass|fail)" && node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail)|✖" && node build.js`

```bash
git add design/notes.md CLAUDE.md README.md
git commit -m "Notes: crafts as data, and the first rungs of the stone-age ladder"
```

---

## Self-review

- Spec coverage for phase A: recipe model with the listed fields and generic goal (Task 1), fibre and cord (Task 1), workshop with the 1.3 bonus and burning (Task 2), basket carry bonus (Task 2), rod and fishing with cook and smoke (Task 3), clothes with warmth 0.6 and the chip (Task 4), visibility for each (goal on the panel, chronicle lines, chip, tile card, legend), tests through real offers (each task), notes (Task 5).
- Names used across tasks: `RECIPES`, `recipeGoal`, `placeFor`, `recipeUnlocked`, `recipeDone`, `gatherOffer`, `stashHas`, `takeNeeds`, `needsText`, `startPickFibre`, `startFish`, stash kinds `fibre`, `cord`, `fish`, tools `basket`, `rod`, `camp.workshop`, `a.clothes`. Each is defined in the task that first uses it.
- The `readyCamp` helper uses `setSite` and a hand-made lit pit; `bestStreak` unlocks the axe ladder, and `tools.axe = 1` unlocks the workshop.
