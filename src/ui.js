/* ============================================================
   INTERFACE. Reads the simulation state and draws it.
   ============================================================ */
const T = 26, WS = 3, MS = 9;
/* The three views, and the order M walks them: sector, nearby, world, sector. */
const NEXT_VIEW = { loc: 'mid', mid: 'world', world: 'loc' };
const VIEW_LABEL = { loc: 'Sector', mid: 'Nearby', world: 'World map' };
const TOOLS = [
  { id: 'inspect', key: 'i', label: 'Inspect',   hint: 'Point at a person, an animal, or a tile. Click to pin the details open.' },
  { id: 'light',   key: 'f', label: 'Light',     hint: 'Click the fire pit to light it. Click anything else, and you start a wildfire. The hover card shows what will burn.' },
  { id: 'camp',    key: 'c', label: 'Camp site', hint: 'Click open ground to move the camp site. Only until the pit is built.' },
  { id: 'poke',    key: 'p', label: 'Poke',      hint: 'Click a person to make them drop what they are doing and think again. Click an animal to startle it.' },
];
const TRAIT_WORDS = { bravery: ['timid','steady','brave'], sociability: ['solitary','easygoing','outgoing'], diligence: ['lazy','average worker','hard-working'], temper: ['calm','even-tempered','hot-tempered'], curiosity: ['set in their ways','curious enough','always asking'], patience: ['restless','patient enough','very patient'], hardiness: ['frail','sturdy','tough as roots'] };
const NEED_LABEL = { food: 'Food', water: 'Water', rest: 'Rest', social: 'Company', warmth: 'Warmth', glow: 'Glow', play: 'Mischief' };
let viewCamp = null;
let lvl = 0;
let cv, ctx, wcv, wctx, mcv, mctx, ocv, octx, dpr, P = {}, tool = 'inspect', view = 'world', cur = { sx: SW >> 1, sy: SH >> 1 }, followId = null;
let hover = null, whover = null, mhover = null, tipTarget = null, tipAnchor = null, tipPinned = false;
let speed = 1, paused = false, acc = 0, last = 0, lastUi = 0, chronKey = '', worldDirty = 0;
const $ = id => document.getElementById(id);

