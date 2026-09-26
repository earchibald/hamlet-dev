// The sky plays: belief, grace, prayers, credit, the miracles, the season's tally, and forgotten.
// Hand-built camps on seed r, so each check is a few rules and not a run. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const { runDays, replayGod, fingerprint, setClock, DAY } = require('./lib/run');

/* A camp on seed r made to be played: the founder at the stash, a cold pit laid with wood, and open
   ground round the site. No wolf, fox, deer, or rabbit is left alive, so a test adds the one it needs
   and nothing else prays or answers. */
function playCamp(opts = { faith: true }){
  const api = load(); api.startWorld('r', opts);
  const a = api.firstPerson(), c = api.camps[0]; api.camp = c;
  api.setSite(a.x, a.y);
  const [sx, sy] = c.site;
  for (let dx = -8; dx <= 8; dx++) for (let dy = -8; dy <= 8; dy++){
    if (!api.hasTile(sx + dx, sy + dy, 0)) continue;
    const q = api.tileAt(sx + dx, sy + dy); q.ground = 'soil'; q.feature = null; q.struct = null; q.fire = 0; q.slope = false;
  }
  const pit = api.tileAt(sx, sy); pit.struct = { type: 'firepit', fuel: 300, lit: false }; c.pit = [sx, sy];
  a.x = c.stashTile[0]; a.y = c.stashTile[1]; a.z = 0; a.task = null; a.asleep = false; a.homeless = false; a.cooldown = {};
  for (const k in a.needs) a.needs[k] = 90;
  for (const b of api.beings) if (b.alive && (api.SPECIES[b.species].warded || api.SPECIES[b.species].beckoned)) b.alive = false;
  return { api, a, c, pit };
}
/* Set the clock to an hour of a day, on the faith period. */
const at = (api, day, hour) => setClock(api, (day - 1) * DAY + api.hours(hour));
/* Move on to the next faith period and run it. */
function period(api, n = 1){
  const E = api.CLOCK.faith.every;
  for (let k = 0; k < n; k++){ setClock(api, (Math.floor(api.tick / E) + 1) * E); api.faithTick(); }
}
const door = (api, act, e = {}) => api.inject({ source: 'player', act, ...e });
const lines = (api, re) => api.chronicle.filter(e => re.test(e.text));
const open = api => api.faith.prayers.filter(p => !p.end);
/* A camp at 17:00 on day 2, with one fire prayer open by the founder. */
function praying(){
  const w = playCamp(); at(w.api, 2, 17); period(w.api);
  const p = open(w.api).find(p => p.kind === 'fire');
  assert.ok(p, 'no fire prayer opened');
  return { ...w, p };
}
const addBeing = (api, species, x, y) => { const b = api.makeBeing(species, x, y); api.beings.push(b); return b; };

test('faith off: no record, no belief, and rain, ward, beckon, and calm refuse and change nothing', () => {
  const { api } = runDays('r', 0.25, null, () => {});
  assert.equal(api.options.faith, false);
  assert.equal(api.faith, null, 'a world with faith off made a faith record');
  assert.ok(api.beings.every(b => !('belief' in b)), 'a person in a world with faith off has a belief');
  const off = api.FAITH_TEXT.refuse.off, storm = api.weather.storm;
  for (const act of ['rain', 'ward', 'beckon', 'calm']) assert.equal(door(api, act, { x: 5, y: 5, z: 0 }), off, act);
  assert.equal(api.weather.storm, storm, 'rain changed the weather with faith off');
  assert.equal(api.faith, null);
});

test('faith off: Light fire is the old act, free, and unlimited', () => {
  const { api, pit } = playCamp({});
  assert.equal(door(api, 'light', { x: pit.x, y: pit.y }), 'The fire pit is lit.');
  assert.ok(pit.struct.lit);
});

test('the option is a boolean', () => {
  const api = load();
  assert.match(api.checkOptions({ faith: 'yes' }), /on or off/);
  assert.equal(api.checkOptions({ faith: true }), null);
});

test('belief starts at 40 for the founder, 20 for a newcomer, and the mean of the parents for a child', () => {
  const { api, a, c } = playCamp();
  const n = addBeing(api, 'human', a.x, a.y); n.camp = c;
  const k = addBeing(api, 'human', a.x, a.y); k.camp = c; k.parents = [a.id, n.id];
  api.giveBeliefs();
  assert.equal(a.belief, 40); assert.equal(n.belief, 20); assert.equal(k.belief, 30);
});

/* Beliefs were given only at a faith period, so for the first ten world minutes the strip read
   "0 of 1 believe". They are given when faith starts, and that draws no random number. */
test('beliefs are given as soon as faith starts, before the first period, with no random number drawn', () => {
  const api = load(); api.startWorld('r', { faith: true });
  const a = api.firstPerson();
  assert.equal(api.faith, null, 'sanity: faith has not started');
  api.step();
  assert.ok(api.tick % api.CLOCK.faith.every !== 0, `sanity: tick ${api.tick} is not a faith period`);
  assert.ok(api.faith, 'the first tick of the days starts faith');
  assert.equal(a.belief, api.FAITH.belief.founder, 'the founder believes from the first tick');
  const b = load(); b.startWorld('r', { faith: true });
  const c = load(); c.startWorld('r', { faith: true });
  b.startFaith();
  assert.equal(b.firstPerson().belief, api.FAITH.belief.founder);
  assert.equal(b.rng(), c.rng(), 'startFaith drew a random number');
});

