/* Start and help dialogs. One dialog is open at a time. Esc closes it. */
function anyDialogOpen(){ return !!document.querySelector('dialog[open]'); }
function closeDialogs(){ for (const d of document.querySelectorAll('dialog[open]')) d.close(); if (ui.focus.startsWith('dialog')) ui.focus = 'map'; }
function openStart(){ closeDialogs(); $('seed').value = seedText || ''; startNote(''); showContinue(); ui.focus = 'dialog:start'; $('start').showModal(); $('seed').focus(); $('seed').select(); }
/* One line inside the start dialog, for an answer that the foot behind it would hide. An empty line hides it. */
function startNote(text){ const p = $('startNote'); if (!p) return; p.textContent = text; p.hidden = !text; }
/* The Continue button, shown only when the autosave slot holds a world. The save is outside data, so its
   seed goes in as text, never as markup. The key comes from the key map, so the button cannot drift from it. */
function showContinue(){
  const b = $('continueBtn'); if (!b) return;
  b.hidden = !lastSave;
  if (!lastSave) return;
  const row = KEYMAP.find(k => k.button === 'continueBtn');
  b.textContent = `Continue ${lastSave.seed}, day ${Math.floor(Number(lastSave.tick) / DAY) + 1}`;
  const k = document.createElement('kbd'); k.textContent = row ? keyName(row) : '';
  b.appendChild(k);
}
let muteFor = null;
function openMute(a){ closeDialogs(); muteFor = a; $('muteTitle').textContent = `Mute: ${a.text}`; ui.focus = 'dialog:mute'; $('mute').showModal(); }
function muteChoice(k){
  if (!muteFor) return;
  if (k === 1) mute(muteFor.type, camp.id, muteFor.text); else if (k === 2) mute(muteFor.type, camp.id); else mute(muteFor.type, 0);
  muteFor = null; closeDialogs(); persist(); renderUI(true);
}
function openHelp(){
  closeDialogs();
  const seen = new Set();
  $('helpKeys').innerHTML = KEYMAP.filter(k => !k.quiet).map(k => { const line = `${keyName(k)}|${k.label}`; if (seen.has(line)) return ''; seen.add(line); return `<tr><td>${keyName(k)}</td><td>${k.label}${k.focus === 'map' ? ' <span class="muted">(map)</span>' : k.focus === 'drawer' ? ' <span class="muted">(drawer)</span>' : ''}</td></tr>`; }).join('');
  $('helpMuted').innerHTML = ui.mutes.size ? [...ui.mutes].map(m => `<button class="btn small" data-unmute="${esc(m)}">${esc(muteLabel(m))}<kbd>click</kbd></button>`).join(' ') : '<p class="muted">Nothing is muted.</p>';
  ui.focus = 'dialog:help'; $('help').showModal();
}

/* The command palette: every action and every named thing, one search box. */
let palRows = [], palHit = [], palSel = 0;
function openPalette(){ closeDialogs(); palRows = paletteRows(); palSel = 0; ui.focus = 'dialog:palette'; $('paletteInput').value = ''; $('palette').showModal(); renderPalette(); $('paletteInput').focus(); }
function renderPalette(){
  palHit = paletteMatch($('paletteInput').value, palRows).slice(0, 40); palSel = clamp(palSel, 0, Math.max(0, palHit.length - 1));
  $('paletteList').innerHTML = palHit.map((r, i) => `<li class="${i === palSel ? 'sel' : ''}" data-i="${i}"><span>${i < 9 ? `<kbd>Alt+${i + 1}</kbd> ` : ''}${r.label}</span>${r.key ? `<kbd>${r.key}</kbd>` : ''}</li>`).join('') || '<li class="muted">Nothing matches.</li>';
  const sel = $('paletteList').querySelector('.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
}
function paletteMove(d){ palSel = clamp(palSel + d, 0, Math.max(0, palHit.length - 1)); renderPalette(); }
function paletteRun(i = palSel){
  const r = palHit[i]; if (!r) return;
  closeDialogs(); ui.recent = [r.label, ...ui.recent.filter(l => l !== r.label)].slice(0, 5); persist();
  ACTIONS[r.action](r.arg); renderUI(true);
}
/* The stage chord: `g` opens this with one lettered button per reached stage. Built at run time, so its ids are not in the template. */
function openChord(){
  closeDialogs();
  $('chordButtons').innerHTML = STAGES.filter(s => stagesShown().includes(s.id)).map(s => `<button class="btn" id="chord-${s.id}" data-stage="${s.id}">${s.label}<kbd>${STAGE_LETTER[s.id].toUpperCase()}</kbd></button>`).join(' ');
  ui.focus = 'dialog:chord'; $('chord').showModal();
}
