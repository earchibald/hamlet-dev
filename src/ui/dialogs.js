/* Start and help dialogs. One dialog is open at a time. Esc closes it. */
function anyDialogOpen(){ return !!document.querySelector('dialog[open]'); }
function closeDialogs(){ for (const d of document.querySelectorAll('dialog[open]')) d.close(); if (ui.focus === 'dialog') ui.focus = 'map'; }
function openStart(){ closeDialogs(); $('seed').value = seedText || ''; ui.focus = 'dialog'; $('start').showModal(); $('seed').focus(); $('seed').select(); }
function keyName(k){
  const key = k.key === ' ' ? 'Space' : k.key === 'Escape' ? 'Esc' : k.key === 'ArrowLeft' ? '←' : k.key === 'ArrowRight' ? '→' : k.key === 'ArrowUp' ? '↑' : k.key === 'ArrowDown' ? '↓' : k.key.length === 1 ? k.key.toUpperCase() : k.key;
  return `${k.ctrl ? 'Ctrl+' : ''}${k.alt ? 'Alt+' : ''}${k.shift && k.key.length > 1 ? 'Shift+' : ''}${key}`;
}
function openHelp(){
  closeDialogs();
  const seen = new Set();
  $('helpKeys').innerHTML = KEYMAP.filter(k => k.focus !== 'speedrow').map(k => { const line = `${keyName(k)}|${k.label}`; if (seen.has(line)) return ''; seen.add(line); return `<tr><td>${keyName(k)}</td><td>${k.label}${k.focus === 'map' ? ' <span class="muted">(map)</span>' : k.focus === 'drawer' ? ' <span class="muted">(drawer)</span>' : ''}</td></tr>`; }).join('');
  ui.focus = 'dialog'; $('help').showModal();
}
