/* Canvas drawing for all four views: world map, nearby sectors, the sector in view, and the camp fire. */

function readPalette(){
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['sprite','gnome','deer','wolf','rain','snow','grass','grass-fg','soil','sand','ash','ash-fg','water','water-fg','tree','bush','berry','reeds','boulder','boulder-fg','stick','rock','carcass','fire-bg','fire','fire2','pit','snare','stash','night','halo','select','rabbit','fox','god','corpse','grid','hill','hill-fg','stone','stone-fg']) P[k] = cs.getPropertyValue('--map-' + k).trim();
  for (const k of ['none','wet','dry','hot','cold','above','below','light','dark','still','moving','scar','line']) P['field-' + k] = cs.getPropertyValue('--field-' + k).trim();
  fieldKey = '';
  P.agentL = cs.getPropertyValue('--agent-light').trim(); P.void = cs.getPropertyValue('--panel').trim();
  P.bg = cs.getPropertyValue('--bg').trim(); P['map-halo'] = cs.getPropertyValue('--map-halo').trim();
  worldDirty = 0;
}
const beingColor = a => a.species === 'human' ? `hsl(${a.hue} 65% ${P.agentL})` : a.species === 'god' ? P.god : a.species === 'rabbit' ? P.rabbit : a.species === 'deer' ? P.deer : a.species === 'wolf' ? P.wolf : a.species === 'sprite' ? P.sprite : a.species === 'gnome' ? P.gnome : P.fox;
/* A sleeping being draws a `z`, but every god sleeps, and a god is not one more sleeper: it keeps its own
   glyph, drawn as its icon where the pole is known and as the star (SPECIES.god.glyph) as a fallback, so
   the thing lying in the hill reads as the god the legends name. */
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
/* ---- the field: the world before it has tiles. The preview paints the ground the marks will become, in the world
   map's own colours, and the boundaries lie over it as faint lines. ---- */
/* A boundary's ink by its pole, on the day-era overlay. A pole in the table draws in its own colour at full alpha. */
const BOUNDARY_INK = { wet: 'water-fg' };
function drawBoundaries(g, alpha, skip = null){
  for (const b of liveBoundaries()){
    if (skip && skip.has(b.id)) continue;
    g.fillStyle = P[BOUNDARY_INK[b.pole] || 'field-line']; g.globalAlpha = BOUNDARY_INK[b.pole] ? 1 : alpha;
    for (const i of b.tiles){ const x = i % W, y = (i - x) / W; g.fillRect(x * WS, y * WS, WS, WS); }
  }
  g.globalAlpha = 1;
}
/* How strongly a boundary shows over the preview in the ages. A line is only a hint of where one country ends. */
const FIELD_LINE_ALPHA = 0.25;
/* The cache holds a whole state of the field, so a dropped frame never leaves it half drawn. A cut that its
   own gesture is still stroking is held out, and the cache is drawn again without it when the stroke ends.
   The preview is kept in fieldPreview and computed only when that is empty. drawField empties it when the
   act changes, so it is computed once per act. The ground is filled one kind at a time, so each kind sets
   its colour once. A wet boundary is not drawn as a line, because the preview already paints it as a river. */
function drawFieldCache(skip = null){
  if (!fieldPreview) fieldPreview = previewField();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, ocv.width, ocv.height);
  const byKind = {};
  fieldPreview.forEach((k, i) => { (byKind[k] || (byKind[k] = [])).push(i); });
  for (const k in byKind){
    octx.fillStyle = P[PREVIEW_INK[k]];
    for (const i of byKind[k]){ const x = i % W, y = (i - x) / W; octx.fillRect(x * WS, y * WS, WS, WS); }
  }
  octx.fillStyle = P['field-line']; octx.globalAlpha = FIELD_LINE_ALPHA;
  for (const b of liveBoundaries()){
    if (b.pole === 'wet' || (skip && skip.has(b.id))) continue;
    for (const i of b.tiles){ const x = i % W, y = (i - x) / W; octx.fillRect(x * WS, y * WS, WS, WS); }
  }
  octx.globalAlpha = 1;
}

