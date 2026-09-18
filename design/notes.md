# Hearth: design notes

These notes are the record of the design so far, written for whoever works on the code next. They cover what exists, why it exists, the numbers that were tuned by testing, and the bugs that were found and fixed. Read them before changing the core.

## 1. The idea

Dwarf Fortress does not simulate everything. It simulates a few things in depth and lets them touch. Stories come out of rules that collide. No rule knows the story.

The design question is not "what features do I want?" It is "what state do the systems share, and which rules read and change it?" Two systems that never read the same data never interact.

The game is played by a god-player. The player does not tag tiles or give orders. The player sets goals, gives fire, moves the camp site before it is built, and pokes people. Everything else is autonomous. Everyone with a mind is a mob, people included, and every mob has a reason to exist and a process of existence.

## 2. Scale

- The world is 10 by 6 sectors. Each sector is 28 by 20 tiles and has a biome and a name: open meadow, pine forest, stony ground, reedy marsh. A sector is a mix. Forests still have a few bushes and rocks.
- The tile grid is continuous. Sectors are units of identity and viewing, not of simulation. A person walks out of one sector into the next.
- A river winds across the world. Fords every 47 tiles keep the sides connected.
- The world has five levels, −2 to +2. Level 0 is the surface. A level is an array like the surface, mostly empty: open air above, solid earth below. Six to ten hills stand on rocky and forest ground: rock at level 0 with a floor of stone or grass above it, and a second storey on the tall ones. A hill is only raised where it can be climbed: its first-storey floor is one piece, and some walkable tile beside it can hold a slope. Each storey has one or two slopes on its rim. Everything else is cliff.
- Slopes are the only way between levels. From a slope you step to any of its four neighbours one level up, and from those you step back down onto it. Rabbits never climb. Deer climb hills. Everyone else goes anywhere.
- Under every tall hill a stream once ran. It cut a winding passage 8 to 20 tiles long from under the hill to a mouth at the foot, with a chamber or two and a drop to level −2. One stream in three still runs and leaves a pond at the mouth. Rock fell after: boulders at the feet, and one passage in four blocked by fallen rock until someone has tools. Every cave exit opens onto the ground the first person can walk to, and hills only stand beside that ground. The passage is a walk of 8 to 20 steps that branches when it is boxed in, and its deep chamber lies at the walk's farthest point from the exit. Generation runs uplift, water, rockfall, dens, finds, people and animals, then groves; finds go after the items list exists, and a hollow has no deep chamber, so the order of finds and groves does not matter.
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

Births: spring or summer, a roof, the stock food goal met, two adults who like each other at 35 or more, and 16 days since either last had a child. The child blends both parents' traits. Rabbits breed when two adults are within 10 tiles in a warm season. Fawns come in spring. Foxes and wolves wander in from the world edges. An arriving wolf or fox joins the nearest den of its own kind that still has room for a breeding pair. Wolves and foxes bear one young in their den each spring when two grown owners live there. Arrivals from the world's edge are half as frequent.

Plants: bushes are seedlings for 3 days, slow after 48, die after 60. They seed adjacent grass in spring and autumn at 1.2 percent per sample, and never next to another bush. Pines start as saplings, become trees after 12 days, and old pines fall in storms. A sapling becomes a solid tree only if the open tiles beside it still touch each other around it once it is solid. A sapling also does not become a tree under a standing being. Before this rule, saplings sealed one-tile gaps in dense forest. Two woodcutters were shut in pockets by the river and the world's edge, and one starved and one died of thirst, each two tiles from the tree that closed the way. The tile card says when a sapling is held back. Generation spreads bush ages over 60 days. A first draft gave them all similar ages and every bush died in the same week, which starved four camps.

## 8. Camps and goals

A camp is a list entry: site, pit, stash tile, stash counts, tools, structures, snares, favour with the fae, and a founding tick. Goals are per camp. A goal has a state (blocked, active, idle, done, locked) and offers work. Standing goals are marked "ongoing" and never finish. The player sets each goal to off, on, or high.

