// Names: the record, the tongue, the namer, and the guard on the layout. Fast.
//   node --test tests/names.js                    the fast checks
//   SLOW=1 node --test tests/names.js             also the six 70-day layout runs, about 90 seconds
//   UPDATE_LAYOUT=1 node --test tests/names.js    write the baseline. Run once, before any naming work.
//
// tests/names-layout.json is the frozen record of the land, the beings, and the items
// as they stood before the naming work. Naming adds chronicle lines and nothing else,
// so those three hashes must never move. Do not bless this file a second time.
//
// UPDATE_LAYOUT measures day 70 with six real runs and then exits, so a bless can never be
// read as a passing suite. It once copied day 70 out of the golden record, which made the
// unskipped check below compare the golden against itself.
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
  const out = {};
  for (const seed of SEEDS){
    const { api, events } = runDays(seed, 70);
    const fp = fingerprint(api, events);
    out[seed] = { tick0: tick0(seed), day70: { beings: fp.beings, items: fp.items } };
  }
  fs.writeFileSync(LAYOUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${LAYOUT}`);
  process.exit(0);
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
    assert.ok(things.length >= 3, `${seed}: only ${things.length} landmarks, so the loop below proves nothing`);
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

test('a meaning is never offered to a kind it does not suit', () => {
  const api = world();
  for (const w of api.LAND_WORDS) assert.ok(api.LAND_WORD_KINDS[w] && api.LAND_WORD_KINDS[w].length, `${w} has no kinds`);
  for (const kind of ['water', 'hill', 'cave', 'grove', 'ford']){
    for (let k = 0; k < 60; k++){
      const r = api.newOldName('test', kind);
      if (!r) break;
      assert.ok(api.LAND_WORD_KINDS[r.meaning].includes(kind), `${r.meaning} does not suit ${kind}`);
    }
  }
});

test('every kind can still name as many things as the heaviest seed asks of it', () => {
  /* hill is derived here, from the six soak seeds' own hill counts, because the helpers this
     file already has (SEEDS, world()) give it directly. The other four come from the day-1
     measurement in design/land-word-kinds.md (cave 10, grove 8, ford 1, water 9); that count is not a
     landmark this file exposes a getter for, so it is not re-derived here (task 1 review, finding 2). */
  const heaviestHills = Math.max(...SEEDS.map(seed => world(seed).hills.length));
  const DEMAND = { water: 9, hill: heaviestHills, cave: 10, grove: 8, ford: 1 };
  for (const kind in DEMAND){
    const api = world();
    let named = 0;
    for (let k = 0; k < DEMAND[kind]; k++){ if (api.newOldName('test', kind)) named++; }
    assert.equal(named, DEMAND[kind], `${kind}: only named ${named} of ${DEMAND[kind]} asked for`);
  }
});

test('the six soak seeds all still name their land', () => {
  for (const seed of SEEDS){
    const api = world(seed);
    const big = api.river || api.stillWater;
    assert.ok(big && api.nameOf(big), `${seed}: the water has no name`);
  }
});

/* Minor 20: `LAND_WORDS` holds forty meanings, and a landmark with no meaning left keeps no old
   name at all. A bigger world has more landmarks. This is the alarm for the day one runs out. */
test('a bigger world still has a meaning for every landmark', () => {
  for (const seed of ['r', 'alpha', 'beta']){
    const api = load(); api.startWorld(seed, { sw: 12, sh: 8 });
    const things = [...api.hills, ...api.caves.filter(c => api.OLD_CAVE_KINDS.includes(c.kind)), ...api.groves];
    assert.ok(things.length >= 15, `${seed}: only ${things.length} landmarks on a big world`);
    const unnamed = things.filter(t => !api.nameOf(t));
    assert.equal(unnamed.length, 0, `${seed}: ${unnamed.length} of ${things.length} landmarks got no old name; LAND_WORDS holds ${api.LAND_WORDS.length}`);
    assert.ok(things.length <= api.LAND_WORDS.length, `${seed}: ${things.length} landmarks against ${api.LAND_WORDS.length} meanings, with no room left`);
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
    assert.ok(texts.length >= 5, `${seed}: only ${texts.length} names, so no clash could show`);
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
  assert.ok(big && big.tiles.length > 0, 'seed r has no still water to stand beside');
  const wet = big.tiles.find(t => api.nearFind(t.x, t.y, q => q.ground !== 'water' && api.passable(q.x, q.y, 0)));
  assert.ok(wet, 'no water tile with dry ground beside it');
  const dry = api.nearFind(wet.x, wet.y, q => q.ground !== 'water' && api.passable(q.x, q.y, 0));
  const a = api.firstPerson();
  a.x = dry.x; a.y = dry.y; a.z = 0;
  api.learnNamesHere(a);
  assert.equal(big.nameKnown, true, 'the water is still unknown');
  const burrows = api.caves.filter(c => c.kind === 'burrow');
  assert.ok(burrows.length > 0, 'seed r dug no burrow, so the branch below proves nothing');
  for (const c of burrows) assert.equal(api.nameOf(c), null, 'a burrow carries no old name');
});

/* The other four branches of `learnNamesHere`: a cave, its mouth, a grove, and a ford. Each is
   reached by standing in the right place, and each writes the one line with the meaning in it. */
test('a cave, its mouth, a grove, and a ford each give up their old name to somebody standing there', () => {
  const api = world();
  const a = api.firstPerson();
  const stand = (x, y, z) => { a.x = x; a.y = y; a.z = z; api.learnNamesHere(a); };
  const cave = api.caves.find(c => api.OLD_CAVE_KINDS.includes(c.kind) && c.nameKnown === false && c.exit);
  assert.ok(cave, 'seed r has no unlearned cave with an exit');
  const mouthTile = api.world.find(t => t.mouth === cave);
  assert.ok(mouthTile, 'the cave has no mouth tile');
  stand(mouthTile.x, mouthTile.y, 0);
  assert.equal(cave.nameKnown, true, 'standing at the mouth read nothing');
  /* A grove is read from the ring around its hollow, never from the hollow tile itself. */
  const grove = api.groves.find(g => g.nameKnown === false);
  assert.ok(grove, 'seed r has no unlearned grove');
  stand(grove.x + 1, grove.y, 0);
  assert.equal(grove.nameKnown, true, 'standing beside the grove read nothing');
  const alpha = world('alpha');
  const ford = alpha.fords.find(f => f.nameKnown === false);
  assert.ok(ford, 'alpha has no unlearned ford');
  const b = alpha.firstPerson();
  b.x = ford.x; b.y = ford.y; b.z = 0;
  alpha.learnNamesHere(b);
  assert.equal(ford.nameKnown, true, 'standing at the crossing read nothing');
  const line = alpha.chronicle.find(l => l.text.includes(alpha.nameOf(ford)));
  assert.ok(line && line.text.includes('this crossing'), 'the ford line does not say what was read');
});

/* Every pond tile points back at its record, as every water tile points at the great water. */
test('a pond tile carries its pond, and a pond is smaller than the water', () => {
  const api = world();
  assert.ok(api.ponds.length >= 1, 'no pond on seed r');
  for (const p of api.ponds){
    assert.ok(p.tiles.length >= 1, 'a pond with no tiles');
    assert.ok(p.tiles.length <= 12, `a pond of ${p.tiles.length} tiles is a water`);
    for (const t of p.tiles) assert.equal(t.pond, p, 'a pond tile does not point at its pond');
  }
  for (const t of api.stillWater.tiles) assert.equal(t.water, api.stillWater, 'a water tile does not point at its water');
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

/* Minor 9: the name pool is recycled, so two living people can share a name. Two camps founded
   by two Ullas both read "Ulla's camp", and the index then answers for the second only. */
test('a second camp whose founder shares a name does not take the name the first camp holds', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  api.nameFoundersCamp(c, a);
  const held = api.nameOf(c);
  assert.equal(held, `${a.name}'s camp`);
  const c2 = api.makeCamp('The second camp');
  c2.site = c.site.slice();
  const twin = api.makeBeing('human', a.x, a.y, a.name, 0);
  twin.camp = c2; twin.homeless = false; twin.asleep = false; api.beings.push(twin);
  api.camp = c2;
  api.nameFoundersCamp(c2, twin);
  assert.equal(c2.founder, twin.id, 'the second camp still has its founder');
  assert.notEqual(api.nameOf(c2), held, 'two camps hold one name');
  assert.ok(api.nameOf(c2), 'the second camp has no name at all');
  assert.equal(api.nameRecordOf(held) && api.nameIndex.get(held.toLowerCase()), c, 'the index answers for the wrong camp');
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
  assert.ok(api.chronicle.some(e => api.CAMP_NAMED_LINES.some(f => e.text === f(r.text, r.why))), api.chronicle[0].text);
  assert.deepEqual(api.formerNames(c).map(x => x.text), [`${a.name}'s camp`]);
  const n = api.chronicle.length; api.nameCampAtHearth(c);
  assert.equal(api.chronicle.length, n, 'a camp is named once at the hearth');
});

