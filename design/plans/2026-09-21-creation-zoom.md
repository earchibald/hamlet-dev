# The zoom from creation to play (playtest 6)

Playtest recommendation 6, from the "Hearth Playtest Notes" page (seed amber-ford-45, 20 Sept 2026):

> The last frame of the gods' map is followed at once by a close-up of one small area. There is nothing in
> between, so the player cannot tell where in the world they have landed. First, fade from the finished gods'
> map into the full world map. Then zoom in steadily: from the whole world, to the nine areas around the first
> camp, to the camp itself. Build the zoom so that it can be used again.

## Summary

| Task | What it builds | Files |
|---|---|---|
| 1 | The pure zoom model: a view's frame, the camera between two frames, the plan of legs, the alphas, and the `ZOOM` durations. A fast test file. | `src/ui/zoom.js`, `src/ui/index.js`, `tests/zoom.js`, `package.json` |
| 2 | The zoom layer on the page: its canvas, its state, start, advance, skip and end, the drawing, the hook at settle, the held world, and the reduced-motion rule. | `src/page.template.html`, `src/ui/state.js`, `src/ui/actions.js`, `src/ui/zoom.js`, `src/ui/map.js`, `src/ui/main.js` |
| 3 | The one line of player text, the design notes, and the project test list. The review panel reads the text. | `src/page.template.html`, `design/notes.md`, `CLAUDE.md` |

## After recommendation 1

