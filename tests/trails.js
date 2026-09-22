// The motion trail: the squares a creature crossed in the last moments, drawn as fading dots. Fast.
// The trail is view state. noteTrails and pruneTrails in src/ui/actions.js write it, and trailDots in
// src/ui/derive.js reads it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* Join the sim and the named UI files in one scope, as the page does. The same helper as tests/people.js. */
function loadUI(files, names){
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',');
  return Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}
const FILES = ['state', 'icons', 'derive', 'keys', 'marks', 'map', 'dialogs', 'actions'];
const NAMES = ['ui', 'TRAIL', 'noteTrails', 'pruneTrails', 'trailDots', 'onLoad', 'setView', 'ACTIONS'];

/* A valley with one walker. Its trail is started at t = 0 on the square it stands on. */
function valley(){
  const api = loadUI(FILES, NAMES);
  api.startWorld('r');
  const a = api.beings.find(b => b.species === 'human');
  api.ui.trails = {};
  api.noteTrails(0);
  return { api, a };
}
const squares = tr => tr.map(([x, y, z]) => [x, y, z]);

test('a walker records each square in order, and trailDots leaves out the square it stands on', () => {
  const { api, a } = valley();
  const start = [a.x, a.y, a.z], seen = [start];
  for (let k = 1; k <= 3; k++){ a.x++; api.noteTrails(k * 10); seen.push([a.x, a.y, a.z]); }
  assert.deepEqual(squares(api.ui.trails[a.id]), seen, 'every square the walker crossed, oldest first');
  const dots = api.trailDots(a.id, 30);
  assert.deepEqual(dots.map(d => [d.x, d.y, d.z]), seen.slice(0, -1), 'every square but the one it stands on');
});

test('the trail holds at most TRAIL.max + 1 entries and drops the oldest', () => {
  const { api, a } = valley();
  const x0 = a.x, steps = api.TRAIL.max + 4;
  for (let k = 1; k <= steps; k++){ a.x = x0 + (k % 2); a.y++; api.noteTrails(k); }
  const tr = api.ui.trails[a.id];
  assert.equal(tr.length, api.TRAIL.max + 1, 'the cap');
  assert.equal(tr[tr.length - 1][1], a.y, 'the last entry is the square the walker stands on');
  assert.equal(tr[0][1], a.y - api.TRAIL.max, 'the oldest entries were the ones dropped');
});

test('a move of three squares starts a new trail, and a run of two does not', () => {
  const { api, a } = valley();
  a.x++; api.noteTrails(1);
  a.x += 2; api.noteTrails(2);
  assert.equal(api.ui.trails[a.id].length, 3, 'a run of two squares is still a walk');
  a.x += 3; api.noteTrails(3);
  assert.deepEqual(squares(api.ui.trails[a.id]), [[a.x, a.y, a.z]], 'a jump of three starts again at the new square');
  a.y -= 3; api.noteTrails(4);
  assert.deepEqual(squares(api.ui.trails[a.id]), [[a.x, a.y, a.z]], 'a jump of three on y starts again too');
  a.x++; a.z += 1; api.noteTrails(5);
  assert.equal(api.ui.trails[a.id].length, 2, 'a step onto the next level is still a walk');
  a.z += 2; api.noteTrails(6);
  assert.deepEqual(squares(api.ui.trails[a.id]), [[a.x, a.y, a.z]], 'a fall of two levels starts again at the new square');
});

test('an unchanged square adds nothing', () => {
  const { api, a } = valley();
  api.noteTrails(5); api.noteTrails(10);
  assert.equal(api.ui.trails[a.id].length, 1);
  assert.equal(api.ui.trails[a.id][0][3], 0, 'the entry keeps the time it was first noted');
});

test('a god records nothing', () => {
  const { api, a } = valley();
  const g = api.makeBeing('god', a.x, a.y, 'Test god', 0); api.beings.push(g);
  assert.equal(api.SPECIES.god.perTick, false, 'the rule reads perTick from the species table');
  api.noteTrails(1); g.x++; api.noteTrails(2);
  assert.equal(api.ui.trails[g.id], undefined, 'no trail for a god');
});

