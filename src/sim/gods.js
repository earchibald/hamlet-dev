/* ---------- the primal gods ----------
   A god is a being in the beings list with the same shape as a person. Its place is a region, not a
   tile. Gods come into being from contrasts: the seed makes the first, and every other is made by a
   lack. In the gods era a step is an age; every awake god scores its acts over the live regions and
   does the best one, eldest first. Everything here draws from the gods' own stream. */
SPECIES.god = { glyph: '✶', label: 'god', plural: 'gods', decay: { expression: 0, company: 0, rest: 0, calm: 0 }, stride: 0, zmin: 0, zmax: 0, perTick: false };
LIFE.god = { adult: 0, old: Infinity, life: Infinity, death: 'killable' };
const GOD_NAMES = ['Ondru', 'Sael', 'Ashka', 'Veyl', 'Morrow', 'Ilse', 'Thrum', 'Kesh', 'Ubbe', 'Nyr', 'Tamsa', 'Orun'];
const EPITHET = { above: 'who is Above', below: 'who is Below', wet: 'who is Wet', dry: 'who is Dry', hot: 'who is Hot', cold: 'who is Cold', still: 'who is Still', moving: 'who Moves', light: 'who is Light', dark: 'who is Dark' };
/* What a god becomes when it sleeps. */
const BODY = { above: 'a hill', below: 'the deep', wet: 'the river', dry: 'the plain', hot: 'an ember', cold: 'the frost', still: 'a lake', moving: 'the wind', light: 'the day', dark: 'a cave' };
/* What a god leaves behind, beyond its body, when it sleeps. */
const LEAVES = { hot: name => `One spark of ${name} stays awake.` };
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

/* ---------- the creation's words ----------
   The text the player reads in the creation. The rules never read it. A pole, a lack, and a biome are
   rule words ("above", "start", "rocky"), and a player once read "it lacks start" in the legends, so
   every one of them is turned into plain words here before it reaches a line.
   A line in TELL with several wordings uses them in the listed order, one each time the line is
   said, and starts again at the first when they run out. The playtest of 20 Sept 2026 found each
   line repeated word for word, seven ages in a row for a god that kept splitting. The count lives in
   `creation.told`, so a save carries it and a replay tells the same story. It draws no random number,
   so the creation is the same as before; only the words change. */
/* A pole as the land wears it: "the land is high". */
const POLE_WORD = { above: 'high', below: 'low', wet: 'wet', dry: 'dry', hot: 'hot', cold: 'cold', still: 'still', moving: 'restless', light: 'bright', dark: 'dark' };
/* A pole as a god's domain: "a god of water". */
const GOD_OF = { above: 'the heights', below: 'the depths', wet: 'water', dry: 'dry land', hot: 'fire', cold: 'frost', still: 'stillness', moving: 'the wind', light: 'light', dark: 'darkness' };
/* What a lack is missing, to follow "lacks". The gate's lacks come first, then the kinds of life, then
   the lacks only the tile check at settle reports. */
const LACK_WORD = { start: 'a dry, level place where people can begin', water: 'water', fuel: 'wood to burn', food: 'food', people: 'people', height: 'hills', depth: 'caves',
  prey: 'animals to hunt', hunter: 'beasts that hunt', fae: 'fae folk', folk: 'a second people', ground: 'ground to camp on', room: 'room to move' };
