// The skip: the engine jumps to the next tick at which anything happens, and the story does not
// change. Ruling 2 of plan G4 asks that a world second cost what happens in it and not what it spans.
//
//   node --test tests/skip.js            the everyday run
//   LONG=1 node --test tests/skip.js     adds seventy world days on seed r, stepped and skipped
//
// WHAT IS COMPARED, AND WHY IT IS NEVER A STORED RECORD. A skipped run is held against a STEPPED run
// of the same seed, line for line and record for record. The golden fixes the random number stream,
// so anything that moves no number is invisible to it, and a missed horizon is exactly that kind of
// thing: a beat not run, a season turned with nobody reading it, a chronicle line written at the
// wrong tick. A broken skip that draws the same numbers agrees with a file. It cannot agree with the
// run it is meant to reproduce.
//
// WHY THE SIX REAL SEEDS CANNOT CARRY THIS GATE ON THEIR OWN, measured and not assumed. On seed r at
// day 1 the horizon is the next tick on 100.0 percent of ticks, because eighty-five beings walk and
// dance on a per-tick beat and a walker takes a tile a tick by task 1's ruling. So a skipped run of a
// real seed makes exactly as many moves as a stepped one, the two are identical BY CONSTRUCTION, and
// an equality test over them would pass against a `runTo` that merely loops `step()`. That test is
// still here, because it is the one that would catch a horizon fault in the world a player meets. But
// the POSITIVE gate -- that the engine skips at all, and that it tells the same story when it does --
// is carried by the tests below it, which arrange a valley the engine can jump in and assert that it
// made far fewer moves than there were ticks. Those are the tests a looping `runTo` fails.
//
// THE ARRANGEMENT, once, because five tests share it. `perTick: false` on a species is how the gods
// already stand outside the tick, so setting it on the animals freezes them where they are without
// any new seam in `src/sim/`. Both sides of every comparison get the same arrangement, so it is a
// different world and not a weaker one. It is named `idle` below and each test says what it buys.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { load, FILES } = require('../src/sim');
const { collect, fingerprint, scriptGod, setClock } = require('./lib/run');

const ANIMALS = ['rabbit', 'deer', 'wolf', 'fox', 'sprite', 'gnome'];

/* A world, and its collector, with the collector watching before the creation is logged. */
function world(seed, { idle = false, awake = [], opts = {} } = {}){
  const api = load();
  if (idle) for (const k of ANIMALS) if (!awake.includes(k)) api.SPECIES[k].perTick = false;
  const c = collect(api);
  api.startWorld(seed, opts);
  return { api, events: c.events, check: c.check };
}

/* Tick by tick, with the script god after each tick: the loop `runOn` used before the skip existed. */
function stepOn(w, ticks, god = scriptGod){
  const off = w.api.tick + 1;
  const end = w.api.tick + ticks;
  while (w.api.tick < end){ w.api.step(); god(w.api, w.api.tick - off); }
  return w;
}
/* THE ENGINE'S OWN `runTo`, with the god folded into the horizon the way `tests/lib/run.js` folds it,
   and every jump written down. A jump from a to b resolved a and b and passed over the ticks between.
   This function held a third copy of `runTo`'s loop, which is how the task 4 review could gut the
   shipping loop to `return tick;` and watch every gate stay green. It calls `runTo` now, so the loop
   this file tests is the loop the page runs. */
function skipOn(w, ticks, god = scriptGod){
  const api = w.api, off = api.tick + 1, end = api.tick + ticks;
  const jumps = [], visited = [];
  let from = api.tick;
  const atTick = () => {
    const to = api.tick;
    visited.push(to);
    if (to > from + 1) jumps.push([from, to]);
    from = to;
    god(api, to - off);
  };
  if (god && god.wants) atTick.wants = () => god.wants(api, off);
  api.runTo(end, atTick);
  assert.equal(api.tick, end, `the run stopped at tick ${api.tick} of ${end}: the engine will not run through what is pending`);
  w.jumps = jumps; w.visited = visited;
  return w;
}
const inAJump = (w, t) => w.jumps.some(([a, b]) => t > a && t < b);
const landedOn = (w, t) => w.visited.includes(t);

/* More than the fingerprint hashes, so a failure names the record that differs rather than a hash.
   This is the layout `tests/names.js` keeps, plus the fields a jump could plausibly get wrong: the
   tick a being was last brought up to, the tick it acts again, and every thought with its `until`. */
