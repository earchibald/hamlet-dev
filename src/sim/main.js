/* ---------- start, tick, and god actions ---------- */
function startWorld(seed){
  seedText = String(seed); rng = mulberry32(hashSeed(seedText));
  tick = Math.round(DAY * 7 / 24); nextId = 1; fireCount = 0;
  chronicle = []; beings = []; corpses = []; resCache = new Map(); namePool = shuffle(NAMES);
  camps = []; camp = makeCamp('The first camp'); weather = { storm: false, until: 0, next: 1500 + rint(2000) };
  goalPriority = {};
  generate();
  const a = beings[0];
  log(`${a.name} walks alone into the ${sectorOfTile(tileAt(a.x, a.y)).name.toLowerCase()} with nothing but two hands.`, [a], 'major');
}

/* ---------- god actions ---------- */
function lightTile(x, y, z = 0){
  const t = hasTile(x, y, z) ? tileAt(x, y, z) : null;
  if (!t) return z > 0 ? 'Nothing here but air.' : 'Solid earth. Nothing will burn in it.';
  if (t.struct && t.struct.type === 'firepit'){
    const p = t.struct; camp = camps.find(c => c.pit && c.pit[0] === x && c.pit[1] === y) || camp;
    if (p.lit) return 'The fire is already burning.';
    if (p.fuel <= 0) return 'The pit is empty. It needs wood laid in it first.';
    p.lit = true; if (!camp.everLit){ camp.everLit = true; log('Fire from the sky. The pit catches, and the camp has a hearth.', campHumans(), 'major'); camp.nextArrival = tick + 700 + rint(600); }
    else log('The fire is lit again.', [], 'good');
    for (const h of campHumans()) addThought(h, 'hearth', 'The fire is lit', 8, 1000);
    return 'The fire pit is lit.';
  }
  if (tileFuel(t) <= 0) return 'Nothing here will burn.';
  t.fire = tileFuel(t); fireCount++; log('Fire falls from the sky onto open ground.', [], 'bad'); return 'The ground is burning. This fire is not contained.';
}
function poke(a){
  if (!a.alive) return 'Nothing stirs.';
  if (a.species === 'human'){ camp = a.camp; failTask(a); a.asleep = false; a.pokedUntil = tick + 400; addThought(a, 'poked', 'Felt a nudge from above', 2, 400); chooseTask(a); return `${a.name} looks up, then gets to it.`; }
  failTask(a); a.asleep = false; a.task = null; START.flee(a) || START.wander(a); return `The ${SPECIES[a.species].label} startles.`;
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
}
function step(){ tick++; updateWorld(); camp = camps[0]; for (const a of beings) if (a.alive) updateBeing(a); if (tick % 200 === 0) beings = beings.filter(b => b.alive || b.species === 'human'); }
