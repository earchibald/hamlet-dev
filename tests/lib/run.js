// Shared test runner. Loads the sim in Node, runs it for a number of days
// with a script god, and keeps every chronicle line, not only the last 300.
const { load } = require('../../src/sim');
/* The day comes from the sim and is never written down here. A second copy of a constant in a test
   is not a check on the first: it agrees with whatever it was last set to, and when the real one
   moves the test keeps measuring the old world while still reporting in days. This file held
   `const DAY = 1000` and plan G4 made the day 86,400, so every test that asked for seventy days
   would quietly have run for a fifth of one. */
const DAY = load().DAY;

/* The script god lights each camp's pit once, the first time it stands laid
   and cold, through the door, so the run leaves a log. A founding party carries
   coals, so its pit is lit on its own; the god steps in only after the coals
   value (a tick) has passed. The loop index is compared, as the first soak did,
   so old numbers still line up. */
function scriptGod(api, i){
  for (const c of api.camps) if (c.pit && !c.everLit && c.coals <= i) api.inject({ source: 'player', act: 'light', x: c.pit[0], y: c.pit[1], z: 0 });
}
/* THE EARLIEST TICK THIS GOD MIGHT ACT ON, so the engine does not jump past it. A god is an outside
   actor, and its act must land on the tick it would have landed on stepping, or a skipped run and a
   stepped run tell two stories and the skip is blamed for it. The loop index `i` is `api.tick - off`,
   so a threshold on `i` of `c.coals` is a threshold on the tick of `off + c.coals`. The other half of
   the condition -- a pit that stands laid and cold -- becomes true on a tick a being acted, and the
   engine holds the tick after an act, so `runOn` is handed control there anyway. */
scriptGod.wants = (api, off) => { let t = Infinity; for (const c of api.camps) if (c.pit && !c.everLit) t = Math.min(t, off + c.coals); return t; };
/* A god that replays a log: every event goes through the door at its own tick, in order, and nothing
   else happens. The door refuses an event that arrives at the wrong tick, so an event this god has
   let slip past is an error here, never a silent drop. A `load` entry is passed over: it carries no
   snapshot of its own, and a replay tells the saved world's story by stepping through, not by loading. */
function logGod(log){
  let k = 0;
  const god = api => { while (k < log.length && log[k].tick <= api.tick){ const e = log[k++]; if (e.act === 'load') continue; if (e.tick < api.tick) throw new Error(`replay fell behind: event for tick ${e.tick} reached at tick ${api.tick}`); api.inject(e); } };
  /* The next logged tick, so the engine does not jump past it. Without this the replay throws its own
     "fell behind" error on the first jump, which reads as a fault in the door and is not one. */
  god.wants = () => (k < log.length ? log[k].tick : Infinity);
  return god;
}
/* A god built from a replay record ({ seed, options, log }): replays its log. Meant to be used with
   runDays(replay.seed, days, onTick, replayGod(replay), replay.options), so a seed, its options,
   and its log replay the same story. */
function replayGod(replay){
  return logGod(replay.log);
}

/* The event collector. The chronicle keeps only its last 300 lines, so a run that wants them all must
   take each line as it appears. This used to scrape the chronicle after each step, which held only
   while a step was small enough that 300 lines could not be written inside one. Two callers broke
   that: `runDays` built the collector after `startWorld`, so a long creation was already trimmed
   before anything watched (seed `sweep23` wrote 965 lines and kept 300), and a step that covers a
   span rather than a tick can write past 300 between two looks.

   So the engine hands each line over as it is written. `collect` points the sink at its own array,
   and `from` is what had been written already. `check()` proves the collector missed nothing, and
   that it did not start late: both are silent failures otherwise, because a short chronicle
   fingerprints cleanly and reports itself as a pass. */
