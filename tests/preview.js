// The preview of the valley during the ages: previewField and PREVIEW_INK in src/ui/preview.js. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* Join the sim and the preview in one scope, as the page does. Copied from tests/icons.js, which copied it from
   tests/ui.js: that file returns early behind SLOW=1 before it defines anything. `regionOfNow` reads the tile to
   region map, which the sim's own API does not expose. */
function loadUI(files, names, extra = {}){
  const more = Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join(', ');
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',' + (more ? ' ' + more + ',' : ''));
  return new Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}
const fresh = () => loadUI(['preview'], ['PREVIEW_INK', 'previewField'], { regionOfNow: '() => regionOf' });

const SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];
const RING = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/* The whole state during the ages. takeSnapshot() throws before the world is made, so this walks savedValues(),
   the same list of globals the snapshot saves, and adds what the ages hold outside it: the tile to region map,
   the age in progress, and the open turn. A stream is written as its state, so a single draw shows. A second
   visit to an object is written as a reference, because a region points at its parent and its parent back. */
function stateOf(api){
  const seen = new Map();
  const walk = v => {
    if (typeof v === 'function') return v.state ? ['stream', v.state()] : ['fn'];
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return ['ref', seen.get(v)];
    seen.set(v, seen.size);
    if (v instanceof Map) return ['map', [...v].map(([k, x]) => [walk(k), walk(x)])];
    if (v instanceof Set) return ['set', [...v].map(walk)];
    if (ArrayBuffer.isView(v)) return ['typed', Array.from(v)];
    if (Array.isArray(v)) return v.map(walk);
    return Object.fromEntries(Object.keys(v).map(k => [k, walk(v[k])]));
  };
  return JSON.stringify(walk({ saved: api.savedValues(), regionOf: api.regionOfNow(), agePos: api.agePos, pending: api.pending }));
}
const formed = api => new Set(api.liveRegions().filter(r => api.hasMark(r, 'pole')).map(r => r.id));

/* Each soak seed run to the days, once, for the tests that read the finished valley. */
const settled = {};
function settledOf(seed){
  if (settled[seed]) return settled[seed];
  const api = fresh(); api.startCreation(seed);
  for (let n = 0; api.era === 'gods' && n < api.options.ageLimit * 2 + 2; n++) api.step();
  assert.equal(api.era, 'days', `seed ${seed} reaches the days`);
  return (settled[seed] = { api, field: api.previewField() });
}

test('before the first step, every tile is formless', () => {
  const api = fresh(); api.startCreation('r');
  const p = api.previewField();
  assert.equal(p.length, api.W * api.H);
  assert.ok(p.every(k => k === 'formless'), 'every tile is formless');
});

test('previewField writes no state and draws no random number, at the start, in the middle, at the last act, and after the settle', () => {
  /* The first run counts the acts, so the second can stop at the middle one and at the last one. */
  const count = fresh(); count.startCreation('r');
  let acts = 0; while (count.era === 'gods'){ count.step(true); acts++; assert.ok(acts < 10000, 'the creation ends'); }
  const api = fresh(); api.startCreation('r');
  const checkAt = new Set([0, acts >> 1, acts - 1]);
  let checked = 0;
  for (let n = 0; api.era === 'gods'; n++){
    if (checkAt.has(n)){ const before = stateOf(api); api.previewField(); assert.equal(stateOf(api), before, `act ${n} of ${acts}: previewField moved nothing`); checked++; }
    api.step(true);
  }
  assert.equal(checked, 3, 'the start, the middle, and the last act were each checked');
  /* After the settle the real snapshot can be taken, and it holds the streams. */
  const snap = JSON.stringify(api.takeSnapshot()); api.previewField();
  assert.equal(JSON.stringify(api.takeSnapshot()), snap, 'after the settle, previewField moved nothing');
});

/* No region takes its first pole in place. The first act splits the one formless region, and both children are
   born with a pole, under new ids. So the test follows the tiles: a tile whose region had no pole before the act,
   and whose region has one after it, must not be formless after it. */
