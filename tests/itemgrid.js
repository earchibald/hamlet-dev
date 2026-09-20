// Item grid: removeItem must leave itemGrid exactly as a full rebuildItemGrid would. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const { scriptGod } = require('./lib/run');

/* Compares the live grid against a fresh rebuild, slot for slot, by identity. Calling
   rebuildItemGrid is safe here even when the check passes: it replaces itemGrid with an
   equal one, so the world is left correct either way. */
function assertGridMatchesRebuild(api, label){
  const before = api.itemGrid.slice();
  api.rebuildItemGrid();
  const after = api.itemGrid;
  assert.equal(after.length, before.length, `${label}: grid changed size`);
  for (let i = 0; i < after.length; i++){
    assert.strictEqual(before[i], after[i], `${label}: slot ${i} does not match a full rebuild`);
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

/* A real run, two seeds, a few days. Checked whenever the item count changes, which covers
   every removeItem call (and every bulk removal, which already rebuilds on its own and so
   passes trivially). This does not intercept each removeItem call directly: internal code
   calls the bare function, not api.removeItem, so there is no seam to hook without changing
   src/sim. Checking on every count change is the honest substitute; it still fails hard
   against the naive fix, because a shadowed item stays wrong until the next change is seen. */
for (const seed of ['r', 'x']) test(`seed ${seed}: the item grid matches a full rebuild through five days of play`, () => {
  const api = load(); api.startWorld(seed);
  let last = api.items.length;
  for (let i = 0; i < 5000; i++){
    api.step(); scriptGod(api, i);
    if (api.items.length !== last){
      assertGridMatchesRebuild(api, `seed ${seed}, tick ${i}`);
      last = api.items.length;
    }
  }
});
