// Trace every human death in a run: where they were, what camp, what they were
// trying to do, and their last decision scores.  node tests/trace-deaths.js <seed> [days]
const { runDays, DAY } = require('./lib/run');
const seed = process.argv[2] || 'alpha', days = Number(process.argv[3] || 70);
const traced = new Set();
runDays(seed, days, (api, i, events) => {
  for (let k = events.length - 1; k >= 0 && events[k].tick === api.tick; k--){
    const e = events[k]; if (e.kind !== 'death') continue;
    const who = api.beings.find(b => b.species === 'human' && !b.alive && e.text.startsWith(b.name) && !traced.has(b));
    if (!who) continue; traced.add(who);
    const c = who.camp;
    console.log(api.dayOf(), api.seasonOf(), e.text, '| camp', c && c.name, 'site', c && c.site, 'target', c && c.target, 'pos', who.x, who.y, 'homeless', who.homeless,
      'needs', JSON.stringify(Object.fromEntries(Object.entries(who.needs).map(([k, v]) => [k, Math.round(v)]))),
      'last', JSON.stringify(who.lastChoice && who.lastChoice.opts.slice(0, 4).map(o => (o.label || o.type) + ':' + o.score + (o.failed ? 'x' : ''))),
      'hist', who.history.slice(0, 3).map(h => h.text).join(' / '));
  }
});
console.log(`${traced.size} human deaths in ${days} days of seed ${seed}.`);
