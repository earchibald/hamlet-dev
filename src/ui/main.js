/* The frame loop and page wiring: initUI() sets up canvases and events, frame() drives the loop. */

function frame(now){
  const dt = Math.min(250, now - (last || now)); last = now;
  if (!paused){ acc += dt * TPS * speed / 1000; let n = 0; while (acc >= 1 && n < 200){ step(); acc--; n++; } if (n >= 200) acc = 0; }
  if (followId){ const a = beingById(followId); if (a && a.alive){ const s = secOf(a.x, a.y); if (view === 'world' || s.sx !== cur.sx || s.sy !== cur.sy) setView(view === 'world' ? 'loc' : view, s); if (view === 'loc' && a.z !== lvl) setLevel(a.z); } else followId = null; }
  camp = viewCamp && camps.includes(viewCamp) ? viewCamp : camps[0];
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
  $('tools').innerHTML = TOOLS.map(t => `<button class="btn" data-tool="${t.id}" aria-pressed="false">${t.label}<kbd>${t.key.toUpperCase()}</kbd></button>`).join('');
  $('tools').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) setTool(b.dataset.tool); });
  $('speeds').innerHTML = [1, 4, 16].map(s => `<button class="btn" data-speed="${s}">${s}×</button>`).join('');
  $('speeds').addEventListener('click', e => { const b = e.target.closest('[data-speed]'); if (b){ setSpeed(Number(b.dataset.speed)); setPaused(false); } });
  $('pause').addEventListener('click', () => setPaused(!paused));
  $('stepBtn').addEventListener('click', () => { setPaused(true); for (let k = 0; k < 2; k++) step(); renderUI(true); });
  $('newWorld').addEventListener('click', () => newWorld($('seed').value.trim() || randomSeed()));
  $('seed').addEventListener('keydown', e => { if (e.key === 'Enter') newWorld($('seed').value.trim() || randomSeed()); });
  $('viewBtn').addEventListener('click', cycleView);
  $('nW').onclick = () => move(-1, 0); $('nE').onclick = () => move(1, 0); $('nN').onclick = () => move(0, -1); $('nS').onclick = () => move(0, 1);
  $('lvUp').onclick = () => setLevel(lvl + 1); $('lvDown').onclick = () => setLevel(lvl - 1);
  $('camps').addEventListener('click', e => { const b = e.target.closest('[data-camp]'); if (b){ viewCamp = camps.find(c => c.id === Number(b.dataset.camp)); if (viewCamp.site){ followId = null; setView('loc', secOf(...viewCamp.site)); } renderUI(true); } });
  $('goals').addEventListener('click', e => { const b = e.target.closest('[data-goal]'); if (b){ goalPriority[b.dataset.goal] = Number(b.dataset.pri); renderUI(true); } });
  const tipForRow = (e, pin) => {
    const b = e.target.closest('[data-being]'); if (!b) return; const id = Number(b.dataset.being);
    if (pin && tipPinned && tipTarget && tipTarget.being === id){ hideTip(); return; }
    if (!pin && tipPinned) return;
    const r = b.getBoundingClientRect(), stacked = r.left < 340;
    tipTarget = { being: id }; tipAnchor = stacked ? { x: r.left + 40, y: r.bottom, left: false } : { x: r.left, y: r.top, left: true }; tipPinned = pin; renderTip();
  };
  $('people').addEventListener('pointerover', e => tipForRow(e, false));
  $('people').addEventListener('pointerdown', e => tipForRow(e, true));
  $('people').addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !tipPinned) hideTip(); });
  window.addEventListener('scroll', () => { if (!tipPinned) hideTip(); }, { passive: true });
  $('tip').addEventListener('pointerdown', e => {
    if (e.target.closest('[data-close]')) hideTip();
    const f = e.target.closest('[data-follow]'); if (f){ const id = Number(f.dataset.follow); followId = followId === id ? null : id; renderTip(); }
  });
  document.addEventListener('pointerdown', e => { if (tipPinned && !e.target.closest('#tip, #map, #people')) hideTip(); });
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
    if (e.key === ' '){ e.preventDefault(); setPaused(!paused); return; }
    if (e.key === 'Escape'){ if (tipPinned) hideTip(); else if (view !== 'world'){ followId = null; setView('world'); } return; }
    if (e.key === 'm' || e.key === 'M'){ cycleView(); return; }
    if (view !== 'world'){ const nav = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (nav){ e.preventDefault(); move(...nav); return; } }
    if (view === 'loc' && e.key === ']'){ setLevel(lvl + 1); return; }
    if (view === 'loc' && e.key === '['){ setLevel(lvl - 1); return; }
    const t = TOOLS.find(t => t.key === e.key.toLowerCase()); if (t) setTool(t.id);
  });
  setTool('inspect'); setSpeed(1);
  newWorld(randomSeed());
  requestAnimationFrame(frame);
}
if (typeof document !== 'undefined') initUI();
