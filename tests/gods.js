// The gods as mobs: coming into being, the first ages, the gate, and a creation that ends. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

/* The newest gesture of a kind in the age on record. The list is replaced at the head of each age. */
function last(api, kind){
  const rows = api.creation.gestures.filter(rec => rec.kind === kind);
  assert.ok(rows.length, `no ${kind} gesture was recorded`);
  return rows[rows.length - 1];
}

test('a creation opens the gods era with one formless region and no god', () => {
  const api = load(); api.startCreation('r');
  assert.equal(api.era, 'gods'); assert.equal(api.age, 0);
  assert.equal(api.liveRegions().length, 1);
  assert.equal(api.gods().length, 0);
  assert.deepEqual(api.legends, []);
  assert.deepEqual(api.creation, { ages: 0, backstops: 0, discards: 0, settled: false, failed: false, gate: null, made: {}, gestures: [], gestureAge: -1 });
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
  const rec = last(api, 'burn');
  assert.equal(rec.god, hot.id); assert.equal(rec.region, target.id);
  assert.ok(target.tiles.includes(rec.to), 'the burn ends outside the country it burned');
});

test('freeze, hide, and show write their own mark kinds', () => {
  const api = load(); api.startCreation('r');
  for (const [pole, act] of [['cold', 'freeze'], ['dark', 'hide'], ['light', 'show']]){
    const { g, r } = godWith(api, pole);
    api.withGodRng(() => { assert.ok(api.GOD_ACTS[act].apply(g, r)); });
    assert.ok(api.hasMark(r, act, true), `${act} left no mark`);
    /* The three of them wash a country over, so they share one gesture kind and differ by value. */
    const rec = last(api, 'wash');
    assert.equal(rec.value, act); assert.equal(rec.region, r.id);
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
  const rec = last(api, 'battle');
  assert.equal(rec.god, a.id); assert.equal(rec.other, b.id);
  assert.equal(rec.winner, winner.id); assert.equal(rec.loser, loser.id);
  assert.equal(rec.scar, api.SCAR_OF[winner.pole]);
  assert.ok(target.tiles.includes(rec.to));
});

test('a twist needs a scar and a making', () => {
  const api = load(); api.startCreation('r');
  const { g, r } = godWith(api, 'hot');
  assert.equal(api.GOD_ACTS.twist.targets(g).length, 0);
  api.mark(r, 'scar', 'burned', g, ''); api.mark(r, 'making', 'rabbit', g, '');
  assert.ok(api.GOD_ACTS.twist.targets(g).includes(r));
  api.withGodRng(() => { assert.ok(api.GOD_ACTS.twist.apply(g, r)); });
  assert.ok(api.hasMark(r, 'twist', 'rabbit'));
  const rec = last(api, 'twist');
  assert.equal(rec.species, 'rabbit'); assert.equal(rec.region, r.id);
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
  const rec = last(api, 'unmade');
  assert.equal(rec.god, b.id); assert.equal(rec.from, rec.to, 'an unmade god walks');
  assert.equal(rec.weighed, null);
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
  api.setPole(r, 'dry', a, '');
  /* The neighbour is the water and the fuel both: a flow mark reads as water, and dry cold ground is forest. */
  for (const n of api.neighboursOf(r)){ api.setPole(n, 'dry', a, ''); api.setPole(n, 'cold', a, ''); api.mark(n, 'flow', 'surface', a, ''); }
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

/* ---------- the gesture record ----------
   A gesture is what an act looked like. No rule reads one, so these tests watch the record itself:
   that it is plain, that it holds one row an act, and that a god's anchor moves only when it should. */

/* Step a creation age by age and keep every gesture, with the age it belonged to. */
function gesturesOf(seed, api = load()){
  api.startCreation(seed);
  const all = [];
  let guard = 0;
  while (api.era === 'gods' && guard++ < api.options.ageLimit * 2 + 2){
    api.step();
    assert.equal(api.creation.gestureAge, api.age, 'the gesture age is not this age');
    for (const r of api.creation.gestures) all.push(r);
  }
  return { api, all };
}

test('every gesture is plain data, and survives a round trip through JSON', () => {
  for (const seed of ['r', 'x', 'alpha']){
    const { all } = gesturesOf(seed);
    assert.ok(all.length > 5, `${seed} recorded only ${all.length} gestures`);
    assert.deepEqual(JSON.parse(JSON.stringify(all)), all, `${seed} lost something in a round trip`);
    for (const rec of all){
      assert.equal(typeof rec.kind, 'string'); assert.equal(typeof rec.god, 'number'); assert.equal(typeof rec.age, 'number');
      assert.ok(rec.to === null || typeof rec.to === 'number');
      assert.ok(rec.from === null || typeof rec.from === 'number');
      assert.ok(rec.said === null || typeof rec.said === 'number');
      for (const k in rec){
        const v = rec[k];
        if (k === 'weighed' && v) { assert.ok(Array.isArray(v.opts)); continue; }
        if (Array.isArray(v)){ for (const n of v) assert.equal(typeof n, 'number', `${rec.kind}.${k} holds something that is not a number`); continue; }
        assert.ok(v === null || typeof v !== 'object', `${rec.kind}.${k} points at an object`);
      }
    }
  }
});

test('a gesture names a god, an age, and a line that exists', () => {
  const { api, all } = gesturesOf('r');
  for (const rec of all){
    assert.ok(api.beings.some(b => b.id === rec.god), `gesture ${rec.kind} names no god`);
    assert.ok(rec.age >= 1 && rec.age <= api.creation.ages);
    if (rec.said !== null) assert.ok(api.legends[rec.said], `gesture ${rec.kind} names legend ${rec.said}, which is not there`);
  }
});

test('one gesture an act: every god that acted in an age left exactly one row', () => {
  const api = load(); api.startCreation('x');
  let guard = 0;
  while (api.era === 'gods' && guard++ < api.options.ageLimit * 2 + 2){
    const before = new Map(api.gods().map(g => [g.id, g.acted]));
    api.step();
    for (const g of api.gods()){
      if (!before.has(g.id)) continue;
      const acted = g.acted - before.get(g.id);
      const rows = api.creation.gestures.filter(rec => rec.god === g.id && rec.kind !== 'born' && rec.kind !== 'unmade' && rec.kind !== 'backstop');
      if (acted) assert.equal(rows.length, 1, `${g.name} acted and left ${rows.length} gestures in age ${api.age}`);
    }
    /* A god born in this age leaves one birth row, and nothing is born twice. */
    const born = api.creation.gestures.filter(rec => rec.kind === 'born');
    assert.equal(new Set(born.map(rec => rec.god)).size, born.length);
  }
});

test('a continuing task carries no decision, and an act that was decided carries one', () => {
  const { all } = gesturesOf('alpha');
  let carried = 0, stepped = 0;
  for (const rec of all){
    if (rec.kind === 'born' || rec.kind === 'unmade' || rec.kind === 'backstop'){ assert.equal(rec.weighed, null, `${rec.kind} carries a decision`); continue; }
    if ((rec.kind === 'raise' || rec.kind === 'dig') && rec.step > 1){ assert.equal(rec.weighed, null, 'a task carried on from an earlier age carries a decision'); stepped++; continue; }
    assert.ok(rec.weighed, `${rec.kind} was decided this age and carries no decision`);
    assert.ok(rec.weighed.opts.length <= 3);
    assert.ok(typeof rec.weighed.picked === 'string');
    carried++;
  }
  assert.ok(carried > 0 && stepped > 0, `${carried} decided, ${stepped} carried on`);
});

test('a born god fades in where it stands, and nothing walks to get there', () => {
  const { api, all } = gesturesOf('r');
  const born = all.filter(rec => rec.kind === 'born');
  assert.ok(born.length >= 2);
  for (const rec of born){
    assert.equal(rec.from, null, 'a birth walks');
    const r = api.regionById(rec.region);
    assert.ok(r, 'a birth names no country');
    assert.ok(r.tiles.includes(rec.to), 'a god is born outside the country it holds');
  }
});

test('an anchor moves only when its god acted, or when its tile left its country', () => {
  const api = load(); api.startCreation('beta');
  let guard = 0;
  while (api.era === 'gods' && guard++ < api.options.ageLimit * 2 + 2){
    const before = new Map(api.gods().map(g => [g.id, g.at]));
    api.step();
    if (api.era !== 'gods') break;
    for (const g of api.gods()){
      if (!before.has(g.id) || g.at === before.get(g.id)) continue;
      const moved = api.creation.gestures.some(rec => rec.god === g.id);
      const left = g.region !== null && !api.regionById(g.region).tiles.includes(before.get(g.id));
      assert.ok(moved || left, `${g.name} moved in age ${api.age} without acting, and its tile had not left its country`);
    }
  }
});

test('the cut keeps its own order, and the gesture sorts a copy', () => {
  const { api, all } = gesturesOf('r');
  /* boundary.tiles is state: paintRivers places a ford by the index along it. It must stay as splitRegion built it. */
  for (const b of api.boundaries){
    for (let k = 1; k < b.tiles.length; k++) assert.ok(b.tiles[k] > b.tiles[k - 1], `boundary ${b.id} is out of ascending order at ${k}`);
  }
  const splits = all.filter(rec => rec.kind === 'split');
  assert.ok(splits.length >= 2);
  let reordered = 0;
  for (const rec of splits){
    const b = api.boundaries.find(q => q.a === rec.near && q.b === rec.far);
    assert.ok(b, 'a split gesture names no boundary');
    assert.deepEqual(rec.line.slice().sort((p, q) => p - q), b.tiles.slice(), 'the line holds other tiles than the cut');
    assert.ok(rec.line.includes(rec.to), 'a split ends off its own line');
    if (rec.line.some((i, k) => i !== b.tiles[k])) reordered++;
  }
  assert.ok(reordered > 0, 'no split gesture reordered its line, so the sort proves nothing');
});

test('the heart of a region is the tile nearest the mean, and a tie goes to the lowest index', () => {
  const api = load(); api.startWorld('r');
  api.initField();
  const root = api.field.root;
  const h = api.heartTile(root);
  const x = h % api.W, y = Math.floor(h / api.W);
  /* The root is the whole map, so its mean is the middle of it. */
  assert.ok(Math.abs(x - (api.W - 1) / 2) <= 1 && Math.abs(y - (api.H - 1) / 2) <= 1, `the heart of the whole map is ${x},${y}`);
  /* A hand-made region of four tiles around a point: every one is the same distance, so the lowest index wins. */
  const fake = { tiles: [0, 1, api.W, api.W + 1] };
  assert.equal(api.heartTile(fake), 0);
  assert.equal(api.heartTile({ tiles: [] }), null);
  assert.equal(api.heartTile(null), null);
  const one = { tiles: [4242] };
  assert.equal(api.heartTile(one), 4242);
});

test('the line is sorted along its wider axis, and the cut itself is untouched', () => {
  const api = load(); api.startWorld('r');
  api.initField();
  const cut = api.withGodRng(() => api.splitRegion(api.field.root, { id: 901, pole: 'hot', traits: { patience: 0 } }));
  const kept = cut.boundary.tiles.slice();
  const line = api.sortLine(cut.boundary.tiles);
  assert.deepEqual(cut.boundary.tiles, kept, 'sortLine changed the list it was given');
  /* The cut runs down the map, so the line is ordered by row. */
  const ys = line.map(i => Math.floor(i / api.W));
  for (let k = 1; k < ys.length; k++) assert.ok(ys[k] >= ys[k - 1], `the line goes back up the map at ${k}`);
  assert.deepEqual(line.slice().sort((p, q) => p - q), kept.slice().sort((p, q) => p - q));
});

test('the wearied god leaves a gesture like any other act', () => {
  /* A short age limit forces the backstop, which marks the field itself. */
  const api = load(); api.startCreation('r', { ageLimit: 3 });
  let rec = null, guard = 0;
  while (api.era === 'gods' && guard++ < 20){
    api.step();
    const rows = api.creation.gestures.filter(q => q.kind === 'backstop');
    if (rows.length) { rec = rows[rows.length - 1]; break; }
  }
  assert.ok(rec, 'the backstop left no gesture');
  assert.ok(api.creation.backstops > 0);
  assert.ok(api.gods().some(g => g.id === rec.god), 'the backstop names no god');
  assert.equal(typeof rec.lack, 'string');
  assert.equal(rec.weighed, null, 'the backstop is not a decision');
  assert.ok(api.regionById(rec.region).tiles.includes(rec.to));
});
