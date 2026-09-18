# Hearth: design notes

These notes are the record of the design so far, written for whoever works on the code next. They cover what exists, why it exists, the numbers that were tuned by testing, and the bugs that were found and fixed. Read them before changing the core.

## 1. The idea

Dwarf Fortress does not simulate everything. It simulates a few things in depth and lets them touch. Stories come out of rules that collide. No rule knows the story.

The design question is not "what features do I want?" It is "what state do the systems share, and which rules read and change it?" Two systems that never read the same data never interact.

The game is played by a god-player. The player does not tag tiles or give orders. The player sets goals, gives fire, moves the camp site before it is built, and pokes people. Everything else is autonomous. Everyone with a mind is a mob, people included, and every mob has a reason to exist and a process of existence.

## 2. Scale

Every world begins with its creation, not with noise. A field of countries is split and marked by the primal gods, age by age, and a mark is a record on a country: a pole, a height, a depth, a scar, a making, a rest. A god may sleep only when the rest gate passes on the marks: a dry level start country, water beside it, a forest within two neighbours, the people made, a hill, a cave, and each kind of life. When the last god sleeps, settle paints the valley from the marks, painter by painter, in a fixed order. Settle then checks tiles, which the gate cannot: from where the first person stands, by a real path search, water, ground, fuel, food, and room to walk the start country. A valley that fails is discarded, the last sleeper wakes, and the ages go on. A creation may discard eight valleys; the ninth is kept whatever it lacks, as is the settle of a creation that ran out of ages, and a legend says the world was settled unfinished. The spec is `design/specs/2026-09-17-mythos-design.md`, sections 3 and 4.

- The world is 10 by 6 sectors. Each sector is 28 by 20 tiles and takes its biome from the country that covers most of it: open meadow, pine forest, stony ground, reedy marsh, riverside, burnt ground. A sector is a mix. A meadow, a forest and a marsh all carry berry bushes and loose stones, because the gods may put the first camp in any of them. Before the mythos the camp always stood in a meadow. The loose rock is what fixed the camps the gods put elsewhere: a forest with no rock could not build its fire pit or knap its axe, and the camp starved. The berries are texture for a camp in the trees, not the cure.
- The tile grid is continuous. Sectors are units of identity and viewing, not of simulation. A person walks out of one sector into the next.
- A river winds across the world. Fords every 47 tiles keep the sides connected.
- The world has five levels, −2 to +2. Level 0 is the surface. A level is an array like the surface, mostly empty: open air above, solid earth below. A hill is rock at level 0 with a floor of stone or grass above it. Hills come from three marks, so their number is a seed's own: a height mark raises one to three hills in its country, by area; a depth mark raises one where its country has none, because a cave mouth needs rock; and a making of a species that dens raises one for the den. The six soak seeds carry five to eighteen hills, and a hill stands in whatever biome its country holds -- meadow, wetland, forest or rocky -- not only on rocky and forest ground. Storeys come from the height mark, capped by the level range, so a hill is one or two storeys tall today. A hill is only raised where it can be climbed: its first-storey floor is one piece, and some walkable tile beside it can hold a slope. Each storey has one or two slopes on its rim. Everything else is cliff.
- Slopes are the only way between levels. From a slope you step to any of its four neighbours one level up, and from those you step back down onto it. Rabbits never climb. Deer climb hills. Everyone else goes anywhere.
- Water caves come from depth marks. A depth mark cuts one under each hill of its country, `min(the mark, -ZMIN)` levels deep, so one or two levels today. A stream cut a winding passage from under the hill to a mouth at the foot, with a chamber or two, and a drop with a chamber for each level below the first. The stream still runs where a flow mark or a pool mark lies under the country, and there it leaves a pond at the mouth. Rock fell after: boulders at the feet, and one passage in four blocked by fallen rock until someone has tools. Every cave exit opens onto the ground the first person can walk to, and hills only stand beside that ground. The passage is a walk of 8 to 20 steps, fewer where a small hill boxes the walk in. A boxed walk goes back along the spine and branches from the last tile with room, and the deep chamber lies at the walk's farthest point from the exit.
- Settle runs its painters in one order: sectors, ground, rivers, lakes, the first person, scars, hills, caves, rockfall, the items list, the finds, the creatures (dens, groves, burrows, then the animals on open ground), and last the gods' bodies. The first person goes down early because a hill's footprint and a cave's mouth both ask whether they open onto ground that person can walk. Finds go after the items list exists, and a hollow has no deep chamber, so the order of finds and groves does not matter.
- Foxes and wolves dug dens into the hillsides: pockets of two to six tiles inside the rock, or burrows under a slope. Each has one mouth. The wolf pair and the three foxes start at home and remember it. No den or hollow tile sits beside another cave's tile on its own level or the levels above and below, so no two caves join through a slope.
- Every deep chamber holds one find: firestones, glowing moss, or old bones. Gathering never goes below the surface. Fetching a find is a later goal.
- Below the surface there is no rain, the warmth falls at the spring-night rate all year, and it is dark. A person down there without a burning ember cannot see to work: their task fails and they feel their way out at half speed. Foxes, wolves, and sprites see in the dark.
- Distance between beings adds six tiles per level apart. A wolf on a hilltop is not near a person at its foot.
- Fire burns on every level and is half again as likely to run uphill over a slope.
- Long walks use a full-map search once and follow the first 48 steps, then search again. A step-by-step heuristic was tried and walked into dead ends around lakes for weeks. Do not bring it back.
- The path search marks visited tiles with a generation counter instead of clearing the visited array. This cut run time by a third.

