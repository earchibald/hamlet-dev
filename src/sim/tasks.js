/* ---------- human work tasks ---------- */
function startFetchEmber(a){
  const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, t => t.fire > 0, DIRS, z), 3500, a); if (!p) return false;
  a.task = { type: 'ember', label: 'Running to the blaze for an ember', path: p, fast: true,
    arrive(a, t){
      if (!a.carrying){
        if (!nearFind(a.x, a.y, q => q.fire > 0, DIRS, a.z)) return 'fail';
        a.carrying = { kind: 'ember', count: 1, dies: tick + EMBER_LIFE }; addThought(a, 'ember', 'Snatched fire from a wildfire', 4, 500);
        log(`${a.name} grabs a burning branch from the blaze and runs for the camp.`, [a], 'good');
        const [px, py] = camp.pit; const q = legPath(a, px, py, 1); if (!q) return 'fail'; t.path = q; t.label = 'Carrying the ember to the pit'; return 'continue';
      }
      const [px, py] = camp.pit;
      if (nearAt(a, px, py) > 1){ const q = legPath(a, px, py, 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
      const pit = pitTile().struct; a.carrying = null;
      if (pit.fuel <= 0) return 'fail';
      if (pit.lit){ log(`${a.name} adds the ember to a fire someone else already lit.`, [a]); return 'done'; }
      pit.lit = true; camp.everLit = true; camp.nextArrival = camp.nextArrival || tick + 700;
      log(`${a.name} sets the ember in the pit. The fire is back, and nobody waited for the sky.`, campHumans(), 'major');
      addThought(a, 'rekindled', 'Brought fire home', 10, 1200); for (const h of campHumans()) addThought(h, 'hearth', 'The fire is lit', 8, 1000);
      return 'done';
    } };
  return true;
}

/* ---------- task builders (humans) ---------- */
/* Continue straight into a new task from inside an old one. */
function chain(a, old, ok){ if (!ok) return null; a.task.started = old.started; a.task.key = old.key; return 'continue'; }
function startBuild(a, at, work, label, done, skill){
  const p = legPath(a, at[0], at[1], 1); if (!p) return false;
  a.task = { type: 'work', label: `Walking to ${label.toLowerCase().replace(/^\w+ing /, '')}`, path: p, progress: 0, target: at, within: 1,
    arrive(a, t){
      if (nearAt(a, at[0], at[1]) > 1){ const q = legPath(a, at[0], at[1], 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
      t.progress += workSpeed(a, skill || (/cook|smok|butcher/i.test(label) ? 'cook' : /knap|sew|spear/i.test(label) ? 'craft' : /snare/i.test(label) ? 'trap' : 'build')); t.label = `${label} (${Math.min(99, Math.floor(t.progress / work * 100))}%)`;
      if (t.progress < work) return 'continue';
      done(a); return 'done';
    } };
  return true;
}
function startDeliver(a){
  if (!camp.stashTile || !a.carrying) return false;
  if (a.carrying.kind === 'ember') return false;
  const [sx, sy] = camp.stashTile;
  const p = legPath(a, sx, sy, 1); if (!p) return false;
  const c = a.carrying;
  a.task = { type: 'deliver', label: `Carrying ${c.count} ${c.count > 1 ? ITEMS[c.kind].plural : ITEMS[c.kind].name} to camp`, path: p,
    arrive(a, t){
      if (nearAt(a, sx, sy) > 1){ const q = legPath(a, sx, sy, 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
      if (c.kind === 'firestones'){ camp.tools.firestones = 1; a.carrying = null; log(`${a.name} lays two firestones by the pit. ${ITEMS.firestones.find} The camp can make its own fire now.`, campHumans(), 'major'); addThought(a, 'find', 'Brought firestones up from the dark', 10, 2500); return 'done'; }
      if (c.kind === 'bones'){ a.carrying = null; log(`${a.name} brings old bones up from the dark, and nobody is sure whose they were. ${ITEMS.bones.find}`, campHumans(), 'major'); addThought(a, 'find', 'Found old bones in the dark', -3, 2500); for (const h of campHumans()) if (h !== a) addThought(h, 'bones', 'There were bones under the hill', -2, 1200); return 'done'; }
      stashAdd(c.kind, c.count); a.carrying = null; gainXp(a, 'gather'); return 'done';
    } };
  return true;
}
function startGather(a, kind){
  if (!camp.stashTile) return false;
  if (a.carrying && a.carrying.kind !== kind) return startDeliver(a);
  let found = null;
  const p = bfs(a.x, a.y, a.z, (x, y, z) => { const it = itemAt(x, y, z); if (z >= 0 && it && it.kind === kind && !it.reservedBy){ found = it; return true; } return false; }, 2500, a);
  if (!p){
    if (a.carrying) return startDeliver(a);
    const s = nearestSectorWith(a, looseCount(kind)); if (!s) return false;
    const [cx, cy] = secCenter(s); const q = legPath(a, cx, cy, 6); if (!q) return false;
    log(`${a.name} heads to the ${s.name.toLowerCase()} to look for ${ITEMS[kind].plural}.`, [a]);
    a.task = { type: 'travel', label: `Walking to the ${s.name.toLowerCase()} for ${ITEMS[kind].plural}`, path: q,
      arrive(a, t){ if (nearAt(a, cx, cy) > 6){ const r = legPath(a, cx, cy, 6); if (!r) return 'fail'; t.path = r; return 'continue'; } return 'done'; } };
    return true;
  }
  const it = found; it.reservedBy = a.id;
  a.task = { type: 'gather', label: `Looking for ${ITEMS[kind].plural}`, path: p,
    arrive(a, t){
      if (!items.includes(it) || it.x !== a.x || it.y !== a.y || it.z !== a.z) return 'fail';
      removeItem(it);
      if (a.carrying) a.carrying.count++; else a.carrying = { kind, count: 1 };
      t.label = `Gathering ${ITEMS[kind].plural} (${a.carrying.count})`;
      if (a.carrying.count < Math.min(9, 3 + Math.floor(a.skills.gather / 2) + (camp.tools.basket ? 3 : 0))){
        let nxt = null;
        const q = bfs(a.x, a.y, a.z, (x, y, z) => { const j = itemAt(x, y, z); if (z >= 0 && j && j.kind === kind && !j.reservedBy && dist(x, y, a.x, a.y) <= 8){ nxt = j; return true; } return false; }, 300, a);
        if (q && nxt) return chain(a, t, startGather(a, kind)) || chain(a, t, startDeliver(a)) || 'done';
      }
      return chain(a, t, startDeliver(a)) || 'done';
    },
    cleanup(){ if (it.reservedBy === a.id) it.reservedBy = null; } };
  return true;
}
function startPickBerries(a){
  if (a.carrying && a.carrying.kind !== 'berries') return startDeliver(a);
  const hasFood = t => t.feature === 'bush' && t.berries > 0;
  const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, hasFood, NEAR, z), 2500, a);
  if (!p){ if (a.carrying) return startDeliver(a); const s = nearestSectorWith(a, s => sectorCount(s, 'berries', hasFood)); if (!s) return false; const [cx, cy] = secCenter(s); const q = legPath(a, cx, cy, 6); if (!q) return false;
    a.task = { type: 'travel', label: `Walking to the ${s.name.toLowerCase()} for berries`, path: q, arrive(a, t){ if (nearAt(a, cx, cy) > 6){ const r = legPath(a, cx, cy, 6); if (!r) return 'fail'; t.path = r; return 'continue'; } return 'done'; } };
    return true; }
  a.task = { type: 'gather', label: 'Going to pick berries', path: p, progress: 0,
    arrive(a, t){
      const b = nearFind(a.x, a.y, hasFood, NEAR, a.z);
      if (!b){ return a.carrying ? (chain(a, t, startDeliver(a)) || 'done') : 'fail'; }
      t.label = 'Picking berries';
      if (++t.progress % 6 === 0){ b.berries--; if (a.carrying) a.carrying.count++; else a.carrying = { kind: 'berries', count: 1 }; }
      if (a.carrying && a.carrying.count >= 3) return chain(a, t, startDeliver(a)) || 'done';
      return 'continue';
    } };
  return true;
}
/* Fibre comes from reeds. Reeds are not used up. */
function startPickFibre(a){
  if (a.carrying && a.carrying.kind !== 'fibre') return startDeliver(a);
  const hasReeds = t => t.feature === 'reeds';
  const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, hasReeds, NEAR, z), 2500, a);
  if (!p){ if (a.carrying) return startDeliver(a); return false; }
  a.task = { type: 'gather', label: 'Going to the reeds for fibre', path: p, progress: 0,
    arrive(a, t){
      if (!nearFind(a.x, a.y, hasReeds, NEAR, a.z)) return a.carrying ? (chain(a, t, startDeliver(a)) || 'done') : 'fail';
      t.label = 'Pulling fibre from the reeds';
      if (++t.progress % 8 === 0){ if (a.carrying) a.carrying.count++; else a.carrying = { kind: 'fibre', count: 1 }; }
      if (a.carrying && a.carrying.count >= 3){ gainXp(a, 'gather'); return chain(a, t, startDeliver(a)) || 'done'; }
      return 'continue';
    } };
  return true;
}
/* Fishing: stand by the water, cast for a while, and land a fish by hunting skill and patience. */
function startFish(a){
  if (a.carrying && a.carrying.kind !== 'fish') return startDeliver(a);
  const water = t => t.ground === 'water';
  const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, water, DIRS, z), 3000, a); if (!p) return false;
  a.task = { type: 'work', label: 'Going to the water with the rod', path: p, progress: 0,
    arrive(a, t){
      if (!nearFind(a.x, a.y, water, DIRS, a.z)) return 'fail';
      t.label = 'Casting from the bank'; t.progress += workSpeed(a, 'hunt');
      if (t.progress < 110) return 'continue';
      if (rng() < Math.min(0.75, 0.22 + a.skills.hunt * 0.06 + a.traits.patience * 0.18)){
        a.carrying = { kind: 'fish', count: 1 }; gainXp(a, 'hunt'); camp.fished++;
        if (camp.fished === 1) log(`${a.name} lands a fish.`, [a], 'good');
        else if (camp.fished === 10 || camp.fished === 50 || camp.fished % 100 === 0) log(`${a.name} lands the camp's ${camp.fished}th fish.`, [a], 'good');
        addThought(a, 'fish', 'Caught a fish', 3, 500); return chain(a, t, startDeliver(a)) || 'done'; }
      addThought(a, 'nofish', 'Nothing bit', -1, 300); return 'done';
    } };
  return true;
}
/* Clay comes from the riverbank: any tile whose ground flags clay (sand). The bank is not used up. */
function startDigClay(a){
  if (a.carrying && a.carrying.kind !== 'clay') return startDeliver(a);
  const bank = t => !!GROUND[t.ground].clay;
  const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, bank, NEAR, z), 3000, a);
  if (!p){ if (a.carrying) return startDeliver(a); return false; }
  a.task = { type: 'gather', label: 'Going to the bank for clay', path: p, progress: 0,
    arrive(a, t){
      if (!nearFind(a.x, a.y, bank, NEAR, a.z)) return a.carrying ? (chain(a, t, startDeliver(a)) || 'done') : 'fail';
      t.label = 'Digging clay from the bank';
      if (++t.progress % 10 === 0){ if (a.carrying) a.carrying.count++; else a.carrying = { kind: 'clay', count: 1 }; }
      if (a.carrying && a.carrying.count >= 2){ gainXp(a, 'gather'); return chain(a, t, startDeliver(a)) || 'done'; }
      return 'continue';
    } };
  return true;
}
/* Cuttings come from wild bushes. The bush keeps growing. */
function startTakeCuttings(a){
  if (a.carrying && a.carrying.kind !== 'cuttings') return startDeliver(a);
  const wild = t => t.feature === 'bush' && !t.garden;
  const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, wild, NEAR, z), 2500, a);
  if (!p){ if (a.carrying) return startDeliver(a); return false; }
  a.task = { type: 'gather', label: 'Going to a bush for cuttings', path: p, progress: 0,
    arrive(a, t){
      if (!nearFind(a.x, a.y, wild, NEAR, a.z)) return a.carrying ? (chain(a, t, startDeliver(a)) || 'done') : 'fail';
      t.label = 'Taking cuttings';
      if (++t.progress % 6 === 0){ if (a.carrying) a.carrying.count++; else a.carrying = { kind: 'cuttings', count: 1 }; }
      if (a.carrying && a.carrying.count >= 2){ gainXp(a, 'gather'); return chain(a, t, startDeliver(a)) || 'done'; }
      return 'continue';
    } };
  return true;
}
/* A garden goes on open soil or grass within eight of the pit, with room for four bushes around it. */
function gardenSpot(){
  if (!camp.pit) return null; const [px, py] = camp.pit; let best = null;
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++){
    const x = px + dx, y = py + dy, d = Math.abs(dx) + Math.abs(dy); if (d < 3 || d > 7 || !inb(x, y)) continue;
    const t = tileAt(x, y); if (!passable(x, y) || t.feature || t.struct) continue;
    const room = DIRS.filter(([ex, ey]) => { const q = hasTile(x + ex, y + ey, 0) ? tileAt(x + ex, y + ey) : null; return q && passable(q.x, q.y) && !q.feature && !q.struct && !camps.some(c => c.stashTile && c.stashTile[0] === q.x && c.stashTile[1] === q.y); }).length;
    if (room < 4) continue;
    const sc = -d + (t.ground === 'soil' ? 2 : 0) + rng(); if (!best || sc > best.sc) best = { x, y, sc };
  }
  return best ? [best.x, best.y] : null;
}
function startSetSnare(a){
  const c = camp.site; let best = null;
  const s = secOf(c[0], c[1]);
  for (let y = s.sy * LH + 1; y < (s.sy + 1) * LH - 1; y++) for (let x = s.sx * LW + 1; x < (s.sx + 1) * LW - 1; x++){
    const t = tileAt(x, y); if (!passable(x, y) || t.feature || t.struct) continue;
    const d = dist(x, y, c[0], c[1]); if (d < 6 || d > 18) continue;
    let bushes = 0; for (const [dx, dy] of RING) if (inb(x + dx, y + dy) && tileAt(x + dx, y + dy).feature === 'bush') bushes++;
    if (t.ground !== 'grass' || !bushes) continue;
    if (camp.snares.some(sn => dist(sn.x, sn.y, x, y) < 4)) continue;
    const rabbits = beings.filter(b => b.alive && b.species === 'rabbit' && nearAt(b, x, y) <= 12).length;
    const sc = bushes * 4 + rabbits * 6 - d * 0.2 + rng() * 2; if (!best || sc > best.sc) best = { x, y, sc };
  }
  if (!best) return false;
  return startBuild(a, [best.x, best.y], 30, 'Setting a snare', a => {
    if (camp.stash.stick < 3 || tileAt(best.x, best.y).struct) return;
    camp.stash.stick -= 3; const sn = { x: best.x, y: best.y, armed: true, catch: null, camp, chance: Math.min(0.95, 0.5 + a.skills.trap * 0.08 + a.traits.patience * 0.25) }; camp.snares.push(sn); tileAt(best.x, best.y).struct = { type: 'snare', snare: sn };
    gainXp(a, 'trap'); log(`${a.name} sets a snare in the grass near some bushes.`, [a]);
  });
}
function startCheckSnare(a, s){
  return startBuild(a, [s.x, s.y], 4, 'Checking the snare', a => { if (s.catch){ s.catch = null; a.carrying = { kind: 'carcass', count: 1 }; } });
}
/* Deer live in their meadows and feed at the bushes there, often well past the camp's own sector,
   so a pit close to camp seldom sees one. This scans everywhere passable within thirty tiles of
   the site for grass beside a bush, away from snares and other pits, with a deer standing there
   right now: a pit is sited only when deer are about, never merely hoped for. */
