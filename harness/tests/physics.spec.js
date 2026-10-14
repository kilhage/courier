// SPDX-License-Identifier: MIT
// SMB3 World 1-1 physics assertions. Every expected number is read from
// ../physics-spec.json (params + expectations); nothing is hard-coded here
// except input scripts. Test titles start with the spec section they cover.
const { test, expect } = require('@playwright/test');
const { P, E, openGame, run, expectNear, firstIndex } = require('./lib/hook');

const R = { right: true }, RB = { right: true, B: true }, LB = { left: true, B: true };
const NONE = {};

test.beforeEach(async ({ page }) => { await openGame(page); });

// ------------------------------------------------------------------ timing / contract
test.describe('[timing] contract and determinism', () => {
  test('hook exposes apiVersion 1, reset/step/getState and the required state fields', async ({ page }) => {
    const s = await page.evaluate(() => {
      const g = window.__smb3;
      const st = g.reset({ scenario: 'flat' });
      const tr = g.step(3, { right: true });
      return { st, tr, after: g.getState(), types: [typeof g.reset, typeof g.step, typeof g.getState] };
    });
    expect(s.types).toEqual(['function', 'function', 'function']);
    for (const k of ['x', 'y', 'feetY', 'vx', 'vy', 'onGround', 'powerup', 'pMeter', 'dead']) expect(s.st.player, `player.${k}`).toHaveProperty(k);
    expect(s.st).toHaveProperty('score');
    expect(s.st).toHaveProperty('entities');
    expect(s.tr.length).toBe(3);
    expect(s.after.frame - s.st.frame).toBe(3);
  });

  test('identical input scripts produce identical traces (deterministic stepping)', async ({ page }) => {
    const script = [
      { frames: 50, input: RB }, { frames: 1, input: { ...RB, A: true } }, { frames: 30, input: { left: true, A: true } },
      { frames: 40, input: NONE }, { frames: 25, input: { left: true } },
    ];
    const a = await run(page, { scenario: 'flat' }, script);
    const b = await run(page, { scenario: 'flat' }, script);
    expect(JSON.stringify(b.trace)).toBe(JSON.stringify(a.trace));
  });
});

// ------------------------------------------------------------------ horizontal
test.describe('[horizontal] speed caps and acceleration', () => {
  test('walk cap: holding Right alone tops out at h.walk_max', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat' }, [{ frames: 90, input: R }]);
    const vx = trace.map((s) => s.player.vx);
    expect(Math.max(...vx)).toBe(P('h.walk_max'));
    expect(vx[vx.length - 1]).toBe(P('h.walk_max'));
  });

  test('run cap: Right+B tops out at h.run_max until the P-meter is full', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat' }, [{ frames: 85, input: RB }]);
    const notFull = trace.filter((s) => s.player.pMeter < P('p.levels'));
    expect(Math.max(...notFull.map((s) => s.player.vx))).toBe(P('h.run_max'));
    expect(trace[trace.length - 1].player.vx).toBe(P('h.run_max'));
  });

  test('P-speed cap: with a full meter Right+B reaches h.pspeed_max and never exceeds it', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat' }, [{ frames: 180, input: RB }]);
    const vx = trace.map((s) => s.player.vx);
    expect(Math.max(...vx)).toBe(P('h.pspeed_max'));
    const firstOverRun = firstIndex(trace, (s) => s.player.vx > P('h.run_max'));
    expect(firstOverRun, 'should exceed run cap at some point').toBeGreaterThan(0);
    expect(trace[firstOverRun - 1].player.pMeter, 'run cap only lifted at full P').toBe(P('p.levels'));
  });

  test('acceleration: +14 subpx/frame per 16 frames from rest (right) and +28 per 32 (left, mirrored)', async ({ page }) => {
    const r = await run(page, { scenario: 'flat' }, [{ frames: 16, input: R }]);
    expect(r.trace[15].player.vx).toBe(E('accel_16_frames').value);
    const l = await run(page, { scenario: 'flat' }, [{ frames: 32, input: LB }]);
    expect(l.trace[31].player.vx).toBe(-E('accel_32_frames').value);
  });

  test('acceleration: every 16-frame window below the cap gains exactly 14 (phase independent)', async ({ page }) => {
    const { initial, trace } = await run(page, { scenario: 'flat' }, [{ frames: 45, input: RB }]);
    const vx = [initial.player.vx, ...trace.map((s) => s.player.vx)];
    let windows = 0;
    for (let i = 0; i + 16 < vx.length; i++) {
      if (vx[i + 16] >= P('h.run_max')) break;
      expect(vx[i + 16] - vx[i], `window starting at frame ${i}`).toBe(E('accel_16_frames').value);
      windows++;
    }
    expect(windows).toBeGreaterThanOrEqual(16);
  });

  test('acceleration rate is identical with and without B (below walk cap)', async ({ page }) => {
    const a = await run(page, { scenario: 'flat' }, [{ frames: 20, input: R }]);
    const b = await run(page, { scenario: 'flat' }, [{ frames: 20, input: RB }]);
    expect(b.trace.map((s) => s.player.vx)).toEqual(a.trace.map((s) => s.player.vx));
  });
});

