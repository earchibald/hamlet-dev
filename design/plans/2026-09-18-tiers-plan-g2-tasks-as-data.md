# G2, Tasks as Data: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every task a plain record, with its behaviour in one table, `TASKS`, so that a task can be saved, read, and later run by a second executor. The soak fingerprint does not move.

**Architecture:** `src/sim/tasks.js` moves ahead of `beings.js` in the load order and gains `TASKS`, `startTask`, and the tick executor. A being's task becomes `{ kind, type, args, stop, path, label, ... }`, numbers and strings only. `TASKS[kind]` holds `begin`, `stops`, and `release`, and a job done at one place also declares `work` and `effect`. During the plan the executor runs old closure tasks and new records side by side, so the conversion goes file by file with the golden as the guard.

**Tech stack:** Plain JavaScript scripts in one scope (no modules), Node's built-in test runner, no dependencies.

| Task | Converts | Files |
|---|---|---|
| 1 | The table, `startTask`, the executor in two modes, `pathToStop`, the ratchet, and four simple kinds | `tasks.js`, `beings.js`, `path.js`, `index.js`, `tests/tasks.js` |
| 2 | The other base kinds: drink, eat, socialize, shelter, sit | `beings.js` |
| 3 | The animals and the gnomes | `species.js` |
| 4 | The sprites, and the fight with a sprite | `fae.js` |
| 5 | Deliver, the gathering family, fishing, quarrying, tree cutting, the waterskin | `tasks.js` |
| 6 | `workKind`, the snare and pit jobs, the ember, joining, the founding party | `tasks.js`, `camps.js` |
| 7 | The chases and the brand: the deer hunt, the guard, the cave search, the rockfall, the den | `tasks.js` |
| 8 | Offers as data: goals and recipes | `goals.js`, `recipes.js`, `beings.js` |
| 9 | The close: one mode, no `START`, the plain-data test, the documents | all of the above, `design/`, `CLAUDE.md` |

## Global Constraints

- Work in `/Users/earchibald/Worktrees/hamlet-tiers` on branch `tiers`. Never check out, stash, or commit in `~/Code/hamlet`.
- **The golden must not move.** After every task, `node tests/soak.js` passes against the committed `tests/soak-golden.json`. Never run `UPDATE_GOLDEN=1`. Never edit the golden. If the fingerprint moves, the conversion changed behaviour. Find the site and fix it.
- Do not lower a soak floor. Do not skip or park a test. When a test calls a function you remove, change the test to reach the same behaviour through the new interface. Do not delete an assertion.
- **The order of calls does not change.** `rng()`, `rint()`, `shuffle()`, `bfs()`, `pathToStop()`, `log()`, `addThought()`, and `nextId++` happen in the same order, the same number of times, with the same arguments. A search that ran when a task started still runs when the task starts. A search that ran on arrival still runs on arrival.
- **Values and texts do not change.** Every label, chronicle line, thought key, thought text, score, and number stays as it is.
- A task record holds numbers, strings, booleans, null, and arrays and plain objects of those. It holds no function and no reference to a being, a tile, an item, a camp, a cave, or a grove. A thing is named by an id or by coordinates and found again when needed.
- Files in `src/sim/` are not ES modules. They share one scope. Do not add `import` or `export`.
- `src/sim/index.js` holds a line `return new Function(source() + '\n' + API)();`. An edit hook may warn about it. Do not change that line. If a security hook blocks an edit and you believe it is a false positive, do not work around it with another tool. Stop and report it.
- The source holds very long one-line statements. Make small, exact edits. Do not reformat or re-wrap code you do not convert.
- A duration or a rate goes in `CLOCK` (`src/sim/clock.js`). `tests/clock.js` fails on a bare one. This plan adds no new duration.
- Run `node build.js` after every change to `src/`, and commit `dist/hearth-sim.html` with the change.
- Game text and comments use plain English, one idea per sentence.
- The names are fixed: `TASKS`, `startTask`, `setTask`, `taskStop`, `goTo`, `workKind`, `pathToStop`, and the record fields `kind`, `type`, `args`, `stop`.
- `node tests/soak.js` takes about 90 seconds. Give it a timeout of at least 300 seconds.

## The design every task follows

Read this section before you convert a file.

### The record

```js
a.task = { kind: 'gather', type: 'gather', args: { item: 'stick', id: 412 }, stop: 0,
           path: [[x, y, z], ...], label: 'Looking for sticks', progress: 0, started: 8123, key: 'gather sticks' };
```

| Field | Meaning |
|---|---|
| `kind` | The key into `TASKS`. One kind, one behaviour. |
| `type` | The category that rules read today: `'work'`, `'gather'`, `'flee'`, `'sit'`, `'guard'`, `'hunt'`, `'travel'`, and so on. It keeps today's value for every task, because `updateBeing`, `chooseTask`, and the interface compare it. |
| `args` | What the task is about: ids, coordinates, item kinds, counts. Plain data. |
| `stop` | Which of the kind's stops the task is at. Today's `t.arrive = ...` reassignment becomes `t.stop = 1`. |
| `path`, `label`, `progress`, `wait`, `fast`, `target`, `within` | As today. |
| `started`, `key` | Set by `chooseTask` and `chain`, as today. |

### The table

```js
TASKS.rest = {
  type: 'rest',
  begin(a, args){ return { label: a.species === 'rabbit' ? 'Resting in the grass' : 'Dozing', wait: CLOCK.task.doze }; },
  stops: [(a, t) => { a.needs.rest = Math.min(100, a.needs.rest + 40); return 'done'; }],
};
```

| Entry | Meaning |
|---|---|
| `type` | The default `type` of the record. `begin` may return another. |
| `begin(a, args)` | Everything today's `startX` did before it built the task: the checks, the search for the target, the first path, a reservation, a chronicle line. It returns the record's other fields (`label`, `path`, `progress`, ...), or `false` when the task cannot start. It may write what it found into `args`. It returns `true` when it handed over to another kind with `startTask` or `setTask`, as `startGather` hands over to `startDeliver` today. |
| `stops` | An array of functions `(a, t)`. The executor calls `stops[t.stop]` on each stride once the path is walked. Each returns `'continue'`, `'done'`, or `'fail'`, exactly as `arrive` does today. |
| `release(a, t)` | Today's `cleanup`: what the task lets go of when it ends or fails. A claim, a reservation, a brand. |
| `work`, `effect` | Declared by `workKind` for a job done at one place. The day tier (plan G5) reads them. |

`args` replaces what the closure captured:

| The closure held | `args` holds | Found again with |
|---|---|---|
| a being (`prey`, `d`, `w`, `h`, `mate`, `kin`, `sp`) | its `id` | `beingById(id)`. A dead animal leaves the list of beings after a while, so treat "not found" as "not alive". |
| an item (`it`, `found`) | its `id` | `items.find(i => i.id === id)`. Treat "not found" as `!items.includes(it)`. |
| a tile (`tree`, `face`, `spot`, `t`, `b`) | `[x, y, z]` | `tileAt(x, y, z)` |
| a snare or a pit (`s`, `p`) | `[x, y]` | `tileAt(x, y).struct` |
| a cave (`c`) | its index in `caves` | `caves[i]`. No rule removes a cave from the list. Check this with `grep -n "caves\.\(splice\|pop\|shift\)\|caves = " src/sim/*.js` before you rely on it. |
| a camp (`c`, `k`) | its index in `camps` | `camps[i]` |
| a grove (`g`) | the being's own `a.grove`, read again | |
| a predicate (`wet`, `hasFood`, `bushy`) | a short string that names it, or nothing when the species decides | a function in the kind |
| a number or a string | itself | |

When a lookup can come back empty where the old reference could not, say so in your report, with the case. The golden decides whether it matters.

### The helpers (task 1 writes them)

| Helper | Does |
|---|---|
| `startTask(a, kind, args)` | Copies `args`, calls `TASKS[kind].begin`, and sets `a.task`. Returns true or false, as `startX` does today. |
| `setTask(a, kind, args, fields)` | Sets the record without `begin`, for a task whose path is already in hand. |
| `goTo(a, t, x, y, within, z)` | The walk-on check that twenty tasks repeat today. It returns null when the being is within reach, and otherwise sets a new path and returns `'continue'`, or returns `'fail'` when there is no way. |
| `taskStop(a)` | Runs the current stop once and returns its result. Tests use it where they called `task.arrive` by hand. |
| `chain(a, old, ok)` | Unchanged. |
| `workKind({...})` | Builds the kind for a job done at one place. Task 6 writes it. |

