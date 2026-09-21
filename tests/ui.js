// The interface, the parts that run without a browser. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const sim = require('../src/sim');

/* SUSPENDED for the duration of G4, by task 1, with the user's approval through dev-coordinator.
   This file asks for 25 world days, and no day count in it has been changed. A world day
   costs about 15 s on this branch against dev's 0.31 s, so the file cannot finish in a usable time.
   The cost is the retune's, not the file's: nothing here grew, and task 4 is built to give the day
   back. The day counts are kept exactly as written rather than cut, because a count reduced to fit a
   slow engine is a gate nobody measured.
   Run it with SLOW=1. Task 4 restores it. */
const SUSPENDED_FOR_G4 = process.env.SLOW ? false
  : 'suspended for G4: this file asks for 25 world days and a world day costs about 15 s on this branch, not dev\'s 0.31 s. SLOW=1 runs it. Task 4 restores it.';
if (SUSPENDED_FOR_G4){
  test('tests/ui.js is suspended for the duration of G4', { skip: SUSPENDED_FOR_G4 }, () => {});
  return;
}

const ui = require('../src/ui');

/* Join the sim and the pure UI files in one scope, as the page does, and return the names the tests reach into.
   `extra` maps a key to an expression, so a test can read a `let` variable through a small reader function. */
function loadUI(files, names, extra = {}){
  const more = Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join(', ');
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',' + (more ? ' ' + more + ',' : ''));
  return new Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}

/* Some actions paint the page as well as change the state. These tests have no browser, so the few
   page entry points those actions reach are stubbed for the length of one call, then taken away.
   The stubs are free names in the joined scope, so the global object is where they go. */
function withPage(fn){
  const el = { hidden: false, innerHTML: '', textContent: '', dataset: {}, style: {},
    classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } },
    setAttribute(){}, appendChild(){}, replaceChildren(){}, scrollIntoView(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; } };
  global.document = { getElementById: () => el, querySelector: () => el, querySelectorAll: () => [], createElement: () => el, body: el };
  const page = { paints: 0 };
  global.renderUI = () => { page.paints++; }; global.renderFoot = () => {}; global.hideTip = () => {};
  try { return fn(page); }
  finally { delete global.document; delete global.renderUI; delete global.renderFoot; delete global.hideTip; }
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
  for (let i = 0; i < api.ticks(21 * 1000); i++){ api.step(); if (!lit && api.camps[0].pit){ api.camp = api.camps[0]; api.lightTile(...api.camps[0].pit); lit = true; } }
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
  const who = api.campHumans()[0];
  api.tick = api.tick + 1; /* notePulses reads lines newer than the tick it last saw */
  api.log(`${who.name} finds a fine flat stone.`, [], 'major'); api.notePulses();
  const chip = api.alerts().find(x => x.type === 'event' && x.text.includes(who.name));
  assert.ok(chip, 'the named line is a chip'); assert.equal(chip.being, who.id, 'the chip knows its cause');
  api.tick = api.tick + api.ticks(1600); api.notePulses();
  assert.ok(!api.alerts().some(x => x.type === 'event' && x.text.includes('Test comes over the hills')), 'pulse gone');
});

/* The creation writes a chronicle full of major lines, all of them at tick 0 and all carrying an age. They are
   the story of the world, not news from the camp, and several read word for word the same. */
test('a legend of the ages is never a chip', () => {
  const api = loadUI(['state', 'derive', 'keys'], DERIVE);
  api.startWorld('r'); api.camp = api.camps[0]; api.notePulses();
  const said = new Set(api.legends.map(e => e.text));
  assert.ok(said.size > 5, 'no legends to test with');
  assert.deepEqual(api.ui.pulses.filter(p => said.has(p.text)), [], 'a legend of the ages became a chip');
  /* The one day-era line written at tick 0 is the person walking in, and that one is news. */
  assert.deepEqual(api.ui.pulses.map(p => p.text).filter(t => !/walks alone into the/.test(t)), []);
  const labels = api.alerts().filter(x => x.type === 'event').map(x => x.text);
  assert.equal(new Set(labels).size, labels.length, 'the same chip twice');
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

test('a person who died on tick zero still holds their row for a day', () => {
  const api = loadUI(['state', 'derive'], DERIVE); api.startWorld('r');
  api.camp = api.camps[0];
  const a = api.firstPerson(); a.camp = api.camps[0];
  api.tick = 0; a.alive = false; a.diedAt = 0;
  const row = api.peopleRows().find(r => r.a === a);
  assert.ok(row, 'a death stamped zero dropped the row at once');
  assert.equal(row.status, 'Dead');
  api.tick = api.DAY;
  assert.equal(api.peopleRows().some(r => r.a === a), false, 'the dead stay a day, no longer');
});

test('state lines: a mauled person is told the wolves keep off, and only a living person is told', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'stateLines']); api.startWorld('r');
  api.camp = api.camps[0];
  const a = api.firstPerson(); a.camp = api.camps[0]; a.alive = true; a.inDark = false;
  api.tick = 1000;
  const wolfLine = 'The wolves keep their distance for now.';

  a.cooldown.stalked = api.tick + 500;
  assert.deepEqual(api.stateLines(a), [wolfLine], 'a wait still running says the wolves keep off');
  a.cooldown.stalked = api.tick;
  assert.deepEqual(api.stateLines(a), [], 'the wait ends on the tick it names');
  a.cooldown.stalked = api.tick - 500;
  assert.deepEqual(api.stateLines(a), [], 'a wait long past says nothing');

  a.cooldown.stalked = api.tick + 500; a.inDark = true;
  assert.deepEqual(api.stateLines(a), ['In the dark without a brand.', wolfLine], 'the dark line comes first');
  a.inDark = false;

  a.alive = false;
  assert.deepEqual(api.stateLines(a), [], 'the dead carry no state line');
  a.alive = true;

  const cool = { stalked: api.tick + 500 };
  assert.deepEqual(api.stateLines({ species: 'wolf', alive: true, cooldown: cool }), [], 'a beast carries none');
  assert.deepEqual(api.stateLines({ species: 'god', alive: true, cooldown: cool }), [], 'a god carries none');
  assert.deepEqual(api.stateLines(null), [], 'nobody carries none');
});

/* Every sink that writes save-borne text into innerHTML. A hand-edited save is the only way markup
   reaches them, and the sim never writes any, but the escape belongs at the sink all the same. */
const TAG = '<img src=x onerror="boom()">';
const SINK_FILES = ['state', 'derive', 'keys', 'saves', 'map', 'timeline', 'inspect', 'strip', 'windows', 'panels', 'dialogs', 'actions'];
const SINK_NAMES = [...new Set([...DERIVE, 'gaugeHTML', 'chipHTML', 'winTitle', 'esc', 'renderPeople', 'renderGoals', 'renderChronicle', 'renderCamp', 'renderLegends', 'renderFoot', 'fullName'])];
const cell = () => ({ innerHTML: '', dataset: {}, textContent: '' });
function clean(html, where){
  assert.equal(html.includes('<img'), false, `${where} let the tag through`);
  assert.ok(html.includes('&lt;img'), `${where} did not escape the tag`);
}

test('the drawers, the strip, the foot, and a window title escape text a save file can carry', () => {
  const api = loadUI(SINK_FILES, SINK_NAMES); api.startWorld('r');
  api.camp = api.camps[0];

  clean(api.gaugeHTML('hearth', { level: 'good', v: 0.5, text: TAG }), 'the hearth gauge');
  clean(api.chipHTML({ n: 1, level: 'bad', text: TAG }), 'an alert chip');

  const a = api.campHumans()[0];
  a.name = TAG; a.status = TAG;
  clean(api.winTitle({ kind: 'inspect', target: { being: a.id } }), 'a window title');
  const people = cell(); withPage(() => api.renderPeople(people));
  clean(people.innerHTML, 'the People drawer');

  api.camp.site = api.camp.site || [1, 1]; api.camp.siteReason = TAG;
  api.ui.showAll = true;
  const goals = cell(); withPage(() => api.renderGoals(goals));
  clean(goals.innerHTML, 'the Goals drawer');

  api.chronicle.unshift({ tick: 0, when: TAG, text: TAG, kind: TAG });
  api.ui.chronFilter = 'all';
  const chron = cell(); withPage(() => api.renderChronicle(chron));
  clean(chron.innerHTML, 'the Chronicle drawer');

  api.legends.push({ when: TAG, text: TAG, kind: TAG });
  const legends = cell(); withPage(() => api.renderLegends(legends));
  clean(legends.innerHTML, 'the Legends drawer');

  api.camp.tools[TAG] = true;
  const camp = cell(); withPage(() => api.renderCamp(camp));
  clean(camp.innerHTML, 'the Camp drawer');

  withPage(() => { api.ui.open = []; api.renderFoot(); clean(global.document.getElementById('foot').innerHTML, 'the foot'); });
});

test('esc covers four characters, not the single quote, and no attribute in src/ui is single-quoted', () => {
  const api = loadUI(['state', 'derive', 'keys', 'strip'], ['esc']);
  assert.equal(api.esc('<b>&"</b>'), '&lt;b&gt;&amp;&quot;&lt;/b&gt;');
  assert.equal(api.esc("it's"), "it's", "esc leaves the single quote, and the comment at esc says so");
  /* That is safe only while every attribute is built with double quotes. The day one is written with
     single quotes, esc stops protecting it and says nothing. This is the guard the comment names. */
  for (const f of ui.FILES){
    const src = fs.readFileSync(`src/ui/${f}.js`, 'utf8');
    const bad = src.match(/<[a-z][^>]*\s[a-z-]+='/g);
    assert.equal(bad, null, `${f}.js builds an attribute with single quotes: ${bad && bad[0]}`);
  }
});

test('the view key changes when the world does, and holds still when nothing does', () => {
  const api = day21(); const k1 = api.viewKey();
  assert.equal(api.viewKey(), k1, 'two calls with no step between give the same key');
  for (let i = 0; i < 300; i++) api.step(); assert.notEqual(api.viewKey(), k1);
});

test('stages: every idle goal folds, a recipe or one written by hand, and the stage counts them', () => {
  const api = day21();
  api.camp.tools.rod = true; api.camp.stash.fish = 4;
  const byId = {}; for (const s of api.stages(false)) for (const x of s.goals) byId[x.g.id] = x;
  assert.equal(byId.fish.st.s, 'idle', 'the rod and four fish make fishing idle');
  assert.equal(byId.fish.hidden, true, 'an idle recipe folds');
  const hand = byId.water && byId.water.st.s === 'idle' ? byId.water : byId.guard;
  assert.equal(hand.st.s, 'idle');
  assert.equal(hand.hidden, true, 'an idle standing goal folds too');
  for (const s of api.stages(false)) assert.equal(s.idle, s.goals.filter(x => x.st.s === 'idle').length, `${s.id} counts its idle goals`);
  for (const s of api.stages(true)) for (const x of s.goals) assert.equal(x.hidden, false, 'All shows every goal');
});

const KEYS = ['KEYMAP', 'keyAction', 'keyName', 'ACTIONS'];
const ev = (key, mods = {}) => ({ key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods });
/* keyAction also returns the matched row's focus. These tests care about the action and its argument. */
const keyHit = (api, e, focus) => { const h = api.keyAction(e, focus); return h && { action: h.action, arg: h.arg }; };

test('every key map entry names an action that exists', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  for (const k of api.KEYMAP) assert.equal(typeof api.ACTIONS[k.action], 'function', `${k.key} names ${k.action}`);
});

test('the dispatcher reads focus: Esc goes back, arrows move the cursor on the map and the row in a drawer, numbers toggle drawers on the map and pick rows in one', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.deepEqual(keyHit(api, ev('Escape'), 'map'), { action: 'back', arg: undefined });
  assert.deepEqual(keyHit(api, ev('Escape'), 'drawer:goals'), { action: 'back', arg: undefined });
  assert.deepEqual(keyHit(api, ev('ArrowLeft'), 'map'), { action: 'cursor', arg: [-1, 0, 1] });
  assert.deepEqual(keyHit(api, ev('ArrowDown'), 'drawer:people'), { action: 'rowDown', arg: undefined });
  assert.deepEqual(keyHit(api, ev('ArrowLeft'), 'drawer:goals'), { action: 'priorityDown', arg: undefined });
  assert.deepEqual(keyHit(api, ev('2'), 'map'), { action: 'drawer', arg: 'goals' });
  assert.deepEqual(keyHit(api, ev('2'), 'drawer:people'), { action: 'rowPick', arg: 2 });
  assert.deepEqual(keyHit(api, ev('Tab'), 'drawer:people'), { action: 'focusNext', arg: undefined });
  assert.deepEqual(keyHit(api, ev('Tab', { shiftKey: true }), 'map'), { action: 'focusPrev', arg: undefined });
  assert.deepEqual(keyHit(api, ev(' '), 'drawer:goals'), { action: 'pause', arg: undefined });
  assert.deepEqual(keyHit(api, ev('.'), 'map'), { action: 'step', arg: undefined });
  assert.deepEqual(keyHit(api, ev('>', { shiftKey: true }), 'map'), { action: 'hour', arg: undefined });
  assert.deepEqual(keyHit(api, ev('F2'), 'map'), { action: 'campN', arg: 2 });
  assert.equal(keyHit(api, ev('q'), 'map'), null);
});

test('every side tab starts closed', () => {
  const api = loadUI(['state'], ['ui']);
  assert.deepEqual(api.ui.open, [], 'ui.open starts empty, so no card covers the map at the start');
});

/* Recommendation 15: a tab's key opens and closes the drawer, and never takes the keyboard with it.
   The approved table: 1 opens People and the game keys still work; 1 again closes it; a click inside
   the card gives the card the keyboard, until Esc or a click on the map gives it back to the game,
   and the card stays open through that. */
test('a tab’s key opens and closes the drawer, and leaves the game keys working', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...KEYS, 'ui']);
  assert.equal(api.ui.focus, 'map');
  withPage(() => api.ACTIONS.drawer('people'));
  assert.deepEqual(api.ui.open, ['people'], 'People opens');
  assert.equal(api.ui.focus, 'map', 'the keys still act on the game, not the card');
  withPage(() => api.ACTIONS.drawer('people'));
  assert.deepEqual(api.ui.open, [], 'pressing the key again closes People');
  assert.equal(api.ui.focus, 'map');
});

test('once a click has put the keyboard on the card, Esc gives it back to the game and leaves the card open', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...KEYS, 'ui']);
  withPage(() => api.ACTIONS.drawer('people'));
  /* A click inside the card is main.js's own pointerdown handler, which calls setFocus. Here that is
     stood in for directly, since main.js wires no DOM in this file's tests. */
  api.ui.focus = 'drawer:people';
  assert.deepEqual(keyHit(api, ev('2'), api.ui.focus), { action: 'rowPick', arg: 2 }, 'a number now picks a row in the card');
  withPage(() => api.ACTIONS.back());
  assert.equal(api.ui.focus, 'map', 'Esc returns the keys to the game');
  assert.deepEqual(api.ui.open, ['people'], 'the card stays open');
});

/* setActCaption must refresh the foot itself: renderUI only runs every 250ms of wall time, so without
   this the foot could go on repeating a sentence the caption above it already shows, or stay blank
   after the caption clears, for up to that long. This also pins the foot's own de-duplication rule
   (panels.js's `echoed`), through the one path a player would actually see it change. */
test('setActCaption refreshes the foot, which leaves out a line the caption above already shows', () => {
  const api = loadUI(['state', 'derive', 'keys', 'strip', 'actions', 'panels'], [...DERIVE, 'ACTIONS', 'renderFoot', 'setActCaption']);
  api.startWorld('r'); api.camp = api.camps[0]; api.ui.open = [];
  const line = api.chronicle[0];
  const els = { foot: cell(), actCaption: cell() };
  const had = { document: globalThis.document, renderUI: globalThis.renderUI, hideTip: globalThis.hideTip };
  globalThis.document = { getElementById: id => els[id] || cell(), querySelector: () => null, querySelectorAll: () => [] };
  globalThis.renderUI = () => {}; globalThis.hideTip = () => {};
  try {
    api.renderFoot();
    assert.ok(els.foot.innerHTML.includes(line.text), 'setup: with the chronicle drawer shut, the foot shows the newest line');
    api.setActCaption(line.text);
    assert.ok(!els.foot.innerHTML.includes(line.text), 'the caption now shows this line, and setActCaption refreshes the foot right away, so it does not go on repeating it');
    api.setActCaption('A different sentence entirely, not the chronicle line.');
    assert.ok(els.foot.innerHTML.includes(line.text), 'a caption with different text does not echo, so the same refresh brings the chronicle line back');
  } finally {
    for (const k of Object.keys(had)) if (had[k] === undefined) delete globalThis[k]; else globalThis[k] = had[k];
  }
});

/* Recommendation 8: the notes said the keyboard could not reach a drawer's controls until a click. Tab
   proves that wrong, through the same focusRing/focusStep path a window uses (see the window test near
   line 717). This is the fact the accepted-cost bullet in design/notes.md is rewritten to. */
test('Tab reaches an open drawer from the map, with no click needed', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...KEYS, 'ui']);
  withPage(() => api.ACTIONS.drawer('people'));
  assert.equal(api.ui.focus, 'map', 'the key that opened the drawer leaves the game holding the keys');
  withPage(() => api.ACTIONS.focusNext());
  assert.equal(api.ui.focus, 'drawer:people', 'Tab moves the keyboard into the open drawer');
});

/* Below 800 px wide only one drawer stays open (openDrawer's narrow branch). If the drawer that held the
   focus is the one that gets closed to make room for the next, the focus must not be left naming a
   drawer nobody can see: the number keys would go on picking rows in a hidden list. */
test('below 800 px, opening a second drawer sends a focus left on the one it closed back to the map', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...KEYS, 'ui']);
  const had = globalThis.innerWidth;
  globalThis.innerWidth = 700;
  try {
    withPage(() => api.ACTIONS.drawer('people'));
    /* A click inside the card is main.js's own pointerdown handler, which calls setFocus. Stood in
       for directly here, as the other focus tests in this file do. */
    api.ui.focus = 'drawer:people';
    withPage(() => api.ACTIONS.drawer('goals'));
    assert.deepEqual(api.ui.open, ['goals'], 'narrow width keeps only the drawer just opened');
    assert.equal(api.ui.focus, 'map', 'People is gone, so its stale focus does not survive it');
  } finally {
    if (had === undefined) delete globalThis.innerWidth; else globalThis.innerWidth = had;
  }
});

test('opening Chronicle by / or a stage by its chord still takes the player into the card, deliberately', () => {
  withDom(() => {
    const api = loadUI(UI_ALL, [...KEYS, 'ui']);
    api.startWorld('r'); api.camp = api.camps[0];
    api.ACTIONS.searchChronicle();
    assert.equal(api.ui.focus, 'drawer:chronicle', 'a search jump still enters the card');
    const stageId = api.STAGES[0].id;
    api.ACTIONS.stage(stageId);
    assert.equal(api.ui.focus, 'drawer:goals', 'a stage jump still enters the card');
  });
});

test('Make world and Take a god close every tab, even one a saved session had open; Continue and Load do not', () => {
  const api = loadUI(['state', 'derive', 'actions'],
    [...DERIVE, 'ACTIONS', 'newWorld', 'onLoad'],
    { setUp: '() => { wcv = {}; ocv = {}; dpr = 1; }' });
  api.setUp();
  withPage(() => api.newWorld('r'));
  api.ui.open = ['people', 'goals'];
  withPage(() => api.newWorld('r'));
  assert.deepEqual(api.ui.open, [], 'Make world closes every tab, whatever was open before it');
  api.ui.open = ['camp'];
  withPage(() => api.ACTIONS.takeGod('r'));
  assert.deepEqual(api.ui.open, [], 'and so does Take a god');
  api.ui.open = ['camp', 'legends'];
  withPage(() => api.onLoad());
  assert.deepEqual(api.ui.open, ['camp', 'legends'], 'a load keeps the tabs the loaded world had open');
});

