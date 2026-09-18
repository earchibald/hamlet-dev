# UI rethink, plan B: windows, the cursor, tools, and the palette

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On top of plan A, add floating windows and several live inspectors, a tile cursor that makes every tool reachable by keyboard, one-shot tools with Nudge and without Camp site, alert chips that jump to their cause and can be muted, and a command palette that lists every action with its key.

**Architecture:** View state grows a `cursor` and a `windows` list in `state.js`. Pure functions in `derive.js` compute cursor moves, the cursor phrase, the focus ring, and the palette rows, and are tested in Node. `windows.js` owns the floating window DOM. `keys.js` grows the rest of the spec's key map and a stricter shift rule. `dialogs.js` gains the mute menu, the stage chord, and the palette. `actions.js` gains one action per new key. The sim is untouched.

**Tech Stack:** Plain JavaScript, no modules. Node's test runner. Safari through the MCP for the visual check.

## Global Constraints

- Spec: `design/specs/2026-09-17-ui-rethink-design.md`, sections 4 (jump and mute), 6, 7, 8, 9, 10, 11 (mute), 13, and steps 7 to 11 of section 15. Plan A must be complete and green first.
- Files in `src/ui/` are plain scripts in one scope. No `import`, no `export`.
- The sim does not change in this plan. `node tests/soak.js` must report the record matches on every seed at the end. `poke` and `setSite` stay in the sim; the interface stops calling `setSite`.
- Every act from outside the engine enters by the door, `inject(event)` in `src/sim/door.js`, which PR 1 on the `mythos` branch adds. The interface never calls `lightTile` or `poke` directly. Task 0 merges `dev` once PR 1 has landed there, before any other task in this plan.
- Every clickable thing has a key printed on it, and `tests/ui.js` fails on a button without one.
- Movement keys are provisional. Change them in `KEYMAP` only.
- Work on branch `ui-rethink` in `~/Worktrees/hamlet-ui-rethink`. Commit after every task by path with the attribution trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Run `node build.js` and `node tests/ui.js` after every task, and `node --test tests/door.js tests/options.js` at the end of tasks 0, 3, and 6. The tests load the joined script with `new Function(...)` as `src/sim/index.js` does.
- Browser checks use the Safari MCP with the dev server on port 8701. `page_interactions` key presses do not reach the page; dispatch `new KeyboardEvent('keydown', { key, bubbles: true })` on `document` from `evaluate_javascript` instead.

---

## File map

| File | Adds |
|---|---|
| `src/ui/state.js` | `cursor`, `ui.windows`, `ui.recent`, `ui.sticky`, `WIN_MAX`. |
| `src/ui/derive.js` | `cursorAfter`, `cursorPhrase`, `focusRing`, `winOpen`, `winClose`, `winFind`, `paletteRows`, `paletteMatch`. |
| `src/ui/keys.js` | The stricter shift rule, `focus: 'window'`, and the rows for the cursor, tools, chips, windows, chords, and the palette. |
| `src/ui/actions.js` | One action per new row. Tools become one-shot. |
| `src/ui/windows.js` | New. The floating window DOM: create, update, drag, resize, focus, close, persist. |
| `src/ui/inspect.js` | Cards render into windows. `pinCell` opens a window. |
| `src/ui/map.js` | Draws the cursor. |
| `src/ui/dialogs.js` | Mute menu, stage chord, palette. |
| `src/ui/main.js` | Wiring for windows, chips, the palette input, the cursor on hover. |
| `src/page.template.html` | `#windows`, the three new dialogs, window CSS. |
| `tests/ui.js` | Tests for every pure function above and the new key rows. |
| `design/notes.md` | Section 13, final form. |

---

### Task 0: Merge dev, and route the tools through the door

**Files:**
- Modify: everything the merge touches. Then `src/ui/actions.js` (`applyTool`), `src/ui/main.js` if `newWorld` needs the options argument.

**Interfaces:**
- Consumes: `inject(event)` from `src/sim/door.js`. `inject({ source: 'player', act: 'light', x, y, z })` and `inject({ source: 'player', act: 'poke', id })` return the same message strings `lightTile` and `poke` did. `startWorld(seed, options = {})` with `sw`, `sh`, `zmin`, `zmax`.
- Produces: a branch that contains PR 1, with `applyTool` calling `inject` for both acts and no direct call to `lightTile` or `poke` anywhere under `src/ui/`.

- [ ] **Step 1: Wait for PR 1**

Check `gh pr view 1 --repo earchibald/hamlet-dev --json state,mergedAt`. If it is not merged, stop and report BLOCKED: this plan waits for it.

- [ ] **Step 2: Merge**

```bash
cd ~/Worktrees/hamlet-ui-rethink && git fetch origin && git merge origin/dev
```

Expected: a modify/delete conflict in `src/ui.js`, which `dev` edits and this branch deleted, and perhaps conflicts in `src/sim/index.js` (both sides edit the `API` string and `FILES`) and `design/notes.md`. Resolve `src/ui.js` by deleting it (`git rm src/ui.js`) and porting every hunk of `dev`'s change to it since the branch point into the matching `src/ui/` file:

```bash
git diff fb30f63 origin/dev -- src/ui.js
```

Read that whole diff before you port. It is more than the two door hunks: `dev` also added a 64× speed, made the toolbar name the camp, changed what poke says, and touched `newWorld`. For each hunk, find the function it changes by name in `src/ui/` (`applyTool`, `newWorld`, and `initUI` are in `actions.js` and `main.js`) and apply the change there. The `light`, `poke`, and `site` cases of `applyTool` call `inject` as the Interfaces block shows; `newWorld` calls `startWorld(seed, {})`. The 64× speed becomes a fourth speed button `speed64` in the template with a `KEYMAP` row like the other three, and `slower` and `faster` in `ACTIONS` walk 1, 4, 16, 64. The toolbar-names-the-camp hunk is already covered by the strip's camp name and is not ported. A hunk that touches only the old `#goals` click handler becomes the `inject` priority call in the drawer pointerdown handler and in `setPriority` and `rowOpen`. List every hunk and where it went in the report. Other conflicts resolve by keeping both sides. `dist/hearth-sim.html`: rebuild, do not hand-resolve. `tests/soak-golden.json`: take `dev`'s.

- [ ] **Step 3: What the door changed under the interface**

Three follow-ups from the review of PR 1 (`.superpowers/sdd/pr1-review.md` has the full text). The door's acts are `light { x, y, z }`, `poke { id }`, `priority { id, pri }`, and `site { x, y, z }`:

- `W` and `H` are variables set by `startWorld` now. The world canvas sizing in `initUI` (`wcv.width = W * WS * dpr` and its height, and the offscreen `ocv`) moves into `newWorld`, after `startWorld`, so a world of another size draws right. The sector canvases keep their sizing in `initUI`, since `LW` and `LH` are fixed.
- The door has a `priority` act. Every write of `goalPriority[...]` under `src/ui/` (in `rowOpen`, `setPriority`, the drawer pointerdown, and later `ACTIONS.goalPri`) becomes `inject({ source: 'player', act: 'priority', id, pri })`, with `pri` 0 for off, 1 for on, 2 for high.
- The door has a `site` act, and `dev`'s `src/ui.js` routes the Camp site tool through it. Carry that case into `applyTool` as `inject({ source: 'player', act: 'site', x, y, z })` for now; task 3 of this plan removes the tool from the interface and the act stays in the sim for scripts.
- Every event carries `source: 'player'`. The door logs `{ ...event, tick }`. An event that arrives with its own `tick` must arrive at that tick or the door answers `Not now.`; the interface never sets `tick` on an event.

- [ ] **Step 4: Rebuild and run everything**

```bash
node build.js && node tests/ui.js && node --test tests/door.js tests/options.js && node tests/terrain.js && node tests/crafts.js && node tests/soak.js 2>&1 | tail -6
```

Expected: all pass. `grep -rn "lightTile\|poke(\|setSite" src/ui/` shows no direct call.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Merge dev: the door, and the tools go through it

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 1: The tile cursor and the map foot

**Files:**
- Modify: `src/ui/state.js` (`cursor`)
- Modify: `src/ui/derive.js` (`cursorAfter`, `cursorPhrase`)
- Modify: `src/ui/keys.js` (rows and the shift rule)
- Modify: `src/ui/actions.js` (`cursorTo`, `moveCursor`, `applyAt`, `ACTIONS.cursor`, `ACTIONS.applyAt`, `ACTIONS.home`, `ACTIONS.worldHere`; `move` and `goto` keep the cursor)
- Modify: `src/ui/map.js` (draw the cursor in `drawLoc`, `drawMid`, `drawWorld`)
- Modify: `src/ui/panels.js` (`renderFoot` shows the phrase)
- Modify: `src/ui/main.js` (hover moves the cursor; click applies at the cursor)
- Test: `tests/ui.js`

