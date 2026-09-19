/* ---------- the clock: the calendar, the units, and every duration and rate ---------- */
/* A tick is one world second. DAY is the number of ticks in a world day, so it is the number of
   seconds in a day. How fast the page draws those ticks is the interface's business and is not in
   here: speed is view state and never passes the door, so the same seed reaches the same world
   whether it is watched at one tick a second or run flat out with nobody looking. */
const DAY = 86400;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
/* A year is 365 days. Winter carries the odd day, so the four lengths sum to the year exactly and
   no season has to be derived by subtraction. */
const SEASON_LENGTHS = [91, 91, 91, 92], YEAR_DAYS = 365;

/* World units into ticks. */
const secs = n => n * DAY / 86400;
const mins = n => n * DAY / 1440;
const hours = n => n * DAY / 24;
const days = n => n * DAY;
const years = n => n * YEAR_DAYS * DAY;
/* A rate for each world hour, as a rate for each tick. It serves an amount and a small chance alike:
   the linear form is exact for an amount, and only an approximation for a chance, since a chance
   does not compound linearly over many ticks. Built for the retune. No rule reads it yet. */
const perHour = p => p / hours(1);
/* The chance that a roll made once a tick at `rate` comes up at least once in `n` ticks. Over one
   tick it returns the rate itself, because `1 - (1 - rate)` is not exactly `rate` in floating point,
   and a roll must not move. */
const rollFor = (rate, n) => n === 1 ? rate : 1 - Math.pow(1 - rate, n);
/* Legacy markers. A value inside one is still in the units of the old clock: a count of the old
   1000-tick day, a count of a being's strides, a rate for each of those ticks, a rate for each
   stride. The retune replaces every one with a world unit. When none is left, the retune is done.

   All four are converters now, and none is an identity. The old day held 1000 ticks and the new one
   holds 86,400, so one old tick is 86.4 world seconds. A stride was two of those ticks for every
   being that works, so it is 172.8. Converting is not a reading and does not settle anything: it
   keeps each value's meaning in the world exactly where it was, so that the retune's later tasks
   read a value that still means what it always meant rather than one that became 86 times shorter
   the day the day got longer.

   The two duration markers round, and that is not tidiness. A tick is one world second and a
   duration counted in ticks must be a whole number of them, because rules compare durations with
   `%`. `strides(6)` is 1036.8 exactly, and `++progress % 1036.8` is never zero for a whole
   `progress`, so a rule written that way stops firing altogether and does not fail: the berry is
   never picked and the picker picks for ever. That is what happened here, and nothing went red.
   Every duration this table holds is therefore a whole number of ticks, and `tests/clock.js`
   asserts it, so the next non-integer duration is caught by a test and not by a stuck villager.

   The rates convert the other way, by division, for the same reason. A chance of 0.0006 a tick used
   to come up about once in 1,700 ticks, which was under two world days; left alone it would come up
   about once every half hour. Lightning would strike a camp eighty-six times as often and nothing
   would be red, because a rate is a number and every number is still a number after a rebasing.

   A marker is a to-do item and not a spelling. It says nobody has decided what this means in real
   time. Only the task that owns a group converts that group's markers, having read each value. Do
   not convert one because it happens to equal a round world unit: the arithmetic is free and the
   reading is not, and a value that arrives at its task already looking settled is not asked the
   question the task owes it. A marker may be removed, never added. */
const ticks = n => Math.round(n * 86.4), strides = n => Math.round(n * 172.8), tickRate = p => p / 86.4, strideRate = p => p / 172.8;
/* `lookRate` is a legacy marker that does not convert, and it is deliberate. A chance for one look
   is not a chance a tick: the rule draws a number of looks, that count carries the world time, and
   the chance rides on top of it unchanged. Converting one of these as a chance a tick divides it by
   86.4 a second time, on top of the look count that was already divided. That is what happened to
   the plant block in G4 task 1 and it stopped plant growth in the valley. The marker still says
   nobody has decided what the value should be; it says only that the rebasing must not touch it. */
const lookRate = p => p;

/* The calendar. `dayOfYear` counts from 1. `seasonOf` walks the four lengths rather than dividing,
   because the seasons are not all the same length.
   Each takes a day and falls back to today's. That is not only for the tests: a rule or a panel that
   asks what season some other day falls in should not have to move the world to find out, and a
   function that answers from its argument can be checked without a world at all. */
