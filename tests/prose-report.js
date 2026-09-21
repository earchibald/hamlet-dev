/* The prose report: `npm run prose`.

   It is a report for the review panel, and not a gate. In the game's text we give a fire or a river
   an act on purpose. One approved line is "the Night the Fire Ran". The judge marks those lines too.

   It puts the pattern questions of the prose-lint tool to every string in the source and to every
   line of four creations. The judge is Jev, a model from TypeSafe, and the report prints what it
   marks. The report needs the tool, its key, and the network. A line that matches
   `design/approved-text.md` is printed with the word approved, because that text is used as written. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { literals, rendered, ROOT } = require('./lib/prose');

const TOOL = process.env.PROSE_LINT || [path.join(os.homedir(), 'Code/prose-lint'), path.join(os.homedir(), 'Workshop/001-prose-lint')].find(d => fs.existsSync(path.join(d, 'rules.json')));
if (!TOOL){ console.error('The prose-lint tool is not on this machine. Set PROSE_LINT to its folder.'); process.exit(2); }
const { lint } = require(path.join(TOOL, 'lib/lint'));
const { key, CACHE } = require(path.join(TOOL, 'lib/hookutil'));
const rules = JSON.parse(fs.readFileSync(path.join(TOOL, 'rules.json'), 'utf8'));
const SHOW = Number(process.env.SHOW || 12);

(async () => {
  if (!key()){ console.error('No key for the judge. Put TYPESAFE_API_KEY in ~/.config/prose-lint/env.'); process.exit(2); }
  const approved = fs.readFileSync(path.join(ROOT, 'design/approved-text.md'), 'utf8');
  /* A line is approved when the approved text holds it, with any words in the place of each X. */
  const isApproved = text => {
    const parts = text.split(/\bX\b/).map(s => s.trim()).filter(s => s.length > 3).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return parts.length > 0 && new RegExp(parts.join('.{0,60}?')).test(approved);
  };
  const texts = new Map();
  for (const dir of ['src/sim', 'src/ui']) for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.js') && f !== 'index.js').sort())
    for (const l of literals(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'))){
      /* The judge reads sentences, so a key or a label of fewer than four words is left out. A tag is not text. */
      const text = l.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.split(' ').length >= 4 && !texts.has(text)) texts.set(text, `${dir}/${f}:${l.line}`);
    }
  const fromSource = texts.size;
  for (const line of rendered(['r', 'x', 'gamma', 'sweep23'])) if (!texts.has(line)) texts.set(line, 'a creation');
  /* All the texts go to the tool as one document, with a blank line between them. So text number i
     starts on line 2i + 1, and the line of a finding tells which text it came from. */
  const list = [...texts.keys()];
  const r = await lint(list.map(t => t.replace(/\n/g, ' ')).join('\n\n'), { rules, jev: true, key: key(), cacheFile: CACHE });
  if (r.jev !== 'ran'){ console.error('The judge did not run: ' + r.jev); process.exit(2); }
  const by = {};
  for (const f of r.findings.filter(f => f.kind === 'judge')){
    const text = list[(f.line - 1) / 2];
    (by[f.rule] = by[f.rule] || []).push({ score: f.score, text, where: texts.get(text), approved: isApproved(text) });
  }
  console.log(`${fromSource} strings from the source and ${list.length - fromSource} creation lines. ${r.tokens} new tokens, $${(r.tokens * 42e-9).toFixed(4)}.`);
  console.log('This is a report for the review panel. It is not a gate. No score here is calibrated.\n');
  for (const [rule, fs_] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)){
    console.log(`${rule}: ${fs_.length}   (${rules.questions[rule].fix})`);
    for (const f of fs_.sort((a, b) => b.score - a.score).slice(0, SHOW)) console.log(`  ${f.score.toFixed(2)}  ${f.where}${f.approved ? '  approved' : ''}\n        ${f.text.slice(0, 170)}`);
    if (fs_.length > SHOW) console.log(`  and ${fs_.length - SHOW} more. Set SHOW=${fs_.length} to see them.`);
    console.log('');
  }
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(2); });
