// The god icon table and its drawing helpers. Fast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sim = require('../src/sim');
const ui = require('../src/ui');

/* Join the sim and the pure UI files in one scope, as the page does, and return the names the tests
   reach into. Copied from tests/ui.js's loadUI, which this file cannot require: that file returns
   early behind SLOW=1 before it defines anything. */
function loadUI(files, names, extra = {}){
  const more = Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join(', ');
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',' + (more ? ' ' + more + ',' : ''));
  return new Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}

const NAMES = ['GOD_ICONS', 'GOD_OUTLINE', 'godIconCells', 'drawGodIcon', 'godIconSvg'];
const api = loadUI(['strip', 'icons'], NAMES);

const POLE_LIST = ['above', 'below', 'wet', 'dry', 'hot', 'cold', 'still', 'moving', 'light', 'dark'];

test('GOD_ICONS has exactly the ten poles, matching POLES', () => {
  assert.deepEqual(Object.keys(api.GOD_ICONS).sort(), [...POLE_LIST].sort());
  assert.deepEqual(Object.keys(api.GOD_ICONS).sort(), Object.keys(api.POLES).sort());
});

test('every art is 9 rows of 9 chars from .abc, and every palette is three hex colours', () => {
  const hex = /^#[0-9a-f]{6}$/i;
  for (const pole of POLE_LIST){
    const { pal, art } = api.GOD_ICONS[pole];
    assert.equal(art.length, 9, `${pole} has 9 rows`);
    for (const row of art){
      assert.equal(row.length, 9, `${pole} row "${row}" is 9 chars`);
      assert.ok(/^[.abc]+$/.test(row), `${pole} row "${row}" holds only . a b c`);
    }
    assert.equal(pal.length, 3, `${pole} has 3 palette colours`);
    for (const c of pal) assert.ok(hex.test(c), `${pole} colour ${c} is #rrggbb`);
  }
});

test('the ten arts are all different', () => {
  const joined = POLE_LIST.map(p => api.GOD_ICONS[p].art.join('|'));
  assert.equal(new Set(joined).size, POLE_LIST.length);
});

test('an unknown pole has no cells', () => {
  assert.equal(api.godIconCells('nowhere'), null);
});

test('every outline cell is empty in the art and touches a filled cell, and no such cell is missed', () => {
  for (const pole of POLE_LIST){
    const { art } = api.GOD_ICONS[pole];
    const filled = (x, y) => x >= 1 && x <= 9 && y >= 1 && y <= 9 && art[y - 1][x - 1] !== '.';
    const cells = api.godIconCells(pole);
    const outline = cells.filter(c => c.fill === api.GOD_OUTLINE);
    const outlineSet = new Set(outline.map(c => `${c.x},${c.y}`));
    for (const c of outline){
      assert.ok(!filled(c.x, c.y), `${pole} outline cell ${c.x},${c.y} is empty in the art`);
      const touches = filled(c.x - 1, c.y) || filled(c.x + 1, c.y) || filled(c.x, c.y - 1) || filled(c.x, c.y + 1);
      assert.ok(touches, `${pole} outline cell ${c.x},${c.y} touches a filled cell`);
    }
    for (let y = 0; y <= 10; y++) for (let x = 0; x <= 10; x++){
      if (filled(x, y)) continue;
      const touches = filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1);
      if (touches) assert.ok(outlineSet.has(`${x},${y}`), `${pole} cell ${x},${y} touches a filled cell and should be outlined`);
    }
  }
});

/* A canvas that draws nothing and keeps the arguments it was given, so a test can check integers
   without a browser. */
function recordCtx(){
  const calls = [];
  let fillStyle = '';
  const c = {
    get fillStyle(){ return fillStyle; }, set fillStyle(v){ fillStyle = v; },
    fillRect(x, y, w, h){ calls.push({ fillStyle, x, y, w, h }); },
  };
  return { c, calls };
}

test('drawGodIcon fills one rect per cell, at integer coordinates, inside a box centred on cx,cy', () => {
  const { c, calls } = recordCtx();
  const cells = api.godIconCells('wet');
  const cx = 100, cy = 60, s = 3.5;
  const ok = api.drawGodIcon(c, 'wet', cx, cy, s);
  assert.equal(ok, true);
  assert.equal(calls.length, cells.length);
  for (const call of calls){
    for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isInteger(call[k]), `fillRect ${k}=${call[k]} is an integer`);
  }
  /* The 11x11 grid's own footprint, not the bounding box of whichever cells happen to be filled: an
     icon whose art keeps clear of the outer ring would otherwise look off-centre by this test alone. */
  const left = Math.round(cx - 11 * s / 2), right = Math.round(cx + 11 * s / 2);
  const top = Math.round(cy - 11 * s / 2), bottom = Math.round(cy + 11 * s / 2);
  for (const call of calls){
    assert.ok(call.x >= left - 1 && call.x + call.w <= right + 1, `cell at x=${call.x} stays inside the centred footprint`);
    assert.ok(call.y >= top - 1 && call.y + call.h <= bottom + 1, `cell at y=${call.y} stays inside the centred footprint`);
  }
  assert.ok(Math.abs((left + right) / 2 - cx) <= 1, `footprint centred near x=${cx}`);
  assert.ok(Math.abs((top + bottom) / 2 - cy) <= 1, `footprint centred near y=${cy}`);
});

test('drawGodIcon on an unknown pole returns false and draws nothing', () => {
  const { c, calls } = recordCtx();
  const ok = api.drawGodIcon(c, 'nowhere', 100, 60, 4);
  assert.equal(ok, false);
  assert.equal(calls.length, 0);
});

test('godIconSvg has one rect per cell, and is empty for an unknown pole', () => {
  const cells = api.godIconCells('hot');
  const svg = api.godIconSvg('hot', 44, null);
  const rectCount = (svg.match(/<rect /g) || []).length;
  assert.equal(rectCount, cells.length);
  assert.ok(svg.includes('viewBox="0 0 11 11"'));
  assert.ok(svg.includes('shape-rendering="crispEdges"'));
  assert.ok(svg.includes('aria-hidden="true"'));
  assert.equal(api.godIconSvg('nowhere', 44, null), '');
});

test('godIconSvg escapes a label that holds <, and marks the icon as an image', () => {
  const svg = api.godIconSvg('cold', 44, 'a god of <cold>');
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('aria-label="a god of &lt;cold&gt;"'));
  assert.ok(!svg.includes('<cold>'));
});
