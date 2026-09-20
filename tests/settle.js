// Settle: from marks to tiles. Each painter on a hand-marked field, then a whole world.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const { runDays } = require('./lib/run');

/* RESTORED by G4 task 4, 2026-09-20. This file was suspended by task 1 because a world day
   cost about fifteen seconds and the file asks for 50 world days. Every day count is
   exactly as task 1 left it: none was cut to fit the engine. The runs that still cost more
   than the plan's hundred and twenty seconds sit behind LONG=1 one by one, and each states
   its day count, its measured seconds and the flag in its own skip message. A file behind a
   flag is still a test; a file with a smaller day count is not the same test. */

/* ---------- the runs that cost more than a hundred and twenty seconds ----------
   G4 task 4's floors rule: a restored run over the plan's hundred and twenty seconds lives behind
   LONG=1 permanently, with a public skip that states its day count, its seconds and the flag. NO DAY
   COUNT WAS LOWERED. A file with a smaller day count is not the same test, and a run shortened to fit
   a budget is a deleted claim with a green tick on it.
   The seconds are `days` times the 3.0 s a world day measured on this branch at low population. A run
   that lets the valley fill costs more than that, up to 18 s a world day by day 50, so the figure is
   a floor and it is labelled as one. The measurements and the machine's load averages are in
   design/reports/2026-09-20-g4-task-4-the-skip.md. */
/* SLOW=1 runs these too, because that is the flag task 1 wrote into every suspension message and
   into the commands people have in their notes. A documented command that silently runs nothing is
   worse than no command. */
const LONG = !!(process.env.LONG || process.env.SLOW);
const slow = days => LONG ? false
  : `behind LONG=1: ${days} world days, at least ${Math.round(days * 3)} s at the 3.0 s a world day measured on this branch, and more as the valley fills. LONG=1 runs it. The day count is untouched.`;


test('every world begins with its creation, and the first person stands in the start country', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.era, 'days');
  assert.ok(api.creation.settled && api.creation.gate.ok);
  assert.ok(api.legends.length > 5);
  assert.ok(api.chronicle.some(e => /walks alone into the/.test(e.text)), 'no first day-era line');
  const a = api.beings.find(b => b.species === 'human');
  assert.ok(a, 'no first person');
  assert.equal(api.regionAt(a.x, a.y).id, api.creation.gate.start.id);
  assert.ok(api.passable(a.x, a.y, 0));
  for (const g of api.gods()) assert.ok(g.status === 'asleep' || g.status === 'dead');
});

test('sectors take the biome of the country that covers most of them', () => {
  const api = load(); api.startWorld('r');
  for (const s of api.sectors){
    assert.ok(['meadow', 'forest', 'rocky', 'wetland', 'river', 'ash'].includes(s.biome), s.biome);
    assert.ok(api.regionById(s.country), 'a sector without a country');
    assert.equal(s.name, api.BIOMES[s.biome].name);
  }
});

test('the river runs along the wet god\'s live boundaries, with fords', () => {
  const api = load(); api.startWorld('r');
  const wet = api.liveBoundaries().filter(b => b.pole === 'wet');
  if (!wet.length) return;
  let water = 0, ford = 0;
  for (const b of wet) for (const i of b.tiles){ const t = api.world[i]; if (t.ground === 'water') water++; else if (t.ground === 'sand') ford++; }
  assert.ok(water > 0, 'no water on a wet boundary');
  assert.ok(ford > 0 || wet.every(b => b.tiles.length < 47), 'a long river with no ford');
});

test('a pool mark paints a lake', () => {
  const api = load(); api.startCreation('r'); api.runAges();
  const pooled = api.liveRegions().find(r => api.hasMark(r, 'pool', 'surface'));
  if (!pooled) return;
  const n = pooled.tiles.filter(i => api.world[i].ground === 'water').length;
  assert.ok(n >= pooled.area / 12, `a pooled country with ${n} water tiles`);
});

test('the same seed paints the same valley twice', () => {
  const a = load(); a.startWorld('x'); const b = load(); b.startWorld('x');
  assert.deepEqual(a.world.map(t => t.ground + (t.feature || '')).join(''), b.world.map(t => t.ground + (t.feature || '')).join(''));
});

/* The first person stands in the widest part of the start country, not in a pocket cut off from it. */
const SOAK_SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];
/* Every pocket of the start country, largest first, and the one the first person stands in. The six tests below
   restate the tile check's `room` rule on purpose: they check that settle really discards a small pocket, not
   that the half-the-country threshold is the right one. The discard test covers the threshold itself. */
