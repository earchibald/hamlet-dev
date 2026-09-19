# Become, plan E2: the timeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the record of the creation on the screen, so the player can see what every god did, age by age, and why.

**Architecture:** The interface only. No file in `src/sim/` changes. One new file, `src/ui/timeline.js`, draws a band under the map. Its view model lives in `src/ui/derive.js`, which touches no DOM and is tested in Node. It reads `creation.choices`, which plan E1 already keeps: one entry for each god that decided in each age, holding that god's whole scored option list, what it picked, and what failed to apply.

**Tech Stack:** Plain scripts in one shared scope, joined by `src/ui/index.js` after the sim. No ES modules. Tests are `node:test` with `node:assert/strict`.

**Spec:** `design/specs/2026-09-18-become-a-god-design.md`, sections 6 and 7. Read them first. `design/notes.md` section 18 says what the simulation now holds.

## Why this slice stands alone

The ages do not read to a player who watches them, and the cause is not known. E1 built the instrument's other half — the player can take a god — but E1 shipped no screen. This slice adds no inhabiting at all. It shows the record: what each god weighed, what it took, and how close the creation is to the rest gate.

If the ages become legible with this alone, the fault was never that the player could not act. That is worth knowing before E3 is built.

## What this slice does NOT build

The marks ahead of the now-line — a run, and a stop — are **not** here. They are set by the `run` and `watch` acts, and both refuse unless the player has inhabited a god, which nothing can do until E3 adds `Take a god` and the turn card. Marks arrive in E3, together with the thing that makes them reachable. The timeline is built so they drop in: the model already returns an empty `marks` list, and the drawing already leaves the space to the right of the now-line.

## Global Constraints

- Files in `src/ui/` are **not** ES modules. They share one scope with `src/sim/`, in one built page. **Grep both trees before adding any top-level name.** `stops`, `note`, `pending`, `agePos`, `inhabited`, `runUntil` and `endAges` are taken by the simulation.
- `src/ui/` reads state and draws. **It never changes a rule.** No call into the sim that mutates, except through `inject()`.
- View state changes go in `actions.js`. The three recorded exceptions are the window drag handler in `windows.js`, the palette's list state in `dialogs.js`, and the cursor and hover in `main.js`. Do not add a fourth.
- `derive.js` and `keys.js` touch no DOM and are loaded in Node by `tests/ui.js`. Keep them that way.
- Every clickable thing has a key, printed on it. `tests/ui.js` fails on a button without one.
- Keys go in `KEYMAP` in `keys.js` and nowhere else.
- **The band is built from DOM nodes, with `textContent` for every string.** The rest of `src/ui/` writes HTML strings and passes sim text through `esc`; the timeline does not follow that, on purpose. Its text is god names and act names out of the simulation, and building nodes removes the question rather than answering it each time. Do not introduce `innerHTML` into `src/ui/timeline.js`.
- Never name a local `days`, `hours`, `mins`, `secs`, `years`, `ticks`, or `strides`. They are clock helpers in the shared scope.
- Write the game's text in plain English. One idea per sentence.
- Run `node build.js` after every change to `src/`.
- **The gate, every task:** `npm run fast` passes, and `npm run soak` passes including "the run matches the golden record" (about ninety seconds). Never use `npm run soak:quick`; it runs ten days against seventy-day assertions. Never set `UPDATE_GOLDEN`.
- This slice changes nothing in `src/sim/`, so the soak and the twenty-four-seed equality must be untouched. If either moves, something reached into the sim.

## Names another branch is taking

The `naming` branch lands near this one and **appends** to the same files. Do not use these names: in `derive.js` `nameTitle`, `campNames`, `sectorLabel`, `sectorProse`, `LEARNED_KINDS`, `learnedNames`, `chronicleMatches`, `valleyName`; in `actions.js` `searchChronicle`, `closeSearch`, `setChronSearch`; on `ui` the field `chronSearch`; and the key `/`. Whoever lands second merges dev first.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/ui/derive.js` | Modify | `timelineModel()`, `chipMatrix()`, `timelineSpan()`, `footChip()`, and `'timeline'` in `focusRing()`. Pure. |
| `src/ui/panels.js` | Modify | The foot shows an opened chip. |
| `src/ui/state.js` | Modify | The `ui` fields, and `persist`/`restore` for the two that are preferences. |
| `src/ui/keys.js` | Modify | The `timeline` focus, `T`, and `[`/`]` on focused rows. |
| `src/ui/actions.js` | Modify | Every change to that state, and the reset on load and on a new world. |
| `src/ui/timeline.js` | Create | The drawing. The only new file. |
| `src/ui/index.js` | Modify | `timeline` joined after `map`. |
| `src/page.template.html` | Modify | A third grid row, the band's element, and its style. |
| `tests/ui.js` | Modify | The model, the keys, the reset, and a key on every button. |

## The layout, and one correction

The spec's section 6 says the parts down the screen are the strip, the map, the timeline, and the foot. **The foot is not a row.** It is absolutely positioned inside `.mapbox`, ten pixels from its bottom edge and inset four hundred from its right to clear the drawers (the `#foot` rule in `src/page.template.html`). It is an overlay on the map, like the tool bar, and it names what the cursor is on.

