/* The key map and the dispatcher. No DOM.
   One table. Every clickable thing has a row here, and the button prints the key.
   focus: 'any' fires everywhere, 'map' only with the map focused, 'drawer' only with a drawer focused,
   'dialog:<name>' only inside that dialog. A focused row wins over an 'any' row on the same key.
   A quiet row works but stays out of the help table.
   Movement keys are provisional. A feedback pass follows the first build. Change them here and nowhere else. */
/* A drawer with `fit` is as tall as its rows, up to a cap. The others share the height that is left. */
const DRAWERS = [
  { id: 'people',    label: 'People',    key: '1', fit: true },
  { id: 'goals',     label: 'Goals',     key: '2' },
  { id: 'chronicle', label: 'Chronicle', key: '3' },
  { id: 'camp',      label: 'Camp',      key: '4', fit: true },
  { id: 'legends',   label: 'Legends',   key: '5' },
];
/* The stage chord: `g` opens a dialog with one lettered button per reached stage; the letter opens Goals on that stage. */
const STAGE_LETTER = { fire: 'f', food: 'o', tools: 't', shelter: 's', crafts: 'c', sprites: 'p', settlement: 'e' };
const KEYMAP = [
  { key: 'Escape',     focus: 'any',    action: 'back',        label: 'Back' },
  { key: 'Tab',        focus: 'any',    action: 'focusNext',   label: 'Next panel' },
  { key: 'Tab',        shift: true, focus: 'any', action: 'focusPrev', label: 'Previous panel' },
  { key: ' ',          focus: 'any',    action: 'pause',       label: 'Pause or resume', button: 'pause' },
  { key: '.',          focus: 'any',    action: 'step',        label: 'Step one tick, or one age', button: 'stepBtn' },
  { key: '>',          shift: true, focus: 'any', action: 'hour', label: 'Step one hour', button: 'hourBtn' },
  { key: 'h',          focus: 'any',    action: 'hurry',       label: 'Hurry to the valley', button: 'hurryBtn' },
  { key: '-',          focus: 'any',    action: 'slower',      label: 'Slower' },
  { key: '=',          focus: 'any',    action: 'faster',      label: 'Faster' },
  { key: 'm',          focus: 'any',    action: 'view',        label: 'Cycle sector, nearby, world', button: 'viewBtn' },
  { key: ']',          focus: 'any',    action: 'levelUp',     label: 'Up a level', button: 'lvUp' },
  { key: '[',          focus: 'any',    action: 'levelDown',   label: 'Down a level', button: 'lvDown' },
  { key: 't',          focus: 'any',      action: 'foldTimeline',    label: 'Fold or unfold the timeline', button: 'foldTl' },
  /* The same two keys as the levels. A focused row beats an `any` row, so they zoom the timeline's
     own time axis while the timeline holds focus, and change level everywhere else. */
  { key: '[',          focus: 'timeline', action: 'zoomTimelineOut', label: 'Timeline: more ages', button: 'tlOut' },
  { key: ']',          focus: 'timeline', action: 'zoomTimelineIn',  label: 'Timeline: fewer ages', button: 'tlIn' },
  { key: 'ArrowLeft',  focus: 'map', action: 'cursor', arg: [-1, 0, 1], label: 'Cursor west' },
  { key: 'ArrowRight', focus: 'map', action: 'cursor', arg: [1, 0, 1],  label: 'Cursor east' },
  { key: 'ArrowUp',    focus: 'map', action: 'cursor', arg: [0, -1, 1], label: 'Cursor north' },
  { key: 'ArrowDown',  focus: 'map', action: 'cursor', arg: [0, 1, 1],  label: 'Cursor south' },
  { key: 'ArrowLeft',  shift: true, focus: 'map', action: 'cursor', arg: [-1, 0, 5], label: 'Cursor west by five' },
  { key: 'ArrowRight', shift: true, focus: 'map', action: 'cursor', arg: [1, 0, 5],  label: 'Cursor east by five' },
  { key: 'ArrowUp',    shift: true, focus: 'map', action: 'cursor', arg: [0, -1, 5], label: 'Cursor north by five' },
  { key: 'ArrowDown',  shift: true, focus: 'map', action: 'cursor', arg: [0, 1, 5],  label: 'Cursor south by five' },
  /* Not Ctrl: macOS takes Ctrl with an arrow for Mission Control, and the page never sees it.
     The key goes to the sector's edge first. The buttons these rows name step a whole sector, through ACTIONS.nav. */
  { key: 'ArrowLeft',  alt: true, focus: 'map', action: 'cursor', arg: [-1, 0, 'edge'], label: 'West edge, then a sector west', button: 'nW' },
  { key: 'ArrowRight', alt: true, focus: 'map', action: 'cursor', arg: [1, 0, 'edge'], label: 'East edge, then a sector east', button: 'nE' },
  { key: 'ArrowUp',  alt: true, focus: 'map', action: 'cursor', arg: [0, -1, 'edge'], label: 'North edge, then a sector north', button: 'nN' },
  { key: 'ArrowDown', alt: true, focus: 'map', action: 'cursor', arg: [0, 1, 'edge'], label: 'South edge, then a sector south', button: 'nS' },
  { key: 'Enter',      focus: 'map', action: 'applyAt',   label: 'Apply the tool at the cursor' },
  { key: 'Home',       focus: 'map', action: 'home',      label: 'Cursor to the hearth' },
  { key: 'w',          focus: 'map', action: 'worldHere', label: 'World map at the camp' },
  { key: 'ArrowUp',    focus: 'drawer', action: 'rowUp',       label: 'Row up' },
  { key: 'ArrowDown',  focus: 'drawer', action: 'rowDown',     label: 'Row down' },
  { key: 'ArrowLeft',  focus: 'drawer', action: 'priorityDown', label: 'Goal priority down' },
  { key: 'ArrowRight', focus: 'drawer', action: 'priorityUp',  label: 'Goal priority up' },
  { key: 'Enter',      focus: 'drawer', action: 'rowOpen',     label: 'Open row' },
  { key: 'a',          focus: 'drawer', action: 'showAll',     label: 'Goals: show the whole ladder', button: 'showAllBtn' },
  { key: 'o',          focus: 'drawer', action: 'popOut',    label: 'Pop the drawer out into a window' },
  { key: 'o',          focus: 'window', action: 'popOut',    label: 'Dock the window back' },
  { key: 'ArrowUp',    focus: 'window', action: 'rowUp',     label: 'Row up' },
  { key: 'ArrowDown',  focus: 'window', action: 'rowDown',   label: 'Row down' },
  { key: 'Enter',      focus: 'window', action: 'rowOpen',   label: 'Open row' },
  { key: '?',          shift: true, focus: 'any', action: 'help', label: 'Help', button: 'helpBtn' },
  { key: 'F1',         focus: 'any',    action: 'campN', arg: 1, label: 'Camp 1' },
  { key: 'F2',         focus: 'any',    action: 'campN', arg: 2, label: 'Camp 2' },
  { key: 'F3',         focus: 'any',    action: 'campN', arg: 3, label: 'Camp 3' },
  { key: 'F4',         focus: 'any',    action: 'campN', arg: 4, label: 'Camp 4' },
  { key: 'F5',         focus: 'any',    action: 'campN', arg: 5, label: 'Camp 5' },
  { key: 'F6',         focus: 'any',    action: 'campN', arg: 6, label: 'Camp 6' },
  /* Start and help each have their own focus. When they shared one, Enter in help opened Start. */
  { key: 'Enter',      focus: 'dialog:start', action: 'makeWorld', label: 'Make world', button: 'newWorld' },
  { key: 'Escape',     focus: 'dialog:help',  action: 'back',      label: 'Close', button: 'helpClose' },
  { key: 'k',          meta: true, focus: 'any', action: 'palette',   label: 'Command palette', button: 'paletteBtn' },
  { key: 'k',          ctrl: true, focus: 'any', action: 'palette',   label: 'Command palette' },
  { key: 'n',          ctrl: true, focus: 'any', action: 'newWorld',  label: 'New world' },
  /* Save and Load take Ctrl, as New world does. Neither has a button: the strip is full, and the palette lists both. */
  { key: 's',          ctrl: true, focus: 'any', action: 'saveWorld', label: 'Save world to a file' },
  { key: 'o',          ctrl: true, focus: 'any', action: 'loadWorldFile', label: 'Load world from a file' },
  /* The start dialog's own key. A plain letter goes into the seed box, so Continue takes Alt. */
  { key: 'c',          alt: true, focus: 'dialog:start', action: 'continueWorld', label: 'Continue the last world', button: 'continueBtn' },
  { key: 'g',          focus: 'any',    action: 'chord',       label: 'Goals by stage', button: 'chordBtn' },
  /* The search box is an input, not a button, so it prints its key in its placeholder. Esc inside it
     clears the query, then leaves it; that branch is in the keydown guard, which an input never passes. */
  { key: '/',          focus: 'any',    action: 'searchChronicle', label: 'Search the chronicle by name' },
  { key: 'ArrowDown',  focus: 'dialog:palette', action: 'paletteMove', arg: 1,  label: 'Next command' },
  { key: 'ArrowUp',    focus: 'dialog:palette', action: 'paletteMove', arg: -1, label: 'Previous command' },
  { key: 'Enter',      focus: 'dialog:palette', action: 'paletteRun', label: 'Run command' },
];
KEYMAP.push({ key: 'f',          focus: 'window', action: 'follow',    label: 'Follow this person' });
/* In a window F means follow, so Shift+F must not fall through to the 'any' row and stick Light fire. */
KEYMAP.push({ key: 'f',          shift: true, focus: 'window', action: 'follow', label: 'Follow this person', quiet: true });
for (const s of STAGES) KEYMAP.push({ key: STAGE_LETTER[s.id], focus: 'dialog:chord', action: 'stage', arg: s.id, label: `Goals: ${s.label}`, button: `chord-${s.id}` });
for (const t of TOOLS){
  KEYMAP.push({ key: t.key, focus: 'any', action: 'tool', arg: t.id, label: t.label });
  if (t.oneShot) KEYMAP.push({ key: t.key, shift: true, focus: 'any', action: 'toolSticky', arg: t.id, label: `${t.label}, and keep it` });
}
/* After the stage rows, so that under the chord dialog C is still Crafts. */
KEYMAP.push({ key: 'c', focus: 'any', action: 'overlay', label: 'Show or hide the countries', button: 'overlayBtn' });
/* Shift with a digit sets a speed by its place on the ladder. Plain digits belong to the drawers and their rows.
   The label names both ladders, since the same row serves the ages and the days. */
