function takeName(){ if (!namePool.length) namePool = shuffle(NAMES); return namePool.pop(); }

/* ---------- beings ---------- */
/** @returns {Being} */
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
    /* `seen` is the tick this being's body was last brought up to, and `next` the tick it acts again.
       See `catchUp` below. A fresh being is up to date and acts at once. */
    seen: tick, next: tick,
    /* How many tagged lines this person stands in, by tag. `log` counts them. The history holds
       only the last forty lines, so a deed read back out of it is gone within a day or two; this
       count is what an epithet reads. Plain numbers, and nothing but an epithet reads it. */
    deeds: {},
  };
  if (species === 'human') b.needs.warmth = 80 + rint(20);
  if (species === 'human') b.clothes = false;
  if (species !== 'human') b.name = `${sp.label[0].toUpperCase()}${sp.label.slice(1)} ${b.id}`;
  if (species === 'sprite'){ b.hp = 30; b.grove = null; b.returnAt = 0; b.target = null; }
  if (species === 'fox' || species === 'wolf') b.den = null;
  if (species === 'gnome') b.den = null;
  return b;
}
/** @returns {Being|undefined} */
const beingById = id => beings.find(b => b.id === id);
const humans = () => beings.filter(b => b.species === 'human' && b.alive);
/* The first person of the world. The gods come into being before the people, so beings[0] is a god. */
const firstPerson = () => beings.find(b => b.species === 'human');
/* A thought holds `until`, the tick it is gone on, and no longer counts down. The head used to
   subtract one from every thought of every being on every tick, which is arithmetic a comparison does
   for free. `at` is the tick the thought was had on: a stretch of world time brought up to date in one
   go had it on the last tick of the stretch, and not on the tick the bringing up to date happens to
   run. A thought now lasts `dur` ticks exactly. The head counted down after it had added this tick's,
   so a thought used to be one tick shorter than its duration said; that tick is not worth keeping. */
function thoughtAt(a, at, key, text, value, dur){
  const until = at + dur;
  const t = a.thoughts.find(t => t.key === key);
  if (t){ t.until = until; t.value = value; t.text = text; } else a.thoughts.push({ key, text, value, until });
}
function addThought(a, key, text, value, dur){ thoughtAt(a, tick, key, text, value, dur); }
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
function dropCarried(a){
  if (!a.carrying) return;
  const c = a.carrying; a.carrying = null;
  if (c.kind === 'berries' || c.kind === 'cooked' || c.kind === 'ember' || c.kind === 'water' || c.kind === 'spear') return;
  if (c.kind === 'fibre' || c.kind === 'clay' || c.kind === 'cuttings') return;
  if (c.kind === 'moss'){ for (let k = 0; k < c.count; k++) addItem('moss', a.x, a.y, a.z); return; }
  for (let k = 0; k < c.count; k++) addItem(c.kind, a.x, a.y, a.z);
}
/* `tag` is what kind of death it was, for the event table. `diedAt` is the tick, for the chronicle
   and for anything that asks how long ago somebody died. Both are data. Nothing reads the cause text. */
function die(a, cause, tag = 'death'){
  failTask(a); a.alive = false; a.asleep = false; a.status = 'Dead'; a.diedAt = tick;
  giveFate(a, tag);
  if (a.species === 'human'){
    corpses.push({ x: a.x, y: a.y, z: a.z, name: a.name });
    log(`${a.name} ${cause}.`, [a], 'death', tag);
    for (const o of humans()){
      if (o.camp !== a.camp) continue;
      const op = o.opinions[a.id] || 0;
      if (op >= 25) addThought(o, 'grief' + a.id, `Grieves for ${a.name}`, -30, CLOCK.thought.grief);
      else addThought(o, 'loss' + a.id, `Sad about the death of ${a.name}`, -8, CLOCK.thought.loss);
    }
  } else if (a.species === 'rabbit'){ addItem('carcass', a.x, a.y, a.z); }
  else if (a.species === 'sprite'){
    const g = a.grove; if (g){ g.anger = Math.min(100, g.anger + 60); g.swarmUntil = tick + CLOCK.limit.swarm; for (const c of camps) if (c.site && nearAt(a, ...c.site) <= 40){ c.fae.favor = Math.max(-100, c.fae.favor - 40); c.fae.blightUntil = tick + CLOCK.limit.blight; } }
    log(`A sprite dies. Its light goes out, and the grove will remember.`, humans().filter(h => near(h, a) <= 12), 'bad');
    for (const o of beings) if (o.alive && o.species === 'sprite' && o.grove === g) addThought(o, 'kin', 'One of us was killed by humans', -20, CLOCK.thought.kin);
  }
  else if (a.species === 'deer'){ addItem('venison', a.x, a.y, a.z); for (const o of beings) if (o.alive && o.species === 'deer' && near(o, a) <= 10){ addThought(o, 'herdloss', 'One of the herd was taken', -6, CLOCK.thought.herdloss); o.skills.wary = Math.min(3, (o.skills.wary || 0) + 1); } }
  else if (a.species === 'gnome'){ log(`A gnome ${cause}.`, [], 'death'); }
}
function chat(a, b){
  const compat = 1 - Math.abs(a.traits.sociability - b.traits.sociability) - 0.8 * Math.abs(a.traits.temper - b.traits.temper);
  const delta = Math.round(compat * 12 - 1 - (a.traits.temper + b.traits.temper) * 3 + (rng() * 8 - 4));
  a.needs.social = Math.min(100, a.needs.social + 35); b.needs.social = Math.min(100, b.needs.social + 25);
  for (const [p, q] of [[a, b], [b, a]]){
    p.opinions[q.id] = clamp((p.opinions[q.id] || 0) + delta, -100, 100);
    addThought(p, 'chat' + q.id, delta >= 0 ? `Talked with ${q.name} by the fire` : `Argued with ${q.name}`, delta >= 0 ? 3 + Math.round(p.traits.sociability * 4) : -5, CLOCK.thought.chat);
    drift(p, delta >= 0 ? 'sociability' : 'temper', 0.01);
  }
  const op = (a.opinions[b.id] + b.opinions[a.id]) / 2;
  if (op >= 40 && a.rel[b.id] !== 'friend'){ a.rel[b.id] = b.rel[a.id] = 'friend'; log(`${a.name} and ${b.name} are now friends.`, [a, b], 'good'); }
  else if (op <= -40 && a.rel[b.id] !== 'rival'){ a.rel[b.id] = b.rel[a.id] = 'rival'; log(`${a.name} and ${b.name} can no longer stand each other.`, [a, b], 'bad'); }
}