/* A biome as a noun and as a place: "it becomes a meadow", "sets them loose in a meadow". */
const BIOME_PLACE = { river: ['a river valley', 'in a river valley'], wetland: ['wetland', 'in the wetlands'], forest: ['a forest', 'in a forest'], meadow: ['a meadow', 'in a meadow'], rocky: ['rocky ground', 'on rocky ground'], ash: ['ash', 'in the ashes'] };
/* A scar as the ground is left: "the ground is left burned". */
const SCAR_TEXT = { burned: 'burned', broken: 'broken', drowned: 'drowned', cut: 'torn open' };
const COUNT_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const countWord = n => COUNT_WORD[n] || String(n);
const lackWord = lack => LACK_WORD[lack] || lack;
const TELL = {
  formless: [() => 'Before there was time or place, there was only the formless.'],
  first: [v => `Out of the formless comes the first god. Its name is ${v.g}, a god of ${v.of}.`],
  sundering: [v => `The Sundering. ${v.g} splits the formless in two, ${v.a} on one side and ${v.b} on the other. Now there is a here and a there.`],
  pulse: [() => 'The Pulse. For the first time, something already made is changed. Now there is a before and an after, and time begins.'],
  split: [
    v => `${v.g} splits another stretch of land in two, ${v.a} on one side and ${v.b} on the other.`,
    v => `${v.g} draws a line across a piece of land. One side is ${v.a}, and the other is ${v.b}.`,
    v => `Another stretch of land is split. ${v.g} makes one half ${v.a} and leaves the other ${v.b}.`,
    v => `${v.g} cuts a piece of land in half, and keeps the ${v.a} half.`,
    v => `A new line runs through the land. ${v.g} is on the ${v.a} side of it, and the ${v.b} side lies beyond.`,
    v => `${v.g} divides a stretch of land again, ${v.a} from ${v.b}.`,
    v => `${v.g} marks a border across the land. This side is ${v.a}, and that side is ${v.b}.`,
    v => `The land parts once more under ${v.g}. Half of it is ${v.a} now, and half is ${v.b}.`,
  ],
  farSide: [
    v => `No god watches over the ${v.b} side of the line, so one wakes there. Its name is ${v.g}, a god of ${v.of}.`,
    v => `The ${v.b} half of the land has no god. Now it has ${v.g}, a god of ${v.of}.`,
    v => `${v.g} wakes on the ${v.b} side of the line, a god of ${v.of}. No god was there before.`,
  ],
  lack: [
    v => `Nothing can live in the world yet, because it lacks ${v.lack}. So ${v.g} wakes, a god of ${v.of}.`,
    v => `The world is not ready for life. It still lacks ${v.lack}. ${v.g}, a god of ${v.of}, wakes to help.`,
    v => `The world still lacks ${v.lack}. A new god wakes to change that. Its name is ${v.g}, a god of ${v.of}.`,
  ],
  onePair: [v => `So far every god is one side of the same split, such as wet and dry. People need more than one kind of difference. So ${v.g} wakes, a god of ${v.of}.`],
  outgrown: [
    v => `The land is now in more pieces than its gods can watch. ${v.g} wakes, a god of ${v.of}.`,
    v => `The world has grown too big for its gods. A new one wakes. Its name is ${v.g}, a god of ${v.of}.`,
  ],
  claim: [
    v => `${v.g} spreads, and a piece of land nearby turns ${v.a}.`,
    v => `${v.g} claims a stretch of land nearby and makes it ${v.a}.`,
    v => `More of the land turns ${v.a} as ${v.g} reaches out.`,
    v => `${v.g} pushes outward, and the land next to it becomes ${v.a}.`,
    v => `The ground near ${v.g} turns ${v.a}, one more piece at a time.`,
  ],
  make: [
    v => `${v.g} makes the ${v.plural} and sets them loose ${v.place}.`,
    v => `${v.g} makes ${v.plural}, and they spread out ${v.place}.`,
    v => `New creatures walk ${v.place}. ${v.g} has made the ${v.plural}.`,
    v => `${v.g} shapes more ${v.plural} and turns them loose ${v.place}.`,
  ],
  raiseBegin: [v => `${v.g} starts to push the land up into a hill.`, v => `${v.g} begins to lift the ground.`, v => `${v.g} sets to work on a new hill.`],
  raiseAgain: [v => `${v.g} goes back to the hill and lifts it higher.`, v => `${v.g} returns to the hill to raise it higher.`, v => `${v.g} takes up the work on the hill again.`],
  raiseMountain: [v => `${v.g} has raised a mountain, ${v.n} storeys high.`, v => `A mountain stands where ${v.g} worked, ${v.n} storeys of stone.`],
  raiseHill: [v => `${v.g} has raised a hill, ${v.n} ${v.one ? 'storey' : 'storeys'} high.`, v => `A hill stands where ${v.g} worked, ${v.n} ${v.one ? 'storey' : 'storeys'} high.`],
  raiseStop: [v => `${v.g} stops, and leaves the hill half raised.`, v => `${v.g} breaks off the work. The hill stays half raised.`, v => `${v.g} turns away from the hill for now.`],
  digBegin: [v => `${v.g} starts to dig down into the dark.`, v => `${v.g} begins to hollow out the ground.`, v => `${v.g} sets to work on a new cave.`],
  digAgain: [v => `${v.g} goes back to the cave and digs deeper.`, v => `${v.g} returns to the cave to dig it deeper.`, v => `${v.g} takes up the digging again.`],
  digDeep: [v => `${v.g} has dug a deep cave, ${v.n} levels down.`, v => `${v.g} has hollowed out the ground ${v.n} levels deep.`],
  digCave: [v => `${v.g} has dug a cave, ${v.n} ${v.one ? 'level' : 'levels'} deep.`, v => `A cave opens where ${v.g} dug, ${v.n} ${v.one ? 'level' : 'levels'} deep.`],
  digStop: [v => `${v.g} stops, and leaves the cave half dug.`, v => `${v.g} breaks off the digging. The cave stays half dug.`, v => `${v.g} turns away from the cave for now.`],
  flow: [
    v => `${v.g} runs across the land and leaves a winding path behind it.${v.under ? ' Part of the way, it runs under the ground.' : ''}`,
    v => `${v.g} winds through the land, from one place to the next.${v.under ? ' For a while, it runs under the ground.' : ''}`,
    v => `${v.g} makes a long trail across the land.${v.under ? ' Part of it goes under the ground.' : ''}`,
    v => `A new path crosses the land where ${v.g} has passed.${v.under ? ' Some of it runs under the ground.' : ''}`,
    v => `${v.g} finds a way through the land, and twists as it goes.${v.under ? ' For a stretch, it goes under the ground.' : ''}`,
    v => `${v.g} sets out again and crosses more of the land.${v.under ? ' Part of the way is under the ground.' : ''}`,
  ],
  pool: [v => `${v.g} gathers into a still pool.`, v => `${v.g} settles into a hollow, and the water lies still.`, v => `${v.g} spreads out into a quiet pool.`, v => `A new pool lies calm where ${v.g} came to rest.`],
  poolUnder: [v => `${v.g} makes a still pool under the ground.`, v => `${v.g} fills a hollow under the ground with still water.`],
  burn: [
    v => `${v.g} sets fire to another god's land, and it burns to ash.`,
    v => `${v.g} burns a stretch of land to ash.`,
    v => `Fire from ${v.g} sweeps across the land and leaves only ash.`,
  ],
  freeze: [v => `${v.g} breathes on the land, and frost settles there for good.`, v => `${v.g} freezes a stretch of land, and the frost does not leave.`],
  hide: [v => `${v.g} pulls the dark over the land. Things can hide there now.`, v => `${v.g} covers a stretch of land in shadow, and it becomes a place to hide.`],
  show: [v => `${v.g} fills the land with light, and it can be seen from far away.`, v => `${v.g} lights up a stretch of land, so it can be seen from a long way off.`],
  battle: [
    v => `${v.a} and ${v.b} fight over the same land. ${v.w} wins, and the ground is left ${v.scar}.`,
    v => `${v.a} and ${v.b} go to war over a piece of land. ${v.w} wins it, and the ground is ${v.scar}.`,
    v => `The rivals ${v.a} and ${v.b} clash again. ${v.w} comes out on top, and the ground is ${v.scar}.`,
    v => `War breaks out between ${v.a} and ${v.b}. ${v.w} wins, but the land is left ${v.scar}.`,
  ],
  twist: [
    v => `${v.g} changes the ${v.plural} that live on the scarred ground. They will never be quite like the others.`,
    v => `${v.g} bends the ${v.plural} on the scarred ground out of shape. They will not be like the others.`,
    v => `On the scarred ground, ${v.g} reshapes the ${v.plural}. They grow strange.`,
  ],
  mingle: [
    v => `${v.a} and ${v.b} meet and mix. The land between them is ${v.p} and ${v.q} at once, and it becomes ${v.biome}.`,
    v => `${v.a} and ${v.b} come together. Where they touch, the land is both ${v.p} and ${v.q}. It becomes ${v.biome}.`,
    v => `${v.a} and ${v.b} cannot stay apart. The land where they meet turns ${v.p} and ${v.q}, and becomes ${v.biome}.`,
    v => `Wherever ${v.a} finds ${v.b}, the ground changes. It becomes ${v.biome}.`,
    v => `${v.a} pulls ${v.b} close, and the land between them becomes ${v.biome}.`,
    v => `Where ${v.a} and ${v.b} linger, the land takes something from each of them. It becomes ${v.biome}.`,
  ],
  people: [() => 'Where they met, something stands up on two legs and looks around. The first people are made.'],
  sleep: [
    v => `${v.g} lies down to sleep and becomes ${v.body}.`,
    v => `${v.g} grows tired, and lies down to become ${v.body}.`,
    v => `${v.g} sleeps at last, and becomes ${v.body}.`,
  ],
  lovers: [v => `${v.a} and ${v.b} are lovers now.`, v => `${v.a} and ${v.b} fall in love.`],
  rivals: [v => `${v.a} and ${v.b} are rivals now.`, v => `${v.a} and ${v.b} turn against each other. They are rivals now.`],
  unmade: [v => `No land anywhere is ${v.a} now, so ${v.g} cannot go on. It fades away, and the ground where it stood is ${v.scar}.`],
  unmadeAsleep: [v => `No land anywhere is ${v.a} now, so ${v.g} dies in its sleep. The ground where it lay is ${v.scar}.`],
  backstop: [
    v => `The ages drag on, and the world still lacks ${v.lack}. ${v.g} is weary, and tries to make it alone.`,
    v => `${v.g} grows tired of waiting, and tries to give the world ${v.lack} by itself.`,
    v => `The world still lacks ${v.lack}. ${v.g} cannot wait any longer, and tries to do it alone.`,
    v => `${v.g} has had enough of waiting. It tries once more to give the world ${v.lack}.`,
  ],
  failed: [() => 'The gods are worn out. They sleep with their work unfinished, and the world is not ready.'],
  settle: [v => `The last of the gods sleeps. After ${v.n} ages, the world is still, and waits.`],
  thrownBack: [v => `${v.g} wakes again. The land is not ready for people: it still lacks ${v.lack} close to where the first of them would stand. The ages go on.`],
  thrownBackAlone: [v => `The land is not ready for people: it still lacks ${v.lack} close to where the first of them would stand. The ages go on.`],
  unfinished: [v => `The world is left unfinished. It lacks ${v.lack}, and ${v.why}.`],
  cap: [v => `The gods made ${v.plural} in many places. ${v.n ? `Only ${countWord(v.n)} of them` : 'None of them'} came down into the valley.`],
};
/* The line for `key`, in the next of its wordings. It counts one telling, so call it only for a line
   that is logged. */