/* ---- the ages in motion ----
   An age is one step of the rules, so the state is already the new state when the tween begins. The view
   holds the field as it was, fades the new one in over it, and draws each god's gesture across the same
   fraction. The clock is `acc`, which main.js already keeps: the tween is a function of that fraction and
   not of elapsed frames, so a tab that slept wakes and the drawing jumps with the state. */

/* Where each god's star was left when the last age ended. An act often leaves a god on a neighbour of its
   own country, and settleHome walks it home at the head of the next age. The record then begins somewhere
   the star is not, so the star walks home first and walks out after. */
let godLast = new Map(), godEnds = new Map();
const tweenEase = f => f * f * (3 - 2 * f);
const tileSpot = i => i === null || i === undefined ? null : { x: (i % W + 0.5) * WS, y: ((i - i % W) / W + 0.5) * WS };
const spotOf = p => p ? { x: (p.x + 0.5) * WS, y: (p.y + 0.5) * WS } : null;
function tweenRing(p, r, ink, alpha, width = 2){
  if (!p) return;
  wctx.globalAlpha = clamp(alpha, 0, 1); wctx.strokeStyle = ink; wctx.lineWidth = width;
  wctx.beginPath(); wctx.arc(p.x, p.y, Math.max(1, r), 0, 7); wctx.stroke(); wctx.globalAlpha = 1;
}
/* A wash that spreads from the anchor over the country it acts on, by steps away from that tile. */
function washTiles(rec, f, ink, alpha, hatch){
  const r = rec.region === null || rec.region === undefined ? null : regionById(rec.region); if (!r || rec.to === null) return;
  const ax = rec.to % W, ay = (rec.to - ax) / W;
  let far = 1;
  for (const i of r.tiles){ const x = i % W, d = Math.abs(x - ax) + Math.abs((i - x) / W - ay); if (d > far) far = d; }
  const reach = far * f;
  wctx.globalAlpha = alpha; wctx.fillStyle = ink;
  for (const i of r.tiles){
    const x = i % W, y = (i - x) / W;
    if (hatch && (x + y) % 4 !== 0) continue;
    if (Math.abs(x - ax) + Math.abs(y - ay) <= reach) wctx.fillRect(x * WS, y * WS, WS, WS);
  }
  wctx.globalAlpha = 1;
}
/* The three washes are one gesture kind and differ by the ink they use. */
const WASH_INK = { freeze: 'field-cold', hide: 'field-dark', show: 'field-light' };
/* Where a god's star stands while its gesture runs. The walk home takes the first part of the slice, and
   only when the record begins somewhere the star was not left. */
