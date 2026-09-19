/* The frame loop and page wiring: initUI() sets up canvases and events, frame() drives the loop. */

function frame(now){
  const dt = Math.min(250, now - (last || now)); last = now;
  if (!paused){
    /* The ages wait while a dialog is open, so the creation does not pass behind the start dialog. */
    if (inAges()){ if (!anyDialogOpen()){ const d = agesDue(acc, dt, pace); acc = d.acc; for (let k = 0; k < d.n && inAges(); k++) step(); } }
    else { acc += dt * TPS * speed / 1000; let n = 0; while (acc >= 1 && n < 200){ step(); acc--; n++; } if (n >= 200) acc = 0; }
  }
  if (lastEra === 'gods' && !inAges()) onSettle();
  lastEra = era;
  if (followId && !inAges()){ const a = beingById(followId); if (a && a.alive){ const s = secOf(a.x, a.y); if (view === 'world' || s.sx !== cur.sx || s.sy !== cur.sy) setView(view === 'world' ? 'loc' : view, s); if (view === 'loc' && a.z !== lvl) setLevel(a.z); } else followId = null; }
  camp = viewCamp && camps.includes(viewCamp) ? viewCamp : camps[0];
  draw();
  /* Pulses read every goal's state. Once a render, not once a frame. */
  if (now - lastUi > 250){ notePulses(); renderUI(false); lastUi = now; }
  requestAnimationFrame(frame);
}
function initUI(){
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv = $('map'); ctx = cv.getContext('2d'); cv.width = LW * T * dpr; cv.height = LH * T * dpr;
  wcv = $('wmap'); wctx = wcv.getContext('2d');
  mcv = $('mmap'); mctx = mcv.getContext('2d'); mcv.width = 3 * LW * MS * dpr; mcv.height = 3 * LH * MS * dpr;
  ocv = document.createElement('canvas'); octx = ocv.getContext('2d');
  readPalette();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readPalette);
  new MutationObserver(readPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  $('tools').innerHTML = TOOLS.map(t => `<button class="btn" data-tool="${t.id}" aria-pressed="false" title="${t.hint}">${t.label}<kbd>${t.key.toUpperCase()}</kbd><span class="pin" hidden> ⌖</span></button>`).join('');
  $('tools').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) (e.shiftKey ? ACTIONS.toolSticky : ACTIONS.tool)(b.dataset.tool); });
  $('speeds').addEventListener('click', e => { const b = e.target.closest('[data-speed]'); if (b) ACTIONS.speed(Number(b.dataset.speed)); });
  $('pause').addEventListener('click', ACTIONS.pause);
  $('stepBtn').addEventListener('click', ACTIONS.step);
  $('hourBtn').addEventListener('click', ACTIONS.hour);
  $('hurryBtn').addEventListener('click', ACTIONS.hurry);
  $('helpBtn').addEventListener('click', ACTIONS.help);
  $('helpClose').addEventListener('click', closeDialogs);
  $('help').addEventListener('click', e => { const b = e.target.closest('[data-unmute]'); if (b){ ui.mutes.delete(b.dataset.unmute); persist(); openHelp(); } });
  $('chips').addEventListener('click', e => { const c = e.target.closest('[data-chip]'); if (c) ACTIONS.jumpChip(Number(c.dataset.chip)); });
  $('chips').addEventListener('contextmenu', e => { const c = e.target.closest('[data-chip]'); if (c){ e.preventDefault(); ACTIONS.muteMenu(Number(c.dataset.chip)); } });
  for (const k of [1, 2, 3]) $(`mute${k}`).addEventListener('click', () => ACTIONS.muteChoice(k));
  /* The Make world button carries value="make". Esc closes the dialog with an empty returnValue and keeps the world. */
  $('start').addEventListener('close', () => {
    ui.focus = 'map'; const make = $('start').returnValue === 'make'; $('start').returnValue = '';
    if (make) newWorld($('seed').value.trim() || randomSeed());
  });
  $('paletteInput').addEventListener('input', () => { palSel = 0; renderPalette(); });
  /* The chronicle's search box is built with its drawer section, which comes and goes, so the page listens for it. */
  document.addEventListener('input', e => { if (e.target && e.target.id === 'chronSearch') ACTIONS.setChronSearch(e.target.value); });
  $('paletteList').addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) paletteRun(Number(li.dataset.i)); });
  $('paletteBtn').addEventListener('click', ACTIONS.palette); $('chordBtn').addEventListener('click', ACTIONS.chord);
  $('chordButtons').addEventListener('click', e => { const b = e.target.closest('[data-stage]'); if (b) ACTIONS.stage(b.dataset.stage); });
  $('viewBtn').addEventListener('click', ACTIONS.view);
  $('overlayBtn').addEventListener('click', ACTIONS.overlay);
  $('nW').onclick = () => ACTIONS.nav([-1, 0]); $('nE').onclick = () => ACTIONS.nav([1, 0]); $('nN').onclick = () => ACTIONS.nav([0, -1]); $('nS').onclick = () => ACTIONS.nav([0, 1]);
  $('lvUp').onclick = ACTIONS.levelUp; $('lvDown').onclick = ACTIONS.levelDown;
  $('camps').addEventListener('click', e => { const b = e.target.closest('[data-camp]'); if (b) ACTIONS.campN(camps.findIndex(c => c.id === Number(b.dataset.camp)) + 1); });
  $('drawerTabs').addEventListener('click', e => { const b = e.target.closest('[data-drawer]'); if (b) ACTIONS.drawer(b.dataset.drawer); });
  $('drawers').addEventListener('pointerdown', e => {
    const sec = e.target.closest('.drawer'); if (!sec) return; const id = sec.dataset.drawer;
    const pri = e.target.closest('[data-goal][data-pri]'); if (pri){ say(inject({ source: 'player', act: 'priority', id: pri.dataset.goal, pri: Number(pri.dataset.pri) })); renderUI(true); return; }
    const f = e.target.closest('[data-filter]'); if (f){ ui.chronFilter = f.dataset.filter; ui.row.chronicle = 0; persist(); renderUI(true); return; }
    if (e.target.closest('#showAllBtn')){ ACTIONS.showAll(); return; }
    const row = e.target.closest('[data-i]'); ui.focus = `drawer:${id}`;
    if (row){ ui.row[id] = Number(row.dataset.i); rowOpen(); } else renderUI(true);
  });
  document.querySelector('.mapbox').addEventListener('pointerdown', e => { if (!e.target.closest('#drawers, #drawerTabs, #tip, #windows') && ui.focus !== 'map'){ ui.focus = 'map'; renderUI(true); } });
  wireWindows();
  cv.addEventListener('pointerdown', e => { const c = cellFrom(e); cursor = { x: c.x, y: c.y, z: c.z }; hover = c; applyTool(c, e); if (tool !== 'inspect'){ tipTarget = null; tipForCell(c, e); } });
  cv.addEventListener('pointermove', e => { hover = cellFrom(e); cursor = { x: hover.x, y: hover.y, z: hover.z }; if (e.pointerType === 'mouse') tipForCell(hover, e); });
  cv.addEventListener('pointerleave', e => { hover = null; if (e.pointerType === 'mouse') hideTip(); });
  wcv.addEventListener('pointermove', e => { if (inAges()){ const c = tileFromWorld(e); cursor = { x: c.x, y: c.y, z: 0 }; tipTarget = { field: [c.x, c.y] }; tipAnchor = { x: e.clientX, y: e.clientY }; renderTip(); return; } whover = sectorFrom(e); const s = whover; cursor = { x: s.sx * LW + (LW >> 1), y: s.sy * LH + (LH >> 1), z: 0 }; tipTarget = { sector: s }; tipAnchor = { x: e.clientX, y: e.clientY }; renderTip(); });
  wcv.addEventListener('pointerleave', () => { whover = null; hideTip(); });
  wcv.addEventListener('pointerdown', e => {
    if (inAges()){ const c = tileFromWorld(e); openGodAt(c.x, c.y); return; }
    const s = sectorFrom(e); goto(s.sx, s.sy);
  });
  mcv.addEventListener('pointermove', e => {
    mhover = sectorFromMid(e);
    if (mhover){ const s = mhover; cursor = { x: s.sx * LW + (LW >> 1), y: s.sy * LH + (LH >> 1), z: 0 }; tipTarget = { sector: s }; tipAnchor = { x: e.clientX, y: e.clientY }; renderTip(); }
    else hideTip();
  });
  mcv.addEventListener('pointerleave', () => { mhover = null; hideTip(); });
  mcv.addEventListener('pointerdown', e => { const s = sectorFromMid(e); if (s) goto(s.sx, s.sy); });
  document.addEventListener('keydown', e => {
    /* Typing in a box fires no key row. Esc is the one way out of the chronicle's search box, so it is let through. */
    if (e.target.tagName === 'INPUT' && e.target.id !== 'paletteInput'){
      if (e.key === 'Escape' && e.target.id === 'chronSearch'){ e.preventDefault(); ACTIONS.closeSearch(); }
      return;
    }
    if (anyDialogOpen()){
      if (e.key === 'Escape'){ e.preventDefault(); closeDialogs(); return; }
      if (ui.focus === 'dialog:palette' && !(e.key.startsWith('Arrow') || e.key === 'Enter' || e.altKey)) return;
      /* Under a dialog only that dialog's own rows fire. An 'any' row would pause the sim or cycle the view behind the modal. */
      const hit = keyAction(e, ui.focus); if (hit && hit.focus !== 'any'){ e.preventDefault(); ACTIONS[hit.action](hit.arg); } return;
    }
    const hit = keyAction(e, ui.focus); if (!hit) return;
    e.preventDefault(); ACTIONS[hit.action](hit.arg);
  });
  setTool('inspect');
  newWorld(randomSeed());
  if (!ui.savedSpeed) setSpeed(1); /* newWorld's restore() must read storage before any persist() can overwrite it */
  openStart();
  requestAnimationFrame(frame);
}
if (typeof document !== 'undefined') initUI();
