/* ---------- camps: the stash, the site, founding, and the per-camp tick ---------- */
function makeCamp(name){
  const c = { id: nextId++, name, site: null, target: null, pit: null, stashTile: null,
    stash: { stick: 0, rock: 0, berries: 0, carcass: 0, venison: 0, cooked: 0, smoked: 0, log: 0, hide: 0, water: 0, moss: 0, fibre: 0, cord: 0, fish: 0, clay: 0, pot: 0, cuttings: 0 }, rot: { cooked: [], berries: [] },
    fae: { known: false, favor: 0, grudges: {}, blightUntil: 0, lastPrank: 0 }, gnomes: { known: false }, stone: null, ward: null,
    tools: { axe: 0, waterskin: 0, spear: 0, firestones: 0, basket: 0, rod: 0 }, shelter: null, rack: null, storehouse: null, workshop: null, kiln: null, garden: null, huts: [], village: false, snares: [], pitfalls: [], litTicks: 0, streak: 0, bestStreak: 0, everLit: false, outSince: 0, nextArrival: 0, siteReason: '', coals: 0, rotLogged: 0, wolfLogged: 0, guardLogged: 0, fished: 0, founded: tick };
  /* `c.name` reads plain from the start, so a chronicle line never special-cases it. The camp
     gets its first name record once someone is there to give it one: at the site (`setSite`),
     or, failing that, at the hearth (`nameCampAtHearth`). A placeholder such as "The first camp"
     is not a name; do not give it one here, or its name history would start with a name nobody
     gave it. */
  c.names = []; c.namedAt = 0; c.founder = null; c.villageNamed = 0;
  camps.push(c); return c;
}
const campHumans = () => beings.filter(b => b.species === 'human' && b.alive && b.camp === camp);
const campNear = (a, r) => camps.filter(c => c.site && nearAt(a, ...c.site) <= r).sort((p, q) => nearAt(a, ...p.site) - nearAt(a, ...q.site))[0] || null;

function stashAdd(kind, n){
  camp.stash[kind] = (camp.stash[kind] || 0) + n;
  if (camp.rot[kind]){ const life = (kind === 'cooked' ? CLOCK.food.cookedKeeps : CLOCK.food.berriesKeep) * (isWinter() ? 2 : 1) * (camp.storehouse ? 2 : 1) * (kind === 'berries' && camp.stash.pot > 0 ? 2 : 1); for (let k = 0; k < n; k++) camp.rot[kind].push(tick + life); }
}
function stashTake(kind, n = 1){ camp.stash[kind] = Math.max(0, camp.stash[kind] - n); if (camp.rot[kind]) camp.rot[kind].splice(0, n); }
function spoilFood(){
  let lost = 0;
  for (const kind in camp.rot){ const keep = camp.rot[kind].filter(t => t > tick); lost += camp.rot[kind].length - keep.length; camp.rot[kind] = keep; camp.stash[kind] = Math.min(camp.stash[kind], keep.length); }
  if (lost && tick - camp.rotLogged > CLOCK.cooldown.rotLine){ camp.rotLogged = tick; log(`Some food in the stash has gone off. Smoked meat would have kept.`, campHumans(), 'bad'); }
}
const stashFood = () => camp.stash.berries + camp.stash.cooked + camp.stash.smoked;
const foodTarget = () => (seasonOf() === 'autumn' ? 12 : isWinter() ? 10 : 6) + (camp.storehouse ? 6 : 0) + campHumans().length;
const sleepPlaces = () => [camp.shelter, ...camp.huts].filter(Boolean);
const bedsFor = () => sleepPlaces().length * 3;
const pitTile = () => camp.pit ? tileAt(camp.pit[0], camp.pit[1]) : null;
const pitLit = () => { const t = pitTile(); return !!(t && t.struct && t.struct.lit); };