function layout(api){
  return {
    beings: api.beings.map(b => [b.id, b.species, b.name, b.epithet || '', b.alive ? 1 : 0, b.x, b.y, b.z,
      b.hp.toFixed(6), b.seen, b.next, b.asleep ? 1 : 0,
      Object.keys(b.needs).sort().map(k => k + '=' + b.needs[k].toFixed(6)).join(','),
      b.thoughts.map(t => t.key + '@' + t.until).sort().join(',')].join('|')),
    items: api.items.map(i => [i.id, i.kind, i.x, i.y, i.z].join('|')),
    camps: api.camps.map(c => [c.id, c.name, c.litTicks, c.streak, c.bestStreak, c.outSince, c.nextArrival || 0,
      c.village ? 1 : 0, c.huts.length, c.storehouse ? 1 : 0].join('|')),
  };
}
/* The whole comparison, in one place: the chronicle line for line, the fingerprint, and the layout. */
function sameStory(a, b, why){
  assert.deepEqual(b.events.map(e => `${e.tick}|${e.kind}|${e.text}`), a.events.map(e => `${e.tick}|${e.kind}|${e.text}`),
    `${why}: the chronicle differs between the stepped run and the skipped one`);
  assert.deepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events), `${why}: the fingerprint differs`);
  const la = layout(a.api), lb = layout(b.api);
  assert.deepEqual(lb.beings, la.beings, `${why}: a being differs`);
  assert.deepEqual(lb.items, la.items, `${why}: an item differs`);
  assert.deepEqual(lb.camps, la.camps, `${why}: a camp differs`);
  assert.equal(b.api.tick, a.api.tick, `${why}: the two runs stopped at different ticks`);
}

/* ---------- the horizon's one assumption ---------- */
/* THE WORLD'S BEAT IS THE CEILING ON A JUMP, and `nextEvent` names no world period of its own: it
   takes the next multiple of `CLOCK.every.cellular` and relies on every period of every system that
   reads the world being a multiple of it. This is the test that keeps that true. A period that is not
   a multiple of the beat is a rule the engine can jump over, and nothing else in the suite would say
   so: the fingerprint would only differ on a seed where that rule happened to fire.
   Each path below is a `tick % ...` site in `src/sim/`. A phase (`at`) is a tick of the period, so it
   must lie on the grid too.
   THE LIST WAS WRITTEN BY HAND AND IS NOW CHECKED AGAINST THE SOURCE. It was a hand grep with no
   completeness check, so a period added by a later task and never written down here was never checked
   at all: the task 4 review planted `CLOCK.every.freshPeriod: 7`, read by a new `tick %` rule, and this
   file stayed green while the file's own header called the list "the horizon's one assumption". The
   second test below reads every `tick %` site out of `src/sim/` and fails on one this list does not
   name, and on a name in this list that no site reads. */
const WORLD_PERIODS = [
  'every.cellular', 'every.spoil', 'every.fae', 'every.prune', 'every.carcassRot', 'every.godsRest',
  'birth.every', 'grove.every', 'den.birthEvery', 'gnome.every',
  'spawn.rabbitLitter.every', 'spawn.rabbitStray.every', 'spawn.fawn.every', 'spawn.fawn.at',
  'spawn.wolf.every', 'spawn.wolf.at', 'spawn.fox.every',
  'names.nameHour',
];
test('every period the world itself runs on lies on the cellular grid', () => {
  const api = load(), beat = api.CLOCK.every.cellular;
  const off = [];
  for (const path of WORLD_PERIODS){
    const v = path.split('.').reduce((o, k) => o[k], api.CLOCK);
    assert.equal(typeof v, 'number', `CLOCK.${path} is not a number, so the list has gone stale`);
    if (v % beat !== 0) off.push(`CLOCK.${path} = ${v}, and the beat is ${beat}`);
  }
  assert.deepEqual(off, [], 'a world period off the beat is a rule the skip can jump over');
  /* The calendar breaks a rule reads, for the same reason. */
  assert.equal(api.DAY % beat, 0);
  assert.equal(api.CLOCK.night.falls % beat, 0);
  assert.equal(api.CLOCK.night.lifts % beat, 0);
});

/* THE COMPLETENESS CHECK ON THAT LIST. Every `tick %` site in `src/sim/` is read out of the source and
   its period named, and a period the list above does not name fails here. Without this the list agrees
   with whatever it was last set to, which is the fault the memory calls "a document can describe
   instead of constrain".

   A `tick %` site in a COMMENT is not a rule, so the comments go first. The stripper is crude -- one
   pass for block comments and one for line comments, with no knowledge of strings -- so each stripped
   file is compiled by `vm.Script` afterwards, which parses and runs nothing. A stripper that ate into
   a string literal breaks the parse and this test says so, rather than quietly scanning less than it
   claims to.

   A site's period is the left operand of the `%`, and its phase is the comparand where that is a name
   rather than a number. Both must lie on the beat, so both are looked up here. */
