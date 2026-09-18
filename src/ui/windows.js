/* Floating windows. The DOM follows ui.windows: one .win per entry, kept across renders so scroll and drag survive.
   A drawer window's body is rendered by the drawer's own renderer. An inspector's body is the card. */
function winTitle(w){
  if (w.kind === 'drawer') return DRAWERS.find(d => d.id === w.target).label + `<span class="k">${drawerRows(w.target).length}</span>`;
  if (w.target.being != null){ const a = beingById(w.target.being); return a ? `${a.name} <span class="k">${moodWord(a, mood(a))}</span>` : 'Gone'; }
  const [x, y] = w.target.tile, s = secOf(x, y); return `${sectors[secIdx(s.sx, s.sy)].name} ${x - s.sx * LW},${y - s.sy * LH}`;
}
function renderWindows(){
  const box = $('windows'), seen = new Set();
  for (const w of ui.windows){
    seen.add(w.id);
    let el = box.querySelector(`[data-win="${w.id}"]`);
    if (!el){
      el = document.createElement('section'); el.className = 'win'; el.dataset.win = w.id;
      el.innerHTML = `<div class="bar"><span class="title"></span><span><span class="k">${w.kind === 'drawer' ? 'O dock' : 'F follow'} · Esc</span> <button class="btn small" data-close aria-label="Close">×</button></span></div><div class="body"></div><div class="grip"></div>`;
      box.appendChild(el);
    }
    el.style.left = w.x + 'px'; el.style.top = w.y + 'px'; el.style.width = w.w + 'px'; el.style.height = w.h + 'px';
    el.classList.toggle('focus', ui.focus === `window:${w.id}`);
    el.querySelector('.title').innerHTML = winTitle(w);
    const body = el.querySelector('.body'), keep = body.scrollTop;
    if (w.kind === 'drawer') ({ people: renderPeople, goals: renderGoals, chronicle: renderChronicle, camp: renderCamp })[w.target](body, w.target);
    else body.innerHTML = w.target.being != null ? (beingById(w.target.being) ? inspectBeing(beingById(w.target.being), true) : '<div class="muted">Gone.</div>') : inspectTile(...w.target.tile);
    body.scrollTop = keep;
  }
  for (const el of [...box.children]) if (!seen.has(Number(el.dataset.win))) el.remove();
  ui.windows.forEach((w, n) => {
    const el = box.querySelector(`[data-win="${w.id}"]`);
    if (el && box.children[n] !== el) box.insertBefore(el, box.children[n] || null);
  });
}
/* Drag by the bar, resize by the grip. Positions persist per kind. */
function wireWindows(){
  const box = $('windows'); let drag = null;
  box.addEventListener('pointerdown', e => {
    const el = e.target.closest('.win'); if (!el) return; const w = ui.windows.find(w => w.id === Number(el.dataset.win)); if (!w) return;
    ui.focus = `window:${w.id}`; ui.windows = [...ui.windows.filter(x => x !== w), w]; renderUI(true);
    if (e.target.closest('[data-close]')){ winClose(w.id); persist(); renderUI(true); return; }
    const f = e.target.closest('[data-follow]'); if (f){ const id = Number(f.dataset.follow); followId = followId === id ? null : id; renderUI(true); return; }
    const grip = e.target.closest('.grip'), bar = e.target.closest('.bar');
    if (!grip && !bar) return;
    drag = { w, grip: !!grip, x0: e.clientX, y0: e.clientY, x: w.x, y: w.y, wd: w.w, ht: w.h }; el.setPointerCapture(e.pointerId); e.preventDefault();
  });
  box.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (drag.grip){ drag.w.w = Math.max(220, drag.wd + dx); drag.w.h = Math.max(120, drag.ht + dy); }
    else { drag.w.x = Math.max(0, drag.x + dx); drag.w.y = Math.max(0, drag.y + dy); }
    renderWindows();
  });
  box.addEventListener('pointerup', () => { if (!drag) return; const w = drag.w; ui.rects[w.kind === 'drawer' ? `drawer:${w.target}` : 'inspect'] = { x: w.x, y: w.y, w: w.w, h: w.h }; persist(); drag = null; });
}
