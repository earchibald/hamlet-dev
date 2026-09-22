// The pure zoom model: frames, camera, plan, clock, and alphas. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* Join the sim and the pure UI files in one scope, as the page does, and return the names the tests
   reach into. Copied from tests/ui.js's loadUI, which this file cannot require: that file returns
   early behind SLOW=1 before it defines anything. */
function loadUI(files, names, extra = {}){
  const more = Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join(', ');
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',' + (more ? ' ' + more + ',' : ''));
  return new Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}

const NAMES = ['ZOOM', 'viewFrame', 'zoomEase', 'lerp', 'zoomCamera', 'frameInBox', 'zoomPlan', 'zoomAt', 'zoomLength', 'legAlphas', 'settleStops'];
const api = loadUI(['state', 'zoom'], NAMES);
api.startWorld('r');

const closeTo = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const frameCloseTo = (a, b, eps, msg) => {
  for (const k of ['x', 'y', 'w', 'h']) closeTo(a[k], b[k], eps, `${msg}.${k}`);
};

test('the three frames', () => {
  assert.deepEqual(api.viewFrame('world'), { x: 0, y: 0, w: 280, h: 120 });
  assert.deepEqual(api.viewFrame('mid', { sx: 4, sy: 2 }), { x: 84, y: 20, w: 84, h: 60 });
  assert.deepEqual(api.viewFrame('loc', { sx: 4, sy: 2 }), { x: 112, y: 40, w: 28, h: 20 });
  /* A sector at the world's edge (column 0, row 0). drawMid's midOrigin, in src/ui/map.js, gives the
     same starting tile with no clamp: `{ ox: (cur.sx - 1) * LW, oy: (cur.sy - 1) * LH }`. The block it
     draws starts before the world's own edge, and viewFrame must give the same block for the zoom's
     pictures to line up with what the player already saw there. */
  assert.deepEqual(api.viewFrame('mid', { sx: 0, sy: 0 }), { x: -28, y: -20, w: 84, h: 60 });
});

const BOXES = { world: { w: 280, h: 120 }, mid: { w: 168, h: 120 }, loc: { w: 168, h: 120 } };

test('a leg starts and ends on its frames', () => {
  const s = { sx: 4, sy: 2 };
  const pairs = [['world', 'mid'], ['mid', 'loc']];
  for (const [va, vb] of pairs){
    const a = api.viewFrame(va, s), b = api.viewFrame(vb, s);
    const boxA = BOXES[va], boxB = BOXES[vb];
    const at0 = api.zoomCamera(a, b, boxA, boxB, 0);
    const at1 = api.zoomCamera(a, b, boxA, boxB, 1);
    frameCloseTo(at0.cam, a, 1e-9, `${va}->${vb} at f=0`);
    frameCloseTo(at1.cam, b, 1e-9, `${va}->${vb} at f=1`);
  }
});

test('the camera never stretches', () => {
  const s = { sx: 4, sy: 2 };
  const a = api.viewFrame('world', s), b = api.viewFrame('mid', s);
  const boxA = BOXES.world, boxB = BOXES.mid;
  for (let f = 0; f <= 1; f += 0.05){
    const { box, cam } = api.zoomCamera(a, b, boxA, boxB, f);
    closeTo(cam.w / cam.h, box.w / box.h, 1e-9, `f=${f.toFixed(2)}`);
  }
});

test('the zoom only closes in', () => {
  const s = { sx: 4, sy: 2 };
  const a = api.viewFrame('world', s), b = api.viewFrame('mid', s);
  const boxA = BOXES.world, boxB = BOXES.mid;
  let prevW = null, prevBoxed = null;
  for (let f = 0; f <= 1; f += 0.05){
    const { box, cam } = api.zoomCamera(a, b, boxA, boxB, f);
    if (prevW !== null) assert.ok(cam.w < prevW, `cam.w should fall at f=${f.toFixed(2)}`);
    prevW = cam.w;
    const boxed = api.frameInBox(b, cam, box);
    const area = boxed.w * boxed.h;
    if (prevBoxed !== null) assert.ok(area > prevBoxed, `destination box area should grow at f=${f.toFixed(2)}`);
    prevBoxed = area;
  }
});

