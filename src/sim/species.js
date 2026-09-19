/* Life clocks, in days. adult: grown up. old: slows down. life: the usual span. */
const LIFE = { sprite: { adult: 10, old: 150, life: 200 }, human: { adult: 16, old: 60, life: 84 }, rabbit: { adult: 3, old: 14, life: 20 }, deer: { adult: 8, old: 36, life: 50 }, fox: { adult: 5, old: 26, life: 36 }, wolf: { adult: 6, old: 32, life: 46 }, gnome: { adult: 20, old: 80, life: 110, seed: 35 } };
const ageDays = a => (tick - a.born) / DAY;
const stage = a => { const L = LIFE[a.species]; const d = ageDays(a); return d < L.adult ? 'young' : d < L.old ? 'adult' : 'old'; };
const SPECIES = {
  human:  { glyph: '@', label: 'human',  plural: 'people', decay: { food: tickRate(0.035), water: tickRate(0.05), rest: tickRate(0.03), social: tickRate(0.02), warmth: tickRate(0) }, stride: ticks(2), zmin: -2, zmax: 2 },
  rabbit: { glyph: 'r', label: 'rabbit', plural: 'rabbits', decay: { food: tickRate(0.07), rest: tickRate(0.03) }, stride: ticks(2), zmin: 0, zmax: 0, prey: true },
  fox:    { glyph: 'f', label: 'fox',    plural: 'foxes', decay: { food: tickRate(0.025), water: tickRate(0.04), rest: tickRate(0.02) }, stride: ticks(2), zmin: -2, zmax: 2, bite: { hp: 6, spread: 5, mood: -8 }, hunter: true },
  wolf:   { glyph: 'w', label: 'wolf',   plural: 'wolves', decay: { food: tickRate(0.02), water: tickRate(0.03), rest: tickRate(0.02) }, stride: ticks(2), zmin: -2, zmax: 2, bite: { hp: 20, spread: 15, mood: -20 }, hunter: true },
  deer:   { glyph: 'd', label: 'deer',   plural: 'deer', decay: { food: tickRate(0.05), water: tickRate(0.04), rest: tickRate(0.03) }, stride: ticks(2), zmin: 0, zmax: 2, prey: true },
  sprite: { glyph: '¤', label: 'sprite', plural: 'sprites', decay: { glow: tickRate(0.03), play: tickRate(0.04), rest: tickRate(0.02) }, stride: ticks(1), zmin: -2, zmax: 2, fae: true },
  gnome:  { glyph: 'g', label: 'gnome',  plural: 'gnomes', decay: { food: tickRate(0.03), rest: tickRate(0.03), social: tickRate(0.02) }, stride: ticks(2), zmin: -2, zmax: 2, folk: true },
};
const NAMES = ['Ada','Bram','Cora','Dov','Esk','Fen','Greta','Hal','Iva','Jory','Kit','Lune','Mott','Nell','Orrin','Pim','Quill','Rook','Sable','Tam','Ulla','Voss','Wren','Yara'];

/* Each species has its hours. Rabbits and deer move at dawn and dusk. Foxes and wolves move at night. */
function drowsy(a){
  const h = hourOf();
  if (a.species === 'sprite') return h >= 6 && h < 19;
  if (a.species === 'gnome') return h >= 6 && h < 19;
  if (a.species === 'rabbit' || a.species === 'deer') return !((h >= 5 && h < 9) || (h >= 16 && h < 21));
  if (a.species === 'fox' || a.species === 'wolf') return h >= 7 && h < 18;
  return false;
}

