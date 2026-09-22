// The simulation core as one script, assembled from the files below.
// The files are plain scripts that share one scope. They are joined in this
// order, and the order matters: core.js declares the constants and state the
// others read at load time. clock.js comes next, because the tables of the
// later files are written in its units. tasks.js declares TASKS before beings.js,
// species.js, and fae.js add their kinds to it. Function calls between files are
// free, because function declarations hoist across the joined script.
// snapshot.js comes after main.js and before door.js, because the door's load act
// calls it and it reads no other file's tables at load time.
//
// build.js inlines source() into the page. Tests call load() to run the sim
// in Node, where the same script runs inside one function.
const fs = require('fs');
const path = require('path');

const FILES = ['core', 'clock', 'names', 'field', 'marks', 'world', 'path', 'camps', 'tasks', 'beings', 'species', 'fae', 'goals', 'recipes', 'weather', 'gods', 'settle', 'main', 'snapshot', 'door'];

function source(){
  return FILES.map(f => fs.readFileSync(path.join(__dirname, f + '.js'), 'utf8')).join('\n');
}

/* The names the tests reach into. State is exposed with getters, because the
   sim reassigns `beings`, `items`, and `camp` as it runs.

   This whole object is a template literal. So nothing inside it may hold a backtick or a `${`:
   either ends the string, and the parse error is then reported somewhere else entirely, often in
   another file's line. Write comments inside it in plain words, with no code quoting. */
