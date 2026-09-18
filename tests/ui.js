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

test('stages: an idle recipe folds, an idle standing goal written by hand does not', () => {
  const api = day21();
  api.camp.tools.rod = true; api.camp.stash.fish = 4;
  const byId = {}; for (const s of api.stages(false)) for (const x of s.goals) byId[x.g.id] = x;
  assert.equal(byId.fish.st.s, 'idle', 'the rod and four fish make fishing idle');
  assert.equal(byId.fish.hidden, true, 'an idle recipe folds');
  const hand = byId.water && byId.water.st.s === 'idle' ? byId.water : byId.guard;
  assert.equal(hand.st.s, 'idle');
  assert.equal(hand.hidden, false, 'an idle standing goal stays on the list');
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
const RUNTIME = ['tab-people', 'tab-goals', 'tab-chronicle', 'tab-camp', 'showAllBtn', 'chord-fire', 'chord-food', 'chord-tools', 'chord-shelter', 'chord-crafts', 'chord-sprites', 'chord-settlement'];

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
  assert.equal(api.keyName(named('A sector west')[0]), 'Ctrl+\u2190');
  assert.equal(api.keyName(named('Previous panel')[0]), 'Shift+Tab');
});

test('Esc answers from every focus: the map, a drawer, a window, and each dialog', () => {
  const api = loadUI(['state', 'derive', 'keys', 'actions'], KEYS);
  for (const focus of ['map', 'drawer:goals', 'window:3', 'dialog:mute', 'dialog:palette', 'dialog', 'dialog:chord']){
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
  for (const k of api.KEYMAP) assert.ok(['any', 'map', 'drawer', 'window', 'dialog'].includes(k.focus) || k.focus.startsWith('dialog:'), `${k.key} has focus ${k.focus}`);
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
  assert.deepEqual(keyHit(api, ev('ArrowRight', { ctrlKey: true }), 'map'), { action: 'cursor', arg: [1, 0, 'sector'] });
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
  assert.equal(api.keyAction(ev('Escape'), 'dialog').focus, 'dialog', 'the dialog row answers, not the any row above it');
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

module.exports = { loadUI };
