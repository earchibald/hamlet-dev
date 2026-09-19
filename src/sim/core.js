'use strict';
/* ============================================================
   SIMULATION CORE. No DOM access here.
   Two scales: a world of SW x SH sectors, each LW x LH tiles.
   The tile grid is continuous, so beings walk between sectors.

   The core is split into files under src/sim/. They are plain
   scripts that share one scope, joined in the order listed in
   src/sim/index.js. This file holds the constants, the data
   tables, the seeded random numbers, the shared state and the
   chronicle. The calendar and every duration are in clock.js.
   Every other file reads these.
   ============================================================ */
const LW = 28, LH = 20;
/* World size in sectors and the level range are start options. startWorld sets them before anything is allocated. */
let SW = 10, SH = 6, W = SW * LW, H = SH * LH;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const RING = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
const NEAR = [[0,0], ...DIRS];
/* The eight neighbours in order around the ring, so a walk along it stays on adjacent tiles. */
const AROUND = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
/* Levels. Level 0 is the surface. Above it are hilltops. Below it are caves. A level is an array like the surface, mostly null. */
let ZMIN = -2, ZMAX = 2, ZOFF = 2, NZ = ZMAX - ZMIN + 1;
/* `force` is the Force Actions setting: a barred option may be taken, with no penalty. It is read
   only where the player chooses. No rule reads it, so it cannot move the creation. */
const DEFAULT_OPTIONS = { sw: 10, sh: 6, zmin: -2, zmax: 2, ageLimit: 200, force: false };
let options;
function setOptions(o){
  options = { ...DEFAULT_OPTIONS, ...o };
  if (!Number.isInteger(options.sw) || !Number.isInteger(options.sh) || options.sw < 1 || options.sh < 1) throw new Error(`The world needs at least one sector each way. Got ${options.sw} by ${options.sh}.`);
  if (!Number.isInteger(options.zmin) || !Number.isInteger(options.zmax) || options.zmin > -2 || options.zmax < 2) throw new Error(`The level range must reach from -2 or lower to 2 or higher, since the valley digs two levels down and raises two up. Got ${options.zmin} to ${options.zmax}.`);
  if (!Number.isInteger(options.ageLimit) || options.ageLimit < 1) throw new Error(`The age limit must be a whole number of ages, at least 1. Got ${options.ageLimit}.`);
  SW = options.sw; SH = options.sh; W = SW * LW; H = SH * LH;
  ZMIN = options.zmin; ZMAX = options.zmax; ZOFF = -ZMIN; NZ = ZMAX - ZMIN + 1;
}

/* Data tables. Rules read properties. Rules do not check names. */
const MATERIALS = {
  wood:  { name: 'wood',         fuel: 80, flam: 0.35 },
  stone: { name: 'stone',        fuel: 0,  flam: 0 },
  plant: { name: 'living plant', fuel: 10, flam: 0.5 },
  flesh: { name: 'flesh',        fuel: 0,  flam: 0 },
};
const GROUND = {
  grass: { name: 'grass',       fuel: 6, flam: 0.6, walk: true },
  soil:  { name: 'bare soil',   fuel: 0, flam: 0,   walk: true },
  sand:  { name: 'sand',        fuel: 0, flam: 0,   walk: true, clay: true },
  ash:   { name: 'ash',         fuel: 0, flam: 0,   walk: true },
  water: { name: 'water',       fuel: 0, flam: 0,   walk: false },
  rock:  { name: 'bare rock',   fuel: 0, flam: 0,   walk: false, quarry: true },
  stone: { name: 'stone floor', fuel: 0, flam: 0,   walk: true },
};
const FEATURES = {
  tree:    { name: 'pine tree',  solid: true,  mat: 'wood',  fuel: 40 },
  bush:    { name: 'berry bush', solid: false, mat: 'plant', fuel: 10 },
  boulder: { name: 'boulder',    solid: true,  mat: 'stone', fuel: 0 },
  reeds:   { name: 'reeds',      solid: false, mat: 'plant', fuel: 8 },
  sapling: { name: 'pine sapling', solid: false, mat: 'plant', fuel: 5 },
  hollow:  { name: 'hollow pine, older than any camp', solid: true, mat: 'wood', fuel: 90 },
  deadpine: { name: 'dead pine, drowned standing', solid: true, mat: 'wood', fuel: 30 },
  mushrooms: { name: 'mushroom patch', solid: false, mat: 'plant', fuel: 4 },
};
const ITEMS = {
  stick:   { name: 'stick',          plural: 'sticks',    mat: 'wood',  fuel: 12 },
  rock:    { name: 'rock',           plural: 'rocks',     mat: 'stone', fuel: 0 },
  carcass: { name: 'rabbit carcass', plural: 'carcasses', mat: 'flesh', fuel: 0 },
  berries: { name: 'handful of berries', plural: 'berries', mat: 'plant', fuel: 0 },
  cooked:  { name: 'cooked meat',    plural: 'cooked meat', mat: 'flesh', fuel: 0 },
  ember:   { name: 'burning ember',  plural: 'embers',    mat: 'wood',  fuel: 0 },
  log:     { name: 'log',            plural: 'logs',      mat: 'wood',  fuel: 60 },
  hide:    { name: 'rabbit hide',    plural: 'hides',     mat: 'flesh', fuel: 0 },
  water:   { name: 'skin of water',  plural: 'water',     mat: 'flesh', fuel: 0 },
  smoked:  { name: 'strip of smoked meat', plural: 'smoked meat', mat: 'flesh', fuel: 0 },
  venison: { name: 'deer carcass',   plural: 'deer carcasses', mat: 'flesh', fuel: 0 },
  spear:   { name: 'spear',          plural: 'spears',    mat: 'wood',  fuel: 0 },
  moss:    { name: 'tuft of glowing moss', plural: 'glowing moss', mat: 'plant', fuel: 0 },
  firestones: { name: 'pair of firestones', plural: 'firestones', mat: 'stone', fuel: 0, find: 'Strikes a spark without a live ember.' },
  bones:   { name: 'old bones',       plural: 'old bones', mat: 'stone', fuel: 0, find: 'Someone else came this way, long ago.' },
  fibre:   { name: 'bundle of reed fibre', plural: 'fibre', mat: 'plant', fuel: 4 },
  cord:    { name: 'coil of cord',     plural: 'cord',  mat: 'plant', fuel: 2 },
  fish:    { name: 'fish',             plural: 'fish',  mat: 'flesh', fuel: 0 },
  clay:    { name: 'lump of clay',     plural: 'clay',  mat: 'stone', fuel: 0, gather: 'dig' },
  pot:     { name: 'clay pot',         plural: 'pots',  mat: 'stone', fuel: 0 },
  cuttings: { name: 'bundle of cuttings', plural: 'cuttings', mat: 'plant', fuel: 3, gather: 'take' },
  mushroom: { name: 'mushroom', plural: 'mushrooms', mat: 'plant', fuel: 0 }, // nothing gathers this yet; reserved for a later phase
};
const BIOMES = {
  meadow:  { name: 'Open meadow' },
  forest:  { name: 'Pine forest' },
  rocky:   { name: 'Stony ground' },
  wetland: { name: 'Reedy marsh' },
  river:   { name: 'Riverside' },
  ash:     { name: 'Burnt ground' },
};
const PIT_MAX = 400, STICK_FUEL = 50, LOG_FUEL = 140;

