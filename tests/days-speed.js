// The speed the days open at: 8x, unless the player chose a speed, which is then kept. Fast.
// tests/ui.js runs only with SLOW=1, so this lives in its own file, where the fast suite runs it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* The same helper as tests/people.js. `speedNow` reads the page's `speed`, a let that no name exports.
   onSettle ends by starting the settle zoom, which draws on canvases Node does not have, so startZoom is
   replaced in the joined scope. The speed is set before it, and the zoom does not touch the speed. */
function loadUI(){
  const names = ['ui', 'restore', 'onSettle', 'SPEEDS', 'DAYS_SPEED', 'ACTIONS', 'inAges'];
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ', speedNow: () => speed,');
  return Function(sim.source() + '\n' + ui.source(['state', 'icons', 'derive', 'keys', 'marks', 'map', 'zoom', 'dialogs', 'actions']) + '\nstartZoom = () => {};\n' + api)();
}

/* onSettle writes the speed strip, paints the page and its foot, and hides the tooltip. These are stubbed for one call. Storage
   is a stub too: `stored` is what getItem hands back, and every setItem is kept in `writes`. */
function withPage(stored, fn){
  const writes = [];
  const el = () => ({ innerHTML: '', textContent: '', hidden: false, style: {}, classList: { toggle(){}, add(){}, remove(){} } });
  global.renderUI = () => {}; global.renderFoot = () => {}; global.hideTip = () => {};
  global.document = { getElementById: el, querySelectorAll: () => [] };
  global.localStorage = { getItem: () => stored, setItem: (k, v) => writes.push(JSON.parse(v)) };
  try { return fn(writes); } finally { delete global.renderUI; delete global.renderFoot; delete global.hideTip; delete global.document; delete global.localStorage; }
}

/* A world that has just settled: the page runs onSettle in the first frame that sees the days. */
function settle(stored){
  const api = loadUI();
  return withPage(stored, writes => {
    api.restore();
    api.startWorld('r');
    api.onSettle();
    return { api, writes };
  });
}

test('the default speed of the days is 8x, and it is a rung of the ladder', () => {
  const api = loadUI();
  assert.equal(api.DAYS_SPEED, 8);
  assert.ok(api.SPEEDS.includes(api.DAYS_SPEED), 'setSpeed throws on a speed off the ladder');
  assert.equal(api.speedNow(), 8, 'the page opens at the days default, so a persist() before any setSpeed saves 8 and not 1');
});

test('a player with no saved speed enters the days at 8x, and the automatic save sets no marker', () => {
  const { api, writes } = settle(null);
  assert.equal(api.ui.savedSpeed, 0, 'nothing was read from storage');
  assert.equal(api.speedNow(), 8);
  assert.ok(writes.length > 0, 'onSettle saved');
  assert.equal(writes[writes.length - 1].speed, 8, 'the saved speed is the one the player sees');
  assert.ok(writes.every(w => w.speedChosen === false), 'setSpeed and persist() alone never mark the speed as chosen');
});

/* Before the marker, every page load saved speed 1 on its own. That record is not the player's choice. */
test('an old record with a speed and no marker enters the days at 8x', () => {
  for (const s of [1, 64]){
    const { api } = settle(JSON.stringify({ speed: s }));
    assert.equal(api.speedNow(), 8, `an unmarked ${s}x is not kept`);
    assert.equal(api.ui.speedChosen, false);
  }
});

test('a speed the player chose wins over the default when the days begin', () => {
  for (const s of [1, 64, 256]){
    const { api, writes } = settle(JSON.stringify({ speed: s, speedChosen: true }));
    assert.equal(api.speedNow(), s, `a chosen ${s}x is kept`);
    assert.equal(writes[writes.length - 1].speedChosen, true, 'the marker is saved again with it');
  }
});

test('a chosen speed off the ladder is ignored, and the days open at 8x', () => {
  const { api } = settle(JSON.stringify({ speed: 3, speedChosen: true }));
  assert.equal(api.speedNow(), 8);
});

test('a speed key in the days sets the marker and saves the speed', () => {
  const { api } = settle(null);
  assert.equal(api.inAges(), false, 'the world is in the days');
  withPage(null, writes => {
    api.ACTIONS.speedStep(2);
    assert.equal(api.speedNow(), 64);
    assert.equal(api.ui.speedChosen, true);
    const last = writes[writes.length - 1];
    assert.equal(last.speed, 64);
    assert.equal(last.speedChosen, true, 'the next page load honours this speed');
  });
});

/* main.js reads the DOM when it loads, so it cannot run in Node. The first world of a page load sets the
   speed there, after newWorld's restore(), and this test matches that line in the source text. */
test('the first world of a page load sets the days default when nothing is saved', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/ui/main.js'), 'utf8');
  assert.match(src, /if \(!ui\.savedSpeed\) setSpeed\(DAYS_SPEED\);/);
  const acts = fs.readFileSync(path.join(__dirname, '../src/ui/actions.js'), 'utf8');
  assert.doesNotMatch(acts, /setSpeed\([^)]*\|\| 1\)/, 'no fallback in actions.js opens the days at 1x');
});
