# Dwellers and takers: den life, den defence, sprites that steal and gift, wolves that raid fish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wolves and foxes live in their dens: they rest there by day, carry a kill home, bear young there in spring, and defend them. Sprites steal a made thing when cross and leave cord when pleased. Wolves raid fish. This is topography phase 3 (less contention, which needs a people goal and comes with the closing phase) and spec section 3 of the crafts arc.

**Architecture:** Three actions join `START` in `src/sim/species.js` (`home`, `carryHome`, and the defence check inside `updateBeing`), one rule joins `groveTick`'s neighbour `denTick` for births, and two branches join existing sprite actions. The soak learns that a death by a den's owner inside the den is a story, not a bug, and caps it at one per seed.

**Tech Stack:** Plain JavaScript scripts sharing one scope under `src/sim/`. Node's built-in test runner.

## Global Constraints

- Specs: `design/specs/2026-09-17-topography-design.md` section 4 (Dens, Defence; Contention and Favour are the closing phase; deer on high ground is deferred, see self-review) and section 7 (den deaths allowed, reported, capped at one per seed); `design/specs/2026-09-17-crafts-and-neighbours-design.md` section 3.
- Rules read data tables. Files in `src/sim/` are plain scripts, no `import` or `export`. Every new behaviour is visible.
- Every task that changes behaviour re-blesses the golden record after reading the counts. The soak stays green: no death that is not old age except a capped den death, nobody cut off, each seed under 25 seconds.
- Commit after every task on branch `dev`, by path, with your attribution trailer. Match on text, not line numbers.

---

### Task 1: Den life: rest at home, carry the kill home, young in spring

**Files:**
- Modify: `src/sim/species.js` (`START`, `spawnWildlife`, new `denTick`)
- Modify: `src/sim/beings.js` (`chooseTask` for wolf and fox)
- Modify: `src/sim/main.js` (`updateWorld` order: `denTick()` after `groveTick()`)
- Modify: `src/sim/index.js` (API)
- Create: `tests/dwellers.js`

**Interfaces:**
- Produces: `START.home(a)` (walk to the den and rest there), `START.carryHome(a)` (used by `hunt` after a kill when the den is near), `denTick()` (spring young once per den per year), `cave.lastBirth`; beings born in dens have `den` set.

- [ ] **Step 1: Write the failing tests**

Create `tests/dwellers.js`:

```js
// Dwellers: wolves and foxes at home in their dens. Fast: hand-built situations on a real world.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

function denned(species){
  const api = load(); api.startWorld('r');
  const b = api.beings.find(b => b.species === species && b.den);
  assert.ok(b, `no ${species} with a den on seed r`);
  return { api, b, den: b.den };
}
const run = (api, b, n) => { for (let k = 0; k < n && b.alive; k++){ api.camp = api.camps[0]; api.updateBeing(b); api.tick = api.tick + 1; } };
const inDen = (b) => b.den.tiles.some(t => t.x === b.x && t.y === b.y && t.z === b.z);

test('a wolf rests in its den by day', () => {
  const { api, b, den } = denned('wolf');
  const out = den.exit; b.x = out.x; b.y = out.y; b.z = 0; b.task = null; b.asleep = false;
  for (const k in b.needs) b.needs[k] = 90; b.needs.rest = 30;
  api.tick = 10 * 1000 + 500; /* midday */
  run(api, b, 300);
  assert.ok(inDen(b), `the wolf should be home; it is at ${b.x},${b.y},${b.z} doing ${b.task && b.task.label}`);
  assert.ok(b.needs.rest > 30, 'and rested');
});

test('a wolf carries a kill home to its den before eating', () => {
  const { api, b, den } = denned('wolf');
  const out = den.exit; b.x = out.x; b.y = out.y; b.z = 0; b.task = null; b.asleep = false;
  for (const k in b.needs) b.needs[k] = 90; b.needs.food = 20;
  api.tick = 22 * 1000 + 100; /* night */
  const r = api.beings.find(o => o.species === 'rabbit' && o.alive); r.x = out.x + 2; r.y = out.y; r.z = 0; r.task = null;
  for (const t of [[out.x + 1, out.y], [out.x + 2, out.y]]){ const q = api.tileAt(...t); q.feature = null; q.struct = null; if (q.ground === 'water') q.ground = 'grass'; }
  let carried = false;
  for (let k = 0; k < 400 && !(carried && !b.carrying); k++){ api.camp = api.camps[0]; api.updateBeing(b); if (b.carrying && b.carrying.kind === 'carcass') carried = true; api.tick = api.tick + 1; }
  assert.ok(carried, 'the wolf never picked up the kill');
  assert.equal(b.carrying, null, 'the kill was eaten at home');
  assert.ok(inDen(b), 'eaten in the den');
  assert.equal(b.needs.food, 100);
  assert.ok(api.chronicle.some(e => e.text.includes('drags')));
});

test('a den with two adults bears one young in spring, once a year', () => {
  const { api, den } = denned('wolf');
  const adults = api.beings.filter(b => b.alive && b.species === 'wolf' && b.den === den);
  assert.equal(adults.length, 2);
  api.tick = 2 * 1000 + 500; /* spring */
  for (const w of adults){ const t = den.tiles[0]; w.x = t.x; w.y = t.y; w.z = t.z; }
  const before = api.beings.filter(b => b.species === 'wolf').length;
  api.denTick(); api.tick = api.tick + 500; api.denTick();
  const after = api.beings.filter(b => b.species === 'wolf').length;
  assert.equal(after, before + 1, 'one pup, not two');
  const pup = api.beings[api.beings.length - 1];
  assert.equal(pup.den, den); assert.equal(pup.born, api.tick - 500); assert.ok(inDen(pup));
  assert.ok(api.chronicle.some(e => e.text.includes('pup') || e.text.includes('kit')));
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/dwellers.js`
Expected: three failures (`api.denTick` is not a function; the wolf does not go home).