test('grace comes from belief each hour, and stops at the cap', () => {
  const { api, a, pit } = playCamp(); pit.struct.fuel = 0;
  at(api, 2, 9); period(api);
  const hour = api.hours(1) / api.CLOCK.faith.every;
  api.faith.grace = 0; a.belief = 60; period(api, hour);
  assert.ok(Math.abs(api.faith.grace - 0.3) < 0.01, `one person at belief 60 gave ${api.faith.grace} grace in an hour, not 0.3`);
  api.faith.grace = 99.99; period(api);
  assert.equal(api.faith.grace, 100);
});

test('belief fades 1 a day to the floor, and never past it', () => {
  const { api, a, pit } = playCamp(); pit.struct.fuel = 0;
  at(api, 2, 9); period(api);
  const day = DAY / api.CLOCK.faith.every;
  a.belief = 50; period(api, day);
  assert.ok(Math.abs(a.belief - 49) < 0.01, `belief went from 50 to ${a.belief} in a day, not 49`);
  a.belief = 5.5; period(api, day);
  assert.equal(a.belief, api.FAITH.belief.floor);
  a.belief = 3; period(api, day);
  assert.equal(a.belief, 3, 'the fade raised a belief below the floor');
});

test('a laid cold pit in the evening opens a fire prayer by the founder, with a deadline at dawn', () => {
  const { api, a, p } = praying();
  assert.equal(p.who, a.id);
  assert.equal(p.until, api.nextDawn(), 'an evening fire prayer waits until dawn');
  assert.equal(lines(api, /prays for fire/).length, 1);
  assert.equal(lines(api, /prays for fire/)[0].text, `${a.name} prays for fire.`);
  /* Nobody prays twice for the same trouble. */
  period(api, 6);
  assert.equal(api.faith.prayers.filter(q => q.kind === 'fire').length, 1, 'the founder prayed twice for one cold pit');
});

test('in the morning a warm person does not pray for fire, and a cold one does', () => {
  const { api, a } = playCamp();
  at(api, 2, 9); period(api);
  assert.equal(api.faith.prayers.length, 0, 'a warm person prayed for fire in the morning');
  a.needs.warmth = 20; period(api);
  const p = open(api)[0];
  assert.ok(p && p.kind === 'fire', 'a cold person did not pray');
  assert.equal(p.until, api.nextDawn(), 'a morning fire prayer waits until the next dawn, the later end');
});

test('a fire prayer made just before dawn waits 12 hours, not until dawn', () => {
  const { api, a } = playCamp();
  at(api, 2, 5); period(api);
  const p = open(api).find(p => p.kind === 'fire');
  assert.ok(p && p.who === a.id, 'no fire prayer in the hour before dawn');
  assert.ok(api.nextDawn() - api.tick < api.CLOCK.faith.deadline.fire, 'dawn is not the nearer end, so the test proves nothing');
  assert.equal(p.until, api.tick + api.CLOCK.faith.deadline.fire);
});

test('the Spark on the pit answers the prayer: belief rises, and the line says the sky heard', () => {
  const { api, a, pit } = praying();
  api.faith.grace = 50; a.belief = 40;
  const reply = door(api, 'light', { x: pit.x, y: pit.y });
  assert.match(reply, /cost 15 grace/);
  assert.ok(pit.struct.lit);
  const witnessed = a.belief;
  assert.equal(witnessed, 40 + api.FAITH.belief.witness, 'the founder stood by and did not see the miracle');
  period(api);
  const p = api.faith.prayers[0];
  assert.equal(p.end, 'sky');
  assert.ok(Math.abs(a.belief - (witnessed + 20)) < 0.05, `belief ${a.belief}, not ${witnessed + 20}`);
  assert.equal(lines(api, /The sky heard/)[0].text, `The sky heard ${a.name}. The fire caught.`);
  assert.equal(api.faith.since.answered, 1);
  assert.ok(a.thoughts.some(t => t.key === 'prayer' && t.value > 0));
});

test('a pit lit with no sign of the sky is lit by their own hands', () => {
  const { api, a, pit } = praying();
  a.belief = 40;
  pit.struct.lit = true;
  period(api);
  assert.equal(api.faith.prayers[0].end, 'own');
  assert.ok(Math.abs(a.belief - 36) < 0.05, `belief ${a.belief}, not 36`);
  assert.equal(lines(api, /by their own hands/)[0].text, `${a.name}'s people lit the fire by their own hands.`);
  assert.equal(api.faith.since.ownHands, 1);
});

test('a Spark far from the pit is no answer to it', () => {
  const { api, a, c, pit } = praying();
  api.faith.grace = 50;
  /* A pine forty tiles off catches. The pit is then lit by hand. */
  let far = null;
  for (const t of api.world) if (t.feature === 'tree' && t.fire === 0 && Math.abs(t.x - pit.x) + Math.abs(t.y - pit.y) > 40){ far = t; break; }
  assert.ok(far, 'no pine far from the camp');
  assert.match(door(api, 'light', { x: far.x, y: far.y }), /cost 15 grace/);
  pit.struct.lit = true;
  period(api);
  assert.equal(api.faith.prayers.find(p => p.kind === 'fire').end, 'own', 'a strike far off was credited with the fire');
});

