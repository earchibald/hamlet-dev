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
  const best = placeFirstPerson();
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
  placeBodies();
  era = 'days';
  const a = beings.find(b => b.species === 'human');
  log(`${a.name} walks alone into the ${sectorOfTile(tileAt(a.x, a.y)).name.toLowerCase()} with nothing but two hands.`, [a], 'major');
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
    if (m.value in SPAWN) creation.made[m.value] = true;
    const how = SPAWN[m.value]; if (!how) continue;
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
      const home = r && !r.god ? r : (liveRegions().find(q => !q.god) || r);
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
