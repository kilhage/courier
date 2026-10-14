# CLAUDE.md: working on Courier with Claude Code

Courier is a browser platformer (static site, no build step) whose behaviour is **specified numerically** in
`spec/physics-spec.json` and **verified by 91 deterministic Playwright tests**. Your job in this repo is usually
to *climb the score*: add a failing test for a missing behaviour, make it pass, keep everything else green.

## Setup (once per machine)

```bash
npm install
npm run install:browsers          # Chromium for Playwright
```

## The verification loop (run this a lot)

| Command | What it does |
|---|---|
| `npm run verify` | Runs every suite against the **root build**, prints a score per group, exits 1 on any failure |
| `npx playwright test -g "<title fragment>"` | One test, fast. Add `--reporter=line` for compact output |
| `npm run test:physics` / `test:course` / `test:visual` | One suite |
| `npm start` | Serve the repo at http://127.0.0.1:4173/ (root = latest build, `/iterations/iter-NN/` = old builds) |
| `npm run snapshot -- iter-NN "label"` | Freeze the CURRENT root into `iterations/iter-NN/`, score it, record in `iterations/scoreboard.json` |
| `npm run shots` | Screenshots + hero contact sheet into `reports/shots/` (needs `npm start` running) |

`/verify` is a slash command that runs the loop and walks through failures.

**Protocol for any change**

1. `npm run verify` first. It must be 91/91 (or more) before you start. If it is not, fix that first.
2. Write the failing test **before** the code (gameplay → `harness/tests/course.spec.js`, look → `visual.spec.js`,
   physics numbers → `spec/physics-spec.json`, then the constant in `game.js`).
3. Change `game.js` / `render.js`. Re-run the single test, then the full `npm run verify`.
4. If the score went up and the previous root was a milestone, run `npm run snapshot -- iter-NN "label"` **before**
   you overwrite it for the next change (root is always the newest iteration; older ones live in `iterations/`).
5. Update `CHANGELOG.md` (*Unreleased*) and any doc you touched.

## Guardrails (do not break these)

- **Never weaken or delete a test to get green.** If a test looks wrong, find out why first. Several of this
  project's failures were mistakes in the test level, not the game.
- **Do not edit expected spec numbers to match the game.** Change a number only with a cited public source and a
  confidence label, in `spec/physics-spec.json` *first*, then the constant in `game.js`.
- **Determinism.** No `Math.random()` / `Date.now()` in simulation code. Sim advances only via the hook/`stepFrame`.
- **Original assets only.** All art, sound and levels must be original. **Do not draw, trace or recreate characters,
  sprites, music or level layouts from any commercial game**, even from memory and even if asked. If a user wants
  specific licensed art, the supported route is a sprite-pack override they provide (not built yet: see backlog).
  The behaviour numbers in the spec are fine; the creative expression is not.
- Keep it a static site: no bundler, no runtime deps. Add `// SPDX-License-Identifier: MIT` to new source files.
- `render.js` never mutates game state. Sprites stay within the palette budgets (≤7 colours per hero sprite,
  ≤8 per other sprite, ≤48 on screen, no alpha, no gradients). The visual suite enforces this.

## Where things are

| Path | What |
|---|---|
| `index.html`, `game.js`, `render.js` | The newest build. `game.js` = simulation + hook + realtime loop; `render.js` = sprites, font, drawing |
| `spec/` | `physics-spec.json` (tests read it), `physics-spec.md` (human version, sources, conflicts) |
| `harness/tests/` | `physics.spec.js` (35), `course.spec.js` (37), `visual.spec.js` (19), `lib/hook.js` helpers |
| `tools/` | `serve.js`, `score.js`, `shots.js`, `heroSheet.js` |
| `iterations/` | Frozen older builds, `scoreboard.json`, per-iteration screenshots |
| `docs/` | `ARCHITECTURE.md`, `VERIFICATION.md`, `MAINTAINING.md`, `GAME-HOOK.md`, `fidelity-checklist.md` |

## Common test pitfalls (all of these happened)

- **A micro-level needs a `P` (player start).** Without one the player spawns off-map, falls and dies on frame ~1,
  and a dead player freezes every enemy. The test then "fails" for the wrong reason.
- **The camera follows the player; enemies more than 64 px behind the camera despawn.** A far-right `P` in a
  small level scrolls the camera and removes enemies near the left. Keep `P` near what you test.
- **Enemies are inactive until within ~288 px of the right edge of the camera**, so an enemy placed far right of the
  start does nothing in a short test.
- `mini()` in `course.spec.js` gives 6 free rows + 2 floor rows (floor top y = 96). `P` belongs on row 5.
- Standing under a block: head bump needs `A` held; `mini(['', '', '.....B', '', '', '.....P'])` is the pattern.
- To hit a stomp, place the player **above** the enemy (same column, row 1) so it falls onto it.
- `npx playwright test` reuses whatever is already on port 4173 (`reuseExistingServer`). A stale server from another
  folder silently tests the wrong tree. Check with `lsof -ti tcp:4173`.
- The planner test (`[playthrough]`) takes seconds and fails if the course becomes unfair or uncompletable. If it
  fails after a level edit, run `node tools/shots.js root` to see how far it got, or widen landing zones.

## Open backlog (next iterations)

Write the failing tests first, then climb. Each item is a candidate for `iter-06`:

1. **Leaf power-up and flight** (needs a spec section first: tail-wag and fly constants are only noted in
   `docs/fidelity-checklist.md` H7, unverified). Unlocks the sky bonus area and the "3" pipe room (checklist F1-F3).
2. **Pick up a shell with B and carry it** (checklist C13); a bumped shellback should flip (D7 shellback case).
3. **Real duck hitbox** for the big form (crouch is visual only today).
4. **Music** (only synthesised sound effects exist today; must stay original).
5. **Sprite-pack override** so owners of licensed art can supply a PNG sheet; extend `visual.spec.js` to validate it.
6. Raise medium-confidence spec values to high with measured evidence (list in `spec/physics-spec.md`).
7. Guessed values still in the game: invulnerability length, squash time, plant timing, card roulette speed,
   switch duration. All flagged GUESSED in `docs/fidelity-checklist.md`.

## Style

Match the surrounding code: 2-space indent, single quotes, constants in the `C` table with the spec id in a comment,
small functions, no clever abstractions. Prefer editing existing tests/helpers to adding new frameworks.