**Interfaces:**
- Produces: `cursor = { x, y, z }` in world tile coordinates, always inside the world. `cursorAfter(c, dx, dy, mult, view)` returns a new cursor: in the sector view it moves `mult` tiles, in the nearby and world views it moves a whole sector per step. `cursorPhrase()` returns one short phrase for what is under the cursor. `cursorTo(x, y, z)` sets it and makes the view follow. `applyAt()` applies the active tool at the cursor. Key rows: arrows (map) `cursor` with arg `[dx, dy, 1]`, Shift+arrows `[dx, dy, 5]`, Ctrl+arrows `[dx, dy, 'sector']`, Enter (map) `applyAt`, Home `home`, `w` `worldHere`. The old `nav` rows and the `nW nN nS nE` buttons stay for the mouse and call `cursor` with `'sector'`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui.js`:

```js
const CURSOR = [...DERIVE, 'cursor', 'cursorAfter', 'cursorPhrase', 'W', 'H', 'LW', 'LH'];

test('the cursor moves by tiles in the sector view, by sectors elsewhere, and never leaves the world', () => {
  const api = loadUI(['state', 'derive'], CURSOR); api.startWorld('r'); api.camp = api.camps[0];
  const c = { x: 10, y: 10, z: 0 };
  assert.deepEqual(api.cursorAfter(c, 1, 0, 1, 'loc'), { x: 11, y: 10, z: 0 });
  assert.deepEqual(api.cursorAfter(c, 0, -1, 5, 'loc'), { x: 10, y: 5, z: 0 });
  assert.deepEqual(api.cursorAfter(c, -1, 0, 'sector', 'loc'), { x: 10 - api.LW, y: 10, z: 0 }.x < 0 ? { x: 0, y: 10, z: 0 } : { x: 10 - api.LW, y: 10, z: 0 });
  assert.deepEqual(api.cursorAfter(c, 1, 0, 1, 'world'), { x: 10 + api.LW, y: 10, z: 0 });
  assert.deepEqual(api.cursorAfter({ x: 0, y: 0, z: 0 }, -1, -1, 5, 'loc'), { x: 0, y: 0, z: 0 });
  assert.deepEqual(api.cursorAfter({ x: api.W - 1, y: api.H - 1, z: 0 }, 1, 1, 'sector', 'loc'), { x: api.W - 1, y: api.H - 1, z: 0 });
});

test('the cursor phrase names a being under it, else the tile', () => {
  const api = loadUI(['state', 'derive'], CURSOR); api.startWorld('r'); api.camp = api.camps[0];
  const a = api.beings[0]; api.cursor.x = a.x; api.cursor.y = a.y; api.cursor.z = a.z;
  assert.match(api.cursorPhrase(), new RegExp(`^${a.name}`));
  api.cursor.x = a.x + 1; while (api.beings.some(b => b.alive && b.x === api.cursor.x && b.y === api.cursor.y && b.z === 0)) api.cursor.x++;
  assert.match(api.cursorPhrase(), /grass|soil|sand|water|rock|stone|ash|tree|bush|boulder|reeds|pine/i);
});

test('map keys: arrows move the cursor, Shift by five, Ctrl by a sector, Enter applies, Home and W jump', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.deepEqual(api.keyAction(ev('ArrowRight'), 'map'), { action: 'cursor', arg: [1, 0, 1] });
  assert.deepEqual(api.keyAction(ev('ArrowRight', { shiftKey: true }), 'map'), { action: 'cursor', arg: [1, 0, 5] });
  assert.deepEqual(api.keyAction(ev('ArrowRight', { ctrlKey: true }), 'map'), { action: 'cursor', arg: [1, 0, 'sector'] });
  assert.deepEqual(api.keyAction(ev('Enter'), 'map'), { action: 'applyAt', arg: undefined });
  assert.deepEqual(api.keyAction(ev('Home'), 'map'), { action: 'home', arg: undefined });
  assert.deepEqual(api.keyAction(ev('w'), 'map'), { action: 'worldHere', arg: undefined });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node tests/ui.js`
Expected: FAIL, `cursorAfter is not defined`.

- [ ] **Step 3: State and pure functions**

In `src/ui/state.js`, after the `ui` object:

```js
/* The tile cursor, in world coordinates. Arrows move it. Enter applies the tool at it. The mouse moves it too. */
let cursor = { x: SW * LW >> 1, y: SH * LH >> 1, z: 0 };
```

Append to `src/ui/derive.js`:

```js
/* Where the cursor lands after a move. mult is a number of tiles, or 'sector'. In the nearby and world views every step is a sector. */
function cursorAfter(c, dx, dy, mult, view){
  const sx = mult === 'sector' || view !== 'loc' ? LW : mult, sy = mult === 'sector' || view !== 'loc' ? LH : mult;
  return { x: clamp(c.x + dx * sx, 0, W - 1), y: clamp(c.y + dy * sy, 0, H - 1), z: c.z };
}
/* One phrase for what is under the cursor. A being first, then the tile. */
function cursorPhrase(){
  const a = beings.find(b => b.alive && b.x === cursor.x && b.y === cursor.y && b.z === cursor.z);
  if (a) return `${a.name}, ${a.alive ? a.status.toLowerCase() : 'dead'}`;
  if (!hasTile(cursor.x, cursor.y, cursor.z)) return cursor.z > 0 ? 'open air' : 'solid earth';
  const t = tileAt(cursor.x, cursor.y, cursor.z), parts = [];
  if (t.struct) parts.push(t.struct.type === 'firepit' ? (t.struct.lit ? 'the hearth, burning' : 'the fire pit, cold') : t.struct.type);
  if (t.feature) parts.push(FEATURES[t.feature].name);
  const it = itemAt(cursor.x, cursor.y, cursor.z); if (it) parts.push(ITEMS[it.kind].name);
  if (t.fire > 0) parts.push('burning');
  parts.push(GROUND[t.ground].name);
  return parts.join(', ');
}
```

- [ ] **Step 4: Key rows and the shift rule**

In `src/ui/keys.js`, replace the four `nav` rows with:

```js
  { key: 'ArrowLeft',  focus: 'map', action: 'cursor', arg: [-1, 0, 1], label: 'Cursor west' },
  { key: 'ArrowRight', focus: 'map', action: 'cursor', arg: [1, 0, 1],  label: 'Cursor east' },
  { key: 'ArrowUp',    focus: 'map', action: 'cursor', arg: [0, -1, 1], label: 'Cursor north' },
  { key: 'ArrowDown',  focus: 'map', action: 'cursor', arg: [0, 1, 1],  label: 'Cursor south' },
  { key: 'ArrowLeft',  shift: true, focus: 'map', action: 'cursor', arg: [-1, 0, 5], label: 'Cursor west by five' },
  { key: 'ArrowRight', shift: true, focus: 'map', action: 'cursor', arg: [1, 0, 5],  label: 'Cursor east by five' },
  { key: 'ArrowUp',    shift: true, focus: 'map', action: 'cursor', arg: [0, -1, 5], label: 'Cursor north by five' },
  { key: 'ArrowDown',  shift: true, focus: 'map', action: 'cursor', arg: [0, 1, 5],  label: 'Cursor south by five' },
  { key: 'ArrowLeft',  ctrl: true, focus: 'map', action: 'cursor', arg: [-1, 0, 'sector'], label: 'A sector west', button: 'nW' },
  { key: 'ArrowRight', ctrl: true, focus: 'map', action: 'cursor', arg: [1, 0, 'sector'],  label: 'A sector east', button: 'nE' },
  { key: 'ArrowUp',    ctrl: true, focus: 'map', action: 'cursor', arg: [0, -1, 'sector'], label: 'A sector north', button: 'nN' },
  { key: 'ArrowDown',  ctrl: true, focus: 'map', action: 'cursor', arg: [0, 1, 'sector'],  label: 'A sector south', button: 'nS' },
  { key: 'Enter',      focus: 'map', action: 'applyAt',   label: 'Apply the tool at the cursor' },
  { key: 'Home',       focus: 'map', action: 'home',      label: 'Cursor to the hearth' },
  { key: 'w',          focus: 'map', action: 'worldHere', label: 'World map at the camp' },
```

Replace the two shift lines in `keyAction` with one strict rule:

```js
    if (!!k.shift !== e.shiftKey) continue;
```

Every row that expects a shifted key already says `shift: true`: `?`, `>`, Shift+Tab, and the Shift+arrows. `Tab` without shift has no `shift` field, so it matches only an unshifted Tab.

- [ ] **Step 5: Actions, drawing, the foot, and the mouse**

In `src/ui/actions.js`, add after `move`:

```js
/* Put the cursor on a tile and make the view follow it: the sector view scrolls to its sector, the level follows. */
function cursorTo(x, y, z){
  cursor = { x: clamp(x, 0, W - 1), y: clamp(y, 0, H - 1), z: clamp(z, ZMIN, ZMAX) };
  const s = secOf(cursor.x, cursor.y);
  if (s.sx !== cur.sx || s.sy !== cur.sy) setView(view, s); else renderUI(true);
  if (view === 'loc' && cursor.z !== lvl) setLevel(cursor.z);
}
function moveCursor([dx, dy, mult]){ followId = null; const c = cursorAfter(cursor, dx, dy, mult, view); cursorTo(c.x, c.y, c.z); }
/* The tool at the cursor. In the nearby and world views Enter opens the sector under it. */
function applyAt(){
  if (view !== 'loc'){ const s = secOf(cursor.x, cursor.y); goto(s.sx, s.sy); return; }
  const c = { x: cursor.x, y: cursor.y, z: cursor.z, lx: cursor.x - cur.sx * LW, ly: cursor.y - cur.sy * LH };
  const r = cv.getBoundingClientRect(); const e = { clientX: r.left + (c.lx + 0.5) * r.width / LW, clientY: r.top + (c.ly + 0.5) * r.height / LH };
  applyTool(c, e);
}
```

Rewrite `move` and `goto` so they keep the cursor in step:

```js
function goto(sx, sy){ if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return; followId = null; const s = { sx, sy }; cursor = { x: clamp(cursor.x - cur.sx * LW + sx * LW, sx * LW, (sx + 1) * LW - 1), y: clamp(cursor.y - cur.sy * LH + sy * LH, sy * LH, (sy + 1) * LH - 1), z: cursor.z }; setView('loc', s); }
function move(dx, dy){ moveCursor([dx, dy, 'sector']); }
```

Add to `ACTIONS`:

```js
  cursor(arg){ moveCursor(arg); },
  applyAt(){ applyAt(); },
  home(){ if (viewCamp.pit) cursorTo(viewCamp.pit[0], viewCamp.pit[1], 0); else if (viewCamp.site) cursorTo(viewCamp.site[0], viewCamp.site[1], 0); },
  worldHere(){ followId = null; const t = viewCamp.site || [cursor.x, cursor.y]; cursor = { x: t[0], y: t[1], z: 0 }; setView('world', secOf(t[0], t[1])); },
```

and change `nav` to `nav([dx, dy]){ moveCursor([dx, dy, 'sector']); }`.

In `src/ui/map.js`, in `drawLoc`, replace the `hover` rectangle at the end with the cursor:

```js
  if (secOf(cursor.x, cursor.y).sx === cur.sx && secOf(cursor.x, cursor.y).sy === cur.sy && cursor.z === lvl){
    const cx = (cursor.x - ox) * T, cy = (cursor.y - oy) * T;
    ctx.strokeStyle = P.select; ctx.lineWidth = 2; ctx.strokeRect(cx + 1, cy + 1, T - 2, T - 2);
    ctx.strokeStyle = P.halo; ctx.lineWidth = 1; ctx.strokeRect(cx + 2.5, cy + 2.5, T - 5, T - 5);
  }
```

In `drawWorld` and `drawMid`, the selected sector rectangle already reads `cur`, which `cursorTo` keeps in step. No change.

In `src/ui/panels.js`, `renderFoot` becomes:

```js
function renderFoot(){
  const e = chronicle[0];
  const line = ui.open.includes('chronicle') || !e ? '' : `<span class="when">${e.when}</span><span class="k-${e.kind}">${e.text}</span>`;
  $('foot').innerHTML = `<span class="muted">${cursorPhrase()}</span>${line ? '<span class="muted">·</span>' + line : ''}`;
}
```

and `viewKey` in `derive.js` gets `cursor.x, cursor.y, cursor.z` appended to its list so the foot updates when the cursor moves.

In `src/ui/main.js`, the map pointer handlers become:

```js
  cv.addEventListener('pointerdown', e => { const c = cellFrom(e); cursor = { x: c.x, y: c.y, z: c.z }; hover = c; applyTool(c, e); if (tool !== 'inspect'){ tipTarget = null; tipForCell(c, e); } });
  cv.addEventListener('pointermove', e => { hover = cellFrom(e); cursor = { x: hover.x, y: hover.y, z: hover.z }; if (e.pointerType === 'mouse') tipForCell(hover, e); });
```

Remove `say(...)` from the `wcv` and `mcv` pointermove handlers and set the cursor instead: `const s = sectorFrom(e); whover = s; cursor = { x: s.sx * LW + (LW >> 1), y: s.sy * LH + (LH >> 1), z: 0 };` and the same shape for `mcv` with `sectorFromMid`. The sector summary shows in the hover tip instead: in `tipForCell`'s caller for the world canvas, call `tipTarget = { sector: s }; tipAnchor = { x: e.clientX, y: e.clientY }; renderTip();` and in `renderTip` add a branch: `tipTarget.sector ? '<div class="muted">' + sectorSummary(sectors[secIdx(tipTarget.sector.sx, tipTarget.sector.sy)]) + '</div>'`.

- [ ] **Step 6: Build, test, look**

```bash
node build.js && node tests/ui.js
```

Expected: every test passes.

In Safari, reload, close the start dialog, and dispatch `ArrowRight` five times, then `ArrowRight` with `shiftKey: true`, then `Home`:

```js
const k = (key, m = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...m }));
const c0 = { ...cursor }; for (let i = 0; i < 5; i++) k('ArrowRight'); k('ArrowRight', { shiftKey: true }); const c1 = { ...cursor }; k('Home'); return [c0, c1, cursor, document.getElementById('foot').textContent];
```

Expected: `c1.x` is `c0.x + 10`, the cursor after Home is the camp site, and the foot names what is under it. Screenshot `.superpowers/shots/b1-cursor.png` and look for the double-ring cursor.

- [ ] **Step 7: Commit**

```bash
git add src/ui tests/ui.js && git commit -m "A tile cursor: arrows move it, Enter applies the tool, the foot says what is under it

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Floating windows