So the foot stays exactly where it is, and the timeline becomes a third row of the `.app` grid, under the map box. The order on the screen is the strip, the map with the foot floating at its bottom, then the timeline. Nothing about the foot changes, and its inset from the drawers still works.

---

### Task 1: The view model

The shape every later task reads. Pure, and testable without a browser.

**Files:**
- Modify: `src/ui/derive.js`, `src/ui/state.js`
- Modify: `tests/ui.js`

**Interfaces:**
- Produces `timelineModel()`, returning `{ shown, folded, from, to, now, rows, marks }`.
  - `shown` is false in the days era, where the creation is over and the band is hidden.
  - `rows` is one row folded; unfolded it is a row for each god plus a last row for the gate. Each row is `{ id, label, cells }`, `id` being `'all'`, a god id, or `'gate'`.
  - A cell is `{ age, text, major, chip }`. `chip` is `` `${age}:${god}` ``, or `null` for the gate cell.
  - `marks` is always empty in this slice. E3 fills it.
- Produces `chipMatrix(key)`, returning `{ age, god, name, picked, byPlayer, continued, opts }` or `null`. `opts` rows are `{ type, score, region, failed }` as the record holds them, in the record's own order — **the interface does not sort and does not score.**
- Produces `timelineSpan(zoom, now)`, the `{ from, to }` for a zoom level. Zoom `0` shows the last twelve ages; each step out doubles the span; the widest shows every age from one.

- [ ] **Step 1: Write the failing test**

Add to `tests/ui.js`, beside the other `derive` tests:

```js
const TL_API = ['timelineModel', 'chipMatrix', 'timelineSpan', 'ui', 'creation', 'age', 'era', 'gods', 'startCreation', 'step'];

test('the timeline folds to one row of the creation in age order', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) api.step();
  const m = api.timelineModel();
  assert.equal(m.shown, true);
  assert.equal(m.folded, true);
  assert.equal(m.rows.length, 1, 'folded is one row');
  assert.equal(m.rows[0].id, 'all');
  assert.equal(m.now, api.age);
  const ages = m.rows[0].cells.map(c => c.age);
  assert.deepEqual(ages, [...ages].sort((a, b) => a - b), 'cells run in age order');
  for (const c of m.rows[0].cells) assert.match(c.chip, /^\d+:\d+$/, 'every cell names its entry');
});

test('unfolded, the timeline is a row for each god and a row for the gate', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) api.step();
  api.ui.timelineFold = false;
  const m = api.timelineModel();
  assert.equal(m.folded, false);
  assert.equal(m.rows[m.rows.length - 1].id, 'gate', 'the gate is the last row');
  const godIds = api.gods().map(g => g.id);
  for (const r of m.rows.slice(0, -1)) assert.ok(godIds.includes(r.id), 'every other row is a god');
  assert.ok(m.rows.length > 1);
});

test('a chip opens the matrix that produced it, unsorted and unscored by the view', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) api.step();
  const rec = api.creation.choices.find(c => !c.continued && c.picked);
  const m = api.chipMatrix(`${rec.age}:${rec.god}`);
  assert.equal(m.age, rec.age);
  assert.equal(m.picked, rec.picked);
  assert.equal(typeof m.name, 'string');
  assert.deepEqual(m.opts.map(o => o.score), rec.opts.map(o => o.score), 'the view neither sorts nor scores');
  assert.equal(api.chipMatrix('9999:1'), null, 'a chip that names nothing opens nothing');
});

test('the zoom sets the span, and the default keeps the near ages large', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  assert.deepEqual(api.timelineSpan(0, 20), { from: 9, to: 20 }, 'the default shows the last twelve');
  assert.deepEqual(api.timelineSpan(1, 20), { from: 1, to: 20 }, 'one step out doubles it, clamped at age one');
  assert.deepEqual(api.timelineSpan(0, 3), { from: 1, to: 3 }, 'a young creation is never cut short');
  assert.equal(api.timelineSpan(9, 400).from, 1, 'the widest shows the whole creation');
});

test('the band is not shown once the valley is made', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', {});
  let n = 0; while (api.era === 'gods' && n++ < 2000) api.step();
  assert.equal(api.era, 'days');
  assert.equal(api.timelineModel().shown, false, 'the creation is over');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ui.js`
