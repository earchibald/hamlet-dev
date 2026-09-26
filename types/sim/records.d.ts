/* Ambient shapes for the sim's main records, read from the code in src/sim/, not guessed.
   This file declares no import and no export, so TypeScript treats it as a global script,
   the same way it treats the files in src/sim/. It adds no runtime code: it only names the
   shapes that tsc uses to check src/sim/*.js under tsconfig.sim.json.

   No interface here carries a catch-all index signature. A catch-all hid every misspelt
   field. cooldown keeps its index signature, named and explained where it is declared,
   because it is genuinely a map from any task name to a tick: nothing enumerates the task
   names ahead of time.

   These interfaces alone are not enough: a review of the first pass found that
   `beings[0].hungerr` and `tileAt(1,2,0).bogus` both still passed silently, because the
   shared state in core.js (`let world, levels, beings, items, ...`) was untyped, so every
   read through it came back `any` no matter how carefully the interface it should have
   matched was written. That `let` now carries one inline JSDoc `@type` per variable, and
   the handful of lookup functions built on it (tileAt, itemAt, beingById, campHumans,
   campNear) carry a `@returns`. types/probe/misspelled.js checks both the direct and the
   realistic path.

   A field is typed `any` only where the shapes mixed at that spot are too varied to name
   honestly in one pass (a task's `args`, a camp's `target` before a site is chosen); each
   is named in a comment at the field. */

/** A creature: a human, a god, a fox, a wolf, a gnome, or a sprite. Built by makeBeing() in beings.js. */
interface Being {
  id: number;
  species: string;
  name: string | null;
  hue: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  alive: boolean;
  born: number;
  /* The tick this being acts again (makeBeing's literal, beings.js:19). `main.js` skips a being
     whose `next` is past this tick, and sets it to `tick + Math.min(CLOCK.every.body, nextAct(a))`
     after the act; the proximity pass in beings.js pulls it back to `tick` to rouse one.
     Always a number: makeBeing sets it, and nothing ever clears it. */
  next: number;
  /* The tick this being's body was last brought up to (makeBeing's literal, beings.js:19).
     `bodyStretch` moves it to the end of the stretch it ran, and `catchUp` leaves it at `tick`.
     Always a number by construction; catchUp's `typeof a.seen !== 'number'` guard is for a record
     that came back from an older save, not for one this code built. */
  seen: number;
  parents: number[] | null;
  lastChild: number;
  needs: { [need: string]: number };
  traits: { [trait: string]: number };
  skills: { [skill: string]: number };
  xp: { [skill: string]: number };
  thoughts: Thought[];
  opinions: { [beingId: string]: number };
  rel: { [beingId: string]: string };
  task: Task | null;
  /* dies (tasks.js): the tick an ember goes dark if it is not delivered by then. */
  carrying: { kind: string; count: number; dies?: number } | null;
  status: string;
  asleep: boolean;
  /* A task name to the tick its cooldown ends (a.cooldown['strike sparks'] = tick + ...).
     The task table grows over time (tasks.js, species.js, and fae.js all add kinds), so no
     closed list of keys is honest here. This is the one index signature this file keeps. */
  cooldown: { [taskName: string]: number };
  history: ChronicleLine[];
  lastChoice: any;
  lastHurt: any;
  homeless: boolean;
  pokedUntil: number;
  camp: Camp | null;
  deeds: { [tag: string]: number };

  /* human only (beings.js) */
  clothes?: boolean;
  /* When it last joined a camp (camps.js, names.js): a fresh founder or one born into it. */
  campSince?: number;
  /* How many times it has taught a skill by the fire (beings.js), read by an epithet (names.js). */
  taught?: number;
  /* The epithet the camp calls it by, and the name-records of the ones it wore before
     (names.js's epithetPass): a human's own history, not the god's fixed epithet below,
     though both share the one current-text field. */
  epithets?: any[];
  /* Set once, at birth or at founding a new camp (names.js's lineageFor). */
  lineage?: { parents: number[] | null; camp: number | null; day: number; roof: boolean; village: boolean; edge: any; foundersChild: boolean; firstBorn: boolean };
  /* The tick its last hurt happened, so it can be forgotten later (beings.js, species.js). Not
     the same field as lastHurt, which holds the message text. */
  lastHurtAt?: number | null;
  /* A camp a wolf or fox keeps clear of for a while after being driven off (beings.js, tasks.js). */
  shyOf?: Camp | null;