/* Task 3 review, Important finding: the assertion above only checks that a drawn line is SOME
   member of CAMP_NAMED_LINES. It would still pass if the pool had collapsed to one line, or if
   an entry were dropped or duplicated, because a single draw can never see the rest of the pool.
   These two tests give it that sight: one calls every builder directly to prove all seven are
   distinct and sit at the index the pool has for them, the other drives real hearth-naming
   across the six soak seeds to prove the live draw actually varies, not just the table. */
test('every one of the seven camp-named lines is a distinct, reachable line', () => {
  const api = load();
  const built = api.CAMP_NAMED_LINES.map(f => f('Coldwater', 'the well went bad'));
  assert.equal(api.CAMP_NAMED_LINES.length, 7, 'the pool must hold seven lines');
  assert.equal(new Set(built).size, 7, 'two entries in the pool produce the same line');
  api.CAMP_NAMED_LINES.forEach((f, i) => {
    assert.equal(f('Coldwater', 'the well went bad'), built[i], `entry ${i} is not stable at its own index`);
  });
});

test('the six soak seeds do not all draw the same camp-named line', () => {
  /* Comparing the rendered chronicle text alone would pass even with the draw broken to
     always return index 0: two seeds give different camp names and reasons, so the same
     template still renders two different sentences. What must vary is the INDEX into the
     pool, so this looks up which entry produced the line, not the text it produced. */
  const indices = SEEDS.map(seed => {
    const { api, c } = hearthCamp(seed);
    api.nameCampAtHearth(c);
    const r = c.names[0];
    const line = api.chronicle.find(e => api.CAMP_NAMED_LINES.some(f => e.text === f(r.text, r.why)));
    assert.ok(line, `${seed}: no hearth-named line was logged`);
    return api.CAMP_NAMED_LINES.findIndex(f => f(r.text, r.why) === line.text);
  });
  assert.equal(indices.length, SEEDS.length, 'every seed should reach a hearth-named line');
  assert.ok(new Set(indices).size > 1, `all six seeds drew the same pool entry: index ${indices[0]}`);
});

test('a village keeps its name at sixty, and the line says it is a village now', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  api.nameCampAtHearth(c);
  const was = c.name;
  c.village = true;
  api.nameVillage(c);
  assert.equal(c.name, was, 'the name it has is worth 60, so it is kept');
  assert.equal(c.names.length, 2, 'no duplicate record for a kept name');
  assert.ok(api.chronicle.some(e => e.text === `${was} is a village now.`), api.chronicle[0].text);
  assert.ok(c.villageNamed);
  const n = api.chronicle.length; api.nameVillage(c);
  assert.equal(api.chronicle.length, n, 'a village is named once');
});

test('a village with fresh, strong events renames itself, and the reason is kept', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  api.nameCampAtHearth(c);
  const was = c.name;
  /* Fresh wolf nights pile recency on one event candidate until it beats sixty. */
  for (let k = 0; k < 6; k++) api.log(`A wolf comes out of the dark, night ${k}.`, [a], 'bad', 'wolf');
  a.traits.temper = 1;
  c.village = true;
  api.nameVillage(c);
  assert.notEqual(c.name, was, 'a strong event should win');
  assert.equal(api.formerNames(c)[0].text, was);
  assert.ok(c.names[0].why, 'a rename carries a reason');
  assert.ok(api.chronicle.some(e => e.text.includes(`is a village now. Its people call it ${c.name}`)), api.chronicle[0].text);
});

test('rename is the one door, and it keeps the old record', () => {
  const { api, c } = hearthCamp();
  api.rename(c, api.nameRecord('Coldwater', { why: 'the well went bad', by: null }));
  assert.equal(c.name, 'Coldwater');
  assert.equal(api.nameOf(c), 'Coldwater');
  assert.equal(api.formerNames(c).length, 1);
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

/* A text says one word twice when two of its words match, or when one word is a stem doubled:
   "the Water Water" and "Fordford". Both came out of the builders before the guard went in. */
function saysTwice(text){
  const words = text.toLowerCase().replace(/^the /, '').split(' ');
  if (new Set(words).size !== words.length) return true;
  return words.some(w => w.length % 2 === 0 && w.slice(0, w.length / 2) === w.slice(w.length / 2));
}

test('no name either builder makes says the same word twice', () => {
  const api = world();
  assert.equal(saysTwice('the Water Water'), true, 'the check must catch a doubled phrase');
  assert.equal(saysTwice('Fordford'), true, 'the check must catch a doubled join');
  assert.equal(saysTwice('Reedwater'), false, 'the check must pass a good name');
  const words = [...new Set([...Object.keys(api.WORD_TAIL), ...Object.keys(api.WORD_PHRASE), ...Object.values(api.WORK_WORDS)])];
  assert.ok(words.length >= 30, `only ${words.length} words in the tables`);
  const texts = api.landRows(words).map(r => r.text);
  for (const w of words) for (const r of api.workRows(w)) texts.push(r.text);
  assert.ok(texts.length >= 100, `the builders made only ${texts.length} names`);
  for (const t of texts) assert.equal(saysTwice(t), false, `${t} says one word twice`);
  /* The guard drops a row, never a word: a word with a doubling tail still has a phrase or a join
     with another word, and the work rows of a plain word are both still there. */
  assert.equal(api.workRows('snare').length, 2, 'a plain work word lost a row');
  assert.ok(texts.includes('Reedwater'), 'the joined shape is gone');
  assert.ok(texts.includes('the Reed Marsh'), 'the phrase shape is gone');
});

test('the two work rows give two different reasons', () => {
  const api = world();
  const rows = api.workRows('snare');
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].why, rows[1].why, 'the hover shows the same sentence twice');
});

test('every camp line reads without "The first camp"', () => {
  const { events } = runDays('r', 12);
  assert.ok(events.length > 0, 'twelve days logged nothing');
  assert.equal(events.filter(e => e.text.includes('The first camp')).length, 0);
});

/* Minor 10: two places read a camp's placeholder text to decide what to print. A rule reads
   data, so both ask whether the camp has a name record at all. */
test('a camp with no name record is called "the camp", and one with a record is called by it', () => {
  const api = world();
  const c = api.makeCamp('The first camp');
  c.site = api.camps[0].site ? api.camps[0].site.slice() : [api.firstPerson().x, api.firstPerson().y];
  api.camp = c;
  assert.equal(api.nameOf(c), null, 'a fresh camp holds no name record');
  assert.equal(api.campName(), 'the camp');
  assert.equal(api.campNameOf(c), 'the camp');
  /* A camp still called "The first camp" but named by the founder reads by its name. */
  api.rename(c, api.nameRecord('Reedwater', { why: 'for the reeds', by: null }));
  assert.equal(api.campName(), 'Reedwater');
  assert.equal(api.campNameOf(c), 'Reedwater');
  /* And a camp whose text happens to be the placeholder, but which holds a record, is not hidden. */
  api.rename(c, api.nameRecord('The first camp', { why: 'the people kept the old word', by: null }));
  assert.equal(api.campName(), 'The first camp');
  assert.equal(api.campNameOf(c), 'The first camp');
});

test('the actor names the camp when a site is chosen, even when a campmate is more sociable', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(), c = api.camps[0]; api.camp = c;
  const mate = api.makeBeing('human', a.x, a.y, 'Mate', 0);
  mate.camp = c; mate.homeless = false; api.beings.push(mate);
  a.traits.sociability = 0.1; mate.traits.sociability = 0.9;
  assert.ok(api.chooseSite(a), 'no site');
  assert.equal(c.names.length, 1, 'setSite must not add a second record on top of the actor\'s');
  assert.equal(c.names[0].by, a.id, 'the camp is named for whoever chose the spot, not the more sociable campmate');
  assert.equal(c.founder, a.id);
});

