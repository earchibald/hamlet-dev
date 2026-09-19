/* ---------- the sprites of the groves ---------- */
function spriteNear(){ if (!camp.pit) return null; return beings.filter(b => b.alive && b.species === 'sprite' && nearAt(b, ...camp.pit) <= 8).sort((p, q) => nearAt(p, ...camp.pit) - nearAt(q, ...camp.pit))[0] || null; }
TASKS.fightSprite = { type: 'guard',
  begin(a){ a.carrying = { kind: 'spear', count: 1 }; return { label: 'Going after the sprite with the spear', path: [], fast: true, progress: 0 }; },
  stops: [(a, t) => {
    const sp = beingById(t.args.sprite);
    if (!sp || !sp.alive || ++t.progress > CLOCK.chase.spearSprite || near(sp, a) > 14){ a.carrying = null; return 'done'; }
    if (near(a, sp) <= 1){
      const c = camp;
      if (rng() < 0.45 + a.skills.hunt * 0.1){ sp.hp -= 15; c.fae.favor = Math.max(-100, c.fae.favor - 10); if (sp.grove) sp.grove.anger = Math.min(100, sp.grove.anger + 15); c.fae.grudges[a.id] = (c.fae.grudges[a.id] || 0) + 30;
        if (sp.hp <= 0){ sp.lastHurt = `was killed by ${a.name}`; die(sp, 'was speared'); a.carrying = null; addThought(a, 'killedfae', 'Killed a sprite. Its light went out in my hands', -6, CLOCK.thought.killedfae); log(`${a.name} spears a sprite. It dies with a sound like a snapped string.`, campHumans(), 'bad'); return 'done'; }
        addThought(sp, 'struck', `Struck by ${a.name}`, -15, CLOCK.thought.struck);
        if (sp.traits.bravery > 0.6 && sp.hp > 10){ a.hp -= 6; a.needs.rest = Math.max(0, a.needs.rest - 25); addThought(a, 'bitten', 'Bitten and scratched by a sprite', -10, CLOCK.thought.bitten); log(`The sprite turns and fights. ${a.name} is bitten before it flies off.`, [a], 'bad'); }
        else { sp.returnAt = tick + CLOCK.sprite.returnAfter + rint(CLOCK.sprite.returnSpread); sp.target = c; log(`The sprite flees ${a.name}'s spear into the dark. It will not go alone next time.`, [a]); }
        failTask(sp); startTask(sp, 'flee'); a.carrying = null; return 'done';
      }
      addThought(sp, 'dodged', 'A human swung a spear at me', -8, CLOCK.thought.dodged); failTask(sp); startTask(sp, 'flee'); a.carrying = null; return 'done';
    }
    const q = bfs(a.x, a.y, a.z, (x, y, z) => z === sp.z && dist(x, y, sp.x, sp.y) <= 1, 400, a); if (!q) return 'fail'; t.path = q.slice(0, 3); return 'continue';
  }],
  release(a){ if (a.carrying && a.carrying.kind === 'spear') a.carrying = null; } };

