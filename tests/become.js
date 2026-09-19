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
