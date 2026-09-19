/* ---------- tasks as data: the table and the tick executor ---------- */
/* A task is a plain record: { kind, type, args, stop, path, label, ... }. It holds numbers and strings,
   never a function, and never a reference to a being, a tile, or an item. TASKS[kind] holds what the
   task does:
     type            the category that rules read (a.task.type). begin may return another.
     begin(a, args)  the checks and the search that start the task. It returns the record's other
                     fields, or false when the task cannot start, or true when it handed over to
                     another kind.
     stops           functions (a, t). The executor calls stops[t.stop] on each stride once the path
                     is walked. Each returns 'continue', 'done', or 'fail'.
     release(a, t)   what the task lets go of when it ends or fails.
     work, effect    declared by workKind for a job done at one place. */
const TASKS = {};

function setTask(a, kind, args, fields){
  a.task = { kind, type: TASKS[kind].type, args, stop: 0, path: [], ...fields };
  return true;
}
function startTask(a, kind, args = {}){
  const K = TASKS[kind]; if (!K) throw new Error(`No task kind '${kind}'.`);
  const own = { ...args }, f = K.begin(a, own); if (!f) return false;
  return f === true ? true : setTask(a, kind, own, f);
}
/* Run the current stop once. */
function taskStop(a){ const t = a.task; return t.arrive ? t.arrive(a, t) : TASKS[t.kind].stops[t.stop](a, t); }
/* Walk on toward a stop. Null when the being is within reach. Otherwise the stride's result:
   'continue' with a new path, or 'fail' when there is no way. */
function goTo(a, t, x, y, within, z = 0){
  if (nearAt(a, x, y, z) <= within) return null;
  const q = pathToStop(a, x, y, within, z); if (!q) return 'fail';
  t.path = q; return 'continue';
}
function letGo(a, t){ if (t.cleanup) t.cleanup(t); else if (t.kind && TASKS[t.kind].release) TASKS[t.kind].release(a, t); }
function endTask(a){ const t = a.task; if (!t) return; letGo(a, t); a.task = null; }
function failTask(a){ const t = a.task; if (!t) return; letGo(a, t); dropCarried(a); a.task = null; }
/* A walk with nothing to do at its end. The caller sets the type, the label, and the path. */
TASKS.walk = { type: 'travel', begin: () => false, stops: [() => 'done'] };
/* A walk to a place, taken up again if the being is pushed off it. args: at [x, y, z], within. */
TASKS.walkTo = { type: 'travel', begin: () => false,
  stops: [(a, t) => goTo(a, t, t.args.at[0], t.args.at[1], t.args.within, t.args.at[2] || 0) || 'done'] };
function runTask(a){
  const t = a.task; a.status = t.label;
  if (t.wait > 0){ t.wait--; return; }
  if (t.path.length){
    if (a.inDark){ a.darkStep = !a.darkStep; if (a.darkStep) return; }
    const [nx, ny, nz] = t.path[0];
    if (!passable(nx, ny, nz)){ a.cooldown[t.key] = tick + CLOCK.cooldown.pathBlocked; failTask(a); return; }
    a.x = nx; a.y = ny; a.z = nz; t.path.shift();
    if (a.species === 'rabbit') checkSnare(a); else if (a.species === 'deer'){ const dt = tileAt(a.x, a.y, a.z); if (dt) dt.deer = (dt.deer || 0) + 1; checkPitfall(a); }
    return;
  }
  const r = taskStop(a);
  if (r === 'done') endTask(a);
  else if (r === 'fail'){ a.cooldown[t.key] = tick + CLOCK.cooldown.taskFailed; failTask(a); }
  if (a.task) a.status = a.task.label;
}

