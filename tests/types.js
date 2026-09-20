// TypeScript checks src/sim/ for wrong argument counts, misspelt fields, and other
// shape mistakes, through tsc --checkJs and JSDoc. No file becomes TypeScript, and
// tsc emits nothing: it only reads and reports. See tsconfig.sim.json and types/sim/.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TSC = path.join(__dirname, '..', 'node_modules', '.bin', 'tsc');
const ROOT = path.join(__dirname, '..');
const TSCONFIG = path.join(ROOT, 'tsconfig.sim.json');
const PROBE_TSCONFIG = path.join(ROOT, 'tsconfig.probe.json');
const SKIP_MESSAGE = 'SKIPPED: src/sim is not type-checked, because typescript is not installed. Run npm install.';

function runTsc(tsconfig){
  try {
    execFileSync(TSC, ['-p', tsconfig, '--pretty', 'false'], { cwd: ROOT, stdio: 'pipe' });
    return { ok: true, out: '' };
  } catch (err){
    return { ok: false, out: String(err.stdout || err.message || '') };
  }
}

test('src/sim passes tsc --checkJs with zero errors', (t) => {
  if (!fs.existsSync(TSC)){
    t.skip(SKIP_MESSAGE);
    return;
  }
  const r = runTsc(TSCONFIG);
  if (!r.ok){
    const lines = r.out.split('\n').filter(Boolean).slice(0, 20);
    assert.fail(`tsc --checkJs found errors in src/sim (first 20 lines):\n${lines.join('\n')}`);
  }
});

// The record shapes in types/sim/records.d.ts must not carry a catch-all index signature
// (cooldown excepted; see the comment there), and the shared state in core.js (beings,
// items, camp, tileAt(), and the rest) must stay typed, because either one hides a
// misspelt field from tsc rather than catching it. types/probe/misspelled.js reads a bad
// field off a Being and a Tile made directly (makeBeing()/makeTile()) and, more
// realistically, off the shared `beings` and `items` arrays, `tileAt()`, and the `camp`
// global, which is how almost all of src/sim/ actually reaches a record. Every line marked
// `// PROBE:` in that file must fail with TS2339. tsconfig.probe.json checks it alongside
// src/sim/. The probe file is never part of tsconfig.sim.json, of build.js, or of
// dist/hearth-sim.html: it lives only to make this guard fail loudly if a broad index
// signature, or an untyped hole in the shared state, ever comes back.
test('a misspelt field is caught on every record kind, not hidden', (t) => {
  if (!fs.existsSync(TSC)){
    t.skip(SKIP_MESSAGE);
    return;
  }
  const probeSrc = fs.readFileSync(path.join(ROOT, 'types', 'probe', 'misspelled.js'), 'utf8');
  const wantCount = (probeSrc.match(/\/\/ PROBE:/g) || []).length;
  assert.ok(wantCount >= 4, 'the probe fixture should mark at least 4 lines with // PROBE:, one per record kind.');

  const r = runTsc(PROBE_TSCONFIG);
  assert.equal(r.ok, false, 'tsc found no errors on the probe fixture; a misspelt field would now pass silently. See types/probe/misspelled.js.');
  const got2339 = (r.out.match(/error TS2339:/g) || []).length;
  const got2551 = (r.out.match(/error TS2551:/g) || []).length;
  if (got2339 + got2551 < wantCount){
    assert.fail(`expected at least ${wantCount} "property does not exist" errors (one per // PROBE: line), got ${got2339 + got2551}:\n${r.out}`);
  }
  // A close-to-real name (like a real one-letter typo) can come back as TS2551, "did you
  // mean X", instead of TS2339; both mean the field does not exist, so either counts. But
  // every field name the fixture chose is deliberately far from a real one, so if tsc ever
  // starts answering with TS2551 here, a real field of that near-name was probably added,
  // which is worth a human's eyes even though this assertion would still pass.
  const beingHungerr = /Property 'hungerr' does not exist on type 'Being'/.test(r.out);
  const tileMade = /Property 'bogusTileField' does not exist on type 'Tile'/.test(r.out);
  const tileFromTileAt = /Property 'bogus' does not exist on type 'Tile'/.test(r.out);
  const item = /Property 'bogusItemField' does not exist on type 'GroundItem'/.test(r.out);
  const camp = /Property 'bogusCampField' does not exist on type 'Camp'/.test(r.out);
  if (!beingHungerr || !tileMade || !tileFromTileAt || !item || !camp){
    assert.fail(`one of the five marked property names was not reported as missing:\n${r.out}`);
  }
});