test("the centre moves with the box's width, not with eased time", () => {
  const s = { sx: 4, sy: 2 };
  const a = api.viewFrame('world', s), b = api.viewFrame('mid', s);
  const boxA = BOXES.world, boxB = BOXES.mid;
  const centreA = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const centreB = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  for (const f of [0.25, 0.5, 0.75]){
    const { cam } = api.zoomCamera(a, b, boxA, boxB, f);
    const p = (a.w - cam.w) / (a.w - b.w);
    const wantX = api.lerp(centreA.x, centreB.x, p);
    const wantY = api.lerp(centreA.y, centreB.y, p);
    closeTo(cam.x + cam.w / 2, wantX, 1e-9, `f=${f} centre x`);
    closeTo(cam.y + cam.h / 2, wantY, 1e-9, `f=${f} centre y`);
  }
});

test('a frame fills the box it is shown in', () => {
  const s = { sx: 4, sy: 2 };
  const a = api.viewFrame('world', s), b = api.viewFrame('mid', s);
  const boxA = BOXES.world, boxB = BOXES.mid;
  const { box, cam } = api.zoomCamera(a, b, boxA, boxB, 0);
  const boxed = api.frameInBox(a, cam, boxA);
  frameCloseTo(boxed, { x: 0, y: 0, w: boxA.w, h: boxA.h }, 1e-9, 'frame in box at f=0');
});

test('the settle plan', () => {
  const stops = api.settleStops({ sx: 4, sy: 2 });
  const legs = api.zoomPlan(stops);
  assert.deepEqual(legs.map(l => l.kind), ['fade', 'hold', 'zoom', 'hold', 'zoom']);
  assert.equal(api.zoomLength(legs), api.ZOOM.fade + api.ZOOM.mid + api.ZOOM.loc + 2 * api.ZOOM.hold);

  const noneLegs = api.zoomPlan(api.settleStops(null));
  assert.deepEqual(noneLegs.map(l => l.kind), ['fade']);
});

test('the clock of a plan', () => {
  const legs = api.zoomPlan(api.settleStops({ sx: 4, sy: 2 }));
  assert.deepEqual(api.zoomAt(legs, 0), { i: 0, f: 0 });
  assert.deepEqual(api.zoomAt(legs, api.ZOOM.fade), { i: 1, f: 0 });
  assert.equal(api.zoomAt(legs, api.zoomLength(legs)), null);
});

test('the alphas', () => {
  const fade = { kind: 'fade' };
  const zoom = { kind: 'zoom' };
  const hold = { kind: 'hold' };
  const fadeMid = api.legAlphas(fade, 0.5);
  assert.equal(fadeMid.from, 1);
  closeTo(fadeMid.to, 0.5, 1e-9, 'fade at f=0.5 .to');

  const zoomMid = api.legAlphas(zoom, 0.5);
  closeTo(zoomMid.from, 0, 1e-9, 'zoom at f=0.5 .from');
  closeTo(zoomMid.to, 0, 1e-9, 'zoom at f=0.5 .to');

  const zoomEnd = api.legAlphas(zoom, 1);
  closeTo(zoomEnd.from, 0, 1e-9, 'zoom at f=1 .from');
  closeTo(zoomEnd.to, 1, 1e-9, 'zoom at f=1 .to');

  const holdAny = api.legAlphas(hold, 0.5);
  assert.deepEqual(holdAny, { from: 1, to: 0 });
});

/* `zoom` is state.js's one declaration and actions.js's one writer (startZoom, advanceZoom, endZoom), as
   state.js's own comment on the field says. Any other file that assigns zoom itself, or a field of the
   record zoom holds, would move the world's clock or the view behind actions.js's back. */
