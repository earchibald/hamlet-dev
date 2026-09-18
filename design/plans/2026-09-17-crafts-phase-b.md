# Crafts phase B: clay and the kiln, pots, berry gardens, deer pits, and quarried stone

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The second half of the stone-age ladder: clay from the riverbank, a kiln that fires pots, pots that hold water and keep berries, a berry garden planted from cuttings, a deer pit, and stone quarried from the hills.

**Architecture:** Everything is a recipe in `RECIPES` (phase A), with four new gatherers and one new place finder in `src/sim/tasks.js`, two new struct types (`kiln`, `pitfall`) drawn and carded like the workshop, and three small rule hooks: the water goal's target reads pots, berry spoilage reads pots, and a deer stepping onto a pitfall is caught the way a rabbit is snared.

**Tech Stack:** Plain JavaScript scripts sharing one scope under `src/sim/`. Node's built-in test runner.

## Global Constraints

- Spec: `design/specs/2026-09-17-crafts-and-neighbours-design.md`, section 2 rows Dig clay to Quarry stone, section 6, section 7 row B. Also the topography spec's favour rule: quarrying the hill above a hollow costs 10 favour per rock face opened.
- Rules read data tables. The quarry rule reads `GROUND[ground].quarry`, never the name `rock`. Recipes drive goals through `recipeGoal`; a new place kind is added to `placeFor`, not special-cased in a goal.
- Files in `src/sim/` are plain scripts, no `import` or `export`.
- Every new behaviour is visible: a goal on the panel, a chronicle line, a thought, a tile-card row, a legend entry.
- Every task that changes behaviour re-blesses the golden record after reading the counts. The soak stays green: no death that is not old age, nobody cut off, each seed under 25 seconds.
- Commit after every task on branch `dev`, by path, with your attribution trailer. Match on text, not line numbers.

---

## File map

| File | Responsibility |
|---|---|
| `src/sim/core.js` | `ITEMS.clay`, `ITEMS.pot`, `ITEMS.cuttings`; `GROUND.rock.quarry`. |
| `src/sim/camps.js` | Stash kinds, `camp.kiln`, `camp.garden`, `camp.pitfalls`; berry spoilage with a pot. |
| `src/sim/tasks.js` | `startDigClay`, `startTakeCuttings`, `startHaulPit`, `startQuarry`, `pitfallSite`, `gardenSpot`. |
| `src/sim/recipes.js` | The new rows; `placeFor` for `kiln`, `garden`, `pitfall`, `face`; the garden and pitfall done branches. |
| `src/sim/goals.js` | The water goal's target reads pots; the pitfall haul offer. |
| `src/sim/beings.js` | A deer on a pitfall. |
| `src/sim/world.js`, `src/sim/weather.js` | Kiln and pitfall burn or not. |
| `src/ui.js`, `src/page.template.html` | Glyphs, cards, legend. |
| `tests/crafts.js` | One test per rung. |
| `design/notes.md` | The ladder. |

---

### Task 1: Clay, the kiln, and pots

**Files:**
- Modify: `src/sim/core.js` (`ITEMS`)
- Modify: `src/sim/camps.js` (`makeCamp`, `stashAdd`)
- Modify: `src/sim/tasks.js` (after `startFish`)
- Modify: `src/sim/recipes.js` (`RECIPES`, `placeFor`, `gatherOffer`, `recipeGoal` done branch)
- Modify: `src/sim/goals.js` (water goal)
- Modify: `src/sim/world.js`, `src/sim/weather.js` (burnable structs)
- Modify: `src/ui.js`, `src/page.template.html`
- Test: `tests/crafts.js`

**Interfaces:**
- Produces: `ITEMS.clay`, `ITEMS.pot`; stash `clay`, `pot`; `camp.kiln` (site or null); struct type `kiln` with `fired` count; `startDigClay(a)`; recipes `clay` (gather, standing to 6), `kiln` (struct), `pot` (item, standing to 3); the water goal's target is `6 + 6 * camp.stash.pot`; berries keep twice as long with a pot.

- [ ] **Step 1: Write the failing tests**

Append to `tests/crafts.js`:

