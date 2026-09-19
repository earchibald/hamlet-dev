/* ---------- snapshots: the whole world as plain JSON ----------
   A snapshot is taken between steps, in the days era. It holds every piece of state the rules read,
   and nothing that can be rebuilt from those. The state is a graph: a tile points at its cave, a cave
   points back at its tiles, a snare is one object in two places. JSON cannot hold a graph, so REFS
   names every field that points at another record, and each kind of target has a way to name one
   record by a number, by an index pair, or by an id. The loader turns those names back into the one
   record they name, so the sharing that the rules compare by identity comes back whole.

   Nothing here draws from a random stream, and nothing here writes to a live record. */
/* Version 2: plan G4 made a tick one world second, so `tick` and every stamp saved beside it mean
   86.4 times less than they did. A version 1 save holds numbers that are all still numbers and are
   all wrong, which no field-by-field default can rescue, so it is refused with its sentence. */
const SNAPSHOT_VERSION = 2;

/* Every field of a record that holds a reference, and the kind of record it points at. A dotted name
   is a path into a plain object the record owns; the encoder copies the objects along that path. The
   owning lists (camp.snares, camp.pitfalls, region.marks, field.regions) are homes, not references. */
const REFS = {
  tile:     { hill: 'hill', cave: 'cave', mouth: 'cave', garden: 'camp', 'struct.camp': 'camp', 'struct.snare': 'snare', 'struct.pit': 'pit',
              water: 'water', pond: 'pond', ford: 'ford' },
  being:    { camp: 'camp', grove: 'grove', target: 'camp', den: 'cave', oldDen: 'cave', shyOf: 'camp', body: 'body', history: 'lines' },
  item:     {},
  camp:     {},
  snare:    { camp: 'camp' },
  pit:      { camp: 'camp' },
  cave:     { tiles: 'tiles', patch: 'tiles', mouth: 'tile', exit: 'tile', deep: 'tile', blocked: 'tile', hill: 'hill', searched: 'camp', cleared: 'camp', disturbedBy: 'camp', from: 'cave', mark: 'mark', 'holding.camp': 'camp' },
  hill:     { mark: 'mark' },
  grove:    { sector: 'sector', cave: 'cave', mark: 'mark' },
  sector:   {},
  region:   {},
  boundary: {},
  mark:     {},
  line:     {},
  creation: { 'gate.start': 'region' },
  field:    { root: 'region' },
  /* The naming records. A water, a pond, and a ford are found once, when the land is named, and each
     water tile points back at the record it belongs to. The valley is pointed at by nothing. */
  water:    { tiles: 'tiles' },
  pond:     { tiles: 'tiles' },
  ford:     {},
  valley:   {},
};
/* The lists that own their records, and the type of record each holds. A record met along one of these
   paths is at home, not pointed at, so the encoder writes it whole. */
const REF_HOMES = { camp: { snares: 'snare', pitfalls: 'pit' }, region: { marks: 'mark' }, field: { regions: 'region' } };
/* Fields the snapshot leaves out because the loader rebuilds them, with the reason. The guard walks
   past these; nothing else may hold a Map, a Set, or a record the snapshot does not name. */
const REF_DERIVED = { field: { byId: 'rebuilt from field.regions' } };

/* Scratch for one snapshot: the identity maps, the mark table, and the line table. It lives only
   inside takeSnapshot and unnamedRefs. */
let SNAP_IX = null;

function snapMap(name, list){
  if (SNAP_IX && SNAP_IX[name]) return SNAP_IX[name];
  const m = new Map(); for (let i = 0; i < list.length; i++) m.set(list[i], i);
  if (SNAP_IX) SNAP_IX[name] = m;
  return m;
}
function snapIndex(name, list, rec, what){
  const i = snapMap(name, list).get(rec);
  if (i === undefined) throw new Error(`A snapshot cannot name this ${what}: it is in no ${name} list.`);
  return i;
}
/* The marks that live in a region, by identity. */
function markTable(){
  if (SNAP_IX && SNAP_IX.marks) return SNAP_IX.marks;
  const m = new Map();
  if (field) for (const r of field.regions) for (let i = 0; i < r.marks.length; i++) m.set(r.marks[i], [r.id, i]);
  if (SNAP_IX) SNAP_IX.marks = m;
  return m;
}

/* How each kind of target is named, and how a loader reads that name back. `stage` is the loader's
   half-built world: it holds the arrays camps, caves, hills, groves, sectors and lines, a regionById
   map, and a tileAt(i) that finds a staged tile by its idx3 number.

   The general rule: every kind here assumes its record lives in one list for ever, and names it by
   its place in that list. A kind whose records can leave their list in play needs a stray path, or
   the world becomes unsavable the moment one leaves. `grove` has one, because burnOut takes a grove
   out of `groves` while its sprites still point at it. Before you add a kind, ask what removes a
   record of it, and whether anything can still hold the record after. */