/* The base kinds. Each begin is what the old closure task did before it built the task. */
Object.assign(TASKS, {
  drink: { type: 'drink',
    begin(a, args){
      if (a.species === 'human' && !a.homeless && camp.stash.water > 0 && camp.stashTile){
        const [sx, sy] = camp.stashTile; const p = pathToStop(a, sx, sy, 1);
        if (p){ args.at = [sx, sy]; return { label: 'Going to drink at camp', path: p }; }
      }
      /* The near country first. A camp can stand far from any water, so a failed near search walks the whole
         world once and covers the first stretch, the same way pathToStop does. Thirst must never have no answer. */
      const wet = (x, y, z) => !!nearFind(x, y, t => t.ground === 'water', NEAR, z);
      const walkFar = a => { const q = bfs(a.x, a.y, a.z, wet, NZ * W * H, a); return q ? q.slice(0, 48) : null; };
      let p = bfs(a.x, a.y, a.z, wet, 3000, a), far = false;
      if (!p){ p = walkFar(a); if (!p) return false; far = true; }
      if (far && a.species === 'human') addThought(a, 'farwater', 'Walking a long way for water', -3, CLOCK.thought.farwater);
      return { label: far ? 'Walking a long way for water' : 'Going to drink', path: p };
    },
    stops: [(a, t) => {
      const wet = (x, y, z) => !!nearFind(x, y, w => w.ground === 'water', NEAR, z);
      if (t.args.at){
        const [sx, sy] = t.args.at;
        const g = goTo(a, t, sx, sy, 1); if (g) return g;
        if (camp.stash.water <= 0) return 'fail';
        camp.stash.water--; a.needs.water = 100; addThought(a, 'drank', 'Drank at the fire without a long walk', 3, CLOCK.thought.drank); return 'done';
      }
      if (!wet(a.x, a.y, a.z)){
        const walkFar = a => { const q = bfs(a.x, a.y, a.z, wet, NZ * W * H, a); return q ? q.slice(0, 48) : null; };
        const q = walkFar(a); if (!q) return 'fail';
        t.path = q; t.label = 'Walking a long way for water'; return 'continue';
      }
      a.needs.water = 100; if (a.species === 'human'){ addThought(a, 'drank', 'Drank cold river water', 2, CLOCK.thought.drank); namePondHere(a); } return 'done';
    }] },
  eat: { type: 'eat',
    begin(a, args){
      if (a.species === 'human' && !a.homeless && camp.stashTile && stashFood() > 0){
        const [sx, sy] = camp.stashTile; const p = pathToStop(a, sx, sy, 1);
        if (p){ args.at = [sx, sy]; return { label: 'Going to eat at camp', path: p }; }
      }
      let hasFood = a.species === 'rabbit' ? (t => t.ground === 'grass' && !t.feature || t.feature === 'bush' || t.feature === 'reeds') : (t => t.feature === 'bush' && t.berries > 0);
      let p = null;
      if (a.species === 'rabbit'){ const bushy = t => t.feature === 'bush' && t.berries > 0; p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, bushy, NEAR, z), 400, a); if (p){ hasFood = bushy; args.food = 'bush'; } }
      if (!p) p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, hasFood, NEAR, z), a.species === 'rabbit' ? 200 : 2500, a); if (!p) return false;
      if (a.species === 'rabbit' && !args.food) args.food = 'graze';
      return { label: a.species === 'rabbit' ? 'Looking for grass' : 'Going to eat berries', path: p, progress: 0 };
    },
    stops: [(a, t) => {
      if (t.args.at){
        const [sx, sy] = t.args.at;
        const g = goTo(a, t, sx, sy, 1); if (g) return g;
        if (camp.stash.cooked > 0){ stashTake('cooked'); a.needs.food = Math.min(100, a.needs.food + 55); addThought(a, 'ate', camp.bestCook > 1 ? 'Ate a meal cooked with real skill' : 'Ate a hot meal of rabbit', 7 + Math.min(4, camp.bestCook || 0), CLOCK.thought.ateCooked); }
        else if (camp.stash.smoked > 0){ stashTake('smoked'); a.needs.food = Math.min(100, a.needs.food + 45); addThought(a, 'ate', 'Chewed smoked meat by the fire', 4, CLOCK.thought.ateSmoked); }
        else if (camp.stash.berries > 0){ stashTake('berries'); a.needs.food = Math.min(100, a.needs.food + 28); addThought(a, 'ate', 'Ate berries from the stash', 2, CLOCK.thought.ateBerries); }
        else return 'fail';
        return a.needs.food < 60 && stashFood() > 0 ? 'continue' : 'done';
      }
      const hasFood = t.args.food === 'bush' ? (tl => tl.feature === 'bush' && tl.berries > 0)
        : t.args.food === 'graze' ? (tl => tl.ground === 'grass' && !tl.feature || tl.feature === 'bush' || tl.feature === 'reeds')
        : (tl => tl.feature === 'bush' && tl.berries > 0);
      const b = nearFind(a.x, a.y, hasFood, NEAR, a.z); if (!b) return 'fail';
      if (a.species === 'rabbit'){ t.label = 'Nibbling grass'; if (++t.progress < CLOCK.task.nibble) return 'continue'; a.needs.food = Math.min(100, a.needs.food + 45); if (b.feature === 'bush' && b.berries > 0) b.berries--; return 'done'; }
      b.berries--; a.needs.food = Math.min(100, a.needs.food + 25); addThought(a, 'ate', 'Ate berries off the bush', 2, CLOCK.thought.ateBerries);
      return a.needs.food < 60 && b.berries > 0 ? 'continue' : 'done';
    }] },
  socialize: { type: 'socialize',
    begin(a, args){
      const others = humans().filter(o => o !== a && !o.asleep && o.camp === a.camp);
      if (!others.length) return false;
      let target = null;
      const p = bfs(a.x, a.y, a.z, (x, y, z) => { target = others.find(o => o.z === z && dist(o.x, o.y, x, y) <= 1); return !!target; }, 1500, a); if (!p) return false;
      args.with = target.id;
      return { label: `Going to talk to ${target.name}`, path: p, progress: 0 };
    },
    stops: [(a, t) => {
      const target = beingById(t.args.with);
      if (!target || !target.alive || near(target, a) > 2) return 'fail';
      t.label = `Talking with ${target.name}`; if (++t.progress < CLOCK.task.talk) return 'continue'; chat(a, target); return 'done';
    }] },
  shelter: { type: 'shelter',
    begin(a, args){
      if (!camp.shelter || a.homeless) return false; const [hx, hy] = camp.shelter; const p = pathToStop(a, hx, hy, 1); if (!p) return false;
      args.at = [hx, hy];
      return { label: 'Waiting out the rain under the roof', path: p, progress: 0 };
    },
    stops: [(a, t) => {
      const [hx, hy] = t.args.at;
      const g = goTo(a, t, hx, hy, 1); if (g) return g;
      return ++t.progress < CLOCK.task.shelterWait && weather.storm ? 'continue' : 'done';
    }] },
  sit: { type: 'sit',
    begin(a, args){
      if (!pitLit() || a.homeless) return false;
      const [px, py] = camp.pit; const p = pathToStop(a, px, py, 1); if (!p) return false;
      args.at = [px, py];
      return { label: 'Going to sit by the fire', path: p, progress: 0 };
    },
    stops: [(a, t) => {
      const [px, py] = t.args.at;
      const g = goTo(a, t, px, py, 1); if (g) return g;
      t.label = 'Sitting by the fire'; a.needs.rest = Math.min(100, a.needs.rest + CLOCK.rate.sitRests);
      if (t.progress % CLOCK.task.sitChat === 0){ const o = humans().find(o => o !== a && near(o, a) <= 2 && o.task && o.task.type === 'sit'); if (o) chat(a, o); }
      if (a.needs.warmth !== undefined) a.needs.warmth = Math.min(100, a.needs.warmth + CLOCK.rate.sitWarms);
      if (t.progress % CLOCK.task.sitTeach === CLOCK.task.sitTeachAt){
        const teacher = humans().find(o => o !== a && near(o, a) <= 2 && o.task && o.task.type === 'sit' && Object.keys(o.skills).some(k => o.skills[k] > (a.skills[k] || 0) + 1));
        if (teacher){ const sk = Object.keys(teacher.skills).filter(k => teacher.skills[k] > (a.skills[k] || 0) + 1).sort((p, q) => teacher.skills[q] - teacher.skills[p])[0]; teacher.taught = (teacher.taught || 0) + 1; a.xp[sk] = (a.xp[sk] || 0) + (stage(teacher) === 'old' ? 1.2 : 0.6) * (0.5 + a.traits.curiosity); addThought(a, 'taught', `Learned about ${sk === 'trap' ? 'trapping' : sk + 'ing'} from ${teacher.name}`, 3, CLOCK.thought.taught); if (a.xp[sk] >= (a.skills[sk] + 1) * 3){ a.xp[sk] = 0; a.skills[sk]++; log(`${a.name} learned ${sk === 'trap' ? 'trapping' : sk + 'ing'} from ${teacher.name} by the fire.`, [a, teacher], 'good'); } }
      }
      return ++t.progress < CLOCK.task.sit && pitLit() ? 'continue' : 'done';
    }] },
  rest: { type: 'rest',
    begin(a){ return { label: a.species === 'rabbit' ? 'Resting in the grass' : 'Dozing', wait: CLOCK.task.doze }; },
    stops: [a => { a.needs.rest = Math.min(100, a.needs.rest + 40); return 'done'; }] },
  wander: { type: 'wander',
    begin(a){
      for (let k = 0; k < 6; k++){
        const tx = a.x + rint(11) - 5, ty = a.y + rint(11) - 5; if (!passable(tx, ty, a.z)) continue;
        const p = bfs(a.x, a.y, a.z, (x, y, z) => x === tx && y === ty && z === a.z, 250, a);
        if (p) return { label: a.species === 'human' ? 'Wandering' : 'Roaming', path: p };
      }
      return { label: 'Standing still', wait: CLOCK.task.standStill };
    },
    stops: [() => 'done'] },
  flee: { type: 'flee',
    begin(a){
      const threats = threatsFor(a); if (!threats.length) return false;
      let best = null;
      for (let k = 0; k < 14; k++){
        const tx = a.x + rint(13) - 6, ty = a.y + rint(13) - 6; if (!passable(tx, ty, a.z)) continue;
        const md = Math.min(...threats.map(([x, y]) => dist(tx, ty, x, y)));
        if (!best || md > best.md) best = { tx, ty, md };
      }
      if (!best) return false;
      const p = bfs(a.x, a.y, a.z, (x, y, z) => x === best.tx && y === best.ty && z === a.z, 250, a); if (!p) return false;
      return { label: a.species === 'human' ? 'Running from the fire' : 'Bolting', path: p, fast: true };
    },
    stops: [() => 'done'] },
  sleep: { type: 'sleep',
    begin(a){
      const place = a.species === 'human' && !a.homeless && sleepPlaces().filter(pl => beings.filter(b => b.alive && b.asleep && nearAt(b, ...pl) <= 1).length < 3).sort((p, q) => nearAt(a, ...p) - nearAt(a, ...q))[0];
      if (place && nearAt(a, ...place) > 1){
        const p = pathToStop(a, place[0], place[1], 1);
        if (p) return { label: 'Going to the lean-to', path: p };
      }
      a.asleep = true; a.task = null; a.status = 'Sleeping'; return true;
    },
    stops: [a => { a.asleep = true; a.task = null; return 'done'; }] },
});