```js
test('clay is dug from the riverbank, the kiln is raised, and pots are fired in it', () => {
  const { api, a, c } = readyCamp();
  c.workshop = [c.pit[0] + 2, c.pit[1]]; api.tileAt(...c.workshop).struct = { type: 'workshop', camp: c };
  const s = api.tileAt(c.stashTile[0] + 3, c.stashTile[1]); s.ground = 'sand'; s.feature = null; s.struct = null;
  assert.equal(api.goalState(goal(api, 'clay')).s, 'active');
  doOffer(api, a, 'dig clay');
  assert.ok(c.stash.clay >= 2, `clay ${c.stash.clay}`);
  c.stash.clay = 4; c.stash.rock = 8;
  assert.equal(api.goalState(goal(api, 'kiln')).s, 'active');
  doOffer(api, a, 'build the kiln');
  assert.ok(c.kiln); assert.equal(api.tileAt(...c.kiln).struct.type, 'kiln'); assert.equal(c.stash.clay, 0); assert.equal(c.stash.rock, 0);
  c.stash.clay = 3; c.stash.stick = 2; c.stash.pot = 0;
  doOffer(api, a, 'fire pots');
  assert.equal(c.stash.pot, 1); assert.equal(c.stash.stick, 0); assert.equal(api.tileAt(...c.kiln).struct.fired, 1);
  assert.equal(api.goalState(goal(api, 'pot')).s, 'active', 'aim is three pots');
});

test('a pot holds water at camp and keeps berries longer', () => {
  const { api, a, c } = readyCamp();
  c.tools.waterskin = 1; c.stash.water = 8;
  assert.equal(api.goalState(goal(api, 'water')).s, 'idle' , 'eight drinks meet the aim of six without a pot');
  c.stash.pot = 1;
  assert.equal(api.goalState(goal(api, 'water')).s, 'active', 'with a pot the aim is twelve');
  api.camp = c; c.rot.berries = []; c.stash.berries = 0;
  api.stashAdd('berries', 1); const withPot = c.rot.berries[0] - api.tick;
  c.stash.pot = 0; c.rot.berries = []; c.stash.berries = 0;
  api.stashAdd('berries', 1); const without = c.rot.berries[0] - api.tick;
  assert.equal(withPot, without * 2);
});
```

The water goal's state today is `active` whenever the waterskin exists; the test expects `idle` when the stash meets the aim. Part of this task is that change (Step 5).

Add `stashAdd,` to the API list in `src/sim/index.js`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/crafts.js`
Expected: both new tests fail; no goal `clay`.

- [ ] **Step 3: Items, stash, and spoilage**

In `src/sim/core.js` `ITEMS`, after `fish` add:

```js
  clay:    { name: 'lump of clay',     plural: 'clay',  mat: 'stone', fuel: 0 },
  pot:     { name: 'clay pot',         plural: 'pots',  mat: 'stone', fuel: 0 },
```

In `src/sim/camps.js` `makeCamp`: add `clay: 0, pot: 0` to the stash literal after `fish: 0`, and `kiln: null,` after `workshop: null,`. In `stashAdd`, change the life line to:

```js
  if (camp.rot[kind]){ const life = (kind === 'cooked' ? 1800 : 3500) * (isWinter() ? 2 : 1) * (camp.storehouse ? 2 : 1) * (kind === 'berries' && camp.stash.pot > 0 ? 2 : 1); for (let k = 0; k < n; k++) camp.rot[kind].push(tick + life); }
```

- [ ] **Step 4: Digging clay, in `src/sim/tasks.js` after `startFish`**

```js
/* Clay comes from the riverbank: any tile whose ground is sand. The bank is not used up. */
function startDigClay(a){
  if (a.carrying && a.carrying.kind !== 'clay') return startDeliver(a);
  const bank = t => t.ground === 'sand';
  const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, bank, NEAR, z), 3000, a);
  if (!p){ if (a.carrying) return startDeliver(a); return false; }
  a.task = { type: 'gather', label: 'Going to the bank for clay', path: p, progress: 0,
    arrive(a, t){
      if (!nearFind(a.x, a.y, bank, NEAR, a.z)) return a.carrying ? (chain(a, t, startDeliver(a)) || 'done') : 'fail';
      t.label = 'Digging clay from the bank';
      if (++t.progress % 10 === 0){ if (a.carrying) a.carrying.count++; else a.carrying = { kind: 'clay', count: 1 }; }
      if (a.carrying && a.carrying.count >= 2){ gainXp(a, 'gather'); return chain(a, t, startDeliver(a)) || 'done'; }
      return 'continue';
    } };
  return true;
}
```

Note `bank` reads the ground name `sand`; that is what the spec says ("sand tiles by the river"), and the sand is the river's own bank. If you prefer a table flag, add `clay: true` to `GROUND.sand` and read `GROUND[t.ground].clay`; do that, it is one line each.

- [ ] **Step 5: Recipes, places, and the water goal**

In `src/sim/recipes.js`, append to `RECIPES`:

```js
  { id: 'clay', title: 'Dig clay', after: 'workshop', place: 'bank', gather: a => startDigClay(a), standing: { stash: 'clay', n: 6 }, score: 32,
    blurb: 'Clay from the riverbank. Four lumps build a kiln, three fire a pot.' },
  { id: 'kiln', title: 'Build the kiln', after: 'workshop', needs: { rock: 8, clay: 4 }, place: 'site', skill: 'build', work: 120, makes: { struct: 'kiln' }, score: 46,
    verb: 'raises', done: 'A dome of rock and clay with a fire inside. Pots are fired here.', blurb: 'Eight rocks and four lumps of clay. Fires pots.' },
  { id: 'pot', title: 'Fire pots', after: 'kiln', needs: { clay: 3, stick: 2 }, place: 'kiln', skill: 'craft', work: 50, makes: { item: 'pot', n: 1 }, standing: { stash: 'pot', n: 3 }, score: 42,
    verb: 'fires', blurb: 'Three lumps of clay and two sticks a firing. Each pot holds six more drinks at camp, and with a pot berries keep twice as long.' },
