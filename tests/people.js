// The People drawer's two filters, camp and age, and what the drawer reads from them. Fast.
// tests/ui.js runs only with SLOW=1, so these live here, where the fast suite runs them.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* Join the sim and the named UI files in one scope, as the page does. The same helper as tests/ui.js,
   which calls the Function constructor with `new`; the call form below is the same constructor. */
function loadUI(files, names, extra = {}){
  const more = Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join(', ');
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',' + (more ? ' ' + more + ',' : ''));
  return Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}

/* The actions call renderUI, which lives in panels.js and paints the page. It is stubbed for one call
   and counted, so a test can see that a filter change asks for a repaint. */
function withPage(fn){
  const page = { paints: 0 };
  global.renderUI = () => { page.paints++; };
  try { return fn(page); } finally { delete global.renderUI; }
}

const FILES = ['state', 'icons', 'derive', 'keys', 'marks', 'map', 'dialogs', 'actions'];
const NAMES = ['ui', 'peopleRows', 'peopleScope', 'peopleCount', 'peopleCampLabel', 'peopleAgeLabel', 'peopleMixed', 'viewKey', 'ACTIONS'];

/* A valley with two camps and a stray. The first camp is the one startWorld made, with its first
   person, and it gets an old and a young member too. The second camp has one adult. One adult has no
   camp. Every need is full, so nobody is in trouble and the sort is by camp order, then name.
   Every name is fixed, the first person's too, so a sort by name alone gives a different order from
   a sort by camp. The namer's pick for the first person could otherwise hide a missing camp order. */
function valley(){
  const api = loadUI(FILES, NAMES);
  api.startWorld('r');
  const c1 = api.camp, first = api.beings.find(b => b.species === 'human');
  const c2 = api.makeCamp('The second camp');
  const person = (name, home, years) => {
    const b = api.makeBeing('human', first.x, first.y, name, 0);
    b.camp = home; b.born = api.tick - years * api.DAY; api.beings.push(b); return b;
  };
  const young = person('Tam', c1, 5), old = person('Wren', c1, 70);
  const other = person('Ada', c2, 30), stray = person('Bo', null, 30);
  first.name = 'Sol'; first.born = api.tick - 30 * api.DAY;
  const all = [first, young, old, other, stray];
  for (const b of all){ for (const k in b.needs) b.needs[k] = 95; b.hp = 100; }
  assert.deepEqual(all.map(b => api.stage(b)), ['adult', 'young', 'old', 'adult', 'adult'], 'the hand-built ages are the stages the tests name');
  assert.equal(api.beings.filter(b => b.species === 'human').length, 5, 'the valley holds these five people and no others');
  return { api, c1, c2, first, young, old, other, stray };
}
const ids = api => api.peopleRows().map(r => r.a.id);

test('by default the list holds the chosen camp only, as before', () => {
  const { api, c1, first, young, old } = valley();
  assert.equal(api.ui.peopleCamp, null, 'the drawer starts by following the chosen camp');
  assert.equal(api.peopleScope().camp, c1, 'the scope is the chosen camp');
  assert.deepEqual(new Set(ids(api)), new Set([first.id, young.id, old.id]), 'the default list is the chosen camp and nobody else');
  assert.equal(api.peopleCampLabel(), `Camp: ${c1.name}`);
  assert.equal(api.peopleAgeLabel(), 'Age: any');
  assert.equal(api.peopleMixed(), false, 'one camp is not a mixed list');
});

test('with no chosen camp the list holds every person, in camp order, and the stray last', () => {
  const { api, first, young, old, other, stray } = valley();
  api.camp = null;
  assert.equal(api.peopleScope().camp, null);
  const byName = [first, young, old, other, stray].sort((p, q) => p.name.localeCompare(q.name)).map(b => b.id);
  const byCamp = [first.id, young.id, old.id, other.id, stray.id];
  assert.notDeepEqual(byName, byCamp, 'the fixed names put the camps out of order, so the name sort alone cannot pass');
  assert.deepEqual(ids(api), byCamp, 'every person: the first camp, then the second, then no camp, each by name');
  assert.equal(api.peopleCampLabel(), 'Everyone');
  assert.equal(api.peopleMixed(), true, 'a list over two camps and a stray names each row\'s camp');
});