## 3. Materials and tiles

Materials are data: fuel and flammability. Ground, features, items, and structures read these. The fire rule reads flammability and fuel. It does not know what a tree or a pit is. A wood wall burns because wood has fuel. A stone wall does not. Two grounds are terrain: rock, which nothing walks through, and stone, a bare floor. Passability reads the ground table's walk flag.

Tiles hold ground, a feature (tree, sapling, bush, boulder, reeds, hollow pine), loose items (sticks, rocks, logs, carcasses, moss), a structure (fire pit, snare, lean-to, hut, storehouse, drying rack, offering stone, ward post), fire, and an age for plants.

## 4. Time

- 1000 ticks per day. Night is 20:00 to 06:00.
- Four seasons of 8 days. Spring, summer, autumn, winter.
- Storms every few days, lasting 150 to 450 ticks. Rain slows wildfire to almost nothing, burns the pit 1.5 times faster, soaks anyone not under a roof, and carries the only lightning.
- Lightning strikes in the 3 by 3 block of sectors around a camp. With the hearth out, about once in 2.5 days. With it lit, rarely. A struck pine smoulders for 240 ticks so people have time to fetch an ember.

## 5. Minds

Every being has: needs that fall over time, seven traits, skills with experience, thoughts with a value and a time limit, opinions of others, a task, a personal history, and the scored option list from its last decision.

Decisions use utility scoring. Each option gets a score from needs, traits, and goal offers. Try the best first. If it cannot start, try the next. Save the scores and show them to the player. This is the most useful debug tool in the project.

Needs by species:

- human: food, water, rest, company, warmth
- rabbit: food, rest
- deer: food, water, rest
- fox, wolf: food, water, rest
- sprite: glow, mischief, rest

Traits, 0 to 1: bravery, sociability, diligence, temper, curiosity, patience, hardiness. Traits drift one or two points per event. Arguments raise temper. Good talks raise sociability. Skill levels raise diligence. Maulings and burns lower bravery. Driving off a wolf or spearing a deer raises it.

Skills: gather, build, cook, trap, craft, woodcut, hunt, wary. Animals use hunt and wary. Curiosity speeds learning. Two people sitting by the same fire pass skills when one is two levels ahead. Elders teach twice as fast.

Urgent needs interrupt work. A need task in progress is never interrupted by another need. A person with two urgent needs once flipped between drink and eat every tick and died next to water. Sitting by the fire is the one exception: a person low on food or water is sent to eat or drink even mid-sit, because sitting restores neither, and a person once starved that way. The search for water stopped after 3000 tiles, and a camp founded 59 steps from the nearest river let two people die of thirst beside a full stash; a failed near search now walks the whole world once and covers the first stretch, as legPath does.

## 6. Daily rhythms

- Rabbits and deer move at dawn and dusk, 05:00 to 09:00 and 16:00 to 21:00.
- Foxes, wolves, and sprites move at night.
- People work by day and sit by the fire at night.

## 7. Life clocks

Days: rabbit 3 adult, 14 old, 20 life. Deer 8, 36, 50. Fox 5, 26, 36. Wolf 6, 32, 46. Human 16, 60, 84. Sprite 10, 150, 200.

Young do half the work and are kept from hunting, guarding, felling, and founding. Old work at 70 percent and teach well. Past the span, each day is a gamble weighted by hardiness. A person who dies by a lit fire "dies in their sleep, old and warm."

Births: spring or summer, a roof, the stock food goal met, two adults who like each other at 35 or more, and 16 days since either last had a child. The child blends both parents' traits. Rabbits breed when two adults are within 10 tiles in a warm season. Fawns come in spring. Foxes and wolves wander in from the world edges. An arriving wolf or fox joins the nearest den of its own kind that still has room for a breeding pair. Wolves and foxes bear one young in their den each spring when two grown owners live there. Arrivals from the world's edge are half as frequent. Nothing the gods did not make wanders in: a species arrives from nothing only if a making mark named it, and `creation.made` holds that roll.

