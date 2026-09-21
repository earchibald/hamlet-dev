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

test('a literal of four words or more is read, with its line, and a placeholder becomes X', () => {
  const src = "const a = 'too short';\nconst b = `${h.name} lights the first fire of the camp.`;\n";
  assert.deepEqual(literals(src), [{ line: 2, text: 'X lights the first fire of the camp.' }]);
});

test('a string inside a comment is not read', () => {
  const src = "/* 'this one is in a block comment' */\n// 'this one is in a line comment'\nconst c = 'This one is in the code itself.';\n";
  assert.deepEqual(literals(src).map(l => l.text), ['This one is in the code itself.']);
});

test('a quote of the other kind inside a string does not end it', () => {
  assert.deepEqual(literals("const c = \"They say 'it is cold' all night long.\";").map(l => l.text), ["They say 'it is cold' all night long."]);
});

test('a literal with no words in it is not read', () => {
  assert.deepEqual(literals("const k = 'a b c d'; const sel = '#x > .y + .z ~ .w';"), []);
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

/* Each `index.js` is a manifest, and its strings are code, not text, so both are left out. The test
   below also counts the literals. If the loop over the source files found none, the test would pass
   for any text, and the count is what stops that. */
const SKIP_FILES = new Set(['src/sim/index.js', 'src/ui/index.js']);
function sourceLiterals(){
  const out = [];
  for (const dir of ['src/sim', 'src/ui']) for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.js')).sort()){
    const rel = `${dir}/${f}`;
    if (SKIP_FILES.has(rel)) continue;
    for (const l of literals(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) out.push({ file: rel, ...l });
  }
  return out;
}

test('no string in the source holds a banned phrase, an em dash, or a sentence over the limit', () => {
  const lits = sourceLiterals();
  assert.ok(lits.length > 700, `only ${lits.length} literals were read, so the walk has lost the source`);
  const bad = lits.flatMap(l => check(l.text, { sentences: true }).map(f => `${l.file}:${l.line}  ${f.rule}  ${f.note}\n      ${l.text.slice(0, 160)}`));
  assert.deepEqual(bad, [], `\n${bad.join('\n')}\n`);
});

test('no line of a creation holds a banned phrase, an em dash, or a sentence over the limit', () => {
  const lines = rendered(['r', 'x', 'gamma', 'sweep23']);
  assert.ok(lines.length > 150, `only ${lines.length} creation lines were collected`);
  const bad = lines.flatMap(text => check(text, { sentences: true }).map(f => `${f.rule}  ${f.note}\n      ${text.slice(0, 200)}`));
  assert.deepEqual(bad, [], `\n${bad.join('\n')}\n`);
});

/* A document written before this gate has faults already, and the number of them is recorded here.
   The number may fall and may not rise. When it falls, lower it here. If you leave it high, a new
   fault can enter and the test will still pass. */
const DOCS = { 'CLAUDE.md': {}, 'README.md': {}, 'design/notes.md': { 'em-dash': 7 } };
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
