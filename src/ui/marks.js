/* The face of an act. Every mark is drawn in a 48-unit box, one weight, round caps, in the palette's own
   ink over a disc of the map's background. They are strokes, never sprites and never emoji: the map draws
   sprites for people and creatures, and a god's act is not a thing on the ground but something done to it.
   Pairs read against each other — raise and dig are one chevron flipped, hide and show one circle closed
   and radiating. The word is not a training wheel: eighteen marks is more than anyone learns at once. */
const MARKS = {
  split:    { word: 'parts',   paths: ['M10 38 L38 10', 'M6 16 A18 18 0 0 1 22 6', 'M26 42 A18 18 0 0 0 42 32'] },
  claim:    { word: 'claims',  paths: ['M24 6 A18 18 0 1 1 23.9 6', 'M24 16 A8 8 0 1 1 23.9 16'] },
  make:     { word: 'makes',   paths: ['M8 40 L40 40', 'M24 40 L24 18', 'M24 22 L15 13', 'M24 22 L33 13'] },
  raise:    { word: 'raises',  paths: ['M8 38 L40 38', 'M12 28 L24 12 L36 28'] },
  dig:      { word: 'digs',    paths: ['M8 12 L40 12', 'M12 22 L24 38 L36 22'] },
  flow:     { word: 'flows',   paths: ['M6 28 C14 14 20 42 28 28 C32 21 36 18 42 20', 'M36 14 L42 20 L36 26'] },
  pool:     { word: 'pools',   paths: ['M10 14 L10 26 A14 12 0 0 0 38 26 L38 14', 'M16 30 C20 26 22 34 26 30 C29 27 31 31 34 29'] },
  burn:     { word: 'burns',   paths: ['M24 6 C33 18 38 24 38 30 A14 14 0 0 1 10 30 C10 22 18 18 24 6 Z', 'M24 25 C28 31 29 32 29 34 A5 5 0 0 1 19 34 C19 31 21 30 24 25 Z'] },
  freeze:   { word: 'freezes', paths: ['M24 7 L24 41', 'M9 15.5 L39 32.5', 'M39 15.5 L9 32.5', 'M24 14 L19 10', 'M24 14 L29 10', 'M24 34 L19 38', 'M24 34 L29 38'] },
  hide:     { word: 'hides',   paths: ['M24 12 A15 15 0 1 1 23.9 12', 'M5 31 L43 21'] },
  show:     { word: 'shows',   paths: ['M24 17 A7 7 0 1 1 23.9 17', 'M24 3 L24 8', 'M24 40 L24 45', 'M3 24 L8 24', 'M40 24 L45 24', 'M9.5 9.5 L13 13', 'M35 35 L38.5 38.5', 'M38.5 9.5 L35 13', 'M13 35 L9.5 38.5'] },
  battle:   { word: 'wars',    paths: ['M11 11 L37 37', 'M37 11 L11 37', 'M9 9 L15 9', 'M9 9 L9 15', 'M39 39 L33 39', 'M39 39 L39 33'] },
  twist:    { word: 'twists',  paths: ['M10 38 C10 24 38 25 38 13 C38 5 28 5 26 13 C24 23 34 27 38 31'] },
  mingle:   { word: 'mingles', paths: ['M18 24 A11 11 0 1 1 17.9 24', 'M30 24 A11 11 0 1 1 29.9 24'] },
  sleep:    { word: 'sleeps',  paths: ['M8 26 A16 16 0 0 1 40 26', 'M14 33 L18 29', 'M24 36 L24 30', 'M34 33 L30 29'] },
  born:     { word: 'wakes',   paths: ['M24 14 A10 10 0 1 1 23.9 14', 'M24 1 L24 7', 'M24 41 L24 47', 'M1 24 L7 24', 'M41 24 L47 24', 'M7.5 7.5 L12 12', 'M36 36 L40.5 40.5', 'M40.5 7.5 L36 12', 'M12 36 L7.5 40.5'] },
  unmade:   { word: 'unmade',  paths: ['M24 6 A18 18 0 1 0 39 33', 'M31 40 L44 27', 'M31 27 L44 40'] },
  backstop: { word: 'the world holds', paths: ['M16 8 L8 8 L8 40 L16 40', 'M32 8 L40 8 L40 40 L32 40', 'M24 18 L24 30'] },
};
/* A wash is the act it carries: a freeze, a hiding, or a showing. */
function markFor(kind, value){ return MARKS[kind === 'wash' ? value : kind] || null; }
