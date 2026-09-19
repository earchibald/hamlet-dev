/* ---------- the clock: the calendar, the units, and every duration and rate ---------- */
/* A tick is the smallest step of the world. DAY is the number of ticks in a world day. TPS is the
   number of ticks the page runs in a real second at speed 1. */
const DAY = 1000, TPS = 12;
const SEASON_DAYS = 8, SEASONS = ['spring', 'summer', 'autumn', 'winter'];

/* World units into ticks. */
const secs = n => n * DAY / 86400;
const mins = n => n * DAY / 1440;
const hours = n => n * DAY / 24;
const days = n => n * DAY;
const years = n => n * SEASON_DAYS * 4 * DAY;
/* A rate for each world hour, as a rate for each tick. It serves an amount and a small chance alike. */
const perHour = p => p / hours(1);
/* The chance that a roll made once a tick at `rate` comes up at least once in `n` ticks. */
const rollFor = (rate, n) => n === 1 ? rate : 1 - Math.pow(1 - rate, n);
/* Legacy markers. Each returns its argument. A value inside one is still in the units of the old
   clock: a count of ticks, a count of a being's strides, a rate for each tick, a rate for each
   stride. The retune replaces every one with a world unit. When none is left, the retune is done. */
const ticks = n => n, strides = n => n, tickRate = p => p, strideRate = p => p;

/* The calendar. */
const seasonOf = () => SEASONS[Math.floor((dayOf() - 1) / SEASON_DAYS) % 4];
const isWinter = () => seasonOf() === 'winter';
const hourOf = () => ((tick % DAY) / DAY) * 24;
const dayOf = () => Math.floor(tick / DAY) + 1;
const isNight = () => { const h = hourOf(); return h >= 20 || h < 6; };

/* Every duration and every rate that is not a row of a species, a life, or a recipe. Rules read
   this table by name. No rule holds a bare tick count. */
const CLOCK = {
  rate: {
    pitBurn: tickRate(0.25),   // fuel the lit pit burns
  },
  limit: {
    ember: ticks(420),        // how long a carried ember lives
  },
};