test('a prayer past its deadline ends in silence', () => {
  const { api, a, p } = praying();
  a.belief = 40;
  setClock(api, p.until - api.CLOCK.faith.every); api.faithTick();
  assert.equal(p.end, null, 'the prayer ended before its deadline');
  period(api);
  assert.equal(p.end, 'silent');
  assert.ok(a.belief < 40 - 12 + 0.01 && a.belief > 40 - 12 - 0.1, `belief ${a.belief}, not about 28`);
  assert.equal(lines(api, /was silent/)[0].text, `The sky was silent when ${a.name} called.`);
  /* The pit is still cold, and so is the founder, who would pray again for a new trouble. The same
     trouble brings no second prayer. */
  a.needs.warmth = 10;
  period(api, 20);
  assert.equal(api.faith.prayers.filter(q => q.kind === 'fire').length, 1);
});

test('one who dies before the answer gets the silent row, with its own line', () => {
  const { api, a, c } = praying();
  const b = addBeing(api, 'human', a.x, a.y); b.camp = c; b.belief = 30;
  a.alive = false;
  period(api);
  assert.equal(api.faith.prayers[0].end, 'died');
  assert.equal(lines(api, /died before the sky answered/).length, 1);
  assert.ok(b.belief < 30 - 3 + 0.01, 'the camp lost no belief when the one who prayed died unanswered');
});

test('a Spark with too little grace is refused and costs nothing; with enough it pays', () => {
  const { api, pit } = playCamp();
  at(api, 2, 9); period(api);
  api.faith.grace = 10;
  assert.equal(door(api, 'light', { x: pit.x, y: pit.y }), 'Not enough grace. You have 10, and this costs 15.');
  assert.equal(pit.struct.lit, false); assert.equal(api.faith.grace, 10);
  api.faith.grace = 20;
  door(api, 'light', { x: pit.x, y: pit.y });
  assert.equal(pit.struct.lit, true); assert.equal(api.faith.grace, 5); assert.equal(api.faith.spent, 15);
  /* A Spark on a pit already burning does nothing, and costs nothing. */
  api.faith.grace = 20;
  assert.equal(door(api, 'light', { x: pit.x, y: pit.y }), 'The fire is already burning.');
  assert.equal(api.faith.grace, 20);
});

test('Rain starts a storm and refuses a second one', () => {
  const { api, pit } = playCamp();
  at(api, 2, 9); period(api);
  api.faith.grace = 100; api.weather.storm = false;
  assert.match(door(api, 'rain', { x: pit.x, y: pit.y }), /cost 40 grace/);
  assert.equal(api.weather.storm, true);
  assert.equal(api.weather.until, api.tick + api.CLOCK.faith.rainLength);
  assert.equal(api.faith.grace, 60);
  assert.equal(door(api, 'rain', { x: pit.x, y: pit.y }), 'It is already raining.');
  assert.equal(api.faith.grace, 60);
});

test('Ward makes a wolf near the spot flee, and keeps the spot a threat to it', () => {
  const { api, pit } = playCamp();
  at(api, 2, 22); period(api);
  api.faith.grace = 50;
  const w = addBeing(api, 'wolf', pit.x + 4, pit.y);
  w.task = null; w.asleep = false;
  assert.deepEqual(api.threatsFor(w).filter(([x, y]) => x === pit.x + 1 && y === pit.y), [], 'a threat before the ward');
  assert.match(door(api, 'ward', { x: pit.x + 1, y: pit.y }), /cost 15 grace/);
  assert.equal(w.task && w.task.type, 'flee', 'the wolf did not flee the ward');
  assert.ok(api.threatsFor(w).some(([x, y]) => x === pit.x + 1 && y === pit.y), 'the ward is not a threat to the wolf');
  /* After the hold, it is not. */
  setClock(api, api.tick + api.CLOCK.faith.wardHold);
  assert.ok(!api.threatsFor(w).some(([x, y]) => x === pit.x + 1 && y === pit.y), 'the ward outlasted its hold');
});

test('Beckon sends a deer toward the spot, and with nothing near it is refused and free', () => {
  const { api, pit } = playCamp();
  at(api, 2, 9); period(api);
  api.faith.grace = 50;
  assert.equal(door(api, 'beckon', { x: pit.x, y: pit.y }), api.FAITH_TEXT.refuse.noBeasts);
  assert.equal(api.faith.grace, 50);
  const d = addBeing(api, 'deer', pit.x + 7, pit.y + 7);
  assert.match(door(api, 'beckon', { x: pit.x, y: pit.y }), /cost 20 grace/);
  assert.equal(d.task && d.task.kind, 'walkTo', 'the deer did not answer the call');
  assert.deepEqual(d.task.args.at, [pit.x, pit.y, 0]);
  assert.equal(api.faith.grace, 30);
});

test('a wolf at night opens a wolf prayer; a Ward answers it, and a wolf that leaves alone does not', () => {
  for (const warded of [true, false]){
    const { api, a, pit } = playCamp(); pit.struct.fuel = 0;
    at(api, 2, 22); period(api);
    a.x = pit.x + 12; a.y = pit.y; api.faith.grace = 50;
    const w = addBeing(api, 'wolf', a.x + 3, a.y);
    period(api);
    const p = open(api).find(p => p.kind === 'wolf');
    assert.ok(p && p.who === a.id, 'no wolf prayer');
    if (warded) door(api, 'ward', { x: a.x, y: a.y });
    const before = a.belief;
    w.x = a.x + 30; w.task = null;
    period(api);
    assert.equal(p.end, warded ? 'sky' : 'passed');
    if (warded) continue;
    /* A wolf that wanders off was not driven off by the camp's own hands: belief stays, but for one
       period's fade, and the line says so plainly. */
    assert.ok(Math.abs(a.belief - before) < 0.05, `a wolf that left alone moved belief from ${before} to ${a.belief}`);
    const said = lines(api, /The wolf went away/);
    assert.equal(said.length, 1); assert.equal(said[0].text, `The wolf went away. ${a.name} breathes again.`); assert.equal(said[0].kind, 'info');
    assert.equal(api.faith.since.ownHands, 0, 'a wolf that left alone counted as met by their own hands');
  }
});

