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

/* A canvas that draws nothing and keeps the list of what it was asked to draw, and the text of every
   fillText/strokeText call, so a test can check that no call draws the star glyph. Copied from
   tests/ui.js's recordCtx. */
function recordDrawCtx(){
  const calls = [];
  const texts = [];
  const note = name => (...a) => { calls.push(name); if (name === 'fillText' || name === 'strokeText') texts.push(String(a[0])); return a; };
  const c = { calls, texts, measureText: () => ({ width: 40 }) };
  for (const k of ['setTransform', 'clearRect', 'fillRect', 'strokeRect', 'drawImage', 'beginPath', 'arc', 'stroke', 'fill', 'save', 'restore', 'translate', 'rotate', 'scale', 'fillText', 'strokeText', 'closePath', 'moveTo', 'lineTo']) c[k] = note(k);
  for (const k of ['fillStyle', 'strokeStyle', 'globalAlpha', 'lineWidth', 'font', 'textAlign', 'textBaseline']) Object.defineProperty(c, k, { set(v){ /* ink is not drawing */ }, get(){ return ''; } });
  return c;
}

test('drawField draws every live god through drawGodIcon, its own pole, and no fillText/strokeText call draws the star', () => {
  /* drawField is compiled into the joined scope with a fixed reference to drawGodIcon. The `spy` extra
     reassigns that same function-scoped variable from outside, which is the joined scope's own back
     door: drawField's call site then resolves to the wrapper, because function declarations in one
     shared scope are ordinary mutable bindings, not frozen at declaration. */
  const rig = loadUI(['state', 'icons', 'derive', 'preview', 'marks', 'map', 'dialogs', 'actions'],
    ['drawField', 'drawGodIcon', 'gods', 'startCreation', 'SPECIES'],
    {
      caption: '() => ""',
      setUp: '(o) => { wctx = o.wctx; ocv = o.ocv; octx = o.octx; dpr = 1; P = o.P; pace = 1; acc = 0; paused = false; ui.playing = false; beatsLastFrame = 1; }',
      spy: '(fn) => { drawGodIcon = fn; }',
    });
  const real = rig.drawGodIcon;
  const godCalls = [];
  rig.spy((ctx, pole, cx, cy, s) => { godCalls.push({ pole, cx, cy, s }); return real(ctx, pole, cx, cy, s); });
  const wctx = recordDrawCtx(), octx = recordDrawCtx();
  const ocv = { width: 100, height: 100, getContext: () => octx };
  const P = {};
  for (const k of ['halo', 'select', 'god', 'sprite', 'void', 'bg', 'map-halo', 'field-line', 'field-scar', 'field-none', 'field-wet', 'field-cold', 'field-dark', 'field-light', 'field-above', 'field-below', 'field-hot', 'field-dry', 'field-still', 'field-moving']) P[k] = '#808080';
  global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => recordDrawCtx() }), querySelector: () => null };
  global.Path2D = function(d){ this.d = d; };
  rig.startCreation('gamma');
  for (let k = 0; k < 3 && rig.era === 'gods'; k++) rig.step();
  rig.setUp({ wctx, ocv, octx, P });
  rig.drawField();
  const visible = rig.gods().filter(g => g.status !== 'dead');
  assert.ok(visible.length > 0, 'the creation has at least one live god to place');
  assert.equal(godCalls.length, visible.length, 'drawGodIcon is called once per god drawField places');
  const poles = godCalls.map(c => c.pole).sort();
  assert.deepEqual(poles, visible.map(g => g.pole).sort(), 'each call carries its own god\'s pole');
  assert.ok(!wctx.texts.includes(rig.SPECIES.god.glyph), 'no fillText or strokeText call draws the star glyph');
});