function startPockets(api){
  const W = api.W, s = api.creation.gate.start;
  const a = api.beings.find(b => b.species === 'human');
  const open = s.tiles.filter(i => api.passable(i % W, (i - i % W) / W));
  const mine = new Set(open), seen = new Set(), reach = [];
  for (const i of mine){
    if (seen.has(i)) continue;
    const region = api.reachable(i % W, (i - i % W) / W, 0, api.NZ * W * api.H);
    for (const j of mine) if (region.has(api.idx3(j % W, (j - j % W) / W, 0))) seen.add(j);
    reach.push(region.size);
  }
  const here = api.reachable(a.x, a.y, 0, api.NZ * W * api.H);
  const held = open.filter(i => here.has(api.idx3(i % W, (i - i % W) / W, 0))).length;
  return { open: open.length, reach: reach.sort((p, q) => q - p), held, world: here.size };
}

/* A wide pocket walled off from everything else is a prison, so the person takes the pocket that opens onto the
   most world, not the one that holds the most of the country. */
for (const seed of SOAK_SEEDS) test(`seed ${seed}: the first person stands in the start country's widest pocket`, () => {
  const api = load(); api.startWorld(seed);
  const { reach, world } = startPockets(api);
  assert.ok(world >= reach[0], `the person walks ${world} tiles, and the best start pocket opens onto ${reach[0]}`);
});

/* The gate says nothing about tiles, so a country can pass it and still be shattered into pockets by the
   water the painters lay down. Seed gamma's start country breaks into 450, 127, 83, 48 and smaller.
   Task 5's tile check is what discards such a settle. */
for (const seed of SOAK_SEEDS) test(`seed ${seed}: the first person can walk most of the start country`, () => {
  const api = load(); api.startWorld(seed);
  const { open, held } = startPockets(api);
  assert.ok(held >= open / 2, `${held} of ${open} passable start tiles are reachable`);
});

/* A settled world, plus the marks that made it, for the painters' tests. */
function settled(seed = 'r'){ const api = load(); api.startWorld(seed); return api; }

test('a height mark raises hills inside its country, with storeys from the mark', () => {
  const api = settled();
  const raised = api.liveRegions().filter(r => api.marksOf(r, 'height').length);
  assert.ok(raised.length, 'no country raised');
  for (const r of raised){
    const mine = api.hills.filter(h => h.mark && h.mark.by === api.marksOf(r, 'height')[0].by && r.tiles.includes(api.idx(h.x, h.y)));
    assert.ok(mine.length >= 1, `country ${r.id} has a height mark and no hill`);
    for (const h of mine){ assert.equal(h.storeys, Math.min(api.marksOf(r, 'height')[0].value, api.ZMAX)); assert.ok(h.tiles.every(i => r.tiles.includes(i)), 'a hill spills out of its country'); }
  }
  for (const h of api.hills) assert.ok(h.mark, 'a hill without a mark');
});

test('a depth mark cuts caves under its country\'s hills, and raises one if it had none', () => {
  const api = settled();
  const dug = api.liveRegions().filter(r => api.marksOf(r, 'depth').length);
  assert.ok(dug.length, 'no country dug');
  for (const r of dug){
    const mine = api.caves.filter(c => c.kind === 'water' && c.hill && r.tiles.includes(api.idx(c.hill.x, c.hill.y)));
    assert.ok(mine.length >= 1, `country ${r.id} has a depth mark and no cave`);
    for (const c of mine){ assert.ok(c.mark && c.mark.kind === 'depth'); const deepest = Math.min(...c.tiles.map(t => t.z)); assert.equal(deepest, Math.max(api.ZMIN, -Math.min(api.marksOf(r, 'depth')[0].value, -api.ZMIN))); }
  }
});

test('scars paint what the winner\'s pole leaves', () => {
  const api = load(); api.startCreation('r'); api.runAges();
  for (const r of api.liveRegions()){
    for (const m of api.marksOf(r, 'scar')){
      const tiles = r.tiles.map(i => api.world[i]);
      if (m.value === 'burned') assert.ok(tiles.every(t => t.ground === 'ash' || t.ground === 'water' || t.ground === 'sand' || t.ground === 'rock' || t.ground === 'stone'), 'a burned country with living ground');
      if (m.value === 'drowned') assert.ok(tiles.some(t => t.feature === 'deadpine') && tiles.some(t => t.ground === 'water'), 'a drowned country with no dead pines in water');
      if (m.value === 'broken') assert.ok(tiles.filter(t => t.feature === 'boulder').length >= r.area / 5, 'a broken country with few boulders');
      if (m.value === 'cut') assert.ok(tiles.filter(t => t.ground === 'rock' && !t.hill).length >= 8, 'a cut country with no chasm');
    }
  }
});

