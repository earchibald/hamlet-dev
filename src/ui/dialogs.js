/* Start and help dialogs. One dialog is open at a time. Esc closes it. */
function anyDialogOpen(){ return !!document.querySelector('dialog[open]'); }
function closeDialogs(){ for (const d of document.querySelectorAll('dialog[open]')) d.close(); if (ui.focus.startsWith('dialog')) setFocus('map'); }
function openStart(){ closeDialogs(); $('seed').value = seedText || ''; startNote(''); showContinue(); setFocus('dialog:start'); $('start').showModal(); $('seed').focus(); $('seed').select(); }
/* One line inside the start dialog, for an answer that the foot behind it would hide. An empty line hides it. */
function startNote(text){ const p = $('startNote'); if (!p) return; p.textContent = text; p.hidden = !text; }
/* The Continue button, shown only when the autosave slot holds a world. The save is outside data, so its
   seed goes in as text, never as markup, and a slot without a real tick is no slot: it would say "day NaN".
   The key comes from the key map, so the button cannot drift from it. */
function showContinue(){
  const b = $('continueBtn'); if (!b) return;
  const ok = !!lastSave && typeof lastSave.tick === 'number' && Number.isFinite(lastSave.tick);
  b.hidden = !ok;
  if (!ok) return;
  const row = KEYMAP.find(k => k.button === 'continueBtn');
  b.textContent = `Continue ${lastSave.seed}, day ${Math.floor(Number(lastSave.tick) / DAY) + 1}`;
  const k = document.createElement('kbd'); k.textContent = row ? keyName(row) : '';
  b.appendChild(k);
}
let muteFor = null;
function openMute(a){ closeDialogs(); muteFor = a; $('muteTitle').textContent = `Mute: ${a.text}`; setFocus('dialog:mute'); $('mute').showModal(); }
function muteChoice(k){
  if (!muteFor) return;
  if (k === 1) mute(muteFor.type, camp.id, muteFor.text); else if (k === 2) mute(muteFor.type, camp.id); else mute(muteFor.type, 0);
  muteFor = null; closeDialogs(); persist(); renderUI(true);
}
/* H cannot be undone and it throws away the thing the creation is for, so it asks. The ages hold while it
   is open, as they hold behind any dialog. */
function openHurry(){
  closeDialogs();
  $('hurryLeft').textContent = `${ageName(age)}. ${awakeGods().length} gods are still awake.`;
  setFocus('dialog:hurry');
  $('hurry').showModal();
  $('hurryGo').focus();
}
function openHelp(){
  closeDialogs();
  const seen = new Set();
  $('helpKeys').innerHTML = KEYMAP.filter(k => !k.quiet).map(k => { const line = `${keyName(k)}|${k.label}`; if (seen.has(line)) return ''; seen.add(line); return `<tr><td>${keyName(k)}</td><td>${k.label}${k.focus === 'map' ? ' <span class="muted">(map)</span>' : k.focus === 'drawer' ? ' <span class="muted">(drawer)</span>' : ''}</td></tr>`; }).join('');
  $('helpMuted').innerHTML = ui.mutes.size ? [...ui.mutes].map(m => `<button class="btn small" data-unmute="${esc(m)}">${esc(muteLabel(m))}<kbd>click</kbd></button>`).join(' ') : '<p class="muted">Nothing is muted.</p>';
  /* The lost people, and the old names somebody has read. Every string here comes from the sim, so it
     is escaped once, here, where it becomes markup. The builders that made it keep their text raw. */
  const learned = learnedNames();
  $('helpLore').innerHTML = !lore ? '<p class="muted">No world yet.</p>' : `<ul>
    <li>Before us: ${esc(lore.people)}.</li>
    <li>What they built: ${esc(lore.built)}.</li>
    <li>What took them: ${esc(lore.took)}.</li>
    <li>The sky: ${esc(lore.sky.text)}, ${esc(lore.sky.meaning)}. That is you.</li>
    <li>The sprites: ${esc(lore.sprites.text)}, ${esc(lore.sprites.meaning)}.</li>
    <li>This valley: ${esc(valleyName() || describe(valley, 'valley'))}.</li>
  </ul><h3>Old names learned</h3>${learned.length ? `<ul>${learned.map(r => `<li>${esc(r.text)}, the ${esc(r.what)}. It means ${esc(r.meaning)}.</li>`).join('')}</ul>` : '<p class="muted">Nobody has found the old marks yet. Walk a hill, or go into a cave.</p>'}`;
  setFocus('dialog:help'); $('help').showModal();
}

/* The command palette: every action and every named thing, one search box. */
let palRows = [], palHit = [], palSel = 0;
function openPalette(){ closeDialogs(); palRows = paletteRows(); palSel = 0; setFocus('dialog:palette'); $('paletteInput').value = ''; $('palette').showModal(); renderPalette(); $('paletteInput').focus(); }
function renderPalette(){
  palHit = paletteMatch($('paletteInput').value, palRows).slice(0, 40); palSel = clamp(palSel, 0, Math.max(0, palHit.length - 1));
  /* Every row's label is escaped here, once, at the one place a label becomes markup. A static label
     (from KEYMAP, a being's plain name, and so on) has never held a special character, so this changes
     nothing for it; a sector's own name can, now that a name is free-form text from the namer. */
  $('paletteList').innerHTML = palHit.map((r, i) => `<li class="${i === palSel ? 'sel' : ''}" data-i="${i}"><span>${i < 9 ? `<kbd>Alt+${i + 1}</kbd> ` : ''}${esc(r.label)}</span>${r.key ? `<kbd>${r.key}</kbd>` : ''}</li>`).join('') || '<li class="muted">Nothing matches.</li>';
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
  setFocus('dialog:chord'); $('chord').showModal();
}
