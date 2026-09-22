# Hearth: design notes

These notes are the record of the design so far, written for whoever works on the code next. They cover what exists, why it exists, the numbers that were tuned by testing, and the bugs that were found and fixed. Read them before changing the core.

## 1. The idea

Dwarf Fortress does not simulate everything. It simulates a few things in depth and lets them touch. Stories come out of rules that collide. No rule knows the story.

The design question is not "what features do I want?" It is "what state do the systems share, and which rules read and change it?" Two systems that never read the same data never interact.

The game is played by a god-player. The player does not tag tiles or give orders. The player sets goals, gives fire, moves the camp site before it is built, and pokes people. Everything else is autonomous. Everyone with a mind is a mob, people included, and every mob has a reason to exist and a process of existence.

## 2. Scale

Every world begins with its creation, not with noise. A field of countries is split and marked by the primal gods, age by age, and a mark is a record on a country: a pole, a height, a depth, a scar, a making, a rest. A god may sleep only when the rest gate passes on the marks: a dry level start country, water beside it, a forest within two neighbours, the people made, a hill, a cave, and each kind of life. When the last god sleeps, settle paints the valley from the marks, painter by painter, in a fixed order. Settle then checks tiles, which the gate cannot: from where the first person stands, by a real path search, water, ground, fuel, food, and room to walk the start country. A valley that fails is discarded, the last sleeper wakes, and the ages go on. A creation may discard eight valleys; the ninth is kept whatever it lacks, as is the settle of a creation that ran out of ages, and a legend says the world was settled unfinished. The spec is `design/specs/2026-09-17-mythos-design.md`, sections 3 and 4. Past the age limit, a tired god supplies the lack itself, once an age: this is the backstop. For a lack of fuel, it makes a country near the start cold. It dries the country first if the country is not already dry. Dry and cold land is a forest. The backstop never dries a wet country, since that may be the start's water. It once made the start hot instead. Dry and hot land is a meadow, so the backstop could never supply wood.

**The creation's words.** Every line the creation writes comes from `TELL` in `src/sim/gods.js`, through `tell(key, values)`. The rules never read the text. Poles, lacks, biomes, and scars are rule words. A table turns each one into plain words before it reaches a line, so the player never reads "country" or "field".

| Table | Turns | Into |
|---|---|---|
| `POLE_WORD` | a pole, "above" | the land's word, "high" |
| `GOD_OF` | a pole, "wet" | a god's domain, "a god of water" |
| `LACK_WORD` | a lack, "start" | "a dry, level place where people can begin" |
| `BIOME_PLACE` | a biome | a noun and a place, "a meadow" and "in a meadow" |
| `SCAR_TEXT` | a scar | how the ground is left, "torn open" |

A line with several wordings uses them in the listed order, one each time it is said, and starts again after the last. The count is `creation.told`. A snapshot saves it, so a replay tells the same story. The count draws no random number, so a change to the words moves only the `chronicle` and `legends` hashes of the golden record.

The playtest of 20 September 2026 found two faults. The player could not follow "The far side has nobody to hold it" or "it lacks start", and each line came back word for word. The text went through two rounds of three Sonnet reviewers, and a third round checked the result. `tests/gods.js` checks the order, checks that every table covers its rule words, and checks that no rule word reaches a legend. The mark notes on a country ("Kesh drew the line, and this was the near side.") are not in `TELL`. `markSaid` in `src/ui/derive.js` reads whether a note starts with the god's name, so a rewrite of the notes is a separate change.

- The world is 10 by 6 sectors. Each sector is 28 by 20 tiles and takes its biome from the country that covers most of it: open meadow, pine forest, stony ground, reedy marsh, riverside, burnt ground. A sector is a mix. A meadow, a forest and a marsh all carry berry bushes and loose stones, because the gods may put the first camp in any of them. Before the mythos the camp always stood in a meadow. The loose rock is what fixed the camps the gods put elsewhere: a forest with no rock could not build its fire pit or knap its axe, and the camp starved. The berries are texture for a camp in the trees, not the cure.
- The tile grid is continuous. Sectors are units of identity and viewing, not of simulation. A person walks out of one sector into the next.
- A river winds across the world. Fords every 47 tiles keep the sides connected.
- The world has five levels, −2 to +2. Level 0 is the surface. A level is an array like the surface, mostly empty: open air above, solid earth below. A hill is rock at level 0 with a floor of stone or grass above it. Hills come from three marks, so their number is a seed's own: a height mark raises one to three hills in its country, by area; a depth mark raises one where its country has none, because a cave mouth needs rock; and a making of a species that dens raises one for the den. The six soak seeds carry five to eighteen hills, and a hill stands in whatever biome its country holds -- meadow, wetland, forest or rocky -- not only on rocky and forest ground. Storeys come from the height mark, capped by the level range, so a hill is one or two storeys tall today. A hill is only raised where it can be climbed: its first-storey floor is one piece, and some walkable tile beside it can hold a slope. Each storey has one or two slopes on its rim. Everything else is cliff.
- Slopes are the only way between levels. From a slope you step to any of its four neighbours one level up, and from those you step back down onto it. Rabbits never climb. Deer climb hills. Everyone else goes anywhere.
- Water caves come from depth marks. A depth mark cuts one under each hill of its country, `min(the mark, -ZMIN)` levels deep, so one or two levels today. A stream cut a winding passage from under the hill to a mouth at the foot, with a chamber or two, and a drop with a chamber for each level below the first. The stream still runs where a flow mark or a pool mark lies under the country, and there it leaves a pond at the mouth. Rock fell after: boulders at the feet, and one passage in four blocked by fallen rock until someone has tools. Every cave exit opens onto the ground the first person can walk to, and hills only stand beside that ground. The passage is a walk of 8 to 20 steps, fewer where a small hill boxes the walk in. A boxed walk goes back along the spine and branches from the last tile with room, and the deep chamber lies at the walk's farthest point from the exit.
- Settle runs its painters in one order: sectors, ground, rivers, lakes, the first person, scars, hills, caves, rockfall, the items list, the finds, the creatures (dens, groves, burrows, then the animals on open ground), and last the gods' bodies. The first person goes down early because a hill's footprint and a cave's mouth both ask whether they open onto ground that person can walk. Finds go after the items list exists, and a hollow has no deep chamber, so the order of finds and groves does not matter.
- Foxes and wolves dug dens into the hillsides: pockets of two to six tiles inside the rock, or burrows under a slope. Each has one mouth. The wolf pair and the three foxes start at home and remember it. No den or hollow tile sits beside another cave's tile on its own level or the levels above and below, so no two caves join through a slope.
- The hunters are capped at settle by a `most` field on their `SPAWN` rows: two wolves and three foxes over the whole valley. The making act is built to repeat, so a long creation marks the same species in country after country. Seed `birch-crag-41` runs 82 ages and carries twenty-six wolf makings. Before the cap its valley began with fifty-two wolves, and four of them mauled one person within three ticks. The cap is on the painter, not on the mark, so the legends still tell of every making. A making past the cap puts nothing on the ground and digs no den. The settle says so once for each species held back: "The gods made wolves in many places. Only two of them came down into the valley." The prey and the fae carry no `most` and are not capped. A country with a hunter making still gets its low hill from `paintHeights`, whether or not a den is dug there.
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

Urgent needs interrupt work. A need task in progress is never interrupted by another need. A person with two urgent needs once flipped between drink and eat every tick and died next to water. Sitting by the fire is the one exception: a person low on food or water is sent to eat or drink even mid-sit, because sitting restores neither, and a person once starved that way. The search for water stopped after 3000 tiles, and a camp founded 59 steps from the nearest river let two people die of thirst beside a full stash; a failed near search now walks the whole world once and covers the first stretch, as pathToStop does.

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

The smoke is what calls a newcomer, so a camp with a cold pit calls nobody. That is right, and it is also why a camp cannot save itself once the last person is dead. So the world has a second, slower way in. When no person is alive in the valley, the chronicle says so at once, and a lone wanderer crosses the hills ten days later, uncalled. Winter holds the wanderer back, as it holds back the arrival that follows the smoke. The wanderer arrives at a reachable edge of the world, homeless, and joins the old camp's site like any newcomer. They find the hearth cold and the bones of the people who lived there. The wait is `CLOCK.arrival.afterTheLast`.

This is the world's rule, not a god's deed. It writes no legend, because the gods era is over at settle. It does not end the run either: the animals, the sprites, the gnomes, the weather, and everything the people built go on without them. The fire does not go out the moment the last person falls, so the smoke arrival can still bring people for as long as the fuel lasts. The wanderer is the floor under that, not a replacement for it.

A line down to one living person is finished too, and that is not the same as the valley being finished. A birth needs two adults who like each other, so one person can never make a second. But one person with the fire out is a common thing: mid-winter, mid-journey, a founding party on the road. So the rule does not fire on the count of the people alone. The line counts as ended only when exactly one person lives and the hearth of the living has stood cold for `CLOCK.arrival.afterTheDoomed`. The hearths counted are the hearths of the living, not every pit in the valley, so the rule still reads correctly once a second line keeps a fire.

Nobody is sent to rescue the one who lets the fire die. They keep their hermitage, and the chronicle says the line ends with them. The valley goes on elsewhere instead: a further `CLOCK.arrival.afterTheLast` later, outside winter, a founder crosses the hills and starts a camp of their own. The ground is a founding site at least `CAMPS_APART` sectors from every camp that has one, and the farthest such site from the hermit rather than the nearest, so the new line does not tread on them on its first day. The camp carries a mark, and while anyone of a camp begun this way still lives, no second one is founded. The two lines meet, if they meet, by ordinary movement, as any two camps' people do.

The two rules take turns and never run together. One needs nobody alive, the other needs exactly one. If the last person dies while the wait is open, that wait drops, and the empty valley rule takes the valley over from its own first line. Once the line has been said to end, only the count of the people closes the wait: a fire relit does not save a line of one.

Spoilage: cooked meat 1800 ticks, berries 3500, doubled in winter and doubled by a storehouse. Smoked meat keeps.

## 9. Fire as the loop

Fire is the thing the player is for at the start, and the thing that people learn to make for themselves. The order of independence: the player, then lightning and embers, then the sprites' moss, then firestones. Do not remove the early dependence. It is the reason the player pays attention.

The player's tool is Lightning. On the pit, it lights the fire. Anywhere else, it strikes like the sky's own lightning: a pine smoulders, its fire at least 240, long enough to fetch an ember; grass burns; bare ground does nothing.

## 10. Danger

