/* View model. Pure functions from sim state to what the strip and drawers show. No DOM.
   Everything reads the current `camp` unless it says otherwise. */
const level3 = (v, aim) => v >= aim ? 'good' : v >= aim / 4 ? 'warn' : 'bad';

/* ---- the ages ---- In the gods era there are no tiles, no sectors, no hills, and no people. Everything below
   that reads the valley asks inAges() first. */
const inAges = () => era === 'gods';
/* An age as the chronicle names it. A mark holds the absolute age; the telling counts from the Pulse. */
const ageName = n => pulseAge === null || n < pulseAge ? 'Before time' : `Age ${n - pulseAge + 1}`;
const nOf = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/* The live region a god stands in. The sim's settleHome does the same walk and moves the god; this one only looks. */
function standsIn(g){
  let r = g.region === null || g.region === undefined ? null : regionById(g.region);
  while (r && r.children){ const kids = r.children.map(regionById); r = kids.find(k => hasPole(k, g.pole)) || kids[0]; }
  return r || null;
}
/* One phrase for a country: its poles, and the reason on its newest pole mark. The reason names the god. A far side of a
   line takes the other pole, so the god's epithet beside the country's poles would read as a mistake. No full stop at the end. */
function countryLine(r){
  if (!r) return 'no country';
  const poles = marksOf(r, 'pole');
  if (!poles.length) return 'formless, not yet anything';
  const m = poles.slice().sort((p, q) => q.age - p.age)[0];
  /* A backstop reason names no god. Then the god of the mark is named after the reason. */
  const g = m.by === null || m.by === undefined ? null : beingById(m.by);
  const why = m.why.replace(/\.$/, '');
  const named = g && !why.includes(g.name) ? `${why}, by ${g.name} ${g.epithet}` : why;
  return `a country that is ${poles.map(p => p.value).join(' and ')}. ${named}`;
}
/* The gods, in the shape peopleRows gives, so the People drawer can list them. The bar is the god's rest. */
function godRows(){
  return gods().map(g => ({ a: g, m: g.needs.rest, trouble: g.status === 'awake' && g.needs.calm < 20,
    status: g.status === 'dead' ? 'Unmade' : g.status === 'asleep' ? 'Asleep' : g.task ? `Awake: ${g.task.type}` : g.lastChoice && g.lastChoice.picked ? `Awake: ${g.lastChoice.picked}` : 'Awake' }));
}

/* How many ages a frame owes. acc is the part of an age carried from the last frame. At most eight in a frame. */
function agesDue(acc, dt, pace){
  const a = acc + dt * pace / AGE_MS, n = Math.floor(a);
  return n > 8 ? { n: 8, acc: 0 } : { n, acc: a - n };
}

/* ---- the ages in motion ---- The pure parts of the tween. map.js draws; these four say what to draw.
   They read no state but TWEEN and the field's width, so tests/ui.js runs them in Node. */

/* What a tween of this many milliseconds is worth drawing. The length is AGE_MS / pace, read at run time,
   so no tier names a pace. The intent cue goes first as the pace rises, then the act's figure and its
   caption, then the walk and the cross-fade. Below the last tier the field snaps, as it did before. */
function tweenTier(ms){
  if (ms >= TWEEN.full) return 'full';
  if (ms >= TWEEN.figure) return 'figure';
  if (ms >= TWEEN.walk) return 'walk';
  return 'none';
}
/* The slice of the tween that gesture i of n runs in. The starts are spread over TWEEN.stagger of the
   tween, in the order ageStep ran the gods, and every slice ends with the tween. So the gestures overlap,
   the order is the chronicle's order, and the last one still finishes. */
function gestureSlice(i, n, f){
  const start = n > 1 ? (i / n) * TWEEN.stagger : 0;
  return clamp((f - start) / (1 - start), 0, 1);
}
/* A point on the walk between two tiles, in tile coordinates. Either end may be null: with no `to` there
   is nowhere to draw, and with no `from` the star is already where it belongs. */