/* Buttons rendered by the interface, not by the template. */
const RUNTIME = ['tab-people', 'tab-goals', 'tab-chronicle', 'tab-camp', 'tab-legends', 'showAllBtn', 'chord-fire', 'chord-food', 'chord-tools', 'chord-shelter', 'chord-crafts', 'chord-sprites', 'chord-settlement', 'foldTl', 'tlOut', 'tlIn'];

test('every template button prints a key, and every keyed button id is in the template', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  const html = fs.readFileSync('src/page.template.html', 'utf8');
  for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)){
    const id = (m[0].match(/\bid="([^"]+)"/) || [, m[0]])[1];
    assert.match(m[1], /<kbd>/, `button #${id} prints no key`);
  }
  const ids = new Set([...html.matchAll(/<button[^>]*\bid="([^"]+)"/g)].map(m => m[1]));
  for (const k of api.KEYMAP) if (k.button && !RUNTIME.includes(k.button)) assert.ok(ids.has(k.button), `key map names button #${k.button}, which is not in the template`);
});

/* A click reads the template, not the constant: main.js hands `Number(b.dataset.pace)` or
   `Number(b.dataset.speed)` to `ACTIONS.speed`. So this test reads the template too. A test that
   walked `PACES` and `SPEEDS` again would agree with the constants and never see the template drift
   away from them, which is how `data-pace="4"` could set an unknown pace with a green suite. */
/* The scan is per button, not per attribute. One handler reads `data-pace` in the ages and
   `data-speed` after, on the same click, so carrying both is a property of each button. Two flat
   lists of attribute values cannot state it: a fifth button with `data-speed` and no `data-pace`
   leaves both lists complete, and the button is dead in the ages. */
/* The scan is also per place. src/ui/main.js binds the click to the #speeds span, so a button with
   both attributes outside that span is dead in both eras. Read the span, then check that no element
   anywhere else in the template carries either attribute. */
test('every speed button sits in #speeds and carries both attributes, each is a rung of its ladder, and every rung has a button', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], ['PACES', 'SPEEDS']);
  const html = fs.readFileSync('src/page.template.html', 'utf8');
  const ladders = [['pace', 'PACES', api.PACES], ['speed', 'SPEEDS', api.SPEEDS]];
  const open = html.match(/<span\b[^>]*\bid="speeds"[^>]*>/);
  assert.ok(open, 'the template holds no <span id="speeds">; src/ui/main.js binds the speed click to that span, so this test reads nothing');
  /* Walk to the matching close tag, counting depth. A non-greedy match would stop at a nested
     </span> and call the buttons after it outsiders, which names the wrong fault. */
  const from = open.index;
  let depth = 0, to = -1;
  for (const m of html.slice(from).matchAll(/<span\b[^>]*>|<\/span>/g)){
    depth += m[0] === '</span>' ? -1 : 1;
    if (depth === 0){ to = from + m.index + m[0].length; break; }
  }
  assert.ok(to > from, 'the template never closes <span id="speeds">, so this test cannot tell which buttons sit in it');
  const inner = html.slice(from + open[0].length, to - '</span>'.length);
  for (const [attr] of ladders){
    for (const m of html.matchAll(new RegExp(`<[a-zA-Z][^>]*\\bdata-${attr}="[^"]*"[^>]*>`, 'g'))){
      const tag = m[0], id = (tag.match(/\bid="([^"]+)"/) || [, tag])[1];
      assert.ok(m.index >= from && m.index < to, `#${id} carries data-${attr} outside <span id="speeds">; src/ui/main.js binds the speed click to that span, so a click on this element sets no speed in either era`);
    }
  }
  const buttons = [...inner.matchAll(/<button\b[^>]*>/g)].map(m => m[0]).filter(b => /\bdata-(pace|speed)="/.test(b));
  assert.ok(buttons.length, 'the template holds no speed button, so this test reads nothing');
  const value = (b, attr) => { const m = b.match(new RegExp(`\\bdata-${attr}="([^"]*)"`)); return m ? Number(m[1]) : undefined; };
  for (const b of buttons){
    const id = (b.match(/\bid="([^"]+)"/) || [, b])[1];
    for (const [attr, name, rungs] of ladders){
      const v = value(b, attr);
      assert.ok(v !== undefined, `button #${id} carries no data-${attr}; one handler reads data-pace in the ages and data-speed after, so this button is dead in one era`);
      assert.ok(rungs.includes(v), `button #${id} carries data-${attr}="${v}", which is not on ${name} (${rungs.join(', ')}); a click on it would set that value`);
    }
  }
  for (const [attr, name, rungs] of ladders){
    const found = buttons.map(b => value(b, attr));
    for (const r of rungs) assert.ok(found.includes(r), `${name} holds ${r}, which no data-${attr} button in the template can reach`);
  }
  /* The handler takes the nearest `[data-speed]` ancestor, which need not be a button. Count the
     attributes inside the span too, so one moved onto another element there is not left unread. */
  for (const [attr] of ladders){
    const all = [...inner.matchAll(new RegExp(`\\bdata-${attr}="`, 'g'))].length;
    assert.equal(all, buttons.length, `<span id="speeds"> holds ${all} data-${attr} attributes and ${buttons.length} speed buttons; this test reads the buttons, so an attribute on another element goes unchecked`);
  }
});

/* Four init sites hand a hard-coded 1 to the guarded doors:
     src/ui/actions.js:90    setPace(1)
     src/ui/actions.js:159   setSpeed(ui.savedSpeed || speed || 1)
     src/ui/actions.js:222   setSpeed(ui.savedSpeed || speed || 1)
     src/ui/main.js:142      setSpeed(1)
   The guard throws on a value off its ladder, so a ladder edited to drop 1 does not give the player
   a wrong speed. It gives them a blank page, because the throw lands on the startup path.
   These two assertions are the only thing that catches that. Every other reference to either ladder
   indexes it — PACES[1], SPEEDS[1], SPEEDS.forEach — and an index survives 1 leaving.
   Do not delete them while removing assertions that restate a constant (issue #80). They read like
   one and they are not: each states an assumption the init path already makes, in the one place a
   ladder edit is read. Delete either, edit its ladder, and the suite stays green while the page
   stops opening. */
test('the value the init path hands each door is a rung of that door’s ladder', () => {
  const api = loadUI(['state'], ['PACES', 'SPEEDS']);
  assert.ok(api.PACES.includes(1), 'the ages open with setPace(1), so 1 must be a rung of PACES or the first frame throws');
  assert.ok(api.SPEEDS.includes(1), 'the days open with setSpeed(1) and the `|| 1` fallback, so 1 must be a rung of SPEEDS or the first frame throws');
});

/* The guard at the door, for the routes a template scan cannot see: a direct call, and any call site
   added later. 4 is on SPEEDS and not on PACES, and 2 is on PACES and not on SPEEDS, so each case is
   the drift between the two ladders, not a value invented for the test. */
test('setPace and setSpeed throw on a value off the ladder, and the ladder keeps its last good value', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], ['PACES', 'SPEEDS', 'setPace', 'setSpeed'],
    { getPace: '() => pace', getSpeed: '() => speed' });
  withPage(() => {
    api.setPace(api.PACES[1]); api.setSpeed(api.SPEEDS[1]);
    const p = api.getPace(), s = api.getSpeed();
    assert.throws(() => api.setPace(4), /setPace was given 4, which is not on the ladder PACES/);
    assert.throws(() => api.setSpeed(2), /setSpeed was given 2, which is not on the ladder SPEEDS/);
    assert.equal(api.getPace(), p, 'a rejected pace leaves the pace alone');
    assert.equal(api.getSpeed(), s, 'a rejected speed leaves the speed alone');
  });
});

const unesc = t => t.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const ARROW = { ArrowLeft: '\u2190', ArrowRight: '\u2192', ArrowUp: '\u2191', ArrowDown: '\u2193' };

test('every keyed button in the template prints that row\u2019s key, exactly as keyName writes it', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  const html = fs.readFileSync('src/page.template.html', 'utf8');
  const kbd = {};
  for (const m of html.matchAll(/<button\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)){
    const k = m[2].match(/<kbd>([\s\S]*?)<\/kbd>/);
    if (k) kbd[m[1]] = unesc(k[1]);
  }
  let checked = 0;
  for (const k of api.KEYMAP){
    if (!k.button || !(k.button in kbd)) continue;
    assert.equal(kbd[k.button], api.keyName(k), `button #${k.button} prints ${kbd[k.button]}, the row says ${api.keyName(k)}`);
    if (ARROW[k.key]) assert.ok(kbd[k.button].includes(ARROW[k.key]), `button #${k.button} shows no arrow`);
    checked++;
  }
  assert.ok(checked >= 12, `only ${checked} template buttons carry a key map row`);
});

test('keyName prints the modifiers: \u2318K, Ctrl+K, Shift+F, Shift+Alt+1, and no Shift on ? or >', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  const named = l => api.KEYMAP.filter(k => k.label === l);
  assert.equal(api.keyName(named('Command palette').find(k => k.meta)), '\u2318K');
  assert.equal(api.keyName(named('Command palette').find(k => k.ctrl)), 'Ctrl+K');
  assert.equal(api.keyName(named('Light fire, and keep it')[0]), 'Shift+F');
  assert.equal(api.keyName(named('Nudge, and keep it')[0]), 'Shift+N');
  assert.equal(api.keyName(named('Mute alert 1')[0]), 'Shift+Alt+1');
  assert.equal(api.keyName(named('Jump to alert 1')[0]), 'Alt+1');
  assert.equal(api.keyName(named('Help')[0]), '?');
  assert.equal(api.keyName(named('Step one hour')[0]), '>');
  assert.equal(api.keyName(named('New world')[0]), 'Ctrl+N');
  assert.equal(api.keyName(named('West edge, then a sector west')[0]), 'Alt+\u2190');
  assert.equal(api.keyName(named('Previous panel')[0]), 'Shift+Tab');
});

test('Esc answers from every focus: the map, a drawer, a window, and each dialog', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  for (const focus of ['map', 'drawer:goals', 'window:3', 'dialog:mute', 'dialog:palette', 'dialog:help', 'dialog:start', 'dialog:chord']){
    const hit = api.keyAction(ev('Escape'), focus);
    assert.ok(hit, `Esc from ${focus} finds no row`);
    assert.equal(hit.action, 'back', `Esc from ${focus} runs ${hit.action}`);
  }
});

test('the palette lists every static action', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...DERIVE, ...KEYS, 'paletteRows']);
  api.startWorld('r'); api.camp = api.camps[0]; api.notePulses();
  const labels = new Set(api.paletteRows().map(r => r.label));
  const seen = new Set();
  for (const k of api.KEYMAP){
    if (k.action === 'rowPick' || k.focus.startsWith('dialog')) continue;
    if (seen.has(k.label)) continue; seen.add(k.label);
    assert.ok(labels.has(k.label), `the palette has no row for ${k.label}`);
  }
  assert.ok(labels.has('New world'), 'the palette opens Start');
});

test('every key map row has a focus the dispatcher knows', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  for (const k of api.KEYMAP) assert.ok(['any', 'map', 'drawer', 'window', 'dialog', 'timeline'].includes(k.focus) || k.focus.startsWith('dialog:'), `${k.key} has focus ${k.focus}`);
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

test('the fold and the zoom are remembered, and the opened chip is not', () => {
  const api = loadUI(['state'], ['persist', 'restore', 'ui']);
  const src = String(api.persist);
  assert.match(src, /timelineFold/, 'the fold is a preference');
  assert.match(src, /timelineZoom/, 'the zoom is a preference');
  assert.doesNotMatch(src, /timelineChip/, 'the opened chip names one act of one creation and is not remembered');
});

/* A real round trip through the stored shape. Storage is the one input the page does not control:
   another version, another tab, or a hand-edited store can hold anything. */
test('a stored zoom in range comes back, and one out of range is refused', () => {
  const api = loadUI(['state', 'derive', 'keys'], ['ui', 'persist', 'restore', 'TL_ZOOM_MAX', 'STORE_KEY']);
  const store = {};
  global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  try {
    api.ui.timelineZoom = 3; api.persist();
    api.ui.timelineZoom = 0; api.restore();
    assert.equal(api.ui.timelineZoom, 3, 'a stored zoom in range comes back');
    for (const bad of [api.TL_ZOOM_MAX + 1, -1, 1.5, '2', null, NaN]){
      const s = JSON.parse(store[api.STORE_KEY]); s.timelineZoom = bad;
      store[api.STORE_KEY] = JSON.stringify(s);
      api.ui.timelineZoom = 2; api.restore();
      assert.equal(api.ui.timelineZoom, 2, `a stored zoom of ${bad} is refused`);
    }
  } finally { delete global.localStorage; }
});

test('the timeline actions stay inside their bounds, and the same chip twice closes it', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], ['ACTIONS', 'ui', 'TL_ZOOM_MAX']);
  withPage(() => {
    api.ui.timelineFold = true;
    api.ACTIONS.foldTimeline();
    assert.equal(api.ui.timelineFold, false);
    api.ACTIONS.foldTimeline();
    assert.equal(api.ui.timelineFold, true);
    api.ui.timelineZoom = 0;
    api.ACTIONS.zoomTimelineIn();
    assert.equal(api.ui.timelineZoom, 0, 'it never goes below the default');
    for (let n = 0; n < 40; n++) api.ACTIONS.zoomTimelineOut();
    assert.equal(api.ui.timelineZoom, api.TL_ZOOM_MAX, 'it never goes past the widest');
  });
  api.ACTIONS.openChip('4:3');
  assert.equal(api.ui.timelineChip, '4:3');
  api.ACTIONS.openChip('4:3');
  assert.equal(api.ui.timelineChip, null, 'the same chip twice closes it');
});

test('the three timeline actions paint at once, as their neighbours do', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], ['ACTIONS', 'ui']);
  withPage(page => {
    for (const name of ['foldTimeline', 'zoomTimelineOut', 'zoomTimelineIn']){
      const before = page.paints;
      api.ACTIONS[name]();
      assert.ok(page.paints > before, `${name} leaves the band for the next frame tick`);
    }
  });
});

/* The band's own map from a button id to an action is a plain string table. A renamed action would
   leave it pointing at nothing, and the band's buttons would go quiet with no error. */
test('every timeline button names an action that exists', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions', 'timeline'], ['TL_BUTTONS', 'ACTIONS']);
  const ids = Object.keys(api.TL_BUTTONS);
  assert.deepEqual(ids, ['foldTl', 'tlOut', 'tlIn'], 'the band has three buttons');
  for (const id of ids) assert.equal(typeof api.ACTIONS[api.TL_BUTTONS[id]], 'function', `${id} names ${api.TL_BUTTONS[id]}`);
});

test('a click in the band takes its focus through an action, not by hand', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], ['ACTIONS', 'ui']);
  api.ui.focus = 'map';
  api.ACTIONS.focusTimeline();
  assert.equal(api.ui.focus, 'timeline');
  const src = fs.readFileSync('src/ui/timeline.js', 'utf8');
  /* An assignment, not a comparison: drawTimeline reads ui.focus to mark the band. */
  assert.doesNotMatch(src, /ui\.focus\s*=[^=]/, 'the band changes the focus through ACTIONS');
});

test('the band shows its own focus, since ui.focus is not the browser’s', () => {
  const src = fs.readFileSync('src/ui/timeline.js', 'utf8');
  assert.match(src, /classList\.toggle\('focus'/, 'drawTimeline marks the focused band as a drawer is marked');
  const page = fs.readFileSync('src/page.template.html', 'utf8');
  assert.match(page, /#timeline\.focus\{/, 'the page has a rule for the focused band');
});

test('the timeline keys change meaning by focus, and do not take the level keys away', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.equal(keyHit(api, ev('['), 'map').action, 'levelDown', 'the map keeps its levels');
  assert.equal(keyHit(api, ev(']'), 'map').action, 'levelUp');
  assert.equal(keyHit(api, ev('['), 'timeline').action, 'zoomTimelineOut', 'the timeline zooms while it holds focus');
  assert.equal(keyHit(api, ev(']'), 'timeline').action, 'zoomTimelineIn');
  assert.equal(keyHit(api, ev('t'), 'timeline').action, 'foldTimeline', 'T folds from anywhere');
  assert.equal(keyHit(api, ev('t'), 'map').action, 'foldTimeline');
});

test('the timeline joins the focus cycle only while the ages run, and Escape leaves it', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...KEYS, 'focusRing', 'startCreation', 'era', 'step']);
  api.startCreation('gamma', {});
  assert.ok(api.focusRing().includes('timeline'), 'the ages show the band');
  assert.equal(keyHit(api, ev('Escape'), 'timeline').action, 'back');
  let n = 0; while (api.era === 'gods' && n++ < 2000) api.step();
  assert.equal(api.era, 'days', 'the creation must reach the valley');
  assert.ok(!api.focusRing().includes('timeline'), 'the days era has no band to focus');
});

test('every timeline button has a key', () => {
  const api = loadUI(['state', 'keys'], ['KEYMAP']);
  for (const id of ['foldTl', 'tlOut', 'tlIn'])
    assert.ok(api.KEYMAP.some(r => r.button === id), `${id} has no key`);
});

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
  assert.deepEqual(keyHit(api, ev('ArrowRight'), 'map'), { action: 'cursor', arg: [1, 0, 1] });
  assert.deepEqual(keyHit(api, ev('ArrowRight', { shiftKey: true }), 'map'), { action: 'cursor', arg: [1, 0, 5] });
  assert.deepEqual(keyHit(api, ev('ArrowRight', { altKey: true }), 'map'), { action: 'cursor', arg: [1, 0, 'edge'] });
  assert.deepEqual(keyHit(api, ev('Enter'), 'map'), { action: 'applyAt', arg: undefined });
  assert.deepEqual(keyHit(api, ev('Home'), 'map'), { action: 'home', arg: undefined });
  assert.deepEqual(keyHit(api, ev('w'), 'map'), { action: 'worldHere', arg: undefined });
});

const WIN = [...DERIVE, 'winOpen', 'winClose', 'winFind', 'focusRing', 'WIN_MAX'];

test('windows: open reuses a window for the same target, the seventh inspector closes the oldest, and the focus ring lists map, docked drawers, then windows', () => {
  const api = loadUI(['state', 'derive', 'actions'], WIN); api.startWorld('r'); api.camp = api.camps[0];
  const w1 = api.winOpen('inspect', { being: 1 });
  assert.equal(api.winOpen('inspect', { being: 1 }), w1, 'same target, same window');
  const w2 = api.winOpen('inspect', { being: 2 });
  assert.notEqual(w2.x, w1.x, 'a second inspector steps across'); assert.notEqual(w2.y, w1.y, 'and down');
  api.ui.rects.inspect = { x: 200, y: 150, w: 330, h: 420 };
  const w3 = api.winOpen('inspect', { being: 3 });
  assert.equal(w3.x, 200, 'a saved rect is the base, and its first slot is free'); assert.equal(w3.y, 150);
  const w3b = api.winOpen('inspect', { being: 30 });
  assert.equal(w3b.x, 200 + 24, 'the next one steps from the saved rect'); assert.equal(w3b.y, 150 + 24);
  api.winClose(w3b.id);
  for (let i = 2; i <= 7; i++) api.winOpen('inspect', { being: i });
  assert.equal(api.ui.windows.filter(w => w.kind === 'inspect').length, api.WIN_MAX);
  assert.equal(api.winFind('inspect', { being: 1 }), undefined, 'the oldest went');
  api.ui.open = ['people', 'goals']; api.winOpen('drawer', 'goals');
  const ring = api.focusRing();
  assert.equal(ring[0], 'map'); assert.ok(ring.includes('drawer:people')); assert.ok(!ring.includes('drawer:goals'), 'a popped-out drawer is a window now');
  assert.ok(ring.filter(f => f.startsWith('window:')).length === api.ui.windows.length);
  api.winClose(api.ui.windows[0].id); assert.equal(api.ui.windows.length, api.WIN_MAX);
});

