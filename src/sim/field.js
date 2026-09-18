/* ---------- the field that divides ----------
   Before the world has tiles it has regions. One region holds everything at the start. A god's act
   splits a region in two along a line the god draws, and place is made by division. A region stops
   splitting at sector size. Sectors stay as they are for viewing; at settle a sector takes its biome
   from the region that covers most of it. regionOf maps each tile to the live region that holds it. */
const SECTOR_AREA = LW * LH;
let regionOf = null;
function initField(){
  regionOf = new Int32Array(W * H);
  const tiles = new Array(W * H); for (let i = 0; i < W * H; i++) tiles[i] = i;
  field = { regions: [], root: null, byId: new Map() };
  boundaries = [];
  field.root = addRegion(tiles, null, null, 0);
  return field.root;
}
function addRegion(tiles, parent, by, at){
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (const i of tiles){ const x = i % W, y = (i - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const r = { id: nextId++, tiles, area: tiles.length, bbox: { x0, y0, x1, y1 }, parent, by, age: at, marks: [], children: null, lastBy: null, lastAge: -1 };
  field.regions.push(r); field.byId.set(r.id, r);
  for (const i of tiles) regionOf[i] = r.id;
  return r;
}
const regionById = id => field.byId.get(id);
const liveRegions = () => field.regions.filter(r => !r.children);
const regionAt = (x, y) => inb(x, y) ? regionById(regionOf[idx(x, y)]) : null;
const canSplit = r => !r.children && r.area >= 2 * SECTOR_AREA && !r.marks.some(m => m.kind === 'rest');
/* The live regions that share an edge with r. */
function neighboursOf(r){
  const seen = new Set();
  for (const i of r.tiles){ const x = i % W, y = (i - x) / W;
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const id = regionOf[idx(nx, ny)]; if (id !== r.id) seen.add(id); } }
  return [...seen].map(regionById);
}
/* The boundaries between live regions. A boundary whose side has since been split is history, not a place. */
const liveBoundaries = () => boundaries.filter(b => { const A = regionById(b.a), B = regionById(b.b); return A && !A.children && B && !B.children; });
/* Split r across its longer side. A patient god draws a straight line; a restless one draws a winding
   one from noise. Each child keeps at least a sector of tiles, and inherits the parent's marks. The
   boundary is the line of a's tiles that touch b: a place of its own. Returns null when no cut in eight
   tries leaves both sides big enough. A child of a ragged parent may lie in two pieces; that is accepted. */
function splitRegion(r, god){
  if (!canSplit(r)) return null;
  const { x0, y0, x1, y1 } = r.bbox;
  const alongX = (x1 - x0) >= (y1 - y0);
  const wobble = Math.round((1 - god.traits.patience) * 6);
  const lo = alongX ? x0 : y0, hi = alongX ? x1 : y1;
  for (let tries = 0; tries < 8; tries++){
    const cut = lo + Math.round((0.3 + rng() * 0.4) * (hi - lo));
    const noise = wobble ? makeNoise(12) : null;
    const side = i => { const x = i % W, y = (i - x) / W; const along = alongX ? x : y, across = alongX ? y : x; const off = noise ? Math.round((noise(across, 0) - 0.5) * 2 * wobble) : 0; return along < cut + off ? 0 : 1; };
    const a = [], b = [];
    for (const i of r.tiles) (side(i) === 0 ? a : b).push(i);
    if (a.length < SECTOR_AREA || b.length < SECTOR_AREA) continue;
    const ca = addRegion(a, r.id, god.id, age), cb = addRegion(b, r.id, god.id, age);
    for (const m of r.marks){
      if (INHERITED[m.kind]){ ca.marks.push({ ...m, inherited: true }); cb.marks.push({ ...m, inherited: true }); }
      else (m.at !== null && regionOf[m.at] === cb.id ? cb : ca).marks.push({ ...m, inherited: true });
    }
    r.children = [ca.id, cb.id];
    const line = a.filter(i => { const x = i % W, y = (i - x) / W; return DIRS.some(([dx, dy]) => inb(x + dx, y + dy) && regionOf[idx(x + dx, y + dy)] === cb.id); });
    const boundary = { id: nextId++, a: ca.id, b: cb.id, tiles: line, by: god.id, pole: god.pole, age };
    boundaries.push(boundary);
    return { a: ca, b: cb, boundary };
  }
  return null;
}