test('a site set with nobody named as the actor (the door\'s path) still gets a founder', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(), c = api.camps[0]; api.camp = c;
  api.setSite(a.x, a.y);
  assert.equal(c.names.length, 1, 'the fallback names the camp once');
  assert.equal(c.founder, a.id);
  assert.equal(c.names[0].by, a.id);
});

/* Two data stamps: a tag on a line, and the tick of a death. Only the part of the task that
   lives outside the six files under the phase split (tasks, beings, species, fae, goals,
   recipes) is done here: `log`'s tag and camp, and the tags on the lines in weather.js,
   camps.js's updateCamps, and main.js's lightTile. The death stamp and the wolf, sprite,
   den, ember, deer, fish, and pot tags live in those forbidden files and are deferred. */
test('every chronicle line carries a tag field and the camp it belongs to', () => {
  const api = world();
  api.camp = api.camps[0];
  api.log('A plain line.', [], 'info');
  /* world() runs startWorld, which ends in the days era, so a fresh line never carries the
     gods-era `age` field; that only appears on a line logged during creation, before a test
     can reach it. The key list here is exact for that reason. */
  assert.deepEqual(Object.keys(api.chronicle[0]).sort(), ['camp', 'kind', 'tag', 'text', 'tick', 'when']);
  assert.equal(api.chronicle[0].tag, null);
  assert.equal(api.chronicle[0].camp, api.camps[0].id);
  api.log('A wolf slips into the dark camp.', [], 'bad', 'wolf');
  assert.equal(api.chronicle[0].tag, 'wolf');
});

test('lightTile tags the line it logs when lightning sets a tree or the ground alight', () => {
  const api = world();
  const tree = api.world.find(t => t.feature === 'tree' && t.fire <= 0);
  assert.ok(tree, 'no unlit tree to strike');
  api.lightTile(tree.x, tree.y, tree.z);
  assert.equal(api.chronicle[0].tag, 'fire');
  assert.match(api.chronicle[0].text, /^Lightning strikes/);
});

test('the lines the event table reads carry their tags in a real run', () => {
  /* Seed r gives only the weather-lightning 'fire' tag inside 20 days; the wolf, sprite, den,
     ember, deer, and fish tags all live in files the phase split forbids editing right now, so
     the only other tag this phase can produce is 'birth', which this seed reaches by day 40. */
  const { events } = runDays('r', 40);
  const tags = new Set(events.filter(e => e.tag).map(e => e.tag));
  assert.ok(tags.size >= 2, `only ${[...tags].join(', ')}`);
  for (const e of events) if (e.tag) assert.ok(['wolf', 'fire', 'frost', 'sprite', 'found', 'death', 'birth', 'old', 'oldCold', 'deer', 'fish', 'pot'].includes(e.tag), `${e.tag}: ${e.text}`);
  const births = events.filter(e => e.text.includes(' is born to '));
  assert.ok(births.length > 0, 'nobody was born in forty days, so the birth tag is untested');
  for (const e of births) assert.equal(e.tag, 'birth', e.text);
  for (const e of events) if (e.text.includes('Something is burning')) assert.equal(e.tag, 'fire', e.text);
});

test('the event table names a tagged major line at the fire, and the name reads back through eventName', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  api.log('A wolf comes out of the dark and mauls somebody.', [a], 'bad', 'wolf');
  const line = api.chronicle[0];
  api.nameEvents(c);
  assert.ok(line.names && line.names.length, 'the line was not named');
  assert.equal(api.eventName(line), line.names[0].text);
  assert.equal(api.chronicle[0].text, `They will call it ${api.eventName(line)}.`);
  const n = api.chronicle.length; api.nameEvents(c);
  assert.equal(api.chronicle.length, n, 'an event is named once');
});

/* Important 6: a night took a place name once the event texts were spent, so seed r named 89
   nights, 75 of them after places, and each took a text the land could have had. That bug is gone:
   eventCandidates now gates the joined word (a place shape, like "Wolfhill") to a place, so a night
   draws only from its tag's phrases. Wolf now has three phrases, so a second wolf night takes a
   different one and a third takes the last; a fourth has nothing left. */
test('a night is named from the event table alone, in three distinct phrases, and a fourth night with no text left goes unnamed', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const phrases = api.EVENT_NAMES.wolf.phrases;
  const joined = api.cap(api.EVENT_NAMES.wolf.word) + api.WORD_TAIL[api.EVENT_NAMES.wolf.word];
  api.log('A wolf comes out of the dark and mauls somebody.', [a], 'bad', 'wolf');
  const first = api.chronicle[0];
  api.nameEvents(c);
  assert.ok(first.names && first.names.length, 'the first wolf night was not named');
  assert.ok(phrases.includes(first.names[0].text), `${first.names[0].text} is not one of the wolf phrases`);
  assert.notEqual(first.names[0].text, joined, 'a night was called a place-shaped joined word');

  api.log('A wolf comes out of the dark and mauls somebody else.', [a], 'bad', 'wolf');
  const second = api.chronicle[0];
  api.nameEvents(c);
  assert.ok(second.names && second.names.length, 'the second wolf night was not named');
  assert.notEqual(second.names[0].text, first.names[0].text, 'the second wolf night reused the first phrase');

  api.log('A wolf comes out of the dark a third time.', [a], 'bad', 'wolf');
  const third = api.chronicle[0];
  api.nameEvents(c);
  assert.ok(third.names && third.names.length, 'the third wolf night was not named');
  assert.equal(new Set([first.names[0].text, second.names[0].text, third.names[0].text]).size, 3,
    'the three wolf nights did not take three distinct phrases');
  for (const n of [first, second, third]) assert.ok(phrases.includes(n.names[0].text));

  /* The wolf tag's three phrases are now all taken. A fourth wolf night has nothing left to
     take, and the camp has already named its earlier ones, so it goes unnamed. */
  api.log('A wolf comes out of the dark a fourth time.', [a], 'bad', 'wolf');
  const fourth = api.chronicle[0];
  api.nameEvents(c);
  assert.equal(fourth.names, undefined, `the fourth night took ${fourth.names && fourth.names[0].text}`);
  assert.equal(api.chronicle[0], fourth, 'a line was logged for a night that took no name');
  /* And the pass gives up on it: a line older than a day is never looked at again. */
  api.tick += 2 * api.DAY;
  api.nameEvents(c);
  assert.equal(fourth.names, undefined, 'the pass came back to a night it had already passed over');
});

/* Finding 3: the listed order of EVENT_NAMES[tag].phrases decides, not the alphabetical
   tie-break. The first night of a tag must take phrases[0] by identity, the second phrases[1],
   the third phrases[2]. A test that only checks the three are distinct passes under either
   rule, so this checks the actual index each night lands on. */
function assertListedOrder(tag, lines){
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const phrases = api.EVENT_NAMES[tag].phrases;
  const taken = [];
  for (const line of lines){
    api.log(line, [a], 'bad', tag);
    const entry = api.chronicle[0];
    api.nameEvents(c);
    assert.ok(entry.names && entry.names.length, `a ${tag} night was not named`);
    taken.push(entry.names[0].text);
  }
  for (let i = 0; i < taken.length; i++){
    assert.equal(taken[i], phrases[i], `night ${i + 1} of ${tag} took "${taken[i]}", not the listed phrases[${i}] "${phrases[i]}"`);
  }
}
test('a night takes its tag\'s phrases in listed order: frost', () => {
  assertListedOrder('frost', [
    'The frost bites hard.',
    'The frost bites again.',
    'A third bitter frost.',
  ]);
});
test('a night takes its tag\'s phrases in listed order: fire', () => {
  assertListedOrder('fire', [
    'The fire runs through the camp.',
    'The fire runs again.',
    'A third fire.',
  ]);
});

/* Finding 3b: eventCandidates used to walk every event line of the camp when naming one of them,
   so a fresher sibling of a DIFFERENT tag could outscore the line's own tag and give it the
   sibling's phrase. Constructed, not hunted from a seed: an older 'found' line and a fresher
   'birth' line in the same camp on the same day. nameEvents names the fresher one (birth) first,
   which correctly takes its own phrases[0]; the older 'found' line is named second, and on the
   old code its pool still held birth's next candidate (phrases[1], since phrases[0] was just
   taken) at birth's higher recency, which beat found's own phrases[0]. This fails against the
   code as it stood before finding 3b. */
