// Terrain: levels, slopes, species limits, and hills. Fast: one world per test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

test('the surface is level 0 and the levels below are empty', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.levels.length, 5);
  assert.equal(api.levels[api.ZOFF], api.world);
  for (const z of [-2, -1]) assert.ok(api.levels[z + api.ZOFF].every(t => t === null), `level ${z} should hold nothing yet`);
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
  for (const h of api.hills){
    const floors = api.raised.filter(t => t.hill === h && api.GROUND[t.ground].walk);
    assert.ok(floors.length > 0, `hill at ${h.x},${h.y} has no floor`);
    assert.ok(floors.some(t => t.z === h.storeys), `hill at ${h.x},${h.y} should reach level ${h.storeys}`);
    for (const i of h.tiles){
      const t = api.world[i];
      assert.equal(t.ground, 'rock', `hill at ${h.x},${h.y}: footprint tile ${t.x},${t.y} is ${t.ground}`);
      const s = api.secOf(t.x, t.y); assert.ok(!(s.sx === start.sx && s.sy === start.sy), 'a hill in the start sector');
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++){ const q = api.tileAt(Math.min(api.W - 1, Math.max(0, t.x + dx)), Math.min(api.H - 1, Math.max(0, t.y + dy))); assert.notEqual(q.ground, 'water', `hill at ${h.x},${h.y} touches water`); }
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