test('two gods placed on the same spot are nudged apart by at least their names\' own width, not just the icon\'s', () => {
  const rig = loadUI(['state', 'icons', 'derive', 'preview', 'marks', 'map', 'dialogs', 'actions'],
    ['drawField', 'drawGodIcon', 'gods', 'startCreation'],
    {
      caption: '() => ""',
      setUp: '(o) => { wctx = o.wctx; ocv = o.ocv; octx = o.octx; dpr = 1; P = o.P; pace = 1; acc = 0; paused = false; ui.playing = false; beatsLastFrame = 1; }',
      spy: '(fn) => { drawGodIcon = fn; }',
    });
  const real = rig.drawGodIcon;
  const godCalls = [];
  rig.spy((ctx, pole, cx, cy, s) => { godCalls.push({ pole, cx, cy, s }); return real(ctx, pole, cx, cy, s); });
  const wctx = recordDrawCtx(), octx = recordDrawCtx();
  const ocv = { width: 100, height: 100, getContext: () => octx };
  const P = {};
  for (const k of ['halo', 'select', 'god', 'sprite', 'void', 'bg', 'map-halo', 'field-line', 'field-scar', 'field-none', 'field-wet', 'field-cold', 'field-dark', 'field-light', 'field-above', 'field-below', 'field-hot', 'field-dry', 'field-still', 'field-moving']) P[k] = '#808080';
  global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => recordDrawCtx() }), querySelector: () => null };
  global.Path2D = function(d){ this.d = d; };
  rig.startCreation('gamma');
  for (let k = 0; k < 3 && rig.era === 'gods'; k++) rig.step();
  const visible = rig.gods().filter(g => g.status !== 'dead');
  assert.ok(visible.length >= 2, 'the creation has at least two live gods to place');
  /* Put the first two live gods on the exact same tile, so drawField's nudge is the only thing that
     can separate their centres. recordDrawCtx's measureText stub gives every name a width of 40, so
     the expected gap is Math.max(22, (40+40)/2) + 4 = 44. */
  const [a, b] = visible;
  a.at = 500; b.at = 500;
  rig.setUp({ wctx, ocv, octx, P });
  rig.drawField();
  const ca = godCalls.find(c => c.pole === a.pole);
  const cb = godCalls.find(c => c.pole === b.pole);
  assert.ok(ca && cb, 'both nudged gods were drawn');
  const wantDist = Math.max(22, (40 + 40) / 2) + 4;
  assert.ok(Math.abs(ca.cx - cb.cx) >= wantDist, `centres are at least ${wantDist}px apart on x (got ${Math.abs(ca.cx - cb.cx)})`);
});

/* ---- task 3: the icon in the page ---- */

test('inspectGod holds the god\'s own icon markup at 22 px, decoration only, no label', () => {
  const rig = loadUI(['state', 'icons', 'derive', 'marks', 'map', 'inspect'], ['inspectGod', 'gods', 'startCreation', 'step', 'godIconSvg']);
  rig.startCreation('gamma');
  for (let k = 0; k < 6 && rig.era === 'gods'; k++) rig.step();
  const g = rig.gods()[0];
  const html = rig.inspectGod(g);
  assert.ok(html.includes(rig.godIconSvg(g.pole, 22, null)), 'the card holds the 22px icon for the god\'s own pole');
});

test('winTitle holds the god\'s own icon markup at 16 px for a god window, and none for a tile window', () => {
  const rig = loadUI(['state', 'icons', 'derive', 'marks', 'map', 'inspect', 'strip', 'windows'],
    ['winTitle', 'gods', 'startCreation', 'step', 'godIconSvg']);
  rig.startCreation('gamma');
  for (let k = 0; k < 6 && rig.era === 'gods'; k++) rig.step();
  const g = rig.gods()[0];
  const title = rig.winTitle({ kind: 'inspect', target: { being: g.id } });
  assert.ok(title.includes(rig.godIconSvg(g.pole, 16, null)), 'the window title holds the 16px icon for the god\'s own pole');
});

test('renderPeople holds the god\'s own icon markup at 14 px for a god row', () => {
  const rig = loadUI(['state', 'icons', 'derive', 'marks', 'map', 'inspect', 'strip', 'actions', 'panels'],
    ['gods', 'startCreation', 'step', 'renderPeople', 'godIconSvg']);
  rig.startCreation('gamma');
  for (let k = 0; k < 6 && rig.era === 'gods'; k++) rig.step();
  const g = rig.gods()[0];
  global.document = { getElementById: () => null };
  const el = { innerHTML: '' };
  try { rig.renderPeople(el); } finally { delete global.document; }
  assert.ok(el.innerHTML.includes(rig.godIconSvg(g.pole, 14, null)), 'a god row holds the 14px icon for its own pole');
});

test('timelineModel names the pole on an unfolded row for a single god, and not on the folded or gate rows', () => {
  const rig = loadUI(['state', 'derive'], ['timelineModel', 'gods', 'startCreation', 'step', 'ui']);
  rig.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) rig.step();
  const folded = rig.timelineModel();
  assert.equal(folded.rows[0].pole, undefined, 'the folded row names no single god');
  rig.ui.timelineFold = false;
  const m = rig.timelineModel();
  const gate = m.rows.find(r => r.id === 'gate');
  assert.equal(gate.pole, undefined, 'the gate row names no god');
  const godIds = rig.gods().map(g => g.id);
  for (const r of m.rows.filter(r => r.id !== 'gate')){
    const g = rig.gods().find(x => x.id === r.id);
    assert.equal(r.pole, g.pole, `row ${r.id} names its own god's pole`);
  }
  assert.ok(godIds.length > 0);
});

