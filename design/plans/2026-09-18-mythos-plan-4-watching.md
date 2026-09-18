# Mythos Plan 4: Watching the Creation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The page shows the creation age by age, then opens the day-era interface at settle, and every hill, cave, scar, and country says which god made it and why.

**Architecture:** The interface gains an era switch. In the gods era the frame loop steps one age every two seconds, the world canvas draws the field instead of tiles, the People drawer lists the gods, and a new Legends drawer holds the creation chronicle in both eras. No file in `src/sim/` changes, so the soak golden cannot move. Every new decision is a pure function in `src/ui/derive.js`, tested in Node by `tests/ui.js`.

**Tech stack:** Plain scripts in one scope (`src/ui/`, joined by `src/ui/index.js`), node:test, `node build.js`, Safari through safari-mcp for the page check.

| Task | Delivers | Files |
|---|---|---|
| 1 | The Legends drawer, key `5`, in both eras | keys, state, derive, panels, windows, actions, template, tests |
| 2 | The view model holds in the ages; the gods are the people; the god card | state, derive, inspect, panels, windows, actions, tests |
| 3 | The loop: pace, hurry, the hold under a dialog, the flip at settle | state, derive, keys, actions, main, panels, strip, map, template, settings, tests |
| 4 | The field on the world map, the region card, the countries overlay | state, derive, keys, map, inspect, actions, main, panels, template, tests |
| 5 | Hover on marks in the days | derive, inspect, map, tests |
| 6 | The record: notes, spec, register, CLAUDE.md, and the page check | design, CLAUDE.md |

## Global Constraints

- Work in `/Users/earchibald/Worktrees/hamlet-mythos` on branch `mythos`. Never check out, stash, or commit in `~/Code/hamlet`.
- Do not edit any file in `src/sim/`. If a task seems to need a sim change, stop and report it.
- The session `feedback-pass` also edits `src/ui/`. Its branch may land in dev first. Every edit here is additive: add lines, add branches, add functions. Do not reflow, reorder, or restyle lines you do not need. Find each edit point by the function name or the quoted anchor text, never by line number.
- Do not read or write `tipPinned`. It is going away.
- Files in `src/ui/` are plain scripts in one scope. No `import`, no `export`.
- `derive.js` and `keys.js` touch no DOM. `tests/ui.js` loads them in Node.
- View state changes in `actions.js`. The recorded exceptions are the window drag handler, the palette's list state, and the cursor and hover set by the pointer handlers in `main.js`. The frame loop's own bookkeeping (`acc`, `last`, `lastEra`) stays in `main.js`.
- Game text is plain English, one idea per sentence.
- Every button in the template prints a key, and every keyed button has a `KEYMAP` row. `tests/ui.js` checks both.
- After every change to `src/`: `node build.js`. After every change to `src/ui/`: `node --test tests/ui.js`. Before each commit: `npm run fast`.
- The soak golden must not move. Run `node tests/soak.js` once, in task 6. Do not bless.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```

## Decisions this plan makes

| Question | Decision |
|---|---|
| Do pace and hurry pass the door? | No. They change how fast the story is watched, not the story. A creation watched age by age equals the one `startWorld` runs; task 3 tests this. The register records it. A player god's act will need the age in the stamp; that stays an idea. |
| What is the pace control? | The four speed buttons. In the gods era they set `pace`; in the days they set `speed`. Pace 1 is one age in 2000 ms. `pace` is not persisted, and a new world always starts at pace 1. |
| Do the ages run behind the start dialog? | No. The ages wait while any dialog is open. The days keep their present behaviour. |
| Which god "made" a country? | The god of the country's newest pole mark. |
| How is an age named on a card? | As the chronicle names it: `Before time`, then `Age N` counted from the Pulse. `ageName(n)` does this from a mark's absolute age. |

## What the sim already gives (read, do not change)

- `era` is `'gods'` or `'days'`. `age`, `pulseAge`, `legends` (never trimmed; each line is `{ tick, when, text, kind, age }`), `creation` (`{ ages, backstops, discards, settled, failed, gate, made }`).
- `startCreation(seed, opts)` resets the world and begins the ages without running them. `step()` runs one age in the gods era and one tick in the days. `runAges()` steps until the era is `'days'`.
- In the gods era `world`, `levels`, `sectors`, `hills`, `caves`, and `groves` are **undefined**. `camps` holds one camp with no site. `beings` holds only gods. A god has `x = 0, y = 0`.
- `field`, `liveRegions()`, `liveBoundaries()`, `regionById(id)`, `regionAt(x, y)`, `marksOf(r, kind)`, `hasPole(r, pole)`, `biomeOf(r)`, `SECTOR_AREA`. A region is `{ id, tiles, area, bbox: { x0, y0, x1, y1 }, marks, children }`. A mark is `{ kind, value, by, age, why, at }`. A boundary is `{ a, b, tiles, by, pole, age }`. The field stays after settle.
- `gods()`, `awakeGods()`. A god has `name, epithet, pole, contrast, status ('awake' | 'asleep' | 'dead'), born, sleptAt, region, needs { expression, company, rest, calm }, thoughts, opinions { id: n }, lastChoice { opts: [{ type, label, score, region, failed }], picked }, task, history, body`.
- After settle: a hill has `mark` and may have `god`; a cave has `mark` and may have `god`; a sector has `country` (a region id); a region may have `god` when it is a god's body. `t.hill` is the hill record on a hill tile. `t.cave` and `t.mouth` are the cave record.
- `firstPerson()`, `beingById(id)`, `BODY`, `SPECIES`.

---

### Task 1: The Legends drawer

**Files:**
- Modify: `src/ui/keys.js` (the `DRAWERS` table)
- Modify: `src/ui/state.js` (`ui.row`)
- Modify: `src/ui/derive.js` (`drawerRows`)
- Modify: `src/ui/panels.js` (a renderer, one renderer table)
- Modify: `src/ui/windows.js` (use the renderer table)
- Modify: `src/ui/actions.js` (`rowOpen`)
- Modify: `src/page.template.html` (styles)
- Test: `tests/ui.js`

**Interfaces:**
- Produces: `drawerRows('legends')` returns `[{ kind: 'legend', id: <index>, e: <legend line> }]`, oldest first. `DRAWER_RENDER` in `panels.js` maps a drawer id to its renderer. `renderLegends(el)`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/ui.js`, before any `module.exports` line if one exists, else at the end.

```js
test('the legends drawer lists every line of the creation, oldest first', () => {
  const api = loadUI(['state', 'derive', 'keys'], [...DERIVE, 'DRAWERS']);
  api.startWorld('alpha'); api.camp = api.camps[0];
  const rows = api.drawerRows('legends');
  assert.equal(rows.length, api.legends.length);
  assert.ok(rows.length > 20, `only ${rows.length} legends`);
  assert.ok(rows.every(r => r.kind === 'legend'));
  assert.match(rows[0].e.text, /formless/);
  assert.deepEqual(api.DRAWERS.map(d => d.key), ['1', '2', '3', '4', '5']);
  assert.equal(api.DRAWERS[4].id, 'legends');
  assert.equal(api.ui.row.legends, 0);
});
```

Also add `'tab-legends'` to the `RUNTIME` array in `tests/ui.js`.

- [ ] **Step 2: Run the test and see it fail.**

Run: `node --test tests/ui.js 2>&1 | tail -20`
Expected: the new test fails, because `drawerRows('legends')` returns `[]`.

