// The door: every outside act enters by inject(), is logged, and shows in the chronicle. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const { DAY, runDays, runOn, collect, scriptGod, replayGod, fingerprint } = require('./lib/run');

test('an unknown act or source is refused and not logged', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.inject({ source: 'player', act: 'smite', x: 1, y: 1 }), 'Nothing answers.');
  assert.equal(api.inject({ source: 'weather', act: 'light', x: 1, y: 1, z: 0 }), 'Nothing answers.');
  assert.deepEqual(api.doorLog, []);
});

test('lighting the ground through the door burns it, logs the event with its tick, and writes the chronicle', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson();
  let t = null;
  for (let dy = -6; dy <= 6 && !t; dy++) for (let dx = -6; dx <= 6 && !t; dx++){ const q = api.hasTile(a.x + dx, a.y + dy, 0) && api.tileAt(a.x + dx, a.y + dy); if (q && q.ground === 'grass' && !q.feature) t = q; }
  assert.ok(t, 'no grass near the first person');
  const before = api.chronicle.length;
  const msg = api.inject({ source: 'player', act: 'light', x: t.x, y: t.y, z: 0 });
  assert.equal(msg, 'Lightning. Something is burning, and it will smoulder a while.');
  assert.ok(t.fire > 0);
  assert.deepEqual(api.doorLog, [{ tick: api.tick, source: 'player', act: 'light', x: t.x, y: t.y, z: 0 }]);
  assert.equal(api.chronicle.length, before + 1);
  assert.match(api.chronicle[0].text, /Lightning strikes/);
});

test('a lighting that does nothing is still logged', () => {
  const api = load(); api.startWorld('r');
  let t = null;
  for (const q of api.world) if (q.ground === 'water'){ t = q; break; }
  assert.equal(api.inject({ source: 'player', act: 'light', x: t.x, y: t.y, z: 0 }), 'Nothing here will burn.');
  assert.equal(api.doorLog.length, 1);
  assert.equal(api.doorLog[0].act, 'light');
  assert.equal(api.doorLog[0].tick, api.tick);
});

test('a poke through the door names the person in the chronicle and is logged by id', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson();
  const msg = api.inject({ source: 'player', act: 'poke', id: a.id });
  assert.match(msg, new RegExp(`^${a.name} looks up, then (goes to .+|gets to it)\\.$`));
  assert.deepEqual(api.doorLog, [{ tick: api.tick, source: 'player', act: 'poke', id: a.id }]);
  /* chooseTask runs after the nudge and may write its own lines, so look for the line, not at the top. */
  assert.ok(api.chronicle.some(e => e.text === `${a.name} feels a nudge from above.`), 'no chronicle line for the nudge');
  assert.equal(api.inject({ source: 'player', act: 'poke', id: -1 }), 'Nobody is there to nudge.');
  assert.equal(api.doorLog.length, 2);
  assert.equal(api.doorLog[1].id, -1);
});

test('a new world empties the log', () => {
  const api = load(); api.startWorld('r');
  api.inject({ source: 'player', act: 'poke', id: api.firstPerson().id });
  api.startWorld('x');
  assert.deepEqual(api.doorLog, []);
});

test('the replay record names the seed and the options', () => {
  const api = load(); api.startWorld('r', { sw: 12, sh: 8 });
  const a = api.firstPerson();
  api.inject({ source: 'player', act: 'poke', id: a.id });
  assert.deepEqual(api.replay, { seed: 'r', options: { sw: 12, sh: 8, zmin: -2, zmax: 2, ageLimit: 200, force: false }, log: [{ tick: api.tick, source: 'player', act: 'poke', id: a.id }] });
});

test('a goal priority is an act: refused for a bad goal or value, logged, and in the chronicle', () => {
  const api = load(); api.startWorld('r');
  assert.equal(api.inject({ source: 'player', act: 'priority', id: 'no-such-goal', pri: 2 }), 'No such goal.');
  assert.equal(api.inject({ source: 'player', act: 'priority', id: 'snare', pri: 5 }), 'A priority is off, on, or high.');
  assert.equal(api.doorLog.length, 2, 'lawful acts that did nothing are still logged');
  assert.equal(api.inject({ source: 'player', act: 'priority', id: 'snare', pri: 2 }), 'Set snares for rabbits: high.');
  assert.equal(api.goalPriority.snare, 2);
  assert.ok(api.chronicle.some(e => e.text === 'A wish from above: set snares for rabbits is wanted most.'));
});

