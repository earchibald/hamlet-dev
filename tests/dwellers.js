// Dwellers: wolves and foxes at home in their dens. Fast: hand-built situations on a real world.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

function denned(species){
  const api = load(); api.startWorld('r');
  const b = api.beings.find(b => b.species === species && b.den);
  assert.ok(b, `no ${species} with a den on seed r`);
  return { api, b, den: b.den };
}
const run = (api, b, n) => { for (let k = 0; k < n && b.alive; k++){ api.camp = api.camps[0]; api.updateBeing(b); api.tick = api.tick + 1; } };
const inDen = (b) => b.den.tiles.some(t => t.x === b.x && t.y === b.y && t.z === b.z);

test('a wolf rests in its den by day', () => {
  const { api, b, den } = denned('wolf');
  const out = den.exit; b.x = out.x; b.y = out.y; b.z = 0; b.task = null; b.asleep = false;
  for (const k in b.needs) b.needs[k] = 90; b.needs.rest = 30;
  api.tick = 10 * 1000 + 500; /* midday */
  run(api, b, 300);
  assert.ok(inDen(b), `the wolf should be home; it is at ${b.x},${b.y},${b.z} doing ${b.task && b.task.label}`);
  assert.ok(b.needs.rest > 30, 'and rested');
});

test('a wolf carries a kill home to its den before eating', () => {
  const { api, b, den } = denned('wolf');
  const out = den.exit; b.x = out.x; b.y = out.y; b.z = 0; b.task = null; b.asleep = false;
  for (const k in b.needs) b.needs[k] = 90; b.needs.food = 20;
  api.tick = 22 * 1000 + 100; /* night */
  const r = api.beings.find(o => o.species === 'rabbit' && o.alive); r.x = out.x + 2; r.y = out.y; r.z = 0; r.task = null;
  for (const t of [[out.x + 1, out.y], [out.x + 2, out.y]]){ const q = api.tileAt(...t); q.feature = null; q.struct = null; if (q.ground === 'water') q.ground = 'grass'; }
  let carried = false;
  for (let k = 0; k < 400 && !(carried && !b.carrying); k++){ api.camp = api.camps[0]; api.updateBeing(b); if (b.carrying && b.carrying.kind === 'carcass') carried = true; api.tick = api.tick + 1; }
  assert.ok(carried, 'the wolf never picked up the kill');
  assert.equal(b.carrying, null, 'the kill was eaten at home');
  assert.ok(inDen(b), 'eaten in the den');
  assert.equal(b.needs.food, 100);
  assert.ok(api.chronicle.some(e => e.text.includes('drags')));
});

test('a den with two adults bears one young in spring, once a year', () => {
  const { api, den } = denned('wolf');
  const adults = api.beings.filter(b => b.alive && b.species === 'wolf' && b.den === den);
  assert.equal(adults.length, 2);
  api.tick = 1000; /* spring, and before either den wolf on seed r ages into 'old' */
  for (const w of adults){ const t = den.tiles[0]; w.x = t.x; w.y = t.y; w.z = t.z; }
  const before = api.beings.filter(b => b.species === 'wolf').length;
  api.denTick(); api.tick = api.tick + 500; api.denTick();
  const after = api.beings.filter(b => b.species === 'wolf').length;
  assert.equal(after, before + 1, 'one pup, not two');
  const pup = api.beings[api.beings.length - 1];
  assert.equal(pup.den, den); assert.equal(pup.born, api.tick - 500); assert.ok(inDen(pup));
  assert.ok(api.chronicle.some(e => e.text.includes('pup') || e.text.includes('kit')));
});