Recommendation 1 (PR #127, merged into dev at 7600299) draws the gods' map from `previewField()` in
`src/ui/preview.js`, in the world map's own colours. This branch merged it at 684c2d4. It changes this plan in
four places.

| Point | Ruling |
|---|---|
| The fade from the gods' map to the world map | It stays, at `ZOOM.fade` = 1000 ms, and Task 1 is unchanged. The two maps share their colours and their shares of each kind, but not their tiles. In `tests/preview.js`, only 0.315 to 0.448 of the preview's water tiles are water in the world, and a region's tree share differs by up to 0.172. A cut would move two thirds of the pools at once. The fade shows it as the ground settling. |
| The picture `field` | `drawField` still draws on `wcv`, and the frame loop still calls `onSettle` before it draws. So the copy of `wcv` holds the last frame of the ages. That frame can hold the act caption and the faint border lines in `field-line`. Look for both in the screenshot of the fade, and report what shows. |
| The word "country" | Recommendation 1 removed it from the player's text, and `tests/preview.js` fails on any `/countr/i` in `src/page.template.html`. The new canvas label and the skip line do not use it. |
| The zoom legs | Recommendation 1 does not change them. |

## Global constraints

- `src/ui/` files are plain scripts in one scope. No `import` and no `export`.
- View state changes only in `actions.js`. The new `zoom` state is declared in `state.js` and written only by
  functions in `actions.js`. `main.js` and `zoom.js` only call those functions or read `zoom`.
- The zoom is view state. It never passes the door, and it never changes the sim. A seed gives the same
  story with or without it. The frame loop does not step the world while the zoom runs.
- Put each duration in `ZOOM` in `src/ui/zoom.js`, in milliseconds of wall time. Put none in `src/sim/`.
- The end state of a settle is unchanged: the sector view on the first person's sector, as `onSettle` sets it
  today. A settle with no first person ends on the world view, as today.
- The zoom is reusable: `startZoom(stops)` takes any list of stops, and nothing in the zoom code names the
  settle, except `settleStops`.
- Run `node build.js` after every change to `src/`. Run
  `node --test tests/zoom.js tests/icons.js tests/build.js tests/preview.js` and `npm run fast` before each commit.

## Sizes that the design rests on

A sector is `LW` by `LH` = 28 by 20 tiles. The default world is `SW` by `SH` = 10 by 6 sectors, so `W` by `H` =
280 by 120 tiles. The three canvases, in CSS pixels at 1x:

| View | Canvas | Tiles shown | Pixels a tile |
|---|---|---|---|
| `world` | `wmap`, 840 by 360 | the whole world | `WS` = 3 |
| `mid` | `mmap`, 756 by 540 | the sector and its eight neighbours | `MS` = 9 |
| `loc` | `map`, 728 by 520 | one sector | `T` = 26 |

Each canvas shows its frame at the frame's own aspect. So a camera whose aspect equals its box's aspect starts
exactly on frame A and ends exactly on frame B.

---

## Task 1: the pure zoom model

Create `src/ui/zoom.js`. Add `'zoom'` to `FILES` in `src/ui/index.js`, directly after `'map'`. Create
`tests/zoom.js` and add it to the end of the `fast` script in `package.json`.

The top of `src/ui/zoom.js` holds pure functions only. They touch no DOM and no canvas. Task 2 adds the drawing
below them.

```js
/* The zoom: a camera that moves between two views, drawn on its own canvas. The settle uses it to go from the
   gods' map to the first person's sector, and any later caller can give it other stops. The functions at the
   top are pure and run in Node under tests/zoom.js. The drawing below them reads `zoom`, which only
   actions.js writes. */

/* The zoom's durations, in milliseconds of wall time. They are view durations and stay out of src/sim/.
   fade is the cross-fade from the gods' map to the world map, hold is the pause at each stop, and the two
   zoom legs are named by the view they arrive at. */
const ZOOM = { fade: 1000, hold: 350, mid: 1600, loc: 1100 };

/* The tiles a view shows, in world tiles: { x, y, w, h }. `s` is the sector the view is on. */
function viewFrame(v, s){
  if (v === 'mid') return { x: (s.sx - 1) * LW, y: (s.sy - 1) * LH, w: 3 * LW, h: 3 * LH };
  if (v === 'loc') return { x: s.sx * LW, y: s.sy * LH, w: LW, h: LH };
  return { x: 0, y: 0, w: W, h: H };
}
const zoomEase = f => f * f * (3 - 2 * f);
const lerp = (a, b, f) => a + (b - a) * f;
/* The camera at fraction f of a leg from frame a to frame b. The box, in CSS pixels, moves in a straight
   line from boxA to boxB. The camera's width moves geometrically, so each moment of the zoom multiplies the
   scale by the same amount. Its height follows the box's aspect, so the picture never stretches. The centre
   moves in step with the zoom, so the frame being arrived at grows steadily on screen. */
function zoomCamera(a, b, boxA, boxB, f){
  const e = zoomEase(clamp(f, 0, 1));
  const box = { w: lerp(boxA.w, boxB.w, e), h: lerp(boxA.h, boxB.h, e) };
  const w = Math.pow(a.w, 1 - e) * Math.pow(b.w, e), h = w * box.h / box.w;
  const p = a.w === b.w ? e : (a.w - w) / (a.w - b.w);
  const cx = lerp(a.x + a.w / 2, b.x + b.w / 2, p), cy = lerp(a.y + a.h / 2, b.y + b.h / 2, p);
  return { box, cam: { x: cx - w / 2, y: cy - h / 2, w, h } };
}
/* Where a frame lands in the box, in CSS pixels, when the camera shows `cam`. */
function frameInBox(frame, cam, box){
  const k = box.w / cam.w;
  return { x: (frame.x - cam.x) * k, y: (frame.y - cam.y) * k, w: frame.w * k, h: frame.h * k };
}
/* The legs between a list of stops. A stop is { view, s, image }: the view, its sector, and the key of the
   picture it shows. Two stops of the same view make a fade; two views make a zoom. A hold sits between two
   legs. Each leg keeps the stops' indexes, so the drawing finds their pictures. */
function zoomPlan(stops){
  const legs = [];
  for (let i = 1; i < stops.length; i++){
    if (legs.length) legs.push({ kind: 'hold', from: i - 1, to: i - 1, ms: ZOOM.hold });
    const same = stops[i].view === stops[i - 1].view;
    legs.push({ kind: same ? 'fade' : 'zoom', from: i - 1, to: i, ms: same ? ZOOM.fade : ZOOM[stops[i].view] });
  }
  return legs;
}
/* The leg that runs t ms into a plan, and the fraction of it that has run. Null once the plan is over. */
function zoomAt(legs, t){
  let start = 0;
  for (let i = 0; i < legs.length; i++){
    if (t < start + legs[i].ms) return { i, f: (t - start) / legs[i].ms };
    start += legs[i].ms;
  }
  return null;
}
const zoomLength = legs => legs.reduce((n, l) => n + l.ms, 0);
/* How strongly each stop's picture shows at fraction f of a leg. A fade crosses the whole leg. In a zoom the
   picture left behind goes in the first part, and the picture arrived at comes in the last half, so the
   middle of the flight shows only the world's own ground. A hold shows its one stop. */
function legAlphas(leg, f){
  const e = zoomEase(clamp(f, 0, 1));
  if (leg.kind === 'hold') return { from: 1, to: 0 };
  if (leg.kind === 'fade') return { from: 1, to: e };
  return { from: 1 - clamp(f / 0.4, 0, 1), to: zoomEase(clamp((f - 0.5) / 0.5, 0, 1)) };
}
/* The settle's stops: the finished gods' map, the world map, the nine sectors around the first person, and
   that person's sector. A settle with no one in it ends on the world map. */
function settleStops(s){
  const stops = [{ view: 'world', image: 'field' }, { view: 'world', image: 'world' }];
  if (s) stops.push({ view: 'mid', s, image: 'mid' }, { view: 'loc', s, image: 'loc' });
  return stops;
}
```

`tests/zoom.js` copies `loadUI` from `tests/icons.js` (with its comment) and loads `['state', 'zoom']`. The
tests call `api.startWorld('r')` first where they need `W` and `H`. Each test below must fail against a planted
fault before it counts. Plant each fault, watch the named test fail, and revert it. Record the plants in the
report.

| Test | Asserts | Plant that must turn it red |
|---|---|---|
| the three frames | `viewFrame('world')` is `{0,0,280,120}`; `viewFrame('mid', {sx:4,sy:2})` is `{84,20,84,60}`; `viewFrame('loc', {sx:4,sy:2})` is `{112,40,28,20}`. | `mid` uses `s.sx` in place of `s.sx - 1`. |
| a leg starts and ends on its frames | For world to mid and mid to loc, with the boxes in the size table, the camera at f = 0 equals frame a and at f = 1 equals frame b, to 1e-9. | Height taken as `lerp(a.h, b.h, e)`. |
| the camera never stretches | For f from 0 to 1 by 0.05, `cam.w / cam.h` equals `box.w / box.h` to 1e-9. | the same plant |
| the zoom only closes in | For world to mid, `cam.w` falls at every step of 0.05. The box the destination frame takes (`frameInBox`) grows at every step. | `p` computed as `e` for a zoom. Check whether this goes red. If it does not, say so in the report and name a plant that does. |
| a frame fills the box it is shown in | `frameInBox(a, cam at 0, boxA)` is `{0, 0, boxA.w, boxA.h}`. | `k` computed as `box.h / cam.w`. |
| the settle plan | `zoomPlan(settleStops({sx:4,sy:2}))` gives kinds `fade, hold, zoom, hold, zoom`, and `zoomLength` is `ZOOM.fade + ZOOM.mid + ZOOM.loc + 2 * ZOOM.hold`. With `settleStops(null)` it is one `fade`. | drop the hold. |
| the clock of a plan | `zoomAt(legs, 0)` is `{i: 0, f: 0}`. `zoomAt(legs, ZOOM.fade)` is `{i: 1, f: 0}`. `zoomAt(legs, zoomLength(legs))` is null. | `<=` in place of `<`. |
| the alphas | A fade at f = 0.5 gives `{1, 0.5}`. A zoom at f = 0.5 gives `from` 0 and `to` 0, and at f = 1 gives `{0, 1}`. A hold gives `{1, 0}`. | `to` of a zoom uses `f` directly. |

Commit: "Add the zoom model from one view to another (playtest 6, task 1)".

---

## Task 2: the zoom layer on the page

The state. In `src/ui/state.js`, declare beside the other view lets:

```js
/* The zoom that is running, or null. { stops, legs, t, pics, boxes }. Only actions.js writes it: startZoom,
   advanceZoom and endZoom. The world does not step while it is set. */
let zoom = null;
```

The canvas. In `src/page.template.html`, add a fourth map wrap after `#loc`:
`<div class="map-wrap" id="zoom" hidden><canvas id="zmap" aria-label="The view moving from the world to the valley"></canvas></div>`.
The canvas takes the page's existing `canvas` rule. The zoom sets the canvas's `style.width` and `style.height`
itself, in CSS pixels, each frame.

The functions, in `src/ui/actions.js`:

- `startZoom(stops)`. Returns without doing anything when there is no page (`typeof document === 'undefined'`
  or no `wcv`), when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, or when there are fewer
  than two stops. Otherwise, all in one synchronous run with no paint between:
  1. Take the picture `field` as a copy of `wcv` as it stands. It holds the last frame of the ages, because the
     frame loop calls `onSettle` before it draws.
  2. For each other stop, show only that view's wrap. Set `cur` to the stop's sector and draw the view with
     `drawWorld`, `drawMid`, or `drawLoc`. Measure its canvas with `getBoundingClientRect()`. Copy the canvas
     into a new offscreen canvas, and record the box `{w, h}` in CSS pixels. The field's box is the world's.
  3. Put `cur` back to the last stop's sector. Hide the three view wraps, show `#zoom`, and set `zoom`.
  The copies are the pictures the zoom draws. The world does not step during the zoom, so they stay true.
- `advanceZoom(dt)`. Adds `dt` to `zoom.t`. When `zoomAt` answers null, calls `endZoom()`.
- `endZoom()`. Does nothing when `zoom` is null. Sets `zoom = null`, hides `#zoom`, and calls
  `setView(view, cur)`, which shows the right wrap again. `acc` is set to 0, so the days do not start with a
  backlog.

The hooks:

- `onSettle` in `actions.js`: after it sets the view, call
  `startZoom(settleStops(a ? secOf(a.x, a.y) : null))`, with `a` the first person it already finds.
- `newWorld` and `onLoad` in `actions.js`: call `endZoom()` before they touch the view, so a zoom that is still
  running cannot draw over a new world.
- `frame` in `main.js`: the days branch steps only when `zoom` is null. When `zoom` is set, call
  `advanceZoom(dt)` before `draw()`. The ages branch is unchanged.
- The keydown handler in `main.js`: as its first line, `if (zoom){ e.preventDefault(); endZoom(); return; }`.
  Any key ends the zoom and is used up, so a key pressed to skip does nothing else.
- A capture-phase `pointerdown` listener on `document` in `initUI`: `if (zoom) endZoom();`. The click only ends
  the zoom, like a key, and does nothing else.
- `draw()` in `map.js`: `if (zoom){ drawZoom(); return; }` at its start.

The drawing, `drawZoom()` at the end of `src/ui/zoom.js`:

1. `const at = zoomAt(zoom.legs, zoom.t)`. If null, return (the next `advanceZoom` ends the zoom).
2. `leg = zoom.legs[at.i]`, `A = zoom.stops[leg.from]`, `B = zoom.stops[leg.to]`. Frames from `viewFrame`,
   boxes from `zoom.boxes`. `{ box, cam } = zoomCamera(frameA, frameB, boxA, boxB, at.f)`.
3. Size `zmap` to `round(box.w * dpr)` by `round(box.h * dpr)` only when that differs from its size now. Set
   its `style.width` and `style.height` to the box in `px`.
4. `setTransform(dpr, 0, 0, dpr, 0, 0)`, `imageSmoothingEnabled = false`, fill the box with `P.void`.
5. For a `zoom` leg only, draw the world cache `ocv` as the ground: its frame is `viewFrame('world')`, and it
   lands at `frameInBox(that frame, cam, box)`.
6. Draw picture A at `frameInBox(frameA, ...)` with alpha `legAlphas(leg, at.f).from`, then picture B at
   `frameInBox(frameB, ...)` with alpha `.to`. Skip a picture whose alpha is 0. Reset `globalAlpha` to 1.

Before the report, check the page in a browser. Serve `dist/hearth-sim.html` and start seed amber-ford-45.
Press `H`, and see the fade, the two zooms, and the arrival in the sector view. Press a key in the middle and see the
sector view at once. Check that the day clock in the strip does not move until the zoom ends. Take three
screenshots in the middle of the zoom, one for each leg, and name their paths in the report. Since
recommendation 1, the gods' map is drawn from `previewField()` in `src/ui/preview.js`, in the world map's
colours. The fade joins two maps that differ only in where the pools and trees are. In the fade's screenshot, look for the act
caption and the faint border lines in `field-line` from the last frame of the ages. Say whether each shows. Do
not remove either without asking: report it.

Check `viewFrame('mid', s)` at the world's edge. For a sector in column 0 or row 0, it gives a block that
starts at a negative tile. Read `drawMid` in `src/ui/map.js` and find which tiles it shows for that sector. If
the two differ, make `viewFrame` give what `drawMid` shows, and add an edge sector to the test "the three
frames". Say in the report which case held.

Add one test to `tests/zoom.js` for the writer rule. It reads each file in `src/ui/`. It asserts that the
pattern `/\bzoom\s*=[^=]/` appears in no file except `actions.js` and the one declaration in `state.js`. Plant a `zoom = null` in `map.js` and watch it go red.

Commit: "Zoom from the gods' map to the first person at settle (playtest 6, task 2)".

---

## Task 3: the text and the documents

- Add one line of player text inside `#zoom`, over the bottom edge of the canvas. Style it like the act caption.
  The line is "Press any key to go straight to the valley." The review panel may change the words. The line
  is part of the zoom wrap, so it shows only while the zoom runs.
- In `design/notes.md`, section 13a, replace "At settle the view moves to the first person" with the zoom as
  built. Write it in the notes' own style. Give the four stops, the durations table from `ZOOM`, that the world waits, that a key or
  a click skips it, that reduced motion skips it, and that `startZoom(stops)` takes any stops. Keep the rest of
  the paragraph.
- In `CLAUDE.md`, add `tests/zoom.js` to the test list as one line in the style of `tests/icons.js`. If the
  layout line lists the pure UI files, name `zoom.js` there too.
- Review panel: dispatch three Sonnet reviewers on the player line and the new notes paragraph, alone. Each
  judges: does it sound human, is it plain English, is it readable. Rewrite on their findings.

Commit: "Say how to skip the zoom, and record it in the notes (playtest 6, task 3)".
