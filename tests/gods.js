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
  if (!api.godOf('wet')){ api.withGodRng(() => api.strain('water')); assert.ok(api.godOf('wet'), 'no wet god after the strain'); const w = api.godOf('wet'); const home = api.regionById(w.region); assert.ok(home && !home.children && api.hasPole(home, 'wet'), 'a god born of a lack holds a country'); }
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
  assert.ok(!api.legends.some(e => /foxs|wolfs|deers|humans/.test(e.text)));
  const spark = api.legends.find(e => e.text === 'A spark stayed.');
  if (api.gods().some(g => g.pole === 'hot')) assert.ok(spark, 'the hot god slept without the spark');
  const again = load(); again.startCreation('r'); again.runAges();
  assert.deepEqual(again.legends.map(e => e.text), api.legends.map(e => e.text));
});

/* A god of a pole, standing in a region that carries the pole, with its needs where the test wants them. */
function godWith(api, pole, needs = {}){
  const r = api.liveRegions()[0];
  const g = api.withGodRng(() => api.makeGod(pole, r, 'Test.'));
  api.setPole(r, pole, g, 'test'); Object.assign(g.needs, needs);
  return { g, r };
}

test('raising takes ages and leaves a height mark; digging leaves depth', () => {
  const api = load(); api.startCreation('r');
  const { g, r } = godWith(api, 'above', { expression: 10 });
  g.traits.diligence = 1;
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.raise.apply(g, r)); });
  assert.ok(g.task && g.task.type === 'raise' && g.task.left === 4 && g.task.done === 1);
  assert.equal(api.marksOf(r, 'height')[0].value, 1);
  api.withGodRng(() => { for (let k = 0; k < 3; k++) api.GOD_ACTS.raise.continue(g, g.task); });
  assert.equal(g.task, null);
  assert.equal(api.marksOf(r, 'height')[0].value, 4);
  assert.ok(api.legends.some(e => /raised a mountain/.test(e.text)));
  const { g: d, r: q } = godWith(api, 'below');
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.dig.apply(d, q)); });
  assert.equal(api.marksOf(q, 'depth')[0].value, 1);
});

test('flow runs through neighbouring countries, and pool marks one', () => {
  const api = load(); api.startCreation('r');
  api.step(); api.step(); api.step();
  const { g, r } = godWith(api, 'wet');
  const flows = () => api.liveRegions().reduce((n, q) => n + api.marksOf(q, 'flow').length, 0);
  const before = flows();
  const dryBefore = api.liveRegions().filter(q => !api.hasPole(q, 'wet')).map(q => q.id);
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.flow.apply(g, r)); });
  assert.ok(flows() >= before + 2, 'flow touched fewer than two countries');
  const flowedDry = api.liveRegions().filter(q => api.hasMark(q, 'flow') && dryBefore.includes(q.id));
  if (flowedDry.length) assert.ok(flowedDry.every(q => !api.hasPole(q, 'wet')), 'flow changed a dry country\'s nature');
  const p = api.liveRegions().find(q => !api.hasPole(q, 'wet')) || api.liveRegions()[0];
  const s = api.withGodRng(() => api.makeGod('still', p, 'Test.'));
  api.setPole(p, 'still', s, 'test');
  const pWasDry = !api.hasPole(p, 'wet');
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.pool.apply(s, p)); });
  assert.ok(api.hasMark(p, 'pool'));
  if (pWasDry) assert.ok(!api.hasPole(p, 'wet'), 'pool changed a dry country\'s nature');
  assert.equal(api.GOD_ACTS.pool.targets(s).includes(p), false, 'a pooled region is offered again');
});

test('the gate reads a flow or pool mark as water', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const [a] = api.awakeGods(); const r = api.regionById(a.region);
  api.setPole(r, 'dry', a, ''); api.setPole(r, 'hot', a, '');
  for (const n of api.neighboursOf(r)) api.setPole(n, 'dry', a, '');
  assert.equal(api.restGate().lack, 'water');
  api.mark(api.neighboursOf(r)[0], 'flow', 'surface', a, '');
  assert.notEqual(api.restGate().lack, 'water');
});