/* Score a camp site. The person explains the choice in the chronicle. */
function chooseSite(a){
  const s = secOf(a.x, a.y), region = reachable(a.x, a.y, a.z, 3000);
  let best = null;
  for (let y = s.sy * LH + 1; y < (s.sy + 1) * LH - 1; y++) for (let x = s.sx * LW + 1; x < (s.sx + 1) * LW - 1; x++){
    const t = tileAt(x, y);
    if (!region.has(idx3(x, y, 0)) || t.feature) continue;
    if (!RING.every(([dx, dy]) => passable(x + dx, y + dy) && !tileAt(x + dx, y + dy).feature)) continue;
    let sc = 0; const why = [];
    let water = 99, trees = 0, bushes = 0;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++){
      if (!inb(x + dx, y + dy)) continue;
      const q = tileAt(x + dx, y + dy), d = Math.abs(dx) + Math.abs(dy);
      if (q.ground === 'water') water = Math.min(water, d);
      if (q.feature === 'tree' && d <= 3) trees++;
      if (q.feature === 'bush' && d <= 8) bushes++;
    }
    if (water <= 8){ sc += 20 - water; why.push('water close by'); } else sc -= 10;
    if (trees === 0){ sc += 10; why.push('no trees to catch fire'); } else sc -= trees * 6;
    if (bushes){ sc += Math.min(8, bushes * 2); why.push('berries nearby'); }
    let faces = 0, dens = 0; for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++){ if (!inb(x + dx, y + dy)) continue; const q = tileAt(x + dx, y + dy); if (GROUND[q.ground].quarry && Math.abs(dx) + Math.abs(dy) <= 12) faces++; } for (const k of caves) if (k.kind === 'den' && k.owner === 'wolf' && !k.cleared && dist(k.exit.x, k.exit.y, x, y) <= 20) dens++;
    if (t.ground === 'soil' || t.ground === 'sand'){ sc += 5; why.push('bare ground'); }
    if (faces){ sc += 8; why.push('stone close by'); } if (dens){ sc -= 15; why.push('a wolf den too near'); }
    sc -= dist(x, y, a.x, a.y) * 0.15;
    const edge = Math.min(x - s.sx * LW, (s.sx + 1) * LW - 1 - x, y - s.sy * LH, (s.sy + 1) * LH - 1 - y); if (edge < 4) sc -= (4 - edge) * 3;
    if (!best || sc > best.sc) best = { x, y, sc, why };
  }
  if (!best) return false;
  /* The actor wins the name: whoever chose the spot named it, not whoever `setSite`
     might otherwise pick as the most sociable person standing there. */
  nameFoundersCamp(camp, a);
  setSite(best.x, best.y);
  camp.siteReason = best.why.join(', ');
  log(`${a.name} picks a spot for the camp: ${best.why.join(', ')}.`, [a], 'major');
  return true;
}
function setSite(x, y){
  camp.site = [x, y];
  const st = nearFind(x, y, t => passable(t.x, t.y) && !t.feature, RING) || tileAt(x, y);
  camp.stashTile = [st.x, st.y];
  /* A fallback only: when nobody has named this camp yet (the door's site act, or any
     other path that sets a site without an actor of its own), give it a founder from
     whoever is there to name it, so a camp raised through `inject()` is never left
     carrying "The first camp". A caller that already named the camp (`chooseSite`) is
     never overridden here. */
  if (!camp.founder){ const founder = namerFor([x, y]); if (founder) nameFoundersCamp(camp, founder); }
}
/* A wildfire within reach of the camp, for fetching an ember. */
function nearbyBlaze(){
  if (fireCount <= 0 || !camp.site) return null;
  const [cx, cy] = camp.site; let best = null;
  for (const t of world){ if (t.fire <= 0) continue; const d = dist(t.x, t.y, cx, cy); if (d <= 60 && (!best || d < best.d)) best = { t, d }; }
  for (const t of raised){ if (t.fire <= 0) continue; const d = dist(t.x, t.y, cx, cy); if (d <= 60 && (!best || d < best.d)) best = { t, d }; }
  return best ? best.t : null;
}