function pointAt(from, to, f){
  if (to === null || to === undefined) return null;
  const bx = to % W, b = { x: bx, y: (to - bx) / W };
  if (from === null || from === undefined) return b;
  const ax = from % W, a = { x: ax, y: (from - ax) / W }, t = clamp(f, 0, 1);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
/* How much of a line is stroked. Nothing at 0, the whole line at 1. */
function lineSoFar(line, f){
  if (!line || !line.length) return [];
  return line.slice(0, Math.round(clamp(f, 0, 1) * line.length));
}

/* The mean of a list of #rrggbb colours, as rgb(). */
function mixHex(list){
  let r = 0, g = 0, b = 0;
  for (const h of list){ const n = parseInt(h.slice(1), 16); r += n >> 16; g += (n >> 8) & 255; b += n & 255; }
  const k = list.length; return `rgb(${Math.round(r / k)},${Math.round(g / k)},${Math.round(b / k)})`;
}
/* A country's colour on the field: grey with no pole, else the mean of its poles. pal is the palette, passed in so this stays pure. */
function fieldColor(r, pal){
  const cs = marksOf(r, 'pole').map(m => pal['field-' + m.value]).filter(Boolean);
  return cs.length ? mixHex(cs) : pal['field-none'];
}

/* ---- marks on the made world ---- A hill, a cave, a scar, and a country each hold the mark of the god that made them. */
const SCAR_WORD = { burned: 'Burned ground', cut: 'A cut in the earth', drowned: 'Drowned ground', broken: 'Broken ground' };
const godLine = id => { const g = id === null || id === undefined ? null : beingById(id); return g ? `${g.name} ${g.epithet}` : 'a god no one names now'; };
const markWhen = m => `${godLine(m.by)}, ${ageName(m.age) === 'Before time' ? 'before time' : 'in ' + ageName(m.age).toLowerCase()}.`;
const markLine = m => `${markWhen(m)} ${m.why}`;
/* A stock reason begins with the marking god's name and says the label twice. It is left out. Any other reason is kept. */
const markSaid = m => { const g = m.by === null || m.by === undefined ? null : beingById(m.by); return !m.why || (g && m.why.startsWith(g.name)) ? markWhen(m) : markLine(m); };
function markRows(x, y, z){
  if (!field || inAges() || !hasTile(x, y, z)) return [];
  const t = tileAt(x, y, z), r = regionAt(x, y), rows = [];
  /* A god raises a hill with a height mark. Settle also raises one low hill for a making that needs a den, and that
     hill holds the making's mark. It was raised for the creatures, not by the act the mark tells of. */
  if (t.hill && t.hill.mark) rows.push(t.hill.mark.kind === 'height' ? ['Raised by', markSaid(t.hill.mark)] :['Raised for', `the ${SPECIES[t.hill.mark.value] ? SPECIES[t.hill.mark.value].plural : 'creatures'}, so they had a den. ${t.hill.mark.why}`]);
  if (t.hill && t.hill.god != null) rows.push(['Sleeping here', godLine(t.hill.god)]);
  const c = t.cave || t.mouth;
  if (c && c.mark) rows.push(['Dug by', markSaid(c.mark)]);
  if (c && c.god != null) rows.push(['Sleeping here', godLine(c.god)]);
  if (!r) return rows;
  if (z === 0){
    const seen = new Set();
    for (const m of marksOf(r, 'scar')){ if (seen.has(m.why)) continue; seen.add(m.why); rows.push(['Scar', `${SCAR_WORD[m.value] || m.value}. ${markLine(m)}`]); }
    const made = []; for (const m of marksOf(r, 'making')){ if (seen.has(m.why)) continue; seen.add(m.why); made.push(m.why); }
    if (made.length) rows.push(['Made here', made.join(' ')]);
  }
  rows.push(['Country', countryLine(r) + '.']);
  if (r.god != null) rows.push(['Sleeping here', godLine(r.god)]);
  return rows;
}

function daysOfWood(){
  const p = camp.pit && tileAt(...camp.pit).struct;
  const fuel = (p ? p.fuel : 0) + camp.stash.stick * STICK_FUEL + camp.stash.log * LOG_FUEL;
  return fuel / (CLOCK.rate.pitBurn * DAY);
}
function gauges(){
  if (inAges()) return { hearth: null, food: null, water: null, beds: null };
  const p = camp.pit && tileAt(...camp.pit).struct;
  const wood = daysOfWood();
  const hearth = !p ? null : { v: Math.min(1, p.fuel / PIT_MAX), text: !p.lit ? (p.fuel > 0 ? 'laid, cold' : 'out') : wood < 1 ? 'under a day of wood' : `${Math.floor(wood)} days of wood`, level: !p.lit ? 'bad' : wood < 1 ? 'bad' : wood < 2 ? 'warn' : 'good' };
  const meals = stashFood() + camp.stash.fish * 2, aim = foodTarget();
  const food = !camp.site ? null : { v: Math.min(1, meals / aim), text: `${meals} of ${aim}`, level: level3(meals, aim) };
  const water = !camp.tools.waterskin ? null : { v: Math.min(1, camp.stash.water / waterAim()), text: `${camp.stash.water} of ${waterAim()}`, level: level3(camp.stash.water, waterAim()) };
  const n = campHumans().length, beds = bedsFor();
  const bedsG = !camp.shelter ? null : { v: Math.min(1, beds / Math.max(1, n)), text: `${beds} for ${n}`, level: beds >= n ? 'good' : 'warn' };
  return { hearth, food, water, beds: bedsG };
}

/* Mutes. 'cold' mutes the type everywhere. 'cold:3' mutes it for camp 3. 'cold:3:Ada is cold' mutes that one chip. */
const isMuted = (type, campId, text) => ui.mutes.has(type) || ui.mutes.has(`${type}:${campId}`) || (text != null && ui.mutes.has(`${type}:${campId}:${text}`));
function mute(type, campId, text){ ui.mutes.add(text != null ? `${type}:${campId}:${text}` : campId ? `${type}:${campId}` : type); }
function unmute(type, campId, text){ ui.mutes.delete(text != null ? `${type}:${campId}:${text}` : campId ? `${type}:${campId}` : type); }
/* A mute key as the player reads it. The chip's text may hold a colon, so only the first two are split on. */
const ALERT_LABEL = { fire: 'Fire', cold: 'Cold', food: 'Food', water: 'Water', threat: 'Threat', sprites: 'Sprite', event: 'Event' };
function muteLabel(m){
  const i = m.indexOf(':'), j = i < 0 ? -1 : m.indexOf(':', i + 1);
  const type = i < 0 ? m : m.slice(0, i), kind = `${ALERT_LABEL[type] || type} alerts`;
  if (i < 0) return `${kind}, everywhere`;
  const c = camps.find(c => String(c.id) === (j < 0 ? m.slice(i + 1) : m.slice(i + 1, j))), at = c ? c.name : 'a camp that is gone';
  return j < 0 ? `${kind} at ${at}` : `${m.slice(j + 1)}, at ${at}`;
}

/* True when the text names this one. Whole words only: 'Ann' is not in 'Anna is cold'. */
function namesIn(text, name){
  for (let i = text.indexOf(name); i >= 0; i = text.indexOf(name, i + 1)){
    const before = text[i - 1], after = text[i + name.length];
    if (!(before && /\p{L}/u.test(before)) && !(after && /\p{L}/u.test(after))) return true;
  }
  return false;
}

/* The first living person a line names, so the chip can jump to them. The camp's own people come first. */
function pulseWho(text){
  const who = campHumans().find(b => namesIn(text, b.name))
    || beings.find(b => b.alive && b.species === 'human' && namesIn(text, b.name));
  return who ? who.id : undefined;
}

/* Pulses: a major or death line, or a goal that just left blocked, shows as a chip for 1500 ticks. */
function notePulses(){
  if (inAges()){ ui.pulses = []; return; }
  ui.pulses = ui.pulses.filter(p => p.until > tick);
  for (const e of chronicle){
    if (e.tick <= ui.seenTick) break;
    /* A legend of the ages carries its age and stands at tick 0. It is the story of the creation, not something
       that just happened to the camp, so it never becomes a chip. Without this the first day opens with a
       chipful of mingles and makings, several of them word for word the same line. */
    if (e.age !== undefined) continue;
    if ((e.kind === 'major' || e.kind === 'death') && e.tick + 1500 > tick) ui.pulses.push({ text: e.text, until: e.tick + 1500, being: pulseWho(e.text) });
  }
  ui.seenTick = chronicle.length ? chronicle[0].tick : ui.seenTick;
  for (const g of GOALS){
    const s = goalState(g).s, was = ui.lastStates[g.id];
    if (was === 'blocked' && s !== 'blocked') ui.pulses.push({ text: `${g.title} is open now.`, until: tick + 1500 });
    ui.lastStates[g.id] = s;
  }
}

/* The first burning tile in the camp's sector, or null. */
function burningNearCamp(){
  if (!camp.site || !fireCount) return null;
  const s = secOf(...camp.site);
  for (let y = s.sy * LH; y < (s.sy + 1) * LH; y++) for (let x = s.sx * LW; x < (s.sx + 1) * LW; x++) if (tileAt(x, y).fire > 0) return [x, y];
  return null;
}

/* Alerts for the current camp. Conditions read state. Chips are numbered from one. */
function alerts(){
  if (inAges()) return [];
  const out = [], add = (type, text, level, extra) => { if (!isMuted(type, camp.id, text)) out.push({ n: out.length + 1, type, text, level, ...extra }); };
  const p = camp.pit && tileAt(...camp.pit).struct, fuelDays = daysOfWood();
  if (p && camp.everLit && !p.lit) add('fire', 'The hearth is out', 'bad', { tile: camp.pit });
  else if (p && p.lit && fuelDays < 1) add('fire', 'Under a day of wood', 'bad', { tile: camp.pit });
  const burning = burningNearCamp(); if (burning) add('fire', 'A wildfire in the camp sector', 'bad', { tile: burning });
  for (const a of campHumans()){
    if (a.needs.warmth < 30) add('cold', `${a.name} is cold`, 'bad', { being: a.id });
    if (a.needs.food < 25) add('food', `${a.name} is hungry`, 'warn', { being: a.id });
    if (a.needs.water < 25) add('water', `${a.name} is thirsty`, 'warn', { being: a.id });
  }
  const g = gauges();
  if (g.food && (seasonOf() === 'autumn' || isWinter()) && g.food.level !== 'good') add('food', `Food is short: ${g.food.text}`, 'warn', { tile: camp.stashTile });
  if (g.water && camp.stash.water === 0) add('water', 'No water at camp', 'warn', { tile: camp.stashTile });
  if (camp.pit) for (const b of beings) if (b.alive && b.species === 'wolf' && nearAt(b, ...camp.pit) <= 12){ add('threat', 'A wolf near the camp', 'bad', { being: b.id }); break; }
  if (camp.fae.known && camp.fae.favor < -20) add('sprites', `Sprite favour is ${camp.fae.favor}`, 'warn', { tile: camp.stone || camp.pit });
  const swarm = groves.find(gr => gr.swarmUntil > tick);
  if (swarm) add('sprites', 'A grove is out for revenge', 'bad', { tile: [swarm.x, swarm.y] });
  for (const pu of ui.pulses) add('event', pu.text, 'info', { being: pu.being, tile: pu.tile });
  return out;
}

/* Goals by stage. A stage shows when the sim calls it reached and it has a row to show or a goal done. A folded idle goal alone does not open it. Done goals fold to a count. A blocked goal hides until its prerequisite is done. Idle goals fold to a count too. */
function stages(showAll){
  const byId = Object.fromEntries(GOALS.map(g => [g.id, g]));
  return STAGES.map(s => {
    const goals = GOALS.filter(g => g.stage === s.id).map(g => {
      const st = goalState(g), pr = goalPriority[g.id] ?? 1;
      const preq = g.after && byId[g.after];
      const hidden = !showAll && (st.s === 'done' || st.s === 'idle' || (st.s === 'blocked' && preq && goalState(preq).s !== 'done'));
      return { g, st, pr, hidden };
    });
    const idleTitles = goals.filter(x => x.st.s === 'idle' && x.hidden).map(x => x.g.title);
    return { id: s.id, label: s.label, done: goals.filter(x => x.st.s === 'done').length, idle: idleTitles.length, idleTitles, goals };
  }).filter(s => showAll || (stageReached(s.id) && (s.done > 0 || s.goals.some(x => !x.hidden))));
}
/* What a folded stage says under its header: its idle goals by name. An unfolded stage shows the rows themselves. */
const foldLine = (s, unfolded) => unfolded || !s.idleTitles.length ? '' : `Idle: ${s.idleTitles.join(', ')}`;
/* The stages the Goals drawer shows now. The chord and the palette offer these and no others. */
const stagesShown = () => stages(ui.showAll).map(s => s.id);

/* People of the current camp, trouble first. The dead leave the list at once until a death stamp exists. */
function peopleRows(){
  const rows = beings.filter(b => b.species === 'human' && b.camp === camp && (b.alive || (b.diedAt && tick - b.diedAt < DAY))).map(a => {
    const m = a.alive ? mood(a) : 0;
    const bad = a.alive && (a.needs.warmth < 30 || a.needs.food < 25 || a.needs.water < 25 || a.hp < 50);
    return { a, m, trouble: !!bad, status: a.alive ? a.status : 'Dead' };
  });
  return rows.sort((p, q) => (q.trouble - p.trouble) || (q.a.alive - p.a.alive) || p.a.name.localeCompare(q.a.name));
}

function campSummary(){
  return {
    stash: Object.entries(camp.stash).filter(([k, v]) => v > 0),
    tools: Object.entries(camp.tools).filter(([k, v]) => v).map(([k]) => k),
    favor: camp.fae.known ? camp.fae.favor : null,
    animals: ['rabbit', 'deer', 'fox', 'wolf', 'sprite'].map(sp => [sp, beings.filter(b => b.alive && b.species === sp).length]),
    burning: fireCount, age: dayOf() - Math.floor((camp.founded || 0) / DAY),
  };
}

function seasonLine(){
  if (inAges()) return `${nOf(liveRegions().length, 'country', 'countries')}, ${nOf(awakeGods().length, 'god', 'gods')} awake`;
  const s = seasonOf(), next = SEASONS[(SEASONS.indexOf(s) + 1) % 4], left = SEASON_DAYS - ((dayOf() - 1) % SEASON_DAYS);
  return `${s[0].toUpperCase()}${s.slice(1)}, ${next} in ${left}`;
}

/* The rows a drawer's keys act on, in the order the drawer shows them. */
function drawerRows(id){
  if (id === 'people') return (inAges() ? godRows() : peopleRows()).map(r => ({ kind: 'person', id: r.a.id, r }));
  if (id === 'goals'){
    if (inAges()) return [];
    const out = [];
    for (const s of stages(ui.showAll)){ out.push({ kind: 'stage', id: s.id, s }); for (const x of s.goals) if (!x.hidden || ui.unfold[s.id]) out.push({ kind: 'goal', id: x.g.id, x }); }
    return out;
  }
  if (id === 'chronicle') return chronicle.filter(e => ui.chronFilter === 'all' || e.kind === 'major' || e.kind === 'death').map(e => ({ kind: 'line', id: e.tick + e.text, e }));
  if (id === 'legends') return legends.map((e, i) => ({ kind: 'legend', id: i, e }));
  return [];
}

/* A short string that changes when anything the strip or drawers show changes. */
function viewKey(){
  if (inAges()) return ['ages', age, legends.length, creation.discards, gods().map(g => g.id + g.status).join('|'), ui.open.join(''), ui.focus, JSON.stringify(ui.row), ui.chronFilter, cursor.x, cursor.y, ui.overlay].join('#');
  const g = gauges();
  return [camp.id, camp.name, JSON.stringify(g), alerts().map(a => a.text).join('|'), stages(ui.showAll).map(s => s.goals.map(x => x.st.s + x.pr + x.hidden).join('')).join(','),
    peopleRows().map(r => `${r.a.id}${r.m >> 2}${r.status}`).join('|'), chronicle.length, chronicle[0] ? chronicle[0].tick : 0, ui.open.join(''), ui.focus, JSON.stringify(ui.row), ui.chronFilter, JSON.stringify(ui.unfold),
    cursor.x, cursor.y, cursor.z, ui.overlay].join('#');
}

/* Where the cursor lands after a move. mult is a number of tiles, 'sector', or 'edge'. In the nearby and world views every step is a sector.
   'edge' goes to the sector's edge on that side, and keeps the row or the column. From the edge it goes one sector on, to the same edge there. */
function cursorAfter(c, dx, dy, mult, view){
  if (mult === 'edge' && view === 'loc'){
    const s = secOf(c.x, c.y);
    const ex = dx < 0 ? s.sx * LW : dx > 0 ? (s.sx + 1) * LW - 1 : c.x, ey = dy < 0 ? s.sy * LH : dy > 0 ? (s.sy + 1) * LH - 1 : c.y;
    if (ex !== c.x || ey !== c.y) return { x: ex, y: ey, z: c.z };
    const nx = c.x + dx * LW, ny = c.y + dy * LH;
    return nx < 0 || ny < 0 || nx >= W || ny >= H ? { x: c.x, y: c.y, z: c.z } : { x: nx, y: ny, z: c.z };
  }
  if (mult === 'edge') mult = 'sector';
  const sx = mult === 'sector' || view !== 'loc' ? LW : mult, sy = mult === 'sector' || view !== 'loc' ? LH : mult;
  return { x: clamp(c.x + dx * sx, 0, W - 1), y: clamp(c.y + dy * sy, 0, H - 1), z: c.z };
}
/* The cursor when a sector opens. A cursor already in that sector stays, so a hovered centre is kept. Any other keeps its place in its own sector. */
function cursorInSector(c, sx, sy){
  const s = secOf(c.x, c.y);
  return { x: c.x - s.sx * LW + sx * LW, y: c.y - s.sy * LH + sy * LH, z: c.z };
}
/* One phrase for what is under the cursor. A being first, then the tile. */
function cursorPhrase(){
  if (inAges()) return countryLine(regionAt(cursor.x, cursor.y));
  const a = beings.find(b => b.alive && b.x === cursor.x && b.y === cursor.y && b.z === cursor.z);
  if (a) return `${a.name}${a.species === 'god' ? ' ' + a.epithet : ''}, ${a.alive ? a.status.toLowerCase() : 'dead'}`;
  if (!hasTile(cursor.x, cursor.y, cursor.z)) return cursor.z > 0 ? 'open air' : 'solid earth';
  const t = tileAt(cursor.x, cursor.y, cursor.z), parts = [];
  if (t.struct) parts.push(t.struct.type === 'firepit' ? (t.struct.lit ? 'the hearth, burning' : 'the fire pit, cold') : t.struct.type);
  if (t.feature) parts.push(FEATURES[t.feature].name);
  const it = itemAt(cursor.x, cursor.y, cursor.z); if (it) parts.push(ITEMS[it.kind].name);
  if (t.fire > 0) parts.push('burning');
  parts.push(GROUND[t.ground].name);
  return parts.join(', ');
}

/* Floating windows. A drawer window's target is the drawer id. An inspector's target is { being } or { tile }. */
const sameTarget = (a, b) => typeof a === 'string' ? a === b : a.being != null ? a.being === b.being : b.tile && a.tile.join() === b.tile.join();
function winFind(kind, target){ return ui.windows.find(w => w.kind === kind && sameTarget(w.target, target)); }
/* Inspectors share one saved rect, so each new one steps 24 px down and across, into the first slot no open inspector holds.
   A drawer window keeps one rect per drawer id and opens where it was left. */
const WIN_STEP = 24;
function winOpen(kind, target){
  const have = winFind(kind, target); if (have) return have;
  const saved = ui.rects[kind === 'drawer' ? `drawer:${target}` : 'inspect'] || { x: 80, y: 80, w: 330, h: 420 };
  const held = (n) => ui.windows.some(w => w.kind === 'inspect' && w.x === saved.x + WIN_STEP * n && w.y === saved.y + WIN_STEP * n);
  let n = 0; if (kind === 'inspect') while (held(n)) n++;
  const r = { x: saved.x + WIN_STEP * n, y: saved.y + WIN_STEP * n, w: saved.w, h: saved.h };
  const w = { id: ui.nextWin++, kind, target, ...r };
  ui.windows.push(w);
  const ins = ui.windows.filter(w => w.kind === 'inspect'); if (ins.length > WIN_MAX) winClose(ins[0].id);
  return w;
}
function winClose(id){ ui.windows = ui.windows.filter(w => w.id !== id); if (ui.focus === `window:${id}`) ui.focus = 'map'; }
/* Where Tab goes: the map, each docked drawer in order, then each window in order. */
function focusRing(){
  const out = ui.windows.filter(w => w.kind === 'drawer').map(w => w.target);
  return ['map', ...ui.open.filter(id => !out.includes(id)).map(id => `drawer:${id}`), ...ui.windows.map(w => `window:${w.id}`)];
}

/* The command palette's rows. Static rows come from the key map, one per label. Dynamic rows are built on open.
   STAGE_LETTER lives in keys.js, which loads after this file; this function only reads it when called, not at
   load time, so the order is fine. */
function paletteRows(){
  const out = [], seen = new Set();
  for (const k of KEYMAP){
    if (k.focus === 'speedrow' || k.action === 'rowPick' || k.focus.startsWith('dialog')) continue;
    if (seen.has(k.label)) continue; seen.add(k.label);
    out.push({ label: k.label, key: keyName(k), action: k.action, arg: k.arg, group: k.action === 'help' ? 0 : k.action === 'tool' || k.action === 'drawer' ? 2 : 9 });
  }
  for (const a of alerts()) out.push({ label: `Jump to: ${a.text}`, key: a.n <= 9 ? `Alt+${a.n}` : '', action: 'jumpChip', arg: a.n, group: 1 });
  if (!inAges()) for (const a of campHumans()){ out.push({ label: `Inspect ${a.name}`, key: '', action: 'inspect', arg: a.id, group: 9 }); out.push({ label: `Follow ${a.name}`, key: '', action: 'follow', arg: a.id, group: 9 }); }
  if (!inAges()) for (const g of GOALS) if (!g.locked) for (const [v, l] of [[0, 'Off'], [1, 'On'], [2, 'High']]) out.push({ label: `${g.title}: ${l}`, key: '', action: 'goalPri', arg: { id: g.id, pri: v }, group: 9 });
  if (!inAges()) camps.forEach((c, i) => out.push({ label: `Go to ${c.name}`, key: `F${i + 1}`, action: 'campN', arg: i + 1, group: 9 }));
  if (!inAges()) for (const s of sectors) out.push({ label: `Go to ${s.name} ${s.sx},${s.sy}`, key: '', action: 'gotoSector', arg: { sx: s.sx, sy: s.sy }, group: 9 });
  for (const m of ui.mutes) out.push({ label: `Unmute: ${muteLabel(m)}`, key: '', action: 'unmute', arg: m, group: 9 });
  if (!inAges()) for (const s of STAGES) if (stagesShown().includes(s.id)) out.push({ label: `Goals: ${s.label}`, key: `G ${STAGE_LETTER[s.id].toUpperCase()}`, action: 'stage', arg: s.id, group: 9 });
  for (const g of gods()) out.push({ label: `Inspect ${g.name} ${g.epithet}`, key: '', action: 'inspect', arg: g.id, group: 9 });
  return out;
}
/* Fuzzy match: every word of the query is a substring of the label. Prefix matches first, then shorter labels. Empty query: help, chips, tools and drawers, recent, the rest. */
function paletteMatch(query, rows){
  const q = query.trim().toLowerCase();
  if (!q){
    const rank = r => r.group < 9 ? r.group : ui.recent.includes(r.label) ? 3 + ui.recent.indexOf(r.label) / 10 : 9;
    return rows.slice().sort((a, b) => rank(a) - rank(b));
  }
  const words = q.split(/\s+/);
  const hit = rows.filter(r => { const l = r.label.toLowerCase(); return words.every(w => l.includes(w)); });
  const score = r => (r.label.toLowerCase().startsWith(words[0]) ? 0 : 1) * 1000 + r.label.length;
  return hit.sort((a, b) => score(a) - score(b));
}

/* The name of a save file. The seed goes to lower case, and each run of anything else becomes one
   dash. A seed of nothing but punctuation leaves no name, so it is called the world. */
function saveName(seed, t){
  const s = String(seed == null ? '' : seed).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'world';
  return `hearth-${s}-day-${Math.floor(t / DAY) + 1}.json`;
}
