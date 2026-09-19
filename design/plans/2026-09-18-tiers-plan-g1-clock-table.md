# G1, The Clock Table: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every duration and every rate in the simulation into one table, `CLOCK`, at today's values, so that no rule holds a bare tick count and the soak fingerprint does not move.

**Architecture:** A new file, `src/sim/clock.js`, loads directly after `core.js`. It holds the calendar, the unit helpers, and the `CLOCK` table. Rules read `CLOCK` by name. A lint in `tests/clock.js` scans `src/sim/` for bare time literals and ratchets file by file to zero.

**Tech stack:** Plain JavaScript scripts in one scope (no modules), Node's built-in test runner, no dependencies.

| Task | Converts | Files |
|---|---|---|
| 1 | The clock file, the helpers, the calendar, the lint | `clock.js`, `core.js`, `index.js`, `tests/clock.js`, `package.json`, two lines of `src/ui/` |
| 2 | Camp rules and cellular systems | `camps.js`, `weather.js`, `main.js`, `world.js`, `gods.js` |
| 3 | Needs, thoughts, cooldowns, and the base tasks | `beings.js` |
| 4 | The animals, the sprites, and the gnomes | `species.js`, `fae.js` |
| 5 | Human work | `tasks.js`, `goals.js`, `recipes.js`, `settle.js` |
| 6 | The close: the ratchet at zero, the documents, the budget | `tests/clock.js`, `design/`, `CLAUDE.md` |

## Global Constraints

