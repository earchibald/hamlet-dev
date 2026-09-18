# Names: the land, the camps, the events, and the people

Date: 2026-09-17. Branch: `ui-rethink`. Status: design, awaiting review.

This spec adds a naming system to the simulation. It names the land, the camps, the events, and the people, and it keeps the history of every name. It adds no rule that moves a being or an item. Read `design/notes.md` first. The interface side is in `2026-09-17-ui-rethink-design.md`, section 8 of this spec is its input.

## Summary

| Decision | Choice |
|---|---|
| What is named | The valley, the river, hills, caves, groves, fords, ponds, sectors, camps, events, and people's epithets. |
| Layers | A lost people left names in an old tongue on landmarks at generation. Living people name camps, sectors, events, and each other in plain words as things happen. |
| Tongue | Plain compound words for the living. A seeded syllable language with a plain meaning for the lost. |
| Mythos | Each world gets a lost people, two or three remembered things, a name for the sky, and a name for the sprites. Tables, no rules. |
| Mechanism | One namer. Candidates from every axis, scored by salience and the namer's traits. Top wins. Scores kept and shown. |
| History | A name is a record. Every nameable thing keeps a list of its names. The chronicle keeps the name of its day. |
| Camps | Founder's camp at the site. Named when the hearth is established. Named again at village, usually the same. `rename` with a reason is the only door after that. |
| Epithets | Everyone. Weighted to what peers think. First at ten days in a camp. Replaced only at a high bar. Fate gives the last one. |
| Determinism | A second random stream for names. The world stream is untouched, so every seed's land and beings stay as they are. |

## 1. Names are records with a history

A name is a record:

| Field | Meaning |
|---|---|
| text | `Reedwater`, `Aska Vel`, `the sour` |
| tongue | `plain` or `old` |
| meaning | for the old tongue: `the sleeping hill`. Empty for plain names |
| since | the tick it was given |
| why | one plain sentence: `for the reeds along the water` |
| by | the id of the being that named it, or `lost` |
| scores | the candidate list and scores, as `lastChoice` keeps them for a decision |

Every nameable thing has a `names` list, newest first. Its `name` is the text of the first record. The list never loses a record. `formerNames(thing)` returns the rest.

The chronicle stores text, as today. A line written under an old name keeps that name. That is the continuity rule: the chronicle is the record, and `name` is the lookup for now. A hover on a name in the interface shows the record, and the Camp drawer lists a camp's former names with their dates and reasons.

Nameable things and where the list lives:

| Thing | Where |
|---|---|
| the valley | `valley.names` |
| the river | `river.names` |
| a hill, a cave, a grove | `hill.names`, `cave.names`, `grove.names` |
| a ford, a pond | `ford.names`, `pond.names`, on the records world generation already keeps |
| a sector | `sector.names` |
| a camp | `camp.names`. `camp.name` stays and reads the first record |
| an event | `event.names` on a chronicle entry that was named |
| a person | `a.epithets`, and `a.epithet` reads the first |

## 2. Generation: the lost people, the old tongue, the mythos

**A second random stream.** `names.js` owns a random generator seeded from the world seed with the salt `:names`. The mythos branch uses `:gods` for its own stream; the two must differ. Everything in this spec draws from it. The world stream is never touched. On every soak seed the land, the beings, and the items must be byte-identical to today's, and `tests/names.js` checks it.

**The old tongue.** A syllable table is built from the name stream at generation: 8 to 12 onsets, 5 vowels, 6 to 8 codas, with a few forbidden pairs so words stay sayable. An old name is one or two words of one to three syllables: `Aska Vel`, `Orun`, `Tirra Mosk`. Each old name carries a meaning drawn from a table of land words: `the sleeping hill`, `where the water turns`, `the pines that watch`. A meaning is never used twice in a world.

**The mythos.** At generation the world gets:

| Thing | Example | Table |
|---|---|---|
| the lost people | `the Vel`, in the old tongue | one word from the tongue |
| what they built | `they raised the stones on the hills` | 8 lines |
| what took them | `a winter that did not end`, `the wolves`, `they walked west and did not come back` | 8 lines |
| the sky, which is the player | `Orun, the one who gives fire` | tongue plus a meaning table of 6 |
| the sprites | `the Tirra, the small lights` | tongue plus a meaning table of 6 |

These are data on `mythos`. Nothing reads them but the namer and the interface.

**Old names on the land.** At generation, every hill, cave, and grove gets an old name, the river gets one, and one ford in three gets one. Nothing else. Sectors, ponds, and the valley wait for the living.

