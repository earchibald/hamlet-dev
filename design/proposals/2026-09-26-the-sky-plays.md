# The sky plays: proposals to make Hearth a game

Written on 26 September 2026 at the user's request: "Evaluate what we have, develop and implement some proposals to make this a better GAME." Branch `game-loop`.

## Summary

| # | Proposal | What it adds | Status on `game-loop` |
|---|---|---|---|
| 1 | **Belief and grace** | The people believe in the sky, or not. Belief is the sky's power. Every miracle costs grace. | Built |
| 2 | **Prayers** | The simulation asks the player for help. Each prayer has a person, a need, and a deadline. | Built |
| 3 | **Five miracles** | Spark, Rain, Ward, Beckon, and Calm. Each one helps, and each one has a cost in the world. | Built |
| 4 | **Credit** | People thank the sky only when the sky acted. A need met by their own hands teaches them they do not need you. | Built |
| 5 | **The story camera** | The game slows down when a prayer arrives, so the player is present for the moment that matters. | Built, with a switch |
| 6 | **Seasons as chapters** | Each season ends with a tally card: who believes, which prayers you answered, who was born and who died. | Built |
| 7 | **Forgotten** | When nobody believes, the sky can do nothing. That is the way to lose. | Built |
| 8 | Play as the sky, or watch | The start dialog offers the game or the old sandbox. Old seeds and tests run unchanged. | Built |
| 9 | Your god from the creation | The player keeps one god from the ages. Its domain makes some miracles cheap. | Proposed |
| 10 | Rival gods wake | A sleeping god wakes and competes for the people's belief. | Proposed |
| 11 | The prophet | One person carries your word. Their life matters more than the others. | Proposed |
| 12 | Vows | Each spring the camp asks for a promise. It is the year's objective. | Proposed |

## 1. What we have

Hearth is a good simulation. Fire, weather, hunger, wolves, crafts, births, and names all read the same state, and stories come out of their collisions. That part works, and nothing here changes it.

Hearth is not yet a good game. A game needs three things from the player: a reason to look, a choice to make, and a result that the choice caused. Measured against those three, the current build gives the player very little.

| What a game needs | What the first build had | What dev has now |
|---|---|---|
| A reason to look | The founder cannot light the fire. Only you can. "You are the sky. Give them the spark." | Lightning lights the first fire by itself (review P1). Firestones and moss follow. The valley does not need the player. |
| A choice to make | When to strike, and where. | Three verbs: Light, Nudge, and goal priority. All are free and unlimited, so no act costs anything, and no act is a choice. |
| A result the choice caused | The fire you lit, and who came to it. | The results are real but diffuse. Nothing tells the player "this happened because of you". |
| A rhythm | Day, dusk, a cold night, dawn. | The default speed is 8x. Events scroll past in the foot. Nothing holds still. |
| Stakes | The founder could die. | The valley goes on without anyone. When the last person dies, a wanderer comes. There is no way to lose and nothing to win. |

The creation ages grew in the same way. They are a forty-second film of about eighty decisions by up to eight gods, and the player chooses nothing that matters in the days.

The design notes say this directly, in section 9: "Fire is the thing the player is for at the start ... Do not remove the early dependence. It is the reason the player pays attention." Each later feature was right on its own terms, and together they removed that dependence. The world learned to light its own fire. The interface grew drawers, a palette, chips, chords, and inspectors, which is the interface of a management game, but the player has nothing to manage.

## 2. The idea: the sky lives on belief

The first build's line was "You are the sky." These proposals keep that line and give it a price.

- **The people believe in the sky, or they do not.** Each person carries a belief from 0 to 100.
- **Belief is the sky's power.** Every world hour, the believers give the sky grace. More believers, and stronger belief, give more grace.
- **Every miracle costs grace.** A Spark is cheap. Rain is expensive. The player can never do everything, so each act is a choice.
- **People pray when they are in trouble.** The simulation already knows when a camp is cold, hungry, burning, or stalked. Now it says so, as a prayer from one named person, with a deadline.
- **People thank only what they saw.** If the sky acted, the one who prayed believes more, and so does everyone who saw it. If they solved it themselves, they learn that they can. If nobody came, they remember the silence.

This is the loop:

```
trouble in the simulation
  -> a named person prays (a chip, a halo, the game slows)
    -> the player decides: spend grace now, or save it
      -> the world changes (fire, rain, a fleeing wolf, deer at the snares)
        -> the people credit the sky, or their own hands, or remember silence
          -> belief moves, and grace with it
            -> the next trouble
```