const NOT_WORLD_PERIODS = {
  /* A being's own act rate in the dark, in `TASKS`' work step, and not a period of the world. The
     horizon names a being's `next` tick and the engine lands on it, whatever this parity then says
     about the work done there. */
  'CLOCK.dark.slower': 'a being\'s own rate, not a world period',
  /* The calendar. It is checked against the beat by its own assertion in the test above. */
  'DAY': 'the calendar, asserted against the beat above',
};
function stripComments(text){
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}
test('every tick-modulo rule in src/sim names a period this file checks', () => {
  const api = load();
  const site = /tick\s*%\s*([A-Za-z_$][\w$.]*)\s*(?:[!=]==?\s*([A-Za-z_$][\w$.]*))?/g;
  const listed = new Set(WORLD_PERIODS.map(p => 'CLOCK.' + p));
  const unlisted = [], seen = new Set();
  let sites = 0;
  for (const f of FILES){
    const file = path.join(__dirname, '..', 'src', 'sim', f + '.js');
    const code = stripComments(fs.readFileSync(file, 'utf8'));
    /* The stripper's own guard: a parse, and nothing run. */
    try { new vm.Script(code, { filename: file }); }
    catch (e){ assert.fail(`the comment stripper broke src/sim/${f}.js, so this test scanned something that is not the source: ${e.message}`); }
    for (const m of code.matchAll(site)){
      sites++;
      for (const token of [m[1], m[2]]){
        if (!token) continue;
        seen.add(token);
        if (listed.has(token) || token in NOT_WORLD_PERIODS) continue;
        unlisted.push(`src/sim/${f}.js reads ${token} as a tick period, and WORLD_PERIODS does not name it`);
      }
    }
  }
  /* A positive gate on the instrument: a scan that found nothing would satisfy every claim below. */
  assert.ok(sites >= 19, `only ${sites} tick-modulo sites were found in src/sim/, and there were 19 when this check was written: the scan is reading less than the source`);
  assert.deepEqual(unlisted, [], 'a tick-modulo rule reads a period nothing checks against the beat');
  /* And the other way: a name in the list that no rule reads any more is a stale entry, and a stale
     list is one nobody can trust the length of. */
  const stale = WORLD_PERIODS.filter(p => !seen.has('CLOCK.' + p)).map(p => `CLOCK.${p} is in WORLD_PERIODS and no tick-modulo rule in src/sim/ reads it`);
  assert.deepEqual(stale, [], 'WORLD_PERIODS names a period no rule reads');
  assert.ok(api.CLOCK.every.cellular > 0, 'the beat itself is gone');
});

/* ---------- the pin counters ---------- */
/* `none` MUST BE REACHABLE, AND IT WAS NOT. The plan asks that a third hazard cause be counted on its
   own rather than fall into one of two, because a two-way split makes a permanent cost read as an
   episodic one. Task 4 answered that with `pinMask |= cause === 'fire' ? 1 : 2`, under which every
   cause but fire was a hunter and `none` was a constant zero dressed as a count. The review proved it
   by relabelling the rouser branch's cause in a throwaway copy: the counters came back byte-identical.

   An unnamed cause cannot be arranged from outside the engine, because `senseBeings` finds the only two
   causes there are. So this test takes the mapping apart instead. `pinBucket` is the whole of the
   decision and it is asked directly, which is why it is a named function. The line in `senseBeings`
   that sets the bit is read out of the source, because the mapping being right buys nothing if the pass
   never sets the bit. */
test('a hazard cause the engine does not name is counted in none', () => {
  const api = load();
  assert.equal(api.pinBucket(1), 'fire');
  assert.equal(api.pinBucket(2), 'hunter');
  assert.equal(api.pinBucket(3), 'both');
  assert.equal(api.pinBucket(0), 'none', 'a pin with no bits set is a pin with no cause');
  for (const mask of [4, 5, 6, 7])
    assert.equal(api.pinBucket(mask), 'none', `a mask of ${mask} carries the unnamed-cause bit, so it must be counted in none and not in a cause it is not`);
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'sim', 'beings.js'), 'utf8');
  assert.match(code, /pinMask \|= cause === 'fire' \? 1 : cause === 'hunter' \? 2 : 4;/,
    'senseBeings no longer sets the unnamed-cause bit, so a third cause is being counted as one of the two named ones and none is unreachable again');
});

