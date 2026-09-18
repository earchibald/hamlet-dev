// The interface, the parts that run without a browser. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* Join the sim and the pure UI files in one scope, as the page does, and return the names the tests reach into. */
function loadUI(files, names){
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',');
  return new Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}

test('every UI file joins with the sim into one script that compiles', () => {
  assert.doesNotThrow(() => new Function(sim.source() + '\n' + ui.source()));
});

test('the manifest lists every file in src/ui once, and state comes first', () => {
  const onDisk = fs.readdirSync('src/ui').filter(f => f.endsWith('.js') && f !== 'index.js').map(f => f.replace('.js', '')).sort();
  assert.deepEqual([...ui.FILES].sort(), onDisk);
  assert.equal(ui.FILES[0], 'state');
  assert.equal(ui.FILES[ui.FILES.length - 1], 'main');
});

const { runDays } = require('./lib/run');

test('every goal has a stage from STAGES, and a prerequisite names a goal that exists', () => {
  const api = loadUI(['state'], ['STAGES', 'stageReached']); api.startWorld('r');
  const ids = new Set(api.GOALS.map(g => g.id)), stages = new Set(api.STAGES.map(s => s.id));
  for (const g of api.GOALS){
    assert.ok(stages.has(g.stage), `${g.id} has stage ${g.stage}`);
    if (g.after) assert.ok(ids.has(g.after), `${g.id} is after ${g.after}, which does not exist`);
  }
  assert.deepEqual(api.STAGES.map(s => s.id), ['fire', 'food', 'tools', 'shelter', 'crafts', 'sprites', 'settlement']);
});

test('at the start only the fire stage is reached; by day 25 of seed r the ladder is open to crafts', () => {
  const fresh = loadUI(['state'], ['STAGES', 'stageReached']); fresh.startWorld('r'); fresh.camp = fresh.camps[0];
  assert.equal(fresh.stageReached('fire'), true);
  assert.equal(fresh.stageReached('tools'), false);
  assert.equal(fresh.stageReached('sprites'), false);
  const { api } = runDays('r', 25); api.camp = api.camps[0];
  for (const s of ['fire', 'food', 'tools', 'shelter', 'crafts']) assert.equal(api.stageReached(s), true, s);
  assert.equal(api.stageReached('sprites'), api.camps[0].fae.known, 'sprites follow first sight');
});

const DERIVE = ['gauges', 'daysOfWood', 'alerts', 'notePulses', 'isMuted', 'mute', 'unmute', 'stages', 'peopleRows', 'campSummary', 'viewKey', 'seasonLine', 'drawerRows', 'ui'];
function day21(){
  const api = loadUI(['state', 'derive'], DERIVE); api.startWorld('r');
  let lit = false;
  for (let i = 0; i < 21 * 1000; i++){ api.step(); if (!lit && api.camps[0].pit){ api.camp = api.camps[0]; api.lightTile(...api.camps[0].pit); lit = true; } }
  api.camp = api.camps[0]; return api;
}

test('gauges: the hearth reads days of wood, food reads meals against the aim, water waits for the waterskin', () => {
  const api = day21(); const g = api.gauges();
  assert.ok(g.hearth, 'a lit pit has a hearth gauge');
  assert.match(g.hearth.text, /days? of wood|out|cold/);
  assert.ok(g.hearth.v >= 0 && g.hearth.v <= 1);
  assert.match(g.food.text, /^\d+ of \d+$/);
  if (!api.camp.tools.waterskin) assert.equal(g.water, null); else assert.match(g.water.text, /^\d+ of \d+$/);
  assert.match(g.beds.text, /^\d+ for \d+$/);
  const fresh = loadUI(['state', 'derive'], DERIVE); fresh.startWorld('r'); fresh.camp = fresh.camps[0];
  assert.equal(fresh.gauges().hearth, null, 'no pit, no hearth gauge');
});

test('alerts: a cold person raises a cold chip, a mute hides it, and chips are numbered from one', () => {
  const api = day21(); const a = api.campHumans()[0];
  a.needs.warmth = 20; api.notePulses();
  const cold = api.alerts().find(x => x.type === 'cold');
  assert.ok(cold, 'cold chip'); assert.equal(cold.being, a.id); assert.match(cold.text, new RegExp(a.name));
  assert.equal(api.alerts()[0].n, 1);
  api.mute('cold', api.camp.id);
  assert.equal(api.alerts().some(x => x.type === 'cold'), false, 'muted for this camp');
  api.unmute('cold', api.camp.id); api.mute('cold', 0);
  assert.equal(api.alerts().some(x => x.type === 'cold'), false, 'muted everywhere');
  api.unmute('cold', 0);
  assert.ok(api.alerts().some(x => x.type === 'cold'));
});

test('alerts: a major chronicle line becomes a pulse that lasts 1500 ticks', () => {
  const api = day21();
  api.notePulses();
  const before = api.alerts().filter(x => x.type === 'event').length;
  api.log('Someone saw the smoke. Test comes over the hills.', [], 'major'); api.notePulses();
  assert.equal(api.alerts().filter(x => x.type === 'event').length, before + 1);
  api.tick = api.tick + 1600; api.notePulses();
  assert.equal(api.alerts().filter(x => x.type === 'event').length, before, 'pulse gone');
});

