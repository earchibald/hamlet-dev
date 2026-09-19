/* ---------- settle: from marks to tiles ----------
   When the last god sleeps, the marks become a valley. Painters run in a fixed order, each reading marks and
   writing tiles. Settle runs outside the god stream: painting draws from the people's stream where resetState
   left it, so a seed's valley depends on its marks and its seed, never on how many ages the gods took. */
function settle(){
  log(`The last of the gods sleeps. The world is ${age} ages old, and holds its breath.`, [], 'major');
  creation.ages = age; creation.settled = true; creation.gate = restGate();
  paintSectors();
  paintGround();
  paintRivers();
  paintLakes();
  /* The start country is dry, level and unscarred, so nothing after this line can move its ground: hills keep out
     of it, caves sit under hills, and scars need a scar mark. The person goes here because hillFits and rimExits
     both ask whether a hill opens onto the ground the first person can walk. */
  /* No ground at all in the start country is a failed check with lack `ground`, not a crash: the valley goes back
     to the gods. When the settle is final the person stands on the nearest walkable tile anywhere on the map. */
  let best = placeFirstPerson(), unfinished = false;
  if (!best){
    if (!creation.failed && creation.discards < MAX_DISCARDS){ undoSettle('ground'); return; }
    logUnfinished('ground'); unfinished = true;
    best = placeFirstPersonAnywhere();
  }
  startRegion = reachable(best.x, best.y, 0, NZ * W * H);
  /* Scars go before hills, so a chasm never cuts through a hill, and can take ground out of the walkable world. */
  paintScars();
  startRegion = reachable(best.x, best.y, 0, NZ * W * H);
  paintHeights();
  /* A hill's footprint turns ground to rock, which can pinch a way shut. Refresh the region before the caves are
     cut, so rimExits never hangs a cave mouth on ground the first person can no longer reach. */
  startRegion = reachable(best.x, best.y, 0, NZ * W * H);
  paintDepths();
  rockfall();
  /* Rockfall is the last step that can take a tile back out of the walkable world (a boulder where there was open
     ground). Refresh the region it changed, so a den's door isn't fooled by a bridge that just washed out. */
  startRegion = reachable(best.x, best.y, 0, NZ * W * H);
  items = []; itemGrid = new Array(NZ * W * H).fill(null);
  for (const t of world){ if (t.loose){ addItem(t.loose, t.x, t.y); delete t.loose; } }
  placeFinds();
  paintCreatures(best);
  /* The gate read marks; this reads tiles. A valley that will not hold a life is undone, and the ages go on.
     Two settles are final and are kept whatever they lack: the one after a failed creation, which has no ages
     left to go on with, and the one after MAX_DISCARDS throwbacks, because every discard repaints the whole
     valley and a shaky world must not repaint for ever. */
  const check = tileCheckImpl(firstPerson());
  if (!check.ok){
    if (!creation.failed && creation.discards < MAX_DISCARDS){ undoSettle(check.lack); return; }
    if (!unfinished) logUnfinished(check.lack);
  }
  placeBodies();
  era = 'days';
  /* The valley is final, and the era has turned, so the old names land on a map that will not be
     repainted and no name line can fall into the legends. */
  if (!lore) nameTheLand();
  const a = firstPerson();
  log(`${a.name} walks alone into the ${sectorOfTile(tileAt(a.x, a.y)).name.toLowerCase()} with nothing but two hands.`, [a], 'major');
}
/* The one line a final settle writes. A failed creation has no ages left; a creation at the cap has ages left but
   has spent its repaints. The two are different endings, so they read differently. */
function logUnfinished(lack){
  const why = creation.failed
    ? 'there is no age left to mend it'
    : `the world was thrown back ${MAX_DISCARDS} times and the gods will not paint it again`;
  log(`The world is settled unfinished. It lacks ${lack}, and ${why}.`, [], 'bad');
}
/* The real test of a world: from where the first person stands, by a real path search, water, ground to camp on,
   fuel, and food are all in reach. The gate checks marks; this checks tiles. */