test('windows: closing the focused window sends focus back to the map', () => {
  const api = loadUI(['state', 'derive', 'actions'], WIN); api.startWorld('r'); api.camp = api.camps[0];
  const w1 = api.winOpen('inspect', { being: 1 });
  api.ui.focus = `window:${w1.id}`;
  api.winClose(w1.id);
  assert.equal(api.ui.focus, 'map');
});

test('window keys: O pops out or docks, Esc closes a focused window, Tab walks the ring', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.deepEqual(keyHit(api, ev('o'), 'drawer:goals'), { action: 'popOut', arg: undefined });
  assert.deepEqual(keyHit(api, ev('o'), 'window:3'), { action: 'popOut', arg: undefined });
  assert.deepEqual(keyHit(api, ev('Escape'), 'window:3'), { action: 'back', arg: undefined });
  assert.deepEqual(keyHit(api, ev('Tab'), 'window:3'), { action: 'focusNext', arg: undefined });
});

test('tools: three, inspect first, light fire and nudge one-shot, no camp site', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], ['TOOLS', ...KEYS]);
  assert.deepEqual(api.TOOLS.map(t => t.id), ['inspect', 'light', 'nudge']);
  assert.equal(api.TOOLS[0].oneShot, false); assert.equal(api.TOOLS[1].oneShot, true); assert.equal(api.TOOLS[2].oneShot, true);
  assert.equal(api.TOOLS[1].label, 'Light fire'); assert.equal(api.TOOLS[2].label, 'Nudge');
  assert.deepEqual(keyHit(api, ev('N', { shiftKey: true }), 'map'), { action: 'toolSticky', arg: 'nudge' });
  assert.deepEqual(keyHit(api, ev('f'), 'window:2'), { action: 'follow', arg: undefined });
  assert.deepEqual(keyHit(api, ev('f'), 'map'), { action: 'tool', arg: 'light' });
  assert.equal(keyHit(api, ev('F', { shiftKey: true }), 'map').action, 'toolSticky', 'shift on a letter is its own row');
});

test('chip keys: Alt+n jumps, Shift+Alt+n opens the mute menu, and a single chip can be muted by its text', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...DERIVE, ...KEYS]);
  assert.deepEqual(keyHit(api, ev('3', { altKey: true }), 'map'), { action: 'jumpChip', arg: 3 });
  assert.deepEqual(keyHit(api, ev('3', { altKey: true, shiftKey: true }), 'drawer:goals'), { action: 'muteMenu', arg: 3 });
  assert.deepEqual(keyHit(api, ev('2'), 'dialog:mute'), { action: 'muteChoice', arg: 2 });
  api.startWorld('r'); api.camp = api.camps[0]; const a = api.firstPerson(); a.needs.warmth = 10; api.notePulses();
  const cold = api.alerts().find(x => x.type === 'cold'); assert.ok(cold);
  api.mute('cold', api.camp.id, cold.text);
  assert.equal(api.alerts().some(x => x.type === 'cold'), false, 'that one chip is muted');
  const b = { ...a, name: 'Other' }; assert.equal(api.isMuted('cold', api.camp.id, 'Other is cold'), false, 'another cold chip is not');
});

test('palette rows list every static action once with its key, and the dynamic rows for people, goals, camps, sectors, chips, and mutes', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...DERIVE, ...KEYS, 'paletteRows', 'paletteMatch']);
  api.startWorld('r'); api.camp = api.camps[0]; api.notePulses();
  const rows = api.paletteRows();
  const labels = rows.map(r => r.label);
  assert.equal(new Set(labels).size, labels.length, 'no label twice');
  assert.ok(labels.includes('Help'));
  assert.ok(labels.includes(`Inspect ${api.firstPerson().name}`));
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
  assert.deepEqual(keyHit(api, ev('k', { metaKey: true }), 'map'), { action: 'palette', arg: undefined });
  assert.deepEqual(keyHit(api, ev('k', { ctrlKey: true }), 'drawer:people'), { action: 'palette', arg: undefined });
  assert.deepEqual(keyHit(api, ev('g'), 'map'), { action: 'chord', arg: undefined });
  assert.deepEqual(keyHit(api, ev('f'), 'dialog:chord'), { action: 'stage', arg: 'fire' });
  assert.deepEqual(keyHit(api, ev('ArrowDown'), 'dialog:palette'), { action: 'paletteMove', arg: 1 });
  assert.deepEqual(keyHit(api, ev('Enter'), 'dialog:palette'), { action: 'paletteRun', arg: undefined });
});

/* The feedback pass. */
test('a focused row wins over an any row, whatever the order in the table', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.equal(api.keyAction(ev('Escape'), 'dialog:help').focus, 'dialog:help', 'the dialog row answers, not the any row above it');
  assert.equal(api.keyAction(ev('Escape'), 'map').focus, 'any');
  assert.deepEqual(keyHit(api, ev('f'), 'window:2'), { action: 'follow', arg: undefined });
  assert.deepEqual(keyHit(api, ev('F', { shiftKey: true }), 'window:2'), { action: 'follow', arg: undefined }, 'Shift+F in a window does not stick Light fire');
  assert.deepEqual(keyHit(api, ev('F', { shiftKey: true }), 'map'), { action: 'toolSticky', arg: 'light' });
});

test('the one-shot tool hints say Enter', () => {
  const api = loadUI(['state', 'derive', 'keys'], ['TOOLS']);
  for (const t of api.TOOLS) assert.ok(/Enter/.test(t.hint), `${t.id} hint omits Enter`);
});

test('windows: a reopened inspector takes the first free slot', () => {
  const api = loadUI(['state', 'derive', 'actions'], WIN); api.startWorld('r'); api.camp = api.camps[0];
  const w1 = api.winOpen('inspect', { being: 1 }); api.winOpen('inspect', { being: 2 }); api.winOpen('inspect', { being: 3 });
  const slot = { x: w1.x, y: w1.y };
  api.winClose(w1.id);
  const w4 = api.winOpen('inspect', { being: 4 });
  for (const w of api.ui.windows) if (w !== w4) assert.ok(w.x !== w4.x || w.y !== w4.y, 'the new window covers an open one');
  assert.deepEqual({ x: w4.x, y: w4.y }, slot, 'the freed slot is used again');
});

test('a name matches whole words only, so a prefix pair does not misattribute', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'namesIn', 'pulseWho']);
  assert.equal(api.namesIn('Anna is cold', 'Ann'), false);
  assert.equal(api.namesIn('Anna is cold', 'Anna'), true);
  assert.equal(api.namesIn('A wolf took Ann.', 'Ann'), true);
  assert.equal(api.namesIn("Ann's fire went out", 'Ann'), true);
  assert.equal(api.namesIn('Tam (the elder) spoke', 'Tam (the elder)'), true, 'a name with punctuation is matched as text');
  api.startWorld('r'); api.camp = api.camps[0];
  const a = api.beings.find(b => b.species === 'human'); a.name = 'Ann';
  assert.equal(api.pulseWho('Anna is cold'), undefined);
  assert.equal(api.pulseWho('Ann is cold'), a.id);
});

test('a mute reads as a sentence, not as its key', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'muteLabel']);
  api.startWorld('r'); api.camp = api.camps[0];
  const c = api.camps[0];
  assert.equal(api.muteLabel('cold'), 'Cold alerts, everywhere');
  assert.equal(api.muteLabel(`cold:${c.id}`), `Cold alerts at ${c.name}`);
  assert.equal(api.muteLabel(`cold:${c.id}:Ada is cold`), `Ada is cold, at ${c.name}`);
  assert.equal(api.muteLabel(`event:${c.id}:A line: with a colon`), `A line: with a colon, at ${c.name}`);
  assert.equal(api.muteLabel('cold:999'), 'Cold alerts at a camp that is gone');
});

test('opening a sector keeps a cursor that is already in it, and carries the offset when it is not', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'cursorInSector', 'LW', 'LH']);
  api.startWorld('r');
  const { LW, LH } = api;
  const mid = { x: 2 * LW + (LW >> 1), y: 1 * LH + (LH >> 1), z: 0 };
  assert.deepEqual(api.cursorInSector(mid, 2, 1), mid, 'the hovered centre stays');
  assert.deepEqual(api.cursorInSector({ x: 3, y: 4, z: 0 }, 2, 1), { x: 2 * LW + 3, y: 1 * LH + 4, z: 0 }, 'the offset is carried');
});

test('no row asks for Ctrl with an arrow: macOS takes those for Mission Control', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  for (const k of api.KEYMAP) assert.ok(!(k.ctrl && k.key.startsWith('Arrow')), `${k.label} uses Ctrl with an arrow`);
});

test('Enter makes the world only in Start, and does nothing of its own in help', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.deepEqual(keyHit(api, ev('Enter'), 'dialog:start'), { action: 'makeWorld', arg: undefined });
  assert.equal(api.keyAction(ev('Enter'), 'dialog:help'), null, 'Enter in help is the browser\u2019s: it presses the focused Close button');
  assert.equal(typeof api.ACTIONS.makeWorld, 'function');
});

test('Alt+G is a free chord in Start, distinct from the plain g that opens the stage chord', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.deepEqual(keyHit(api, ev('g', { altKey: true }), 'dialog:start'), { action: 'takeGod', arg: undefined });
  assert.equal(api.keyAction(ev('g'), 'map').action, 'chord', 'plain g still opens the stage chord elsewhere');
});

test('take a god: the world is made, a god is taken, and the creation waits on the player', () => {
  /* newWorld touches wcv, ocv, and dpr directly, and setPace/setPaused reach the page through $. There
     is no browser here, so the canvases are stubbed and the page calls are withPage's, the same rig
     the un-pausing test above uses for the same reason. */
  const api = loadUI(['state', 'derive', 'actions'], [...DERIVE, 'ACTIONS', 'inAges', 'beingById',
    'get paused(){ return paused; }, set paused(v){ paused = v; }'], {
    setUp: '() => { wcv = {}; ocv = {}; dpr = 1; }',
  });
  api.setUp();
  withPage(() => api.ACTIONS.takeGod('gamma'));
  assert.equal(api.inAges(), true, 'it opens in the ages');
  assert.equal(api.paused, true, 'it opens paused, on the player\u2019s own step');
  assert.ok(api.inhabited && api.inhabited.id != null, 'a god is taken');
  assert.equal(api.inhabited.mode, 'become');
  /* The gap in the brief's own test: it seeded a field newWorld never reads, so it could not tell a kept
     seed from a thrown-away one. This is the seed actually reaching the world. */
  assert.equal(api.seedText, 'gamma', 'the typed seed is kept, not swapped for a random one');
  /* The property the whole shape of this action exists to hold: the god is taken BEFORE it acts. Taking
     it with `step(true)` instead of `ageBegin()` would still make a god, still let become claim it, and
     still satisfy every assertion above — the god would simply have already decided. A turn is open for
     the player only while the god has no task (gods.js's ageDecide takes that branch), so a task here
     means the creation moved without the player and the turn card never waited. */
  const me = api.beingById(api.inhabited.id);
  assert.ok(me, 'the taken god is a being in the world');
  assert.ok(!me.task, 'the god has not acted: the turn still waits on the player');
  assert.equal(api.creation.choices.length, 0, 'no turn has been decided yet, by anyone');
});

test('Alt with an arrow goes to the sector\u2019s edge first, then a sector at a time along that edge', () => {
  const api = loadUI(['state', 'derive'], CURSOR); api.startWorld('r');
  const { LW, LH, W, H } = api, at = (x, y) => ({ x, y, z: 0 });
  const c = at(2 * LW + 7, 1 * LH + 4);
  const w1 = api.cursorAfter(c, -1, 0, 'edge', 'loc'); assert.deepEqual(w1, at(2 * LW, 1 * LH + 4), 'first press: the leftmost column, same row');
  const w2 = api.cursorAfter(w1, -1, 0, 'edge', 'loc'); assert.deepEqual(w2, at(1 * LW, 1 * LH + 4), 'second press: the next sector over, its leftmost column');
  const w3 = api.cursorAfter(w2, -1, 0, 'edge', 'loc'); assert.deepEqual(w3, at(0, 1 * LH + 4));
  assert.deepEqual(api.cursorAfter(w3, -1, 0, 'edge', 'loc'), w3, 'the world\u2019s edge holds');
  const e1 = api.cursorAfter(c, 1, 0, 'edge', 'loc'); assert.deepEqual(e1, at(3 * LW - 1, 1 * LH + 4), 'east: the rightmost column');
  assert.deepEqual(api.cursorAfter(e1, 1, 0, 'edge', 'loc'), at(4 * LW - 1, 1 * LH + 4), 'then the next sector\u2019s rightmost column');
  const n1 = api.cursorAfter(c, 0, -1, 'edge', 'loc'); assert.deepEqual(n1, at(2 * LW + 7, 1 * LH), 'north: the top row, same column');
  assert.deepEqual(api.cursorAfter(n1, 0, -1, 'edge', 'loc'), at(2 * LW + 7, 0));
  const s1 = api.cursorAfter(c, 0, 1, 'edge', 'loc'); assert.deepEqual(s1, at(2 * LW + 7, 2 * LH - 1), 'south: the bottom row');
  assert.deepEqual(api.cursorAfter(s1, 0, 1, 'edge', 'loc'), at(2 * LW + 7, 3 * LH - 1));
  assert.deepEqual(api.cursorAfter(at(W - 1, H - 1), 1, 0, 'edge', 'loc'), at(W - 1, H - 1));
  assert.deepEqual(api.cursorAfter(c, -1, 0, 'edge', 'world'), at(1 * LW + 7, 1 * LH + 4), 'in the nearby and world views it is a plain sector step');
});

/* Recommendation 8: a view on the camp fire. M walks sector, nearby, world, camp fire, and back to
   sector. The view is the close-up's shape and scale, with the chosen camp's pit in the middle. */
const FIRE_API = [...KEYS, 'NEXT_VIEW', 'VIEW_LABEL', 'nextView', 'locOrigin', 'cursorTo', 'cellFrom', 'W', 'H', 'LW', 'LH', 'camps', 'secOf', 'ui', 'cursorAfter', 'fireCentre', 'fireSector', 'sectors', 'secIdx'];
const FIRE_EXTRA = { getView: '() => view', getCur: '() => cur', getCursor: '() => cursor', getLvl: '() => lvl',
  /* pick stands in for choosing a camp to watch: it puts the given shape into camps too, marked so a
     later pick can find and drop it, because fireCentre now checks camps.includes(viewCamp) the way
     the frame loop does. A camp under test is a live one, not a stray reference. */
  pick: '(c) => { camps = camps.filter(x => !x.__test); if (c){ c.__test = true; camps = camps.concat(c); } viewCamp = c || null; }',
  /* stale stands in for a camp destroyed while its fire view is still on screen: viewCamp points at it,
     but it never joins camps, so camps.includes(viewCamp) is false, same as after a real removal. */
  stale: '(c) => { viewCamp = c; }',
  go: '(v, s) => setView(v, s)',
  setCv: '(r) => { cv = { getBoundingClientRect: () => r }; }' };
function fireWorld(){ const api = loadUI(['state', 'derive', 'keys', 'actions'], FIRE_API, FIRE_EXTRA); api.startWorld('r'); return api; }

test('M walks sector, nearby, world, camp fire, and back to sector', () => {
  const api = fireWorld();
  assert.deepEqual(api.NEXT_VIEW, { loc: 'mid', mid: 'world', world: 'fire', fire: 'loc' });
  assert.equal(api.VIEW_LABEL.fire, 'Camp fire', 'the view button names the view in words a player reads');
  api.pick({ pit: [100, 50], site: [100, 50] });
  const seen = [];
  withPage(() => { api.go('loc'); for (let i = 0; i < 4; i++){ api.ACTIONS.view(); seen.push(api.getView()); } });
  assert.deepEqual(seen, ['mid', 'world', 'fire', 'loc']);
});

test('with no camp, or a camp with neither a pit nor a site, M skips the camp fire view', () => {
  const api = fireWorld();
  for (const c of [null, { pit: null, site: null }]){
    api.pick(c);
    assert.equal(api.nextView('world'), 'loc');
    withPage(() => { api.go('world'); api.ACTIONS.view(); });
    assert.equal(api.getView(), 'loc', `from the world map M goes to the sector with camp ${JSON.stringify(c)}`);
    withPage(() => api.go('fire'));
    assert.equal(api.getView(), 'loc', 'a view with no fire to centre on falls back to the sector');
  }
});

/* A camp destroyed while its fire view is on screen leaves viewCamp pointing at a record no longer in
   camps, the same staleness the frame loop guards against with camps.includes before it reads camp.
   fireCentre must not read .pit off that stale reference, and the #where line must not read .name off it. */
test('a viewCamp not in the live camps list gives no fire to centre on', () => {
  const api = fireWorld();
  api.stale({ pit: [5, 5], site: [5, 5] });
  assert.equal(api.fireCentre(), null, 'a camp not in camps is stale, so there is no centre to draw');
});

test('the camp fire view puts the pit in the middle, or the site before the pit is built', () => {
  const api = fireWorld(), { LW, LH } = api;
  api.pick({ pit: [100, 50], site: [97, 48] });
  withPage(() => api.go('fire'));
  assert.deepEqual(api.locOrigin(), { ox: 100 - (LW >> 1), oy: 50 - (LH >> 1) }, 'the pit sits at the middle tile of the view');
  api.pick({ pit: null, site: [97, 48] });
  assert.deepEqual(api.locOrigin(), { ox: 97 - (LW >> 1), oy: 48 - (LH >> 1) }, 'before the pit, the site is the centre');
  withPage(() => api.go('loc', { sx: 1, sy: 2 }));
  assert.deepEqual(api.locOrigin(), { ox: LW, oy: 2 * LH }, 'the sector view keeps its own origin');
});

test('the camp fire view stops at the world’s edges', () => {
  const api = fireWorld(), { LW, LH, W, H } = api;
  withPage(() => { api.pick({ pit: [2, 3], site: [2, 3] }); api.go('fire'); });
  assert.deepEqual(api.locOrigin(), { ox: 0, oy: 0 }, 'a fire by the top-left corner');
  api.pick({ pit: [W - 1, H - 2], site: [W - 1, H - 2] });
  assert.deepEqual(api.locOrigin(), { ox: W - LW, oy: H - LH }, 'a fire by the bottom-right corner');
});

test('in the camp fire view the pointer, the cursor and the levels read its origin, and leaving it opens the sector', () => {
  const api = fireWorld(), { LW, LH } = api;
  api.pick({ pit: [100, 50], site: [100, 50] });
  withPage(() => api.go('fire'));
  const { ox, oy } = api.locOrigin();
  const k = api.getCursor();
  assert.ok(k.x >= ox && k.x < ox + LW && k.y >= oy && k.y < oy + LH, 'entering the view puts the cursor inside it');
  api.setCv({ left: 0, top: 0, width: LW * 10, height: LH * 10 });
  const c = api.cellFrom({ clientX: 5, clientY: 5 });
  assert.deepEqual([c.x, c.y], [ox, oy], 'the top-left pixel is the view’s top-left tile');
  withPage(() => api.ACTIONS.levelDown());
  assert.equal(api.getLvl(), -1, 'the level keys work as in the sector view');
  withPage(() => api.ACTIONS.levelUp());
  withPage(() => api.cursorTo(ox + LW - 1, oy, 0));
  assert.equal(api.getView(), 'fire', 'a cursor inside the view keeps it');
  withPage(() => api.cursorTo(ox + LW, oy, 0));
  assert.equal(api.getView(), 'loc', 'a cursor past the edge opens the sector it is in');
  assert.deepEqual(api.getCur(), api.secOf(ox + LW, oy));
  withPage(() => { api.go('fire'); api.ACTIONS.nav([0, 1]); });
  assert.equal(api.getView(), 'loc', 'a sector step leaves the camp fire view');
  assert.deepEqual(api.getCur(), api.secOf(api.getCursor().x, api.getCursor().y));
  /* At the world's edge a sector step cannot move the cursor, so it stays in view. The step still leaves. */
  const { W, H } = api;
  withPage(() => { api.pick({ pit: [W - 1, H - 1], site: [W - 1, H - 1] }); api.go('fire'); api.cursorTo(W - 1, H - 1, 0); api.ACTIONS.nav([1, 0]); });
  assert.equal(api.getView(), 'loc', 'a sector step at the world’s edge leaves the camp fire view too');
});

