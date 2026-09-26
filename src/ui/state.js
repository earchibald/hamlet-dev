/* ============================================================
   INTERFACE. Reads the simulation state and draws it.
   ============================================================ */
const T = 26, WS = 3, MS = 9;
/* The four views, and the order M walks them: sector, nearby, world, camp fire, sector. The camp fire
   view is the sector view's shape and scale, centred on the chosen camp's fire. `nextView` in derive.js
   skips it when there is no fire to centre on. */
const NEXT_VIEW = { loc: 'mid', mid: 'world', world: 'fire', fire: 'loc' };
const VIEW_LABEL = { loc: 'Sector', mid: 'Nearby', world: 'World map', fire: 'Camp fire' };
/* The two views drawn tile by tile at full size: the sector, and the camp fire. */
const closeUp = v => v === 'loc' || v === 'fire';
/* Every word the page adds for a world played as the sky, in one table so the text review finds them all.
   The sim's own sentences (prayers, answers, refusals, the season's line) are in FAITH_TEXT in
   src/sim/faith.js and are reused, not copied. `{name}` and the other slots are filled by faithSay. */
const SKY_TEXT = {
  grace: 'Grace',
  forgotten: 'Forgotten',
  believers: '{n} of {of} believe',
  left: '{time} left',
  slowed: '{name} prays. Time slows so you can listen.',
  slowOn: 'Time slows when someone prays.',
  slowOff: 'Time keeps its speed when someone prays.',
  slowKey: 'Slow for prayers, on or off',
  belief: 'Belief',
  hintCost: 'It costs {cost} grace.',
  tally: {
    believers: 'Believers', mean: 'Mean belief', answered: 'Answered by the sky', ownHands: 'Met by their own hands',
    silent: 'The sky was silent', births: 'Born', deaths: 'Died', spent: 'Grace spent',
  },
  /* The card's last line, picked by the first rule that fits, in this order. */
  closing: {
    forgotten: 'Nobody believes in the sky now.',
    quiet: 'Nobody needed the sky this season.',
    learning: 'They are learning to manage without the sky.',
    heard: 'The sky answered more often than it was silent.',
    unheard: 'They called more often than the sky answered.',
    even: 'The sky answered as often as it was silent.',
  },
  help: {
    watched: 'This world is watched, not played. Choose Play as the sky when you start a new world.',
    lines: [
      'You are the sky. Each person believes in you, from 0 to 100. Their card shows how much.',
      'Belief gives you grace. Each believer gives a little every hour, and more when they believe more. Grace stops at {cap}.',
      'People pray when they are in trouble: a cold fire in the evening, no food, a wolf in the dark, a wildfire near the camp, or a storm with no roof. A prayer shows as a chip with the time left, and a \u2726 over the one who prays.',
      'Each miracle answers one kind of prayer, and each costs grace. Spark lights a cold fire ({light}). Beckon calls deer and rabbits to the hungry ({beckon}). Ward drives off a wolf ({ward}). Rain puts out a wildfire ({rain}). Calm stops a storm ({calm}).',
      'A miracle answers a prayer only if it lands near the trouble, after the prayer is made. Nudge is free. It wakes one person and sends them to work.',
      'Calm stops a storm at once. With no storm, it does nothing and costs nothing.',
      'If the sky answers, the one who prayed believes more, and so do the others. If they manage by their own hands, they believe a little less. If nobody answers, they believe much less.',
      'Belief fades a little every day. If nobody believes, the sky is forgotten, and it cannot act.',
      'When a season ends, a card shows how it went.',
    ],
    slow: 'Slow for prayers is {state}. {key} switches it. When it is on, a new prayer slows the game to {speed}.',
    on: 'on', off: 'off',
  },
};
/* The tools. Inspect is the default. A one-shot tool returns to Inspect after one use, unless Shift made it stick.
   `act` is the door act a miracle sends, and its cost is FAITH.cost[act]. A tool with `faith` shows only in
   a world made to be played. The Spark is the old Light fire: with faith off it is free, as it was. */