/* Every being that can be a threat to another: a person, a fox, or a wolf. Read the six branches of
   `threatsFor` below and no other species appears as a source. A valley holds seventy beings or more,
   most of them rabbits and sprites, and `threatsFor` runs for every being on every tick, which is
   ruling 6. Walking a list of three to eight instead of a list of seventy is two of the six seconds a
   world day cost.

   The list may be kept between calls, and what makes that safe is spelt out because a stale list here
   would be a wolf nobody saw:
     a being pushed onto `beings`     `beings.length` grows, and the list is rebuilt
     the prune, or a loaded save      `beings` is a new array, and the list is rebuilt
     a being that dies mid-tick       every branch below reads `b.alive` for itself
     the tick moving on               the list is rebuilt
   A being cannot leave `beings` inside a tick: the one filter is the prune, which is the last thing a
   step does. A being can join, and the length catches it. The three checks are two integers and one
   reference, and they are cheaper than the loop they save. `threatSources` and its two keys hold no
   record a snapshot must keep and are in NOT_SAVED.

   `near` is also moved after the species test in the rabbit and the deer branch, which worked out a
   distance to every being in the valley before asking whether it could matter. Same answer, same
   order: `near` is arithmetic on two records. */
let threatSources = [], threatSourcesAt = -1, threatSourcesOf = null, threatSourcesLen = -1;
function sourcesNow(){
  if (threatSourcesAt !== tick || threatSourcesOf !== beings || threatSourcesLen !== beings.length){
    threatSourcesAt = tick; threatSourcesOf = beings; threatSourcesLen = beings.length;
    threatSources = beings.filter(b => b.species === 'human' || SPECIES[b.species].hunter);
  }
  return threatSources;
}
function threatsFor(a){
  const out = [];
  const timid = a.traits.bravery < 0.3 ? 2 : a.traits.bravery > 0.7 ? -1 : 0, wary = Math.min(3, a.skills.wary || 0);
  const f = nearestFire(a.x, a.y, 4, a.z); if (f >= 0) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (hasTile(a.x + dx, a.y + dy, a.z) && tileAt(a.x + dx, a.y + dy, a.z).fire > 0) out.push([a.x + dx, a.y + dy]);
  const ember = b => b.carrying && b.carrying.kind === 'ember';
  if (a.species === 'rabbit') for (const b of sourcesNow()){ if (!b.alive || b === a) continue; const hunts = b.species === 'fox' || b.species === 'wolf', person = b.species === 'human'; if (!hunts && !person) continue; const d = near(b, a); if ((hunts && d <= 6 + timid + wary) || (person && d <= 2 + wary && !b.asleep)) out.push([b.x, b.y]); }
  if (a.species === 'deer') for (const b of sourcesNow()){ if (!b.alive || b === a) continue; const hunts = b.species === 'wolf', person = b.species === 'human'; if (!hunts && !person) continue; const d = near(b, a); if ((hunts && d <= 8 + timid + wary) || (person && d <= (b.carrying && b.carrying.kind === 'spear' ? 6 : 3) + timid + wary && !b.asleep)) out.push([b.x, b.y]); }
  if (a.species === 'fox' || a.species === 'wolf'){
    const r = a.species === 'fox' ? 3 : 1;
    for (const b of sourcesNow()){ if (b.alive && b.species === 'human' && near(b, a) <= (ember(b) ? 7 : r)) out.push([b.x, b.y]); }
    for (const c of camps) if (c.pit && ((tileAt(...c.pit).struct.lit && nearAt(a, ...c.pit) <= (a.species === 'fox' ? 6 : 8)) || (a.shyOf === c && (a.cooldown.raid || 0) > tick && nearAt(a, ...c.pit) <= 20))) out.push(c.pit);
  }
  if (a.species === 'human') for (const b of sourcesNow()){ if (b.alive && b.species === 'wolf' && near(b, a) <= 3 && !ember(a)) out.push([b.x, b.y]); }
  if (a.species === 'sprite'){
    for (const b of sourcesNow()){ if (b.alive && b.species === 'human' && (b.carrying && (b.carrying.kind === 'spear' || b.carrying.kind === 'ember')) && near(b, a) <= 5 + timid) out.push([b.x, b.y]); }
    for (const c of camps) if (c.ward && c.pit && nearAt(a, ...c.pit) <= 9) out.push(c.pit);
  }
  if (a.species === 'gnome'){
    for (const b of sourcesNow()){ if (!b.alive) continue; if (b.species === 'human' && ember(b) && near(b, a) <= 5) out.push([b.x, b.y]); if (b.species === 'wolf' && near(b, a) <= 6) out.push([b.x, b.y]); }
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
    else for (const o of offersFor(a)){ if (stage(a) === 'young' && /hunt|wolf|lead a party|cut a tree|ember/.test(o.label)) continue; opts.push({ type: 'work', label: o.label, goal: o.goal, task: o.task, score: (o.score + tr.diligence * 25 - low) * poke * (stage(a) === 'young' ? 0.7 : 1) }); }
    if (a.carrying) opts.push({ type: 'deliver', score: 95 });
  } else if (a.species === 'rabbit'){
    opts = [{ type: 'flee', score: threatsFor(a).length ? 120 : 0 }, { type: 'eat', score: urg(n.food) * (drowsy(a) ? 0.6 : 1.2) }, { type: 'rest', score: n.rest < 40 || weather.storm ? 50 : drowsy(a) ? 35 : 0 }, { type: 'wander', score: drowsy(a) ? 4 : 12 }];
  } else if (a.species === 'deer'){
    opts = [{ type: 'flee', score: threatsFor(a).length ? 120 : 0 }, { type: 'eat', score: urg(n.food) * (drowsy(a) ? 0.6 : 1.2) }, { type: 'drink', score: urg(n.water) }, { type: 'herd', score: 22 + a.traits.sociability * 20 }, { type: 'rest', score: n.rest < 40 || weather.storm ? 50 : drowsy(a) ? 35 : 0 }, { type: 'wander', score: drowsy(a) ? 4 : 12 }];
  } else if (a.species === 'sprite'){
    const home = a.grove ? nearAt(a, a.grove.x, a.grove.y) : 0, swarm = a.grove && a.grove.swarmUntil > tick, back = a.returnAt && tick > a.returnAt;
    if (back){ a.returnAt = 0; if (a.target){ a.target.fae.favor -= 15; for (const o of beings) if (o.alive && o.species === 'sprite' && o.grove === a.grove) addThought(o, 'raid', 'We go back together', 6, CLOCK.thought.raid); if (a.grove) a.grove.swarmUntil = Math.max(a.grove.swarmUntil, tick + CLOCK.limit.swarmReturn); } }
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
      { type: 'repay', score: a.den && a.den.holding && tick - a.den.holding.since >= CLOCK.limit.gnomeHolds ? 80 : 0 }, { type: 'borrow', score: !drowsy(a) && a.den && a.den.bench && !a.den.holding && n.food > 40 ? 40 + a.traits.curiosity * 30 : 0 },
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
    const ok = o.type === 'work' ? startTask(a, o.task.kind, o.task.args) : o.type === 'join' ? startTask(a, 'join') : o.type === 'deliver' ? startTask(a, 'deliver') : startTask(a, o.type);
    if (ok){ a.lastChoice.picked = key; if (a.task){ a.task.started = tick; a.task.key = key; } return; }
    o.failed = true; a.cooldown[key] = tick + CLOCK.cooldown.offerFailed;
  }
}
function rollSnare(r){
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
    for (const o of beings) if (o.alive && o.species === 'deer' && near(o, d) <= 10) addThought(o, 'herdloss', 'One of the herd was taken', -6, CLOCK.thought.herdloss);
  }
}
/* ---------- a being between acts ----------
   The head of `updateBeing` used to run on every being on every tick. At 86,400 ticks a world day it
   was most of the cost of a day, and almost all of it was arithmetic with a constant step: a need
   decays by the same amount every tick, warmth moves by the same amount, hp by the same amount. So a
   being's body is now computed from the time that has passed rather than stepped through it.

   `a.seen` is the tick a being's body was last brought up to. `catchUp(a)` brings needs, warmth, hp,
   thoughts and a sleeper's waking up to `tick`, in stretches. A stretch runs while nothing the body
   reads changes, so inside one every quantity is linear and the whole stretch is one multiplication.
   Every clamp holds across a stretch because each quantity moves one way inside it: a need only
   decays, rest only rises while asleep, warmth and hp move by a constant step. Clamping n times and
   clamping once are then the same number.

   A stretch breaks at dawn, at dusk, at the turn of a day (which is where a season turns), at a life
   stage, and, inside itself, at the tick a need reaches zero, at the tick warmth crosses the freezing
   line, at the tick hp would reach zero, and at the tick a sleeper wakes. `tests/beings-lazy.js`
   holds the old head as a reference and drives it a tick at a time against this.

   What a stretch cannot see coming it reads on the wrong side of, for at most one world minute. The
   pit lighting or going out, a storm arriving and a roof going up are the three, and the bound is
   `CLOCK.every.body`: `nextAct` never names a tick further off, so no stretch is longer than a
   minute and the error is at most 59 ticks of one rate. For the pit that is a third of a point of
   warmth out of a hundred. Task 4 lengthens stretches past a minute, and it must give those three a
   seam that brings the camp's people up to date before the change, or the bound goes with the beat.

   Nothing here draws a random number except the old-age roll, so a rule may call `catchUp` without
   moving the stream. */
