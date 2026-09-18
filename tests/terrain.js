// Terrain: levels, slopes, species limits, and hills. Fast: one world per test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('the surface is level 0 and the levels below are empty', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.levels.length, 5);
  assert.equal(api.levels[api.ZOFF], api.world);
  /* Water cut a cave under any tall hill, so a level below the surface can hold cave tiles now; nothing else touches it. */
  for (const z of [-2, -1]) assert.ok(api.levels[z + api.ZOFF].every(t => t === null || t.cave), `level ${z} should hold nothing but cave tiles yet`);
  const t = api.tileAt(10, 10);
  assert.equal(t.z, 0);
  assert.equal(api.tileAt(10, 10, 1), null);
  assert.equal(api.hasTile(10, 10, -1), false);
  assert.equal(api.idx3(10, 10, 0), 2 * api.world.length + 10 * 280 + 10);
});

test('a level apart counts as six tiles', () => {
  const api = load();
  assert.equal(api.near({ x: 0, y: 0, z: 0 }, { x: 2, y: 1, z: 1 }), 9);
  assert.equal(api.nearAt({ x: 5, y: 5, z: 2 }, 5, 5), 12);
  assert.equal(api.nearAt({ x: 5, y: 5, z: 0 }, 6, 5), 1);
});

test('rock does not walk, stone does', () => {
  const api = load(); api.startWorld('r');
  const t = api.placeTile(20, 20, 1, 'stone');
  assert.equal(t.z, 1);
  assert.equal(api.passable(20, 20, 1), true);
  t.ground = 'rock';
  assert.equal(api.passable(20, 20, 1), false);
  assert.equal(api.raised.includes(t), true);
});

/* A little hill by hand on flat ground: a 3 by 3 block of rock at level 0 with a stone floor above it, and one slope on its west side. */
function makeHill(api, x0, y0, withSlope){
  for (let y = y0 - 2; y <= y0 + 4; y++) for (let x = x0 - 2; x <= x0 + 4; x++){ const t = api.tileAt(x, y); t.ground = 'grass'; t.feature = null; t.struct = null; t.fire = 0; t.slope = false; t.hill = null; api.levels[api.ZOFF + 1][api.idx(x, y)] = null; api.levels[api.ZOFF + 2][api.idx(x, y)] = null; }
  for (let k = api.raised.length - 1; k >= 0; k--){ const t = api.raised[k]; if (t.x >= x0 - 2 && t.x <= x0 + 4 && t.y >= y0 - 2 && t.y <= y0 + 4) api.raised.splice(k, 1); }
  for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++){ api.tileAt(x, y).ground = 'rock'; api.placeTile(x, y, 1, 'stone'); }
  if (withSlope) api.tileAt(x0 - 1, y0 + 1).slope = true;
}

test('a slope joins the ground to the floor above, and a cliff does not', () => {
  const api = load(); api.startWorld('r'); const x0 = 150, y0 = 66;
  makeHill(api, x0, y0, true);
  const out = [];
  api.steps(x0 - 1, y0 + 1, 0, out);
  assert.ok(out.join(',').includes(`${x0},${y0 + 1},1`), 'the slope should offer a step up');
  api.steps(x0, y0 + 1, 1, out);
  assert.ok(out.join(',').includes(`${x0 - 1},${y0 + 1},0`), 'the floor above the slope should offer a step down');
  const walker = { x: x0 - 2, y: y0 + 1, z: 0, species: 'human' };
  const up = api.bfs(walker.x, walker.y, 0, (x, y, z) => z === 1 && x === x0 + 1 && y === y0 + 1, 500, walker);
  assert.ok(up, 'no path up the slope');
  assert.deepEqual(up[0], [x0 - 1, y0 + 1, 0]);
  assert.deepEqual(up[1], [x0, y0 + 1, 1]);
  const leg = api.legPath(walker, x0 + 1, y0 + 1, 0, 1);
  assert.ok(leg && leg.length === up.length, 'legPath should climb too');
  api.tileAt(x0 - 1, y0 + 1).slope = false;
  assert.equal(api.bfs(walker.x, walker.y, 0, (x, y, z) => z === 1, 500, walker), null, 'a cliff should block');
  const region = api.reachable(walker.x, walker.y, 0, 200);
  assert.equal(region.has(api.idx3(x0, y0 + 1, 1)), false);
});