/* No soak seed carries a scar, so the scar painters would go untested. Mark four countries away from the start by
   hand and run the painters on them. */
test('the scar painters mark a country, and a chasm never cuts the world in two', () => {
  const api = settled();
  const W = api.W, start = api.creation.gate.start;
  const beside = new Set(api.neighboursOf(start).map(r => r.id)); beside.add(start.id);
  const away = api.liveRegions().filter(r => !beside.has(r.id) && r.area > 40).sort((p, q) => q.area - p.area).slice(0, 4);
  assert.equal(away.length, 4, 'seed r has fewer than four countries away from the start');
  const a = api.beings.find(b => b.species === 'human');
  const was = api.reachable(a.x, a.y, 0, api.NZ * W * api.H);
  const held = start.tiles.filter(i => was.has(api.idx3(i % W, (i - i % W) / W, 0)));
  const values = ['burned', 'cut', 'drowned', 'broken'];
  away.forEach((r, k) => api.mark(r, 'scar', values[k], api.gods()[0], 'test'));
  api.paintScars();
  away.forEach((r, k) => {
    const tiles = r.tiles.map(i => api.world[i]);
    if (values[k] === 'burned') assert.ok(tiles.every(t => ['ash', 'water', 'sand', 'rock', 'stone'].includes(t.ground)), 'a burned country with living ground');
    if (values[k] === 'drowned') assert.ok(tiles.some(t => t.feature === 'deadpine') && tiles.some(t => t.ground === 'water'), 'a drowned country with no dead pines in water');
    if (values[k] === 'broken') assert.ok(tiles.filter(t => t.feature === 'boulder').length >= 1, 'a broken country with no boulders');
    if (values[k] === 'cut') assert.ok(tiles.filter(t => t.ground === 'rock' && !t.hill).length >= 8, 'a cut country with no chasm');
  });
  const now = api.reachable(a.x, a.y, 0, api.NZ * W * api.H);
  for (const i of held) assert.ok(now.has(api.idx3(i % W, (i - i % W) / W, 0)), 'a scar cut a start tile out of the walkable world');
});

/* A founding party walks to a sector where the pit can be built. The rule counts the sector and its four
   neighbours; this test counts the same reach from the items themselves. */
for (const seed of SOAK_SEEDS) test(`seed ${seed}: every founding site has the pit's rocks and sticks in reach`, () => {
  const api = load(); api.startWorld(seed);
  const need = api.GOALS.find(g => g.id === 'firepit').need;
  const sites = api.foundingSites();
  for (const s of sites){
    const inReach = (x, y) => { const q = api.secOf(x, y); return Math.abs(q.sx - s.sx) + Math.abs(q.sy - s.sy) <= 1; };
    /* The rule counts the item the tile shows and passes over anything already reserved, so the test counts the same. */
    const loose = k => api.items.filter(i => i.kind === k && i.z === 0 && !i.reservedBy && api.itemAt(i.x, i.y, 0) === i && inReach(i.x, i.y)).length;
    assert.ok(loose('rock') >= need.rock, `a founding site with ${loose('rock')} rocks in reach`);
    assert.ok(loose('stick') >= need.stick, `a founding site with ${loose('stick')} sticks in reach`);
    assert.ok(api.GROWS[s.biome], `a founding site in a ${s.biome}`);
  }
});