Plants: bushes are seedlings for 3 days, slow after 48, die after 60. They seed adjacent grass in spring and autumn at 1.2 percent per sample, and never next to another bush. Pines start as saplings, become trees after 12 days, and old pines fall in storms. A sapling becomes a solid tree only if the open tiles beside it still touch each other around it once it is solid. A sapling also does not become a tree under a standing being. Before this rule, saplings sealed one-tile gaps in dense forest. Two woodcutters were shut in pockets by the river and the world's edge, and one starved and one died of thirst, each two tiles from the tree that closed the way. The tile card says when a sapling is held back. Generation spreads bush ages over 60 days. A first draft gave them all similar ages and every bush died in the same week, which starved four camps.

## 8. Camps and goals

A camp is a list entry: site, pit, stash tile, stash counts, tools, structures, snares, favour with the fae, and a founding tick. Goals are per camp. A goal has a state (blocked, active, idle, done, locked) and offers work. Standing goals are marked "ongoing" and never finish. The player sets each goal to off, on, or high.

The chain, in the order camps reach it:

1. Make camp. The first person scores a site on water, fire safety, berries, bare ground, distance from sector edges, stone within 12 tiles, and distance from an un-cleared wolf den within 20. Stone close by scores +8. A wolf den too near scores −15. The site must be reachable from where they stand. The chronicle says why.
2. Build a fire pit. 6 loose rocks, 8 loose sticks. Builder clears the grass around it, so the pit is contained.
3. Keep the fire burning (ongoing). Fuel 400, burns 0.25 per tick, a stick is 50, a log 140. Feeds logs first. Relights from: the player, a carried ember from a nearby blaze (420 tick life), glowing moss, or firestones.
4. Keep the hearth three days without a break. Opens tools.
5. Stock food (ongoing). Target 6, 12 in autumn, 10 in winter, plus storehouse and head count.
6. Set snares (ongoing), up to 4. Sites score bushes, rabbits within 12, and distance from other snares. Catch chance is set by the trapper's skill and patience.
7. Cook what we catch (ongoing). Rabbit: 3 meals and a hide. Deer: 5 meals, 2 hides, 4 smoked strips with a rack. The goal state counts deer as well as rabbits. While it counted rabbits alone the goal stayed idle, an idle goal offers no work, and a speared deer lay uncut in the stash while the camp starved in winter.
8. Knap a stone axe. 2 rocks, 1 stick. Opens logs.
9. Find firestones. 3 rocks and luck. A camp with firestones relights its own pit. It fails often.
10. Cut firewood (ongoing), aim 4 logs.
11. Make a spear. Opens deer hunting.
12. Build a lean-to. 4 logs, 10 sticks. Sleeps three.
13. Build a drying rack. 6 sticks. Smoked meat never spoils.
14. Raise a storehouse. 6 logs, 8 sticks. Food keeps twice as long. Wolves cannot raid it.
15. Build huts (ongoing), up to four. Built when people outnumber beds. While people sleep outside, one hide is held back for the hut; the waterskin and clothes wait for the next one. Short of a hide, the card offers to set a snare for a hide.
16. Sew a waterskin. 2 hides. Then keep water at camp.
17. Become a village. Storehouse, two huts, eight people.
18. Found a second camp. Roof, five people, eight days old, spring or summer, at most six camps. Two people leave with coals that last six days.
19. Search the caves, water caves only; a den must be cleared, not searched, so that row is the `dens` goal below. A brave adult with hp 60 or more, the spear, and a lit pit takes a brand and walks to the deep chamber. Fallen rock is cleared with the axe first. A cave is claimed the moment its search begins, so a second person gets no offer on it while the first is still in the dark, and the claim clears if the searcher is interrupted or dies. It counts as searched only once the find, or empty hands, reaches the stash, not when the deep chamber is reached: an interrupted search leaves nothing found and the offer open again. The find comes home: firestones become the camp's tool, moss goes to the stash, bones give a chronicle line and a thought. The brand lasts 420 ticks; the dark rule is the danger, not death. In the soak, searches fired on three of six seeds, with no death.
20. Clear a den. Two brave adults with hp 60 or more, brands, and the spear drive the owners out. The leader may take one bite at the mouth. Owners dig a new den on another hill within three days. They come back to the old den when the camp's fire has been out a whole day, homeless or not. An arriving wolf never joins a den the camp holds. The sprites' hollow is not a den. Each den's offer carries the den in its label, so a den that fails to clear does not cool down every other den too.

