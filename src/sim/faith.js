/* ---------- the sky and its people: belief, grace, prayers, miracles, and the seasons ----------
   A world made with `options.faith` is a game. Each person believes in the sky, from 0 to 100. Every
   believer gives the sky grace, and every miracle costs grace. People in trouble pray, and the sky
   answers, or they cope alone, or nobody comes. Belief moves with what they saw.

   With faith off, every rule here returns at once and nothing else in the sim reads `faith`, so the
   world is the sandbox it was and the golden record does not move. No rule here draws a random
   number. A miracle may start a rule that draws (a storm's end, a fleeing wolf's path), and that is
   safe because every miracle is a door act and is in the door log.

   Prayers and signs name beings and camps by id, never by reference, so the whole of `faith` is plain
   data and a snapshot saves it as it is. The numbers are the proposal's, in
   design/proposals/2026-09-26-the-sky-plays.md. Durations and rates are in `CLOCK.faith`. */

/** @type {Faith|null} */
let faith = null;

/* Amounts that are not time. */
const FAITH = {
  belief: { founder: 40, newcomer: 20, floor: 5, top: 100, witness: 2 },
  graceCap: 100,
  /* The grace each miracle costs, by the name of its door act. `light` is the Spark. */
  cost: { light: 15, rain: 40, ward: 15, beckon: 20 },
  /* How a prayer's end moves belief: the one who prayed, everyone else in their camp, and the mood of
     the thought the one who prayed is left with. A death before the answer is the silent row. */
  outcome: {
    sky:    { prayer: 20, others: 6, mood: 6 },
    own:    { prayer: -4, others: 0, mood: 2 },
    silent: { prayer: -12, others: -3, mood: -6 },
  },
  coldBelow: 40,        // warmth under this is cold enough to pray for fire in the day
  hungryBelow: 30,      // food under this is hungry enough to pray
  wolfNear: 8,          // a wolf or a fox this close at night is a reason to pray
  fireSafe: 8,          // this close to a lit pit, nobody prays about a wolf
  wildfireRadius: 12,   // a fire this close to the camp site, on the valley floor, is a wildfire
  witnessRadius: 10,    // a person this close to a miracle saw it
  wardRadius: 10,       // how far a Ward reaches
  beckonRadius: 30,     // how far a Beckon is heard
  beckonMost: 4,        // how many animals one Beckon draws
  beckonWithin: 3,      // how close to the spot they come
  /* How near the trouble a sign must be to be the answer. */
  near: { fire: 12, hunger: 20 },
  keepClosed: 40,       // closed prayers kept for the page to show
};