Use `goTo` only where the old code is exactly this shape, with the same `within` and the same `z`:

```js
if (nearAt(a, x, y, z) > n){ const q = legPath(a, x, y, n, z); if (!q) return 'fail'; t.path = q; return 'continue'; }
```

A task that fails at once when it is not there (the guard at the pit) keeps its own line.

### Two modes until the close

The executor runs a task that still has an `arrive` function the old way, and a task with a `kind` through the table. `endTask` and `failTask` call `cleanup` on an old task and `release` on a new one. `chooseTask` starts a kind when `TASKS` has the option's type, and calls `START` otherwise. Task 9 removes the old mode.

When you convert `startX`, and code outside your task's files still calls `startX`, leave a one-line wrapper: `function startX(a, s){ return startTask(a, 'checkSnare', { at: [s.x, s.y] }); }`. Task 8 removes the wrappers with their last callers.

### The ratchet

`tests/tasks.js` counts, for each file of `src/sim/`, the matches of `/\barrive\b|\bcleanup\b|\bstart: |\bSTART\b/`. `PENDING` records the count a file may still hold. Your task lowers the counts of its files. The close deletes the ratchet.

---

### Task 1: The table, the executor in two modes, and four simple kinds

**Files:**
- Modify: `src/sim/tasks.js` (new section at the top; `chain` stays)
- Modify: `src/sim/beings.js` (`endTask`, `failTask`, `runTask` move out; `rest`, `wander`, `flee`, `sleep` become kinds; `chooseTask` gains one branch)
- Modify: `src/sim/path.js`, and every caller: `legPath` becomes `pathToStop`
- Modify: `src/sim/index.js` (`FILES` order, the header comment, `API`)
- Modify: `tests/terrain.js` (the two `legPath` calls), `CLAUDE.md` (the load-order rule)
- Create: `tests/tasks.js`
- Modify: `package.json` (the `fast` script)

**Interfaces:**
- Produces: `TASKS`, `startTask(a, kind, args = {})`, `setTask(a, kind, args, fields)`, `taskStop(a)`, `goTo(a, t, x, y, within, z = 0)`, `pathToStop(a, tx, ty, within, tz = 0)`, and the executor `runTask`, `endTask`, `failTask` in `tasks.js`. The kinds `rest`, `wander`, `flee`, `sleep`.

- [ ] **Step 1: Rename `legPath` to `pathToStop`**

```bash
cd /Users/earchibald/Worktrees/hamlet-tiers
grep -rl "legPath" src tests | xargs sed -i '' 's/\blegPath\b/pathToStop/g'
grep -rn "legPath" src tests design/notes.md CLAUDE.md
```

macOS `sed` does not know `\b`. If the first command changes nothing, use `perl -pi -e 's/\blegPath\b/pathToStop/g'` on the same files. The last command must print nothing for `src` and `tests`. In `src/sim/path.js`, change the comment above the function to: "The path to a task's next stop. A far stop is approached in stretches of 48 steps." Leave `design/notes.md` history as it is; task 9 adds a line about the new name.

Run `node build.js && npm run fast`. Expected: all pass.

- [ ] **Step 2: Write the failing tests**

Create `tests/tasks.js`:

```js
// Tasks as data: the table, the executor, and a ratchet that counts what is still a closure.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load, FILES } = require('../src/sim');

/* A value a task record may hold: numbers, strings, booleans, null, and arrays and plain objects of those. */
function plain(v, at = 'task'){
  if (v === null || ['number', 'string', 'boolean'].includes(typeof v)) return [];
  if (typeof v === 'undefined') return [];
  if (Array.isArray(v)) return v.flatMap((x, i) => plain(x, `${at}[${i}]`));
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return Object.keys(v).flatMap(k => plain(v[k], `${at}.${k}`));
  return [`${at} holds a ${typeof v === 'function' ? 'function' : 'reference'}`];
}

test('tasks.js loads before beings.js, which adds kinds to TASKS', () => {
  assert.ok(FILES.indexOf('tasks') < FILES.indexOf('beings'));
});

test('startTask builds a plain record from the table', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.failTask(a);
  assert.ok(api.startTask(a, 'rest'));
  assert.equal(a.task.kind, 'rest'); assert.equal(a.task.type, 'rest'); assert.equal(a.task.stop, 0);
  assert.equal(a.task.wait, api.CLOCK.task.doze); assert.deepEqual(a.task.path, []);
  assert.deepEqual(plain(a.task), []);
});

test('startTask copies its args, and an unknown kind is an error', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.failTask(a);
  const args = {}; api.startTask(a, 'rest', args);
  assert.notEqual(a.task.args, args);
  assert.throws(() => api.startTask(a, 'no such kind'), /No task kind/);
});

test('the executor runs a record to its end', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.failTask(a); a.needs.rest = 10;
  api.startTask(a, 'rest');
  for (let k = 0; k < api.CLOCK.task.doze + 2 && a.task; k++) api.runTask(a);
  assert.equal(a.task, null); assert.equal(a.needs.rest, 50);
});

test('goTo is null within reach, and sets a path when it is not', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.failTask(a); api.startTask(a, 'rest');
  assert.equal(api.goTo(a, a.task, a.x, a.y, 1, a.z), null);
  const [sx, sy] = a.camp && a.camp.site ? a.camp.site : [a.x, a.y];
  const far = api.beings.find(b => b.alive && b !== a && api.nearAt(b, a.x, a.y, a.z) > 6 && b.z === 0);
  if (far){ const r = api.goTo(a, a.task, far.x, far.y, 1, 0); assert.ok(r === 'continue' || r === 'fail'); if (r === 'continue') assert.ok(a.task.path.length > 0); }
});

test('flee, wander, and sleep go through the table', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.failTask(a);
  assert.ok(api.startTask(a, 'wander')); assert.equal(a.task.kind, 'wander'); assert.deepEqual(plain(a.task), []);
  api.failTask(a);
  assert.ok(api.startTask(a, 'sleep'));
  assert.ok(a.asleep || (a.task && a.task.kind === 'sleep'));
});

/* ---------- the ratchet ---------- */
const SIM = path.join(__dirname, '..', 'src', 'sim');
const OLD = /\barrive\b|\bcleanup\b|\bstart: |\bSTART\b/g;
/* What each file may still hold. Each task of the plan lowers its files. The close removes the ratchet. */
const PENDING = {
};
test('no file holds more closure tasks than the ratchet allows', () => {
  const over = [];
  for (const f of FILES){
    const n = (fs.readFileSync(path.join(SIM, f + '.js'), 'utf8').match(OLD) || []).length, allowed = PENDING[f] || 0;
    if (n > allowed) over.push(`${f}.js holds ${n}, and ${allowed} are allowed`);
    if (PENDING[f] !== undefined && n < allowed) over.push(`${f}.js holds ${n}. Lower its PENDING count from ${allowed}.`);
  }
  assert.equal(over.length, 0, over.join('\n'));
});

/* Every task of kind in a short run is plain data. The close extends this to every task. */
test('every record the table starts is plain data', () => {
  const api = load(); api.startWorld('r');
  const bad = new Set();
  for (let k = 0; k < 6000; k++){
    api.step();
    for (const b of api.beings) if (b.alive && b.task && b.task.kind) for (const s of plain(b.task)) bad.add(`${b.task.kind}: ${s}`);
  }
  assert.deepEqual([...bad], []);
});
```

- [ ] **Step 3: Run the tests and see them fail**

Run: `node --test tests/tasks.js`
Expected: FAIL. The first test fails on the order of `FILES`, and the others report that `api.startTask` is not a function.

- [ ] **Step 4: Move `tasks.js` ahead of `beings.js`**

In `src/sim/index.js`, `FILES` becomes:

```js
const FILES = ['core', 'clock', 'field', 'marks', 'world', 'path', 'camps', 'tasks', 'beings', 'species', 'fae', 'goals', 'recipes', 'weather', 'gods', 'settle', 'main', 'door'];
```

In the header comment, change the sentence about `beings.js` and `START` to: "tasks.js declares TASKS before beings.js, species.js, and fae.js add their kinds to it, and beings.js declares START before species.js and fae.js add their actions to it."

