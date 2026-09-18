# Stone-age crafts and the hidden neighbours

Design spec, 2026-09-17. Decisions made by Claude on the user's instruction after three answers: deeper stone age first, not metal; sprites and animals use things a little; a new tool-using mob, gnomes, as hidden neighbours, neutral.

## Summary

| Decision | Choice |
|---|---|
| Model | Crafts are data. A recipe table drives generic goals: gather the inputs, then make the thing at its place. Hand-written goals stay for what they already do. |
| Reach | Deeper stone age. Cord, baskets, fishing, hide clothes, clay and pots, a kiln, a workshop, berry gardens, deer pits, quarried stone. No metal. |
| Places | Two new buildings: the workshop (a roofed bench) and the kiln. Existing places gain uses: the rack smokes fish, the river gives fish and clay, rock faces give stone. |
| Sprites | Steal one made thing a night when favour is low. Leave cord on the offering stone when favour is high. |
| Animals | Wolves raid fish as well as meat. Rabbits and deer graze gardens, which is what bushes already do. Wolves and foxes live in their dens (topography phase 3). |
| Gnomes | A second people. Burrows under meadow edges. Come out at dusk, farm mushrooms, copy the workshop, borrow made things and repay, move away from a loud village. Never attack. |
| Out of scope | Metal. Trade in the sense of a market. A gnome language. Digging by people beyond the quarry face. |

## 1. The recipe model

A recipe is a row in `RECIPES`, read by one generic goal builder. No rule checks a recipe's name.

| Field | Meaning |
|---|---|
| `id`, `title` | The goal's id and title in the panel. |
| `needs` | Stash kinds and counts consumed, for example `{ fibre: 4 }`. |
| `tools` | Camp tools that must exist, for example `['axe']`. |
| `place` | Where the work happens: `'stash'`, `'pit'` (lit), `'workshop'`, `'kiln'`, `'rack'`, `'water'` (a river tile), `'face'` (a rock face). |
| `skill` | The skill that speeds the work and gains experience. |
| `work` | Ticks of work at speed 1. |
| `makes` | What appears: `{ item: 'cord', n: 2 }`, or `{ tool: 'rod' }`, or `{ struct: 'workshop', logs, sticks }`, or `{ wear: 'clothes' }`. |
| `after` | The recipe or tool that must exist first, so the panel unlocks in order. |
| `standing` | If set, the goal never finishes: a target the camp keeps up to, for example `{ stash: 'cord', n: 4 }`. |
| `blurb` | The panel text when active, in plain English. |

The builder makes one goal per recipe. Its state is blocked until `after` holds, active while the target is unmet, done when a once-only thing exists. Its offers are: gather each missing input (using the existing gather, pick, and quarry starters), then "make it" as a build task at the place. A recipe with a place that does not exist yet offers the place's own recipe first. The panel shows recipes in ladder order.

## 2. The ladder

| Step | Needs | Place | Makes | Use, and how the player sees it |
|---|---|---|---|---|
| Gather fibre | reeds within reach | reeds tiles | `fibre` item | "gathers fibre from the reeds." Reeds regrow. |
| Twist cord | 4 fibre | stash | 2 `cord` | Standing to 4. The stash row. |
| Build the workshop | 6 logs, 10 sticks, 4 rocks; the axe | site near the pit | `workshop` struct | A roofed bench. Recipes at the workshop go 1.3 times as fast. A tile card. |
| Weave a basket | 3 cord | workshop | `basket` tool | Gatherers carry 3 more. The being card says "with a basket". |
| Make a fishing rod | 1 stick, 2 cord | workshop | `rod` tool | Opens fishing. |
| Fish the river | the rod | water | `fish` item | Standing while food is short. "casts from the bank" and "lands a fish". Chance by hunt skill and patience. Fish cook to 2 meals or smoke on the rack. |
| Sew hide clothes | 3 hides, 1 cord | workshop | one `clothes` set | Given to the coldest person. Warmth loss 0.6 for the wearer. Chip "wearing hide clothes". |
| Dig clay | sand tiles by the river | water | `clay` item | "digs clay from the bank". |
| Build the kiln | 8 rocks, 4 clay | site near the pit | `kiln` struct | Fires pots. Burns 2 sticks a firing. A tile card with its state. |
| Fire pots | 3 clay, 2 sticks | kiln | `pot` item | Each pot holds 6 more water at camp. With a pot, berries keep twice as long. The stash row. |
| Plant a garden | 4 cuttings, the axe | soil tiles within 8 of the pit | 4 bushes | Cuttings are taken from wild bushes. Planted bushes are ordinary bushes: they grow berries, seed, and feed rabbits and deer. Chronicle line. |
| Dig a deer pit | 4 logs, 2 cord; the axe | grass within 18 of the site | `pitfall` struct | A deer that steps on it is caught one time in twenty. Venison at the stash. A tile card. |
| Quarry stone | the axe; a rock face within 30 | face | 2 rocks a go | Standing while rocks are short. Ends the loose-rock hunt. From the topography spec. |

