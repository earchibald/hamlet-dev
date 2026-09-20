// A repeatable performance measurement tool for the sim core.
//
// It starts a world the same way the tests do, steps it forward, and times
// the run. It reports the MINIMUM and the MEDIAN across several runs,
// because the machine is often loaded and the minimum is the least
// contaminated reading. Every number comes with the machine and its load
// written beside it, per the proposal's gate.
//
// Usage:
//   node tests/perf/measure.js --seed r --days 10 --sw 10 --sh 6 --runs 3 [--profile]
//   node tests/perf/measure.js --ladder [--days 5] [--runs 2] [--profile]
//
// Run from anywhere; paths below are relative to this file, not to the
// working directory.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const inspector = require('node:inspector/promises');

const { load, FILES } = require('../../src/sim');
const { scriptGod } = require('../lib/run');

const OUT_DIR = path.join(__dirname, 'out');

function parseArgs(argv){
  const args = { seed: 'r', days: 10, runs: 3, profile: false, ladder: false };
  for (let i = 0; i < argv.length; i++){
    const a = argv[i];
    const val = () => argv[++i];
    if (a === '--seed') args.seed = val();
    else if (a === '--days') args.days = Number(val());
    else if (a === '--sw') args.sw = Number(val());
    else if (a === '--sh') args.sh = Number(val());
    else if (a === '--runs') args.runs = Number(val());
    else if (a === '--profile') args.profile = true;
    else if (a === '--ladder') args.ladder = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

function gitCommit(){
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: path.join(__dirname, '..', '..') }).toString().trim(); }
  catch (e){ return '(unknown, ' + e.message + ')'; }
}

function machineInfo(){
  const cpus = os.cpus();
  return {
    cpuModel: cpus[0] ? cpus[0].model : '(unknown)',
    cores: cpus.length,
    nodeVersion: process.version,
    commit: gitCommit(),
    date: new Date().toISOString(),
  };
}

function percentile(sorted, p){
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function stats(sortedUs){
  const n = sortedUs.length;
  let sum = 0; for (let i = 0; i < n; i++) sum += sortedUs[i];
  return {
    meanUs: sum / n,
    p50Us: percentile(sortedUs, 0.50),
    p95Us: percentile(sortedUs, 0.95),
    p99Us: percentile(sortedUs, 0.99),
    maxUs: sortedUs[n - 1],
  };
}

/* One run: start a world the way tests/lib/run.js does (the script god lights
   each camp's pit, so the run leaves a real story, not a silent one), step it
   `days` worth of ticks, and time everything the proposal asks for. */
function runOnce(seed, days, opts){
  const api = load();
  const DAY = api.DAY;
  const t0 = process.hrtime.bigint();
  api.startWorld(seed, opts);
  const creationMs = Number(process.hrtime.bigint() - t0) / 1e6;

  const n = days * DAY;
  const tickUs = new Float64Array(n);
  const runT0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++){
    const s = process.hrtime.bigint();
    api.step();
    scriptGod(api, i);
    const e = process.hrtime.bigint();
    tickUs[i] = Number(e - s) / 1e3;
  }
  const totalMs = Number(process.hrtime.bigint() - runT0) / 1e6;

  const sorted = Array.from(tickUs).sort((a, b) => a - b);
  const tickStats = stats(sorted);

  const snapT0 = process.hrtime.bigint();
  const snap = api.takeSnapshot();
  const takeSnapshotMs = Number(process.hrtime.bigint() - snapT0) / 1e6;
  const strT0 = process.hrtime.bigint();
  const json = JSON.stringify(snap);
  const stringifyMs = Number(process.hrtime.bigint() - strT0) / 1e6;
  const loadedApi = load();
  const loadT0 = process.hrtime.bigint();
  loadedApi.loadSnapshot(JSON.parse(json));
  const loadSnapshotMs = Number(process.hrtime.bigint() - loadT0) / 1e6;

  return {
    creationMs, totalMs, ticksRun: n,
    ...tickStats,
    beingsCount: api.beings.length, itemsCount: api.items.length,
    snapshotBytes: Buffer.byteLength(json),
    takeSnapshotMs, stringifyMs, loadSnapshotMs,
    W: api.W, H: api.H, levels: api.levels.length,
  };
}

/* min and median of a field across a list of run results. */
function aggregateField(runs, field){
  const values = runs.map(r => r[field]).sort((a, b) => a - b);
  const min = values[0];
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return { min, median };
}

