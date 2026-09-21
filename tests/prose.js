/* The prose gate.

   This gate reads the text a player sees, and three documents: `CLAUDE.md`, `README.md`, and
   `design/notes.md`. It allows no banned phrase and no em dash. In the game's text it also allows
   no sentence over 25 words. The rules are data, in `tests/lib/prose-rules.json`. This gate needs no
   network and no outside tool, so it runs in CI.

   The gate reads exact phrases and counted rules only. A pattern with no fixed words, such as a maxim
   or a staged reveal, needs a judge model. `npm run prose` asks one, and its header says why that
   report is not a gate. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { literals, docLines, check, rendered, RULES, ROOT } = require('./lib/prose');

const rulesOf = fs => fs.map(f => f.rule);

test('a literal is read with the line it starts on, and a placeholder becomes X', () => {
  const src = "const a = 1;\nconst b = `${h.name} lights the first fire of the camp.`;\n";
  assert.deepEqual(literals(src), [{ line: 2, text: 'X lights the first fire of the camp.' }]);
});

test('a string inside a comment is not read', () => {
  const src = "/* 'this one is in a block comment' */\n// 'this one is in a line comment'\nconst c = 'This one is in the code itself.';\n";
  assert.deepEqual(literals(src).map(l => l.text), ['This one is in the code itself.']);
});

test('a quote of the other kind inside a string does not end it', () => {
  assert.deepEqual(literals("const c = \"They say 'it is cold' all night long.\";").map(l => l.text), ["They say 'it is cold' all night long."]);
});

/* Each case below is an input that the first extractor got wrong. The branch review found them. */
const texts = src => literals(src).map(l => l.text);

test('a string inside a placeholder is read, and a template of placeholders alone is not', () => {
  const src = "const a = `${r.name}${r.failed ? ' — the ground refused it' : r.taken ? ' — taken' : ''}`;";
  assert.deepEqual(texts(src), ['— the ground refused it', '— taken']);
});

test('a template inside a template is read, and the outer one closes where it should', () => {
  const src = "const a = `The ${x ? `big ${y} one` : 'small'} fire ran all night.`; const b = 'The next one is whole.';";
  assert.deepEqual(texts(src), ['The X fire ran all night.', 'big X one', 'small', 'The next one is whole.']);
});

test('a string with a semicolon or an HTML tag in it is read', () => {
  assert.deepEqual(texts("const a = 'The fire ran; nobody slept that night.';"), ['The fire ran; nobody slept that night.']);
  assert.deepEqual(texts("const h = '<p class=\"muted\">Nobody has found the old marks yet.</p>';"), ['<p class="muted">Nobody has found the old marks yet.</p>']);
});

test('a slash and a star inside a line comment or a string do not open a block comment', () => {
  const src = "// globs like src/*.js\nconst a = 'This line is after the glob.';\n/* end */\nconst g = 'src/*.js';\nconst b = 'Another line of text.';\n";
  assert.deepEqual(texts(src), ['This line is after the glob.', 'src/*.js', 'Another line of text.']);
});

test('a quote inside a regex literal does not open a string, and a division is not a regex', () => {
  assert.deepEqual(texts("const r = /['\"]/; const a = 'This is after the regex.';"), ['This is after the regex.']);
  assert.deepEqual(texts("const n = a / b; const s = 'so / this' + c / d;"), ['so / this']);
});

test('a comment that touches a quote is still a comment, and two slashes inside a string are text', () => {
  assert.deepEqual(texts("const a = 'abc'// 'a hidden comment string of words'\nconst u = 'see http://x.y/z for it';"), ['abc', 'see http://x.y/z for it']);
  assert.deepEqual(texts("const a = `go to // the far side of the hill`;"), ['go to // the far side of the hill']);
});

test('a short string is read too, because an em dash needs only one word beside it', () => {
  assert.deepEqual(texts("const a = ' — taken';"), ['— taken']);
});

test('check reports each em dash, and two hyphens between clauses', () => {
  assert.equal(check('A — b — c.').length, 2);
  assert.deepEqual(rulesOf(check('The fire ran -- nobody slept.')), ['em-dash']);
  assert.deepEqual(rulesOf(check('Run it with --no-jev today.')), []);
});