test('an act that gives ground its first pole shows at once', () => {
  let cases = 0;
  for (const seed of SEEDS){
    const api = fresh(); api.startCreation(seed);
    while (api.era === 'gods'){
      const R0 = api.regionOfNow(), was = formed(api);
      const bare = []; for (let i = 0; i < R0.length; i++) if (!was.has(R0[i])) bare.push(i);
      api.step(true);
      if (api.era !== 'gods') break;
      const now = formed(api), R = api.regionOfNow();
      const turned = bare.filter(i => now.has(R[i]));
      if (!turned.length) continue;
      cases++;
      const p = api.previewField();
      const left = turned.filter(i => p[i] === 'formless');
      assert.equal(left.length, 0, `seed ${seed}, age ${api.age}: ${left.length} of ${turned.length} tiles took a pole and are still formless`);
    }
  }
  assert.ok(cases >= SEEDS.length, `every seed has an act that gives ground its first pole (${cases})`);
});

/* The six soak seeds draw almost no river, lake, or scar, so a field is built by hand to reach each painter. The
   first cut is a dry god's. A wet god cuts one half, so that line is a river that no later split retires. A dry
   god cuts the other half. Each of the four regions gets the marks one painter reads. A burned scar is not here,
   because biomeOf already makes that ground ash. */
test('each painter shows on a hand-built field', () => {
  const api = fresh(); api.startCreation('r');
  const god = pole => ({ id: 0, pole, traits: { patience: 1 } });
  const first = api.splitRegion(api.field.root, god('dry'));
  const a = api.splitRegion(first.a, god('wet')), b = api.splitRegion(first.b, god('dry'));
  const [lake, den, cut, drowned] = [a.a, a.b, b.a, b.b];
  for (const r of [lake, den, cut, drowned]) api.setPole(r, 'dry', null, 'A test.');
  api.mark(lake, 'pool', 'surface', null, 'A test.');
  api.mark(den, 'making', 'wolf', null, 'A test.');
  api.mark(cut, 'scar', 'cut', null, 'A test.'); api.mark(cut, 'scar', 'broken', null, 'A test.');
  api.mark(drowned, 'scar', 'drowned', null, 'A test.'); api.mark(drowned, 'height', 2, null, 'A test.'); api.mark(drowned, 'depth', 1, null, 'A test.');
  const p = api.previewField(), W = api.W;
  const count = (r, kind) => r.tiles.filter(i => p[i] === kind).length;
  const rivers = api.liveBoundaries().filter(x => x.pole === 'wet');
  assert.equal(rivers.length, 1, 'one wet boundary is live');
  for (const x of rivers) x.tiles.forEach((i, k) => assert.equal(p[i], k % 47 >= 23 && k % 47 < 26 ? 'sand' : 'water', `river tile ${k}`));
  /* The bank: the ring round the line, less the line and the water. A hill foot may cover a little of it. */
  const line = new Set(rivers[0].tiles), bank = new Set();
  for (const i of line) for (const [dx, dy] of RING){ const x = i % W + dx, y = (i - i % W) / W + dy; if (x >= 0 && y >= 0 && x < W && y < api.H) bank.add(y * W + x); }
  const dry = [...bank].filter(i => !line.has(i) && p[i] !== 'water');
  assert.ok(dry.length > 0 && dry.filter(i => p[i] === 'sand').length >= 0.9 * dry.length, `the river has a sand bank (${dry.filter(i => p[i] === 'sand').length} of ${dry.length})`);
  /* The lake, at the middle of its region's box, with a sand shore. */
  const { x0, y0, x1, y1 } = lake.bbox;
  assert.equal(p[((y0 + y1) >> 1) * W + ((x0 + x1) >> 1)], 'water', 'the lake stands at the middle');
  /* The river runs along this region too, so its bank is left out of the shore. */
  assert.ok(lake.tiles.some(i => p[i] === 'sand' && !bank.has(i)), 'the lake has a shore');
  /* A hunter was made where no god raised the ground, so the region gets a low hill with no peak. */
  assert.ok(count(den, 'hill') > 0 && count(den, 'peak') === 0, 'the den region has a low hill');
  /* The cut: three stone tiles for the crossing, and the rest of its line is rock. The broken scar leaves boulders. */
  assert.equal(count(cut, 'stone'), 3, 'the cut has a crossing of three');
  assert.ok(count(cut, 'hill') > 3, 'the cut is a line of rock');
  assert.ok(count(cut, 'boulder') > 0, 'the broken ground is strewn with boulders');
  /* The drowned ground, and a hill of two storeys with a cave mouth. */
  assert.ok(count(drowned, 'water') > 0 && count(drowned, 'deadpine') > 0, 'the drowned ground has pools and dead pines');
  assert.ok(count(drowned, 'hill') > 0 && count(drowned, 'peak') > 0, 'the height mark raises a hill with a peak');
  assert.equal(count(drowned, 'mouth'), 1, 'the depth mark opens one mouth');
});

