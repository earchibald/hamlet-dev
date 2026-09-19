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
    lightningLit: tickRate(0.0006), lightningOut: tickRate(0.0035),   // near a camp in a storm, hearth lit or out
    strayLightning: tickRate(0.0008),
  },
  limit: {
    ember: ticks(420),        // how long a carried ember lives
    poked: ticks(400),        // how long a poked being stays startled
  },
  /* How often a rule looks. A rule runs when tick % every is 0, or is the `At` entry beside it. */
  every: {
    spoil: ticks(100),          // the stash is checked for spoiled food
    fae: ticks(300),            // a camp's favour with the sprites does its work
    prune: ticks(200),          // the dead leave the list of beings
    carcassRot: ticks(50),      // old carcasses are checked
    godsRest: days(1),          // the sleeping gods are kept rested
    resourceCount: ticks(100),  // a sector's resource count is cached this long
  },
  cooldown: {
    rotLine: ticks(600),        // between two chronicle lines about spoiled food
  },
  food: {
    cookedKeeps: ticks(1800), berriesKeep: ticks(3500),
    carcassKeeps: ticks(900), venisonKeeps: ticks(1500), fishKeeps: ticks(600),
  },
  birth: { every: ticks(400), chance: 0.35, gap: days(16) },
  arrival: {
    first: ticks(700), firstSpread: ticks(600),   // after lightning lights the first hearth
    firstByHand: ticks(700),                      // after a person lights it
    secondHearth: ticks(900),                     // after carried coals light a new camp's pit
    wait: ticks(900), spread: ticks(900),         // between two chances of a newcomer
    chance: 0.7, villageChance: 0.85,
  },
  party: { coalsLast: ticks(6000), foodKeeps: ticks(3000), campAge: days(8) },
  storm: {
    first: ticks(1500), firstSpread: ticks(2000),
    length: ticks(150), lengthSpread: ticks(300),
    gap: ticks(2000), summerGap: ticks(4000), gapSpread: ticks(3000),
  },
  fire: {
    burn: tickRate(1),           // fuel a burning tile loses
    stormQuench: tickRate(2),    // more, in rain
    spread: tickRate(0.08), stormSpread: tickRate(0.012),   // the chance to catch, times how well the tile burns
    strikeFuel: 240,            // a lightning strike smoulders at least this long at `burn`
  },
  plant: {
    samples: 60,                // random tiles looked at each tick. Each chance below is for one look.
    bushOld: days(60), bushDies: 0.01,
    bushYoung: days(3), bushTired: days(48),
    berryGrow: { spring: 0.15, summer: 0.25, autumn: 0.35, winter: 0 }, berryWither: 0.15,
    bushSeedsFrom: days(5), bushSeeds: 0.012,
    saplingGrown: days(12), shroomGrow: 0.3,
    pineOld: days(100), pineFalls: 0.03, stickDrops: 0.02,
    ashHeals: 0.05, saplingSprouts: 0.004,
  },
  thought: {
    journey: ticks(2000), parting: ticks(1200), joined: ticks(1500), newcomer: ticks(800),
    fireout: ticks(800), village: ticks(3000),
    birthParent: ticks(3000), birthCamp: ticks(1500),
    hearth: ticks(1000), poked: ticks(400),
    over: 4,   // a god's thought. Nothing counts it down: the tick does not step a god.
  },
};
