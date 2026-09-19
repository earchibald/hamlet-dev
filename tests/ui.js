// The interface, the parts that run without a browser. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* Join the sim and the pure UI files in one scope, as the page does, and return the names the tests reach into.
   `extra` maps a key to an expression, so a test can read a `let` variable through a small reader function. */
function loadUI(files, names, extra = {}){
  const more = Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join(', ');
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',' + (more ? ' ' + more + ',' : ''));
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
  const who = api.campHumans()[0];
  api.tick = api.tick + 1; /* notePulses reads lines newer than the tick it last saw */
  api.log(`${who.name} finds a fine flat stone.`, [], 'major'); api.notePulses();
  const chip = api.alerts().find(x => x.type === 'event' && x.text.includes(who.name));
  assert.ok(chip, 'the named line is a chip'); assert.equal(chip.being, who.id, 'the chip knows its cause');
  api.tick = api.tick + 1600; api.notePulses();
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

test('the timeline actions stay inside their bounds, and the same chip twice closes it', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], ['ACTIONS', 'ui', 'TL_ZOOM_MAX']);
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
  api.ACTIONS.openChip('4:3');
  assert.equal(api.ui.timelineChip, '4:3');
  api.ACTIONS.openChip('4:3');
  assert.equal(api.ui.timelineChip, null, 'the same chip twice closes it');
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
  const api = loadUI(['state', 'derive'], WIN); api.startWorld('r'); api.camp = api.camps[0];
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
  const api = loadUI(['state', 'derive'], WIN); api.startWorld('r'); api.camp = api.camps[0];
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

