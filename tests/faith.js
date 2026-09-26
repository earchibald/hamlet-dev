// The sky plays: belief, grace, prayers, credit, the miracles, the season's tally, and forgotten.
// Hand-built camps on seed r, so each check is a few rules and not a run. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const { runDays, setClock, DAY } = require('./lib/run');

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

test('faith off: no record, no belief, and rain, ward, and beckon refuse and change nothing', () => {
  const { api } = runDays('r', 0.25, null, () => {});
  assert.equal(api.options.faith, false);
  assert.equal(api.faith, null, 'a world with faith off made a faith record');
  assert.ok(api.beings.every(b => !('belief' in b)), 'a person in a world with faith off has a belief');
  const off = api.FAITH_TEXT.refuse.off, storm = api.weather.storm;
  for (const act of ['rain', 'ward', 'beckon']) assert.equal(door(api, act, { x: 5, y: 5, z: 0 }), off, act);
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

test('grace comes from belief each hour, and stops at the cap', () => {
  const { api, a, pit } = playCamp(); pit.struct.fuel = 0;
  at(api, 2, 9); period(api);
  const hour = api.hours(1) / api.CLOCK.faith.every;
  api.faith.grace = 0; a.belief = 60; period(api, hour);
  assert.ok(Math.abs(api.faith.grace - 0.6) < 0.01, `one person at belief 60 gave ${api.faith.grace} grace in an hour, not 0.6`);
  api.faith.grace = 99.99; period(api);
  assert.equal(api.faith.grace, 100);
});

test('belief fades 2 a day to the floor, and never past it', () => {
  const { api, a, pit } = playCamp(); pit.struct.fuel = 0;
  at(api, 2, 9); period(api);
  const day = DAY / api.CLOCK.faith.every;
  a.belief = 50; period(api, day);
  assert.ok(Math.abs(a.belief - 48) < 0.01, `belief went from 50 to ${a.belief} in a day, not 48`);
  a.belief = 6; period(api, day);
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
  assert.equal(p.until, api.tick + api.CLOCK.faith.deadline.fire, 'a morning fire prayer waits 12 hours');
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
  assert.equal(door(api, 'light', { x: pit.x, y: pit.y }), 'Your grace is too thin. 10 of 15.');
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
    w.x = a.x + 30; w.task = null;
    period(api);
    assert.equal(p.end, warded ? 'sky' : 'own');
  }
});

test('hunger opens a prayer by the hungriest, and a fire near the camp opens a wildfire prayer', () => {
  const { api, a, c, pit } = playCamp();
  at(api, 2, 9); period(api);
  for (const k of ['berries', 'cooked', 'smoked']) c.stash[k] = 0;
  a.needs.food = 10; pit.struct.fuel = 0;
  period(api);
  const h = open(api).find(p => p.kind === 'hunger');
  assert.ok(h && h.who === a.id, 'no hunger prayer');
  /* A second person, since the founder already has a prayer open, and a pine burning near the site. */
  const b = addBeing(api, 'human', a.x, a.y); b.camp = c; b.belief = 30;
  const t = api.tileAt(pit.x + 5, pit.y); t.ground = 'grass'; t.feature = 'tree';
  api.lightTile(t.x, t.y, 0);
  assert.ok(t.fire > 0 && api.fireCount > 0, 'the pine did not catch');
  period(api);
  const f = open(api).find(p => p.kind === 'wildfire');
  assert.ok(f && f.who === b.id, 'no wildfire prayer');
  /* Rain anywhere answers it. */
  api.faith.grace = 50; api.weather.storm = false;
  door(api, 'rain', { x: 1, y: 1 });
  t.fire = 0; period(api);
  assert.equal(f.end, 'sky');
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
