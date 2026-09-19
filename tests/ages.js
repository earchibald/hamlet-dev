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

/* Every age's gesture count, and every gesture, as the creation runs. The list is replaced at the head
   of each age, so it is read after each step or it is gone. */
function creationOf(seed){
  const api = load(); api.startCreation(seed);
  const t0 = Date.now();
  const perAge = [], gestures = [];
  const max = api.options.ageLimit * 2 + 2;
  for (let n = 0; api.era === 'gods' && n < max; n++){ api.step(); perAge.push(api.creation.gestures.length); for (const rec of api.creation.gestures) gestures.push(rec); }
  const ms = Date.now() - t0;
  const gs = api.gods();
  const contrasts = Object.keys(api.CONTRASTS).filter(c => gs.some(g => g.contrast === c));
  const species = new Set(); for (const r of api.liveRegions()) for (const m of api.marksOf(r, 'making')) species.add(m.value);
  const scars = api.liveRegions().filter(r => api.marksOf(r, 'scar').length).length;
  return { api, ms, gs, contrasts, species: [...species].sort(), scars, perAge, gestures };
}

/* The gate for Become: a creation the player drove, turn by turn, is the creation startWorld runs
   alone. The player takes the top row of the matrix every time a turn opens, which is what the
   engine's own chooser takes, so every age suspends at the player's god and resumes through the
   door. Force Actions is on, because a bar is a lens on the matrix and not a rule: with it off a
   barred top row could not be taken, and the player could not follow the engine.
   Returns the api and how many turns the player took, so a run that opened none fails. */
function steeredOf(seed){
  const api = load(); api.startCreation(seed, { force: true });
  api.step();
  const first = api.awakeGods()[0];
  assert.equal(api.inject({ source: 'player', act: 'become', id: first.id }),
    `You are ${first.name}, ${first.epithet}.`, 'the first god that wakes is taken');
  let turns = 0;
  const max = (api.options.ageLimit * 2 + 2) * 20;
  for (let n = 0; api.era === 'gods' && n < max; n++){
    if (api.pending){
      /* The top row that has not already been refused by the ground. The autonomous god falls down
         its own matrix the same way, in the same order. */
      const row = api.pending.opts.find(o => !o.failed);
      if (row){
        turns++;
        const msg = api.inject({ source: 'player', act: 'choose', id: api.pending.god, opt: { type: row.type, region: row.region } });
        assert.match(msg, /^You \w+\. .+ acts\.$|^The ground refuses it\./, `seed ${seed}: ${msg}`);
        continue;
      }
      /* Nothing on the table can land. Hand the god back and let it fall through the same failures. */
      api.inject({ source: 'player', act: 'become', id: null });
      api.step();
      continue;
    }
    const me = api.inhabited && api.beingById(api.inhabited.id);
    if ((!me || me.status !== 'awake') && api.awakeGods().length){
      const g = api.awakeGods()[0];
      assert.equal(api.inject({ source: 'player', act: 'become', id: g.id }), `You are ${g.name}, ${g.epithet}.`);
    }
    api.step();
  }
  return { api, turns };
}

const rows = [];
/* The work one creation may cost. Measured over the 24 seeds: 14 to 31 ages and 0 to 4 discards, with
   6 discards over all of them. Each cap is about twice the measured worst, and the age cap is far under
   the 200-age backstop, so a rule that makes a creation grind fails here before the backstop hides it. */
const AGE_CAP = 60, SUM_DISCARDS = 24;
const work = { ages: 0, discards: 0, gestures: 0 };
/* The gesture record, counted across every seed. The design claims every act writes a usable mark, so
   the fallback to the heart of a country should never fire; and it sets no cap on the gestures in one
   age until there is a real number to set it against. These two tables are that number. */
