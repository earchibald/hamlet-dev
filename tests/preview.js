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
    if (checkAt.has(n)){
      const before = stateOf(api);
      const p1 = api.previewField();
      assert.equal(stateOf(api), before, `act ${n} of ${acts}: previewField moved nothing`);
      const p2 = api.previewField();
      assert.deepEqual(p2, p1, `act ${n} of ${acts}: two calls to previewField returned different fields`);
      checked++;
    }
    api.step(true);
  }
  assert.equal(checked, 3, 'the start, the middle, and the last act were each checked');
  /* After the settle the real snapshot can be taken, and it holds the streams. */
  const snap = JSON.stringify(api.takeSnapshot());
  const p1 = api.previewField();
  assert.equal(JSON.stringify(api.takeSnapshot()), snap, 'after the settle, previewField moved nothing');
  const p2 = api.previewField();
  assert.deepEqual(p2, p1, 'after the settle, two calls to previewField returned different fields');
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
function handBuilt(api){
  const god = pole => ({ id: 0, pole, traits: { patience: 1 } });
  const first = api.splitRegion(api.field.root, god('dry'));
  const a = api.splitRegion(first.a, god('wet')), b = api.splitRegion(first.b, god('dry'));
  const [lake, den, cut, drowned] = [a.a, a.b, b.a, b.b];
  for (const r of [lake, den, cut, drowned]) api.setPole(r, 'dry', null, 'A test.');
  api.mark(lake, 'pool', 'surface', null, 'A test.');
  api.mark(den, 'making', 'wolf', null, 'A test.');
  api.mark(cut, 'scar', 'cut', null, 'A test.'); api.mark(cut, 'scar', 'broken', null, 'A test.');
  api.mark(drowned, 'scar', 'drowned', null, 'A test.'); api.mark(drowned, 'height', 2, null, 'A test.'); api.mark(drowned, 'depth', 1, null, 'A test.');
  return { lake, den, cut, drowned };
}
test('each painter shows on a hand-built field', () => {
  const api = fresh(); api.startCreation('r');
  const { lake, den, cut, drowned } = handBuilt(api);
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

/* The key lists of readPalette(), from its source text, so a key it never reads is not in the set. */
function paletteKeys(){
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'map.js'), 'utf8');
  const from = src.indexOf('function readPalette'), body = src.slice(from, src.indexOf('\n}', from));
  const lists = [...body.matchAll(/for \(const k of \[([^\]]*)\]\) P\[(k|'field-' \+ k)\]/g)];
  assert.equal(lists.length, 2, 'readPalette has its two key lists');
  const keys = new Set();
  for (const [, list, into] of lists) for (const k of list.match(/'([^']+)'/g).map(q => q.slice(1, -1))) keys.add(into === 'k' ? k : 'field-' + k);
  assert.ok(keys.has('grass') && keys.has('field-none'), 'the parse found both lists');
  return keys;
}
test('every kind has an ink, and every ink is a palette key readPalette reads', () => {
  const api = fresh();
  const keys = paletteKeys();
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

/* ---- the gods' map, drawn from the preview ---- */

/* A 2D context that draws nothing. It keeps each fill with its place, its colour and its alpha, and every colour
   set as fillStyle, in order. The setters stand in for the canvas state, as in tests/icons.js. */
function fillCtx(){
  const c = { fills: [], styles: [], ink: '', alpha: 1, measureText: () => ({ width: 40 }) };
  for (const k of ['setTransform', 'clearRect', 'strokeRect', 'drawImage', 'beginPath', 'arc', 'stroke', 'fill', 'save', 'restore', 'translate', 'rotate', 'scale', 'fillText', 'strokeText', 'closePath', 'moveTo', 'lineTo']) c[k] = () => {};
  c.fillRect = (x, y) => { c.fills.push({ x, y, style: c.ink, alpha: c.alpha }); };
  Object.defineProperty(c, 'fillStyle', { set(v){ c.ink = v; c.styles.push(v); }, get(){ return c.ink; } });
  Object.defineProperty(c, 'globalAlpha', { set(v){ c.alpha = v; }, get(){ return c.alpha; } });
  return c;
}
/* A palette with a colour of its own for every key, so a fill names the one key it came from. */
function distinctPalette(){
  const P = {};
  [...paletteKeys(), 'void', 'bg', 'map-halo'].forEach((k, n) => { P[k] = '#' + (n + 1).toString(16).padStart(6, '0'); });
  return P;
}
/* The field and the map code in one scope, with the view globals drawField reads. The two spies reassign a
   function declared in the joined scope, so the code that calls it by name reaches the wrapper. */
function drawRig(){
  const api = loadUI(['state', 'icons', 'derive', 'preview', 'marks', 'map', 'dialogs', 'actions'],
    ['PREVIEW_INK', 'previewField', 'drawFieldCache', 'drawField', 'WS'], {
      setUp: '(o) => { wctx = o.wctx; ocv = o.ocv; octx = o.octx; dpr = 1; P = o.P; pace = 1; acc = 0; paused = false; ui.playing = false; beatsLastFrame = 1; fieldPreview = null; }',
      fieldKeyNow: '() => fieldKey',
      setAcc: '(v) => { acc = v; }',
      spyPreview: '(fn) => { previewField = fn; }',
      spyCache: '(fn) => { drawFieldCache = fn; }',
    });
  const P = distinctPalette(), octx = fillCtx(), wctx = fillCtx();
  global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fillCtx() }), querySelector: () => null };
  global.Path2D = function(d){ this.d = d; };
  return { api, P, octx, set: () => api.setUp({ wctx, octx, ocv: { width: 100, height: 100 }, P }) };
}
/* The colour of each tile after the ground pass. The ground is the fills at full alpha; the lines are fainter. */
function groundOf(rig){
  const { api, octx } = rig, at = new Map();
  for (const f of octx.fills) if (f.alpha === 1) at.set((f.y / api.WS) * api.W + f.x / api.WS, f.style);
  return at;
}
/* Three fields: the one grey field before the first act, a hand-built field that reaches every painter, and a
   real creation four ages in. */