`tasks.js` holds function declarations and one arrow function that runs only when called, so it reads nothing at load time. Check that with `node build.js && npm run fast && node tests/soak.js` before you go on. Expected: all pass, the golden unmoved.

In `CLAUDE.md`, under "Rules of the split", the load-order rule becomes: "Load-time order matters three times: `core.js` first, `clock.js` directly after it, and `tasks.js` before `beings.js`, `species.js`, and `fae.js`, which add kinds to `TASKS`. `beings.js` also comes before `species.js` and `fae.js`, which add actions to `START`."

- [ ] **Step 5: Write the table and the executor at the top of `tasks.js`**

Replace the first line of `src/sim/tasks.js` (`/* ---------- human work tasks ---------- */`) with:

```js
/* ---------- tasks as data: the table and the tick executor ---------- */
/* A task is a plain record: { kind, type, args, stop, path, label, ... }. It holds numbers and strings,
   never a function, and never a reference to a being, a tile, or an item. TASKS[kind] holds what the
   task does:
     type            the category that rules read (a.task.type). begin may return another.
     begin(a, args)  the checks and the search that start the task. It returns the record's other
                     fields, or false when the task cannot start, or true when it handed over to
                     another kind.
     stops           functions (a, t). The executor calls stops[t.stop] on each stride once the path
                     is walked. Each returns 'continue', 'done', or 'fail'.
     release(a, t)   what the task lets go of when it ends or fails.
     work, effect    declared by workKind for a job done at one place. */
const TASKS = {};

function setTask(a, kind, args, fields){
  a.task = { kind, type: TASKS[kind].type, args, stop: 0, path: [], ...fields };
  return true;
}
function startTask(a, kind, args = {}){
  const K = TASKS[kind]; if (!K) throw new Error(`No task kind '${kind}'.`);
  const own = { ...args }, f = K.begin(a, own); if (!f) return false;
  return f === true ? true : setTask(a, kind, own, f);
}
/* Run the current stop once. */
function taskStop(a){ const t = a.task; return t.arrive ? t.arrive(a, t) : TASKS[t.kind].stops[t.stop](a, t); }
/* Walk on toward a stop. Null when the being is within reach. Otherwise the stride's result:
   'continue' with a new path, or 'fail' when there is no way. */
function goTo(a, t, x, y, within, z = 0){
  if (nearAt(a, x, y, z) <= within) return null;
  const q = pathToStop(a, x, y, within, z); if (!q) return 'fail';
  t.path = q; return 'continue';
}
function letGo(a, t){ if (t.cleanup) t.cleanup(t); else if (t.kind && TASKS[t.kind].release) TASKS[t.kind].release(a, t); }
function endTask(a){ const t = a.task; if (!t) return; letGo(a, t); a.task = null; }
function failTask(a){ const t = a.task; if (!t) return; letGo(a, t); dropCarried(a); a.task = null; }

/* ---------- human work tasks ---------- */
```

Move `runTask` from `beings.js` to `tasks.js`, directly after `failTask`, and change one line in it: `const r = t.arrive(a, t);` becomes `const r = taskStop(a);`. Delete `endTask` and `failTask` from `beings.js`. Leave `checkSnare` and `checkPitfall` in `beings.js`.

`setTask` runs only when called, so it may name `TASKS[kind]` for a kind that a later file adds.

- [ ] **Step 6: Convert `rest`, `wander`, `flee`, and `sleep`**

In `beings.js`, after the `START` object, add the four kinds. Each `begin` is the old function's body with the same calls in the same order, and it returns the fields the old code put on the task.

```js
/* The base kinds. Each begin is what START did before it built the task. */
Object.assign(TASKS, {
  rest: { type: 'rest',
    begin(a){ return { label: a.species === 'rabbit' ? 'Resting in the grass' : 'Dozing', wait: CLOCK.task.doze }; },
    stops: [a => { a.needs.rest = Math.min(100, a.needs.rest + 40); return 'done'; }] },
  wander: { type: 'wander',
    begin(a){
      for (let k = 0; k < 6; k++){
        const tx = a.x + rint(11) - 5, ty = a.y + rint(11) - 5; if (!passable(tx, ty, a.z)) continue;
        const p = bfs(a.x, a.y, a.z, (x, y, z) => x === tx && y === ty && z === a.z, 250, a);
        if (p) return { label: a.species === 'human' ? 'Wandering' : 'Roaming', path: p };
      }
      return { label: 'Standing still', wait: CLOCK.task.standStill };
    },
    stops: [() => 'done'] },
  flee: { type: 'flee',
    begin(a){
      const threats = threatsFor(a); if (!threats.length) return false;
      let best = null;
      for (let k = 0; k < 14; k++){
        const tx = a.x + rint(13) - 6, ty = a.y + rint(13) - 6; if (!passable(tx, ty, a.z)) continue;
        const md = Math.min(...threats.map(([x, y]) => dist(tx, ty, x, y)));
        if (!best || md > best.md) best = { tx, ty, md };
      }
      if (!best) return false;
      const p = bfs(a.x, a.y, a.z, (x, y, z) => x === best.tx && y === best.ty && z === a.z, 250, a); if (!p) return false;
      return { label: a.species === 'human' ? 'Running from the fire' : 'Bolting', path: p, fast: true };
    },
    stops: [() => 'done'] },
  sleep: { type: 'sleep',
    begin(a){
      const place = a.species === 'human' && !a.homeless && sleepPlaces().filter(pl => beings.filter(b => b.alive && b.asleep && nearAt(b, ...pl) <= 1).length < 3).sort((p, q) => nearAt(a, ...p) - nearAt(a, ...q))[0];
      if (place && nearAt(a, ...place) > 1){
        const p = pathToStop(a, place[0], place[1], 1);
        if (p) return { label: 'Going to the lean-to', path: p };
      }
      a.asleep = true; a.task = null; a.status = 'Sleeping'; return true;
    },
    stops: [a => { a.asleep = true; a.task = null; return 'done'; }] },
});
```

Compare each `begin` with the old function before you delete the old one. Then delete `rest`, `wander`, `flee`, and `sleep` from `START`, and point their callers at the table: every `START.flee(x)` in `src/sim/` becomes `startTask(x, 'flee')`, every `START.wander(x)` becomes `startTask(x, 'wander')`, and every `START.rest(x)` becomes `startTask(x, 'rest')`. Find them with `grep -n "START\.\(flee\|wander\|rest\|sleep\)" src/sim/*.js`. `failTask(a); START.flee(a)` keeps its order.

The old `sleep` stop set `a.task = null` and then returned `'done'`; `endTask` then finds no task and does nothing. Keep that exactly.

In `chooseTask`, the line that starts an option becomes:

```js
    const ok = o.type === 'work' ? o.start(a) : o.type === 'join' ? startJoin(a) : o.type === 'deliver' ? startDeliver(a) : TASKS[o.type] ? startTask(a, o.type) : START[o.type](a);
```

`updateBeing` forces a need with `START[force](a)`, where `force` is `'drink'`, `'eat'`, or `'sit'`. Change that call to `(TASKS[force] ? startTask(a, force) : START[force](a))`, so task 2 needs no change there.

- [ ] **Step 7: Export the new names**

In the `API` string of `src/sim/index.js`, add `TASKS, startTask, setTask, taskStop, goTo,` and check that `pathToStop` replaced `legPath` there. Keep `START`, `runTask`, and `failTask` in the list.

- [ ] **Step 8: Fill the ratchet, and run the tests**

Run: `node --test tests/tasks.js`. The ratchet test fails and prints a count for each file. Write each count into `PENDING`, for example `beings: 30, tasks: 55`. Do not list a file whose count is zero. `door.js` holds the word "arrive" in a comment about events: reword that comment ("an event that comes with a tick of its own ... must come at that tick") so the file counts zero.

Run again. Expected: 8 tests pass.

`tests/dwellers.js` and `tests/gnomes.js` call `api.START.home` and others; those stay until task 3. If a test called `START.flee`, `START.rest`, `START.wander`, or `START.sleep`, change it to `api.startTask(x, 'flee')` and so on.

- [ ] **Step 9: Add the test to `npm run fast`, and run every gate**

In `package.json`, add `tests/tasks.js` to the end of the `fast` script.