function openSpotNear(at, dmin, dmax){
  if (!at) return null;
  const [px, py] = at; let best = null;
  for (let dy = -dmax; dy <= dmax; dy++) for (let dx = -dmax; dx <= dmax; dx++){
    const x = px + dx, y = py + dy, d = Math.abs(dx) + Math.abs(dy); if (d < dmin || d > dmax || !inb(x, y)) continue;
    const t = tileAt(x, y); if (!passable(x, y) || t.feature || t.struct || (camp.stashTile[0] === x && camp.stashTile[1] === y)) continue;
    const sc = -d + (t.ground === 'soil' ? 1 : 0) + rng(); if (!best || sc > best.sc) best = { x, y, sc };
  }
  return best ? [best.x, best.y] : null;
}

/* A party founds where a pit can be built: rocks, sticks, and water within reach. A mark-painted meadow can be
   wide and bare. Reach is the sector and its four neighbours; the cost is the fire pit goal's own need. */
function aroundSector(s, count){
  let n = count(s);
  for (const [dx, dy] of DIRS){ const nx = s.sx + dx, ny = s.sy + dy; if (nx >= 0 && nx < SW && ny >= 0 && ny < SH) n += count(sectors[secIdx(nx, ny)]); }
  return n;
}
function foundingSites(){
  const need = GOALS.find(g => g.id === 'firepit').need;
  const wet = s => sectorCount(s, 'water', t => t.ground === 'water');
  return sectors.filter(s => GROWS[s.biome] &&
    aroundSector(s, looseCount('rock')) >= need.rock &&
    aroundSector(s, looseCount('stick')) >= need.stick &&
    aroundSector(s, wet) > 0);
}
function startFoundCamp(leader){
  const here = secOf(...camp.site);
  const region = reachable(camp.site[0], camp.site[1], 0, NZ * W * H);
  const cands = foundingSites().filter(s => camps.every(c => !c.site || dist(secOf(...(c.site)).sx, secOf(...(c.site)).sy, s.sx, s.sy) >= 3) && region.has(idx3(...secCenter(s), 0)));
  if (!cands.length) return false;
  const target = cands.sort((p, q) => dist(p.sx, p.sy, here.sx, here.sy) - dist(q.sx, q.sy, here.sx, here.sy))[0];
  const mates = campHumans().filter(h => h !== leader && !h.homeless).sort((p, q) => (leader.opinions[q.id] || 0) - (leader.opinions[p.id] || 0));
  const mate = mates[0]; if (!mate) return false;
  const old = camp, nc = makeCamp(`${leader.name}'s camp`);
  /* The new camp has a founder and a name record from the moment the party leaves, so its first
     chronicle line reads under a real name and `notableCandidates` knows who made it. */
  nameFoundersCamp(nc, leader);
  nc.target = secCenter(target); nc.coals = tick + CLOCK.party.coalsLast;
  const take = (k, n) => { const m = Math.min(n, old.stash[k]); if (m > 0){ old.stash[k] -= m; if (old.rot[k]) old.rot[k].splice(0, m); nc.stash[k] += m; if (nc.rot[k]) for (let i = 0; i < m; i++) nc.rot[k].push(tick + CLOCK.party.foodKeeps); } };
  take('smoked', 3); take('berries', 3); take('stick', 4);
  old.sentParty = `${leader.name} and ${mate.name}`;
  for (const p of [leader, mate]){ failTask(p); p.camp = nc; p.homeless = true; p.asleep = false; addThought(p, 'journey', 'Set out to found a new camp', 6, CLOCK.thought.journey); }
  for (const h of humans()) if (h.camp === old) addThought(h, 'parting', `${leader.name} and ${mate.name} left for a new valley`, -3, CLOCK.thought.parting);
  log(`${leader.name} and ${mate.name} set out for the ${target.name.toLowerCase()} to the ${target.sx < here.sx ? 'west' : target.sx > here.sx ? 'east' : target.sy < here.sy ? 'north' : 'south'}, carrying coals in a bundle of bark.`, [leader, mate], 'major', 'found');
  return startTask(leader, 'join');
}
function shelterSite(){
  const [px, py] = camp.pit; let best = null;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++){
    const x = px + dx, y = py + dy, d = Math.abs(dx) + Math.abs(dy); if (d < 2 || d > 3 || !inb(x, y)) continue;
    const t = tileAt(x, y); if (!passable(x, y) || t.feature || t.struct || (camp.stashTile[0] === x && camp.stashTile[1] === y)) continue;
    const sc = -d + (t.ground === 'soil' ? 1 : 0) + rng(); if (!best || sc > best.sc) best = { x, y, sc };
  }
  return best ? [best.x, best.y] : null;
}

