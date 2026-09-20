/* Ambient shapes for the sim's main records, read from the code in src/sim/, not guessed.
   This file declares no import and no export, so TypeScript treats it as a global script,
   the same way it treats the files in src/sim/. It adds no runtime code: it only names the
   shapes that tsc uses to check src/sim/*.js under tsconfig.sim.json.

   No interface here carries a catch-all index signature. A catch-all hid every misspelt
   field: `beings[0].hungerr` and `tileAt(1,2,0).featur` both passed with one in place, and
   only removing it made tsc report them. cooldown keeps its index signature, named and
   explained where it is declared, because it is genuinely a map from any task name to a
   tick: nothing enumerates the task names ahead of time.

   A field whose own shape is a further record (grove, den) is typed `any`, named here so a
   later pass can give it a real shape; see the comment at each. */

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
  carrying: { kind: string; count: number } | null;
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

  /* sprite only (beings.js, fae.js, world.js): the hollow it belongs to, when it has not
     swarmed, and where and until when it is raiding when it has. grove itself (anger,
     swarmUntil, sector, lastBirth, x, y, mark, id) is not modelled here. */
  grove?: any;
  returnAt?: number;
  target?: any;

  /* fox, wolf, gnome only (beings.js, species.js, world.js): the cave record it dens in,
     or the one it was driven from. A cave (kind, hill, owner, cleared, exit, bench,
     holding, disturbed, disturbedBy, story, from, lastBirth) is not modelled here. */
  den?: any;
  oldDen?: any;
  digAgain?: number;

  /* god only (gods.js): its pole, the region it holds, and where it stands. */
  pole?: string;
  contrast?: string;
  epithet?: string;
  acted?: number;
  at?: number | null;
  region?: number | null;
}

/** One thought on a.thoughts: a labelled mood swing that decays over `left` ticks. addThought() in beings.js. */
interface Thought {
  key: string;
  text: string;
  value: number;
  left: number;
}

/** One line of the chronicle, as log() in core.js builds it, and the last forty of which a.history keeps. */
interface ChronicleLine {
  tick: number;
  when: any;
  text: string;
  kind: string;
  tag: string | null;
  camp: number | null;
  age?: number;
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
  hill: any;
  cave: any;
  mouth: any;
  water: any;
  pond: any;
  ford: any;
  /* Set once, in paintGround() (world.js), to the id of the region the tile was painted in. */
  country?: number | null;
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
  founded: number;
  names: any[];
  namedAt: number;
  founder: number | null;
  villageNamed: number;
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