function tell(key, v = {}){
  const told = creation.told || (creation.told = {});
  const k = told[key] || 0; told[key] = k + 1;
  const ways = TELL[key];
  return ways[k % ways.length](v);
}

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

/* `say` writes the god's first line from the god it is given, since the name is drawn here. */
function makeGod(pole, region, say){
  beginAct();
  if (!godNamePool.length) godNamePool = shuffle(GOD_NAMES);
  const g = makeBeing('god', 0, 0, null, 0);
  g.name = godNamePool.pop(); g.pole = pole; g.contrast = POLES[pole].contrast; g.epithet = EPITHET[pole];
  g.status = 'awake'; g.born = age; g.acted = 0; g.at = null;
  g.needs = { expression: 60, company: 60, rest: 90, calm: 80 };
  g.skills = {}; for (const k in GOD_ACTS) g.skills[k] = 0;
  beings.push(g);
  log(say(g), [g], 'major');
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
  if (mine >= 40 && theirs >= 40 && g.rel[o.id] !== 'lover'){ g.rel[o.id] = o.rel[g.id] = 'lover'; log(tell('lovers', { a: g.name, b: o.name }), [g, o], 'good'); }
  else if ((mine <= -40 || theirs <= -40) && g.rel[o.id] !== 'rival'){ g.rel[o.id] = o.rel[g.id] = 'rival'; log(tell('rivals', { a: g.name, b: o.name }), [g, o], 'bad'); }
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
    addThought(o, 'over' + g.id, `${g.name} marked over my land`, -10, CLOCK.thought.over); setRelation(o, g); }
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
    apply(g, r){
      const left = 1 + Math.round(g.traits.diligence * 3); g.task = { type: kind === 'height' ? 'raise' : 'dig', region: r.id, left, done: 0 };
      /* Work on a hill or a cave already begun says so. The words read the mark, and no rule does. */
      const again = marksOf(r, kind).length > 0;
      log(tell(kind === 'height' ? (again ? 'raiseAgain' : 'raiseBegin') : (again ? 'digAgain' : 'digBegin'), { g: g.name }), [g]);
      this.continue(g, g.task); return true;
    },
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
      if (wasRoot) log(tell('sundering', { g: g.name, a: POLE_WORD[g.pole], b: POLE_WORD[other] }), [g], 'major');
      else log(tell('split', { g: g.name, a: POLE_WORD[g.pole], b: POLE_WORD[other] }), [g]);
      /* The cut is recorded before the far side's god, so the line is drawn before the star fades in on it. */
      gesture(g, 'split', { near: cut.a.id, far: cut.b.id, line: cut.boundary.tiles, pole: g.pole, other });
      if (!godOf(other)) makeGod(other, cut.b, n => tell('farSide', { g: n.name, b: POLE_WORD[other], of: GOD_OF[other] }));
      return true;
    },
  },
  claim: {
    /* A god sets its pole on a country beside its home. The peaceful way to spread a nature once the splitting is done;
       it offends whoever marked the country before, and offence makes rivals. */
    poles: null,
    targets(g){ const home = settleHome(g); if (!home) return []; const few = fewStarts(); return [home, ...neighboursOf(home)].filter(r => !hasPole(r, g.pole) && !r.marks.some(m => m.kind === 'rest') && !(few && isStart(r))); },
    score: (g, r) => (100 - g.needs.expression) * 0.6 + 5 + rng() * 8,
    apply(g, r){ offend(r, g, g.contrast); const m = setPole(r, g.pole, g, `${g.name} claimed it.`); r.lastBy = g.id; r.lastAge = age; log(tell('claim', { g: g.name, a: POLE_WORD[g.pole] }), [g]); gesture(g, 'claim', { region: r.id, pole: g.pole, at: m.at }); return true; },
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
      log(tell('make', { g: g.name, plural: SPECIES[sp].plural, place: BIOME_PLACE[biomeOf(r)][1] }), [g], 'major');
      gesture(g, 'make', { region: r.id, species: sp, at: m.at });
      return true;
    },
  },
  raise: {
    poles: ['above'],
    /* The gods leave the last level countries and the last start candidates alone. */
    targets: g => { const few = fewLevel(), fewS = fewStarts(); return liveRegions().filter(r => hasPole(r, 'above') && !((few && isLevel(r)) || (fewS && isStart(r)))); },
    score: (g, r) => (100 - g.needs.expression) * 0.8 + 20 * g.traits.diligence + (marksOf(r, 'height').length ? -10 : 10) + rng() * 8,
    ...spendAges('height', 'raise the land', (g, n) => tell(n >= 3 ? 'raiseMountain' : 'raiseHill', { g: g.name, n: countWord(n), one: n === 1 })),
  },
  dig: {
    poles: ['below'],
    /* The gods leave the last level countries and the last start candidates alone. */
    targets: g => { const few = fewLevel(), fewS = fewStarts(); return liveRegions().filter(r => hasPole(r, 'below') && !((few && isLevel(r)) || (fewS && isStart(r)))); },
    score: (g, r) => (100 - g.needs.expression) * 0.8 + 20 * g.traits.diligence + (marksOf(r, 'depth').length ? -10 : 10) + rng() * 8,
    ...spendAges('depth', 'dig into the dark', (g, n) => tell(n >= 3 ? 'digDeep' : 'digCave', { g: g.name, n: countWord(n), one: n === 1 })),
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
      log(tell('flow', { g: g.name, under: path.some(p => marksOf(p, 'depth').length) }), [g], 'major');
      gesture(g, 'flow', { path: anchors });
      return true;
    },
  },
  pool: {
    poles: ['wet', 'still'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'pool') && (hasPole(r, 'wet') || hasPole(r, 'still') || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.7 + 10 + rng() * 8,
    apply(g, r){ const m = mark(r, 'pool', marksOf(r, 'depth').length ? 'under' : 'surface', g, `${g.name} pooled here.`); r.lastBy = g.id; r.lastAge = age; log(tell(m.value === 'under' ? 'poolUnder' : 'pool', { g: g.name }), [g]); gesture(g, 'pool', { region: r.id, under: m.value === 'under', at: m.at }); return true; },
  },
  burn: {
    poles: ['hot'],
    /* The last start candidates are not burned while fewer than three remain, as they are not raised. */
    targets: g => { const few = fewStarts(); return liveRegions().filter(r => !marksOf(r, 'scar').length && !(few && isStart(r)) && r.marks.some(m => m.by !== null && m.by !== g.id && !m.inherited)); },
    score: (g, r) => (100 - g.needs.calm) * 0.6 + g.traits.temper * 20 - 30 + rng() * 8,
    apply(g, r){ offend(r, g); const m = mark(r, 'scar', 'burned', g, `${g.name} burned it.`); r.lastBy = g.id; r.lastAge = age; log(tell('burn', { g: g.name }), [g], 'bad'); gesture(g, 'burn', { region: r.id, at: m.at }); return true; },
  },
  freeze: {
    poles: ['cold'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'freeze') && (marksOf(r, 'height').length || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.7 + (marksOf(r, 'height').length ? 15 : 0) + rng() * 8,
    apply(g, r){ const m = mark(r, 'freeze', true, g, `${g.name} froze it.`); r.lastBy = g.id; r.lastAge = age; log(tell('freeze', { g: g.name }), [g]); gesture(g, 'wash', { region: r.id, value: 'freeze', at: m.at }); return true; },
  },
  hide: {
    poles: ['dark'],
    targets: g => liveRegions().filter(r => !hasMark(r, 'hide') && (marksOf(r, 'depth').length || r.id === g.region)),
    score: (g, r) => (100 - g.needs.expression) * 0.7 + (marksOf(r, 'depth').length ? 15 : 0) + rng() * 8,
    apply(g, r){ const m = mark(r, 'hide', true, g, `${g.name} hid it.`); r.lastBy = g.id; r.lastAge = age; log(tell('hide', { g: g.name }), [g]); gesture(g, 'wash', { region: r.id, value: 'hide', at: m.at }); return true; },
  },
  show: {
    poles: ['light'],
    targets: g => { const r = settleHome(g); return r ? [r, ...neighboursOf(r)].filter(q => !hasMark(q, 'show')) : []; },
    score: (g, r) => (100 - g.needs.expression) * 0.7 + rng() * 8,
    apply(g, r){ const m = mark(r, 'show', true, g, `${g.name} showed it.`); r.lastBy = g.id; r.lastAge = age; log(tell('show', { g: g.name }), [g]); gesture(g, 'wash', { region: r.id, value: 'show', at: m.at }); return true; },
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
      log(tell('battle', { a: g.name, b: v.name, w: win.name, scar: SCAR_TEXT[SCAR_OF[win.pole]] }), [g, v], 'bad');
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
      log(tell('twist', { g: g.name, plural: SPECIES[m.value].plural }), [g], 'bad');
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
      log(tell('mingle', { a: g.name, b: o.name, p: POLE_WORD[g.pole], q: POLE_WORD[o.pole], biome: BIOME_PLACE[biomeOf(r)][0] }), [g, o], 'major');
      if (!liveRegions().some(q => hasMark(q, 'making', 'human'))){ mark(r, 'making', 'human', g, `Where ${g.name} and ${o.name} mingled, the people were made.`); log(tell('people'), [g, o], 'major'); }
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
      log(tell('sleep', { g: g.name, body: BODY[g.pole] }), [g], 'major');
      if (LEAVES[g.pole]) log(LEAVES[g.pole](g.name), [g], 'major');
      gesture(g, 'sleep', { region: r.id, body: BODY[g.pole], at: m.at });
      return true;
    },
  },
};