/* Every sentence a player reads from these rules. `{name}` and the other slots are filled by `faithSay`. */
const FAITH_TEXT = {
  pray: {
    fire: '{name} prays for fire.',
    hunger: '{name} prays for food.',
    wolf: '{name} prays to be kept from the wolf.',
    wildfire: '{name} prays for rain on the fire.',
  },
  heard: {
    fire: 'The sky heard {name}. The fire caught.',
    hunger: 'The sky heard {name}. There is food again.',
    wolf: 'The sky heard {name}. The wolf turned away.',
    wildfire: 'The sky heard {name}. The fire is out.',
  },
  own: {
    fire: "{name}'s people lit the fire by their own hands.",
    hunger: "{name}'s people found food by their own hands.",
    wolf: '{name} was safe from the wolf without the sky.',
    wildfire: 'The fire near {name} went out without the sky.',
  },
  silent: 'The sky was silent when {name} called.',
  died: '{name} died before the sky answered.',
  someone: 'Someone',
  thought: { sky: 'The sky heard my prayer', own: 'We managed without the sky', silent: 'The sky did not answer' },
  forgotten: 'Nobody believes in the sky now. It cannot act.',
  remembered: 'Someone believes in the sky again.',
  rain: 'Rain falls from a clear sky.',
  ward: 'The sky guards the ground.',
  wardFled: 'The sky guards the ground. {count}.',
  beckon: 'The sky calls. {count} come to the call.',
  beckonLabel: 'Drawn by a call from the sky',
  reply: {
    paid: '{said} It cost {cost} grace.',
    rain: 'Rain. It will fall for a few hours.',
    ward: 'The ground is guarded for a day.',
    beckon: '{count} come to the call.',
  },
  refuse: {
    off: 'The sky plays only in a world made to be played.',
    early: 'The valley is not made yet.',
    forgotten: 'Nobody believes in the sky. It cannot act.',
    grace: 'Your grace is too thin. {have} of {cost}.',
    raining: 'It is already raining.',
    nowhere: 'The sky cannot reach that place.',
    noBeasts: 'No deer or rabbit is near enough to hear.',
  },
  tally: {
    ends: '{season} ends.',
    believe: '{n} of {of} believe.',
    nobody: 'Nobody prayed.',
    answered: 'The sky answered {count}.',
    answeredSilent: 'The sky answered {count} and was silent {times}.',
    own: 'The people met {count} by their own hands.',
    born: '{count}.',
    died: '{count}.',
    spent: 'The sky spent {n} grace.',
  },
  times: ['no times', 'once', 'twice'],
};
/* Fill the slots of one sentence. */
const faithSay = (text, slots) => text.replace(/\{(\w+)\}/g, (m, k) => slots[k] === undefined ? m : String(slots[k]));

/* ---------- the prayers ----------
   One row per kind of trouble. `trouble(c)` is the camp's trouble, true or a thing it found; it is
   the camp's and not one person's, so nobody prays twice for the same trouble. `who(c, found)` is the
   one who prays, or null. `places(p, c)` are where the answer must fall, and `near` how close, or
   null for anywhere. `answers` are the miracles that count. Each reads `camp`, which the caller sets. */
const isEvening = () => { const s = tick % DAY; return s >= CLOCK.faith.evening || s < CLOCK.night.lifts; };
const nextDawn = () => Math.floor(tick / DAY) * DAY + CLOCK.night.lifts + (tick % DAY >= CLOCK.night.lifts ? DAY : 0);
/* A person who can pray: awake, believing above the floor, with no prayer open. */
const canPray = a => a.alive && !a.asleep && a.belief > FAITH.belief.floor && !faith.prayers.some(p => !p.end && p.who === a.id);
/* The lowest score, and on a tie the first in the list. No random number. */
function lowest(list, score){ let best = null, bs = Infinity; for (const a of list){ const s = score(a); if (s < bs){ best = a; bs = s; } } return best; }
/* The nearest wolf or fox that makes a person afraid, or null. A person by a lit pit is safe. */
function beastNear(a){
  const pit = a.camp && a.camp.pit ? tileAt(a.camp.pit[0], a.camp.pit[1]) : null;
  if (pit && pit.struct && pit.struct.lit && nearAt(a, pit.x, pit.y) <= FAITH.fireSafe) return null;
  let best = null;
  for (const b of beings) if (b.alive && SPECIES[b.species].warded && near(a, b) <= FAITH.wolfNear && (!best || near(a, b) < near(a, best))) best = b;
  return best;
}
const PRAYERS = {
  fire: {
    trouble(){ const t = pitTile(); return t && t.struct && !t.struct.lit && t.struct.fuel > 0 ? t : null; },
    who(){ const ev = isEvening(); return lowest(campHumans().filter(a => canPray(a) && (ev || a.needs.warmth < FAITH.coldBelow)), a => a.needs.warmth); },
    where: (c, a, t) => [t.x, t.y, 0],
    places: (p, c) => c.pit ? [[c.pit[0], c.pit[1], 0]] : [p.where],
    near: FAITH.near.fire, answers: ['light'], byDawn: true,
  },
  hunger: {
    trouble(){ return stashFood() <= 0 && campHumans().some(a => a.needs.food < FAITH.hungryBelow); },
    who(){ return lowest(campHumans().filter(a => canPray(a) && a.needs.food < FAITH.hungryBelow), a => a.needs.food); },
    where: (c, a) => c.site ? [c.site[0], c.site[1], 0] : [a.x, a.y, a.z],
    places: (p, c) => [p.where, ...(c.site ? [[c.site[0], c.site[1], 0]] : []), ...c.snares.map(s => [s.x, s.y, 0])],
    near: FAITH.near.hunger, answers: ['beckon'],
  },
  wolf: {
    trouble(){ return isNight() && campHumans().some(a => beastNear(a)); },
    who(){ return lowest(campHumans().filter(a => canPray(a) && beastNear(a)), a => near(a, beastNear(a))); },
    where: (c, a) => [a.x, a.y, a.z],
    places: (p) => { const a = beingById(p.who); return a ? [p.where, [a.x, a.y, a.z]] : [p.where]; },
    near: FAITH.wardRadius, answers: ['ward'],
  },
  wildfire: {
    trouble(c){
      if (!c.site || fireCount <= 0) return null;
      const r = FAITH.wildfireRadius, [sx, sy] = c.site;
      for (let y = sy - r; y <= sy + r; y++) for (let x = sx - r; x <= sx + r; x++){
        if (!inb(x, y) || (c.pit && c.pit[0] === x && c.pit[1] === y)) continue;
        const t = tileAt(x, y); if (t.fire > 0) return t;
      }
      return null;
    },
    who(c, t){ return lowest(campHumans().filter(canPray), a => nearAt(a, t.x, t.y)); },
    where: (c, a, t) => [t.x, t.y, 0],
    places: () => [],
    near: null, answers: ['rain'],
  },
};