- [ ] **Step 3: Home and the kill carried home, in `src/sim/species.js`**

In the `Object.assign(START, { ... })` block for animal actions, add two actions:

```js
  /* Go home to the den and rest there. */
  home(a){
    const c = a.den; if (!c) return false;
    const floor = c.tiles.filter(t => passable(t.x, t.y, t.z)); if (!floor.length) return false;
    const spot = floor[a.id % floor.length];
    if (a.x === spot.x && a.y === spot.y && a.z === spot.z){ a.task = { type: 'rest', label: 'Resting in the den', path: [], wait: 60, arrive(a){ a.needs.rest = Math.min(100, a.needs.rest + 40); return 'done'; } }; return true; }
    const p = legPath(a, spot.x, spot.y, 0, spot.z); if (!p) return false;
    a.task = { type: 'travel', label: 'Going home to the den', path: p, arrive(a, t){ if (nearAt(a, spot.x, spot.y, spot.z) > 0){ const q = legPath(a, spot.x, spot.y, 0, spot.z); if (!q) return 'fail'; t.path = q; return 'continue'; } return 'done'; } };
    return true;
  },
  /* Carry a kill home and eat it there. */
  carryHome(a){
    const c = a.den; if (!c || !a.carrying) return false;
    const floor = c.tiles.filter(t => passable(t.x, t.y, t.z)); if (!floor.length) return false;
    const spot = floor[a.id % floor.length];
    const p = legPath(a, spot.x, spot.y, 0, spot.z); if (!p) return false;
    a.task = { type: 'travel', label: 'Carrying the kill home', path: p, fast: false,
      arrive(a, t){ if (nearAt(a, spot.x, spot.y, spot.z) > 0){ const q = legPath(a, spot.x, spot.y, 0, spot.z); if (!q) return 'fail'; t.path = q; return 'continue'; }
        a.carrying = null; a.needs.food = 100; addThought(a, 'fed', 'Ate at home', 8, 600); log(`A ${SPECIES[a.species].label} drags its kill into the den.`, []); return 'done'; },
      cleanup(){ if (a.carrying){ addItem(a.carrying.kind, a.x, a.y, a.z); a.carrying = null; } } };
    return true;
  },
```

In `hunt`'s kill line, replace

```js
          prey.hp = 0; t.label = 'Eating'; a.needs.food = 100; addThought(a, 'fed', 'Made a kill', 8, 600); gainXp(a, 'hunt'); die(prey, `was caught by a ${SPECIES[a.species].label}`); return 'done'; }
```