/* Animal actions. Foxes and wolves hunt, raid, and stalk. Deer keep the herd. */
Object.assign(TASKS, {
  hunt: { type: 'hunt',
    begin(a, args){
      const wantsDeer = a.species === 'wolf' && (isWinter() || a.needs.food < 30);
      const prey = beings.filter(b => b.alive && (b.species === 'rabbit' || (wantsDeer && b.species === 'deer')) && near(b, a) <= (a.species === 'wolf' ? 50 : 40))
        .sort((p, q) => (near(p, a) - (p.species === 'deer' ? 15 : 0)) - (near(q, a) - (q.species === 'deer' ? 15 : 0)))[0];
      if (!prey) return false;
      if (near(a, prey) > 9){
        const p = pathToStop(a, prey.x, prey.y, 8); if (!p) return false;
        setTask(a, 'walk', {}, { type: 'travel', label: 'Prowling toward the meadow', path: p });
        return true;
      }
      args.prey = prey.id;
      return { label: `Stalking a ${prey.species}`, path: [], fast: true, progress: 0 };
    },
    stops: [(a, t) => {
      const prey = beingById(t.args.prey);
      if (!prey || !prey.alive || ++t.progress > CLOCK.chase.wolf + a.skills.hunt * CLOCK.chase.wolfPerSkill){ if (prey && prey.alive && near(a, prey) <= 4){ prey.xp.wary = (prey.xp.wary || 0) + 1; if (prey.xp.wary >= 2){ prey.xp.wary = 0; prey.skills.wary = Math.min(3, (prey.skills.wary || 0) + 1); } addThought(prey, 'chased', 'Was nearly caught', -6, CLOCK.thought.chased); } return 'fail'; }
      if (near(a, prey) <= 1){
        if (prey.species === 'deer' && rng() > 0.45 + a.skills.hunt * 0.1){ addThought(prey, 'escaped', 'Broke free from a wolf', -8, CLOCK.thought.escaped); prey.hp -= 15; prey.skills.wary = Math.min(3, (prey.skills.wary || 0) + 1); failTask(prey); startTask(prey, 'flee'); return 'fail'; }
        prey.hp = 0; gainXp(a, 'hunt'); die(prey, `was caught by a ${SPECIES[a.species].label}`);
        if (a.den && prey.species === 'rabbit' && nearAt(a, a.den.exit.x, a.den.exit.y) <= 30){ const it = itemAt(prey.x, prey.y, prey.z); if (it && it.kind === 'carcass'){ a.carrying = { kind: 'carcass', count: 1 }; const r = chain(a, t, startTask(a, 'carryHome')); if (r){ removeItem(it); return r; } a.carrying = null; } }
        t.label = 'Eating'; a.needs.food = 100; addThought(a, 'fed', 'Made a kill', 8, CLOCK.thought.fed); return 'done'; }
      const p = bfs(a.x, a.y, a.z, (x, y, z) => z === prey.z && dist(x, y, prey.x, prey.y) <= 1, 400, a); if (!p) return 'fail';
      t.path = p.slice(0, 3); return 'continue';
    }] },
  raid: { type: 'raid',
    begin(a, args){
      const c = campNear(a, 45); if (!c || !c.pit || c.storehouse || tileAt(...c.pit).struct.lit || (a.cooldown.raid || 0) > tick) return false;
      if (c.stash.carcass + c.stash.fish + c.stash.cooked + c.stash.smoked <= 0) return false;
      const [sx, sy] = c.stashTile; const p = pathToStop(a, sx, sy, 1); if (!p) return false;
      args.camp = camps.indexOf(c); args.at = [sx, sy];
      return { label: 'Slinking toward the dark camp', path: p, fast: true };
    },
    stops: [(a, t) => {
      const c = camps[t.args.camp]; const [sx, sy] = t.args.at;
      const g = goTo(a, t, sx, sy, 1); if (g) return g;
      const prev = camp; camp = c;
      const k = c.stash.carcass > 0 ? 'carcass' : c.stash.fish > 0 ? 'fish' : c.stash.cooked > 0 ? 'cooked' : c.stash.smoked > 0 ? 'smoked' : null;
      if (k){ stashTake(k); a.needs.food = 100; a.cooldown.raid = tick + CLOCK.cooldown.raid; if (tick - c.wolfLogged > CLOCK.cooldown.wolfLine){ c.wolfLogged = tick; log(`A wolf slips into the dark camp and takes the ${ITEMS[k].name} from the stash.`, campHumans(), 'bad'); } for (const h of campHumans()) addThought(h, 'wolf', 'A wolf came into camp in the night', -12, CLOCK.thought.wolf); }
      camp = prev; return 'done';
    }] },
  stalk: { type: 'stalk',
    begin(a, args){
      if (a.species !== 'wolf' || !isNight() || a.needs.food > 35) return false;
      /* `cooldown.stalked` sits on the person, not on the wolf above, so one more wolf cannot halve
         the wait between two maulings of the same person. */
      const lone = humans().filter(h => !(tick < (h.cooldown.stalked || 0)) && !humans().some(o => o !== h && near(o, h) <= 5) && !(h.camp && h.camp.pit && tileAt(...h.camp.pit).struct.lit && nearAt(h, ...h.camp.pit) <= 8) && near(h, a) <= 30 && !(h.carrying && h.carrying.kind === 'ember'));
      const h = lone.sort((p, q) => near(p, a) - near(q, a))[0]; if (!h) return false;
      args.who = h.id;
      return { label: 'Stalking someone alone in the dark', path: [], fast: true, progress: 0 };
    },
    stops: [(a, t) => {
      const h = beingById(t.args.who);
      /* The wait is read here as well as in the gate. A wolf that set out before another wolf reached
         the same person is already past the gate, and four of them mauled one founder in three ticks. */
      if (!h || !h.alive || tick < (h.cooldown.stalked || 0) || ++t.progress > CLOCK.chase.stalk || (h.carrying && h.carrying.kind === 'ember')) return 'fail';
      if (near(a, h) <= 1){ h.hp -= 20 + rint(15); h.lastHurt = 'was killed by a wolf'; h.lastHurtAt = tick; h.asleep = false; addThought(h, 'mauled', 'Mauled by a wolf in the dark', -22, CLOCK.thought.mauled); drift(h, 'bravery', -0.04); log(`A wolf comes out of the dark and mauls ${h.name}.`, [h], 'bad'); a.cooldown.stalk = tick + CLOCK.cooldown.stalk; h.cooldown.stalked = tick + CLOCK.cooldown.stalked; a.needs.food = Math.min(100, a.needs.food + 40); failTask(h); startTask(h, 'flee'); return 'done'; }
      const p = bfs(a.x, a.y, a.z, (x, y, z) => z === h.z && dist(x, y, h.x, h.y) <= 1, 500, a); if (!p) return 'fail'; t.path = p.slice(0, 3); return 'continue';
    }] },
  herd: { type: 'wander',
    begin(a){
      const kin = beings.filter(b => b.alive && b !== a && b.species === a.species && near(b, a) <= 30).sort((p, q) => near(p, a) - near(q, a))[0];
      if (!kin || near(kin, a) <= 4) return false;
      const p = bfs(a.x, a.y, a.z, (x, y, z) => z === kin.z && dist(x, y, kin.x, kin.y) <= 3, 600, a); if (!p) return false;
      setTask(a, 'walk', {}, { type: 'wander', label: 'Rejoining the herd', path: p });
      return true;
    },
    stops: [() => 'done'] },
  scavenge: { type: 'eat',
    begin(a, args){
      let found = null; const p = bfs(a.x, a.y, a.z, (x, y, z) => { const it = itemAt(x, y, z); if (it && (it.kind === 'carcass' || it.kind === 'venison') && !it.reservedBy){ found = it; return true; } return false; }, 500, a); if (!p) return false;
      args.item = found.id;
      return { label: 'Going to a carcass', path: p, progress: 0 };
    },
    stops: [(a, t) => {
      const found = items.find(i => i.id === t.args.item); if (!found) return 'fail';
      t.label = 'Eating'; if (++t.progress < CLOCK.task.eatCarcass) return 'continue'; if (found.kind === 'venison' && rng() < 0.6){ a.needs.food = 100; return 'done'; } removeItem(found); a.needs.food = 100; return 'done';
    }] },
  /* Go home to the den and rest there. */
  home: { type: 'travel',
    begin(a){
      const c = a.den; if (!c) return false;
      const floor = c.tiles.filter(t => passable(t.x, t.y, t.z)); if (!floor.length) return startTask(a, 'rest');
      const spot = floor[a.id % floor.length];
      if (a.x === spot.x && a.y === spot.y && a.z === spot.z){ setTask(a, 'rest', {}, { label: 'Resting in the den', wait: CLOCK.task.denRest }); return true; }
      const p = pathToStop(a, spot.x, spot.y, 0, spot.z); if (!p) return startTask(a, 'rest');
      setTask(a, 'walkTo', { at: [spot.x, spot.y, spot.z], within: 0 }, { label: 'Going home to the den', path: p });
      return true;
    },
    stops: [() => 'done'] },
  /* Carry a kill home and eat it there. */
  carryHome: { type: 'travel',
    begin(a, args){
      const c = a.den; if (!c || !a.carrying) return false;
      const floor = c.tiles.filter(t => passable(t.x, t.y, t.z)); if (!floor.length) return false;
      const spot = floor[a.id % floor.length];
      const p = pathToStop(a, spot.x, spot.y, 0, spot.z); if (!p) return false;
      args.at = [spot.x, spot.y, spot.z];
      return { label: 'Carrying the kill home', path: p, fast: false };
    },
    stops: [(a, t) => {
      const [sx, sy, sz] = t.args.at;
      const g = goTo(a, t, sx, sy, 0, sz); if (g) return g;
      a.carrying = null; a.needs.food = 100; addThought(a, 'fed', 'Ate at home', 8, CLOCK.thought.fed); log(`A ${SPECIES[a.species].label} drags its kill into the den.`, []); return 'done';
    }],
    release(a, t){ if (a.carrying){ addItem(a.carrying.kind, a.x, a.y, a.z); a.carrying = null; } } },
  /* Eat mushrooms off the burrow's patch. */
  shrooms: { type: 'eat',
    begin(a, args){
      const c = a.den; if (!c) return false;
      const ripe = c.patch.filter(t => t.feature === 'mushrooms' && t.shrooms > 0); if (!ripe.length) return false;
      const t = ripe[a.id % ripe.length]; const p = pathToStop(a, t.x, t.y, 1, 0); if (!p) return false;
      args.at = [t.x, t.y];
      return { label: 'Picking mushrooms on the patch', path: p, progress: 0 };
    },
    stops: [(a, k) => {
      const [x, y] = k.args.at; const t = tileAt(x, y, 0);
      const g = goTo(a, k, x, y, 1, 0); if (g) return g;
      if (!t || t.shrooms <= 0) return 'fail'; if (++k.progress < CLOCK.task.eatShrooms) return 'continue'; t.shrooms--; a.needs.food = Math.min(100, a.needs.food + 35); return a.needs.food < 70 && t.shrooms > 0 ? 'continue' : 'done';
    }] },
  /* Keep company with the burrow's kin. */
  huddle: { type: 'socialize',
    begin(a, args){
      const kin = beings.filter(b => b.alive && b !== a && b.species === a.species && b.den === a.den).sort((p, q) => near(p, a) - near(q, a))[0];
      if (!kin) return false;
      if (near(kin, a) <= 1){ args.kin = kin.id; return { label: 'Chattering with kin', path: [], wait: CLOCK.task.kinChat }; }
      const p = bfs(a.x, a.y, a.z, (x, y, z) => z === kin.z && dist(x, y, kin.x, kin.y) <= 1, 600, a); if (!p) return false;
      setTask(a, 'walk', {}, { type: 'socialize', label: 'Going to kin', path: p });
      return true;
    },
    stops: [(a, t) => {
      /* The old task held the kin itself and never asked whether it still lived. Kin that has left the list gets nothing; the rest is as it was. */
      const kin = beingById(t.args.kin);
      a.needs.social = Math.min(100, a.needs.social + 30); if (kin) kin.needs.social = Math.min(100, kin.needs.social + 20); return 'done';
    }] },
  /* At night, a gnome with a bench borrows one made thing from a camp stash within 40 tiles. Never from a warded camp. */
  borrow: { type: 'borrow',
    begin(a, args){
      const c = a.den; if (!c || !c.bench || c.holding || !isNight()) return false;
      if (c.lastRepaid && tick - c.lastRepaid < CLOCK.gnome.repayGap) return false;
      const cands = camps.filter(k => k.stashTile && !k.ward && dist(k.stashTile[0], k.stashTile[1], c.exit.x, c.exit.y) <= 40 && (k.stash.pot > 0 || k.stash.cord > 0 || k.tools.basket));
      const k = cands.sort((p, q) => dist(p.stashTile[0], p.stashTile[1], c.exit.x, c.exit.y) - dist(q.stashTile[0], q.stashTile[1], c.exit.x, c.exit.y))[0]; if (!k) return false;
      const [sx, sy] = k.stashTile; const p = pathToStop(a, sx, sy, 1); if (!p) return false;
      args.camp = camps.indexOf(k); args.at = [sx, sy];
      return { label: 'Slipping over to the camp for something useful', path: p, fast: true };
    },
    stops: [(a, t) => {
      const c = a.den, k = camps[t.args.camp]; const [sx, sy] = t.args.at;
      const g = goTo(a, t, sx, sy, 1); if (g) return g;
      if (c.holding) return 'fail';
      const kind = k.stash.pot > 0 ? 'pot' : k.stash.cord > 0 ? 'cord' : k.tools.basket ? 'basket' : null; if (!kind) return 'fail';
      const prev = camp; camp = k; c.holding = { kind, camp: k, since: tick };
      if (kind === 'basket') k.tools.basket = 0; else stashTake(kind, 1);
      addThought(a, 'borrowed', 'Borrowed a clever thing', 6, CLOCK.thought.borrowed);
      log(`${kind === 'basket' ? 'The basket' : `A ${ITEMS[kind].name}`} is gone from the stash. Small footprints lead toward the meadow.`, campHumans(), 'bad');
      if (!k.gnomes.known){ k.gnomes.known = true; }
      camp = prev; return 'done';
    }] },
  /* Two days on, the thing comes back with a gift beside it. */
  repay: { type: 'repay',
    begin(a, args){
      const c = a.den; if (!c || !c.holding || tick - c.holding.since < CLOCK.limit.gnomeHolds) return false;
      const k = c.holding.camp; if (!k.stashTile) return false;
      const [sx, sy] = k.stashTile; const p = pathToStop(a, sx, sy, 1); if (!p) return false;
      args.camp = camps.indexOf(k); args.at = [sx, sy];
      return { label: 'Carrying the thing back, with a gift', path: p };
    },
    stops: [(a, t) => {
      const c = a.den, k = camps[t.args.camp]; const [sx, sy] = t.args.at;
      const g = goTo(a, t, sx, sy, 1); if (g) return g;
      const h = c.holding; if (!h) return 'fail'; const prev = camp; camp = k; if (h.kind === 'basket') k.tools.basket = 1; else stashAdd(h.kind, 1);
      const gift = ['cord', 'clay', 'pot'][rint(3)]; stashAdd(gift, 1); c.holding = null; c.lastRepaid = tick;
      addThought(a, 'repaid', 'Paid a debt', 5, CLOCK.thought.repaid); for (const o of campHumans()) addThought(o, 'gnomegift', 'The neighbours brought something back, and more', 5, CLOCK.thought.gnomegift);
      log(`The ${h.kind === 'basket' ? 'basket' : ITEMS[h.kind].name} is back in the stash, and a ${ITEMS[gift].name} beside it. Neighbours, then.`, campHumans(), 'good');
      camp = prev; return 'done';
    }] },
});

