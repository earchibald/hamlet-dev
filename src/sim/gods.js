/* ---------- the primal gods ----------
   A god is a being in the beings list with the same shape as a person. Its place is a region, not a
   tile. Gods come into being from contrasts: the seed makes the first, and every other is made by a
   lack. In the gods era a step is an age; every awake god scores its acts over the live regions and
   does the best one, eldest first. Everything here draws from the gods' own stream. */
SPECIES.god = { glyph: '✶', label: 'god', decay: { expression: 0, company: 0, rest: 0, calm: 0 }, stride: 0, zmin: 0, zmax: 0, perTick: false };
LIFE.god = { adult: 0, old: Infinity, life: Infinity, death: 'killable' };
const GOD_NAMES = ['Ondru', 'Sael', 'Ashka', 'Veyl', 'Morrow', 'Ilse', 'Thrum', 'Kesh', 'Ubbe', 'Nyr', 'Tamsa', 'Orun'];
const EPITHET = { above: 'who is Above', below: 'who is Below', wet: 'who is Wet', dry: 'who is Dry', hot: 'who is Hot', cold: 'who is Cold', still: 'who is Still', moving: 'who Moves', light: 'who is Light', dark: 'who is Dark' };
/* What a god becomes when it sleeps. */
const BODY = { above: 'a hill', below: 'the deep', wet: 'the river', dry: 'the plain', hot: 'an ember', cold: 'the frost', still: 'a lake', moving: 'the wind', light: 'the day', dark: 'a cave' };
/* What a god leaves behind, beyond its body, when it sleeps. */
const LEAVES = { hot: 'A spark stayed.' };
/* The scar a winner's pole leaves on what it beat. */
const SCAR_OF = { hot: 'burned', cold: 'broken', wet: 'drowned', dry: 'burned', above: 'cut', below: 'cut', still: 'broken', moving: 'cut', light: 'broken', dark: 'broken' };
/* Who makes what. The people are made by a mingling. */
const MAKES = { wet: ['deer'], dark: ['sprite', 'fox'], cold: ['wolf'], hot: ['rabbit'], dry: ['rabbit'] };
/* The poles a lack calls for, in order of preference. */
const STRAIN = { start: ['dry'], water: ['wet'], fuel: ['hot', 'cold'], food: ['hot', 'wet'] };
let godNamePool = [];
const gods = () => beings.filter(b => b.species === 'god');
const awakeGods = () => gods().filter(g => g.status === 'awake');
const godOf = pole => gods().find(g => g.pole === pole && g.status !== 'dead');
function withGodRng(fn){ const keep = rng; rng = godRng; try { return fn(); } finally { rng = keep; } }

function makeGod(pole, region, why){
  if (!godNamePool.length) godNamePool = shuffle(GOD_NAMES);
  const g = makeBeing('god', 0, 0, null, 0);
  g.name = godNamePool.pop(); g.pole = pole; g.contrast = POLES[pole].contrast; g.epithet = EPITHET[pole];
  g.region = region ? region.id : null; g.status = 'awake'; g.born = age; g.acted = 0;
  g.needs = { expression: 60, company: 60, rest: 90, calm: 80 };
  g.skills = {}; for (const k in GOD_ACTS) g.skills[k] = 0;
  beings.push(g);
  log(`${why} ${g.name} comes into being, ${g.epithet}.`, [g], 'major');
  return g;
}
/* A god stands in a live region. If its region was split, it stands in the child that carries its pole. */
function settleHome(g){
  let r = g.region === null ? null : regionById(g.region);
  while (r && r.children){ const kids = r.children.map(regionById); r = kids.find(k => hasPole(k, g.pole)) || kids[0]; }
  g.region = r ? r.id : null;
  return r;
}
/* Needs fall each age. Expression falls when the pole is scarce. Company falls alone. Rest falls as the
   field fills, slower for the hardy. Calm drifts back up. */
function godNeeds(g){
  const n = g.needs, live = liveRegions();
  const filled = live.length ? live.filter(r => r.marks.length).length / live.length : 0;
  n.expression = clamp(n.expression - 12 + 40 * poleShare(g.pole), 0, 100);
  n.company = clamp(n.company - 6, 0, 100);
  n.rest = clamp(n.rest - 3 - 12 * filled * (1 - g.traits.hardiness * 0.5), 0, 100);
  n.calm = clamp(n.calm + 2, 0, 100);
}
function gainGodXp(g, act){ g.xp[act] = (g.xp[act] || 0) + 0.7 + g.traits.curiosity * 0.6; if (g.xp[act] >= (g.skills[act] + 1) * 3){ g.xp[act] = 0; g.skills[act]++; } }

