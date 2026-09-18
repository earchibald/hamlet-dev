/* The frame loop and page wiring: initUI() sets up canvases and events, frame() drives the loop. */

function frame(now){
  const dt = Math.min(250, now - (last || now)); last = now;
  if (!paused){ acc += dt * TPS * speed / 1000; let n = 0; while (acc >= 1 && n < 200){ step(); acc--; n++; } if (n >= 200) acc = 0; }
  if (followId){ const a = beingById(followId); if (a && a.alive){ const s = secOf(a.x, a.y); if (view === 'world' || s.sx !== cur.sx || s.sy !== cur.sy) setView(view === 'world' ? 'loc' : view, s); if (view === 'loc' && a.z !== lvl) setLevel(a.z); } else followId = null; }
  camp = viewCamp && camps.includes(viewCamp) ? viewCamp : camps[0];
  notePulses();
  draw();
  if (now - lastUi > 250){ renderUI(false); lastUi = now; }
  requestAnimationFrame(frame);
}
function initUI(){
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv = $('map'); ctx = cv.getContext('2d'); cv.width = LW * T * dpr; cv.height = LH * T * dpr;
  wcv = $('wmap'); wctx = wcv.getContext('2d'); wcv.width = W * WS * dpr; wcv.height = H * WS * dpr;
  mcv = $('mmap'); mctx = mcv.getContext('2d'); mcv.width = 3 * LW * MS * dpr; mcv.height = 3 * LH * MS * dpr;
  ocv = document.createElement('canvas'); ocv.width = W * WS; ocv.height = H * WS; octx = ocv.getContext('2d');
  readPalette();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readPalette);
  new MutationObserver(readPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  $('tools').innerHTML = TOOLS.map(t => `<button class="btn" data-tool="${t.id}" aria-pressed="false" title="${t.hint}">${t.label}<kbd>${t.key.toUpperCase()}</kbd></button>`).join('');
  $('tools').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) ACTIONS.tool(b.dataset.tool); });
  $('speeds').addEventListener('click', e => { const b = e.target.closest('[data-speed]'); if (b) ACTIONS.speed(Number(b.dataset.speed)); });
  $('pause').addEventListener('click', ACTIONS.pause);
  $('stepBtn').addEventListener('click', ACTIONS.step);
  $('hourBtn').addEventListener('click', ACTIONS.hour);
  $('helpBtn').addEventListener('click', ACTIONS.help);
  $('helpClose').addEventListener('click', closeDialogs);
  $('start').addEventListener('close', () => { ui.focus = 'map'; newWorld($('seed').value.trim() || randomSeed()); });
  $('viewBtn').addEventListener('click', ACTIONS.view);
  $('nW').onclick = () => ACTIONS.nav([-1, 0]); $('nE').onclick = () => ACTIONS.nav([1, 0]); $('nN').onclick = () => ACTIONS.nav([0, -1]); $('nS').onclick = () => ACTIONS.nav([0, 1]);
  $('lvUp').onclick = ACTIONS.levelUp; $('lvDown').onclick = ACTIONS.levelDown;
  $('camps').addEventListener('click', e => { const b = e.target.closest('[data-camp]'); if (b) ACTIONS.campN(camps.findIndex(c => c.id === Number(b.dataset.camp)) + 1); });
  $('tip').addEventListener('pointerdown', e => {
    if (e.target.closest('[data-close]')) hideTip();
    const f = e.target.closest('[data-follow]'); if (f){ const id = Number(f.dataset.follow); followId = followId === id ? null : id; renderTip(); }
  });
  document.addEventListener('pointerdown', e => { if (tipPinned && !e.target.closest('#tip, #map, #drawers')) hideTip(); });
  $('drawerTabs').addEventListener('click', e => { const b = e.target.closest('[data-drawer]'); if (b) ACTIONS.drawer(b.dataset.drawer); });
  $('drawers').addEventListener('pointerdown', e => {
    const sec = e.target.closest('.drawer'); if (!sec) return; const id = sec.dataset.drawer;
    const pri = e.target.closest('[data-goal][data-pri]'); if (pri){ goalPriority[pri.dataset.goal] = Number(pri.dataset.pri); renderUI(true); return; }
    const f = e.target.closest('[data-filter]'); if (f){ ui.chronFilter = f.dataset.filter; ui.row.chronicle = 0; persist(); renderUI(true); return; }
    if (e.target.closest('#showAllBtn')){ ACTIONS.showAll(); return; }
    const row = e.target.closest('[data-i]'); ui.focus = `drawer:${id}`;
    if (row){ ui.row[id] = Number(row.dataset.i); rowOpen(); } else renderUI(true);
  });
  document.querySelector('.mapbox').addEventListener('pointerdown', e => { if (!e.target.closest('#drawers, #drawerTabs, #tip') && ui.focus !== 'map'){ ui.focus = 'map'; renderUI(true); } });
  cv.addEventListener('pointerdown', e => { const c = cellFrom(e); hover = c; applyTool(c, e); if (tool !== 'inspect'){ tipTarget = null; tipForCell(c, e); } });
  cv.addEventListener('pointermove', e => { hover = cellFrom(e); if (e.pointerType === 'mouse') tipForCell(hover, e); });
  cv.addEventListener('pointerleave', e => { hover = null; if (e.pointerType === 'mouse' && !tipPinned) hideTip(); });
  wcv.addEventListener('pointermove', e => { whover = sectorFrom(e); say(sectorSummary(sectors[secIdx(whover.sx, whover.sy)])); });
  wcv.addEventListener('pointerleave', () => { whover = null; say('Click a sector to go there.'); });
  wcv.addEventListener('pointerdown', e => { const s = sectorFrom(e); goto(s.sx, s.sy); });
  mcv.addEventListener('pointermove', e => { mhover = sectorFromMid(e); say(mhover ? sectorSummary(sectors[secIdx(mhover.sx, mhover.sy)]) : 'The edge of the world.'); });
  mcv.addEventListener('pointerleave', () => { mhover = null; say('Click a sector to go there.'); });
  mcv.addEventListener('pointerdown', e => { const s = sectorFromMid(e); if (s) goto(s.sx, s.sy); });
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (anyDialogOpen()){ if (e.key === 'Escape'){ e.preventDefault(); closeDialogs(); } return; }
    const hit = keyAction(e, ui.focus); if (!hit) return;
    e.preventDefault(); ACTIONS[hit.action](hit.arg);
  });
  setTool('inspect'); setSpeed(1);
  newWorld(randomSeed());
  openStart();
  requestAnimationFrame(frame);
}
if (typeof document !== 'undefined') initUI();