test('stages: only reached stages show, done goals fold, and a blocked goal shows only after its prerequisite', () => {
  const api = day21(); const st = api.stages(false);
  assert.ok(st.length >= 4 && st.length <= 7);
  assert.equal(st[0].id, 'fire');
  const fire = st[0]; assert.equal(fire.done, 3, 'camp, pit, hearth are done'); assert.equal(fire.goals.filter(x => !x.hidden).length, 1, 'keep the fire is the live one');
  for (const s of st) for (const x of s.goals) if (x.st.s === 'blocked' && !x.hidden && x.g.after) assert.equal(api.goalState(api.GOALS.find(g => g.id === x.g.after)).s, 'done');
  const all = api.stages(true); assert.equal(all.length, 7); assert.equal(all.reduce((n, s) => n + s.goals.length, 0), api.GOALS.length);
  const fresh = loadUI(['state', 'derive'], DERIVE); fresh.startWorld('r'); fresh.camp = fresh.camps[0];
  assert.deepEqual(fresh.stages(false).map(s => s.id), ['fire']);
});

test('people rows put trouble first, and the camp summary lists the stash as pairs', () => {
  const api = day21(); const rows = api.peopleRows();
  assert.ok(rows.length >= 1);
  rows[rows.length - 1].a.needs.food = 10;
  const again = api.peopleRows(); assert.ok(again[0].trouble, 'the hungry one is first');
  const c = api.campSummary(); assert.ok(Array.isArray(c.stash)); assert.ok(c.stash.every(p => p.length === 2 && p[1] > 0)); assert.ok(c.tools.includes('axe'));
});

test('the view key changes when the world does', () => {
  const api = day21(); const k1 = api.viewKey(); for (let i = 0; i < 300; i++) api.step(); assert.notEqual(api.viewKey(), k1);
});

const KEYS = ['KEYMAP', 'keyAction', 'ACTIONS'];
const ev = (key, mods = {}) => ({ key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods });

test('every key map entry names an action that exists', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  for (const k of api.KEYMAP) assert.equal(typeof api.ACTIONS[k.action], 'function', `${k.key} names ${k.action}`);
});

test('the dispatcher reads focus: Esc goes back, arrows move the cursor on the map and the row in a drawer, numbers toggle drawers on the map and pick rows in one', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.deepEqual(api.keyAction(ev('Escape'), 'map'), { action: 'back', arg: undefined });
  assert.deepEqual(api.keyAction(ev('Escape'), 'drawer:goals'), { action: 'back', arg: undefined });
  assert.deepEqual(api.keyAction(ev('ArrowLeft'), 'map'), { action: 'nav', arg: [-1, 0] });
  assert.deepEqual(api.keyAction(ev('ArrowDown'), 'drawer:people'), { action: 'rowDown', arg: undefined });
  assert.deepEqual(api.keyAction(ev('ArrowLeft'), 'drawer:goals'), { action: 'priorityDown', arg: undefined });
  assert.deepEqual(api.keyAction(ev('2'), 'map'), { action: 'drawer', arg: 'goals' });
  assert.deepEqual(api.keyAction(ev('2'), 'drawer:people'), { action: 'rowPick', arg: 2 });
  assert.deepEqual(api.keyAction(ev('Tab'), 'drawer:people'), { action: 'focusNext', arg: undefined });
  assert.deepEqual(api.keyAction(ev('Tab', { shiftKey: true }), 'map'), { action: 'focusPrev', arg: undefined });
  assert.deepEqual(api.keyAction(ev(' '), 'drawer:goals'), { action: 'pause', arg: undefined });
  assert.deepEqual(api.keyAction(ev('.'), 'map'), { action: 'step', arg: undefined });
  assert.deepEqual(api.keyAction(ev('>', { shiftKey: true }), 'map'), { action: 'hour', arg: undefined });
  assert.deepEqual(api.keyAction(ev('F2'), 'map'), { action: 'campN', arg: 2 });
  assert.equal(api.keyAction(ev('q'), 'map'), null);
});

test('every template button has a key in the key map', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  const html = fs.readFileSync('src/page.template.html', 'utf8');
  const ids = [...html.matchAll(/<button[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
  const keyed = new Set(api.KEYMAP.map(k => k.button).filter(Boolean));
  for (const id of ids) assert.ok(keyed.has(id), `button #${id} has no key`);
});

test('drawer rows: goals rows are the visible goals in stage order, people rows are trouble first', () => {
  const api = loadUI(['state', 'derive', 'keys'], DERIVE);
  api.startWorld('r'); api.camp = api.camps[0];
  const rows = api.drawerRows('goals');
  assert.ok(rows.length >= 1);
  assert.equal(rows[0].kind, 'stage'); assert.equal(rows[0].id, 'fire');
  assert.ok(rows.slice(1).every(r => r.kind === 'goal' || r.kind === 'stage'));
  const people = api.drawerRows('people'); assert.equal(people.length, 1); assert.equal(people[0].kind, 'person');
  api.ui.unfold.fire = true;
  assert.ok(api.drawerRows('goals').length >= rows.length, 'unfolding shows at least as many rows');
});

test('persist and restore keep the open drawers, the mutes, and the speed, and cope with no storage', () => {
  const api = loadUI(['state', 'derive', 'keys'], ['ui', 'persist', 'restore', 'mute']);
  const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  api.ui.open = ['goals']; api.mute('cold', 0); api.persist();
  api.ui.open = []; api.ui.mutes.clear(); api.restore();
  assert.deepEqual(api.ui.open, ['goals']); assert.ok(api.ui.mutes.has('cold'));
  delete global.localStorage;
  assert.doesNotThrow(() => api.persist()); assert.doesNotThrow(() => api.restore());
});

module.exports = { loadUI };
