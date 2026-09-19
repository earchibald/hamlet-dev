/* ---------- the primal gods ----------
   A god is a being in the beings list with the same shape as a person. Its place is a region, not a
   tile. Gods come into being from contrasts: the seed makes the first, and every other is made by a
   lack. In the gods era a step is an age; every awake god scores its acts over the live regions and
   does the best one, eldest first. Everything here draws from the gods' own stream. */
SPECIES.god = { glyph: '✶', label: 'god', plural: 'gods', decay: { expression: 0, company: 0, rest: 0, calm: 0 }, stride: ticks(0), zmin: 0, zmax: 0, perTick: false };
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
const MAKES = { wet: ['deer'], above: ['deer'], dark: ['sprite', 'fox'], light: ['sprite'], still: ['fox'], cold: ['wolf'], moving: ['wolf'], hot: ['rabbit'], dry: ['rabbit'], below: ['gnome'] };
/* A world that can hold a life holds each kind of it: something eaten, something that hunts, something fae, and a
   second people. The gate wants one making of each kind somewhere; the lack strains the poles that make one. */
const KINDS = ['prey', 'hunter', 'fae', 'folk'];
const polesThatMake = kind => Object.keys(MAKES).filter(p => MAKES[p].some(sp => SPECIES[sp][kind]));
/* The poles a lack calls for, in order of preference. */
const STRAIN = { start: ['dry'], water: ['wet'], fuel: ['cold', 'dark'], food: ['hot', 'wet'], people: [], height: ['above'], depth: ['below'] };
let godNamePool = [];
const gods = () => beings.filter(b => b.species === 'god');
const awakeGods = () => gods().filter(g => g.status === 'awake');
const godOf = pole => gods().find(g => g.pole === pole && g.status !== 'dead');
function withGodRng(fn){ const keep = rng; rng = godRng; try { return fn(); } finally { rng = keep; } }

/* ---------- the gesture record ----------
   A gesture is what an act looked like: who acted, where it began, where it ended, the line it wrote,
   and the few numbers the view needs to draw it. `creation.gestures` holds one age of them and is
   replaced at the head of the next, so it replays that age and nothing else. Marks are history and are
   kept for ever; a gesture is worth nothing once its age is drawn, so it lives beside the mark and not
   on it. Every field is plain, a number or a string or an array of numbers, so a snapshot of `creation`
   carries the list whole. No rule reads a gesture. The recorder draws no random number: the anchors it
   reads were drawn by `mark()`, and its only scan is `heartTile`. */

/* The god whose apply is running, and the act it picked. The recorder copies a decision only for that
   god, so a task carried on from an earlier age, a birth, a backstop, and an unmaking carry none. */
let deciding = null;
/* Where the legends stood when the act began. An act that said nothing this age names no line. */
let saidFrom = 0;
const beginAct = () => { saidFrom = legends.length; };
/* How often an act left the recorder no anchor, by act. The design claims every act writes a usable
   mark; this counts the exceptions instead of assuming there are none. */
let gestureFallbacks = {};

/* The cut's line, ordered so the view can stroke it from one end to the other: along the wider axis,
   ties broken on the other coordinate and then on the tile index.
   Caution: `boundary.tiles` is state, not a drawing order. `paintRivers` places a ford by the index
   along that list and then draws for each tile in its order, so a reorder moves every ford and the
   people's stream with it. This sorts a copy and never the list itself. */
