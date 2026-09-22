# Show the gods making a world, not countries

Playtest recommendation 1 (playtest notes of 20 Sept 2026, seed amber-ford-45). The gods' map is a patchwork of pole colours, and the world map that follows shares none of them. This plan draws the gods' map as the unfinished world, in the world map's own colours, so that each act shows as ground at once. It also removes the word "country" from everything the player reads.

| Task | What | Files |
|---|---|---|
| 1 | The preview: a pure model of the ground each region's marks will become | `src/ui/preview.js`, `src/ui/index.js`, `tests/preview.js`, `package.json` |
| 2 | The gods' map drawn from the preview | `src/ui/map.js`, `src/ui/derive.js`, `tests/preview.js`, `tests/ui.js` |
| 3 | "Country" becomes "land" in the player's text | `src/sim/gods.js`, `src/sim/door.js`, `src/ui/derive.js`, `src/ui/inspect.js`, `src/ui/map.js`, `src/ui/keys.js`, `src/ui/actions.js`, `src/page.template.html`, `tests/preview.js`, `tests/ui.js` |

## Rules for every task

- Scope. The rules that divide the land stay as they are. Nothing in `src/sim/` changes except two strings in task 3.
- The preview draws no random number and writes no state. `settle()` paints from the people's stream, so the view cannot run it early. The preview imitates the painters in `src/sim/world.js` and `src/sim/settle.js` with a hash of the tile and the seed.
- The preview is an impression, not a forecast of each tile. It matches the settled valley by kind of ground and by share, not by tile. At settle, the painters put each tree and each hill in another place.
- `tests/ui.js` runs only with `SLOW=1`. Put every new test in `tests/preview.js`, and add that file to the `fast` script in `package.json`.
- Run `node build.js` after each change to `src/`. Run `node --test tests/preview.js` and `npm run fast` before each commit.
- Break each new function once by hand and watch its test fail before you commit.
- Name a file by its absolute worktree path, `/Users/earchibald/Worktrees/hamlet-gods-world/...`, in every report.

## Task 1: the preview

Add `/Users/earchibald/Worktrees/hamlet-gods-world/src/ui/preview.js`. Join it in `src/ui/index.js` after `derive` and before `marks`. It touches no DOM.

### What it exports into the shared scope

- `PREVIEW_INK`: each preview kind and the palette key of its colour. The keys are the ones `readPalette()` in `src/ui/map.js` already reads:

  | Kind | Palette key | Where the world map uses the same key |
  |---|---|---|
  | `formless` | `field-none` | (none: the ground has no pole yet) |
  | `grass` | `grass` | ground `grass` |
  | `soil` | `soil` | ground `soil` |
  | `sand` | `sand` | ground `sand` |
  | `water` | `water` | ground `water` |
  | `ash` | `ash` | ground `ash` |
  | `stone` | `stone` | ground `stone` |
  | `tree` | `tree` | feature `tree` |
  | `bush` | `bush` | feature `bush` |
  | `reeds` | `reeds` | feature `reeds` |
  | `boulder` | `boulder` | feature `boulder` |
  | `deadpine` | `ash-fg` | feature `deadpine` |
  | `hill` | `hill` | a rock tile with no rock above it |
  | `peak` | `hill-fg` | a rock tile with rock above it |
  | `mouth` | `hill-fg` | a cave mouth |

- `previewField()`: returns an array of `W * H` kind strings, one per surface tile, for the field as it stands now.

### How `previewField()` paints

Paint in the same order as `settle()`. Read the marks and the boundaries with the sim's own helpers. These include `liveRegions`, `liveBoundaries`, `marksOf`, `hasMark`, `biomeOf`, `regionOf`, `hashSeed`, and `seedText`.

1. **Ground.** A live region with no `pole` mark is `formless` on every tile. Otherwise each tile takes the texture of `biomeOf(r)`, as `paintTile` in `src/sim/world.js` does. Use two value noises `e` (scale 9) and `f` (scale 5), and three independent tile hashes `h1`, `h2`, `h3` in `[0, 1)`:
   - forest: `tree` if `f > 0.4 && h1 < 0.55`, else `bush` if `h2 < 0.06`, else `grass`.
   - meadow and river: `tree` if `f > 0.7 && h1 < 0.3`, else `bush` if `h2 < 0.045`, else `soil` if `e < 0.3 && h3 < 0.2`, else `grass`.
   - rocky: `boulder` if `e > 0.55 && h1 < 0.5`, else `soil` if `h2 < 0.3`, else `tree` if `h3 < 0.03`, else `grass`.
   - wetland: `water` if `e < 0.42`, else `reeds` if `e < 0.5 && h1 < 0.5`, else `bush` if `h2 < 0.03`, else `tree` if `h3 < 0.04`, else `grass`.
   - ash: `ash`.
2. **Rivers.** Copy `paintRivers`. Take each live boundary with pole `wet`. Its line tiles and their `DIRS` neighbours on side `b` become `water`. At a ford (`k % 47` from 23 to 25) they become `sand`. Then every `RING` neighbour of a line tile that is not `water` becomes `sand`.
3. **Lakes.** Copy `paintLakes`. A region with a `pool` mark of value `surface` gets a blob at its bbox centre. The radius is `sqrt(round(area / 7) / PI)`. The jitter comes from a hash noise at scale 6. Its tiles become `water`, and a non-water tile of the region beside a lake tile becomes `sand`.
4. **Scars.** For each `scar` mark on a region, by value:
   - `burned`: `grass`, `soil`, `tree`, and `bush` become `ash`.
   - `cut`: the tiles of the middle line, as `scarCut` picks them, become `hill`. The three at the middle of the line become `stone`.
   - `drowned`: three centres, the three region tiles with the lowest hash, each get a water disc of radius 5. A `grass` tile out to radius 7 with `h1 < 0.5` becomes `deadpine`.
   - `broken`: a `grass` tile with `h1 < 0.34` becomes `boulder`.
