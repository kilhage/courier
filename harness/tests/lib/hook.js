// SPDX-License-Identifier: MIT
// Shared helpers for the SMB3 harness. All game interaction goes through the
// window.__smb3 contract described in GAME-HOOK.md.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

const SPEC_PATH = process.env.SPEC_PATH || path.resolve(__dirname, '..', '..', '..', 'spec', 'physics-spec.json');
const SPEC = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));

/** value of a spec parameter */
const P = (id) => {
  if (!SPEC.params[id]) throw new Error(`spec param ${id} missing from ${SPEC_PATH}`);
  return SPEC.params[id].value;
};
/** expectation {value, tolerance} */
const E = (id) => {
  if (!SPEC.expectations[id]) throw new Error(`spec expectation ${id} missing from ${SPEC_PATH}`);
  return SPEC.expectations[id];
};

const GAME_URL = process.env.GAME_URL || 'http://127.0.0.1:4173/index.html';

async function openGame(page) {
  page.on('pageerror', (err) => { throw new Error(`page error in game build: ${err.message}`); });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => window.__smb3 && window.__smb3.apiVersion === 1, null, { timeout: 10_000 });
}

/**
 * Reset the game, then run input segments. Each segment is
 *   { frames: n, input: {right:true,B:true} }          same input every frame, or
 *   { frames: n, inputs: [{...}, {...}, ...] }         one object per frame.
 * Returns { initial, trace } where trace[i] is the state after frame i+1.
 * Everything runs inside one page.evaluate so it is deterministic and fast.
 */
async function run(page, resetOpts, segments) {
  return page.evaluate(({ resetOpts, segments }) => {
    const g = window.__smb3;
    const initial = g.reset(resetOpts);
    const trace = [];
    for (const s of segments) {
      const out = g.step(s.frames, s.inputs || s.input || {});
      if (!Array.isArray(out) || out.length !== s.frames) throw new Error('step() must return one state per frame');
      trace.push(...out);
    }
    return { initial, trace };
  }, { resetOpts, segments });
}

/** expect |actual - e.value| <= e.tolerance with a readable message */
function expectNear(actual, e, label) {
  const msg = `${label}: expected ${e.value} ±${e.tolerance} ${e.unit || ''}, got ${actual}`;
  expect(Math.abs(actual - e.value), msg).toBeLessThanOrEqual(e.tolerance + 1e-9);
}

const firstIndex = (arr, pred) => { for (let i = 0; i < arr.length; i++) if (pred(arr[i], i)) return i; return -1; };

module.exports = { SPEC, P, E, openGame, run, expectNear, firstIndex };
