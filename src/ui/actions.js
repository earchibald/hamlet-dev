/* God actions: tools, view changes, movement, and world control. */

function say(msg){ $('foot').innerHTML = `<span>${msg}</span>`; }
function setTool(id){ tool = id; document.querySelectorAll('#tools .btn').forEach(b => { const on = b.dataset.tool === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); if (tipPinned) hideTip(); }
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
function goto(sx, sy){ if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return; followId = null; setView('loc', { sx, sy }); }
/* Step to a neighbouring sector and keep the view. From the world map it opens the sector. */
function move(dx, dy){ const sx = cur.sx + dx, sy = cur.sy + dy; if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return; followId = null; setView(view === 'world' ? 'loc' : view, { sx, sy }); }
function cycleView(){ followId = null; setView(NEXT_VIEW[view]); }
function randomSeed(){ const a = ['amber','birch','cinder','dusk','ember','fern','gravel','hollow','iron','juniper','kestrel','lichen','moss','nettle','oak','pine'], b = ['brook','crag','dale','fen','ford','glen','hill','marsh','moor','ridge','vale','wold']; return `${a[Math.floor(Math.random() * a.length)]}-${b[Math.floor(Math.random() * b.length)]}-${Math.floor(Math.random() * 100)}`; }
function cellFrom(e){ const r = cv.getBoundingClientRect(); const lx = clamp(Math.floor((e.clientX - r.left) / r.width * LW), 0, LW - 1), ly = clamp(Math.floor((e.clientY - r.top) / r.height * LH), 0, LH - 1); return { lx, ly, x: cur.sx * LW + lx, y: cur.sy * LH + ly, z: lvl }; }
function sectorFromMid(e){ const r = mcv.getBoundingClientRect(), { ox, oy } = midOrigin(); const s = secOf(ox + Math.floor((e.clientX - r.left) / r.width * 3 * LW), oy + Math.floor((e.clientY - r.top) / r.height * 3 * LH)); return s.sx >= 0 && s.sy >= 0 && s.sx < SW && s.sy < SH ? s : null; }
function sectorFrom(e){ const r = wcv.getBoundingClientRect(); return { sx: clamp(Math.floor((e.clientX - r.left) / r.width * SW), 0, SW - 1), sy: clamp(Math.floor((e.clientY - r.top) / r.height * SH), 0, SH - 1) }; }
function newWorld(seed){ startWorld(seed); viewCamp = camps[0]; followId = null; lvl = 0; worldDirty = 0; acc = 0; ui.pulses = []; ui.seenTick = -1; ui.lastStates = {}; ui.unfold = {}; restore(); if (ui.savedSpeed) setSpeed(ui.savedSpeed); const a = beings[0]; setView('loc', secOf(a.x, a.y)); }
function applyTool(c, e){
  switch (tool){
    case 'inspect': pinCell(c, e); break;
    case 'light': say(lightTile(c.x, c.y, c.z)); camp = viewCamp; break;
    case 'camp': {
      if (camp.pit){ say('The fire pit is already built. The camp stays where it is.'); break; }
      if (c.z !== 0){ say('The camp must be on the valley floor.'); break; }
      const t = tileAt(c.x, c.y); if (!passable(c.x, c.y) || t.feature){ say('The camp site must be open ground you can stand on.'); break; }
      camp = viewCamp; setSite(c.x, c.y); camp.siteReason = 'you chose it'; log('The camp site moves. Someone felt it was right.', humans()); say('Camp site set. The fire pit will go here.'); break; }
    case 'poke': { const a = beings.find(a => a.alive && a.x === c.x && a.y === c.y && a.z === c.z); say(a ? poke(a) : 'Nobody is there to poke.'); break; }
  }
  renderUI(true);
}

/* The action table. Every key and every click ends here. The only place view state changes. */
function openDrawer(id, on){
  const has = ui.open.includes(id), want = on === undefined ? !has : on;
  if (want && !has) ui.open.push(id); if (!want && has) ui.open = ui.open.filter(x => x !== id);
  ui.focus = want ? `drawer:${id}` : 'map'; ui.row[id] = ui.row[id] || 0; persist(); renderUI(true);
}
const focusedDrawer = () => ui.focus.startsWith('drawer:') ? ui.focus.slice(7) : null;
function rowMove(d){ const id = focusedDrawer(); if (!id) return; const n = drawerRows(id).length; if (!n) return; ui.row[id] = (ui.row[id] + d + n) % n; renderUI(true); }
function rowPick(n){ const id = focusedDrawer(); if (!id) return; if (n - 1 < drawerRows(id).length){ ui.row[id] = n - 1; rowOpen(); } }
function rowOpen(){
  const id = focusedDrawer(); if (!id) return; const r = drawerRows(id)[ui.row[id]]; if (!r) return;
  if (r.kind === 'person'){ const a = beingById(r.id); const el = document.querySelector(`#drawers [data-being="${r.id}"]`); const rect = el ? el.getBoundingClientRect() : { left: 400, top: 200 }; tipTarget = { being: a.id }; tipAnchor = { x: rect.left, y: rect.top, left: true }; tipPinned = true; renderTip(); }
  else if (r.kind === 'stage'){ ui.unfold[r.id] = !ui.unfold[r.id]; renderUI(true); }
  else if (r.kind === 'goal'){ goalPriority[r.id] = ((goalPriority[r.id] ?? 1) + 1) % 3; renderUI(true); }
  /* 'line' rows open nothing until plan B gives the cursor a place to jump to. */
}
function setPriority(d){ const id = focusedDrawer(); if (id !== 'goals') return; const r = drawerRows('goals')[ui.row.goals]; if (!r || r.kind !== 'goal') return; goalPriority[r.id] = clamp((goalPriority[r.id] ?? 1) + d, 0, 2); renderUI(true); }
function focusStep(d){
  const ring = ['map', ...ui.open.map(id => `drawer:${id}`)];
  const i = Math.max(0, ring.indexOf(ui.focus)), j = (i + d + ring.length) % ring.length;
  ui.focus = ring[j]; renderUI(true);
}
const ACTIONS = {
  pause(){ setPaused(!paused); },
  step(){ setPaused(true); step(); renderUI(true); },
  hour(){ setPaused(true); for (let k = 0; k < Math.round(DAY / 24); k++) step(); renderUI(true); },
  slower(){ setSpeed(speed === 16 ? 4 : 1); setPaused(false); },
  faster(){ setSpeed(speed === 1 ? 4 : 16); setPaused(false); },
  speed(s){ setSpeed(s); setPaused(false); },
  tool(id){ setTool(id); },
  view(){ cycleView(); },
  levelUp(){ if (view === 'loc') setLevel(lvl + 1); },
  levelDown(){ if (view === 'loc') setLevel(lvl - 1); },
  nav([dx, dy]){ move(dx, dy); },
  drawer(id){ openDrawer(id); },
  focusNext(){ focusStep(1); },
  focusPrev(){ focusStep(-1); },
  back(){ if (ui.focus !== 'map'){ ui.focus = 'map'; renderUI(true); return; } if (tipPinned) hideTip(); },
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
};
