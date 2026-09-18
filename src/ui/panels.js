/* The side panels: clock, camps, goals, people, chronicle. */

/* ---- panels ---- */
function renderUI(force){
  if (!viewCamp || !camps.includes(viewCamp)) viewCamp = camps[0];
  camp = viewCamp;
  $('clock').textContent = `${stamp()}, ${seasonOf()}${weather.storm ? (isWinter() ? ', sleet' : ', rain') : isNight() ? ', night' : ''}`;
  $('camps').innerHTML = camps.length > 1 ? camps.map(c => `<button class="btn small ${c === viewCamp ? 'on' : ''}" data-camp="${c.id}">${c.name}</button>`).join('') : '';
  const s = sectors[secIdx(cur.sx, cur.sy)];
  $('where').textContent = view === 'world' ? 'World map' : view === 'mid' ? `Around ${s.name}, sector ${s.sx},${s.sy}` : `${s.name}, sector ${s.sx},${s.sy}`;
  $('tools').hidden = view !== 'loc';
  $('nav').hidden = view === 'world';
  $('levels').hidden = view !== 'loc';
  $('level').textContent = levelName(lvl); $('lvUp').disabled = lvl >= ZMAX; $('lvDown').disabled = lvl <= ZMIN;
  if (view !== 'world') for (const [id, dx, dy] of [['nW', -1, 0], ['nE', 1, 0], ['nN', 0, -1], ['nS', 0, 1]]){
    const b = $(id), nx = cur.sx + dx, ny = cur.sy + dy, ok = nx >= 0 && ny >= 0 && nx < SW && ny < SH;
    b.disabled = !ok; b.title = ok ? sectors[secIdx(nx, ny)].name : '';
  }
  $('goals').innerHTML = GOALS.map(g => {
    const st = goalState(g), pr = goalPriority[g.id] ?? 1;
    const kind = g.standing && st.s === 'active' ? '<span class="ongoing">ongoing</span>' : '';
    const pri = g.locked ? '' : `<span class="pri">${[['0', 'Off'], ['1', 'On'], ['2', 'High']].map(([v, l]) => `<button class="pbtn ${pr === +v ? 'on' : ''}" data-goal="${g.id}" data-pri="${v}">${l}</button>`).join('')}</span>`;
    return `<li class="goal g-${st.s}"><div class="gt"><span>${g.title}${kind}</span>${pri}</div><div class="gs">${st.text}</div></li>`;
  }).join('');
  const hs = beings.filter(b => b.species === 'human' && (b.camp === viewCamp || !b.alive && b.camp === viewCamp));
  $('people').innerHTML = hs.map(a => { const m = mood(a); const s = secOf(a.x, a.y);
    return `<button class="settler ${tipTarget && tipTarget.being === a.id ? 'on' : ''} ${a.alive ? '' : 'dead'}" data-being="${a.id}"><span class="sg" style="color:${beingColor(a)}">${a.alive ? (a.asleep ? 'z' : '@') : 'x'}</span><span>${a.name}</span>${bar(a.alive ? m : 0, needColor(m))}<span class="ss">${a.alive ? a.status : 'Dead'}</span></button>`; }).join('');
  const st = camp.stash;
  const tools = Object.entries(camp.tools).filter(([k, v]) => v).map(([k]) => k).join(', ');
  const young = hs.filter(a => a.alive && stage(a) === 'young').length, old = hs.filter(a => a.alive && stage(a) === 'old').length;
  const others = beings.filter(b => b.alive && b.species === 'human' && b.camp !== viewCamp).length;
  $('stats').textContent = `${hs.filter(a => a.alive).length} people here${young ? `, ${young} young` : ''}${old ? `, ${old} old` : ''}${others ? `, ${others} in other camps` : ''}. Stash: ${Object.entries(st).filter(([k, v]) => v > 0).map(([k, v]) => `${v} ${ITEMS[k].plural}`).join(', ') || 'empty'}.${tools ? ` Tools: ${tools}.` : ''} ${camp.fae.known ? ` Sprite favour ${camp.fae.favor}.` : ''} ${['rabbit', 'deer', 'fox', 'wolf', 'sprite'].map(sp => `${beings.filter(b => b.alive && b.species === sp).length} ${sp}`).join(', ')} in the world.${fireCount ? ` ${fireCount} tiles burning.` : ''}`;
  renderTip();
  const key = chronicle.length + ':' + (chronicle[0] ? chronicle[0].tick + chronicle[0].text : '');
  if (force || key !== chronKey){ chronKey = key; $('chronicle').innerHTML = chronicle.map(e => `<li class="k-${e.kind}"><span class="when">${e.when}</span> ${e.text}</li>`).join(''); }
}