/* ---------- the six real seeds ---------- */
const SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'];
const DAYS = 3;
for (const seed of SEEDS)
  test(`seed ${seed}, ${DAYS} world days: a skipped run and a stepped run tell the same story`, t => {
    const api0 = load(), n = DAYS * api0.DAY;
    const a = stepOn(world(seed), n);
    const b = skipOn(world(seed), n);
    a.check(`${seed} stepped`); b.check(`${seed} skipped`);
    const p = b.api.pins;
    t.diagnostic(`${seed}: ${n} ticks, stepped in ${a.api.moves} moves, skipped in ${b.api.moves}; ` +
      `${b.jumps.length} jumps; horizon was the next tick on ${(100 * p.next / p.asked).toFixed(1)}% of ${p.asked} asks`);
    t.diagnostic(`${seed}: why the horizon was the next tick: ${JSON.stringify(p)}`);
    sameStory(a, b, seed);
  });

/* ---------- the positive gate: the engine really jumps ---------- */
/* THE TEST A LOOPING `runTo` FAILS. `idle` freezes the animals, so the valley holds the people alone,
   which is the case the skip was built for and the case every restored suite spends its time in. The
   ratio is a literal and not a measurement of the run: a run that makes as many moves as there are
   ticks has not skipped, whatever it reports. 0.6 is well clear of the 0.41 measured here, so the
   assertion fails on a skip that stops working and does not fail on a stream that shifts. */
test('with the animals still, one world day costs well under a move a tick, and the story holds', t => {
  const api0 = load(), n = api0.DAY;
  const a = stepOn(world('r', { idle: true }), n);
  const b = skipOn(world('r', { idle: true }), n);
  t.diagnostic(`stepped ${a.api.moves} moves, skipped ${b.api.moves} moves of ${n} ticks ` +
    `(${(b.api.moves / n).toFixed(3)} a tick), ${b.jumps.length} jumps, longest ${Math.max(...b.jumps.map(([x, y]) => y - x))} ticks`);
  t.diagnostic(`why the horizon was the next tick: ${JSON.stringify(b.api.pins)}`);
  assert.equal(a.api.moves, n, 'the stepped side did not step every tick, so the control is not a control');
  assert.ok(b.api.moves < n * 0.6, `the skipped run made ${b.api.moves} moves of ${n} ticks: the engine is not skipping`);
  sameStory(a, b, 'the still valley');
});

/* ---------- the adversarial cases ---------- */
/* Each names one thing that falls due between two horizons. The arrangement is the same for all five:
   an idle valley at night with everyone asleep, which puts the horizon on the world's beat and gives
   jumps of fifty-eight ticks. A sleeper is the being a jump is most dangerous to, because it is the
   one whose body is computed rather than stepped and whose next act is a minute away. */
/* A lit pit with `beats` beats of fuel in it, laid by hand. Nobody has built one at tick 0, and
   running the world until somebody does costs a world day on each side of every comparison. The tile
   is written the way `TASKS.buildFirepit` writes it, and the camp fields with it. */
function layAPit(api, beats){
  const c = api.camps[0], h = api.humans()[0];
  const t = api.tileAt(h.x + 1, h.y, 0);
  assert.ok(t, 'no ground beside the first person to lay a pit on');
  t.ground = 'soil'; t.feature = null; t.berries = 0;
  t.struct = { type: 'firepit', fuel: api.CLOCK.rate.pitBurn * api.CLOCK.every.cellular * beats, lit: true };
  c.pit = [t.x, t.y]; c.everLit = true; c.outSince = 0;
  for (const p of api.humans()) p.camp = c;
  return t;
}
function sleepingValley(seed, at){
  const w = world(seed, { idle: true });
  setClock(w.api, at);
  for (const h of w.api.humans()){ h.task = null; h.asleep = true; h.needs.rest = 0; }
  return w;
}
/* Both sides need the identical arrangement, so it is built twice from the same recipe. */
function bothWays(seed, at, ticks, fix, god){
  const a = sleepingValley(seed, at), b = sleepingValley(seed, at);
  if (fix){ fix(a.api); fix(b.api); }
  stepOn(a, ticks, god ? god() : () => {}); skipOn(b, ticks, god ? god() : () => {});
  return { a, b };
}
const NIGHT = api => 3 * api.DAY + api.CLOCK.night.falls + 600;

test('a need that reaches zero inside a jump reaches it at the same tick', t => {
  const api0 = load();
  const at = NIGHT(api0), decay = api0.SPECIES.human.decay.food;
  /* Thirty ticks into the first fifty-eight tick jump, so the crossing is inside a jump and not on a
     horizon. The arrangement is applied to both sides, so neither run is the lucky one. */
  let want = 0;
  const { a, b } = bothWays('r', at, 600, api => { const h = api.humans()[0]; h.needs.food = decay * 32; h.needs.water = 90; want = api.tick + 32; });
  t.diagnostic(`food reaches zero at tick ${want}; ${b.jumps.length} jumps, first ${JSON.stringify(b.jumps[0])}`);
  assert.ok(inAJump(b, want), `tick ${want} was not inside a jump, so this case did not run`);
  assert.equal(b.api.humans()[0].needs.food, 0, 'the need did not reach zero, so the case did not run');
  assert.ok(b.events.some(e => /is starving|dying of thirst/.test(e.text)) || b.api.humans()[0].thoughts.some(th => th.key === 'starving'),
    'nothing read the empty stomach, so the case proves nothing');
  sameStory(a, b, 'a need reaching zero');
});

