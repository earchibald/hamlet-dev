// The clock table: the unit helpers, and a lint that finds bare time literals in the rules.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load, FILES } = require('../src/sim');

test('clock.js loads directly after core.js', () => {
  assert.equal(FILES[0], 'core'); assert.equal(FILES[1], 'clock');
});

/* A tick is one world second, so DAY is pinned as a bare number and everything else in this file is
   measured against it. That is deliberate. Most of the assertions below read the same helpers the
   table reads, so they would hold at any DAY whatever; this one line is what stops the file agreeing
   with itself about a wrong day. If it goes, the file verifies the table against its own definition
   and catches nothing. */
test('a tick is one world second and the day is 86,400 of them', () => {
  const api = load();
  assert.equal(api.DAY, 86400);
  assert.equal(api.secs(1), 1);
  assert.equal(api.mins(1), 60);
  assert.equal(api.hours(1), 3600);
  assert.equal(api.days(1), 86400);
});

test('the unit helpers turn world units into ticks', () => {
  const api = load();
  assert.equal(api.days(16), 16 * api.DAY);
  assert.equal(api.hours(24), api.DAY);
  assert.equal(api.hours(7), api.DAY * 7 / 24);
  assert.equal(api.mins(1440), api.DAY);
  assert.equal(api.secs(86400), api.DAY);
  assert.equal(api.years(1), 365 * api.DAY);
  assert.equal(api.YEAR_DAYS, 365);
});

/* The calendar against plain numbers, not against itself. A line like
   `years(1) === YEAR_DAYS * DAY` is an identity between two constants: it passes whatever the year
   length is, so it cannot report a calendar that changed (issue #94, the shape of #80). The literals
   below are the calendar the rules and the tests are tuned for: a 365-day year, four seasons of
   91, 91, 91 and 92 days, and winter carrying the odd one. Change the calendar and this goes red,
   which is the point: a year the soak cannot cross leaves every `seasonOf()` and `isWinter()` read
   site dead, with no failing test.

   The soak's run length is not restated here. `tests/soak.js` owns `DEFAULT_DAYS`, and its 'the run
   visits every season' test observes the crossing directly, on the real run, rather than computing it
   from a copy of the number. `tests/lib/claims.js` pins `SEASON_CLAIM_DAYS` to the 365 asserted here.
   Bless a new number here only with that claim still green. */
test('a year is 365 days and winter carries the odd one, in plain numbers', () => {
  const api = load();
  assert.equal(api.YEAR_DAYS, 365);
  assert.equal(api.years(1), 31536000);
  assert.equal(api.years(1) / api.DAY, 365);
  assert.deepEqual(api.SEASON_LENGTHS, [91, 91, 91, 92]);
  assert.equal(api.SEASON_LENGTHS.reduce((a, b) => a + b, 0), api.YEAR_DAYS);
});

/* dev's 'the legacy markers return their argument unchanged' test does not come across this merge.
   On this branch the four markers are converters, not identities, and the test below,
   'every marker converts the old clock, and none is an identity', is its replacement. Carrying both
   would assert `ticks(1) === 1` and `ticks(1) === 86` in one file. */

test('the calendar names the season, the day of the year, and the year', () => {
  const api = load();
  assert.equal(api.seasonOf(1), 'spring');
  assert.equal(api.seasonOf(91), 'spring');
  assert.equal(api.seasonOf(92), 'summer');
  assert.equal(api.seasonOf(183), 'autumn');
  assert.equal(api.seasonOf(274), 'winter');
  assert.equal(api.seasonOf(365), 'winter');
  assert.ok(api.isWinter(274));
  assert.ok(!api.isWinter(92));
  /* The year turns over and the seasons start again, which is the whole point of a 365-day year. */
  assert.equal(api.seasonOf(366), 'spring');
  assert.equal(api.dayOfYear(366), 1);
  assert.equal(api.yearOf(366), 2);
  assert.equal(api.yearOf(365), 1);
  assert.equal(api.dayOfYear(365), 365);
  /* Winter's extra day is real: day 365 is winter and day 366 is not. */
  assert.equal(api.seasonOf(273), 'autumn');
});

test('night runs from 20:00 to 06:00', () => {
  const api = load();
  api.startWorld('clocktest');
  /* The only way to ask the hour is to be at it, so the world is stepped to each one. `hourOf` reads
     the live tick and there is no seam that sets it, which is right: a test seam on the tick would
     be a way to move the world without the door. */
  const at = h => { while (api.hourOf() < h) api.step(); return api.isNight(); };
  assert.ok(!at(12)); assert.ok(!at(19)); assert.ok(at(20)); assert.ok(at(23));
});

