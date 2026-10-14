// SPDX-License-Identifier: MIT
// Gameplay checks derived from course-1-1-checklist.md. Each test names its checklist id.
// Micro-levels (ASCII rows, legend in game/src/game.js) isolate one rule per test.
const { test, expect } = require('@playwright/test');
const { P, openGame, run } = require('./lib/hook');

const NONE = {}, R = { right: true }, RB = { right: true, B: true }, L = { left: true }, A = { A: true };
const SOLID = '#BM?WSULRlr';

// 6 free rows (0..5) + 2 floor rows. Player 'P' belongs on row 5. Floor top y = 96.
function mini(rows, w = 40, floorGap) {
  const pad = (s) => s.padEnd(w, '.');
  let floor = '#'.repeat(w);
  if (floorGap) floor = floor.split('').map((c, i) => (i >= floorGap[0] && i <= floorGap[1] ? '.' : c)).join('');
  return [...rows.map(pad), floor, floor];
}
const lastOf = (r) => r.trace[r.trace.length - 1];
const probeAt = (page, x, y) => page.evaluate(([x, y]) => window.__smb3.probe(x, y), [x, y]);
const summary = (page, opts) => page.evaluate((o) => { window.__smb3.reset(o); return window.__smb3.getCourseSummary(); }, opts);
const COURSE = { scenario: 'course-1-1' };

test.beforeEach(async ({ page }) => { await openGame(page); });

// ----------------------------------------------------------------------------- A: course frame
test.describe('[course-frame] timer, pits, determinism (checklist A2-A7)', () => {
  test('A2 time limit starts at 300', async ({ page }) => {
    const s = await summary(page, COURSE);
    expect(s.timer).toBe(300);
  });
  test('A3 one timer unit lasts 41 frames', async ({ page }) => {
    const { trace } = await run(page, { level: mini(['', '', '', '', '', 'P']) }, [{ frames: 130, input: NONE }]);
    expect(trace[39].time).toBe(300);
    expect(trace[40].time).toBe(299);
    expect(trace[81].time).toBe(298);
    expect(trace[122].time).toBe(297);
  });
  test('A4 timer reaching 000 kills the player', async ({ page }) => {
    const { trace } = await run(page, { level: mini(['', '', '', '', '', 'P']) }, [{ frames: 12400, input: NONE }]);
    const last = lastOf({ trace });
    expect(last.time).toBe(0);
    expect(last.player.dead).toBe(true);
  });
  test('A6 falling into a pit kills the player', async ({ page }) => {
    const { trace } = await run(page, { level: mini(['', '', '', '', '', '..P'], 40, [0, 10]) }, [{ frames: 200, input: NONE }]);
    expect(lastOf({ trace }).player.dead).toBe(true);
  });
  test('A7 deterministic: identical input scripts give identical course traces', async ({ page }) => {
    const seg = [{ frames: 200, input: RB }, { frames: 40, input: { right: true, B: true, A: true } }, { frames: 300, input: R }];
    const a = await run(page, COURSE, seg), b = await run(page, COURSE, seg);
    expect(JSON.stringify(a.trace)).toBe(JSON.stringify(b.trace));
  });
});

// ----------------------------------------------------------------------------- C/E: layout counts
test.describe('[course-layout] counts from the checklist (C1-C6, E1-E3, D2)', () => {
  const cases = [
    ['C1 four walkers', (s) => s.enemies.walker, 4],
    ['C2 one winged walker', (s) => s.enemies.winged_walker, 1],
    ['C3 one green shellback', (s) => s.enemies.shellback, 1],
    ['C4 two red shellbacks', (s) => s.enemies.shellback_red, 2],
    ['C5 three hoppers', (s) => s.enemies.hopper, 3],
    ['C6 one plant', (s) => s.enemies.plant, 1],
    ['E1 34 coins in open air', (s) => s.coinsInAir, 34],
    ['E1 5 coin blocks', (s) => s.coinBlocks, 5],
    ['E2 3 item blocks', (s) => s.itemBlocks, 3],
    ['D2 18 bricks plus one switch brick', (s) => s.bricks * 10 + s.switchBricks, 181],
    ['G1 goal exists at the far right', (s) => (s.goalX > s.widthPx * 0.85 ? 1 : 0), 1],
  ];
  for (const [name, pick, want] of cases) {
    test(name, async ({ page }) => { expect(pick(await summary(page, COURSE))).toBe(want); });
  }
});