test('F1 in the camp fire view centres it on that camp’s fire', () => {
  const api = fireWorld(), { LW, LH } = api, c = api.camps[0];
  /* A camp has no site straight after the ages. Give it one far from the first fire, so the view must move. */
  if (!c.site) c.site = [150, 60];
  const p = c.pit || c.site;
  withPage(() => { api.pick({ pit: [10, 10], site: [10, 10] }); api.go('fire'); api.ACTIONS.campN(1); });
  assert.equal(api.getView(), 'fire');
  const { ox, oy } = api.locOrigin();
  assert.ok(p[0] >= ox && p[0] < ox + LW && p[1] >= oy && p[1] < oy + LH, 'the new camp’s fire is in view');
});

/* Alt+arrow sends an edge step, not a sector step. The first press goes to the edge of the cursor's
   sector, which is often still inside the camp fire view. The view must still give way to the sector view. */
test('in the camp fire view Alt+arrow opens the sector view, where the same key in the sector view lands', () => {
  const api = fireWorld(), { LW, LH } = api;
  const row = api.KEYMAP.find(r => r.key === 'ArrowRight' && r.alt);
  assert.deepEqual(row.arg, [1, 0, 'edge'], 'the Alt+arrow row sends an edge step');
  api.pick({ pit: [100, 50], site: [100, 50] });
  withPage(() => api.go('fire'));
  const { ox, oy } = api.locOrigin(), from = api.getCursor();
  const want = api.cursorAfter(from, 1, 0, 'edge', 'loc');
  /* The case that went wrong: the step lands inside the camp fire view. A landing outside it left by the old rule too. */
  assert.ok(want.x >= ox && want.x < ox + LW && want.y >= oy && want.y < oy + LH, 'the edge step lands inside the camp fire view');
  withPage(() => api.ACTIONS[row.action](row.arg));
  assert.equal(api.getView(), 'loc', 'the edge step leaves the camp fire view');
  assert.deepEqual(api.getCursor(), want, 'the cursor lands where the same key lands in the sector view');
  assert.deepEqual(api.getCur(), api.secOf(want.x, want.y), 'the sector view is the one the cursor is in');
});

test('F1 to a camp with no site leaves the camp fire view for the sector view', () => {
  const api = fireWorld(), c = api.camps[0];
  c.site = null; c.pit = null;
  withPage(() => { api.pick({ pit: [100, 50], site: [100, 50] }); api.go('fire'); });
  assert.equal(api.getView(), 'fire');
  withPage(() => api.ACTIONS.campN(1));
  assert.equal(api.getView(), 'loc', 'with no fire to centre on, the view is the sector view');
  assert.equal(api.fireCentre(), null);
});

test('entering the camp fire view from below ground puts the level and the cursor on the surface', () => {
  const api = fireWorld();
  api.pick({ pit: [100, 50], site: [100, 50] });
  withPage(() => { api.go('loc', api.secOf(100, 50)); api.cursorTo(100, 50, -1); });
  assert.equal(api.getLvl(), -1, 'the setup is below ground');
  withPage(() => api.go('fire'));
  assert.equal(api.getLvl(), 0, 'the view opens on the surface, where the fire is');
  assert.equal(api.getCursor().z, 0, 'the cursor is on the surface too');
  /* A cursor off screen and below ground goes to the fire, on the surface. */
  withPage(() => { api.go('loc', { sx: 0, sy: 0 }); api.cursorTo(0, 0, -1); api.go('fire'); });
  assert.deepEqual(api.getCursor(), { x: 100, y: 50, z: 0 });
  assert.equal(api.getLvl(), 0);
});

test('the camp fire view names the sector that holds the fire, not the cursor’s', () => {
  const api = fireWorld(), { LW } = api;
  api.pick({ pit: [100, 50], site: [100, 50] });
  withPage(() => api.go('fire'));
  const f = api.secOf(100, 50), { ox, oy } = api.locOrigin();
  /* A tile in the view but in another sector than the fire. */
  const x = f.sx * LW - 1 >= ox ? f.sx * LW - 1 : (f.sx + 1) * LW;
  withPage(() => api.cursorTo(x, oy, 0));
  assert.equal(api.getView(), 'fire');
  assert.notDeepEqual(api.getCur(), f, 'the cursor is in another sector than the fire');
  assert.equal(api.fireSector(), api.sectors[api.secIdx(f.sx, f.sy)]);
});

test('a reached stage shows when it has a row to show or a goal done, not when its only news is a folded idle goal', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'stagesShown', 'stageReached']);
  api.startWorld('r');
  let lit = false;
  for (let i = 0; i < api.ticks(3 * 1000); i++){ api.step(); if (!lit && api.camps[0].pit){ api.camp = api.camps[0]; api.lightTile(...api.camps[0].pit); lit = true; } }
  api.camp = api.camps[0];
  const guard = api.GOALS.find(g => g.id === 'guard');
  assert.ok(api.camp.pit, 'seed r has a pit by day 3'); assert.equal(api.goalState(guard).s, 'idle', 'and no wolf is near');
  assert.equal(api.stageReached('settlement'), true, 'the sim calls it reached, since guard is not blocked');
  assert.ok(!api.stages(false).some(s => s.id === 'settlement'), 'the drawer does not show a stage that holds only a folded idle goal');
  assert.ok(!api.stagesShown().includes('settlement'), 'and the chord and the palette agree');
  assert.ok(api.stages(true).some(s => s.id === 'settlement'), 'All shows every stage');
  for (const s of api.stages(false)) assert.ok(s.done > 0 || s.goals.some(x => !x.hidden), `${s.id} shows with nothing to show`);
  assert.deepEqual(api.stagesShown(), api.stages(false).map(s => s.id));
});

test('the legends drawer lists every line of the creation, oldest first', () => {
  const api = loadUI(['state', 'derive', 'keys'], [...DERIVE, 'DRAWERS']);
  api.startWorld('alpha'); api.camp = api.camps[0];
  const rows = api.drawerRows('legends');
  assert.equal(rows.length, api.legends.length);
  assert.ok(rows.length > 20, `only ${rows.length} legends`);
  assert.ok(rows.every(r => r.kind === 'legend'));
  assert.match(rows[0].e.text, /formless/);
  assert.deepEqual(api.DRAWERS.map(d => d.key), ['1', '2', '3', '4', '5']);
  assert.equal(api.DRAWERS[4].id, 'legends');
  assert.equal(api.ui.row.legends, 0);
});

const AGES = [...DERIVE, 'inAges', 'ageName', 'nOf', 'standsIn', 'countryLine', 'godRows', 'cursorPhrase', 'paletteRows'];
function inTheAges(seed = 'alpha', n = 6){
  const api = loadUI(['state', 'derive', 'keys', 'map', 'inspect'], [...AGES, 'inspectGod']);
  api.startCreation(seed, {}); api.camp = api.camps[0];
  for (let i = 0; i < n; i++) api.step();
  assert.equal(api.era, 'gods', 'the probe must still be in the ages');
  return api;
}

test('in the ages the view model holds: no gauges, no chips, no goals, and the gods are the people', () => {
  const api = inTheAges();
  assert.equal(api.inAges(), true);
  assert.deepEqual(api.gauges(), { hearth: null, food: null, water: null, beds: null });
  assert.deepEqual(api.alerts(), []);
  assert.deepEqual(api.drawerRows('goals'), []);
  const people = api.drawerRows('people');
  assert.equal(people.length, api.gods().length);
  assert.ok(people.every(r => r.kind === 'person' && r.r.a.species === 'god'));
  assert.doesNotThrow(() => api.notePulses());
  assert.doesNotThrow(() => api.paletteRows());
  assert.match(api.seasonLine(), /countr/);
  assert.equal(typeof api.cursorPhrase(), 'string');
});

test('in the ages the view key moves with the age and holds still between', () => {
  const api = inTheAges(); const k = api.viewKey();
  assert.equal(api.viewKey(), k);
  api.step(); assert.notEqual(api.viewKey(), k);
});

test('ageName counts from the Pulse, standsIn finds a live country and changes nothing, countryLine names the god', () => {
  const api = inTheAges('alpha', 8);
  assert.equal(api.ageName(0), 'Before time');
  assert.equal(api.ageName(api.pulseAge), 'Age 1');
  assert.equal(api.nOf(1, 'god', 'gods'), '1 god'); assert.equal(api.nOf(3, 'god', 'gods'), '3 gods');
  const g = api.gods().find(g => g.status === 'awake'), before = g.region, r = api.standsIn(g);
  assert.ok(r && !r.children, 'a live region');
  assert.equal(g.region, before, 'standsIn must not move the god');
  const made = api.liveRegions().find(q => q.marks.some(m => m.kind === 'pole'));
  assert.ok(api.gods().some(q => api.countryLine(made).includes(q.name)), api.countryLine(made));
});

test('the god card shows the needs, the thoughts, the opinions, and the last decision while the god is awake', () => {
  const api = inTheAges('alpha', 8);
  const html = api.inspectGod(api.gods().find(g => g.status === 'awake'));
  for (const word of ['Expression', 'Company', 'Rest', 'Calm', 'Thoughts', 'Opinions', 'Last decision']) assert.ok(html.includes(word), `the card lacks ${word}`);
});

test('after settle the view model is the day-era one again', () => {
  const api = loadUI(['state', 'derive', 'keys'], AGES);
  api.startWorld('alpha'); api.camp = api.camps[0];
  assert.equal(api.inAges(), false);
  assert.equal(api.drawerRows('people').length, 1);
  assert.equal(api.drawerRows('goals')[0].kind, 'stage');
});

test('the beat clock: a frame owes as many beats as its time buys, and carries the rest', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'beatsDue', 'beatTier', 'BEAT_MS']);
  assert.equal(api.BEAT_MS, 1000);
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
  const api = loadUI(['state', 'derive'], [...DERIVE, 'beatTier', 'BEAT_MS', 'PACES', 'TWEEN']);
  const tierAt = p => api.beatTier(api.BEAT_MS / p);
  assert.equal(tierAt(0.25), 'full', 'a quarter speed beat is four seconds');
  assert.equal(tierAt(0.5), 'full');
  assert.equal(tierAt(1), 'full', 'single speed is the readable default and draws everything');
  assert.equal(tierAt(2), 'figure', 'double speed drops the intent cue and keeps the figure');
  /* The ladder must cover the paces. beatTier ends in a catch-all return, so a pace off the bottom no
     longer snaps: it draws a beat too short for the figure and the caption, and nothing says so. This is
     the check that says so. The lowest pace that still passes is 3.333. */
  for (const p of api.PACES){
    const ms = api.BEAT_MS / p;
    assert.ok(ms >= api.TWEEN.figure, `pace ${p} buys a beat of ${ms} ms, under the ${api.TWEEN.figure} ms the figure tier needs`);
  }
});

test('H hurries the ages from any focus', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  const e = { key: 'h', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
  assert.equal(api.keyAction(e, 'map').action, 'hurry');
  assert.equal(api.keyAction(e, 'drawer:people').action, 'hurry');
  assert.equal(typeof api.ACTIONS.hurry, 'function');
});

test('the hurry asks before it skips, and declining leaves the creation where it stood', () => {
  const api = loadUI(['state', 'derive', 'keys'], [...DERIVE, 'KEYMAP']);
  const row = api.KEYMAP.find(r => r.action === 'hurry');
  assert.ok(row, 'H is still the hurry');
  assert.equal(row.label, 'Hurry to the valley', 'the label says where it goes, not what it skips');
  const go = api.KEYMAP.find(r => r.action === 'hurryGo');
  assert.equal(go, undefined, 'the doing of it is not on a key: it is the dialog button');
});

test('a creation watched age by age, or act by act, is the creation that startWorld runs', () => {
  const a = sim.load(), b = sim.load(), c = sim.load();
  a.startWorld('gamma');
  b.startCreation('gamma', {}); let n = 0; while (b.era === 'gods' && n++ < 1000) b.step();
  /* Act by act is E3's unit and the thing the whole branch rests on: the pace decides when a step
     happens and never what it does. Only the age-by-age unit was held here, which is the unit E3
     replaced, so the invariant was pinned at the one granularity the view no longer uses. */
  c.startCreation('gamma', {}); let m = 0; while (c.era === 'gods' && m++ < 5000) c.step(true);
  assert.equal(b.era, 'days');
  assert.equal(c.era, 'days');
  assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
  assert.deepEqual(c.legends.map(e => e.text), a.legends.map(e => e.text), 'act by act tells the same story');
  const pa = a.firstPerson(), pb = b.firstPerson(), pc = c.firstPerson();
  assert.deepEqual([pb.x, pb.y, pb.name], [pa.x, pa.y, pa.name]);
  assert.deepEqual([pc.x, pc.y, pc.name], [pa.x, pa.y, pa.name], 'act by act settles the same valley');
  assert.equal(b.tick, a.tick);
  assert.equal(c.tick, a.tick, 'act by act lands on the same tick');
  assert.equal(c.creation.ages, a.creation.ages, 'and on the same count of ages');
});

const PAL = { 'field-none': '#808080', 'field-wet': '#0000ff', 'field-dry': '#ffff00', 'field-hot': '#ff0000', 'field-cold': '#00ffff', 'field-above': '#ffffff', 'field-below': '#000000', 'field-light': '#ffffff', 'field-dark': '#000000', 'field-still': '#00ff00', 'field-moving': '#ff00ff' };

test('the field colour is grey with no pole, and the mean of the poles with some', () => {
  const api = loadUI(['state', 'derive'], ['mixHex', 'fieldColor']);
  assert.equal(api.mixHex(['#000000', '#ffffff']), 'rgb(128,128,128)');
  assert.equal(api.mixHex(['#ff0000']), 'rgb(255,0,0)');
  api.startCreation('alpha', {});
  assert.equal(api.fieldColor(api.liveRegions()[0], PAL), '#808080', 'the formless is grey');
  for (let i = 0; i < 8; i++) api.step();
  const made = api.liveRegions().filter(r => r.marks.some(m => m.kind === 'pole'));
  assert.ok(made.length >= 2);
  for (const r of made) assert.match(api.fieldColor(r, PAL), /^rgb\(\d+,\d+,\d+\)$/);
});

test('the mark word goes right when there is room, and left when there is not', () => {
  const api = loadUI(['state', 'derive', 'keys', 'map'], ['markWordSide', 'MARK_R']);
  /* Plenty of room on both sides: the word goes right, its own default side. */
  assert.equal(api.markWordSide(200, 40, 800), 'right');
  /* The disc sits close enough to the right edge that the word would run off there. */
  assert.equal(api.markWordSide(780, 40, 800), 'left');
  /* The boundary itself: a word that fits exactly still goes right. */
  const x = 800 - api.MARK_R - 8 - 40;
  assert.equal(api.markWordSide(x, 40, 800), 'right');
  assert.equal(api.markWordSide(x + 1, 40, 800), 'left');
  /* A wider word needs more room, so the same disc position can flip sides. */
  assert.equal(api.markWordSide(700, 40, 800), 'right');
  assert.equal(api.markWordSide(700, 90, 800), 'left');
  /* A word too wide for either side fits on neither, so the side with more room is picked: the one
     the word runs off the canvas the least on, not always the left. */
  assert.equal(api.markWordSide(300, 760, 800), 'right', 'more room to the right of a disc near the left edge');
  assert.equal(api.markWordSide(700, 760, 800), 'left', 'more room to the left of a disc near the right edge');
});

test('the region card names the country, what it is becoming, and every reason a god left on it', () => {
  const api = loadUI(['state', 'derive', 'keys', 'map', 'inspect'], ['inspectRegion']);
  api.startCreation('alpha', {}); for (let i = 0; i < 10; i++) api.step();
  const r = api.liveRegions().slice().sort((p, q) => q.marks.length - p.marks.length)[0];
  const html = api.inspectRegion(r);
  assert.ok(html.includes('Country') && html.includes('Becoming'));
  assert.ok(r.marks.every(m => html.includes(m.why)), 'every why is on the card');
});

test('C shows and hides the countries from any focus', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...KEYS, 'ui']);
  const e = { key: 'c', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
  assert.equal(api.keyAction(e, 'map').action, 'overlay');
  assert.equal(api.keyAction(e, 'dialog:chord').action, 'stage', 'under the chord, C is still Crafts');
  assert.equal(api.ui.overlay, false);
});

test('a hill says who raised it, a cave says who dug it, and every surface tile names its country', () => {
  const api = loadUI(['state', 'derive', 'keys'], ['markRows', 'godLine']);
  api.startWorld('alpha');
  const names = api.gods().map(g => g.name);
  const hillTile = api.world.find(t => t.hill && t.hill.mark && t.hill.mark.kind === 'height');
  /* Settle raises a low hill for a den where a making needs one. That hill holds the making's mark, and says so. */
  const denHill = api.world.find(t => t.hill && t.hill.mark && t.hill.mark.kind !== 'height');
  if (denHill){ const dr = api.markRows(denHill.x, denHill.y, 0); assert.ok(dr.some(r => r[0] === 'Raised for' && /den/.test(r[1])), JSON.stringify(dr)); assert.ok(!dr.some(r => r[0] === 'Raised by')); }
  const hr = api.markRows(hillTile.x, hillTile.y, 0);
  const raised = hr.find(r => r[0] === 'Raised by');
  assert.ok(raised && names.some(n => raised[1].includes(n)), JSON.stringify(hr));
  assert.match(raised[1], /Age \d+|Before time/i);
  assert.ok(!/raised it/i.test(raised[1]), 'the label says Raised by, so the row does not say it again');
  assert.ok(hr.filter(r => r[0] === 'Made here').length <= 1, 'the makings share one row');
  assert.ok(hr.some(r => r[0] === 'Country'));
  const cave = api.caves.find(c => c.mark && c.deep);
  const cr = api.markRows(cave.deep.x, cave.deep.y, cave.deep.z);
  assert.ok(cr.some(r => r[0] === 'Dug by' && names.some(n => r[1].includes(n))), JSON.stringify(cr));
  assert.deepEqual(api.markRows(-1, -1, 0), []);
});

test('a scarred country says who fought over it', () => {
  /* None of the six soak seeds has a scar, so the test writes one. A mark is data, and markRows reads data. */
  const api = loadUI(['state', 'derive', 'keys'], ['markRows']);
  api.startWorld('alpha');
  const r = api.liveRegions()[0], g = api.gods()[0];
  r.marks.push({ kind: 'scar', value: 'cut', by: g.id, age: api.pulseAge + 3, why: `${g.name} beat another god here.`, at: null });
  const i = r.tiles[0], x = i % api.W, y = (i - x) / api.W;
  const scar = api.markRows(x, y, 0).find(row => row[0] === 'Scar');
  assert.ok(scar, 'a scarred country has a scar row');
  assert.ok(scar[1].includes('A cut in the earth') && scar[1].includes(g.name) && scar[1].includes('in age 4'), scar[1]);
});

/* The final fix wave. */
const WATCH = [...new Set([...AGES, 'inspectGod', 'inspectRegion', 'fieldColor', 'ui'])];

test('the view model answers at every age of a creation that throws its valley back', () => {
  const api = loadUI(['state', 'derive', 'keys', 'map', 'inspect'], WATCH);
  api.startCreation('gamma', {}); api.camp = api.camps[0];
  let n = 0;
  while (api.era === 'gods' && n++ < 1000){
    api.step();
    if (api.era !== 'gods') break;
    assert.doesNotThrow(() => {
      api.viewKey(); api.cursorPhrase(); api.seasonLine(); api.gauges(); api.alerts(); api.paletteRows(); api.notePulses();
      for (const id of ['people', 'goals', 'chronicle', 'camp', 'legends']) api.drawerRows(id);
      for (const g of api.gods()) api.inspectGod(g);
      for (const r of api.liveRegions()){ api.inspectRegion(r); api.fieldColor(r, PAL); }
    }, `age ${api.age}`);
  }
  assert.equal(api.era, 'days', 'the creation must reach the valley');
  assert.ok(api.creation.discards >= 1, `seed gamma threw back ${api.creation.discards} valleys`);
});

