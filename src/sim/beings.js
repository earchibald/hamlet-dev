function takeName(){ if (!namePool.length) namePool = shuffle(NAMES); return namePool.pop(); }

/* ---------- beings ---------- */
function makeBeing(species, x, y, name, hue){
  const r = () => Math.round(rng() * 100) / 100;
  const sp = SPECIES[species];
  const needs = {}; for (const k in sp.decay) needs[k] = 55 + rint(40);
  const L = LIFE[species];
  const b = {
    id: nextId++, species, name: name || `${sp.label[0].toUpperCase()}${sp.label.slice(1)} ${nextId}`, hue, x, y, z: 0, hp: 100, alive: true,
    born: tick - Math.round((L.adult + rng() * ((L.seed || L.old) - L.adult)) * DAY), parents: null, lastChild: -99999,
    needs, traits: { bravery: r(), sociability: r(), diligence: r(), temper: r(), curiosity: r(), patience: r(), hardiness: r() },
    skills: { gather: 0, build: 0, cook: 0, trap: 0, craft: 0, woodcut: 0, hunt: 0, wary: 0 }, xp: {},
    thoughts: [], opinions: {}, rel: {}, task: null, carrying: null, status: 'Arriving', asleep: false,
    cooldown: {}, history: [], lastChoice: null, lastHurt: null, homeless: false, pokedUntil: 0, camp: null,
  };
  if (species === 'human') b.needs.warmth = 80 + rint(20);
  if (species === 'human') b.clothes = false;
  if (species !== 'human') b.name = `${sp.label[0].toUpperCase()}${sp.label.slice(1)} ${b.id}`;
  if (species === 'sprite'){ b.hp = 30; b.grove = null; b.returnAt = 0; b.target = null; }
  if (species === 'fox' || species === 'wolf') b.den = null;
  if (species === 'gnome') b.den = null;
  return b;
}
const beingById = id => beings.find(b => b.id === id);
const humans = () => beings.filter(b => b.species === 'human' && b.alive);
/* The first person of the world. The gods come into being before the people, so beings[0] is a god. */
const firstPerson = () => beings.find(b => b.species === 'human');
function addThought(a, key, text, value, dur){
  const t = a.thoughts.find(t => t.key === key);
  if (t){ t.left = dur; t.value = value; t.text = text; } else a.thoughts.push({ key, text, value, left: dur });
}
const hasThought = (a, key) => a.thoughts.some(t => t.key === key);
function mood(a){
  let m = 50; for (const t of a.thoughts) m += t.value;
  const n = a.needs;
  if (n.food < 20) m -= 12; if (n.water !== undefined && n.water < 20) m -= 12; if (n.rest < 15) m -= 8;
  if (n.social !== undefined && n.social < 15) m -= Math.round(10 * a.traits.sociability);
  if (a.hp < 50) m -= 10;
  return clamp(Math.round(m), 0, 100);
}
function drift(a, trait, d){ a.traits[trait] = clamp(Math.round((a.traits[trait] + d) * 100) / 100, 0, 1); }
const workSpeed = (a, sk) => (1 + (a.skills[sk] || 0) * 0.25 + a.traits.patience * 0.2) * (stage(a) === 'young' ? 0.5 : stage(a) === 'old' ? 0.7 : 1);
function gainXp(a, sk){
  a.xp[sk] = (a.xp[sk] || 0) + 0.7 + a.traits.curiosity * 0.6;
  if (a.xp[sk] >= (a.skills[sk] + 1) * 3){ a.xp[sk] = 0; a.skills[sk]++; drift(a, 'diligence', 0.01); if (a.species === 'human') log(`${a.name} is getting better at ${sk === 'trap' ? 'trapping' : sk + 'ing'} (level ${a.skills[sk]}).`, [a], 'good'); }
}
function endTask(a){ const t = a.task; if (!t) return; if (t.cleanup) t.cleanup(t); a.task = null; }
function failTask(a){ const t = a.task; if (!t) return; if (t.cleanup) t.cleanup(t); dropCarried(a); a.task = null; }
function dropCarried(a){
  if (!a.carrying) return;
  const c = a.carrying; a.carrying = null;
  if (c.kind === 'berries' || c.kind === 'cooked' || c.kind === 'ember' || c.kind === 'water' || c.kind === 'spear') return;
  if (c.kind === 'fibre' || c.kind === 'clay' || c.kind === 'cuttings') return;
  if (c.kind === 'moss'){ for (let k = 0; k < c.count; k++) addItem('moss', a.x, a.y, a.z); return; }
  for (let k = 0; k < c.count; k++) addItem(c.kind, a.x, a.y, a.z);
}
function die(a, cause){
  failTask(a); a.alive = false; a.asleep = false; a.status = 'Dead';
  if (a.species === 'human'){
    corpses.push({ x: a.x, y: a.y, z: a.z, name: a.name });
    log(`${a.name} ${cause}.`, [a], 'death');
    for (const o of humans()){
      if (o.camp !== a.camp) continue;
      const op = o.opinions[a.id] || 0;
      if (op >= 25) addThought(o, 'grief' + a.id, `Grieves for ${a.name}`, -30, 3000);
      else addThought(o, 'loss' + a.id, `Sad about the death of ${a.name}`, -8, 1500);
    }
  } else if (a.species === 'rabbit'){ addItem('carcass', a.x, a.y, a.z); }
  else if (a.species === 'sprite'){
    const g = a.grove; if (g){ g.anger = Math.min(100, g.anger + 60); g.swarmUntil = tick + 4000; for (const c of camps) if (c.site && nearAt(a, ...c.site) <= 40){ c.fae.favor = Math.max(-100, c.fae.favor - 40); c.fae.blightUntil = tick + 5000; } }
    log(`A sprite dies. Its light goes out, and the grove will remember.`, humans().filter(h => near(h, a) <= 12), 'bad');
    for (const o of beings) if (o.alive && o.species === 'sprite' && o.grove === g) addThought(o, 'kin', 'One of us was killed by humans', -20, 4000);
  }
  else if (a.species === 'deer'){ addItem('venison', a.x, a.y, a.z); for (const o of beings) if (o.alive && o.species === 'deer' && near(o, a) <= 10){ addThought(o, 'herdloss', 'One of the herd was taken', -6, 1200); o.skills.wary = Math.min(3, (o.skills.wary || 0) + 1); } }
  else if (a.species === 'gnome'){ log(`A gnome ${cause}.`, [], 'death'); }
}
function chat(a, b){
  const compat = 1 - Math.abs(a.traits.sociability - b.traits.sociability) - 0.8 * Math.abs(a.traits.temper - b.traits.temper);
  const delta = Math.round(compat * 12 - 1 - (a.traits.temper + b.traits.temper) * 3 + (rng() * 8 - 4));
  a.needs.social = Math.min(100, a.needs.social + 35); b.needs.social = Math.min(100, b.needs.social + 25);
  for (const [p, q] of [[a, b], [b, a]]){
    p.opinions[q.id] = clamp((p.opinions[q.id] || 0) + delta, -100, 100);
    addThought(p, 'chat' + q.id, delta >= 0 ? `Talked with ${q.name} by the fire` : `Argued with ${q.name}`, delta >= 0 ? 3 + Math.round(p.traits.sociability * 4) : -5, 500);
    drift(p, delta >= 0 ? 'sociability' : 'temper', 0.01);
  }
  const op = (a.opinions[b.id] + b.opinions[a.id]) / 2;
  if (op >= 40 && a.rel[b.id] !== 'friend'){ a.rel[b.id] = b.rel[a.id] = 'friend'; log(`${a.name} and ${b.name} are now friends.`, [a, b], 'good'); }
  else if (op <= -40 && a.rel[b.id] !== 'rival'){ a.rel[b.id] = b.rel[a.id] = 'rival'; log(`${a.name} and ${b.name} can no longer stand each other.`, [a, b], 'bad'); }
}