```

In `gatherOffer`, add `if (kind === 'clay') return a => startDigClay(a);`. In `placeFor`, add `if (r.place === 'kiln') return camp.kiln;`. In `recipeGoal`'s gather offer label, the `'bank'` place needs a name: change the label expression to `r.place === 'reeds' ? 'gather fibre from the reeds' : r.place === 'bank' ? 'dig clay' : r.title.toLowerCase()`. In the done callback, after `if (r.makes.item) stashAdd(r.makes.item, r.makes.n);` add: `if (r.place === 'kiln'){ const k = tileAt(...camp.kiln).struct; k.fired = (k.fired || 0) + r.makes.n; }`. In the struct branch, when the struct made is a kiln, set `fired: 0` on it: `t.struct = { type: r.makes.struct, camp, fired: 0 };` (harmless on the workshop).

In `src/sim/goals.js`, the water goal: replace `target: 6,` with a getter-free rule inside: change its `state()` to return `s: camp.stash.water >= waterAim() ? 'idle' : 'active'` and `Aim: ${waterAim()}` in the text, and its `offers(a)` guard to `camp.stash.water >= waterAim()`. Add above `GOALS` in `goals.js`: `const waterAim = () => 6 + 6 * (camp.stash.pot || 0);` and delete the `target: 6,` field and the two `this.target` reads.

- [ ] **Step 6: The kiln does not burn, but it is a struct**

The kiln is rock and clay. Leave the burnable lists alone. In `src/ui.js` `drawLoc` struct branch, before the `stone` branch add: `else if (t.struct.type === 'kiln'){ bg = P.pit; g = '⌓'; fg = P.rock; }`. In `inspectTile`, after the Workshop row add: `if (t.struct && t.struct.type === 'kiln') rows.push(['Kiln', `a dome of rock and clay. ${t.struct.fired || 0} pots fired here.`]);`. In `inspectTile`'s camp `find`, add `|| (c.kiln && c.kiln[0] === x && c.kiln[1] === y)`. In the legend, after the workshop entry add `<span><b>⌓</b>kiln</span>`.

- [ ] **Step 7: Tests, soak, bless, build, commit**

Run: `node tests/crafts.js` (8 pass), `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"`, `node --check src/ui.js && node build.js`.

```bash
git commit -m "Clay from the bank, a kiln, and pots that hold water and keep berries" -- src/sim src/ui.js src/page.template.html dist/hearth-sim.html tests/crafts.js tests/soak-golden.json
```

---

### Task 2: A berry garden

**Files:**
- Modify: `src/sim/core.js` (`ITEMS.cuttings`)
- Modify: `src/sim/camps.js` (`makeCamp`)
- Modify: `src/sim/tasks.js` (`startTakeCuttings`, `gardenSpot`)
- Modify: `src/sim/recipes.js`
- Modify: `src/ui.js` (tile card)
- Test: `tests/crafts.js`

**Interfaces:**
- Produces: stash `cuttings`; `camp.garden` (`[x, y]` or null); `startTakeCuttings(a)`; `gardenSpot()` returning `[x, y]` or null; recipe `garden` (once); planted bushes carry `planted = tick` and `garden = camp`.

- [ ] **Step 1: Write the failing test**