/* Seeded random numbers. */
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashSeed(s){ let h = 2166136261; for (const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
let rng = Math.random;
const rint = n => Math.floor(rng() * n);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const idx = (x, y) => y * W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
const idx3 = (x, y, z) => (z + ZOFF) * W * H + y * W + x;
/* Distance between two beings, or a being and a spot. A level apart counts as six tiles, through the rock. */
const near = (a, b) => dist(a.x, a.y, b.x, b.y) + 6 * Math.abs(a.z - b.z);
const nearAt = (a, x, y, z = 0) => dist(a.x, a.y, x, y) + 6 * Math.abs(a.z - z);
const secOf = (x, y) => ({ sx: Math.floor(x / LW), sy: Math.floor(y / LH) });
const secIdx = (sx, sy) => sy * SW + sx;
const secCenter = s => [s.sx * LW + (LW >> 1), s.sy * LH + (LH >> 1)];
function shuffle(arr){ const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* World state */
let world, levels, raised, hills, caves, sectors, beings, items, itemGrid, chronicle, corpses, tick, nextId, fireCount, seedText, camps, camp, goalPriority, namePool, resCache, weather, groves;
/* The valley after the last person. wanderAt is 0 while a person lives. It holds the tick a lone
   wanderer may arrive on once the people are gone. */
let wanderAt = 0;
/* The valley down to one person. doomAt is 0 unless the line is doomed. It holds the tick a lone
   wanderer may arrive on once the chronicle has said the line cannot go on. */
let doomAt = 0;
/* The eras. In the gods era a step is an age and nothing has a tile yet. field and boundaries are the
   regions the gods made; legends keeps every god-era line and is never trimmed; creation is the record
   of the run. godRng is the gods' own stream. */
let era = 'days', age = 0, pulseAge = null, godRng = null, legends = [], creation = null, field = null, boundaries = [];

/* The ladder in stages. The panel groups goals by these, in this order. */
const STAGES = [
  { id: 'fire',       label: 'Fire' },
  { id: 'food',       label: 'Food' },
  { id: 'tools',      label: 'Tools' },
  { id: 'shelter',    label: 'Shelter' },
  { id: 'crafts',     label: 'Crafts' },
  { id: 'sprites',    label: 'Neighbours' },
  { id: 'settlement', label: 'Settlement' },
];
/* Before the Pulse there is no "when", only "then". After it the ages count. */
function stamp(){
  if (era === 'gods') return pulseAge === null ? 'Before time' : `Age ${age - pulseAge + 1}`;
  return `Day ${dayOf()}, ${String(Math.floor(hourOf())).padStart(2, '0')}:00`;
}
/* A chronicle line. `tag` is what kind of thing happened, for the namer's event table and
   for the epithets. `camp` is whose line it is. Both are data. Nothing reads the text. */
function log(text, who = [], kind = 'info', tag = null){
  const e = { tick, when: stamp(), text, kind, tag, camp: camp ? camp.id : null };
  if (era === 'gods'){ e.age = age; legends.push(e); }
  chronicle.unshift(e); if (chronicle.length > 300) chronicle.pop();
  for (const a of who){ a.history.unshift(e); if (a.history.length > 40) a.history.pop(); }
}