function tileCheck(a){
  const full = NZ * W * H;
  const wet = (x, y, z) => z === 0 && !!nearFind(x, y, t => t.ground === 'water', NEAR, 0);
  if (!bfs(a.x, a.y, 0, wet, full, a)) return { ok: false, lack: 'water' };
  const ground = (x, y, z) => z === 0 && dist(x, y, a.x, a.y) <= 12 && passable(x, y, 0) && !tileAt(x, y).feature && tileAt(x, y).ground !== 'sand';
  if (!bfs(a.x, a.y, 0, ground, full, a)) return { ok: false, lack: 'ground' };
  const fuelAt = t => t.feature === 'tree' || t.feature === 'bush' || t.loose === 'stick' || (itemAt(t.x, t.y, 0) && itemAt(t.x, t.y, 0).kind === 'stick');
  const fuel = (x, y, z) => z === 0 && !!nearFind(x, y, fuelAt, NEAR, 0);
  if (!bfs(a.x, a.y, 0, fuel, full, a)) return { ok: false, lack: 'fuel' };
  const food = (x, y, z) => z === 0 && (!!nearFind(x, y, t => t.feature === 'bush' && t.berries > 0, NEAR, 0) || beings.some(b => b.alive && SPECIES[b.species].prey && b.z === 0 && dist(b.x, b.y, x, y) <= 2));
  if (!bfs(a.x, a.y, 0, food, full, a)) return { ok: false, lack: 'food' };
  /* Room. The gate named a start country from its marks, but water, a lake, or a chasm can shatter the ground
     under it. The person must be able to walk most of the country the gate chose, or it is a pocket, not a home. */
  const s = creation.gate.start;
  const here = reachable(a.x, a.y, 0, full);
  const open = s.tiles.filter(i => passable(i % W, (i - i % W) / W, 0));
  const held = open.filter(i => here.has(idx3(i % W, (i - i % W) / W, 0))).length;
  if (held * 2 < open.length) return { ok: false, lack: 'room' };
  return { ok: true };
}
/* A test seam. The settle calls the seam, so a test can make a world fail the check on purpose. */
let tileCheckImpl = tileCheck;
function setTileCheck(fn){ tileCheckImpl = fn; }
/* How often one creation may throw its valley back. The next settle after the cap is kept, whatever it lacks.
   Seed gamma is the worst of the six soak seeds and throws its valley back four times before one holds, so the
   cap is twice that: it never refuses a world the painters could still mend, and it still bounds the repaints. */
const MAX_DISCARDS = 8;
/* A failed settle is undone: the tiles, the hills, the caves, the items, the roll of what was made, and every
   being that is not a god. The next paintCreatures writes the roll again. */
function discardSettle(){
  levels = null; world = null; raised = []; hills = []; caves = []; groves = []; items = []; itemGrid = null; sectors = [];
  beings = beings.filter(b => b.species === 'god');
  creation.made = {};
  startRegion = null;
}
/* The world is thrown back. The god who lay down last stands up again, its country is free to be marked once
   more, and the era stays `gods`, so runAges goes on. */
function undoSettle(lack){
  creation.discards++; creation.settled = false;
  discardSettle();
  const last = gods().filter(g => g.status === 'asleep').sort((p, q) => (q.sleptAt || 0) - (p.sleptAt || 0))[0];
  if (last){
    last.status = 'awake'; last.asleep = false; last.needs.rest = 60;
    for (const r of liveRegions()) r.marks = r.marks.filter(m => !(m.kind === 'rest' && m.value === last.id));
    addThought(last, 'wouldnothold', 'The world would not hold', -10, CLOCK.thought.wouldnothold);
    log(`${last.name} wakes. The world would not hold a life: it lacks ${lack}. The ages go on.`, [last], 'bad');
  } else log(`The world would not hold a life: it lacks ${lack}. The ages go on.`, [], 'bad');
}
/* Hills from height marks: one to three per country by area, storeys from the mark up to the range. */
function paintHeights(){
  for (const r of liveRegions()){
    const m = marksOf(r, 'height')[0]; if (!m) continue;
    const count = clamp(Math.round(r.area / (4 * SECTOR_AREA)), 1, 3), storeys = clamp(m.value, 1, ZMAX);
    uplift(new Set(r.tiles), storeys, count, m);
  }
  /* The hunters den in hillsides. A country where a god made a species that dens, and no god ever raised the
     ground, gets one low hill, the way paintDepths raises one for a cave: a den mouth needs rock. */
  for (const r of liveRegions()){
    const m = marksOf(r, 'making').find(m => SPAWN[m.value] && SPAWN[m.value].den); if (!m) continue;
    const set = new Set(r.tiles);
    if (!hills.some(h => set.has(idx(h.x, h.y)))) uplift(set, 1, 1, m);
  }
}
/* The ground the first person can walk, as it stands now. Every painter that turns ground to rock calls this
   before the next painter reads it. */