/* ---------- human work tasks ---------- */
TASKS.fetchEmber = { type: 'ember',
  begin(a, args){
    const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, t => t.fire > 0, DIRS, z), 3500, a); if (!p) return false;
    return { label: 'Running to the blaze for an ember', path: p, fast: true };
  },
  stops: [(a, t) => {
    if (!a.carrying){
      if (!nearFind(a.x, a.y, q => q.fire > 0, DIRS, a.z)) return 'fail';
      a.carrying = { kind: 'ember', count: 1, dies: tick + CLOCK.limit.ember }; addThought(a, 'ember', 'Snatched fire from a wildfire', 4, CLOCK.thought.ember);
      log(`${a.name} grabs a burning branch from the blaze and runs for the camp.`, [a], 'good');
      const [px, py] = camp.pit; const q = pathToStop(a, px, py, 1); if (!q) return 'fail'; t.path = q; t.label = 'Carrying the ember to the pit'; return 'continue';
    }
    const [px, py] = camp.pit;
    if (nearAt(a, px, py) > 1){ const q = pathToStop(a, px, py, 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
    const pit = pitTile().struct; a.carrying = null;
    if (pit.fuel <= 0) return 'fail';
    if (pit.lit){ log(`${a.name} adds the ember to a fire someone else already lit.`, [a]); return 'done'; }
    pit.lit = true; camp.everLit = true; camp.nextArrival = camp.nextArrival || tick + CLOCK.arrival.firstByHand;
    log(`${a.name} sets the ember in the pit. The fire is back, and nobody waited for the sky.`, campHumans(), 'major');
    addThought(a, 'rekindled', 'Brought fire home', 10, CLOCK.thought.rekindled); for (const h of campHumans()) addThought(h, 'hearth', 'The fire is lit', 8, CLOCK.thought.hearth);
    return 'done';
  }] };

/* ---------- task builders (humans) ---------- */
/* Continue straight into a new task from inside an old one. */
function chain(a, old, ok){ if (!ok) return null; a.task.started = old.started; a.task.key = old.key; return 'continue'; }
/* The skill a job's label implies, when the job names none. */
const skillOfLabel = label => /cook|smok|butcher/i.test(label) ? 'cook' : /knap|sew|spear/i.test(label) ? 'craft' : /snare/i.test(label) ? 'trap' : 'build';
/* A job done at one place: walk to args.at, work until the progress reaches the amount, and then the
   effect lands. label, amount, and skill are values, or functions of args for a job whose record says
   them. The kind declares work and effect, so another executor can do the same job without the strides. */
function workKind({ label, amount, skill, effect, type = 'work' }){
  const of = (v, args) => typeof v === 'function' ? v(args) : v;
  return { type, work: { amount, skill }, effect,
    begin(a, args){
      const p = pathToStop(a, args.at[0], args.at[1], 1); if (!p) return false;
      return { label: `Walking to ${of(label, args).toLowerCase().replace(/^\w+ing /, '')}`, path: p, progress: 0, target: args.at, within: 1 };
    },
    stops: [(a, t) => {
      const at = t.args.at, r = goTo(a, t, at[0], at[1], 1); if (r) return r;
      const l = of(label, t.args), n = of(amount, t.args);
      t.progress += workSpeed(a, of(skill, t.args) || skillOfLabel(l)); t.label = `${l} (${Math.min(99, Math.floor(t.progress / n * 100))}%)`;
      if (t.progress < n) return 'continue';
      effect(a, t.args, t); return 'done';
    }] };
}
Object.assign(TASKS, {
  deliver: { type: 'deliver',
    begin(a, args){
      if (!camp.stashTile || !a.carrying) return false;
      if (a.carrying.kind === 'ember') return false;
      const [sx, sy] = camp.stashTile;
      const p = pathToStop(a, sx, sy, 1); if (!p) return false;
      const c = a.carrying;
      args.at = [sx, sy];
      return { label: `Carrying ${c.count} ${c.count > 1 ? ITEMS[c.kind].plural : ITEMS[c.kind].name} to camp`, path: p };
    },
    stops: [(a, t) => {
      const [sx, sy] = t.args.at;
      const g = goTo(a, t, sx, sy, 1); if (g) return g;
      const c = a.carrying;
      if (c.kind === 'firestones'){ camp.tools.firestones = 1; a.carrying = null; log(`${a.name} lays two firestones by the pit. ${ITEMS.firestones.find} The camp can make its own fire now.`, campHumans(), 'major'); addThought(a, 'find', 'Brought firestones up from the dark', 10, CLOCK.thought.find); return 'done'; }
      if (c.kind === 'bones'){ a.carrying = null; log(`${a.name} brings old bones up from the dark, and nobody is sure whose they were. ${ITEMS.bones.find}`, campHumans(), 'major'); addThought(a, 'find', 'Found old bones in the dark', -3, CLOCK.thought.find); for (const h of campHumans()) if (h !== a) addThought(h, 'bones', 'There were bones under the hill', -2, CLOCK.thought.bones); return 'done'; }
      stashAdd(c.kind, c.count); a.carrying = null; gainXp(a, 'gather'); return 'done';
    }] },
  gather: { type: 'gather',
    begin(a, args){
      if (!camp.stashTile) return false;
      const kind = args.item;
      if (a.carrying && a.carrying.kind !== kind) return startTask(a, 'deliver');
      let found = null;
      const p = bfs(a.x, a.y, a.z, (x, y, z) => { const it = itemAt(x, y, z); if (z >= 0 && it && it.kind === kind && !it.reservedBy){ found = it; return true; } return false; }, 2500, a);
      if (!p){
        if (a.carrying) return startTask(a, 'deliver');
        const s = nearestSectorWith(a, looseCount(kind)); if (!s) return false;
        const [cx, cy] = secCenter(s); const q = pathToStop(a, cx, cy, 6); if (!q) return false;
        log(`${a.name} heads to the ${s.name.toLowerCase()} to look for ${ITEMS[kind].plural}.`, [a]);
        setTask(a, 'walkTo', { at: [cx, cy, 0], within: 6 }, { label: `Walking to the ${s.name.toLowerCase()} for ${ITEMS[kind].plural}`, path: q });
        return true;
      }
      const it = found; it.reservedBy = a.id; args.id = it.id;
      return { label: `Looking for ${ITEMS[kind].plural}`, path: p };
    },
    stops: [(a, t) => {
      const kind = t.args.item;
      const it = items.find(i => i.id === t.args.id);
      if (!it || it.x !== a.x || it.y !== a.y || it.z !== a.z) return 'fail';
      removeItem(it);
      if (a.carrying) a.carrying.count++; else a.carrying = { kind, count: 1 };
      t.label = `Gathering ${ITEMS[kind].plural} (${a.carrying.count})`;
      if (a.carrying.count < Math.min(9, 3 + Math.floor(a.skills.gather / 2) + (camp.tools.basket ? 3 : 0))){
        let nxt = null;
        const q = bfs(a.x, a.y, a.z, (x, y, z) => { const j = itemAt(x, y, z); if (z >= 0 && j && j.kind === kind && !j.reservedBy && dist(x, y, a.x, a.y) <= 8){ nxt = j; return true; } return false; }, 300, a);
        if (q && nxt) return chain(a, t, startTask(a, 'gather', { item: kind })) || chain(a, t, startTask(a, 'deliver')) || 'done';
      }
      return chain(a, t, startTask(a, 'deliver')) || 'done';
    }],
    release(a, t){ const it = items.find(i => i.id === t.args.id); if (it && it.reservedBy === a.id) it.reservedBy = null; } },
  pickBerries: { type: 'gather',
    begin(a, args){
      if (a.carrying && a.carrying.kind !== 'berries') return startTask(a, 'deliver');
      const hasFood = tl => tl.feature === 'bush' && tl.berries > 0;
      const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, hasFood, NEAR, z), 2500, a);
      if (!p){
        if (a.carrying) return startTask(a, 'deliver');
        const s = nearestSectorWith(a, s => sectorCount(s, 'berries', hasFood)); if (!s) return false;
        const [cx, cy] = secCenter(s); const q = pathToStop(a, cx, cy, 6); if (!q) return false;
        setTask(a, 'walkTo', { at: [cx, cy, 0], within: 6 }, { label: `Walking to the ${s.name.toLowerCase()} for berries`, path: q });
        return true;
      }
      return { label: 'Going to pick berries', path: p, progress: 0 };
    },
    stops: [(a, t) => {
      const hasFood = tl => tl.feature === 'bush' && tl.berries > 0;
      const b = nearFind(a.x, a.y, hasFood, NEAR, a.z);
      if (!b) return a.carrying ? (chain(a, t, startTask(a, 'deliver')) || 'done') : 'fail';
      t.label = 'Picking berries';
      if (++t.progress % CLOCK.work.berryEvery === 0){ b.berries--; if (a.carrying) a.carrying.count++; else a.carrying = { kind: 'berries', count: 1 }; }
      if (a.carrying && a.carrying.count >= 3) return chain(a, t, startTask(a, 'deliver')) || 'done';
      return 'continue';
    }] },
  /* Fibre comes from reeds. Reeds are not used up. */
  pickFibre: { type: 'gather',
    begin(a, args){
      if (a.carrying && a.carrying.kind !== 'fibre') return startTask(a, 'deliver');
      const hasReeds = tl => tl.feature === 'reeds';
      const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, hasReeds, NEAR, z), 2500, a);
      if (!p) return a.carrying ? startTask(a, 'deliver') : false;
      return { label: 'Going to the reeds for fibre', path: p, progress: 0 };
    },
    stops: [(a, t) => {
      const hasReeds = tl => tl.feature === 'reeds';
      if (!nearFind(a.x, a.y, hasReeds, NEAR, a.z)) return a.carrying ? (chain(a, t, startTask(a, 'deliver')) || 'done') : 'fail';
      t.label = 'Pulling fibre from the reeds';
      if (++t.progress % CLOCK.work.fibreEvery === 0){ if (a.carrying) a.carrying.count++; else a.carrying = { kind: 'fibre', count: 1 }; }
      if (a.carrying && a.carrying.count >= 3){ gainXp(a, 'gather'); return chain(a, t, startTask(a, 'deliver')) || 'done'; }
      return 'continue';
    }] },
  /* Fishing: stand by the water, cast for a while, and land a fish by hunting skill and patience. */
  fish: { type: 'work',
    begin(a, args){
      if (a.carrying && a.carrying.kind !== 'fish') return startTask(a, 'deliver');
      const water = tl => tl.ground === 'water';
      const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, water, DIRS, z), 3000, a); if (!p) return false;
      return { label: 'Going to the water with the rod', path: p, progress: 0 };
    },
    stops: [(a, t) => {
      const water = tl => tl.ground === 'water';
      if (!nearFind(a.x, a.y, water, DIRS, a.z)) return 'fail';
      t.label = 'Casting from the bank'; t.progress += workSpeed(a, 'hunt');
      if (t.progress < CLOCK.work.fish) return 'continue';
      if (rng() < Math.min(0.75, 0.22 + a.skills.hunt * 0.06 + a.traits.patience * 0.18)){
        a.carrying = { kind: 'fish', count: 1 }; gainXp(a, 'hunt'); camp.fished++;
        if (camp.fished === 1) log(`${a.name} lands a fish.`, [a], 'good');
        else if (camp.fished === 10 || camp.fished === 50 || camp.fished % 100 === 0) log(`${a.name} lands the camp's ${camp.fished}th fish.`, [a], 'good');
        addThought(a, 'fish', 'Caught a fish', 3, CLOCK.thought.fish); return chain(a, t, startTask(a, 'deliver')) || 'done'; }
      addThought(a, 'nofish', 'Nothing bit', -1, CLOCK.thought.nofish); return 'done';
    }] },
  /* Clay comes from the riverbank: any tile whose ground flags clay (sand). The bank is not used up. */
  digClay: { type: 'gather',
    begin(a, args){
      if (a.carrying && a.carrying.kind !== 'clay') return startTask(a, 'deliver');
      const bank = tl => !!GROUND[tl.ground].clay;
      const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, bank, NEAR, z), 3000, a);
      if (!p) return a.carrying ? startTask(a, 'deliver') : false;
      return { label: 'Going to the bank for clay', path: p, progress: 0 };
    },
    stops: [(a, t) => {
      const bank = tl => !!GROUND[tl.ground].clay;
      if (!nearFind(a.x, a.y, bank, NEAR, a.z)) return a.carrying ? (chain(a, t, startTask(a, 'deliver')) || 'done') : 'fail';
      t.label = 'Digging clay from the bank';
      if (++t.progress % CLOCK.work.clayEvery === 0){ if (a.carrying) a.carrying.count++; else a.carrying = { kind: 'clay', count: 1 }; }
      if (a.carrying && a.carrying.count >= 2){ gainXp(a, 'gather'); return chain(a, t, startTask(a, 'deliver')) || 'done'; }
      return 'continue';
    }] },
  /* Cuttings come from wild bushes. The bush keeps growing. */
  takeCuttings: { type: 'gather',
    begin(a, args){
      if (a.carrying && a.carrying.kind !== 'cuttings') return startTask(a, 'deliver');
      const wild = tl => tl.feature === 'bush' && !tl.garden;
      const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, wild, NEAR, z), 2500, a);
      if (!p) return a.carrying ? startTask(a, 'deliver') : false;
      return { label: 'Going to a bush for cuttings', path: p, progress: 0 };
    },
    stops: [(a, t) => {
      const wild = tl => tl.feature === 'bush' && !tl.garden;
      if (!nearFind(a.x, a.y, wild, NEAR, a.z)) return a.carrying ? (chain(a, t, startTask(a, 'deliver')) || 'done') : 'fail';
      t.label = 'Taking cuttings';
      if (++t.progress % CLOCK.work.cuttingsEvery === 0){ if (a.carrying) a.carrying.count++; else a.carrying = { kind: 'cuttings', count: 1 }; }
      if (a.carrying && a.carrying.count >= 2){ gainXp(a, 'gather'); return chain(a, t, startTask(a, 'deliver')) || 'done'; }
      return 'continue';
    }] },
});
/* Delivering is called from inside other jobs' effects, below, so it keeps a plain function. */
function startDeliver(a){ return startTask(a, 'deliver'); }
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
TASKS.setSnare = (() => {
  const k = workKind({ label: 'Setting a snare', amount: CLOCK.work.setSnare, effect(a, args){
    const [bx, by] = args.at;
    if (camp.stash.stick < 3 || tileAt(bx, by).struct) return;
    camp.stash.stick -= 3; const sn = { x: bx, y: by, armed: true, catch: null, camp, chance: Math.min(0.95, 0.5 + a.skills.trap * 0.08 + a.traits.patience * 0.25) }; camp.snares.push(sn); tileAt(bx, by).struct = { type: 'snare', snare: sn };
    gainXp(a, 'trap'); log(`${a.name} sets a snare in the grass near some bushes.`, [a]);
  } });
  return { ...k, begin(a, args){
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
    args.at = [best.x, best.y];
    return k.begin(a, args);
  } };
})();
TASKS.checkSnare = workKind({ label: 'Checking the snare', amount: CLOCK.work.checkSnare, effect(a, args){
  const st = tileAt(args.at[0], args.at[1]).struct, s = st && st.type === 'snare' ? st.snare : null;
  if (s && s.catch){ s.catch = null; a.carrying = { kind: 'carcass', count: 1 }; }
} });
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
/* Haul a caught deer home from the pit. The catch goes straight to the stash here, the same as
   any other kill finished at the fire. */
