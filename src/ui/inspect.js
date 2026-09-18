/* Inspection: the hover card and the window card for a being or a tile. */

/* ---- inspection ---- */
function bar(v, color){ return `<span class="bar"><i style="width:${clamp(v, 0, 100)}%;background:${color}"></i></span>`; }
const needColor = v => v < 25 ? 'var(--bad)' : v < 50 ? 'var(--warn)' : 'var(--good)';
function moodWord(a, m){ if (!a.alive) return 'Dead'; return m >= 65 ? 'Happy' : m >= 45 ? 'Content' : m >= 30 ? 'Uneasy' : m >= 15 ? 'Unhappy' : 'Miserable'; }
function traitWord(k, v){ const w = TRAIT_WORDS[k]; return v < 0.3 ? w[0] : v > 0.7 ? w[2] : w[1]; }
/* full is the window's card: the long history and the Follow button. The hover tip shows the short one. */
function inspectBeing(a, full = false){
  const m = mood(a), sp = SPECIES[a.species];
  const need = (k, v) => `<div class="need"><span>${NEED_LABEL[k]}</span>${bar(v, needColor(v))}<span class="num">${Math.round(v)}</span></div>`;
  const thoughts = a.thoughts.slice().sort((x, y) => Math.abs(y.value) - Math.abs(x.value)).slice(0, 4).map(t => `<li class="${t.value >= 0 ? 'pos' : 'neg'}"><b>${t.value > 0 ? '+' : ''}${t.value}</b> ${t.text}</li>`).join('') || '<li class="muted">No strong thoughts right now.</li>';
  const why = a.lastChoice ? `<div class="why">${a.lastChoice.opts.slice(0, 6).map(o => { const k = o.label || o.type; return `<span class="${k === a.lastChoice.picked ? 'picked' : o.failed ? 'failed' : ''}">${k} ${o.score}</span>`; }).join('')}</div>` : '<span class="muted">No decision yet.</span>';
  const hist = a.history.slice(0, full ? 30 : 2).map(e => `<li><span class="muted">${e.when}</span> ${e.text}</li>`).join('');
  const s = secOf(a.x, a.y);
  let extra = '';
  if (a.species === 'human'){
    const rels = beings.filter(o => o !== a && a.rel[o.id]).map(o => `${o.name} (${a.rel[o.id]}, ${a.opinions[o.id] > 0 ? '+' : ''}${a.opinions[o.id]})`).join(', ') || 'No friends or rivals yet.';
    extra = `${a.inDark ? '<div class="muted">In the dark without a brand.</div>' : ''}<h3>Personality</h3><div class="chips">${Object.entries(a.traits).map(([k, v]) => `<span class="chip" title="${k} ${v}">${traitWord(k, v)}</span>`).join('')}${a.clothes ? '<span class="chip">wearing hide clothes</span>' : ''}${a.camp && a.camp.tools.basket && a.species === 'human' ? '<span class="chip">with a basket</span>' : ''}</div><h3>Skills</h3><div class="chips">${Object.entries(a.skills).filter(([k, v]) => v > 0).map(([k, v]) => `<span class="chip">${k} ${v}</span>`).join('') || '<span class="muted">Nothing yet. Skills come from work, and from elders by the fire.</span>'}</div><h3>Relationships</h3><div>${rels}</div>`;
  } else {
    const habit = { rabbit: 'eats at dawn and dusk', deer: 'grazes at dawn and dusk, keeps to the herd', fox: 'hunts rabbits by night', wolf: 'hunts by night, raids dark camps', sprite: 'sleeps in a hollow pine by day, dances and meddles by night', gnome: 'comes out at dusk, farms mushrooms, borrows and repays' }[a.species];
    const learned = [a.skills.wary ? `wary ${a.skills.wary}` : '', a.skills.hunt ? `hunter ${a.skills.hunt}` : ''].filter(Boolean);
    extra = `<h3>Nature and learning</h3><div class="chips"><span class="chip">${traitWord('bravery', a.traits.bravery)}</span>${a.species === 'deer' ? `<span class="chip">${traitWord('sociability', a.traits.sociability)}</span>` : ''}<span class="chip">${habit}</span>${learned.map(l => `<span class="chip">${l}</span>`).join('')}${drowsy(a) ? '<span class="chip">resting hours</span>' : ''}${a.grove ? `<span class="chip">grove in ${a.grove.sector.name.toLowerCase()} ${a.grove.sector.sx},${a.grove.sector.sy}, anger ${a.grove.anger}</span>` : ''}${a.den ? `<span class="chip">${a.den.hill ? `den under the hill at ${a.den.hill.x},${a.den.hill.y}` : `burrow at ${a.den.exit.x},${a.den.exit.y}`}</span>` : ''}</div>`;
  }
  const follow = full && a.alive ? `<button class="btn small" data-follow="${a.id}">${followId === a.id ? 'Stop following' : 'Follow'}</button>` : '';
  return `<div class="head"><strong style="color:${beingColor(a)}">${a.name}</strong><span>${moodWord(a, m)} (${m})</span></div>
    <div class="muted" style="margin:1px 0 5px">${stage(a) === 'young' ? 'Young, ' : stage(a) === 'old' ? 'Old, ' : ''}${Math.floor(ageDays(a))} days. ${a.alive ? a.status : 'Dead'}${a.carrying ? `, carrying ${a.carrying.count} ${a.carrying.count > 1 ? ITEMS[a.carrying.kind].plural : ITEMS[a.carrying.kind].name}` : ''}. Health ${Math.round(Math.max(0, a.hp))}. In ${sectors[secIdx(s.sx, s.sy)].name.toLowerCase()} at ${a.x - s.sx * LW},${a.y - s.sy * LH}.${a.camp && camps.length > 1 ? ` Belongs to ${a.camp.name}.` : ''} ${follow}</div>
    ${Object.entries(a.needs).map(([k, v]) => need(k, v)).join('')}${extra}
    <h3>Thoughts</h3><ul>${thoughts}</ul>
    <h3>Last decision (highest score wins)</h3>${why}
    ${hist ? `<h3>${full ? 'Personal history' : 'Recent history'}</h3><ul class="hist">${hist}</ul>` : ''}`;
}
function inspectTile(x, y, z = 0){
  const s = secOf(x, y), where = `${sectors[secIdx(s.sx, s.sy)].name}, ${x - s.sx * LW},${y - s.sy * LH}`;
  if (!hasTile(x, y, z)) return `<table class="kv"><tr><td>Where</td><td>${where}</td></tr><tr><td>Level</td><td>${levelName(z)}. ${z > 0 ? 'Open air. The ground is below.' : 'Solid earth. Nothing is dug here.'}</td></tr></table>`;
  const t = tileAt(x, y, z), rows = [['Where', where], ['Level', levelName(z)], ['Ground', GROUND[t.ground].name + (GROUND[t.ground].walk || t.ground === 'water' ? '' : '. Nothing walks through it.')]];
  const c = z === 0 ? camps.find(c => c.site && ((c.site[0] === x && c.site[1] === y) || (c.stashTile[0] === x && c.stashTile[1] === y) || (c.pit && c.pit[0] === x && c.pit[1] === y) || (c.rack && c.rack[0] === x && c.rack[1] === y) || (c.shelter && c.shelter[0] === x && c.shelter[1] === y) || (c.workshop && c.workshop[0] === x && c.workshop[1] === y) || (c.kiln && c.kiln[0] === x && c.kiln[1] === y))) : null;
  const saved = camp; if (c) camp = c;
  if (z === 0 && camp.site && camp.site[0] === x && camp.site[1] === y && !camp.pit){
    const n = GOALS.find(g => g.id === 'firepit').need;
    rows.push(['Camp site', `${camp.siteReason === 'you chose it' ? 'You chose it' : 'Chosen because ' + (camp.siteReason || 'you set it')}. The fire pit goes here.`], ['Still needed', `${Math.max(0, n.rock - camp.stash.rock)} rocks, ${Math.max(0, n.stick - camp.stash.stick)} sticks`]);
  }
  if (t.feature) rows.push(['Feature', FEATURES[t.feature].name + (t.feature === 'bush' ? `, ${t.berries} berries` : '')]);
  if (t.feature === 'mushrooms') rows.push(['Mushrooms', `${t.shrooms} ready. Gnomes farm this patch.`]);
  if (t.hill) rows.push(['Hill', `${t.hill.storeys === 2 ? 'A tall hill' : 'A low hill'} of old stone, ${t.hill.storeys === 2 ? 'two storeys' : 'one storey'} high. Cliffs all round but for the slopes.`]);
  if (GROUND[t.ground].quarry) rows.push(['Rock face', t.quarried ? 'quarried. Rocks come from here.' : 'rocks can be quarried here with the axe.']);
  if (t.slope) rows.push(['Slope', `a way up to ${levelName(z + 1).toLowerCase()}.`]);
  if (t.mouth) rows.push(['Cave mouth', `a way ${t.mouth.mouth.z === 0 ? 'in' : 'down'}. ${t.mouth.story.join(' ')}`]);
  if (t.cave) rows.push([t.cave.kind === 'den' ? 'Den' : t.cave.kind === 'hollow' ? 'Hollow' : t.cave.kind === 'burrow' ? 'Burrow' : 'Cave', `${t.cave.story.join(' ')}${t.cave.owner ? ` ${t.cave.owner === 'sprite' ? 'Sprites' : t.cave.owner === 'wolf' ? 'Wolves' : t.cave.owner === 'gnome' ? 'Gnomes' : 'Foxes'} live here.` : ''}${t.cave.abandoned ? ' Abandoned.' : ''}${t.cave.searched ? ` Searched by ${t.cave.searched.name}.` : ''}${t.cave.cleared ? ` Cleared by ${t.cave.cleared.name}.` : ''}`]);
  if (t.cave && t.cave.blocked === t) rows.push(['Fallen rock', 'blocks the way. Tools could clear it.']);
  if (z < 0) rows.push(['Dark', 'People need a burning ember down here.']);
  const here = items.filter(i => i.x === x && i.y === y && i.z === z); if (here.length) rows.push(['Loose', here.map(i => ITEMS[i.kind].name).join(', ')]);
  if (t.struct && t.struct.type === 'firepit') rows.push(['Camp', `The hearth. ${camp.siteReason === 'you chose it' ? 'You chose the site' : 'Site chosen because ' + (camp.siteReason || 'you set it')}.`], ['Fire pit', t.struct.lit ? `burning, fuel ${Math.round(t.struct.fuel / PIT_MAX * 100)}%` : t.struct.fuel > 0 ? 'laid, waiting for fire' : 'cold and empty']);
  if (t.struct && t.struct.type === 'leanto') rows.push(['Lean-to', 'a roof of logs and sticks. People sleep here.']);
  if (t.struct && t.struct.type === 'hut') rows.push(['Hut', 'sleeps three, out of the wind and rain.']);
  if (t.struct && t.struct.type === 'storehouse') rows.push(['Storehouse', 'the stash on stilts. Food keeps twice as long, and wolves cannot reach it.']);
  if (t.struct && t.struct.type === 'workshop') rows.push(['Workshop', 'a roofed bench. Cord, baskets, rods, and clothes are made here, faster than by the fire.']);
  if (t.struct && t.struct.type === 'kiln') rows.push(['Kiln', `a dome of rock and clay. ${t.struct.fired || 0} pots fired here.`]);
  if (t.feature === 'bush' || t.feature === 'tree' || t.feature === 'sapling') rows.push(['Age', `${Math.floor((tick - (t.planted || 0)) / DAY)} days`]);
  if (t.garden) rows.push(['Garden', `planted by ${t.garden.name}. Rabbits like it too.`]);
  if (t.feature === 'sapling' && !saplingMayGrow(t)) rows.push(['Growth', 'held back. A tree here would close the only way through.']);
  if (t.struct && t.struct.type === 'stone') rows.push(['Offering stone', t.struct.offering ? `${t.struct.offering} berries left for the sprites` : 'empty. Berries left here at dusk are gone by morning.']);
  if (t.struct && t.struct.type === 'ward') rows.push(['Ward post', 'charred wood. Sprites will not come within nine tiles of the fire.']);
  if (t.feature === 'hollow'){ const g = groves.find(g => g.x === x && g.y === y); if (g) rows.push(['Grove', `${beings.filter(b => b.alive && b.species === 'sprite' && b.grove === g).length} sprites live here. Anger ${g.anger}${g.swarmUntil > tick ? ', and they are out for revenge' : ''}.`]); }
  if (t.struct && t.struct.type === 'rack') rows.push(['Drying rack', `meat hung here keeps. ${camp.stash.smoked} strips stored.`]);
  if (t.struct && t.struct.type === 'snare') rows.push(['Snare', t.struct.snare.catch ? 'holds a rabbit' : t.struct.snare.armed ? 'armed' : 'sprung, needs a stick']);
  if (t.struct && t.struct.type === 'pitfall') rows.push(['Deer pit', t.struct.pit.catch ? 'a deer lies in it' : 'covered with logs and cord, on a deer path. One deer in eight steps in.']);
  if (z === 0 && camp.stashTile && camp.stashTile[0] === x && camp.stashTile[1] === y) rows.push(['Stash', Object.entries(camp.stash).filter(([k, v]) => v > 0).map(([k, v]) => `${v} ${ITEMS[k].plural}`).join(', ') || 'empty']);
  rows.push(['Burns', t.fire > 0 ? `yes, ${t.fire} ticks left` : tileFuel(t) > 0 ? `flammability ${tileFlam(t).toFixed(2)}, fuel ${tileFuel(t)}` : 'no']);
  const who = beings.filter(a => a.alive && a.x === x && a.y === y && a.z === z).map(a => a.name); if (who.length) rows.push(['Here', who.join(', ')]);
  camp = saved;
  return `<table class="kv">${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
}
function renderTip(){
  const tip = $('tip');
  if (!tipTarget || !tipAnchor){ tip.hidden = true; return; }
  const oldHist = tip.querySelector('.hist'), scroll = oldHist ? oldHist.scrollTop : 0;
  const body = tipTarget.being ? inspectBeing(beingById(tipTarget.being))
    : tipTarget.sector ? '<div class="muted">' + sectorSummary(sectors[secIdx(tipTarget.sector.sx, tipTarget.sector.sy)]) + '</div>'
    : inspectTile(tipTarget.tile[0], tipTarget.tile[1], tipTarget.tile[2]);
  tip.innerHTML = body;
  const nh = tip.querySelector('.hist'); if (nh) nh.scrollTop = scroll;
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight, gap = 14, vw = window.innerWidth, vh = window.innerHeight;
  let { x, y, left } = tipAnchor;
  let px = left ? x - w - gap : x + gap;
  if (px + w > vw - 8) px = x - w - gap; if (px < 8) px = Math.min(vw - w - 8, x + gap);
  const py = clamp(left ? y : y + gap, 8, Math.max(8, vh - h - 8));
  tip.style.left = Math.max(8, px) + 'px'; tip.style.top = py + 'px';
}
function hideTip(){ tipTarget = null; tipAnchor = null; renderTip(); }
const targetForCell = c => { const a = beings.find(a => a.alive && a.x === c.x && a.y === c.y && a.z === c.z) || beings.find(a => !a.alive && a.species === 'human' && a.x === c.x && a.y === c.y && a.z === c.z); return a ? { being: a.id, cell: [c.x, c.y, c.z] } : { tile: [c.x, c.y, c.z], cell: [c.x, c.y, c.z] }; };
function pinCell(c, e){
  const t = targetForCell(c);
  const w = winOpen('inspect', t.being != null ? { being: t.being } : { tile: t.tile });
  ui.focus = `window:${w.id}`; hideTip(); persist(); renderUI(true);
}
function tipForCell(c, e){
  const same = tipTarget && tipTarget.cell && tipTarget.cell[0] === c.x && tipTarget.cell[1] === c.y && tipTarget.cell[2] === c.z;
  if (!same) tipTarget = targetForCell(c);
  tipAnchor = { x: e.clientX, y: e.clientY, left: false }; renderTip();
}
