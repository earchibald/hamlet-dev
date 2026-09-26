// The narrow-screen notice (review P3). Phones are not supported for now, so a phone held upright sees a
// short notice over the start dialog, and a tablet or a desktop window sees nothing. Fast, no DOM: the
// notice's script is read from the page template and run against a fake window and document.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'page.template.html'), 'utf8');

/* The notice's own script: the one that opens #narrow. Every other script in the template is the
   __SIM__ and __UI__ placeholder, so a match on the dialog's id picks exactly one block. */
function noticeScript(){
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.includes("getElementById('narrow')"));
  assert.equal(blocks.length, 1, `expected one script that opens #narrow, found ${blocks.length}`);
  return blocks[0];
}

/* A fake element with listeners that a test can fire. */
function element(id){
  const on = {};
  return {
    id, open: false, shown: 0, closed: 0,
    addEventListener(type, fn, opts){ (on[type] = on[type] || []).push({ fn, once: opts && opts.once }); },
    removeEventListener(type, fn){ on[type] = (on[type] || []).filter(l => l.fn !== fn); },
    fire(type, ev = {}){
      ev.defaultPrevented = false; ev.stopped = false;
      ev.preventDefault = () => { ev.defaultPrevented = true; };
      ev.stopPropagation = () => { ev.stopped = true; };
      for (const l of [...(on[type] || [])]){ l.fn(ev); if (l.once) this.removeEventListener(type, l.fn); }
      return ev;
    },
    showModal(){ this.open = true; this.shown++; },
    close(){ this.open = false; this.closed++; }
  };
}

/* Run the script at a viewport width. matchMedia reads the max-width out of the script's own query, so
   the test checks what the query means at each width, not only its text. */
function run(width, { stored = null, storage = true } = {}){
  const els = { narrow: element('narrow'), narrowGo: element('narrowGo'), start: element('start') };
  const doc = element('document');
  const store = {}; if (stored) store['hearth.narrowSeen'] = stored;
  const sessionStorage = {
    getItem(k){ if (!storage) throw new Error('blocked'); return k in store ? store[k] : null; },
    setItem(k, v){ if (!storage) throw new Error('blocked'); store[k] = String(v); }
  };
  const queries = [];
  const window = {
    matchMedia(q){
      queries.push(q);
      const m = q.match(/^\(max-width: (\d+)px\)$/);
      assert.ok(m, `the notice asks an unexpected media query: ${q}`);
      return { matches: width <= Number(m[1]) };
    }
  };
  const document = { getElementById: id => els[id] || null, addEventListener: doc.addEventListener.bind(doc), removeEventListener: doc.removeEventListener.bind(doc) };
  vm.runInNewContext(noticeScript(), { window, document, sessionStorage });
  return { ...els, doc, store, queries };
}

test('the page carries the notice dialog, its text, and a button that prints its key', () => {
  assert.match(html, /<dialog id="narrow"[^>]*>/);
  assert.match(html, /This screen is narrow/);
  assert.match(html, /<button class="btn" type="button" id="narrowGo">Go on anyway<kbd>Esc<\/kbd><\/button>/);
});

test('a phone held upright sees the notice', () => {
  for (const w of [320, 360, 390, 414, 430, 440]){
    const r = run(w);
    assert.equal(r.narrow.shown, 1, `no notice at ${w} px`);
  }
});

test('a tablet and a desktop window see no notice', () => {
  for (const w of [540, 600, 768, 820, 1024, 1440, 1920]){
    const r = run(w);
    assert.equal(r.narrow.shown, 0, `a notice at ${w} px`);
  }
});

test('the threshold is 540 CSS pixels: 539 sees the notice, 540 does not', () => {
  assert.equal(run(539).narrow.shown, 1);
  assert.equal(run(540).narrow.shown, 0);
  assert.deepEqual(run(390).queries, ['(max-width: 539px)']);
});

test('Go on anyway closes the notice and remembers it for the session', () => {
  const r = run(390);
  r.narrowGo.fire('click');
  assert.equal(r.narrow.open, false);
  assert.equal(r.store['hearth.narrowSeen'], '1');
  assert.equal(run(390, { stored: '1' }).narrow.shown, 0, 'the notice came back in the same session');
});

test('Esc closes the notice and remembers it', () => {
  const r = run(390);
  const ev = r.narrow.fire('cancel');
  /* The cancel is prevented and the notice closes itself. The prevented cancel is also what keeps
     WebKit from closing the start dialog on the same Esc; that half is checked in the browser. */
  assert.equal(ev.defaultPrevented, true);
  assert.equal(r.narrow.open, false);
  assert.equal(r.store['hearth.narrowSeen'], '1');
});

/* The key is fired at the document with a target outside the notice: after Tab, focus leaves the notice
   for the body, and a listener on the notice itself never hears the key. */
test('while the notice is open, a key aimed anywhere stops at the document, and keeps its default', () => {
  const r = run(390);
  const body = { id: 'body' };
  for (const k of [{ key: 'Enter' }, { key: 'Escape' }, { key: 'g', altKey: true }]){
    const ev = r.doc.fire('keydown', { ...k, target: body });
    assert.equal(ev.stopped, true, `${k.key} reached the page's key handler while the notice was open`);
    assert.equal(ev.defaultPrevented, false, `${k.key} lost its default, so the notice's button or Esc would not work`);
  }
});

test('once the notice is closed, keys reach the page again', () => {
  const r = run(390);
  r.narrowGo.fire('click');
  assert.equal(r.doc.fire('keydown', { key: 'Enter', target: { id: 'seed' } }).stopped, false);
});

test('blocked storage still shows the notice, and the button still closes it', () => {
  const r = run(390, { storage: false });
  assert.equal(r.narrow.shown, 1);
  r.narrowGo.fire('click');
  assert.equal(r.narrow.open, false);
});
