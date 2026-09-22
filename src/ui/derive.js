/* View model. Pure functions from sim state to what the strip and drawers show. No DOM.
   Everything reads the current `camp` unless it says otherwise. */
const level3 = (v, aim) => v >= aim ? 'good' : v >= aim / 4 ? 'warn' : 'bad';

/* ---- the ages ---- In the gods era there are no tiles, no sectors, no hills, and no people. Everything below
   that reads the valley asks inAges() first. */
const inAges = () => era === 'gods';
/* Which ladder the speed buttons are on. The ages want a quarter and a half, because a creation is minutes
   of a game measured in hours; the days want the old four. H hurries the ages, so nothing above double. */
function ladder(){ return inAges() ? PACES : SPEEDS; }
/* An age as the chronicle names it. A mark holds the absolute age; the telling counts from the Pulse. */
const ageName = n => pulseAge === null || n < pulseAge ? 'Before time' : `Age ${n - pulseAge + 1}`;
const nOf = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/* The caption is the line the act itself wrote. A gesture that wrote no line has no caption. */
function captionFor(rec){
  return rec.said !== null && rec.said !== undefined && legends[rec.said] ? legends[rec.said].text : '';
}
/* The one or two gestures drawn this beat: the act on stage, and the act before it while it fades.
   Mirrors the pair drawField reads in map.js, so a hover on the mark finds the same act the mark shows.
   `creation.gestures` holds only the age now playing; an age that has moved on keeps none of them. */
function liveGestures(){
  const recs = creation.gestureAge === age ? creation.gestures : [];
  return { now: recs.length ? recs[recs.length - 1] : null, before: recs.length > 1 ? recs[recs.length - 2] : null };
}
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
/* The card an act shows on hover, and the card its cell in the timeline opens. It is the same card from
   both, so an act stays readable long after its mark has faded. The weighed row is withheld for a record
   the player made: decideGod marks every option it tried, so the taken row is the first unfailed row and
   is exact; takeTurn applies any row by name and marks only that one, so the rule would point at the wrong
   row. E3 does not store the row a player took; a later slice does.
   No helper named `regionName` exists in the shared scope (checked by grep before writing this); the
   country's own line, `countryLine`, is used for the where row instead, the same string inspectRegion
   already shows for a country's "Country" row. */
function actCard(rec){
  const m = markFor(rec.kind, rec.value);
  const g = beingById(rec.god);
  const said = captionFor(rec);
  const head = said || `${g ? g.name : 'A god'} ${m ? m.word : rec.kind}.`;
  const rows = [{ label: 'when', value: `Age ${rec.age}` }];
  const r = regionById(rec.region !== undefined ? rec.region : rec.near);
  if (r) rows.push({ label: 'where', value: countryLine(r) });
  if (rec.weighed && !rec.byPlayer){
    rows.push({ label: 'weighed', value: rec.weighed.opts.map(o => `${o.type} ${Math.round(o.score)}`).join(' · ') });
  }
  return { head, rows };
}
/* The act behind a timeline chip, `age:god`, for the foot to show the same card a hover would. Only the
   age now playing keeps its gestures (see liveGestures), so a chip from an earlier age finds none here;
   the foot falls back to the chip's own matrix in that case. */
function actCardForChip(key){
  if (!key) return null;
  const [a, id] = String(key).split(':').map(Number);
  if (creation.gestureAge !== a) return null;
  const rec = creation.gestures.find(x => x.age === a && x.god === id);
  return rec ? actCard(rec) : null;
}
/* The gods, in the shape peopleRows gives, so the People drawer can list them. The bar is the god's rest. */
function godRows(){
  return gods().map(g => ({ a: g, m: g.needs.rest, trouble: g.status === 'awake' && g.needs.calm < 20,
    status: g.status === 'dead' ? 'Unmade' : g.status === 'asleep' ? 'Asleep' : g.task ? `Awake: ${g.task.type}` : g.lastChoice && g.lastChoice.picked ? `Awake: ${g.lastChoice.picked}` : 'Awake' }));
}