test("a wolf prayer is the person's: it ends when the wolf leaves them, though another is still afraid", () => {
  const { api, a, c, pit } = playCamp(); pit.struct.fuel = 0;
  at(api, 2, 22); period(api);
  a.x = pit.x + 12; a.y = pit.y;
  const b = addBeing(api, 'human', pit.x - 12, pit.y); b.camp = c; b.belief = 30; b.asleep = false; b.task = null;
  const w = addBeing(api, 'wolf', a.x + 3, a.y);
  period(api);
  const p = open(api).find(p => p.kind === 'wolf');
  assert.ok(p && p.who === a.id, 'no wolf prayer by the one the wolf is near');
  /* The wolf leaves the one who prayed for the other. The camp is still afraid; the prayer is over. */
  w.x = b.x + 3; w.y = b.y; w.task = null;
  assert.ok(api.beastNear(b) && !api.beastNear(a), 'the wolf did not move from one to the other');
  period(api);
  assert.equal(p.end, 'passed', 'the prayer stayed open while the wolf stalked someone else');
});

test('hunger opens a prayer when the stash is under half its aim, and it ends when the stash is back', () => {
  const { api, a, c, pit } = playCamp(); pit.struct.fuel = 0;
  at(api, 2, 9); period(api);
  for (const k of ['berries', 'cooked', 'smoked']) c.stash[k] = 0;
  const target = api.foodTarget(), half = Math.ceil(target / 2);
  assert.ok(half > 1, 'the aim is too small to leave food in a stash under half of it, so the test proves nothing');
  /* At half the aim, and hungry, nobody prays. */
  c.stash.berries = half; a.needs.food = 40;
  period(api);
  assert.equal(open(api).length, 0, 'a camp with half its aim in the stash prayed for food');
  /* One meal under half, with food left in the stash: the old rule waited for an empty stash. */
  c.stash.berries = half - 1;
  period(api);
  const h = open(api).find(p => p.kind === 'hunger');
  assert.ok(c.stash.berries > 0, 'the stash is empty, so the test does not tell the new trouble from the old');
  assert.ok(h && h.who === a.id, 'no hunger prayer with the stash under half its aim');
  assert.equal(lines(api, /prays for food/)[0].text, `${a.name} prays for food.`);
  /* The one who prayed eats: the camp's stash is still low, so the prayer stays open. */
  a.needs.food = 90;
  period(api);
  assert.equal(h.end, null, 'a meal from a low stash ended the prayer');
  /* A Beckon near the camp, then the stash back at half its aim: the sky is credited. */
  const d = addBeing(api, 'deer', pit.x + 7, pit.y + 7); api.faith.grace = 50;
  assert.match(door(api, 'beckon', { x: pit.x, y: pit.y }), /cost 20 grace/);
  assert.ok(d.task && d.task.kind === 'walkTo');
  c.stash.berries = half;
  period(api);
  assert.equal(h.end, 'sky');
});

test('a hungry person does not pray while the food is 50 or more', () => {
  const { api, a, c, pit } = playCamp(); pit.struct.fuel = 0;
  at(api, 2, 9); period(api);
  for (const k of ['berries', 'cooked', 'smoked']) c.stash[k] = 0;
  /* The literal, not FAITH.hungryBelow: a test that reads the threshold passes whatever it is set to. */
  a.needs.food = 50;
  period(api);
  assert.equal(open(api).length, 0, `a person at food ${a.needs.food} prayed`);
  a.needs.food = 49;
  period(api);
  assert.ok(open(api).some(p => p.kind === 'hunger'), `a person at food ${a.needs.food}, with an empty stash, did not pray`);
});

test('a sleeper near a wolf at night prays in a dream', () => {
  const { api, a, pit } = playCamp(); pit.struct.fuel = 0;
  at(api, 2, 22); period(api);
  a.x = pit.x + 12; a.y = pit.y; a.asleep = true; api.faith.grace = 50;
  const w = addBeing(api, 'wolf', a.x + 3, a.y);
  period(api);
  const p = open(api).find(p => p.kind === 'wolf');
  assert.ok(p && p.who === a.id, 'a sleeper near a wolf did not pray');
  assert.equal(a.asleep, true, 'the sleeper woke, so the test does not tell a dream from a waking prayer');
  const said = lines(api, /dreams of wolves/);
  assert.equal(said.length, 1); assert.equal(said[0].text, `${a.name} dreams of wolves and prays in their sleep.`);
  assert.equal(lines(api, /prays to be kept from the wolf/).length, 0, 'a dream was told as a waking prayer');
  /* The rest is a wolf prayer: a Ward answers it. */
  door(api, 'ward', { x: a.x, y: a.y });
  w.x = a.x + 30; w.task = null;
  period(api);
  assert.equal(p.end, 'sky');
});

