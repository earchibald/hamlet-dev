/* ---------- the door ----------
   Every act from outside the engine enters here: the player now, and later chance, an LLM, or a
   human inhabiting a mob. The engine step is pure. The door is the one place the outside touches
   the state, and it keeps a log, so a seed, its options, and its log replay the same story. The
   door logs every lawful act, applied or not, because a replay against the same state does the
   same nothing, and a log that keeps what was tried is better provenance. Each act returns a
   message for whoever asked.

   Tick rule: an event stamped with tick N was applied after step N and before step N+1. The test
   runner keeps that order (`api.step(); god(api, i);`). */
const DOOR_SOURCES = ['player', 'chance', 'llm', 'human'];
let doorLog = [];
let replayHead = null;
/* Acts by name. Each takes the event and returns its message. */
const DOOR_ACTS = {
  light(e){ return lightTile(e.x, e.y, e.z || 0); },
  poke(e){
    const a = beingById(e.id);
    return a ? poke(a) : 'Nobody is there to poke.';
  },
};
function inject(event){
  const act = DOOR_ACTS[event.act];
  if (!act || !DOOR_SOURCES.includes(event.source)) return 'Nothing answers.';
  doorLog.push({ tick, ...event });
  return act(event);
}
function resetDoor(){ doorLog = []; replayHead = { seed: seedText, options }; }