function walkPoint(rec, f){
  const was = godLast.has(rec.god) ? godLast.get(rec.god) : rec.from;
  if (was === null || was === undefined || rec.from === null || was === rec.from) return pointAt(rec.from, rec.to, f);
  const home = 0.35;
  return f < home ? pointAt(was, rec.from, f / home) : pointAt(rec.from, rec.to, (f - home) / (1 - home));
}
/* One gesture's own figure, at the fraction of its slice that has run. */
function drawGesture(rec, f){
  const q = tileSpot(rec.to), e = tweenEase(f);
  if (rec.kind === 'split'){
    /* Over the twenty-four seeds of tests/ages.js no cut leaves a gap of more than two tiles, so the sorted
       line reads as one stroke and is drawn as one. */
    wctx.fillStyle = P['field-line'];
    for (const i of lineSoFar(rec.line, e)){ const x = i % W, y = (i - x) / W; wctx.fillRect(x * WS, y * WS, WS, WS); }
    return;
  }
  if (rec.kind === 'flow'){
    /* Two flows in five run between countries that do not lie in a straight line, so a line from anchor to
       anchor would cross a country the water never entered. Each country lights in turn instead. */
    const n = rec.path.length;
    rec.path.forEach((i, k) => { const s = clamp(e * n - k, 0, 1); if (s > 0) tweenRing(tileSpot(i), 3 + 16 * s, P['field-wet'], 1 - s * 0.5, 2); });
    return;
  }
  if (!q) return;
  if (rec.kind === 'claim') tweenRing(q, 4 + 26 * e, P['field-' + rec.pole] || P.select, 1 - e, 2);
  else if (rec.kind === 'make' || rec.kind === 'twist'){
    const sp = SPECIES[rec.species];
    wctx.save(); wctx.translate(q.x, q.y - 16 * (1 - e)); if (rec.kind === 'twist') wctx.rotate((1 - e) * 0.9);
    wctx.globalAlpha = e; wctx.textAlign = 'center'; wctx.textBaseline = 'middle';
    wctx.font = '700 16px "JetBrains Mono", ui-monospace, Menlo, monospace';
    wctx.lineWidth = 3; wctx.strokeStyle = P.halo; wctx.strokeText(sp.glyph, 0, 0);
    wctx.fillStyle = rec.kind === 'twist' ? P['field-scar'] : P.sprite; wctx.fillText(sp.glyph, 0, 0);
    wctx.restore(); wctx.globalAlpha = 1;
  }
  else if (rec.kind === 'raise') tweenRing(q, 3 + 24 * e, P['field-above'], 1 - e, 2);
  else if (rec.kind === 'dig') tweenRing(q, 27 - 24 * e, P['field-below'], 1 - e, 2);
  else if (rec.kind === 'pool') tweenRing(q, 3 + 18 * e, P['field-wet'], 1, 2);
  else if (rec.kind === 'burn') washTiles(rec, e, P['field-scar'], 1, true);
  else if (rec.kind === 'wash') washTiles(rec, e, P[WASH_INK[rec.value]] || P['field-line'], 0.5, false);
  else if (rec.kind === 'battle') tweenRing(q, 4 + 22 * e, P['field-scar'], 1 - e, 3);
  else if (rec.kind === 'backstop') tweenRing(q, 4 + 20 * e, P.select, 1 - e, 2);
}
/* The disc's own radius, the halo drawMark draws around the mark. The word beside it keeps clear of
   this circle, so named here rather than left as a bare 34 in two places. */
const MARK_R = 34;
/* Where the mark's word goes: to the right of the disc, at a fixed gap past its radius, unless the
   disc sits too close to the canvas edge for the word to fit there, when it goes to the left instead.
   When the word fits on neither side, the side with more room still runs off the canvas less, so it
   picks that side rather than always the left. Pure, so a test can walk every position without a canvas. */
function markWordSide(x, textWidth, canvasWidth, gap = 8){
  const need = MARK_R + gap + textWidth;
  if (x + need <= canvasWidth) return 'right';
  if (x - need >= 0) return 'left';
  const room = { right: canvasWidth - (x + MARK_R + gap), left: x - MARK_R - gap };
  return room.right >= room.left ? 'right' : 'left';
}
/* The act's face: the mark draws itself stroke by stroke over TWEEN.cue to TWEEN.draw, then the word
   appears beside it. The disc is the map's own background at just over half, so the mark reads on any
   country and the ground still shows through. The word sits to the side of the disc, not under it, so
   it never lies over the god's own name. */
function drawMark(rec, f, alpha){
  const m = markFor(rec.kind, rec.value); if (!m) return;
  const q = tileSpot(rec.to); if (!q) return;
  const d = clamp((f - TWEEN.cue) / (TWEEN.draw - TWEEN.cue), 0, 1);
  if (d <= 0) return;
  wctx.save();
  wctx.globalAlpha = alpha;
  wctx.beginPath(); wctx.arc(q.x, q.y, MARK_R, 0, Math.PI * 2);
  wctx.fillStyle = P['map-halo']; wctx.globalAlpha = alpha * 0.5; wctx.fill();
  wctx.globalAlpha = alpha;
  wctx.translate(q.x - 20, q.y - 20); wctx.scale(0.833, 0.833);
  wctx.strokeStyle = P['field-line']; wctx.lineWidth = 4.3; wctx.lineCap = 'round'; wctx.lineJoin = 'round';
  const n = Math.ceil(d * m.paths.length);
  for (let i = 0; i < n; i++) wctx.stroke(new Path2D(m.paths[i]));
  wctx.restore();
  if (f < TWEEN.word) return;
  wctx.save();
  wctx.globalAlpha = alpha;
  wctx.font = 'bold 17px "Atkinson Hyperlegible", system-ui, sans-serif';
  const word = m.word.toUpperCase(), gap = 8;
  const side = markWordSide(q.x, wctx.measureText(word).width, W * WS, gap);
  wctx.textAlign = side === 'right' ? 'left' : 'right';
  const wx = side === 'right' ? q.x + MARK_R + gap : q.x - MARK_R - gap;
  wctx.lineWidth = 4; wctx.strokeStyle = P.bg; wctx.strokeText(word, wx, q.y);
  wctx.fillStyle = P['field-line']; wctx.fillText(word, wx, q.y);
  wctx.restore();
}
/* A line beside the ground it names, over two rows at most. It breaks on a space where it can, so the words
   stay whole, and it is trimmed only when even two rows will not hold it. */
