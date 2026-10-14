# Contributing to Courier

Thanks for helping. This project has one unusual rule: **the verification suite is the source of truth.** A change
is good when the suite still passes and, for new behaviour, when new tests describe it.

## Getting set up

```bash
npm install
npm run install:browsers
npm run verify          # must print 96/96 (or more) before you start
```

Node 18 or newer. The only dependency is `@playwright/test` (dev only, pinned).

## Workflow

1. **Open an issue first** for anything bigger than a bug fix, so we can agree on scope.
2. **Write the failing test first.** Gameplay rules go in `harness/tests/course.spec.js`, visual constraints in
   `visual.spec.js`, physics numbers in `spec/physics-spec.json` (the physics tests read their numbers from it).
3. Make the smallest change that passes. Run `npm run verify`. The exit code must be 0.
4. Update the docs you touched and add a line under *Unreleased* in [CHANGELOG.md](CHANGELOG.md).
5. Open a pull request using the template. Keep it to one logical change.

Details for each step are in [docs/MAINTAINING.md](docs/MAINTAINING.md) and
[docs/VERIFICATION.md](docs/VERIFICATION.md).

## Ground rules for code

- **Determinism.** No `Math.random()` and no `Date.now()` in simulation code. The sim advances only through
  `tick`/`step`. Seed anything random in `reset`.
- **Physics in subpixels.** Velocities are integers in 1/16 px per frame. Name the spec id in a comment next to
  every constant (`// v.gravity`).
- **Simulation and rendering stay separate.** `render.js` reads state and never changes it.
- **Do not weaken a test to make it pass.** If a test looks wrong, say why in the PR. Several early failures in
  this project were mistakes in test levels, and the fix was to correct the level, not the game.
- Keep it a static site: no bundler, no transpiler, no runtime dependencies.
- Add `// SPDX-License-Identifier: MIT` to new source files.

## Art, sound and trademarks (important)

Contributions **must be your own original work** or under a licence compatible with MIT, with the licence
recorded in the pull request. Do not submit:

- sprites, tiles, music, sound effects or level layouts taken or traced from any commercial game,
- recreations of existing characters, enemies or logos from commercial games, however they were produced,
- ROM dumps, frame dumps or data extracted from ROMs.

Behavioural numbers (speeds, gravity, timers) may be added to the spec when you cite a public source and a
confidence label.

## Commit and PR conventions

Short imperative subject lines (`Add shell pickup`), a body that says *why*, and a reference to the issue.
By contributing you agree your work is released under the [MIT License](LICENSE).

## Code of conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
