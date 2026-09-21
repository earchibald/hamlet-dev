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
   numbers, that a year is 365 days and the seasons are 91, 91, 91 and 92 days long. Change the
   calendar and that test goes red. It names the number, and that is the signal to change this one.
   tests/soak-guards.js also asserts this literal against `years(1)`, so the pair cannot drift apart
   in silence.

   A whole year is more than some runs need. Every run begins on day 1 of spring today, so winter
   arrives on day 274 and a 274-day run sees all four seasons. The guard does not lean on that.
   Suppose a world-gen change moved the start tick into the middle of a season. A run would then need
   the full year, and a guard tuned to the old start would skip a run that should have failed. */
const SEASON_CLAIM_DAYS = 365;

/* About seventy days. This literal is NOT a calendar fact, and nothing can pin it exactly.

   ON THIS BRANCH IT IS A LOWER BOUND AND NOT A MEASURED FLOOR. Read it as a placeholder with an
   arithmetic bound under it. The measurement is owed by G4 task 6, "Lives, ages, births, and plants",
   which is the task that rules on `LIFE`. The file that arrived from dev said task 4 owed it. Task 4
   has landed, and it measured seconds a world day and not old-age deaths, so the debt moved rather
   than being paid. One run does make the
   claim meanwhile: `LONG=1` sets DAYS to 70, and 70 >= 70, so the claim is made on a run whose
   length nobody has re-measured at this clock. The default soak, at three days, skips it.

   Where the 70 came from, and why it is not a measurement here. On dev, at dev's 1000-tick day, the
   six default seeds gave 12, 6, 5, 15, 6 and 8 old-age deaths over 70 days. The retune did not touch
   either half of that mechanism: `LIFE` is still written in days (src/sim/species.js:2,
   `human: { adult: 16, old: 60, life: 84 }`) and the old-age roll still fires once a world day at
   the same chance a day (src/sim/beings.js:507, gated on `(s + 1) % DAY === 0` with
   `rollFor(..., DAY)`). So the number has a reason to transfer. Nobody has re-taken it, because a
   70-day run now costs about 67 minutes of wall time and G4 defers every run of that length to task
   4. A reason to transfer is not a measurement.

   The arithmetic bound, which is all this branch can prove. A newcomer arrives aged between
   `LIFE.human.adult` and `LIFE.human.old`. Old age kills past `LIFE.human.life`. So the oldest
   arrival needs `LIFE.human.life - LIFE.human.old` days to cross the span: 84 - 60 = 24 days on this
   branch. Twenty-four is the arithmetic minimum, not a run length that works. The death is a roll at
   `CLOCK.rate.oldAgeDeath` divided by `0.5 + hardiness`. An eligible being is not yet a dead one,
   because the roll needs days to fire. A literal of 24 would make the claim intermittent, and an
   intermittent soak failure reads as a fault in the sim.

   The literal is not lowered to fit a run this branch can afford. Deriving a guard from the run,
   with one layer of indirection, is the defect issue #113 exists to prevent.

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
    : `${days} days: the old-age claim is made on runs of ${OLD_AGE_CLAIM_DAYS} days or more, which is a lower bound carried over from dev and not a floor measured at this clock (G4 task 6, lives and ages, owes the measurement)`;
}

/* The floor the life table gives: the days the oldest newcomer needs to pass the span. A lower bound
   on OLD_AGE_CLAIM_DAYS, never a replacement for it. */
function oldAgeFloor(LIFE){
  return LIFE.human.life - LIFE.human.old;
}

module.exports = { SEASON_CLAIM_DAYS, OLD_AGE_CLAIM_DAYS, seasonClaimSkip, oldAgeClaimSkip, oldAgeFloor };