New stash kinds: `fibre`, `cord`, `fish`, `clay`, `pot`, `cuttings`. New tools: `basket`, `rod`. New structs: `workshop`, `kiln`, `pitfall`. New wearables: `clothes` on a being. The legend and the tile cards show each.

## 3. Sprites and animals

- **Sprite theft.** The prank list gains "a made thing is missing": a pot, a basket, or a coil of cord goes from the stash. Chronicle: "A pot is gone from the stash, and there are tiny footprints in the clay." Only when favour is below −20, as pranks are.
- **Sprite gifts.** At favour 40 or more, the offering stone sometimes holds a coil of cord in the morning instead of moss.
- **Wolves** raid fish as they raid meat. The storehouse protects it as it protects meat.
- **Rabbits and deer** eat garden bushes as they eat any bush. A garden near the snares is bait, and the player can see that.
- **Dens** (topography phase 3, built in this arc): wolves and foxes sleep in their den by day, a wolf carries a carcass home, dens bear young in spring, an owner defends its den, and a camp can clear one.

## 4. Gnomes, the hidden neighbours

| Trait | Rule |
|---|---|
| Home | Two or three gnome burrows a world, dug like fox burrows under meadow edges beside a forest or a hill, at least 25 tiles from the start sector. Two to three gnomes each. A burrow has a mushroom patch on the soil around its mouth. |
| Hours | Awake from dusk to dawn. Asleep in the burrow by day. |
| Needs | food, rest, company. Life clock 20 adult, 80 old, 110 life. |
| Food | Mushrooms on their patch, which regrow; berries. Never meat. |
| Copying | When a camp within 40 tiles has a workshop, the burrow gains a bench of its own within a few days. Chronicle: "Small tools clink under the meadow at night." |
| Borrowing | At night a gnome with a bench takes one made thing from a camp stash within 40 tiles: a pot, a basket, or cord. Two days later it comes back to the stash with a repayment beside it: a coil of cord, a lump of clay, or a pot. Chronicle for both. A camp with a ward is never visited. |
| Leaving | A village within 30 tiles is too loud. The gnomes dig a new burrow farther away over three days and the old one stands empty. Chronicle. |
| Neutral | Gnomes never attack. They flee people with brands and wolves. A person who digs into a burrow gets a thought and the gnomes leave. Sprites and gnomes ignore each other. |
| Seeing them | Glyph `g`. A being card with needs, nature, and the burrow. Tile cards on the burrow and the patch. First sight is a chronicle line, like the sprites'. |

## 5. God interface (carried from the topography spec)

Light becomes Lightning on key L and uses the weather's strike rule off the pit. Camp site disables after the pit and refuses bad tiles with a reason. The toolbar names the viewed camp. Poke says what the person chose. Speeds 1, 4, 16, 64.

## 6. Testing

- The soak stays the gate: no death but old age (den defence deaths reported and capped at one a seed), nobody cut off, golden re-blessed per phase, 25 seconds a seed.
- Recipe tests: a hand-built camp with the inputs completes each recipe through the real goal offers, the output appears, and the panel state moves blocked to active to done.
- Gnome tests: burrows exist and are reachable, gnomes sleep by day and wake at night, a borrow returns with a repayment within three days on a hand-built camp.

## 7. Phasing

| Plan | Delivers |
|---|---|
| A. Crafts model | Recipes, the generic goal builder, fibre, cord, workshop, basket, rod, fishing, clothes. |
| B. Clay and ground | Clay, kiln, pots, gardens, deer pits, quarry stone. |
| C. Dwellers and takers | Topography phase 3 dens; sprite theft and gifts; wolves raid fish. |
| D. Gnomes | The mob, burrows, mushrooms, copying, borrowing, leaving. |
| E. Closing | Search the cave and clear the den from the topography spec, the god interface, notes, merge, publish. |
