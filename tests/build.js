// The build's printed size must be the size of the file it wrote.
// build.js once printed page.length, a count of UTF-16 code units, and
// labelled it bytes. The page holds non-ASCII glyphs, so that number was
// 166 short of the file on disk, and it rose by 1 for an em dash that
// cost 3. Sessions quoted it beside stat and wc -c and found a gap.
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const built = path.join(root, 'dist', 'hearth-sim.html');

test('build.js prints the byte size of the file it wrote', () => {
  const out = execFileSync(process.execPath, ['build.js'], { cwd: root, encoding: 'utf8' });
  const clean = out.replace(/\u001b\[[0-9;]*m/g, '');
  const m = clean.match(/built dist\/hearth-sim\.html (\d+) bytes/);
  assert.ok(m, `build.js did not print a size line. It printed: ${JSON.stringify(clean)}`);
  const printed = Number(m[1]);
  const onDisk = fs.statSync(built).size;
  assert.strictEqual(printed, onDisk,
    `build.js printed ${printed} bytes, the file is ${onDisk} bytes`);
});

// The check above passes on a character count too, whenever the page is
// pure ASCII, because then the two readings agree. This arms it. If the
// page ever loses its non-ASCII glyphs on purpose, this line fails and
// says so, rather than the test above passing for no reason.
test('the page holds non-ASCII characters, so the size check can fail', () => {
  const page = fs.readFileSync(built, 'utf8');
  const wide = page.match(/[^\x00-\x7F]/g) || [];
  assert.ok(wide.length > 0,
    'dist/hearth-sim.html is pure ASCII. A character count and a byte count ' +
    'agree on it, so the test above no longer tells the two apart.');
});
