# People filters (playtest recommendation 13)

The People drawer lists every person in the world, with two filters: camp and age. The camp filter starts on the camp the player has chosen. If no camp is chosen, the drawer lists everyone.

| Item | Decision |
|---|---|
| Camp filter | Recorded (`b.camp`). A button cycles: the chosen camp, each other camp in `camps` order, everyone, and back. Key `E`. |
| Age filter | Recorded (`born`, `stage(a)`: young, adult, old). A button cycles: any, young, adult, old, and back. Key `Y`. |
| Gender filter | Not built. No being records a gender. |
| Job filter | Not built. No being records a job. `task.type` has about 40 values, and most are short steps (walk, drink, deliver). It is not a job. |
| Branch | `people-filters`, off `dev` at `759e289` |
| Tests | New fast file `tests/people.js`, named in `npm run fast`. `tests/ui.js` runs only with `SLOW=1`, so it does not guard this work in the fast suite. |

## The text

Three Sonnet reviewers read these strings for humanity, plain English, and readability. The majority verdict holds. Use the strings exactly.

| Where | Text |
|---|---|
| Camp button, one camp | `Camp: <camp name>` |
| Camp button, all camps | `Everyone` |
| Age button, no filter | `Age: any` |
| Age button, one stage | `Age: young`, `Age: adult`, `Age: old` |
| Count after the title, a filter hides some living people | ` · 5 of 18` |
| Count, nobody hidden | ` · 18` (as today) |
| Empty list, the filters hide everyone | `Nobody matches these filters.` |
| Empty list, nobody exists | `Nobody yet.` (as today) |
| Camp text after a name, when the list covers more than one camp | `<camp name>`, in muted text, not a `tag` pill |
| Camp text, a person with no camp | `no camp`, the same style |
| Help row, key E | `People: the next camp, then everyone` |
| Help row, key Y | `People: the next age` |

The panel changed one string: `Nobody here matches.` became `Nobody matches these filters.`, because the old line did not name the cause. One reviewer said `no camp` in a `tag` pill reads as a fourth age next to `young` and `old`. So the camp shows as muted text in its own class. Another reviewer said a long camp name can crowd the button and the row, so both get `text-overflow: ellipsis` at their width.

## State

Two new fields on `ui` in `src/ui/state.js`:

- `peopleCamp`: `null` follows the chosen camp, a number is a camp id, `'all'` is everyone. `persist()` does not save it, because a camp id is valid in one world only. `onLoad` and `onSettle` in `src/ui/actions.js` set it back to `null`, next to the other resets of `ui.row.people`.
- `peopleAge`: `'any'`, `'young'`, `'adult'` or `'old'`. Persisted by `persist()` and read back by `restore()`, which accepts only those four values, as it does for `chronFilter`.

The chosen camp is `camp` when `camps.includes(camp)`, else none. `renderUI` sets `camp = viewCamp` on each call.

## Task 1: the rows, the actions, the keys, and the tests

Files: `src/ui/state.js`, `src/ui/derive.js`, `src/ui/actions.js`, `src/ui/keys.js`, `tests/people.js` (new), `package.json`, `tests/ui.js` (the `RUNTIME` list only).