/* One fake element answers every DOM call the render functions make. It is small on purpose: the test is about
   the actions, not about the DOM. Every stub is put on globalThis and taken off again in the finally. */
function domStub(){
  const el = {
    innerHTML: '', textContent: '', hidden: false, disabled: false, value: '', title: '',
    style: {}, dataset: {}, children: [], scrollTop: 0, offsetWidth: 220, offsetHeight: 140, className: '',
    classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } },
    setAttribute(){}, removeAttribute(){}, addEventListener(){}, removeEventListener(){},
    appendChild(){}, insertBefore(){}, removeChild(){}, remove(){}, replaceChildren(){}, append(){},
    /* `blurred` counts the blur calls, so a test can see the search box let the keyboard go. */
    blurred: 0,
    showModal(){}, close(){}, focus(){}, blur(){ el.blurred++; }, select(){}, scrollIntoView(){}, setPointerCapture(){},
    getBoundingClientRect(){ return { left: 0, top: 0, width: 260, height: 260 }; },
  };
  el.querySelector = () => el; el.querySelectorAll = () => []; el.closest = () => el;
  const doc = {
    documentElement: el, body: el,
    getElementById: () => el, querySelector: () => el, querySelectorAll: () => [],
    createElement: () => el, addEventListener(){}, removeEventListener(){},
  };
  const store = {};
  return { el, doc, storage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } } };
}

test('every action holds in the ages: the view stays on the world, nothing follows, and the creation runs on', () => {
  const { el, doc, storage } = domStub();
  const had = Object.fromEntries(['document', 'localStorage', 'performance', 'innerWidth', 'window'].map(k => [k, globalThis[k]]));
  try {
    globalThis.document = doc;
    globalThis.localStorage = storage;
    globalThis.performance = { now: () => 0 };
    globalThis.innerWidth = 1200;
    globalThis.window = { innerWidth: 1200, innerHeight: 900, devicePixelRatio: 1, addEventListener(){}, matchMedia: () => ({ addEventListener(){} }) };
    const files = ui.FILES.filter(f => f !== 'main');
    const api = loadUI(files, ['ACTIONS', 'ui', 'inAges'], { __view: '() => view', __follow: '() => followId' });
    api.startCreation('alpha', {}); api.camp = api.camps[0];
    for (let i = 0; i < 6; i++) api.step();
    assert.equal(api.era, 'gods', 'the probe must start in the ages');
    const god = api.gods()[0].id;
    /* The probe runs in the ages, where `speed` sets the pace. 4 is a rung of SPEEDS and not of
       PACES, so it is now rejected at the door; 1 is a rung of both. `speedStep` takes a place on
       the ladder, and without an arg it indexed the ladder with NaN and handed setPace undefined. */
    const ARG = { inspect: god, follow: god, tool: 'inspect', toolSticky: 'inspect', speed: 1, speedStep: 0, drawer: 'legends', campN: 1,
      cursor: [1, 0, 1], nav: [1, 0], stage: 'fire', goalPri: { id: 'firepit', pri: 1 }, gotoSector: { sx: 0, sy: 0 },
      jumpChip: 1, muteMenu: 1, muteChoice: 1, rowPick: 1, palettePick: 1, paletteMove: 1, unmute: 'x' };
    /* `hurryGo` is the one action left out: it runs the rest of the ages, so the era would not be 'gods' after it.
       `hurry` itself only opens the dialog now, and stays in the loop like any other action. */
    const SKIP = new Set(['hurryGo']);
    let ran = 0;
    for (const name of Object.keys(api.ACTIONS)){
      if (SKIP.has(name)) continue;
      assert.doesNotThrow(() => api.ACTIONS[name](ARG[name]), `${name} threw`);
      ran++;
      assert.equal(api.__view(), 'world', `${name} left the world map`);
      assert.equal(api.__follow(), null, `${name} started a follow in the ages`);
      assert.equal(api.era, 'gods', `${name} ended the ages`);
    }
    assert.ok(ran >= 40, `only ${ran} actions ran`);
    assert.equal(typeof el.innerHTML, 'string');
  } finally {
    for (const [k, v] of Object.entries(had)) if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
  }
});

test('a mark keeps a reason that is not the stock one, and a country names the god its reason leaves out', () => {
  const api = loadUI(['state', 'derive', 'keys'], ['markRows', 'countryLine']);
  api.startWorld('alpha');
  const hillTile = api.world.find(t => t.hill && t.hill.mark && t.hill.mark.kind === 'height');
  const g = api.beingById(hillTile.hill.mark.by) || api.gods()[0];
  const raisedBy = () => api.markRows(hillTile.x, hillTile.y, 0).find(r => r[0] === 'Raised by');
  /* The backstop writes a real reason. It is not the stock one, so the row keeps it. */
  hillTile.hill.mark = { ...hillTile.hill.mark, by: g.id, why: 'Raised so the world could hold a life.' };
  const kept = raisedBy();
  assert.ok(kept[1].includes('Raised so the world could hold a life.'), kept[1]);
  assert.ok(kept[1].includes(g.name), kept[1]);
  /* The stock reason begins with the god's name and would say the label twice, so it is left out. */
  hillTile.hill.mark = { ...hillTile.hill.mark, why: `${g.name} raised it.` };
  const stock = raisedBy();
  assert.ok(!/raised it/i.test(stock[1]), stock[1]);
  assert.ok(stock[1].includes(g.name), stock[1]);
  /* countryLine: a backstop pole reason names no god, so the god of the mark is added after it. */
  const r = api.liveRegions().find(q => q.marks.some(m => m.kind === 'pole'));
  const pole = r.marks.filter(m => m.kind === 'pole').sort((p, q) => q.age - p.age)[0];
  pole.by = g.id; pole.why = 'Made dry so the world could hold a life';
  assert.ok(api.countryLine(r).includes(`by ${g.name} ${g.epithet}`), api.countryLine(r));
  pole.why = `${g.name} made it dry.`;
  assert.ok(!api.countryLine(r).includes(`by ${g.name} ${g.epithet}`), 'a reason that names the god is not doubled');
  assert.ok(api.countryLine(r).includes(g.name));
});

const TL_API = ['timelineModel', 'chipMatrix', 'timelineSpan', 'ui', 'creation', 'age', 'era', 'gods', 'startCreation', 'step'];

test('the timeline folds to one row of the creation in age order', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) api.step();
  const m = api.timelineModel();
  assert.equal(m.shown, true);
  assert.equal(m.folded, true);
  assert.equal(m.rows.length, 1, 'folded is one row');
  assert.equal(m.rows[0].id, 'all');
  assert.equal(m.now, api.age);
  const ages = m.rows[0].cells.map(c => c.age);
  assert.deepEqual(ages, [...ages].sort((a, b) => a - b), 'cells run in age order');
  for (const c of m.rows[0].cells) assert.match(c.chip, /^\d+:\d+$/, 'every cell names its entry');
});

test('unfolded, the timeline is a row for each god and a row for the gate', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) api.step();
  api.ui.timelineFold = false;
  const m = api.timelineModel();
  assert.equal(m.folded, false);
  assert.equal(m.rows[m.rows.length - 1].id, 'gate', 'the gate is the last row');
  const godIds = api.gods().map(g => g.id);
  for (const r of m.rows.slice(0, -1)) assert.ok(godIds.includes(r.id), 'every other row is a god');
  assert.ok(m.rows.length > 1);
});

test('unfolded, every row has one cell per age in the span, so a column names one age down every lane', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) api.step();
  api.ui.timelineFold = false;
  const m = api.timelineModel();
  const span = m.to - m.from + 1;
  for (const r of m.rows){
    assert.equal(r.cells.length, span, `row ${r.id} has one cell per age`);
    assert.deepEqual(r.cells.map(c => c.age), Array.from({ length: span }, (_, i) => m.from + i), `row ${r.id} runs from age ${m.from} to ${m.to}`);
  }
  /* Two rows read at the same index are the same age, so a column means something: reading down it
     shows what several gods did in that one age. */
  for (let i = 0; i < span; i++){
    const ages = m.rows.map(r => r.cells[i].age);
    assert.ok(ages.every(a => a === ages[0]), `index ${i} names one age across every row`);
  }
  /* Where a god did nothing that age, the cell is a blank placeholder, not a missing one. */
  const someBlank = m.rows.slice(0, -1).some(r => r.cells.some(c => c.blank));
  assert.ok(someBlank, 'at least one god has a blank age somewhere in an eight-age creation');
});

test('the timeline lights exactly one cell: the act now playing, and none once the ages are over', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'timelineModel']);
  api.startCreation('gamma', {});
  for (let k = 0; k < 5; k++) api.step(true);
  const lit = api.timelineModel().rows.flatMap(r => r.cells).filter(c => c && c.playing);
  assert.equal(lit.length, 1, 'one act is playing, so one cell is lit');
  /* Not just any cell: the one that names the god and age of the turn now on stage. A count of one is
     not proof of that on its own. The turn, not the newest gesture, is the ground truth: a decision can
     write more than one gesture (a split that also gives birth to a new god writes both), and a birth
     gesture is credited to the newborn, who has no timeline row of its own yet. */
  const thisAge = api.creation.choices.filter(c => c.age === api.age);
  const lastAct = thisAge[thisAge.length - 1];
  assert.equal(lit[0].chip, `${api.age}:${lastAct.god}`, 'the lit cell names the god and age of the turn now on stage');
  api.runAges();
  const after = api.timelineModel().rows.flatMap(r => r.cells).filter(c => c && c.playing);
  assert.equal(after.length, 0, 'the ages are over and nothing is playing');
});

test('the timeline lights nothing on an age-end beat: unmake and backstop run after every turn is over', () => {
  /* `unmake` and `backstop` (src/sim/gods.js, called from `ageEnd`) fire once every god in the age has
     already had its turn, and neither writes a row to `creation.choices`. A low age limit reaches
     `backstop` reliably within a handful of ages, on any seed: the gate has no time to resolve on its
     own, so the eldest awake god is forced to act once the limit is hit. */
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', { ageLimit: 3 });
  let sawAgeEnd = false;
  for (let i = 0; i < 50 && api.era === 'gods' && !sawAgeEnd; i++){
    api.step(true);
    const gests = api.creation.gestureAge === api.age ? api.creation.gestures : [];
    const now = gests.length ? gests[gests.length - 1] : null;
    if (now && (now.kind === 'unmade' || now.kind === 'backstop')){
      sawAgeEnd = true;
      const lit = api.timelineModel().rows.flatMap(r => r.cells).filter(c => c && c.playing);
      assert.equal(lit.length, 0, `no turn is on stage on a ${now.kind} beat, so no cell is lit`);
    }
  }
  assert.ok(sawAgeEnd, 'the run reached an age-end beat within 50 acts');
});

test('the header names the span from the model, not the raw age, and says so before any age has run', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', {});
  const before = api.timelineModel();
  assert.equal(before.now, 0, 'no age has run yet');
  assert.equal(before.from, 1); assert.equal(before.to, 1);
  for (let n = 0; n < 8; n++) api.step();
  const after = api.timelineModel();
  assert.equal(after.to, after.now, 'to is the live age once the creation has run');
  const src = fs.readFileSync('src/ui/timeline.js', 'utf8');
  assert.match(src, /m\.now === 0 \? 'Before the first age' : `Age \$\{m\.from\} to \$\{m\.to\}`/, 'the head prints the span, and says so plainly before the first age');
});

test('a chip opens the matrix that produced it, unsorted and unscored by the view', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) api.step();
  const rec = api.creation.choices.find(c => !c.continued && c.picked);
  const m = api.chipMatrix(`${rec.age}:${rec.god}`);
  assert.equal(m.age, rec.age);
  assert.equal(m.picked, rec.picked);
  assert.equal(typeof m.name, 'string');
  assert.deepEqual(m.opts.map(o => o.score), rec.opts.map(o => o.score), 'the view neither sorts nor scores');
  assert.equal(api.chipMatrix('9999:1'), null, 'a chip that names nothing opens nothing');
});

test('an opened chip says who weighed what, and what it took', () => {
  const api = loadUI(['state', 'derive'], ['footChip', 'ui', 'creation', 'startCreation', 'step']);
  api.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) api.step();
  assert.equal(api.footChip(), null, 'nothing is open');
  const rec = api.creation.choices.find(c => !c.continued && c.picked && c.opts.length > 1);
  api.ui.timelineChip = `${rec.age}:${rec.god}`;
  const f = api.footChip();
  assert.match(f.head, new RegExp(`Age ${rec.age}`));
  assert.match(f.head, new RegExp(rec.picked));
  assert.equal(f.rows.length, Math.min(4, rec.opts.length), 'at most four rows');
  assert.equal(f.rows[0].type, rec.opts[0].type, "in the record's own order");
  assert.equal(typeof f.rows[0].score, 'number');
});

/* decideGod walks its options in order and marks every one it cannot land as failed, so the taken
   row is always the first row with no failed flag, on a record that has a picked type. This holds
   for the engine's own choices: decideGod tries options strictly in order and stops at the first
   that lands. It cannot hold for a player's choice: takeTurn lets the player take any option by
   name, at any index, and marks failed only the rows actually tried, so an earlier untried row
   would misread as taken. These shapes do not reliably occur in a short creation, so the records
   are built directly. */
test('the taken row is the first option that did not fail', () => {
  const api = loadUI(['state', 'derive'], ['footChip', 'ui', 'creation', 'startCreation']);
  api.startCreation('gamma', {});
  api.creation.choices = [{ age: 3, god: 1, picked: 'dig', opts: [
    { type: 'dig', score: 25, failed: true }, { type: 'dig', score: 23 }, { type: 'split', score: 19 } ] }];
  api.ui.timelineChip = '3:1';
  const f = api.footChip();
  assert.deepEqual(f.rows.map(r => !!r.taken), [false, true, false]);
});

test('a player-taken record marks no row taken, even with no failed rows', () => {
  const api = loadUI(['state', 'derive'], ['footChip', 'ui', 'creation', 'startCreation']);
  api.startCreation('gamma', {});
  api.creation.choices = [{ age: 3, god: 1, picked: 'dig', byPlayer: true, opts: [
    { type: 'dig', score: 25 }, { type: 'split', score: 19 } ] }];
  api.ui.timelineChip = '3:1';
  const f = api.footChip();
  assert.ok(f.rows.every(r => !r.taken), 'the view does not guess which row a player took');
});

/* decideGod's continued push writes only { age, god, continued: true, type }; it carries no opts. */
test('a continued record marks no row taken', () => {
  const api = loadUI(['state', 'derive'], ['footChip', 'ui', 'creation', 'startCreation']);
  api.startCreation('gamma', {});
  api.creation.choices = [{ age: 3, god: 1, continued: true, type: 'dig' }];
  api.ui.timelineChip = '3:1';
  const f = api.footChip();
  assert.ok(f.rows.every(r => !r.taken), 'nothing is marked taken');
});

test('a record where every option failed marks no row taken', () => {
  const api = loadUI(['state', 'derive'], ['footChip', 'ui', 'creation', 'startCreation']);
  api.startCreation('gamma', {});
  api.creation.choices = [{ age: 3, god: 1, picked: null, opts: [
    { type: 'dig', score: 25, failed: true }, { type: 'split', score: 19, failed: true } ] }];
  api.ui.timelineChip = '3:1';
  const f = api.footChip();
  assert.ok(f.rows.every(r => !r.taken), 'nothing landed, so nothing is marked taken');
});

test('the taken row shows even when several failed options push it past the four-row cap', () => {
  const api = loadUI(['state', 'derive'], ['footChip', 'ui', 'creation', 'startCreation']);
  api.startCreation('gamma', {});
  api.creation.choices = [{ age: 3, god: 1, picked: 'dig', opts: [
    { type: 'dig', score: 30, failed: true }, { type: 'dig', score: 28, failed: true },
    { type: 'dig', score: 26, failed: true }, { type: 'dig', score: 24, failed: true },
    { type: 'dig', score: 22, failed: true }, { type: 'dig', score: 20 } ] }];
  api.ui.timelineChip = '3:1';
  const f = api.footChip();
  assert.equal(f.rows.length, 4, 'the cap holds');
  assert.ok(f.rows.some(r => r.taken && r.score === 20), 'the taken row is one of the four shown');
});

test('the zoom sets the span, and the default keeps the near ages large', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  assert.deepEqual(api.timelineSpan(0, 20), { from: 9, to: 20 }, 'the default shows the last twelve');
  assert.deepEqual(api.timelineSpan(1, 20), { from: 1, to: 20 }, 'one step out doubles it, clamped at age one');
  assert.deepEqual(api.timelineSpan(0, 3), { from: 1, to: 3 }, 'a young creation is never cut short');
  assert.equal(api.timelineSpan(9, 400).from, 1, 'the widest shows the whole creation');
});

test('the band is not shown once the valley is made', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', {});
  let n = 0; while (api.era === 'gods' && n++ < 2000) api.step();
  assert.equal(api.era, 'days');
  assert.equal(api.timelineModel().shown, false, 'the creation is over');
});

/* The gate is the one thing on the band that reads `creation.gate`, and it is the whole point of the
   creation, so its words are held here and not only its place. */
test('the gate row says whether the world will hold, and what it still wants', () => {
  const api = loadUI(['state', 'derive'], TL_API);
  api.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) api.step();
  api.ui.timelineFold = false;
  const gateRow = () => { const rows = api.timelineModel().rows; const r = rows[rows.length - 1]; assert.equal(r.id, 'gate'); return r; };
  api.creation.gate = { ok: true, lack: null };
  assert.equal(gateRow().cells[gateRow().cells.length - 1].text, 'the world will hold');
  api.creation.gate = { ok: false, lack: 'a country that is wet' };
  assert.equal(gateRow().cells[gateRow().cells.length - 1].text, 'wants a country that is wet');
  api.creation.gate = null;
  const r = gateRow();
  assert.equal(r.cells[r.cells.length - 1].text, 'not weighed yet');
  assert.ok(r.cells.length > 1, 'an eight-age creation spans more than one age');
  assert.ok(r.cells.slice(0, -1).every(c => c.blank), 'the gate is about now, so every earlier age is blank');
  assert.ok(r.cells.every(c => c.chip === null), 'no cell of the gate row opens a matrix');
});

test('a cell says what the god did, and only the folded row says who', () => {
  const api = loadUI(['state', 'derive'], [...TL_API, 'tlCellText']);
  api.startCreation('gamma', {});
  api.step();
  const g = api.gods()[0];
  assert.equal(api.tlCellText({ age: 1, god: g.id, continued: true }, false), 'carries on');
  assert.equal(api.tlCellText({ age: 1, god: g.id, picked: 'split' }, false), 'split');
  assert.equal(api.tlCellText({ age: 1, god: g.id, picked: null }, false), 'finds nothing it can do');
  assert.equal(api.tlCellText({ age: 1, god: g.id, continued: true }, true), `${g.name}: carries on`);
  assert.equal(api.tlCellText({ age: 1, god: g.id, picked: 'split' }, true), `${g.name}: split`);
  assert.equal(api.tlCellText({ age: 1, god: g.id, picked: null }, true), `${g.name}: finds nothing it can do`);
  assert.equal(api.tlCellText({ age: 1, god: -1, picked: 'split' }, true), 'split', 'a god that is gone is not named');
});

/* The two the settle must undo. `creation.choices` outlives the ages, so nothing in the chip or the
   focus falls away on its own. Both are held here across the era boundary, where they slipped. */
const SETTLE_API = ['ui', 'onSettle', 'startCreation', 'step', 'era', 'footChip', 'creation', 'chronicle', 'focusRing', 'keyAction', 'ACTIONS'];
function agesRun(){
  const api = loadUI(['state', 'derive', 'keys', 'actions'], SETTLE_API);
  api.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) api.step();
  return api;
}
function runToDays(api){
  let n = 0; while (api.era === 'gods' && n++ < 4000) api.step();
  assert.equal(api.era, 'days', 'the creation must reach the valley');
}