Expected: FAIL. `timelineModel` is not a function.

- [ ] **Step 3: Add the three view fields**

In `src/ui/state.js`, in the `ui` object, after `overlay`:

```js
  timelineFold: true,  /* the timeline is one row; false is a row for each god */
  timelineZoom: 0,     /* 0 keeps the near ages large; each step out doubles the span */
  timelineChip: null,  /* the chip the player opened, `age:god`, or null. Not a preference: it names one act of one creation. */
```

- [ ] **Step 4: Write the model**

Add to `src/ui/derive.js`, after `drawerRows`:

```js
/* ---------- the timeline ----------
   The record of the creation, laid flat under the map. It reads `creation.choices`, which the sim
   keeps: one entry for each god that decided in each age, with that god's whole scored option list,
   what it picked, and what failed to apply. The view neither sorts nor scores. Nothing here reaches
   into a rule, and nothing here changes one. */

/* How many ages the band covers. Zoom 0 is the default and keeps the near ages large; each step out
   doubles the span. The span never begins before age one, and never ends before the live age. */
const TL_SPAN = 12, TL_ZOOM_MAX = 9;
function timelineSpan(zoom, now){
  const want = TL_SPAN * Math.pow(2, Math.max(0, Math.min(TL_ZOOM_MAX, zoom)));
  return { from: Math.max(1, now - want + 1), to: Math.max(1, now) };
}

/* One cell's words. A carried act says so. A free choice names what it took, or says the ground
   refused every option it had. */
function tlCellText(rec, withWho){
  const g = beingById(rec.god);
  const who = withWho && g ? `${g.name}: ` : '';
  if (rec.continued) return `${who}carries on`;
  if (!rec.picked) return `${who}finds nothing it can do`;
  return `${who}${rec.picked}`;
}

function timelineModel(){
  const empty = { shown: false, folded: ui.timelineFold !== false, from: 1, to: 1, now: 0, rows: [], marks: [] };
  if (!inAges() || !creation || !creation.choices) return empty;
  const now = age;
  const { from, to } = timelineSpan(ui.timelineZoom | 0, now);
  const inSpan = creation.choices.filter(c => c.age >= from && c.age <= to);
  const cell = (rec, withWho) => ({ age: rec.age, text: tlCellText(rec, withWho), major: !!rec.picked && !rec.continued, chip: `${rec.age}:${rec.god}` });
  if (ui.timelineFold !== false){
    return { shown: true, folded: true, from, to, now, marks: [],
      rows: [{ id: 'all', label: 'The ages', cells: inSpan.map(r => cell(r, true)) }] };
  }
  const rows = [];
  for (const g of gods()){
    const mine = inSpan.filter(c => c.god === g.id);
    if (!mine.length && g.status !== 'awake') continue;
    rows.push({ id: g.id, label: g.name, cells: mine.map(r => cell(r, false)) });
  }
  /* The gate is what the whole creation is steering toward, so it gets a row of its own. It reads
     `ok` and `lack` and nothing else: the gate object carries a whole region inside it. */
  const gate = creation.gate;
  rows.push({ id: 'gate', label: 'The gate', cells: [{ age: now, text: gate ? (gate.ok ? 'the world will hold' : `wants ${gate.lack}`) : 'not weighed yet', major: false, chip: null }] });
  return { shown: true, folded: false, from, to, now, rows, marks: [] };
}

/* One chip, opened. The matrix is the record's own, in the record's own order. */
function chipMatrix(key){
  if (!key || !creation || !creation.choices) return null;
  const [a, id] = String(key).split(':').map(Number);
  const rec = creation.choices.find(c => c.age === a && c.god === id);
  if (!rec) return null;
  const g = beingById(rec.god);
  return { age: rec.age, god: rec.god, name: g ? g.name : 'someone gone', picked: rec.picked || null,
    byPlayer: !!rec.byPlayer, continued: !!rec.continued, opts: rec.opts || [] };
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/ui.js && npm run fast`
Expected: PASS.

- [ ] **Step 6: The simulation is untouched**

Run: `npm run soak`
Expected: PASS including "the run matches the golden record". This slice changes no rule, so a moved record means something reached into the sim.

- [ ] **Step 7: Build and commit**

