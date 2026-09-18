# UI rethink, plan A: the foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the scrolling page into a window-filling screen with a status strip, alert chips, and four drawers, on top of a split `src/ui/` with pure, tested view-model and key-map files.

**Architecture:** `src/ui.js` becomes `src/ui/`, plain scripts in one scope joined by a manifest as `src/sim/` is. Pure files (`derive.js`, `keys.js`) build a view model and map keys to action names and are tested in Node. DOM files (`strip.js`, `panels.js`, `map.js`, `inspect.js`, `actions.js`, `main.js`) render from the model. The sim gains a `stage` and `after` field on every goal, and one reader, `stageReached`.

**Tech Stack:** Plain JavaScript, no modules, no build step beyond `node build.js`. Node's built-in test runner. Safari for the visual check, through the Safari MCP.

## Global Constraints

- Spec: `design/specs/2026-09-17-ui-rethink-design.md`. This plan covers sections 2, 3, 4, 5, 9 (the rules and the drawer keys), 11 (start and help), 12, 13, and steps 1 to 6 of section 15. Plan B covers the rest.
- Files in `src/sim/` and `src/ui/` are plain scripts that share one scope. No `import`, no `export`.
- Rules read data tables. `stageReached` reads `g.stage` and `goalState`. Nothing in the interface checks a goal's id or title to decide its stage.
- The golden record must not move in this plan. If `node tests/soak.js` reports a fingerprint change, that is a bug in the task, not a number to bless.
- Every button prints its key. A `<button>` in the template without an entry in `KEYMAP` fails `tests/ui.js`.
- Text on screen is plain English, one idea per sentence.
- Work on branch `ui-rethink` in `~/Worktrees/hamlet-ui-rethink`. Never touch `~/Code/hamlet`. Commit after every task by path with the attribution trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Run `node build.js` after every change to `src/`. Run `node tests/ui.js` after every task, and `node tests/terrain.js && node tests/crafts.js && node tests/soak.js` at the end of tasks 3 and 8.
- The dev server for this worktree is `PORT=8701 node serve.js`. Browser checks go through the Safari MCP tools, not the Chrome extension.
- The tests load the joined script with `new Function(...)`, as `src/sim/index.js` already does. That is the project's loader, not a new pattern.

---

## File map

| File | Responsibility |
|---|---|
| `src/ui/index.js` | `FILES` in join order, `source(files)`. |
| `src/ui/state.js` | `TOOLS`, `TRAIT_WORDS`, `NEED_LABEL`, every `let` of view state, `$`, `ui`, `persist`, `restore`. |
| `src/ui/derive.js` | Pure: `gauges`, `alerts`, `stages`, `peopleRows`, `campSummary`, `viewKey`, `drawerRows`. |
| `src/ui/keys.js` | Pure: `DRAWERS`, `KEYMAP`, `keyAction`. |
| `src/ui/actions.js` | `ACTIONS`, one function per action name, and the helpers they call (`setTool`, `setView`, ...). The only place view state changes. |
| `src/ui/map.js` | Palette, the three canvases, `draw`. |
| `src/ui/inspect.js` | The person and tile cards, the hover tip. |
| `src/ui/strip.js` | The strip: clock, camp name and tabs, gauges, chips. |
| `src/ui/panels.js` | `renderUI`, the four drawers, the foot. |
| `src/ui/dialogs.js` | Start and help dialogs. |
| `src/ui/main.js` | `frame`, `initUI`, event wiring. |
| `src/page.template.html` | The fixed grid and the CSS. |
| `build.js` | Joins `src/ui/` through its manifest. |
| `src/sim/core.js` | `STAGES`. |
| `src/sim/goals.js`, `src/sim/recipes.js` | `stage` and `after` on every goal, `stageReached`. |
| `src/sim/index.js` | Exports `API` so tests can join UI files. |
| `tests/ui.js` | The fast UI tests. |
| `design/notes.md` | Section 13 rewritten at the end. |

---

### Task 1: Merge the mid-map branch

**Files:**
- Modify: everything the merge touches: `src/ui.js`, `src/page.template.html`, `design/notes.md`, `dist/hearth-sim.html`.

**Interfaces:**
- Produces: the nearby view, `drawMid`, `NEXT_VIEW`, `VIEW_LABEL`, `move(dx, dy)`, `cycleView()`, `sectorFromMid(e)`, `mcv`, `mctx`, `mhover`, the `#mid` and `#mmap` elements, the `#viewBtn` button.

- [ ] **Step 1: Merge**

```bash
cd ~/Worktrees/hamlet-ui-rethink && git merge mid-map
```

Expected: conflicts in `design/notes.md`, `src/ui.js`, and `dist/hearth-sim.html`. The mid-map branch forked before the quarry commit, so every hunk that mentions quarrying, deer pits near deer, or `t.quarried` comes from `dev` and stays. Every hunk that mentions `mid`, `mmap`, `MS`, `NEXT_VIEW`, `drawMid`, `move(`, or `cycleView` comes from `mid-map` and stays. In `notes.md`, keep both the nearby view bullet and the quarry paragraph, and keep `dev`'s weak-spot list.

- [ ] **Step 2: Resolve, rebuild, and run every test**

```bash
node build.js && node tests/terrain.js && node tests/crafts.js && node tests/soak.js 2>&1 | tail -8
```

Expected: `dist/hearth-sim.html` is rebuilt from the merged sources, and every suite passes with `fail 0`. The soak must report no fingerprint change: the nearby view changes no rule. If `tests/soak-golden.json` conflicted, take `dev`'s version.

- [ ] **Step 3: Check the page in Safari**

Start `PORT=8701 node serve.js` in the background. Open `http://localhost:8701/` in Safari with the MCP `create_tab` and `navigate_to_url` tools. Press M three times through `evaluate_javascript`:

```js
for (const k of ['m','m','m']) document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); return [document.getElementById('where').textContent, document.getElementById('mid').hidden, document.getElementById('world').hidden];
```

Expected: the view cycles sector, nearby, world, sector, and the `where` text follows.

- [ ] **Step 4: Commit the merge**

```bash
git add -A && git commit -m "Merge mid-map: the nearby view of nine sectors

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Split `src/ui.js` into `src/ui/` with no change in behaviour

**Files:**
- Create: `src/ui/index.js`, `src/ui/state.js`, `src/ui/derive.js`, `src/ui/keys.js`, `src/ui/map.js`, `src/ui/inspect.js`, `src/ui/strip.js`, `src/ui/panels.js`, `src/ui/dialogs.js`, `src/ui/actions.js`, `src/ui/main.js`
- Delete: `src/ui.js`
- Modify: `build.js`
- Modify: `src/sim/index.js` (export `API`)
- Test: `tests/ui.js`

**Interfaces:**
- Produces: `require('./src/ui').source(files?)` returns the joined UI script. `require('./src/ui').FILES` is the join order. `require('./src/sim').API` is the return-statement string the tests extend. Every function name in `src/ui.js` keeps its name in its new file.

- [ ] **Step 1: Write the failing test**

Create `tests/ui.js`:

```js
// The interface, the parts that run without a browser. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* Join the sim and the pure UI files in one scope, as the page does, and return the names the tests reach into. */
function loadUI(files, names){
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',');
  return new Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}

test('every UI file joins with the sim into one script that compiles', () => {
  assert.doesNotThrow(() => new Function(sim.source() + '\n' + ui.source()));
});

test('the manifest lists every file in src/ui once, and state comes first', () => {
  const onDisk = fs.readdirSync('src/ui').filter(f => f.endsWith('.js') && f !== 'index.js').map(f => f.replace('.js', '')).sort();
  assert.deepEqual([...ui.FILES].sort(), onDisk);
  assert.equal(ui.FILES[0], 'state');
  assert.equal(ui.FILES[ui.FILES.length - 1], 'main');
});

module.exports = { loadUI };
```

- [ ] **Step 2: Run it to see it fail**

Run: `node tests/ui.js`
Expected: FAIL, `Cannot find module '../src/ui'`.

- [ ] **Step 3: Write the manifest and export `API` from the sim manifest**

Create `src/ui/index.js`:

```js
// The interface as one script, assembled from the files below. Plain scripts
// in one scope, joined after the sim. state.js declares the view state the
// others read at load time, so it goes first. main.js calls initUI() at its
// end, so it goes last. The pure files, derive.js and keys.js, touch no DOM
// and are loaded in Node by tests/ui.js.
const fs = require('fs');
const path = require('path');

const FILES = ['state', 'derive', 'keys', 'map', 'inspect', 'strip', 'panels', 'dialogs', 'actions', 'main'];

function source(files = FILES){
  return files.map(f => fs.readFileSync(path.join(__dirname, f + '.js'), 'utf8')).join('\n');
}

module.exports = { FILES, source };
```

In `src/sim/index.js`, change the last line:

```js
module.exports = { FILES, source, load, API };
```

In `build.js`, replace the `__UI__` line:

```js
const ui = require('./src/ui');
const page = fs.readFileSync('src/page.template.html', 'utf8')
  .replace('__SIM__', () => sim.source())
  .replace('__UI__', () => ui.source());
```

- [ ] **Step 4: Move the code, section by section**

Create the files below by cutting from `src/ui.js`. Move whole functions. Do not edit a line inside a function in this task. The comment banner at the top of each file is the only new text. `derive.js`, `keys.js`, `strip.js`, and `dialogs.js` are created with their banner only, so the manifest resolves; later tasks fill them.

`src/ui/state.js` gets, in this order: the `INTERFACE` banner, `const T = 26, WS = 3, MS = 9;`, `NEXT_VIEW`, `VIEW_LABEL`, `TOOLS`, `TRAIT_WORDS`, `NEED_LABEL`, every `let` line (`viewCamp`, `lvl`, the canvas and tool line, the hover and tip line, the speed line), and `const $ = ...`.

`src/ui/derive.js`: banner only: `/* View model. Pure functions from sim state to what the strip and drawers show. No DOM. */`

`src/ui/keys.js`: banner only: `/* The key map and the dispatcher. No DOM. */`

`src/ui/map.js` gets: `readPalette`, `beingColor`, `hash`, `darkness`, `tileColor`, `drawWorldCache`, `drawWorld`, `sectorSummary`, `midOrigin`, `drawMid`, `drawLoc`, `draw`.

`src/ui/inspect.js` gets: `bar`, `needColor`, `moodWord`, `traitWord`, `inspectBeing`, `inspectTile`, `renderTip`, `hideTip`, `targetForCell`, `pinCell`, `tipForCell`.

`src/ui/strip.js`: banner only: `/* The strip: clock, camp, gauges, chips. */`

`src/ui/panels.js` gets: `renderUI`.

`src/ui/dialogs.js`: banner only: `/* Start and help dialogs. */`

`src/ui/actions.js` gets: `say`, `setTool`, `setSpeed`, `setPaused`, `setLevel`, `levelName`, `setView`, `goto`, `move`, `cycleView`, `randomSeed`, `cellFrom`, `sectorFromMid`, `sectorFrom`, `newWorld`, `applyTool`.

`src/ui/main.js` gets: `frame`, `initUI`, and the final `if (typeof document !== 'undefined') initUI();`.

Then delete `src/ui.js`:

```bash
git rm -q src/ui.js
```

- [ ] **Step 5: Build and prove nothing moved**

```bash
node build.js && node tests/ui.js
```

Expected: both tests pass. Then compare the built page with the one from before the split, ignoring blank lines:

```bash
git show HEAD:dist/hearth-sim.html | grep -v '^\s*$' > /tmp/before.html; grep -v '^\s*$' dist/hearth-sim.html > /tmp/after.html; diff /tmp/before.html /tmp/after.html | grep '^[<>]' | grep -v '^\(<\|>\) */\*' | head
```

Expected: no output. Every line that differs is a file banner comment. If a code line shows, a function was edited or lost.

- [ ] **Step 6: Check the page still runs**

With the dev server up, reload in Safari and run:

```js
for (let i = 0; i < 300; i++) step(); renderUI(true); return [document.querySelectorAll('.goal').length, document.getElementById('clock').textContent, typeof drawMid, typeof renderTip];
```

Expected: 40 goals, a clock string, `function`, `function`.

- [ ] **Step 7: Commit**

```bash
git add build.js src/sim/index.js src/ui tests/ui.js && git commit -m "Split src/ui.js into src/ui/, joined by a manifest, with no change in behaviour

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: A stage and a prerequisite on every goal

