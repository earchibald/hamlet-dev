/* ---------- tiles, loose items, resource counts, generation, plants ---------- */
const tileAt = (x, y, z = 0) => levels[z + ZOFF][idx(x, y)];
const hasTile = (x, y, z) => inb(x, y) && z >= ZMIN && z <= ZMAX && levels[z + ZOFF][idx(x, y)] !== null;
const sectorOfTile = t => sectors[secIdx(...Object.values(secOf(t.x, t.y)))];
function makeTile(x, y, z, ground){ return { x, y, z, ground, feature: null, berries: 0, fire: 0, struct: null, slope: false, hill: null }; }
/* Put a tile on a level. Tiles off the surface are also listed in `raised`, so per-tick loops can find them without scanning empty levels. */
function placeTile(x, y, z, ground){ const t = makeTile(x, y, z, ground); const old = levels[z + ZOFF][idx(x, y)]; levels[z + ZOFF][idx(x, y)] = t; if (z !== 0){ if (old){ const k = raised.indexOf(old); if (k >= 0) raised[k] = t; else raised.push(t); } else raised.push(t); } return t; }
function matOf(t){ return t.feature ? FEATURES[t.feature].mat : null; }
function passable(x, y, z = 0){
  if (!hasTile(x, y, z)) return false;
  const t = levels[z + ZOFF][idx(x, y)];
  return GROUND[t.ground].walk && !(t.feature && FEATURES[t.feature].solid) && t.fire <= 0 && !(t.struct && t.struct.type === 'firepit');
}
function nearFind(x, y, pred, offs = NEAR, z = 0){
  for (const [dx, dy] of offs){ const nx = x + dx, ny = y + dy; if (hasTile(nx, ny, z)){ const t = levels[z + ZOFF][idx(nx, ny)]; if (pred(t)) return t; } }
  return null;
}
function tileFlam(t){
  let f = t.feature ? MATERIALS[matOf(t)].flam : GROUND[t.ground].flam;
  if (t.struct && ['rack', 'leanto', 'hut', 'storehouse'].includes(t.struct.type)) f = Math.max(f, 0.3);
  const it = itemAt(t.x, t.y, t.z); if (it) f = Math.max(f, MATERIALS[ITEMS[it.kind].mat].flam);
  return f;
}
function tileFuel(t){
  let f = t.feature ? FEATURES[t.feature].fuel : GROUND[t.ground].fuel;
  if (t.struct && ['rack', 'leanto', 'hut', 'storehouse'].includes(t.struct.type)) f = Math.max(f, 60);
  const it = itemAt(t.x, t.y, t.z); if (it) f = Math.max(f, ITEMS[it.kind].fuel);
  return f;
}

/* ---------- loose items ---------- */
function rebuildItemGrid(){ itemGrid = new Array(NZ * W * H).fill(null); for (const it of items){ const i = idx3(it.x, it.y, it.z); if (!itemGrid[i]) itemGrid[i] = it; } }
function addItem(kind, x, y, z = 0){ const it = { id: nextId++, kind, x, y, z, reservedBy: null, born: tick }; items.push(it); const i = idx3(x, y, z); if (!itemGrid[i]) itemGrid[i] = it; return it; }
function removeItem(it){ const k = items.indexOf(it); if (k >= 0) items.splice(k, 1); rebuildItemGrid(); }
const itemAt = (x, y, z = 0) => itemGrid[idx3(x, y, z)];

function nearestFire(x, y, r, z = 0){
  if (fireCount <= 0) return -1;
  let best = -1;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
    const nx = x + dx, ny = y + dy; if (!hasTile(nx, ny, z)) continue;
    const t = levels[z + ZOFF][idx(nx, ny)]; if (t.fire <= 0) continue;
    const d = Math.abs(dx) + Math.abs(dy); if (d <= r && (best < 0 || d < best)) best = d;
  }
  return best;
}
/* Count a resource in a sector. Cached for 100 ticks. */
function sectorCount(s, key, pred){
  const ck = key + ':' + secIdx(s.sx, s.sy);
  const c = resCache.get(ck); if (c && tick - c.t < 100) return c.n;
  let n = 0;
  for (let y = s.sy * LH; y < (s.sy + 1) * LH; y++) for (let x = s.sx * LW; x < (s.sx + 1) * LW; x++) if (pred(world[idx(x, y)], x, y)) n++;
  resCache.set(ck, { t: tick, n }); return n;
}
const looseCount = kind => (s) => sectorCount(s, 'item-' + kind, (t, x, y) => { const it = itemAt(x, y); return it && it.kind === kind && !it.reservedBy; });
function nearestSectorWith(a, counter){
  const me = secOf(a.x, a.y);
  const list = sectors.filter(s => !(s.sx === me.sx && s.sy === me.sy)).sort((p, q) => dist(p.sx, p.sy, me.sx, me.sy) - dist(q.sx, q.sy, me.sx, me.sy));
  for (const s of list){ if (dist(s.sx, s.sy, me.sx, me.sy) > 4) break; if (counter(s) > 0) return s; }
  return null;
}