test('a season that turns inside a span turns on its own tick, and the engine lands there', t => {
  const api0 = load();
  /* Thirty ticks before the turn of day 92, which is the first day of summer. */
  const turn = 91 * api0.DAY;
  const { a, b } = bothWays('r', turn - 30, 600);
  t.diagnostic(`the turn is tick ${turn}; the engine landed on it: ${landedOn(b, turn)}; seasons ${a.api.seasonOf()} / ${b.api.seasonOf()}`);
  assert.equal(b.api.seasonOf(), 'summer', 'the run did not cross into summer, so the case did not run');
  /* The turn of a day is a multiple of the beat, so it is a horizon and never sits inside a jump.
     That is the claim: remove the beat from `nextEvent` and the engine sails past it. */
  assert.ok(landedOn(b, turn), 'the engine jumped over the turn of the season');
  assert.ok(!inAJump(b, turn), 'the turn of the season fell inside a jump');
  sameStory(a, b, 'a season turning');
});

test('a pit that goes out inside a span writes its line at the same tick', t => {
  const api0 = load();
  let out = 0;
  /* A pit with two beats of fuel left, so it goes out a hundred-odd ticks in. The pit's out-tick is
     the one horizon entry that is arithmetic rather than a stored tick, and task 2 put the burn on
     the camp's beat, so it falls ON a beat and the beat's own horizon reaches it. */
  const { a, b } = bothWays('r', NIGHT(api0), 600, api => layAPit(api, 2));
  const line = e => /The fire goes out/.test(e.text);
  const la = a.events.filter(line), lb = b.events.filter(line);
  t.diagnostic(`stepped wrote it at ${la.map(e => e.tick)}, skipped at ${lb.map(e => e.tick)}`);
  assert.equal(la.length, 1, 'the stepped run never put the fire out, so the case did not run');
  assert.equal(lb.length, 1, 'the skipped run never put the fire out');
  assert.equal(lb[0].tick, la[0].tick, 'the fire went out at another tick in the skipped run');
  out = la[0].tick;
  /* THE CLAIM IS THE RESIDUE, AND NOT WHETHER THIS RUN HAPPENED TO LAND THERE. `!inAJump` alone is a
     net whose sensitivity depends on which residue the burn lands on: the task 4 review moved the burn
     to 1 mod 60 and the case stayed green, because in this arrangement the engine already visits
     residues 0, 1 and 2 mod 60 and so it landed on the out-tick by luck. The out-tick is read off the
     STEPPED run, which visits every tick, so this assertion is a statement about the burn and not
     about the skip: task 2 put the fuel on the camp beat, so the out-tick is a multiple of it, and the
     beat's own horizon entry reaches it whatever else is going on. A burn that leaves the beat at ANY
     residue reddens this line. */
  const beat = api0.CLOCK.every.cellular;
  assert.equal(out % beat, 0, `the fire went out at tick ${out}, which is ${out % beat} mod ${beat}: the burn has left the camp beat, so nextEvent owes the out-tick an entry of its own`);
  assert.ok(!inAJump(b, out), 'the out-tick fell inside a jump, so the burn has left the beat and nextEvent owes it an entry');
  assert.equal(b.api.camps[0].outSince, a.api.camps[0].outSince);
  assert.equal(b.api.camps[0].streak, 0);
  sameStory(a, b, 'a pit going out');
});

test('a thought whose until falls inside a jump is gone on the far side, in both runs', t => {
  const api0 = load();
  let until = 0;
  const { a, b } = bothWays('r', NIGHT(api0), 600, api => {
    const h = api.humans()[0];
    /* Twenty ticks into a jump: `until` is not on the beat, and nothing else reads it. */
    until = api.tick + 22;
    api.addThought(h, 'skiptest', 'A thought put here by tests/skip.js', 0, 22);
  });
  t.diagnostic(`the thought ends at ${until}; inside a jump: ${inAJump(b, until)}`);
  assert.ok(inAJump(b, until), `tick ${until} was not inside a jump, so this case did not run`);
  assert.ok(!a.api.humans()[0].thoughts.some(th => th.key === 'skiptest'), 'the stepped run kept the thought');
  assert.ok(!b.api.humans()[0].thoughts.some(th => th.key === 'skiptest'), 'the skipped run kept the thought past its until');
  sameStory(a, b, 'a thought ending');
});

