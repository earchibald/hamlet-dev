# G4 against the five suites it never met

Five suites landed on `dev` after `tiers-g4` branched. They have never run against G4's retuned
clock. This report runs them, in a throwaway clone, and says what each red means.

## Summary

| Suite | Tests | Pass | Fail | Skip | Verdict |
|---|---|---|---|---|---|
| `tests/garden.js` | 7 | 5 | 2 | 0 | Unit assumption. `DAY = 1000` is hard-coded in the test. |
| `tests/itemgrid.js` | 3 | 3 | 0 | 0 | Green. |
| `tests/reachable.js` | 3 | 3 | 0 | 0 | Green. |
| `tests/stalk.js` | 8 | 8 | 0 | 0 | Green. |
| `tests/types.js` | 2 | 1 | 1 | 0 | Real gap in G4: `Being.next` is undeclared. Probe half green. |
| merged `npm run fast` | 381 | 371 | 3 | 7 | The three reds above, and nothing else. |
| `node tests/soak.js` | 86 | 56 | 22 | 8 | 16 leaf reds, three causes. See below. |

The pristine branch, unmerged, runs the soak at 73 tests, 65 pass, 0 fail, 8 skip. That is the
control for the soak reds.

## The commits

| Thing | Commit |
|---|---|
| `tiers-g4` (HEAD of the clone) | `32f28b8e05bf11bd88fa7759e0701ea601614b82` — "Each key of the kept threat list gets a check that reds when that key alone is gone" |
| `dev` (merged in) | `55af5a0f261ff70be325ee0d5ed94cac4ef45481` — "Merge branch 'soak-mechanisms' into dev" |

The other implementer moved `tiers-g4` from `bba904b` to `32f28b8` between my first and second read
of the worktree. The clone holds `32f28b8`.

## The clone

Work ran in `/Users/earchibald/.claude/jobs/8b2c73e8/tmp/trial`, a `git clone --no-hardlinks` of
`/Users/earchibald/Worktrees/hamlet-g4`. A second clone at
`/Users/earchibald/.claude/jobs/8b2c73e8/tmp/control` held the unmerged branch, as the control for
the soak. No existing worktree was written. Both clones are deleted.

`npm install` installed TypeScript 7.0.2. `node_modules/.bin/tsc --version` answered, so
`tests/types.js` ran its real check and did not skip. `node build.js` succeeded at 710,703 bytes.

## The five conflicts, and how each was resolved

| File | Resolution |
|---|---|
| `package.json` | Hand-built union of the two `fast` lines, plus dev's `types` script and its `typescript` devDependency. |
| `src/sim/index.js` | Union of the API name list. G4's clock names kept; dev's `SEASONS`, `rebuildItemGrid`, `gardenLives`, `DIRS` added; dev's `SEASON_DAYS` and `TPS` dropped. |
| `tests/clock.js` | G4's side. |
| `tests/soak.js`, hunk 1 | Union. |
| `tests/soak.js`, hunk 2 | Union. |
| `CLAUDE.md` | Union of both lists of suites. |

### `package.json`

Both sides rewrote the one `fast` line. I took neither side. The merged line is G4's 22 files plus
dev's five new ones, in that order. Dev's `SEASON_DAYS`-era list dropped nothing of G4's, and G4's
list dropped nothing of dev's.

I also kept dev's `"types"` script and its `devDependencies` block, which G4 does not have. Without
them `npm install` installs no TypeScript and `tests/types.js` skips, which is a false pass.

### `src/sim/index.js`

The conflict is three lines of the `API` name list. I checked each disputed name against a
declaration in the merged `src/sim/`:

| Name | Declared in the merged tree? | Kept? |
|---|---|---|
| `SEASON_DAYS` | No | No |
| `TPS` | No | No |
| `SEASONS` | Yes, `src/sim/clock.js` | Yes |
| `SEASON_LENGTHS`, `YEAR_DAYS` | Yes, `src/sim/clock.js:10` | Yes |
| `CELLULAR`, `beats`, `lookRate`, `stock`, `sourcesNow`, `dayOfYear`, `yearOf` | Yes | Yes |
| `rebuildItemGrid`, `gardenLives`, `DIRS` | Yes | Yes |

