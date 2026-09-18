// The gods as mobs: coming into being, the first ages, the gate, and a creation that ends. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('a creation opens the gods era with one formless region and no god', () => {
  const api = load(); api.startCreation('r');
  assert.equal(api.era, 'gods'); assert.equal(api.age, 0);
  assert.equal(api.liveRegions().length, 1);
  assert.equal(api.gods().length, 0);
  assert.deepEqual(api.legends, []);
  assert.deepEqual(api.creation, { ages: 0, backstops: 0, settled: false, failed: false, gate: null });
  assert.ok(api.godRng);
});

test('the first age: a god comes into being, sunders the formless, and the far side gets its own god', () => {
  const api = load(); api.startCreation('r');
  api.step();
  assert.equal(api.age, 1);
  const gs = api.gods();
  assert.equal(gs.length, 2, 'the splitter and its counterpart');
  const [first, second] = gs;
  assert.equal(api.POLES[first.pole].other, second.pole);
  assert.equal(first.status, 'awake'); assert.equal(second.status, 'awake');
  assert.equal(first.species, 'god'); assert.equal(api.SPECIES.god.perTick, false); assert.equal(api.LIFE.god.death, 'killable');
  assert.ok(api.GOD_NAMES.includes(first.name)); assert.equal(first.epithet, api.EPITHET[first.pole]);
  assert.deepEqual(Object.keys(first.needs), ['expression', 'company', 'rest', 'calm']);
  assert.equal(api.liveRegions().length, 2);
  const [a, b] = api.liveRegions();
  assert.ok(api.hasPole(a, first.pole) && api.hasPole(b, second.pole));
  assert.equal(first.region, a.id); assert.equal(second.region, b.id);
  assert.equal(api.boundaries.length, 1);
  assert.ok(api.legends.some(e => e.text.startsWith('The Sundering')), 'no Sundering line');
  assert.ok(api.legends.every(e => e.when === 'Before time'));
  assert.ok(first.lastChoice && first.lastChoice.picked === 'split');
});

test('the second age is the Pulse, and the ages count from it', () => {
  const api = load(); api.startCreation('r');
  api.step(); api.step();
  assert.equal(api.pulseAge, 2);
  const pulse = api.legends.find(e => e.text.startsWith('The Pulse'));
  assert.ok(pulse, 'no Pulse line'); assert.equal(pulse.when, 'Age 1');
  api.step();
  const third = api.legends.filter(e => e.age === 3);
  assert.ok(third.every(e => e.when === 'Age 2'), 'a line from the third age is not stamped Age 2');
});

test('the gate names the lack, and a god cannot sleep until it passes', () => {
  const api = load(); api.startCreation('r');
  const gate0 = api.restGate();
  assert.equal(gate0.ok, false); assert.equal(gate0.lack, 'start');
  api.step();
  const gate1 = api.restGate();
  assert.equal(gate1.ok, false); assert.ok(['start', 'water', 'fuel', 'food', 'people'].includes(gate1.lack));
  for (const g of api.awakeGods()) assert.ok(!api.godOptions(g).some(o => o.type === 'sleep'), `${g.name} could sleep with the gate shut`);
});

test('a lack of people draws the gods together, and a lack of water calls the wet god', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const [a, b] = api.awakeGods();
  const before = a.opinions[b.id] || 0;
  api.withGodRng(() => api.strain('people'));
  assert.equal(a.opinions[b.id], before + 5);
  if (!api.godOf('wet')){ api.withGodRng(() => api.strain('water')); assert.ok(api.godOf('wet'), 'no wet god after the strain'); assert.equal(api.godOf('wet').region, null); }
});

test('everything the gods do draws from their own stream', () => {
  /* The people's stream after two ages sits where it sat before them: the next draw is the same number. */
  const d = load(); d.startCreation('r');
  const e = load(); e.startCreation('r'); e.step(); e.step();
  assert.ok(e.legends.length >= 3, 'two ages wrote nothing');
  assert.equal(d.rint(1000000), e.rint(1000000), 'the ages moved the people\'s stream');
});

test('a creation ends: every god sleeps, the gate passes, the era flips, and the same seed tells the same myth', () => {
  const api = load(); api.startCreation('r');
  const ages = api.runAges();
  assert.equal(api.era, 'days');
  assert.equal(api.creation.settled, true); assert.equal(api.creation.failed, false);
  assert.ok(ages <= api.options.ageLimit, `${ages} ages`);
  assert.ok(api.gods().length >= 2);
  for (const g of api.gods()) assert.ok(g.status === 'asleep' || g.status === 'dead', `${g.name} is ${g.status}`);
  assert.equal(api.creation.gate.ok, true);
  assert.ok(api.liveRegions().some(r => api.hasMark(r, 'making', 'human')), 'no people were made');
  assert.ok(api.liveRegions().some(r => api.marksOf(r, 'rest').length), 'no god sleeps in a region');
  const spark = api.legends.find(e => e.text === 'A spark stayed.');
  if (api.gods().some(g => g.pole === 'hot')) assert.ok(spark, 'the hot god slept without the spark');
  const again = load(); again.startCreation('r'); again.runAges();
  assert.deepEqual(again.legends.map(e => e.text), api.legends.map(e => e.text));
});