/* A STORED TICK THAT DRAWS A NUMBER WHEN IT FIRES, which is the sharpest of these cases and the one
   the six real seeds cannot see. `camp.nextArrival` is read on every tick in `updateCamps` and reset
   with `rint(CLOCK.arrival.spread)` the moment it passes, so a jump that lands past it moves the draw
   to another tick and the whole stream after it shifts. It is set here to a tick off the beat, which
   is where the horizon has to name it rather than stumble on it.
   This is also the measurement of what the six-seed test does NOT cover. Drop `mark(c.nextArrival)`
   from `nextEvent` and the six seeds stay green over three world days -- measured, not assumed,
   because nothing skips in a live valley -- while this test goes red. */
test('an arrival tick that falls inside a span is read on its own tick', t => {
  const api0 = load();
  let want = 0;
  const { a, b } = bothWays('r', NIGHT(api0), 600, api => {
    layAPit(api, 40);
    const c = api.camps[0];
    /* Twenty-three ticks on, so it is inside the first jump and not on the beat. */
    want = api.tick + 23; c.nextArrival = want;
  });
  t.diagnostic(`the arrival tick is ${want}; the engine landed on it: ${landedOn(b, want)}; ` +
    `next arrival after: stepped ${a.api.camps[0].nextArrival}, skipped ${b.api.camps[0].nextArrival}`);
  assert.ok(b.jumps.length > 0, 'the engine made no jump at all, so this case did not run');
  assert.ok(landedOn(b, want), `the engine did not land on tick ${want}: nextEvent does not name the arrival`);
  assert.ok(!inAJump(b, want), `tick ${want} fell inside a jump`);
  assert.notEqual(b.api.camps[0].nextArrival, want, 'the arrival tick was never read, so the case did not run');
  assert.equal(b.api.camps[0].nextArrival, a.api.camps[0].nextArrival,
    'the next arrival was drawn at another tick in the skipped run, so the whole stream after it differs');
  sameStory(a, b, 'an arrival tick');
});

/* THE FIFTH ADVERSARIAL CASE IS TASK 9'S, and it is written down here rather than left out. A stop
   set inside a jump cannot be tested, because the days era has no stop to set: `src/sim/door.js`
   answers a days-era `run` with the same sentence twice, and the watch list is task 9's work. So this
   test pins the sentence instead. When task 9 builds `run` and `watch` for the days era it will go
   red, and the task that reddens it owes the real case: a stop whose tick falls inside a jump must
   fire on its own tick and be spent, and `nextEvent` must name it. */
test('a stop set inside a jump is task 9 and the door still says so', () => {
  const api = load(); api.startWorld('r');
  const said = api.inject({ source: 'player', act: 'run', what: 'day', at: api.dayOf() + 1 });
  assert.match(String(said), /waits for the watch list|Only a run to an age is built/,
    'the door now takes a days-era run, so the stop-inside-a-jump case is real and belongs in this file');
});

/* ---------- ruling 6's precondition ---------- */
/* A pass that must run every world second is a pass that cannot be skipped, and it is only a real
   constraint when it has work. Both halves are asserted, because without the second the first is
   satisfied by an engine that never skips at all.

   THE WOLF IS FROZEN, AND THAT IS THE WHOLE POINT OF THE CONTROL. An awake wolf that walks acts every
   tick, so it pins the horizon through its own next-act tick and the proximity pass is never the
   binding reason; the two arrangements would then differ in two ways at once and neither number would
   mean anything. A wolf off the tick still rouses: `senseBeings` builds its rousers from `beings` and
   asks `asleep`, not `perTick`. So the only difference between the two arrangements below is the
   distance, which is what ruling 6 is about. The walking wolf is asserted separately, at the end. */