Crafts after the village are data. A recipe in src/sim/recipes.js names what it needs, where it is made, and what it makes, and one builder turns it into a goal. The panel shows recipes after the hand-written ladder: gather fibre, twist cord, build the workshop, weave a basket, make a fishing rod, fish the river, sew hide clothes. Work at the workshop goes 1.3 times as fast. A basket carries three more. A fish cooks to two meals or smokes to two strips. Hide clothes cut the wearer's warmth loss to 0.6. Then: dig clay from the bank, build the kiln, fire pots (each pot holds six more drinks at camp, and with a pot berries keep twice as long), plant a garden of four bushes from cuttings, dig up to two deer pits (a pit is dug only where a deer is within ten tiles of a bush at dig time and within thirty tiles of the camp, and it catches one deer in eight that steps in, and the camp hauls it home), and quarry stone from a rock face within thirty tiles. The first face opened on a hill with a hollow costs ten favour, paid once per hill.

A recipe carries an `offerLabel` for the goal panel and a `status()` for its own progress text. Places to work are a `PLACES` table, each with a spot finder and a work speed. Makers are a `MAKERS` map keyed by what the recipe makes, one function per finished thing. A recipe's maker runs before its inputs are consumed, so a maker that cannot act consumes nothing. A recipe short of an input that another recipe makes is blocked until that recipe runs; short of a raw input, it offers to gather instead. Gathering logs fells a tree when no loose logs remain on the ground.

Fishing stops once the food goal is met. A raw fish counts as two meals toward the fishing goal only; the stock food goal, births, and newcomers count cooked and smoked food and berries. The chronicle notes fish milestones, not every catch, so the log does not fill with one line per fish. Fishing once halved every camp's population because raw fish did not count as food: people kept fishing past the point of plenty and the food goal never read as met, though the camp was fed. The soak now asserts the camps grow, so this kind of regression stays red instead of green.

A camp takes a newcomer or bears a child only while the stock food goal is met. Beds alone let a village grow to twenty mouths, and winter, when the bushes are bare and nothing can be gathered, then starved them together.

Spoilage: cooked meat 1800 ticks, berries 3500, doubled in winter and doubled by a storehouse. Smoked meat keeps.

## 9. Fire as the loop

Fire is the thing the player is for at the start, and the thing that people learn to make for themselves. The order of independence: the player, then lightning and embers, then the sprites' moss, then firestones. Do not remove the early dependence. It is the reason the player pays attention.

The player's tool is Lightning. On the pit, it lights the fire. Anywhere else, it strikes like the sky's own lightning: a pine smoulders, its fire at least 240, long enough to fetch an ember; grass burns; bare ground does nothing.

## 10. Danger

- Wolves hunt rabbits, and deer in winter, carrying a rabbit kill home to eat in the den when the floor can be reached, and eating it where it fell when it cannot. At night a hungry wolf raids a camp whose fire is out and takes meat. A lit fire keeps wolves at eight tiles. A brave person with a firebrand chases a wolf off, and it avoids that camp for a while.
- A wolf will attack a person who is alone, at night, away from a lit fire, not holding fire. All four together. It has happened twice in 420 camp-days and nobody has died of it.
- A wolf or fox in its own den bites any person on the den's floor, by day or night, with or without a brand. This is the one exception to the four conditions above. The bite is one a den every 150 ticks, shared by every owner in it, not one an animal: two grown owners standing together cannot both bite the same person in the same tick. The soak allows one such death a seed and reports it. Clearing a den sends people onto its floor on purpose; it has not yet fired as a death in any soak seed.
- A den-bite death cause expires 600 ticks after the bite. An old bite is never blamed for a later, unrelated death.
- A camp can clear a den with brands and the spear. The party keeps both brands lit until it is home at the stash; the den mouth is often a level down, and letting go there once left the whole party in the dark. The owners it drives out dig a fresh den elsewhere within three days if they can, waiting 500 ticks to try again after a hill refuses them; those without a den flee, or, where nothing threatens them enough to flee from, walk off to open ground well clear of the mouth. If the camp's fire goes out for a whole day, the den reverts: it takes back owners who already redug and owners still without a den, whichever the fire failure catches. An arriving wolf or fox never joins a den the camp holds. The guard goal never chases an owner it just displaced back into the den it was driven from while that owner's raid cooldown runs; chasing it there was a livelock, not a fight.
- Cold. Warmth falls at night and in winter, faster in rain, slower under a roof and for the hardy. Below 30, a person drops work and goes to the fire. Below 20 they take damage.
- A camp whose fire is out and holds no blaze, moss, or firestones sends its people for firestones before firewood. A lone camper once froze to death over six days at a dead pit, because every warmth rule needed a lit pit and nothing raised the priority of getting a source.
- Sprites. See below.

## 11. The sprites

Three groves. Each is a hollow pine in a deep forest with three sprites. Sprites sleep by day, dance at night, forage berries, and are drawn to firelight from up to 90 tiles away.

A grove on a forest hill lives in a hollow under the hill instead of a pine: a pocket in the rock with the hollow on its innermost tile and a mouth at the foot. A person who stands in the hollow costs the camp 5 favour every 300 ticks, and the sprites remember who came in.