function pitfallSite(){
  const c = camp.site; let best = null;
  for (let dy = -30; dy <= 30; dy++) for (let dx = -30; dx <= 30; dx++){
    const d = Math.abs(dx) + Math.abs(dy); if (d > 30) continue;
    const x = c[0] + dx, y = c[1] + dy; if (!inb(x, y)) continue;
    const t = tileAt(x, y); if (!passable(x, y) || t.feature || t.struct || t.ground !== 'grass') continue;
    let bushes = 0; for (const [rx, ry] of RING) if (inb(x + rx, y + ry) && tileAt(x + rx, y + ry).feature === 'bush') bushes++;
    if (!bushes) continue;
    if (camp.snares.some(sn => dist(sn.x, sn.y, x, y) < 4) || camp.pitfalls.some(p => dist(p.x, p.y, x, y) < 8)) continue;
    const traffic = RING.concat([[0, 0]]).reduce((n, [dx, dy]) => n + ((hasTile(x + dx, y + dy, 0) ? tileAt(x + dx, y + dy).deer : 0) || 0), 0);
    if (traffic < 4) continue;
    const sc = traffic * 2 + bushes * 3 - d * 0.1 + rng() * 2; if (!best || sc > best.sc) best = { x, y, sc };
  }
  return best ? [best.x, best.y] : null;
}
/* Haul a caught deer home from the pit. */
function startHaulPit(a, p){
  /* The pit stands away from camp, but startBuild has no way to chain into a walk home, so the
     catch goes straight to the stash here, the same as any other kill finished at the fire. */
  return startBuild(a, [p.x, p.y], 12, 'Hauling the deer out of the pit', a => { if (!p.catch) return; p.catch = null; stashAdd('venison', 1); log(`${a.name} hauls the deer out of the pit.`, [a], 'good'); });
}