```bash
node build.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 10: Commit**

```bash
git add src tests package.json CLAUDE.md dist/hearth-sim.html
git commit -m "Tasks as data, the first step: the TASKS table, startTask, an executor that runs records and closures side by side, and pathToStop"
```

---

### Task 2: The other base kinds

**Files:**
- Modify: `src/sim/beings.js`
- Modify: `tests/tasks.js` (`PENDING`, one new test)

**Interfaces:**
- Consumes: `TASKS`, `startTask`, `goTo`, `pathToStop` from task 1.
- Produces: the kinds `drink`, `eat`, `socialize`, `shelter`, `sit`. `START` in `beings.js` becomes an empty object that `species.js` and `fae.js` still add to.

- [ ] **Step 1: Write the failing test**

Add to `tests/tasks.js`, before the ratchet section:

```js
test('the base kinds of a person are in the table', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['drink', 'eat', 'socialize', 'shelter', 'sit', 'rest', 'wander', 'flee', 'sleep']) assert.ok(api.TASKS[k], k);
  const a = api.firstPerson(); api.failTask(a); a.needs.water = 5;
  assert.ok(api.startTask(a, 'drink')); assert.equal(a.task.kind, 'drink'); assert.equal(a.task.type, 'drink');
  assert.deepEqual(plain(a.task), []);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/tasks.js`
Expected: FAIL with "drink" as the message of the first failed `assert.ok`.

- [ ] **Step 3: Convert the five kinds**

Each kind follows the design section. The notes below name what each closure captured and where it goes.

| Kind | What the closure held | In the record |
|---|---|---|
| `drink` | Two shapes. At camp: `sx, sy` of the stash tile. At the water: the predicate `wet` and the function `walkFar`. | `args.at = [sx, sy]` for the camp shape, and no `at` for the water shape. `wet` and `walkFar` become functions of the kind (they read nothing from the closure but `a`). One stop function that branches on `t.args.at`. |
| `eat` | At camp: `sx, sy`. In the wild: the predicate `hasFood`, which is `bushy` for a rabbit that found a bush, the rabbit's grass rule otherwise, and the berry rule for the rest. | `args.at` for the camp shape. For the wild shape `args.food` is `'bush'` or `'graze'`, set by `begin` to say which predicate the search settled on; the stop rebuilds the predicate from it. |
| `socialize` | The being `target`. | `args.with = target.id`. The stop finds it with `beingById`. A person who is not found counts as not alive. |
| `shelter` | `hx, hy` of the lean-to. | `args.at = [hx, hy]`. The stop uses `goTo(a, t, hx, hy, 1)`. |
| `sit` | `px, py` of the pit. | `args.at = [px, py]`. The stop uses `goTo(a, t, px, py, 1)`. |

The camp shape of `drink` and `eat` reads `camp` at arrival, as today. `updateBeing` sets `camp = a.camp` before it runs the task, so `camp` is the same camp.

Keep every call in its order. In `drink`, the near search, then `walkFar`, then the `farwater` thought, then the task. In `eat`, the rabbit's bush search runs first and the general search runs only when it found nothing.

When the five are in the table, `START` in `beings.js` becomes `const START = {};` with the comment "Actions that are not kinds yet. species.js and fae.js add theirs until they are converted." `chooseTask` and `updateBeing` already prefer the table.

- [ ] **Step 4: Lower the ratchet, and run every gate**

Lower `beings` in `PENDING` to the count the ratchet prints.

```bash
node build.js
node --test tests/tasks.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 5: Commit**

```bash
git add src tests dist/hearth-sim.html
git commit -m "Tasks as data: drink, eat, socialize, shelter, and sit are kinds in the table"
```

---

### Task 3: The animals and the gnomes

**Files:**
- Modify: `src/sim/species.js`
- Modify: `tests/dwellers.js`, `tests/gnomes.js` (the `api.START` calls), `tests/tasks.js` (`PENDING`, one new test)

**Interfaces:**
- Consumes: `TASKS`, `startTask`, `setTask`, `goTo`, `chain`, `pathToStop`.
- Produces: the kinds `hunt`, `raid`, `stalk`, `herd`, `scavenge`, `home`, `carryHome`, `shrooms`, `huddle`, `borrow`, `repay`, and two shared kinds, `walk` and `walkTo`.

- [ ] **Step 1: Write the failing test**

Add to `tests/tasks.js`, before the ratchet section:

```js
test('the animals and the gnomes are in the table', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['hunt', 'raid', 'stalk', 'herd', 'scavenge', 'home', 'carryHome', 'shrooms', 'huddle', 'borrow', 'repay', 'walk', 'walkTo']) assert.ok(api.TASKS[k], k);
  assert.equal(Object.keys(api.START).filter(k => ['hunt', 'raid', 'stalk', 'herd', 'scavenge', 'home', 'carryHome', 'shrooms', 'huddle', 'borrow', 'repay'].includes(k)).length, 0);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/tasks.js`
Expected: FAIL with "hunt".

- [ ] **Step 3: Write the two shared kinds**

Several tasks only walk. Put these in `tasks.js`, after `failTask`:

```js
/* A walk with nothing to do at its end. The caller sets the type, the label, and the path. */
TASKS.walk = { type: 'travel', begin: () => false, stops: [() => 'done'] };
/* A walk to a place, taken up again if the being is pushed off it. args: at [x, y, z], within. */
TASKS.walkTo = { type: 'travel', begin: () => false,
  stops: [(a, t) => goTo(a, t, t.args.at[0], t.args.at[1], t.args.within, t.args.at[2] || 0) || 'done'] };
```

Both are set with `setTask`, because the caller has the path in hand: `setTask(a, 'walk', {}, { type: 'wander', label: 'Rejoining the herd', path: p })`.

- [ ] **Step 4: Convert the eleven kinds**

| Kind | What the closure held | In the record |
|---|---|---|
| `hunt` | The being `prey`. The far shape is a walk with `arrive: () => 'done'`. | Far shape: `setTask(a, 'walk', {}, { type: 'travel', label: 'Prowling toward the meadow', path: p })` and `begin` returns true. Near shape: `args.prey = prey.id`. |
| `raid` | The camp `c` and `sx, sy`. | `args.camp = camps.indexOf(c)`, `args.at = [sx, sy]`. The stop swaps `camp` for the raid and puts it back, as today. |
| `stalk` | The person `h`. | `args.who = h.id`. |
| `herd` | Nothing at arrival. | `setTask(a, 'walk', {}, { type: 'wander', label: 'Rejoining the herd', path: p })`. |
| `scavenge` | The item `found`. | `args.item = found.id`. |
| `home` | The tile `spot`. Three shapes: no floor (falls back to `rest`), already there (a rest with a wait), a walk. | No floor: `return startTask(a, 'rest')`. Already there: `setTask(a, 'rest', {}, { label: 'Resting in the den', wait: CLOCK.task.denRest })`, because its effect is the same as `rest`. The walk: `setTask(a, 'walkTo', { at: [spot.x, spot.y, spot.z], within: 0 }, { label: 'Going home to the den', path: p })`. |
| `carryHome` | The tile `spot`. It has a `cleanup`. | `args.at = [spot.x, spot.y, spot.z]`, and `release` drops what is carried. |
| `shrooms` | The tile `t`. | `args.at = [t.x, t.y]`. The stop uses `goTo(a, k, x, y, 1, 0)`. |
| `huddle` | The being `kin`. Two shapes. | Near: a kind of its own, `huddle`, with `args.kin = kin.id` and a wait. Far: `setTask(a, 'walk', {}, { type: 'socialize', label: 'Going to kin', path: p })`. |
| `borrow` | The cave `c`, the camp `k`, and `sx, sy`. | `args.camp = camps.indexOf(k)`, `args.at`. The cave is `a.den`, read again. |
| `repay` | The cave `c` and the camp `k`. | `args.camp`, `args.at`. The cave is `a.den`. |

`prey.alive` on a being that has left the list: `const prey = beingById(t.args.prey); if (!prey || !prey.alive || ...)`. Write the test so that the count of `++t.progress` stays the same: in the old code `!prey.alive ||` comes first and skips the increment. Keep that order.

`borrow` and `repay` read `a.den` where the closure held `c`. A gnome's den does not change during one errand. If you find a rule that can change `a.den` while a gnome walks, keep the cave in `args` as `caves.indexOf(c)` and say so in your report.