const fallbacks = {}, ages = {}, kinds = {};
for (const seed of SEEDS){
  test(`seed ${seed}: the ages end`, t => {
    const { api, ms, gs, contrasts, species, scars, perAge, gestures } = creationOf(seed);
    for (const k in api.gestureFallbacks) fallbacks[k] = (fallbacks[k] || 0) + api.gestureFallbacks[k];
    for (const n of perAge) ages[n] = (ages[n] || 0) + 1;
    for (const rec of gestures) kinds[rec.kind] = (kinds[rec.kind] || 0) + 1;
    const c = api.creation;
    work.ages += c.ages; work.discards += c.discards; work.gestures += gestures.length;
    const line = `${seed.padEnd(14)} ages ${String(c.ages).padStart(3)}  gods ${gs.length}  asleep ${gs.filter(g => g.status === 'asleep').length}  dead ${gs.filter(g => g.status === 'dead').length}  regions ${api.liveRegions().length}  scars ${scars}  backstops ${c.backstops}  discards ${c.discards}  gestures ${String(gestures.length).padStart(3)}  ${ms} ms  contrasts ${contrasts.join(',')}  made ${species.join(',')}`;
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
    /* What a creation costs, counted in work, not in time. The clock reading above is a diagnostic:
       it moved with the machine and went red when a neighbouring test run was busy. Two numbers
       carry the cost instead. An age is one step of the gods. A discard repaints the whole world,
       so it costs about as much as the ages before it; gamma, the slowest seed, takes four. Both
       caps sit well above every measured seed and well under the backstop, so a creation that
       grinds goes red on any machine. */
    assert.ok(c.ages <= AGE_CAP, `${c.ages} ages is too much work for a creation`);
    assert.ok(c.discards < api.MAX_DISCARDS, `${c.discards} discards: the world was repainted too often`);
    if (SOAK_SEEDS.includes(seed)) assert.equal(c.backstops, 0, 'the backstop fired on a soak seed');
    assert.ok(api.liveRegions().some(r => api.marksOf(r, 'height').length), 'nothing raised');
    assert.ok(api.liveRegions().some(r => api.marksOf(r, 'depth').length), 'nothing dug');
    /* Every kind of life, not every species: a valley with foxes and no wolves is a gentler valley, not a broken one. */
    for (const kind of api.KINDS) assert.ok(species.some(sp => api.SPECIES[sp][kind]), `seed ${seed} never made a ${kind}`);
  });

  test(`seed ${seed}: a creation the player drove is an unwatched one`, () => {
    const a = load(); a.startWorld(seed);
    const { api: b, turns } = steeredOf(seed);
    assert.ok(turns > 0, 'no turn ever opened: the age never suspended');
    assert.equal(b.era, 'days');
    assert.deepEqual(b.legends.map(e => e.text), a.legends.map(e => e.text));
    assert.equal(b.tick, a.tick);
    assert.equal(b.firstPerson().name, a.firstPerson().name);
  });
}

test('report', t => { for (const line of rows) t.diagnostic(line); });

test('the gesture record over every seed', t => {
  const acts = Object.keys(kinds).sort();
  t.diagnostic(`gestures by kind: ${acts.map(k => `${k} ${kinds[k]}`).join(', ')}`);
  const counts = Object.keys(ages).map(Number).sort((p, q) => p - q);
  t.diagnostic(`gestures in one age: ${counts.map(n => `${n} -> ${ages[n]} ages`).join(', ')}`);
  t.diagnostic(`the most in one age: ${counts[counts.length - 1]}`);
  const fell = Object.keys(fallbacks).sort();
  t.diagnostic(`anchor fallbacks: ${fell.length ? fell.map(k => `${k} ${fallbacks[k]}`).join(', ') : 'none'}`);
  /* The work over every seed. A per-seed cap misses a change that adds one discard to every seed, so
     the discards are capped across the seeds together as well. The sum is 6 today. */
  t.diagnostic(`work over ${SEEDS.length} seeds: ages ${work.ages}, discards ${work.discards}, gestures ${work.gestures}`);
  if (!process.env.SEEDS) assert.ok(work.discards <= SUM_DISCARDS, `${work.discards} discards over ${SEEDS.length} seeds (want <= ${SUM_DISCARDS})`);
  /* Every act in the table leaves a row, and every row is one of the kinds the design names. */
  const KNOWN = ['split', 'claim', 'make', 'raise', 'dig', 'flow', 'pool', 'burn', 'wash', 'battle', 'twist', 'mingle', 'sleep', 'born', 'unmade', 'backstop'];
  for (const k of acts) assert.ok(KNOWN.includes(k), `an unknown gesture kind: ${k}`);
  assert.ok(!counts.includes(0), 'an age passed with no gesture at all');
});
