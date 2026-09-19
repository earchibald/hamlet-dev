/* The strip: clock, season, weather, the camp's name and tabs, four gauges, and alert chips. */
const GAUGE_LABEL = { hearth: 'Hearth', food: 'Food', water: 'Water', beds: 'Beds' };
function gaugeHTML(id, g){
  if (!g) return '';
  return `<span class="gauge ${g.level}" title="${GAUGE_LABEL[id]}: ${esc(g.text)}"><span>${GAUGE_LABEL[id]}</span><span class="bar g-${g.level}"><i style="width:${Math.round(g.v * 100)}%"></i></span><span class="t">${esc(g.text)}</span></span>`;
}
/* Text into markup. It covers the attribute case only because every attribute in src/ui/ is built
   with double quotes, and no single-quoted attribute exists in the tree. The single quote is not
   replaced here. Write an attribute with single quotes and this goes quiet and stops protecting it. */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function chipHTML(a){
  const short = a.text.length > 44 ? a.text.slice(0, 42).replace(/\s+\S*$/, '') + '…' : a.text;
  return `<span class="chip ${a.level}" data-chip="${a.n}" title="${esc(a.text)}">${a.n <= 9 ? `<kbd>${a.n}</kbd>` : ''}${esc(short)}</span>`;
}
/* The clock runs on every gate tick, not on the view key, so the time never freezes. */
function renderClock(){
  $('clock').textContent = stamp();
  $('season').textContent = seasonLine();
  const w = weather.storm ? (isWinter() ? 'Sleet' : 'Rain') : isNight() ? 'Night' : '';
  $('weather').textContent = w; $('weather').classList.toggle('on', !!weather.storm);
}
function renderStrip(){
  /* The village title is not part of the name, so it is added here, not by the sim. */
  $('campName').textContent = inAges() ? 'The ages' : camp.name + (camp.village ? ', a village' : '');
  $('campName').title = inAges() ? '' : nameTitle(campNames().now);
  $('camps').innerHTML = camps.length > 1 ? camps.map((c, i) => `<button class="btn small ${c === viewCamp ? 'on' : ''}" data-camp="${c.id}">${esc(c.name)}<kbd>F${i + 1}</kbd></button>`).join('') : '';
  const g = gauges();
  $('gauges').innerHTML = ['hearth', 'food', 'water', 'beds'].map(k => gaugeHTML(k, g[k])).join('');
  $('chips').innerHTML = alerts().slice(0, 9).map(chipHTML).join('');
}
