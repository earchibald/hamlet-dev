// The door: every outside act enters by inject(), is logged, and shows in the chronicle. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('an unknown act or source is refused and not logged', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.inject({ source: 'player', act: 'smite', x: 1, y: 1 }), 'Nothing answers.');
  assert.equal(api.inject({ source: 'weather', act: 'light', x: 1, y: 1, z: 0 }), 'Nothing answers.');
  assert.deepEqual(api.doorLog, []);
});

test('lighting the ground through the door burns it, logs the event with its tick, and writes the chronicle', () => {
  const api = load(); api.startWorld('r');
  const a = api.beings[0];
  let t = null;
  for (let dy = -6; dy <= 6 && !t; dy++) for (let dx = -6; dx <= 6 && !t; dx++){ const q = api.hasTile(a.x + dx, a.y + dy, 0) && api.tileAt(a.x + dx, a.y + dy); if (q && q.ground === 'grass' && !q.feature) t = q; }
  assert.ok(t, 'no grass near the first person');
  const before = api.chronicle.length;
  const msg = api.inject({ source: 'player', act: 'light', x: t.x, y: t.y, z: 0 });
  assert.equal(msg, 'The ground is burning. This fire is not contained.');
  assert.ok(t.fire > 0);
  assert.deepEqual(api.doorLog, [{ tick: api.tick, source: 'player', act: 'light', x: t.x, y: t.y, z: 0 }]);
  assert.equal(api.chronicle.length, before + 1);
  assert.match(api.chronicle[0].text, /from the sky/);
});

test('a lighting that does nothing is still logged', () => {
  const api = load(); api.startWorld('r');
  let t = null;
  for (const q of api.world) if (q.ground === 'water'){ t = q; break; }
  assert.equal(api.inject({ source: 'player', act: 'light', x: t.x, y: t.y, z: 0 }), 'Nothing here will burn.');
  assert.equal(api.doorLog.length, 1);
  assert.equal(api.doorLog[0].act, 'light');
  assert.equal(api.doorLog[0].tick, api.tick);
});

test('a poke through the door names the person in the chronicle and is logged by id', () => {
  const api = load(); api.startWorld('r');
  const a = api.beings[0];
  const msg = api.inject({ source: 'player', act: 'poke', id: a.id });
  assert.equal(msg, `${a.name} looks up, then gets to it.`);
  assert.deepEqual(api.doorLog, [{ tick: api.tick, source: 'player', act: 'poke', id: a.id }]);
  /* chooseTask runs after the nudge and may write its own lines, so look for the line, not at the top. */
  assert.ok(api.chronicle.some(e => e.text === `${a.name} feels a nudge from above.`), 'no chronicle line for the nudge');
  assert.equal(api.inject({ source: 'player', act: 'poke', id: -1 }), 'Nobody is there to poke.');
  assert.equal(api.doorLog.length, 2);
  assert.equal(api.doorLog[1].id, -1);
});

test('a new world empties the log', () => {
  const api = load(); api.startWorld('r');
  api.inject({ source: 'player', act: 'poke', id: api.beings[0].id });
  api.startWorld('x');
  assert.deepEqual(api.doorLog, []);
});

test('the replay record names the seed and the options', () => {
  const api = load(); api.startWorld('r', { sw: 12, sh: 8 });
  const a = api.beings[0];
  api.inject({ source: 'player', act: 'poke', id: a.id });
  assert.deepEqual(api.replay, { seed: 'r', options: { sw: 12, sh: 8, zmin: -2, zmax: 2 }, log: [{ tick: api.tick, source: 'player', act: 'poke', id: a.id }] });
});
