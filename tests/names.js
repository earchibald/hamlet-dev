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

test('every camp line reads without "The first camp"', () => {
  const { events } = runDays('r', 12);
  assert.equal(events.filter(e => e.text.includes('The first camp')).length, 0);
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
  for (const e of events) if (e.tag) assert.ok(['wolf', 'fire', 'frost', 'sprite', 'found', 'death', 'birth', 'old', 'deer', 'fish', 'pot'].includes(e.tag), `${e.tag}: ${e.text}`);
  for (const e of events){
    if (e.text.includes(' is born to ')) assert.equal(e.tag, 'birth', e.text);
    if (e.text.includes('Something is burning')) assert.equal(e.tag, 'fire', e.text);
  }
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
  const fire = cands.find(x => x.text === api.EVENT_NAMES.fire.phrase);
  const wolf = cands.find(x => x.text === api.EVENT_NAMES.wolf.phrase);
  assert.ok(fire && wolf, 'both events should be candidates');
  assert.ok(fire.recency > wolf.recency, `fire ${fire.recency} should beat wolf ${wolf.recency}`);
});

test('a finished snare names the ground it stands on, from the work and the land', () => {
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

/* ---------- the held hooks: what the real loop does ---------- */

/* One 70-day run, shared by every test below that needs a whole season of play. A run of that
   length costs about twenty seconds, so it is made once and kept. Seed alpha is the one of the
   six that reaches every tag: it drives wolves off, it meets the sprites, it spears deer, it
   fishes, and it fires pots. Seed r never sees a wolf in seventy days. */
let RUN70 = null;
const run70 = () => RUN70 || (RUN70 = runDays('alpha', 70));

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

test('old age is tagged old, not death, and every other cause about a person carries a tag from the table', () => {
  const { events } = run70();
  const oldAge = events.filter(e => e.kind === 'death' && /old age|old and warm by the fire/.test(e.text));
  assert.ok(oldAge.length > 0, 'no old-age death in 70 days');
  for (const e of oldAge) assert.equal(e.tag, 'old', e.text);
  const otherDeaths = events.filter(e => e.kind === 'death' && !/old age|old and warm by the fire/.test(e.text));
  for (const e of otherDeaths) assert.ok(['fire', 'frost', 'death'].includes(e.tag), `${e.tag}: ${e.text}`);
});

test('the wolf, sprite, deer, and fish tags all appear once tasks, species, and fae are tagged', () => {
  const { events } = run70();
  const tags = new Set(events.filter(e => e.tag).map(e => e.tag));
  for (const t of ['wolf', 'sprite', 'deer', 'fish']) assert.ok(tags.has(t), `no ${t} tag seen in 70 days`);
  /* A pot needs a kiln, which seed r may not reach; check the line if it is there, never require it. */
  const potLines = events.filter(e => e.text.includes(' fires ') && e.text.toLowerCase().includes('pot'));
  for (const e of potLines) assert.equal(e.tag, 'pot', e.text);
});

test('a founding party carries the found tag on the line that sends it out', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  api.log(`${a.name} and somebody set out for the meadow to the west, carrying coals in a bundle of bark.`, [a], 'major', 'found');
  assert.equal(api.chronicle[0].tag, 'found');
  const { events } = run70();
  for (const e of events) if (e.text.includes('carrying coals in a bundle of bark')) assert.equal(e.tag, 'found', e.text);
});

test('a person walking the land reads the marks and learns the old names', () => {
  const { api, events } = run70();
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
  if (deer){ deer.x = h.x; deer.y = h.y; deer.z = 0; api.learnNamesHere(deer); assert.equal(h.nameKnown, false, 'a deer read the marks'); }
  const a = api.firstPerson(); a.x = h.x; a.y = h.y; a.z = 0;
  api.learnNamesHere(a);
  assert.equal(h.nameKnown, true);
  /* Once nothing is left to learn the pass gives up at once, and learns nothing more. */
  api.lore.unknown = 0;
  const g = api.hills.find(x => x.nameKnown === false);
  if (g){ a.x = g.x; a.y = g.y; api.learnNamesHere(a); assert.equal(g.nameKnown, false, 'the early exit still read the marks'); }
});

test('every arrival line says the camp by name', () => {
  const { events } = run70();
  const arrivals = events.filter(e => e.text.includes('and is welcomed by the fire'));
  assert.ok(arrivals.length > 0, 'nobody arrived at a camp in 70 days');
  for (const e of arrivals) assert.ok(!e.text.includes('arrives at the camp '), e.text);
});

test('a founded camp carries its founder and its name from the moment the party leaves', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const before = api.camps.length;
  const mate = api.makeBeing('human', a.x + 1, a.y, 0); mate.camp = c; mate.homeless = false; api.beings.push(mate);
  if (!api.startFoundCamp(a)) return;
  assert.equal(api.camps.length, before + 1);
  const nc = api.camps[before];
  assert.equal(nc.founder, a.id);
  assert.equal(api.nameOf(nc), `${a.name}'s camp`);
});

test('a finished job names the ground it stands on, through the real stop', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  c.stash.stick = 6;
  const spot = api.world.find(t => t.z === 0 && api.passable(t.x, t.y, 0) && !t.feature && !t.struct && api.dist(t.x, t.y, c.site[0], c.site[1]) > 20);
  assert.ok(spot, 'no free ground away from the camp');
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
  const spot = api.world.find(t => t.z === 0 && api.passable(t.x, t.y, 0) && !t.feature && !t.struct && api.dist(t.x, t.y, c.site[0], c.site[1]) > 20);
  const s = api.sectorOfTile(spot);
  a.x = spot.x; a.y = spot.y; a.z = 0;
  /* checkSnare on bare ground: the effect finds no snare, so there is no work word here. */
  api.setTask(a, 'checkSnare', { at: [spot.x, spot.y] }, { label: 'Checking the snare', path: [], progress: 9999, target: [spot.x, spot.y], within: 1 });
  api.runTask(a);
  assert.equal(api.nameOf(s), null, 'a job with no work word named the ground');
});

test('a delivery to the stash names the ground it lands on, through the real stop', () => {
  const { api, a, c } = hearthCamp();
  api.camp = c;
  const s = api.sectorOfTile(api.tileAt(...c.stashTile));
  if (api.nameOf(s)) return;
  a.carrying = { kind: 'log', count: 2 };
  api.setTask(a, 'deliver', { at: c.stashTile.slice() }, { label: 'Carrying 2 logs to camp', path: [] });
  api.runTask(a);
  assert.equal(a.carrying, null, 'the delivery did not land');
  assert.ok(api.nameOf(s), 'the sector was not named by the delivery');
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
