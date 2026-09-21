// Build a browser harness for the draw cost, without touching src/ or dist/.
//
// It copies dist/hearth-sim.html into tests/perf/out/ and appends one small
// <script> tag after the page's own script. Every file in src/sim and src/ui
// is joined into ONE non-module <script> block (see src/sim/index.js and
// src/ui/index.js). Classic, non-module scripts in the same document share
// one global lexical scope, so a later <script> tag can call the page's own
// top-level functions (draw, step, onSettle, closeDialogs, newWorld) and read
// its top-level state (era, camps, camp, W, H, levels, beings, items) by
// name, with no export needed. That is what makes this harness possible
// without changing the page.
//
// Usage: node tests/perf/draw-harness.js
// Then open tests/perf/out/draw-harness.html in a browser. The measurement
// runs once, automatically, after the page settles past the ages. Read the
// result from the on-page box, or from the browser console (one JSON line,
// prefixed PERF_RESULT).
'use strict';
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist', 'hearth-sim.html');
const OUT_DIR = path.join(__dirname, 'out');
const OUT_FILE = path.join(OUT_DIR, 'draw-harness.html');

const N_DRAW = 200;
const N_STEP = 2000;
const SEED = 'r';
const SETTLE_GUARD = 500000; // ticks; refuses to spin forever if the ages never settle

const HARNESS_SCRIPT = `
<script>
/* Injected by tests/perf/draw-harness.js. Not part of the shipped page. */
(function(){
  function showResult(text, ok){
    const el = document.createElement('pre');
    el.id = 'perf-result';
    el.style.cssText = 'position:fixed;top:0;left:0;background:' + (ok ? '#fff' : '#900') + ';color:' + (ok ? '#000' : '#fff') + ';padding:10px;font:12px/1.4 monospace;z-index:99999;max-width:92vw;max-height:92vh;overflow:auto;white-space:pre-wrap;border:2px solid #333;';
    el.textContent = text;
    document.body.appendChild(el);
  }
  function runHarness(){
    try {
      closeDialogs();
      newWorld(${JSON.stringify(SEED)});
      let guard = 0;
      while (era === 'gods' && guard < ${SETTLE_GUARD}) { step(); guard++; }
      if (era === 'gods') throw new Error('the ages did not settle within ' + ${SETTLE_GUARD} + ' ticks');
      onSettle();
      camp = camps[0];
      draw(); // warm-up, so the first real call is not counted (canvas allocation, JIT warm-up)
      const d0 = performance.now();
      for (let i = 0; i < ${N_DRAW}; i++) draw();
      const d1 = performance.now();
      const s0 = performance.now();
      for (let i = 0; i < ${N_STEP}; i++) step();
      const s1 = performance.now();
      const result = {
        drawMsAvg: (d1 - d0) / ${N_DRAW}, drawCalls: ${N_DRAW},
        stepMsAvg: (s1 - s0) / ${N_STEP}, stepCalls: ${N_STEP},
        W: W, H: H, levels: levels.length,
        beings: beings.length, items: items.length,
        ticksToSettle: guard,
        userAgent: navigator.userAgent,
        dpr: window.devicePixelRatio || 1,
      };
      const line = 'PERF_RESULT ' + JSON.stringify(result);
      console.log(line);
      showResult(JSON.stringify(result, null, 2), true);
    } catch (e){
      const msg = 'PERF_HARNESS_ERROR ' + (e && e.stack ? e.stack : String(e));
      console.error(msg);
      showResult(msg, false);
    }
  }
  /* initUI() already ran synchronously above this script and sized the
     canvases, so nothing here waits on requestAnimationFrame: a hidden or
     unfocused tab throttles or skips rAF entirely, and a harness that never
     fires is a silent failure, not a small one. A run this early with a
     freshly opened tab is still a page that has done its first layout. */
  runHarness();
})();
</script>
`;

function main(){
  if (!fs.existsSync(DIST)) throw new Error(`${DIST} does not exist. Run node build.js first.`);
  const page = fs.readFileSync(DIST, 'utf8');
  if (!page.includes('</body>')) throw new Error('dist/hearth-sim.html has no </body> to inject before');
  const withHarness = page.replace('</body>', HARNESS_SCRIPT + '</body>');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, withHarness);
  console.log('wrote', OUT_FILE);
  console.log(`Open it in a browser. It measures ${N_DRAW} draw() calls and ${N_STEP} step() calls`);
  console.log('once the seed', JSON.stringify(SEED), 'world settles past the ages, and prints one');
  console.log('JSON line to the console (PERF_RESULT ...) and to an on-page box.');
}

main();
