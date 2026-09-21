# Names, second pass: the rulings of 19 September 2026

The naming plan merged into dev at 68b7061. The user then answered every design question the final
review raised. This plan carries out six of the seven answers. The seventh, the epithet redesign,
is a plan of its own and waits for G4.

The rulings themselves are in `.superpowers/sdd/decisions-2026-09-19.md`, with the measurements
behind them. Read that file before any task.

## Summary

| Task | What | Files | Golden |
|---|---|---|---|
| 1 | An old name's meaning matches the kind of thing it names | `src/sim/names.js`, `tests/names.js` | Moves |
| 2 | A text another source owns is offered only in a distinct form | `src/sim/names.js`, `tests/names.js` | Moves |
| 3 | The settlement naming line becomes a pool, and says it names the settlement | `src/sim/names.js`, `tests/names.js` | Moves |
| 4 | A night takes a night-shaped phrase, and each kind has several | `src/sim/names.js`, `tests/names.js` | Moves |
| 5 | One writer for `ui.focus` | `src/ui/*.js`, `tests/ui.js` | No |
| 6 | The text review panel goes in the project rules | `CLAUDE.md` | No |

## Global constraints

These bind every task. They come from `CLAUDE.md` and from the naming plan's own controller notes.

1. Work only in `/Users/earchibald/Worktrees/hamlet-names-polish` on branch `names-polish`. Never
   touch `/Users/earchibald/Code/hamlet`.
2. `src/sim/` and `src/ui/` are plain scripts in one shared scope. No `import`, no `export`. A new
   top-level name can collide with the other tree.
3. Naming moves no being and no item, adds no thought, changes no need, and makes no draw from the
   world's `rng`. Every naming draw comes from `nrng`. `tests/names.js` holds the layout guard.
4. A rule never reads a name's text to decide anything. It reads data tables.
5. Run `node build.js` after every change to `src/`.
6. Only `chronicle` and `chronicleLines` may move in the golden record. Check by field before any
   bless. If `beings`, `items`, `legends`, or the tick-0 layout moved, stop and report BLOCKED.
7. Never re-measure `tests/names-layout.json`. That file is the frozen record of the land before
   naming existed, and this work must not move it.
8. A duration or a rate goes in `CLOCK` in `src/sim/clock.js`. `tests/clock.js` fails on a bare
   time literal in a sim file.
9. Commit by path. Never `git add -A`.
10. Player-facing text in this plan is fixed. It has been through the review panel and the user
    has approved it. Use the exact words given in the task. Do not improve them.

## Task 1: a meaning that matches the thing

`LAND_WORDS` in `src/sim/names.js` is one pool of 40 phrases shared by five kinds of thing, so a
grove can be called "the bright water".

Give every phrase a set of the kinds it suits, and make `takeMeaning` draw only from the phrases
that suit the kind being named. The five kinds are `water`, `hill`, `cave`, `grove` and `ford`, the
five that `nameTheLand` names. A phrase that suits any kind carries every kind.

The pool must not run dry. Measured at day 1, a seed spends 12 to 28 of the 40 meanings, and seed
`gamma` names 10 caves on its own. The approved new phrases are in the task brief; add them.

A kind that has run out of free phrases gives no name, exactly as the single pool does today. That
path already exists and must keep working.

Test: every kind can name as many things as the heaviest seed asks of it; no phrase is offered to a
kind it does not suit; the six soak seeds all still name their land.

## Task 2: a name already owned is offered in a distinct form

Measured at day 45, the valley took a bare lore word on all four seeds tried. The help page then
prints the same word for the sky and for the valley.

The rule is general, not two special cases. **Any candidate text already owned by a named source is
offered only in a distinct form, never bare.** The one exception is naming a thing after the
people themselves, where the repetition is the point.

Today `scoreCandidates` scores a text at zero when another *named thing* owns it. A lore source is
not a named thing, so the three lore texts are free. Extend the idea: the sky's word and the
sprites' word are owned by their source, so a candidate carrying one of them is offered only in its
compound form. The compound forms already exist in `valleyFallbacks`.

Build it so a lore source added later inherits the rule without another change: the owners should
come from one list, not from two hard-coded checks.

Test: on a seed where the valley took the sky's word, it now takes the compound; on a seed where it
took the people's name, it still takes the people's name bare; no other thing's naming moves.

## Task 3: the settlement says it is naming the settlement

One line at `src/sim/names.js:550` announces a camp's name, and it says "this place". A nearby line
says "this ground" for a patch of field. The two are too close.

Replace the single line with a pool. Draw from `nrng` so the run stays deterministic and the layout
guard holds. The approved lines are in the task brief. Each takes the new name and the reason
clause that already exists.

None of them may use the word village: a separate, later line already announces that.

Test: every line in the pool is reachable; a run of six seeds produces more than one of them; the
layout guard still passes.

## Task 4: a night is named like a night

Measured: 8 named nights per 100 days, of which 4 read as places. `eventCandidates` offers two
forms for each event, the phrase and a joined word, and the joined word is offered to nights as
well as to places.

Two changes. First, a night takes the phrase form only; the joined word stays available to places.
Second, each tag in `EVENT_NAMES` gets several phrases instead of one, so a second fire or a second
birth can still be named. The approved phrases are in the task brief.

A tag whose phrases are all taken names nothing, which is today's behaviour and is correct.

Test: no named night carries a place-shaped word; a second event of the same kind takes a different
phrase; a third takes the third; the fourth names nothing.

## Task 5: one writer for `ui.focus`

Thirteen writes to `ui.focus` sit outside `src/ui/actions.js`: six in `dialogs.js`, three in
`main.js`, one each in `windows.js`, `inspect.js` and `derive.js`. `CLAUDE.md` says view state
changes in `actions.js` and records three exceptions, none of which is focus. The `derive.js` write
is the worst of them, in a file that is meant to be pure and is tested without a DOM.

Add `setFocus(v)` in `actions.js` and route every other file through it. This is the pattern already
used for `setChronSearch`. No behaviour changes.

Note the load order: `actions.js` must be joined before any file that calls `setFocus` at load time.
Check `src/ui/index.js`.

Test: `tests/ui.js` passes unchanged; a grep finds no `ui.focus =` outside `actions.js`.

## Task 6: the review panel goes in the rules

Add to "Rules of work" in `CLAUDE.md`:

> Text a player reads, and developer documentation, goes through a review panel before it lands.
> Dispatch three or more Sonnet reviewers on the text alone. Each one judges three things: does it
> sound human, is it plain English, is it readable. Rewrite on their findings. This applies to
> every element of gameplay, not only to a batch of new phrases.

Its own commit. No code changes.