- Wolves hunt rabbits, and deer in winter, carrying a rabbit kill home to eat in the den when the floor can be reached, and eating it where it fell when it cannot. At night a hungry wolf raids a camp whose fire is out and takes meat. A lit fire keeps wolves at eight tiles. A brave person with a firebrand chases a wolf off, and it avoids that camp for a while.
- A wolf will attack a person who is alone, at night, away from a lit fire, not holding fire. All four together.
- The four conditions are rare in a grown camp. The old note read "twice in 420 camp-days and nobody has died of it". That figure counted the six soak seeds only, and its reasoning does not hold at a population of one. A sole founder passes the alone test every night, because no other person exists to stand near. The four conditions collapse to two: at night, and away from the fire. That is what founding a camp looks like, because somebody has to walk out to fell pines. On seed `birch-crag-41` four wolves mauled the founder in three ticks and killed him on day 11.
- So a mauled person carries `cooldown.stalked`, read by the gate and again at the maul. The wolf's own `cooldown.stalk` spaces out one wolf's maulings. It is no floor for the victim, because the valley holds more than one wolf. This one spaces out one person's. Its length is `CLOCK.cooldown.stalked`, sized so `CLOCK.rate.heals` wins back more than the worst maul between two of them. Across thirteen seeds of forty days, with no fire from the player, it took maulings from twelve to six and deaths by mauling from one to none.
- A sole founder is still stalked. The opening tells the player to give the spark and watch what walks in from the dark, and the first fire is urgent because of it.
- A wolf or fox in its own den bites any person on the den's floor, by day or night, with or without a brand. This is the one exception to the four conditions above. The bite is one a den every 150 ticks, shared by every owner in it, not one an animal: two grown owners standing together cannot both bite the same person in the same tick. The soak allows one such death a seed and reports it. Clearing a den sends people onto its floor on purpose; it has not yet fired as a death in any soak seed.
- A den-bite death cause expires 600 ticks after the bite. An old bite is never blamed for a later, unrelated death.
- A camp can clear a den with brands and the spear. The party keeps both brands lit until it is home at the stash; the den mouth is often a level down, and letting go there once left the whole party in the dark. The owners it drives out dig a fresh den elsewhere within three days if they can, waiting 500 ticks to try again after a hill refuses them; those without a den flee, or, where nothing threatens them enough to flee from, walk off to open ground well clear of the mouth. If the camp's fire goes out for a whole day, the den reverts: it takes back owners who already redug and owners still without a den, whichever the fire failure catches. An arriving wolf or fox never joins a den the camp holds. The guard goal never chases an owner it just displaced back into the den it was driven from while that owner's raid cooldown runs; chasing it there was a livelock, not a fight.
- Most den hills hold no den, and that is not a leak. `paintHeights` raises one low hill in every country that carries a hunter making, before any creature is placed. The settle then puts at most one wolf pair and three foxes in the whole valley, so the hills far outnumber the dens: 26 to 4 on seed `birch-crag-41`. The spare hills are where a driven-out beast goes. The goal text in `src/sim/goals.js` promises the player exactly that before they clear a den, saying the beasts dig a new den elsewhere. Narrow the hills to the ones that received a den at settle and the game breaks its own promise, because a driven-out pack would have nowhere to dig. `src/sim/species.js` is what reads the supply: it filters `hills` for one carrying no den of that owner's kind. Two lesser reasons stand behind the first. The hill is terrain painted before `paintCreatures` runs, so narrowing it moves the six-seed golden record. And `src/sim/settle.js` is already careful: one low hill, one storey, and only where no god already raised the ground. Nobody has counted how many spare hills are actually used across the six seeds. That measurement was offered to the user and declined, so the comfort of the ratio is a judgement here, not a finding.
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

## 12a. Names

A name is a record: the text, the tongue, the meaning, the tick it was given, one line of reason, who gave it, and the candidate scores the namer kept. A thing keeps a list of records, newest first. The list never loses a record, so a chronicle line under an old name still reads. `src/sim/names.js` owns all of it. It loads after `clock.js` and before `field.js`.

- **Two streams.** Names draw from `nrng`, a second generator seeded from the world seed with the salt `:names`. It never touches `rng` or `godRng`, so a seed's land, beings, and items are the same with names as without. `seedNames()` runs in `resetState`, after `namePool` is shuffled and before the first camp is made.
- **The layout guard.** Naming moves no being and no item on any seed. It adds no thought, changes no need, and draws nothing from the world's stream. Learning an old name gives a chronicle line and sets `nameKnown`, never a thought; the `village` thought stays at the tick `camps.js` sets it, not at the naming pass that follows. `tests/names-layout.json` freezes the land, the beings, and the items at tick 0 and at day 70; `tests/names.js` holds the guard. Only `chronicle` and `chronicleLines` may ever be blessed for naming work.
- **`nameTheLand()`.** `settle()` calls it once the valley is final, right after `era = 'days'` and before the first person is placed, guarded by `if (!lore)`. An undone settle never names anything, and no name line can land in the legends, since the gods era is already over by then. It builds the old tongue, a lost people, and their fate, then walks the land: the great water, every hill, every water, den, or hollow cave, every grove, and one ford in three. Each old name spends one meaning from `LAND_WORDS`, drawn by the kind of thing being named (`water`, `hill`, `cave`, `grove`, or `ford`) through `LAND_WORD_KINDS`; a meaning is never used twice, and a name with no meaning left is not given.
- **Learning.** An old name is unknown until somebody stands on it, in it, or beside its water. `learnNamesHere` runs for every awake person, human only, and exits at once once `lore.unknown` reaches zero. Learning writes a chronicle line and sets `nameKnown`; it adds no thought and changes no need.
- **The namer.** One function, `nameThing`, gathers candidates from the land, recent events, notable people, learned old names, and the lore, scores them, and takes the top. A trait of the namer, from `AXIS_TRAIT`, bends one axis by 0.7 to 1.3; nothing else weighs a candidate. A text another thing already holds scores zero. `rename(camp, record)` is the only door that changes a camp's name once it has one; `nameThing` calls it for a camp and calls `giveName` for everything else.
- **The camp and its events.** `nameFoundersCamp` names a founder's camp. It runs the moment the site is chosen, from `chooseSite` or from the `setSite` fallback for a site set with no founder yet. It also runs from `startFoundCamp`, when a party sets out, before that camp has any site at all. A camp whose text is already taken asks the namer instead, because the name pool is recycled and two living people can share a name. A camp with no name record is "the camp" in a line; `campNameOf(c)` reads the record, never the text. The hearth pass, `nameCampAtHearth`, runs from the nightly pass `nameTick`, once a day at `CLOCK.names.nameHour`, and reports the new name in one of seven lines, `CAMP_NAMED_LINES`, drawn by `npick` so the same rename does not read the same way twice. Events are named at the fire the next night, from the tags `log` carries and `CLOCK.names.eventMemory`. A night is named from the event table alone, never from a place: `nameThing` builds the pool from `eventCandidates` for a night, the way it builds it from the lore alone for the valley. Each tag in `EVENT_NAMES` carries three phrases, twenty-one in all, so a second or third fire or birth can still be named; once a tag's three are spent, a further night of that kind keeps no name. The rule runs the other way too. An event offers a place only its joined word, such as `Ashhill`, never a phrase. The phrase, such as `the Night of the Wolf`, is the name of a night, so `eventCandidates` gives it to an event alone, gated on `kind === 'event'`. A defect once let the joined word through for every kind, including a night, so a night could be called `Cradlefield`; the gate on the joined-word branch fixed it. The tags `old`, `oldCold`, `deer`, `fish`, and `pot` carry no row in `EVENT_NAMES`, so none of them names a night.
- **The ground underfoot.** A sector is named by the first finished job that raises a structure on it. `workKind`'s stop reads the work tile before and after its effect, and names the ground only when the tile went from bare to built, so feeding a fire or checking a snare names nothing. A sector is also named by the first delivery that lands in it, from `TASKS.deliver`'s stop. A pond is named by the first person to drink from it, in `TASKS.drink`'s stop.
- **The village and the valley.** A camp names itself again on becoming a village, with its own current name as a candidate at 60, so most villages keep the name and gain only the title. The valley is named once, by the first camp in list order that is a village, from the lore words alone, at a base of 40. Each lore word is offered again in the form `Vale of ...`, keeping the lore base of 40, so these win first, ahead of every other axis. Only after every lore word is taken does the one remaining fallback compete: the people's own name, as `... Vale`, at a lower base of 20.
- **Epithets, fates, and lineage.** Everyone earns an epithet after `CLOCK.names.epithetAfter` days in a camp, scored from opinions, deeds, and birth; the camp is the namer, so no trait weighs it. Every epithet is a byname, so it follows a name in every line. A later candidate must score half again as much to replace one already held, and a change is logged at `info`, as the first epithet is. A deed is counted on the person: `log` adds one to `a.deeds[tag]` for each tagged line, because a history holds forty lines and camp chatter fills that in a day. Nothing but an epithet reads `a.deeds`. Fate gives the last epithet at death. Old age carries two tags, `old` by the fire and `oldCold` away from it, so the epithet says what the chronicle line says. `fullName(a)` reads a person's epithet; a god keeps its own epithet from `gods.js` and never gets one from naming work.
- **The namer's words.** `joinedWord(a, b)` gives the joined shape, Reedwater, and `phraseWord(a)` gives the phrase, the Reed Marsh. Each drops its row when the tail or the phrase is the word again, so no name says one word twice. `landRows` builds the land's candidates from a list of words, and `workRows` builds a work word's two.
- **What a save keeps.** Section 18 holds the whole list. `rebuildNames` reads the index and the used meanings back out of the saved records, so neither is saved. The tile fields `water`, `pond`, and `ford` point at their records, which the save carries whole, and `lostNames` carries the records of the things no list reaches any more.
- **Known and unknown.** The land's old names start unknown, `nameKnown === false`, until `learnNamesHere` finds them. `giveName` decides by who gave the name, not by its tongue: an old-tongue record with no giver (`by: 'lost'`) starts unknown, and every name a person speaks starts known, whatever tongue it carries. `describe(thing, kind)` shows the name once it is known, else a place phrase from `placePhrase`.

## 13. Interface

The interface is `src/ui/`, plain scripts in one scope joined by `src/ui/index.js` after the sim. `derive.js` and `keys.js` touch no DOM and run in Node under `tests/ui.js`. View state changes in `actions.js`, where keys and clicks both end, with three recorded exceptions: the window drag handler in `windows.js`, the palette's own list state in `dialogs.js`, and the cursor and hover set by the pointer handlers in `main.js`. The design is `design/specs/2026-09-17-ui-rethink-design.md`.

