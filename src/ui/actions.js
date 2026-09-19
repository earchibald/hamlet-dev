/* God actions: tools, view changes, movement, and world control. */

/* A said message is a note. It holds the foot for four seconds of wall time, then the chronicle line comes back. */
const uiNow = () => typeof performance !== 'undefined' ? performance.now() : 0;
function say(msg){ ui.note = { text: msg, at: uiNow() }; renderFoot(); }
function setTool(id, sticky = false){
  tool = id; ui.sticky = sticky && TOOLS.find(t => t.id === id).oneShot;
  document.querySelectorAll('#tools .btn').forEach(b => { const on = b.dataset.tool === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.querySelector('.pin').hidden = !(on && ui.sticky); });
}
/* The strip's speed labels are only right for the days; relabel them here and in setPace, not in the frame
   loop, since they change only when the era or the ladder changes, not every frame. */
function relabelSpeeds(labels, key){
  document.querySelectorAll('#speeds .btn').forEach(b => {
    const label = labels[Number(b.dataset[key])];
    if (label !== undefined) b.firstChild.textContent = label;
  });
}
function setSpeed(s){ speed = s; relabelSpeeds(SPEED_LABEL, 'speed'); document.querySelectorAll('#speeds .btn').forEach(b => b.classList.toggle('on', Number(b.dataset.speed) === s)); persist(); }
function setPace(p){ pace = p; relabelSpeeds(PACE_LABEL, 'pace'); document.querySelectorAll('#speeds .btn').forEach(b => b.classList.toggle('on', Number(b.dataset.pace) === p)); }
/* A beat the player stepped belongs to a paused world. Un-pausing ends it; the running clock takes the rest. */
function setPaused(p){ paused = p; if (!p) ui.playing = false; $('pause').innerHTML = `${p ? 'Resume' : 'Pause'}<kbd>Space</kbd>`; $('pause').classList.toggle('on', p); }
function setLevel(z){ lvl = clamp(z, ZMIN, ZMAX); hideTip(); hover = null; renderUI(true); }
const levelName = z => z === 0 ? 'Surface' : z > 0 ? `Level +${z}` : `Level ${z}`;
function setView(v, s){
  if (inAges()) v = 'world';
  view = v; if (s) cur = { sx: s.sx, sy: s.sy }; hideTip(); hover = null; whover = null; mhover = null;
  $('world').hidden = v !== 'world'; $('loc').hidden = v !== 'loc'; $('mid').hidden = v !== 'mid';
  $('viewBtn').innerHTML = `${VIEW_LABEL[NEXT_VIEW[v]]}<kbd>M</kbd>`;
  renderUI(true);
}
function goto(sx, sy){ if (inAges()) return; if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return; followId = null; cursor = cursorInSector(cursor, sx, sy); setView('loc', { sx, sy }); }
/* Step to a neighbouring sector and keep the view. From the world map it opens the sector. */
function move(dx, dy){ moveCursor([dx, dy, 'sector']); }
/* Put the cursor on a tile and make the view follow it: the sector view scrolls to its sector, the level follows. */
function cursorTo(x, y, z){
  cursor = { x: clamp(x, 0, W - 1), y: clamp(y, 0, H - 1), z: clamp(z, ZMIN, ZMAX) };
  const s = secOf(cursor.x, cursor.y);
  if (s.sx !== cur.sx || s.sy !== cur.sy) setView(view, s); else renderUI(true);
  if (view === 'loc' && cursor.z !== lvl) setLevel(cursor.z);
}
function moveCursor([dx, dy, mult]){ followId = null; const c = cursorAfter(cursor, dx, dy, mult, view); cursorTo(c.x, c.y, c.z); }
/* The tool at the cursor. In the nearby and world views Enter opens the sector under it. */
function applyAt(){
  if (inAges()){ openGodAt(cursor.x, cursor.y); return; }
  if (view !== 'loc'){ const s = secOf(cursor.x, cursor.y); goto(s.sx, s.sy); return; }
  const c = { x: cursor.x, y: cursor.y, z: cursor.z, lx: cursor.x - cur.sx * LW, ly: cursor.y - cur.sy * LH };
  const r = cv.getBoundingClientRect(); const e = { clientX: r.left + (c.lx + 0.5) * r.width / LW, clientY: r.top + (c.ly + 0.5) * r.height / LH };
  applyTool(c, e);
}
function cycleView(){ if (inAges()){ say('The valley is not made yet. There is only the field.'); return; } followId = null; setView(NEXT_VIEW[view]); }
function randomSeed(){ const a = ['amber','birch','cinder','dusk','ember','fern','gravel','hollow','iron','juniper','kestrel','lichen','moss','nettle','oak','pine'], b = ['brook','crag','dale','fen','ford','glen','hill','marsh','moor','ridge','vale','wold']; return `${a[Math.floor(Math.random() * a.length)]}-${b[Math.floor(Math.random() * b.length)]}-${Math.floor(Math.random() * 100)}`; }
function cellFrom(e){ const r = cv.getBoundingClientRect(); const lx = clamp(Math.floor((e.clientX - r.left) / r.width * LW), 0, LW - 1), ly = clamp(Math.floor((e.clientY - r.top) / r.height * LH), 0, LH - 1); return { lx, ly, x: cur.sx * LW + lx, y: cur.sy * LH + ly, z: lvl }; }
function sectorFromMid(e){ const r = mcv.getBoundingClientRect(), { ox, oy } = midOrigin(); const s = secOf(ox + Math.floor((e.clientX - r.left) / r.width * 3 * LW), oy + Math.floor((e.clientY - r.top) / r.height * 3 * LH)); return s.sx >= 0 && s.sy >= 0 && s.sx < SW && s.sy < SH ? s : null; }
function sectorFrom(e){ const r = wcv.getBoundingClientRect(); return { sx: clamp(Math.floor((e.clientX - r.left) / r.width * SW), 0, SW - 1), sy: clamp(Math.floor((e.clientY - r.top) / r.height * SH), 0, SH - 1) }; }
const tileFromWorld = e => { const r = wcv.getBoundingClientRect(); return { x: clamp(Math.floor((e.clientX - r.left) / r.width * W), 0, W - 1), y: clamp(Math.floor((e.clientY - r.top) / r.height * H), 0, H - 1) }; };
/* The pointer's place in the field canvas's own drawing space, the one tileSpot answers in. Proportional
   to the rect the same way tileFromWorld is, so it holds regardless of how the canvas is laid out on the page. */
