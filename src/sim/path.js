/* ---------- path search ---------- */
/* Search runs over all levels. A tile's index is idx3(x, y, z). Neighbours come from steps(): the four beside,
   up from a slope, down onto one. Visited tiles are marked with a generation counter, never cleared. */
let bfsPrev, bfsSeen, bfsGen = 0; const bfsOut = [];
/* The search buffers cover every level of the world. startWorld sizes them once the options are set. */
function allocSearch(){ bfsPrev = new Int32Array(NZ * W * H); bfsSeen = new Uint32Array(NZ * W * H); bfsGen = 0; }
const unpack = i => { const z = ((i / (W * H)) | 0) + ZMIN, r = i - (z - ZMIN) * W * H, x = r % W; return [x, (r - x) / W, z]; };
function bfs(sx, sy, sz, goal, maxNodes = 2500, who = null){
  if (goal(sx, sy, sz)) return [];
  const lo = who ? SPECIES[who.species].zmin : ZMIN, hi = who ? SPECIES[who.species].zmax : ZMAX;
  const start = idx3(sx, sy, sz);
  const prev = bfsPrev, seen = bfsSeen, gen = ++bfsGen; prev[start] = start; seen[start] = gen;
  const q = [start]; let head = 0;
  while (head < q.length && head < maxNodes){
    const c = q[head++]; const cz = ((c / (W * H)) | 0) + ZMIN, cr = c - (cz - ZMIN) * W * H, cx = cr % W, cy = (cr - cx) / W;
    const st = steps(cx, cy, cz, bfsOut);
    for (let k = 0; k < st.length; k += 3){
      const nx = st[k], ny = st[k + 1], nz = st[k + 2];
      if (nz < lo || nz > hi) continue;
      const ni = idx3(nx, ny, nz);
      if (seen[ni] === gen) continue;
      seen[ni] = gen; prev[ni] = c;
      if (goal(nx, ny, nz)){ const path = []; let j = ni; while (j !== start){ path.push(unpack(j)); j = prev[j]; } return path.reverse(); }
      q.push(ni);
    }
  }
  return null;
}
function reachable(sx, sy, sz, cap = 4000){
  const s = idx3(sx, sy, sz); const seen = new Set([s]); const q = [s]; const out = [];
  for (let head = 0; head < q.length && head < cap; head++){
    const c = q[head]; const cz = ((c / (W * H)) | 0) + ZMIN, cr = c - (cz - ZMIN) * W * H, cx = cr % W, cy = (cr - cx) / W;
    const st = steps(cx, cy, cz, out);
    for (let k = 0; k < st.length; k += 3){ const ni = idx3(st[k], st[k + 1], st[k + 2]); if (seen.has(ni)) continue; seen.add(ni); q.push(ni); }
  }
  return seen;
}
/* The path to a task's next stop. A far stop is approached in stretches of 48 steps. */
function pathToStop(a, tx, ty, within, tz = 0){
  if (nearAt(a, tx, ty, tz) <= within) return [];
  const goal = (x, y, z) => z === tz && dist(x, y, tx, ty) <= within;
  let p = bfs(a.x, a.y, a.z, goal, 4000, a);
  if (p) return p;
  /* Far away, or the straight way is blocked. Search the whole world once and walk the first stretch. */
  p = bfs(a.x, a.y, a.z, goal, NZ * W * H, a);
  return p ? p.slice(0, 48) : null;
}