function collect(api){
  const events = [];
  const from = api.watchChronicle(events);
  const check = (why = '') => {
    const owed = api.chronicleWritten - from;
    if (events.length !== owed) throw new Error(`the collector holds ${events.length} lines and ${owed} were written${(why ? ` (${why})` : '')}`);
  };
  return { events, from, check };
}
/* Step a world on. The loop index starts at `fromStep`, not at 0, so a world that carries on from a
   snapshot gives the script god the same numbers an unbroken run gives it.

   THIS IS `runTo`'S OWN LOOP WITH THE GOD FOLDED INTO THE HORIZON. The engine's `runTo(t)` jumps from
   one horizon to the next and hands nothing back in between, which is right for the page and wrong
   here: a god is an outside actor and it must be asked on every tick the engine visits, or its act
   lands late and the skipped run tells another story. So the loop asks `nextEvent()` for the horizon,
   brings it forward to the god's own earliest tick, and makes the one move with `advance`. A god with
   no `wants` is asked only at the horizon, which is the right answer for a god that watches the world
   rather than the clock.

   `off` turns a tick into the loop index the god expects: `i = api.tick - off`. A step of one tick
   from `fromStep` gives `i = fromStep`, which is what the old loop gave it.

   `onTick` is called at each visited tick too, for the same reason: the soak samples the world with
   it, and a sample that fires only at a horizon is a sample nobody chose. */
function runOn(api, fromStep, steps, collector, god = scriptGod, onTick){
  const end = api.tick + steps, off = api.tick - fromStep + 1;
  while (api.tick < end){
    let to = Math.min(api.nextEvent(), end);
    if (god && god.wants){ const w = god.wants(api, off); if (w > api.tick && w < to) to = w; }
    api.advance(to);
    const i = api.tick - off;
    god(api, i);
    if (onTick) onTick(api, i, collector.events);
  }
  return collector;
}

/* Run one seed. Returns the api and the full list of chronicle events in order. */
function runDays(seed, days, onTick, god = scriptGod, opts = {}){
  /* The collector goes on before the world does. The creation is logged inside `startWorld`, and on
     a seed with a long one it is longer than the chronicle keeps. */
  const api = load();
  const c = collect(api);
  api.startWorld(seed, opts);
  const n = days * DAY;
  runOn(api, 0, n, c, god, onTick);
  /* Both silent failures, and both look like a pass: a short chronicle fingerprints cleanly. */
  if (c.from !== 0) throw new Error(`seed ${seed}: the creation was logged before the collector watched (${c.from} lines)`);
  c.check(`seed ${seed}`);
  return { api, events: c.events };
}

/* ---------- setting the clock ----------
   Ruling 8 of plan G4, in the user's words: "we can set the date directly if we need to." A test may
   jump the world to a date rather than pay the days to reach it. This is the one function that does
   it. It lives here and never in `src/sim/`, because a rule reachable only through a back door in the
   product is a rule the product can lose without a sound.

   It writes the world's tick, and it moves every accrual marker with it. An accrual marker is a tick
   on a record whose gap to the present is multiplied into a quantity, so a marker left in the past
   charges or credits the whole jump. There are two, and both are task 3's:

     `b.seen`     the tick a being's body was last brought up to. Left behind, a clock shoved ten days
                  forward charges every being ten days of hunger it was never alive for, and a wolf
                  sent to midday arrives starving.
     `t.worked`   the tick a job last had work put into it. Left behind, a jump of one world hour put
                  3,600 ticks of work into a snare nobody touched, and a jump of a world day finished
                  the job. Measured twice in the task 3 review, and the reason this function was
                  corrected.

   Nothing else moves, and nothing accrues across a jump: no hunger, no work, no fuel burnt, no plant
   grown. A deadline already set is left where it is and so expires — a cooldown, a thought's `until`,
   a wait, a storm's end — which is what an arrived world would also have done. A gap read as a
   threshold is left alone for the same reason: a jump longer than `CLOCK.limit.task` abandons a held
   task and a jump past `CLOCK.limit.hurtRemembered` forgets a wound, exactly as the days would have.

   `tests/setclock.js` holds both halves. It also keeps an inventory of every elapsed gap the rules
   read, so a rule that adds a new one goes red there and its task must say which kind it is. `worked`
   reached the branch with nobody asked, which is the reason the inventory exists.

   A test that uses this proves a rule runs at that date. It does not prove the date is reachable by
   playing, and the suite owes a run that arrives by simulating. See the plan's "What ruling 8
   obliges". */