// ------------------------------------------------------------------ deceleration
test.describe('[deceleration] skid, friction, air momentum', () => {
  test('skid: pressing the opposite direction removes exactly d.skid per frame (ground)', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat' }, [{ frames: 60, input: RB }, { frames: 5, input: LB }]);
    expect(trace[59].player.vx).toBe(P('h.run_max'));
    for (let i = 60; i < 65; i++) expect(trace[i].player.vx - trace[i - 1].player.vx, `frame ${i}`).toBe(-P('d.skid'));
    expect(trace[64].player.vx).toBe(E('skid_5_frames_from_40').value);
  });

  test('skid also applies in the air at d.skid per frame', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat' }, [
      { frames: 60, input: RB }, { frames: 1, input: { ...RB, A: true } }, { frames: 5, input: { left: true, A: true } },
    ]);
    for (let i = 61; i < 66; i++) {
      expect(trace[i].player.onGround).toBe(false);
      expect(trace[i].player.vx - trace[i - 1].player.vx).toBe(-P('d.skid'));
    }
  });

  test('friction (small): releasing at walk speed loses d.friction_small per 16 frames', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat', powerup: 'small' }, [{ frames: 40, input: R }, { frames: 16, input: NONE }]);
    expect(trace[39].player.vx).toBe(P('h.walk_max'));
    expect(trace[55].player.vx).toBe(E('friction_small_16_from_24').value);
  });

  test('friction (big): big player loses d.friction_big per 16 frames (stops faster than small)', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat', powerup: 'big' }, [{ frames: 40, input: R }, { frames: 16, input: NONE }]);
    expect(trace[39].player.vx).toBe(P('h.walk_max'));
    expect(trace[55].player.vx).toBe(E('friction_big_16_from_24').value);
  });

  test('releasing B above the walk cap on the ground decays smoothly back to h.walk_max', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat' }, [{ frames: 60, input: RB }, { frames: 64, input: R }]);
    const after = trace.slice(60).map((s) => s.player.vx);
    for (let i = 1; i < after.length; i++) expect(after[i]).toBeLessThanOrEqual(after[i - 1]);
    expect(Math.min(...after)).toBe(P('h.walk_max'));
    expect(after[after.length - 1]).toBe(P('h.walk_max'));
  });

  test('no air friction: a running jump keeps vx with no input and no B until landing', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat' }, [
      { frames: 60, input: RB }, { frames: 1, input: { ...RB, A: true } }, { frames: 70, input: { A: true } },
    ]);
    const air = trace.slice(60).filter((s) => !s.player.onGround);
    expect(air.length).toBeGreaterThan(30);
    for (const s of air) expect(s.player.vx).toBe(P('h.run_max'));
  });
});

// ------------------------------------------------------------------ vertical (jump + gravity)
async function jumpProfile(page, speed, holdA = true) {
  const pre = { 0: [], 24: [{ frames: 60, input: R }], 40: [{ frames: 60, input: RB }], 56: [{ frames: 150, input: RB }] }[speed];
  const hold = speed === 0 ? {} : speed === 24 ? R : RB;
  const segs = [...pre, { frames: 1, input: { ...hold, A: true } }, { frames: 100, input: holdA ? { ...hold, A: true } : hold }];
  const { initial, trace } = await run(page, { scenario: 'flat' }, segs);
  const all = [initial, ...trace];
  const take = firstIndex(all, (s) => !s.player.onGround);
  const land = firstIndex(all, (s, i) => i > take && s.player.onGround);
  const ground = all[take - 1].player.feetY;
  let apex = take;
  for (let i = take; i < land; i++) if (all[i].player.feetY < all[apex].player.feetY) apex = i;
  return { speedAtTakeoff: Math.abs(all[take].player.vx), takeoffVy: all[take].player.vy, height: ground - all[apex].player.feetY, apexFrames: apex - take, airtime: land - take, all, take, land };
}