/* What a god will not do. Each bar names the trait its act's score already reads, and a floor under
   which the player is told no. A bar is a lens on the matrix the player is shown; the autonomous
   chooser never reads it, so a bar cannot move the creation. Force Actions takes a barred option
   anyway, and it costs the god nothing. */
const GOD_BARS = {
  battle: { trait: 'bravery', floor: 0.35, why: 'is not bold enough to make war' },
  burn: { trait: 'temper', floor: 0.3, why: 'is too calm to set anything alight' },
  mingle: { trait: 'sociability', floor: 0.25, why: 'keeps too much to itself for that' },
};
function barFor(g, type){
  const bar = GOD_BARS[type];
  return bar && g.traits[bar.trait] < bar.floor ? bar : null;
}
/* godOptions and decideGod draw from rng; call them inside withGodRng, as ageStep does. */
function godOptions(g){
  const opts = [];
  for (const name in GOD_ACTS){ const act = GOD_ACTS[name]; if (act.poles && !act.poles.includes(g.pole)) continue;
    for (const r of act.targets(g)){ const s = act.score(g, r); if (s > 0) opts.push({ type: name, label: name, region: r, score: Math.round(s) }); } }
  opts.sort((p, q) => q.score - p.score);
  return opts;
}
/* A god with too little calm or too little expression drops the act it carries. This runs in the
   once-per-god preparation in `ageDecide`, for every god, before any turn can open: a god that
   abandons its act has a free choice, and the player must be shown it. `decideGod` therefore keeps
   only the continue branch. Nothing here draws a random number. */