with

```js
          prey.hp = 0; gainXp(a, 'hunt'); die(prey, `was caught by a ${SPECIES[a.species].label}`);
          if (a.den && prey.species === 'rabbit' && nearAt(a, a.den.exit.x, a.den.exit.y) <= 30){ const it = itemAt(prey.x, prey.y, prey.z); if (it && it.kind === 'carcass'){ removeItem(it); a.carrying = { kind: 'carcass', count: 1 }; return chain(a, t, START.carryHome(a)) || 'done'; } }
          t.label = 'Eating'; a.needs.food = 100; addThought(a, 'fed', 'Made a kill', 8, 600); return 'done'; }
```

`die` on a rabbit adds a carcass item where it fell; the wolf picks it up and carries it. `chain` is in `src/sim/tasks.js` and in scope.

- [ ] **Step 4: Rest at home in `chooseTask`, in `src/sim/beings.js`**

In the wolf branch of `chooseTask`, change `{ type: 'rest', score: n.rest < 40 ? 50 : (drowsy(a) ? 40 : 0) }` to `{ type: a.den ? 'home' : 'rest', score: n.rest < 40 ? 50 : (drowsy(a) ? 40 : 0) }`. In the fox branch (the final `else`), change `{ type: 'rest', score: n.rest < 40 ? 50 : (drowsy(a) ? 35 : 0) }` to `{ type: a.den ? 'home' : 'rest', score: n.rest < 40 ? 50 : (drowsy(a) ? 35 : 0) }`. Wolves and foxes are drowsy by day, so by day they go home.

- [ ] **Step 5: Young in spring, in `src/sim/species.js` after `spawnWildlife`**

```js
/* Each den with two grown owners bears one young in spring, once a year. Edge arrivals are the floor, not the source. */
function denTick(){
  if (tick % 500 !== 0 || seasonOf() !== 'spring') return;
  for (const c of caves){
    if (c.kind !== 'den' || !c.owner || c.owner === 'sprite') continue;
    if (c.lastBirth && tick - c.lastBirth < 20 * DAY) continue;
    const grown = beings.filter(b => b.alive && b.species === c.owner && b.den === c && stage(b) === 'adult');
    if (grown.length < 2) continue;
    const floor = c.tiles.filter(t => passable(t.x, t.y, t.z)); if (!floor.length) continue;
    const t = floor[0]; const y = makeBeing(c.owner, t.x, t.y, null, 0); y.z = t.z; y.born = tick; y.den = c; beings.push(y); c.lastBirth = tick;
    log(c.owner === 'wolf' ? 'A wolf pup is born in the den under the hill.' : 'Fox kits are born in the den under the hill.', []);
  }
}
```

In `spawnWildlife`, halve the edge arrivals: change `tick % 5000 === 2500` to `tick % 10000 === 2500` for wolves and `tick % 3000 === 0` to `tick % 6000 === 0` for foxes. In `src/sim/main.js` `updateWorld`, add `denTick();` after `groveTick();`. Add `denTick,` to the API list in `src/sim/index.js`.

- [ ] **Step 6: Tests, soak, bless, commit**

Run: `node tests/dwellers.js` (3 pass), `UPDATE_GOLDEN=1 node tests/soak.js 2>&1 | grep -E "^ℹ (pass|fail|duration)|✖|ms,|ℹ \{"`. Add `pups: ev('is born in the den') + ev('kits are born')` and `dragged: ev('drags its kill')` to `countEvents` in `tests/lib/run.js`.

```bash
git commit -m "Den life: wolves and foxes rest at home, carry a kill home, and bear young in spring" -- src/sim tests/dwellers.js tests/lib/run.js tests/soak-golden.json
```

---

### Task 2: A den is defended

**Files:**
- Modify: `src/sim/species.js` (new `defendDen`)
- Modify: `src/sim/beings.js` (`updateBeing`)
- Modify: `tests/lib/run.js`, `tests/soak.js` (den deaths)
- Test: `tests/dwellers.js`

**Interfaces:**
- Produces: `defendDen(a)` called each tick for a grown wolf or fox standing in its den; a human on a den tile is attacked by day or night; death text `was killed in a den by a wolf` or `... by a fox`; the soak counts `denDeaths` and allows at most one per seed.

