/* God actions: tools, view changes, movement, and world control. */

/* The act caption on stage, if any: the sentence drawField shows in the page, above the foot, clear of
   the drawers and never on the canvas. Held here, not only written, so the foot can tell when it would
   repeat the same sentence and stay quiet instead. Empty once no act caption is on stage: the ages
   moved past it, the valley is made, a new world starts, or a save loads. The one writer of
   `captionText`; every other file calls this instead of setting the field itself, the same way
   `setFocus` is the one writer of `ui.focus`. */
let captionText = '';
/* The pole of the god whose act wrote captionText, kept beside it so the caption's icon changes with
   the god on stage. null when no icon is shown: an empty caption, or a caption with no acting god. */
let captionPole = null;
function setActCaption(text, pole){
  text = text || ''; pole = pole || null;
  if (text === captionText && pole === captionPole) return;
  captionText = text; captionPole = pole;
  /* Some field tests stub a bare document for the canvas alone, with no getElementById, and a test
     that drives onSettle or newWorld directly may have no document at all; the page write is skipped
     there, and the text these tests read comes straight from captionText. The icon markup this file
     builds is not player text, but the caption text now sits beside it inside the same innerHTML
     write, so esc keeps it inert on the way in, the same way every other sink in src/ui/ escapes a
     dynamic string before it joins markup. */
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const el = $('actCaption'); if (!el) return;
  el.hidden = !text;
  el.innerHTML = (pole ? godIconSvg(pole, 16, null) : '') + esc(text);
  /* The foot's own line can repeat this same sentence, or go on showing the last one after this clears.
     renderFoot reads captionText (set above) to decide whether to echo it, so this must run after the
     assignment, every time the caption's text actually changes. */
  renderFoot();
}

/* A said message is a note. It holds the foot for four seconds of wall time, then the chronicle line comes back. */
const uiNow = () => typeof performance !== 'undefined' ? performance.now() : 0;
function say(msg){ ui.note = { text: msg, at: uiNow() }; renderFoot(); }
function setTool(id, sticky = false){
  tool = id; ui.sticky = sticky && TOOLS.find(t => t.id === id).oneShot;
  document.querySelectorAll('#tools .btn').forEach(b => { const on = b.dataset.tool === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.querySelector('.pin').hidden = !(on && ui.sticky); });
}
/* The one writer of `ui.focus`. Every file but this one calls this instead of setting the field
   itself; writes inside actions.js keep setting it directly.
   A bare function, not an `ACTIONS` member: the "every action holds in the ages" test calls
   every `ACTIONS` key blind, and `setFocus(undefined)` would corrupt `ui.focus`. */
function setFocus(v){ ui.focus = v; }
/* The motion trails. The frame loop calls noteTrails after each step of the days, and pruneTrails
   once a frame. A god does not walk (its species has perTick false), so it leaves no trail. A move of
   more than two squares, or of more than one level, is not a walk: a load or a long jump would draw a
   streak across the map, so the trail starts again at the new square. Two squares is a run. */
function noteTrails(now){
  for (const a of beings){
    const sp = SPECIES[a.species];
    if (!a.alive || !sp || sp.perTick === false) continue;
    const tr = ui.trails[a.id], prev = tr && tr[tr.length - 1];
    if (!prev){ ui.trails[a.id] = [[a.x, a.y, a.z, now]]; continue; }
    if (prev[0] === a.x && prev[1] === a.y && prev[2] === a.z) continue;
    if (Math.abs(a.x - prev[0]) > 2 || Math.abs(a.y - prev[1]) > 2 || Math.abs(a.z - prev[2]) > 1){ ui.trails[a.id] = [[a.x, a.y, a.z, now]]; continue; }
    /* The square left behind is stamped with the time it was left, so its dot fades from then. A
       square kept through a rest would otherwise carry its old time and show no dot at all. */
    prev[3] = now; tr.push([a.x, a.y, a.z, now]);
    while (tr.length > TRAIL.max + 1) tr.shift();
  }
}
/* A trail whose being is gone or dead is dropped. A trail at rest past TRAIL.ms keeps only the square
   the being stands on, so its first step after the rest still leaves a dot. One lookup per call, since
   beingById is a linear find. */
