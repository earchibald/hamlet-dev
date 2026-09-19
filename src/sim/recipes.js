/* ---------- recipes ---------- */
/* Crafts are data. Each row becomes a goal with a state and offers, built by recipeGoal. Fields:
   id, title: the goal. needs: stash kinds and counts consumed. tools: camp tools that must exist.
   place: where the work happens, a key in PLACES: 'stash', 'pit' (lit), 'workshop', 'site', 'water', 'reeds'.
   skill, work: the work. makes: { item, n } | { tool } | { struct } | { wear }.
   after: a goal id, tool, or struct that must be done first.
   standing: { stash, n } keeps the goal open until the stash holds n. active(): an extra condition for standing goals.
   gather: a starter for goals that fetch something instead of making it. offerLabel: the gather offer's label,
   default the title lowered. blurb: panel text. */
/* Gatherers for loose things, kept as a table (not a `gatherOffer` set of function-reference fields on
   ITEMS rows) because ITEMS lives in core.js, which loads before these task starters exist. */
const GATHERERS = { stick: a => startGather(a, 'stick'), rock: a => startGather(a, 'rock'), moss: a => startGather(a, 'moss'), log: a => startCutTree(a), fibre: a => startPickFibre(a), clay: a => startDigClay(a), cuttings: a => startTakeCuttings(a) };
const RECIPES = [
  { id: 'fibre', title: 'Gather fibre', stage: 'crafts', after: 'firepit', place: 'reeds', gather: a => startPickFibre(a), standing: { stash: 'fibre', n: 6 }, score: 26, offerLabel: 'gather fibre from the reeds',
    blurb: 'Reed fibre twists into cord. Reeds grow in the marsh and along the water.' },
  { id: 'cord', title: 'Twist cord', stage: 'crafts', after: 'firepit', needs: { fibre: 4 }, place: 'stash', skill: 'craft', work: strides(30), makes: { item: 'cord', n: 2 }, standing: { stash: 'cord', n: 4 }, score: 36,
    verb: 'twists', blurb: 'Four bundles of fibre make two coils. Cord binds a rod, a basket, and clothes.' },
  { id: 'workshop', title: 'Build the workshop', stage: 'crafts', after: 'axe', needs: { log: 6, stick: 10, rock: 4 }, tools: ['axe'], place: 'site', skill: 'build', work: strides(140), makes: { struct: 'workshop' }, score: 46,
    verb: 'raises', done: 'A roofed bench beside the fire. Work here goes faster, and cord, baskets, rods, and clothes are made here.', blurb: 'A roofed bench beside the fire. Six logs, ten sticks, four rocks.' },
  { id: 'basket', title: 'Weave a basket', stage: 'crafts', after: 'workshop', needs: { cord: 3 }, place: 'workshop', skill: 'craft', work: strides(60), makes: { tool: 'basket' }, score: 40,
    verb: 'weaves', done: 'A basket of cord and reed. Gatherers carry three more.', blurb: 'Three coils of cord. A gatherer with a basket carries three more.' },
  { id: 'rod', title: 'Make a fishing rod', stage: 'crafts', after: 'workshop', needs: { stick: 1, cord: 2 }, place: 'workshop', skill: 'craft', work: strides(40), makes: { tool: 'rod' }, score: 40,
    verb: 'binds', done: 'A stick, a line of cord, a bone hook. The river feeds the camp now.', blurb: 'A stick and two coils of cord. Opens fishing.' },
  { id: 'fish', title: 'Fish the river', stage: 'food', after: 'rod', tools: ['rod'], place: 'water', gather: a => startFish(a), standing: { stash: 'fish', n: 4 }, active: () => camp.stash.fish < 4 && stashFood() + camp.stash.fish * 2 < foodTarget(), score: 36, offerLabel: 'fish the river',
    blurb: 'A fish cooks to two meals or smokes on the rack. People fish when food is short.' },
  { id: 'clothes', title: 'Sew hide clothes', stage: 'crafts', after: 'workshop', needs: { hide: 3, cord: 1 }, place: 'workshop', skill: 'craft', work: strides(70), makes: { wear: 'clothes' }, standing: { stash: 'hide', n: 0 }, active: () => campHumans().some(h => !h.clothes), score: 50,
    verb: 'sews', status: () => `${campHumans().filter(h => h.clothes).length} of ${campHumans().length} clothed.`,
    blurb: 'Three hides and a coil of cord. The coldest person wears them, and loses warmth slower.' },
  { id: 'clay', title: 'Dig clay', stage: 'crafts', after: 'workshop', place: 'bank', gather: a => startDigClay(a), standing: { stash: 'clay', n: 6 }, score: 28, offerLabel: 'dig clay',
    blurb: 'Clay from the riverbank. Four lumps build a kiln, three fire a pot.' },
  { id: 'kiln', title: 'Build the kiln', stage: 'crafts', after: 'workshop', needs: { rock: 8, clay: 4 }, place: 'site', skill: 'build', work: strides(120), makes: { struct: 'kiln' }, score: 42,
    verb: 'raises', done: 'A dome of rock and clay with a fire inside. Pots are fired here.', blurb: 'Eight rocks and four lumps of clay. Fires pots.' },
  { id: 'pot', title: 'Fire pots', stage: 'crafts', after: 'kiln', needs: { clay: 3, stick: 2 }, place: 'kiln', skill: 'craft', work: strides(50), makes: { item: 'pot', n: 1 }, counts: 'fired', standing: { stash: 'pot', n: 3 }, score: 38,
    verb: 'fires', blurb: 'Three lumps of clay and two sticks a firing. Each pot holds six more drinks at camp, and with a pot berries keep twice as long.' },
  { id: 'garden', title: 'Plant a garden', stage: 'crafts', after: 'axe', needs: { cuttings: 4 }, tools: ['axe'], place: 'garden', skill: 'gather', work: strides(80), makes: { garden: true }, score: 36,
    verb: 'plants', done: 'Four bushes by the fire, grown from cuttings. They grow berries like any bush, and feed rabbits like any bush.', blurb: 'Four cuttings from wild bushes, planted on open ground near the fire. Berries close to home. A garden that burns or dies is planted again.' },
  { id: 'pitfall', title: 'Dig a deer pit', stage: 'crafts', after: 'axe', needs: { log: 4, cord: 2 }, tools: ['axe'], place: 'pitfall', skill: 'trap', work: strides(90), makes: { pitfall: true }, standing: { stash: 'venison', n: 0 }, active: () => camp.pitfalls.length < 2, score: 34,
    verb: 'digs', status: () => `${camp.pitfalls.length} pits, ${camp.pitfalls.filter(p => p.catch).length} with a deer in.`,
    blurb: 'Four logs and two coils of cord over a hole on a deer path. One deer in eight that steps in is caught. Up to two pits.' },
  { id: 'quarry', title: 'Quarry stone', stage: 'crafts', after: 'axe', tools: ['axe'], place: 'face', gather: a => startQuarry(a), standing: { stash: 'rock', n: 6 }, score: 36, offerLabel: 'quarry rocks',
    blurb: 'Rocks from a rock face within thirty tiles. Two a go. The loose-rock hunt is over.' },
];

