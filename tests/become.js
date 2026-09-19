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