const FREEZING = 20;                          // the warmth a person begins to freeze below
const WAKE_RESTED = 100, WAKE_LIGHT = 60;     // asleep until rested, or until sixty once it is light

/* The last tick that still answers the way `s + 1` does. A stretch runs from `s` to the tick this
   gives, so the turn itself — the dawn, the dusk, the new day, the new stage — is the first tick of the
   next stretch and never sits inside one that read the old side of it. Everything it names is ahead of
   `s`, so a stretch always moves. */
function bodyBreak(a, s){
  const t0 = s + 1, d = Math.floor(t0 / DAY);
  let b = (d + 1) * DAY - 1;                  // the turn of the day, and with it the turn of a season
  const lifts = d * DAY + CLOCK.night.lifts - 1, falls = d * DAY + CLOCK.night.falls - 1;
  if (lifts > s && lifts < b) b = lifts;
  if (falls > s && falls < b) b = falls;
  const L = LIFE[a.species];
  for (const g of [L.adult, L.old]){ const t = a.born + Math.round(g * DAY) - 1; if (t > s && t < b) b = t; }
  return b;
}

/* One stretch of a being's body, from `a.seen` to at most `lim`. It moves `a.seen` to where it got. */
function bodyStretch(a, lim){
  const s = a.seen, sp = SPECIES[a.species], n = a.needs;
  const night = isNight(s + 1), human = a.species === 'human', storm = weather.storm;
  /* The step each need takes on every tick of this stretch. A sleeper gains rest instead of losing it. */
  const step = {};
  for (const k in sp.decay) step[k] = sp.decay[k] * (k === 'rest' && a.asleep ? -CLOCK.rate.restsAsleep : 1);
  const w0 = human ? n.warmth : 0;
  let dW = 0, byFire = false, roofed = false;
  if (human){
    const here = tileAt(a.x, a.y, a.z);
    const season = seasonOf(dayOf(s + 1)), under = a.z < 0 || !!(here && here.cave);
    const cold = under ? CLOCK.cold.under : season === 'winter' ? (night ? CLOCK.cold.winterNight : CLOCK.cold.winterDay) : season === 'summer' ? CLOCK.cold.summer : (night ? CLOCK.cold.night : CLOCK.cold.day);
    byFire = !!(camp && pitLit() && nearAt(a, ...camp.pit) <= 3);
    roofed = under || hasTile(a.x, a.y, a.z + 1) || !!(camp && sleepPlaces().some(pl => nearAt(a, ...pl) <= 1));
    dW = -cold * (1.3 - a.traits.hardiness * 0.6) * (storm && !roofed ? 1.5 : 1) * (roofed ? 0.4 : 1) * (a.homeless ? 0.3 : 1) * (a.clothes ? 0.6 : 1) * (stage(a, s + 1) === 'adult' ? 1 : 1.3) + (byFire ? CLOCK.rate.fireWarms : 0);
  }
  /* How much of the stretch shares one answer to "is this person freezing" and "is this person out of
     food or water". Warmth moves one way and a need only decays, so each changes at most once inside
     a stretch and the tick it changes on is arithmetic. */
  let k = lim - s;
  if (human && dW !== 0){
    const j = dW < 0 ? Math.floor((w0 - FREEZING) / -dW) + 1 : Math.ceil((FREEZING - w0) / dW);
    if (j >= 2 && j - 1 < k) k = j - 1;
  }
  for (const key of ['food', 'water']){
    const v = n[key];
    if (v === undefined || !(step[key] > 0) || !(v > 0)) continue;
    const j = Math.ceil(v / step[key]);
    if (j >= 2 && j - 1 < k) k = j - 1;
  }
  /* A sleeper wakes when it is rested, or at sixty once it is light. The stretch stops on that tick. */
  if (a.asleep && step.rest < 0){
    const g = -step.rest, want = night ? WAKE_RESTED : WAKE_LIGHT;
    const j = n.rest >= want ? 1 : Math.ceil((want - n.rest) / g);
    if (j >= 1 && j < k) k = j;
  }
  /* The two predicates, read from the state one tick in. They hold for the whole stretch by the cap
     above, so hp moves by a constant step and the tick it would reach zero on is arithmetic too. */
  const cold1 = human && clamp(w0 + dW, 0, 100) < FREEZING;
  const dry = key => n[key] !== undefined && Math.max(0, n[key] - (step[key] || 0)) <= 0;
  const starving1 = dry('food') || dry('water');
  const heals = CLOCK.rate.heals * (0.6 + a.traits.hardiness * 0.8);
  const dHp = (cold1 ? -CLOCK.rate.freezeHurts : 0) + (starving1 ? -CLOCK.rate.starveHurts : heals);
  if (dHp < 0){ const j = Math.ceil(a.hp / -dHp); if (j >= 1 && j < k) k = j; }

  for (const key in step){
    const d = step[key];
    if (d > 0) n[key] = Math.max(0, n[key] - d * k);
    else if (d < 0) n[key] = Math.min(100, n[key] - d * k);
  }
  if (human) n.warmth = clamp(w0 + dW * k, 0, 100);
  /* Freezing costs hp and so does an empty stomach, and a body that is doing neither mends. The head
     took the freeze off first and then mended, so the two are one step when both apply. */
  if (starving1) a.hp -= (CLOCK.rate.starveHurts + (cold1 ? CLOCK.rate.freezeHurts : 0)) * k;
  else a.hp = Math.min(100, a.hp + dHp * k);

  const e = s + k;
  a.seen = e;
  if (cold1) thoughtAt(a, e, 'cold', 'Is freezing', -15, CLOCK.thought.cold);
  if (human && storm && !roofed && !a.asleep) thoughtAt(a, e, 'wet', 'Soaked by the rain', -4, CLOCK.thought.wet);
  else if (human && storm && roofed && a.z >= 0) thoughtAt(a, e, 'dry', 'Dry under the roof while it pours', 3, CLOCK.thought.dry);
  if (starving1 && human) thoughtAt(a, e, 'starving', n.water <= 0 ? 'Is dying of thirst' : 'Is starving', -25, CLOCK.thought.starving);
  if (a.hp <= 0){
    const frozen = n.warmth !== undefined && n.warmth < FREEZING;
    die(a, n.water !== undefined && n.water <= 0 ? 'died of thirst' : n.food <= 0 ? 'starved to death' : frozen ? 'froze in the cold' : (a.lastHurt || 'died'), frozen ? 'frost' : 'death');
    return;
  }
  if (byFire) thoughtAt(a, e, 'warm', 'Warm by the fire', 5, CLOCK.thought.warm);
  if (a.asleep && (n.rest >= WAKE_RESTED || (!night && n.rest >= WAKE_LIGHT))){
    a.asleep = false;
    if (human){
      const roof = !!(camp && sleepPlaces().some(pl => nearAt(a, ...pl) <= 1)), warm = !!(camp && pitLit() && nearAt(a, ...camp.pit) <= 4);
      thoughtAt(a, e, 'slept', roof ? 'Slept under a roof' : warm ? 'Slept warm beside the fire' : 'Slept cold on the bare ground', roof ? 6 : warm ? 3 : -4, CLOCK.thought.slept);
    }
  }
  /* A SLEEPER WHOSE FOOD OR WATER HAS RUN OUT WAKES. The force in `updateBeing` pulls a thirsty
     person off their work and sends them to drink, but it never reaches a sleeper, because a
     sleeping being returns before it. That cost nothing while water took two world days to empty:
     no night was long enough. Task 5 gave water a rate of 17 points an hour, which empties a full
     skin in under six hours, and a night is about six and a half, so a person could now run dry in
     their sleep and lie there taking the starving damage until they died. One did: Iva died of
     thirst on day 29 of seed r, asleep by the fire.

     The wake goes here, after the rested wake and guarded on still being asleep, so a person roused
     by thirst does not also get the thought that says they slept well. It adds no text of its own:
     the `starving` thought above already says "Is dying of thirst" on this same tick, and the person
     is then awake for the force to act on. It draws no random number, and the stretch already broke
     on the tick the need reached zero, so the tick is the tick it always was. */
  if (a.asleep && starving1) a.asleep = false;
  /* The life clock. Past the usual span, each day is a gift. It was rolled once a tick against a
     chance for a tick; it is rolled once a world day now, compounded over the day with `rollFor`, so
     the chance of dying in a day of world time is the chance it always was. A stretch always begins
     on the turn of a day, so exactly one stretch a day can ask it. */
  if ((s + 1) % DAY === 0 && ageDays(a, s + 1) > LIFE[a.species].life && rng() < rollFor(CLOCK.rate.oldAgeDeath / (0.5 + a.traits.hardiness), DAY)){
    const warm = human && camp && pitLit() && nearAt(a, ...camp.pit) <= 4;
    /* Two tags for the one cause, so the fate epithet says what the line says. */
    die(a, human ? (warm ? 'died in their sleep, old and warm by the fire' : 'died of old age') : 'died of old age', warm ? 'old' : 'oldCold');
  }
}

