/* Floating windows. The DOM follows ui.windows: one .win per entry, kept across renders so scroll and drag survive.
   A drawer window's body is rendered by the drawer's own renderer. An inspector's body is the card. */
function winTitle(w){
  /* A popped-out People window has no filter row, so in the days its title names the count and both filters. */
  if (w.kind === 'drawer' && w.target === 'people' && !inAges()) return esc(peopleTitle());
  if (w.kind === 'drawer') return DRAWERS.find(d => d.id === w.target).label + `<span class="k">${drawerRows(w.target).length}</span>`;
  if (w.target.being != null){ const a = beingById(w.target.being); return a ? `${a.species === 'god' ? godIconSvg(a.pole, 16, null) : ''}${esc(a.name)} <span class="k">${a.species === 'god' ? esc(a.status) : moodWord(a, mood(a))}</span>` : 'Gone'; }
  /* A tile window's title bar shares the row with the drag handle, a hint, and the close button, with
     no width limit and no ellipsis rule of its own. A sector's full label ("Timberground, a pine forest")
     can run past that room where the bare biome word never did, so the title keeps the biome word, as
     it always did; the sector's own name is one hover away, in the card the window's body shows. */
  const [x, y] = w.target.tile, s = secOf(x, y); return `${esc(sectors[secIdx(s.sx, s.sy)].name)} ${x - s.sx * LW},${y - s.sy * LH}`;
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
    /* The People title can hold a long camp name, so it alone is cut short, with the whole of it on hover. */
    const title = el.querySelector('.title'), cut = w.kind === 'drawer' && w.target === 'people' && !inAges();
    title.innerHTML = winTitle(w); title.classList.toggle('cut', cut);
    if (cut) title.title = peopleTitle(); else title.removeAttribute('title');
    const body = el.querySelector('.body'), keep = body.scrollTop;
    body.classList.toggle('ins', w.kind === 'inspect');
    if (w.kind === 'drawer') DRAWER_RENDER[w.target](body, w.target);
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
    setFocus(`window:${w.id}`); ui.windows = [...ui.windows.filter(x => x !== w), w]; renderUI(true);
    if (e.target.closest('[data-close]')){ winClose(w.id); persist(); renderUI(true); return; }
    const f = e.target.closest('[data-follow]'); if (f){ const id = Number(f.dataset.follow); followId = followId === id ? null : id; renderUI(true); return; }
    const grip = e.target.closest('.grip'), bar = e.target.closest('.bar');
    if (!grip && !bar) return;
    drag = { w, grip: !!grip, x0: e.clientX, y0: e.clientY, x: w.x, y: w.y, wd: w.w, ht: w.h }; el.setPointerCapture(e.pointerId); e.preventDefault();
  });
  box.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    const r = drag.grip ? { x: drag.w.x, y: drag.w.y, w: drag.wd + dx, h: drag.ht + dy } : { x: drag.x + dx, y: drag.y + dy, w: drag.w.w, h: drag.w.h };
    Object.assign(drag.w, winClamp(r, winArea(), drag.grip));
    renderWindows();
  });
  box.addEventListener('pointerup', () => { if (!drag) return; const w = drag.w; ui.rects[w.kind === 'drawer' ? `drawer:${w.target}` : 'inspect'] = { x: w.x, y: w.y, w: w.w, h: w.h }; persist(); drag = null; });
}
