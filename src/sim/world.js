/* ---------- tiles, loose items, resource counts, generation, plants ---------- */
const tileAt = (x, y, z = 0) => levels[z + ZOFF][idx(x, y)];
const hasTile = (x, y, z) => inb(x, y) && z >= ZMIN && z <= ZMAX && levels[z + ZOFF][idx(x, y)] !== null;
const sectorOfTile = t => sectors[secIdx(...Object.values(secOf(t.x, t.y)))];
function makeTile(x, y, z, ground){ return { x, y, z, ground, feature: null, berries: 0, fire: 0, struct: null, slope: false, hill: null, cave: null, mouth: null }; }
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
  if (t.struct && ['rack', 'leanto', 'hut', 'storehouse', 'workshop', 'pitfall'].includes(t.struct.type)) f = Math.max(f, 0.3);
  const it = itemAt(t.x, t.y, t.z); if (it) f = Math.max(f, MATERIALS[ITEMS[it.kind].mat].flam);
  return f;
}
function tileFuel(t){
  let f = t.feature ? FEATURES[t.feature].fuel : GROUND[t.ground].fuel;
  if (t.struct && ['rack', 'leanto', 'hut', 'storehouse', 'workshop', 'pitfall'].includes(t.struct.type)) f = Math.max(f, 60);
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
  const c = resCache.get(ck); if (c && tick - c.t < CLOCK.limit.resourceCache) return c.n;
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
/* ---------- caves ---------- */
/* A cave is a record. kind: water, den, or hollow. tiles: every carved tile, on any level. mouth: the slope on the
   lower level you climb out by, or the pocket tile beside the outside for a den at level 0. exit: the surface tile
   you step out onto; it points back through t.mouth. deep: the find spot. blocked: a rock tile in the passage.
   steps: how many walk tiles the water cut. */
function makeCave(kind, hill){ const c = { id: nextId++, kind, hill, owner: null, tiles: [], mouth: null, exit: null, deep: null, blocked: null, searched: null, steps: 0, story: [] }; caves.push(c); return c; }
/* Turn a tile into cave floor for cave c. Below the surface the tile is made; on the surface the rock is cut.
   A tile another cave owns is left alone: the caller gets null and must go round it. */
function carve(c, x, y, z){
  let t = hasTile(x, y, z) ? tileAt(x, y, z) : null;
  if (t && t.cave === c) return t;
  if (t && t.cave) return null;
  if (!t) t = placeTile(x, y, z, 'stone'); else { t.ground = 'stone'; t.feature = null; t.berries = 0; t.loose = null; t.struct = null; t.slope = false; }
  t.cave = c; c.tiles.push(t); return t;
}
/* Making this tile solid keeps every path if its open sides still touch each other around the ring. */
function keepsPaths(t){
  const open = AROUND.map(([dx, dy]) => passable(t.x + dx, t.y + dy, t.z));
  const sides = [0, 2, 4, 6].filter(i => open[i]);
  if (sides.length < 2) return true;
  const joined = new Set([sides[0]]);
  for (const step of [1, -1]){ let i = sides[0]; for (let k = 0; k < 7; k++){ i = (i + step + 8) % 8; if (!open[i]) break; joined.add(i); } }
  return sides.every(i => joined.has(i));
}
/* The tiles the first person can walk to from the start sector. Every cave exit must lie in it, or nobody could ever get there. */
let startRegion = null;
/* Walkable surface tiles just outside a hill, each with the footprint tile it touches. Mouths and slopes are skipped. */
function rimExits(h, set){
  const out = [];
  for (const i of h.tiles){ const x = i % W, y = (i - x) / W;
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || set.has(idx(nx, ny))) continue; const t = tileAt(nx, ny); if (passable(nx, ny) && !t.slope && !t.mouth && startRegion.has(idx3(nx, ny, 0))) out.push([t, i]); } }
  return out;
}
/* ---------- pre-history ---------- */
/* A depth mark cuts water caves under the hills of its country. Each spring's stream cut a winding passage from
   under the hill out to a mouth at the foot, with one or two chambers, and then a drop for each level of the mark
   below the first, each with a chamber at the bottom. The stream still runs where water flowed or pooled under
   the country. Returns the caves it cut, so the painter can stamp its mark on them. */
function cutWaterCaves(hillList, levels, wetUnder){
  const made = [];
  for (const h of hillList){
    const set = new Set(h.tiles);
    const rim = rimExits(h, set); if (!rim.length) continue;
    const [exit, under] = rim[rint(rim.length)];
    const c = makeCave('water', h);
    let x = under % W, y = (under - x) / W;
    /* Hills stand four tiles apart, so no cave can meet another's tiles here and carve never returns null. */
    const mouth = carve(c, x, y, -1); mouth.slope = true; c.mouth = mouth; c.exit = exit; exit.mouth = c;
    const len = 8 + rint(13), spine = [[x, y]];
    const free = (px, py) => shuffle(DIRS).map(([dx, dy]) => [px + dx, py + dy]).filter(([nx, ny]) => set.has(idx(nx, ny)) && !(hasTile(nx, ny, -1) && tileAt(nx, ny, -1).cave));
    for (let k = 0; k < len; k++){
      let opts = free(x, y).filter(([nx, ny]) => dist(nx, ny, exit.x, exit.y) >= dist(x, y, exit.x, exit.y));
      if (!opts.length) opts = free(x, y);
      if (!opts.length){ /* boxed in: go back along the spine to the last tile with room, and branch from there */
        let j = spine.length - 1; while (j >= 0 && !free(spine[j][0], spine[j][1]).length) j--;
        if (j < 0) break; [x, y] = spine[j]; opts = free(x, y);
      }
      [x, y] = opts[0]; carve(c, x, y, -1); spine.push([x, y]);
      if (k === Math.floor(len / 2) && rng() < 0.5) chamber(c, x, y, -1, set);
    }
    c.steps = spine.length - 1;
    const far = spine.reduce((p, q) => dist(q[0], q[1], exit.x, exit.y) > dist(p[0], p[1], exit.x, exit.y) ? q : p, spine[0]); [x, y] = far;
    let bottom = chamber(c, x, y, -1, set), last = c.mouth;
    /* Each drop below the first level: a slope on the lower level under the last chamber, with a chamber around it. */
    for (let z = -2; z >= -levels; z--){
      const drop = carve(c, x, y, z); if (!drop) break;
      drop.slope = true; last = drop;
      const room = chamber(c, x, y, z, set);
      bottom = room.length ? room : [drop];
    }
    c.deep = bottom.length ? bottom[rint(bottom.length)] : last;
    c.mark = h.mark;
    c.story.push('Water cut this passage when the river ran higher.');
    made.push(c);
    if (wetUnder){
      const pond = RING.map(([dx, dy]) => [exit.x + dx, exit.y + dy]).filter(([px, py]) => inb(px, py) && !set.has(idx(px, py)) && passable(px, py) && !tileAt(px, py).slope && !tileAt(px, py).mouth && keepsPaths(tileAt(px, py)));
      if (pond.length){ const [px, py] = pond[rint(pond.length)]; const t = tileAt(px, py); t.ground = 'water'; t.feature = null; t.berries = 0; t.loose = null; c.story.push('A spring still runs at its mouth.'); }
    }
  }
  return made;
}
/* A room around a tile: its four sides first, so the room touches the tile, then the corners, each with four chances in five.
   A corner is only cut beside one of its two sides already in this cave, so it is always four-connected to the room, never a
   diagonal-only island. Returns the carved tiles. */