**Files:**
- Modify: `src/page.template.html` (`#windows`, window CSS)
- Modify: `src/ui/state.js` (`ui.windows`, `WIN_MAX`, persist window rects)
- Modify: `src/ui/derive.js` (`winOpen`, `winClose`, `winFind`, `focusRing`)
- Modify: `src/ui/keys.js` (`o` pop out and dock, `focus: 'window'`, Esc in a window)
- Modify: `src/ui/actions.js` (`popOut`, `focusStep` uses `focusRing`, `back` closes a window)
- Create: `src/ui/windows.js`
- Modify: `src/ui/index.js` (`windows` in `FILES` after `strip`)
- Modify: `src/ui/panels.js` (a popped-out drawer renders into its window, not the column)
- Modify: `src/ui/main.js` (wiring)
- Test: `tests/ui.js`

**Interfaces:**
- Produces: `ui.windows = [{ id, kind, target, x, y, w, h }]`, `kind` is `'drawer'` or `'inspect'`, `target` is a drawer id or `{ being }` or `{ tile: [x, y, z] }`. `winOpen(kind, target)` returns the window, reusing one with the same target, and closes the oldest inspector past `WIN_MAX = 6`. `winClose(id)`. `winFind(kind, target)`. `focusRing()` returns `['map', 'drawer:<id>'..., 'window:<id>'...]` with popped-out drawers left out of the drawer part. `renderWindows()` syncs the DOM to `ui.windows`, and each window body is filled by `renderPeople`, `renderGoals`, `renderChronicle`, `renderCamp`, or the inspector card. Key rows: `o` on a drawer pops it out, `o` on a window docks it back (both action `popOut`), Esc on a window closes it, Tab reaches windows.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui.js`:

```js
const WIN = [...DERIVE, 'winOpen', 'winClose', 'winFind', 'focusRing', 'WIN_MAX'];

test('windows: open reuses a window for the same target, the seventh inspector closes the oldest, and the focus ring lists map, docked drawers, then windows', () => {
  const api = loadUI(['state', 'derive'], WIN); api.startWorld('r'); api.camp = api.camps[0];
  const w1 = api.winOpen('inspect', { being: 1 });
  assert.equal(api.winOpen('inspect', { being: 1 }), w1, 'same target, same window');
  for (let i = 2; i <= 7; i++) api.winOpen('inspect', { being: i });
  assert.equal(api.ui.windows.filter(w => w.kind === 'inspect').length, api.WIN_MAX);
  assert.equal(api.winFind('inspect', { being: 1 }), undefined, 'the oldest went');
  api.ui.open = ['people', 'goals']; api.winOpen('drawer', 'goals');
  const ring = api.focusRing();
  assert.equal(ring[0], 'map'); assert.ok(ring.includes('drawer:people')); assert.ok(!ring.includes('drawer:goals'), 'a popped-out drawer is a window now');
  assert.ok(ring.filter(f => f.startsWith('window:')).length === api.ui.windows.length);
  api.winClose(api.ui.windows[0].id); assert.equal(api.ui.windows.length, api.WIN_MAX);
});