const NUMERIC_FIELDS = ['creationMs', 'totalMs', 'meanUs', 'p50Us', 'p95Us', 'p99Us', 'maxUs',
  'beingsCount', 'itemsCount', 'snapshotBytes', 'takeSnapshotMs', 'stringifyMs', 'loadSnapshotMs'];

function aggregate(runs){
  const out = {};
  for (const f of NUMERIC_FIELDS) out[f] = aggregateField(runs, f);
  return out;
}

/* ---------- profiling ---------- */

/* The line ranges of each src/sim/*.js file inside the joined source(), so a
   sample's line number (against the joined script the sim runs as) can be
   named by file. The same idea as the ad-hoc by_file.js used for the first
   profile; see design/perf/2026-09-20-baseline.md. */
function buildFileMap(){
  const simDir = path.join(__dirname, '..', '..', 'src', 'sim');
  let offset = 0;
  const map = [];
  for (const f of FILES){
    const content = fs.readFileSync(path.join(simDir, f + '.js'), 'utf8');
    const lines = content.split('\n').length;
    map.push({ file: f, start: offset + 1, end: offset + lines });
    offset += lines;
  }
  return { map, total: offset };
}

/* line is a 1-based line number in the joined script the sim runs as (all of
   src/sim/*.js concatenated, in FILES order, then the API object literal).
   Returns the file and the LOCAL line inside that file, so the label points
   at a line you can actually open. */
function fileFor(map, total, line){
  for (const m of map) if (line >= m.start && line <= m.end) return { file: m.file + '.js', local: line - m.start + 1 };
  return line > total
    ? { file: 'API (index.js template)', local: line - total }
    : { file: '(before src/sim, native prelude)', local: line };
}

async function captureProfile(seed, days, opts){
  const session = new inspector.Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.setSamplingInterval', { interval: 100 });
  await session.post('Profiler.start');
  runOnce(seed, days, opts);
  const { profile } = await session.post('Profiler.stop');
  session.disconnect();
  return profile;
}

