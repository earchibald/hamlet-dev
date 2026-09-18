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
  paintDepths();
  rockfall();
  generateRest(best);
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
}
/* Caves from depth marks, under the country's hills. A country dug but never raised gets one low hill first,
   since a cave mouth needs rock. The stream still runs when water flowed or pooled under the country. */
function paintDepths(){
  for (const r of liveRegions()){
    const m = marksOf(r, 'depth')[0]; if (!m) continue;
    const set = new Set(r.tiles);
    let mine = hills.filter(h => set.has(idx(h.x, h.y)));
    if (!mine.length) mine = uplift(set, 1, 1, m);
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
