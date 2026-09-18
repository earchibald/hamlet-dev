# Settings register

One line per start option and per future setting. Add a line the day the hook is written. State is one of: idea, hook, built, in UI.

| Setting | Owner spec | State | Notes |
|---|---|---|---|
| `sw`, `sh` (world size in sectors) | mythos, section 7 | hook | Defaults 10 and 6. startWorld(seed, { sw, sh }). The UI passes {}. The canvases are sized at page load, so an options control must resize them. |
| `zmin`, `zmax` (level range) | mythos, section 7 | hook | Defaults −2 and 2. startWorld(seed, { zmin, zmax }). The painters cap storeys and levels by the range: a height mark of value n raises `min(n, ZMAX)` storeys, and a depth mark of value n cuts `min(n, -ZMIN)` levels. setOptions refuses a range narrower than the default with a sentence, because the day era's caves and hills still want it. tests/terrain.js reads the range. |
| `ageLimit` | mythos, section 4 | hook | Default 200. startWorld and startCreation take it. Past it the backstop acts once an age; at twice it the creation is marked failed. |
| Pace of the ages, hurry to settle | mythos, section 6 | hook | runAges(max) runs to settle in Node; the page steps ages in plan 4. |
| Speeds in the day era | topography, god interface | built | 1, 4, 16, 64. |
| Zoom: which tier runs | G, time and tiers | idea | Tick, day, season. Realtime is the tick tier at speed 1. |
| Breakpoints: a watch list | G, time and tiers | idea | Beings, camps, kinds of event. A coarse tier zooms in before a watched event instead of sampling it. |
| Inhabit modes | E, later gods | idea | Become: the player is the mob. Possess: the mob stays itself and is possessed, knowing or not. Vessel: possession that grants powers or damages the host. Manifestation: a god born or reborn out of the mob, destroying it. |
| Sources at the door | mythos, section 0 | hook | player built: light, poke, priority, site. chance, llm, human reserved in DOOR_SOURCES. The log is api.doorLog; api.replay is { seed, options, log }. An event stamped tick N was applied after step N. An LLM source cannot answer inside a tick, so it needs a queue drained at a fixed point in the step order; plan for it when the source arrives. |
| God-era events at the door | mythos, section 0 | idea | The door stamps tick; the ages do not advance it. A god-era act through the door (pace, hurry, a player god) needs the age in the stamp. Decide in plan 4. |
| Save and load | notes, Next | idea | Needs tasks as data. Shared with G and inhabiting. |