function chamber(c, x, y, z, set){
  const out = [];
  for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (set.has(idx(nx, ny)) && (rng() < 0.8 || !out.length)){ const t = carve(c, nx, ny, z); if (t) out.push(t); } }
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const nx = x + dx, ny = y + dy;
    const sideA = hasTile(x + dx, y, z) && tileAt(x + dx, y, z).cave === c, sideB = hasTile(x, y + dy, z) && tileAt(x, y + dy, z).cave === c;
    if (set.has(idx(nx, ny)) && (sideA || sideB) && rng() < 0.8){ const t = carve(c, nx, ny, z); if (t) out.push(t); } }
  return out;
}
/* Rock fell from the hills. Boulders lie at the feet where they cut no path, and one water passage in four is blocked. */
function rockfall(){
  const a = firstPerson();
  /* Every cave mouth stands in the first person's region when it is cut. keepsPaths only looks at a boulder's own
     ring, and two boulders across a narrow way each look safe alone, so the mouths are counted again after each one. */
  const openMouths = () => { if (!a) return null; const reg = reachable(a.x, a.y, 0, NZ * W * H); return new Set(caves.filter(c => c.exit && reg.has(idx3(c.exit.x, c.exit.y, 0)))); };
  let joined = openMouths();
  for (const h of hills){
    const set = new Set(h.tiles);
    const rim = shuffle(rimExits(h, set)); let want = 2 + rint(3);
    for (const [t] of rim){ if (!want) break; if (t.feature || t.struct || t.mouth) continue; if (!keepsPaths(t)) continue;
      /* The boulder buries what lay loose on the tile. A boulder taken back gives the loose item back with it, so
         the valley keeps its rocks and sticks. */
      const was = t.loose;
      t.feature = 'boulder'; t.loose = null;
      const now = joined && openMouths();
      if (joined && [...joined].some(c => !now.has(c))){ t.feature = null; t.loose = was; continue; }
      joined = now || joined; want--; }
  }
  for (const c of caves){
    if (c.kind !== 'water' || rng() >= 0.25) continue;
    const passage = c.tiles.filter(t => t.z === -1 && t !== c.mouth && !t.slope && !keepsPaths(t));
    if (passage.length < 4) continue;
    const t = passage[1 + rint(passage.length - 3)];
    const was = t.ground;
    t.ground = 'rock';
    /* A fall that the walk goes round is no fall at all. A passage branches, so the one rock may leave the deep
       chamber open; then the rock is taken back and the cave stays clear. Nothing here draws from the stream. */
    const d = c.deep;
    if (d && bfs(c.exit.x, c.exit.y, 0, (x, y, z) => x === d.x && y === d.y && z === d.z, NZ * W * H)){ t.ground = was; continue; }
    c.blocked = t; c.story.push('Fallen rock blocks the way.');
  }
}
/* Foxes and wolves dug into the hillsides over generations. A den is a pocket of 2 to 6 tiles at level 0 inside the
   rock, or a burrow of 2 to 4 tiles on level -1 under a slope. One mouth. One den for one owner, inside the
   country `within`. A hill with no den yet is tried first, and a forest hill before the rest. */
function digDens(within, owner){
  const mine = hills.filter(h => within.has(idx(h.x, h.y)));
  const forest = mine.filter(h => sectorOfTile(world[h.tiles[0]]).biome === 'forest');
  const order = shuffle(forest).concat(shuffle(mine.filter(h => !forest.includes(h))));
  const fresh = order.filter(h => !caves.some(c => c.kind === 'den' && c.hill === h));
  for (const h of fresh){ const c = digDen(h, owner); if (c) return c; }
  for (const h of order){ const c = digDen(h, owner); if (c) return c; }
  return null;
}
/* A tile is clear of other caves if none of its four neighbours on this level, the level above, or the level below
   belongs to another cave. Slopes join levels, so a pocket beside another cave's slope would gain a second mouth. */
