// A fixture, not a file of the game. It exists only so tests/types.js can prove that
// removing the catch-all index signatures from types/sim/records.d.ts really does make
// tsc catch a misspelt field. It is never joined into the built page: build.js reads only
// src/sim/*.js and src/ui/*.js, and this file lives under types/, outside both.
//
// tsconfig.probe.json checks this file together with src/sim/, so makeBeing() and
// makeTile() resolve the same way they do at runtime. Both marked lines below must fail
// with TS2339, "Property '...' does not exist". If either one stops failing, an index
// signature has crept back in, or a real field of that name was added, and the probe
// test in tests/types.js goes red to say so.
//
// makeTile(), not tileAt(), gives the probe a value tsc actually treats as Tile: tileAt()
// reads it back off `levels`, an array the sim never annotates, so tsc would type that
// read as `any` and the probe would pass for the wrong reason.
const probeBeing = makeBeing('human', 0, 0, null, 0);
const misspelledBeingField = probeBeing.hungerr; // PROBE: expect TS2339 here

const probeTile = makeTile(1, 2, 0, 'grass');
const misspelledTileField = probeTile.bogusTileField; // PROBE: expect TS2339 here