SPEEDS.forEach((v, i) => KEYMAP.push({ key: String(i + 1), shift: true, focus: 'any', action: 'speedStep', arg: i, label: `Pace ${PACE_LABEL[PACES[i]]} \u00b7 Speed ${SPEED_LABEL[v]}`, button: `speed${v}` }));
for (const d of DRAWERS) KEYMAP.push({ key: d.key, focus: 'map', action: 'drawer', arg: d.id, label: `Toggle ${d.label}`, button: `tab-${d.id}` });
for (let n = 1; n <= 9; n++) KEYMAP.push({ key: String(n), focus: 'drawer', action: 'rowPick', arg: n, label: `Row ${n}` });
for (let n = 1; n <= 9; n++){
  KEYMAP.push({ key: String(n), alt: true, focus: 'any', action: 'jumpChip', arg: n, label: `Jump to alert ${n}` });
  KEYMAP.push({ key: String(n), alt: true, shift: true, focus: 'any', action: 'muteMenu', arg: n, label: `Mute alert ${n}` });
}
for (let k = 1; k <= 3; k++) KEYMAP.push({ key: String(k), focus: 'dialog:mute', action: 'muteChoice', arg: k, label: ['Mute this alert', 'Mute this kind here', 'Mute this kind everywhere'][k - 1], button: `mute${k}` });
/* The palette's text box swallows plain digits while typing, so number-row picks fire only through Alt+digit there. */
for (let n = 1; n <= 9; n++) KEYMAP.push({ key: String(n), alt: true, focus: 'dialog:palette', action: 'palettePick', arg: n, label: `Alt+${n}` });