/* ---------- world generation ---------- */
function makeNoise(scale){
  const gw = Math.ceil(W / scale) + 2, gh = Math.ceil(H / scale) + 2;
  const g = []; for (let i = 0; i < gw * gh; i++) g.push(rng());
  const sm = t => t * t * (3 - 2 * t), v = (i, j) => g[j * gw + i];
  return (x, y) => {
    const fx = x / scale, fy = y / scale, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * tx, b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
}
/* ---------- uplift: hills ---------- */
/* Six to ten hills on rocky and forest ground, never on the river, never in the start sector. A hill is rock at
   level 0 with a floor above it. A tall hill has a second storey: the footprint eroded inward by 2, rock at
   level 1 with a floor at level 2. Each storey gets one or two slopes on its rim. The rest of the rim is cliff. */
function uplift(){
  const start = { sx: SW >> 1, sy: SH >> 1 };
  const cands = shuffle(sectors.filter(s => (s.biome === 'rocky' || s.biome === 'forest') && !(s.sx === start.sx && s.sy === start.sy)));
  const want = 6 + rint(5), jit = makeNoise(6);
  for (const s of cands){
    if (hills.length >= want) break;
    for (let tries = 0; tries < 12; tries++){
      const r = 3 + rint(12), ry = Math.max(3, Math.round(r * (0.6 + rng() * 0.4)));
      const cx = s.sx * LW + r + rint(Math.max(1, LW - 2 * r)), cy = s.sy * LH + ry + rint(Math.max(1, LH - 2 * ry));
      let foot = [];
      for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - r; x <= cx + r; x++){
        if (!inb(x, y)) continue;
        const e = ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 + (jit(x, y) - 0.5) * 0.5;
        if (e <= 1) foot.push(idx(x, y));
      }
      if (!foot.includes(idx(cx, cy))) continue;
      foot = component(foot, idx(cx, cy));
      if (foot.length < 12 || !hillFits(foot, start)) continue;
      const h = { x: cx, y: cy, r, storeys: r >= 8 ? 2 : 1, tiles: foot };
      const shape = hillShape(h); if (!hillClimbable(shape)) continue;
      raiseHill(h, shape); hills.push(h); break;
    }
  }
}
/* The tiles of `list` joined to `seed` by four-way steps within the list. */
function component(list, seed){
  const set = new Set(list), seen = new Set([seed]), q = [seed];
  for (let head = 0; head < q.length; head++){ const i = q[head], x = i % W, y = (i - x) / W;
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (set.has(j) && !seen.has(j)){ seen.add(j); q.push(j); } } }
  return [...seen];
}
/* A footprint fits if it stays off the map edge, out of the start sector, off other hills, and three tiles from any water or riverbank. */
function hillFits(foot, start){
  const set = new Set(foot);
  for (const i of foot){
    const x = i % W, y = (i - x) / W;
    const sc = secOf(x, y); if (sc.sx === start.sx && sc.sy === start.sy) return false;
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return false;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++){
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const q = world[idx(nx, ny)];
      if (q.ground === 'water' || q.ground === 'sand' || (q.hill && !set.has(idx(nx, ny)))) return false;
    }
  }
  return true;
}
/* A tile is inside the shape eroded by d if every tile within d of it is in the set. */
function erodedBy(i, set, d){ const x = i % W, y = (i - x) / W; for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (Math.abs(dx) + Math.abs(dy) <= d && (!inb(x + dx, y + dy) || !set.has(idx(x + dx, y + dy)))) return false; return true; }
/* The shape of a hill before it is raised: the second-storey core and the ring of first-storey floor around it. */
function hillShape(h){
  const set = new Set(h.tiles);
  let inner = h.storeys === 2 ? h.tiles.filter(i => erodedBy(i, set, 2)) : [];
  if (inner.length){ inner = component(inner, inner[0]); if (inner.length < 4){ inner = []; h.storeys = 1; } }
  const innerSet = new Set(inner);
  return { set, inner, innerSet, ring: h.tiles.filter(i => !innerSet.has(i)) };
}
/* A hill can be climbed if its first-storey floor is one piece and some walkable tile beside it on the ground can hold a slope. */
function hillClimbable(shape){
  if (!shape.ring.length || component(shape.ring, shape.ring[0]).length !== shape.ring.length) return false;
  for (const i of shape.ring){ const x = i % W, y = (i - x) / W;
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (inb(nx, ny) && !shape.set.has(idx(nx, ny)) && passable(nx, ny, 0) && !tileAt(nx, ny).slope) return true; } }
  return false;
}
function raiseHill(h, shape){
  const { set, inner, innerSet } = shape;
  for (const i of h.tiles){ const t = world[i]; t.ground = 'rock'; t.feature = null; t.berries = 0; t.loose = null; t.hill = h; }
  for (const i of h.tiles){ const x = i % W, y = (i - x) / W; const t = placeTile(x, y, 1, innerSet.has(i) ? 'rock' : (rng() < 0.5 ? 'grass' : 'stone')); t.hill = h; }
  for (const i of inner){ const x = i % W, y = (i - x) / W; const t = placeTile(x, y, 2, rng() < 0.5 ? 'grass' : 'stone'); t.hill = h; }
  cutSlopes(h, 0, i => !set.has(i), i => set.has(i) && !innerSet.has(i));
  if (inner.length) cutSlopes(h, 1, i => set.has(i) && !innerSet.has(i), i => innerSet.has(i));
}
/* One or two slopes on level z at a rim: a walkable low tile beside a high tile whose floor is one level up. Slopes sit at least six tiles apart. */
function cutSlopes(h, z, isLow, isHigh){
  const rim = [];
  for (const i of h.tiles){ const x = i % W, y = (i - x) / W; if (!isHigh(i)) continue;
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny);
      if (isLow(j) && passable(nx, ny, z) && !tileAt(nx, ny, z).slope) rim.push([nx, ny]); } }
  if (!rim.length) return;
  const want = 1 + rint(2), picked = [];
  for (let k = 0; k < 40 && picked.length < want; k++){ const [x, y] = rim[rint(rim.length)]; if (picked.every(([px, py]) => dist(px, py, x, y) >= 6)){ const t = tileAt(x, y, z); t.slope = true; t.feature = null; picked.push([x, y]); } }
}
function generate(){
  const bn = makeNoise(38), mn = makeNoise(52), en = makeNoise(9), fn = makeNoise(5), rn = makeNoise(40);
  sectors = [];
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < SW; sx++){
    const [cx, cy] = secCenter({ sx, sy });
    const v = bn(cx, cy), m = mn(cx, cy);
    let biome = m > 0.66 ? 'wetland' : v > 0.6 ? 'forest' : v < 0.38 ? 'rocky' : 'meadow';
    if (sx === SW >> 1 && sy === SH >> 1) biome = 'meadow';
    sectors.push({ sx, sy, biome, name: BIOMES[biome].name });
  }
  const riverY = x => H * 0.5 + (rn(x, 7) - 0.5) * H * 0.7;
  levels = []; for (let z = ZMIN; z <= ZMAX; z++) levels.push(new Array(W * H).fill(null)); world = levels[ZOFF]; raised = []; hills = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const s = sectors[secIdx(Math.floor(x / LW), Math.floor(y / LH))];
    const e = en(x, y), f = fn(x, y), dr = Math.abs(y - riverY(x));
    const t = makeTile(x, y, 0, 'grass');
    let loose = null;
    const ford = (x + 23) % 47 < 3;
    if (dr <= 1.3) t.ground = ford ? 'sand' : 'water';
    else if (dr <= 2.6){ t.ground = 'sand'; if (rng() < 0.08) loose = 'rock'; }
    else switch (s.biome){
      case 'forest':
        if (f > 0.4 && rng() < 0.55) t.feature = 'tree';
        else if (rng() < 0.12) loose = 'stick';
        else if (rng() < 0.02){ t.feature = 'bush'; t.berries = rint(3); }
        break;
      case 'meadow':
        if (f > 0.7 && rng() < 0.3) t.feature = 'tree';
        else if (rng() < 0.045){ t.feature = 'bush'; t.berries = 1 + rint(4); }
        else if (rng() < 0.02) loose = 'stick';
        else if (rng() < 0.015) loose = 'rock';
        else if (e < 0.3 && rng() < 0.2) t.ground = 'soil';
        break;
      case 'rocky':
        if (e > 0.55 && rng() < 0.5) t.feature = 'boulder';
        else if (rng() < 0.11) loose = 'rock';
        else if (rng() < 0.03) t.feature = 'tree';
        else if (rng() < 0.01){ t.feature = 'bush'; t.berries = rint(3); }
        else if (rng() < 0.3) t.ground = 'soil';
        break;
      case 'wetland':
        if (e < 0.42) t.ground = 'water';
        else if (e < 0.5 && rng() < 0.5) t.feature = 'reeds';
        else if (rng() < 0.03){ t.feature = 'bush'; t.berries = 1 + rint(3); }
        else if (rng() < 0.03) loose = 'stick';
        else if (rng() < 0.04) t.feature = 'tree';
        break;
    }
    world[idx(x, y)] = t;
    if (t.feature === 'tree') t.planted = tick - rint(100 * DAY); else if (t.feature === 'bush') t.planted = tick - rint(60 * DAY);
    if (loose) t.loose = loose;
  }
  uplift();
  items = []; itemGrid = new Array(NZ * W * H).fill(null);
  for (const t of world){ if (t.loose){ addItem(t.loose, t.x, t.y); delete t.loose; } }
  /* First person: the centre sector, on open ground near the river if possible. */
  const s0 = sectors[secIdx(SW >> 1, SH >> 1)];
  const [cx, cy] = secCenter(s0);
  let best = null;
  for (let y = s0.sy * LH; y < (s0.sy + 1) * LH; y++) for (let x = s0.sx * LW; x < (s0.sx + 1) * LW; x++){
    if (!passable(x, y)) continue;
    const d = dist(x, y, cx, cy); if (!best || d < best.d) best = { x, y, d };
  }
  const first = makeBeing('human', best.x, best.y, takeName(), rint(360)); first.camp = camp; beings.push(first);
  /* Animals */
  const spawnAnimal = (sp, biomes, n) => {
    for (let k = 0; k < n; k++){
      for (let tries = 0; tries < 200; tries++){
        const t = world[rint(W * H)]; const s = sectorOfTile(t);
        if (biomes.includes(s.biome) && passable(t.x, t.y) && dist(t.x, t.y, best.x, best.y) > 12){ beings.push(makeBeing(sp, t.x, t.y, null, 0)); break; }
      }
    }
  };
  spawnAnimal('rabbit', ['meadow', 'wetland'], 14);
  spawnAnimal('fox', ['forest', 'rocky'], 3);
  spawnAnimal('wolf', ['forest'], 2);
  /* Groves. The oldest pines in the deepest forests are hollow, and something lives in them. */
  groves = [];
  const forests = sectors.filter(sc => sc.biome === 'forest').map(sc => ({ sc, n: sectorCount(sc, 'trees', t => t.feature === 'tree') })).sort((p, q) => q.n - p.n).slice(0, 3);
  for (const { sc } of forests){
    for (let tries = 0; tries < 300; tries++){
      const t = tileAt(sc.sx * LW + 2 + rint(LW - 4), sc.sy * LH + 2 + rint(LH - 4));
      if (t.feature === 'tree' && nearFind(t.x, t.y, q => passable(q.x, q.y), DIRS)){
        t.feature = 'hollow'; t.planted = tick - 300 * DAY;
        const g = { x: t.x, y: t.y, sector: sc, anger: 0, swarmUntil: 0, lastBirth: tick }; groves.push(g);
        for (let k = 0; k < 3; k++){ const q = nearFind(t.x, t.y, q => passable(q.x, q.y) && !beings.some(b => b.x === q.x && b.y === q.y), RING); if (q){ const sp = makeBeing('sprite', q.x, q.y, null, 0); sp.grove = g; beings.push(sp); } }
        break;
      }
    }
  }
  for (let g = 0; g < 3; g++){
    for (let tries = 0; tries < 200; tries++){
      const t = world[rint(W * H)]; const s = sectorOfTile(t);
      if (s.biome === 'meadow' && passable(t.x, t.y) && dist(t.x, t.y, best.x, best.y) > 18){
        for (let k = 0; k < 2 + rint(2); k++){ const q = nearFind(t.x, t.y, q => passable(q.x, q.y) && !beings.some(b => b.x === q.x && b.y === q.y), [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]]); if (q) beings.push(makeBeing('deer', q.x, q.y, null, 0)); }
        break;
      }
    }
  }
}

