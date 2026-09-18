/* ============================================================
   INTERFACE. Reads the simulation state and draws it.
   ============================================================ */
const T = 26, WS = 3, MS = 9;
/* The three views, and the order M walks them: sector, nearby, world, sector. */
const NEXT_VIEW = { loc: 'mid', mid: 'world', world: 'loc' };
const VIEW_LABEL = { loc: 'Sector', mid: 'Nearby', world: 'World map' };
const TOOLS = [
  { id: 'inspect', key: 'i', label: 'Inspect',   hint: 'Point at a person, an animal, or a tile. Click to pin the details open.' },
  { id: 'light',   key: 'f', label: 'Light',     hint: 'Click the fire pit to light it. Click anything else, and you start a wildfire. The hover card shows what will burn.' },
  { id: 'camp',    key: 'c', label: 'Camp site', hint: 'Click open ground to move the camp site. Only until the pit is built.' },
  { id: 'poke',    key: 'p', label: 'Poke',      hint: 'Click a person to make them drop what they are doing and think again. Click an animal to startle it.' },
];
const TRAIT_WORDS = { bravery: ['timid','steady','brave'], sociability: ['solitary','easygoing','outgoing'], diligence: ['lazy','average worker','hard-working'], temper: ['calm','even-tempered','hot-tempered'], curiosity: ['set in their ways','curious enough','always asking'], patience: ['restless','patient enough','very patient'], hardiness: ['frail','sturdy','tough as roots'] };
const NEED_LABEL = { food: 'Food', water: 'Water', rest: 'Rest', social: 'Company', warmth: 'Warmth', glow: 'Glow', play: 'Mischief' };
let viewCamp = null;
let lvl = 0;
let cv, ctx, wcv, wctx, mcv, mctx, ocv, octx, dpr, P = {}, tool = 'inspect', view = 'world', cur = { sx: SW >> 1, sy: SH >> 1 }, followId = null;
let hover = null, whover = null, mhover = null, tipTarget = null, tipAnchor = null, tipPinned = false;
let speed = 1, paused = false, acc = 0, last = 0, lastUi = 0, chronKey = '', worldDirty = 0;
const $ = id => document.getElementById(id);

/* What the view model remembers between frames. `ui` is one object so the tests can reach it. */
const ui = {
  pulses: [],          /* { text, until, being, tile } from major lines and goal unlocks */
  mutes: new Set(),    /* 'type' for every camp, 'type:campId' for one */
  seenTick: -1,        /* the newest chronicle tick notePulses has read */
  lastStates: {},      /* goal id to state, to see a goal leave blocked */
  open: ['people', 'goals'], /* drawers open, in order */
  focus: 'map',        /* 'map', 'drawer:<id>', or 'dialog' */
  row: { people: 0, goals: 0, chronicle: 0, camp: 0 }, /* the focused row per drawer */
  showAll: false,      /* goals: the whole ladder */
  unfold: {},          /* stage id to true when the player unfolded it */
  chronFilter: 'all',  /* 'all' or 'major' */
  savedSpeed: 0,       /* from storage, applied by newWorld */
};