test('window keys: O pops out or docks, Esc closes a focused window, Tab walks the ring', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.deepEqual(api.keyAction(ev('o'), 'drawer:goals'), { action: 'popOut', arg: undefined });
  assert.deepEqual(api.keyAction(ev('o'), 'window:3'), { action: 'popOut', arg: undefined });
  assert.deepEqual(api.keyAction(ev('Escape'), 'window:3'), { action: 'back', arg: undefined });
  assert.deepEqual(api.keyAction(ev('Tab'), 'window:3'), { action: 'focusNext', arg: undefined });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node tests/ui.js`
Expected: FAIL, `winOpen is not defined`.

- [ ] **Step 3: State and pure functions**

In `src/ui/state.js`, add to the `ui` object:

```js
  windows: [],         /* floating windows: { id, kind, target, x, y, w, h } */
  nextWin: 1,
  rects: {},           /* remembered rect per window kind or drawer id, from storage */
```

and `const WIN_MAX = 6;` after it. In `persist`, add `rects: ui.rects` to the saved object; in `restore`, add `if (s.rects && typeof s.rects === 'object') ui.rects = s.rects;`.

Append to `src/ui/derive.js`:

```js
/* Floating windows. A drawer window's target is the drawer id. An inspector's target is { being } or { tile }. */
const sameTarget = (a, b) => typeof a === 'string' ? a === b : a.being != null ? a.being === b.being : b.tile && a.tile.join() === b.tile.join();
const winKey = w => w.kind === 'drawer' ? `drawer:${w.target}` : 'inspect';
function winFind(kind, target){ return ui.windows.find(w => w.kind === kind && sameTarget(w.target, target)); }
function winOpen(kind, target){
  const have = winFind(kind, target); if (have) return have;
  const r = ui.rects[kind === 'drawer' ? `drawer:${target}` : 'inspect'] || { x: 80 + 24 * (ui.windows.length % 5), y: 80 + 24 * (ui.windows.length % 5), w: 330, h: 420 };
  const w = { id: ui.nextWin++, kind, target, ...r };
  ui.windows.push(w);
  const ins = ui.windows.filter(w => w.kind === 'inspect'); if (ins.length > WIN_MAX) winClose(ins[0].id);
  return w;
}
function winClose(id){ ui.windows = ui.windows.filter(w => w.id !== id); if (ui.focus === `window:${id}`) ui.focus = 'map'; }
/* Where Tab goes: the map, each docked drawer in order, then each window in order. */
function focusRing(){
  const out = ui.windows.filter(w => w.kind === 'drawer').map(w => w.target);
  return ['map', ...ui.open.filter(id => !out.includes(id)).map(id => `drawer:${id}`), ...ui.windows.map(w => `window:${w.id}`)];
}
```

- [ ] **Step 4: Keys and actions**

In `src/ui/keys.js`, the dispatcher's `kind` line becomes:

```js
  const kind = focus.startsWith('drawer:') ? 'drawer' : focus.startsWith('window:') ? 'window' : focus;
```

Add rows:

```js
  { key: 'o',          focus: 'drawer', action: 'popOut',    label: 'Pop the drawer out into a window' },
  { key: 'o',          focus: 'window', action: 'popOut',    label: 'Dock the window back' },
  { key: 'ArrowUp',    focus: 'window', action: 'rowUp',     label: 'Row up' },
  { key: 'ArrowDown',  focus: 'window', action: 'rowDown',   label: 'Row down' },
  { key: 'Enter',      focus: 'window', action: 'rowOpen',   label: 'Open row' },
```

In `src/ui/actions.js`, `focusStep` uses the ring:

```js
function focusStep(d){ const ring = focusRing(); const i = Math.max(0, ring.indexOf(ui.focus)), j = (i + d + ring.length) % ring.length; ui.focus = ring[j]; renderUI(true); }
```

`back` becomes:

```js
  back(){
    if (ui.focus.startsWith('window:')){ winClose(Number(ui.focus.slice(7))); persist(); renderUI(true); return; }
    if (ui.focus !== 'map'){ ui.focus = 'map'; renderUI(true); return; }
    if (tipPinned) hideTip();
  },
```

Add `popOut`:

```js
  popOut(){
    if (ui.focus.startsWith('drawer:')){ const id = ui.focus.slice(7); const w = winOpen('drawer', id); ui.focus = `window:${w.id}`; }
    else if (ui.focus.startsWith('window:')){ const w = ui.windows.find(w => w.id === Number(ui.focus.slice(7))); if (w && w.kind === 'drawer'){ winClose(w.id); ui.focus = `drawer:${w.target}`; if (!ui.open.includes(w.target)) ui.open.push(w.target); } }
    persist(); renderUI(true);
  },
```

`focusedDrawer` must also see a popped-out drawer window: replace it with

```js
const focusedDrawer = () => ui.focus.startsWith('drawer:') ? ui.focus.slice(7) : ui.focus.startsWith('window:') ? (ui.windows.find(w => w.id === Number(ui.focus.slice(7)) && w.kind === 'drawer') || {}).target || null : null;
```

- [ ] **Step 5: The window DOM**

Add to the template, after `<div id="drawers"></div>`: `<div id="windows"></div>`. Add CSS before the `.tip` block:

```css
/* Floating windows. */
#windows{position:absolute;inset:0;z-index:4;pointer-events:none}
.win{position:absolute;display:flex;flex-direction:column;min-width:220px;min-height:120px;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 12px 36px rgba(0,0,0,.35);pointer-events:auto;overflow:hidden}
.win.focus{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 40%,transparent),0 12px 36px rgba(0,0,0,.35)}
.win .bar{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 8px 5px 10px;background:var(--bg);border-bottom:1px solid var(--line);cursor:move;font-weight:700;user-select:none}
.win .bar .k{font:500 11px "JetBrains Mono",monospace;color:var(--muted);font-weight:400}
.win .body{overflow:auto;padding:6px 10px;flex:1;min-height:0}
.win .grip{position:absolute;right:0;bottom:0;width:14px;height:14px;cursor:nwse-resize;border-right:2px solid var(--accent);border-bottom:2px solid var(--accent);opacity:.5;border-radius:0 0 6px 0}
```

Create `src/ui/windows.js`:

```js
/* Floating windows. The DOM follows ui.windows: one .win per entry, kept across renders so scroll and drag survive.
   A drawer window's body is rendered by the drawer's own renderer. An inspector's body is the card. */
function winTitle(w){
  if (w.kind === 'drawer') return DRAWERS.find(d => d.id === w.target).label;
  if (w.target.being != null){ const a = beingById(w.target.being); return a ? `${a.name} <span class="k">${moodWord(a, mood(a))}</span>` : 'Gone'; }
  const [x, y] = w.target.tile, s = secOf(x, y); return `${sectors[secIdx(s.sx, s.sy)].name} ${x - s.sx * LW},${y - s.sy * LH}`;
}
function renderWindows(){
  const box = $('windows'), seen = new Set();
  for (const w of ui.windows){
    seen.add(w.id);
    let el = box.querySelector(`[data-win="${w.id}"]`);
    if (!el){
      el = document.createElement('section'); el.className = 'win'; el.dataset.win = w.id;
      el.innerHTML = `<div class="bar"><span class="title"></span><span><span class="k">${w.kind === 'drawer' ? 'O dock' : 'F follow'} · Esc</span> <button class="btn small" data-close aria-label="Close">×</button></span></div><div class="body"></div><div class="grip"></div>`;
      box.appendChild(el);
    }
    el.style.left = w.x + 'px'; el.style.top = w.y + 'px'; el.style.width = w.w + 'px'; el.style.height = w.h + 'px';
    el.classList.toggle('focus', ui.focus === `window:${w.id}`);
    el.querySelector('.title').innerHTML = winTitle(w);
    const body = el.querySelector('.body'), keep = body.scrollTop;
    if (w.kind === 'drawer') ({ people: renderPeople, goals: renderGoals, chronicle: renderChronicle, camp: renderCamp })[w.target](body, w.target);
    else body.innerHTML = w.target.being != null ? (beingById(w.target.being) ? inspectBeing(beingById(w.target.being), true) : '<div class="muted">Gone.</div>') : inspectTile(...w.target.tile);
    body.scrollTop = keep;
  }
  for (const el of [...box.children]) if (!seen.has(Number(el.dataset.win))) el.remove();
}
/* Drag by the bar, resize by the grip. Positions persist per kind. */
function wireWindows(){
  const box = $('windows'); let drag = null;
  box.addEventListener('pointerdown', e => {
    const el = e.target.closest('.win'); if (!el) return; const w = ui.windows.find(w => w.id === Number(el.dataset.win)); if (!w) return;
    ui.focus = `window:${w.id}`; ui.windows = [...ui.windows.filter(x => x !== w), w]; renderUI(true);
    if (e.target.closest('[data-close]')){ winClose(w.id); persist(); renderUI(true); return; }
    const f = e.target.closest('[data-follow]'); if (f){ const id = Number(f.dataset.follow); followId = followId === id ? null : id; renderUI(true); return; }
    const grip = e.target.closest('.grip'), bar = e.target.closest('.bar');
    if (!grip && !bar) return;
    drag = { w, grip: !!grip, x0: e.clientX, y0: e.clientY, x: w.x, y: w.y, wd: w.w, ht: w.h }; el.setPointerCapture(e.pointerId); e.preventDefault();
  });
  box.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (drag.grip){ drag.w.w = Math.max(220, drag.wd + dx); drag.w.h = Math.max(120, drag.ht + dy); }
    else { drag.w.x = Math.max(0, drag.x + dx); drag.w.y = Math.max(0, drag.y + dy); }
    renderWindows();
  });
  box.addEventListener('pointerup', () => { if (!drag) return; const w = drag.w; ui.rects[w.kind === 'drawer' ? `drawer:${w.target}` : 'inspect'] = { x: w.x, y: w.y, w: w.w, h: w.h }; persist(); drag = null; });
}
```

Add `'windows'` to `FILES` in `src/ui/index.js` after `'strip'`. Call `wireWindows()` in `initUI` after the drawer wiring, and `renderWindows()` at the end of `renderUI`.

In `src/ui/panels.js`, `renderDrawers` must skip drawers that are windows: change the `html` map to `ui.open.filter(id => !winFind('drawer', id)).map(...)`, and the body loop the same way. The tabs show a dot on a popped-out drawer: in the tab template, append `${winFind('drawer', d.id) ? ' ⧉' : ''}` after the label. The drawer renderers take `(el, id)`; they already read the drawer id from their name, so no change is needed inside them, but `count-${id}` elements do not exist in a window: guard each `$('count-...')` line with `const c = $('count-' + id); if (c) c.textContent = ...`. The window's `.title` carries the count instead: in `winTitle` for a drawer, append `<span class="k">${drawerRows(w.target).length}</span>`.

The old `inspectBeing(a)` reads `tipPinned` for the history length; change its signature to `inspectBeing(a, full = tipPinned)` and use `full` in place of `tipPinned` inside it, including for the Follow button, which reads `full && a.alive`.

- [ ] **Step 6: Build, test, look**

```bash
node build.js && node tests/ui.js
```

Expected: pass.

In Safari: reload, close the dialog, dispatch `2` then `o`. Expect a Goals window to appear and the Goals tab to show the dot. Drag its bar through `page_interactions` or a scripted pointer sequence, reload, and check the window comes back where it was left. Dispatch `Escape` and check the window closes and `ui.focus` is `map`. Screenshot `.superpowers/shots/b2-window.png`.

- [ ] **Step 7: Commit**

```bash
git add src/page.template.html src/ui tests/ui.js && git commit -m "Floating windows: drawers pop out and dock back, positions persist, Tab reaches them

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Inspector windows and one-shot tools

