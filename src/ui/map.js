/* Canvas drawing for all three views: world map, nearby sectors, and the sector in view. */

function readPalette(){
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['sprite','gnome','deer','wolf','rain','snow','grass','grass-fg','soil','sand','ash','ash-fg','water','water-fg','tree','bush','berry','reeds','boulder','boulder-fg','stick','rock','carcass','fire-bg','fire','fire2','pit','snare','stash','night','halo','select','rabbit','fox','god','corpse','grid','hill','hill-fg','stone','stone-fg']) P[k] = cs.getPropertyValue('--map-' + k).trim();
  for (const k of ['none','wet','dry','hot','cold','above','below','light','dark','still','moving','scar','line']) P['field-' + k] = cs.getPropertyValue('--field-' + k).trim();
  fieldKey = '';
  P.agentL = cs.getPropertyValue('--agent-light').trim(); P.void = cs.getPropertyValue('--panel').trim(); worldDirty = 0;
}
const beingColor = a => a.species === 'human' ? `hsl(${a.hue} 65% ${P.agentL})` : a.species === 'god' ? P.god : a.species === 'rabbit' ? P.rabbit : a.species === 'deer' ? P.deer : a.species === 'wolf' ? P.wolf : a.species === 'sprite' ? P.sprite : a.species === 'gnome' ? P.gnome : P.fox;
/* A sleeping being draws a `z`, but every god sleeps, and a god is not one more sleeper: it keeps its own star,
   so the thing lying in the hill reads as the god the legends name. */