**Files:**
- Modify: `src/sim/core.js` (after `SEASONS`)
- Modify: `src/sim/goals.js` (every entry, and after `goalState`)
- Modify: `src/sim/recipes.js` (every row, and `recipeGoal`)
- Modify: `src/sim/index.js` (`API`)
- Test: `tests/ui.js`

**Interfaces:**
- Produces: `STAGES`, an array of `{ id, label }` in ladder order. `g.stage` on every goal, one of the ids. `g.after` on a goal with a prerequisite goal, that goal's id. `stageReached(stageId)` returns true when the stage is `fire` or any goal in it is not blocked, for the current `camp`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui.js`:

```js
const { runDays } = require('./lib/run');

test('every goal has a stage from STAGES, and a prerequisite names a goal that exists', () => {
  const api = loadUI(['state'], ['STAGES', 'stageReached']); api.startWorld('r');
  const ids = new Set(api.GOALS.map(g => g.id)), stages = new Set(api.STAGES.map(s => s.id));
  for (const g of api.GOALS){
    assert.ok(stages.has(g.stage), `${g.id} has stage ${g.stage}`);
    if (g.after) assert.ok(ids.has(g.after), `${g.id} is after ${g.after}, which does not exist`);
  }
  assert.deepEqual(api.STAGES.map(s => s.id), ['fire', 'food', 'tools', 'shelter', 'crafts', 'sprites', 'settlement']);
});

test('at the start only the fire stage is reached; by day 25 of seed r the ladder is open to crafts', () => {
  const fresh = loadUI(['state'], ['STAGES', 'stageReached']); fresh.startWorld('r'); fresh.camp = fresh.camps[0];
  assert.equal(fresh.stageReached('fire'), true);
  assert.equal(fresh.stageReached('tools'), false);
  assert.equal(fresh.stageReached('sprites'), false);
  const { api } = runDays('r', 25); api.camp = api.camps[0];
  for (const s of ['fire', 'food', 'tools', 'shelter', 'crafts']) assert.equal(api.stageReached(s), true, s);
  assert.equal(api.stageReached('sprites'), api.camps[0].fae.known, 'sprites follow first sight');
});
```

`runDays` uses `require('../src/sim').load`, which does not carry the UI names. That is fine: these two tests only need the sim's own names, and `loadUI(['state'], ...)` is used for the fresh world so the `API` extension is exercised.

- [ ] **Step 2: Run it to see it fail**

Run: `node tests/ui.js`
Expected: FAIL, `STAGES is not defined`.

- [ ] **Step 3: Add `STAGES` to core**

In `src/sim/core.js`, after the `SEASON_DAYS` line:

```js
/* The ladder in stages. The panel groups goals by these, in this order. */
const STAGES = [
  { id: 'fire',       label: 'Fire' },
  { id: 'food',       label: 'Food' },
  { id: 'tools',      label: 'Tools' },
  { id: 'shelter',    label: 'Shelter' },
  { id: 'crafts',     label: 'Crafts' },
  { id: 'sprites',    label: 'Sprites' },
  { id: 'settlement', label: 'Settlement' },
];
```

- [ ] **Step 4: Put `stage` and `after` on every hand-written goal**

In `src/sim/goals.js`, add the two fields to each entry right after its `title:` field, from this table. A blank `after` means the field is left out.

| id | stage | after |
|---|---|---|
| camp | fire | |
| firepit | fire | camp |
| fire | fire | firepit |
| hearth | fire | fire |
| food | food | camp |
| cook | food | fire |
| snare | food | fire |
| rack | food | firepit |
| smoke | food | rack |
| deer | food | spear |
| axe | tools | hearth |
| firestones | tools | axe |
| firewood | tools | axe |
| waterskin | tools | cook |
| water | tools | waterskin |
| spear | tools | axe |
| shelter | shelter | axe |
| storehouse | shelter | axe |
| huts | shelter | shelter |
| fae | sprites | |
| stone | sprites | fae |
| offer | sprites | stone |
| ward | sprites | fae |
| faefight | sprites | fae |
| village | settlement | storehouse |
| guard | settlement | fire |
| scout | settlement | shelter |

For example, the fire pit entry begins:

```js
  { id: 'firepit', title: 'Build a fire pit', stage: 'fire', after: 'camp', need: { rock: 6, stick: 8 },
```

- [ ] **Step 5: Put `stage` on every recipe and carry both fields through `recipeGoal`**

In `src/sim/recipes.js`, add `stage: 'crafts',` after `title:` on every row except `fish`, which gets `stage: 'food',`. The `after` field already exists on every row.

In `recipeGoal(r)`, the object it returns starts with `id: r.id, title: r.title`. Add `stage: r.stage, after: r.after,` right after `title: r.title,`.

- [ ] **Step 6: Write `stageReached` and export it**

In `src/sim/goals.js`, after the `goalState` function:

```js
/* A stage is reached when any goal in it is not blocked. The fire stage always is. Reads the current camp. */
function stageReached(stageId){
  if (stageId === 'fire') return true;
  return GOALS.some(g => g.stage === stageId && goalState(g).s !== 'blocked');
}
```

In `src/sim/index.js`, add `STAGES, stageReached, log,` to the `API` string after `GOALS,`. `log` is needed by a later test.

- [ ] **Step 7: Run every test**

```bash
node tests/ui.js && node tests/crafts.js && node tests/terrain.js && node tests/soak.js 2>&1 | tail -8
```

Expected: all pass. The soak prints `the run matches the golden record` for every seed. The fields are data and no rule reads them yet.

- [ ] **Step 8: Commit**

```bash
git add src/sim/core.js src/sim/goals.js src/sim/recipes.js src/sim/index.js tests/ui.js && git commit -m "Every goal carries its stage and its prerequisite, and stageReached reads them

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The view model

**Files:**
- Modify: `src/ui/state.js` (add `ui`)
- Create the body of: `src/ui/derive.js`
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `STAGES`, `stageReached`, `goalState`, `goalPriority`, `PIT_MAX`, `PIT_BURN`, `STICK_FUEL`, `LOG_FUEL`, `DAY`, `SEASON_DAYS`, `SEASONS`, `stashFood`, `foodTarget`, `waterAim`, `bedsFor`, `campHumans`, `mood`, `nearAt`, `tileAt`, `secOf`, `chronicle`, `beings`, `groves`, `fireCount`, `dayOf`, `seasonOf`, `isWinter`.
- Produces, all for the current `camp` unless told otherwise:
  - `gauges()` returns `{ hearth, food, water, beds }`, each `{ v, text, level }` or `null` when it has no meaning. `v` is 0 to 1. `level` is `good`, `warn`, or `bad`.
  - `daysOfWood()` returns a number.
  - `alerts()` returns `[{ n, type, text, level, being, tile }]`, numbered from 1, muted ones left out.
  - `notePulses()` must run once a frame before `alerts()`. It turns new chronicle lines of kind `major` or `death`, and goals that just left `blocked`, into pulses that last 1500 ticks.
  - `isMuted(type, campId)`, `mute(type, campId)`, `unmute(type, campId)`; `campId` of `0` means every camp.
  - `stages(showAll)` returns `[{ id, label, done, idle, goals: [{ g, st, pr, hidden }] }]`, reached stages only unless `showAll`.
  - `peopleRows()` returns `[{ a, m, trouble, status }]`, trouble first.
  - `campSummary()` returns `{ stash: [[kind, n]], tools: [kind], favor, animals: [[species, n]], burning, age }`.
  - `viewKey()` returns a string that changes when anything the strip or drawers show changes.
  - `seasonLine()` returns `Autumn, winter in 11` or `Winter, spring in 3`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui.js`:

```js
const DERIVE = ['gauges', 'daysOfWood', 'alerts', 'notePulses', 'isMuted', 'mute', 'unmute', 'stages', 'peopleRows', 'campSummary', 'viewKey', 'seasonLine', 'drawerRows', 'ui'];
function day21(){
  const api = loadUI(['state', 'derive'], DERIVE); api.startWorld('r');
  let lit = false;
  for (let i = 0; i < 21 * 1000; i++){ api.step(); if (!lit && api.camps[0].pit){ api.camp = api.camps[0]; api.lightTile(...api.camps[0].pit); lit = true; } }
  api.camp = api.camps[0]; return api;
}

test('gauges: the hearth reads days of wood, food reads meals against the aim, water waits for the waterskin', () => {
  const api = day21(); const g = api.gauges();
  assert.ok(g.hearth, 'a lit pit has a hearth gauge');
  assert.match(g.hearth.text, /days? of wood|out|cold/);
  assert.ok(g.hearth.v >= 0 && g.hearth.v <= 1);
  assert.match(g.food.text, /^\d+ of \d+$/);
  if (!api.camp.tools.waterskin) assert.equal(g.water, null); else assert.match(g.water.text, /^\d+ of \d+$/);
  assert.match(g.beds.text, /^\d+ for \d+$/);
  const fresh = loadUI(['state', 'derive'], DERIVE); fresh.startWorld('r'); fresh.camp = fresh.camps[0];
  assert.equal(fresh.gauges().hearth, null, 'no pit, no hearth gauge');
});

test('alerts: a cold person raises a cold chip, a mute hides it, and chips are numbered from one', () => {
  const api = day21(); const a = api.campHumans()[0];
  a.needs.warmth = 20; api.notePulses();
  const cold = api.alerts().find(x => x.type === 'cold');
  assert.ok(cold, 'cold chip'); assert.equal(cold.being, a.id); assert.match(cold.text, new RegExp(a.name));
  assert.equal(api.alerts()[0].n, 1);
  api.mute('cold', api.camp.id);
  assert.equal(api.alerts().some(x => x.type === 'cold'), false, 'muted for this camp');
  api.unmute('cold', api.camp.id); api.mute('cold', 0);
  assert.equal(api.alerts().some(x => x.type === 'cold'), false, 'muted everywhere');
  api.unmute('cold', 0);
  assert.ok(api.alerts().some(x => x.type === 'cold'));
});

test('alerts: a major chronicle line becomes a pulse that lasts 1500 ticks', () => {
  const api = day21();
  api.notePulses();
  const before = api.alerts().filter(x => x.type === 'event').length;
  api.log('Someone saw the smoke. Test comes over the hills.', [], 'major'); api.notePulses();
  assert.equal(api.alerts().filter(x => x.type === 'event').length, before + 1);
  api.tick = api.tick + 1600; api.notePulses();
  assert.equal(api.alerts().filter(x => x.type === 'event').length, before, 'pulse gone');
});

test('stages: only reached stages show, done goals fold, and a blocked goal shows only after its prerequisite', () => {
  const api = day21(); const st = api.stages(false);
  assert.ok(st.length >= 4 && st.length <= 7);
  assert.equal(st[0].id, 'fire');
  const fire = st[0]; assert.equal(fire.done, 3, 'camp, pit, hearth are done'); assert.equal(fire.goals.filter(x => !x.hidden).length, 1, 'keep the fire is the live one');
  for (const s of st) for (const x of s.goals) if (x.st.s === 'blocked' && !x.hidden && x.g.after) assert.equal(api.goalState(api.GOALS.find(g => g.id === x.g.after)).s, 'done');
  const all = api.stages(true); assert.equal(all.length, 7); assert.equal(all.reduce((n, s) => n + s.goals.length, 0), api.GOALS.length);
  const fresh = loadUI(['state', 'derive'], DERIVE); fresh.startWorld('r'); fresh.camp = fresh.camps[0];
  assert.deepEqual(fresh.stages(false).map(s => s.id), ['fire']);
});

test('people rows put trouble first, and the camp summary lists the stash as pairs', () => {
  const api = day21(); const rows = api.peopleRows();
  assert.ok(rows.length >= 1);
  rows[rows.length - 1].a.needs.food = 10;
  const again = api.peopleRows(); assert.ok(again[0].trouble, 'the hungry one is first');
  const c = api.campSummary(); assert.ok(Array.isArray(c.stash)); assert.ok(c.stash.every(p => p.length === 2 && p[1] > 0)); assert.ok(c.tools.includes('axe'));
});

test('the view key changes when the world does', () => {
  const api = day21(); const k1 = api.viewKey(); for (let i = 0; i < 300; i++) api.step(); assert.notEqual(api.viewKey(), k1);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node tests/ui.js`
