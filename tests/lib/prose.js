/* The helpers of the prose gate in `tests/prose.js`. No network and no outside tool. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, 'prose-rules.json'), 'utf8'));

/* Every string literal of a source file that holds a word, with the line it starts on.

   This is a small tokenizer, and not a regular expression. The first version was one expression for
   the comments and one for the quotes. It missed every string inside a placeholder, and two of those
   were player text with an em dash. It also lost its place at a template inside a template, at a
   quote inside a regex literal, and at `/*` inside a line comment.

   A placeholder, `${...}`, becomes X in the template that holds it, which stands for a name or a
   number. The code inside the placeholder is scanned too, so a string in it is read on its own. */
/* Blank a span and keep its length, so that the text after it stays in the same column. */
const blank = s => s.replace(/[^\n]/g, ' ');

const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'void', 'delete', 'throw', 'new', 'yield', 'await']);
function literals(src){
  const out = [];
  let i = 0, line = 1;
  /* A string closes after the strings inside it, so each one is kept with its offset and the list is
     put in source order at the end. A string of placeholders alone, such as XX, holds no word. */
  const emit = (at, from, raw) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (/[A-Za-z]{2}/.test(text.replace(/X/g, ''))) out.push({ from, line: at, text });
  };
  const escaped = () => { // `i` is on the backslash. Returns the character the escape stands for.
    const c = src[i + 1]; i += 2;
    if (c === '\n'){ line++; return ''; }
    return c === 'n' || c === 't' || c === 'r' ? ' ' : c;
  };
  function quoted(q){ // `i` is after the opening quote
    const at = line, from = i; let s = '';
    while (i < src.length && src[i] !== q){
      if (src[i] === '\\') s += escaped();
      else { if (src[i] === '\n') line++; s += src[i++]; }
    }
    i++; emit(at, from, s);
  }
  function template(){ // `i` is after the opening backtick
    const at = line, from = i; let s = '';
    while (i < src.length && src[i] !== '`'){
      if (src[i] === '\\') s += escaped();
      else if (src[i] === '$' && src[i + 1] === '{'){ i += 2; s += 'X'; code(true); }
      else { if (src[i] === '\n') line++; s += src[i++]; }
    }
    i++; emit(at, from, s);
  }
  function regex(){ // `i` is after the opening slash
    let inClass = false;
    while (i < src.length && src[i] !== '\n'){
      const c = src[i];
      if (c === '\\'){ i += 2; continue; }
      if (c === '[') inClass = true; else if (c === ']') inClass = false;
      else if (c === '/' && !inClass){ i++; break; }
      i++;
    }
    while (/[a-z]/i.test(src[i] || '')) i++;
  }
  function code(inPlaceholder){
    let depth = 0, prev = '', word = '';
    while (i < src.length){
      const c = src[i], d = src[i + 1];
      if (c === '\n'){ line++; i++; continue; }
      if (c === '/' && d === '/'){ while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && d === '*'){
        const close = src.indexOf('*/', i + 2), stop = close < 0 ? src.length : close + 2;
        for (; i < stop; i++) if (src[i] === '\n') line++;
        continue;
      }
      if (c === "'" || c === '"'){ i++; quoted(c); prev = c; word = ''; continue; }
      if (c === '`'){ i++; template(); prev = c; word = ''; continue; }
      if (c === '/'){
        /* A slash opens a regex where a value may start. After a value it is a division. */
        const opens = prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev) || REGEX_AFTER_WORD.has(word);
        i++;
        if (opens) regex();
        prev = '/'; word = ''; continue;
      }
      if (c === '{') depth++;
      if (c === '}'){ if (inPlaceholder && depth === 0){ i++; return; } depth--; }
      if (/[A-Za-z0-9_$]/.test(c)){ word = /[A-Za-z0-9_$]/.test(prev) ? word + c : c; prev = c; }
      else if (!/\s/.test(c)){ prev = c; word = ''; }
      i++;
    }
  }
  code(false);
  return out.sort((a, b) => a.from - b.from).map(({ line, text }) => ({ line, text }));
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
  if (fence) throw new Error('a code fence opens and never closes, so the rest of the document would go unread');
  return out;
}

/* The faults of one piece of text. `sentences` also counts the words of each sentence, which is a
   rule for the game and not for the documents. */
function check(raw, { sentences = false } = {}){
  const out = [];
  /* A curly apostrophe and a hard hyphen are the same words to a reader, so they are made plain. */
  const text = raw.replace(/[‘’]/g, "'").replace(/[‐‑]/g, '-');
  for (const p of RULES.phrases){
    const m = text.match(new RegExp('\\b(?:' + p.re + ')\\b', 'i'));
    if (m) out.push({ rule: 'phrase', match: m[0].toLowerCase(), note: `"${m[0]}": use ${p.alt}` });
  }
  /* An em dash, an en dash with a space on each side, or two hyphens with a space on each side. */
  for (const m of text.matchAll(/—|\s–\s|\s--\s/g)) out.push({ rule: 'em-dash', match: m[0].trim(), note: 'use a full stop or a comma' });
  /* In HTML a tag ends a sentence, or the words of two paragraphs would count as one sentence. */
  if (sentences) for (const s of text.replace(/<[^>]*>/g, '. ').split(/(?<=[.?!])\s+/)){
    const n = s.trim().split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
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
