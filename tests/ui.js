// The interface, the parts that run without a browser. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* Join the sim and the pure UI files in one scope, as the page does, and return the names the tests reach into. */
function loadUI(files, names){
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',');
  return new Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}

test('every UI file joins with the sim into one script that compiles', () => {
  assert.doesNotThrow(() => new Function(sim.source() + '\n' + ui.source()));
});

test('the manifest lists every file in src/ui once, and state comes first', () => {
  const onDisk = fs.readdirSync('src/ui').filter(f => f.endsWith('.js') && f !== 'index.js').map(f => f.replace('.js', '')).sort();
  assert.deepEqual([...ui.FILES].sort(), onDisk);
  assert.equal(ui.FILES[0], 'state');
  assert.equal(ui.FILES[ui.FILES.length - 1], 'main');
});

module.exports = { loadUI };
