#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Screenshots along a route that a lookahead planner finds through the course.
//   node tools/shots.js root        -> reports/shots/*.png  (the root build)
//   node tools/shots.js iter-03     -> iterations/iter-03/shots/*.png
// Requires the server to be running (`npm start`) and Chromium (`npm run install:browsers`).
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const target = process.argv[2] || 'root', repo = path.resolve(__dirname, '..'), PORT = process.env.PORT || '4173';
  const url = target === 'root' ? `http://127.0.0.1:${PORT}/index.html` : `http://127.0.0.1:${PORT}/iterations/${target}/index.html`;
  const dir = target === 'root' ? path.join(repo, 'reports', 'shots') : path.join(repo, 'iterations', target, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 820, height: 900 } });
  await page.goto(url); await page.waitForFunction(() => window.__smb3);
  await page.evaluate(() => { window.__smb3.reset({ scenario: 'course-1-1' }); window.__smb3.frame({}); });
  await page.locator('#screen').screenshot({ path: path.join(dir, '1-start.png') });

  const ACTS = [{ right: true, B: true }, { right: true, B: true, A: true }, { right: true, A: true }, { right: true }, {}, { left: true }, { right: true, B: true, A: true, _short: 3 }];
  const route = await page.evaluate((ACTS) => {
    const g = window.__smb3;
    const inputsFor = (act) => { const o = []; for (let f = 0; f < 10; f++) { const a = Object.assign({}, act); delete a._short; o.push(act._short && f >= act._short ? { right: true, B: true } : a); } return o; };
    g.reset({ scenario: 'course-1-1' });
    let beam = [{ snap: g.snap(), x: 0, path: [] }], win = null;
    for (let step = 0; step < 520 && !win; step++) {
      const next = [], seen = new Set();
      for (const n of beam) for (let ai = 0; ai < ACTS.length; ai++) {
        g.restore(n.snap); const s = g.advance(10, inputsFor(ACTS[ai]));
        if (s.player.dead) continue;
        if (s.cleared) { win = n.path.concat(ai); break; }
        const key = [Math.floor(s.player.x / 3), Math.round(s.player.vx / 6), s.player.onGround ? 1 : 0, Math.round(s.player.feetY / 8), s.player.powerup, s.entities.filter((e) => e.state !== 'gone').length].join(':');
        if (seen.has(key)) continue; seen.add(key); next.push({ snap: g.snap(), x: s.player.x, path: n.path.concat(ai) });
      }
      if (win || !next.length) break;
      next.sort((a, b) => b.x - a.x); beam = next.slice(0, 48);
    }
    return win;
  }, ACTS);
  if (!route) { console.error('planner found no route: the course may be uncompletable'); await b.close(); process.exit(1); }
  fs.writeFileSync(path.join(dir, 'winning-path.json'), JSON.stringify(route));

  const marks = [[400, '2-early'], [800, '3-mid'], [1250, '4-ledge'], [1550, '5-hoppers'], [1900, '6-late']]; let mi = 0;
  await page.evaluate(() => window.__smb3.reset({ scenario: 'course-1-1' }));
  for (const ai of route) {
    const st = await page.evaluate((ai) => {
      const ACTS = [{ right: true, B: true }, { right: true, B: true, A: true }, { right: true, A: true }, { right: true }, {}, { left: true }, { right: true, B: true, A: true, _short: 3 }];
      const act = ACTS[ai], inp = []; for (let f = 0; f < 10; f++) { const a = Object.assign({}, act); delete a._short; inp.push(act._short && f >= act._short ? { right: true, B: true } : a); }
      const s = window.__smb3.advance(10, inp); window.__smb3.frame({}); return { x: s.player.x, cleared: s.cleared };
    }, ai);
    if (mi < marks.length && st.x >= marks[mi][0]) { await page.locator('#screen').screenshot({ path: path.join(dir, marks[mi][1] + '.png') }); mi++; }
    if (st.cleared) {
      await page.evaluate(() => { window.__smb3.advance(70, {}); window.__smb3.frame({}); });
      await page.locator('#screen').screenshot({ path: path.join(dir, '7-goal.png') });
      break;
    }
  }
  await b.close(); console.log(`screenshots written to ${path.relative(repo, dir)}`);
})();