function clearOfCaves(x, y, z, c){
  for (const dz of [-1, 0, 1]) for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (hasTile(nx, ny, z + dz)){ const t = tileAt(nx, ny, z + dz); if (t.cave && t.cave !== c) return false; } }
  return true;
}
function digDen(h, owner){
  const set = new Set(h.tiles);
  const rim = shuffle(rimExits(h, set));
  /* A burrow's mouth is a slope, which also links up to whatever sits at level 0 in its own and each neighbouring
     column. So no den, at any level, may take a column already used (or bordered) by another den on this hill. */
  const usedCols = new Set();
  for (const other of caves) if (other.hill === h && other.kind === 'den') for (const t of other.tiles) usedCols.add(idx(t.x, t.y));
  const barred = new Set(usedCols);
  for (const i of usedCols){ const x = i % W, y = (i - x) / W; for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (inb(nx, ny)) barred.add(idx(nx, ny)); } }
  for (const [exit, under] of rim){
    if (barred.has(under)) continue;
    const ux = under % W, uy = (under - ux) / W;
    const burrow = rng() < 0.5, z = burrow ? -1 : 0;
    /* A pocket must stay off the rim except at its mouth, so its other tiles sit one tile inside the footprint. */
    const inside = i => set.has(i) && !barred.has(i) && (z === -1 || erodedBy(i, set, 1));
    if (z === 0 && tileAt(ux, uy).cave) continue;
    if (!clearOfCaves(ux, uy, z, null)) continue;
    const c = makeCave('den', h); c.owner = owner;
    const mouth = carve(c, ux, uy, z);
    if (!mouth){ caves.splice(caves.indexOf(c), 1); continue; }
    if (burrow) mouth.slope = true; c.mouth = mouth; c.exit = exit; exit.mouth = c;
    const size = burrow ? 2 + rint(3) : 2 + rint(5);
    let x = ux, y = uy;
    for (let k = 1; k < size; k++){
      const opts = shuffle(DIRS).map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => inb(nx, ny) && inside(idx(nx, ny)) && !(hasTile(nx, ny, z) && tileAt(nx, ny, z).cave) && clearOfCaves(nx, ny, z, c));
      if (!opts.length) break;
      [x, y] = opts[0]; carve(c, x, y, z);
    }
    if (c.tiles.length < 2){ /* too cramped here: give the tiles back and try another spot */
      for (const t of c.tiles){ t.cave = null; if (t.z === 0) t.ground = 'rock'; else { levels[t.z + ZOFF][idx(t.x, t.y)] = null; const k = raised.indexOf(t); if (k >= 0) raised.splice(k, 1); } }
      exit.mouth = null; caves.splice(caves.indexOf(c), 1); continue;
    }
    c.story.push('Dug by foxes long before anyone came.');
    if (owner === 'wolf') c.story.push('Widened by wolves.');
    return c;
  }
  return null;
}
/* Put n animals of a species in its dens, two to a wolf den and one to a fox den. Returns how many were placed.
   With a cave, that den only. */
function spawnInDens(species, n, cave){
  let placed = 0;
  for (const c of (cave ? [cave] : caves)){
    if (c.kind !== 'den' || c.owner !== species) continue;
    const floors = c.tiles.filter(t => passable(t.x, t.y, t.z)); if (!floors.length) continue;
    const per = species === 'wolf' ? 2 : 1;
    for (let j = 0; j < per && placed < n; j++, placed++){ const t = floors[j % floors.length]; const b = makeBeing(species, t.x, t.y, null, 0); b.z = t.z; b.den = c; beings.push(b); }
  }
  return placed;
}
/* A forest sector with a hill keeps its grove under the hill: a pocket of 3 to 5 tiles at level 0, the hollow on the innermost tile. */
function hollowUnderHill(sc, h){
  const set = new Set(h.tiles);
  let rim = shuffle(rimExits(h, set));
  /* On a hill deep in thick forest, dens and rockfall can claim every clear approach before the grove gets a turn.
     As a last resort the sprites keep their own door clear of a tree, the way carve() clears one to make cave floor --
     but only a tree with a neighbour already in the main region, so the door still opens onto the map. */
  if (!rim.length){
    const treed = [];
    for (const i of h.tiles){ const x = i % W, y = (i - x) / W;
      for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || set.has(idx(nx, ny))) continue; const t = tileAt(nx, ny); if (t.feature !== 'tree' || t.slope || t.mouth) continue;
        const opensOut = DIRS.some(([ex, ey]) => { const ox = nx + ex, oy = ny + ey; return inb(ox, oy) && !set.has(idx(ox, oy)) && startRegion.has(idx3(ox, oy, 0)); });
        if (opensOut) treed.push([t, i]); } }
    rim = shuffle(treed);
  }
  for (const [exit, under] of rim){
    const ux = under % W, uy = (under - ux) / W;
    if (tileAt(ux, uy).cave) continue;
    if (!clearOfCaves(ux, uy, 0, null)) continue;
    const c = makeCave('hollow', h); c.owner = 'sprite';
    const mouth = carve(c, ux, uy, 0);
    if (!mouth){ caves.splice(caves.indexOf(c), 1); continue; }
    c.mouth = mouth; c.exit = exit; exit.mouth = c;
    let x = ux, y = uy; const size = 3 + rint(3);
    for (let k = 1; k < size; k++){
      const opts = shuffle(DIRS).map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => inb(nx, ny) && set.has(idx(nx, ny)) && erodedBy(idx(nx, ny), set, 1) && !tileAt(nx, ny).cave && clearOfCaves(nx, ny, 0, c));
      if (!opts.length) break;
      [x, y] = opts[0]; carve(c, x, y, 0);
    }
    if (c.tiles.length < 3){ for (const t of c.tiles){ t.cave = null; t.ground = 'rock'; } exit.mouth = null; caves.splice(caves.indexOf(c), 1); continue; }
    if (exit.feature === 'tree'){ exit.feature = null; exit.berries = 0; }
    const inner = c.tiles[c.tiles.length - 1]; inner.feature = 'hollow'; inner.planted = tick - CLOCK.plant.hollowAge;
    c.story.push('The oldest hollow in the valley.');
    /* Old pines stand on the hill above the hollow. Slopes and rock stay bare. keepsPaths only looks at a tile's own
       ring, which is not enough on the narrow floor around a tall hill's core: a run of trees can still wall off a
       far tile even when each one looked safe on its own. A pine that would cut any floor tile off the hill's own
       floors is left ungrown. */
    const hillFloors = raised.filter(t => t.hill === h && GROUND[t.ground].walk && !t.slope);
    /* A pine must not stand where a slope lands, or the way up the hill leads nowhere. */
    const lands = t => DIRS.some(([dx, dy]) => { const u = hasTile(t.x + dx, t.y + dy, t.z - 1) ? tileAt(t.x + dx, t.y + dy, t.z - 1) : null; return u && u.slope; });
    for (const t of hillFloors) if (!t.feature && !lands(t) && rng() < 0.3 && keepsPaths(t)){
      t.feature = 'tree'; t.planted = tick - (CLOCK.plant.grovePineAge + days(rint(CLOCK.plant.grovePineSpread / DAY)));
      const anchor = hillFloors.find(f => f.feature !== 'tree');
      const region = anchor && reachable(anchor.x, anchor.y, anchor.z, 4000);
      if (!region || !hillFloors.every(f => f.feature === 'tree' || region.has(idx3(f.x, f.y, f.z)))){ t.feature = null; t.planted = undefined; }
    }
    const g = { x: inner.x, y: inner.y, sector: sc, anger: 0, swarmUntil: 0, lastBirth: tick, cave: c }; groves.push(g);
    for (const t of c.tiles){ if (t === inner || !passable(t.x, t.y, 0) || beings.some(b => b.x === t.x && b.y === t.y && b.z === 0)) continue; if (beings.filter(b => b.species === 'sprite' && b.grove === g).length >= 3) break; const sp = makeBeing('sprite', t.x, t.y, null, 0); sp.grove = g; beings.push(sp); }
    while (beings.filter(b => b.species === 'sprite' && b.grove === g).length < 3){ const t = c.tiles.find(t => t !== inner && passable(t.x, t.y, 0)); if (!t) break; const sp = makeBeing('sprite', t.x, t.y, null, 0); sp.grove = g; beings.push(sp); }
    return g;
  }
  return null;
}
/* A sector has a neighbour, one of the four sides, that is forest. */
function forestBeside(s){
  return DIRS.some(([dx, dy]) => { const nx = s.sx + dx, ny = s.sy + dy; return nx >= 0 && nx < SW && ny >= 0 && ny < SH && sectors[secIdx(nx, ny)].biome === 'forest'; });
}
/* ---------- gnome burrows ---------- */
/* Two or three burrows under the meadow edges, beside a forest sector or a hill, at least 25 tiles from the start.
   A burrow is 2 to 4 tiles on level -1 with a slope mouth, like a fox burrow, and a mushroom patch around the mouth. */