function abandonUnfinished(g){
  if (!g.task) return;
  if (g.needs.calm < 20 || g.needs.expression < 15){ log(tell(g.task.type === 'raise' ? 'raiseStop' : 'digStop', { g: g.name }), [g]); g.task = null; }
}

/* The decision is kept, not only the last one. `lastChoice` is what the god's card reads now; the
   record in `creation.choices` is what the timeline reads, age by age, and what the annals inherit.
   Nothing here draws a random number, so the creation is unmoved. */
function decideGod(g, given){
  if (g.task){ const t = g.task;
    beginAct(); creation.choices.push({ age, god: g.id, continued: true, type: t.type }); GOD_ACTS[t.type].continue(g, t); return; }
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
      if (c) makeGod(CONTRASTS[c][0], null, n => tell('onePair', { g: n.name, of: GOD_OF[n.pole] }));
    }
    return;
  }
  const poles = KINDS.includes(lack) ? polesThatMake(lack) : STRAIN[lack];
  const pole = poles.find(p => !godOf(p)) || poles[0];
  const g = godOf(pole);
  if (!g) makeGod(pole, null, n => tell('lack', { g: n.name, of: GOD_OF[pole], lack: lackWord(lack) }));
  /* A present god is pressed to express its pole. A lack of a kind of life is answered by making, which reads the gate itself. */
  else if (g.status === 'awake' && !KINDS.includes(lack) && lack !== 'food') g.needs.expression = Math.max(0, g.needs.expression - 10);
}