const FIELDS = {
  'the first field': api => {},
  'the hand-built field': api => { handBuilt(api); },
  'seed r at age 4': api => { for (let k = 0; k < 4 && api.era === 'gods'; k++) api.step(); },
};

test('drawFieldCache fills each tile with the colour of its preview kind, and sets each colour once', () => {
  for (const [name, make] of Object.entries(FIELDS)){
    const rig = drawRig(), { api, P, octx } = rig;
    api.startCreation('r'); make(api); rig.set();
    api.drawFieldCache();
    const p = api.previewField(), at = groundOf(rig);
    const fills = octx.fills.filter(f => f.alpha === 1).length;
    assert.equal(fills, p.length, `${name}: the ground pass fills every tile once (${fills} fills for ${p.length} tiles)`);
    const kinds = [...new Set(p)];
    for (const kind of kinds){
      const tiles = p.map((k, i) => k === kind ? i : -1).filter(i => i >= 0), step = Math.max(1, Math.floor(tiles.length / 40));
      for (let n = 0; n < tiles.length; n += step){
        const i = tiles[n];
        assert.equal(at.get(i), P[api.PREVIEW_INK[kind]], `${name}: tile ${i} is ${kind}, and it was filled with ${at.get(i)}, not ${P[api.PREVIEW_INK[kind]]}`);
      }
    }
    /* One colour per kind for the ground, then the one line colour. */
    assert.equal(octx.styles.length, kinds.length + 1, `${name}: ${octx.styles.length} colours set for ${kinds.length} kinds and the lines`);
    if (name === 'the hand-built field') assert.ok(kinds.length >= 8, `the hand-built field holds ${kinds.length} kinds`);
  }
});