  /* sprite only (beings.js, fae.js, world.js): the hollow it belongs to, when it has not
     swarmed, and where and until when it is raiding when it has. */
  grove?: Grove | null;
  returnAt?: number;
  target?: any;

  /* fox, wolf, gnome only (beings.js, species.js, world.js): the cave record it dens in,
     or the one it was driven from. */
  den?: Cave | null;
  oldDen?: Cave | null;
  digAgain?: number;

  /* god only (gods.js): its pole, the region it holds, and where it stands, and, once asleep,
     when (settle.js reads sleptAt back to find the god that has slept longest). The landform
     its body took (a hill or a water cave), if any: settle.js's settleHome path. */
  pole?: string;
  contrast?: string;
  epithet?: string;
  acted?: number;
  at?: number | null;
  region?: number | null;
  sleptAt?: number;
  body?: Hill | Cave | null;
}

/** One thought on a.thoughts: a labelled mood swing that lasts until a named tick. thoughtAt() in
    beings.js builds it, and addThought() is thoughtAt() at this tick. It no longer counts down: a
    thought used to hold `left`, the ticks remaining, and `left` is gone. */
interface Thought {
  key: string;
  text: string;
  value: number;
  /* The tick the thought is gone on. The one place a thought is built sets it
     (`a.thoughts.push({ key, text, value, until })`, beings.js:47), and the one place that refreshes
     an existing thought sets it again on the same line, so it is never absent. catchUp drops the
     thought once it is past: `a.thoughts = a.thoughts.filter(t => t.until > tick)` (beings.js:522). */
  until: number;
}

/** One line of the chronicle, as log() in core.js builds it, and the last forty of which a.history keeps.
    tag and camp are optional, not because log() ever leaves them out (it always sets both), but
    because note() in gods.js pushes a gods-era line with neither: there is no camp yet, and no
    tag to give it. */
interface ChronicleLine {
  tick: number;
  when: any;
  text: string;
  kind: string;
  tag?: string | null;
  camp?: number | null;
  age?: number;
  /* Set by nameEvents() (names.js) once the event on this line has been given a name, so the
     same night is not looked at again. */
  names?: any[];
}

/** A den, burrow, or hollow under a hill. Built by makeCave() in world.js. */
interface Cave {
  id: number;
  kind: string;
  hill: any;
  owner: string | null;
  tiles: Tile[];
  mouth: any;
  exit: any;
  deep: any;
  blocked: any;
  searched: any;
  steps: number;
  story: string[];
  /* The camp that drove the den's owner out with fire (tasks.js), and when, until the fire has
     been out long enough (species.js) to let the owner back in. Not a flag: it is the camp. */
  cleared?: Camp | null;
  clearedAt?: number;
  from?: Cave | null;
  /* The tick a gnome burrow built its bench, or 0 for none yet (species.js, world.js); not a
     plain flag, since the tick itself is read on. */
  bench?: number;
  holding?: { since: number } | null;
  lastRepaid?: number;
  disturbed?: number;
  disturbedBy?: any;
  lastBirth?: number;
  /* A gnome burrow moving on, mid-game (species.js's gnomeTick): the tick it decided to leave
     (0 while it is not leaving), whether it has now gone, and the mushroom patch it leaves
     behind. A being still holds one (a.id) while it works the den (tasks.js). */
  leaving?: number;
  abandoned?: boolean;
  patch?: Tile[];
  claimed?: number | null;
  /* The being that made this its body (settle.js's settleHome path): the reverse of Being.body. */
  god?: number | null;
  /* Naming (names.js): whether the player has learned this thing's name yet, and its own
     name-records once given one. Shared with Hill and Grove below. */
  nameKnown?: boolean;
  names?: any[];
  namedAt?: number;
}