- Produce: glowing moss, near the hollow, and on the offering stone of a favoured camp; cord on the offering stone at favour 40 or more.
- Want: berries left on an offering stone. Old pines standing.
- Hate: axes in the grove sector (-15 favour, +25 grudge on the person), snares in the grove sector (-2 a day), wards (-10), being struck.
- Favour is per camp, -100 to 100, drifts toward 0. Above 30: bushes near camp get extra berries, snares catch 10 percent more, the pit burns 15 percent slower. Below -20: pranks; a pot, cord, or the basket goes missing. Below -60 or a grove out for revenge: the fire gets pinched out.
- Theft of a made thing happens only when favour is below -20, as pranks are, and is then gated at one chance in two behind the ordinary prank roll. In the soak, seed x lost nine made things in 70 days while the other seeds lost none or one.
- A killed sprite: grove anger +60, five days of blight on the bushes near the nearest camp, and the grove comes back in a group.
- Fight or run: a struck sprite with bravery above 0.6 and health left bites. Otherwise it flees, marks the camp, and returns with kin a day later.
- A grove bears a new sprite in spring if calm and surrounded by 25 old pines.
- First sight: a person awake near a watching sprite, or someone walking into the dance at night, or footprints in the ash after a prank on a camp that never met them.

Protection: the offering stone (2 rocks) and ward posts (6 charred sticks, sprites keep 9 tiles from the fire, costs favour, blocks gifts as well as pranks). People build wards only after favour has gone bad.

## 11a. The gnomes

Gnomes are a second people, hidden from the player until seen. They never attack.

- **Home.** One to three burrows a world, all of them inside the country where a god made the gnomes. That country asks for two or three and gets what it has room for. They are dug like fox dens, under the meadow edges of that country that lie beside a forest or hold a hill; when the country reaches no such meadow, any sector of it where things grow will do. Each burrow is at least 25 tiles from the start sector. Two or three gnomes to a burrow. A burrow sits at level −1 with a slope at its mouth, and a mushroom patch of 4 or more tiles covers the soil around the mouth. Gnomes start aged 20 to 35 days, live 110 days, and have no births: a burrow's line of gnomes only shrinks.
- **Hours.** Asleep in the burrow from 06:00 to 19:00. Out from dusk to dawn. They tend the patch every night, not only when hungry.
- **Needs and food.** Food, rest, and company. Mushrooms on their own patch regrow at a chance of 0.3 a sample and give 35 food each. Gnomes also eat wild berries. They never eat meat, and never take from a camp's stash.
- **Company.** A gnome near its kin huddles with them, the way sprites do.
- **Copying.** A camp workshop within 40 tiles gives an unbenched burrow a bench of its own within a few days: a one-in-three chance every 500 ticks. Chronicle: "Small tools clink under the meadow at night."
- **Borrowing.** With a bench, at night, a gnome takes one made thing at a time from an unwarded camp stash within 40 tiles: a pot, then a coil of cord, then the basket. It returns two days later with a gift beside the taken thing: cord, clay, or a pot. A burrow does not borrow again for six days after a repayment. The cave's `holding` field stops two gnomes of the same burrow from both borrowing the same night, a race a soak run once caught.
- **Leaving.** A village within 30 tiles, or two disturbances, is too loud. Three days later the gnomes dig a new hole 50 or more tiles from every village and move in, carrying their bench, debt, and repayment timer with them. The old hole stands empty and abandoned, and a player can still inspect it. The on-demand dig tries one sector a call and retries every three days if it finds no room.
- **Neutral.** Gnomes never attack. They flee a brand within 5 tiles and a wolf within 6. They ignore sprites, and sprites ignore them. A gnome at home never bites: the den defence rule reads a `bite` row from the species table, and gnomes have none.
- **Seeing them.** Glyph `g`, mushrooms `ɸ`. Tooltips on the being, the burrow, and the patch. A person awake near a gnome in gnome hours writes the first-sight chronicle line. A camp can also come to know of gnomes from footprints left after a borrow. The goal card "The hidden neighbours" tracks what a camp knows, counting only the burrows within 60 tiles of the camp's site.
- **Repay after a ward.** A repay still returns the thing to a camp warded after the borrow: the debt is never stranded there.
- **What the soak counts.** Gnomes alive at day 70, gnome deaths (must be zero), `campsThatSawGnomes`, benches, borrowed, repaid, and `gnomesLeft`.

## 12. Founding and travel

Newcomers spawn only at world edges from which the camp is reachable, and never in winter. They walk to the camp; camp-based actions (eat at the stash, sleep in the hut) require having arrived. Founding parties leave in spring or summer with coals. `foundingSites()` names every sector in a biome where things grow that holds the fire pit's rocks and sticks and some water within the sector and its four neighbours. `startFoundCamp` then keeps only the sites three or more sectors from every camp's site and inside the region the party can walk, and takes the nearest of those.