/* `ticks` is a converter now, not an identity: one tick of the old 1000-tick day is 86.4 world
   seconds. Every value still written `ticks(n)` below is asserted THROUGH it, which says the true
   thing about that value — that it keeps the world meaning it had and nobody has yet decided what
   it should be. Pinning the converter here once is what keeps those assertions honest; without this
   test they would hold whatever `ticks` did. */
test('every marker converts the old clock, and none is an identity', () => {
  const api = load();
  /* A tick of the old 1000-tick day is 86.4 world seconds and a stride was two of those, but both
     round: a duration is a whole number of world seconds. The rounding shows only on values that do
     not land on one, which is why the whole-number test above exists rather than this one. */
  assert.equal(api.ticks(1), 86);
  assert.equal(api.ticks(5), 432);
  assert.equal(api.ticks(1000), api.days(1));
  assert.equal(api.ticks(500), api.hours(12));
  assert.equal(api.strides(1), 173);
  assert.equal(api.strides(6), 1037);
  assert.equal(api.strides(500), api.days(1));
  /* The rates divide, because a rate a tick spread over 86.4 times as many ticks must be that much
     smaller to mean the same thing. Left as identities they would fire 86 times as often and no
     test would go red, because a rate is a number and a number survives any rebasing. */
  assert.equal(api.tickRate(86.4), 1);
  assert.equal(api.strideRate(172.8), 1);
  assert.ok(Math.abs(api.tickRate(0.0006) * api.days(1) - 0.6) < 1e-9, 'a chance a tick no longer means what it meant a day');
  /* `lookRate` is the one identity, and it is named here so that the title above stays true. A
     chance for one look is not a chance a tick: the rule draws a number of looks, and that count
     already carries the world time. Converting such a chance divides it a second time. Adding a
     marker that does nothing is otherwise the mistake this test exists to catch, so the exception
     is written down rather than left to the absence of an assertion. */
  assert.equal(api.lookRate(0.35), 0.35);
  /* `stock` is the second identity, and for a different reason: an amount HELD keeps its units when
     the rate that spends it converts. Both are named here so the title above stays true. */
  assert.equal(api.stock(240), 240);
});

/* A stock divided by its rate is a world time, and that time must not move. `strikeFuel` was
   `ticks(240)` and `burn` is `tickRate(1)`: converting BOTH multiplied a lightning fire's life by
   86.4, from dev's 0.24 world days to 20.7. Every table value was a legal number and the whole-number
   rule passed, because 20,736 is a whole number of ticks. The fault was that a stock is not a
   duration, and no rule about durations can see it. This is the third fault of that shape in task 1
   and the second that only a measurement caught. */
test('a lightning fire burns for about a quarter of a world day, as it did before the retune', () => {
  const api = load();
  const days = api.CLOCK.fire.strikeFuel / api.CLOCK.fire.burn / api.DAY;
  assert.ok(Math.abs(days - 0.24) < 0.01, `a strike burns ${days.toFixed(2)} world days; dev burns 0.24`);
});

/* A duration is a whole number of world seconds, because rules compare durations with `%` and a
   fractional period never divides a whole tick count. `strides(6)` was 1036.8 and
   `++progress % 1036.8` is never zero, so berry picking stopped finishing and the picker picked for
   the whole day. Nothing went red: the rule did not fail, it stopped happening. This is the test
   that catches the next one. A rate is exempt, since it is a fraction by its nature and is never
   counted in ticks. */
test('every duration in the table is a whole number of ticks', () => {
  const C = load().CLOCK;
  const RATE_KEYS = new Set(['rate', 'cold', 'fire', 'chance', 'villageChance', 'copyChance', 'birthChance', 'mossChance', 'berryGrow', 'bushDies', 'berryWither', 'bushSeeds', 'shroomGrow', 'pineFalls', 'stickDrops', 'ashHeals', 'saplingSprouts', 'samples', 'burn', 'stormQuench', 'spread', 'stormSpread', 'over', 'slower']);
  const bad = [];
  const walk = (o, path) => {
    for (const k in o){
      if (RATE_KEYS.has(k)) continue;
      const v = o[k];
      if (v && typeof v === 'object') walk(v, path + k + '.');
      else if (typeof v === 'number' && !Number.isInteger(v) && Math.abs(v) >= 1) bad.push(`${path}${k} = ${v}`);
    }
  };
  walk(C, 'CLOCK.');
  assert.deepEqual(bad, [], 'a duration that is not a whole number of ticks never divides a tick count, so a rule that compares it with % silently stops firing');
});

