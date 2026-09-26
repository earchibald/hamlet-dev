/* ---------- fire, storms, and lightning ---------- */
function ignite(t){ if (t.fire > 0) return false; const f = tileFuel(t); if (f <= 0) return false; t.fire = f; fireCount++; return true; }
function burnOut(t){
  t.fire = 0;
  if (t.feature === 'tree' || t.feature === 'hollow'){ const g = groves.find(g => g.sector === sectorOfTile(t)); if (g) g.anger = Math.min(100, g.anger + (t.feature === 'hollow' ? 60 : 3)); if (t.feature === 'hollow'){ log('A hollow pine burns. Whatever lived in it screams once and is silent.', [], 'bad'); const k = groves.indexOf(g); if (k >= 0) groves.splice(k, 1); } }
  if (t.feature && MATERIALS[matOf(t)].flam > 0){ t.feature = null; t.berries = 0; t.garden = null; }
  if (!t.feature && t.ground === 'grass') t.ground = 'ash';
  if (t.struct && t.struct.type === 'snare'){ const sn = t.struct.snare, k = sn.camp.snares.indexOf(sn); if (k >= 0) sn.camp.snares.splice(k, 1); t.struct = null; }
  if (t.struct && ['rack', 'leanto', 'hut', 'storehouse', 'workshop'].includes(t.struct.type)){ const c = t.struct.camp, k = t.struct.type; if (c){ if (k === 'rack') c.rack = null; else if (k === 'leanto') c.shelter = null; else if (k === 'storehouse') c.storehouse = null; else if (k === 'workshop') c.workshop = null; else c.huts = c.huts.filter(h => h[0] !== t.x || h[1] !== t.y); log(`The ${k === 'leanto' ? 'lean-to' : k === 'rack' ? 'drying rack' : k} burns down.`, [], 'bad'); } t.struct = null; }
  else if (t.struct && t.struct.type === 'pitfall'){ const p = t.struct.pit, i = p.camp.pitfalls.indexOf(p); if (i >= 0) p.camp.pitfalls.splice(i, 1); t.struct = null; }
  const before = items.length; items = items.filter(i => i.x !== t.x || i.y !== t.y || i.z !== t.z || MATERIALS[ITEMS[i.kind].mat].flam === 0); if (items.length !== before) rebuildItemGrid();
}

/* Fire spreads to neighbours and burns down. Rain slows it. Surface tiles first, then the tiles off the surface. */
function spreadFire(){
  if (!onBeat('spreadFire')) return;
  if (fireCount <= 0) return;
  let count = 0;
  for (const t of world) if (t.fire > 0){ count++; burnTile(t); }
  for (const t of raised) if (t.fire > 0){ count++; burnTile(t); }
  fireCount = count;
}
/* One burning tile: spread to the four beside it, up from a slope, and down onto a slope. Uphill is 1.5 times as likely. */
function burnTile(t){
  t.fire -= CLOCK.fire.burn * CLOCK.every.cellular;
  for (const [dx, dy] of DIRS) spreadTo(t.x + dx, t.y + dy, t.z, 1);
  if (t.slope) for (const [dx, dy] of DIRS) spreadTo(t.x + dx, t.y + dy, t.z + 1, 1.5);
  for (const [dx, dy] of DIRS){ const nx = t.x + dx, ny = t.y + dy; if (hasTile(nx, ny, t.z - 1) && tileAt(nx, ny, t.z - 1).slope) spreadTo(nx, ny, t.z - 1, 1); }
  if (weather.storm) t.fire -= CLOCK.fire.stormQuench * CLOCK.every.cellular;
  if (t.fire <= 0) burnOut(t);
}
function spreadTo(nx, ny, nz, mult){
  if (!hasTile(nx, ny, nz)) return; const nb = tileAt(nx, ny, nz); if (nb.fire > 0) return;
  const f = tileFlam(nb); if (f > 0 && rng() < rollFor(f * (weather.storm ? CLOCK.fire.stormSpread : CLOCK.fire.spread) * mult, CLOCK.every.cellular)) ignite(nb);
}
/* Weather. Storms bring rain and lightning. */
function updateWeather(){
  if (!onBeat('updateWeather')) return;
  if (!weather.storm && tick >= weather.next){ weather.storm = true; weather.until = tick + CLOCK.storm.length + rint(CLOCK.storm.lengthSpread); log(isWinter() ? 'Sleet drives across the valley.' : 'A storm rolls in over the hills.', humans()); }
  if (weather.storm && tick >= weather.until) endStorm();
}
/* A storm ends, and the next one is set. The Calm (faith.js) ends one the same way. */
function endStorm(){ weather.storm = false; weather.next = tick + (seasonOf() === 'summer' ? CLOCK.storm.summerGap : CLOCK.storm.gap) + rint(CLOCK.storm.gapSpread); }
/* Lightning near the camp, only in storms. More often when the hearth is out. */
function tryLightning(){
  if (camp.site && weather.storm){
    const out = camp.pit && !pitLit();
    if (rng() < rollFor(out ? CLOCK.rate.lightningOut : CLOCK.rate.lightningLit, CLOCK.every.cellular)){
      const sc = secOf(...camp.site), sx = clamp(sc.sx + rint(3) - 1, 0, SW - 1), sy = clamp(sc.sy + rint(3) - 1, 0, SH - 1);
      let hit = null;
      /* With the pit cold, a strike near a camp takes a pine an ember can be fetched from: near the site, with
         open ground beside it that people reach from the site. So a lone tree or the edge of a wood, and not a
         pine deep in a wood, on an island, or in a clearing closed in by trees. On seed moss-crag-87 the first
         strike near the cold camp, on day 8.00, fell deep inside the pine wood, where nobody could stand beside
         it. The check draws no random number, but a pine it turns down costs the draws of another try. With the
         pit lit, nobody needs the ember, so the pick is the old one and so is the random stream. */
      const reach = out ? campReach() : null, fetchable = t => t.fire <= 0 && (!out || canFetchFrom(t, reach));
      for (let k = 0; k < 60 && !hit; k++){ const t = tileAt(sx * LW + rint(LW), sy * LH + rint(LH)); if (t.feature === 'tree' && fetchable(t)) hit = t; }
      for (let k = 0; k < 40 && !hit; k++){ const t = tileAt(sx * LW + rint(LW), sy * LH + rint(LH)); if (tileFuel(t) > 0 && fetchable(t)) hit = t; }
      if (hit && ignite(hit)){ hit.fire = Math.max(hit.fire, CLOCK.fire.strikeFuel); log(`Lightning strikes ${hit.feature === 'tree' ? 'a pine' : 'the ground'} in the ${sectors[secIdx(sx, sy)].name.toLowerCase()} near the camp. Something is burning.`, campHumans(), out ? 'good' : 'bad', 'fire'); }
    }
  }
}
/* A stray strike anywhere in the world. */
/* The chance was a chance a tick and is now rolled once a beat over the beat's ticks, so the strikes
   a storm makes in a world day are what they were. `rollFor` compounds; it does not multiply. */
function strayLightning(){
  if (!onBeat('strayLightning')) return;
  if (weather.storm && rng() < rollFor(CLOCK.rate.strayLightning, CLOCK.every.cellular)){ for (let k = 0; k < 60; k++){ const t = world[rint(W * H)]; if (t.feature === 'tree' && t.fire === 0){ ignite(t); log('Lightning strikes a pine, and it catches fire.', [], 'bad'); break; } } }
}