/* ---------- the tick ---------- */
function startFaith(){
  faith = { grace: 0, spent: 0, prayers: [], signs: [], tallies: [], troubles: {}, forgotten: false, nextPrayer: 1,
    season: seasonOf(), since: freshTally() };
}
function freshTally(){ return { answered: 0, ownHands: 0, silent: 0, births: 0, deaths: 0, spent: 0, tick }; }
/* True when the rules should run: a world made to be played, in the days. It starts the record the
   first time it is asked, so a world, a load of an old save, and a door act all start it the same way. */
function faithOn(){
  if (!options.faith || era !== 'days') return false;
  if (!faith) startFaith();
  return true;
}
/* Called last in updateWorld. The work is done once every `CLOCK.faith.every`. */
function faithTick(){
  if (!faithOn() || tick % CLOCK.faith.every) return;
  giveBeliefs();
  const n = CLOCK.faith.every;
  let gain = 0;
  for (const a of humans()) gain += a.belief / FAITH.belief.top * CLOCK.faith.grace * n;
  faith.grace = Math.min(FAITH.graceCap, faith.grace + gain);
  for (const a of humans()) if (a.belief > FAITH.belief.floor) a.belief = Math.max(FAITH.belief.floor, a.belief - CLOCK.faith.fade * n);
  openPrayers();
  resolvePrayers();
  checkForgotten();
  turnSeason();
  faith.signs = faith.signs.filter(s => tick - s.tick <= CLOCK.faith.signKeep || s.until > tick);
}
/* Every living person without a belief gets one: the first person the founder's, a child the mean of
   the parents', and anyone else a newcomer's. */
function giveBeliefs(){
  const first = firstPerson();
  for (const a of humans()){
    if (a.belief !== undefined) continue;
    const ps = a.parents ? a.parents.map(beingById).filter(p => p && p.belief !== undefined) : [];
    a.belief = a === first ? FAITH.belief.founder : ps.length ? ps.reduce((s, p) => s + p.belief, 0) / ps.length : FAITH.belief.newcomer;
  }
}
const setBelief = (a, d) => { a.belief = clamp(a.belief + d, 0, FAITH.belief.top); };