/* ---------- the ages ---------- */
function firstGod(){
  const cs = Object.keys(CONTRASTS); const c = cs[rint(cs.length)]; const pole = CONTRASTS[c][rint(2)];
  log(tell('formless'), [], 'major');
  makeGod(pole, field.root, n => tell('first', { g: n.name, of: GOD_OF[pole] }));
}
/* A god whose pole is gone from the whole live field is unmade. Its death is a scar. */
function unmake(g){
  beginAct();
  const wasAsleep = g.status === 'asleep';
  g.status = 'dead'; g.alive = false; g.asleep = false;
  const r = settleHome(g) || liveRegions()[0];
  mark(r, 'scar', SCAR_OF[g.pole], g, `${g.name} died here, unmade.`);
  log(tell(wasAsleep ? 'unmadeAsleep' : 'unmade', { g: g.name, a: POLE_WORD[g.pole], scar: SCAR_TEXT[SCAR_OF[g.pole]] }), [g], 'death');
  /* The star fades out where it last stood, so the anchor it held is the anchor it keeps. */
  gesture(g, 'unmade', { region: r ? r.id : null, at: g.at });
}
/* Where the backstop grows the forest a lack of fuel asks for. Fuel is a forest within two of the
   start, and dry and cold is a forest. The backstop once made the start hot, and dry and hot is a
   meadow, so on seed s5 it tried four ages running and supplied no wood. It picks a country near the
   start, largest first: a dry one that is not a start, then any dry one, then one with no water pole.
   It never dries a wet country, because that may be the start's water. A burned country is ash
   whatever its poles, so it is passed over. The start itself is the last choice: dry and cold, it
   stays a start. Nothing here draws a random number. */
function forestFor(start){
  const near = ring(start, 2).filter(r => r !== start && !hasMark(r, 'scar', 'burned'));
  const largest = rs => rs.slice().sort((p, q) => q.area - p.area)[0];
  return largest(near.filter(r => hasPole(r, 'dry') && !isStart(r))) || largest(near.filter(r => hasPole(r, 'dry'))) || largest(near.filter(r => !hasPole(r, 'wet'))) || start;
}
/* Past the age limit the eldest awake god does what has to be done, once an age, and every awake god
   wearies. At twice the limit the creation fails and everyone sleeps. */