function readPalette(){
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['sprite','deer','wolf','rain','snow','grass','grass-fg','soil','sand','ash','ash-fg','water','water-fg','tree','bush','berry','reeds','boulder','boulder-fg','stick','rock','carcass','fire-bg','fire','fire2','pit','snare','stash','night','halo','select','rabbit','fox','corpse','grid','hill','hill-fg','stone','stone-fg']) P[k] = cs.getPropertyValue('--map-' + k).trim();
  P.agentL = cs.getPropertyValue('--agent-light').trim(); P.void = cs.getPropertyValue('--panel').trim(); worldDirty = 0;
}
const beingColor = a => a.species === 'human' ? `hsl(${a.hue} 65% ${P.agentL})` : a.species === 'rabbit' ? P.rabbit : a.species === 'deer' ? P.deer : a.species === 'wolf' ? P.wolf : a.species === 'sprite' ? P.sprite : P.fox;
function hash(x, y){ let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
function darkness(){ const h = hourOf(); if (h >= 7 && h < 19) return 0; if (h >= 19 && h < 21) return (h - 19) / 2 * 0.45; if (h >= 5 && h < 7) return (7 - h) / 2 * 0.45; return 0.45; }
function tileColor(t){
  if (t.fire > 0) return P.fire;
  if (t.struct && t.struct.type === 'firepit') return t.struct.lit ? P.fire2 : P.pit;
  if (t.feature === 'tree') return P.tree; if (t.feature === 'boulder') return P.boulder; if (t.feature === 'bush') return t.berries ? P.berry : P.bush; if (t.feature === 'reeds') return P.reeds;
  return P[t.ground] || P.stone;
}

/* ---- world view: whole map at 3 px per tile, cached ---- */
function drawWorldCache(){
  octx.setTransform(1, 0, 0, 1, 0, 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const i = idx(x, y), t = world[i]; let c = tileColor(t);
    if (t.ground === 'rock'){ const up = levels[ZOFF + 1][i]; c = up && up.ground === 'rock' ? P['hill-fg'] : P.hill; }
    if (t.mouth) c = P['hill-fg'];
    octx.fillStyle = c; octx.fillRect(x * WS, y * WS, WS, WS);
  }
}
function drawWorld(){
  if (tick - worldDirty > 40 || worldDirty === 0){ drawWorldCache(); worldDirty = tick; }
  wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wctx.drawImage(ocv, 0, 0);
  const dark = darkness(); if (dark > 0){ wctx.fillStyle = `rgba(${P.night},${dark * 0.8})`; wctx.fillRect(0, 0, W * WS, H * WS); }
  wctx.strokeStyle = P.grid; wctx.lineWidth = 1;
  for (let sx = 1; sx < SW; sx++){ wctx.beginPath(); wctx.moveTo(sx * LW * WS + 0.5, 0); wctx.lineTo(sx * LW * WS + 0.5, H * WS); wctx.stroke(); }
  for (let sy = 1; sy < SH; sy++){ wctx.beginPath(); wctx.moveTo(0, sy * LH * WS + 0.5); wctx.lineTo(W * WS, sy * LH * WS + 0.5); wctx.stroke(); }
  for (const b of beings){ if (!b.alive) continue; wctx.fillStyle = beingColor(b); const r = b.species === 'human' ? 3 : 1.5; wctx.beginPath(); wctx.arc(b.x * WS + 1.5, b.y * WS + 1.5, r, 0, 7); wctx.fill(); }
  for (const c of camps) if (c.site){ const [x, y] = c.site; wctx.strokeStyle = c === viewCamp ? P.select : P.grid; wctx.lineWidth = 1.5; wctx.strokeRect(x * WS - 4.5, y * WS - 4.5, 12, 12); }
  if (isWinter()){ wctx.fillStyle = P.snow; wctx.globalAlpha = 0.28; wctx.fillRect(0, 0, W * WS, H * WS); wctx.globalAlpha = 1; }
  const s = whover || (followId ? null : cur);
  if (s){ wctx.strokeStyle = P.select; wctx.lineWidth = 2; wctx.strokeRect(s.sx * LW * WS + 1, s.sy * LH * WS + 1, LW * WS - 2, LH * WS - 2); }
}
function sectorSummary(s){
  const sticks = looseCount('stick')(s), rocks = looseCount('rock')(s);
  const bushes = sectorCount(s, 'bushes', t => t.feature === 'bush');
  const water = sectorCount(s, 'water', t => t.ground === 'water');
  const hs = hills.filter(h => secOf(h.x, h.y).sx === s.sx && secOf(h.x, h.y).sy === s.sy);
  const cs = caves.filter(c => c.exit && secOf(c.exit.x, c.exit.y).sx === s.sx && secOf(c.exit.x, c.exit.y).sy === s.sy);
  const people = beings.filter(b => b.alive && b.species === 'human' && secOf(b.x, b.y).sx === s.sx && secOf(b.x, b.y).sy === s.sy);
  const animals = beings.filter(b => b.alive && b.species !== 'human' && secOf(b.x, b.y).sx === s.sx && secOf(b.x, b.y).sy === s.sy);
  const parts = [`${sticks} sticks`, `${rocks} rocks`, `${bushes} berry bushes`, water ? 'water' : 'no water', hs.length ? `${hs.length} hill${hs.length > 1 ? 's' : ''}` : '', cs.length ? `${cs.length} cave mouth${cs.length > 1 ? 's' : ''}` : ''];
  if (animals.length) parts.push(animals.map(a => SPECIES[a.species].label).sort().join(', '));
  if (people.length) parts.push(people.map(p => p.name).join(', '));
  for (const c of camps) if (c.site && secOf(...c.site).sx === s.sx && secOf(...c.site).sy === s.sy) parts.unshift(c.pit ? `${c.name} and its hearth` : `the site of ${c.name}, not yet built`);
  return `${s.name}, sector ${s.sx},${s.sy}: ${parts.filter(Boolean).join('; ')}.`;
}

/* ---- nearby view: the sector and its eight neighbours, from the world cache at 9 px per tile ---- */
const midOrigin = () => ({ ox: (cur.sx - 1) * LW, oy: (cur.sy - 1) * LH });
function drawMid(){
  if (tick - worldDirty > 40 || worldDirty === 0){ drawWorldCache(); worldDirty = tick; }
  const { ox, oy } = midOrigin(), MW = 3 * LW * MS, MH = 3 * LH * MS;
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0); mctx.imageSmoothingEnabled = false;
  mctx.fillStyle = P.void; mctx.fillRect(0, 0, MW, MH);
  const x0 = Math.max(0, ox), y0 = Math.max(0, oy), x1 = Math.min(W, ox + 3 * LW), y1 = Math.min(H, oy + 3 * LH);
  mctx.drawImage(ocv, x0 * WS, y0 * WS, (x1 - x0) * WS, (y1 - y0) * WS, (x0 - ox) * MS, (y0 - oy) * MS, (x1 - x0) * MS, (y1 - y0) * MS);
  const dark = darkness(); if (dark > 0){ mctx.fillStyle = `rgba(${P.night},${dark * 0.8})`; mctx.fillRect((x0 - ox) * MS, (y0 - oy) * MS, (x1 - x0) * MS, (y1 - y0) * MS); }
  mctx.strokeStyle = P.grid; mctx.lineWidth = 1;
  for (let k = 1; k < 3; k++){ mctx.beginPath(); mctx.moveTo(k * LW * MS + 0.5, 0); mctx.lineTo(k * LW * MS + 0.5, MH); mctx.moveTo(0, k * LH * MS + 0.5); mctx.lineTo(MW, k * LH * MS + 0.5); mctx.stroke(); }
  mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.font = `700 ${MS + 2}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  for (const a of beings){
    if (!a.alive || a.x < ox || a.x >= ox + 3 * LW || a.y < oy || a.y >= oy + 3 * LH) continue;
    const px = (a.x - ox) * MS + MS / 2, py = (a.y - oy) * MS + MS / 2 + 1, glyph = a.asleep ? 'z' : SPECIES[a.species].glyph;
    if (a.species === 'human'){ mctx.lineWidth = 2; mctx.strokeStyle = P.halo; mctx.strokeText(glyph, px, py); }
    mctx.fillStyle = beingColor(a); mctx.fillText(glyph, px, py);
  }
  for (const c of camps) if (c.site){ const [x, y] = c.site; if (x < ox || x >= ox + 3 * LW || y < oy || y >= oy + 3 * LH) continue; mctx.strokeStyle = c === viewCamp ? P.select : P.grid; mctx.lineWidth = 1.5; mctx.strokeRect((x - ox) * MS - 4.5, (y - oy) * MS - 4.5, MS + 9, MS + 9); }
  if (isWinter()){ mctx.fillStyle = P.snow; mctx.globalAlpha = 0.28; mctx.fillRect((x0 - ox) * MS, (y0 - oy) * MS, (x1 - x0) * MS, (y1 - y0) * MS); mctx.globalAlpha = 1; }
  mctx.strokeStyle = P.select; mctx.lineWidth = 2; mctx.strokeRect(LW * MS + 1, LH * MS + 1, LW * MS - 2, LH * MS - 2);
  if (mhover){ mctx.globalAlpha = 0.5; mctx.strokeRect((mhover.sx - cur.sx + 1) * LW * MS + 1, (mhover.sy - cur.sy + 1) * LH * MS + 1, LW * MS - 2, LH * MS - 2); mctx.globalAlpha = 1; }
}

/* ---- location view ---- */
function drawLoc(){
  const ox = cur.sx * LW, oy = cur.sy * LH;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `500 ${T - 6}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  const fires = [];
  for (let ly = 0; ly < LH; ly++) for (let lx = 0; lx < LW; lx++){
    const x = ox + lx, y = oy + ly, px = lx * T, py = ly * T, h = hash(x, y);
    let t = tileAt(x, y, lvl), below = 0;
    while (!t && lvl - below > 0){ below++; t = tileAt(x, y, lvl - below); }
    if (!t){ ctx.fillStyle = P.hill; ctx.fillRect(px, py, T, T); if (h % 3 === 0){ ctx.fillStyle = P['hill-fg']; ctx.fillText('▒', px + T / 2, py + T / 2 + 1); } continue; }
    let bg = P[t.ground] || P.stone, g = null, fg = null;
    if (t.ground === 'grass' && h % 4 === 0){ g = '"'; fg = P['grass-fg']; }
    if (t.ground === 'ash' && h % 2 === 0){ g = ','; fg = P['ash-fg']; }
    if (t.ground === 'water'){ g = (h + Math.floor(tick / 25)) % 4 === 0 ? '≈' : '~'; fg = P['water-fg']; }
    if (t.ground === 'rock'){ bg = P.hill; if (h % 3 === 0){ g = '▒'; fg = P['hill-fg']; } }
    if (t.ground === 'stone'){ bg = P.stone; if (h % 5 === 0){ g = '·'; fg = P['stone-fg']; } }
    if (t.mouth && t.z === 0){ g = '◠'; fg = P['hill-fg']; }
    if (t.feature === 'tree'){ g = '♣'; fg = P.tree; } else if (t.feature === 'sapling'){ g = 'ʌ'; fg = P.tree; } else if (t.feature === 'hollow'){ g = '♠'; fg = P.sprite; } else if (t.feature === 'bush'){ g = '*'; fg = t.berries > 0 ? P.berry : P.bush; }
    else if (t.feature === 'boulder'){ bg = P.boulder; g = '#'; fg = P['boulder-fg']; } else if (t.feature === 'reeds'){ g = '"'; fg = P.reeds; }
    const it = itemAt(x, y, t.z);
    if (it && !t.feature){ g = it.kind === 'stick' ? '/' : it.kind === 'rock' ? 'o' : it.kind === 'log' ? '=' : '%'; fg = it.kind === 'stick' || it.kind === 'log' ? P.stick : it.kind === 'rock' ? P.rock : P.carcass; }
    if (t.struct){
      if (t.struct.type === 'firepit'){ bg = P.pit; g = t.struct.lit ? null : (t.struct.fuel > 0 ? '≡' : '○'); fg = t.struct.fuel > 0 ? P.stick : P.rock; }
      else if (t.struct.type === 'leanto'){ bg = P.pit; g = '⌂'; fg = P.stick; }
      else if (t.struct.type === 'hut'){ bg = P.pit; g = '⌂'; fg = P.snare; }
      else if (t.struct.type === 'storehouse'){ bg = P.pit; g = '▦'; fg = P.stick; }
      else if (t.struct.type === 'workshop'){ bg = P.pit; g = '⊞'; fg = P.stick; }
      else if (t.struct.type === 'kiln'){ bg = P.pit; g = '⌓'; fg = P.rock; }
      else if (t.struct.type === 'stone'){ g = '⊙'; fg = t.struct.offering ? P.berry : P.rock; }
      else if (t.struct.type === 'ward'){ g = 'ǂ'; fg = P['ash-fg']; }
      else if (t.struct.type === 'rack'){ bg = P.pit; g = 'Ξ'; fg = P.stick; }
      else if (t.struct.type === 'pitfall'){ g = '⊔'; fg = t.struct.pit.catch ? P.carcass : P.stick; }
      else { g = '∩'; fg = t.struct.snare.catch ? P.carcass : t.struct.snare.armed ? P.snare : P['ash-fg']; }
    }
    ctx.fillStyle = bg; ctx.fillRect(px, py, T, T);
    if (t.z === 0 && camps.some(c => c.stashTile && c.stashTile[0] === x && c.stashTile[1] === y)){ ctx.fillStyle = P.stash; ctx.fillRect(px + 2, py + 2, T - 4, T - 4); if (!g){ g = '▤'; fg = P.stick; } }
    if (t.fire > 0 || (t.struct && t.struct.type === 'firepit' && t.struct.lit)) fires.push([lx, ly, x, y]);
    else if (g){ ctx.fillStyle = fg; ctx.fillText(g, px + T / 2, py + T / 2 + 1); }
    if (t.slope){
      const up = DIRS.find(([dx, dy]) => passable(x + dx, y + dy, t.z + 1)) || [1, 0];
      ctx.fillStyle = P['hill-fg']; ctx.globalAlpha = 0.55; ctx.beginPath();
      const cx = px + T / 2, cy = py + T / 2, hx = cx + up[0] * T / 2, hy = cy + up[1] * T / 2;
      ctx.moveTo(hx + up[1] * T / 2, hy + up[0] * T / 2); ctx.lineTo(hx - up[1] * T / 2, hy - up[0] * T / 2); ctx.lineTo(cx - up[0] * T / 2, cy - up[1] * T / 2); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (below > 0){ ctx.fillStyle = P.halo; ctx.globalAlpha = 0.45; ctx.fillRect(px, py, T, T); ctx.globalAlpha = 1; }
  }
  for (const c of camps) if (lvl === 0 && c.site && !c.pit && secOf(...c.site).sx === cur.sx && secOf(...c.site).sy === cur.sy){
    const [x, y] = c.site; ctx.strokeStyle = P.select; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.strokeRect((x - ox) * T + 2, (y - oy) * T + 2, T - 4, T - 4); ctx.setLineDash([]);
  }
  { ctx.fillStyle = P.corpse; for (const c of corpses){ if (c.x >= ox && c.x < ox + LW && c.y >= oy && c.y < oy + LH && c.z === lvl) ctx.fillText('x', (c.x - ox) * T + T / 2, (c.y - oy) * T + T / 2 + 1); } }
  const dark = darkness(); if (dark > 0){ ctx.fillStyle = `rgba(${P.night},${dark})`; ctx.fillRect(0, 0, LW * T, LH * T); }
  if (isWinter()){ ctx.fillStyle = P.snow; ctx.globalAlpha = 0.22; ctx.fillRect(0, 0, LW * T, LH * T); ctx.globalAlpha = 1; }
  if (weather.storm){ ctx.strokeStyle = P.rain; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 90; k++){ const x = (hash(k, 3) % (LW * T)), y = ((hash(k, 7) + tick * 9) % (LH * T)); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9); } ctx.stroke(); ctx.globalAlpha = 1; }
  for (const c of camps) if (lvl === 0 && c.pit && tileAt(...c.pit).struct.lit && dark > 0){ const [px, py] = c.pit; if (secOf(px, py).sx === cur.sx && secOf(px, py).sy === cur.sy){ const gr = ctx.createRadialGradient((px - ox) * T + T / 2, (py - oy) * T + T / 2, 4, (px - ox) * T + T / 2, (py - oy) * T + T / 2, T * 4); gr.addColorStop(0, `rgba(255,180,90,${dark * 0.9})`); gr.addColorStop(1, 'rgba(255,180,90,0)'); ctx.fillStyle = gr; ctx.fillRect((px - ox) * T - T * 4, (py - oy) * T - T * 4, T * 9, T * 9); } }
  for (const [lx, ly, x, y] of fires){
    const fl = (tick + hash(x, y)) % 3;
    ctx.globalAlpha = 0.7 + 0.15 * fl; ctx.fillStyle = P['fire-bg']; ctx.fillRect(lx * T, ly * T, T, T); ctx.globalAlpha = 1;
    ctx.fillStyle = fl === 1 ? P.fire2 : P.fire; ctx.fillText(fl === 2 ? '^' : '▲', lx * T + T / 2, ly * T + T / 2 + 1);
  }
  ctx.font = `700 ${T - 4}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  for (const a of beings){
    if (!a.alive || a.x < ox || a.x >= ox + LW || a.y < oy || a.y >= oy + LH) continue;
    if (a.z !== lvl && !(a.z < lvl && !tileAt(a.x, a.y, lvl))) continue;
    ctx.globalAlpha = a.z === lvl ? 1 : 0.5;
    const px = (a.x - ox) * T + T / 2, py = (a.y - oy) * T + T / 2 + 1, glyph = a.asleep ? 'z' : SPECIES[a.species].glyph;
    ctx.lineWidth = 3; ctx.strokeStyle = P.halo; ctx.strokeText(glyph, px, py);
    ctx.fillStyle = beingColor(a); ctx.fillText(glyph, px, py);
    if (a.carrying){ ctx.fillStyle = a.carrying.kind === 'rock' ? P.rock : a.carrying.kind === 'stick' || a.carrying.kind === 'spear' || a.carrying.kind === 'log' ? P.stick : a.carrying.kind === 'berries' ? P.berry : a.carrying.kind === 'ember' ? P.fire : a.carrying.kind === 'water' ? P['water-fg'] : P.carcass; ctx.fillRect((a.x - ox) * T + T - 7, (a.y - oy) * T + 2, 5, 5); }
    if (tipTarget && tipTarget.being === a.id){ ctx.strokeStyle = P.select; ctx.lineWidth = 1.5; ctx.strokeRect((a.x - ox) * T + 0.75, (a.y - oy) * T + 0.75, T - 1.5, T - 1.5); }
  }
  ctx.globalAlpha = 1;
  if (hover){ ctx.strokeStyle = P.select; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.strokeRect(hover.lx * T + 0.5, hover.ly * T + 0.5, T - 1, T - 1); ctx.globalAlpha = 1; }
}
function draw(){ if (view === 'world') drawWorld(); else if (view === 'mid') drawMid(); else drawLoc(); }

/* ---- inspection ---- */
function bar(v, color){ return `<span class="bar"><i style="width:${clamp(v, 0, 100)}%;background:${color}"></i></span>`; }
const needColor = v => v < 25 ? 'var(--bad)' : v < 50 ? 'var(--warn)' : 'var(--good)';
function moodWord(a, m){ if (!a.alive) return 'Dead'; return m >= 65 ? 'Happy' : m >= 45 ? 'Content' : m >= 30 ? 'Uneasy' : m >= 15 ? 'Unhappy' : 'Miserable'; }
function traitWord(k, v){ const w = TRAIT_WORDS[k]; return v < 0.3 ? w[0] : v > 0.7 ? w[2] : w[1]; }
function inspectBeing(a){
  const m = mood(a), sp = SPECIES[a.species];
  const need = (k, v) => `<div class="need"><span>${NEED_LABEL[k]}</span>${bar(v, needColor(v))}<span class="num">${Math.round(v)}</span></div>`;
  const thoughts = a.thoughts.slice().sort((x, y) => Math.abs(y.value) - Math.abs(x.value)).slice(0, 4).map(t => `<li class="${t.value >= 0 ? 'pos' : 'neg'}"><b>${t.value > 0 ? '+' : ''}${t.value}</b> ${t.text}</li>`).join('') || '<li class="muted">No strong thoughts right now.</li>';
  const why = a.lastChoice ? `<div class="why">${a.lastChoice.opts.slice(0, 6).map(o => { const k = o.label || o.type; return `<span class="${k === a.lastChoice.picked ? 'picked' : o.failed ? 'failed' : ''}">${k} ${o.score}</span>`; }).join('')}</div>` : '<span class="muted">No decision yet.</span>';
  const hist = a.history.slice(0, tipPinned ? 30 : 2).map(e => `<li><span class="muted">${e.when}</span> ${e.text}</li>`).join('');
  const s = secOf(a.x, a.y);
  let extra = '';
  if (a.species === 'human'){
    const rels = beings.filter(o => o !== a && a.rel[o.id]).map(o => `${o.name} (${a.rel[o.id]}, ${a.opinions[o.id] > 0 ? '+' : ''}${a.opinions[o.id]})`).join(', ') || 'No friends or rivals yet.';
    extra = `${a.inDark ? '<div class="muted">In the dark without a brand.</div>' : ''}<h3>Personality</h3><div class="chips">${Object.entries(a.traits).map(([k, v]) => `<span class="chip" title="${k} ${v}">${traitWord(k, v)}</span>`).join('')}${a.clothes ? '<span class="chip">wearing hide clothes</span>' : ''}</div><h3>Skills</h3><div class="chips">${Object.entries(a.skills).filter(([k, v]) => v > 0).map(([k, v]) => `<span class="chip">${k} ${v}</span>`).join('') || '<span class="muted">Nothing yet. Skills come from work, and from elders by the fire.</span>'}</div><h3>Relationships</h3><div>${rels}</div>`;
  } else {
    const habit = { rabbit: 'eats at dawn and dusk', deer: 'grazes at dawn and dusk, keeps to the herd', fox: 'hunts rabbits by night', wolf: 'hunts by night, raids dark camps', sprite: 'sleeps in a hollow pine by day, dances and meddles by night' }[a.species];
    const learned = [a.skills.wary ? `wary ${a.skills.wary}` : '', a.skills.hunt ? `hunter ${a.skills.hunt}` : ''].filter(Boolean);
    extra = `<h3>Nature and learning</h3><div class="chips"><span class="chip">${traitWord('bravery', a.traits.bravery)}</span>${a.species === 'deer' ? `<span class="chip">${traitWord('sociability', a.traits.sociability)}</span>` : ''}<span class="chip">${habit}</span>${learned.map(l => `<span class="chip">${l}</span>`).join('')}${drowsy(a) ? '<span class="chip">resting hours</span>' : ''}${a.grove ? `<span class="chip">grove in ${a.grove.sector.name.toLowerCase()} ${a.grove.sector.sx},${a.grove.sector.sy}, anger ${a.grove.anger}</span>` : ''}${a.den ? `<span class="chip">den under the hill at ${a.den.hill.x},${a.den.hill.y}</span>` : ''}</div>`;
  }
  const follow = tipPinned && a.alive ? `<button class="btn small" data-follow="${a.id}">${followId === a.id ? 'Stop following' : 'Follow'}</button>` : '';
  return `<div class="head"><strong style="color:${beingColor(a)}">${a.name}</strong><span>${moodWord(a, m)} (${m})</span></div>
    <div class="muted" style="margin:1px 0 5px">${stage(a) === 'young' ? 'Young, ' : stage(a) === 'old' ? 'Old, ' : ''}${Math.floor(ageDays(a))} days. ${a.alive ? a.status : 'Dead'}${a.carrying ? `, carrying ${a.carrying.count} ${a.carrying.count > 1 ? ITEMS[a.carrying.kind].plural : ITEMS[a.carrying.kind].name}` : ''}. Health ${Math.round(Math.max(0, a.hp))}. In ${sectors[secIdx(s.sx, s.sy)].name.toLowerCase()} at ${a.x - s.sx * LW},${a.y - s.sy * LH}.${a.camp && camps.length > 1 ? ` Belongs to ${a.camp.name}.` : ''} ${follow}</div>
    ${Object.entries(a.needs).map(([k, v]) => need(k, v)).join('')}${extra}
    <h3>Thoughts</h3><ul>${thoughts}</ul>
    <h3>Last decision (highest score wins)</h3>${why}
    ${hist ? `<h3>${tipPinned ? 'Personal history' : 'Recent history'}</h3><ul class="hist">${hist}</ul>` : ''}`;
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
  if (t.hill) rows.push(['Hill', `${t.hill.storeys === 2 ? 'A tall hill' : 'A low hill'} of old stone, ${t.hill.storeys === 2 ? 'two storeys' : 'one storey'} high. Cliffs all round but for the slopes.`]);
  if (GROUND[t.ground].quarry) rows.push(['Rock face', t.quarried ? 'quarried. Rocks come from here.' : 'rocks can be quarried here with the axe.']);
  if (t.slope) rows.push(['Slope', `a way up to ${levelName(z + 1).toLowerCase()}.`]);
  if (t.mouth) rows.push(['Cave mouth', `a way ${t.mouth.mouth.z === 0 ? 'in' : 'down'}. ${t.mouth.story.join(' ')}`]);
  if (t.cave) rows.push([t.cave.kind === 'den' ? 'Den' : t.cave.kind === 'hollow' ? 'Hollow' : 'Cave', `${t.cave.story.join(' ')}${t.cave.owner ? ` ${t.cave.owner === 'sprite' ? 'Sprites' : t.cave.owner === 'wolf' ? 'Wolves' : 'Foxes'} live here.` : ''}`]);
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
  if (t.struct && t.struct.type === 'pitfall') rows.push(['Deer pit', t.struct.pit.catch ? 'a deer lies in it' : 'covered with logs and cord. One deer in eight steps in.']);
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
  const close = tipPinned ? '<button class="close" data-close aria-label="Close">×</button>' : '';
  tip.innerHTML = close + (tipTarget.being ? inspectBeing(beingById(tipTarget.being)) : inspectTile(tipTarget.tile[0], tipTarget.tile[1], tipTarget.tile[2]));
  const nh = tip.querySelector('.hist'); if (nh) nh.scrollTop = scroll;
  tip.classList.toggle('pinned', tipPinned); tip.setAttribute('role', tipPinned ? 'dialog' : 'tooltip'); tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight, gap = 14, vw = window.innerWidth, vh = window.innerHeight;
  let { x, y, left } = tipAnchor;
  let px = left ? x - w - gap : x + gap;
  if (px + w > vw - 8) px = x - w - gap; if (px < 8) px = Math.min(vw - w - 8, x + gap);
  const py = clamp(left ? y : y + gap, 8, Math.max(8, vh - h - 8));
  tip.style.left = Math.max(8, px) + 'px'; tip.style.top = py + 'px';
}
function hideTip(){ tipTarget = null; tipAnchor = null; tipPinned = false; renderTip(); }
const targetForCell = c => { const a = beings.find(a => a.alive && a.x === c.x && a.y === c.y && a.z === c.z) || beings.find(a => !a.alive && a.species === 'human' && a.x === c.x && a.y === c.y && a.z === c.z); return a ? { being: a.id, cell: [c.x, c.y, c.z] } : { tile: [c.x, c.y, c.z], cell: [c.x, c.y, c.z] }; };
function pinCell(c, e){
  const t = targetForCell(c);
  const same = tipPinned && tipTarget && (t.being ? tipTarget.being === t.being : tipTarget.tile && tipTarget.tile[0] === c.x && tipTarget.tile[1] === c.y && tipTarget.tile[2] === c.z);
  if (same){ hideTip(); return; }
  tipTarget = t; tipAnchor = { x: e.clientX, y: e.clientY, left: false }; tipPinned = true; renderTip();
}
function tipForCell(c, e){
  if (tipPinned) return;
  const same = tipTarget && tipTarget.cell && tipTarget.cell[0] === c.x && tipTarget.cell[1] === c.y && tipTarget.cell[2] === c.z;
  if (!same) tipTarget = targetForCell(c);
  tipAnchor = { x: e.clientX, y: e.clientY, left: false }; renderTip();
}

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
function say(msg){ $('hint').textContent = msg; }
function setTool(id){ tool = id; document.querySelectorAll('#tools .btn').forEach(b => { const on = b.dataset.tool === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); say(TOOLS.find(t => t.id === id).hint); if (tipPinned) hideTip(); }
function setSpeed(s){ speed = s; document.querySelectorAll('#speeds .btn').forEach(b => b.classList.toggle('on', Number(b.dataset.speed) === s)); }
function setPaused(p){ paused = p; $('pause').textContent = p ? 'Resume' : 'Pause'; $('pause').classList.toggle('on', p); }
function setLevel(z){ lvl = clamp(z, ZMIN, ZMAX); hideTip(); hover = null; renderUI(true); }
const levelName = z => z === 0 ? 'Surface' : z > 0 ? `Level +${z}` : `Level ${z}`;
function setView(v, s){
  view = v; if (s) cur = { sx: s.sx, sy: s.sy }; hideTip(); hover = null; whover = null; mhover = null;
  $('world').hidden = v !== 'world'; $('loc').hidden = v !== 'loc'; $('mid').hidden = v !== 'mid';
  $('viewBtn').innerHTML = `${VIEW_LABEL[NEXT_VIEW[v]]}<kbd>M</kbd>`;
  if (v === 'world') say('Click a sector to go there. Point at one to see what it holds.');
  else if (v === 'mid') say('The sector and its eight neighbours. Arrow keys move. Click a sector to go there.');
  else say(TOOLS.find(t => t.id === tool).hint);
  renderUI(true);
}
function goto(sx, sy){ if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return; followId = null; setView('loc', { sx, sy }); }
/* Step to a neighbouring sector and keep the view. From the world map it opens the sector. */
function move(dx, dy){ const sx = cur.sx + dx, sy = cur.sy + dy; if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return; followId = null; setView(view === 'world' ? 'loc' : view, { sx, sy }); }
function cycleView(){ followId = null; setView(NEXT_VIEW[view]); }
function randomSeed(){ const a = ['amber','birch','cinder','dusk','ember','fern','gravel','hollow','iron','juniper','kestrel','lichen','moss','nettle','oak','pine'], b = ['brook','crag','dale','fen','ford','glen','hill','marsh','moor','ridge','vale','wold']; return `${a[Math.floor(Math.random() * a.length)]}-${b[Math.floor(Math.random() * b.length)]}-${Math.floor(Math.random() * 100)}`; }
function cellFrom(e){ const r = cv.getBoundingClientRect(); const lx = clamp(Math.floor((e.clientX - r.left) / r.width * LW), 0, LW - 1), ly = clamp(Math.floor((e.clientY - r.top) / r.height * LH), 0, LH - 1); return { lx, ly, x: cur.sx * LW + lx, y: cur.sy * LH + ly, z: lvl }; }
function sectorFromMid(e){ const r = mcv.getBoundingClientRect(), { ox, oy } = midOrigin(); const s = secOf(ox + Math.floor((e.clientX - r.left) / r.width * 3 * LW), oy + Math.floor((e.clientY - r.top) / r.height * 3 * LH)); return s.sx >= 0 && s.sy >= 0 && s.sx < SW && s.sy < SH ? s : null; }
function sectorFrom(e){ const r = wcv.getBoundingClientRect(); return { sx: clamp(Math.floor((e.clientX - r.left) / r.width * SW), 0, SW - 1), sy: clamp(Math.floor((e.clientY - r.top) / r.height * SH), 0, SH - 1) }; }
function newWorld(seed){ startWorld(seed); viewCamp = camps[0]; $('seed').value = seedText; followId = null; lvl = 0; worldDirty = 0; acc = 0; const a = beings[0]; setView('loc', secOf(a.x, a.y)); }
function applyTool(c, e){
  switch (tool){
    case 'inspect': pinCell(c, e); break;
    case 'light': say(lightTile(c.x, c.y, c.z)); camp = viewCamp; break;
    case 'camp': {
      if (camp.pit){ say('The fire pit is already built. The camp stays where it is.'); break; }
      if (c.z !== 0){ say('The camp must be on the valley floor.'); break; }
      const t = tileAt(c.x, c.y); if (!passable(c.x, c.y) || t.feature){ say('The camp site must be open ground you can stand on.'); break; }
      camp = viewCamp; setSite(c.x, c.y); camp.siteReason = 'you chose it'; log('The camp site moves. Someone felt it was right.', humans()); say('Camp site set. The fire pit will go here.'); break; }
    case 'poke': { const a = beings.find(a => a.alive && a.x === c.x && a.y === c.y && a.z === c.z); say(a ? poke(a) : 'Nobody is there to poke.'); break; }
  }
  renderUI(true);
}
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