const worldPixelFrom = e => { const r = wcv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W * WS, y: (e.clientY - r.top) / r.height * H * WS }; };
/* In the ages, Enter or a click opens the first god that stands in the country under the cursor. */
function openGodAt(x, y){ const r = regionAt(x, y), g = r && gods().find(g => g.status !== 'dead' && standsIn(g) === r); if (g) ACTIONS.inspect(g.id); else say('No god stands here.'); }
/* The world canvases are sized here, not in initUI: startWorld sets W and H, and a world of another size needs another canvas. */
function newWorld(seed){
  startCreation(seed, {});
  fieldKey = '';
  cursor = { x: W >> 1, y: H >> 1, z: 0 };
  wcv.width = W * WS * dpr; wcv.height = H * WS * dpr;
  ocv.width = W * WS; ocv.height = H * WS;
  viewCamp = camps[0]; followId = null; lvl = 0; ui.windows = []; ui.focus = 'map'; worldDirty = 0; acc = 0; ui.pulses = []; ui.seenTick = -1; ui.lastStates = {}; ui.unfold = {}; ui.timelineChip = null; restore(); if (ui.savedSpeed) setSpeed(ui.savedSpeed);
  /* A new world has no autosave of its own, so its first day writes one. */
  ui.autosaveDay = 0;
  lastEra = 'gods'; setPace(1); setPaused(false); setView('world');
}

/* ---------- saves ----------
   The player's own file, the one autosave slot, and the view after a world arrives from either.
   The storage sits in saves.js. The door is the only way a save enters the world. */

/* Write the world to a file the player keeps. */
function saveWorld(){
  if (inAges()){ say('The world is not made yet. There is nothing to save.'); return; }
  let text;
  try { text = JSON.stringify(takeSnapshot()); }
  catch (e){ console.warn('The world could not be saved: ' + (e && e.message)); say('This world cannot be saved.'); return; }
  const name = saveName(seedText, tick);
  /* The page hands the file to the browser and is never told what became of it. A sandbox can refuse
     the download without an error, so the line says what was asked for, not what came of it. */
  say(writeSaveFile(name, text) || `Saving ${name}.`);
}