/* One burrow, or null if none found: the tries loop digGnomeBurrows used at generation, pulled out so a
   burrow can be dug on demand when a village grows too loud. It draws no random numbers until it is called.
   `start` keeps the 25-tile rule (the exit is never beside it); `avoid` is a list of [x, y] village sites
   the new exit must clear by at least 50 tiles. `sector`, passed only by digGnomeBurrows' own candidate
   loop at generation, tries just that sector, so the founding dig draws exactly the numbers it always
   drew. Left out, the call is a mid-game move, and the rule below says which sectors it tries. */
function digGnomeBurrow(start, avoid, sector){
  /* A mid-game move tries every meadow sector that has a forest beside it or a hill in it, not only the first.
     Since the mythos the meadows lie where the gods put them, and the first sector drawn is often in a country
     the gnomes cannot reach, or too near the burrow they are leaving. */
  const list = sector ? [sector] : shuffle(sectors.filter(s => s.biome === 'meadow' && (forestBeside(s) ||
    hills.some(h => secOf(h.x, h.y).sx === s.sx && secOf(h.x, h.y).sy === s.sy))));
  /* At generation, digGnomeBurrows always passes its own candidate sector, so `sector` is only ever left
     out by a mid-game move (gnomeTick's leaving rule). The world has changed since settle painted it, so the
     generation-time startRegion can no longer be trusted: walk the live map from the first camp's stash or
     pit (or the first person, if no camp has a site yet) and require the new exit to sit in that region today. */
  const region = sector ? startRegion : (() => {
    const c = camps.find(k => k.site && (k.stashTile || k.pit));
    const a = firstPerson();
    /* Walk from somewhere that can be walked. A stash tile can be blocked -- a pit stands on it, a sapling grew
       on it -- and a walk from a blocked tile reaches one tile, which would refuse every hole in the world. */
    const tries = [c && c.stashTile, c && c.pit, a && [a.x, a.y]].filter(Boolean);
    let from = tries.find(([x, y]) => passable(x, y, 0));
    if (!from) for (const [x, y] of tries){ const t = nearFind(x, y, q => passable(q.x, q.y, 0), RING); if (t){ from = [t.x, t.y]; break; } }
    return from ? reachable(from[0], from[1], 0, NZ * W * H) : startRegion;
  })();
  for (const s of list){
    for (let tries = 0; tries < 40; tries++){
      const x = s.sx * LW + 2 + rint(LW - 4), y = s.sy * LH + 2 + rint(LH - 4);
      const t = tileAt(x, y);
      if (!passable(x, y) || t.feature || t.struct || t.mouth || t.cave || t.hill || dist(x, y, ...start) < 25 ||
          x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || !region.has(idx3(x, y, 0))) continue;
      if (avoid.some(([vx, vy]) => dist(x, y, vx, vy) < 50)) continue;
      if (caves.some(c => c.kind === 'burrow' && dist(c.exit.x, c.exit.y, x, y) < 30)) continue;
      /* The mouth is under a neighbour of the exit, so the slope climbs onto the exit. */
      const under = shuffle(DIRS).map(([dx, dy]) => [x + dx, y + dy]).find(([ux, uy]) => inb(ux, uy) && !tileAt(ux, uy).cave && !tileAt(ux, uy).mouth && clearOfCaves(ux, uy, -1, null) && !hasTile(ux, uy, -1));
      if (!under) continue;
      const c = makeCave('burrow', null); c.owner = 'gnome'; c.patch = []; c.bench = 0; c.holding = null; c.lastRepaid = 0; c.disturbed = 0;
      const mouth = carve(c, under[0], under[1], -1); if (!mouth){ caves.splice(caves.indexOf(c), 1); continue; } mouth.slope = true; c.mouth = mouth; c.exit = t; t.mouth = c;
      let [bx, by] = under; const size = 2 + rint(3);
      for (let k = 1; k < size; k++){
        const opts = shuffle(DIRS).map(([dx, dy]) => [bx + dx, by + dy]).filter(([nx, ny]) => inb(nx, ny) && !hasTile(nx, ny, -1) && clearOfCaves(nx, ny, -1, c) && !(nx === x && ny === y));
        if (!opts.length) break; [bx, by] = opts[0]; carve(c, bx, by, -1);
      }
      for (const [dx, dy] of RING.concat([[2,0],[-2,0],[0,2],[0,-2]])){ const q = hasTile(x + dx, y + dy, 0) ? tileAt(x + dx, y + dy) : null; if (q && passable(q.x, q.y) && !q.feature && !q.struct && !q.mouth && rng() < 0.7){ q.feature = 'mushrooms'; q.shrooms = 1 + rint(3); c.patch.push(q); } }
      if (c.patch.length < 4){ for (const q of c.patch){ q.feature = null; q.shrooms = 0; } c.patch = []; for (const q of c.tiles){ levels[q.z + ZOFF][idx(q.x, q.y)] = null; const k = raised.indexOf(q); if (k >= 0) raised.splice(k, 1); } t.mouth = null; caves.splice(caves.indexOf(c), 1); continue; }
      c.story.push('Gnomes dug this hole under the meadow, and farm the patch around it.');
      return c;
    }
  }
  return null;
}
/* Up to three burrows under the country `within`, as far apart as the country has room for. */
function digGnomeBurrows(within){
  const a = firstPerson(); const start = a ? [a.x, a.y] : secCenter({ sx: SW >> 1, sy: SH >> 1 });
  const want = 2 + rint(2); let made = 0;
  /* The sectors the country reaches, not the sectors it owns: a small country never covers most of a sector, and
     sector.country names only the country that covers the most. */
  const reaches = s => { for (let y = s.sy * LH; y < (s.sy + 1) * LH; y++) for (let x = s.sx * LW; x < (s.sx + 1) * LW; x++) if (within.has(idx(x, y))) return true; return false; };
  const mine = sectors.filter(reaches);
  let cands = shuffle(mine.filter(s => s.biome === 'meadow' && (forestBeside(s) ||
    hills.some(h => secOf(h.x, h.y).sx === s.sx && secOf(h.x, h.y).sy === s.sy))));
  /* A country the gods made gnomes in may hold no meadow beside a forest. A making must live somewhere, so any
     sector of that country where things grow will do. The tile rules in digGnomeBurrow still decide. */
  if (!cands.length) cands = shuffle(mine.filter(s => GROWS[s.biome]));
  /* A small country holds one or two candidate sectors, and a burrow needs room for a mushroom patch. Each
     sector is tried again until the country has the burrows it wants, or three passes have found no room. */
  for (let pass = 0; pass < 3 && made < want; pass++) for (const s of cands){
    if (made >= want) break;
    const c = digGnomeBurrow(start, [], s);
    if (!c) continue;
    const n = 2 + rint(2); const floor = c.tiles.filter(q => passable(q.x, q.y, q.z));
    for (let k = 0; k < n; k++){ const q = floor[k % floor.length]; const g = makeBeing('gnome', q.x, q.y, null, 0); g.z = q.z; g.den = c; beings.push(g); }
    made++;
  }
}
/* Every deep chamber holds one thing worth the walk: firestones, glowing moss, or old bones. */
function placeFinds(){
  for (const c of caves) if (c.deep) addItem(['firestones', 'moss', 'bones'][rint(3)], c.deep.x, c.deep.y, c.deep.z);
}
/* ---------- uplift: hills ---------- */
/* Hills inside a country. A hill is rock at level 0 with a floor above it, and a storey more for each level of
   the mark up to the range. Each storey gets one or two slopes on its rim. The rest of the rim is cliff.
   `within` is the set of tile indices the foot may use; the start country is never used. */