/* How many beats a frame owes. acc is the part of a beat carried from the last frame. At most eight in a
   frame: more than that is a tab that slept, and a slept tab snaps rather than replaying in fast forward. */
function beatsDue(acc, dt, pace){
  const a = acc + dt * pace / BEAT_MS, n = Math.floor(a);
  return n > 8 ? { n: 8, acc: 0 } : { n, acc: a - n };
}

/* Whether the drawing holds at the end of its beat instead of playing. A world the player paused between
   beats holds, so nothing sits half drawn. A world the player stepped plays its beat and then holds, which
   is the whole of what Step is for. A dialog holds everything. */
function beatStill(dialogOpen){ return dialogOpen || (paused && !ui.playing); }

/* ---- the act in motion ---- The pure parts of the tween. map.js draws; these three say what to draw.
   They read no state but TWEEN and the field's width, so tests/ui.js runs them in Node. */

/* What a beat of this many milliseconds is worth drawing. The length is BEAT_MS / pace, read at run
   time, so no tier names a pace. A full beat draws everything; a shorter one drops the intent cue and
   keeps the act's figure, its caption and the cross-fade. Two lower tiers, a walk-only one and a snap,
   stood below these. No pace on PACES could reach them, so they went, and the branches that read them
   went with them. tests/ui.js holds the ladder to the paces: every pace must buy at least TWEEN.figure
   milliseconds. Add a pace that cannot, and that test fails rather than the field quietly drawing a
   figure it has no time for. */
