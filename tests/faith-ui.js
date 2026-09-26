// The page for a world played as the sky: the Grace gauge, the prayer chips, the miracle tools, the
// slow-down for a new prayer, the season's card, the person's card, the help, and the start dialog.
// Hand-built prayers and tallies on seed r, so no test runs the world. Fast.
// tests/ui.js runs only with SLOW=1, so the checks this work needs in the fast suite live here.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* Join the sim and the named UI files in one scope, as the page does. The same helper as tests/ui.js.
   `extra` maps a key to an expression, so a test can reach a `let` of the page. */
function loadUI(files, names, extra = {}){
  const more = Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join(', ');
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',' + (more ? ' ' + more + ',' : ''));
  return Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}
/* The page entry points an action reaches, stubbed for one call. say() is the page's own, and it leaves
   what it said in ui.note, so a test reads that. */
function withPage(fn){
  const el = { hidden: false, innerHTML: '', textContent: '', dataset: {}, style: {}, open: false,
    classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } },
    setAttribute(){}, appendChild(){}, replaceChildren(){}, scrollIntoView(){}, focus(){}, showModal(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; } };
  global.document = { getElementById: () => el, querySelector: () => null, querySelectorAll: () => [], createElement: () => el, body: el };
  const page = { paints: 0 };
  global.renderUI = () => { page.paints++; }; global.renderFoot = () => {}; global.hideTip = () => {};
  try { return fn(page); }
  finally { delete global.document; delete global.renderUI; delete global.renderFoot; delete global.hideTip; }
}

const FILES = ['state', 'icons', 'derive', 'keys', 'marks', 'map', 'inspect', 'strip', 'dialogs', 'actions'];
const NAMES = ['ui', 'SKY_TEXT', 'TOOLS', 'KEYMAP', 'keyAction', 'keyName', 'ACTIONS', 'gauges', 'graceGauge', 'believersText', 'alerts',
  'ALERT_LABEL', 'campPrayers', 'prayerOf', 'prayingNow', 'prayerText', 'timeLeft', 'toolRows', 'toolShown', 'toolsHTML', 'chipHTML',
  'prayerSpeed', 'notePrayers', 'noteTallies', 'resetSky', 'tallyTitle', 'tallyRows', 'tallyClosing', 'skyHelpHTML', 'inspectBeing',
  'setTool', 'paletteRows', 'persist', 'restore', 'STORE_KEY', 'DAYS_SPEED', 'newWorld', 'mute'];
const EXTRA = {
  getTool: '() => tool', getSpeed: '() => speed', putSpeed: '(v) => { speed = v; }',
  setUp: '() => { wcv = {}; ocv = {}; dpr = 1; }',
};

/* A world on seed r in the days. With `faith`, its record is started and every living person believes. */
function world(faith = true, files = FILES){
  const api = loadUI(files, NAMES.filter(n => files.includes('dialogs') || !['skyHelpHTML'].includes(n)), EXTRA);
  api.startWorld('r', { faith });
  api.camp = api.camps[0];
  if (faith){ api.startFaith(); api.giveBeliefs(); }
  const a = api.firstPerson();
  return { api, a, c: api.camps[0] };
}
/* One open prayer, as faith.js writes it. */
function pray(api, a, kind = 'fire', left = api.hours(3)){
  const p = { id: api.faith.nextPrayer++, kind, who: a.id, camp: a.camp.id, at: api.tick, until: api.tick + left, where: [a.x, a.y, 0], end: null, endedAt: 0 };
  api.faith.prayers.push(p);
  return p;
}
const ev = (key, mods = {}) => ({ key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods });
const hit = (api, e, focus) => { const h = api.keyAction(e, focus); return h && { action: h.action, arg: h.arg }; };
/* A season's tally, as turnSeason writes it. */
const tally = (o = {}) => ({ season: 'spring', year: 1, from: 0, to: 1, people: 4, believers: 3, meanBelief: 31, answered: 2, ownHands: 1, silent: 1, births: 1, deaths: 0, spent: 55, ...o });

