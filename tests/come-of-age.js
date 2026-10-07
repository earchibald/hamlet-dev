// A child comes of age, and the chronicle says so once. Fast.
//
// `stage()` is a pure function of a being's age, so the turn from 'young' to 'adult' is no event of
// its own. `comeOfAge` in src/sim/beings.js catches it in `catchUp`, against the `grown` flag a birth
// sets in src/sim/camps.js. These tests hold the four ways the line could go wrong: never written,
// written for somebody who walked in grown, lost or doubled across a long catch-up or a moved clock,
// and doubled across a save.
//
// Every child here comes from the real birth rule, not from a hand-made being with the flag set by
// hand. A hand-made child would pass while camps.js forgot to set the flag.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');
const { setClock } = require('./lib/run');

/* A small world with two founders who like each other, a roof, and food that does not spoil. The
   birth rule is asked on its own beat until it rolls a child. `lastChild` is pushed far back
   because makeBeing's default is a tick count from before the units changed, and it is still
   inside the birth gap of a world one day old. */
function world(seed = 'r'){
  const api = load();
  api.startWorld(seed, { sw: 3, sh: 2 });
  const c = api.camps[0], a = api.humans()[0];
  const b = api.makeBeing('human', a.x, a.y, 'Wren', 0); b.camp = c; api.beings.push(b);
  a.lastChild = b.lastChild = -1e9;
  c.site = [a.x, a.y]; c.shelter = [a.x, a.y];
  return { api, c, founders: [a, b] };
}
function withChild(seed = 'r'){
  const w = world(seed), { api, c, founders: [a, b] } = w, E = api.CLOCK.birth.every;
  let child = null;
  for (let k = Math.ceil(api.tick / E) + 1, tries = 0; !child && tries < 40; k++, tries++){
    setClock(api, k * E - 1);
    a.opinions[b.id] = 60; b.opinions[a.id] = 60; c.stash.smoked = 60;
    api.step();
    child = api.beings.find(x => x.species === 'human' && x.parents);
  }
  assert.ok(child, 'the birth rule rolled no child in forty tries');
  return { ...w, child, turn: child.born + Math.round(api.LIFE.human.adult * api.DAY) };
}
const grownLines = api => api.chronicle.filter(e => e.tag === 'grown');
const stepTo = (api, at) => { while (api.tick < at) api.step(); };
/* Long enough for every being to be brought up to date at least once: the body beat is the
   longest a live being waits for `catchUp`. */
const beats = (api, n) => n * api.CLOCK.every.body;

test('a child born in a camp is marked not yet grown, and a founder carries no mark', () => {
  const { child, founders } = withChild();
  assert.equal(child.grown, false);
  for (const f of founders) assert.equal(f.grown, undefined, `${f.name} walked in grown and must carry no mark`);
});

test('a child comes of age with one line, within a body beat of the turn', () => {
  const { api, child, turn } = withChild();
  setClock(api, turn - beats(api, 3));
  while (api.tick < turn){ api.step(); assert.equal(grownLines(api).length, 0, `a line before the turn, at ${api.tick}`); }
  stepTo(api, turn + beats(api, 2));
  const lines = grownLines(api);
  assert.equal(lines.length, 1, lines.map(e => e.text).join(' | '));
  const e = lines[0];
  assert.equal(e.text, `${child.name} is grown now, and takes a full share of the work at ${api.campNameOf(child.camp)}.`);
  assert.equal(e.kind, 'major');
  assert.ok(e.tick >= turn && e.tick <= turn + api.CLOCK.every.body, `the line came at ${e.tick}, the turn was ${turn}`);
  assert.equal(child.grown, true);
  assert.equal(api.stage(child), 'adult');
  stepTo(api, api.tick + beats(api, 5));
  assert.equal(grownLines(api).length, 1, 'the line was written again');
});

test('nobody who walked in grown comes of age', () => {
  const { api, founders } = world();
  stepTo(api, api.tick + beats(api, 3));
  setClock(api, api.tick + api.DAY);
  stepTo(api, api.tick + beats(api, 3));
  assert.ok(founders.every(f => f.alive), 'a founder died, so the run proves nothing about them');
  assert.deepEqual(grownLines(api).map(e => e.text), []);
});