/* ---------- relations ---------- */
function setRelation(g, o){
  const mine = g.opinions[o.id] || 0, theirs = o.opinions[g.id] || 0;
  if (mine >= 40 && theirs >= 40 && g.rel[o.id] !== 'lover'){ g.rel[o.id] = o.rel[g.id] = 'lover'; log(`${g.name} and ${o.name} are lovers now.`, [g, o], 'good'); }
  else if ((mine <= -40 || theirs <= -40) && g.rel[o.id] !== 'rival'){ g.rel[o.id] = o.rel[g.id] = 'rival'; log(`${g.name} and ${o.name} are rivals now.`, [g, o], 'bad'); }
}
/* Acting beside a god you like feeds company and warms both opinions. */
function noteBeside(g, r){
  for (const n of neighboursOf(r)){
    if (n.lastAge !== age || n.lastBy === g.id || n.lastBy === null) continue;
    const o = beingById(n.lastBy); if (!o || o.status !== 'awake' || (g.opinions[o.id] || 0) < 0) continue;
    g.needs.company = clamp(g.needs.company + 25, 0, 100); o.needs.company = clamp(o.needs.company + 15, 0, 100);
    g.opinions[o.id] = clamp((g.opinions[o.id] || 0) + 4, -100, 100); o.opinions[g.id] = clamp((o.opinions[g.id] || 0) + 4, -100, 100);
    setRelation(g, o);
  }
}
/* Marking over another god's region offends it. */
function offend(r, g){
  const who = new Set(r.marks.filter(m => m.by !== null && m.by !== g.id && !m.inherited).map(m => m.by));
  for (const id of who){ const o = beingById(id); if (!o || o.status !== 'awake') continue;
    o.needs.calm = clamp(o.needs.calm - 20, 0, 100); o.opinions[g.id] = clamp((o.opinions[g.id] || 0) - 10, -100, 100);
    addThought(o, 'over' + g.id, `${g.name} marked over my country`, -10, 4); setRelation(o, g); }
}

/* ---------- the acts ----------
   name: { poles: who may (null is anyone), targets(g): regions, score(g, r), apply(g, r): true if done,
   continue(g, task) for acts that take ages }. */