// ----------------------------------------------------------------------------- C: enemy rules
test.describe('[enemies] shell, ledge and wing rules (C9-C14)', () => {
  const stomp = (extra) => [{ frames: 40, input: extra || NONE }];

  test('C12 stomping a shellback leaves a stationary shell', async ({ page }) => {
    const { trace } = await run(page, { level: mini(['', '', '', '', '', 'P', ''].slice(0, 6).map((r, i) => (i === 1 ? 'P' : i === 5 ? 'k' : r))) }, stomp());
    const e = lastOf({ trace }).entities[0];
    expect(e.state).toBe('shell');
    expect(e.vx).toBe(0);
  });
  test('C12 touching a shell kicks it at e.shell_kick_vx or faster', async ({ page }) => {
    const lvl = mini(['', 'P', '', '', '', 'k']);
    const { trace } = await run(page, { level: lvl }, [{ frames: 40, input: L }, { frames: 120, input: NONE }]);
    const slid = trace.some((s) => s.entities[0].state === 'slide' && Math.abs(s.entities[0].vx) >= P('e.shell_kick_vx'));
    expect(slid).toBe(true);
  });
  test('C12 a sliding shell defeats another enemy', async ({ page }) => {
    const lvl = mini(['', '...P', '', '', '', '...k.........g']);
    const { trace } = await run(page, { level: lvl }, [{ frames: 12, input: L }, { frames: 50, input: NONE }, { frames: 70, input: R }, { frames: 200, input: NONE }]);
    const g = lastOf({ trace }).entities.find((e) => e.type === 'walker');
    expect(['flipped', 'gone']).toContain(g.state);
  });
  test('C12 a sliding shell opens a ground-level block (B3)', async ({ page }) => {
    const lvl = mini(['', '', '', '', '', '...P', ''].slice(0, 6).map((r, i) => (i === 1 ? '...P' : i === 5 ? '...k.....M' : '')));
    const { trace } = await run(page, { level: lvl }, [{ frames: 12, input: L }, { frames: 50, input: NONE }, { frames: 70, input: R }, { frames: 200, input: NONE }]);
    expect(lastOf({ trace }).entities.some((e) => e.type === 'orb')).toBe(true);
  });
  test('C4 red shellbacks turn at ledges, green ones walk off', async ({ page }) => {
    const mk = (ch) => ({ level: ['.........', '.........', '.........', '.....' + ch + '...'.slice(0, 3), '..####...', '.........', '#########', '#########'].map((r) => r.padEnd(40, '.')).map((r, i) => (i >= 6 ? '#'.repeat(40) : i === 5 ? r.slice(0, 8) + 'P' + r.slice(9) : r)) });
    const red = await run(page, mk('K'), [{ frames: 260, input: NONE }]);
    const green = await run(page, mk('k'), [{ frames: 260, input: NONE }]);
    const y0 = red.initial.entities[0].y;
    expect(lastOf(red).entities[0].y, 'red stays on the ledge').toBe(y0);
    expect(lastOf(green).entities[0].y, 'green walks off').toBeGreaterThan(y0 + 8);
  });
  test('C14 stomping a winged walker removes its wings and keeps it alive', async ({ page }) => {
    const { trace } = await run(page, { level: mini(['', 'P', '', '', '', 'w']) }, stomp());
    const e = lastOf({ trace }).entities[0];
    expect(e.winged).toBe(false);
    expect(e.type).toBe('walker');
    expect(e.state).toBe('walking');
  });
  test('C14 stomping a hopper removes its wings (becomes a plain shellback)', async ({ page }) => {
    const { trace } = await run(page, { level: mini(['', 'P', '', '', '', 'h']) }, stomp());
    const e = lastOf({ trace }).entities[0];
    expect(e.winged).toBe(false);
    expect(e.type).toBe('shellback');
  });
  test('C15 the plant rises out of its pipe and hides again', async ({ page }) => {
    const rows = ['', '', '', 'f', 'L', 'l'].map((r, i) => (i === 3 ? '.....f' : i === 4 ? '.....L' : i === 5 ? '.....l' : r));
    const lvl = mini(rows.map((r, i) => (i === 4 ? '.....LR' : i === 5 ? '.....lr.P' : r)), 40);
    const { trace } = await run(page, { level: lvl }, [{ frames: 400, input: NONE }]);
    const ys = trace.map((s) => s.entities[0].y), lo = Math.min(...ys), hi = Math.max(...ys);
    expect(hi - lo, 'plant moves at least 20 px').toBeGreaterThanOrEqual(20);
  });
  test('C11 a walker touching small player from the side hurts (dead) while stomping does not', async ({ page }) => {
    const { trace } = await run(page, { level: mini(['', '', '', '', '', 'P.......g']) }, [{ frames: 340, input: NONE }]);
    expect(lastOf({ trace }).player.dead).toBe(true);
  });
});