**Learning an old name.** An old name is unknown until learned. A camp learns it when one of its members stands on the thing, or finds old bones or a find in a deep chamber under it, or, for the river, first draws water. Learning writes a chronicle line, kind `info`: `Fen finds marks cut in the rock. The old people called this hill Aska Vel, the sleeping one.` A learned name is known to the whole world from then on. Until learned, the interface describes the thing by its place: `the hill east of Reedwater`, `the river`.

## 3. The namer

One function names anything: `nameThing(thing, kind, by, place)`. It gathers candidates from every axis, scores them, picks the top, and pushes the record. The scores are kept on the record.

| Axis | Candidates | Base score |
|---|---|---|
| land | the biome word, and the nearest landmark within 12 tiles: water, ford, reeds, stones, pines, hill, cave, pond | 30 |
| event | each major chronicle line at this place in the last 16 days, turned into a name by a table keyed on the line's kind and a tag the line carries | 20, plus 3 a day of recency |
| founder or notable | the founder, the eldest, the most liked member of the camp | 25 |
| old tongue | a learned old name within 12 tiles, kept or translated to its meaning | 20 |
| mythos | the lost people, the sky, the sprites | 10. 30 once the camp has seen the sprites |

Trait weights on the namer, each a multiplier from 0.7 to 1.3 across the trait's range: curiosity on old tongue and mythos, sociability on founder or notable, temper on event, patience on land. A candidate whose text is already a name anywhere in the world scores zero.

The namer is the most sociable living member present at the place, or the founder for a camp with one member.

**Plain names** come from two tables and three shapes:

| Shape | Example |
|---|---|
| two words joined | `Reedwater`, `Pinehill`, `Stoneford`, `Wolfnight` |
| a possessive | `Greta's Rest`, `Fen's Crossing` |
| an article and a phrase | `the Clay Bank`, `the Night of the Wolf` |

Chronicle lines that carry a name for the namer to use carry a `tag`: `wolf`, `fire`, `frost`, `sprite`, `found`, `death`, `birth`. The event table maps a tag and a kind to a name shape. A line without a tag is not a candidate.

## 4. Camps

| Moment | What happens | Chronicle |
|---|---|---|
| the site is chosen | `Greta's camp`, as today, as the first record with why `the camp Greta made` | as today |
| the hearth has burned three days | the namer names the camp | major: `They start to call this place Reedwater, for the reeds along the water.` |
| the camp becomes a village | the namer runs again with the village's history. The current name is a candidate at 60, so most villages keep it and gain a title | major: `Reedwater is a village now.` or `Reedwater is a village now. Its people call it Ashford, for the night the fire jumped the ford.` |
| after that | `rename(camp, record)` is the one function that changes a camp's name, and it takes a reason. Village promotion calls it. Nothing else does yet | the reason, as a major line |

A village's title is not part of its name. The interface writes `Reedwater, a village` from `camp.village`.

The three places in `camps.js` that test `camp.name === 'The first camp'` to write `the camp` instead go. A camp always has a name a line can use.

## 5. Places

- **Sectors.** A sector is named by the first camp member to finish a task in it, from the land axis and the task: `Snarewood`, `the Clay Bank`, `Fishbend`. The task's kind is a candidate at 25. Until named, the interface shows a sector by biome and direction from the nearest camp: `the meadow east of Reedwater`. The sector summary and the map foot use `describe(sector)` for this.
- **The valley.** Named when the first camp becomes a village, by that camp's namer, with the mythos axis at 40. Chronicle, major. The world map's title shows it.
- **The river.** Takes its old name when learned. Before that it is `the river`.
- **Ponds.** Named by the first person to drink from one, from the land axis.
- **Hills, caves, groves, fords.** Old names only, learned as in section 2. A living name is never given on top of an old one.

## 6. Events

An event is a chronicle line whose tag is in the event table and whose kind is `major` or `bad`: a death not of old age, a wolf raid or mauling, a wildfire that reached a camp's sector, the first sight of the sprites, a founding party leaving, a winter that took someone. The namer runs at the camp's fire on the next night, for the camp the line belongs to. The record goes on the chronicle entry as `entry.names`. Chronicle, major: `They will call it the Night of the Wolf.`

Later lines that refer to the event use `eventName(entry)` so the phrase is the same everywhere: `Nobody has slept well since the Night of the Wolf.` Which lines refer to which events is the writer's choice, line by line. The first such lines are the wolf raid, the founding, and the death lines, and they may be added later without a rule change.

Person cards that carry a named line show the name beside it.

## 7. Epithets, from one's peers

Everyone earns an epithet. An epithet is what others call you, so it is scored from the opinions others hold and from shared history. The namer for an epithet is the camp, not a person: the candidates are scored and no trait weights apply.

