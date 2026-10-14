#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Contact sheet of every hero frame (big form on top, small below), 8x scale.
//   node tools/heroSheet.js root | iter-NN
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const target = process.argv[2] || 'root', repo = path.resolve(__dirname, '..'), PORT = process.env.PORT || '4173';
  const url = target === 'root' ? `http://127.0.0.1:${PORT}/index.html` : `http://127.0.0.1:${PORT}/iterations/${target}/index.html`;
  const dir = target === 'root' ? path.join(repo, 'reports', 'shots') : path.join(repo, 'iterations', target, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1300, height: 700 } });
  await page.goto(url); await page.waitForFunction(() => window.__smb3 && window.CourierRender);
  await page.evaluate(() => {
    document.body.innerHTML = ''; const Z = 8, SH = window.CourierRender.SHEET, P = window.CourierRender.HERO_POSES;
    const c = document.createElement('canvas'); c.id = 'sheet'; c.width = P.length * 16 * Z + (P.length + 1) * 10; c.height = (32 + 16) * Z + 3 * 14;
    document.body.style.margin = 0; document.body.appendChild(c);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#58a8ff'; x.fillRect(0, 0, c.width, c.height);
    P.forEach((name, i) => { const ox = 10 + i * (16 * Z + 10); x.drawImage(SH['hero-b'][i].c, ox, 10, 16 * Z, 32 * Z); x.drawImage(SH['hero-s'][i].c, ox, 32 * Z + 24, 16 * Z, 16 * Z); });
  });
  await page.locator('#sheet').screenshot({ path: path.join(dir, 'hero-sheet.png') });
  await b.close(); console.log(`hero sheet written to ${path.relative(repo, dir)}`);
})();