test('every made species has a living member in its country, and nothing unmade exists', () => {
  const api = settled();
  const made = new Set(); for (const r of api.liveRegions()) for (const m of api.marksOf(r, 'making')) made.add(m.value);
  for (const sp of ['rabbit', 'deer', 'fox', 'wolf', 'sprite', 'gnome']){
    const alive = api.beings.filter(b => b.alive && b.species === sp);
    if (made.has(sp)) assert.ok(alive.length >= 1, `the ${api.SPECIES[sp].plural} were made and none lives`);
    else assert.equal(alive.length, 0, `the ${api.SPECIES[sp].plural} were never made and yet live`);
  }
  /* A hunter's `most` caps the whole valley, so the makings after the cap put nothing on the ground. The test
     spends the same budget in the same order the painter does, and only asks for creatures while it lasts. */
  const budget = {};
  for (const r of api.liveRegions()) for (const m of api.marksOf(r, 'making')){
    if (m.value === 'human') continue;
    /* Sprites stand at their grove's door, which is a tile just off the hill and may fall over the country's
       line. For them the grove is the proof, not the tile a sprite stands on. */
    if (api.SPAWN[m.value] && api.SPAWN[m.value].grove){
      assert.ok(api.groves.some(g => api.regionAt(g.x, g.y) === r), `the ${api.SPECIES[m.value].plural} made in country ${r.id} have no grove`);
      continue;
    }
    const how = api.SPAWN[m.value];
    const here = api.beings.filter(b => b.alive && b.species === m.value && b.z === 0 && api.regionAt(b.x, b.y) === r);
    const denned = api.beings.filter(b => b.alive && b.species === m.value && b.z !== 0);
    if (how && how.most !== undefined){
      const spent = budget[m.value] || 0;
      if (spent >= how.most) continue;
      budget[m.value] = spent + Math.min(how.n, how.most - spent);
    }
    assert.ok(here.length + denned.length >= 1, `the ${api.SPECIES[m.value].plural} made in country ${r.id} are not there`);
  }
  /* No species goes over its cap, and no den is dug for nobody. */
  for (const sp in api.SPAWN){
    const how = api.SPAWN[sp]; if (!how || how.most === undefined) continue;
    const n = api.beings.filter(b => b.alive && b.species === sp).length;
    assert.ok(n <= how.most, `${n} ${api.SPECIES[sp].plural} at settle, and the table allows ${how.most}`);
  }
  for (const c of api.caves.filter(c => c.kind === 'den')){
    assert.ok(api.beings.some(b => b.alive && b.den === c), `a den was dug and nothing lives in it`);
  }
});

/* The cap on the hunters. Seed birch-crag-41 runs 82 ages and marks twenty-six wolf makings and nine fox
   makings. Without the cap the valley began with fifty-two wolves, and four of them mauled one person in three
   ticks. The legends still tell of every making; the valley holds the pair and the three. */
test('a long creation still brings down one wolf pair and three foxes', () => {
  const api = load(); api.startWorld('birch-crag-41', { sw: 10, sh: 6, zmin: -2, zmax: 2, ageLimit: 200 });
  const marks = {};
  for (const r of api.liveRegions()) for (const m of api.marksOf(r, 'making')) marks[m.value] = (marks[m.value] || 0) + 1;
  assert.ok(marks.wolf > api.SPAWN.wolf.most, `seed birch-crag-41 marked only ${marks.wolf} wolf makings; pick another seed`);
  assert.ok(marks.fox > api.SPAWN.fox.most, `seed birch-crag-41 marked only ${marks.fox} fox makings; pick another seed`);
  const alive = sp => api.beings.filter(b => b.alive && b.species === sp).length;
  assert.equal(alive('wolf'), api.SPAWN.wolf.most);
  assert.equal(alive('fox'), api.SPAWN.fox.most);
  /* Every den that stands has owners. A making the cap turned away digs no den at all. */
  for (const c of api.caves.filter(c => c.kind === 'den')) assert.ok(api.beings.some(b => b.alive && b.den === c), 'a den was dug for nobody');
  /* The valley says so once for each species the cap held back, and the prey are not held back at all. A settle
     that was thrown back leaves its own lines behind, as its "the last of the gods sleeps" line does, so the
     count is one a species a settle. */
  const said = api.chronicle.filter(e => /came down into the valley/.test(e.text)).map(e => e.text);
  const settles = api.chronicle.filter(e => /The last of the gods sleeps/.test(e.text)).length;
  for (const sp of ['wolf', 'fox']) assert.equal(said.filter(t => t.includes(api.SPECIES[sp].plural)).length, settles, `the ${api.SPECIES[sp].plural} cap is not in the chronicle once a settle`);
  for (const sp of ['rabbit', 'deer']) assert.equal(said.filter(t => t.includes(api.SPECIES[sp].plural)).length, 0, `the ${api.SPECIES[sp].plural} were capped and they should not be`);
});

