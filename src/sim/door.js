/* ---------- the door ----------
   Every act from outside the engine enters here: the player now, and later chance, an LLM, or a
   human inhabiting a mob. The engine step is pure. The door is the one place the outside touches
   the state, and it keeps a log, so a seed, its options, and its log replay the same story. The
   door logs every lawful act, applied or not, because a replay against the same state does the
   same nothing, and a log that keeps what was tried is better provenance. Each act returns a
   message for whoever asked. One act is the exception: a refused `load` is not logged. It has
   no tick of its own to be logged at, and the snapshot it carries can run to megabytes.

   Tick rule: an event stamped with tick N was applied after step N and before step N+1. An event
   that comes with a tick of its own, as a replayed one does, must come at that tick; the door
   refuses it otherwise, so a replayer that runs late fails loudly instead of telling a different
   story. The test runner keeps the order (`api.step(); god(api, i);`). */
const DOOR_SOURCES = ['player', 'chance', 'llm', 'human'];
let doorLog = [];
let replayHead = null;
/* Acts by name. Each takes the event and returns its message. */
/** @type {{ [act: string]: DoorAct }} */
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
  /* A load replaces the whole world, so it is marked `replacesWorld` below: inject applies it before
     logging, skips the tick guard (a save carries no tick of its own to arrive late at), and on
     success logs a bare entry with the new tick, never the snapshot. `loadSnapshot` already restores
     `doorLog` from the save, so this act's own return value is that function's raw result: `null` on
     success, or the sentence to show when it is not. */
  load(e){ return loadSnapshot(e.snapshot); },
  /* Become: the player is the mob. The other three inhabit modes are named in the spec and refused
     until each is built. An id of null leaves, and the open turn closes with it. */
  become(e){
    if (e.mode !== undefined && e.mode !== 'become') return 'Only Become is built. Possess, Vessel, and Manifestation wait for their own specs.';
    if (e.id === null || e.id === undefined){
      if (inhabited === null) return 'You are nobody already.';
      inhabited = null; inhabitedTold = false; releaseTurn();
      note('The hand above lifts. Whatever was moving falls still, and goes on by itself.');
      return 'You are nobody again. The creation goes on without you.';
    }
    /* Only a god can be taken in this slice, and a god acts only in the ages. Without this guard a
       god-era become replayed in the days era would land on a sleeping god and open nothing. */
    if (era !== 'gods') return 'The ages are over. A god cannot be taken now.';
    const g = beingById(e.id);
    if (!g || !g.alive || g.species !== 'god') return 'Only a god can be taken, and only while it lives.';
    if (inhabited !== null && inhabited.id !== g.id) releaseTurn();
    inhabited = { id: g.id, mode: 'become' }; inhabitedTold = false;
    note(`Something older than the gods looks out through ${g.name}.`);
    return `You are ${g.name}, ${g.epithet}.`;
  },
  /* Choose: take one option from the open matrix. The option is named, never numbered, because a list
     sorted by score is not stable across a replay. */
  choose(e){
    if (!pending) return 'It is nobody\'s turn.';
    if (e.id !== undefined && e.id !== pending.god) return 'That is not whose turn it is.';
    if (!e.opt || typeof e.opt.type !== 'string') return 'An option is an act and the land it falls on.';
    return takeTurn(e.opt);
  },
  /* Run: the god chooses for itself until the mark named, or until a stop is reached. Autopilot is the
     engine's own chooser and nothing else, so a creation run on autopilot is an unwatched creation.
     A run names a mark ahead of now in the same shape a stop does: `{ what, at }`. */
  run(e){
    if (e.what !== 'age') return 'Only a run to an age is built. A run to an event waits for the watch list.';
    if (era !== 'gods') return 'There are no ages to run.';
    if (inhabited === null) return 'You are nobody. There is nothing to hand over.';
    if (!Number.isInteger(e.at) || e.at <= age) return 'A run goes to an age still ahead.';
    runUntil = e.at; releaseTurn();
    note(`${beingById(inhabited.id).name} goes on alone a while.`);
    return `Running to age ${e.at}.`;
  },
  /* Watch: set or clear a stop. The same stop twice clears it. A stop is a mark ahead of now, so an
     age already passed cannot carry one: it would never fire. */
  watch(e){
    if (e.what !== 'age') return 'Only a stop on an age is built. A stop on an event waits for the watch list.';
    if (!Number.isInteger(e.at)) return 'A stop on an age names a whole age.';
    if (e.at <= age) return 'That age is already past. A stop goes on an age still ahead.';
    const k = stops.findIndex(s => s.what === 'age' && s.at === e.at);
    if (k >= 0){ stops.splice(k, 1); return `The stop at age ${e.at} is cleared.`; }
    stops.push({ what: 'age', at: e.at });
    return `A stop is set at age ${e.at}.`;
  },
};
DOOR_ACTS.load.replacesWorld = true;
function inject(event){
  const act = DOOR_ACTS[event.act];
  if (!act || !DOOR_SOURCES.includes(event.source)) return 'Nothing answers.';
  /* An act can change the ground, and a load replaces the world, inside one tick. See campReach. */
  blazeReach = null;
  if (act.replacesWorld){
    const refusal = act(event);
    if (refusal !== null) return refusal;
    doorLog.push({ source: event.source, act: event.act, tick });
    return `The world is as it was on day ${dayOf()}.`;
  }
  if (event.tick !== undefined && event.tick !== tick) return 'Not now.';
  /* In the gods era an age is the step and the tick stands still, so the age is the stamp that
     tells one act from another. In the days era nothing changes: the tick is the stamp. */
  if (era === 'gods' && event.age !== undefined && event.age !== age) return 'Not now.';
  doorLog.push(era === 'gods' ? { ...event, tick, age } : { ...event, tick });
  return act(event);
}
function resetDoor(){ doorLog = []; replayHead = { seed: seedText, options }; }