`SEASONS` matters: dev's new soak test reads `api.SEASONS`, and G4's own `index.js` line had dropped
it.

### `tests/clock.js`

Dev's side adds two tests that G4 deliberately replaced. I took G4's side, and so dropped both:

- `a season is 8 days and a year is 32, in plain numbers`. It asserts `SEASON_DAYS === 8` and
  `years(1) === 32000`. G4 removed `SEASON_DAYS` outright. The claim is not reachable and its
  successor is already in G4's file, at `a tick is one world second and the day is 86,400 of them`.
- `the legacy markers return their argument unchanged`. G4 replaced it with `every marker converts
  the old clock, and none is an identity`, which is the stronger claim.

Keeping dev's version would have produced two reds with no information in them. I judge this
resolution safe, not a judgement call.

### `tests/soak.js`, hunk one

Both sides rewrote the same block. I took the union:

- G4's suspended `the camps grow`, with its `LONG=1` skip and its comment. G4 suspended it on
  purpose, pending task 4.
- G4's `the counts are gathered` test, which keeps the sums running while the floor above is
  skipped. I added dev's `sums.grown += grown.length` to it, because dev's new test below reads
  `sums.grown`.
- Dev's `const longEnough`, its comment, and its test `the run visits every season`, unchanged.
- Dropped dev's duplicate `the camps grow`, superseded by G4's suspended one.
- Dropped dev's inline sums gathering, superseded by G4's test-wrapped one.

`longEnough` is declared on dev's side only, and dev's `somebody dies of old age` test, which merged
in cleanly outside the conflict, reads it. Dropping dev's declaration would have broken the file.

### `tests/soak.js`, hunk two

Union again. I kept dev's new `a child born in the run grows up` with dev's own `!isDefault` guard,
and took G4's `SUM_SKIP` guard for `the far countries are reached`.

**This one is a judgement I flag.** Consistency with G4 would have put `a child born in the run grows
up` behind `SUM_SKIP` as well, which would have skipped it. I kept dev's guard so the claim ran. It
goes red. The brief asks for the reading that exposes a fault rather than hides one, and the red is
informative: it shows that dev's guard does not protect the claim on G4's three-day default run. A
reader who wants the other reading should read that red as a skip.

### `CLAUDE.md`

Both sides added suites to the same list. Union, G4's three lines then dev's three.

## The merged `fast` line, counted

The merged line names **27** files. Method: `node -e` parsed `package.json`, split
`scripts.fast` on whitespace after stripping `node --test`, and printed the length. No duplicates.
Every one of the 27 exists on disk, checked with `fs.existsSync` per name.

`tests/` holds **32** `.js` files. Method: `find /…/trial/tests -name '*.js' | wc -l`, recursive,
which reaches `tests/lib/` and `tests/perf/`.

The five files on disk that `fast` does not name are all correct omissions:

| File | Why it is not in `fast` |
|---|---|
| `tests/lib/run.js` | The shared runner, not a suite. |
| `tests/soak.js` | The slow soak, run on its own. |
| `tests/trace-deaths.js` | A tool, not a suite. |
| `tests/perf/measure.js` | A perf harness. |
| `tests/perf/draw-harness.js` | A perf harness. |

27 + 5 = 32. Nothing was dropped by the resolution.

## The reds, one by one

### `tests/garden.js` — two reds, both a unit assumption

Failing tests: `real run, seed r: gardenLives matches the whole-map scan for every camp, every 25
ticks over 15 days`, and the same for seed x.

Assertion: `seed r: no camp ever planted a garden in 15 days; the comparison had nothing live to
check`, at `tests/garden.js:113`.

**Classification: a unit assumption in the test.** The line is `tests/garden.js:104`:

```js
const N = 25, DAYS = 15, DAY = 1000;
```

