# Become, plan E1: the lock and the choice

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player take one god's turn in the creation ages, through the door, with the engine locked while the turn is open.

**Architecture:** The simulation only. `ageStep` is split so it can suspend in the middle of an age and resume. Four acts join `src/sim/door.js`: `become`, `choose`, `run`, `watch`. The choice matrix is `godOptions(g)`, which already exists; nothing new scores anything. Autopilot calls the engine's own chooser, so a creation run on autopilot draws the same numbers in the same order as an unwatched one, and that equality is the gate for every task.

**Tech Stack:** Plain scripts in one shared scope, joined by `src/sim/index.js`. No modules, no `import`, no `export`. Tests are `node:test` with `node:assert/strict`.

**Spec:** `design/specs/2026-09-18-become-a-god-design.md`. Read sections 1 to 5 before starting.

## Global Constraints

- Files in `src/sim/` are **not** ES modules. They share one scope. Do not add `import` or `export`.
- `core.js` loads first. `beings.js` loads before `species.js` and `fae.js`.
- Do not reorder the per-tick steps in `updateWorld()`. The order fixes the random number stream.
- A duration or a rate goes in `CLOCK` in `src/sim/clock.js`. `tests/clock.js` fails on a bare time literal in a rule. This plan adds no durations, so nothing here touches `CLOCK`.
- Rules read data tables. Rules do not check names.
- Every new behaviour must be visible to the player: a chronicle line, a thought, a goal state, or a tooltip row.
- Every act from outside the engine enters by `inject()` in `src/sim/door.js` and is logged, applied or not.
- Write the game's text in plain English. One idea per sentence.
- Run `node build.js` after every change to `src/`.
- **The gate, every task:** `npm run fast` passes, and `npm run soak` passes including `the run matches the golden record` (about ninety seconds). `npm run soak:quick` is not a gate: it runs ten days against seventy-day assertions and checks no golden record. Any task that moves the golden record has a bug, except where the task says otherwise (only Task 2 may add to state that the fingerprint does not read).
- Anything exposed to tests goes in the `API` string in `src/sim/index.js`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/sim/core.js` | Modify | `DEFAULT_OPTIONS` gains `force`. |
| `src/sim/gods.js` | Modify | The age position, `pending`, `inhabited`, the stops, the bars, and the split of `ageStep`. |
| `src/sim/door.js` | Modify | The four acts and the age in the stamp. |
| `src/sim/main.js` | Modify | `step()` refuses while a turn is open. |
| `src/sim/index.js` | Modify | The new names in `API`. |
| `tests/become.js` | Create | Everything this plan builds: the lock, the acts, the bars, autopilot, the stops. |
| `tests/ages.js` | Modify | The equality gate over twenty-four seeds. |
| `package.json` | Modify | `tests/become.js` joins `npm run fast`. |
| `design/settings.md` | Modify | Two lines: Force Actions, and the inhabit modes moving from idea to built. |

---

### Task 1: The age in the door's stamp

The door stamps every event with the tick it was applied at, and refuses an event that arrives at the wrong tick. In the gods era the tick does not advance — an age is the step — so every act of every age would carry the same stamp and a replay could not tell them apart. `design/settings.md` predicted this under "God-era events at the door".

**Files:**
- Modify: `src/sim/door.js:49-55`
- Create: `tests/become.js`
- Modify: `package.json:15`

**Interfaces:**
- Produces: `inject(event)` stamps `{ tick, age }` in the gods era and `{ tick }` in the days era. An event carrying an `age` that is not the live age is refused with `'Not now.'`.

- [ ] **Step 1: Write the failing test**

Create `tests/become.js`:

```js
// Become: the turn lock, the four acts, the bars, autopilot, and the stops. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

/* A creation stopped at the age where the first god is awake and has a free choice. */
function atFirstTurn(seed = 'gamma'){
  const api = load(); api.startCreation(seed, {});
  api.step();
  return api;
}

test('the door stamps the age in the gods era and refuses an act from another age', () => {
  const api = atFirstTurn();
  const g = api.awakeGods()[0];
  assert.equal(api.inject({ source: 'player', act: 'become', id: g.id }), `You are ${g.name}, ${g.epithet}.`);
  assert.deepEqual(api.doorLog, [{ tick: api.tick, age: api.age, source: 'player', act: 'become', id: g.id }]);
  assert.equal(api.inject({ source: 'player', act: 'become', id: g.id, age: api.age + 5 }), 'Not now.');
  assert.equal(api.doorLog.length, 1, 'a refused act at the wrong age is not logged');
});

