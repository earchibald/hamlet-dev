// The field that divides, and the marks on it. Fast: no tiles are painted.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

const patient = { id: 900, pole: 'wet', traits: { patience: 1 } };
const restless = { id: 901, pole: 'hot', traits: { patience: 0 } };

function fresh(seed = 'r'){ const api = load(); api.startWorld(seed); api.initField(); return api; }

test('the field starts as one region holding every tile', () => {
  const api = fresh();
  const root = api.field.root;
  assert.equal(api.liveRegions().length, 1);
  assert.equal(root.area, api.W * api.H);
  assert.deepEqual(root.bbox, { x0: 0, y0: 0, x1: api.W - 1, y1: api.H - 1 });
  assert.deepEqual(root.marks, []);
  assert.equal(api.regionAt(5, 5), root);
  assert.equal(api.canSplit(root), true);
});

test('a patient god draws a straight line and both children keep a sector of tiles', () => {
  const api = fresh();
  const root = api.field.root;
  const cut = api.splitRegion(root, patient);
  assert.ok(cut, 'no cut');
  assert.deepEqual(root.children, [cut.a.id, cut.b.id]);
  assert.equal(cut.a.area + cut.b.area, root.area);
  assert.ok(cut.a.area >= api.SECTOR_AREA && cut.b.area >= api.SECTOR_AREA);
  assert.equal(api.liveRegions().length, 2);
  assert.equal(cut.a.parent, root.id); assert.equal(cut.a.by, 900);
  /* The root is wider than tall, so the cut runs across x: a straight line is one column. */
  const xs = new Set(cut.boundary.tiles.map(i => i % api.W));
  assert.equal(xs.size, 1);
  assert.equal(cut.boundary.pole, 'wet');
  assert.ok(cut.boundary.tiles.length >= api.H - 1);
  /* Every boundary tile is in a and touches b. */
  for (const i of cut.boundary.tiles){
    assert.equal(api.regionAt(i % api.W, Math.floor(i / api.W)), cut.a);
    const x = i % api.W, y = Math.floor(i / api.W);
    assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => api.regionAt(x + dx, y + dy) === cut.b));
  }
  assert.deepEqual(api.neighboursOf(cut.a).map(r => r.id), [cut.b.id]);
});

test('a restless god draws a winding line', () => {
  const api = fresh();
  const cut = api.splitRegion(api.field.root, restless);
  const xs = new Set(cut.boundary.tiles.map(i => i % api.W));
  assert.ok(xs.size >= 3, `the line used ${xs.size} columns`);
});

test('children inherit marks, and a region stops splitting at sector size', () => {
  const api = fresh();
  const root = api.field.root;
  api.setPole(root, 'dark', restless, 'test');
  const cut = api.splitRegion(root, patient);
  assert.ok(api.hasPole(cut.a, 'dark') && api.hasPole(cut.b, 'dark'));
  assert.ok(cut.a.marks[0].inherited);
  /* Split down until nothing can split. Every live region keeps at least a sector. */
  let n = 0;
  for (let guard = 0; guard < 200; guard++){ const r = api.liveRegions().find(api.canSplit); if (!r) break; if (api.splitRegion(r, patient)) n++; }
  assert.ok(n >= 10, `only ${n} splits`);
  for (const r of api.liveRegions()){ assert.ok(r.area >= api.SECTOR_AREA); assert.equal(api.canSplit(r), false); }
  assert.equal(api.liveRegions().reduce((s, r) => s + r.area, 0), api.W * api.H);
});

test('a region holds one pole per contrast', () => {
  const api = fresh();
  const r = api.field.root;
  api.setPole(r, 'wet', patient, 'first');
  api.setPole(r, 'dry', restless, 'second');
  assert.equal(api.poleOf(r, 'water'), 'dry');
  assert.equal(api.marksOf(r, 'pole').length, 1);
  api.setPole(r, 'hot', restless, 'third');
  assert.equal(api.marksOf(r, 'pole').length, 2);
  assert.equal(api.hasPole(r, 'wet'), false);
  assert.equal(api.POLES.wet.other, 'dry'); assert.equal(api.POLES.above.contrast, 'height');
});

test('biomes come from the mark table', () => {
  const api = fresh();
  const r = api.field.root;
  assert.equal(api.biomeOf(r), 'meadow');
  api.setPole(r, 'wet', patient, ''); api.setPole(r, 'moving', patient, ''); assert.equal(api.biomeOf(r), 'river');
  api.setPole(r, 'still', patient, ''); assert.equal(api.biomeOf(r), 'wetland');
  api.setPole(r, 'dry', patient, ''); api.setPole(r, 'cold', patient, ''); assert.equal(api.biomeOf(r), 'forest');
  api.setPole(r, 'hot', patient, ''); assert.equal(api.biomeOf(r), 'meadow');
  api.setPole(r, 'above', patient, ''); assert.equal(api.biomeOf(r), 'rocky');
  api.mark(r, 'scar', 'burned', patient, ''); assert.equal(api.biomeOf(r), 'ash');
  assert.equal(api.GROWS.forest, true); assert.equal(api.GROWS.ash, false);
});

test('poleShare is the share of the live field that carries a pole', () => {
  const api = fresh();
  const cut = api.splitRegion(api.field.root, patient);
  api.setPole(cut.a, 'wet', patient, '');
  const share = api.poleShare('wet');
  assert.ok(Math.abs(share - cut.a.area / (api.W * api.H)) < 1e-9);
  assert.equal(api.poleShare('dry'), 0);
});

test('the era, the age, and the stamp', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.era, 'days'); assert.equal(api.age, 0); assert.deepEqual(api.legends, []);
  assert.equal(api.SPECIES.rabbit.prey, true); assert.equal(api.SPECIES.deer.prey, true); assert.equal(api.SPECIES.wolf.prey, undefined);
  assert.deepEqual(api.options, { sw: 10, sh: 6, zmin: -2, zmax: 2, ageLimit: 200 });
});
