/* ---------- the door ----------
   Every act from outside the engine enters here: the player now, and later chance, an LLM, or a
   human inhabiting a mob. The engine step is pure. The door is the one place the outside touches
   the state, and it keeps a log, so a seed, its options, and its log replay the same story. The
   door logs every lawful act, applied or not, because a replay against the same state does the
   same nothing, and a log that keeps what was tried is better provenance. Each act returns a
   message for whoever asked.

   Tick rule: an event stamped with tick N was applied after step N and before step N+1. An event
   that arrives with a tick of its own, as a replayed one does, must arrive at that tick; the door
   refuses it otherwise, so a replayer that runs late fails loudly instead of telling a different
   story. The test runner keeps the order (`api.step(); god(api, i);`). */
const DOOR_SOURCES = ['player', 'chance', 'llm', 'human'];
let doorLog = [];
let replayHead = null;
/* Acts by name. Each takes the event and returns its message. */
const DOOR_ACTS = {
  light(e){ return lightTile(e.x, e.y, e.z || 0); },
  poke(e){
    const a = beingById(e.id);
    return a ? poke(a) : 'Nobody is there to nudge.';
  },
  /* Goal priority: 0 off, 1 on, 2 high. It changes which task a person picks, so it is an act. */
  priority(e){
    const g = GOALS.find(g => g.id === e.id);
    if (!g) return 'No such goal.';
    if (![0, 1, 2].includes(e.pri)) return 'A priority is off, on, or high.';
    goalPriority[g.id] = e.pri;
    log(`A wish from above: ${g.title.toLowerCase()} is ${['set aside', 'wanted', 'wanted most'][e.pri]}.`, campHumans());
    return `${g.title}: ${['off', 'on', 'high'][e.pri]}.`;
  },
  /* The camp site, before the pit is built. The event carries its camp id, so a site chosen for a
     second camp still lands on that camp when the log is replayed and `camp` defaults to camps[0].
     The four guards the interface used to hold, including reachability, live here. */
  site(e){
    const prev = camp; camp = camps.find(c => c.id === e.camp) || camp;
    if (camp.pit){ const msg = 'The fire pit is already built. The camp stays where it is.'; camp = prev; return msg; }
    if ((e.z || 0) !== 0 || !hasTile(e.x, e.y, 0)){ camp = prev; return 'The camp must be on the valley floor.'; }
    const t = tileAt(e.x, e.y);
    if (!passable(e.x, e.y) || t.feature){ camp = prev; return 'The camp site must be open ground you can stand on.'; }
    const first = beings.find(b => b.alive && b.species === 'human' && b.camp === camp) || firstPerson();
    if (!reachable(first.x, first.y, first.z, NZ * W * H).has(idx3(e.x, e.y, 0))){ camp = prev; return 'Nobody can walk there from where they stand.'; }
    setSite(e.x, e.y); camp.siteReason = 'you chose it';
    log('The camp site moves. Someone felt it was right.', humans());
    camp = prev;
    return 'Camp site set. The fire pit will go here.';
  },
};
function inject(event){
  const act = DOOR_ACTS[event.act];
  if (!act || !DOOR_SOURCES.includes(event.source)) return 'Nothing answers.';
  if (event.tick !== undefined && event.tick !== tick) return 'Not now.';
  doorLog.push({ ...event, tick });
  return act(event);
}
function resetDoor(){ doorLog = []; replayHead = { seed: seedText, options }; }