The chain, in the order camps reach it:

1. Make camp. The first person scores a site on water, fire safety, berries, bare ground, and distance from sector edges. The site must be reachable from where they stand. The chronicle says why.
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
15. Build huts (ongoing), up to four. Built when people outnumber beds.
16. Sew a waterskin. 2 hides. Then keep water at camp.
17. Become a village. Storehouse, two huts, eight people.
18. Found a second camp. Roof, five people, eight days old, spring or summer, at most six camps. Two people leave with coals that last six days.

Crafts after the village are data. A recipe in src/sim/recipes.js names what it needs, where it is made, and what it makes, and one builder turns it into a goal. The panel shows recipes after the hand-written ladder: gather fibre, twist cord, build the workshop, weave a basket, make a fishing rod, fish the river, sew hide clothes. Work at the workshop goes 1.3 times as fast. A basket carries three more. A fish cooks to two meals or smokes to two strips. Hide clothes cut the wearer's warmth loss to 0.6. Then: dig clay from the bank, build the kiln, fire pots (each pot holds six more drinks at camp, and with a pot berries keep twice as long), plant a garden of four bushes from cuttings, dig up to two deer pits (a pit is dug only where a deer is within ten tiles of a bush at dig time and within thirty tiles of the camp, and it catches one deer in eight that steps in, and the camp hauls it home), and quarry stone from a rock face within thirty tiles. The first face opened on a hill with a hollow costs ten favour, paid once per hill.

A recipe carries an `offerLabel` for the goal panel and a `status()` for its own progress text. Places to work are a `PLACES` table, each with a spot finder and a work speed. Makers are a `MAKERS` map keyed by what the recipe makes, one function per finished thing. A recipe's maker runs before its inputs are consumed, so a maker that cannot act consumes nothing. A recipe short of an input that another recipe makes is blocked until that recipe runs; short of a raw input, it offers to gather instead. Gathering logs fells a tree when no loose logs remain on the ground.

Fishing stops once the food goal is met. A raw fish counts as two meals toward the fishing goal only; the stock food goal, births, and newcomers count cooked and smoked food and berries. The chronicle notes fish milestones, not every catch, so the log does not fill with one line per fish. Fishing once halved every camp's population because raw fish did not count as food: people kept fishing past the point of plenty and the food goal never read as met, though the camp was fed. The soak now asserts the camps grow, so this kind of regression stays red instead of green.

A camp takes a newcomer or bears a child only while the stock food goal is met. Beds alone let a village grow to twenty mouths, and winter, when the bushes are bare and nothing can be gathered, then starved them together.

Spoilage: cooked meat 1800 ticks, berries 3500, doubled in winter and doubled by a storehouse. Smoked meat keeps.

## 9. Fire as the loop

Fire is the thing the player is for at the start, and the thing that people learn to make for themselves. The order of independence: the player, then lightning and embers, then the sprites' moss, then firestones. Do not remove the early dependence. It is the reason the player pays attention.

## 10. Danger

- Wolves hunt rabbits, and deer in winter, carrying a rabbit kill home to eat in the den when the floor can be reached, and eating it where it fell when it cannot. At night a hungry wolf raids a camp whose fire is out and takes meat. A lit fire keeps wolves at eight tiles. A brave person with a firebrand chases a wolf off, and it avoids that camp for a while.
- A wolf will attack a person who is alone, at night, away from a lit fire, not holding fire. All four together. It has happened twice in 420 camp-days and nobody has died of it.
- A wolf or fox in its own den bites any person on the den's floor, by day or night, with or without a brand. This is the one exception to the four conditions above. The soak allows one such death a seed and reports it. It has not yet fired in any soak seed, since nothing sends people onto a den's floor until the cave goals of the closing phase.
- A den-bite death cause expires 600 ticks after the bite. An old bite is never blamed for a later, unrelated death.
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

