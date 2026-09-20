// The day-count guards for the two soak claims that a short run cannot make.
//
// One guard used to gate both claims: `DAYS >= DEFAULT_DAYS` in tests/soak.js. It was wrong in two
// directions at once (issue #113). It skipped a run of 40 days, which visits all four seasons and
// could make the season claim. It also never skips the default run, no matter the default. So a
// branch that lowers `DEFAULT_DAYS` turns both claims red instead of skipping them.
//
// The two claims do not need the same run. So there are two literals, each gating its own claim.
// Neither reads `DEFAULT_DAYS`. A guard written in terms of the default answers a question about
// the default, not about the run.

/* One year. A run shorter than a year cannot visit every season. A run of a year can.
   This literal is a calendar fact, and the calendar holds it. tests/clock.js asserts, in plain
   numbers, that a season is 8 days and a year is 32. Change the calendar and that test goes red. It
   names the number, and that is the signal to change this one. tests/soak-guards.js also asserts
   this literal against `years(1)`, so the pair cannot drift apart in silence.

   A whole year is more than some runs need. Every run begins on day 1 of spring today, so winter
   arrives on day 25 and a 25-day run sees all four seasons. The guard does not lean on that. Suppose
   a world-gen change moved the start tick into the middle of a season. A run would then need the
   full year, and a guard tuned to the old start would skip a run that should have failed. */
const SEASON_CLAIM_DAYS = 32;

/* About seventy days. This literal is NOT a calendar fact, and nothing can pin it exactly.
   It is a measured floor. At 70 days the six default seeds gave 12, 6, 5, 15, 6 and 8 old-age
   deaths, so the claim holds several times over on every seed.

   The life table gives a lower bound on it, not the number. A newcomer arrives aged between
   `LIFE.human.adult` and `LIFE.human.old`. Old age kills past `LIFE.human.life`. So the oldest
   arrival needs `LIFE.human.life - LIFE.human.old` days to cross the span: 24 days today.
   Twenty-four is the arithmetic minimum, not a run length that works. The death is a roll at
   `CLOCK.rate.oldAgeDeath` divided by `0.5 + hardiness` (src/sim/beings.js:371). An eligible being is not yet a
   dead one, because the roll needs ticks to fire. A literal of 24 would make the claim intermittent.
   An intermittent soak failure reads as a fault in the sim.

   So tests/soak-guards.js asserts only that this literal is not below that derived floor. A life
   table change that lifts the floor past 70 fails loudly there, instead of widening in silence. */
const OLD_AGE_CLAIM_DAYS = 70;

/* Each guard returns `false` to make the claim, or a reason string to skip it. That is what
   node:test's `skip` option takes. */
function seasonClaimSkip(days){
  return days >= SEASON_CLAIM_DAYS ? false
    : `${days} days: the season claim is made on runs of ${SEASON_CLAIM_DAYS} days or more, a year being ${SEASON_CLAIM_DAYS} days by the calendar tests/clock.js pins`;
}

function oldAgeClaimSkip(days){
  return days >= OLD_AGE_CLAIM_DAYS ? false
    : `${days} days: the old-age claim is made on runs of ${OLD_AGE_CLAIM_DAYS} days or more, which is where the claim was measured, not where the life table alone allows it`;
}

/* The floor the life table gives: the days the oldest newcomer needs to pass the span. A lower bound
   on OLD_AGE_CLAIM_DAYS, never a replacement for it. */
function oldAgeFloor(LIFE){
  return LIFE.human.life - LIFE.human.old;
}

module.exports = { SEASON_CLAIM_DAYS, OLD_AGE_CLAIM_DAYS, seasonClaimSkip, oldAgeClaimSkip, oldAgeFloor };