function uplift(within, storeys, count, mark){
  const made = [];
  const startTiles = new Set(creation.gate.start.tiles);
  const jit = makeNoise(6);
  /* A hill keeps three tiles clear of water, of a riverbank, and of another hill. A country can be mostly shore,
     so the foot is cut from the ground that already passes that rule, and so is the middle. Otherwise almost every
     try dies on the first tile it tests, and a wet country gets no hill at all. The foot is the dry part of the
     ellipse, which is why a hill by the water is not a clean oval. */
  const dry = i => {
    const x = i % W, y = (i - x) / W;
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return false;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++){
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const q = world[idx(nx, ny)];
      if (q.ground === 'water' || q.ground === 'sand' || q.hill) return false;
    }
    return true;
  };
  const inside = [...within].filter(i => !startTiles.has(i) && dry(i));
  if (!inside.length) return made;
  const room = new Set(inside);
  for (let tries = 0; tries < 40 * count && made.length < count; tries++){
    const c = inside[rint(inside.length)]; const cx = c % W, cy = (c - cx) / W;
    const r = 3 + rint(12), ry = Math.max(3, Math.round(r * (0.6 + rng() * 0.4)));
    let foot = [];
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - r; x <= cx + r; x++){
      if (!inb(x, y) || !room.has(idx(x, y))) continue;
      const e = ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 + (jit(x, y) - 0.5) * 0.5;
      if (e <= 1) foot.push(idx(x, y));
    }
    if (!foot.includes(idx(cx, cy))) continue;
    foot = component(foot, idx(cx, cy));
    if (foot.length < 12 || !hillFits(foot)) continue;
    const h = { x: cx, y: cy, r, storeys, tiles: foot, mark };
    /* hillShape lowers a hill that has no room for the storeys the mark asks for. This spot is the wrong shape:
       try another, so a hill always stands as tall as its mark says. */
    const shape = hillShape(h); if (h.storeys !== storeys || !hillClimbable(shape)) continue;
    raiseHill(h, shape); hills.push(h); made.push(h);
  }
  return made;
}
/* The tiles of `list` joined to `seed` by four-way steps within the list. */
function component(list, seed){
  const set = new Set(list), seen = new Set([seed]), q = [seed];
  for (let head = 0; head < q.length; head++){ const i = q[head], x = i % W, y = (i - x) / W;
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (set.has(j) && !seen.has(j)){ seen.add(j); q.push(j); } } }
  return [...seen];
}
/* A footprint fits if it stays off the map edge, off other hills, three tiles from any water or riverbank,
   and beside ground the first person can walk to. Its country is the caller's business. */