- [ ] **Step 1: Write the failing test**

Append to `tests/dwellers.js`:

```js
test('a person who walks into a wolf den is attacked, brand or no brand, by day', () => {
  const { api, b, den } = denned('wolf');
  const t = den.tiles.find(t => api.passable(t.x, t.y, t.z)); b.x = t.x; b.y = t.y; b.z = t.z; b.task = null; b.asleep = false;
  for (const k in b.needs) b.needs[k] = 90;
  api.tick = 10 * 1000 + 500;
  const h = api.beings[0]; h.x = t.x; h.y = t.y; h.z = t.z; h.carrying = { kind: 'ember', count: 1, dies: api.tick + 400 }; h.hp = 100; h.thoughts = [];
  api.camp = api.camps[0]; api.updateBeing(b);
  assert.ok(h.hp < 100, 'the wolf should have bitten');
  assert.ok(h.thoughts.some(t => t.key === 'denbite'));
  assert.ok(api.chronicle.some(e => e.text.includes('in its den')));
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `node tests/dwellers.js`
Expected: the new test fails; the person is unharmed.

- [ ] **Step 3: The rule**

In `src/sim/species.js` after `denTick` add:

```js
/* A grown owner standing in its den attacks any person on the den's tiles, by day or night, brand or no brand. One bite every 150 ticks. */
function defendDen(a){
  const c = a.den; if (!c || stage(a) === 'young' || (a.cooldown.defend || 0) > tick) return;
  const here = tileAt(a.x, a.y, a.z); if (!here || here.cave !== c) return;
  const h = beings.find(b => b.alive && b.species === 'human' && b.z === a.z && c.tiles.some(t => t.x === b.x && t.y === b.y && t.z === b.z));
  if (!h) return;
  const wolf = a.species === 'wolf';
  h.hp -= wolf ? 20 + rint(15) : 6 + rint(5); h.lastHurt = `was killed in a den by a ${a.species}`; h.asleep = false;
  addThought(h, 'denbite', wolf ? 'Bitten by a wolf in its own den' : 'Bitten by a fox in its den', wolf ? -20 : -8, 1500); drift(h, 'bravery', -0.02);
  log(`A ${a.species} comes at ${h.name} in its den.`, [h], 'bad');
  a.cooldown.defend = tick + 150; addThought(a, 'defend', 'Drove an intruder from the den', 6, 600);
  failTask(h); START.flee(h);
}
```

In `src/sim/beings.js` `updateBeing`, after the line `if (a.asleep) n.rest = Math.min(100, n.rest);` add: `if (a.den) defendDen(a);`.

- [ ] **Step 4: The soak allows one den death a seed**

In `tests/lib/run.js`: add `const DEN_DEATH = /was killed in a den by/;` after `OLD_AGE`; change `oddDeaths` to filter `!OLD_AGE.test(e.text) && !DEN_DEATH.test(e.text)`; add `const denDeaths = events => deaths(events).filter(e => DEN_DEATH.test(e.text)).map(e => e.text);` and export it. In `tests/soak.js`, import `denDeaths` and add a subtest after the old-age one:

```js
    await t.test('at most one person a seed dies in a den', () => {
      const d = denDeaths(events); if (d.length) t.diagnostic(`${seed}: den deaths: ${d.join('; ')}`);
      assert.ok(d.length <= 1, `den deaths: ${d.join('; ')}`);
    });