`DAY = 1000` is dev's day. On G4 `DAY` is 86,400. The loop runs `DAYS * DAY` = 15,000 ticks, which is
0.17 of a G4 world day, not 15 days. No camp plants a garden in four hours, so the test's own
vacuity control fires.

Evidence: the divergence assertion at `tests/garden.js:96`, which is the thing the suite exists to
check, never fired once across either seed. Only the control fired. The suite reports honestly that
it proved nothing. The five hand-built tests in the same file, which build a garden themselves and do
not run the world, all pass. So `gardenLives` itself is not implicated.

The fix belongs to the test, not to `src/sim/`: read `api.DAY` instead of writing 1000, and pick a
day count that a camp can reach.

### `tests/types.js` — one red, a real gap in G4

Failing test: `src/sim passes tsc --checkJs with zero errors`.

Error count: **four**, all one cause.

```
src/sim/beings.js(555,63): error TS2339: Property 'next' does not exist on type 'Being'.
src/sim/beings.js(564,7):  error TS2339: Property 'next' does not exist on type 'Being'.
src/sim/main.js(82,63):    error TS2339: Property 'next' does not exist on type 'Being'.
src/sim/main.js(86,20):    error TS2339: Property 'next' does not exist on type 'Being'.
```

**Classification: a real gap in G4's code, caught for the first time.** G4 added a `next` field to a
Being, the wake tick of the lazy body, and never declared it on the `Being` interface.

Evidence, three pieces:

1. `git show origin/dev:src/sim/beings.js | grep -c '\.next\b'` answers 0. Dev's `beings.js` has no
   such field. `git show HEAD:src/sim/beings.js` has it at lines 553 and 562. The field is G4's.
2. `types/sim/records.d.ts` comes from dev unchanged by the merge. Its `Being` has `nextArrival`, not
   `next`.
3. I touched neither file in any resolution, so it is not a merge artefact of mine.

It is a type gap, not a runtime fault: the code works. The cost is that `Being` no longer closes over
its own fields, which is the exact hole `types/sim/` was written to shut. Declare `next: number` on
`Being` and the suite goes green.

The probe half, `a misspelt field is caught on every record kind, not hidden`, **passes**. All four
planted misspellings are still caught, on a Being, a Tile, a GroundItem and a Camp, read both
directly and through the shared state. The guard that keeps the type check honest still holds.

### The soak — 16 leaf reds, three causes

The soak is not one of the five suites, but the merge rewrote it, so it is reported. The control run
on the unmerged branch is green at 65 pass, 0 fail, so every red below arrived with the merge.

| Red | Count | Classification |
|---|---|---|
| `the run visits every season` | 6, one per seed | Unit assumption, and a guard that fails to protect |
| `somebody dies of old age` | 6, one per seed | Unit assumption, same shape |
| `the run matches the golden record` | 2, seeds x and gamma | A merge consequence, benign |
| `seed x saved on day 1.5 … tells the same story to day 3` | 1 | The same cause as the two above |
| `a child born in the run grows up` | 1 | Unit assumption |

The 22 counted failures are these 16 leaves plus the six per-seed parent tests.

#### `the run visits every season`, six seeds

Assertion: `the 3-day run never reached summer, autumn, winter. It saw spring. A season nobody
reaches leaves every rule that reads it dead.`

**Classification: a unit assumption, of the kind the guard was meant to catch and cannot.** Dev wrote
the guard as `const longEnough = DAYS >= DEFAULT_DAYS`, and dev's `DEFAULT_DAYS` is 70. G4's
`DEFAULT_DAYS` is 3, at `tests/soak.js:55`. So on G4 the guard reads `3 >= 3`, is true, and the claim
runs on a three-day run against a 365-day year.

This is the pattern of "a guard derived from the measured quantity". Dev's own comment argues against
a calendar-derived guard, because such a guard would switch off on the very change it reports. The
day-count guard has the same defect by another road: it is derived from `DEFAULT_DAYS`, and G4 moved
`DEFAULT_DAYS`.

The red is true. G4's three-day default run reaches spring and no other season, so every `seasonOf()`
and `isWinter()` read site is dead in the default suite. That is already known on this branch, in
`design/reports/2026-09-20-g4-the-suite-never-reaches-winter.md`. This suite is the first thing that
says it out loud.

