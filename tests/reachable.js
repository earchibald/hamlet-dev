// reachable(): the flood fill over walkable tiles. Fast: a handful of worlds, many starts and caps.
// The contract under test: reachable returns a Set with the same members, in the same insertion
// order, as the old Set-based fill. A caller may keep the returned Set (settle.js's startRegion
// does, across ticks and into the snapshot), so the new fill must not hand out a shared, reusable
// buffer as the return value; only its internal "have I seen this tile" check may use one.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

/* The old implementation, kept here as the reference. It calls the live steps()/idx3() (untouched
   by this fix) so it stays a fair comparison even as reachable()'s own innards change. */
function referenceReachable(api, sx, sy, sz, cap = 4000){
  const { idx3, steps, W, H, ZMIN } = api;
  const s = idx3(sx, sy, sz); const seen = new Set([s]); const q = [s]; const out = [];
  for (let head = 0; head < q.length && head < cap; head++){
    const c = q[head];
    const cz = Math.floor(c / (W * H)) + ZMIN, cr = c - (cz - ZMIN) * W * H, cx = cr % W, cy = (cr - cx) / W;
    const st = steps(cx, cy, cz, out);
    for (let k = 0; k < st.length; k += 3){
      const ni = idx3(st[k], st[k + 1], st[k + 2]);
      if (seen.has(ni)) continue;
      seen.add(ni); q.push(ni);
    }
  }
  return seen;
}

/* Compare the new reachable() against the reference: same members, same insertion order. */
function assertSameFill(api, sx, sy, sz, cap, label){
  const got = api.reachable(sx, sy, sz, cap);
  const want = referenceReachable(api, sx, sy, sz, cap);
  assert.deepEqual([...got], [...want], `${label}: members or order differ at (${sx},${sy},${sz}) cap ${cap}`);
}

const SEEDS = ['r', 'x'];
const CAPS = [1, 50, 4000];

test('reachable matches the old Set fill across seeds, starts, and caps', () => {
  for (const seed of SEEDS){
    const api = load(); api.startWorld(seed);
    const full = api.NZ * api.W * api.H;
    const a = api.firstPerson();
    const starts = [[a.x, a.y, a.z]];
    for (const s of api.foundingSites().slice(0, 3)){ const [x, y] = [s.sx * 28 + 14, s.sy * 20 + 10]; starts.push([x, y, 0]); }
    if (api.raised.length){ const t = api.raised[0]; starts.push([t.x, t.y, t.z]); }
    if (api.caves.length){ const c = api.caves.find(k => k.deep) || api.caves[0]; const d = c.deep || c; if (d.x !== undefined) starts.push([d.x, d.y, d.z]); }
    for (const [sx, sy, sz] of starts){
      for (const cap of [...CAPS, full]) assertSameFill(api, sx, sy, sz, cap, `seed ${seed}`);
    }
  }
});

test('two calls in a row from different starts do not bleed into each other', () => {
  const api = load(); api.startWorld('r');
  const full = api.NZ * api.W * api.H;
  const a = api.firstPerson();
  const first = api.reachable(a.x, a.y, a.z, full);
  const otherStart = api.foundingSites()[0];
  const [ox, oy] = [otherStart.sx * 28 + 14, otherStart.sy * 20 + 10];
  const second = api.reachable(ox, oy, 0, full);
  const refFirst = referenceReachable(api, a.x, a.y, a.z, full);
  const refSecond = referenceReachable(api, ox, oy, 0, full);
  assert.deepEqual([...second], [...refSecond], 'second call was polluted by the first call\'s marks');
  // The first call's own Set must still hold its own members: taking the second call must not
  // reach back and mutate a Set already handed to a caller.
  assert.deepEqual([...first], [...refFirst], 'first call\'s returned Set changed after a later call');
});

test('a small world and a large world in the same process each get a fill sized to their own map', () => {
  const small = load(); small.startWorld('r', { sw: 4, sh: 3 });
  const big = load(); big.startWorld('r', { sw: 12, sh: 8 });
  const aSmall = small.firstPerson(), aBig = big.firstPerson();
  assertSameFill(small, aSmall.x, aSmall.y, aSmall.z, small.NZ * small.W * small.H, 'small world');
  assertSameFill(big, aBig.x, aBig.y, aBig.z, big.NZ * big.W * big.H, 'big world');
  // Same process, one engine after another, at two different sizes: the internal scratch buffer
  // (if any) must have been reallocated to fit the new size, not silently reused at the wrong size.
  const api = load(); api.startWorld('r', { sw: 12, sh: 8 });
  const a1 = api.firstPerson();
  assertSameFill(api, a1.x, a1.y, a1.z, api.NZ * api.W * api.H, 'reused engine, big');
  api.startWorld('r', { sw: 4, sh: 3 });
  const a2 = api.firstPerson();
  assertSameFill(api, a2.x, a2.y, a2.z, api.NZ * api.W * api.H, 'reused engine, small');
});
