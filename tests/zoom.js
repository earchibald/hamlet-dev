// The pure zoom model: frames, camera, plan, clock, and alphas. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
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