test('the days era stamps the tick alone, as it always did', () => {
  const api = load(); api.startWorld('r');
  api.inject({ source: 'player', act: 'poke', id: api.firstPerson().id });
  assert.deepEqual(Object.keys(api.doorLog[0]).sort(), ['act', 'id', 'source', 'tick']);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/become.js`
Expected: FAIL. The `become` act does not exist, so `inject` returns `'Nothing answers.'`.

- [ ] **Step 3: Stamp the age**

In `src/sim/door.js`, replace `inject`:

```js
function inject(event){
  const act = DOOR_ACTS[event.act];
  if (!act || !DOOR_SOURCES.includes(event.source)) return 'Nothing answers.';
  if (event.tick !== undefined && event.tick !== tick) return 'Not now.';
  /* In the gods era an age is the step and the tick stands still, so the age is the stamp that
     tells one act from another. In the days era nothing changes: the tick is the stamp. */
  if (era === 'gods' && event.age !== undefined && event.age !== age) return 'Not now.';
  doorLog.push(era === 'gods' ? { ...event, tick, age } : { ...event, tick });
  return act(event);
}
```

- [ ] **Step 4: Add a stub `become` so the test can reach the stamp**

In `src/sim/door.js`, inside `DOOR_ACTS`, after `site`:

```js
  /* Become: the player is the mob. The other three inhabit modes are named in the spec and refused
     until each is built. Task 3 gives this act its turn lock; here it only names who you are. */
  become(e){
    const g = beingById(e.id);
    if (!g || !g.alive || g.species !== 'god') return 'Only a god can be taken, and only while it lives.';
    return `You are ${g.name}, ${g.epithet}.`;
  },
```

- [ ] **Step 5: Add the test file to `npm run fast`**

In `package.json`, in the `fast` script, insert `tests/become.js` after `tests/gods.js`:

```json
    "fast": "node --test tests/field.js tests/gods.js tests/become.js tests/ages.js tests/settle.js tests/options.js tests/door.js tests/terrain.js tests/crafts.js tests/gnomes.js tests/dwellers.js tests/closing.js tests/wanderer.js tests/ui.js tests/clock.js"
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/become.js && npm run fast`
Expected: PASS, every file.

- [ ] **Step 7: The fingerprint has not moved**

Run: `npm run soak`
Expected: PASS, including `the run matches the golden record`. It takes about ninety seconds. Do not use `npm run soak:quick`: it runs ten days against assertions written for seventy, so it fails on camp growth whatever you changed, and it does not check the golden record.

- [ ] **Step 8: Build and commit**

```bash
node build.js
git add src/sim/door.js tests/become.js package.json dist/hearth-sim.html
git commit -m "Become E1.1: the age joins the door's stamp in the gods era

An age is the step in the gods era and the tick stands still, so every act of
every age carried the same stamp and a replay could not tell them apart. The
door now stamps the age there, refuses an act that names another age, and
leaves the days era exactly as it was.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

### Task 2: Keep every god's choice, age by age

`decideGod` builds `g.lastChoice` — every option with its score, which was picked, and which failed to apply — and the next age overwrites it. The timeline needs the history. This task keeps it. It draws no random number, so the fingerprint cannot move.

**Files:**
- Modify: `src/sim/gods.js:366-376` (`decideGod`), `src/sim/gods.js:508-513` (`beginCreation`)
- Modify: `src/sim/index.js` (the `API` string)
- Modify: `tests/become.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `creation.choices`, an array, appended once for each god that decided in each age, never cleared. Entry shape:
  - A free choice: `{ age, god, opts: [{ type, label, score, region, failed? }], picked }` — `picked` is the act's name, or `null` when every option failed.
  - A carried act: `{ age, god, continued: true, type }`.
  - `region` is a region id, as `lastChoice` already stores it.

- [ ] **Step 1: Write the failing test**

Append to `tests/become.js`:

```js
test('every god\'s choice is kept, age by age, with its matrix', () => {
  const api = load(); api.startCreation('gamma', {});
  for (let n = 0; api.era === 'gods' && n < 60; n++) api.step();
  const cs = api.creation.choices;
  assert.ok(cs.length > 5, `expected many choices, got ${cs.length}`);
  for (const c of cs){
    assert.ok(Number.isInteger(c.age) && c.age >= 1, 'every choice names its age');
    assert.ok(api.gods().some(g => g.id === c.god), 'every choice names a live god');
    if (c.continued){ assert.equal(typeof c.type, 'string'); continue; }
    assert.ok(Array.isArray(c.opts) && c.opts.length, 'a free choice carries its matrix');
    for (const o of c.opts) assert.equal(typeof o.score, 'number');
  }
  const picked = cs.filter(c => !c.continued && c.picked);
  assert.ok(picked.length > 3, 'most free choices land on an act');
  const ages = cs.map(c => c.age);
  assert.deepEqual(ages, [...ages].sort((a, b) => a - b), 'the record is in age order');
});

test('keeping the choices does not move the creation', () => {
  const a = load(), b = load();
  a.startWorld('gamma');
  b.startCreation('gamma', {}); let n = 0; while (b.era === 'gods' && n++ < 1000) b.step();
  assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/become.js`
Expected: FAIL with `creation.choices` undefined.

- [ ] **Step 3: Start the record empty**

In `src/sim/gods.js`, in `beginCreation`, add `choices: []` to the `creation` object:

```js
  creation = { ages: 0, backstops: 0, discards: 0, settled: false, failed: false, gate: null, made: {}, gestures: [], gestureAge: -1, choices: [] };
```

- [ ] **Step 4: Keep each decision**

In `src/sim/gods.js`, replace `decideGod`:

```js
/* The decision is kept, not only the last one. `lastChoice` is what the god's card reads now; the
   record in `creation.choices` is what the timeline reads, age by age, and what the annals inherit.
   Nothing here draws a random number, so the creation is unmoved. */
function decideGod(g){
  if (g.task){ const t = g.task;
    if (g.needs.calm < 20 || g.needs.expression < 15){ log(`${g.name} leaves the ${t.type} unfinished.`, [g]); g.task = null; }
    else { beginAct(); creation.choices.push({ age, god: g.id, continued: true, type: t.type }); GOD_ACTS[t.type].continue(g, t); return; } }
  const opts = godOptions(g); g.lastChoice = { opts: opts.map(o => ({ type: o.type, label: o.label, score: o.score, region: o.region.id })), picked: null };
  const rec = { age, god: g.id, opts: g.lastChoice.opts, picked: null };
  creation.choices.push(rec);
  for (let k = 0; k < opts.length; k++){ const o = opts[k];
    beginAct(); deciding = { g, type: o.type };
    const ok = GOD_ACTS[o.type].apply(g, o.region);
    deciding = null;
    if (ok){ g.lastChoice.picked = o.type; rec.picked = o.type; g.acted++; gainGodXp(g, o.type); noteBeside(g, o.region); return; }
    g.lastChoice.opts[k].failed = true; }
}
```

Note that `rec.opts` is the same array as `g.lastChoice.opts`, so a row marked failed is marked in both.

- [ ] **Step 5: Run the tests**

Run: `node --test tests/become.js && npm run fast`
Expected: PASS.

- [ ] **Step 6: The fingerprint has not moved**

Run: `npm run soak`
Expected: PASS, including `the run matches the golden record`. It takes about ninety seconds. Do not use `npm run soak:quick`: it runs ten days against assertions written for seventy, so it fails on camp growth whatever you changed, and it does not check the golden record.

- [ ] **Step 7: Build and commit**

```bash
node build.js
git add src/sim/gods.js tests/become.js dist/hearth-sim.html
git commit -m "Become E1.2: every god's choice is kept, age by age

decideGod already built the matrix, what it picked, and what failed to apply,
and the next age threw it away. It is appended to creation.choices instead. A
carried act is recorded as continued. No new scoring, no new rule, and no
random number drawn, so the creation is unmoved.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

### Task 3: A resumable age

`ageStep` runs a whole age inside one `withGodRng` closure. A player's turn must suspend in the middle of it. This task splits the age into a beginning, a decide loop with a position, and an end — and changes nothing else. Its gate is that the creation is untouched.

**Files:**
- Modify: `src/sim/gods.js:485-504` (`ageStep`)
- Modify: `src/sim/index.js` (the `API` string)
- Modify: `tests/become.js`

**Interfaces:**
- Consumes: `creation.choices` from Task 2.
- Produces:
  - `agePos` — `null` when no age is part-run, else `{ i }`, the index of the next god to decide in the live `gods()` array.
  - `ageStep()` — unchanged to its callers. It begins an age when `agePos` is null, and resumes when it is not.
  - `ageDecide()` — runs gods from `agePos.i` onward. Returns `true` when the age's gods are done, `false` when the age is suspended. In this task it never returns `false`; Task 4 gives it the reason to.
  - `ageEnd()` — everything after the decide loop: the unmaking, the gate, the strain, the outgrowing, the settle checks.

- [ ] **Step 1: Write the failing test**

Append to `tests/become.js`:

```js
test('an age split in two draws what an unbroken age drew', () => {
  const a = load(), b = load();
  a.startCreation('beta', {}); b.startCreation('beta', {});
  for (let n = 0; n < 12; n++){ a.step(); b.step(); }
  /* b runs its next age through the resumable parts by hand, in the same order ageStep uses. */
  a.step();
  b.withGodRng(() => { b.ageBegin(); b.ageDecide(); b.ageEnd(); });
  assert.equal(b.age, a.age);
  assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
  assert.deepEqual(b.creation.choices, a.creation.choices);
  assert.equal(b.godRng(), a.godRng(), 'the god stream stands at the same place');
});

test('agePos is null between ages', () => {
  const api = load(); api.startCreation('beta', {});
  assert.equal(api.agePos, null);
  api.step();
  assert.equal(api.agePos, null, 'a finished age leaves no position behind');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/become.js`
Expected: FAIL. `ageBegin` is not a function.

- [ ] **Step 3: Split the age**

In `src/sim/gods.js`, replace `ageStep` with the position, the three parts, and the new `ageStep`:

```js
/* Where the age stands. Null between ages. `{ i }` is the index of the next god to decide in the
   live `gods()` array. An age is split so a player's turn can suspend in the middle of it; the
   parts run in the order the one closure ran them, and the god stream is drawn from identically. */
let agePos = null;

function ageBegin(){
  age++;
  /* The gestures replay one age. The list is replaced at the head of the next, before anything acts. */
  creation.gestures = []; creation.gestureAge = age;
  if (age === 1) firstGod();
  /* The Pulse comes in the age after the Sundering: the first age in which a made country can change. */
  if (pulseAge === null && field.root.children){ pulseAge = age; log('The Pulse. Something already made is changed, and so there is a before and an after. Time begins.', [], 'major'); }
  agePos = { i: 0 };
}

/* Runs the awake gods from the position on. Returns false when the age is suspended, true when its
   gods are done. A god made mid-age by a split is appended to `gods()` and is reached here, exactly
   as the one loop reached it. */
function ageDecide(){
  while (agePos.i < gods().length){
    const g = gods()[agePos.i];
    if (g.status === 'awake'){ settleHome(g); godNeeds(g); decideGod(g); }
    agePos.i++;
  }
  return true;
}

function ageEnd(){
  agePos = null;
  for (const g of gods()) if (g.status !== 'dead' && g.acted > 0 && poleShare(g.pole) === 0) unmake(g);
  const gate = restGate(); creation.gate = gate;
  /* Before time there is only the Sundering; the world is not yet strained by what it lacks. */
  if (!gate.ok && pulseAge !== null) strain(gate.lack);
  if (pulseAge !== null) outgrown();
  if (!awakeGods().length){ settleNow = true; return; }
  if (age >= 2 * options.ageLimit){ creation.failed = true; for (const g of awakeGods()){ g.status = 'asleep'; g.asleep = true; } log('The gods sleep unfinished. The world would not hold.', [], 'bad'); settleNow = true; return; }
  if (age >= options.ageLimit) backstop();
}

function ageStep(){
  withGodRng(() => {
    if (!agePos) ageBegin();
    if (!ageDecide()) return;
    ageEnd();
  });
  if (settleNow){ settleNow = false; settle(); }
}
```

- [ ] **Step 4: Expose the new names**

In `src/sim/index.js`, in the `API` string, extend the gods line. Find `startCreation, runAges, ageStep, restGate,` and replace with:

```
  startCreation, runAges, ageStep, ageBegin, ageDecide, ageEnd, get agePos(){ return agePos; }, restGate,
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/become.js && npm run fast`
Expected: PASS. `tests/ages.js` and `tests/gods.js` are the real check here; they run the creation end to end on many seeds.

- [ ] **Step 6: The fingerprint has not moved**

Run: `npm run soak`
Expected: PASS, including `the run matches the golden record`. It takes about ninety seconds. Do not use `npm run soak:quick`: it runs ten days against assertions written for seventy, so it fails on camp growth whatever you changed, and it does not check the golden record.

- [ ] **Step 7: Build and commit**

```bash
node build.js
git add src/sim/gods.js src/sim/index.js tests/become.js dist/hearth-sim.html
git commit -m "Become E1.3: an age that can be suspended and resumed

ageStep ran a whole age inside one withGodRng closure, and a player's turn has
to stop in the middle of one. The age is split into a beginning, a decide loop
that keeps its position, and an end. withGodRng swaps the stream and swaps it
back, so entering it twice in an age draws what entering it once drew, and a
test holds that on the god stream itself.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

### Task 4: The turn lock, `become`, and `choose`

**Files:**
- Modify: `src/sim/gods.js` (the state, `ageDecide`, `takeTurn`)
- Modify: `src/sim/door.js` (`become`, `choose`)
- Modify: `src/sim/main.js:64-70` (`step`)
- Modify: `src/sim/index.js` (the `API` string)
- Modify: `tests/become.js`

**Interfaces:**
- Consumes: `agePos`, `ageBegin`, `ageDecide`, `ageEnd` from Task 3. `creation.choices` from Task 2.
- Produces:
  - `inhabited` — the id of the being the player is, or `null`.
  - `pending` — `null`, or `{ god, age, opts }`. `opts` is the matrix: `[{ type, label, score, region }]`, `region` a region id. A row gains `failed: true` when a chosen option did not land.
  - `takeTurn(opt)` — applies `{ type, region }` for the pending god. Returns a message. Clears `pending` and finishes the age when the option lands.
  - `step()` returns `'The turn is yours.'` and does nothing while `pending` is set.

- [ ] **Step 1: Write the failing test**

Append to `tests/become.js`:

```js
test('becoming a god opens its turn, and the engine will not step until you choose', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  api.inject({ source: 'player', act: 'become', id: g.id });
  const ageWas = api.age;
  api.step();
  assert.ok(api.pending, 'the turn is open');
  assert.equal(api.pending.god, g.id);
  assert.ok(api.pending.opts.length, 'the matrix is the god\'s own options');
  assert.equal(api.step(), 'The turn is yours.');
  assert.equal(api.age, ageWas + 1, 'the age began and then stopped at your god');
  const before = api.creation.choices.length;
  const top = api.pending.opts[0];
  const msg = api.inject({ source: 'player', act: 'choose', id: g.id, opt: { type: top.type, region: top.region } });
  assert.match(msg, /^You /);
  assert.equal(api.pending, null, 'the turn closes');
  assert.ok(api.creation.choices.length > before, 'the choice is in the record');
});

test('taking the best option every turn is the creation the engine runs alone', () => {
  const a = load(), b = load();
  a.startWorld('gamma');
  b.startCreation('gamma', {});
  let n = 0;
  while (b.era === 'gods' && n++ < 2000){
    if (b.pending){
      const g = b.pending.god, top = b.pending.opts[0];
      b.inject({ source: 'player', act: 'choose', id: g, opt: { type: top.type, region: top.region } });
      continue;
    }
    if (!b.inhabited && b.awakeGods().length) b.inject({ source: 'player', act: 'become', id: b.awakeGods()[0].id });
    b.step();
  }
  assert.equal(b.era, 'days');
  assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
  assert.equal(b.tick, a.tick);
});

test('what the player does is a chronicle line and never a legend', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const was = api.legends.length;
  api.inject({ source: 'player', act: 'become', id: api.awakeGods()[0].id });
  assert.equal(api.legends.length, was, 'the legends are the world\'s story, not the player\'s');
  assert.match(api.chronicle[0].text, /looks out through/);
});

test('a suspended age resumes through the gods the age began with', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  api.inject({ source: 'player', act: 'become', id: g.id });
  api.step();
  assert.ok(api.pending, 'the turn is open');
  const was = api.agePos.list;
  const top = api.pending.opts[0];
  api.inject({ source: 'player', act: 'choose', id: g.id, opt: { type: top.type, region: top.region } });
  /* The age either finished, which clears the position, or it ran on through the same list. */
  assert.ok(api.agePos === null || api.agePos.list === was, 'the age never retook its list of gods');
});

test('the door refuses what is not built and what is not open', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  assert.equal(api.inject({ source: 'player', act: 'choose', id: g.id, opt: { type: 'split', region: 1 } }),
    'It is nobody\'s turn.');
  assert.equal(api.inject({ source: 'player', act: 'become', id: g.id, mode: 'possess' }),
    'Only Become is built. Possess, Vessel, and Manifestation wait for their own specs.');
  assert.equal(api.inject({ source: 'player', act: 'become', id: 99999 }),
    'Only a god can be taken, and only while it lives.');
  api.inject({ source: 'player', act: 'become', id: g.id });
  api.step();
  assert.equal(api.inject({ source: 'player', act: 'choose', id: g.id, opt: { type: 'nosuch', region: 1 } }),
    'That is not on the table.');
  assert.ok(api.pending, 'a refused choice leaves the turn open');
});