function drawCaption(text, p){
  if (!p) return;
  const per = Math.max(24, Math.floor((W * WS - 24) / 7)), rows = [];
  let rest = String(text);
  while (rest.length && rows.length < 2){
    if (rest.length <= per){ rows.push(rest); rest = ''; break; }
    let cut = rest.lastIndexOf(' ', per); if (cut < per * 0.6) cut = per;
    rows.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
  }
  if (!rows.length) return;
  if (rest) rows[rows.length - 1] = rows[rows.length - 1].slice(0, per - 1) + '…';
  wctx.font = '500 11px "JetBrains Mono", ui-monospace, Menlo, monospace';
  wctx.textAlign = 'center'; wctx.textBaseline = 'middle';
  let w = 0; for (const t of rows) w = Math.max(w, wctx.measureText(t).width + 10);
  const h = rows.length * 14 + 4;
  const x = clamp(p.x, w / 2 + 2, W * WS - w / 2 - 2), y = clamp(p.y + 30, h / 2 + 2, H * WS - h / 2 - 2);
  wctx.globalAlpha = 0.75; wctx.fillStyle = P.void; wctx.fillRect(x - w / 2, y - h / 2, w, h); wctx.globalAlpha = 1;
  wctx.fillStyle = P.select;
  rows.forEach((t, k) => wctx.fillText(t, x, y - h / 2 + 9 + k * 14));
}
/* The weigh caption's own words, apart from drawField, so a test can read them without a canvas. */
function weighCaption(godName, count){ return `${godName} weighs ${nOf(count, 'piece of land', 'pieces of land')}.`; }
function drawField(){
  /* A stepped beat always plays at the full tier: Step is the reading mode, and the pace buttons govern
     running. A running beat reads the ladder. */
  const span = ui.playing ? TWEEN.full : BEAT_MS / pace, tier = beatTier(span);
  /* The key trusts creation.gestures.length and creation.discards to move whenever a region's marks do.
     In src/sim/gods.js, every mark(), setPole(), and `r.marks =` filter (battle at line 450, the start
     branch of backstop at line 652) is followed by a gesture() call in the same act. The one other
     writer of marks is undoSettle in src/sim/settle.js, which increments creation.discards. A load
     clears fieldKey in src/ui/actions.js. A mark written with neither a gesture nor a discard would
     leave this key unmoved, and the preview stale. */
  const key = [seedText, age, creation.gestures.length, creation.discards, liveRegions().length].join(':');
  if (!ocv2){ ocv2 = document.createElement('canvas'); octx2 = ocv2.getContext('2d'); }
  if (ocv2.width !== ocv.width || ocv2.height !== ocv.height){ ocv2.width = ocv.width; ocv2.height = ocv.height; }
  if (key !== fieldKey){
    /* The field last drawn becomes the field the new one fades in over. A new world, a thrown-back valley,
       and a frame that ran two or more beats have nothing to fade from, so they snap. The beat count is
       the frame loop's, not a guess from the gesture count: one decision can write two gestures, and
       that is still one beat with one act to draw. */
    fieldJump = !fieldKey || creation.discards !== fieldDiscards || (age !== fieldAge && age !== fieldAge + 1) || beatsLastFrame > 1;
    if (!fieldJump){ octx2.setTransform(1, 0, 0, 1, 0, 0); octx2.clearRect(0, 0, ocv2.width, ocv2.height); octx2.drawImage(ocv, 0, 0); }
    godLast = godEnds; godEnds = new Map();
    fieldKey = key; fieldAge = age; fieldGestures = creation.gestures.length; fieldDiscards = creation.discards; fieldSkip = null; fieldPreview = null;
  }
  const still = beatStill(anyDialogOpen());
  const f = fieldJump || still ? 1 : clamp(acc, 0, 1);
  /* One beat is one act, so one gesture draws. The act before it fades over this beat, so a player who
     looked away for one act can still see what they missed. */
  const recs = creation.gestureAge === age ? creation.gestures : [];
  const now = recs.length ? recs[recs.length - 1] : null;
  const before = recs.length > 1 ? recs[recs.length - 2] : null;
  /* A world holding still after its beat still shows the act it just played. `f` is 1 there, so the
     cross-fade and the walk are over, but the mark, the word and the caption are what the player stopped
     to read: Step is the reading mode, and erasing the act at the end of its own beat left the face on
     screen for the last 150 ms of it and nothing afterwards. */
  const figures = (f < 1 || still) && (tier === 'full' || tier === 'figure');

  /* A cut is stroked by its own gesture, so the cache holds it out until the stroke is done. */
  const skip = new Set();
  if (figures && now && now.kind === 'split' && f < 1){
    const b = boundaries.find(q => q.a === now.near && q.b === now.far); if (b) skip.add(b.id);
  }
  const skipKey = [...skip].sort().join(',');
  if (skipKey !== fieldSkip){ drawFieldCache(skip); fieldSkip = skipKey; }

  wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (f < 1){ wctx.drawImage(ocv2, 0, 0); wctx.globalAlpha = tweenEase(f); wctx.drawImage(ocv, 0, 0); wctx.globalAlpha = 1; }
  else wctx.drawImage(ocv, 0, 0);

  /* The intent cue: what the god weighed before it acted, at the slow tier and in the first part of the
     gesture's own slice. It replays a decision already taken; it does not ask the rules to look ahead. */
  if (tier === 'full' && f < 1 && now && now.weighed && f > 0 && f < TWEEN.cue){
    const fade = (1 - f / TWEEN.cue) * 0.7;
    for (const o of now.weighed.opts){
      const r = regionById(o.region); if (!r) continue;
      wctx.globalAlpha = o.type === now.weighed.picked ? fade : fade * 0.45;
      wctx.strokeStyle = P.select; wctx.lineWidth = 2;
      wctx.strokeRect(r.bbox.x0 * WS + 1, r.bbox.y0 * WS + 1, (r.bbox.x1 - r.bbox.x0 + 1) * WS - 2, (r.bbox.y1 - r.bbox.y0 + 1) * WS - 2);
    }
    wctx.globalAlpha = 1;
    const g = beingById(now.god), p = tileSpot(now.from === null ? now.to : now.from);
    if (g && p) drawCaption(weighCaption(g.name, now.weighed.opts.length), { x: p.x, y: p.y - 44 });
  }

  /* The act's own figure, at the fraction of its own beat that has run. The act before it fades out over
     this beat, at the same fraction, so a look-away never simply erases what happened. */
  if (figures){
    if (before && f < 1){ wctx.globalAlpha = 1 - f; drawGesture(before, 1); wctx.globalAlpha = 1; drawMark(before, 1, 1 - f); }
    if (now && f > 0){ drawGesture(now, f); drawMark(now, f, 1); }
  }

  /* Where every star stands. A god stands on its own anchor tile now, and a god with a gesture walks. */
  const moving = new Map();
  if (f < 1 && now){
    const s = f;
    if (s > 0){
      const p = walkPoint(now, s);
      const beaten = now.kind === 'battle' && now.loser === now.god;
      if (p) moving.set(now.god, { p, end: now.to,
        alpha: now.kind === 'born' ? s : now.kind === 'unmade' ? 1 - s : now.kind === 'sleep' || beaten ? 1 - 0.45 * s : 1 });
      /* The rival of a battle or a mingle meets at the anchor and goes back to its own country. Its anchor
         never moved, so the star ends where the rules say it is. A beaten rival goes back faded. */
      if ((now.kind === 'battle' || now.kind === 'mingle') && now.otherFrom !== null && now.otherFrom !== undefined){
        const back = s < 0.5 ? pointAt(now.otherFrom, now.to, s * 2) : pointAt(now.to, now.otherFrom, s * 2 - 1);
        const lost = now.kind === 'battle' && now.loser === now.other;
        if (back) moving.set(now.other, { p: back, end: now.otherFrom, alpha: s < 0.5 || !lost ? 1 : 1 - 0.45 * (s * 2 - 1) });
      }
    }
  }
  const spots = [];
  for (const g of gods()){
    const m = moving.get(g.id);
    if (!m && g.status === 'dead') continue;
    const at = g.at === null || g.at === undefined ? null : { x: g.at % W, y: (g.at - g.at % W) / W };
    let p = m ? m.p : at;
    if (!p){ const r = standsIn(g); if (!r) continue; p = { x: (r.bbox.x0 + r.bbox.x1) / 2, y: (r.bbox.y0 + r.bbox.y1) / 2 }; }
    godEnds.set(g.id, m ? m.end : g.at);
    const s = spotOf(p);
    spots.push({ g, x: s.x, y: s.y, alpha: m ? m.alpha : g.status === 'awake' ? 1 : 0.55 });
  }
  /* Two icons are nudged apart only when their pixels are within the icon's own 22 px footprint on y,
     and within a name-wide footprint on x: two bold names at 10 px can each run wider than the icon,
     so the font is set before the nudge and the two names' own widths decide how far apart they land. */
  wctx.font = '500 10px "JetBrains Mono", ui-monospace, Menlo, monospace';
  spots.forEach((s, i) => { for (let k = 0; k < i; k++){ const o = spots[k];
    const dist = Math.max(22, (wctx.measureText(o.g.name).width + wctx.measureText(s.g.name).width) / 2) + 4;
    if (Math.abs(s.x - o.x) < dist && Math.abs(s.y - o.y) < 22){ s.x = o.x + dist; s.y = o.y; } } });
  wctx.textAlign = 'center'; wctx.textBaseline = 'middle';
  for (const s of spots){
    wctx.globalAlpha = clamp(s.alpha, 0, 1);
    if (!drawGodIcon(wctx, s.g.pole, s.x, s.y, 2)){
      wctx.font = '700 18px "JetBrains Mono", ui-monospace, Menlo, monospace';
      wctx.lineWidth = 3; wctx.strokeStyle = P.halo; wctx.strokeText(SPECIES.god.glyph, s.x, s.y); wctx.fillStyle = P.god; wctx.fillText(SPECIES.god.glyph, s.x, s.y);
    }
    wctx.font = '500 10px "JetBrains Mono", ui-monospace, Menlo, monospace';
    /* The icon is 22 px square, centred on s.x,s.y, so its bottom edge sits 11 px below centre. */
    wctx.strokeText(s.g.name, s.x, s.y + 17); wctx.fillStyle = P.select; wctx.fillText(s.g.name, s.x, s.y + 17);
  }
  wctx.globalAlpha = 1;
  /* One caption at a time: the line the act on stage wrote. It shows in a page element above the foot,
     never on the canvas: the canvas is wider than the window on a 2x screen, and a caption drawn on it
     could run under a drawer or off the visible edge. Its icon is the pole of the god whose act this is;
     the caption text already names the god, so the icon carries no label of its own. */
  const capG = figures && now && f > 0 ? beingById(now.god) : null;
  setActCaption(capG ? captionFor(now) : '', capG && capG.pole);
  wctx.fillStyle = P.select; wctx.fillRect(cursor.x * WS, cursor.y * WS, WS, WS);
}
function drawWorld(){
  if (inAges()){ drawField(); return; }
  if (tick - worldDirty > 40 || worldDirty === 0){ drawWorldCache(); worldDirty = tick; }
  wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wctx.drawImage(ocv, 0, 0);
  const dark = darkness(); if (dark > 0){ wctx.fillStyle = `rgba(${P.night},${dark * 0.8})`; wctx.fillRect(0, 0, W * WS, H * WS); }
  /* After the night wash, so the country lines read at night too. */
  if (ui.overlay) drawBoundaries(wctx, 0.85);
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
  return `${sectorLabel(s)}, sector ${s.sx},${s.sy}: ${parts.filter(Boolean).join('; ')}.`;
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
    if (a.species === 'god' && drawGodIcon(mctx, a.pole, px, py, 1)) continue;
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

/* ---- location view: the sector in view, or the camp fire view, from the origin locOrigin gives ---- */
function drawLoc(){
  const { ox, oy } = locOrigin();
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
  for (const c of camps) if (lvl === 0 && c.site && !c.pit && inLocView(...c.site)){
    const [x, y] = c.site; ctx.strokeStyle = P.select; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.strokeRect((x - ox) * T + 2, (y - oy) * T + 2, T - 4, T - 4); ctx.setLineDash([]);
  }
  { ctx.fillStyle = P.corpse; for (const c of corpses){ if (c.x >= ox && c.x < ox + LW && c.y >= oy && c.y < oy + LH && c.z === lvl) ctx.fillText('x', (c.x - ox) * T + T / 2, (c.y - oy) * T + T / 2 + 1); } }
  const dark = darkness(); if (dark > 0){ ctx.fillStyle = `rgba(${P.night},${dark})`; ctx.fillRect(0, 0, LW * T, LH * T); }
  if (isWinter()){ ctx.fillStyle = P.snow; ctx.globalAlpha = 0.22; ctx.fillRect(0, 0, LW * T, LH * T); ctx.globalAlpha = 1; }
  if (weather.storm){ ctx.strokeStyle = P.rain; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 90; k++){ const x = (hash(k, 3) % (LW * T)), y = ((hash(k, 7) + tick * 9) % (LH * T)); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9); } ctx.stroke(); ctx.globalAlpha = 1; }
  for (const c of camps) if (lvl === 0 && c.pit && tileAt(...c.pit).struct.lit && dark > 0){ const [px, py] = c.pit; if (inLocView(px, py)){ const gr = ctx.createRadialGradient((px - ox) * T + T / 2, (py - oy) * T + T / 2, 4, (px - ox) * T + T / 2, (py - oy) * T + T / 2, T * 4); gr.addColorStop(0, `rgba(255,180,90,${dark * 0.9})`); gr.addColorStop(1, 'rgba(255,180,90,0)'); ctx.fillStyle = gr; ctx.fillRect((px - ox) * T - T * 4, (py - oy) * T - T * 4, T * 9, T * 9); } }
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
    if (a.species !== 'god' || !drawGodIcon(ctx, a.pole, px, py, 2)){
      ctx.lineWidth = 3; ctx.strokeStyle = P.halo; ctx.strokeText(glyph, px, py);
      ctx.fillStyle = beingColor(a); ctx.fillText(glyph, px, py);
    }
    if (a.carrying){ ctx.fillStyle = a.carrying.kind === 'rock' ? P.rock : a.carrying.kind === 'stick' || a.carrying.kind === 'spear' || a.carrying.kind === 'log' ? P.stick : a.carrying.kind === 'berries' ? P.berry : a.carrying.kind === 'ember' ? P.fire : a.carrying.kind === 'water' ? P['water-fg'] : P.carcass; ctx.fillRect((a.x - ox) * T + T - 7, (a.y - oy) * T + 2, 5, 5); }
    if (tipTarget && tipTarget.being === a.id){ ctx.strokeStyle = P.select; ctx.lineWidth = 1.5; ctx.strokeRect((a.x - ox) * T + 0.75, (a.y - oy) * T + 0.75, T - 1.5, T - 1.5); }
  }
  ctx.globalAlpha = 1;
  if (inLocView(cursor.x, cursor.y) && cursor.z === lvl){
    const cx = (cursor.x - ox) * T, cy = (cursor.y - oy) * T;
    ctx.strokeStyle = P.select; ctx.lineWidth = 2; ctx.strokeRect(cx + 1, cy + 1, T - 2, T - 2);
    ctx.strokeStyle = P.halo; ctx.lineWidth = 1; ctx.strokeRect(cx + 2.5, cy + 2.5, T - 5, T - 5);
  }
}
function draw(){ if (view === 'world') drawWorld(); else if (view === 'mid') drawMid(); else drawLoc(); }
