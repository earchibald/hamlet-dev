# Topography: hills, caves, and the mobs that use them

Design spec, 2026-09-17. Approved in conversation. Implementation follows in four plans.

## Summary

| Decision | Choice |
|---|---|
| Terrain model | Full z-levels, five of them: −2 to +2. Level 0 is the current surface. |
| Storage | Every level is a full array. Off-surface levels are mostly empty. Empty is open air above ground and solid earth below. |
| Level change | Slope tiles only. A slope at level z joins its four neighbours at level z+1. Everything else is a cliff. |
| Extent | Hills one or two storeys. Caves one or two levels deep. |
| Shaping | A simulated pre-history before day 1: uplift, water, rockfall, dens, groves, finds, populate. |
| Dwellers at start | Wolves and foxes in dens. Sprites under hills where a forest sector has one. |
| What people get | Stone from rock faces. Finds in deep chambers. Not a roof, not a hearth. |
| View | One level at a time with a level control. |
| Out of scope | Digging by villagers or mobs beyond a wolf pack digging a new den. Falling. A new cave mob. Saving to browser storage. |

## 1. Terrain model

- `levels[z]` for z in −2..2. `levels[0]` is today's `world`. Each level is an array of `W * H` entries. An entry is a tile or `null`.
- `null` means no tile. Above level 0 it is open air. Below level 0 it is solid earth. Both are impassable. Digging later turns a `null` into a tile.
- Tiles keep their shape and gain `z`, `slope` (boolean), and `cave` (a reference to the cave record, or null).
- Two new grounds in the ground table: `rock` (solid, impassable, fuel 0) and `stone` (a bare floor, fuel 0). A hill's footprint on level 0 becomes `rock`. A hill's storeys on levels 1 and 2 are `stone` or `grass` floors. A cave is `stone` floor carved out of `rock`.
- Rules read the ground table. No rule checks the name `rock` or `stone` except the quarry rule, which reads a new table field `quarry: true` on rock.

### Movement

- `passable(x, y, z)`: the tile exists, its ground is not water or rock, its feature is not solid, it is not on fire, and it holds no fire pit.
- `steps(x, y, z)` yields: the four same-level neighbours that are passable; if this tile is a slope, the four neighbours at z+1 that are passable; and for each of the four neighbours at z−1 that is a passable slope, that tile.
- A cave mouth is a slope on the lower level whose upper neighbours are outside the hill. No special tile kind.
- Cliffs block. Nobody falls in this version.

### Distance

- `dist(ax, ay, bx, by)` stays two-dimensional for tile math.
- `near(a, b)` for two beings is `dist + 6 * |a.z − b.z|`. Every rule that asks whether one being is near another switches to it. The first implementation plan carries the audit list of call sites.

### Weather and fire underground

- Rain and wind never reach a tile with rock or another tile above it.
- Underground warmth falls at a fixed mild rate all year: the spring-night rate. A cave is warmer than a winter night and cooler than a summer noon.
- Fire spreads across slope connections as across flat neighbours, and is 1.5 times as likely to spread to a tile one level up.
- Below level 0 it is dark. A person there without a burning ember walks at half speed and their task fails, so they turn back.

## 2. Path search

- The search arrays grow to five levels. `idx3(x, y, z) = (z + 2) * W * H + y * W + x`.
- The neighbour loop in `bfs` and `reachable` calls `steps`. Nothing else in search changes.
- Species: rabbits never leave level 0. Deer climb hills but never go below level 0. Foxes and wolves use slopes and dens. Sprites use their hollow. People go anywhere with light.

## 3. Pre-history

Runs inside `generate()` after the surface, before animals. Deterministic per seed. Each cave and den is a record: `{ kind, tiles, mouth, owner, story: [] }`. `story` lines show on the tile card.

| Step | Rule | Story line |
|---|---|---|
| Uplift | 6 to 10 hills on rocky and forest sectors. Never on the river. Never in the start sector. Radius 3 to 14. One storey for small, two for medium. A storey is the footprint eroded inward by 2 per level. Each storey rim gets one or two slope paths. The rest of the rim is cliff. | "A hill of old stone." |
| Water | Every medium hill had a spring. Its stream cut a winding passage 8 to 20 tiles long from under the hill to a mouth at the foot, with one or two chambers, and a drop to level −2 with a chamber at the bottom. One in three streams still runs and leaves a pond at the mouth. | "Water cut this passage when the river ran higher." |
| Rockfall | Boulders at hill feet. One passage in four is blocked by fallen rock: a `rock` tile inside the passage. Tools open it later. | "Fallen rock blocks the way." |
| Dens | Each wolf pair and each fox gets a den in a hillside: a pocket of 2 to 6 tiles at level 0 inside the rock, or a burrow of 2 to 4 tiles at level −1 under a slope. One mouth. | "Dug by foxes long before anyone came." "Widened by wolves." |
| Groves | A forest sector that holds a hill gets its hollow under the hill instead of in a pine. Old pines stand on the hill above. | "The oldest hollow in the valley." |
| Finds | Each deep chamber holds one item: firestones, glowing moss, or old bones. | none |
| Populate | Wolves spawn in wolf dens, foxes in fox dens, sprites at their hollow. Each remembers its home. | none |