Expected: FAIL, `api.gauges is not a function` or `gauges is not defined`.

- [ ] **Step 3: Add the state the view model keeps**

Append to `src/ui/state.js`:

```js
/* What the view model remembers between frames. `ui` is one object so the tests can reach it. */
const ui = {
  pulses: [],          /* { text, until, being, tile } from major lines and goal unlocks */
  mutes: new Set(),    /* 'type' for every camp, 'type:campId' for one */
  seenTick: -1,        /* the newest chronicle tick notePulses has read */
  lastStates: {},      /* goal id to state, to see a goal leave blocked */
  open: ['people', 'goals'], /* drawers open, in order */
  focus: 'map',        /* 'map', 'drawer:<id>', or 'dialog' */
  row: { people: 0, goals: 0, chronicle: 0, camp: 0 }, /* the focused row per drawer */
  showAll: false,      /* goals: the whole ladder */
  unfold: {},          /* stage id to true when the player unfolded it */
  chronFilter: 'all',  /* 'all' or 'major' */
  savedSpeed: 0,       /* from storage, applied by newWorld */
};
```

- [ ] **Step 4: Write `derive.js`**

Replace the banner-only `src/ui/derive.js` with:

```js
/* View model. Pure functions from sim state to what the strip and drawers show. No DOM.
   Everything reads the current `camp` unless it says otherwise. */
const level3 = (v, aim) => v >= aim ? 'good' : v >= aim / 4 ? 'warn' : 'bad';

function daysOfWood(){
  const p = camp.pit && tileAt(...camp.pit).struct;
  const fuel = (p ? p.fuel : 0) + camp.stash.stick * STICK_FUEL + camp.stash.log * LOG_FUEL;
  return fuel / (PIT_BURN * DAY);
}
function gauges(){
  const p = camp.pit && tileAt(...camp.pit).struct;
  const days = daysOfWood();
  const hearth = !p ? null : { v: Math.min(1, p.fuel / PIT_MAX), text: !p.lit ? (p.fuel > 0 ? 'laid, cold' : 'out') : days < 1 ? 'under a day of wood' : `${Math.floor(days)} days of wood`, level: !p.lit ? 'bad' : days < 1 ? 'bad' : days < 2 ? 'warn' : 'good' };
  const meals = stashFood() + camp.stash.fish * 2, aim = foodTarget();
  const food = !camp.site ? null : { v: Math.min(1, meals / aim), text: `${meals} of ${aim}`, level: level3(meals, aim) };
  const water = !camp.tools.waterskin ? null : { v: Math.min(1, camp.stash.water / waterAim()), text: `${camp.stash.water} of ${waterAim()}`, level: level3(camp.stash.water, waterAim()) };
  const n = campHumans().length, beds = bedsFor();
  const bedsG = !camp.shelter ? null : { v: Math.min(1, beds / Math.max(1, n)), text: `${beds} for ${n}`, level: beds >= n ? 'good' : 'warn' };
  return { hearth, food, water, beds: bedsG };
}

/* Mutes. 'cold' mutes the type everywhere. 'cold:3' mutes it for camp 3. */
const isMuted = (type, campId) => ui.mutes.has(type) || ui.mutes.has(`${type}:${campId}`);
function mute(type, campId){ ui.mutes.add(campId ? `${type}:${campId}` : type); }
function unmute(type, campId){ ui.mutes.delete(campId ? `${type}:${campId}` : type); }

/* Pulses: a major or death line, or a goal that just left blocked, shows as a chip for 1500 ticks. */
function notePulses(){
  ui.pulses = ui.pulses.filter(p => p.until > tick);
  for (const e of chronicle){
    if (e.tick <= ui.seenTick) break;
    if ((e.kind === 'major' || e.kind === 'death') && e.tick + 1500 > tick) ui.pulses.push({ text: e.text, until: e.tick + 1500 });
  }
  ui.seenTick = chronicle.length ? chronicle[0].tick : ui.seenTick;
  for (const g of GOALS){
    const s = goalState(g).s, was = ui.lastStates[g.id];
    if (was === 'blocked' && s !== 'blocked') ui.pulses.push({ text: `${g.title} is open now.`, until: tick + 1500 });
    ui.lastStates[g.id] = s;
  }
}

/* The first burning tile in the camp's sector, or null. */
function burningNearCamp(){
  if (!camp.site || !fireCount) return null;
  const s = secOf(...camp.site);
  for (let y = s.sy * LH; y < (s.sy + 1) * LH; y++) for (let x = s.sx * LW; x < (s.sx + 1) * LW; x++) if (tileAt(x, y).fire > 0) return [x, y];
  return null;
}

/* Alerts for the current camp. Conditions read state. Chips are numbered from one. */
function alerts(){
  const out = [], add = (type, text, level, extra) => { if (!isMuted(type, camp.id)) out.push({ n: out.length + 1, type, text, level, ...extra }); };
  const p = camp.pit && tileAt(...camp.pit).struct, fuelDays = daysOfWood();
  if (p && camp.everLit && !p.lit) add('fire', 'The hearth is out', 'bad', { tile: camp.pit });
  else if (p && p.lit && fuelDays < 1) add('fire', 'Under a day of wood', 'bad', { tile: camp.pit });
  const burning = burningNearCamp(); if (burning) add('fire', 'A wildfire in the camp sector', 'bad', { tile: burning });
  for (const a of campHumans()){
    if (a.needs.warmth < 30) add('cold', `${a.name} is cold`, 'bad', { being: a.id });
    if (a.needs.food < 25) add('food', `${a.name} is hungry`, 'warn', { being: a.id });
    if (a.needs.water < 25) add('water', `${a.name} is thirsty`, 'warn', { being: a.id });
  }
  const g = gauges();
  if (g.food && (seasonOf() === 'autumn' || isWinter()) && g.food.level !== 'good') add('food', `Food is short: ${g.food.text}`, 'warn', { tile: camp.stashTile });
  if (g.water && camp.stash.water === 0) add('water', 'No water at camp', 'warn', { tile: camp.stashTile });
  if (camp.pit) for (const b of beings) if (b.alive && b.species === 'wolf' && nearAt(b, ...camp.pit) <= 12){ add('threat', 'A wolf near the camp', 'bad', { being: b.id }); break; }
  if (camp.fae.known && camp.fae.favor < -20) add('sprites', `Sprite favour is ${camp.fae.favor}`, 'warn', {});
  if (groves.some(gr => gr.swarmUntil > tick)) add('sprites', 'A grove is out for revenge', 'bad', {});
  for (const pu of ui.pulses) add('event', pu.text, 'info', { being: pu.being, tile: pu.tile });
  return out;
}

/* Goals by stage. A stage shows when reached. Done goals fold to a count. A blocked goal hides until its prerequisite is done. Idle recipes fold. */
function stages(showAll){
  const byId = Object.fromEntries(GOALS.map(g => [g.id, g]));
  return STAGES.filter(s => showAll || stageReached(s.id)).map(s => {
    const goals = GOALS.filter(g => g.stage === s.id).map(g => {
      const st = goalState(g), pr = goalPriority[g.id] ?? 1;
      const preq = g.after && byId[g.after];
      const hidden = !showAll && (st.s === 'done' || (st.s === 'idle' && g.stage === 'crafts') || (st.s === 'blocked' && preq && goalState(preq).s !== 'done'));
      return { g, st, pr, hidden };
    });
    return { id: s.id, label: s.label, done: goals.filter(x => x.st.s === 'done').length, idle: goals.filter(x => x.st.s === 'idle' && x.hidden).length, goals };
  });
}

/* People of the current camp, trouble first. The dead leave the list at once until a death stamp exists. */
function peopleRows(){
  const rows = beings.filter(b => b.species === 'human' && b.camp === camp && (b.alive || (b.diedAt && tick - b.diedAt < DAY))).map(a => {
    const m = a.alive ? mood(a) : 0;
    const bad = a.alive && (a.needs.warmth < 30 || a.needs.food < 25 || a.needs.water < 25 || a.hp < 50);
    return { a, m, trouble: !!bad, status: a.alive ? a.status : 'Dead' };
  });
  return rows.sort((p, q) => (q.trouble - p.trouble) || (q.a.alive - p.a.alive) || p.a.name.localeCompare(q.a.name));
}

function campSummary(){
  return {
    stash: Object.entries(camp.stash).filter(([k, v]) => v > 0),
    tools: Object.entries(camp.tools).filter(([k, v]) => v).map(([k]) => k),
    favor: camp.fae.known ? camp.fae.favor : null,
    animals: ['rabbit', 'deer', 'fox', 'wolf', 'sprite'].map(sp => [sp, beings.filter(b => b.alive && b.species === sp).length]),
    burning: fireCount, age: dayOf() - Math.floor((camp.founded || 0) / DAY),
  };
}

function seasonLine(){
  const s = seasonOf(), next = SEASONS[(SEASONS.indexOf(s) + 1) % 4], left = SEASON_DAYS - ((dayOf() - 1) % SEASON_DAYS);
  return `${s[0].toUpperCase()}${s.slice(1)}, ${next} in ${left}`;
}

/* The rows a drawer's keys act on, in the order the drawer shows them. */
function drawerRows(id){
  if (id === 'people') return peopleRows().map(r => ({ kind: 'person', id: r.a.id, r }));
  if (id === 'goals'){
    const out = [];
    for (const s of stages(ui.showAll)){ out.push({ kind: 'stage', id: s.id, s }); for (const x of s.goals) if (!x.hidden || ui.unfold[s.id]) out.push({ kind: 'goal', id: x.g.id, x }); }
    return out;
  }
  if (id === 'chronicle') return chronicle.filter(e => ui.chronFilter === 'all' || e.kind === 'major' || e.kind === 'death').map(e => ({ kind: 'line', id: e.tick + e.text, e }));
  return [];
}

/* A short string that changes when anything the strip or drawers show changes. */
function viewKey(){
  const g = gauges();
  return [tick >> 4, camp.id, camp.name, JSON.stringify(g), alerts().map(a => a.text).join('|'), stages(ui.showAll).map(s => s.goals.map(x => x.st.s + x.pr + x.hidden).join('')).join(','),
    peopleRows().map(r => `${r.a.id}${r.m >> 2}${r.status}`).join('|'), chronicle.length, chronicle[0] ? chronicle[0].tick : 0, ui.open.join(''), ui.focus, JSON.stringify(ui.row), ui.chronFilter, JSON.stringify(ui.unfold)].join('#');
}
```

A line older than 1500 ticks never becomes a pulse, so a cold start deep in a run shows nothing stale.

`camp.founded` is the founding tick the notes name. If `makeCamp` calls the field something else, read that name. `b.diedAt` does not exist yet: the sim does not stamp deaths, so a dead member leaves the list at once. The naming work adds the stamp.

- [ ] **Step 5: Run the tests**

Run: `node tests/ui.js`
Expected: all pass. If `stages` fails on `fire.done`, check step 4 of task 3: `hearth` is stage `fire`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/state.js src/ui/derive.js tests/ui.js && git commit -m "The view model: gauges, alerts, stages, people rows, and the camp summary, tested in Node

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The key map, the dispatcher, and the action table