test('the camp site is an act with its guards inside the door', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.camp = api.camps[0];
  /* The open tile must be one the person can walk to: the site guard refuses any other, and this test is about the other guards. */
  const region = api.reachable(a.x, a.y, 0, api.NZ * api.W * api.H);
  let water = null, open = null;
  for (const t of api.world){ if (!water && t.ground === 'water') water = t; if (!open && t.ground === 'grass' && !t.feature && !t.struct && region.has(api.idx3(t.x, t.y, 0))) open = t; if (water && open) break; }
  assert.equal(api.inject({ source: 'player', act: 'site', x: open.x, y: open.y, z: 1 }), 'The camp must be on the valley floor.');
  assert.equal(api.inject({ source: 'player', act: 'site', x: water.x, y: water.y, z: 0 }), 'The camp site must be open ground you can stand on.');
  assert.equal(api.inject({ source: 'player', act: 'site', x: open.x, y: open.y, z: 0 }), 'Camp site set. The fire pit will go here.');
  assert.deepEqual(api.camps[0].site, [open.x, open.y]);
  assert.ok(api.chronicle.some(e => e.text === 'The camp site moves. Someone felt it was right.'));
  api.camps[0].pit = [open.x, open.y];
  assert.equal(api.inject({ source: 'player', act: 'site', x: open.x, y: open.y, z: 0 }), 'The fire pit is already built. The camp stays where it is.');
  assert.equal(api.doorLog.length, 4);
});

test('a site on an unreachable tile is refused through inject', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); api.camp = api.camps[0];
  let open = null;
  for (const t of api.world){ if (t.ground === 'grass' && !t.feature && !t.struct && api.dist(t.x, t.y, a.x, a.y) > 5){ open = t; break; } }
  assert.ok(open, 'no open tile far from the first person');
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ if (!api.hasTile(open.x + dx, open.y + dy, 0)) continue; const q = api.tileAt(open.x + dx, open.y + dy); q.ground = 'water'; q.feature = null; q.struct = null; }
  const msg = api.inject({ source: 'player', act: 'site', x: open.x, y: open.y, z: 0, camp: api.camps[0].id });
  assert.equal(msg, 'Nobody can walk there from where they stand.');
  assert.equal(api.camps[0].site, null);
});

test('the site act carries its camp: a second camp\'s site replays deterministically across days through the harness', () => {
  /* This test held `const DAY = 1000`, a second private copy of the day, which is the same fault
     `tests/lib/run.js` held and which finding 3 of task 1's report records. One copy was found and
     fixed; this one was in another file and was not looked at. The ticks below are now written as
     fractions of the real day, so they say what they mean at any length of day. */
  const DAYS = 3;
  const SITE_TICK = DAY + DAY / 10;      // day 2, a tenth of the way in
  const POKE_TICK = DAY * 2 + DAY / 4;   // day 3, a different tick, a different act

  /* Both tiles must be ones the first person can walk to, or the site guard refuses the act. */
  const findTwoOpenTiles = api => {
    const a = api.firstPerson();
    const region = api.reachable(a.x, a.y, 0, api.NZ * api.W * api.H);
    let open1 = null, open2 = null;
    for (const t of api.world){
      if (t.ground !== 'grass' || t.feature || t.struct || !region.has(api.idx3(t.x, t.y, 0))) continue;
      if (!open1) open1 = t;
      else if (!open2 && api.dist(t.x, t.y, open1.x, open1.y) > 6){ open2 = t; break; }
    }
    return [open1, open2];
  };

  /* Force a second camp into being at the very first tick. This is setup, not a logged act, so it
     runs the same way, at the same tick, whether we are recording or replaying: it belongs to the
     run's options, not to the log. */
  const withSecondCamp = (state, god) => (api, i) => {
    if (i === 0){ state.c2 = api.makeCamp('Second camp'); [state.o1, state.o2] = findTwoOpenTiles(api); }
    god(api, i);
  };

  const recState = {};
  const recordGod = (api, i) => {
    scriptGod(api, i);
    if (api.tick === SITE_TICK){
      api.camp = recState.c2;
      api.inject({ source: 'player', act: 'site', x: recState.o2.x, y: recState.o2.y, z: 0, camp: recState.c2.id });
    }
    if (api.tick === POKE_TICK) api.inject({ source: 'player', act: 'poke', id: api.firstPerson().id });
  };
  const a = runDays('r', DAYS, null, withSecondCamp(recState, recordGod));
  assert.ok(a.api.doorLog.some(e => e.act === 'site' && e.camp === recState.c2.id), 'the site act on the second camp was not logged');
  assert.deepEqual(recState.c2.site, [recState.o2.x, recState.o2.y]);

  /* Replay: the same forced second camp, at the same tick, then only the log — no script god. */
  const replay = a.api.replay;
  const repState = {};
  const rg = replayGod(replay);
  const b = runDays(replay.seed, DAYS, null, withSecondCamp(repState, api => rg(api)), replay.options);

  assert.deepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events), 'the two runs diverged');
  assert.deepEqual(b.api.doorLog, a.api.doorLog);
  assert.deepEqual(b.api.camps[1].site, [recState.o2.x, recState.o2.y], 'the second camp did not get its site back on replay');
  assert.deepEqual(b.api.camps[0].site, a.api.camps[0].site, 'the first camp\'s own site differed between record and replay');
});