/* Raising and digging spend one age a storey or a level. The diligent spend more ages. */
function spendAges(kind, verb, done){
  return {
    apply(g, r){ const left = 1 + Math.round(g.traits.diligence * 3); g.task = { type: kind === 'height' ? 'raise' : 'dig', region: r.id, left, done: 0 }; log(`${g.name} begins to ${verb}.`, [g]); this.continue(g, g.task); return true; },
    continue(g, t){
      const r = regionById(t.region); let m = marksOf(r, kind)[0]; if (!m) m = mark(r, kind, 0, g, `${g.name} ${verb === 'raise the land' ? 'raised' : 'dug'} it.`);
      m.value++; t.done++; r.lastBy = g.id; r.lastAge = age;
      if (t.done >= t.left){ g.task = null; log(done(g, m.value), [g], 'major'); }
    },
  };
}
const GOD_ACTS = {
  split: {
    poles: null,
    targets: g => liveRegions().filter(canSplit),
    score: (g, r) => (100 - g.needs.expression) * 0.8 + 30 * r.area / (W * H) + (g.region === r.id ? 10 : 0) + rng() * 8,
    apply(g, r){
      const wasRoot = r === field.root;
      const cut = splitRegion(r, g); if (!cut) return false;
      const other = POLES[g.pole].other;
      offend(r, g);
      setPole(cut.a, g.pole, g, `${g.name} drew the line, and this was the near side.`);
      setPole(cut.b, other, g, `${g.name} drew the line, and this was the far side.`);
      cut.a.lastBy = g.id; cut.a.lastAge = age; g.region = cut.a.id;
      if (wasRoot) log(`The Sundering. ${g.name} parts the formless: ${g.pole} from ${other}. There is a here and a there.`, [g], 'major');
      else log(`${g.name} parts a country: ${g.pole} from ${other}.`, [g]);
      if (!godOf(other)) makeGod(other, cut.b, 'The far side has nobody to hold it.');
      return true;
    },
  },
  make: {
    poles: Object.keys(MAKES),
    targets: g => liveRegions().filter(r => hasPole(r, g.pole) && MAKES[g.pole].some(sp => !hasMark(r, 'making', sp))),
    score(g, r){ const unmade = MAKES[g.pole].filter(sp => !liveRegions().some(q => hasMark(q, 'making', sp))); return (100 - g.needs.expression) * 0.3 + g.traits.curiosity * 30 + (unmade.length ? 40 : 0) - 10 + rng() * 8; },
    apply(g, r){
      const sp = MAKES[g.pole].find(s => !liveRegions().some(q => hasMark(q, 'making', s))) || MAKES[g.pole].find(s => !hasMark(r, 'making', s));
      if (!sp) return false;
      mark(r, 'making', sp, g, `${g.name} made the ${SPECIES[sp].label} here.`);
      r.lastBy = g.id; r.lastAge = age;
      log(`${g.name} makes the ${SPECIES[sp].label}s, and sets them in a ${biomeOf(r)} country.`, [g], 'major');
      return true;
    },
  },
  raise: {
    poles: ['above'],
    targets: g => liveRegions().filter(r => hasPole(r, 'above')),
    score: (g, r) => (100 - g.needs.expression) * 0.5 + 20 * g.traits.diligence + (marksOf(r, 'height').length ? -10 : 10) + rng() * 8,
    ...spendAges('height', 'raise the land', (g, n) => n >= 3 ? `${g.name} has raised a mountain, ${n} storeys of stone.` : `${g.name} has raised a hill of ${n} ${n === 1 ? 'storey' : 'storeys'}.`),
  },
  dig: {
    poles: ['below'],
    targets: g => liveRegions().filter(r => hasPole(r, 'below')),
    score: (g, r) => (100 - g.needs.expression) * 0.5 + 20 * g.traits.diligence + (marksOf(r, 'depth').length ? -10 : 10) + rng() * 8,
    ...spendAges('depth', 'dig into the dark', (g, n) => n >= 3 ? `${g.name} has dug a deep, ${n} levels down.` : `${g.name} has dug a cave of ${n} ${n === 1 ? 'level' : 'levels'}.`),
  },
  flow: {
    poles: ['wet', 'moving'],
    targets: g => { const r = settleHome(g); return r ? [r] : []; },
    score: (g, r) => (100 - g.needs.expression) * 0.5 + 15 + rng() * 8,
    apply(g, r){
      const path = [r]; let cur = r;
      const len = 2 + rint(3);
      for (let k = 0; k < len; k++){ const next = shuffle(neighboursOf(cur)).find(n => !path.includes(n)); if (!next) break; path.push(next); cur = next; }
      if (path.length < 2) return false;
      for (const p of path){ mark(p, 'flow', marksOf(p, 'depth').length ? 'under' : 'surface', g, `${g.name} flowed through.`); p.lastBy = g.id; p.lastAge = age; }
      log(`${g.name} flows through ${path.length} countries${path.some(p => marksOf(p, 'depth').length) ? ', and under one of them' : ''}.`, [g], 'major');
      return true;
    },
  },
  pool: {
    poles: ['wet', 'still'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'pool') && (hasPole(r, 'wet') || hasPole(r, 'still') || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.4 + 10 + rng() * 8,
    apply(g, r){ mark(r, 'pool', marksOf(r, 'depth').length ? 'under' : 'surface', g, `${g.name} pooled here.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} pools in a country, and the water is still.`, [g]); return true; },
  },
  burn: {
    poles: ['hot'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'scar', 'burned') && r.marks.some(m => m.by !== null && m.by !== g.id && !m.inherited)),
    score: (g, r) => (100 - g.needs.calm) * 0.6 + g.traits.temper * 20 - 15 + rng() * 8,
    apply(g, r){ offend(r, g); mark(r, 'scar', 'burned', g, `${g.name} burned it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} burns a country to ash.`, [g], 'bad'); return true; },
  },
  freeze: {
    poles: ['cold'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'freeze') && (marksOf(r, 'height').length || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.4 + (marksOf(r, 'height').length ? 15 : 0) + rng() * 8,
    apply(g, r){ mark(r, 'freeze', true, g, `${g.name} froze it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} breathes on a country, and the frost stays.`, [g]); return true; },
  },
  hide: {
    poles: ['dark'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'hide') && (marksOf(r, 'depth').length || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.4 + (marksOf(r, 'depth').length ? 15 : 0) + rng() * 8,
    apply(g, r){ mark(r, 'hide', true, g, `${g.name} hid it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} draws the dark over a country, and things hide in it.`, [g]); return true; },
  },
  show: {
    poles: ['light'],
    targets: g => { const r = settleHome(g); return r ? [r, ...neighboursOf(r)].filter(q => !hasMark(q, 'show')) : []; },
    score: (g, r) => (100 - g.needs.expression) * 0.4 + rng() * 8,
    apply(g, r){ mark(r, 'show', true, g, `${g.name} showed it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} opens a country to the light, and it can be seen from far off.`, [g]); return true; },
  },
  battle: {
    poles: null,
    targets(g){ const out = []; for (const o of awakeGods()) if (o !== g && g.rel[o.id] === 'rival') for (const r of liveRegions()) if (r.marks.some(m => m.kind === 'pole' && m.by === o.id && !m.inherited)) out.push(r); return out; },
    score: (g, r) => (100 - g.needs.calm) * 0.7 + g.traits.bravery * 20 - 25 + rng() * 8,
    apply(g, r){
      const v = awakeGods().find(o => o !== g && g.rel[o.id] === 'rival' && r.marks.some(m => m.kind === 'pole' && m.by === o.id && !m.inherited)); if (!v) return false;
      const might = p => p.traits.bravery + (p.skills.battle || 0) * 0.1 + rng() * 0.6;
      const win = might(g) > might(v) ? g : v, lose = win === g ? v : g;
      const lost = r.marks.filter(m => m.kind === 'pole' && m.by === lose.id);
      r.marks = r.marks.filter(m => !lost.includes(m));
      mark(r, 'scar', SCAR_OF[win.pole], win, `${win.name} beat ${lose.name} here.`);
      setPole(r, win.pole, win, `${win.name} won it from ${lose.name}.`);
      r.lastBy = win.id; r.lastAge = age;
      lose.opinions[win.id] = clamp((lose.opinions[win.id] || 0) - 15, -100, 100); win.opinions[lose.id] = clamp((win.opinions[lose.id] || 0) - 5, -100, 100);
      win.needs.calm = clamp(win.needs.calm + 30, 0, 100); lose.needs.calm = clamp(lose.needs.calm - 20, 0, 100);
      log(`${g.name} and ${v.name} fight over a country. ${win.name} wins, and the ground there is ${SCAR_OF[win.pole]}.`, [g, v], 'bad');
      return true;
    },
  },
  twist: {
    poles: null,
    targets: g => liveRegions().filter(r => marksOf(r, 'scar').length && marksOf(r, 'making').some(m => !hasMark(r, 'twist', m.value))),
    score: (g, r) => g.traits.curiosity * 25 - 15 + rng() * 8,
    apply(g, r){
      const m = marksOf(r, 'making').find(m => !hasMark(r, 'twist', m.value)); if (!m) return false;
      mark(r, 'twist', m.value, g, `${g.name} twisted the ${SPECIES[m.value].label}s on the scar.`); r.lastBy = g.id; r.lastAge = age;
      log(`${g.name} bends the ${SPECIES[m.value].label}s that live on the scar. They will not be quite like the others.`, [g], 'bad');
      return true;
    },
  },
  mingle: {
    poles: null,
    targets(g){
      const out = [];
      for (const o of awakeGods()){ if (o === g || g.rel[o.id] !== 'lover' || o.contrast === g.contrast) continue;
        const near = new Set(); for (const id of [g.region, o.region]){ const r = id === null ? null : regionById(id); if (!r) continue; near.add(r); for (const n of neighboursOf(r)) near.add(n); }
        for (const r of near) if (!(hasPole(r, g.pole) && hasPole(r, o.pole))) out.push(r); }
      return out;
    },
    score: (g, r) => (100 - g.needs.company) * 0.7 + g.traits.sociability * 20 + (liveRegions().some(q => hasMark(q, 'making', 'human')) ? 0 : 30) + rng() * 8,
    apply(g, r){
      const o = awakeGods().find(o => o !== g && g.rel[o.id] === 'lover' && o.contrast !== g.contrast); if (!o) return false;
      setPole(r, g.pole, g, `${g.name} and ${o.name} mingled here.`); setPole(r, o.pole, o, `${g.name} and ${o.name} mingled here.`);
      r.lastBy = g.id; r.lastAge = age;
      for (const p of [g, o]) p.needs.company = clamp(p.needs.company + 30, 0, 100);
      log(`${g.name} and ${o.name} mingle, and the country between them is ${g.pole} and ${o.pole} at once: a ${biomeOf(r)}.`, [g, o], 'major');
      if (!liveRegions().some(q => hasMark(q, 'making', 'human'))){ mark(r, 'making', 'human', g, `Where ${g.name} and ${o.name} mingled, the people were made.`); log('Where they mingled, something stood up on two legs and looked about. The people are made.', [g, o], 'major'); }
      return true;
    },
  },
  sleep: {
    poles: null,
    targets: g => restGate().ok ? [settleHome(g) || liveRegions()[0]] : [],
    score: (g, r) => (100 - g.needs.rest) * 1.2 - 20 + rng() * 8,
    apply(g, r){
      mark(r, 'rest', g.id, g, `${g.name} sleeps here, and is ${BODY[g.pole]}.`);
      g.status = 'asleep'; g.asleep = true; g.needs.rest = 100; g.region = r.id; r.lastBy = g.id; r.lastAge = age;
      log(`${g.name} lies down and sleeps, and is ${BODY[g.pole]}.`, [g], 'major');
      if (LEAVES[g.pole]) log(LEAVES[g.pole], [g], 'major');
      return true;
    },
  },
};

/* godOptions and decideGod draw from rng; call them inside withGodRng, as ageStep does. */
function godOptions(g){
  const opts = [];
  for (const name in GOD_ACTS){ const act = GOD_ACTS[name]; if (act.poles && !act.poles.includes(g.pole)) continue;
    for (const r of act.targets(g)){ const s = act.score(g, r); if (s > 0) opts.push({ type: name, label: name, region: r, score: Math.round(s) }); } }
  opts.sort((p, q) => q.score - p.score);
  return opts;
}
function decideGod(g){
  if (g.task){ const t = g.task;
    if (g.needs.calm < 20 || g.needs.expression < 15){ log(`${g.name} leaves the ${t.type} unfinished.`, [g]); g.task = null; }
    else { GOD_ACTS[t.type].continue(g, t); return; } }
  const opts = godOptions(g); g.lastChoice = { opts: opts.map(o => ({ type: o.type, label: o.label, score: o.score, region: o.region.id })), picked: null };
  for (let k = 0; k < opts.length; k++){ const o = opts[k];
    if (GOD_ACTS[o.type].apply(g, o.region)){ g.lastChoice.picked = o.type; g.acted++; gainGodXp(g, o.type); noteBeside(g, o.region); return; }
    g.lastChoice.opts[k].failed = true; }
}

/* ---------- the rest gate ---------- */
function ring(r, d){ const set = new Set([r]); for (let k = 0; k < d; k++) for (const q of [...set]) for (const n of neighboursOf(q)) set.add(n); return [...set]; }
function touchesWet(r){ return boundaries.some(b => b.pole === 'wet' && b.tiles.some(i => regionOf[i] === r.id)); }
/* A god may sleep only when the world can hold a life: a start region that is dry, level, unscarred,
   and a sector or more; water beside it; fuel and food within two neighbours; and the people made. */
function restGate(){
  const live = liveRegions();
  const starts = live.filter(r => hasPole(r, 'dry') && !poleOf(r, 'height') && !hasMark(r, 'scar', 'burned') && !hasMark(r, 'scar', 'drowned') && r.area >= SECTOR_AREA);
  if (!starts.length) return { ok: false, lack: 'start' };
  const people = live.some(r => hasMark(r, 'making', 'human'));
  let lack = null;
  for (const s of starts){
    const one = ring(s, 1), two = ring(s, 2);
    const water = one.some(r => hasPole(r, 'wet') || touchesWet(r));
    const fuel = two.some(r => GROWS[biomeOf(r)]);
    const food = two.some(r => marksOf(r, 'making').some(m => SPECIES[m.value].prey));
    if (water && fuel && food && people) return { ok: true, start: s };
    if (!lack) lack = !water ? 'water' : !fuel ? 'fuel' : !food ? 'food' : 'people';
  }
  return { ok: false, lack, start: starts[0] };
}
/* The lack strains a contrast. A missing god comes into being to hold the pole; a present one is
   pressed to act. A lack of people draws every god toward every other. */
function strain(lack){
  if (lack === 'people'){ const gs = awakeGods(); for (const g of gs) for (const o of gs) if (o !== g){ g.opinions[o.id] = clamp((g.opinions[o.id] || 0) + 5, -100, 100); setRelation(g, o); } return; }
  const pole = STRAIN[lack].find(p => !godOf(p)) || STRAIN[lack][0];
  const g = godOf(pole);
  if (!g) makeGod(pole, null, `The world cannot yet hold a life: it lacks ${lack}.`);
  else if (g.status === 'awake') g.needs.expression = Math.max(0, g.needs.expression - 10);
}

/* ---------- the ages ---------- */
function firstGod(){
  const cs = Object.keys(CONTRASTS); const c = cs[rint(cs.length)]; const pole = CONTRASTS[c][rint(2)];
  log('Before the world had time and place, all was formless.', [], 'major');
  makeGod(pole, field.root, 'Out of the formless, a difference.');
}
function settle(){
  log(`The last of the gods sleeps. The world is ${age} ages old, and holds its breath.`, [], 'major');
  creation.ages = age; creation.settled = true; creation.gate = restGate();
  era = 'days';
}
/* A god whose pole is gone from the whole live field is unmade. Its death is a scar. */
function unmake(g){
  g.status = 'dead'; g.alive = false; g.asleep = false;
  const r = settleHome(g) || liveRegions()[0];
  mark(r, 'scar', SCAR_OF[g.pole], g, `${g.name} died here, unmade.`);
  log(`Nothing on the field is ${g.pole} any more. ${g.name} is no more, and where ${g.name} stood the ground is ${SCAR_OF[g.pole]}.`, [g], 'death');
}
/* Past the age limit the eldest awake god does what has to be done, once an age, and every awake god
   wearies. At twice the limit the creation fails and everyone sleeps. */
function backstop(){
  const gate = restGate(); const g = awakeGods()[0]; if (!g || gate.ok) return;
  creation.backstops++;
  log(`Wearied, ${g.name} does what has to be done. The world lacks ${gate.lack}.`, [g], 'major');
  const live = liveRegions();
  if (gate.lack === 'start'){ const r = live.slice().sort((p, q) => q.area - p.area)[0]; r.marks = r.marks.filter(m => !(m.kind === 'pole' && POLES[m.value].contrast === 'height') && m.kind !== 'scar'); setPole(r, 'dry', g, 'Made dry so the world could hold a life.'); }
  else if (gate.lack === 'water'){ const n = neighboursOf(gate.start)[0] || gate.start; setPole(n, 'wet', g, 'Made wet so the world could hold a life.'); }
  else if (gate.lack === 'fuel'){ setPole(gate.start, 'hot', g, 'Made warm so things would grow.'); }
  else if (gate.lack === 'food'){ mark(gate.start, 'making', 'rabbit', g, 'Rabbits, so the world could hold a life.'); }
  else if (gate.lack === 'people'){ mark(gate.start, 'making', 'human', g, 'The people, made alone.'); }
  for (const o of awakeGods()) o.needs.rest = Math.max(0, o.needs.rest - 20);
}
function ageStep(){
  withGodRng(() => {
    age++;
    if (age === 1) firstGod();
    if (pulseAge === null && field.root.children){ pulseAge = age; log('The Pulse. Something already made is changed, and so there is a before and an after. Time begins.', [], 'major'); }
    for (const g of gods()) if (g.status === 'awake'){ settleHome(g); godNeeds(g); decideGod(g); }
    for (const g of awakeGods()) if (g.acted > 0 && poleShare(g.pole) === 0) unmake(g);
    const gate = restGate(); creation.gate = gate;
    /* Before time there is only the Sundering; the world is not yet strained by what it lacks. */
    if (!gate.ok && pulseAge !== null) strain(gate.lack);
    if (!awakeGods().length){ settle(); return; }
    if (age >= 2 * options.ageLimit){ creation.failed = true; for (const g of awakeGods()){ g.status = 'asleep'; g.asleep = true; } log('The gods sleep unfinished. The world would not hold.', [], 'bad'); settle(); return; }
    if (age >= options.ageLimit) backstop();
  });
}
function startCreation(seed, opts = {}){
  resetState(seed, opts);
  era = 'gods'; age = 0; pulseAge = null; legends = []; godNamePool = [];
  godRng = mulberry32(hashSeed(seedText + ':gods'));
  creation = { ages: 0, backstops: 0, settled: false, failed: false, gate: null };
  withGodRng(() => initField());
}
function runAges(max = options.ageLimit * 2 + 2){ let n = 0; while (era === 'gods' && n++ < max) step(); return age; }