test('burning scars another god\'s country and offends it', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const [a, b] = api.awakeGods();
  const hot = api.withGodRng(() => api.makeGod('hot', null, 'Test.'));
  /* The splitter wrote the poles on both children, so burning b's country offends a, the marker. */
  const target = api.regionById(b.region);
  const calm = a.needs.calm;
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.burn.apply(hot, target)); });
  assert.ok(api.hasMark(target, 'scar', 'burned'));
  assert.equal(api.biomeOf(target), 'ash');
  assert.equal(a.needs.calm, calm - 20);
  assert.equal(a.opinions[hot.id], -10);
});

test('freeze, hide, and show write their own mark kinds', () => {
  const api = load(); api.startCreation('r');
  for (const [pole, act] of [['cold', 'freeze'], ['dark', 'hide'], ['light', 'show']]){
    const { g, r } = godWith(api, pole);
    api.withGodRng(() => { assert.ok(api.GOD_ACTS[act].apply(g, r)); });
    assert.ok(api.hasMark(r, act, true), `${act} left no mark`);
  }
});

test('rivals battle, the winner marks the country, and the loser\'s mark is a scar', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const [a, b] = api.awakeGods();
  a.opinions[b.id] = -50; b.opinions[a.id] = -50; api.withGodRng(() => api.strain('people')); /* setRelation runs inside strain: -45 each, rivals */
  assert.equal(a.rel[b.id], 'rival');
  /* b marks its own country, so a has something of b's to fight over. */
  const target = api.regionById(b.region);
  api.setPole(target, b.pole, b, 'mine');
  assert.ok(api.GOD_ACTS.battle.targets(a).includes(target), 'the rival\'s country is not offered');
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.battle.apply(a, target)); });
  const winnerPole = api.poleOf(target, a.contrast);
  const winner = winnerPole === a.pole ? a : b, loser = winner === a ? b : a;
  assert.ok(api.hasMark(target, 'scar', api.SCAR_OF[winner.pole]), 'no scar of the winner\'s kind');
  assert.ok(api.legends.some(e => e.text.includes(`${winner.name} wins`)));
  assert.equal(loser.opinions[winner.id], -60);
  assert.equal(winner.opinions[loser.id], -50);
});

test('a twist needs a scar and a making', () => {
  const api = load(); api.startCreation('r');
  const { g, r } = godWith(api, 'hot');
  assert.equal(api.GOD_ACTS.twist.targets(g).length, 0);
  api.mark(r, 'scar', 'burned', g, ''); api.mark(r, 'making', 'rabbit', g, '');
  assert.ok(api.GOD_ACTS.twist.targets(g).includes(r));
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.twist.apply(g, r)); });
  assert.ok(api.hasMark(r, 'twist', 'rabbit'));
});

test('a god whose pole is unmade from the whole field dies, and leaves a scar', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const [a, b] = api.awakeGods();
  /* Take b's pole off the field, then run the unmaking as ageStep would. */
  for (const r of api.liveRegions()) if (api.hasPole(r, b.pole)) api.setPole(r, a.pole, a, 'over');
  assert.equal(api.poleShare(b.pole), 0);
  api.withGodRng(() => api.unmake(b));
  assert.equal(b.status, 'dead'); assert.equal(b.alive, false);
  assert.deepEqual(api.awakeGods(), [a]);
  assert.ok(api.legends.some(e => e.text.includes(`${b.name} is no more`)));
  assert.ok(api.liveRegions().some(q => api.marksOf(q, 'scar').some(m => m.by === b.id)), 'no scar for the dead god');
});

test('a country with a height pole but nothing raised or dug can be a start', () => {
  const api = load(); api.startCreation('r');
  const above = api.withGodRng(() => api.makeGod('above', api.field.root, 'Test.'));
  const dry = api.withGodRng(() => api.makeGod('dry', api.field.root, 'Test.'));
  const r = api.field.root;
  api.setPole(r, 'above', above, ''); api.setPole(r, 'dry', dry, '');
  assert.notEqual(api.restGate().lack, 'start', 'highland that nobody raised should be a start');
  api.mark(r, 'height', 1, above, '');
  assert.equal(api.restGate().lack, 'start', 'a raised country is not level');
});