/* Bring a being's body up to this tick. Cheap when it is already there, which is the common case: a
   rule that wants to read a need may call it without thinking about the cost or about the stream. */
function catchUp(a){
  if (a.camp) camp = a.camp;
  if (typeof a.seen !== 'number' || a.seen > tick) a.seen = tick;
  while (a.alive && a.seen < tick) bodyStretch(a, Math.min(tick, bodyBreak(a, a.seen)));
  if (!a.alive) return;
  a.seen = tick;
  a.thoughts = a.thoughts.filter(t => t.until > tick);
  if (a.species === 'human' && a.lastHurtAt && tick - a.lastHurtAt > CLOCK.limit.hurtRemembered){ a.lastHurt = null; a.lastHurtAt = null; }
}

/* When this being acts again, in ticks from now. A walker acts every tick, because a tile is a tick.
   A sleeper and a being at a job name the tick their rest or their work ends. Nothing else names one
   yet, and an unnamed act is the next tick, which is what the head did for everything. The body beat
   caps it, so nothing goes unread for longer than a world minute: see `catchUp`. */
function nextAct(a){
  if (a.asleep) return CLOCK.every.body;
  const t = a.task;
  if (!t) return 1;
  /* The order is `runTask`'s order: a wait is sat out before a step is taken, and a step is taken
     before the stop at the end of the path is asked anything. */
  if (t.waitUntil > tick) return t.waitUntil - tick;
  if (t.path.length) return 1;
  if (t.due > tick) return t.due - tick;
  return 1;
}