- [ ] **Step 3: Add the drawer to the table.** In `src/ui/keys.js`, add one entry at the end of `DRAWERS`. Give it no `fit` key.

```js
  { id: 'legends',   label: 'Legends',   key: '5' },
```

- [ ] **Step 4: Add the row counter.** In `src/ui/state.js`, in the `ui` object, the `row` entry gains `legends: 0`:

```js
  row: { people: 0, goals: 0, chronicle: 0, camp: 0, legends: 0 }, /* the focused row per drawer */
```

- [ ] **Step 5: Add the rows.** In `src/ui/derive.js`, in `drawerRows`, add this line before the final `return [];`:

```js
  if (id === 'legends') return legends.map((e, i) => ({ kind: 'legend', id: i, e }));
```

- [ ] **Step 6: Add the renderer and the one renderer table.** In `src/ui/panels.js`, add after `renderCamp`:

```js
/* The creation, by age, oldest first. The sim never trims it, so it never scrolls off. It rebuilds only when a
   line arrives, the world is new, or the cursor moves. */
function renderLegends(el){
  const key = seedText + ':' + legends.length + ':' + (focusedDrawer() === 'legends' ? ui.row.legends : -1);
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  const rows = drawerRows('legends');
  const c = $('count-legends'); if (c) c.textContent = ` · ${rows.length}`;
  let when = null;
  el.innerHTML = rows.length ? `<ol id="legends">${rows.map((r, i) => {
    const head = r.e.when !== when ? `<li class="age">${r.e.when}</li>` : ''; when = r.e.when;
    return `${head}<li class="k-${r.e.kind} ${rowClass('legends', i)}" data-i="${i}">${r.e.text}</li>`;
  }).join('')}</ol>` : '<div class="muted">Nothing is told yet.</div>';
}
/* One table from a drawer id to its renderer. The docked drawers and the drawer windows both read it. */
const DRAWER_RENDER = { people: renderPeople, goals: renderGoals, chronicle: renderChronicle, camp: renderCamp, legends: renderLegends };
```

In `renderDrawers`, replace only the object literal in the renderer line with the table:

```js
    DRAWER_RENDER[id](el);
```

In `src/ui/windows.js`, in `renderWindows`, do the same:

```js
    if (w.kind === 'drawer') DRAWER_RENDER[w.target](body, w.target);
```

- [ ] **Step 7: Open a legend row.** In `src/ui/actions.js`, in `rowOpen`, add a branch after the `r.kind === 'stage'` branch:

```js
  /* A legend opens the first god it names. */
  else if (r.kind === 'legend'){ const g = gods().find(g => r.e.text.includes(g.name)); if (g) ACTIONS.inspect(g.id); }
```

- [ ] **Step 8: Add the styles.** In `src/page.template.html`, after the `#chronicle .when{...}` rule:

```css
#legends{list-style:none;margin:0;padding:0}
#legends li{padding:3px 0;border-bottom:1px solid var(--line);font-size:13px}
#legends li.sel{background:color-mix(in srgb,var(--accent) 14%,transparent)}
#legends li.age{border-bottom:0;padding-top:9px;color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
```

- [ ] **Step 9: Run the tests.**

Run: `node build.js && node --test tests/ui.js 2>&1 | tail -8`
Expected: every test passes.

- [ ] **Step 10: Commit.**

```bash
npm run fast 2>&1 | tail -5
git add -A && git commit -m "The Legends drawer: the creation by age, on key 5, never trimmed"
```

---

### Task 2: The view model in the ages

**Files:**
- Modify: `src/ui/state.js` (`NEED_LABEL`)
- Modify: `src/ui/derive.js` (guards, new pure functions)
- Modify: `src/ui/inspect.js` (`inspectGod`)
- Modify: `src/ui/panels.js` (`renderPeople`, `renderGoals`, `renderCamp`)
- Modify: `src/ui/windows.js` (`winTitle`)
- Modify: `src/ui/actions.js` (`ACTIONS.inspect`)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `drawerRows`, `DRAWER_RENDER` from task 1.
- Produces, all in `derive.js`, all pure:
  - `inAges()` returns `era === 'gods'`.
  - `ageName(n)` returns `'Before time'` or `'Age N'`.
  - `nOf(n, one, many)` returns `'1 god'` or `'3 gods'`.
  - `standsIn(g)` returns the live region a god stands in, or null. It does not change the god.
  - `countryLine(r)` returns one phrase for a region.
  - `godRows()` returns `[{ a, m, trouble, status }]`, the same shape as `peopleRows()`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/ui.js`:

```js
const AGES = [...DERIVE, 'inAges', 'ageName', 'nOf', 'standsIn', 'countryLine', 'godRows', 'cursorPhrase', 'paletteRows'];
function inTheAges(seed = 'alpha', n = 6){
  const api = loadUI(['state', 'derive', 'keys', 'map', 'inspect'], [...AGES, 'inspectGod']);
  api.startCreation(seed, {}); api.camp = api.camps[0];
  for (let i = 0; i < n; i++) api.step();
  assert.equal(api.era, 'gods', 'the probe must still be in the ages');
  return api;
}

test('in the ages the view model holds: no gauges, no chips, no goals, and the gods are the people', () => {
  const api = inTheAges();
  assert.equal(api.inAges(), true);
  assert.deepEqual(api.gauges(), { hearth: null, food: null, water: null, beds: null });
  assert.deepEqual(api.alerts(), []);
  assert.deepEqual(api.drawerRows('goals'), []);
  const people = api.drawerRows('people');
  assert.equal(people.length, api.gods().length);
  assert.ok(people.every(r => r.kind === 'person' && r.r.a.species === 'god'));
  assert.doesNotThrow(() => api.notePulses());
  assert.doesNotThrow(() => api.paletteRows());
  assert.match(api.seasonLine(), /countr/);
  assert.equal(typeof api.cursorPhrase(), 'string');
});

test('in the ages the view key moves with the age and holds still between', () => {
  const api = inTheAges(); const k = api.viewKey();
  assert.equal(api.viewKey(), k);
  api.step(); assert.notEqual(api.viewKey(), k);
});

test('ageName counts from the Pulse, standsIn finds a live country and changes nothing, countryLine names the god', () => {
  const api = inTheAges('alpha', 8);
  assert.equal(api.ageName(0), 'Before time');
  assert.equal(api.ageName(api.pulseAge), 'Age 1');
  assert.equal(api.nOf(1, 'god', 'gods'), '1 god'); assert.equal(api.nOf(3, 'god', 'gods'), '3 gods');
  const g = api.gods().find(g => g.status === 'awake'), before = g.region, r = api.standsIn(g);
  assert.ok(r && !r.children, 'a live region');
  assert.equal(g.region, before, 'standsIn must not move the god');
  const made = api.liveRegions().find(q => q.marks.some(m => m.kind === 'pole'));
  assert.ok(api.gods().some(q => api.countryLine(made).includes(q.name)), api.countryLine(made));
});

test('the god card shows the needs, the thoughts, the opinions, and the last decision while the god is awake', () => {
  const api = inTheAges('alpha', 8);
  const html = api.inspectGod(api.gods().find(g => g.status === 'awake'));
  for (const word of ['Expression', 'Company', 'Rest', 'Calm', 'Thoughts', 'Opinions', 'Last decision']) assert.ok(html.includes(word), `the card lacks ${word}`);
});