test('two events of different tags on one day each take a phrase from their own tag', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  api.log('Some families leave the camp.', [a], 'major', 'found');
  const foundLine = api.chronicle[0];
  foundLine.tick = api.tick - 500;
  api.log('A baby is born to someone.', [a], 'major', 'birth');
  const birthLine = api.chronicle[0];
  assert.notEqual(foundLine, birthLine, 'the two lines are the same line');
  api.nameEvents(c);
  assert.ok(birthLine.names && birthLine.names.length, 'the birth line was not named');
  assert.ok(foundLine.names && foundLine.names.length, 'the found line was not named');
  const foundPhrases = api.EVENT_NAMES.found.phrases, birthPhrases = api.EVENT_NAMES.birth.phrases;
  assert.ok(foundPhrases.includes(foundLine.names[0].text),
    `the found line took "${foundLine.names[0].text}", not one of its own tag's phrases`);
  assert.ok(birthPhrases.includes(birthLine.names[0].text),
    `the birth line took "${birthLine.names[0].text}", not one of its own tag's phrases`);
  assert.equal(foundLine.names[0].text, foundPhrases[0], 'the found line did not take its own listed first phrase');
  assert.equal(birthLine.names[0].text, birthPhrases[0], 'the birth line did not take its own listed first phrase');
});

/* Two events of the SAME tag on one day still take that tag's first and second phrase, in the
   order the nights HAPPENED (finding 3's listed-order rule), even now that eventCandidates is
   scoped to the line it names. Both lines are logged BEFORE nameEvents ever runs, so both sit
   in the unnamed pool together -- this is the actual same-day race, not two separate passes.
   `chronicle` is newest first, so if nameEvents named lines in chronicle order it would name
   the second (newer) line before the first (older) one and hand it phrases[0], the mistake
   finding 3c fixes. This failed against the code before that fix: the second (newer) wolf
   line took phrases[0] and the first (older) line took phrases[1]. */
test('two events of the same tag on one day take that tag\'s phrases in the order the nights happened', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const phrases = api.EVENT_NAMES.wolf.phrases;
  api.log('A wolf comes out of the dark and mauls somebody.', [a], 'bad', 'wolf');
  const first = api.chronicle[0];
  api.log('A wolf comes out of the dark and mauls somebody else.', [a], 'bad', 'wolf');
  const second = api.chronicle[0];
  assert.notEqual(first, second, 'the two lines are the same line');
  api.nameEvents(c);
  assert.ok(first.names && first.names.length, 'the first wolf line was not named');
  assert.ok(second.names && second.names.length, 'the second wolf line was not named');
  assert.equal(first.names[0].text, phrases[0], `the first (older) wolf line took "${first.names[0].text}", not phrases[0]`);
  assert.equal(second.names[0].text, phrases[1], `the second (newer) wolf line took "${second.names[0].text}", not phrases[1]`);
});

test('a night is never named after a place', () => {
  const { events } = run70(), api = run70world();
  const named = events.filter(e => e.names && e.names.length);
  assert.ok(named.length > 0, 'no night was named in 70 days');
  const texts = new Set(), joined = new Set();
  for (const k in api.EVENT_NAMES){
    const t = api.EVENT_NAMES[k];
    for (const phrase of t.phrases) texts.add(phrase);
    if (api.WORD_TAIL[t.word]) joined.add(api.cap(t.word) + api.WORD_TAIL[t.word]);
  }
  for (const e of named){
    assert.ok(texts.has(e.names[0].text), `a night was called ${e.names[0].text}`);
    assert.ok(!joined.has(e.names[0].text), `a night carried the place-shaped word ${e.names[0].text}`);
  }
  assert.ok(named.length <= texts.size, `${named.length} nights from ${texts.size} texts`);
});

test('a line with no tag, a line of another camp, and a quiet line are not events', () => {
  const { api, c } = hearthCamp();
  api.camp = c;
  api.log('Someone is getting better at gathering.', [], 'good');
  api.log('A wolf slips into the dark camp.', [], 'bad', 'wolf');
  api.chronicle[0].camp = c.id + 99;
  api.nameEvents(c);
  assert.equal(api.chronicle.filter(e => e.names).length, 0);
});

test('a fresher event outscores an older one on recency alone', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  api.log('An old wolf night.', [a], 'bad', 'wolf');
  api.chronicle[0].tick = api.tick - 10 * api.DAY;
  api.log('Last night the fire ran.', [a], 'bad', 'fire');
  const cands = api.eventCandidates(c);
  const fire = cands.find(x => x.text === api.EVENT_NAMES.fire.phrases[0]);
  const wolf = cands.find(x => x.text === api.EVENT_NAMES.wolf.phrases[0]);
  assert.ok(fire && wolf, 'both events should be candidates');
  assert.ok(fire.recency > wolf.recency, `fire ${fire.recency} should beat wolf ${wolf.recency}`);
});

test('any phrase of a night names a night only: a place takes the joined word, never a phrase', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  api.log('Last night the fire ran.', [a], 'bad', 'fire');
  const phrases = api.EVENT_NAMES.fire.phrases;
  const eventCands = api.eventCandidates(c, 'event');
  /* The listed order decides: only the first, unclaimed phrase is offered, never the second or
     third while the first is still free. */
  assert.ok(eventCands.some(x => x.text === phrases[0]), `a night cannot take ${phrases[0]}`);
  for (const phrase of phrases.slice(1)) assert.ok(!eventCands.some(x => x.text === phrase), `a night was offered ${phrase} while ${phrases[0]} was still free`);
  const joined = api.cap(api.EVENT_NAMES.fire.word) + api.WORD_TAIL[api.EVENT_NAMES.fire.word];
  assert.ok(!eventCands.some(x => x.text === joined), 'a night can take the joined word');
  for (const kind of ['camp', 'sector', 'pond']){
    const cands = api.eventCandidates(c, kind);
    assert.ok(cands.length > 0, `a ${kind} gets no word from the event at all`);
    assert.ok(cands.every(x => x.text === joined), `a ${kind} pool holds something other than the joined word`);
    for (const phrase of phrases) assert.ok(!cands.some(x => x.text === phrase), `a ${kind} can be called ${phrase}`);
  }
  for (const phrase of phrases){
    assert.ok(!api.candidatesFor('camp', a, c.site).some(x => x.text === phrase), `the camp pool holds ${phrase}`);
  }
});

test('a finished snare names the ground the work was done on, from the work and the land', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const s = api.sectors[api.secIdx(...Object.values(api.secOf(a.x, a.y)))];
  assert.equal(api.nameOf(s), null);
  const t = api.tileAt(a.x + 1, a.y); t.feature = null; t.struct = { type: 'snare', snare: { armed: true, camp: c } };
  api.nameSectorForWork(a, api.workWordAt([t.x, t.y]));
  assert.ok(api.nameOf(s), 'the sector has no name');
  assert.ok(api.chronicle.some(e => e.text.includes(`calls this ground ${api.nameOf(s)}`)), api.chronicle[0].text);
  const before = api.nameOf(s);
  api.nameSectorForWork(a, 'fish');
  assert.equal(api.nameOf(s), before, 'a sector is named once');
});

test('an unnamed sector is described by its biome and its direction from the nearest camp', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const here = api.secOf(...c.site);
  const east = api.sectors.find(s => s.sy === here.sy && s.sx === here.sx + 1);
  assert.equal(api.describe(east, 'sector'), `the ${east.name.toLowerCase()} east of ${c.name}`);
  api.giveName(east, api.nameRecord('Snarewood', { why: 'for the snares' }));
  assert.equal(api.describe(east, 'sector'), 'Snarewood');
  const h = api.hills[0];
  assert.match(api.describe(h, 'hill'), /^the hill (north|south|east|west|at) of /, 'an unlearned old name is not shown');
  h.nameKnown = true;
  assert.equal(api.describe(h, 'hill'), api.nameOf(h));
});

test('the first drink names the pool', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const p = api.ponds[0];
  assert.ok(p, 'no pond on seed r');
  const wet = p.tiles[0];
  const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => api.tileAt(wet.x + dx, wet.y + dy)).find(q => q && q.ground !== 'water');
  assert.ok(beside, 'no dry tile beside the pool');
  a.x = beside.x; a.y = beside.y; a.z = 0;
  api.namePondHere(a);
  assert.ok(api.nameOf(p), 'the pool has no name');
});