When every action of `species.js` is a kind, delete the `Object.assign(START, {...})` wrapper there. Change `START.carryHome(a)` to `startTask(a, 'carryHome')`.

- [ ] **Step 5: Change the tests that call `START`**

In `tests/dwellers.js` and `tests/gnomes.js`, `api.START.home(b)` becomes `api.startTask(b, 'home')`, and so on for `raid`, `shrooms`, `borrow`, and `repay`. Where a test calls `x.task.arrive(x, x.task)`, it becomes `api.taskStop(x)`. Leave `api.START.prank` and `api.START.watch`; task 4 converts them. Do not change what a test asserts.

- [ ] **Step 6: Lower the ratchet, and run every gate**

```bash
node build.js
node --test tests/tasks.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 7: Commit**

```bash
git add src tests dist/hearth-sim.html
git commit -m "Tasks as data: the animals and the gnomes are kinds in the table"
```

---

### Task 4: The sprites

**Files:**
- Modify: `src/sim/fae.js`
- Modify: `tests/dwellers.js` (the `api.START` calls), `tests/tasks.js` (`PENDING`, one new test)

**Interfaces:**
- Consumes: `TASKS`, `startTask`, `setTask`, `goTo`, `pathToStop`.
- Produces: the kinds `dance`, `forage`, `watch`, `collect`, `prank`, and `fightSprite`. `START` has no entries left.

- [ ] **Step 1: Write the failing test**

Add to `tests/tasks.js`, before the ratchet section:

```js
test('the sprites are in the table, and START is empty', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['dance', 'forage', 'watch', 'collect', 'prank', 'fightSprite']) assert.ok(api.TASKS[k], k);
  assert.deepEqual(Object.keys(api.START), []);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/tasks.js`
Expected: FAIL with "dance".

- [ ] **Step 3: Convert the six kinds**

Read every action in `fae.js` first. The table names what the pattern search found; the code governs.

| Kind | What the closure held | In the record |
|---|---|---|
| `dance` | The grove `g`. | Nothing. The stop reads `a.grove` again. If `a.grove` can be set to null while a sprite dances (a hollow pine that burns removes the grove from `groves`, but check whether it clears `a.grove`), guard as the old code would have behaved with the old object, and say what you found in your report. |
| `forage` | The predicate `hasFood`. | Nothing. The predicate is a function of the kind. |
| `watch` | The camp `c` and the reach `r`. | `args.camp = camps.indexOf(c)`, `args.within = r`. |
| `collect` | Read the code. | By the rules of the design section. |
| `prank` | The camp `c`. | `args.camp = camps.indexOf(c)`. The stop sets `camp = c`, as today. |
| `fightSprite` (`startFightSprite(a, sp)`) | The sprite `sp`. It has a `cleanup`. | `args.sprite = sp.id`, and `release` lets go of the spear. Keep a one-line wrapper `startFightSprite(a, sp)` for `goals.js`. |

When the actions are kinds, delete the `Object.assign(START, {...})` wrapper in `fae.js`.

- [ ] **Step 4: Change the tests that call `START`**

In `tests/dwellers.js`, `api.START.prank(sp)` becomes `api.startTask(sp, 'prank')`, `api.START.watch(sp)` becomes `api.startTask(sp, 'watch')`, and `sp.task.arrive(sp, sp.task)` becomes `api.taskStop(sp)`. Do not change what a test asserts.

- [ ] **Step 5: Lower the ratchet, and run every gate**

```bash
node build.js
node --test tests/tasks.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 6: Commit**

```bash
git add src tests dist/hearth-sim.html
git commit -m "Tasks as data: the sprites are kinds in the table, and START is empty"
```

---

### Task 5: Deliver, gathering, fishing, quarrying, tree cutting, the waterskin

**Files:**
- Modify: `src/sim/tasks.js`
- Modify: `tests/tasks.js` (`PENDING`, one new test)

**Interfaces:**
- Consumes: `TASKS`, `startTask`, `setTask`, `goTo`, `chain`, `walkTo`.
- Produces: the kinds `deliver`, `gather`, `pickBerries`, `pickFibre`, `fish`, `digClay`, `takeCuttings`, `quarry`, `cutTree`, `fillWater`. One-line wrappers keep the old function names alive for `goals.js` and `recipes.js` until task 8.

- [ ] **Step 1: Write the failing test**

Add to `tests/tasks.js`, before the ratchet section:

```js
test('gathering and its kin are in the table, and a gathered stick reaches the stash as plain data', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['deliver', 'gather', 'pickBerries', 'pickFibre', 'fish', 'digClay', 'takeCuttings', 'quarry', 'cutTree', 'fillWater']) assert.ok(api.TASKS[k], k);
  const a = api.firstPerson(); api.camp = a.camp; api.failTask(a);
  if (api.startTask(a, 'gather', { item: 'stick' })){
    assert.deepEqual(plain(a.task), []);
    for (let k = 0; k < 2000 && a.task; k++){ api.runTask(a); api.tick = api.tick + 1; if (a.task) assert.deepEqual(plain(a.task), []); }
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/tasks.js`
Expected: FAIL with "deliver".

- [ ] **Step 3: Convert the ten kinds**

| Kind | What the closure held | In the record |
|---|---|---|
| `deliver` | `sx, sy` and the carried thing `c`. | `args.at = [sx, sy]`. The stop reads `a.carrying` again; nothing else carries for the being while it walks. |
| `gather` | The item `it`, the `kind`. The travel shape holds `cx, cy`. | `args.item = kind`, `args.id = it.id`. The travel shape: `setTask(a, 'walkTo', { at: [cx, cy, 0], within: 6 }, { label, path: q })`, after the chronicle line, as today. `release` frees the reservation. |
| `pickBerries` | The predicate `hasFood`. The travel shape holds `cx, cy`. | Nothing; the travel shape is `walkTo`. |
| `pickFibre`, `digClay`, `takeCuttings`, `fillWater` | A predicate. | Nothing. |
| `fish` | The predicate `water`. | Nothing. |
| `quarry` | The tile `face`. | `args.face = [face.x, face.y, face.z]`. |
| `cutTree` | The tile `tree`. It has a `cleanup`. | `args.tree = [tree.x, tree.y, tree.z]`, and `release` frees the claim. |

`gather`'s stop failed when `!items.includes(it)`. With an id, the item is `items.find(i => i.id === t.args.id)`, and "not found" is that failure. The `release` of `gather` reads the item the same way and frees `reservedBy` only when it is found and reserved by this being.

`walkTo` ends with `'done'` where the old travel task did, and it takes the walk up again the same way.

The chains stay: `return chain(a, t, startTask(a, 'deliver')) || 'done';`.

Keep these wrappers, each one line, for the callers in `goals.js`, `recipes.js`, and the tests: `startDeliver(a)`, `startGather(a, kind)`, `startPickBerries(a)`, `startPickFibre(a)`, `startFish(a)`, `startDigClay(a)`, `startTakeCuttings(a)`, `startQuarry(a)`, `startCutTree(a)`, `startFillWater(a)`. `chooseTask` calls `startDeliver(a)`; leave that call.

- [ ] **Step 4: Lower the ratchet, and run every gate**

```bash
node build.js
node --test tests/tasks.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 5: Commit**

```bash
git add src tests dist/hearth-sim.html
git commit -m "Tasks as data: deliver, the gathering family, fishing, quarrying, tree cutting, and the waterskin"
```

---

### Task 6: `workKind`, the snare and pit jobs, the ember, joining, and the founding party

**Files:**
- Modify: `src/sim/tasks.js`, `src/sim/camps.js`
- Modify: `tests/crafts.js` (the `startBuild` test), `tests/tasks.js` (`PENDING`, new tests)

**Interfaces:**
- Consumes: `TASKS`, `startTask`, `goTo`, `pathToStop`.
- Produces: `workKind({ label, amount, skill, effect, type })`, the kinds `setSnare`, `checkSnare`, `haulPit`, `fetchEmber`, `join`, and `build`, a kind that keeps today's `startBuild` alive for `goals.js` and `recipes.js` until task 8.

- [ ] **Step 1: Write the failing tests**

Add to `tests/tasks.js`, before the ratchet section:

```js
test('workKind declares the work and the effect, and runs them through the table', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.camp = a.camp; api.failTask(a);
  let landed = null;
  api.TASKS.testJob = api.workKind({ label: 'Testing the bench', amount: 5, skill: 'craft', effect: (b, args) => { landed = args.note; } });
  assert.deepEqual(api.TASKS.testJob.work, { amount: 5, skill: 'craft' });
  assert.equal(typeof api.TASKS.testJob.effect, 'function');
  assert.ok(api.startTask(a, 'testJob', { at: [a.x, a.y], note: 'done' }));
  assert.equal(a.task.type, 'work'); assert.deepEqual(plain(a.task), []);
  for (let k = 0; k < 50 && a.task; k++) api.runTask(a);
  assert.equal(landed, 'done'); assert.equal(a.task, null);
});

