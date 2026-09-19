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
  goalPriority = {};
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
  if (a.species === 'human'){ camp = a.camp; failTask(a); a.asleep = false; a.pokedUntil = tick + CLOCK.limit.poked; addThought(a, 'poked', 'Felt a nudge from above', 2, CLOCK.thought.poked); log(`${a.name} feels a nudge from above.`, [a]); chooseTask(a); return `${a.name} looks up, then ${a.lastChoice && a.lastChoice.picked ? `goes to ${a.lastChoice.picked}` : 'gets to it'}.`; }
  failTask(a); a.asleep = false; a.task = null; START.flee(a) || START.wander(a); log(`The ${SPECIES[a.species].label} startles at a nudge from above.`); return `The ${SPECIES[a.species].label} startles.`;
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
/* In the gods era a step is an age. In the days era it is a tick. A species with perTick false is not
   stepped by the tick: the gods keep their own clock. */
function step(){
  if (era === 'gods') return ageStep();
  tick++; updateWorld(); camp = camps[0];
  for (const a of beings) if (a.alive && SPECIES[a.species].perTick !== false) updateBeing(a);
  if (tick % CLOCK.every.prune === 0) beings = beings.filter(b => b.alive || b.species === 'human' || SPECIES[b.species].perTick === false);
}
