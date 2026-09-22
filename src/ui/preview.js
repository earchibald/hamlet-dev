/* ---- the preview: the ground the marks will become ---- During the ages the map has regions and marks but no
   tiles. settle() paints the tiles later, and it draws from the people's stream to do it. The preview paints an
   impression of that valley from the same marks, in the same order, with hashes in place of random numbers. It
   draws no random number and writes no state, so a view can call it as often as it draws. It matches the valley
   by kind of ground and by share, not tile by tile. No DOM. */

/* Each kind the preview paints, and the palette key of its colour. The keys are ones readPalette() in map.js
   reads, so the gods' map and the world map share one set of colours. */
const PREVIEW_INK = {
  formless: 'field-none', grass: 'grass', soil: 'soil', sand: 'sand', water: 'water', ash: 'ash', stone: 'stone',
  tree: 'tree', bush: 'bush', reeds: 'reeds', boulder: 'boulder', deadpine: 'ash-fg', hill: 'hill', peak: 'hill-fg', mouth: 'hill-fg',
};
/* One stream of hashes per purpose. A shared salt would tie two choices together, and a tree would then always
   stand where a hill is placed. */
const PV = { e: 1, f: 2, h1: 3, h2: 4, h3: 5, hillJit: 6, drown: 7, hillPick: 8, lakeJit: 1000 };
/* A hash of the seed, a salt and a tile, in [0, 1). Each input is mixed in turn, so a row or a column shows no
   pattern. */