/** A sprite's home hollow. Built inline in placeGrove() and hollowUnderHill() in world.js. */
interface Grove {
  x: number;
  y: number;
  sector: any;
  anger: number;
  swarmUntil: number;
  lastBirth: number;
  cave: Cave | null;
  mark?: any;
  /* Naming (names.js): see the same fields on Cave. */
  nameKnown?: boolean;
  names?: any[];
  namedAt?: number;
}

/** One cell of the sector grid: LW x LH tiles, one biome. Built inline in paintSectors() in world.js. */
interface Sector {
  sx: number;
  sy: number;
  biome: string;
  name: string;
  country: number;
}

/** A raised landform. Built inline in the hill-raising loop in world.js. */
interface Hill {
  x: number;
  y: number;
  r: number;
  storeys: number;
  tiles: number[];
  mark: any;
  /* The being that made this its body (settle.js's settleHome path). */
  god?: number | null;
  /* Once a rock face on it has been quarried, the sprites' favour drops once, not every time
     (tasks.js): the sprites' grove itself is not tracked back to the hill it is under. */
  hollowPaid?: boolean;
  /* Naming (names.js): see the same fields on Cave. */
  nameKnown?: boolean;
  names?: any[];
  namedAt?: number;
}

/** A loose item lying on the ground, findable by itemAt(). Built by addItem() in world.js.
    Distinct from the { kind, count } shape a being carries or a camp stashes: this one has
    its own id and a spot, because more than one can sit on the same tile stack. */
interface GroundItem {
  id: number;
  kind: string;
  x: number;
  y: number;
  z: number;
  reservedBy: number | null;
  born: number;
}

/** What is left where a being died: die() in beings.js. Read by name lore only. */
interface CorpseMarker {
  x: number;
  y: number;
  z: number;
  name: string | null;
}

/** One tile of the world. Built by makeTile() in world.js, from TILE_DEFAULTS in core.js. */
interface Tile {
  x: number;
  y: number;
  z: number;
  ground: string;
  feature: string | null;
  berries: number;
  fire: number;
  struct: any;
  slope: boolean;
  hill: Hill | null;
  cave: Cave | null;
  mouth: any;
  water: any;
  pond: any;
  ford: any;
  /* Set once, in paintGround() (world.js), to the id of the region the tile was painted in. */
  country?: number | null;
  /* A loose thing lying on bare ground, not carried and not a GroundItem: 'stick' or 'rock'
     (world.js, settle.js). */
  loose?: string | null;
  /* The tick a tree or bush on this tile took root (world.js, recipes.js), read back to age it. */
  planted?: number;
  /* Set once, in cutWaterCaves()/uplift() (world.js), to the id of the river boundary or the
     lake region this tile belongs to. */
  river?: number | null;
  lake?: number | null;
  /* Set once, in cutSlopes()/a chasm's line (world.js, settle.js), to the region id it splits. */
  chasm?: number | null;
  /* A gardened bush's owner (recipes.js): the camp that planted it, so only that camp reads it
     as tended. */
  garden?: Camp | null;
  /* A mushroom patch's remaining count (world.js, species.js). */
  shrooms?: number;
  /* A deer struck and left in the pit under this tile, counted rather than flagged (tasks.js). */
  deer?: number;
  /* A rock face already broken for stone, so it cannot be quarried twice (tasks.js). */
  quarried?: boolean;
  /* The being (by id) working this tile's tree or pitfall right now, so a second one does not
     start the same job (tasks.js). */
  claimed?: number | null;
}