/* A name the page declares twice stops the whole page with a SyntaxError. openPrayers was once declared
   by both faith.js and derive.js. tests/ui.js holds the same check, but it runs only with SLOW=1. */
test('every UI file joins with the sim into one script that compiles', () => {
  assert.doesNotThrow(() => Function(sim.source() + '\n' + ui.source()));
});

test('the Grace gauge reads the grace, its level says what it can buy, and it says Forgotten when nobody believes', () => {
  const { api, a } = world();
  const g = v => { api.faith.grace = v; return api.graceGauge(); };
  assert.deepEqual([g(42).text, g(42).level], ['42', 'good'], 'enough for Rain, the dearest miracle');
  assert.deepEqual([g(20.9).text, g(20.9).level], ['20', 'warn'], 'enough for a Spark, not for Rain; the number is floored');
  assert.deepEqual([g(10).text, g(10).level], ['10', 'bad'], 'not enough for any miracle');
  assert.equal(g(50).v, 0.5, 'the bar is the grace over the cap');
  api.faith.forgotten = true;
  assert.deepEqual([g(80).text, g(80).level], ['Forgotten', 'bad'], 'a forgotten sky buys nothing, whatever it holds');
  assert.equal(api.gauges().grace.text, 'Forgotten', 'the strip reads the gauge through gauges()');
  assert.equal(a.belief, 40);
});

test('the believers count is the living people above the floor, out of the living people', () => {
  const { api, a, c } = world();
  const n = api.makeBeing('human', a.x, a.y); n.camp = c; api.beings.push(n); api.giveBeliefs();
  assert.equal(api.believersText(), '2 of 2 believe');
  n.belief = api.FAITH.belief.floor;
  assert.equal(api.believersText(), '1 of 2 believe', 'belief at the floor is not belief');
  assert.equal(api.graceGauge().believers, '1 of 2 believe', 'the gauge carries the count');
  assert.match(api.toolsHTML(), /Rain/, 'sanity: the strip helpers are loaded');
});

/* initUI builds the tool buttons before the first world is made, while `options` is still unset. The
   first build threw there in Safari, and the page never started. */
test('the tools can be read before any world exists', () => {
  const api = loadUI(FILES, NAMES, EXTRA);
  assert.equal(api.options, undefined, 'no world yet');
  assert.deepEqual(api.toolRows().map(t => t.id), ['inspect', 'light', 'nudge']);
  assert.doesNotThrow(() => api.toolsHTML());
});

test('with faith off there is no gauge, no prayer chip, and no miracle tool', () => {
  const { api, a } = world(false);
  assert.equal(api.graceGauge(), null);
  assert.equal(api.gauges().grace, null);
  assert.deepEqual(api.toolRows().map(t => t.id), ['inspect', 'light', 'nudge']);
  assert.ok(api.toolRows().every(t => t.cost === null), 'nothing costs grace in a watched world');
  assert.deepEqual(api.campPrayers(), []);
  assert.deepEqual(api.prayingNow(), {});
  assert.equal(api.prayerOf(a), null);
});

test('with faith on the tools are Spark, Rain, Ward, and Beckon, each with its cost in the button and the hint', () => {
  const { api } = world();
  const rows = api.toolRows();
  assert.deepEqual(rows.map(t => t.id), ['inspect', 'light', 'rain', 'ward', 'beckon', 'nudge']);
  const by = Object.fromEntries(rows.map(t => [t.id, t]));
  assert.equal(by.light.label, 'Spark');
  for (const id of ['light', 'rain', 'ward', 'beckon']){
    assert.equal(by[id].cost, api.FAITH.cost[id], `${id} costs FAITH.cost`);
    assert.ok(by[id].hint.includes(`It costs ${api.FAITH.cost[id]} grace.`), `${id} hint names its cost`);
    assert.ok(/Enter/.test(by[id].hint), `${id} hint says Enter`);
  }
  assert.equal(by.nudge.cost, null, 'Nudge stays free'); assert.equal(by.inspect.cost, null);
  const html = api.toolsHTML();
  assert.match(html, /data-tool="rain"[^>]*>Rain<span class="cost">40<\/span><kbd>R<\/kbd>/);
  assert.match(html, /data-tool="light"[^>]*>Spark<span class="cost">15<\/span><kbd>F<\/kbd>/);
});