test('an event that carries a tick must arrive at that tick', () => {
  const api = load(); api.startWorld('r');
  const a = api.firstPerson();
  assert.equal(api.inject({ source: 'player', act: 'poke', id: a.id, tick: api.tick - 1 }), 'Not now.');
  assert.equal(api.inject({ source: 'player', act: 'poke', id: a.id, tick: api.tick + 1 }), 'Not now.');
  assert.deepEqual(api.doorLog, []);
  assert.match(api.inject({ source: 'player', act: 'poke', id: a.id, tick: api.tick }), new RegExp(`^${a.name} looks up, then (goes to .+|gets to it)\\.$`));
  assert.deepEqual(api.doorLog, [{ source: 'player', act: 'poke', id: a.id, tick: api.tick }]);
});

test('a load through the door puts the saved world in place, and logs one bare entry at the new tick', () => {
  const rec = runDays('r', 4, null, scriptGod);
  const snap = JSON.parse(JSON.stringify(rec.api.takeSnapshot()));

  const api = load(); api.startWorld('x');
  const msg = api.inject({ source: 'player', act: 'load', snapshot: snap });
  assert.equal(msg, `The world is as it was on day ${rec.api.dayOf()}.`);
  assert.equal(api.tick, rec.api.tick);
  assert.equal(api.beings.length, rec.api.beings.length);
  assert.deepEqual(api.doorLog, [...snap.doorLog, { source: 'player', act: 'load', tick: api.tick }]);
});

test('a refused load leaves the state and the log untouched', () => {
  const api = load(); api.startWorld('r');
  api.inject({ source: 'player', act: 'poke', id: api.firstPerson().id });
  const before = JSON.stringify(api.takeSnapshot()), beforeLog = JSON.stringify(api.doorLog), tickBefore = api.tick;
  const msg = api.inject({ source: 'player', act: 'load', snapshot: {} });
  assert.equal(typeof msg, 'string');
  assert.notEqual(msg, 'The world is as it was on day 1.');
  assert.equal(JSON.stringify(api.takeSnapshot()), before);
  assert.equal(JSON.stringify(api.doorLog), beforeLog);
  assert.equal(api.tick, tickBefore);
});

test('a load from an unknown source is refused as every act is', () => {
  const rec = runDays('r', 4, null, scriptGod);
  const snap = JSON.parse(JSON.stringify(rec.api.takeSnapshot()));
  const api = load(); api.startWorld('x');
  assert.equal(api.inject({ source: 'weather', act: 'load', snapshot: snap }), 'Nothing answers.');
  assert.deepEqual(api.doorLog, []);
});

test('a story with a load in it replays: the load passes through inject, and a replay run tells the same story without sending it to the door', () => {
  /* Nine days and fourteen days, which were written as 9000 and 14000 ticks of the old 1000-tick
     day. They are days, so they are written as days. */
  const SAVE_STEP = 9 * DAY, TOTAL_STEP = 14 * DAY;

  const rec = runDays('r', SAVE_STEP / DAY, null, scriptGod);
  const cut = rec.events.length;
  const snap = JSON.parse(JSON.stringify(rec.api.takeSnapshot()));

  const b = load(); b.startWorld('x');
  assert.equal(b.inject({ source: 'player', act: 'load', snapshot: snap }), `The world is as it was on day ${b.dayOf()}.`);
  assert.deepEqual(b.doorLog, [...snap.doorLog, { source: 'player', act: 'load', tick: b.tick }]);

  const cb = collect(b);
  runOn(b, SAVE_STEP, TOTAL_STEP - SAVE_STEP, cb, scriptGod);

  const replay = b.replay;
  assert.equal(replay.seed, 'r');
  assert.equal(replay.log.filter(e => e.act === 'load').length, 1);

  /* A fresh sim replays the whole merged log from tick 0. `inject` is watched, so a `load` entry
     that slipped past `logGod` and reached the door would be caught here, not only by a mismatched
     fingerprint. */
  const c = load(); const cc = collect(c); c.startWorld(replay.seed, replay.options);
  let loadSentToDoor = false;
  const realInject = c.inject;
  c.inject = e => { if (e.act === 'load') loadSentToDoor = true; return realInject(e); };
  const rg = replayGod(replay);
  for (let i = 0; i < TOTAL_STEP; i++){ c.step(); rg(c); }

  cb.check('the loaded world'); cc.check('the replayed world');
  assert.equal(loadSentToDoor, false, 'the replay sent the load entry to the door');
  assert.deepEqual(fingerprint(b, cb.events), fingerprint(c, cc.events.slice(cut)));
});