test.describe('[vertical] jump', () => {
  for (const [speed, key] of [[0, 'jump_height_held_vx0'], [24, 'jump_height_held_vx24'], [40, 'jump_height_held_vx40'], [56, 'jump_height_held_vx56']]) {
    test(`full-hold jump height at |vx|=${speed} matches ${key}`, async ({ page }) => {
      const j = await jumpProfile(page, speed);
      expect(j.speedAtTakeoff, 'precondition: take-off speed').toBe(speed);
      expectNear(j.height, E(key), key);
    });
  }

  test('standing full-hold jump: apex frame and airtime', async ({ page }) => {
    const j = await jumpProfile(page, 0);
    expectNear(j.apexFrames, E('jump_apex_frame_held_vx0'), 'apex frame');
    expectNear(j.airtime, E('jump_airtime_held_vx0'), 'airtime');
  });

  test('tap jump (A held only on the take-off frame) is much lower', async ({ page }) => {
    const { initial, trace } = await run(page, { scenario: 'flat' }, [{ frames: 1, input: { A: true } }, { frames: 60, input: NONE }]);
    const ground = initial.player.feetY;
    const h = ground - Math.min(...trace.map((s) => s.player.feetY));
    expectNear(h, E('jump_height_tap_vx0'), 'tap height');
  });

  test('take-off velocity bonus: P-speed jump starts v.jump_speed_bonus[3] stronger than a standing jump', async ({ page }) => {
    const a = await jumpProfile(page, 0);
    const b = await jumpProfile(page, 56);
    expect(b.takeoffVy - a.takeoffVy).toBe(E('takeoff_vy_delta_vx56_minus_vx0').value);
  });

  test('jump requires a new A press: holding A through landing does not re-jump', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat' }, [{ frames: 200, input: { A: true } }]);
    let takeoffs = 0;
    for (let i = 1; i < trace.length; i++) if (trace[i - 1].player.onGround && !trace[i].player.onGround) takeoffs++;
    if (!trace[0].player.onGround) takeoffs++;
    expect(takeoffs).toBe(1);
  });

  test('jump height does not depend on power-up (big == small)', async ({ page }) => {
    const seg = [{ frames: 1, input: { A: true } }, { frames: 80, input: { A: true } }];
    const s = await run(page, { scenario: 'flat', powerup: 'small' }, seg);
    const b = await run(page, { scenario: 'flat', powerup: 'big' }, seg);
    const h = (r) => r.initial.player.feetY - Math.min(...r.trace.map((t) => t.player.feetY));
    expect(h(b)).toBeCloseTo(h(s), 6);
  });
});

test.describe('[vertical] gravity', () => {
  test('free fall gains v.gravity per frame from rest', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'drop' }, [{ frames: 12, input: NONE }]);
    trace.forEach((s, i) => expect(s.player.vy, `frame ${i + 1}`).toBe(P('v.gravity') * (i + 1)));
  });

  test('rising with A held uses v.gravity_held while vy < v.gravity_threshold, then v.gravity', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat' }, [{ frames: 1, input: { A: true } }, { frames: 60, input: { A: true } }]);
    let light = 0, heavy = 0;
    for (let i = 1; i < trace.length && !trace[i].player.onGround; i++) {
      // vy is clamped to v.fall_cap before moving, then gravity is added (spec v.order / conflict C3)
      const prev = trace[i - 1].player.vy, d = trace[i].player.vy - Math.min(prev, P('v.fall_cap'));
      if (prev < P('v.gravity_threshold')) { expect(d, `frame ${i} light`).toBe(P('v.gravity_held')); light++; }
      else { expect(d, `frame ${i} heavy`).toBe(P('v.gravity')); heavy++; }
    }
    expect(light).toBeGreaterThan(15);
    expect(heavy).toBeGreaterThan(10);
  });

  test('released A: gravity is v.gravity every airborne frame', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat' }, [{ frames: 1, input: { A: true } }, { frames: 40, input: NONE }]);
    for (let i = 1; i < trace.length && !trace[i].player.onGround; i++) expect(trace[i].player.vy - Math.min(trace[i - 1].player.vy, P('v.fall_cap'))).toBe(P('v.gravity'));
  });

  test('terminal fall: never more than v.fall_cap/16 px per frame, and that cap is reached', async ({ page }) => {
    const { initial, trace } = await run(page, { scenario: 'drop' }, [{ frames: 40, input: NONE }]);
    const feet = [initial.player.feetY, ...trace.map((s) => s.player.feetY)];
    const dy = feet.slice(1).map((f, i) => f - feet[i]);
    expect(Math.max(...dy)).toBeCloseTo(E('fall_max_px_per_frame').value, 6);
    expect(dy.filter((d) => Math.abs(d - E('fall_max_px_per_frame').value) < 1e-9).length).toBeGreaterThan(10);
  });
});