function analyzeProfile(profile){
  const { map, total } = buildFileMap();
  const nodes = profile.nodes;
  const samples = profile.samples, timeDeltas = profile.timeDeltas;
  const selfTime = new Map();
  let totalUs = 0;
  for (let i = 0; i < samples.length; i++){
    const dt = timeDeltas[i] || 0;
    selfTime.set(samples[i], (selfTime.get(samples[i]) || 0) + dt);
    totalUs += dt;
  }
  const childrenOf = new Map();
  for (const n of nodes) if (n.children) for (const c of n.children){
    if (!childrenOf.has(n.id)) childrenOf.set(n.id, []);
    childrenOf.get(n.id).push(c);
  }
  const totalTimeCache = new Map();
  function inclusiveTime(id){
    if (totalTimeCache.has(id)) return totalTimeCache.get(id);
    let t = selfTime.get(id) || 0;
    for (const c of (childrenOf.get(id) || [])) t += inclusiveTime(c);
    totalTimeCache.set(id, t);
    return t;
  }
  for (const n of nodes) inclusiveTime(n.id);

  function label(n){
    const cf = n.callFrame;
    const name = cf.functionName || '(anonymous)';
    if (cf.url){
      const base = cf.url.replace(/^.*\//, '') || '(native)';
      return `${name} [${base}:${cf.lineNumber + 1}]`;
    }
    const { file, local } = fileFor(map, total, cf.lineNumber + 1);
    return `${name} [${file}:${local}]`;
  }

  const aggSelf = new Map(), aggIncl = new Map();
  for (const n of nodes){
    const key = label(n);
    const s = selfTime.get(n.id) || 0;
    aggSelf.set(key, (aggSelf.get(key) || 0) + s);
    const t = inclusiveTime(n.id);
    if (!aggIncl.has(key)) aggIncl.set(key, 0);
    aggIncl.set(key, Math.max(aggIncl.get(key), t)); // a recursive function's inclusive time is not additive across its own frames
  }
  const selfList = Array.from(aggSelf.entries()).map(([key, self]) => ({ key, self, pct: 100 * self / totalUs })).sort((a, b) => b.self - a.self);
  const inclList = Array.from(aggIncl.entries()).map(([key, total]) => ({ key, total, pct: 100 * total / totalUs })).sort((a, b) => b.total - a.total);
  return { totalUs, selfTop: selfList.slice(0, 25), inclTop: inclList.slice(0, 15) };
}

function printProfile(analysis, title){
  console.log(`\n-- ${title}: CPU profile (${(analysis.totalUs / 1000).toFixed(1)} ms sampled) --`);
  console.log('\nTop 25 by SELF time:');
  for (const s of analysis.selfTop) console.log(`  ${(s.self / 1000).toFixed(2)}ms\t${s.pct.toFixed(2)}%\t${s.key}`);
  console.log('\nTop 15 by INCLUSIVE time:');
  for (const s of analysis.inclTop) console.log(`  ${(s.total / 1000).toFixed(2)}ms\t${s.pct.toFixed(2)}%\t${s.key}`);
}

/* ---------- reporting ---------- */

function fmt(n, d = 3){ return Number(n).toFixed(d); }

function printTable(label, agg){
  console.log(`\n== ${label} ==`);
  console.log('field'.padEnd(16), 'min'.padStart(12), 'median'.padStart(12));
  const rows = [
    ['totalMs', 3], ['creationMs', 3], ['meanUs', 3], ['p50Us', 3], ['p95Us', 3], ['p99Us', 3], ['maxUs', 3],
    ['beingsCount', 0], ['itemsCount', 0], ['snapshotBytes', 0],
    ['takeSnapshotMs', 3], ['stringifyMs', 3], ['loadSnapshotMs', 3],
  ];
  for (const [f, d] of rows) console.log(f.padEnd(16), fmt(agg[f].min, d).padStart(12), fmt(agg[f].median, d).padStart(12));
}

async function measureOne(seed, days, opts, runs, profile, label){
  const results = [];
  for (let i = 0; i < runs; i++) results.push(runOnce(seed, days, opts));
  const agg = aggregate(results);
  const last = results[results.length - 1];
  printTable(label, agg);
  console.log(`W=${last.W} H=${last.H} levels=${last.levels} tiles=${last.W * last.H * last.levels}`);
  let profileAnalysis = null;
  if (profile){
    const p = await captureProfile(seed, days, opts);
    profileAnalysis = analyzeProfile(p);
    printProfile(profileAnalysis, label);
  }
  return { label, opts, days, runs: results, agg, size: { W: last.W, H: last.H, levels: last.levels }, profile: profileAnalysis };
}

async function main(){
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const info = machineInfo();
  const loadBefore = os.loadavg();
  console.log('== machine ==');
  console.log('cpu:', info.cpuModel, `(${info.cores} cores)`);
  console.log('node:', info.nodeVersion, 'commit:', info.commit, 'date:', info.date);
  console.log('loadavg before (1,5,15 min):', loadBefore.map(n => n.toFixed(2)).join(', '));

  const out = { info, loadBefore, args };

  if (args.ladder){
    const sizes = [
      { label: '1x (default)', sw: undefined, sh: undefined },
      { label: '4x area', sw: 20, sh: 12 },
      { label: '9x area', sw: 30, sh: 18 },
    ];
    out.ladder = [];
    for (const sz of sizes){
      const opts = {};
      if (sz.sw) opts.sw = sz.sw;
      if (sz.sh) opts.sh = sz.sh;
      const r = await measureOne(args.seed, args.days, opts, args.runs, args.profile, sz.label);
      out.ladder.push(r);
    }
    console.log('\n== ladder summary: median µs/tick, top 5 self ==');
    for (const r of out.ladder){
      console.log(`\n${r.label} (${r.size.W}x${r.size.H}x${r.size.levels}): median meanUs/tick = ${fmt(r.agg.meanUs.median)}`);
      if (r.profile) for (const s of r.profile.selfTop.slice(0, 5)) console.log(`  ${s.pct.toFixed(2)}%\t${s.key}`);
    }
  } else {
    const opts = {};
    if (args.sw) opts.sw = args.sw;
    if (args.sh) opts.sh = args.sh;
    out.single = await measureOne(args.seed, args.days, opts, args.runs, args.profile, `seed ${args.seed}, ${args.days} days`);
  }

  const loadAfter = os.loadavg();
  out.loadAfter = loadAfter;
  console.log('\nloadavg after (1,5,15 min):', loadAfter.map(n => n.toFixed(2)).join(', '));

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(OUT_DIR, `measure-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log('\nwrote', outFile);
}

main().catch(e => { console.error(e); process.exit(1); });