test('a miracle tool is refused in a watched world, and the choice of tool stays where it was', () => {
  const { api } = world(false);
  withPage(() => api.setTool('rain'));
  assert.equal(api.getTool(), 'inspect');
  assert.equal(api.ui.note.text, api.FAITH_TEXT.refuse.off);
  assert.ok(!api.paletteRows().some(r => r.action === 'tool' && r.arg === 'rain'), 'the palette offers no Rain in a watched world');
});

test('the keys: F stays the Spark, R, D, and B are the miracles, P switches the slow-down, and none clashes', () => {
  const { api } = world();
  for (const focus of ['map', 'drawer:people', 'drawer:goals', 'window:2']){
    assert.deepEqual(hit(api, ev('r'), focus), { action: 'tool', arg: 'rain' }, `R in ${focus}`);
    assert.deepEqual(hit(api, ev('d'), focus), { action: 'tool', arg: 'ward' }, `D in ${focus}`);
    assert.deepEqual(hit(api, ev('b'), focus), { action: 'tool', arg: 'beckon' }, `B in ${focus}`);
    assert.deepEqual(hit(api, ev('p'), focus), { action: 'slowForPrayers', arg: undefined }, `P in ${focus}`);
    assert.deepEqual(hit(api, ev('R', { shiftKey: true }), focus), { action: 'toolSticky', arg: 'rain' }, `Shift+R in ${focus}`);
  }
  assert.deepEqual(hit(api, ev('f'), 'map'), { action: 'tool', arg: 'light' }, 'F is still the fire');
  /* No other row in a focus the map can hold takes these keys. */
  const mine = new Set(['r', 'd', 'b', 'p']);
  for (const k of api.KEYMAP){
    if (!mine.has(k.key.toLowerCase()) || k.ctrl || k.alt || k.meta || k.focus.startsWith('dialog')) continue;
    assert.ok(['tool', 'toolSticky', 'slowForPrayers'].includes(k.action), `${api.keyName(k)} is also ${k.label} in ${k.focus}`);
  }
  assert.deepEqual(hit(api, ev('w', { altKey: true }), 'dialog:start'), { action: 'watchWorld', arg: undefined });
  assert.deepEqual(hit(api, ev('Enter'), 'dialog:start'), { action: 'makeWorld', arg: undefined });
  assert.deepEqual(hit(api, ev('Enter'), 'dialog:tally'), { action: 'closeTally', arg: undefined });
});

test('an open prayer is the first chip: who prays, for what, the time left, and a jump to the person', () => {
  const { api, a, c } = world();
  const p = pray(api, a, 'fire', api.hours(3));
  const chip = api.alerts()[0];
  assert.equal(chip.type, 'prayer');
  assert.equal(chip.text, `${a.name} prays for fire`, 'the sim\'s own line, without its full stop');
  assert.equal(chip.after, '3 hours left');
  assert.equal(chip.being, a.id, 'the chip jumps to the one who prays');
  assert.equal(chip.n, 1, 'a prayer takes Alt+1');
  assert.equal(api.ALERT_LABEL.prayer, 'Prayer');
  assert.match(api.chipHTML(chip), /prays for fire <span class="left">3 hours left<\/span>/);
  p.until = api.tick + api.mins(20);
  assert.equal(api.alerts()[0].after, '20 minutes left', 'in the last hour it counts minutes');
  assert.deepEqual(api.prayingNow(), { [a.id]: true }, 'the one who prays gets the mark');
  assert.equal(api.prayerOf(a), p);
  /* The mute key is the text, so it holds while the time counts down. */
  api.mute('prayer', c.id, chip.text);
  assert.ok(!api.alerts().some(x => x.type === 'prayer'), 'a muted prayer chip stays muted');
  api.ui.mutes.clear();
  p.end = 'sky';
  assert.ok(!api.alerts().some(x => x.type === 'prayer'), 'a closed prayer has no chip');
  assert.deepEqual(api.prayingNow(), {}, 'and no mark');
});

