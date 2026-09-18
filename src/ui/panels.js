/* The side panels: clock, camps, goals, people, chronicle. */

/* ---- panels ---- */
function renderUI(force){
  if (!viewCamp || !camps.includes(viewCamp)) viewCamp = camps[0];
  camp = viewCamp;
  const key = viewKey(); if (!force && key === chronKey) return; chronKey = key;
  renderStrip();
  const s = sectors[secIdx(cur.sx, cur.sy)];
  $('where').textContent = view === 'world' ? 'World map' : view === 'mid' ? `Around ${s.name}, sector ${s.sx},${s.sy}` : `${s.name}, sector ${s.sx},${s.sy} \u00b7 ${levelName(lvl)}`;
  $('tools').hidden = view !== 'loc';
  $('nav').hidden = view === 'world';
  $('levels').hidden = view !== 'loc';
  $('level').textContent = levelName(lvl); $('lvUp').disabled = lvl >= ZMAX; $('lvDown').disabled = lvl <= ZMIN;
  if (view !== 'world') for (const [id, dx, dy] of [['nW', -1, 0], ['nE', 1, 0], ['nN', 0, -1], ['nS', 0, 1]]){
    const b = $(id), nx = cur.sx + dx, ny = cur.sy + dy, ok = nx >= 0 && ny >= 0 && nx < SW && ny < SH;
    b.disabled = !ok; b.title = ok ? sectors[secIdx(nx, ny)].name : '';
  }
  renderTip();
  renderDrawers();
  renderFoot();
}
const rowClass = (id, i) => ui.focus === `drawer:${id}` && ui.row[id] === i ? 'sel' : '';
function renderDrawers(){
  $('drawerTabs').innerHTML = DRAWERS.map(d => `<button class="btn ${ui.open.includes(d.id) ? 'on' : ''}" id="tab-${d.id}" data-drawer="${d.id}">${d.label}<kbd>${d.key}</kbd></button>`).join('');
  const html = ui.open.map(id => { const d = DRAWERS.find(d => d.id === id); return `<section class="drawer ${ui.focus === 'drawer:' + id ? 'focus' : ''}" data-drawer="${id}"><h2><span>${d.label}<span class="muted" id="count-${id}"></span></span><span class="k">${d.key} · ↑↓ · ⏎</span></h2>${id === 'chronicle' ? `<div class="filter"><button class="btn small ${ui.chronFilter === 'all' ? 'on' : ''}" data-filter="all">All</button><button class="btn small ${ui.chronFilter === 'major' ? 'on' : ''}" data-filter="major">Major</button></div>` : ''}${id === 'goals' ? `<div class="filter"><button class="btn small ${ui.showAll ? 'on' : ''}" id="showAllBtn">All<kbd>A</kbd></button></div>` : ''}<div class="body" id="body-${id}"></div></section>`; }).join('');
  const keep = {}; for (const b of document.querySelectorAll('#drawers .body')) keep[b.id] = b.scrollTop;
  $('drawers').innerHTML = html;
  for (const id of ui.open){ const el = $(`body-${id}`); ({ people: renderPeople, goals: renderGoals, chronicle: renderChronicle, camp: renderCamp })[id](el); if (keep[el.id] != null) el.scrollTop = keep[el.id]; }
  const sel = document.querySelector('#drawers .sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
  document.querySelector('.mapbox').classList.toggle('drawers-open', ui.open.length > 0);
}
function renderPeople(el){
  const rows = drawerRows('people');
  $('count-people').textContent = ` · ${rows.filter(r => r.r.a.alive).length}`;
  el.innerHTML = rows.map((r, i) => { const a = r.r.a, st = stage(a);
    return `<div class="row ${rowClass('people', i)} ${r.r.trouble ? 'trouble' : ''} ${a.alive ? '' : 'dead'}" data-being="${a.id}" data-i="${i}"><span class="n">${i < 9 ? i + 1 : ''}</span><span><b style="color:${beingColor(a)}">${a.name}</b>${st === 'young' ? '<span class="tag">young</span>' : st === 'old' ? '<span class="tag">old</span>' : ''}<span class="bar" style="width:70px;display:inline-block;margin-left:8px;vertical-align:middle"><i style="width:${clamp(r.r.m, 0, 100)}%;background:${needColor(r.r.m)}"></i></span></span><span class="st">${r.r.status}</span></div>`; }).join('') || '<div class="muted">Nobody yet.</div>';
}
function renderGoals(el){
  const rows = drawerRows('goals');
  $('count-goals').textContent = '';
  el.innerHTML = rows.map((r, i) => {
    if (r.kind === 'stage'){ const s = r.s, fold = [s.done ? `${s.done} done` : '', s.idle ? `${s.idle} idle` : ''].filter(Boolean).join(' · '); return `<div class="row stage ${rowClass('goals', i)}" data-stage="${s.id}" data-i="${i}"><span class="n">${i < 9 ? i + 1 : ''}</span><span>${s.label}</span><span>${fold}</span></div>`; }
    const { g, st, pr } = r.x, kind = g.standing && st.s === 'active' ? '<span class="tag">ongoing</span>' : '';
    const pri = g.locked ? '' : `<span class="pri">${[['0', 'Off'], ['1', 'On'], ['2', 'High']].map(([v, l]) => `<button class="pbtn ${pr === +v ? 'on' : ''}" data-goal="${g.id}" data-pri="${v}">${l}</button>`).join('')}</span>`;
    return `<div class="row g-${st.s} ${rowClass('goals', i)}" data-goal-row="${g.id}" data-i="${i}"><span class="n">${i < 9 ? i + 1 : ''}</span><span class="gt">${g.title}${kind}</span>${pri}<span class="gs">${st.text}</span></div>`;
  }).join('');
}
function renderChronicle(el){
  const rows = drawerRows('chronicle');
  $('count-chronicle').textContent = ` · ${rows.length}`;
  el.innerHTML = `<ol id="chronicle">${rows.map((r, i) => `<li class="k-${r.e.kind} ${rowClass('chronicle', i)}" data-i="${i}"><span class="when">${r.e.when}</span> ${r.e.text}</li>`).join('')}</ol>`;
}
function renderCamp(el){
  const c = campSummary();
  const kv = [['Name', camp.name + (camp.village ? ', a village' : '')], ['Age', `${c.age} days`], ['Stash', c.stash.map(([k, v]) => `${v} ${ITEMS[k].plural}`).join(', ') || 'empty'], ['Tools', c.tools.join(', ') || 'none'], c.favor !== null ? ['Sprite favour', String(c.favor)] : null, ['In the world', c.animals.map(([sp, n]) => `${n} ${sp}`).join(', ')], c.burning ? ['Burning', `${c.burning} tiles`] : null].filter(Boolean);
  $('count-camp').textContent = '';
  el.innerHTML = `<table class="kv">${kv.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
}
function renderFoot(){
  const e = chronicle[0];
  $('foot').innerHTML = ui.open.includes('chronicle') || !e ? '' : `<span class="when">${e.when}</span><span class="k-${e.kind}">${e.text}</span>`;
}