test('perHour spreads an hourly rate over the ticks of an hour', () => {
  const api = load();
  assert.ok(Math.abs(api.perHour(1) * api.hours(1) - 1) < 1e-12);
});

test('rollFor gives the rate itself over one tick, and compounds over many', () => {
  const api = load();
  assert.equal(api.rollFor(0.0006, 1), 0.0006);
  assert.ok(Math.abs(api.rollFor(0.5, 2) - 0.75) < 1e-12);
  assert.equal(api.rollFor(0, 1000), 0);
  assert.equal(api.rollFor(1, 5), 1);
});

test('the hearth and the ember read the table', () => {
  const api = load();
  assert.equal(api.CLOCK.rate.pitBurn, api.tickRate(0.25));
  assert.equal(api.CLOCK.limit.ember, api.ticks(420));
});

test('the camp rules and the cellular systems read the table', () => {
  const C = load().CLOCK;
  const T = load().ticks;
  assert.equal(C.every.spoil, T(100)); assert.equal(C.every.fae, T(300)); assert.equal(C.every.prune, T(200)); assert.equal(C.every.carcassRot, T(50));
  assert.deepEqual(C.birth, { every: T(400), chance: 0.35, gap: load().days(16) });
  /* The two waits of `theLoneFounder` are deliberately different and must stay different: a stable
     failure waits the whole stretch, a passing one waits half a day. This pins which value each is,
     not merely that each is some value. */
  assert.deepEqual(C.arrival, { first: T(700), firstSpread: T(600), firstByHand: T(700), secondHearth: T(900), wait: T(900), spread: T(900), chance: 0.7, villageChance: 0.85, afterTheLast: load().days(10), afterTheDoomed: load().days(10), foundRetry: load().hours(12) });
  assert.notEqual(C.arrival.foundRetry, C.arrival.afterTheLast, 'the two founding waits collapsed into one');
  assert.deepEqual(C.storm, { first: T(1500), firstSpread: T(2000), length: T(150), lengthSpread: T(300), gap: T(2000), summerGap: T(4000), gapSpread: T(3000) });
  assert.equal(C.food.cookedKeeps, T(1800)); assert.equal(C.food.berriesKeep, T(3500));
  const R = load().tickRate;
  assert.equal(C.rate.lightningLit, R(0.0006)); assert.equal(C.rate.lightningOut, R(0.009)); assert.equal(C.rate.strayLightning, R(0.0008));
  assert.equal(C.plant.samples, R(60)); assert.equal(C.plant.bushOld, load().days(60));
});

test('needs, cooldowns, and the base tasks read the table', () => {
  const C = load().CLOCK;
  const R = load().tickRate, S = load().strideRate;
  assert.deepEqual(C.cold, { under: R(0.012), winterNight: R(0.06), winterDay: R(0.025), summer: 0, night: R(0.012), day: R(0.003) });
  assert.equal(C.rate.fireWarms, R(0.5)); assert.equal(C.rate.freezeHurts, R(0.03)); assert.equal(C.rate.starveHurts, R(0.04));
  assert.equal(C.rate.heals, R(0.01)); assert.equal(C.rate.fireHurts, R(2.5)); assert.equal(C.rate.oldAgeDeath, R(0.0006));
  assert.equal(C.rate.sitRests, S(0.05)); assert.equal(C.rate.sitWarms, S(0.4));
  const T = load().ticks;
  assert.equal(C.cooldown.offerFailed, T(60)); assert.equal(C.cooldown.pathBlocked, T(40)); assert.equal(C.cooldown.taskFailed, T(120)); assert.equal(C.cooldown.needFailed, T(120)); assert.equal(C.cooldown.disturb, T(1000));
  assert.equal(C.limit.task, T(1500)); assert.equal(C.limit.hurtRemembered, T(600));
  const St = load().strides;
  assert.equal(C.task.sit, St(90)); assert.equal(C.task.sitChat, St(25)); assert.equal(C.task.standStill, St(20));
  assert.equal(C.thought.grief, T(3000)); assert.equal(C.thought.ateCooked, T(700));
});