test('a curly apostrophe or a hard hyphen does not hide a phrase', () => {
  assert.deepEqual(rulesOf(check('Let’s break this down.')), ['phrase']);
  assert.deepEqual(rulesOf(check('A load‑bearing wall.')), ['phrase']);
});

test('in HTML, a tag ends a sentence, so the words of two paragraphs are not counted as one', () => {
  const twelve = 'one two three four five six seven eight nine ten eleven twelve';
  assert.deepEqual(rulesOf(check(`<p>${twelve}</p><p>${twelve}</p><p>${twelve}</p>`, { sentences: true })), []);
});

test('a code fence that never closes is an error, because it would hide the rest of the document', () => {
  assert.throws(() => docLines('One.\n```js\nThree is load-bearing.\n'), /fence/);
});

test('a literal with no word in it is not read', () => {
  assert.deepEqual(texts("const k = 'a b c d'; const sel = '#x > .y + .z ~ .w'; const n = '12 / 7';"), []);
});

test('check finds a banned phrase, whatever its case', () => {
  assert.deepEqual(rulesOf(check('The old wall is Load-Bearing.')), ['phrase']);
  assert.equal(check('The old wall is Load-Bearing.')[0].match, 'load-bearing');
});

test('check finds an em dash', () => {
  assert.deepEqual(rulesOf(check('The fire ran — nobody slept.')), ['em-dash']);
});

test('check finds an en dash with a space on each side, and leaves a range of numbers alone', () => {
  assert.deepEqual(rulesOf(check('The fire ran – nobody slept.')), ['em-dash']);
  assert.deepEqual(rulesOf(check('Days 3–5 were cold.')), [], 'a range is not a dash between clauses');
});

test('check counts the words of each sentence, and only when asked', () => {
  const long = Array.from({ length: RULES.sentenceWords + 1 }, (_, i) => 'w' + i).join(' ') + '.';
  assert.deepEqual(rulesOf(check('Short one. ' + long, { sentences: true })), ['long-sentence']);
  assert.deepEqual(rulesOf(check(long)), []);
  const atLimit = Array.from({ length: RULES.sentenceWords }, (_, i) => 'w' + i).join(' ') + '.';
  assert.deepEqual(rulesOf(check(atLimit, { sentences: true })), []);
});

test('every phrase in the rule file matches its own example', () => {
  assert.ok(RULES.phrases.length >= 15, `only ${RULES.phrases.length} phrases were read`);
  for (const p of RULES.phrases) assert.deepEqual(rulesOf(check(p.example)), ['phrase'], p.example);
});

test('a document line inside a code fence or inline code is not read', () => {
  const md = 'Plain line here.\n```\nload-bearing in a fence\n```\nThe flag `load-bearing` is code.\nThis one is load-bearing prose.\n';
  const hits = docLines(md).flatMap(l => check(l.text).map(f => l.line));
  assert.deepEqual(hits, [6]);
});

/* Each `index.js` is a manifest, and its strings are code, not text, so both are left out. Each
   folder has a floor on the number of literals read. If the loop over a folder found none, the test
   would pass for any text in it. On 2026-09-20 `src/sim` gave 3,942 and `src/ui` gave 1,779. */
