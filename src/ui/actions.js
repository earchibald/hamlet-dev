/* God actions: tools, view changes, movement, and world control. */

/* A said message is a note. It holds the foot for four seconds of wall time, then the chronicle line comes back. */
const uiNow = () => typeof performance !== 'undefined' ? performance.now() : 0;
function say(msg){ ui.note = { text: msg, at: uiNow() }; renderFoot(); }
function setTool(id, sticky = false){
  tool = id; ui.sticky = sticky && TOOLS.find(t => t.id === id).oneShot;
  document.querySelectorAll('#tools .btn').forEach(b => { const on = b.dataset.tool === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.querySelector('.pin').hidden = !(on && ui.sticky); });
}
function setSpeed(s){ speed = s; document.querySelectorAll('#speeds .btn').forEach(b => b.classList.toggle('on', Number(b.dataset.speed) === s)); persist(); }
function setPaused(p){ paused = p; $('pause').innerHTML = `${p ? 'Resume' : 'Pause'}<kbd>Space</kbd>`; $('pause').classList.toggle('on', p); }
function setLevel(z){ lvl = clamp(z, ZMIN, ZMAX); hideTip(); hover = null; renderUI(true); }
const levelName = z => z === 0 ? 'Surface' : z > 0 ? `Level +${z}` : `Level ${z}`;
function setView(v, s){
  view = v; if (s) cur = { sx: s.sx, sy: s.sy }; hideTip(); hover = null; whover = null; mhover = null;
  $('world').hidden = v !== 'world'; $('loc').hidden = v !== 'loc'; $('mid').hidden = v !== 'mid';
  $('viewBtn').innerHTML = `${VIEW_LABEL[NEXT_VIEW[v]]}<kbd>M</kbd>`;
  renderUI(true);
}
function goto(sx, sy){ if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return; followId = null; const s = { sx, sy }; cursor = { x: clamp(cursor.x - cur.sx * LW + sx * LW, sx * LW, (sx + 1) * LW - 1), y: clamp(cursor.y - cur.sy * LH + sy * LH, sy * LH, (sy + 1) * LH - 1), z: cursor.z }; setView('loc', s); }
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
  if (view !== 'loc'){ const s = secOf(cursor.x, cursor.y); goto(s.sx, s.sy); return; }
  const c = { x: cursor.x, y: cursor.y, z: cursor.z, lx: cursor.x - cur.sx * LW, ly: cursor.y - cur.sy * LH };
  const r = cv.getBoundingClientRect(); const e = { clientX: r.left + (c.lx + 0.5) * r.width / LW, clientY: r.top + (c.ly + 0.5) * r.height / LH };
  applyTool(c, e);
}
function cycleView(){ followId = null; setView(NEXT_VIEW[view]); }
function randomSeed(){ const a = ['amber','birch','cinder','dusk','ember','fern','gravel','hollow','iron','juniper','kestrel','lichen','moss','nettle','oak','pine'], b = ['brook','crag','dale','fen','ford','glen','hill','marsh','moor','ridge','vale','wold']; return `${a[Math.floor(Math.random() * a.length)]}-${b[Math.floor(Math.random() * b.length)]}-${Math.floor(Math.random() * 100)}`; }
function cellFrom(e){ const r = cv.getBoundingClientRect(); const lx = clamp(Math.floor((e.clientX - r.left) / r.width * LW), 0, LW - 1), ly = clamp(Math.floor((e.clientY - r.top) / r.height * LH), 0, LH - 1); return { lx, ly, x: cur.sx * LW + lx, y: cur.sy * LH + ly, z: lvl }; }
function sectorFromMid(e){ const r = mcv.getBoundingClientRect(), { ox, oy } = midOrigin(); const s = secOf(ox + Math.floor((e.clientX - r.left) / r.width * 3 * LW), oy + Math.floor((e.clientY - r.top) / r.height * 3 * LH)); return s.sx >= 0 && s.sy >= 0 && s.sx < SW && s.sy < SH ? s : null; }
function sectorFrom(e){ const r = wcv.getBoundingClientRect(); return { sx: clamp(Math.floor((e.clientX - r.left) / r.width * SW), 0, SW - 1), sy: clamp(Math.floor((e.clientY - r.top) / r.height * SH), 0, SH - 1) }; }
/* The world canvases are sized here, not in initUI: startWorld sets W and H, and a world of another size needs another canvas. */
function newWorld(seed){
  startWorld(seed, {});
  cursor = { x: W >> 1, y: H >> 1, z: 0 };
  wcv.width = W * WS * dpr; wcv.height = H * WS * dpr;
  ocv.width = W * WS; ocv.height = H * WS;
  viewCamp = camps[0]; followId = null; lvl = 0; worldDirty = 0; acc = 0; ui.pulses = []; ui.seenTick = -1; ui.lastStates = {}; ui.unfold = {}; restore(); if (ui.savedSpeed) setSpeed(ui.savedSpeed); const a = beings[0]; setView('loc', secOf(a.x, a.y));
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
function rowMove(d){ const id = focusedDrawer(); if (!id) return; const n = drawerRows(id).length; if (!n) return; ui.row[id] = (ui.row[id] + d + n) % n; renderUI(true); }
function rowPick(n){ const id = focusedDrawer(); if (!id) return; if (n - 1 < drawerRows(id).length){ ui.row[id] = n - 1; rowOpen(); } }
function rowOpen(){
  const id = focusedDrawer(); if (!id) return; const r = drawerRows(id)[ui.row[id]]; if (!r) return;
  if (r.kind === 'person'){ ACTIONS.inspect(r.id); }
  else if (r.kind === 'stage'){ ui.unfold[r.id] = !ui.unfold[r.id]; renderUI(true); }
  /* A goal row opens nothing. A goal's priority changes only by Left and Right, the three buttons, or the palette. */
  /* 'line' rows open nothing until plan B gives the cursor a place to jump to. */
}
function setPriority(d){ const id = focusedDrawer(); if (id !== 'goals') return; const r = drawerRows('goals')[ui.row.goals]; if (!r || r.kind !== 'goal') return; say(inject({ source: 'player', act: 'priority', id: r.id, pri: clamp((goalPriority[r.id] ?? 1) + d, 0, 2) })); renderUI(true); }
function focusStep(d){ const ring = focusRing(); const i = Math.max(0, ring.indexOf(ui.focus)), j = (i + d + ring.length) % ring.length; ui.focus = ring[j]; renderUI(true); }
const ACTIONS = {
  pause(){ setPaused(!paused); },
  step(){ setPaused(true); step(); renderUI(true); },
  hour(){ setPaused(true); for (let k = 0; k < Math.round(DAY / 24); k++) step(); renderUI(true); },
  slower(){ setSpeed(speed === 64 ? 16 : speed === 16 ? 4 : 1); setPaused(false); },
  faster(){ setSpeed(speed === 1 ? 4 : speed === 4 ? 16 : 64); setPaused(false); },
  speed(s){ setSpeed(s); setPaused(false); },
  tool(id){ setTool(id); },
  toolSticky(id){ setTool(id, true); },
  inspect(id){ const a = beingById(id); if (!a) return; const w = winOpen('inspect', { being: id }); ui.focus = `window:${w.id}`; cursorTo(a.x, a.y, a.z); renderUI(true); },
  follow(id){ const w = id == null && ui.focus.startsWith('window:') ? ui.windows.find(w => w.id === Number(ui.focus.slice(7))) : null; const target = id != null ? id : w && w.kind === 'inspect' && w.target.being; if (target == null) return; followId = followId === target ? null : target; renderUI(true); },
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
    if (tipPinned) hideTip();
  },
  rowUp(){ rowMove(-1); },
  rowDown(){ rowMove(1); },
  rowOpen(){ rowOpen(); },
  rowPick(n){ rowPick(n); },
  priorityUp(){ setPriority(1); },
  priorityDown(){ setPriority(-1); },
  showAll(){ ui.showAll = !ui.showAll; persist(); renderUI(true); },
  campN(n){ const c = camps[n - 1]; if (c){ viewCamp = c; if (c.site){ followId = null; setView(view === 'world' ? 'loc' : view, secOf(...c.site)); } renderUI(true); } },
  help(){ openHelp(); },
  start(){ openStart(); },
  popOut(){
    if (ui.focus.startsWith('drawer:')){ const id = ui.focus.slice(7); const w = winOpen('drawer', id); ui.focus = `window:${w.id}`; }
    else if (ui.focus.startsWith('window:')){ const w = ui.windows.find(w => w.id === Number(ui.focus.slice(7))); if (w && w.kind === 'drawer'){ winClose(w.id); ui.focus = `drawer:${w.target}`; if (!ui.open.includes(w.target)) ui.open.push(w.target); } }
    persist(); renderUI(true);
  },
};
