/* The side panels: clock, camps, goals, people, chronicle. */

/* ---- panels ---- */
function renderUI(force){
  if (!viewCamp || !camps.includes(viewCamp)) viewCamp = camps[0];
  camp = viewCamp;
  /* The clock and the foot run every tick. The view key does not know the wall clock. */
  renderClock(); renderFoot();
  const key = viewKey(); if (!force && key === chronKey) return; chronKey = key;
  renderStrip();
  const s = sectors[secIdx(cur.sx, cur.sy)];
  $('where').textContent = view === 'world' ? `World map \u00b7 ${camps.length} camp${camps.length > 1 ? 's' : ''}` : view === 'mid' ? `Around ${s.name}, sector ${s.sx},${s.sy}` : `${s.name}, sector ${s.sx},${s.sy} \u00b7 ${levelName(lvl)}`;
  $('tools').hidden = view !== 'loc';
  const campBtn = document.querySelector('#tools [data-tool="camp"]');
  if (campBtn){ campBtn.disabled = !!(viewCamp && viewCamp.pit); campBtn.title = campBtn.disabled ? 'The fire pit is built. The camp stays where it is.' : TOOLS.find(t => t.id === 'camp').hint; }
  $('nav').hidden = view === 'world';
  $('levels').hidden = view !== 'loc';
  $('level').textContent = levelName(lvl); $('lvUp').disabled = lvl >= ZMAX; $('lvDown').disabled = lvl <= ZMIN;
  if (view !== 'world') for (const [id, dx, dy] of [['nW', -1, 0], ['nE', 1, 0], ['nN', 0, -1], ['nS', 0, 1]]){
    const b = $(id), nx = cur.sx + dx, ny = cur.sy + dy, ok = nx >= 0 && ny >= 0 && nx < SW && ny < SH;
    b.disabled = !ok; b.title = ok ? sectors[secIdx(nx, ny)].name : '';
  }
  renderTip();
  renderDrawers();
  renderWindows();
  const sel = document.querySelector('#drawers .sel, #windows .sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
}
const rowClass = (id, i) => focusedDrawer() === id && ui.row[id] === i ? 'sel' : '';
const rowNum = (id, i) => focusedDrawer() === id && i < 9 ? i + 1 : '';
/* The header and the filter row of a drawer. Built once, then kept. */
function drawerHTML(d){
  const filter = d.id === 'chronicle' ? `<div class="filter"><button class="btn small" data-filter="all">All</button><button class="btn small" data-filter="major">Major</button></div>`
    : d.id === 'goals' ? `<div class="filter"><button class="btn small" id="showAllBtn">All<kbd>A</kbd></button></div>` : '';
  return `<h2><span>${d.label}<span class="muted" id="count-${d.id}"></span></span><span class="k">${d.key} \u00b7 \u2191\u2193 \u00b7 \u23ce</span></h2>${filter}<div class="body" id="body-${d.id}"></div>`;
}
/* Sections are kept across renders. A rebuilt drawer loses the scroll, the selection, and any text the player is selecting. */
function renderDrawers(){
  $('drawerTabs').innerHTML = DRAWERS.map(d => `<button class="btn ${ui.open.includes(d.id) ? 'on' : ''}" id="tab-${d.id}" data-drawer="${d.id}">${d.label}${winFind('drawer', d.id) ? ' ⧉' : ''}<kbd>${d.key}</kbd></button>`).join('');
  const host = $('drawers'), docked = ui.open.filter(id => !winFind('drawer', id));
  for (const sec of [...host.children]) if (!docked.includes(sec.dataset.drawer)) sec.remove();
  docked.forEach((id, n) => {
    const d = DRAWERS.find(d => d.id === id);
    let sec = host.querySelector(`section[data-drawer="${id}"]`);
    if (!sec){ sec = document.createElement('section'); sec.className = 'drawer'; sec.dataset.drawer = id; sec.innerHTML = drawerHTML(d); }
    if (host.children[n] !== sec) host.insertBefore(sec, host.children[n] || null);
    sec.classList.toggle('focus', ui.focus === 'drawer:' + id);
    for (const b of sec.querySelectorAll('[data-filter]')) b.classList.toggle('on', ui.chronFilter === b.dataset.filter);
    const all = sec.querySelector('#showAllBtn'); if (all) all.classList.toggle('on', ui.showAll);
  });
  for (const id of docked){
    const el = $(`body-${id}`), keep = el.scrollTop;
    ({ people: renderPeople, goals: renderGoals, chronicle: renderChronicle, camp: renderCamp })[id](el);
    if (el.scrollTop !== keep) el.scrollTop = keep;
  }
  document.querySelector('.mapbox').classList.toggle('drawers-open', docked.length > 0);
}
function renderPeople(el){
  const rows = drawerRows('people');
  const c = $('count-people'); if (c) c.textContent = ` · ${rows.filter(r => r.r.a.alive).length}`;
  el.innerHTML = rows.map((r, i) => { const a = r.r.a, st = stage(a);
    return `<div class="row ${rowClass('people', i)} ${r.r.trouble ? 'trouble' : ''} ${a.alive ? '' : 'dead'}" data-being="${a.id}" data-i="${i}"><span class="n">${rowNum('people', i)}</span><span><b style="color:${beingColor(a)}">${a.name}</b>${st === 'young' ? '<span class="tag">young</span>' : st === 'old' ? '<span class="tag">old</span>' : ''}<span class="bar" style="width:70px;display:inline-block;margin-left:8px;vertical-align:middle"><i style="width:${clamp(r.r.m, 0, 100)}%;background:${needColor(r.r.m)}"></i></span></span><span class="st">${r.r.status}</span></div>`; }).join('') || '<div class="muted">Nobody yet.</div>';
}
function renderGoals(el){
  const rows = drawerRows('goals');
  const c = $('count-goals'); if (c) c.textContent = '';
  el.innerHTML = rows.map((r, i) => {
    if (r.kind === 'stage'){ const s = r.s, fold = [s.done ? `${s.done} done` : '', s.idle ? `${s.idle} idle` : ''].filter(Boolean).join(' · '); return `<div class="row stage ${rowClass('goals', i)}" data-stage="${s.id}" data-i="${i}"><span class="n">${rowNum('goals', i)}</span><span>${s.label}</span><span>${fold}</span></div>`; }
    const { g, st, pr } = r.x, kind = g.standing && st.s === 'active' ? '<span class="tag">ongoing</span>' : '';
    const pri = g.locked ? '' : `<span class="pri">${[['0', 'Off'], ['1', 'On'], ['2', 'High']].map(([v, l]) => `<button class="pbtn ${pr === +v ? 'on' : ''}" data-goal="${g.id}" data-pri="${v}">${l}</button>`).join('')}</span>`;
    return `<div class="row g-${st.s} ${rowClass('goals', i)}" data-goal-row="${g.id}" data-i="${i}"><span class="n">${rowNum('goals', i)}</span><span class="gt">${g.title}${kind}</span>${pri}<span class="gs">${st.text}</span></div>`;
  }).join('');
}
/* The newest 300 lines. The list rebuilds only when a line arrives, the filter moves, or the cursor moves. */
const CHRON_ROWS = 300;
function renderChronicle(el){
  const key = chronicle.length + ':' + (chronicle[0] ? chronicle[0].tick : 0) + ':' + ui.chronFilter + ':' + (ui.focus === 'drawer:chronicle' ? ui.row.chronicle : -1);
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  const rows = drawerRows('chronicle');
  const c = $('count-chronicle'); if (c) c.textContent = ` · ${rows.length}`;
  el.innerHTML = `<ol id="chronicle">${rows.slice(0, CHRON_ROWS).map((r, i) => `<li class="k-${r.e.kind} ${rowClass('chronicle', i)}" data-i="${i}"><span class="when">${r.e.when}</span> ${r.e.text}</li>`).join('')}</ol>`;
}
function renderCamp(el){
  const c = campSummary();
  const kv = [['Name', camp.name + (camp.village ? ', a village' : '')], ['Age', `${c.age} days`], ['Stash', c.stash.map(([k, v]) => `${v} ${ITEMS[k].plural}`).join(', ') || 'empty'], ['Tools', c.tools.join(', ') || 'none'], c.favor !== null ? ['Sprite favour', String(c.favor)] : null, ['In the world', c.animals.map(([sp, n]) => `${n} ${sp}`).join(', ')], c.burning ? ['Burning', `${c.burning} tiles`] : null].filter(Boolean);
  const cnt = $('count-camp'); if (cnt) cnt.textContent = '';
  el.innerHTML = `<table class="kv">${kv.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
}
/* A note wins the foot for four seconds. Then the newest chronicle line comes back.
   The cursor phrase always shows first, in its own span; the note or chronicle line follows. */
const NOTE_MS = 4000;
function renderFoot(){
  const phrase = `<span class="muted">${cursorPhrase()}</span>`;
  if (ui.note && uiNow() - ui.note.at < NOTE_MS){ $('foot').innerHTML = `${phrase}<span class="muted">·</span><span>${ui.note.text}</span>`; return; }
  ui.note = null;
  const e = chronicle[0];
  const line = ui.open.includes('chronicle') || !e ? '' : `<span class="when">${e.when}</span><span class="k-${e.kind}">${e.text}</span>`;
  $('foot').innerHTML = `${phrase}${line ? '<span class="muted">·</span>' + line : ''}`;
}