const TOOLS = [
  { id: 'inspect', key: 'i', label: 'Inspect',    oneShot: false, hint: 'Point at a person, an animal, or a tile. Enter or click opens a window with the details.' },
  { id: 'light',   key: 'f', label: 'Spark',      oneShot: true,  act: 'light',  hint: 'Light the fire pit under the cursor. Enter or click lights it. Strike anywhere else, and it may start a wildfire. The hover card says what will burn. Shift makes the tool stick.' },
  { id: 'rain',    key: 'r', label: 'Rain',       oneShot: true,  act: 'rain',   faith: true, hint: 'Make it rain now, over the whole valley. Rain puts out a wildfire, and it soaks everyone without a roof. Enter or click calls the rain. Shift makes the tool stick.' },
  /* L is free in every focus. C is the borders, and S is in the stage chord. */
  { id: 'calm',    key: 'l', label: 'Calm',       oneShot: true,  act: 'calm',   faith: true, hint: 'Stop the rain now, over the whole valley. People out in it can get dry, but a wildfire the rain was putting out burns again. Enter or click stops the rain. Shift makes the tool stick.' },
  { id: 'ward',    key: 'd', label: 'Ward',       oneShot: true,  act: 'ward',   faith: true, hint: 'Guard the ground under the cursor for a day. Wolves and foxes near it run, and keep away. Enter or click guards it. Shift makes the tool stick.' },
  { id: 'beckon',  key: 'b', label: 'Beckon',     oneShot: true,  act: 'beckon', faith: true, hint: 'Call the deer and rabbits near the cursor to come to it. Wolves may follow them. Enter or click calls them. Shift makes the tool stick.' },
  { id: 'nudge',   key: 'n', label: 'Nudge',      oneShot: true,  hint: 'Make a person stop and think again. Startle an animal. Enter or click nudges. Shift makes the tool stick.' },
];
const TRAIT_WORDS = { bravery: ['timid','steady','brave'], sociability: ['solitary','easygoing','outgoing'], diligence: ['lazy','average worker','hard-working'], temper: ['calm','even-tempered','hot-tempered'], curiosity: ['set in their ways','curious enough','always asking'], patience: ['restless','patient enough','very patient'], hardiness: ['frail','sturdy','tough as roots'] };
const NEED_LABEL = { food: 'Food', water: 'Water', rest: 'Rest', social: 'Company', warmth: 'Warmth', glow: 'Glow', play: 'Mischief', expression: 'Expression', company: 'Company', calm: 'Calm' };
let viewCamp = null;
let lvl = 0;
let cv, ctx, wcv, wctx, mcv, mctx, ocv, octx, zcv, zctx, dpr, P = {}, tool = 'inspect', view = 'world', cur = { sx: SW >> 1, sy: SH >> 1 }, followId = null;
/* The zoom that is running, or null. { stops, legs, t, pics, boxes }. Only actions.js writes it: startZoom,
   advanceZoom and endZoom. The world does not step while it is set. */
let zoom = null;
let hover = null, whover = null, mhover = null, tipTarget = null, tipAnchor = null;
/* The speed the days open at when the player has none saved. At 1x a world day takes 24 real minutes
   and the first fire pit about 4, so a new player waited through a still valley. 8x brings the pit in
   about half a minute and a day in 3 minutes. It is not 64x, because at 64x a chronicle line is gone in
   about a second, and the first fire is the line a new player must not miss. A speed the player chose
   wins over this one: see ui.speedChosen. It must be a rung of SPEEDS, or setSpeed throws. */
const DAYS_SPEED = 8;
let speed = DAYS_SPEED, paused = false, acc = 0, last = 0, lastUi = 0, chronKey = '', worldDirty = 0;
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
/* The motion trail. A walker moves one square a tick, and at 1x that is a square a frame, so a slide
   between squares has no frames to show. A trail of fading dots marks the squares a creature crossed
   instead. Each dot fades out over `ms` of wall time. A creature keeps at most `max` dots. `alpha` is
   the newest dot's opacity. Wall time is the interface's, so this lives here and not in src/sim/. */
const TRAIL = { ms: 300, max: 8, alpha: 0.55 };
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
/* The preview of the ground for the act on the field, or null when it must be computed again. It is a cache
   derived from the state, not a choice the player makes. It exists because one call to previewField() cost
   8 to 10 ms in Node at b3d7777 (seed amber-ford-45, map 280x120, 33,600 tiles, ages 4 to 21, mean of 5
   calls per age), and 9 to 11 ms in Safari at age 21. The cache is drawn again when a cut's stroke ends,
   and it reuses this. */
