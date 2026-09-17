// Dev server. Builds dist/, serves it at http://localhost:8700/, and rebuilds when src/ changes.
// Run: node serve.js   (or npm run serve)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const PORT = Number(process.env.PORT || 8700);
const DIST = path.join(__dirname, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

function build(){ try { console.log(execFileSync('node', ['build.js'], { cwd: __dirname }).toString().trim()); } catch (e){ console.error('build failed:', e.stdout ? e.stdout.toString() : e.message); } }
build();
let timer = null;
fs.watch(path.join(__dirname, 'src'), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(build, 150); });

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const file = path.join(DIST, url === '/' ? 'hearth-sim.html' : url);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Hearth dev server: http://localhost:${PORT}/  (branch: ${execFileSync('git', ['branch', '--show-current'], { cwd: __dirname }).toString().trim()})`));