## 4. Mobs and their homes

- A den has an owner species, a tile list, a mouth, and `cleared` (tick or 0).
- Owners sleep in their den by day. A wolf within 30 tiles of its den carries a carcass home before eating.
- In spring, a den with two adults of the owner species bears one young. Edge arrivals stay, at half their current rate.
- A person on a den tile is attacked by any adult owner that is also in the den, by day or night, brand or not. This is the one exception to the four-condition wolf rule in design note 10.
- Contention. "Clear the den" needs two brave adults with brands and the spear. The owners flee, and within three days dig a new den in another hillside. A cleared den returns to its owners if the camp's fire is out for a whole day. The sprites' hollow cannot be claimed.
- Favour. Quarrying the hill above a hollow costs 10 favour per rock face opened. A person inside the hollow costs 5 favour per visit and a thought for the sprites.
- Deer climb hills, and prefer high grass for three days after a wolf is seen. Wolves must come up the slope paths.

## 5. People and goals

| Goal | Kind | Needs | Offers |
|---|---|---|---|
| Quarry stone | standing | the axe, a rock face within 30 tiles | "quarry rocks": 25 ticks of work at the face, 2 rocks to the stash, build skill. |
| Search the cave | once per cave | a lit pit, the spear, a brave adult | take an ember from the pit, walk to the deep chamber, bring the find home. A den must be cleared first. |
| Clear the den | once per den | two brave adults, brands, the spear | the owners flee. The den is the camp's until the fire fails for a day. |

- Finds: firestones become `camp.tools.firestones`. Moss goes to the stash. Old bones give a chronicle line and a thought, "Found old bones in the dark."
- Camp site scoring adds "stone close by" for a rock face within 12 tiles and takes 15 off for a wolf den within 20.
- Every rule is visible: chronicle lines for entering, finding, clearing, and births; thoughts on the person; goal states on the panel; tile-card rows on rock faces, caves, and dens.

## 6. View and interface

- The location view shows one level. Buttons and keys step up and down. A label shows "Level −1", "Surface", "Level +2". Following a person changes level with them.
- Drawing: rock dark, stone floor grey, slopes as a wedge shaded toward the higher side, cave mouths marked. On a raised level, open air shows the level below dimmed. The legend gains rock, stone, slope, and cave mouth.
- The world map shades hills by height and dots cave mouths.
- Tile cards gain: the level, "rock face, quarry with an axe", the cave's story lines, and the den's owner and state.

### God interface

| Change | Rule |
|---|---|
| Light becomes Lightning | Key L. On a pit: lights it, as now. Elsewhere: the weather's strike rule, so a struck pine smoulders for 240 ticks and someone can fetch an ember. Chronicle text says lightning. |
| Camp site | Disabled once the viewed camp has a pit, with the reason in the hint. Refuses water, solid features, rock, and tiles the first person cannot reach, and says why. |
| Which camp | The toolbar names the viewed camp. |
| Poke | The reply says what the person chose next. |
| Speeds | 1, 4, 16, 64. |

## 7. Testing

- `tests/terrain.js`, every seed: each slope joins two existing floors. Each chamber and den is reachable from the surface. Hills never touch the river. The start sector's reachable region holds at least one hill and one cave mouth. Every den has one mouth.
- The soak: the daily cut-off check runs in three dimensions. A death by a den's owner inside the den is allowed, reported, and capped at one per seed. Every other death that is not old age fails. The golden record is re-blessed once per phase.
- Time budget: 25 seconds per seed in the soak.
- Browser: the smoke script opens the page, steps to a cave, switches level, and reads a tile card.

## 8. Phasing

| Plan | Delivers | Done when |
|---|---|---|
| 1. Model, path, view | Levels, rock and stone, slopes, `steps`, three-dimensional search, the level control, plain hills from uplift only. | Soak green. Hills visible and climbable on the dev server. |
| 2. Pre-history | Water, rockfall, dens, groves under hills, finds. Story lines. Terrain test. | Terrain test green. Soak green. |
| 3. Dwellers | Dens, sleeping, carrying home, births, defence, contention, deer on high ground, favour. | Soak green with den deaths reported. |
| 4. People and god | Quarry, search, clear. Site scoring. God-interface changes. | Soak green. Golden blessed. Design notes updated. |

## Later

- Digging by villagers with tools, and by mobs beyond a new den.
- Falling from cliffs.
- A mob of the deep.
- Saving to browser storage, once a save format exists.
