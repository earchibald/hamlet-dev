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

/* A fresh world with the name stream seeded. */
function world(seed = 'r'){ const api = load(); api.startWorld(seed); return api; }

test('the name stream is a second stream: the same seed gives the same tongue twice, and two seeds differ', () => {
  const a = world('r'), b = world('r'), c = world('x');
  const words = api => { const out = []; for (let k = 0; k < 20; k++) out.push(api.oldWord()); return out; };
  assert.deepEqual(words(b), words(a));
  assert.notDeepEqual(words(c), words(a));
});

test('a name is a record with every field the spec names, and the list keeps the old ones', () => {
  const api = world();
  const thing = {};
  api.giveName(thing, api.nameRecord('Reedwater', { why: 'for the reeds along the water', by: 7 }));
  assert.equal(api.nameOf(thing), 'Reedwater');
  const r = thing.names[0];
  assert.deepEqual(Object.keys(r).sort(), ['by', 'meaning', 'scores', 'since', 'text', 'tongue', 'why']);
  assert.equal(r.tongue, 'plain'); assert.equal(r.meaning, ''); assert.equal(r.by, 7);
  assert.equal(r.since, api.tick);
  api.giveName(thing, api.nameRecord('Ashford', { why: 'for the night the fire jumped the ford' }));
  assert.equal(api.nameOf(thing), 'Ashford');
  assert.deepEqual(api.formerNames(thing).map(x => x.text), ['Reedwater']);
  assert.equal(api.nameTaken('reedwater'), true, 'a former name is still taken');
  assert.equal(api.nameRecordOf('Reedwater').why, 'for the reeds along the water');
});

test('an old word is sayable: it never carries a forbidden pair, and it is one to three syllables', () => {
  const api = world();
  for (let k = 0; k < 400; k++){
    const w = api.oldWord().toLowerCase();
    assert.ok(w.length >= 2 && w.length <= 12, w);
    for (const [on, coda] of api.OLD_FORBID) assert.ok(!w.includes(on + coda), `${w} says ${on}${coda}`);
  }
});

/* The land is named at settle, so a fresh world has already spent some of the meanings.
   What is left plus what the land holds is the whole table, and each is used once. */
test('every meaning is used once, and a name with no meaning left is not given', () => {
  const api = world();
  const taken = api.nameThings().flatMap(t => (t.names || []).map(r => r.meaning)).filter(Boolean);
  assert.ok(taken.length > 0, 'the land was named with no meanings at all');
  for (let k = taken.length; k < api.LAND_WORDS.length; k++){ const r = api.newOldName(); assert.ok(r, `ran out after ${k}`); taken.push(r.meaning); }
  assert.equal(new Set(taken).size, taken.length, 'a meaning was used twice');
  assert.equal(taken.length, api.LAND_WORDS.length);
  assert.equal(api.newOldName(), null, 'with no meaning left there is no name');
});

/* The old names on the land. `nameTheLand` runs at the end of a final settle, so a fresh
   world already carries them. The great water is a river where a wet god drew one, and a
   lake where none did: of the six soak seeds only alpha has a painted river. */
test('every world gets the lore of a lost people: what they built, what took them, a sky, and the sprites', () => {
  const api = world();
  const m = api.lore;
  assert.match(m.people, /^the \w+$/);
  assert.ok(api.LORE_BUILT.includes(m.built)); assert.ok(api.LORE_TOOK.includes(m.took));
  assert.ok(api.SKY_MEANINGS.includes(m.sky.meaning)); assert.ok(api.SPRITE_MEANINGS.includes(m.sprites.meaning));
  assert.ok(m.sky.text.length > 1 && m.sprites.text.length > 1);
  const again = world();
  assert.deepEqual(again.lore, m, 'the same seed tells the same lore');
});

test('every hill, cave, and grove carries an old name with a meaning, and no meaning is used twice', () => {
  for (const seed of SEEDS){
    const api = world(seed);
    const things = [...api.hills, ...api.caves.filter(c => api.OLD_CAVE_KINDS.includes(c.kind)), ...api.groves];
    const seen = new Set();
    for (const t of things){
      const r = t.names && t.names[0];
      assert.ok(r, `${seed}: something on the land has no old name`);
      assert.equal(r.tongue, 'old'); assert.ok(r.meaning, `${r.text} means nothing`);
      assert.equal(seen.has(r.meaning), false, `${seed}: ${r.meaning} twice`);
      seen.add(r.meaning);
      assert.equal(t.nameKnown, false, 'an old name starts unknown');
    }
    const big = api.river || api.stillWater;
    assert.ok(big, `${seed}: the valley has no water at all`);
    assert.ok(api.nameOf(big), `${seed}: the water has no name`);
    assert.equal(seen.has(big.names[0].meaning), false, `${seed}: the water shares a meaning`);
    assert.ok(api.ponds.length >= 1, `${seed}: no ponds found`);
    assert.ok(api.ponds.every(p => !api.nameOf(p)), 'ponds wait for the living');
    assert.equal(api.nameOf(api.valley), null, 'the valley waits for the living');
  }
});

test('a painted river carries fords, and a valley with no painted river carries a lake and none', () => {
  const alpha = world('alpha');
  assert.ok(alpha.river, 'alpha has a painted river');
  assert.equal(alpha.river.kind, 'river');
  assert.equal(alpha.stillWater, null, 'a valley with a river needs no lake');
  assert.ok(alpha.fords.length >= 1, 'alpha has at least one ford');
  assert.ok(alpha.fords.filter(f => alpha.nameOf(f)).length >= 1, 'no ford was named');
  const r = world('r');
  assert.equal(r.river, null, 'seed r has no painted river');
  assert.equal(r.fords.length, 0, 'no river, no fords');
  assert.equal(r.stillWater.kind, 'lake', 'the largest body is the lake');
  assert.ok(r.stillWater.tiles.length > 12, 'the lake is bigger than a pond');
});

