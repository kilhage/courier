#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Hill-climb scoreboard. Runs every Playwright suite against a build and reports pass counts per group.
//
//   node tools/score.js                              score the ROOT build (no recording)      -> npm run verify
//   node tools/score.js --iter iter-03 ["label"]     score a frozen iteration and record it   -> npm run score -- iter-03
//   node tools/score.js --snapshot iter-05 ["label"] freeze the ROOT build into iterations/iter-05,
//                                                    score the frozen copy and record it      -> npm run snapshot -- iter-05 "label"
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const PORT = process.env.PORT || '4173';
const sbPath = path.join(repo, 'iterations', 'scoreboard.json');
const BUILD_FILES = ['index.html', 'game.js', 'render.js'];

const argv = process.argv.slice(2);
const mode = argv[0] === '--iter' ? 'iter' : argv[0] === '--snapshot' ? 'snapshot' : 'root';
const iter = mode === 'root' ? null : argv[1];
const label = (mode === 'root' ? argv : argv.slice(2)).join(' ');
if (mode !== 'root' && !/^iter-\d+$/.test(iter || '')) { console.error('usage: node tools/score.js [--iter|--snapshot] iter-NN ["label"]'); process.exit(2); }

if (mode === 'snapshot') {
  const dir = path.join(repo, 'iterations', iter);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of BUILD_FILES) fs.copyFileSync(path.join(repo, f), path.join(dir, f));
  console.log(`froze the root build into iterations/${iter}/`);
}

const urlPath = mode === 'root' ? '/index.html' : `/iterations/${iter}/index.html`;
const reportDir = path.join(repo, 'test-results');
fs.mkdirSync(reportDir, { recursive: true });
const r = spawnSync('npx', ['playwright', 'test', '--reporter=json'], {
  cwd: repo, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
  env: Object.assign({}, process.env, { GAME_URL: `http://127.0.0.1:${PORT}${urlPath}`, REPORT_JSON: path.join(reportDir, 'results.json') }),
});
let j;
try { j = JSON.parse(r.stdout); } catch (e) { console.error(r.stdout || r.stderr); console.error('could not parse the Playwright JSON report'); process.exit(1); }

const groups = {}, failing = [];
(function walk(suites, titles) {
  for (const s of suites || []) {
    const t = s.title && !s.title.endsWith('.js') ? [...titles, s.title] : titles;
    for (const sp of s.specs || []) {
      const m = (t[0] || 'misc').match(/^\[([^\]]+)\]/), key = m ? m[1] : (t[0] || 'misc');
      const ok = sp.tests.every((x) => x.results.every((y) => y.status === 'passed'));
      groups[key] = groups[key] || { pass: 0, total: 0 };
      groups[key].total++;
      if (ok) groups[key].pass++; else failing.push(`${key}: ${sp.title}`);
    }
    walk(s.suites, t);
  }
})(j.suites, []);
const pass = Object.values(groups).reduce((a, g) => a + g.pass, 0);
const total = Object.values(groups).reduce((a, g) => a + g.total, 0);

console.log(`\n${iter || 'root build'}  ${pass}/${total}${label ? '  ' + label : ''}`);
for (const [k, g] of Object.entries(groups)) console.log(`  ${k.padEnd(16)} ${g.pass}/${g.total}`);
if (failing.length) { console.log('  failing:'); failing.forEach((f) => console.log('   - ' + f)); }

if (mode !== 'root') {
  const sb = fs.existsSync(sbPath) ? JSON.parse(fs.readFileSync(sbPath, 'utf8')) : [];
  const row = { iter, label, pass, total, groups, failing, url: `/iterations/${iter}/index.html` };
  const next = sb.filter((x) => x.iter !== iter).concat(row).sort((a, b) => a.iter.localeCompare(b.iter));
  fs.writeFileSync(sbPath, JSON.stringify(next, null, 2) + '\n');
  console.log('recorded in iterations/scoreboard.json');
}
process.exit(failing.length ? 1 : 0);
