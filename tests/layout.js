// The desktop layout: a window's title bar stays on the page, the map is centred beside the drawers,
// and the Goals drawer keeps room for one whole goal. Fast.
// The window clamp is logic, and the tests below drive it. The map and the drawer are CSS, and the
// tests for them read the page's text. Those pin the rule's text, not the layout the browser draws.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sim = require('../src/sim');
const ui = require('../src/ui');

function loadUI(files, names){
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',');
  return Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}
const api = loadUI(['state', 'derive'], ['ui', 'winClamp', 'winOpen', 'winClose', 'WIN_BAR', 'WIN_MIN_W', 'WIN_MIN_H', 'WIN_MAX', 'WIN_STEP']);
const AREA = { w: 1440, h: 836 };

test('a window dragged off the right edge stops with its whole bar on the page', () => {
  assert.deepEqual(api.winClamp({ x: 2080, y: 100, w: 330, h: 420 }, AREA), { x: 1110, y: 100, w: 330, h: 420 });
});
test('a window dragged above the top stops at the top', () => {
  assert.deepEqual(api.winClamp({ x: 80, y: -200, w: 330, h: 420 }, AREA), { x: 80, y: 0, w: 330, h: 420 });
  assert.deepEqual(api.winClamp({ x: -50, y: 10, w: 330, h: 420 }, AREA), { x: 0, y: 10, w: 330, h: 420 });
});
test('a window may hang off the bottom, but its bar stays on the page', () => {
  const r = api.winClamp({ x: 80, y: 830, w: 330, h: 420 }, AREA);
  assert.equal(r.y, AREA.h - api.WIN_BAR);
  assert.equal(r.h, 420, 'the height is kept, so the window hangs below the edge');
  assert.equal(api.winClamp({ x: 80, y: 500, w: 330, h: 420 }, AREA).y, 500, 'a window partly below the edge is left alone');
});
test('a window wider or taller than the page is cut to the page, at the top left', () => {
  assert.deepEqual(api.winClamp({ x: 300, y: 300, w: 2000, h: 2000 }, AREA), { x: 0, y: 300, w: 1440, h: 836 });
});
test('from the grip the corner stays on the page, and the window keeps its place', () => {
  assert.deepEqual(api.winClamp({ x: 1000, y: 600, w: 900, h: 900 }, AREA, true), { x: 1000, y: 600, w: 440, h: 236 });
  assert.deepEqual(api.winClamp({ x: 100, y: 100, w: 10, h: 10 }, AREA, true), { x: 100, y: 100, w: api.WIN_MIN_W, h: api.WIN_MIN_H });
});
test('with no area the rect is left as it is', () => {
  assert.deepEqual(api.winClamp({ x: 5000, y: -5000, w: 330, h: 420 }, null), { x: 5000, y: -5000, w: 330, h: 420 });
});

test('a window opens inside the page when its saved place is off it', () => {
  api.ui.windows = []; api.ui.rects = { inspect: { x: 2000, y: -40, w: 330, h: 420 } };
  const w = api.winOpen('inspect', { being: 1 }, AREA);
  assert.equal(w.x, AREA.w - 330); assert.equal(w.y, 0);
});
test('inspectors that clamp to one place still open, and the search for a slot ends', () => {
  api.ui.windows = []; api.ui.rects = { inspect: { x: 1400, y: 820, w: 330, h: 420 } };
  for (let i = 1; i <= api.WIN_MAX + 2; i++) api.winOpen('inspect', { being: i }, AREA);
  const ins = api.ui.windows.filter(w => w.kind === 'inspect');
  assert.equal(ins.length, api.WIN_MAX);
  for (const w of ins){ assert.ok(w.x + w.w <= AREA.w); assert.ok(w.y + api.WIN_BAR <= AREA.h); }
});
test('away from the edges each new inspector still steps down and across', () => {
  api.ui.windows = []; api.ui.rects = { inspect: { x: 80, y: 80, w: 330, h: 420 } };
  const a = api.winOpen('inspect', { being: 1 }, AREA), b = api.winOpen('inspect', { being: 2 }, AREA);
  assert.deepEqual([b.x - a.x, b.y - a.y], [api.WIN_STEP, api.WIN_STEP]);
});

const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
test('the drag handler clamps both a move and a resize', () => {
  const move = src('src/ui/windows.js').match(/addEventListener\('pointermove'[\s\S]*?\n {2}\}\);/)[0];
  assert.match(move, /winClamp\(r, winArea\(\), drag\.grip\)/);
  assert.doesNotMatch(move, /Math\.max\(0,/, 'the old clamp kept only the top and left edges');
});
test('a page resize pulls every window back', () => {
  assert.match(src('src/ui/main.js'), /window\.addEventListener\('resize', fitWindows\)/);
  assert.match(src('src/ui/actions.js'), /function fitWindows\(\)\{[^\n]*winClamp\(w, area\)/);
});

/* These read the built page. They pin the text of each rule. A later rule that overrides one would
   still pass here; the WebKit screenshots in the pull request are the evidence for the layout. */
const page = src('dist/hearth-sim.html');
test('the window title bar resets the progress bar rule it shares a class with', () => {
  assert.match(page, /\.win \.bar\{height:auto;overflow:visible;/);
});
test('the map is centred beside the drawer column', () => {
  assert.match(page, /\.mapbox \.views\{[^}]*justify-content:center\}/);
  assert.match(page, /\.mapbox \.views::after\{content:"";flex:0 1000 392px\}/);
});
test('the Goals drawer keeps room for one whole goal', () => {
  assert.match(page, /\.drawer\[data-drawer="goals"\]\{min-height:190px\}/);
});