/* Open the file picker. The input's change handler carries on in openSaveFile. */
function loadWorldFile(){
  try { $('loadFile').click(); }
  catch (e){ say('This page cannot open a file.'); }
}

/* A file the player chose. A file that is not a save says so and changes nothing. */
function openSaveFile(file){
  readSaveFile(file).then(r => {
    if (r.error){ say(r.error); return; }
    loadWorld(r.snapshot);
  });
}

/* The one way a snapshot enters. The door answers with a sentence either way, so the log says whether
   the world changed: a load that lands appends an entry of its own, and a refusal appends nothing. */
function loadWorld(snapshot, note){
  const last = doorLog[doorLog.length - 1];
  const answer = inject({ source: 'player', act: 'load', snapshot });
  const landed = doorLog[doorLog.length - 1] !== last;
  if (landed) onLoad();
  /* The player gets the plain sentence. Whoever has the console open gets the reason the save threw. */
  else if (lastLoadFault) console.warn('The save was refused: ' + lastLoadFault);
  /* A world that arrived says so in the foot, over the new valley. A refusal goes where the caller asks. */
  if (landed || !note) say(answer); else note(answer);
  return landed;
}

/* The view after a load. Everything it remembers points at the world that was replaced, and the new
   world can be a smaller one, so this puts the view back on the ground as onSettle does. */
function onLoad(){
  acc = 0; worldDirty = 0; fieldKey = ''; chronKey = '';
  viewCamp = camps[0]; camp = camps[0];
  ui.seenTick = -1; ui.lastStates = {}; ui.pulses = []; ui.unfold = {};
  /* A row index, a followed person, and an open card all name a being of the old world. */
  followId = null; ui.row.people = 0; ui.row.goals = 0; ui.row.chronicle = 0; ui.row.camp = 0; ui.row.legends = 0;
  /* The opened chip named one act of one creation that no longer exists. */
  ui.timelineChip = null;
  ui.windows = ui.windows.filter(w => w.kind !== 'inspect'); if (ui.focus.startsWith('window:') && !ui.windows.some(w => `window:${w.id}` === ui.focus)) ui.focus = 'map';
  cursor = { x: clamp(cursor.x, 0, W - 1), y: clamp(cursor.y, 0, H - 1), z: clamp(cursor.z, ZMIN, ZMAX) };
  cur = { sx: clamp(cur.sx, 0, SW - 1), sy: clamp(cur.sy, 0, SH - 1) };
  lvl = clamp(lvl, ZMIN, ZMAX);
  /* A save is always of the days, so the frame must not take the loaded world for a settle. */
  lastEra = era;
  /* The loaded day is already saved. The next dawn writes the slot again. */
  ui.autosaveDay = dayOf();
  /* The rest is the page. The tests run this function with no canvas and no dialog behind it. */
  if (!wcv) return;
  wcv.width = W * WS * dpr; wcv.height = H * WS * dpr;
  ocv.width = W * WS; ocv.height = H * WS;
  setSpeed(ui.savedSpeed || speed || 1); setPaused(false);
  setView('loc', secOf(cursor.x, cursor.y));
}

/* One autosave slot, written at the first frame of each new day. It is the whole world, so a page
   that cannot store one says so once and plays on. */
function autosave(){
  ui.autosaveDay = dayOf();
  let text;
  /* A world the snapshot cannot name is not a silent failure. It is said once, as a slot that cannot
     be written is, and the reason goes to the console. */
  try { text = JSON.stringify(takeSnapshot()); }
  catch (e){
    console.warn('The autosave could not be taken: ' + (e && e.message));
    if (ui.autosaveFaultWarned) return;
    ui.autosaveFaultWarned = true;
    say('This world cannot be saved, so there is no autosave. The game plays on.');
    return;
  }
  putAutosave(text).then(ok => {
    if (ok || ui.autosaveWarned) return;
    ui.autosaveWarned = true;
    say('This page cannot keep an autosave. The game plays on.');
  });
}