/* A seed whose creation never fills a country twice says nothing about a cap, and loses nothing to it. */
test('a short creation loses nothing to the cap and says nothing of it', () => {
  const api = load(); api.startWorld('alpha');
  assert.equal(api.beings.filter(b => b.alive && b.species === 'wolf').length, api.SPAWN.wolf.n);
  assert.equal(api.chronicle.filter(e => /came down into the valley/.test(e.text)).length, 0);
});

/* Nothing the gods did not make wanders in. The day era refills the wild with rabbits, deer, foxes and wolves,
   but only with the species the making marks name. Seed r's gods made no wolf; seed alpha's did. */
test('a species the gods never made never wanders in, and one they made may', { skip: slow(50) }, () => {
  const bare = settled('r');
  assert.ok(!bare.creation.made.wolf, 'seed r made wolves after all; pick another seed');
  const { api } = runDays('r', 25);
  assert.equal(api.beings.filter(b => b.species === 'wolf').length, 0, 'a wolf walked into a world with no wolf making');

  const full = settled('alpha');
  assert.ok(full.creation.made.wolf, 'seed alpha made no wolves; pick another seed');
  const made = runDays('alpha', 25).api;
  assert.ok(made.beings.some(b => b.species === 'wolf'), 'the wolves were made and none is in the world');
});

test('sprites live in a grove of their country, foxes and wolves in dens, gnomes in burrows', () => {
  const api = settled();
  for (const g of api.groves) assert.ok(g.mark && g.mark.kind === 'making' && g.mark.value === 'sprite');
  for (const c of api.caves.filter(c => c.kind === 'den')) assert.ok(['fox', 'wolf'].includes(c.owner));
  const gn = api.beings.filter(b => b.alive && b.species === 'gnome');
  if (gn.length) assert.ok(api.caves.some(c => c.kind === 'burrow'), 'gnomes with no burrow');
});

test('a sleeping god stands at its body, and stays in the world through the days', () => {
  const api = settled();
  for (const g of api.gods()){
    if (g.status !== 'asleep') continue;
    assert.ok(api.hasTile(g.x, g.y, g.z), `${g.name} stands off the map`);
    /* One body holds one god, so a god may lie down in no body at all, but only when every live country is
       already taken. Anywhere else a body-less god is a bug. */
    const body = g.body;
    if (!body){ assert.ok(api.liveRegions().every(r => r.god), `${g.name} has no body and a country is free`); continue; }
    assert.equal(body.god, g.id);
    /* A body is a record -- a hill, a cave, or a country -- and never a bare tile. */
    assert.ok(Array.isArray(body.tiles), `${g.name} sleeps in a tile, not a hill, a cave, or a country`);
  }
  for (const t of api.world) assert.equal(t.god, undefined, `a tile at ${t.x},${t.y} carries a god`);
  for (let i = 0; i < 400; i++) api.step();
  assert.equal(api.gods().length, api.beings.filter(b => b.species === 'god').length);
  for (const g of api.gods()) assert.ok(g.status !== 'awake');
});

test('the tile check names what the first person cannot reach', () => {
  const api = settled();
  const a = api.beings.find(b => b.species === 'human');
  assert.deepEqual(api.tileCheck(a), { ok: true });
  /* Wall the person in with rock: nothing is in reach, and the check names the first lack it meets. */
  for (const t of api.world) if (api.dist(t.x, t.y, a.x, a.y) <= 14 && !(t.x === a.x && t.y === a.y)){ t.ground = 'rock'; t.feature = null; }
  const r = api.tileCheck(a);
  assert.equal(r.ok, false);
  assert.ok(['water', 'ground', 'fuel', 'food'].includes(r.lack), r.lack);
});

test('a settle that fails is discarded, the last sleeper wakes, and the ages go on', () => {
  const api = load(); api.startCreation('r');
  /* Force the first paint to fail: the seam lies once, and every settle after it tells the truth. */
  const real = api.tileCheck; let lied = false;
  api.setTileCheck(a => { if (!lied){ lied = true; return { ok: false, lack: 'water' }; } return real(a); });
  api.runAges();
  /* One discard is forced. Seed r's second valley may be thrown back on its own merits, so count at least one. */
  assert.ok(api.creation.discards >= 1, `${api.creation.discards} discards`);
  assert.ok(api.legends.some(e => /would not hold a life: it lacks water/.test(e.text)), 'no legend of the forced discard');
  assert.equal(api.era, 'days');
  assert.ok(api.creation.settled);
  assert.ok(api.beings.some(b => b.species === 'human'), 'no first person after the second settle');
  assert.ok(api.world.length && api.hills.length, 'the second valley was never painted');
});

