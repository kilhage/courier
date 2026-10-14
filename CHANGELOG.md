# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/). Pre-1.0, minor versions may change behaviour.

## [Unreleased]

### Added
- On-screen touch controls for phones (multi-touch, landscape and portrait layouts) and a `[touch]` test suite (5 tests).

## [0.5.0] - 2026-10-14

First public release. This is iteration 5 of the build; iterations 1-4 are kept under `iterations/`.

### Added
- Playable course with five enemy types, bumpable blocks, a growth item, a P-switch, a timer, a goal card and score.
- Fixed-timestep, integer-subpixel simulation matching `spec/physics-spec.json` (35 physics tests).
- Gameplay verification suite (37 tests) using ASCII micro-levels, plus a beam-search planner that proves the
  course is completable.
- Visual verification suite (19 tests): sprite/hitbox contracts, NES-style palette budget, animation and mirroring.
- Original pixel-art renderer with a 12-pose hero, bitmap font and synthesised sound.
- Test hook contract v1 with optional v1.1 (`getCourseSummary`, `probe`, `frame`, `sprites`) and v1.2
  (`advance`, `snap`, `restore`) members.
- Tooling: `npm run verify`, `npm run snapshot`, `tools/shots.js`, `tools/heroSheet.js`.

### Known gaps
- No leaf/flight power-up, sky bonus area or bonus pipe room.
- No shell pickup with B; a bumped shellback does not flip.
- Crouching is visual only (hitbox unchanged).
- Medium-confidence physics values are listed in `spec/physics-spec.md`.

[Unreleased]: https://github.com/OWNER/courier/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/OWNER/courier/releases/tag/v0.5.0