**Files:**
- Create the body of: `src/ui/keys.js`
- Modify: `src/ui/actions.js` (add `ACTIONS` and helpers at the end)
- Test: `tests/ui.js`

**Interfaces:**
- Produces:
  - `DRAWERS`: `[{ id, label, key }]` for people, goals, chronicle, camp.
  - `KEYMAP`: an array of `{ key, shift, ctrl, alt, meta, focus, action, arg, label, button }`. `focus` is `'any'`, `'map'`, `'drawer'`, `'dialog'`, or `'speedrow'`. `button` is the id of the button that prints the key, when there is one.
  - `keyAction(ev, focus)` takes `{ key, shiftKey, ctrlKey, altKey, metaKey }` and the focus string and returns `{ action, arg }` or `null`.
  - `ACTIONS`: an object of functions by action name. Every entry in `KEYMAP` names one.
  - Action names in this plan: `pause`, `step`, `hour`, `slower`, `faster`, `speed` (arg 1, 4, 16), `tool` (arg id), `view` (cycle), `levelUp`, `levelDown`, `nav` (arg [dx, dy]), `drawer` (arg id, toggles), `focusNext`, `focusPrev`, `back`, `rowUp`, `rowDown`, `rowOpen`, `rowPick` (arg 1 to 9), `priorityUp`, `priorityDown`, `showAll`, `campN` (arg 1 to 6), `help`, `start`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui.js`:

```js
const KEYS = ['KEYMAP', 'keyAction', 'ACTIONS'];
const ev = (key, mods = {}) => ({ key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods });

test('every key map entry names an action that exists', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  for (const k of api.KEYMAP) assert.equal(typeof api.ACTIONS[k.action], 'function', `${k.key} names ${k.action}`);
});