const REF_KINDS = {
  camp:   { toId: c => snapIndex('camps', camps, c, 'camp'),       fromId: (i, s) => at(s.camps, i, 'camp') },
  cave:   { toId: c => snapIndex('caves', caves, c, 'cave'),       fromId: (i, s) => at(s.caves, i, 'cave') },
  hill:   { toId: h => snapIndex('hills', hills, h, 'hill'),       fromId: (i, s) => at(s.hills, i, 'hill') },
  grove:  { toId: g => groveId(g),                                 fromId: (i, s) => i !== null && typeof i === 'object' ? at(s.strayGroves, i.stray, 'grove') : at(s.groves, i, 'grove') },
  sector: { toId: s => snapIndex('sectors', sectors, s, 'sector'), fromId: (i, s) => at(s.sectors, i, 'sector') },
  line:   { toId: e => snapIndex('lines', lineList(), e, 'chronicle line'), fromId: (i, s) => at(s.lines, i, 'chronicle line') },
  lines:  { toId: a => a.map(REF_KINDS.line.toId), fromId: (a, s) => a.map(i => REF_KINDS.line.fromId(i, s)) },
  region: {
    toId: r => { if (!field || field.byId.get(r.id) !== r) throw new Error('A snapshot cannot name this region: it is in no field.'); return r.id; },
    fromId: (id, s) => { const r = s.regionById.get(id); if (!r) throw new Error(`This save names a region, ${id}, that is not in it.`); return r; },
  },
  tile: {
    toId: t => { if (tileAt(t.x, t.y, t.z) !== t) throw new Error(`A snapshot cannot name this tile: ${t.x},${t.y},${t.z} is not where it lies.`); return idx3(t.x, t.y, t.z); },
    fromId: (i, s) => { const t = s.tileAt(i); if (!t) throw new Error(`This save names a tile, ${i}, that is not in it.`); return t; },
  },
  tiles:  { toId: a => a.map(REF_KINDS.tile.toId), fromId: (a, s) => a.map(i => REF_KINDS.tile.fromId(i, s)) },
  mark: {
    toId: m => { const id = markTable().get(m); return id ? id.slice() : { whole: clean(m) }; },
    fromId: (id, s) => {
      if (id && !Array.isArray(id) && typeof id === 'object') return { ...id.whole };
      const r = s.regionById.get(id[0]), m = r && r.marks[id[1]];
      if (!m) throw new Error(`This save names a mark, ${id}, that is not in it.`);
      return m;
    },
  },
  snare: {
    toId: s => ownedId(s, 'snares', 'snare'),
    fromId: (id, s) => ownedFrom(id, s, 'snares', 'snare'),
  },
  pit: {
    toId: p => ownedId(p, 'pitfalls', 'pitfall'),
    fromId: (id, s) => ownedFrom(id, s, 'pitfalls', 'pitfall'),
  },
  /* A god's body is a hill, a cave, or a region. The name says which. */
  body: {
    toId: b => {
      if (snapMap('hills', hills).has(b)) return { hill: REF_KINDS.hill.toId(b) };
      if (snapMap('caves', caves).has(b)) return { cave: REF_KINDS.cave.toId(b) };
      if (field && field.byId.get(b.id) === b) return { region: REF_KINDS.region.toId(b) };
      throw new Error('A snapshot cannot name this body: it is no hill, cave, or region.');
    },
    fromId: (id, s) => {
      if (id.hill !== undefined) return REF_KINDS.hill.fromId(id.hill, s);
      if (id.cave !== undefined) return REF_KINDS.cave.fromId(id.cave, s);
      if (id.region !== undefined) return REF_KINDS.region.fromId(id.region, s);
      throw new Error('This save names a body that is no hill, cave, or region.');
    },
  },
  /* The three kinds the naming work added. `findWaters` makes all of them, once, on the tick the land
     is named, and nothing anywhere takes one out again: no water, pond, or ford is ever removed, and
     no tile ever stops being water. So each keeps its place for the life of the world, and no stray
     path is needed. The great water is one of two globals, so its name says which. */
  water: {
    toId: w => { if (w === river) return 'river'; if (w === stillWater) return 'still'; throw new Error('A snapshot cannot name this water: it is neither the river nor the still water.'); },
    fromId: (id, s) => { const w = id === 'river' ? s.river : id === 'still' ? s.stillWater : null; if (!w) throw new Error(`This save names a water, ${id}, that is not in it.`); return w; },
  },
  pond: { toId: p => snapIndex('ponds', ponds, p, 'pond'), fromId: (i, s) => at(s.ponds, i, 'pond') },
  ford: { toId: f => snapIndex('fords', fords, f, 'ford'), fromId: (i, s) => at(s.fords, i, 'ford') },
};
function at(list, i, what){ const r = list && list[i]; if (!r) throw new Error(`This save names a ${what}, ${i}, that is not in it.`); return r; }
/* A grove in `groves` is named by its place. A grove that has left the list is a stray: burnOut takes
   a grove out of `groves` when its hollow pine burns, and its sprites keep pointing at it until the
   last of them dies. A stray is written whole into the snapshot's `strayGroves`, once, and named
   `{ stray: i }`. The loader hands every sprite of that grove the one staged object, because the
   rules compare a sprite's grove by identity. */
function groveId(g){
  const i = snapMap('groves', groves).get(g);
  if (i !== undefined) return i;
  if (!SNAP_IX) throw new Error('A snapshot cannot name this grove: it is in no groves list.');
  const stray = SNAP_IX.strayGroves || (SNAP_IX.strayGroves = { at: new Map(), list: [] });
  let k = stray.at.get(g);
  if (k === undefined){ k = stray.list.length; stray.at.set(g, k); stray.list.push(null); stray.list[k] = encode(g, 'grove'); }
  return { stray: k };
}
/* A snare and a pitfall live in a camp's own list, and each knows its camp. */
function ownedId(rec, list, what){
  const c = rec.camp && snapMap('camps', camps).has(rec.camp) ? rec.camp : camps.find(q => q[list].includes(rec));
  if (!c) throw new Error(`A snapshot cannot name this ${what}: it belongs to no camp.`);
  const i = c[list].indexOf(rec);
  if (i < 0) throw new Error(`A snapshot cannot name this ${what}: its camp does not hold it.`);
  return [REF_KINDS.camp.toId(c), i];
}
function ownedFrom(id, s, list, what){
  const c = at(s.camps, id[0], 'camp'), rec = c[list][id[1]];
  if (!rec) throw new Error(`This save names a ${what}, ${id}, that is not in it.`);
  return rec;
}

