# The verification loop

Everything the game does is checked by tests that drive it **frame by frame** and compare it with numbers in
[`spec/physics-spec.json`](../spec/physics-spec.json). Nothing depends on wall-clock time or on pixels of a
reference image.

```
spec/physics-spec.json ──▶ harness/tests/*.spec.js ──drives──▶ window.__smb3 (game.js) ──▶ state / canvas pixels
                                   │
                                   └──▶ tools/score.js ──▶ score per group ──▶ iterations/scoreboard.json
```

## Suites

| Group(s) | File | Tests | What it proves |
|---|---|---|---|
| timing, horizontal, deceleration, vertical, pmeter, stomp, enemies | `physics.spec.js` | 35 | Speeds, 14-of-16-frame acceleration, skid, friction, jump heights, gravity, fall cap, P-meter timing, stomp and bounce, walker speed. Numbers come from the spec JSON; nothing numeric is hard-coded in the test |
| course-frame, course-layout, enemies, blocks, goal, playthrough | `course.spec.js` | 37 | Timer (300, 41 frames/unit, 0 kills), pit death, determinism, enemy/coin/block counts, shell kick and slide, ledge turning, wing loss, plant cycle, block bumping, item growth, one-way platforms, switch, goal and time bonus, and **completability** |
| touch | `touch.spec.js` | 5 | On-screen controls: visible and sized for fingers, multi-touch drives the same inputs as the keyboard, page cannot scroll or zoom |
| visual-style, visual-sprites, visual-motion, visual-hero | `visual.spec.js` | 19 | Palette budget (≤48 colours on screen, ≤8 per sprite, binary alpha), sprite sizes vs hitboxes, 12 distinct hero poses and silhouettes, mirroring, enemy visibility and distinctness, render determinism, camera scroll, HUD contrast ≥ 4.5 |

Run them with `npm run verify` (all, with a per-group table) or `npm run test:physics|course|visual`.

## How a test works

```js
const { run } = require('./lib/hook');
const { trace } = await run(page, { scenario: 'flat' }, [{ frames: 90, input: { right: true } }]);
// trace[i] is the full state after frame i+1; assert on it
```

- `run(page, resetOpts, segments)` resets the game and replays input segments inside **one** `page.evaluate`.
- `resetOpts` is `{ scenario }` or `{ level: [rows...] }` plus `powerup: 'big'`.
- Gameplay tests use **ASCII micro-levels** (`mini([...])` in `course.spec.js`) so each rule is tested alone.
- Visual tests call `__smb3.frame(opts)` and read `getImageData` from the canvas; helpers are injected in
  `visual.spec.js` (`__img`, `__hash`, `__diff`, `__colors`).

## The completability planner

`[playthrough]` runs a beam search over 10-frame macro-actions using `snap()` / `restore()` / `advance()`
(contract v1.2). If it reaches the goal, the course is completable under real physics; if a level edit makes it
unfair, the test fails. `tools/shots.js` replays the winning route and takes screenshots.

## Scoring and iterations

`npm run verify` prints, for example:

```
root build  96/96
  physics groups ... visual groups ...
```

`iterations/scoreboard.json` records frozen builds with their pass counts. **Root is always the newest iteration.**
To keep the current build before replacing it: `npm run snapshot -- iter-NN "label"`. Recorded scores are against
the suite as it was at that time, so totals differ between old rows.

## Reading a failure

1. The title starts with the group in brackets, then a spec or checklist id (for example `D6`, `C12`).
2. Look the id up in `spec/physics-spec.md` or `docs/fidelity-checklist.md` for the value, its source and confidence.
3. Decide **test or game**: see "Common test pitfalls" in [CLAUDE.md](../CLAUDE.md). Many apparent game bugs were a
   missing `P`, a scrolled camera or too few frames.
4. Fix the root cause. If the spec is wrong (you have better evidence), edit the JSON first and cite the source.

## Adding a test (recipe)

1. Find or add the rule in the spec or checklist.
2. Write the smallest micro-level that isolates it. Put `P` near the action.
3. Run the single test with `npx playwright test -g "<title>" --reporter=line` and confirm it fails for the
   **right reason**.
4. Implement, re-run, then `npm run verify`.

## Confidence and limits

"Passes the harness" means "matches the spec", not "matches any original game". Medium-confidence values and
guessed values are listed in `spec/physics-spec.md` and `docs/fidelity-checklist.md`. Settling them needs
measurement evidence the maintainers legally own; do not paste ROM-derived data into this repo.
