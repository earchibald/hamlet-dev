/* ---------- start, tick, and god actions ---------- */
/* Everything a fresh world needs before either era begins. The draw order here is the old startWorld's,
   so the golden record holds. */
function resetState(seed, opts){
  setOptions(opts); allocSearch();
  seedText = String(seed); rng = mulberry32(hashSeed(seedText));
  tick = Math.round(CLOCK.startsAt); nextId = 1; fireCount = 0;
  chronicle = []; beings = []; corpses = []; resCache = new Map(); namePool = shuffle(NAMES);
  seedNames();
  camps = []; camp = makeCamp('The first camp'); weather = { storm: false, until: 0, next: CLOCK.storm.first + rint(CLOCK.storm.firstSpread) };
  goalPriority = {}; wanderAt = 0; doomAt = 0; resetBeats(); resetPins();
  resetDoor();
  era = 'days'; age = 0; pulseAge = null; godRng = null; legends = []; creation = null; field = null; boundaries = [];
}
/* Every world begins with its creation. The ages run to settle, and settle paints the valley and opens the days. */
function startWorld(seed, opts = {}){
  resetState(seed, opts);
  beginCreation();
  runAges();
}

/* ---------- god actions ---------- */
function lightTile(x, y, z = 0){
  const t = hasTile(x, y, z) ? tileAt(x, y, z) : null;
  if (!t) return z > 0 ? 'Nothing here but air.' : 'Solid earth. Nothing will burn in it.';
  if (t.struct && t.struct.type === 'firepit'){
    const p = t.struct; camp = camps.find(c => c.pit && c.pit[0] === x && c.pit[1] === y) || camp;
    if (p.lit) return 'The fire is already burning.';
    if (p.fuel <= 0) return 'The pit is empty. It needs wood laid in it first.';
    p.lit = true; if (!camp.everLit){ camp.everLit = true; log('Lightning strikes the pit. The wood catches, and the camp has a hearth.', campHumans(), 'major'); camp.nextArrival = tick + CLOCK.arrival.first + rint(CLOCK.arrival.firstSpread); }
    else log('Lightning strikes the pit again. The fire is lit.', [], 'good');
    for (const h of campHumans()) addThought(h, 'hearth', 'The fire is lit', 8, CLOCK.thought.hearth);
    return 'The fire pit is lit.';
  }
  if (t.fire > 0) return 'It is already burning.';
  if (!ignite(t)) return 'Nothing here will burn.';
  t.fire = Math.max(t.fire, CLOCK.fire.strikeFuel);
  log(`Lightning strikes ${t.feature === 'tree' ? 'a pine' : 'the ground'}${t.z > 0 ? ' on the hill' : ''}. Something is burning.`, humans().filter(h => nearAt(h, t.x, t.y, t.z) <= 40), 'bad', 'fire');
  return 'Lightning. Something is burning, and it will smoulder a while.';
}
function poke(a){
  if (!a.alive) return 'Nothing stirs.';
  /* A sleeping god is a being in the list like any other, and a nudge would startle it awake and set it wandering.
     What wakes a god is its own rule, and it is not built yet (the spec's section 5). Until then the door refuses. */
  if (a.species === 'god') return `${a.name} sleeps on, ${a.epithet}. A nudge from above does not wake a god.`;
  /* A nudge that wakes a sleeper changes which way rest runs, so the body is brought up to date on this tick before the flag turns. */
  catchUp(a); if (!a.alive) return `${a.name} does not stir.`;
  if (a.species === 'human'){ camp = a.camp; failTask(a); a.asleep = false; a.pokedUntil = tick + CLOCK.limit.poked; addThought(a, 'poked', 'Felt a nudge from above', 2, CLOCK.thought.poked); log(`${a.name} feels a nudge from above.`, [a]); chooseTask(a); return `${a.name} looks up, then ${a.lastChoice && a.lastChoice.picked ? `goes to ${a.lastChoice.picked}` : 'gets to it'}.`; }
  failTask(a); a.asleep = false; a.task = null; startTask(a, 'flee') || startTask(a, 'wander'); log(`The ${SPECIES[a.species].label} startles at a nudge from above.`); return `The ${SPECIES[a.species].label} startles.`;
}