test('a skilled worker ends a job in fewer strides', () => {
  const api = load(); api.startWorld('r');
  api.TASKS.testJob = api.workKind({ label: 'Twisting cord', amount: 30, skill: 'craft', effect: () => {} });
  const runs = lvl => { const a = api.firstPerson(); api.camp = a.camp; api.failTask(a); a.skills.craft = lvl; api.startTask(a, 'testJob', { at: [a.x, a.y] }); let n = 0; for (; n < 200 && a.task; n++) api.runTask(a); return n; };
  assert.ok(runs(4) < runs(0));
});

test('the snare jobs, the ember, and joining are in the table', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['setSnare', 'checkSnare', 'haulPit', 'fetchEmber', 'join', 'build']) assert.ok(api.TASKS[k], k);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/tasks.js`
Expected: FAIL with "api.workKind is not a function".

- [ ] **Step 3: Write `workKind`**

In `tasks.js`, replace `startBuild` with:

```js
/* The skill a job's label implies, when the job names none. */
const skillOfLabel = label => /cook|smok|butcher/i.test(label) ? 'cook' : /knap|sew|spear/i.test(label) ? 'craft' : /snare/i.test(label) ? 'trap' : 'build';
/* A job done at one place: walk to args.at, work until the progress reaches the amount, and then the
   effect lands. label, amount, and skill are values, or functions of args for a job whose record says
   them. The kind declares work and effect, so another executor can do the same job without the strides. */
function workKind({ label, amount, skill, effect, type = 'work' }){
  const of = (v, args) => typeof v === 'function' ? v(args) : v;
  return { type, work: { amount, skill }, effect,
    begin(a, args){
      const p = pathToStop(a, args.at[0], args.at[1], 1); if (!p) return false;
      return { label: `Walking to ${of(label, args).toLowerCase().replace(/^\w+ing /, '')}`, path: p, progress: 0, target: args.at, within: 1 };
    },
    stops: [(a, t) => {
      const at = t.args.at, r = goTo(a, t, at[0], at[1], 1); if (r) return r;
      const l = of(label, t.args), n = of(amount, t.args);
      t.progress += workSpeed(a, of(skill, t.args) || skillOfLabel(l)); t.label = `${l} (${Math.min(99, Math.floor(t.progress / n * 100))}%)`;
      if (t.progress < n) return 'continue';
      effect(a, t.args, t); return 'done';
    }] };
}
```

Compare it with the old `startBuild` line by line: the same path call, the same label texts, the same order of `workSpeed`, label, and threshold.

- [ ] **Step 4: Keep `startBuild` alive until task 8**

`goals.js` and `recipes.js` still call `startBuild(a, at, work, label, done, skill)` with a closure `done`. A record cannot hold that closure. Until task 8 converts those callers, `startBuild` stays a closure task, written in terms of the same stop:

```js
/* The old door to a build, for offers that are not data yet. Task 8 of plan G2 removes it. */
function startBuild(a, at, work, label, done, skill){
  const p = pathToStop(a, at[0], at[1], 1); if (!p) return false;
  const k = workKind({ label, amount: work, skill, effect: b => done(b) });
  a.task = { type: 'work', label: `Walking to ${label.toLowerCase().replace(/^\w+ing /, '')}`, path: p, progress: 0, target: at, within: 1, args: { at },
    arrive: (b, t) => k.stops[0](b, t) };
  return true;
}
```

This keeps one copy of the work loop. The record still holds `arrive`, so the ratchet still counts it. The test above names a kind `build`; do not add it. Delete `'build'` from that test's list instead, and say so in your report. `tests/crafts.js` has a test of `startBuild` and skill; leave it as it is until task 8.

- [ ] **Step 5: Convert the five kinds**

| Kind | What the closure held | In the record |
|---|---|---|
| `setSnare` | The spot `best`. The site search with its `rng()` runs in `begin`, before the path, as today. | `workKind` with `begin` wrapped: the kind's own `begin` finds `best`, writes `args.at = [best.x, best.y]`, and then calls the `workKind` `begin`. Effect: the old `done`, with `best.x, best.y` read from `args.at`. |
| `checkSnare` | The snare `s`. | `args.at = [s.x, s.y]`. Effect: `const st = tileAt(...args.at).struct, s = st && st.type === 'snare' ? st.snare : null; if (s && s.catch){ ... }`. A snare can burn while the person walks; then the old code still emptied the old object. Say in your report that this case now does nothing, and let the golden decide. |
| `haulPit` | The pit `p`. | `args.at = [p.x, p.y]`. Effect: the pit is `tileAt(...).struct.pit` when the struct is a pitfall. |
| `fetchEmber` | Nothing but `a`. Two phases in one `arrive`, told apart by `a.carrying`. | One stop, as today. `type: 'ember'`. |
| `join` (`startJoin`, in `camps.js`) | The camp `c`, `cx, cy`, `within`. | `args.at = [cx, cy]`, `args.within`, `args.found = !c.site` to choose the line. The camp is `a.camp`, read again. Keep the one-line `startJoin(a)` wrapper, because `chooseTask` and the founding party call it. |

For a kind that wraps `workKind`:

```js
TASKS.setSnare = (() => { const k = workKind({ label: 'Setting a snare', amount: CLOCK.work.setSnare, effect(a, args){ /* the old done */ } });
  return { ...k, begin(a, args){ /* the old site search */ if (!best) return false; args.at = [best.x, best.y]; return k.begin(a, args); } }; })();
```

Keep the wrappers `startSetSnare(a)`, `startCheckSnare(a, s)`, `startHaulPit(a, p)`, and `startFetchEmber(a)` for `goals.js`.

- [ ] **Step 6: Lower the ratchet, and run every gate**

```bash
node build.js
node --test tests/tasks.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 7: Commit**

```bash
git add src tests dist/hearth-sim.html
git commit -m "Tasks as data: workKind declares a job's work and effect, and the snare, pit, ember, and joining tasks go through the table"
```

---

### Task 7: The chases and the brand

**Files:**
- Modify: `src/sim/tasks.js`
- Modify: `tests/closing.js` (the calls to `withBrand` and `startClearDen`), `tests/tasks.js` (`PENDING`, one new test)

**Interfaces:**
- Consumes: `TASKS`, `startTask`, `setTask`, `goTo`, `chain`, `walkTo`.
- Produces: the kinds `huntDeer`, `driveOff`, `brand`, `searchCave`, `clearRock`, `clearDen`, `followBrand`, `comeHome`.

- [ ] **Step 1: Write the failing test**

Add to `tests/tasks.js`, before the ratchet section:

```js
test('the chases and the brand are in the table', () => {
  const api = load(); api.startWorld('r');
  for (const k of ['huntDeer', 'driveOff', 'brand', 'searchCave', 'clearRock', 'clearDen', 'followBrand', 'comeHome']) assert.ok(api.TASKS[k], k);
});

test('a brand task with no next step ends with no live ember', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.camp = a.camp;
  if (!a.camp.pit) return;
  api.failTask(a);
  api.TASKS.never = { type: 'work', begin: () => false, stops: [() => 'done'] };
  assert.ok(api.startTask(a, 'brand', { label: 'Testing', next: { kind: 'never', args: {} } }));
  assert.deepEqual(plain(a.task), []);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/tasks.js`
Expected: FAIL with "huntDeer".

- [ ] **Step 3: Convert the kinds**