Append to `tests/crafts.js`:

```js
test('cuttings from wild bushes make a garden of four near the fire', () => {
  const { api, a, c } = readyCamp();
  const wild = api.tileAt(c.stashTile[0] + 3, c.stashTile[1] + 1); wild.ground = 'grass'; wild.feature = 'bush'; wild.berries = 3; wild.struct = null;
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++){ const t = api.tileAt(c.pit[0] + dx, c.pit[1] + dy); if (t !== wild && !t.struct && t.ground !== 'water'){ t.feature = null; t.ground = Math.abs(dx) + Math.abs(dy) > 2 ? 'soil' : t.ground; } }
  assert.equal(api.goalState(goal(api, 'garden')).s, 'active');
  doOffer(api, a, 'take cuttings');
  assert.ok(c.stash.cuttings >= 2, `cuttings ${c.stash.cuttings}`);
  c.stash.cuttings = 4;
  doOffer(api, a, 'plant a garden');
  assert.ok(c.garden, 'no garden'); assert.equal(c.stash.cuttings, 0);
  const planted = api.world.filter(t => t.feature === 'bush' && t.garden === c);
  assert.equal(planted.length, 4);
  for (const t of planted) assert.ok(api.dist(t.x, t.y, ...c.pit) <= 8);
  assert.equal(api.goalState(goal(api, 'garden')).s, 'done');
  assert.ok(api.chronicle.some(e => e.text.includes('plants a garden')));
});
```

Add `dist,` to the API list.

- [ ] **Step 2: Run the test to see it fail**

Run: `node tests/crafts.js`
Expected: fails; no goal `garden`.

- [ ] **Step 3: Cuttings and the garden spot, in `src/sim/tasks.js`**

In `src/sim/core.js` `ITEMS`, add `  cuttings: { name: 'bundle of cuttings', plural: 'cuttings', mat: 'plant', fuel: 3 },`. In `makeCamp`, add `cuttings: 0` to the stash and `garden: null,` after `kiln: null,`.

After `startDigClay` add:

```js
/* Cuttings come from wild bushes. The bush keeps growing. */
function startTakeCuttings(a){
  if (a.carrying && a.carrying.kind !== 'cuttings') return startDeliver(a);
  const wild = t => t.feature === 'bush' && !t.garden;
  const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, wild, NEAR, z), 2500, a);
  if (!p){ if (a.carrying) return startDeliver(a); return false; }
  a.task = { type: 'gather', label: 'Going to a bush for cuttings', path: p, progress: 0,
    arrive(a, t){
      if (!nearFind(a.x, a.y, wild, NEAR, a.z)) return a.carrying ? (chain(a, t, startDeliver(a)) || 'done') : 'fail';
      t.label = 'Taking cuttings';
      if (++t.progress % 6 === 0){ if (a.carrying) a.carrying.count++; else a.carrying = { kind: 'cuttings', count: 1 }; }
      if (a.carrying && a.carrying.count >= 2){ gainXp(a, 'gather'); return chain(a, t, startDeliver(a)) || 'done'; }
      return 'continue';
    } };
  return true;
}
/* A garden goes on open soil or grass within eight of the pit, with room for four bushes around it. */
function gardenSpot(){
  if (!camp.pit) return null; const [px, py] = camp.pit; let best = null;
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++){
    const x = px + dx, y = py + dy, d = Math.abs(dx) + Math.abs(dy); if (d < 3 || d > 7 || !inb(x, y)) continue;
    const t = tileAt(x, y); if (!passable(x, y) || t.feature || t.struct) continue;
    const room = DIRS.filter(([ex, ey]) => { const q = hasTile(x + ex, y + ey, 0) ? tileAt(x + ex, y + ey) : null; return q && passable(q.x, q.y) && !q.feature && !q.struct && !camps.some(c => c.stashTile && c.stashTile[0] === q.x && c.stashTile[1] === q.y); }).length;
    if (room < 4) continue;
    const sc = -d + (t.ground === 'soil' ? 2 : 0) + rng(); if (!best || sc > best.sc) best = { x, y, sc };
  }
  return best ? [best.x, best.y] : null;
}
```

- [ ] **Step 4: The recipe**

Append to `RECIPES`:

```js
  { id: 'garden', title: 'Plant a garden', after: 'axe', needs: { cuttings: 4 }, tools: ['axe'], place: 'garden', skill: 'gather', work: 80, makes: { garden: true }, score: 40,
    verb: 'plants', done: 'Four bushes by the fire, grown from cuttings. They grow berries like any bush, and feed rabbits like any bush.', blurb: 'Four cuttings from wild bushes, planted on open ground near the fire. Berries close to home.' },
```

