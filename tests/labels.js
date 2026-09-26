// Text faults found in playtest run 2, day 15. Fast.
// "Logs at last." once per camp; the plurals in the Camp drawer; the valley row; a being's age.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sim = require('../src/sim');
const ui = require('../src/ui');

function loadUI(files, names){
  const api = sim.API.replace('return {', 'return { ' + names.join(', ') + ',');
  return Function(sim.source() + '\n' + ui.source(files) + '\n' + api)();
}
const FILES = ['state', 'icons', 'derive', 'keys', 'marks', 'map', 'dialogs', 'actions'];
const NAMES = ['ageText', 'campValleyRow', 'valleyName', 'gauges'];

/* Fell one pine by hand: the chop's last stroke, as the task's own stop runs it. */
function fell(api, a){
  const tree = api.world.find(t => t.feature === 'tree' && t.fire <= 0);
  assert.ok(tree, 'the valley has a pine to fell');
  const t = { kind: 'cutTree', type: 'work', label: '', args: { tree: [tree.x, tree.y, tree.z || 0] }, progress: api.CLOCK.work.cutTree };
  api.TASKS.cutTree.stops[0](a, t);
  assert.equal(tree.feature, null, 'the pine is down');
}
const atLast = api => api.chronicle.filter(e => / fells a pine\. Logs at last\.$/.test(e.text));

test('"Logs at last." is said for the first pine a camp fells, and not again', () => {
  const api = loadUI(FILES, NAMES);
  api.startWorld('r');
  const a = api.beings.find(b => b.species === 'human');
  const c1 = api.camp;
  assert.equal(c1.hadLogs, false, 'a new camp has felled nothing');
  fell(api, a);
  assert.equal(atLast(api).length, 1, 'the first pine is news');
  assert.equal(c1.hadLogs, true);
  fell(api, a); fell(api, a); fell(api, a);
  assert.equal(atLast(api).length, 1, 'three more pines in a row are not news again');
  /* A second camp has its own first logs. */
  const c2 = api.makeCamp('The second camp');
  api.camp = c2; a.camp = c2;
  fell(api, a);
  assert.equal(atLast(api).length, 2, 'a second camp says it for its own first pine');
  fell(api, a);
  assert.equal(atLast(api).length, 2);
});

test('a being\'s age reads in days, then seasons, then years', () => {
  const api = loadUI(FILES, NAMES);
  assert.deepEqual(api.SEASON_LENGTHS, [91, 91, 91, 92], 'the cases below are written for these season lengths');
  const cases = [
    [0, '0 days'], [0.9, '0 days'], [1, '1 day'], [1.5, '1 day'], [2, '2 days'], [32, '32 days'],
    [90, '90 days'], [91, '1 season'], [92, '1 season'], [181, '1 season'], [182, '2 seasons'], [183, '2 seasons'],
    [272, '2 seasons'], [273, '3 seasons'], [364, '3 seasons'],
    [api.YEAR_DAYS - 1, '3 seasons'], [api.YEAR_DAYS, '1 year'], [2 * api.YEAR_DAYS - 1, '1 year'],
    [2 * api.YEAR_DAYS, '2 years'], [70 * api.YEAR_DAYS + 200, '70 years'],
  ];
  for (const [d, want] of cases) assert.equal(api.ageText(d), want, `${d} days`);
});

test('nOf says one thing once and more than one in the plural', () => {
  const api = loadUI(FILES, NAMES);
  assert.equal(api.nOf(1, 'day', 'days'), '1 day');
  assert.equal(api.nOf(0, 'day', 'days'), '0 days');
  assert.equal(api.nOf(15, 'day', 'days'), '15 days');
});

test('the Camp drawer has no valley row until the valley has a name', () => {
  const api = loadUI(FILES, NAMES);
  api.startWorld('r');
  assert.equal(api.valleyName(), null, 'a new valley has no name');
  assert.equal(api.campValleyRow(), null, 'so the drawer shows no valley row');
  /* An old name nobody has read is not shown either. */
  api.giveName(api.valley, api.nameRecord('Sadrumo', { tongue: 'old', meaning: 'the eye that does not close', by: 'lost' }));
  assert.equal(api.campValleyRow(), null, 'an unread name gives no row');
  api.valley.nameKnown = true;
  assert.deepEqual(api.campValleyRow(), ['Valley', 'Sadrumo'], 'the row shows the name once it is read');
});

