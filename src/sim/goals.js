/* Goal definitions. Each goal reports a state and offers work. */
const waterAim = () => 6 + 6 * (camp.stash.pot || 0);
/* One hide is held back for a hut while people sleep outside. The waterskin and clothes wait for the next one. */
function hideReserved(){
  if (!camp.shelter || camp.huts.length >= 4 || campHumans().length <= bedsFor()) return 0;
  return 1;
}
/* Kinds for the goals' one-place jobs. Offers carry { kind, args }; the kind's begin walks to args.at
   and works there, and the effect is the old done closure, word for word, reading camp state again
   rather than capturing it. */
/* begin returns a boolean, so a record is never set (startTask hands the true straight back); stops is never
   called, and holds one entry only so every kind in TASKS has a non-empty stops array. */
TASKS.chooseSite = { type: 'work', begin(a){ return chooseSite(a); }, stops: [() => 'done'] };
TASKS.buildFirepit = workKind({ label: 'Building the fire pit', amount: CLOCK.work.firepit, effect(a, args){
  if (camp.pit) return;
  const n = GOALS.find(g => g.id === 'firepit').need;
  camp.stash.rock -= n.rock; camp.stash.stick -= n.stick;
  const t = tileAt(...args.at); t.ground = 'soil'; t.feature = null; t.berries = 0;
  t.struct = { type: 'firepit', fuel: 200, lit: false };
  for (const [dx, dy] of RING){ const q = tileAt(t.x + dx, t.y + dy); if (q.ground === 'grass') q.ground = 'soil'; }
  camp.pit = [t.x, t.y]; gainXp(a, 'build');
  if (camp.coals > tick){ t.struct.lit = true; camp.everLit = true; camp.nextArrival = tick + CLOCK.arrival.secondHearth; log(`${a.name} finishes the fire pit and blows the carried coals to life. A second hearth burns.`, campHumans(), 'major'); }
  else log(`${a.name} finishes the fire pit and clears the grass around it. The wood is laid. It only needs a spark.`, [a], 'major');
  addThought(a, 'pit', 'Built a proper fire pit', 6, CLOCK.thought.pit);
} });
TASKS.feedFire = workKind({ label: 'Feeding the fire', amount: CLOCK.work.feedFire, effect(a, args){
  const p = pitTile().struct;
  if (!p.lit) return;
  if (camp.stash.log > 0 && p.fuel < PIT_MAX - LOG_FUEL + 20){ camp.stash.log--; p.fuel = Math.min(PIT_MAX, p.fuel + LOG_FUEL); }
  else if (camp.stash.stick > 0){ camp.stash.stick--; p.fuel = Math.min(PIT_MAX, p.fuel + STICK_FUEL); }
} });
TASKS.strikeSparks = workKind({ label: 'Striking sparks into the tinder', amount: CLOCK.work.strikeSparks, effect(a, args){
  const p = pitTile().struct;
  if (p.lit || p.fuel <= 0) return;
  if (rng() < 0.2 + a.skills.craft * 0.1 + a.traits.patience * 0.25){ p.lit = true; camp.everLit = true; log(`${a.name} coaxes a spark into flame. The fire is back.`, campHumans(), 'good'); for (const h of campHumans()) addThought(h, 'hearth', 'The fire is lit', 8, CLOCK.thought.hearth); gainXp(a, 'craft'); }
  else { addThought(a, 'sparks', 'Sparks, but no flame', -3, CLOCK.thought.sparks); a.cooldown['strike sparks'] = tick + CLOCK.cooldown.sparks; }
} });
TASKS.lightWithMoss = workKind({ label: 'Blowing on the glowing moss', amount: CLOCK.work.mossLight, effect(a, args){
  const p = pitTile().struct;
  if (p.lit || camp.stash.moss <= 0 || p.fuel <= 0) return;
  camp.stash.moss--; p.lit = true; camp.everLit = true;
  log(`${a.name} tucks the glowing moss into the pit and blows. The fire takes. No lightning, no sky.`, campHumans(), 'major');
  for (const h of campHumans()) addThought(h, 'hearth', 'The fire is lit', 8, CLOCK.thought.hearth);
} });
TASKS.layFire = workKind({ label: 'Laying the fire', amount: CLOCK.work.layFire, effect(a, args){
  const p = pitTile().struct;
  if (camp.stash.stick >= 4){ camp.stash.stick -= 4; p.fuel = 160; log(`${a.name} lays fresh wood in the pit.`, [a]); }
} });
TASKS.butcherDeer = workKind({ label: 'Butchering the deer', amount: CLOCK.work.butcherDeer, effect(a, args){
  if (camp.stash.venison <= 0) return;
  camp.stash.venison--; stashAdd('cooked', 5); stashAdd('hide', 2); if (camp.rack) stashAdd('smoked', 4); gainXp(a, 'cook');
  log(`${a.name} butchers the deer. Meat for days${camp.rack ? ', and strips on the rack' : ''}.`, campHumans(), 'good');
} });
TASKS.cookFish = workKind({ label: 'Cooking fish over the fire', amount: CLOCK.work.cookFish, effect(a, args){
  if (camp.stash.fish > 0){ stashTake('fish'); stashAdd('cooked', 2); gainXp(a, 'cook'); log(`${a.name} cooks a fish over the fire.`, [a], 'good'); }
} });
TASKS.cookCatch = workKind({ label: 'Cooking over the fire', amount: CLOCK.work.cookCatch, effect(a, args){
  if (camp.stash.carcass > 0){ camp.stash.carcass--; stashAdd('cooked', 3); stashAdd('hide', 1); gainXp(a, 'cook'); camp.bestCook = Math.max(camp.bestCook || 0, a.skills.cook); log(`${a.name} cooks a rabbit over the fire and keeps the hide.`, [a], 'good'); }
} });
TASKS.rearmSnare = workKind({ label: 'Re-arming the snare', amount: CLOCK.work.rearmSnare, effect(a, args){
  const st = tileAt(args.at[0], args.at[1]).struct, s = st && st.type === 'snare' ? st.snare : null;
  if (camp.stash.stick >= 1 && s && !s.armed){ camp.stash.stick--; s.armed = true; }
} });
TASKS.knapAxe = workKind({ label: 'Knapping an axe', amount: CLOCK.work.knapAxe, effect(a, args){
  if (camp.tools.axe || camp.stash.rock < 2) return;
  camp.stash.rock -= 2; camp.stash.stick--; camp.tools.axe = 1; gainXp(a, 'craft');
  log(`${a.name} strikes flakes off a rock until it holds an edge, then binds it to a stick. The camp has an axe.`, [a], 'major');
  addThought(a, 'axe', 'Made the first tool', 8, CLOCK.thought.axeMade);
} });
TASKS.testRocks = workKind({ label: 'Striking rocks together', amount: CLOCK.work.testRocks, effect(a, args){
  if (camp.tools.firestones) return;
  camp.stash.rock -= 3;
  if (rng() < 0.4 + a.traits.patience * 0.4){ camp.tools.firestones = 1; gainXp(a, 'craft'); log(`${a.name} finds two stones that throw sparks. The camp can make its own fire now.`, campHumans(), 'major'); }
  else addThought(a, 'dud', 'Struck rocks all afternoon for nothing', -2, CLOCK.thought.dud);
} });
TASKS.buildLeanTo = workKind({ label: 'Building the lean-to', amount: CLOCK.work.leanTo, effect(a, args){
  const n = GOALS.find(g => g.id === 'shelter').need;
  if (camp.shelter || camp.stash.log < n.log) return;
  camp.stash.log -= n.log; camp.stash.stick -= n.stick;
  const t = tileAt(...args.at); t.feature = null; t.struct = { type: 'leanto', camp }; camp.shelter = args.at;
  gainXp(a, 'build');
  log(`${a.name} raises a lean-to beside the fire. The camp has a roof.`, humans(), 'major');
  for (const h of humans()) addThought(h, 'roof', 'There is a roof to sleep under', 5, CLOCK.thought.roof);
} });
TASKS.raiseStorehouse = workKind({ label: 'Raising the storehouse', amount: CLOCK.work.storehouse, effect(a, args){
  const n = GOALS.find(g => g.id === 'storehouse').need;
  if (camp.storehouse || camp.stash.log < n.log) return;
  camp.stash.log -= n.log; camp.stash.stick -= n.stick;
  tileAt(...args.at).struct = { type: 'storehouse', camp }; camp.storehouse = args.at; gainXp(a, 'build');
  log(`${a.name} finishes a storehouse on stilts. The stash moves under a roof.`, campHumans(), 'major');
} });
TASKS.buildHut = workKind({ label: 'Building a hut', amount: CLOCK.work.hut, effect(a, args){
  const n = GOALS.find(g => g.id === 'huts').need;
  if (camp.stash.log < n.log || tileAt(...args.at).struct) return;
  camp.stash.log -= n.log; camp.stash.stick -= n.stick; camp.stash.hide -= n.hide;
  tileAt(...args.at).struct = { type: 'hut', camp }; camp.huts.push(args.at); gainXp(a, 'build');
  log(`${a.name} finishes a hut. ${bedsFor()} can sleep under a roof now.`, campHumans(), 'good');
} });
TASKS.setOfferingStone = workKind({ label: 'Setting the offering stone', amount: CLOCK.work.offeringStone, effect(a, args){
  if (camp.stone) return;
  camp.stash.rock -= 2; tileAt(...args.at).struct = { type: 'stone', camp, offering: 0 }; camp.stone = args.at;
  log(`${a.name} sets a flat stone at the edge of the firelight, for the sprites.`, campHumans(), 'good');
} });
TASKS.leaveBerries = workKind({ label: 'Leaving berries on the stone', amount: CLOCK.work.leaveBerries, effect(a, args){
  if (camp.stash.berries < 2) return;
  const st = tileAt(...args.at).struct; if (!st || st.type !== 'stone') return;
  stashTake('berries', 2); st.offering = 2; addThought(a, 'gift', 'Left a gift for the sprites', 3, CLOCK.thought.giftLeft);
} });
TASKS.setWardPosts = workKind({ label: 'Charring and setting ward posts', amount: CLOCK.work.wardPosts, effect(a, args){
  if (camp.ward) return;
  camp.stash.stick -= 6; tileAt(...args.at).struct = { type: 'ward', camp }; camp.ward = args.at; camp.fae.favor -= 10;
  log(`${a.name} sets charred posts around the camp. The sprites will keep their distance now.`, campHumans(), 'good');
} });
TASKS.sewWaterskin = workKind({ label: 'Sewing a waterskin', amount: CLOCK.work.waterskin, effect(a, args){
  if (camp.tools.waterskin || camp.stash.hide < 2 + hideReserved()) return;
  camp.stash.hide -= 2; camp.tools.waterskin = 1; gainXp(a, 'craft');
  log(`${a.name} sews two hides into a waterskin.`, [a], 'major');
} });
TASKS.makeSpear = workKind({ label: 'Shaping a spear', amount: CLOCK.work.spear, effect(a, args){
  if (camp.tools.spear) return;
  camp.stash.stick--; camp.stash.rock--; camp.tools.spear = 1; gainXp(a, 'craft');
  log(`${a.name} hardens a shaft in the fire and binds a flaked point to it. The camp has a spear.`, [a], 'major');
} });
TASKS.buildRack = workKind({ label: 'Building a drying rack', amount: CLOCK.work.rack, effect(a, args){
  if (camp.rack || camp.stash.stick < 6) return;
  camp.stash.stick -= 6; tileAt(...args.at).struct = { type: 'rack', camp }; camp.rack = args.at; gainXp(a, 'build');
  log(`${a.name} lashes sticks into a drying rack beside the fire.`, [a], 'good');
} });
TASKS.smokeMeat = workKind({ label: 'Smoking meat', amount: CLOCK.work.smokeMeat, effect(a, args){
  if (camp.stash.carcass < 1) return;
  stashTake('carcass'); stashAdd('smoked', 2); stashAdd('hide', 1); gainXp(a, 'cook');
  log(`${a.name} hangs strips of rabbit in the smoke. They will keep.`, [a]);
} });
TASKS.smokeFish = workKind({ label: 'Smoking fish', amount: CLOCK.work.smokeFish, effect(a, args){
  if (camp.stash.fish < 1) return;
  stashTake('fish'); stashAdd('smoked', 2); gainXp(a, 'cook');
  log(`${a.name} hangs a fish in the smoke. It will keep.`, [a]);
} });
/* The founding party: chooseTask's begin does what startFoundCamp did, then hands off to join. */
TASKS.leadParty = { type: 'travel', begin: a => startFoundCamp(a), stops: [() => 'done'] };
/* The den party: the mate check startClearDen always did, kept as a plain function, then the brand. */
TASKS.denParty = { type: 'guard', begin(a, args){ return startClearDen(a, caves[args.cave]); }, stops: [() => 'done'] };

