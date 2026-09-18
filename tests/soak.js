// The soak: six seeds for 70 days, with assertions.
//   node tests/soak.js                     full run, about 15 seconds a seed
//   SEEDS=r DAYS=10 node tests/soak.js     a quick run
//   UPDATE_GOLDEN=1 node tests/soak.js     bless new numbers after a rule change
//
// The golden record (tests/soak-golden.json) holds a fingerprint of each
// seed's run. Any change to the rules changes it. That is the point: after a
// change to the core, look at the printed numbers, decide the change is what
// you meant, then bless it. The record is only checked on the default run.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runDays, countEvents, fingerprint, oddDeaths, denDeaths, cutOff, campLine, logGod, replayGod } = require('./lib/run');

const DEFAULT_SEEDS = ['r', 'x', 'alpha', 'beta', 'gamma', 'delta'], DEFAULT_DAYS = 70;
const SEEDS = process.env.SEEDS ? process.env.SEEDS.split(',') : DEFAULT_SEEDS;
const DAYS = process.env.DAYS ? Number(process.env.DAYS) : DEFAULT_DAYS;
const isDefault = DAYS === DEFAULT_DAYS && SEEDS.join() === DEFAULT_SEEDS.join();
const GOLDEN = path.join(__dirname, 'soak-golden.json');
const golden = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : {};
let goldenDirty = false;

/* Deaths that are not old age, seen in the soak and not yet traced, by seed. Each is a bug until
   proven otherwise. Trace with tests/trace-deaths.js <seed>. Remove an entry when the bug is fixed. */
const KNOWN_DEATHS = {};

for (const seed of SEEDS){
  test(`seed ${seed}, ${DAYS} days`, async t => {
    const t0 = Date.now();
    const stranded = [];
    const { api, events } = runDays(seed, DAYS, (api, i) => { if (api.tick % 1000 === 0) stranded.push(...cutOff(api)); });
    const counts = countEvents(api, events), fp = fingerprint(api, events);
    t.diagnostic(`${seed}: ${Date.now() - t0} ms, ${events.length} chronicle lines`);
    t.diagnostic(api.camps.map(c => campLine(api, c)).join(' | '));
    t.diagnostic(JSON.stringify(counts));

    await t.test('the first camp has a site, a pit, and a fire that was lit', () => {
      const c = api.camps[0];
      assert.ok(c.site, 'no site chosen'); assert.ok(c.pit, 'no fire pit built'); assert.ok(c.everLit, 'the pit was never lit');
    });
    await t.test('someone is alive at the end', () => {
      assert.ok(counts.alive > 0, `all ${counts.humans} people are dead`);
    });
    await t.test('the camps grow', () => {
      assert.ok(counts.humans >= 20 && counts.born >= 1, `only ${counts.humans} people ever, ${counts.born} born`);
    });
    await t.test('nobody dies of anything but old age', { todo: KNOWN_DEATHS[seed] ? `known: ${KNOWN_DEATHS[seed].join(' ')}` : false }, () => {
      assert.deepEqual(oddDeaths(events), [], 'a death that is not old age is a bug until proven otherwise');
    });
    await t.test('at most one person a seed dies in a den', () => {
      const d = denDeaths(events); if (d.length) t.diagnostic(`${seed}: den deaths: ${d.join('; ')}`);
      assert.ok(d.length <= 1, `den deaths: ${d.join('; ')}`);
    });
    await t.test('nobody is cut off from their camp', () => {
      assert.deepEqual(stranded, [], 'a person who cannot walk home is trapped, and a trap is a bug');
    });
    await t.test('every camp with a pit keeps a chronicle of a lit fire', () => {
      for (const c of api.camps) if (c.pit) assert.ok(c.everLit, `${c.name} built a pit that was never lit`);
    });
    await t.test('the run matches the golden record', { skip: !isDefault && 'not the default run' }, () => {
      const g = golden[seed];
      if (!g || process.env.UPDATE_GOLDEN){ golden[seed] = { days: DAYS, ...fp, counts }; goldenDirty = true; t.diagnostic(`${seed}: golden record ${g ? 'updated' : 'written'}`); return; }
      const diffs = Object.keys(fp).filter(k => JSON.stringify(g[k]) !== JSON.stringify(fp[k]));
      const changed = Object.keys(counts).filter(k => JSON.stringify(g.counts[k]) !== JSON.stringify(counts[k])).map(k => `${k}: ${JSON.stringify(g.counts[k])} -> ${JSON.stringify(counts[k])}`);
      assert.deepEqual(diffs, [], `the story changed for seed ${seed}. Counts that moved: ${changed.join('; ') || 'none'}. If the change is intended, run UPDATE_GOLDEN=1 node tests/soak.js`);
    });
  });
}

test('the same seed tells the same story twice', () => {
  const a = runDays('r', 2), b = runDays('r', 2);
  assert.deepEqual(b.events.map(e => e.text), a.events.map(e => e.text));
  assert.deepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events));
});

test('a seed and its log replay the same story', () => {
  const a = runDays('r', 2);
  assert.ok(a.api.doorLog.length >= 1, 'the script god never lit a pit in two days');
  const b = runDays(a.api.replay.seed, 2, null, replayGod(a.api.replay), a.api.replay.options);
  assert.deepEqual(b.api.doorLog, a.api.doorLog);
  assert.deepEqual(b.events.map(e => e.text), a.events.map(e => e.text));
  assert.deepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events));
});

test('a different log tells a different story', () => {
  const a = runDays('r', 2);
  const late = a.api.doorLog.map(e => ({ ...e, tick: e.tick + 300 }));
  const b = runDays('r', 2, null, logGod(late));
  assert.equal(b.api.doorLog.length, a.api.doorLog.length, 'the moved lighting was dropped, so the test proves nothing');
  assert.notDeepEqual(fingerprint(b.api, b.events), fingerprint(a.api, a.events));
});

test('write the golden record', { skip: !isDefault && 'not the default run' }, () => {
  if (goldenDirty) fs.writeFileSync(GOLDEN, JSON.stringify(golden, null, 1) + '\n');
});
