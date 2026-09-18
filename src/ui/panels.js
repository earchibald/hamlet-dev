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
}
function renderDrawers(){
  $('drawerTabs').innerHTML = DRAWERS.map(d => `<button class="btn ${ui.open.includes(d.id) ? 'on' : ''}" id="tab-${d.id}" data-drawer="${d.id}">${d.label}<kbd>${d.key}</kbd></button>`).join('');
  $('drawers').innerHTML = ui.open.map(id => { const d = DRAWERS.find(d => d.id === id); return `<section class="drawer ${ui.focus === 'drawer:' + id ? 'focus' : ''}" data-drawer="${id}"><h2>${d.label}<span class="k">${d.key}</span></h2><div class="body" id="body-${id}"></div></section>`; }).join('');
}