test('a prayer in another camp is not a chip in this one', () => {
  const { api, a } = world();
  const c2 = api.makeCamp('The second camp');
  const b = api.makeBeing('human', a.x, a.y); b.camp = c2; api.beings.push(b); api.giveBeliefs();
  pray(api, b, 'hunger');
  assert.ok(!api.alerts().some(x => x.type === 'prayer'), 'the chosen camp shows its own prayers');
  api.camp = c2;
  assert.equal(api.alerts()[0].text, `${b.name} prays for food`);
});

test('prayerSpeed: a prayer not yet seen brings a speed above the default down to it, and nothing else does', () => {
  const { api } = world();
  const D = api.DAYS_SPEED, open = [{ id: 1, end: null }], closed = [{ id: 1, end: 'sky' }];
  assert.equal(D, 8);
  assert.equal(api.prayerSpeed({}, open, 64), D);
  assert.equal(api.prayerSpeed({}, open, 256), D);
  assert.equal(api.prayerSpeed({}, open, 8), 8, 'the default is not raised or lowered');
  assert.equal(api.prayerSpeed({}, open, 1), 1, 'a slower speed stays slow');
  assert.equal(api.prayerSpeed({ 1: true }, open, 64), 64, 'a prayer already seen does not slow it again');
  assert.equal(api.prayerSpeed({}, closed, 64), 64, 'a prayer already closed does not slow it');
  assert.equal(api.prayerSpeed({}, [], 64), 64);
});

test('a new prayer slows the game once and says why; the switch turns it off; the drop is not the player\'s choice', () => {
  const { api, a } = world();
  const said = () => api.ui.note && api.ui.note.text;
  withPage(() => {
    {
      api.resetSky(); api.putSpeed(64); api.ui.speedChosen = true; api.ui.savedSpeed = 64;
      api.notePrayers();
      assert.equal(api.getSpeed(), 64, 'no prayer, no change');
      pray(api, a);
      api.notePrayers();
      assert.equal(api.getSpeed(), 8);
      assert.equal(said(), `${a.name} prays. Time slows so you can listen.`);
      assert.equal(api.ui.savedSpeed, 64, 'the drop leaves the saved speed alone');
      api.putSpeed(64); api.notePrayers();
      assert.equal(api.getSpeed(), 64, 'the same prayer does not slow it twice');
      api.ACTIONS.slowForPrayers();
      assert.equal(api.ui.slowForPrayers, false);
      assert.equal(said(), api.SKY_TEXT.slowOff);
      const b = api.makeBeing('human', a.x, a.y); b.camp = a.camp; api.beings.push(b); api.giveBeliefs(); pray(api, b);
      api.notePrayers();
      assert.equal(api.getSpeed(), 64, 'with the switch off, a new prayer keeps the speed');
      assert.ok(api.ui.seenPrayers[api.faith.prayers[1].id], 'but the prayer is seen, so turning it on later does not slow for it');
    }
  });
});

test('Slow for prayers is saved, on by default, and a stored value that is not a boolean is refused', () => {
  const { api } = world();
  assert.equal(api.ui.slowForPrayers, true, 'on by default');
  const store = {};
  global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  try {
    api.ui.slowForPrayers = false; api.persist();
    api.ui.slowForPrayers = true; api.restore();
    assert.equal(api.ui.slowForPrayers, false, 'a stored false comes back');
    const s = JSON.parse(store[api.STORE_KEY]); s.slowForPrayers = 'no'; store[api.STORE_KEY] = JSON.stringify(s);
    api.ui.slowForPrayers = true; api.restore();
    assert.equal(api.ui.slowForPrayers, true, 'a stored string is refused');
  } finally { delete global.localStorage; }
});

