/* ---------- path search ---------- */
const bfsPrev = new Int32Array(W * H), bfsSeen = new Uint32Array(W * H); let bfsGen = 0;
function bfs(sx, sy, goal, maxNodes = 2500){
  if (goal(sx, sy)) return [];
  const start = idx(sx, sy);
  const prev = bfsPrev, seen = bfsSeen, gen = ++bfsGen; prev[start] = start; seen[start] = gen;
  const q = [start]; let head = 0;
  while (head < q.length && head < maxNodes){
    const c = q[head++]; const cx = c % W, cy = (c - cx) / W;
    for (const [dx, dy] of DIRS){
      const nx = cx + dx, ny = cy + dy;
      if (!inb(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (seen[ni] === gen || !passable(nx, ny)) continue;
      seen[ni] = gen; prev[ni] = c;
      if (goal(nx, ny)){ const path = []; let k = ni; while (k !== start){ path.push([k % W, (k - k % W) / W]); k = prev[k]; } return path.reverse(); }
      q.push(ni);
    }
  }
  return null;
}
function reachable(sx, sy, cap = 4000){
  const seen = new Set([idx(sx, sy)]); const q = [idx(sx, sy)];
  for (let head = 0; head < q.length && head < cap; head++){
    const c = q[head], cx = c % W, cy = (c - cx) / W;
    for (const [dx, dy] of DIRS){ const nx = cx + dx, ny = cy + dy; if (!passable(nx, ny)) continue; const ni = idx(nx, ny); if (seen.has(ni)) continue; seen.add(ni); q.push(ni); }
  }
  return seen;
}
/* One leg of a long walk. Far targets are approached in steps of about 16 tiles. */
function legPath(a, tx, ty, within){
  const d = dist(a.x, a.y, tx, ty); if (d <= within) return [];
  let p = bfs(a.x, a.y, (x, y) => dist(x, y, tx, ty) <= within, 4000);
  if (p) return p;
  /* Far away, or the straight way is blocked. Search the whole world once and walk the first stretch. */
  p = bfs(a.x, a.y, (x, y) => dist(x, y, tx, ty) <= within, W * H);
  return p ? p.slice(0, 48) : null;
}