function hillFits(foot){
  const set = new Set(foot);
  let opensOut = false;
  for (const i of foot){
    const x = i % W, y = (i - x) / W;
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return false;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++){
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const q = world[idx(nx, ny)];
      if (q.ground === 'water' || q.ground === 'sand' || (q.hill && !set.has(idx(nx, ny)))) return false;
    }
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || set.has(idx(nx, ny))) continue; if (passable(nx, ny) && startRegion.has(idx3(nx, ny, 0))) opensOut = true; }
  }
  return opensOut;
}
/* A tile is inside the shape eroded by d if every tile within d of it is in the set. */
function erodedBy(i, set, d){ const x = i % W, y = (i - x) / W; for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (Math.abs(dx) + Math.abs(dy) <= d && (!inb(x + dx, y + dy) || !set.has(idx(x + dx, y + dy)))) return false; return true; }
/* The shape of a hill before it is raised: one layer per storey. Layer 1 is the whole footprint; each layer above
   is the footprint eroded inward by two more tiles, and must still be one piece of four tiles or more. A hill with
   no room for the storey it was asked for is lowered, and uplift then looks for a better spot. */
function hillShape(h){
  const set = new Set(h.tiles);
  const layers = [null, set];
  for (let z = 2; z <= h.storeys; z++){
    let up = h.tiles.filter(i => erodedBy(i, set, 2 * (z - 1)));
    if (up.length) up = component(up, up[0]);
    if (up.length < 4){ h.storeys = z - 1; break; }
    layers.push(new Set(up));
  }
  const innerSet = layers[2] || new Set();
  return { set, layers, inner: [...innerSet], innerSet, ring: h.tiles.filter(i => !innerSet.has(i)) };
}
/* A hill can be climbed if its first-storey floor is one piece and some walkable tile beside it on the ground can hold a slope. */
function hillClimbable(shape){
  if (!shape.ring.length || component(shape.ring, shape.ring[0]).length !== shape.ring.length) return false;
  for (const i of shape.ring){ const x = i % W, y = (i - x) / W;
    for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (inb(nx, ny) && !shape.set.has(idx(nx, ny)) && passable(nx, ny, 0) && !tileAt(nx, ny).slope) return true; } }
  return false;
}
function raiseHill(h, shape){
  const { set, layers } = shape;
  const at = z => layers[z] || new Set();
  for (const i of h.tiles){ const t = world[i]; t.ground = 'rock'; t.feature = null; t.berries = 0; t.loose = null; t.hill = h; }
  /* A storey is a floor everywhere but where the storey above it stands; there it is the rock that holds it up. */
  for (let z = 1; z <= h.storeys; z++){ const up = at(z + 1);
    for (const i of at(z)){ const x = i % W, y = (i - x) / W; const t = placeTile(x, y, z, up.has(i) ? 'rock' : (rng() < 0.5 ? 'grass' : 'stone')); t.hill = h; } }
  /* One rim per storey: the walkable floor of storey z+1, reached from the ground or from the floor below it. */
  for (let z = 0; z < h.storeys; z++){
    const low = at(z), high = at(z + 1), above = at(z + 2);
    const isLow = z === 0 ? (i => !set.has(i)) : (i => low.has(i) && !high.has(i));
    cutSlopes(h, z, isLow, i => high.has(i) && !above.has(i));
  }
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
/* ---------- settle's ground painters ---------- */
/* A sector takes the biome of the country that covers most of its tiles, and remembers that country. */
function paintSectors(){
  sectors = [];
  for (let sy = 0; sy < SH; sy++) for (let sx = 0; sx < SW; sx++){
    const count = new Map();
    for (let y = sy * LH; y < (sy + 1) * LH; y++) for (let x = sx * LW; x < (sx + 1) * LW; x++){ const id = regionOf[idx(x, y)]; count.set(id, (count.get(id) || 0) + 1); }
    const top = [...count.entries()].sort((p, q) => q[1] - p[1])[0][0];
    const r = regionById(top); const biome = biomeOf(r);
    sectors.push({ sx, sy, biome, name: BIOMES[biome].name, country: r.id });
  }
}
/* The tile texture of a biome. Noise decides where the trees stand; the biome comes from the country's marks. */
function paintTile(t, biome, e, f){
  let loose = null;
  switch (biome){
    /* Before the mythos the first camp always stood in a meadow, and only a meadow carried berries and loose
       stones. Now the gods can put the camp in a forest or a reed marsh, and a camp there starved and never
       knapped its axe. So berries grow in the clearings between the pines, nearly as thick as in a meadow, and
       stones lie under the pine needles and in the reed beds as thick as in the grass. */
    case 'forest':
      if (f > 0.4 && rng() < 0.55) t.feature = 'tree';
      else if (rng() < 0.12) loose = 'stick';
      else if (rng() < 0.06){ t.feature = 'bush'; t.berries = 1 + rint(3); }
      else if (rng() < 0.015) loose = 'rock';
      break;
    case 'meadow': case 'river':
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
      else if (rng() < 0.015) loose = 'rock';
      break;
    case 'ash':
      t.ground = 'ash';
      if (rng() < 0.05) loose = 'stick';
      break;
  }
  if (t.feature === 'tree') t.planted = tick - rint(CLOCK.plant.treeAgeSpread); else if (t.feature === 'bush') t.planted = tick - rint(CLOCK.plant.bushAgeSpread);
  if (loose) t.loose = loose;
}
/* Every tile of the surface, from its country's biome. Levels are made fresh. */
function paintGround(){
  const en = makeNoise(9), fn = makeNoise(5);
  levels = []; for (let z = ZMIN; z <= ZMAX; z++) levels.push(new Array(W * H).fill(null)); world = levels[ZOFF]; raised = []; hills = []; caves = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const t = makeTile(x, y, 0, 'grass'); const r = regionAt(x, y);
    t.country = r.id;
    paintTile(t, biomeOf(r), en(x, y), fn(x, y));
    world[idx(x, y)] = t;
  }
}
/* The river: every live boundary a wet god drew. The line and its far side are water, the next ring is sand,
   and every forty-seventh tile along the line is a ford. */