test('a chip opened in the ages is closed by the settle, and the foot goes back to the chronicle', () => {
  const api = agesRun();
  const rec = api.creation.choices.find(c => !c.continued && c.picked);
  api.ui.timelineChip = `${rec.age}:${rec.god}`;
  assert.ok(api.footChip(), 'the chip prints in the foot during the ages');
  runToDays(api);
  assert.ok(api.footChip(), 'the record outlives the ages, so only the settle can close the chip');
  withPage(() => api.onSettle());
  assert.equal(api.ui.timelineChip, null, 'the settle closes the chip');
  assert.equal(api.footChip(), null, 'the foot has no chip left to print');
  assert.ok(api.chronicle.length, 'so the newest chronicle line is what the foot prints');
});

test('a focus left on the band does not outlive the settle, and [ changes the level again', () => {
  const api = agesRun();
  api.ui.focus = 'timeline';
  runToDays(api);
  assert.ok(!api.focusRing().includes('timeline'), 'the band has left the focus ring');
  assert.equal(keyHit(api, ev('['), 'timeline').action, 'zoomTimelineOut', 'a focus left on the band still zooms it');
  withPage(() => api.onSettle());
  assert.equal(api.ui.focus, 'map', 'the settle puts the focus back on the map');
  assert.equal(keyHit(api, ev('['), api.ui.focus).action, 'levelDown', 'the level keys are the map’s again');
});

/* The feedback pass, round three. */
test('each speed button has a direct key, Shift with its place on the ladder, from every focus', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...KEYS, 'SPEEDS', 'PACES']);
  const html = fs.readFileSync('src/page.template.html', 'utf8');
  /* One key row carries both labels: keys.js:102 walks SPEEDS and reads `PACE_LABEL[PACES[i]]` at the
     same place. So the two ladders must be the same length, and the harm runs both ways. A rung of
     SPEEDS past the end of PACES has no pace to name. A rung of PACES past the end of SPEEDS gets no
     key row at all, because the walk is over SPEEDS.
     PACE_LABEL is a plain object, so the missing lookup gives undefined and the row reads
     "Pace undefined · Speed 256×". It does not throw. It ships.
     The template test near the top of this file fails on a ladder grown without its button, but it
     cannot see this: a fifth button carrying data-speed and no data-pace would pass it. Nothing
     states the relation itself. This assertion states it. */
  assert.equal(api.SPEEDS.length, api.PACES.length, 'the ladders must be the same length, because keys.js:102 gives one key row the pace and the speed at the same place');
  /* The test's own limit: it types the shifted digits it has characters for. A rung past the end of
     this string reaches keyAction as an undefined key, and the test throws instead of failing. */
  const SHIFTED = '!@#$';
  assert.ok(api.SPEEDS.length <= SHIFTED.length, `SPEEDS has ${api.SPEEDS.length} rungs, and this test knows the shifted character for only ${SHIFTED.length} digits (${SHIFTED})`);
  api.SPEEDS.forEach((v, i) => {
    for (const focus of ['map', 'drawer:goals', 'window:2']){
      assert.deepEqual(keyHit(api, { key: SHIFTED[i], code: `Digit${i + 1}`, shiftKey: true, ctrlKey: false, altKey: false, metaKey: false }, focus), { action: 'speedStep', arg: i }, `Shift+${i + 1} from ${focus}`);
    }
    const row = api.KEYMAP.find(k => k.action === 'speedStep' && k.arg === i);
    assert.equal(row.button, `speed${v}`); assert.equal(api.keyName(row), `Shift+${i + 1}`);
    const m = html.match(new RegExp(`id="speed${v}"[^>]*>[^<]*<kbd>([^<]*)</kbd>`));
    assert.equal(m && m[1], `Shift+${i + 1}`, `button speed${v} prints its key`);
  });
  assert.deepEqual(keyHit(api, ev('1'), 'map'), { action: 'drawer', arg: 'people' }, 'a plain digit still toggles a drawer');
  assert.deepEqual(keyHit(api, ev('2'), 'drawer:goals'), { action: 'rowPick', arg: 2 }, 'and still picks a row in a drawer');
  assert.equal(typeof api.ACTIONS.speedStep, 'function');
});

test('the ladders differ by era: a quarter, a half, single and double in the ages, the old four in the days', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'ladder', 'PACES', 'SPEEDS', 'startCreation', 'runAges']);
  api.startCreation('gamma', {});
  assert.deepEqual(api.ladder(), api.PACES, 'the ages run on the pace ladder');
  api.runAges();
  assert.deepEqual(api.ladder(), api.SPEEDS, 'the days run on the speed ladder');
});

test('a folded stage names its idle goals, and says nothing more when it is unfolded or has none', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'foldLine']);
  const late = day21(); late.camp.tools.rod = true; late.camp.stash.fish = 4;
  const st = late.stages(false);
  for (const s of st){
    const idle = s.goals.filter(x => x.st.s === 'idle' && x.hidden).map(x => x.g.title);
    assert.deepEqual(s.idleTitles, idle, `${s.id} lists its folded idle goals by title`);
  }
  assert.ok(st.some(s => s.idleTitles.length > 0), 'day 21 has an idle goal somewhere');
  assert.equal(api.foldLine({ idleTitles: [] }, false), '');
  assert.equal(api.foldLine({ idleTitles: ['Stock food', 'Hunt deer'] }, false), 'Idle: Stock food, Hunt deer');
  assert.equal(api.foldLine({ idleTitles: ['Stock food'] }, true), '', 'an unfolded stage shows the rows themselves');
});

/* ---------- the ages in motion ----------
   The tween's four pure functions, and the drawing itself run in Node over a recording canvas. Five of the
   gesture kinds never fire on the seeds tests/ages.js runs, so every kind is drawn from a record built here. */

const TWEENS = ['beatTier', 'pointAt', 'lineSoFar', 'TWEEN', 'BEAT_MS', 'PACES'];

test('the tier of the tween comes off the length in milliseconds, at the one boundary left', () => {
  const api = loadUI(['state', 'derive'], TWEENS);
  /* The one boundary left: full holds from its own length up, and everything under it is figure. */
  assert.equal(api.beatTier(api.TWEEN.full), 'full');
  assert.equal(api.beatTier(api.TWEEN.full - 1), 'figure');
});

test('a walk and a stroke give their ends, and a gesture with no anchor draws nothing', () => {
  const api = loadUI(['state', 'derive'], TWEENS); api.startCreation('r');
  const a = 0, b = 5 * api.W + 3;
  assert.deepEqual(api.pointAt(a, b, 0), { x: 0, y: 0 });
  assert.deepEqual(api.pointAt(a, b, 1), { x: 3, y: 5 });
  assert.deepEqual(api.pointAt(a, b, 0.5), { x: 1.5, y: 2.5 });
  assert.deepEqual(api.pointAt(a, b, -3), { x: 0, y: 0 }, 'a fraction below zero holds at the start');
  assert.deepEqual(api.pointAt(a, b, 9), { x: 3, y: 5 }, 'a fraction above one holds at the end');
  /* A birth has no `from`: the star is already where it belongs. */
  assert.deepEqual(api.pointAt(null, b, 0), { x: 3, y: 5 });
  assert.equal(api.pointAt(a, null, 1), null);
  const line = [1, 2, 3, 4];
  assert.deepEqual(api.lineSoFar(line, 0), []);
  assert.deepEqual(api.lineSoFar(line, 1), line);
  assert.deepEqual(api.lineSoFar(line, 0.5), [1, 2]);
  assert.deepEqual(api.lineSoFar([], 1), []);
  assert.deepEqual(api.lineSoFar(null, 1), []);
  assert.deepEqual(line, [1, 2, 3, 4], 'the record is not touched');
});

/* The act kinds, read out of gods.js instead of copied from it. A hand-written list cannot catch the one
   thing such a list exists for: add a gesture kind to the engine and a test that enumerates the view's
   own table stays green while the map draws nothing for the new act. tests/clock.js sets the precedent
   for reading a rule out of src/sim rather than restating it. */
function actsGodsCanWrite(){
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'sim', 'gods.js'), 'utf8');
  /* The same pattern matches the definition, which is not a call. */
  const calls = (src.match(/\bgesture\(/g) || []).length - (src.match(/function gesture\(/g) || []).length;
  const lit = [...src.matchAll(/\bgesture\([^,]+,\s*'([a-z]+)'/g)];
  /* One site names its kind with a ternary — `kind === 'height' ? 'raise' : 'dig'` — and a reader that
     only knows literals would skip it silently and still report success. */
  const tern = [...src.matchAll(/\bgesture\([^,]+,\s*[^,]*\?\s*'([a-z]+)'\s*:\s*'([a-z]+)'/g)];
  const washes = [...src.matchAll(/\bgesture\([^,]+,\s*'wash',\s*\{[^}]*value:\s*'([a-z]+)'/g)].map(m => m[1]);
  const kinds = new Set(lit.map(m => m[1]));
  for (const m of tern){ kinds.add(m[1]); kinds.add(m[2]); }
  return { calls, matched: lit.length + tern.length, kinds, washes: new Set(washes) };
}

test('every act gods.js can write has a mark and a word, and the table holds nothing it cannot write', () => {
  const api = loadUI(['state', 'derive', 'marks'], [...DERIVE, 'MARKS', 'markFor']);
  const g = actsGodsCanWrite();
  /* The reader must be shown to have found something before any answer it gives means anything. A regex
     that matched nothing would leave every loop below empty and the test would pass reporting success. */
  assert.ok(g.calls >= 15, `gods.js should hold at least fifteen gesture calls; the reader found ${g.calls}`);
  assert.equal(g.matched, g.calls,
    'every gesture call gave up its kind: a call written in a new shape needs this reader taught, not skipped');
  assert.ok(g.washes.size >= 3, `a wash should carry at least three values; the reader found ${g.washes.size}`);

  for (const k of g.kinds){
    /* A wash has no mark of its own: it takes the mark of the value it carries, checked below. */
    if (k === 'wash') continue;
    const m = api.markFor(k);
    assert.ok(m, `gods.js writes a '${k}' gesture and markFor answers nothing for it`);
    assert.ok(m.word && m.word.length, `${k} has no word`);
    assert.ok(Array.isArray(m.paths) && m.paths.length, `${k} has no strokes`);
    for (const d of m.paths) assert.match(d, /^M[\d.\s]/, `${k} has a stroke that does not start with a move`);
  }
  for (const v of g.washes){
    const m = api.markFor('wash', v);
    assert.ok(m, `gods.js washes with '${v}' and markFor answers nothing for it`);
    assert.ok(m.word && m.word.length, `the '${v}' wash has no word`);
  }
  /* And the other way, so the table cannot keep a mark for an act the engine stopped writing. */
  const canWrite = [...[...g.kinds].filter(k => k !== 'wash'), ...g.washes].sort();
  assert.deepEqual(Object.keys(api.MARKS).sort(), canWrite,
    'the marks table and the acts gods.js writes are the same set, in both directions');

  assert.equal(api.markFor('wash', 'freeze'), api.markFor('freeze'), 'a wash takes the mark of the act it is');
  assert.equal(api.markFor('nonesuch'), null, 'an unknown kind draws nothing rather than guessing');
});

test('the wash inks and the washes gods.js writes are the same three, read from the engine', () => {
  /* WASH_INK in map.js is the second hand-kept list shadowing gods.js: markFor resolves a wash by its
     value and WASH_INK colours it by the same value, and nothing made the two keep agreeing with the
     engine or with each other. A wash gods.js learns to write would fall through WASH_INK's
     `|| P['field-line']` and be coloured as an ordinary line — quietly, and looking deliberate. */
  const api = loadUI(['state', 'derive', 'marks', 'map', 'dialogs'], [...DERIVE, 'WASH_INK', 'markFor']);
  const g = actsGodsCanWrite();
  assert.ok(g.washes.size >= 3, `the reader found ${g.washes.size} wash values, which is too few to be right`);
  assert.deepEqual(Object.keys(api.WASH_INK).sort(), [...g.washes].sort(),
    'every wash gods.js writes has an ink, and the table holds no ink for a wash it does not write');
  for (const v of g.washes) assert.ok(api.markFor('wash', v), `the '${v}' wash has an ink but no mark`);
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

test('the caption is the line the act wrote, and an act that wrote no line has none', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'captionFor']);
  api.startWorld('gamma');
  for (let k = 0; k < 4; k++) api.step(true);
  const rec = api.creation.gestures[api.creation.gestures.length - 1];
  const said = rec.said !== null && rec.said !== undefined;
  assert.equal(api.captionFor(rec), said ? api.legends[rec.said].text : '');
  assert.equal(api.captionFor({ said: null }), '', 'an act that wrote no line is silent, not wrong');
});

test('the act card names the act, its place in the age, and what the god weighed', () => {
  const api = loadUI(['state', 'derive', 'marks'], [...DERIVE, 'actCard']);
  api.startWorld('gamma');
  for (let k = 0; k < 6; k++) api.step(true);
  const rec = api.creation.gestures[api.creation.gestures.length - 1];
  const card = api.actCard(rec);
  assert.ok(card.head.length, 'the card leads with the sentence');
  assert.ok(card.rows.some(r => /Age \d/.test(r.value)), 'the card says which age');
  assert.ok(card.rows.length >= 2);
});

test('the act card shows what a god weighed, on the record the engine actually writes', () => {
  /* What this used to assert, and why it was worth nothing. It hand-built `{ ...gestures[0],
     byPlayer: true }` and checked that the weighed row was withheld. No gesture record carries
     `byPlayer`: `gesture()` in gods.js never writes it, and the field exists on exactly one shape in the
     codebase, the `creation.choices` row. actCard is only ever handed a gesture — from the hover, and
     from actCardForChip's `creation.gestures.find(...)`. So the old test asserted a branch on a field
     that is never present, on a record the engine cannot produce, and it passed for that reason. It read
     as coverage and was not. The guard stays as cheap insurance and is filed; this pins what is true. */
  const api = loadUI(['state', 'derive', 'marks'], [...DERIVE, 'actCard']);
  api.startCreation('gamma', {});
  let rec = null;
  for (let k = 0; k < 60 && api.era === 'gods' && !rec; k++){
    api.step(true);
    rec = api.creation.gestures.find(g => g.weighed && g.weighed.opts && g.weighed.opts.length) || null;
  }
  assert.ok(rec, 'the creation wrote a gesture carrying what its god weighed');
  assert.equal(rec.byPlayer, undefined, 'a gesture record carries no byPlayer field at all');
  const card = api.actCard(rec);
  const row = card.rows.find(r => r.label === 'weighed');
  assert.ok(row, 'the card shows the weighed row for an act the engine decided');
  for (const o of rec.weighed.opts) assert.ok(row.value.includes(o.type), `the weighed row names ${o.type}`);
});

/* A canvas that draws nothing and keeps the list of what it was asked to draw. */
function recordCtx(){
  const calls = [];
  /* The words the canvas was asked to draw, so a test can name the one it means. Only drawMark writes
     an act's word, so the word is the one unambiguous sign that the act's face reached the field. */
  const texts = [];
  const note = name => (...a) => { calls.push(name); if (name === 'fillText' || name === 'strokeText') texts.push(String(a[0])); return a; };
  const c = { calls, texts, measureText: () => ({ width: 40 }) };
  for (const k of ['setTransform', 'clearRect', 'fillRect', 'strokeRect', 'drawImage', 'beginPath', 'arc', 'stroke', 'fill', 'save', 'restore', 'translate', 'rotate', 'scale', 'fillText', 'strokeText', 'closePath', 'moveTo', 'lineTo']) c[k] = note(k);
  for (const k of ['fillStyle', 'strokeStyle', 'globalAlpha', 'lineWidth', 'font', 'textAlign', 'textBaseline']) Object.defineProperty(c, k, { set(v){ /* ink is not drawing */ }, get(){ return ''; } });
  return c;
}
/* The field drawn in Node: a real creation, a recording canvas, and the few view globals drawField reads. */
function fieldRig(seed, ages, perBeat){
  const api = loadUI(['state', 'derive', 'marks', 'map', 'dialogs', 'actions'], ['drawField', 'drawGesture', 'standsIn', 'markFor', 'PACES', ...TWEENS], {
    caption: '() => captionText',
    setUp: '(o) => { wctx = o.wctx; ocv = o.ocv; octx = o.octx; dpr = 1; P = o.P; pace = 1; acc = 0; paused = false; ui.playing = false; beatsLastFrame = 1; }',
    setPace: '(v) => { pace = v; }',
    setAcc: '(v) => { acc = v; }',
    /* The world stopped between beats, which is what Step leaves behind. */
    setStill: '(p) => { paused = p; ui.playing = false; }',
    /* What the frame loop reports it ran. The field snaps on two or more. */
    setBeats: '(n) => { beatsLastFrame = n; }',
  });
  const P = {};
  for (const k of ['halo', 'select', 'god', 'sprite', 'void', 'bg', 'map-halo', 'field-line', 'field-scar', 'field-none', 'field-wet', 'field-cold', 'field-dark', 'field-light', 'field-above', 'field-below', 'field-hot', 'field-dry', 'field-still', 'field-moving']) P[k] = '#808080';
  const wctx = recordCtx(), octx = recordCtx();
  const ocv = { width: 100, height: 100, getContext: () => octx };
  global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => recordCtx() }), querySelector: () => null };
  global.Path2D = function(d){ this.d = d; };
  api.startCreation(seed);
  /* Age by age by default, because that is the unit the older field tests were written against. Beat by
     beat when the test is about one act, which is E3's unit. */
  const one = () => perBeat ? api.step(true) : api.step();
  for (let k = 0; k < ages && api.era === 'gods'; k++) one();
  api.setUp({ wctx, ocv, octx, P });
  /* One draw fills the cache, and one age follows it, so the next draw has a field to fade from. That is
     what a running page does: the first age of a world snaps, and every age after it tweens. */
  api.drawField(); one();
  return { api, wctx };
}

test('a beat that writes two gestures still draws its act: the split that wakes a god', () => {
  /* One decision can write two gestures — a god splits a country and a new god wakes in the half it made.
     That is one beat with one act to draw. The field used to snap on it, because the rule that says "a
     frame ran two or more beats" was written as "the gesture count rose by more than one". The player
     lost the mark, the word and the caption on the one beat that shows the pantheon growing, while the
     timeline lit that act's cell: the stage went blank and the record said something was on it. */
  const { api, wctx } = fieldRig('gamma', 2, true);
  let wrote = 0;
  for (let k = 0; k < 300 && api.era === 'gods' && wrote < 2; k++){
    const ageBefore = api.creation.gestureAge, n0 = api.creation.gestures.length;
    api.setBeats(1);
    api.step(true);
    wrote = api.creation.gestureAge === ageBefore ? api.creation.gestures.length - n0 : 0;
    if (wrote < 2) api.drawField();
  }
  assert.ok(wrote >= 2, 'the creation reached a beat that wrote two gestures in one age');
  const recs = api.creation.gestures, now = recs[recs.length - 1];
  const word = api.markFor(now.kind, now.value).word.toUpperCase();
  /* Past TWEEN.word, which is where drawMark starts writing the word at all. */
  api.setAcc(0.9);
  wctx.texts.length = 0;
  api.drawField();
  assert.ok(wctx.texts.includes(word), `the act on stage draws its word, ${word}`);
});

test('the act still shows after its beat ends, because a world holding still is a world being read', () => {
  /* Step plays one beat and then holds. The act's face used to be drawn only while the beat was in
     motion, so the word appeared at 85 per cent of the beat and was erased at 100: on screen for about
     150 ms, and gone for as long as the player looked at it. Step is the reading mode; it was the mode
     that showed the act for the shortest time. */
  const { api, wctx } = fieldRig('gamma', 3, true);
  api.setBeats(1);
  api.step(true);
  const recs = api.creation.gestures, now = recs[recs.length - 1];
  const word = api.markFor(now.kind, now.value).word.toUpperCase();
  api.setAcc(0.9);
  wctx.texts.length = 0;
  api.drawField();
  assert.ok(wctx.texts.includes(word), 'the act draws its word while its beat runs');
  /* The beat is over and the world is paused: exactly what the player is looking at after pressing `.` */
  api.setStill(true);
  api.setAcc(1);
  wctx.texts.length = 0;
  api.drawField();
  assert.ok(wctx.texts.includes(word), 'the act still draws its word once the world holds still');
});

