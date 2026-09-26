// The labels the ages show: the speed buttons' ladder, and the one age count that the strip, the
// timeline, the act card, the foot and the Hurry dialog share. Fast.
// tests/ui.js runs only with SLOW=1, so these live here, where the fast suite runs them.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* The same helper as tests/people.js and tests/zoom.js. */
function loadUI(files, names){
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',');
  return Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}
const FILES = ['state', 'icons', 'derive', 'keys', 'marks', 'map', 'timeline', 'strip', 'dialogs', 'actions'];
const NAMES = ['ui', 'setSpeed', 'setPace', 'renderClock', 'drawTimeline', 'openHurry', 'ageName', 'ageSpanName', 'timelineModel', 'actCard', 'footChip'];

/* A page just big enough for the code under test. Every element is made on first ask and kept, so a test
   reads back what the code wrote. The four speed buttons are read from the template itself, with their
   `data-speed` and `data-pace`, so a test sees the ladder a player's page carries. */
function el(tag){
  return {
    tag, children: [], textContent: '', className: '', title: '', id: '', dataset: {}, hidden: false,
    classList: { toggle(){}, add(){}, remove(){} },
    append(...c){ this.children.push(...c); }, appendChild(c){ this.children.push(c); },
    replaceChildren(){ this.children = []; }, showModal(){}, close(){}, focus(){}, select(){},
  };
}
function fakePage(){
  const html = fs.readFileSync(path.join(__dirname, '../src/page.template.html'), 'utf8');
  const span = html.match(/<span id="speeds">([\s\S]*?)<\/span>/)[1];
  const buttons = [...span.matchAll(/data-speed="([^"]+)" data-pace="([^"]+)">([^<]*)</g)].map(m => {
    const b = el('button'); b.dataset = { speed: m[1], pace: m[2] }; b.firstChild = { textContent: m[3] };
    const on = new Set(); b.classList = { toggle(k, v){ if (v) on.add(k); else on.delete(k); }, contains: k => on.has(k) };
    return b;
  });
  assert.equal(buttons.length, 4, 'the template holds four speed buttons');
  const byId = {};
  return {
    buttons,
    getElementById: id => byId[id] || (byId[id] = el('div')),
    createElement: tag => el(tag),
    querySelectorAll: sel => sel === '#speeds .btn' ? buttons : [],
    querySelector: () => null,
  };
}
function withPage(fn){
  const page = fakePage();
  global.document = page;
  try { return fn(page); } finally { delete global.document; }
}
const labels = page => page.buttons.map(b => b.firstChild.textContent);
const lit = page => page.buttons.filter(b => b.classList.contains('on')).map(b => b.firstChild.textContent);

test('while the ages run the speed buttons show the pace ladder, even after the days speed is set', () => {
  const api = loadUI(FILES, NAMES);
  api.startCreation('r', {});
  assert.equal(api.era, 'gods');
  withPage(page => {
    /* initUI's own order: newWorld ends with setPace(1), then initUI sets the days speed. */
    api.setPace(1); api.setSpeed(1);
    assert.deepEqual(labels(page), ['¼×', '½×', '1×', '2×'], 'the ages show their own pace labels');
    assert.deepEqual(lit(page), ['1×'], 'the lit button is single pace, the third one');
    assert.equal(page.buttons[2].classList.contains('on'), true);
    api.setPace(0.5);
    assert.deepEqual(lit(page), ['½×']);
  });
});

test('in the days the speed buttons show the days ladder', () => {
  const api = loadUI(FILES, NAMES);
  api.startWorld('r');
  assert.equal(api.era, 'days');
  withPage(page => {
    api.setSpeed(8);
    assert.deepEqual(labels(page), ['1×', '8×', '64×', '256×'], 'the days show their speed labels');
    assert.deepEqual(lit(page), ['8×']);
  });
});

/* A creation stepped until the Pulse has come and gone by more than a full timeline span, so the band
   can be seen both reaching back before time and lying wholly after the Pulse. */
function afterThePulse(){
  const api = loadUI(FILES, NAMES);
  api.startCreation('r', {}); api.camp = api.camps[0];
  let n = 0;
  while (api.era === 'gods' && (api.pulseAge === null || api.age < api.pulseAge + 1) && n++ < 5000) api.step();
  assert.equal(api.era, 'gods', 'the probe must still be in the ages');
  assert.ok(api.pulseAge > 1, `the probe needs a Pulse after the first age, so the two counts differ (Pulse at ${api.pulseAge})`);
  return api;
}
function stripAndBand(api){
  return withPage(page => {
    api.renderClock(); api.drawTimeline();
    const band = page.getElementById('timeline');
    return { strip: page.getElementById('clock').textContent, head: band.children[0].children[0].textContent };
  });
}

test('the strip and the timeline count the ages the same way', () => {
  const api = afterThePulse();
  const { strip, head } = stripAndBand(api);
  const n = api.age - api.pulseAge + 1;
  assert.equal(strip, `Age ${n}`, 'the strip counts from the Pulse');
  assert.equal(head, `Before time to age ${n}`, 'the band starts before the Pulse and ends on the age the strip names');
  assert.equal(api.timelineModel().head, head, 'the band draws the model head');
});

test('a band that lies wholly after the Pulse numbers both ends from it', () => {
  const api = afterThePulse();
  let n = 0;
  while (api.era === 'gods' && api.age < api.pulseAge + 13 && n++ < 20000) api.step();
  if (api.era !== 'gods') return assert.fail(`the creation settled at age ${api.age} before the band left the Pulse behind`);
  const { strip, head } = stripAndBand(api);
  const m = api.timelineModel(), to = api.age - api.pulseAge + 1;
  assert.equal(strip, `Age ${to}`);
  assert.equal(head, `Age ${m.from - api.pulseAge + 1} to ${to}`);
  assert.equal(api.ageSpanName(api.pulseAge, api.pulseAge), 'Age 1');
  assert.equal(api.ageSpanName(api.pulseAge - 1, api.pulseAge - 1), 'Before time');
});

test('the act card, the foot and the Hurry dialog use the same count as the strip', () => {
  const api = afterThePulse();
  const rec = api.creation.choices.filter(c => c.age === api.age).pop();
  assert.ok(rec, 'a god has decided in the age now playing');
  const { strip } = stripAndBand(api);
  assert.equal(api.actCard(rec).rows.find(r => r.label === 'when').value, strip);
  api.ui.timelineChip = `${rec.age}:${rec.god}`;
  assert.ok(api.footChip().head.startsWith(`${strip}. `), api.footChip().head);
  const hurry = withPage(page => { api.openHurry(); return page.getElementById('hurryLeft').textContent; });
  assert.ok(hurry.startsWith(`${strip}. `), hurry);
});
