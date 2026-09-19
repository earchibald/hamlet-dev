// Become: the turn lock, the four acts, the bars, autopilot, and the stops. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

/* A creation stopped at the age where the first god is awake and has a free choice. */
function atFirstTurn(seed = 'gamma'){
  const api = load(); api.startCreation(seed, {});
  api.step();
  return api;
}

test('the door stamps the age in the gods era and refuses an act from another age', () => {
  const api = atFirstTurn();
  const g = api.awakeGods()[0];
  assert.equal(api.inject({ source: 'player', act: 'become', id: g.id }), `You are ${g.name}, ${g.epithet}.`);
  assert.deepEqual(api.doorLog, [{ tick: api.tick, age: api.age, source: 'player', act: 'become', id: g.id }]);
  assert.equal(api.inject({ source: 'player', act: 'become', id: g.id, age: api.age + 5 }), 'Not now.');
  assert.equal(api.doorLog.length, 1, 'a refused act at the wrong age is not logged');
});

test('the days era stamps the tick alone, as it always did', () => {
  const api = load(); api.startWorld('r');
  api.inject({ source: 'player', act: 'poke', id: api.firstPerson().id });
  assert.deepEqual(Object.keys(api.doorLog[0]).sort(), ['act', 'id', 'source', 'tick']);
});

test('every god\'s choice is kept, age by age, with its matrix', () => {
  const api = load(); api.startCreation('gamma', {});
  for (let n = 0; api.era === 'gods' && n < 60; n++) api.step();
  const cs = api.creation.choices;
  assert.ok(cs.length > 5, `expected many choices, got ${cs.length}`);
  for (const c of cs){
    assert.ok(Number.isInteger(c.age) && c.age >= 1, 'every choice names its age');
    assert.ok(api.gods().some(g => g.id === c.god), 'every choice names a live god');
    if (c.continued){ assert.equal(typeof c.type, 'string'); continue; }
    assert.ok(Array.isArray(c.opts) && c.opts.length, 'a free choice carries its matrix');
    for (const o of c.opts) assert.equal(typeof o.score, 'number');
  }
  const picked = cs.filter(c => !c.continued && c.picked);
  assert.ok(picked.length > 3, 'most free choices land on an act');
  const ages = cs.map(c => c.age);
  assert.deepEqual(ages, [...ages].sort((a, b) => a - b), 'the record is in age order');
});

test('keeping the choices does not move the creation', () => {
  const a = load(), b = load();
  a.startWorld('gamma');
  b.startCreation('gamma', {}); let n = 0; while (b.era === 'gods' && n++ < 1000) b.step();
  assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
});

test('an age split in two draws what an unbroken age drew', () => {
  const a = load(), b = load();
  a.startCreation('beta', {}); b.startCreation('beta', {});
  for (let n = 0; n < 12; n++){ a.step(); b.step(); }
  /* b runs its next age through the resumable parts by hand, in the same order ageStep uses. */
  a.step();
  b.withGodRng(() => { b.ageBegin(); b.ageDecide(); b.ageEnd(); });
  assert.equal(b.age, a.age);
  assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
  assert.deepEqual(b.creation.choices, a.creation.choices);
  assert.equal(b.godRng(), a.godRng(), 'the god stream stands at the same place');
});

test('agePos is null between ages', () => {
  const api = load(); api.startCreation('beta', {});
  assert.equal(api.agePos, null);
  api.step();
  assert.equal(api.agePos, null, 'a finished age leaves no position behind');
});

test('becoming a god opens its turn, and the engine will not step until you choose', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  api.inject({ source: 'player', act: 'become', id: g.id });
  const ageWas = api.age;
  api.step();
  assert.ok(api.pending, 'the turn is open');
  assert.equal(api.pending.god, g.id);
  assert.ok(api.pending.opts.length, 'the matrix is the god\'s own options');
  assert.equal(api.step(), 'The turn is yours.');
  assert.equal(api.age, ageWas + 1, 'the age began and then stopped at your god');
  const before = api.creation.choices.length;
  const top = api.pending.opts[0];
  const msg = api.inject({ source: 'player', act: 'choose', id: g.id, opt: { type: top.type, region: top.region } });
  assert.match(msg, /^You /);
  assert.equal(api.pending, null, 'the turn closes');
  assert.ok(api.creation.choices.length > before, 'the choice is in the record');
});

test('taking the best option every turn is the creation the engine runs alone', () => {
  const a = load(), b = load();
  a.startWorld('gamma');
  b.startCreation('gamma', {});
  let n = 0;
  while (b.era === 'gods' && n++ < 2000){
    if (b.pending){
      const g = b.pending.god, top = b.pending.opts[0];
      b.inject({ source: 'player', act: 'choose', id: g, opt: { type: top.type, region: top.region } });
      continue;
    }
    if (!b.inhabited && b.awakeGods().length) b.inject({ source: 'player', act: 'become', id: b.awakeGods()[0].id });
    b.step();
  }
  assert.equal(b.era, 'days');
  assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
  assert.equal(b.tick, a.tick);
});

test('what the player does is a chronicle line and never a legend', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const was = api.legends.length;
  api.inject({ source: 'player', act: 'become', id: api.awakeGods()[0].id });
  assert.equal(api.legends.length, was, 'the legends are the world\'s story, not the player\'s');
  assert.match(api.chronicle[0].text, /looks out through/);
});

test('a suspended age resumes through the gods the age began with', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  api.inject({ source: 'player', act: 'become', id: g.id });
  api.step();
  assert.ok(api.pending, 'the turn is open');
  const was = api.agePos.list;
  const top = api.pending.opts[0];
  api.inject({ source: 'player', act: 'choose', id: g.id, opt: { type: top.type, region: top.region } });
  /* The age either finished, which clears the position, or it ran on through the same list. */
  assert.ok(api.agePos === null || api.agePos.list === was, 'the age never retook its list of gods');
});

test('the door refuses what is not built and what is not open', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  assert.equal(api.inject({ source: 'player', act: 'choose', id: g.id, opt: { type: 'split', region: 1 } }),
    'It is nobody\'s turn.');
  assert.equal(api.inject({ source: 'player', act: 'become', id: g.id, mode: 'possess' }),
    'Only Become is built. Possess, Vessel, and Manifestation wait for their own specs.');
  assert.equal(api.inject({ source: 'player', act: 'become', id: 99999 }),
    'Only a god can be taken, and only while it lives.');
  api.inject({ source: 'player', act: 'become', id: g.id });
  api.step();
  assert.equal(api.inject({ source: 'player', act: 'choose', id: g.id, opt: { type: 'nosuch', region: 1 } }),
    'That is not on the table.');
  assert.ok(api.pending, 'a refused choice leaves the turn open');
});

test('leaving hands the creation back, and it runs on', () => {
  const api = load(); api.startCreation('gamma', {});
  api.step();
  const g = api.awakeGods()[0];
  api.inject({ source: 'player', act: 'become', id: g.id });
  api.step();
  assert.ok(api.pending);
  assert.equal(api.inject({ source: 'player', act: 'become', id: null }), 'You are nobody again. The creation goes on without you.');
  assert.equal(api.pending, null, 'leaving closes the open turn');
  assert.equal(api.inhabited, null);
  const ageWas = api.age;
  api.step();
  assert.ok(api.age > ageWas, 'the ages run again');
});