/* ---------- encoding a record ---------- */
/* A deep copy with every undefined dropped. A save file holds no undefined, because JSON drops it and
   a reader that meets a missing key reads it the same way. */
function clean(v){
  if (Array.isArray(v)) return v.map(x => x === undefined ? null : clean(x));
  if (v && typeof v === 'object'){ const o = {}; for (const k of Object.keys(v)) if (v[k] !== undefined) o[k] = clean(v[k]); return o; }
  return v;
}
/* REFS as a tree, so a dotted path is walked once: { camp: 'camp', struct: { camp: 'camp', ... } }. */
const REF_PLAN = {};
for (const type in REFS){
  const plan = REF_PLAN[type] = {};
  for (const path in REFS[type]){
    const parts = path.split('.'); let node = plan;
    for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] || (node[parts[i]] = {});
    node[parts[parts.length - 1]] = REFS[type][path];
  }
}
function refId(kind, v){ return v === null || v === undefined ? null : REF_KINDS[kind].toId(v); }
/* Copy an object, turning every field the plan names into an id. Objects along a dotted path are
   copied, never written to. */
function encodeWith(rec, plan){
  const out = {};
  for (const k of Object.keys(rec)){
    const v = rec[k], p = plan[k];
    if (v === undefined) continue;
    if (typeof p === 'string') out[k] = refId(p, v);
    else if (p && v && typeof v === 'object') out[k] = encodeWith(v, p);
    else out[k] = clean(v);
  }
  return out;
}
function encode(rec, type){
  const plan = REF_PLAN[type] || {}, homes = REF_HOMES[type] || {}, out = {};
  for (const k of Object.keys(rec)){
    const v = rec[k], p = plan[k];
    if (v === undefined) continue;
    if (homes[k]) out[k] = v.map(x => encode(x, homes[k]));
    else if (typeof p === 'string') out[k] = refId(p, v);
    else if (p && v && typeof v === 'object') out[k] = encodeWith(v, p);
    else out[k] = clean(v);
  }
  return out;
}

/* ---------- tiles ---------- */
/* A level is an array of W * H entries, one for each cell, null where there is no tile. A tile is
   saved without x, y, and z, which its place gives back, and without any field that still holds the
   value makeTile gave it. */
function encodeTile(t){
  const out = {}, plan = REF_PLAN.tile;
  for (const k of Object.keys(t)){
    const v = t[k], p = plan[k];
    if (v === undefined || k === 'x' || k === 'y' || k === 'z') continue;
    if (k in TILE_DEFAULTS && v === TILE_DEFAULTS[k]) continue;
    if (typeof p === 'string') out[k] = refId(p, v);
    else if (p && v && typeof v === 'object') out[k] = encodeWith(v, p);
    else out[k] = clean(v);
  }
  return out;
}
function encodeLevel(level){ const out = new Array(level.length); for (let i = 0; i < level.length; i++) out[i] = level[i] === null ? null : encodeTile(level[i]); return out; }

/* ---------- the chronicle lines ---------- */
/* One line object sits in the chronicle, in the legends, and in each being's history. The snapshot
   holds each distinct line once, in the order first met, and the three lists hold its index, so the
   sharing survives the round trip. */
function lineList(){
  if (SNAP_IX && SNAP_IX.lineList) return SNAP_IX.lineList;
  const seen = new Set(), out = [];
  const add = e => { if (!seen.has(e)){ seen.add(e); out.push(e); } };
  for (const e of chronicle) add(e);
  for (const e of legends) add(e);
  for (const a of beings) if (a.history) for (const e of a.history) add(e);
  if (SNAP_IX) SNAP_IX.lineList = out;
  return out;
}
/* The names the index holds that no saved thing accounts for. Two things end up here. A named event
   whose line has fallen out of the chronicle, the legends, and every history, because the chronicle
   keeps only its last 300 lines. And a named grove that burnt out of `groves` and then lost its last
   sprite, because the prune drops a dead sprite from `beings`. Nothing of the world reaches either
   one any more, but its text stays taken: no other thing is ever given that text.

   Only the name records are saved, never the thing. A thing here can hold references a save must not
   copy: a grove holds its cave, the cave holds its tiles, and each tile points back at the cave, so
   `clean` on the thing would walk a cycle. Saving it whole would also bring back into the world a
   record the world had let go. A name record is plain data by its own rule, so a list of them can
   hold nothing else, and the guard has nothing to walk here.

   The loader gives each saved list to a holder object of its own, which lives only in the index. The
   three readers of the index ask nothing more of it: `nameTaken` reads the key, `nameRecordOf` reads
   `thing.names`, and the owner test in `scoreCandidates` compares the thing by identity against the
   thing being named, which a holder never is. So a text held this way scores zero for everything
   else, which is what it does in the straight run. */
