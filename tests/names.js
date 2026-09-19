// Names: the record, the tongue, the namer, and the guard on the layout. Fast.
//   node tests/names.js                    the fast checks
//   SLOW=1 node tests/names.js             also the six 70-day layout runs, about 90 seconds
//   UPDATE_LAYOUT=1 node tests/names.js    write the baseline. Run once, before any naming work.
//
// tests/names-layout.json is the frozen record of the land, the beings, and the items
// as they stood before the naming work. Naming adds chronicle lines and nothing else,
// so those three hashes must never move. Do not bless this file a second time.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('../src/sim');
const { runDays, fingerprint } = require('./lib/run');

const SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];
const LAYOUT = path.join(__dirname, 'names-layout.json');
const GOLDEN = path.join(__dirname, 'soak-golden.json');

function fnv(s){ let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
/* Three hashes at tick 0: every tile of every level, then the beings, then the items. */
function layoutOf(api){
  const cells = [];
  for (let z = api.ZMIN; z <= api.ZMAX; z++) for (let i = 0; i < api.W * api.H; i++){
    const t = api.levels[z + api.ZOFF][i];
    cells.push(t ? `${t.x},${t.y},${t.z}|${t.ground}|${t.feature || ''}|${t.slope ? 1 : 0}|${t.berries}` : '');
  }
  return {
    world: fnv(cells.join('\n')),
    beings: fnv(api.beings.map(b => `${b.id}|${b.species}|${b.alive ? 1 : 0}|${b.x},${b.y},${b.z}|${b.camp ? b.camp.id : ''}`).join('\n')),
    items: fnv(api.items.map(i => `${i.id}|${i.kind}|${i.x},${i.y},${i.z}`).join('\n')),
  };
}
function tick0(seed){ const api = load(); api.startWorld(seed); return layoutOf(api); }

if (process.env.UPDATE_LAYOUT){
  const g = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const out = {};
  for (const seed of SEEDS) out[seed] = { tick0: tick0(seed), day70: { beings: g[seed].beings, items: g[seed].items } };
  fs.writeFileSync(LAYOUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${LAYOUT}`);
}
const layout = JSON.parse(fs.readFileSync(LAYOUT, 'utf8'));

test('the world, the beings, and the items at tick 0 match the baseline on every seed', () => {
  for (const seed of SEEDS) assert.deepEqual(tick0(seed), layout[seed].tick0, `seed ${seed} moved at tick 0`);
});

test('the golden record still holds the baseline beings and items at day 70', () => {
  const g = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  for (const seed of SEEDS){
    assert.equal(g[seed].beings, layout[seed].day70.beings, `seed ${seed}: the blessed beings hash moved`);
    assert.equal(g[seed].items, layout[seed].day70.items, `seed ${seed}: the blessed items hash moved`);
  }
});

test('a 70-day run still ends with the baseline beings and items', { skip: !process.env.SLOW && 'set SLOW=1 to run the six 70-day runs' }, () => {
  for (const seed of SEEDS){
    const { api, events } = runDays(seed, 70);
    const fp = fingerprint(api, events);
    assert.equal(fp.beings, layout[seed].day70.beings, `seed ${seed}: beings moved by day 70`);
    assert.equal(fp.items, layout[seed].day70.items, `seed ${seed}: items moved by day 70`);
  }
});