/* One tick of the world, in this order. The order fixes the random number stream, so do not reorder it. */
function updateWorld(){
  spreadFire();
  updateWeather();
  updateCamps();
  growPlants();
  strayLightning();
  rotCarcasses();
  groveTick();
  denTick();
  gnomeTick();
  spawnWildlife();
  godsTick();
}
/* In the gods era a step is an age, or with `oneAct` one god of it. In the days era it is a tick, and
   `oneAct` means nothing there. A species with perTick false is not stepped by the tick: the gods
   keep their own clock. The engine will not step while a turn is open: the world waits on the player,
   which is the locked clock. The flag is forwarded rather than reached past, so that guard stays the
   one gate into a step. */
function step(oneAct){
  if (pending) return 'The turn is yours.';
  if (era === 'gods') return ageStep(oneAct);
  advance(tick + CLOCK.every.next);
}
/* One move of the days era. `to` is the tick the world arrives at, and it may be many ticks ahead: a
   step is `advance` of the next tick and a jump is `advance` of a further tick `nextEvent` named.
   (Written in words rather than in code, because the lint in `tests/clock.js` reads a comment as a rule
   and `CLOCK.every.next` is the constant a rule must use. The soak's lint strips comment spans; this
   one does not, and widening it is task 11's, so the comment gives way instead.) Everything below
   is the old body of `step`, and the only change is that `tick` is assigned rather than incremented.
   Nothing here loops over the ticks between, because nothing here is owed them: the systems that run
   on a beat are on a beat, a camp's pit burns by elapsed time, and a being's body is computed from
   `a.seen`. A rule that still needed the ticks in between would be a rule `nextEvent` must name, and
   `tests/skip.js` is what says whether one was missed. */
function advance(to){
  tick = to; updateWorld(); camp = camps[0];
  /* Danger first, on every tick, for the beings that are not acting on this one. It only brings an act
     forward; the act itself is below. See `senseBeings` in beings.js. */
  senseBeings();
  /* A being acts on the tick it named, and not on every tick. `updateBeing` brings its body up to date
     before it does anything, so a being skipped for a minute of world time is a being whose day is
     computed rather than stepped, not one whose day did not happen. */
  for (const a of beings){
    if (!a.alive || SPECIES[a.species].perTick === false || a.next > tick) continue;
    updateBeing(a);
    acted = tick;
    /* `nextAct` and the body beat are both at least one tick, so the soonest next act is the next
       tick and no floor is needed here. */
    if (a.alive) a.next = tick + Math.min(CLOCK.every.body, nextAct(a));
  }
  if (tick % CLOCK.every.prune === 0) beings = beings.filter(b => b.alive || b.species === 'human' || SPECIES[b.species].perTick === false);
  moves++;
}