| Kind | What the closure held | In the record |
|---|---|---|
| `huntDeer` | The deer `d`. `a.carrying` is set before the task, as today. | `args.deer = d.id`. `release` lets go of the spear. `!d.alive ||` comes before `++t.progress`; keep it: `!d || !d.alive || ++t.progress > ...`. |
| `driveOff` | The wolf `w`, `px, py`. | `args.wolf = w.id`, `args.at = [px, py]`. `release` lets go of the ember. |
| `brand` (`withBrand(a, label, then)`) | The label and the closure `then`. | `args.label`, and `args.next = { kind, args }`. At the pit the stop takes the ember and runs `chain(a, t, startTask(a, next.kind, next.args))`. `release` lets go of the ember. |
| `searchCave` | The cave `c` and its deep tile `d`. Two phases: `t.arrive = ...` on the way home. | `args.cave = caves.indexOf(c)`. Two stops: stop 0 is the search, stop 1 is the walk home, and the first sets `t.stop = 1`. The claim `c.claimed = a.id` and the chronicle line happen in `begin`, in today's order. `release` frees the claim and the ember. The record today holds `cave: c`; find who reads `task.cave` with `grep -n "task\.cave\|\.cave\b" src/sim/*.js src/ui/*.js` and point each reader at `caves[task.args.cave]`. |
| `clearRock` | The cave `c`, the rock `b`, the tile `spot`. Two phases; the second is `() => 'done'`. | `args.cave`, `args.spot = [x, y, z]`. Two stops. `c.blocked` is read again from the cave. |
| `clearDen` | The cave `c`, its mouth `m`, the person `mate`. Two phases. | `args.cave`, `args.mate = mate.id`. Two stops. |
| `followBrand` | The mate's task on the way out: `arrive: () => 'continue'`. | `setTask(mate, 'followBrand', {}, { type: 'guard', label: 'Following with a brand', path: mp })`. `release` lets go of the ember. |
| `comeHome` | The walk back to the stash for the mate and for the leader, which puts the ember out at the end. | `setTask(x, 'comeHome', { at: [sx, sy] }, { type: 'travel', label: 'Coming back from the den', path })`. `release` lets go of the ember. The leader's second stop does the same walk; write the walk once and use it in both. |

`startClearDen` checks for a mate before it goes for the brand. That check stays where it is, in the `clearDen` wrapper's path: `startClearDen(a, c)` finds the mate, returns false without one, and then starts `brand` with `next: { kind: 'clearDen', args: { cave, mate } }`. `clearDen`'s `begin` is the old `then`: the path to the mouth, `failTask(mate)`, the mate's path, the mate's ember, the mate's task.

The wolf that cannot flee gets `w.task = { type: 'wander', label: 'Slinking off', path: sp, arrive: () => 'done' }`. It becomes `setTask(w, 'walk', {}, { type: 'wander', label: 'Slinking off', path: sp })`.

Keep the wrappers `startHuntDeer(a, d)`, `startDriveOff(a, w)`, `withBrand(a, label, next)`, `startSearchCave(a, c)`, `startClearRock(a, c)`, and `startClearDen(a, c)` for `goals.js`. `withBrand`'s third argument changes from a function to `{ kind, args }`.

- [ ] **Step 4: Change the tests**

`tests/closing.js` calls `api.withBrand(a, 'Testing', () => false)`. It becomes a brand whose next kind cannot start: register `api.TASKS.never = { type: 'work', begin: () => false, stops: [() => 'done'] }` in the test and call `api.withBrand(a, 'Testing', { kind: 'never', args: {} })`. Keep every assertion.

- [ ] **Step 5: Lower the ratchet, and run every gate**