function lostNames(){
  if (!nameIndex) return [];
  const held = new Set(lineList());
  for (const t of nameThings()) held.add(t);
  for (const a of beings) if (a.grove) held.add(a.grove);
  const out = [], seen = new Set();
  for (const thing of nameIndex.values()){
    if (held.has(thing) || seen.has(thing)) continue;
    seen.add(thing); out.push({ names: clean(thing.names) });
  }
  return out;
}

/* ---------- the snapshot ---------- */
/* Which global the snapshot keeps, and under which name. The guard test in tests/snapshot.js reads
   this table, so a new piece of state must be named here or in NOT_SAVED. */
const SAVED_STATE = {
  seedText: 'seed', options: 'options', tick: 'tick', nextId: 'nextId', fireCount: 'fireCount', wanderAt: 'wanderAt', doomAt: 'doomAt',
  era: 'era', age: 'age', pulseAge: 'pulseAge', rng: 'rng', godRng: 'godRng',
  levels: 'levels', raised: 'raised', hills: 'hills', caves: 'caves', sectors: 'sectors', groves: 'groves',
  camps: 'camps', camp: 'campNow', beings: 'beings', items: 'items', corpses: 'corpses',
  chronicle: 'chronicle', legends: 'legends', weather: 'weather', goalPriority: 'goalPriority',
  namePool: 'namePool', godNamePool: 'godNamePool', gestureFallbacks: 'gestureFallbacks',
  creation: 'creation', field: 'field', boundaries: 'boundaries',
  resCache: 'resCache', startRegion: 'startRegion', doorLog: 'doorLog',
  inhabited: 'inhabited', inhabitedTold: 'inhabitedTold',
  nrng: 'nrng', lore: 'lore', tongue: 'tongue', valley: 'valley', river: 'river', stillWater: 'stillWater',
  ponds: 'ponds', fords: 'fords',
};
/* The value of every saved global, by its snapshot name. The guard walks these, and a test holds this
   table to SAVED_STATE, so a new saved global is walked without anyone remembering to add it here. */
function savedValues(){
  return { seed: seedText, options, tick, nextId, fireCount, wanderAt, doomAt, era, age, pulseAge,
    rng, godRng, levels, raised, hills, caves, sectors, groves, camps, campNow: camp, beings, items, corpses,
    chronicle, legends, weather, goalPriority, namePool, godNamePool, gestureFallbacks,
    creation, field, boundaries, resCache, startRegion, doorLog, inhabited, inhabitedTold,
    nrng, lore, tongue, valley, river, stillWater, ponds, fords };
}
/* Which global the snapshot leaves out, and why. Each of these comes back from something else. */
const NOT_SAVED = {
  SW: 'derived from options', SH: 'derived from options', W: 'derived from options', H: 'derived from options',
  ZMIN: 'derived from options', ZMAX: 'derived from options', ZOFF: 'derived from options', NZ: 'derived from options',
  world: 'derived: levels[ZOFF]', itemGrid: 'derived from items', regionOf: 'derived from field.regions',
  bfsPrev: 'search scratch', bfsSeen: 'search scratch', bfsGen: 'search scratch',
  deciding: 'lives inside one god act', saidFrom: 'lives inside one god act', settleNow: 'lives inside one age step',
  replayHead: 'derived from the seed and the options', tileCheckImpl: 'a test seam',
  SNAP_IX: 'scratch, lives inside one snapshot',
  agePos: 'lives only in the ages', pending: 'lives only in the ages',
  runUntil: 'lives only in the ages', stops: 'lives only in the ages',
  lastLoadFault: 'the reason the last load was refused, not world state',
  chronicleSink: 'a test seam; null on the page, and a save must never install one',
  chronicleWritten: 'a count for the test harness, not world state',
  nameIndex: 'derived: rebuilt from the saved name records by rebuildNames',
  usedMeanings: 'derived: the meanings on the saved old names, rebuilt by rebuildNames',
};

/* The whole state as plain JSON. Nothing here changes the state or draws from a stream. */
function takeSnapshot(){
  if (era !== 'days') throw new Error('A snapshot is taken only once the world is made.');
  SNAP_IX = {};
  try {
    const lines = lineList(), lineId = e => REF_KINDS.line.toId(e);
    const snap = {
      version: SNAPSHOT_VERSION, seed: seedText, options: clean(options),
      tick, nextId, fireCount, wanderAt, doomAt, era, age, pulseAge,
      rng: streamState(rng), godRng: godRng ? streamState(godRng) : null,
      levels: levels.map(encodeLevel),
      raised: REF_KINDS.tiles.toId(raised),
      hills: hills.map(h => encode(h, 'hill')),
      caves: caves.map(c => encode(c, 'cave')),
      sectors: sectors.map(s => encode(s, 'sector')),
      groves: groves.map(g => encode(g, 'grove')),
      camps: camps.map(c => encode(c, 'camp')),
      campNow: camp ? REF_KINDS.camp.toId(camp) : null,
      beings: beings.map(a => encode(a, 'being')),
      items: items.map(i => encode(i, 'item')),
      corpses: clean(corpses),
      lines: lines.map(e => encode(e, 'line')),
      chronicle: chronicle.map(lineId),
      legends: legends.map(lineId),
      weather: clean(weather), goalPriority: clean(goalPriority),
      namePool: clean(namePool), godNamePool: clean(godNamePool), gestureFallbacks: clean(gestureFallbacks),
      creation: creation ? encode(creation, 'creation') : null,
      field: field ? { regions: field.regions.map(r => encode(r, 'region')), root: field.root ? REF_KINDS.region.toId(field.root) : null } : null,
      boundaries: boundaries.map(b => encode(b, 'boundary')),
      resCache: [...resCache].map(([k, v]) => [k, clean(v)]),
      startRegion: startRegion ? [...startRegion] : null,
      doorLog: clean(doorLog),
      inhabited: inhabited ? clean(inhabited) : null, inhabitedTold,
      /* The names. The name stream is held as one position, like the world's own streams, so a loaded
         world names the next thing with the number the straight run would have drawn. */
      nrng: nrng ? streamState(nrng) : null,
      lore: lore ? clean(lore) : null, tongue: tongue ? clean(tongue) : null,
      valley: valley ? encode(valley, 'valley') : null,
      river: river ? encode(river, 'water') : null,
      stillWater: stillWater ? encode(stillWater, 'water') : null,
      ponds: ponds.map(p => encode(p, 'pond')),
      fords: fords.map(f => encode(f, 'ford')),
      lostNames: lostNames(),
    };
    /* Last, because encoding the rest is what finds them. */
    snap.strayGroves = SNAP_IX.strayGroves ? SNAP_IX.strayGroves.list : [];
    return snap;
  } finally { SNAP_IX = null; }
}