/* ---------- the skip ----------
   Ruling 2: a world second must cost what happens in it and not what it spans. Task 2 put every
   system on a named beat and task 3 gave every being the tick of its next act, so the engine can now
   name the next tick at which anything at all happens and arrive there in one move.

   `nextEvent()` is that tick. It is never this tick and never further off than the world's own beat.
   It reads no wall clock, draws no random number, and changes nothing, so calling it is free of the
   stream: a run that asks for the horizon and a run that does not tell the same story.

   THE WORLD'S BEAT IS THE CEILING ON A JUMP, and it is deliberate. Every system that reads the world
   rather than a being runs on a multiple of `CLOCK.every.cellular`, one world minute: the six
   cellular systems, the camp beat that burns the pit, the spoil and fae and prune and carcass
   periods, the spawn periods, the den and grove and gnome periods, the nightly naming pass, and every
   calendar break a rule reads (dawn at 06:00, dusk at 20:00, the turn of a day and with it the turn
   of a season). So the next multiple of the beat is a horizon that covers all of them at once, and
   `tests/skip.js` holds the list to it: a period that is not a multiple of the beat goes red there
   rather than becoming a missed event nobody can see.

   That is why the pit's out-tick needs no entry of its own, and the reason is worth writing down
   because the plan expected one. It is arithmetic and not a stored tick — `fuel / (rate x
   modifiers)` — which makes it the kind that gets left out. Task 2 put the pit's burn on the camp
   beat, so the fuel falls in whole beats and the fire goes out ON a beat. The horizon reaches every
   beat, so it reaches that one. Should the burn ever leave the beat, this is the entry to add, and
   the adversarial case for it is already in `tests/skip.js`.

   THREE KINDS OF ENTRY BESIDE THE BEAT.

   A being's next act. `a.next` is the tick it named for itself. Nothing the world does moves a being
   between two of its acts, so a jump from one to the next passes over nothing.

   A tick stored on a camp, a den or the valley that a rule reads EVERY tick rather than on a beat.
   These are the four `updateCamps` and `denTick` read outside their own periods, and each writes a
   chronicle line on the tick it fires, so a jump that lands past one puts that line at the wrong tick
   and the fingerprint says so. They are listed one by one below.

   The next tick after a being acted. A being's act changes what the world's own rules read on the
   tick after it — a storehouse finished, a pit laid, a person dead, a hearth lit — and `updateCamps`
   runs before the beings within a tick, so it sees the change one tick later. Holding the tick after
   an act is the cheap and honest answer: a walking being acts every tick and pays nothing for it,
   and a sleeping valley has no acts to hold. Refining it would mean naming which fields of a camp a
   given act can touch, which is a list that rots.

   And the hazard precondition of ruling 6. `senseBeings` records the tick it last found a hazard
   beside a being that was not acting, and the engine steps away from that tick rather than jumping.
   The pass has already answered the question, so the pin costs nothing to read.

   THE COUNTERS ARE A MEASUREMENT AND NOT A RULE. `pins` counts, for every horizon asked for, why the
   answer was the next tick. It is split by cause, because a two-way split that quietly absorbs a third
   case is what makes a permanent cost read as an episodic one: a camp's fire burns every night of the
   world's life, while a wolf near a sleeper is an evening. `both` is its own bucket rather than being
   folded into either, and `none` is the bucket for a cause this file does not name.

   `none` WAS UNREACHABLE AND IS NOW REACHABLE, and the difference is one line in `senseBeings`. That
   line read `pinMask |= cause === 'fire' ? 1 : 2`, so every cause but fire was a hunter, `pinMask` was
   never 0 once the pass had pinned, and `none` was a constant rather than a count. The task 4 review
   proved it by relabelling the rouser branch's cause in a throwaway copy and getting byte-identical
   counters. The pass now sets bit 4 for a cause it does not name, and `pinBucket` sends every mask
   carrying bit 4 to `none`, so the guard the plan asked for is a count and not a claim.

   Nothing here draws a random number or changes an answer, and the predicate behind the fire and
   hunter buckets was answered by `senseBeings` for its own reasons, so counting it is free. `pins` and
   the four `let`s below are in NOT_SAVED beside `chronicleWritten`. */
let acted = -1;                 // the last tick on which a being acted
let moves = 0;                  // moves made, stepped or jumped, since the world began. `steps` is taken, in path.js.
let pinAt = -1, pinMask = 0;    // the last tick `senseBeings` found a hazard, and which kinds it found
/* `asked` is how many horizons were asked for, and `next` how many of those were the next tick --
   the pinned share is `next / asked`. The other eight are causes, one bucket each, and they sum to
   `asked`: `fire`, `hunter` and `both` are ruling 6's pass, `none` is a pin that pass made for a cause
   this file does not name, `acted` is the tick after a being acted, and `being`, `stored` and `beat`
   are which kind of entry won the horizon. `none` is zero today because the pass names both of the
   causes it can find; a count in it is news and not a fault. */
const pins = { asked: 0, next: 0, fire: 0, hunter: 0, both: 0, none: 0, acted: 0, being: 0, stored: 0, beat: 0 };
/* Which bucket a hazard mask belongs in. Bit 1 is fire, bit 2 is a hunter, and bit 4 is a cause
   `senseBeings` set without naming, so every mask that carries it -- 4, 5, 6, 7 -- is `none`. The
   mapping is a named function rather than a chain inside `nextEvent` so that a test can put a mask to
   it and read the answer, which is how `tests/skip.js` shows that `none` can be reached. */