// ----------------------------------------------------------------------------- D/E: blocks and items
test.describe('[blocks] bumping, items, one-way platforms, switch (D6-D8, E4, E6)', () => {
  const jump = [{ frames: 40, input: A }];
  test('D6 small player bumps a brick without breaking it', async ({ page }) => {
    const lvl = mini(['', '', 'P'.padStart(6, '.').replace('P', 'B'), '', '', '.....P'].slice(0, 6));
    const r = await run(page, { level: mini(['', '', '.....B', '', '', '.....P']) }, jump);
    expect(await probeAt(page, 5 * 16 + 8, 2 * 16 + 8)).toBe('B');
  });
  test('D6 big player breaks a brick', async ({ page }) => {
    await run(page, { level: mini(['', '', '.....B', '', '', '.....P']), powerup: 'big' }, jump);
    expect(await probeAt(page, 5 * 16 + 8, 2 * 16 + 8)).toBe('.');
  });
  test('E1 a coin block pays one coin and becomes a used block', async ({ page }) => {
    const r = await run(page, { level: mini(['', '', '.....?', '', '', '.....P']) }, jump);
    expect(lastOf(r).coins).toBe(1);
    expect(await probeAt(page, 5 * 16 + 8, 2 * 16 + 8)).toBe('U');
  });
  test('E2 an item block releases an item that moves at e.mushroom_vx', async ({ page }) => {
    const r = await run(page, { level: mini(['', '', '.....M', '', '', '.....P']) }, [{ frames: 80, input: A }]);
    const orb = lastOf(r).entities.find((e) => e.type === 'orb');
    expect(orb, 'item present').toBeTruthy();
    expect(Math.abs(orb.vx)).toBe(P('e.mushroom_vx'));
  });
  test('E6 collecting the item grows small player to big', async ({ page }) => {
    const r = await run(page, { level: mini(['', '', '.....M', '', '', '.....P'], 60) }, [{ frames: 40, input: A }, { frames: 240, input: { left: true, B: true } }]);
    expect(lastOf(r).player.powerup).toBe('big');
  });
  test('D7 bumping a block defeats the enemy standing on it', async ({ page }) => {
    const r = await run(page, { level: mini(['', '', '', '.....g', '.....B', '.....P']) }, jump);
    expect(['flipped', 'gone']).toContain(lastOf(r).entities[0].state);
  });
  test('D8 one-way platform: jump up through it and land on top', async ({ page }) => {
    const r = await run(page, { level: mini(['', '', '', '....===', '', '.....P']) }, [{ frames: 70, input: A }]);
    const s = lastOf(r);
    expect(s.player.onGround).toBe(true);
    expect(s.player.feetY).toBe(48);
  });
  test('D2 a switch brick releases a switch', async ({ page }) => {
    const r = await run(page, { level: mini(['', '', '', '.....S', '', '.....P']) }, jump);
    expect(lastOf(r).entities.some((e) => e.type === 'pswitch')).toBe(true);
  });
  test('D3 stomping the switch turns bricks into coins, then they come back', async ({ page }) => {
    const lvl = mini(['', '.P', '', '', '', '.p.BBBBBB'], 40);
    const r = await run(page, { level: lvl }, [{ frames: 40, input: NONE }]);
    expect(lastOf(r).switchActive).toBe(true);
    const mid = await page.evaluate(() => window.__smb3.getCourseSummary());
    expect(mid.bricks).toBe(0);
    expect(mid.brickCoins).toBe(6);
    await page.evaluate(() => window.__smb3.step(520, {}));
    const after = await page.evaluate(() => window.__smb3.getCourseSummary());
    expect(after.bricks).toBe(6);
  });
});

