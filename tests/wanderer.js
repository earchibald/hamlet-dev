// The valley after the last person: the line that says so, and the wanderer who comes.
// The case is built by hand, because no soak seed ever goes extinct.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runDays, DAY } = require('./lib/run');

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

/* ---------- the line that cannot go on ---------- */
/* One person alive and a hearth long cold. A birth needs two adults, so that valley is finished, and
   no smoke can call anyone to it. The case is built by hand: no soak seed ever comes near it. */
const DOOMED = /is the only person left in the valley/;
const CAME_TO_THE_LAST = /is not the last of the people now/;
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

test('one person and a cold hearth: the chronicle says the line is doomed, and one stranger comes', () => {
  const { api, events, thinned } = downToOne('r', 3, 26);
  const doomed = linesLike(events, DOOMED);
  assert.equal(doomed.length, 1, 'the chronicle says the line is doomed exactly once');
  assert.equal(doomed[0].kind, 'major');
  assert.equal(dayOfLine(doomed[0]), thinned + STALE, 'the line comes once the hearth is stale, not the moment it goes out');
  assert.ok(/cold/.test(doomed[0].text), 'the line does not say the hearth is cold');
  assert.ok(!/dead/.test(doomed[0].text), 'the line calls a living person dead');

  const came = linesLike(events, CAME_TO_THE_LAST);
  assert.equal(came.length, 1, 'exactly one stranger');
  assert.equal(came[0].kind, 'major');
  assert.equal(dayOfLine(came[0]), thinned + STALE + WAIT, 'the stranger comes after the wait');
  assert.deepEqual(linesLike(events, WANDERER).map(e => e.text), [], 'the stranger reuses the line meant for a valley of bones');
  assert.deepEqual(linesLike(events, EMPTY).map(e => e.text), [], 'the valley was never empty');
  assert.equal(alive(api), 2, 'the valley holds two people');
});

test('one person with the fire lit is not a doomed line', () => {
  const { api, events } = downToOne('r', 3, 26, 'lit');
  assert.deepEqual(linesLike(events, DOOMED).concat(linesLike(events, CAME_TO_THE_LAST)).map(e => e.text), []);
  assert.ok(alive(api) >= 1, 'the test killed the survivor');
});

test('a fire that is only momentarily out is not a cold hearth', () => {
  const { events } = downToOne('r', 3, 26, STALE - 2);
  assert.deepEqual(linesLike(events, DOOMED).concat(linesLike(events, CAME_TO_THE_LAST)).map(e => e.text), []);
});

/* Winter holds this stranger back too. The hearth goes cold in summer, the wait ends in winter, and
   nobody comes until spring. Days 25 to 32 are winter. */
test('winter blocks the stranger until spring', () => {
  const { api, events, thinned } = downToOne('r', 7, 36);
  const doomed = linesLike(events, DOOMED);
  assert.equal(doomed.length, 1, 'the chronicle never said the line was doomed');
  const came = linesLike(events, CAME_TO_THE_LAST);
  assert.equal(came.length, 1, 'no stranger came at all');
  const day = dayOfLine(came[0]);
  assert.ok(day > thinned + STALE + WAIT, `the stranger came on day ${day}, inside the wait`);
  assert.equal(day, 33, `the stranger came on day ${day}, not on the first day of spring`);
  assert.equal(alive(api), 2, 'the valley holds two people');
});

test('two people alive never call the stranger', () => {
  const { events } = runDays('r', 24);
  assert.deepEqual(linesLike(events, DOOMED).concat(linesLike(events, CAME_TO_THE_LAST)).map(e => e.text), []);
});

/* The two rules share a valley and must not both run. If the last one dies while the doomed wait is
   open, the doomed wait drops, and the rule for an empty valley takes the valley over from the top:
   its own line, its own wait, its own wanderer among the bones. */
test('the survivor dying mid-wait hands the valley to the empty-valley rule', () => {
  let killed = 0;
  const { api, events, thinned } = downToOne('r', 12, 48, 'always', (api, i, thin) => {
    if (killed || api.dayOf() < thin + STALE + 4) return;
    for (const b of api.beings) if (b.species === 'human' && b.alive) b.alive = false;
    killed = api.dayOf();
  });
  const doomed = linesLike(events, DOOMED);
  assert.ok(killed > thinned + STALE, 'the test killed the survivor before the doomed line');
  assert.equal(doomed.filter(e => dayOfLine(e) <= killed).length, 1, 'the doomed line came more than once before the death');
  assert.equal(dayOfLine(doomed[0]), thinned + STALE, 'the doomed line came at the wrong time');

  const gone = linesLike(events, EMPTY);
  assert.equal(gone.length, 1, 'the empty valley says so exactly once');
  assert.equal(dayOfLine(gone[0]), killed, 'the empty valley line comes on the day of the last death');
  const came = linesLike(events, WANDERER);
  assert.equal(came.length, 1, 'exactly one wanderer, and it is the one for a valley of bones');
  assert.equal(dayOfLine(came[0]), killed + WAIT, 'the wanderer comes a full wait after the last death');
  /* The doomed wait was dropped the day the survivor died. Nothing came to meet an empty valley but
     the wanderer who belongs there. */
  assert.deepEqual(linesLike(events, CAME_TO_THE_LAST).filter(e => dayOfLine(e) <= dayOfLine(came[0])).map(e => e.text), [], 'a stranger came to meet a dead valley');
  assert.ok(alive(api) >= 1, 'the valley holds people again');
  /* That wanderer is then one person beside a cold hearth, so the doomed line says so again, and a
     second stranger follows. That is the two rules taking turns, not fighting: the valley really is
     down to one again. */
  assert.equal(doomed.filter(e => dayOfLine(e) > killed).length, 1, 'the rule said nothing about the wanderer left alone');
  assert.equal(linesLike(events, CAME_TO_THE_LAST).length, 1, 'the doomed line brought more than one stranger');
  assert.equal(alive(api), 2, 'the valley holds two people');
});

test('the stale wait is a duration in the table, not a number in the rule', () => {
  const { load } = require('../src/sim');
  assert.equal(load().CLOCK.arrival.afterTheDoomed, STALE * DAY);
});
