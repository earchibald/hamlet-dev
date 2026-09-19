// The clock table: the unit helpers, and a lint that finds bare time literals in the rules.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load, FILES } = require('../src/sim');

test('clock.js loads directly after core.js', () => {
  assert.equal(FILES[0], 'core'); assert.equal(FILES[1], 'clock');
});

test('the unit helpers turn world units into ticks', () => {
  const api = load();
  assert.equal(api.DAY, 1000);
  assert.equal(api.days(16), 16 * api.DAY);
  assert.equal(api.hours(24), api.DAY);
  assert.equal(api.hours(7), api.DAY * 7 / 24);
  assert.equal(api.mins(1440), api.DAY);
  assert.equal(api.secs(86400), api.DAY);
  assert.equal(api.years(1), api.SEASON_DAYS * 4 * api.DAY);
});

test('the legacy markers return their argument unchanged', () => {
  const api = load();
  for (const f of [api.ticks, api.strides, api.tickRate, api.strideRate]){ assert.equal(f(0.0006), 0.0006); assert.equal(f(3000), 3000); }
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
  assert.equal(api.CLOCK.rate.pitBurn, 0.25);
  assert.equal(api.CLOCK.limit.ember, 420);
});

test('the camp rules and the cellular systems read the table', () => {
  const C = load().CLOCK;
  assert.equal(C.every.spoil, 100); assert.equal(C.every.fae, 300); assert.equal(C.every.prune, 200); assert.equal(C.every.carcassRot, 50);
  assert.deepEqual(C.birth, { every: 400, chance: 0.35, gap: 16000 });
  assert.deepEqual(C.arrival, { first: 700, firstSpread: 600, firstByHand: 700, secondHearth: 900, wait: 900, spread: 900, chance: 0.7, villageChance: 0.85, afterTheLast: 10000, afterTheDoomed: 10000, foundRetry: 500 });
  assert.deepEqual(C.storm, { first: 1500, firstSpread: 2000, length: 150, lengthSpread: 300, gap: 2000, summerGap: 4000, gapSpread: 3000 });
  assert.equal(C.food.cookedKeeps, 1800); assert.equal(C.food.berriesKeep, 3500);
  assert.equal(C.rate.lightningLit, 0.0006); assert.equal(C.rate.lightningOut, 0.0035); assert.equal(C.rate.strayLightning, 0.0008);
  assert.equal(C.plant.samples, 60); assert.equal(C.plant.bushOld, 60000);
});

test('needs, cooldowns, and the base tasks read the table', () => {
  const C = load().CLOCK;
  assert.deepEqual(C.cold, { under: 0.012, winterNight: 0.06, winterDay: 0.025, summer: 0, night: 0.012, day: 0.003 });
  assert.equal(C.rate.fireWarms, 0.5); assert.equal(C.rate.freezeHurts, 0.03); assert.equal(C.rate.starveHurts, 0.04);
  assert.equal(C.rate.heals, 0.01); assert.equal(C.rate.fireHurts, 2.5); assert.equal(C.rate.oldAgeDeath, 0.0006);
  assert.equal(C.rate.sitRests, 0.05); assert.equal(C.rate.sitWarms, 0.4);
  assert.equal(C.cooldown.offerFailed, 60); assert.equal(C.cooldown.pathBlocked, 40); assert.equal(C.cooldown.taskFailed, 120); assert.equal(C.cooldown.needFailed, 120); assert.equal(C.cooldown.disturb, 1000);
  assert.equal(C.limit.task, 1500); assert.equal(C.limit.hurtRemembered, 600);
  assert.equal(C.task.sit, 90); assert.equal(C.task.sitChat, 25); assert.equal(C.task.standStill, 20);
  assert.equal(C.thought.grief, 3000); assert.equal(C.thought.ateCooked, 700);
});

test('the animals, the sprites, and the gnomes read the table', () => {
  const api = load(), C = api.CLOCK;
  assert.deepEqual(C.spawn.rabbitLitter, { every: 250, chance: 0.8 });
  assert.equal(C.spawn.rabbitStray.every, 300);
  assert.deepEqual(C.spawn.fawn, { every: 2000, at: 1000 });
  assert.deepEqual(C.spawn.wolf, { every: 10000, at: 2500 });
  assert.equal(C.spawn.fox.every, 6000);
  assert.deepEqual(C.den, { birthEvery: 500, birthGap: 20000, digAfter: 3000, digRetry: 500, biteGap: 150, campDark: 1000 });
  assert.equal(C.gnome.every, 500); assert.equal(C.gnome.copyChance, 0.3); assert.equal(C.gnome.repayGap, 6000); assert.equal(C.gnome.leaveAfter, 3000);
  assert.equal(C.chase.wolf, 140); assert.equal(C.chase.wolfPerSkill, 30); assert.equal(C.chase.stalk, 160);
  assert.equal(C.sprite.dance, 240); assert.equal(C.sprite.prankGap, 300);
  assert.equal(api.SPECIES.human.decay.food, 0.035); assert.equal(api.SPECIES.sprite.stride, 1);
});

test('human work reads the table', () => {
  const api = load(), C = api.CLOCK;
  assert.equal(C.work.firepit, 70); assert.equal(C.work.knapAxe, 70); assert.equal(C.work.leanTo, 110); assert.equal(C.work.storehouse, 140); assert.equal(C.work.hut, 120);
  assert.equal(C.work.feedFire, 6); assert.equal(C.work.checkSnare, 4); assert.equal(C.work.fish, 110); assert.equal(C.work.cutTree, 60);
  assert.equal(C.chase.deer, 220); assert.equal(C.chase.deerPerSkill, 40); assert.equal(C.chase.deerMissed, 40); assert.equal(C.chase.guard, 200);
  assert.equal(C.limit.guardEmber, 500); assert.equal(C.limit.hearthProven, 3000);
  assert.equal(C.cooldown.sparks, 150); assert.equal(C.cooldown.wolfBurned, 2500); assert.equal(C.cooldown.wolfDriven, 3000);
  assert.equal(api.RECIPES.find(r => r.id === 'workshop').work, 140);
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
  { name: 'a stride',             re: /\bstride:\s*\d+/g },
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
