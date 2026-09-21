// Item grid: removeItem must leave itemGrid exactly as a full rebuildItemGrid would. The hand-built
// case is fast; the two real runs are behind LONG=1, and say below what they cost.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
/* DAY comes from the sim through the runner. The real runs below were written as `5000` under a test
   that says five days, which was five days when a day was 1,000 ticks. After G4 made the day 86,400
   it was 1.4 world hours, and this file had no vacuity control to say so. */
const { scriptGod, DAY } = require('./lib/run');

/* Compares the live grid against a fresh rebuild, slot for slot, by identity. Calling
   rebuildItemGrid is safe here even when the check passes: it replaces itemGrid with an
   equal one, so the world is left correct either way. */
function assertGridMatchesRebuild(api, label){
  const before = api.itemGrid.slice();
  api.rebuildItemGrid();
  const after = api.itemGrid;
  assert.equal(after.length, before.length, `${label}: grid changed size`);
  for (let i = 0; i < after.length; i++){
    if (before[i] !== after[i]) assert.strictEqual(before[i], after[i], `${label}: slot ${i} does not match a full rebuild`);
  }
}

test('three items stacked on one tile: the slot follows array order as items are removed', () => {
  const api = load(); api.startWorld('r');
  const x = 2, y = 2, z = 0;
  const there = api.itemAt(x, y, z); if (there) api.removeItem(there);
  const a = api.addItem('rock', x, y, z);
  const b = api.addItem('rock', x, y, z);
  const c = api.addItem('rock', x, y, z);
  assert.equal(api.itemAt(x, y, z), a, 'the first item added holds the slot');
  assertGridMatchesRebuild(api, 'after three adds');

  api.removeItem(a);
  assert.equal(api.itemAt(x, y, z), b, 'the next item in array order takes the slot');
  assertGridMatchesRebuild(api, 'after removing the slot holder');

  api.removeItem(c);
  assert.equal(api.itemAt(x, y, z), b, 'removing an item that did not hold the slot leaves it alone');
  assertGridMatchesRebuild(api, 'after removing a non-slot item');

  api.removeItem(b);
  assert.equal(api.itemAt(x, y, z), null, 'the slot is empty once every item on the tile is gone');
  assertGridMatchesRebuild(api, 'after removing the last item on the tile');
});

/* A real run, two seeds, five days. Checked after every tick. A check on a changed item count
   would miss a tick that removes one item and adds another. Internal code calls the bare
   removeItem, not api.removeItem, so there is no seam to check after each call. A fault still
   shows at the tick it happens, because the grid is compared before the rebuild replaces it.

   What the run must cross is items leaving the world, because removeItem is what it guards. Measured
   on this branch, with the script god, by taking the set of live item ids each tick:

     ticks              seed r                 seed x
     5,000 (0.06 day)   3 added, 15 removed    5 added, 15 removed
     5 days             573 added, 132 removed 677 added, 121 removed

   The first row is what this file did after the merge. It is not nothing, so this test did not
   collapse to vacuity the way garden.js did; it was thin, and nothing here said how thin. The guard
   at the end of the run says it now: it asks for MOVES of each kind, a plain number that no default
   in the sim can move on its own, and it fails on a 5,000-tick run. */
const DAYS = 5;
const MOVES = 50;
/* Five world days of two seeds, with a whole-grid rebuild and a slot-for-slot compare after every
   one of 432,000 ticks, is the honest cost of the claim above. The flag carries it; a smaller day
   count would be a different test wearing this one's name. */
const MEASURED_SECS = 347;
const TOO_LONG = process.env.LONG ? false
  : `${DAYS} world days on each of two seeds, a full grid rebuild after every one of ${DAYS * DAY} ticks: ${MEASURED_SECS} s together, measured on this branch with \`time LONG=1 node --test tests/itemgrid.js\` on an 18-core Mac at one-minute load average 11.1. LONG=1 runs it. The stacked-tile case above runs every time.`;
for (const seed of ['r', 'x']) test(`seed ${seed}: the item grid matches a full rebuild through ${DAYS} days of play`, { skip: TOO_LONG }, t => {
  const api = load(); api.startWorld(seed);
  let added = 0, removed = 0, prev = new Set(api.items.map(it => it.id));
  for (let i = 0; i < DAYS * DAY; i++){
    api.step(); scriptGod(api, i);
    assertGridMatchesRebuild(api, `seed ${seed}, tick ${i}`);
    const now = new Set(api.items.map(it => it.id));
    for (const id of now) if (!prev.has(id)) added++;
    for (const id of prev) if (!now.has(id)) removed++;
    prev = now;
  }
  t.diagnostic(`seed ${seed}: ${added} items added and ${removed} removed over ${DAYS} days`);
  /* The vacuity control. A grid that no removal ever touched agrees with a rebuild for free. */
  assert.ok(removed >= MOVES, `seed ${seed}: only ${removed} items left the world in ${DAYS} days, fewer than the ${MOVES} this run is meant to cross; removeItem was barely exercised`);
  assert.ok(added >= MOVES, `seed ${seed}: only ${added} items entered the world in ${DAYS} days, fewer than the ${MOVES} this run is meant to cross`);
});