- **Home.** Two or three burrows a world, dug like fox dens under meadow edges beside a forest or a hill, at least 25 tiles from the start sector. Two or three gnomes to a burrow. A burrow sits at level −1 with a slope at its mouth, and a mushroom patch of 4 or more tiles covers the soil around the mouth. Gnomes start aged 20 to 35 days, live 110 days, and have no births: a burrow's line of gnomes only shrinks.
- **Hours.** Asleep in the burrow from 06:00 to 19:00. Out from dusk to dawn. They tend the patch every night, not only when hungry.
- **Needs and food.** Food, rest, and company. Mushrooms on their own patch regrow at a chance of 0.3 a sample and give 35 food each. Gnomes also eat wild berries. They never eat meat, and never take from a camp's stash.
- **Company.** A gnome near its kin huddles with them, the way sprites do.
- **Copying.** A camp workshop within 40 tiles gives an unbenched burrow a bench of its own within a few days: a one-in-three chance every 500 ticks. Chronicle: "Small tools clink under the meadow at night."
- **Borrowing.** With a bench, at night, a gnome takes one made thing at a time from an unwarded camp stash within 40 tiles: a pot, then a coil of cord, then the basket. It returns two days later with a gift beside the taken thing: cord, clay, or a pot. A burrow does not borrow again for six days after a repayment. The cave's `holding` field stops two gnomes of the same burrow from both borrowing the same night, a race a soak run once caught.
- **Leaving.** A village within 30 tiles, or two disturbances, is too loud. Three days later the gnomes dig a new hole 50 or more tiles from every village and move in, carrying their bench, debt, and repayment timer with them. The old hole stands empty and abandoned, and a player can still inspect it. The on-demand dig tries one sector a call and retries every three days if it finds no room.
- **Neutral.** Gnomes never attack. They flee a brand within 5 tiles and a wolf within 6. They ignore sprites, and sprites ignore them.
- **Seeing them.** Glyph `g`, mushrooms `ɸ`. Tooltips on the being, the burrow, and the patch. A person awake near a gnome in gnome hours writes the first-sight chronicle line. A camp can also come to know of gnomes from footprints left after a borrow. The goal card "The hidden neighbours" tracks what a camp knows.
- **What the soak counts.** Gnomes alive at day 70, gnome deaths (must be zero), `campsThatSawGnomes`, benches, borrowed, repaid, and `gnomesLeft`.

## 12. Founding and travel

Newcomers spawn only at world edges from which the camp is reachable, and never in winter. They walk to the camp; camp-based actions (eat at the stash, sleep in the hut) require having arrived. Founding parties leave in spring or summer with coals, and pick a meadow at least three sectors from every camp.

## 13. Interface

- World map: whole world at 3 pixels per tile, sector grid, camp markers, sector summary on hover.
- Nearby view: the sector and its eight neighbours at 9 pixels per tile, drawn from the world map cache. Beings are glyphs. Hover shows the sector summary; a click opens the sector. M cycles sector, nearby, world map. Arrow keys step between sectors in the sector and nearby views.
- Location view: one sector at 26 pixels per tile. Tools: Inspect (hover shows, click pins, Follow button), Light, Camp site, Poke. Hover cards work with every tool.
- Goals panel with camp selector, People panel for the selected camp, Chronicle.
- Rain and winter overlays, firelight glow at night.
- Every rule change needs a visible trace: a chronicle line, a thought, a goal state, or a tooltip row. The player has to be able to see cause.

## 14. Testing

`tests/soak.js` runs 70 days on six seeds (r, x, alpha, beta, gamma, delta) with a script god who lights each camp's pit once. It keeps every chronicle line, not only the last 300, and counts storms, strikes, embers, sparks, wolf raids, maulings, sprite sightings, favour, gifts, moss, pranks, fights, births, deaths of old age, lessons, huts, storehouses, villages, deer speared, snare catches, freezing, and deaths by cause. A death that is not old age is a bug until proven otherwise. `tests/trace-deaths.js <seed>` prints where each dead person was, what camp, what they were trying, and their last decision scores.