test('the animals, the sprites, and the gnomes read the table', () => {
  const api = load(), C = api.CLOCK;
  const T = api.ticks, D = api.days;
  assert.deepEqual(C.spawn.rabbitLitter, { every: T(250), chance: 0.8 });
  assert.equal(C.spawn.rabbitStray.every, T(300));
  assert.deepEqual(C.spawn.fawn, { every: T(2000), at: T(1000) });
  assert.deepEqual(C.spawn.wolf, { every: T(10000), at: T(2500) });
  assert.equal(C.spawn.fox.every, T(6000));
  /* `digRetry` keeps its marker on purpose. It reaches hours(12) by conversion alone, and converting
     it would remove the flag that says task 6 still owes it a reading. Its spelling is the point. */
  assert.deepEqual(C.den, { birthEvery: T(500), birthGap: D(20), digAfter: D(3), digRetry: T(500), biteGap: T(150), campDark: D(1) });
  assert.equal(C.gnome.every, T(500)); assert.equal(C.gnome.copyChance, 0.3); assert.equal(C.gnome.repayGap, D(6)); assert.equal(C.gnome.leaveAfter, D(3));
  const St = api.strides;
  assert.equal(C.chase.wolf, St(140)); assert.equal(C.chase.wolfPerSkill, St(30)); assert.equal(C.chase.stalk, St(160));   // task 7 rules on the chases
  assert.equal(C.sprite.dance, St(240)); assert.equal(C.sprite.prankGap, T(300));
  assert.equal(api.SPECIES.human.decay.food, api.tickRate(0.035));
  /* `stride` is a speed in tiles a tick now, not a count of ticks between acts. Everyone walks one. */
  assert.equal(api.SPECIES.sprite.stride, 1); assert.equal(api.SPECIES.human.stride, 1);
});

test('human work reads the table', () => {
  const api = load(), C = api.CLOCK;
  const St = api.strides;
  assert.equal(C.work.firepit, St(70)); assert.equal(C.work.knapAxe, St(70)); assert.equal(C.work.leanTo, St(110)); assert.equal(C.work.storehouse, St(140)); assert.equal(C.work.hut, St(120));
  assert.equal(C.work.feedFire, St(6)); assert.equal(C.work.checkSnare, St(4)); assert.equal(C.work.fish, St(110)); assert.equal(C.work.cutTree, St(60));
  assert.equal(C.chase.deer, St(220)); assert.equal(C.chase.deerPerSkill, St(40)); assert.equal(C.chase.deerMissed, St(40)); assert.equal(C.chase.guard, St(200));
  assert.equal(C.limit.guardEmber, api.ticks(500)); assert.equal(C.limit.hearthProven, api.days(3));
  assert.equal(C.cooldown.sparks, api.ticks(150)); assert.equal(C.cooldown.wolfBurned, api.ticks(2500)); assert.equal(C.cooldown.wolfDriven, api.ticks(3000));
  assert.equal(api.RECIPES.find(r => r.id === 'workshop').work, St(140));
});

/* ---------- the lint: no bare time literal in a rule ---------- */
const SIM = path.join(__dirname, '..', 'src', 'sim');
/* Each rule finds a place where time is used. A match is bare when it still holds a number. */
const RULES = [
  { name: 'added to tick',        re: /tick\s*\+\s*[^;,}]*/g },
  { name: 'a tick difference',    re: /tick\s*-\s*[\w.()\[\]| ]+?\s*(>=|<=|>|<)\s*[^;)&|?]+/g },
  { name: 'a period',             re: /tick\s*%\s*[^;)&|?]+/g },
  { name: 'a stamp plus a wait',  re: /\|\|\s*0\)\s*\+\s*[\w.]+\s*>\s*tick/g },
  { name: 'a thought duration',   re: /addThought\([^;]*?,\s*\d+\)/g },
  { name: 'a multiple of DAY',    re: /[\d.]+\s*\*\s*DAY|DAY\s*\*\s*[\d.]+|\/\s*DAY\s*(>=|<=|>|<)\s*[\d.]+/g },
  { name: 'an age in days',       re: /\bage\s*(>=|<=|>|<)\s*\d+/g, files: ['world'] },
  { name: 'a progress threshold', re: /progress\s*(%|<=|>=|<|>|===)\s*[^;)&|?]+/g },
  { name: 'a wait',               re: /\bwait:\s*\d+/g },
  { name: 'work in startBuild',   re: /startBuild\(a,\s*(\[[^\]]*\]|[^,]+),\s*[\d.]+/g },
  { name: 'work in a recipe',     re: /\bwork:\s*\d+/g },
  /* `stride` was a count of ticks between acts; G4 made it a speed in tiles a tick, so it is no
     longer a duration and the lint no longer reads it as one. */
  { name: 'a decay',              re: /\b(food|water|rest|social|warmth|glow|play):\s*[\d.]+/g, files: ['species'] },
  { name: 'a small step',         re: /(-=|\+=)\s*\d*\.\d+/g },
  { name: 'a need gained',        re: /needs\.\w+\s*[+-]\s*0\.\d+/g },
  /* Stops at a `/` too: a chance already named from CLOCK can be divided by an unrelated formula
     (the old-age roll divides by hardiness), and that denominator is not a bare time literal. */
  { name: 'a roll',               re: /rng\(\)\s*[<>]=?\s*[^;)&|/]+/g, rolls: true },
  { name: 'a legacy marker outside a table', re: /\b(ticks|strides|tickRate|strideRate)\(/g, notFiles: ['species', 'recipes', 'gods'], always: true },
  { name: 'a world unit outside the table',  re: /\b(days|hours|mins|secs|years)\(\s*[\d.]+[^)]*\)/g },
];
/* Rolls are linted only in the files that hold rules. World generation rolls once and is not time.
   In world.js the rules begin at growPlants. */
