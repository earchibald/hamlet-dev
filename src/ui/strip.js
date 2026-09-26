/* The strip: clock, season, weather, the camp's name and tabs, four gauges, and alert chips. */
const GAUGE_LABEL = { hearth: 'Hearth', food: 'Food', water: 'Water', beds: 'Beds' };
/* The Grace gauge carries the believers count after its number. Its label is read at call time: some
   tests load this file without state.js, where SKY_TEXT lives. */
function gaugeHTML(id, g){
  if (!g) return '';
  const label = id === 'grace' ? SKY_TEXT.grace : GAUGE_LABEL[id];
  const more = g.believers ? `<span class="believers">${esc(g.believers)}</span>` : '';
  return `<span class="gauge ${g.level}" data-gauge="${id}" title="${label}: ${esc(g.text)}${g.believers ? '. ' + esc(g.believers) + '.' : ''}"><span>${label}</span><span class="bar g-${g.level}"><i style="width:${Math.round(g.v * 100)}%"></i></span><span class="t">${esc(g.text)}</span>${more}</span>`;
}
/* The tool buttons, from toolRows. The miracles print their cost when the world is played. The current
   tool is lit, and its pin shows when Shift made it stick, so a rebuild keeps what setTool showed. */
function toolsHTML(){
  return toolRows().map(t => `<button class="btn${t.on ? ' on' : ''}" data-tool="${t.id}" aria-pressed="${t.on}" title="${esc(t.hint)}">${esc(t.label)}${t.cost === null ? '' : `<span class="cost">${t.cost}</span>`}<kbd>${t.key.toUpperCase()}</kbd><span class="pin"${t.pinned ? '' : ' hidden'}> \u2316</span></button>`).join('');
}
/* Text into markup. It covers the attribute case only because every attribute in src/ui/ is built
   with double quotes, and no single-quoted attribute exists in the tree. The single quote is not
   replaced here. Write an attribute with single quotes and this goes quiet and stops protecting it. */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function chipHTML(a){
  const short = a.text.length > 44 ? a.text.slice(0, 42).replace(/\s+\S*$/, '') + '…' : a.text;
  /* `after` is said after the text and is not part of it, so a chip's mute key, which is its text, holds
     while a prayer's time left counts down. */
  const after = a.after ? ` <span class="left">${esc(a.after)}</span>` : '';
  return `<span class="chip ${a.level}" data-chip="${a.n}" title="${esc(a.text)}${a.after ? ', ' + esc(a.after) : ''}">${a.n <= 9 ? `<kbd>${a.n}</kbd>` : ''}${esc(short)}${after}</span>`;
}
/* The clock runs on every gate tick, not on the view key, so the time never freezes. */
function renderClock(){
  $('clock').textContent = clockText();
  $('season').textContent = seasonLine();
  const w = weather.storm ? (isWinter() ? 'Sleet' : 'Rain') : isNight() ? 'Night' : '';
  $('weather').textContent = w; $('weather').classList.toggle('on', !!weather.storm);
}
function renderStrip(){
  /* The village title is not part of the name, so it is added here, not by the sim. */
  $('campName').textContent = inAges() ? 'The ages' : camp.name + (camp.village ? ', a village' : '');
  $('campName').title = inAges() ? '' : nameTitle(campNames().now);
  setHTML($('camps'), camps.length > 1 ? camps.map((c, i) => `<button class="btn small ${c === viewCamp ? 'on' : ''}" data-camp="${c.id}">${esc(c.name)}<kbd>F${i + 1}</kbd></button>`).join('') : '');
  const g = gauges();
  setHTML($('gauges'), ['grace', 'hearth', 'food', 'water', 'beds'].map(k => gaugeHTML(k, g[k])).join(''));
  setHTML($('chips'), alerts().slice(0, 9).map(chipHTML).join(''));
}
