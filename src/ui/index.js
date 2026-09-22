// The interface as one script, assembled from the files below. Plain scripts
// in one scope, joined after the sim. state.js declares the view state the
// others read at load time, so it goes first. main.js calls initUI() at its
// end, so it goes last. The pure files, derive.js and keys.js, touch no DOM
// and are loaded in Node by tests/ui.js, with saves.js, which holds only storage
// and reaches for a file or a database inside its functions, never at load time.
const fs = require('fs');
const path = require('path');

const FILES = ['state', 'icons', 'derive', 'keys', 'saves', 'marks', 'map', 'zoom', 'timeline', 'inspect', 'strip', 'windows', 'panels', 'dialogs', 'actions', 'main'];

function source(files = FILES){
  return files.map(f => fs.readFileSync(path.join(__dirname, f + '.js'), 'utf8')).join('\n');
}

module.exports = { FILES, source };