function wolfAt(api, away){
  const h = api.humans()[0];
  const w = api.makeBeing('wolf', h.x + away, h.y, null, 0);
  w.z = h.z; w.asleep = false; w.task = null;
  api.beings.push(w);
  return w;
}
test('a wolf within reach of a sleeper is never jumped over, and its absence is', t => {
  const api0 = load(), at = NIGHT(api0), n = 600;
  const near = sleepingValley('r', at); wolfAt(near.api, 2); skipOn(near, n, () => {});
  const far = sleepingValley('r', at); wolfAt(far.api, 60); skipOn(far, n, () => {});
  t.diagnostic(`wolf at 2 tiles: ${near.jumps.length} jumps, ${near.api.moves} moves of ${n}, pins ${JSON.stringify(near.api.pins)}`);
  t.diagnostic(`wolf at 60 tiles: ${far.jumps.length} jumps, ${far.api.moves} moves of ${n}, pins ${JSON.stringify(far.api.pins)}`);
  assert.ok(near.api.pins.hunter > 0, 'the proximity pass never found the wolf at two tiles, so the case did not run');
  assert.equal(far.api.pins.hunter, 0, 'the wolf at sixty tiles was found too, so the distance is not what differs');
  assert.ok(far.jumps.length > 0, 'the engine did not jump with nothing near, so the first half proves nothing');
  assert.ok(near.api.moves > far.api.moves, `the near arrangement made ${near.api.moves} moves and the far one ${far.api.moves}: the pin cost nothing, so it is not doing anything`);
  /* A stepped run of the near arrangement tells the same story as the skipped one. */
  const a = sleepingValley('r', at); wolfAt(a.api, 2); stepOn(a, n, () => {});
  sameStory(a, near, 'a wolf beside a sleeper');
});
/* A FIRE LIT THROUGH THE DOOR BETWEEN TWO MOVES. This is the case the proximity pass cannot supply on
   its own: the pass looks at beings, and a tile the player sets alight is not a being. `inject` lands
   between one move and the next, after the horizon for that move was worked out, so a horizon that
   read only the pass's answer would show the fire to a sleeper a world minute late. `nextEvent` reads
   `fireCount` instead, which is a count the engine already keeps.
   The god lights the same tile on the same tick in both runs, and says the tick it wants so the
   skipped run is handed control there. */
const burnableNear = api => {
  const h = api.humans()[0];
  for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
    const t = api.hasTile(h.x + dx, h.y + dy, 0) ? api.tileAt(h.x + dx, h.y + dy, 0) : null;
    if (t && t.fire === 0 && (t.feature === 'tree' || t.ground === 'grass')) return t;
  }
  return null;
};
test('a fire lit through the door between two moves is not jumped over', t => {
  const api0 = load(), start = NIGHT(api0), at = start + 130;
  const god = () => { let done = false;
    const g = api => {
      if (done || api.tick < at) return;
      done = true;
      const t = burnableNear(api);
      assert.ok(t, 'nothing beside the sleeper would burn, so the case cannot be arranged');
      assert.match(String(api.inject({ source: 'player', act: 'light', x: t.x, y: t.y, z: 0 })), /burning|Lightning/);
    };
    g.wants = () => (done ? Infinity : at);
    return g;
  };
  const { a, b } = bothWays('r', start, 600, null, god);
  const after = b.jumps.filter(([f, to]) => f >= at && to <= at + 60);
  t.diagnostic(`lit at tick ${at}; jumps inside the minute after it: ${after.length}; ` +
    `sleeper awake: stepped ${!a.api.humans()[0].asleep}, skipped ${!b.api.humans()[0].asleep}`);
  assert.ok(b.jumps.length > 0, 'the engine never jumped at all, so this case did not run');
  assert.ok(a.api.fireCount > 0 || a.events.some(e => /burning/.test(e.text)), 'nothing caught, so the case did not run');
  assert.ok(b.api.pins.fire > 0, 'the horizon never once read the fire, so the pin is not what stopped the jumps');
  assert.equal(after.length, 0, 'the engine jumped through the minute after a tile was set alight');
  assert.equal(b.api.humans()[0].asleep, a.api.humans()[0].asleep);
  sameStory(a, b, 'a fire lit through the door');
});

test('a wolf that walks is on the tick anyway, so it cannot be jumped over at any distance', t => {
  const api0 = load(), at = NIGHT(api0), n = 600;
  const w = sleepingValley('r', at);
  w.api.SPECIES.wolf.perTick = true;
  const wolf = wolfAt(w.api, 60);
  wolf.task = null;
  skipOn(w, n, () => {});
  t.diagnostic(`a walking wolf at sixty tiles: ${w.jumps.length} jumps, ${w.api.moves} moves of ${n}, pins ${JSON.stringify(w.api.pins)}`);
  assert.ok(wolf.alive && wolf.task, 'the wolf never picked a task, so it was not walking');
  assert.equal(w.jumps.length, 0, 'the engine jumped while an awake animal was on the tick');
  assert.equal(w.api.moves, n, 'a walking being did not hold the engine to the tick');
});

/* ---------- the predicate the horizon reads ---------- */
/* THE SKIP READS `senseBeings`' PREDICATE AS ITS HORIZON, so what that predicate sees is task 4's
   business and not only task 3's. The list of rousers was built lazily inside the pass's own loop and
   invalidated there, so a sleeper the pass woke early joined a list built later and roused a being
   further down `beings`. It is built once now, before the loop, and the answer it gives is the state
   at the START of the tick.

   This is the only test in the suite that can tell the two apart. Measured, not assumed: put the lazy
   list back and the six seeds over three world days stay green, the soak's working record does not
   move, and every other file passes. A change nothing distinguishes is a change nobody can defend, so
   the arrangement is built by hand.

   A wolf asleep on a burning tile is woken by the fire, which needs no rouser. A rabbit within five
   tiles of it, later in `beings` and not acting, is then asked whether anything rouses it. Under the
   old list the wolf was already awake by then and the rabbit woke with it. Under the new one the wolf
   was asleep when the question was framed, so the rabbit sleeps -- and wakes on the NEXT tick, when
   the wolf is awake at the start of the pass. A waking is news a tick later, not in the same breath. */
