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
// (cooldown excepted; see the comment there), because a catch-all hides a misspelt field
// from tsc rather than catching it. types/probe/misspelled.js reads one bad field off a
// real Being and off a real Tile; tsconfig.probe.json checks it alongside src/sim/, and
// both lines must fail with TS2339. The probe file is never part of tsconfig.sim.json,
// of build.js, or of dist/hearth-sim.html: it lives only to make this guard fail loudly
// if a broad index signature ever comes back.
test('a misspelt Being field and a misspelt Tile field are caught, not hidden', (t) => {
  if (!fs.existsSync(TSC)){
    t.skip(SKIP_MESSAGE);
    return;
  }
  const r = runTsc(PROBE_TSCONFIG);
  assert.equal(r.ok, false, 'tsc found no errors on the probe fixture; a misspelt field would now pass silently. See types/probe/misspelled.js.');
  const being = /misspelled\.js\(\d+,\d+\): error TS2339: Property 'hungerr' does not exist on type 'Being'/.test(r.out);
  const tile = /misspelled\.js\(\d+,\d+\): error TS2339: Property 'bogusTileField' does not exist on type 'Tile'/.test(r.out);
  if (!being || !tile){
    assert.fail(`the probe did not report TS2339 on both marked lines:\n${r.out}`);
  }
});
