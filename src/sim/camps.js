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
/* How far apart two camps stand, in sectors. A new camp keeps this much ground from every camp that
   already has a site, so two lines do not share one stretch of valley floor. The founding party and
   the new line over the hills both read it. */
const CAMPS_APART = 3;
/* The sectors a new camp may take: a founding site far enough from every camp that has one. The
   caller sorts them, and the two callers sort them differently, so no order is set here. */
const campSites = () => foundingSites().filter(s => camps.every(c => !c.site || dist(secOf(...(c.site)).sx, secOf(...(c.site)).sy, s.sx, s.sy) >= CAMPS_APART));
function startFoundCamp(leader){
  const here = secOf(...camp.site);
  const region = reachable(camp.site[0], camp.site[1], 0, NZ * W * H);
  /* The party walks there carrying coals, so it takes the nearest ground that will do, and this sort
     draws nothing. The sort in `theLoneFounder` breaks its ties with `rng()`; that tiebreak belongs to
     that sort alone. Give the two one shared sort and every seed's golden record moves. */
  const cands = campSites().filter(s => region.has(idx3(...secCenter(s), 0)));
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
  for (const p of [leader, mate]){ failTask(p); p.camp = nc; p.campSince = tick; p.homeless = true; p.asleep = false; addThought(p, 'journey', 'Set out to found a new camp', 6, CLOCK.thought.journey); }
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

/* The camp's name as the chronicle says it. A camp with no name record has no name of its own
   yet, and is just "the camp". The test is the record, never the placeholder text: a rule reads
   data, not a name. */
const campNameOf = c => c && nameOf(c) ? c.name : 'the camp';
const campName = () => campNameOf(camp);

/* A stranger walks in from a reachable edge of the world and makes for `home`. Returns the person,
   or null when no edge of the world can reach that camp's site. The camp is an argument, not the
   global one the tick loop holds: a caller brings a person to a camp of its own choosing. */
function comeOverTheHills(home){
  const region = reachable(home.site[0], home.site[1], 0, NZ * W * H);
  const edges = []; for (let x = 0; x < W; x++){ edges.push(idx3(x, 0, 0), idx3(x, H - 1, 0)); } for (let y = 0; y < H; y++){ edges.push(idx3(0, y, 0), idx3(W - 1, y, 0)); }
  const ok = edges.filter(i => region.has(i));
  if (!ok.length) return null;
  const i = ok[rint(ok.length)] - ZOFF * W * H, x = i % W, y = (i - x) / W;
  const b = makeBeing('human', x, y, takeName(), rint(360)); b.homeless = true; b.camp = home; beings.push(b);
  lineageFor(b, { edge: x === 0 ? 'west' : x === W - 1 ? 'east' : y === 0 ? 'north' : 'south' });
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
  const b = comeOverTheHills(home); if (!b) return;
  wanderAt = 0;
  log(`${b.name} comes over the hills alone. No smoke called them. The hearth at ${campNameOf(home)} is cold. The bones of the people who lived here lie about it.`, [b], 'major');
}

/* One person alone beside a hearth they have let go cold. A birth needs two adults who like each
   other, so one person alone can never make a second. The count of one says that already, so nothing
   counts the adults again. The smoke cannot help them either, because a cold pit makes no smoke.
   One person with the fire out is not enough on its own. A camp is briefly down to one person with a
   cold pit often enough: mid-winter, mid-journey, a founding party on the road. So the hearth must
   have been cold a long while. `outSince` is the tick a pit went out, and it is 0 while the pit burns.
   The hearths counted are the hearths of the living, which today is the one camp the last person
   keeps. Written that way it stays true once a second line burns a fire of its own elsewhere. */
function aloneByAColdHearth(){
  const hs = humans();
  if (hs.length !== 1) return false;
  const hearths = camps.filter(c => c.pit && hs.some(h => h.camp === c));
  if (!hearths.length) return false;
  return hearths.every(c => { const t = tileAt(c.pit[0], c.pit[1]); return !!(t && t.struct && !t.struct.lit && c.outSince && tick - c.outSince >= CLOCK.arrival.afterTheDoomed); });
}

/* The last of a line, and the valley that goes on without them. Nobody is sent to rescue the one who
   lets the fire die: they keep their hermitage, and the chronicle says the line ends with them. The
   valley is a different matter. After the same wait as after the last death, and outside winter, a
   founder walks in over the hills far away and starts a camp of their own. The two may meet later by
   ordinary movement, as any two camps' people do. Nothing here arranges it.
   Only the count of the people holds the wait open. If the last one dies, `afterTheLast` takes the
   valley over, and this rule drops its wait rather than run a second one beside it. Once the founder
   is in, the valley is two again and the wait is over.
   The new ground is the farthest that will do, not the nearest: the new line should not tread on the
   hermit on its first day. Ties go to `rng()`, as `shelterSite` settles its ties. */
function theLoneFounder(){
  if (humans().length !== 1){ doomAt = 0; return; }
  const last = humans()[0];
  if (!doomAt){
    if (!aloneByAColdHearth()) return;
    doomAt = tick + CLOCK.arrival.afterTheLast;
    log(`${last.name} lets the hearth go cold and does not light it again. No child comes of one person alone. This line ends with them.`, [last], 'major');
    return;
  }
  if (tick < doomAt || isWinter()) return;
  /* One new line at a time. A camp begun this way is marked, and while anyone of it still lives the
     valley gets no third camp out of the hills. The mark is a field on the camp, so an old save that
     has never seen one simply reads it as absent. */
  if (camps.some(c => c.overTheHills && humans().some(h => h.camp === c))) return;
  const here = secOf(last.x, last.y);
  const cands = campSites().map(s => ({ s, sc: dist(s.sx, s.sy, here.sx, here.sy) + rng() })).sort((p, q) => q.sc - p.sc);
  /* No founding site anywhere, because the valley is short of loose rock, sticks, or water within
     reach. That is a passing state, not a settled one: loose items come and go as the world runs, so
     the ground the rule wants may be there tomorrow. Look again soon rather than every tick, the way
     a driven-out wolf that finds no hill waits `CLOCK.den.digRetry` instead of digging at the world
     every tick. The full stretch would be wrong here: it would hold the founder back for up to ten
     days after the ground came good, in the one case this rule exists for.
     The wait is restarted, not cleared. `doomAt` carries two meanings and has no third. Zero means
     the wait is over and a founder arrived. A tick ahead means the wait is running. Nothing in it
     says "the wait ran out and nothing could be done", so a failure has to borrow the second meaning,
     and a short value fits that meaning exactly. Clearing it looks obviously right and is wrong: zero
     sends the next tick back into the branch above, where the hermit is still alone beside a cold
     hearth, so the wait is set afresh and "This line ends with them" is said again, and again every
     ten days after. The chronicle says it once.
     Nothing was drawn to reach this line. The `rng()` sits inside the map's callback, so an empty
     `campSites()` calls it zero times by construction. Changing how often this block runs cannot
     change how often it draws, because the count is zero either way. */
  if (!cands.length){ doomAt = tick + CLOCK.arrival.foundRetry; return; }
  const nc = makeCamp('The new camp');
  for (const { s } of cands){
    /* `setSite` names the camp from whoever stands near it when the camp has no founder yet. The new
       camp has nobody in it, so that finds no one and gives no name; the founder names it below. */
    const prev = camp; camp = nc; setSite(...secCenter(s)); camp = prev;
    const b = comeOverTheHills(nc);
    if (!b) continue;   // no edge of the world reaches that ground; try the next
    nc.overTheHills = true;
    nameFoundersCamp(nc, b);
    doomAt = 0;
    log(`${b.name} comes over the hills into the ${s.name.toLowerCase()} and stops there. No smoke called them. They do not know that ${last.name} keeps a cold hearth on the far side of the valley.`, [b], 'major');
    return;
  }
  /* No ground the world's edge can reach, so the camp record goes with it. Take it out by identity,
     not by position: `camps` is a global array, and the loop above called `setSite` and
     `comeOverTheHills`, so the new camp being last is an assumption, not a guarantee. A `pop` that
     is ever wrong removes somebody else's camp and says nothing. */
  camps.splice(camps.indexOf(nc), 1);
  /* Wait the whole stretch out again, not the short retry the line above takes. The two failures are
     not the same failure, and the two waits are the point rather than an untidiness. No candidate
     ground reachable from any edge of the world is terrain, and terrain does not change tick to tick,
     so looking again soon costs a camp record and a flood fill per site and gains nothing. Running
     short of loose rock and sticks does change, so that one looks again soon. A stable failure waits
     the stretch; a passing one waits half a day.
     Restart the wait here too; do not clear it, for the reason written out above at `!cands.length`. */
  doomAt = tick + CLOCK.arrival.afterTheLast;
}

/* One tick of camp life: the pit burns, food spoils, the sprites weigh the camp, people are born, lightning falls, and the smoke draws newcomers. */
function updateCamps(){
  afterTheLast();
  theLoneFounder();
  /* Read once rather than per camp: every camp's rate-driven work shares the world's beat. The
     event-driven parts below -- an arrival whose tick is stored, a village promotion that waits on a
     storehouse -- are not on it, because their next moment is already named by something else. */
  const onCampBeat = tick % CLOCK.every.cellular === 0;
  for (const c of camps){
    camp = c;
    const pt = pitTile();
    /* The pit burns by elapsed time, on the beat, rather than a tick at a time. `pitBurn` is fuel a
       tick, so a beat costs it the beat's ticks, and `litTicks` and `streak` ADD the beat rather
       than being stepped through it. They stay counts of ticks; only the grain changes.
       The tick a fire goes out is therefore a division and not a roll, which is what lets task 4
       name it ahead of time. It is quantised to the beat now, which is still exactly nameable. */
    if (pt && pt.struct.lit && onCampBeat){
      camp.outSince = 0;
      const n = CLOCK.every.cellular;
      const p = pt.struct; p.fuel -= CLOCK.rate.pitBurn * n * (weather.storm ? 1.5 : 1) * (isWinter() ? 1.2 : 1) * (camp.fae.favor >= 30 ? 0.85 : 1); camp.litTicks += n; camp.streak += n; camp.bestStreak = Math.max(camp.bestStreak, camp.streak);
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
        lineageFor(c, { roof: true, village: !!camp.village,
          foundersChild: camps.some(k => k.founder === pair.p.id) && camps.some(k => k.founder === pair.q.id),
          firstBorn: !beings.some(b => b !== c && b.species === 'human' && b.parents && b.lineage && b.lineage.camp === camp.id) });
        for (const par of [pair.p, pair.q]){ par.rel[c.id] = 'child'; c.rel[par.id] = 'parent'; par.opinions[c.id] = 60; c.opinions[par.id] = 60; addThought(par, 'birth', `${c.name} was born`, 15, CLOCK.thought.birthParent); }
        for (const h of campHumans()) if (h !== pair.p && h !== pair.q) addThought(h, 'birth', `A child, ${c.name}, was born in the camp`, 6, CLOCK.thought.birthCamp);
        log(`${c.name} is born to ${pair.p.name} and ${pair.q.name} under the roof of ${camp.name}.`, [c, pair.p, pair.q], 'major', 'birth');
      }
    }
    if (onCampBeat) tryLightning();
    /* The fire draws people. */
    if (camp.everLit && camp.nextArrival && tick >= camp.nextArrival){
      camp.nextArrival = tick + CLOCK.arrival.wait + rint(CLOCK.arrival.spread);
      if (pitLit() && stashFood() >= foodTarget() && campHumans().length < 4 + bedsFor() && !isWinter() && rng() < (camp.village ? CLOCK.arrival.villageChance : CLOCK.arrival.chance)){
        const b = comeOverTheHills(camp);
        if (b) log(`Someone saw the smoke. ${b.name} comes over the hills toward ${campName()}.`, [b], 'major');
      }
    }
  }
  nameTick();
}
