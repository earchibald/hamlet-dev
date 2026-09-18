# Settings register

One line per start option and per future setting. Add a line the day the hook is written. State is one of: idea, hook, built, in UI.

| Setting | Owner spec | State | Notes |
|---|---|---|---|
| `sw`, `sh` (world size in sectors) | mythos, section 7 | hook | Defaults 10 and 6. startWorld(seed, { sw, sh }). The UI passes {}. The canvases are sized at page load, so an options control must resize them. |
| `zmin`, `zmax` (level range) | mythos, section 7 | hook | Defaults −2 and 2. startWorld(seed, { zmin, zmax }). Generation still cuts caves to −2 and raises two storeys, so a range narrower than the default is not yet lawful. |
| `ageLimit` | mythos, section 4 | idea | Default 200. Past it the backstop fires. |
| Pace of the ages, hurry to settle | mythos, section 6 | idea | One age every two seconds by default. |
| Speeds in the day era | topography, god interface | built | 1, 4, 16, 64. |
| Zoom: which tier runs | G, time and tiers | idea | Tick, day, season. Realtime is the tick tier at speed 1. |
| Breakpoints: a watch list | G, time and tiers | idea | Beings, camps, kinds of event. A coarse tier zooms in before a watched event instead of sampling it. |
| Inhabit modes | E, later gods | idea | Become: the player is the mob. Possess: the mob stays itself and is possessed, knowing or not. Vessel: possession that grants powers or damages the host. Manifestation: a god born or reborn out of the mob, destroying it. |
| Sources at the door | mythos, section 0 | hook | player built: light and poke. chance, llm, human reserved in DOOR_SOURCES. The log is api.log. |
| Save and load | notes, Next | idea | Needs tasks as data. Shared with G and inhabiting. |