function pruneTrails(now){
  const live = {}; for (const a of beings) if (a.alive) live[a.id] = true;
  for (const id in ui.trails){
    const tr = ui.trails[id];
    if (!live[id]){ delete ui.trails[id]; continue; }
    if (tr.length > 1 && now - tr[tr.length - 1][3] > TRAIL.ms) ui.trails[id] = [tr[tr.length - 1]];
  }
}
/* The strip's speed labels are only right for the days; relabel them here and in setPace, not in the frame
   loop, since they change only when the era or the ladder changes, not every frame. */
function relabelSpeeds(labels, key){
  document.querySelectorAll('#speeds .btn').forEach(b => {
    const label = labels[Number(b.dataset[key])];
    if (label !== undefined) b.firstChild.textContent = label;
  });
}
/* Each ladder is written twice: once as `PACES` or `SPEEDS` in state.js, and once as the `data-pace`
   and `data-speed` attributes in src/page.template.html. The click handler in main.js reads the
   attribute straight into `ACTIONS.speed`, and nothing derives either copy from the other. A
   `data-pace="4"` typed into the template therefore set a pace no rule had ever seen, and the whole
   suite stayed green. `restore()` in state.js already guards its own incoming value with
   `SPEEDS.includes(s.speed)`; these two doors did not.
   A value off the ladder throws. It is not ignored and not clamped: every legitimate route in —
   `speedStep`, which indexes the ladder; `restore`, which is already guarded; `setPace(1)` at the
   ages — can only produce a rung, so an argument off the ladder is a defect in the code or in the
   template, and a defect that is quietly absorbed is the failure this guard exists to end. The
   throw comes before the assignment, so `pace` and `speed` keep their last good value. */
function onLadder(rungs, v, fn, name){
  if (!rungs.includes(v)) throw new TypeError(`${fn} was given ${v}, which is not on the ladder ${name} (${rungs.join(', ')})`);
}
function setSpeed(s){ onLadder(SPEEDS, s, 'setSpeed', 'SPEEDS'); speed = s; relabelSpeeds(SPEED_LABEL, 'speed'); document.querySelectorAll('#speeds .btn').forEach(b => b.classList.toggle('on', Number(b.dataset.speed) === s)); persist(); }
function setPace(p){ onLadder(PACES, p, 'setPace', 'PACES'); pace = p; relabelSpeeds(PACE_LABEL, 'pace'); document.querySelectorAll('#speeds .btn').forEach(b => b.classList.toggle('on', Number(b.dataset.pace) === p)); }
/* A beat the player stepped belongs to a paused world. Un-pausing ends it; the running clock takes the rest. */
function setPaused(p){ paused = p; if (!p) ui.playing = false; $('pause').innerHTML = `${p ? 'Resume' : 'Pause'}<kbd>Space</kbd>`; $('pause').classList.toggle('on', p); }
function setLevel(z){ lvl = clamp(z, ZMIN, ZMAX); hideTip(); hover = null; renderUI(true); }
const levelName = z => z === 0 ? 'Surface' : z > 0 ? `Level +${z}` : `Level ${z}`;
function setView(v, s){
  if (inAges()) v = 'world';
  /* The camp fire view needs a fire to centre on. Without one it is the sector view. */
  const p = v === 'fire' && fireCentre(); if (v === 'fire' && !p) v = 'loc';
  /* The world map records no trail, so a trail from before it is stale. A creature that walked away and
     back while the world map showed would leave one dot on a square it left minutes ago. */
  if (view === 'world' && v !== 'world') ui.trails = {};
  view = v; if (s) cur = { sx: s.sx, sy: s.sy }; hideTip(); hover = null; whover = null; mhover = null;
  /* The camp fire view opens on its fire's sector, with the cursor on the fire unless it is already in view.
     The fire is on the surface, so the view opens there, and the cursor with it. Before this, a view
     opened from below ground showed the fire's tiles at the lower level, with the cursor there too. */
  if (p){ cur = secOf(p[0], p[1]); lvl = 0; cursor = inLocView(cursor.x, cursor.y) ? { x: cursor.x, y: cursor.y, z: 0 } : { x: p[0], y: p[1], z: 0 }; }
  $('world').hidden = v !== 'world'; $('loc').hidden = !closeUp(v); $('mid').hidden = v !== 'mid';
  renderUI(true);
}
function goto(sx, sy){ if (inAges()) return; if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return; followId = null; cursor = cursorInSector(cursor, sx, sy); setView('loc', { sx, sy }); }
/* Step to a neighbouring sector and keep the view. From the world map it opens the sector. */
function move(dx, dy){ moveCursor([dx, dy, 'sector']); }
/* Put the cursor on a tile and make the view follow it: the sector view scrolls to its sector, the level follows.
   The camp fire view stays on the fire. A cursor that leaves it opens the sector view of the sector it is in. */
