/* ---------- names: the record, the second stream, and the old tongue ----------
   A name is a record. Every nameable thing keeps a list of records, newest
   first. The list never loses a record, so a chronicle line written under an
   old name can still be read back.

   Nothing in this file draws from the world stream `rng`. It has a stream of
   its own, seeded from the world seed with the salt ':names'. That is why the
   land, the beings, and the items of a seed never move when a name is given.
   Rules read the tables here. No rule reads name text. */
let nrng = null, lore = null, tongue = null, valley = null, river = null, ponds = null, fords = null, nameIndex = null, usedMeanings = null;

function seedNames(){
  nrng = mulberry32(hashSeed(seedText + ':names'));
  tongue = null; lore = null;
  nameIndex = new Map(); usedMeanings = new Set();
  valley = { names: [] };
  river = { names: [], tiles: [] };
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
  return [valley, river, ...camps, ...(sectors || []), ...(hills || []), ...(caves || []), ...(groves || []), ...fords, ...ponds].filter(Boolean);
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