test('a reached stage shows when it has a row to show or a goal done, not when its only news is a folded idle goal', () => {
  const api = loadUI(['state', 'derive'], [...DERIVE, 'stagesShown', 'stageReached']);
  api.startWorld('r');
  let lit = false;
  for (let i = 0; i < 3 * 1000; i++){ api.step(); if (!lit && api.camps[0].pit){ api.camp = api.camps[0]; api.lightTile(...api.camps[0].pit); lit = true; } }
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

test('ages come due one in two seconds at pace 1, and never more than eight in a frame', () => {
  const api = loadUI(['state', 'derive'], ['agesDue', 'AGE_MS']);
  assert.equal(api.AGE_MS, 2000);
  assert.deepEqual(api.agesDue(0, 1000, 1), { n: 0, acc: 0.5 });
  assert.deepEqual(api.agesDue(0.5, 1000, 1), { n: 1, acc: 0 });
  assert.deepEqual(api.agesDue(0, 250, 16), { n: 2, acc: 0 });
  assert.deepEqual(api.agesDue(0, 250, 1000), { n: 8, acc: 0 });
});

test('H hurries the ages from any focus', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  const e = { key: 'h', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
  assert.equal(api.keyAction(e, 'map').action, 'hurry');
  assert.equal(api.keyAction(e, 'drawer:people').action, 'hurry');
  assert.equal(typeof api.ACTIONS.hurry, 'function');
});

test('a creation watched age by age is the creation that startWorld runs', () => {
  const a = sim.load(), b = sim.load();
  a.startWorld('gamma');
  b.startCreation('gamma', {}); let n = 0; while (b.era === 'gods' && n++ < 1000) b.step();
  assert.equal(b.era, 'days');
  assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
  const pa = a.firstPerson(), pb = b.firstPerson();
  assert.deepEqual([pb.x, pb.y, pb.name], [pa.x, pa.y, pa.name]);
  assert.equal(b.tick, a.tick);
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
    showModal(){}, close(){}, focus(){}, select(){}, scrollIntoView(){}, setPointerCapture(){},
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
    const ARG = { inspect: god, follow: god, tool: 'inspect', toolSticky: 'inspect', speed: 4, drawer: 'legends', campN: 1,
      cursor: [1, 0, 1], nav: [1, 0], stage: 'fire', goalPri: { id: 'firepit', pri: 1 }, gotoSector: { sx: 0, sy: 0 },
      jumpChip: 1, muteMenu: 1, muteChoice: 1, rowPick: 1, palettePick: 1, paletteMove: 1, unmute: 'x' };
    /* `hurry` is the one action left out: it runs the rest of the ages, so the era would not be 'gods' after it. */
    const SKIP = new Set(['hurry']);
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

/* The feedback pass, round three. */
test('each speed button has a direct key, Shift with its place on the ladder, from every focus', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], [...KEYS, 'SPEEDS']);
  assert.deepEqual(api.SPEEDS, [1, 4, 16, 64]);
  const html = fs.readFileSync('src/page.template.html', 'utf8');
  api.SPEEDS.forEach((v, i) => {
    for (const focus of ['map', 'drawer:goals', 'window:2']){
      assert.deepEqual(keyHit(api, { key: '!@#$'[i], code: `Digit${i + 1}`, shiftKey: true, ctrlKey: false, altKey: false, metaKey: false }, focus), { action: 'speedStep', arg: i }, `Shift+${i + 1} from ${focus}`);
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

const TWEENS = ['tweenTier', 'gestureSlice', 'pointAt', 'lineSoFar', 'TWEEN', 'AGE_MS', 'SPEEDS'];

test('the tiers of the tween come off the length in milliseconds, in order down the pace ladder', () => {
  const api = loadUI(['state', 'derive'], TWEENS);
  assert.deepEqual(api.SPEEDS.map(p => api.tweenTier(api.AGE_MS / p)), ['full', 'figure', 'walk', 'none']);
  /* Each tier holds from its own length up to the next. */
  assert.equal(api.tweenTier(api.TWEEN.full), 'full');
  assert.equal(api.tweenTier(api.TWEEN.full - 1), 'figure');
  assert.equal(api.tweenTier(api.TWEEN.figure), 'figure');
  assert.equal(api.tweenTier(api.TWEEN.figure - 1), 'walk');
  assert.equal(api.tweenTier(api.TWEEN.walk), 'walk');
  assert.equal(api.tweenTier(api.TWEEN.walk - 1), 'none');
  assert.equal(api.tweenTier(0), 'none');
});

test('every gesture of an age has a slice inside the tween, and every slice ends with it', () => {
  const api = loadUI(['state', 'derive'], TWEENS);
  for (const n of [1, 2, 3, 7, 10]){
    for (let i = 0; i < n; i++){
      assert.equal(api.gestureSlice(i, n, 0), 0, `gesture ${i} of ${n} has run before the tween began`);
      assert.equal(api.gestureSlice(i, n, 1), 1, `gesture ${i} of ${n} does not finish with the tween`);
      for (const f of [-1, 0.1, 0.25, 0.5, 0.9, 2]){
        const s = api.gestureSlice(i, n, f);
        assert.ok(s >= 0 && s <= 1, `slice ${s} of gesture ${i} of ${n} at ${f} is outside the tween`);
      }
    }
    /* The starts are staggered, in the order the gods acted, over no more than a third of the tween. */
    const run = [];
    for (let i = 0; i < n; i++) run.push(api.gestureSlice(i, n, 0.5));
    for (let i = 1; i < n; i++) assert.ok(run[i] < run[i - 1], `gesture ${i} of ${n} does not follow the one before it`);
    assert.ok(api.gestureSlice(n - 1, n, api.TWEEN.stagger) >= 0, 'the last gesture has started by the end of the stagger');
  }
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

/* A canvas that draws nothing and keeps the list of what it was asked to draw. */
function recordCtx(){
  const calls = [];
  const note = name => (...a) => { calls.push(name); return a; };
  const c = { calls, measureText: () => ({ width: 40 }) };
  for (const k of ['setTransform', 'clearRect', 'fillRect', 'strokeRect', 'drawImage', 'beginPath', 'arc', 'stroke', 'fill', 'save', 'restore', 'translate', 'rotate', 'fillText', 'strokeText', 'closePath', 'moveTo', 'lineTo']) c[k] = note(k);
  for (const k of ['fillStyle', 'strokeStyle', 'globalAlpha', 'lineWidth', 'font', 'textAlign', 'textBaseline']) Object.defineProperty(c, k, { set(v){ /* ink is not drawing */ }, get(){ return ''; } });
  return c;
}
/* The field drawn in Node: a real creation, a recording canvas, and the few view globals drawField reads. */
function fieldRig(seed, ages){
  const api = loadUI(['state', 'derive', 'map', 'dialogs'], ['drawField', 'drawGesture', 'standsIn', ...TWEENS], {
    setUp: '(o) => { wctx = o.wctx; ocv = o.ocv; octx = o.octx; dpr = 1; P = o.P; pace = 1; acc = 0; paused = false; }',
    setPace: '(v) => { pace = v; }',
    setAcc: '(v) => { acc = v; }',
  });
  const P = {};
  for (const k of ['halo', 'select', 'god', 'sprite', 'void', 'field-line', 'field-scar', 'field-none', 'field-wet', 'field-cold', 'field-dark', 'field-light', 'field-above', 'field-below', 'field-hot', 'field-dry', 'field-still', 'field-moving']) P[k] = '#808080';
  const wctx = recordCtx(), octx = recordCtx();
  const ocv = { width: 100, height: 100, getContext: () => octx };
  global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => recordCtx() }), querySelector: () => null };
  api.startCreation(seed);
  for (let k = 0; k < ages && api.era === 'gods'; k++) api.step();
  api.setUp({ wctx, ocv, octx, P });
  /* One draw fills the cache, and one age follows it, so the next draw has a field to fade from. That is
     what a running page does: the first age of a world snaps, and every age after it tweens. */
  api.drawField(); api.step();
  return { api, wctx };
}

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

test('a gesture with a line and a decision draws more than one without them', () => {
  const { api, wctx } = fieldRig('r', 6);
  const live = api.liveRegions(), r = live[0], g = api.gods()[0];
  const head = { god: g.id, age: api.age, from: r.tiles[0], to: r.tiles[2], said: null, weighed: null, region: r.id, pole: g.pole };
  const count = rec => { api.creation.gestures.length = 0; api.creation.gestures.push(rec); api.setAcc(0.15); wctx.calls.length = 0; api.drawField(); return wctx.calls.length; };
  const plain = count({ ...head, kind: 'claim' });
  const said = count({ ...head, kind: 'claim', said: 0 });
  assert.ok(api.legends[0], 'the creation wrote no legend to caption');
  assert.ok(said > plain, 'a line that was written prints no caption');
  const weighed = count({ ...head, kind: 'claim', weighed: { opts: live.slice(0, 3).map(q => ({ type: 'claim', region: q.id, score: 1 })), picked: 'claim' } });
  assert.ok(weighed > plain, 'a decision shows no intent cue at the slow tier');
  /* The cue is the first thing dropped as the pace rises. */
  api.setPace(4);
  const fast = count({ ...head, kind: 'claim', weighed: { opts: live.slice(0, 3).map(q => ({ type: 'claim', region: q.id, score: 1 })), picked: 'claim' } });
  const fastPlain = count({ ...head, kind: 'claim' });
  assert.equal(fast, fastPlain, 'the intent cue still draws below the slow tier');
});

test('at the fastest pace the field is the picture it was, and no gesture draws', () => {
  const { api, wctx } = fieldRig('x', 6);
  const r = api.liveRegions()[0], g = api.gods()[0];
  const rec = { kind: 'claim', god: g.id, age: api.age, from: r.tiles[0], to: r.tiles[1], said: null, weighed: null, region: r.id, pole: g.pole };
  api.setPace(64); api.setAcc(0.5);
  api.creation.gestures.length = 0;
  wctx.calls.length = 0; api.drawField();
  const quiet = wctx.calls.join(',');
  api.creation.gestures.push(rec);
  wctx.calls.length = 0; api.drawField();
  assert.equal(wctx.calls.join(','), quiet, 'a gesture drew something at the fastest pace');
  /* One image, not two: at this pace there is no cross-fade. */
  assert.equal(wctx.calls.filter(c => c === 'drawImage').length, 1);
  /* At the slowest pace the same age draws the field as it was, and the new one over it. */
  api.setPace(1); api.setAcc(0.5);
  wctx.calls.length = 0; api.drawField();
  assert.ok(wctx.calls.filter(c => c === 'drawImage').length >= 2, 'no cross-fade at the slow pace');
  /* A frame that ran two or more ages has nothing to fade from, so it snaps. */
  api.step(); api.step(); api.setAcc(0.5);
  wctx.calls.length = 0; api.drawField();
  assert.equal(wctx.calls.filter(c => c === 'drawImage').length, 1, 'a frame that ran two ages faded');
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

module.exports = { loadUI };