In `gatherOffer`, add `if (kind === 'cuttings') return a => startTakeCuttings(a);`. In `placeFor`, add `if (r.place === 'garden') return camp.garden ? null : gardenSpot();`. In `recipeDone`, add `|| (r.makes.garden && camp.garden)`. In the gather-offer label expression, add a case: `r.place === 'garden' ? ...` is not needed (the garden is a make, not a gather), but the input offer label reads `gather cuttings to plant a garden`; the test expects `take cuttings`: change the input-offer label to use a verb table: `label: `${k === 'cuttings' ? 'take' : k === 'clay' ? 'dig' : 'gather'} ${ITEMS[k].plural}``. Update the phase A test's `gather fibre from the reeds` if that label changed (it did not: it is a gather recipe, not an input).

In the done callback, after the wear branch add:

```js
        if (r.makes.garden){ const spots = DIRS.map(([dx, dy]) => tileAt(at[0] + dx, at[1] + dy)).filter(q => passable(q.x, q.y) && !q.feature && !q.struct).slice(0, 4);
          if (spots.length < 4) return; takeNeeds(r.needs);
          for (const q of spots){ q.feature = 'bush'; q.berries = 0; q.planted = tick; q.garden = camp; }
          camp.garden = at; gainXp(a, 'gather'); log(`${a.name} plants a garden of four bushes by the fire.`, campHumans(), 'good'); addThought(a, 'garden', 'Planted a garden', 5, 1500); return; }
```

placed before the generic `takeNeeds(r.needs)` line, so the garden branch handles its own needs. Guard: the generic branch must not run for a garden; the `return` does that.

In `src/ui.js` `inspectTile`, after the `Age` row add: `if (t.garden) rows.push(['Garden', `planted by ${t.garden.name}. Rabbits like it too.`]);`.

- [ ] **Step 5: Tests, soak, bless, build, commit**

Run: `node tests/crafts.js` (9 pass), the soak with `UPDATE_GOLDEN=1`, `node --check src/ui.js && node build.js`.

```bash
git commit -m "A berry garden grown from cuttings by the fire" -- src/sim src/ui.js dist/hearth-sim.html tests/crafts.js tests/soak-golden.json
```

---

### Task 3: A deer pit

**Files:**
- Modify: `src/sim/camps.js` (`makeCamp`)
- Modify: `src/sim/tasks.js` (`pitfallSite`, `startHaulPit`)
- Modify: `src/sim/recipes.js`
- Modify: `src/sim/beings.js` (`runTask` deer step, `checkPitfall`)
- Modify: `src/sim/goals.js` (haul offer on the cook goal)
- Modify: `src/sim/world.js`, `src/sim/weather.js`, `src/ui.js`, `src/page.template.html`
- Test: `tests/crafts.js`

**Interfaces:**
- Produces: `camp.pitfalls` (array of `{ x, y, catch, camp }`); struct type `pitfall`; `pitfallSite()`; `checkPitfall(d)`; `startHaulPit(a, p)`; recipe `pitfall` (standing, up to 2).

- [ ] **Step 1: Write the failing test**

Append to `tests/crafts.js`:

```js
test('a deer pit catches a deer that steps in, and the camp hauls it home', () => {
  const { api, a, c } = readyCamp();
  c.stash.log = 4; c.stash.cord = 2;
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++){ const t = api.tileAt(c.site[0] + dx, c.site[1] + dy); if (!t.struct && t.ground !== 'water'){ t.feature = null; if (Math.abs(dx) + Math.abs(dy) > 3) t.ground = 'grass'; } }
  assert.equal(api.goalState(goal(api, 'pitfall')).s, 'active');
  doOffer(api, a, 'dig a deer pit');
  assert.equal(c.pitfalls.length, 1); const p = c.pitfalls[0]; assert.equal(api.tileAt(p.x, p.y).struct.type, 'pitfall');
  const d = api.beings.find(b => b.species === 'deer'); d.x = p.x; d.y = p.y; d.z = 0; d.alive = true;
  let caught = false; for (let k = 0; k < 80 && !caught; k++){ api.checkPitfall(d); caught = !!p.catch; }
  assert.ok(caught, 'no catch in eighty steps at one in twenty');
  assert.equal(d.alive, false);
  assert.ok(api.chronicle.some(e => e.text.includes('falls into the pit')));
  doOffer(api, a, 'haul the deer from the pit');
  assert.equal(p.catch, null); assert.equal(c.stash.venison, 1);
});
```

