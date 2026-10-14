// SPDX-License-Identifier: MIT
// Visual verification: reads real canvas pixels through window.__smb3.frame()/sprites().
// Goal: measurable "NES-likeness" (palette budget, hard edges, 16px grid) plus sprite/hitbox/animation contracts.
// No reference images of the original game are used; every rule is a numeric constraint.
const { test, expect } = require('@playwright/test');
const { openGame, run } = require('./lib/hook');

const NONE = {}, R = { right: true }, RB = { right: true, B: true }, L = { left: true };
const mini = (rows, w = 40) => [...rows.map((s) => s.padEnd(w, '.')), '#'.repeat(w), '#'.repeat(w)];

// helpers executed inside the page
const PAGE = `
  window.__img = (opts) => { window.__smb3.frame(opts || {}); const c = document.getElementById('screen'); return c.getContext('2d').getImageData(0, 0, 256, 240).data; };
  window.__hash = (d, x, y, w, h) => { let a = 7; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const k = (j * 256 + i) * 4; a = (a * 31 + d[k] * 7 + d[k + 1] * 13 + d[k + 2] * 17) >>> 0; } return a; };
  window.__diff = (a, b) => { let x0 = 999, y0 = 999, x1 = -1, y1 = -1, n = 0; for (let j = 0; j < 240; j++) for (let i = 0; i < 256; i++) { const k = (j * 256 + i) * 4; if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2]) { n++; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } } return { x0, y0, x1, y1, n }; };
  window.__colors = (d, y0) => { const s = new Set(); for (let j = y0; j < 240; j++) for (let i = 0; i < 256; i++) { const k = (j * 256 + i) * 4; s.add(d[k] + ',' + d[k + 1] + ',' + d[k + 2]); } return s.size; };
`;

test.beforeEach(async ({ page }) => { await openGame(page); await page.evaluate(PAGE); });

test.describe('[visual-style] NES-style palette discipline', () => {
  test('V1 the course start renders a colourful, non-blank scene', async ({ page }) => {
    const n = await page.evaluate(() => { window.__smb3.reset({ scenario: 'course-1-1' }); return window.__colors(window.__img(), 20); });
    expect(n).toBeGreaterThanOrEqual(8);
  });
  test('V2 whole-screen palette stays within an NES-like budget (no gradients, no anti-aliasing)', async ({ page }) => {
    const n = await page.evaluate(() => { window.__smb3.reset({ scenario: 'course-1-1' }); window.__smb3.step(240, { right: true, B: true }); return window.__colors(window.__img(), 0); });
    expect(n, `distinct colours on screen: ${n}`).toBeLessThanOrEqual(48);
  });
  test('V2b the same budget holds at the goal (dark area, card box, clear banner)', async ({ page }) => {
    const n = await page.evaluate(() => {
      window.__smb3.reset({ level: ['................', '................', '................', '................', '................', 'P......G........', '################', '################'] });
      window.__smb3.step(260, { right: true }); return window.__colors(window.__img(), 0);
    });
    expect(n, `distinct colours: ${n}`).toBeLessThanOrEqual(48);
  });
  test('V3 sprite sheet contract: sizes, binary alpha, small per-sprite palettes', async ({ page }) => {
    const sheet = await page.evaluate(() => window.__smb3.sprites());
    const size = { 'hero-s': [16, 16], 'hero-b': [16, 32], walker: [16, 16], 'walker-winged': [16, 16], 'snail-green': [16, 16], 'snail-red': [16, 16], 'snail-winged': [16, 16],
      'shell-green': [16, 16], 'shell-red': [16, 16], plant: [16, 24], orb: [16, 16], coin: [8, 14], switch: [16, 16], 'card-star': [16, 16], 'card-flower': [16, 16], 'card-mushroom': [16, 16] };
    for (const [name, [w, h]] of Object.entries(size)) {
      expect(sheet[name], `sprite ${name} exists`).toBeTruthy();
      for (const [i, f] of sheet[name].entries()) {
        expect([f.w, f.h], `${name}[${i}] size`).toEqual([w, h]);
        expect(f.alphaOk, `${name}[${i}] has only fully opaque or fully transparent pixels`).toBe(true);
        expect(f.colors, `${name}[${i}] colour count`).toBeLessThanOrEqual(8);
      }
    }
  });
});

