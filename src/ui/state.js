/* ============================================================
   INTERFACE. Reads the simulation state and draws it.
   ============================================================ */
const T = 26, WS = 3, MS = 9;
/* The three views, and the order M walks them: sector, nearby, world, sector. */
const NEXT_VIEW = { loc: 'mid', mid: 'world', world: 'loc' };
const VIEW_LABEL = { loc: 'Sector', mid: 'Nearby', world: 'World map' };
/* The tools. Inspect is the default. A one-shot tool returns to Inspect after one use, unless Shift made it stick. */
const TOOLS = [
  { id: 'inspect', key: 'i', label: 'Inspect',    oneShot: false, hint: 'Point at a person, an animal, or a tile. Enter or click opens a window with the details.' },
  { id: 'light',   key: 'f', label: 'Light fire', oneShot: true,  hint: 'Light the fire pit under the cursor. Enter or click lights it. Anything else starts a wildfire. The hover card says what will burn. Shift makes the tool stick.' },
  { id: 'nudge',   key: 'n', label: 'Nudge',      oneShot: true,  hint: 'Make a person stop and think again. Startle an animal. Enter or click nudges. Shift makes the tool stick.' },
];
const TRAIT_WORDS = { bravery: ['timid','steady','brave'], sociability: ['solitary','easygoing','outgoing'], diligence: ['lazy','average worker','hard-working'], temper: ['calm','even-tempered','hot-tempered'], curiosity: ['set in their ways','curious enough','always asking'], patience: ['restless','patient enough','very patient'], hardiness: ['frail','sturdy','tough as roots'] };
const NEED_LABEL = { food: 'Food', water: 'Water', rest: 'Rest', social: 'Company', warmth: 'Warmth', glow: 'Glow', play: 'Mischief', expression: 'Expression', company: 'Company', calm: 'Calm' };
let viewCamp = null;
let lvl = 0;
let cv, ctx, wcv, wctx, mcv, mctx, ocv, octx, dpr, P = {}, tool = 'inspect', view = 'world', cur = { sx: SW >> 1, sy: SH >> 1 }, followId = null;
let hover = null, whover = null, mhover = null, tipTarget = null, tipAnchor = null;
let speed = 1, paused = false, acc = 0, last = 0, lastUi = 0, chronKey = '', worldDirty = 0;
/* The ages. pace is the speed of the gods era: 1, 4, 16, or 64 ages in AGE_MS. It is not saved; a new world starts at 1.
   lastEra is the era the last frame saw, so the frame can see the flip at settle. */
const AGE_MS = 2000;
/* The tween between two ages. It runs for AGE_MS / pace, read at run time, so no number here names a pace.
   full, figure, and walk are that length in milliseconds: the least a tier of the drawing is worth. cue and
   stagger are fractions of the tween itself. These are view durations, and they stay out of src/sim/. */
const TWEEN = { full: 1000, figure: 300, walk: 100, cue: 0.25, stagger: 1 / 3 };
let pace = 1, lastEra = 'days';
let fieldKey = '';     /* what the cached field was drawn from */
/* The field as it stood before this age, and what the field cache holds. The cross-fade draws the old
   field and the new one over it, so only the countries that changed appear to change. */
let ocv2, octx2, fieldAge = -1, fieldDiscards = -1, fieldSkip = null, fieldJump = true;
const $ = id => document.getElementById(id);

/* What the view model remembers between frames. `ui` is one object so the tests can reach it. */
const ui = {
  pulses: [],          /* { text, until, being, tile } from major lines and goal unlocks */
  mutes: new Set(),    /* 'type' for every camp, 'type:campId' for one */
  seenTick: -1,        /* the newest chronicle tick notePulses has read */
  lastStates: {},      /* goal id to state, to see a goal leave blocked */
  open: ['people', 'goals'], /* drawers open, in order */
  focus: 'map',        /* 'map', 'drawer:<id>', 'window:<n>', or 'dialog:<name>' */
  row: { people: 0, goals: 0, chronicle: 0, camp: 0, legends: 0 }, /* the focused row per drawer */
  showAll: false,      /* goals: the whole ladder */
  unfold: {},          /* stage id to true when the player unfolded it */
  chronFilter: 'all',  /* 'all' or 'major' */
  note: null,          /* { text, at }: a said message that holds the foot for four seconds */
  savedSpeed: 0,       /* from storage, applied by newWorld */
  windows: [],         /* floating windows: { id, kind, target, x, y, w, h } */
  nextWin: 1,
  rects: {},           /* remembered rect per window kind or drawer id, from storage */
  sticky: false,       /* true keeps a one-shot tool selected after it is used */
  recent: [],          /* labels of the last commands run through the palette, newest first, at most five */
  overlay: false,      /* the countries drawn over the world map in the days */
  autosaveDay: 0,      /* the day the autosave slot last held. A new world starts at zero, so its first day writes. */
  autosaveWarned: false, /* true once the page has said it cannot keep an autosave */
};
const WIN_MAX = 6;
/* The speed ladder. Keys and steps name a place on it, not a value, so the ladder can change and they hold. */
const SPEEDS = [1, 4, 16, 64];

/* The tile cursor, in world coordinates. Arrows move it. Enter applies the tool at it. The mouse moves it too. */
let cursor = { x: SW * LW >> 1, y: SH * LH >> 1, z: 0 };

/* What survives a reload: open drawers, mutes, speed, the goals fold, the chronicle filter. Storage may be blocked, so every touch is wrapped. */
const STORE_KEY = 'hearth.ui';
function persist(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ open: ui.open, mutes: [...ui.mutes], speed: typeof speed === 'number' ? speed : 1, showAll: ui.showAll, chronFilter: ui.chronFilter, rects: ui.rects, recent: ui.recent })); } catch (e) { /* no storage */ }
}
function restore(){
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (!s) return;
    if (Array.isArray(s.open)) ui.open = s.open.filter(id => DRAWERS.some(d => d.id === id));
    if (Array.isArray(s.mutes)) ui.mutes = new Set(s.mutes);
    if (typeof s.showAll === 'boolean') ui.showAll = s.showAll;
    if (s.chronFilter === 'all' || s.chronFilter === 'major') ui.chronFilter = s.chronFilter;
    if (SPEEDS.includes(s.speed)) ui.savedSpeed = s.speed;
    if (s.rects && typeof s.rects === 'object') ui.rects = s.rects;
    if (Array.isArray(s.recent)) ui.recent = s.recent.filter(l => typeof l === 'string').slice(0, 5);
  } catch (e) { /* no storage, or bad data */ }
}