function sortLine(tiles){
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (const i of tiles){ const x = i % W, y = (i - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const alongX = (x1 - x0) >= (y1 - y0);
  const along = i => alongX ? i % W : (i - i % W) / W;
  const across = i => alongX ? (i - i % W) / W : i % W;
  return tiles.slice().sort((p, q) => along(p) - along(q) || across(p) - across(q) || p - q);
}

/* Where an act leaves the god. The mark the act wrote says it. A split ends in the middle of its own
   line, and a flow ends in the last country it ran through. An act that wrote no mark, or a mark with
   no tile, falls back to the heart of the country it acted on. */
function gestureTo(g, kind, f, at){
  if (at !== null && at !== undefined) return at;
  if (f.line && f.line.length) return f.line[f.line.length >> 1];
  if (f.path && f.path.length) return f.path[f.path.length - 1];
  gestureFallbacks[kind] = (gestureFallbacks[kind] || 0) + 1;
  const r = regionById(f.region !== undefined ? f.region : f.near);
  return r ? heartTile(r) : g.at;
}
/* One gesture, at the end of a successful apply or continue. `at` is private to the call: it is the
   anchor of the mark the act wrote, and the record keeps it as `to`. */
function gesture(g, kind, fields){
  const f = { ...fields }; const at = f.at; delete f.at;
  if (f.line) f.line = sortLine(f.line);
  const from = g.at === undefined ? null : g.at;
  const to = gestureTo(g, kind, f, at);
  g.at = to;
  const c = deciding && deciding.g === g && g.lastChoice ? g.lastChoice : null;
  creation.gestures.push({
    kind, god: g.id, age, from, to,
    said: legends.length > saidFrom ? legends.length - 1 : null,
    weighed: c ? { opts: c.opts.slice(0, 3).map(o => ({ type: o.type, region: o.region, score: o.score })), picked: deciding.type } : null,
    ...f,
  });
}

function makeGod(pole, region, why){
  beginAct();
  if (!godNamePool.length) godNamePool = shuffle(GOD_NAMES);
  const g = makeBeing('god', 0, 0, null, 0);
  g.name = godNamePool.pop(); g.pole = pole; g.contrast = POLES[pole].contrast; g.epithet = EPITHET[pole];
  g.status = 'awake'; g.born = age; g.acted = 0; g.at = null;
  g.needs = { expression: 60, company: 60, rest: 90, calm: 80 };
  g.skills = {}; for (const k in GOD_ACTS) g.skills[k] = 0;
  beings.push(g);
  log(`${why} ${g.name} comes into being, ${g.epithet}.`, [g], 'major');
  /* Every god comes into being holding a country. A god born of a lack takes the largest level one, or the largest there is, and makes it its own. */
  if (!region){ const live = liveRegions(); region = live.filter(isLevel).sort((p, q) => q.area - p.area)[0] || live.slice().sort((p, q) => q.area - p.area)[0]; if (region) setPole(region, pole, g, `${g.name} came into being here.`); }
  g.region = region ? region.id : null;
  /* A god comes into being at the heart of the country it holds, and nothing walks to get there. */
  gesture(g, 'born', { region: g.region, pole, at: heartTile(region) });
  return g;
}
/* A god stands in a live region. If its region was split, it stands in the child that carries its pole.
   The god keeps its anchor tile while that tile lies in the region it stands in. A split that cuts the
   tile away, or an act that left the god standing on a neighbour, returns it to the region's heart. */
function settleHome(g){
  let r = g.region === null ? null : regionById(g.region);
  while (r && r.children){ const kids = r.children.map(regionById); r = kids.find(k => hasPole(k, g.pole)) || kids[0]; }
  g.region = r ? r.id : null;
  if (r && (g.at === null || g.at === undefined || regionOf[g.at] !== r.id)) g.at = heartTile(r);
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
  n.calm = clamp(n.calm + 5, 0, 100);
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
/* Marking over another god's region offends it. With a contrast given, only the god whose pole of that contrast is
   replaced is offended; without one, every god that marked the region is. */
function offend(r, g, contrast){
  const mine = m => m.by !== null && m.by !== g.id && !m.inherited && (contrast === undefined || (m.kind === 'pole' && POLES[m.value].contrast === contrast));
  const who = new Set(r.marks.filter(mine).map(m => m.by));
  for (const id of who){ const o = beingById(id); if (!o || o.status !== 'awake') continue;
    o.needs.calm = clamp(o.needs.calm - 20, 0, 100); o.opinions[g.id] = clamp((o.opinions[g.id] || 0) - 10, -100, 100);
    addThought(o, 'over' + g.id, `${g.name} marked over my country`, -10, CLOCK.thought.over); setRelation(o, g); }
}

/* Level: nothing raised and nothing dug. The height pole alone is highland or lowland, still walkable. */
const isLevel = r => !marksOf(r, 'height').length && !marksOf(r, 'depth').length;
const isStart = r => hasPole(r, 'dry') && isLevel(r) && !hasMark(r, 'scar', 'burned') && !hasMark(r, 'scar', 'drowned') && r.area >= SECTOR_AREA;
/* Fewer than three level countries left: nothing more is raised or dug on one. */
const fewLevel = () => liveRegions().filter(isLevel).length < 3;
/* Fewer than three start candidates left: nothing more spoils one. */
const fewStarts = () => startCandidates().length < 3;
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
      gesture(g, kind === 'height' ? 'raise' : 'dig', { region: r.id, step: t.done, of: t.left, value: m.value, at: m.at });
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
      offend(r, g, g.contrast);
      setPole(cut.a, g.pole, g, `${g.name} drew the line, and this was the near side.`);
      setPole(cut.b, other, g, `${g.name} drew the line, and this was the far side.`);
      cut.a.lastBy = g.id; cut.a.lastAge = age; g.region = cut.a.id;
      if (wasRoot) log(`The Sundering. ${g.name} parts the formless: ${g.pole} from ${other}. There is a here and a there.`, [g], 'major');
      else log(`${g.name} parts a country: ${g.pole} from ${other}.`, [g]);
      /* The cut is recorded before the far side's god, so the line is drawn before the star fades in on it. */
      gesture(g, 'split', { near: cut.a.id, far: cut.b.id, line: cut.boundary.tiles, pole: g.pole, other });
      if (!godOf(other)) makeGod(other, cut.b, 'The far side has nobody to hold it.');
      return true;
    },
  },
  claim: {
    /* A god sets its pole on a country beside its home. The peaceful way to spread a nature once the splitting is done;
       it offends whoever marked the country before, and offence makes rivals. */
    poles: null,
    targets(g){ const home = settleHome(g); if (!home) return []; const few = fewStarts(); return [home, ...neighboursOf(home)].filter(r => !hasPole(r, g.pole) && !r.marks.some(m => m.kind === 'rest') && !(few && isStart(r))); },
    score: (g, r) => (100 - g.needs.expression) * 0.6 + 5 + rng() * 8,
    apply(g, r){ offend(r, g, g.contrast); const m = setPole(r, g.pole, g, `${g.name} claimed it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} claims a country: it is ${g.pole} now.`, [g]); gesture(g, 'claim', { region: r.id, pole: g.pole, at: m.at }); return true; },
  },
  make: {
    poles: Object.keys(MAKES),
    targets: g => liveRegions().filter(r => hasPole(r, g.pole) && MAKES[g.pole].some(sp => !hasMark(r, 'making', sp))),
    /* Making answers a lack of a kind of life directly: when the gate wants prey, a hunter, a fae, or a folk, the god
       whose pole makes one is drawn to make it. It reads `creation.gate`, the gate as it stood at the end of the
       last age: the same lack `strain` answered, so the god it made or pressed reads the lack it was made for. */
    score(g, r){ const unmade = MAKES[g.pole].filter(sp => !liveRegions().some(q => hasMark(q, 'making', sp))); const lack = creation.gate && creation.gate.lack; const wanted = lack && (KINDS.includes(lack) || lack === 'food') && MAKES[g.pole].some(sp => SPECIES[sp][lack === 'food' ? 'prey' : lack]); return (100 - g.needs.expression) * 0.3 + g.traits.curiosity * 30 + (unmade.length ? 40 : 0) + (wanted ? 80 : 0) - 10 + rng() * 8; },
    apply(g, r){
      const sp = MAKES[g.pole].find(s => !liveRegions().some(q => hasMark(q, 'making', s))) || MAKES[g.pole].find(s => !hasMark(r, 'making', s));
      if (!sp) return false;
      const m = mark(r, 'making', sp, g, `${g.name} made the ${SPECIES[sp].label} here.`);
      r.lastBy = g.id; r.lastAge = age;
      log(`${g.name} makes the ${SPECIES[sp].plural}, and sets them in a ${biomeOf(r)} country.`, [g], 'major');
      gesture(g, 'make', { region: r.id, species: sp, at: m.at });
      return true;
    },
  },
  raise: {
    poles: ['above'],
    /* The gods leave the last level countries and the last start candidates alone. */
    targets: g => { const few = fewLevel(), fewS = fewStarts(); return liveRegions().filter(r => hasPole(r, 'above') && !((few && isLevel(r)) || (fewS && isStart(r)))); },
    score: (g, r) => (100 - g.needs.expression) * 0.8 + 20 * g.traits.diligence + (marksOf(r, 'height').length ? -10 : 10) + rng() * 8,
    ...spendAges('height', 'raise the land', (g, n) => n >= 3 ? `${g.name} has raised a mountain, ${n} storeys of stone.` : `${g.name} has raised a hill of ${n} ${n === 1 ? 'storey' : 'storeys'}.`),
  },
  dig: {
    poles: ['below'],
    /* The gods leave the last level countries and the last start candidates alone. */
    targets: g => { const few = fewLevel(), fewS = fewStarts(); return liveRegions().filter(r => hasPole(r, 'below') && !((few && isLevel(r)) || (fewS && isStart(r)))); },
    score: (g, r) => (100 - g.needs.expression) * 0.8 + 20 * g.traits.diligence + (marksOf(r, 'depth').length ? -10 : 10) + rng() * 8,
    ...spendAges('depth', 'dig into the dark', (g, n) => n >= 3 ? `${g.name} has dug a deep, ${n} levels down.` : `${g.name} has dug a cave of ${n} ${n === 1 ? 'level' : 'levels'}.`),
  },
  flow: {
    poles: ['wet', 'moving'],
    targets: g => { const r = settleHome(g); return r ? [r] : []; },
    score: (g, r) => (100 - g.needs.expression) * 0.8 + 15 + rng() * 8,
    apply(g, r){
      const path = [r]; let cur = r;
      const len = 2 + rint(3);
      for (let k = 0; k < len; k++){ const next = shuffle(neighboursOf(cur)).find(n => !path.includes(n)); if (!next) break; path.push(next); cur = next; }
      if (path.length < 2) return false;
      /* One anchor a country, in the order the water ran, so the view can draw the line it took. */
      const anchors = [];
      for (const p of path){ const m = mark(p, 'flow', marksOf(p, 'depth').length ? 'under' : 'surface', g, `${g.name} flowed through.`); p.lastBy = g.id; p.lastAge = age; if (m.at !== null) anchors.push(m.at); }
      log(`${g.name} flows through ${path.length} countries${path.some(p => marksOf(p, 'depth').length) ? ', and under one of them' : ''}.`, [g], 'major');
      gesture(g, 'flow', { path: anchors });
      return true;
    },
  },
  pool: {
    poles: ['wet', 'still'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'pool') && (hasPole(r, 'wet') || hasPole(r, 'still') || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.7 + 10 + rng() * 8,
    apply(g, r){ const m = mark(r, 'pool', marksOf(r, 'depth').length ? 'under' : 'surface', g, `${g.name} pooled here.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} pools in a country, and the water is still.`, [g]); gesture(g, 'pool', { region: r.id, under: m.value === 'under', at: m.at }); return true; },
  },
  burn: {
    poles: ['hot'],
    /* The last start candidates are not burned while fewer than three remain, as they are not raised. */
    targets: g => { const few = fewStarts(); return liveRegions().filter(r => !marksOf(r, 'scar').length && !(few && isStart(r)) && r.marks.some(m => m.by !== null && m.by !== g.id && !m.inherited)); },
    score: (g, r) => (100 - g.needs.calm) * 0.6 + g.traits.temper * 20 - 30 + rng() * 8,
    apply(g, r){ offend(r, g); const m = mark(r, 'scar', 'burned', g, `${g.name} burned it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} burns a country to ash.`, [g], 'bad'); gesture(g, 'burn', { region: r.id, at: m.at }); return true; },
  },
  freeze: {
    poles: ['cold'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'freeze') && (marksOf(r, 'height').length || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.7 + (marksOf(r, 'height').length ? 15 : 0) + rng() * 8,
    apply(g, r){ const m = mark(r, 'freeze', true, g, `${g.name} froze it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} breathes on a country, and the frost stays.`, [g]); gesture(g, 'wash', { region: r.id, value: 'freeze', at: m.at }); return true; },
  },
  hide: {
    poles: ['dark'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'hide') && (marksOf(r, 'depth').length || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.7 + (marksOf(r, 'depth').length ? 15 : 0) + rng() * 8,
    apply(g, r){ const m = mark(r, 'hide', true, g, `${g.name} hid it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} draws the dark over a country, and things hide in it.`, [g]); gesture(g, 'wash', { region: r.id, value: 'hide', at: m.at }); return true; },
  },
  show: {
    poles: ['light'],
    targets: g => { const r = settleHome(g); return r ? [r, ...neighboursOf(r)].filter(q => !hasMark(q, 'show')) : []; },
    score: (g, r) => (100 - g.needs.expression) * 0.7 + rng() * 8,
    apply(g, r){ const m = mark(r, 'show', true, g, `${g.name} showed it.`); r.lastBy = g.id; r.lastAge = age; log(`${g.name} opens a country to the light, and it can be seen from far off.`, [g]); gesture(g, 'wash', { region: r.id, value: 'show', at: m.at }); return true; },
  },
  battle: {
    poles: null,
    /* Rivals do not fight over the last start candidates while fewer than three remain. */
    targets(g){ const out = []; const few = fewStarts(); for (const o of awakeGods()) if (o !== g && g.rel[o.id] === 'rival') for (const r of liveRegions()) if (!(few && isStart(r)) && !marksOf(r, 'scar').length && r.marks.some(m => m.kind === 'pole' && m.by === o.id && !m.inherited)) out.push(r); return out; },
    score: (g, r) => (100 - g.needs.calm) * 0.7 + g.traits.bravery * 20 - 40 + rng() * 8,
    apply(g, r){
      const v = awakeGods().find(o => o !== g && g.rel[o.id] === 'rival' && r.marks.some(m => m.kind === 'pole' && m.by === o.id && !m.inherited)); if (!v) return false;
      const might = p => p.traits.bravery + (p.skills.battle || 0) * 0.1 + rng() * 0.6;
      const win = might(g) > might(v) ? g : v, lose = win === g ? v : g;
      const lost = r.marks.filter(m => m.kind === 'pole' && m.by === lose.id);
      r.marks = r.marks.filter(m => !lost.includes(m));
      const scar = mark(r, 'scar', SCAR_OF[win.pole], win, `${win.name} beat ${lose.name} here.`);
      setPole(r, win.pole, win, `${win.name} won it from ${lose.name}.`);
      r.lastBy = win.id; r.lastAge = age;
      lose.opinions[win.id] = clamp((lose.opinions[win.id] || 0) - 15, -100, 100); win.opinions[lose.id] = clamp((win.opinions[lose.id] || 0) - 5, -100, 100);
      win.needs.calm = clamp(win.needs.calm + 30, 0, 100); lose.needs.calm = clamp(lose.needs.calm - 20, 0, 100);
      for (const p of [g, v]) p.needs.rest = clamp(p.needs.rest - 10, 0, 100);
      log(`${g.name} and ${v.name} fight over a country. ${win.name} wins, and the ground there is ${SCAR_OF[win.pole]}.`, [g, v], 'bad');
      gesture(g, 'battle', { region: r.id, other: v.id, otherFrom: v.at === undefined ? null : v.at, winner: win.id, loser: lose.id, scar: SCAR_OF[win.pole], at: scar.at });
      return true;
    },
  },
  twist: {
    poles: null,
    targets: g => liveRegions().filter(r => marksOf(r, 'scar').length && marksOf(r, 'making').some(m => !hasMark(r, 'twist', m.value))),
    score: (g, r) => g.traits.curiosity * 25 - 15 + rng() * 8,
    apply(g, r){
      const m = marksOf(r, 'making').find(m => !hasMark(r, 'twist', m.value)); if (!m) return false;
      const t = mark(r, 'twist', m.value, g, `${g.name} twisted the ${SPECIES[m.value].plural} on the scar.`); r.lastBy = g.id; r.lastAge = age;
      log(`${g.name} bends the ${SPECIES[m.value].plural} that live on the scar. They will not be quite like the others.`, [g], 'bad');
      gesture(g, 'twist', { region: r.id, species: m.value, at: t.at });
      return true;
    },
  },
  mingle: {
    poles: null,
    targets(g){
      const out = []; const few = fewStarts();
      for (const o of awakeGods()){ if (o === g || g.rel[o.id] !== 'lover' || o.contrast === g.contrast) continue;
        const near = new Set(); for (const id of [g.region, o.region]){ const r = id === null ? null : regionById(id); if (!r) continue; near.add(r); for (const n of neighboursOf(r)) near.add(n); }
        for (const r of near) if (!(hasPole(r, g.pole) && hasPole(r, o.pole)) && !(few && isStart(r))) out.push(r); }
      return out;
    },
    score: (g, r) => (100 - g.needs.company) * 0.7 + g.traits.sociability * 20 + (liveRegions().some(q => hasMark(q, 'making', 'human')) ? 0 : 30) + rng() * 8,
    apply(g, r){
      const o = awakeGods().find(o => o !== g && g.rel[o.id] === 'lover' && o.contrast !== g.contrast); if (!o) return false;
      const m = setPole(r, g.pole, g, `${g.name} and ${o.name} mingled here.`); setPole(r, o.pole, o, `${g.name} and ${o.name} mingled here.`);
      r.lastBy = g.id; r.lastAge = age;
      for (const p of [g, o]) p.needs.company = clamp(p.needs.company + 30, 0, 100);
      log(`${g.name} and ${o.name} mingle, and the country between them is ${g.pole} and ${o.pole} at once: a ${biomeOf(r)}.`, [g, o], 'major');
      if (!liveRegions().some(q => hasMark(q, 'making', 'human'))){ mark(r, 'making', 'human', g, `Where ${g.name} and ${o.name} mingled, the people were made.`); log('Where they mingled, something stood up on two legs and looked about. The people are made.', [g, o], 'major'); }
      gesture(g, 'mingle', { region: r.id, with: o.id, otherFrom: o.at === undefined ? null : o.at, at: m.at });
      return true;
    },
  },
  sleep: {
    poles: null,
    targets: g => restGate().ok ? [settleHome(g) || liveRegions()[0]] : [],
    score: (g, r) => (100 - g.needs.rest) * 1.2 - 20 + rng() * 8,
    apply(g, r){
      const m = mark(r, 'rest', g.id, g, `${g.name} sleeps here, and is ${BODY[g.pole]}.`);
      g.status = 'asleep'; g.asleep = true; g.needs.rest = 100; g.region = r.id; g.sleptAt = age; r.lastBy = g.id; r.lastAge = age;
      log(`${g.name} lies down and sleeps, and is ${BODY[g.pole]}.`, [g], 'major');
      if (LEAVES[g.pole]) log(LEAVES[g.pole], [g], 'major');
      gesture(g, 'sleep', { region: r.id, body: BODY[g.pole], at: m.at });
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
/* The decision is kept, not only the last one. `lastChoice` is what the god's card reads now; the
   record in `creation.choices` is what the timeline reads, age by age, and what the annals inherit.
   Nothing here draws a random number, so the creation is unmoved. */
function decideGod(g, given){
  if (g.task){ const t = g.task;
    if (g.needs.calm < 20 || g.needs.expression < 15){ log(`${g.name} leaves the ${t.type} unfinished.`, [g]); g.task = null; }
    else { beginAct(); creation.choices.push({ age, god: g.id, continued: true, type: t.type }); GOD_ACTS[t.type].continue(g, t); return; } }
  const opts = given || godOptions(g); g.lastChoice = { opts: opts.map(o => ({ type: o.type, label: o.label, score: o.score, region: o.region.id })), picked: null };
  const rec = { age, god: g.id, opts: g.lastChoice.opts, picked: null };
  creation.choices.push(rec);
  for (let k = 0; k < opts.length; k++){ const o = opts[k];
    beginAct(); deciding = { g, type: o.type };
    const ok = GOD_ACTS[o.type].apply(g, o.region);
    deciding = null;
    if (ok){ g.lastChoice.picked = o.type; rec.picked = o.type; g.acted++; gainGodXp(g, o.type); noteBeside(g, o.region); return; }
    g.lastChoice.opts[k].failed = true; }
}

/* ---------- the rest gate ---------- */
function ring(r, d){ const set = new Set([r]); for (let k = 0; k < d; k++) for (const q of [...set]) for (const n of neighboursOf(q)) set.add(n); return [...set]; }
function touchesWet(r){ return liveBoundaries().some(b => b.pole === 'wet' && b.tiles.some(i => regionOf[i] === r.id)); }
/* A start candidate: dry, level (nothing raised, nothing dug), unscarred, a sector or more. */
const startCandidates = () => liveRegions().filter(isStart);
/* A god may sleep only when the world can hold a life: a start region that is dry, level (nothing raised, nothing dug), unscarred,
   and a sector or more; water beside it; a forest for fuel and food within two neighbours; the people made;
   a hill and a cave somewhere, since the life the day era knows dens, digs, and hides its finds in the deep;
   and each kind of life somewhere: something eaten, something that hunts, something fae, and a second people. */
function restGate(){
  const live = liveRegions();
  const starts = startCandidates();
  /* Every return carries a start, even the one that says there is no candidate: settle paints from
     `creation.gate.start`, and a gate with no start at all would throw instead of discarding. With no candidate
     the largest live country stands in, so the painters always have a country to read. */
  if (!starts.length) return { ok: false, lack: 'start', start: live.slice().sort((p, q) => q.area - p.area)[0] };
  const people = live.some(r => hasMark(r, 'making', 'human'));
  const raised = live.some(r => marksOf(r, 'height').length), dug = live.some(r => marksOf(r, 'depth').length);
  const kinds = KINDS.filter(k => !live.some(r => marksOf(r, 'making').some(m => SPECIES[m.value][k])));
  let lack = null;
  for (const s of starts){
    const one = ring(s, 1), two = ring(s, 2);
    /* Water: a wet country, a wet god's boundary, or a country that water flowed through or pooled in. A flowed country keeps its nature; the river runs through it. */
    const water = one.some(r => hasPole(r, 'wet') || hasMark(r, 'flow') || hasMark(r, 'pool') || touchesWet(r));
    /* Fuel is a forest: the day era needs wood, not only grass. */
    const fuel = two.some(r => biomeOf(r) === 'forest');
    const food = two.some(r => marksOf(r, 'making').some(m => SPECIES[m.value].prey));
    if (water && fuel && food && people && raised && dug && !kinds.length) return { ok: true, start: s };
    if (!lack) lack = !water ? 'water' : !fuel ? 'fuel' : !food ? 'food' : !people ? 'people' : !raised ? 'height' : !dug ? 'depth' : kinds[0];
  }
  return { ok: false, lack, start: starts[0] };
}
/* The lack strains a contrast. A missing god comes into being to hold the pole; a present one is
   pressed to act. A lack of people draws every god toward every other. */
function strain(lack){
  if (lack === 'people'){
    const gs = awakeGods();
    for (const g of gs) for (const o of gs) if (o !== g){ g.opinions[o.id] = clamp((g.opinions[o.id] || 0) + 5, -100, 100); setRelation(g, o); }
    /* One difference cannot make a people. When every awake god is of one contrast, the lack strains a new one. */
    if (gs.length && gs.every(g => g.contrast === gs[0].contrast)){
      const c = Object.keys(CONTRASTS).find(c => !gods().some(g => g.contrast === c));
      if (c) makeGod(CONTRASTS[c][0], null, 'One difference is not enough to make a people.');
    }
    return;
  }
  const poles = KINDS.includes(lack) ? polesThatMake(lack) : STRAIN[lack];
  const pole = poles.find(p => !godOf(p)) || poles[0];
  const g = godOf(pole);
  if (!g) makeGod(pole, null, `The world cannot yet hold a life: it lacks ${lack}.`);
  /* A present god is pressed to express its pole. A lack of a kind of life is answered by making, which reads the gate itself. */
  else if (g.status === 'awake' && !KINDS.includes(lack) && lack !== 'food') g.needs.expression = Math.max(0, g.needs.expression - 10);
}

/* ---------- the ages ---------- */
function firstGod(){
  const cs = Object.keys(CONTRASTS); const c = cs[rint(cs.length)]; const pole = CONTRASTS[c][rint(2)];
  log('Before the world had time and place, all was formless.', [], 'major');
  makeGod(pole, field.root, 'Out of the formless, a difference.');
}
/* A god whose pole is gone from the whole live field is unmade. Its death is a scar. */
function unmake(g){
  beginAct();
  const wasAsleep = g.status === 'asleep';
  g.status = 'dead'; g.alive = false; g.asleep = false;
  const r = settleHome(g) || liveRegions()[0];
  mark(r, 'scar', SCAR_OF[g.pole], g, `${g.name} died here, unmade.`);
  const gone = wasAsleep ? `${g.name} dies in its sleep, and where` : `${g.name} is no more, and where`;
  log(`Nothing on the field is ${g.pole} any more. ${gone} ${g.name} stood the ground is ${SCAR_OF[g.pole]}.`, [g], 'death');
  /* The star fades out where it last stood, so the anchor it held is the anchor it keeps. */
  gesture(g, 'unmade', { region: r ? r.id : null, at: g.at });
}
/* Past the age limit the eldest awake god does what has to be done, once an age, and every awake god
   wearies. At twice the limit the creation fails and everyone sleeps. */
function backstop(){
  const gate = restGate(); const g = awakeGods()[0]; if (!g || gate.ok) return;
  beginAct();
  creation.backstops++;
  log(`Wearied, ${g.name} does what has to be done. The world lacks ${gate.lack}.`, [g], 'major');
  const live = liveRegions();
  const starts = startCandidates();
  let pool = live.filter(r => !isStart(r));
  if (!pool.length) pool = starts.length > 1 ? starts.slice().sort((p, q) => p.area - q.area).slice(0, 1) : live;
  /* Each branch names the country it marked and the mark it wrote, so the backstop draws like any other act. */
  let on = null, m = null;
  if (gate.lack === 'start'){ const r = live.slice().sort((p, q) => q.area - p.area)[0]; r.marks = r.marks.filter(m => !(m.kind === 'pole' && POLES[m.value].contrast === 'height') && m.kind !== 'scar' && m.kind !== 'height' && m.kind !== 'depth'); on = r; m = setPole(r, 'dry', g, 'Made dry so the world could hold a life.'); }
  else if (gate.lack === 'water'){ const n = neighboursOf(gate.start)[0] || gate.start; on = n; m = setPole(n, 'wet', g, 'Made wet so the world could hold a life.'); }
  else if (gate.lack === 'fuel'){ on = gate.start; m = setPole(gate.start, 'hot', g, 'Made warm so things would grow.'); }
  else if (gate.lack === 'food'){ on = gate.start; m = mark(gate.start, 'making', 'rabbit', g, 'Rabbits, so the world could hold a life.'); }
  else if (gate.lack === 'people'){ on = gate.start; m = mark(gate.start, 'making', 'human', g, 'The people, made alone.'); }
  else if (gate.lack === 'height'){ const r = pool.slice().sort((p, q) => q.area - p.area)[0]; on = r; m = mark(r, 'height', 1, g, 'Raised so the world could hold a life.'); }
  else if (gate.lack === 'depth'){ const r = pool.slice().sort((p, q) => q.area - p.area)[0]; on = r; m = mark(r, 'depth', 1, g, 'Dug so the world could hold a life.'); }
  else if (KINDS.includes(gate.lack)){ const sp = Object.keys(SPECIES).find(s => SPECIES[s][gate.lack]); const r = pool.slice().sort((p, q) => q.area - p.area)[0]; on = r; m = mark(r, 'making', sp, g, `The ${SPECIES[sp].plural}, so the world could hold a life.`); }
  gesture(g, 'backstop', { region: on ? on.id : null, lack: gate.lack, at: m ? m.at : null });
  for (const o of awakeGods()) o.needs.rest = Math.max(0, o.needs.rest - 20);
}
/* A world with many countries and few differences lacks differentiation. When the countries outnumber the
   gods six to one, the next absent contrast strains, and a god of it comes into being. */
const REGIONS_PER_GOD = 6;
function outgrown(){
  const living = gods().filter(g => g.status !== 'dead');
  if (liveRegions().length < REGIONS_PER_GOD * living.length) return;
  const c = Object.keys(CONTRASTS).find(c => !gods().some(g => g.contrast === c));
  if (c) makeGod(CONTRASTS[c][0], null, 'The world has grown past its gods, and a new difference stirs in it.');
}
/* Settle paints the ground, and painting draws from the people's stream. The age that ends the creation
   raises this flag inside the god stream; settle runs after it, outside. */
let settleNow = false;

/* Where the age stands. Null between ages. `{ i }` is the index of the next god to decide in the
   list `ageDecide` took at the head of this age. An age is split so a player's turn can suspend in
   the middle of it; the parts run in the order the one closure ran them, and the god stream is
   drawn from identically. */
let agePos = null;

/* A line the player is owed but the world does not remember. In the gods era every logged line joins
   the legends, and the legends are the creation's own story: a hand reaching in is not part of it, and
   a legend that differed would break the equality that autopilot rests on. The door log is the record
   of what the player did. This is only so they can see it happen. */
function note(text){ chronicle.unshift({ tick, when: stamp(), text, kind: 'info' }); if (chronicle.length > 300) chronicle.pop(); }

/* Who the player is, and the turn that is open. `inhabited` is a being id or null. `pending` is null,
   or the god whose turn it is with the matrix it was given. The engine will not step while `pending`
   is set: this is the locked clock the mythos spec reserved. */
let inhabited = null;
let pending = null;

/* The age the autopilot runs to. Null when the player is choosing. Task 6 gives it its act. */
let runUntil = null;

/* Fill the open turn. The once-per-god preparation (settleHome, godNeeds) runs in ageDecide, not
   here, so it happens exactly once however many times the turn is opened. The matrix is drawn once
   and kept on `agePos.opts`; re-opening the same god's turn, after the player left and came back,
   reuses it and draws nothing. */
function openTurn(g){
  if (!agePos.opts) agePos.opts = godOptions(g);
  pending = { god: g.id, age, opts: agePos.opts.map(o => ({ type: o.type, label: o.label, score: o.score, region: o.region.id })) };
}

/* Apply one option for the god whose turn is open. An option that does not land leaves the turn open
   with its row marked failed, because the player is owed the reason; the autonomous god falls to the
   next option in silence. */
function takeTurn(opt){
  const g = beingById(pending.god);
  const k = pending.opts.findIndex(o => o.type === opt.type && o.region === opt.region);
  if (k < 0) return 'That is not on the table.';
  const row = pending.opts[k];
  const r = regionById(row.region);
  let landed = false;
  withGodRng(() => {
    g.lastChoice = { opts: pending.opts, picked: null };
    beginAct(); deciding = { g, type: row.type };
    landed = !!(r && GOD_ACTS[row.type].apply(g, r));
    deciding = null;
    if (landed){ g.lastChoice.picked = row.type; g.acted++; gainGodXp(g, row.type); noteBeside(g, r); }
    else row.failed = true;
  });
  if (!landed) return `The ground refuses it. ${g.name} cannot ${row.type} there.`;
  creation.choices.push({ age: pending.age, god: g.id, opts: pending.opts, picked: row.type, byPlayer: true });
  pending = null;
  agePos.i++; agePos.prepared = false; agePos.opts = null;
  withGodRng(() => { if (ageDecide()) ageEnd(); });
  if (settleNow){ settleNow = false; settle(); }
  return `You ${row.type}. ${g.name} acts.`;
}

/* The player leaves, or the god whose turn was open is gone. This only closes the open turn: it does
   not resume the age. `takeTurn` is the one path that resumes, so there is no second copy of that
   logic to keep in step with it. The engine's own next `step()` finds `agePos` still standing and
   carries the age on from where it stood, through `ageDecide`. */
function releaseTurn(){
  pending = null;
}

function ageBegin(){
  age++;
  /* The gestures replay one age. The list is replaced at the head of the next, before anything acts. */
  creation.gestures = []; creation.gestureAge = age;
  if (age === 1) firstGod();
  /* The Pulse comes in the age after the Sundering: the first age in which a made country can change. */
  if (pulseAge === null && field.root.children){ pulseAge = age; log('The Pulse. Something already made is changed, and so there is a before and an after. Time begins.', [], 'major'); }
  agePos = { i: 0, list: gods(), prepared: false, opts: null };
}

/* The gods of this age, as they stood when it began, and where we are among them. The list is taken
   once an age and never retaken, so a suspended age resumes through the same gods the age started
   with, and a god born mid-age waits for the next age exactly as it always did.
   `agePos.prepared` and `agePos.opts` belong to the god at `agePos.i` alone: settleHome, godNeeds,
   and the drawn matrix run or are drawn once for that god, however many times its turn is opened
   and abandoned before the age moves past it. */
function ageDecide(){
  const list = agePos.list;
  while (agePos.i < list.length){
    const g = list[agePos.i];
    if (g.status === 'awake'){
      if (!agePos.prepared){ settleHome(g); godNeeds(g); agePos.prepared = true; }
      /* The player's god with a free choice stops the age here. A god carrying an act has no choice
         to make, so it carries on and the turn does not open. */
      if (g.id === inhabited && !g.task && runUntil === null){ openTurn(g); return false; }
      decideGod(g, agePos.opts);
    }
    agePos.i++; agePos.prepared = false; agePos.opts = null;
  }
  return true;
}

function ageEnd(){
  agePos = null;
  for (const g of gods()) if (g.status !== 'dead' && g.acted > 0 && poleShare(g.pole) === 0) unmake(g);
  const gate = restGate(); creation.gate = gate;
  /* Before time there is only the Sundering; the world is not yet strained by what it lacks. */
  if (!gate.ok && pulseAge !== null) strain(gate.lack);
  if (pulseAge !== null) outgrown();
  if (!awakeGods().length){ settleNow = true; return; }
  if (age >= 2 * options.ageLimit){ creation.failed = true; for (const g of awakeGods()){ g.status = 'asleep'; g.asleep = true; } log('The gods sleep unfinished. The world would not hold.', [], 'bad'); settleNow = true; return; }
  if (age >= options.ageLimit) backstop();
}

function ageStep(){
  withGodRng(() => {
    if (!agePos) ageBegin();
    if (!ageDecide()) return;
    ageEnd();
  });
  if (settleNow){ settleNow = false; settle(); }
}
/* The creation itself, on a world that has already been reset. */
function beginCreation(){
  era = 'gods'; age = 0; pulseAge = null; legends = []; godNamePool = []; settleNow = false;
  godRng = mulberry32(hashSeed(seedText + ':gods'));
  creation = { ages: 0, backstops: 0, discards: 0, settled: false, failed: false, gate: null, made: {}, gestures: [], gestureAge: -1, choices: [] };
  deciding = null; saidFrom = 0; gestureFallbacks = {};
  withGodRng(() => initField());
}
function startCreation(seed, opts = {}){
  resetState(seed, opts);
  beginCreation();
}
function runAges(max = options.ageLimit * 2 + 2){ let n = 0; while (era === 'gods' && n++ < max) step(); return age; }

/* Once a day, the sleeping gods stir in their bodies. Built here so the fingerprint moves once; the waking rules
   come after the time model (spec section 5). Draws nothing yet. */
function godsTick(){ if (tick % CLOCK.every.godsRest !== 0) return; withGodRng(() => { for (const g of gods()) if (g.status === 'asleep') g.needs.rest = 100; }); }
