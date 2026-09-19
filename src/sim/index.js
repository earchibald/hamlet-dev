// The simulation core as one script, assembled from the files below.
// The files are plain scripts that share one scope. They are joined in this
// order, and the order matters: core.js declares the constants and state the
// others read at load time. clock.js comes next, because the tables of the
// later files are written in its units. tasks.js declares TASKS before beings.js,
// species.js, and fae.js add their kinds to it, and beings.js declares START before
// species.js and fae.js add their actions to it. Function calls between files are
// free, because function declarations hoist across the joined script.
//
// build.js inlines source() into the page. Tests call load() to run the sim
// in Node, where the same script runs inside one function.
const fs = require('fs');
const path = require('path');

const FILES = ['core', 'clock', 'field', 'marks', 'world', 'path', 'camps', 'tasks', 'beings', 'species', 'fae', 'goals', 'recipes', 'weather', 'gods', 'settle', 'main', 'door'];

function source(){
  return FILES.map(f => fs.readFileSync(path.join(__dirname, f + '.js'), 'utf8')).join('\n');
}

/* The names the tests reach into. State is exposed with getters, because the
   sim reassigns `beings`, `items`, and `camp` as it runs. */
const API = `return {
  startWorld, step, inject, DOOR_ACTS, DOOR_SOURCES, lightTile, poke, pitLit, goalState, GOALS, STAGES, stageReached, log, START, SPECIES, GROUND, ITEMS, LIFE,
  CLOCK, DAY, SEASON_DAYS, TPS, ticks, strides, tickRate, strideRate, secs, mins, hours, days, years, perHour, rollFor,
  seasonOf, dayOf, hourOf, isNight, isWinter, stage, ageDays, mood, threatsFor,
  RECIPES, recipeGoal, placeFor, offersFor, setSite, chooseSite, startPickFibre, startFish, startGather, startBuild, startClearDen, startDeliver, addItem, removeItem, stashAdd,
  TASKS, startTask, setTask, taskStop, goTo,
  runTask, updateBeing, dropCarried, makeBeing, makeCamp, checkPitfall, denTick, gnomeTick, digGnomeBurrow, adoptDen, spawnWildlife, withBrand, failTask, foundingSites, sectorCount, looseCount,
  pathToStop, bfs, reachable, steps, idx, idx3, secOf, secIdx, tileAt, hasTile, placeTile, makeCave, carve, keepsPaths, rimExits, digDens, spawnInDens, faeTick, sectorOfTile, passable, nearestFire, itemAt, growPlants,
  near, nearAt, dist,
  initField, splitRegion, regionById, liveRegions, regionAt, canSplit, neighboursOf, SECTOR_AREA, liveBoundaries,
  CONTRASTS, POLES, mark, marksOf, hasMark, setPole, poleOf, hasPole, BIOME_OF, biomeOf, GROWS, poleShare,
  startCreation, runAges, ageStep, restGate, isStart, isLevel, startCandidates, strain, godOptions, decideGod, godNeeds, settleHome, unmake, GOD_ACTS, GOD_NAMES, EPITHET, BODY, LEAVES, SCAR_OF, MAKES, STRAIN, KINDS, polesThatMake, outgrown, REGIONS_PER_GOD,
  gods, awakeGods, godOf, makeGod, withGodRng, rint,
  settle, beginCreation, paintSectors, paintGround, paintRivers, paintLakes, paintScars, paintHeights, paintDepths, placeFirstPerson, placeFirstPersonAnywhere, uplift, cutWaterCaves, rockfall, BIOMES, FEATURES, paintCreatures, wasMade, placeBodies, tileCheck, setTileCheck, discardSettle, MAX_DISCARDS, placeGrove, spawnAnimal, placeFinds, digGnomeBurrows, godsTick, SPAWN,
  get godRng(){ return godRng; },
  get era(){ return era; }, get age(){ return age; }, get pulseAge(){ return pulseAge; }, get legends(){ return legends; }, get creation(){ return creation; },
  get field(){ return field; }, get boundaries(){ return boundaries; },
  get ZMIN(){ return ZMIN; }, get ZMAX(){ return ZMAX; }, get ZOFF(){ return ZOFF; }, get NZ(){ return NZ; }, get W(){ return W; }, get H(){ return H; },
  get options(){ return options; },
  campHumans, humans, firstPerson, stashFood, hideReserved, bedsFor, beingById, nearFind, addThought,
  get camp(){ return camp; }, set camp(c){ camp = c; },
  get camps(){ return camps; }, get beings(){ return beings; }, get chronicle(){ return chronicle; },
  get items(){ return items; }, get world(){ return world; }, get levels(){ return levels; }, get raised(){ return raised; }, get hills(){ return hills; }, get caves(){ return caves; },
  get sectors(){ return sectors; },
  get tick(){ return tick; }, set tick(v){ tick = v; }, get fireCount(){ return fireCount; }, get weather(){ return weather; },
  get groves(){ return groves; }, get corpses(){ return corpses; }, get seedText(){ return seedText; },
  get goalPriority(){ return goalPriority; },
  get doorLog(){ return doorLog; }, get replay(){ return { ...replayHead, log: doorLog }; },
};`;

function load(){
  return new Function(source() + '\n' + API)();
}

module.exports = { FILES, source, load, API };
