# Resume: the zoom from creation to play (playtest 6)

Paused on 21 Sept 2026 at the user's request. Recommendation 1, "Show the gods making a world, not countries", must be built first. Delete this file in the commit that resumes the work. It must not reach `dev`.

| Item | State |
|---|---|
| Branch | `creation-zoom`, off `dev` at `c11b544` |
| Worktree | `/Users/earchibald/Worktrees/hamlet-creation-zoom` |
| Plan | `design/plans/2026-09-21-creation-zoom.md` (commit `ca8831d`) |
| Task 1, the pure model | Done and reviewed clean. Commits `5b47b22` and `6d23618`. |
| Task 2, the page layer | Started, then stopped. Nothing committed. The four lines written are in the patch below. |
| Task 3, text, notes, CLAUDE.md, panel | Not started |
| Final branch review | Not started |
| PR into `dev` | Not opened |
| Dev-coordinator | Told at the start that a PR would come. Told at the pause that it is paused. |

## Why recommendation 1 comes first

Recommendation 1 makes the gods' map look like the world map by the last age. The first stop of the zoom is that picture. Check these points in the plan before Task 2 resumes:

1. The first leg is a 1000 ms fade from the gods' map (`field`) to the world map (`world`). After recommendation 1, the two pictures can be almost the same. Decide whether the fade stays, becomes shorter, or goes. The places to change are `ZOOM.fade` and `settleStops` in `src/ui/zoom.js`, and the tests on them in `tests/zoom.js`.
2. The "field" picture is taken from `wcv` in `startZoom`, because the frame loop calls `onSettle` before it draws. Recommendation 1 can change how the gods' map is drawn and when. Read `main.js` `frame` and `map.js` again, and confirm that `wcv` still holds the last frame of the ages at `onSettle`.
3. The two zoom legs (world to the nine sectors, then to the one sector) do not depend on recommendation 1.
4. Task 3 adds the skip line "Press any key to go straight to the valley." Check that it agrees with the words that recommendation 1 uses. Recommendation 1 removes the word "country" from all player text.

## How to resume

1. Rebase or merge `creation-zoom` onto `dev` after recommendation 1 is merged. Run `node build.js`, then `node --test tests/zoom.js tests/icons.js tests/build.js`.
2. Make the plan changes that the points above need. Commit them to the plan file.
3. Regenerate the Task 2 brief from the plan with the subagent-driven-development `task-brief` script. The `.superpowers/sdd/` folder is git-ignored, so it can be gone.
4. Dispatch a fresh Task 2 implementer. Apply the patch below first, or let the implementer write the lines again. They are the brief's exact text.
5. Continue with the Task 2 review, Task 3, and the three-reviewer text panel. Then do the final branch review and `npm run fast`. Then open the PR into `dev` and send the message to dev-coordinator.

## Facts from Task 1 to keep

- `npm run fast` at `6d23618`: 425 tests, 414 pass, 0 fail, 11 skipped. The 11 skips are the G4 suspension of `tests/ui.js` and `tests/wanderer.js`.
- `node --test tests/zoom.js tests/icons.js tests/build.js` at `6d23618`: 28 pass.
- The test "the centre moves with the box's width, not with eased time" (`tests/zoom.js`, line 72) went red under the plant `p = e` at `src/ui/zoom.js` line 27. Two reviewers saw it go red.
- `viewFrame('mid', s)` gives the 3 by 3 block centred on `s`. For a sector on the world's edge, the block starts at a negative tile. Task 2 must check it against what `drawMid` shows at an edge. If they differ, make `viewFrame` match `drawMid` and add a test row for an edge sector.
- Give the final review one open Minor finding. The Task 1 report gives the wrong place for the new test. The finding is about report text only.

## The uncommitted Task 2 lines

```diff
--- a/src/page.template.html
+++ b/src/page.template.html
@@ -226,6 +226,7 @@
       <div class="map-wrap" id="world"><canvas id="wmap" aria-label="World map"></canvas></div>
       <div class="map-wrap" id="mid" hidden><canvas id="mmap" aria-label="Nearby map: the sector and its eight neighbours"></canvas></div>
       <div class="map-wrap" id="loc" hidden><canvas id="map" aria-label="Location map"></canvas></div>
+      <div class="map-wrap" id="zoom" hidden><canvas id="zmap" aria-label="The view moving from the world to the valley"></canvas></div>
     </div>
--- a/src/ui/state.js
+++ b/src/ui/state.js
@@ -52,6 +52,9 @@
 let beatsLastFrame = 1;
+/* The zoom that is running, or null. { stops, legs, t, pics, boxes }. Only actions.js writes it: startZoom,
+   advanceZoom and endZoom. The world does not step while it is set. */
+let zoom = null;
 const $ = id => document.getElementById(id);
```