test('leaving hands the creation back, and it runs on', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  api.inject({ source: 'player', act: 'become', id: g.id });
  api.step();
  assert.ok(api.pending);
  assert.equal(api.inject({ source: 'player', act: 'become', id: null }), 'You are nobody again. The creation goes on without you.');
  assert.equal(api.pending, null, 'leaving closes the open turn');
  assert.equal(api.inhabited, null);
  const ageWas = api.age;
  api.step();
  assert.ok(api.age > ageWas, 'the ages run again');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/become.js`
Expected: FAIL. `api.pending` is undefined.

- [ ] **Step 3: Add the state and the turn**

In `src/sim/gods.js`, directly after the `agePos` declaration from Task 3:

```js
/* A line the player is owed but the world does not remember. In the gods era every logged line joins
   the legends, and the legends are the creation's own story: a hand reaching in is not part of it, and
   a legend that differed would break the equality that autopilot rests on. The door log is the record
   of what the player did. This is only so they can see it happen. */
function note(text){ chronicle.unshift({ tick, when: stamp(), text, kind: 'info' }); if (chronicle.length > 300) chronicle.pop(); }

/* Who the player is, and the turn that is open. `inhabited` is a being id or null. `pending` is null,
   or the god whose turn it is with the matrix it was given. The engine will not step while `pending`
   is set: this is the locked clock the mythos spec reserved. */
let inhabited = null;
let pending = null;

/* Fill the open turn. settleHome and godNeeds run here, once, before the options are drawn, exactly
   where the autonomous path runs them. The matrix is drawn once and kept; drawing it twice would
   draw from the stream twice. */
function openTurn(g){
  settleHome(g); godNeeds(g);
  const opts = godOptions(g);
  pending = { god: g.id, age, opts: opts.map(o => ({ type: o.type, label: o.label, score: o.score, region: o.region.id })) };
}

/* Apply one option for the god whose turn is open. An option that does not land leaves the turn open
   with its row marked failed, because the player is owed the reason; the autonomous god falls to the
   next option in silence. */
function takeTurn(opt){
  const g = beingById(pending.god);
  const k = pending.opts.findIndex(o => o.type === opt.type && o.region === opt.region);
  if (k < 0) return 'That is not on the table.';
  const row = pending.opts[k];
  const r = regionById(row.region);
  let landed = false;
  withGodRng(() => {
    g.lastChoice = { opts: pending.opts, picked: null };
    beginAct(); deciding = { g, type: row.type };
    landed = !!(r && GOD_ACTS[row.type].apply(g, r));
    deciding = null;
    if (landed){ g.lastChoice.picked = row.type; g.acted++; gainGodXp(g, row.type); noteBeside(g, r); }
    else row.failed = true;
  });
  if (!landed) return `The ground refuses it. ${g.name} cannot ${row.type} there.`;
  creation.choices.push({ age: pending.age, god: g.id, opts: pending.opts, picked: row.type, byPlayer: true });
  pending = null;
  agePos.i++;
  withGodRng(() => { if (ageDecide()) ageEnd(); });
  if (settleNow){ settleNow = false; settle(); }
  return `You ${row.type}. ${g.name} acts.`;
}

/* The player leaves, or the god whose turn was open is gone. The open turn closes and the creation
   runs itself from where it stands. */
function releaseTurn(){ pending = null; }
```

- [ ] **Step 4: Suspend the age at the inhabited god, and snapshot the gods once an age**

`gods()` is `beings.filter(b => b.species === 'god')` — a fresh array on every call, not a live one. The original age loop called it once, so a god born mid-age by a `split` act was not reached until the next age. Task 3 kept that by taking the list once at the top of `ageDecide`. That is no longer enough: from this task on, `ageDecide` returns early and is called again to resume, and a second call would take a second, later snapshot that could include a god born during the player's own act. The snapshot moves to `agePos`, where it is taken once an age.

In `src/sim/gods.js`, in `ageBegin`, replace the last line:

```js
  agePos = { i: 0, list: gods() };
```

In `src/sim/gods.js`, replace `ageDecide` from Task 3:

```js
/* The gods of this age, as they stood when it began, and where we are among them. The list is taken
   once an age and never retaken, so a suspended age resumes through the same gods the age started
   with, and a god born mid-age waits for the next age exactly as it always did. */
function ageDecide(){
  const list = agePos.list;
  while (agePos.i < list.length){
    const g = list[agePos.i];
    if (g.status === 'awake'){
      /* The player's god with a free choice stops the age here. A god carrying an act has no choice
         to make, so it carries on and the turn does not open. */
      if (g.id === inhabited && !g.task && runUntil === null){ openTurn(g); return false; }
      settleHome(g); godNeeds(g); decideGod(g);
    }
    agePos.i++;
  }
  return true;
}
```

`runUntil` is declared in Task 6. Declare it now, beside `pending`, so this task runs:

```js
/* The age the autopilot runs to. Null when the player is choosing. Task 6 gives it its act. */
let runUntil = null;
```

- [ ] **Step 5: The engine will not step while a turn is open**

In `src/sim/main.js`, replace `step`:

```js
/* In the gods era a step is an age. In the days era it is a tick. A species with perTick false is not
   stepped by the tick: the gods keep their own clock. The engine will not step while a turn is open:
   the world waits on the player, which is the locked clock. */
function step(){
  if (pending) return 'The turn is yours.';
  if (era === 'gods') return ageStep();
  tick++; updateWorld(); camp = camps[0];
  for (const a of beings) if (a.alive && SPECIES[a.species].perTick !== false) updateBeing(a);
  if (tick % CLOCK.every.prune === 0) beings = beings.filter(b => b.alive || b.species === 'human' || SPECIES[b.species].perTick === false);
}
```

- [ ] **Step 6: The two acts at the door**

In `src/sim/door.js`, replace the stub `become` from Task 1 and add `choose`:

```js
  /* Become: the player is the mob. The other three inhabit modes are named in the spec and refused
     until each is built. An id of null leaves, and the open turn closes with it. */
  become(e){
    if (e.mode !== undefined && e.mode !== 'become') return 'Only Become is built. Possess, Vessel, and Manifestation wait for their own specs.';
    if (e.id === null || e.id === undefined){
      if (inhabited === null) return 'You are nobody already.';
      inhabited = null; releaseTurn();
      note('The hand above lifts. Whatever was moving falls still, and goes on by itself.');
      return 'You are nobody again. The creation goes on without you.';
    }
    const g = beingById(e.id);
    if (!g || !g.alive || g.species !== 'god') return 'Only a god can be taken, and only while it lives.';
    if (inhabited !== null && inhabited !== g.id) releaseTurn();
    inhabited = g.id;
    note(`Something older than the gods looks out through ${g.name}.`);
    return `You are ${g.name}, ${g.epithet}.`;
  },
  /* Choose: take one option from the open matrix. The option is named, never numbered, because a list
     sorted by score is not stable across a replay. */
  choose(e){
    if (!pending) return 'It is nobody\'s turn.';
    if (e.id !== undefined && e.id !== pending.god) return 'That is not whose turn it is.';
    if (!e.opt || typeof e.opt.type !== 'string') return 'An option is an act and the country it falls on.';
    return takeTurn(e.opt);
  },
```

- [ ] **Step 7: Expose the new names**

In `src/sim/index.js`, in the `API` string, on the gods line, after `get agePos(){ return agePos; },` add:

```
  get pending(){ return pending; }, get inhabited(){ return inhabited; }, takeTurn, releaseTurn, note,
```

- [ ] **Step 8: Run the tests**

Run: `node --test tests/become.js && npm run fast`
Expected: PASS. The equality test is the one that matters: a creation driven by taking the top row every turn must be the creation `startWorld` runs alone.

- [ ] **Step 9: The fingerprint has not moved**

Run: `npm run soak`
Expected: PASS, including `the run matches the golden record`. It takes about ninety seconds. Do not use `npm run soak:quick`: it runs ten days against assertions written for seventy, so it fails on camp growth whatever you changed, and it does not check the golden record.

- [ ] **Step 10: Build and commit**

```bash
node build.js
git add src/sim/gods.js src/sim/door.js src/sim/main.js src/sim/index.js tests/become.js dist/hearth-sim.html
git commit -m "Become E1.4: the turn lock, and the acts that take a god and choose

become takes a live god and choose takes one named option from the matrix the
god was given. The age stops at the player's god, the engine refuses to step
while the turn is open, and the option that does not land leaves the turn open
with its reason, which the autonomous god is never owed. Taking the top row
every turn gives the creation startWorld runs alone, line for line.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

### Task 5: The bars, and Force Actions

A trait bars an option. **A bar is a lens on the matrix the player is shown, not a change to the rules.** The autonomous chooser never reads it. That is deliberate and it is what keeps the twenty-four-seed equality: an autopiloted creation must be an unwatched one, so a bar may not change what the engine picks. The score already carries the trait; the bar is how the player sees it.

**Files:**
- Modify: `src/sim/core.js:20-25` (`DEFAULT_OPTIONS`)
- Modify: `src/sim/gods.js` (`GOD_BARS`, `barFor`, `openTurn`, `takeTurn`)
- Modify: `src/sim/index.js` (the `API` string)
- Modify: `tests/become.js`
- Modify: `design/settings.md`

**Interfaces:**
- Consumes: `pending`, `openTurn`, `takeTurn` from Task 4.
- Produces:
  - `GOD_BARS` — a table keyed by act name: `{ trait, floor, why }`. `why` completes the sentence "<name> <why>."
  - `barFor(g, type)` — the bar row when the god is below the floor, else `null`.
  - A matrix row gains `bar: { trait, floor, why }` when barred.
  - `options.force` — `false` by default. When false the door refuses a `choose` on a barred row.

- [ ] **Step 1: Write the failing test**

Append to `tests/become.js`:

```js
/* A god below a floor on the trait its act reads. The table is data, so the test reads the table. */
function godBelow(api, type){
  const bar = api.GOD_BARS[type];
  for (const g of api.awakeGods()){ g.traits[bar.trait] = bar.floor - 0.1; return g; }
  return null;
}

test('a bar names the trait and the floor, and is a lens on the matrix only', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  const bar = api.GOD_BARS.battle;
  g.traits[bar.trait] = bar.floor - 0.1;
  assert.deepEqual(api.barFor(g, 'battle'), bar);
  g.traits[bar.trait] = bar.floor + 0.1;
  assert.equal(api.barFor(g, 'battle'), null);
});

test('with Force Actions off the door refuses a barred option and leaves the turn open', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  api.inject({ source: 'player', act: 'become', id: g.id });
  api.step();
  assert.ok(api.pending);
  /* Bar whatever is on the table, so the test does not depend on which acts a seed offers. */
  const row = api.pending.opts[0];
  api.GOD_BARS[row.type] = { trait: 'bravery', floor: 2, why: 'will not do it' };
  g.traits.bravery = 0;
  api.openTurn(g);
  const barred = api.pending.opts.find(o => o.type === row.type);
  assert.ok(barred.bar, 'the barred row is in the matrix, with its bar');
  assert.equal(api.inject({ source: 'player', act: 'choose', id: g.id, opt: { type: barred.type, region: barred.region } }),
    `${g.name} will not do it.`);
  assert.ok(api.pending, 'the turn stays open');
});

test('with Force Actions on the barred option is taken, with no penalty', () => {
  const api = load(); api.startCreation('gamma', { force: true });
  api.step();
  const g = api.awakeGods()[0];
  api.inject({ source: 'player', act: 'become', id: g.id });
  api.step();
  const row = api.pending.opts[0];
  api.GOD_BARS[row.type] = { trait: 'bravery', floor: 2, why: 'will not do it' };
  g.traits.bravery = 0;
  const traitsWere = { ...g.traits };
  api.openTurn(g);
  const msg = api.inject({ source: 'player', act: 'choose', id: g.id, opt: { type: row.type, region: row.region } });
  assert.doesNotMatch(msg, /will not do it/);
  assert.deepEqual(g.traits, traitsWere, 'forcing costs the god nothing');
});

test('the bars are data, and every barred act reads the trait its score reads', () => {
  const api = load();
  for (const type in api.GOD_BARS){
    const bar = api.GOD_BARS[type];
    assert.ok(api.GOD_ACTS[type], `${type} is a god act`);
    assert.ok(typeof bar.trait === 'string' && typeof bar.why === 'string');
    assert.ok(bar.floor > 0 && bar.floor < 1, `${type}'s floor is a trait value`);
    assert.match(String(api.GOD_ACTS[type].score), new RegExp(`traits\\.${bar.trait}`), `${type}'s score reads ${bar.trait}`);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/become.js`
Expected: FAIL. `api.GOD_BARS` is undefined.

- [ ] **Step 3: Add the option**

In `src/sim/core.js`, in `DEFAULT_OPTIONS`, add `force: false`. The object currently reads:

```js
const DEFAULT_OPTIONS = { sw: 10, sh: 6, zmin: -2, zmax: 2, ageLimit: 200 };
```

Make it:

```js
/* `force` is the Force Actions setting: a barred option may be taken, with no penalty. It is read
   only where the player chooses. No rule reads it, so it cannot move the creation. */
const DEFAULT_OPTIONS = { sw: 10, sh: 6, zmin: -2, zmax: 2, ageLimit: 200, force: false };
```

If the literal differs, add `force: false` to whatever is there and leave the rest alone.

- [ ] **Step 4: Add the bars**

In `src/sim/gods.js`, immediately before `function godOptions(g)`:

```js
/* What a god will not do. Each bar names the trait its act's score already reads, and a floor under
   which the player is told no. A bar is a lens on the matrix the player is shown; the autonomous
   chooser never reads it, so a bar cannot move the creation. Force Actions takes a barred option
   anyway, and it costs the god nothing. */
const GOD_BARS = {
  battle: { trait: 'bravery', floor: 0.35, why: 'is not bold enough to make war' },
  burn: { trait: 'temper', floor: 0.3, why: 'is too calm to set anything alight' },
  mingle: { trait: 'sociability', floor: 0.25, why: 'keeps too much to itself for that' },
};
function barFor(g, type){
  const bar = GOD_BARS[type];
  return bar && g.traits[bar.trait] < bar.floor ? bar : null;
}
```

- [ ] **Step 5: Put the bar on the row, and refuse a barred choice**

In `src/sim/gods.js`, in `openTurn`, replace the `pending` assignment:

```js
  pending = { god: g.id, age, opts: opts.map(o => {
    const row = { type: o.type, label: o.label, score: o.score, region: o.region.id };
    const bar = barFor(g, o.type); if (bar) row.bar = bar;
    return row;
  }) };
```

In `src/sim/gods.js`, in `takeTurn`, after `const row = pending.opts[k];` add:

```js
  if (row.bar && !options.force) return `${beingById(pending.god).name} ${row.bar.why}.`;
```

- [ ] **Step 6: Expose the new names**

In `src/sim/index.js`, in the `API` string, on the gods line, after `takeTurn, releaseTurn,` add:

```
  GOD_BARS, barFor, openTurn,
```

- [ ] **Step 7: Run the tests**

Run: `node --test tests/become.js && npm run fast`
Expected: PASS.

- [ ] **Step 8: The fingerprint has not moved**

Run: `npm run soak`
Expected: PASS, including `the run matches the golden record`. It takes about ninety seconds. Do not use `npm run soak:quick`: it runs ten days against assertions written for seventy, so it fails on camp growth whatever you changed, and it does not check the golden record. A bar that moved the fingerprint would mean the autonomous chooser read it, which is the bug this task must not have.

- [ ] **Step 9: Write the register line**

In `design/settings.md`, add one row to the table:

```markdown
| Force Actions | E, become a god, section 9 | built | Default off. `startCreation(seed, { force: true })`. A trait bars an option in the matrix the player is shown; a bar is a lens on that matrix and no rule reads it, so it cannot move the creation. With `force` on, the door takes a barred option and it costs the god nothing. `GOD_BARS` in `src/sim/gods.js` is the table. |
```

- [ ] **Step 10: Build and commit**

```bash
node build.js
git add src/sim/core.js src/sim/gods.js src/sim/index.js tests/become.js design/settings.md dist/hearth-sim.html
git commit -m "Become E1.5: what a god will not do, and the setting that overrides it

GOD_BARS names, for three acts, the trait its score already reads and the floor
under which the player is told no. A bar is a lens on the matrix the player is
shown: the autonomous chooser never reads it, which is what keeps an
autopiloted creation equal to an unwatched one. Force Actions takes a barred
option anyway, and it costs the god nothing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

### Task 6: Autopilot, and a stop on an age

**Files:**
- Modify: `src/sim/gods.js` (`runUntil`, the stops, `ageBegin`)
- Modify: `src/sim/door.js` (`run`, `watch`)
- Modify: `src/sim/index.js` (the `API` string)
- Modify: `tests/become.js`
- Modify: `tests/ages.js`
- Modify: `design/settings.md`

**Interfaces:**
- Consumes: everything from Tasks 3, 4 and 5.
- Produces:
  - `runUntil` — the age the autopilot runs to, or `null`. While it is set, the inhabited god's turn does not open and `decideGod` chooses for it.
  - `stops` — an array of `{ what: 'age', at }`. `watch` adds one, or removes the one that matches.
  - `ageBegin` ends a run when the age reaches `runUntil`, or when a stop names this age.

- [ ] **Step 1: Write the failing test**

Append to `tests/become.js`:

```js
test('a run takes the engine\'s own choice until the age it names', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  api.inject({ source: 'player', act: 'become', id: g.id });
  api.step();
  assert.ok(api.pending, 'the turn opens before the run');
  assert.equal(api.inject({ source: 'player', act: 'run', until: api.age + 4 }), `Running to age ${api.age + 4}.`);
  assert.equal(api.pending, null, 'a run closes the open turn');
  let n = 0; while (api.era === 'gods' && api.runUntil !== null && n++ < 50) api.step();
  assert.equal(api.runUntil, null, 'the run ended');
  api.step();
  assert.ok(api.pending || api.era === 'days', 'the turn comes back');
});

test('a stop on an age ends a run early, and says why', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  api.inject({ source: 'player', act: 'become', id: g.id });
  const at = api.age + 3;
  assert.equal(api.inject({ source: 'player', act: 'watch', what: 'age', at }), `A stop is set at age ${at}.`);
  assert.deepEqual(api.stops, [{ what: 'age', at }]);
  api.inject({ source: 'player', act: 'run', until: api.age + 40 });
  let n = 0; while (api.era === 'gods' && api.runUntil !== null && n++ < 50) api.step();
  assert.equal(api.age, at, 'the run stopped at the stop, not at the run\'s own end');
  assert.match(api.chronicle[0].text, /age/i);
});

test('the same watch twice clears the stop', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  api.inject({ source: 'player', act: 'watch', what: 'age', at: 9 });
  assert.equal(api.inject({ source: 'player', act: 'watch', what: 'age', at: 9 }), 'The stop at age 9 is cleared.');
  assert.deepEqual(api.stops, []);
});

test('a watch on anything but an age says what is not built', () => {
  const api = load(); api.startCreation('gamma', {});
  assert.equal(api.inject({ source: 'player', act: 'watch', what: 'birth', who: 3 }),
    'Only a stop on an age is built. A stop on an event waits for the watch list.');
});

test('a creation run entirely on autopilot is the creation the engine runs alone', () => {
  const a = load(), b = load();
  a.startWorld('delta');
  b.startCreation('delta', {});
  b.step();
  b.inject({ source: 'player', act: 'become', id: b.awakeGods()[0].id });
  b.inject({ source: 'player', act: 'run', until: 100000 });
  let n = 0; while (b.era === 'gods' && n++ < 2000) b.step();
  assert.equal(b.era, 'days');
  assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
  assert.equal(b.tick, a.tick);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/become.js`
Expected: FAIL. `api.stops` is undefined and `run` is not an act.

- [ ] **Step 3: Add the stops, and end a run at one**

In `src/sim/gods.js`, beside the `runUntil` declaration added in Task 4, add:

```js
/* The stops the player set. A stop on an age is what this slice builds; a stop on an event needs an
   event kind on every chronicle line, which is G's watch list and is not written. The act is shaped
   to take that kind the day it exists. */
let stops = [];
```

In `src/sim/gods.js`, in `ageBegin`, after `agePos = { i: 0 };` add:

```js
  /* A run ends at the age it named, or at the first stop that names this age. The line says why, so
     the player is never stopped without a reason. */
  if (runUntil !== null){
    const stop = stops.find(s => s.what === 'age' && s.at === age);
    if (stop){ runUntil = null; note(`Age ${age}. The stop you set is reached.`); }
    else if (age >= runUntil){ runUntil = null; note(`Age ${age}. The run you set is over.`); }
  }
```

- [ ] **Step 4: Add the two acts**

In `src/sim/door.js`, inside `DOOR_ACTS`, after `choose`:

```js
  /* Run: the god chooses for itself until the age named, or until a stop is reached. Autopilot is the
     engine's own chooser and nothing else, so a creation run on autopilot is an unwatched creation. */
  run(e){
    if (era !== 'gods') return 'There are no ages to run.';
    if (inhabited === null) return 'You are nobody. There is nothing to hand over.';
    if (!Number.isInteger(e.until) || e.until <= age) return 'A run goes to an age still ahead.';
    runUntil = e.until; releaseTurn();
    note(`${beingById(inhabited).name} goes on alone a while.`);
    return `Running to age ${e.until}.`;
  },
  /* Watch: set or clear a stop. The same stop twice clears it. */
  watch(e){
    if (e.what !== 'age') return 'Only a stop on an age is built. A stop on an event waits for the watch list.';
    if (!Number.isInteger(e.at)) return 'A stop on an age names a whole age.';
    const k = stops.findIndex(s => s.what === 'age' && s.at === e.at);
    if (k >= 0){ stops.splice(k, 1); return `The stop at age ${e.at} is cleared.`; }
    stops.push({ what: 'age', at: e.at });
    return `A stop is set at age ${e.at}.`;
  },
```

- [ ] **Step 5: Clear the stops with the creation**

In `src/sim/gods.js`, in `beginCreation`, add to the reset line that already clears `deciding` and `saidFrom`:

```js
  deciding = null; saidFrom = 0; gestureFallbacks = {};
  agePos = null; pending = null; inhabited = null; runUntil = null; stops = [];
```

- [ ] **Step 6: Expose the new names**

In `src/sim/index.js`, in the `API` string, on the gods line, after `GOD_BARS, barFor, openTurn,` add:

```
  get runUntil(){ return runUntil; }, get stops(){ return stops; },
```

- [ ] **Step 7: Add the twenty-four-seed gate**

In `tests/ages.js`, after the `creationOf` function, add:

```js
/* The gate for Become: a creation run entirely on autopilot is the creation startWorld runs alone.
   Autopilot is the engine's own chooser, so this must hold on every seed, line for line. */
function autopilotOf(seed){
  const api = load(); api.startCreation(seed, {});
  api.step();
  const awake = api.awakeGods();
  if (awake.length) api.inject({ source: 'player', act: 'become', id: awake[0].id });
  api.inject({ source: 'player', act: 'run', until: api.options.ageLimit * 2 + 4 });
  const max = api.options.ageLimit * 2 + 2;
  for (let n = 0; api.era === 'gods' && n < max; n++) api.step();
  return api;
}
```

And, inside the existing `for (const seed of SEEDS)` loop, after the existing `test(...)` call, add a second test:

```js
  test(`seed ${seed}: an autopiloted creation is an unwatched one`, () => {
    const a = load(); a.startWorld(seed);
    const b = autopilotOf(seed);
    assert.equal(b.era, 'days');
    assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
    assert.equal(b.tick, a.tick);
    assert.equal(b.firstPerson().name, a.firstPerson().name);
  });
```

Add `const { load } = require('../src/sim');` only if it is not already at the top of the file. It is.

- [ ] **Step 8: Run the tests**

Run: `node --test tests/become.js && node --test tests/ages.js && npm run fast`
Expected: PASS, all twenty-four seeds.

- [ ] **Step 9: The fingerprint has not moved**

Run: `npm run soak`
Expected: PASS, including `the run matches the golden record`. It takes about ninety seconds. Do not use `npm run soak:quick`: it runs ten days against assertions written for seventy, so it fails on camp growth whatever you changed, and it does not check the golden record.

- [ ] **Step 10: Move the register line for the inhabit modes**

In `design/settings.md`, replace the `Inhabit modes` row with:

```markdown
| Inhabit modes | E, later gods | built (Become, for a god) | Become: the player is the mob. Possess: the mob stays itself and is possessed, knowing or not. Vessel: possession that grants powers or damages the host. Manifestation: a god born or reborn out of the mob, destroying it. Become is built for a god in the ages: `become`, `choose`, `run`, and `watch` at the door. The other three are refused by name until each has its spec. |
```

And add a row for the stops:

```markdown
| A stop on an age | E, become a god, section 4 | built | `watch` with `{ what: 'age', at }`. The same stop twice clears it. A run ends at the first stop that names the age, and the chronicle says why. A stop on an event needs an event kind on every chronicle line, which is G section 7 and is not written; the act refuses that kind by name until it is. |
```

- [ ] **Step 11: Build and commit**

```bash
node build.js
git add src/sim/gods.js src/sim/door.js src/sim/index.js tests/become.js tests/ages.js design/settings.md dist/hearth-sim.html
git commit -m "Become E1.6: autopilot, and a stop on an age

run hands the god back to the engine's own chooser until the age it names, and
a stop ends the run early and says why in the chronicle. The same watch twice
clears its stop. A watch on anything else is refused by name, because the event
kinds it would need are G's watch list and are not written.

Twenty-four seeds now hold the gate: a creation run entirely on autopilot is
the creation startWorld runs alone, line for line.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

## What E1 does not build

| Left for | What |
|---|---|
| E2 | The timeline: the view model in `derive.js`, folded and unfolded, zoom, and the marks drawn ahead of the now-line. |
| E3 | The turn card, `Take a god` on the start dialog, the rest gate in the strip, and every key. |
| G section 7 | A stop on an event. It needs an `event` kind on every chronicle line. |

Until E3 the acts are reachable only from the console and the tests. That is deliberate: E1's gate is the twenty-four-seed equality, and it does not need a screen.