test.describe('[visual-sprites] hero and enemy sprite contracts', () => {
  test('V4 hero poses are all different images (idle, walk x2, jump, skid, dead)', async ({ page }) => {
    const sheet = await page.evaluate(() => window.__smb3.sprites());
    for (const k of ['hero-s', 'hero-b']) {
      const hs = sheet[k].map((f) => f.hash);
      expect(sheet[k].length, `${k} frame count`).toBeGreaterThanOrEqual(6);
      expect(new Set(hs).size, `${k} distinct poses`).toBe(hs.length);
    }
  });
  test('V5 hero art fills its hitbox (16x16 small, 16x32 big)', async ({ page }) => {
    const sheet = await page.evaluate(() => window.__smb3.sprites());
    for (const [k, h] of [['hero-s', 16], ['hero-b', 32]]) for (const [i, f] of sheet[k].entries()) {
      if (k === 'hero-b' && i === 10) continue;                 // crouch is deliberately shorter
      const bw = f.bbox.x1 - f.bbox.x0 + 1, bh = f.bbox.y1 - f.bbox.y0 + 1;
      expect(bh, `${k}[${i}] height coverage`).toBeGreaterThanOrEqual(h - 4);
      expect(bw, `${k}[${i}] width coverage`).toBeGreaterThanOrEqual(10);
      expect(f.bbox.x0).toBeGreaterThanOrEqual(0); expect(f.bbox.x1).toBeLessThanOrEqual(15); expect(f.bbox.y1).toBeLessThanOrEqual(h - 1);
    }
  });
  test('V6 on screen the hero is drawn inside its physics box (small and big)', async ({ page }) => {
    for (const [powerup, h] of [['small', 16], ['big', 32]]) {
      const r = await page.evaluate(([powerup]) => {
        const g = window.__smb3; g.reset({ level: ['................', '................', '................', '................', '................', '...P............', '################', '################'], powerup });
        const a = window.__img({ hero: true }), b = window.__img({ hero: false }), p = g.getState().player;
        return { d: window.__diff(a, b), x: Math.round(p.x), y: Math.round(p.y) };
      }, [powerup]);
      expect(r.d.n, `${powerup} hero pixels`).toBeGreaterThan(40);
      expect(r.d.x0).toBeGreaterThanOrEqual(r.x); expect(r.d.x1).toBeLessThanOrEqual(r.x + 15);
      expect(r.d.y0).toBeGreaterThanOrEqual(r.y); expect(r.d.y1).toBeLessThanOrEqual(r.y + h - 1);
      expect(r.d.y1 - r.d.y0 + 1, `${powerup} drawn height`).toBeGreaterThanOrEqual(h - 4);
    }
  });
  test('V7 facing left mirrors facing right', async ({ page }) => {
    const r = await page.evaluate(() => {
      const lvl = ['................', '................', '................', '................', '................', '...P............', '################', '################'];
      const g = window.__smb3; const grab = (inp) => { g.reset({ level: lvl }); g.step(1, inp); return window.__img(); };
      const a = grab({ right: true }), b = grab({ left: true }), p = g.getState().player, x = Math.round(p.x), y = Math.round(p.y);
      let same = 0, total = 0;
      for (let j = y; j < y + 16; j++) for (let i = 0; i < 16; i++) { const ka = (j * 256 + x + i) * 4, kb = (j * 256 + x + 15 - i) * 4; total++; if (a[ka] === b[kb] && a[ka + 1] === b[kb + 1] && a[ka + 2] === b[kb + 2]) same++; }
      return same / total;
    });
    expect(r).toBeGreaterThan(0.98);
  });
  test('V8 every enemy type renders and the types look different from each other', async ({ page }) => {
    const out = await page.evaluate(() => {
      const g = window.__smb3, res = {}, sigs = [];
      for (const ch of ['g', 'w', 'k', 'K', 'h']) {
        g.reset({ level: ['................', '................', '................', '................', '................', 'P........' + ch + '......', '################', '################'] });
        const a = window.__img({ enemies: true }), b = window.__img({ enemies: false }), d = window.__diff(a, b);
        res[ch] = d.n; sigs.push(window.__hash(a, d.x0, d.y0, d.x1 - d.x0 + 1, d.y1 - d.y0 + 1));
      }
      g.reset({ level: ['................', '................', '................', '................', '.....f..........', '.....LR.P.......', '.....lr.........', '################', '################'].slice(0, 6).concat(['################', '################']) });
      g.step(110, {});
      const a = window.__img({ enemies: true }), b = window.__img({ enemies: false }); res.plant = window.__diff(a, b).n;
      return { res, distinct: new Set(sigs).size };
    });
    for (const [k, n] of Object.entries(out.res)) expect(n, `enemy ${k} visible pixels`).toBeGreaterThan(30);
    expect(out.distinct, 'five ground enemy types are visually distinct').toBe(5);
  });
});

