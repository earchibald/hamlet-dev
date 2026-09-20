// The soak's two day-count guards, exercised on the skip path as well as the run path.
//
// The defect these guards replace shipped because every test of the two claims drove the assertion
// and nothing drove the guard (issue #113). A test that forces an assertion to fail shows only that
// the assertion is wired up. It says nothing about which runs the guard lets through. So the tests
// below name a day count on each side of each boundary. They ask the guard what it does with it.
//
// They live in the fast suite, not in the soak, for two reasons. The guards are pure functions of a
// day count, so no run is needed to exercise them; the soak would spend 90 seconds to learn the same
// thing. And a guard's whole job is to decide whether a soak claim runs. A test that could only run
// inside the soak would let the guard switch its own test off.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('../src/sim');
const { SEASON_CLAIM_DAYS, OLD_AGE_CLAIM_DAYS, seasonClaimSkip, oldAgeClaimSkip, oldAgeFloor } = require('./lib/claims');

/* A skip reason must be a string node:test can print. It must name the run it turned away and the
   run it wants. Otherwise the reader must grep for the number. */
function assertSkipped(reason, days, want){
  assert.equal(typeof reason, 'string', `${days} days: expected a skip reason, got ${JSON.stringify(reason)}`);
  assert.ok(reason.includes(String(days)), `the skip reason does not say how long the run was: ${reason}`);
  assert.ok(reason.includes(String(want)), `the skip reason does not say how long a run it wants: ${reason}`);
}

test('the season guard admits a year and turns away a day less', () => {
  assert.equal(seasonClaimSkip(SEASON_CLAIM_DAYS), false, 'a run of exactly a year must make the season claim');
  assertSkipped(seasonClaimSkip(SEASON_CLAIM_DAYS - 1), SEASON_CLAIM_DAYS - 1, SEASON_CLAIM_DAYS);
});

test('the old-age guard admits its measured floor and turns away a day less', () => {
  assert.equal(oldAgeClaimSkip(OLD_AGE_CLAIM_DAYS), false, 'a run of exactly the measured floor must make the old-age claim');
  assertSkipped(oldAgeClaimSkip(OLD_AGE_CLAIM_DAYS - 1), OLD_AGE_CLAIM_DAYS - 1, OLD_AGE_CLAIM_DAYS);
});

/* The direction that was silent. A 40-day run visits all four seasons. Under the old single guard
   the season claim skipped anyway, because 40 is less than the soak's 70. Every run from a year to a
   day short of the default lost that coverage and said nothing. */
test('a run longer than a year but shorter than the soak makes the season claim and not the old-age one', () => {
  for (const days of [SEASON_CLAIM_DAYS, 40, OLD_AGE_CLAIM_DAYS - 1]){
    assert.equal(seasonClaimSkip(days), false, `${days} days covers a year, so the season claim must run`);
    assertSkipped(oldAgeClaimSkip(days), days, OLD_AGE_CLAIM_DAYS);
  }
});

/* The direction that was loud. `DAYS >= DEFAULT_DAYS` is true whenever DAYS is defaulted, no matter
   the default. So a branch that set DEFAULT_DAYS to 3 ran both claims on a 3-day run, and both went
   red. Neither guard reads DEFAULT_DAYS now, so a short run skips. */
test('a run far too short for either claim skips both, whatever the soak defaults to', () => {
  for (const days of [1, 3, 10]){
    assertSkipped(seasonClaimSkip(days), days, SEASON_CLAIM_DAYS);
    assertSkipped(oldAgeClaimSkip(days), days, OLD_AGE_CLAIM_DAYS);
  }
});

test('a long run makes both claims', () => {
  for (const days of [OLD_AGE_CLAIM_DAYS, 90, 365]){
    assert.equal(seasonClaimSkip(days), false, `${days} days must make the season claim`);
    assert.equal(oldAgeClaimSkip(days), false, `${days} days must make the old-age claim`);
  }
});

/* What holds the season literal. It is a calendar fact, so it is checked against the calendar.
   tests/clock.js pins the calendar itself in plain numbers: a season of 8 days, a year of 32. A
   calendar change goes red there and names the number. It goes red here too, naming this literal. */
test('the season literal is one year by the calendar', () => {
  const api = load();
  assert.equal(SEASON_CLAIM_DAYS, api.years(1) / api.DAY,
    `the season claim waits ${SEASON_CLAIM_DAYS} days for a year that is now ${api.years(1) / api.DAY} days. A shorter wait makes a claim the run cannot meet; a longer one skips a run that could.`);
});

/* What holds the old-age literal, which is a weaker thing and says so. 70 is a measured floor, and
   no test can pin a measurement. `70 === 70` is a test that cannot fail, and issue #94 exists to
   remove tests like that. The life table gives a lower bound instead. A newcomer arrives aged
   between `adult` and `old`, and dies past `life`. So the oldest arrival needs `life - old` days to
   cross the span, and the literal must sit above that. It sits far above it on purpose. The death is
   a roll that needs ticks to fire, so the arithmetic minimum would make the claim intermittent. */
test('the old-age literal is not below the floor the life table gives', () => {
  const api = load(), LH = api.LIFE.human;
  const floor = oldAgeFloor(api.LIFE);
  assert.equal(floor, LH.life - LH.old);
  assert.ok(OLD_AGE_CLAIM_DAYS >= floor,
    `the old-age claim is made on runs of ${OLD_AGE_CLAIM_DAYS} days, but the oldest newcomer now needs ${floor} days to pass the span (life ${LH.life}, old ${LH.old}). The claim would be asking for a death the run cannot reach.`);
  assert.ok(LH.adult < LH.old && LH.old < LH.life, `the life table is out of order: adult ${LH.adult}, old ${LH.old}, life ${LH.life}`);
});

/* The guards are only worth testing if the soak uses them. This reads the soak's own source, the way
   tests/clock.js lints the rules for bare time literals. Nothing else here would catch the day the
   soak went back to one guard. */
test('the soak gates each claim with its own guard and not with DEFAULT_DAYS', () => {
  const src = fs.readFileSync(path.join(__dirname, 'soak.js'), 'utf8');
  const code = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.match(code, /require\('\.\/lib\/claims'\)/, 'tests/soak.js no longer loads the claim guards');
  assert.match(code, /skip: seasonClaimSkip\(DAYS\)/, 'the season claim is not gated by seasonClaimSkip');
  assert.match(code, /skip: oldAgeClaimSkip\(DAYS\)/, 'the old-age claim is not gated by oldAgeClaimSkip');
  assert.doesNotMatch(code, /DAYS\s*>=\s*DEFAULT_DAYS/, 'a claim is gated on the soak default again, which is true whenever DAYS is defaulted');
});