function paintRivers(){
  for (const b of liveBoundaries()){
    if (b.pole !== 'wet') continue;
    b.tiles.forEach((i, k) => {
      const x = i % W, y = (i - x) / W; const ford = k % 47 >= 23 && k % 47 < 26;
      /* The line tile itself, and its neighbours on the far side of the cut. */
      const wet = [[0, 0]].concat(DIRS.filter(([dx, dy]) => inb(x + dx, y + dy) && regionOf[idx(x + dx, y + dy)] === b.b));
      for (const [dx, dy] of wet){ const t = world[idx(x + dx, y + dy)]; t.ground = ford ? 'sand' : 'water'; t.feature = null; t.berries = 0; t.loose = null; t.river = b.id; }
    });
    for (const i of b.tiles){ const x = i % W, y = (i - x) / W;
      for (const [dx, dy] of RING){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const t = world[idx(nx, ny)]; if (t.ground !== 'water' && !t.river){ t.ground = 'sand'; t.feature = null; t.berries = 0; if (rng() < 0.08) t.loose = 'rock'; } } }
  }
}
/* A lake in the middle of a pooled country: a blob of about a seventh of its area. */
function paintLakes(){
  for (const r of liveRegions()){
    if (!hasMark(r, 'pool', 'surface')) continue;
    const { x0, y0, x1, y1 } = r.bbox; const cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1;
    const want = Math.round(r.area / 7); const jit = makeNoise(6);
    const rad = Math.sqrt(want / Math.PI);
    for (const i of r.tiles){ const x = i % W, y = (i - x) / W; const d = Math.hypot(x - cx, y - cy) / rad + (jit(x, y) - 0.5) * 0.6; if (d <= 1){ const t = world[i]; t.ground = 'water'; t.feature = null; t.berries = 0; t.loose = null; t.lake = r.id; } }
    for (const i of r.tiles){ const t = world[i]; if (t.ground === 'water') continue; if (RING.some(([dx, dy]) => inb(t.x + dx, t.y + dy) && world[idx(t.x + dx, t.y + dy)].lake)){ t.ground = 'sand'; t.feature = t.feature === 'tree' ? null : t.feature; } }
  }
}
/* The first person: the start country's best walkable pocket. The most central tile is no good on its own. A lake
   or a chasm can cut the country in two, and the centre can fall in a pocket with nothing in it. So walk every
   pocket and take the one that opens onto the most world, because that is the valley the person will live in;
   a wide pocket walled off from everything else is a prison. Then stand on its tile nearest the country's middle.
   A start country with no ground at all to stand on returns null. That is not a crash: settle reads it as a
   failed tile check with lack `ground`, and throws the valley back. */
function startMiddle(){ const { x0, y0, x1, y1 } = creation.gate.start.bbox; return [(x0 + x1) >> 1, (y0 + y1) >> 1]; }
/* The one person the day era starts with. */
function standFirstPerson(x, y){ const first = makeBeing('human', x, y, takeName(), rint(360)); first.camp = camp; beings.push(first); return first; }
/* The settle is final and the start country still has no ground: the person stands on the nearest walkable
   surface tile anywhere on the map, measured from the middle of that country. A person in the wrong country is
   better than a page that throws. */
function placeFirstPersonAnywhere(){
  const [cx, cy] = startMiddle();
  const offs = [];
  for (let dy = -H; dy <= H; dy++) for (let dx = -W; dx <= W; dx++) offs.push([dx, dy]);
  offs.sort((p, q) => (p[0] * p[0] + p[1] * p[1]) - (q[0] * q[0] + q[1] * q[1]));
  const t = nearFind(cx, cy, q => passable(q.x, q.y, 0), offs, 0);
  const best = { x: t ? t.x : cx, y: t ? t.y : cy, d: t ? dist(t.x, t.y, cx, cy) : 0 };
  standFirstPerson(best.x, best.y);
  return best;
}
function placeFirstPerson(){
  const s = creation.gate.start; const [cx, cy] = startMiddle();
  const mine = new Set(s.tiles.filter(i => passable(i % W, (i - i % W) / W)));
  if (!mine.size) return null;
  const seen = new Set(), base = ZOFF * W * H;
  let pocket = null, reach = -1;
  for (const i of mine){
    if (seen.has(i)) continue;
    const x = i % W, y = (i - x) / W;
    /* A pocket reaches out of the country and back, so walk the whole map and keep the country's own tiles. */
    const region = reachable(x, y, 0, NZ * W * H), here = [];
    for (const k of region){ const j = k - base; if (j >= 0 && j < W * H && mine.has(j)){ here.push(j); seen.add(j); } }
    if (region.size > reach || (region.size === reach && here.length > pocket.length)){ reach = region.size; pocket = here; }
  }
  let best = null;
  for (const i of pocket){ const x = i % W, y = (i - x) / W; const d = dist(x, y, cx, cy); if (!best || d < best.d) best = { x, y, d }; }
  standFirstPerson(best.x, best.y);
  return best;
}
/* Put n animals of a species down in the country `within`: a passable tile, at least 12 tiles from `avoid`
   (the first person). Returns how many stood up. */
function spawnAnimal(sp, within, n, avoid){
  const tiles = [...within]; if (!tiles.length) return 0;
  let made = 0;
  for (let k = 0; k < n; k++){
    for (let tries = 0; tries < 200; tries++){
      const t = world[tiles[rint(tiles.length)]];
      if (passable(t.x, t.y) && dist(t.x, t.y, avoid.x, avoid.y) > 12){ beings.push(makeBeing(sp, t.x, t.y, null, 0)); made++; break; }
    }
  }
  return made;
}
/* The grove of a country where the sprites were made. Under a hill of the country if one will take a hollow,
   else the oldest pine of the country: the one with the most pines around it. Turning a pine into a hollow closes
   nothing, because a pine is solid already. A country with too few pines gets a ring planted round the hollow
   first, and there the hollow tile must be one that closes no path. The grove carries the making mark. */
