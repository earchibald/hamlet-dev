// The valley after the last person: the line that says so, and the wanderer who comes.
// The case is built by hand, because no soak seed ever goes extinct.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runDays, DAY } = require('./lib/run');

/* SUSPENDED for the duration of G4, by task 1, with the user's approval through dev-coordinator.
   This file asks for 48 world days, and no day count in it has been changed. A world day
   costs about 15 s on this branch against dev's 0.31 s, so the file cannot finish in a usable time.
   The cost is the retune's, not the file's: nothing here grew, and task 4 is built to give the day
   back. The day counts are kept exactly as written rather than cut, because a count reduced to fit a
   slow engine is a gate nobody measured.
   Run it with SLOW=1. Task 4 restores it. */
const SUSPENDED_FOR_G4 = process.env.SLOW ? false
  : 'suspended for G4: this file asks for 48 world days and a world day costs about 15 s on this branch, not dev\'s 0.31 s. SLOW=1 runs it. Task 4 restores it.';
if (SUSPENDED_FOR_G4){
  test('tests/wanderer.js is suspended for the duration of G4', { skip: SUSPENDED_FOR_G4 }, () => {});
  return;
}


/* Read the meaning, not the sentence: the line says the last person is dead. The rest of it may be reworded. */
const EMPTY = /last person in the valley is dead/;
const WANDERER = /comes over the hills alone/;
const SMOKE = /^Someone saw the smoke\./;
const WAIT = 10;   // CLOCK.arrival.afterTheLast, in days

/* Run a seed, then empty the valley on the given day: every person dies, and every hearth burns out,
   as one does with nobody left to feed it. Keep running. Returns the api, the events, and the day the
   valley emptied. */
function afterTheLast(seed, killDay, days){
  let emptied = 0;
  const { api, events } = runDays(seed, days, (api, i) => {
    if (emptied || i < killDay * DAY) return;
    for (const b of api.beings) if (b.species === 'human' && b.alive) b.alive = false;
    for (const c of api.camps) if (c.pit){ const p = api.tileAt(c.pit[0], c.pit[1]).struct; p.fuel = 0; p.lit = false; }
    emptied = api.dayOf();
  });
  assert.ok(emptied, 'the test never emptied the valley');
  return { api, events, emptied };
}

const dayOfLine = e => Number(/^Day (\d+)/.exec(e.when)[1]);
const linesLike = (events, re) => events.filter(e => re.test(e.text));
const alive = api => api.beings.filter(b => b.alive && b.species === 'human').length;

test('the chronicle says the valley is empty, and one wanderer comes over the hills', () => {
  const { api, events, emptied } = afterTheLast('r', 12, 25);
  const gone = linesLike(events, EMPTY);
  assert.equal(gone.length, 1, 'the chronicle says the people are gone exactly once');
  assert.equal(gone[0].kind, 'major');
  assert.equal(dayOfLine(gone[0]), emptied, 'the line comes on the day of the last death');
  /* The pit burns its remaining fuel down untended, so the smoke arrival can still fire after this line.
     The line must say what is true as it is written, and promise nothing about the smoke. */
  assert.ok(!/smoke/i.test(gone[0].text), 'the line promises something about the smoke that a burning pit can disprove');

  const came = linesLike(events, WANDERER);
  assert.equal(came.length, 1, 'exactly one wanderer');
  assert.equal(came[0].kind, 'major');
  assert.equal(dayOfLine(came[0]), emptied + WAIT, 'the wanderer comes after the wait');
  assert.ok(/cold/.test(came[0].text) && /bones/.test(came[0].text), 'the wanderer finds a cold hearth and the bones');

  assert.ok(alive(api) >= 1, 'the valley holds people again');
  const w = api.beings.find(b => b.alive && b.species === 'human');
  assert.ok(w.camp && w.camp.site, 'the wanderer joins the old camp');
  assert.ok(came[0].text.includes(w.name), 'the line names the wanderer');
});

test('no smoke calls the wanderer: the old arrival cannot fire with the hearth cold', () => {
  const { events, emptied } = afterTheLast('r', 12, 22);
  const after = linesLike(events, SMOKE).filter(e => dayOfLine(e) >= emptied);
  assert.deepEqual(after.map(e => e.text), [], 'a cold pit made smoke');
});

test('the rule is quiet while anyone still lives', () => {
  const { api, events } = runDays('r', 24);
  assert.deepEqual(linesLike(events, EMPTY).concat(linesLike(events, WANDERER)).map(e => e.text), []);
  assert.ok(alive(api) >= 1, 'the seed kept its people');
});

