/* Storage for saves, and nothing else. No view state changes here, and no DOM at load time.
   The built page is published as a sandboxed artifact, where a download, a file picker, or a
   database may all be blocked. Every call sits in a try, every error event is answered, and each
   function resolves with a plain value instead of throwing. A page that cannot store still plays. */
const SAVE_DB = 'hearth', SAVE_STORE = 'saves', AUTOSAVE_KEY = 'autosave';
/* The object URL is freed on the next turn of the loop, after the click has taken the file. */
const SAVE_FREE_MS = 1000;

/* Hand the player a file. Returns null when the download started, or the sentence to show. */
function writeSaveFile(name, text){
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* already gone */ } }, SAVE_FREE_MS);
    return null;
  } catch (e) { return 'This page cannot write a file.'; }
}

/* Read a chosen file. Resolves with { snapshot } or { error }. It never rejects. */
function readSaveFile(file){
  return new Promise(resolve => {
    try {
      const r = new FileReader();
      r.onerror = () => resolve({ error: 'This file cannot be read.' });
      r.onabort = () => resolve({ error: 'This file cannot be read.' });
      r.onload = () => { try { resolve({ snapshot: JSON.parse(r.result) }); } catch (e) { resolve({ error: 'This file is not a save.' }); } };
      r.readAsText(file);
    } catch (e) { resolve({ error: 'This file cannot be read.' }); }
  });
}

/* The one database. Resolves with the database, or with null when there is none to be had. */
function saveDb(){
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB){ resolve(null); return; }
      const req = indexedDB.open(SAVE_DB, 1);
      req.onupgradeneeded = () => { try { if (!req.result.objectStoreNames.contains(SAVE_STORE)) req.result.createObjectStore(SAVE_STORE); } catch (e) { /* the transaction fails below */ } };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

/* Write the one autosave slot. Resolves true when it was kept, false when it was not. */
function putAutosave(text){
  return saveDb().then(db => new Promise(resolve => {
    if (!db){ resolve(false); return; }
    try {
      const tx = db.transaction(SAVE_STORE, 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
      tx.objectStore(SAVE_STORE).put(text, AUTOSAVE_KEY);
    } catch (e) { resolve(false); }
  })).catch(() => false);
}

/* Read the one autosave slot. Resolves with the text, or with null when the slot is empty or shut. */
function getAutosave(){
  return saveDb().then(db => new Promise(resolve => {
    if (!db){ resolve(null); return; }
    try {
      const tx = db.transaction(SAVE_STORE, 'readonly'), req = tx.objectStore(SAVE_STORE).get(AUTOSAVE_KEY);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch (e) { resolve(null); }
  })).catch(() => null);
}