/* Is this stash kind made by some other recipe? Then a recipe short of it waits, blocked, rather than trying to gather it. A standing counter with a zero target is a panel sentinel, not a claim to make the kind. */
const madeBy = (k, r) => RECIPES.some(x => x !== r && ((x.makes && x.makes.item === k) || (x.gather && x.standing && x.standing.stash === k && x.standing.n > 0)));
/* What a recipe can actually spend of a kind: the stash, less the one hide held for a hut. The one place every needs check reads. */
const availOf = k => (camp.stash[k] || 0) - (k === 'hide' ? hideReserved() : 0);
const stashHas = needs => Object.entries(needs || {}).every(([k, n]) => availOf(k) >= n);
const takeNeeds = needs => { for (const [k, n] of Object.entries(needs || {})) stashTake(k, n); };
const needsText = needs => Object.entries(needs || {}).map(([k, n]) => `${ITEMS[k].plural} ${Math.min(camp.stash[k] || 0, n)}/${n}`).join(', ');
/* Has the thing this recipe waits on been done? A goal id, a tool, or a struct. */
function recipeUnlocked(r){
  if (!r.after) return true;
  if (r.after === 'firepit') return camp.everLit;
  if (camp.tools[r.after] !== undefined) return !!camp.tools[r.after];
  if (camp[r.after] !== undefined) return !!camp[r.after];
  const g = GOALS.find(g => g.id === r.after); return !!g && goalState(g).s === 'done';
}
/* Where a recipe's work happens, and how much faster (a place with no spot is not built yet). */
const PLACES = {
  stash: { spot: () => camp.stashTile },
  pit: { spot: () => pitLit() ? camp.pit : null },
  workshop: { spot: () => camp.workshop, speed: 1.3 },
  site: { spot: () => openSpotNear(camp.pit, 2, 5) },
  reeds: {},
  water: {},
  bank: {},
  kiln: { spot: () => camp.kiln },
  garden: { spot: () => (camp.garden && world.some(t => t.garden === camp && t.feature === 'bush')) ? null : gardenSpot() },
  pitfall: { spot: () => pitfallSite() },
  face: {},
};
function placeFor(r){ return PLACES[r.place] && PLACES[r.place].spot ? PLACES[r.place].spot() : null; }
const recipeDone = r => r.makes && ((r.makes.tool && camp.tools[r.makes.tool]) || (r.makes.struct && camp[r.makes.struct]) || (r.makes.garden && camp.garden && world.some(t => t.garden === camp && t.feature === 'bush')));
/* What the offer of a missing input is: the existing gatherers for loose things, the axe for logs
   (loose logs run out; a tree makes more), or nothing for things another recipe makes. */