## 13. Interface

The interface is `src/ui/`, plain scripts in one scope joined by `src/ui/index.js` after the sim. `derive.js` and `keys.js` touch no DOM and run in Node under `tests/ui.js`. View state changes in `actions.js`, where keys and clicks both end, with three recorded exceptions: the window drag handler in `windows.js`, the palette's own list state in `dialogs.js`, and the cursor and hover set by the pointer handlers in `main.js`. The design is `design/specs/2026-09-17-ui-rethink-design.md`.

- The page fills the window. The strip on top has a world half (clock, season with days to the next, weather) and a camp half (the camp's name and tabs, gauges for hearth, food, water, and beds, and alert chips). Pause, step, hour, speeds, and help sit at the right.
- Alerts read state each frame: fire, cold, food, water, threat, sprites, and event pulses from major chronicle lines and goals that open. Only a day-era line pulses. The creation writes a chronicle of major lines, all at tick 0 and all carrying an age, and they are the story of the world, not news from the camp, so they are never chips. Chips are numbered. Mutes are per type, per camp or everywhere, and persist.
- The map fills the rest. Three views: sector at 26 px, nearby at 9 px, world at 3 px. M cycles them. The tools and the view buttons float top left. The foot shows the newest chronicle line when the chronicle drawer is shut.
- Four drawers on the right edge: People (trouble first), Goals (by stage, done and idle folded, a blocked goal hidden until its prerequisite is done, A shows all), Chronicle (all or major), Camp (the stash, tools, favour, animals). Keys 1 to 4 toggle them. Tab cycles focus, Esc returns it to the map, arrows move the row, numbers pick, Enter opens, Left and Right set a goal's priority.
- Goals carry a `stage` and an `after`. `stageReached` says whether a stage shows. Both are data.
- The hover card is as before. The pinned card is gone; the inspector window took its place, and the dead `tipPinned` state went with it.
- A tile cursor lives on the map. Arrows move it, Shift by five, Ctrl by a sector. Enter applies the tool. Home goes to the hearth, W to the world map at the camp. The mouse moves it too. The foot names what is under it.
- Tools: Inspect is the default. Light fire and Nudge are one-shot and return to Inspect. Shift with the key or the click keeps them. Camp site left the interface; `setSite` stays in the sim for tests.
- Every act the player makes goes through the door, `inject()`: the `light` act and the `poke` act behind Nudge, and the `priority` act behind a goal row. Speeds run 1, 4, 16, 64.
- Nudge's reply names the person's chosen goal: it says who they go to, or that they get to it when no choice was made yet.
- Floating windows: any drawer pops out with O and docks back with O. Enter or a click on a being or tile opens an inspector window; up to six stand at once, each live, F follows. Positions persist.
- Alert chips: Alt+number jumps to the cause, Shift+Alt+number opens the mute menu: this chip, this kind here, this kind everywhere. Muted chips are listed in help and in the palette as Unmute rows.
- Cmd-K or Ctrl-K opens the command palette: every action with its key, and rows for people, goals, camps, sectors, chips, and mutes. G opens the stage chord.
- The feedback pass, first round. The dispatcher tries the focused rows first, then the `any` rows, so the order of `KEYMAP` no longer decides a clash. Shift+F in a window follows, and does not stick Light fire; that row is `quiet`, which keeps it out of help. `focusStep` does nothing under a dialog. A new inspector takes the first free slot from the saved rect, so a reopened one never covers an open one. A sector opened from the world or nearby view keeps the hovered centre (`cursorInSector`). A name matches whole words only (`namesIn`), so a prefix pair cannot misattribute a chip or a chronicle row. A mute reads as a sentence (`muteLabel`) in help and in the palette. A drawer with `fit` in `DRAWERS` (People, Camp) is as tall as its rows, up to 40%; Goals and Chronicle share the rest. The caves and dens goals say so when a cold fire is what blocks them.
- The gods stay in the world after the ages. A sleeping god is a being like any other, so the interface says so plainly: its own colour from `--map-god`, its own star glyph on the maps where every other sleeper draws a `z`, its own inspect card (name, epithet, what it became, where it lies, and the legends it stands in), and its name with its epithet in the sector summary, apart from the animals. A nudge is refused at the door: what wakes a god is its own rule, and it is not built yet.
- A drowned country's dead pines draw `†` in the ash colour, and the tile card names them from the `FEATURES` table.
- Every clickable thing has a key, printed on it. `tests/ui.js` fails on a button without one. Movement keys are provisional; change them in `KEYMAP` only.

## 14. Testing

`tests/soak.js` runs 70 days on six seeds (r, x, alpha, beta, gamma, delta) with a script god who lights each camp's pit once. It keeps every chronicle line, not only the last 300, and counts storms, strikes, embers, sparks, wolf raids, maulings, sprite sightings, favour, gifts, moss, pranks, fights, births, deaths of old age, lessons, huts, storehouses, villages, deer speared, snare catches, freezing, and deaths by cause. A death that is not old age is a bug until proven otherwise. `tests/trace-deaths.js <seed>` prints where each dead person was, what camp, what they were trying, and their last decision scores.

The soak asserts, per seed:
- The first camp has a site, a pit, and a fire that was lit.
- The creation ended on its own, and the valley holds a life: it settled and did not fail, no backstop fired, the ages are within the limit, fewer valleys were thrown back than the cap allows, the gate is open, every god is asleep or dead, every hill carries a mark and a god behind it, every water cave carries a mark, every sector has a country, and the first day-era line was not stamped with an age. The soak also prints the creation's ages, discards, and roll of makings.
- Someone is alive at the end.
- The camps grow: at least 8 people alive at day 70, and at least one birth. Across all six seeds together, at least 180 people counted ever and 15 births, so a regression like the fishing bug that halved every seed still goes red. (The old per-seed floor of 20 people ever was too noisy: `humans` is a roughly 2x random variable across unrelated commits, with 20 inside its tail.)
- The far countries are reached. Across all six seeds together, the caves searched, the finds brought home, the gnome repayments, and the burrow benches each stand above a floor set at about a third of the measured sum. One seed alone may send nobody that far, so the floor is on the six together.
- Nobody dies of anything but old age. A death that is known and not yet traced goes in `KNOWN_DEATHS` in the test, as a todo, until it is fixed.
- At most one person a seed dies in a den, and it is reported.
- Nobody is cut off from their camp. Once a day, one full-map search from each camp's stash; every living member must stand inside it, and so must every den, water cave, and burrow exit still in use (a search from the first camp's stash), so a mid-game dig that seals a pocket is caught too, not only a person in one. This is the check that caught the sealed pockets.
- The run matches `tests/soak-golden.json`, a fingerprint of the chronicle, the beings, and the items. Any rule change moves it. Look at the printed counts, decide the move is what you meant, then bless it with `UPDATE_GOLDEN=1 node tests/soak.js`.
- The same seed tells the same story twice, and a seed, its options, and its log replay the same story, legends and all. A moved log tells a different one.

