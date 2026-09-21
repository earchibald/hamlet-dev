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
/* How many world ticks the page draws in one real second at pace 1. A tick is one world second,
   so this is how much faster than life the valley runs when it is watched at the slowest pace.
   It lives here and not in the clock table because it is wall time, and wall time is the
   interface's: it never passes the door, and the same seed reaches the same world at any pace. */
const TICKS_A_SECOND = 60;
/* The ages. pace is the speed of the gods era: a quarter, a half, single, or double. It is not saved; a
   new world starts at single. lastEra is the era the last frame saw, so the frame can see the flip at
   settle. */
const BEAT_MS = 1000;
const PACES = [0.25, 0.5, 1, 2];
/* How long one frame may spend stepping the world in the days. A frame at 60 fps is 16.7 ms, so half
   of it is left for the draw, the once-a-quarter-second interface render, and the browser's own work.
   The world view redraws in about 0.2 ms on an M-series Mac (Safari, 2026-09-20), so the half is
   generous today. It is set at half and not higher so that a machine, or a view, where the draw costs
   several milliseconds still draws: the frame drops world ticks rather than frames. */
const STEP_BUDGET_MS = 8;
/* The tween of one beat. It runs for BEAT_MS / pace, read at run time, so no number here names a pace.
   full and figure are that length in milliseconds: the least a tier of the drawing is worth. cue,
   draw and word are fractions of the beat itself, and say when each stage of it ends. These are view
   durations, and they stay out of src/sim/. */
const TWEEN = { full: 1000, figure: 300, cue: 0.25, draw: 0.6, word: 0.85 };
let pace = 1, lastEra = 'days';
let fieldKey = '';     /* what the cached field was drawn from */
/* The field as it stood before this age, and what the field cache holds. The cross-fade draws the old
   field and the new one over it, so only the countries that changed appear to change. */
let ocv2, octx2, fieldAge = -1, fieldGestures = -1, fieldDiscards = -1, fieldSkip = null, fieldJump = true;
/* How many beats the last frame ran. The field snaps when a frame ran two or more, because there is no
   single act to fade from. Counting gestures cannot stand in for this: one decision can write two
   gestures — a split that also gives birth — and that is one beat, with an act to draw. */
let beatsLastFrame = 1;
const $ = id => document.getElementById(id);
/* Write markup only when it differs from the last string this helper sent to that element. A render
   that rebuilds the same markup every call, with the world running, replaces an element's children
   between a click's press and its release, and the click is lost. The check is against the string
   this helper last wrote, held in a WeakMap keyed by the element, and not against el.innerHTML: the
   browser re-serialises markup, so a read-back can differ from what was written even when nothing
   changed. */