test('only actions.js and state.js write zoom', () => {
  const dir = path.join(__dirname, '../src/ui');
  const writer = /\bzoom\s*=[^=]/;
  /* A dotted field, plain or compound assign: zoom.t = , zoom.t += . Excludes == and ===, since the
     character right after the "=" must not itself be "=". */
  const fieldWriter = /\bzoom\.\w+\s*[-+*/]?=[^=]/;
  /* A bracketed field assign: zoom.pics[k] = c. A bare read, zoom.pics[k] alone, has no "=" after the
     "]" and so does not match. */
  const bracketWriter = /\bzoom\.\w+\[[^\]]*\]\s*=[^=]/;
  /* A dotted field's own increment or decrement, prefix or postfix: zoom.t++, ++zoom.t, zoom.t--. */
  const incDec = /\bzoom\.\w+\s*(\+\+|--)|(\+\+|--)\s*zoom\.\w+\b/;
  /* A method that changes the array or object a field holds, called straight off that field: e.g.
     zoom.legs.push(x). Covers every mutator the brief names. */
  const mutMethod = /\bzoom\.\w+\.(push|pop|splice|shift|unshift|sort|reverse)\s*\(/;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const f of files){
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    if (f === 'actions.js'){
      /* actions.js is the one writer: no assertion against it beyond the rest of this test's checks. */
      continue;
    }
    if (f === 'state.js'){
      /* The brief allows the one declaration in state.js, and only that one. */
      const matches = text.match(new RegExp(writer, 'g')) || [];
      assert.equal(matches.length, 1, `state.js should have exactly one match of the writer pattern, found ${matches.length}`);
      const decl = /\blet zoom = null;/;
      assert.match(text, decl, 'state.js should declare "let zoom = null;"');
      /* The writer pattern only reaches one character past the "=", so confirm the one match sits
         right where the declaration's "=" is, not at some other assignment. */
      const declIndex = text.search(decl) + 'let '.length;
      const matchIndex = text.search(writer);
      assert.equal(matchIndex, declIndex, `state.js's one match should be the declaration, found it at index ${matchIndex} rather than ${declIndex}`);
      continue;
    }
    assert.doesNotMatch(text, writer, `${f} writes to zoom`);
    assert.doesNotMatch(text, fieldWriter, `${f} writes to a field of zoom`);
    assert.doesNotMatch(text, bracketWriter, `${f} writes to a bracketed field of zoom`);
    assert.doesNotMatch(text, incDec, `${f} increments or decrements a field of zoom`);
    assert.doesNotMatch(text, mutMethod, `${f} calls a mutating method on a field of zoom`);
  }
});

/* main.js reads the DOM when it loads, so it cannot run in Node. These two tests match its source
   text instead, in the manner of tests/trails.js's "the days step loop" test. Each asserts loosely
   enough that a comment or a reflow does not break it, but tight enough that the fault it guards
   against turns it red. */
test('the frame loop only steps the world in the branch where no zoom is running', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/ui/main.js'), 'utf8');
  /* Guards against the days branch running alongside the zoom, which would let a step happen while
     the camera is mid-flight, or a zoom stall the days once it ends. */
  assert.match(src, /if \(zoom\)\{[\s\S]*?advanceZoom[\s\S]*?\}\s*else if \(!paused\)/,
    'if (zoom) with advanceZoom must be followed by else if (!paused)');
});

test("the keydown handler's first statement ends a running zoom", () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/ui/main.js'), 'utf8');
  /* Guards against a later statement being added ahead of the zoom check, or the check being
     dropped, either of which would let a key do something else while a zoom is still running. */
  assert.match(src, /addEventListener\('keydown', e => \{(?:\s*\/\*[\s\S]*?\*\/)?\s*if \(zoom\)\{[\s\S]*?endZoom\(\);[\s\S]*?return;\s*\}/,
    'keydown must open with if (zoom){ ... endZoom(); ... return; }');
});