/* Wildlife comes and goes: rabbits breed and return, fawns in spring, wolves and foxes wander in from the edges. */
function spawnWildlife(){
  /* Rabbits breed in the warm seasons. Kits are born beside two grown rabbits. */
  if (tick % CLOCK.spawn.rabbitLitter.every === 0 && !isWinter()){
    const rs = beings.filter(b => b.alive && b.species === 'rabbit'); const cap = seasonOf() === 'spring' ? 20 : 15;
    if (rs.length < cap){ const p = rs.find(r => stage(r) === 'adult' && rs.some(o => o !== r && stage(o) === 'adult' && near(o, r) <= 10));
      if (p && rng() < CLOCK.spawn.rabbitLitter.chance){ const q = nearFind(p.x, p.y, q => passable(q.x, q.y) && !beings.some(b => b.alive && b.x === q.x && b.y === q.y), RING); if (q){ const k = makeBeing('rabbit', q.x, q.y, null, 0); k.born = tick; beings.push(k); } } }
  }
  /* Rabbits return to the meadows, if the gods made rabbits. */
  if (tick % CLOCK.spawn.rabbitStray.every === 0 && wasMade('rabbit') && beings.filter(b => b.alive && b.species === 'rabbit').length < (isWinter() ? 6 : 10)){
    for (let k = 0; k < 40; k++){ const t = world[rint(W * H)]; const s = sectorOfTile(t); if ((s.biome === 'meadow' || s.biome === 'wetland') && passable(t.x, t.y) && nearFind(t.x, t.y, q => q.feature === 'bush', RING) && !humans().some(h => nearAt(h, t.x, t.y) < 8)){ beings.push(makeBeing('rabbit', t.x, t.y, null, 0)); break; } }
  }
  if (tick % CLOCK.spawn.fawn.every === CLOCK.spawn.fawn.at && seasonOf() === 'spring' && beings.filter(b => b.alive && b.species === 'deer').length < 9){
    const doe = beings.find(b => b.alive && b.species === 'deer'); if (doe){ const q = nearFind(doe.x, doe.y, q => passable(q.x, q.y) && !beings.some(b => b.alive && b.x === q.x && b.y === q.y), RING); if (q){ const f = makeBeing('deer', q.x, q.y, null, 0); f.born = tick; beings.push(f); log('A fawn is on its feet in the meadow.', []); } }
    else if (wasMade('deer')) for (let k = 0; k < 60; k++){ const t = world[rint(W * H)]; if (sectorOfTile(t).biome === 'meadow' && passable(t.x, t.y) && !humans().some(h => nearAt(h, t.x, t.y) < 20)){ beings.push(makeBeing('deer', t.x, t.y, null, 0)); beings.push(makeBeing('deer', t.x, t.y, null, 0)); break; } }
  }
  if (tick % CLOCK.spawn.wolf.every === CLOCK.spawn.wolf.at && wasMade('wolf') && beings.filter(b => b.alive && b.species === 'wolf').length < 2){
    for (let k = 0; k < 40; k++){ const t = world[rint(W * H)]; const st = sectorOfTile(t); if (st.biome === 'forest' && passable(t.x, t.y) && !humans().some(h => nearAt(h, t.x, t.y) < 25)){ const w = makeBeing('wolf', t.x, t.y, null, 0); beings.push(w); adoptDen(w); break; } }
  }
  if (tick % CLOCK.spawn.fox.every === 0 && wasMade('fox') && beings.filter(b => b.alive && b.species === 'fox').length < 2){
    for (let k = 0; k < 40; k++){ const t = world[rint(W * H)]; const s = sectorOfTile(t); if ((s.biome === 'forest' || s.biome === 'rocky') && passable(t.x, t.y) && !humans().some(h => nearAt(h, t.x, t.y) < 15)){ const f = makeBeing('fox', t.x, t.y, null, 0); beings.push(f); adoptDen(f); break; } }
  }
}

