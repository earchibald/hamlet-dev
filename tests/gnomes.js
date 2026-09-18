// Gnomes: burrows, hours, borrowing, and leaving. Fast: one world per test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];

for (const seed of SEEDS) test(`seed ${seed}: two or three gnome burrows under the meadow edges, with mushrooms and gnomes at home`, () => {
  const api = load(); api.startWorld(seed);
  const full = api.levels.length * api.world.length;
  const burrows = api.caves.filter(c => c.kind === 'burrow');
  assert.ok(burrows.length >= 2 && burrows.length <= 3, `${burrows.length} burrows`);
  const start = api.beings[0]; const region = api.reachable(start.x, start.y, 0, full);
  for (const c of burrows){
    assert.equal(c.owner, 'gnome');
    assert.ok(c.mouth.slope && c.mouth.z === -1 && c.exit && c.exit.mouth === c);
    assert.ok(region.has(api.idx3(c.exit.x, c.exit.y, 0)), 'the burrow opens onto the walkable world');
    assert.ok(api.dist(c.exit.x, c.exit.y, start.x, start.y) >= 25, 'not beside the start');
    assert.equal(api.sectorOfTile(c.exit).biome, 'meadow');
    assert.ok(c.patch.length >= 4 && c.patch.every(t => t.feature === 'mushrooms' && api.dist(t.x, t.y, c.exit.x, c.exit.y) <= 3), 'a mushroom patch by the mouth');
    const kin = api.beings.filter(b => b.species === 'gnome' && b.den === c);
    assert.ok(kin.length >= 2 && kin.length <= 3, `${kin.length} gnomes`);
    for (const g of kin) assert.ok(c.tiles.some(t => t.x === g.x && t.y === g.y && t.z === g.z), 'each gnome starts in its burrow');
  }
  assert.ok(api.LIFE.gnome && api.SPECIES.gnome && api.SPECIES.gnome.glyph === 'g');
});

test('mushrooms regrow on their patch', () => {
  const api = load(); api.startWorld('r');
  const c = api.caves.find(c => c.kind === 'burrow'); const t = c.patch[0]; t.shrooms = 0;
  let grew = false; for (let k = 0; k < 4000 && !grew; k++){ api.growPlants(); grew = t.shrooms > 0; }
  assert.ok(grew, 'no mushrooms in 4000 samples');
});