function pvMix(h){ h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); return h ^ (h >>> 16); }
function pvHash(s, k, x, y){ return (pvMix(pvMix(pvMix(s ^ Math.imul(k, 0x9e3779b1)) ^ x) ^ y) >>> 0) / 4294967296; }
/* Value noise as makeNoise builds it, with a lattice of hashes in place of a lattice of draws. */
function pvNoise(s, k, scale){
  const sm = t => t * t * (3 - 2 * t), v = (i, j) => pvHash(s, k, i, j);
  return (x, y) => {
    const fx = x / scale, fy = y / scale, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * tx, b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
}
/* The texture of a biome on one tile, as paintTile gives it. Loose sticks and stones are too small to show. */
function pvTile(biome, e, f, h1, h2, h3){
  switch (biome){
    case 'forest': return f > 0.4 && h1 < 0.55 ? 'tree' : h2 < 0.06 ? 'bush' : 'grass';
    case 'meadow': case 'river': return f > 0.7 && h1 < 0.3 ? 'tree' : h2 < 0.045 ? 'bush' : e < 0.3 && h3 < 0.2 ? 'soil' : 'grass';
    case 'rocky': return e > 0.55 && h1 < 0.5 ? 'boulder' : h2 < 0.3 ? 'soil' : h3 < 0.03 ? 'tree' : 'grass';
    case 'wetland': return e < 0.42 ? 'water' : e < 0.5 && h1 < 0.5 ? 'reeds' : h2 < 0.03 ? 'bush' : h3 < 0.04 ? 'tree' : 'grass';
    case 'ash': return 'ash';
  }
  return 'grass';
}
const PV_HILL = { hill: true, peak: true, mouth: true };
/* The field as it stands now, one kind per surface tile. The steps run in settle's order: ground, rivers, lakes,
   scars, hills, and cave mouths. A region with no pole is formless, and no later step paints over it, because
   the gods have not yet said what that ground is. */
function previewField(){
  const out = new Array(W * H).fill('formless');
  const s = hashSeed(seedText);
  const at = i => [i % W, (i - i % W) / W];
  const h = (k, i) => pvHash(s, k, i % W, (i - i % W) / W);
  const put = (i, kind) => { if (out[i] !== 'formless') out[i] = kind; };
  const live = liveRegions().filter(r => hasMark(r, 'pole'));
  /* Ground. */
  const en = pvNoise(s, PV.e, 9), fn = pvNoise(s, PV.f, 5);
  for (const r of live){ const b = biomeOf(r); for (const i of r.tiles){ const [x, y] = at(i); out[i] = pvTile(b, en(x, y), fn(x, y), h(PV.h1, i), h(PV.h2, i), h(PV.h3, i)); } }
  /* Rivers, as paintRivers: the line and its far side are water, a ford is sand, and the ring beside the line is sand. */
  const river = new Uint8Array(W * H);
  for (const b of liveBoundaries()){
    if (b.pole !== 'wet') continue;
    b.tiles.forEach((i, k) => {
      const [x, y] = at(i), ford = k % 47 >= 23 && k % 47 < 26;
      const wet = [[0, 0]].concat(DIRS.filter(([dx, dy]) => inb(x + dx, y + dy) && regionOf[idx(x + dx, y + dy)] === b.b));
      for (const [dx, dy] of wet){ const j = idx(x + dx, y + dy); put(j, ford ? 'sand' : 'water'); river[j] = 1; }
    });
    for (const i of b.tiles){ const [x, y] = at(i);
      for (const [dx, dy] of RING){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (out[j] !== 'water' && !river[j]) put(j, 'sand'); } }
  }
  /* Lakes, as paintLakes: a blob at the middle of a pooled region, with a sand shore inside the region. */
  const lake = new Uint8Array(W * H);
  for (const r of live){
    if (!hasMark(r, 'pool', 'surface')) continue;
    const { x0, y0, x1, y1 } = r.bbox, cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1;
    const rad = Math.sqrt(Math.round(r.area / 7) / Math.PI), jit = pvNoise(s, PV.lakeJit + r.id, 6);
    for (const i of r.tiles){ const [x, y] = at(i); if (Math.hypot(x - cx, y - cy) / rad + (jit(x, y) - 0.5) * 0.6 <= 1){ put(i, 'water'); lake[i] = 1; } }
    for (const i of r.tiles){ if (out[i] === 'water') continue; const [x, y] = at(i); if (RING.some(([dx, dy]) => inb(x + dx, y + dy) && lake[idx(x + dx, y + dy)])) put(i, 'sand'); }
  }
  /* Scars, by what the winner's pole left. */
  const scar = {
    burned: r => { for (const i of r.tiles) if (out[i] === 'grass' || out[i] === 'soil' || out[i] === 'tree' || out[i] === 'bush') out[i] = 'ash'; },
    /* The middle line, as scarCut picks it. The three tiles at its middle are the crossing. */
    cut: r => {
      const { x0, y0, x1, y1 } = r.bbox, alongX = (x1 - x0) >= (y1 - y0);
      const line = r.tiles.filter(i => { const [x, y] = at(i); return alongX ? y === ((y0 + y1) >> 1) : x === ((x0 + x1) >> 1); });
      const gap = line.length >> 1;
      line.forEach((i, k) => { out[i] = Math.abs(k - gap) <= 1 ? 'stone' : 'hill'; });
    },
    drowned: r => {
      const picks = r.tiles.slice().sort((p, q) => h(PV.drown, p) - h(PV.drown, q) || p - q).slice(0, 3);
      for (const c of picks){ const [cx, cy] = at(c);
        for (const i of r.tiles){ const [x, y] = at(i), d = Math.hypot(x - cx, y - cy);
          if (d <= 5) out[i] = 'water'; else if (d <= 7 && out[i] === 'grass' && h(PV.h1, i) < 0.5) out[i] = 'deadpine'; } }
    },
    broken: r => { for (const i of r.tiles) if (out[i] === 'grass' && h(PV.h1, i) < 0.34) out[i] = 'boulder'; },
  };
  for (const r of live) for (const m of marksOf(r, 'scar')) if (scar[m.value]) scar[m.value](r);
  /* Hills, as uplift places them, with hashes in place of its tries. A foot keeps off the map edge and three
     tiles from water and from sand. Returns how many hills stood up. */
  const hillJit = pvNoise(s, PV.hillJit, 6);
  const raise = (r, storeys, count) => {
    const rx = Math.min(12, 4 + 2 * storeys), ry = Math.round(rx * 0.75), gap = 2 * rx + 3;
    const dry = i => { const [x, y] = at(i); if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return false;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++){ if (!inb(x + dx, y + dy)) continue; const q = out[idx(x + dx, y + dy)]; if (q === 'water' || q === 'sand') return false; }
      return true; };
    const picks = r.tiles.filter(dry).sort((p, q) => h(PV.hillPick, p) - h(PV.hillPick, q) || p - q);
    const made = [];
    for (const c of picks){
      if (made.length >= count) break;
      const [cx, cy] = at(c);
      if (made.some(([mx, my]) => Math.hypot(cx - mx, cy - my) < gap)) continue;
      made.push([cx, cy]);
      for (const i of r.tiles){ if (out[i] === 'water') continue; const [x, y] = at(i), j = (hillJit(x, y) - 0.5) * 0.5;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + j > 1) continue;
        out[i] = storeys >= 2 && ((x - cx) / (rx * 0.6)) ** 2 + ((y - cy) / (ry * 0.6)) ** 2 + j <= 1 ? 'peak' : 'hill'; }
    }
    return made.length;
  };
  for (const r of live){ const m = marksOf(r, 'height')[0]; if (m) raise(r, clamp(m.value, 1, ZMAX), clamp(Math.round(r.area / (4 * SECTOR_AREA)), 1, 3)); }
  /* A hunter dens in a hillside, so a region where one was made, and no god raised the ground, gets a low hill. */
  for (const r of live) if (!hasMark(r, 'height') && marksOf(r, 'making').some(m => SPAWN[m.value] && SPAWN[m.value].den)) raise(r, 1, 1);
  /* A cave needs rock over it. Its mouth is the rim tile of the hill nearest the region's heart. */
  for (const r of live){
    if (!hasMark(r, 'depth')) continue;
    if (!r.tiles.some(i => out[i] === 'hill' || out[i] === 'peak')) raise(r, 1, 1);
    const [hx, hy] = at(heartTile(r));
    let best = -1, bd = Infinity;
    for (const i of r.tiles){
      if (out[i] !== 'hill' && out[i] !== 'peak') continue;
      const [x, y] = at(i);
      if (!DIRS.some(([dx, dy]) => inb(x + dx, y + dy) && !PV_HILL[out[idx(x + dx, y + dy)]])) continue;
      const d = (x - hx) ** 2 + (y - hy) ** 2; if (d < bd){ bd = d; best = i; }
    }
    if (best >= 0) out[best] = 'mouth';
  }
  return out;
}