function openPrayers(){
  const prev = camp;
  for (const c of camps){
    camp = c;
    for (const kind in PRAYERS){
      const row = PRAYERS[kind], key = c.id + ':' + kind, found = row.trouble(c);
      if (!found){ delete faith.troubles[key]; continue; }
      const tr = faith.troubles[key] || (faith.troubles[key] = { since: tick, prayed: false });
      if (tr.prayed) continue;
      const a = row.who(c, found);
      if (!a) continue;
      tr.prayed = true;
      const until = row.byDawn && isEvening() ? nextDawn() : tick + CLOCK.faith.deadline[kind];
      faith.prayers.push({ id: faith.nextPrayer++, kind, who: a.id, camp: c.id, at: tick, until, where: row.where(c, a, found), end: null, endedAt: 0 });
      log(faithSay(FAITH_TEXT.pray[kind], { name: a.name }), [a]);
    }
  }
  camp = prev;
}
/* A sign of the sky that answers this prayer: the right miracle, made after the prayer, near the trouble. */
function skySign(p, c){
  const row = PRAYERS[p.kind], places = row.places(p, c);
  return faith.signs.some(s => row.answers.includes(s.act) && s.tick >= p.at
    && (row.near === null || places.some(([x, y, z]) => nearAt(s, x, y, z) <= row.near)));
}
function resolvePrayers(){
  const prev = camp;
  for (const p of faith.prayers){
    if (p.end) continue;
    const c = camps.find(k => k.id === p.camp), a = beingById(p.who);
    camp = c;
    if (!a || !a.alive) closePrayer(p, 'died', a);
    else if (!PRAYERS[p.kind].trouble(c)) closePrayer(p, skySign(p, c) ? 'sky' : 'own', a);
    else if (tick >= p.until) closePrayer(p, 'silent', a);
  }
  camp = prev;
  const closed = faith.prayers.filter(p => p.end);
  if (closed.length > FAITH.keepClosed){ const drop = new Set(closed.slice(0, closed.length - FAITH.keepClosed)); faith.prayers = faith.prayers.filter(p => !drop.has(p)); }
}
/* The end of one prayer. `camp` is the prayer's camp. */
function closePrayer(p, end, a){
  p.end = end; p.endedAt = tick;
  const row = FAITH.outcome[end === 'died' ? 'silent' : end];
  if (a && a.alive){
    setBelief(a, row.prayer);
    addThought(a, 'prayer', FAITH_TEXT.thought[end === 'died' ? 'silent' : end], row.mood, end === 'sky' ? CLOCK.thought.heard : end === 'own' ? CLOCK.thought.ownHands : CLOCK.thought.unheard);
  }
  for (const o of campHumans()) if (o !== a) setBelief(o, row.others);
  if (end === 'sky') faith.since.answered++; else if (end === 'own') faith.since.ownHands++; else faith.since.silent++;
  const name = a ? a.name : FAITH_TEXT.someone;
  const text = end === 'sky' ? FAITH_TEXT.heard[p.kind] : end === 'own' ? FAITH_TEXT.own[p.kind] : end === 'died' ? FAITH_TEXT.died : FAITH_TEXT.silent;
  log(faithSay(text, { name }), a ? [a] : [], end === 'sky' ? 'good' : end === 'own' ? 'info' : 'bad');
}
/* The sky is forgotten when no living person believes above the floor. */
function checkForgotten(){
  const now = !humans().some(a => a.belief > FAITH.belief.floor);
  if (now === faith.forgotten) return;
  faith.forgotten = now;
  if (now) log(FAITH_TEXT.forgotten, humans(), 'major'); else log(FAITH_TEXT.remembered, humans(), 'good');
}
/* When the season turns, the one that ended is tallied: one record for the page, one line for the chronicle. */
function turnSeason(){
  const s = seasonOf();
  if (s === faith.season) return;
  const since = faith.since, hs = beings.filter(b => b.species === 'human');
  since.births = hs.filter(b => b.parents && b.born >= since.tick).length;
  since.deaths = hs.filter(b => !b.alive && b.diedAt >= since.tick).length;
  const living = humans(), believers = living.filter(a => a.belief > FAITH.belief.floor);
  const t = { season: faith.season, year: yearOf(dayOf(since.tick)), from: since.tick, to: tick,
    people: living.length, believers: believers.length,
    meanBelief: living.length ? Math.round(living.reduce((n, a) => n + a.belief, 0) / living.length) : 0,
    answered: since.answered, ownHands: since.ownHands, silent: since.silent, births: since.births, deaths: since.deaths, spent: since.spent };
  faith.tallies.push(t);
  log(tallyLine(t), living, 'major');
  faith.season = s; faith.since = freshTally();
}
function tallyLine(t){
  const T = FAITH_TEXT.tally, out = [faithSay(T.ends, { season: t.season[0].toUpperCase() + t.season.slice(1) }), faithSay(T.believe, { n: t.believers, of: t.people })];
  const times = FAITH_TEXT.times[t.silent] || `${t.silent} times`, prayers = nOf(t.answered, 'prayer', 'prayers');
  if (!t.answered && !t.silent && !t.ownHands) out.push(T.nobody);
  else if (t.silent) out.push(faithSay(T.answeredSilent, { count: prayers, times }));
  else out.push(faithSay(T.answered, { count: prayers }));
  if (t.ownHands) out.push(faithSay(T.own, { count: nOf(t.ownHands, 'trouble', 'troubles') }));
  if (t.births) out.push(faithSay(T.born, { count: nOf(t.births, 'child was born', 'children were born') }));
  if (t.deaths) out.push(faithSay(T.died, { count: nOf(t.deaths, 'person died', 'people died') }));
  if (t.spent) out.push(faithSay(T.spent, { n: t.spent }));
  return out.join(' ');
}

