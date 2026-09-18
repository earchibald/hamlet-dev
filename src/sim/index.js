// The simulation core as one script, assembled from the files below.
// The files are plain scripts that share one scope. They are joined in this
// order, and the order matters: core.js declares the constants and state the
// others read at load time, and beings.js declares START before species.js
// and fae.js add their actions to it. Function calls between files are free,
// because function declarations hoist across the joined script.
//
// build.js inlines source() into the page. Tests call load() to run the sim
// in Node, where the same script runs inside one function.
const fs = require('fs');
const path = require('path');

const FILES = ['core', 'world', 'path', 'camps', 'beings', 'species', 'fae', 'tasks', 'goals', 'recipes', 'weather', 'main'];

function source(){
  return FILES.map(f => fs.readFileSync(path.join(__dirname, f + '.js'), 'utf8')).join('\n');
}

/* The names the tests reach into. State is exposed with getters, because the
   sim reassigns `beings`, `items`, and `camp` as it runs. */
const API = `return {
  startWorld, step, lightTile, poke, pitLit, goalState, GOALS, START, SPECIES, GROUND, ITEMS, LIFE,
  seasonOf, dayOf, hourOf, isNight, isWinter, stage, ageDays, mood, threatsFor,
  RECIPES, recipeGoal, placeFor, offersFor, setSite, startPickFibre, startFish, startGather, startBuild, addItem, removeItem, stashAdd,
  runTask, updateBeing, dropCarried, makeBeing, checkPitfall, denTick,
  legPath, bfs, reachable, steps, idx, idx3, secOf, secIdx, tileAt, hasTile, placeTile, makeCave, carve, keepsPaths, rimExits, digDens, spawnInDens, faeTick, sectorOfTile, passable, nearestFire, itemAt, growPlants,
  near, nearAt, dist, ZMIN, ZMAX, ZOFF, NZ, W, H,
  campHumans, humans, stashFood,
  get camp(){ return camp; }, set camp(c){ camp = c; },
  get camps(){ return camps; }, get beings(){ return beings; }, get chronicle(){ return chronicle; },
  get items(){ return items; }, get world(){ return world; }, get levels(){ return levels; }, get raised(){ return raised; }, get hills(){ return hills; }, get caves(){ return caves; },
  get sectors(){ return sectors; },
  get tick(){ return tick; }, set tick(v){ tick = v; }, get fireCount(){ return fireCount; }, get weather(){ return weather; },
  get groves(){ return groves; }, get corpses(){ return corpses; }, get seedText(){ return seedText; },
  get goalPriority(){ return goalPriority; },
};`;

function load(){
  return new Function(source() + '\n' + API)();
}

module.exports = { FILES, source, load };
