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
function startBuild(a, at, work, label, done){
  const p = legPath(a, at[0], at[1], 1); if (!p) return false;
  a.task = { type: 'work', label: `Walking to ${label.toLowerCase().replace(/^\w+ing /, '')}`, path: p, progress: 0, target: at, within: 1,
    arrive(a, t){
      if (nearAt(a, at[0], at[1]) > 1){ const q = legPath(a, at[0], at[1], 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
      t.progress += workSpeed(a, /cook|smok|butcher/i.test(label) ? 'cook' : /knap|sew|spear/i.test(label) ? 'craft' : /snare/i.test(label) ? 'trap' : 'build'); t.label = `${label} (${Math.min(99, Math.floor(t.progress / work * 100))}%)`;
      if (t.progress < work) return 'continue';
      done(a); return 'done';
    } };
  return true;
}
function startDeliver(a){
  if (!camp.stashTile || !a.carrying) return false;
  const [sx, sy] = camp.stashTile;
  const p = legPath(a, sx, sy, 1); if (!p) return false;
  const c = a.carrying;
  a.task = { type: 'deliver', label: `Carrying ${c.count} ${c.count > 1 ? ITEMS[c.kind].plural : ITEMS[c.kind].name} to camp`, path: p,
    arrive(a, t){
      if (nearAt(a, sx, sy) > 1){ const q = legPath(a, sx, sy, 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
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
      if (a.carrying.count < Math.min(6, 3 + Math.floor(a.skills.gather / 2))){
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
function wolfNear(){ if (!camp.pit) return null; return beings.filter(b => b.alive && b.species === 'wolf' && nearAt(b, ...camp.pit) <= 11).sort((p, q) => nearAt(p, ...camp.pit) - nearAt(q, ...camp.pit))[0] || null; }
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
