/* Life clocks, in days. adult: grown up. old: slows down. life: the usual span. */
const LIFE = { sprite: { adult: 10, old: 150, life: 200 }, human: { adult: 16, old: 60, life: 84 }, rabbit: { adult: 3, old: 14, life: 20 }, deer: { adult: 8, old: 36, life: 50 }, fox: { adult: 5, old: 26, life: 36 }, wolf: { adult: 6, old: 32, life: 46 }, gnome: { adult: 20, old: 80, life: 110, seed: 35 } };
const ageDays = a => (tick - a.born) / DAY;
const stage = a => { const L = LIFE[a.species]; const d = ageDays(a); return d < L.adult ? 'young' : d < L.old ? 'adult' : 'old'; };
const SPECIES = {
  human:  { glyph: '@', label: 'human',  decay: { food: 0.035, water: 0.05, rest: 0.03, social: 0.02, warmth: 0 }, stride: 2, zmin: -2, zmax: 2 },
  rabbit: { glyph: 'r', label: 'rabbit', decay: { food: 0.07, rest: 0.03 }, stride: 2, zmin: 0, zmax: 0 },
  fox:    { glyph: 'f', label: 'fox',    decay: { food: 0.025, water: 0.04, rest: 0.02 }, stride: 2, zmin: -2, zmax: 2, bite: { hp: 6, spread: 5, mood: -8 } },
  wolf:   { glyph: 'w', label: 'wolf',   decay: { food: 0.02, water: 0.03, rest: 0.02 }, stride: 2, zmin: -2, zmax: 2, bite: { hp: 20, spread: 15, mood: -20 } },
  deer:   { glyph: 'd', label: 'deer',   decay: { food: 0.05, water: 0.04, rest: 0.03 }, stride: 2, zmin: 0, zmax: 2 },
  sprite: { glyph: '¤', label: 'sprite', decay: { glow: 0.03, play: 0.04, rest: 0.02 }, stride: 1, zmin: -2, zmax: 2 },
  gnome:  { glyph: 'g', label: 'gnome',  decay: { food: 0.03, rest: 0.03, social: 0.02 }, stride: 2, zmin: -2, zmax: 2 },
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
Object.assign(START, {
  hunt(a){
    const wantsDeer = a.species === 'wolf' && (isWinter() || a.needs.food < 30);
    const prey = beings.filter(b => b.alive && (b.species === 'rabbit' || (wantsDeer && b.species === 'deer')) && near(b, a) <= (a.species === 'wolf' ? 50 : 40))
      .sort((p, q) => (near(p, a) - (p.species === 'deer' ? 15 : 0)) - (near(q, a) - (q.species === 'deer' ? 15 : 0)))[0];
    if (!prey) return false;
    if (near(a, prey) > 9){
      const p = legPath(a, prey.x, prey.y, 8); if (!p) return false;
      a.task = { type: 'travel', label: 'Prowling toward the meadow', path: p, arrive: () => 'done' }; return true;
    }
    a.task = { type: 'hunt', label: `Stalking a ${prey.species}`, path: [], fast: true, progress: 0,
      arrive(a, t){
        if (!prey.alive || ++t.progress > 140 + a.skills.hunt * 30){ if (prey.alive && near(a, prey) <= 4){ prey.xp.wary = (prey.xp.wary || 0) + 1; if (prey.xp.wary >= 2){ prey.xp.wary = 0; prey.skills.wary = Math.min(3, (prey.skills.wary || 0) + 1); } addThought(prey, 'chased', 'Was nearly caught', -6, 800); } return 'fail'; }
        if (near(a, prey) <= 1){
          if (prey.species === 'deer' && rng() > 0.45 + a.skills.hunt * 0.1){ addThought(prey, 'escaped', 'Broke free from a wolf', -8, 900); prey.hp -= 15; prey.skills.wary = Math.min(3, (prey.skills.wary || 0) + 1); failTask(prey); START.flee(prey); return 'fail'; }
          prey.hp = 0; gainXp(a, 'hunt'); die(prey, `was caught by a ${SPECIES[a.species].label}`);
          if (a.den && prey.species === 'rabbit' && nearAt(a, a.den.exit.x, a.den.exit.y) <= 30){ const it = itemAt(prey.x, prey.y, prey.z); if (it && it.kind === 'carcass'){ a.carrying = { kind: 'carcass', count: 1 }; const r = chain(a, t, START.carryHome(a)); if (r){ removeItem(it); return r; } a.carrying = null; } }
          t.label = 'Eating'; a.needs.food = 100; addThought(a, 'fed', 'Made a kill', 8, 600); return 'done'; }
        const p = bfs(a.x, a.y, a.z, (x, y, z) => z === prey.z && dist(x, y, prey.x, prey.y) <= 1, 400, a); if (!p) return 'fail';
        t.path = p.slice(0, 3); return 'continue';
      } };
    return true;
  },
  raid(a){
    const c = campNear(a, 45); if (!c || !c.pit || c.storehouse || tileAt(...c.pit).struct.lit || (a.cooldown.raid || 0) > tick) return false;
    if (c.stash.carcass + c.stash.fish + c.stash.cooked + c.stash.smoked <= 0) return false;
    const [sx, sy] = c.stashTile; const p = legPath(a, sx, sy, 1); if (!p) return false;
    a.task = { type: 'raid', label: 'Slinking toward the dark camp', path: p, fast: true,
      arrive(a, t){
        if (nearAt(a, sx, sy) > 1){ const q = legPath(a, sx, sy, 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
        const prev = camp; camp = c;
        const k = c.stash.carcass > 0 ? 'carcass' : c.stash.fish > 0 ? 'fish' : c.stash.cooked > 0 ? 'cooked' : c.stash.smoked > 0 ? 'smoked' : null;
        if (k){ stashTake(k); a.needs.food = 100; a.cooldown.raid = tick + 1200; if (tick - c.wolfLogged > 300){ c.wolfLogged = tick; log(`A wolf slips into the dark camp and takes the ${ITEMS[k].name} from the stash.`, campHumans(), 'bad'); } for (const h of campHumans()) addThought(h, 'wolf', 'A wolf came into camp in the night', -12, 1200); }
        camp = prev; return 'done';
      } };
    return true;
  },
  stalk(a){
    if (a.species !== 'wolf' || !isNight() || a.needs.food > 35) return false;
    const lone = humans().filter(h => !humans().some(o => o !== h && near(o, h) <= 5) && !(h.camp && h.camp.pit && tileAt(...h.camp.pit).struct.lit && nearAt(h, ...h.camp.pit) <= 8) && near(h, a) <= 30 && !(h.carrying && h.carrying.kind === 'ember'));
    const h = lone.sort((p, q) => near(p, a) - near(q, a))[0]; if (!h) return false;
    a.task = { type: 'stalk', label: 'Stalking someone alone in the dark', path: [], fast: true, progress: 0,
      arrive(a, t){
        if (!h.alive || ++t.progress > 160 || (h.carrying && h.carrying.kind === 'ember')) return 'fail';
        if (near(a, h) <= 1){ h.hp -= 20 + rint(15); h.lastHurt = 'was killed by a wolf'; h.lastHurtAt = tick; h.asleep = false; addThought(h, 'mauled', 'Mauled by a wolf in the dark', -22, 2000); drift(h, 'bravery', -0.04); log(`A wolf comes out of the dark and mauls ${h.name}.`, [h], 'bad'); a.cooldown.stalk = tick + 2000; a.needs.food = Math.min(100, a.needs.food + 40); failTask(h); START.flee(h); return 'done'; }
        const p = bfs(a.x, a.y, a.z, (x, y, z) => z === h.z && dist(x, y, h.x, h.y) <= 1, 500, a); if (!p) return 'fail'; t.path = p.slice(0, 3); return 'continue';
      } };
    return true;
  },
  herd(a){
    const kin = beings.filter(b => b.alive && b !== a && b.species === a.species && near(b, a) <= 30).sort((p, q) => near(p, a) - near(q, a))[0];
    if (!kin || near(kin, a) <= 4) return false;
    const p = bfs(a.x, a.y, a.z, (x, y, z) => z === kin.z && dist(x, y, kin.x, kin.y) <= 3, 600, a); if (!p) return false;
    a.task = { type: 'wander', label: 'Rejoining the herd', path: p, arrive: () => 'done' }; return true;
  },
  scavenge(a){
    let found = null; const p = bfs(a.x, a.y, a.z, (x, y, z) => { const it = itemAt(x, y, z); if (it && (it.kind === 'carcass' || it.kind === 'venison') && !it.reservedBy){ found = it; return true; } return false; }, 500, a); if (!p) return false;
    a.task = { type: 'eat', label: 'Going to a carcass', path: p, progress: 0, arrive(a, t){ if (!items.includes(found)) return 'fail'; t.label = 'Eating'; if (++t.progress < 25) return 'continue'; if (found.kind === 'venison' && rng() < 0.6){ a.needs.food = 100; return 'done'; } removeItem(found); a.needs.food = 100; return 'done'; } };
    return true;
  },
  /* Go home to the den and rest there. */
  home(a){
    const c = a.den; if (!c) return false;
    const floor = c.tiles.filter(t => passable(t.x, t.y, t.z)); if (!floor.length) return START.rest(a);
    const spot = floor[a.id % floor.length];
    if (a.x === spot.x && a.y === spot.y && a.z === spot.z){ a.task = { type: 'rest', label: 'Resting in the den', path: [], wait: 60, arrive(a){ a.needs.rest = Math.min(100, a.needs.rest + 40); return 'done'; } }; return true; }
    const p = legPath(a, spot.x, spot.y, 0, spot.z); if (!p) return START.rest(a);
    a.task = { type: 'travel', label: 'Going home to the den', path: p, arrive(a, t){ if (nearAt(a, spot.x, spot.y, spot.z) > 0){ const q = legPath(a, spot.x, spot.y, 0, spot.z); if (!q) return 'fail'; t.path = q; return 'continue'; } return 'done'; } };
    return true;
  },
  /* Carry a kill home and eat it there. */
  carryHome(a){
    const c = a.den; if (!c || !a.carrying) return false;
    const floor = c.tiles.filter(t => passable(t.x, t.y, t.z)); if (!floor.length) return false;
    const spot = floor[a.id % floor.length];
    const p = legPath(a, spot.x, spot.y, 0, spot.z); if (!p) return false;
    a.task = { type: 'travel', label: 'Carrying the kill home', path: p, fast: false,
      arrive(a, t){ if (nearAt(a, spot.x, spot.y, spot.z) > 0){ const q = legPath(a, spot.x, spot.y, 0, spot.z); if (!q) return 'fail'; t.path = q; return 'continue'; }
        a.carrying = null; a.needs.food = 100; addThought(a, 'fed', 'Ate at home', 8, 600); log(`A ${SPECIES[a.species].label} drags its kill into the den.`, []); return 'done'; },
      cleanup(){ if (a.carrying){ addItem(a.carrying.kind, a.x, a.y, a.z); a.carrying = null; } } };
    return true;
  },
  /* Eat mushrooms off the burrow's patch. */
  shrooms(a){
    const c = a.den; if (!c) return false;
    const ripe = c.patch.filter(t => t.shrooms > 0); if (!ripe.length) return false;
    const t = ripe[a.id % ripe.length]; const p = legPath(a, t.x, t.y, 1, 0); if (!p) return false;
    a.task = { type: 'eat', label: 'Picking mushrooms on the patch', path: p, progress: 0,
      arrive(a, k){ if (nearAt(a, t.x, t.y) > 1){ const q = legPath(a, t.x, t.y, 1, 0); if (!q) return 'fail'; k.path = q; return 'continue'; } if (t.shrooms <= 0) return 'fail'; if (++k.progress < 8) return 'continue'; t.shrooms--; a.needs.food = Math.min(100, a.needs.food + 35); return a.needs.food < 70 && t.shrooms > 0 ? 'continue' : 'done'; } };
    return true;
  },
  /* Keep company with the burrow's kin. */
  huddle(a){
    const kin = beings.filter(b => b.alive && b !== a && b.species === a.species && b.den === a.den).sort((p, q) => near(p, a) - near(q, a))[0];
    if (!kin) return false;
    if (near(kin, a) <= 1){ a.task = { type: 'socialize', label: 'Chattering with kin', path: [], wait: 20, arrive(a){ a.needs.social = Math.min(100, a.needs.social + 30); kin.needs.social = Math.min(100, kin.needs.social + 20); return 'done'; } }; return true; }
    const p = bfs(a.x, a.y, a.z, (x, y, z) => z === kin.z && dist(x, y, kin.x, kin.y) <= 1, 600, a); if (!p) return false;
    a.task = { type: 'socialize', label: 'Going to kin', path: p, arrive: () => 'done' }; return true;
  },
  /* At night, a gnome with a bench borrows one made thing from a camp stash within 40 tiles. Never from a warded camp. */
  borrow(a){
    const c = a.den; if (!c || !c.bench || c.holding || !isNight()) return false;
    if (c.lastRepaid && tick - c.lastRepaid < 6 * DAY) return false;
    const k = camps.find(k => k.stashTile && !k.ward && dist(k.stashTile[0], k.stashTile[1], c.exit.x, c.exit.y) <= 40 && (k.stash.pot > 0 || k.stash.cord > 0 || k.tools.basket)); if (!k) return false;
    const [sx, sy] = k.stashTile; const p = legPath(a, sx, sy, 1); if (!p) return false;
    a.task = { type: 'borrow', label: 'Slipping over to the camp for something useful', path: p, fast: true,
      arrive(a, t){ if (nearAt(a, sx, sy) > 1){ const q = legPath(a, sx, sy, 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
        if (c.holding) return 'fail';
        const kind = k.stash.pot > 0 ? 'pot' : k.stash.cord > 0 ? 'cord' : k.tools.basket ? 'basket' : null; if (!kind) return 'fail';
        camp = k; c.holding = { kind, camp: k, since: tick };
        if (kind === 'basket') k.tools.basket = 0; else stashTake(kind, 1);
        addThought(a, 'borrowed', 'Borrowed a clever thing', 6, 1500);
        log(`${kind === 'basket' ? 'The basket' : `A ${ITEMS[kind].name}`} is gone from the stash. Small footprints lead toward the meadow.`, campHumans(), 'bad');
        if (!k.gnomes.known){ k.gnomes.known = true; }
        return 'done'; } };
    return true;
  },
  /* Two days on, the thing comes back with a gift beside it. */
  repay(a){
    const c = a.den; if (!c || !c.holding || tick - c.holding.since < 2 * DAY) return false;
    const k = c.holding.camp; if (!k.stashTile) return false;
    const [sx, sy] = k.stashTile; const p = legPath(a, sx, sy, 1); if (!p) return false;
    a.task = { type: 'repay', label: 'Carrying the thing back, with a gift', path: p,
      arrive(a, t){ if (nearAt(a, sx, sy) > 1){ const q = legPath(a, sx, sy, 1); if (!q) return 'fail'; t.path = q; return 'continue'; }
        const h = c.holding; if (!h) return 'fail'; camp = k; if (h.kind === 'basket') k.tools.basket = 1; else stashAdd(h.kind, 1);
        const gift = ['cord', 'clay', 'pot'][rint(3)]; stashAdd(gift, 1); c.holding = null; c.lastRepaid = tick;
        addThought(a, 'repaid', 'Paid a debt', 5, 1500); for (const o of campHumans()) addThought(o, 'gnomegift', 'The neighbours brought something back, and more', 5, 1200);
        log(`The ${h.kind === 'basket' ? 'basket' : ITEMS[h.kind].name} is back in the stash, and a ${ITEMS[gift].name} beside it. Neighbours, then.`, campHumans(), 'good');
        return 'done'; } };
    return true;
  },
});

/* Wildlife comes and goes: rabbits breed and return, fawns in spring, wolves and foxes wander in from the edges. */
function spawnWildlife(){
  /* Rabbits breed in the warm seasons. Kits are born beside two grown rabbits. */
  if (tick % 250 === 0 && !isWinter()){
    const rs = beings.filter(b => b.alive && b.species === 'rabbit'); const cap = seasonOf() === 'spring' ? 20 : 15;
    if (rs.length < cap){ const p = rs.find(r => stage(r) === 'adult' && rs.some(o => o !== r && stage(o) === 'adult' && near(o, r) <= 10));
      if (p && rng() < 0.8){ const q = nearFind(p.x, p.y, q => passable(q.x, q.y) && !beings.some(b => b.alive && b.x === q.x && b.y === q.y), RING); if (q){ const k = makeBeing('rabbit', q.x, q.y, null, 0); k.born = tick; beings.push(k); } } }
  }
  /* Rabbits return to the meadows. */
  if (tick % 300 === 0 && beings.filter(b => b.alive && b.species === 'rabbit').length < (isWinter() ? 6 : 10)){
    for (let k = 0; k < 40; k++){ const t = world[rint(W * H)]; const s = sectorOfTile(t); if ((s.biome === 'meadow' || s.biome === 'wetland') && passable(t.x, t.y) && nearFind(t.x, t.y, q => q.feature === 'bush', RING) && !humans().some(h => nearAt(h, t.x, t.y) < 8)){ beings.push(makeBeing('rabbit', t.x, t.y, null, 0)); break; } }
  }
  if (tick % 2000 === 1000 && seasonOf() === 'spring' && beings.filter(b => b.alive && b.species === 'deer').length < 9){
    const doe = beings.find(b => b.alive && b.species === 'deer'); if (doe){ const q = nearFind(doe.x, doe.y, q => passable(q.x, q.y) && !beings.some(b => b.alive && b.x === q.x && b.y === q.y), RING); if (q){ const f = makeBeing('deer', q.x, q.y, null, 0); f.born = tick; beings.push(f); log('A fawn is on its feet in the meadow.', []); } }
    else for (let k = 0; k < 60; k++){ const t = world[rint(W * H)]; if (sectorOfTile(t).biome === 'meadow' && passable(t.x, t.y) && !humans().some(h => nearAt(h, t.x, t.y) < 20)){ beings.push(makeBeing('deer', t.x, t.y, null, 0)); beings.push(makeBeing('deer', t.x, t.y, null, 0)); break; } }
  }
  if (tick % 10000 === 2500 && beings.filter(b => b.alive && b.species === 'wolf').length < 2){
    for (let k = 0; k < 40; k++){ const t = world[rint(W * H)]; const st = sectorOfTile(t); if (st.biome === 'forest' && passable(t.x, t.y) && !humans().some(h => nearAt(h, t.x, t.y) < 25)){ const w = makeBeing('wolf', t.x, t.y, null, 0); beings.push(w); adoptDen(w); break; } }
  }
  if (tick % 6000 === 0 && beings.filter(b => b.alive && b.species === 'fox').length < 2){
    for (let k = 0; k < 40; k++){ const t = world[rint(W * H)]; const s = sectorOfTile(t); if ((s.biome === 'forest' || s.biome === 'rocky') && passable(t.x, t.y) && !humans().some(h => nearAt(h, t.x, t.y) < 15)){ const f = makeBeing('fox', t.x, t.y, null, 0); beings.push(f); adoptDen(f); break; } }
  }
}

/* An edge-arrived wolf or fox joins the nearest den of its own kind that has room for a breeding pair. */
function adoptDen(a){
  const open = caves.filter(c => c.kind === 'den' && c.owner === a.species &&
    beings.filter(b => b.alive && b.den === c && stage(b) !== 'young').length < 2);
  const c = open.sort((p, q) => dist(a.x, a.y, p.exit.x, p.exit.y) - dist(a.x, a.y, q.exit.x, q.exit.y))[0];
  if (c){ a.den = c; log(`A ${SPECIES[a.species].label} has found the den under the hill and stays.`, []); }
}

/* Each den with two grown owners bears one young in spring, once a year. Edge arrivals are the floor, not the source. */
function denTick(){
  if (tick % 500 !== 0 || seasonOf() !== 'spring') return;
  for (const c of caves){
    if (c.kind !== 'den' || !c.owner || c.owner === 'sprite') continue;
    if (c.lastBirth && tick - c.lastBirth < 20 * DAY) continue;
    const grown = beings.filter(b => b.alive && b.species === c.owner && b.den === c && stage(b) !== 'young');
    if (grown.length < 2) continue;
    const floor = c.tiles.filter(t => passable(t.x, t.y, t.z)); if (!floor.length) continue;
    const y = makeBeing(c.owner, 0, 0, null, 0); const t = floor[y.id % floor.length]; y.x = t.x; y.y = t.y; y.z = t.z; y.born = tick; y.den = c; beings.push(y); c.lastBirth = tick;
    log(c.owner === 'wolf' ? 'A wolf pup is born in the den under the hill.' : 'Fox kits are born in the den under the hill.', []);
  }
}

/* A grown owner standing in its den attacks any person on the den's tiles, by day or night, brand or no brand. One bite every 150 ticks. */
function defendDen(a){
  const c = a.den; if (!c || stage(a) === 'young' || (a.cooldown.defend || 0) > tick) return;
  const here = tileAt(a.x, a.y, a.z); if (!here || here.cave !== c) return;
  const h = beings.find(b => b.alive && b.species === 'human' && b.z === a.z && c.tiles.some(t => t.x === b.x && t.y === b.y && t.z === b.z));
  if (!h) return;
  const label = SPECIES[a.species].label, bite = SPECIES[a.species].bite;
  h.hp -= bite.hp + rint(bite.spread); h.lastHurt = `was killed in a den by a ${label}`; h.lastHurtAt = tick; h.asleep = false;
  addThought(h, 'denbite', `Bitten by a ${label} in its den`, bite.mood, 1500); drift(h, 'bravery', -0.02);
  log(`A ${label} comes at ${h.name} in its den.`, [h], 'bad');
  a.cooldown.defend = tick + 150; addThought(a, 'defend', 'Drove an intruder from the den', 6, 600);
  failTask(h); START.flee(h);
}

/* Every 500 ticks the burrows look about them. A camp's workshop within 40 tiles is copied within a few days. */
function gnomeTick(){
  if (tick % 500 !== 0) return;
  for (const c of caves){
    if (c.kind !== 'burrow' || c.owner !== 'gnome') continue;
    if (!c.bench){ const near40 = camps.find(k => k.workshop && dist(k.workshop[0], k.workshop[1], c.exit.x, c.exit.y) <= 40); if (near40 && rng() < 0.3){ c.bench = tick; c.lastRepaid = tick; camp = near40; log('Small tools clink under the meadow at night. The neighbours have a bench of their own now.', campHumans(), 'good'); } }
  }
}