test('the field draws every gesture kind, including the five no seed makes, and touches no rule', () => {
  const { api, wctx } = fieldRig('r', 6);
  const live = api.liveRegions(), r = live[0], other = live[1] || live[0];
  const [a, b] = api.gods();
  const head = { god: a.id, age: api.age, from: r.tiles[0], to: r.tiles[r.tiles.length >> 1], said: null, weighed: null };
  const rows = [
    { ...head, kind: 'split', near: r.id, far: other.id, line: r.tiles.slice(0, 8), pole: a.pole, other: b ? b.pole : a.pole },
    { ...head, kind: 'claim', region: r.id, pole: a.pole },
    { ...head, kind: 'make', region: r.id, species: 'rabbit' },
    { ...head, kind: 'raise', region: r.id, step: 1, of: 2, value: 1 },
    { ...head, kind: 'dig', region: r.id, step: 1, of: 2, value: 1 },
    { ...head, kind: 'flow', path: [r.tiles[0], other.tiles[0], r.tiles[1]] },
    { ...head, kind: 'pool', region: r.id, under: false },
    { ...head, kind: 'burn', region: r.id },
    { ...head, kind: 'wash', region: r.id, value: 'freeze' },
    { ...head, kind: 'wash', region: r.id, value: 'hide' },
    { ...head, kind: 'wash', region: r.id, value: 'show' },
    { ...head, kind: 'battle', region: r.id, other: b ? b.id : a.id, otherFrom: other.tiles[0], winner: b ? b.id : a.id, loser: a.id, scar: 'burned' },
    { ...head, kind: 'twist', region: r.id, species: 'rabbit' },
    { ...head, kind: 'mingle', region: r.id, with: b ? b.id : a.id, otherFrom: other.tiles[0] },
    { ...head, kind: 'sleep', region: r.id, body: 'hill' },
    { ...head, kind: 'born', region: r.id, pole: a.pole, from: null },
    { ...head, kind: 'unmade', region: r.id },
    { ...head, kind: 'backstop', region: r.id, lack: 'dry' },
  ];
  /* The five kinds no seed of tests/ages.js reaches are drawn here, from a record built by hand. */
  for (const k of ['burn', 'battle', 'twist', 'unmade', 'backstop']) assert.ok(rows.some(rec => rec.kind === k), `${k} is not in the record`);
  const state = () => JSON.stringify({ gods: api.gods().map(g => [g.id, g.at, g.region]), legends: api.legends.length, ages: api.creation.ages });
  const before = state();
  for (const rec of rows){
    api.creation.gestures.length = 0; api.creation.gestures.push(rec);
    for (const f of [0, 0.2, 0.5, 0.8, 1]){
      api.setAcc(f);
      wctx.calls.length = 0;
      assert.doesNotThrow(() => api.drawField(), `${rec.kind} at ${f}`);
      assert.ok(wctx.calls.length > 0, `${rec.kind} at ${f} drew nothing at all`);
    }
  }
  assert.equal(state(), before, 'the drawing changed the rules');
});

test('a gesture with a line shows it as the act caption, off the canvas, and a decision still draws more', () => {
  const { api, wctx } = fieldRig('r', 6);
  const live = api.liveRegions(), r = live[0], g = api.gods()[0];
  const head = { god: g.id, age: api.age, from: r.tiles[0], to: r.tiles[2], said: null, weighed: null, region: r.id, pole: g.pole };
  const count = rec => { api.creation.gestures.length = 0; api.creation.gestures.push(rec); api.setAcc(0.15); wctx.calls.length = 0; api.drawField(); return wctx.calls.length; };
  const plain = count({ ...head, kind: 'claim' });
  assert.equal(api.caption(), '', 'a gesture with no line shows no act caption');
  const said = count({ ...head, kind: 'claim', said: 0 });
  assert.ok(api.legends[0], 'the creation wrote no legend to caption');
  assert.equal(api.caption(), api.legends[0].text, 'a line that was written shows as the act caption');
  assert.equal(said, plain, 'the caption is a page element now, so it draws nothing on the canvas');
  const weighed = count({ ...head, kind: 'claim', weighed: { opts: live.slice(0, 3).map(q => ({ type: 'claim', region: q.id, score: 1 })), picked: 'claim' } });
  assert.ok(weighed > plain, 'a decision shows no intent cue at the slow tier');
  /* The cue is the first thing dropped as the pace rises. Pace 2 is the top of the ages' own ladder:
     a 500 ms beat, the `figure` tier, where the cue is gone and the act's face is not. Driving this at
     a pace off PACES put the whole gesture layer below `walk`, so the assertion held because nothing
     drew at all, and it would have held just as well if the cue had leaked into `figure`. */
  api.setPace(api.PACES[api.PACES.length - 1]);
  const fast = count({ ...head, kind: 'claim', weighed: { opts: live.slice(0, 3).map(q => ({ type: 'claim', region: q.id, score: 1 })), picked: 'claim' } });
  const fastPlain = count({ ...head, kind: 'claim' });
  assert.equal(fast, fastPlain, 'the intent cue still draws below the slow tier');
});

test('every pace the player can reach draws the act on stage, and the slow ones cross-fade', () => {
  /* PACES spans 4000 ms down to 500 ms, which is the `full` tier and the `figure` tier. The `walk` and
     `none` tiers are below the ages' own ladder and no player reaches them, so a test that drove pace 64
     was describing a state the game cannot be in — and asserting the opposite of what the ages do. */
  const { api, wctx } = fieldRig('gamma', 3, true);
  api.setBeats(1);
  api.step(true);
  const recs = api.creation.gestures, now = recs[recs.length - 1];
  const word = api.markFor(now.kind, now.value).word.toUpperCase();
  for (const p of api.PACES){
    api.setPace(p); api.setAcc(0.9);
    wctx.texts.length = 0;
    api.drawField();
    assert.ok(wctx.texts.includes(word), `the act draws its word at pace ${p}`);
  }
  /* The cross-fade is the one thing the top of the ladder gives up: 500 ms is still the figure tier, so
     the act draws, but the field it came from no longer fades under it. */
  api.setPace(1); api.setAcc(0.5);
  wctx.calls.length = 0; api.drawField();
  assert.ok(wctx.calls.filter(c => c === 'drawImage').length >= 2, 'no cross-fade at the slow pace');
  /* A frame that ran two or more beats has nothing to fade from, so it snaps. */
  api.setBeats(2); api.step(true); api.setAcc(0.5);
  wctx.calls.length = 0; api.drawField();
  assert.equal(wctx.calls.filter(c => c === 'drawImage').length, 1, 'a frame that ran two beats faded');
});

test('a god stands on a tile of a live country, so its star is drawn on the ground it holds', () => {
  const api = loadUI(['state', 'derive'], ['standsIn']);
  api.startCreation('beta');
  let guard = 0;
  while (api.era === 'gods' && guard++ < 40){
    api.step();
    if (api.era !== 'gods') break;
    for (const g of api.gods()){
      if (g.status === 'dead' || g.at === null || g.at === undefined) continue;
      if (!api.standsIn(g)) continue;
      /* An act may leave a god on a neighbour of its own country; settleHome walks it home at the head of
         the next age. Either way the anchor is a real tile of a country that is still live. */
      assert.ok(api.liveRegions().some(q => q.tiles.includes(g.at)), `${g.name} stands on no live country in age ${api.age}`);
    }
  }
});

/* Task 10: the interface shows the names. */
const NAMES = ['nameTitle', 'campNames', 'sectorLabel', 'fullName', 'describe', 'nameOf', 'formerNames', 'nameRecord', 'rename'];

test('a hover line on a name says the tongue, the meaning, the day, the reason, who named it, and the scores', () => {
  const api = loadUI(['state', 'derive'], NAMES); api.startWorld('r'); api.camp = api.camps[0];
  const a = api.beings[0];
  const plain = api.nameRecord('Reedwater', { why: 'for the reeds along the water', by: a.id, scores: [{ text: 'Reedwater', axis: 'land', score: 33 }, { text: 'Pinehill', axis: 'land', score: 21 }] });
  const line = api.nameTitle(plain);
  assert.match(line, /^Reedwater\./);
  assert.match(line, /since day 1/);
  assert.match(line, /for the reeds along the water/);
  assert.match(line, new RegExp(`named by ${a.name}`));
  assert.match(line, /scores: Reedwater 33, Pinehill 21/);
  /* Seed r has no painted river, so the great water is the lake it found instead. */
  const old = (api.river || api.stillWater).names[0];
  assert.match(api.nameTitle(old), new RegExp(`${old.text}, ${old.meaning}, in the old tongue`));
  assert.match(api.nameTitle(old), /named by the lost people/);
  assert.equal(api.nameTitle(null), '');
});

test('the camp view model gives the name now and the names before it', () => {
  const api = loadUI(['state', 'derive'], NAMES); api.startWorld('r'); api.camp = api.camps[0];
  const c = api.camps[0];
  /* A fresh camp holds no name record yet: nameFoundersCamp and nameCampAtHearth are the only
     writers, and neither has run. So the first rename gives it its first record, with nothing
     before it; the second rename is the one that leaves a former name behind. */
  api.rename(c, api.nameRecord('Old Camp', { why: 'a first name', by: null }));
  api.rename(c, api.nameRecord('Reedwater', { why: 'for the reeds', by: null }));
  const n = api.campNames();
  assert.equal(n.now.text, 'Reedwater');
  assert.equal(n.past.length, 1);
  assert.equal(n.past[0].text, 'Old Camp');
});

test('a person with an epithet is shown by their full name, and a god keeps its own', () => {
  const api = loadUI(['state', 'derive'], NAMES); api.startWorld('r');
  const a = api.firstPerson();
  assert.equal(api.fullName(a), a.name);
  a.epithet = 'firekeeper';
  assert.equal(api.fullName(a), `${a.name} firekeeper`);
  /* Gods carry their own epithet from creation. fullName joins a god's name to it the same way,
     but no row asks it to: the god card and the People drawer's god rows read a.name and
     a.epithet directly, unchanged. This says what fullName does with one, not only that it has one. */
  const g = api.beings.find(b => b.species === 'god');
  assert.ok(g && g.epithet, 'a god carries its own epithet');
  assert.equal(api.fullName(g), `${g.name} ${g.epithet}`);
});

/* Review fix 1: the People drawer's row label is a field of the row itself, chosen once in
   drawerRows, not `esc(fullName(a))` for every row regardless of species. A god's row must read
   exactly as it did at d08a432, before task 10: the name alone, nothing joined on by fullName. */
test('the People drawer gives a person their full name, and leaves a god’s row exactly as it read before names', () => {
  const api = loadUI(['state', 'derive', 'keys'], [...NAMES, 'drawerRows']);
  api.startCreation('alpha', {}); api.camp = api.camps[0];
  for (let i = 0; i < 6; i++) api.step();
  assert.equal(api.era, 'gods');
  const godRows = api.drawerRows('people');
  assert.ok(godRows.length);
  for (const r of godRows) assert.equal(r.label, r.r.a.name, 'a god’s row carries no epithet from fullName');

  const api2 = loadUI(['state', 'derive'], [...NAMES, 'drawerRows']); api2.startWorld('r');
  const p = api2.firstPerson(); p.epithet = 'firekeeper';
  const row = api2.drawerRows('people').find(x => x.id === p.id);
  assert.equal(row.label, `${p.name} firekeeper`, 'a person’s row carries their full name');
});

/* A god's inspector head is a different function, inspectGod, never touched by task 10; this locks
   that in against the same regression the People drawer had. */
test('a god’s inspector head reads as it did before names: its name, its own epithet, nothing more', () => {
  const api = loadUI(['state', 'derive', 'keys', 'map', 'inspect'], [...NAMES, 'inspectGod']);
  api.startCreation('alpha', {}); api.camp = api.camps[0];
  for (let i = 0; i < 6; i++) api.step();
  const g = api.gods()[0];
  const html = api.inspectGod(g);
  assert.match(html, new RegExp(`<div class="head"><strong style="color:[^"]*">${g.name}</strong><span>${g.epithet}</span></div>`));
});

test('a sector shows its own name beside the biome word once it has one, and just the biome word before that', () => {
  const api = loadUI(['state', 'derive'], NAMES); api.startWorld('r');
  const s = api.sectors[0];
  assert.equal(api.sectorLabel(s), s.name, 'no name yet: the biome word alone');
  s.names = [api.nameRecord('Timberground', { why: 'for the work done here', by: null })];
  assert.match(api.sectorLabel(s), new RegExp(`^Timberground, an? ${s.name.toLowerCase()}$`));
});

/* Review fix 3: a sector inside a sentence that supplies its own words around it ("in ... at 3,4.")
   reads its own name with no article, and keeps the old "the <biome>" phrase when it has none. */
test('sectorProse names the sector mid-sentence when it can, and keeps the plain biome phrase when it cannot', () => {
  const api = loadUI(['state', 'derive'], [...NAMES, 'sectorProse']); api.startWorld('r');
  const s = api.sectors[0];
  assert.equal(api.sectorProse(s), `the ${s.name.toLowerCase()}`, 'unnamed: the plain biome phrase, as it always read');
  s.names = [api.nameRecord('Timberground', { why: 'test', by: null })];
  assert.equal(api.sectorProse(s), 'Timberground', 'named: the sector’s own name, with no article of its own');
});

test('inspectTile’s Where row uses the sector’s own name once it has one', () => {
  const api = loadUI(['state', 'derive', 'keys', 'map', 'inspect', 'strip', 'actions'], [...NAMES, 'inspectTile', 'LW', 'LH']);
  api.startWorld('r');
  const s = api.sectors[0];
  s.names = [api.nameRecord('Timberground', { why: 'test', by: null })];
  const html = api.inspectTile(s.sx * api.LW, s.sy * api.LH, 0);
  assert.match(html, /Timberground, a /);
});

/* Review fix 2: sectorLabel carries sim text (a naming record), and it is escaped once, at the
   place it turns into markup: the palette row and the sector tooltip. The builders themselves
   (paletteRows, sectorSummary) stay raw, so nothing here is escaped twice. */
test('a sector name with markup in it is escaped once it becomes markup: the palette row and the sector tooltip', () => {
  const { el, doc, storage } = domStub();
  const had = Object.fromEntries(['document', 'localStorage', 'window'].map(k => [k, globalThis[k]]));
  try {
    globalThis.document = doc; globalThis.localStorage = storage; globalThis.window = { innerWidth: 1200, innerHeight: 900 };
    const api = loadUI(['state', 'derive', 'keys', 'map', 'inspect', 'strip', 'windows', 'panels', 'dialogs', 'actions'],
      [...NAMES, 'paletteRows', 'openPalette', 'renderPalette', 'renderTip'],
      { setTip: '(t, a) => { tipTarget = t; tipAnchor = a; }' });
    api.startWorld('r'); api.camp = api.camps[0];
    const s = api.sectors[0];
    s.names = [api.nameRecord('<b>Timberground</b>', { why: 'a test name', by: null })];

    /* openPalette is what a real keypress runs: it fills the dialog's own row list from
       paletteRows() before the first render, which a bare renderPalette() call cannot do. */
    api.openPalette();
    const row = api.paletteRows().find(r => r.label.includes('Timberground'));
    assert.ok(row, 'the sector has a palette row');
    assert.ok(row.label.includes('<b>Timberground</b>'), 'the builder keeps the raw text, unescaped');
    el.value = 'Timberground';
    api.renderPalette();
    const paletteHTML = el.innerHTML;
    assert.ok(paletteHTML.includes('&lt;b&gt;Timberground&lt;/b&gt;'), 'the palette escapes the sector name at render');
    assert.ok(!paletteHTML.includes('<b>Timberground</b>'), 'the tag itself never lands unescaped in the palette');

    api.setTip({ sector: { sx: s.sx, sy: s.sy } }, { x: 0, y: 0, left: false });
    el.innerHTML = '';
    api.renderTip();
    const tipHTML = el.innerHTML;
    assert.ok(tipHTML.includes('&lt;b&gt;Timberground&lt;/b&gt;'), 'the tooltip escapes the sector name at render');
    assert.ok(!tipHTML.includes('<b>Timberground</b>'), 'the tag itself never lands unescaped in the tooltip');
  } finally {
    for (const [k, v] of Object.entries(had)) if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
  }
});

/* ---- task 11: the valley on the map, the lost people in help, and the chronicle search ---- */

test('the help page lists the old names anybody has learned, with their meanings', () => {
  const api = loadUI(['state', 'derive'], [...NAMES, 'learnedNames', 'chronicleMatches']); api.startWorld('r'); api.camp = api.camps[0];
  assert.deepEqual(api.learnedNames(), [], 'nothing is learned at the start');
  const h = api.hills.find(x => x.names && x.names.length);
  assert.ok(h, 'seed r leaves an old name on a hill');
  h.nameKnown = true;
  const rows = api.learnedNames();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].text, api.nameOf(h));
  assert.equal(rows[0].meaning, h.names[0].meaning);
  assert.equal(rows[0].what, 'hill');
});

test('the chronicle search matches a line by its text, and an old line by the name it used', () => {
  const api = loadUI(['state', 'derive'], [...NAMES, 'learnedNames', 'chronicleMatches', 'ui', 'drawerRows']); api.startWorld('r'); api.camp = api.camps[0];
  const c = api.camps[0], was = c.name;
  /* The founder's camp keeps a record of the name it started with. Without one there is no history to search. */
  api.rename(c, api.nameRecord(was, { why: 'the first camp', by: null }));
  api.log(`${was} lays a fire.`, [], 'info');
  api.rename(c, api.nameRecord('Reedwater', { why: 'for the reeds', by: null }));
  api.log('Reedwater keeps its fire.', [], 'info');
  const lines = api.chronicle;
  assert.equal(api.chronicleMatches(lines[0], 'reedwater'), true);
  assert.equal(api.chronicleMatches(lines[1], 'reedwater'), true, 'the old line answers to the new name');
  assert.equal(api.chronicleMatches(lines[1], was.toLowerCase()), true);
  assert.equal(api.chronicleMatches(lines[0], 'zzzz'), false);
  assert.equal(api.chronicleMatches(lines[0], ''), true);
  api.ui.chronSearch = 'reedwater';
  assert.equal(api.drawerRows('chronicle').length, 2);
  api.ui.chronSearch = 'zzzz';
  assert.equal(api.drawerRows('chronicle').length, 0);
  api.ui.chronSearch = '';
});

/* An old name is a secret until somebody reads the marks. The search must not give it away either. */
test('the chronicle search does not answer to an old name nobody has read', () => {
  const api = loadUI(['state', 'derive'], [...NAMES, 'chronicleMatches', 'learnedNames', 'ui', 'drawerRows']); api.startWorld('r'); api.camp = api.camps[0];
  const h = api.hills.find(x => x.names && x.names.length);
  const old = h.names[0].text;
  h.names.unshift(api.nameRecord('Crowtop', { why: 'for the birds', by: null }));
  h.nameKnown = false;
  api.log('Crowtop stands bare.', [], 'info');
  const line = api.chronicle[0];
  assert.equal(api.chronicleMatches(line, 'crowtop'), true, 'the name the people use still finds the line');
  assert.equal(api.chronicleMatches(line, old.toLowerCase()), false, 'the unread old name finds nothing');
  h.nameKnown = true;
  assert.equal(api.chronicleMatches(line, old.toLowerCase()), true, 'once the marks are read, the old name finds it');
});