test('drawFieldCache sets no field colour but field-none and field-line', () => {
  let none = 0;
  for (const [name, make] of Object.entries(FIELDS)){
    const rig = drawRig(), { api, P, octx } = rig;
    api.startCreation('r'); make(api); rig.set();
    api.drawFieldCache();
    const banned = new Map(Object.keys(P).filter(k => k.startsWith('field-') && k !== 'field-none' && k !== 'field-line').map(k => [P[k], k]));
    assert.ok(banned.size >= 10, `${banned.size} field colours are banned`);
    for (const s of octx.styles) assert.ok(!banned.has(s), `${name}: drawFieldCache set ${banned.get(s)} as a fill`);
    if (octx.styles.includes(P['field-none'])) none++;
  }
  assert.ok(none >= 1, 'the first field is filled with field-none');
});

test('in the ages a boundary is a faint line in field-line, a river is not a line, and a skipped cut is not drawn', () => {
  for (const name of ['the hand-built field', 'seed r at age 4']){
    const rig = drawRig(), { api, P, octx } = rig;
    api.startCreation('r'); FIELDS[name](api); rig.set();
    const live = api.liveBoundaries(), dry = live.filter(b => b.pole !== 'wet');
    assert.ok(dry.length >= 1, `${name} has a dry boundary`);
    if (name === 'the hand-built field') assert.ok(live.some(b => b.pole === 'wet'), 'the hand-built field has a wet boundary');
    const lined = skip => {
      octx.fills.length = 0; api.drawFieldCache(skip);
      const lines = octx.fills.filter(f => f.alpha !== 1);
      for (const f of lines){
        assert.equal(f.alpha, 0.25, 'a line is drawn at alpha 0.25');
        assert.equal(f.style, P['field-line'], 'a line is drawn in field-line');
      }
      return new Set(lines.map(f => (f.y / api.WS) * api.W + f.x / api.WS));
    };
    const want = bs => new Set(bs.flatMap(b => b.tiles));
    assert.deepEqual(lined(null), want(dry), `${name}: the lines are the tiles of every dry boundary, and no other tile`);
    const cut = dry[dry.length - 1];
    assert.deepEqual(lined(new Set([cut.id])), want(dry.slice(0, -1)), `${name}: a skipped boundary is not drawn`);
  }
});

test('drawField computes the preview once per act, and reuses it when a cut is drawn again', () => {
  const rig = drawRig(), { api } = rig;
  api.startCreation('gamma'); rig.set();
  const realPreview = api.previewField, realCache = api.drawFieldCache;
  let previews = 0, caches = 0;
  api.spyPreview(() => { previews++; return realPreview(); });
  api.spyCache(skip => { caches++; return realCache(skip); });
  let beats = 0, acts = 0, redrawn = 0;
  while (api.era === 'gods' && beats < 40 && (acts < 5 || redrawn < 2)){
    /* A beat can end an age and write no gesture. Its field key is the same, and so is its field. */
    const key = api.fieldKeyNow();
    api.step(true); beats++;
    previews = 0; caches = 0;
    /* Mid-beat, twice, as two frames. Then the end of the beat, where a cut's stroke is done. */
    api.setAcc(0.5); api.drawField(); api.drawField();
    api.setAcc(1); api.drawField();
    const moved = api.fieldKeyNow() !== key;
    if (moved) acts++;
    assert.equal(previews, moved ? 1 : 0, `beat ${beats}: the preview was computed ${previews} times, and the act ${moved ? 'changed' : 'did not change'}`);
    assert.ok(caches <= 2, `beat ${beats}: the cache was drawn ${caches} times`);
    if (caches === 2) redrawn++;
  }
  assert.ok(acts >= 5, `${acts} acts in ${beats} beats`);
  assert.ok(redrawn >= 2, `${redrawn} acts drew the cache again for a cut, in ${beats} beats`);
});

/* The player never sees a country. This sweep collects every kind of text a player can read and
   keeps the source with each string, so a match names where it came from. Each source is checked
   for the internal word before it is checked against the rest: a source that collects nothing would
   otherwise pass for the same reason a true absence does. */