/* An edge-arrived wolf or fox joins the nearest den of its own kind that has room for a breeding pair. */
function adoptDen(a){
  const open = caves.filter(c => c.kind === 'den' && c.owner === a.species && !c.cleared &&
    beings.filter(b => b.alive && b.den === c && stage(b) !== 'young').length < 2);
  const c = open.sort((p, q) => dist(a.x, a.y, p.exit.x, p.exit.y) - dist(a.x, a.y, q.exit.x, q.exit.y))[0];
  if (c){ a.den = c; log(`A ${SPECIES[a.species].label} has found the den under the hill and stays.`, []); }
}

/* Each den with two grown owners bears one young in spring, once a year. Edge arrivals are the floor, not the source. */
function denTick(){
  if (tick % CLOCK.den.birthEvery === 0 && seasonOf() === 'spring') for (const c of caves){
    if (c.kind !== 'den' || !c.owner || c.owner === 'sprite') continue;
    if (c.lastBirth && tick - c.lastBirth < CLOCK.den.birthGap) continue;
    const grown = beings.filter(b => b.alive && b.species === c.owner && b.den === c && stage(b) !== 'young');
    if (grown.length < 2) continue;
    const floor = c.tiles.filter(t => passable(t.x, t.y, t.z)); if (!floor.length) continue;
    const y = makeBeing(c.owner, 0, 0, null, 0); const t = floor[y.id % floor.length]; y.x = t.x; y.y = t.y; y.z = t.z; y.born = tick; y.den = c; beings.push(y); c.lastBirth = tick;
    log(c.owner === 'wolf' ? 'A wolf pup is born in the den under the hill.' : 'Fox kits are born in the den under the hill.', []);
  }
  /* Displaced owners dig a new den within CLOCK.den.digAfter, on a hill with no den of theirs. A failed
     try (no hill would take a den) waits CLOCK.den.digRetry before trying again, so a den-less wolf does
     not draw a shuffle every single tick. */
  for (const w of beings){ if (!w.alive || !w.oldDen || w.den || tick - w.oldDen.clearedAt < CLOCK.den.digAfter || (w.digAgain || 0) > tick) continue;
    const oldDen = w.oldDen, owner = w.species;
    const others = hills.filter(h => h !== oldDen.hill && !caves.some(c => c.kind === 'den' && c.hill === h && c.owner === owner && !c.cleared));
    let fresh = null; for (const h of shuffle(others)){ fresh = digDen(h, owner); if (fresh) break; }
    if (fresh){ fresh.from = oldDen; for (const o of beings) if (o.alive && o.oldDen === oldDen && !o.den){ o.den = fresh; o.oldDen = null; } fresh.story.push('Dug after the old den was taken.'); log(owner === 'wolf' ? 'The wolves have dug a new den under another hill.' : 'The foxes have dug a new den under another hill.', []); }
    else w.digAgain = tick + CLOCK.den.digRetry;
  }
  /* A cleared den goes back to its owners when the camp's fire has been out CLOCK.den.campDark. Both
     owners who redug elsewhere and owners still homeless come home. */
  for (const c of caves){ if (c.kind !== 'den' || !c.cleared) continue; const k = c.cleared;
    const out = k.pit && !tileAt(...k.pit).struct.lit && k.outSince && tick - k.outSince >= CLOCK.den.campDark;
    if (out){ const fresh = caves.find(fc => fc.kind === 'den' && fc.owner === c.owner && fc.from === c);
      const kin = beings.filter(b => b.alive && b.species === c.owner && ((b.oldDen === c && !b.den) || (b.den && b.den.from === c)));
      for (const b of kin){ b.den = c; b.oldDen = null; }
      if (fresh){ fresh.owner = null; fresh.abandoned = true; }
      c.cleared = null; c.story.push('Taken back when the fire failed.');
      const prev = camp; camp = k;
      if (kin.length) log(`With the fire out a day, the ${c.owner === 'wolf' ? 'wolves are' : 'foxes are'} back in the den under the hill.`, campHumans(), 'bad');
      else log('The den under the hill stands empty; nothing has come back to it.', campHumans(), 'info');
      camp = prev; }
  }
}

