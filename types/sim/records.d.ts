/* Ambient shapes for the sim's main records, read from the code in src/sim/, not guessed.
   This file declares no import and no export, so TypeScript treats it as a global script,
   the same way it treats the files in src/sim/. It adds no runtime code: it only names the
   shapes that tsc uses to check src/sim/*.js under tsconfig.sim.json.

   Each interface keeps an index signature. The records in src/sim/ gain fields by species,
   by task, and by era (see beings.js, camps.js, world.js), so a closed interface would fail
   on every one of those legal, conditional fields. The named fields are the ones every
   record of that kind carries; the index signature covers the rest. */

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
  thoughts: any[];
  opinions: { [beingId: string]: number };
  rel: { [beingId: string]: string };
  task: any;
  carrying: { kind: string; count: number } | null;
  status: string;
  asleep: boolean;
  cooldown: { [key: string]: number };
  history: any[];
  lastChoice: any;
  lastHurt: any;
  homeless: boolean;
  pokedUntil: number;
  camp: any;
  deeds: { [tag: string]: number };
  [key: string]: any;
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
  [key: string]: any;
}

/** A camp: a hearth, its people's stash, and its buildings. Built by makeCamp() in camps.js. */
interface Camp {
  id: number;
  founder: number;
  stash: { [item: string]: number };
  tools: { [tool: string]: number };
  huts: any[];
  [key: string]: any;
}

/** A task record on a being: what it is doing, and how far it has gotten. */
interface Task {
  type: string;
  label: string;
  progress?: number;
  path?: any;
  args?: any;
  [key: string]: any;
}

/** An item carried, stashed, or dropped: a kind and a count, plus whatever else that kind tracks. */
interface Item {
  kind: string;
  count: number;
  [key: string]: any;
}

/** An event handed to inject() at the door: door.js. */
interface DoorEvent {
  act: string;
  source: string;
  [key: string]: any;
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