const GOALS = [
  { id: 'camp', title: 'Make camp', stage: 'fire',
    state(){ return camp.site ? { s: 'done', text: `Site chosen: ${camp.siteReason || 'set by you'}.` } : { s: 'active', text: 'Nobody has picked a spot yet.' }; },
    offers(a){ return camp.site ? [] : [{ label: 'choose a camp site', score: 70, task: { kind: 'chooseSite', args: {} } }]; } },
  { id: 'firepit', title: 'Build a fire pit', stage: 'fire', after: 'camp', need: { rock: 6, stick: 8 },
    state(){
      if (!camp.site) return { s: 'blocked', text: 'Needs a camp site first.' };
      if (camp.pit) return { s: 'done', text: 'A ring of stones with the fire laid inside.' };
      const n = this.need; return { s: 'active', text: `Rocks ${Math.min(camp.stash.rock, n.rock)}/${n.rock}, sticks ${Math.min(camp.stash.stick, n.stick)}/${n.stick}. Loose ones only, nobody has tools yet.` };
    },
    offers(a){
      if (!camp.site || camp.pit) return [];
      const n = this.need, out = [];
      if (camp.stash.rock >= n.rock && camp.stash.stick >= n.stick) out.push({ label: 'build the fire pit', score: 60, task: { kind: 'buildFirepit', args: { at: camp.site } } });
      else {
        if (camp.stash.rock < n.rock) out.push({ label: 'gather rocks', score: 45, task: { kind: 'gather', args: { item: 'rock' } } });
        if (camp.stash.stick < n.stick) out.push({ label: 'gather sticks', score: 45, task: { kind: 'gather', args: { item: 'stick' } } });
      }
      return out;
    } },
  { id: 'fire', title: 'Keep the fire burning', stage: 'fire', after: 'firepit', standing: true,
    state(){
      const t = pitTile(); if (!t) return { s: 'blocked', text: 'There is no fire pit yet.' };
      const p = t.struct;
      if (p.lit) return { s: 'active', text: `Burning. Fuel ${Math.round(p.fuel / PIT_MAX * 100)}%. Woodpile: ${camp.stash.stick} sticks${camp.stash.log ? `, ${camp.stash.log} logs` : ''}.` };
      const blaze = nearbyBlaze();
      if (blaze && p.fuel > 0) return { s: 'active', text: 'Out, but something is burning nearby. Someone can fetch an ember.' };
      return { s: p.fuel > 0 || camp.stash.stick >= 4 ? 'active' : 'blocked', text: p.fuel > 0 ? 'Laid and ready. It needs fire: from you, or from a lightning strike nearby.' : 'Cold and empty. Sticks first, then fire.' };
    },
    offers(a){
      const t = pitTile(); if (!t) return []; const p = t.struct; const out = [];
      if (p.lit && p.fuel < PIT_MAX * 0.6 && (camp.stash.stick > 0 || camp.stash.log > 0)) out.push({ label: 'feed the fire', score: p.fuel < PIT_MAX * 0.25 ? 85 : 50, task: { kind: 'feedFire', args: { at: camp.pit } } });
      if (camp.stash.stick < 6) out.push({ label: 'gather sticks for the woodpile', score: camp.stash.stick === 0 ? 55 : 35, task: { kind: 'gather', args: { item: 'stick' } } });
      if (!p.lit && p.fuel > 0 && nearbyBlaze()) out.push({ label: 'fetch an ember from the blaze', score: 95, task: { kind: 'fetchEmber', args: {} } });
      if (!p.lit && p.fuel > 0 && camp.tools.firestones && !(a.cooldown['strike sparks'] > tick)) out.push({ label: 'strike sparks', score: 80, task: { kind: 'strikeSparks', args: { at: camp.pit } } });
      if (!p.lit && p.fuel > 0 && camp.stash.moss > 0) out.push({ label: 'light the pit with glowing moss', score: 92, task: { kind: 'lightWithMoss', args: { at: camp.pit } } });
      if (looseCount('moss')(sectors[secIdx(...Object.values(secOf(...camp.site)))]) > 0 || (camp.fae.favor >= 0 && groves.some(g => dist(g.x, g.y, ...camp.site) <= 40 && items.some(i => i.kind === 'moss' && i.z >= 0 && dist(i.x, i.y, g.x, g.y) <= 2)))) out.push({ label: 'gather glowing moss', score: camp.stash.moss === 0 ? 40 : 20, task: { kind: 'gather', args: { item: 'moss' } } });
      if (!p.lit && p.fuel <= 0 && camp.stash.stick >= 4) out.push({ label: 'lay the fire again', score: 60, task: { kind: 'layFire', args: { at: camp.pit } } });
      return out;
    } },
  { id: 'hearth', title: 'Keep the hearth three days without a break', stage: 'fire', after: 'fire',
    state(){
      if (!camp.everLit) return { s: 'blocked', text: 'Needs a lit fire first.' };
      if (camp.bestStreak >= CLOCK.limit.hearthProven) return { s: 'done', text: 'The hearth is established. People trust this place now.' };
      return { s: 'active', text: `Current run ${(camp.streak / DAY).toFixed(1)} days. Best ${(camp.bestStreak / DAY).toFixed(1)}. A steady hearth earns the time to make tools.` };
    } },
  { id: 'food', title: 'Stock food', stage: 'food', after: 'camp', standing: true,
    state(){ if (!camp.site) return { s: 'blocked', text: 'Needs a camp site first.' }; const t = foodTarget(); return { s: stashFood() >= t ? 'done' : 'active', text: `${camp.stash.berries} berries, ${camp.stash.cooked} cooked, ${camp.stash.smoked} smoked. Aim: ${t} meals${seasonOf() === 'autumn' ? ', more before winter' : isWinter() ? '. Bushes are bare in winter' : ''}. Fresh food spoils.${stashFood() >= t ? '' : ' Until the aim is met, no newcomer is taken in and no child is born here.'}` }; },
    offers(a){ if (!camp.site || stashFood() >= foodTarget()) return []; return [{ label: 'pick berries for the stash', score: stashFood() === 0 ? 50 : 38, task: { kind: 'pickBerries', args: {} } }]; } },
  { id: 'cook', title: 'Cook what we catch', stage: 'food', after: 'fire', standing: true,
    /* The state must count every kind of raw meat. A goal that is not active offers no work, so while
       this read the rabbit carcasses alone a speared deer lay uncut in the stash, and a camp starved
       in winter with nine meals waiting beside the fire. */
    state(){ if (!camp.everLit) return { s: 'blocked', text: 'Needs a lit fire.' };
      const raw = camp.stash.carcass + camp.stash.venison + camp.pitfalls.filter(p => p.catch).length;
      const waiting = [camp.stash.venison > 0 ? `${camp.stash.venison} deer` : '', camp.stash.carcass > 0 ? `${camp.stash.carcass} carcass` : ''].filter(Boolean).join(' and ');
      return { s: raw > 0 || camp.stash.fish > 0 ? 'active' : 'idle', text: raw > 0 || camp.stash.fish > 0 ? `${camp.stash.carcass} carcass and ${camp.stash.fish} fish waiting.` : 'Nothing to cook. Cooked meat is a better meal than berries.' }; },
    offers(a){ if (!pitLit()) return [];
      for (const p of camp.pitfalls) if (p.catch) return [{ label: 'haul the deer from the pit', score: 66, task: { kind: 'haulPit', args: { at: [p.x, p.y] } } }];
      if (camp.stash.venison > 0) return [{ label: 'butcher and cook the deer', score: 62, task: { kind: 'butcherDeer', args: { at: camp.pit } } }];
      if (camp.stash.fish > 0) return [{ label: 'cook the fish', score: camp.stash.fish >= 2 ? 62 : 45, task: { kind: 'cookFish', args: { at: camp.pit } } }];
      if (camp.stash.carcass <= 0) return []; return [{ label: 'cook the catch', score: camp.stash.cooked === 0 ? 55 : 35, task: { kind: 'cookCatch', args: { at: camp.pit } } }]; } },
  { id: 'snare', title: 'Set snares for rabbits', stage: 'food', after: 'fire', standing: true, max: 4,
    state(){
      if (!camp.everLit) return { s: 'blocked', text: 'People settle first. Needs a lit fire.' };
      const snares = camp.snares, c = snares.filter(s => s.catch).length, armed = snares.filter(s => s.armed).length;
      return { s: 'active', text: `${snares.length}/${this.max} set, ${armed} armed, ${c} with a catch. Each snare costs 3 sticks.` };
    },
    offers(a){
      if (!camp.everLit) return []; const out = [], snares = camp.snares;
      for (const s of snares){
        if (s.catch) out.push({ label: 'check the snare', score: 65, task: { kind: 'checkSnare', args: { at: [s.x, s.y] } } });
        else if (!s.armed && camp.stash.stick >= 1) out.push({ label: 're-arm the snare', score: 40, task: { kind: 'rearmSnare', args: { at: [s.x, s.y] } } });
      }
      if (snares.length < this.max && camp.stash.stick >= 3) out.push({ label: 'set a snare', score: 42, task: { kind: 'setSnare', args: {} } });
      else if (snares.length < this.max) out.push({ label: 'gather sticks for snares', score: 25, task: { kind: 'gather', args: { item: 'stick' } } });
      return out;
    } },
  { id: 'axe', title: 'Knap a stone axe', stage: 'tools', after: 'hearth',
    state(){
      if (camp.bestStreak < CLOCK.limit.hearthProven) return { s: 'blocked', text: 'Needs an established hearth. Two rocks struck together the right way make an edge.' };
      if (camp.tools.axe) return { s: 'done', text: 'A stone axe, hafted on a stick. Trees are firewood now.' };
      return { s: 'active', text: `Rocks ${Math.min(camp.stash.rock, 2)}/2, sticks ${Math.min(camp.stash.stick, 1)}/1 for the haft.` };
    },
    offers(a){
      if (camp.bestStreak < CLOCK.limit.hearthProven || camp.tools.axe) return [];
      if (camp.stash.rock >= 2 && camp.stash.stick >= 1) return [{ label: 'knap the axe', score: 58, task: { kind: 'knapAxe', args: { at: camp.stashTile } } }];
      const out = []; if (camp.stash.rock < 2) out.push({ label: 'gather rocks for the axe', score: 44, task: { kind: 'gather', args: { item: 'rock' } } }); if (camp.stash.stick < 1) out.push({ label: 'gather a stick for the haft', score: 44, task: { kind: 'gather', args: { item: 'stick' } } }); return out;
    } },
  { id: 'firestones', title: 'Find firestones', stage: 'tools', after: 'axe', need: { rock: 3 },
    state(){ if (!camp.tools.axe) return { s: 'blocked', text: 'Needs the knapping know-how that came with the axe.' }; if (camp.tools.firestones) return { s: 'done', text: 'Two stones that spark when struck. A cold pit is a chore now, not a prayer.' }; const cold = camp.pit && !pitLit(); return { s: 'active', text: `Rocks ${Math.min(camp.stash.rock, 3)}/3 to try. Striking sparks into tinder takes patience, and it fails more than it works.${cold ? ' The pit is dead and cold, so the camp puts this ahead of firewood.' : ''}` }; },
    offers(a){ if (!camp.tools.axe || camp.tools.firestones) return []; const cold = camp.pit && !pitLit() ? 40 : 0; if (camp.stash.rock < 3) return [{ label: 'gather rocks to find firestones', score: 36 + cold, task: { kind: 'gather', args: { item: 'rock' } } }]; return [{ label: 'test rocks for sparks', score: 44 + cold, task: { kind: 'testRocks', args: { at: camp.stashTile } } }]; } },
  { id: 'firewood', title: 'Cut firewood', stage: 'tools', after: 'axe', standing: true,
    state(){
      if (!camp.tools.axe) return { s: 'blocked', text: 'Needs the axe.' };
      return { s: 'active', text: `${camp.stash.log} logs in the woodpile. A log burns three times longer than a stick. Aim: 4.` };
    },
    offers(a){
      if (!camp.tools.axe) return []; const out = [];
      const cs = secOf(...camp.site), looseLogs = looseCount('log')(sectors[secIdx(cs.sx, cs.sy)]);
      if (looseLogs > 0 && camp.stash.log < 8) out.push({ label: 'haul logs to the woodpile', score: 46, task: { kind: 'gather', args: { item: 'log' } } });
      if (camp.stash.log + looseLogs < 4) out.push({ label: 'cut a tree for logs', score: 48, task: { kind: 'cutTree', args: {} } });
      return out;
    } },
  { id: 'shelter', title: 'Build a lean-to', stage: 'shelter', after: 'axe', need: { log: 4, stick: 10 },
    state(){
      if (!camp.tools.axe) return { s: 'blocked', text: 'Needs the axe, for logs.' };
      if (camp.shelter) return { s: 'done', text: 'A roof of logs and sticks beside the fire. Nobody sleeps on bare ground now.' };
      return { s: 'active', text: `Logs ${Math.min(camp.stash.log, 4)}/4, sticks ${Math.min(camp.stash.stick, 10)}/10.` };
    },
    offers(a){
      if (!camp.tools.axe || camp.shelter) return []; const n = this.need;
      if (camp.stash.log >= n.log && camp.stash.stick >= n.stick){
        const site = shelterSite(); if (!site) return [];
        return [{ label: 'build the lean-to', score: 56, task: { kind: 'buildLeanTo', args: { at: site } } }];
      }
      const out = []; if (camp.stash.stick < n.stick) out.push({ label: 'gather sticks for the lean-to', score: 40, task: { kind: 'gather', args: { item: 'stick' } } }); return out;
    } },
  { id: 'storehouse', title: 'Raise a storehouse', stage: 'shelter', after: 'axe', need: { log: 6, stick: 8 },
    state(){ if (!camp.tools.axe) return { s: 'blocked', text: 'Needs the axe, for logs.' }; if (camp.storehouse) return { s: 'done', text: 'Food on a raised floor, out of the damp and out of reach of wolves. It keeps twice as long.' }; return { s: 'active', text: `Logs ${Math.min(camp.stash.log, 6)}/6, sticks ${Math.min(camp.stash.stick, 8)}/8. Wolves cannot raid a storehouse.` }; },
    offers(a){ if (!camp.tools.axe || camp.storehouse || !camp.shelter) return []; const n = this.need; if (camp.stash.log >= n.log && camp.stash.stick >= n.stick){ const site = openSpotNear(camp.pit, 2, 4); if (!site) return []; return [{ label: 'raise the storehouse', score: 50, task: { kind: 'raiseStorehouse', args: { at: site } } }]; }
      return camp.stash.stick < n.stick ? [{ label: 'gather sticks for the storehouse', score: 34, task: { kind: 'gather', args: { item: 'stick' } } }] : []; } },
  { id: 'huts', title: 'Build huts', stage: 'shelter', after: 'shelter', standing: true, need: { log: 5, stick: 10, hide: 1 },
    state(){ if (!camp.shelter) return { s: 'blocked', text: 'Needs the lean-to first.' }; const beds = bedsFor(), n = campHumans().length, active = n > beds;
      const short = active && camp.stash.hide < this.need.hide;
      return { s: active ? 'active' : 'idle', text: `${camp.huts.length} huts, ${beds} sleeping places for ${n} people. Each hut sleeps three and costs 5 logs, 10 sticks, a hide.${short ? ' Short of a hide: the next hide goes to the hut.' : ''}` }; },
    offers(a){ if (!camp.shelter || camp.huts.length >= 4 || campHumans().length <= bedsFor()) return []; const n = this.need;
      if (camp.stash.log >= n.log && camp.stash.stick >= n.stick && camp.stash.hide >= n.hide){ const site = openSpotNear(camp.pit, 3, 6); if (!site) return []; return [{ label: 'build a hut', score: 48, task: { kind: 'buildHut', args: { at: site } } }]; }
      const out = [];
      if (camp.stash.stick < n.stick) out.push({ label: 'gather sticks for a hut', score: 32, task: { kind: 'gather', args: { item: 'stick' } } });
      if (camp.stash.hide < n.hide){ const snareGoal = GOALS.find(g => g.id === 'snare'); if (camp.snares.length < snareGoal.max && camp.stash.stick >= 3) out.push({ label: 'set a snare for a hide', score: 40, task: { kind: 'setSnare', args: {} } }); }
      return out; } },
  { id: 'village', title: 'Become a village', stage: 'settlement', after: 'storehouse',
    state(){ if (camp.village) return { s: 'done', text: `${camp.name} is a village. Travellers come more readily, and the young grow up here.` }; const ok = camp.storehouse && camp.huts.length >= 2 && campHumans().length >= 8; return { s: camp.storehouse && camp.huts.length >= 1 ? 'active' : 'blocked', text: `Needs a storehouse (${camp.storehouse ? 'yes' : 'no'}), two huts (${camp.huts.length}), and eight people (${campHumans().length}).` }; } },
  { id: 'fae', title: 'The sprites of the groves', stage: 'sprites',
    state(){
      if (!camp.fae.known) return { s: 'blocked', text: 'Nothing seen yet. The old pines are not empty.' };
      const f = camp.fae.favor, mood = f >= 30 ? 'They favour this camp.' : f >= 0 ? 'They are curious and watch the fire.' : f >= -40 ? 'They are cross with this camp. Expect pranks.' : 'They hate this camp. Fires go out and food goes bad.';
      const g = groves.filter(gr => gr.anger > 20);
      return { s: 'active', text: `Favour ${f}. ${mood}${g.length ? ` ${g.length} grove${g.length > 1 ? 's are' : ' is'} angry.` : ''}${camp.fae.blightUntil > tick ? ' A blight is on the bushes.' : ''} They like berries left for them, and old pines standing. They hate axes in their groves, snares near them, and wards.` };
    } },
  { id: 'gnomes', title: 'The hidden neighbours', stage: 'sprites',
    state(){ if (!camp.gnomes.known) return { s: 'blocked', text: 'Nothing seen yet. The meadow edges are not empty.' }; const near = camp.site ? c => dist(c.exit.x, c.exit.y, ...camp.site) <= 60 : () => true; const holes = caves.filter(c => c.kind === 'burrow' && c.owner === 'gnome' && near(c)).length; return { s: 'active', text: `Gnomes live in ${holes} burrow${holes === 1 ? '' : 's'} under the meadow edges. They come out at dusk, farm mushrooms, and copy what they see. They borrow made things and bring them back with a gift. They never fight, and they leave when a village grows loud.` }; } },
  { id: 'stone', title: 'Set an offering stone', stage: 'sprites', after: 'fae', need: { rock: 2 },
    state(){ if (!camp.fae.known) return { s: 'blocked', text: 'Needs a reason. Nobody has seen the sprites.' }; if (camp.stone) return { s: 'done', text: 'A flat stone at the edge of the firelight, where berries are left at dusk.' }; return { s: 'active', text: `Rocks ${Math.min(camp.stash.rock, 2)}/2. Gifts taken from it earn favour, and favour brings glowing moss.` }; },
    offers(a){ if (!camp.fae.known || camp.stone || !camp.pit) return []; if (camp.stash.rock < 2) return [{ label: 'gather rocks for the offering stone', score: 30, task: { kind: 'gather', args: { item: 'rock' } } }]; const site = openSpotNear(camp.pit, 4, 6); if (!site) return [];
      return [{ label: 'set the offering stone', score: 42, task: { kind: 'setOfferingStone', args: { at: site } } }]; } },
  { id: 'offer', title: 'Leave gifts for the sprites', stage: 'sprites', after: 'stone', standing: true,
    state(){ if (!camp.stone) return { s: 'blocked', text: 'Needs the offering stone.' }; const st = tileAt(...camp.stone).struct; return { s: camp.fae.favor < 60 ? 'active' : 'idle', text: st.offering > 0 ? `${st.offering} berries wait on the stone. They go at night.` : `Nothing on the stone. Favour ${camp.fae.favor}.` }; },
    offers(a){ if (!camp.stone || camp.fae.favor >= 60 || camp.stash.berries < 3) return []; const st = tileAt(...camp.stone).struct; if (st.offering > 0) return []; return [{ label: 'leave berries on the stone', score: camp.fae.favor < 0 ? 46 : 30, task: { kind: 'leaveBerries', args: { at: camp.stone } } }]; } },
  { id: 'ward', title: 'Ward the camp', stage: 'sprites', after: 'fae', need: { stick: 6 },
    state(){ if (!camp.fae.known) return { s: 'blocked', text: 'Needs a reason. Nobody has seen the sprites.' }; if (camp.ward) return { s: 'done', text: 'Ash-blackened posts around the camp. Sprites will not cross the line, and they resent it.' }; return { s: camp.fae.favor > -10 ? 'idle' : 'active', text: `Sticks ${Math.min(camp.stash.stick, 6)}/6, charred in the fire. Keeps sprites out of the camp. Costs favour.` }; },
    offers(a){ if (!camp.fae.known || camp.ward || !camp.pit || !pitLit() || camp.fae.favor > -10) return []; if (camp.stash.stick < 6) return [{ label: 'gather sticks for the ward posts', score: 28, task: { kind: 'gather', args: { item: 'stick' } } }]; const site = openSpotNear(camp.pit, 3, 5); if (!site) return [];
      return [{ label: 'set the ward posts', score: camp.fae.favor < -20 ? 55 : 30, task: { kind: 'setWardPosts', args: { at: site } } }]; } },
  { id: 'faefight', title: 'Drive off the sprites', stage: 'sprites', after: 'fae', standing: true,
    state(){ const sp = spriteNear(); if (!camp.fae.known) return { s: 'blocked', text: 'Nobody has seen the sprites.' }; return { s: sp && camp.fae.favor < -30 ? 'active' : 'idle', text: sp ? `A sprite is ${nearAt(sp, ...camp.pit)} tiles from the fire.${camp.fae.favor < -30 ? ' It means no good.' : ''}` : 'None near. A killed sprite is never forgotten by its grove.' }; },
    offers(a){ const sp = spriteNear(); if (!sp || camp.fae.favor >= -30 || !camp.tools.spear || a.traits.bravery < 0.5) return []; return [{ label: 'drive off the sprite with the spear', score: 60 + a.traits.bravery * 15, task: { kind: 'fightSprite', args: { sprite: sp.id } } }]; } },
  { id: 'waterskin', title: 'Sew a waterskin', stage: 'tools', after: 'cook', need: { hide: 2 },
    state(){
      if (!camp.everLit) return { s: 'blocked', text: 'Needs hides, which come from cooking rabbits.' };
      if (camp.tools.waterskin) return { s: 'done', text: 'Two hides, stitched with sinew. Water can come to the camp.' };
      const need = 2 + hideReserved(), held = camp.stash.hide >= 2 && camp.stash.hide < need;
      return { s: camp.stash.hide >= need ? 'active' : 'blocked', text: held ? `Hides ${Math.min(camp.stash.hide, 2)}/2, and one is held for a hut.` : `Hides ${Math.min(camp.stash.hide, 2)}/2. Every cooked rabbit leaves one.` };
    },
    offers(a){ if (camp.tools.waterskin || camp.stash.hide < 2 + hideReserved()) return []; return [{ label: 'sew the waterskin', score: 54, task: { kind: 'sewWaterskin', args: { at: camp.stashTile } } }]; } },
  { id: 'water', title: 'Keep water at camp', stage: 'tools', after: 'waterskin', standing: true,
    state(){ if (!camp.tools.waterskin) return { s: 'blocked', text: 'Needs the waterskin.' }; return { s: camp.stash.water >= waterAim() ? 'idle' : 'active', text: `${camp.stash.water} drinks stored. Aim: ${waterAim()}. People drink at the fire instead of walking to the river.` }; },
    offers(a){ if (!camp.tools.waterskin || camp.stash.water >= waterAim()) return []; return [{ label: 'fill the waterskin', score: camp.stash.water === 0 ? 48 : 36, task: { kind: 'fillWater', args: {} } }]; } },
  { id: 'spear', title: 'Make a spear', stage: 'tools', after: 'axe', need: { stick: 1, rock: 1 },
    state(){ if (!camp.tools.axe) return { s: 'blocked', text: 'Needs the axe to shape a shaft.' }; if (camp.tools.spear) return { s: 'done', text: 'A fire-hardened shaft with a flaked point. Deer are in reach now.' }; return { s: 'active', text: `Stick ${Math.min(camp.stash.stick, 1)}/1, rock ${Math.min(camp.stash.rock, 1)}/1.` }; },
    offers(a){ if (!camp.tools.axe || camp.tools.spear) return []; if (camp.stash.stick >= 1 && camp.stash.rock >= 1) return [{ label: 'make the spear', score: 50, task: { kind: 'makeSpear', args: { at: camp.stashTile } } }]; return [{ label: 'gather a rock for the spear', score: 40, task: { kind: 'gather', args: { item: camp.stash.rock < 1 ? 'rock' : 'stick' } } }]; } },
  { id: 'deer', title: 'Hunt deer', stage: 'food', after: 'spear', standing: true,
    state(){ if (!camp.tools.spear) return { s: 'blocked', text: 'Needs the spear.' }; const d = deerNear(); return { s: d ? 'active' : 'idle', text: d ? `Deer within ${nearAt(d, ...camp.site)} tiles. A deer feeds the camp for days and gives two hides.` : 'No deer near the camp. They graze at dawn and dusk, and wolves thin them in winter.' }; },
    offers(a){ const d = deerNear(); if (!d || !camp.tools.spear || a.traits.bravery < 0.4 || camp.stash.venison > 0) return []; return [{ label: 'hunt a deer', score: 48 + a.skills.hunt * 5 + (stashFood() < 4 ? 15 : 0), task: { kind: 'huntDeer', args: { deer: d.id } } }]; } },
  { id: 'rack', title: 'Build a drying rack', stage: 'food', after: 'firepit', need: { stick: 6 },
    state(){ if (!camp.pit) return { s: 'blocked', text: 'Needs the fire pit.' }; if (camp.rack) return { s: 'done', text: 'A rack of sticks over the smoke. Meat dried here keeps for the winter.' }; return { s: 'active', text: `Sticks ${Math.min(camp.stash.stick, 6)}/6. Cooked meat spoils in two days. Smoked meat does not.` }; },
    offers(a){ if (!camp.pit || camp.rack) return []; if (camp.stash.stick < 6) return [{ label: 'gather sticks for the rack', score: 30, task: { kind: 'gather', args: { item: 'stick' } } }]; const site = openSpotNear(camp.pit, 2, 3); if (!site) return [];
      return [{ label: 'build the drying rack', score: 45, task: { kind: 'buildRack', args: { at: site } } }]; } },
  { id: 'smoke', title: 'Smoke meat for lean days', stage: 'food', after: 'rack', standing: true,
    state(){ if (!camp.rack) return { s: 'blocked', text: 'Needs the drying rack.' }; return { s: 'active', text: `${camp.stash.smoked} strips stored. Aim: 8. Winter is ${SEASON_DAYS * 4} days long in all, and the bushes give nothing then.` }; },
    offers(a){ if (!camp.rack || !pitLit() || (camp.stash.carcass < 1 && camp.stash.fish < 1) || camp.stash.smoked >= 8) return [];
      const out = [];
      if (camp.stash.carcass >= 1) out.push({ label: 'smoke a rabbit over the fire', score: seasonOf() === 'autumn' ? 66 : camp.stash.smoked < 4 ? 60 : 30, task: { kind: 'smokeMeat', args: { at: camp.rack } } });
      if (camp.stash.fish >= 1) out.push({ label: 'smoke a fish over the fire', score: seasonOf() === 'autumn' ? 64 : camp.stash.smoked < 4 ? 58 : 28, task: { kind: 'smokeFish', args: { at: camp.rack } } });
      return out;
    } },
  { id: 'guard', title: 'Keep wolves off', stage: 'settlement', after: 'fire', standing: true,
    state(){ const w = wolfNear(); if (!camp.pit) return { s: 'blocked', text: 'Wolves come to a camp with meat and no fire.' }; return { s: w ? 'active' : 'idle', text: w ? `A wolf is ${nearAt(w, ...camp.pit)} tiles from the fire.` : 'No wolf near. A lit fire keeps them at the edge of the dark.' }; },
    offers(a){ const w = wolfNear(); if (!w || !pitLit() || a.traits.bravery < 0.35) return []; return [{ label: 'drive off the wolf with a firebrand', score: 72 + a.traits.bravery * 20, task: { kind: 'driveOff', args: { wolf: w.id, at: camp.pit } } }]; } },
  { id: 'scout', title: 'Found a second camp', stage: 'settlement', after: 'shelter',
    state(){
      if (!camp.shelter) return { s: 'blocked', text: 'A camp sends people out only when it has a roof, and at least five people.' };
      if (camp.sentParty) return { s: 'done', text: `${camp.sentParty} set out for a new valley.` };
      if (camps.length >= 6) return { s: 'blocked', text: 'The valleys are taken. Six camps is all this world holds for now.' };
      const ready = campHumans().length >= 5 && tick - camp.founded > CLOCK.party.campAge && (seasonOf() === 'spring' || seasonOf() === 'summer');
      return { s: ready ? 'active' : 'blocked', text: `${campHumans().length}/5 people, camp ${Math.floor((tick - camp.founded) / DAY)}/${CLOCK.party.campAge / DAY} days old. Parties leave in spring or summer. Two go with coals and food.` };
    },
    offers(a){ if (!camp.shelter || camp.sentParty || camps.length >= 6 || campHumans().length < 5 || tick - camp.founded <= CLOCK.party.campAge || !(seasonOf() === 'spring' || seasonOf() === 'summer') || a.traits.bravery < 0.5) return []; return [{ label: 'lead a party to a new valley', score: 40, task: { kind: 'leadParty', args: {} } }]; } },
  { id: 'caves', title: 'Search the caves', stage: 'tools', after: 'spear',
    state(){
      if (!camp.site) return { s: 'blocked', text: 'Needs a camp first.' };
      const near = caves.filter(c => c.kind === 'water' && dist(c.exit.x, c.exit.y, ...camp.site) <= 40);
      if (!near.length) return { s: 'blocked', text: 'No cave mouth within forty tiles of the camp.' };
      const open = near.filter(c => !c.searched && !c.blocked), blocked = near.filter(c => c.blocked), done = near.filter(c => c.searched);
      if (!open.length && !blocked.length) return { s: 'done', text: `${done.length} cave${done.length > 1 ? 's' : ''} searched. Nothing left in the dark but the dark.` };
      const ready = camp.tools.spear && pitLit();
      return { s: ready ? 'active' : 'blocked', text: `${camp.tools.spear && !pitLit() ? 'The fire is out, and a brand needs a lit fire. ' : ''}${near.length} cave${near.length > 1 ? 's' : ''} near: ${open.length} unsearched, ${blocked.length} blocked by fallen rock. A brave person with a brand and the spear goes in; the brand lasts ${CLOCK.limit.ember} ticks. Fallen rock takes the axe.` };
    },
    offers(a){
      if (!camp.site || !camp.tools.spear || !pitLit() || a.traits.bravery < 0.5 || stage(a) === 'young' || a.hp < 60) return [];
      const near = caves.filter(c => c.kind === 'water' && dist(c.exit.x, c.exit.y, ...camp.site) <= 40); const out = [];
      for (const c of near){
        if (c.blocked && camp.tools.axe) out.push({ label: 'clear the fallen rock', score: 40, task: { kind: 'brand', args: { label: 'Going down to the fallen rock', next: { kind: 'clearRock', args: { cave: caves.indexOf(c), rock: [c.blocked.x, c.blocked.y, c.blocked.z] } } } } });
        else if (!c.blocked && !c.searched && (!c.claimed || !beings.some(b => b.alive && b.id === c.claimed))) out.push({ label: 'search the cave with a brand', score: 36 + a.traits.curiosity * 20, task: { kind: 'brand', args: { label: 'Going into the dark', next: { kind: 'searchCave', args: { cave: caves.indexOf(c) } } } } });
      }
      return out;
    } },
  { id: 'dens', title: 'Clear a den', stage: 'tools', after: 'spear',
    state(){
      if (!camp.site) return { s: 'blocked', text: 'Needs a camp first.' };
      const near = caves.filter(c => c.kind === 'den' && c.owner && dist(c.exit.x, c.exit.y, ...camp.site) <= 40);
      if (!near.length) return { s: 'blocked', text: 'No den within forty tiles.' };
      const held = near.filter(c => c.cleared === camp), wild = near.filter(c => !c.cleared);
      if (!wild.length){
        if (held.length) return { s: 'done', text: `${held.length} den${held.length > 1 ? 's' : ''} cleared. It goes back to the beasts if the fire is out for a day.` };
        const by = [...new Set(near.map(c => c.cleared.name))];
        return { s: 'done', text: `${near.length} den${near.length > 1 ? 's' : ''} near, held by ${by.join(' and ')}.` };
      }
      const party = campHumans().filter(denReady).length;
      return { s: camp.tools.spear && pitLit() && party >= 2 ? 'active' : 'blocked', text: `${camp.tools.spear && !pitLit() ? 'The fire is out, and a brand needs a lit fire. ' : ''}${wild.length} den${wild.length > 1 ? 's' : ''} near: ${wild.map(c => c.owner === 'wolf' ? 'wolves' : 'foxes').join(', ')}. Two brave people with brands and the spear drive the beasts out. They dig a new den elsewhere, and come back if the fire fails for a day.` };
    },
    offers(a){
      if (!camp.site || !camp.tools.spear || !pitLit() || a.traits.bravery < 0.5 || stage(a) === 'young' || a.hp < 60) return [];
      const wild = caves.filter(c => c.kind === 'den' && c.owner && !c.cleared && dist(c.exit.x, c.exit.y, ...camp.site) <= 40);
      /* The den goes in the label, so a failed offer's cooldown (keyed on the label) does not cool down
         every other den too. */
      return wild.map(c => ({ label: `clear the den with brands (${c.owner === 'wolf' ? 'wolves' : 'foxes'} under the hill at ${c.exit.x},${c.exit.y})`, score: c.owner === 'wolf' ? 44 : 30, task: { kind: 'denParty', args: { cave: caves.indexOf(c) } } }));
    } },
];
function goalState(g){ if (g.locked) return { s: 'locked', text: g.locked }; return g.state(); }
/* A stage is reached when any goal in it is not blocked. The fire stage always is. Reads the current camp. */
function stageReached(stageId){
  if (stageId === 'fire') return true;
  return GOALS.some(g => g.stage === stageId && goalState(g).s !== 'blocked');
}
function offersFor(a){
  const out = [];
  for (const g of GOALS){
    if (g.locked || !g.offers) continue; const pr = goalPriority[g.id] ?? 1; if (pr === 0) continue;
    if (goalState(g).s !== 'active') continue;
    for (const o of g.offers(a)) out.push({ ...o, goal: g.id, score: o.score * (pr === 2 ? 1.5 : 1) });
  }
  return out;
}