/* The camp's name as the chronicle says it. The first camp has no name of its own yet. */
const campName = () => camp.name === 'The first camp' ? 'the camp' : camp.name;

/* A stranger walks in from a reachable edge of the world and makes for `camp`. Returns the person,
   or null when no edge of the world can reach the camp's site. */
function comeOverTheHills(){
  const region = reachable(camp.site[0], camp.site[1], 0, NZ * W * H);
  const edges = []; for (let x = 0; x < W; x++){ edges.push(idx3(x, 0, 0), idx3(x, H - 1, 0)); } for (let y = 0; y < H; y++){ edges.push(idx3(0, y, 0), idx3(W - 1, y, 0)); }
  const ok = edges.filter(i => region.has(i));
  if (!ok.length) return null;
  const i = ok[rint(ok.length)] - ZOFF * W * H, x = i % W, y = (i - x) / W;
  const b = makeBeing('human', x, y, takeName(), rint(360)); b.homeless = true; b.camp = camp; beings.push(b);
  return b;
}

/* The valley after the last person. The smoke arrival cannot fire, because a cold pit makes no smoke,
   and that is why the camp cannot save itself. So the world offers one slower way in. When nobody
   lives in the valley, a lone wanderer crosses the hills without being called, outside winter, and
   finds the hearth cold. The run does not end: the animals, the sprites, and the weather go on. */
function afterTheLast(){
  if (!beings.some(b => b.species === 'human')) return;   // no person has lived here yet
  if (humans().length){ wanderAt = 0; return; }
  if (!wanderAt){
    wanderAt = tick + CLOCK.arrival.afterTheLast;
    log('The last person in the valley is dead. No one is left to feed the fire. The camp stands empty.', [], 'major');
    return;
  }
  if (tick < wanderAt || isWinter()) return;
  const home = camps.find(c => c.site); if (!home) return;
  camp = home;
  const b = comeOverTheHills(); if (!b) return;
  wanderAt = 0;
  log(`${b.name} comes over the hills alone. No smoke called them. The hearth at ${campName()} is cold. The bones of the people who lived here lie about it.`, [b], 'major');
}