Add `checkPitfall,` to the API list.

- [ ] **Step 2: Run the test to see it fail**

Run: `node tests/crafts.js`
Expected: fails; no goal `pitfall`.

- [ ] **Step 3: The pit**

In `makeCamp`, add `pitfalls: [],` after `snares: [],`.

In `src/sim/tasks.js` after `gardenSpot` add:

```js
/* A deer pit goes on grass 8 to 18 tiles from the site, away from snares and other pits, where deer have been seen. */
function pitfallSite(){
  const c = camp.site; let best = null; const s = secOf(c[0], c[1]);
  for (let y = s.sy * LH + 1; y < (s.sy + 1) * LH - 1; y++) for (let x = s.sx * LW + 1; x < (s.sx + 1) * LW - 1; x++){
    const t = tileAt(x, y); if (!passable(x, y) || t.feature || t.struct || t.ground !== 'grass') continue;
    const d = dist(x, y, c[0], c[1]); if (d < 8 || d > 18) continue;
    if (camp.snares.some(sn => dist(sn.x, sn.y, x, y) < 4) || camp.pitfalls.some(p => dist(p.x, p.y, x, y) < 8)) continue;
    const deer = beings.filter(b => b.alive && b.species === 'deer' && nearAt(b, x, y) <= 20).length;
    const sc = deer * 5 - d * 0.1 + rng() * 2; if (!best || sc > best.sc) best = { x, y, sc };
  }
  return best ? [best.x, best.y] : null;
}
/* Haul a caught deer home from the pit. */
function startHaulPit(a, p){
  return startBuild(a, [p.x, p.y], 12, 'Hauling the deer out of the pit', a => { if (!p.catch) return; p.catch = null; a.carrying = { kind: 'venison', count: 1 }; log(`${a.name} hauls the deer out of the pit.`, [a], 'good'); });
}
```

In `src/sim/beings.js`, after `checkSnare` add:

```js
/* A deer that steps onto a pit is caught one time in twenty. */
function checkPitfall(d){
  const t = tileAt(d.x, d.y, d.z);
  if (t && t.struct && t.struct.type === 'pitfall' && !t.struct.pit.catch && rng() < 0.05){
    const p = t.struct.pit; p.catch = 'venison'; d.alive = false; d.status = 'Dead';
    log('A deer falls into the pit.', [], 'good');
    for (const o of beings) if (o.alive && o.species === 'deer' && near(o, d) <= 10) addThought(o, 'herdloss', 'One of the herd was taken', -6, 1200);
  }
}
```

and in `runTask`, change `if (a.species === 'rabbit') checkSnare(a);` to `if (a.species === 'rabbit') checkSnare(a); else if (a.species === 'deer') checkPitfall(a);`.

- [ ] **Step 4: The recipe and the haul offer**

Append to `RECIPES`:

```js
  { id: 'pitfall', title: 'Dig a deer pit', after: 'axe', needs: { log: 4, cord: 2 }, tools: ['axe'], place: 'pitfall', skill: 'trap', work: 90, makes: { pitfall: true }, standing: { stash: 'venison', n: 0 }, active: () => camp.pitfalls.length < 2, score: 38,
    verb: 'digs', blurb: 'Four logs and two coils of cord over a hole on a deer path. A deer that steps in is caught one time in twenty. Up to two pits.' },
```

In `placeFor`, add `if (r.place === 'pitfall') return pitfallSite();`. In the done callback, before the garden branch, add:

```js
        if (r.makes.pitfall){ const q = tileAt(...at); if (q.struct) return; takeNeeds(r.needs); const p = { x: at[0], y: at[1], catch: null, camp }; camp.pitfalls.push(p); q.struct = { type: 'pitfall', pit: p, camp }; gainXp(a, 'trap'); log(`${a.name} digs a deer pit and covers it with logs and cord.`, [a], 'good'); return; }
```

In `recipeGoal`'s standing state text, the `n === 0` branch prints the clothed count; generalise: when `r.standing.n === 0`, use `r.status ? r.status() : ''` and give the clothes recipe `status: () => `${campHumans().filter(h => h.clothes).length} of ${campHumans().length} clothed.`` and the pitfall recipe `status: () => `${camp.pitfalls.length} pits, ${camp.pitfalls.filter(p => p.catch).length} with a deer in.``.