/* A check that never passes would throw the world back for ever: every discard repaints the whole valley, and a
   page steps the ages one at a time. After MAX_DISCARDS the next settle is kept, whatever it lacks. */
test('a world thrown back too often is settled unfinished, and the ages end', () => {
  const api = load(); api.startCreation('r');
  api.setTileCheck(() => ({ ok: false, lack: 'water' }));
  api.runAges();
  assert.equal(api.era, 'days');
  assert.ok(api.creation.settled);
  assert.equal(api.creation.discards, api.MAX_DISCARDS, `${api.creation.discards} discards`);
  assert.ok(api.legends.some(e => /settled unfinished/.test(e.text)), 'no legend of the unfinished settle');
  assert.ok(api.beings.some(b => b.species === 'human'), 'no first person after the unfinished settle');
});

/* A creation that runs past twice the age limit has failed. That settle is final: it is kept whatever it lacks,
   so a discard cannot wake a god and start the same age over again. */
test('a creation that runs out of ages settles unfinished at once', () => {
  const api = load(); api.startCreation('r', { ageLimit: 2 });
  api.setTileCheck(() => ({ ok: false, lack: 'water' }));
  api.runAges();
  assert.ok(api.creation.failed, 'the creation did not fail');
  assert.equal(api.era, 'days');
  assert.ok(api.creation.settled);
  /* A failed creation settles at once, so it never spends a repaint: the cap is never even approached. */
  assert.ok(api.creation.discards < api.MAX_DISCARDS, `${api.creation.discards} discards`);
  assert.ok(api.legends.some(e => /settled unfinished/.test(e.text)), 'no legend of the unfinished settle');
});

/* Settle paints from `creation.gate.start`, and `unmake` can shut the gate with no god left awake, so a gate
   with no start candidate must still hand the painters a country. The state before the first split is that
   state: the field is one formless country with no pole on it, so nothing is dry and level and unscarred. */
test('a gate with no start candidate still names a country', () => {
  const api = load(); api.startCreation('r');
  assert.equal(api.startCandidates().length, 0, 'the formless field already holds a start candidate');
  const gate = api.restGate();
  assert.equal(gate.ok, false);
  assert.equal(gate.lack, 'start');
  assert.ok(gate.start, 'the gate named no country to paint from');
  assert.ok(api.liveRegions().includes(gate.start), 'the gate named a country that is not live');
  assert.ok(Array.isArray(gate.start.tiles) && gate.start.bbox, 'the gate named something that is not a country');
  /* Every other return of the gate carries a start too. */
  for (const g of [gate, api.restGate()]) assert.ok(g.start, 'a gate with no start');
});

/* No ground to stand on is a failed check, not a crash: settle reads null and throws the valley back. */
test('placeFirstPerson returns null when the start country has no ground', () => {
  const api = settled();
  const W = api.W, s = api.creation.gate.start;
  const was = api.beings.length;
  for (const i of s.tiles){ const t = api.world[i]; t.ground = 'water'; t.feature = null; t.struct = null; }
  assert.equal(s.tiles.filter(i => api.passable(i % W, (i - i % W) / W, 0)).length, 0, 'the drowned country is still walkable');
  assert.equal(api.placeFirstPerson(), null);
  assert.equal(api.beings.length, was, 'a person stood up in a country with no ground');
  /* The final path stands the person somewhere walkable rather than throwing. */
  const best = api.placeFirstPersonAnywhere();
  assert.ok(best && api.passable(best.x, best.y, 0), 'the last resort put the person on ground nobody can walk');
  assert.equal(api.beings.length, was + 1);
});

/* The roll of what was made is the roll of the makings, not the roll of the painters. The people are made by a
   making mark like any other, so they stand on the roll, although the settle places them and no painter does. */
test('the roll of the makings holds every making, painter or not', () => {
  const api = settled();
  assert.ok(api.wasMade('human'), 'the people are made and the roll does not say so');
  assert.ok(api.creation.made.human, 'the people are made and the roll does not say so');
  assert.ok(api.creation.made.rabbit, 'seed r made no rabbits; the rabbit gate would be shut');
  for (const sp in api.creation.made) assert.ok(sp in api.SPAWN, `${sp} is on the roll and SPAWN does not name it`);
});