test('every kind has an ink, and every ink is a palette key readPalette reads', () => {
  const api = fresh();
  /* The key lists of readPalette(), from its source text, so a key it never reads fails here. */
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'map.js'), 'utf8');
  const from = src.indexOf('function readPalette'), body = src.slice(from, src.indexOf('\n}', from));
  const lists = [...body.matchAll(/for \(const k of \[([^\]]*)\]\) P\[(k|'field-' \+ k)\]/g)];
  assert.equal(lists.length, 2, 'readPalette has its two key lists');
  const keys = new Set();
  for (const [, list, into] of lists) for (const k of list.match(/'([^']+)'/g).map(q => q.slice(1, -1))) keys.add(into === 'k' ? k : 'field-' + k);
  assert.ok(keys.has('grass') && keys.has('field-none'), 'the parse found both lists');
  for (const [kind, key] of Object.entries(api.PREVIEW_INK)) assert.ok(keys.has(key), `${kind} is inked with ${key}, which readPalette reads`);
  const kinds = new Set();
  for (const seed of SEEDS) for (const k of settledOf(seed).field) kinds.add(k);
  api.startCreation('r'); for (const k of api.previewField()) kinds.add(k);
  for (const k of kinds) assert.ok(k in api.PREVIEW_INK, `${k} has an ink`);
});

/* The preview against the settled valley. The floors were measured on 2026-09-21 for the six soak seeds r, x,
   alpha, beta, gamma, delta, and each is set below the worst seed.
     seed    water kept  water found  worst tree gap  hill tiles / rock tiles
     r       0.336       0.342        0.069           554 / 570    0.97
     x       0.448       0.457        0.105           513 / 176    2.92
     alpha   0.385       0.394        0.172           528 / 823    0.64
     beta    0.421       0.389        0.109           742 / 639    1.16
     gamma   0.339       0.333        0.079           2016 / 1447  1.39
     delta   0.315       0.359        0.134           541 / 960    0.56
   Water agrees at about a third tile by tile, and that is the most it can. A marsh's pools come from noise, and
   the world's noise is drawn from the stream, so the preview's pools lie in the right place and in the right
   share but not on the same tiles. The shares agree: water is 4,528 tiles against 4,450 for r.
   A preview that painted every region as meadow failed two floors on every seed. It found 0.000 to 0.011 of the
   world's water, and its worst tree gap was 0.286 to 0.429. */
const FLOOR = { waterKept: 0.25, waterFound: 0.25, treeGap: 0.22, hillFactor: 3.5 };

for (const seed of SEEDS) test(`seed ${seed}: the preview looks like the valley`, () => {
  const { api, field: p } = settledOf(seed);
  const w = api.world, R = api.regionOfNow();
  let pw = 0, kept = 0, ww = 0, found = 0, hill = 0, rock = 0;
  const reg = {};
  for (let i = 0; i < p.length; i++){
    const wet = w[i].ground === 'water';
    if (p[i] === 'water'){ pw++; if (wet) kept++; }
    if (wet){ ww++; if (p[i] === 'water') found++; }
    if (p[i] === 'hill' || p[i] === 'peak') hill++;
    if (w[i].ground === 'rock') rock++;
    const r = reg[R[i]] || (reg[R[i]] = { n: 0, p: 0, w: 0 }); r.n++; if (p[i] === 'tree') r.p++; if (w[i].feature === 'tree') r.w++;
  }
  assert.ok(p.every(k => k !== 'formless'), 'no tile is formless');
  assert.ok(pw && ww, 'both maps hold water');
  assert.ok(kept / pw >= FLOOR.waterKept, `preview water that is water in the world: ${(kept / pw).toFixed(3)}`);
  assert.ok(found / ww >= FLOOR.waterFound, `world water the preview calls water: ${(found / ww).toFixed(3)}`);
  for (const id in reg){ const r = reg[id], gap = Math.abs(r.p - r.w) / r.n;
    assert.ok(gap <= FLOOR.treeGap, `region ${id}: tree share ${(r.p / r.n).toFixed(3)} in the preview, ${(r.w / r.n).toFixed(3)} in the world`); }
  assert.ok(hill && rock, 'both maps hold hills');
  const factor = Math.max(hill / rock, rock / hill);
  assert.ok(factor <= FLOOR.hillFactor, `hill and peak tiles ${hill} against rock tiles ${rock}: a factor of ${factor.toFixed(2)}`);
});