`tests/terrain.js` checks the levels, and since the mythos it reads the marks rather than a fixed map. The rules it holds: the surface is level 0 and the levels below start empty; a level apart counts as six tiles; rock does not walk and stone does; a slope joins two floors and a cliff does not; rabbits never climb and deer do; a wolf a level up is no threat; fire burns on a hilltop and is seen from there, not from below; a person walks up a slope and drops a stick on the floor; a carved cave is stone floor that remembers its record; and `keepsPaths` refuses a solid that would cut the last way through. Six soak seeds then carry the world-shaped rules: every hill is rock with reachable floors, off the water and out of the start sector; every water cave sits under a hill of a country a god dug, and carries that country's depth mark; rock fell at the hill feet and blocked some passages, and a boulder taken back leaves its loose rock; every den has one mouth, stands in its owners' country, and holds them; every grove carries a sprite making and lives under a hill of its country when it has one; every cave opens onto the walkable world and every hill stands beside it; each deep chamber holds one find; and no rain or work reaches the dark. A guard test proves some test seed digs a den for each hunter, so a change that stops denning goes red instead of quiet.

`tests/crafts.js` runs each recipe through the real goal offers on a hand-built camp: the offer appears, the person does the work, the thing exists, and the goal moves from blocked to active to done or idle.

`tests/gnomes.js` checks the gnomes: burrows exist and are reachable, gnomes sleep by day and wake at dusk to tend the patch, mushrooms regrow, a burrow copies a nearby workshop, a borrow returns with a repayment and cannot be doubled up or repeated inside six days, a loud village sends a burrow to a new hole 50 or more tiles away, and first sight is written down once.

`tests/closing.js` checks the closing phase on hand-built camps: a brave person takes a brand and brings a find home from the deep chamber, fallen rock is cleared with the axe first, two brave people clear a wolf den and the owners redig then come home when the fire fails, a den still reverts to owners who never redug, `withBrand` leaves no live ember when its chain does not start, a camp site favours stone close by and marks down a wolf den too near, and lightning smoulders a tree, does nothing to open ground, and lights the pit.

`tests/door.js` and `tests/options.js`, from the mythos merge, check the door and the start options: every act enters by `inject()` and is logged whether it lands or not, a replayed event must arrive at its own tick, and a start option's world size and level range are honoured or refused with a sentence. The soak's `strikes` counter, from `tests/lib/run.js`, counts weather strikes only: `Lightning strikes the pit` shares its opening words with a strike on open ground, so it is subtracted back out, leaving the player's own pit-strike uncounted alongside it.

