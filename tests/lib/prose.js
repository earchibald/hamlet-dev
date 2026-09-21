/* The helpers of the prose gate in `tests/prose.js`. No network and no outside tool. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, 'prose-rules.json'), 'utf8'));

/* Blank a span and keep its length, so that every later offset still names the same line. */
const blank = s => s.replace(/[^\n]/g, ' ');

/* The string literals of a source file that hold text: four words or more, with a real word among
   them. Comments are blanked first. A placeholder, `${...}`, becomes X, which stands for a name or a
   number. */
function literals(src){
  const code = src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:'"`\\])\/\/[^\n]*/gm, (m, a) => a + blank(m.slice(a.length)));
  const out = [], re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(code))){
    const text = (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, 'X').replace(/\\n/g, ' ').replace(/\\(.)/g, '$1').replace(/\s+/g, ' ').trim();
    if (text.split(' ').length >= 4 && /[A-Za-z]{3,} [a-z]{2,}/.test(text) && !/[{};=<>]/.test(text)) out.push({ line: code.slice(0, m.index).split('\n').length, text });
  }
  return out;
}

/* The lines of a Markdown document that a person reads as prose. A code fence is left out, and
   inline code is blanked. Headings and table rows stay in, because a person reads those too. */
function docLines(md){
  const out = [];
  let fence = false;
  md.split('\n').forEach((raw, i) => {
    if (/^\s*(```|~~~)/.test(raw)){ fence = !fence; return; }
    if (!fence && raw.trim()) out.push({ line: i + 1, text: raw.replace(/`[^`]*`/g, blank) });
  });
  return out;
}

/* The faults of one piece of text. `sentences` also counts the words of each sentence, which is a
   rule for the game and not for the documents. */
function check(text, { sentences = false } = {}){
  const out = [];
  for (const p of RULES.phrases){
    const m = text.match(new RegExp('\\b(?:' + p.re + ')\\b', 'i'));
    if (m) out.push({ rule: 'phrase', match: m[0].toLowerCase(), note: `"${m[0]}": use ${p.alt}` });
  }
  if (/—|\s–\s/.test(text)) out.push({ rule: 'em-dash', match: '—', note: 'use a full stop or a comma' });
  if (sentences) for (const s of text.split(/(?<=[.?!])\s+/)){
    const n = s.trim().split(/\s+/).filter(Boolean).length;
    if (n > RULES.sentenceWords) out.push({ rule: 'long-sentence', match: s, note: `${n} words, and the limit is ${RULES.sentenceWords}` });
  }
  return out;
}

/* Every distinct chronicle line that the creation of these seeds writes. Many lines repeat from
   seed to seed, and one check of a line is enough. */
function rendered(seeds){
  const { load } = require('../../src/sim');
  const { collect } = require('./run');
  const all = new Set();
  for (const seed of seeds){
    const api = load(), c = collect(api);
    api.startWorld(seed);
    c.check('prose gate');
    for (const e of c.events){
      if (typeof e.text !== 'string') throw new Error('a chronicle event has no text: ' + JSON.stringify(e));
      all.add(e.text);
    }
  }
  return [...all];
}

module.exports = { ROOT, RULES, literals, docLines, check, rendered };