function setClock(api, at){
  api.tick = at;
  for (const b of api.beings){
    b.seen = at;
    if (b.task && b.task.worked !== undefined) b.task.worked = at;
  }
  return at;
}

const OLD_AGE = /died of old age|old and warm/;
const DEN_DEATH = /was killed in a den by/;
const deaths = events => events.filter(e => e.kind === 'death');
const oddDeaths = events => deaths(events).filter(e => !OLD_AGE.test(e.text) && !DEN_DEATH.test(e.text)).map(e => e.text);
const denDeaths = events => deaths(events).filter(e => DEN_DEATH.test(e.text)).map(e => e.text);
const gnomeDeaths = events => deaths(events).filter(e => e.text.startsWith('A gnome ')).map(e => e.text);

/* The numbers the soak watches. Same names as the first soak script. */
function countEvents(api, events){
  const ev = k => events.filter(e => e.text.includes(k)).length;
  const alive = sp => api.beings.filter(b => b.alive && b.species === sp).length;
  const hs = api.beings.filter(b => b.species === 'human');
  const byCause = {}; for (const e of deaths(events)){ const k = e.text.replace(/^\w+ /, '').replace(/\.$/, ''); byCause[k] = (byCause[k] || 0) + 1; }
  return {
    storms: ev('storm rolls') + ev('Sleet'), strikes: ev('Lightning strikes') - ev('Lightning strikes the pit'), embers: ev('sets the ember'), sparks: ev('coaxes a spark'),
    wolfRaids: ev('wolf slips'), mauled: ev('mauls'), drivenOff: ev('chases the wolf'),
    seen: api.camps.filter(c => c.fae.known).length, favor: api.camps.map(c => c.fae.favor), gifts: ev('are gone by morning'),
    moss: ev('glowing moss lies') + ev('blows. The fire'), pranks: ev('tiny footprints') + ev('pinch marks') + ev('pinched out'),
    stolen: ev('is gone from the stash'), cordGifts: ev('coil of cord lies'),
    fights: ev('spears a sprite') + ev('flees') + ev('turns and fights'), sprites: alive('sprite'), stones: api.camps.filter(c => c.stone).length,
    wards: api.camps.filter(c => c.ward).length, groveAnger: api.groves.map(g => g.anger),
    born: ev(' is born to '), oldAge: ev('old age') + ev('old and warm'), taught: ev('learned '),
    huts: api.camps.reduce((n, c) => n + c.huts.length, 0), storehouses: api.camps.filter(c => c.storehouse).length, villages: api.camps.filter(c => c.village).length,
    deerSpeared: ev('brings down a deer'), deerByWolves: ev('was caught by a wolf'), deer: alive('deer'), wolves: alive('wolf'), rabbits: alive('rabbit'),
    spoiled: ev('gone off'), caught: ev('caught in a snare'), fished: api.camps.reduce((n, c) => n + (c.fished || 0), 0), froze: ev('froze'),
    pitted: ev('falls into the pit'),
    workshops: api.camps.filter(c => c.workshop).length, kilns: api.camps.filter(c => c.kiln).length, gardens: api.camps.filter(c => c.garden).length,
    baskets: api.camps.filter(c => c.tools.basket).length, rods: api.camps.filter(c => c.tools.rod).length,
    clothed: api.beings.filter(b => b.alive && b.species === 'human' && b.clothes).length,
    pots: api.camps.reduce((n, c) => n + (c.stash.pot || 0), 0), quarried: ev('quarries two rocks'),
    pups: ev('is born in the den') + ev('kits are born'), dragged: ev('drags its kill'),
    deaths: byCause, alive: hs.filter(h => h.alive).length, humans: hs.length, camps: api.camps.length,
    campsThatSawGnomes: api.camps.filter(c => c.gnomes.known).length, gnomes: api.beings.filter(b => b.alive && b.species === 'gnome').length,
    gnomeDeaths: gnomeDeaths(events).length,
    borrowed: ev('Small footprints lead'), repaid: ev('Neighbours, then'),
    benches: api.caves.filter(c => c.kind === 'burrow' && c.bench).length,
    holding: api.caves.filter(c => c.kind === 'burrow' && c.holding).length,
    gnomesLeft: ev('holes are empty'),
    searched: ev('goes into the dark'), finds: ev('firestones by the pit') + ev('old bones up'),
    densCleared: ev('drive the wolves') + ev('drive the foxes'), densBack: ev('back in the den'),
  };
}