test('the season card: its title, its rows, and a closing line picked by the first rule that fits', () => {
  const { api } = world();
  assert.equal(api.tallyTitle(tally()), 'Spring ends');
  assert.deepEqual(api.tallyRows(tally()), [['Believers', '3 of 4'], ['Mean belief', '31'], ['Answered by the sky', '2'], ['Met by their own hands', '1'],
    ['The sky was silent', '1'], ['Born', '1'], ['Died', '0'], ['Grace spent', '55']]);
  const C = api.SKY_TEXT.closing, close = o => api.tallyClosing(tally(o));
  assert.equal(close({ believers: 0 }), C.forgotten);
  assert.equal(close({ answered: 0, ownHands: 0, silent: 0 }), C.quiet);
  assert.equal(close({ answered: 0, ownHands: 3, silent: 1 }), C.learning);
  assert.equal(close({ answered: 2, silent: 1 }), C.heard);
  assert.equal(close({ answered: 1, silent: 2, ownHands: 0 }), C.unheard);
  assert.equal(close({ answered: 1, silent: 1, ownHands: 0 }), C.even);
});

/* dialogs.js is left out, so the card and the dialog check are the stubs below. */
const NO_DIALOGS = FILES.filter(f => f !== 'dialogs');
test('a new tally opens its card once; a watched world never opens one; a load does not open an old one', () => {
  const { api } = world(true, NO_DIALOGS);
  const opened = [];
  withPage(() => {
    global.openTally = t => opened.push(t); global.anyDialogOpen = () => false;
    try {
      api.resetSky(); api.noteTallies();
      assert.equal(opened.length, 0, 'no tally, no card');
      api.faith.tallies.push(tally());
      api.noteTallies(); api.noteTallies();
      assert.equal(opened.length, 1, 'one card for one tally');
      global.anyDialogOpen = () => true;
      api.faith.tallies.push(tally({ season: 'summer' }));
      api.noteTallies();
      assert.equal(opened.length, 1, 'the card waits while another dialog is open');
      global.anyDialogOpen = () => false;
      api.noteTallies();
      assert.equal(opened[1].season, 'summer', 'then it opens');
      api.faith.tallies.push(tally({ season: 'autumn' }));
      api.resetSky(true); api.noteTallies();
      assert.equal(opened.length, 2, 'a loaded world\'s tallies count as seen');
      /* Faith off: even a record with a tally in it opens nothing. */
      const off = world(false, NO_DIALOGS).api;
      off.faith = { prayers: [], tallies: [tally()] };
      off.resetSky(); off.noteTallies();
      assert.equal(opened.length, 2, 'a watched world never opens the card');
    } finally { delete global.openTally; delete global.anyDialogOpen; }
  });
});

test('the person card shows belief and the open prayer with faith on, and neither with faith off', () => {
  const { api, a } = world();
  a.belief = 37; pray(api, a, 'wolf', api.mins(40));
  const card = api.inspectBeing(a, true);
  assert.match(card, /<span>Belief<\/span>.*<span class="num">37<\/span>/);
  assert.ok(card.includes(`${a.name} prays to be kept from the wolf. 40 minutes left.`), 'the open prayer, with its time left');
  const off = world(false);
  const plain = off.api.inspectBeing(off.a, true);
  assert.ok(!plain.includes('Belief'), 'no belief row in a watched world');
});