test('the valley takes its name from the lore, at forty', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  assert.equal(api.nameOf(api.valley), null);
  api.nameValley(c);
  const r = api.valley.names[0];
  assert.ok(r, 'the valley has no name');
  assert.equal(r.scores[0].axis, 'lore', `the top candidate came from ${r.scores[0].axis}`);
  assert.ok(api.chronicle.some(e => e.text.includes(`the whole valley a name: ${r.text}`)), api.chronicle[0].text);
});

/* Minor 13: the line reads "${text}, ${why}", and every lore reason began by saying the text
   again: "gives the whole valley a name: Sadrumo, for Sadrumo, the eye that does not close." */
test('the valley line never says the name twice', () => {
  const { api, c } = hearthCamp();
  api.camp = c;
  api.nameValley(c);
  const rec = api.valley.names[0];
  const line = api.chronicle.find(e => e.text.includes('gives the whole valley a name'));
  assert.ok(line, 'the valley was not named');
  assert.equal(line.text.split(rec.text).length - 1, 1, `${line.text} says ${rec.text} twice`);
  /* Every lore reason, and every fallback, reads without its own text in it. The sky's and the
     sprites' compounds are no longer separate fallback rows: scoreCandidates rewrites their bare
     lore candidate into that shape instead, so valleyFallbacks now carries only the people's. */
  const rows = [...api.loreCandidates(40), ...api.valleyFallbacks()];
  assert.equal(rows.length, 4, 'the lore offers three texts and one fallback');
  for (const r of rows) assert.equal(r.why.includes(r.text), false, `${r.text}: ${r.why}`);
});

/* The three texts loreCandidates offers, in the same shapes the namer builds them. */
function loreTexts(api){ return [api.titleCase(api.lore.people.replace(/^the /, '')), api.lore.sky.text, api.lore.sprites.text]; }

/* Minor: the ruling is general, not two special cases. Any candidate text already owned by a
   named source (the sky, the sprites) scores zero bare; the people are the one exception, since
   naming after them is the point. Without the fix, the sky's and sprites' bare texts score like
   any other lore candidate, and this fails. */
test('a source\'s own word never scores above zero bare, but the people\'s own name still can', () => {
  const { api, c } = hearthCamp();
  api.camp = c;
  const cands = [
    { text: api.lore.sky.text, axis: 'lore', base: 40 },
    { text: api.lore.sprites.text, axis: 'lore', base: 40 },
    { text: api.titleCase(api.lore.people.replace(/^the /, '')), axis: 'lore', base: 40 },
    { text: `Vale of ${api.lore.sky.text}`, axis: 'lore', base: 20 },
  ];
  const scored = api.scoreCandidates(cands, null, api.valley);
  const byText = t => scored.find(x => x.text === t);
  assert.equal(byText(api.lore.sky.text).score, 0, 'the sky\'s bare word must score zero');
  assert.equal(byText(api.lore.sprites.text).score, 0, 'the sprites\' bare word must score zero');
  assert.ok(byText(`Vale of ${api.lore.sky.text}`).score > 0, 'the compound form must still score');
  const peopleText = api.titleCase(api.lore.people.replace(/^the /, ''));
  assert.ok(byText(peopleText).score > 0, 'the people\'s own name must still score bare');
});

test('the valley is named even when every lore text is already taken, and the name is its own', () => {
  const { api, c } = hearthCamp();
  api.camp = c;
  for (const t of loreTexts(api)) api.giveName({ names: [] }, api.nameRecord(t, {}));
  api.nameValley(c);
  const n = api.nameOf(api.valley);
  assert.ok(n, 'the valley has no name');
  assert.equal(loreTexts(api).includes(n), false, `the valley took ${n}, which another thing holds`);
  assert.equal(api.valley.names[0].scores[0].axis, 'lore', 'the fallback is still a lore name');
  const texts = api.nameThings().flatMap(t => (t.names || []).map(r => r.text.toLowerCase()));
  assert.equal(new Set(texts).size, texts.length, 'a name is used twice');
});

/* Important review finding on task 2: a bare source word used to be struck to zero and dropped,
   never rewritten, so the valley's pool fell straight through to the people's bare name, which
   outscores a fallback compound (40 vs 20). Measured on seed r at day 45: the bare sky's word
   ("Sadrumo") would have won the tie-break over the people's bare word ("Ska") before either rule
   ran, so a source rule that keeps its score, not one that starts it over at a fallback's base,
   must let it win still, in its distinct form. This fails on a79cd29 (the valley took "Ska") and
   passes after the fix (the valley takes "Vale of Sadrumo"). */
test('a source word that would have won bare wins in its distinct form, measured on seed r', () => {
  const { api } = runDays('r', 45);
  const n = api.nameOf(api.valley);
  assert.equal(n, `Vale of ${api.lore.sky.text}`, `seed r's valley took ${n}, not the sky's compound`);
});

/* Important review finding on task 2's fix, second pass: `lore.sky.text` and `lore.sprites.text`
   come from `oldWord()` in `nameTheLand` and are never put in `nameIndex`, so `nameTaken()` does
   not know them. A land candidate made later by `newOldName` can carry the same text by chance,
   with no relation to the sky or the sprites at all. Before this fix, scoreCandidates matched
   that candidate by text alone and rewrote it into "Vale of <the sky's word>", keeping the land
   candidate's own reason clause, so the chronicle credited the wrong origin (a reed by the water,
   not the sky). The fix marks the sky's and sprites' own rows with a `source` field in
   `loreCandidates` and rewrites only a candidate that carries it. This candidate is built by hand,
   not drawn from a seed that happens to collide, and carries no `source` field. */
test('a candidate that only collides with a source\'s text, and is not that source\'s own, is never rewritten into its distinct form', () => {
  const { api, c } = hearthCamp();
  api.camp = c;
  const cands = [
    { text: api.lore.sky.text, axis: 'land', base: 20, why: 'for the reed by the water' },
  ];
  const scored = api.scoreCandidates(cands, null, api.valley, 'valley');
  assert.equal(scored.length, 1, 'the candidate must not be dropped from the list, only zeroed');
  const cand = scored[0];
  assert.equal(cand.text, api.lore.sky.text, `the land candidate was rewritten into ${cand.text}`);
  assert.equal(cand.why, 'for the reed by the water', 'the land candidate\'s own reason was overwritten');
  assert.equal(cand.score, 0, 'a text a source already owns must still never be shown bare');
});

test('the first camp that is a village names the valley, even when it is not the first camp in the list', () => {
  const { api, a, c } = hearthCamp();
  const c2 = api.makeCamp('The second camp');
  c2.site = [a.x, a.y];
  const mate = api.makeBeing('human', a.x, a.y, 'Mate', 0);
  mate.camp = c2; mate.homeless = false; mate.asleep = false; api.beings.push(mate);
  c2.village = true;
  api.tick = 10 * api.DAY + api.CLOCK.names.nameHour;
  assert.equal(c.village, false, 'the first camp in the list must not be a village');
  api.nameTick();
  const n = api.nameOf(api.valley);
  assert.ok(n, 'the valley waited on the first camp in the list');
  assert.ok(api.chronicle.some(e => e.text.includes(`the whole valley a name: ${n}`)), api.chronicle[0].text);
  const lines = api.chronicle.filter(e => e.text.includes('gives the whole valley a name')).length;
  api.tick += api.DAY;
  api.nameTick();
  assert.equal(api.nameOf(api.valley), n, 'the valley is named once');
  assert.equal(api.chronicle.filter(e => e.text.includes('gives the whole valley a name')).length, lines);
});

test('a name a person gives aloud is known at once, and describe says it', () => {
  const { api, c } = hearthCamp();
  api.camp = c;
  /* The sky's word and the sprites' word never score above zero bare, so with the plain
     people's text taken too, only a distinct compound is left to win. */
  api.giveName({ names: [] }, api.nameRecord(loreTexts(api)[0], {}));
  api.nameValley(c);
  const r = api.valley.names[0];
  assert.ok(r, 'the valley has no name');
  assert.notEqual(r.text, api.lore.sky.text, 'the sky\'s word must not be offered bare');
  assert.notEqual(r.text, api.lore.sprites.text, 'the sprites\' word must not be offered bare');
  assert.notEqual(r.by, 'lost', 'a person gave this name');
  assert.equal(api.valley.nameKnown, true, 'the people know the name they just chose');
  assert.equal(api.describe(api.valley, 'valley'), r.text);
});

