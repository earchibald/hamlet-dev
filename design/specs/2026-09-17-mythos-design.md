# Mythos: the primal gods, the field that divides, and the world they leave

Design spec, 2026-09-17. Approved in conversation. Implementation follows in plans. This spec covers the creation: the gods era, settle, watching, and the size hooks. It also fixes the determinism contract and the shape of the pieces that come after it.

## Summary

| Decision | Choice |
|---|---|
| What a god is | A being in the same `beings` list, with needs, the seven traits, skills, thoughts, opinions, a task, a history, and scored options. Its place is a region, not a tile. |
| Where gods come from | Contrasts. Five: above/below, wet/dry, hot/cold, still/moving, light/dark. Each pole is one god. The seed makes the first. Every other god is made by a lack. |
| The gods' place | A field that divides. One region at the start. Place is made by splitting. A boundary is a place of its own: the river. |
| Time in the gods era | Ages. One `step()` is one age. The first split is the Sundering and makes place. The first change to a made region is the Pulse and makes time. |
| How the world converges | Needs drive the acts. Rest gates the end: a god cannot sleep in a world that cannot hold a life. A checker names the lack, and the lack strains the next contrast. |
| From marks to tiles | Settle. `generate()` taken apart into painters, one per mark kind. Everything painted keeps its mark, so hover reads the story. |
| Gods after settle | They stay in `beings`, asleep in their bodies. They can wake. A day-era act is slow, bounded, and has a visible omen phase. |
| The player | The spark that stayed when the hot god slept. Tools appear at settle. Fire from the sky is the spark's act. |
| Determinism | The engine step is pure. Perturbations enter by one door and are logged. Seed plus log replays the run. |
| Random streams | The gods draw from their own seeded stream, so a poke never changes which god wakes. |
| Size | `startWorld(seed, options)`: width and height in sectors, and the level range. Defaults are today's numbers. |
| Architecture | An era clock inside the one engine (A), with the mythos in its own files under `src/sim/` (C's discipline). |
| Order of work | This spec first, on today's ticks. Then time and tiers (G). Then lingering gods, later gods, and made species. |
| Out of scope here | The time model (G). Later gods and belief (E). Made species beyond a fixed archetype list (D). LLM and inhabiting through the door. Digging by people. |

## 0. The determinism contract

This replaces "deterministic for a seed until the player acts" in the design notes.

| Rule | Meaning |
|---|---|
| The engine step is pure. | Given a state, the next state is fixed. No wall clock, no `Math.random`, no DOM inside `step()`. |
| Perturbations enter by one door. | `inject(event)`. An event has a tick, a source, a target, and an act. Sources: player, chance, llm, human. The door appends every event to `state.log`. |
| Replay is the test. | Seed plus log reproduces the run, line for line. An empty log is today's test. The script god's lightings in the soak are the first log. |
| The engine accepts any lawful state. | A perturbation is checked against the state invariants, never against "would the engine have done this." |
| Every perturbation is visible. | A chronicle line names the source in the game's voice. |
| The clock has modes. | Free run, as now. Locked: the engine ticks only when an inhabiting human moves. Locked is a hook now, built under E. |

Consequences:

- Marks are the one substrate for a god's scar, an LLM's whim, a camp's belief, and the domino between acts. One table with an author and a cause.
- An LLM decides in two ways: pick from a mob's scored option list (`lastChoice` already holds it), or issue an act from the operator library with a target. Nothing outside the tables can be asked for.
- Snapshots need tasks as data. A task is a closure today, and cannot be saved. Replay from seed plus log needs no snapshot, so this is not a blocker for this spec. It is the known blocker for inhabiting and mid-run tooling, and it is the save format the notes list under Next. G needs it too, since a day-tier being is handed to the tick tier mid-task.
- The two player acts, `lightTile` and `poke`, route through the door from the first plan. They consume draws from the people's stream, as they do now.

## 1. The field and the marks

The field is the whole tile grid, its size from the start options. At the start one region holds every tile and carries no marks.

A region record: `{ id, tiles (a mask over W*H), parent, by (god id), age, marks: [], neighbours: [] }`. Sectors stay as they are: a fixed grid for viewing and counting. At settle a sector takes its biome from the marks of the region that covers most of it.

A split is an act. A god picks a region and draws a boundary through it. The god's patience sets the line: patient gods draw straight, restless gods draw winding, from noise. The two children each get a pole mark for the god's contrast. The boundary is a place: the wet god's boundary is the river. A region stops splitting at sector size. A region nobody splits stays large and reads as one wide country.

A mark record: `{ kind, value, by (god id), age, why (a sentence), at (an anchor tile) }`. Ground marks (poles, height, depth, scars, flow, pool, freeze, hide, show) pass to both children of a split. Singular marks (a making, a rest, a twist) pass to the child that holds the anchor. A sleeping god's body is never split. Marks sit on regions, and after settle on tiles, hills, caves, and scars. Rules read marks. Nothing reads a god's name.

| Mark kind | Values | Written by | Read by |
|---|---|---|---|
| pole | above, below, wet, dry, hot, cold, still, moving, light, dark | a split | painters, other gods' scoring |
| height | ages spent | raise | the hill painter |
| depth | ages spent | dig | the cave painter |
| scar | burned, cut, drowned, broken, hallowed | a battle, a rage, a whim | painters, makings, tooltips |
| making | a species record | make, twist | settle, the species tables |
| rest | the sleeping god | sleep | painters, day-era waking |

Biomes come from mark combinations in a table, `BIOME_OF`, not from noise. First proposal: wet and moving is river, wet and still is marsh, dry and cold is forest, dry and dark is forest too, dry and hot is meadow, dry and light is meadow, dry and above is stony, burned is ash that greens over seasons. A dry country with a hide mark and no heat or sight pole is forest as well: trees grow where a god hides things. Noise stays for texture inside a region: where the trees stand, where the boulders lie. Noise never shapes the world.

## 2. The gods as mobs

A god is a being. `makeBeing('god', ...)` with the same fields. Extra fields: `pole`, `contrast`, `region` (where it stands), `stream` (its own seeded random function), `status` in `awake | asleep | dead | spark`. The People panel shows a god with the person's card.

**Coming into being.** The seed picks which contrast strains first, and one god comes into being, alone. Every other god is made by a lack:

- When a god splits a region, the far pole has nobody, and the counterpart comes into being to hold it.
- When the rest gate names what the world cannot hold, the contrast that answers it strains, and a god of that pole comes into being.
- When the people are lacking and every awake god is of one contrast, a new contrast strains, since one difference cannot make a people. A mingling needs two.
- Every god comes into being holding a country. The counterpart holds the far side of the split. A god born of a lack takes the largest level country, or the largest there is, and sets its pole there.

So gods are made of what the world lacks. Five contrasts, ten poles, ten gods at most. A seed may have no still god.

**Needs.** Four, on the same scale as people's: 0 to 100, low is urgent, and a need is restored by an act.

| Need | Falls when | Restored by |
|---|---|---|
| expression | the god's pole is scarce on the field | marking a region |
| company | it acts alone | acting beside a god it likes |
| rest | the field fills; there is more to hold | sleep, and nothing else |
| calm | another god marks over its region | answering the offence: a battle, or marking back |

**Traits.** The seven, as people have them. Patience draws the line. Bravery and skill decide battles. Sociability opens minglings. Temper turns an offence to wrath faster. Curiosity opens making and twisting. Diligence is the will to spend another age on the same raise or dig. Hardiness is how long it stays awake.

**Skills.** One per act kind, with experience, as people have gather and build.

**Offence.** Marking over a god's pole offends that god alone: a split or a claim offends the holder of the contrast it replaces, and a burn offends every god that marked the country. Calm recovers five points an age. A country is scarred once; rivals do not fight over it again, and the last start candidates are neither burned nor fought over while fewer than three remain.

**Relations.** Opinions move by acts. Marking over a god's region lowers its opinion of the marker. Marking a region together raises both. Above 40 they are lovers and mingle opens. Below −40 they are rivals and battle opens over any region both want. Chronicle lines name both, as for friends and rivals today.

**Life.** Primal gods enter the life table with a death mode: `killable`. A god whose pole is unmade from the whole field dies, and its death is a scar. A god withdraws by sleeping in a region, which becomes its body: the above god a hill, the wet still god a lake, the dark god a cave, the wet moving god the river. Death modes in the table, for E later: `mortal | killable | immortal | transmigrate | manifest`.

**Names.** A seeded pool of god names, and a "what it is" line: "Ondru, who is Below."

## 3. The acts and the rest gate

An act is an operator: a name, the pole that may use it, a target region, the marks it writes, the ages it takes, and a chronicle line. Acts are the only way the field changes. Gods score them as people score tasks: needs, traits, marks on the target, opinions of who marked it. An LLM or a player later issues the same acts through the door.

| Act | Pole | Ages | Writes | The painter makes |
|---|---|---|---|---|
| split | any | 1 | pole marks on two children, a boundary | the river when the splitter is the wet god |
| raise | above | 1 per storey | height on the region | a hill, a mountain when many. Not on a level country while fewer than three remain, so nobody raises the formless whole. |
| dig | below | 1 per level | depth on the region | caves, chambers, a deep. Not in a level country while fewer than three remain. |
| flow | wet, moving | 1 | a flow mark along a path across regions, above or below ground; the gate reads it as water | streams, fords, underground rivers |
| pool | wet, still | 1 | a pool mark on a region, above or below ground; the gate reads it as water | a lake, an underground lake |
| burn | hot | 1 | a burned scar | ash, firestones in the deep |
| freeze | cold | 1 | a cold mark | snow line on high ground, winter's length |
| hide | dark | 1 | a dark mark | hollows, glowing moss, what sees in the dark |
| show | light | 1 | a light mark | open ground, long sight |
| mingle | two lovers | 1 | both poles on one region | forest, meadow, the mixed countries |
| battle | two rivals | 1 | the winner's pole; the loser's mark becomes a scar | chasms, drowned forests, split hills, burned countries |
| claim | any | 1 | its pole on a country beside its home; offends the god whose pole it replaced | the country changes nature |
| make | any | 1 | a making mark with a species record | a creature, placed at settle |
| twist | any, on a scar | 1 | a twist on a making | a variant that breaks one rule of its archetype, rare in a peaceful creation, since it needs a scar. The act writes the mark and its chronicle line today; no painter reads the mark yet, so the variant itself is D, later. |
| sleep | any | 1 | a rest mark | the god's body |

Rules of the ages:

- Gods act eldest first within an age. Each god scores its options and tries the best, then the next, as people do. The scores are saved as `lastChoice`.
- Acts consume draws from the god's own stream.
- Multi-age acts are tasks. A god mid-raise keeps raising unless a need interrupts it.
- The chronicle line for every act is written in the game's voice with the god's name and the reason from the scoring. Ages are numbered from the Pulse. Before the Pulse the chronicle says "then," not "when."
- Rockfall is not an act. It runs at settle as the last thing that happened before people.

**Kinds of life.** A world that can hold a life holds each kind of it: something eaten, something that hunts, something fae, and a second people. The species table flags them: `prey` on rabbit and deer, `hunter` on fox and wolf, `fae` on sprite, `folk` on gnome. The gate wants one making of each kind somewhere; a lack of a kind strains the poles whose makings include one, and draws the making itself rather than the pole's expression. Species vary by seed within a kind: a valley with foxes and no wolves is a gentler valley.

**Making, in this spec.** Species are the seven that exist: rabbit, deer, fox, wolf, sprite, gnome, human. A making mark names one and a region. Who makes what is the `MAKES` table: wet and above make deer; hot and dry make rabbits; dark makes sprites and foxes; light makes sprites; still makes foxes; cold and moving make wolves; below makes the gnomes; a mingling makes the people. The gate wants each kind of life; the species within a kind vary by seed. `tests/ages.js` prints which species each seed made.

**The rest gate.** A god may sleep only when the checker passes. The checker, on regions:

1. A start region exists: dry, level, not drowned or burned, of at least a sector. Level means nothing raised and nothing dug: the gate reads the height and depth marks, not the height pole. The height pole alone is highland or lowland, still walkable ground.
2. A wet region or a wet god's boundary touches it or its neighbour, or water flowed through or pooled in one of them (a flow or pool mark).
3. A region within two neighbours is forest. Fuel is wood, and the day era needs wood, not only grass.
4. A making mark for something eaten or that eats berries lies within two neighbours.
5. A making mark for the people exists.
6. A height mark exists somewhere: a hill.
7. A depth mark exists somewhere: a cave.
8. A making of each kind of life exists somewhere: prey, hunter, fae, folk.

Until it passes, rest cannot be satisfied. The checker's failure names the lack, and the lack strains a contrast, and the god of that pole comes into being if it has not. Lacks `height` and `depth` strain `above` and `below`; a lack of a kind strains the poles whose makings include one. When the last awake god sleeps, settle runs.

## 4. Settle, from marks to tiles

Settle is `generate()` taken apart into painters, one per mark kind, in a fixed order. Each painter reads marks and writes tiles. No painter reads a god. Everything a painter makes keeps a reference to its mark.

| Step | Reads | What the painter writes |
|---|---|---|
| 1. Ground | pole marks, `BIOME_OF`, the boundaries | the per-biome tile texture. Every live boundary a wet god drew is river: the boundary tiles and their far-side neighbours are water, the next ring is sand, and every forty-seventh tile along the line is a ford of sand. A pool mark paints a lake in the country's middle, a blob of about a seventh of its area. Marsh is the wetland biome's own texture. A meadow, a forest and a marsh all carry berry bushes and loose stones, because the gods may put the first camp in any of them. |
| 2. The first person | the gate's start country | one person, before the scars and the heights, because `hillFits` and `rimExits` ask whether a hill opens onto the ground the first person can walk. The person takes the country's widest walkable pocket, then its tile nearest the country's middle. The start sector is not forced to meadow. |
| 3. Scars | scar marks | burned: the country's ground is ash and it has no features. cut: a chasm of rock along the country's longer axis, with a gap of stone floor in the middle so the world stays joined. drowned: three water blobs with dead pines around them. broken: boulders on a third of the tiles. hallowed: the mark is written and nothing is painted; what a hallowed country does is D, later. Nothing in `SCAR_OF` gives a god the `hallowed` scar today, so no creation produces one. |
| 4. Height | height marks | a height mark of value n paints one to three hills in the country by its area, storeys `min(n, ZMAX)`. A country whose god made a species that dens gets one low hill if no god raised it, since a den mouth needs rock. |
| 5. Depth | depth marks, flow and pool below ground | a depth mark of value n cuts caves under that country's hills, levels `min(n, -ZMIN)`, and raises one low hill first if the country has none, since a cave mouth needs rock. Underground streams and lakes where water flowed or pooled below. |
| 6. Rockfall, finds | as today | rockfall is the last step that can take a tile out of the walkable world, so the start region is walked again after it |
| 7. Creatures | making marks | each species stands in the country where its god made it. A hunter gets a den first; only what the den cannot hold goes on the open ground. Sprites take a grove of their country, gnomes their burrows. `creation.made` is the roll of what a painter spawned, and nothing off that roll wanders in later. |
| 8. Bodies | rest marks | the sleeping gods, after the tile check passes |

**The guarantee.** The gate checks regions every age, which is cheap. Settle checks tiles, which is the real test. From where the first person stands, by a real path search over the whole map, five things must hold, in this order:

1. `water`: a water tile beside some tile in reach.
2. `ground`: a passable tile with no feature, not sand, within 12 tiles.
3. `fuel`: a tree, a bush, or a loose stick in reach.
4. `food`: a berry bush with berries, or a prey being, in reach.
5. `room`: the person can walk at least half the passable tiles of the country the gate chose. The gate reads marks, so it cannot see that a lake or a chasm has shattered the ground under its start country. A pocket is not a home.

If the tile check fails, the settle is discarded: `levels`, `world`, `raised`, `hills`, `caves`, `groves`, `items`, `itemGrid` and `sectors` are reset, every being that is not a god is removed, and the god who lay down last stands up with rest 60 and the thought "The world would not hold." Its rest mark is struck, so its country can be marked again. The era stays `gods`, so the ages go on. `creation.discards` counts. The people's stream stays where the failed paint left it, so the next paint differs; that is deterministic and acceptable. One creation may throw its valley back `MAX_DISCARDS` times (a constant in `settle.js`, 8); the next settle is kept whatever it lacks, so a shaky world cannot repaint for ever. A settle after a failed creation is final in the same way, because no age is left to mend it, and both write one legend that says the world was settled unfinished and what it lacks.

As a backstop only: past an age limit (a start option, default 200), the eldest awake god performs the missing act itself, and the chronicle says "Wearied, she did what had to be done." The tests assert the backstop fired on none of the six seeds.

Settle sets `era = 'days'`, `tick` to today's start hour, and writes today's first line: someone walks alone into the meadow.

**Level range.** `ZMIN` and `ZMAX` come from options. Default −2 to 2. The painters make as many storeys and levels as the marks ask for, capped by the range. The terrain test reads the range.

## 5. The day era with lingering gods

The day-era tick runs unchanged, in the same order. One step is added at the end of `updateWorld()`, `godsTick()`, so nothing before it shifts. Gods draw from their own stream.

- **Bodies.** A sleeping god's body is a hill, a cave, or a country record. The god holds `g.body`, and the record holds `body.god`, the god's id. Above sleeps on its country's tallest hill at its top storey, below at a cave's deep tile, wet on a river tile, still on a lake tile, and any other at the anchor of its rest mark. What each needs free differs: above and below need only the hill or the water cave unclaimed, since one country can hold several of each, while wet and still need their own country unclaimed as well, because the river tile and the lake tile stand for the country itself. One body holds one god: a god whose own country is already taken lies down in the nearest free country by its rest anchor, and when no country is free it lies down in no body at all. Tiles never carry a god. Dead gods stay in `beings`.
- **Tempo.** A sleeping god steps once a day. Rest is full. Calm falls from facts the rules already know, passed as thoughts: a rock face quarried on its hill, an axe in its dark country, fire on a hallowed tree, a lake drunk down. Calm below 20 wakes it.
- **Acts with omens.** A waking god's act is the same operator, run as a multi-day task with two phases. The omen phase is first and visible: the river rises a tile a day; the hill shakes and the chronicle says so; the sky is dark at noon. People get thoughts. Then the act lands on a bounded region, never the whole field. A god that acts spends rest and sleeps when it has none.
- **Deaths.** The soak gains one allowed cause: an act of god, allowed only when the chronicle shows an omen for it in the days before. A drowning with no omen is a bug.

Numbers here are first guesses. The tempo in real years is G's to set, and this section is expected to be retuned when G lands. It is built after G, not in this spec's plans, except for the bodies, the stream, and the `godsTick()` slot, which are built now so the soak fingerprint moves once.

**The player.** The spark is named in the creation chronicle when the hot god sleeps: "A spark stayed." The player's tools appear at settle. `lightTile` and `poke` go through the door.

**Hooks for E.** Marks carry an author. Rules pass facts to gods as thoughts. The life table has the death modes, including `manifest`: a god born or reborn out of a mob, destroying it. Inhabit modes for the register: Become, Possess, Vessel, Manifestation.

## 6. Watching the creation

- The gods era uses the same UI loop at a slower pace: one age every two seconds, a pace control, and a hurry button that runs to settle.
- The world map shows the field: one grey region, then boundaries, then poles as colour, then scars. The location view is closed until settle.
- The chronicle runs from the first age in the game's voice. The People panel lists the gods with the person's card: needs, thoughts, opinions, last decision scores. The goals panel is empty in the ages.
- At settle the day-era interface appears.
- After settle, hover reads marks: a hill's card says who raised it and why; a chasm's card says who fought over it; a sector's card names its country and the god whose pole made it.
- A legends panel lists the creation chronicle by age. It never scrolls off.

**As built.** The pace control is the four speed buttons. In the ages they set `pace`; in the days they set `speed`. The ages wait while any dialog is open, so the creation does not run behind the start dialog. `H` hurries the ages to settle. The People drawer lists the gods, and the Goals drawer says the valley is not made. The Legends drawer is key `5` in both eras. In the days, `C` shows the countries over the world map. Pace and hurry do not pass the door: they change how fast the story is watched, not the story.

## 7. Size and the hooks

- `startWorld(seed, options)`. Options now: `sw`, `sh` in sectors, `zmin`, `zmax`, `ageLimit`. Defaults: 10, 6, −2, 2, 200. The constants `SW, SH, W, H, ZMIN, ZMAX, ZOFF, NZ` become variables set before the field is made. The golden holds on defaults.
- `design/settings.md` is the register. One line per start option and per future setting, with its owner, its state, and the spec it belongs to. Sizes now. Pace under this spec. Zoom and breakpoints under G. The inhabit modes under E. A line is added the day the hook is written.

## 8. Tests and the record

The soak keeps its shape: six seeds, seventy days, assertions, a golden fingerprint. It gains the ages in front.

Per seed, on the creation:

- The ages end before the age limit, and the backstop fired zero times.
- The tile check passes by a real path search.
- Every hill, cave, scar, and biome carries a mark, and every mark names a god that exists in `beings`.
- Every god is asleep, dead, or the spark. No god is awake at settle.
- Every made species has at least one living member at settle, and the people are one person.
- The creation chronicle is in the fingerprint.

Per seed, on the days, three changes:

- The fixed shape goes: no assertion of one river, six to ten hills, or three groves. The tile check replaces it.
- Deaths gain the act-of-god cause, allowed only with an omen before it.
- Replay: seed plus log tells the same story twice, with the script god's lightings as the first log.

`tests/terrain.js` keeps every level rule and reads the range from options. `tests/crafts.js` is untouched. A new `tests/ages.js` runs many seeds to settle only, fast, and prints the age count, the god count, the backstop count, and which contrasts appeared. It is the tuning tool for the grammar.

The golden moves once, when settle replaces `generate()`, and is blessed then. Time budget: 25 seconds per seed in the soak, ages included.

## 9. Files

| File | Holds |
|---|---|
| `src/sim/field.js` | regions, masks, splits, boundaries, neighbours |
| `src/sim/marks.js` | the mark record, `BIOME_OF`, mark queries |
| `src/sim/gods.js` | the god mob: tables, needs, scoring, the acts as `START` entries, the rest gate, `ageStep()`, `godsTick()` |
| `src/sim/settle.js` | the painters, the tile check, the flip to days |
| `src/sim/door.js` | `inject(event)`, the log, the sources |
| `src/sim/world.js` | loses `generate()`; keeps tiles, items, the painters' helpers |
| `src/sim/main.js` | `startWorld(seed, options)`, `step()` dispatching on `era` |
| `design/settings.md` | the register |

Load order: `core.js` first, then `field.js` and `marks.js` before `gods.js`, and `beings.js` and `species.js` before `gods.js`, since gods add acts to `START` and a row to `LIFE`.

## 10. Phasing

| Plan | Delivers | Done when | State |
|---|---|---|---|
| 1. The door and the options | `inject`, the log, the replay test, `startWorld(seed, options)`, variables for size, the register. | Soak green on defaults, fingerprint unmoved. Replay test green. | done |
| 2. The field and the gods | Regions, marks, the god mob, the acts, the rest gate, `ageStep()`, `tests/ages.js`. No painting yet: settle calls today's `generate()` and discards the marks. | Ages end on every seed in `tests/ages.js`. Soak fingerprint unmoved. | done |
| 3. Settle | The painters replace `generate()`. The tile check. Bodies, the gods' stream, the `godsTick()` slot. Creation assertions in the soak. | Soak green. Golden blessed once. Terrain test green on the range. | done |
| 4. Watching | The era in the UI, the field view, the legends panel, hover on marks, pace and hurry. | The built page shows a creation and a playable valley on the dev server. Design notes updated. | done |

## Later

- G: time and tiers. A one-second tick, real years, day and season tiers calibrated from the tick tier, deterministic zoom both ways, breakpoints on a watch list, tasks as data.
- E: later gods. Born of side effects or of belief. Lives and deaths in real years. Manifestation. The four inhabit modes through the door.
- D: made species. Archetypes fixed, variants seeded, twists on scars, minglings natural, magical, or forced.
- The player as a primal god, acting in the ages through the door.
- An LLM as a source at the door.
- Digging by people.