/* The proximity pass. Ruling 6 keeps danger on every world second, and this is it. A being that acts
   this tick looks for itself, so the pass is for the ones that do not: a person asleep, or three
   minutes into a job. It draws no random number and decides nothing. All it does is bring the being's
   next act forward to this tick, and the act then runs the rules the head always ran. Task 4 reads the
   same predicate the other way round: a tick this pass has work on is a tick the engine cannot skip. */
const SENSE = 5;                    // how far off a being notices fire or a hunter while it is not acting
/* What rouses what. A hunter rouses anything but its own kind, and a person rouses the animals. A
   person is not roused by another person, or a camp asleep by its own fire would never get a night's
   rest. */
const rousedBy = (a, b) => SPECIES[b.species].hunter ? a.species !== b.species : b.species === 'human' && a.species !== 'human';
/* What the predicate must see, decided rather than inherited. The pass asks the world one question:
   which beings had something dangerous within `SENSE` of them at the start of this tick. So the list
   of rousers is built once, before the loop, and nothing the loop does edits it.

   The list used to be built lazily inside the loop and then invalidated by that same loop. A sleeper
   the pass woke had `asleep` turned off and so joined a list built afterwards, and a being its
   `catchUp` killed stayed in a list built before. Both outcomes turned on the order of `beings`, and
   task 4 reads this predicate the other way round as the skip's horizon, so a list that moves under
   the loop is a wolf the horizon did not see.

   Two reasons the start-of-tick answer is the right one and not merely the tidy one. A being the pass
   wakes has not MOVED: it was already where it was, and whether it rouses a neighbour is a question
   for the next tick, when it acts. And a rouser that dies inside the pass died of hunger or cold
   accrued over the stretch `catchUp` has just closed, not on this tick; `b.alive` is still read per
   candidate, so a body found dead here stops rousing, which is the one live reading the list keeps.

   The cost is one filter over `beings` on every tick the pass runs, against a filter that used to be
   skipped when every non-acting being already stood in fire. The pass walks `beings` anyway, so it is
   one more walk of seventy records beside a tile read for each of them. */