const gatherOffer = kind => GATHERERS[kind] || null;
/* What making the thing does to the world, by the one key in r.makes. A struct maker returns false
   when the tile is already built on, so the caller can bail before it is called. */
const MAKERS = {
  item(r, a, at){ stashAdd(r.makes.item, r.makes.n); if (r.counts && at){ const st = tileAt(...at).struct; if (st) st[r.counts] = (st[r.counts] || 0) + r.makes.n; } },
  tool(r, a, at){ camp.tools[r.makes.tool] = 1; },
  struct(r, a, at){ const t = tileAt(...at); if (t.struct) return false; t.feature = null; t.struct = { type: r.makes.struct, camp, fired: 0 }; camp[r.makes.struct] = at; },
  wear(r, a, at){ const who = campHumans().filter(h => !h[r.makes.wear]).sort((p, q) => p.needs.warmth - q.needs.warmth)[0] || a; who[r.makes.wear] = true; addThought(who, 'clothes', 'Warm in new hide clothes', 5, CLOCK.thought.clothes); log(`${a.name} sews hide clothes, and ${who === a ? 'wears them' : `${who.name} wears them`}.`, [a, who], 'good'); return 'logged'; },
  garden(r, a, at){
    const spots = DIRS.map(([dx, dy]) => tileAt(at[0] + dx, at[1] + dy)).filter(q => passable(q.x, q.y) && !q.feature && !q.struct).slice(0, 4);
    if (spots.length < 4) return false;
    for (const q of spots){ q.feature = 'bush'; q.berries = 0; q.planted = tick; q.garden = camp; }
    camp.garden = at;
    log(`${a.name} plants a garden of four bushes by the fire.`, campHumans(), 'good');
    addThought(a, 'garden', 'Planted a garden', 5, CLOCK.thought.garden);
    return 'logged';
  },
  pitfall(r, a, at){
    const q = tileAt(...at); if (q.struct) return false;
    const p = { x: at[0], y: at[1], catch: null, camp }; camp.pitfalls.push(p); q.struct = { type: 'pitfall', pit: p, camp };
    log(`${a.name} digs a deer pit and covers it with logs and cord.`, [a], 'good');
    return 'logged';
  },
};
function recipeGoal(r){
  return { id: r.id, title: r.title, stage: r.stage, after: r.after, standing: !!r.standing, recipe: r,
    state(){
      if (!recipeUnlocked(r)) return { s: 'blocked', text: r.blurb };
      if (recipeDone(r)) return { s: 'done', text: r.done || r.blurb };
      if (r.standing){
        const have = camp.stash[r.standing.stash] || 0;
        const ready = r.active ? r.active() : have < r.standing.n;
        const text = r.standing.n === 0 ? r.status() : `${have}/${r.standing.n} ${ITEMS[r.standing.stash].plural} stored. ${r.blurb}`;
        if (!ready) return { s: 'idle', text };
        if (r.needs && !stashHas(r.needs)){
          const missing = Object.keys(r.needs).find(k => availOf(k) < r.needs[k]);
          const heldBack = missing === 'hide' && (camp.stash.hide || 0) >= r.needs.hide && hideReserved() > 0;
          if (madeBy(missing, r) || heldBack)
            return { s: 'blocked', text: `${needsText(r.needs)}. ${r.blurb}${heldBack ? ' One hide is held for a hut.' : ''}` };
        }
        return { s: 'active', text };
      }
      return { s: 'active', text: `${needsText(r.needs)}. ${r.blurb}` };
    },
    offers(a){
      if (this.state().s !== 'active') return [];
      if (r.gather) return [{ label: r.offerLabel || r.title.toLowerCase(), score: r.score || 35, start: r.gather }];
      const out = [];
      for (const [k, n] of Object.entries(r.needs || {})) if ((camp.stash[k] || 0) < n){ const g = gatherOffer(k); if (g) out.push({ label: `${ITEMS[k].gather || 'gather'} ${ITEMS[k].plural}`, score: (r.score || 40) - 5, start: g }); }
      if (r.makes && r.makes.item && looseCount(r.makes.item)(sectors[secIdx(...Object.values(secOf(...camp.site)))]) > 0) out.push({ label: `gather ${ITEMS[r.makes.item].plural} left for us`, score: (r.score || 40) + 5, start: a => startGather(a, r.makes.item) });
      if (out.length) return out;
      if (!stashHas(r.needs) || (r.tools || []).some(t => !camp.tools[t])) return [];
      const at = placeFor(r); if (!at) return [];
      const work = r.work / ((PLACES[r.place] && PLACES[r.place].speed) || 1);
      return [{ label: r.title.toLowerCase(), score: r.score || 45, start: a => startBuild(a, at, work, r.title, a => {
        if (recipeDone(r)) return;
        const key = Object.keys(r.makes)[0];
        if (key === 'struct' && tileAt(...at).struct) return;
        if (!stashHas(r.needs)) return;
        const result = MAKERS[key](r, a, at);
        if (result === false) return;
        takeNeeds(r.needs);
        if (r.skill) gainXp(a, r.skill);
        if (result !== 'logged')
          log(`${a.name} ${r.verb || 'makes'} ${r.makes.item ? `${r.makes.n} ${r.makes.n > 1 ? ITEMS[r.makes.item].plural : ITEMS[r.makes.item].name}` : r.title.toLowerCase().replace(/^\w+ /, '')}.`, [a], r.makes.tool || r.makes.struct ? 'major' : 'info');
      }, r.skill) }];
    } };
}
/* The recipe goals sit on the panel after the hand-written ladder and before the standing wolf guard.
   If the guard goal is ever renamed or removed, the recipes still show up, at the end of the panel. */
{
  const gi = GOALS.findIndex(g => g.id === 'guard');
  if (gi >= 0) GOALS.splice(gi, 0, ...RECIPES.map(recipeGoal));
  else GOALS.push(...RECIPES.map(recipeGoal));
}