/* A grown owner standing in its den attacks any person on the den's tiles, by day or night, brand or no brand.
   One bite each CLOCK.den.biteGap, shared by the whole den: the cooldown lives on the den, not the animal,
   so two grown owners cannot both bite the same person in one tick. */
function defendDen(a){
  const c = a.den, bite = SPECIES[a.species].bite; if (!c || !bite || stage(a) === 'young' || (c.lastBite || 0) + CLOCK.den.biteGap > tick) return;
  const here = tileAt(a.x, a.y, a.z); if (!here || here.cave !== c) return;
  const h = beings.find(b => b.alive && b.species === 'human' && b.z === a.z && c.tiles.some(t => t.x === b.x && t.y === b.y && t.z === b.z));
  if (!h) return;
  const label = SPECIES[a.species].label;
  h.hp -= bite.hp + rint(bite.spread); h.lastHurt = `was killed in a den by a ${label}`; h.lastHurtAt = tick; h.asleep = false;
  addThought(h, 'denbite', `Bitten by a ${label} in its den`, bite.mood, CLOCK.thought.denbite); drift(h, 'bravery', -0.02);
  log(`A ${label} comes at ${h.name} in its den.`, [h], 'bad');
  c.lastBite = tick; addThought(a, 'defend', 'Drove an intruder from the den', 6, CLOCK.thought.defend);
  failTask(h); startTask(h, 'flee');
}

