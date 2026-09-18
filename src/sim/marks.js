/* ---------- marks ----------
   A mark is a record on a region, and after settle on a hill, a cave, a scar, or a tile: kind, value,
   who, age, and a why sentence for the card. Rules read marks. Nothing reads a god's name. */
const CONTRASTS = { height: ['above', 'below'], water: ['wet', 'dry'], heat: ['hot', 'cold'], motion: ['still', 'moving'], sight: ['light', 'dark'] };
const POLES = {};
for (const c in CONTRASTS){ const [p, q] = CONTRASTS[c]; POLES[p] = { contrast: c, other: q }; POLES[q] = { contrast: c, other: p }; }
/* Kinds that describe the ground go to both children of a split. The rest name one thing that exists once
   (a making, a god's body, a twist), and go to the child that holds the mark's anchor tile. */
const INHERITED = { pole: true, height: true, depth: true, scar: true, flow: true, pool: true, freeze: true, hide: true, show: true };
function mark(target, kind, value, god, why, at){
  if (at === undefined) at = target.tiles && target.tiles.length ? target.tiles[rint(target.tiles.length)] : null;
  const m = { kind, value, by: god ? god.id : null, age, why, at }; target.marks.push(m); return m;
}
const marksOf = (t, kind) => t.marks.filter(m => m.kind === kind);
const hasMark = (t, kind, value) => t.marks.some(m => m.kind === kind && (value === undefined || m.value === value));
/* A region holds one pole per contrast. Setting a pole drops the other pole of its contrast. */
function setPole(r, pole, god, why){
  const c = POLES[pole].contrast;
  r.marks = r.marks.filter(m => !(m.kind === 'pole' && POLES[m.value].contrast === c));
  return mark(r, 'pole', pole, god, why);
}
const poleOf = (r, contrast) => { const m = r.marks.find(m => m.kind === 'pole' && POLES[m.value].contrast === contrast); return m ? m.value : null; };
const hasPole = (r, pole) => poleOf(r, POLES[pole].contrast) === pole;
/* Biomes come from mark combinations, not from noise. The first row whose needs are all present wins.
   A burned scar is ash whatever else is there. */
const BIOME_OF = [
  { needs: ['wet', 'moving'], biome: 'river' },
  { needs: ['wet', 'still'], biome: 'wetland' },
  { needs: ['wet'], biome: 'wetland' },
  { needs: ['dry', 'cold'], biome: 'forest' },
  { needs: ['dry', 'dark'], biome: 'forest' },
  { needs: ['dry', 'hot'], biome: 'meadow' },
  { needs: ['dry', 'light'], biome: 'meadow' },
  { needs: ['dry', 'above'], biome: 'rocky' },
  { needs: [], biome: 'meadow' },
];
function biomeOf(r){
  if (hasMark(r, 'scar', 'burned')) return 'ash';
  /* A hide mark is the dark pole for this purpose. Trees grow where a god hid something, as much as where
     it is cold, so long as no heat or sight pole already speaks for the ground. */
  if (hasPole(r, 'dry') && !poleOf(r, 'heat') && !poleOf(r, 'sight') && hasMark(r, 'hide')) return 'forest';
  for (const row of BIOME_OF) if (row.needs.every(p => hasPole(r, p))) return row.biome;
  return 'meadow';
}
/* Where things grow, there is fuel. */
const GROWS = { forest: true, meadow: true, wetland: true, rocky: false, river: false, ash: false };
/* How much of the live field carries a pole, 0 to 1. */
function poleShare(pole){ let n = 0, all = 0; for (const r of liveRegions()){ all += r.area; if (hasPole(r, pole)) n += r.area; } return all ? n / all : 0; }