**Files:**
- Modify: `src/ui/state.js` (`TOOLS`, `ui.sticky`)
- Modify: `src/ui/inspect.js` (`pinCell` opens a window; the hover tip stays)
- Modify: `src/ui/keys.js` (`toolSticky` rows, `f` in a window)
- Modify: `src/ui/actions.js` (`applyTool`, `setTool`, `ACTIONS.toolSticky`, `ACTIONS.follow`, `ACTIONS.inspect`, `rowOpen` for people)
- Modify: `src/ui/main.js` (tool buttons: Shift+click sticks)
- Modify: `src/page.template.html` (help text: Light fire, Nudge)
- Test: `tests/ui.js`

**Interfaces:**
- Produces: `TOOLS` has three rows, each with `oneShot`. Inspect is the default. `setTool(id, sticky)`. After a one-shot tool is used the tool returns to `inspect` unless `ui.sticky` is true. `pinCell(c)` opens an inspector window for the being or tile. `ACTIONS.inspect(beingId)`, `ACTIONS.follow(beingId)`, `ACTIONS.toolSticky(id)`. `f` in a focused inspector toggles follow.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui.js`:

```js
test('tools: three, inspect first, light fire and nudge one-shot, no camp site', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], ['TOOLS', ...KEYS]);
  assert.deepEqual(api.TOOLS.map(t => t.id), ['inspect', 'light', 'nudge']);
  assert.equal(api.TOOLS[0].oneShot, false); assert.equal(api.TOOLS[1].oneShot, true); assert.equal(api.TOOLS[2].oneShot, true);
  assert.equal(api.TOOLS[1].label, 'Light fire'); assert.equal(api.TOOLS[2].label, 'Nudge');
  assert.deepEqual(api.keyAction(ev('N', { shiftKey: true }), 'map'), { action: 'toolSticky', arg: 'nudge' });
  assert.deepEqual(api.keyAction(ev('f'), 'window:2'), { action: 'follow', arg: undefined });
  assert.deepEqual(api.keyAction(ev('f'), 'map'), { action: 'tool', arg: 'light' });
  assert.equal(api.keyAction(ev('F', { shiftKey: true }), 'map').action, 'toolSticky', 'shift on a letter is its own row');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node tests/ui.js`
Expected: FAIL on the `TOOLS` ids: `camp` and `poke` are still there.

- [ ] **Step 3: The tools table**

In `src/ui/state.js`, replace `TOOLS`:

```js
/* The tools. Inspect is the default. A one-shot tool returns to Inspect after one use, unless Shift made it stick. */
const TOOLS = [
  { id: 'inspect', key: 'i', label: 'Inspect',    oneShot: false, hint: 'Point at a person, an animal, or a tile. Enter or click opens a window with the details.' },
  { id: 'light',   key: 'f', label: 'Light fire', oneShot: true,  hint: 'Light the fire pit under the cursor. Anything else starts a wildfire. The hover card says what will burn. Shift makes the tool stick.' },
  { id: 'nudge',   key: 'n', label: 'Nudge',      oneShot: true,  hint: 'Make a person stop and think again. Startle an animal. Shift makes the tool stick.' },
];
```

Add `sticky: false,` to the `ui` object.

- [ ] **Step 4: Keys**

In `src/ui/keys.js`, replace the `for (const t of TOOLS)` line with:

```js
for (const t of TOOLS){
  KEYMAP.push({ key: t.key, focus: 'any', action: 'tool', arg: t.id, label: t.label });
  if (t.oneShot) KEYMAP.push({ key: t.key, shift: true, focus: 'any', action: 'toolSticky', arg: t.id, label: `${t.label}, and keep it` });
}
```

Add a row before the tools loop so it wins for a focused window:

```js
  { key: 'f',          focus: 'window', action: 'follow',    label: 'Follow this person' },
```

The dispatcher walks `KEYMAP` in order and the `window` row comes before the `any` row for `f`, so a focused inspector gets follow and the map gets the tool. Add the test's expectation to the help: nothing to do, `openHelp` reads the table.

- [ ] **Step 5: Actions and the inspector**

In `src/ui/actions.js`, replace `setTool` and `applyTool`:

```js
function setTool(id, sticky = false){
  tool = id; ui.sticky = sticky && TOOLS.find(t => t.id === id).oneShot;
  document.querySelectorAll('#tools .btn').forEach(b => { const on = b.dataset.tool === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.querySelector('.pin').hidden = !(on && ui.sticky); });
}
function applyTool(c, e){
  switch (tool){
    case 'inspect': pinCell(c, e); break;
    case 'light': say(inject({ source: 'player', act: 'light', x: c.x, y: c.y, z: c.z })); camp = viewCamp; break;
    case 'nudge': { const a = beings.find(a => a.alive && a.x === c.x && a.y === c.y && a.z === c.z); say(a ? inject({ source: 'player', act: 'poke', id: a.id }) : 'Nobody is there to nudge.'); break; }
  }
  if (TOOLS.find(t => t.id === tool).oneShot && !ui.sticky) setTool('inspect');
  renderUI(true);
}
```

Add to `ACTIONS`:

```js
  toolSticky(id){ setTool(id, true); },
  inspect(id){ const a = beingById(id); if (!a) return; const w = winOpen('inspect', { being: id }); ui.focus = `window:${w.id}`; cursorTo(a.x, a.y, a.z); renderUI(true); },
  follow(id){ const w = id == null && ui.focus.startsWith('window:') ? ui.windows.find(w => w.id === Number(ui.focus.slice(7))) : null; const target = id != null ? id : w && w.kind === 'inspect' && w.target.being; if (target == null) return; followId = followId === target ? null : target; renderUI(true); },
```

In `rowOpen`, the `person` branch becomes `if (r.kind === 'person'){ ACTIONS.inspect(r.id); }`.

In `src/ui/inspect.js`, `pinCell` becomes:

```js
function pinCell(c, e){
  const t = targetForCell(c);
  const w = winOpen('inspect', t.being != null ? { being: t.being } : { tile: t.tile });
  ui.focus = `window:${w.id}`; hideTip(); persist(); renderUI(true);
}
```

`tipPinned` is never set true now. Leave the variable and the hover path; delete the `data-close` branch in the tip's pointerdown handler in `main.js`, and the `document` pointerdown that hid a pinned tip.

The tool buttons in `main.js` get a pin mark and Shift+click:

```js
  $('tools').innerHTML = TOOLS.map(t => `<button class="btn" data-tool="${t.id}" aria-pressed="false" title="${t.hint}">${t.label}<kbd>${t.key.toUpperCase()}</kbd><span class="pin" hidden> ⌖</span></button>`).join('');
  $('tools').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) (e.shiftKey ? ACTIONS.toolSticky : ACTIONS.tool)(b.dataset.tool); });