/* Once each CLOCK.gnome.every ticks the burrows look about them. A camp's workshop within 40 tiles is copied within a few days. */
function gnomeTick(){
  if (tick % CLOCK.gnome.every !== 0) return;
  for (const c of caves){
    if (c.kind !== 'burrow' || c.owner !== 'gnome') continue;
    if (!c.bench){ const near40 = camps.find(k => k.workshop && dist(k.workshop[0], k.workshop[1], c.exit.x, c.exit.y) <= 40); if (near40 && rng() < CLOCK.gnome.copyChance){ c.bench = tick; c.lastRepaid = tick; camp = near40; log('Small tools clink under the meadow at night. The neighbours have a bench of their own now.', campHumans(), 'good'); } }
    const loud = camps.find(k => k.site && k.village && dist(k.site[0], k.site[1], c.exit.x, c.exit.y) <= 30) || (c.disturbed >= 2 ? (c.disturbedBy || camps.find(k => k.site)) : null);
    if (loud && !c.leaving){ c.leaving = tick; camp = loud; log('The gnomes under the meadow find the village too loud. Small bundles move about at night.', campHumans(), 'info'); }
    if (c.leaving && tick - c.leaving >= CLOCK.gnome.leaveAfter){
      const fresh = digGnomeBurrow([c.exit.x, c.exit.y], camps.filter(k => k.site && k.village).map(k => k.site));
      if (fresh){ for (const g of beings) if (g.alive && g.species === 'gnome' && g.den === c){ g.den = fresh; const q = fresh.tiles.find(t => passable(t.x, t.y, t.z)); g.x = q.x; g.y = q.y; g.z = q.z; g.task = null; }
        fresh.bench = c.bench; fresh.holding = c.holding; fresh.lastRepaid = c.lastRepaid;
        c.owner = null; c.abandoned = true; c.leaving = 0; c.story.push('The gnomes left when the village grew loud.'); for (const q of c.patch){ q.feature = null; q.shrooms = 0; } c.patch = [];
        camp = loud || camps[0]; log('The gnomes under the meadow have gone. Their holes are empty, and the mushrooms with them.', campHumans(), 'info'); }
      else c.leaving = tick; /* nowhere quieter yet; wait */
    }
  }
}
