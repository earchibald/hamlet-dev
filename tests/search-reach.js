// The search reach (issue #83). A person looks for loose things with a near search first. When it
// fails, a sector counter decides whether anything lies within reach. The counter and the search must
// see the same ground. Fast: hand-built cases on a flattened real world.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/sim');

/* A real world, made flat and empty. Every surface tile is open grass, nothing lies on the ground,
   and no slope leads off the surface, so a path is as long as the walk on a plain and nothing else
   can be found. The person stands with full needs and no task, as one of the camp. The camp's stash
   tile is kept, because a gather does not start without one. The positions below are in the default
   world of 10 by 6 sectors, each 28 by 20 tiles. */
function plain(){
  const api = load(); api.startWorld('r');
  const a = api.firstPerson(); const c = api.camps[0]; api.camp = c;
  api.setSite(a.x, a.y);
  for (const t of api.world){ t.ground = 'grass'; t.feature = null; t.struct = null; t.slope = false; t.fire = 0; t.berries = 0; t.mouth = null; }
  for (const t of api.raised) t.slope = false;
  api.items.length = 0; api.rebuildItemGrid(); api.resCache.clear();
  a.task = null; a.carrying = null; a.asleep = false; a.homeless = false; a.cooldown = {}; a.z = 0;
  for (const k in a.needs) a.needs[k] = 90;
  return { api, a, c };
}
const put = (a, x, y) => { a.x = x; a.y = y; a.z = 0; };
const secName = (api, x, y) => { const s = api.secOf(x, y); return api.sectors[api.secIdx(s.sx, s.sy)].name; };
/* What the person was given to do, in words a failure message can carry. */
const doing = (api, a) => !a.task ? 'nothing' : a.task.kind === 'walkTo' ? `a walk to the ${secName(api, a.task.args.at[0], a.task.args.at[1])} (${a.task.args.at})` : `${a.task.kind} ${JSON.stringify(a.task.args)}`;

test('the near search alone cannot see 46 steps on open ground, so each case below needs the far one', () => {
  const { api, a } = plain();
  put(a, 112, 40);
  const far = api.addItem('log', 139, 59);
  assert.equal(api.bfs(a.x, a.y, 0, (x, y) => x === far.x && y === far.y, 2500, a), null, 'the near search reached the far corner: these cases no longer test the far search');
});

test('a free log 57 steps away in another sector, within reach, is found and taken', () => {
  const { api, a } = plain();
  put(a, 126, 50);                       // the middle of sector 4,2
  const log = api.addItem('log', 183, 50); // sector 6,2: two sectors off, 57 steps
  assert.equal(api.bfs(a.x, a.y, 0, (x, y) => x === log.x && y === log.y, 2500, a), null, 'the near search reached the log');
  const ok = api.startTask(a, 'gather', { item: 'log' });
  assert.ok(ok, 'the gather would not start');
  assert.equal(a.task.kind, 'gather', `the person was given ${doing(api, a)} instead of a gather for the log at ${log.x},${log.y}`);
  assert.equal(a.task.args.id, log.id, 'the gather is for another item');
  assert.equal(log.reservedBy, a.id, 'the log is not reserved');
  assert.equal(a.task.path.length, 57, 'the path is not the 57 steps of the plain');
  assert.ok(api.chronicle.some(e => e.text.includes(`heads to the ${secName(api, log.x, log.y).toLowerCase()} to look for logs`)), 'no line says where the person went');
  /* And the person walks there and picks it up. */
  for (let k = 0; k < 400 && api.items.includes(log); k++){ api.camp = a.camp; api.updateBeing(a); api.tick = api.tick + 1; }
  assert.ok(!api.items.includes(log), 'the log was never picked up');
});

test('a person standing in the sector that holds the only log finds it', () => {
  const { api, a } = plain();
  put(a, 112, 40);                        // the top left corner of sector 4,2
  const log = api.addItem('log', 139, 59); // its bottom right corner, 46 steps off
  const ok = api.startTask(a, 'gather', { item: 'log' });
  assert.ok(ok, `the gather would not start: the counter did not see the log in the person's own sector (task: ${doing(api, a)})`);
  assert.equal(a.task.kind, 'gather', `the person was given ${doing(api, a)}`);
  assert.equal(a.task.args.id, log.id);
  assert.ok(!api.chronicle.some(e => e.text.includes('to look for logs')), 'a line says the person went somewhere else for logs');
});

test('a person standing in the sector that holds a log is not sent away to a farther one', () => {
  const { api, a } = plain();
  put(a, 112, 40);
  const mine = api.addItem('log', 139, 59);  // own sector, 46 steps
  const other = api.addItem('log', 62, 40);  // sector 2,2, 50 steps
  const ok = api.startTask(a, 'gather', { item: 'log' });
  assert.ok(ok, 'the gather would not start');
  assert.equal(a.task.kind, 'gather', `the person was sent away: given ${doing(api, a)} while a log lay ${46} steps off in their own sector`);
  assert.equal(a.task.args.id, mine.id, `the person went for the log at ${other.x},${other.y} and not the nearer one at ${mine.x},${mine.y}`);
});

test('a person standing in the sector that holds the only ripe bush finds it', () => {
  const { api, a } = plain();
  put(a, 112, 40);
  const b = api.tileAt(139, 59); b.feature = 'bush'; b.berries = 3;
  const ok = api.startTask(a, 'pickBerries');
  assert.ok(ok, `picking would not start: the counter did not see the bush in the person's own sector (task: ${doing(api, a)})`);
  assert.equal(a.task.kind, 'pickBerries', `the person was given ${doing(api, a)}`);
  const end = a.task.path[a.task.path.length - 1];
  assert.ok(Math.abs(end[0] - 139) + Math.abs(end[1] - 59) <= 1, `the path ends at ${end}, not beside the bush`);
});

test('a ripe bush 57 steps away in another sector is walked to directly', () => {
  const { api, a } = plain();
  put(a, 126, 50);
  const b = api.tileAt(183, 50); b.feature = 'bush'; b.berries = 3;
  const ok = api.startTask(a, 'pickBerries');
  assert.ok(ok, 'picking would not start');
  assert.equal(a.task.kind, 'pickBerries', `the person was given ${doing(api, a)}`);
});

test('the far search sees no farther than the counter', () => {
  const { api, a } = plain();
  put(a, 126, 50);
  /* A log inside the reach that nobody can walk to: the counter counts it, so the far search runs. */
  const shut = api.addItem('log', 183, 50);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) api.tileAt(183 + dx, 50 + dy).ground = 'rock';
  /* A log the person can walk to, but in a sector past the reach. */
  const s = api.secOf(a.x, a.y), past = api.SEARCH_REACH + 1;
  assert.ok(s.sx + past < api.W / api.LW, 'the world is too narrow for a sector past the reach');
  const beyond = api.addItem('log', (s.sx + past) * api.LW + 1, 50);
  const ok = api.startTask(a, 'gather', { item: 'log' });
  assert.ok(!ok || a.task.args.id !== beyond.id, `the far search took the log at ${beyond.x},${beyond.y}, ${past} sectors off, which the counter does not see`);
  assert.equal(shut.reservedBy, null);
});
