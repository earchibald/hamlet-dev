// Shared test runner. Loads the sim in Node, runs it for a number of days
// with a script god, and keeps every chronicle line, not only the last 300.
const { load } = require('../../src/sim');
const DAY = 1000;

/* The script god lights each camp's pit once, the first time it stands laid
   and cold. A founding party carries coals, so its pit is lit on its own; the
   god steps in only after the coals value (a tick) has passed. The loop index
   is compared, as the first soak did, so old numbers still line up. */
function scriptGod(api, i){
  for (const c of api.camps) if (c.pit && !c.everLit && c.coals <= i) api.lightTile(...c.pit);
}

/* Run one seed. Returns the api and the full list of chronicle events in order. */
function runDays(seed, days, onTick){
  const api = load(); api.startWorld(seed);
  const events = []; const seen = new WeakSet();
  const drain = () => { const ch = api.chronicle; let n = 0; while (n < ch.length && !seen.has(ch[n])) n++; for (let j = n - 1; j >= 0; j--){ seen.add(ch[j]); events.push(ch[j]); } };
  drain();
  for (let i = 0; i < days * DAY; i++){
    api.step(); scriptGod(api, i); drain();
    if (onTick) onTick(api, i, events);
  }
  return { api, events };
}

const OLD_AGE = /died of old age|old and warm/;
const DEN_DEATH = /was killed in a den by/;
const deaths = events => events.filter(e => e.kind === 'death');
const oddDeaths = events => deaths(events).filter(e => !OLD_AGE.test(e.text) && !DEN_DEATH.test(e.text)).map(e => e.text);
const denDeaths = events => deaths(events).filter(e => DEN_DEATH.test(e.text)).map(e => e.text);

/* The numbers the soak watches. Same names as the first soak script. */
function countEvents(api, events){
  const ev = k => events.filter(e => e.text.includes(k)).length;
  const alive = sp => api.beings.filter(b => b.alive && b.species === sp).length;
  const hs = api.beings.filter(b => b.species === 'human');
  const byCause = {}; for (const e of deaths(events)){ const k = e.text.replace(/^\w+ /, '').replace(/\.$/, ''); byCause[k] = (byCause[k] || 0) + 1; }
  return {
    storms: ev('storm rolls') + ev('Sleet'), strikes: ev('Lightning strikes'), embers: ev('sets the ember'), sparks: ev('coaxes a spark'),
    wolfRaids: ev('wolf slips'), mauled: ev('mauls'), drivenOff: ev('chases the wolf'),
    seen: api.camps.filter(c => c.fae.known).length, favor: api.camps.map(c => c.fae.favor), gifts: ev('are gone by morning'),
    moss: ev('glowing moss lies') + ev('blows. The fire'), pranks: ev('tiny footprints') + ev('pinch marks') + ev('pinched out'),
    stolen: ev('is gone from the stash'), cordGifts: ev('coil of cord lies'),
    fights: ev('spears a sprite') + ev('flees') + ev('turns and fights'), sprites: alive('sprite'), stones: api.camps.filter(c => c.stone).length,
    wards: api.camps.filter(c => c.ward).length, groveAnger: api.groves.map(g => g.anger),
    born: ev(' is born to '), oldAge: ev('old age') + ev('old and warm'), taught: ev('learned '),
    huts: api.camps.reduce((n, c) => n + c.huts.length, 0), storehouses: api.camps.filter(c => c.storehouse).length, villages: api.camps.filter(c => c.village).length,
    deerSpeared: ev('brings down a deer'), deerByWolves: ev('was caught by a wolf'), deer: alive('deer'), wolves: alive('wolf'), rabbits: alive('rabbit'),
    spoiled: ev('gone off'), caught: ev('caught in a snare'), fished: api.camps.reduce((n, c) => n + (c.fished || 0), 0), froze: ev('froze'),
    pitted: ev('falls into the pit'),
    workshops: api.camps.filter(c => c.workshop).length, kilns: api.camps.filter(c => c.kiln).length, gardens: api.camps.filter(c => c.garden).length,
    baskets: api.camps.filter(c => c.tools.basket).length, rods: api.camps.filter(c => c.tools.rod).length,
    clothed: api.beings.filter(b => b.alive && b.species === 'human' && b.clothes).length,
    pots: api.camps.reduce((n, c) => n + (c.stash.pot || 0), 0), quarried: ev('quarries two rocks'),
    pups: ev('is born in the den') + ev('kits are born'), dragged: ev('drags its kill'),
    deaths: byCause, alive: hs.filter(h => h.alive).length, humans: hs.length, camps: api.camps.length,
    gnomesSeen: api.camps.filter(c => c.gnomes.known).length, gnomes: api.beings.filter(b => b.alive && b.species === 'gnome').length,
  };
}

function fnv(s){ let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
/* A short record of the whole run. If any rule changes, this changes. */
function fingerprint(api, events){
  return {
    tick: api.tick, chronicleLines: events.length,
    chronicle: fnv(events.map(e => `${e.tick}|${e.kind}|${e.text}`).join('\n')),
    beings: fnv(api.beings.map(b => `${b.id}|${b.species}|${b.alive ? 1 : 0}|${b.x},${b.y},${b.z}|${b.camp ? b.camp.id : ''}`).join('\n')),
    items: fnv(api.items.map(i => `${i.id}|${i.kind}|${i.x},${i.y},${i.z}`).join('\n')),
  };
}

/* Living humans who cannot walk to their camp's stash. Checked once a day by the soak:
   one full-map search per camp. A person who is cut off starves or dies of thirst in a pocket. */
function cutOff(api){
  const out = [];
  for (const c of api.camps){
    if (!c.stashTile) continue;
    const region = api.reachable(c.stashTile[0], c.stashTile[1], 0, api.levels.length * api.world.length);
    for (const h of api.beings) if (h.alive && h.species === 'human' && h.camp === c && !region.has(api.idx3(h.x, h.y, h.z))) out.push(`${h.name} at ${h.x},${h.y},${h.z} on day ${api.dayOf()}, ${api.seasonOf()}, cut off from ${c.name}`);
  }
  return out;
}

const campLine = (api, c) => `${c.name}: site ${!!c.site} pit ${!!c.pit} lit ${c.everLit} members ${api.beings.filter(h => h.species === 'human' && h.alive && h.camp === c).length} food ${c.stash.berries + c.stash.cooked + c.stash.smoked}`;

module.exports = { DAY, runDays, scriptGod, countEvents, fingerprint, deaths, oddDeaths, denDeaths, cutOff, campLine, OLD_AGE };