/* Winter holds the wanderer back, as it holds back the arrival that follows the smoke. The valley
   empties in autumn, the wait ends in winter, and nobody comes until spring. Days 25 to 32 are winter. */
test('winter blocks the wanderer until spring', () => {
  const { api, events, emptied } = afterTheLast('r', 17, 34);
  assert.equal(emptied, 18, 'the valley emptied in autumn');
  const came = linesLike(events, WANDERER);
  assert.ok(came.length >= 1, 'no wanderer came at all');
  const day = dayOfLine(came[0]);
  assert.ok(day > emptied + WAIT, `the wanderer came on day ${day}, inside the wait`);
  assert.equal(day, 33, `the wanderer came on day ${day}, not on the first day of spring`);
  assert.ok(alive(api) >= 1, 'the valley holds people again');
});

/* A wanderer never comes unannounced: every one of them follows a line that says the valley is empty. */
test('each wanderer follows a line that says the people are gone', () => {
  const { events } = afterTheLast('r', 12, 45);
  let waiting = false, pairs = 0;
  for (const e of events){
    if (EMPTY.test(e.text)){ assert.ok(!waiting, 'two empty lines with no wanderer between them'); waiting = true; }
    else if (WANDERER.test(e.text)){ assert.ok(waiting, 'a wanderer with no empty valley behind them'); waiting = false; pairs++; }
  }
  assert.ok(pairs >= 1, 'the run never paired a line with a wanderer');
});

test('the wait is a duration in the table, not a number in the rule', () => {
  const { load } = require('../src/sim');
  assert.equal(load().CLOCK.arrival.afterTheLast, WAIT * DAY);
});

/* ---------- the line that ends, and the valley that goes on ---------- */
/* One person alive and their own hearth long cold. A birth needs two adults, so that line is
   finished, and no smoke can call anyone to it. Nobody is sent to rescue them: they keep their
   hermitage, and a founder starts a camp of their own far off instead. The case is built by hand:
   no soak seed ever comes near it. */
const ENDS = /This line ends with them/;
const NEW_LINE = /comes over the hills into the/;
const RESCUED = /is not the last of the people now/;   // the old free stranger, which must never come back
const STALE = 10;   // CLOCK.arrival.afterTheDoomed, in days

/* Run a seed, then thin the valley to one person on the given day. `cold` decides what happens to the
   hearths: 'always' holds every pit out for the rest of the run, 'lit' keeps the first pit burning,
   and a number holds the pits out for that many days and then lights them again. Returns the api, the
   events, and the day the valley came down to one. */
function downToOne(seed, thinDay, days, cold = 'always', after){
  let thinned = 0;
  const { api, events } = runDays(seed, days, (api, i) => {
    if (!thinned && i < thinDay * DAY) return;
    if (!thinned){
      const hs = api.beings.filter(b => b.species === 'human' && b.alive);
      for (const b of hs.slice(1)) b.alive = false;
      thinned = api.dayOf();
    }
    const pits = api.camps.filter(c => c.pit).map(c => api.tileAt(c.pit[0], c.pit[1]).struct);
    const warm = cold === 'lit' || (typeof cold === 'number' && api.dayOf() >= thinned + cold);
    for (const p of pits){ if (warm){ p.fuel = Math.max(p.fuel, 100); p.lit = true; } else { p.fuel = 0; p.lit = false; } }
    /* A person held beside a hearth the test keeps cold freezes in a few days, and then the test is
       about the cold, not about the rule. So the test feeds and warms whoever is alive. Each test
       kills on its own terms instead. */
    for (const b of api.beings) if (b.species === 'human' && b.alive) for (const k in b.needs) b.needs[k] = 100;
    if (after) after(api, i, thinned);
  });
  assert.ok(thinned, 'the test never thinned the valley');
  return { api, events, thinned };
}

const hermitOf = api => api.beings.filter(b => b.alive && b.species === 'human').sort((p, q) => p.id - q.id)[0];
const newCamps = api => api.camps.filter(c => c.overTheHills);