TASKS.haulPit = workKind({ label: 'Hauling the deer out of the pit', amount: CLOCK.work.haulDeer, effect(a, args){
  const st = tileAt(args.at[0], args.at[1]).struct, p = st && st.type === 'pitfall' ? st.pit : null;
  if (!p || !p.catch) return; p.catch = null; stashAdd('venison', 1); log(`${a.name} hauls the deer out of the pit.`, [a], 'good');
} });
/* Walk to the camp, or to a founding party's target when there is no site yet. */
TASKS.join = { type: 'travel',
  begin(a, args){
    const c = a.camp, dest = c.site || c.target; if (!dest) return false;
    const within = c.site ? 3 : 6; const p = pathToStop(a, dest[0], dest[1], within); if (!p) return false;
    args.at = [dest[0], dest[1]]; args.within = within;
    return { label: c.site ? 'Walking toward the smoke' : 'Walking to the new valley', path: p };
  },
  stops: [(a, t) => {
    const at = t.args.at, r = goTo(a, t, at[0], at[1], t.args.within); if (r) return r;
    const c = a.camp;
    a.homeless = false;
    if (c.site){ log(`${a.name} arrives at ${c.name === 'The first camp' ? 'the camp' : c.name} and is welcomed by the fire.`, [a], 'major'); addThought(a, 'joined', 'Found people and a fire', 12, CLOCK.thought.joined); for (const o of campHumans()) if (o !== a) addThought(o, 'newcomer', `${a.name} joined the camp`, 4, CLOCK.thought.newcomer); }
    else log(`${a.name} reaches the new valley.`, [a]);
    return 'done';
  }] };