```

In the template's Things to try, the first line reads `use Light fire on it` and the Poke line reads `Nudge someone who is sitting by the fire when the woodpile is empty.`

- [ ] **Step 6: Build, test, look**

```bash
node build.js && node tests/ui.js
```

Expected: every test passes.

In Safari: reload, close the dialog, advance until the pit exists (`for (let i = 0; i < 6000 && !camps[0].pit; i++) step(); renderUI(true)`), dispatch `Home`, `f`, `Enter`. Expect the hearth lit, the foot to say so, and `tool` back to `inspect`. Dispatch `F` with shift, then check `tool === 'light'` and `ui.sticky === true`, then `i`. Move the cursor onto a person and press Enter: an inspector window opens with needs, thoughts, and decision scores. Open two more on other people and check three windows stand together. Screenshot `.superpowers/shots/b3-inspectors.png`.

- [ ] **Step 7: Commit**

```bash
git add src/page.template.html src/ui tests/ui.js && git commit -m "Inspector windows, several at once, and one-shot tools: Light fire and Nudge return to Inspect unless Shift keeps them

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Chips that jump, and the mute menu

**Files:**
- Modify: `src/ui/keys.js` (Alt+1 to 9, Shift+Alt+1 to 9, mute dialog rows)
- Modify: `src/ui/actions.js` (`jumpChip`, `muteMenu`, `muteChoice`)
- Modify: `src/ui/dialogs.js` (the mute dialog)
- Modify: `src/ui/main.js` (chip click and right click, dialog keys)
- Modify: `src/page.template.html` (`#mute` dialog)
- Test: `tests/ui.js`

**Interfaces:**
- Produces: `ACTIONS.jumpChip(n)` moves the cursor to the chip's cause, opens the sector view and the level, and opens an inspector for a being. `ACTIONS.muteMenu(n)` opens the mute dialog for chip `n`. `ACTIONS.muteChoice(k)` with `k` 1 to 3: this chip for this camp, this type for this camp, this type everywhere. A muted single chip is a mute on `type:campId:text`. `isMuted` gains that third form.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui.js`:

```js
test('chip keys: Alt+n jumps, Shift+Alt+n opens the mute menu, and a single chip can be muted by its text', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...DERIVE, ...KEYS]);
  assert.deepEqual(api.keyAction(ev('3', { altKey: true }), 'map'), { action: 'jumpChip', arg: 3 });
  assert.deepEqual(api.keyAction(ev('3', { altKey: true, shiftKey: true }), 'drawer:goals'), { action: 'muteMenu', arg: 3 });
  assert.deepEqual(api.keyAction(ev('2'), 'dialog:mute'), { action: 'muteChoice', arg: 2 });
  api.startWorld('r'); api.camp = api.camps[0]; const a = api.beings[0]; a.needs.warmth = 10; api.notePulses();
  const cold = api.alerts().find(x => x.type === 'cold'); assert.ok(cold);
  api.mute('cold', api.camp.id, cold.text);
  assert.equal(api.alerts().some(x => x.type === 'cold'), false, 'that one chip is muted');
  const b = { ...a, name: 'Other' }; assert.equal(api.isMuted('cold', api.camp.id, 'Other is cold'), false, 'another cold chip is not');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node tests/ui.js`
Expected: FAIL, `jumpChip` row missing.

- [ ] **Step 3: Mutes by text, keys, dialog, actions**

In `src/ui/derive.js`, the three mute functions become:

```js
const isMuted = (type, campId, text) => ui.mutes.has(type) || ui.mutes.has(`${type}:${campId}`) || (text != null && ui.mutes.has(`${type}:${campId}:${text}`));
function mute(type, campId, text){ ui.mutes.add(text != null ? `${type}:${campId}:${text}` : campId ? `${type}:${campId}` : type); }
function unmute(type, campId, text){ ui.mutes.delete(text != null ? `${type}:${campId}:${text}` : campId ? `${type}:${campId}` : type); }
```

and `add` in `alerts` passes the text: `if (!isMuted(type, camp.id, text)) out.push(...)`.

In `src/ui/keys.js`, the dispatcher's `kind` line handles dialogs: `focus.startsWith('dialog:') ? focus : ...` placed before the other tests, so `'dialog:mute'` matches rows with `focus: 'dialog:mute'`. Add rows:

```js
for (let n = 1; n <= 9; n++){
  KEYMAP.push({ key: String(n), alt: true, focus: 'any', action: 'jumpChip', arg: n, label: `Jump to alert ${n}` });
  KEYMAP.push({ key: String(n), alt: true, shift: true, focus: 'any', action: 'muteMenu', arg: n, label: `Mute alert ${n}` });
}
for (let k = 1; k <= 3; k++) KEYMAP.push({ key: String(k), focus: 'dialog:mute', action: 'muteChoice', arg: k, label: ['Mute this alert', 'Mute this kind here', 'Mute this kind everywhere'][k - 1], button: `mute${k}` });
```

On a Mac, Alt+digit types a symbol and `e.key` is not the digit; read `e.code` too. In `keyAction`, compute `const key = e.key.length === 1 ? e.key.toLowerCase() : e.key, code = e.code && /^Digit\d$/.test(e.code) ? e.code.slice(5) : null;` and match a row when `rowKey === key || (code && rowKey === code)`.

In the template, add after the help dialog:

```html
<dialog id="mute">
  <h2 id="muteTitle">Mute</h2>
  <p><button class="btn" id="mute1">This alert<kbd>1</kbd></button> <button class="btn" id="mute2">This kind, this camp<kbd>2</kbd></button> <button class="btn" id="mute3">This kind, everywhere<kbd>3</kbd></button></p>
  <p class="muted">Unmute from the command palette or the help dialog.</p>
</dialog>
```

In `src/ui/dialogs.js`:

```js
let muteFor = null;
function openMute(a){ closeDialogs(); muteFor = a; $('muteTitle').textContent = `Mute: ${a.text}`; ui.focus = 'dialog:mute'; $('mute').showModal(); }
function muteChoice(k){
  if (!muteFor) return;
  if (k === 1) mute(muteFor.type, camp.id, muteFor.text); else if (k === 2) mute(muteFor.type, camp.id); else mute(muteFor.type, 0);
  muteFor = null; closeDialogs(); persist(); renderUI(true);
}
```

`closeDialogs` sets `ui.focus = 'map'` whenever the focus starts with `dialog`. In `openHelp`, list the mutes with an unmute button each, after the keys table: build `<h2>Muted</h2>` plus one `<button class="btn small" data-unmute="${m}">${m}<kbd>click</kbd></button>` per entry of `ui.mutes`, or `<p class="muted">Nothing is muted.</p>`. A `click` on `[data-unmute]` inside `#help` deletes that entry from `ui.mutes`, persists, and re-renders the help. The `data-unmute` buttons have no id, so the button test does not see them; that is why they print `click`.

In `src/ui/actions.js`, add:

```js
  jumpChip(n){
    const a = alerts()[n - 1]; if (!a) return;
    if (a.being != null){ const b = beingById(a.being); if (b){ if (view !== 'loc') setView('loc', secOf(b.x, b.y)); cursorTo(b.x, b.y, b.z); ACTIONS.inspect(b.id); } }
    else if (a.tile){ if (view !== 'loc') setView('loc', secOf(a.tile[0], a.tile[1])); cursorTo(a.tile[0], a.tile[1], a.tile[2] || 0); }
  },
  muteMenu(n){ const a = alerts()[n - 1]; if (a) openMute(a); },
  muteChoice(k){ muteChoice(k); },
```

In `src/ui/main.js`, the keydown handler's dialog branch becomes: `if (anyDialogOpen()){ if (e.key === 'Escape'){ e.preventDefault(); closeDialogs(); return; } const hit = keyAction(e, ui.focus); if (hit){ e.preventDefault(); ACTIONS[hit.action](hit.arg); } return; }`. Wire the chips:

```js
  $('chips').addEventListener('click', e => { const c = e.target.closest('[data-chip]'); if (c) ACTIONS.jumpChip(Number(c.dataset.chip)); });
  $('chips').addEventListener('contextmenu', e => { const c = e.target.closest('[data-chip]'); if (c){ e.preventDefault(); ACTIONS.muteMenu(Number(c.dataset.chip)); } });
  for (const k of [1, 2, 3]) $(`mute${k}`).addEventListener('click', () => ACTIONS.muteChoice(k));
```

- [ ] **Step 4: Build, test, look**

```bash
node build.js && node tests/ui.js
```

Expected: pass.

In Safari: reload, advance to day 21 with a lit hearth as in plan A task 7, set a person's warmth to 10 in the console and render. A red chip `1 Name is cold` shows. Dispatch `1` with `altKey: true, code: 'Digit1'` and check the cursor sits on that person and an inspector opened. Dispatch `1` with alt and shift and check the mute dialog opened; dispatch `2` and check the chip is gone and `ui.mutes` has `cold:<id>`. Open help and check the Muted list shows it. Screenshot `.superpowers/shots/b4-mute.png`.

- [ ] **Step 5: Commit**