5. **Hills.** For each region with a `height` mark: count `clamp(round(area / (4 * SECTOR_AREA)), 1, 3)`, storeys `clamp(value, 1, ZMAX)`. The radius is `rx = min(12, 4 + 2 * storeys)` and `ry = round(rx * 0.75)`. Candidate centres are the region's tiles that are at least 2 tiles from the map edge and 3 tiles from `water` or `sand`, ordered by hash. Take a candidate when it is at least `2 * rx + 3` from each centre already taken. Each hill's tiles are the region's non-water tiles in the jittered ellipse, and they become `hill`. When storeys is 2 or more, the tiles within the ellipse scaled by 0.6 become `peak`. A region with a `making` mark whose `SPAWN[value].den` is set, and no height mark, gets one hill of one storey. A region with a `depth` mark gets one hill of one storey if it has none. Then its one `mouth` is the hill tile nearest the region's heart (`heartTile`) that touches a tile that is not a hill.

The noises come from `hashSeed(seedText)` and the lattice point, with smoothstep between lattice points, as `makeNoise` does. Never call `rng`, `rint`, `shuffle`, or `makeNoise`.

### Tests in `/Users/earchibald/Worktrees/hamlet-gods-world/tests/preview.js`

Use the `loadUI` shape from `tests/icons.js`. Add the file to the `fast` script.

1. Before the first step, every tile is `formless`.
2. `previewField()` changes nothing: `JSON.stringify(takeSnapshot())` is the same before and after it, at the start, in the middle, and at the last age. The snapshot holds the streams, so this also shows that no random number was drawn.
3. An act shows at once. Step one act at a time. When a region has no pole before a step and has one after it, `previewField()` has no `formless` tile in that region after the step. Assert that this happened at least once, so the test cannot pass with no case.
4. Every kind that `previewField()` returns is a key of `PREVIEW_INK`, and every palette key in `PREVIEW_INK` is in the `readPalette()` key list of `src/ui/map.js`. Read the list from the source text, so a key that `readPalette()` never reads fails.
5. The preview looks like the valley. For the six soak seeds `r`, `x`, `alpha`, `beta`, `gamma`, `delta`, run the creation until `era === 'days'`. Then compare `previewField()` on the final field with the settled surface tile by tile. Measure first. Then set each floor below the lowest measured value. Write the measured values in a comment, with the seed list and the date.
   - Water: the share of preview `water` tiles that are water in the world, and the share of world water tiles that the preview calls `water`.
   - Trees: for each region, the share of `tree` tiles in the preview and in the world differ by no more than a measured bound.
   - Hills: the count of preview `hill` and `peak` tiles and the count of world `rock` surface tiles are within a measured factor.
   - Formless: no tile is `formless`.

   Before you set the floors, plant a fault: make the preview paint every region as meadow. At least one floor must fail.

## Task 2: the gods' map drawn from the preview

In `/Users/earchibald/Worktrees/hamlet-gods-world/src/ui/map.js`:

- `drawFieldCache(skip)` fills each tile with `P[PREVIEW_INK[kind]]` from one `previewField()` call. Group the tiles by kind and set `fillStyle` once per kind.
- The scar hatch goes. The preview paints the scars.
- In the ages, the boundaries are drawn faint: every live boundary that is not `wet`, at alpha 0.25, in `field-line`. A `wet` boundary is not drawn as a line, because the preview paints it as a river. The day-era overlay (`ui.overlay`) keeps `drawBoundaries(wctx, 0.85)` as it is.
- The gestures, the marks, the words, the captions, the intent cue, and the cross-fade between beats stay as they are. The cross-fade now shows the new ground appearing over the old.

In `/Users/earchibald/Worktrees/hamlet-gods-world/src/ui/derive.js`, remove `fieldColor` and `mixHex`, which nothing else reads. Remove their test in `tests/ui.js`.

Tests in `tests/preview.js`, with a recording 2D context as in `tests/icons.js`:

- After `drawFieldCache()`, the colour set for each tile is the colour of its preview kind. Check a sample of tiles of each kind present.
- No `field-*` colour is set as `fillStyle` by `drawFieldCache` except `field-none` and `field-line`.

Check it in Safari. Build `dist/hearth-sim.html` on dev 226a115 and on the branch. Take seed amber-ford-45 to age 2, the middle age, the last age, and the first day. Take the same four shots on each build. The last age on the branch must look like the first day.

## Task 3: "country" becomes "land"

Change the strings to the wording the review panel approved. The approved wording is in the table in `/Users/earchibald/Worktrees/hamlet-gods-world/design/plans/2026-09-21-gods-world-text.md`. Do not reword it. Keep the internal names (`countryLine`, `sector.country`, `tile.country`): they are not shown, and a snapshot saves the two fields.

Update each test that asserts an old string. Add a test to `tests/preview.js` that collects what the player reads and asserts that none of it matches `/countr/i`:

- Every chronicle line of one creation run to the first day, on seed `r`.
- In the ages: `seasonLine()`, and `countryLine()` and `inspectRegion()` of every live region.
- `inspectGod()` of every god, and `actCard()` of every gesture.
- After settle: `markRows()` of one surface tile of each region.
- The `label` of every `KEYMAP` row, and the text and `title` of every element in `src/page.template.html`, with the tags taken out.
- The label of the thought that a god gets when another god marks over its land. Read it from the source text of `gods.js`.
- The text that `inject()` returns for an option with no type.

Run it against the old strings first and watch it fail.