In `src/sim/goals.js`, in the `cook` goal's `offers(a)`, at the top (before the venison branch): `for (const p of camp.pitfalls) if (p.catch) return [{ label: 'haul the deer from the pit', score: 66, start: a => startHaulPit(a, p) }];`. And in its `state()`, count a caught deer as waiting: `const raw = camp.stash.carcass + camp.stash.venison + camp.pitfalls.filter(p => p.catch).length;`.

- [ ] **Step 5: Burning and drawing**

In `src/sim/world.js` (`tileFlam`, `tileFuel`) and `src/sim/weather.js` (`burnOut`), add `'pitfall'` to the burnable struct lists; in `burnOut`'s chain add `else if (k === 'pitfall'){ const p = t.struct.pit, i = c.pitfalls.indexOf(p); if (i >= 0) c.pitfalls.splice(i, 1); }` before the `else c.huts` branch. In `src/ui.js` `drawLoc` struct branch, add `else if (t.struct.type === 'pitfall'){ g = '⊔'; fg = t.struct.pit.catch ? P.carcass : P.stick; }`. In `inspectTile`, add `if (t.struct && t.struct.type === 'pitfall') rows.push(['Deer pit', t.struct.pit.catch ? 'a deer lies in it' : 'covered with logs and cord. One deer in twenty steps in.']);`. Legend: `<span><b>⊔</b>deer pit</span>` after the snare entry.

- [ ] **Step 6: Tests, soak, bless, build, commit**

Run: `node tests/crafts.js` (10 pass), the soak with `UPDATE_GOLDEN=1` (add `pitted: ev('falls into the pit')` to `countEvents` in `tests/lib/run.js` after `fished`), `node --check src/ui.js && node build.js`.

```bash
git commit -m "A deer pit: dug with logs and cord, hauled home when it catches" -- src/sim src/ui.js src/page.template.html dist/hearth-sim.html tests/crafts.js tests/lib/run.js tests/soak-golden.json
```

---

### Task 4: Quarried stone

**Files:**
- Modify: `src/sim/core.js` (`GROUND.rock.quarry`)
- Modify: `src/sim/tasks.js` (`startQuarry`)
- Modify: `src/sim/recipes.js`
- Modify: `src/ui.js` (face row)
- Test: `tests/crafts.js`

**Interfaces:**
- Produces: `GROUND.rock.quarry = true`; `startQuarry(a)`; recipe `quarry` (standing while rocks are short); the first face opened on a hill with a hollow costs 10 favour.

- [ ] **Step 1: Write the failing test**

Append to `tests/crafts.js`:

```js
test('with the axe, rocks are quarried from a rock face within thirty tiles', () => {
  const { api, a, c } = readyCamp();
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++){ const t = api.tileAt(c.site[0] + 6 + dx, c.site[1] + dy); if (!t.struct){ t.feature = null; t.ground = 'grass'; } }
  const face = api.tileAt(c.site[0] + 6, c.site[1]); face.ground = 'rock'; face.hill = { x: face.x, y: face.y, r: 1, storeys: 1, tiles: [api.idx(face.x, face.y)] };
  c.stash.rock = 0;
  assert.equal(api.goalState(goal(api, 'quarry')).s, 'active');
  doOffer(api, a, 'quarry rocks');
  assert.equal(c.stash.rock, 2);
  assert.ok(api.chronicle.some(e => e.text.includes('quarries')));
  c.stash.rock = 6;
  assert.equal(api.goalState(goal(api, 'quarry')).s, 'idle');
  /* A face on a hill that hides a hollow costs favour, once. */
  c.fae.known = true; c.fae.favor = 0; c.stash.rock = 0;
  const cave = api.makeCave('hollow', face.hill); cave.owner = 'sprite';
  doOffer(api, a, 'quarry rocks');
  assert.equal(c.fae.favor, -10);
  doOffer(api, a, 'quarry rocks');
  assert.equal(c.fae.favor, -10, 'the same face is not paid for twice');
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `node tests/crafts.js`
Expected: fails; no goal `quarry`.

- [ ] **Step 3: The rule**

In `src/sim/core.js`, change the rock row to `rock:  { name: 'bare rock',   fuel: 0, flam: 0,   walk: false, quarry: true },`.

In `src/sim/tasks.js` after `startHaulPit` add:

```js
/* Quarry rocks from a rock face: a walkable tile beside ground that can be quarried, within thirty tiles of the site. */
function startQuarry(a){
  if (a.carrying && a.carrying.kind !== 'rock') return startDeliver(a);
  const [sx, sy] = camp.site; let face = null;
  const p = bfs(a.x, a.y, a.z, (x, y, z) => { if (dist(x, y, sx, sy) > 30) return false; for (const [dx, dy] of DIRS){ const q = hasTile(x + dx, y + dy, z) ? tileAt(x + dx, y + dy, z) : null; if (q && GROUND[q.ground].quarry){ face = q; return true; } } return false; }, 3500, a);
  if (!p) return false;
  a.task = { type: 'work', label: 'Walking to the rock face', path: p, progress: 0,
    arrive(a, t){
      if (!face || !GROUND[face.ground].quarry) return 'fail';
      t.label = 'Quarrying rocks'; t.progress += workSpeed(a, 'build');
      if (t.progress < 25) return 'continue';
      a.carrying = { kind: 'rock', count: 2 }; gainXp(a, 'build');
      if (!face.quarried){ face.quarried = true; const hollow = face.hill && caves.find(c => c.kind === 'hollow' && c.hill === face.hill);
        if (hollow){ camp.fae.favor = Math.max(-100, camp.fae.favor - 10); addThought(a, 'quarryfae', 'Broke stone from the sprites\' hill. The rock rang wrong', -4, 900); log(`${a.name} opens a rock face on the sprites' hill. The grove will not like it.`, campHumans(), 'bad'); } }
      log(`${a.name} quarries two rocks from the face.`, [a]);
      return chain(a, t, startDeliver(a)) || 'done';
    } };
  return true;
}
```

Append to `RECIPES`:

```js
  { id: 'quarry', title: 'Quarry stone', after: 'axe', tools: ['axe'], place: 'face', gather: a => startQuarry(a), standing: { stash: 'rock', n: 6 }, score: 41,
    blurb: 'Rocks from a rock face within thirty tiles. Two a go. The loose-rock hunt is over.' },
```

In `recipeGoal`'s gather-offer label expression, add `r.place === 'face' ? 'quarry rocks' :`. In `src/ui.js` `inspectTile`, after the `Hill` row add: `if (GROUND[t.ground].quarry) rows.push(['Rock face', t.quarried ? 'quarried. Rocks come from here.' : 'rocks can be quarried here with the axe.']);`.

- [ ] **Step 4: Tests, soak, bless, build, commit**

Run: `node tests/crafts.js` (11 pass), the soak with `UPDATE_GOLDEN=1`, `node --check src/ui.js && node build.js`.

```bash
git commit -m "Quarried stone: rocks from a rock face, and a price on the sprites' hill" -- src/sim src/ui.js dist/hearth-sim.html tests/crafts.js tests/soak-golden.json
```

---

### Task 5: Record the ladder

**Files:**
- Modify: `design/notes.md`

- [ ] **Step 1: Notes**

In section 8, extend the crafts paragraph with: `Then: dig clay from the bank, build the kiln, fire pots (each pot holds six more drinks at camp, and with a pot berries keep twice as long), plant a garden of four bushes from cuttings, dig up to two deer pits (one deer in twenty that steps in is caught, and the camp hauls it home), and quarry stone from a rock face within thirty tiles. The first face opened on a hill with a hollow costs ten favour.`

- [ ] **Step 2: Run everything, commit**

Run: `node tests/crafts.js && node tests/terrain.js 2>&1 | grep -E "^ℹ (pass|fail)" && node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"`.

```bash
git commit -m "Notes: the second half of the stone-age ladder" -- design/notes.md
```

---

## Self-review

- Spec coverage for phase B: Dig clay (Task 1), Build the kiln (Task 1), Fire pots with the water and berry effects (Task 1), Plant a garden with cuttings and ordinary bushes (Task 2), Dig a deer pit with one-in-twenty and venison (Task 3), Quarry stone with the favour price (Task 4), visibility for each (goals, chronicle, thoughts, cards, legend), tests through the real offers, notes (Task 5).
- Names: `startDigClay`, `startTakeCuttings`, `gardenSpot`, `pitfallSite`, `startHaulPit`, `checkPitfall`, `startQuarry`, `waterAim`, stash kinds `clay`, `pot`, `cuttings`, `camp.kiln`, `camp.garden`, `camp.pitfalls`, struct types `kiln`, `pitfall`, tile fields `garden`, `quarried`, `GROUND.rock.quarry`, `GROUND.sand.clay`. Each defined in the task that first uses it.