// ------------------------------------------------------------------ P-meter
test.describe('[pmeter] P-meter charge and drain', () => {
  test('arrows only charge on frames that start at |vx| >= p.run_condition on the ground with B', async ({ page }) => {
    const { initial, trace } = await run(page, { scenario: 'flat' }, [{ frames: 40, input: R }, { frames: 120, input: RB }]);
    const all = [initial, ...trace];
    let gains = 0;
    for (let i = 1; i < all.length; i++) {
      if (all[i].player.pMeter > all[i - 1].player.pMeter) {
        gains++;
        expect(Math.abs(all[i - 1].player.vx), `gain at frame ${i}`).toBeGreaterThanOrEqual(P('p.run_condition'));
      }
    }
    expect(gains).toBe(P('p.levels'));
    // walking speed alone never charges the meter
    expect(trace.slice(0, 40).every((s) => s.player.pMeter === 0)).toBe(true);
  });

  test('one arrow every p.gain_period frames; full meter 48 frames after the first arrow; ~94 frames from rest', async ({ page }) => {
    const { initial, trace } = await run(page, { scenario: 'flat' }, [{ frames: 160, input: RB }]);
    const all = [initial, ...trace];
    const gainFrames = [];
    for (let i = 1; i < all.length; i++) if (all[i].player.pMeter > all[i - 1].player.pMeter) gainFrames.push(i);
    expect(gainFrames.length).toBe(P('p.levels'));
    for (let k = 1; k < gainFrames.length; k++) expect(gainFrames[k] - gainFrames[k - 1], `arrow ${k + 1}`).toBe(P('p.gain_period'));
    expect(gainFrames[gainFrames.length - 1] - gainFrames[0]).toBe(E('pmeter_full_after_first_arrow').value);
    expectNear(gainFrames[gainFrames.length - 1], E('pmeter_full_from_rest'), 'frames to full P from rest');
  });

  test('drain: first arrow lost ~p.full_hold frames after leaving full-power running, then every p.loss_period', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'flat' }, [{ frames: 160, input: RB }, { frames: 200, input: R }]);
    expect(trace[159].player.pMeter).toBe(P('p.levels'));
    const loss = [];
    for (let i = 160; i < trace.length; i++) if (trace[i].player.pMeter < trace[i - 1].player.pMeter) loss.push(i);
    expect(loss.length).toBe(P('p.levels'));
    expectNear(loss[0] - 159, E('pmeter_first_loss_after_stop'), 'first loss delay');
    for (let k = 1; k < loss.length; k++) expect(loss[k] - loss[k - 1], `loss ${k + 1}`).toBe(P('p.loss_period'));
  });
});

// ------------------------------------------------------------------ stomp / bounce
async function stomp(page, input) {
  const { initial, trace } = await run(page, { scenario: 'stomp-walker' }, [{ frames: 140, input }]);
  const all = [initial, ...trace];
  const i = firstIndex(all, (s, k) => k > 0 && s.score > all[k - 1].score);
  return { all, i };
}

test.describe('[stomp] stomp and bounce', () => {
  test('stomp sets vy to s.bounce_vy, awards the first chain value and removes the walker', async ({ page }) => {
    const { all, i } = await stomp(page, NONE);
    expect(i, 'a stomp must happen in scenario stomp-walker').toBeGreaterThan(0);
    expect(all[i].player.vy).toBe(P('s.bounce_vy'));
    expect(all[i].score - all[i - 1].score).toBe(P('s.chain')[0]);
    expect(all[i].entities[0].state).not.toBe('walking');
    expect(all[all.length - 1].player.dead).toBe(false);
  });

  test('bounce height with A released matches bounce_height_released', async ({ page }) => {
    const { all, i } = await stomp(page, NONE);
    const h = all[i].player.feetY - Math.min(...all.slice(i).map((s) => s.player.feetY));
    expectNear(h, E('bounce_height_released'), 'bounce (released)');
  });

  test('bounce height with A held matches bounce_height_held (hold A to bounce higher)', async ({ page }) => {
    const { all, i } = await stomp(page, { A: true });
    const h = all[i].player.feetY - Math.min(...all.slice(i).map((s) => s.player.feetY));
    expectNear(h, E('bounce_height_held'), 'bounce (held)');
  });

  test('walking into a walker from the side hurts small player (no score)', async ({ page }) => {
    const { trace } = await run(page, { scenario: 'walker-walk' }, [{ frames: 260, input: NONE }]);
    const last = trace[trace.length - 1];
    expect(last.player.dead || last.player.powerup !== 'small').toBe(true);
    expect(last.score).toBe(0);
  });
});

// ------------------------------------------------------------------ enemies
test.describe('[enemies] enemy movement', () => {
  test('walker walks at e.walker_vx (0.5 px/frame)', async ({ page }) => {
    const { initial, trace } = await run(page, { scenario: 'walker-walk' }, [{ frames: 32, input: NONE }]);
    const dx = Math.abs(trace[31].entities[0].x - initial.entities[0].x);
    expect(dx).toBe(E('walker_px_per_32_frames').value);
    expect(Math.abs(trace[31].entities[0].vx)).toBe(P('e.walker_vx'));
  });
});
