/* View model. Pure functions from sim state to what the strip and drawers show. No DOM.
   Everything reads the current `camp` unless it says otherwise. */
const level3 = (v, aim) => v >= aim ? 'good' : v >= aim / 4 ? 'warn' : 'bad';

function daysOfWood(){
  const p = camp.pit && tileAt(...camp.pit).struct;
  const fuel = (p ? p.fuel : 0) + camp.stash.stick * STICK_FUEL + camp.stash.log * LOG_FUEL;
  return fuel / (PIT_BURN * DAY);
}
function gauges(){
  const p = camp.pit && tileAt(...camp.pit).struct;
  const days = daysOfWood();
  const hearth = !p ? null : { v: Math.min(1, p.fuel / PIT_MAX), text: !p.lit ? (p.fuel > 0 ? 'laid, cold' : 'out') : days < 1 ? 'under a day of wood' : `${Math.floor(days)} days of wood`, level: !p.lit ? 'bad' : days < 1 ? 'bad' : days < 2 ? 'warn' : 'good' };
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

/* Pulses: a major or death line, or a goal that just left blocked, shows as a chip for 1500 ticks. */
function notePulses(){
  ui.pulses = ui.pulses.filter(p => p.until > tick);
  for (const e of chronicle){
    if (e.tick <= ui.seenTick) break;
    if ((e.kind === 'major' || e.kind === 'death') && e.tick + 1500 > tick) ui.pulses.push({ text: e.text, until: e.tick + 1500 });
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
  if (camp.fae.known && camp.fae.favor < -20) add('sprites', `Sprite favour is ${camp.fae.favor}`, 'warn', {});
  if (groves.some(gr => gr.swarmUntil > tick)) add('sprites', 'A grove is out for revenge', 'bad', {});
  for (const pu of ui.pulses) add('event', pu.text, 'info', { being: pu.being, tile: pu.tile });
  return out;
}

/* Goals by stage. A stage shows when reached. Done goals fold to a count. A blocked goal hides until its prerequisite is done. Idle recipes fold. */
function stages(showAll){
  const byId = Object.fromEntries(GOALS.map(g => [g.id, g]));
  return STAGES.filter(s => showAll || stageReached(s.id)).map(s => {
    const goals = GOALS.filter(g => g.stage === s.id).map(g => {
      const st = goalState(g), pr = goalPriority[g.id] ?? 1;
      const preq = g.after && byId[g.after];
      const hidden = !showAll && (st.s === 'done' || (st.s === 'idle' && !!g.recipe) || (st.s === 'blocked' && preq && goalState(preq).s !== 'done'));
      return { g, st, pr, hidden };
    });
    return { id: s.id, label: s.label, done: goals.filter(x => x.st.s === 'done').length, idle: goals.filter(x => x.st.s === 'idle' && x.hidden).length, goals };
  });
}

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
  const s = seasonOf(), next = SEASONS[(SEASONS.indexOf(s) + 1) % 4], left = SEASON_DAYS - ((dayOf() - 1) % SEASON_DAYS);
  return `${s[0].toUpperCase()}${s.slice(1)}, ${next} in ${left}`;
}

/* The rows a drawer's keys act on, in the order the drawer shows them. */
function drawerRows(id){
  if (id === 'people') return peopleRows().map(r => ({ kind: 'person', id: r.a.id, r }));
  if (id === 'goals'){
    const out = [];
    for (const s of stages(ui.showAll)){ out.push({ kind: 'stage', id: s.id, s }); for (const x of s.goals) if (!x.hidden || ui.unfold[s.id]) out.push({ kind: 'goal', id: x.g.id, x }); }
    return out;
  }
  if (id === 'chronicle') return chronicle.filter(e => ui.chronFilter === 'all' || e.kind === 'major' || e.kind === 'death').map(e => ({ kind: 'line', id: e.tick + e.text, e }));
  return [];
}

/* A short string that changes when anything the strip or drawers show changes. */
function viewKey(){
  const g = gauges();
  return [camp.id, camp.name, JSON.stringify(g), alerts().map(a => a.text).join('|'), stages(ui.showAll).map(s => s.goals.map(x => x.st.s + x.pr + x.hidden).join('')).join(','),
    peopleRows().map(r => `${r.a.id}${r.m >> 2}${r.status}`).join('|'), chronicle.length, chronicle[0] ? chronicle[0].tick : 0, ui.open.join(''), ui.focus, JSON.stringify(ui.row), ui.chronFilter, JSON.stringify(ui.unfold),
    cursor.x, cursor.y, cursor.z].join('#');
}

/* Where the cursor lands after a move. mult is a number of tiles, or 'sector'. In the nearby and world views every step is a sector. */
function cursorAfter(c, dx, dy, mult, view){
  const sx = mult === 'sector' || view !== 'loc' ? LW : mult, sy = mult === 'sector' || view !== 'loc' ? LH : mult;
  return { x: clamp(c.x + dx * sx, 0, W - 1), y: clamp(c.y + dy * sy, 0, H - 1), z: c.z };
}
/* One phrase for what is under the cursor. A being first, then the tile. */
function cursorPhrase(){
  const a = beings.find(b => b.alive && b.x === cursor.x && b.y === cursor.y && b.z === cursor.z);
  if (a) return `${a.name}, ${a.alive ? a.status.toLowerCase() : 'dead'}`;
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
function winOpen(kind, target){
  const have = winFind(kind, target); if (have) return have;
  const r = ui.rects[kind === 'drawer' ? `drawer:${target}` : 'inspect'] || { x: 80 + 24 * (ui.windows.length % 5), y: 80 + 24 * (ui.windows.length % 5), w: 330, h: 420 };
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