test('no two things in a world share a name', () => {
  for (const seed of SEEDS){
    const api = world(seed);
    const texts = api.nameThings().flatMap(t => (t.names || []).map(r => r.text.toLowerCase()));
    assert.equal(new Set(texts).size, texts.length, `${seed}: a name is used twice`);
  }
});

test('standing on a hill learns its old name once, and the line says what it means', () => {
  const api = world();
  const h = api.hills[0], t = api.world[h.tiles[0]];
  const a = api.firstPerson();
  a.x = t.x; a.y = t.y; a.z = 0;
  api.learnNamesHere(a);
  assert.equal(h.nameKnown, true);
  const line = api.chronicle.find(l => l.text.includes(api.nameOf(h)));
  assert.ok(line, 'the chronicle says nothing about the marks');
  assert.ok(line.text.includes(h.names[0].meaning), 'the line does not say what the name means');
  assert.equal(line.kind, 'info');
  const n = api.chronicle.length;
  api.learnNamesHere(a);
  assert.equal(api.chronicle.length, n, 'a learned name is learned once');
});

test('drawing water learns the name of the water, and a burrow keeps no old name', () => {
  const api = world();
  const big = api.stillWater;
  const wet = big.tiles.find(t => api.nearFind(t.x, t.y, q => q.ground !== 'water' && api.passable(q.x, q.y, 0)));
  const dry = api.nearFind(wet.x, wet.y, q => q.ground !== 'water' && api.passable(q.x, q.y, 0));
  const a = api.firstPerson();
  a.x = dry.x; a.y = dry.y; a.z = 0;
  api.learnNamesHere(a);
  assert.equal(big.nameKnown, true, 'the water is still unknown');
  for (const c of api.caves) if (c.kind === 'burrow') assert.equal(api.nameOf(c), null, 'a burrow carries no old name');
});

/* A camp that has kept its hearth three days, with a person standing at the site. */
function hearthCamp(seed = 'r'){
  const api = load(); api.startWorld(seed);
  const a = api.firstPerson(), c = api.camps[0]; api.camp = c;
  api.setSite(a.x, a.y);
  c.founder = a.id;
  const t = api.tileAt(...c.site); t.feature = null; t.struct = { type: 'firepit', fuel: 300, lit: true }; c.pit = [t.x, t.y];
  c.everLit = true; c.bestStreak = 3 * api.DAY;
  a.x = c.stashTile[0]; a.y = c.stashTile[1]; a.z = 0; a.homeless = false; a.asleep = false;
  return { api, a, c };
}

test('the camp takes the founder\'s name when the site is chosen, with a reason', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(), c = api.camps[0]; api.camp = c;
  assert.ok(api.chooseSite(a), 'no site');
  assert.equal(c.name, `${a.name}'s camp`);
  assert.equal(api.nameOf(c), c.name);
  assert.equal(c.names[0].why, `the camp ${a.name} made`);
  assert.equal(c.names[0].by, a.id);
  assert.equal(c.founder, a.id);
});

test('a hearth that has burned three days gets the camp a plain name, kept with its scores', () => {
  const { api, a, c } = hearthCamp();
  api.nameCampAtHearth(c);
  assert.ok(c.namedAt, 'the camp was not named');
  const r = c.names[0];
  assert.equal(c.name, r.text);
  assert.equal(r.by, a.id);
  assert.ok(r.why, 'a name needs a reason');
  assert.ok(r.scores && r.scores.length >= 2, 'the candidate list is kept');
  assert.ok(r.scores[0].score >= r.scores[1].score, 'scores are sorted, top first');
  assert.ok(api.chronicle.some(e => e.text.includes(`call this place ${r.text}`)), api.chronicle[0].text);
  assert.deepEqual(api.formerNames(c).map(x => x.text), [`${a.name}'s camp`]);
  const n = api.chronicle.length; api.nameCampAtHearth(c);
  assert.equal(api.chronicle.length, n, 'a camp is named once at the hearth');
});

test('a name already used anywhere in the world scores zero', () => {
  const { api, a, c } = hearthCamp();
  const cands = api.candidatesFor('camp', a, c.site);
  assert.ok(cands.length >= 3, 'the axes gave candidates');
  api.giveName({}, api.nameRecord(cands[0].text, {}));
  const scored = api.scoreCandidates(api.candidatesFor('camp', a, c.site), a, c);
  assert.equal(scored.find(x => x.text === cands[0].text).score, 0);
});

test('a trait bends its axis from 0.7 to 1.3, and no other', () => {
  const { api, a } = hearthCamp();
  a.traits.patience = 0; assert.equal(Math.round(api.axisMult('land', a) * 100) / 100, 0.7);
  a.traits.patience = 1; assert.equal(Math.round(api.axisMult('land', a) * 100) / 100, 1.3);
  a.traits.curiosity = 1; a.traits.patience = 0.5;
  assert.equal(Math.round(api.axisMult('old', a) * 100) / 100, 1.3);
  assert.equal(Math.round(api.axisMult('lore', a) * 100) / 100, 1.3);
  assert.equal(api.axisMult('work', a), 1, 'the work axis is not a trait axis');
});

test('every camp line reads without "The first camp"', () => {
  const { events } = runDays('r', 12);
  assert.equal(events.filter(e => e.text.includes('The first camp')).length, 0);
});