- Work in `/Users/earchibald/Worktrees/hamlet-tiers` on branch `tiers`. Never check out, stash, or commit in `~/Code/hamlet`.
- **The golden must not move.** After every task, `node tests/soak.js` passes against the committed `tests/soak-golden.json`. Never run `UPDATE_GOLDEN=1`. Never edit the golden. If the fingerprint moves, the conversion changed a value or the order of random draws. Find the site and fix it.
- Do not lower a soak floor. Do not skip or park a test.
- **Values do not change.** Every literal moves to `CLOCK` with the same number. No rounding, no merging of two values that differ, no "tidier" numbers.
- **The order of `rng()` calls does not change.** Do not hoist a roll, reorder the operands of `&&` or `||` around a roll, or turn a roll that short-circuits into one that always runs.
- **Arithmetic keeps its shape.** `16 * DAY` becomes `days(16)`, which computes the same product. `rng() < 0.0006 / (0.5 + h)` becomes `rng() < CLOCK.rate.oldAgeDeath / (0.5 + h)`. Do not rearrange a formula.
- Files in `src/sim/` are not ES modules. They share one scope. Do not add `import` or `export`.
- `src/sim/index.js` holds a line `return new Function(source() + '\n' + API)();`. An edit hook may warn about it. Do not change that line. Edit the `FILES` array and the `API` string only.
- Run `node build.js` after every change to `src/`, and commit `dist/hearth-sim.html` with the change.
- Game text and comments use plain English, one idea per sentence. Documents follow the same style, with a summary table at the top.
- If the lint flags a match that holds no time literal, the lint is at fault. Narrow that rule's regular expression in `tests/clock.js` and say so in your report. Do not reshape code to get past the lint.
- `SPECIES.god` holds a flag named `perTick`. It says whether the tick steps the species. It is not a rate. Leave it.
- The names are fixed: `CLOCK`, `DAY`, `SEASON_DAYS`, `TPS`, `ticks`, `strides`, `tickRate`, `strideRate`, `secs`, `mins`, `hours`, `days`, `years`, `perHour`, `rollFor`. `steps` is already a function in `world.js`; do not reuse that name.
- Commit messages end with these two lines:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WREt1LNngD7W6xW2uYrYn
```

## What counts as time

Every task applies these rules. Read them before you convert a file.

| Kind | How to know it | Where it goes | Helper |
|---|---|---|---|
| A duration in ticks | Added to `tick`, compared with a difference of ticks, a period in `tick % N`, a thought's last argument, an `until` or `dies` stamp | `CLOCK` | `ticks(n)` |
| A duration in whole days | A literal multiplied by `DAY`, or an age in days compared with a literal | `CLOCK`, as ticks | `days(n)` |
| A duration in strides | A task's `progress` threshold or period, a `wait`, the `work` argument of `startBuild`. A being runs its task once a stride, so these count strides, not ticks. | `CLOCK` | `strides(n)` |
| A rate per tick | An amount added or removed every tick (fuel burn, cold, hunger), or a chance rolled every tick | `CLOCK.rate` | `tickRate(p)` |
| A rate per stride | An amount gained on every stride of a task (rest by the fire) | `CLOCK.rate` | `strideRate(p)` |
| A chance that repeats with time | A roll made on every period, every timer, or every N strides (the birth roll each 400 ticks) | `CLOCK`, beside its period | bare number |
| A per-species or per-recipe value | `decay`, `stride`, a recipe's `work` | It stays in its own table, wrapped in the helper | `tickRate`, `ticks`, `strides` |
| A chance rolled once per event | A snare's catch, a spear's hit, sparks that take or do not at a task's end, every roll of world generation | It stays where it is. List it in `EVENT_CHANCES` in `tests/clock.js` if the lint flags it. | none |
| Not time | Distances, scores, amounts of food or mood or damage in one blow, search caps, fuel amounts, multipliers without a unit | It stays where it is | none |

`ticks`, `strides`, `tickRate`, and `strideRate` return their argument unchanged. They mark a value that is still in today's units. Plan G4 replaces each one with a world unit. When no call to the four is left, the retune is complete.

`LIFE` in `species.js` is already in days. It stays as it is.

**Naming a thought's duration.** The entry is `CLOCK.thought.<key>`, where `<key>` is the thought's key string at the site. For `'grief' + a.id` the entry is `grief`. Sites with the same key and the same duration share one entry. When one key has two durations, use these names:

| Key | Entries |
|---|---|
| `ate` | `ateCooked` 700, `ateSmoked` 600, `ateBerries` 400 (the stash and the bush share it) |
| `sprite` | `spriteGrove` 900, `spriteCamp` 700 |
| `burned` | `burned` 800 (a person in fire), `burnedWolf` 1500 (a wolf driven off with fire) |
| `birth` | `birthParent` 3000, `birthCamp` 1500 |
| `intruder` | `intruderGnome` 2000, `intruderSprite` 1500 |
| `gift` | `giftTaken` 1500 (the sprite), `giftLeft` 400 (the person) |
| `axe` | `axeMade` 1500, `axeCut` 3000 |

If you find a collision that this table does not list, name the entries by what differs and say so in your report.

---

### Task 1: The clock file, the helpers, and the lint

**Files:**
- Create: `src/sim/clock.js`
- Create: `tests/clock.js`
- Modify: `src/sim/core.js` (line 13, line 96, lines 119 and 131 to 135)
- Modify: `src/sim/index.js` (`FILES`, `API`)
- Modify: `src/sim/tasks.js`, `src/sim/camps.js` (the readers of `EMBER_LIFE` and `PIT_BURN`)
- Modify: `src/ui/derive.js:86`, `src/ui/actions.js:119`
- Modify: `package.json` (the `fast` script)

**Interfaces:**
- Produces: the globals `DAY`, `SEASON_DAYS`, `SEASONS`, `TPS`, `ticks`, `strides`, `tickRate`, `strideRate`, `secs`, `mins`, `hours`, `days`, `years`, `perHour`, `rollFor`, `CLOCK`, and the calendar functions `seasonOf`, `isWinter`, `hourOf`, `dayOf`, `isNight` (moved, unchanged). `CLOCK.rate.pitBurn` and `CLOCK.limit.ember` replace `PIT_BURN` and `EMBER_LIFE`. `tests/clock.js` exports nothing; it holds the `PENDING` ratchet that tasks 2 to 5 edit.

- [ ] **Step 1: Write the failing helper tests**

Create `tests/clock.js`:

```js
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
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/clock.js`
Expected: FAIL. The first test reports `'field' !== 'clock'`, and the others report that `api.days` is not a function.

- [ ] **Step 3: Create `src/sim/clock.js`**

```js
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
```

- [ ] **Step 4: Remove the moved names from `core.js`**

In `src/sim/core.js`:

- Line 13 becomes `const LW = 28, LH = 20;`.
- On the line that begins `const PIT_MAX = 400`, remove `PIT_BURN = 0.25` and `EMBER_LIFE = 420`. It becomes `const PIT_MAX = 400, STICK_FUEL = 50, LOG_FUEL = 140;`.
- Delete the line `const SEASON_DAYS = 8, SEASONS = [...]`.
- Delete the five calendar lines `const seasonOf`, `const isWinter`, `const hourOf`, `const dayOf`, `const isNight`. Leave `stamp()` and `log()` where they are.
- In the header comment, change "the shared state, time, and the chronicle" to "the shared state and the chronicle. The calendar and every duration are in clock.js".

- [ ] **Step 5: Point the readers at the table**

Run: `grep -n "PIT_BURN\|EMBER_LIFE" -r src`

Replace every `PIT_BURN` with `CLOCK.rate.pitBurn` and every `EMBER_LIFE` with `CLOCK.limit.ember`. The sites today are `src/sim/camps.js` (the pit's burn), `src/sim/tasks.js` (three `dies: tick + EMBER_LIFE`), and `src/ui/derive.js:86`.

In `src/ui/actions.js:119`, change `Math.round(DAY / 24)` to `Math.round(hours(1))`.

In `src/sim/main.js`, change `tick = Math.round(DAY * 7 / 24)` to `tick = Math.round(hours(7))`.

- [ ] **Step 6: Add the file to the manifest**

In `src/sim/index.js`:

- `FILES` becomes `['core', 'clock', 'field', ...]` with the rest unchanged.
- In the header comment, after "core.js declares the constants and state the others read at load time", add the sentence "clock.js comes next, because the tables of the later files are written in its units."
- In the `API` string, add to the first line of names: `CLOCK, DAY, SEASON_DAYS, TPS, ticks, strides, tickRate, strideRate, secs, mins, hours, days, years, perHour, rollFor,`. Check first that `API` does not already list `DAY` or `SEASON_DAYS`; if it does, do not list the name twice.

- [ ] **Step 7: Run the helper tests and see them pass**

Run: `node --test tests/clock.js`
Expected: 6 tests pass.

- [ ] **Step 8: Add the lint to `tests/clock.js`**

Append:

```js
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
```

`hasNumber` removes identifiers first, so `near40` and `idx3` do not count as numbers. It also removes a comparison with zero, so `progress === 0` and `tick % CLOCK.every.spoil === 0` do not count.

- [ ] **Step 9: Fill the ratchet**

Run: `node --test tests/clock.js`
Expected: the lint test fails and prints a count for each file.

Write each file's count into `PENDING`, for example `camps: 19, beings: 61`. Do not list a file whose count is zero. Run the test again.
Expected: 7 tests pass.

Read the printed matches for `world.js`, `settle.js`, and `gods.js` once. If a match there is a roll of world generation that the `ROLL_FILES` rule let through, that is a fault in the lint, not a literal to move: report it and stop.

- [ ] **Step 10: Add the test to `npm run fast`**

In `package.json`, add `tests/clock.js` to the end of the `fast` script.

- [ ] **Step 11: Build, and run every gate**

```bash
node build.js
npm run fast
node tests/soak.js
```

Expected: `fast` passes with 7 more tests than before. The soak passes 66 of 66 with the golden unmoved.

- [ ] **Step 12: Commit**

```bash
git add src/sim/clock.js src/sim/core.js src/sim/index.js src/sim/camps.js src/sim/tasks.js src/sim/main.js src/ui/derive.js src/ui/actions.js tests/clock.js package.json dist/hearth-sim.html
git commit -m "The clock file: the calendar, the unit helpers, the CLOCK table, and a lint that ratchets bare time literals to zero"
```

---

### Task 2: Camp rules and cellular systems

**Files:**
- Modify: `src/sim/clock.js`, `src/sim/camps.js`, `src/sim/weather.js`, `src/sim/main.js`, `src/sim/world.js`, `src/sim/gods.js`
- Modify: `tests/clock.js` (`PENDING`, and one new test)

**Interfaces:**
- Consumes: `CLOCK`, `ticks`, `days`, `tickRate` from task 1.
- Produces: the `CLOCK` groups `every`, `cooldown`, `food`, `birth`, `arrival`, `storm`, `fire`, `plant`, and new entries in `rate` and `thought`.

- [ ] **Step 1: Write the failing test**

Add to `tests/clock.js`, before the lint section:

```js
test('the camp rules and the cellular systems read the table', () => {
  const C = load().CLOCK;
  assert.equal(C.every.spoil, 100); assert.equal(C.every.fae, 300); assert.equal(C.every.prune, 200); assert.equal(C.every.carcassRot, 50);
  assert.deepEqual(C.birth, { every: 400, chance: 0.35, gap: 16000 });
  assert.deepEqual(C.arrival, { first: 700, firstSpread: 600, firstByHand: 700, secondHearth: 900, wait: 900, spread: 900, chance: 0.7, villageChance: 0.85 });
  assert.deepEqual(C.storm, { first: 1500, firstSpread: 2000, length: 150, lengthSpread: 300, gap: 2000, summerGap: 4000, gapSpread: 3000 });
  assert.equal(C.food.cookedKeeps, 1800); assert.equal(C.food.berriesKeep, 3500);
  assert.equal(C.rate.lightningLit, 0.0006); assert.equal(C.rate.lightningOut, 0.0035); assert.equal(C.rate.strayLightning, 0.0008);
  assert.equal(C.plant.samples, 60); assert.equal(C.plant.bushOld, 60000);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/clock.js`
Expected: FAIL with "Cannot read properties of undefined (reading 'spoil')".

- [ ] **Step 3: Add the entries to `CLOCK`**

Add these groups to `CLOCK` in `src/sim/clock.js`. Keep `rate.pitBurn` and `limit.ember`.

```js
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
```

Add to `rate`:

```js
    lightningLit: tickRate(0.0006), lightningOut: tickRate(0.0035),   // near a camp in a storm, hearth lit or out
    strayLightning: tickRate(0.0008),
```

Add a `thought` group with the entries for the thoughts in these files (`journey`, `parting`, `joined`, `newcomer`, `fireout`, `village`, `birthParent`, `birthCamp`, `hearth`, `poked`), each as `ticks(n)` with the value at the site. `poke` also sets `pokedUntil = tick + 400`: that is `CLOCK.limit.poked: ticks(400)`.

- [ ] **Step 4: Convert the sites**

| File | Site | Becomes |
|---|---|---|
| `camps.js` `stashAdd` | `(kind === 'cooked' ? 1800 : 3500)` | `(kind === 'cooked' ? CLOCK.food.cookedKeeps : CLOCK.food.berriesKeep)` |
| `camps.js` `spoilFood` | `tick - camp.rotLogged > 600` | `> CLOCK.cooldown.rotLine` |
| `camps.js` founding | `nc.coals = tick + 6000`, the `tick + 3000` in `take` | `CLOCK.party.coalsLast`, `CLOCK.party.foodKeeps` |
| `camps.js` `updateCamps` | `tick % 100`, `tick % 300` | `CLOCK.every.spoil`, `CLOCK.every.fae` |
| `camps.js` births | `tick % 400 === 0`, `rng() < 0.35`, `> 16 * DAY` | `CLOCK.birth.every`, `.chance`, `.gap` |
| `camps.js` arrivals | `tick + 900 + rint(900)`, `(camp.village ? 0.85 : 0.7)` | `tick + CLOCK.arrival.wait + rint(CLOCK.arrival.spread)`, `(camp.village ? CLOCK.arrival.villageChance : CLOCK.arrival.chance)` |
| `weather.js` `burnTile` | `t.fire--`, `t.fire -= 2` | `t.fire -= CLOCK.fire.burn`, `t.fire -= CLOCK.fire.stormQuench` |
| `weather.js` `spreadTo` | `(weather.storm ? 0.012 : 0.08)` | `(weather.storm ? CLOCK.fire.stormSpread : CLOCK.fire.spread)` |
| `weather.js` `updateWeather` | `150 + rint(300)`, `(summer ? 4000 : 2000) + rint(3000)` | the `storm` entries, same shape |
| `weather.js` lightning | `(out ? 0.0035 : 0.0006)`, `0.0008`, `240` | `CLOCK.rate.lightningOut`, `.lightningLit`, `.strayLightning`, `CLOCK.fire.strikeFuel` |
| `main.js` `resetState` | `next: 1500 + rint(2000)` | `CLOCK.storm.first + rint(CLOCK.storm.firstSpread)` |
| `main.js` `lightTile` | `tick + 700 + rint(600)`, `240` | `CLOCK.arrival.first`, `.firstSpread`, `CLOCK.fire.strikeFuel` |
| `main.js` `poke` | `tick + 400`, the thought's `400` | `CLOCK.limit.poked`, `CLOCK.thought.poked` |
| `main.js` `step` | `tick % 200` | `CLOCK.every.prune` |
| `gods.js` `godsTick` | `tick % DAY !== 0` | `tick % CLOCK.every.godsRest !== 0` |
| `gods.js` a god's grudge | `addThought(o, 'over' + g.id, ..., -10, 4)` | `CLOCK.thought.over`. Write the entry as the bare number `4` with the comment "a god's thought. Nothing counts it down: the tick does not step a god." |
| `gods.js` `SPECIES.god` | `stride: 0` | `stride: ticks(0)`. The decay values there are all 0 and stay as they are. |
| `world.js` `sectorCount` cache | `tick - c.t < 100` | `< CLOCK.every.resourceCount` |
| `world.js` `growPlants` | `k < 60`, every age and chance | the `plant` entries. `const age = (tick - (t.planted \|\| 0)) / DAY` becomes `const age = tick - (t.planted \|\| 0)`, in ticks, and each comparison reads a `days()` entry: `age > CLOCK.plant.bushOld`, `age < CLOCK.plant.bushYoung`, `age > CLOCK.plant.bushTired`, `age >= CLOCK.plant.bushSeedsFrom`. The sapling and the old pine compare `tick - t.planted > CLOCK.plant.saplingGrown` and `tick - (t.planted \|\| 0) > CLOCK.plant.pineOld`. The season table becomes `CLOCK.plant.berryGrow[seasonOf()]`. |
| `world.js` `rotCarcasses` | `tick % 50`, `1500`, `600`, `900` | `CLOCK.every.carcassRot`, `CLOCK.food.venisonKeeps`, `.fishKeeps`, `.carcassKeeps` |
| `world.js` generation | `300 * DAY`, `(60 + rint(60)) * DAY`, `rint(100 * DAY)`, `rint(60 * DAY)`, `60 * DAY` | `days(300)`, `days(60 + rint(60))`, `rint(days(100))`, `rint(days(60))`, `days(60)`. These are ages given to plants at generation. Write them with `days()` in place. They do not go in `CLOCK`. |

`tick - planted` is a whole number, so `x / DAY > 60` and `x > days(60)` agree for every `x`. The golden confirms it.

`t.fire -= CLOCK.fire.burn` subtracts 1, as `t.fire--` does.

The thoughts in these files take their `CLOCK.thought` entries. `tasks.js` line 17 holds `tick + 700`, the arrival after a person lights the first hearth: it becomes `tick + CLOCK.arrival.firstByHand`. `goals.js` line 28 holds `tick + 900`: it becomes `tick + CLOCK.arrival.secondHearth`. Convert those two here, because the entries are here.

- [ ] **Step 5: Lower the ratchet**

Run: `node --test tests/clock.js`. The lint says which `PENDING` counts to lower. Remove `camps`, `weather`, `main`, `world`, and `gods` from `PENDING`; each must now hold zero. Lower `tasks` and `goals` by the sites converted here. If the lint still flags a line in one of the five files, either convert it or, if it is a chance rolled once per event, add its exact text to `EVENT_CHANCES` with a comment that gives the reason.

- [ ] **Step 6: Run every gate**

```bash
node build.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved. If the fingerprint moved, read `git diff` line by line against the table above. Look first at any line where an `&&` chain holds a roll.

- [ ] **Step 7: Commit**

```bash
git add src/sim tests/clock.js dist/hearth-sim.html
git commit -m "The clock table takes the camp rules and the cellular systems: spoilage, births, arrivals, storms, fire, plants"
```

---

### Task 3: Needs, thoughts, cooldowns, and the base tasks

**Files:**
- Modify: `src/sim/clock.js`, `src/sim/beings.js`
- Modify: `tests/clock.js` (`PENDING`, and one new test)

**Interfaces:**
- Consumes: `CLOCK`, `ticks`, `strides`, `days`, `tickRate`, `strideRate`.
- Produces: the `CLOCK` groups `cold` and `task`, and new entries in `rate`, `cooldown`, `limit`, and `thought`.

- [ ] **Step 1: Write the failing test**

Add to `tests/clock.js`, before the lint section:

```js
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
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/clock.js`
Expected: FAIL with "Expected values to be strictly deep-equal" on `C.cold`, which is undefined.

- [ ] **Step 3: Add the entries to `CLOCK`**

```js
  /* Warmth a person loses each tick, by where and when. */
  cold: { under: tickRate(0.012), winterNight: tickRate(0.06), winterDay: tickRate(0.025), summer: tickRate(0), night: tickRate(0.012), day: tickRate(0.003) },
  /* How long the base tasks take, in strides. */
  task: {
    nibble: strides(15), talk: strides(10), shelterWait: strides(60),
    sit: strides(90), sitChat: strides(25), sitTeach: strides(30), sitTeachAt: strides(15),
    standStill: strides(20), doze: strides(60),
  },
```

Add to `rate`:

```js
    fireWarms: tickRate(0.5),          // warmth gained within 3 tiles of a lit pit
    freezeHurts: tickRate(0.03), starveHurts: tickRate(0.04), heals: tickRate(0.01), fireHurts: tickRate(2.5),
    oldAgeDeath: tickRate(0.0006),     // past the usual span, divided by hardiness
    sitRests: strideRate(0.05), sitWarms: strideRate(0.4),
```

Add to `cooldown`:

```js
    offerFailed: ticks(60), pathBlocked: ticks(40), taskFailed: ticks(120), needFailed: ticks(120),
    disturb: ticks(1000),             // between two counts of one person in a gnome burrow
```

Add to `limit`:

```js
    task: ticks(1500),                // a task older than this is dropped
    hurtRemembered: ticks(600),       // a wound names the cause of death this long
    swarm: ticks(4000), swarmReturn: ticks(1500), blight: ticks(5000),
    gnomeHolds: days(2),              // a borrowed thing comes back after this
```

Add a `thought` entry for every `addThought` in `beings.js`, by the naming rule at the top of this plan. Each is `ticks(n)` with the value at the site. The two thoughts that last 50 ticks (`cold`, `starving`) are renewed every tick while the state holds; keep the value.

- [ ] **Step 4: Convert the sites in `beings.js`**

| Site | Becomes |
|---|---|
| `makeBeing`: `born: tick - Math.round((...) * DAY)` | Leave it. It turns an age in days from `LIFE` into ticks with `DAY`, and it holds no literal. |
| `die`: `swarmUntil = tick + 4000`, `blightUntil = tick + 5000` | `CLOCK.limit.swarm`, `CLOCK.limit.blight` |
| the rabbit's `++t.progress < 15` | `CLOCK.task.nibble` |
| `socialize`: `++t.progress < 10` | `CLOCK.task.talk` |
| `shelter`: `++t.progress < 60` | `CLOCK.task.shelterWait` |
| `sit`: `+ 0.05`, `% 25 === 0`, `+ 0.4`, `% 30 === 15`, `< 90` | `CLOCK.rate.sitRests`, `CLOCK.task.sitChat`, `CLOCK.rate.sitWarms`, `t.progress % CLOCK.task.sitTeach === CLOCK.task.sitTeachAt`, `CLOCK.task.sit` |
| `wander`: `wait: 20`; `rest`: `wait: 60` | `CLOCK.task.standStill`, `CLOCK.task.doze` |
| the sprite's `swarmUntil, tick + 1500` | `CLOCK.limit.swarmReturn` |
| the gnome's `tick - a.den.holding.since >= 2 * DAY` | `>= CLOCK.limit.gnomeHolds` |
| `chooseTask`: `a.cooldown[key] = tick + 60` | `CLOCK.cooldown.offerFailed` |
| `runTask`: `tick + 40`, `tick + 120` | `CLOCK.cooldown.pathBlocked`, `CLOCK.cooldown.taskFailed` |
| `updateBeing`: the `cold` expression | `under ? CLOCK.cold.under : season === 'winter' ? (night ? CLOCK.cold.winterNight : CLOCK.cold.winterDay) : season === 'summer' ? CLOCK.cold.summer : (night ? CLOCK.cold.night : CLOCK.cold.day)` |
| `updateBeing`: `(byFire ? 0.5 : 0)` | `(byFire ? CLOCK.rate.fireWarms : 0)` |
| `updateBeing`: `a.hp -= 0.03`, `a.hp -= 0.04`, `a.hp + 0.01 * (...)`, `a.hp -= 2.5` | `CLOCK.rate.freezeHurts`, `.starveHurts`, `.heals`, `.fireHurts` |
| `updateBeing`: `cooldown.disturb = tick + 1000` | `CLOCK.cooldown.disturb` |
| `updateBeing`: `tick - a.lastHurtAt > 600` | `CLOCK.limit.hurtRemembered` |
| `updateBeing`: `rng() < 0.0006 / (0.5 + a.traits.hardiness)` | `rng() < CLOCK.rate.oldAgeDeath / (0.5 + a.traits.hardiness)` |
| `updateBeing`: `a.cooldown[force] = tick + 120` | `CLOCK.cooldown.needFailed` |
| `updateBeing`: `tick - (a.task.started \|\| tick) > 1500` | `CLOCK.limit.task` |
| every `addThought(..., n)` | `CLOCK.thought.<key>` |

Leave these as they are. They are not time: the `-6` that turns rest decay into rest gain in sleep, the multipliers of the warmth formula (`1.3`, `0.6`, `1.5`, `0.4`, `0.3`), `lastChild: -99999`, amounts such as `+ 55` food, and `(tick + a.id) % sp.stride`, which reads the species table.

Two rolls in `beings.js` are chances rolled once per event: the snare's catch when a rabbit steps on it, and the pitfall's `rng() < 0.125` when a deer steps on it. Add their exact lint text to `EVENT_CHANCES`, each with a comment: `// rolled once, when an animal steps on the trap`.

- [ ] **Step 5: Lower the ratchet**

Run: `node --test tests/clock.js`. Remove `beings` from `PENDING`. It must hold zero.

- [ ] **Step 6: Run every gate**

```bash
node build.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 7: Commit**

```bash
git add src/sim tests/clock.js dist/hearth-sim.html
git commit -m "The clock table takes needs, thoughts, cooldowns, and the base tasks"
```

---

### Task 4: The animals, the sprites, and the gnomes

**Files:**
- Modify: `src/sim/clock.js`, `src/sim/species.js`, `src/sim/fae.js`
- Modify: `tests/clock.js` (`PENDING`, and one new test)

**Interfaces:**
- Consumes: `CLOCK`, `ticks`, `strides`, `days`, `tickRate`, `strideRate`.
- Produces: the `CLOCK` groups `spawn`, `den`, `gnome`, `grove`, `sprite`, `chase`, and new entries in `task`, `cooldown`, `limit`, `rate`, and `thought`. `SPECIES` rows written with `tickRate` and `ticks`.

- [ ] **Step 1: Write the failing test**

Add to `tests/clock.js`, before the lint section:

```js
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
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/clock.js`
Expected: FAIL with "Cannot read properties of undefined (reading 'rabbitLitter')".

- [ ] **Step 3: Add the entries to `CLOCK`**

```js
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
  },
```

Add to `task`: `eatCarcass: strides(25)`, `eatShrooms: strides(8)`, `denRest: strides(60)`, `kinChat: strides(20)`.

Add to `cooldown`: `raid: ticks(1200)`, `stalk: ticks(2000)`, `wolfLine: ticks(300)`.

Add to `rate`: `danceGlows: strideRate(0.6)`, `danceRests: strideRate(0.3)`, `dancePlays: strideRate(0.5)`, `visitPlays: strideRate(0.4)`.

Add a `thought` entry for every `addThought` in the two files, by the naming rule.

Read each site before you name it. If a value in this list does not match the site you find, the site governs: keep the site's value, fix the entry and the test, and say so in your report.

- [ ] **Step 4: Wrap the species table**

In `src/sim/species.js`, every number inside a `decay: { ... }` becomes `tickRate(n)`, and every `stride: n` becomes `stride: ticks(n)`. For example:

```js
  human:  { glyph: '@', label: 'human',  plural: 'people', decay: { food: tickRate(0.035), water: tickRate(0.05), rest: tickRate(0.03), social: tickRate(0.02), warmth: tickRate(0) }, stride: ticks(2), zmin: -2, zmax: 2 },
```

Leave `LIFE` as it is: it is in days. Leave `bite: { hp, spread, mood }` as it is: those are amounts.

- [ ] **Step 5: Convert the sites**

| File | Site | Becomes |
|---|---|---|
| `species.js` hunt | `++t.progress > 140 + a.skills.hunt * 30` | `> CLOCK.chase.wolf + a.skills.hunt * CLOCK.chase.wolfPerSkill` |
| `species.js` raid | `cooldown.raid = tick + 1200`, `tick - c.wolfLogged > 300` | `CLOCK.cooldown.raid`, `CLOCK.cooldown.wolfLine` |
| `species.js` stalk | `++t.progress > 160`, `cooldown.stalk = tick + 2000` | `CLOCK.chase.stalk`, `CLOCK.cooldown.stalk` |
| `species.js` carcass | `++t.progress < 25` | `CLOCK.task.eatCarcass` |
| `species.js` den rest, kin | `wait: 60`, `wait: 20` | `CLOCK.task.denRest`, `CLOCK.task.kinChat` |
| `species.js` mushrooms | `++k.progress < 8` | `CLOCK.task.eatShrooms` |
| `species.js` gnome borrow and repay | `< 6 * DAY`, `< 2 * DAY` | `CLOCK.gnome.repayGap`, `CLOCK.limit.gnomeHolds` |
| `species.js` `spawnWildlife` | `tick % 250 === 0`, `rng() < 0.8`, `tick % 300 === 0`, `tick % 2000 === 1000`, `tick % 10000 === 2500`, `tick % 6000 === 0` | the `spawn` entries: `tick % CLOCK.spawn.fawn.every === CLOCK.spawn.fawn.at`, and so on |
| `species.js` `denTick` | `tick % 500`, `< 20 * DAY`, `< 3 * DAY`, `digAgain = tick + 500`, `>= DAY` | `CLOCK.den.birthEvery`, `.birthGap`, `.digAfter`, `.digRetry`, `.campDark` |
| `species.js` `defendDen` | `(c.lastBite \|\| 0) + 150 > tick` | `+ CLOCK.den.biteGap > tick` |
| `species.js` `gnomeTick` | `tick % 500 !== 0`, `rng() < 0.3`, `>= 3 * DAY` | `CLOCK.gnome.every`, `.copyChance`, `.leaveAfter` |
| `fae.js` spear a sprite | `++t.progress > 90` | `CLOCK.chase.spearSprite` |
| `fae.js` flee and return | `tick + 800 + rint(600)` | `tick + CLOCK.sprite.returnAfter + rint(CLOCK.sprite.returnSpread)` |
| `fae.js` dance | `+ 0.6`, `+ 0.3`, `+ 0.5`, `% 40 === 0`, `% 200 === 0`, `rng() < 0.35`, `< 240` | `CLOCK.rate.danceGlows`, `.danceRests`, `.dancePlays`, `CLOCK.sprite.danceSeen`, `.mossEvery`, `.mossChance`, `.dance` |
| `fae.js` visit | `+ 0.4`, `=== 120`, `< 160` | `CLOCK.rate.visitPlays`, `CLOCK.sprite.visitGift`, `CLOCK.sprite.visit` |
| `fae.js` prank | `tick - c.fae.lastPrank > 300` | `CLOCK.sprite.prankGap` |
| `fae.js` `groveTick` | `tick % 500`, `> 6 * DAY`, `/ DAY > 40`, `rng() < 0.5` | `CLOCK.grove.every`, `.birthGap`, `tick - (t.planted \|\| 0) > CLOCK.grove.oldPine`, `.birthChance` |

The comments in `species.js` and `fae.js` that name a tick count ("Every 500 ticks", "One bite every 150 ticks", "waits 500 ticks", "Every 300 ticks") must stay true. Rewrite each to name the `CLOCK` entry, for example "One bite each `CLOCK.den.biteGap`, shared by the whole den".

These rolls are chances rolled once per event. Add their exact lint text to `EVENT_CHANCES`, each with a reason: the deer that breaks free of a wolf (`rng() > 0.45 + ...`), the carcass roll at `species.js` line 84, the spear's hit on a sprite, the two gift rolls of a sprite's visit, and the three prank rolls.

- [ ] **Step 6: Lower the ratchet**

Run: `node --test tests/clock.js`. Remove `species` and `fae` from `PENDING`.

- [ ] **Step 7: Run every gate**

```bash
node build.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 8: Commit**

```bash
git add src/sim tests/clock.js dist/hearth-sim.html
git commit -m "The clock table takes the animals, the sprites, and the gnomes, and the species table is written in its units"
```

---

### Task 5: Human work

**Files:**
- Modify: `src/sim/clock.js`, `src/sim/tasks.js`, `src/sim/goals.js`, `src/sim/recipes.js`, `src/sim/settle.js`
- Modify: `tests/clock.js` (`PENDING`, and one new test)

**Interfaces:**
- Consumes: `CLOCK`, `ticks`, `strides`, `days`.
- Produces: the `CLOCK` group `work`, and new entries in `chase`, `cooldown`, `limit`, and `thought`. `RECIPES` rows written with `strides`.

- [ ] **Step 1: Write the failing test**

Add to `tests/clock.js`, before the lint section:

```js
test('human work reads the table', () => {
  const api = load(), C = api.CLOCK;
  assert.equal(C.work.firepit, 70); assert.equal(C.work.knapAxe, 70); assert.equal(C.work.leanTo, 110); assert.equal(C.work.storehouse, 140); assert.equal(C.work.hut, 120);
  assert.equal(C.work.feedFire, 6); assert.equal(C.work.checkSnare, 4); assert.equal(C.work.fish, 110); assert.equal(C.work.cutTree, 60);
  assert.equal(C.chase.deer, 220); assert.equal(C.chase.deerPerSkill, 40); assert.equal(C.chase.deerMissed, 40); assert.equal(C.chase.guard, 200);
  assert.equal(C.limit.guardEmber, 500); assert.equal(C.limit.hearthProven, 3000);
  assert.equal(C.cooldown.sparks, 150); assert.equal(C.cooldown.wolfBurned, 2500); assert.equal(C.cooldown.wolfDriven, 3000);
  assert.equal(api.RECIPES.find(r => r.id === 'workshop').work, 140);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/clock.js`
Expected: FAIL with "Cannot read properties of undefined (reading 'firepit')".

- [ ] **Step 3: Add the entries to `CLOCK`**

```js
  /* How much work a job takes. A worker adds workSpeed to the job's progress each stride, and
     workSpeed is 1 for a person with no skill, so an entry is the strides the job takes them. */
  work: {
    firepit: strides(70), feedFire: strides(6), strikeSparks: strides(40), mossLight: strides(10), layFire: strides(15),
    butcherDeer: strides(60), cookFish: strides(25), cookCatch: strides(35),
    setSnare: strides(30), checkSnare: strides(4), rearmSnare: strides(10), haulDeer: strides(12),
    knapAxe: strides(70), testRocks: strides(50), spear: strides(50), waterskin: strides(60),
    leanTo: strides(110), storehouse: strides(140), hut: strides(120),
    offeringStone: strides(30), leaveBerries: strides(8), wardPosts: strides(60),
    rack: strides(50), smokeMeat: strides(45), smokeFish: strides(40),
    fish: strides(110), quarry: strides(25), breakRockfall: strides(60), cutTree: strides(60), fillWaterskin: strides(12),
    gatherEvery: strides(6), fibreEvery: strides(8), clayEvery: strides(10), cuttingsEvery: strides(6),
  },
```

Add to `chase`: `deer: strides(220)`, `deerPerSkill: strides(40)`, `deerMissed: strides(40)`, `guard: strides(200)`.

Add to `cooldown`: `sparks: ticks(150)`, `guardLine: ticks(800)`, `wolfBurned: ticks(2500)`, `wolfWanders: ticks(600)`, `wolfDriven: ticks(3000)`.

Add to `limit`: `guardEmber: ticks(500)`, `hearthProven: days(3)`.

Add a `thought` entry for every `addThought` in the four files, by the naming rule. `settle.js` holds one, `wouldnothold`, with the value 4. It is a god's thought, like `CLOCK.thought.over`: write it as the bare number `4` with the same comment.

The four `...Every` entries name the `++t.progress % N === 0` periods in `tasks.js` at lines 97, 113, 148, and 164. Read each site and check that the name fits what is gathered there. If a name does not fit, rename the entry and say so in your report.

- [ ] **Step 4: Wrap the recipes**

In `src/sim/recipes.js`, every `work: n` in `RECIPES` becomes `work: strides(n)`. Leave `PLACES.workshop.speed`: it is a multiplier.

- [ ] **Step 5: Convert the sites**

| File | Site | Becomes |
|---|---|---|
| `tasks.js` | every `startBuild(a, <at>, <n>, ...)` | the `work` entry that names the job |
| `tasks.js` fishing | `t.progress < 110` | `CLOCK.work.fish` |
| `tasks.js` quarry | `t.progress < 25` | `CLOCK.work.quarry` |
| `tasks.js` rockfall | `t.progress / 60 * 100`, `t.progress < 60` | `CLOCK.work.breakRockfall`, both |
| `tasks.js` cut a tree | `t.progress < 60` | `CLOCK.work.cutTree` |
| `tasks.js` waterskin | `++t.progress < 12` | `CLOCK.work.fillWaterskin` |
| `tasks.js` gathering periods | `++t.progress % 6`, `% 8`, `% 10`, `% 6` | the `...Every` entries |
| `tasks.js` deer hunt | `++t.progress > 220 + a.skills.hunt * 40`, `t.progress += 40` | `CLOCK.chase.deer`, `.deerPerSkill`, `.deerMissed` |
| `tasks.js` guard | `dies: tick + 500`, `++t.progress > 200`, `tick - camp.guardLogged > 800`, `cooldown.raid = tick + 2500`, `cooldown.wander = tick + 600` | `CLOCK.limit.guardEmber`, `CLOCK.chase.guard`, `CLOCK.cooldown.guardLine`, `.wolfBurned`, `.wolfWanders` |
| `tasks.js` clear a den | `cooldown.raid = tick + 3000` | `CLOCK.cooldown.wolfDriven` |
| `goals.js` | every `startBuild(a, <at>, <n>, ...)` | the `work` entry that names the job |
| `goals.js` sparks | `a.cooldown['strike sparks'] = tick + 150` | `CLOCK.cooldown.sparks` |
| `goals.js` hearth, axe | `3 * DAY` (three sites) | `CLOCK.limit.hearthProven` |
| `goals.js` found a camp | `8 * DAY` (two sites), and the `/8 days old` in the text | `CLOCK.party.campAge`. The text reads `/${CLOCK.party.campAge / DAY} days old`. |
| `goals.js` hearth title | `'Keep the hearth three days without a break'` | Leave the title. It is game text, and G4 rewrites it with the retune. |
| `recipes.js`, `settle.js` | each thought | `CLOCK.thought.<key>` |

These rolls are chances rolled once per event. Add their exact lint text to `EVENT_CHANCES`, each with a reason: the fish that bites at the end of a cast, the spear's hit on a deer, the sparks that take, and the rocks that prove to be firestones.

The label of `startBuild` shows progress as a percent of `work`. It reads the argument, so it needs no change.

- [ ] **Step 6: Lower the ratchet**

Run: `node --test tests/clock.js`. Remove `tasks`, `goals`, `recipes`, and `settle` from `PENDING`. `PENDING` is now empty.

- [ ] **Step 7: Run every gate**

```bash
node build.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 8: Commit**

```bash
git add src/sim tests/clock.js dist/hearth-sim.html
git commit -m "The clock table takes human work: every job, chase, and cooldown of tasks, goals, and recipes"
```

---

### Task 6: The close

**Files:**
- Modify: `tests/clock.js`
- Modify: `design/notes.md`, `design/specs/2026-09-18-time-and-tiers-design.md`, `design/settings.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: the whole `CLOCK` table from tasks 1 to 5.
- Produces: the record that plan G4 starts from.

- [ ] **Step 1: Remove the ratchet**

In `tests/clock.js`, delete `PENDING` and its two uses. The lint test becomes:

```js
test('no rule holds a bare time literal', () => {
  const bare = FILES.filter(f => f !== 'clock').flatMap(bareIn);
  assert.equal(bare.length, 0, bare.join('\n'));
});
```

- [ ] **Step 2: Add the test that the table is whole**

Add to `tests/clock.js`:

```js
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
```

An entry read through a computed key, as `CLOCK.plant.berryGrow[seasonOf()]` is, counts as read when the source holds `CLOCK.plant.berryGrow[`.

Run: `node --test tests/clock.js`
Expected: all pass. If an entry is unread, a site was missed or an entry is dead. Convert the site or delete the entry.

- [ ] **Step 3: Measure the soak**

Run: `time node tests/soak.js`
Expected: 66 of 66, the golden unmoved. The run before this plan took 77 seconds on this machine. If the run is more than 10 percent slower, read `updateBeing` and `growPlants` for a `CLOCK` lookup inside a hot loop, and hoist it to a `const` at the top of the function. Hoist only a read of the table, never a roll.

- [ ] **Step 4: Write the record**

In `design/notes.md`, add a section after the last numbered section. Use the next free number. Its title is "The clock table". It says, in plain sentences:

- `src/sim/clock.js` holds the calendar, the unit helpers, and `CLOCK`. It loads directly after `core.js`.
- The rules for what counts as time, as the table in this plan gives them, in short form.
- `ticks`, `strides`, `tickRate`, and `strideRate` mark a value still in the old clock's units. The retune (plan G4) replaces each. When none is left, the retune is done.
- The rows of `SPECIES`, `LIFE`, and `RECIPES` stay in their own tables, written in the same helpers.
- A being runs its task once a stride, so a task's progress counts strides.
- `tests/clock.js` lints `src/sim/` for bare time literals. `EVENT_CHANCES` lists each chance that is rolled once per event, with its reason.
- The soak fingerprint did not move through the whole plan.

In `design/specs/2026-09-18-time-and-tiers-design.md`, add a paragraph at the end of section 1 that begins "**As built (G1).**" It records three things. Per-species and per-recipe values stay in their tables, written in the helpers. `perHour` is linear and serves an amount and a small chance alike. There are four legacy markers, and G4 is complete when none is left.

In `CLAUDE.md`, in the Layout list: add `clock` after `core` in the list of sim files, as "clock (the calendar, the units, and every duration and rate)". Add a line for `tests/clock.js`: "the unit helpers, the table's values, and a lint: no bare time literal in a rule. Fast." Under "Rules of work", add: "A duration or a rate goes in `CLOCK` in `src/sim/clock.js`, or in a species or recipe row written with the unit helpers. `tests/clock.js` fails on a bare one."

In `design/settings.md`, change the state of no row. Add no row. G1 adds no setting.

- [ ] **Step 5: Run every gate**

```bash
node build.js
npm run fast
node tests/soak.js
```

Expected: all pass, and the golden is unmoved.

- [ ] **Step 6: Commit**

```bash
git add tests/clock.js design CLAUDE.md dist/hearth-sim.html
git commit -m "The clock table is whole: the ratchet is gone, every entry is read, and the notes record the rules"
```