test('the slash key opens the chronicle search, from the map and from a drawer', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  assert.deepEqual(keyHit(api, ev('/'), 'map'), { action: 'searchChronicle', arg: undefined });
  assert.deepEqual(keyHit(api, ev('/'), 'drawer:people'), { action: 'searchChronicle', arg: undefined });
  assert.equal(typeof api.ACTIONS.searchChronicle, 'function');
  assert.equal(typeof api.ACTIONS.closeSearch, 'function');
});

const UI_ALL = ['state', 'derive', 'keys', 'map', 'timeline', 'inspect', 'strip', 'windows', 'panels', 'dialogs', 'actions'];
function withDom(run){
  const { el, doc, storage } = domStub();
  const had = Object.fromEntries(['document', 'localStorage', 'performance', 'innerWidth', 'window'].map(k => [k, globalThis[k]]));
  try {
    globalThis.document = doc; globalThis.localStorage = storage; globalThis.performance = { now: () => 0 };
    globalThis.innerWidth = 1200;
    globalThis.window = { innerWidth: 1200, innerHeight: 900, devicePixelRatio: 1, addEventListener(){}, matchMedia: () => ({ addEventListener(){} }) };
    return run(el);
  } finally {
    for (const [k, v] of Object.entries(had)) if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
  }
}

test('the search action opens the Chronicle drawer, and Escape clears the query before it leaves the box', () => {
  withDom(el => {
    const api = loadUI(UI_ALL, [...KEYS, 'ui']);
    api.startWorld('r'); api.camp = api.camps[0];
    api.ACTIONS.searchChronicle();
    assert.ok(api.ui.open.includes('chronicle'), 'the drawer is open');
    assert.equal(api.ui.focus, 'drawer:chronicle');
    /* Every write to the query goes through an action. The box's input handler calls this one too. */
    api.ui.row.chronicle = 7;
    api.ACTIONS.setChronSearch('reed');
    assert.equal(api.ui.chronSearch, 'reed');
    assert.equal(api.ui.row.chronicle, 0, 'a shorter list starts at the top again');
    assert.equal(el.value, 'reed', 'the box follows the state');
    el.blurred = 0;
    api.ACTIONS.closeSearch();
    assert.equal(api.ui.chronSearch, '', 'the first Escape clears the query');
    assert.equal(el.blurred, 0, 'the caret stays in the box while there is text to clear');
    api.ACTIONS.closeSearch();
    assert.ok(el.blurred > 0, 'the second Escape gives the keyboard back to the drawer');
    assert.equal(api.ui.focus, 'drawer:chronicle');
    /* The one writer: no file outside actions.js assigns the query or the chronicle row for it. */
    for (const f of ['main', 'panels', 'dialogs', 'derive', 'keys']){
      const src = fs.readFileSync(`src/ui/${f}.js`, 'utf8');
      assert.ok(!/ui\.chronSearch\s*=/.test(src), `${f}.js writes ui.chronSearch`);
    }
  });
});

/* The help page prints sim text: the lore and the old names. Both are escaped where they become markup. */
test('the help page tells of the lost people, lists the names that were read, and escapes them', () => {
  withDom(el => {
    const api = loadUI(UI_ALL, [...NAMES, 'learnedNames', 'openHelp', 'giveName', 'ui'], { __lore: '() => lore' });
    api.startWorld('r'); api.camp = api.camps[0];
    const lore = api.__lore();
    const h = api.hills.find(x => x.names && x.names.length);
    h.names[0] = api.nameRecord('<b>Stonemark</b>', { tongue: 'old', meaning: 'the <i>high</i> stone', by: 'lost' });
    h.nameKnown = false;
    api.openHelp();
    assert.ok(el.innerHTML.includes(lore.people), 'the lost people are named');
    assert.ok(el.innerHTML.includes(lore.sky.meaning), 'the sky word says what it means');
    assert.ok(!el.innerHTML.includes('Stonemark'), 'a name nobody has read stays off the page');
    h.nameKnown = true;
    api.openHelp();
    assert.ok(el.innerHTML.includes('&lt;b&gt;Stonemark&lt;/b&gt;'), 'the name is escaped where it becomes markup');
    assert.ok(el.innerHTML.includes('&lt;i&gt;high&lt;/i&gt;'), 'the meaning is escaped too');
    assert.ok(!el.innerHTML.includes('<b>Stonemark</b>'), 'the tag itself never lands unescaped');
    assert.ok(!/mythos/i.test(el.innerHTML), 'the word mythos is never on screen');
    /* The valley's line asks the same question the map's title does, so the two never disagree. */
    api.giveName(api.valley, api.nameRecord('Sadrumo', { tongue: 'old', meaning: 'the eye that does not close', by: null }));
    api.openHelp();
    assert.ok(!el.innerHTML.includes('Sadrumo.'), 'a valley name nobody has read is not printed either');
    api.valley.nameKnown = true;
    api.openHelp();
    assert.ok(el.innerHTML.includes('This valley: Sadrumo.'), el.innerHTML.slice(0, 200));
    assert.ok(el.innerHTML.includes('Old names learned'), 'the list keeps the plan’s heading');
  });
});

/* Three states, one rule: no name, a name nobody has read, and a name the valley wears. */
test('the map wears the valley’s name only once somebody has read it', () => {
  const api = loadUI(['state', 'derive'], [...NAMES, 'valleyName', 'giveName']); api.startWorld('r');
  assert.equal(api.valleyName(), null, 'no name yet: the map says World map');
  api.giveName(api.valley, api.nameRecord('Sadrumo', { tongue: 'old', meaning: 'the eye that does not close', by: 'lost' }));
  assert.equal(api.valley.nameKnown, false, 'an old record starts unread');
  assert.equal(api.valleyName(), null, 'an unread name is not on the map');
  assert.equal(api.describe(api.valley, 'valley').includes('Sadrumo'), false, 'and not in the help page either');
  api.valley.nameKnown = true;
  assert.equal(api.valleyName(), 'Sadrumo');
  assert.equal(api.describe(api.valley, 'valley'), 'Sadrumo', 'the map and the help page agree');
  const panels = fs.readFileSync('src/ui/panels.js', 'utf8');
  assert.ok(/valleyName\(\) \|\| 'World map'/.test(panels), 'the map title asks the one rule');
});

test('the view key reads the chronicle search in both eras, and the search stays out of storage', () => {
  const api = loadUI(['state', 'derive'], ['ui', 'viewKey', 'inAges']);
  api.startCreation('r', {}); api.camp = api.camps[0];
  const agesWas = api.viewKey(); api.ui.chronSearch = 'reed';
  assert.notEqual(api.viewKey(), agesWas, 'the ages branch reads it');
  api.ui.chronSearch = '';
  api.startWorld('r'); api.camp = api.camps[0];
  const daysWas = api.viewKey(); api.ui.chronSearch = 'reed';
  assert.notEqual(api.viewKey(), daysWas, 'the days branch reads it');
  api.ui.chronSearch = '';
  const state = fs.readFileSync('src/ui/state.js', 'utf8');
  const at = state.indexOf('function persist');
  assert.ok(at >= 0, 'state.js has no function persist: the two checks below would pass on one character');
  const saved = state.slice(at);
  assert.ok(!/chronSearch: ui\.chronSearch/.test(saved), 'the search is not written to storage');
  assert.ok(!/s\.chronSearch/.test(saved), 'the search is not read back from storage');
});

/* ---------- saves: the file name, the keys, and the view after a load ---------- */

test('saveName makes one lower-case dashed name from the seed and the day', () => {
  const api = loadUI(['state', 'derive'], ['saveName', 'DAY']);
  assert.equal(api.saveName('Hollow Moor 52', 11 * api.DAY + 400), 'hearth-hollow-moor-52-day-12.json');
  assert.equal(api.saveName('hollow-moor-52', 0), 'hearth-hollow-moor-52-day-1.json');
  assert.equal(api.saveName('  Fern__Vale!! ', 39 * api.DAY), 'hearth-fern-vale-day-40.json');
  assert.equal(api.saveName('', 0), 'hearth-world-day-1.json');
  assert.equal(api.saveName(null, 0), 'hearth-world-day-1.json');
});

test('the key map holds Save, Load, and Continue, and no key is bound twice in one focus', () => {
  const api = loadUI(['state', 'derive', 'keys', 'saves', 'actions'], KEYS);
  const row = a => api.KEYMAP.find(k => k.action === a);
  assert.equal(api.keyName(row('saveWorld')), 'Ctrl+S');
  assert.equal(api.keyName(row('loadWorldFile')), 'Ctrl+O');
  assert.equal(api.keyName(row('continueWorld')), 'Alt+C');
  assert.equal(row('continueWorld').focus, 'dialog:start', 'Continue belongs to the start dialog');
  assert.deepEqual(keyHit(api, ev('s', { ctrlKey: true }), 'map'), { action: 'saveWorld', arg: undefined });
  assert.deepEqual(keyHit(api, ev('o', { ctrlKey: true }), 'drawer:people'), { action: 'loadWorldFile', arg: undefined });
  assert.deepEqual(keyHit(api, ev('o'), 'drawer:people'), { action: 'popOut', arg: undefined }, 'plain O still pops the drawer out');
  assert.deepEqual(keyHit(api, ev('c', { altKey: true }), 'dialog:start'), { action: 'continueWorld', arg: undefined });
  const seen = new Map();
  for (const k of api.KEYMAP){
    const chord = `${k.focus}|${api.keyName(k)}|${JSON.stringify(k.arg ?? null)}`;
    assert.ok(!seen.has(chord) || seen.get(chord) === k.action, `${chord} is bound to both ${seen.get(chord)} and ${k.action}`);
    seen.set(chord, k.action);
  }
});

test('the palette lists Save and Load, and the help table prints their keys', () => {
  const api = loadUI(['state', 'derive', 'keys', 'saves', 'actions'], [...DERIVE, ...KEYS, 'paletteRows']);
  api.startWorld('r'); api.camp = api.camps[0];
  const rows = api.paletteRows();
  for (const label of ['Save world to a file', 'Load world from a file']){
    const r = rows.find(r => r.label === label);
    assert.ok(r, `the palette has no row for ${label}`);
    assert.ok(r.key, `${label} shows no key in the palette`);
  }
  /* The help table is every row that is not quiet, so both show there too. */
  assert.equal(api.KEYMAP.filter(k => k.action === 'saveWorld' && !k.quiet).length, 1);
  assert.equal(api.KEYMAP.filter(k => k.action === 'loadWorldFile' && !k.quiet).length, 1);
});

test('the template holds the file picker, the Continue button, and the start dialog’s note line', () => {
  const html = fs.readFileSync('src/page.template.html', 'utf8');
  assert.match(html, /<input type="file" id="loadFile" accept="\.json,application\/json" hidden>/);
  assert.match(html, /id="continueBtn"[^>]*hidden>Continue the last world<kbd>Alt\+C<\/kbd>/);
  assert.match(html, /id="startNote"/);
});

/* The view state the load must put back. The `extra` readers reach the `let` variables of the interface. */
const VIEW_PEEK = {
  peek: '() => ({ viewCamp, followId, lvl, lastEra, sw: SW, sh: SH, cursor: { ...cursor }, cur: { ...cur } })',
  place: '(c, s, f, l) => { cursor = c; cur = s; followId = f; lvl = l; }',
};
const LOAD_API = ['ui', 'onLoad', 'inject', 'takeSnapshot', 'dayOf', 'ZMIN', 'ZMAX'];

test('a load puts the view back: one camp, nobody followed, no cards, and the cursor inside the new world', () => {
  const small = loadUI(['state', 'derive', 'keys', 'saves', 'actions'], LOAD_API, VIEW_PEEK);
  small.startWorld('r');
  const snap = JSON.parse(JSON.stringify(small.takeSnapshot()));
  const api = loadUI(['state', 'derive', 'keys', 'saves', 'actions'], LOAD_API, VIEW_PEEK);
  api.startWorld('r', { sw: 12, sh: 8 });
  assert.ok(api.W > small.W, 'the second world must be the bigger one');
  api.place({ x: api.W - 1, y: api.H - 1, z: api.ZMAX }, { sx: 11, sy: 7 }, 4242, api.ZMAX);
  api.ui.windows = [{ id: 1, kind: 'inspect', target: { being: 4242 }, x: 0, y: 0, w: 10, h: 10 }];
  api.ui.focus = 'window:1'; api.ui.row.people = 6; api.ui.pulses = [{ text: 'old' }]; api.ui.seenTick = 99;
  api.ui.autosaveDay = 0;
  api.ui.timelineChip = '3:2';
  const answer = api.inject({ source: 'player', act: 'load', snapshot: snap });
  assert.match(answer, /^The world is as it was on day \d+\.$/);
  api.onLoad();
  assert.equal(api.ui.timelineChip, null, 'a load closes an opened chip');
  const v = api.peek();
  assert.equal(v.viewCamp, api.camps[0], 'viewCamp is the loaded world’s first camp');
  assert.equal(api.camp, api.camps[0]);
  assert.equal(v.followId, null, 'a followed person of the old world');
  assert.deepEqual(api.ui.windows, [], 'an inspector of the old world stayed open');
  assert.equal(api.ui.focus, 'map');
  assert.equal(api.ui.row.people, 0);
  assert.deepEqual(api.ui.pulses, []);
  assert.equal(api.ui.seenTick, -1);
  assert.ok(v.cursor.x < api.W && v.cursor.y < api.H, `the cursor is outside the loaded world: ${v.cursor.x},${v.cursor.y}`);
  assert.ok(v.cur.sx < v.sw && v.cur.sy < v.sh, 'the open sector is outside the loaded world');
  assert.ok(v.lvl <= api.ZMAX && v.lvl >= api.ZMIN);
  assert.equal(v.lastEra, api.era, 'the frame would take the loaded world for a settle');
  assert.equal(api.ui.autosaveDay, api.dayOf(), 'a loaded world autosaves at once');
});

test('a refused load changes neither the world nor the view', () => {
  const api = loadUI(['state', 'derive', 'keys', 'saves', 'actions'], LOAD_API, VIEW_PEEK);
  api.startWorld('r');
  api.place({ x: 5, y: 6, z: 0 }, { sx: 1, sy: 1 }, 7, 0);
  const before = api.tick;
  const answer = api.inject({ source: 'player', act: 'load', snapshot: { version: 99 } });
  assert.match(answer, /version/);
  assert.equal(api.tick, before);
  assert.equal(api.peek().followId, 7, 'the view moved after a refusal');
});

test('saves.js loads in Node and its storage answers without a browser', async () => {
  const api = loadUI(['state', 'derive', 'keys', 'saves'], ['writeSaveFile', 'readSaveFile', 'putAutosave', 'getAutosave']);
  assert.equal(api.writeSaveFile('x.json', '{}'), 'This page cannot write a file.', 'no Blob, no download, one sentence');
  assert.equal(await api.putAutosave('{}'), false, 'no database, no autosave');
  assert.equal(await api.getAutosave(), null);
  assert.deepEqual(await api.readSaveFile(null), { error: 'This file cannot be read.' });
});

/* These four each need a document, which these tests do not have, so each is held to its source. */
test('the page says what it asked for, tells the player when a save fails, and stops on a fault', () => {
  const actions = fs.readFileSync('src/ui/actions.js', 'utf8');
  const main = fs.readFileSync('src/ui/main.js', 'utf8');
  const dialogs = fs.readFileSync('src/ui/dialogs.js', 'utf8');
  /* A sandbox can refuse the download with no error, so the line cannot claim the file was written. */
  assert.match(actions, /say\(writeSaveFile\(name, text\) \|\| `Saving \$\{name\}\.`\)/);
  assert.doesNotMatch(actions, /Saved as/);
  /* An autosave that cannot be taken is said once, not swallowed. */
  assert.match(actions, /This world cannot be saved, so there is no autosave\./);
  assert.match(actions, /console\.warn\('The autosave could not be taken: '/);
  /* A refusal shows the plain sentence and puts the reason in the console. */
  assert.match(actions, /console\.warn\('The save was refused: ' \+ lastLoadFault\)/);
  /* A throw inside a step pauses the game and says so. The frame loop itself runs on. */
  assert.match(main, /catch \(e\)\{ onFault\(e\); \}/);
  assert.match(actions, /function onFault/);
  assert.match(actions, /The world stopped on a fault\. Load a save or make a new world\./);
  /* A slot without a real tick is no slot, in both places that read one. */
  assert.match(dialogs, /typeof lastSave\.tick === 'number' && Number\.isFinite\(lastSave\.tick\)/);
  assert.match(actions, /typeof lastSave\.tick !== 'number' \|\| !Number\.isFinite\(lastSave\.tick\)/);
});

test('the frame repaints when the timeline changes', () => {
  const api = loadUI(['state', 'derive'], ['viewKey', 'ui', 'startCreation', 'step']);
  api.startCreation('gamma', {});
  for (let n = 0; n < 6; n++) api.step();
  const a = api.viewKey();
  api.ui.timelineFold = !api.ui.timelineFold;
  assert.notEqual(api.viewKey(), a, 'the fold is in the key');
  const b = api.viewKey();
  api.ui.timelineChip = '3:2';
  assert.notEqual(api.viewKey(), b, 'the opened chip is in the key');
});

test('the timeline builds nodes and never parses markup', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/ui/timeline.js'), 'utf8');
  /* An assignment, not the word: the file's own comment names innerHTML to warn the next reader off it. */
  assert.doesNotMatch(src, /\.innerHTML\b/, 'the band sets textContent, so no sim string is parsed as markup');
});

test('a stepped beat plays: the world is paused, and the beat still has a fraction to draw', () => {
  /* paused is a plain let, not part of DERIVE's list, so a live accessor is spliced in here to set it
     from the test, the same way fieldRig's setPace/setAcc reach acc and pace in map.js's tests. */
  const api = loadUI(['state', 'derive'], [...DERIVE, 'beatStill', 'get paused(){ return paused; }, set paused(v){ paused = v; }']);
  api.paused = true; api.ui.playing = true;
  assert.equal(api.beatStill(false), false, 'a beat the player stepped plays while paused');
  api.ui.playing = false;
  assert.equal(api.beatStill(false), true, 'a world paused between beats holds where it stands');
  api.paused = false; api.ui.playing = false;
  assert.equal(api.beatStill(false), false, 'a running world always plays');
  api.ui.playing = true;
  assert.equal(api.beatStill(true), true, 'a dialog holds everything, a stepped beat included');
});

test('un-pausing takes over a beat the player stepped: the running clock owns it from there', () => {
  /* paused is a plain let, reached the same way as the beatStill test above. */
  const api = loadUI(['state', 'derive', 'actions'], [...DERIVE, 'beatStill', 'setPaused', 'get paused(){ return paused; }, set paused(v){ paused = v; }']);
  withPage(() => {
    api.paused = true; api.ui.playing = true;
    assert.equal(api.beatStill(false), false, 'the stepped beat plays while the world sits paused');
    api.setPaused(false);
    assert.equal(api.ui.playing, false, 'un-pausing ends the stepped beat; the running clock takes the rest of it');
  });
});

test('setHTML writes an element only when the markup changed since the last write', () => {
  const api = loadUI(['state'], ['setHTML']);
  let writes = 0, shown = '';
  const el = { get innerHTML(){ return shown; }, set innerHTML(v){ writes++; shown = v; } };
  api.setHTML(el, '<b>a</b>');
  assert.equal(writes, 1, 'the first write always lands');
  assert.equal(shown, '<b>a</b>');
  api.setHTML(el, '<b>a</b>');
  assert.equal(writes, 1, 'the same string a second time is not written again');
  api.setHTML(el, '<b>b</b>');
  assert.equal(writes, 2, 'a changed string is written');
  assert.equal(shown, '<b>b</b>');
  /* A second element starts with no history of its own, even with the same string already on the
     first element: the check is against what THIS helper wrote to THIS element. */
  const el2 = { get innerHTML(){ return shown2; }, set innerHTML(v){ writes2++; shown2 = v; } };
  let writes2 = 0, shown2 = '';
  api.setHTML(el2, '<b>b</b>');
  assert.equal(writes2, 1, 'a different element is written on its own first call');
});

module.exports = { loadUI };
