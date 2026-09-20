// TypeScript checks src/sim/ for wrong argument counts, misspelt fields, and other
// shape mistakes, through tsc --checkJs and JSDoc. No file becomes TypeScript, and
// tsc emits nothing: it only reads and reports. See tsconfig.sim.json and types/sim/.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TSC = path.join(__dirname, '..', 'node_modules', '.bin', 'tsc');
const TSCONFIG = path.join(__dirname, '..', 'tsconfig.sim.json');

test('src/sim passes tsc --checkJs with zero errors', (t) => {
  if (!fs.existsSync(TSC)){
    t.skip('SKIPPED: src/sim and src/ui are not type-checked, because typescript is not installed. Run npm install.');
    return;
  }
  try {
    execFileSync(TSC, ['-p', TSCONFIG, '--pretty', 'false'], { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
  } catch (err){
    const out = String(err.stdout || err.message || '');
    const lines = out.split('\n').filter(Boolean).slice(0, 20);
    assert.fail(`tsc --checkJs found errors in src/sim (first 20 lines):\n${lines.join('\n')}`);
  }
});
