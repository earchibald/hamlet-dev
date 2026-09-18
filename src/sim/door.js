/* ---------- the door ----------
   Every act from outside the engine enters here: the player now, and later chance, an LLM, or a
   human inhabiting a mob. The engine step is pure. The door is the one place the outside touches
   the state, and it keeps a log, so a seed plus its log replays the same story. An act that does
   nothing is not logged. Each act returns a message for whoever asked. */
const DOOR_SOURCES = ['player', 'chance', 'llm', 'human'];
let doorLog = [];
/* Acts by name. Each takes the event and returns { ok, msg }. ok is false when the world did not change. */
const DOOR_ACTS = {
  light(e){
    /* lightTile answers with a message. Two of its answers mean the world changed. */
    const msg = lightTile(e.x, e.y, e.z || 0);
    return { ok: msg === 'The fire pit is lit.' || msg === 'The ground is burning. This fire is not contained.', msg };
  },
  poke(e){
    const a = beingById(e.id);
    if (!a || !a.alive) return { ok: false, msg: 'Nobody is there to poke.' };
    return { ok: true, msg: poke(a) };
  },
};
function inject(event){
  const act = DOOR_ACTS[event.act];
  if (!act || !DOOR_SOURCES.includes(event.source)) return 'Nothing answers.';
  const { ok, msg } = act(event);
  if (ok) doorLog.push({ tick, ...event });
  return msg;
}
