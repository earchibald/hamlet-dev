/* ---------- names: the record, the second stream, and the old tongue ----------
   A name is a record. Every nameable thing keeps a list of records, newest
   first. The list never loses a record, so a chronicle line written under an
   old name can still be read back.

   Nothing in this file draws from the world stream `rng`. It has a stream of
   its own, seeded from the world seed with the salt ':names'. That is why the
   land, the beings, and the items of a seed never move when a name is given.
   Rules read the tables here. No rule reads name text. */
let nrng = null, lore = null, tongue = null, valley = null, river = null, stillWater = null, ponds = null, fords = null, nameIndex = null, usedMeanings = null;

function seedNames(){
  nrng = mulberry32(hashSeed(seedText + ':names'));
  tongue = null; lore = null;
  nameIndex = new Map(); usedMeanings = new Set();
  valley = { names: [] };
  river = null; stillWater = null;
  ponds = []; fords = [];
}
const nint = n => Math.floor(nrng() * n);
const npick = list => list[nint(list.length)];
function nshuffle(arr){ const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = nint(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const cap = w => w[0].toUpperCase() + w.slice(1);
const titleCase = s => s.split(' ').map((w, i) => i === 0 && w === 'the' ? w : cap(w)).join(' ');

/* The record. `by` is the id of the being that named it, or 'lost' for the old tongue.
   `scores` is the candidate list the namer kept, as lastChoice keeps a decision. */
function nameRecord(text, o = {}){
  return { text, tongue: o.tongue || 'plain', meaning: o.meaning || '', since: tick,
    why: o.why || '', by: o.by === undefined ? 'lost' : o.by, scores: o.scores || null };
}
/* Give a thing a name. An old name starts unknown: somebody has to find the marks. */
function giveName(thing, rec){
  if (!thing.names) thing.names = [];
  thing.names.unshift(rec);
  nameIndex.set(rec.text.toLowerCase(), thing);
  if (rec.tongue === 'old'){ if (thing.nameKnown === undefined) thing.nameKnown = false; }
  else thing.nameKnown = true;
  return rec;
}
const nameOf = thing => thing && thing.names && thing.names.length ? thing.names[0].text : null;
const formerNames = thing => (thing && thing.names ? thing.names.slice(1) : []);
const nameTaken = text => nameIndex.has(String(text).toLowerCase());
function nameRecordOf(text){
  const key = String(text).toLowerCase(), thing = nameIndex.get(key);
  return thing ? (thing.names.find(r => r.text.toLowerCase() === key) || null) : null;
}
/* Everything that can hold a name, for the uniqueness check and the chronicle search. In the gods
   era, and right after a discarded settle, some of these lists are not yet made. */
function nameThings(){
  return [valley, river, stillWater, ...camps, ...(sectors || []), ...(hills || []), ...(caves || []), ...(groves || []), ...fords, ...ponds].filter(Boolean);
}

/* ---------- the old tongue ----------
   A syllable table is built from the name stream at generation. An old name is
   one or two words of one to three syllables. */
const OLD_ONSETS = ['v', 'k', 't', 'm', 's', 'r', 'n', 'l', 'th', 'sk', 'br', 'dr'];
const OLD_VOWELS = ['a', 'e', 'i', 'o', 'u'];
const OLD_CODAS = ['n', 'l', 'r', 's', 'k', 'm', 'sk', 'th'];
/* Pairs a mouth trips over. A syllable that would end in one drops its coda instead. */
const OLD_FORBID = [['sk', 'sk'], ['sk', 's'], ['sk', 'k'], ['th', 'th'], ['s', 'sk'], ['s', 's'], ['r', 'r'], ['l', 'l'], ['n', 'n'], ['m', 'm'], ['br', 'r'], ['dr', 'r'], ['t', 'th']];
function buildTongue(){
  return { onsets: nshuffle(OLD_ONSETS).slice(0, 8 + nint(5)), vowels: OLD_VOWELS.slice(), codas: nshuffle(OLD_CODAS).slice(0, 6 + nint(3)) };
}
function oldSyllable(){
  if (!tongue) tongue = buildTongue();
  const on = npick(tongue.onsets), v = npick(tongue.vowels);
  const coda = nrng() < 0.5 ? npick(tongue.codas) : '';
  return OLD_FORBID.some(([a, b]) => a === on && b === coda) ? on + v : on + v + coda;
}
/* A forbidden pair can also fall across the seam of two syllables (a coda's last
   letters meeting the next onset), which a single syllable cannot see on its own.
   So a word tries a fresh syllable, up to 30 times, until the seam is clean. A word
   is also kept short and sayable: two long onsets and codas in a row can run past
   what one to three syllables should read as, so a word too long tries again whole. */
function oldWordOnce(){
  let w = '';
  for (let k = 0, n = 1 + nint(3); k < n; k++){
    let cand = w;
    for (let tries = 0; tries < 30; tries++){
      cand = w + oldSyllable();
      if (!OLD_FORBID.some(([a, b]) => cand.includes(a + b))) break;
    }
    w = cand;
  }
  return w;
}
function oldWord(){
  let w = oldWordOnce();
  for (let tries = 0; tries < 20 && w.length > 12; tries++) w = oldWordOnce();
  return cap(w);
}
function oldName(){ return nrng() < 0.35 ? `${oldWord()} ${oldWord()}` : oldWord(); }

/* What the old names mean. A meaning is never used twice in one world. */
const LAND_WORDS = [
  'the sleeping hill', 'where the water turns', 'the pines that watch', 'the stone that does not move',
  'the cold spring', 'the place of many birds', 'the long shadow', 'the first light',
  'the hollow under the rock', 'where the deer cross', 'the quiet ground', 'the wind from the north',
  'the black earth', 'the old fire', 'where the river forgets', 'the bones of the hill',
  'the bright water', 'the last tree', 'the low mist', 'the broken rim',
  'where the ice stays', 'the round stone', 'the deep dark', 'the loud water',
  'the bare crown', 'the green step', 'the hidden mouth', 'where the wolves sing',
  'the red clay', 'the thin path', 'the high seat', 'the wet hollow',
  'the still pool', 'the burnt slope', 'where the wind rests', 'the grey face',
  'the salt ground', 'the small light', 'the heavy rock', 'the last watch',
];
function takeMeaning(){
  const free = LAND_WORDS.filter(w => !usedMeanings.has(w));
  if (!free.length) return '';
  const w = npick(free); usedMeanings.add(w); return w;
}
/* One old name with its meaning, or null when the world has run out of either. A name with
   no meaning is not a name, so the meaning is taken first and given back on failure. */
function newOldName(why){
  const meaning = takeMeaning(); if (!meaning) return null;
  for (let k = 0; k < 10; k++){
    const text = oldName();
    if (!nameTaken(text)) return nameRecord(text, { tongue: 'old', meaning, why: why || `the old people called it ${meaning}` });
  }
  usedMeanings.delete(meaning); return null;
}

/* ---------- the lore of the lost people ----------
   Each world gets a lost people, what they built, what took them, a name for the
   sky, which is the player, and a name for the sprites. Tables, no rules.
   Nothing reads these but the namer and the interface. */
const LORE_BUILT = [
  'they raised the stones on the hills',
  'they cut the passages under the water',
  'they kept fire in bowls of stone',
  'they walled the fords with rough blocks',
  'they carved marks at every cave mouth',
  'they planted the pines in straight rows',
  'they dug wells that still hold water',
  'they built low houses with turf roofs',
];
const LORE_TOOK = [
  'a winter that did not end',
  'the wolves',
  'they walked west and did not come back',
  'a sickness that took the children first',
  'the water rose and stayed',
  'a fire that ran from hill to hill',
  'they quarrelled and scattered',
  'nobody knows, and no bones say',
];
const SKY_MEANINGS = ['the one who gives fire', 'the eye that does not close', 'the hand above the hill', 'the breath in the smoke', 'the one who watches the fire', 'the thrower of light'];
const SPRITE_MEANINGS = ['the small lights', 'the ones who take', 'the laughers in the pine', 'the cold candles', 'the children of the hollow', 'the quick ones'];

/* The whole naming pass over a fresh valley. `settle()` calls it once the valley is final,
   after `era = 'days'`, so an undone settle never names anything and no name line lands in
   the legends. It draws from the name stream only, and it writes nothing the world stream
   reads, so a seed's land, beings, and items do not move. */
function nameTheLand(){
  tongue = buildTongue();
  lore = {
    people: `the ${oldWord()}`,
    built: npick(LORE_BUILT),
    took: npick(LORE_TOOK),
    sky: { text: oldWord(), meaning: npick(SKY_MEANINGS) },
    sprites: { text: oldWord(), meaning: npick(SPRITE_MEANINGS) },
  };
  findWaters();
  oldNamesOnTheLand();
}

/* A body of this many tiles or fewer is a pond, not a water to name. */
const POND_TILES = 12;
/* Two fords closer than this are one crossing. The painter lays three sand tiles in a run. */
const FORD_APART = 3;
/* The caves that carry an old name. A burrow is dug by gnomes, at settle and again mid-game,
   so it never belonged to the lost people. */
const OLD_CAVE_KINDS = ['water', 'den', 'hollow'];

/* The water of the valley, found once by walking it. The great water is the river a wet god
   drew, where there is one; where no god drew one, it is the largest body standing, a lake.
   Anything small is a pond. Each water tile keeps a pointer to its record in `t.water`, so a
   person beside the water knows what they stand beside. `t.river` is the painter's boundary
   id and is only read here. This reads the map and draws no random numbers at all. */
function findWaters(){
  const seen = new Uint8Array(W * H), bodies = [];
  for (let i = 0; i < W * H; i++){
    if (seen[i] || world[i].ground !== 'water') continue;
    const q = [i], body = []; seen[i] = 1;
    for (let head = 0; head < q.length; head++){
      const j = q[head], x = j % W, y = (j - x) / W; body.push(world[j]);
      for (const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const k = idx(nx, ny); if (!seen[k] && world[k].ground === 'water'){ seen[k] = 1; q.push(k); } }
    }
    bodies.push(body);
  }
  bodies.sort((p, q) => q.length - p.length);
  const painted = world.filter(t => t.river);
  if (painted.length) river = { kind: 'river', x: painted[0].x, y: painted[0].y, tiles: painted, names: [] };
  else if (bodies.length) stillWater = { kind: 'lake', x: bodies[0][0].x, y: bodies[0][0].y, tiles: bodies[0], names: [] };
  const big = river || stillWater;
  if (big) for (const t of big.tiles) t.water = big;
  for (const body of bodies){
    if (body.length > POND_TILES || body.some(t => t.water)) continue;
    const p = { x: body[0].x, y: body[0].y, tiles: body, names: [] };
    ponds.push(p); for (const t of body) t.pond = p;
  }
  /* A ford is the sand the river painter lays in the run of the water: the one place to cross. */
  for (const t of world){
    if (!t.river || t.ground !== 'sand') continue;
    if (fords.some(f => dist(f.x, f.y, t.x, t.y) <= FORD_APART)) continue;
    const f = { x: t.x, y: t.y, names: [] }; fords.push(f); t.ford = f;
  }
}

/* The lost people left names on the landmarks and on one crossing in three. Sectors, ponds,
   and the valley wait for the living. A world with more landmarks than the meanings table
   holds runs out, and the rest of the land keeps no old name at all. */
function oldNamesOnTheLand(){
  const big = river || stillWater;
  if (big){ const r = newOldName('the old people named the water'); if (r) giveName(big, r); }
  for (const h of hills){ const x = newOldName('the old people named the hill'); if (x) giveName(h, x); }
  for (const c of caves){
    if (!OLD_CAVE_KINDS.includes(c.kind)) continue;
    const x = newOldName('the old people named the hollow under the hill'); if (x) giveName(c, x);
  }
  for (const g of groves){ const x = newOldName('the old people named the grove'); if (x) giveName(g, x); }
  for (let k = 0; k < fords.length; k += 3){ const x = newOldName('the old people named the crossing'); if (x) giveName(fords[k], x); }
}

/* ---------- learning an old name ----------
   An old name is unknown until a person stands on the thing, or in the hollow under it, or
   at the water's edge. From then on the whole world knows it. The chronicle line and
   `nameKnown` are the whole visible effect: learning gives no thought and changes no need,
   so a person who reads the marks still does what they were going to do. */
function learnName(thing, a, what){
  if (!thing || thing.nameKnown !== false || !thing.names.length) return false;
  thing.nameKnown = true;
  const r = thing.names[0];
  log(`${a.name} finds marks cut in the rock. The old people called ${what} ${r.text}, ${r.meaning}.`, [a], 'info');
  return true;
}
function learnNamesHere(a){
  if (!lore) return;
  const t = hasTile(a.x, a.y, a.z) ? tileAt(a.x, a.y, a.z) : null; if (!t) return;
  if (t.hill) learnName(t.hill, a, 'this hill');
  if (t.cave) learnName(t.cave, a, 'this hollow');
  if (t.mouth) learnName(t.mouth, a, 'this hollow');
  if (t.ford) learnName(t.ford, a, 'this crossing');
  const wet = nearFind(a.x, a.y, q => !!q.water, NEAR, a.z);
  if (wet) learnName(wet.water, a, wet.water.kind === 'river' ? 'the water' : 'the still water');
  const hollow = nearFind(a.x, a.y, q => q.feature === 'hollow', RING, a.z);
  if (hollow){ const g = groves.find(g => g.x === hollow.x && g.y === hollow.y); if (g) learnName(g, a, 'this grove'); }
}

/* ---------- the namer ----------
   One function names anything. It gathers candidates from every axis, scores
   them by salience and the namer's traits, takes the top, and keeps the whole
   list on the record. */
const BIOME_WORD = { meadow: 'meadow', forest: 'pine', rocky: 'stone', wetland: 'reed' };
/* The landmarks the land axis looks for, each with the word it gives. Rules read this table. */
const LAND_MARKS = [
  { word: 'water', test: t => t.ground === 'water' },
  { word: 'ford',  test: t => !!t.ford },
  { word: 'reed',  test: t => t.feature === 'reeds' },
  { word: 'stone', test: t => t.feature === 'boulder' || t.ground === 'rock' },
  { word: 'pine',  test: t => t.feature === 'tree' || t.feature === 'hollow' },
  { word: 'hill',  test: t => !!t.hill },
  { word: 'cave',  test: t => !!t.mouth },
  { word: 'pool',  test: t => !!t.pond },
  { word: 'clay',  test: t => !!GROUND[t.ground].clay },
];
/* Two words joined: the first word, then the tail of the second. Reedwater, Pinehill, Stoneford. */
const WORD_TAIL = {
  water: 'water', reed: 'marsh', stone: 'ford', pine: 'wood', hill: 'hill', ford: 'crossing',
  pool: 'bank', clay: 'bank', meadow: 'field', cave: 'mouth',
  ash: 'hill', wolf: 'night', frost: 'hollow', light: 'water', parting: 'ford', grave: 'hill', cradle: 'field',
  snare: 'wood', pit: 'field', bench: 'stead', kiln: 'hill', hearth: 'stead', roof: 'stead', store: 'stead',
  rack: 'wood', offering: 'stone', ward: 'wood', fish: 'bend', timber: 'wood', stick: 'wood',
  berry: 'bank', moss: 'hollow', deer: 'crossing', cutting: 'bank',
};
/* An article and a phrase: the Clay Bank, the Reed Marsh. */
const WORD_PHRASE = {
  water: 'Water', reed: 'Marsh', stone: 'Ground', pine: 'Wood', hill: 'Hill', ford: 'Crossing',
  pool: 'Pool', clay: 'Bank', meadow: 'Meadow', cave: 'Mouth',
  snare: 'Snares', pit: 'Pits', bench: 'Bench', kiln: 'Kiln', hearth: 'Hearth', roof: 'Roofs', store: 'Store',
  rack: 'Racks', offering: 'Stone', ward: 'Posts', fish: 'Bend', timber: 'Timber', stick: 'Sticks',
  berry: 'Bushes', moss: 'Moss', deer: 'Crossing', cutting: 'Cuttings',
};
const NOTABLE_TAILS = ['Rest', 'Crossing', 'Hearth', 'Ford', 'Hollow', 'Stead'];
/* One trait bends one axis. Nothing else does. */
const AXIS_TRAIT = { land: 'patience', event: 'temper', notable: 'sociability', old: 'curiosity', lore: 'curiosity' };
const axisMult = (axis, by) => { const tr = AXIS_TRAIT[axis]; return tr && by ? 0.7 + by.traits[tr] * 0.6 : 1; };

/* The words this place offers, nearest landmark first, with the biome word last. A sector's
   biome can be `river` or `ash`, which carries no word of its own. */
function landWords(x, y){
  const best = {};
  for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++){
    const d = Math.abs(dx) + Math.abs(dy); if (d > 12 || !inb(x + dx, y + dy)) continue;
    const t = world[idx(x + dx, y + dy)];
    for (const m of LAND_MARKS) if (m.test(t) && (best[m.word] === undefined || d < best[m.word])) best[m.word] = d;
  }
  const words = Object.keys(best).sort((p, q) => best[p] - best[q] || p.localeCompare(q));
  const bw = BIOME_WORD[sectorOfTile(world[idx(x, y)]).biome];
  if (bw && !words.includes(bw)) words.push(bw);
  return words;
}
function landCandidates(place){
  const out = []; if (!place) return out;
  const words = landWords(place[0], place[1]).slice(0, 3);
  for (const a of words) for (const b of words){
    if (a === b || !WORD_TAIL[b]) continue;
    out.push({ text: cap(a) + WORD_TAIL[b], axis: 'land', base: 30, why: `for the ${a} by the ${b}` });
  }
  for (const a of words) if (WORD_PHRASE[a]) out.push({ text: `the ${cap(a)} ${WORD_PHRASE[a]}`, axis: 'land', base: 30, why: `for the ${a} here` });
  return out;
}
/* How much the rest of the camp thinks of someone. */
const liking = a => humans().filter(h => h !== a && h.camp === a.camp).reduce((n, h) => n + (h.opinions[a.id] || 0), 0);
function notableCandidates(){
  const out = [], folk = campHumans(), picks = [];
  if (camp.founder){ const f = beingById(camp.founder); if (f) picks.push([f, 'who made the camp']); }
  const eldest = folk.slice().sort((p, q) => p.born - q.born)[0]; if (eldest) picks.push([eldest, 'the eldest here']);
  const liked = folk.slice().sort((p, q) => liking(q) - liking(p) || p.id - q.id)[0]; if (liked) picks.push([liked, 'the best liked here']);
  const seen = new Set();
  for (const [p, why] of picks){
    if (seen.has(p.id)) continue; seen.add(p.id);
    out.push({ text: `${p.name}'s ${npick(NOTABLE_TAILS)}`, axis: 'notable', base: 25, why: `for ${p.name}, ${why}` });
  }
  return out;
}
/* The things with a learned old name near this place. */
function oldThingsNear(x, y, r){
  const out = [];
  for (const h of hills) if (h.nameKnown && dist(h.x, h.y, x, y) <= r) out.push(h);
  for (const c of caves) if (c.nameKnown && c.exit && dist(c.exit.x, c.exit.y, x, y) <= r) out.push(c);
  for (const g of groves) if (g.nameKnown && dist(g.x, g.y, x, y) <= r) out.push(g);
  for (const f of fords) if (f.nameKnown && dist(f.x, f.y, x, y) <= r) out.push(f);
  const big = river || stillWater;
  if (big && big.nameKnown && big.tiles.some(t => dist(t.x, t.y, x, y) <= r)) out.push(big);
  return out;
}
function oldCandidates(place){
  const out = []; if (!place) return out;
  for (const thing of oldThingsNear(place[0], place[1], 12)){
    const r = thing.names[0];
    out.push({ text: r.text, axis: 'old', base: 20, tongue: 'old', meaning: r.meaning, why: `for what ${lore.people} called this place` });
    out.push({ text: titleCase(r.meaning), axis: 'old', base: 20, why: `for what ${lore.people} called it: ${r.meaning}` });
  }
  return out;
}
/* The lost people, the sky, and the sprites. Worth more once the camp has met the sprites. */
function loreCandidates(base){
  if (!lore) return [];
  const b = base !== undefined ? base : (camp && camp.fae.known ? 30 : 10);
  return [
    { text: titleCase(lore.people.replace(/^the /, '')), axis: 'lore', base: b, why: `for ${lore.people}, who were here first` },
    { text: lore.sky.text, axis: 'lore', base: b, tongue: 'old', meaning: lore.sky.meaning, why: `for ${lore.sky.text}, ${lore.sky.meaning}` },
    { text: lore.sprites.text, axis: 'lore', base: b, tongue: 'old', meaning: lore.sprites.meaning, why: `for ${lore.sprites.text}, ${lore.sprites.meaning}` },
  ];
}
/* Every axis, for the current camp. The event axis joins in a later task. */
function candidatesFor(kind, by, place){
  return [...landCandidates(place), ...notableCandidates(), ...oldCandidates(place), ...loreCandidates()];
}
/* Score, drop duplicates, and sort. A text another thing already owns scores zero. */
function scoreCandidates(cands, by, thing){
  const seen = new Set(), out = [];
  for (const c of cands){
    const key = c.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const owner = nameIndex.get(key);
    c.score = owner && owner !== thing ? 0 : Math.round((c.base + (c.recency || 0)) * axisMult(c.axis, by) * 10) / 10;
    out.push(c);
  }
  return out.sort((p, q) => q.score - p.score || p.text.localeCompare(q.text));
}
/* The most sociable living member at the place, or the only one there is. */
function namerFor(place){
  const folk = campHumans();
  if (!folk.length) return null;
  const here = place ? folk.filter(h => nearAt(h, place[0], place[1]) <= 12) : folk;
  return (here.length ? here : folk).slice().sort((p, q) => q.traits.sociability - p.traits.sociability || p.id - q.id)[0];
}
/* The one namer. `extra` is the candidates only this moment has. */
function nameThing(thing, kind, by, place, extra = []){
  const scored = scoreCandidates([...candidatesFor(kind, by, place), ...extra], by, thing);
  const top = scored[0];
  if (!top || top.score <= 0) return null;
  if (thing.names && thing.names.length && thing.names[0].text === top.text) return thing.names[0];
  const rec = nameRecord(top.text, { tongue: top.tongue, meaning: top.meaning, why: top.why,
    by: by ? by.id : 'lost', scores: scored.slice(0, 8).map(c => ({ text: c.text, axis: c.axis, score: c.score })) });
  if (kind === 'camp') rename(thing, rec); else giveName(thing, rec);
  return rec;
}
/* The one door that changes a camp's name once it has one. It takes a reason. */
function rename(c, rec){ giveName(c, rec); c.name = rec.text; return rec; }

/* ---------- the camp moments ---------- */
/* The camp the founder made. Its first record, with the reason. */
function nameFoundersCamp(c, a){
  c.founder = a.id;
  const text = `${a.name}'s camp`;
  if (nameOf(c) === text) return;
  rename(c, nameRecord(text, { why: `the camp ${a.name} made`, by: a.id }));
}
/* The hearth has burned three days, so the place has a name. */
function nameCampAtHearth(c){
  if (c.namedAt || !c.site || c.bestStreak < CLOCK.limit.hearthProven) return;
  const prev = camp; camp = c;
  const by = namerFor(c.site);
  const rec = by ? nameThing(c, 'camp', by, c.site) : null;
  if (rec){ c.namedAt = tick; log(`They start to call this place ${rec.text}, ${rec.why}.`, campHumans(), 'major'); }
  camp = prev;
}
/* The nightly pass, at the fire. It runs at the end of updateCamps, once a day, at the hour
   the clock table names. Nothing here draws from the world stream, so the order of the
   world's own steps never moves. A cheap early return, since this runs every tick. */
function nameTick(){
  if (tick % DAY !== CLOCK.names.nameHour) return;
  const prev = camp;
  for (const c of camps){ camp = c; nameCampAtHearth(c); }
  camp = prev;
}
