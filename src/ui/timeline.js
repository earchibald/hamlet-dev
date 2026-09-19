/* The timeline: the record of the creation, laid flat under the map. It draws the model and nothing
   else. It builds nodes and sets textContent, so no string out of the simulation is ever parsed as
   markup. Do not set any element's markup property here. */
function tlButton(id, text, key){
  const b = document.createElement('button');
  b.className = 'btn small'; b.id = id; b.textContent = text;
  const k = document.createElement('kbd'); k.textContent = key; b.appendChild(k);
  return b;
}
function tlCell(c){
  if (!c.chip){ const s = document.createElement('span'); s.className = 'cell'; s.textContent = c.text; return s; }
  const b = document.createElement('button');
  b.className = 'cell' + (c.major ? ' major' : '') + (ui.timelineChip === c.chip ? ' open' : '');
  b.dataset.chip = c.chip; b.textContent = c.text;
  return b;
}
function drawTimeline(){
  const el = $('timeline'); if (!el) return;
  const m = timelineModel();
  el.classList.toggle('on', m.shown);
  el.replaceChildren();
  if (!m.shown) return;
  const head = document.createElement('div'); head.className = 'tlhead';
  const span = document.createElement('span'); span.textContent = `Age ${m.from} to ${m.now}`;
  const sp = document.createElement('span'); sp.className = 'sp';
  sp.append(tlButton('foldTl', m.folded ? 'Every god' : 'One row', 'T'),
            tlButton('tlOut', 'More ages', '['), tlButton('tlIn', 'Fewer ages', ']'));
  head.append(span, sp); el.appendChild(head);
  for (const r of m.rows){
    const lane = document.createElement('div'); lane.className = 'lane';
    const who = document.createElement('span'); who.className = 'who'; who.textContent = r.label;
    lane.appendChild(who);
    for (const c of r.cells) lane.appendChild(tlCell(c));
    const now = document.createElement('span'); now.className = 'now';
    lane.appendChild(now);
    el.appendChild(lane);
  }
}

/* One handler for the whole band. A click on a cell opens or closes it. A click anywhere in the band
   gives the timeline focus, so `[` and `]` zoom instead of changing level. */
const TL_BUTTONS = { foldTl: 'foldTimeline', tlOut: 'zoomTimelineOut', tlIn: 'zoomTimelineIn' };
function initTimeline(){
  const el = $('timeline'); if (!el) return;
  el.addEventListener('click', e => {
    ui.focus = 'timeline';
    const cell = e.target.closest('[data-chip]');
    const btn = e.target.closest('button');
    if (cell) ACTIONS.openChip(cell.dataset.chip);
    else if (btn && TL_BUTTONS[btn.id]) ACTIONS[TL_BUTTONS[btn.id]]();
    renderUI(true);
  });
}