/* A step threw. The world is left where it stopped, the game pauses, and one plain sentence says so.
   The fault goes to the console for whoever is looking. The frame loop itself keeps running. */
function onFault(e){
  /* onFault runs inside the frame loop's own try. A throw in here must not stop the next frame from
     being queued, so the body gets its own try, with a bare console.error as the last resort. */
  try {
    console.error(e);
    acc = 0;
    setPaused(true);
    say('The world stopped on a fault. Load a save or make a new world.');
  } catch (e2){ console.error(e2); }
}

/* The autosave read once when the page opens, parsed here and kept for the start dialog. */
let lastSave = null;
function offerContinue(){
  getAutosave().then(text => {
    if (!text) return;
    try { lastSave = JSON.parse(text); }
    catch (e){ return; }
    /* The slot is outside data. A save without a real tick would offer "day NaN", so it is no save. */
    if (!lastSave || typeof lastSave !== 'object' || lastSave.era !== 'days' || typeof lastSave.tick !== 'number' || !Number.isFinite(lastSave.tick)){ lastSave = null; return; }
    showContinue();
  });
}

/* Continue the last world, from the start dialog. A refusal stays in the dialog. */
function continueWorld(){
  if (!lastSave){ startNote('There is no world to continue.'); return; }
  if (loadWorld(lastSave, startNote)) closeDialogs();
}

/* The flip. The frame calls this once, in the first frame that sees the days after the ages. */
function onSettle(){
  acc = 0; worldDirty = 0; viewCamp = camps[0]; camp = camps[0]; ui.seenTick = -1; ui.lastStates = {}; ui.pulses = [];
  /* Eight gods become one person, so a row index from the ages would point past the list. */
  followId = null; ui.row.people = 0; ui.row.goals = 0;
  setSpeed(ui.savedSpeed || speed || 1);
  /* A god's card opened in the ages would cover the valley at the moment it first shows. Drawer windows stay. */
  ui.windows = ui.windows.filter(w => w.kind !== 'inspect'); if (ui.focus.startsWith('window:') && !ui.windows.some(w => `window:${w.id}` === ui.focus)) ui.focus = 'map';
  /* An opened chip names one act of a creation that is over. The band is hidden from here, so nothing
     could close it again, and the foot would print that act in place of the newest chronicle line. */
  ui.timelineChip = null;
  /* The band leaves the focus ring at settle. A focus left on it sends `[` and `]` to a hidden band. */
  if (ui.focus === 'timeline') ui.focus = 'map';
  const a = firstPerson();
  if (a){ cursor = { x: a.x, y: a.y, z: a.z }; setView('loc', secOf(a.x, a.y)); } else setView('world');
  say(creation.failed ? 'The gods sleep unfinished. The valley is what it is.' : 'The gods sleep. The valley is made, and one person wakes in it.');
}
function applyTool(c, e){
  switch (tool){
    case 'inspect': pinCell(c, e); break;
    case 'light': say(inject({ source: 'player', act: 'light', x: c.x, y: c.y, z: c.z })); camp = viewCamp; break;
    case 'nudge': { const a = beings.find(a => a.alive && a.x === c.x && a.y === c.y && a.z === c.z); say(a ? inject({ source: 'player', act: 'poke', id: a.id }) : 'Nobody is there to nudge.'); break; }
  }
  if (TOOLS.find(t => t.id === tool).oneShot && !ui.sticky) setTool('inspect');
  renderUI(true);
}