test('an old name with no giver still waits to be found, and a person\'s name spends the count of unread marks', () => {
  const api = world();
  const h = api.hills.find(x => x.nameKnown === false);
  assert.ok(h, 'no unlearned hill on seed r');
  const before = api.lore.unknown;
  assert.ok(before > 0, 'nothing is left to learn');
  api.giveName(h, api.nameRecord('Sunnahill', { tongue: 'old', meaning: 'the bright hill', by: api.firstPerson().id }));
  assert.equal(h.nameKnown, true, 'a name a person gives aloud is known');
  assert.equal(api.lore.unknown, before - 1, 'the count of unread marks did not follow');
  const g = { names: [] };
  api.giveName(g, api.nameRecord('Vethunar', { tongue: 'old', meaning: 'the quiet ground' }));
  assert.equal(g.nameKnown, false, 'the land\'s own names still start unknown');
});

/* ---------- the held hooks: what the real loop does ---------- */

/* One 70-day run, shared by every test below that needs a whole season of play. A run of that
   length costs about twenty seconds, so it is made once and kept. Seed alpha is the one of the
   six that reaches every tag: it drives wolves off, it meets the sprites, it spears deer, it
   fishes, and it fires pots. Seed r never sees a wolf in seventy days. */
let RUN70 = null;
const run70raw = () => RUN70 || (RUN70 = runDays('alpha', 70));
/* The lines of the shared run, copied. A test that reads them cannot reach the live world, so
   nothing added below can step it out from under the tests that come after. */
const run70 = () => ({ events: run70raw().events.slice() });
/* The live world of the shared run, for the four tests that must read it. Read it; never step it. */
const run70world = () => run70raw().api;

test('a death stamps the tick and carries a tag the event table can read', () => {
  const api = world();
  const a = api.beings.find(b => b.species === 'human');
  api.camp = a.camp || api.camps[0];
  api.die(a, 'froze in the cold', 'frost');
  assert.equal(a.alive, false);
  assert.equal(a.diedAt, api.tick);
  assert.equal(api.chronicle[0].tag, 'frost');
  assert.match(api.chronicle[0].text, /froze in the cold/);
});

test('old age is tagged old or oldCold, not death, and every other cause about a person carries a tag from the table', () => {
  const { events } = run70();
  const oldAge = events.filter(e => e.kind === 'death' && /old age|old and warm by the fire/.test(e.text));
  assert.ok(oldAge.length > 0, 'no old-age death in 70 days');
  for (const e of oldAge) assert.ok(['old', 'oldCold'].includes(e.tag), `${e.tag}: ${e.text}`);
  /* Project policy: a death in a soak that is not old age is a bug. So this list is empty, and
     the check is that it is empty, not a loop that passes by running zero times. */
  const otherDeaths = events.filter(e => e.kind === 'death' && !/old age|old and warm by the fire/.test(e.text));
  assert.deepEqual(otherDeaths.map(e => `${e.tag}: ${e.text}`), [], 'somebody died of something other than old age');
});

test('the wolf, sprite, deer, and fish tags all appear once tasks, species, and fae are tagged', () => {
  const { events } = run70();
  const tags = new Set(events.filter(e => e.tag).map(e => e.tag));
  for (const t of ['wolf', 'sprite', 'deer', 'fish']) assert.ok(tags.has(t), `no ${t} tag seen in 70 days`);
  /* A pot needs a kiln, which seed r may not reach; check the line if it is there, never require it. */
  const potLines = events.filter(e => e.text.includes(' fires ') && e.text.toLowerCase().includes('pot'));
  for (const e of potLines) assert.equal(e.tag, 'pot', e.text);
});

test('every founding line in a real run carries the found tag', () => {
  const { events } = run70();
  const lines = events.filter(e => e.text.includes('carrying coals in a bundle of bark'));
  assert.ok(lines.length > 0, 'no party set out in 70 days');
  for (const e of lines) assert.equal(e.tag, 'found', e.text);
});

test('a person walking the land reads the marks and learns the old names', () => {
  const { events } = run70(), api = run70world();
  const learned = events.filter(e => e.text.includes('finds marks cut in the rock'));
  assert.ok(learned.length > 0, 'nobody learned an old name in 70 days');
  assert.ok(api.hills.some(h => h.nameKnown), 'no hill is known by its old name');
  for (const e of learned) assert.equal(e.kind, 'info', e.text);
});

test('only a person learns an old name, and a world with every name learned costs nothing', () => {
  const api = world();
  const h = api.hills.find(x => x.nameKnown === false);
  assert.ok(h, 'no unlearned hill on seed r');
  const deer = api.beings.find(b => b.species === 'deer');
  assert.ok(deer, 'no deer on seed r');
  deer.x = h.x; deer.y = h.y; deer.z = 0;
  api.learnNamesHere(deer);
  assert.equal(h.nameKnown, false, 'a deer read the marks');
  const a = api.firstPerson(); a.x = h.x; a.y = h.y; a.z = 0;
  api.learnNamesHere(a);
  assert.equal(h.nameKnown, true);
  /* Once nothing is left to learn the pass gives up at once, and learns nothing more. */
  api.lore.unknown = 0;
  const g = api.hills.find(x => x.nameKnown === false);
  assert.ok(g, 'seed r has only one named hill, so the early exit cannot be tested');
  a.x = g.x; a.y = g.y;
  api.learnNamesHere(a);
  assert.equal(g.nameKnown, false, 'the early exit still read the marks');
});

test('every arrival line says the camp by name', () => {
  const { events } = run70();
  const arrivals = events.filter(e => e.text.includes('and is welcomed by the fire'));
  assert.ok(arrivals.length > 0, 'nobody arrived at a camp in 70 days');
  for (const e of arrivals) assert.ok(!e.text.includes('arrives at the camp '), e.text);
});

test('a founded camp carries its founder and its name from the moment the party leaves, and its line is tagged', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const before = api.camps.length;
  const mate = api.makeBeing('human', a.x + 1, a.y, 0); mate.camp = c; mate.homeless = false; api.beings.push(mate);
  assert.ok(api.startFoundCamp(a), 'the party did not set out');
  assert.equal(api.camps.length, before + 1);
  const nc = api.camps[before];
  assert.equal(nc.founder, a.id);
  /* The camp Hal already holds is "Hal's camp", so the new one cannot take that text again. It
     is named all the same, and by the namer, from the moment the party leaves. */
  assert.ok(api.nameOf(nc), 'the new camp has no name');
  assert.notEqual(api.nameOf(nc), api.nameOf(c), 'two camps hold one name');
  assert.equal(nc.name, api.nameOf(nc));
  const line = api.chronicle.find(e => e.text.includes('carrying coals in a bundle of bark'));
  assert.ok(line, 'no line said the party set out');
  assert.equal(line.tag, 'found');
});

/* Bare, walkable ground on the surface, well away from the camp. */
function freeGround(api, c){
  const t = api.world.find(q => q.z === 0 && api.passable(q.x, q.y, 0) && !q.feature && !q.struct && api.dist(q.x, q.y, c.site[0], c.site[1]) > 20);
  assert.ok(t, 'no free ground away from the camp');
  return t;
}

test('a finished job names the ground the work was done on, through the real stop', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  c.stash.stick = 6;
  const spot = freeGround(api, c);
  const s = api.sectorOfTile(spot);
  assert.equal(api.nameOf(s), null, 'the sector is named already');
  a.x = spot.x; a.y = spot.y; a.z = 0;
  api.setTask(a, 'setSnare', { at: [spot.x, spot.y] }, { label: 'Setting a snare', path: [], progress: 9999, target: [spot.x, spot.y], within: 1 });
  api.runTask(a);
  assert.equal(a.task, null, 'the job did not finish');
  assert.ok(api.nameOf(s), 'the sector was not named by the finished job');
  assert.ok(api.chronicle.some(e => e.text.includes(`calls this ground ${api.nameOf(s)}`)), api.chronicle[0].text);
});

