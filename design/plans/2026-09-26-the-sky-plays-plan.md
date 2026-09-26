# Plan: the sky plays (faith, prayers, miracles, chapters)

The proposal is `design/proposals/2026-09-26-the-sky-plays.md`. Read it first: its tables are the spec. This plan says where each piece goes. Branch `game-loop`, worktree `/Users/earchibald/Worktrees/hamlet-game-loop`.

## Invariants (every task)

- **Faith off changes nothing.** `options.faith` defaults to `false` in `DEFAULT_OPTIONS`. Every new rule returns at once when it is false. The soak, the golden record, and every existing test run with faith off and must not move. `checkOptions` accepts only a boolean.
- **No random number in the faith rules.** Prayers, credit, belief, grace, and the tally draw nothing from `rng`. A miracle may start rules that draw (a storm's end, a flee), and that is fine because the act is in the door log.
- **Durations and rates go in `CLOCK.faith`** in `src/sim/clock.js`, written in the unit helpers. Amounts that are not time (belief values, costs, radii) go in a `FAITH` table in `src/sim/faith.js`. `tests/clock.js` must pass: no bare time literal, and every CLOCK entry is read by a rule.
- **Rules read tables.** Which species a Ward scares and which a Beckon calls come from new flags on `SPECIES` rows (`warded: true` on wolf and fox, `beckoned: true` on rabbit and deer), not from names.
- **Every new top-level `let` goes in `SAVED_STATE` (and `savedValues()`) or `NOT_SAVED`** in `src/sim/snapshot.js`. A new top-level `const` container goes in `KNOWN_CONSTS` or `FROZEN_TABLES` in `tests/snapshot.js`. A field that points at a record goes in `REFS`. Prayers and signs name beings and camps by id, never by reference.
- **Every new behaviour is visible**: a chronicle line, a thought, a chip, or a card row.
- `node build.js` after every change to `src/`. `npm run fast` must be green at the end of each task (compare with the baseline: failures that were already there on dev stay out of scope; name them).
- Player text is plain English, one idea per sentence. It will go through a review panel at the end, so keep all of it in one table where you can (`FAITH_TEXT` in `src/sim/faith.js`) with `{name}`-style slots.

## Task 1: the sim (`src/sim/faith.js`, new)

Load it after `beings.js`, `species.js`, and `fae.js` in `src/sim/index.js` (it reads their helpers at call time, so the position only matters for tables it extends).

State: one top-level `let faith = null`. `resetState` sets it to `null`. When a world starts with `options.faith`, `startFaith()` sets it to:

```
{ grace, spent, prayers: [], signs: [], tallies: [], forgotten: false, nextPrayer: 1,
  season: <seasonOf() now>, since: { answered, ownHands, silent, births, deaths, spent, tick } }
```

Humans carry `belief` (0 to 100), set lazily by `faithTick` for any living human that lacks it: the first person gets `FAITH.belief.founder` (40), a child with known parents gets the mean of the parents' belief, anyone else `FAITH.belief.newcomer` (20). Find how the code records parents and the first person; do not guess.

`faithTick()` is called last in `updateWorld()` (after `godsTick`, so no existing step is reordered) and returns at once unless `options.faith && faith && era === 'days'`. It does its work once every `CLOCK.faith.every` (a whole number of beats; ten world minutes is a good value; check `tests/beats.js` for what a nested period must satisfy). Its work, in order:

1. Initialise missing beliefs.
2. Grace income: each living human adds `belief / 100 * CLOCK.faith.gracePerHour-scaled-to-the-period`. Cap at `FAITH.graceCap` (100). Express the rate so the lint accepts it (look at how other per-hour rates are written).
3. Belief fade: `FAITH.fadePerDay` (2) scaled to the period, never below `FAITH.belief.floor` (5).
4. Open prayers (table `PRAYERS`, below). At most one open prayer per camp per kind. A person never has two open prayers.
5. Resolve prayers: for each open prayer, check its `ended(p)`; if ended, look for a credit sign; apply the outcome row. If the deadline passed, the silent row. If the one who prayed died, the silent row, with its own line.
6. Forgotten: `forgotten = no living human has belief > FAITH.belief.floor`. Log a major line when it turns on and a good line when it turns off.
7. Season turn: if `seasonOf() !== faith.season`, push a tally, log one major line, reset `since`.
8. Prune signs older than `CLOCK.faith.signKeep`.

`PRAYERS` rows (one per kind: fire, hunger, wolf, wildfire). Each row has `when(camp)` returning the one who prays or null, `ended(p)`, `deadline` (a CLOCK.faith entry), `answers` (the act names that credit it), `radius` (for the sign search; null means anywhere), and text keys. The spec is section 3.2 of the proposal. Use the existing helpers: `pitTile()`, `pitLit()`, `stashFood()`, `campHumans()`, `isNight()`, `nearAt()`, `threatsFor` style predator checks, `tileAt()`. Remember `camp` is a global cursor: set it for each camp and restore it. For wildfire, scan a square of `FAITH.wildfireRadius` around the camp site on level 0, skipping the pit.

Outcomes (section 3.4 of the proposal): answered by the sky, by their own hands, or silent. Each moves belief, adds a thought (durations in `CLOCK.thought` or `CLOCK.faith`), and logs a line with the right kind (`good`, `info`, `bad`). A witness sign: any miracle that lands gives each living human within `FAITH.witnessRadius` of it `FAITH.belief.witness` (2), once per miracle.

Miracles (door acts in `src/sim/door.js`, logic in `faith.js`):

| Act | Event | Cost (`FAITH.cost`) | Effect |
|---|---|---|---|
| `light` | `{x,y,z}` | spark 15 | unchanged when faith is off. When on: refused if forgotten or grace short, else pay, run `lightTile`, and leave a sign only if the strike did something. |
| `rain` | `{x,y}` | 40 | refused if a storm is already on. Else `weather.storm = true`, `weather.until = tick + CLOCK.faith.rainLength`, a line. The ordinary storm end then schedules the next storm. |
| `ward` | `{x,y,z}` | 15 | every living `warded` animal within `FAITH.wardRadius` fails its task and flees. The sign stays active for `CLOCK.faith.wardHold`; `threatsFor` adds active ward signs as threat points for `warded` species (when faith is off the list is empty, so nothing changes). |
| `beckon` | `{x,y,z}` | 20 | up to `FAITH.beckonMost` living `beckoned` animals within `FAITH.beckonRadius`, nearest first, walk to within a few tiles of the spot (`setTask(a,'walkTo',…)` as `species.js` does). |

A refused miracle costs nothing and returns a sentence saying why ("Your grace is too thin. 12 of 40.", "Nobody believes in the sky. It cannot act.", "It is already raining."). With faith off, `rain`, `ward`, and `beckon` return "The sky plays only in a world made to be played." and change nothing.

Snapshot: `faith` in `SAVED_STATE` and `savedValues()`. `belief` on a being is a plain number and needs nothing. `FAITH`, `PRAYERS`, and `FAITH_TEXT` go in `FROZEN_TABLES` or `KNOWN_CONSTS` in `tests/snapshot.js`. `tests/types.js`: add the new state to the types in `types/sim/` so tsc stays at zero errors.

Tests: `tests/faith.js`, fast (under 20 s), added to `npm run fast` in `package.json`. At least:
- Faith off: a short run makes no `faith` state, no `belief` field, and `rain`/`ward`/`beckon` refuse.
- A faith-on world: the first person gets belief 40, grace accrues, belief fades toward the floor and not past it.
- A laid cold pit at night opens a fire prayer with the right person. `light` on the pit answers it: belief rises, the line says the sky heard. A pit lit without a sign (set `lit` directly, as an ember would) gives the own-hands row. A deadline that passes gives the silent row.
- Costs: `light` with too little grace is refused and costs nothing; with enough it pays.
- `rain` starts a storm and refuses a second. `ward` makes a wolf near the spot flee. `beckon` sends a deer toward the spot.
- A season turn (use `setClock` from `tests/lib/run.js`) pushes a tally with the counters.
- Forgotten turns on when every belief is at the floor, and a miracle is then refused.
- A snapshot taken mid-prayer and loaded gives the same `faith` state.
- Each test must fail against the code without the rule it tests. Break the rule once and watch it go red.

## Task 2: the interface

- **Start dialog** (`src/page.template.html`, `src/ui/dialogs.js`, `src/ui/actions.js`, `src/ui/keys.js`): two ways to start. "Play as the sky" is the default action (Enter) and passes `faith: true`. "Watch the valley" passes `faith: false`. Each button has a `<kbd>` key (tests/ui.js requires it). Continue and Load keep the saved world's options.
- **Strip**: when `options.faith`, a Grace gauge (`Grace 42`, level by value) and a believers count ("3 of 4 believe"). When forgotten, the gauge text says "Forgotten". Put the reading in `derive.js` (no DOM) so it can be tested.
- **Tools** (`TOOLS` in `state.js`, `applyTool` in `actions.js`, keys): Spark (the old Light fire; keep its key), Rain, Ward, Beckon, each with its cost in the button and the hint, one-shot like Light fire. Rain, Ward, and Beckon show only when faith is on. Find free keys in `KEYMAP` (check for clashes in every focus). The door's reply goes to `say()` as now.
- **Prayer chips**: `alerts()` in `derive.js` adds a `prayer` chip for each open prayer: "Aki prays for fire" with the time left, jumping to the person. `ALERT_LABEL` gets a row. A praying person gets a mark on the map (a small ✦ above them, in the sector, camp fire, and nearby views).
- **Slow for prayers**: when a prayer id the view has not seen appears and the speed is faster than `DAYS_SPEED`, set the speed to `DAYS_SPEED` and say "Aki prays. Time slows so you can listen." A persisted view setting `ui.slowForPrayers` (default true) switches it off; it has a key and a row in help. Write the view state in `actions.js` only (see CLAUDE.md's list of exceptions: do not add a new one).
- **Tally card**: when a new tally appears, open a dialog with its rows as a small table and one closing line. Enter or Esc closes it. It does not open for a world with faith off.
- **Person card** (`inspect.js`): a Belief row, and the person's open prayer if any.
- **Help**: a short section "Playing as the sky": grace, prayers, the four miracles and their costs, credit, and forgotten.
- Tests: `tests/faith-ui.js`, fast, in `npm run fast`: the gauge and believers text from `derive.js`, the prayer chip, the tools shown only with faith on, the slow-down rule (a pure function that takes the seen ids, the prayers, and the speed, and returns the new speed), and the tally rows. Every button has a key (tests/ui.js).

## Task 3: documents and text

- `design/notes.md`: a new section "21. The sky plays" that records the rules, the numbers, and why (short; the proposal holds the argument).
- `CLAUDE.md`: add `faith.js` to the file list, and `tests/faith.js` and `tests/faith-ui.js` to the test list.
- A review panel of three Sonnet readers on every new player-facing string (FAITH_TEXT, chips, tools, help, tally card, dialogs). Rewrite on their findings.

## Reviews

A fresh reviewer after each task, reading the diff against this plan and the invariants. A broad review of the whole branch at the end.