/* Quarry rocks from a rock face: a walkable tile beside ground that can be quarried, within thirty tiles of the site. */
TASKS.quarry = { type: 'work',
  begin(a, args){
    if (a.carrying && a.carrying.kind !== 'rock') return startTask(a, 'deliver');
    const [sx, sy] = camp.site; let face = null;
    const p = bfs(a.x, a.y, a.z, (x, y, z) => { if (dist(x, y, sx, sy) > 30) return false; for (const [dx, dy] of DIRS){ const q = hasTile(x + dx, y + dy, z) ? tileAt(x + dx, y + dy, z) : null; if (q && GROUND[q.ground].quarry){ face = q; return true; } } return false; }, 3500, a);
    if (!p) return false;
    args.face = [face.x, face.y, face.z];
    return { label: 'Walking to the rock face', path: p, progress: 0 };
  },
  stops: [(a, t) => {
    const [fx, fy, fz] = t.args.face; const face = tileAt(fx, fy, fz);
    if (!face || !GROUND[face.ground].quarry) return 'fail';
    t.label = 'Quarrying rocks'; t.progress += workSpeed(a, 'build');
    if (t.progress < CLOCK.work.quarry) return 'continue';
    a.carrying = { kind: 'rock', count: 2 }; gainXp(a, 'build');
    face.quarried = true;
    /* The first quarry to strike a hollowed hill pays favour, once per hill, however often it is opened before or after. */
    if (face.hill && !face.hill.hollowPaid){ const hollow = caves.find(c => c.kind === 'hollow' && c.hill === face.hill);
      if (hollow){ face.hill.hollowPaid = true; camp.fae.favor = Math.max(-100, camp.fae.favor - 10); addThought(a, 'quarryfae', 'Broke stone from the sprites\' hill. The rock rang wrong', -4, CLOCK.thought.quarryfae); log(`${a.name} opens a rock face on the sprites' hill. The grove will not like it.`, campHumans(), 'bad'); } }
    log(`${a.name} quarries two rocks from the face.`, [a]);
    return chain(a, t, startTask(a, 'deliver')) || 'done';
  }] };