/* Quarry rocks from a rock face: a walkable tile beside ground that can be quarried, within thirty tiles of the site. */
function startQuarry(a){
  if (a.carrying && a.carrying.kind !== 'rock') return startDeliver(a);
  const [sx, sy] = camp.site; let face = null;
  const p = bfs(a.x, a.y, a.z, (x, y, z) => { if (dist(x, y, sx, sy) > 30) return false; for (const [dx, dy] of DIRS){ const q = hasTile(x + dx, y + dy, z) ? tileAt(x + dx, y + dy, z) : null; if (q && GROUND[q.ground].quarry){ face = q; return true; } } return false; }, 3500, a);
  if (!p) return false;
  a.task = { type: 'work', label: 'Walking to the rock face', path: p, progress: 0,
    arrive(a, t){
      if (!face || !GROUND[face.ground].quarry) return 'fail';
      t.label = 'Quarrying rocks'; t.progress += workSpeed(a, 'build');
      if (t.progress < 25) return 'continue';
      a.carrying = { kind: 'rock', count: 2 }; gainXp(a, 'build');
      face.quarried = true;
      /* The first quarry to strike a hollowed hill pays favour, once per hill, however often it is opened before or after. */
      if (face.hill && !face.hill.hollowPaid){ const hollow = caves.find(c => c.kind === 'hollow' && c.hill === face.hill);
        if (hollow){ face.hill.hollowPaid = true; camp.fae.favor = Math.max(-100, camp.fae.favor - 10); addThought(a, 'quarryfae', 'Broke stone from the sprites\' hill. The rock rang wrong', -4, 900); log(`${a.name} opens a rock face on the sprites' hill. The grove will not like it.`, campHumans(), 'bad'); } }
      log(`${a.name} quarries two rocks from the face.`, [a]);
      return chain(a, t, startDeliver(a)) || 'done';
    } };
  return true;
}