function cursorTo(x, y, z){
  cursor = { x: clamp(x, 0, W - 1), y: clamp(y, 0, H - 1), z: clamp(z, ZMIN, ZMAX) };
  const s = secOf(cursor.x, cursor.y);
  if (view === 'fire'){ if (inLocView(cursor.x, cursor.y)){ cur = s; renderUI(true); } else setView('loc', s); }
  else if (s.sx !== cur.sx || s.sy !== cur.sy) setView(view, s); else renderUI(true);
  if (closeUp(view) && cursor.z !== lvl) setLevel(cursor.z);
}
/* A sector step or an edge step leaves the camp fire view for the sector view of the sector the cursor
   lands in. The edge step is Alt+arrow. It lands where the same key lands in the sector view of the
   cursor's sector: on that sector's edge, or one sector on when the cursor is already on the edge.
   Before this, only the nav buttons left, and Alt+arrow often stayed in the camp fire view. */
function moveCursor([dx, dy, mult]){ followId = null; const c = cursorAfter(cursor, dx, dy, mult, view); if (view === 'fire' && (mult === 'sector' || mult === 'edge')) setView('loc', secOf(c.x, c.y)); cursorTo(c.x, c.y, c.z); }
/* The tool at the cursor. In the nearby and world views Enter opens the sector under it. */
function applyAt(){
  if (inAges()){ openGodAt(cursor.x, cursor.y); return; }
  if (!closeUp(view)){ const s = secOf(cursor.x, cursor.y); goto(s.sx, s.sy); return; }
  const { ox, oy } = locOrigin(), c = { x: cursor.x, y: cursor.y, z: cursor.z, lx: cursor.x - ox, ly: cursor.y - oy };
  const r = cv.getBoundingClientRect(); const e = { clientX: r.left + (c.lx + 0.5) * r.width / LW, clientY: r.top + (c.ly + 0.5) * r.height / LH };
  applyTool(c, e);
}
function cycleView(){ if (inAges()){ say('The valley is not made yet. There is only the field.'); return; } followId = null; setView(nextView(view)); }
function randomSeed(){ const a = ['amber','birch','cinder','dusk','ember','fern','gravel','hollow','iron','juniper','kestrel','lichen','moss','nettle','oak','pine'], b = ['brook','crag','dale','fen','ford','glen','hill','marsh','moor','ridge','vale','wold']; return `${a[Math.floor(Math.random() * a.length)]}-${b[Math.floor(Math.random() * b.length)]}-${Math.floor(Math.random() * 100)}`; }
function cellFrom(e){ const r = cv.getBoundingClientRect(), { ox, oy } = locOrigin(); const lx = clamp(Math.floor((e.clientX - r.left) / r.width * LW), 0, LW - 1), ly = clamp(Math.floor((e.clientY - r.top) / r.height * LH), 0, LH - 1); return { lx, ly, x: ox + lx, y: oy + ly, z: lvl }; }
function sectorFromMid(e){ const r = mcv.getBoundingClientRect(), { ox, oy } = midOrigin(); const s = secOf(ox + Math.floor((e.clientX - r.left) / r.width * 3 * LW), oy + Math.floor((e.clientY - r.top) / r.height * 3 * LH)); return s.sx >= 0 && s.sy >= 0 && s.sx < SW && s.sy < SH ? s : null; }
function sectorFrom(e){ const r = wcv.getBoundingClientRect(); return { sx: clamp(Math.floor((e.clientX - r.left) / r.width * SW), 0, SW - 1), sy: clamp(Math.floor((e.clientY - r.top) / r.height * SH), 0, SH - 1) }; }
const tileFromWorld = e => { const r = wcv.getBoundingClientRect(); return { x: clamp(Math.floor((e.clientX - r.left) / r.width * W), 0, W - 1), y: clamp(Math.floor((e.clientY - r.top) / r.height * H), 0, H - 1) }; };
/* The pointer's place in the field canvas's own drawing space, the one tileSpot answers in. Proportional
   to the rect the same way tileFromWorld is, so it holds regardless of how the canvas is laid out on the page. */