const dayOfYear = (d = dayOf()) => ((d - 1) % YEAR_DAYS) + 1;
const yearOf = (d = dayOf()) => Math.floor((d - 1) / YEAR_DAYS) + 1;
const seasonOf = (d = dayOf()) => { let n = dayOfYear(d); for (let i = 0; i < 4; i++){ if (n <= SEASON_LENGTHS[i]) return SEASONS[i]; n -= SEASON_LENGTHS[i]; } return SEASONS[3]; };
const isWinter = (d = dayOf()) => seasonOf(d) === 'winter';
const hourOf = () => ((tick % DAY) / DAY) * 24;
const dayOf = () => Math.floor(tick / DAY) + 1;
const isNight = () => { const h = hourOf(); return h >= 20 || h < 6; };

/* Every duration and every rate that is not a row of a species, a life, or a recipe. Rules read
   this table by name. No rule holds a bare tick count. */
const CLOCK = {
  rate: {
    pitBurn: tickRate(0.25),   // fuel the lit pit burns (a burning tile's rate is `fire.burn`)
    lightningLit: tickRate(0.0006), lightningOut: tickRate(0.0035),   // near a camp in a storm, hearth lit or out
    strayLightning: tickRate(0.0008),
    fireWarms: tickRate(0.5),          // warmth gained within 3 tiles of a lit pit
    freezeHurts: tickRate(0.03), starveHurts: tickRate(0.04), heals: tickRate(0.01), fireHurts: tickRate(2.5),
    oldAgeDeath: tickRate(0.0006),     // past the usual span, divided by hardiness
    sitRests: strideRate(0.05), sitWarms: strideRate(0.4),
    danceGlows: strideRate(0.6), danceRests: strideRate(0.3), dancePlays: strideRate(0.5), visitPlays: strideRate(0.4),
  },
  limit: {
    ember: ticks(420),        // how long a carried ember lives
    poked: ticks(400),        // how long a poked being stays startled
    task: ticks(1500),                // a task older than this is dropped
    hurtRemembered: ticks(600),       // a wound names the cause of death this long
    swarm: ticks(4000), swarmReturn: ticks(1500), blight: ticks(5000),
    gnomeHolds: days(2),              // a borrowed thing comes back after this
    guardEmber: ticks(500),           // how long the brand lasts while driving off a wolf
    hearthProven: days(3),            // an unbroken hearth streak this long counts as established
    resourceCache: ticks(100),        // a sector's resource count is cached this long
  },
  /* One tick in this many is a step, for a person feeling their way in the dark. It is a rate and
     not a duration, which is why it is a small whole number and not a world unit. */
  dark: { slower: 2 },
  startsAt: hours(7),   // the hour of the first day at which a world begins
  names: {
    nameHour: Math.round(hours(20)),   // the hour of night the nightly naming pass runs
    eventMemory: days(16),             // an event line older than this is no longer a candidate
    epithetAfter: days(10),            // how long in a camp before the first epithet can be earned
  },
  /* Warmth a person loses each tick, by where and when. */
  cold: { under: tickRate(0.012), winterNight: tickRate(0.06), winterDay: tickRate(0.025), summer: tickRate(0), night: tickRate(0.012), day: tickRate(0.003) },
  /* How long the base tasks take, in strides. */
  task: {
    nibble: strides(15), talk: strides(10), shelterWait: strides(60),
    sit: strides(90), sitChat: strides(25), sitTeach: strides(30), sitTeachAt: strides(15),
    standStill: strides(20), doze: strides(60),
    eatCarcass: strides(25), eatShrooms: strides(8), denRest: strides(60), kinChat: strides(20),
  },
  /* How much work a job takes. A worker adds workSpeed to the job's progress each stride, and
     workSpeed is 1 for a person with no skill, so an entry is the strides the job takes them. The
     four entries that end in `Every` are periods inside a gathering task: one thing is gathered
     each time that many strides pass. */
  work: {
    firepit: strides(70), feedFire: strides(6), strikeSparks: strides(40), mossLight: strides(10), layFire: strides(15),
    butcherDeer: strides(60), cookFish: strides(25), cookCatch: strides(35),
    setSnare: strides(30), checkSnare: strides(4), rearmSnare: strides(10), haulDeer: strides(12),
    knapAxe: strides(70), testRocks: strides(50), spear: strides(50), waterskin: strides(60),
    leanTo: strides(110), storehouse: strides(140), hut: strides(120),
    offeringStone: strides(30), leaveBerries: strides(8), wardPosts: strides(60),
    rack: strides(50), smokeMeat: strides(45), smokeFish: strides(40),
    fish: strides(110), quarry: strides(25), breakRockfall: strides(60), cutTree: strides(60), fillWaterskin: strides(12),
    berryEvery: strides(6), fibreEvery: strides(8), clayEvery: strides(10), cuttingsEvery: strides(6),
  },
  /* How often a rule looks. A rule runs when tick % every is 0, or is the `At` entry beside it. */
  every: {
    spoil: ticks(100),          // the stash is checked for spoiled food
    fae: ticks(300),            // a camp's favour with the sprites does its work
    prune: ticks(200),          // the dead leave the list of beings
    carcassRot: ticks(50),      // old carcasses are checked
    godsRest: days(1),          // the sleeping gods are kept rested
  },
  cooldown: {
    rotLine: ticks(600),        // between two chronicle lines about spoiled food
    offerFailed: ticks(60), pathBlocked: ticks(40), taskFailed: ticks(120), needFailed: ticks(120),
    disturb: ticks(1000),             // between two counts of one person in a gnome burrow
    raid: ticks(1200), stalk: ticks(2000), wolfLine: ticks(300),
    /* Between two maulings of the same person. `stalk` above sits on the wolf, and the valley holds
       more than one wolf, so it is no floor for the victim at all: four wolves mauled one founder in
       three ticks. This one sits on the person. It is sized off `rate.heals`, which gives a person
       0.006 to 0.014 hit points a tick by hardiness. In 4000 ticks that is 24 to 56, against a maul
       of 20 to 34. A person of middling hardiness wins back 40, more than the worst maul. */
    stalked: ticks(4000),
    sparks: ticks(150),               // between two tries at striking sparks into the tinder
    guardLine: ticks(800),            // between two chronicle lines about the same wolf chase
    wolfBurned: ticks(2500), wolfWanders: ticks(600),   // a wolf driven off with fire keeps away, then wanders again
    wolfDriven: ticks(3000),          // a den cleared with fire stays clear this long
  },
  food: {
    cookedKeeps: ticks(1800), berriesKeep: ticks(3500),
    carcassKeeps: ticks(900), venisonKeeps: ticks(1500), fishKeeps: ticks(600),
  },
  birth: { every: ticks(400), chance: 0.35, gap: days(16) },
  /* Wildlife comes in on a period. `at` is the tick of the period on which the rule runs. */
  spawn: {
    rabbitLitter: { every: ticks(250), chance: 0.8 },
    rabbitStray: { every: ticks(300) },
    fawn: { every: ticks(2000), at: ticks(1000) },
    wolf: { every: ticks(10000), at: ticks(2500) },
    fox: { every: ticks(6000) },
  },
  den: {
    birthEvery: ticks(500), birthGap: days(20),
    digAfter: days(3), digRetry: ticks(500),   // a driven-out owner digs a new den
    biteGap: ticks(150),                       // one bite for the whole den
    campDark: days(1),                         // a hearth out this long lets the owners come back
  },
  gnome: { every: ticks(500), copyChance: 0.3, repayGap: days(6), leaveAfter: days(3) },
  grove: { every: ticks(500), birthGap: days(6), oldPine: days(40), birthChance: 0.5 },
  sprite: {
    dance: strides(240), danceSeen: strides(40), mossEvery: strides(200), mossChance: 0.35,
    visit: strides(160), visitGift: strides(120),
    prankGap: ticks(300), returnAfter: ticks(800), returnSpread: ticks(600),
  },
  chase: {
    wolf: strides(140), wolfPerSkill: strides(30), stalk: strides(160),
    spearSprite: strides(90),
    deer: strides(220), deerPerSkill: strides(40), deerMissed: strides(40), guard: strides(200),
  },
  arrival: {
    first: ticks(700), firstSpread: ticks(600),   // after lightning lights the first hearth
    firstByHand: ticks(700),                      // after a person lights it
    secondHearth: ticks(900),                     // after carried coals light a new camp's pit
    wait: ticks(900), spread: ticks(900),         // between two chances of a newcomer
    chance: 0.7, villageChance: 0.85,
    afterTheLast: days(10),                       // with no person alive in the valley, the wait before a lone wanderer crosses the hills
    afterTheDoomed: days(10),                     // with one person alive, how long their hearth must be cold before the line counts as ended
    /* After a founding fails for want of ground, before the valley is looked over again. The same case
       as CLOCK.den.digRetry, and today the same value: a try that found nothing waits a little rather
       than asking the world again every tick.
       Do not rewrite `digRetry` as hours(12) to match this. `ticks()` marks a duration whose meaning
       in real time nobody has decided yet. It is a to-do item, and the retune is finished when none is
       left. The retune's own task settles the den group, having read each value, and the question it
       owes this one is whether half a world day is the right wait for a driven-out wolf. That the two
       agree in value today is arithmetic, not a reason to make them agree in spelling: a value that
       arrives at that task already looking settled does not get asked the question.
       Only the task that owns a group converts that group's markers. A new value is never written with
       one, so hours(12) beside a marked neighbour is the state the table is meant to be in. */
    foundRetry: hours(12),
  },
  party: { coalsLast: ticks(6000), foodKeeps: ticks(3000), campAge: days(8) },   // foodKeeps: what the stash keeps is under `food`
  storm: {
    first: ticks(1500), firstSpread: ticks(2000),
    length: ticks(150), lengthSpread: ticks(300),
    gap: ticks(2000), summerGap: ticks(4000), gapSpread: ticks(3000),
  },
  fire: {
    burn: tickRate(1),           // fuel a burning tile loses (the pit's rate is `rate.pitBurn`)
    stormQuench: tickRate(2),    // more, in rain
    spread: tickRate(0.08), stormSpread: tickRate(0.012),   // the chance to catch, times how well the tile burns
    strikeFuel: ticks(240),      // a lightning strike smoulders at least this long at `burn`
  },
  plant: {
    samples: tickRate(60),       /* Looks a tick, and after the rebasing a fraction: sixty looks an
                                    old tick is 0.694 looks a world second, so 60,000 looks a world
                                    day either way. `growPlants` draws a whole number from it.
                                    Every chance below is a chance for ONE LOOK, so each is marked
                                    `lookRate` and none of them converts. */
    bushOld: days(60), bushDies: lookRate(0.01),
    bushYoung: days(3), bushTired: days(48),
    berryGrow: { spring: lookRate(0.15), summer: lookRate(0.25), autumn: lookRate(0.35), winter: lookRate(0) }, berryWither: lookRate(0.15),
    bushSeedsFrom: days(5), bushSeeds: lookRate(0.012),
    saplingGrown: days(12), shroomGrow: lookRate(0.3),
    pineOld: days(100), pineFalls: lookRate(0.03), stickDrops: lookRate(0.02),
    ashHeals: lookRate(0.05), saplingSprouts: lookRate(0.004),
    hollowAge: days(300),        // age given to a grove's hollow when the world is made
    grovePineAge: days(60),      // age given to a grove pine when the world is made
    grovePineSpread: days(60),   // spread added to a grove pine's age when the world is made
    treeAgeSpread: days(100),    // age given to a tree when the world is made
    bushAgeSpread: days(60),     // age given to a bush when the world is made
  },
  thought: {
    journey: ticks(2000), parting: ticks(1200), joined: ticks(1500), newcomer: ticks(800),
    fireout: ticks(800), village: ticks(3000),
    birthParent: ticks(3000), birthCamp: ticks(1500),
    hearth: ticks(1000), poked: ticks(400),
    over: 4,   // a god's thought. Nothing counts it down: the tick does not step a god.
    grief: ticks(3000), loss: ticks(1500), kin: ticks(4000), herdloss: ticks(1200), chat: ticks(500),
    drank: ticks(300), farwater: ticks(600),
    ateCooked: ticks(700), ateSmoked: ticks(600), ateBerries: ticks(400),
    taught: ticks(600), raid: ticks(1500),
    cold: ticks(50), wet: ticks(300), dry: ticks(300), gnome: ticks(900), burrow: ticks(800),
    intruderGnome: ticks(2000), starving: ticks(50), burned: ticks(800), warm: ticks(200),
    slept: ticks(600), dark: ticks(400), emberlost: ticks(500), sawfire: ticks(400), sawwolf: ticks(600),
    chased: ticks(800), escaped: ticks(900), fed: ticks(600), wolf: ticks(1200), mauled: ticks(2000),
    borrowed: ticks(1500), repaid: ticks(1500), gnomegift: ticks(1200), denbite: ticks(1500), defend: ticks(600),
    struck: ticks(2000), bitten: ticks(900), dodged: ticks(1500), killedfae: ticks(2000),
    spriteGrove: ticks(900), spriteCamp: ticks(700), giftTaken: ticks(1500),
    faefire: ticks(1000), pinched: ticks(900), stolen: ticks(800), prank: ticks(1500),
    mosslight: ticks(400), intruderSprite: ticks(1500), inhollow: ticks(600),
    ember: ticks(500), rekindled: ticks(1200), find: ticks(2500), bones: ticks(1200),
    fish: ticks(500), nofish: ticks(300), quarryfae: ticks(900),
    missed: ticks(500), kill: ticks(1500), brave: ticks(1200), guarded: ticks(800),
    burnedWolf: ticks(1500),   // a wolf driven off with fire
    searched: ticks(2000), driven: ticks(3000), cleared: ticks(2500), grovecut: ticks(800),
    axeMade: ticks(1500), axeCut: ticks(3000),
    pit: ticks(800), sparks: ticks(300), dud: ticks(400), roof: ticks(1200), giftLeft: ticks(400),
    clothes: ticks(1500), garden: ticks(1500),
    wouldnothold: 4,   // a god's thought. Nothing counts it down: the tick does not step a god.
  },
};