function fnv(s){ let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
/* A short record of the whole run. If any rule changes, this changes. */
function fingerprint(api, events){
  return {
    tick: api.tick, chronicleLines: events.length,
    chronicle: fnv(events.map(e => `${e.tick}|${e.kind}|${e.text}`).join('\n')),
    beings: fnv(api.beings.map(b => `${b.id}|${b.species}|${b.alive ? 1 : 0}|${b.x},${b.y},${b.z}|${b.camp ? b.camp.id : ''}`).join('\n')),
    items: fnv(api.items.map(i => `${i.id}|${i.kind}|${i.x},${i.y},${i.z}`).join('\n')),
    legends: fnv(api.legends.map(e => `${e.age}|${e.kind}|${e.text}`).join('\n')),
    tiles: tileHash(api),
  };
}

/* What a tile IS, over every level in order: the ground, what stands on it, its berries, its fire,
   and its structure's type, fuel and lit flag. Nothing else in the fingerprint reads the map, so a
   change confined to tiles was invisible to the record: a lightning fire that burned twenty world
   days instead of a quarter of one moved no being and no item, and the golden did not stir (issue
   74). A null is an unmade tile off the surface and keeps its place in the order. */
function tileHash(api){
  const rows = [];
  for (const level of api.levels){
    for (const t of level){
      rows.push(t ? `${t.ground}|${t.feature || ''}|${t.berries}|${t.fire}|${t.struct ? `${t.struct.type},${t.struct.fuel},${t.struct.lit ? 1 : 0}` : ''}` : '');
    }
  }
  return fnv(rows.join('\n'));
}

/* Living humans, and every den, water cave, and burrow, that cannot be walked to from the first
   camp's stash. Checked once a day by the soak: one full-map search per camp. A person who is cut
   off starves or dies of thirst in a pocket; a cave nobody can reach is a bug in the terrain the
   same as a person who is. Abandoned caves are skipped: nothing needs to reach them any more. */
function cutOff(api){
  const out = [];
  for (const c of api.camps){
    if (!c.stashTile) continue;
    const region = api.reachable(c.stashTile[0], c.stashTile[1], 0, api.levels.length * api.world.length);
    for (const h of api.beings) if (h.alive && h.species === 'human' && h.camp === c && !region.has(api.idx3(h.x, h.y, h.z))) out.push(`${h.name} at ${h.x},${h.y},${h.z} on day ${api.dayOf()}, ${api.seasonOf()}, cut off from ${c.name}`);
  }
  const first = api.camps[0];
  if (first && first.stashTile){
    const region = api.reachable(first.stashTile[0], first.stashTile[1], 0, api.levels.length * api.world.length);
    for (const cave of api.caves){
      if (cave.abandoned || !cave.exit || !['den', 'water', 'burrow'].includes(cave.kind)) continue;
      if (!region.has(api.idx3(cave.exit.x, cave.exit.y, cave.exit.z))) out.push(`${cave.kind} cave at ${cave.exit.x},${cave.exit.y},${cave.exit.z} on day ${api.dayOf()}, ${api.seasonOf()}, cut off from ${first.name}`);
    }
  }
  return out;
}

const campLine = (api, c) => `${c.name}: site ${!!c.site} pit ${!!c.pit} lit ${c.everLit} members ${api.beings.filter(h => h.species === 'human' && h.alive && h.camp === c).length} food ${c.stash.berries + c.stash.cooked + c.stash.smoked}`;

module.exports = { DAY, setClock, runDays, collect, runOn, scriptGod, logGod, replayGod, countEvents, fingerprint, deaths, oddDeaths, denDeaths, gnomeDeaths, cutOff, campLine, OLD_AGE };