`spreadFire` returns at once on a tick with nothing burning, before touching the world or raised arrays: no tile is ever on fire without `fireCount` saying so, so the early return draws no rng and changes no outcome, only the cost of a fire-free tick. It roughly halved the soak's slowest seed.

Known weak spots:
- Snare catches are low, 1 to 5 per world in 70 days, since rabbits became a real population.
- Deer pits rarely catch, since deer range far from camps.
- Wolves rarely catch deer.
- Some readers still see only the surface: plants grow on the surface, sector resource counts read the surface, lightning strikes surface tiles, and ash on a hill floor never returns to grass.
- The sprite-birth rule counts old pines on the sector's surface only; the pines on the hill above a hollow do not count yet.
- A person whose task fails in the dark drops what they carry there, where nobody will fetch it.
- Deer do not yet prefer the high ground when wolves are about; they climb hills only by chance.
- A camp short of one hide cannot raise its bed cap, and growth waits on a rabbit. One hide is now held for the hut while people sleep outside, so the waterskin and clothes cannot take it first, and the huts card offers a snare. That did not move seed gamma: its camp held no hide at all from day 11 to day 64, so the limit there is the snare catch rate itself, listed above.
- The dens, caves and burrows now sit in their own countries, and a camp may never reach them in 70 days. `densCleared`, `searched`, `finds`, `borrowed`, `repaid` and `benches` are 0 on most seeds. The soak prints them per seed so the loss is visible, and floors `searched`, `finds`, `repaid` and `benches` across the six seeds together, at about a third of the measured sum. Den clearing is seen on one seed in six since the dens moved to their makers' countries, so `densCleared` stays a printed diagnostic and the soak does not assert it.
- `rockfall` runs a full-map `reachable` for each boulder it lays, to count the cave mouths still joined to the world. It costs 113 to 237 ms a paint, under 2% of a seed's budget. Recorded and deferred: the cheap fix (one walk a hill, not one a boulder) would let two boulders across a narrow way each look safe alone, which is the bug the per-boulder walk was written to catch.
- Gnomes have no births, so a burrow's line ends when its gnomes die of age, at 110 days.
- The on-demand dig for a burrow that must move may fail several times on a crowded map, trying again every three days.
- Fixed. The soak's cave cutoff check (see section 14) caught a real one: on seed r a burrow's own exit at 2,22,0 went unreachable from the first camp's stash from around day 56 on. The dig itself was not the cause: it was never relocated. A sapling could still take root on a cave's own mouth tile, and twelve days later it matured into a solid tree there, sealing the one doorway a den or burrow has. `growPlants` in `src/sim/world.js` now refuses to plant a sapling on any tile with `t.mouth` set. `digGnomeBurrow` also now checks a live `reachable()` region, not the generation-time `startRegion`, when it digs mid-game (a village driving a burrow off), and keeps a new exit at least 2 tiles from the map edge, so a relocation dig cannot repeat the same mistake by a different route.

## 15. The door

The determinism contract, since the mythos spec. The engine step is pure. Given a state, the next state is fixed. Every act from outside enters by one door, `inject(event)` in `src/sim/door.js`, which logs every lawful event with its tick, applied or not, before applying it. The player's light and poke go through it; chance, an LLM, and a human inhabiting a mob are reserved sources. A perturbation is checked against the state's invariants, never against what the engine would have done. Every perturbation is visible in the chronicle in the game's voice. An event stamped with tick N was applied after step N and before step N+1. `startWorld(seed, options)` takes the world size in sectors and the level range; `design/settings.md` is the register of start options and future settings.

The acts the door knows: light, poke, priority (a goal set off, on, or high), and site (the camp site before the pit is built). The site event carries its camp's id, and the act resolves the camp from that id, not from the global `camp`: on replay `camp` defaults to `camps[0]`, so a site chosen for a second camp still lands on that camp, not the first, when the log runs again. Reachability, once a guard in the interface, is now a guard inside the act itself, checked against the target camp's own first living person. A replayed event carries its tick and must arrive at it; the door answers "Not now." otherwise. The test runner`s replay god throws if it falls behind. Nothing in the interface writes sim state except through the door.

## 16. Next

- Life clocks were the last round. Sprites and settlement buildings came with them. Wisps in the marsh (a lure at night) were designed but not built.
- A second intelligent mob that trades or raids.
- Names for events and long grudges in the chronicle, so the Legends-mode feel grows.
- A save format. The scenario runner is done: a seed, its options, and its door log replay the same story.
- Plan 4: watching the creation. The ages in the interface, the field view, the legends drawer, and hover on a mark to read the god and the reason behind a hill, a cave, a scar, or a country.