test('a sleeper does not dream of a fire, a famine, or a storm', () => {
  const { api, a, c } = playCamp();
  /* The fire prayer is the one to watch: the founder prays for the cold pit the moment they wake. */
  a.asleep = true;
  at(api, 2, 22); period(api);
  a.needs.warmth = 10; a.needs.food = 10;
  for (const k of ['berries', 'cooked', 'smoked']) c.stash[k] = 0;
  api.weather.storm = true; api.weather.until = api.tick + api.hours(8);
  period(api);
  assert.equal(api.faith.prayers.length, 0, 'a sleeper prayed for ' + api.faith.prayers.map(p => p.kind).join(', '));
  a.asleep = false; period(api);
  assert.ok(open(api).length > 0, 'the founder, awake, did not pray, so the test proves nothing');
});

/* A camp at 10:00 on day 2 in a storm of eight hours, with the founder out in it and cold. */
function inStorm(){
  const w = playCamp(); w.pit.struct.fuel = 0;
  at(w.api, 2, 10); period(w.api);
  w.api.weather.storm = true; w.api.weather.until = w.api.tick + w.api.hours(8);
  w.a.needs.warmth = 50;
  assert.equal(w.api.underRoof(w.a), false, 'the founder is under a roof');
  period(w.api);
  const p = open(w.api).find(p => p.kind === 'storm');
  assert.ok(p && p.who === w.a.id, 'no storm prayer from one out in the rain and cold');
  return { ...w, p };
}

test('a storm with a cold person out in it opens a storm prayer, with a deadline of six hours', () => {
  const { api, a, p } = inStorm();
  assert.equal(lines(api, /prays for the rain to stop/)[0].text, `${a.name} prays for the rain to stop.`);
  assert.equal(p.until, p.at + api.CLOCK.faith.deadline.storm);
  /* A storm about to end sets the deadline at its end. */
  const w = playCamp(); w.pit.struct.fuel = 0;
  at(w.api, 2, 10); period(w.api);
  w.api.weather.storm = true; w.api.weather.until = w.api.tick + w.api.hours(2); w.a.needs.warmth = 50;
  period(w.api);
  assert.equal(open(w.api).find(q => q.kind === 'storm').until, w.api.weather.until);
});

test('nobody prays about a storm when they are warm, or under a roof', () => {
  for (const how of ['warm', 'roofed']){
    const { api, a, c, pit } = playCamp(); pit.struct.fuel = 0;
    at(api, 2, 10); period(api);
    api.weather.storm = true; api.weather.until = api.tick + api.hours(8);
    a.needs.warmth = how === 'warm' ? 95 : 50;
    if (how === 'roofed'){ const t = api.tileAt(a.x + 1, a.y); t.struct = { type: 'leanto', camp: c }; c.shelter = [t.x, t.y]; }
    assert.equal(api.underRoof(a), how === 'roofed');
    period(api);
    assert.equal(open(api).length, 0, `a person ${how} prayed about the storm`);
  }
});

test('the Calm ends the storm the ordinary way and answers the storm prayer', () => {
  const { api, a, p } = inStorm();
  api.faith.grace = 50; a.belief = 40;
  const s0 = api.streamState(api.rng);
  assert.match(door(api, 'calm', { x: a.x, y: a.y }), /The rain stops\. It cost 25 grace\./);
  assert.equal(api.weather.storm, false);
  assert.equal(api.faith.grace, 25);
  /* The next storm is set as when a storm ends by itself: one gap on, and one draw for its spread. */
  const gap = api.CLOCK.storm.gap, spread = api.CLOCK.storm.gapSpread;
  assert.ok(api.weather.next >= api.tick + gap && api.weather.next <= api.tick + gap + spread, `the next storm is at ${api.weather.next - api.tick} ticks`);
  assert.notEqual(api.streamState(api.rng), s0, 'the Calm drew no number for the next storm');
  assert.equal(lines(api, /clouds break/).length, 1);
  period(api);
  assert.equal(p.end, 'sky');
  assert.equal(lines(api, /The sky heard/)[0].text, `The sky heard ${a.name}. The rain stopped.`);
  assert.ok(a.belief > 40 + 20 - 0.1, `belief ${a.belief}`);
});

test('the Calm with no storm is refused and free, and with faith off it is refused', () => {
  const { api, a, pit } = playCamp(); pit.struct.fuel = 0;
  at(api, 2, 10); period(api);
  api.faith.grace = 50; api.weather.storm = false;
  const n = api.faith.signs.length;
  assert.equal(door(api, 'calm', { x: a.x, y: a.y }), 'The sky is already clear.');
  assert.equal(api.faith.grace, 50); assert.equal(api.faith.signs.length, n);
  api.weather.storm = true; api.faith.grace = 20;
  assert.equal(door(api, 'calm', { x: a.x, y: a.y }), 'Not enough grace. You have 20, and this costs 25.');
  assert.equal(api.weather.storm, true);
});

