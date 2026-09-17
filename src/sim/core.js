'use strict';
/* ============================================================
   SIMULATION CORE. No DOM access here.
   Two scales: a world of SW x SH sectors, each LW x LH tiles.
   The tile grid is continuous, so beings walk between sectors.

   The core is split into files under src/sim/. They are plain
   scripts that share one scope, joined in the order listed in
   src/sim/index.js. This file holds the constants, the data
   tables, the seeded random numbers, the shared state, time,
   and the chronicle. Every other file reads these.
   ============================================================ */
const SW = 10, SH = 6, LW = 28, LH = 20, W = SW * LW, H = SH * LH, DAY = 1000, TPS = 12;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const RING = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
const NEAR = [[0,0], ...DIRS];

/* Data tables. Rules read properties. Rules do not check names. */
const MATERIALS = {
  wood:  { name: 'wood',         fuel: 80, flam: 0.35 },
  stone: { name: 'stone',        fuel: 0,  flam: 0 },
  plant: { name: 'living plant', fuel: 10, flam: 0.5 },
  flesh: { name: 'flesh',        fuel: 0,  flam: 0 },
};
const GROUND = {
  grass: { name: 'grass',     fuel: 6, flam: 0.6 },
  soil:  { name: 'bare soil', fuel: 0, flam: 0 },
  sand:  { name: 'sand',      fuel: 0, flam: 0 },
  ash:   { name: 'ash',       fuel: 0, flam: 0 },
  water: { name: 'water',     fuel: 0, flam: 0 },
};
const FEATURES = {
  tree:    { name: 'pine tree',  solid: true,  mat: 'wood',  fuel: 40 },
  bush:    { name: 'berry bush', solid: false, mat: 'plant', fuel: 10 },
  boulder: { name: 'boulder',    solid: true,  mat: 'stone', fuel: 0 },
  reeds:   { name: 'reeds',      solid: false, mat: 'plant', fuel: 8 },
  sapling: { name: 'pine sapling', solid: false, mat: 'plant', fuel: 5 },
  hollow:  { name: 'hollow pine, older than any camp', solid: true, mat: 'wood', fuel: 90 },
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
};
const BIOMES = {
  meadow:  { name: 'Open meadow' },
  forest:  { name: 'Pine forest' },
  rocky:   { name: 'Stony ground' },
  wetland: { name: 'Reedy marsh' },
};
const PIT_MAX = 400, STICK_FUEL = 50, LOG_FUEL = 140, PIT_BURN = 0.25, EMBER_LIFE = 420;

/* Seeded random numbers. */
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashSeed(s){ let h = 2166136261; for (const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
let rng = Math.random;
const rint = n => Math.floor(rng() * n);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const idx = (x, y) => y * W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
const secOf = (x, y) => ({ sx: Math.floor(x / LW), sy: Math.floor(y / LH) });
const secIdx = (sx, sy) => sy * SW + sx;
const secCenter = s => [s.sx * LW + (LW >> 1), s.sy * LH + (LH >> 1)];
function shuffle(arr){ const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* World state */
let world, sectors, beings, items, itemGrid, chronicle, corpses, tick, nextId, fireCount, seedText, camps, camp, goalPriority, namePool, resCache, weather, groves;

const SEASON_DAYS = 8, SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const seasonOf = () => SEASONS[Math.floor((dayOf() - 1) / SEASON_DAYS) % 4];
const isWinter = () => seasonOf() === 'winter';
const hourOf = () => ((tick % DAY) / DAY) * 24;
const dayOf = () => Math.floor(tick / DAY) + 1;
const isNight = () => { const h = hourOf(); return h >= 20 || h < 6; };
function stamp(){ return `Day ${dayOf()}, ${String(Math.floor(hourOf())).padStart(2, '0')}:00`; }
function log(text, who = [], kind = 'info'){
  const e = { tick, when: stamp(), text, kind };
  chronicle.unshift(e); if (chronicle.length > 300) chronicle.pop();
  for (const a of who){ a.history.unshift(e); if (a.history.length > 40) a.history.pop(); }
}
