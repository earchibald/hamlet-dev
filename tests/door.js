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
  assert.equal(msg, 'Lightning. Something is burning, and it will smoulder a while.');
  assert.ok(t.fire > 0);
  assert.deepEqual(api.doorLog, [{ tick: api.tick, source: 'player', act: 'light', x: t.x, y: t.y, z: 0 }]);
  assert.equal(api.chronicle.length, before + 1);
  assert.match(api.chronicle[0].text, /Lightning strikes/);
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
  assert.match(msg, new RegExp(`^${a.name} looks up, then (goes to .+|gets to it)\\.$`));
  assert.deepEqual(api.doorLog, [{ tick: api.tick, source: 'player', act: 'poke', id: a.id }]);
  /* chooseTask runs after the nudge and may write its own lines, so look for the line, not at the top. */
  assert.ok(api.chronicle.some(e => e.text === `${a.name} feels a nudge from above.`), 'no chronicle line for the nudge');
  assert.equal(api.inject({ source: 'player', act: 'poke', id: -1 }), 'Nobody is there to nudge.');
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

test('a goal priority is an act: refused for a bad goal or value, logged, and in the chronicle', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.inject({ source: 'player', act: 'priority', id: 'no-such-goal', pri: 2 }), 'No such goal.');
  assert.equal(api.inject({ source: 'player', act: 'priority', id: 'snare', pri: 5 }), 'A priority is off, on, or high.');
  assert.equal(api.doorLog.length, 2, 'lawful acts that did nothing are still logged');
  assert.equal(api.inject({ source: 'player', act: 'priority', id: 'snare', pri: 2 }), 'Set snares for rabbits: high.');
  assert.equal(api.goalPriority.snare, 2);
  assert.ok(api.chronicle.some(e => e.text === 'A wish from above: set snares for rabbits is wanted most.'));
});

test('the camp site is an act with its guards inside the door', () => {
  const api = load(); api.startWorld('r');
  const a = api.beings[0]; api.camp = api.camps[0];
  let water = null, open = null;
  for (const t of api.world){ if (!water && t.ground === 'water') water = t; if (!open && t.ground === 'grass' && !t.feature && !t.struct) open = t; if (water && open) break; }
  assert.equal(api.inject({ source: 'player', act: 'site', x: open.x, y: open.y, z: 1 }), 'The camp must be on the valley floor.');
  assert.equal(api.inject({ source: 'player', act: 'site', x: water.x, y: water.y, z: 0 }), 'The camp site must be open ground you can stand on.');
  assert.equal(api.inject({ source: 'player', act: 'site', x: open.x, y: open.y, z: 0 }), 'Camp site set. The fire pit will go here.');
  assert.deepEqual(api.camps[0].site, [open.x, open.y]);
  assert.ok(api.chronicle.some(e => e.text === 'The camp site moves. Someone felt it was right.'));
  api.camps[0].pit = [open.x, open.y];
  assert.equal(api.inject({ source: 'player', act: 'site', x: open.x, y: open.y, z: 0 }), 'The fire pit is already built. The camp stays where it is.');
  assert.equal(api.doorLog.length, 4);
});

test('an event that carries a tick must arrive at that tick', () => {
  const api = load(); api.startWorld('r');
  const a = api.beings[0];
  assert.equal(api.inject({ source: 'player', act: 'poke', id: a.id, tick: api.tick - 1 }), 'Not now.');
  assert.equal(api.inject({ source: 'player', act: 'poke', id: a.id, tick: api.tick + 1 }), 'Not now.');
  assert.deepEqual(api.doorLog, []);
  assert.match(api.inject({ source: 'player', act: 'poke', id: a.id, tick: api.tick }), new RegExp(`^${a.name} looks up, then (goes to .+|gets to it)\\.$`));
  assert.deepEqual(api.doorLog, [{ source: 'player', act: 'poke', id: a.id, tick: api.tick }]);
});