test('a storm that ends by itself ends the storm prayer with no credit and no blame', () => {
  const { api, a, c, p } = inStorm();
  const b = addBeing(api, 'human', a.x, a.y); b.camp = c; b.belief = 30;
  a.belief = 40;
  const before = [a.belief, b.belief];
  api.endStorm();
  period(api);
  assert.equal(p.end, 'passed');
  const fade = api.CLOCK.faith.fade * api.CLOCK.faith.every;
  assert.ok(Math.abs(a.belief - (before[0] - fade)) < 1e-9 && Math.abs(b.belief - (before[1] - fade)) < 1e-9, `belief moved from ${before} to ${[a.belief, b.belief]}`);
  const said = lines(api, /rain stopped on its own/);
  assert.equal(said.length, 1); assert.equal(said[0].text, `The rain stopped on its own. ${a.name} can get dry.`); assert.equal(said[0].kind, 'info');
  assert.equal(api.faith.since.ownHands + api.faith.since.silent + api.faith.since.answered, 0, 'a storm that ended by itself was counted');
  assert.ok(!a.thoughts.some(t => t.key === 'prayer'), 'a storm that ended by itself left a thought');
});

test('one struck pine near the camp is no wildfire; three burning tiles are', () => {
  const { api, a, c, pit } = playCamp(); pit.struct.fuel = 0;
  at(api, 2, 9); period(api);
  const pine = dx => { const t = api.tileAt(pit.x + dx, pit.y + 4); t.ground = 'grass'; t.feature = 'tree'; api.lightTile(t.x, t.y, 0); assert.ok(t.fire > 0, 'the pine did not catch'); return t; };
  const t1 = pine(0);
  /* The pit burning too does not make a second fire. */
  pit.struct.fuel = 300; pit.struct.lit = true; pit.fire = 50;
  assert.equal(api.burningNear(c).length, 1, 'the pit was counted as a fire in the open');
  period(api);
  assert.equal(open(api).filter(p => p.kind === 'wildfire').length, 0, 'one struck pine opened a wildfire prayer');
  pine(1);
  period(api);
  assert.equal(open(api).filter(p => p.kind === 'wildfire').length, 0, 'two burning tiles opened a wildfire prayer');
  pine(2);
  period(api);
  const f = open(api).find(p => p.kind === 'wildfire');
  assert.ok(f && f.who === a.id, 'three burning tiles opened no wildfire prayer');
  /* Rain anywhere answers it. */
  api.faith.grace = 50; api.weather.storm = false;
  door(api, 'rain', { x: 1, y: 1 });
  for (const t of api.burningNear(c)) t.fire = 0;
  period(api);
  assert.equal(f.end, 'sky');
  assert.ok(t1);
});

test('nobody prays about a wildfire in their sleep', () => {
  const { api, a, c, pit } = playCamp(); pit.struct.fuel = 0;
  a.asleep = true;
  at(api, 2, 23); period(api);
  /* Two sleepers: a filter that passes the list's index on as the dream flag lets the second one pray. */
  const b = addBeing(api, 'human', a.x, a.y); b.camp = c; b.belief = 30; b.asleep = true;
  for (let dx = 0; dx < 3; dx++){ const t = api.tileAt(pit.x + dx, pit.y + 4); t.ground = 'grass'; t.feature = 'tree'; api.lightTile(t.x, t.y, 0); }
  assert.ok(api.burningNear(c).length >= 3, 'the pines did not catch');
  period(api);
  assert.deepEqual(api.faith.prayers.map(p => p.kind), [], 'a sleeper prayed');
  b.asleep = false; period(api);
  assert.ok(open(api).some(p => p.kind === 'wildfire' && p.who === b.id), 'nobody awake prayed about the fire, so the test proves nothing');
});

test('no loss takes belief under the floor: silence, their own hands, and the fade', () => {
  const floor = () => load().FAITH.belief.floor;
  /* Silence: the one who prayed loses 12 and the others 3, from just above the floor. */
  {
    const { api, a, c, p } = praying();
    const b = addBeing(api, 'human', a.x, a.y); b.camp = c;
    a.belief = floor() + 4; b.belief = floor() + 1;
    setClock(api, p.until); api.faithTick();
    assert.equal(p.end, 'silent');
    assert.equal(a.belief, floor(), `silence took the one who prayed to ${a.belief}`);
    assert.equal(b.belief, floor(), `silence took another to ${b.belief}`);
  }
  /* Their own hands: the one who prayed loses 4. */
  {
    const { api, a, p, pit } = praying();
    a.belief = floor() + 2; pit.struct.lit = true; period(api);
    assert.equal(p.end, 'own');
    assert.equal(a.belief, floor(), `their own hands took belief to ${a.belief}`);
  }
  /* A belief already under the floor, as a test or an old save may leave it, is not lowered. */
  {
    const { api, a, c, p } = praying();
    const b = addBeing(api, 'human', a.x, a.y); b.camp = c; b.belief = 2;
    setClock(api, p.until); api.faithTick();
    assert.equal(b.belief, 2, 'a loss lowered a belief already under the floor');
  }
});

test('a season turn pushes a tally with its counts, and one line for the chronicle', () => {
  const { api, a, c, pit } = praying();
  api.faith.grace = 50;
  door(api, 'light', { x: pit.x, y: pit.y }); period(api);
  const k = addBeing(api, 'human', a.x, a.y); k.camp = c; k.parents = [a.id, a.id]; k.born = api.tick;
  const summer = api.SEASON_LENGTHS[0] + 1;
  at(api, summer, 0); api.faithTick();
  assert.equal(api.faith.tallies.length, 1);
  const t = api.faith.tallies[0];
  assert.equal(t.season, 'spring');
  assert.deepEqual([t.answered, t.ownHands, t.silent, t.births, t.deaths, t.spent, t.people, t.believers], [1, 0, 0, 1, 0, 15, 2, 2]);
  assert.equal(lines(api, /^Spring ends\./)[0].text, 'Spring ends. 2 of 2 believe. The sky answered 1 prayer. 1 child was born. The sky spent 15 grace.');
  assert.equal(api.faith.season, 'summer');
  assert.equal(api.faith.since.answered, 0, 'the counts did not start again');
});