test('one person and a cold hearth: the line ends with them, and a new camp is founded elsewhere', () => {
  const { api, events, thinned } = downToOne('r', 3, 30);
  const ended = linesLike(events, ENDS);
  assert.equal(ended.length, 1, 'the chronicle says the line ends exactly once');
  assert.equal(ended[0].kind, 'major');
  assert.equal(dayOfLine(ended[0]), thinned + STALE, 'the line comes once the hearth is stale, not the moment it goes out');
  assert.ok(/cold/.test(ended[0].text), 'the line does not say the hearth is cold');
  assert.ok(!/dead/.test(ended[0].text), 'the line calls a living person dead');
  /* The false claim this rule was raised over. Nobody was lost, and once the new camp stands they are
     not the only person in the valley either. */
  assert.ok(!/only person left in the valley/.test(ended[0].text), 'the line still says the old false thing');

  const came = linesLike(events, NEW_LINE);
  assert.equal(came.length, 1, 'exactly one founder');
  assert.equal(came[0].kind, 'major');
  assert.equal(dayOfLine(came[0]), thinned + STALE + WAIT, 'the founder comes after the wait');
  assert.deepEqual(linesLike(events, RESCUED).map(e => e.text), [], 'the hermit was handed a free stranger');
  assert.deepEqual(linesLike(events, WANDERER).map(e => e.text), [], 'the founder reused the line meant for a valley of bones');
  assert.deepEqual(linesLike(events, EMPTY).map(e => e.text), [], 'the valley was never empty');
  assert.equal(alive(api), 2, 'the valley holds two people');

  /* The hermit keeps their hermitage: nobody joined them, and their own camp is theirs alone. */
  const hermit = hermitOf(api);
  assert.ok(came[0].text.includes(hermit.name), 'the line does not say who the founder is far from');
  const withHermit = api.beings.filter(b => b.alive && b.species === 'human' && b.camp === hermit.camp);
  assert.deepEqual(withHermit.map(b => b.name), [hermit.name], 'somebody moved in with the hermit');

  /* The valley goes on through a new line: its own camp, its own founder, its own name. */
  const made = newCamps(api);
  assert.equal(made.length, 1, 'exactly one camp came out of the hills');
  const nc = made[0];
  assert.notEqual(nc, hermit.camp, 'the new camp is the hermit\'s own');
  assert.ok(nc.site, 'the new camp has no site');
  assert.ok(nc.founder && nc.founder !== hermit.id, 'the new camp has no founder of its own');
  const founder = api.beingById(nc.founder);
  assert.ok(founder && founder.alive && founder.camp === nc, 'the founder does not belong to the camp they founded');
  assert.ok(came[0].text.includes(founder.name), 'the line does not name the founder');
  assert.ok(api.nameOf(nc), 'the new camp never got a name record');
  assert.equal(nc.name, `${founder.name}'s camp`, 'the camp is not named for its founder');
});

test('the new camp keeps its distance, and takes the farthest ground rather than the nearest', () => {
  /* Record the ground on offer while the valley still holds one camp. The last record is the tick
     before the founder walks in, which is the choice the rule made. */
  let offer = null;
  const { api, thinned } = downToOne('r', 3, 30, 'always', api => {
    if (api.camps.length !== 1) return;
    const h = hermitOf(api); if (!h) return;
    offer = { here: api.secOf(h.x, h.y), cands: api.campSites().map(s => ({ sx: s.sx, sy: s.sy })) };
  });
  assert.ok(thinned && offer && offer.cands.length > 1, 'the run never offered a choice of ground');

  const nc = newCamps(api)[0];
  assert.ok(nc, 'no camp came out of the hills');
  const there = api.secOf(nc.site[0], nc.site[1]);
  const reach = s => api.dist(s.sx, s.sy, offer.here.sx, offer.here.sy);
  const far = Math.max(...offer.cands.map(reach));
  assert.ok(far > Math.min(...offer.cands.map(reach)), 'every candidate stood the same distance away');
  assert.equal(reach(there), far, 'the rule took ground that was not the farthest on offer');

  /* The separation the founding party keeps, kept here too, and read from one place. */
  const apart = api.CAMPS_APART;
  assert.equal(typeof apart, 'number');
  for (const c of api.camps) if (c !== nc && c.site){
    const s = api.secOf(c.site[0], c.site[1]);
    assert.ok(api.dist(s.sx, s.sy, there.sx, there.sy) >= apart, 'the new camp stands on top of an old one');
  }
});

test('nobody welcomes the founder into an empty camp', () => {
  const { events } = downToOne('r', 3, 30);
  const welcomed = linesLike(events, /is welcomed by the fire/);
  const met = linesLike(events, /Nobody is there to meet them/);
  assert.equal(met.length, 1, 'the founder was not told they arrived alone');
  assert.deepEqual(welcomed.filter(e => met.length && dayOfLine(e) >= dayOfLine(met[0])).map(e => e.text), [],
    'a camp with nobody in it welcomed somebody by a fire it does not have');
});

test('one person with the fire lit is not an ended line', () => {
  const { api, events } = downToOne('r', 3, 26, 'lit');
  assert.deepEqual(linesLike(events, ENDS).concat(linesLike(events, NEW_LINE)).map(e => e.text), []);
  assert.ok(alive(api) >= 1, 'the test killed the survivor');
});