/* ---------- the miracles ----------
   Each is a door act (door.js). A refused miracle costs nothing and says why. */
function refused(act){
  if (!options.faith) return FAITH_TEXT.refuse.off;
  if (!faithOn()) return FAITH_TEXT.refuse.early;
  giveBeliefs();
  if (faith.forgotten) return FAITH_TEXT.refuse.forgotten;
  if (faith.grace < FAITH.cost[act]) return faithSay(FAITH_TEXT.refuse.grace, { have: Math.floor(faith.grace), cost: FAITH.cost[act] });
  return null;
}
/* A miracle that landed: pay, leave its sign, and let whoever stood near see it. */
function payMiracle(act, x, y, z, extra = {}){
  const cost = FAITH.cost[act];
  faith.grace -= cost; faith.spent += cost; faith.since.spent += cost;
  faith.signs.push({ act, x, y, z, tick, until: 0, ...extra });
  for (const a of humans()) if (nearAt(a, x, y, z) <= FAITH.witnessRadius) setBelief(a, FAITH.belief.witness);
  return cost;
}
const actSpot = e => ({ x: e.x, y: e.y, z: e.z || 0 });
/* The Spark. With faith off, the old Light fire, unchanged. With faith on, it is paid for only when
   the strike does something: a pit already burning, or a tile with nothing to burn, costs nothing. */