test('the tally line counts silences in words', () => {
  const api = load();
  const t = { season: 'summer', people: 5, believers: 4, answered: 3, silent: 1, ownHands: 0, births: 0, deaths: 0, spent: 0 };
  assert.equal(api.tallyLine(t), 'Summer ends. 4 of 5 believe. The sky answered 3 prayers and was silent once.');
});

test('forgotten when nobody believes above the floor: a miracle is refused, and belief can return', () => {
  const { api, a, pit } = playCamp();
  at(api, 2, 9); period(api);
  a.belief = api.FAITH.belief.floor;
  period(api);
  assert.equal(api.faith.forgotten, true);
  api.faith.grace = 50;
  assert.equal(lines(api, /Nobody believes in the sky now/).length, 1);
  assert.equal(lines(api, /Nobody believes in the sky now/)[0].kind, 'major');
  assert.equal(door(api, 'light', { x: pit.x, y: pit.y }), api.FAITH_TEXT.refuse.forgotten);
  assert.equal(pit.struct.lit, false); assert.equal(api.faith.grace, 50);
  a.belief = 20; period(api);
  assert.equal(api.faith.forgotten, false);
  assert.equal(lines(api, /believes in the sky again/).length, 1);
  /* A miracle asks who believes now, not what the last period found. */
  a.belief = api.FAITH.belief.floor;
  assert.equal(api.faith.forgotten, false, 'the flag moved without a period, so the test proves nothing');
  assert.equal(door(api, 'light', { x: pit.x, y: pit.y }), api.FAITH_TEXT.refuse.forgotten, 'a miracle was allowed when nobody believed');
  assert.equal(pit.struct.lit, false);
});

test('the faith rules draw no random number', () => {
  const { api, a, pit } = praying();
  const s0 = api.streamState(api.rng);
  a.needs.warmth = 10; api.faith.grace = 99; period(api, 30);
  pit.struct.lit = true; period(api);
  at(api, api.SEASON_LENGTHS[0] + 1, 0); api.faithTick();
  assert.equal(api.streamState(api.rng), s0, 'a faith rule drew from the world stream');
});

test('a snapshot taken mid-prayer loads the same faith record and the same beliefs', () => {
  const { api, a } = praying();
  assert.equal(open(api).length, 1);
  const snap = JSON.parse(JSON.stringify(api.takeSnapshot()));
  const b = load(); b.startWorld('r');
  assert.equal(b.loadSnapshot(snap), null, b.lastLoadFault);
  assert.deepEqual(b.faith, api.faith);
  assert.equal(b.firstPerson().belief, a.belief);
  /* And both go on the same way: the prayer ends in silence at its deadline in each. */
  const p = open(api)[0];
  for (const w of [api, b]){ setClock(w, p.until); w.faithTick(); }
  assert.deepEqual(b.faith, api.faith);
});

test('a sign made before the prayer opened does not answer it', () => {
  const { api, pit } = playCamp();
  at(api, 2, 16); period(api);
  api.faith.grace = 50;
  assert.match(door(api, 'light', { x: pit.x, y: pit.y }), /cost 15 grace/);
  pit.struct.lit = false;   // put out, say by the rain
  at(api, 2, 17); period(api);
  const p = open(api).find(p => p.kind === 'fire');
  assert.ok(p, 'no fire prayer');
  assert.ok(api.faith.signs.some(s => s.act === 'light' && s.tick < p.at && s.x === pit.x && s.y === pit.y), 'no sign on the pit before the prayer, so the test proves nothing');
  pit.struct.lit = true;
  period(api);
  assert.equal(p.end, 'own', 'a Spark made before the prayer was credited with answering it');
});

test('a season tally counts a person who died in it', () => {
  const { api, a, c, pit } = playCamp(); pit.struct.fuel = 0;
  at(api, 2, 9); period(api);
  const b = addBeing(api, 'human', a.x, a.y); b.camp = c; period(api);
  api.die(b, 'cold');
  assert.equal(b.alive, false);
  at(api, api.SEASON_LENGTHS[0] + 1, 0); api.faithTick();
  const t = api.faith.tallies[0];
  assert.equal(t.deaths, 1, 'the death was not counted');
  assert.equal(t.people, 1);
  assert.match(lines(api, /^Spring ends\./)[0].text, / 1 person died\./);
});

test('with two who could pray, the coldest prays for fire and the hungriest for food', () => {
  for (const kind of ['fire', 'hunger']){
    const { api, a, c, pit } = playCamp();
    const b = addBeing(api, 'human', a.x, a.y); b.camp = c; b.belief = 30; b.asleep = false; b.task = null;
    for (const k in b.needs) b.needs[k] = 90;
    at(api, 2, 9); period(api);
    assert.equal(api.faith.prayers.length, 0, 'someone prayed before the test set a trouble');
    /* The second person is the worse off, so neither "the first" nor "the best off" passes. */
    if (kind === 'fire'){ a.needs.warmth = 30; b.needs.warmth = 10; }
    else { pit.struct.fuel = 0; for (const k of ['berries', 'cooked', 'smoked']) c.stash[k] = 0; a.needs.food = 25; b.needs.food = 10; }
    period(api);
    const p = open(api).find(p => p.kind === kind);
    assert.ok(p, `no ${kind} prayer`);
    assert.equal(p.who, b.id, `the ${kind} prayer was not made by the one worst off`);
  }
});