function pinBucket(mask){
  if (mask & 4) return 'none';
  return mask === 1 ? 'fire' : mask === 2 ? 'hunter' : mask === 3 ? 'both' : 'none';
}
function resetPins(){ acted = -1; moves = 0; pinAt = -1; pinMask = 0; for (const k in pins) pins[k] = 0; }
function nextEvent(){
  pins.asked++;
  const beat = tick + CLOCK.every.cellular - (tick % CLOCK.every.cellular);
  /* The next tick, and why. The hazard is asked first because ruling 6 owns it; a being's act is
     asked second because it is this engine's own coupling and not the world's. */
  /* A BURNING TILE PINS THE HORIZON WHATEVER THE PASS FOUND, which is the plan's precondition read
     strictly and not the pass's answer read narrowly. The pass only looks at beings that are not
     acting, and a fire can be lit by something the pass never saw: `inject` at the door lights a tile
     between two moves, and the horizon was worked out before it. A stepped run shows that fire to a
     sleeper three tiles off on the next tick; a horizon that did not hear about it would show it a
     world minute later, and the two runs would differ over a fire the player lit. `fireCount` is a
     count the engine already keeps, so this is one integer read. Fire is episodic on these seeds --
     the soak's six hold no burning tile at all -- so it is not a standing cost. */
  if (fireCount > 0){ pins.fire++; pins.next++; return tick + CLOCK.every.next; }
  if (pinAt === tick){ pins[pinBucket(pinMask)]++; pins.next++; return tick + CLOCK.every.next; }
  if (acted === tick){ pins.acted++; pins.next++; return tick + CLOCK.every.next; }
  let t = beat, why = 'beat';
  const mark = (v, kind) => { if (typeof v === 'number' && v > tick && v < t){ t = v; why = kind; } };
  for (const a of beings){
    if (!a.alive || SPECIES[a.species].perTick === false) continue;
    if (a.next <= tick){ pins.being++; pins.next++; return tick + CLOCK.every.next; }
    mark(a.next, 'being');
  }
  /* `afterTheLast` and `theLoneFounder`, both read on every tick in `updateCamps`. */
  mark(wanderAt, 'stored'); mark(doomAt, 'stored');
  for (const c of camps){
    mark(c.nextArrival, 'stored');                             // a newcomer drawn by the smoke
    /* A hearth gone cold long enough to end a line, and long enough for the beasts to come home.
       `outSince` is written on any tick, so neither of these lands on the beat. */
    if (c.outSince){ mark(c.outSince + CLOCK.arrival.afterTheDoomed, 'stored'); mark(c.outSince + CLOCK.den.campDark, 'stored'); }
  }
  /* A driven-out owner digging again. `denTick` reads both outside its own spring period. */
  for (const b of beings){
    if (!b.alive || !b.oldDen || b.den) continue;
    mark(b.oldDen.clearedAt + CLOCK.den.digAfter, 'stored'); mark(b.digAgain, 'stored');
  }
  pins[why]++; if (t === tick + CLOCK.every.next) pins.next++;
  return t;
}
/* Run the world to tick `t`, jumping over the ticks with nothing in them. It is what the tests, the
   soak and the page's faster rungs use.

   THIS IS THE ONLY COPY OF THE LOOP, and that is the fix the task 4 review asked for. It shipped with
   no caller: `tests/lib/run.js:runOn` held a second copy of the loop and `tests/skip.js:skipOn` a
   third, so the two loops under test were not the loop in the product. The review gutted this function
   to `return tick;` in a throwaway copy and every gate stayed green. Both harnesses call it now, so
   gutting it reds the soak, `tests/skip.js` and every suite that runs days.

   `atTick` is what a caller does at each tick the engine visits. A god is an outside actor and it must
   be asked on every visited tick, or its act lands late and a skipped run tells another story than a
   stepped one. `atTick.wants()` is the earliest tick that caller wants to be handed control at, and
   the horizon is brought forward to it; a caller with no `wants` is handed the horizon, which is the
   right answer for one that watches the world rather than the clock. A caller with no `atTick` at all
   -- the page's faster rungs -- runs from horizon to horizon and is handed nothing. An act itself
   still enters through `inject`, so the door's rule is untouched. */
function runTo(t, atTick){
  while (tick < t && !pending){
    let to = Math.min(nextEvent(), t);
    if (atTick && atTick.wants){ const w = atTick.wants(); if (w > tick && w < to) to = w; }
    advance(to);
    if (atTick) atTick();
  }
  return tick;
}