function deerNear(){ if (!camp.site) return null; return beings.filter(b => b.alive && b.species === 'deer' && nearAt(b, ...camp.site) <= 34).sort((p, q) => nearAt(p, ...camp.site) - nearAt(q, ...camp.site))[0] || null; }
TASKS.huntDeer = { type: 'hunt',
  begin(a, args){
    a.carrying = { kind: 'spear', count: 1 };
    return { label: 'Stalking a deer with the spear', path: [], fast: false, progress: 0 };
  },
  stops: [(a, t) => {
    const d = beingById(t.args.deer);
    if (!d || !d.alive || ++t.progress > CLOCK.chase.deer + a.skills.hunt * CLOCK.chase.deerPerSkill){ a.carrying = null; addThought(a, 'missed', 'The deer got away', -3, CLOCK.thought.missed); a.xp.hunt = (a.xp.hunt || 0) + 1; return 'fail'; }
    if (near(a, d) <= 2){
      if (rng() < 0.3 + a.skills.hunt * 0.12){ d.hp = 0; die(d, 'was speared'); a.carrying = null; gainXp(a, 'hunt'); addThought(a, 'kill', 'Brought down a deer', 12, CLOCK.thought.kill); drift(a, 'bravery', 0.02); log(`${a.name} brings down a deer with the spear.`, campHumans(), 'major');
        const it = items.find(i => i.kind === 'venison' && i.x === d.x && i.y === d.y); if (it){ removeItem(it); a.carrying = { kind: 'venison', count: 1 }; return chain(a, t, startDeliver(a)) || 'done'; } return 'done'; }
      d.skills.wary = Math.min(3, (d.skills.wary || 0) + 1); addThought(d, 'escaped', 'A hunter missed', -6, CLOCK.thought.escaped); failTask(d); startTask(d, 'flee'); t.progress += CLOCK.chase.deerMissed;
    }
    const p = bfs(a.x, a.y, a.z, (x, y, z) => z === d.z && dist(x, y, d.x, d.y) <= 2, 700, a); if (!p) return 'fail'; t.path = p.slice(0, 4); t.fast = near(a, d) <= 8; return 'continue';
  }],
  release(a, t){ if (a.carrying && a.carrying.kind === 'spear') a.carrying = null; } };
/* An owner just driven from a den they held flees into it and sits within guard range while its raid
   cooldown runs. Chasing it with fire again is a livelock: skip it until the cooldown lifts. */
