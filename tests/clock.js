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
  { name: 'a roll',               re: /rng\(\)\s*[<>]=?\s*[^;)&|]+/g, rolls: true },
];
/* Rolls are linted only in the files that hold rules. World generation rolls once and is not time.
   In world.js the rules begin at growPlants. */
const ROLL_FILES = ['camps', 'beings', 'species', 'fae', 'tasks', 'goals', 'recipes', 'weather', 'main', 'world'];
/* A chance rolled once per event is not a rate. Each entry is the exact text of a match, with the reason. */
const EVENT_CHANCES = [
];
/* The ratchet. A file listed here may still hold this many bare literals. A file not listed holds none.
   Each task of the plan removes its files. The close removes the ratchet. */
const PENDING = {
  world: 21, camps: 19, beings: 56, species: 72, fae: 39, tasks: 43, goals: 41, recipes: 11, weather: 5, gods: 2, settle: 1, main: 5,
};

/* A comparison with zero is not a duration, and a digit inside a name is not a number. */
const hasNumber = s => /\d/.test(s.replace(/[!=]==\s*0\b/g, '').replace(/\b[A-Za-z_]\w*/g, ''));
function bareIn(file){
  let src = fs.readFileSync(path.join(SIM, file + '.js'), 'utf8');
  const out = [];
  for (const r of RULES){
    if (r.files && !r.files.includes(file)) continue;
    if (r.rolls && !ROLL_FILES.includes(file)) continue;
    const text = r.rolls && file === 'world' ? src.slice(src.indexOf('function growPlants')) : src;
    r.re.lastIndex = 0; let m;
    while ((m = r.re.exec(text))){
      const s = m[0];
      if (!hasNumber(s)) continue;
      if (EVENT_CHANCES.includes(s.trim())) continue;
      out.push(`${file}.js: ${r.name}: ${s.trim().slice(0, 120)}`);
    }
  }
  return out;
}

test('no rule holds a bare time literal', () => {
  const over = [];
  for (const f of FILES){
    if (f === 'clock') continue;
    const bare = bareIn(f), allowed = PENDING[f] || 0;
    if (bare.length > allowed) over.push(`${f}.js holds ${bare.length} bare literals, and ${allowed} are allowed:\n  ` + bare.join('\n  '));
    if (PENDING[f] !== undefined && bare.length < allowed) over.push(`${f}.js holds ${bare.length} bare literals. Lower its PENDING count from ${allowed}.`);
  }
  assert.equal(over.length, 0, over.join('\n'));
});