test('a fire that is only momentarily out is not a cold hearth', () => {
  const { events } = downToOne('r', 3, 26, STALE - 2);
  assert.deepEqual(linesLike(events, ENDS).concat(linesLike(events, NEW_LINE)).map(e => e.text), []);
});

/* Winter holds this founder back too. The hearth goes cold in summer, the wait ends in winter, and
   nobody comes until spring. Days 25 to 32 are winter. */
test('winter blocks the founder until spring', () => {
  const { api, events, thinned } = downToOne('r', 7, 36);
  const ended = linesLike(events, ENDS);
  assert.equal(ended.length, 1, 'the chronicle never said the line ends');
  const came = linesLike(events, NEW_LINE);
  assert.equal(came.length, 1, 'no founder came at all');
  const day = dayOfLine(came[0]);
  assert.ok(day > thinned + STALE + WAIT, `the founder came on day ${day}, inside the wait`);
  assert.equal(day, 33, `the founder came on day ${day}, not on the first day of spring`);
  assert.equal(alive(api), 2, 'the valley holds two people');
});

test('two people alive never start a new line', () => {
  const { events } = runDays('r', 24);
  assert.deepEqual(linesLike(events, ENDS).concat(linesLike(events, NEW_LINE)).map(e => e.text), []);
});

/* One new line at a time. Kill the hermit once the new camp stands and hold every pit cold, and the
   founder is then the one person alive beside a hearth of their own going cold. The chronicle says
   their line ends too, and that is true. No third camp comes out of the hills for it. */
test('a line begun out of the hills does not start another while it lives', () => {
  let killed = 0;
  const { api, events, thinned } = downToOne('r', 3, 48, 'always', (api, i, thin) => {
    if (killed || !newCamps(api).length) return;
    const nc = newCamps(api)[0];
    if (!nc.pit) return;   // wait until the new line keeps a hearth of its own
    const hermit = hermitOf(api);
    if (hermit && hermit.camp !== nc){ hermit.alive = false; killed = api.dayOf(); }
  });
  assert.ok(killed > thinned + STALE + WAIT, 'the test never killed the hermit after the new camp stood');
  assert.equal(alive(api), 1, 'the founder did not outlive the run, so the guard was never tested');
  /* The rule says the founder's own line ends too, and that is true and worth saying. What it must
     not do is answer it with a third camp. */
  const ended = linesLike(events, ENDS);
  assert.equal(ended.length, 2, 'the rule said nothing about the founder left alone');
  assert.ok(dayOfLine(ended[1]) > killed, 'the second line came before the hermit died');
  assert.equal(newCamps(api).length, 1, 'a second camp came out of the hills while the first still lived');
  assert.equal(linesLike(events, NEW_LINE).length, 1, 'a second founder walked in');
  assert.deepEqual(linesLike(events, EMPTY).map(e => e.text), [], 'the valley was never empty');
});

/* The two rules share a valley and must not both run. If the last one dies while the wait is open,
   that wait drops, and the rule for an empty valley takes the valley over from the top: its own line,
   its own wait, its own wanderer among the bones. */
test('the survivor dying mid-wait hands the valley to the empty-valley rule', () => {
  let killed = 0;
  const { api, events, thinned } = downToOne('r', 12, 48, 'always', (api, i, thin) => {
    if (killed || api.dayOf() < thin + STALE + 4) return;
    for (const b of api.beings) if (b.species === 'human' && b.alive) b.alive = false;
    killed = api.dayOf();
  });
  const ended = linesLike(events, ENDS);
  assert.ok(killed > thinned + STALE, 'the test killed the survivor before the line was said to end');
  assert.equal(ended.filter(e => dayOfLine(e) <= killed).length, 1, 'the line came more than once before the death');
  assert.equal(dayOfLine(ended[0]), thinned + STALE, 'the line came at the wrong time');

  const gone = linesLike(events, EMPTY);
  assert.equal(gone.length, 1, 'the empty valley says so exactly once');
  assert.equal(dayOfLine(gone[0]), killed, 'the empty valley line comes on the day of the last death');
  const came = linesLike(events, WANDERER);
  assert.equal(came.length, 1, 'exactly one wanderer, and it is the one for a valley of bones');
  assert.equal(dayOfLine(came[0]), killed + WAIT, 'the wanderer comes a full wait after the last death');
  /* The wait was dropped the day the survivor died. Nothing came to meet an empty valley but the
     wanderer who belongs there. */
  assert.deepEqual(linesLike(events, NEW_LINE).filter(e => dayOfLine(e) <= dayOfLine(came[0])).map(e => e.text), [], 'a founder came to meet a dead valley');
  assert.ok(alive(api) >= 1, 'the valley holds people again');
});