function refreshStart(){ const a = firstPerson(); if (a) startRegion = reachable(a.x, a.y, 0, NZ * W * H); }
/* Caves from depth marks, under the country's hills. A country dug but never raised gets one low hill first,
   since a cave mouth needs rock. The stream still runs when water flowed or pooled under the country. */
function paintDepths(){
  for (const r of liveRegions()){
    const m = marksOf(r, 'depth')[0]; if (!m) continue;
    const set = new Set(r.tiles);
    let mine = hills.filter(h => set.has(idx(h.x, h.y)));
    /* A hill raised here is rock where there was ground, so the region is walked again before its cave looks
       for a mouth. */
    if (!mine.length){ mine = uplift(set, 1, 1, m); refreshStart(); }
    const levels = clamp(m.value, 1, -ZMIN);
    const wetUnder = hasMark(r, 'flow', 'under') || hasMark(r, 'pool', 'under');
    /* The cave carries the depth mark that cut it, not the height mark that raised the hill above it. */
    for (const c of cutWaterCaves(mine, levels, wetUnder)) c.mark = m;
  }
}
/* Scars: what the winner's pole left. */
function scarBurned(r){ for (const i of r.tiles){ const t = world[i]; if (t.ground === 'grass' || t.ground === 'soil'){ t.ground = 'ash'; t.feature = null; t.berries = 0; t.loose = rng() < 0.05 ? 'stick' : null; } } }
function scarCut(r){
  const { x0, y0, x1, y1 } = r.bbox; const alongX = (x1 - x0) >= (y1 - y0);
  const set = new Set(r.tiles); const line = r.tiles.filter(i => { const x = i % W, y = (i - x) / W; return alongX ? y === ((y0 + y1) >> 1) : x === ((x0 + x1) >> 1); });
  const gap = line.length >> 1;
  line.forEach((i, k) => { const t = world[i]; if (Math.abs(k - gap) <= 1){ t.ground = 'stone'; t.feature = null; } else if (keepsPaths(t)){ t.ground = 'rock'; t.feature = null; t.loose = null; t.chasm = r.id; } });
}
function scarDrowned(r){
  const jit = makeNoise(5); const picks = shuffle(r.tiles).slice(0, 3);
  for (const c of picks){ const cx = c % W, cy = (c - cx) / W;
    for (const i of r.tiles){ const x = i % W, y = (i - x) / W; const d = Math.hypot(x - cx, y - cy) / 5 + (jit(x, y) - 0.5) * 0.6; const t = world[i];
      if (d <= 1){ t.ground = 'water'; t.feature = null; t.berries = 0; t.loose = null; } else if (d <= 1.4 && t.ground === 'grass' && rng() < 0.5 && keepsPaths(t)){ t.feature = 'deadpine'; t.berries = 0; } } }
}
function scarBroken(r){ for (const i of r.tiles){ const t = world[i]; if (t.ground === 'grass' && !t.feature && rng() < 0.34 && keepsPaths(t)){ t.feature = 'boulder'; t.loose = null; } } }
const SCAR_PAINTERS = { burned: scarBurned, cut: scarCut, drowned: scarDrowned, broken: scarBroken };
function paintScars(){ for (const r of liveRegions()) for (const m of marksOf(r, 'scar')){ const p = SCAR_PAINTERS[m.value]; if (p) p(r); } }

/* ---------- the creatures of the makings, and the gods' bodies ---------- */
/* Who is spawned for a making, and how. Read by paintCreatures. */
const SPAWN = { rabbit: { n: 6 }, deer: { n: 3 }, fox: { n: 1, den: true }, wolf: { n: 2, den: true }, sprite: { grove: true }, gnome: { burrows: true }, human: null };
/* What the makings named. `creation.made` is written at settle from the same marks the painters read, and it is
   the whole roll of what may live in this world. Nothing the gods did not make wanders in later. */
function wasMade(sp){ return !!(creation && creation.made && creation.made[sp]); }
/* Every creature stands in the country where its god made it. A hunter gets a den first, and only what the den
   could not hold is put out on the open ground. */
