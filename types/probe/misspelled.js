// A fixture, not a file of the game. It exists only so tests/types.js can prove that the
// type check really does catch a misspelt field, on the paths real code actually reads
// records from. It is never joined into the built page: build.js reads only src/sim/*.js
// and src/ui/*.js, and this file lives under types/, outside both.
//
// tsconfig.probe.json checks this file together with src/sim/, so the shared state
// (beings, items, camp, and tileAt(), all typed in core.js) resolves the same way it does
// at runtime. Every marked line below must fail with TS2339, "Property '...' does not
// exist". If one stops failing, an index signature has crept back in, a catch-all `any`
// crept onto the shared state, or a real field of that name was added; either way the
// probe test in tests/types.js goes red to say so.
//
// The first check used makeBeing()/makeTile() directly, because at the time nothing else
// in src/sim/ was typed: `beings[0]` and `tileAt()` both read off untyped state and came
// back `any`, so a misspelling on either one passed silently. Reading the shared state
// itself (`beings`, `items`, `camp`, `tileAt()`) is the realistic form: it is how almost
// all of src/sim/ actually reaches a Being, an Item, or a Camp.
const probeBeing = makeBeing('human', 0, 0, null, 0);
const misspelledBeingField = probeBeing.hungerr; // PROBE: expect TS2339 here

const probeTile = makeTile(1, 2, 0, 'grass');
const misspelledTileField = probeTile.bogusTileField; // PROBE: expect TS2339 here

const misspelledFromBeingsArray = beings[0].hungerr; // PROBE: expect TS2339 here
const misspelledFromTileAt = tileAt(1, 2, 0).bogus; // PROBE: expect TS2339 here
const misspelledFromItemsArray = items[0].bogusItemField; // PROBE: expect TS2339 here
const misspelledFromCampGlobal = camp.bogusCampField; // PROBE: expect TS2339 here

// A Thought and a Task are reached the same way, one step further in: off a being's own
// thoughts and its current task. Both records gained a field in the G4 retune (a thought's
// `until`, a task's `worked`, `due`, and `waitUntil`), and neither kind was covered here
// before, so a catch-all index signature on either would have gone unseen. These two lines
// keep that from being true again.
const misspelledThoughtField = beings[0].thoughts[0].untill;  // PROBE: expect TS2339 here
const misspelledTaskField = beings[0].task.workedd;           // PROBE: expect TS2339 here