function wolfNear(){ if (!camp.pit) return null; return beings.filter(b => b.alive && b.species === 'wolf' && nearAt(b, ...camp.pit) <= 11 && !(b.oldDen && b.oldDen.cleared === camp && (b.cooldown.raid || 0) > tick)).sort((p, q) => nearAt(p, ...camp.pit) - nearAt(q, ...camp.pit))[0] || null; }
TASKS.driveOff = { type: 'guard',
  begin(a, args){
    const [px, py] = args.at; const p = pathToStop(a, px, py, 1); if (!p) return false;
    return { label: 'Grabbing a firebrand', path: p, fast: true, progress: 0 };
  },
  stops: [(a, t) => {
    const [px, py] = t.args.at; const w = beingById(t.args.wolf);
    if (!a.carrying){ if (nearAt(a, px, py) > 1) return 'fail'; a.carrying = { kind: 'ember', count: 1, dies: tick + CLOCK.limit.guardEmber }; t.label = 'Running at the wolf with fire'; }
    if (!w || !w.alive || nearAt(w, ...camp.pit) > 22 || ++t.progress > CLOCK.chase.guard){ a.carrying = null; if (w && w.alive && nearAt(w, ...camp.pit) > 22){ if (tick - camp.guardLogged > CLOCK.cooldown.guardLine){ camp.guardLogged = tick; log(`${a.name} chases the wolf off into the dark with a burning branch.`, campHumans(), 'good'); } addThought(a, 'brave', 'Drove off a wolf', 8, CLOCK.thought.brave); drift(a, 'bravery', 0.03); for (const h of campHumans()) if (h !== a) addThought(h, 'guarded', `${a.name} drove off a wolf`, 4, CLOCK.thought.guarded); } return 'done'; }
    if (near(a, w) <= 2){ addThought(w, 'burned', 'A human came at me with fire', -20, CLOCK.thought.burnedWolf); w.cooldown.raid = tick + CLOCK.cooldown.wolfBurned; w.cooldown.wander = tick + CLOCK.cooldown.wolfWanders; w.shyOf = camp; failTask(w); startTask(w, 'flee'); }
    const q = bfs(a.x, a.y, a.z, (x, y, z) => z === w.z && dist(x, y, w.x, w.y) <= 2, 500, a); if (!q) return 'continue'; t.path = q.slice(0, 3); return 'continue';
  }],
  release(a, t){ if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };

/* Take a brand from the pit, then go on to next.kind. Shared by the cave search and the den clearing. */
TASKS.brand = { type: 'work',
  begin(a, args){
    const [px, py] = camp.pit; const p = pathToStop(a, px, py, 1); if (!p) return false;
    args.at = [px, py];
    return { label: `Going to the fire for a brand`, path: p, fast: false };
  },
  stops: [(a, t) => {
    const [px, py] = t.args.at;
    if (nearAt(a, px, py) > 1) return 'fail'; if (!pitLit()) return 'fail';
    a.carrying = { kind: 'ember', count: 1, dies: tick + CLOCK.limit.ember }; t.label = t.args.label;
    const r = chain(a, t, startTask(a, t.args.next.kind, t.args.next.args)); if (r) return r; a.carrying = null; return 'fail';
  }],
  release(a, t){ if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };
function withBrand(a, label, next){ return startTask(a, 'brand', { label, next }); }
/* Walk to the deep chamber with the brand, pick up the find, and come home. The ember's life is the clock.
   The cave is claimed the moment the search task starts, so a second person gets no offer on it while
   the first is still in the dark; the claim (and the search) clears if the searcher is interrupted or
   dies. It counts as searched only once the find (or empty hands) reaches the stash. */
TASKS.searchCave = { type: 'search',
  begin(a, args){
    const c = caves[args.cave]; const d = c.deep; const p = pathToStop(a, d.x, d.y, 0, d.z); if (!p) return false;
    log(`${a.name} goes into the dark under the hill with a brand.`, campHumans(), 'major');
    c.claimed = a.id;
    return { label: 'Searching the cave by brandlight', path: p };
  },
  stops: [(a, t) => {
    const c = caves[t.args.cave]; const d = c.deep;
    if (nearAt(a, d.x, d.y, d.z) > 0){ const q = pathToStop(a, d.x, d.y, 0, d.z); if (!q) return 'fail'; t.path = q; return 'continue'; }
    const it = itemAt(d.x, d.y, d.z); a.carrying = null;
    if (it){ removeItem(it); a.carrying = { kind: it.kind, count: 1 }; }
    addThought(a, 'searched', 'Went into the dark and came back', 8, CLOCK.thought.searched); drift(a, 'bravery', 0.03);
    const [sx, sy] = camp.stashTile; const q = pathToStop(a, sx, sy, 1); if (!q) return 'fail';
    t.path = q; t.label = it ? `Carrying the ${ITEMS[it.kind].name} up out of the dark` : 'Coming up out of the dark, empty-handed';
    t.stop = 1; return 'continue';
  }, (a, t) => {
    const c = caves[t.args.cave]; const [sx, sy] = camp.stashTile;
    if (nearAt(a, sx, sy) > 1){ const q = pathToStop(a, sx, sy, 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
    c.searched = camp; return chain(a, t, startDeliver(a)) || 'done';
  }],
  release(a, t){ const c = caves[t.args.cave]; if (c.claimed === a.id) c.claimed = null; if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };
/* Break the fallen rock with the axe. c.blocked is read again from the cave when the work begins,
   at the pit and again once the party arrives, so a rock cleared by someone else in the meantime
   is noticed rather than cleared a second time. */
TASKS.clearRock = { type: 'work',
  begin(a, args){
    const c = caves[args.cave]; const b = c.blocked; if (!b) return false;
    /* Either side of the rock may be a real floor tile, but only the near side is reachable
       while the rock still blocks the passage. Try each candidate and keep the one with a path. */
    const spots = DIRS.map(([dx, dy]) => hasTile(b.x + dx, b.y + dy, b.z) ? tileAt(b.x + dx, b.y + dy, b.z) : null).filter(t => t && passable(t.x, t.y, t.z));
    let spot = null, p = null;
    for (const s of spots){ const q = pathToStop(a, s.x, s.y, 0, s.z); if (q){ spot = s; p = q; break; } }
    if (!spot) return false;
    args.spot = [spot.x, spot.y, spot.z];
    return { label: 'Going down to the fallen rock', path: p, progress: 0 };
  },
  stops: [(a, t) => {
    const [sx, sy, sz] = t.args.spot;
    if (nearAt(a, sx, sy, sz) > 0){ const q = pathToStop(a, sx, sy, 0, sz); if (!q) return 'fail'; t.path = q; return 'continue'; }
    const c = caves[t.args.cave], b = c.blocked;
    t.label = `Breaking the fallen rock (${Math.min(99, Math.floor(t.progress / CLOCK.work.breakRockfall * 100))}%)`; t.progress += workSpeed(a, 'build'); if (t.progress < CLOCK.work.breakRockfall) return 'continue';
    b.ground = 'stone'; c.blocked = null; c.story.push(`${a.name} cleared the rock.`); gainXp(a, 'build'); addItem('rock', sx, sy, sz);
    log(`${a.name} breaks through the fallen rock. The passage runs on into the dark.`, campHumans(), 'good'); a.carrying = null;
    const [stx, sty] = camp.stashTile; const q = pathToStop(a, stx, sty, 1); if (!q) return 'done'; t.path = q; t.label = 'Coming up out of the dark'; t.stop = 1; return 'continue';
  }, () => 'done'],
  release(a, t){ if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };
/* A den party member: brave, grown, has a home to go back to, and healthy. Used both to size up
   whether a camp has a party (the dens goal's state) and to pick the mate (startClearDen). */
const denReady = h => h.traits.bravery >= 0.5 && stage(h) !== 'young' && !h.homeless && h.hp >= 60;
/* Following with a brand on the way to the den: the mate's task until the leader arrives and
   sets its coming-home walk. */
TASKS.followBrand = { type: 'guard', begin: () => false, stops: [() => 'continue'],
  release(a, t){ if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };
/* The walk home from the den with the brand, putting the ember out on arrival. Used for the mate's
   own task, and its stop is reused directly for the leader's second stop (which stays type 'guard'
   rather than switching kind, as today). */
function comeHomeStop(a, t){
  const [sx, sy] = t.args.at;
  if (nearAt(a, sx, sy) > 1){ const r = pathToStop(a, sx, sy, 1); if (!r) return 'fail'; t.path = r; return 'continue'; }
  if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; return 'done';
}
TASKS.comeHome = { type: 'travel', begin: () => false, stops: [comeHomeStop],
  release(a, t){ if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };
/* Two brave people with brands and the spear drive the owners out of a den. The leader carries the spear; a mate
   follows with a brand. Both keep their brands lit until they are home at the stash: the den mouth is often a
   level down, and letting go of the ember there leaves the party in the dark. An owner that cannot flee (no
   threat to flee from, deep in its own den) is sent off on foot instead, so it does not stand there to be
   found again the next tick. */
TASKS.clearDen = { type: 'guard',
  begin(a, args){
    const c = caves[args.cave]; const m = c.mouth; const p = pathToStop(a, m.x, m.y, 0, m.z); if (!p) return false;
    const mate = beingById(args.mate);
    failTask(mate);
    const mp = pathToStop(mate, m.x, m.y, 1, m.z); if (!mp) return false;
    mate.carrying = { kind: 'ember', count: 1, dies: tick + CLOCK.limit.ember };
    setTask(mate, 'followBrand', {}, { type: 'guard', label: 'Following with a brand', path: mp });
    return { label: 'Going to the den with fire and the spear', path: p, fast: true };
  },
  stops: [(a, t) => {
    const c = caves[t.args.cave]; const m = c.mouth; const mate = beingById(t.args.mate);
    if (nearAt(a, m.x, m.y, m.z) > 0){ const q = pathToStop(a, m.x, m.y, 0, m.z); if (!q) return 'fail'; t.path = q; return 'continue'; }
    const owners = beings.filter(b => b.alive && b.den === c);
    for (const w of owners){
      w.den = null; w.oldDen = c; w.cooldown.raid = tick + CLOCK.cooldown.wolfDriven; w.shyOf = camp; failTask(w);
      addThought(w, 'driven', 'Driven from the den by fire', -20, CLOCK.thought.driven);
      if (!startTask(w, 'flee')){
        const away = (x, y, z) => z === 0 && passable(x, y, 0) && dist(x, y, c.exit.x, c.exit.y) >= 20 && !tileAt(x, y, 0).cave && !tileAt(x, y, 0).mouth;
        const sp = bfs(w.x, w.y, w.z, away, 2000, w);
        if (sp) setTask(w, 'walk', {}, { type: 'wander', label: 'Slinking off', path: sp });
      }
    }
    c.cleared = camp; c.clearedAt = tick; c.story.push(`${camp.name} drove the ${c.owner === 'wolf' ? 'wolves' : 'foxes'} out with fire.`);
    log(`${a.name} and ${mate.name} drive the ${c.owner === 'wolf' ? 'wolves' : 'foxes'} from the den with fire and the spear.`, campHumans(), 'major');
    addThought(a, 'cleared', 'Drove the beasts out of their den', 10, CLOCK.thought.cleared); addThought(mate, 'cleared', 'Stood with a brand at the den', 8, CLOCK.thought.cleared); drift(a, 'bravery', 0.04); drift(mate, 'bravery', 0.02);
    const [sx, sy] = camp.stashTile;
    const mq = pathToStop(mate, sx, sy, 1);
    if (mq) setTask(mate, 'comeHome', { at: [sx, sy] }, { type: 'travel', label: 'Coming back from the den', path: mq });
    else { if (mate.carrying && mate.carrying.kind === 'ember') mate.carrying = null; mate.task = null; }
    const q = pathToStop(a, sx, sy, 1); if (!q) return 'fail';
    t.path = q; t.label = 'Coming back from the den'; t.args.at = [sx, sy]; t.stop = 1; return 'continue';
  }, comeHomeStop],
  release(a, t){ if (a.carrying && a.carrying.kind === 'ember') a.carrying = null; } };
function startClearDen(a, c){
  const mate = campHumans().find(h => h !== a && denReady(h)); if (!mate) return false;
  return withBrand(a, 'Going to the den with fire and the spear', { kind: 'clearDen', args: { cave: caves.indexOf(c), mate: mate.id } });
}

TASKS.cutTree = { type: 'work',
  begin(a, args){
    const [cx, cy] = camp.site; let tree = null;
    const shy = camp.fae.known && camp.fae.favor < 30 ? new Set(groves.map(g => g.sector)) : null;
    const p = bfs(a.x, a.y, a.z, (x, y, z) => { for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (hasTile(nx, ny, z)){ const tl = tileAt(nx, ny, z); if (tl.feature === 'tree' && tl.fire <= 0 && dist(nx, ny, cx, cy) >= 4 && !tl.claimed && !(shy && shy.has(sectorOfTile(tl)))){ tree = tl; return true; } } } return false; }, 2500, a);
    if (!p) return false;
    tree.claimed = a.id;
    args.tree = [tree.x, tree.y, tree.z];
    return { label: 'Walking to a tree with the axe', path: p, progress: 0 };
  },
  stops: [(a, t) => {
    const [tx, ty, tz] = t.args.tree; const tree = tileAt(tx, ty, tz);
    if (tree.feature !== 'tree') return 'fail';
    t.progress += 1 + a.skills.woodcut * 0.3; t.label = `Chopping a pine (${Math.min(99, Math.floor(t.progress / CLOCK.work.cutTree * 100))}%)`;
    if (t.progress < CLOCK.work.cutTree) return 'continue';
    tree.feature = null; tree.claimed = null; addItem('log', tree.x, tree.y); addItem('log', tree.x, tree.y); addItem('stick', tree.x, tree.y);
    gainXp(a, 'woodcut'); log(`${a.name} fells a pine. Logs at last.`, [a]);
    const g = groves.find(g => g.sector === sectorOfTile(tree)); if (g){ g.anger = Math.min(100, g.anger + 15); camp.fae.favor = Math.max(-100, camp.fae.favor - 15); camp.fae.grudges[a.id] = (camp.fae.grudges[a.id] || 0) + 25; if (camp.fae.known) addThought(a, 'grovecut', 'Cut a pine where the sprites live. It felt watched', -3, CLOCK.thought.grovecut); for (const o of beings) if (o.alive && o.species === 'sprite' && o.grove === g) addThought(o, 'axe', `${a.name} cut a tree in our grove`, -12, CLOCK.thought.axeCut); }
    return chain(a, t, startTask(a, 'gather', { item: 'log' })) || 'done';
  }],
  release(a, t){ const [tx, ty, tz] = t.args.tree; const tree = tileAt(tx, ty, tz); if (tree.claimed === a.id) tree.claimed = null; } };
TASKS.fillWater = { type: 'gather',
  begin(a, args){
    if (a.carrying && a.carrying.kind !== 'water') return startTask(a, 'deliver');
    const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, tl => tl.ground === 'water', NEAR, z), 3000, a); if (!p) return false;
    return { label: 'Going to fill the waterskin', path: p, progress: 0 };
  },
  stops: [(a, t) => { t.label = 'Filling the waterskin'; if (++t.progress < CLOCK.work.fillWaterskin) return 'continue'; a.carrying = { kind: 'water', count: 3 }; a.needs.water = 100; return chain(a, t, startTask(a, 'deliver')) || 'done'; }] };