/** A camp: a hearth, its people's stash, and its buildings. Built by makeCamp() in camps.js. */
interface Camp {
  id: number;
  name: string;
  site: [number, number] | null;
  target: [number, number] | null;
  pit: [number, number] | null;
  stashTile: [number, number] | null;
  stash: { [item: string]: number };
  rot: { cooked: number[]; berries: number[] };
  fae: { known: boolean; favor: number; grudges: { [beingId: string]: number }; blightUntil: number; lastPrank: number };
  gnomes: { known: boolean };
  stone: any;
  ward: any;
  tools: { [tool: string]: number };
  shelter: any;
  rack: any;
  storehouse: any;
  workshop: any;
  kiln: any;
  garden: any;
  huts: any[];
  village: boolean;
  snares: any[];
  pitfalls: any[];
  litTicks: number;
  streak: number;
  bestStreak: number;
  everLit: boolean;
  outSince: number;
  nextArrival: number;
  siteReason: string;
  coals: number;
  rotLogged: number;
  wolfLogged: number;
  guardLogged: number;
  fished: number;
  /* True once this camp has felled its first pine, so "Logs at last" is said once (tasks.js). */
  hadLogs: boolean;
  founded: number;
  /* Set right after makeCamp()'s literal (camps.js), not in it, so tsc sees them as optional:
     they are always there by the time anything else runs, but not in the one statement that
     builds the record. */
  names?: any[];
  namedAt?: number;
  founder?: number | null;
  villageNamed?: number;
  /* The best cook skill anyone has shown at this camp's fire, read for a chip in the eating
     thought (beings.js, goals.js). */
  bestCook?: number;
  /* Who set out to found a new camp, as a line of names, while camps.js's party is on the
     road; cleared on arrival. */
  sentParty?: string;
  /* True once a party from this camp is the new camp, the other side of a party sent (camps.js). */
  overTheHills?: boolean;
}

/** A task record on a being: what it is doing, and how far it has gotten. */
interface Task {
  type: string;
  label: string;
  progress?: number;
  path?: any;
  args?: any;
  started?: number;
  key?: string;
  target?: any;
  within?: number;
  /* The tick work was last put into this job (tasks.js). Optional: no task record is built with it
     — `begin()` returns `{ label, path, progress, target, within }` (tasks.js:114) — and the work
     stop reads its own absence, `const ran = t.worked === undefined ? 1 : Math.max(1, tick - t.worked);`
     (tasks.js:124). A step of the walk sets it too, `t.worked = tick;` (tasks.js:52), so the walk to
     the work tile is never credited as work. */
  worked?: number;
  /* The tick an unfinished job will be done on, so the worker is not looked at on every tick of it:
     `if (t.progress < n){ t.due = tick + Math.ceil((n - t.progress) / speed); return 'continue'; }`
     (tasks.js:128). Optional: it is absent until a stop leaves the job unfinished, and nextAct reads
     it as a plain comparison, `if (t.due > tick) return t.due - tick;` (beings.js:538). */
  due?: number;
  /* The tick a wait is over on, converted once from the countdown `t.wait`:
     `if (t.wait > 0){ t.waitUntil = tick + t.wait; t.wait = 0; }` (tasks.js:47). Optional: only a
     task that asked for a wait ever has it, and both readers compare it, `if (t.waitUntil > tick) return;`
     (tasks.js:48) and beings.js:536. */
  waitUntil?: number;
}

/** An item carried, stashed, or dropped: a kind and a count, plus whatever else that kind tracks. */
interface Item {
  kind: string;
  count: number;
}

/** An event handed to inject() at the door: door.js. */
interface DoorEvent {
  act: string;
  source: string;
}

/** The spec workKind() in tasks.js turns into a task kind. skill is read at run time with
    `of(skill, args) || skillOfLabel(label)`, so a spec is free to leave it out. */
interface WorkKindSpec {
  label: any;
  amount: any;
  skill?: any;
  effect: (a: any, args: any, t?: any) => void;
  type?: string;
}

/** One entry in DOOR_ACTS (door.js): a function from an event to its message, and, for `load`
    only, the replacesWorld flag set on it after the table is built. */
interface DoorAct {
  (e: any): string | null;
  replacesWorld?: boolean;
}