/* A sapling becomes a solid tree only if it does not close a path. The open
   tiles beside it must still touch each other around the ring once it is
   solid. Two people starved in pockets sealed this way before this rule. */
function saplingMayGrow(t){
  const open = AROUND.map(([dx, dy]) => passable(t.x + dx, t.y + dy));
  const sides = [0, 2, 4, 6].filter(i => open[i]);
  if (sides.length < 2) return true;
  const joined = new Set([sides[0]]);
  for (const step of [1, -1]){ let i = sides[0]; for (let k = 0; k < 7; k++){ i = (i + step + 8) % 8; if (!open[i]) break; joined.add(i); } }
  return sides.every(i => joined.has(i));
}
/* Plants grow, seed, and die. Sixty random tiles a tick. */
function growPlants(){
  for (let k = 0; k < 60; k++){
    const t = world[rint(W * H)]; if (t.fire > 0) continue;
    if (t.feature === 'bush'){
      const age = (tick - (t.planted || 0)) / DAY;
      if (age > 60 && rng() < 0.01){ t.feature = null; t.berries = 0; t.ground = t.ground === 'grass' ? 'soil' : t.ground; continue; }
      const g = { spring: 0.15, summer: 0.25, autumn: 0.35, winter: 0 }[seasonOf()] * (age < 3 ? 0 : age > 48 ? 0.5 : 1);
      if (isWinter()){ if (t.berries > 0 && rng() < 0.15) t.berries--; } else if (t.berries < 5 && rng() < g) t.berries++;
      if ((seasonOf() === 'autumn' || seasonOf() === 'spring') && age >= 5 && rng() < 0.012){ const q = nearFind(t.x, t.y, q => q.ground === 'grass' && !q.feature && !q.struct && !itemAt(q.x, q.y) && !nearFind(q.x, q.y, z => z.feature === 'bush' && z !== t, RING), RING); if (q){ q.feature = 'bush'; q.berries = 0; q.planted = tick; } }
    }
    else if (t.feature === 'sapling'){ if ((tick - t.planted) / DAY > 12 && saplingMayGrow(t)) t.feature = 'tree'; }
    else if (t.feature === 'tree'){
      if (weather.storm && (tick - (t.planted || 0)) / DAY > 100 && rng() < 0.03){ t.feature = null; addItem('log', t.x, t.y); addItem('stick', t.x, t.y); addItem('stick', t.x, t.y); if (camps.some(c => c.site && dist(t.x, t.y, ...c.site) <= 20)) log('An old pine comes down in the storm.', []); continue; }
      if (rng() < 0.02){ const q = nearFind(t.x, t.y, q => passable(q.x, q.y) && !q.feature && !itemAt(q.x, q.y) && !q.struct, RING); if (q) addItem('stick', q.x, q.y); } }
    else if (!t.feature){
      if (t.ground === 'ash' && rng() < 0.05) t.ground = 'grass';
      else if (t.ground === 'grass' && !t.struct && !itemAt(t.x, t.y) && rng() < 0.004 && nearFind(t.x, t.y, q => q.feature === 'tree', RING) && !camps.some(c => c.site && dist(t.x, t.y, ...c.site) <= 5)){ t.feature = 'sapling'; t.planted = tick; }
    }
  }
}
  /* Old carcasses rot. */
function rotCarcasses(){
  if (tick % 50 === 0){ const before = items.length; items = items.filter(i => (i.kind !== 'carcass' && i.kind !== 'venison') || tick - i.born < (i.kind === 'venison' ? 1500 : 900) * (isWinter() ? 2 : 1)); if (items.length !== before) rebuildItemGrid(); }
}
/* The tiles a walker can step to from here: the four beside it, up from a slope to the level above, and down onto a slope beside it. Fills `out` with flat triples. */
function steps(x, y, z, out){
  out.length = 0;
  for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (passable(nx, ny, z)) out.push(nx, ny, z); }
  const t = levels[z + ZOFF][idx(x, y)];
  if (t && t.slope) for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (passable(nx, ny, z + 1)) out.push(nx, ny, z + 1); }
  for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (passable(nx, ny, z - 1) && levels[z - 1 + ZOFF][idx(nx, ny)].slope) out.push(nx, ny, z - 1); }
  return out;
}
