/* The zoom: a camera that moves between two views, drawn on its own canvas. The settle uses it to go from the
   gods' map to the first person's sector, and any later caller can give it other stops. The functions at the
   top are pure and run in Node under tests/zoom.js. The drawing below them reads `zoom`, which only
   actions.js writes. */

/* The zoom's durations, in milliseconds of wall time. They are view durations and stay out of src/sim/.
   fade is the cross-fade from the gods' map to the world map, hold is the pause at each stop, and the two
   zoom legs are named by the view they arrive at. */
const ZOOM = { fade: 1000, hold: 350, mid: 1600, loc: 1100 };

/* The tiles a view shows, in world tiles: { x, y, w, h }. `s` is the sector the view is on. */
function viewFrame(v, s){
  if (v === 'mid') return { x: (s.sx - 1) * LW, y: (s.sy - 1) * LH, w: 3 * LW, h: 3 * LH };
  if (v === 'loc') return { x: s.sx * LW, y: s.sy * LH, w: LW, h: LH };
  return { x: 0, y: 0, w: W, h: H };
}
const zoomEase = f => f * f * (3 - 2 * f);
const lerp = (a, b, f) => a + (b - a) * f;
/* The camera at fraction f of a leg from frame a to frame b. The box, in CSS pixels, moves in a straight
   line from boxA to boxB. The camera's width moves geometrically, so each moment of the zoom multiplies the
   scale by the same amount. Its height follows the box's aspect, so the picture never stretches. The centre
   moves in step with the zoom, so the frame being arrived at grows steadily on screen. */
function zoomCamera(a, b, boxA, boxB, f){
  const e = zoomEase(clamp(f, 0, 1));
  const box = { w: lerp(boxA.w, boxB.w, e), h: lerp(boxA.h, boxB.h, e) };
  const w = Math.pow(a.w, 1 - e) * Math.pow(b.w, e), h = w * box.h / box.w;
  const p = a.w === b.w ? e : (a.w - w) / (a.w - b.w);
  const cx = lerp(a.x + a.w / 2, b.x + b.w / 2, p), cy = lerp(a.y + a.h / 2, b.y + b.h / 2, p);
  return { box, cam: { x: cx - w / 2, y: cy - h / 2, w, h } };
}
/* Where a frame lands in the box, in CSS pixels, when the camera shows `cam`. */
function frameInBox(frame, cam, box){
  const k = box.w / cam.w;
  return { x: (frame.x - cam.x) * k, y: (frame.y - cam.y) * k, w: frame.w * k, h: frame.h * k };
}
/* The legs between a list of stops. A stop is { view, s, image }: the view, its sector, and the key of the
   picture it shows. Two stops of the same view make a fade; two views make a zoom. A hold sits between two
   legs. Each leg keeps the stops' indexes, so the drawing finds their pictures. */
function zoomPlan(stops){
  const legs = [];
  for (let i = 1; i < stops.length; i++){
    if (legs.length) legs.push({ kind: 'hold', from: i - 1, to: i - 1, ms: ZOOM.hold });
    const same = stops[i].view === stops[i - 1].view;
    legs.push({ kind: same ? 'fade' : 'zoom', from: i - 1, to: i, ms: same ? ZOOM.fade : ZOOM[stops[i].view] });
  }
  return legs;
}
/* The leg that runs t ms into a plan, and the fraction of it that has run. Null once the plan is over. */
function zoomAt(legs, t){
  let start = 0;
  for (let i = 0; i < legs.length; i++){
    if (t < start + legs[i].ms) return { i, f: (t - start) / legs[i].ms };
    start += legs[i].ms;
  }
  return null;
}
const zoomLength = legs => legs.reduce((n, l) => n + l.ms, 0);
/* How strongly each stop's picture shows at fraction f of a leg. A fade crosses the whole leg. In a zoom the
   picture left behind goes in the first part, and the picture arrived at comes in the last half, so the
   middle of the flight shows only the world's own ground. A hold shows its one stop. */
function legAlphas(leg, f){
  const e = zoomEase(clamp(f, 0, 1));
  if (leg.kind === 'hold') return { from: 1, to: 0 };
  if (leg.kind === 'fade') return { from: 1, to: e };
  return { from: 1 - clamp(f / 0.4, 0, 1), to: zoomEase(clamp((f - 0.5) / 0.5, 0, 1)) };
}
/* The settle's stops: the finished gods' map, the world map, the nine sectors around the first person, and
   that person's sector. A settle with no one in it ends on the world map. */
function settleStops(s){
  const stops = [{ view: 'world', image: 'field' }, { view: 'world', image: 'world' }];
  if (s) stops.push({ view: 'mid', s, image: 'mid' }, { view: 'loc', s, image: 'loc' });
  return stops;
}