```bash
node build.js
git add src/ui/derive.js src/ui/state.js tests/ui.js dist/hearth-sim.html
git commit -m "Become E2.1: the timeline's view model

The record of the creation, laid flat. It reads creation.choices, which E1
keeps: one entry for each god that decided in each age. Folded it is one row in
age order; unfolded it is a row for each god and a row for the rest gate, which
reads only whether the world will hold and what it wants, because the gate
object carries a whole region inside it. A chip opens the matrix that produced
it, in the record's own order: the view neither sorts nor scores.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

### Task 2: The state, the actions, and the reset

**Files:**
- Modify: `src/ui/state.js` (`persist`, `restore`)
- Modify: `src/ui/actions.js`
- Modify: `tests/ui.js`

**Interfaces:**
- Consumes the three `ui` fields from Task 1.
- Produces, in `ACTIONS`: `foldTimeline()` toggles `ui.timelineFold`; `zoomTimelineOut()` and `zoomTimelineIn()` step `ui.timelineZoom` within `0` to `TL_ZOOM_MAX`; `openChip(key)` sets `ui.timelineChip`, and the same key twice clears it.
- `timelineFold` and `timelineZoom` join `persist()` and `restore()`. `timelineChip` does **not**.
- `onLoad()` and the new-world path clear `ui.timelineChip`.

- [ ] **Step 1: Write the failing test**

Add to `tests/ui.js`:

```js
test('the fold and the zoom are remembered, and the opened chip is not', () => {
  const api = loadUI(['state'], ['persist', 'restore', 'ui']);
  const src = String(api.persist);
  assert.match(src, /timelineFold/, 'the fold is a preference');
  assert.match(src, /timelineZoom/, 'the zoom is a preference');
  assert.doesNotMatch(src, /timelineChip/, 'the opened chip names one act of one creation and is not remembered');
});

test('the timeline actions stay inside their bounds, and the same chip twice closes it', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], ['ACTIONS', 'ui', 'TL_ZOOM_MAX']);
  api.ui.timelineFold = true;
  api.ACTIONS.foldTimeline();
  assert.equal(api.ui.timelineFold, false);
  api.ACTIONS.foldTimeline();
  assert.equal(api.ui.timelineFold, true);
  api.ui.timelineZoom = 0;
  api.ACTIONS.zoomTimelineIn();
  assert.equal(api.ui.timelineZoom, 0, 'it never goes below the default');
  for (let n = 0; n < 40; n++) api.ACTIONS.zoomTimelineOut();
  assert.equal(api.ui.timelineZoom, api.TL_ZOOM_MAX, 'it never goes past the widest');
  api.ACTIONS.openChip('4:3');
  assert.equal(api.ui.timelineChip, '4:3');
  api.ACTIONS.openChip('4:3');
  assert.equal(api.ui.timelineChip, null, 'the same chip twice closes it');
});
```

And in the existing test named `a load puts the view back: one camp, nobody followed, no cards, and the cursor inside the new world`, set `api.ui.timelineChip = '3:2';` before the `api.onLoad();` line, and after it assert:

```js
  assert.equal(api.ui.timelineChip, null, 'a load closes an opened chip');
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ui.js`
Expected: FAIL. `ACTIONS.foldTimeline` is not a function.

- [ ] **Step 3: Remember the two preferences**

In `src/ui/state.js`, in `persist()`, add `timelineFold: ui.timelineFold, timelineZoom: ui.timelineZoom` to the object written. In `restore()`, after the `chronFilter` line:

```js
    if (typeof s.timelineFold === 'boolean') ui.timelineFold = s.timelineFold;
    if (Number.isInteger(s.timelineZoom) && s.timelineZoom >= 0 && s.timelineZoom <= TL_ZOOM_MAX) ui.timelineZoom = s.timelineZoom;
```

- [ ] **Step 4: Add the actions**

In `src/ui/actions.js`, in the `ACTIONS` object:

```js
  /* The timeline. Folded it is one row of the creation; unfolded it is a row for each god. The zoom
     is on its own time axis and never touches the map's levels. */
  foldTimeline(){ ui.timelineFold = !ui.timelineFold; persist(); },
  zoomTimelineOut(){ ui.timelineZoom = Math.min(TL_ZOOM_MAX, (ui.timelineZoom | 0) + 1); persist(); },
  zoomTimelineIn(){ ui.timelineZoom = Math.max(0, (ui.timelineZoom | 0) - 1); persist(); },
  /* One act of one creation, opened into the foot. The same chip twice closes it. */
  openChip(key){ ui.timelineChip = ui.timelineChip === key ? null : key; },