const ROLL_FILES = ['camps', 'beings', 'species', 'fae', 'tasks', 'goals', 'recipes', 'weather', 'main', 'world'];
/* A chance rolled once per event is not a rate. Each entry names the file and the exact text of a
   match, so a new roll elsewhere with the same text is not waved through by accident. */
const EVENT_CHANCES = [
  { file: 'beings', text: 'rng() < 0.125', why: "rolled once, when an animal steps on the trap" },
  { file: 'species', text: 'rng() > 0.45 + a.skills.hunt * 0.1', why: "the deer that breaks free of a wolf" },
  { file: 'species', text: 'rng() < 0.6', why: "the carcass roll (whether a venison carcass is finished)" },
  { file: 'fae', text: 'rng() < 0.6', why: "the prank's victim roll" },
  { file: 'fae', text: 'rng() < 0.45 + a.skills.hunt * 0.1', why: "the spear's hit on a sprite" },
  { file: 'fae', text: 'rng() < 0.5', why: "one gift roll of a sprite's visit, and two of the prank's rolls" },
  { file: 'fae', text: "rng() < 0.5 ? 'cord' : 'moss'", why: "the other gift roll of a sprite's visit, picking cord over moss" },
  { file: 'tasks', text: 'rng() < Math.min(0.75, 0.22 + a.skills.hunt * 0.06 + a.traits.patience * 0.18', why: "the fish that bites at the end of a cast" },
  { file: 'tasks', text: 'rng() < 0.3 + a.skills.hunt * 0.12', why: "the spear's hit on a deer" },
  { file: 'goals', text: 'rng() < 0.2 + a.skills.craft * 0.1 + a.traits.patience * 0.25', why: "the sparks that take" },
  { file: 'goals', text: 'rng() < 0.4 + a.traits.patience * 0.4', why: "the rocks that prove to be firestones" },
];
/* A comparison with zero is not a duration, a digit inside a name is not a number, and a `|| 0)`
   fallback default is not a duration either. */
const hasNumber = s => /\d/.test(s.replace(/[!=]==\s*0\b/g, '').replace(/\|\|\s*0\)/g, ')').replace(/\b[A-Za-z_]\w*/g, ''));
function bareIn(file){
  let src = fs.readFileSync(path.join(SIM, file + '.js'), 'utf8');
  const out = [];
  for (const r of RULES){
    if (r.files && !r.files.includes(file)) continue;
    if (r.notFiles && r.notFiles.includes(file)) continue;
    if (r.rolls && !ROLL_FILES.includes(file)) continue;
    const text = r.rolls && file === 'world' ? src.slice(src.indexOf('function growPlants')) : src;
    for (const m of text.matchAll(r.re)){
      const s = m[0];
      if (!r.always && !hasNumber(s)) continue;
      if (r.rolls && EVENT_CHANCES.some(e => e.file === file && e.text === s.trim())) continue;
      out.push(`${file}.js: ${r.name}: ${s.trim().slice(0, 120)}`);
    }
  }
  return out;
}