test('the first fire prayer of a world made to be played can be answered', () => {
  const api = load(); api.startWorld('r', { faith: true });
  let p = null;
  for (let i = 0; i < 2 * DAY && !p; i++){ api.step(); p = api.faith && api.faith.prayers.find(q => q.kind === 'fire'); }
  assert.ok(p, 'no fire prayer in two days');
  const need = api.FAITH.cost.light;
  assert.ok(api.faith.grace >= need, `grace at the first fire prayer is ${api.faith.grace.toFixed(1)}, under the Spark's ${need}`);
  const c = api.camps.find(k => k.id === p.camp);
  assert.match(door(api, 'light', { x: c.pit[0], y: c.pit[1], z: 0 }), new RegExp(`cost ${need} grace`));
});

test('a cold pit brings a new prayer the next evening, and not before a day has passed', () => {
  const { api, a, p } = praying();
  setClock(api, p.until); api.faithTick();
  assert.equal(p.end, 'silent');
  /* Cold from dawn on, so only the wait holds the next prayer back. */
  a.needs.warmth = 10;
  const E = api.CLOCK.faith.every, next = p.at + api.CLOCK.faith.prayAgain;
  period(api, (next - api.tick) / E - 1);
  assert.equal(api.faith.prayers.filter(q => q.kind === 'fire').length, 1, 'a second fire prayer came before a day had passed');
  period(api);
  assert.equal(api.tick, next);
  const q = open(api).find(q => q.kind === 'fire');
  assert.ok(q && q.who === a.id, 'the cold pit brought no prayer the next evening');
  assert.ok(api.isEvening(), 'the new prayer is not in the evening');
});

test('one who dies with a prayer open frees the trouble for another to pray at once', () => {
  const { api, a, c } = praying();
  const b = addBeing(api, 'human', a.x, a.y); b.camp = c; b.belief = 30; b.asleep = false; b.task = null;
  for (const k in b.needs) b.needs[k] = 90;
  a.alive = false;
  period(api);
  period(api);
  const q = open(api).find(q => q.kind === 'fire');
  assert.ok(q && q.who === b.id, 'nobody else prayed for the cold pit after the one who prayed died');
});

test('a person gains from seeing a miracle once a day; a Ward with nothing near is refused and free', () => {
  const { api, a, pit } = playCamp();
  at(api, 2, 9); period(api);
  api.faith.grace = 100; a.belief = 40;
  const w = api.FAITH.belief.witness;
  door(api, 'light', { x: pit.x, y: pit.y });
  assert.equal(a.belief, 40 + w, 'the founder did not see the first Spark');
  pit.struct.lit = false;
  assert.match(door(api, 'light', { x: pit.x, y: pit.y }), /cost 15 grace/);
  assert.equal(a.belief, 40 + w, 'a second Spark the same hour gave the witness bonus again');
  setClock(api, api.tick + api.CLOCK.faith.witnessGap);
  pit.struct.lit = false;
  door(api, 'light', { x: pit.x, y: pit.y });
  assert.equal(a.belief, 40 + 2 * w, 'a Spark a day later gave no witness bonus');
  /* No wolf or fox is alive in this camp. */
  const g = api.faith.grace, n = api.faith.signs.length;
  assert.equal(door(api, 'ward', { x: pit.x, y: pit.y }), api.FAITH_TEXT.refuse.noWolves);
  assert.equal(api.faith.grace, g, 'a Ward that guarded nothing cost grace');
  assert.equal(api.faith.signs.length, n, 'a Ward that guarded nothing left a sign');
});

test('a prayer whose camp is gone ends with no line and moves nobody', () => {
  const { api, a, c, p } = praying();
  a.belief = 40;
  const n = api.chronicle.length;
  api.camps.splice(api.camps.indexOf(c), 1);
  api.camp = c;
  period(api);
  assert.equal(p.end, 'passed');
  assert.equal(api.chronicle.length, n, 'the end of a prayer whose camp is gone was logged');
  assert.ok(Math.abs(a.belief - 40) < 0.05, `belief moved from 40 to ${a.belief}`);
  assert.equal(api.camp, c, 'the camp cursor was not put back');
});

/* The Spark as soon as the grace allows, on the first camp's cold pit. It lands on day 1. */
function sparkWhenAble(api){
  const c = api.camps[0], f = api.faith;
  if (!f || !c.pit || f.grace < api.FAITH.cost.light) return;
  const p = api.tileAt(c.pit[0], c.pit[1]).struct;
  if (!p.lit && p.fuel > 0) door(api, 'light', { x: c.pit[0], y: c.pit[1], z: 0 });
}
test('a world played as the sky replays from its seed, its options, and its log', () => {
  const a = runDays('r', 2, null, sparkWhenAble, { faith: true });
  assert.ok(a.api.faith.spent > 0, 'no miracle landed, so the replay proves nothing');
  const r = a.api.replay;
  const b = runDays(r.seed, 2, null, replayGod(r), r.options);
  assert.deepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events));
  assert.deepEqual(b.api.faith, a.api.faith);
});