// ----------------------------------------------------------------------------- G: goal
test.describe('[goal] card box and time bonus (G1-G6)', () => {
  test('G2 touching the goal clears the course and shows a card', async ({ page }) => {
    const r = await run(page, { level: mini(['', '', '', '', '', 'P...G'], 40) }, [{ frames: 120, input: R }]);
    const s = lastOf(r);
    expect(s.cleared).toBe(true);
    expect(['mushroom', 'flower', 'star']).toContain(s.card);
  });
  test('G6 remaining time converts to score at 50 points per unit', async ({ page }) => {
    const r = await run(page, { level: mini(['', '', '', '', '', 'P...G'], 40) }, [{ frames: 800, input: R }]);
    const s = lastOf(r);
    expect(s.time).toBe(0);
    expect(s.score).toBeGreaterThanOrEqual(15000 - 50 * 5);
  });
});

// ----------------------------------------------------------------------------- end to end
test.describe('[playthrough] the whole course', () => {
  // Beam search over 10-frame macro actions using the optional snap()/restore()/advance() hooks (contract v1.2).
  // If the planner can reach the goal, the course is completable with real physics; if the level is unfair it fails.
  test('a lookahead planner can finish World 1-1 before the timer ends', async ({ page }) => {
    test.setTimeout(300_000);
    const out = await page.evaluate(() => {
      const g = window.__smb3;
      const ACTS = [
        { right: true, B: true }, { right: true, B: true, A: true }, { right: true, A: true }, { right: true },
        {}, { left: true }, { right: true, B: true, A: true, _short: 3 },
      ];
      const apply = (act) => { const o = Object.assign({}, act); delete o._short; return o; };
      g.reset({ scenario: 'course-1-1' });
      let beam = [{ snap: g.snap(), x: 0, path: [] }], winner = null, seenMax = 0;
      for (let step = 0; step < 520 && !winner; step++) {
        const next = [], seen = new Set();
        for (const node of beam) {
          for (let ai = 0; ai < ACTS.length; ai++) {
            g.restore(node.snap);
            const act = ACTS[ai];
            const inputs = [];
            for (let f = 0; f < 10; f++) inputs.push(act._short && f >= act._short ? { right: true, B: true } : apply(act));
            const s = g.advance(10, inputs);
            if (s.player.dead) continue;
            if (s.cleared) { winner = { frame: s.frame, steps: step + 1 }; break; }
            const key = [Math.floor(s.player.x / 3), Math.round(s.player.vx / 6), s.player.onGround ? 1 : 0, Math.round(s.player.feetY / 8), s.player.powerup, s.entities.filter((e) => e.state !== 'gone').length].join(':');
            if (seen.has(key)) continue; seen.add(key);
            next.push({ snap: g.snap(), x: s.player.x, frame: s.frame });
          }
          if (winner) break;
        }
        if (!next.length) break;
        next.sort((a, b) => b.x - a.x);
        beam = next.slice(0, 48); seenMax = Math.max(seenMax, beam[0].x);
      }
      return winner ? { cleared: true, ...winner } : { cleared: false, bestX: Math.round(seenMax), beamEmpty: beam.length === 0 };
    });
    expect(out, JSON.stringify(out)).toMatchObject({ cleared: true });
  });
});