function paintCreatures(first){
  groves = [];
  for (const r of liveRegions()) for (const m of marksOf(r, 'making')){
    const how = SPAWN[m.value]; if (!how) continue;
    creation.made[m.value] = true;
    const within = new Set(r.tiles);
    if (how.grove){ placeGrove(within, m); continue; }
    if (how.burrows){ digGnomeBurrows(within); continue; }
    let placed = 0;
    if (how.den){ const c = digDens(within, m.value); if (c) placed = spawnInDens(m.value, how.n, c); }
    if (placed < how.n) spawnAnimal(m.value, within, how.n - placed, first);
  }
}
/* A sleeping god stands at its body: a hill, a cave's deep, the river, a lake, or the ground where it lay down.
   One body holds one god, so every candidate already claimed is passed over, and two gods who slept in the same
   country take the two tiles their own rest marks name. */
function placeBodies(){
  for (const g of gods()){
    if (g.status !== 'asleep') continue;
    const r = settleHome(g); const set = r ? new Set(r.tiles) : new Set();
    let at = null, body = null;
    const mine = hills.filter(h => !h.god && set.has(idx(h.x, h.y))).sort((p, q) => q.storeys - p.storeys);
    const caves_ = caves.filter(c => !c.god && c.kind === 'water' && c.hill && set.has(idx(c.hill.x, c.hill.y)));
    const free = r && !r.god;
    if (g.pole === 'above' && mine.length){ body = mine[0]; const top = raised.find(t => t.hill === body && t.z === body.storeys && passable(t.x, t.y, t.z)) || raised.find(t => t.hill === body); at = top ? [top.x, top.y, top.z] : [body.x, body.y, 0]; }
    else if (g.pole === 'below' && caves_.length && caves_[0].deep){ body = caves_[0]; at = [body.deep.x, body.deep.y, body.deep.z]; }
    else if (g.pole === 'wet' && free){ const riv = world.find(t => t.river); if (riv){ body = r; at = [riv.x, riv.y, 0]; } }
    else if (g.pole === 'still' && free){ const lake = world.find(t => t.lake === (r && r.id)); if (lake){ body = r; at = [lake.x, lake.y, 0]; } }
    /* The last body is a country. A god whose own country is already taken lies down in the nearest country still
       free, because one body holds one god. The god stands where its rest mark says, if that ground can still be
       walked and lies in the country; if not, on the nearest walkable tile of the country. Tiles carry no god. */
    if (!at){
      const m = r && (marksOf(r, 'rest').find(m => m.value === g.id) || r.marks.find(m => m.kind === 'rest'));
      const anchor = m && m.at !== null && m.at !== undefined ? m.at : (r ? r.tiles[0] : 0);
      const ax0 = anchor % W, ay0 = (anchor - anchor % W) / W;
      /* One body holds one god, so a god whose own country is taken takes the nearest free country by its rest
         anchor, not the first in the list. When no country is free it lies down in no body at all. */
      const away = q => dist((q.bbox.x0 + q.bbox.x1) / 2, (q.bbox.y0 + q.bbox.y1) / 2, ax0, ay0);
      const home = r && !r.god ? r : liveRegions().filter(q => !q.god).sort((p, q) => away(p) - away(q))[0];
      if (home){
        const held = new Set(home.tiles);
        const ax = anchor % W, ay = (anchor - ax) / W;
        const walk = j => passable(j % W, (j - j % W) / W, 0);
        let i = held.has(anchor) && walk(anchor) ? anchor : null;
        if (i === null){ const t = nearFind(ax, ay, q => held.has(idx(q.x, q.y)) && passable(q.x, q.y, 0), RING); if (t) i = idx(t.x, t.y); }
        /* Still nothing beside the mark: the nearest walkable tile of the country, by straight-line distance. */
        if (i === null) for (const j of home.tiles){ if (!walk(j)) continue; if (i === null || dist(j % W, (j - j % W) / W, ax, ay) < dist(i % W, (i - i % W) / W, ax, ay)) i = j; }
        if (i === null) i = home.tiles[0];
        body = home; at = [i % W, (i - i % W) / W, 0];
      } else { at = [anchor % W, (anchor - anchor % W) / W, 0]; }
    }
    g.x = at[0]; g.y = at[1]; g.z = at[2]; g.body = body; if (body) body.god = g.id;
  }
}