function sparkAct(e){
  const { x, y, z } = actSpot(e);
  if (!options.faith) return lightTile(x, y, z);
  const why = refused('light'); if (why) return why;
  const t = hasTile(x, y, z) ? tileAt(x, y, z) : null, fire = t ? t.fire : 0, lit = !!(t && t.struct && t.struct.lit);
  const said = lightTile(x, y, z);
  if (!t || (t.fire === fire && !!(t.struct && t.struct.lit) === lit)) return said;
  return faithSay(FAITH_TEXT.reply.paid, { said, cost: payMiracle('light', x, y, z) });
}
function rainAct(e){
  if (!options.faith) return FAITH_TEXT.refuse.off;
  if (faithOn() && weather.storm) return FAITH_TEXT.refuse.raining;
  const why = refused('rain'); if (why) return why;
  const { x, y } = actSpot(e), at = inb(x, y) ? [x, y] : (camp && camp.site) || [0, 0];
  weather.storm = true; weather.until = tick + CLOCK.faith.rainLength;
  const cost = payMiracle('rain', at[0], at[1], 0);
  log(FAITH_TEXT.rain, humans(), 'good');
  return faithSay(FAITH_TEXT.reply.paid, { said: FAITH_TEXT.reply.rain, cost });
}
/* The Ward: every wolf and fox near the spot runs, and the spot is a threat to them for a day. */
function wardAct(e){
  if (!options.faith) return FAITH_TEXT.refuse.off;
  const why = refused('ward'); if (why) return why;
  const { x, y, z } = actSpot(e);
  if (!hasTile(x, y, z)) return FAITH_TEXT.refuse.nowhere;
  /* The sign first: the flee reads it through threatsFor. */
  const cost = payMiracle('ward', x, y, z, { until: tick + CLOCK.faith.wardHold });
  let n = 0;
  for (const b of beings){
    if (!b.alive || !SPECIES[b.species].warded || nearAt(b, x, y, z) > FAITH.wardRadius) continue;
    catchUp(b); if (!b.alive) continue;
    b.asleep = false; failTask(b);
    if (startTask(b, 'flee')) n++;
    b.next = tick;
  }
  const saw = humans().filter(a => nearAt(a, x, y, z) <= FAITH.witnessRadius);
  log(n ? faithSay(FAITH_TEXT.wardFled, { count: nOf(n, 'beast flees', 'beasts flee') }) : FAITH_TEXT.ward, saw, 'good');
  return faithSay(FAITH_TEXT.reply.paid, { said: FAITH_TEXT.reply.ward, cost });
}
/* The threat points a Ward makes for a wolf or a fox. Empty with faith off. threatsFor reads it. */
function wardPoints(a){
  if (!faith) return [];
  const out = [];
  for (const s of faith.signs) if (s.act === 'ward' && s.until > tick && nearAt(a, s.x, s.y, s.z) <= FAITH.wardRadius) out.push([s.x, s.y]);
  return out;
}
/* The Beckon: the nearest deer and rabbits walk toward the spot. */
function beckonAct(e){
  if (!options.faith) return FAITH_TEXT.refuse.off;
  const why = refused('beckon'); if (why) return why;
  const { x, y, z } = actSpot(e);
  if (!hasTile(x, y, z)) return FAITH_TEXT.refuse.nowhere;
  const heard = beings.filter(b => b.alive && SPECIES[b.species].beckoned && nearAt(b, x, y, z) <= FAITH.beckonRadius)
    .sort((p, q) => nearAt(p, x, y, z) - nearAt(q, x, y, z) || p.id - q.id);
  let n = 0;
  for (const b of heard){
    if (n >= FAITH.beckonMost) break;
    const path = pathToStop(b, x, y, FAITH.beckonWithin, z); if (!path) continue;
    catchUp(b); if (!b.alive) continue;
    b.asleep = false; failTask(b);
    setTask(b, 'walkTo', { at: [x, y, z], within: FAITH.beckonWithin }, { label: FAITH_TEXT.beckonLabel, path });
    b.next = tick; n++;
  }
  if (!n) return FAITH_TEXT.refuse.noBeasts;
  const cost = payMiracle('beckon', x, y, z), count = nOf(n, 'animal', 'animals');
  log(faithSay(FAITH_TEXT.beckon, { count }), humans().filter(a => nearAt(a, x, y, z) <= FAITH.witnessRadius), 'good');
  return faithSay(FAITH_TEXT.reply.paid, { said: faithSay(FAITH_TEXT.reply.beckon, { count }), cost });
}