test('after settle the view model is the day-era one again', () => {
  const api = loadUI(['state', 'derive', 'keys'], AGES);
  api.startWorld('alpha'); api.camp = api.camps[0];
  assert.equal(api.inAges(), false);
  assert.equal(api.drawerRows('people').length, 1);
  assert.equal(api.drawerRows('goals')[0].kind, 'stage');
});
```

- [ ] **Step 2: Run and see them fail.**

Run: `node --test tests/ui.js 2>&1 | tail -30`
Expected: the five new tests fail. The first fails with a TypeError, because `gauges()` reads a camp with no pit and `alerts()` reads `groves`, which is undefined.

- [ ] **Step 3: Add the labels.** In `src/ui/state.js`, `NEED_LABEL` gains three keys. `rest` is already there.

```js
const NEED_LABEL = { food: 'Food', water: 'Water', rest: 'Rest', social: 'Company', warmth: 'Warmth', glow: 'Glow', play: 'Mischief', expression: 'Expression', company: 'Company', calm: 'Calm' };
```

- [ ] **Step 4: Add the pure functions.** In `src/ui/derive.js`, directly after the `level3` line at the top:

```js
/* ---- the ages ---- In the gods era there are no tiles, no sectors, no hills, and no people. Everything below
   that reads the valley asks inAges() first. */
const inAges = () => era === 'gods';
/* An age as the chronicle names it. A mark holds the absolute age; the telling counts from the Pulse. */
const ageName = n => pulseAge === null || n < pulseAge ? 'Before time' : `Age ${n - pulseAge + 1}`;
const nOf = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/* The live region a god stands in. The sim's settleHome does the same walk and moves the god; this one only looks. */
function standsIn(g){
  let r = g.region === null || g.region === undefined ? null : regionById(g.region);
  while (r && r.children){ const kids = r.children.map(regionById); r = kids.find(k => hasPole(k, g.pole)) || kids[0]; }
  return r || null;
}
/* One phrase for a country: its poles, and the god of its newest pole mark. */
function countryLine(r){
  if (!r) return 'no country';
  const poles = marksOf(r, 'pole');
  if (!poles.length) return 'formless, not yet anything';
  const m = poles.slice().sort((p, q) => q.age - p.age)[0], g = m.by === null ? null : beingById(m.by);
  return `a country that is ${poles.map(p => p.value).join(' and ')}${g ? `, made so by ${g.name} ${g.epithet}` : ''}`;
}
/* The gods, in the shape peopleRows gives, so the People drawer can list them. The bar is the god's rest. */
function godRows(){
  return gods().map(g => ({ a: g, m: g.needs.rest, trouble: g.status === 'awake' && g.needs.calm < 20,
    status: g.status === 'dead' ? 'Unmade' : g.status === 'asleep' ? 'Asleep' : g.task ? `Awake: ${g.task.type}` : g.lastChoice && g.lastChoice.picked ? `Awake: ${g.lastChoice.picked}` : 'Awake' }));
}
```

- [ ] **Step 5: Guard the day-era readers.** All in `src/ui/derive.js`. Each edit adds a first line or a branch; nothing else in the function changes.

`gauges()`, new first line:
```js
  if (inAges()) return { hearth: null, food: null, water: null, beds: null };
```
`alerts()`, new first line:
```js
  if (inAges()) return [];
```
`notePulses()`, new first line:
```js
  if (inAges()){ ui.pulses = []; return; }
```
`seasonLine()`, new first line:
```js
  if (inAges()) return `${nOf(liveRegions().length, 'country', 'countries')}, ${nOf(awakeGods().length, 'god', 'gods')} awake`;
```
`drawerRows(id)`: the people line becomes
```js
  if (id === 'people') return (inAges() ? godRows() : peopleRows()).map(r => ({ kind: 'person', id: r.a.id, r }));
```
and the goals branch gains a first statement inside its braces:
```js
    if (inAges()) return [];
```
`viewKey()`, new first line:
```js
  if (inAges()) return ['ages', age, legends.length, creation.discards, gods().map(g => g.id + g.status).join('|'), ui.open.join(''), ui.focus, JSON.stringify(ui.row), ui.chronFilter, cursor.x, cursor.y].join('#');
```
`cursorPhrase()`, new first line:
```js
  if (inAges()) return countryLine(regionAt(cursor.x, cursor.y));
```
`paletteRows()`: wrap the dynamic rows that read the valley. The rows for `campHumans()`, `GOALS`, `camps`, `sectors`, and `STAGES` go inside one `if (!inAges()){ ... }` block. Leave the `alerts()` row and the `ui.mutes` row outside it. Then add the gods, in both eras, after that block:
```js
  for (const g of gods()) out.push({ label: `Inspect ${g.name} ${g.epithet}`, key: '', action: 'inspect', arg: g.id, group: 9 });
