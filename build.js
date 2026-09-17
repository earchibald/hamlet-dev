// Assemble dist/hearth-sim.html from src/. Run: node build.js
const fs = require('fs');
const sim = require('./src/sim');
const page = fs.readFileSync('src/page.template.html', 'utf8')
  .replace('__SIM__', () => sim.source())
  .replace('__UI__', () => fs.readFileSync('src/ui.js', 'utf8'));
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/hearth-sim.html', page);
console.log('built dist/hearth-sim.html', page.length, 'bytes');