test('drawTimeline puts a 14 px icon inside the .who span, before the label, for a single-god row, and none for the folded or gate rows; every lane\'s first child is the who span so the cells line up', () => {
  const rig = loadUI(['state', 'icons', 'derive', 'marks', 'timeline'], ['drawTimeline', 'gods', 'startCreation', 'step', 'ui', 'godIconSvg']);
  rig.startCreation('gamma', {});
  for (let n = 0; n < 8; n++) rig.step();
  rig.ui.timelineFold = false;
  const root = fakeEl('div');
  global.document = { getElementById: id => id === 'timeline' ? root : null, createElement: tag => fakeEl(tag) };
  try { rig.drawTimeline(); } finally { delete global.document; }
  const lanes = root.children.filter(c => c.className.split(' ').includes('lane'));
  assert.ok(lanes.length > 1, 'more than one lane: at least one god and the gate');
  for (const lane of lanes){
    /* Every lane's direct children before the first cell must be exactly the who span. A sibling
       icon ahead of, or beside, who would widen only the god lanes and knock the columns out of
       line with the gate lane, which has no icon. */
    const firstCellIdx = lane.children.findIndex(c => c.className.split(' ').includes('cell'));
    const preCell = lane.children.slice(0, firstCellIdx);
    assert.deepEqual(preCell.map(c => c.className), ['who'], `${JSON.stringify(preCell.map(c => c.className))}: lane's children before the first cell are exactly the who span`);
    const who = lane.children[0];
    assert.equal(who.className, 'who', 'the who span is the lane\'s first child');
    const icon = who.children.find(c => c.tag === 'img');
    const rowId = who.textContent;
    const isGate = rowId === 'The gate';
    const g = rig.gods().find(x => x.name === rowId);
    if (g){
      assert.ok(icon, `${rowId}'s who span holds an icon before its label`);
      assert.equal(who.children[0], icon, 'the icon is the first child of who, ahead of the label text');
      assert.equal(icon.tag, 'img', 'the timeline icon is an img element');
      assert.equal(icon.alt, '', 'the timeline icon has an empty alt');
      assert.equal(icon.src, 'data:image/svg+xml,' + encodeURIComponent(rig.godIconSvg(g.pole, 14, null)));
    } else {
      assert.ok(isGate, `an icon-less lane is the gate, not ${rowId}`);
      assert.equal(icon, undefined, 'the gate row\'s who span holds no icon');
    }
  }
});

test('setActCaption writes the page again when only the pole changes, and skips the write for a repeat of the same text and pole', () => {
  /* A getter/setter pair on innerHTML, with a count of the setter's own calls, so the test can tell a
     skipped write (the de-duplication guard) from one that reruns and happens to produce the same
     markup. assert.equal(el.innerHTML, el.innerHTML) can never fail: it compares a value to itself. */
  let html = '', writes = 0;
  const el = { hidden: true, get innerHTML(){ return html; }, set innerHTML(v){ html = v; writes++; } };
  const rig = loadUI(['state', 'icons', 'derive', 'keys', 'strip', 'actions', 'panels'], ['setActCaption', 'godIconSvg', 'startWorld']);
  rig.startWorld('r');
  global.document = { getElementById: id => id === 'actCaption' ? el : { innerHTML: '' } };
  try {
    rig.setActCaption('A god acts.', 'hot');
    assert.equal(writes, 1, 'the first call writes the page once');
    assert.ok(el.innerHTML.includes(rig.godIconSvg('hot', 16, null)), 'the hot icon is written');
    assert.ok(el.innerHTML.endsWith('A god acts.'), 'the caption text follows the icon');
    rig.setActCaption('A god acts.', 'cold');
    assert.equal(writes, 2, 'a new pole with the same text writes the page again');
    assert.ok(el.innerHTML.includes(rig.godIconSvg('cold', 16, null)), 'the cold icon is written');
    assert.ok(!el.innerHTML.includes(rig.godIconSvg('hot', 16, null)), 'the old icon is gone');
    assert.ok(el.innerHTML.endsWith('A god acts.'), 'the caption text is unchanged');
    rig.setActCaption('A god acts.', 'cold');
    assert.equal(writes, 2, 'the same text and pole a second time writes nothing new');
  } finally { delete global.document; }
});

/* A small fake DOM element for drawTimeline: real children, a real classList, so a test can walk the
   tree it built. document.createElement returns a fresh one of these; #timeline itself is one too. */
function fakeEl(tag){
  const el = { tag, className: '', children: [], dataset: {}, _text: '',
    classList: { toggle(c, on){ const has = el.className.split(' ').includes(c); const want = on === undefined ? !has : on;
      el.className = el.className.split(' ').filter(x => x && x !== c).concat(want ? [c] : []).join(' '); } },
    appendChild(c){ el.children.push(c); return c; },
    /* `who.append(icon, r.label)` mixes an element with a plain string: wrap the string as a text
       node, the way a real DOM does, so `who.textContent` can still read the label back. */
    append(...cs){ el.children.push(...cs.map(c => typeof c === 'string' ? { tag: '#text', textContent: c } : c)); },
    replaceChildren(){ el.children = []; },
    get textContent(){ return el.children.length ? el.children.map(c => c.textContent || '').join('') : el._text; },
    set textContent(v){ el._text = v; el.children = []; },
  };
  return el;
}