/* The dispatcher. focus is 'map', 'drawer:<id>', 'window:<n>', or 'dialog:<name>'.
   Returns { action, arg, focus } or null. The row's own focus comes back so a caller can tell an 'any' row from a focused one. */
function keyAction(e, focus){
  const kind = focus.startsWith('dialog:') ? focus : focus.startsWith('drawer:') ? 'drawer' : focus.startsWith('window:') ? 'window' : focus;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const code = e.code && /^Digit\d$/.test(e.code) ? e.code.slice(5) : null;
  /* The focused rows answer first, then the 'any' rows. The order of the table does not decide it. */
  for (const want of [kind, 'any']) for (const k of KEYMAP){
    if (k.focus !== want) continue;
    const rowKey = k.key.length === 1 ? k.key.toLowerCase() : k.key;
    if (rowKey !== key && !(code && rowKey === code)) continue;
    if (!!k.shift !== e.shiftKey) continue;
    if (!!k.ctrl !== e.ctrlKey || !!k.alt !== e.altKey || !!k.meta !== e.metaKey) continue;
    return { action: k.action, arg: k.arg, focus: k.focus };
  }
  return null;
}

/* One printable string for a key map row's chord, for the help table, the buttons, and the palette. */
function keyName(k){
  const key = k.key === ' ' ? 'Space' : k.key === 'Escape' ? 'Esc' : k.key === 'ArrowLeft' ? '←' : k.key === 'ArrowRight' ? '→' : k.key === 'ArrowUp' ? '↑' : k.key === 'ArrowDown' ? '↓' : k.key.length === 1 ? k.key.toUpperCase() : k.key;
  /* Shift shows on a named key and on a letter or a digit. `?` and `>` already carry it in the character. */
  const shift = k.shift && (k.key.length > 1 || /^[a-z0-9]$/i.test(k.key));
  return `${k.meta ? '\u2318' : ''}${k.ctrl ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${k.alt ? 'Alt+' : ''}${key}`;
}