const worldPixelFrom = e => { const r = wcv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W * WS, y: (e.clientY - r.top) / r.height * H * WS }; };
/* In the ages, Enter or a click opens the first god that stands on the land under the cursor. */
function openGodAt(x, y){ const r = regionAt(x, y), g = r && gods().find(g => g.status !== 'dead' && standsIn(g) === r); if (g) ACTIONS.inspect(g.id); else say('No god stands here.'); }
/* The world canvases are sized here, not in initUI: startWorld sets W and H, and a world of another size needs another canvas. */
function newWorld(seed){
  endZoom();
  startCreation(seed, {});
  fieldKey = ''; setActCaption('');
  cursor = { x: W >> 1, y: H >> 1, z: 0 };
  wcv.width = W * WS * dpr; wcv.height = H * WS * dpr;
  ocv.width = W * WS; ocv.height = H * WS;
  viewCamp = camps[0]; followId = null; lvl = 0; ui.windows = []; ui.focus = 'map'; worldDirty = 0; acc = 0; ui.pulses = []; ui.seenTick = -1; ui.lastStates = {}; ui.unfold = {}; ui.timelineChip = null; ui.trails = {}; restore();
  /* Make world and Take a god both come through here. Every tab starts closed, whatever a saved
     session had open: the People and Goals cards used to cover the map at the very start. Continue
     and Load do not call this, so they keep the tabs a saved world had open. */
  ui.open = [];
  if (ui.savedSpeed) setSpeed(ui.savedSpeed);
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
  endZoom();
  acc = 0; worldDirty = 0; fieldKey = ''; chronKey = ''; setActCaption('');
  viewCamp = camps[0]; camp = camps[0];
  ui.seenTick = -1; ui.lastStates = {}; ui.pulses = []; ui.unfold = {}; ui.trails = {};
  /* A row index, a followed person, and an open card all name a being of the old world. */
  followId = null; ui.row.people = 0; ui.row.goals = 0; ui.row.chronicle = 0; ui.row.camp = 0; ui.row.legends = 0;
  /* A camp id names a camp of the old world, so the People drawer follows the chosen camp again. */
  ui.peopleCamp = null;
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
  setSpeed(ui.savedSpeed || speed); setPaused(false);
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

/* ---------- the zoom ----------
   The camera that carries the player from the gods' map to the first person's sector at settle. The pure
   model lives in zoom.js; these three functions are its one writer, as state.js's comment on `zoom` says. */

/* A copy of a canvas, pixel for pixel, so a later draw to the source canvas cannot change the picture. */
function copyCanvas(src){
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}
/* The canvas a view draws on. */
const canvasFor = v => v === 'world' ? wcv : v === 'mid' ? mcv : cv;

/* Start a zoom along the given stops. Returns without doing anything when there is no page, when the
   player asked for less motion, or when there are fewer than two stops to move between. */
function startZoom(stops){
  if (typeof document === 'undefined' || !wcv) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!stops || stops.length < 2) return;
  const pics = {}, boxes = {}, curBefore = cur;
  /* The field is the last frame of the ages: the frame loop calls onSettle before it draws, so wcv
     still shows what the ages left there. */
  pics.field = copyCanvas(wcv);
  for (const stop of stops){
    if (stop.image === 'field' || pics[stop.image]) continue;
    $('world').hidden = stop.view !== 'world'; $('mid').hidden = stop.view !== 'mid'; $('loc').hidden = stop.view !== 'loc';
    if (stop.s) cur = { sx: stop.s.sx, sy: stop.s.sy };
    if (stop.view === 'world') drawWorld(); else if (stop.view === 'mid') drawMid(); else drawLoc();
    const canvas = canvasFor(stop.view), r = canvas.getBoundingClientRect();
    boxes[stop.image] = { w: r.width, h: r.height };
    pics[stop.image] = copyCanvas(canvas);
  }
  /* Put cur back to the last stop's sector, so the view the zoom ends on is the one the last stop
     drew. When the last stop has no sector of its own (the world view), cur stays what it was
     before the loop, since nothing in the loop set it for that stop. */
  const lastStop = stops[stops.length - 1];
  cur = lastStop.s ? { sx: lastStop.s.sx, sy: lastStop.s.sy } : curBefore;
  boxes.field = boxes.world;
  $('world').hidden = true; $('mid').hidden = true; $('loc').hidden = true; $('zoom').hidden = false;
  zoom = { stops, legs: zoomPlan(stops), t: 0, pics, boxes };
}
/* One frame of a running zoom. Ends it once the plan is over. */
function advanceZoom(dt){
  zoom.t += dt;
  if (zoomAt(zoom.legs, zoom.t) === null) endZoom();
}
/* Leaves the zoom and shows the view it was headed for. acc is cleared so the days do not open with a
   backlog of ticks the frame loop never ran while the zoom held the world still. */