```

- [ ] **Step 5: Clear the chip where the view is reset**

In `src/ui/actions.js`, in `onLoad()`, beside the other view resets, add `ui.timelineChip = null;`. Find the new-world path (the function `makeWorld` runs) and add the same line there. Do not clear the fold or the zoom: they are how the player likes to look at any world.

- [ ] **Step 6: Run the tests and the gate**

Run: `node --test tests/ui.js && npm run fast && npm run soak`
Expected: PASS, golden record matched.

- [ ] **Step 7: Build and commit**

```bash
node build.js
git add src/ui/state.js src/ui/actions.js tests/ui.js dist/hearth-sim.html
git commit -m "Become E2.2: the timeline's view state, and where it is forgotten

The fold and the zoom are how the player likes to look at any world, so they
are remembered. The opened chip names one act of one creation, so it is not: it
lives on ui alone, and a load or a new world closes it. Every change goes
through ACTIONS, as the house rule says.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

### Task 3: The keys and the focus

`[` and `]` are already `levelDown` and `levelUp` on focus `any`, and the dispatcher runs the rows of the focused kind before the `any` rows. So the timeline takes its own focus, and the same two keys change meaning while it holds it.

**Files:**
- Modify: `src/ui/keys.js`, `src/ui/actions.js`
- Modify: `tests/ui.js`

**Interfaces:**
- Consumes the actions from Task 2.
- Produces the focus name `'timeline'`, entered by `T` or a click on the band and left by `Escape`, and three `KEYMAP` rows with the buttons `foldTl`, `tlOut`, `tlIn`.

- [ ] **Step 1: Write the failing test**

Add to `tests/ui.js`:

```js
test('the timeline keys change meaning by focus, and do not take the level keys away', () => {
  const api = loadUI(['state', 'keys'], ['keyAction', 'KEYMAP', 'ui']);
  api.ui.focus = 'map';
  assert.equal(api.keyAction({ key: '[' }).action, 'levelDown', 'the map keeps its levels');
  assert.equal(api.keyAction({ key: ']' }).action, 'levelUp');
  api.ui.focus = 'timeline';
  assert.equal(api.keyAction({ key: '[' }).action, 'zoomTimelineOut', 'the timeline zooms while it holds focus');
  assert.equal(api.keyAction({ key: ']' }).action, 'zoomTimelineIn');
  assert.equal(api.keyAction({ key: 't' }).action, 'foldTimeline', 'T folds from anywhere');
  api.ui.focus = 'map';
  assert.equal(api.keyAction({ key: 't' }).action, 'foldTimeline');
});

test('the timeline joins the focus cycle and Escape leaves it', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], ['ACTIONS', 'ui', 'focusStep']);
  api.ui.focus = 'timeline';
  api.ACTIONS.back();
  assert.equal(api.ui.focus, 'map', 'Escape returns focus to the map');
  const seen = new Set();
  api.ui.focus = 'map';
  for (let n = 0; n < 12; n++){ api.focusStep(1); seen.add(api.ui.focus); }
  assert.ok(seen.has('timeline'), 'Tab reaches the timeline');
});

test('every timeline button has a key', () => {
  const api = loadUI(['state', 'keys'], ['KEYMAP']);
  for (const id of ['foldTl', 'tlOut', 'tlIn'])
    assert.ok(api.KEYMAP.some(r => r.button === id), `${id} has no key`);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ui.js`
Expected: FAIL. `keyAction` gives `levelDown` under the timeline focus.

- [ ] **Step 3: Add the rows**

In `src/ui/keys.js`, in `KEYMAP`, after the `levelDown` row:

```js
  { key: 't',          focus: 'any',      action: 'foldTimeline',    label: 'Fold or unfold the timeline', button: 'foldTl' },
  /* The same two keys as the levels. A focused row beats an `any` row, so they zoom the timeline's
     own time axis while the timeline holds focus, and change level everywhere else. */
  { key: '[',          focus: 'timeline', action: 'zoomTimelineOut', label: 'Timeline: more ages', button: 'tlOut' },
  { key: ']',          focus: 'timeline', action: 'zoomTimelineIn',  label: 'Timeline: fewer ages', button: 'tlIn' },
```

- [ ] **Step 4: Put the timeline in the focus cycle and under Escape**

`focusStep` in `src/ui/actions.js` walks the list that `focusRing()` in `src/ui/derive.js` returns. Add `'timeline'` to `focusRing()`, after the drawers and before it returns to the map, and only while `inAges()` is true — the band is not shown in the days, and Tab must not stop on something invisible. In `ACTIONS.back`, make a focus of `'timeline'` return to `'map'`, the way a drawer focus does.

- [ ] **Step 5: Say it in the help**