test('dots grow stronger from oldest to newest, and all are gone TRAIL.ms after the newest', () => {
  const { api, a } = valley();
  for (let k = 1; k <= 5; k++){ a.x++; api.noteTrails(k); }
  const dots = api.trailDots(a.id, 5);
  assert.equal(dots.length, 5);
  for (const d of dots) assert.ok(d.alpha > 0 && d.alpha <= api.TRAIL.alpha, `alpha ${d.alpha} is in (0, ${api.TRAIL.alpha}]`);
  for (let i = 1; i < dots.length; i++) assert.ok(dots[i].alpha > dots[i - 1].alpha, `dot ${i} is stronger than dot ${i - 1}`);
  assert.deepEqual(api.trailDots(a.id, 5 + api.TRAIL.ms), [], 'every dot has faded');
  assert.deepEqual(api.trailDots(-1, 5), [], 'an unknown id has no dots');
});

test('pruneTrails drops a dead being\'s trail and cuts a stale trail to its last entry', () => {
  const { api, a } = valley();
  const b = api.makeBeing('fox', a.x + 5, a.y, 'Fox', 0); api.beings.push(b);
  api.noteTrails(0);
  a.x++; b.x++; api.noteTrails(10);
  b.alive = false;
  api.pruneTrails(20);
  assert.equal(api.ui.trails[b.id], undefined, 'the dead fox has no trail');
  assert.equal(api.ui.trails[a.id].length, 2, 'a fresh trail is kept whole');
  api.pruneTrails(10 + api.TRAIL.ms + 1);
  assert.deepEqual(squares(api.ui.trails[a.id]), [[a.x, a.y, a.z]], 'a stale trail keeps the square the walker stands on');
  a.x++; api.noteTrails(400);
  assert.equal(api.trailDots(a.id, 400).length, 1, 'the first step after a rest leaves a dot');
});

/* newWorld and onSettle reach the canvas and the page in Node, so the test drives onLoad, which stops
   before the canvas when there is none. The other two carry the same clear in src/ui/actions.js. */
test('onLoad clears every trail', () => {
  const { api, a } = valley();
  a.x++; api.noteTrails(1);
  assert.ok(Object.keys(api.ui.trails).length > 0);
  api.onLoad();
  assert.deepEqual(api.ui.trails, {});
});

/* The actions call renderUI and hideTip, which live in files that paint the page, and setPaused writes the
   pause button. They are stubbed for one call, with a document whose elements take any write. */
function withPage(fn){
  const el = () => ({ innerHTML: '', classList: { toggle(){} } });
  global.renderUI = () => {}; global.hideTip = () => {}; global.document = { getElementById: el, querySelectorAll: () => [] };
  try { return fn(); } finally { delete global.renderUI; delete global.hideTip; delete global.document; }
}

test('leaving the world map clears every trail, and a sector change does not', () => withPage(() => {
  const { api, a } = valley();
  api.setView('loc'); api.noteTrails(0);
  a.x++; api.noteTrails(1);
  api.setView('mid');
  assert.equal(api.ui.trails[a.id].length, 2, 'a change between the close views keeps the trail');
  api.setView('world'); api.setView('loc');
  assert.deepEqual(api.ui.trails, {}, 'the world map records nothing, so a trail from before it is stale');
}));

test('the Step button notes the trail of the tick it steps, and not on the world map', () => withPage(() => {
  const { api } = valley();
  api.setView('loc'); api.noteTrails(0);
  let moved = false;
  for (let k = 0; k < 600 && !moved; k++){ api.ACTIONS.step(); moved = Object.values(api.ui.trails).some(tr => tr.length >= 2); }
  assert.ok(moved, 'a creature moved in a stepped tick and its trail grew to two squares');
  api.setView('world');
  const before = JSON.stringify(api.ui.trails);
  for (let k = 0; k < 60; k++) api.ACTIONS.step();
  assert.equal(JSON.stringify(api.ui.trails), before, 'the world map records no trail');
}));

test('the Hour button clears every trail', () => withPage(() => {
  const { api, a } = valley();
  api.setView('loc'); api.noteTrails(0);
  a.x++; api.noteTrails(1);
  api.ACTIONS.hour();
  assert.deepEqual(api.ui.trails, {}, 'a creature back near its old square an hour later would get a stale dot');
}));

/* main.js reads the DOM when it loads, so it cannot run in Node. This test matches its source text
   instead, and a change to the layout of the loop alone breaks it. */
test('the days step loop in main.js notes the trails after each step', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/ui/main.js'), 'utf8');
  assert.match(src, /while \(acc >= 1\)\{ step\(\); if \(trails\) noteTrails\(now\);/, 'noteTrails follows step() inside the while loop');
  assert.match(src, /trails = view !== 'world'; while \(acc >= 1\)/, 'the view is read once, before the loop');
  assert.match(src, /pruneTrails\(now\);\s*draw\(\);/, 'pruneTrails runs once a frame, before draw()');
});
