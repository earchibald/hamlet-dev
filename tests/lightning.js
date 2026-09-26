// The first fire from the sky. A camp that the player leaves alone must still get its hearth: a storm,
// lightning near the camp, and a person who runs to the burning pine for an ember.
// design/notes.md, section 4 and section 9: "the player, then lightning and embers".
//
// The soak cannot see this, because its script god lights every pit. This file runs with no god at all,
// and it arrives at the lighting by simulating. It never sets the clock.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const { collect } = require('./lib/run');

/* design/notes.md, section 4: "With the hearth out, about once in 2.5 days." The bound is four of those
   gaps after the pit is laid. If strikes came at the design's rate, a camp would wait longer than that
   less than one time in fifty (e^-4). Before the fix this seed never lit: every strike near the camp
   fell on a pine deep inside a wood, where nobody can stand beside the fire. */
const DESIGN_GAP_DAYS = 2.5, GAPS = 4;
const LAID = /It only needs a spark\./, STRIKE = /^Lightning strikes a pine .* near the camp\./, GRAB = /grabs a burning branch from the blaze/, HEARTH = /sets the ember in the pit\. The wood catches, and the camp has a hearth\./;

/* Step the seed with nobody lighting anything, until the first camp's pit is lit or the bound passes. */
function leftAlone(seed){
  const api = load(), c = collect(api);
  api.startWorld(seed, {});
  let laidAt = null, limit = Infinity;
  for (;;){
    api.step();
    const camp = api.camps[0];
    if (laidAt === null && camp && camp.pit){ laidAt = api.tick; limit = laidAt + GAPS * DESIGN_GAP_DAYS * api.DAY; }
    if (camp && camp.everLit) break;
    if (api.tick > limit || api.tick > 20 * api.DAY) break;
  }
  c.check(seed);
  return { api, events: c.events, laidAt, limit };
}

test('a camp left alone gets its first fire from lightning, on seed moss-crag-87', () => {
  const { api, events, laidAt, limit } = leftAlone('moss-crag-87');
  const at = re => events.findIndex(e => re.test(e.text));
  assert.ok(laidAt !== null, 'the founder never built a pit');
  assert.ok(at(LAID) >= 0, 'no line says the pit waits for a spark');
  /* Nobody from outside acted after the creation. Every act enters by the door, so an empty log is proof. */
  const played = api.doorLog.filter(e => e.tick > 0 && e.act !== 'load');
  assert.deepEqual(played, [], 'something outside the world acted');
  const camp = api.camps[0];
  const day = t => (t / api.DAY + 1).toFixed(2);
  assert.ok(camp.everLit, `the pit was laid on day ${day(laidAt)} and was still cold on day ${day(api.tick)}, past the bound of day ${day(limit)}`);
  const s = at(STRIKE), g = at(GRAB), h = at(HEARTH);
  assert.ok(s >= 0, 'the pit is lit, but no lightning struck near the camp');
  assert.ok(g > s, 'nobody took an ember from the strike');
  assert.ok(h > g, `the hearth line did not follow the ember: ${events.filter(e => e.kind === 'major').map(e => e.text).slice(-3).join(' / ')}`);
});