The help table is built from `KEYMAP`, so the three rows appear by themselves. Add one line to the help page saying the timeline's keys change meaning by focus: `[` and `]` show more or fewer ages while the timeline is focused, and change level otherwise.

- [ ] **Step 6: Run the tests and the gate**

Run: `node --test tests/ui.js && npm run fast && npm run soak`
Expected: PASS. The three buttons are added in Task 4; until then the button test passes on the `KEYMAP` rows alone, which is what it checks.

- [ ] **Step 7: Build and commit**

```bash
node build.js
git add src/ui/keys.js src/ui/actions.js src/page.template.html tests/ui.js dist/hearth-sim.html
git commit -m "Become E2.3: the timeline's own focus, so two keys can mean two things

[ and ] are the level keys and stay the level keys. The dispatcher already runs
the focused rows before the any rows, so the timeline takes a focus of its own
and the same two keys zoom its time axis while it holds it. T folds from
anywhere. Escape leaves, and Tab reaches it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

### Task 4: The band on the screen

**Files:**
- Create: `src/ui/timeline.js`
- Modify: `src/ui/index.js`, `src/ui/main.js`, `src/ui/derive.js` (`viewKey`)
- Modify: `src/page.template.html`
- Modify: `tests/ui.js`

**Interfaces:**
- Consumes `timelineModel()` and the actions.
- Produces `drawTimeline()`, called each frame, and `initTimeline()`, called once from `initUI()`.

- [ ] **Step 1: The row in the page**

In `src/page.template.html`:

- `.app` becomes `grid-template-rows:auto minmax(0,1fr) auto`.
- After `</main>`, before the closing `</div>` of `.app`, add `<div id="timeline" tabindex="0" aria-label="The timeline of the ages"></div>`.
- Add the style, in the page's own vocabulary:

```css
#timeline{display:none;background:var(--panel);border-top:1px solid var(--line);padding:3px 10px 5px;font-size:12px;overflow:hidden}
#timeline.on{display:block}
#timeline:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
#timeline .tlhead{display:flex;align-items:center;gap:8px;color:var(--muted);font:500 11px "JetBrains Mono",monospace}
#timeline .tlhead .sp{margin-left:auto;display:flex;gap:4px}
#timeline .lane{display:flex;align-items:center;gap:4px;margin-top:2px;white-space:nowrap;overflow:hidden}
#timeline .who{flex:none;width:96px;color:var(--muted);overflow:hidden;text-overflow:ellipsis}
#timeline .cell{border:1px solid var(--line);border-radius:4px;padding:0 5px;cursor:pointer;background:none;color:inherit;font:inherit}
#timeline .cell.major{border-color:color-mix(in srgb,var(--major) 45%,transparent);font-weight:700}
#timeline .cell.open{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
#timeline .now{flex:none;width:0;border-left:2px solid var(--major);align-self:stretch;margin:0 4px}
```

The `.now` rule is the now-line. The space to its right is where E3's marks go.

- [ ] **Step 2: Write the file**

Create `src/ui/timeline.js`. It builds nodes and sets `textContent`; it holds no state of its own, and every click goes through `ACTIONS`.

```js
/* The timeline: the record of the creation, laid flat under the map. It draws the model and nothing
   else. It builds nodes and sets textContent, so no string out of the simulation is ever parsed as
   markup. Do not bring innerHTML in here. */
function tlButton(id, text, key){
  const b = document.createElement('button');
  b.className = 'btn small'; b.id = id; b.textContent = text;
  const k = document.createElement('kbd'); k.textContent = key; b.appendChild(k);
  return b;
}
function tlCell(c){
  if (!c.chip){ const s = document.createElement('span'); s.className = 'cell'; s.textContent = c.text; return s; }
  const b = document.createElement('button');
  b.className = 'cell' + (c.major ? ' major' : '') + (ui.timelineChip === c.chip ? ' open' : '');
  b.dataset.chip = c.chip; b.textContent = c.text;
  return b;
}
function drawTimeline(){
  const el = $('timeline'); if (!el) return;
  const m = timelineModel();
  el.classList.toggle('on', m.shown);
  el.replaceChildren();
  if (!m.shown) return;
  const head = document.createElement('div'); head.className = 'tlhead';
  const span = document.createElement('span'); span.textContent = `Age ${m.from} to ${m.now}`;
  const sp = document.createElement('span'); sp.className = 'sp';
  sp.append(tlButton('foldTl', m.folded ? 'Every god' : 'One row', 'T'),
            tlButton('tlOut', 'More ages', '['), tlButton('tlIn', 'Fewer ages', ']'));
  head.append(span, sp); el.appendChild(head);
  for (const r of m.rows){
    const lane = document.createElement('div'); lane.className = 'lane';
    const who = document.createElement('span'); who.className = 'who'; who.textContent = r.label;
    lane.appendChild(who);
    for (const c of r.cells) lane.appendChild(tlCell(c));
    const now = document.createElement('span'); now.className = 'now';
    lane.appendChild(now);
    el.appendChild(lane);
  }
}