test('the camp button cycles chosen, other, everyone, chosen, and a stale camp id falls back to the chosen camp', () => {
  const { api, c1, c2, first, young, old, other, stray } = valley();
  const c1set = new Set([first.id, young.id, old.id]);
  withPage(page => {
    api.ui.row.people = 2;
    api.ACTIONS.peopleCamp();
    assert.equal(api.ui.peopleCamp, c2.id, 'the first press goes to the other camp');
    assert.equal(api.peopleScope().camp, c2);
    assert.deepEqual(ids(api), [other.id], 'the list is the other camp');
    assert.equal(api.peopleCampLabel(), `Camp: ${c2.name}`);
    assert.equal(api.ui.row.people, 0, 'a filter change puts the row back at the top');
    api.ACTIONS.peopleCamp();
    assert.equal(api.ui.peopleCamp, 'all', 'the second press goes to everyone');
    assert.deepEqual(new Set(ids(api)), new Set([...c1set, other.id, stray.id]), 'everyone, the stray too');
    assert.equal(api.peopleCampLabel(), 'Everyone');
    api.ACTIONS.peopleCamp();
    assert.equal(api.ui.peopleCamp, null, 'the third press is back on the chosen camp');
    assert.deepEqual(new Set(ids(api)), c1set);
    assert.equal(page.paints, 3, 'each press asks for a repaint');
  });

  /* A camp id whose camp has ended. The list falls back to the chosen camp, and the next press counts
     the stale id as the chosen camp: with the second camp gone, that is everyone. */
  api.ui.peopleCamp = c2.id;
  api.camps.splice(api.camps.indexOf(c2), 1);
  assert.equal(api.peopleScope().camp, c1, 'a stale camp id falls back to the chosen camp');
  assert.deepEqual(new Set(ids(api)), c1set);
  withPage(() => api.ACTIONS.peopleCamp());
  assert.equal(api.ui.peopleCamp, 'all', 'a stale id counts as the chosen camp, so the next is everyone');

  /* With no chosen camp the list is everyone already, and the button changes nothing. */
  api.camp = null; api.ui.peopleCamp = null;
  withPage(page => { api.ACTIONS.peopleCamp(); assert.equal(page.paints, 0, 'no repaint for no change'); });
  assert.equal(api.ui.peopleCamp, null, 'no chosen camp, nothing to cycle');
});

test('the age button cycles any, young, adult, old, and each stage keeps only that stage', () => {
  const { api, first, young, old, other, stray } = valley();
  api.ui.peopleCamp = 'all';
  const seen = [];
  withPage(() => { for (let k = 0; k < 4; k++){ api.ACTIONS.peopleAge(); seen.push(api.ui.peopleAge); } });
  assert.deepEqual(seen, ['young', 'adult', 'old', 'any'], 'the cycle and its way back');
  const want = { young: [young.id], adult: [first.id, other.id, stray.id], old: [old.id] };
  for (const age of ['young', 'adult', 'old']){
    api.ui.peopleAge = age;
    assert.deepEqual(new Set(ids(api)), new Set(want[age]), `age ${age} keeps only that stage`);
    assert.equal(api.peopleAgeLabel(), `Age: ${age}`);
  }
  /* Both filters at once: the chosen camp and adult is the first person alone. */
  api.ui.peopleCamp = null; api.ui.peopleAge = 'adult';
  assert.deepEqual(ids(api), [first.id]);
});

test('each filter press puts the People row back at the top', () => {
  const { api } = valley();
  withPage(() => {
    api.ui.row.people = 2;
    api.ACTIONS.peopleAge();
    assert.equal(api.ui.row.people, 0, 'the age button resets the row');
    api.ui.row.people = 2;
    api.ACTIONS.peopleCamp();
    assert.equal(api.ui.row.people, 0, 'the camp button resets the row');
  });
});

