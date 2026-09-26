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
  const document = { getElementById: id => els[id] || null };
  const timers = [];
  vm.runInNewContext(noticeScript(), { window, document, sessionStorage, setTimeout: fn => timers.push(fn) });
  return { ...els, store, queries, timers };
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

test('Esc closes the notice, remembers it, and leaves the start dialog open', () => {
  const r = run(390);
  const ev = r.narrow.fire('cancel');
  assert.equal(r.narrow.open, false);
  assert.equal(r.store['hearth.narrowSeen'], '1');
  /* WebKit sends the same Esc on to the start dialog. Its cancel must be held, or the start closes too. */
  assert.equal(ev.defaultPrevented, true);
  assert.equal(r.start.fire('cancel').defaultPrevented, true, 'the start dialog would close on the same Esc');
  r.timers.forEach(fn => fn());
  assert.equal(r.start.fire('cancel').defaultPrevented, false, 'the start dialog stays unclosable by Esc after the notice');
});

test('a key pressed on the notice stops there, so Enter does not also make a world', () => {
  const r = run(390);
  assert.equal(r.narrow.fire('keydown', { key: 'Enter' }).stopped, true);
});

test('blocked storage still shows the notice, and the button still closes it', () => {
  const r = run(390, { storage: false });
  assert.equal(r.narrow.shown, 1);
  r.narrowGo.fire('click');
  assert.equal(r.narrow.open, false);
});