/* The action table. Every key and every click ends here. The only place view state changes. */
function openDrawer(id, on){
  const has = ui.open.includes(id), want = on === undefined ? !has : on;
  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 800;
  if (want && !has) ui.open = narrow ? [id] : ui.open.concat(id); if (!want && has) ui.open = ui.open.filter(x => x !== id);
  ui.focus = want ? `drawer:${id}` : 'map'; ui.row[id] = ui.row[id] || 0; persist(); renderUI(true);
}
const focusedDrawer = () => ui.focus.startsWith('drawer:') ? ui.focus.slice(7) : ui.focus.startsWith('window:') ? (ui.windows.find(w => w.id === Number(ui.focus.slice(7)) && w.kind === 'drawer') || {}).target || null : null;
/* Arrows in a drawer move the row. In an inspector window there are no rows, so they scroll the body by a line. */
const INS_SCROLL = 48;
function rowMove(d){
  const id = focusedDrawer();
  if (!id){
    if (!ui.focus.startsWith('window:')) return;
    const w = ui.windows.find(w => w.id === Number(ui.focus.slice(7)));
    if (!w || w.kind !== 'inspect') return;
    const body = document.querySelector(`#windows [data-win="${w.id}"] .body`);
    if (body) body.scrollTop += d * INS_SCROLL;
    return;
  }
  const n = drawerRows(id).length; if (!n) return; ui.row[id] = (ui.row[id] + d + n) % n; renderUI(true);
}
function rowPick(n){ const id = focusedDrawer(); if (!id) return; if (n - 1 < drawerRows(id).length){ ui.row[id] = n - 1; rowOpen(); } }
function rowOpen(){
  const id = focusedDrawer(); if (!id) return; const r = drawerRows(id)[ui.row[id]]; if (!r) return;
  if (r.kind === 'person'){ ACTIONS.inspect(r.id); }
  else if (r.kind === 'stage'){ ui.unfold[r.id] = !ui.unfold[r.id]; renderUI(true); }
  /* A legend opens the first god it names. */
  else if (r.kind === 'legend'){ const g = gods().find(g => r.e.text.includes(g.name)); if (g) ACTIONS.inspect(g.id); }
  /* A goal row opens nothing. A goal's priority changes only by Left and Right, the three buttons, or the palette. */
  else if (r.kind === 'line'){ const who = campHumans().concat(beings.filter(b => b.alive && b.species !== 'human')).find(b => namesIn(r.e.text, b.name)); if (who){ if (!inAges()) cursorTo(who.x, who.y, who.z); ACTIONS.inspect(who.id); } }
}
function setPriority(d){ const id = focusedDrawer(); if (id !== 'goals') return; const r = drawerRows('goals')[ui.row.goals]; if (!r || r.kind !== 'goal') return; say(inject({ source: 'player', act: 'priority', id: r.id, pri: clamp((goalPriority[r.id] ?? 1) + d, 0, 2) })); renderUI(true); }
function focusStep(d){ if (ui.focus.startsWith('dialog')) return; const ring = focusRing(); const i = Math.max(0, ring.indexOf(ui.focus)), j = (i + d + ring.length) % ring.length; ui.focus = ring[j]; renderUI(true); }
const ACTIONS = {
  pause(){ setPaused(!paused); },
  /* One act in the ages, one tick in the days. In the ages the beat then plays while the world is paused;
     stepping again cuts the beat that is running short and starts the next, so holding the key keeps up. */
  step(){ setPaused(true); if (inAges()){ ui.playing = false; acc = 0; step(true); ui.playing = true; } else step(); renderUI(true); },
  hour(){ if (inAges()){ say('There are no hours yet. Step moves one age.'); return; } setPaused(true); for (let k = 0; k < Math.round(hours(1)); k++) step(); renderUI(true); },
  slower(){ ACTIONS.speedStep(Math.max(0, ladder().indexOf(inAges() ? pace : speed) - 1)); },
  faster(){ ACTIONS.speedStep(Math.min(ladder().length - 1, ladder().indexOf(inAges() ? pace : speed) + 1)); },
  /* A place on the ladder, from zero. It does what that button does: the pace in the ages, the speed in the days. */
  speedStep(i){ ACTIONS.speed(ladder()[clamp(i, 0, ladder().length - 1)]); },
  speed(s){ if (inAges()) setPace(s); else setSpeed(s); setPaused(false); },
  hurry(){ if (!inAges()){ say('The valley is already made.'); return; } openHurry(); },
  hurryGo(){ closeDialogs(); runAges(); renderUI(true); },
  overlay(){ if (inAges()){ say('The field is all there is. The countries show after the valley is made.'); return; } ui.overlay = !ui.overlay; if (ui.overlay && view !== 'world'){ followId = null; setView('world'); } renderUI(true); },
  tool(id){ setTool(id); },
  toolSticky(id){ setTool(id, true); },
  inspect(id){ const a = beingById(id); if (!a) return; const w = winOpen('inspect', { being: id }); ui.focus = `window:${w.id}`; if (!inAges()) cursorTo(a.x, a.y, a.z); renderUI(true); },
  /* A god has no tile in the ages, and following would drag the view back every frame. */
  follow(id){ if (inAges()){ say('A god has no place yet. There is nothing to follow.'); return; } const w = id == null && ui.focus.startsWith('window:') ? ui.windows.find(w => w.id === Number(ui.focus.slice(7))) : null; const target = id != null ? id : w && w.kind === 'inspect' && w.target.being; if (target == null) return; followId = followId === target ? null : target; renderUI(true); },
  view(){ cycleView(); },
  levelUp(){ if (view === 'loc') setLevel(lvl + 1); },
  levelDown(){ if (view === 'loc') setLevel(lvl - 1); },
  nav([dx, dy]){ moveCursor([dx, dy, 'sector']); },
  cursor(arg){ moveCursor(arg); },
  applyAt(){ applyAt(); },
  home(){ if (viewCamp.pit) cursorTo(viewCamp.pit[0], viewCamp.pit[1], 0); else if (viewCamp.site) cursorTo(viewCamp.site[0], viewCamp.site[1], 0); },
  worldHere(){ followId = null; const t = viewCamp.site || [cursor.x, cursor.y]; cursor = { x: t[0], y: t[1], z: 0 }; setView('world', secOf(t[0], t[1])); },
  drawer(id){ openDrawer(id); },
  focusNext(){ focusStep(1); },
  focusPrev(){ focusStep(-1); },
  back(){
    if (ui.focus.startsWith('window:')){ winClose(Number(ui.focus.slice(7))); persist(); renderUI(true); return; }
    if (ui.focus !== 'map'){ ui.focus = 'map'; renderUI(true); return; }
    /* With the map focused, Esc closes the topmost window. The last entry of ui.windows is the one in front. */
    if (ui.windows.length){ winClose(ui.windows[ui.windows.length - 1].id); persist(); renderUI(true); return; }
    hideTip();
  },
  rowUp(){ rowMove(-1); },
  rowDown(){ rowMove(1); },
  rowOpen(){ rowOpen(); },
  rowPick(n){ rowPick(n); },
  priorityUp(){ setPriority(1); },
  priorityDown(){ setPriority(-1); },
  showAll(){ ui.showAll = !ui.showAll; persist(); renderUI(true); },
  /* The timeline. Folded it is one row of the creation; unfolded it is a row for each god. The zoom
     is on its own time axis and never touches the map's levels. */
  foldTimeline(){ ui.timelineFold = !ui.timelineFold; persist(); renderUI(true); },
  zoomTimelineOut(){ ui.timelineZoom = Math.min(TL_ZOOM_MAX, (ui.timelineZoom | 0) + 1); persist(); renderUI(true); },
  zoomTimelineIn(){ ui.timelineZoom = Math.max(0, (ui.timelineZoom | 0) - 1); persist(); renderUI(true); },
  /* A click anywhere in the band gives it the focus, so `[` and `]` zoom instead of changing level. */
  focusTimeline(){ ui.focus = 'timeline'; },
  /* One act of one creation, opened into the foot. The same chip twice closes it. */
  openChip(key){ ui.timelineChip = ui.timelineChip === key ? null : key; },
  campN(n){ const c = camps[n - 1]; if (c){ viewCamp = c; if (c.site){ followId = null; setView(view === 'world' ? 'loc' : view, secOf(...c.site)); } renderUI(true); } },
  help(){ openHelp(); },
  /* Closing Start with 'make' is what its button does. The dialog's close handler makes the world. */
  makeWorld(){ $('start').close('make'); },
  newWorld(){ openStart(); },
  /* Make the world, take the first god, and stop. E3 cannot be tested by hand without a way in, and a
     slice about what the player experiences must be reachable by a player. The turn card waits.
     The seed is the caller's: the start dialog's close handler reads the box once and hands it in here,
     so a typed seed is kept, the same way makeWorld leaves newWorld's seed to that one reader. Alt+G
     is the same button pressed by keyboard: with no seed given yet, it only closes the dialog as 'take',
     which reaches this again through that same close handler, seed in hand. */
  takeGod(seed){
    if (seed === undefined){ $('start').close('take'); return; }
    newWorld(seed);
    /* The first god is born at the first age, which a step opens, not startCreation. Take one here so
       there is a god to take; ageBegin only, never ageDecide, so the turn card still waits and no act
       runs on its own. The god picture is drawn on the gods' own stream, as every age's is: calling
       ageBegin here consumes exactly what the first step would have consumed, and agePos is set, so
       that step goes on to ageDecide and never begins the age twice.
       Known gap, for whoever builds god-era replay: this one call does not pass the door and is not in
       the door log. A log replayed onto a fresh startCreation has no record that an age was begun
       before the become act, so the become would find no god. God-era replay is not built today
       (replayGod selects by tick and runDays starts after settle), so nothing depends on it yet. A
       door act that begins the ages would close this; door.js is not this branch's to change. */
    withGodRng(() => ageBegin());
    const g = gods()[0];
    const answer = inject({ source: 'player', act: 'become', id: g ? g.id : null, mode: 'become' });
    say(answer);
    setPaused(true);
    renderUI(true);
  },
  saveWorld(){ saveWorld(); },
  loadWorldFile(){ loadWorldFile(); },
  continueWorld(){ continueWorld(); },
  jumpChip(n){
    const a = alerts()[n - 1]; if (!a) return;
    if (a.being != null){ const b = beingById(a.being); if (b){ if (view !== 'loc') setView('loc', secOf(b.x, b.y)); cursorTo(b.x, b.y, b.z); ACTIONS.inspect(b.id); } }
    else if (a.tile){ if (view !== 'loc') setView('loc', secOf(a.tile[0], a.tile[1])); cursorTo(a.tile[0], a.tile[1], a.tile[2] || 0); }
  },
  muteMenu(n){ const a = alerts()[n - 1]; if (a) openMute(a); },
  muteChoice(k){ muteChoice(k); },
  popOut(){
    if (ui.focus.startsWith('drawer:')){ const id = ui.focus.slice(7); const w = winOpen('drawer', id); ui.focus = `window:${w.id}`; }
    else if (ui.focus.startsWith('window:')){ const w = ui.windows.find(w => w.id === Number(ui.focus.slice(7))); if (w && w.kind === 'drawer'){ winClose(w.id); ui.focus = `drawer:${w.target}`; if (!ui.open.includes(w.target)) ui.open.push(w.target); } }
    persist(); renderUI(true);
  },
  /* `/` opens the Chronicle drawer and puts the caret in its box. openDrawer keeps the narrow-window
     rule, the row, and storage; the box is created with the section, so it is there by the time we focus it. */
  searchChronicle(){ openDrawer('chronicle', true); const box = $('chronSearch'); if (box) box.focus(); },
  /* The one writer of the query. The box's input handler calls it, and so does Esc. A shorter list would
     leave a stale row index pointing past the end, so the row goes back to the top with every change. */
  setChronSearch(v){
    const q = v == null ? '' : String(v);
    if (ui.chronSearch === q) return;
    ui.chronSearch = q; ui.row.chronicle = 0;
    const box = $('chronSearch'); if (box && box.value !== q) box.value = q;
    renderUI(true);
  },
  /* Esc in the box clears the query first, so one key both undoes the search and gives the keyboard back. */
  closeSearch(){
    if (ui.chronSearch){ ACTIONS.setChronSearch(''); return; }
    const box = $('chronSearch'); if (box) box.blur();
    ui.focus = 'drawer:chronicle'; renderUI(true);
  },
  palette(){ openPalette(); },
  paletteMove(d){ paletteMove(d); },
  paletteRun(){ paletteRun(); },
  palettePick(n){ paletteRun(n - 1); },
  chord(){ if (inAges()){ say('No goals yet. The valley is not made.'); return; } openChord(); },
  stage(id){ closeDialogs(); openDrawer('goals', true); ui.unfold[id] = true; const i = drawerRows('goals').findIndex(r => r.kind === 'stage' && r.id === id); if (i >= 0) ui.row.goals = i; renderUI(true); },
  goalPri({ id, pri }){ say(inject({ source: 'player', act: 'priority', id, pri })); renderUI(true); },
  gotoSector({ sx, sy }){ goto(sx, sy); },
  unmute(m){ ui.mutes.delete(m); persist(); renderUI(true); },
};