/* One tick of camp life: the pit burns, food spoils, the sprites weigh the camp, people are born, lightning falls, and the smoke draws newcomers. */
function updateCamps(){
  afterTheLast();
  for (const c of camps){
    camp = c;
    const pt = pitTile();
    if (pt && pt.struct.lit){
      camp.outSince = 0;
      const p = pt.struct; p.fuel -= CLOCK.rate.pitBurn * (weather.storm ? 1.5 : 1) * (isWinter() ? 1.2 : 1) * (camp.fae.favor >= 30 ? 0.85 : 1); camp.litTicks++; camp.streak++; camp.bestStreak = Math.max(camp.bestStreak, camp.streak);
      if (p.fuel <= 0){ p.fuel = 0; p.lit = false; camp.streak = 0; camp.outSince = tick; log('The fire goes out. Only embers and cold stone remain.', campHumans(), 'bad'); for (const h of campHumans()) addThought(h, 'fireout', 'The fire went out', -8, CLOCK.thought.fireout); }
    } else if (pt && !pt.struct.lit && !camp.outSince){
      camp.outSince = tick;
    }
    if (tick % CLOCK.every.spoil === 0) spoilFood();
    if (tick % CLOCK.every.fae === 0) faeTick();
    /* The promotion sets the flag and the thought, on this tick, as it always has: the layout
       guard needs a being's mood to move at the same moment it does today. The naming and the
       chronicle line belong to nameVillage, which runs in the nightly pass, at its own fire. */
    if (!camp.village && camp.storehouse && camp.huts.length >= 2 && campHumans().length >= 8){ camp.village = true; for (const h of campHumans()) addThought(h, 'village', 'We live in a village', 6, CLOCK.thought.village); }
    /* Births. Two people who like each other, a roof, a warm season, and the food goal met.
       A camp takes another mouth only while it is stocked. Beds alone let a village grow past what
       the land feeds, and winter, when nothing can be gathered, then killed it together. */
    if (tick % CLOCK.birth.every === 0 && camp.shelter && (seasonOf() === 'spring' || seasonOf() === 'summer') && stashFood() >= foodTarget() && rng() < CLOCK.birth.chance){
      const hs = campHumans().filter(h => stage(h) === 'adult' && tick - h.lastChild > CLOCK.birth.gap);
      let pair = null;
      for (const p of hs) for (const q of hs) if (p.id < q.id && (p.opinions[q.id] || 0) >= 35 && (q.opinions[p.id] || 0) >= 35 && (!pair || (p.opinions[q.id] + q.opinions[p.id]) > pair.v)) pair = { p, q, v: p.opinions[q.id] + q.opinions[p.id] };
      if (pair){
        const [hx, hy] = camp.shelter, c = makeBeing('human', hx, hy, takeName(), (pair.p.hue + pair.q.hue) / 2 % 360);
        c.born = tick; c.camp = camp; c.parents = [pair.p.id, pair.q.id]; c.skills = Object.fromEntries(Object.keys(c.skills).map(k => [k, 0]));
        for (const t in c.traits) c.traits[t] = clamp(Math.round(((pair.p.traits[t] + pair.q.traits[t]) / 2 + (rng() - 0.5) * 0.3) * 100) / 100, 0, 1);
        beings.push(c); pair.p.lastChild = pair.q.lastChild = tick;
        for (const par of [pair.p, pair.q]){ par.rel[c.id] = 'child'; c.rel[par.id] = 'parent'; par.opinions[c.id] = 60; c.opinions[par.id] = 60; addThought(par, 'birth', `${c.name} was born`, 15, CLOCK.thought.birthParent); }
        for (const h of campHumans()) if (h !== pair.p && h !== pair.q) addThought(h, 'birth', `A child, ${c.name}, was born in the camp`, 6, CLOCK.thought.birthCamp);
        log(`${c.name} is born to ${pair.p.name} and ${pair.q.name} under the roof of ${camp.name}.`, [c, pair.p, pair.q], 'major', 'birth');
      }
    }
    tryLightning();
    /* The fire draws people. */
    if (camp.everLit && camp.nextArrival && tick >= camp.nextArrival){
      camp.nextArrival = tick + CLOCK.arrival.wait + rint(CLOCK.arrival.spread);
      if (pitLit() && stashFood() >= foodTarget() && campHumans().length < 4 + bedsFor() && !isWinter() && rng() < (camp.village ? CLOCK.arrival.villageChance : CLOCK.arrival.chance)){
        const b = comeOverTheHills();
        if (b) log(`Someone saw the smoke. ${b.name} comes over the hills toward ${campName()}.`, [b], 'major');
      }
    }
  }
  nameTick();
}