test('when every god is of one contrast, a lack of people strains a new one', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const before = api.gods().length;
  const contrasts = new Set(api.awakeGods().map(g => g.contrast));
  assert.equal(contrasts.size, 1);
  api.withGodRng(() => api.strain('people'));
  assert.equal(api.gods().length, before + 1);
  assert.equal(new Set(api.awakeGods().map(g => g.contrast)).size, 2);
  api.withGodRng(() => api.strain('people'));
  assert.equal(api.gods().length, before + 1, 'a second contrast is enough; no third god');
});

test('the gods leave the last plains alone', () => {
  const api = load(); api.startCreation('r');
  const above = api.withGodRng(() => api.makeGod('above', api.field.root, 'Test.'));
  const dry = api.withGodRng(() => api.makeGod('dry', api.field.root, 'Test.'));
  const cut = api.withGodRng(() => api.splitRegion(api.field.root, dry));
  for (const r of [cut.a, cut.b]){ api.setPole(r, 'dry', dry, ''); api.setPole(r, 'above', above, ''); }
  assert.equal(api.startCandidates().length, 2);
  assert.deepEqual(api.GOD_ACTS.raise.targets(above), [], 'two plains left, and one is offered for raising');
  const more = api.withGodRng(() => api.splitRegion(cut.a, dry));
  for (const r of [more.a, more.b]) { api.setPole(r, 'dry', dry, ''); api.setPole(r, 'above', above, ''); }
  assert.equal(api.startCandidates().length, 3);
  assert.equal(api.GOD_ACTS.raise.targets(above).length, 3, 'three plains left, and none is offered');
});

test('a world that outgrows its gods calls a new difference into being', () => {
  const api = load(); api.startCreation('r');
  api.step(); api.step();
  const before = api.gods().length;
  api.withGodRng(() => { for (let k = 0; k < 40; k++){ const r = api.liveRegions().find(api.canSplit); if (!r) break; api.splitRegion(r, api.gods()[0]); } });
  assert.ok(api.liveRegions().length >= 6 * before);
  api.withGodRng(() => api.outgrown());
  assert.equal(api.gods().length, before + 1);
  assert.equal(new Set(api.gods().map(g => g.contrast)).size, new Set(api.gods().slice(0, before).map(g => g.contrast)).size + 1);
});

test('the gate wants a hill and a cave, and the lacks strain above and below', () => {
  const api = load(); api.startCreation('r');
  api.step();
  const [a] = api.awakeGods(); const r = api.regionById(a.region);
  /* Build a world that passes every old item, then check the two new ones in order. */
  api.setPole(r, 'dry', a, ''); for (const n of api.neighboursOf(r)) api.setPole(n, 'wet', a, '');
  api.setPole(r, 'hot', a, '');
  api.mark(r, 'making', 'rabbit', a, ''); api.mark(r, 'making', 'human', a, '');
  const n0 = api.neighboursOf(r)[0];
  assert.equal(api.restGate().lack, 'height');
  api.mark(n0, 'height', 1, a, '');
  assert.equal(api.restGate().lack, 'depth');
  api.mark(n0, 'depth', 1, a, '');
  assert.equal(api.restGate().lack, 'hunter', 'rabbit is prey; hunter is still missing');
  api.mark(n0, 'making', 'fox', a, '');
  assert.equal(api.restGate().lack, 'fae');
  api.mark(n0, 'making', 'sprite', a, '');
  /* The people are not the folk the gate wants: a second people, the gnomes, are the below god's. */
  assert.equal(api.restGate().lack, 'folk');
  api.mark(n0, 'making', 'gnome', a, '');
  assert.equal(api.restGate().ok, true);
  assert.deepEqual(api.STRAIN.height, ['above']); assert.deepEqual(api.STRAIN.depth, ['below']);
  assert.deepEqual(api.MAKES.below, ['gnome']); assert.ok(api.MAKES.light.includes('sprite'));
  assert.deepEqual(api.polesThatMake('folk'), ['below']);
  assert.deepEqual(api.polesThatMake('fae'), ['dark', 'light']);
  assert.deepEqual(api.MAKES.wet, ['deer']);
});

test('a lack of fae strains a pole that makes fae', () => {
  const api = load(); api.startCreation('r');
  api.step();
  api.withGodRng(() => api.strain('fae'));
  assert.ok(api.polesThatMake('fae').some(p => api.godOf(p)), 'no god of a fae-making pole after the strain');
});