function placeGrove(within, mark){
  const hill = hills.find(h => within.has(idx(h.x, h.y)));
  if (hill){ const g = hollowUnderHill(sectorOfTile(world[hill.tiles[0]]), hill); if (g){ g.mark = mark; return g; } }
  const tiles = [...within];
  const trees = tiles.filter(i => world[i].feature === 'tree');
  const pines = t => RING.filter(([dx, dy]) => inb(t.x + dx, t.y + dy) && world[idx(t.x + dx, t.y + dy)].feature === 'tree').length;
  const open = t => !t.struct && !t.mouth && !t.cave && !t.slope && !t.hill && nearFind(t.x, t.y, q => passable(q.x, q.y), DIRS);
  let best = null;
  const take = (i, ok) => { const t = world[i]; if (!ok(t)) return; const n = pines(t); if (!best || n > best.n) best = { t, n }; };
  for (const i of trees) take(i, open);
  if (!best) for (const i of tiles) take(i, t => open(t) && !t.feature && passable(t.x, t.y) && keepsPaths(t));
  if (!best) return null;
  const t = best.t;
  /* The hollow is solid, so it stands before the ring is vetted. A pine judged beside an open centre can wall off
     a tile that the hollow then seals in. */
  t.feature = 'hollow'; t.planted = tick - CLOCK.plant.hollowAge; t.berries = 0;
  /* The ways around the hollow as they stand. A pine may not make them worse, but dense old forest that was
     already tight is not the grove's doing. */
  const openAround = keepsPaths(t);
  if (trees.length < 8) for (const [dx, dy] of RING){
    const q = inb(t.x + dx, t.y + dy) ? world[idx(t.x + dx, t.y + dy)] : null;
    if (!q || q.feature || q.struct || q.mouth || q.cave || q.slope || !passable(q.x, q.y) || !keepsPaths(q)) continue;
    q.feature = 'tree'; q.planted = tick - CLOCK.plant.grovePineAge;
    /* The hollow keeps two open sides, so the sprites have a door and a way back to it. The ways around the hollow
       must still meet once the pine stands, or the pine and the hollow together seal a pocket. */
    if (DIRS.filter(([ex, ey]) => passable(t.x + ex, t.y + ey)).length < 2 || (openAround && !keepsPaths(t))){ q.feature = null; delete q.planted; }
  }
  const g = { x: t.x, y: t.y, sector: sectorOfTile(t), anger: 0, swarmUntil: 0, lastBirth: tick, cave: null, mark }; groves.push(g);
  for (let k = 0; k < 3; k++){ const q = nearFind(t.x, t.y, q => passable(q.x, q.y) && !beings.some(b => b.x === q.x && b.y === q.y), RING); if (q){ const sp = makeBeing('sprite', q.x, q.y, null, 0); sp.grove = g; beings.push(sp); } }
  return g;
}

/* A sapling becomes a solid tree only if it does not close a path. The open
   tiles beside it must still touch each other around the ring once it is
   solid. Two people starved in pockets sealed this way before this rule.
   It also waits for the tile itself to be empty: someone standing still
   there, gathering or sleeping, must not wake up inside solid wood. */
function saplingMayGrow(t){ return keepsPaths(t) && !beings.some(b => b.alive && b.x === t.x && b.y === t.y && b.z === t.z); }
/* Plants grow, seed, and die. Sixty random tiles a tick. */
function growPlants(){
  const samples = CLOCK.plant.samples;
  for (let k = 0; k < samples; k++){
    const t = world[rint(W * H)]; if (t.fire > 0) continue;
    if (t.feature === 'bush'){
      const age = tick - (t.planted || 0);
      if (age > CLOCK.plant.bushOld && rng() < CLOCK.plant.bushDies){ t.feature = null; t.berries = 0; t.garden = null; t.ground = t.ground === 'grass' ? 'soil' : t.ground; continue; }
      const g = CLOCK.plant.berryGrow[seasonOf()] * (age < CLOCK.plant.bushYoung ? 0 : age > CLOCK.plant.bushTired ? 0.5 : 1);
      if (isWinter()){ if (t.berries > 0 && rng() < CLOCK.plant.berryWither) t.berries--; } else if (t.berries < 5 && rng() < g) t.berries++;
      if ((seasonOf() === 'autumn' || seasonOf() === 'spring') && age >= CLOCK.plant.bushSeedsFrom && rng() < CLOCK.plant.bushSeeds){ const q = nearFind(t.x, t.y, q => q.ground === 'grass' && !q.feature && !q.struct && !itemAt(q.x, q.y) && !nearFind(q.x, q.y, z => z.feature === 'bush' && z !== t, RING), RING); if (q){ q.feature = 'bush'; q.berries = 0; q.planted = tick; } }
    }
    else if (t.feature === 'sapling'){ if (tick - t.planted > CLOCK.plant.saplingGrown && saplingMayGrow(t)) t.feature = 'tree'; }
    else if (t.feature === 'mushrooms'){ if (t.shrooms < 4 && rng() < CLOCK.plant.shroomGrow) t.shrooms++; }
    else if (t.feature === 'tree'){
      if (weather.storm && tick - (t.planted || 0) > CLOCK.plant.pineOld && rng() < CLOCK.plant.pineFalls){ t.feature = null; addItem('log', t.x, t.y); addItem('stick', t.x, t.y); addItem('stick', t.x, t.y); if (camps.some(c => c.site && dist(t.x, t.y, ...c.site) <= 20)) log('An old pine comes down in the storm.', []); continue; }
      if (rng() < CLOCK.plant.stickDrops){ const q = nearFind(t.x, t.y, q => passable(q.x, q.y) && !q.feature && !itemAt(q.x, q.y) && !q.struct, RING); if (q) addItem('stick', q.x, q.y); } }
    else if (!t.feature){
      if (t.ground === 'ash' && rng() < CLOCK.plant.ashHeals) t.ground = 'grass';
      else if (t.ground === 'grass' && !t.struct && !itemAt(t.x, t.y) && rng() < CLOCK.plant.saplingSprouts && !t.mouth && nearFind(t.x, t.y, q => q.feature === 'tree', RING) && !camps.some(c => c.site && dist(t.x, t.y, ...c.site) <= 5)){ t.feature = 'sapling'; t.planted = tick; }
    }
  }
}
  /* Old carcasses rot. */
function rotCarcasses(){
  if (tick % CLOCK.every.carcassRot === 0){ const before = items.length; items = items.filter(i => (i.kind !== 'carcass' && i.kind !== 'venison' && i.kind !== 'fish') || tick - i.born < (i.kind === 'venison' ? CLOCK.food.venisonKeeps : i.kind === 'fish' ? CLOCK.food.fishKeeps : CLOCK.food.carcassKeeps) * (isWinter() ? 2 : 1)); if (items.length !== before) rebuildItemGrid(); }
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