test('a job with no work word names nothing', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const spot = freeGround(api, c);
  const s = api.sectorOfTile(spot);
  assert.equal(api.nameOf(s), null, 'the sector is named already');
  a.x = spot.x; a.y = spot.y; a.z = 0;
  /* checkSnare on bare ground: the effect finds no snare, so there is no work word here. */
  api.setTask(a, 'checkSnare', { at: [spot.x, spot.y] }, { label: 'Checking the snare', path: [], progress: 9999, target: [spot.x, spot.y], within: 1 });
  api.runTask(a);
  assert.equal(api.nameOf(s), null, 'a job with no work word named the ground');
});

test('the ground named is the work tile\'s, not the worker\'s, across a sector boundary', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  c.stash.stick = 6;
  /* A pair of bare tiles side by side in two different, unnamed sectors, well away from the camp. */
  let work = null, stand = null;
  for (const t of api.world){
    if (t.z !== 0 || !api.passable(t.x, t.y, 0) || t.feature || t.struct) continue;
    if (api.dist(t.x, t.y, c.site[0], c.site[1]) <= 20) continue;
    const q = api.hasTile(t.x - 1, t.y, 0) ? api.tileAt(t.x - 1, t.y) : null;
    if (!q || !api.passable(q.x, q.y, 0) || q.feature || q.struct) continue;
    if (api.sectorOfTile(t) === api.sectorOfTile(q)) continue;
    work = t; stand = q; break;
  }
  assert.ok(work, 'no bare pair straddling a sector boundary');
  const sw = api.sectorOfTile(work), ss = api.sectorOfTile(stand);
  assert.equal(api.nameOf(sw), null, 'the work sector is named already');
  assert.equal(api.nameOf(ss), null, 'the worker\'s sector is named already');
  a.x = stand.x; a.y = stand.y; a.z = 0;
  api.setTask(a, 'setSnare', { at: [work.x, work.y] }, { label: 'Setting a snare', path: [], progress: 9999, target: [work.x, work.y], within: 1 });
  api.runTask(a);
  assert.ok(api.nameOf(sw), 'the work tile\'s sector was not named');
  assert.equal(api.nameOf(ss), null, 'the worker\'s own sector was named instead');
});

test('feeding a fire that already stands names nothing, and a finished hut names the ground', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const pitSector = api.sectorOfTile(api.tileAt(...c.pit));
  assert.equal(api.nameOf(pitSector), null, 'the camp sector is named already');
  c.stash.stick = 20; c.stash.log = 20; c.stash.hide = 4;
  a.x = c.pit[0]; a.y = c.pit[1]; a.z = 0;
  api.setTask(a, 'feedFire', { at: c.pit.slice() }, { label: 'Feeding the fire', path: [], progress: 9999, target: c.pit.slice(), within: 1 });
  api.runTask(a);
  assert.equal(api.nameOf(pitSector), null, 'feeding the fire named the ground');
  /* The same stop, on a job that raises a structure where none stood: that one names the ground. */
  const spot = freeGround(api, c);
  const s = api.sectorOfTile(spot);
  assert.equal(api.nameOf(s), null, 'the sector is named already');
  a.x = spot.x; a.y = spot.y; a.z = 0;
  api.setTask(a, 'buildHut', { at: [spot.x, spot.y] }, { label: 'Building a hut', path: [], progress: 9999, target: [spot.x, spot.y], within: 1 });
  api.runTask(a);
  assert.equal(api.tileAt(spot.x, spot.y).struct.type, 'hut', 'the hut was not built');
  assert.ok(api.nameOf(s), 'the finished hut did not name the ground');
});

test('a delivery to the stash names the ground it lands on, through the real stop', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const s = api.sectorOfTile(api.tileAt(...c.stashTile));
  assert.equal(api.nameOf(s), null, 'the stash sector is named already');
  a.carrying = { kind: 'log', count: 2 };
  api.setTask(a, 'deliver', { at: c.stashTile.slice() }, { label: 'Carrying 2 logs to camp', path: [] });
  api.runTask(a);
  assert.equal(a.carrying, null, 'the delivery did not land');
  assert.ok(api.nameOf(s), 'the sector was not named by the delivery');
});

/* Minor 11: the delivery named the worker's own sector. A carrier stands within one tile of the
   stash, which can be the sector next door, so the ground named is the stash tile's. */
test('a delivery names the stash tile\'s sector, not the carrier\'s, across a sector boundary', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  let stash = null, stand = null;
  for (const t of api.world){
    if (t.z !== 0 || !api.passable(t.x, t.y, 0)) continue;
    const q = api.hasTile(t.x - 1, t.y, 0) ? api.tileAt(t.x - 1, t.y) : null;
    if (!q || !api.passable(q.x, q.y, 0)) continue;
    if (api.sectorOfTile(t) === api.sectorOfTile(q)) continue;
    if (api.nameOf(api.sectorOfTile(t)) || api.nameOf(api.sectorOfTile(q))) continue;
    stash = t; stand = q; break;
  }
  assert.ok(stash, 'no passable pair straddling a sector boundary');
  const ss = api.sectorOfTile(stash), sw = api.sectorOfTile(stand);
  c.stashTile = [stash.x, stash.y];
  a.x = stand.x; a.y = stand.y; a.z = 0;
  a.carrying = { kind: 'log', count: 2 };
  api.setTask(a, 'deliver', { at: [stash.x, stash.y] }, { label: 'Carrying 2 logs to camp', path: [] });
  api.runTask(a);
  assert.equal(a.carrying, null, 'the delivery did not land');
  assert.ok(api.nameOf(ss), 'the stash tile\'s sector was not named');
  assert.equal(api.nameOf(sw), null, 'the carrier\'s own sector was named instead');
});

test('the first drink at a pool names it, through the real stop', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const p = api.ponds[0];
  assert.ok(p, 'no pond on seed r');
  const wet = p.tiles[0];
  const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => api.tileAt(wet.x + dx, wet.y + dy)).find(q => q && q.ground !== 'water' && api.passable(q.x, q.y, 0));
  assert.ok(beside, 'no dry tile beside the pool');
  a.x = beside.x; a.y = beside.y; a.z = 0; a.needs.water = 10;
  api.setTask(a, 'drink', {}, { label: 'Going to drink', path: [] });
  api.runTask(a);
  assert.equal(a.needs.water, 100, 'the drink did not land');
  assert.ok(api.nameOf(p), 'the pool was not named by the drink');
  assert.ok(api.chronicle.some(e => e.text.includes(`calls the pool ${api.nameOf(p)}`)), api.chronicle[0].text);
});

/* Important 5: a wolf has no camp, so the maul line took whichever camp the beings pass had
   last stepped. With two camps the wrong one could name the Night of the Wolf. */
test('a wolf mauling is stamped with the mauled person\'s camp, not whichever camp is current', () => {
  const { api, a, c } = hearthCamp();
  const c2 = api.makeCamp('The second camp');
  c2.site = [a.x, a.y];
  const mate = api.makeBeing('human', a.x, a.y, 'Mate', 0);
  mate.camp = c2; mate.homeless = false; mate.asleep = false; api.beings.push(mate);
  const wolf = api.makeBeing('wolf', a.x + 1, a.y, 'Wolf', 0); api.beings.push(wolf);
  /* The pass left the first camp current, as it does when it steps a camped being before a wolf. */
  api.camp = c;
  api.setTask(wolf, 'stalk', { who: mate.id }, { label: 'Stalking', path: [], progress: 0, fast: true });
  api.runTask(wolf);
  const line = api.chronicle.find(e => e.text.includes(`mauls ${mate.name}`));
  assert.ok(line, 'the wolf did not maul anybody');
  assert.equal(line.tag, 'wolf');
  assert.equal(line.camp, c2.id, 'the maul was stamped with the wrong camp');
  assert.equal(api.isEventLine(line, c2), true, 'the mauled person\'s camp cannot name the night');
  assert.equal(api.isEventLine(line, c), false, 'another camp can name the night');
  assert.equal(api.camp, c, 'the stop did not put the current camp back');
});

/* ---------- epithets, lineage, and fate ---------- */

test('ten days in a camp earns an epithet, and the chronicle says so', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  a.campSince = api.tick - 11 * api.DAY;
  api.log('set the ember in the pit', [a], 'major', 'fire');
  api.epithetPass(c);
  assert.equal(a.epithet, 'firekeeper');
  assert.equal(api.fullName(a), `${a.name} firekeeper`);
  assert.ok(a.epithets[0].why, 'an epithet has a reason');
  assert.ok(a.epithets[0].scores.length >= 1, 'the candidate list is kept');
  assert.ok(api.chronicle.some(e => e.text === `The camp has started to call ${a.name} firekeeper.`), api.chronicle[0].text);
});

