// Assemble dist/hearth-sim.html from src/. Run: node build.js
const fs = require('fs');
const sim = require('./src/sim');
const ui = require('./src/ui');
const page = fs.readFileSync('src/page.template.html', 'utf8')
  .replace('__SIM__', () => sim.source())
  .replace('__UI__', () => ui.source());
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/hearth-sim.html', page);
console.log('built dist/hearth-sim.html', Buffer.byteLength(page), 'bytes');
