/* God actions: tools, view changes, movement, and world control. */

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