The best part of this loop is that the simulation's own growth is the difficulty curve. The early camp needs you for everything, so grace is short and every prayer is urgent. The grown camp can light its own fire and fill its own stash, so it prays less, and it believes less unless you meet the bigger troubles: the wildfire in a dry summer, the wolf pack in winter, the hungry spring. The notes' "order of independence" (the player, then lightning, then moss, then firestones) stops being a way to make the player unnecessary. It becomes the game's arc.

## 3. The proposals in detail

### 3.1 Belief and grace (built)

| Rule | Value | Why |
|---|---|---|
| The founder's belief at the start | 40 | They are alone, and they looked up. |
| A newcomer's belief | 20 | They heard stories of the sky on the road. |
| A child's belief | The mean of the parents | Belief is taught. |
| Belief fades | 1 a day, down to a floor of 5 | Faith that is never met fades. It does not go to zero by itself. No loss takes belief under the floor. That holds for the daily fade, for a prayer the sky left unanswered, and for a trouble the people met by their own hands. Seeing a miracle, or an answered prayer, can lift belief again. |
| Seeing a miracle | +2 belief, at most once a day for each person | A person who stands within 10 tiles sees it. Two Sparks in one evening do not buy belief twice. |
| Grace at the start | 30 | Enough for one Spark, so the first fire prayer can be answered. At 0, the founder had only 4 grace by the first evening, and the first prayer was always silent. |
| Grace income | Each person gives belief / 100 grace each world hour | A camp of five at belief 60 gives 3 grace an hour, or 72 a day. |
| Grace cap | 100 | The player cannot hoard. Unspent grace is wasted, which pushes the player to act. |

The strip shows grace as a gauge, and the number of believers. A person's card shows their belief and the prayers they made.

### 3.2 Prayers (built)

A prayer is a plain record: who prays, what for, when, the deadline, and how it ended. The table `PRAYERS` in `src/sim/faith.js` holds the kinds. The rules read the table, not the names.

| Kind | When a person prays | The deadline | The miracle that answers it |
|---|---|---|---|
| Fire | The pit is laid with wood and is cold, and it is evening or the person is cold. The coldest person prays. | The next dawn or 12 hours, whichever is later | Spark on the pit |
| Hunger | The stash holds less than half the camp's aim, and someone's food is under 50. The hungriest person prays. The prayer ends when the stash is back to half the aim, not when the one who prayed has eaten. | 1 day | Beckon near the camp or its snares |
| Wolf | A wolf or a fox is within 8 tiles of the person at night, and they are more than 8 tiles from a lit fire. A sleeper prays too, in a dream: "Aki dreams of wolves and prays in their sleep." The prayer is that person's: it ends when no wolf or fox is near them. | 1 hour | Ward near the person |
| Wildfire | At least 3 tiles burn in the open within 12 tiles of the camp, not counting the pit. One pine struck by lightning, which gives the camp its first ember, is not a wildfire. | 6 hours | Rain |
| Storm | It storms, and someone in the camp is out in it with no roof and a warmth under 95. The coldest such person prays for the rain to stop. The prayer ends when the storm ends. When a storm stops on its own, nobody stopped it, so belief does not move: "The rain stopped on its own. Aki can get dry." | 6 hours, or the storm's end if that is sooner | Calm |

Only the wolf prayer comes in a dream. A sleeper does not pray about fire, food, a wildfire, or a storm.

The thresholds were set by eight world days on seeds `r` and `moss-crag-87`, with a player and without one. With a lit fire in spring, a person out in a storm mostly stays at 94 to 100 warmth. At a threshold of 60, one storm in ten made anyone pray. At 95, three did. The stash fell under half its aim on both seeds, while the hungriest person's food was between 20 and 70.

A camp has at most one prayer of each kind open at a time. A trouble that goes on brings a new prayer a day after the last one opened: a cold pit brings a prayer each evening, and an empty stash one each day. If the one who prayed dies, someone else may pray at once. A prayer whose camp is gone ends with no line and moves nobody. A prayer draws no random number, so a world with faith switched off replays the old story exactly.

### 3.3 Five miracles (built)