test('no rule holds a bare time literal', () => {
  const bare = FILES.filter(f => f !== 'clock').flatMap(bareIn);
  assert.equal(bare.length, 0, bare.join('\n'));
});

test('every entry of the table is a finite number', () => {
  const C = load().CLOCK;
  const walk = (o, at) => { for (const k in o){ const v = o[k], p = at + '.' + k; if (v && typeof v === 'object') walk(v, p); else assert.ok(Number.isFinite(v), `${p} is ${v}`); } };
  walk(C, 'CLOCK');
});

test('every entry of the table is read by a rule', () => {
  const C = load().CLOCK, src = FILES.filter(f => f !== 'clock').map(f => fs.readFileSync(path.join(SIM, f + '.js'), 'utf8')).join('\n') + fs.readFileSync(path.join(SIM, '..', 'ui', 'derive.js'), 'utf8');
  const unread = [];
  const reads = p => new RegExp(p.replace(/\./g, '\\.') + '\\b').test(src);
  const walk = (o, at) => { for (const k in o){ const v = o[k], p = at + '.' + k; if (v && typeof v === 'object') walk(v, p); else if (!reads(p) && !src.includes(at + '[')) unread.push(p); } };
  walk(C, 'CLOCK');
  assert.deepEqual(unread, []);
});

/* An entry is dead when no roll in its own file has its text, or when the roll holds no number and
   the lint never asks. */
test('every event chance names a roll the lint would flag, in the file it names', () => {
  const found = new Set();
  for (const f of ROLL_FILES){
    const src = fs.readFileSync(path.join(SIM, f + '.js'), 'utf8');
    const r = RULES.find(r => r.rolls);
    const text = f === 'world' ? src.slice(src.indexOf('function growPlants')) : src;
    for (const m of text.matchAll(r.re)) if (hasNumber(m[0])) found.add(f + '\0' + m[0].trim());
  }
  const dead = EVENT_CHANCES.filter(e => !found.has(e.file + '\0' + e.text));
  assert.deepEqual(dead, []);
});

/* G4 task 1, the second regression of its kind, and the reason this gate is behavioural rather than
   a lint. `CLOCK.plant.samples` is looks a tick. The rebasing made it 0.694, a `for` bound truncated
   it to one, and every per-look chance beside it had been divided by 86.4 as though it were a chance
   a tick. Neither half was visible: the table's values all checked out, the soak stayed green, and
   the valley quietly stopped growing. Measured against this same call over a tenth of a world day:
   24 berries on dev, 0 before the fix, 23 after. A lint on the table would have passed on both sides
   of the fault, because the fault was in how the numbers were used and not in what they were. So the
   gate runs the rule and asks whether it still happens. */
test('growPlants still grows: a tenth of a world day makes berries', () => {
  const api = load();
  api.startWorld('r', {});
  const berries = () => api.world.reduce((s, t) => s + (t.berries || 0), 0);
  const before = berries();
  /* The rule is called on its own, with the tick driven by hand, so that the count is the growth
     the rule makes and not growth net of what the people of the valley eat. The tick must move
     because the look count is a closed form of it. */
  const from = api.tick;
  for (let i = 0; i < api.DAY / 10; i++){ api.tick = from + i; api.growPlants(); }
  const gained = berries() - before;
  assert.ok(gained >= 10, `a tenth of a world day grew ${gained} berries, and dev grows about 24`);
});

/* The look count is the other half, and it is checked on its own so that a failure says which half
   broke. Sixty looks an old tick of 86.4 world seconds is 60,000 looks a world day, whatever a tick
   is now worth. A chance for one look rides on this count and must never be converted again. */
test('the plant block looks at sixty thousand tiles a world day, and its chances are per look', () => {
  const api = load();
  assert.ok(Math.abs(api.CLOCK.plant.samples * api.DAY - 60000) / 60000 < 0.02,
    `the plant block looks at ${Math.round(api.CLOCK.plant.samples * api.DAY)} tiles a world day, not 60,000`);
  const src = fs.readFileSync(path.join(SIM, 'clock.js'), 'utf8');
  const block = src.slice(src.indexOf('plant: {'), src.indexOf('hollowAge'));
  const converted = [...block.matchAll(/(\w+):\s*tickRate\(/g)].map(m => m[1]).filter(k => k !== 'samples');
  assert.deepEqual(converted, [],
    `these are chances for one look and must be marked lookRate, not tickRate: ${converted.join(', ')}`);
});
