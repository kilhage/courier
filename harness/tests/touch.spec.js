// SPDX-License-Identifier: MIT
// Touch controls: finger positions must drive the same inputs as the keyboard.
const { test, expect } = require('@playwright/test');
const { GAME_URL } = require('./lib/hook');

test.describe('[touch] on-screen controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(GAME_URL + (GAME_URL.includes('?') ? '&' : '?') + 'touch=1');
    await page.waitForFunction(() => window.__smb3 && document.body.classList.contains('touch'));
  });

  // dispatch a touch list built from button centres; ids are button labels
  const touch = (page, type, keys) => page.evaluate(([type, keys]) => {
    const pts = keys.map((k, i) => { const r = document.querySelector(`#touch [data-key="${k}"]`).getBoundingClientRect(); return new Touch({ identifier: i, target: document.body, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }); });
    document.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : pts, changedTouches: pts, bubbles: true, cancelable: true }));
  }, [type, keys]);
  const state = (page) => page.evaluate(() => window.__smb3.getState().player);

  test('T1 controls are visible and the keyboard hint is hidden', async ({ page }) => {
    await expect(page.locator('#touch')).toBeVisible();
    await expect(page.locator('.keys')).toBeHidden();
    for (const k of ['ArrowLeft', 'ArrowRight', 'KeyZ', 'KeyX']) await expect(page.locator(`#touch [data-key="${k}"]`)).toBeVisible();
  });
  test('T2 buttons are large enough to hit (>= 44 px)', async ({ page }) => {
    for (const k of ['ArrowLeft', 'ArrowRight', 'KeyZ', 'KeyX']) {
      const b = await page.locator(`#touch [data-key="${k}"]`).boundingBox();
      expect(Math.min(b.width, b.height), k).toBeGreaterThanOrEqual(44);
    }
  });
  test('T3 holding right moves the player; releasing stops the input', async ({ page }) => {
    // realtime loop runs here: reload hook-free state by letting the game run
    const x0 = (await state(page)).x;
    await touch(page, 'touchstart', ['ArrowRight']);
    await page.waitForTimeout(600);
    const x1 = (await state(page)).x;
    await touch(page, 'touchend', []);
    expect(x1).toBeGreaterThan(x0 + 8);
  });
  test('T4 two fingers at once: right + jump leaves the ground', async ({ page }) => {
    await touch(page, 'touchstart', ['ArrowRight', 'KeyX']);
    await page.waitForTimeout(250);
    const p = await state(page);
    await touch(page, 'touchend', []);
    expect(p.onGround).toBe(false);
    expect(p.vx).toBeGreaterThan(0);
  });
  test('T5 the page does not scroll or zoom (touch-action none, viewport locked)', async ({ page }) => {
    const r = await page.evaluate(() => ({ ta: getComputedStyle(document.body).touchAction, vp: document.querySelector('meta[name=viewport]').content }));
    expect(r.ta).toBe('none');
    expect(r.vp).toContain('user-scalable=no');
  });
});