```bash
node build.js
node --test tests/tasks.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 6: Commit**

```bash
git add src tests dist/hearth-sim.html
git commit -m "Tasks as data: the deer hunt, the guard, the brand, the cave search, the rockfall, and the den go through the table"
```

---

### Task 8: Offers as data

**Files:**
- Modify: `src/sim/goals.js`, `src/sim/recipes.js`, `src/sim/beings.js` (`chooseTask`), `src/sim/tasks.js` (the wrappers and `startBuild` go)
- Modify: `tests/closing.js`, `tests/crafts.js` (the `.start(` calls and the `startBuild` test), `tests/tasks.js` (`PENDING`, new tests)

**Interfaces:**
- Consumes: every kind of tasks 1 to 7, `workKind`.
- Produces: an offer is `{ label, score, task: { kind, args } }`. `chooseTask` starts it with `startTask(a, o.task.kind, o.task.args)`. A kind for every job that `goals.js` built with `startBuild`. The kind `craft` for recipes.

- [ ] **Step 1: Write the failing tests**

Add to `tests/tasks.js`, before the ratchet section:

```js
test('every offer is data', () => {
  const api = load(); api.startWorld('r');
  const seen = new Set();
  for (let k = 0; k < 9000; k++){
    api.step();
    if (k % 50) continue;
    for (const h of api.humans()){ api.camp = h.camp; if (!h.camp) continue;
      for (const o of api.offersFor(h)){ seen.add(o.task && o.task.kind); assert.deepEqual(plain(o, 'offer'), [], o.label); assert.ok(api.TASKS[o.task.kind], o.label); } }
  }
  assert.ok(seen.size > 3);
});

test('what a being last chose is plain data', () => {
  const api = load(); api.startWorld('r');
  for (let k = 0; k < 3000; k++) api.step();
  for (const b of api.beings) if (b.alive && b.lastChoice) assert.deepEqual(plain(b.lastChoice, 'lastChoice'), []);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/tasks.js`
Expected: FAIL. The first reports "offer.start holds a function".

- [ ] **Step 3: Turn each `startBuild` in `goals.js` into a kind**

For each `start: a => startBuild(a, <at>, <work>, <label>, <done>)` in `goals.js`:

1. Add a kind beside the goal, in `goals.js`, with `workKind`. The `effect` is the old `done`, with `(a, args)` as its arguments.
2. What `done` captured from the offer goes into `args`: the site as `at`, a snare as `at`, a count as a number. What it read from `this` (`this.need`) is read from the goal: `GOALS.find(g => g.id === 'firepit').need`, or a constant above the kind.
3. The offer becomes `{ label, score, task: { kind: 'buildFirepit', args: { at: camp.site } } }`.

```js
TASKS.buildFirepit = workKind({ label: 'Building the fire pit', amount: CLOCK.work.firepit, effect(a, args){ /* the old done, word for word */ } });
```

A site function such as `shelterSite()` or `openSpotNear(...)` draws from `rng()`. It runs when the offer is built, as today, and its result goes into `args.at`. Do not move it into `begin`.

Name each kind for its job: `buildFirepit`, `feedFire`, `strikeSparks`, `lightWithMoss`, `layFire`, `butcherDeer`, `cookFish`, `cookCatch`, `rearmSnare`, `knapAxe`, `testRocks`, `buildLeanTo`, `raiseStorehouse`, `buildHut`, `setOfferingStone`, `leaveBerries`, `setWardPosts`, `sewWaterskin`, `makeSpear`, `buildRack`, `smokeMeat`, `smokeFish`. If a site does not fit a name, choose a better one and say so in your report.

The other offers name a kind that exists: `start: a => startGather(a, 'stick')` becomes `task: { kind: 'gather', args: { item: 'stick' } }`; `startSetSnare` becomes `{ kind: 'setSnare', args: {} }`; `startCheckSnare(a, s)` becomes `{ kind: 'checkSnare', args: { at: [s.x, s.y] } }`; `startHuntDeer(a, d)` becomes `{ kind: 'huntDeer', args: { deer: d.id } }`; and so on for the guard, the sprite fight, the cave search, the rockfall, the den, the ember, and the founding party.

An offer whose start did work before the task (`startHuntDeer` sets `a.carrying` first) keeps that work in the kind's `begin`.

The founding party (`lead a party`) calls a function in `camps.js` that founds the new camp and then joins it. It becomes a kind, `leadParty`, whose `begin` is that function's body and ends with `return startTask(leader, 'join')`.

- [ ] **Step 4: Recipes**

In `recipes.js`:

- `GATHERERS` becomes data: `{ stick: { kind: 'gather', args: { item: 'stick' } }, log: { kind: 'cutTree', args: {} }, fibre: { kind: 'pickFibre', args: {} }, ... }`.
- A recipe's `gather: a => startDigClay(a)` becomes `gather: { kind: 'digClay', args: {} }`.
- The recipe's build becomes one kind, `craft`, made with `workKind` whose `label`, `amount`, and `skill` are functions of `args`: `args.recipe` is the recipe's id, `args.at` is the place, and `args.amount` is `r.work / speed`, computed when the offer is built, as today. The effect is the old `done` for recipes; it finds the recipe with `RECIPES.find(r => r.id === args.recipe)`.
- Each offer carries `task`, not `start`. An offer takes a copy of the `GATHERERS` entry (`{ ...g, args: { ...g.args } }`), so two offers do not share one `args`.

- [ ] **Step 5: `chooseTask`, the wrappers, and `startBuild`**

In `chooseTask`, a work option is `{ type: 'work', label: o.label, goal: o.goal, task: o.task, score: ... }`, and it starts with `startTask(a, o.task.kind, o.task.args)`. `join` starts with `startTask(a, 'join')`, and `deliver` with `startTask(a, 'deliver')`. The `START` fallback goes: `TASKS[o.type]` is always there now.

Delete `startBuild` and every `startX` wrapper that has no caller left. Find callers with `grep -n "startBuild\|startGather\|startDeliver\|..." src tests`. A wrapper that a test still calls goes too, and the test calls `startTask`.

- [ ] **Step 6: Change the tests**

In `tests/closing.js` and `tests/crafts.js`, `o.start(a)` becomes `api.startTask(a, o.task.kind, o.task.args)`. The `startBuild` skill test in `tests/crafts.js` is now covered by "a skilled worker ends a job in fewer strides" in `tests/tasks.js`; change it to use `workKind` the same way rather than delete it. `api.startGather(a, 'stick')` becomes `api.startTask(a, 'gather', { item: 'stick' })`. Keep every assertion.

- [ ] **Step 7: Lower the ratchet, and run every gate**

```bash
node build.js
node --test tests/tasks.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved. `goals` and `recipes` leave `PENDING`.

- [ ] **Step 8: Commit**

```bash
git add src tests dist/hearth-sim.html
git commit -m "Tasks as data: a goal and a recipe offer a record, every build is a kind with its work and effect declared, and startBuild is gone"
```

---

### Task 9: The close

**Files:**
- Modify: `src/sim/tasks.js`, `src/sim/beings.js`, `src/sim/index.js`
- Modify: `tests/tasks.js`, and any test that names `START`
- Modify: `design/notes.md`, `design/specs/2026-09-18-time-and-tiers-design.md`, `design/settings.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: one executor mode, no `START`, and the record that plan G3 (snapshots) starts from.

- [ ] **Step 1: One mode**

In `tasks.js`: `taskStop` becomes `const t = a.task; return TASKS[t.kind].stops[t.stop](a, t);`, and `letGo` becomes `const K = TASKS[t.kind]; if (K.release) K.release(a, t);`. In `beings.js`, delete `const START = {};` and any use left. In `index.js`, remove `START` from `API` and fix the header comment: the sentence about `START` goes. In `CLAUDE.md`, the load-order rule loses its `START` sentence.

Run `grep -n "\barrive\b\|\bcleanup\b\|\bstart: \|\bSTART\b" src/sim/*.js`. It must print nothing.

- [ ] **Step 2: Replace the ratchet with the final tests**

In `tests/tasks.js`, delete `PENDING`, and the ratchet test becomes:

```js
test('no file holds a closure task', () => {
  const held = FILES.filter(f => OLD.test(fs.readFileSync(path.join(SIM, f + '.js'), 'utf8')) || (OLD.lastIndex = 0));
  assert.deepEqual(held, []);
});
```

`OLD` is a global regular expression, so reset `lastIndex` between files, or build a fresh one for each file. Write it so that the test fails when you put the word `cleanup` into a sim file, and check that once by hand.

The plain-data test loses its `b.task.kind` filter and gains two checks: every task has a `kind` that is in `TASKS`, and the record without its path is small.

```js
test('every task in a run is a small plain record of a known kind', () => {
  for (const seed of ['r', 'x']){
    const api = load(); api.startWorld(seed);
    const bad = new Set();
    for (let k = 0; k < 12000; k++){
      api.step();
      for (const b of api.beings) if (b.alive && b.task){
        const t = b.task;
        if (!api.TASKS[t.kind]) bad.add(`no kind: ${t.kind} (${t.label})`);
        for (const s of plain(t)) bad.add(`${t.kind}: ${s}`);
        const { path: _p, ...rest } = t; if (JSON.stringify(rest).length > 600) bad.add(`${t.kind}: the record is ${JSON.stringify(rest).length} characters`);
      }
    }
    assert.deepEqual([...bad], [], seed);
  }
});

test('a task survives a trip through JSON', () => {
  const api = load(); api.startWorld('r');
  for (let k = 0; k < 4000; k++) api.step();
  for (const b of api.beings) if (b.alive && b.task) assert.deepEqual(JSON.parse(JSON.stringify(b.task)), b.task);
});

test('every kind has a type, a begin, and stops, and a job declares its work and effect', () => {
  const api = load();
  for (const [k, K] of Object.entries(api.TASKS)){
    assert.equal(typeof K.type, 'string', k); assert.equal(typeof K.begin, 'function', k); assert.ok(Array.isArray(K.stops) && K.stops.length > 0, k);
    if (K.work){ assert.equal(typeof K.effect, 'function', k); assert.ok('amount' in K.work && 'skill' in K.work, k); }
  }
});
```

If a record is over 600 characters without its path, read it. A long `args` is a sign that a reference slipped in. A long `label` is not; raise the bound only for a reason you can state.

- [ ] **Step 3: Measure the soak**

Run the soak on the head and on the commit before this plan (`git archive <base> | tar -x -C <scratch dir>`), one after the other, twice each. Report the four times. Other sessions share the machine, so compare runs that are next to each other. If the head is more than 10 percent slower on both pairs, look at `beingById` inside the chases first.

- [ ] **Step 4: Write the record**

In `design/notes.md`, add a section before "Next", with the next number, titled "Tasks as data". Say, in plain sentences:

- A task is a plain record, and `TASKS[kind]` in `src/sim/tasks.js` holds what it does: `type`, `begin`, `stops`, `release`, and for a job done at one place `work` and `effect`. Give the record's fields.
- `kind` is the key into the table. `type` is the category that rules read, and it kept its old values.
- What a closure held is in `args` as an id, an index, or coordinates, and is found again when needed. "Not found" counts as "not alive" or "gone".
- The helpers: `startTask`, `setTask`, `goTo`, `taskStop`, `chain`, `workKind`, and `pathToStop`, which was `legPath`.
- An offer is `{ label, score, task: { kind, args } }`. A site that draws from `rng()` is still chosen when the offer is built.
- `tasks.js` loads before `beings.js`, because the later files add kinds to `TASKS` as they load.
- Which kinds are jobs with declared work (the day tier can do them without the strides) and which are stride by stride (the chases, the loops of gathering). Plan G5 must give each of the second group a day-tier answer.
- Every case, from the task reports, where a lookup can now come back empty and the old reference could not.
- The soak fingerprint did not move through the whole plan.

In `design/specs/2026-09-18-time-and-tiers-design.md`, add a paragraph at the end of section 2 that begins "**As built (G2).**" It records: the table's entries are `type`, `begin`, `stops`, `release`, `work`, and `effect`. `begin` and `stops` are the spec's `stops(a, args)`, split into the search and the behaviour at each stop. `release` is the spec's `fail`, and it also runs when a task ends well, as `cleanup` did. `check` is inside each stop function. Only a job done at one place declares `work` and `effect` apart from its stops; the chases and the gathering loops are stride by stride, and plan G5 decides how the day tier answers them. The record keeps `type` beside `kind`.

In `design/settings.md`, the "Save and load" row: change its note from "Needs tasks as data." to "Tasks are data since plan G2. Plan G3 builds it."

In `CLAUDE.md`, in the Layout list: the `tasks` file is "tasks (the TASKS table, the tick executor, and human work)". Add `tests/tasks.js`: "the table, the executor, that every task and offer is plain data, and that no file holds a closure task. Fast." Under "Rules of work", add: "A task is a plain record. Its behaviour goes in `TASKS` in `src/sim/tasks.js`. Name a thing by id or by coordinates, never by reference."

- [ ] **Step 5: Run every gate**

```bash
node build.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 6: Commit**

```bash
git add src tests design CLAUDE.md dist/hearth-sim.html
git commit -m "Tasks as data, the close: one executor, no START, every task and offer is a plain record, and the notes say what the day tier must answer"
```
