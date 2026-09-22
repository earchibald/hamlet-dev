/* The ten gods' icons. A god's kind is its pole (src/sim/marks.js), never its name. Pixel art, drawn
   at integer coordinates so the edges stay sharp at 1x and 2x. The colours are fixed in both themes;
   the outline (GOD_OUTLINE) is what keeps an icon readable on any field colour. */
const GOD_OUTLINE = '#15171c';
const GOD_ICONS = {
  above:  { pal: ['#dfe6d2', '#8fa37c', '#4f5f45'], art: ['....a....', '...aab...', '...abb...', '..aabbc..', '..abbbc..', '.aabbbcc.', '.abbbbcc.', 'aabbbbbcc', 'abbbbbbcc'] },
  below:  { pal: ['#b9a7d6', '#6a5690', '#30264a'], art: ['abbbbbbbc', '.abbbbbc.', '.abbbbbc.', '..abbbc..', '..abbbc..', '...abc...', '...abc...', '....b....', '....c....'] },
  wet:    { pal: ['#cfe8ff', '#5d9fdc', '#2a5a94'], art: ['....a....', '....a....', '...aab...', '...abb...', '..aabbc..', '..abbbc..', '..abbbc..', '...bbc...', '.........'] },
  dry:    { pal: ['#f1e2b3', '#c9a963', '#866a33'], art: ['.........', '......a..', '.....aaa.', '..a...a..', '.aaab....', 'aabbbbaaa', 'bbbbbbbbb', 'bcbbcbbcb', 'ccccccccc'] },
  hot:    { pal: ['#ffe08a', '#f08a2c', '#a5361b'], art: ['....b....', '...bb....', '...bbb...', '..babb.b.', '.bbabbbb.', '.baaabbc.', '.baaaabc.', '..baabc..', '...ccc...'] },
  cold:   { pal: ['#ffffff', '#a9d8ee', '#5b8fae'], art: ['....a....', '.b..a..b.', '..b.a.b..', '...bab...', 'aaaacaaaa', '...bab...', '..b.a.b..', '.b..a..b.', '....a....'] },
  still:  { pal: ['#c6f0e6', '#4fae9d', '#23645b'], art: ['.........', '.........', '..aaaaa..', '.abbbbbc.', 'abbaabbbc', '.abbbbbc.', '..ccccc..', '.........', '.........'] },
  moving: { pal: ['#ffffff', '#c9d3dc', '#7d8b98'], art: ['.........', '..aaaa...', '......ab.', 'aaaaaaab.', '.........', 'bbbbbbbc.', '.......c.', '....ccc..', '.........'] },
  light:  { pal: ['#fffbe0', '#f4d35e', '#c99a1e'], art: ['....b....', '.b.....b.', '...aaa...', '..aaabb..', 'b.aabbc.b', '..abbbc..', '...bcc...', '.b.....b.', '....b....'] },
  dark:   { pal: ['#9a938a', '#57514a', '#0b0a0d'], art: ['.........', '..aaaaa..', '.abbbbbb.', 'abbcccbbb', 'abcccccbb', 'abcccccbb', 'abcccccbb', 'abcccccbb', '.........'] },
};
/* godIconCells(pole) is read on every draw and every card, so its raster is worked out once per pole
   and kept here. An 11 by 11 grid: the 9 by 9 art sits at offset 1,1, with a one-cell margin all round
   for the outline to stand in. */
const godIconCache = {};
function godIconCells(pole){
  if (!GOD_ICONS[pole]) return null;
  if (godIconCache[pole]) return godIconCache[pole];
  const { pal, art } = GOD_ICONS[pole];
  const shade = { a: pal[0], b: pal[1], c: pal[2] };
  const filled = (x, y) => x >= 1 && x <= 9 && y >= 1 && y <= 9 ? art[y - 1][x - 1] : '.';
  const cells = [];
  for (let y = 0; y <= 10; y++) for (let x = 0; x <= 10; x++){
    const ch = filled(x, y);
    if (ch !== '.'){ cells.push({ x, y, fill: shade[ch] }); continue; }
    const touches = filled(x - 1, y) !== '.' || filled(x + 1, y) !== '.' || filled(x, y - 1) !== '.' || filled(x, y + 1) !== '.';
    if (touches) cells.push({ x, y, fill: GOD_OUTLINE });
  }
  godIconCache[pole] = cells;
  return cells;
}
/* Draws the icon centred on cx,cy at s screen pixels per art pixel. Each cell's screen box is rounded
   at both edges, not rounded once and stretched by s, so the tiles tile with no seam and no overlap
   even when s is not a whole number. Returns false and draws nothing for an unknown pole, so the
   caller falls back to the star (SPECIES.god.glyph). */
function drawGodIcon(ctx, pole, cx, cy, s){
  const cells = godIconCells(pole);
  if (!cells) return false;
  const ox = cx - 11 * s / 2, oy = cy - 11 * s / 2;
  for (const cell of cells){
    const x0 = Math.round(ox + cell.x * s), x1 = Math.round(ox + (cell.x + 1) * s);
    const y0 = Math.round(oy + cell.y * s), y1 = Math.round(oy + (cell.y + 1) * s);
    ctx.fillStyle = cell.fill;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  return true;
}
/* An SVG version of the same icon, for the page chrome rather than the canvas. With a label it reads
   as an image to a screen reader; without one it is decoration and stays out of the reading order. */
function godIconSvg(pole, size, label){
  const cells = godIconCells(pole);
  if (!cells) return '';
  const rects = cells.map(c => `<rect x="${c.x}" y="${c.y}" width="1" height="1" fill="${c.fill}"/>`).join('');
  const role = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 11 11" shape-rendering="crispEdges" ${role}>${rects}</svg>`;
}