/* The drawer and the inspect window call these helpers. A check on the source text, so a later edit
   that puts the bare "days" back is caught without a page to render. */
test('the Camp drawer and the inspect window use the helpers', () => {
  const fs = require('node:fs'), path = require('node:path');
  const panels = fs.readFileSync(path.join(__dirname, '../src/ui/panels.js'), 'utf8');
  const inspect = fs.readFileSync(path.join(__dirname, '../src/ui/inspect.js'), 'utf8');
  assert.ok(!/\$\{c\.age\} days/.test(panels), 'the camp age no longer prints a bare "days"');
  assert.ok(/\['Age', ageText\(c\.age\)\]/.test(panels), 'the camp age uses ageText, so a year-old camp reads "1 year"');
  assert.equal((panels.match(/campValleyRow\(\)/g) || []).length, 1, 'the drawer asks campValleyRow once');
  const dialogs = fs.readFileSync(path.join(__dirname, '../src/ui/dialogs.js'), 'utf8');
  assert.ok(!/describe\(valley, 'valley'\)/.test(dialogs), 'the help page no longer falls back to "the valley"');
  assert.ok(/\$\{valleyName\(\) \? `<li>This valley: \$\{esc\(valleyName\(\)\)\}\.<\/li>` : ''\}/.test(dialogs), 'the help page has a valley line only once the name is known');
  assert.ok(!/describe\(valley, 'valley'\)/.test(panels), 'the valley row no longer falls back to "the valley"');
  assert.ok(/campValleyRow\(\)/.test(panels), 'the valley row reads campValleyRow');
  assert.ok(/ageText\(ageDays\(a\)\)/.test(inspect), 'a being\'s age in the inspect window reads ageText');
  assert.ok(!/Math\.floor\(ageDays\(a\)\)\} days/.test(inspect), 'and not a bare count of days');
});

/* A camp with a lit pit beside its first person, and one sprite, one wolf, and one deer, each one
   tile from the pit. Every other creature of those kinds is dead, so the nearest one is ours. */
function campAtOne(){
  const api = loadUI(FILES, NAMES);
  api.startWorld('r');
  const a = api.beings.find(b => b.species === 'human');
  const pit = [a.x, a.y];
  api.camp.pit = pit; api.camp.site = pit; api.camp.stashTile = pit;
  api.tileAt(pit[0], pit[1], 0).struct = { type: 'firepit', fuel: 200, lit: true };
  api.camp.fae.known = true; api.camp.tools.spear = 1;
  for (const b of api.beings) if (['sprite', 'wolf', 'deer'].includes(b.species)) b.alive = false;
  for (const sp of ['sprite', 'wolf', 'deer']){ const b = api.makeBeing(sp, pit[0] + 1, pit[1], sp, 0); b.z = 0; api.beings.push(b); }
  return api;
}
const goalText = (api, id) => api.goalState(api.GOALS.find(g => g.id === id)).text;

test('goal texts say one stick, one log, and one tile', () => {
  const api = campAtOne();
  api.camp.stash.stick = 1; api.camp.stash.log = 1;
  assert.match(goalText(api, 'fire'), /Woodpile: 1 stick, 1 log\./);
  api.camp.stash.stick = 3; api.camp.stash.log = 2;
  assert.match(goalText(api, 'fire'), /Woodpile: 3 sticks, 2 logs\./);
  assert.match(goalText(api, 'faefight'), /^A sprite is 1 tile from the fire\./);
  assert.match(goalText(api, 'guard'), /^A wolf is 1 tile from the fire\./);
  assert.match(goalText(api, 'deer'), /^Deer within 1 tile\./);
});

test('the hearth gauge says one day of wood', () => {
  const api = campAtOne();
  const p = api.tileAt(api.camp.pit[0], api.camp.pit[1], 0).struct;
  api.camp.stash.stick = 0; api.camp.stash.log = 0;
  p.fuel = 1.5 * api.CLOCK.rate.pitBurn * api.DAY;
  assert.equal(api.gauges().hearth.text, '1 day of wood');
  p.fuel = 2.5 * api.CLOCK.rate.pitBurn * api.DAY;
  assert.equal(api.gauges().hearth.text, '2 days of wood');
});