test('rabbits never climb, deer do', () => {
  const api = load(); api.startWorld('r'); const x0 = 150, y0 = 66;
  makeHill(api, x0, y0, true);
  const goal = (x, y, z) => z === 1;
  assert.equal(api.bfs(x0 - 2, y0 + 1, 0, goal, 500, { species: 'rabbit' }), null);
  assert.ok(api.bfs(x0 - 2, y0 + 1, 0, goal, 500, { species: 'deer' }));
});

test('a wolf on a hilltop is not near a person below it', () => {
  const api = load(); api.startWorld('r'); const x0 = 150, y0 = 66;
  makeHill(api, x0, y0, false);
  const wolf = api.beings.find(b => b.species === 'wolf'); wolf.x = x0 + 1; wolf.y = y0 + 1; wolf.z = 1; wolf.needs.food = 10;
  const person = api.beings[0]; person.x = x0 + 1; person.y = y0 + 3; person.z = 0;
  assert.equal(api.near(wolf, person), 8);
  const threats = api.threatsFor(person);
  assert.equal(threats.some(([x, y]) => x === wolf.x && y === wolf.y), false, 'a wolf one level up should not be a threat at three tiles');
});

test('fire on a hilltop burns and is seen from the hilltop, not from below', () => {
  const api = load(); api.startWorld('r'); const x0 = 150, y0 = 66;
  makeHill(api, x0, y0, true);
  const top = api.tileAt(x0 + 1, y0 + 1, 1); top.ground = 'grass';
  assert.equal(api.lightTile(x0 + 1, y0 + 1, 1), 'The ground is burning. This fire is not contained.');
  assert.ok(top.fire > 0);
  assert.equal(api.nearestFire(x0 + 1, y0 + 2, 2, 1), 1);
  assert.equal(api.nearestFire(x0 + 1, y0 + 4, 3, 0), -1, 'a fire one level up is not on this level');
  const before = top.fire; api.step();
  assert.ok(top.fire < before, 'the hilltop fire should burn down each tick');
  assert.equal(api.lightTile(x0 + 1, y0 + 1, 2), 'Nothing here but air.');
});

for (const seed of ['r', 'x', 'alpha', 'beta', 'gamma', 'delta']) test(`seed ${seed}: the hills are sound`, () => {
  const api = load(); api.startWorld(seed);
  assert.ok(api.hills.length >= 6 && api.hills.length <= 10, `${api.hills.length} hills`);
  const start = { sx: 5, sy: 3 };
  const full = api.levels.length * api.world.length;
  const slopes = []; for (const t of api.world) if (t.slope) slopes.push(t); for (const t of api.raised) if (t.slope) slopes.push(t);
  const out = [];
  for (const s of slopes){ api.steps(s.x, s.y, s.z, out); assert.ok(out.some((v, k) => k % 3 === 2 && v === s.z + 1), `slope at ${s.x},${s.y},${s.z} leads nowhere`); }
  /* A tall hill with a running spring shows one water tile right at its own mouth (or a neighbour's, since exits can
     sit close together): expected, not a placement bug. */
  const waterCaves = api.caves.filter(c => c.kind === 'water');
  for (const h of api.hills){
    const floors = api.raised.filter(t => t.hill === h && api.GROUND[t.ground].walk);
    assert.ok(floors.length > 0, `hill at ${h.x},${h.y} has no floor`);
    assert.ok(floors.some(t => t.z === h.storeys), `hill at ${h.x},${h.y} should reach level ${h.storeys}`);
    for (const i of h.tiles){
      const t = api.world[i];
      /* A den pocket at level 0 turns its footprint tiles to cave floor; every other footprint tile stays rock. */
      if (!t.cave) assert.equal(t.ground, 'rock', `hill at ${h.x},${h.y}: footprint tile ${t.x},${t.y} is ${t.ground}`);
      const s = api.secOf(t.x, t.y); assert.ok(!(s.sx === start.sx && s.sy === start.sy), 'a hill in the start sector');
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++){
        const qx = Math.min(api.W - 1, Math.max(0, t.x + dx)), qy = Math.min(api.H - 1, Math.max(0, t.y + dy));
        const q = api.tileAt(qx, qy);
        if (q.ground === 'water' && waterCaves.some(c => Math.max(Math.abs(qx - c.exit.x), Math.abs(qy - c.exit.y)) <= 1)) continue;
        assert.notEqual(q.ground, 'water', `hill at ${h.x},${h.y} touches water`);
      }
    }
    const base = slopes.find(s => s.z === 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const u = api.tileAt(s.x + dx, s.y + dy, 1); return u && u.hill === h; }));
    assert.ok(base, `hill at ${h.x},${h.y} has no slope up from the ground`);
    const region = api.reachable(base.x, base.y, 0, full);
    for (const t of floors) assert.ok(region.has(api.idx3(t.x, t.y, t.z)), `hill at ${h.x},${h.y}: floor ${t.x},${t.y},${t.z} cannot be reached`);
  }
});

