/* ---------- snapshots: the whole world as plain JSON ----------
   A snapshot is taken between steps, in the days era. It holds every piece of state the rules read,
   and nothing that can be rebuilt from those. The state is a graph: a tile points at its cave, a cave
   points back at its tiles, a snare is one object in two places. JSON cannot hold a graph, so REFS
   names every field that points at another record, and each kind of target has a way to name one
   record by a number, by an index pair, or by an id. The loader turns those names back into the one
   record they name, so the sharing that the rules compare by identity comes back whole.

   Nothing here draws from a random stream, and nothing here writes to a live record. */
const SNAPSHOT_VERSION = 1;

/* Every field of a record that holds a reference, and the kind of record it points at. A dotted name
   is a path into a plain object the record owns; the encoder copies the objects along that path. The
   owning lists (camp.snares, camp.pitfalls, region.marks, field.regions) are homes, not references. */
const REFS = {
  tile:     { hill: 'hill', cave: 'cave', mouth: 'cave', garden: 'camp', 'struct.camp': 'camp', 'struct.snare': 'snare', 'struct.pit': 'pit' },
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
};
/* The lists that own their records, and the type of record each holds. A record met along one of these
   paths is at home, not pointed at, so the encoder writes it whole. */
const REF_HOMES = { camp: { snares: 'snare', pitfalls: 'pit' }, region: { marks: 'mark' }, field: { regions: 'region' } };

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
   map, and a tileAt(i) that finds a staged tile by its idx3 number. */
const REF_KINDS = {
  camp:   { toId: c => snapIndex('camps', camps, c, 'camp'),       fromId: (i, s) => at(s.camps, i, 'camp') },
  cave:   { toId: c => snapIndex('caves', caves, c, 'cave'),       fromId: (i, s) => at(s.caves, i, 'cave') },
  hill:   { toId: h => snapIndex('hills', hills, h, 'hill'),       fromId: (i, s) => at(s.hills, i, 'hill') },
  grove:  { toId: g => snapIndex('groves', groves, g, 'grove'),    fromId: (i, s) => at(s.groves, i, 'grove') },
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
};
function at(list, i, what){ const r = list && list[i]; if (!r) throw new Error(`This save names a ${what}, ${i}, that is not in it.`); return r; }
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
};
/* Which global the snapshot leaves out, and why. Each of these comes back from something else. */
const NOT_SAVED = {
  SW: 'derived from options', SH: 'derived from options', W: 'derived from options', H: 'derived from options',
  ZMIN: 'derived from options', ZMAX: 'derived from options', ZOFF: 'derived from options', NZ: 'derived from options',
  world: 'derived: levels[ZOFF]', itemGrid: 'derived from items', regionOf: 'derived from field.regions',
  bfsPrev: 'search scratch', bfsSeen: 'search scratch', bfsGen: 'search scratch',
  deciding: 'lives inside one god act', saidFrom: 'lives inside one god act', settleNow: 'lives inside one age step',
  replayHead: 'derived from the seed and the options', tileCheckImpl: 'a test seam',
  SNAP_IX: 'scratch, lives inside one snapshot',
};

/* The whole state as plain JSON. Nothing here changes the state or draws from a stream. */
function takeSnapshot(){
  if (era !== 'days') throw new Error('A snapshot is taken only once the world is made.');
  SNAP_IX = {};
  try {
    const lines = lineList(), lineId = e => REF_KINDS.line.toId(e);
    return {
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
    };
  } finally { SNAP_IX = null; }
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
  return reg;
}
/* Walk every record and report each field that points at another record and is not named in REFS.
   A new field that holds a reference fails the test in tests/snapshot.js until someone names it. */
function unnamedRefs(){
  SNAP_IX = {};
  try {
    const reg = registry(), out = new Set();
    const walk = (rec, type) => {
      const named = REFS[type] || {}, homes = REF_HOMES[type] || {};
      const step = (v, path, seen) => {
        if (v === null || typeof v !== 'object') return;
        if (named[path] !== undefined || homes[path] !== undefined) return;
        const kind = reg.get(v);
        if (kind !== undefined){ out.add(type + '.' + path + ' -> ' + kind); return; }
        if (seen.has(v)) return;
        seen.add(v);
        if (Array.isArray(v)){ for (const x of v) step(x, path + '[]', seen); return; }
        if (Object.getPrototypeOf(v) !== Object.prototype) return;
        for (const k of Object.keys(v)) step(v[k], path + '.' + k, seen);
      };
      for (const k of Object.keys(rec)) step(rec[k], k, new Set());
    };
    for (const [rec, type] of reg) walk(rec, type);
    if (creation) walk(creation, 'creation');
    if (field) walk(field, 'field');
    return [...out].sort();
  } finally { SNAP_IX = null; }
}