/* Basic actions shared by species. */
const START = {
  drink(a){
    if (a.species === 'human' && !a.homeless && camp.stash.water > 0 && camp.stashTile){
      const [sx, sy] = camp.stashTile; const p = legPath(a, sx, sy, 1);
      if (p){ a.task = { type: 'drink', label: 'Going to drink at camp', path: p, arrive(a, t){ if (nearAt(a, sx, sy) > 1){ const q = legPath(a, sx, sy, 1); if (!q) return 'fail'; t.path = q; return 'continue'; } if (camp.stash.water <= 0) return 'fail'; camp.stash.water--; a.needs.water = 100; addThought(a, 'drank', 'Drank at the fire without a long walk', 3, 300); return 'done'; } }; return true; }
    }
    /* The near country first. A camp can stand far from any water, so a failed near search walks the whole
       world once and covers the first stretch, the same way legPath does. Thirst must never have no answer. */
    const wet = (x, y, z) => !!nearFind(x, y, t => t.ground === 'water', NEAR, z);
    const walkFar = a => { const q = bfs(a.x, a.y, a.z, wet, NZ * W * H, a); return q ? q.slice(0, 48) : null; };
    let p = bfs(a.x, a.y, a.z, wet, 3000, a), far = false;
    if (!p){ p = walkFar(a); if (!p) return false; far = true; }
    if (far && a.species === 'human') addThought(a, 'farwater', 'Walking a long way for water', -3, 600);
    a.task = { type: 'drink', label: far ? 'Walking a long way for water' : 'Going to drink', path: p,
      arrive(a, t){
        if (!wet(a.x, a.y, a.z)){
          const q = walkFar(a); if (!q) return 'fail';
          t.path = q; t.label = 'Walking a long way for water'; return 'continue';
        }
        a.needs.water = 100; if (a.species === 'human') addThought(a, 'drank', 'Drank cold river water', 2, 300); return 'done'; } };
    return true;
  },
  eat(a){
    if (a.species === 'human' && !a.homeless && camp.stashTile && stashFood() > 0){
      const [sx, sy] = camp.stashTile; const p = legPath(a, sx, sy, 1); if (p){
        a.task = { type: 'eat', label: 'Going to eat at camp', path: p, arrive(a, t){
          if (nearAt(a, sx, sy) > 1){ const q = legPath(a, sx, sy, 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
          if (camp.stash.cooked > 0){ stashTake('cooked'); a.needs.food = Math.min(100, a.needs.food + 55); addThought(a, 'ate', camp.bestCook > 1 ? 'Ate a meal cooked with real skill' : 'Ate a hot meal of rabbit', 7 + Math.min(4, camp.bestCook || 0), 700); }
          else if (camp.stash.smoked > 0){ stashTake('smoked'); a.needs.food = Math.min(100, a.needs.food + 45); addThought(a, 'ate', 'Chewed smoked meat by the fire', 4, 600); }
          else if (camp.stash.berries > 0){ stashTake('berries'); a.needs.food = Math.min(100, a.needs.food + 28); addThought(a, 'ate', 'Ate berries from the stash', 2, 400); }
          else return 'fail';
          return a.needs.food < 60 && stashFood() > 0 ? 'continue' : 'done'; } };
        return true; }
    }
    let hasFood = a.species === 'rabbit' ? (t => t.ground === 'grass' && !t.feature || t.feature === 'bush' || t.feature === 'reeds') : (t => t.feature === 'bush' && t.berries > 0);
    let p = null;
    if (a.species === 'rabbit'){ const bushy = t => t.feature === 'bush' && t.berries > 0; p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, bushy, NEAR, z), 400, a); if (p) hasFood = bushy; }
    if (!p) p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, hasFood, NEAR, z), a.species === 'rabbit' ? 200 : 2500, a); if (!p) return false;
    a.task = { type: 'eat', label: a.species === 'rabbit' ? 'Looking for grass' : 'Going to eat berries', path: p, progress: 0,
      arrive(a, t){
        const b = nearFind(a.x, a.y, hasFood, NEAR, a.z); if (!b) return 'fail';
        if (a.species === 'rabbit'){ t.label = 'Nibbling grass'; if (++t.progress < 15) return 'continue'; a.needs.food = Math.min(100, a.needs.food + 45); if (b.feature === 'bush' && b.berries > 0) b.berries--; return 'done'; }
        b.berries--; a.needs.food = Math.min(100, a.needs.food + 25); addThought(a, 'ate', 'Ate berries off the bush', 2, 400);
        return a.needs.food < 60 && b.berries > 0 ? 'continue' : 'done';
      } };
    return true;
  },
  sleep(a){
    const place = a.species === 'human' && !a.homeless && sleepPlaces().filter(pl => beings.filter(b => b.alive && b.asleep && nearAt(b, ...pl) <= 1).length < 3).sort((p, q) => nearAt(a, ...p) - nearAt(a, ...q))[0];
    if (place && nearAt(a, ...place) > 1){
      const p = legPath(a, place[0], place[1], 1);
      if (p){ a.task = { type: 'sleep', label: 'Going to the lean-to', path: p, arrive(a){ a.asleep = true; a.task = null; return 'done'; } }; return true; }
    }
    a.asleep = true; a.task = null; a.status = 'Sleeping'; return true; },
  socialize(a){
    const others = humans().filter(o => o !== a && !o.asleep && o.camp === a.camp);
    if (!others.length) return false;
    let target = null;
    const p = bfs(a.x, a.y, a.z, (x, y, z) => { target = others.find(o => o.z === z && dist(o.x, o.y, x, y) <= 1); return !!target; }, 1500, a); if (!p) return false;
    a.task = { type: 'socialize', label: `Going to talk to ${target.name}`, path: p, progress: 0,
      arrive(a, t){ if (!target.alive || near(target, a) > 2) return 'fail'; t.label = `Talking with ${target.name}`; if (++t.progress < 10) return 'continue'; chat(a, target); return 'done'; } };
    return true;
  },
  shelter(a){
    if (!camp.shelter || a.homeless) return false; const [hx, hy] = camp.shelter; const p = legPath(a, hx, hy, 1); if (!p) return false;
    a.task = { type: 'shelter', label: 'Waiting out the rain under the roof', path: p, progress: 0, arrive(a, t){ if (nearAt(a, hx, hy) > 1){ const q = legPath(a, hx, hy, 1); if (!q) return 'fail'; t.path = q; return 'continue'; } return ++t.progress < 60 && weather.storm ? 'continue' : 'done'; } };
    return true;
  },
  sit(a){
    if (!pitLit() || a.homeless) return false;
    const [px, py] = camp.pit; const p = legPath(a, px, py, 1); if (!p) return false;
    a.task = { type: 'sit', label: 'Going to sit by the fire', path: p, progress: 0,
      arrive(a, t){
        if (nearAt(a, px, py) > 1){ const q = legPath(a, px, py, 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
        t.label = 'Sitting by the fire'; a.needs.rest = Math.min(100, a.needs.rest + 0.05);
        if (t.progress % 25 === 0){ const o = humans().find(o => o !== a && near(o, a) <= 2 && o.task && o.task.type === 'sit'); if (o) chat(a, o); }
        if (a.needs.warmth !== undefined) a.needs.warmth = Math.min(100, a.needs.warmth + 0.4);
        if (t.progress % 30 === 15){
          const teacher = humans().find(o => o !== a && near(o, a) <= 2 && o.task && o.task.type === 'sit' && Object.keys(o.skills).some(k => o.skills[k] > (a.skills[k] || 0) + 1));
          if (teacher){ const sk = Object.keys(teacher.skills).filter(k => teacher.skills[k] > (a.skills[k] || 0) + 1).sort((p, q) => teacher.skills[q] - teacher.skills[p])[0]; a.xp[sk] = (a.xp[sk] || 0) + (stage(teacher) === 'old' ? 1.2 : 0.6) * (0.5 + a.traits.curiosity); addThought(a, 'taught', `Learned about ${sk === 'trap' ? 'trapping' : sk + 'ing'} from ${teacher.name}`, 3, 600); if (a.xp[sk] >= (a.skills[sk] + 1) * 3){ a.xp[sk] = 0; a.skills[sk]++; log(`${a.name} learned ${sk === 'trap' ? 'trapping' : sk + 'ing'} from ${teacher.name} by the fire.`, [a, teacher], 'good'); } }
        }
        return ++t.progress < 90 && pitLit() ? 'continue' : 'done';
      } };
    return true;
  },
  wander(a){
    for (let k = 0; k < 6; k++){
      const tx = a.x + rint(11) - 5, ty = a.y + rint(11) - 5; if (!passable(tx, ty, a.z)) continue;
      const p = bfs(a.x, a.y, a.z, (x, y, z) => x === tx && y === ty && z === a.z, 250, a);
      if (p){ a.task = { type: 'wander', label: a.species === 'human' ? 'Wandering' : 'Roaming', path: p, arrive: () => 'done' }; return true; }
    }
    a.task = { type: 'wander', label: 'Standing still', path: [], wait: 20, arrive: () => 'done' }; return true;
  },
  rest(a){ a.task = { type: 'rest', label: a.species === 'rabbit' ? 'Resting in the grass' : 'Dozing', path: [], wait: 60, arrive(a){ a.needs.rest = Math.min(100, a.needs.rest + 40); return 'done'; } }; return true; },
  flee(a){
    const threats = threatsFor(a); if (!threats.length) return false;
    let best = null;
    for (let k = 0; k < 14; k++){
      const tx = a.x + rint(13) - 6, ty = a.y + rint(13) - 6; if (!passable(tx, ty, a.z)) continue;
      const md = Math.min(...threats.map(([x, y]) => dist(tx, ty, x, y)));
      if (!best || md > best.md) best = { tx, ty, md };
    }
    if (!best) return false;
    const p = bfs(a.x, a.y, a.z, (x, y, z) => x === best.tx && y === best.ty && z === a.z, 250, a); if (!p) return false;
    a.task = { type: 'flee', label: a.species === 'human' ? 'Running from the fire' : 'Bolting', path: p, fast: true, arrive: () => 'done' }; return true;
  },
};

function threatsFor(a){
  const out = [];
  const timid = a.traits.bravery < 0.3 ? 2 : a.traits.bravery > 0.7 ? -1 : 0, wary = Math.min(3, a.skills.wary || 0);
  const f = nearestFire(a.x, a.y, 4, a.z); if (f >= 0) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (hasTile(a.x + dx, a.y + dy, a.z) && tileAt(a.x + dx, a.y + dy, a.z).fire > 0) out.push([a.x + dx, a.y + dy]);
  const ember = b => b.carrying && b.carrying.kind === 'ember';
  if (a.species === 'rabbit') for (const b of beings){ if (!b.alive || b === a) continue; const d = near(b, a); if (((b.species === 'fox' || b.species === 'wolf') && d <= 6 + timid + wary) || (b.species === 'human' && d <= 2 + wary && !b.asleep)) out.push([b.x, b.y]); }
  if (a.species === 'deer') for (const b of beings){ if (!b.alive || b === a) continue; const d = near(b, a); if ((b.species === 'wolf' && d <= 8 + timid + wary) || (b.species === 'human' && d <= (b.carrying && b.carrying.kind === 'spear' ? 6 : 3) + timid + wary && !b.asleep)) out.push([b.x, b.y]); }
  if (a.species === 'fox' || a.species === 'wolf'){
    const r = a.species === 'fox' ? 3 : 1;
    for (const b of beings){ if (b.alive && b.species === 'human' && near(b, a) <= (ember(b) ? 7 : r)) out.push([b.x, b.y]); }
    for (const c of camps) if (c.pit && ((tileAt(...c.pit).struct.lit && nearAt(a, ...c.pit) <= (a.species === 'fox' ? 6 : 8)) || (a.shyOf === c && (a.cooldown.raid || 0) > tick && nearAt(a, ...c.pit) <= 20))) out.push(c.pit);
  }
  if (a.species === 'human') for (const b of beings){ if (b.alive && b.species === 'wolf' && near(b, a) <= 3 && !ember(a)) out.push([b.x, b.y]); }
  if (a.species === 'sprite'){
    for (const b of beings){ if (b.alive && b.species === 'human' && (b.carrying && (b.carrying.kind === 'spear' || b.carrying.kind === 'ember')) && near(b, a) <= 5 + timid) out.push([b.x, b.y]); }
    for (const c of camps) if (c.ward && c.pit && nearAt(a, ...c.pit) <= 9) out.push(c.pit);
  }
  if (a.species === 'gnome'){
    for (const b of beings){ if (!b.alive) continue; if (b.species === 'human' && ember(b) && near(b, a) <= 5) out.push([b.x, b.y]); if (b.species === 'wolf' && near(b, a) <= 6) out.push([b.x, b.y]); }
  }
  return out;
}

/* Utility decision. Each option gets a score. Try the best first. */
const urg = v => v < 60 ? (60 - v) * 1.8 : 0;
function chooseTask(a){
  const n = a.needs, tr = a.traits, night = isNight();
  let opts = [];
  if (a.species === 'human'){
    const low = mood(a) < 30 ? 20 : 0, poke = a.pokedUntil > tick ? 1.5 : 1;
    opts = [
      { type: 'drink', score: urg(n.water) * 1.2 }, { type: 'eat', score: urg(n.food) },
      { type: 'sleep', score: n.rest < 25 ? (25 - n.rest) * 4 + 30 : (night && n.rest < 80 ? 55 : 0) },
      { type: 'socialize', score: urg(n.social) * (0.3 + tr.sociability) * (humans().length > 1 ? 1 : 0) },
      { type: 'sit', score: camp && pitLit() ? (night ? 30 : 12) + (100 - n.social) * 0.1 + (100 - n.warmth) * 0.9 + (weather.storm && !camp.shelter ? 15 : 0) : 0 },
      { type: 'shelter', score: camp && camp.shelter && weather.storm ? 45 : 0 },
      { type: 'wander', score: 6 },
    ];
    if (a.homeless && camp && (camp.site || camp.target)) opts.push({ type: 'join', score: 62 });
    else for (const o of offersFor(a)){ if (stage(a) === 'young' && /hunt|wolf|lead a party|cut a tree|ember/.test(o.label)) continue; opts.push({ type: 'work', label: o.label, goal: o.goal, start: o.start, score: (o.score + tr.diligence * 25 - low) * poke * (stage(a) === 'young' ? 0.7 : 1) }); }
    if (a.carrying) opts.push({ type: 'deliver', score: 95 });
  } else if (a.species === 'rabbit'){
    opts = [{ type: 'flee', score: threatsFor(a).length ? 120 : 0 }, { type: 'eat', score: urg(n.food) * (drowsy(a) ? 0.6 : 1.2) }, { type: 'rest', score: n.rest < 40 || weather.storm ? 50 : drowsy(a) ? 35 : 0 }, { type: 'wander', score: drowsy(a) ? 4 : 12 }];
  } else if (a.species === 'deer'){
    opts = [{ type: 'flee', score: threatsFor(a).length ? 120 : 0 }, { type: 'eat', score: urg(n.food) * (drowsy(a) ? 0.6 : 1.2) }, { type: 'drink', score: urg(n.water) }, { type: 'herd', score: 22 + a.traits.sociability * 20 }, { type: 'rest', score: n.rest < 40 || weather.storm ? 50 : drowsy(a) ? 35 : 0 }, { type: 'wander', score: drowsy(a) ? 4 : 12 }];
  } else if (a.species === 'sprite'){
    const home = a.grove ? nearAt(a, a.grove.x, a.grove.y) : 0, swarm = a.grove && a.grove.swarmUntil > tick, back = a.returnAt && tick > a.returnAt;
    if (back){ a.returnAt = 0; if (a.target){ a.target.fae.favor -= 15; for (const o of beings) if (o.alive && o.species === 'sprite' && o.grove === a.grove) addThought(o, 'raid', 'We go back together', 6, 1500); if (a.grove) a.grove.swarmUntil = Math.max(a.grove.swarmUntil, tick + 1500); } }
    opts = [{ type: 'flee', score: threatsFor(a).length ? 110 : 0 },
      { type: 'dance', score: drowsy(a) ? 90 : (n.glow < 40 ? 50 : 15) + (home > 25 ? 15 : 0) },
      { type: 'prank', score: night && (swarm || n.play < 50) ? 70 : 0 },
      { type: 'collect', score: night ? 55 : 0 },
      { type: 'watch', score: night && n.play < 70 ? 45 + a.traits.curiosity * 20 : 0 },
      { type: 'forage', score: urg(n.glow) * 0.7 }, { type: 'wander', score: night ? 12 : 3 }];
  } else if (a.species === 'gnome'){
    opts = [{ type: 'flee', score: threatsFor(a).length ? 110 : 0 },
      { type: 'home', score: drowsy(a) ? 90 : (n.rest < 30 ? 50 : 0) },
      /* Dusk is a routine, not just a hunger call: a well-fed gnome still goes to tend the patch once it wakes. */
      { type: 'shrooms', score: urg(n.food) * 1.2 + (!drowsy(a) ? 25 : 0) }, { type: 'eat', score: urg(n.food) * 0.6 },
      { type: 'huddle', score: urg(n.social) * 0.8 },
      { type: 'repay', score: a.den && a.den.holding && tick - a.den.holding.since >= 2 * DAY ? 80 : 0 }, { type: 'borrow', score: !drowsy(a) && a.den && a.den.bench && !a.den.holding && n.food > 40 ? 40 + a.traits.curiosity * 30 : 0 },
      { type: 'wander', score: drowsy(a) ? 2 : 10 }];
  } else if (a.species === 'wolf'){
    const hungry = isWinter() ? 75 : 65;
    opts = [{ type: 'flee', score: threatsFor(a).length ? 100 : 0 }, { type: 'raid', score: night && n.food < hungry ? 75 : 0 }, { type: 'stalk', score: night && n.food < 35 && a.traits.bravery > 0.5 ? 70 : 0 }, { type: 'hunt', score: n.food < 55 ? 55 + (55 - n.food) : 0 }, { type: 'scavenge', score: n.food < 70 ? 45 : 0 },
      { type: 'drink', score: urg(n.water) }, { type: a.den ? 'home' : 'rest', score: n.rest < 40 ? 50 : (drowsy(a) ? 40 : 0) }, { type: 'wander', score: drowsy(a) ? 4 : 14 }];
  } else {
    opts = [{ type: 'flee', score: threatsFor(a).length ? 100 : 0 }, { type: 'hunt', score: n.food < 55 ? 60 + (55 - n.food) : 0 }, { type: 'scavenge', score: n.food < 70 ? 45 : 0 },
      { type: 'drink', score: urg(n.water) }, { type: a.den ? 'home' : 'rest', score: n.rest < 40 ? 50 : (drowsy(a) ? 35 : 0) }, { type: 'wander', score: drowsy(a) ? 4 : 12 }];
  }
  for (const o of opts) o.score = Math.round(o.score + rng() * 6);
  opts.sort((x, y) => y.score - x.score);
  a.lastChoice = { tick, opts, picked: null };
  for (const o of opts){
    if (o.score <= 0 && o.type !== 'wander') continue;
    const key = o.label || o.type;
    if ((a.cooldown[key] || 0) > tick){ o.failed = true; continue; }
    const ok = o.type === 'work' ? o.start(a) : o.type === 'join' ? startJoin(a) : o.type === 'deliver' ? startDeliver(a) : START[o.type](a);
    if (ok){ a.lastChoice.picked = key; if (a.task){ a.task.started = tick; a.task.key = key; } return; }
    o.failed = true; a.cooldown[key] = tick + 60;
  }
}
function runTask(a){
  const t = a.task; a.status = t.label;
  if (t.wait > 0){ t.wait--; return; }
  if (t.path.length){
    if (a.inDark){ a.darkStep = !a.darkStep; if (a.darkStep) return; }
    const [nx, ny, nz] = t.path[0];
    if (!passable(nx, ny, nz)){ a.cooldown[t.key] = tick + 40; failTask(a); return; }
    a.x = nx; a.y = ny; a.z = nz; t.path.shift();
    if (a.species === 'rabbit') checkSnare(a); else if (a.species === 'deer'){ const dt = tileAt(a.x, a.y, a.z); if (dt) dt.deer = (dt.deer || 0) + 1; checkPitfall(a); }
    return;
  }
  const r = t.arrive(a, t);
  if (r === 'done') endTask(a);
  else if (r === 'fail'){ a.cooldown[t.key] = tick + 120; failTask(a); }
  if (a.task) a.status = a.task.label;
}
function checkSnare(r){
  const t = tileAt(r.x, r.y, r.z);
  if (t.struct && t.struct.type === 'snare' && t.struct.snare.armed && rng() < (t.struct.snare.chance || 0.7) + (t.struct.snare.camp.fae.favor >= 30 ? 0.1 : 0)){
    const s = t.struct.snare; s.armed = false; s.catch = 'carcass'; r.alive = false; r.status = 'Dead';
    log('A rabbit is caught in a snare.', [], 'good');
  }
}
/* A deer that steps onto a pit is caught one time in eight. */
function checkPitfall(d){
  const t = tileAt(d.x, d.y, d.z);
  if (t && t.struct && t.struct.type === 'pitfall' && !t.struct.pit.catch && rng() < 0.125){
    const p = t.struct.pit; p.catch = 'venison'; d.alive = false; d.status = 'Dead';
    log('A deer falls into the pit.', [], 'good');
    for (const o of beings) if (o.alive && o.species === 'deer' && near(o, d) <= 10) addThought(o, 'herdloss', 'One of the herd was taken', -6, 1200);
  }
}
function updateBeing(a){
  const sp = SPECIES[a.species], n = a.needs, night = isNight();
  if (a.camp) camp = a.camp;
  for (const k in sp.decay) n[k] = Math.max(0, n[k] - sp.decay[k] * (k === 'rest' && a.asleep ? -6 : 1));
  if (a.species === 'human'){
    const hereTile = tileAt(a.x, a.y, a.z);
    const season = seasonOf(), under = a.z < 0 || !!hereTile.cave, cold = under ? 0.012 : season === 'winter' ? (night ? 0.06 : 0.025) : season === 'summer' ? 0 : (night ? 0.012 : 0.003);
    const byFire = camp && pitLit() && nearAt(a, ...camp.pit) <= 3, roofed = under || hasTile(a.x, a.y, a.z + 1) || (camp && sleepPlaces().some(pl => nearAt(a, ...pl) <= 1));
    n.warmth = clamp(n.warmth - cold * (1.3 - a.traits.hardiness * 0.6) * (weather.storm && !roofed ? 1.5 : 1) * (roofed ? 0.4 : 1) * (a.homeless ? 0.3 : 1) * (a.clothes ? 0.6 : 1) * (stage(a) === 'adult' ? 1 : 1.3) + (byFire ? 0.5 : 0), 0, 100);
    if (n.warmth < 20){ addThought(a, 'cold', 'Is freezing', -15, 50); a.hp -= 0.03; }
    if (weather.storm && !roofed && !a.asleep) addThought(a, 'wet', 'Soaked by the rain', -4, 300);
    else if (weather.storm && roofed && a.z >= 0) addThought(a, 'dry', 'Dry under the roof while it pours', 3, 300);
    /* Gnomes are drowsy from hour 6 to 19, and the sighting predicate already requires !drowsy(b); skip the
       scan of every being outright in those hours, so a camp waiting to learn of its neighbours is not paying
       a per-tick cost with no chance of a hit. */
    if (camp && !camp.gnomes.known && !a.asleep && !(hourOf() >= 6 && hourOf() < 19)){ const g = beings.find(b => b.alive && b.species === 'gnome' && !b.asleep && !drowsy(b) && near(b, a) <= 6); if (g){ camp.gnomes.known = true; log(`${a.name} sees a small figure in the dusk, no taller than a child, with a pack on its back. It is gone before ${a.name} can speak. There are neighbours under the meadow.`, campHumans(), 'major'); addThought(a, 'gnome', 'Saw one of the small neighbours', 3, 900); } }
    { const here = hereTile; if (here && here.cave && here.cave.kind === 'burrow' && here.cave.owner === 'gnome' && !(a.cooldown.disturb > tick)){ here.cave.disturbed++; here.cave.disturbedBy = camp; a.cooldown.disturb = tick + 1000; addThought(a, 'burrow', 'Crept into the neighbours\' hole. It felt wrong', -4, 800); for (const g of beings) if (g.alive && g.species === 'gnome' && g.den === here.cave) addThought(g, 'intruder', 'A big one came into the hole', -10, 2000); } }
  }
  if (a.asleep) n.rest = Math.min(100, n.rest);
  if (a.den) defendDen(a);
  for (const t of a.thoughts) t.left--; a.thoughts = a.thoughts.filter(t => t.left > 0);
  if (n.food <= 0 || (n.water !== undefined && n.water <= 0)){ a.hp -= 0.04; if (a.species === 'human') addThought(a, 'starving', n.water <= 0 ? 'Is dying of thirst' : 'Is starving', -25, 50); }
  else if (a.hp < 100) a.hp = Math.min(100, a.hp + 0.01 * (0.6 + a.traits.hardiness * 0.8));
  if (a.species === 'human' && a.lastHurtAt && tick - a.lastHurtAt > 600){ a.lastHurt = null; a.lastHurtAt = null; }
  /* The life clock. Past the usual span, each day is a gift. */
  if (ageDays(a) > LIFE[a.species].life && rng() < 0.0006 / (0.5 + a.traits.hardiness)){
    const warm = a.species === 'human' && camp && pitLit() && nearAt(a, ...camp.pit) <= 4;
    die(a, a.species === 'human' ? (warm ? 'died in their sleep, old and warm by the fire' : 'died of old age') : 'died of old age'); return;
  }
  const here = tileAt(a.x, a.y, a.z);
  if (here.fire > 0){ a.hp -= 2.5; a.asleep = false; if (a.species === 'human' && !hasThought(a, 'burned')) log(`${a.name} is caught in the flames.`, [a], 'bad'); addThought(a, 'burned', 'Was burned by fire', -20, 800); if (!hasThought(a, 'burned')) drift(a, 'bravery', -0.02); if (!a.task || a.task.type !== 'flee'){ failTask(a); START.flee(a); } }
  if (a.hp <= 0){ die(a, here.fire > 0 ? 'burned to death' : n.water !== undefined && n.water <= 0 ? 'died of thirst' : n.food <= 0 ? 'starved to death' : n.warmth !== undefined && n.warmth < 20 ? 'froze in the cold' : (a.lastHurt || 'died')); return; }
  if (a.species === 'human' && camp && pitLit() && nearAt(a, ...camp.pit) <= 3) addThought(a, 'warm', 'Warm by the fire', 5, 200);
  if (a.asleep){
    if (n.rest >= 100 || (!night && n.rest >= 60)){ a.asleep = false; if (a.species === 'human'){ const roof = camp && sleepPlaces().some(pl => nearAt(a, ...pl) <= 1), warm = camp && pitLit() && nearAt(a, ...camp.pit) <= 4; addThought(a, 'slept', roof ? 'Slept under a roof' : warm ? 'Slept warm beside the fire' : 'Slept cold on the bare ground', roof ? 6 : warm ? 3 : -4, 600); } }
    else { a.status = 'Sleeping'; return; }
  }
  /* Below the surface it is dark. Without a burning ember a person cannot see to work, and feels their way out at half speed. */
  a.inDark = a.species === 'human' && a.z < 0 && !(a.carrying && a.carrying.kind === 'ember');
  if (a.inDark){
    if (!hasThought(a, 'dark')) addThought(a, 'dark', 'It is too dark down here to see', -6, 400);
    /* No work in the dark: any task that is not a walk back to the light fails, and the walk is slow. */
    if (a.task && a.task.type !== 'flee' && !(a.task.path.length && a.task.path[a.task.path.length - 1][2] >= 0)) failTask(a);
  }
  const fast = a.task && a.task.fast;
  if (!fast && (tick + a.id) % sp.stride) return;
  if (a.carrying && a.carrying.kind === 'ember' && tick > a.carrying.dies){ a.carrying = null; failTask(a); log(`The ember ${a.name} carried goes dark before it reaches the pit.`, [a], 'bad'); addThought(a, 'emberlost', 'Lost the ember on the way', -5, 500); }
  if (a.species === 'human' && fireCount > 0 && (!a.task || (a.task.type !== 'flee' && a.task.type !== 'ember' && a.task.type !== 'guard'))){
    const d = nearestFire(a.x, a.y, 5, a.z);
    if (d >= 0){ addThought(a, 'sawfire', 'Saw a wildfire close by', -Math.round(4 + 10 * (1 - a.traits.bravery)), 400); if (d <= 2){ failTask(a); START.flee(a); } }
  }
  if (a.species === 'human' && (!a.task || (a.task.type !== 'flee' && a.task.type !== 'guard')) && threatsFor(a).some(([x, y]) => beings.some(b => b.alive && b.species === 'wolf' && b.x === x && b.y === y))){ addThought(a, 'sawwolf', 'A wolf came too close', -8, 600); failTask(a); START.flee(a); a.task && (a.task.label = 'Running from a wolf'); }
  if (a.species !== 'human' && a.task && a.task.type !== 'flee' && a.task.type !== 'hunt' && a.task.type !== 'stalk' && threatsFor(a).length){ failTask(a); }
  if (a.task && a.task.type !== 'flee'){
    if (a.species === 'human'){
      /* Sitting warms and soothes but never feeds or waters, so it must not block the force below: someone left
         sitting by the fire while their food or water runs out needs to be pulled off it, not left to starve there. */
      const busy = ['drink', 'eat', 'sleep'].includes(a.task.type);
      const force = busy ? null : (n.water < 15 && !(a.cooldown.drink > tick)) ? 'drink'
        : (n.food < 15 && !(a.cooldown.eat > tick)) ? 'eat'
        : (a.task.type !== 'sit' && n.warmth < 30 && !a.homeless && camp && pitLit() && !(a.cooldown.sit > tick)) ? 'sit' : null;
      if (force){ failTask(a); if (START[force](a)){ a.task.started = tick; a.task.key = force; } else a.cooldown[force] = tick + 120; }
    }
    if (a.task && tick - (a.task.started || tick) > 1500) failTask(a);
  }
  if (!a.task) chooseTask(a);
  if (a.task) runTask(a);
}