1. In `src/ui/derive.js`, add `peopleScope()`. It returns `{ camp }`, where `camp` is a camp record or `null` for everyone. `ui.peopleCamp === 'all'` gives `null`. A number gives that camp if it is still in `camps`, else the chosen camp. `null` gives the chosen camp. No chosen camp gives `null`.
2. Change `peopleRows()`. It keeps every human who is alive or died less than a day ago, in any camp or in none. It keeps the `diedAt` test exactly as it is. It then keeps only the rows in `peopleScope().camp` (when not `null`) and of stage `ui.peopleAge` (when not `'any'`). The sort stays: trouble first, then the living, then camp order (`camps.indexOf`, no camp last), then name.
3. Add `peopleCount()` to `src/ui/derive.js`. It returns `{ shown, alive }`: the living rows `peopleRows()` returns, and the living humans in the world. Add `peopleCampLabel()`, `peopleAgeLabel()`, and `peopleMixed()`. `peopleMixed()` is true when the rows shown hold more than one camp, or a person with no camp.
4. Add `ui.peopleCamp`, `ui.peopleAge` to `viewKey()` in both branches, so a filter change repaints.
5. In `src/ui/actions.js`, add `ACTIONS.peopleCamp()` and `ACTIONS.peopleAge()`. Each moves to the next value, sets `ui.row.people = 0`, calls `persist()`, and calls `renderUI(true)`. The camp cycle is `[null, ...other camp ids in camps order, 'all']`, where "other" means not the chosen camp. A current value not in the list counts as `null`. With no chosen camp, the cycle is `['all']` and the action changes nothing.
6. Reset `ui.peopleCamp = null` in `onLoad` and `onSettle`.
7. In `src/ui/keys.js`, add `{ key: 'e', focus: 'drawer', action: 'peopleCamp', label: …, button: 'peopleCampBtn' }` and `{ key: 'y', focus: 'drawer', action: 'peopleAge', label: …, button: 'peopleAgeBtn' }`, next to the `showAll` row. Add both button ids to `RUNTIME` in `tests/ui.js`.
8. Add `peopleAge` to `persist()` and `restore()` in `src/ui/state.js`.
9. Write `tests/people.js`, fast, with no `runDays`. Use the `loadUI` pattern from `tests/ui.js` and hand-built camps and beings from `startWorld('r')` and `makeCamp`. Each test must fail against the old `peopleRows`. Break the code and watch each test go red before you trust it. Cover:
   - The default lists the chosen camp only, as before.
   - With no chosen camp, the list holds every person, including one with no camp.
   - The camp cycle goes chosen, other, everyone, chosen, and a stale camp id falls back to the chosen camp.
   - The age filter keeps only that stage.
   - `peopleCount()` gives shown and alive, and the dead within a day count in neither.
   - `restore()` accepts the four age values and rejects any other value.
   - The two key rows fire `peopleCamp` and `peopleAge` with a drawer focused.
10. Name `tests/people.js` in `npm run fast` in `package.json`.

## Task 2: the drawer

Files: `src/ui/panels.js`, `src/ui/main.js`, `CLAUDE.md`, `dist/hearth-sim.html` (built).

1. In `drawerHTML`, give the People drawer a filter row: `<div class="filter"><button class="btn small" id="peopleCampBtn">…<kbd>E</kbd></button><button class="btn small" id="peopleAgeBtn">…<kbd>Y</kbd></button></div>`.
2. In `renderDrawers`, write each button's label with `setHTML`, from `peopleCampLabel()` and `peopleAgeLabel()`, with the `<kbd>`. Mark a button `on` when its filter is not the default. Hide the filter row in the ages (`inAges()`).
3. In `renderPeople`, write the count from `peopleCount()`: ` · shown of alive` when they differ, else ` · alive`. When `peopleMixed()` is true, add the person's camp name, or `no camp`, after the name, in a muted span with its own class (not `tag`), with an ellipsis for a long name. Give the two filter buttons an ellipsis too. Show the empty text `Nobody matches these filters.` when the filters hide everyone and people exist.
4. In the drawer pointer handler in `src/ui/main.js`, call `ACTIONS.peopleCamp()` and `ACTIONS.peopleAge()` for clicks on the two buttons, next to `#showAllBtn`. The handler must not write `ui` itself.
5. Add a `tests/people.js` entry to `CLAUDE.md` (Layout list), in the style of the other entries.
6. Run `node build.js`, `npm run fast`, and check the page in Safari (safaridriver MCP) at seed amber-ford-45 with more than one camp.

## At the end

A broad review of the whole branch. Then a PR into `dev`.