The soak asserts, per seed:
- The first camp has a site, a pit, and a fire that was lit.
- Someone is alive at the end.
- The camps grow: at least 8 people alive at day 70, and at least one birth. Across all six seeds together, at least 180 people counted ever and 15 births, so a regression like the fishing bug that halved every seed still goes red. (The old per-seed floor of 20 people ever was too noisy: `humans` is a roughly 2x random variable across unrelated commits, with 20 inside its tail.)
- Nobody dies of anything but old age. A death that is known and not yet traced goes in `KNOWN_DEATHS` in the test, as a todo, until it is fixed.
- At most one person a seed dies in a den, and it is reported.
- Nobody is cut off from their camp. Once a day, one full-map search from each camp's stash; every living member must stand inside it. This is the check that caught the sealed pockets.
- The run matches `tests/soak-golden.json`, a fingerprint of the chronicle, the beings, and the items. Any rule change moves it. Look at the printed counts, decide the move is what you meant, then bless it with `UPDATE_GOLDEN=1 node tests/soak.js`.
- The same seed tells the same story twice.

`tests/terrain.js` checks the levels: the surface is level 0, a slope joins two floors and a cliff does not, rabbits never climb and deer do, a wolf a level up is not a threat, fire burns on a hilltop, and every hill on every seed is rock with reachable floors, off the water, and out of the start sector, every tall hill has a water cave whose floors can be reached from its exit unless rock blocks it, every den has one mouth and its owners start in it, a grove on a forest hill is in a hollow under it, every deep chamber holds one find, and no rain or work reaches the dark.

`tests/crafts.js` runs each recipe through the real goal offers on a hand-built camp: the offer appears, the person does the work, the thing exists, and the goal moves from blocked to active to done or idle.

`tests/gnomes.js` checks the gnomes: burrows exist and are reachable, gnomes sleep by day and wake at dusk to tend the patch, mushrooms regrow, a burrow copies a nearby workshop, a borrow returns with a repayment and cannot be doubled up or repeated inside six days, a loud village sends a burrow to a new hole 50 or more tiles away, and first sight is written down once.

Known weak spots:
- Snare catches are low, 1 to 5 per world in 70 days, since rabbits became a real population.
- Deer pits rarely catch, since deer range far from camps.
- Wolves rarely catch deer.
- Runs take about 15 seconds per seed. Profile before adding more per-tick work.
- Some readers still see only the surface: plants grow on the surface, sector resource counts read the surface, lightning strikes surface tiles, and ash on a hill floor never returns to grass.
- Dens exist but nobody uses them yet. Sleeping in a den, carrying prey home, births, and defence are phase 3 of topography. Finds lie in the deep until phase 4 gives people a reason to go.
- The sprite-birth rule counts old pines on the sector's surface only; the pines on the hill above a hollow do not count yet.
- A person whose task fails in the dark drops what they carry there, where nobody will fetch it. Phase 4 should send them out with their load.
- Deer do not yet prefer the high ground when wolves are about; they climb hills only by chance.
- A person who keeps returning to a defended den will die in three or four visits; the cave goals must draw the owners off or stop re-offering the den to a hurt person.
- A camp short of one hide cannot raise its bed cap; the huts goal offers no work toward a hide, so growth waits on a rabbit. Seed gamma's population hangs on the date of one snare catch.
- Gnomes have no births, so a burrow's line ends when its gnomes die of age, at 110 days.
- The on-demand dig for a burrow that must move may fail several times on a crowded map, trying again every three days.

## 15. Next

- Life clocks were the last round. Sprites and settlement buildings came with them. Wisps in the marsh (a lure at night) were designed but not built.
- A second intelligent mob that trades or raids.
- Names for events and long grudges in the chronicle, so the Legends-mode feel grows.
- A save format, and a scenario runner so "cut trees in a grove on purpose" is a script.