function deerNear(){ if (!camp.site) return null; return beings.filter(b => b.alive && b.species === 'deer' && nearAt(b, ...camp.site) <= 34).sort((p, q) => nearAt(p, ...camp.site) - nearAt(q, ...camp.site))[0] || null; }
function startHuntDeer(a, d){
  a.carrying = { kind: 'spear', count: 1 };
  a.task = { type: 'hunt', label: 'Stalking a deer with the spear', path: [], fast: false, progress: 0,
    arrive(a, t){
      if (!d.alive || ++t.progress > 220 + a.skills.hunt * 40){ a.carrying = null; addThought(a, 'missed', 'The deer got away', -3, 500); a.xp.hunt = (a.xp.hunt || 0) + 1; return 'fail'; }
      if (near(a, d) <= 2){
        if (rng() < 0.3 + a.skills.hunt * 0.12){ d.hp = 0; die(d, 'was speared'); a.carrying = null; gainXp(a, 'hunt'); addThought(a, 'kill', 'Brought down a deer', 12, 1500); drift(a, 'bravery', 0.02); log(`${a.name} brings down a deer with the spear.`, campHumans(), 'major');
          const it = items.find(i => i.kind === 'venison' && i.x === d.x && i.y === d.y); if (it){ removeItem(it); a.carrying = { kind: 'venison', count: 1 }; return chain(a, t, startDeliver(a)) || 'done'; } return 'done'; }
        d.skills.wary = Math.min(3, (d.skills.wary || 0) + 1); addThought(d, 'escaped', 'A hunter missed', -6, 900); failTask(d); START.flee(d); t.progress += 40;
      }
      const p = bfs(a.x, a.y, a.z, (x, y, z) => z === d.z && dist(x, y, d.x, d.y) <= 2, 700, a); if (!p) return 'fail'; t.path = p.slice(0, 4); t.fast = near(a, d) <= 8; return 'continue';
    },
    cleanup(){ if (a.carrying && a.carrying.kind === 'spear') a.carrying = null; } };
  return true;
}
/* An owner just driven from a den they held flees into it and sits within guard range while its raid
   cooldown runs. Chasing it with fire again is a livelock: skip it until the cooldown lifts. */
