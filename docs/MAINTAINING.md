# Maintaining Courier

This guide is for maintainers and for engineers (and Claude Code sessions) picking up the work.

## Daily workflow

```bash
npm install && npm run install:browsers     # first time
npm start                                   # play at http://127.0.0.1:4173/
npm run verify                              # the gate: must exit 0
```

Work in small steps: failing test → minimal change → `npm run verify`. See [VERIFICATION.md](VERIFICATION.md) and
[CLAUDE.md](../CLAUDE.md).

## Repository layout

| Path | Purpose | Edit freely? |
|---|---|---|
| `index.html`, `game.js`, `render.js` | Newest build | yes |
| `spec/` | Numbers the tests read | only with a cited source (JSON first) |
| `harness/tests/` | The suites | yes, never weaken |
| `tools/` | Dev server, scoring, screenshots | yes |
| `iterations/` | Frozen history | **no**: only via `npm run snapshot` |
| `docs/` | Docs and README images | yes |
| `.github/` | CI and templates | yes |
| `.claude/commands/` | Shared Claude Code slash commands | yes |

## Iterations and the scoreboard

- **Root is the newest iteration.** Older ones are frozen under `iterations/iter-NN/` (three files each).
- Before you overwrite a milestone build, freeze it: `npm run snapshot -- iter-06 "what this build is"`. This copies
  `index.html`, `game.js`, `render.js` into `iterations/iter-06/`, scores that copy and records it.
- `npm run score -- iter-03` re-scores an old iteration against the current suite (useful for regressions).
- Never edit files inside `iterations/` by hand, apart from adding screenshots with `tools/shots.js iter-NN`.
- Currently the repo root is **iter-05** (it has not been snapshotted, because it is the live build).

## Changing physics

1. Find the entry in `spec/physics-spec.json` (`params` and `expectations`). The tests read both.
2. Update the value **with a source URL and a confidence label** in both the JSON and `spec/physics-spec.md`
   (and the Conflicts section if sources disagree).
3. Update the constant in the `C` table in `game.js` (the comment carries the spec id).
4. `npm run verify`. Derived expectations (jump heights, P-meter timing) are medium confidence and are checked
   against the engine, so recompute them if a base value changes.

## Adding content

- **Tile or enemy:** add the legend character in `parseLevel`, behaviour in `game.js`, sprite in `render.js`
  (`SHEET` and `enemySprite`/`tileSprite`), then tests in `course.spec.js` and `visual.spec.js` (distinctness,
  palette budget). Update the legend table in [ARCHITECTURE.md](ARCHITECTURE.md) and the hook doc if types change.
- **Hero pose:** add it to `HERO_POSES` and `hero()` in `render.js`, to `heroPose()` for selection, and extend the
  pose tests (`V15`/`V16`).
- **Level edits:** the course is built in `courseRows()`. After editing, the `[course-layout]` counts and the
  `[playthrough]` planner must still pass.

## Dependencies

The only dependency is `@playwright/test`, pinned in `package.json`. To upgrade:

```bash
npm install -D @playwright/test@<version>
npm run install:browsers
npm run verify
```

CI (`.github/workflows/ci.yml`) runs the same `npm run verify` on every push and pull request.

## Releasing

1. `npm run verify` is green on `main`.
2. Move *Unreleased* entries in `CHANGELOG.md` under a new version heading with the date.
3. Bump `version` in `package.json` (SemVer; pre-1.0 minors may change behaviour).
4. Optionally freeze the build: `npm run snapshot -- iter-NN "release vX.Y.Z"`.
5. Tag: `git tag vX.Y.Z && git push --tags`, then create a GitHub release from the changelog entry.

## Legal hygiene (check on every PR that adds assets)

- Original art/sound/levels only. No traced or recreated commercial characters, sprites, music or layouts.
- No ROM data or data extracted from ROMs in the repo. Spec numbers must come from public documentation or your
  own measurements, with a cited source.
- Keep the README disclaimer: not affiliated with any game publisher or console maker.
- New source files carry `// SPDX-License-Identifier: MIT`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Tests pass/fail inconsistently with the code | Another server holds port 4173 and serves a different folder. `lsof -ti tcp:4173`, stop it, retry |
| `[playthrough]` fails after a level change | The course became unfair or uncompletable. `node tools/shots.js root` to see progress; widen landing zones |
| A new test "fails" immediately | Micro-level has no `P`, or the camera scrolled and despawned enemies (see CLAUDE.md pitfalls) |
| Visual palette test fails | A new sprite or effect added colours: reduce colours, or avoid alpha/gradients |
| `npm run verify` cannot parse the report | Playwright crashed before reporting. Run `npx playwright test` to see the raw error |
| Chromium missing | `npm run install:browsers` |