/* ---------- loading ----------
   A save file is outside data. The loader reads it into a stage, a half-built world of its own, and
   only replaces the state once every record is built and every id has found the record it names. A
   save that cannot be read leaves the world exactly as it was. */

/* A deep copy of parsed data. Object spread is used, never Object.assign, so a key named __proto__ in
   a save file becomes an own key of a plain object instead of reaching the prototype setter. */
function snapCopy(v){
  if (Array.isArray(v)) return v.map(snapCopy);
  if (v && typeof v === 'object'){ const o = { ...v }; for (const k of Object.keys(o)) o[k] = snapCopy(o[k]); return o; }
  return v;
}
function snapNeed(ok, what){ if (!ok) throw new Error(`This save's ${what} is not what a save holds.`); }
function snapArray(v, what){ snapNeed(Array.isArray(v), what); return v; }
function snapObj(v, what){ snapNeed(v !== null && typeof v === 'object' && !Array.isArray(v), what); return v; }
function snapNum(v, what){ snapNeed(typeof v === 'number' && Number.isFinite(v), what); return v; }
function snapText(v, what){ snapNeed(typeof v === 'string', what); return v; }
/* A whole count, never negative, and small enough that adding to it stays exact. */
function snapCount(v, what){ snapNeed(Number.isSafeInteger(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER / 2, what); return v; }
/* A key the rules index blindly. A save that names one the table lacks would kill the page a step later. */
function snapKey(v, table, what){ snapNeed(typeof v === 'string' && Object.prototype.hasOwnProperty.call(table, v), what); return v; }
/* A field added to the snapshot after version 1 is read as optional, with the value a world that never
   had it holds. The version rises only when the meaning of a field already saved changes. A rebuilt
   page must not turn every player's autosave into a refusal. */
function snapOpt(v, fallback){ return v === undefined ? fallback : v; }

/* Turn every id the plan names back into the staged record it names. A key the save does not hold
   stays missing, and a null stays null. The record's keys are written in place, so their order holds. */
function resolvePlan(rec, plan, stage){
  for (const k of Object.keys(plan)){
    if (!Object.prototype.hasOwnProperty.call(rec, k)) continue;
    const p = plan[k], v = rec[k];
    if (typeof p === 'string'){ if (v !== null && v !== undefined) rec[k] = REF_KINDS[p].fromId(v, stage); }
    else if (p && v && typeof v === 'object') resolvePlan(v, p, stage);
  }
}
function resolveRefs(rec, type, stage){
  resolvePlan(rec, REF_PLAN[type] || {}, stage);
  const homes = REF_HOMES[type] || {};
  for (const k in homes){ snapArray(rec[k], k); for (const x of rec[k]) resolveRefs(snapObj(x, k), homes[k], stage); }
}
function stageList(list, type, what){
  snapArray(list, what);
  return list.map(r => snapCopy(snapObj(r, what)));
}

/* Read the save into a stage. It reads the save and writes only the stage. Any fault throws. */
function decodeSnapshot(snap){
  const opts = { ...DEFAULT_OPTIONS, ...snap.options };
  const w = opts.sw * LW, h = opts.sh * LH, area = w * h, nz = opts.zmax - opts.zmin + 1;
  const stage = { options: opts, seed: snapText(snap.seed, 'seed') };

  /* The levels first: a tile is named by its place, and everything else may name a tile. */
  const saved = snapArray(snap.levels, 'levels');
  snapNeed(saved.length === nz, 'levels');
  stage.levels = saved.map((lv, li) => {
    snapArray(lv, 'level'); snapNeed(lv.length === area, 'level');
    const z = li + opts.zmin, out = new Array(area);
    for (let i = 0; i < area; i++){
      if (lv[i] === null || lv[i] === undefined){ out[i] = null; continue; }
      const c = snapCopy(snapObj(lv[i], 'tile')), x = i % w;
      snapKey(c.ground, GROUND, 'tile ground');
      if (c.feature !== undefined && c.feature !== null) snapKey(c.feature, FEATURES, 'tile feature');
      /* x, y, and z come from the tile's index, never from the saved copy: a hand-edited save
         must not move a tile by forging its own position inside it. */
      const { x: _x, y: _y, z: _z, ...rest } = c;
      out[i] = { x, y: (i - x) / w, z, ground: c.ground, ...TILE_DEFAULTS, ...rest };
    }
    return out;
  });
  stage.tileAt = i => { if (!Number.isInteger(i) || i < 0 || i >= nz * area) return null; const lv = (i / area) | 0; return stage.levels[lv][i - lv * area]; };

  /* Then every list of records, whole, with the ids still in place. */
  stage.lines = stageList(snap.lines, 'line', 'lines');
  stage.camps = stageList(snap.camps, 'camp', 'camps');
  /* A camp's own plain objects and places. The rules read each without looking first. */
  const spot = (v, what) => { if (v === null || v === undefined) return; snapArray(v, what); snapNeed(v.length === 2, what); snapNeed(Number.isInteger(v[0]) && v[0] >= 0 && v[0] < w && Number.isInteger(v[1]) && v[1] >= 0 && v[1] < h, what); };
  for (const c of stage.camps){
    snapArray(c.snares, 'snares'); snapArray(c.pitfalls, 'pitfalls');
    for (const k of ['stash', 'fae', 'rot', 'tools', 'gnomes']) snapObj(c[k], 'camp ' + k);
    for (const k of ['pit', 'stashTile', 'site']) spot(c[k], 'camp ' + k);
  }
  stage.hills = stageList(snap.hills, 'hill', 'hills');
  stage.caves = stageList(snap.caves, 'cave', 'caves');
  stage.sectors = stageList(snap.sectors, 'sector', 'sectors');
  stage.groves = stageList(snap.groves, 'grove', 'groves');
  stage.strayGroves = stageList(snapOpt(snap.strayGroves, []), 'grove', 'strayGroves');
  stage.beings = stageList(snap.beings, 'being', 'beings');
  for (const a of stage.beings) snapKey(a.species, SPECIES, 'being species');
  stage.items = stageList(snap.items, 'item', 'items');
  for (const it of stage.items) snapKey(it.kind, ITEMS, 'item kind');
  stage.boundaries = stageList(snap.boundaries, 'boundary', 'boundaries');
  stage.corpses = snapCopy(snapArray(snap.corpses, 'corpses'));
  stage.field = snap.field === null ? null : { regions: stageList(snapObj(snap.field, 'field').regions, 'region', 'regions'), root: snap.field.root, byId: new Map() };
  stage.regionById = new Map();
  /* A region's tiles fill regionOf, an array of W * H. An index outside it would write past the end. */
  if (stage.field) for (const r of stage.field.regions){
    snapArray(r.marks, 'marks'); snapNum(r.id, 'region id');
    for (const i of snapArray(r.tiles, 'region tiles')) snapNeed(Number.isInteger(i) && i >= 0 && i < area, 'region tiles');
    stage.regionById.set(r.id, r);
  }
  stage.creation = snap.creation === null ? null : snapCopy(snapObj(snap.creation, 'creation'));

  /* The naming records, before the tiles are joined up: a water tile points at the water it lies in.
     A save written before the naming work holds none of these fields, and `hasNames` says so: the
     loader then seeds the name stream afresh, which is what a world that never named anything holds. */
  const one = (v, what) => v === null || v === undefined ? null : snapCopy(snapObj(v, what));
  stage.hasNames = snap.nrng !== undefined;
  /* The name stream is read as `rng` is, not as `godRng` is. A world in the days era always has one,
     because `seedNames` runs in `resetState`, so a save that holds the names but no place in the
     stream is refused rather than loaded into a world that would throw at the next naming. */
  stage.nrng = stage.hasNames ? snapNum(snap.nrng, 'nrng') : null;
  stage.lore = one(snap.lore, 'lore');
  stage.tongue = one(snap.tongue, 'tongue');
  stage.valley = one(snap.valley, 'valley');
  stage.river = one(snap.river, 'river');
  stage.stillWater = one(snap.stillWater, 'still water');
  stage.ponds = stageList(snapOpt(snap.ponds, []), 'pond', 'ponds');
  stage.fords = stageList(snapOpt(snap.fords, []), 'ford', 'fords');
  stage.lostNames = stageList(snapOpt(snap.lostNames, []), 'lostName', 'lostNames');
  for (const h of stage.lostNames) snapArray(h.names, 'lostNames');

  /* Then every id becomes the one record it names. fromId throws on an id that names nothing. */
  for (const level of stage.levels) for (const t of level) if (t) resolveRefs(t, 'tile', stage);
  for (const c of stage.camps) resolveRefs(c, 'camp', stage);
  for (const c of stage.caves) resolveRefs(c, 'cave', stage);
  for (const hl of stage.hills) resolveRefs(hl, 'hill', stage);
  for (const g of stage.groves) resolveRefs(g, 'grove', stage);
  for (const g of stage.strayGroves) resolveRefs(g, 'grove', stage);
  for (const s of stage.sectors) resolveRefs(s, 'sector', stage);
  for (const a of stage.beings) resolveRefs(a, 'being', stage);
  for (const it of stage.items) resolveRefs(it, 'item', stage);
  for (const b of stage.boundaries) resolveRefs(b, 'boundary', stage);
  if (stage.creation) resolveRefs(stage.creation, 'creation', stage);
  if (stage.river) resolveRefs(stage.river, 'water', stage);
  if (stage.stillWater) resolveRefs(stage.stillWater, 'water', stage);
  for (const p of stage.ponds) resolveRefs(p, 'pond', stage);
  for (const f of stage.fords) resolveRefs(f, 'ford', stage);
  if (stage.field){ resolveRefs(stage.field, 'field', stage); for (const r of stage.field.regions) stage.field.byId.set(r.id, r); }

  stage.raised = REF_KINDS.tiles.fromId(snapArray(snap.raised, 'raised'), stage);
  stage.camp = snap.campNow === null ? null : REF_KINDS.camp.fromId(snap.campNow, stage);
  stage.chronicle = REF_KINDS.lines.fromId(snapArray(snap.chronicle, 'chronicle'), stage);
  stage.legends = REF_KINDS.lines.fromId(snapArray(snap.legends, 'legends'), stage);
  stage.resCache = new Map(snapArray(snap.resCache, 'resCache').map(p => { snapArray(p, 'cache entry'); return [p[0], snapCopy(p[1])]; }));
  stage.startRegion = snap.startRegion === null ? null : new Set(snapArray(snap.startRegion, 'startRegion'));
  stage.doorLog = snapCopy(snapArray(snap.doorLog, 'doorLog'));

  /* Last the plain values. */
  stage.tick = snapCount(snap.tick, 'tick'); stage.nextId = snapCount(snap.nextId, 'nextId');
  stage.fireCount = snapNum(snap.fireCount, 'fireCount');
  stage.wanderAt = snapNum(snap.wanderAt, 'wanderAt'); stage.doomAt = snapNum(snap.doomAt, 'doomAt');
  stage.inhabited = snapOpt(snap.inhabited, null);
  if (stage.inhabited !== null) stage.inhabited = snapCopy(snapObj(stage.inhabited, 'inhabited'));
  stage.inhabitedTold = !!snapOpt(snap.inhabitedTold, false);
  stage.age = snapNum(snap.age, 'age');
  stage.pulseAge = snap.pulseAge === null ? null : snapNum(snap.pulseAge, 'pulseAge');
  stage.rng = snapNum(snap.rng, 'rng'); stage.godRng = snap.godRng === null ? null : snapNum(snap.godRng, 'godRng');
  stage.weather = snapCopy(snapObj(snap.weather, 'weather'));
  stage.goalPriority = snapCopy(snapObj(snap.goalPriority, 'goalPriority'));
  stage.namePool = snapCopy(snapArray(snap.namePool, 'namePool'));
  stage.godNamePool = snapCopy(snapArray(snap.godNamePool, 'godNamePool'));
  stage.gestureFallbacks = snapCopy(snapObj(snap.gestureFallbacks, 'gestureFallbacks'));
  return stage;
}

/* Put the stage in place of the state. Everything here is an assignment or a rebuild that cannot fail. */
function commitSnapshot(s){
  setOptions(s.options); allocSearch();
  seedText = s.seed; tick = s.tick; nextId = s.nextId; fireCount = s.fireCount;
  wanderAt = s.wanderAt; doomAt = s.doomAt;
  era = 'days'; age = s.age; pulseAge = s.pulseAge;
  levels = s.levels; world = levels[ZOFF]; raised = s.raised;
  hills = s.hills; caves = s.caves; sectors = s.sectors; groves = s.groves;
  camps = s.camps; camp = s.camp;
  beings = s.beings; items = s.items; corpses = s.corpses;
  chronicle = s.chronicle; legends = s.legends;
  weather = s.weather; goalPriority = s.goalPriority;
  namePool = s.namePool; godNamePool = s.godNamePool; gestureFallbacks = s.gestureFallbacks;
  creation = s.creation; field = s.field; boundaries = s.boundaries;
  resCache = s.resCache; startRegion = s.startRegion;
  /* The derived state, rebuilt as the makers of each build it. */
  rebuildItemGrid();
  regionOf = new Int32Array(W * H);
  if (field) for (const r of field.regions) for (const i of r.tiles) regionOf[i] = r.id;
  rng = mulberry32(0); setStreamState(rng, s.rng);
  godRng = s.godRng === null ? null : mulberry32(0);
  if (godRng) setStreamState(godRng, s.godRng);
  inhabited = s.inhabited; inhabitedTold = s.inhabitedTold;
  /* The names. A save written before the naming work names nothing, so the name stream is seeded from
     the seed, as a fresh world seeds it. Otherwise every record comes back and the index is rebuilt. */
  if (!s.hasNames) seedNames();
  else {
    nrng = mulberry32(0); setStreamState(nrng, s.nrng);
    lore = s.lore; tongue = s.tongue; valley = s.valley;
    river = s.river; stillWater = s.stillWater; ponds = s.ponds; fords = s.fords;
    rebuildNames(s.lostNames);
  }
  /* These three live inside one step and start a step as beginCreation leaves them. */
  deciding = null; saidFrom = 0; settleNow = false;
  /* The ages are over in a loaded world, so nothing of the ages is left standing. A load can arrive
     while a god's turn is open, and step() answers 'The turn is yours.' for as long as pending is set. */
  agePos = null; pending = null; runUntil = null; stops = [];
  resetDoor(); doorLog = s.doorLog;
}

/* Why the last load was refused, in the words the fault threw. The player sees the plain sentence;
   this is for whoever is looking at the console. It is not world state, so no snapshot holds it. */
let lastLoadFault = null;

/* Load a whole world from a snapshot. Returns null when it loaded, or the sentence that says why not. */
function loadSnapshot(snap){
  lastLoadFault = null;
  if (snap === null || typeof snap !== 'object' || Array.isArray(snap)) return 'This save cannot be read.';
  if (snap.version !== SNAPSHOT_VERSION){
    if (typeof snap.version !== 'number' || !Number.isFinite(snap.version)) return 'This file is not a save this world can read.';
    return `This save is version ${snap.version}. This world reads version ${SNAPSHOT_VERSION}.`;
  }
  if (snap.era !== 'days') return 'This save was taken before the world was made. Only a made world can be loaded.';
  const wrong = checkOptions(snap.options);
  if (wrong) return wrong;
  let stage;
  try { stage = decodeSnapshot(snap); }
  catch (e){ lastLoadFault = e && e.message ? e.message : String(e); return 'This save cannot be read.'; }
  commitSnapshot(stage);
  return null;
}

/* ---------- the guard ---------- */
/* Every record of the state, by identity, with its type. */
function registry(){
  const reg = new Map();
  const put = (r, type) => { if (r && typeof r === 'object') reg.set(r, type); };
  for (const level of levels) for (const t of level) put(t, 'tile');
  for (const a of beings) put(a, 'being');
  for (const i of items) put(i, 'item');
  for (const c of camps){ put(c, 'camp'); for (const s of c.snares) put(s, 'snare'); for (const p of c.pitfalls) put(p, 'pit'); }
  for (const c of caves) put(c, 'cave');
  for (const h of hills) put(h, 'hill');
  for (const g of groves) put(g, 'grove');
  for (const s of sectors) put(s, 'sector');
  if (field) for (const r of field.regions){ put(r, 'region'); for (const m of r.marks) put(m, 'mark'); }
  for (const b of boundaries) put(b, 'boundary');
  for (const e of lineList()) put(e, 'line');
  put(valley, 'valley'); put(river, 'water'); put(stillWater, 'water');
  for (const p of ponds || []) put(p, 'pond');
  for (const f of fords || []) put(f, 'ford');
  /* A stray grove is in no list, so the sprites that still point at it are the only way to reach it. */
  for (const a of beings) if (a.grove && !reg.has(a.grove)) put(a.grove, 'grove');
  /* A thing the name index alone holds is not a record of the world any more, and the snapshot keeps
     only its name records, which are plain data. There is nothing for the guard to walk: see
     `lostNames`. The thing itself is unreachable, so no field of the world can point at it either. */
  return reg;
}
/* The saved globals the guard walks itself. The record lists are left out: every record in one is
   already walked under its own type, and walking the list would name each of them a reference.
   resCache is a Map and startRegion a Set, and the encoder holds each as entries; the values of
   resCache are walked below. */
const WALK_HOME = { levels: 1, raised: 1, hills: 1, caves: 1, sectors: 1, groves: 1, camps: 1, campNow: 1,
  beings: 1, items: 1, chronicle: 1, legends: 1, boundaries: 1, creation: 1, field: 1, resCache: 1, startRegion: 1,
  valley: 1, river: 1, stillWater: 1, ponds: 1, fords: 1 };
/* Walk every record and report each field that points at another record and is not named in REFS.
   A new field that holds a reference fails the test in tests/snapshot.js until someone names it. */
function unnamedRefs(){
  SNAP_IX = {};
  try {
    const reg = registry(), out = new Set();
    /* One step of the walk. It reports a reference REFS does not name, and it reports anything a
       snapshot cannot hold: a Map, a Set, or any other object that is not plain data. The encoder
       turns a Map or a Set into {}, and a round trip then agrees because both sides lost it, so the
       guard must name it here instead. */
    const step = (v, type, path, seen, named, homes) => {
      if (v === null || typeof v !== 'object') return;
      if (named[path] !== undefined || homes[path] !== undefined) return;
      if ((REF_DERIVED[type] || {})[path] !== undefined) return;
      const where = path ? type + '.' + path : type;
      const kind = reg.get(v);
      if (kind !== undefined){ out.add(where + ' -> ' + kind); return; }
      if (seen.has(v)) return;
      seen.add(v);
      if (Array.isArray(v)){ for (const x of v) step(x, type, path + '[]', seen, named, homes); return; }
      if (v instanceof Map || v instanceof Set){ out.add(where + ' -> a Map or a Set, which a snapshot cannot hold'); return; }
      if (Object.getPrototypeOf(v) !== Object.prototype){ out.add(where + ' -> not plain data, which a snapshot cannot hold'); return; }
      for (const k of Object.keys(v)) step(v[k], type, path ? path + '.' + k : k, seen, named, homes);
    };
    const walk = (rec, type) => {
      const named = REFS[type] || {}, homes = REF_HOMES[type] || {};
      for (const k of Object.keys(rec)) step(rec[k], type, k, new Set(), named, homes);
    };
    for (const [rec, type] of reg) walk(rec, type);
    if (creation) walk(creation, 'creation');
    if (field) walk(field, 'field');
    /* Every other saved global, under its own name. A new one is walked the day it joins the table. */
    const vals = savedValues();
    for (const name of Object.keys(vals)) if (!WALK_HOME[name]) step(vals[name], name, '', new Set(), {}, {});
    for (const [k, v] of resCache) step(v, 'resCache', '[' + k + ']', new Set(), {}, {});
    return [...out].sort();
  } finally { SNAP_IX = null; }
}
