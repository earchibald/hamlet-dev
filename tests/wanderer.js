// The valley after the last person: the line that says so, and the wanderer who comes.
// The case is built by hand, because no soak seed ever goes extinct.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runDays, DAY } = require('./lib/run');

const EMPTY = /^The last person in the valley is dead\./;
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