/* One handler for the whole band. A click on a cell opens or closes it. A click anywhere in the band
   gives the timeline focus, so `[` and `]` zoom instead of changing level. */
const TL_BUTTONS = { foldTl: 'foldTimeline', tlOut: 'zoomTimelineOut', tlIn: 'zoomTimelineIn' };
function initTimeline(){
  const el = $('timeline'); if (!el) return;
  el.addEventListener('click', e => {
    ui.focus = 'timeline';
    const cell = e.target.closest('[data-chip]');
    const btn = e.target.closest('button');
    if (cell) ACTIONS.openChip(cell.dataset.chip);
    else if (btn && TL_BUTTONS[btn.id]) ACTIONS[TL_BUTTONS[btn.id]]();
    renderUI(true);
  });
}
```

`renderUI(true)` in `src/ui/panels.js` is the forced redraw the other view changes use; `focusStep` calls it the same way.

- [ ] **Step 3: Join it and call it**

In `src/ui/index.js`, put `'timeline'` in `FILES` after `'map'`. In `main.js`, call `initTimeline()` beside the other init calls in `initUI()`, and `drawTimeline()` where the strip and the drawers are drawn each frame.

- [ ] **Step 4: Fold the band into the frame's change key**

`viewKey()` in `derive.js` returns a short string that changes when anything drawn changes, and the frame skips the redraw when it has not. Add to the ages branch: `ui.timelineFold`, `ui.timelineZoom`, `ui.timelineChip`, and `creation.choices.length`. Without this the band will not repaint when a chip is opened.

- [ ] **Step 5: Write the test**

Add to `tests/ui.js`:

```js
test('the frame repaints when the timeline changes', () => {
  const api = loadUI(['state', 'derive'], ['viewKey', 'ui', 'startCreation', 'step']);
  api.startCreation('gamma', {});
  for (let n = 0; n < 6; n++) api.step();
  const a = api.viewKey();
  api.ui.timelineFold = !api.ui.timelineFold;
  assert.notEqual(api.viewKey(), a, 'the fold is in the key');
  const b = api.viewKey();
  api.ui.timelineChip = '3:2';
  assert.notEqual(api.viewKey(), b, 'the opened chip is in the key');
});

test('the timeline builds nodes and never parses markup', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/ui/timeline.js'), 'utf8');
  assert.doesNotMatch(src, /innerHTML/, 'the band sets textContent, so no sim string is parsed as markup');
});
```

- [ ] **Step 6: Run the tests and the gate**

Run: `node --test tests/ui.js && npm run fast && npm run soak`
Expected: PASS, golden record matched.

- [ ] **Step 7: Look at it**

Run `node serve.js` and open the page. Watch a creation at pace 1. The band must appear under the map in the ages, the map above it must keep its shape, `T` must fold and unfold, `[` and `]` must zoom while the band has focus and change level when the map has focus, and the band must disappear at settle. Say in the report what you actually saw, including anything that looked wrong.

- [ ] **Step 8: Build and commit**

```bash
node build.js
git add src/ui/timeline.js src/ui/index.js src/ui/main.js src/ui/derive.js src/page.template.html tests/ui.js dist/hearth-sim.html
git commit -m "Become E2.4: the timeline on the screen

A third row of the app grid, under the map. The foot does not move: it is
absolutely positioned inside the map box and belongs to the map, whose cursor
it names. The band builds nodes and sets textContent, so no string out of the
simulation is parsed as markup; it holds no state of its own, every click goes
through ACTIONS, and its inputs are in viewKey so the frame repaints when it
changes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

### Task 5: The chip in the foot

An opened chip shows the matrix that produced it, in the foot, which already shows the newest chronicle line and what the cursor is on.

**Files:**
- Modify: `src/ui/derive.js`, and `src/ui/panels.js`, which writes the foot (the two `$('foot')` lines near its end)
- Modify: `tests/ui.js`

**Interfaces:**
- Consumes `chipMatrix(key)` and `ui.timelineChip`.
- Produces `footChip()` in `derive.js`: `{ head, rows }` for the opened chip, or `null`. Pure, so it is tested without a DOM.

- [ ] **Step 1: Write the failing test**

Add to `tests/ui.js`:

```js
test('an opened chip says who weighed what, and what it took', () => {
  const api = loadUI(['state', 'derive'], ['footChip', 'ui', 'creation', 'startCreation', 'step']);
  api.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) api.step();
  assert.equal(api.footChip(), null, 'nothing is open');
  const rec = api.creation.choices.find(c => !c.continued && c.picked && c.opts.length > 1);
  api.ui.timelineChip = `${rec.age}:${rec.god}`;
  const f = api.footChip();
  assert.match(f.head, new RegExp(`Age ${rec.age}`));
  assert.match(f.head, new RegExp(rec.picked));
  assert.equal(f.rows.length, Math.min(4, rec.opts.length), 'at most four rows');
  assert.equal(f.rows[0].type, rec.opts[0].type, "in the record's own order");
  assert.equal(typeof f.rows[0].score, 'number');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ui.js`
Expected: FAIL. `footChip` is not a function.

- [ ] **Step 3: Write it**

In `src/ui/derive.js`, after `chipMatrix`:

```js
/* What the foot says about an opened chip. The head names the god, the age, and what it did. The rows
   are the matrix as the record holds it, at most four, so the foot stays shallow on a laptop. */
function footChip(){
  const m = chipMatrix(ui.timelineChip);
  if (!m) return null;
  const did = m.continued ? 'carries on' : m.picked ? `takes ${m.picked}` : 'finds nothing it can do';
  const hand = m.byPlayer ? ', by your hand' : '';
  return { head: `Age ${m.age}. ${m.name} ${did}${hand}.`,
    rows: m.opts.slice(0, 4).map(o => ({ type: o.type, score: o.score, failed: !!o.failed })) };
}
```

- [ ] **Step 4: Show it**

In `src/ui/panels.js`, where the foot is written, when `footChip()` returns something, show its head and its rows in place of the newest chronicle line, and keep showing what the cursor is on. A row reads as its act and its score; a failed row says the ground refused it. Follow the foot's existing way of writing text — if it writes an HTML string, every string still passes through `esc`.

- [ ] **Step 5: Run the tests and the gate**

Run: `node --test tests/ui.js && npm run fast && npm run soak`
Expected: PASS, golden record matched.

- [ ] **Step 6: Look at it**

Run `node serve.js`, watch a creation, click a chip, and read the foot. Say in the report whether it tells you why that god did what it did. That is the whole point of this slice, so say plainly if it does not.

- [ ] **Step 7: Build and commit**

```bash
node build.js
git add src/ui/derive.js src/ui/panels.js tests/ui.js dist/hearth-sim.html
git commit -m "Become E2.5: an opened chip tells the foot what that god weighed

The head names the god, the age, and what it did, and says when the hand was
the player's. The rows are the matrix as the record holds it, at most four, in
the record's own order. The view still neither sorts nor scores.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

### Task 6: The notes

**Files:**
- Modify: `design/notes.md`, section 13 (the interface) and section 18 (Become)

- [ ] **Step 1: Write it**

Add to section 13 a paragraph on the timeline: it is a third row of the app grid under the map; the foot did not move, because it is an overlay inside the map box and belongs to the map whose cursor it names; folded it is one row of the creation in age order and unfolded a row for each god and one for the rest gate; the zoom is on its own time axis; a chip opens the matrix that produced it in the foot; it builds nodes rather than markup. Add to section 18 that E2 built the record side.

- [ ] **Step 2: Say what is still missing**

The marks ahead of the now-line are not built. The reason is that `run` and `watch` refuse unless a god has been inhabited, and nothing can do that until E3. Say so plainly, so nobody reads the empty right-hand side as a bug.

- [ ] **Step 3: Commit**

```bash
git add design/notes.md
git commit -m "Become: the notes record the timeline

Where it sits, what it reads, and why the foot did not move. Also why the right
of the now-line is empty: the marks need a god to have been inhabited, and
nothing can do that until E3.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SRWSFkabqzfz1cs5RaStxv"
```

---

## What E2 does not build

| Left for | What |
|---|---|
| E3 | `Take a god` on the start dialog, the turn card, the rest gate in the strip, and the marks ahead of the now-line: a run and a stop, set through `run` and `watch`. |
| Later | Person-scale play, what a character knows, death and continuation, combat, and the three other inhabit modes. |

## The question to answer at the end

This slice exists to find out why the ages do not read. When it is built, watch a creation with the band open and say which of these is true:

1. The ages read now. The fault was that the player could not see what the gods weighed.
2. The ages read better, but something is still missing. Name it.
3. The ages still do not read. Then the fault is not legibility of the choices, and E3 should be re-thought before it is built.

Write the answer into `design/notes.md` section 18. It is the point of the slice, and it decides what E3 becomes.