test('the help section names every cost, the cap, and the state and key of Slow for prayers', () => {
  const { api } = world();
  let html = api.skyHelpHTML();
  for (const k of ['light', 'rain', 'ward', 'beckon']) assert.ok(html.includes(String(api.FAITH.cost[k])), `the ${k} cost`);
  assert.ok(html.includes(`Spark ${api.FAITH.cost.light}, Rain ${api.FAITH.cost.rain}, Ward ${api.FAITH.cost.ward}, Beckon ${api.FAITH.cost.beckon}.`));
  assert.ok(html.includes(`stops at ${api.FAITH.graceCap}.`));
  assert.ok(html.includes('Slow for prayers is on. P switches it.'));
  assert.ok(html.includes('8×'));
  assert.ok(!html.includes('{'), 'every slot is filled');
  api.ui.slowForPrayers = false; html = api.skyHelpHTML();
  assert.ok(html.includes('Slow for prayers is off.'));
  assert.ok(!html.includes(api.SKY_TEXT.help.watched), 'a played world is not told it is watched');
  assert.ok(world(false).api.skyHelpHTML().includes(api.SKY_TEXT.help.watched), 'a watched world is');
});

test('the start dialog: Play as the sky is Enter and makes a world with faith on; Watch the valley makes one with faith off', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/page.template.html'), 'utf8');
  assert.match(html, /<button class="btn" id="newWorld" value="make">Play as the sky<kbd>Enter<\/kbd><\/button>/, 'the first button of the form is the default, and Enter in the seed box submits it');
  assert.match(html, /id="watchWorld" value="watch">Watch the valley<kbd>Alt\+W<\/kbd>/);
  const main = fs.readFileSync(path.join(__dirname, '../src/ui/main.js'), 'utf8');
  assert.match(main, /newWorld\(seed, \{ faith: rv === 'make' \}\)/, 'the close handler passes faith by the button');
  assert.match(main, /newWorld\(randomSeed\(\), \{ faith: true \}\)/, 'the world behind the first dialog is played');
  const { api } = world();
  api.setUp();
  withPage(() => { api.newWorld('r', { faith: true }); });
  assert.equal(api.options.faith, true);
  withPage(() => { api.newWorld('r', { faith: false }); });
  assert.equal(api.options.faith, false);
  withPage(() => { api.newWorld('r'); });
  assert.equal(api.options.faith, false, 'a caller that names no option gets the sandbox, as before');
});

/* tests/ui.js holds the full check, but it runs only with SLOW=1. The new buttons are checked here too. */
test('every template button prints a key, and every keyed button id is in the template', () => {
  const { api } = world();
  const html = fs.readFileSync(path.join(__dirname, '../src/page.template.html'), 'utf8');
  for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)){
    const id = (m[0].match(/\bid="([^"]+)"/) || [, m[0]])[1];
    assert.match(m[1], /<kbd>/, `button #${id} prints no key`);
  }
  const ids = new Set([...html.matchAll(/<button[^>]*\bid="([^"]+)"/g)].map(m => m[1]));
  const RUNTIME = ['tab-people', 'tab-goals', 'tab-chronicle', 'tab-camp', 'tab-legends', 'showAllBtn', 'peopleCampBtn', 'peopleAgeBtn', 'chord-fire', 'chord-food', 'chord-tools', 'chord-shelter', 'chord-crafts', 'chord-sprites', 'chord-settlement', 'foldTl', 'tlOut', 'tlIn'];
  for (const k of api.KEYMAP) if (k.button && !RUNTIME.includes(k.button)) assert.ok(ids.has(k.button), `key map names button #${k.button}, which is not in the template`);
  for (const b of ['newWorld', 'watchWorld', 'tallyClose']){
    const row = api.KEYMAP.find(k => k.button === b);
    assert.ok(row, `#${b} has a key map row`);
    assert.match(html, new RegExp(`id="${b}"[^>]*>[^<]*<kbd>${api.keyName(row).replace('+', '\\+')}</kbd>`), `#${b} prints ${api.keyName(row)}`);
  }
  /* Every tool button is built from a TOOLS row, and its key is the row's. */
  for (const m of api.toolsHTML().matchAll(/data-tool="(\w+)"[\s\S]*?<kbd>(\w)<\/kbd>/g)) assert.equal(m[2], api.TOOLS.find(t => t.id === m[1]).key.toUpperCase());
});