const htmlWritten = new WeakMap();
const setHTML = (el, html) => {
  if (htmlWritten.get(el) === html) return;
  htmlWritten.set(el, html);
  el.innerHTML = html;
};

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
  /* The chronicle's search, '' for everything. It is deliberately left out of persist() and restore():
     a query is a thing of the moment, and a reload that hid most of the chronicle would look broken. */
  chronSearch: '',
  note: null,          /* { text, at }: a said message that holds the foot for four seconds */
  savedSpeed: 0,       /* from storage, applied by newWorld */
  windows: [],         /* floating windows: { id, kind, target, x, y, w, h } */
  nextWin: 1,
  rects: {},           /* remembered rect per window kind or drawer id, from storage */
  sticky: false,       /* true keeps a one-shot tool selected after it is used */
  recent: [],          /* labels of the last commands run through the palette, newest first, at most five */
  overlay: false,      /* the countries drawn over the world map in the days */
  timelineFold: true,  /* the timeline is one row; false is a row for each god */
  timelineZoom: 0,     /* 0 keeps the near ages large; each step out doubles the span */
  timelineChip: null,  /* the chip the player opened, `age:god`, or null. Not a preference: it names one act of one creation. */
  autosaveDay: 0,      /* the day the autosave slot last held. A new world starts at zero, so its first day writes. */
  autosaveWarned: false, /* true once the page has said it cannot keep an autosave (storage failed) */
  autosaveFaultWarned: false, /* true once the page has said the world itself cannot be saved */
  playing: false,      /* a beat the player stepped is running; the frame loop drives it and then clears it */
};
const WIN_MAX = 6;
/* The speed ladder. Keys and steps name a place on it, not a value, so the ladder can change and they hold.

   A rung is a multiplier on TICKS_A_SECOND, so rung v asks for v * 60 world ticks in one real second.
   The G4 retune made a world day 86,400 ticks where it was 1,000, and a year 365 days where it was 32.
   The old top rung, 64, asks 3,840 ticks a second, which crosses a world day in 22 s and reaches
   winter, day 274, in about 1.7 h of watching. The rungs were raised, not counted again: four rungs
   keep every key and every button where they are.

   What each rung costs, at 86,400 ticks a world day and 31,536,000 a world year:

     rung 1      60 ticks/s       a day 24 min     a year 6.1 real days
     rung 8      480 ticks/s      a day 3 min      a year 18.3 h
     rung 64     3,840 ticks/s    a day 22.5 s     a year 2.3 h
     rung 256    15,360 ticks/s   a day 5.6 s      a year 34 min

   The top rung was measured, not chosen by taste. Measured 2026-09-20 on this branch, on an
   M-series Mac, in valleys grown to world day 12 (40 to 48 beings, 2,300 to 3,700 ground items; the
   seed differs between the Node runs and the browser runs, so the counts are given as a range):

     the engine alone, nothing drawn     31,000 to 37,000 ticks/s in Node
                                         about 32,000 ticks/s in Safari
     the page, world map, no drawer      13,943 ticks/s at 60.1 fps in Safari
     the page, location map, two drawers  7,085 ticks/s at 60.2 fps in Safari

   The page reaches less than the engine because a frame keeps STEP_BUDGET_MS and gives the rest to
   the draw, so a costlier view buys fewer world ticks. 256 asks 15,360. The world map, which is the
   view a player watches from while the seasons pass, meets nine tenths of it. The location map with
   two drawers open meets under half, and the frame rate holds at 60 either way: the budget spends
   what it has and drops the rest, so a heavy view costs world time and never the drawing.

   The step from 64 is four and not eight because the machine ends the ladder there. A rung above
   this one would only mean "as fast as this machine allows" and would make its own printed rate a
   lie. 512 was built and measured first: the same page under it delivered 12,249 ticks a second,
   which is 40% of what its label claims. */
const SPEEDS = [1, 8, 64, 256];
/* How each ladder's steps print on a button or in the help. The ages use the fraction glyphs, since the
   page is already UTF-8 and a decimal (0.25×) would sit oddly beside the days' whole numbers. */
const SPEED_LABEL = { 1: '1×', 8: '8×', 64: '64×', 256: '256×' };
const PACE_LABEL = { 0.25: '¼×', 0.5: '½×', 1: '1×', 2: '2×' };

/* The tile cursor, in world coordinates. Arrows move it. Enter applies the tool at it. The mouse moves it too. */
let cursor = { x: SW * LW >> 1, y: SH * LH >> 1, z: 0 };

/* What survives a reload: open drawers, mutes, speed, the goals fold, the chronicle filter. Storage may be blocked, so every touch is wrapped. */
const STORE_KEY = 'hearth.ui';
function persist(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ open: ui.open, mutes: [...ui.mutes], speed: typeof speed === 'number' ? speed : 1, showAll: ui.showAll, chronFilter: ui.chronFilter, rects: ui.rects, recent: ui.recent, timelineFold: ui.timelineFold, timelineZoom: ui.timelineZoom })); } catch (e) { /* no storage */ }
}
function restore(){
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (!s) return;
    if (Array.isArray(s.open)) ui.open = s.open.filter(id => DRAWERS.some(d => d.id === id));
    if (Array.isArray(s.mutes)) ui.mutes = new Set(s.mutes);
    if (typeof s.showAll === 'boolean') ui.showAll = s.showAll;
    if (s.chronFilter === 'all' || s.chronFilter === 'major') ui.chronFilter = s.chronFilter;
    if (typeof s.timelineFold === 'boolean') ui.timelineFold = s.timelineFold;
    if (Number.isInteger(s.timelineZoom) && s.timelineZoom >= 0 && s.timelineZoom <= TL_ZOOM_MAX) ui.timelineZoom = s.timelineZoom;
    if (SPEEDS.includes(s.speed)) ui.savedSpeed = s.speed;
    if (s.rects && typeof s.rects === 'object') ui.rects = s.rects;
    if (Array.isArray(s.recent)) ui.recent = s.recent.filter(l => typeof l === 'string').slice(0, 5);
  } catch (e) { /* no storage, or bad data */ }
}