test('a sleeper the pass wakes does not rouse its neighbour until the next tick', t => {
  const api = load();
  const c = collect(api);
  api.startWorld('r');
  /* THE VALLEY IS EMPTIED FIRST, and that is not tidiness. Under the old lazy list the divergence
     needs the FIRST being the pass wakes to be woken without asking for the list, which only fire
     does. Any other being that fails its fire check builds the list before then, and the list is
     stale in the harmless direction instead. So the three beings below are the whole population, and
     the arrangement is written down rather than hoped for. The gods stay: they are off the tick and
     the pass passes over them.
     A burning tile, a wolf five tiles from it, and a rabbit five tiles beyond the wolf and ten from
     the fire. The wolf is woken by the fire alone. The rabbit cannot see the fire at ten tiles, so the
     only thing that could rouse it is a wolf that was asleep when the pass began. */
  const keep = api.beings.filter(b => api.SPECIES[b.species].perTick === false);
  api.beings.splice(0, api.beings.length, ...keep);
  const y0 = 6;
  const wolf = api.makeBeing('wolf', 11, y0, null, 0);
  const rabbit = api.makeBeing('rabbit', 16, y0, null, 0);
  for (const b of [wolf, rabbit]){ b.z = 0; b.asleep = true; b.task = null; b.next = api.tick + api.CLOCK.every.body; b.seen = api.tick; }
  api.beings.push(wolf, rabbit);
  assert.ok(api.beings.indexOf(wolf) < api.beings.indexOf(rabbit), 'the wolf must be asked before the rabbit');
  assert.equal(api.near(wolf, rabbit), 5);
  const t0 = api.tileAt(6, y0, 0);
  assert.ok(t0, 'no tile at the place the fire was to be lit');
  assert.match(String(api.lightTile(6, y0, 0)), /burning/, 'the tile would not burn, so the case cannot be arranged');
  assert.equal(api.nearestFire(wolf.x, wolf.y, 5, 0) >= 0, true, 'the wolf cannot see the fire');
  assert.equal(api.nearestFire(rabbit.x, rabbit.y, 5, 0) >= 0, false, 'the rabbit can see the fire, so the case is decided by the fire');
  api.advance(api.tick + 1);
  t.diagnostic(`after one tick: wolf asleep ${wolf.asleep}, rabbit asleep ${rabbit.asleep}`);
  assert.equal(wolf.asleep, false, 'the fire did not wake the wolf, so the case did not run');
  assert.equal(rabbit.asleep, true, 'the rabbit was roused by a wolf that was asleep when the pass began');
  /* And on the next tick, with the wolf awake from the start, it is roused. */
  rabbit.next = api.tick + api.CLOCK.every.body; rabbit.asleep = true;
  api.advance(api.tick + 1);
  t.diagnostic(`after two ticks: rabbit asleep ${rabbit.asleep}`);
  assert.equal(rabbit.asleep, false, 'an awake wolf five tiles off never roused the rabbit, so the test proves nothing either way');
  c.check('the rousing order');
});

/* ---------- the long run ---------- */
/* Seventy world days on seed r, stepped and skipped. It is the only run here that meets a real valley
   over a real stretch: births, deaths, storms, a season's worth of plant growth. It costs two long
   runs and so it lives behind LONG=1, named with its day count and its flag rather than shortened. */
test('seventy world days on seed r tell the same story stepped and skipped',
  { skip: process.env.LONG ? false : 'suspended: 70 world days run twice. LONG=1 node --test tests/skip.js runs it' }, t => {
  const api0 = load(), n = 70 * api0.DAY;
  const t0 = Date.now();
  const a = stepOn(world('r'), n); const ts = Date.now() - t0;
  const t1 = Date.now();
  const b = skipOn(world('r'), n); const tj = Date.now() - t1;
  a.check('r stepped'); b.check('r skipped');
  t.diagnostic(`stepped ${(ts / 1000).toFixed(1)} s in ${a.api.moves} moves; skipped ${(tj / 1000).toFixed(1)} s in ${b.api.moves} moves of ${n} ticks`);
  t.diagnostic(`why the horizon was the next tick: ${JSON.stringify(b.api.pins)}`);
  sameStory(a, b, 'r over seventy days');
});
