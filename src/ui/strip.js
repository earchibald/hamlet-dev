/* The strip: clock, season, weather, the camp's name and tabs, four gauges, and alert chips. */
const GAUGE_LABEL = { hearth: 'Hearth', food: 'Food', water: 'Water', beds: 'Beds' };
function gaugeHTML(id, g){
  if (!g) return '';
  return `<span class="gauge ${g.level}" title="${GAUGE_LABEL[id]}: ${g.text}"><span>${GAUGE_LABEL[id]}</span><span class="bar g-${g.level}"><i style="width:${Math.round(g.v * 100)}%"></i></span><span class="t">${g.text}</span></span>`;
}
function chipHTML(a){
  return `<span class="chip ${a.level}" data-chip="${a.n}" title="${a.type}">${a.n <= 9 ? `<kbd>${a.n}</kbd>` : ''}${a.text}</span>`;
}
function renderStrip(){
  $('clock').textContent = stamp();
  $('season').textContent = seasonLine();
  const w = weather.storm ? (isWinter() ? 'Sleet' : 'Rain') : isNight() ? 'Night' : '';
  $('weather').textContent = w; $('weather').classList.toggle('on', !!weather.storm);
  $('campName').textContent = camp.name + (camp.village ? ', a village' : '');
  $('camps').innerHTML = camps.length > 1 ? camps.map((c, i) => `<button class="btn small ${c === viewCamp ? 'on' : ''}" data-camp="${c.id}">${c.name}<kbd>F${i + 1}</kbd></button>`).join('') : '';
  const g = gauges();
  $('gauges').innerHTML = ['hearth', 'food', 'water', 'beds'].map(k => gaugeHTML(k, g[k])).join('');
  $('chips').innerHTML = alerts().map(chipHTML).join('');
}