function endZoom(){
  if (!zoom) return;
  zoom = null; $('zoom').hidden = true; acc = 0;
  setView(view, cur);
}

/* The flip. The frame calls this once, in the first frame that sees the days after the ages. */
function onSettle(){
  acc = 0; worldDirty = 0; setActCaption(''); viewCamp = camps[0]; camp = camps[0]; ui.seenTick = -1; ui.lastStates = {}; ui.pulses = []; ui.trails = {};
  /* Eight gods become one person, so a row index from the ages would point past the list. */
  followId = null; ui.row.people = 0; ui.row.goals = 0;
  /* The camps of the days are new, so the People drawer follows the chosen camp. */
  ui.peopleCamp = null;
  setSpeed(ui.savedSpeed || speed);
  /* A god's card opened in the ages would cover the valley at the moment it first shows. Drawer windows stay. */
  ui.windows = ui.windows.filter(w => w.kind !== 'inspect'); if (ui.focus.startsWith('window:') && !ui.windows.some(w => `window:${w.id}` === ui.focus)) ui.focus = 'map';
  /* An opened chip names one act of a creation that is over. The band is hidden from here, so nothing
     could close it again, and the foot would print that act in place of the newest chronicle line. */
  ui.timelineChip = null;
  /* The band leaves the focus ring at settle. A focus left on it sends `[` and `]` to a hidden band. */
  if (ui.focus === 'timeline') ui.focus = 'map';
  const a = firstPerson();
  if (a){ cursor = { x: a.x, y: a.y, z: a.z }; setView('loc', secOf(a.x, a.y)); } else setView('world');
  startZoom(settleStops(a ? secOf(a.x, a.y) : null));
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

/* The action table. Every key and every click ends here. The only place view state changes.
   `enterFocus` is for a caller that deliberately takes the player into the card, such as a search
   or a jump to a stage: it moves `ui.focus` into the drawer, and back to the map when the drawer
   closes. Without it, the tab's own key or a click on the tab opens or closes the drawer and leaves
   focus where it was, so the game keys keep working while the card sits open. The one case that
   still moves focus to the map without `enterFocus` is closing the drawer the player had clicked
   into: its card is gone, so nothing is left to hold that focus. */
function openDrawer(id, on, enterFocus){
  const has = ui.open.includes(id), want = on === undefined ? !has : on;
  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 800;
  if (want && !has) ui.open = narrow ? [id] : ui.open.concat(id); if (!want && has) ui.open = ui.open.filter(x => x !== id);
  if (enterFocus) ui.focus = want ? `drawer:${id}` : 'map';
  /* Below 800 px only one drawer stays open, so opening a second one (narrow ? [id] above) can close
     the one that held the focus without touching it here. Any focus that names a drawer no longer in
     ui.open is stale and would leave the number keys picking rows nobody can see; send it to the map. */
  else if (ui.focus.startsWith('drawer:') && !ui.open.includes(ui.focus.slice(7))) ui.focus = 'map';
  ui.row[id] = ui.row[id] || 0; persist(); renderUI(true);
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
  step(){ setPaused(true); if (inAges()){ ui.playing = false; acc = 0; beatsLastFrame = 1; step(true); ui.playing = true; } else { step(); if (view !== 'world') noteTrails(uiNow()); } renderUI(true); },
  hour(){ if (inAges()){ say('There are no hours yet. Step moves one act.'); return; } setPaused(true); for (let k = 0; k < Math.round(hours(1)); k++) step(); ui.trails = {}; renderUI(true); },
  slower(){ ACTIONS.speedStep(Math.max(0, ladder().indexOf(inAges() ? pace : speed) - 1)); },
  faster(){ ACTIONS.speedStep(Math.min(ladder().length - 1, ladder().indexOf(inAges() ? pace : speed) + 1)); },
  /* A place on the ladder, from zero. It does what that button does: the pace in the ages, the speed in the days. */
  speedStep(i){ ACTIONS.speed(ladder()[clamp(i, 0, ladder().length - 1)]); },
  /* A speed key, a speed button, and the palette all end here, so this is the one place a days speed
     counts as the player's choice. savedSpeed follows it, or a load would go back to the speed read at
     page load. The pace of the ages is not a days speed and sets no marker. */
  speed(s){ if (inAges()) setPace(s); else { ui.speedChosen = true; ui.savedSpeed = s; setSpeed(s); } setPaused(false); },
  hurry(){ if (!inAges()){ say('The valley is already made.'); return; } openHurry(); },
  hurryGo(){ closeDialogs(); runAges(); renderUI(true); },
  overlay(){ if (inAges()){ say('The field is all there is. The borders show once the valley is made.'); return; } ui.overlay = !ui.overlay; if (ui.overlay && view !== 'world'){ followId = null; setView('world'); } renderUI(true); },
  tool(id){ setTool(id); },
  toolSticky(id){ setTool(id, true); },
  inspect(id){ const a = beingById(id); if (!a) return; const w = winOpen('inspect', { being: id }); ui.focus = `window:${w.id}`; if (!inAges()) cursorTo(a.x, a.y, a.z); renderUI(true); },
  /* A god has no tile in the ages, and following would drag the view back every frame. */
  follow(id){ if (inAges()){ say('A god has no place yet. There is nothing to follow.'); return; } const w = id == null && ui.focus.startsWith('window:') ? ui.windows.find(w => w.id === Number(ui.focus.slice(7))) : null; const target = id != null ? id : w && w.kind === 'inspect' && w.target.being; if (target == null) return; followId = followId === target ? null : target; renderUI(true); },
  view(){ cycleView(); },
  levelUp(){ if (closeUp(view)) setLevel(lvl + 1); },
  levelDown(){ if (closeUp(view)) setLevel(lvl - 1); },
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
  /* The People drawer's camp: the chosen camp, each other camp in order, everyone, and back. With no
     chosen camp the list already holds everyone, so there is nothing to cycle. A value not in the
     cycle, such as the id of a camp that has ended, counts as the chosen camp. */
  peopleCamp(){
    const chosen = chosenCamp(); if (!chosen) return;
    const cycle = [null, ...camps.filter(c => c !== chosen).map(c => c.id), 'all'];
    ui.peopleCamp = cycle[(Math.max(0, cycle.indexOf(ui.peopleCamp)) + 1) % cycle.length];
    ui.row.people = 0; persist(); renderUI(true);
  },
  /* The People drawer's age: any, young, adult, old, and back. */
  peopleAge(){
    ui.peopleAge = PEOPLE_AGES[(Math.max(0, PEOPLE_AGES.indexOf(ui.peopleAge)) + 1) % PEOPLE_AGES.length];
    ui.row.people = 0; persist(); renderUI(true);
  },
  /* The timeline. Folded it is one row of the creation; unfolded it is a row for each god. The zoom
     is on its own time axis and never touches the map's levels. */
  foldTimeline(){ ui.timelineFold = !ui.timelineFold; persist(); renderUI(true); },
  zoomTimelineOut(){ ui.timelineZoom = Math.min(TL_ZOOM_MAX, (ui.timelineZoom | 0) + 1); persist(); renderUI(true); },
  zoomTimelineIn(){ ui.timelineZoom = Math.max(0, (ui.timelineZoom | 0) - 1); persist(); renderUI(true); },
  /* A click anywhere in the band gives it the focus, so `[` and `]` zoom instead of changing level. */
  focusTimeline(){ ui.focus = 'timeline'; },
  /* One act of one creation, opened into the foot. The same chip twice closes it. */
  openChip(key){ ui.timelineChip = ui.timelineChip === key ? null : key; },
  /* In the camp fire view the new camp's fire becomes the centre, since the view reads viewCamp. A camp
     with no site has no fire, so setView('fire') gives the sector view instead. */
  campN(n){ const c = camps[n - 1]; if (c){ viewCamp = c; if (c.site){ followId = null; setView(view === 'world' ? 'loc' : view, secOf(...c.site)); } else if (view === 'fire') setView('fire'); renderUI(true); } },
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
       before the become act, and the damage is not one failed lookup. nextId (core.js) is a single
       counter for beings, camps, regions, boundaries, items and caves alike, so a replay that skips
       this call hands every later thing an id one below the id the log recorded: the become finds no
       god, and every id-bearing act after it resolves against the wrong thing. God-era replay is not
       built today (replayGod selects by tick and runDays starts after settle), so nothing depends on
       it yet. The fix is a door act that begins the ages, so god-making and the take happen inside one
       logged act; door.js is not this branch's to change. */
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
    if (a.being != null){ const b = beingById(a.being); if (b){ if (!closeUp(view)) setView('loc', secOf(b.x, b.y)); cursorTo(b.x, b.y, b.z); ACTIONS.inspect(b.id); } }
    else if (a.tile){ if (!closeUp(view)) setView('loc', secOf(a.tile[0], a.tile[1])); cursorTo(a.tile[0], a.tile[1], a.tile[2] || 0); }
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
  searchChronicle(){ openDrawer('chronicle', true, true); const box = $('chronSearch'); if (box) box.focus(); },
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
  stage(id){ closeDialogs(); openDrawer('goals', true, true); ui.unfold[id] = true; const i = drawerRows('goals').findIndex(r => r.kind === 'stage' && r.id === id); if (i >= 0) ui.row.goals = i; renderUI(true); },
  goalPri({ id, pri }){ say(inject({ source: 'player', act: 'priority', id, pri })); renderUI(true); },
  gotoSector({ sx, sy }){ goto(sx, sy); },
  unmute(m){ ui.mutes.delete(m); persist(); renderUI(true); },
};