| Source | Candidates | Weight |
|---|---|---|
| peers | from `opinions` and `rel` across the camp: `the talker` when most opinions rose from talks, `the sour` when most fell from arguments, `the teacher` at five lessons taught, `the one everyone argues with` at three rivals | 40 plus the strength of the opinion swing |
| deeds | `firekeeper`, `wolfdriver`, `founder`, `spritefriend`, `deer-slayer`, `fisher`, `potter`, from the person's history tags | 30 plus 5 a repeat |
| life events | `born under a roof`, `twice a parent`, `walked in from the east` | 20 |
| birth | `born in a village`, `child of founders`, `first born here`, from `lineage` | 20 |
| fate | `the frozen`, `the lost`, `who died warm by the fire` | given at death, always applied, replaces the current one |

Rules:

- The first epithet is given when a person has ten days in a camp. The chronicle notes it, kind `info`: `The camp has started to call Greta the firekeeper.`
- A later candidate replaces the current one only when it scores half again as much. That is the high bar. The chronicle notes a replacement, kind `major`: `Nobody calls Sable the teacher any more. Now it is Sable the sour.`
- The epithet is checked once a day per person, at the fire, so opinion swings reach it.
- A fate epithet is given on death and is last.
- The interface shows the epithet after the name once given: `Greta the firekeeper` in rows and cards, and in chronicle lines from that day, through `fullName(a)`.

Each person gets a `lineage` record at birth or arrival: parents, the camp of birth, and the day. Newcomers carry the edge they walked in from. Nothing reads it yet but the birth source.

## 8. What the interface shows

Input to the UI plans.

- The strip and the camp tabs show `camp.name`. The Camp drawer lists former names with dates and reasons.
- Hover on any name shows its record: tongue, meaning, since, why, by, and the scores.
- The world map shows sector names, and unnamed sectors by `describe(sector)`. The world map's title is the valley's name once given.
- People rows and cards show `fullName(a)`.
- The chronicle filter gains a name search that matches current and former names.
- The help dialog has a page for the mythos: the lost people, what they built, what took them, the sky, the sprites, and the old names learned so far with their meanings.

## 9. Sim changes and testing

**New file** `src/sim/names.js`, loaded after `core.js` and before `world.js`. It owns: the record shape, the name stream, the syllable and word tables, `nameThing`, `rename`, `describe`, `fullName`, `eventName`, `formerNames`, the epithet scorer, and the mythos builder. The mythos builder and the old-name pass are one standalone function, `nameTheLand()`, that `startWorld` calls after generation returns. It is not a block inside `generate()`, so the mythos branch's settle work, which takes `generate()` apart into painters, can call the same function. `camps.js` calls the camp moments. `tasks.js` calls the sector moment when a task finishes. `main.js` calls the nightly event and epithet passes inside `updateCamps`, at the end of that function, so the world stream's order does not move.

Rules read the record. Rules do not check name text.

Two small stamps for the interface, both data: `a.diedAt`, the tick of death, set where a person dies, and the `tag` on chronicle lines from section 3, which the spoil alert reads.

**Tests.** `tests/names.js`, fast, on the soak runner:

- The same seed gives the same names twice.
- No two things in a world share a current name.
- Every old name has a meaning, and no meaning is used twice.
- Every camp with an established hearth has a plain name, and its first record is the founder's.
- Every person with ten days in a camp has an epithet. A replacement scored below the bar does not happen. A fate epithet is applied at death.
- On every soak seed, with names on, the world layout, the beings, and the items at tick 0 are byte-identical to today's fingerprint.
- Every named event's line still reads correctly through `eventName`.

The soak's golden record moves once, for the new chronicle lines, and is blessed after the layout check passes. Terrain and crafts do not move.

## 10. Seeds planted, not built

- **Conquest by politics or force.** `rename` with a reason is the only door. No rule opens it yet.
- **Nobles.** The birth source on epithets and the `lineage` record. Nothing else reads them yet.
- **Tales.** Named events are the raw material. No telling by the fire yet.

## 11. Order of work

1. `names.js` with the record shape, the name stream, and the tongue. `tests/names.js` for determinism, uniqueness, and the layout check.
2. The mythos and the old names on the land at generation. Learning, with its chronicle line.
3. The namer with the land axis and the camp moment at three days. Golden blessed.
4. The event axis, tags on the chronicle lines that carry them, and event naming at the fire.
5. Sectors, ponds, the valley, and `describe`.
6. Village naming and `rename`.
7. Epithets, `lineage`, and `fullName`.
8. `design/notes.md` gets a section on names.