test('the dispatcher reads focus: Esc goes back, arrows move the cursor on the map and the row in a drawer, numbers toggle drawers on the map and pick rows in one', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.deepEqual(api.keyAction(ev('Escape'), 'map'), { action: 'back', arg: undefined });
  assert.deepEqual(api.keyAction(ev('Escape'), 'drawer:goals'), { action: 'back', arg: undefined });
  assert.deepEqual(api.keyAction(ev('ArrowLeft'), 'map'), { action: 'nav', arg: [-1, 0] });
  assert.deepEqual(api.keyAction(ev('ArrowDown'), 'drawer:people'), { action: 'rowDown', arg: undefined });
  assert.deepEqual(api.keyAction(ev('ArrowLeft'), 'drawer:goals'), { action: 'priorityDown', arg: undefined });
  assert.deepEqual(api.keyAction(ev('2'), 'map'), { action: 'drawer', arg: 'goals' });
  assert.deepEqual(api.keyAction(ev('2'), 'drawer:people'), { action: 'rowPick', arg: 2 });
  assert.deepEqual(api.keyAction(ev('Tab'), 'drawer:people'), { action: 'focusNext', arg: undefined });
  assert.deepEqual(api.keyAction(ev('Tab', { shiftKey: true }), 'map'), { action: 'focusPrev', arg: undefined });
  assert.deepEqual(api.keyAction(ev(' '), 'drawer:goals'), { action: 'pause', arg: undefined });
  assert.deepEqual(api.keyAction(ev('.'), 'map'), { action: 'step', arg: undefined });
  assert.deepEqual(api.keyAction(ev('>', { shiftKey: true }), 'map'), { action: 'hour', arg: undefined });
  assert.deepEqual(api.keyAction(ev('F2'), 'map'), { action: 'campN', arg: 2 });
  assert.equal(api.keyAction(ev('q'), 'map'), null);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node tests/ui.js`
Expected: FAIL, `KEYMAP is not defined`.

- [ ] **Step 3: Write `keys.js`**

Replace the banner-only `src/ui/keys.js` with:

```js
/* The key map and the dispatcher. No DOM.
   One table. Every clickable thing has a row here, and the button prints the key.
   focus: 'any' fires everywhere, 'map' only with the map focused, 'drawer' only with a drawer focused,
   'dialog' only inside a dialog. 'speedrow' never fires; it exists so the speed buttons print a key.
   Movement keys are provisional. A feedback pass follows the first build. Change them here and nowhere else. */
const DRAWERS = [
  { id: 'people',    label: 'People',    key: '1' },
  { id: 'goals',     label: 'Goals',     key: '2' },
  { id: 'chronicle', label: 'Chronicle', key: '3' },
  { id: 'camp',      label: 'Camp',      key: '4' },
];
const KEYMAP = [
  { key: 'Escape',     focus: 'any',    action: 'back',        label: 'Back' },
  { key: 'Tab',        focus: 'any',    action: 'focusNext',   label: 'Next panel' },
  { key: 'Tab',        shift: true, focus: 'any', action: 'focusPrev', label: 'Previous panel' },
  { key: ' ',          focus: 'any',    action: 'pause',       label: 'Pause or resume', button: 'pause' },
  { key: '.',          focus: 'any',    action: 'step',        label: 'Step one tick', button: 'stepBtn' },
  { key: '>',          shift: true, focus: 'any', action: 'hour', label: 'Step one hour', button: 'hourBtn' },
  { key: '-',          focus: 'any',    action: 'slower',      label: 'Slower' },
  { key: '=',          focus: 'any',    action: 'faster',      label: 'Faster' },
  { key: 'm',          focus: 'any',    action: 'view',        label: 'Cycle sector, nearby, world', button: 'viewBtn' },
  { key: ']',          focus: 'any',    action: 'levelUp',     label: 'Up a level', button: 'lvUp' },
  { key: '[',          focus: 'any',    action: 'levelDown',   label: 'Down a level', button: 'lvDown' },
  { key: 'ArrowLeft',  focus: 'map',    action: 'nav', arg: [-1, 0], label: 'West', button: 'nW' },
  { key: 'ArrowRight', focus: 'map',    action: 'nav', arg: [1, 0],  label: 'East', button: 'nE' },
  { key: 'ArrowUp',    focus: 'map',    action: 'nav', arg: [0, -1], label: 'North', button: 'nN' },
  { key: 'ArrowDown',  focus: 'map',    action: 'nav', arg: [0, 1],  label: 'South', button: 'nS' },
  { key: 'ArrowUp',    focus: 'drawer', action: 'rowUp',       label: 'Row up' },
  { key: 'ArrowDown',  focus: 'drawer', action: 'rowDown',     label: 'Row down' },
  { key: 'ArrowLeft',  focus: 'drawer', action: 'priorityDown', label: 'Goal priority down' },
  { key: 'ArrowRight', focus: 'drawer', action: 'priorityUp',  label: 'Goal priority up' },
  { key: 'Enter',      focus: 'drawer', action: 'rowOpen',     label: 'Open row' },
  { key: 'a',          focus: 'drawer', action: 'showAll',     label: 'Goals: show the whole ladder', button: 'showAllBtn' },
  { key: '?',          shift: true, focus: 'any', action: 'help', label: 'Help', button: 'helpBtn' },
  { key: 'F1',         focus: 'any',    action: 'campN', arg: 1, label: 'Camp 1' },
  { key: 'F2',         focus: 'any',    action: 'campN', arg: 2, label: 'Camp 2' },
  { key: 'F3',         focus: 'any',    action: 'campN', arg: 3, label: 'Camp 3' },
  { key: 'F4',         focus: 'any',    action: 'campN', arg: 4, label: 'Camp 4' },
  { key: 'F5',         focus: 'any',    action: 'campN', arg: 5, label: 'Camp 5' },
  { key: 'F6',         focus: 'any',    action: 'campN', arg: 6, label: 'Camp 6' },
  { key: 'Enter',      focus: 'dialog', action: 'start',       label: 'Make world', button: 'newWorld' },
  { key: 'Escape',     focus: 'dialog', action: 'back',        label: 'Close', button: 'helpClose' },
];
for (const t of TOOLS) KEYMAP.push({ key: t.key, focus: 'any', action: 'tool', arg: t.id, label: t.label });
for (const s of [1, 4, 16]) KEYMAP.push({ key: '-', focus: 'speedrow', action: 'speed', arg: s, label: `${s}×`, button: `speed${s}` });
for (const d of DRAWERS) KEYMAP.push({ key: d.key, focus: 'map', action: 'drawer', arg: d.id, label: `Toggle ${d.label}`, button: `tab-${d.id}` });
for (let n = 1; n <= 9; n++) KEYMAP.push({ key: String(n), focus: 'drawer', action: 'rowPick', arg: n, label: `Row ${n}` });

/* The dispatcher. focus is 'map', 'drawer:<id>', or 'dialog'. Returns { action, arg } or null. */
function keyAction(e, focus){
  const kind = focus.startsWith('drawer:') ? 'drawer' : focus;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  for (const k of KEYMAP){
    if (k.focus === 'speedrow') continue;
    if (k.focus !== 'any' && k.focus !== kind) continue;
    if ((k.key.length === 1 ? k.key.toLowerCase() : k.key) !== key) continue;
    if (k.key.length > 1 && !!k.shift !== e.shiftKey) continue;
    if (k.key.length === 1 && k.shift && !e.shiftKey) continue;
    if (!!k.ctrl !== e.ctrlKey || !!k.alt !== e.altKey || !!k.meta !== e.metaKey) continue;
    return { action: k.action, arg: k.arg };
  }
  return null;
}
```

A `?` on a US keyboard arrives as `key: '?'` with `shiftKey` true, and the rule for one-character keys with `shift` handles it. `>` arrives the same way.

- [ ] **Step 4: Add `ACTIONS` to `actions.js`**

Append to `src/ui/actions.js`. The helpers it calls exist there already from the split. `openDrawer`, `rowMove`, `rowOpen`, `rowPick`, and `setPriority` are written in task 7, and `openHelp` and `openStart` in task 6. For this task, write them as the stubs shown so the test's `typeof` check passes; the later tasks replace the stubs.

```js
/* The action table. Every key and every click ends here. The only place view state changes. */
function openDrawer(id, on){ /* task 7 */ }
function rowMove(d){ /* task 7 */ }
function rowOpen(){ /* task 7 */ }
function rowPick(n){ /* task 7 */ }
function setPriority(d){ /* task 7 */ }
function openHelp(){ /* task 6 */ }
function openStart(){ /* task 6 */ }
function focusStep(d){
  const ring = ['map', ...ui.open.map(id => `drawer:${id}`)];
  const i = Math.max(0, ring.indexOf(ui.focus)), j = (i + d + ring.length) % ring.length;
  ui.focus = ring[j]; renderUI(true);
}
const ACTIONS = {
  pause(){ setPaused(!paused); },
  step(){ setPaused(true); step(); renderUI(true); },
  hour(){ setPaused(true); for (let k = 0; k < Math.round(DAY / 24); k++) step(); renderUI(true); },
  slower(){ setSpeed(speed === 16 ? 4 : 1); setPaused(false); },
  faster(){ setSpeed(speed === 1 ? 4 : 16); setPaused(false); },
  speed(s){ setSpeed(s); setPaused(false); },
  tool(id){ setTool(id); },
  view(){ cycleView(); },
  levelUp(){ if (view === 'loc') setLevel(lvl + 1); },
  levelDown(){ if (view === 'loc') setLevel(lvl - 1); },
  nav([dx, dy]){ move(dx, dy); },
  drawer(id){ openDrawer(id); },
  focusNext(){ focusStep(1); },
  focusPrev(){ focusStep(-1); },
  back(){ if (ui.focus !== 'map'){ ui.focus = 'map'; renderUI(true); return; } if (tipPinned) hideTip(); },
  rowUp(){ rowMove(-1); },
  rowDown(){ rowMove(1); },
  rowOpen(){ rowOpen(); },
  rowPick(n){ rowPick(n); },
  priorityUp(){ setPriority(1); },
  priorityDown(){ setPriority(-1); },
  showAll(){ ui.showAll = !ui.showAll; persist(); renderUI(true); },
  campN(n){ const c = camps[n - 1]; if (c){ viewCamp = c; if (c.site){ followId = null; setView(view === 'world' ? 'loc' : view, secOf(...c.site)); } renderUI(true); } },
  help(){ openHelp(); },
  start(){ openStart(); },
};
```

`persist` is defined in task 7. Until then, add a one-line stub at the top of the appended block: `function persist(){ /* task 7 */ }` and replace it in task 7.

- [ ] **Step 5: Run the tests**

Run: `node tests/ui.js`
Expected: PASS, every test.

- [ ] **Step 6: Commit**

```bash
git add src/ui/keys.js src/ui/actions.js tests/ui.js && git commit -m "One key map, a dispatcher that reads focus, and the action table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The frame, the strip, and the start and help dialogs

**Files:**
- Modify: `src/page.template.html` (everything below the three palette blocks)
- Create the body of: `src/ui/strip.js`, `src/ui/dialogs.js`
- Modify: `src/ui/actions.js` (`say`, `setTool`, `setSpeed`, `setPaused`, `setView`, `newWorld`; remove the `openHelp` and `openStart` stubs)
- Modify: `src/ui/main.js` (`initUI` wiring, `frame`)
- Modify: `src/ui/panels.js` (`renderUI` calls `renderStrip` and a first `renderDrawers`)
- Test: `tests/ui.js`

**Interfaces:**
- Produces: `renderStrip()`, `renderDrawers()`, `openHelp()`, `openStart()`, `closeDialogs()`, `anyDialogOpen()`. Element ids: `strip`, `clock`, `season`, `weather`, `campName`, `camps`, `gauges`, `chips`, `pause`, `stepBtn`, `hourBtn`, `speeds` with `speed1 speed4 speed16`, `helpBtn`, `viewBtn`, `where`, `nav` with `nW nN nS nE`, `levels` with `lvDown lvUp level`, `tools`, `foot`, `drawerTabs` with `tab-people` and the rest, `drawers`, `start` dialog with `seed` and `newWorld`, `help` dialog with `helpKeys`, `legend`, `tips`, `helpClose`.
- The old ids `hint`, `stats`, `worldBtn`, `goals`, `people`, `chronicle` (as a page section) go. `say(msg)` now writes to `foot`.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui.js`. It fails now because the old template's buttons (`worldBtn`, `newWorld` without a row, the nav arrows) have no key map rows and the new ones do not exist yet:

```js
test('every template button has a key in the key map', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  const html = fs.readFileSync('src/page.template.html', 'utf8');
  const ids = [...html.matchAll(/<button[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
  const keyed = new Set(api.KEYMAP.map(k => k.button).filter(Boolean));
  for (const id of ids) assert.ok(keyed.has(id), `button #${id} has no key`);
});
```

Run: `node tests/ui.js`
Expected: FAIL, `button #worldBtn has no key`.

- [ ] **Step 2: Rewrite the template**

Keep the `<head>` up to and including the three `:root` palette blocks exactly as they are. Replace everything from `*{box-sizing:border-box}` to the end of the file with:

```html
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 "Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
button,input{font:inherit;color:inherit}
button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn{padding:3px 9px;border:1px solid var(--line);border-radius:6px;background:var(--panel);cursor:pointer;white-space:nowrap}
.btn:hover:not(:disabled){border-color:var(--accent)}
.btn:disabled{opacity:.4;cursor:default}
.btn.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.btn.small{padding:1px 7px;font-size:12px}
kbd{font:500 11px "JetBrains Mono",monospace;opacity:.65;margin-left:5px}
.btn.on kbd{opacity:.85}
.app{display:grid;grid-template-rows:auto minmax(0,1fr);height:100%}
/* The strip: world half, a divider, camp half, controls at the right. */
.strip{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:5px 12px;background:var(--panel);border-bottom:1px solid var(--line);font-size:13px}
.strip .world,.strip .camp,.strip .ctl{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.strip .camp{padding-left:14px;border-left:2px solid var(--line)}
.strip .ctl{margin-left:auto;gap:6px}
#clock{font-weight:700}
#season,#weather{color:var(--muted)}
#weather.on{color:var(--warn)}
#campName{font:700 15px/1 "JetBrains Mono",monospace;letter-spacing:-.01em}
#camps{display:flex;gap:4px}
.gauge{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.gauge .bar{width:64px;height:7px;border-radius:4px;background:var(--bar-bg);overflow:hidden;display:inline-block}
.gauge .bar i{display:block;height:100%}
.gauge .t{color:var(--muted)}
.gauge.warn .t{color:var(--warn)} .gauge.bad .t{color:var(--bad)}
.g-good i{background:var(--good)} .g-warn i{background:var(--warn)} .g-bad i{background:var(--bad)}
#chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:5px;padding:1px 9px;border-radius:12px;border:1px solid;font-size:12px;cursor:default;background:none}
.chip kbd{margin:0;opacity:.7}
.chip.bad{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 40%,transparent)}
.chip.warn{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 40%,transparent)}
.chip.info{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 40%,transparent)}
/* The map box fills the rest. Everything else floats over it. */
.mapbox{position:relative;overflow:hidden;background:var(--panel)}
.mapbox .views{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.map-wrap{max-width:100%;max-height:100%;overflow:auto}
canvas{display:block;touch-action:none;cursor:crosshair;max-height:calc(100vh - 120px);width:auto}
.over{position:absolute;display:flex;gap:6px;align-items:center;z-index:2}
.over.tl{left:10px;top:10px} .over.tl2{left:10px;top:46px;color:var(--muted);font-size:12px;background:color-mix(in srgb,var(--panel) 85%,transparent);padding:2px 8px;border-radius:5px}
#foot{position:absolute;left:10px;bottom:10px;right:400px;z-index:2;display:flex;gap:10px;align-items:center;padding:4px 10px;font-size:12px;background:color-mix(in srgb,var(--panel) 88%,transparent);border:1px solid var(--line);border-radius:6px;min-height:1.6em}
#foot .when{color:var(--muted);font:500 11px "JetBrains Mono",monospace}
/* Drawers: tabs on the right edge, open drawers stacked beside them. */
#drawerTabs{position:absolute;right:10px;top:10px;z-index:3;display:flex;flex-direction:column;gap:6px}
#drawerTabs .btn{writing-mode:vertical-rl;padding:9px 4px}
#drawers{position:absolute;right:52px;top:10px;bottom:10px;width:330px;z-index:3;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.drawer{flex:1 1 0;min-height:0;display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:8px;pointer-events:auto;box-shadow:0 6px 24px rgba(0,0,0,.18)}
.drawer.focus{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 40%,transparent)}
.drawer h2{margin:0;padding:7px 10px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line)}
.drawer h2 .k{font:500 11px "JetBrains Mono",monospace;color:var(--muted);letter-spacing:0;text-transform:none}
.drawer .body{overflow:auto;padding:6px 10px;min-height:0}
.row{display:grid;grid-template-columns:16px 1fr auto;gap:8px;align-items:center;padding:4px 4px;border-bottom:1px solid var(--line);border-radius:4px}
.row:last-child{border-bottom:0}
.row .n{font:500 11px "JetBrains Mono",monospace;color:var(--muted)}
.row.sel{background:color-mix(in srgb,var(--accent) 14%,transparent)}
.row.dead{opacity:.55}
.row .st{color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.row.trouble .st{color:var(--bad)}
.stage{margin:8px 0 2px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);padding-bottom:2px}
.gs{color:var(--muted);font-size:12px;grid-column:2/4}
.tag{font-size:10px;border:1px solid var(--line);border-radius:10px;padding:0 5px;color:var(--muted);margin-left:5px;vertical-align:middle}
.pri{display:inline-flex;border:1px solid var(--line);border-radius:5px;overflow:hidden;flex:none}
.pbtn{font-size:11px;padding:1px 6px;border:0;background:none;cursor:pointer;border-right:1px solid var(--line)}
.pbtn:last-child{border-right:0} .pbtn.on{background:var(--accent);color:var(--accent-ink)}
.g-done .gt{color:var(--good)} .g-blocked .gt{color:var(--muted)}
.bar{display:block;height:7px;border-radius:4px;background:var(--bar-bg);overflow:hidden} .bar i{display:block;height:100%}
#chronicle{list-style:none;margin:0;padding:0}
#chronicle li{padding:3px 0;border-bottom:1px solid var(--line);font-size:13px}
#chronicle li.sel{background:color-mix(in srgb,var(--accent) 14%,transparent)}
#chronicle .when{color:var(--muted);font-size:11px;font-family:"JetBrains Mono",monospace;display:inline-block;min-width:88px}
.k-good{color:var(--good)} .k-bad{color:var(--bad)} .k-death{color:var(--bad);font-weight:700} .k-major{font-weight:700;color:var(--major)}
.filter{display:flex;gap:4px;padding:6px 10px 0}
table.kv{width:100%;border-collapse:collapse;font-size:13px} table.kv td{padding:2px 4px;border-bottom:1px solid var(--line)} table.kv td:first-child{color:var(--muted);width:34%}
/* The hover and pinned card, as before. */
.tip{position:fixed;z-index:10;width:310px;max-height:calc(100vh - 16px);overflow:hidden;padding:10px 12px;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);pointer-events:none;font-size:13px}
.tip[hidden]{display:none} .tip.pinned{pointer-events:auto;border-color:var(--accent)}
.tip .close{float:right;margin:-4px -6px 0 8px;padding:0 7px;border:1px solid var(--line);border-radius:5px;background:none;cursor:pointer;line-height:1.5}
.tip .hist{max-height:150px;overflow:auto}
.ins h3{margin:8px 0 3px;font-size:12px;color:var(--muted);font-weight:700}
.ins .head{display:flex;justify-content:space-between;gap:8px;align-items:baseline} .ins .head strong{font-size:16px}
.ins .why{display:flex;flex-wrap:wrap;gap:4px 10px} .ins .why .picked{color:var(--accent);font-weight:700} .ins .why .failed{color:var(--muted);text-decoration:line-through}
.ins ul{list-style:none;margin:0;padding:0} .ins li{padding:1px 0}
.chips{display:flex;flex-wrap:wrap;gap:5px} .chips .chip{color:var(--ink);border-color:var(--line)}
.pos b{color:var(--good)} .neg b{color:var(--bad)}
.need{display:grid;grid-template-columns:60px 1fr 30px;gap:8px;align-items:center;font-size:13px;margin:3px 0}
.num{text-align:right;color:var(--muted)}
.muted{color:var(--muted);font-size:13px}
/* Dialogs. */
dialog{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:18px 22px;max-width:720px;width:min(92vw,720px);max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)}
dialog::backdrop{background:rgba(0,0,0,.45)}
dialog h1{margin:0 0 6px;font:700 28px/1 "JetBrains Mono",monospace} dialog h1 span{color:var(--accent)}
dialog h2{margin:14px 0 6px;font-size:15px}
dialog p{margin:6px 0;color:var(--muted);max-width:66ch}
.seed{display:flex;gap:8px;align-items:center;margin-top:12px}
.seed input{width:200px;padding:6px 9px;border:1px solid var(--line);border-radius:6px;background:var(--bg)}
.legend{display:flex;flex-wrap:wrap;gap:4px 14px;color:var(--muted);font-size:13px}
.legend b{font:700 14px "JetBrains Mono",monospace;margin-right:4px}
table.keys{border-collapse:collapse;font-size:13px;width:100%} table.keys td{padding:2px 6px;border-bottom:1px solid var(--line)} table.keys td:first-child{font-family:"JetBrains Mono",monospace;white-space:nowrap;width:30%}
dialog ul{margin:6px 0;padding-left:18px} dialog li{margin-bottom:4px}
@media (max-width:1100px){.strip .ctl{margin-left:0;width:100%}}
@media (max-width:800px){#drawers{width:min(92vw,330px)}}
[hidden]{display:none !important}
</style>
</head>
<body>
<div class="app">
  <header class="strip" id="strip">
    <div class="world"><span id="clock"></span><span id="season"></span><span id="weather"></span></div>
    <div class="camp"><span id="campName"></span><span id="camps"></span><span id="gauges"></span><span id="chips"></span></div>
    <div class="ctl">
      <button class="btn" id="pause">Pause<kbd>Space</kbd></button>
      <button class="btn" id="stepBtn">Step<kbd>.</kbd></button>
      <button class="btn" id="hourBtn">Hour<kbd>&gt;</kbd></button>
      <span id="speeds"><button class="btn" id="speed1" data-speed="1">1×<kbd>-</kbd></button><button class="btn" id="speed4" data-speed="4">4×<kbd>- =</kbd></button><button class="btn" id="speed16" data-speed="16">16×<kbd>=</kbd></button></span>
      <button class="btn" id="helpBtn">?<kbd>?</kbd></button>
    </div>
  </header>
  <main class="mapbox">
    <div class="views">
      <div class="map-wrap" id="world"><canvas id="wmap" aria-label="World map"></canvas></div>
      <div class="map-wrap" id="mid" hidden><canvas id="mmap" aria-label="Nearby map: the sector and its eight neighbours"></canvas></div>
      <div class="map-wrap" id="loc" hidden><canvas id="map" aria-label="Location map"></canvas></div>
    </div>
    <div class="over tl">
      <span id="tools" role="toolbar" aria-label="Tools"></span>
      <button class="btn" id="viewBtn" title="Sector, nearby, world map">Nearby<kbd>M</kbd></button>
      <span id="nav"><button class="btn small" id="nW">◀</button><button class="btn small" id="nN">▲</button><button class="btn small" id="nS">▼</button><button class="btn small" id="nE">▶</button></span>
      <span id="levels"><button class="btn small" id="lvDown" title="Down a level">▽<kbd>[</kbd></button><span id="level" class="muted"></span><button class="btn small" id="lvUp" title="Up a level">△<kbd>]</kbd></button></span>
    </div>
    <div class="over tl2" id="where"></div>
    <div id="foot"></div>
    <div id="drawerTabs"></div>
    <div id="drawers"></div>
  </main>
</div>
<div id="tip" class="tip ins" role="tooltip" hidden></div>
<dialog id="start">
  <h1>Hearth<span>@</span></h1>
  <p>One person, one valley, no tools. They will pick a spot, gather loose rocks and sticks, and lay a fire. You are the sky. Give them the spark, keep them honest, and watch who the smoke brings, what the winter takes, what walks in from the dark, and what lives in the oldest pines.</p>
  <form method="dialog" class="seed"><label for="seed" class="muted">World seed</label><input id="seed" autocomplete="off"><button class="btn" id="newWorld">Make world<kbd>Enter</kbd></button></form>
</dialog>
<dialog id="help">
  <h2>Keys</h2>
  <table class="keys" id="helpKeys"></table>
  <h2>The map</h2>
  <div class="legend" id="legend">
    <span><b>@</b>person</span><span><b>r</b>rabbit</span><span><b>d</b>deer</span><span><b>f</b>fox</span><span><b>w</b>wolf</span><span><b>¤</b>sprite</span><span><b>♠</b>hollow pine</span><span><b>⊙</b>offering stone</span><span><b>ǂ</b>ward post</span><span><b>z</b>asleep</span><span><b>♣</b>tree</span><span><b>*</b>berry bush</span><span><b>#</b>boulder</span><span><b>~</b>water</span><span><b>▒</b>rock</span><span><b>·</b>stone floor</span><span><b>◢</b>slope</span><span><b>◠</b>cave mouth</span>
    <span><b>/</b>stick</span><span><b>o</b>rock</span><span><b>%</b>carcass</span><span><b>=</b>log</span><span><b>○</b>fire pit</span><span><b>⌂</b>lean-to</span><span><b>Ξ</b>drying rack</span><span><b>▦</b>storehouse</span><span><b>⊞</b>workshop</span><span><b>⌓</b>kiln</span><span><b>ʌ</b>sapling</span><span><b>▤</b>stash</span><span><b>∩</b>snare</span><span><b>⊔</b>deer pit</span><span><b>▲</b>fire</span>
  </div>
  <h2>Things to try</h2>
  <ul id="tips">
    <li>Wait for the fire pit, then use Light on it. Then use it on the grass instead and compare.</li>
    <li>Let the fire go out. Watch the goals, the moods, and who comes to fix it.</li>
    <li>Pin a rabbit and watch its decisions when a fox or a person comes close.</li>
    <li>Turn Stock food off and see what the newcomers do when they arrive.</li>
    <li>Poke someone who is sitting by the fire when the woodpile is empty.</li>
    <li>Open the world map and point at sectors. People go where the resources are. M cycles the sector, the nearby view, and the world map.</li>
    <li>Keep the hearth lit three days straight. Watch the goal list open up: axe, logs, lean-to, waterskin, spear.</li>
    <li>Let the fire go out at night with meat in the stash. Wolves notice.</li>
    <li>Watch a winter. Berries stop, deer thin out, and only a camp with a rack and smoked meat is comfortable.</li>
    <li>Wait for someone to see a light at the edge of the firelight. Then set an offering stone, or a ward, or neither, and watch what the difference costs.</li>
    <li>Cut trees in a grove sector on purpose. Count the nights until the fire goes out on its own.</li>
    <li>Pin an elder and watch who sits with them. Skills pass by the fire.</li>
    <li>When a camp reaches five people with a roof, two of them will leave in spring to found another. Switch camps with the tabs in the strip.</li>
  </ul>
  <p><button class="btn" id="helpClose">Close<kbd>Esc</kbd></button></p>
</dialog>
<script>
__SIM__
__UI__
</script>
</body>
</html>
```

The tools keep their names, Light and Poke, until plan B renames them. The `Camp site` tool stays in `TOOLS` until plan B removes it.

- [ ] **Step 3: Write `strip.js`**

Replace the banner-only `src/ui/strip.js` with:

```js
/* The strip: clock, season, weather, the camp's name and tabs, four gauges, and alert chips. */
const GAUGE_LABEL = { hearth: 'Hearth', food: 'Food', water: 'Water', beds: 'Beds' };
function gaugeHTML(id, g){
  if (!g) return '';
  return `<span class="gauge ${g.level}" title="${GAUGE_LABEL[id]}: ${g.text}"><span>${GAUGE_LABEL[id]}</span><span class="bar g-${g.level}"><i style="width:${Math.round(g.v * 100)}%"></i></span><span class="t">${g.text}</span></span>`;
}
function chipHTML(a){
  return `<span class="chip ${a.level}" data-chip="${a.n}" title="${a.type}">${a.n <= 9 ? `<kbd>${a.n}</kbd>` : ''}${a.text}</span>`;
}
function renderStrip(){
  $('clock').textContent = stamp();
  $('season').textContent = seasonLine();
  const w = weather.storm ? (isWinter() ? 'Sleet' : 'Rain') : isNight() ? 'Night' : '';
  $('weather').textContent = w; $('weather').classList.toggle('on', !!weather.storm);
  $('campName').textContent = camp.name + (camp.village ? ', a village' : '');
  $('camps').innerHTML = camps.length > 1 ? camps.map((c, i) => `<button class="btn small ${c === viewCamp ? 'on' : ''}" data-camp="${c.id}">${c.name}<kbd>F${i + 1}</kbd></button>`).join('') : '';
  const g = gauges();
  $('gauges').innerHTML = ['hearth', 'food', 'water', 'beds'].map(k => gaugeHTML(k, g[k])).join('');
  $('chips').innerHTML = alerts().map(chipHTML).join('');
}
```

- [ ] **Step 4: Write `dialogs.js`**

Replace the banner-only `src/ui/dialogs.js` with:

```js
/* Start and help dialogs. One dialog is open at a time. Esc closes it. */
function anyDialogOpen(){ return !!document.querySelector('dialog[open]'); }
function closeDialogs(){ for (const d of document.querySelectorAll('dialog[open]')) d.close(); if (ui.focus === 'dialog') ui.focus = 'map'; }
function openStart(){ closeDialogs(); $('seed').value = seedText || ''; ui.focus = 'dialog'; $('start').showModal(); $('seed').focus(); $('seed').select(); }
function keyName(k){
  const key = k.key === ' ' ? 'Space' : k.key === 'Escape' ? 'Esc' : k.key === 'ArrowLeft' ? '←' : k.key === 'ArrowRight' ? '→' : k.key === 'ArrowUp' ? '↑' : k.key === 'ArrowDown' ? '↓' : k.key.length === 1 ? k.key.toUpperCase() : k.key;
  return `${k.ctrl ? 'Ctrl+' : ''}${k.alt ? 'Alt+' : ''}${k.shift && k.key.length > 1 ? 'Shift+' : ''}${key}`;
}
function openHelp(){
  closeDialogs();
  const seen = new Set();
  $('helpKeys').innerHTML = KEYMAP.filter(k => k.focus !== 'speedrow').map(k => { const line = `${keyName(k)}|${k.label}`; if (seen.has(line)) return ''; seen.add(line); return `<tr><td>${keyName(k)}</td><td>${k.label}${k.focus === 'map' ? ' <span class="muted">(map)</span>' : k.focus === 'drawer' ? ' <span class="muted">(drawer)</span>' : ''}</td></tr>`; }).join('');
  ui.focus = 'dialog'; $('help').showModal();
}
```

- [ ] **Step 5: Rewire `actions.js`**

In `src/ui/actions.js`, replace these functions from the split with:

```js
function say(msg){ $('foot').innerHTML = `<span>${msg}</span>`; }
function setTool(id){ tool = id; document.querySelectorAll('#tools .btn').forEach(b => { const on = b.dataset.tool === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); if (tipPinned) hideTip(); }
function setSpeed(s){ speed = s; document.querySelectorAll('#speeds .btn').forEach(b => b.classList.toggle('on', Number(b.dataset.speed) === s)); persist(); }
function setPaused(p){ paused = p; $('pause').innerHTML = `${p ? 'Resume' : 'Pause'}<kbd>Space</kbd>`; $('pause').classList.toggle('on', p); }
function setView(v, s){
  view = v; if (s) cur = { sx: s.sx, sy: s.sy }; hideTip(); hover = null; whover = null; mhover = null;
  $('world').hidden = v !== 'world'; $('loc').hidden = v !== 'loc'; $('mid').hidden = v !== 'mid';
  $('viewBtn').innerHTML = `${VIEW_LABEL[NEXT_VIEW[v]]}<kbd>M</kbd>`;
  renderUI(true);
}
function newWorld(seed){ startWorld(seed); viewCamp = camps[0]; followId = null; lvl = 0; worldDirty = 0; acc = 0; ui.pulses = []; ui.seenTick = -1; ui.lastStates = {}; ui.unfold = {}; restore(); if (ui.savedSpeed) setSpeed(ui.savedSpeed); const a = beings[0]; setView('loc', secOf(a.x, a.y)); }
```

Delete the stubs `openHelp` and `openStart` from the end of `actions.js`, since `dialogs.js` now defines them. `restore` is a task 7 function: add a stub `function restore(){ /* task 7 */ }` beside the `persist` stub for now.

- [ ] **Step 6: Rewire `main.js`**

In `initUI`, replace the tool and speed button lines and the wiring for `newWorld`, `seed`, `worldBtn`, the nav and level buttons, the camps row, and the keydown handler with:

```js
  $('tools').innerHTML = TOOLS.map(t => `<button class="btn" data-tool="${t.id}" aria-pressed="false" title="${t.hint}">${t.label}<kbd>${t.key.toUpperCase()}</kbd></button>`).join('');
  $('tools').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) ACTIONS.tool(b.dataset.tool); });
  $('speeds').addEventListener('click', e => { const b = e.target.closest('[data-speed]'); if (b) ACTIONS.speed(Number(b.dataset.speed)); });
  $('pause').addEventListener('click', ACTIONS.pause);
  $('stepBtn').addEventListener('click', ACTIONS.step);
  $('hourBtn').addEventListener('click', ACTIONS.hour);
  $('helpBtn').addEventListener('click', ACTIONS.help);
  $('helpClose').addEventListener('click', closeDialogs);
  $('start').addEventListener('close', () => { ui.focus = 'map'; newWorld($('seed').value.trim() || randomSeed()); });
  $('viewBtn').addEventListener('click', ACTIONS.view);
  $('nW').onclick = () => ACTIONS.nav([-1, 0]); $('nE').onclick = () => ACTIONS.nav([1, 0]); $('nN').onclick = () => ACTIONS.nav([0, -1]); $('nS').onclick = () => ACTIONS.nav([0, 1]);
  $('lvUp').onclick = ACTIONS.levelUp; $('lvDown').onclick = ACTIONS.levelDown;
  $('camps').addEventListener('click', e => { const b = e.target.closest('[data-camp]'); if (b) ACTIONS.campN(camps.findIndex(c => c.id === Number(b.dataset.camp)) + 1); });
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (anyDialogOpen()){ if (e.key === 'Escape'){ e.preventDefault(); closeDialogs(); } return; }
    const hit = keyAction(e, ui.focus); if (!hit) return;
    e.preventDefault(); ACTIONS[hit.action](hit.arg);
  });
```

Keep the canvas pointer wiring and the tip wiring. Remove the `$('goals')` and `$('people')` listeners and `tipForRow`; task 7 wires the drawers. Replace the last three lines of `initUI` with:

```js
  setTool('inspect'); setSpeed(1);
  newWorld(randomSeed());
  openStart();
  requestAnimationFrame(frame);
```

The start dialog opens over a world already made. Enter with an empty seed makes a fresh random world; a typed seed makes that one.

In `frame`, before `draw()`, add `notePulses();` so alerts see new lines once a frame.

- [ ] **Step 7: Point `renderUI` at the strip and draw the empty drawers**

In `src/ui/panels.js`, rewrite `renderUI` as:

```js
function renderUI(force){
  if (!viewCamp || !camps.includes(viewCamp)) viewCamp = camps[0];
  camp = viewCamp;
  const key = viewKey(); if (!force && key === chronKey) return; chronKey = key;
  renderStrip();
  const s = sectors[secIdx(cur.sx, cur.sy)];
  $('where').textContent = view === 'world' ? 'World map' : view === 'mid' ? `Around ${s.name}, sector ${s.sx},${s.sy}` : `${s.name}, sector ${s.sx},${s.sy} · ${levelName(lvl)}`;
  $('tools').hidden = view !== 'loc';
  $('nav').hidden = view === 'world';
  $('levels').hidden = view !== 'loc';
  $('level').textContent = levelName(lvl); $('lvUp').disabled = lvl >= ZMAX; $('lvDown').disabled = lvl <= ZMIN;
  if (view !== 'world') for (const [id, dx, dy] of [['nW', -1, 0], ['nE', 1, 0], ['nN', 0, -1], ['nS', 0, 1]]){
    const b = $(id), nx = cur.sx + dx, ny = cur.sy + dy, ok = nx >= 0 && ny >= 0 && nx < SW && ny < SH;
    b.disabled = !ok; b.title = ok ? sectors[secIdx(nx, ny)].name : '';
  }
  renderTip();
  renderDrawers();
}
function renderDrawers(){
  $('drawerTabs').innerHTML = DRAWERS.map(d => `<button class="btn ${ui.open.includes(d.id) ? 'on' : ''}" id="tab-${d.id}" data-drawer="${d.id}">${d.label}<kbd>${d.key}</kbd></button>`).join('');
  $('drawers').innerHTML = ui.open.map(id => { const d = DRAWERS.find(d => d.id === id); return `<section class="drawer ${ui.focus === 'drawer:' + id ? 'focus' : ''}" data-drawer="${id}"><h2>${d.label}<span class="k">${d.key}</span></h2><div class="body" id="body-${id}"></div></section>`; }).join('');
}
```

`chronKey` is the old gate variable from `state.js` and is reused as the view key.

- [ ] **Step 8: Build, test, and look**

```bash
node build.js && node tests/ui.js
```

Expected: every test passes, including the new button test: every `<button id>` in the template has a key map row. If one is missing, add its row; do not remove the button.

Reload in Safari at 1440 by 900. Screenshot to `.superpowers/shots/a6-frame.png`. Check: the strip is one line, the map fills the rest with no page scroll, the tools and view buttons float top left, the tabs stand on the right, `?` opens help with a table of keys, Esc closes it, the start dialog shows on load and Enter makes a world.

```js
return [document.body.scrollHeight <= innerHeight, document.getElementById('gauges').children.length, document.getElementById('drawerTabs').children.length];
```

Expected: `[true, 0 or more, 4]`.

- [ ] **Step 9: Commit**

```bash
git add src/page.template.html src/ui tests/ui.js && git commit -m "The frame: a window-filling grid, the strip with gauges and chips, and the start and help dialogs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The four drawers

**Files:**
- Modify: `src/ui/panels.js` (`renderDrawers`, the four bodies, `renderFoot`)
- Modify: `src/ui/actions.js` (replace the stubs `openDrawer`, `rowMove`, `rowOpen`, `rowPick`, `setPriority`, `persist`, `restore`)
- Modify: `src/ui/state.js` (`persist`, `restore`)
- Modify: `src/ui/main.js` (drawer wiring)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `stages`, `peopleRows`, `campSummary`, `drawerRows`, `DRAWERS`, `ui.open`, `ui.focus`, `ui.row`, `ui.showAll`, `ui.unfold`, `ui.chronFilter`.
- Produces: `renderDrawers()`, `renderPeople(el)`, `renderGoals(el)`, `renderChronicle(el)`, `renderCamp(el)`, `renderFoot()`, `persist()`, `restore()`, `focusedDrawer()`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui.js`:

```js
test('drawer rows: goals rows are the visible goals in stage order, people rows are trouble first', () => {
  const api = loadUI(['state', 'derive', 'keys'], DERIVE);
  api.startWorld('r'); api.camp = api.camps[0];
  const rows = api.drawerRows('goals');
  assert.ok(rows.length >= 1);
  assert.equal(rows[0].kind, 'stage'); assert.equal(rows[0].id, 'fire');
  assert.ok(rows.slice(1).every(r => r.kind === 'goal' || r.kind === 'stage'));
  const people = api.drawerRows('people'); assert.equal(people.length, 1); assert.equal(people[0].kind, 'person');
  api.ui.unfold.fire = true;
  assert.ok(api.drawerRows('goals').length >= rows.length, 'unfolding shows at least as many rows');
});

test('persist and restore keep the open drawers, the mutes, and the speed, and cope with no storage', () => {
  const api = loadUI(['state', 'derive', 'keys'], ['ui', 'persist', 'restore', 'mute']);
  const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  api.ui.open = ['goals']; api.mute('cold', 0); api.persist();
  api.ui.open = []; api.ui.mutes.clear(); api.restore();
  assert.deepEqual(api.ui.open, ['goals']); assert.ok(api.ui.mutes.has('cold'));
  delete global.localStorage;
  assert.doesNotThrow(() => api.persist()); assert.doesNotThrow(() => api.restore());
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node tests/ui.js`
Expected: FAIL, `api.persist is not a function`.

- [ ] **Step 3: Write `persist` and `restore`**

Append to `src/ui/state.js`, and delete the two stubs from `actions.js`:

```js
/* What survives a reload: open drawers, mutes, speed, the goals fold, the chronicle filter. Storage may be blocked, so every touch is wrapped. */
const STORE_KEY = 'hearth.ui';
function persist(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ open: ui.open, mutes: [...ui.mutes], speed: typeof speed === 'number' ? speed : 1, showAll: ui.showAll, chronFilter: ui.chronFilter })); } catch (e) { /* no storage */ }
}
function restore(){
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (!s) return;
    if (Array.isArray(s.open)) ui.open = s.open.filter(id => DRAWERS.some(d => d.id === id));
    if (Array.isArray(s.mutes)) ui.mutes = new Set(s.mutes);
    if (typeof s.showAll === 'boolean') ui.showAll = s.showAll;
    if (s.chronFilter === 'all' || s.chronFilter === 'major') ui.chronFilter = s.chronFilter;
    if ([1, 4, 16].includes(s.speed)) ui.savedSpeed = s.speed;
  } catch (e) { /* no storage, or bad data */ }
}
```

`restore` reads `DRAWERS`, which `keys.js` defines and which loads after `state.js`. Function bodies run later than load, so that is fine.

- [ ] **Step 4: Write the drawers**

Replace `renderDrawers` in `src/ui/panels.js` with:

```js
const rowClass = (id, i) => ui.focus === `drawer:${id}` && ui.row[id] === i ? 'sel' : '';
function renderDrawers(){
  $('drawerTabs').innerHTML = DRAWERS.map(d => `<button class="btn ${ui.open.includes(d.id) ? 'on' : ''}" id="tab-${d.id}" data-drawer="${d.id}">${d.label}<kbd>${d.key}</kbd></button>`).join('');
  const html = ui.open.map(id => { const d = DRAWERS.find(d => d.id === id); return `<section class="drawer ${ui.focus === 'drawer:' + id ? 'focus' : ''}" data-drawer="${id}"><h2><span>${d.label}<span class="muted" id="count-${id}"></span></span><span class="k">${d.key} · ↑↓ · ⏎</span></h2>${id === 'chronicle' ? `<div class="filter"><button class="btn small ${ui.chronFilter === 'all' ? 'on' : ''}" data-filter="all">All</button><button class="btn small ${ui.chronFilter === 'major' ? 'on' : ''}" data-filter="major">Major</button></div>` : ''}${id === 'goals' ? `<div class="filter"><button class="btn small ${ui.showAll ? 'on' : ''}" id="showAllBtn">All<kbd>A</kbd></button></div>` : ''}<div class="body" id="body-${id}"></div></section>`; }).join('');
  const keep = {}; for (const b of document.querySelectorAll('#drawers .body')) keep[b.id] = b.scrollTop;
  $('drawers').innerHTML = html;
  for (const id of ui.open){ const el = $(`body-${id}`); ({ people: renderPeople, goals: renderGoals, chronicle: renderChronicle, camp: renderCamp })[id](el); if (keep[el.id] != null) el.scrollTop = keep[el.id]; }
  const sel = document.querySelector('#drawers .sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
}
function renderPeople(el){
  const rows = drawerRows('people');
  $('count-people').textContent = ` · ${rows.filter(r => r.r.a.alive).length}`;
  el.innerHTML = rows.map((r, i) => { const a = r.r.a, st = stage(a);
    return `<div class="row ${rowClass('people', i)} ${r.r.trouble ? 'trouble' : ''} ${a.alive ? '' : 'dead'}" data-being="${a.id}" data-i="${i}"><span class="n">${i < 9 ? i + 1 : ''}</span><span><b style="color:${beingColor(a)}">${a.name}</b>${st === 'young' ? '<span class="tag">young</span>' : st === 'old' ? '<span class="tag">old</span>' : ''}<span class="bar" style="width:70px;display:inline-block;margin-left:8px;vertical-align:middle"><i style="width:${clamp(r.r.m, 0, 100)}%;background:${needColor(r.r.m)}"></i></span></span><span class="st">${r.r.status}</span></div>`; }).join('') || '<div class="muted">Nobody yet.</div>';
}
function renderGoals(el){
  const rows = drawerRows('goals');
  $('count-goals').textContent = '';
  el.innerHTML = rows.map((r, i) => {
    if (r.kind === 'stage'){ const s = r.s, fold = [s.done ? `${s.done} done` : '', s.idle ? `${s.idle} idle` : ''].filter(Boolean).join(' · '); return `<div class="row stage ${rowClass('goals', i)}" data-stage="${s.id}" data-i="${i}"><span class="n">${i < 9 ? i + 1 : ''}</span><span>${s.label}</span><span>${fold}</span></div>`; }
    const { g, st, pr } = r.x, kind = g.standing && st.s === 'active' ? '<span class="tag">ongoing</span>' : '';
    const pri = g.locked ? '' : `<span class="pri">${[['0', 'Off'], ['1', 'On'], ['2', 'High']].map(([v, l]) => `<button class="pbtn ${pr === +v ? 'on' : ''}" data-goal="${g.id}" data-pri="${v}">${l}</button>`).join('')}</span>`;
    return `<div class="row g-${st.s} ${rowClass('goals', i)}" data-goal-row="${g.id}" data-i="${i}"><span class="n">${i < 9 ? i + 1 : ''}</span><span class="gt">${g.title}${kind}</span>${pri}<span class="gs">${st.text}</span></div>`;
  }).join('');
}
function renderChronicle(el){
  const rows = drawerRows('chronicle');
  $('count-chronicle').textContent = ` · ${rows.length}`;
  el.innerHTML = `<ol id="chronicle">${rows.map((r, i) => `<li class="k-${r.e.kind} ${rowClass('chronicle', i)}" data-i="${i}"><span class="when">${r.e.when}</span> ${r.e.text}</li>`).join('')}</ol>`;
}
function renderCamp(el){
  const c = campSummary();
  const kv = [['Name', camp.name + (camp.village ? ', a village' : '')], ['Age', `${c.age} days`], ['Stash', c.stash.map(([k, v]) => `${v} ${ITEMS[k].plural}`).join(', ') || 'empty'], ['Tools', c.tools.join(', ') || 'none'], c.favor !== null ? ['Sprite favour', String(c.favor)] : null, ['In the world', c.animals.map(([sp, n]) => `${n} ${sp}`).join(', ')], c.burning ? ['Burning', `${c.burning} tiles`] : null].filter(Boolean);
  $('count-camp').textContent = '';
  el.innerHTML = `<table class="kv">${kv.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
}
function renderFoot(){
  const e = chronicle[0];
  $('foot').innerHTML = ui.open.includes('chronicle') || !e ? '' : `<span class="when">${e.when}</span><span class="k-${e.kind}">${e.text}</span>`;
}
```

In `renderUI`, call `renderFoot();` after `renderDrawers();`. The `say(msg)` writes from the sector hover still land in the foot and are replaced on the next render; that is fine for this plan.

- [ ] **Step 5: Replace the action stubs**

In `src/ui/actions.js`, replace the five stubs:

```js
function openDrawer(id, on){
  const has = ui.open.includes(id), want = on === undefined ? !has : on;
  if (want && !has) ui.open.push(id); if (!want && has) ui.open = ui.open.filter(x => x !== id);
  ui.focus = want ? `drawer:${id}` : 'map'; ui.row[id] = ui.row[id] || 0; persist(); renderUI(true);
}
const focusedDrawer = () => ui.focus.startsWith('drawer:') ? ui.focus.slice(7) : null;
function rowMove(d){ const id = focusedDrawer(); if (!id) return; const n = drawerRows(id).length; if (!n) return; ui.row[id] = (ui.row[id] + d + n) % n; renderUI(true); }
function rowPick(n){ const id = focusedDrawer(); if (!id) return; if (n - 1 < drawerRows(id).length){ ui.row[id] = n - 1; rowOpen(); } }
function rowOpen(){
  const id = focusedDrawer(); if (!id) return; const r = drawerRows(id)[ui.row[id]]; if (!r) return;
  if (r.kind === 'person'){ const a = beingById(r.id); const el = document.querySelector(`#drawers [data-being="${r.id}"]`); const rect = el ? el.getBoundingClientRect() : { left: 400, top: 200 }; tipTarget = { being: a.id }; tipAnchor = { x: rect.left, y: rect.top, left: true }; tipPinned = true; renderTip(); }
  else if (r.kind === 'stage'){ ui.unfold[r.id] = !ui.unfold[r.id]; renderUI(true); }
  else if (r.kind === 'goal'){ goalPriority[r.id] = ((goalPriority[r.id] ?? 1) + 1) % 3; renderUI(true); }
  /* 'line' rows open nothing until plan B gives the cursor a place to jump to. */
}
function setPriority(d){ const id = focusedDrawer(); if (id !== 'goals') return; const r = drawerRows('goals')[ui.row.goals]; if (!r || r.kind !== 'goal') return; goalPriority[r.id] = clamp((goalPriority[r.id] ?? 1) + d, 0, 2); renderUI(true); }
```

- [ ] **Step 6: Wire the drawers in `main.js`**

In `initUI`, add:

```js
  $('drawerTabs').addEventListener('click', e => { const b = e.target.closest('[data-drawer]'); if (b) ACTIONS.drawer(b.dataset.drawer); });
  $('drawers').addEventListener('pointerdown', e => {
    const sec = e.target.closest('.drawer'); if (!sec) return; const id = sec.dataset.drawer;
    const pri = e.target.closest('[data-goal][data-pri]'); if (pri){ goalPriority[pri.dataset.goal] = Number(pri.dataset.pri); renderUI(true); return; }
    const f = e.target.closest('[data-filter]'); if (f){ ui.chronFilter = f.dataset.filter; ui.row.chronicle = 0; persist(); renderUI(true); return; }
    if (e.target.closest('#showAllBtn')){ ACTIONS.showAll(); return; }
    const row = e.target.closest('[data-i]'); ui.focus = `drawer:${id}`;
    if (row){ ui.row[id] = Number(row.dataset.i); rowOpen(); } else renderUI(true);
  });
  document.querySelector('.mapbox').addEventListener('pointerdown', e => { if (!e.target.closest('#drawers, #drawerTabs, #tip') && ui.focus !== 'map'){ ui.focus = 'map'; renderUI(true); } });
```

The `document` pointerdown that hides a pinned tip must not hide it for clicks inside the drawers: change its selector from `'#tip, #map, #people'` to `'#tip, #map, #drawers'`.

- [ ] **Step 7: Build, test, look**

```bash
node build.js && node tests/ui.js
```

Expected: all pass.

In Safari, reload, close the start dialog, then:

```js
for (let i = 0; i < 12000; i++) step(); camp = camps[0]; if (camps[0].pit) lightTile(...camps[0].pit); for (let i = 0; i < 9000; i++) step(); renderUI(true);
return [ui.open, document.querySelectorAll('#drawers .stage').length, document.querySelectorAll('#drawers [data-goal-row]').length, document.querySelectorAll('#drawers [data-being]').length];
```

Expected: `['people','goals']`, between 3 and 6 stage headings, fewer than 15 goal rows, 1 or more people. Then dispatch keydowns for `3`, `Tab`, `Escape`, and `2` with the goals drawer focused, and check `ui.open` gained `chronicle`, `ui.focus` moved and came back to `map`, and `ui.row.goals` became 1. Screenshot to `.superpowers/shots/a7-drawers.png` and look at it: numbered rows, stage headings with fold counts, the foot showing the newest line when the chronicle is shut.

- [ ] **Step 8: Commit**

```bash
git add src/ui tests/ui.js && git commit -m "The four drawers: people trouble first, goals by stage with folds, the chronicle with a filter, and the camp table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Check, record, and write it down

**Files:**
- Modify: `design/notes.md` (section 13)
- Modify: `README.md` (the test lines)
- Modify: `CLAUDE.md` (layout: `src/ui/`, `tests/ui.js`)

- [ ] **Step 1: Run everything**

```bash
node build.js && node tests/ui.js && node tests/terrain.js && node tests/crafts.js && node tests/soak.js 2>&1 | tail -6
```

Expected: all pass, and the soak says the record matches on every seed. If it does not, find the task that touched `src/sim/` and undo the rule it changed. Only `STAGES`, `stage`, `after`, `stageReached`, and the `API` exports may exist in the sim from this plan.

- [ ] **Step 2: Safari at two widths, both themes**

With the dev server up, set the viewport to 1440 by 900, load, close the start dialog, advance to day 21 as in task 7, and screenshot to `.superpowers/shots/a8-1440-dark.png`. Then:

```js
document.documentElement.dataset.theme = 'light'; readPalette(); renderUI(true); return true;
```

and screenshot `a8-1440-light.png`. Set the viewport to 1024 by 768 and screenshot `a8-1024.png` with the people and goals drawers open. Check in each: no page scroll, the strip wraps to two lines at 1024 and stays on one at 1440, the map is not hidden by the drawers except on the right, every button shows a key, the chips read as sentences.

- [ ] **Step 3: Rewrite section 13 of the notes**

Replace section 13 of `design/notes.md` with:

```markdown
## 13. Interface

The interface is `src/ui/`, plain scripts in one scope joined by `src/ui/index.js` after the sim. `derive.js` and `keys.js` touch no DOM and run in Node under `tests/ui.js`. `actions.js` is the only place view state changes; keys and clicks both end there. The design is `design/specs/2026-09-17-ui-rethink-design.md`.

- The page fills the window. The strip on top has a world half (clock, season with days to the next, weather) and a camp half (the camp's name and tabs, gauges for hearth, food, water, and beds, and alert chips). Pause, step, hour, speeds, and help sit at the right.
- Alerts read state each frame: fire, cold, food, water, threat, sprites, and event pulses from major chronicle lines and goals that open. Chips are numbered. Mutes are per type, per camp or everywhere, and persist.
- The map fills the rest. Three views: sector at 26 px, nearby at 9 px, world at 3 px. M cycles them. The tools and the view buttons float top left. The foot shows the newest chronicle line when the chronicle drawer is shut.
- Four drawers on the right edge: People (trouble first), Goals (by stage, done and idle folded, a blocked goal hidden until its prerequisite is done, A shows all), Chronicle (all or major), Camp (the stash, tools, favour, animals). Keys 1 to 4 toggle them. Tab cycles focus, Esc returns it to the map, arrows move the row, numbers pick, Enter opens, Left and Right set a goal's priority.
- Goals carry a `stage` and an `after`. `stageReached` says whether a stage shows. Both are data.
- Every button prints its key, and `tests/ui.js` fails on one that does not. Movement keys are provisional.
- The hover card and the pinned card are as before. Floating windows, the tile cursor, one-shot tools, and the command palette are plan B.
```

- [ ] **Step 4: Update the README and CLAUDE.md**

In `README.md`, after the crafts test line, add:

```
    node tests/ui.js                 # the view model and the key map, no browser: a few seconds
```

In `CLAUDE.md`, replace the `src/ui.js` bullet with:

```
- `src/ui/`: the canvas interface. Reads state, draws, handles tools. Never changes the rules. Plain scripts in one scope like `src/sim/`, joined by `src/ui/index.js`. `derive.js` and `keys.js` have no DOM and are tested in `tests/ui.js`. `actions.js` is the only file that changes view state.
```

and add after the crafts test bullet:

```
- `tests/ui.js`: the view model, the stages, the key map, every button has a key. Run it after every change to `src/ui/`.
```

- [ ] **Step 5: Commit**

```bash
git add design/notes.md README.md CLAUDE.md && git commit -m "Notes: the interface after plan A

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| 2 frame, start and help off the main screen | 6 |
| 3 strip, every item | 6 (`renderStrip`), 4 (`gauges`, `seasonLine`) |
| 4 alerts, numbered, mute per type and camp | 4. Jump-to-cause and the mute menu need the cursor and dialogs: plan B. Spoil needs a tagged line: after the naming work |
| 5 drawers, all four, fold rules | 7 |
| 5 people: dead stay a day | 4, waits on a death stamp the naming work adds |
| 9 rules: Esc, Enter, arrows, numbers, keys printed | 5, 6, 7, and the button test |
| 11 start, help | 6 |
| 12 architecture, files, data flow, persistence | 2, 4, 5, 7 |
| 13 tests | 2 to 7, 8 |
| 15 steps 1 to 6 | 1 to 7 |

Not in this plan, by design: windows and inspectors (6), the cursor and the map foot's cursor phrase (7), tools (8), the rest of the key map (9), the palette and the mute menu (10, 11). All in plan B.
