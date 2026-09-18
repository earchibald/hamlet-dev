// The ages: many seeds run to settle, fast, with a report. This is the tuning tool for the grammar.
//   node tests/ages.js                 24 seeds
//   SEEDS=r,x node tests/ages.js       a few
//   VERBOSE=1 SEEDS=r node tests/ages.js   print the legends
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

const SOAK_SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];
const MORE = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'moss-marsh-1', 'ash', 'reed', 'stone', 'pine', 'ford'];
const SEEDS = process.env.SEEDS ? process.env.SEEDS.split(',') : [...SOAK_SEEDS, ...MORE];

function creationOf(seed){
  const api = load(); api.startCreation(seed);
  const t0 = Date.now(); api.runAges(); const ms = Date.now() - t0;
  const gs = api.gods();
  const contrasts = Object.keys(api.CONTRASTS).filter(c => gs.some(g => g.contrast === c));
  const species = new Set(); for (const r of api.liveRegions()) for (const m of api.marksOf(r, 'making')) species.add(m.value);
  const scars = api.liveRegions().filter(r => api.marksOf(r, 'scar').length).length;
  return { api, ms, gs, contrasts, species: [...species].sort(), scars };
}

const rows = [];
for (const seed of SEEDS){
  test(`seed ${seed}: the ages end`, t => {
    const { api, ms, gs, contrasts, species, scars } = creationOf(seed);
    const c = api.creation;
    const line = `${seed.padEnd(14)} ages ${String(c.ages).padStart(3)}  gods ${gs.length}  asleep ${gs.filter(g => g.status === 'asleep').length}  dead ${gs.filter(g => g.status === 'dead').length}  regions ${api.liveRegions().length}  scars ${scars}  backstops ${c.backstops}  ${ms} ms  contrasts ${contrasts.join(',')}  made ${species.join(',')}`;
    rows.push(line); t.diagnostic(line);
    if (process.env.VERBOSE) for (const e of api.legends) t.diagnostic(`${e.when}: ${e.text}`);
    assert.equal(api.era, 'days', 'the era never flipped');
    assert.equal(c.settled, true); assert.equal(c.failed, false, 'the creation failed at twice the limit');
    if (SOAK_SEEDS.includes(seed)) assert.ok(c.ages <= api.options.ageLimit, `${c.ages} ages is past the limit`);
    else assert.ok(c.ages <= 2 * api.options.ageLimit, `${c.ages} ages: the backstop did not finish it`);
    assert.equal(c.gate.ok, true, `the gate is shut: ${c.gate.lack}`);
    for (const g of gs) assert.ok(g.status === 'asleep' || g.status === 'dead', `${g.name} is ${g.status}`);
    for (const g of gs) assert.ok(api.legends.some(e => e.text.includes(g.name)), `${g.name} never appears in the legends`);
    assert.ok(species.includes('human'), 'no people');
    assert.ok(species.some(sp => api.SPECIES[sp].prey), 'nothing to eat');
    assert.ok(api.legends.length >= 5);
    assert.ok(ms < 3000, `${ms} ms is too slow for a creation`);
    if (SOAK_SEEDS.includes(seed)) assert.equal(c.backstops, 0, 'the backstop fired on a soak seed');
    assert.ok(api.liveRegions().some(r => api.marksOf(r, 'height').length), 'nothing raised');
    assert.ok(api.liveRegions().some(r => api.marksOf(r, 'depth').length), 'nothing dug');
    /* Every kind of life, not every species: a valley with foxes and no wolves is a gentler valley, not a broken one. */
    for (const kind of api.KINDS) assert.ok(species.some(sp => api.SPECIES[sp][kind]), `seed ${seed} never made a ${kind}`);
    assert.ok(species.includes('human'), 'no people');
  });
}

test('report', t => { for (const line of rows) t.diagnostic(line); });