test('a person walks up the slope, stands on the floor, and drops a stick there', () => {
  const api = load(); api.startWorld('r'); const x0 = 150, y0 = 66;
  makeHill(api, x0, y0, true);
  const a = api.beings[0]; a.x = x0 - 2; a.y = y0 + 1; a.z = 0; a.asleep = false; a.homeless = false;
  const path = api.bfs(a.x, a.y, 0, (x, y, z) => z === 1 && x === x0 + 1 && y === y0 + 1, 500, a);
  assert.ok(path, 'no path up');
  a.task = { type: 'wander', label: 'Climbing', path, arrive: () => 'done', started: api.tick, key: 'wander', fast: true };
  for (let k = 0; k < path.length; k++) api.runTask(a);
  assert.equal(a.z, 1, 'the person should be on the floor above');
  assert.equal(api.tileAt(a.x, a.y, a.z).ground, 'stone');
  a.carrying = { kind: 'stick', count: 1 }; api.dropCarried(a);
  const it = api.items.find(i => i.kind === 'stick' && i.x === a.x && i.y === a.y);
  assert.ok(it, 'no stick dropped'); assert.equal(it.z, 1, 'the stick should lie on the floor, not in the rock below');
  assert.equal(api.itemAt(a.x, a.y, 1), it);
});

test('a cave is carved as stone floor and remembers its record', () => {
  const api = load(); api.startWorld('r');
  assert.ok(Array.isArray(api.caves));
  const before = api.caves.length;
  const c = api.makeCave('water', null);
  assert.equal(api.caves.length, before + 1);
  const t = api.carve(c, 150, 66, -1);
  assert.equal(t.ground, 'stone'); assert.equal(t.z, -1); assert.equal(t.cave, c); assert.ok(c.tiles.includes(t));
  assert.equal(api.carve(c, 150, 66, -1), t, 'carving twice returns the same tile');
  const s = api.tileAt(151, 66); s.ground = 'rock'; s.feature = 'tree';
  const u = api.carve(c, 151, 66, 0);
  assert.equal(u, s); assert.equal(u.ground, 'stone'); assert.equal(u.feature, null); assert.equal(u.cave, c);
  assert.equal(api.passable(150, 66, -1), true);
  assert.ok(api.ITEMS.firestones && api.ITEMS.bones);
  const other = api.makeCave('den', null);
  assert.equal(api.carve(other, 150, 66, -1), null, 'another cave cannot take an owned tile');
  assert.equal(t.cave, c); assert.equal(other.tiles.length, 0);
  const sl = api.tileAt(152, 66); sl.ground = 'rock'; sl.slope = true;
  assert.equal(api.carve(c, 152, 66, 0).slope, false, 'cutting the rock clears a slope');
});

test('keepsPaths refuses a solid that would cut the last way through', () => {
  const api = load(); api.startWorld('r'); const x0 = 150, y0 = 74;
  for (let y = y0 - 2; y <= y0 + 2; y++) for (let x = x0 - 2; x <= x0 + 2; x++){ const t = api.tileAt(x, y); t.ground = 'grass'; t.feature = null; t.struct = null; t.fire = 0; t.slope = false; }
  for (const dy of [-1, 1]) for (let x = x0 - 1; x <= x0 + 1; x++) api.tileAt(x, y0 + dy).feature = 'boulder';
  assert.equal(api.keepsPaths(api.tileAt(x0, y0)), false, 'the middle of a one-wide corridor');
  for (let x = x0 - 1; x <= x0 + 1; x++) api.tileAt(x, y0 - 1).feature = null;
  assert.equal(api.keepsPaths(api.tileAt(x0, y0)), true, 'with the north row open the sides join around it');
});

const SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];
const stepList = (api, t) => { const out = []; api.steps(t.x, t.y, t.z, out); const r = []; for (let k = 0; k < out.length; k += 3) r.push([out[k], out[k + 1], out[k + 2]]); return r; };

for (const seed of SEEDS) test(`seed ${seed}: water cut a cave under every tall hill`, () => {
  const api = load(); api.startWorld(seed);
  const full = api.levels.length * api.world.length;
  const tall = api.hills.filter(h => h.storeys === 2);
  const water = api.caves.filter(c => c.kind === 'water');
  assert.equal(water.length, tall.length, `${tall.length} tall hills, ${water.length} water caves`);
  for (const c of water){
    assert.ok(c.mouth && c.mouth.slope && c.mouth.z === -1, 'the mouth is a slope on level -1');
    assert.ok(c.exit && c.exit.z === 0 && c.exit.mouth === c && api.passable(c.exit.x, c.exit.y), 'the exit is a walkable surface tile that knows its cave');
    assert.ok(stepList(api, c.mouth).some(([x, y, z]) => x === c.exit.x && y === c.exit.y && z === 0), 'the mouth leads up to the exit');
    assert.ok(c.deep && c.deep.z === -2 && api.passable(c.deep.x, c.deep.y, -2), 'a deep chamber at level -2');
    const floors = c.tiles.filter(t => api.GROUND[t.ground].walk);
    assert.ok(floors.length >= 10, `a passage of ${floors.length} tiles is too short`);
    assert.ok(c.steps >= 8 && c.steps <= 20, `a passage of ${c.steps} steps`);
    const region = api.reachable(c.exit.x, c.exit.y, 0, full);
    if (!c.blocked) for (const t of floors) assert.ok(region.has(api.idx3(t.x, t.y, t.z)), `cave under hill ${c.hill.x},${c.hill.y}: floor ${t.x},${t.y},${t.z} cannot be reached from the exit`);
    for (const t of c.tiles) assert.ok(c.hill.tiles.includes(api.idx(t.x, t.y)), 'every cave tile lies under the hill');
    assert.ok(c.story.some(s => s.includes('Water cut')), 'the story says water cut it');
  }
});

for (const seed of SEEDS) test(`seed ${seed}: rock fell at the hill feet and blocked some passages`, () => {
  const api = load(); api.startWorld(seed);
  const full = api.levels.length * api.world.length;
  let feet = 0;
  for (const h of api.hills){ const set = new Set(h.tiles);
    let n = 0; for (const i of h.tiles){ const x = i % api.W, y = (i - x) / api.W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const t = api.tileAt(Math.min(api.W - 1, Math.max(0, x + dx)), Math.min(api.H - 1, Math.max(0, y + dy))); if (!set.has(api.idx(t.x, t.y)) && t.feature === 'boulder') n++; } }
    if (n) feet++;
  }
  assert.ok(feet >= api.hills.length / 2, `only ${feet} of ${api.hills.length} hills have boulders at the foot`);
  for (const c of api.caves.filter(c => c.kind === 'water')){
    const region = api.reachable(c.exit.x, c.exit.y, 0, full);
    if (c.blocked){
      assert.equal(c.blocked.ground, 'rock'); assert.ok(c.tiles.includes(c.blocked)); assert.notEqual(c.blocked, c.mouth);
      assert.ok(region.has(api.idx3(c.mouth.x, c.mouth.y, -1)), 'the mouth is still reachable');
      assert.equal(region.has(api.idx3(c.deep.x, c.deep.y, -2)), false, 'the deep chamber is sealed off');
      assert.ok(c.story.some(s => s.includes('Fallen rock')));
    } else {
      assert.ok(region.has(api.idx3(c.deep.x, c.deep.y, -2)), 'an open cave reaches its deep chamber');
    }
  }
});