test.describe('[visual-motion] animation and camera', () => {
  test('V9 rendering is deterministic: same inputs, identical pixels', async ({ page }) => {
    const [a, b] = await page.evaluate(() => {
      const g = window.__smb3, snap = () => { g.reset({ scenario: 'course-1-1' }); g.step(300, { right: true, B: true }); return window.__hash(window.__img(), 0, 0, 256, 240); };
      return [snap(), snap()];
    });
    expect(a).toBe(b);
  });
  test('V10 the camera scrolls with the hero while the HUD stays put', async ({ page }) => {
    const r = await page.evaluate(() => {
      const g = window.__smb3; g.reset({ scenario: 'course-1-1' });
      const h0 = window.__hash(window.__img(), 0, 20, 256, 220), hud0 = window.__img();
      g.step(240, { right: true, B: true });
      const d1 = window.__img(), s = g.getState();
      let hudInk = 0; for (let j = 0; j < 18; j++) for (let i = 0; i < 256; i++) { const k = (j * 256 + i) * 4; if (d1[k] > 200 && d1[k + 1] > 200) hudInk++; }
      return { cam: s.camX, changed: window.__hash(d1, 0, 20, 256, 220) !== h0, hudInk };
    });
    expect(r.cam).toBeGreaterThan(50); expect(r.changed).toBe(true); expect(r.hudInk).toBeGreaterThan(60);
  });
  test('V11 HUD text has WCAG contrast of at least 4.5 against its bar', async ({ page }) => {
    const ratio = await page.evaluate(() => {
      window.__smb3.reset({ scenario: 'course-1-1' }); const d = window.__img();
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      let bright = [0, 0, 0], dark = [255, 255, 255];
      for (let j = 0; j < 18; j++) for (let i = 0; i < 160; i++) { const k = (j * 256 + i) * 4, c = [d[k], d[k + 1], d[k + 2]]; if (lum(c) > lum(bright)) bright = c; if (lum(c) < lum(dark)) dark = c; }
      return (lum(bright) + 0.05) / (lum(dark) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
  test('V12 walking cycles the walk frames and a jump shows the jump pose', async ({ page }) => {
    const r = await page.evaluate(() => {
      const g = window.__smb3; g.reset({ level: ['................................', '................................', '................................', '................................', '................................', 'P...............................', '################################', '################################'] });
      const run = new Set(), air = new Set(); let idle;
      idle = (() => { const d = window.__img(); const p = g.getState().player; return window.__hash(d, Math.round(p.x), Math.round(p.y), 16, 16); })();
      for (let f = 0; f < 60; f++) { const s = g.step(1, { right: true, B: true, A: f > 40 })[0], d = window.__img(), p = s.player; const h = window.__hash(d, Math.round(p.x - s.camX), Math.round(p.y), 16, 16); (p.onGround ? run : air).add(h); }
      return { run: run.size, air: air.size, idleInRun: run.has(idle) };
    });
    expect(r.run, 'at least two walk frames').toBeGreaterThanOrEqual(2);
    expect(r.air, 'jump pose appears').toBeGreaterThanOrEqual(1);
  });
  test('V13 reversing at speed shows a distinct skid pose', async ({ page }) => {
    const r = await page.evaluate(() => {
      const g = window.__smb3; g.reset({ level: ['................................', '................................', '................................', '................................', '................................', 'P...............................', '################################', '################################'] });
      const seen = new Set();
      const grab = () => { const s = g.getState(), d = window.__img(); return window.__hash(d, Math.round(s.player.x - s.camX), Math.round(s.player.y), 16, 16); };
      for (let f = 0; f < 40; f++) { g.step(1, { right: true, B: true }); seen.add(grab()); }
      g.step(1, { left: true }); const skid = grab();
      return { skidIsNew: !seen.has(skid) };
    });
    expect(r.skidIsNew).toBe(true);
  });
  test('V14 the big hero is drawn 32 px tall', async ({ page }) => {
    const h = await page.evaluate(() => {
      const g = window.__smb3; g.reset({ level: ['................', '................', '................', '................', '................', '...P............', '################', '################'], powerup: 'big' });
      const d = window.__diff(window.__img({ hero: true }), window.__img({ hero: false })); return d.y1 - d.y0 + 1;
    });
    expect(h).toBeGreaterThanOrEqual(28);
  });
});

test.describe('[visual-hero] pose set and in-game pose selection', () => {
  const FLAT = ['................................', '................................', '................................', '................................', '................................', 'P...............................', '################################', '################################'];
  test('V15 hero has a full 12-pose animation set with varied silhouettes', async ({ page }) => {
    const sheet = await page.evaluate(() => window.__smb3.sprites());
    for (const k of ['hero-s', 'hero-b']) {
      expect(sheet[k].length, `${k} pose count`).toBe(12);
      expect(new Set(sheet[k].map((f) => f.hash)).size, `${k} distinct poses`).toBe(12);
      expect(new Set(sheet[k].map((f) => f.shape)).size, `${k} distinct silhouettes`).toBeGreaterThanOrEqual(9);
    }
  });
  test('V16 walking, running, rising and falling each use their own frames', async ({ page }) => {
    const r = await page.evaluate((lvl) => {
      const g = window.__smb3, hh = () => { const s = g.getState(), d = window.__img(); const pp = s.player; return window.__hash(d, Math.round(pp.x - s.camX), Math.round(pp.y), 16, pp.powerup === 'small' ? 16 : 32); };
      const collect = (inp, frames, pred) => { const set = new Set(); for (let f = 0; f < frames; f++) { const s = g.step(1, inp(f))[0]; if (!pred || pred(s)) set.add(hh()); } return set; };
      g.reset({ level: lvl }); const walk = collect(() => ({ right: true }), 50, (s) => s.player.onGround && Math.abs(s.player.vx) < 40 && Math.abs(s.player.vx) > 0);
      g.reset({ level: lvl }); const run = collect(() => ({ right: true, B: true }), 90, (s) => s.player.onGround && Math.abs(s.player.vx) >= 40);
      g.reset({ level: lvl }); const rise = collect((f) => ({ A: true }), 60, (s) => !s.player.onGround && s.player.vy < 0);
      g.reset({ level: lvl }); const fall = collect((f) => ({ A: f < 12 }), 80, (s) => !s.player.onGround && s.player.vy > 0);
      g.reset({ level: lvl }); const idle = collect(() => ({}), 200);
      const inter = (a, b) => [...a].filter((x) => b.has(x)).length;
      return { walk: walk.size, run: run.size, rise: rise.size, fall: fall.size, idle: idle.size, wr: inter(walk, run), rf: inter(rise, fall), wi: inter(walk, idle) };
    }, FLAT);
    expect(r.walk, 'walk frames').toBeGreaterThanOrEqual(3);
    expect(r.run, 'run frames').toBeGreaterThanOrEqual(2);
    expect(r.wr, 'walk and run share no frames').toBe(0);
    expect(r.rise).toBeGreaterThanOrEqual(1); expect(r.fall).toBeGreaterThanOrEqual(1);
    expect(r.rf, 'rising and falling look different').toBe(0);
    expect(r.idle, 'idle blinks at least once in 200 frames').toBeGreaterThanOrEqual(2);
  });
  test('V17 big hero crouches visibly when down is held', async ({ page }) => {
    const r = await page.evaluate((lvl) => {
      const g = window.__smb3; const box = (inp) => { g.reset({ level: lvl, powerup: 'big' }); g.step(2, inp); return window.__diff(window.__img({ hero: true }), window.__img({ hero: false })); };
      const a = box({}), b = box({ down: true });
      return { idleH: a.y1 - a.y0 + 1, crouchH: b.y1 - b.y0 + 1 };
    }, FLAT);
    expect(r.crouchH).toBeLessThan(r.idleH - 6);
  });
  test('V18 hero palette stays within the NES-style per-sprite budget in every pose', async ({ page }) => {
    const sheet = await page.evaluate(() => window.__smb3.sprites());
    for (const k of ['hero-s', 'hero-b']) for (const [i, f] of sheet[k].entries()) expect(f.colors, `${k}[${i}]`).toBeLessThanOrEqual(7);
  });
});