#### `somebody dies of old age`, six seeds

Assertion: `no person died of old age in 3 days, though 0 people passed LIFE.human.life (84 days) and
the oldest reached 36.1.`

**Classification: a unit assumption, same shape.** The same `longEnough` guard, the same
`DEFAULT_DAYS` move. Nobody can pass an 84-day span in a three-day run.

#### `the run matches the golden record`, seeds x and gamma

Assertion: `the story changed for seed x. Counts that moved: none.` The diff names one field:
`chronicle`.

**Classification: a merge consequence, benign, not a fault in either branch.** Evidence:

- Only the `chronicle` hash moved. `chronicleLines`, `beings`, `items`, `legends`, `tiles` and every
  one of the roughly 60 counters are identical. "Counts that moved: none."
- The line count is unchanged while the text hash is not, which is a rewording, not a change of
  events. Dev carries `design/approved-text.md` and the names-polish work, which reworded chronicle
  lines.
- The record compared is `tests/soak-working.json`, G4's own working record, which predates dev's
  text.

So the two reds say that dev changed some chronicle wording. They do not say the world behaves
differently. A merge of `dev` into G4 for real will have to move the working record for these two
seeds, and the report of that move should say "text only, no counter moved".

Note that `tests/soak.js` on G4 reads `tests/soak-working.json`, not `tests/soak-golden.json`. The
merge did rewrite `tests/soak-golden.json` in the clone, taking dev's side, but G4's soak never reads
that file, so it changed nothing here. I ran no `UPDATE_GOLDEN`. `git status` confirmed
`tests/soak-working.json` unmodified after every run.

#### `seed x saved on day 1.5, loaded into a fresh sim, tells the same story to day 3`

Assertion: `the world saved on day 1.5 and loaded told another story. The snapshot lost or rebuilt
something.` The diff names one field: `chronicle`.

**Classification: the same cause as the red above, not a snapshot fault.** The oracle compares the
loaded run against `golden['x'].chronicle` at `tests/soak.js:331`, which is the one stale hash. Seed
x is also the seed whose golden red fired, and the field is the same field. The snapshot is not
losing anything: it is being held to a chronicle hash that dev's rewording moved.

Evidence: the control run on the unmerged branch passes this test, with the same working record and
the same snapshot code.

#### `a child born in the run grows up`

Assertion: `0 of 0 children are alive at the end and past 'young' by stage() (want >= 6).`

**Classification: a unit assumption, and partly a merge artefact of my own resolution.** The
assumption is real: `GROWN_FLOOR = 6` was measured on dev's 70-day run, and no child is born in three
world days, let alone grows up. Every seed reports "0 born here".

The artefact part is mine, and I flag it. Dev's guard is `!isDefault`, which is false on G4's default
run, so the claim runs. G4 puts its other cross-seed sums behind `SUM_SKIP`, which would have skipped
it. I kept dev's guard on purpose, to show the red rather than hide it. A real merge should decide
between the two: either suspend this claim under `SUM_SKIP` with a named reason, like the two floors
beside it, or restore a run long enough to reach it.

## What I could not separate

Nothing in the five suites. The two garden reds, the four type errors, and each soak red have a named
cause with evidence behind it. The soak's golden reds are the weakest of the set: I attribute the
moved chronicle hash to dev's text work by elimination, because no counter and no other hash moved,
and I did not diff the two chronicles line by line to name the reworded line. If that matters, the
next session should run the two chronicles side by side.

## Housekeeping

I wrote nothing to `/Users/earchibald/Code/hamlet` and nothing to any worktree except this file,
which is left untracked and uncommitted. I ran no `UPDATE_GOLDEN`, pushed nothing, opened no pull
request, and killed no process by pattern. Both clones,
`/Users/earchibald/.claude/jobs/8b2c73e8/tmp/trial` and
`/Users/earchibald/.claude/jobs/8b2c73e8/tmp/control`, are deleted.