```bash
git add src/page.template.html src/ui tests/ui.js && git commit -m "Alert chips jump to their cause, and a mute menu quiets one chip, one kind here, or one kind everywhere

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The command palette and the stage chord

**Files:**
- Modify: `src/ui/state.js` (`ui.recent`)
- Modify: `src/ui/derive.js` (`paletteRows`, `paletteMatch`)
- Modify: `src/ui/keys.js` (Cmd-K, Ctrl-K, `g` chord, palette dialog rows, stage dialog rows)
- Modify: `src/ui/dialogs.js` (palette, chord)
- Modify: `src/ui/actions.js` (`palette`, `chord`, `stage`, `goalPri`, `gotoSector`, `unmute`, `runRow`)
- Modify: `src/ui/main.js` (palette input wiring)
- Modify: `src/page.template.html` (`#palette`, `#chord` dialogs, CSS)
- Test: `tests/ui.js`

**Interfaces:**
- Produces: `paletteRows()` returns every row `{ label, key, action, arg }`: the static actions from `KEYMAP` (one per label, `speedrow`, `rowPick`, and dialog rows left out) and the dynamic rows: `Inspect <name>`, `Follow <name>`, `<goal title>: Off|On|High`, `Go to <camp>`, `Go to <sector name> <sx>,<sy>`, `Jump to: <chip text>`, `Unmute: <mute>`. `paletteMatch(query, rows)` returns the rows in order: with an empty query, Help first, then the chips, then tools and drawers, then the last five run, then the rest; with a query, rows whose label contains every query word, prefix matches first. `ACTIONS.palette()` opens it. Enter runs the highlighted row through `ACTIONS[row.action](row.arg)` and records it in `ui.recent`. `g` opens the stage chord: a small dialog with one lettered button per reached stage; the letter opens the Goals drawer on that stage.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui.js`:

```js
test('palette rows list every static action once with its key, and the dynamic rows for people, goals, camps, sectors, chips, and mutes', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...DERIVE, ...KEYS, 'paletteRows', 'paletteMatch']);
  api.startWorld('r'); api.camp = api.camps[0]; api.notePulses();
  const rows = api.paletteRows();
  const labels = rows.map(r => r.label);
  assert.equal(new Set(labels).size, labels.length, 'no label twice');
  assert.ok(labels.includes('Help'));
  assert.ok(labels.includes(`Inspect ${api.beings[0].name}`));
  assert.ok(labels.includes('Stock food: High'));
  assert.ok(labels.some(l => /^Go to .* \d+,\d+$/.test(l)), 'a sector row');
  for (const r of rows.filter(r => r.action === 'help')) assert.equal(r.key, '?');
  for (const r of rows) assert.equal(typeof api.ACTIONS[r.action], 'function', r.label);
  const empty = api.paletteMatch('', rows); assert.equal(empty[0].label, 'Help');
  const q = api.paletteMatch('stock high', rows); assert.equal(q[0].label, 'Stock food: High');
  assert.equal(api.paletteMatch('zzzz', rows).length, 0);
});

test('palette and chord keys', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.deepEqual(api.keyAction(ev('k', { metaKey: true }), 'map'), { action: 'palette', arg: undefined });
  assert.deepEqual(api.keyAction(ev('k', { ctrlKey: true }), 'drawer:people'), { action: 'palette', arg: undefined });
  assert.deepEqual(api.keyAction(ev('g'), 'map'), { action: 'chord', arg: undefined });
  assert.deepEqual(api.keyAction(ev('f'), 'dialog:chord'), { action: 'stage', arg: 'fire' });
  assert.deepEqual(api.keyAction(ev('ArrowDown'), 'dialog:palette'), { action: 'paletteMove', arg: 1 });
  assert.deepEqual(api.keyAction(ev('Enter'), 'dialog:palette'), { action: 'paletteRun', arg: undefined });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node tests/ui.js`
Expected: FAIL, `paletteRows is not defined`.

- [ ] **Step 3: Pure rows and match**

Add `recent: [],` to the `ui` object in `state.js`, and save and restore it in `persist` and `restore` as `recent` (an array of labels, at most five).

Append to `src/ui/derive.js`:

```js
/* The command palette's rows. Static rows come from the key map, one per label. Dynamic rows are built on open. */
const STAGE_LETTER = { fire: 'f', food: 'o', tools: 't', shelter: 's', crafts: 'c', sprites: 'p', settlement: 'e' };
function paletteRows(){
  const out = [], seen = new Set();
  for (const k of KEYMAP){
    if (k.focus === 'speedrow' || k.action === 'rowPick' || k.focus.startsWith('dialog')) continue;
    if (seen.has(k.label)) continue; seen.add(k.label);
    out.push({ label: k.label, key: keyName(k), action: k.action, arg: k.arg, group: k.action === 'help' ? 0 : k.action === 'tool' || k.action === 'drawer' ? 2 : 9 });
  }
  for (const a of alerts()) out.push({ label: `Jump to: ${a.text}`, key: a.n <= 9 ? `Alt+${a.n}` : '', action: 'jumpChip', arg: a.n, group: 1 });
  for (const a of campHumans()){ out.push({ label: `Inspect ${a.name}`, key: '', action: 'inspect', arg: a.id, group: 9 }); out.push({ label: `Follow ${a.name}`, key: '', action: 'follow', arg: a.id, group: 9 }); }
  for (const g of GOALS) if (!g.locked) for (const [v, l] of [[0, 'Off'], [1, 'On'], [2, 'High']]) out.push({ label: `${g.title}: ${l}`, key: '', action: 'goalPri', arg: { id: g.id, pri: v }, group: 9 });
  camps.forEach((c, i) => out.push({ label: `Go to ${c.name}`, key: `F${i + 1}`, action: 'campN', arg: i + 1, group: 9 }));
  for (const s of sectors) out.push({ label: `Go to ${s.name} ${s.sx},${s.sy}`, key: '', action: 'gotoSector', arg: { sx: s.sx, sy: s.sy }, group: 9 });
  for (const m of ui.mutes) out.push({ label: `Unmute: ${m}`, key: '', action: 'unmute', arg: m, group: 9 });
  for (const s of STAGES) if (stageReached(s.id)) out.push({ label: `Goals: ${s.label}`, key: `G ${STAGE_LETTER[s.id].toUpperCase()}`, action: 'stage', arg: s.id, group: 9 });
  return out;
}
/* Fuzzy match: every word of the query is a substring of the label. Prefix matches first, then shorter labels. Empty query: help, chips, tools and drawers, recent, the rest. */
function paletteMatch(query, rows){
  const q = query.trim().toLowerCase();
  if (!q){
    const rank = r => r.group < 9 ? r.group : ui.recent.includes(r.label) ? 3 + ui.recent.indexOf(r.label) / 10 : 9;
    return rows.slice().sort((a, b) => rank(a) - rank(b));
  }
  const words = q.split(/\s+/);
  const hit = rows.filter(r => { const l = r.label.toLowerCase(); return words.every(w => l.includes(w)); });
  const score = r => (r.label.toLowerCase().startsWith(words[0]) ? 0 : 1) * 1000 + r.label.length;
  return hit.sort((a, b) => score(a) - score(b));
}
```

`keyName` lives in `dialogs.js`, which is DOM code but a pure function. Move `keyName` from `dialogs.js` to the end of `keys.js` so `derive.js` and the tests reach it. `keys.js` loads after `derive.js`, and function declarations hoist across the joined script, so the order is fine.

- [ ] **Step 4: Keys**

Add to `KEYMAP`:

```js
  { key: 'k',          meta: true, focus: 'any', action: 'palette',   label: 'Command palette', button: 'paletteBtn' },
  { key: 'k',          ctrl: true, focus: 'any', action: 'palette',   label: 'Command palette' },
  { key: 'g',          focus: 'any',    action: 'chord',       label: 'Goals by stage', button: 'chordBtn' },
  { key: 'ArrowDown',  focus: 'dialog:palette', action: 'paletteMove', arg: 1,  label: 'Next command' },
  { key: 'ArrowUp',    focus: 'dialog:palette', action: 'paletteMove', arg: -1, label: 'Previous command' },
  { key: 'Enter',      focus: 'dialog:palette', action: 'paletteRun', label: 'Run command' },
```

and, after the `STAGE_LETTER` table is reachable, one row per stage: `for (const s of STAGES) KEYMAP.push({ key: STAGE_LETTER[s.id], focus: 'dialog:chord', action: 'stage', arg: s.id, label: `Goals: ${s.label}`, button: `chord-${s.id}` });`. `STAGES` is a sim constant, so it exists when `keys.js` loads. Move `STAGE_LETTER` from `derive.js` to the top of `keys.js`, above `KEYMAP`, since both files read it and `keys.js` reads it at load time. Number keys 1 to 9 in `dialog:palette` pick a row: `for (let n = 1; n <= 9; n++) KEYMAP.push({ key: String(n), focus: 'dialog:palette', action: 'palettePick', arg: n, label: `Command ${n}` });`. The palette's text box swallows plain digits while typing, so `palettePick` fires only through Alt+digit there: give those rows `alt: true` and the label `Alt+${n}`.

- [ ] **Step 5: Dialogs, actions, template**

Template, after the mute dialog:

```html
<dialog id="palette">
  <input id="paletteInput" placeholder="Type a command, a name, a goal, a place" autocomplete="off">
  <ol id="paletteList"></ol>
</dialog>
<dialog id="chord">
  <h2>Goals by stage</h2>
  <p id="chordButtons"></p>
</dialog>
```

CSS, before the `[hidden]` rule:

```css
#palette{padding:10px}
#paletteInput{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);font-size:15px}
#paletteList{list-style:none;margin:8px 0 0;padding:0;max-height:50vh;overflow:auto}
#paletteList li{display:flex;justify-content:space-between;gap:12px;padding:5px 8px;border-radius:5px}
#paletteList li.sel{background:color-mix(in srgb,var(--accent) 16%,transparent)}
#paletteList li kbd{margin:0}
```

Add two buttons to the strip's `.ctl` before the help button: `<button class="btn" id="chordBtn">Goals<kbd>G</kbd></button><button class="btn" id="paletteBtn">⌘K<kbd>Ctrl+K</kbd></button>`.

In `src/ui/dialogs.js`:

```js
let palRows = [], palHit = [], palSel = 0;
function openPalette(){ closeDialogs(); palRows = paletteRows(); palSel = 0; ui.focus = 'dialog:palette'; $('paletteInput').value = ''; $('palette').showModal(); renderPalette(); $('paletteInput').focus(); }
function renderPalette(){
  palHit = paletteMatch($('paletteInput').value, palRows).slice(0, 40); palSel = clamp(palSel, 0, Math.max(0, palHit.length - 1));
  $('paletteList').innerHTML = palHit.map((r, i) => `<li class="${i === palSel ? 'sel' : ''}" data-i="${i}"><span>${i < 9 ? `<kbd>Alt+${i + 1}</kbd> ` : ''}${r.label}</span>${r.key ? `<kbd>${r.key}</kbd>` : ''}</li>`).join('') || '<li class="muted">Nothing matches.</li>';
  const sel = $('paletteList').querySelector('.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
}
function paletteMove(d){ palSel = clamp(palSel + d, 0, Math.max(0, palHit.length - 1)); renderPalette(); }
function paletteRun(i = palSel){
  const r = palHit[i]; if (!r) return;
  closeDialogs(); ui.recent = [r.label, ...ui.recent.filter(l => l !== r.label)].slice(0, 5); persist();
  ACTIONS[r.action](r.arg); renderUI(true);
}
function openChord(){
  closeDialogs();
  $('chordButtons').innerHTML = STAGES.filter(s => stageReached(s.id)).map(s => `<button class="btn" id="chord-${s.id}" data-stage="${s.id}">${s.label}<kbd>${STAGE_LETTER[s.id].toUpperCase()}</kbd></button>`).join(' ');
  ui.focus = 'dialog:chord'; $('chord').showModal();
}
```

The chord buttons are built at runtime, so the button test does not see them, but their ids match the `chord-<stage>` rows so the same rule holds by construction.

In `src/ui/actions.js`, add:

```js
  palette(){ openPalette(); },
  paletteMove(d){ paletteMove(d); },
  paletteRun(){ paletteRun(); },
  palettePick(n){ paletteRun(n - 1); },
  chord(){ openChord(); },
  stage(id){ closeDialogs(); openDrawer('goals', true); ui.unfold[id] = true; const i = drawerRows('goals').findIndex(r => r.kind === 'stage' && r.id === id); if (i >= 0) ui.row.goals = i; renderUI(true); },
  goalPri({ id, pri }){ goalPriority[id] = pri; renderUI(true); },
  gotoSector({ sx, sy }){ goto(sx, sy); },
  unmute(m){ ui.mutes.delete(m); persist(); renderUI(true); },
```

In `src/ui/main.js`: the keydown handler's `if (e.target.tagName === 'INPUT') return;` must let the palette's input through for its own rows: change it to `if (e.target.tagName === 'INPUT' && e.target.id !== 'paletteInput') return;`. Wire the input and list:

```js
  $('paletteInput').addEventListener('input', () => { palSel = 0; renderPalette(); });
  $('paletteList').addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) paletteRun(Number(li.dataset.i)); });
  $('paletteBtn').addEventListener('click', ACTIONS.palette); $('chordBtn').addEventListener('click', ACTIONS.chord);
  $('chordButtons').addEventListener('click', e => { const b = e.target.closest('[data-stage]'); if (b) ACTIONS.stage(b.dataset.stage); });