const API = `return {
  /* A template literal: no backticks and no dollar-brace below this line. */
  mulberry32, streamState, setStreamState,
  SNAPSHOT_VERSION, REFS, REF_KINDS, TILE_DEFAULTS, SAVED_STATE, NOT_SAVED, savedValues, takeSnapshot, unnamedRefs, loadSnapshot, checkOptions,
  get lastLoadFault(){ return lastLoadFault; }, get inhabitedTold(){ return inhabitedTold; },
  startWorld, step, inject, DOOR_ACTS, DOOR_SOURCES, lightTile, poke, pitLit, goalState, GOALS, STAGES, stageReached, log, SPECIES, GROUND, ITEMS, LIFE,
  CLOCK, CELLULAR, beats, DAY, SEASONS, SEASON_LENGTHS, YEAR_DAYS, ticks, strides, tickRate, strideRate, lookRate, stock, secs, mins, hours, days, years, perHour, rollFor,
  seasonOf, dayOf, dayOfYear, yearOf, hourOf, isNight, isWinter, stage, ageDays, mood, threatsFor, sourcesNow,
  RECIPES, recipeGoal, placeFor, offersFor, setSite, chooseSite, startClearDen, startDeliver, startFoundCamp, addItem, removeItem, rebuildItemGrid, stashAdd, gardenLives, DIRS,
  TASKS, startTask, setTask, taskStop, goTo, workKind,
  runTask, updateBeing, catchUp, bodyBreak, bodyStretch, nextAct, senseBeings, thoughtAt, die, dropCarried, makeBeing, makeCamp, checkPitfall, denTick, gnomeTick, digGnomeBurrow, adoptDen, spawnWildlife, withBrand, failTask, foundingSites, campSites, CAMPS_APART, sectorCount, looseCount,
  pathToStop, bfs, reachable, steps, idx, idx3, secOf, secIdx, tileAt, hasTile, placeTile, makeCave, carve, keepsPaths, rimExits, digDens, spawnInDens, faeTick, sectorOfTile, passable, nearestFire, itemAt, growPlants,
  near, nearAt, dist,
  seedNames, nameRecord, giveName, nameOf, formerNames, nameTaken, nameRecordOf, nameThings, oldWord, oldName, newOldName, takeMeaning, cap, titleCase, LAND_WORDS, LAND_WORD_KINDS, OLD_FORBID,
  nameTheLand, learnName, learnNamesHere, LORE_BUILT, LORE_TOOK, SKY_MEANINGS, SPRITE_MEANINGS, OLD_CAVE_KINDS,
  loreCandidates, valleyFallbacks, nameThing, rename, candidatesFor, scoreCandidates, namerFor, landWords, axisMult, nameFoundersCamp, nameCampAtHearth, nameVillage, nameTick, CAMP_NAMED_LINES,
  WORD_TAIL, WORD_PHRASE, joinedWord, phraseWord, landRows, landCandidates, workRows,
  EVENT_NAMES, eventCandidates, nameEvents, eventName, isEventLine,
  WORK_WORDS, workWordAt, nameSectorForWork, namePondHere, nameValley, describe, compass, thingSpot, placePhrase, DESCRIBE_KIND,
  DEED_EPITHETS, FATE_EPITHETS, epithetCandidates, epithetPass, giveFate, fullName, lineageFor,
  rebuildNames, get nrng(){ return nrng; }, get tongue(){ return tongue; }, get nameIndex(){ return nameIndex; }, get usedMeanings(){ return usedMeanings; },
  get lore(){ return lore; }, get valley(){ return valley; }, get river(){ return river; }, get stillWater(){ return stillWater; }, get ponds(){ return ponds; }, get fords(){ return fords; },
  initField, splitRegion, regionById, liveRegions, regionAt, canSplit, neighboursOf, SECTOR_AREA, liveBoundaries, heartTile,
  CONTRASTS, POLES, mark, marksOf, hasMark, setPole, poleOf, hasPole, BIOME_OF, biomeOf, GROWS, poleShare,
  startCreation, runAges, ageStep, ageBegin, ageDecide, ageEnd, endAges, settleIfDue, get agePos(){ return agePos; }, get pending(){ return pending; }, get inhabited(){ return inhabited; }, takeTurn, releaseTurn,
  GOD_BARS, barFor, openTurn, get runUntil(){ return runUntil; }, get stops(){ return stops; }, note, restGate, isStart, isLevel, startCandidates, strain, godOptions, decideGod, godNeeds, settleHome, unmake, GOD_ACTS, GOD_NAMES, EPITHET, BODY, LEAVES, SCAR_OF, MAKES, STRAIN, KINDS, polesThatMake, outgrown, REGIONS_PER_GOD,
  gods, awakeGods, godOf, makeGod, withGodRng, rint, sortLine,
  TELL, tell, POLE_WORD, GOD_OF, LACK_WORD, BIOME_PLACE, SCAR_TEXT,
  backstop, ring,
  get gestureFallbacks(){ return gestureFallbacks; },
  settle, beginCreation, paintSectors, paintGround, paintRivers, paintLakes, paintScars, paintHeights, paintDepths, placeFirstPerson, placeFirstPersonAnywhere, uplift, cutWaterCaves, rockfall, BIOMES, FEATURES, paintCreatures, wasMade, placeBodies, tileCheck, setTileCheck, discardSettle, MAX_DISCARDS, placeGrove, spawnAnimal, placeFinds, digGnomeBurrows, godsTick, SPAWN,
  get rng(){ return rng; }, get godRng(){ return godRng; },
  get resCache(){ return resCache; }, get startRegion(){ return startRegion; },
  get era(){ return era; }, get age(){ return age; }, get pulseAge(){ return pulseAge; }, get legends(){ return legends; }, get creation(){ return creation; },
  get field(){ return field; }, get boundaries(){ return boundaries; },
  get ZMIN(){ return ZMIN; }, get ZMAX(){ return ZMAX; }, get ZOFF(){ return ZOFF; }, get NZ(){ return NZ; }, get W(){ return W; }, get H(){ return H; },
  get options(){ return options; },
  campName, campNameOf, campHumans, humans, loneHumans, firstPerson, stashFood, hideReserved, bedsFor, beingById, nearFind, addThought,
  get camp(){ return camp; }, set camp(c){ camp = c; },
  get camps(){ return camps; }, get beings(){ return beings; }, get chronicle(){ return chronicle; },
  /* The chronicle test seam. This object is built inside a template literal, so no backticks here.
     watchChronicle(a) points the sink at an array and answers how many lines were already written,
     so a harness that started late can say so rather than report a short run as a whole one. */
  get chronicleWritten(){ return chronicleWritten; },
  watchChronicle(a){ chronicleSink = a; return chronicleWritten; },
  get items(){ return items; }, get itemGrid(){ return itemGrid; }, get world(){ return world; }, get levels(){ return levels; }, get raised(){ return raised; }, get hills(){ return hills; }, get caves(){ return caves; },
  get sectors(){ return sectors; },
  get tick(){ return tick; }, set tick(v){ tick = v; }, get fireCount(){ return fireCount; }, get weather(){ return weather; },
  get nextId(){ return nextId; }, get doomAt(){ return doomAt; },
  get groves(){ return groves; }, get corpses(){ return corpses; }, get seedText(){ return seedText; },
  get goalPriority(){ return goalPriority; },
  get doorLog(){ return doorLog; }, get replay(){ return { ...replayHead, log: doorLog }; },
};`;

function load(){
  return new Function(source() + '\n' + API)();
}

module.exports = { FILES, source, load, API };