| Miracle | Key | Grace | What it does | What it can cost |
|---|---|---|---|---|
| Spark | F | 15 | Lights the pit, or sets a pine smouldering. This is the old Light fire. | A strike on a pine in dry summer can start a wildfire. |
| Rain | R | 40 | A storm starts now. | Rain soaks everyone who is not under a roof, and the pit burns faster in the rain. |
| Ward | D | 15 | Every wolf and fox near the spot flees, and keeps away from it for a day. With no wolf or fox near the spot, it is refused and costs nothing. | It does not kill them. They come back hungry. |
| Beckon | B | 20 | Up to 4 deer and rabbits within 60 tiles walk toward the spot. With no deer or rabbit near enough, it is refused and costs nothing. At 30 tiles, the nearest animal was 45 to 66 tiles from a hungry camp, and every Beckon was refused. | Wolves hunt what they follow. |
| Calm | L | 25 | The storm ends now, as if it had ended on its own. The next storm still comes when it would have. With no storm, the Calm is refused and costs nothing: "The sky is already clear." | The rain that was quenching a wildfire stops too. |
| Nudge | N | 0 | The old nudge. It stays free. | Nothing. |

Every miracle passes the door, so it is logged and replays.

### 3.4 Credit (built)

A miracle leaves a sign: the act, the place, and the tick. When a prayer's trouble ends before its deadline, the rules look for a sign of a miracle that answers that kind, near the trouble, made after the prayer opened. A sign made before it does not count. That is the whole test.

| The trouble ends... | The one who prayed | The others in the camp | The line |
|---|---|---|---|
| ...and a sign of the sky is there | +20 belief | +6 belief | "The sky heard Aki." |
| ...and no sign is there | −4 belief | nothing | "Aki's people lit the fire by their own hands." |
| ...by itself, for a kind marked so (the wolf that wanders off) | nothing | nothing | "The wolf went away. Aki breathes again." |
| ...after the deadline, or never | −12 belief | −3 belief | "The sky was silent when Aki called." |
| ...because the one who prayed died | (dead) | −3 belief | "Aki died before the sky answered." |

The second row is the important one. A camp that learns to cope alone slowly stops believing. That is the right result for the story, and it is the thing that makes the late game hard.

### 3.5 The story camera (built, with a switch)

When a new prayer arrives and the game runs faster than 8x, the speed drops to 8x. The switch is "Slow for prayers" in the help page, and it is on by default. Review P1 rejected an automatic pause for the first fire. This is not a pause. It is a drop to the default speed, only for a prayer, and the player can turn it off.

### 3.6 Seasons as chapters (built)

A day at 8x lasts three minutes of real time. A season lasts 91 days, which is about half an hour at 64x. That is a good length for one sitting, so the season is the chapter.

When a season ends, a card shows the tally: believers and their mean belief, prayers answered, prayers met by the people's own hands, silences, births, deaths, and grace spent. The chronicle gets one major line with the same facts. The card closes with Enter.

### 3.7 Forgotten (built)

If no living person believes above the floor, the sky is forgotten. Miracles are refused, the chronicle says so, and the strip shows it. This is the way to lose. It is not the end of the world: the valley goes on, and belief can come back with a newcomer or the wanderer.

### 3.8 Play as the sky, or watch (built)

The start dialog offers two ways to begin. **Play as the sky** turns faith on. **Watch the valley** is the sandbox of today. The switch is a world option, `options.faith`, so it is saved with the seed and replays. With faith off, the engine runs exactly as before, and the soak and every existing test run with faith off.

### 3.9 Your god from the creation (proposed)

At settle, the player chooses one of the sleeping gods to be. Its domain sets the price of each miracle: a god of water pays half for Rain, a god of fire half for Spark, a god of beasts half for Beckon and Ward. This gives the creation a reason to watch: you are choosing who you will be. The Become slice already lets the player steer one god through the ages, so the player can raise the god they will later be.

### 3.10 Rival gods wake (proposed)

The notes plan for "lingering gods" that wake. With belief as the currency, a waking god is a rival. It answers some prayers itself, and the people it helps believe in it and not in you. The player then competes for the valley, not only against winter.

### 3.11 The prophet (proposed)

The player marks one person as the prophet. The prophet's belief counts double for grace, and the prophet's prayers reach you from anywhere. If the prophet dies, every believer loses belief. This gives the player one person to care about, which is the strongest hook a simulation of named people can offer.

### 3.12 Vows (proposed)

Each spring, the camp asks for a vow: "Keep us all through winter", "Give us a second hearth", "Let no child die". The player accepts one. A kept vow doubles every believer's belief gain for a season. A broken vow costs belief. Vows turn the year into a chapter with an objective.

## 4. What stays true

- The simulation does not change for a world with faith off. The soak runs with faith off and its record does not move.
- A prayer draws no random number. The miracles draw none of their own either, except through the rules they start (a storm's end, a fleeing wolf's path), and those are replayed from the door log.
- Every new behaviour has a chronicle line, a thought, a chip, or a card row.
- Every miracle is a door act, and every door act is logged.