function wolfNear(){ if (!camp.pit) return null; return beings.filter(b => b.alive && b.species === 'wolf' && nearAt(b, ...camp.pit) <= 11 && !(b.oldDen && b.oldDen.cleared === camp && (b.cooldown.raid || 0) > tick)).sort((p, q) => nearAt(p, ...camp.pit) - nearAt(q, ...camp.pit))[0] || null; }
function startDriveOff(a, w){
  const [px, py] = camp.pit; const p = legPath(a, px, py, 1); if (!p) return false;
  a.task = { type: 'guard', label: 'Grabbing a firebrand', path: p, fast: true, progress: 0,
    arrive(a, t){
      if (!a.carrying){ if (nearAt(a, px, py) > 1) return 'fail'; a.carrying = { kind: 'ember', count: 1, dies: tick + 500 }; t.label = 'Running at the wolf with fire'; }
      if (!w.alive || nearAt(w, ...camp.pit) > 22 || ++t.progress > 200){ a.carrying = null; if (w.alive && nearAt(w, ...camp.pit) > 22){ if (tick - camp.guardLogged > 800){ camp.guardLogged = tick; log(`${a.name} chases the wolf off into the dark with a burning branch.`, campHumans(), 'good'); } addThought(a, 'brave', 'Drove off a wolf', 8, 1200); drift(a, 'bravery', 0.03); for (const h of campHumans()) if (h !== a) addThought(h, 'guarded', `${a.name} drove off a wolf`, 4, 800); } return 'done'; }
      if (near(a, w) <= 2){ addThought(w, 'burned', 'A human came at me with fire', -20, 1500); w.cooldown.raid = tick + 2500; w.cooldown.wander = tick + 600; w.shyOf = camp; failTask(w); START.flee(w); }
      const q = bfs(a.x, a.y, a.z, (x, y, z) => z === w.z && dist(x, y, w.x, w.y) <= 2, 500, a); if (!q) return 'continue'; t.path = q.slice(0, 3); return 'continue';
    },
    cleanup(){ if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };
  return true;
}

/* Take a brand from the pit, then go. Shared by the cave search and the den clearing. */
function withBrand(a, label, then){
  const [px, py] = camp.pit; const p = legPath(a, px, py, 1); if (!p) return false;
  a.task = { type: 'work', label: `Going to the fire for a brand`, path: p, fast: false,
    arrive(a, t){ if (nearAt(a, px, py) > 1) return 'fail'; if (!pitLit()) return 'fail'; a.carrying = { kind: 'ember', count: 1, dies: tick + EMBER_LIFE }; t.label = label; const r = chain(a, t, then(a)); if (r) return r; a.carrying = null; return 'fail'; },
    cleanup(){ if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };
  return true;
}
/* Walk to the deep chamber with the brand, pick up the find, and come home. The ember's life is the clock.
   The cave is claimed the moment the search task starts, so a second person gets no offer on it while
   the first is still in the dark; the claim (and the search) clears if the searcher is interrupted or
   dies. It counts as searched only once the find (or empty hands) reaches the stash. */
function startSearchCave(a, c){
  return withBrand(a, 'Going into the dark', a => {
    const d = c.deep; const p = legPath(a, d.x, d.y, 0, d.z); if (!p) return false;
    log(`${a.name} goes into the dark under the hill with a brand.`, campHumans(), 'major');
    c.claimed = a.id;
    a.task = { type: 'search', label: 'Searching the cave by brandlight', path: p, cave: c,
      arrive(a, t){
        if (nearAt(a, d.x, d.y, d.z) > 0){ const q = legPath(a, d.x, d.y, 0, d.z); if (!q) return 'fail'; t.path = q; return 'continue'; }
        const it = itemAt(d.x, d.y, d.z); a.carrying = null;
        if (it){ removeItem(it); a.carrying = { kind: it.kind, count: 1 }; }
        addThought(a, 'searched', 'Went into the dark and came back', 8, 2000); drift(a, 'bravery', 0.03);
        const [sx, sy] = camp.stashTile; const q = legPath(a, sx, sy, 1); if (!q) return 'fail';
        t.path = q; t.label = it ? `Carrying the ${ITEMS[it.kind].name} up out of the dark` : 'Coming up out of the dark, empty-handed';
        t.arrive = (a, t) => { if (nearAt(a, sx, sy) > 1){ const q = legPath(a, sx, sy, 1); if (!q) return 'fail'; t.path = q; return 'continue'; } c.searched = camp; return chain(a, t, startDeliver(a)) || 'done'; };
        return 'continue';
      },
      cleanup(){ if (c.claimed === a.id) c.claimed = null; if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };
    return true;
  });
}
/* Break the fallen rock with the axe. */
function startClearRock(a, c){
  const b = c.blocked; if (!b) return false;
  return withBrand(a, 'Going down to the fallen rock', a => {
    /* Either side of the rock may be a real floor tile, but only the near side is reachable
       while the rock still blocks the passage. Try each candidate and keep the one with a path. */
    const spots = DIRS.map(([dx, dy]) => hasTile(b.x + dx, b.y + dy, b.z) ? tileAt(b.x + dx, b.y + dy, b.z) : null).filter(t => t && passable(t.x, t.y, t.z));
    let spot = null, p = null;
    for (const s of spots){ const q = legPath(a, s.x, s.y, 0, s.z); if (q){ spot = s; p = q; break; } }
    if (!spot) return false;
    a.task = { type: 'work', label: 'Going down to the fallen rock', path: p, progress: 0,
      arrive(a, t){ if (nearAt(a, spot.x, spot.y, spot.z) > 0){ const q = legPath(a, spot.x, spot.y, 0, spot.z); if (!q) return 'fail'; t.path = q; return 'continue'; }
        t.label = `Breaking the fallen rock (${Math.min(99, Math.floor(t.progress / 60 * 100))}%)`; t.progress += workSpeed(a, 'build'); if (t.progress < 60) return 'continue';
        b.ground = 'stone'; c.blocked = null; c.story.push(`${a.name} cleared the rock.`); gainXp(a, 'build'); addItem('rock', spot.x, spot.y, spot.z);
        log(`${a.name} breaks through the fallen rock. The passage runs on into the dark.`, campHumans(), 'good'); a.carrying = null;
        const [sx, sy] = camp.stashTile; const q = legPath(a, sx, sy, 1); if (!q) return 'done'; t.path = q; t.label = 'Coming up out of the dark'; t.arrive = () => 'done'; return 'continue'; },
      cleanup(){ if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };
    return true;
  });
}
/* A den party member: brave, grown, has a home to go back to, and healthy. Used both to size up
   whether a camp has a party (the dens goal's state) and to pick the mate (startClearDen). */
const denReady = h => h.traits.bravery >= 0.5 && stage(h) !== 'young' && !h.homeless && h.hp >= 60;
/* Two brave people with brands and the spear drive the owners out of a den. The leader carries the spear; a mate
   follows with a brand. Both keep their brands lit until they are home at the stash: the den mouth is often a
   level down, and letting go of the ember there leaves the party in the dark. An owner that cannot flee (no
   threat to flee from, deep in its own den) is sent off on foot instead, so it does not stand there to be
   found again the next tick. */
function startClearDen(a, c){
  const mate = campHumans().find(h => h !== a && denReady(h)); if (!mate) return false;
  return withBrand(a, 'Going to the den with fire and the spear', a => {
    const m = c.mouth; const p = legPath(a, m.x, m.y, 0, m.z); if (!p) return false;
    failTask(mate);
    const mp = legPath(mate, m.x, m.y, 1, m.z); if (!mp) return false;
    mate.carrying = { kind: 'ember', count: 1, dies: tick + EMBER_LIFE };
    mate.task = { type: 'guard', label: 'Following with a brand', path: mp, arrive: () => 'continue', cleanup(){ if (mate.carrying && mate.carrying.kind === 'ember') mate.carrying = null; } };
    a.task = { type: 'guard', label: 'Going to the den with fire and the spear', path: p, fast: true,
      arrive(a, t){
        if (nearAt(a, m.x, m.y, m.z) > 0){ const q = legPath(a, m.x, m.y, 0, m.z); if (!q) return 'fail'; t.path = q; return 'continue'; }
        const owners = beings.filter(b => b.alive && b.den === c);
        for (const w of owners){
          w.den = null; w.oldDen = c; w.cooldown.raid = tick + 3000; w.shyOf = camp; failTask(w);
          addThought(w, 'driven', 'Driven from the den by fire', -20, 3000);
          if (!START.flee(w)){
            const away = (x, y, z) => z === 0 && passable(x, y, 0) && dist(x, y, c.exit.x, c.exit.y) >= 20 && !tileAt(x, y, 0).cave && !tileAt(x, y, 0).mouth;
            const sp = bfs(w.x, w.y, w.z, away, 2000, w);
            if (sp) w.task = { type: 'wander', label: 'Slinking off', path: sp, arrive: () => 'done' };
          }
        }
        c.cleared = camp; c.clearedAt = tick; c.story.push(`${camp.name} drove the ${c.owner === 'wolf' ? 'wolves' : 'foxes'} out with fire.`);
        log(`${a.name} and ${mate.name} drive the ${c.owner === 'wolf' ? 'wolves' : 'foxes'} from the den with fire and the spear.`, campHumans(), 'major');
        addThought(a, 'cleared', 'Drove the beasts out of their den', 10, 2500); addThought(mate, 'cleared', 'Stood with a brand at the den', 8, 2500); drift(a, 'bravery', 0.04); drift(mate, 'bravery', 0.02);
        const [sx, sy] = camp.stashTile;
        const mq = legPath(mate, sx, sy, 1);
        if (mq) mate.task = { type: 'travel', label: 'Coming back from the den', path: mq,
          arrive(a, t){ if (nearAt(a, sx, sy) > 1){ const r = legPath(a, sx, sy, 1); if (!r) return 'fail'; t.path = r; return 'continue'; } if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; return 'done'; },
          cleanup(){ if (mate.carrying && mate.carrying.kind === 'ember') mate.carrying = null; } };
        else { if (mate.carrying && mate.carrying.kind === 'ember') mate.carrying = null; mate.task = null; }
        const q = legPath(a, sx, sy, 1); if (!q) return 'fail';
        t.path = q; t.label = 'Coming back from the den';
        t.arrive = (a, t) => { if (nearAt(a, sx, sy) > 1){ const r = legPath(a, sx, sy, 1); if (!r) return 'fail'; t.path = r; return 'continue'; } if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; return 'done'; };
        return 'continue';
      },
      cleanup(){ if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };
    return true;
  });
}

function startCutTree(a){
  const [cx, cy] = camp.site; let tree = null;
  const shy = camp.fae.known && camp.fae.favor < 30 ? new Set(groves.map(g => g.sector)) : null;
  const p = bfs(a.x, a.y, a.z, (x, y, z) => { for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (hasTile(nx, ny, z)){ const t = tileAt(nx, ny, z); if (t.feature === 'tree' && t.fire <= 0 && dist(nx, ny, cx, cy) >= 4 && !t.claimed && !(shy && shy.has(sectorOfTile(t)))){ tree = t; return true; } } } return false; }, 2500, a);
  if (!p) return false;
  tree.claimed = a.id;
  a.task = { type: 'work', label: 'Walking to a tree with the axe', path: p, progress: 0,
    arrive(a, t){
      if (tree.feature !== 'tree') return 'fail';
      t.progress += 1 + a.skills.woodcut * 0.3; t.label = `Chopping a pine (${Math.min(99, Math.floor(t.progress / 60 * 100))}%)`;
      if (t.progress < 60) return 'continue';
      tree.feature = null; tree.claimed = null; addItem('log', tree.x, tree.y); addItem('log', tree.x, tree.y); addItem('stick', tree.x, tree.y);
      gainXp(a, 'woodcut'); log(`${a.name} fells a pine. Logs at last.`, [a]);
      const g = groves.find(g => g.sector === sectorOfTile(tree)); if (g){ g.anger = Math.min(100, g.anger + 15); camp.fae.favor = Math.max(-100, camp.fae.favor - 15); camp.fae.grudges[a.id] = (camp.fae.grudges[a.id] || 0) + 25; if (camp.fae.known) addThought(a, 'grovecut', 'Cut a pine where the sprites live. It felt watched', -3, 800); for (const o of beings) if (o.alive && o.species === 'sprite' && o.grove === g) addThought(o, 'axe', `${a.name} cut a tree in our grove`, -12, 3000); }
      return chain(a, t, startGather(a, 'log')) || 'done';
    },
    cleanup(){ if (tree.claimed === a.id) tree.claimed = null; } };
  return true;
}
function startFillWater(a){
  if (a.carrying && a.carrying.kind !== 'water') return startDeliver(a);
  const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, t => t.ground === 'water', NEAR, z), 3000, a); if (!p) return false;
  a.task = { type: 'gather', label: 'Going to fill the waterskin', path: p, progress: 0,
    arrive(a, t){ t.label = 'Filling the waterskin'; if (++t.progress < 12) return 'continue'; a.carrying = { kind: 'water', count: 3 }; a.needs.water = 100; return chain(a, t, startDeliver(a)) || 'done'; } };
  return true;
}