function backstop(){
  const gate = restGate(); const g = awakeGods()[0]; if (!g || gate.ok) return;
  beginAct();
  creation.backstops++;
  log(tell('backstop', { g: g.name, lack: lackWord(gate.lack) }), [g], 'major');
  const live = liveRegions();
  const starts = startCandidates();
  let pool = live.filter(r => !isStart(r));
  if (!pool.length) pool = starts.length > 1 ? starts.slice().sort((p, q) => p.area - q.area).slice(0, 1) : live;
  /* Each branch names the country it marked and the mark it wrote, so the backstop draws like any other act. */
  let on = null, m = null;
  if (gate.lack === 'start'){ const r = live.slice().sort((p, q) => q.area - p.area)[0]; r.marks = r.marks.filter(m => !(m.kind === 'pole' && POLES[m.value].contrast === 'height') && m.kind !== 'scar' && m.kind !== 'height' && m.kind !== 'depth'); on = r; m = setPole(r, 'dry', g, 'Made dry so the world could hold a life.'); }
  else if (gate.lack === 'water'){ const n = neighboursOf(gate.start)[0] || gate.start; on = n; m = setPole(n, 'wet', g, 'Made wet so the world could hold a life.'); }
  else if (gate.lack === 'fuel'){ const r = forestFor(gate.start); on = r; if (!hasPole(r, 'dry')) setPole(r, 'dry', g, 'Made dry so a forest could grow.'); m = setPole(r, 'cold', g, 'Made cold so a forest could grow.'); }
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
  if (c) makeGod(CONTRASTS[c][0], null, n => tell('outgrown', { g: n.name, of: GOD_OF[n.pole] }));
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

/* Who the player is, and the turn that is open. `inhabited` is null, or `{ id, mode }`: the being the
   player is and how they hold it. `mode` is `become` here, and the other three modes name themselves
   the day each is built, so no read site has to change again. `pending` is null, or the god whose turn
   it is with the matrix it was given. The engine will not step while `pending` is set: this is the
   locked clock the mythos spec reserved. */
let inhabited = null;
let pending = null;

/* Whether the player has been told their god can act no more. One line, not one an age. */
let inhabitedTold = false;

/* The age the autopilot runs to. Null when the player is choosing. Task 6 gives it its act. */
let runUntil = null;

/* The stops the player set. A stop on an age is what this slice builds; a stop on an event needs an
   event kind on every chronicle line, which is G's watch list and is not written. The act is shaped
   to take that kind the day it exists. */
let stops = [];

/* Fill the open turn. The once-per-god preparation (settleHome, godNeeds) runs in ageDecide, not
   here, so it happens exactly once however many times the turn is opened. The matrix is drawn once
   and kept on `agePos.opts`; re-opening the same god's turn, after the player left and came back,
   reuses it and draws nothing. */
function openTurn(g){
  if (!agePos.opts) agePos.opts = godOptions(g);
  pending = { god: g.id, age, opts: agePos.opts.map(o => {
    const row = { type: o.type, label: o.label, score: o.score, region: o.region.id };
    const bar = barFor(g, o.type); if (bar) row.bar = bar;
    return row;
  }) };
}

/* The age moves past the god at `agePos.i`. The preparation and the drawn matrix belong to that god
   alone, so they are dropped with it. Both paths that advance the age call this, and there is one
   copy of the invariant. */
function agePass(){ agePos.i++; agePos.prepared = false; agePos.opts = null; }

/* Apply one option for the god whose turn is open. An option that does not land leaves the turn open
   with its row marked failed, because the player is owed the reason; the autonomous god falls to the
   next option in silence. */
function takeTurn(opt){
  const g = beingById(pending.god);
  const k = pending.opts.findIndex(o => o.type === opt.type && o.region === opt.region);
  if (k < 0) return 'That is not on the table.';
  const row = pending.opts[k];
  if (row.bar && !options.force) return `${beingById(pending.god).name} ${row.bar.why}.`;
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
  agePass();
  /* The act is applied and the age has moved past the god. It is not resumed here. A step resumes it,
     and a step is the only thing that advances an age, whoever asked for the act. The player's choice
     is then one act among the age's acts, and a view that plays one act at a time plays it like any
     other instead of watching the rest of the age go by while it draws the one it was given.
     Pacing stays out of the door: the door carries the act and nothing about the rate it is drawn at,
     so a log still replays the same story. */
  return `You ${row.type}. ${g.name} acts.`;
}

/* The player leaves, or the god whose turn was open is gone. This only closes the open turn: it does
   not resume the age. Nothing resumes an age but a step, which finds `agePos` still standing and
   carries the age on from where it stood, through `ageDecide`. `takeTurn` closes its turn the same
   way and for the same reason, so there is one rule and no copy of it to keep in step. */
function releaseTurn(){
  pending = null;
}

function ageBegin(){
  age++;
  /* The gestures replay one age. The list is replaced at the head of the next, before anything acts. */
  creation.gestures = []; creation.gestureAge = age;
  if (age === 1) firstGod();
  /* The Pulse comes in the age after the Sundering: the first age in which a made country can change. */
  if (pulseAge === null && field.root.children){ pulseAge = age; log(tell('pulse'), [], 'major'); }
  agePos = { i: 0, list: gods(), prepared: false, opts: null };
  /* A run ends at the age it named, or at the first stop that names this age. The line says why, so
     the player is never stopped without a reason. */
  if (runUntil !== null){
    const stop = stops.find(s => s.what === 'age' && s.at === age);
    /* A stop that fired is spent. It is taken off the list, so a later run past this age is not
       stopped again by a mark the player already saw reached. */
    if (stop){ runUntil = null; stops.splice(stops.indexOf(stop), 1); note(`Age ${age}. The stop you set is reached.`); }
    else if (age >= runUntil){ runUntil = null; note(`Age ${age}. The run you set is over.`); }
  }
}

/* A god that sleeps, dies, or is unmade decides nothing, so no turn opens for it ever again. The
   player is told once, and is told nothing more until they take another god. */
function tellIfGone(){
  if (!inhabited || inhabitedTold) return;
  const me = beingById(inhabited.id);
  if (me && me.status === 'awake') return;
  inhabitedTold = true;
  note(`${me ? me.name : 'The god you took'} acts no more. Take another god, or watch.`);
}

/* The gods of this age, as they stood when it began, and where we are among them. The list is taken
   once an age and never retaken, so a suspended age resumes through the same gods the age started
   with, and a god born mid-age waits for the next age exactly as it always did.
   `agePos.prepared` and `agePos.opts` belong to the god at `agePos.i` alone: settleHome, godNeeds,
   and the drawn matrix run or are drawn once for that god, however many times its turn is opened
   and abandoned before the age moves past it.

   Two things stop the age, and `false` means either of them. A turn is open and waits on the player,
   or `oneAct` was asked for and one god has acted. `pending` tells them apart: it is set for the
   first and null for the second. Both leave `agePos` standing and both resume through this function,
   so there is one copy of the loop and one copy of the invariant above.

   With `oneAct` this stops being a once-an-age entry point and becomes a once-an-act one. Anything
   put at the head of it runs per act from then on. `tellIfGone` is written to bear that: it is
   idempotent through `inhabitedTold`, it draws no random number, and its line is the better for
   arriving when the god goes rather than at the end of the age. Anything added beside it must be
   read against the same three tests. */
function ageDecide(oneAct){
  tellIfGone();
  const list = agePos.list;
  while (agePos.i < list.length){
    const g = list[agePos.i];
    let acted = false;
    if (g.status === 'awake'){
      if (!agePos.prepared){ settleHome(g); godNeeds(g); abandonUnfinished(g); agePos.prepared = true; }
      /* The player's god with a free choice stops the age here. A god carrying an act has no choice
         to make, so it carries on and the turn does not open. */
      if (inhabited && g.id === inhabited.id && !g.task && runUntil === null){ openTurn(g); return false; }
      decideGod(g, agePos.opts);
      acted = true;
    }
    agePass();
    /* After `agePass`, never before it: a return with the position unmoved resumes into the same god
       with `prepared` already true, and `decideGod` runs a second time against a matrix drawn once.
       Only for a god that acted: an asleep god is passed over, and stopping there hands the view a
       beat in which nothing happened. */
    if (oneAct && acted) return false;
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
  if (age >= 2 * options.ageLimit){ creation.failed = true; for (const g of awakeGods()){ g.status = 'asleep'; g.asleep = true; } log(tell('failed'), [], 'bad'); settleNow = true; return; }
  if (age >= options.ageLimit) backstop();
}

/* The ages are over. What only an age could read goes with them: a position in an age, an open turn,
   a run, and the stops it would have ended at. None of them can fire once the days begin, and a stale
   one would be carried into a save of the days era. Who the player is outlives the ages, so
   `inhabited` and `inhabitedTold` stay.
   It runs only when the valley held. A settle may discard the valley and hand the ages back, and a
   discarded valley must not cost the player the run they set. */
function endAges(){ if (era !== 'days') return; agePos = null; pending = null; runUntil = null; stops = []; }

/* The one way the creation ends. Two paths reach it: an age that runs to its end in `ageStep`, and an
   age that runs to its end inside the player's own turn, in `takeTurn`. Both must end the ages the
   same way, so neither calls `settle` itself. A settle that discards the valley leaves the era in the
   ages, and `endAges` does nothing then, so the player keeps the run and the stops they set. */
function settleIfDue(){ if (!settleNow) return; settleNow = false; settle(); endAges(); }

/* One age, or with `oneAct` one god of it. The age's close is never divided: `ageEnd` unmakes the
   gods that hold nothing and only then reads the rest gate, so a view that drew between the two
   would show gods already gone against a gate that still counts them, and `strain` and `outgrown`
   read that same gate. The close is one beat or it is none. */
function ageStep(oneAct){
  withGodRng(() => {
    if (!agePos) ageBegin();
    if (!ageDecide(oneAct)) return;
    ageEnd();
  });
  settleIfDue();
}
/* The creation itself, on a world that has already been reset. */
function beginCreation(){
  era = 'gods'; age = 0; pulseAge = null; legends = []; godNamePool = []; settleNow = false;
  godRng = mulberry32(hashSeed(seedText + ':gods'));
  creation = { ages: 0, backstops: 0, discards: 0, settled: false, failed: false, gate: null, made: {}, gestures: [], gestureAge: -1, choices: [], told: {} };
  deciding = null; saidFrom = 0; gestureFallbacks = {};
  agePos = null; pending = null; inhabited = null; inhabitedTold = false; runUntil = null; stops = [];
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