test('a long catch-up across the turn writes the line once', () => {
  const { api, child, turn } = withChild();
  setClock(api, turn - api.DAY / 4);
  for (const k in child.needs) child.needs[k] = 100;
  child.hp = 100;
  const from = child.seen;
  /* The tick moves and the child's body is left behind, which is what a being nobody looked at for
     half a world day is. `catchUp` then crosses the turn in many stretches. */
  // Not setClock: it would move `seen` with the tick, and no catch-up would cross the turn.
  api.tick = turn + api.DAY / 4;
  assert.equal(grownLines(api).length, 0);
  api.catchUp(child);
  assert.ok(child.alive, 'the child did not live through the catch-up');
  assert.equal(from, turn - api.DAY / 4, 'the body was not left behind before the jump');
  assert.equal(child.seen, api.tick);
  assert.equal(grownLines(api).length, 1);
  api.catchUp(child);
  stepTo(api, api.tick + beats(api, 3));
  assert.equal(grownLines(api).length, 1, 'the line was written again');
});

test('a clock set past the turn still writes the line once', () => {
  /* setClock moves `seen` with the tick, so no stretch of the child's body spans the turn. A check
     that compared the stage at the two ends of a stretch would never see it. The days would have
     written the line, so the moved clock must too. */
  const { api, child, turn } = withChild();
  setClock(api, turn + api.DAY);
  stepTo(api, api.tick + beats(api, 3));
  assert.ok(child.alive);
  assert.equal(grownLines(api).length, 1);
  assert.match(grownLines(api)[0].text, new RegExp(`^${child.name} is grown now`));
});

const through = snap => JSON.parse(JSON.stringify(snap));

test('a save made before the turn writes the line once after the load', () => {
  const { api, child, turn } = withChild();
  setClock(api, turn - beats(api, 3));
  const snap = through(api.takeSnapshot());
  const b = load();
  assert.equal(b.loadSnapshot(snap), null);
  const kid = b.beingById(child.id);
  assert.equal(kid.grown, false, 'the save lost the mark');
  stepTo(b, turn + beats(b, 3));
  assert.equal(grownLines(b).length, 1);
  assert.equal(kid.grown, true);
});

test('a save made after the turn does not write the line again', () => {
  const { api, child, turn } = withChild();
  setClock(api, turn - beats(api, 1));
  stepTo(api, turn + beats(api, 2));
  assert.equal(grownLines(api).length, 1);
  const snap = through(api.takeSnapshot());
  const b = load();
  assert.equal(b.loadSnapshot(snap), null);
  assert.equal(grownLines(b).length, 1, 'the loaded chronicle should hold the one line it was saved with');
  stepTo(b, b.tick + beats(b, 5));
  assert.equal(grownLines(b).length, 1, 'the line was written again after the load');
  assert.equal(b.beingById(child.id).grown, true, 'the save lost the mark');
});

test('a child who dies in the catch-up that crosses the turn writes no line', () => {
  /* A dead child did not grow up, so the line must wait for the body to be alive at the end. The
     child starves inside the same long catch-up that carries it past the turn. */
  const { api, child, turn } = withChild();
  setClock(api, turn - api.DAY / 4);
  child.needs.food = 0; child.needs.water = 0; child.hp = 1;
  // Not setClock, for the reason the long catch-up above gives.
  api.tick = turn + api.DAY / 4;
  api.catchUp(child);
  assert.equal(child.alive, false, 'the child lived, so the case is not reached');
  /* `diedAt` is the present tick, wherever in the catch-up the body gave out. `seen` is the end of the
     stretch the body died in, so it says the death came before the turn. */
  assert.ok(child.seen < turn, `the body gave out at ${child.seen}, after the turn at ${turn}`);
  assert.equal(grownLines(api).length, 0);
});

test('the coming-of-age line names no night', () => {
  /* Its kind is major, so a row in the event table would make it a night's name at the fire. */
  const api = load();
  assert.equal(api.EVENT_NAMES.grown, undefined);
  assert.ok(Object.keys(api.EVENT_NAMES).includes('birth'), 'the event table is not the one this test reads');
});
