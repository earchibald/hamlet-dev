# Become E3: the beat — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended)
> or `superpowers:executing-plans` to implement this plan task by task. Steps use `- [ ]` for tracking.

**Goal:** Make one act, not one age, the unit the player watches and steps through, and give every act a
face the player can read.

**Architecture:** The simulation already stops between acts — `step(oneAct)` on branch `age-beat` does it,
and `agePos` carries the resume. This plan is the view half. The frame loop stops counting ages and starts
counting beats; a stepped beat plays instead of snapping; each act draws a stroke mark and a word on the
ground it changed; the timeline lights the act being played. Nothing in this plan enters `src/sim/`.

**Tech stack:** Plain scripts sharing one scope, joined by `src/ui/index.js`. No ES modules, no framework,
no build step but `node build.js`. Canvas 2D for the map. `node --test` for the tests.

## Global constraints

- **Branch from `take-turn-one-act`** (hamlet-mythos, PR #47, on top of the merged #45), not from dev.
  Work in `/Users/earchibald/Worktrees/hamlet-become` on branch `become-e3`. Merge dev in when #47 lands.
- **The view never asks whether an act came from the player or from a god.** `takeTurn` applies the
  option, moves past the god, and returns without resuming; a step is the only thing that advances an
  age. So after a `choose` lands, the age stands one god past the player's and the view draws that as
  one beat like any other. **A branch on `byPlayer` anywhere in the playback path is a fault in the
  engine, not in the view.** If you find yourself needing one, stop and report it: the engine is not
  giving the view what it should, and the fix belongs in `src/sim/gods.js` with the session that owns
  it. Do not route around it in `src/ui/`. A reviewer can check this by grepping the playback path.
- **Nothing in this plan changes `src/sim/`.** If a task seems to need it, stop and ask; `src/sim/gods.js`
  and `src/sim/door.js` belong to the hamlet-mythos session.
- **`src/ui/derive.js` and `src/ui/keys.js` have no DOM.** Every pure part goes there so `tests/ui.js`
  reaches it in Node. Drawing goes in `map.js` or `timeline.js`.
- **View state changes go in `actions.js`**, with the three recorded exceptions in CLAUDE.md. Keys go in
  `KEYMAP` in `keys.js` and nowhere else.
- **No `innerHTML` in `src/ui/timeline.js`.** A test asserts the string is absent from the file. Build
  nodes and set `textContent`.
- **No duration or rate reaches `src/sim/`.** `BEAT_MS`, `TWEEN` and `PACES` live in `src/ui/state.js`.
- **If a test fails, your first assumption is that the test is wrong.** Do not change production code to
  make a test pass without saying, in your report, why the production code was wrong.
- **Every new top-level `let`/`var` in `src/sim/` would need a `SAVED_STATE`/`NOT_SAVED` entry** — but this
  plan adds none, because it adds nothing to `src/sim/`.
- **Run `node build.js` after every change to `src/`.** `dist/hearth-sim.html` is what gets published.
- **Gates before any PR:** `npm run fast` (632 pass on the base), `node tests/soak.js` (67, golden
  untouched), `node build.js`. The golden must not move. If it moves, you have leaked a rule.

## File structure

| File | Responsibility after this plan |
|---|---|
| `src/ui/state.js` | `BEAT_MS`, `PACES`, `TWEEN`, and the beat's own clock and cursor |
| `src/ui/derive.js` | `beatsDue`, `beatTier`, `beatPlan`, `markFor`, `actCard` — all pure, all tested in Node |
| `src/ui/main.js` | The frame loop counts beats and keeps drawing while a stepped beat plays |
| `src/ui/actions.js` | `step`, `hurry`, `speed`, `takeGod` — every view-state change |
| `src/ui/map.js` | `drawField` per beat; the mark, the word, and the fading of the act before |
| `src/ui/marks.js` | **New.** The mark table: one stroke path list and one word per gesture kind |
| `src/ui/timeline.js` | Lights the cell of the act being played; a cell opens the act card |
| `src/ui/panels.js` | The act's hover card |
| `src/ui/dialogs.js` | The hurry's confirm; `Take a god` on the start dialog |
| `src/ui/keys.js` | `.` reads "Step one act" in the ages |
| `src/page.template.html` | The pace buttons, the hurry dialog, the start dialog's second button |
| `tests/ui.js` | Every pure part, the split `still` rule, the mark table's completeness |

`src/ui/marks.js` is new and joins `src/ui/index.js` **before `map.js`**, because `map.js` reads its table.

---

### Task 1: The beat clock

**Files:**
- Modify: `src/ui/state.js:21-27` (the ages block)
- Modify: `src/ui/derive.js:36-60` (`agesDue`, `tweenTier`, `gestureSlice`)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `BEAT_MS` (number, 1000), `PACES` (array `[0.25, 0.5, 1, 2]`), `beatsDue(acc, dt, pace)` →
  `{ n, acc }`, `beatTier(ms)` → `'full'|'figure'|'walk'|'none'`. `agesDue` and `gestureSlice` are gone.

- [ ] **Step 1: Write the failing tests**

Add to `tests/ui.js`, beside the other derive tests:

```js
test('the beat clock: a frame owes as many beats as its time buys, and carries the rest', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'beatsDue', 'beatTier', 'BEAT_MS', 'PACES']);
  assert.equal(api.BEAT_MS, 1000);
  assert.deepEqual(api.PACES, [0.25, 0.5, 1, 2]);
  assert.deepEqual(api.beatsDue(0, 1000, 1), { n: 1, acc: 0 });
  assert.deepEqual(api.beatsDue(0, 500, 1), { n: 0, acc: 0.5 });
  assert.deepEqual(api.beatsDue(0.5, 500, 1), { n: 1, acc: 0 });
  assert.deepEqual(api.beatsDue(0, 1000, 2), { n: 2, acc: 0 });
  assert.deepEqual(api.beatsDue(0, 1000, 0.25), { n: 0, acc: 0.25 });
});

test('the beat clock: a tab that slept owes at most eight beats and drops the rest', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'beatsDue']);
  assert.deepEqual(api.beatsDue(0, 60000, 1), { n: 8, acc: 0 });
});

test('the tier reads the beat length, and every pace on the ladder lands where the design says', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'beatTier', 'BEAT_MS', 'PACES']);
  const tierAt = p => api.beatTier(api.BEAT_MS / p);
  assert.equal(tierAt(0.25), 'full', 'a quarter speed beat is four seconds');
  assert.equal(tierAt(0.5), 'full');
  assert.equal(tierAt(1), 'full', 'single speed is the readable default and draws everything');
  assert.equal(tierAt(2), 'figure', 'double speed drops the intent cue and keeps the figure');
  assert.equal(api.beatTier(200), 'walk');
  assert.equal(api.beatTier(50), 'none');
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd /Users/earchibald/Worktrees/hamlet-become && node --test tests/ui.js 2>&1 | grep -E 'beat clock|tier reads|^ℹ (pass|fail)'`

Expected: three failures, each naming an export that does not exist (`beatsDue`, `beatTier`, `PACES`).

- [ ] **Step 3: Replace the age clock with the beat clock in `state.js`**

In `src/ui/state.js`, replace the block at lines 21–27 with:

```js
/* The ages. pace is the speed of the gods era: a quarter, a half, single, or double. It is not saved; a
   new world starts at single. lastEra is the era the last frame saw, so the frame can see the flip at
   settle. */
const BEAT_MS = 1000;
const PACES = [0.25, 0.5, 1, 2];
/* The tween of one beat. It runs for BEAT_MS / pace, read at run time, so no number here names a pace.
   full, figure, and walk are that length in milliseconds: the least a tier of the drawing is worth. cue,
   draw and word are fractions of the beat itself, and say when each stage of it ends. These are view
   durations, and they stay out of src/sim/. */
const TWEEN = { full: 1000, figure: 300, walk: 100, cue: 0.25, draw: 0.6, word: 0.85 };
let pace = 1, lastEra = 'days';
```

`TWEEN.stagger` goes. One act has nobody to be staggered against.

- [ ] **Step 4: Replace `agesDue` and `tweenTier` in `derive.js`**

In `src/ui/derive.js`, replace `agesDue` (lines 36–40) with:

```js
/* How many beats a frame owes. acc is the part of a beat carried from the last frame. At most eight in a
   frame: more than that is a tab that slept, and a slept tab snaps rather than replaying in fast forward. */
function beatsDue(acc, dt, pace){
  const a = acc + dt * pace / BEAT_MS, n = Math.floor(a);
  return n > 8 ? { n: 8, acc: 0 } : { n, acc: a - n };
}
```

Rename `tweenTier` to `beatTier` and change its comment's first line to read
`/* What a beat of this many milliseconds is worth drawing. The length is BEAT_MS / pace, read at run`.
The body does not change. Delete `gestureSlice` entirely (lines 54–58 and its comment).

- [ ] **Step 5: Fix every caller**

Run: `grep -rn 'agesDue\|tweenTier\|gestureSlice\|AGE_MS\|TWEEN.stagger' src/ tests/`

Change each hit: `agesDue` → `beatsDue`, `tweenTier` → `beatTier`, `AGE_MS` → `BEAT_MS`. In
`src/ui/map.js` the `slices` line and the `gestureSlice` import go — Task 6 rewrites that function, so for
now make `drawField` use `f` directly wherever it used `slices[i]`.

- [ ] **Step 6: Run the tests**

Run: `node --test tests/ui.js 2>&1 | grep -E '^ℹ (pass|fail)'`
Expected: the three new tests pass, `fail 0`. Old tests naming `agesDue` or `tweenTier` will have been
renamed in step 5; if one still fails, read it — it may be telling you a caller was missed.

- [ ] **Step 7: Build and commit**

```bash
node build.js
git add -A && git commit -m "The view counts beats, not ages

BEAT_MS replaces AGE_MS and the ladder becomes a quarter, a half, single and
double. TWEEN.stagger goes with gestureSlice: an act has nobody to be
staggered against once an act is the unit."
```

---

### Task 2: The frame loop plays beats, and a stepped beat plays

**Files:**
- Modify: `src/ui/main.js:3-13` (the frame loop)
- Modify: `src/ui/actions.js:249` (`ACTIONS.step`)
- Modify: `src/ui/state.js` (the beat cursor)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `beatsDue` (Task 1), `step(oneAct)` from `src/sim/main.js` on branch `age-beat`.
- Produces: `ui.playing` (boolean — a stepped beat is running), and the rule that `acc` is the fraction of
  the current beat in both eras of the gods era's playback.

- [ ] **Step 1: Write the failing test**

```js
test('a stepped beat plays: the world is paused, and the beat still has a fraction to draw', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'beatStill']);
  api.paused = true; api.ui.playing = true;
  assert.equal(api.beatStill(false), false, 'a beat the player stepped plays while paused');
  api.ui.playing = false;
  assert.equal(api.beatStill(false), true, 'a world paused between beats holds where it stands');
  api.paused = false; api.ui.playing = false;
  assert.equal(api.beatStill(false), false, 'a running world always plays');
  api.ui.playing = true;
  assert.equal(api.beatStill(true), true, 'a dialog holds everything, a stepped beat included');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ui.js 2>&1 | grep -E 'stepped beat plays|^ℹ (pass|fail)'`
Expected: FAIL, `beatStill` is not a function.

- [ ] **Step 3: Add `beatStill` to `derive.js`**

```js
/* Whether the drawing holds at the end of its beat instead of playing. A world the player paused between
   beats holds, so nothing sits half drawn. A world the player stepped plays its beat and then holds, which
   is the whole of what Step is for. A dialog holds everything. */
function beatStill(dialogOpen){ return dialogOpen || (paused && !ui.playing); }
```

- [ ] **Step 4: Add the cursor to `state.js`**

In the `ui` object in `src/ui/state.js`, beside the other view fields:

```js
  playing: false,      /* a beat the player stepped is running; the frame loop drives it and then clears it */
```

`ui.playing` is not saved. It names one moment of one beat.

- [ ] **Step 5: Drive it from the frame loop**

In `src/ui/main.js`, replace the gods-era branch of `frame()` (line 10) and add the stepped-beat clock
directly after the `if (!paused)` block:

```js
      if (inAges()){ if (!anyDialogOpen()){ const d = beatsDue(acc, dt, pace); acc = d.acc; for (let k = 0; k < d.n && inAges(); k++) step(true); } }
```

```js
  /* A stepped beat has no world running to carry its clock, so the frame loop carries it. It runs at the
     full tier whatever the pace says: Step is the reading mode, and the pace buttons govern running. */
  if (ui.playing && !anyDialogOpen()){
    acc = clamp(acc + dt / BEAT_MS, 0, 1);
    if (acc >= 1) ui.playing = false;
  }
```

- [ ] **Step 6: Make `ACTIONS.step` play**

In `src/ui/actions.js` replace line 249 with:

```js
  /* One act in the ages, one tick in the days. In the ages the beat then plays while the world is paused;
     stepping again cuts the beat that is running short and starts the next, so holding the key keeps up. */
  step(){ setPaused(true); if (inAges()){ ui.playing = false; acc = 0; step(true); ui.playing = true; } else step(); renderUI(true); },
```

- [ ] **Step 7: Run the test and the whole file**

Run: `node --test tests/ui.js 2>&1 | grep -E '^ℹ (pass|fail)'`
Expected: `fail 0`.

- [ ] **Step 8: Build and commit**

```bash
node build.js
git add -A && git commit -m "A stepped beat plays instead of cutting

Step paused the world and drawField forced the tween to its end, so the walk,
the stroke, the wash and the caption have never once run on a stepped age. The
still rule splits: a world paused between beats holds, a world the player
stepped plays its beat and then holds."
```

---

### Task 3: `drawField` draws one beat

**Files:**
- Modify: `src/ui/map.js:158-200` (`drawField`)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `beatTier`, `beatStill` (Tasks 1–2).
- Produces: a `drawField` whose cache key moves with the act, not the age.

- [ ] **Step 1: Change the key and the still rule**

In `src/ui/map.js`, in `drawField()`:

Replace `const span = AGE_MS / pace, tier = tweenTier(span);` with:

```js
  /* A stepped beat always plays at the full tier: Step is the reading mode, and the pace buttons govern
     running. A running beat reads the ladder. */
  const span = ui.playing ? TWEEN.full : BEAT_MS / pace, tier = beatTier(span);
```

Replace the `key` line so the cache turns over on the act rather than the age:

```js
  const key = [seedText, age, creation.gestures.length, creation.discards, liveRegions().length].join(':');
```

Replace the `still` line (currently line 171) and the `f` line with:

```js
  const still = beatStill(anyDialogOpen());
  const f = tier === 'none' || fieldJump || still ? 1 : clamp(acc, 0, 1);
```

The `fieldJump` rule keeps its shape but now reads the beat: a jump is a new world, a thrown-back valley,
or a frame that ran two or more beats. Replace its assignment with:

```js
    fieldJump = !fieldKey || creation.discards !== fieldDiscards || (age !== fieldAge && age !== fieldAge + 1) || creation.gestures.length > fieldGestures + 1;
```

and add `fieldGestures` beside `fieldAge` in `src/ui/state.js`'s cache block, set to
`creation.gestures.length` where `fieldAge` is set.

- [ ] **Step 2: Draw only the beat's own gesture**

Replace the `recs`/`slices` lines with:

```js
  /* One beat is one act, so one gesture draws. The act before it fades over this beat, so a player who
     looked away for one act can still see what they missed. */
  const recs = creation.gestureAge === age ? creation.gestures : [];
  const now = recs.length ? recs[recs.length - 1] : null;
  const before = recs.length > 1 ? recs[recs.length - 2] : null;
```

Everywhere `drawField` looped `recs.forEach((rec, i) => …)` with `slices[i]`, draw `now` at `f` and, when
`f < 1`, `before` at `1` with `wctx.globalAlpha = 1 - f` around it.

- [ ] **Step 3: Run the tests**

Run: `node --test tests/ui.js 2>&1 | grep -E '^ℹ (pass|fail)'`
Expected: `fail 0`. The equality test ("a watched creation equals an unwatched one") is the one that
matters here; if it fails, you have made the view step the world.

- [ ] **Step 4: Build and commit**

```bash
node build.js
git add -A && git commit -m "The field is drawn per act, and the act before it fades over the act now

The cache turns over on the gesture count rather than the age, so the ground is
the ground that act left. A finished mark fades over the beat after it rather
than vanishing when the next begins."
```

---

### Task 4: The pace ladder in the ages

**Files:**
- Modify: `src/ui/state.js:67` (`SPEEDS` stays; `PACES` is Task 1's)
- Modify: `src/ui/actions.js:11,251-255`
- Modify: `src/ui/keys.js:100`
- Modify: `src/page.template.html:205`
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `PACES` (Task 1).
- Produces: `ACTIONS.speedStep(i)` indexes `PACES` in the ages and `SPEEDS` in the days.

`SPEEDS` is shared today: `ACTIONS.speed(s)` sets the pace in the ages and the speed in the days, and
`Shift+1..4` is built from `SPEEDS` alone. The ladders now differ, so every place that reads `SPEEDS` must
ask which era it is in first.

- [ ] **Step 1: Write the failing test**

```js
test('the ladders differ by era: a quarter, a half, single and double in the ages, the old four in the days', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'ladder', 'PACES', 'SPEEDS']);
  api.startWorld('gamma');
  assert.deepEqual(api.ladder(), api.PACES, 'the ages run on the pace ladder');
  api.runAges();
  assert.deepEqual(api.ladder(), api.SPEEDS, 'the days run on the speed ladder');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ui.js 2>&1 | grep -E 'ladders differ|^ℹ (pass|fail)'`
Expected: FAIL, `ladder` is not a function.

- [ ] **Step 3: Add `ladder()` to `derive.js`**

```js
/* Which ladder the speed buttons are on. The ages want a quarter and a half, because a creation is minutes
   of a game measured in hours; the days want the old four. H hurries the ages, so nothing above double. */
function ladder(){ return inAges() ? PACES : SPEEDS; }
```

- [ ] **Step 4: Put every caller on it**

In `src/ui/actions.js`:

```js
  slower(){ ACTIONS.speedStep(Math.max(0, ladder().indexOf(inAges() ? pace : speed) - 1)); },
  faster(){ ACTIONS.speedStep(Math.min(ladder().length - 1, ladder().indexOf(inAges() ? pace : speed) + 1)); },
  speedStep(i){ ACTIONS.speed(ladder()[clamp(i, 0, ladder().length - 1)]); },
```

`setPace` at line 11 matches on `Number(b.dataset.speed)`, which is now a fraction in the ages. Replace the
button markup at `src/page.template.html:205` so each button carries both and the strip relabels by era:

```html
      <span id="speeds"><button class="btn" id="speed1" data-speed="1" data-pace="0.25">1×<kbd>Shift+1</kbd></button><button class="btn" id="speed4" data-speed="4" data-pace="0.5">4×<kbd>Shift+2</kbd></button><button class="btn" id="speed16" data-speed="16" data-pace="1">16×<kbd>Shift+3</kbd></button><button class="btn" id="speed64" data-speed="64" data-pace="2">64×<kbd>Shift+4</kbd></button></span>
```

In `src/ui/main.js:41`, read the right attribute:

```js
  $('speeds').addEventListener('click', e => { const b = e.target.closest('[data-speed]'); if (b) ACTIONS.speed(Number(inAges() ? b.dataset.pace : b.dataset.speed)); });
```

In `setPace`, match on `data-pace`, and relabel each button's first text node to `¼×`, `½×`, `1×`, `2×`
in the ages and back to `1×`, `4×`, `16×`, `64×` in the days. Do the relabelling in `setPace`/`setSpeed`,
not in the frame loop: it changes only when the era or the ladder changes.

In `src/ui/keys.js:100`, build the rows from both ladders so the label reads correctly in help. The key row
stays one per index; its label becomes `Pace ¼× · Speed 1×` style, so one row serves both eras.

- [ ] **Step 5: Run the tests**

Run: `node --test tests/ui.js 2>&1 | grep -E '^ℹ (pass|fail)'`
Expected: `fail 0`. The "every button has a key" test covers the four buttons; if it fails, a button lost
its `id`.

- [ ] **Step 6: Build and commit**

```bash
node build.js
git add -A && git commit -m "The ages run on their own ladder: a quarter, a half, single, double

Sixteen and sixty-four had no purpose once H hurries to the valley, and the
slow end had no quarter or half. The buttons carry both ladders and relabel by
era, because the strip already says different things in the two eras."
```

---

### Task 5: The hurry asks first

**Files:**
- Modify: `src/ui/actions.js:256` (`hurry`)
- Modify: `src/ui/dialogs.js`
- Modify: `src/page.template.html` (a new `<dialog id="hurry">` beside `#start`)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `ACTIONS.hurry` opens the dialog; `ACTIONS.hurryGo` does the skipping.

- [ ] **Step 1: Write the failing test**

```js
test('the hurry asks before it skips, and declining leaves the creation where it stood', () => {
  const api = loadUI(['state', 'derive', 'keys'], [...DERIVE, 'KEYMAP']);
  const row = api.KEYMAP.find(r => r.action === 'hurry');
  assert.ok(row, 'H is still the hurry');
  assert.equal(row.label, 'Hurry to the valley', 'the label says where it goes, not what it skips');
  const go = api.KEYMAP.find(r => r.action === 'hurryGo');
  assert.equal(go, undefined, 'the doing of it is not on a key: it is the dialog button');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ui.js 2>&1 | grep -E 'hurry asks|^ℹ (pass|fail)'`

- [ ] **Step 3: Add the dialog to `src/page.template.html`**, directly after `</dialog>` of `#start`:

```html
<dialog id="hurry">
  <h2>Hurry to the valley?</h2>
  <p>The rest of the creation happens at once. You will see the valley it made, and none of the making.</p>
  <p class="muted" id="hurryLeft"></p>
  <p><button class="btn" type="button" id="hurryGo">Hurry<kbd>Enter</kbd></button> <button class="btn" type="button" id="hurryStay">Stay and watch<kbd>Esc</kbd></button></p>
</dialog>
```

- [ ] **Step 4: Open it from `actions.js`**

```js
  hurry(){ if (!inAges()){ say('The valley is already made.'); return; } openHurry(); },
  hurryGo(){ closeDialogs(); runAges(); renderUI(true); },
```

and in `src/ui/dialogs.js`:

```js
/* H cannot be undone and it throws away the thing the creation is for, so it asks. The ages hold while it
   is open, as they hold behind any dialog. */
function openHurry(){
  closeDialogs();
  $('hurryLeft').textContent = `Age ${age}. ${awakeGods().length} gods are still awake.`;
  ui.focus = 'dialog:hurry';
  $('hurry').showModal();
  $('hurryGo').focus();
}
```

Wire both buttons in `initUI()` in `main.js` beside the other dialog buttons, and give `dialog:hurry` a row
in the focus ring exactly as `dialog:mute` has one.

- [ ] **Step 5: Run the tests, build, commit**

```bash
node --test tests/ui.js 2>&1 | grep -E '^ℹ (pass|fail)'
node build.js
git add -A && git commit -m "The hurry asks before it skips

H throws away the whole of what E3 draws and cannot be taken back, so it names
what is lost and offers to stay. Once confirmed it is still a hurry: it snaps,
draws nothing, and ends in the valley."
```

---

### Task 6: The act's face

**Files:**
- Create: `src/ui/marks.js`
- Modify: `src/ui/index.js` (join `marks` before `map`)
- Modify: `src/ui/map.js` (draw the mark and the word)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `creation.gestures` records — `{ kind, god, age, from, to, said, weighed, … }`.
- Produces: `MARKS`, an object keyed by gesture kind, each `{ word, paths }` where `paths` is an array of
  SVG-style path strings in a 48-unit box; and `markFor(kind)` → that row or null.

The eighteen kinds, from `grep -o "gesture(g, '[a-z]*'" src/sim/gods.js` plus the map's own: `split`,
`claim`, `make`, `raise`, `dig`, `flow`, `pool`, `burn`, `freeze`, `hide`, `show`, `battle`, `twist`,
`mingle`, `sleep`, `born`, `unmade`, `backstop`. `wash` is drawn by `WASH_INK` and takes the mark of the
act its `value` names (`freeze`, `hide` or `show`).

- [ ] **Step 1: Write the failing test**

```js
test('every gesture the map can draw has a mark and a word, so a new act cannot reach the map with nothing to show', () => {
  const api = loadUI(['state', 'derive', 'marks'], [...DERIVE, 'MARKS', 'markFor']);
  const kinds = ['split','claim','make','raise','dig','flow','pool','burn','freeze','hide','show','battle','twist','mingle','sleep','born','unmade','backstop'];
  for (const k of kinds){
    const m = api.markFor(k);
    assert.ok(m, `${k} has no mark`);
    assert.ok(m.word && m.word.length, `${k} has no word`);
    assert.ok(Array.isArray(m.paths) && m.paths.length, `${k} has no strokes`);
    for (const d of m.paths) assert.match(d, /^M[\d.\s]/, `${k} has a stroke that does not start with a move`);
  }
  assert.equal(api.markFor('wash', 'freeze'), api.markFor('freeze'), 'a wash takes the mark of the act it is');
  assert.equal(api.markFor('wash', 'hide'), api.markFor('hide'));
  assert.equal(api.markFor('nonesuch'), null, 'an unknown kind draws nothing rather than guessing');
});

test('a mark is one word, and the word is the act in the third person', () => {
  const api = loadUI(['state', 'derive', 'marks'], [...DERIVE, 'MARKS']);
  for (const k in api.MARKS){
    const w = api.MARKS[k].word;
    if (k === 'backstop') continue;
    assert.equal(w.split(' ').length, 1, `${k}'s word is more than one word`);
    assert.equal(w, w.toLowerCase(), `${k}'s word is stored lower case; the map sets the case`);
  }
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/ui.js 2>&1 | grep -E 'gesture the map|one word|^ℹ (pass|fail)'`

- [ ] **Step 3: Write `src/ui/marks.js`**

Take the eighteen rows from the approved mockup at
`https://claude.ai/artifact/BzQJ1Fi6WE3Kyi3zrGirq1`, board "The eighteen marks". The file is a table and a
lookup, nothing else:

```js
/* The face of an act. Every mark is drawn in a 48-unit box, one weight, round caps, in the palette's own
   ink over a disc of the map's background. They are strokes, never sprites and never emoji: the map draws
   sprites for people and creatures, and a god's act is not a thing on the ground but something done to it.
   Pairs read against each other — raise and dig are one chevron flipped, hide and show one circle closed
   and radiating. The word is not a training wheel: eighteen marks is more than anyone learns at once. */
const MARKS = {
  split:    { word: 'parts',   paths: ['M10 38 L38 10', 'M6 16 A18 18 0 0 1 22 6', 'M26 42 A18 18 0 0 0 42 32'] },
  claim:    { word: 'claims',  paths: ['M24 6 A18 18 0 1 1 23.9 6', 'M24 16 A8 8 0 1 1 23.9 16'] },
  make:     { word: 'makes',   paths: ['M8 40 L40 40', 'M24 40 L24 18', 'M24 22 L15 13', 'M24 22 L33 13'] },
  raise:    { word: 'raises',  paths: ['M8 38 L40 38', 'M12 28 L24 12 L36 28'] },
  dig:      { word: 'digs',    paths: ['M8 12 L40 12', 'M12 22 L24 38 L36 22'] },
  flow:     { word: 'flows',   paths: ['M6 28 C14 14 20 42 28 28 C32 21 36 18 42 20', 'M36 14 L42 20 L36 26'] },
  pool:     { word: 'pools',   paths: ['M10 14 L10 26 A14 12 0 0 0 38 26 L38 14', 'M16 30 C20 26 22 34 26 30 C29 27 31 31 34 29'] },
  burn:     { word: 'burns',   paths: ['M24 6 C33 18 38 24 38 30 A14 14 0 0 1 10 30 C10 22 18 18 24 6 Z', 'M24 25 C28 31 29 32 29 34 A5 5 0 0 1 19 34 C19 31 21 30 24 25 Z'] },
  freeze:   { word: 'freezes', paths: ['M24 7 L24 41', 'M9 15.5 L39 32.5', 'M39 15.5 L9 32.5', 'M24 14 L19 10', 'M24 14 L29 10', 'M24 34 L19 38', 'M24 34 L29 38'] },
  hide:     { word: 'hides',   paths: ['M24 12 A15 15 0 1 1 23.9 12', 'M5 31 L43 21'] },
  show:     { word: 'shows',   paths: ['M24 17 A7 7 0 1 1 23.9 17', 'M24 3 L24 8', 'M24 40 L24 45', 'M3 24 L8 24', 'M40 24 L45 24', 'M9.5 9.5 L13 13', 'M35 35 L38.5 38.5', 'M38.5 9.5 L35 13', 'M13 35 L9.5 38.5'] },
  battle:   { word: 'wars',    paths: ['M11 11 L37 37', 'M37 11 L11 37', 'M9 9 L15 9', 'M9 9 L9 15', 'M39 39 L33 39', 'M39 39 L39 33'] },
  twist:    { word: 'twists',  paths: ['M10 38 C10 24 38 25 38 13 C38 5 28 5 26 13 C24 23 34 27 38 31'] },
  mingle:   { word: 'mingles', paths: ['M18 24 A11 11 0 1 1 17.9 24', 'M30 24 A11 11 0 1 1 29.9 24'] },
  sleep:    { word: 'sleeps',  paths: ['M8 26 A16 16 0 0 1 40 26', 'M14 33 L18 29', 'M24 36 L24 30', 'M34 33 L30 29'] },
  born:     { word: 'wakes',   paths: ['M24 14 A10 10 0 1 1 23.9 14', 'M24 1 L24 7', 'M24 41 L24 47', 'M1 24 L7 24', 'M41 24 L47 24', 'M7.5 7.5 L12 12', 'M36 36 L40.5 40.5', 'M40.5 7.5 L36 12', 'M12 36 L7.5 40.5'] },
  unmade:   { word: 'unmade',  paths: ['M24 6 A18 18 0 1 0 39 33', 'M31 40 L44 27', 'M31 27 L44 40'] },
  backstop: { word: 'the world holds', paths: ['M16 8 L8 8 L8 40 L16 40', 'M32 8 L40 8 L40 40 L32 40', 'M24 18 L24 30'] },
};
/* A wash is the act it carries: a freeze, a hiding, or a showing. */
function markFor(kind, value){ return MARKS[kind === 'wash' ? value : kind] || null; }
```

`markFor` takes no default for `value`. A `wash` record always carries the act it is — `WASH_INK` in
`src/ui/map.js` already keys off `rec.value` — so a missing value is a fault to see, not to paper over.
An unknown kind returns null and `drawMark` draws nothing.

- [ ] **Step 4: Join it and draw it**

Add `'marks'` to the list in `src/ui/index.js`, **before** `'map'`.

In `src/ui/map.js`, add the drawing beside the other gesture drawing. `Path2D` takes the path strings
directly, so the table needs no parser:

```js
/* The act's face: the mark draws itself stroke by stroke over TWEEN.cue to TWEEN.draw, then the word
   appears under it. The disc is the map's own background at just over half, so the mark reads on any
   country and the ground still shows through. */
function drawMark(rec, f, alpha){
  const m = markFor(rec.kind, rec.value); if (!m) return;
  const q = tileSpot(rec.to); if (!q) return;
  const d = clamp((f - TWEEN.cue) / (TWEEN.draw - TWEEN.cue), 0, 1);
  if (d <= 0) return;
  wctx.save();
  wctx.globalAlpha = alpha;
  wctx.beginPath(); wctx.arc(q.x, q.y, 34, 0, Math.PI * 2);
  wctx.fillStyle = P['map-halo']; wctx.globalAlpha = alpha * 0.5; wctx.fill();
  wctx.globalAlpha = alpha;
  wctx.translate(q.x - 20, q.y - 20); wctx.scale(0.833, 0.833);
  wctx.strokeStyle = P['field-line']; wctx.lineWidth = 4.3; wctx.lineCap = 'round'; wctx.lineJoin = 'round';
  const n = Math.ceil(d * m.paths.length);
  for (let i = 0; i < n; i++) wctx.stroke(new Path2D(m.paths[i]));
  wctx.restore();
  if (f < TWEEN.word) return;
  wctx.save();
  wctx.globalAlpha = alpha;
  wctx.font = 'bold 17px "Atkinson Hyperlegible", system-ui, sans-serif';
  wctx.textAlign = 'center';
  wctx.lineWidth = 4; wctx.strokeStyle = P.bg; wctx.strokeText(m.word.toUpperCase(), q.x, q.y + 53);
  wctx.fillStyle = P['field-line']; wctx.fillText(m.word.toUpperCase(), q.x, q.y + 53);
  wctx.restore();
}
```

Call it from `drawField` for `now` at `f` and alpha `1`, and for `before` at `1` and alpha `1 - f`. Add
`'bg'` and `'map-halo'` to the palette read at `src/ui/map.js:6` if they are not already there.

- [ ] **Step 5: Make the caption name the act, not the age**

`drawCaption` in `src/ui/map.js` takes "the newest line of the age that is major, else the newest line
there is". That was right when a beat was a whole age. Now the caption belongs to the act being played.

Each gesture carries `said`, the index of the legend line that act wrote, so read the line from the record
rather than guess it from the age:

```js
/* The caption is the line the act itself wrote. A gesture that wrote no line has no caption; the age's
   close takes the newest major line of the close, which is where the rest gate, the strain and a
   backstop speak. */
function captionFor(rec){
  if (!rec) return majorOfClose();
  return rec.said !== null && rec.said !== undefined && legends[rec.said] ? legends[rec.said].text : '';
}
```

Add a test beside the mark tests:

```js
test('the caption is the line the act wrote, and an act that wrote no line has none', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'captionFor']);
  api.startWorld('gamma');
  for (let k = 0; k < 4; k++) api.step(true);
  const rec = api.creation.gestures[api.creation.gestures.length - 1];
  const said = rec.said !== null && rec.said !== undefined;
  assert.equal(api.captionFor(rec), said ? api.legends[rec.said].text : '');
  assert.equal(api.captionFor({ said: null }), '', 'an act that wrote no line is silent, not wrong');
});
```

`majorOfClose()` is the existing behaviour, kept for the age's close beat. If `drawCaption` holds that
logic inline today, lift it into a named function rather than copying it.

- [ ] **Step 6: Run the tests, build, commit**

```bash
node --test tests/ui.js 2>&1 | grep -E '^ℹ (pass|fail)'
node build.js
git add -A && git commit -m "Every act draws its own mark, its own word, and its own line

A split and a claim both recolour a country; a burn, a freeze, a hiding and a
showing all wash it. Fifteen acts were being read through four devices. One
stroke language, one word each, drawn on the ground that changed."
```

---

### Task 7: The act's card, on the mark and on the timeline cell

**Files:**
- Modify: `src/ui/derive.js` (`actCard`)
- Modify: `src/ui/panels.js` (render it)
- Modify: `src/ui/main.js` (the pointer handler knows the mark's circle)
- Modify: `src/ui/timeline.js` (a cell opens the same card)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `creation.gestures` records, `creation.choices` (E2), `markFor` (Task 6).
- Produces: `actCard(rec)` → `{ head, rows }`, where `head` is the sentence and `rows` is an array of
  `{ label, value }`.

- [ ] **Step 1: Write the failing test**

```js
test('the act card names the act, its place in the age, and what the god weighed', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'actCard']);
  api.startWorld('gamma');
  for (let k = 0; k < 6; k++) api.step(true);
  const rec = api.creation.gestures[api.creation.gestures.length - 1];
  const card = api.actCard(rec);
  assert.ok(card.head.length, 'the card leads with the sentence');
  assert.ok(card.rows.some(r => /Age \d/.test(r.value)), 'the card says which age');
  assert.ok(card.rows.length >= 2);
});

test('the act card withholds the weighed row for a record the player made', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'actCard']);
  api.startWorld('gamma');
  api.step(true);
  const rec = { ...api.creation.gestures[0], byPlayer: true, weighed: null };
  const card = api.actCard(rec);
  assert.equal(card.rows.some(r => r.label === 'weighed'), false,
    'the taken row cannot be derived for a player record until a later slice stores it');
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/ui.js 2>&1 | grep -E 'act card|^ℹ (pass|fail)'`

- [ ] **Step 3: Write `actCard` in `derive.js`**

```js
/* The card an act shows on hover, and the card its cell in the timeline opens. It is the same card from
   both, so an act stays readable long after its mark has faded. The weighed row is withheld for a record
   the player made: decideGod marks every option it tried, so the taken row is the first unfailed row and
   is exact; takeTurn applies any row by name and marks only that one, so the rule would point at the wrong
   row. E3 does not store the row a player took; a later slice does. */
function actCard(rec){
  const m = markFor(rec.kind, rec.value);
  const g = beingById(rec.god);
  const head = rec.said !== null && legends[rec.said] ? legends[rec.said].text
    : `${g ? g.name : 'A god'} ${m ? m.word : rec.kind}.`;
  const rows = [{ label: 'when', value: `Age ${rec.age}` }];
  const r = regionById(rec.region !== undefined ? rec.region : rec.near);
  if (r) rows.push({ label: 'where', value: regionName(r) });
  if (rec.weighed && !rec.byPlayer){
    rows.push({ label: 'weighed', value: rec.weighed.opts.map(o => `${o.type} ${Math.round(o.score)}`).join(' · ') });
  }
  return { head, rows };
}
```

Check the exact helper names before you write this — `beingById`, `regionById` and `regionName` must exist
in the shared scope. If one does not, use the name that does and say so in your report.

- [ ] **Step 4: Show it on hover and from the cell**

In `panels.js`, render `actCard` the way the region card is rendered, escaping every simulation string
through `esc`. In `main.js`'s pointer handler, a pointer within 34 px of `tileSpot(rec.to)` for the mark
now drawn is a hover on the act; otherwise the region card stands as it does today. In `timeline.js`, a
click on a cell sets `ui.timelineChip` as E2 already does, and the foot renders `actCard` for that act.

- [ ] **Step 5: Run the tests, build, commit**

```bash
node --test tests/ui.js 2>&1 | grep -E '^ℹ (pass|fail)'
grep -c '\.innerHTML\b' src/ui/timeline.js   # expected: 0
node build.js
git add -A && git commit -m "An act has a card, from its mark and from its cell

A plate on the world reads well standing still and badly in motion. The same
card comes up from the timeline cell, so an act stays readable after its mark
has faded and the transient thing agrees with the permanent record."
```

---

### Task 8: The timeline lights the act being played

**Files:**
- Modify: `src/ui/derive.js` (`timelineModel` marks the playing cell)
- Modify: `src/ui/timeline.js`
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: `timelineModel()` from E2, `creation.gestures`.
- Produces: each cell in the model carries `playing: true|false`.

- [ ] **Step 1: Write the failing test**

```js
test('the timeline lights exactly one cell: the act now playing, and none once the ages are over', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'timelineModel']);
  api.startWorld('gamma');
  for (let k = 0; k < 5; k++) api.step(true);
  const lit = api.timelineModel().rows.flatMap(r => r.cells).filter(c => c && c.playing);
  assert.equal(lit.length, 1, 'one act is playing, so one cell is lit');
  api.runAges();
  const after = api.timelineModel().rows.flatMap(r => r.cells).filter(c => c && c.playing);
  assert.equal(after.length, 0, 'the ages are over and nothing is playing');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ui.js 2>&1 | grep -E 'timeline lights|^ℹ (pass|fail)'`

- [ ] **Step 3: Mark the cell in `timelineModel`**

The playing act is the newest gesture of the current age, so a cell is playing when it names that god in
that age and `inAges()` is true. Add to each cell as it is built:

```js
      playing: inAges() && creation.gestureAge === age && last && last.god === cell.god && cell.age === age,
```

where `last` is `creation.gestures[creation.gestures.length - 1]`, computed once above the loop.

- [ ] **Step 4: Draw it in `timeline.js`**

`el.classList.toggle('playing', !!cell.playing)`, and a `.playing` rule in `src/page.template.html` using
`--map-god` for the background and `--accent-ink` for the text, matching the mockup.

- [ ] **Step 5: Run the tests, build, commit**

```bash
node --test tests/ui.js 2>&1 | grep -E '^ℹ (pass|fail)'
node build.js
git add -A && git commit -m "The timeline lights the act being played

What the player watches and what the player reads now name the same act at the
same moment. That is the whole point of the slice."
```

---

### Task 9: Take a god

**Files:**
- Modify: `src/page.template.html:236` (the start dialog's form)
- Modify: `src/ui/dialogs.js` (`openStart`, the button's handler)
- Modify: `src/ui/actions.js` (`takeGod`)
- Test: `tests/ui.js`

**Interfaces:**
- Consumes: E1's `become` act through `inject()`.
- Produces: `ACTIONS.takeGod()` — makes the world, takes the first god, opens paused.

- [ ] **Step 1: Write the failing test**

```js
test('take a god: the world is made, a god is taken, and the creation waits on the player', () => {
  const api = loadUI(['state', 'derive', 'actions'], [...DERIVE, 'ACTIONS']);
  api.seedText = 'gamma';
  api.ACTIONS.takeGod();
  assert.equal(api.inAges(), true, 'it opens in the ages');
  assert.equal(api.paused, true, 'it opens paused, on the player own step');
  assert.ok(api.inhabited && api.inhabited.id, 'a god is taken');
  assert.equal(api.inhabited.mode, 'become');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/ui.js 2>&1 | grep -E 'take a god|^ℹ (pass|fail)'`

- [ ] **Step 3: Add the button**

In `src/page.template.html`, inside the `<form class="seed">` after `#newWorld`:

```html
<button class="btn" id="takeGod" value="take" formnovalidate>Take a god<kbd>Alt+G</kbd></button>
```

- [ ] **Step 4: Add the action**

```js
  /* Make the world, take the first god, and stop. E3 cannot be tested by hand without a way in, and a
     slice about what the player experiences must be reachable by a player. The turn card waits. */
  takeGod(){
    newWorld();
    const g = gods()[0];
    const answer = inject({ source: 'player', act: 'become', id: g ? g.id : null, mode: 'become' });
    say(answer);
    setPaused(true);
    renderUI(true);
  },
```

Wire `#takeGod` in `initUI()`, and add a `KEYMAP` row: `{ key: 'g', alt: true, focus: 'dialog:start',
action: 'takeGod', label: 'Take a god', button: 'takeGod' }`. Check `Alt+G` is free first:
`grep -n "alt: true" src/ui/keys.js`.

- [ ] **Step 5: Run the whole suite, build, commit**

```bash
npm run fast 2>&1 | tail -5
node build.js
git add -A && git commit -m "Take a god, from the start dialog

The deferral made no sense: a slice about what the player experiences must be
reachable by a player, and E3 cannot be tested by hand without a way in. This
is E1 become through the door and no new power. The turn card still waits."
```

---

### Task 10: The gates, the notes, and the PR

**Files:**
- Modify: `design/notes.md` (section 19)
- Test: every suite

- [ ] **Step 1: Run every gate and record the numbers**

```bash
cd /Users/earchibald/Worktrees/hamlet-become
npm run fast 2>&1 | tail -6
node tests/soak.js 2>&1 | tail -4
git diff --stat origin/dev -- tests/soak-golden.json
```

Expected: fast passes with 0 fail; soak 67 against the golden; **zero lines of diff on the golden**. A
moved golden means a rule changed, which this plan forbids. Stop and report rather than blessing it.

- [ ] **Step 2: Drive the page and measure it, do not assume it**

Serve the built page on port 8704 and check, on seed `gamma`: that `.` plays a beat rather than cutting;
that the mark and word draw on the ground that changed; that one timeline cell is lit and it is the right
one; that `H` asks; that `Take a god` opens paused. E2's lesson stands — the lane-packing bug passed every
test and was found by measuring the page. **A background Safari tab runs no frames**, so `onSettle()` is
not called and the era boundary looks broken when it is not; call the frame by hand when crossing it.

- [ ] **Step 3: Prove a door log replays the same at two paces**

This is the gate that matters, because the golden cannot see it. The golden fixes the random number
stream, so a suspension point, a stop position and who-acted-when move no number in it — and a paced
view is made almost entirely of that class of behaviour. A green soak carries close to no information
about what this branch changed.

Run one seed to settle twice, once at `PACES[0]` and once at `PACES[3]`, and compare the door log and
the fingerprint. They must be identical. A difference means pacing reached the door, which the spec
forbids. Record both fingerprints in the PR body; that one line is worth more than any count of passing
view tests.

Two conditions, or the comparison proves nothing.

First, the two runs must really have run at two paces. Drive them in the browser with real timers, not
by calling `step()` in a loop in Node. The ladder is consulted by the frame path; a Node loop cannot
consult it, so both runs would be the same run twice. Identical fingerprints would then be guaranteed
by the method and would read in the PR body exactly like the real result.

Second, run a negative control before you trust the pass. On a scratch copy, leak a pace value into the
door on purpose, run the same comparison, and confirm the fingerprints **diverge**. Throw the scratch
copy away. A comparison that has never been shown to fail is not evidence that anything holds; the
control is what makes the passing run mean something. Record the control in the PR body beside the pass.

Then grep the BUILT page, not `src/sim/index.js`, for any test-only accessor this branch added:

```bash
node build.js && grep -c 'beatStill\|__pace' dist/hearth-sim.html
```

`source()` is what `build.js` inlines and the API string is test-only, but only the artifact proves it.

- [ ] **Step 4: State where the branch's numbers live**

G4, the retune, is coming and it moves what a tick means. `BEAT_MS` and `PACES` are real-time values
that sit close to it. Say in the PR body, in one line, whether any E3 value is expressed in engine ticks
rather than in milliseconds — including when the answer is none. A stated "there is none" and silence
look the same in a diff, and only one of them is true.

- [ ] **Step 5: Write section 19's new subsection**

Add "The beat (E3)" under section 19 of `design/notes.md`, in the file's voice: what a beat is, why Step
cut before, the four conditions `gods.js` set and why, the ladder and why nothing is above double, the
mark language, and the measured length of a creation (43 to 110 acts). Record the `tellIfGone` timing
change, and the headless-frames caveat from the memory note.

- [ ] **Step 6: Commit and open the PR**

```bash
git add -A && git commit -m "Notes: what the beat is, and what it cost"
git push -u origin become-e3
gh pr create --base dev --title "Become E3: the beat" --body "<the spec's summary table, the gate numbers, and the four conditions gods.js set>"
```

Send it to dev-coordinator the way PR #33 was sent. Ask hamlet-mythos to read the PR against its four
conditions before the merge.