/* Sprite actions. They live by night around a hollow pine. */
Object.assign(TASKS, {
  dance: { type: 'dance',
    begin(a){
      const g = a.grove; if (!g) return false; const p = pathToStop(a, g.x, g.y, 2); if (!p) return false;
      return { label: drowsy(a) ? 'Sleeping in the hollow pine' : 'Dancing in the grove', path: p, progress: 0 };
    },
    stops: [(a, t) => {
      const g = a.grove;
      const w = goTo(a, t, g.x, g.y, 2); if (w) return w;
      a.needs.glow = Math.min(100, a.needs.glow + CLOCK.rate.danceGlows); a.needs.rest = Math.min(100, a.needs.rest + CLOCK.rate.danceRests);
      if (!drowsy(a) && t.progress % CLOCK.sprite.danceSeen === 0) for (const h of humans()) if (h.camp && near(h, a) <= 7){ camp = h.camp; if (!camp.fae.known){ camp.fae.known = true; log(`${h.name} stumbles on a ring of lights dancing around a hollow pine in the ${g.sector.name.toLowerCase()}. The camp knows about the sprites now.`, campHumans(), 'major'); } addThought(h, 'sprite', h.traits.curiosity > 0.5 ? 'Saw sprites dancing in the grove' : 'Saw lights in the grove that were not fireflies', h.traits.curiosity > 0.5 ? 5 : -4, CLOCK.thought.spriteGrove); }
      if (beings.some(o => o !== a && o.alive && o.species === 'sprite' && near(o, a) <= 3)) a.needs.play = Math.min(100, a.needs.play + CLOCK.rate.dancePlays);
      if (++t.progress % CLOCK.sprite.mossEvery === 0 && rng() < CLOCK.sprite.mossChance && !items.some(i => i.kind === 'moss' && dist(i.x, i.y, g.x, g.y) <= 2)){ const q = nearFind(g.x, g.y, q => passable(q.x, q.y) && !itemAt(q.x, q.y), RING); if (q) addItem('moss', q.x, q.y); }
      return t.progress < CLOCK.sprite.dance ? 'continue' : 'done';
    }] },
  forage: { type: 'eat',
    begin(a){
      const hasFood = t => t.feature === 'bush' && t.berries > 0; const p = bfs(a.x, a.y, a.z, (x, y, z) => !!nearFind(x, y, hasFood, NEAR, z), 800, a); if (!p) return false;
      return { label: 'Picking berries in the dark', path: p };
    },
    stops: [(a) => { const hasFood = t => t.feature === 'bush' && t.berries > 0; const b = nearFind(a.x, a.y, hasFood, NEAR, a.z); if (!b) return 'fail'; b.berries--; a.needs.glow = Math.min(100, a.needs.glow + 30); return 'done'; }] },
  watch: { type: 'watch',
    begin(a, args){
      const c = camps.filter(c => c.pit && tileAt(...c.pit).struct.lit && nearAt(a, ...c.pit) <= 90 && !(c.ward && a.traits.bravery < 0.9)).sort((p, q) => nearAt(a, ...p.pit) - nearAt(a, ...q.pit))[0]; if (!c) return false;
      const r = c.ward ? 11 : 6; const p = pathToStop(a, c.pit[0], c.pit[1], r); if (!p) return false;
      args.camp = camps.indexOf(c); args.within = r;
      return { label: 'Drawn to the firelight', path: p, progress: 0 };
    },
    stops: [(a, t) => {
      const c = camps[t.args.camp], r = t.args.within;
      const w = goTo(a, t, c.pit[0], c.pit[1], r); if (w) return w;
      t.label = 'Watching the fire from the dark'; a.needs.play = Math.min(100, a.needs.play + CLOCK.rate.visitPlays);
      if (t.progress === 0){ camp = c; for (const h of campHumans()) if (near(h, a) <= 7 && !h.asleep){ if (!c.fae.known){ c.fae.known = true; log(`${h.name} sees a light dancing at the edge of the firelight. It is not a firefly. The camp knows about the sprites now.`, campHumans(), 'major'); } addThought(h, 'sprite', h.traits.curiosity > 0.5 ? 'Saw a sprite dancing in the dark' : 'Something watched us from the dark', h.traits.curiosity > 0.5 ? 4 : -4, CLOCK.thought.spriteCamp); } }
      if (++t.progress === CLOCK.sprite.visitGift && c.stone && c.fae.favor >= 20 && rng() < 0.5){ const st = tileAt(...c.stone).struct; if (!itemAt(c.stone[0], c.stone[1]) && st.offering === 0){ const gift = c.fae.favor >= 40 && rng() < 0.5 ? 'cord' : 'moss'; addItem(gift, c.stone[0], c.stone[1]); camp = c; log(gift === 'cord' ? 'A coil of cord lies on the offering stone in the morning, knotted by small hands.' : 'A tuft of glowing moss lies on the offering stone in the morning.', campHumans(), 'good'); } }
      return t.progress < CLOCK.sprite.visit && isNight() ? 'continue' : 'done';
    }] },
  collect: { type: 'collect',
    begin(a, args){
      const c = camps.find(c => c.stone && tileAt(...c.stone).struct.offering > 0 && nearAt(a, ...c.stone) <= 50 && !c.ward); if (!c) return false;
      const p = pathToStop(a, c.stone[0], c.stone[1], 1); if (!p) return false;
      args.camp = camps.indexOf(c);
      return { label: 'Sniffing out a gift', path: p };
    },
    stops: [(a, t) => {
      const c = camps[t.args.camp];
      const w = goTo(a, t, c.stone[0], c.stone[1], 1); if (w) return w;
      const st = tileAt(...c.stone).struct; if (st.offering <= 0) return 'fail'; st.offering = 0; a.needs.glow = 100; a.needs.play = Math.min(100, a.needs.play + 30);
      c.fae.favor = Math.min(100, c.fae.favor + 10); for (const k in c.fae.grudges) c.fae.grudges[k] = Math.max(0, c.fae.grudges[k] - 10); if (a.grove) a.grove.anger = Math.max(0, a.grove.anger - 5);
      addThought(a, 'gift', 'Humans left berries for us', 8, CLOCK.thought.giftTaken); camp = c; log('The berries on the offering stone are gone by morning.', campHumans(), 'good'); return 'done';
    }] },
  prank: { type: 'prank',
    begin(a, args){
      const angry = camps.filter(c => c.pit && !c.ward && nearAt(a, ...c.pit) <= 70 && (c.fae.favor < -20 || (a.grove && (a.grove.swarmUntil > tick || a.grove.anger > 30)) || Object.values(c.fae.grudges).some(g => g > 20)) && tick - c.fae.lastPrank > CLOCK.sprite.prankGap);
      const c = angry.sort((p, q) => p.fae.favor - q.fae.favor)[0]; if (!c) return false;
      const p = pathToStop(a, c.stashTile[0], c.stashTile[1], 1); if (!p) return false;
      args.camp = camps.indexOf(c);
      return { label: 'Slipping into the camp with mischief in mind', path: p, fast: true };
    },
    stops: [(a, t) => {
      const c = camps[t.args.camp];
      const w = goTo(a, t, c.stashTile[0], c.stashTile[1], 1); if (w) return w;
      camp = c; c.fae.lastPrank = tick; a.needs.play = 100;
      if (!c.fae.known){ c.fae.known = true; log('Something small and angry has been in the camp in the night. The camp knows about the sprites now, and not in a good way.', campHumans(), 'major'); }
      const grudged = campHumans().filter(h => (c.fae.grudges[h.id] || 0) > 20), victim = grudged[rint(grudged.length)] || campHumans().filter(h => h.asleep)[0];
      const pit = pitTile(); const severe = c.fae.favor < -60 || (a.grove && a.grove.swarmUntil > tick);
      if (severe && pit && pit.struct.lit && rng() < 0.5){ pit.struct.lit = false; pit.struct.fuel = Math.min(pit.struct.fuel, 30); c.streak = 0; log('The fire dies to nothing in a moment, as if pinched out. Laughter in the dark.', campHumans(), 'bad'); for (const h of campHumans()) addThought(h, 'faefire', 'Sprites put the fire out', -10, CLOCK.thought.faefire); }
      else if (victim && rng() < 0.6){ victim.needs.rest = Math.max(0, victim.needs.rest - 40); victim.asleep = false; addThought(victim, 'pinched', 'Pinched and tangled by sprites all night', -8, CLOCK.thought.pinched); log(`${victim.name} wakes with knotted hair and pinch marks. The sprites are not amused.`, [victim], 'bad'); }
      else if (c.fae.favor < -20 && (c.stash.pot > 0 || c.stash.cord > 0 || c.tools.basket) && rng() < 0.5){
        if (c.stash.pot > 0){ stashTake('pot'); log('A pot is gone from the stash, and there are tiny footprints in the clay.', campHumans(), 'bad'); }
        else if (c.stash.cord > 0){ stashTake('cord', Math.min(2, c.stash.cord)); log('A coil of cord is gone from the stash. Something small has been busy.', campHumans(), 'bad'); }
        else { c.tools.basket = 0; log('The basket is gone from the stash, and the tiny footprints lead into the dark.', campHumans(), 'bad'); }
        for (const h of campHumans()) addThought(h, 'stolen', 'Sprites took something we made', -5, CLOCK.thought.stolen);
      }
      else { const k = c.stash.cooked > 0 ? 'cooked' : c.stash.berries > 0 ? 'berries' : c.stash.smoked > 0 ? 'smoked' : null; if (k){ stashTake(k, Math.min(3, c.stash[k])); log('Food is missing from the stash, and there are tiny footprints in the ash.', campHumans(), 'bad'); for (const h of campHumans()) addThought(h, 'stolen', 'Sprites took our food', -5, CLOCK.thought.stolen); } }
      addThought(a, 'prank', 'Played a trick on the humans', 10, CLOCK.thought.prank); return 'done';
    }] },
});