test('a candidate below the bar does not replace the epithet, and one above it does', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  a.campSince = api.tick - 11 * api.DAY;
  for (let k = 0; k < 4; k++) api.log('a wolf driven off', [a], 'good', 'wolf');
  api.epithetPass(c);
  assert.equal(a.epithet, 'wolfdriver');
  const held = api.epithetCandidates(a).find(x => x.text === 'wolfdriver').score;
  /* One deed of another kind scores 30, which is under 1.5 times the held score. */
  api.log('a fish', [a], 'good', 'fish');
  api.epithetPass(c);
  assert.equal(a.epithet, 'wolfdriver', `30 should not beat ${held} times 1.5`);
  for (let k = 0; k < 12; k++) api.log('a fish', [a], 'good', 'fish');
  api.epithetPass(c);
  assert.equal(a.epithet, 'fisher');
  assert.deepEqual(a.epithets.map(r => r.text), ['fisher', 'wolfdriver']);
  const change = api.chronicle.find(e => e.text === `Nobody calls ${a.name} wolfdriver any more. Now it is ${a.name} fisher.`);
  assert.ok(change, api.chronicle[0].text);
  /* Minor 24: a change is as quiet as the first epithet. A major line pulses a chip in the strip,
     and seed r changed fifty-two epithets in a hundred days. */
  assert.equal(change.kind, 'info', 'an epithet change pulses an alert chip');
  const first = api.chronicle.find(e => e.text === `The camp has started to call ${a.name} wolfdriver.`);
  assert.ok(first, 'the first epithet was not logged');
  assert.equal(first.kind, 'info');
});

/* Important 4: the deed count came from `a.history`, which `log` caps at 40 lines, so camp
   chatter evicted every tagged line within a day or two and no deed epithet was ever earned. */
test('a deed is counted on the person, so it survives the forty-line cap on their history', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  assert.deepEqual(a.deeds, {}, 'a fresh person carries an empty deed count');
  api.log('a wolf driven off', [a], 'good', 'wolf');
  assert.equal(a.deeds.wolf, 1);
  /* Fifty untagged lines push the tagged one out of the history, as a day of camp chatter does. */
  for (let k = 0; k < 50; k++) api.log(`chatter ${k}`, [a], 'info');
  assert.equal(a.history.filter(e => e.tag).length, 0, 'the tagged line is still in the history');
  assert.equal(a.deeds.wolf, 1, 'the deed count did not survive the cap');
  a.campSince = api.tick - 11 * api.DAY;
  api.epithetPass(c);
  assert.equal(a.epithet, 'wolfdriver');
});

test('a deed epithet is earned in a real run, past the day the history cap bites', () => {
  const api = run70world();
  const folk = api.beings.filter(b => b.species === 'human' && b.alive);
  const deeds = new Set(Object.values(api.DEED_EPITHETS));
  const earned = folk.filter(b => deeds.has(b.epithet));
  assert.ok(earned.length > 0, `no deed epithet among ${folk.map(b => b.epithet).join(', ')}`);
});

/* Important 3: five lineage rows were clauses, so the templates read "Now it is Tam walked in
   from the north." Every epithet a camp gives must be a byname that follows a name. */
test('every lineage epithet is a byname, and every template reads as a sentence', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  a.campSince = api.tick - 11 * api.DAY;
  a.lineage = { parents: null, camp: c.id, day: 1, roof: true, village: true, edge: 'north', foundersChild: true, firstBorn: true };
  const texts = api.epithetCandidates(a).map(x => x.text);
  for (const want of ['the roofborn', 'the village-born', 'out of the north', "the founders' child", 'the firstborn']){
    assert.ok(texts.includes(want), `${want} is not among ${texts.join(', ')}`);
  }
  /* No epithet may start with a verb: that is what made the clauses read wrongly. */
  for (const t of texts) assert.ok(!/^(born|walked|child|first) /.test(t), `${t} is a clause, not a byname`);
  /* Read both templates and the full name aloud with each byname. */
  for (const t of texts){
    assert.match(`The camp has started to call ${a.name} ${t}.`, /^The camp has started to call \w+ [a-z']+/);
    assert.match(`Nobody calls ${a.name} the talker any more. Now it is ${a.name} ${t}.`, /Now it is \w+ [a-z']+/);
    a.epithet = t;
    assert.equal(api.fullName(a), `${a.name} ${t}`);
  }
});

test('the deed epithets are one word each', () => {
  const api = world();
  for (const k in api.DEED_EPITHETS) assert.ok(/^[a-z]+$/.test(api.DEED_EPITHETS[k]), `${api.DEED_EPITHETS[k]} is not one plain word`);
});

test('fate gives the last epithet, and it replaces the one held', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  a.campSince = api.tick - 11 * api.DAY;
  api.log('the ember', [a], 'major', 'fire');
  api.epithetPass(c);
  assert.equal(a.epithet, 'firekeeper');
  api.die(a, 'froze in the cold', 'frost');
  assert.equal(a.epithet, 'the frozen');
  assert.equal(a.epithets.length, 2);
  assert.equal(a.diedAt, api.tick);
});

/* Important 2: one tag said both old-age deaths, so a person who died cold in the snow was
   called "who died warm by the fire" on the same screen as the line saying otherwise. */
test('the two old-age deaths carry two tags and two fates, and neither one names a night', () => {
  const api = world();
  api.camp = api.camps[0];
  const warm = api.beings.filter(b => b.species === 'human')[0];
  api.die(warm, 'died in their sleep, old and warm by the fire', 'old');
  assert.equal(api.chronicle[0].tag, 'old');
  assert.equal(warm.epithet, 'who died warm by the fire');
  const cold = api.makeBeing('human', warm.x, warm.y, 'Cold', 0);
  cold.camp = api.camps[0]; api.beings.push(cold);
  api.die(cold, 'died of old age', 'oldCold');
  assert.equal(api.chronicle[0].tag, 'oldCold');
  assert.equal(cold.epithet, 'who died of old age');
  /* Both tags stay out of the event table, so neither death names a night. */
  for (const t of ['old', 'oldCold']) assert.equal(api.EVENT_NAMES[t], undefined, `${t} names a night`);
  const c = api.camps[0];
  for (const e of api.chronicle) if (e.tag === 'old' || e.tag === 'oldCold') assert.equal(api.isEventLine(e, c), false, e.text);
});

test('a cold old-age death in a real run is tagged oldCold, and a warm one old', () => {
  const { events } = run70();
  /* A gnome's death line says the same words and carries no tag, because a gnome takes no fate. */
  const cold = events.filter(e => e.kind === 'death' && /died of old age/.test(e.text) && !/^A gnome /.test(e.text));
  const warm = events.filter(e => e.kind === 'death' && /old and warm by the fire/.test(e.text));
  assert.ok(cold.length + warm.length > 0, 'no old-age death in 70 days');
  for (const e of cold) assert.equal(e.tag, 'oldCold', e.text);
  for (const e of warm) assert.equal(e.tag, 'old', e.text);
});

test('everyone gets a lineage record, and the birth source reads it', () => {
  const api = world();
  const first = api.firstPerson();
  assert.ok(first.lineage, 'the first person has no lineage');
  assert.equal(first.lineage.day, api.dayOf());
  const later = runDays('r', 40).api;
  const born = later.beings.filter(b => b.species === 'human' && b.parents);
  assert.ok(born.length >= 1, 'nobody was born in forty days');
  for (const b of born){ assert.ok(b.lineage, `${b.name} has no lineage`); assert.equal(b.lineage.roof, true); assert.deepEqual(b.lineage.parents, b.parents); }
});

test('by day 40 every person with ten days in a camp has an epithet', () => {
  const { api } = runDays('r', 40);
  const old = api.beings.filter(b => b.species === 'human' && b.alive && api.tick - (b.campSince === undefined ? b.born : b.campSince) >= 10 * api.DAY);
  assert.ok(old.length >= 1, 'nobody has been in a camp ten days');
  for (const b of old) assert.ok(b.epithet, `${b.name} has no epithet`);
});