for (const seed of SEEDS) test(`seed ${seed}: foxes and wolves have dens with one mouth, and start in them`, () => {
  const api = load(); api.startWorld(seed);
  const full = api.levels.length * api.world.length;
  const dens = api.caves.filter(c => c.kind === 'den');
  assert.ok(dens.length >= 1 && dens.length <= 4, `${dens.length} dens`);
  assert.equal(dens.filter(c => c.owner === 'wolf').length, 1, 'one wolf den');
  for (const c of dens){
    const floors = c.tiles.filter(t => api.GROUND[t.ground].walk);
    assert.ok(floors.length >= 2 && floors.length <= 6, `den of ${floors.length} tiles`);
    const tileSet = new Set(c.tiles);
    let mouths = 0; for (const t of floors) if (stepList(api, t).some(([x, y, z]) => !tileSet.has(api.tileAt(x, y, z)))) mouths++;
    assert.equal(mouths, 1, `den at ${c.mouth.x},${c.mouth.y},${c.mouth.z} has ${mouths} tiles touching the outside`);
    assert.ok(c.exit && c.exit.mouth === c && api.passable(c.exit.x, c.exit.y));
    const region = api.reachable(c.exit.x, c.exit.y, 0, full);
    for (const t of floors) assert.ok(region.has(api.idx3(t.x, t.y, t.z)), `den floor ${t.x},${t.y},${t.z} cannot be reached`);
    assert.ok(c.story.some(s => s.includes('Dug by foxes')));
    if (c.owner === 'wolf') assert.ok(c.story.some(s => s.includes('Widened by wolves')));
  }
  for (const sp of ['wolf', 'fox']){
    const homed = api.beings.filter(b => b.species === sp && b.den);
    assert.ok(homed.length >= 1, `no ${sp} starts in a den`);
    for (const b of homed) assert.ok(b.den.tiles.some(t => t.x === b.x && t.y === b.y && t.z === b.z), `${b.name} is not standing in its den`);
  }
});

for (const seed of SEEDS) test(`seed ${seed}: a grove on a forest hill lives in a hollow under it`, () => {
  const api = load(); api.startWorld(seed);
  let under = 0;
  for (const g of api.groves){
    const hill = api.hills.find(h => api.secOf(h.x, h.y).sx === g.sector.sx && api.secOf(h.x, h.y).sy === g.sector.sy);
    if (!hill){ assert.equal(g.cave, null); assert.equal(api.tileAt(g.x, g.y).feature, 'hollow'); continue; }
    under++;
    assert.ok(g.cave && g.cave.kind === 'hollow' && g.cave.owner === 'sprite', 'the grove has a hollow cave');
    const hollowTile = api.tileAt(g.x, g.y);
    assert.equal(hollowTile.feature, 'hollow'); assert.equal(hollowTile.cave, g.cave);
    assert.ok(g.cave.tiles.filter(t => api.passable(t.x, t.y, t.z)).length >= 2, 'room to dance');
    assert.ok(g.cave.exit && g.cave.exit.mouth === g.cave);
    for (const sp of api.beings.filter(b => b.species === 'sprite' && b.grove === g)) assert.ok(g.cave.tiles.some(t => t.x === sp.x && t.y === sp.y && t.z === sp.z), `${sp.name} is not in the hollow`);
    assert.ok(g.cave.story.some(s => s.includes('oldest hollow')));
  }
});

test('standing in a hollow costs the camp favour and the sprites notice', () => {
  /* Use the first test seed whose groves include one under a hill. */
  let A = null, g = null;
  for (const s of SEEDS){ const api = load(); api.startWorld(s); g = api.groves.find(g => g.cave); if (g){ A = api; break; } }
  assert.ok(g, 'no grove under a hill on any test seed');
  const person = A.beings[0]; const floor = g.cave.tiles.find(t => A.passable(t.x, t.y, t.z));
  person.x = floor.x; person.y = floor.y; person.z = floor.z; person.camp.fae.known = true;
  const before = person.camp.fae.favor;
  A.camp = person.camp; A.faeTick();
  assert.equal(person.camp.fae.favor, before - 5);
  assert.ok(person.thoughts.some(t => t.key === 'inhollow'));
  assert.ok(A.beings.some(b => b.species === 'sprite' && b.grove === g && b.thoughts.some(t => t.key === 'intruder')));
});