/* Two ways for the rule to run out of options, and the run has to reach one of them on its own, since
   no soak seed does. Wall the rim of the world in bare rock and no edge of it reaches any ground
   inside, so `comeOverTheHills` finds no way in for any site the rule picks. Turn every sector rocky
   and nothing in the valley grows, so there is no founding site to pick in the first place. */
function wallTheRim(api){
  const wall = (x, y) => { const t = api.tileAt(x, y, 0); if (t){ t.ground = 'rock'; t.feature = null; t.struct = null; } };
  for (let x = 0; x < api.W; x++){ wall(x, 0); wall(x, api.H - 1); }
  for (let y = 0; y < api.H; y++){ wall(0, y); wall(api.W - 1, y); }
}
const barrenTheValley = api => { for (const s of api.sectors) s.biome = 'rocky'; };

/* The rule tries, fails, and must then wait again rather than try again every tick. Trying costs a
   camp record and a flood fill for each candidate site, so an unbounded retry is both a leak and a
   stall. The corrected line restarts the wait. Clearing it instead looks more natural, and says the
   line ends over again every ten days; that is what the first assertion here holds down. Both ways
   out of options take the same line, so the rule has one answer to failure, and both are run here. */
function runsOutOfOptions(name, block, waitKey){
  test(`no way on for a founder (${name}): the rule waits again rather than trying every tick`, () => {
    let blocked = 0, ticks = 0, idTicks = 0, lastId = 0, cleared = 0, mostCamps = 0, longestWait = 0;
    const { api, events, thinned } = downToOne('r', 3, 45, 'always', (api, i, thin) => {
      if (!blocked){ block(api); blocked = api.dayOf(); }
      /* Count only after the first attempt has been made and failed, so the whole window lies inside
         the retry. A window that reaches back before the first attempt dilutes the count and lets a
         per-tick retry through. */
      if (api.dayOf() <= thin + STALE + WAIT) return;
      ticks++;
      if (api.nextId !== lastId){ if (lastId) idTicks++; lastId = api.nextId; }
      if (!api.doomAt) cleared++;
      longestWait = Math.max(longestWait, api.doomAt - api.tick);
      mostCamps = Math.max(mostCamps, api.camps.length);
    });
    assert.ok(blocked <= thinned, 'the world was blocked after the valley was thinned');
    assert.equal(linesLike(events, NEW_LINE).length, 0, 'a founder got through, so the path under test never ran');
    assert.ok(ticks > 15 * DAY, 'the window is too short to tell a per-tick retry from ordinary life');

    /* One: the fix is right, not merely bounded. */
    assert.equal(linesLike(events, ENDS).length, 1, 'the chronicle says the line ends more than once');
    assert.equal(cleared, 0, 'the failure path cleared the wait, which says the line ends again every ten days');
    assert.ok(api.doomAt > api.tick, 'the wait was left in the past, so the rule tries again every tick');
    /* Which wait, not merely some wait. A stable failure takes the full stretch and a passing one takes
       the short retry, so a test that only asked for a wait in the future would pass against either
       constant in either place. The longest gap seen is the value the rule set, because the hook reads
       it on the tick the rule set it. */
    const { load } = require('../src/sim');
    assert.equal(longestWait, load().CLOCK.arrival[waitKey], `the rule set a wait other than CLOCK.arrival.${waitKey}`);

    /* Two and three: the unbounded retry. The walled rim reached it through a camp record a tick; the
       old line popped that record on the way out, so `camps` stayed at one and the id climbed alone.
       Measured over this window, that took an id on 55 ticks in every 100; winter holds the rule off,
       which is why it is not every one. The same window with the wait restarted takes 7 in every 100,
       all of it ordinary life in the valley. A fifth is the line, about three times clear of both.
       A barren valley never reaches `makeCamp` at all, so it leaks no id and only the wait tells. */
    assert.equal(mostCamps, 1, 'camp records piled up');
    assert.ok(idTicks < ticks / 5, `a new id was taken on ${idTicks} of ${ticks} ticks, which is the rule trying again every tick`);
  });
}
runsOutOfOptions('no way in', wallTheRim, 'afterTheLast');
runsOutOfOptions('no ground to be had', barrenTheValley, 'foundRetry');

test('the stale wait is a duration in the table, not a number in the rule', () => {
  const { load } = require('../src/sim');
  assert.equal(load().CLOCK.arrival.afterTheDoomed, STALE * DAY);
});