```

Inside the palette, plain letters must type, not fire actions. In the keydown handler's dialog branch, run `keyAction` only when `ui.focus !== 'dialog:palette'` or the key is an arrow, Enter, Escape, or has Alt.

- [ ] **Step 6: Build, test, look**

```bash
node build.js && node tests/ui.js
```

Expected: pass.

In Safari: reload, close the dialog, dispatch `k` with `metaKey: true`. The palette opens with Help first. Set the input to `stock high` through `evaluate_javascript`, fire an `input` event, dispatch Enter, and check `goalPriority.food === 2`. Dispatch `g` then `o`: the Goals drawer opens with the Food stage row selected and unfolded. Screenshot `.superpowers/shots/b5-palette.png` with the palette open on an empty query.

- [ ] **Step 7: Commit**

```bash
git add src/page.template.html src/ui tests/ui.js && git commit -m "The command palette over every action and every named thing, and the G chord for a stage

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Chronicle rows jump, the world map title, and the notes

**Files:**
- Modify: `src/ui/actions.js` (`rowOpen` for `line` rows)
- Modify: `src/ui/panels.js` (`where` reads the camp name on the world map)
- Modify: `design/notes.md` (section 13, final)
- Modify: `src/page.template.html` (help: the rules paragraph)

- [ ] **Step 1: Chronicle rows**

A chronicle line has no place of its own. Until the naming work tags lines, Enter on a line row moves the cursor to the first named person in the line: in `rowOpen`, add

```js
  else if (r.kind === 'line'){ const who = campHumans().concat(beings.filter(b => b.alive && b.species !== 'human')).find(b => r.e.text.includes(b.name)); if (who){ cursorTo(who.x, who.y, who.z); ACTIONS.inspect(who.id); } }
```

Animals have no names, so `b.name` is undefined for them and `includes(undefined)` is false; the filter above is harmless and keeps the shape for later.

- [ ] **Step 2: The world map title**

In `renderUI`, the `where` line for the world view reads `World map · ${camps.length} camp${camps.length > 1 ? 's' : ''}`.

- [ ] **Step 3: Run everything and look at both widths**

```bash
node build.js && node tests/ui.js && node tests/terrain.js && node tests/crafts.js && node tests/soak.js 2>&1 | tail -6
```

Expected: all pass, the record matches on every seed. Screenshots at 1440 by 900 and 1024 by 768, dark and light, with two drawers open, one drawer popped out, two inspectors, the palette open, and the cursor visible: `.superpowers/shots/b6-*.png`. Check every button prints a key and Esc always has something to close or nothing to do.

- [ ] **Step 4: Notes**

Replace the last bullet of section 13 in `design/notes.md` with:

```markdown
- A tile cursor lives on the map. Arrows move it, Shift by five, Ctrl by a sector. Enter applies the tool. Home goes to the hearth, W to the world map at the camp. The mouse moves it too. The foot names what is under it.
- Tools: Inspect is the default. Light fire and Nudge are one-shot and return to Inspect. Shift with the key or the click keeps them. Camp site left the interface; `setSite` stays in the sim for tests.
- Floating windows: any drawer pops out with O and docks back with O. Enter or a click on a being or tile opens an inspector window; up to six stand at once, each live, F follows. Positions persist.
- Alert chips: Alt+number jumps to the cause, Shift+Alt+number opens the mute menu: this chip, this kind here, this kind everywhere. Muted chips are listed in help and in the palette as Unmute rows.
- Cmd-K or Ctrl-K opens the command palette: every action with its key, and rows for people, goals, camps, sectors, chips, and mutes. G opens the stage chord.
- Every clickable thing has a key, printed on it. `tests/ui.js` fails on a button without one. Movement keys are provisional; change them in `KEYMAP` only.
```

- [ ] **Step 5: Commit**

```bash
git add src/ui design/notes.md && git commit -m "Chronicle rows jump to their people, the world map counts camps, and the notes describe the finished interface

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| 4 jump to cause, mute menu, mute per chip, kind, camp | 4 |
| 6 windows: drag, resize, scroll, Esc, persist, pop out, dock, six inspectors, follow | 2, 3 |
| 7 cursor in three views, Shift, Ctrl, follow across edges, Home, W, Enter, mouse, foot | 1 |
| 8 tools: default, one-shot, Shift sticks, Light fire, Nudge, Camp site out | 3 |
| 9 key map: every row not in plan A | 1 to 5 |
| 10 palette: static and dynamic rows, empty order, fuzzy, keys shown | 5 |
| 11 mute dialog, one dialog at a time | 4, 5 |
| 13 tests: Esc from each focus, palette lists every static action, button keys | 1 to 5 |
| 15 steps 7 to 11 | 0 to 6 |

Not done here, and named: the spoil chip and the dead-for-a-day people row wait on the naming work's chronicle tags and death stamp. The chronicle name search in the drawer filter is in the naming spec's interface section and lands with it.