function beatTier(ms){
  if (ms >= TWEEN.full) return 'full';
  return 'figure';
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

/* The camp the player has chosen, or null. `camp` can outlive a camp that is gone, so the list decides. */
const chosenCamp = () => camp && camps.includes(camp) ? camp : null;
/* Which camp the People drawer lists: a camp record, or null for everyone. `ui.peopleCamp` is null to
   follow the chosen camp, a camp id, or 'all'. A camp id that is no longer in `camps` falls back to
   the chosen camp, so a camp that ends does not leave the list empty. */
function peopleScope(){
  if (ui.peopleCamp === 'all') return { camp: null };
  const picked = typeof ui.peopleCamp === 'number' ? camps.find(c => c.id === ui.peopleCamp) : null;
  return { camp: picked || chosenCamp() };
}
/* People in the drawer's camp and age, trouble first. Everyone is a candidate, in any camp or none,
   and the two filters then narrow the list. The dead stay on the list for a day after the stamp.
   `makeBeing` leaves `diedAt` undefined, and a death at tick 0 stamps a 0, so the test is for the
   field, never for its truth. Camp order sorts after the living, so a mixed list keeps each camp
   together, and a person with no camp goes last. */
function peopleRows(){
  const only = peopleScope().camp, age = ui.peopleAge;
  const rows = beings.filter(b => b.species === 'human' && (b.alive || (b.diedAt !== undefined && b.diedAt !== null && tick - b.diedAt < DAY))
    && (!only || b.camp === only) && (age === 'any' || stage(b) === age)).map(a => {
    const m = a.alive ? mood(a) : 0;
    const bad = a.alive && (a.needs.warmth < 30 || a.needs.food < 25 || a.needs.water < 25 || a.hp < 50);
    return { a, m, trouble: !!bad, status: a.alive ? a.status : 'Dead' };
  });
  const order = b => { const i = b.camp ? camps.indexOf(b.camp) : -1; return i < 0 ? camps.length : i; };
  return rows.sort((p, q) => (q.trouble - p.trouble) || (q.a.alive - p.a.alive) || (order(p.a) - order(q.a)) || p.a.name.localeCompare(q.a.name));
}
/* The drawer's count: the living people shown, and the living people in the world. The dead of the
   last day are on the list but count in neither, so the two agree when no filter hides anyone. */
function peopleCount(){
  return { shown: peopleRows().filter(r => r.a.alive).length, alive: beings.filter(b => b.species === 'human' && b.alive).length };
}
/* The camp button's label. */
function peopleCampLabel(){ const c = peopleScope().camp; return c ? `Camp: ${c.name}` : 'Everyone'; }
/* The age button's label. */
const peopleAgeLabel = () => `Age: ${ui.peopleAge}`;
/* The count after the drawer's title, without its leading dot: "5 of 18" when a filter hides some
   living people, else "18". The drawer and a popped-out window both read it, so the two agree. */
function peopleCountText(){ const n = peopleCount(); return n.shown === n.alive ? `${n.alive}` : `${n.shown} of ${n.alive}`; }
/* A popped-out People window has no filter row, so its title carries the count and both filters. */
const peopleTitle = () => ['People', peopleCountText(), peopleCampLabel(), peopleAgeLabel()].join(' \u00b7 ');
/* The text of an empty list. The filters can hide everyone while people live, and the line says so. */
const peopleEmptyText = () => peopleCount().alive > 0 ? 'Nobody matches these filters.' : 'Nobody yet.';
/* True when the list shows more than one camp, or a person with no camp. Then each row names its camp. */
function peopleMixed(){
  const seen = new Set(peopleRows().map(r => r.a.camp || null));
  return seen.size > 1 || seen.has(null);
}

/* The state lines on a person's card: short facts about what holds them right now, one idea each.
   The card serves the hover tip and the pinned window, so one list covers both. Raw text comes back
   and the card escapes it. Only a living person carries these; a beast, a god, and the dead get none.
   This reads the being and the tick and writes nothing. */
function stateLines(a){
  if (!a || a.species !== 'human' || !a.alive) return [];
  const out = [];
  if (a.inDark) out.push('In the dark without a brand.');
  if (a.cooldown && a.cooldown.stalked > tick) out.push('The wolves keep their distance for now.');
  return out;
}

/* One plain-English line for a hover on a name. Every field of the record, in order. */
function nameTitle(rec){
  if (!rec) return '';
  const who = rec.by === null ? 'named by the camp' : rec.by === 'lost' ? 'named by the lost people' : `named by ${(beingById(rec.by) || { name: 'somebody' }).name}`;
  return [
    rec.tongue === 'old' ? `${rec.text}, ${rec.meaning}, in the old tongue` : rec.text,
    `since day ${Math.floor(rec.since / DAY) + 1}`,
    rec.why,
    who,
    rec.scores && rec.scores.length ? `scores: ${rec.scores.map(s => `${s.text} ${s.score}`).join(', ')}` : '',
  ].filter(Boolean).join('. ') + '.';
}
/* The current camp's name now, and the names it had before. */
function campNames(){ return { now: camp.names && camp.names.length ? camp.names[0] : null, past: formerNames(camp) }; }
/* A sector's label. Once it has a name of its own, the biome word stays beside it, so the ground
   a name was given for is still there. With no name yet it is just the biome word, as before. */
function sectorLabel(s){
  const n = nameOf(s);
  if (!n) return s.name;
  const w = s.name.toLowerCase();
  return `${n}, ${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;
}
/* A sector inside a sentence that already has its own words around it ("in ... at 3,4."). A named
   sector is a proper noun and needs no article of its own; an unnamed one is still just its biome
   word, lower-cased to sit mid-sentence, with 'the' in front as it always read. */
function sectorProse(s){ return nameOf(s) || `the ${s.name.toLowerCase()}`; }

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
  /* The seasons are not all the same length, so the days left are counted off this season's own
     length rather than one shared number. */
  const s = seasonOf(), i = SEASONS.indexOf(s), next = SEASONS[(i + 1) % 4];
  let d = dayOfYear(); for (let k = 0; k < i; k++) d -= SEASON_LENGTHS[k];
  const left = SEASON_LENGTHS[i] - d + 1;
  return `${s[0].toUpperCase()}${s.slice(1)}, ${next} in ${left}`;
}

/* The rows a drawer's keys act on, in the order the drawer shows them. */
function drawerRows(id){
  /* A person's row shows their full name, epithet and all; a god's row is untouched by that, since
     a god already carries its own epithet from creation and its row read that way before names. */
  if (id === 'people') return (inAges() ? godRows() : peopleRows()).map(r => ({ kind: 'person', id: r.a.id, r, label: r.a.species === 'human' ? fullName(r.a) : r.a.name }));
  if (id === 'goals'){
    if (inAges()) return [];
    const out = [];
    for (const s of stages(ui.showAll)){ out.push({ kind: 'stage', id: s.id, s }); for (const x of s.goals) if (!x.hidden || ui.unfold[s.id]) out.push({ kind: 'goal', id: x.g.id, x }); }
    return out;
  }
  /* The search's thing list is built once for the whole pass, not once for each of 300 lines. */
  if (id === 'chronicle'){
    const set = ui.chronSearch ? nameMatchSet() : null;
    return chronicle.filter(e => (ui.chronFilter === 'all' || e.kind === 'major' || e.kind === 'death') && chronicleMatches(e, ui.chronSearch, set)).map(e => ({ kind: 'line', id: e.tick + e.text, e }));
  }
  if (id === 'legends') return legends.map((e, i) => ({ kind: 'legend', id: i, e }));
  return [];
}

/* ---------- the timeline ----------
   The record of the creation, laid flat under the map. It reads `creation.choices`, which the sim
   keeps: one entry for each god that decided in each age, with that god's whole scored option list,
   what it picked, and what failed to apply. The view neither sorts nor scores. Nothing here reaches
   into a rule, and nothing here changes one. */

/* How many ages the band covers. Zoom 0 is the default and keeps the near ages large; each step out
   doubles the span. The span never begins before age one, and never ends before the live age. */
const TL_SPAN = 12, TL_ZOOM_MAX = 9;
function timelineSpan(zoom, now){
  const want = TL_SPAN * Math.pow(2, Math.max(0, Math.min(TL_ZOOM_MAX, zoom)));
  return { from: Math.max(1, now - want + 1), to: Math.max(1, now) };
}

/* One cell's words. A carried act says so. A free choice names what it took, or says the ground
   refused every option it had. */
function tlCellText(rec, withWho){
  const g = beingById(rec.god);
  const who = withWho && g ? `${g.name}: ` : '';
  if (rec.continued) return `${who}carries on`;
  if (!rec.picked) return `${who}finds nothing it can do`;
  return `${who}${rec.picked}`;
}

/* A placeholder for an age a row has nothing to show for. It carries the same shape as a filled
   cell, blank so timeline.js can draw it and give it the filled cell's own width. */
const tlBlank = ageN => ({ age: ageN, text: '', chip: null, major: false, blank: true, playing: false });

function timelineModel(){
  const empty = { shown: false, folded: ui.timelineFold !== false, from: 1, to: 1, now: 0, rows: [], marks: [] };
  if (!inAges() || !creation || !creation.choices) return empty;
  const now = age;
  const { from, to } = timelineSpan(ui.timelineZoom | 0, now);
  const inSpan = creation.choices.filter(c => c.age >= from && c.age <= to);
  /* The playing cell is the newest turn decided this age: not the newest gesture. A decision can carry
     more than one gesture (a split that also gives birth to a new god writes a `split` and a `born`
     gesture in a row), and the birth is credited to the newborn, who has no choices row of its own yet.
     Following `liveGestures().now` would then light nothing, or the wrong row, for exactly the beat
     that gesture draws. The turn itself is what the timeline's rows and the act card both key on, so
     that is what stays lit until the next god decides.
     An age-end beat is the exception: `unmake` and `backstop` (gods.js, called from `ageEnd`) run after
     every god in the age has already had its turn, and neither writes a `choices` row. On that beat the
     newest gesture this age is `unmade` or `backstop`, and no turn is on stage, so nothing should light:
     lighting the last turn would name an act that already finished earlier in the same age, while the
     map is drawing the age-end act instead. */
  const thisAge = creation.choices.filter(c => c.age === age);
  const last = thisAge.length ? thisAge[thisAge.length - 1] : null;
  const nowGesture = liveGestures().now;
  const atAgeEnd = !!nowGesture && (nowGesture.kind === 'unmade' || nowGesture.kind === 'backstop');
  const playing = rec => !atAgeEnd && !!last && last.god === rec.god && rec.age === age;
  const cell = (rec, withWho) => ({ age: rec.age, text: tlCellText(rec, withWho), major: !!rec.picked && !rec.continued, chip: `${rec.age}:${rec.god}`, blank: false, playing: playing(rec) });
  if (ui.timelineFold !== false){
    return { shown: true, folded: true, from, to, now, marks: [],
      rows: [{ id: 'all', label: 'The ages', cells: inSpan.map(r => cell(r, true)) }] };
  }
  /* Unfolded, a column must mean one age: every row gets one cell for every age in the span, filled
     where the row has something to show and blank where it does not. That is the whole point of the
     unfolded view, so a player can read down a column and see what several gods did at once. */
  const rows = [];
  for (const g of gods()){
    const mine = inSpan.filter(c => c.god === g.id);
    if (!mine.length && g.status !== 'awake') continue;
    const byAge = new Map(mine.map(r => [r.age, r]));
    const cells = [];
    for (let a = from; a <= to; a++){ const rec = byAge.get(a); cells.push(rec ? cell(rec, false) : tlBlank(a)); }
    rows.push({ id: g.id, label: g.name, pole: g.pole, cells });
  }
  /* The gate is what the whole creation is steering toward, so it gets a row of its own. It reads
     `ok` and `lack` and nothing else: the gate object carries a whole region inside it. Its state is
     about now, so it sits under the now-line, in the last cell of the span; every earlier age is blank. */
  const gate = creation.gate;
  const gateCells = [];
  for (let a = from; a <= to; a++){
    gateCells.push(a !== to ? tlBlank(a) : { age: a, text: gate ? (gate.ok ? 'the world will hold' : `wants ${gate.lack}`) : 'not weighed yet', major: false, chip: null, blank: false, playing: false });
  }
  rows.push({ id: 'gate', label: 'The gate', cells: gateCells });
  return { shown: true, folded: false, from, to, now, rows, marks: [] };
}

/* One chip, opened. The matrix is the record's own, in the record's own order. */
function chipMatrix(key){
  if (!key || !creation || !creation.choices) return null;
  const [a, id] = String(key).split(':').map(Number);
  const rec = creation.choices.find(c => c.age === a && c.god === id);
  if (!rec) return null;
  const g = beingById(rec.god);
  return { age: rec.age, god: rec.god, name: g ? g.name : 'someone gone', picked: rec.picked || null,
    byPlayer: !!rec.byPlayer, continued: !!rec.continued, opts: rec.opts || [] };
}

/* What the foot says about an opened chip. The head names the god, the age, and what it did. The rows
   are the matrix as the record holds it, at most four, so the foot stays shallow on a laptop.
   decideGod walks its options in order and marks every one it cannot land as failed, so for a record
   the engine wrote, the taken row is the first option that is not failed: that is the order the
   engine tried them in. A player, by contrast, takes an option by name at any index, and only that
   row's `failed` flag is ever set; an earlier untried row would then wrongly read as the one taken.
   So for a `byPlayer` record no row is marked taken here — the head already says the hand was the
   player's. A continued record, or one where every option failed, has no taken row either. Where a
   taken row exists it always shows, even when several failed options would push it past the four-row
   cap: then the first three rows show, and the taken row takes the fourth place in place of whichever
   row it would have displaced. */
function footChip(){
  const m = chipMatrix(ui.timelineChip);
  if (!m) return null;
  const did = m.continued ? 'carries on' : m.picked ? `takes ${m.picked}` : 'finds nothing it can do';
  const hand = m.byPlayer ? ', by your hand' : '';
  const takenIdx = m.picked && !m.byPlayer ? m.opts.findIndex(o => !o.failed) : -1;
  const all = m.opts.map((o, i) => ({ type: o.type, score: o.score, failed: !!o.failed, taken: i === takenIdx }));
  const rows = takenIdx >= 4 ? all.slice(0, 3).concat(all[takenIdx]) : all.slice(0, 4);
  return { head: `Age ${m.age}. ${m.name} ${did}${hand}.`, rows };
}

/* A short string that changes when anything the strip or drawers show changes. */
function viewKey(){
  if (inAges()) return ['ages', age, legends.length, creation.discards, gods().map(g => g.id + g.status).join('|'), ui.open.join(''), ui.focus, JSON.stringify(ui.row), ui.chronFilter, ui.chronSearch, ui.peopleCamp, ui.peopleAge, cursor.x, cursor.y, ui.overlay, ui.timelineFold, ui.timelineZoom, ui.timelineChip, creation.choices.length].join('#');
  const g = gauges();
  return [camp.id, camp.name, JSON.stringify(g), alerts().map(a => a.text).join('|'), stages(ui.showAll).map(s => s.goals.map(x => x.st.s + x.pr + x.hidden).join('')).join(','),
    peopleRows().map(r => `${r.a.id}${r.m >> 2}${r.status}`).join('|'), chronicle.length, chronicle[0] ? chronicle[0].tick : 0, ui.open.join(''), ui.focus, JSON.stringify(ui.row), ui.chronFilter, ui.chronSearch, ui.peopleCamp, ui.peopleAge, JSON.stringify(ui.unfold),
    cursor.x, cursor.y, cursor.z, ui.overlay].join('#');
}

/* The tile the camp fire view centres on: the chosen camp's pit, or its site before the pit is built.
   Null with no camp, or a camp with neither, and then the view is left out of the cycle. */
/* viewCamp can outlive the camp it points at: a camp destroyed while its fire view was on screen leaves
   a stale reference until the next renderUI pass corrects it. camps.includes guards that the same way
   the frame loop does before it reads viewCamp. */
function fireCentre(){ return viewCamp && camps.includes(viewCamp) ? viewCamp.pit || viewCamp.site || null : null; }
/* The sector that holds the fire the camp fire view centres on, or null with no fire. The view's line
   names this sector and not the cursor's, which keyboard moves carry into the next sector. */
function fireSector(){ const p = fireCentre(); if (!p) return null; const f = secOf(p[0], p[1]); return sectors[secIdx(f.sx, f.sy)]; }
/* The view M goes to next from v. The camp fire view is skipped when there is no fire to centre on. */
function nextView(v){ const n = NEXT_VIEW[v]; return n === 'fire' && !fireCentre() ? NEXT_VIEW[n] : n; }
/* The top-left tile of the sector view and the camp fire view. Every conversion between their pixels
   and tiles reads it: the drawing, the pointer, the cursor, and the tools. The camp fire view puts the
   centre at the middle tile, and stops at the world's edges so it never shows past them. */
function locOrigin(){
  const p = view === 'fire' && fireCentre();
  if (p) return { ox: clamp(p[0] - (LW >> 1), 0, W - LW), oy: clamp(p[1] - (LH >> 1), 0, H - LH) };
  return { ox: cur.sx * LW, oy: cur.sy * LH };
}
/* Whether the tile is on screen in the sector view or the camp fire view. */
function inLocView(x, y){ const { ox, oy } = locOrigin(); return x >= ox && x < ox + LW && y >= oy && y < oy + LH; }

/* Where the cursor lands after a move. mult is a number of tiles, 'sector', or 'edge'. In the nearby and world views every step is a sector.
   'edge' goes to the sector's edge on that side, and keeps the row or the column. From the edge it goes one sector on, to the same edge there.
   The camp fire view moves as the sector view does. */
function cursorAfter(c, dx, dy, mult, view){
  const near = closeUp(view);
  if (mult === 'edge' && near){
    const s = secOf(c.x, c.y);
    const ex = dx < 0 ? s.sx * LW : dx > 0 ? (s.sx + 1) * LW - 1 : c.x, ey = dy < 0 ? s.sy * LH : dy > 0 ? (s.sy + 1) * LH - 1 : c.y;
    if (ex !== c.x || ey !== c.y) return { x: ex, y: ey, z: c.z };
    const nx = c.x + dx * LW, ny = c.y + dy * LH;
    return nx < 0 || ny < 0 || nx >= W || ny >= H ? { x: c.x, y: c.y, z: c.z } : { x: nx, y: ny, z: c.z };
  }
  if (mult === 'edge') mult = 'sector';
  const sx = mult === 'sector' || !near ? LW : mult, sy = mult === 'sector' || !near ? LH : mult;
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
function winClose(id){ ui.windows = ui.windows.filter(w => w.id !== id); if (ui.focus === `window:${id}`) setFocus('map'); }
/* Where Tab goes: the map, each docked drawer in order, then each window in order. */
function focusRing(){
  const out = ui.windows.filter(w => w.kind === 'drawer').map(w => w.target);
  /* The timeline is out of the ring once a world is settled: `creation` is still set, but the ages are over
     and the band has nothing live to show. Before any world is made the band is not shown either, so Tab
     must not stop on it. */
  return ['map', ...ui.open.filter(id => !out.includes(id)).map(id => `drawer:${id}`), ...ui.windows.map(w => `window:${w.id}`), ...(inAges() ? ['timeline'] : [])];
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
  if (!inAges()) for (const s of sectors) out.push({ label: `Go to ${sectorLabel(s)} ${s.sx},${s.sy}`, key: '', action: 'gotoSector', arg: { sx: s.sx, sy: s.sy }, group: 9 });
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

/* ---- the lost people, and the chronicle search ---- */
/* Where an old name can sit, and the word the help page calls that thing. A burrow carries no old
   name, so it never reaches this list. The valley, the camps, and the sectors are named by the
   living, not by the lost, so they stay out too. */
const LEARNED_KINDS = [['hill', () => hills], ['cave', () => caves], ['grove', () => groves], ['crossing', () => fords], ['river', () => [river]], ['lake', () => [stillWater]]];
/* The valley's name, or null while it has none that anybody has read. The map's title, the help
   page, and the chronicle search ask this one question, so the three never disagree. */
const valleyName = () => valley && valley.nameKnown !== false ? nameOf(valley) : null;
/* Every old name somebody has read, for the help page. A name nobody has found is not shown.
   This reads the records and changes none of them. The text comes back raw; the page escapes it. */
function learnedNames(){
  const out = [];
  for (const [what, list] of LEARNED_KINDS) for (const t of (list() || [])) if (t && t.nameKnown && t.names && t.names.length) out.push({ text: t.names[0].text, meaning: t.names[0].meaning, what });
  return out;
}
/* The chronicle search. A query that matches a thing's name, now or before, matches every line
   that used either, so an old line still answers to the new name. A thing whose name nobody has
   read is skipped: the search must not give away what the marks have not told.
   A pass over the whole chronicle builds the list of things once, with `nameMatchSet`, and hands
   it in. Built per line it cost a spread of every named thing for each of three hundred rows, on
   every keystroke. With no set given the function builds its own, so one call still answers. */
function nameMatchSet(){
  const out = [];
  for (const t of nameThings()){
    if (t.nameKnown === false) continue;
    const texts = (t.names || []).map(r => r.text);
    if (texts.length) out.push(texts);
  }
  return out;
}
function chronicleMatches(e, q, set){
  if (!q) return true;
  const needle = String(q).trim().toLowerCase();
  if (!needle) return true;
  if (e.text.toLowerCase().includes(needle)) return true;
  for (const list of (set || nameMatchSet())){
    if (!list.some(x => x.toLowerCase().includes(needle))) continue;
    if (list.some(x => e.text.includes(x))) return true;
  }
  return false;
}
/* The name of a save file. The seed goes to lower case, and each run of anything else becomes one
   dash. A seed of nothing but punctuation leaves no name, so it is called the world. */
function saveName(seed, t){
  const s = String(seed == null ? '' : seed).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'world';
  return `hearth-${s}-day-${Math.floor(t / DAY) + 1}.json`;
}