- The page fills the window. The strip on top has a world half (clock, season with days to the next, weather) and a camp half (the camp's name and tabs, gauges for hearth, food, water, and beds, and alert chips). Pause, step, hour, speeds, and help sit at the right.
- Alerts read state each frame: fire, cold, food, water, threat, sprites, and event pulses from major chronicle lines and goals that open. Only a day-era line pulses. The creation writes a chronicle of major lines, all at tick 0 and all carrying an age, and they are the story of the world, not news from the camp, so they are never chips. Chips are numbered. Mutes are per type, per camp or everywhere, and persist.
- The map fills the rest. Four views: sector at 26 px, nearby at 9 px, world at 3 px, and camp fire at 26 px. M cycles them in that order. The camp fire view has the sector view's shape. It centres on the chosen camp's pit, or on its site before the pit is built. It stops at the world's edges. With no camp to centre on, M skips it. A cursor that leaves it, or a sector step, opens the sector view. `locOrigin` in `derive.js` is the one origin that the drawing, the pointer, the cursor, and the tools read for both close views. The tools and the view buttons float top left. The foot shows the newest chronicle line when the chronicle drawer is shut. It leaves that line out when the act caption above it already shows it.
- Five drawers on the right edge: People (trouble first), Goals (by stage, done and idle folded, a blocked goal hidden until its prerequisite is done, A shows all), Chronicle (all or major), Camp (the stash, tools, favour, animals), Legends (the creation by age). Keys 1 to 5 toggle them. Legends is open in both eras and is never trimmed. Tab cycles focus, Esc returns it to the map, arrows move the row, numbers pick, Enter opens, Left and Right set a goal's priority.
- Every drawer starts closed. A tab's own key, or a click on the tab, opens or closes it. Neither moves the keyboard focus off the map. The game's own keys keep working while the drawer is open. A click inside the drawer gives the drawer the focus. Esc gives the focus back to the map. The drawer stays open. Make world and Take a god always start with every tab closed, even when a saved session had one open. Continue and a loaded save keep the tabs that save had open. A search jump (`/`) or a stage jump (the goal chord) still takes the player into the drawer on purpose. The player asked to see one particular thing there. Below 800 px wide only one drawer stays open at a time. Opening a second one closes the first. If the first one held the focus, the focus goes back to the map.
- The user accepted one change on 2026-09-21. A tab's own key no longer moves the keyboard into its drawer. Tab, or a click inside the drawer, does that now. A tab's hotkey must close the tab again. The game's own keys must keep working while a drawer is open. One key cannot both hold the keyboard for the drawer and hand it back to the game. Do not make the tab's key take the focus again without asking the user.
- Goals carry a `stage` and an `after`. `stageReached` says whether a stage shows. Both are data.
- The hover card is as before. The pinned card is gone; the inspector window took its place, and the dead `tipPinned` state went with it.
- A tile cursor lives on the map. Arrows move it, Shift by five. Alt with an arrow goes to the sector's edge on that side and keeps the row or the column; from the edge, each press goes one sector on, to the same edge there (not Ctrl: macOS takes Ctrl with an arrow for Mission Control). The four sector buttons step a whole sector. Enter applies the tool. Home goes to the hearth, W to the world map at the camp. The mouse moves it too. The foot names what is under it.
- Tools: Inspect is the default. Light fire and Nudge are one-shot and return to Inspect. Shift with the key or the click keeps them. Camp site left the interface; `setSite` stays in the sim for tests.
- Every act the player makes goes through the door, `inject()`: the `light` act and the `poke` act behind Nudge, and the `priority` act behind a goal row. Speeds run 1, 4, 16, 64.
- `H` hurries the ages to settle. `C` shows the countries over the world map in the days. Both are view state. Neither passes the door.
- Nudge's reply names the person's chosen goal: it says who they go to, or that they get to it when no choice was made yet.
- Floating windows: any drawer pops out with O and docks back with O. Enter or a click on a being or tile opens an inspector window; up to six stand at once, each live, F follows. Positions persist.
- Alert chips: Alt+number jumps to the cause, Shift+Alt+number opens the mute menu: this chip, this kind here, this kind everywhere. Muted chips are listed in help and in the palette as Unmute rows.
- Cmd-K or Ctrl-K opens the command palette: every action with its key, and rows for people, goals, camps, sectors, chips, and mutes. G opens the stage chord.
- The feedback pass, first round. The dispatcher tries the focused rows first, then the `any` rows, so the order of `KEYMAP` no longer decides a clash. Shift+F in a window follows, and does not stick Light fire; that row is `quiet`, which keeps it out of help. `focusStep` does nothing under a dialog. A new inspector takes the first free slot from the saved rect, so a reopened one never covers an open one. A sector opened from the world or nearby view keeps the hovered centre (`cursorInSector`). A name matches whole words only (`namesIn`), so a prefix pair cannot misattribute a chip or a chronicle row. A mute reads as a sentence (`muteLabel`) in help and in the palette. A drawer with `fit` in `DRAWERS` (People, Camp) is as tall as its rows, up to 40%; Goals and Chronicle share the rest. The caves and dens goals say so when a cold fire is what blocks them.
- The gods stay in the world after the ages. A sleeping god is a being like any other, so the interface says so plainly: its own colour from `--map-god`, its own star glyph on the maps where every other sleeper draws a `z`, its own inspect card (name, epithet, what it became, where it lies, and the legends it stands in), and its name with its epithet in the sector summary, apart from the animals. A nudge is refused at the door: what wakes a god is its own rule, and it is not built yet.
- A drowned country's dead pines draw `†` in the ash colour, and the tile card names them from the `FEATURES` table.
- The feedback pass, second round. Every idle goal folds to the stage's count, not only recipes; Enter on the stage row unfolds it, and A shows all. Start and help each have their own focus, `dialog:start` and `dialog:help`; when they shared `dialog`, Enter in help opened Start. Enter in Start runs `makeWorld`, which closes the dialog with `make`, as its button does. A stage shows when the sim calls it reached and it has a row to show or a goal done, so idle `guard` alone no longer opens Settlement on day 2; `stagesShown()` gives the chord and the palette the same list. The map is pinned left, so it holds still when a drawer opens or shuts.
- The feedback pass, third round. Each speed button has a direct key: Shift with its place on the ladder, Shift+1 to Shift+4, from every focus. The ladder is one table, `SPEEDS` in `state.js`; the rows, `slower`, `faster`, and `speedStep` name a place on it and not a value, so the ladder can change and the keys hold. A direct key does what its button does: the pace in the ages, the speed in the days. Minus and equals still step. A folded stage names its idle goals under its header (`foldLine`), two lines at most, the full list in the title; an unfolded stage shows the rows themselves.
- Every clickable thing has a key, printed on it. `tests/ui.js` fails on a button without one. Movement keys are provisional; change them in `KEYMAP` only.
- Save, Load, and Continue. Ctrl+S saves the world to a file, and Ctrl+O opens one, the same way Ctrl+N already starts a new world. Neither has a button on the top strip, which is full; both are in the palette and in the help table. Continue is a button on the start dialog, so it takes Alt+C. The keydown handler used to drop every key aimed at an input; it now lets a chord with Ctrl, Alt, or Command through, so Alt+C fires from the seed box too. A page that cannot write a file says "This page cannot write a file."; one that cannot open a picker says "This page cannot open a file."; a chosen file that is not JSON says "This file is not a save."; one that will not read says "This file cannot be read."; and a page that cannot keep an autosave says so once, "This page cannot keep an autosave. The game plays on.", and the game plays on regardless. A refused load, from the file picker or from Continue, shows the door's own sentence.
- A camp's drawer shows its current name and its former names; a hover on either gives the full record, through `nameTitle`: the tongue, the meaning, the day, the reason, who gave it, and the scores it beat. A sector shows its name beside its biome word once it has one, through `sectorLabel`, and reads as a plain phrase mid-sentence through `sectorProse`. A tile window's own title bar keeps the biome word regardless, because a sector's full label can run past the room the title bar has; the sector's own name is one hover away, in the card the window shows.
- The world map's title is the valley's name, once a village has given it one and somebody has read it, through `valleyName`; until then it reads "World map". The help page follows the same rule for its own valley line, and titles its section "The lost people", never "mythos".
- The chronicle drawer has a name search, on the `/` key. `chronicleMatches` finds a line by its own text or by any name, past or present, of a thing it mentions, but never by a name nobody has read. `ui.chronSearch` holds the query outside `persist`, so it never survives a reload; `setChronSearch` is its one writer. The first Escape clears the query and keeps the caret in the box; the second lets the caret go.

## 13a. Watching the creation

The page opens in the gods era. The player watches the creation age by age. The day interface opens at settle.

- One age passes in two seconds at pace 1. The four speed buttons set the pace: 1, 4, 16, or 64. The pace is not saved, and a new world starts at pace 1. Step moves one age. Hour and the goal chord are shut.
- The ages wait while a dialog is open, so the creation does not run behind the start dialog.
- `H` hurries the rest of the ages to settle.
- The world map is the only view. There are no tiles, no sectors, and no people, so the location view is shut until settle.
- The People drawer lists the gods. The bar is a god's rest, and the row says what it does. The god's card holds its needs, its thoughts, its opinions, its last decision scores, and the legends it stands in.
- The Goals drawer and the Camp drawer say the valley is not made. The strip counts the countries and the gods awake in place of the season.

A god has no place in the ages, so a follow is refused. The foot says there is nothing to follow.

At settle the view moves to the first person, the saved speed returns, and the foot says the gods sleep and one person wakes. A god's card closes, because it would cover the valley at the moment it first shows. Drawer windows stay. The Legends drawer keeps the creation. Pace and hurry are view state and do not pass the door. A creation watched age by age is the creation `startWorld` runs, and `tests/ui.js` holds that.

The field on the world map, in the order it is drawn:

| Part | How it draws |
|---|---|
| A country | The mean of its poles' colours. Grey where it has no pole. |
| A boundary | A line in the ink colour. A wet boundary is a water line. |
| A scar | The country is hatched, one tile in four, in the scar colour. |
| A god | A gold star with its name, on its own anchor tile, `g.at`. A sleeping god is faded. Two stars within a glyph's width of each other are nudged apart. |

### The ages in motion

An age is one step of the rules, so the state on screen is the new state when the tween begins. The view holds
the field as it was, fades the new one in over it, and draws each god's gesture across the same fraction. The
clock is `acc`, which the frame loop already keeps, so a tab that slept wakes and the drawing jumps with the
state. `TWEEN` in `src/ui/state.js` holds the numbers. No duration entered `src/sim/`.

The tiers key off the tween's own length, `AGE_MS / pace`, read at run time. No branch names a pace.

| Tween length | What runs | On today's ladder |
|---|---|---|
| 1000 ms or more | The intent cue, the walk, the figure, the caption, the cross-fade. | pace 1 |
| 300 to 1000 ms | The same, without the intent cue. | pace 4 |
| 100 to 300 ms | The walk and the cross-fade. | pace 16 |
| Under 100 ms | Nothing. The field snaps, as it did before. | pace 64 |

A paused world, a world behind a dialog, a thrown-back valley, a new world, and a frame that ran two or more
ages all snap. A hurry ends in the day era, so it snaps by itself.

Four questions the design left open, and what the code answered.

| Question | Answered |
|---|---|
| A cross-fade, or a wash that spreads from the anchor? | A cross-fade for the field. A wash draws only as a gesture, for a burn, a freeze, a hiding, and a showing. |
| May the field read ahead of the picture? | Yes. A hover card names the new state while the fade runs. Holding it back would make the card disagree with the drawer beside it. |
| Does the flow path cross a country it never entered? | Yes, often: 67 of 166 flows over the twenty-four seeds, one of them for 121 tiles. A line would be a lie, so each country of the path lights in turn. |
| Does a winding cut read as one stroke? | Yes. Over 784 cuts on those seeds the widest gap between two tiles of a sorted line is two tiles, so the line is stroked. |

Two more things the record made plain. An act often leaves a god on a neighbour of its own country, and
`settleHome` walks it home at the head of the next age; so the star walks home first and walks out after. A
battle moves the acting god's anchor to the battle site whether it wins or loses, so only the rival's star
returns to its own country; a beaten acting god fades where it stands.

The caption is the newest line of the age that is major, else the newest line there is. It sits in a strip
above the foot, clear of the drawers. It wraps, and it is never cut. It shows only in the ages. The intent cue is a faint ring on each country the god weighed,
brightest on the one it picked, and one line under its star: "Ondru weighs three countries."

Hover gives the region card. It names the country by its poles and by the reason on its newest pole mark. The reason names the god. A backstop reason names no god, and then the god's name and epithet follow the reason. The far side of a line takes the other pole, so a god's epithet beside the country's poles would read as a mistake. It gives the size in sectors, the biome the country is becoming, the gods that stand in it, and every reason a god left on it, by age. Enter or a click opens the first live god that stands in the country. The foot says "No god stands here." when none does.

After settle, hover reads the marks. A hill says who raised it and when. The reason follows only when it is not the stock one, because a stock reason begins with the god's name and says the label twice. A cave says who dug it the same way. A scar says who fought over the ground, and a country row names the country on every surface tile. A card also says which god sleeps in that hill, cave, or country. A hill raised for a den says it was raised for the creatures, not by the act its mark tells of. The sector summary on the world map names the country too, and `C` shows the country lines over the world map.

An age is named as the chronicle names it: `Before time`, then `Age N` counted from the Pulse.

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
- A seventh test: seed `x` is saved on day 35, loaded into a fresh sim, and told to day 70. The fingerprint over both halves together holds to `golden['x']`, the same line the six-seed test reads. It is section 18's oracle, run once more inside the soak's own worlds. The soak grew from about 96 s to about 118 s when this test was added.

No test asserts on a clock reading. Several sessions work on this repo at once, so a test that watches the wall clock goes red when a neighbour is busy, and that teaches everyone to re-run a red gate until it turns green. `tests/ages.js` once held `ms < 3000` for one creation. It failed three times in one night on unrelated branches, and the same tree passed alone each time. It now counts the work instead: at most 60 ages, and fewer discards than `MAX_DISCARDS`, per seed, with the discards over all 24 seeds capped together. A discard repaints the whole world, so it is the unit a slow creation is paid for in. The seeds measure 14 to 31 ages and 0 to 4 discards, so each cap sits at about twice the worst. `tests/ages.js` and `tests/soak.js` both still print their milliseconds as a diagnostic, for a human to read.

Prefer a check that asks a tool to find something. "This line is present" fails loudly when the tool is broken; "no line matches" cannot, because a search that finds nothing is weak evidence of nothing. `tests/clock.js` held two raw NUL bytes, written into a key separator as bytes rather than as the escape `\0`. Node read the file and the tests passed. But `file` called it data, so plain `grep` treated it as binary, and reported no match and exit 1 rather than saying the file matched. A search that should hit returned exactly what a search that should miss returns. Two sessions read `foundRetry` as absent from the file within an hour of each other, independently, and neither doubted the tool. It was on line 51. Escaping the bytes fixed that file. It did not fix the tool, and the next file to acquire one will be just as quiet: `git grep` reads such a file, plain `grep` does not, and it does not say which it did. Fixing the file does not fix the history. `git diff` on the commit that removes the bytes prints them again on the removal lines, so plain `grep` goes quiet on the diff of the repair itself. Anyone who greps the log, or bisects through the old commits, gets the same empty result.

Do not accept a clean result from a detector you have not seen fail: plant the thing on purpose first. The opposite failure was found the same day, and it is not a true mirror: `grep -q $'\000'` in bash truncates to an empty pattern, so it matches every file and exits 0 every time. That one matched ninety-five files of ninety-five, which a reader can see is wrong. The grep failure exits 1, which a script reads as an ordinary not-found. Both are silent; only one has a tell.

`tests/terrain.js` checks the levels, and since the mythos it reads the marks rather than a fixed map. The rules it holds: the surface is level 0 and the levels below start empty; a level apart counts as six tiles; rock does not walk and stone does; a slope joins two floors and a cliff does not; rabbits never climb and deer do; a wolf a level up is no threat; fire burns on a hilltop and is seen from there, not from below; a person walks up a slope and drops a stick on the floor; a carved cave is stone floor that remembers its record; and `keepsPaths` refuses a solid that would cut the last way through. Six soak seeds then carry the world-shaped rules: every hill is rock with reachable floors, off the water and out of the start sector; every water cave sits under a hill of a country a god dug, and carries that country's depth mark; rock fell at the hill feet and blocked some passages, and a boulder taken back leaves its loose rock; every den has one mouth, stands in its owners' country, and holds them; every grove carries a sprite making and lives under a hill of its country when it has one; every cave opens onto the walkable world and every hill stands beside it; each deep chamber holds one find; and no rain or work reaches the dark. A guard test proves some test seed digs a den for each hunter, so a change that stops denning goes red instead of quiet.

`tests/crafts.js` runs each recipe through the real goal offers on a hand-built camp: the offer appears, the person does the work, the thing exists, and the goal moves from blocked to active to done or idle.

`tests/names.js` checks the names: the record's fields, the two streams, the old tongue and its meanings, the namer's axes and its uniqueness rule, who names what and when, epithets and fate, and the layout guard. It is part of `npm run fast`. `SLOW=1 node --test tests/names.js` also runs six 70-day layout checks, one seed at a time, holding the world, the beings, and the items to `tests/names-layout.json`. The tests that need a full day's play share one 70-day run, on seed alpha: it is the one seed of the six that meets every tag inside seventy days, driving off a wolf, meeting the sprites, spearing a deer, landing a fish, and firing a pot.

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
- The den-death assertion has never evaluated a non-empty set. `at most one person a seed dies in a den` asserts `0 <= 1` on all six seeds: no seed has ever produced a den death, so the deaths dictionary holds only the two old-age strings. It is a report, not a gate, and a green result from it means nobody went into a den and died, not that the limit holds. It cannot be given a positive form the way a death net can, because the thing it watches for is a thing that should not happen. Compare issue 72, which fixes the death net by requiring that somebody died at all; no such fix exists here.
- `rockfall` runs a full-map `reachable` for each boulder it lays, to count the cave mouths still joined to the world. It costs 113 to 237 ms a paint, under 2% of a seed's budget. Recorded and deferred: the cheap fix (one walk a hill, not one a boulder) would let two boulders across a narrow way each look safe alone, which is the bug the per-boulder walk was written to catch.
- None of the six soak seeds makes a scar. The scar rows and the scar hatching are held by a hand-written mark in `tests/ui.js` alone.
- A creation is about 20 ages, so it is about 40 seconds at pace 1 before the valley opens. A player who does not want to watch presses `H`.
- Gnomes have no births, so a burrow's line ends when its gnomes die of age, at 110 days.
- The on-demand dig for a burrow that must move may fail several times on a crowded map, trying again every three days.
- Fixed. The soak's cave cutoff check (see section 14) caught a real one: on seed r a burrow's own exit at 2,22,0 went unreachable from the first camp's stash from around day 56 on. The dig itself was not the cause: it was never relocated. A sapling could still take root on a cave's own mouth tile, and twelve days later it matured into a solid tree there, sealing the one doorway a den or burrow has. `growPlants` in `src/sim/world.js` now refuses to plant a sapling on any tile with `t.mouth` set. `digGnomeBurrow` also now checks a live `reachable()` region, not the generation-time `startRegion`, when it digs mid-game (a village driving a burrow off), and keeps a new exit at least 2 tiles from the map edge, so a relocation dig cannot repeat the same mistake by a different route.

## 15. The door

The determinism contract, since the mythos spec. The engine step is pure. Given a state, the next state is fixed. Every act from outside enters by one door, `inject(event)` in `src/sim/door.js`, which logs every lawful event with its tick, applied or not, before applying it. The player's light and poke go through it; chance, an LLM, and a human inhabiting a mob are reserved sources.

A perturbation is checked against the state's invariants, never against what the engine would have done. Every perturbation is visible in the chronicle in the game's voice. An event stamped with tick N was applied after step N and before step N+1. `startWorld(seed, options)` takes the world size in sectors and the level range; `design/settings.md` is the register of start options and future settings.

The acts the door knows: light, poke, priority (a goal set off, on, or high), site (the camp site before the pit is built), load, and the four of Become: `become`, `choose`, `run`, and `watch`, which the Become section describes. The site event carries its camp's id, and the act resolves the camp from that id, not from the global `camp`: on replay `camp` defaults to `camps[0]`, so a site chosen for a second camp still lands on that camp, not the first, when the log runs again. Reachability, once a guard in the interface, is now a guard inside the act itself, checked against the target camp's own first living person. A replayed event carries its tick and must arrive at it; the door answers "Not now." otherwise. The test runner`s replay god throws if it falls behind. Nothing in the interface writes sim state except through the door.

`load` replaces the whole world, so `DOOR_ACTS.load` carries the mark `replacesWorld`. `inject` treats a marked act apart from every other act. It applies the act before it logs. It skips the tick guard, because a save has no tick of its own to arrive late at. On success it logs a bare `{ source, act: 'load', tick }` at the new tick, and never the snapshot.

A refused load is the one exception to "every lawful act is logged whether it lands or not". It is not logged at all. It has no tick of its own to be logged at, and the snapshot it carries can run to megabytes. `loadSnapshot` restores `doorLog` from the save, so the entries before the load are the saved world's own story.

A replay passes over a `load` entry; `logGod` in `tests/lib/run.js` skips it, and the entries after it come from the loaded world's own further play. So a replayed world tells the same story as the loaded one, but it does not hold the same log. The bare `load` entry is not in it. Section 18 has the rest of the snapshot design.

## 16. The clock table

`src/sim/clock.js` holds the calendar, the unit helpers, and one table, `CLOCK`. It loads directly after `core.js`. Every duration and every rate is read from `CLOCK` by name, except the rows of `SPECIES`, `LIFE`, and `RECIPES`, which are written in the same unit helpers (`LIFE` in plain days). The base work rate is the `1` in `workSpeed` in `beings.js`; every `CLOCK.work` entry is a count of strides against that `1`.

What counts as time, in short form:

| Kind | Goes in | Helper |
|---|---|---|
| A duration in ticks | `CLOCK` | `ticks(n)` |
| A duration in whole days | `CLOCK`, as ticks | `days(n)` |
| A duration in strides | `CLOCK` | `strides(n)` |
| A rate per tick | `CLOCK.rate` | `tickRate(p)` |
| A rate per stride | `CLOCK.rate` | `strideRate(p)` |
| A chance that repeats with time | `CLOCK`, beside its period | a bare number |
| A per-species or per-recipe value | its own table | the same helpers |
| A chance rolled once per event | stays where it is | listed in `EVENT_CHANCES` |
| Not time (distances, scores, amounts, multipliers without a unit) | stays where it is | none |

A being runs its task once a stride, not once a tick, so a task's progress threshold and period count strides.

`ticks`, `strides`, `tickRate`, and `strideRate` are legacy markers. Each returns its argument unchanged. A value inside one is still in today's units: a count of ticks, a count of strides, a rate for each tick, a rate for each stride. Plan G4, the retune, replaces every marker with a world unit. When the source holds none of the four, the retune is done. A chance that sits beside its period, such as `birth.chance` or `arrival.villageChance`, carries no marker; the retune changes it together with its period, and `rollFor` is the tool.

The rows of `SPECIES`, `LIFE`, and `RECIPES` stay in their own tables. They are written with the same unit helpers, not moved into `CLOCK`.

`tests/clock.js` lints `src/sim/` for a bare time literal in a rule: a tick added to, a tick compared, a period, a thought's duration, a multiple of `DAY`, an age in days, a progress threshold, a wait, work in a build or a recipe, a stride, a decay, a small step added or subtracted, a need gained, a roll, a legacy marker outside `SPECIES`, `RECIPES`, or `gods.js`, or a world unit written inline. `EVENT_CHANCES` lists each chance that is rolled once per event, not on a repeating period, by the file and the exact text of the roll, with the reason: a snare's catch, a spear's hit, sparks that take, the rocks that prove to be firestones, and the rest. A spear's hit on a deer can roll more than once in one hunt, since a missed deer flees and the hunt goes on; it is still a chance for each throw, so it stays in `EVENT_CHANCES`.

A thought's key and the name of its `CLOCK.thought` entry are two things. Where one key has two durations, the entries take two names (`axeMade`, `axeCut`), and the key string at both sites stays `'axe'`, because a new thought replaces an old one by its key.

`CLOCK.names` is the group naming reads. `nameHour` is the hour of night the nightly naming pass runs. `eventMemory` is how long an event stays a candidate for a name. `epithetAfter` is how long in a camp before the first epithet can be earned. Learning an old name takes no time of its own, so naming adds no entry to `CLOCK.thought`.

The lint cannot see everything. A literal passed through a named constant, a whole-number step such as `t.fire -= 2`, a division of `tick` by a literal, and a new data table with its own field names all pass it unread. A reviewer must catch those.

Left for the retune (G4): `tests/lib/run.js` and `tests/door.js` each hard-code `DAY = 1000`; `src/ui/derive.js` holds pulse durations of 1500 ticks and `src/ui/map.js` refreshes its cache every 40 ticks, and the lint does not scan `src/ui/`; `tasks.js` near line 393 advances tree cutting by its own `1 + a.skills.woodcut * 0.3` and not by `workSpeed`, which plan G2 can fold in; `hours`, `mins`, and `secs` return fractions of a tick while `DAY` is 1000, so a caller must round; `CLOCK.thought.over` and `CLOCK.thought.wouldnothold` count ages of a god, not ticks.

The soak's six-seed fingerprint did not move through the whole plan. G1 is a pure refactor: every literal moved to `CLOCK` at its same value, in the same order of rolls.

## 17. Tasks as data

A task used to be a closure: an object built by a `startX` function, carrying an `arrive` function that closed over whatever it needed — a being, an item, a tile, a struct. A closure cannot be saved, cannot be read without running it, and cannot be handed to a second executor. Plan G2 made a task a plain record instead: `{ kind, type, args, stop, path, label, progress, started, key, ... }`, holding only numbers, strings, booleans, null, and arrays and plain objects of those.

`kind` is the key into `TASKS`, in `src/sim/tasks.js`, and one kind means one behaviour. `type` is the category the rest of the rules already read off `a.task.type` (`'work'`, `'gather'`, `'flee'`, `'sit'`, `'guard'`, `'hunt'`, `'travel'`, and so on); it kept every value it had before the conversion, because `updateBeing`, `chooseTask`, and the interface compare it. `args` holds what the task is about: ids, an index, coordinates, item kinds, counts. `stop` is which of the kind's stops the task is at; today's `t.arrive = ...` reassignment became `t.stop = 1`, `t.stop = 2`, and so on.

`TASKS[kind]` holds what a kind does:

| Entry | Meaning |
|---|---|
| `type` | The record's default `type`. `begin` may return another. |
| `begin(a, args)` | Everything a `startX` did before it built the task: the checks, the search for the target, the first path, a reservation, a chronicle line. Returns the record's other fields, `false` when the task cannot start, or `true` when it handed over to another kind. |
| `stops` | An array of functions `(a, t)`, one for each place the task visits. The executor calls `stops[t.stop]` once the path there is walked, on every stride, until it returns `'done'` or `'fail'`; `'continue'` runs it again next stride. |
| `release(a, t)` | What the task lets go of when it ends, well or not: a claim, a reservation, a brand. This is today's `cleanup`, folded together with the old `fail`, since both amount to letting go of what the task held. |
| `work`, `effect` | Declared by `workKind` for a job done at one place: `work` is the world time from `CLOCK` and the skill that speeds it, `effect` is what changes when the work ends. Plan G5's day tier can run a job with declared `work` without walking it stride by stride. |

A record holds no reference to a being, an item, a tile, a camp, a cave, or a grove. What a closure once held by reference, `args` holds by id, by index, or by coordinates, found again when the task needs it: a being by `beingById(id)`, an item by `items.find(i => i.id === id)`, a tile by `tileAt(x, y, z)`, a snare or a pit by `tileAt(x, y).struct`, a cave by `caves[i]`, a camp by `camps[i]`. A grove is read again off the being's own `a.grove`; no rule reassigns it. A den works the same way: the gnome kinds (`home`, `carryHome`, `huddle`, `borrow`, `repay`) all read the gnome's own `a.den` fresh each time. `caves` and `camps` are never spliced once the world is made (checked with `grep -n "caves\.\(splice\|pop\|shift\)\|caves = \|camps\.\(splice\|pop\|shift\)\|camps = " src/sim/*.js`), so an index still names the same cave or camp for the life of the task.

The helpers: `startTask(a, kind, args)` deep-copies `args` (`JSON.parse(JSON.stringify(args))`, so a record never shares an array with an offer or a camp's own state), calls `TASKS[kind].begin`, and sets `a.task`. `setTask(a, kind, args, fields)` sets the record directly, for a task whose path is already in hand. `goTo(a, t, x, y, within, z)` is the walk-on check twenty tasks used to repeat inline: null when the being is already close enough, a new path and `'continue'` when it walks there, `'fail'` when there is no way. `taskStop(a)` runs the current stop once: `TASKS[a.task.kind].stops[a.task.stop](a, a.task)`.

`chain(a, old, ok)` is unchanged. `workKind({ label, amount, skill, effect, ... })` builds a kind for a job done at one place, declaring `work` and `effect` and writing `stops` itself. `pathToStop` is what the spec called `legPath`.

An offer is `{ label, score, task: { kind, args } }`. A site an offer draws from `rng()` — where a snare sits, which spot is open — is still chosen when the offer is built, in `offers()`, not inside `begin`; only the timing of what the offer carries changed, not the order or count of rolls.

A kind's `begin` is one of three sorts:

| Sort | What `begin` does | Kinds |
|---|---|---|
| Ordinary | Returns the record's fields; the stops run stride by stride. | Most kinds. |
| Dispatch only | Hands the being another task with `startTask` and returns `true`; the one stop never runs. Every kind still needs a `stops` entry, for the shape all kinds share. | `chooseSite`, `leadParty`, `denParty` |
| Record only | Returns `false`. The kind is never reached through `begin`, only through `setTask`, which sets the record directly. | `walk`, `walkTo`, `followBrand`, `comeHome` |

`tasks.js` loads before `beings.js` in `src/sim/index.js`'s `FILES`, because `beings.js`, `species.js`, `fae.js`, `goals.js`, and `recipes.js` all add kinds to `TASKS` as they load. `camps.js` loads before `tasks.js`, so the two kinds camps needs before it exists, `join` and `leadParty`, live in `tasks.js` and `goals.js` instead.

Of the 77 kinds in `TASKS`, 26 declare `work` and are done at one place: `buildFirepit`, `buildHut`, `buildLeanTo`, `buildRack`, `butcherDeer`, `checkSnare`, `cookCatch`, `cookFish`, `craft`, `feedFire`, `haulPit`, `knapAxe`, `layFire`, `leaveBerries`, `lightWithMoss`, `makeSpear`, `raiseStorehouse`, `rearmSnare`, `setOfferingStone`, `setSnare`, `setWardPosts`, `sewWaterskin`, `smokeFish`, `smokeMeat`, `strikeSparks`, `testRocks`. The day tier can run any of these without walking a single stride. The other 51 are stride by stride, with no one place and no declared `work`: the base kinds (`drink`, `eat`, `rest`, `sit`, `shelter`, `sleep`, `wander`, `flee`, `walk`, `walkTo`, `socialize`), the gathering family (`deliver`, `gather`, `pickBerries`, `pickFibre`, `fish`, `digClay`, `takeCuttings`, `quarry`, `cutTree`, `fillWater`), the chases (`hunt`, `stalk`, `huntDeer`, `driveOff`, `fightSprite`, `raid`, `herd`, `scavenge`), the gnome and sprite loops (`home`, `carryHome`, `huddle`, `borrow`, `repay`, `shrooms`, `dance`, `forage`, `watch`, `collect`, `prank`), and the founding and cave kinds (`chooseSite`, `join`, `leadParty`, `clearDen`, `denParty`, `clearRock`, `searchCave`, `brand`, `followBrand`, `comeHome`, `fetchEmber`). Plan G5 must give each of these a day-tier answer of its own; the day tier cannot yet run a hunt or a haul in one step.

A lookup that comes back empty now ends a task the way the old code ended it for a dead or a missing thing, in every case the conversion found:

| Kind | What was found again, and what happens when it is gone |
|---|---|
| `hunt`, `stalk`, `huntDeer`, `driveOff`, `fightSprite` | The prey, the person, the deer, the wolf, or the sprite, by `beingById(id)`. A dead one fails the chase, as it did when the closure held a dead being directly. |
| `socialize`, `scavenge`, `gather` | The other person or the item sought. Not found fails the task, as a vanished target did before. |
| `huddle` | The gnome takes its own warmth gain regardless, then looks for the kin it huddles with; a kin not found is skipped, exactly as the old closure never checked whether the kin still lived. |
| `checkSnare`, `haulPit`, `rearmSnare` | The snare or the pit, read again by its tile. A struct destroyed since (burned, or struck by lightning) means nothing happens where the old closure, holding the object directly, still acted on it — a carcass taken from a burned snare, a stick spent rearming one that had already gone. A snare or a pit rebuilt on the same tile while a person walks toward it is read in its place; a freshly built one holds no catch, so nothing follows either way. |

The soak's six-seed fingerprint did not move through the whole plan. Every task of G2, from the first kind converted in task 1 to the executor's last mode removed in task 9, is a pure refactor: the golden record is the one written before G2 began.

### What the later plans must answer

The whole-branch review of G2 left these for the snapshots (G3) and the day tier (G5).

| Plan | Point |
|---|---|
| G3 | The global `camp` is a hidden input of every stride. `updateBeing` sets it from `a.camp`. A loader that calls a stop or an effect outside `updateBeing` must set `camp` first. |
| G3 | A record names a cave or a camp by its index. A snapshot must keep the order of `caves` and of `camps`. |
| G3 | The reference table still owes the edges that are not tasks: `tile.struct.snare` and `camp.snares[i]`, `tile.struct.pit` and `camp.pitfalls[i]`, `tile.struct.camp`, `being.den`, `being.grove`, `cave.from`, `cave.cleared`, `cave.searched`, `grove.sector`, `grove.cave`, `sprite.target`, `being.shyOf`, `tile.garden`, and `den.holding.camp`. |
| G3 | A JSON snapshot splits some shared arrays, and no rule minds. `workKind`'s `target` is the same array as `args.at`. A finished build sets `camp.shelter`, `camp.rack`, and their like to the task's own `args.at`. Every rule compares them by value. |
| G5 | No `effect` reads its third argument or a field the stride loop sets. The day tier can pick the site and call `effect`. It must set `camp` first, as `updateBeing` does. |
| G5 | `workKind`'s `begin` returns false when no path exists. The day tier wants a reach test and a distance, not a path. Split the two there. |
| G5 | Five kinds write another being's task from inside a stop: `hunt`, `stalk`, `huntDeer`, `driveOff`, and `fightSprite`. The `defendDen` step in `updateBeing` does the same. `clearDen` hands the mate a whole task. A queue for each being must cope with an entry that another being's turn replaced. |
| G5 | A chain starts the next task in the same step: `gather` to `deliver`, `cutTree` to `gather`, and `brand` to the kind in `args.next`. `brand` is the one record that carries another kind's whole offer. |

## 18. Snapshots

| Piece | What it does |
|---|---|
| `takeSnapshot()` | The whole state as one plain object. Taken between steps, in the days era only. Changes nothing and draws nothing from a stream. |
| `loadSnapshot(snap)` | Builds a fresh world in a stage, then replaces the state. Returns `null` on success, else the sentence that says why not; a refusal leaves the state untouched. |
| `REFS` | Names every field of every record that points at another record, and the kind it points at. `tests/snapshot.js` fails on a reference `REFS` does not name. |
| The door's `load` | The one way a snapshot enters play. It replaces the world and logs a bare entry; a refusal logs nothing. See section 15. |
| The oracle | Save mid-run, load into a fresh sim, run on: the chronicle, the fingerprint, and the two snapshots all agree with a straight run. Eight cases, plus a ninth soak test. |
| Save, Load, autosave | The page writes a file, reads one, and keeps one autosave slot in IndexedDB, written at the first frame of each new day. |

**What a snapshot holds.** Everything the rules read, and nothing that can be rebuilt from it.

| Group | Fields |
|---|---|
| The world's name | `version`, `seed`, `options` |
| The clock and the counters | `tick`, `nextId`, `fireCount`, `wanderAt`, `doomAt`, `era`, `age`, `pulseAge` |
| The streams | `rng`, `godRng`, each as one position |
| The ground | `levels`, `raised` |
| The records | `hills`, `caves`, `sectors`, `groves`, `strayGroves`, `camps`, `campNow`, `beings`, `items`, `corpses` |
| The story | `lines`, `chronicle`, `legends` |
| The rest of the state | `weather`, `goalPriority`, `namePool`, `godNamePool`, `gestureFallbacks` |
| The creation | `creation`, `field`, `boundaries` |
| The caches and the log | `resCache`, `startRegion`, `doorLog` |
| The player | `inhabited`, `inhabitedTold` |
| The names | `nrng` as one position, `lore`, `tongue`, `valley`, `river`, `stillWater`, `ponds`, `fords`, `lostNames` |

`campNow` is the index of the global `camp`. The spec (section 3) names a placement stream among the state a snapshot holds. No such stream exists yet, because plan G has not reached it. The snapshot holds the two streams the sim has today, `rng` and `godRng`.

**The versioning policy.** A field added after version 1 is read as optional, with the value a world that never had it holds. The helper is `snapOpt(v, fallback)`. The version stays 1. It rises only when the meaning of a field already saved changes, and a save of an older version is then refused with its own sentence. The reason is the autosave slot: Continue offers what that slot holds, and a rebuilt page must not turn every player's Continue into a refusal. `inhabited`, `inhabitedTold`, and `strayGroves` were the first three fields added this way. The name fields followed: a save written before the naming work holds no `nrng`, and the loader then seeds the name stream as a fresh world seeds it, which is what a world that named nothing holds.

**What it rebuilds instead of saving.** The loader rebuilds `world` (`levels[ZOFF]`), `itemGrid` (from `items`), `regionOf` and `field.byId` (by a walk of `field.regions` in order), the search scratch, and `replayHead`. `deciding`, `saidFrom`, and `settleNow` live inside one step, and the loader sets them as `beginCreation` does. `agePos`, `pending`, `runUntil`, and `stops` live only in the ages. The loader resets all four, so a save loaded while a god's turn is open leaves no turn standing.

A guard test reads every top-level `let` and `var` the sim declares. It holds each name to one of two lists in `src/sim/snapshot.js`: `SAVED_STATE` or `NOT_SAVED`. A new piece of state fails the test until someone names it in one. `doomAt` was caught this way. Another session added it after the plan was written, and the guard put it in `SAVED_STATE` beside `wanderAt`.

**How a reference is named.**

| Kind | Target | In the snapshot |
|---|---|---|
| `camp`, `cave`, `hill`, `grove`, `sector` | that kind of record | its index in the record's own list |
| `region` | a region of the field | its `id` |
| `tile` | a tile | `idx3(x, y, z)`, one number |
| `tiles` | an array of tiles | an array of those numbers, in order |
| `mark` | a mark in a `region.marks` | `[regionId, indexInMarks]`; a mark in no region is saved whole, shared with nothing |
| `snare`, `pit` | one in a `camp.snares` or `camp.pitfalls` | `[campIndex, indexInList]` |
| `body` | a god's body: a hill, a cave, or a region | `{ hill: i }`, `{ cave: i }`, or `{ region: id }` |
| `line`, `lines` | a chronicle line | its index in the snapshot's `lines` list |
| `water` | the great water: the river, or the lake where no god drew a river | `'river'` or `'still'`, which says which global it is |
| `pond`, `ford` | one in `ponds` or `fords` | its index in that list |

A chronicle line sits in `chronicle`, in `legends`, and in each being's `history`. The snapshot holds each distinct line once, in `lines`, in the order first met, and the three lists hold indexes into it, so the sharing survives the round trip. `camp.snares`, `camp.pitfalls`, `region.marks`, and `field.regions` are homes, not references: a record met there is written whole, not pointed at.

**A record that leaves its list.** Every kind above names its record by its place in one list. That assumes a record never leaves its list while something still points at it. One kind breaks the assumption. `burnOut` takes a grove out of `groves` when its hollow pine burns, and the sprites of that grove keep pointing at it until the last of them dies.

Such a grove is a stray: it is named `{ stray: i }` and written whole into `strayGroves`, once, so the sprites that shared one object share one object still. The general rule now sits in the comment above `REF_KINDS`. Before you add a kind, ask what removes a record of it, and whether anything can hold the record after.

No other kind loses a referenced record in play. Every `caves.splice` call drops a cave pushed a moment before, inside the function that made it. `burnOut` takes a burnt snare or pitfall out of its camp and clears `tile.struct` in the same step, so nothing points at it after. `setPole` filters a country's marks, but it drops only pole marks. A hill, a cave, or a grove never holds a pole mark.

Three other places filter marks: the battle win in `gods.js` near line 297, the backstop in `gods.js` near line 488, and `undoSettle` in `settle.js` near line 107. They drop only pole, scar, height, depth, or rest marks. All four filters run only in the ages, before a hill, a cave, or a grove of the settled world holds a mark.

**The names.** `findWaters` makes the water, the pond, and the ford records once, on the tick the land is named, and nothing takes one out again. No tile stops being water either. So each of the three kinds keeps its place for the life of the world, and none of them needs a stray path. A water tile points at its record in `t.water`, a pond tile in `t.pond`, and the sand of a crossing in `t.ford`, and each of those three fields is a row of `REFS`.

`nameIndex` and `usedMeanings` are not saved. `rebuildNames` in `src/sim/names.js` reads both back out of the saved name records, oldest record first, by the tick each name was given on. That is the order `giveName` wrote them in. No two things ever carry one text, so the order inside one tick decides nothing. A meaning is used when an old name carries it, so the land words on the saved records are exactly the meanings `takeMeaning` handed out and kept.

A grove that left `groves` while a sprite still holds it is reached the way the rules reach it, through the sprites. The snapshot saves it whole in `strayGroves`, and `rebuildNames` walks it there, so the index holds its old name against the one object the sprites share. `nameThings` reads the `groves` global and so gives no stray.

Two things the index holds that nothing else reaches. A named event whose line the chronicle has dropped: it keeps its last 300 lines, and a line can fall out of all three lists. And a named grove that burnt out of `groves` and then lost its last sprite, because the prune drops a dead sprite from `beings`. Either way the text stays taken, so no other thing is ever given it.

`lostNames` holds those names, and `rebuildNames` takes them with the rest. It saves the name records only, never the thing. A thing here can hold references a save must not copy: a grove holds its cave, the cave holds its tiles, and each tile points back at the cave, so a deep copy of the thing would walk a cycle. The loader gives each saved list to a holder object of its own, which lives only in the index. That is all three readers of the index ask for: `nameTaken` reads the key, `nameRecordOf` reads `thing.names`, and the owner test in `scoreCandidates` compares by identity against the thing being named, which a holder never is. A day-23 save of the small valley of seed alpha holds three.

`lostNames` grows by one entry for every named event, for the life of the world, and nothing prunes it. That is right. A name is taken for ever, and dropping an entry would set its text free for another thing to take, which would change what the world names next. An entry is a few hundred characters, and a world names a handful of events a day.

The `{ whole: mark }` path is the net under that: it saves such a mark whole, and a mark shared by two holders would then come back as two objects. Several caves can share one mark, so that net is not free, and a mark that could leave its region would want a stray path of its own.

**Why `resCache`, `startRegion`, `raised`, and `fireCount` are saved though each can be rebuilt.** Each can be recomputed from the rest of the state. A rebuilt value can differ from the live one. The difference can move the random stream that runs after it, or break a rule that reads it. The oracle proved each one by removing it from the loader in turn.

Without `resCache`, seed `r` parted from its straight run. Without `startRegion`, a den dug after the load threw inside `rimExits`. A sorted `raised` broke a burning world's spread, and a zeroed `fireCount` did too. All four are saved verbatim and restored verbatim.

**The stage and the refusal.** `loadSnapshot` first checks the version, that the save was taken in the days era, and that its options pass the same checks `setOptions` does, without setting anything. It then builds a `stage`, a half-built world of its own: every list of records, sized from the save's own options, with every id still in place. It walks `REFS` and turns each id into the staged record; `fromId` throws on an id that names nothing. A throw at any point returns `'This save cannot be read.'`, and nothing outside the stage has been touched.

The reason it threw is kept in `lastLoadFault`, which the page writes to the console behind the plain sentence. Only once the stage is whole does `loadSnapshot` commit: `setOptions`, every global, the two streams, and the derived state, in that order. Nothing in the commit can fail, so the state is never half replaced.

**A save file is outside data.** A refusal is enough for a save that is merely wrong. Some are worse: they load, and then kill the page a step later. The stage checks the keys the rules index blindly, because a rule that meets an unknown key reads `undefined` and throws.

Every `being.species` is a key of `SPECIES`, every tile `ground` a key of `GROUND`, and every `feature` that is not null a key of `FEATURES`. Every `item.kind` is a key of `ITEMS`. Each camp holds an object at `stash`, `fae`, `rot`, `tools`, and `gnomes`, and a place inside the map at `pit`, `stashTile`, and `site`. A region's tiles are indexes inside `regionOf`. The tick and `nextId` are whole counts that adding to keeps exact.

This is not a schema validator. It closes the crashes the fuzz run could show, and no more.

**The frame loop's guard.** The loader cannot close every crash, so `frame()` wraps the stepping in a `try`. A throw pauses the game, says "The world stopped on a fault. Load a save or make a new world.", and goes to the console. The frame loop itself runs on, so the page still draws and the player can load a save.

**The oracle.** Each case runs a world once whole, saves it mid-run, loads the save into a fresh sim, and runs both worlds on. Three things must then agree: the chronicle lines, line for line; the fingerprint over the run-on; and the two snapshots, compared by value and as text, so a difference in key order would show too.

| Case | What it was picked for |
|---|---|
| `r`, `x`, `gamma`, default size | a founding, two storms, and a grown valley with huts and a spear |
| `alpha`, small | snares and pitfalls in the ground, and two camps |
| `r`, small, woods alight | `spreadFire` walks `raised` and draws from `rng` on both sides |
| `r`, small, before a den is dug | `startRegion` is read through `rimExits` |
| `beta`, default size, late | a grown valley with a gnome burrow that holds a thing (`cave.holding`) |
| `r`, small, a hollow pine burnt out | a grove that left `groves` under a living sprite, saved as a stray |

A ninth test lives in the soak: seed `x` is saved on day 35, loaded, and run to day 70, held to the same golden line the six-seed test reads.

Task 4 found no fault: every oracle case passed on its first run. To prove the oracle has teeth, the loader was broken six ways, one at a time, and run against the case built to catch it:

| Sabotage | Caught by |
|---|---|
| `resCache` dropped, an empty map put in its place | seed `r`'s case |
| `startRegion` dropped | the den case, which throws inside `rimExits` |
| `raised` sorted by tile index instead of kept in its own order | the burning-world case |
| `fireCount` zeroed | the burning-world case |
| chronicle lines copied per list, so the sharing is lost | seed `r`'s case |
| the global `camp` forced to `camps[0]` | nothing, and rightly: `step` already resets `camp` to `camps[0]` at the top of every days tick, so between steps it holds no reading the oracle could catch |

The oracle has not yet run a case with an angry grove, or with a mark saved whole (one that lives in no region). Neither occurred in the worlds it used. Four of the eight cases run at a size smaller than the default: the pitfall valley, the burning world, the den world, and the burnt hollow.

**What the guards catch, and what they cannot.** `unnamedRefs()` walks every record and every saved global. It reports three things. The first is a field that points at a record and that `REFS` does not name. The second is a `Map` or a `Set`, which the encoder would turn into `{}` without a word. The third is anything else that is not plain data, such as a class instance or a typed array.

The saved globals come from `savedValues()`, a table that a test holds to `SAVED_STATE`. So a new saved global is walked without anyone remembering to add it. `field.byId` is the one exception. It is listed in `REF_DERIVED`, because the loader rebuilds it.

Two lints read the sim's source. The first finds every top-level `let` and `var`, whatever shape it takes, and holds each name to `SAVED_STATE` or `NOT_SAVED`. The second finds every top-level `const` that holds a container, and holds each to `KNOWN_CONSTS` or to a list of frozen tables. Both read the whole file text with comments, strings, and regular expressions blanked, so a keyword inside one is not read as code.

What they cannot see is state hung on a function object, such as `f.count = 0`. A grep catches the shape the sim uses, an assignment into a dotted name at the start of a line, and the known ones are listed. State hung on a function elsewhere would pass all three.

**The measured numbers**, day 40 of seed `r`, a 3 714 317-character save:

| Step | Time |
|---|---|
| `takeSnapshot()` | 12 to 17 ms |
| `JSON.stringify(snap)` | 8 to 11 ms |
| `JSON.parse(text)` | 5.2 ms |
| `loadSnapshot(snap)` | 13 to 21 ms |

A save and a load together take well under 50 ms, so the page writes the dawn autosave inline in the frame rather than off a timer.

**The page, and what it cannot do.** A save that cannot be taken is said once, in the foot, and the reason goes to the console; it is never swallowed. `saveWorld` says "Saving <name>." and not "Saved as <name>." The page hands the file to the browser and is never told what became of it. A sandbox can refuse the download without an error. A Continue slot whose `tick` is not a finite number is treated as no save, so the start dialog never offers day NaN. Ctrl+S and Ctrl+O are not caught while a dialog is open, as Ctrl+N is not: inside a dialog only that dialog's own keys fire.

**A save is taken only in the days era.** In the ages the seed replays the creation, so no snapshot is needed there. The cost falls on Become: a page reloaded in the middle of a steered creation loses that creation. It comes back only when god-era replay or an ages snapshot exists. A world that reached the valley carries `inhabited` and `inhabitedTold` through a save, so the player is still the god they took.

A replayed world tells the same story as the loaded one, but not the same log. See section 15.

## 19. Become: the player takes a god

The first slice of the inhabit modes. The player is one god during the creation ages. The simulation only: no interface yet, so the acts are reachable from the console and the tests. The spec is `design/specs/2026-09-18-become-a-god-design.md`, and the plan is `design/plans/2026-09-18-become-plan-e1-the-lock-and-the-choice.md`.

It was built as an instrument before a feature. The ages do not read to a player who only watches them, and the cause is not known. Playing them is how the cause gets found.

- **Four acts.** `become` takes a live god, or leaves with a null id. `choose` takes one option from the open matrix. `run` hands the god back to the engine until a mark. `watch` sets or clears a mark. `become` carries a mode, and `possess`, `vessel`, and `manifest` are refused by name. `run` and `watch` share one shape, `{ what, at }`, and `what` of `age` is the only kind built.
- **The turn lock.** `pending` holds whose turn is open and the matrix that god was given. The engine will not step while it is set. This is the locked clock the mythos spec reserved.
- **A resumable age.** `ageStep` was one `withGodRng` closure over a whole age. It is now `ageBegin`, `ageDecide`, and `ageEnd`, with the position on `agePos`. `withGodRng` swaps the stream and restores it, so entering it twice in an age draws what entering it once drew, and a test holds that on the god stream itself.
- **The gods of an age are snapshotted once.** `gods()` is `beings.filter(...)`, a fresh array on every call, so the original loop iterated one snapshot and a god born mid-age waited for the next age. The list is taken once in `ageBegin` onto `agePos.list` and never retaken, so a suspended age resumes through the gods it began with.
- **Once-per-god work happens once.** `settleHome`, `godNeeds`, the dropping of an unfinished act, and the drawing of `godOptions` all run once for the god at the position, however many times the age suspends and resumes. `agePos.prepared` and `agePos.opts` are the guards. Getting this wrong drew from the god stream twice and was the worst bug of the slice.
- **An unfinished act is dropped before the turn is weighed**, not inside `decideGod`. A god that will not carry its act on has a free choice, and the player is owed it. While the drop lived in `decideGod`, the engine made that choice and the matrix was never shown.
- **The matrix is the sim's.** `godOptions(g)` is called once, kept, shown, and applied. The interface will score nothing. An option is named by its act and its country, never by an index, because a list sorted by score is not stable across a replay. A chosen option that does not land leaves the turn open with its row marked failed; the autonomous god falls to the next in silence, and the player is owed the reason.
- **What a god will not do.** `GOD_BARS` names, for `battle`, `burn`, and `mingle`, the trait its score already reads and a floor under which the player is told no. **A bar is a lens on the matrix the player is shown. No rule reads it.** That is what keeps a steered creation lawful and an unwatched one unmoved. Force Actions, `options.force`, takes a barred option anyway, and it costs the god nothing.
- **The player's lines are not legends.** In the gods era every `log()` line joins `legends`, and the legends are the creation's own story. A hand reaching in is not part of it, and a legend that differed would break the equality the whole slice rests on. `note()` writes a chronicle line and no legend. The door log is the record of what the player did.
- **The age is in the stamp.** An age is the step in the gods era and the tick stands still, so every act of every age carried the same stamp. The door stamps the age there. The days era is unchanged.
- **Every god's choice is kept.** `decideGod` always built the matrix, what it picked, and what failed; the next age threw it away. It is appended to `creation.choices` instead, one entry for each god that decided in each age. No new scoring and no new draw. This is what the timeline will read.

### The timeline, and what it said about the ages (E2)

E2 put the record on the screen. The band is a third row of the `.app` grid, under the map. **The foot did not move**: it is absolutely positioned inside `.mapbox` and belongs to the map, whose cursor it names, so the order down the screen is the strip, the map with the foot floating at its bottom, then the timeline.

- **Folded**, one row: every act of the creation in age order, each prefixed by whose it was. **Unfolded**, `T`: a row for each god and a row for the rest gate.
- **A column is an age.** Every row carries one cell for every age in the span, blank where that god did not act, at a fixed width. The first draft packed the cells from the left, so a god who acted three times had its cells under a god who acted ten, and reading down a column meant nothing. That is the whole value of the unfolded view, and no test caught it; it was found by measuring the page.
- **The zoom is its own time axis.** `[` and `]` show more or fewer ages while the band holds focus, and stay the map's level keys everywhere else. The band takes a focus name of its own, and the dispatcher already runs focused rows before `any` rows.
- **A chip opens its matrix in the foot**: what that god weighed, each option's score, which the ground refused, and which was taken.
- **Which row was taken is derived, not stored.** `decideGod` walks the options in order, marks each one that cannot land, and returns on the first that lands, so for a record the engine wrote the taken row is the first row with no `failed` flag. That rule does **not** hold for a record a player made: `takeTurn` applies any row by name and marks only that one. So the view derives the taken row only when the record is not `byPlayer`. **E3 must record which row a player took**, or the foot cannot mark it.
- The band builds nodes and sets `textContent`; no string out of the simulation is parsed as markup there. The foot is the usual `panels.js` HTML string, and every simulation string in it passes through `esc`.

**What the band said about the ages.** The question E2 existed to answer was why the creation does not read to someone watching it. Three seeds run to settle:

| Seed | Ages | Gods | Born in age | Decisions |
|---|---|---|---|---|
| gamma | 19 | 8 | 1, 2, 3, 4, 5, 7, 7, 10 | 78 |
| r | 21 | 6 | 1, 2, 3, 4, 13, 14 | 73 |
| beta | 19 | 8 | 1, 2, 3, 5, 5, 8, 12, 13 | 85 |

The fault is not that the information was missing. It is that it was never held still.

- A creation is about **eighty decisions by up to eight actors**, and at pace 1 an age is two seconds, so the whole thing is over in **about forty seconds**. That is half a second a decision.
- **The cast grows while you watch.** The pantheon goes from one god to six or eight, and nothing on the map ever said so. The staircase of blanks down the left of the unfolded band is the birth order, and it is information a watcher never had.
- **A third of every creation is one act.** `split` is 26 of 78 on gamma, 19 of 73 on r, and 39 of 85 on beta: 33, 26, and 46 per cent. It is the commonest act on two of the three seeds, and on `r` it ties with `make` at 19 apiece. On the map a split looks like a country dividing, every time, so the act that happens most is the act that looks most alike.
- **Each god has a habit**, and the habit is legible only across ages: on gamma, Morrow only ever moves water, Nyr only ever divides, Veyl spends most of its time finishing multi-age work.

So the timeline is not a convenience. It is the only thing in the interface that holds a decision still long enough to be read, and the only place a god's habit is visible at all. Whether it is *enough* is a question for playing it, and the answer belongs here when it is known.

**The gate.** A creation the player steered by taking the best row every turn is the creation `startWorld` runs alone, line for line, on all twenty-four seeds of `tests/ages.js`. Every age suspends and resumes on that path, and the test counts the turns it opened and fails if none did. `tests/become.js` holds the rest: the acts and their refusals, the bars, the reuse of a matrix across a suspend, exactly one decision for a god whose turn was abandoned, and a creation run entirely on autopilot.

**Not built, and named so nobody assumes it.** God-era replay. `doorLog` carries the age, but `replayGod` in `tests/lib/run.js` selects by tick, every god-era act shares one tick, and `runDays` starts after settle. A steered creation is logged; nothing replays it yet. Also not built: a stop on an event, which needs an `event` kind on every chronicle line, and that is G section 7.

### The beat (E3)

E2 said the ages were never held still. E3 holds them. The unit of playback is **one god's act**, not one
age: `BEAT_MS` is 1000 ms, and an act is drawn over its beat with the act before it fading underneath.

**Why Step cut.** Step advanced the world and redrew it. Between one frame and the next the field changed
shape, a country divided, and nothing carried the eye from the old picture to the new one. A stepped age
was a slideshow, and a running one at the old speeds was far too fast to read. Neither end of that range
was watchable, and the fault was the same at both ends: no motion in between.

**The pace ladder is its own.** The ages run on `PACES = [0.25, 0.5, 1, 2]`; the days keep
`SPEEDS = [1, 4, 16, 64]`. Nothing above double, because a creation is minutes of a game measured in
hours, and the question in the ages is always whether the player can read what just happened, never
whether they can get through it faster. `H` hurries to the valley and now **asks first**: it is the one
irreversible thing in the ages, and it used to happen on one keystroke.

**Pacing is view state and never passes the door.** `beatsDue(acc, dt, pace)` is the only place the ladder
is consulted, and it is in the frame path. A door log must replay the same story at whatever rate it was
drawn at. The gate for this is a door log replayed at `PACES[0]` and at `PACES[3]` with the same
fingerprint, and it has to be driven in the browser: a `step()` loop in Node never calls `beatsDue`, so
both runs would be the same run twice and the match would be guaranteed by the method rather than the code.

**The four conditions `gods.js` set**, which are requirements and not preferences:

| Condition | The reason |
|---|---|
| A flag on `ageDecide`, not a second entry point | A second entry point is a second copy of the `while (agePos.i < list.length)` loop and of the `prepared`/`opts` invariant |
| The return goes after `agePass()`, inside the awake branch | Return before the position advances and the resume re-enters the same god with `prepared` already true, so `decideGod` runs twice against a matrix drawn once. That moves the stream |
| `ageDecide`'s `false` is now ambiguous, and the file says so | It used to mean only that a turn is open; it now means that *or* that one act is done. `pending` tells them apart |
| `takeTurn` stops resuming the age at all | A flag on `takeTurn` would ride the event through `inject` and be logged, and then pacing passes the door |

The fourth is the one the whole slice rests on. Because a step is the only thing that carries an age on,
whoever asked for the act, **the view never needs to know whether an act came from the player or from a
god**. A branch on `byPlayer` anywhere in the playback path is a fault in the engine, not in the view.

**Each act shows its face.** `MARKS` in `src/ui/marks.js` gives every act kind a drawn mark and a word:
data and path strings only, no canvas calls. The mark is drawn on the ground that changed and fades with
the act it belongs to, and the word is the line the act itself wrote. An act that wrote no line is silent
rather than captioned with something borrowed. Hovering the mark, or clicking the act's cell in the
timeline, opens the same card.

**The timeline lights the act being played**, so what the player watches and what the player reads name
the same act at the same moment. The lit cell is the turn on stage. Two things make that harder than it
sounds. A decision can write more than one gesture — a split that also gives birth writes a `split` and a
`born`, and the birth is credited to the newborn, who has no row of its own — so the lit cell follows the
turn and not the newest gesture. And `unmake` and `backstop` run from `ageEnd`, after every god in the age
has finished, and write no turn at all: on those beats nothing is lit, because nothing is on stage.

**A beat is not an act, and the two numbers differ by the number of ages.** A beat is one `step(true)`:
one unit of playback, and what the pace governs. Most beats are one god's act and are recorded in
`creation.choices`. Exactly one beat per age is the age's **close**, where `ageEnd` runs: it decides
nothing and writes no choice, but it can write an `unmade` or a `backstop` gesture. So
`beats = acts + ages`, exactly, on every one of the 32 seeds measured. That closing beat is the one the
timeline lights nothing on, because no turn is on stage.

**How long a creation is.** Measured on 32 seeds, by stepping `startCreation` to settle: **78 to 229
beats**, median 102 — which is **62 to 197 acts**, median 82, over 15 to 32 ages. The E3 plan said 43 to
110 acts, and neither end holds. At pace 1 the median creation is about a minute and three quarters and the longest is
near four minutes; at a quarter pace the longest is a quarter of an hour. That is the argument for
nothing above double on the ladder, and it is also the reason `H` exists and has to ask first.

**Take a god** is on the start dialog, and `Alt+G`. It adds no power: it is E1's `become` through the door.
A slice about what the player experiences has to be reachable by a player, and the ages could not be tested
by hand without a way in.

**Two limits, named so nobody assumes otherwise.** The act card comes up from a timeline cell only for the
age still playing: `creation.gestures` is replaced at the head of every age and is one age deep, not
history. An older cell keeps the chip card E2 gave it. And `Take a god` begins the first age by calling
`ageBegin()` from the view, because no god exists until an age begins — that call does not pass the door
and is not in the door log. Nothing depends on it today, because god-era replay is still not built, but
`nextId` is one counter for beings, camps, regions, boundaries, items and caves alike, so a replay that
skipped the call would shift every later id and not merely fail one lookup. The fix is a door act that
begins the ages, so god-making and the take happen inside one logged act.

**A background tab runs no frames.** `requestAnimationFrame` stops in a background Safari tab, so the beat
loop stops with it and `onSettle()` is never called. Crossing the era boundary in a tab that is not in
front looks exactly like a bug and is not one. Call the frame by hand when driving the page headlessly.

## 20. Next

- Life clocks were the last round. Sprites and settlement buildings came with them. Wisps in the marsh (a lure at night) were designed but not built.
- A second intelligent mob that trades or raids.
- Names for events and long grudges in the chronicle, so the Legends-mode feel grows.
- G3 built the save format: a snapshot as JSON, `REFS`, the door's `load` act, and the page's Save, Load, and one autosave slot. Left for later: an oracle case with an angry grove, and one with a mark saved whole; a snapshot of the ages, so a steered creation survives a page reload; and the 3.7 MB the autosave writes on IndexedDB at every world day, unmeasured over a long session.
- G: time and tiers. A one-second tick, real years, day and season tiers calibrated from the tick tier, deterministic zoom both ways, breakpoints on a watch list, and tasks as data (done) and snapshots (done). Each later plan of G adds its own state to the snapshot and its own references to `REFS`: the tier, the placement stream, the counts, the annals, the pending events, and the watch list. The completeness test (`REFS names every field that points at a record`) and the oracle hold each addition to the same proof G3 built.
- Then the lingering gods. A sleeping god wakes, and later gods are born of side effects or of belief. Of the four inhabit modes, Become is built for a god in the ages; see section 19. Possess, Vessel, and Manifestation are refused by name until each has its spec.
- `pickBerries`, `pickFibre`, `digClay`, and `takeCuttings` are one shape four times; a `harvestKind` builder like `workKind` would make them four rows. Not done in G2 because G2 moves no behaviour.