```

- [ ] **Step 5: Tests, soak, bless, commit**

Run: `node tests/dwellers.js` (4 pass), the soak with `UPDATE_GOLDEN=1`. Report any den deaths the soak prints.

```bash
git commit -m "A den is defended: an owner at home bites any person on its floor" -- src/sim tests/dwellers.js tests/lib/run.js tests/soak.js tests/soak-golden.json
```

---

### Task 3: Sprites steal and gift, wolves raid fish

**Files:**
- Modify: `src/sim/fae.js` (`prank`, `watch`)
- Modify: `src/sim/species.js` (`raid`)
- Modify: `src/sim/recipes.js` (gather loose cord)
- Test: `tests/dwellers.js`

**Interfaces:**
- Produces: a prank branch "a made thing is missing" when the stash holds a pot, cord, or the camp a basket; a watch gift of cord at favour 40 or more; raids take fish; the cord recipe offers to gather loose cord in the camp's sector.

- [ ] **Step 1: Write the failing tests**

Append to `tests/dwellers.js`:

```js
test('a cross sprite steals a pot, and a pleased one leaves cord on the stone', () => {
  const api = load(); api.startWorld('r');
  const c = api.camps[0]; api.camp = c; const a = api.beings[0];
  api.setSite(a.x, a.y); const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: true }; c.pit = [t.x, t.y]; c.everLit = true;
  c.fae.known = true; c.fae.favor = -30; c.stash.pot = 1; c.stash.berries = 5; c.fae.lastPrank = 0;
  const sp = api.beings.find(b => b.species === 'sprite');
  sp.x = c.stashTile[0]; sp.y = c.stashTile[1]; sp.z = 0; sp.task = null;
  api.tick = 22 * 1000; api.rngNext = null;
  let stolen = false;
  for (let k = 0; k < 40 && !stolen; k++){ c.stash.pot = 1; c.fae.lastPrank = 0; api.START.prank(sp); sp.task.arrive(sp, sp.task); stolen = c.stash.pot === 0; }
  assert.ok(stolen, 'the pot was never taken in forty pranks');
  assert.ok(api.chronicle.some(e => e.text.includes('pot is gone')));
  c.fae.favor = 50; c.stone = [c.pit[0] + 3, c.pit[1]]; api.tileAt(...c.stone).struct = { type: 'stone', camp: c, offering: 0 };
  let cord = false;
  for (let k = 0; k < 40 && !cord; k++){ sp.task = null; api.START.watch(sp); sp.task.progress = 119; sp.x = c.pit[0] + 5; sp.y = c.pit[1]; sp.task.arrive(sp, sp.task); cord = !!api.items.find(i => i.kind === 'cord' && i.x === c.stone[0] && i.y === c.stone[1]); for (const i of api.items.filter(i => i.kind === 'moss' && i.x === c.stone[0])) api.removeItem(i); }
  assert.ok(cord, 'no cord on the stone in forty nights');
  assert.ok(api.chronicle.some(e => e.text.includes('coil of cord lies')));
});

test('a wolf raid takes fish as it takes meat', () => {
  const api = load(); api.startWorld('r');
  const c = api.camps[0]; api.camp = c; const a = api.beings[0];
  api.setSite(a.x, a.y); const t = api.tileAt(...c.site); t.ground = 'soil'; t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: false }; c.pit = [t.x, t.y];
  c.stash.fish = 2; c.stash.carcass = 0; c.stash.cooked = 0; c.stash.smoked = 0;
  const w = api.beings.find(b => b.species === 'wolf'); w.x = c.stashTile[0]; w.y = c.stashTile[1]; w.z = 0; w.task = null; w.needs.food = 20; w.cooldown = {};
  api.tick = 22 * 1000;
  assert.ok(api.START.raid(w), 'the raid should start with fish in the stash');
  w.task.arrive(w, w.task);
  assert.equal(c.stash.fish, 1);
});
```

Add `removeItem,` to the API list in `src/sim/index.js` if it is not there.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node tests/dwellers.js`
Expected: both new tests fail.

- [ ] **Step 3: The sprite branches, in `src/sim/fae.js`**

In `prank`'s `arrive`, the food-theft branch begins `else { const k = c.stash.cooked > 0 ? 'cooked' : ...`. Before that `else`, add a branch:

```js
        else if ((c.stash.pot > 0 || c.stash.cord > 0 || c.tools.basket) && rng() < 0.5){
          if (c.stash.pot > 0){ stashTake('pot'); log('A pot is gone from the stash, and there are tiny footprints in the clay.', campHumans(), 'bad'); }
          else if (c.stash.cord > 0){ stashTake('cord', Math.min(2, c.stash.cord)); log('A coil of cord is gone from the stash. Something small has been busy.', campHumans(), 'bad'); }
          else { c.tools.basket = 0; log('The basket is gone from the stash, and the tiny footprints lead into the dark.', campHumans(), 'bad'); }
          for (const h of campHumans()) addThought(h, 'stolen', 'Sprites took something we made', -5, 800);
        }
```