function senseBeings(){
  const movers = beings.filter(b => b.alive && !b.asleep && (SPECIES[b.species].hunter || b.species === 'human'));
  for (const a of beings){
    if (!a.alive || SPECIES[a.species].perTick === false || a.next <= tick) continue;
    const here = hasTile(a.x, a.y, a.z) ? tileAt(a.x, a.y, a.z) : null;
    let found = !!(here && here.fire > 0), cause = found ? 'fire' : null;
    if (!found && fireCount > 0){ found = nearestFire(a.x, a.y, SENSE, a.z) >= 0; if (found) cause = 'fire'; }
    if (!found){
      for (const b of movers) if (b !== a && b.alive && rousedBy(a, b) && near(b, a) <= SENSE){ found = true; cause = 'hunter'; break; }
    }
    if (!found) continue;
    /* The hazard precondition of task 4, taken off the answer the pass has just worked out rather
       than worked out a second way. A tick on which a hazard stands beside a being that is not acting
       is a tick the engine steps away from rather than jumps from. See `nextEvent` in main.js. */
    if (pinAt !== tick){ pinAt = tick; pinMask = 0; }
    /* ONE BIT PER CAUSE THIS PASS NAMES, AND A BIT FOR ANY OTHER. `cause` used to fall through an
       `=== 'fire' ? 1 : 2`, so a third cause was counted as a hunter and the `none` bucket in
       `nextEvent` could not be reached at all. The plan's "a two-way split silently absorbing a third
       case" was the shape of the very counter built to prevent it. A cause neither named bit covers
       sets bit 4, and `nextEvent` counts every mask that carries bit 4 in `none`. A task that adds a
       cause here adds its own bit and its own bucket, and until it does the count lands in `none`
       rather than in another cause's name. */
    pinMask |= cause === 'fire' ? 1 : cause === 'hunter' ? 2 : 4;
    a.next = tick;
    /* A sleeper does not act, so the pass is the only thing that can rouse it. Sleeping through a wolf
       at five tiles is what the head did, because it returned at the sleep check before it ever looked;
       ruling 6 asks for danger every world second, and a person who sleeps through it is not covered.
       The body is brought up to date before the flag turns, because a sleeper gains rest and a waking
       one loses it. */
    if (a.asleep){
      catchUp(a);
      if (!a.alive) continue;
      a.asleep = false;
      /* Every species that is roused gets the thought, because the rule is that a new behaviour the
         player cannot see is a behaviour that is not there. A gnome, a rabbit and a deer are roused
         too, and the inspector's Thoughts panel is drawn for every species. Their line does not name
         the night, because a person rouses an animal in daylight as well.
         The thought is not renewed while the thing that woke the being is still about. `addThought`
         moves `until` to `tick + dur` on every call, so a wolf that lingered made the half hour of
         `CLOCK.thought.woken` permanent and the mood penalty with it. A waking after the thought has
         lapsed starts a fresh half hour, which is what a second waking is. */
      if (!hasThought(a, 'woken'))
        addThought(a, 'woken', a.species === 'human' ? 'Woke in the night to something moving' : 'Woke to something moving close by', -6, CLOCK.thought.woken);
    }
  }
}

/* What a being does when it acts. Everything here was the tail of the old head, and the body is
   already up to date before any of it runs. Three things moved off the tick and into it: the small
   neighbours seen in the dusk, the count of a foot in a gnome's burrow, and the marks read off the
   ground. None of them moves a need, and a being that has not moved and is not acting has nothing new
   to see. */