function playerText(){
  const sources = {};

  /* One creation run to the first day, on seed r. watchChronicle takes every line as it is
     written, because the chronicle itself keeps only its last 300. */
  const chronApi = sim.load();
  const events = [];
  chronApi.watchChronicle(events);
  chronApi.startWorld('r');
  for (let i = 0; i < chronApi.DAY; i++) chronApi.step();
  sources.chronicle = events.map(e => e.text);

  /* In the ages: the status line, and every live region's and every god's own card, taken once the
     first regions and gods exist. Every gesture's card, taken across the whole creation, since
     creation.gestures holds only the age now playing. */
  const api = loadUI(['state', 'icons', 'marks', 'derive', 'keys', 'map', 'inspect'],
    ['seasonLine', 'countryLine', 'inspectRegion', 'inspectGod', 'actCard', 'markRows', 'KEYMAP']);
  api.startCreation('r');
  const seenGestures = new Set();
  let capturedAges = false;
  while (api.era === 'gods'){
    api.step();
    for (const rec of api.creation.gestures) seenGestures.add(rec);
    if (!capturedAges && api.liveRegions().length && api.gods().length){
      sources.seasonLine = [api.seasonLine()];
      sources.countryLine = api.liveRegions().map(r => api.countryLine(r));
      sources.inspectRegion = api.liveRegions().map(r => api.inspectRegion(r));
      sources.inspectGod = api.gods().map(g => api.inspectGod(g));
      capturedAges = true;
    }
  }
  sources.actCard = [...seenGestures].flatMap(rec => {
    const card = api.actCard(rec);
    return [card.head, ...card.rows.map(r => String(r.value))];
  });

  /* After settle: markRows of one surface tile of each region. */
  sources.markRows = api.liveRegions().flatMap(r => {
    for (const i of r.tiles){
      const x = i % api.W, y = (i - x) / api.W;
      if (api.hasTile(x, y, 0)) return api.markRows(x, y, 0).map(row => String(row[1]));
    }
    return [];
  });

  /* The label of every KEYMAP row. */
  sources.keymapLabels = api.KEYMAP.map(row => row.label);

  /* The page shell: the title of every element, and its text with the tags taken out. */
  const pageHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'page.template.html'), 'utf8');
  sources.pageTitles = [...pageHtml.matchAll(/title="([^"]*)"/g)].map(m => m[1]);
  sources.pageText = pageHtml.replace(/<[^>]*>/g, ' ').split(/\s{2,}|\n/).map(s => s.trim()).filter(Boolean);

  /* The label of the thought a god gets when another god marks over its land, read from the raw
     source text of gods.js, so nothing needs to be run to see the template. */
  const godsSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'sim', 'gods.js'), 'utf8');
  const thoughtMatch = godsSrc.match(/addThought\(o, 'over' \+ g\.id, `([^`]*)`/);
  assert.ok(thoughtMatch, 'the marked-over thought was not found in gods.js');
  sources.markedOverThought = [thoughtMatch[1]];

  /* The text inject() returns for a choose act whose option names no type. Become the first god,
     step until its turn opens a pending matrix, then choose an empty option. */
  const doorApi = sim.load();
  doorApi.startCreation('r');
  let guard = 0;
  while (!doorApi.gods().length && guard++ < 50) doorApi.step();
  assert.ok(doorApi.gods().length, 'no god was born to become');
  const g = doorApi.gods()[0];
  doorApi.inject({ source: 'player', act: 'become', id: g.id });
  guard = 0;
  while (!doorApi.pending && doorApi.era === 'gods' && guard++ < 2000) doorApi.step();
  assert.ok(doorApi.pending, 'never opened a turn to test choose() with no type');
  sources.doorNoType = [doorApi.inject({ source: 'player', act: 'choose', opt: {} })];

  return sources;
}

test('no text the player reads says "country", and every source in the sweep is not empty', () => {
  const sources = playerText();
  for (const [name, list] of Object.entries(sources)){
    assert.ok(Array.isArray(list) && list.length > 0, `${name} collected nothing`);
    for (const text of list) assert.doesNotMatch(String(text), /countr/i, `${name}: "${text}"`);
  }
});
