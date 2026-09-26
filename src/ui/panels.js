/* The side panels: clock, camps, goals, people, chronicle. */

/* ---- panels ---- */
function renderUI(force){
  if (!viewCamp || !camps.includes(viewCamp)) viewCamp = camps[0];
  camp = viewCamp;
  /* The clock and the foot run every tick. The view key does not know the wall clock. */
  renderClock(); renderFoot();
  /* The view button names the view M goes to next. It is written on every call, before the view key,
     because the key holds neither the view nor whether a fire exists. The camp fire view joins the cycle
     when the camp picks its site, with the view unchanged. setHTML skips the write when nothing changed. */
  setHTML($('viewBtn'), `${VIEW_LABEL[nextView(view)]}<kbd>M</kbd>`);
  const key = viewKey(); if (!force && key === chronKey) return; chronKey = key;
  renderStrip();
  drawTimeline();
  const s = inAges() ? null : sectors[secIdx(cur.sx, cur.sy)];
  /* The world map wears the valley's name from the day a village gives it one, and only once somebody
     has read it. Until then it is the world map. */
  $('where').textContent = inAges() ? `The field \u00b7 ${seasonLine()}` : view === 'world' ? `${valleyName() || 'World map'} \u00b7 ${camps.length} camp${camps.length > 1 ? 's' : ''}` : view === 'mid' ? `Around ${sectorLabel(s)}, sector ${s.sx},${s.sy}` : view === 'fire' ? (viewCamp && camps.includes(viewCamp) ? `The fire at ${viewCamp.name}, in ${sectorLabel(fireSector() || s)} \u00b7 ${levelName(lvl)}` : `The fire, unwatched \u00b7 ${levelName(lvl)}`) : `${sectorLabel(s)}, sector ${s.sx},${s.sy} \u00b7 ${levelName(lvl)}`;
  $('hurryBtn').hidden = !inAges(); $('hourBtn').disabled = inAges(); $('viewBtn').disabled = inAges(); $('chordBtn').disabled = inAges();
  $('overlayBtn').hidden = inAges() || view !== 'world'; $('overlayBtn').classList.toggle('on', ui.overlay);
  $('tools').hidden = !closeUp(view);
  $('nav').hidden = view === 'world';
  $('levels').hidden = !closeUp(view);
  $('level').textContent = levelName(lvl); $('lvUp').disabled = lvl >= ZMAX; $('lvDown').disabled = lvl <= ZMIN;
  if (view !== 'world') for (const [id, dx, dy] of [['nW', -1, 0], ['nE', 1, 0], ['nN', 0, -1], ['nS', 0, 1]]){
    const b = $(id), nx = cur.sx + dx, ny = cur.sy + dy, ok = nx >= 0 && ny >= 0 && nx < SW && ny < SH;
    b.disabled = !ok; b.title = ok ? sectorLabel(sectors[secIdx(nx, ny)]) : '';
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
  const filter = d.id === 'chronicle' ? `<div class="filter"><button class="btn small" data-filter="all">All</button><button class="btn small" data-filter="major">Major</button><input id="chronSearch" autocomplete="off" placeholder="Search names /"></div>`
    : d.id === 'goals' ? `<div class="filter"><button class="btn small" id="showAllBtn">All<kbd>A</kbd></button></div>`
    /* renderDrawers writes the labels, since they follow the filters. It writes only the inner span. A
       click's own target must stay in the page: the map's pointer handler runs after the drawer's, and a
       target cut out of the page by a rewrite is not inside #drawers, so the map took the focus. */
    : d.id === 'people' ? `<div class="filter pf" id="peopleFilter"><button class="btn small" id="peopleCampBtn"><span class="lbl"></span><kbd>E</kbd></button><button class="btn small" id="peopleAgeBtn"><span class="lbl"></span><kbd>Y</kbd></button></div>` : '';
  return `<h2><span>${d.label}<span class="muted" id="count-${d.id}"></span></span><span class="k">${d.key} \u00b7 \u2191\u2193 \u00b7 \u23ce</span></h2>${filter}<div class="body" id="body-${d.id}"></div>`;
}
/* Sections are kept across renders. A rebuilt drawer loses the scroll, the selection, and any text the player is selecting. */
function renderDrawers(){
  setHTML($('drawerTabs'), DRAWERS.map(d => `<button class="btn ${ui.open.includes(d.id) ? 'on' : ''}" id="tab-${d.id}" data-drawer="${d.id}">${d.label}${winFind('drawer', d.id) ? ' ⧉' : ''}<kbd>${d.key}</kbd></button>`).join(''));
  const host = $('drawers'), docked = ui.open.filter(id => !winFind('drawer', id));
  for (const sec of [...host.children]) if (!docked.includes(sec.dataset.drawer)) sec.remove();
  docked.forEach((id, n) => {
    const d = DRAWERS.find(d => d.id === id);
    let sec = host.querySelector(`section[data-drawer="${id}"]`);
    if (!sec){ sec = document.createElement('section'); sec.className = d.fit ? 'drawer fit' : 'drawer'; sec.dataset.drawer = id; sec.innerHTML = drawerHTML(d); }
    if (host.children[n] !== sec) host.insertBefore(sec, host.children[n] || null);
    sec.classList.toggle('focus', ui.focus === 'drawer:' + id);
    for (const b of sec.querySelectorAll('[data-filter]')) b.classList.toggle('on', ui.chronFilter === b.dataset.filter);
    /* The box follows the state, but never while the player is typing in it: that would move the caret. */
    const box = sec.querySelector('#chronSearch');
    if (box && box.value !== ui.chronSearch && document.activeElement !== box) box.value = ui.chronSearch;
    const all = sec.querySelector('#showAllBtn'); if (all) all.classList.toggle('on', ui.showAll);
    /* The People filters. In the ages the drawer lists gods, which have no camp and no age, so the row hides.
       A button is on when its filter is not the default: a camp other than the chosen one, or an age. */
    const pf = sec.querySelector('#peopleFilter');
    if (pf){
      pf.hidden = inAges();
      if (!pf.hidden){
        const cb = sec.querySelector('#peopleCampBtn'), ab = sec.querySelector('#peopleAgeBtn');
        setHTML(cb.querySelector('.lbl'), esc(peopleCampLabel())); cb.classList.toggle('on', peopleScope().camp !== chosenCamp());
        setHTML(ab.querySelector('.lbl'), esc(peopleAgeLabel())); ab.classList.toggle('on', ui.peopleAge !== 'any');
      }
    }
  });
  for (const id of docked){
    const el = $(`body-${id}`), keep = el.scrollTop;
    DRAWER_RENDER[id](el);
    if (el.scrollTop !== keep) el.scrollTop = keep;
  }
}
function renderPeople(el){
  const rows = drawerRows('people');
  const ages = inAges();
  /* In the ages the list is the gods, and no filter applies. In the days the count says how many the filters show. */
  const c = $('count-people'); if (c) c.textContent = ` · ${ages ? rows.filter(r => r.r.a.alive).length : peopleCountText()}`;
  /* A list of more than one camp names each person's camp, in muted text rather than a tag, so that
     "no camp" does not read as an age beside "young" and "old". */
  const mixed = !ages && peopleMixed();
  const home = a => `<span class="campname">${a.camp ? esc(a.camp.name) : 'no camp'}</span>`;
  el.innerHTML = rows.map((r, i) => { const a = r.r.a, st = a.species === 'god' ? 'adult' : stage(a), label = esc(r.label);
    return `<div class="row ${rowClass('people', i)} ${r.r.trouble ? 'trouble' : ''} ${a.alive ? '' : 'dead'}" data-being="${a.id}" data-i="${i}"><span class="n">${rowNum('people', i)}</span><span><b style="color:${beingColor(a)}">${a.species === 'god' ? godIconSvg(a.pole, 14, null) : ''}${label}</b>${mixed ? home(a) : ''}${st === 'young' ? '<span class="tag">young</span>' : st === 'old' ? '<span class="tag">old</span>' : ''}<span class="bar mood"><i style="width:${clamp(r.r.m, 0, 100)}%;background:${needColor(r.r.m)}"></i></span></span><span class="st">${esc(r.r.status)}</span></div>`; }).join('') || `<div class="muted">${ages ? 'No god yet.' : peopleEmptyText()}</div>`;
}
function renderGoals(el){
  const rows = drawerRows('goals');
  const c = $('count-goals'); if (c) c.textContent = '';
  if (inAges()){ el.innerHTML = '<div class="muted">No goals yet. The valley is not made.</div>'; return; }
  el.innerHTML = rows.map((r, i) => {
    if (r.kind === 'stage'){ const s = r.s, fold = [s.done ? `${s.done} done` : '', s.idle ? `${s.idle} idle` : ''].filter(Boolean).join(' · '); const line = foldLine(s, ui.unfold[s.id] || ui.showAll); return `<div class="row stage ${rowClass('goals', i)}" data-stage="${s.id}" data-i="${i}"><span class="n">${rowNum('goals', i)}</span><span>${s.label}</span><span>${fold}</span>${line ? `<span class="fold" title="${esc(line)}">${esc(line)}</span>` : ''}</div>`; }
    const { g, st, pr } = r.x, kind = g.standing && st.s === 'active' ? '<span class="tag">ongoing</span>' : '';
    const pri = g.locked ? '' : `<span class="pri">${[['0', 'Off'], ['1', 'On'], ['2', 'High']].map(([v, l]) => `<button class="pbtn ${pr === +v ? 'on' : ''}" data-goal="${g.id}" data-pri="${v}">${l}</button>`).join('')}</span>`;
    return `<div class="row g-${st.s} ${rowClass('goals', i)}" data-goal-row="${g.id}" data-i="${i}"><span class="n">${rowNum('goals', i)}</span><span class="gt">${g.title}${kind}</span>${pri}<span class="gs">${esc(st.text)}</span></div>`;
  }).join('');
}
/* The newest 300 lines. The list rebuilds only when a line arrives, the filter moves, or the cursor moves. */
const CHRON_ROWS = 300;
function renderChronicle(el){
  const key = chronicle.length + ':' + (chronicle[0] ? chronicle[0].tick : 0) + ':' + ui.chronFilter + ':' + ui.chronSearch + ':' + (focusedDrawer() === 'chronicle' ? ui.row.chronicle : -1);
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  const rows = drawerRows('chronicle');
  const c = $('count-chronicle'); if (c) c.textContent = ` · ${rows.length}`;
  el.innerHTML = `<ol id="chronicle">${rows.slice(0, CHRON_ROWS).map((r, i) => `<li class="k-${esc(r.e.kind)} ${rowClass('chronicle', i)}" data-i="${i}"><span class="when">${esc(r.e.when)}</span> ${esc(r.e.text)}</li>`).join('')}</ol>`;
}
function renderCamp(el){
  if (inAges()){ const n = $('count-camp'); if (n) n.textContent = ''; el.innerHTML = '<div class="muted">No camp yet. The valley is not made.</div>'; return; }
  const c = campSummary();
  const nm = campNames();
  const past = nm.past.map(r => `<span title="${esc(nameTitle(r))}">${esc(r.text)}, day ${Math.floor(r.since / DAY) + 1}${r.why ? `, ${esc(r.why)}` : ''}</span>`).join('; ');
  const kv = [
    ['Name', `<span title="${esc(nameTitle(nm.now))}">${esc(camp.name)}</span>${camp.village ? ', a village' : ''}`],
    past ? ['Once called', past] : null,
    campValleyRow() ? ['Valley', esc(campValleyRow()[1])] : null,
    ['Age', nOf(c.age, 'day', 'days')], ['Stash', c.stash.map(([k, v]) => `${v} ${ITEMS[k].plural}`).join(', ') || 'empty'], ['Tools', esc(c.tools.join(', ')) || 'none'], c.favor !== null ? ['Sprite favour', String(c.favor)] : null, ['In the world', c.animals.map(([sp, n]) => nOf(n, SPECIES[sp].label, SPECIES[sp].plural)).join(', ')], c.burning ? ['Burning', nOf(c.burning, 'tile', 'tiles')] : null,
  ].filter(Boolean);
  const cnt = $('count-camp'); if (cnt) cnt.textContent = '';
  el.innerHTML = `<table class="kv">${kv.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
}
/* The creation, by age, oldest first. The sim never trims it, so it never scrolls off. It rebuilds only when a
   line arrives, the world is new, or the cursor moves. */
function renderLegends(el){
  const key = seedText + ':' + legends.length + ':' + (focusedDrawer() === 'legends' ? ui.row.legends : -1);
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  const rows = drawerRows('legends');
  const c = $('count-legends'); if (c) c.textContent = ` · ${rows.length}`;
  let when = null;
  el.innerHTML = rows.length ? `<ol id="legends">${rows.map((r, i) => {
    const head = r.e.when !== when ? `<li class="age">${esc(r.e.when)}</li>` : ''; when = r.e.when;
    return `${head}<li class="k-${esc(r.e.kind)} ${rowClass('legends', i)}" data-i="${i}">${esc(r.e.text)}</li>`;
  }).join('')}</ol>` : '<div class="muted">Nothing is told yet.</div>';
}
/* One table from a drawer id to its renderer. The docked drawers and the drawer windows both read it. */
const DRAWER_RENDER = { people: renderPeople, goals: renderGoals, chronicle: renderChronicle, camp: renderCamp, legends: renderLegends };
/* A note wins the foot for four seconds. Then the newest chronicle line comes back.
   The cursor phrase always shows first, in its own span; the note or chronicle line follows. */
const NOTE_MS = 4000;
/* The chip's line for the foot: its head, then its rows as their act and their score, a failed
   row saying the ground refused it, and the taken row marked so the player can tell which option
   the head's verb refers to. Every string here came from the simulation, so it passes through esc. */
function chipFootLine(chip){
  const rows = chip.rows.map(r => `<span class="chiprow${r.failed ? ' failed' : r.taken ? ' taken' : ''}">${esc(r.type)} ${r.score}${r.failed ? ' — the ground refused it' : r.taken ? ' — taken' : ''}</span>`).join('<span class="muted">·</span>');
  return `<span class="chiphead">${esc(chip.head)}</span>${rows ? '<span class="chiprows">' + rows + '</span>' : ''}`;
}
/* An act's card, in the same table an inspected region already shows: a muted head, then its rows as
   label and value. Every string came from the simulation, so it passes through esc. Used for the hover
   on a mark and, through actFootLine, for the timeline cell that opens the same act. */
function actCardHTML(card){
  const rows = card.rows.map(r => `<tr><td>${esc(r.label)}</td><td>${esc(r.value)}</td></tr>`).join('');
  return `<div class="muted" style="margin:1px 0 5px">${esc(card.head)}</div><table class="kv">${rows}</table>`;
}
/* The act's card, as one line for the foot: the head, then its rows as label and value. */
function actFootLine(card){
  const rows = card.rows.map(r => `<span class="chiprow">${esc(r.label)}: ${esc(r.value)}</span>`).join('<span class="muted">·</span>');
  return `<span class="chiphead">${esc(card.head)}</span>${rows ? '<span class="chiprows">' + rows + '</span>' : ''}`;
}
function renderFoot(){
  const phrase = `<span class="muted">${esc(cursorPhrase())}</span>`;
  if (ui.note && uiNow() - ui.note.at < NOTE_MS){ $('foot').innerHTML = `${phrase}<span class="muted">·</span><span>${esc(ui.note.text)}</span>`; return; }
  ui.note = null;
  /* The chip's own age still plays: the same act has a gesture, and its card is the one the mark on the
     field shows. An older chip keeps no gesture (see actCardForChip), so the chip's own matrix stands. */
  const act = ui.timelineChip ? actCardForChip(ui.timelineChip) : null;
  const chip = act ? null : footChip();
  const e = chronicle[0];
  /* The act caption already says this sentence, in its own place above the foot. The foot does not say it twice. */
  const echoed = captionText && e && e.text === captionText;
  const line = act ? actFootLine(act) : chip ? chipFootLine(chip) : (ui.open.includes('chronicle') || !e || echoed ? '' : `<span class="when">${esc(e.when)}</span><span class="k-${esc(e.kind)}">${esc(e.text)}</span>`);
  $('foot').innerHTML = `${phrase}${line ? '<span class="muted">·</span>' + line : ''}`;
}