const beingGlyph = a => a.asleep && a.species !== 'god' ? 'z' : SPECIES[a.species].glyph;
function hash(x, y){ let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
function darkness(){ const h = hourOf(); if (h >= 7 && h < 19) return 0; if (h >= 19 && h < 21) return (h - 19) / 2 * 0.45; if (h >= 5 && h < 7) return (7 - h) / 2 * 0.45; return 0.45; }
function tileColor(t){
  if (t.fire > 0) return P.fire;
  if (t.struct && t.struct.type === 'firepit') return t.struct.lit ? P.fire2 : P.pit;
  if (t.feature === 'tree') return P.tree; if (t.feature === 'deadpine') return P['ash-fg']; if (t.feature === 'boulder') return P.boulder; if (t.feature === 'bush') return t.berries ? P.berry : P.bush; if (t.feature === 'reeds') return P.reeds;
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
/* ---- the field: the world before it has tiles. One grey region, then boundaries, then poles as colour, then scars. ---- */
function drawBoundaries(g, alpha){
  for (const b of liveBoundaries()){
    g.fillStyle = b.pole === 'wet' ? P['water-fg'] : P['field-line']; g.globalAlpha = b.pole === 'wet' ? 1 : alpha;
    for (const i of b.tiles){ const x = i % W, y = (i - x) / W; g.fillRect(x * WS, y * WS, WS, WS); }
  }
  g.globalAlpha = 1;
}
function drawFieldCache(){
  octx.setTransform(1, 0, 0, 1, 0, 0);
  for (const r of liveRegions()){
    octx.fillStyle = fieldColor(r, P);
    for (const i of r.tiles){ const x = i % W, y = (i - x) / W; octx.fillRect(x * WS, y * WS, WS, WS); }
    if (marksOf(r, 'scar').length){ octx.fillStyle = P['field-scar']; for (const i of r.tiles){ const x = i % W, y = (i - x) / W; if ((x + y) % 4 === 0) octx.fillRect(x * WS, y * WS, WS, WS); } }
  }
  drawBoundaries(octx, 0.7);
}
function drawField(){
  const key = [seedText, age, creation.discards, liveRegions().length].join(':');
  if (key !== fieldKey){ drawFieldCache(); fieldKey = key; }
  wctx.setTransform(dpr, 0, 0, dpr, 0, 0); wctx.drawImage(ocv, 0, 0);
  /* A god has no tile in the ages. It is drawn in the middle of the country it stands in. Gods that share a country stand side by side. */
  const at = new Map();
  for (const g of gods()){ if (g.status === 'dead') continue; const r = standsIn(g); if (!r) continue; if (!at.has(r.id)) at.set(r.id, []); at.get(r.id).push(g); }
  wctx.textAlign = 'center'; wctx.textBaseline = 'middle';
  for (const [id, list] of at){
    const b = regionById(id).bbox, cx = (b.x0 + b.x1 + 1) / 2 * WS, cy = (b.y0 + b.y1 + 1) / 2 * WS;
    list.forEach((g, k) => {
      const x = cx + (k - (list.length - 1) / 2) * 46;
      wctx.globalAlpha = g.status === 'awake' ? 1 : 0.55;
      wctx.font = '700 18px "JetBrains Mono", ui-monospace, Menlo, monospace';
      wctx.lineWidth = 3; wctx.strokeStyle = P.halo; wctx.strokeText(SPECIES.god.glyph, x, cy); wctx.fillStyle = P.god; wctx.fillText(SPECIES.god.glyph, x, cy);
      wctx.font = '500 10px "JetBrains Mono", ui-monospace, Menlo, monospace';
      wctx.strokeText(g.name, x, cy + 14); wctx.fillStyle = P.select; wctx.fillText(g.name, x, cy + 14);
    });
  }
  wctx.globalAlpha = 1;
  wctx.fillStyle = P.select; wctx.fillRect(cursor.x * WS, cursor.y * WS, WS, WS);
}
function drawWorld(){
  if (inAges()){ drawField(); return; }
  if (tick - worldDirty > 40 || worldDirty === 0){ drawWorldCache(); worldDirty = tick; }
  wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wctx.drawImage(ocv, 0, 0);
  if (ui.overlay) drawBoundaries(wctx, 0.85);
  const dark = darkness(); if (dark > 0){ wctx.fillStyle = `rgba(${P.night},${dark * 0.8})`; wctx.fillRect(0, 0, W * WS, H * WS); }
  wctx.strokeStyle = P.grid; wctx.lineWidth = 1;
  for (let sx = 1; sx < SW; sx++){ wctx.beginPath(); wctx.moveTo(sx * LW * WS + 0.5, 0); wctx.lineTo(sx * LW * WS + 0.5, H * WS); wctx.stroke(); }
  for (let sy = 1; sy < SH; sy++){ wctx.beginPath(); wctx.moveTo(0, sy * LH * WS + 0.5); wctx.lineTo(W * WS, sy * LH * WS + 0.5); wctx.stroke(); }
  for (const b of beings){ if (!b.alive) continue; wctx.fillStyle = beingColor(b); const r = b.species === 'human' ? 3 : 1.5; wctx.beginPath(); wctx.arc(b.x * WS + 1.5, b.y * WS + 1.5, r, 0, 7); wctx.fill(); }
  for (const c of camps) if (c.site){ const [x, y] = c.site; wctx.strokeStyle = c === viewCamp ? P.select : P.grid; wctx.lineWidth = 1.5; wctx.strokeRect(x * WS - 4.5, y * WS - 4.5, 12, 12); }
  if (isWinter()){ wctx.fillStyle = P.snow; wctx.globalAlpha = 0.28; wctx.fillRect(0, 0, W * WS, H * WS); wctx.globalAlpha = 1; }
  const s = whover || (followId ? null : cur);
  if (s){ wctx.strokeStyle = P.select; wctx.lineWidth = 2; wctx.strokeRect(s.sx * LW * WS + 1, s.sy * LH * WS + 1, LW * WS - 2, LH * WS - 2); }
  /* The cursor's own tile, a dot inside the selected sector. */
  wctx.fillStyle = P.select; wctx.fillRect(cursor.x * WS, cursor.y * WS, WS, WS);
}
function sectorSummary(s){
  const sticks = looseCount('stick')(s), rocks = looseCount('rock')(s);
  const bushes = sectorCount(s, 'bushes', t => t.feature === 'bush');
  const water = sectorCount(s, 'water', t => t.ground === 'water');
  const hs = hills.filter(h => secOf(h.x, h.y).sx === s.sx && secOf(h.x, h.y).sy === s.sy);
  const cs = caves.filter(c => c.exit && secOf(c.exit.x, c.exit.y).sx === s.sx && secOf(c.exit.x, c.exit.y).sy === s.sy);
  const people = beings.filter(b => b.alive && b.species === 'human' && secOf(b.x, b.y).sx === s.sx && secOf(b.x, b.y).sy === s.sy);
  const animals = beings.filter(b => b.alive && b.species !== 'human' && b.species !== 'god' && secOf(b.x, b.y).sx === s.sx && secOf(b.x, b.y).sy === s.sy);
  /* A sleeping god is no animal. It is named, with its epithet, so a sector holding a body says so. */
  const theGods = beings.filter(b => b.alive && b.species === 'god' && secOf(b.x, b.y).sx === s.sx && secOf(b.x, b.y).sy === s.sy);
  const parts = [`${sticks} sticks`, `${rocks} rocks`, `${bushes} berry bushes`, water ? 'water' : 'no water', hs.length ? `${hs.length} hill${hs.length > 1 ? 's' : ''}` : '', cs.length ? `${cs.length} cave mouth${cs.length > 1 ? 's' : ''}` : ''];
  if (animals.length) parts.push(animals.map(a => SPECIES[a.species].label).sort().join(', '));
  if (theGods.length) parts.push(theGods.map(g => `${g.name} ${g.epithet}, ${g.status}`).join('; '));
  if (people.length) parts.push(people.map(p => p.name).join(', '));
  for (const c of camps) if (c.site && secOf(...c.site).sx === s.sx && secOf(...c.site).sy === s.sy) parts.unshift(c.pit ? `${c.name} and its hearth` : `the site of ${c.name}, not yet built`);
  if (s.country != null && regionById(s.country)) parts.push(countryLine(regionById(s.country)));
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
    const px = (a.x - ox) * MS + MS / 2, py = (a.y - oy) * MS + MS / 2 + 1, glyph = beingGlyph(a);
    if (a.species === 'human'){ mctx.lineWidth = 2; mctx.strokeStyle = P.halo; mctx.strokeText(glyph, px, py); }
    mctx.fillStyle = beingColor(a); mctx.fillText(glyph, px, py);
  }
  for (const c of camps) if (c.site){ const [x, y] = c.site; if (x < ox || x >= ox + 3 * LW || y < oy || y >= oy + 3 * LH) continue; mctx.strokeStyle = c === viewCamp ? P.select : P.grid; mctx.lineWidth = 1.5; mctx.strokeRect((x - ox) * MS - 4.5, (y - oy) * MS - 4.5, MS + 9, MS + 9); }
  if (isWinter()){ mctx.fillStyle = P.snow; mctx.globalAlpha = 0.28; mctx.fillRect((x0 - ox) * MS, (y0 - oy) * MS, (x1 - x0) * MS, (y1 - y0) * MS); mctx.globalAlpha = 1; }
  mctx.strokeStyle = P.select; mctx.lineWidth = 2; mctx.strokeRect(LW * MS + 1, LH * MS + 1, LW * MS - 2, LH * MS - 2);
  if (mhover){ mctx.globalAlpha = 0.5; mctx.strokeRect((mhover.sx - cur.sx + 1) * LW * MS + 1, (mhover.sy - cur.sy + 1) * LH * MS + 1, LW * MS - 2, LH * MS - 2); mctx.globalAlpha = 1; }
  /* The cursor's own tile, when it lies inside the nine sectors on show. */
  if (cursor.x >= ox && cursor.x < ox + 3 * LW && cursor.y >= oy && cursor.y < oy + 3 * LH){
    mctx.strokeStyle = P.select; mctx.lineWidth = 2; mctx.strokeRect((cursor.x - ox) * MS, (cursor.y - oy) * MS, MS, MS);
  }
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
    else if (t.feature === 'deadpine'){ g = '†'; fg = P['ash-fg']; } else if (t.feature === 'boulder'){ bg = P.boulder; g = '#'; fg = P['boulder-fg']; } else if (t.feature === 'reeds'){ g = '"'; fg = P.reeds; }
    else if (t.feature === 'mushrooms'){ g = 'ɸ'; fg = t.shrooms > 0 ? P.gnome : P['ash-fg']; }
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
    const px = (a.x - ox) * T + T / 2, py = (a.y - oy) * T + T / 2 + 1, glyph = beingGlyph(a);
    ctx.lineWidth = 3; ctx.strokeStyle = P.halo; ctx.strokeText(glyph, px, py);
    ctx.fillStyle = beingColor(a); ctx.fillText(glyph, px, py);
    if (a.carrying){ ctx.fillStyle = a.carrying.kind === 'rock' ? P.rock : a.carrying.kind === 'stick' || a.carrying.kind === 'spear' || a.carrying.kind === 'log' ? P.stick : a.carrying.kind === 'berries' ? P.berry : a.carrying.kind === 'ember' ? P.fire : a.carrying.kind === 'water' ? P['water-fg'] : P.carcass; ctx.fillRect((a.x - ox) * T + T - 7, (a.y - oy) * T + 2, 5, 5); }
    if (tipTarget && tipTarget.being === a.id){ ctx.strokeStyle = P.select; ctx.lineWidth = 1.5; ctx.strokeRect((a.x - ox) * T + 0.75, (a.y - oy) * T + 0.75, T - 1.5, T - 1.5); }
  }
  ctx.globalAlpha = 1;
  if (secOf(cursor.x, cursor.y).sx === cur.sx && secOf(cursor.x, cursor.y).sy === cur.sy && cursor.z === lvl){
    const cx = (cursor.x - ox) * T, cy = (cursor.y - oy) * T;
    ctx.strokeStyle = P.select; ctx.lineWidth = 2; ctx.strokeRect(cx + 1, cy + 1, T - 2, T - 2);
    ctx.strokeStyle = P.halo; ctx.lineWidth = 1; ctx.strokeRect(cx + 2.5, cy + 2.5, T - 5, T - 5);
  }
}
function draw(){ if (view === 'world') drawWorld(); else if (view === 'mid') drawMid(); else drawLoc(); }