```

- [ ] **Step 6: Give the god its card.** In `src/ui/inspect.js`, replace the body of `inspectGod(g)` with this. The comment above the function stays.

```js
function inspectGod(g){
  const need = (k, v) => `<div class="need"><span>${NEED_LABEL[k]}</span>${bar(v, needColor(v))}<span class="num">${Math.round(v)}</span></div>`;
  let where;
  if (g.status === 'dead') where = 'Unmade. Nothing on the field was its pole any more.';
  else if (inAges() || g.status === 'awake') where = `${g.status === 'awake' ? 'Awake' : 'Asleep'} since ${ageName(g.status === 'awake' ? g.born : g.sleptAt || g.born).toLowerCase()}. It stands in ${countryLine(standsIn(g))}.`;
  else { const s = secOf(g.x, g.y); where = `Asleep since ${ageName(g.sleptAt || g.born).toLowerCase()}. ${g.name} lies down and is ${BODY[g.pole]}, in the ${sectors[secIdx(s.sx, s.sy)].name.toLowerCase()} at ${g.x - s.sx * LW},${g.y - s.sy * LH}.`; }
  const thoughts = g.thoughts.slice().sort((x, y) => Math.abs(y.value) - Math.abs(x.value)).slice(0, 4).map(t => `<li class="${t.value >= 0 ? 'pos' : 'neg'}"><b>${t.value > 0 ? '+' : ''}${t.value}</b> ${t.text}</li>`).join('') || '<li class="muted">No strong thoughts right now.</li>';
  const opinions = Object.entries(g.opinions || {}).map(([id, v]) => { const o = beingById(Number(id)); return o ? `${o.name} (${v > 0 ? '+' : ''}${v})` : ''; }).filter(Boolean).join(', ') || 'No opinion of another god yet.';
  /* Several options share an act, one per country. Only the first that did not fail is the one picked. */
  let marked = false;
  const why = g.lastChoice && g.lastChoice.opts.length ? `<div class="why">${g.lastChoice.opts.slice(0, 6).map(o => { const on = !marked && !o.failed && o.type === g.lastChoice.picked; if (on) marked = true; return `<span class="${on ? 'picked' : o.failed ? 'failed' : ''}">${o.label} ${o.score}</span>`; }).join('')}</div>` : '<span class="muted">No decision yet.</span>';
  const said = g.history.slice(0, 8).map(e => `<li><span class="muted">${e.when}</span> ${e.text}</li>`).join('');
  return `<div class="head"><strong style="color:${beingColor(g)}">${g.name}</strong><span>${g.epithet}</span></div>
    <div class="muted" style="margin:1px 0 5px">A primal god of the ${g.contrast}, ${g.pole}. ${where}</div>
    ${g.status === 'dead' ? '' : Object.entries(g.needs).map(([k, v]) => need(k, v)).join('')}
    <h3>Thoughts</h3><ul>${thoughts}</ul>
    <h3>Opinions</h3><div class="muted">${opinions}</div>
    <h3>Last decision (highest score wins)</h3>${why}
    ${said ? `<h3>What the legends say</h3><ul class="hist">${said}</ul>` : ''}`;
}
```

- [ ] **Step 7: Make the People and Goals renderers hold.** In `src/ui/panels.js`:

In `renderPeople`, a god has no life stage. Change only the `st` expression and the empty text:
```js
  el.innerHTML = rows.map((r, i) => { const a = r.r.a, st = a.species === 'god' ? 'adult' : stage(a);
```
and the fallback at the end of that statement becomes
```js
  || `<div class="muted">${inAges() ? 'No god yet.' : 'Nobody yet.'}</div>`;
```
In `renderGoals`, add after the `count-goals` line:
```js
  if (inAges()){ el.innerHTML = '<div class="muted">No goals yet. The valley is not made.</div>'; return; }
```
In `renderCamp`, add a first line. The sim holds an empty camp record through the ages, and it is not a camp yet:
```js
  if (inAges()){ const n = $('count-camp'); if (n) n.textContent = ''; el.innerHTML = '<div class="muted">No camp yet. The valley is not made.</div>'; return; }
```

- [ ] **Step 8: Fix the god's window title.** In `src/ui/windows.js`, in `winTitle`, the being branch prints a mood word for a god ("Orun Content"). A god has a status, not a mood:

```js
  if (w.target.being != null){ const a = beingById(w.target.being); return a ? `${a.name} <span class="k">${a.species === 'god' ? a.status : moodWord(a, mood(a))}</span>` : 'Gone'; }
```

- [ ] **Step 9: Do not send the cursor to a god with no place.** In `src/ui/actions.js`, in `ACTIONS.inspect`, the call `cursorTo(a.x, a.y, a.z);` becomes:

```js
if (!inAges()) cursorTo(a.x, a.y, a.z);
```

- [ ] **Step 10: Run the tests.**

Run: `node build.js && node --test tests/ui.js 2>&1 | tail -8`
Expected: every test passes.

- [ ] **Step 11: Commit.**

```bash
npm run fast 2>&1 | tail -5
git add -A && git commit -m "The view model in the ages: no valley is read before it is made, and the gods are the people"
```

---

### Task 3: The loop: pace, hurry, and the flip at settle

**Files:**
- Modify: `src/ui/state.js` (three new lines)
- Modify: `src/ui/derive.js` (`agesDue`)
- Modify: `src/ui/keys.js` (one row)
- Modify: `src/ui/actions.js` (`setPace`, `setView`, `goto`, `cycleView`, `newWorld`, `onSettle`, five actions)
- Modify: `src/ui/main.js` (`frame`, two handlers, one listener)
- Modify: `src/ui/panels.js` (`renderUI`)
- Modify: `src/ui/strip.js` (`renderStrip`)
- Modify: `src/ui/map.js` (`drawWorld`, a holding branch)
- Modify: `src/page.template.html` (one button)
- Modify: `design/settings.md` (two lines)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `inAges()`, `seasonLine()` from task 2.
- Produces: `pace` (1, 4, 16, or 64), `lastEra`, `AGE_MS = 2000`, `agesDue(acc, dt, pace)` returning `{ n, acc }`, `setPace(p)`, `onSettle()`, `ACTIONS.hurry`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/ui.js`:

```js
test('ages come due one in two seconds at pace 1, and never more than eight in a frame', () => {
  const api = loadUI(['state', 'derive'], ['agesDue', 'AGE_MS']);
  assert.equal(api.AGE_MS, 2000);
  assert.deepEqual(api.agesDue(0, 1000, 1), { n: 0, acc: 0.5 });
  assert.deepEqual(api.agesDue(0.5, 1000, 1), { n: 1, acc: 0 });
  assert.deepEqual(api.agesDue(0, 250, 16), { n: 2, acc: 0 });
  assert.deepEqual(api.agesDue(0, 250, 1000), { n: 8, acc: 0 });
});

test('H hurries the ages from any focus', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  const e = { key: 'h', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
  assert.equal(api.keyAction(e, 'map').action, 'hurry');
  assert.equal(api.keyAction(e, 'drawer:people').action, 'hurry');
  assert.equal(typeof api.ACTIONS.hurry, 'function');
});

test('a creation watched age by age is the creation that startWorld runs', () => {
  const a = sim.load(), b = sim.load();
  a.startWorld('gamma');
  b.startCreation('gamma', {}); let n = 0; while (b.era === 'gods' && n++ < 1000) b.step();
  assert.equal(b.era, 'days');
  assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
  const pa = a.firstPerson(), pb = b.firstPerson();
  assert.deepEqual([pb.x, pb.y, pb.name], [pa.x, pa.y, pa.name]);
  assert.equal(b.tick, a.tick);
});
```

- [ ] **Step 2: Run and see them fail.**

Run: `node --test tests/ui.js 2>&1 | tail -30`
Expected: the first two fail (`agesDue` is not defined; `keyAction` returns null). The third passes already. It stays as the guard on the decision that pace and hurry do not pass the door.

- [ ] **Step 3: Add the state.** In `src/ui/state.js`, add these as new lines after the line that declares `speed` and `paused`. Do not edit that line.

```js
/* The ages. pace is the speed of the gods era: 1, 4, 16, or 64 ages in AGE_MS. It is not saved; a new world starts at 1.
   lastEra is the era the last frame saw, so the frame can see the flip at settle. */
const AGE_MS = 2000;
let pace = 1, lastEra = 'days';
```

- [ ] **Step 4: Add the pure step counter.** In `src/ui/derive.js`, after `godRows`:

```js
/* How many ages a frame owes. acc is the part of an age carried from the last frame. At most eight in a frame. */
function agesDue(acc, dt, pace){
  const a = acc + dt * pace / AGE_MS, n = Math.floor(a);
  return n > 8 ? { n: 8, acc: 0 } : { n, acc: a - n };
}
```

- [ ] **Step 5: Add the key.** In `src/ui/keys.js`, add to `KEYMAP` after the `hour` row:

```js
  { key: 'h',          focus: 'any',    action: 'hurry',       label: 'Hurry the ages to the valley', button: 'hurryBtn' },
```

- [ ] **Step 6: Add the button.** In `src/page.template.html`, after the `hourBtn` button:

```html
      <button class="btn" id="hurryBtn" hidden>Hurry<kbd>H</kbd></button>
```

- [ ] **Step 7: Change the actions.** All in `src/ui/actions.js`.

Add after `setSpeed`:
```js
function setPace(p){ pace = p; document.querySelectorAll('#speeds .btn').forEach(b => b.classList.toggle('on', Number(b.dataset.speed) === p)); }
```
`setView(v, s)`, new first line (the location view is closed until settle):
```js
  if (inAges()) v = 'world';
```
`goto(sx, sy)`, new first statement:
```js
  if (inAges()) return;
```
`cycleView()` becomes:
```js
function cycleView(){ if (inAges()){ say('The valley is not made yet. There is only the field.'); return; } followId = null; setView(NEXT_VIEW[view]); }
```
In `newWorld(seed)`, `startWorld(seed, {});` becomes `startCreation(seed, {});`. The tail of the function, from `const a = firstPerson();` to the end, becomes:
```js
  lastEra = 'gods'; setPace(1); setPaused(false); setView('world');
```
Keep everything between those two edits as it is.

Add after `newWorld`:
```js
/* The flip. The frame calls this once, in the first frame that sees the days after the ages. */
function onSettle(){
  acc = 0; worldDirty = 0; viewCamp = camps[0]; camp = camps[0]; ui.seenTick = -1; ui.lastStates = {}; ui.pulses = [];
  setSpeed(ui.savedSpeed || 1);
  const a = firstPerson();
  if (a){ cursor = { x: a.x, y: a.y, z: a.z }; setView('loc', secOf(a.x, a.y)); } else setView('world');
  say(creation.failed ? 'The gods sleep unfinished. The valley is what it is.' : 'The gods sleep. The valley is made, and one person wakes in it.');
}
```
In `ACTIONS`, change four entries and add one:
```js
  hour(){ if (inAges()){ say('There are no hours yet. Step moves one age.'); return; } setPaused(true); for (let k = 0; k < Math.round(DAY / 24); k++) step(); renderUI(true); },
  slower(){ const v = inAges() ? pace : speed, s = v === 64 ? 16 : v === 16 ? 4 : 1; if (inAges()) setPace(s); else setSpeed(s); setPaused(false); },
  faster(){ const v = inAges() ? pace : speed, s = v === 1 ? 4 : v === 4 ? 16 : 64; if (inAges()) setPace(s); else setSpeed(s); setPaused(false); },
  speed(s){ if (inAges()) setPace(s); else setSpeed(s); setPaused(false); },
  hurry(){ if (!inAges()){ say('The valley is already made.'); return; } runAges(); renderUI(true); },
```
`ACTIONS.chord` gains a guard:
```js
  chord(){ if (inAges()){ say('No goals yet. The valley is not made.'); return; } openChord(); },
```

- [ ] **Step 8: Change the frame.** In `src/ui/main.js`, in `frame(now)`, the line that begins `if (!paused){ acc += dt * TPS * speed / 1000;` becomes these lines. The day-era arithmetic is unchanged.

```js
  if (!paused){
    /* The ages wait while a dialog is open, so the creation does not pass behind the start dialog. */
    if (inAges()){ if (!anyDialogOpen()){ const d = agesDue(acc, dt, pace); acc = d.acc; for (let k = 0; k < d.n && inAges(); k++) step(); } }
    else { acc += dt * TPS * speed / 1000; let n = 0; while (acc >= 1 && n < 200){ step(); acc--; n++; } if (n >= 200) acc = 0; }
  }
  if (lastEra === 'gods' && !inAges()) onSettle();
  lastEra = era;
```
In `initUI`, add after the `hourBtn` listener:
```js
  $('hurryBtn').addEventListener('click', ACTIONS.hurry);
```
In the `wcv` `pointermove` and `pointerdown` handlers, add a first statement to each (task 4 replaces these two guards with the region card):
```js
if (inAges()) return;
```
For the arrow-function handlers that have no braces, add braces.

- [ ] **Step 9: Make renderUI and the strip hold.** In `src/ui/panels.js`, in `renderUI`, the two lines that read `sectors` become era-aware, and the era's buttons are set. Replace the `const s = sectors[...]` line and the `$('where').textContent = ...` line with:

```js
  const s = inAges() ? null : sectors[secIdx(cur.sx, cur.sy)];
  $('where').textContent = inAges() ? `The field · ${seasonLine()}` : view === 'world' ? `World map · ${camps.length} camp${camps.length > 1 ? 's' : ''}` : view === 'mid' ? `Around ${s.name}, sector ${s.sx},${s.sy}` : `${s.name}, sector ${s.sx},${s.sy} · ${levelName(lvl)}`;
  $('hurryBtn').hidden = !inAges(); $('hourBtn').disabled = inAges(); $('viewBtn').disabled = inAges(); $('chordBtn').disabled = inAges();
```
The nav loop below it already runs only when `view !== 'world'`, and `setView` holds the view at `'world'` in the ages, so it needs no guard.

In `src/ui/strip.js`, in `renderStrip`, the camp name line becomes:
```js
  $('campName').textContent = inAges() ? 'The ages' : camp.name;
```

- [ ] **Step 10: Hold the world canvas.** In `src/ui/map.js`, `drawWorld()` gains a first line. Task 4 replaces it with the field.

```js
  if (inAges()){ wctx.setTransform(dpr, 0, 0, dpr, 0, 0); wctx.fillStyle = P.hill; wctx.fillRect(0, 0, W * WS, H * WS); return; }
```

- [ ] **Step 11: Record the decision.** In `design/settings.md`, replace two rows:

```markdown
| Pace of the ages, hurry to settle | mythos, section 6 | in UI | The speed buttons set `pace` in the gods era: 1, 4, 16, or 64 ages in two seconds. `H` runs to settle. Pace is not saved; a new world starts at 1. The ages wait while a dialog is open. runAges(max) runs to settle in Node. |
| God-era events at the door | mythos, section 0 | idea | Decided in plan 4: pace and hurry are view state and do not pass the door, because a creation watched age by age equals the one startWorld runs (tests/ui.js holds this). The door stamps tick, and the ages do not advance it. A player god's act through the door will need the age in the stamp. |
```

- [ ] **Step 12: Run the tests.**

Run: `node build.js && node --test tests/ui.js 2>&1 | tail -8`
Expected: every test passes. The two template tests pass because `hurryBtn` prints `H` and has a `KEYMAP` row.

- [ ] **Step 13: Check the page.** The dev server runs on port 8702 and serves this worktree. With safari-mcp, open `http://localhost:8702/` and evaluate:

```js
JSON.stringify({ era, age, pace, view, hurryHidden: document.getElementById('hurryBtn').hidden, where: document.getElementById('where').textContent, camp: document.getElementById('campName').textContent })
```
Expected: `era` is `'gods'`, `view` is `'world'`, `hurryHidden` is false, `camp` is `The ages`. Safari does not run animation frames in a background tab, so `age` may be 0. Then evaluate `ACTIONS.hurry(); frame(performance.now()); JSON.stringify({ era, view, people: beings.filter(b => b.species === 'human').length })`. Expected: `era` is `'days'`, `view` is `'loc'`, `people` is 1. Read the console: no errors. Put what you saw in the report.

- [ ] **Step 14: Commit.**

```bash
npm run fast 2>&1 | tail -5
git add -A && git commit -m "The ages on the page: one age in two seconds, a pace, a hurry, and the day interface opens at settle"
```

---

### Task 4: The field on the world map

**Files:**
- Modify: `src/ui/state.js` (`ui.overlay`, `fieldKey`)
- Modify: `src/ui/derive.js` (`mixHex`, `fieldColor`, `viewKey`)
- Modify: `src/ui/keys.js` (one row)
- Modify: `src/ui/map.js` (`readPalette`, `drawFieldCache`, `drawField`, `drawWorld`)
- Modify: `src/ui/inspect.js` (`inspectRegion`, `renderTip`)
- Modify: `src/ui/actions.js` (`applyAt`, `ACTIONS.overlay`, `tileFromWorld`)
- Modify: `src/ui/main.js` (the two `wcv` handlers, one listener)
- Modify: `src/ui/panels.js` (`renderUI`)
- Modify: `src/page.template.html` (colours, one button)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `inAges`, `ageName`, `standsIn`, `countryLine`, `nOf` from task 2.
- Produces: `mixHex(list)`, `fieldColor(r, pal)`, `inspectRegion(r)`, `ui.overlay`, `ACTIONS.overlay`, `tileFromWorld(e)`. A tip target may now be `{ region: <id> }`.

The spec's order is: one grey region, then boundaries, then poles as colour, then scars. A region with no pole is grey. A region's colour is the mean of its poles' colours. A boundary is a dark line; a wet boundary is a water line. A scarred region is hatched.

- [ ] **Step 1: Write the failing tests.** Append to `tests/ui.js`:

```js
const PAL = { 'field-none': '#808080', 'field-wet': '#0000ff', 'field-dry': '#ffff00', 'field-hot': '#ff0000', 'field-cold': '#00ffff', 'field-above': '#ffffff', 'field-below': '#000000', 'field-light': '#ffffff', 'field-dark': '#000000', 'field-still': '#00ff00', 'field-moving': '#ff00ff' };

test('the field colour is grey with no pole, and the mean of the poles with some', () => {
  const api = loadUI(['state', 'derive'], ['mixHex', 'fieldColor']);
  assert.equal(api.mixHex(['#000000', '#ffffff']), 'rgb(128,128,128)');
  assert.equal(api.mixHex(['#ff0000']), 'rgb(255,0,0)');
  api.startCreation('alpha', {});
  assert.equal(api.fieldColor(api.liveRegions()[0], PAL), '#808080', 'the formless is grey');
  for (let i = 0; i < 8; i++) api.step();
  const made = api.liveRegions().filter(r => r.marks.some(m => m.kind === 'pole'));
  assert.ok(made.length >= 2);
  for (const r of made) assert.match(api.fieldColor(r, PAL), /^rgb\(\d+,\d+,\d+\)$/);
});

test('the region card names the country, what it is becoming, and every reason a god left on it', () => {
  const api = loadUI(['state', 'derive', 'keys', 'map', 'inspect'], ['inspectRegion']);
  api.startCreation('alpha', {}); for (let i = 0; i < 10; i++) api.step();
  const r = api.liveRegions().slice().sort((p, q) => q.marks.length - p.marks.length)[0];
  const html = api.inspectRegion(r);
  assert.ok(html.includes('Country') && html.includes('Becoming'));
  assert.ok(r.marks.every(m => html.includes(m.why)), 'every why is on the card');
});

test('C shows and hides the countries from any focus', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...KEYS, 'ui']);
  const e = { key: 'c', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
  assert.equal(api.keyAction(e, 'map').action, 'overlay');
  assert.equal(api.keyAction(e, 'dialog:chord').action, 'stage', 'under the chord, C is still Crafts');
  assert.equal(api.ui.overlay, false);
});
```

- [ ] **Step 2: Run and see them fail.**

Run: `node --test tests/ui.js 2>&1 | tail -30`
Expected: the three new tests fail with "is not defined" or a null action.

- [ ] **Step 3: Add the state.** In `src/ui/state.js`, in the `ui` object add:
```js
  overlay: false,      /* the countries drawn over the world map in the days */
```
and as a new line after the `pace` line:
```js
let fieldKey = '';     /* what the cached field was drawn from */
```

- [ ] **Step 4: Add the colours.** In `src/page.template.html`, the `:root` block gains one line of light-theme values. The dark block under `@media (prefers-color-scheme: dark)` and the `:root[data-theme="dark"]` block each gain the dark line. Every value is a six-digit hex, because `mixHex` parses hex.

Light:
```css
  --field-none:#b9b6ae; --field-wet:#6fa3c7; --field-dry:#d9c48a; --field-hot:#d9824a; --field-cold:#a9c4d6; --field-above:#e6e1d6; --field-below:#6b6458; --field-light:#f2e9b8; --field-dark:#4a4f6a; --field-still:#9fb8a8; --field-moving:#c7b7d9; --field-scar:#7a2f2f; --field-line:#1b2631;
```
Dark, in both dark blocks:
```css
  --field-none:#4a4640; --field-wet:#2f6f9e; --field-dry:#8a7a45; --field-hot:#b0562a; --field-cold:#5d8296; --field-above:#8f897c; --field-below:#26221d; --field-light:#b8a85a; --field-dark:#1c2038; --field-still:#4f6a5a; --field-moving:#6f5f8a; --field-scar:#d46a6a; --field-line:#e3e9ed;
```
Add the overlay button after `viewBtn`:
```html
      <button class="btn" id="overlayBtn" hidden title="Show or hide the countries the gods made">Countries<kbd>C</kbd></button>
```

- [ ] **Step 5: Add the pure colour functions.** In `src/ui/derive.js`, after `agesDue`:

```js
/* The mean of a list of #rrggbb colours, as rgb(). */
function mixHex(list){
  let r = 0, g = 0, b = 0;
  for (const h of list){ const n = parseInt(h.slice(1), 16); r += n >> 16; g += (n >> 8) & 255; b += n & 255; }
  const k = list.length; return `rgb(${Math.round(r / k)},${Math.round(g / k)},${Math.round(b / k)})`;
}
/* A country's colour on the field: grey with no pole, else the mean of its poles. pal is the palette, passed in so this stays pure. */
function fieldColor(r, pal){
  const cs = marksOf(r, 'pole').map(m => pal['field-' + m.value]).filter(Boolean);
  return cs.length ? mixHex(cs) : pal['field-none'];
}
```
In `viewKey()`, add `ui.overlay` to both joined arrays (the ages one and the days one), at the end of each.

- [ ] **Step 6: Add the key.** `C` is also the Crafts letter under the stage chord. The dispatcher returns the first row that matches, and the page ignores an `any` row under a dialog, so an `any` row for `c` placed above the stage rows would kill the chord's `C`. Put the row after the stage loop and the tools loop. In `src/ui/keys.js`, add directly after the `for (const t of TOOLS){ ... }` loop:
```js
/* After the stage rows, so that under the chord dialog C is still Crafts. */
KEYMAP.push({ key: 'c', focus: 'any', action: 'overlay', label: 'Show or hide the countries', button: 'overlayBtn' });
```

- [ ] **Step 7: Draw the field.** In `src/ui/map.js`:

In `readPalette`, add before the `P.agentL` line:
```js
  for (const k of ['none','wet','dry','hot','cold','above','below','light','dark','still','moving','scar','line']) P['field-' + k] = cs.getPropertyValue('--field-' + k).trim();
  fieldKey = '';
```
Add before `drawWorld`:
```js
/* ---- the field: the world before it has tiles. One grey region, then boundaries, then poles as colour, then scars. ---- */
function drawBoundaries(g, alpha){
  for (const b of liveBoundaries()){
    g.fillStyle = b.pole === 'wet' ? P['water-fg'] : P['field-line']; g.globalAlpha = b.pole === 'wet' ? 1 : alpha;
    for (const i of b.tiles){ const x = i % W, y = (i - x) / W; g.fillRect(x * WS, y * WS, WS, WS); }
  }
  g.globalAlpha = 1;
}
function drawFieldCache(){
  octx.setTransform(1, 0, 0, 1, 0, 0);
  for (const r of liveRegions()){
    octx.fillStyle = fieldColor(r, P);
    for (const i of r.tiles){ const x = i % W, y = (i - x) / W; octx.fillRect(x * WS, y * WS, WS, WS); }
    if (marksOf(r, 'scar').length){ octx.fillStyle = P['field-scar']; for (const i of r.tiles){ const x = i % W, y = (i - x) / W; if ((x + y) % 4 === 0) octx.fillRect(x * WS, y * WS, WS, WS); } }
  }
  drawBoundaries(octx, 0.7);
}
function drawField(){
  const key = [seedText, age, creation.discards, liveRegions().length].join(':');
  if (key !== fieldKey){ drawFieldCache(); fieldKey = key; }
  wctx.setTransform(dpr, 0, 0, dpr, 0, 0); wctx.drawImage(ocv, 0, 0);
  /* A god has no tile in the ages. It is drawn in the middle of the country it stands in. Gods that share a country stand side by side. */
  const at = new Map();
  for (const g of gods()){ if (g.status === 'dead') continue; const r = standsIn(g); if (!r) continue; if (!at.has(r.id)) at.set(r.id, []); at.get(r.id).push(g); }
  wctx.textAlign = 'center'; wctx.textBaseline = 'middle';
  for (const [id, list] of at){
    const b = regionById(id).bbox, cx = (b.x0 + b.x1 + 1) / 2 * WS, cy = (b.y0 + b.y1 + 1) / 2 * WS;
    list.forEach((g, k) => {
      const x = cx + (k - (list.length - 1) / 2) * 46;
      wctx.globalAlpha = g.status === 'awake' ? 1 : 0.55;
      wctx.font = '700 18px "JetBrains Mono", ui-monospace, Menlo, monospace';
      wctx.lineWidth = 3; wctx.strokeStyle = P.halo; wctx.strokeText(SPECIES.god.glyph, x, cy); wctx.fillStyle = P.god; wctx.fillText(SPECIES.god.glyph, x, cy);
      wctx.font = '500 10px "JetBrains Mono", ui-monospace, Menlo, monospace';
      wctx.strokeText(g.name, x, cy + 14); wctx.fillStyle = P.select; wctx.fillText(g.name, x, cy + 14);
    });
  }
  wctx.globalAlpha = 1;
  wctx.fillStyle = P.select; wctx.fillRect(cursor.x * WS, cursor.y * WS, WS, WS);
}
```
In `drawWorld()`, replace the holding line from task 3 with:
```js
  if (inAges()){ drawField(); return; }
```
and add after the `wctx.drawImage(ocv, 0, 0);` line of the day-era path:
```js
  if (ui.overlay) drawBoundaries(wctx, 0.85);
```
The day-era cache must be rebuilt after the ages used `ocv`. `onSettle` already sets `worldDirty = 0`, which does that.

- [ ] **Step 8: Add the region card.** In `src/ui/inspect.js`, add before `renderTip`:

```js
/* A country of the field: what it is, what it will be at settle, who stands in it, and every reason a god left on it. */
function inspectRegion(r){
  if (!r) return '<div class="muted">Nothing is here.</div>';
  const here = gods().filter(g => g.status !== 'dead' && standsIn(g) === r).map(g => `${g.name} ${g.epithet}, ${g.status}`);
  const rows = [['Country', countryLine(r)], ['Size', nOf(Math.max(1, Math.round(r.area / SECTOR_AREA)), 'sector', 'sectors')], ['Becoming', biomeOf(r)]];
  if (here.length) rows.push(['Here', here.join('; ')]);
  const seen = new Set(), why = [];
  for (const m of r.marks.slice().sort((p, q) => p.age - q.age)){ const k = m.age + m.why; if (seen.has(k)) continue; seen.add(k); why.push(`<li><span class="muted">${ageName(m.age)}</span> ${m.why}</li>`); }
  return `<table class="kv">${rows.map(x => `<tr><td>${x[0]}</td><td>${x[1]}</td></tr>`).join('')}</table>${why.length ? `<h3>What was done here</h3><ul class="hist">${why.join('')}</ul>` : ''}`;
}
```
In `renderTip`, the `body` expression gains a first branch:
```js
  const body = tipTarget.region != null ? inspectRegion(regionById(tipTarget.region))
    : tipTarget.being ? ...
```
Keep the rest of the expression as it is.

- [ ] **Step 9: Wire the pointer and the keys.** In `src/ui/actions.js`, add after `sectorFrom`:
```js
const tileFromWorld = e => { const r = wcv.getBoundingClientRect(); return { x: clamp(Math.floor((e.clientX - r.left) / r.width * W), 0, W - 1), y: clamp(Math.floor((e.clientY - r.top) / r.height * H), 0, H - 1) }; };
/* In the ages, Enter or a click opens the first god that stands in the country under the cursor. */
function openGodAt(x, y){ const r = regionAt(x, y), g = r && gods().find(g => g.status !== 'dead' && standsIn(g) === r); if (g) ACTIONS.inspect(g.id); else say('No god stands here.'); }
```
`applyAt()` gains a first line:
```js
  if (inAges()){ openGodAt(cursor.x, cursor.y); return; }
```
In `newWorld(seed)`, add `fieldKey = '';` directly after the `startCreation(seed, {});` line, so a world made again from the same seed redraws its field.

`ACTIONS` gains:
```js
  overlay(){ if (inAges()){ say('The field is all there is. The countries show after the valley is made.'); return; } ui.overlay = !ui.overlay; if (ui.overlay && view !== 'world') setView('world'); renderUI(true); },
```
In `src/ui/main.js`, replace the two `if (inAges()) return;` guards from task 3. In the `wcv` `pointermove` handler the first statement becomes:
```js
    if (inAges()){ const c = tileFromWorld(e); cursor = { x: c.x, y: c.y, z: 0 }; tipTarget = { region: regionAt(c.x, c.y).id }; tipAnchor = { x: e.clientX, y: e.clientY }; renderTip(); return; }
```
and in the `wcv` `pointerdown` handler:
```js
    if (inAges()){ const c = tileFromWorld(e); openGodAt(c.x, c.y); return; }
```
Add the listener after the `viewBtn` listener:
```js
  $('overlayBtn').addEventListener('click', ACTIONS.overlay);
```
In `src/ui/panels.js`, in `renderUI`, after the `hurryBtn` line from task 3:
```js
  $('overlayBtn').hidden = inAges() || view !== 'world'; $('overlayBtn').classList.toggle('on', ui.overlay);
```

- [ ] **Step 10: Run the tests.**

Run: `node build.js && node --test tests/ui.js 2>&1 | tail -8`
Expected: every test passes.

- [ ] **Step 11: Check the page.** With safari-mcp, open `http://localhost:8702/`, close the start dialog, and evaluate:

```js
for (let i = 0; i < 12 && era === 'gods'; i++) step(); draw();
const d = wctx.getImageData(0, 0, wcv.width, wcv.height).data, seen = new Set();
for (let i = 0; i < d.length; i += 4 * 97) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
JSON.stringify({ era, age, colours: seen.size, regions: liveRegions().length })
```
Expected: `era` is `'gods'`, `colours` is 4 or more. Take a screenshot with the tab in front and look at it: coloured countries, dark boundary lines, gold stars with names. Then `ACTIONS.hurry(); frame(performance.now()); ACTIONS.overlay(); draw();` and take a second screenshot: the tile map with the country lines over it. No console errors. Put both results in the report.

- [ ] **Step 12: Commit.**

```bash
npm run fast 2>&1 | tail -5
git add -A && git commit -m "The field on the world map: grey, then boundaries, then poles as colour, then scars, and the gods standing in it"
```

---

### Task 5: Hover on marks in the days

**Files:**
- Modify: `src/ui/derive.js` (`godLine`, `markRows`)
- Modify: `src/ui/inspect.js` (`inspectTile`)
- Modify: `src/ui/map.js` (`sectorSummary`)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `ageName`, `countryLine` from task 2.
- Produces: `godLine(id)`, `markRows(x, y, z)` returning `[[label, text], ...]`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/ui.js`:

```js
test('a hill says who raised it, a cave says who dug it, and every surface tile names its country', () => {
  const api = loadUI(['state', 'derive', 'keys'], ['markRows', 'godLine']);
  api.startWorld('alpha');
  const names = api.gods().map(g => g.name);
  const hillTile = api.world.find(t => t.hill);
  const hr = api.markRows(hillTile.x, hillTile.y, 0);
  const raised = hr.find(r => r[0] === 'Raised by');
  assert.ok(raised && names.some(n => raised[1].includes(n)), JSON.stringify(hr));
  assert.match(raised[1], /Age \d+|Before time/);
  assert.ok(hr.some(r => r[0] === 'Country'));
  const cave = api.caves.find(c => c.mark && c.deep);
  const cr = api.markRows(cave.deep.x, cave.deep.y, cave.deep.z);
  assert.ok(cr.some(r => r[0] === 'Dug by' && names.some(n => r[1].includes(n))), JSON.stringify(cr));
  assert.deepEqual(api.markRows(-1, -1, 0), []);
});

test('a scarred country says who fought over it', () => {
  /* None of the six soak seeds has a scar, so the test writes one. A mark is data, and markRows reads data. */
  const api = loadUI(['state', 'derive', 'keys'], ['markRows']);
  api.startWorld('alpha');
  const r = api.liveRegions()[0], g = api.gods()[0];
  r.marks.push({ kind: 'scar', value: 'cut', by: g.id, age: api.pulseAge + 3, why: `${g.name} beat another god here.`, at: null });
  const i = r.tiles[0], x = i % api.W, y = (i - x) / api.W;
  const scar = api.markRows(x, y, 0).find(row => row[0] === 'Scar');
  assert.ok(scar, 'a scarred country has a scar row');
  assert.ok(scar[1].includes('A cut in the earth') && scar[1].includes(g.name) && scar[1].includes('in age 4'), scar[1]);
});
```
`cave.deep` is the deep tile itself, so it has `x`, `y`, and `z`.

- [ ] **Step 2: Run and see them fail.**

Run: `node --test tests/ui.js 2>&1 | tail -20`
Expected: both fail with `markRows is not defined`.

- [ ] **Step 3: Add the rows.** In `src/ui/derive.js`, after `fieldColor`:

```js
/* ---- marks on the made world ---- A hill, a cave, a scar, and a country each hold the mark of the god that made them. */
const SCAR_WORD = { burned: 'Burned ground', cut: 'A cut in the earth', drowned: 'Drowned ground', broken: 'Broken ground' };
const godLine = id => { const g = id === null || id === undefined ? null : beingById(id); return g ? `${g.name} ${g.epithet}` : 'a god no one names now'; };
const markLine = m => `${godLine(m.by)}, ${ageName(m.age) === 'Before time' ? 'before time' : 'in ' + ageName(m.age).toLowerCase()}. ${m.why}`;
function markRows(x, y, z){
  if (!field || inAges() || !hasTile(x, y, z)) return [];
  const t = tileAt(x, y, z), r = regionAt(x, y), rows = [];
  if (t.hill && t.hill.mark) rows.push(['Raised by', markLine(t.hill.mark)]);
  if (t.hill && t.hill.god != null) rows.push(['Sleeping here', godLine(t.hill.god)]);
  const c = t.cave || t.mouth;
  if (c && c.mark) rows.push(['Dug by', markLine(c.mark)]);
  if (c && c.god != null) rows.push(['Sleeping here', godLine(c.god)]);
  if (!r) return rows;
  if (z === 0){
    const seen = new Set();
    for (const m of marksOf(r, 'scar')){ if (seen.has(m.why)) continue; seen.add(m.why); rows.push(['Scar', `${SCAR_WORD[m.value] || m.value}. ${markLine(m)}`]); }
    for (const m of marksOf(r, 'making')){ if (seen.has(m.why)) continue; seen.add(m.why); rows.push(['Made here', m.why]); }
  }
  rows.push(['Country', countryLine(r)]);
  if (r.god != null) rows.push(['Sleeping here', godLine(r.god)]);
  return rows;
}
```

- [ ] **Step 4: Show them.** In `src/ui/inspect.js`, in `inspectTile`, add directly before the `rows.push(['Burns', ...` line:
```js
  rows.push(...markRows(x, y, z));
```
In `src/ui/map.js`, in `sectorSummary(s)`, add before the `return`:
```js
  if (s.country != null && regionById(s.country)) parts.push(countryLine(regionById(s.country)));
```

- [ ] **Step 5: Run the tests.**

Run: `node build.js && node --test tests/ui.js 2>&1 | tail -8`
Expected: every test passes.

- [ ] **Step 6: Commit.**

```bash
npm run fast 2>&1 | tail -5
git add -A && git commit -m "Hover reads marks: who raised the hill, who dug the cave, who fought over the scar, and whose country it is"
```

---

### Task 6: The record and the page check

**Files:**
- Modify: `design/notes.md`
- Modify: `design/specs/2026-09-17-mythos-design.md` (section 6)
- Modify: `CLAUDE.md` (the `tests/ui.js` line)

- [ ] **Step 1: Run everything.**

```bash
node build.js && npm run fast 2>&1 | tail -6 && node tests/soak.js 2>&1 | tail -12
```
Expected: fast is green. The soak is green and the golden matches on all six seeds, because no file in `src/sim/` changed. If the golden moved, stop and report. Do not bless.

- [ ] **Step 2: Update the spec.** In section 6 of `design/specs/2026-09-17-mythos-design.md`, add a short paragraph at the end titled **As built.** It states: the pace control is the four speed buttons; the ages wait while a dialog is open; `H` hurries; the People drawer lists the gods and the Goals drawer says the valley is not made; the Legends drawer is key `5` in both eras; `C` shows the countries over the world map in the days; pace and hurry do not pass the door. In section 10, plan 4's row is done.

- [ ] **Step 3: Update the notes.** In `design/notes.md`: add a section "Watching the creation" that describes what the player sees in the ages, the flip, the field colours (a country's colour is the mean of its poles; a wet boundary is a water line; a scarred country is hatched), the region card, and the mark rows. In the interface section, add Legends to the drawers and `H` and `C` to the keys. In "Next", remove plan 4 and name what follows: G (time and tiers), then the lingering gods. Write in the file's own style: plain sentences, tables where they help.

- [ ] **Step 4: Update CLAUDE.md.** The `tests/ui.js` line becomes:
```markdown
- `tests/ui.js`: the view model in both eras, the stages, the key map, every button has a key, the field colours, the mark rows, and that a watched creation equals an unwatched one. Run it after every change to `src/ui/`.
```

- [ ] **Step 5: The whole page, once.** With safari-mcp at `http://localhost:8702/`, with the tab in front: make a world with seed `gamma` (it discards four valleys). Watch three ages pass at pace 1 by waiting, then press `=` twice and see the pace button move. Open Legends (`5`) and People (`1`); click a god row and read the card. Hover a country and read the region card. Press `H`. Confirm the sector view opens on the first person, the strip shows the camp, Goals lists the fire stage, and the Legends drawer still holds the creation. Hover a hill tile and a sector on the world map and read the mark rows. Read the console: no errors. Report what you saw, with two screenshots.

- [ ] **Step 6: Commit.**

```bash
git add -A && git commit -m "The record of watching: the spec as built, the notes, and the tests' gloss"
```
