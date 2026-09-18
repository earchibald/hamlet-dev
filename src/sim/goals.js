/* Goal definitions. Each goal reports a state and offers work. */
const waterAim = () => 6 + 6 * (camp.stash.pot || 0);
/* One hide is held back for a hut while people sleep outside. The waterskin and clothes wait for the next one. */
function hideReserved(){
  if (!camp.shelter || camp.huts.length >= 4 || campHumans().length <= bedsFor()) return 0;
  return 1;
}
const GOALS = [
  { id: 'camp', title: 'Make camp',
    state(){ return camp.site ? { s: 'done', text: `Site chosen: ${camp.siteReason || 'set by you'}.` } : { s: 'active', text: 'Nobody has picked a spot yet.' }; },
    offers(a){ return camp.site ? [] : [{ label: 'choose a camp site', score: 70, start: a => chooseSite(a) }]; } },
  { id: 'firepit', title: 'Build a fire pit', need: { rock: 6, stick: 8 },
    state(){
      if (!camp.site) return { s: 'blocked', text: 'Needs a camp site first.' };
      if (camp.pit) return { s: 'done', text: 'A ring of stones with the fire laid inside.' };
      const n = this.need; return { s: 'active', text: `Rocks ${Math.min(camp.stash.rock, n.rock)}/${n.rock}, sticks ${Math.min(camp.stash.stick, n.stick)}/${n.stick}. Loose ones only, nobody has tools yet.` };
    },
    offers(a){
      if (!camp.site || camp.pit) return [];
      const n = this.need, out = [];
      if (camp.stash.rock >= n.rock && camp.stash.stick >= n.stick) out.push({ label: 'build the fire pit', score: 60, start: a => startBuild(a, camp.site, 70, 'Building the fire pit', a => {
        if (camp.pit) return;
        camp.stash.rock -= n.rock; camp.stash.stick -= n.stick;
        const t = tileAt(...camp.site); t.ground = 'soil'; t.feature = null; t.berries = 0;
        t.struct = { type: 'firepit', fuel: 200, lit: false };
        for (const [dx, dy] of RING){ const q = tileAt(t.x + dx, t.y + dy); if (q.ground === 'grass') q.ground = 'soil'; }
        camp.pit = [t.x, t.y]; gainXp(a, 'build');
        if (camp.coals > tick){ t.struct.lit = true; camp.everLit = true; camp.nextArrival = tick + 900; log(`${a.name} finishes the fire pit and blows the carried coals to life. A second hearth burns.`, campHumans(), 'major'); }
        else log(`${a.name} finishes the fire pit and clears the grass around it. The wood is laid. It only needs a spark.`, [a], 'major');
        addThought(a, 'pit', 'Built a proper fire pit', 6, 800);
      }) });
      else {
        if (camp.stash.rock < n.rock) out.push({ label: 'gather rocks', score: 45, start: a => startGather(a, 'rock') });
        if (camp.stash.stick < n.stick) out.push({ label: 'gather sticks', score: 45, start: a => startGather(a, 'stick') });
      }
      return out;
    } },
  { id: 'fire', title: 'Keep the fire burning', standing: true,
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
      if (p.lit && p.fuel < PIT_MAX * 0.6 && (camp.stash.stick > 0 || camp.stash.log > 0)) out.push({ label: 'feed the fire', score: p.fuel < PIT_MAX * 0.25 ? 85 : 50, start: a => startBuild(a, camp.pit, 6, 'Feeding the fire', a => {
        if (!p.lit) return;
        if (camp.stash.log > 0 && p.fuel < PIT_MAX - LOG_FUEL + 20){ camp.stash.log--; p.fuel = Math.min(PIT_MAX, p.fuel + LOG_FUEL); }
        else if (camp.stash.stick > 0){ camp.stash.stick--; p.fuel = Math.min(PIT_MAX, p.fuel + STICK_FUEL); } }) });
      if (camp.stash.stick < 6) out.push({ label: 'gather sticks for the woodpile', score: camp.stash.stick === 0 ? 55 : 35, start: a => startGather(a, 'stick') });
      if (!p.lit && p.fuel > 0 && nearbyBlaze()) out.push({ label: 'fetch an ember from the blaze', score: 95, start: a => startFetchEmber(a) });
      if (!p.lit && p.fuel > 0 && camp.tools.firestones && !(a.cooldown['strike sparks'] > tick)) out.push({ label: 'strike sparks', score: 80, start: a => startBuild(a, camp.pit, 40, 'Striking sparks into the tinder', a => { if (p.lit || p.fuel <= 0) return; if (rng() < 0.2 + a.skills.craft * 0.1 + a.traits.patience * 0.25){ p.lit = true; camp.everLit = true; log(`${a.name} coaxes a spark into flame. The fire is back.`, campHumans(), 'good'); for (const h of campHumans()) addThought(h, 'hearth', 'The fire is lit', 8, 1000); gainXp(a, 'craft'); } else { addThought(a, 'sparks', 'Sparks, but no flame', -3, 300); a.cooldown['strike sparks'] = tick + 150; } }) });
      if (!p.lit && p.fuel > 0 && camp.stash.moss > 0) out.push({ label: 'light the pit with glowing moss', score: 92, start: a => startBuild(a, camp.pit, 10, 'Blowing on the glowing moss', a => { if (p.lit || camp.stash.moss <= 0 || p.fuel <= 0) return; camp.stash.moss--; p.lit = true; camp.everLit = true; log(`${a.name} tucks the glowing moss into the pit and blows. The fire takes. No lightning, no sky.`, campHumans(), 'major'); for (const h of campHumans()) addThought(h, 'hearth', 'The fire is lit', 8, 1000); }) });
      if (looseCount('moss')(sectors[secIdx(...Object.values(secOf(...camp.site)))]) > 0 || (camp.fae.favor >= 0 && groves.some(g => dist(g.x, g.y, ...camp.site) <= 40 && items.some(i => i.kind === 'moss' && i.z >= 0 && dist(i.x, i.y, g.x, g.y) <= 2)))) out.push({ label: 'gather glowing moss', score: camp.stash.moss === 0 ? 40 : 20, start: a => startGather(a, 'moss') });
      if (!p.lit && p.fuel <= 0 && camp.stash.stick >= 4) out.push({ label: 'lay the fire again', score: 60, start: a => startBuild(a, camp.pit, 15, 'Laying the fire', a => { if (camp.stash.stick >= 4){ camp.stash.stick -= 4; p.fuel = 160; log(`${a.name} lays fresh wood in the pit.`, [a]); } }) });
      return out;
    } },
  { id: 'hearth', title: 'Keep the hearth three days without a break',
    state(){
      if (!camp.everLit) return { s: 'blocked', text: 'Needs a lit fire first.' };
      if (camp.bestStreak >= 3 * DAY) return { s: 'done', text: 'The hearth is established. People trust this place now.' };
      return { s: 'active', text: `Current run ${(camp.streak / DAY).toFixed(1)} days. Best ${(camp.bestStreak / DAY).toFixed(1)}. A steady hearth earns the time to make tools.` };
    } },
  { id: 'food', title: 'Stock food', standing: true,
    state(){ if (!camp.site) return { s: 'blocked', text: 'Needs a camp site first.' }; const t = foodTarget(); return { s: stashFood() >= t ? 'done' : 'active', text: `${camp.stash.berries} berries, ${camp.stash.cooked} cooked, ${camp.stash.smoked} smoked. Aim: ${t} meals${seasonOf() === 'autumn' ? ', more before winter' : isWinter() ? '. Bushes are bare in winter' : ''}. Fresh food spoils.${stashFood() >= t ? '' : ' Until the aim is met, no newcomer is taken in and no child is born here.'}` }; },
    offers(a){ if (!camp.site || stashFood() >= foodTarget()) return []; return [{ label: 'pick berries for the stash', score: stashFood() === 0 ? 50 : 38, start: a => startPickBerries(a) }]; } },
  { id: 'cook', title: 'Cook what we catch', standing: true,
    /* The state must count every kind of raw meat. A goal that is not active offers no work, so while
       this read the rabbit carcasses alone a speared deer lay uncut in the stash, and a camp starved
       in winter with nine meals waiting beside the fire. */
    state(){ if (!camp.everLit) return { s: 'blocked', text: 'Needs a lit fire.' };
      const raw = camp.stash.carcass + camp.stash.venison + camp.pitfalls.filter(p => p.catch).length;
      const waiting = [camp.stash.venison > 0 ? `${camp.stash.venison} deer` : '', camp.stash.carcass > 0 ? `${camp.stash.carcass} carcass` : ''].filter(Boolean).join(' and ');
      return { s: raw > 0 || camp.stash.fish > 0 ? 'active' : 'idle', text: raw > 0 || camp.stash.fish > 0 ? `${camp.stash.carcass} carcass and ${camp.stash.fish} fish waiting.` : 'Nothing to cook. Cooked meat is a better meal than berries.' }; },
    offers(a){ if (!pitLit()) return [];
      for (const p of camp.pitfalls) if (p.catch) return [{ label: 'haul the deer from the pit', score: 66, start: a => startHaulPit(a, p) }];
      if (camp.stash.venison > 0) return [{ label: 'butcher and cook the deer', score: 62, start: a => startBuild(a, camp.pit, 60, 'Butchering the deer', a => { if (camp.stash.venison <= 0) return; camp.stash.venison--; stashAdd('cooked', 5); stashAdd('hide', 2); if (camp.rack) stashAdd('smoked', 4); gainXp(a, 'cook'); log(`${a.name} butchers the deer. Meat for days${camp.rack ? ', and strips on the rack' : ''}.`, campHumans(), 'good'); }) }];
      if (camp.stash.fish > 0) return [{ label: 'cook the fish', score: camp.stash.fish >= 2 ? 62 : 45, start: a => startBuild(a, camp.pit, 25, 'Cooking fish over the fire', a => { if (camp.stash.fish > 0){ stashTake('fish'); stashAdd('cooked', 2); gainXp(a, 'cook'); log(`${a.name} cooks a fish over the fire.`, [a], 'good'); } }) }];
      if (camp.stash.carcass <= 0) return []; return [{ label: 'cook the catch', score: camp.stash.cooked === 0 ? 55 : 35, start: a => startBuild(a, camp.pit, 35, 'Cooking over the fire', a => { if (camp.stash.carcass > 0){ camp.stash.carcass--; stashAdd('cooked', 3); stashAdd('hide', 1); gainXp(a, 'cook'); camp.bestCook = Math.max(camp.bestCook || 0, a.skills.cook); log(`${a.name} cooks a rabbit over the fire and keeps the hide.`, [a], 'good'); } }) }]; } },
  { id: 'snare', title: 'Set snares for rabbits', standing: true, max: 4,
    state(){
      if (!camp.everLit) return { s: 'blocked', text: 'People settle first. Needs a lit fire.' };
      const snares = camp.snares, c = snares.filter(s => s.catch).length, armed = snares.filter(s => s.armed).length;
      return { s: 'active', text: `${snares.length}/${this.max} set, ${armed} armed, ${c} with a catch. Each snare costs 3 sticks.` };
    },
    offers(a){
      if (!camp.everLit) return []; const out = [], snares = camp.snares;
      for (const s of snares){
        if (s.catch) out.push({ label: 'check the snare', score: 65, start: a => startCheckSnare(a, s) });
        else if (!s.armed && camp.stash.stick >= 1) out.push({ label: 're-arm the snare', score: 40, start: a => startBuild(a, [s.x, s.y], 10, 'Re-arming the snare', a => { if (camp.stash.stick >= 1 && !s.armed){ camp.stash.stick--; s.armed = true; } }) });
      }
      if (snares.length < this.max && camp.stash.stick >= 3) out.push({ label: 'set a snare', score: 42, start: a => startSetSnare(a) });
      else if (snares.length < this.max) out.push({ label: 'gather sticks for snares', score: 25, start: a => startGather(a, 'stick') });
      return out;
    } },
  { id: 'axe', title: 'Knap a stone axe',
    state(){
      if (camp.bestStreak < 3 * DAY) return { s: 'blocked', text: 'Needs an established hearth. Two rocks struck together the right way make an edge.' };
      if (camp.tools.axe) return { s: 'done', text: 'A stone axe, hafted on a stick. Trees are firewood now.' };
      return { s: 'active', text: `Rocks ${Math.min(camp.stash.rock, 2)}/2, sticks ${Math.min(camp.stash.stick, 1)}/1 for the haft.` };
    },
    offers(a){
      if (camp.bestStreak < 3 * DAY || camp.tools.axe) return [];
      if (camp.stash.rock >= 2 && camp.stash.stick >= 1) return [{ label: 'knap the axe', score: 58, start: a => startBuild(a, camp.stashTile, 70, 'Knapping an axe', a => { if (camp.tools.axe || camp.stash.rock < 2) return; camp.stash.rock -= 2; camp.stash.stick--; camp.tools.axe = 1; gainXp(a, 'craft'); log(`${a.name} strikes flakes off a rock until it holds an edge, then binds it to a stick. The camp has an axe.`, [a], 'major'); addThought(a, 'axe', 'Made the first tool', 8, 1500); }) }];
      const out = []; if (camp.stash.rock < 2) out.push({ label: 'gather rocks for the axe', score: 44, start: a => startGather(a, 'rock') }); if (camp.stash.stick < 1) out.push({ label: 'gather a stick for the haft', score: 44, start: a => startGather(a, 'stick') }); return out;
    } },
  { id: 'firestones', title: 'Find firestones', need: { rock: 3 },
    state(){ if (!camp.tools.axe) return { s: 'blocked', text: 'Needs the knapping know-how that came with the axe.' }; if (camp.tools.firestones) return { s: 'done', text: 'Two stones that spark when struck. A cold pit is a chore now, not a prayer.' }; const cold = camp.pit && !pitLit(); return { s: 'active', text: `Rocks ${Math.min(camp.stash.rock, 3)}/3 to try. Striking sparks into tinder takes patience, and it fails more than it works.${cold ? ' The pit is dead and cold, so the camp puts this ahead of firewood.' : ''}` }; },
    offers(a){ if (!camp.tools.axe || camp.tools.firestones) return []; const cold = camp.pit && !pitLit() ? 40 : 0; if (camp.stash.rock < 3) return [{ label: 'gather rocks to find firestones', score: 36 + cold, start: a => startGather(a, 'rock') }]; return [{ label: 'test rocks for sparks', score: 44 + cold, start: a => startBuild(a, camp.stashTile, 50, 'Striking rocks together', a => { if (camp.tools.firestones) return; camp.stash.rock -= 3; if (rng() < 0.4 + a.traits.patience * 0.4){ camp.tools.firestones = 1; gainXp(a, 'craft'); log(`${a.name} finds two stones that throw sparks. The camp can make its own fire now.`, campHumans(), 'major'); } else addThought(a, 'dud', 'Struck rocks all afternoon for nothing', -2, 400); }) }]; } },
  { id: 'firewood', title: 'Cut firewood', standing: true,
    state(){
      if (!camp.tools.axe) return { s: 'blocked', text: 'Needs the axe.' };
      return { s: 'active', text: `${camp.stash.log} logs in the woodpile. A log burns three times longer than a stick. Aim: 4.` };
    },
    offers(a){
      if (!camp.tools.axe) return []; const out = [];
      const cs = secOf(...camp.site), looseLogs = looseCount('log')(sectors[secIdx(cs.sx, cs.sy)]);
      if (looseLogs > 0 && camp.stash.log < 8) out.push({ label: 'haul logs to the woodpile', score: 46, start: a => startGather(a, 'log') });
      if (camp.stash.log + looseLogs < 4) out.push({ label: 'cut a tree for logs', score: 48, start: a => startCutTree(a) });
      return out;
    } },
  { id: 'shelter', title: 'Build a lean-to', need: { log: 4, stick: 10 },
    state(){
      if (!camp.tools.axe) return { s: 'blocked', text: 'Needs the axe, for logs.' };
      if (camp.shelter) return { s: 'done', text: 'A roof of logs and sticks beside the fire. Nobody sleeps on bare ground now.' };
      return { s: 'active', text: `Logs ${Math.min(camp.stash.log, 4)}/4, sticks ${Math.min(camp.stash.stick, 10)}/10.` };
    },
    offers(a){
      if (!camp.tools.axe || camp.shelter) return []; const n = this.need;
      if (camp.stash.log >= n.log && camp.stash.stick >= n.stick){
        const site = shelterSite(); if (!site) return [];
        return [{ label: 'build the lean-to', score: 56, start: a => startBuild(a, site, 110, 'Building the lean-to', a => { if (camp.shelter || camp.stash.log < n.log) return; camp.stash.log -= n.log; camp.stash.stick -= n.stick; const t = tileAt(...site); t.feature = null; t.struct = { type: 'leanto', camp }; camp.shelter = site; gainXp(a, 'build'); log(`${a.name} raises a lean-to beside the fire. The camp has a roof.`, humans(), 'major'); for (const h of humans()) addThought(h, 'roof', 'There is a roof to sleep under', 5, 1200); }) }];
      }
      const out = []; if (camp.stash.stick < n.stick) out.push({ label: 'gather sticks for the lean-to', score: 40, start: a => startGather(a, 'stick') }); return out;
    } },
  { id: 'storehouse', title: 'Raise a storehouse', need: { log: 6, stick: 8 },
    state(){ if (!camp.tools.axe) return { s: 'blocked', text: 'Needs the axe, for logs.' }; if (camp.storehouse) return { s: 'done', text: 'Food on a raised floor, out of the damp and out of reach of wolves. It keeps twice as long.' }; return { s: 'active', text: `Logs ${Math.min(camp.stash.log, 6)}/6, sticks ${Math.min(camp.stash.stick, 8)}/8. Wolves cannot raid a storehouse.` }; },
    offers(a){ if (!camp.tools.axe || camp.storehouse || !camp.shelter) return []; const n = this.need; if (camp.stash.log >= n.log && camp.stash.stick >= n.stick){ const site = openSpotNear(camp.pit, 2, 4); if (!site) return []; return [{ label: 'raise the storehouse', score: 50, start: a => startBuild(a, site, 140, 'Raising the storehouse', a => { if (camp.storehouse || camp.stash.log < n.log) return; camp.stash.log -= n.log; camp.stash.stick -= n.stick; tileAt(...site).struct = { type: 'storehouse', camp }; camp.storehouse = site; gainXp(a, 'build'); log(`${a.name} finishes a storehouse on stilts. The stash moves under a roof.`, campHumans(), 'major'); }) }]; }
      return camp.stash.stick < n.stick ? [{ label: 'gather sticks for the storehouse', score: 34, start: a => startGather(a, 'stick') }] : []; } },
  { id: 'huts', title: 'Build huts', standing: true, need: { log: 5, stick: 10, hide: 1 },
    state(){ if (!camp.shelter) return { s: 'blocked', text: 'Needs the lean-to first.' }; const beds = bedsFor(), n = campHumans().length, active = n > beds;
      const short = active && camp.stash.hide < this.need.hide;
      return { s: active ? 'active' : 'idle', text: `${camp.huts.length} huts, ${beds} sleeping places for ${n} people. Each hut sleeps three and costs 5 logs, 10 sticks, a hide.${short ? ' Short of a hide: the next hide goes to the hut.' : ''}` }; },
    offers(a){ if (!camp.shelter || camp.huts.length >= 4 || campHumans().length <= bedsFor()) return []; const n = this.need;
      if (camp.stash.log >= n.log && camp.stash.stick >= n.stick && camp.stash.hide >= n.hide){ const site = openSpotNear(camp.pit, 3, 6); if (!site) return []; return [{ label: 'build a hut', score: 48, start: a => startBuild(a, site, 120, 'Building a hut', a => { if (camp.stash.log < n.log || tileAt(...site).struct) return; camp.stash.log -= n.log; camp.stash.stick -= n.stick; camp.stash.hide -= n.hide; tileAt(...site).struct = { type: 'hut', camp }; camp.huts.push(site); gainXp(a, 'build'); log(`${a.name} finishes a hut. ${bedsFor()} can sleep under a roof now.`, campHumans(), 'good'); }) }]; }
      const out = [];
      if (camp.stash.stick < n.stick) out.push({ label: 'gather sticks for a hut', score: 32, start: a => startGather(a, 'stick') });
      if (camp.stash.hide < n.hide){ const snareGoal = GOALS.find(g => g.id === 'snare'); if (camp.snares.length < snareGoal.max && camp.stash.stick >= 3) out.push({ label: 'set a snare for a hide', score: 40, start: a => startSetSnare(a) }); }
      return out; } },
  { id: 'village', title: 'Become a village',
    state(){ if (camp.village) return { s: 'done', text: `${camp.name} is a village. Travellers come more readily, and the young grow up here.` }; const ok = camp.storehouse && camp.huts.length >= 2 && campHumans().length >= 8; return { s: camp.storehouse && camp.huts.length >= 1 ? 'active' : 'blocked', text: `Needs a storehouse (${camp.storehouse ? 'yes' : 'no'}), two huts (${camp.huts.length}), and eight people (${campHumans().length}).` }; } },
  { id: 'fae', title: 'The sprites of the groves',
    state(){
      if (!camp.fae.known) return { s: 'blocked', text: 'Nothing seen yet. The old pines are not empty.' };
      const f = camp.fae.favor, mood = f >= 30 ? 'They favour this camp.' : f >= 0 ? 'They are curious and watch the fire.' : f >= -40 ? 'They are cross with this camp. Expect pranks.' : 'They hate this camp. Fires go out and food goes bad.';
      const g = groves.filter(gr => gr.anger > 20);
      return { s: 'active', text: `Favour ${f}. ${mood}${g.length ? ` ${g.length} grove${g.length > 1 ? 's are' : ' is'} angry.` : ''}${camp.fae.blightUntil > tick ? ' A blight is on the bushes.' : ''} They like berries left for them, and old pines standing. They hate axes in their groves, snares near them, and wards.` };
    } },
  { id: 'gnomes', title: 'The hidden neighbours',
    state(){ if (!camp.gnomes.known) return { s: 'blocked', text: 'Nothing seen yet. The meadow edges are not empty.' }; const near = camp.site ? c => dist(c.exit.x, c.exit.y, ...camp.site) <= 60 : () => true; const holes = caves.filter(c => c.kind === 'burrow' && c.owner === 'gnome' && near(c)).length; return { s: 'active', text: `Gnomes live in ${holes} burrow${holes === 1 ? '' : 's'} under the meadow edges. They come out at dusk, farm mushrooms, and copy what they see. They borrow made things and bring them back with a gift. They never fight, and they leave when a village grows loud.` }; } },
  { id: 'stone', title: 'Set an offering stone', need: { rock: 2 },
    state(){ if (!camp.fae.known) return { s: 'blocked', text: 'Needs a reason. Nobody has seen the sprites.' }; if (camp.stone) return { s: 'done', text: 'A flat stone at the edge of the firelight, where berries are left at dusk.' }; return { s: 'active', text: `Rocks ${Math.min(camp.stash.rock, 2)}/2. Gifts taken from it earn favour, and favour brings glowing moss.` }; },
    offers(a){ if (!camp.fae.known || camp.stone || !camp.pit) return []; if (camp.stash.rock < 2) return [{ label: 'gather rocks for the offering stone', score: 30, start: a => startGather(a, 'rock') }]; const site = openSpotNear(camp.pit, 4, 6); if (!site) return [];
      return [{ label: 'set the offering stone', score: 42, start: a => startBuild(a, site, 30, 'Setting the offering stone', a => { if (camp.stone) return; camp.stash.rock -= 2; tileAt(...site).struct = { type: 'stone', camp, offering: 0 }; camp.stone = site; log(`${a.name} sets a flat stone at the edge of the firelight, for the sprites.`, campHumans(), 'good'); }) }]; } },
  { id: 'offer', title: 'Leave gifts for the sprites', standing: true,
    state(){ if (!camp.stone) return { s: 'blocked', text: 'Needs the offering stone.' }; const st = tileAt(...camp.stone).struct; return { s: camp.fae.favor < 60 ? 'active' : 'idle', text: st.offering > 0 ? `${st.offering} berries wait on the stone. They go at night.` : `Nothing on the stone. Favour ${camp.fae.favor}.` }; },
    offers(a){ if (!camp.stone || camp.fae.favor >= 60 || camp.stash.berries < 3) return []; const st = tileAt(...camp.stone).struct; if (st.offering > 0) return []; return [{ label: 'leave berries on the stone', score: camp.fae.favor < 0 ? 46 : 30, start: a => startBuild(a, camp.stone, 8, 'Leaving berries on the stone', a => { if (camp.stash.berries < 2) return; stashTake('berries', 2); st.offering = 2; addThought(a, 'gift', 'Left a gift for the sprites', 3, 400); }) }]; } },
  { id: 'ward', title: 'Ward the camp', need: { stick: 6 },
    state(){ if (!camp.fae.known) return { s: 'blocked', text: 'Needs a reason. Nobody has seen the sprites.' }; if (camp.ward) return { s: 'done', text: 'Ash-blackened posts around the camp. Sprites will not cross the line, and they resent it.' }; return { s: camp.fae.favor > -10 ? 'idle' : 'active', text: `Sticks ${Math.min(camp.stash.stick, 6)}/6, charred in the fire. Keeps sprites out of the camp. Costs favour.` }; },
    offers(a){ if (!camp.fae.known || camp.ward || !camp.pit || !pitLit() || camp.fae.favor > -10) return []; if (camp.stash.stick < 6) return [{ label: 'gather sticks for the ward posts', score: 28, start: a => startGather(a, 'stick') }]; const site = openSpotNear(camp.pit, 3, 5); if (!site) return [];
      return [{ label: 'set the ward posts', score: camp.fae.favor < -20 ? 55 : 30, start: a => startBuild(a, site, 60, 'Charring and setting ward posts', a => { if (camp.ward) return; camp.stash.stick -= 6; tileAt(...site).struct = { type: 'ward', camp }; camp.ward = site; camp.fae.favor -= 10; log(`${a.name} sets charred posts around the camp. The sprites will keep their distance now.`, campHumans(), 'good'); }) }]; } },
  { id: 'faefight', title: 'Drive off the sprites', standing: true,
    state(){ const sp = spriteNear(); if (!camp.fae.known) return { s: 'blocked', text: 'Nobody has seen the sprites.' }; return { s: sp && camp.fae.favor < -30 ? 'active' : 'idle', text: sp ? `A sprite is ${nearAt(sp, ...camp.pit)} tiles from the fire.${camp.fae.favor < -30 ? ' It means no good.' : ''}` : 'None near. A killed sprite is never forgotten by its grove.' }; },
    offers(a){ const sp = spriteNear(); if (!sp || camp.fae.favor >= -30 || !camp.tools.spear || a.traits.bravery < 0.5) return []; return [{ label: 'drive off the sprite with the spear', score: 60 + a.traits.bravery * 15, start: a => startFightSprite(a, sp) }]; } },
  { id: 'waterskin', title: 'Sew a waterskin', need: { hide: 2 },
    state(){
      if (!camp.everLit) return { s: 'blocked', text: 'Needs hides, which come from cooking rabbits.' };
      if (camp.tools.waterskin) return { s: 'done', text: 'Two hides, stitched with sinew. Water can come to the camp.' };
      const need = 2 + hideReserved(), held = camp.stash.hide >= 2 && camp.stash.hide < need;
      return { s: camp.stash.hide >= need ? 'active' : 'blocked', text: held ? `Hides ${Math.min(camp.stash.hide, 2)}/2, and one is held for a hut.` : `Hides ${Math.min(camp.stash.hide, 2)}/2. Every cooked rabbit leaves one.` };
    },
    offers(a){ if (camp.tools.waterskin || camp.stash.hide < 2 + hideReserved()) return []; return [{ label: 'sew the waterskin', score: 54, start: a => startBuild(a, camp.stashTile, 60, 'Sewing a waterskin', a => { if (camp.tools.waterskin || camp.stash.hide < 2 + hideReserved()) return; camp.stash.hide -= 2; camp.tools.waterskin = 1; gainXp(a, 'craft'); log(`${a.name} sews two hides into a waterskin.`, [a], 'major'); }) }]; } },
  { id: 'water', title: 'Keep water at camp', standing: true,
    state(){ if (!camp.tools.waterskin) return { s: 'blocked', text: 'Needs the waterskin.' }; return { s: camp.stash.water >= waterAim() ? 'idle' : 'active', text: `${camp.stash.water} drinks stored. Aim: ${waterAim()}. People drink at the fire instead of walking to the river.` }; },
    offers(a){ if (!camp.tools.waterskin || camp.stash.water >= waterAim()) return []; return [{ label: 'fill the waterskin', score: camp.stash.water === 0 ? 48 : 36, start: a => startFillWater(a) }]; } },
  { id: 'spear', title: 'Make a spear', need: { stick: 1, rock: 1 },
    state(){ if (!camp.tools.axe) return { s: 'blocked', text: 'Needs the axe to shape a shaft.' }; if (camp.tools.spear) return { s: 'done', text: 'A fire-hardened shaft with a flaked point. Deer are in reach now.' }; return { s: 'active', text: `Stick ${Math.min(camp.stash.stick, 1)}/1, rock ${Math.min(camp.stash.rock, 1)}/1.` }; },
    offers(a){ if (!camp.tools.axe || camp.tools.spear) return []; if (camp.stash.stick >= 1 && camp.stash.rock >= 1) return [{ label: 'make the spear', score: 50, start: a => startBuild(a, camp.stashTile, 50, 'Shaping a spear', a => { if (camp.tools.spear) return; camp.stash.stick--; camp.stash.rock--; camp.tools.spear = 1; gainXp(a, 'craft'); log(`${a.name} hardens a shaft in the fire and binds a flaked point to it. The camp has a spear.`, [a], 'major'); }) }]; return [{ label: 'gather a rock for the spear', score: 40, start: a => startGather(a, camp.stash.rock < 1 ? 'rock' : 'stick') }]; } },
  { id: 'deer', title: 'Hunt deer', standing: true,
    state(){ if (!camp.tools.spear) return { s: 'blocked', text: 'Needs the spear.' }; const d = deerNear(); return { s: d ? 'active' : 'idle', text: d ? `Deer within ${nearAt(d, ...camp.site)} tiles. A deer feeds the camp for days and gives two hides.` : 'No deer near the camp. They graze at dawn and dusk, and wolves thin them in winter.' }; },
    offers(a){ const d = deerNear(); if (!d || !camp.tools.spear || a.traits.bravery < 0.4 || camp.stash.venison > 0) return []; return [{ label: 'hunt a deer', score: 48 + a.skills.hunt * 5 + (stashFood() < 4 ? 15 : 0), start: a => startHuntDeer(a, d) }]; } },
  { id: 'rack', title: 'Build a drying rack', need: { stick: 6 },
    state(){ if (!camp.pit) return { s: 'blocked', text: 'Needs the fire pit.' }; if (camp.rack) return { s: 'done', text: 'A rack of sticks over the smoke. Meat dried here keeps for the winter.' }; return { s: 'active', text: `Sticks ${Math.min(camp.stash.stick, 6)}/6. Cooked meat spoils in two days. Smoked meat does not.` }; },
    offers(a){ if (!camp.pit || camp.rack) return []; if (camp.stash.stick < 6) return [{ label: 'gather sticks for the rack', score: 30, start: a => startGather(a, 'stick') }]; const site = openSpotNear(camp.pit, 2, 3); if (!site) return [];
      return [{ label: 'build the drying rack', score: 45, start: a => startBuild(a, site, 50, 'Building a drying rack', a => { if (camp.rack || camp.stash.stick < 6) return; camp.stash.stick -= 6; tileAt(...site).struct = { type: 'rack', camp }; camp.rack = site; gainXp(a, 'build'); log(`${a.name} lashes sticks into a drying rack beside the fire.`, [a], 'good'); }) }]; } },
  { id: 'smoke', title: 'Smoke meat for lean days', standing: true,
    state(){ if (!camp.rack) return { s: 'blocked', text: 'Needs the drying rack.' }; return { s: 'active', text: `${camp.stash.smoked} strips stored. Aim: 8. Winter is ${SEASON_DAYS * 4} days long in all, and the bushes give nothing then.` }; },
    offers(a){ if (!camp.rack || !pitLit() || (camp.stash.carcass < 1 && camp.stash.fish < 1) || camp.stash.smoked >= 8) return [];
      const out = [];
      if (camp.stash.carcass >= 1) out.push({ label: 'smoke a rabbit over the fire', score: seasonOf() === 'autumn' ? 66 : camp.stash.smoked < 4 ? 60 : 30, start: a => startBuild(a, camp.rack, 45, 'Smoking meat', a => { if (camp.stash.carcass < 1) return; stashTake('carcass'); stashAdd('smoked', 2); stashAdd('hide', 1); gainXp(a, 'cook'); log(`${a.name} hangs strips of rabbit in the smoke. They will keep.`, [a]); }) });
      if (camp.stash.fish >= 1) out.push({ label: 'smoke a fish over the fire', score: seasonOf() === 'autumn' ? 64 : camp.stash.smoked < 4 ? 58 : 28, start: a => startBuild(a, camp.rack, 40, 'Smoking fish', a => { if (camp.stash.fish < 1) return; stashTake('fish'); stashAdd('smoked', 2); gainXp(a, 'cook'); log(`${a.name} hangs a fish in the smoke. It will keep.`, [a]); }) });
      return out;
    } },
  { id: 'guard', title: 'Keep wolves off', standing: true,
    state(){ const w = wolfNear(); if (!camp.pit) return { s: 'blocked', text: 'Wolves come to a camp with meat and no fire.' }; return { s: w ? 'active' : 'idle', text: w ? `A wolf is ${nearAt(w, ...camp.pit)} tiles from the fire.` : 'No wolf near. A lit fire keeps them at the edge of the dark.' }; },
    offers(a){ const w = wolfNear(); if (!w || !pitLit() || a.traits.bravery < 0.35) return []; return [{ label: 'drive off the wolf with a firebrand', score: 72 + a.traits.bravery * 20, start: a => startDriveOff(a, w) }]; } },
  { id: 'scout', title: 'Found a second camp',
    state(){
      if (!camp.shelter) return { s: 'blocked', text: 'A camp sends people out only when it has a roof, and at least five people.' };
      if (camp.sentParty) return { s: 'done', text: `${camp.sentParty} set out for a new valley.` };
      if (camps.length >= 6) return { s: 'blocked', text: 'The valleys are taken. Six camps is all this world holds for now.' };
      const ready = campHumans().length >= 5 && tick - camp.founded > 8 * DAY && (seasonOf() === 'spring' || seasonOf() === 'summer');
      return { s: ready ? 'active' : 'blocked', text: `${campHumans().length}/5 people, camp ${Math.floor((tick - camp.founded) / DAY)}/8 days old. Parties leave in spring or summer. Two go with coals and food.` };
    },
    offers(a){ if (!camp.shelter || camp.sentParty || camps.length >= 6 || campHumans().length < 5 || tick - camp.founded <= 8 * DAY || !(seasonOf() === 'spring' || seasonOf() === 'summer') || a.traits.bravery < 0.5) return []; return [{ label: 'lead a party to a new valley', score: 40, start: a => startFoundCamp(a) }]; } },
  { id: 'caves', title: 'Search the caves',
    state(){
      if (!camp.site) return { s: 'blocked', text: 'Needs a camp first.' };
      const near = caves.filter(c => c.kind === 'water' && dist(c.exit.x, c.exit.y, ...camp.site) <= 40);
      if (!near.length) return { s: 'blocked', text: 'No cave mouth within forty tiles of the camp.' };
      const open = near.filter(c => !c.searched && !c.blocked), blocked = near.filter(c => c.blocked), done = near.filter(c => c.searched);
      if (!open.length && !blocked.length) return { s: 'done', text: `${done.length} cave${done.length > 1 ? 's' : ''} searched. Nothing left in the dark but the dark.` };
      const ready = camp.tools.spear && pitLit();
      return { s: ready ? 'active' : 'blocked', text: `${near.length} cave${near.length > 1 ? 's' : ''} near: ${open.length} unsearched, ${blocked.length} blocked by fallen rock. A brave person with a brand and the spear goes in; the brand lasts ${EMBER_LIFE} ticks. Fallen rock takes the axe.` };
    },
    offers(a){
      if (!camp.site || !camp.tools.spear || !pitLit() || a.traits.bravery < 0.5 || stage(a) === 'young' || a.hp < 60) return [];
      const near = caves.filter(c => c.kind === 'water' && dist(c.exit.x, c.exit.y, ...camp.site) <= 40); const out = [];
      for (const c of near){
        if (c.blocked && camp.tools.axe) out.push({ label: 'clear the fallen rock', score: 40, start: a => startClearRock(a, c) });
        else if (!c.blocked && !c.searched && (!c.claimed || !beings.some(b => b.alive && b.id === c.claimed))) out.push({ label: 'search the cave with a brand', score: 36 + a.traits.curiosity * 20, start: a => startSearchCave(a, c) });
      }
      return out;
    } },
  { id: 'dens', title: 'Clear a den',
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
      return { s: camp.tools.spear && pitLit() && party >= 2 ? 'active' : 'blocked', text: `${wild.length} den${wild.length > 1 ? 's' : ''} near: ${wild.map(c => c.owner === 'wolf' ? 'wolves' : 'foxes').join(', ')}. Two brave people with brands and the spear drive the beasts out. They dig a new den elsewhere, and come back if the fire fails for a day.` };
    },
    offers(a){
      if (!camp.site || !camp.tools.spear || !pitLit() || a.traits.bravery < 0.5 || stage(a) === 'young' || a.hp < 60) return [];
      const wild = caves.filter(c => c.kind === 'den' && c.owner && !c.cleared && dist(c.exit.x, c.exit.y, ...camp.site) <= 40);
      /* The den goes in the label, so a failed offer's cooldown (keyed on the label) does not cool down
         every other den too. */
      return wild.map(c => ({ label: `clear the den with brands (${c.owner === 'wolf' ? 'wolves' : 'foxes'} under the hill at ${c.exit.x},${c.exit.y})`, score: c.owner === 'wolf' ? 44 : 30, start: a => startClearDen(a, c) }));
    } },
];
function goalState(g){ if (g.locked) return { s: 'locked', text: g.locked }; return g.state(); }
function offersFor(a){
  const out = [];
  for (const g of GOALS){
    if (g.locked || !g.offers) continue; const pr = goalPriority[g.id] ?? 1; if (pr === 0) continue;
    if (goalState(g).s !== 'active') continue;
    for (const o of g.offers(a)) out.push({ ...o, goal: g, score: o.score * (pr === 2 ? 1.5 : 1) });
  }
  return out;
}