const FOLDERS = { 'src/sim': 3000, 'src/ui': 1200 };
function sourceLiterals(dir){
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.js') && f !== 'index.js').sort())
    for (const l of literals(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'))) out.push({ file: `${dir}/${f}`, ...l });
  return out;
}

/* A fault that was in the game's text before this gate is recorded here by file, by rule, and by
   number. The number may fall and may not rise. `src/ui/panels.js` writes " — the ground refused it"
   and " — taken" after the name of a mark. A change to that text goes through the review panel. */
const KNOWN_SOURCE = { 'src/ui/panels.js': { 'em-dash': 2 } };

for (const [dir, floor] of Object.entries(FOLDERS)){
  test(`no string in ${dir} holds a banned phrase, a new em dash, or a sentence over the limit`, () => {
    const lits = sourceLiterals(dir);
    assert.ok(lits.length > floor, `only ${lits.length} literals were read in ${dir}, and the floor is ${floor}`);
    const found = lits.flatMap(l => check(l.text, { sentences: true }).map(f => ({ ...f, file: l.file, line: l.line, text: l.text })));
    const show = fs_ => fs_.map(f => `${f.file}:${f.line}  ${f.rule}  ${f.note}\n      ${f.text.slice(0, 160)}`).join('\n');
    const keyOf = f => `${f.file} ${f.rule}`, counts = {};
    for (const f of found) counts[keyOf(f)] = (counts[keyOf(f)] || 0) + 1;
    const known = Object.entries(KNOWN_SOURCE).filter(([file]) => file.startsWith(dir + '/')).flatMap(([file, rules]) => Object.entries(rules).map(([rule, n]) => [`${file} ${rule}`, n]));
    for (const [k, n] of Object.entries(counts)){
      const allowed = (known.find(([kk]) => kk === k) || [k, 0])[1];
      assert.ok(n <= allowed, `${k}: ${n} found and ${allowed} known\n${show(found.filter(f => keyOf(f) === k))}\n`);
    }
    for (const [k, n] of known) assert.equal(counts[k] || 0, n, `${k} is down to ${counts[k] || 0}. Lower the known number from ${n} in tests/prose.js.`);
  });
}

test('no line of a creation holds a banned phrase, an em dash, or a sentence over the limit', () => {
  const lines = rendered(['r', 'x', 'gamma', 'sweep23']);
  assert.ok(lines.length > 150, `only ${lines.length} creation lines were collected`);
  const bad = lines.flatMap(text => check(text, { sentences: true }).map(f => `${f.rule}  ${f.note}\n      ${text.slice(0, 200)}`));
  assert.deepEqual(bad, [], `\n${bad.join('\n')}\n`);
});

/* A document written before this gate has faults already, and the number of them is recorded here.
   The number may fall and may not rise. When it falls, lower it here. If you leave it high, a new
   fault can enter and the test will still pass. */
const DOCS = { 'CLAUDE.md': {}, 'README.md': {}, 'design/notes.md': { 'em-dash': 10 } };
for (const [doc, known] of Object.entries(DOCS)){
  test(`${doc} holds no banned phrase and no new em dash`, () => {
    const lines = docLines(fs.readFileSync(path.join(ROOT, doc), 'utf8'));
    assert.ok(lines.length > 5, `only ${lines.length} lines of ${doc} were read`);
    const found = lines.flatMap(l => check(l.text).map(f => ({ ...f, line: l.line, text: l.text })));
    for (const rule of ['phrase', 'em-dash']){
      const hits = found.filter(f => f.rule === rule), allowed = known[rule] || 0;
      const list = hits.map(f => `${doc}:${f.line}  ${f.note}\n      ${f.text.slice(0, 160)}`).join('\n');
      assert.ok(hits.length <= allowed, `${doc} has ${hits.length} of ${rule} and ${allowed} are known:\n${list}\n`);
      assert.ok(hits.length >= allowed, `${doc} is down to ${hits.length} of ${rule}. Lower the known count from ${allowed} in tests/prose.js.`);
    }
  });
}

/* The phrase list is a copy of the one in the prose-lint tool. The Claude Code hooks of that tool
   check what a session writes. On a machine that has the tool, the two lists must match. CI has no
   tool, so this test skips there. */
const TOOL = process.env.PROSE_LINT || [path.join(os.homedir(), 'Code/prose-lint'), path.join(os.homedir(), 'Workshop/001-prose-lint')].find(d => fs.existsSync(path.join(d, 'rules.json')));
test('the phrase list matches the list in the prose-lint tool', { skip: TOOL ? false : 'the prose-lint tool is not on this machine, so the two phrase lists are not compared' }, () => {
  const theirs = JSON.parse(fs.readFileSync(path.join(TOOL, 'rules.json'), 'utf8')).phrases.map(p => p.re).sort();
  const ours = RULES.phrases.map(p => p.re).sort();
  assert.deepEqual(ours, theirs, `copy the phrases from ${TOOL}/rules.json into tests/lib/prose-rules.json`);
});