In `watch`'s `arrive`, the gift line reads `if (++t.progress === 120 && c.stone && c.fae.favor >= 20 && rng() < 0.5){ ... addItem('moss', ...) ... }`. Change it to leave cord instead of moss when favour is 40 or more:

```js
        if (++t.progress === 120 && c.stone && c.fae.favor >= 20 && rng() < 0.5){ const st = tileAt(...c.stone).struct; if (!itemAt(c.stone[0], c.stone[1]) && st.offering === 0){ const gift = c.fae.favor >= 40 && rng() < 0.5 ? 'cord' : 'moss'; addItem(gift, c.stone[0], c.stone[1]); camp = c; log(gift === 'cord' ? 'A coil of cord lies on the offering stone in the morning, knotted by small hands.' : 'A tuft of glowing moss lies on the offering stone in the morning.', campHumans(), 'good'); } }
```

- [ ] **Step 4: Wolves raid fish, in `src/sim/species.js`**

In `raid`, change `if (c.stash.carcass + c.stash.cooked + c.stash.smoked <= 0) return false;` to include fish: `if (c.stash.carcass + c.stash.fish + c.stash.cooked + c.stash.smoked <= 0) return false;`, and the pick `const k = c.stash.carcass > 0 ? 'carcass' : c.stash.cooked > 0 ? 'cooked' : ...` to `const k = c.stash.carcass > 0 ? 'carcass' : c.stash.fish > 0 ? 'fish' : c.stash.cooked > 0 ? 'cooked' : c.stash.smoked > 0 ? 'smoked' : null;`.

- [ ] **Step 5: Loose cord is gathered, in `src/sim/recipes.js`**

In `recipeGoal`'s `offers`, after the input-gather loop and before `if (out.length) return out;`, add: `if (r.makes && r.makes.item && looseCount(r.makes.item)(sectors[secIdx(...Object.values(secOf(...camp.site)))]) > 0) out.push({ label: `gather ${ITEMS[r.makes.item].plural} left for us`, score: (r.score || 40) + 5, start: a => startGather(a, r.makes.item) });`.

- [ ] **Step 6: Tests, soak, bless, commit**

Run: `node tests/dwellers.js` (6 pass), `node tests/crafts.js`, the soak with `UPDATE_GOLDEN=1`. Add `stolen: ev('is gone from the stash')` and `cordGifts: ev('coil of cord lies')` to `countEvents`.

```bash
git commit -m "Sprites steal a pot, cord, or the basket when cross, and leave cord when pleased; wolves raid fish" -- src/sim tests/dwellers.js tests/lib/run.js tests/soak-golden.json
```

---

### Task 4: Notes

- [ ] **Step 1:** In `design/notes.md` section 10 (Danger), add: `A wolf or fox in its own den bites any person on the den's floor, by day or night, with or without a brand. This is the one exception to the four conditions above. The soak allows one such death a seed and reports it.` In section 11 (sprites), add to Produce: `cord on the offering stone at favour 40 or more`; to pranks: `a pot, cord, or the basket goes missing`. In section 7 (life clocks), add: `Wolves and foxes bear one young in their den each spring when two grown owners live there. Arrivals from the world's edge are half as frequent.` Under "Known weak spots" add `- Deer do not yet prefer the high ground when wolves are about; they climb hills only by chance.`
- [ ] **Step 2:** Run all four test files and the soak; commit: `git commit -m "Notes: den life, den defence, and what sprites take and give" -- design/notes.md`.

---

## Self-review

- Spec coverage: den rest and carrying home (Task 1), births with edge arrivals halved (Task 1), defence with the soak allowance (Task 2), sprite theft and gifts (Task 3), wolves raid fish (Task 3), rabbits and deer graze gardens (emergent from bushes, nothing to build). Deferred with a note: deer on high ground (needs deer to graze grass on hills, which they cannot today). Contention (clear the den, the den returning to owners) is a people goal and comes in the closing phase with the other cave goals.
- Names: `START.home`, `START.carryHome`, `denTick`, `defendDen`, `cave.lastBirth`, `DEN_DEATH`, `denDeaths`, thought keys `denbite`, `defend`, `stolen`. Each defined in the task that first uses it.