function updateBeing(a){
  const n = a.needs;
  if (a.camp) camp = a.camp;
  catchUp(a);
  if (!a.alive) return;
  if (a.species === 'human'){
    const hereTile = tileAt(a.x, a.y, a.z);
    /* Gnomes are drowsy from hour 6 to 19, and the sighting predicate already requires !drowsy(b); skip the
       scan of every being outright in those hours, so a camp waiting to learn of its neighbours is not paying
       a cost with no chance of a hit. */
    if (camp && !camp.gnomes.known && !a.asleep && !(hourOf() >= 6 && hourOf() < 19)){ const g = beings.find(b => b.alive && b.species === 'gnome' && !b.asleep && !drowsy(b) && near(b, a) <= 6); if (g){ camp.gnomes.known = true; log(`${a.name} sees a small figure in the dusk, no taller than a child, with a pack on its back. It is gone before ${a.name} can speak. There are neighbours under the meadow.`, campHumans(), 'major'); addThought(a, 'gnome', 'Saw one of the small neighbours', 3, CLOCK.thought.gnome); } }
    { const here = hereTile; if (here && here.cave && here.cave.kind === 'burrow' && here.cave.owner === 'gnome' && !(a.cooldown.disturb > tick)){ here.cave.disturbed++; here.cave.disturbedBy = camp; a.cooldown.disturb = tick + CLOCK.cooldown.disturb; addThought(a, 'burrow', 'Crept into the neighbours\' hole. It felt wrong', -4, CLOCK.thought.burrow); for (const g of beings) if (g.alive && g.species === 'gnome' && g.den === here.cave) addThought(g, 'intruder', 'A big one came into the hole', -10, CLOCK.thought.intruderGnome); } }
    /* A person awake on the ground reads the marks the lost people cut. It gives no thought and
       changes no need, so nobody's day moves because of it. */
    if (!a.asleep) learnNamesHere(a);
  }
  if (a.den) defendDen(a);
  const here = tileAt(a.x, a.y, a.z);
  if (here.fire > 0){ a.hp -= CLOCK.rate.fireHurts; a.asleep = false; if (a.species === 'human' && !hasThought(a, 'burned')) log(`${a.name} is caught in the flames.`, [a], 'bad'); addThought(a, 'burned', 'Was burned by fire', -20, CLOCK.thought.burned); if (!hasThought(a, 'burned')) drift(a, 'bravery', -0.02); if (!a.task || a.task.type !== 'flee'){ failTask(a); startTask(a, 'flee'); } }
  if (a.hp <= 0){
    const burned = here.fire > 0, frozen = n.warmth !== undefined && n.warmth < FREEZING;
    die(a, burned ? 'burned to death' : n.water !== undefined && n.water <= 0 ? 'died of thirst' : n.food <= 0 ? 'starved to death' : frozen ? 'froze in the cold' : (a.lastHurt || 'died'),
      burned ? 'fire' : frozen ? 'frost' : 'death'); return;
  }
  /* The waking is the body's, in `catchUp`. A being still asleep here has nothing to do. */
  if (a.asleep){ a.status = 'Sleeping'; return; }
  /* Below the surface it is dark. Without a burning ember a person cannot see to work, and feels their way out at half speed. */
  a.inDark = a.species === 'human' && a.z < 0 && !(a.carrying && a.carrying.kind === 'ember');
  if (a.inDark){
    if (!hasThought(a, 'dark')) addThought(a, 'dark', 'It is too dark down here to see', -6, CLOCK.thought.dark);
    /* No work in the dark: any task that is not a walk back to the light fails, and the walk is slow. */
    if (a.task && a.task.type !== 'flee' && !(a.task.path.length && a.task.path[a.task.path.length - 1][2] >= 0)) failTask(a);
  }
  if (a.carrying && a.carrying.kind === 'ember' && tick > a.carrying.dies){ a.carrying = null; failTask(a); log(`The ember ${a.name} carried goes dark before it reaches the pit.`, [a], 'bad'); addThought(a, 'emberlost', 'Lost the ember on the way', -5, CLOCK.thought.emberlost); }
  if (a.species === 'human' && fireCount > 0 && (!a.task || (a.task.type !== 'flee' && a.task.type !== 'ember' && a.task.type !== 'guard'))){
    const d = nearestFire(a.x, a.y, 5, a.z);
    if (d >= 0){ addThought(a, 'sawfire', 'Saw a wildfire close by', -Math.round(4 + 10 * (1 - a.traits.bravery)), CLOCK.thought.sawfire); if (d <= 2){ failTask(a); startTask(a, 'flee'); } }
  }
  if (a.species === 'human' && (!a.task || (a.task.type !== 'flee' && a.task.type !== 'guard')) && threatsFor(a).some(([x, y]) => beings.some(b => b.alive && b.species === 'wolf' && b.x === x && b.y === y))){ addThought(a, 'sawwolf', 'A wolf came too close', -8, CLOCK.thought.sawwolf); failTask(a); startTask(a, 'flee'); a.task && (a.task.label = 'Running from a wolf'); }
  if (a.species !== 'human' && a.task && a.task.type !== 'flee' && a.task.type !== 'hunt' && a.task.type !== 'stalk' && threatsFor(a).length){ failTask(a); }
  if (a.task && a.task.type !== 'flee'){
    if (a.species === 'human'){
      /* Sitting warms and soothes but never feeds or waters, so it must not block the force below: someone left
         sitting by the fire while their food or water runs out needs to be pulled off it, not left to starve there. */
      const busy = ['drink', 'eat', 'sleep'].includes(a.task.type);
      const force = busy ? null : (n.water < 15 && !(a.cooldown.drink > tick)) ? 'drink'
        : (n.food < 15 && !(a.cooldown.eat > tick)) ? 'eat'
        : (a.task.type !== 'sit' && n.warmth < 30 && !a.homeless && camp && pitLit() && !(a.cooldown.sit > tick)) ? 'sit' : null;
      if (force){ failTask(a); if (startTask(a, force)){ a.task.started = tick; a.task.key = force; } else a.cooldown[force] = tick + CLOCK.cooldown.needFailed; }
    }
    if (a.task && tick - (a.task.started || tick) > CLOCK.limit.task) failTask(a);
  }
  if (!a.task) chooseTask(a);
  if (a.task) runTask(a);
}
