/* The key map and the dispatcher. No DOM.
   One table. Every clickable thing has a row here, and the button prints the key.
   focus: 'any' fires everywhere, 'map' only with the map focused, 'drawer' only with a drawer focused,
   'dialog' only inside a dialog. 'speedrow' never fires; it exists so the speed buttons print a key.
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
  { key: 'ArrowLeft',  focus: 'map',    action: 'nav', arg: [-1, 0], label: 'West', button: 'nW' },
  { key: 'ArrowRight', focus: 'map',    action: 'nav', arg: [1, 0],  label: 'East', button: 'nE' },
  { key: 'ArrowUp',    focus: 'map',    action: 'nav', arg: [0, -1], label: 'North', button: 'nN' },
  { key: 'ArrowDown',  focus: 'map',    action: 'nav', arg: [0, 1],  label: 'South', button: 'nS' },
  { key: 'ArrowUp',    focus: 'drawer', action: 'rowUp',       label: 'Row up' },
  { key: 'ArrowDown',  focus: 'drawer', action: 'rowDown',     label: 'Row down' },
  { key: 'ArrowLeft',  focus: 'drawer', action: 'priorityDown', label: 'Goal priority down' },
  { key: 'ArrowRight', focus: 'drawer', action: 'priorityUp',  label: 'Goal priority up' },
  { key: 'Enter',      focus: 'drawer', action: 'rowOpen',     label: 'Open row' },
  { key: 'a',          focus: 'drawer', action: 'showAll',     label: 'Goals: show the whole ladder', button: 'showAllBtn' },
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
for (const t of TOOLS) KEYMAP.push({ key: t.key, focus: 'any', action: 'tool', arg: t.id, label: t.label });
for (const s of [1, 4, 16, 64]) KEYMAP.push({ key: '-', focus: 'speedrow', action: 'speed', arg: s, label: `${s}×`, button: `speed${s}` });
for (const d of DRAWERS) KEYMAP.push({ key: d.key, focus: 'map', action: 'drawer', arg: d.id, label: `Toggle ${d.label}`, button: `tab-${d.id}` });
for (let n = 1; n <= 9; n++) KEYMAP.push({ key: String(n), focus: 'drawer', action: 'rowPick', arg: n, label: `Row ${n}` });

/* The dispatcher. focus is 'map', 'drawer:<id>', or 'dialog'. Returns { action, arg } or null. */
function keyAction(e, focus){
  const kind = focus.startsWith('drawer:') ? 'drawer' : focus;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  for (const k of KEYMAP){
    if (k.focus === 'speedrow') continue;
    if (k.focus !== 'any' && k.focus !== kind) continue;
    if ((k.key.length === 1 ? k.key.toLowerCase() : k.key) !== key) continue;
    if (k.key.length > 1 && !!k.shift !== e.shiftKey) continue;
    if (k.key.length === 1 && k.shift && !e.shiftKey) continue;
    if (!!k.ctrl !== e.ctrlKey || !!k.alt !== e.altKey || !!k.meta !== e.metaKey) continue;
    return { action: k.action, arg: k.arg };
  }
  return null;
}