let fieldPreview = null;
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
  open: [], /* drawers open, in order. Empty at the start: every tab begins closed. */
  focus: 'map',        /* 'map', 'drawer:<id>', 'window:<n>', or 'dialog:<name>' */
  row: { people: 0, goals: 0, chronicle: 0, camp: 0, legends: 0 }, /* the focused row per drawer */
  showAll: false,      /* goals: the whole ladder */
  unfold: {},          /* stage id to true when the player unfolded it */
  chronFilter: 'all',  /* 'all' or 'major' */
  /* The People drawer's camp: null follows the chosen camp, a number is a camp id, 'all' is everyone.
     Left out of persist(): a camp id is valid in one world only. onLoad and onSettle set it back. */
  peopleCamp: null,
  peopleAge: 'any',    /* the People drawer's age: 'any', 'young', 'adult', or 'old' */
  /* The chronicle's search, '' for everything. It is deliberately left out of persist() and restore():
     a query is a thing of the moment, and a reload that hid most of the chronicle would look broken. */
  chronSearch: '',
  note: null,          /* { text, at }: a said message that holds the foot for four seconds */
  savedSpeed: 0,       /* from storage, applied by newWorld */
  /* True once the player picks a days speed with a key, a button, or the palette. Only ACTIONS.speed sets
     it, and restore() reads it back. Before this marker, every page load saved speed 1 on its own, and
     that 1 was never the player's choice. A record from then has no marker. restore() keeps its speed
     unless it is 1, since only a click could have saved 8, 64, or 256. */
  speedChosen: false,
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
  /* The motion trails: being id to a list of [x, y, z, t], oldest first. The last entry is the square
     the being stands on. t is the wall time in ms when the being left that square. For the last
     entry, t is when the being reached it. Not saved: persist() names its fields, and this is not one. */
  trails: {},
  /* A world played as the sky. slowForPrayers is a preference and is saved: a new prayer drops the
     speed to DAYS_SPEED while it is on. seenPrayers holds the ids of the prayers the page has already
     seen, and seenTallies how many season cards it has shown. Both name one world, so they are not saved,
     and newWorld, onSettle, and onLoad set them again. Only actions.js writes the three, and restore() reads the preference back. */
  slowForPrayers: true,
  seenPrayers: {},
  seenTallies: 0,
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

/* The age button's cycle, in order. restore() accepts these and nothing else. */
const PEOPLE_AGES = ['any', 'young', 'adult', 'old'];

/* What survives a reload: open drawers, mutes, speed, the goals fold, the chronicle filter. Storage may be blocked, so every touch is wrapped. */
const STORE_KEY = 'hearth.ui';
/* The speed a reload opens at. Once the player has chosen one, it is ui.savedSpeed, not the speed now:
   a new prayer drops the speed to DAYS_SPEED, and setSpeed persists. When the speed now was written,
   a player at 64x who reloaded after a prayer opened at 8x. */
const persistedSpeed = () => ui.speedChosen === true && SPEEDS.includes(ui.savedSpeed) ? ui.savedSpeed : typeof speed === 'number' ? speed : 1;
function persist(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ open: ui.open, mutes: [...ui.mutes], speed: persistedSpeed(), speedChosen: ui.speedChosen === true, showAll: ui.showAll, chronFilter: ui.chronFilter, peopleAge: ui.peopleAge, rects: ui.rects, recent: ui.recent, timelineFold: ui.timelineFold, timelineZoom: ui.timelineZoom, slowForPrayers: ui.slowForPrayers })); } catch (e) { /* no storage */ }
}
function restore(){
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (!s) return;
    if (Array.isArray(s.open)) ui.open = s.open.filter(id => DRAWERS.some(d => d.id === id));
    if (Array.isArray(s.mutes)) ui.mutes = new Set(s.mutes);
    if (typeof s.showAll === 'boolean') ui.showAll = s.showAll;
    if (s.chronFilter === 'all' || s.chronFilter === 'major') ui.chronFilter = s.chronFilter;
    if (PEOPLE_AGES.includes(s.peopleAge)) ui.peopleAge = s.peopleAge;
    if (typeof s.timelineFold === 'boolean') ui.timelineFold = s.timelineFold;
    if (typeof s.slowForPrayers === 'boolean') ui.slowForPrayers = s.slowForPrayers;
    if (Number.isInteger(s.timelineZoom) && s.timelineZoom >= 0 && s.timelineZoom <= TL_ZOOM_MAX) ui.timelineZoom = s.timelineZoom;
    const chosen = s.speedChosen === true || (s.speedChosen === undefined && s.speed !== 1);
    if (chosen && SPEEDS.includes(s.speed)){ ui.savedSpeed = s.speed; ui.speedChosen = true; }
    if (s.rects && typeof s.rects === 'object') ui.rects = s.rects;
    if (Array.isArray(s.recent)) ui.recent = s.recent.filter(l => typeof l === 'string').slice(0, 5);
  } catch (e) { /* no storage, or bad data */ }
}