test('the count gives the living shown and the living in the world, and the day\'s dead count in neither', () => {
  const { api, young } = valley();
  assert.deepEqual(api.peopleCount(), { shown: 3, alive: 5 }, 'three in the chosen camp, five in the world');
  young.alive = false; young.diedAt = api.tick;
  assert.ok(api.peopleRows().some(r => r.a === young), 'the dead stay on the list for a day');
  assert.deepEqual(api.peopleCount(), { shown: 2, alive: 4 }, 'the dead of the day count in neither number');
  api.ui.peopleCamp = 'all';
  assert.deepEqual(api.peopleCount(), { shown: 4, alive: 4 }, 'with nobody hidden the two agree');
});

test('a filter change moves the view key, even where the rows stay the same', () => {
  const { api, c1 } = valley();
  const before = api.viewKey(), rows = ids(api);
  /* The camp id names the chosen camp, so the rows do not change, but the button is now on. */
  api.ui.peopleCamp = c1.id;
  assert.deepEqual(ids(api), rows, 'the rows are the same');
  assert.notEqual(api.viewKey(), before, 'the key must move, or the button would not repaint');
  api.ui.peopleCamp = null;
  assert.equal(api.viewKey(), before, 'back to the default, back to the same key');
});

test('restore() accepts the four ages and rejects any other value, and persist() writes the age but not the camp', () => {
  const api = loadUI(['state'], ['ui', 'persist', 'restore']);
  const readBack = (start, value) => {
    api.ui.peopleAge = start;
    global.localStorage = { getItem: () => JSON.stringify({ peopleAge: value }) };
    try { api.restore(); } finally { delete global.localStorage; }
    return api.ui.peopleAge;
  };
  for (const age of ['any', 'young', 'adult', 'old']) assert.equal(readBack(age === 'any' ? 'old' : 'any', age), age, `restore accepts ${age}`);
  for (const bad of ['teen', 'Old', 3, null, { s: 'old' }]) assert.equal(readBack('any', bad), 'any', `restore rejects ${JSON.stringify(bad)}`);

  let saved = null;
  api.ui.peopleAge = 'old'; api.ui.peopleCamp = 7;
  global.localStorage = { setItem: (k, v) => { saved = JSON.parse(v); } };
  try { api.persist(); } finally { delete global.localStorage; }
  assert.ok(saved, 'persist wrote to the stub');
  assert.equal(saved.peopleAge, 'old', 'persist writes the age');
  assert.ok(!('peopleCamp' in saved), 'persist leaves the camp out, since a camp id is valid in one world only');
});

test('E and Y fire the two filters with a drawer or a window focused, and not with the map focused', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], ['KEYMAP', 'keyAction', 'ACTIONS']);
  const press = (key, focus) => { const h = api.keyAction({ key, code: 'Key' + key.toUpperCase(), shiftKey: false, ctrlKey: false, altKey: false, metaKey: false }, focus); return h && h.action; };
  /* A popped-out drawer has the focus 'window:<n>', and keyAction reads only the window rows there. */
  for (const focus of ['drawer:people', 'drawer:goals', 'window:1']){
    assert.equal(press('e', focus), 'peopleCamp', `E with ${focus}`);
    assert.equal(press('y', focus), 'peopleAge', `Y with ${focus}`);
  }
  assert.notEqual(press('e', 'map'), 'peopleCamp', 'E is a drawer key');
  assert.notEqual(press('y', 'map'), 'peopleAge', 'Y is a drawer key');
  const row = a => api.KEYMAP.find(k => k.action === a && k.focus === 'drawer');
  for (const a of ['peopleCamp', 'peopleAge']){
    const win = api.KEYMAP.find(k => k.action === a && k.focus === 'window');
    assert.equal(win.label, row(a).label, `the window row for ${a} has the drawer row's label`);
    assert.equal(win.button, undefined, 'a popped-out window has no filter buttons');
  }
  assert.equal(row('peopleCamp').label, 'People: the next camp, then everyone');
  assert.equal(row('peopleCamp').button, 'peopleCampBtn');
  assert.equal(row('peopleAge').label, 'People: the next age');
  assert.equal(row('peopleAge').button, 'peopleAgeBtn');
  assert.equal(typeof api.ACTIONS.peopleCamp, 'function');
  assert.equal(typeof api.ACTIONS.peopleAge, 'function');
});