/* Once each CLOCK.every.fae ticks a camp's favour with the sprites does its work: extra berries or blight, drift toward 0, moss light, snares in a grove. */
function faeTick(){
  if (camp.fae.favor >= 30 && camp.site){ for (let k = 0; k < 6; k++){ const t = tileAt(camp.site[0] + rint(21) - 10, camp.site[1] + rint(21) - 10); if (t && t.feature === 'bush' && t.berries < 5 && !isWinter()) t.berries++; } }
  if (camp.fae.blightUntil > tick && camp.site){ for (let k = 0; k < 10; k++){ const t = tileAt(clamp(camp.site[0] + rint(25) - 12, 0, W - 1), clamp(camp.site[1] + rint(25) - 12, 0, H - 1)); if (t.feature === 'bush' && t.berries > 0) t.berries--; } }
  if (camp.fae.favor > 0) camp.fae.favor = Math.max(0, camp.fae.favor - 1); else if (camp.fae.favor < 0 && camp.fae.blightUntil < tick) camp.fae.favor = Math.min(0, camp.fae.favor + 1);
  if (camp.fae.known && camp.stash.moss > 0 && isNight()) for (const h of campHumans()) addThought(h, 'mosslight', 'The glowing moss shines softly in the stash', 2, CLOCK.thought.mosslight);
  for (const g of groves) if (camp.snares.some(sn => secOf(sn.x, sn.y).sx === g.sector.sx && secOf(sn.x, sn.y).sy === g.sector.sy)){ g.anger = Math.min(100, g.anger + 2); camp.fae.favor = Math.max(-100, camp.fae.favor - 2); }
  for (const g of groves) if (g.cave) for (const h of campHumans()){ const t = tileAt(h.x, h.y, h.z); if (!t || t.cave !== g.cave) continue;
    camp.fae.favor = Math.max(-100, camp.fae.favor - 5); addThought(h, 'inhollow', 'Stood in the sprites\' hollow. It felt watched', -3, CLOCK.thought.inhollow);
    for (const o of beings) if (o.alive && o.species === 'sprite' && o.grove === g) addThought(o, 'intruder', `${h.name} came into our hollow`, -8, CLOCK.thought.intruderSprite); }
}
/* Groves calm down over time and bear a new sprite in a quiet spring. */
function groveTick(){
  if (tick % CLOCK.grove.every === 0) for (const g of groves){ g.anger = Math.max(0, g.anger - 1); const kin = beings.filter(b => b.alive && b.species === 'sprite' && b.grove === g);
    if (seasonOf() === 'spring' && kin.length < 5 && g.anger < 20 && tick - g.lastBirth > CLOCK.grove.birthGap && sectorCount(g.sector, 'oldpines', t => t.feature === 'tree' && tick - (t.planted || 0) > CLOCK.grove.oldPine) > 25 && rng() < CLOCK.grove.birthChance){ g.lastBirth = tick; const q = nearFind(g.x, g.y, q => passable(q.x, q.y), RING); if (q){ const sp = makeBeing('sprite', q.x, q.y, null, 0); sp.born = tick; sp.grove = g; beings.push(sp); } } }
}
