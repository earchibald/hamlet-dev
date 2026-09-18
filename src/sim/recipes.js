/* ---------- recipes ---------- */
/* Crafts are data. Each row becomes a goal with a state and offers, built by recipeGoal. Fields:
   id, title: the goal. needs: stash kinds and counts consumed. tools: camp tools that must exist.
   place: where the work happens: 'stash', 'pit' (lit), 'workshop', 'water', 'reeds'. skill, work: the work.
   makes: { item, n } | { tool } | { struct } | { wear }. after: a goal id, tool, or struct that must be done first.
   standing: { stash, n } keeps the goal open until the stash holds n. active(): an extra condition for standing goals.
   gather: a starter for goals that fetch something instead of making it. blurb: panel text. */
const RECIPES = [
  { id: 'fibre', title: 'Gather fibre', after: 'firepit', place: 'reeds', gather: a => startPickFibre(a), standing: { stash: 'fibre', n: 6 }, score: 30,
    blurb: 'Reed fibre twists into cord. Reeds grow in the marsh and along the water.' },
  { id: 'cord', title: 'Twist cord', after: 'firepit', needs: { fibre: 4 }, place: 'stash', skill: 'craft', work: 30, makes: { item: 'cord', n: 2 }, standing: { stash: 'cord', n: 4 }, score: 40,
    verb: 'twists', blurb: 'Four bundles of fibre make two coils. Cord binds a rod, a basket, and clothes.' },
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
/* Where a recipe's work happens. Null when the place is not built yet. */
function placeFor(r){
  if (r.place === 'stash') return camp.stashTile;
  if (r.place === 'pit') return pitLit() ? camp.pit : null;
  if (r.place === 'workshop') return camp.workshop;
  return null;
}
const recipeDone = r => r.makes && ((r.makes.tool && camp.tools[r.makes.tool]) || (r.makes.struct && camp[r.makes.struct]));
/* What the offer of a missing input is: the existing gatherers for loose things, or nothing for things another recipe makes. */
function gatherOffer(kind){
  if (['stick', 'rock', 'log', 'moss'].includes(kind)) return a => startGather(a, kind);
  if (kind === 'fibre') return a => startPickFibre(a);
  return null;
}
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
        if (r.needs && !stashHas(r.needs)) return { s: 'blocked', text };
        return { s: 'active', text };
      }
      return { s: 'active', text: `${needsText(r.needs)}. ${r.blurb}` };
    },
    offers(a){
      if (this.state().s !== 'active') return [];
      if (r.gather) return [{ label: `${r.title.toLowerCase()} from the ${r.place}`, score: r.score || 35, start: r.gather }];
      const out = [];
      for (const [k, n] of Object.entries(r.needs || {})) if ((camp.stash[k] || 0) < n){ const g = gatherOffer(k); if (g) out.push({ label: `gather ${ITEMS[k].plural} to ${r.title.toLowerCase()}`, score: (r.score || 40) - 5, start: g }); }
      if (out.length) return out;
      if (!stashHas(r.needs) || (r.tools || []).some(t => !camp.tools[t])) return [];
      const at = placeFor(r); if (!at) return [];
      const work = r.work / (r.place === 'workshop' ? 1.3 : 1);
      return [{ label: r.title.toLowerCase(), score: r.score || 45, start: a => startBuild(a, at, work, r.title, a => {
        if (!stashHas(r.needs) || recipeDone(r)) return;
        takeNeeds(r.needs);
        if (r.makes.item) stashAdd(r.makes.item, r.makes.n);
        if (r.makes.tool) camp.tools[r.makes.tool] = 1;
        if (r.skill) gainXp(a, r.skill);
        log(`${a.name} ${r.verb || 'makes'} ${r.makes.item ? `${r.makes.n} ${ITEMS[r.makes.item].plural}` : r.title.toLowerCase().replace(/^\w+ /, '')}.`, [a], r.makes.tool ? 'major' : 'info');
      }) }];
    } };
}
/* The recipe goals sit on the panel after the hand-written ladder and before the standing wolf guard. */
GOALS.splice(GOALS.findIndex(g => g.id === 'guard'), 0, ...RECIPES.map(recipeGoal));
