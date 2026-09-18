/* ---------- recipes ---------- */
/* Crafts are data. Each row becomes a goal with a state and offers, built by recipeGoal. Fields:
   id, title: the goal. needs: stash kinds and counts consumed. tools: camp tools that must exist.
   place: where the work happens, a key in PLACES: 'stash', 'pit' (lit), 'workshop', 'site', 'water', 'reeds'.
   skill, work: the work. makes: { item, n } | { tool } | { struct } | { wear }.
   after: a goal id, tool, or struct that must be done first.
   standing: { stash, n } keeps the goal open until the stash holds n. active(): an extra condition for standing goals.
   gather: a starter for goals that fetch something instead of making it. offerLabel: the gather offer's label,
   default the title lowered. blurb: panel text. */
const RECIPES = [
  { id: 'fibre', title: 'Gather fibre', after: 'firepit', place: 'reeds', gather: a => startPickFibre(a), standing: { stash: 'fibre', n: 6 }, score: 30, offerLabel: 'gather fibre from the reeds',
    blurb: 'Reed fibre twists into cord. Reeds grow in the marsh and along the water.' },
  { id: 'cord', title: 'Twist cord', after: 'firepit', needs: { fibre: 4 }, place: 'stash', skill: 'craft', work: 30, makes: { item: 'cord', n: 2 }, standing: { stash: 'cord', n: 4 }, score: 40,
    verb: 'twists', blurb: 'Four bundles of fibre make two coils. Cord binds a rod, a basket, and clothes.' },
  { id: 'workshop', title: 'Build the workshop', after: 'axe', needs: { log: 6, stick: 10, rock: 4 }, tools: ['axe'], place: 'site', skill: 'build', work: 140, makes: { struct: 'workshop' }, score: 50,
    verb: 'raises', done: 'A roofed bench beside the fire. Work here goes faster, and cord, baskets, rods, and clothes are made here.', blurb: 'A roofed bench beside the fire. Six logs, ten sticks, four rocks.' },
  { id: 'basket', title: 'Weave a basket', after: 'workshop', needs: { cord: 3 }, place: 'workshop', skill: 'craft', work: 60, makes: { tool: 'basket' }, score: 44,
    verb: 'weaves', done: 'A basket of cord and reed. Gatherers carry three more.', blurb: 'Three coils of cord. A gatherer with a basket carries three more.' },
  { id: 'rod', title: 'Make a fishing rod', after: 'workshop', needs: { stick: 1, cord: 2 }, place: 'workshop', skill: 'craft', work: 40, makes: { tool: 'rod' }, score: 44,
    verb: 'binds', done: 'A stick, a line of cord, a bone hook. The river feeds the camp now.', blurb: 'A stick and two coils of cord. Opens fishing.' },
  { id: 'fish', title: 'Fish the river', after: 'rod', tools: ['rod'], place: 'water', gather: a => startFish(a), standing: { stash: 'fish', n: 4 }, active: () => stashFood() < foodTarget(), score: 46, offerLabel: 'fish the river',
    blurb: 'A fish cooks to two meals or smokes on the rack. People fish when food is short.' },
];

const stashHas = needs => Object.entries(needs || {}).every(([k, n]) => (camp.stash[k] || 0) >= n);
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
};
function placeFor(r){ return PLACES[r.place] && PLACES[r.place].spot ? PLACES[r.place].spot() : null; }
const recipeDone = r => r.makes && ((r.makes.tool && camp.tools[r.makes.tool]) || (r.makes.struct && camp[r.makes.struct]));
/* What the offer of a missing input is: the existing gatherers for loose things, the axe for logs
   (loose logs run out; a tree makes more), or nothing for things another recipe makes. */
function gatherOffer(kind){
  if (kind === 'log') return a => startCutTree(a);
  if (['stick', 'rock', 'moss'].includes(kind)) return a => startGather(a, kind);
  if (kind === 'fibre') return a => startPickFibre(a);
  return null;
}
/* What making the thing does to the world, by the one key in r.makes. A struct maker returns false
   when the tile is already built on, so the caller can bail before it is called. */
const MAKERS = {
  item(r, a, at){ stashAdd(r.makes.item, r.makes.n); },
  tool(r, a, at){ camp.tools[r.makes.tool] = 1; },
  struct(r, a, at){ const t = tileAt(...at); if (t.struct) return false; t.feature = null; t.struct = { type: r.makes.struct, camp }; camp[r.makes.struct] = at; },
};
function recipeGoal(r){
  return { id: r.id, title: r.title, standing: !!r.standing, recipe: r,
    state(){
      if (!recipeUnlocked(r)) return { s: 'blocked', text: r.blurb };
      if (recipeDone(r)) return { s: 'done', text: r.done || r.blurb };
      if (r.standing){
        const have = camp.stash[r.standing.stash] || 0;
        const ready = r.active ? r.active() : have < r.standing.n;
        const text = `${have}/${r.standing.n} ${ITEMS[r.standing.stash].plural} stored. ${r.blurb}`;
        if (!ready) return { s: 'idle', text };
        if (r.needs && !stashHas(r.needs)){
          const missing = Object.keys(r.needs).find(k => (camp.stash[k] || 0) < r.needs[k]);
          if (RECIPES.some(x => (x.makes && x.makes.item === missing) || (x.standing && x.standing.stash === missing)))
            return { s: 'blocked', text: `${needsText(r.needs)}. ${r.blurb}` };
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
      if (out.length) return out;
      if (!stashHas(r.needs) || (r.tools || []).some(t => !camp.tools[t])) return [];
      const at = placeFor(r); if (!at) return [];
      const work = r.work / ((PLACES[r.place] && PLACES[r.place].speed) || 1);
      return [{ label: r.title.toLowerCase(), score: r.score || 45, start: a => startBuild(a, at, work, r.title, a => {
        if (recipeDone(r)) return;
        const key = Object.keys(r.makes)[0];
        if (key === 'struct' && tileAt(...at).struct) return;
        if (!stashHas(r.needs)) return;
        takeNeeds(r.needs);
        MAKERS[key](r, a, at);
        if (r.skill) gainXp(a, r.skill);
        log(`${a.name} ${r.verb || 'makes'} ${r.makes.item ? `${r.makes.n} ${ITEMS[r.makes.item].plural}` : r.title.toLowerCase().replace(/^\w+ /, '')}.`, [a], r.makes.tool || r.makes.struct ? 'major' : 'info');
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
