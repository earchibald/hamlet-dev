/* The key map and the dispatcher. No DOM.
   One table. Every clickable thing has a row here, and the button prints the key.
   focus: 'any' fires everywhere, 'map' only with the map focused, 'drawer' only with a drawer focused,
   'dialog' only inside a dialog.
   Movement keys are provisional. A feedback pass follows the first build. Change them here and nowhere else. */
const DRAWERS = [
  { id: 'people',    label: 'People',    key: '1' },
  { id: 'goals',     label: 'Goals',     key: '2' },
  { id: 'chronicle', label: 'Chronicle', key: '3' },
  { id: 'camp',      label: 'Camp',      key: '4' },
];
const KEYMAP = [
  { key: 'Escape',     focus: 'any',    action: 'back',        label: 'Back' },
  { key: 'Tab',        focus: 'any',    action: 'focusNext',   label: 'Next panel' },
  { key: 'Tab',        shift: true, focus: 'any', action: 'focusPrev', label: 'Previous panel' },
  { key: ' ',          focus: 'any',    action: 'pause',       label: 'Pause or resume', button: 'pause' },
  { key: '.',          focus: 'any',    action: 'step',        label: 'Step one tick', button: 'stepBtn' },
  { key: '>',          shift: true, focus: 'any', action: 'hour', label: 'Step one hour', button: 'hourBtn' },
  { key: '-',          focus: 'any',    action: 'slower',      label: 'Slower' },
  { key: '=',          focus: 'any',    action: 'faster',      label: 'Faster' },
  { key: 'm',          focus: 'any',    action: 'view',        label: 'Cycle sector, nearby, world', button: 'viewBtn' },
  { key: ']',          focus: 'any',    action: 'levelUp',     label: 'Up a level', button: 'lvUp' },
  { key: '[',          focus: 'any',    action: 'levelDown',   label: 'Down a level', button: 'lvDown' },
  { key: 'ArrowLeft',  focus: 'map', action: 'cursor', arg: [-1, 0, 1], label: 'Cursor west' },
  { key: 'ArrowRight', focus: 'map', action: 'cursor', arg: [1, 0, 1],  label: 'Cursor east' },
  { key: 'ArrowUp',    focus: 'map', action: 'cursor', arg: [0, -1, 1], label: 'Cursor north' },
  { key: 'ArrowDown',  focus: 'map', action: 'cursor', arg: [0, 1, 1],  label: 'Cursor south' },
  { key: 'ArrowLeft',  shift: true, focus: 'map', action: 'cursor', arg: [-1, 0, 5], label: 'Cursor west by five' },
  { key: 'ArrowRight', shift: true, focus: 'map', action: 'cursor', arg: [1, 0, 5],  label: 'Cursor east by five' },
  { key: 'ArrowUp',    shift: true, focus: 'map', action: 'cursor', arg: [0, -1, 5], label: 'Cursor north by five' },
  { key: 'ArrowDown',  shift: true, focus: 'map', action: 'cursor', arg: [0, 1, 5],  label: 'Cursor south by five' },
  { key: 'ArrowLeft',  ctrl: true, focus: 'map', action: 'cursor', arg: [-1, 0, 'sector'], label: 'A sector west', button: 'nW' },
  { key: 'ArrowRight', ctrl: true, focus: 'map', action: 'cursor', arg: [1, 0, 'sector'],  label: 'A sector east', button: 'nE' },
  { key: 'ArrowUp',    ctrl: true, focus: 'map', action: 'cursor', arg: [0, -1, 'sector'], label: 'A sector north', button: 'nN' },
  { key: 'ArrowDown',  ctrl: true, focus: 'map', action: 'cursor', arg: [0, 1, 'sector'],  label: 'A sector south', button: 'nS' },
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
  { key: 'Enter',      focus: 'dialog', action: 'start',       label: 'Make world', button: 'newWorld' },
  { key: 'Escape',     focus: 'dialog', action: 'back',        label: 'Close', button: 'helpClose' },
];
KEYMAP.push({ key: 'f',          focus: 'window', action: 'follow',    label: 'Follow this person' });
for (const t of TOOLS){
  KEYMAP.push({ key: t.key, focus: 'any', action: 'tool', arg: t.id, label: t.label });
  if (t.oneShot) KEYMAP.push({ key: t.key, shift: true, focus: 'any', action: 'toolSticky', arg: t.id, label: `${t.label}, and keep it` });
}
for (const d of DRAWERS) KEYMAP.push({ key: d.key, focus: 'map', action: 'drawer', arg: d.id, label: `Toggle ${d.label}`, button: `tab-${d.id}` });
for (let n = 1; n <= 9; n++) KEYMAP.push({ key: String(n), focus: 'drawer', action: 'rowPick', arg: n, label: `Row ${n}` });
for (let n = 1; n <= 9; n++){
  KEYMAP.push({ key: String(n), alt: true, focus: 'any', action: 'jumpChip', arg: n, label: `Jump to alert ${n}` });
  KEYMAP.push({ key: String(n), alt: true, shift: true, focus: 'any', action: 'muteMenu', arg: n, label: `Mute alert ${n}` });
}
for (let k = 1; k <= 3; k++) KEYMAP.push({ key: String(k), focus: 'dialog:mute', action: 'muteChoice', arg: k, label: ['Mute this alert', 'Mute this kind here', 'Mute this kind everywhere'][k - 1], button: `mute${k}` });

/* The dispatcher. focus is 'map', 'drawer:<id>', 'window:<n>', 'dialog', or 'dialog:<name>'. Returns { action, arg } or null. */
function keyAction(e, focus){
  const kind = focus.startsWith('dialog:') ? focus : focus.startsWith('drawer:') ? 'drawer' : focus.startsWith('window:') ? 'window' : focus;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const code = e.code && /^Digit\d$/.test(e.code) ? e.code.slice(5) : null;
  for (const k of KEYMAP){
    if (k.focus !== 'any' && k.focus !== kind) continue;
    const rowKey = k.key.length === 1 ? k.key.toLowerCase() : k.key;
    if (rowKey !== key && !(code && rowKey === code)) continue;
    if (!!k.shift !== e.shiftKey) continue;
    if (!!k.ctrl !== e.ctrlKey || !!k.alt !== e.altKey || !!k.meta !== e.metaKey) continue;
    return { action: k.action, arg: k.arg };
  }
  return null;
}
