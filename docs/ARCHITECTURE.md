# Architecture

Courier is three browser files and a test harness.

```
index.html        canvas + script tags
render.js         sprites, tiles, bitmap font, drawing   (reads state, never writes it)
game.js           simulation, level data, hook, realtime loop, sound
```

## Simulation (`game.js`)

- **Fixed timestep.** One `stepFrame(pad)` = one NES frame (60.0988 Hz). The realtime loop accumulates wall time and
  calls `stepFrame` zero or more times per animation frame. The hook calls it directly, so tests never depend on
  the clock.
- **Integer subpixels.** Positions are stored in 1/16 px (`S = 16`); velocities are subpixels per frame. Floats never
  enter physics. `snapshot()` converts to px for tests.
- **Frame order** (spec `v.order`; do not reorder without evidence):
  1. advance the 16-frame acceleration counter
  2. apply last frame's x velocity, resolve x collision, apply y velocity (fall clamp first)
  3. horizontal control (accel / skid / friction), then jump + gravity, then the P-meter
  4. vertical collision (head bump or landing), ledge check
  5. timers, then entities (stomp / hurt / shell logic), then world (coins, goal, level timer, camera)
- **Level data.** A level is an array of equal-length strings parsed by `parseLevel` (legend below). Scenarios
  (`flat`, `drop`, `stomp-walker`, `walker-walk`, `course-1-1`) and ad-hoc `level` arrays share one parser.
- **Entities** are plain objects (`type`, `state`, `x`, `feet`, `vx`, `vy`, ...) updated in order. Enemies are
  inactive until the camera approaches and despawn well behind it. Entity `type` strings (`walker`, `shellback`,
  `shellback_red`, `winged_walker`, `hopper`, `plant`, `orb`, `pswitch`) are part of the test contract.
- **Determinism.** No randomness or wall-clock reads in simulation. `W.silent` mutes sound in hook mode.

### Level legend

| Char | Meaning | Char | Meaning |
|---|---|---|---|
| `.` | empty | `#` | ground (grass top when exposed) |
| `B` | brick | `S` | switch brick (releases the switch) |
| `?` | coin block | `M` | item block (growth item) |
| `W` | wood block | `U` | used block |
| `=` | one-way platform | `L` `R` / `l` `r` | pipe top / body |
| `o` | coin | `G` | goal card box |
| `P` | player start | `p` | pre-placed switch (test aid) |
| `g` | walker | `w` | winged walker |
| `k` | green shellback | `K` | red shellback (turns at ledges) |
| `h` | hopper (winged shellback) | `f` | plant (cell above a pipe's top-left) |

## Rendering (`render.js`)

- Sprites are painted at load from tiny rectangle painters, outlined automatically, and cached as canvases
  (original art; no external files). `SHEET` holds frames; the hero has 12 poses in `HERO_POSES`.
- NES-style discipline is enforced by tests: flat colours, binary alpha, 16-px grid, per-sprite colour budgets.
- `render(W, opts)` accepts `{ hero, enemies, hud }` flags so tests can diff frames with and without an element.
- A 3x5 bitmap font draws the HUD, which keeps the screen palette small and edges crisp.

## Test hook (`window.__smb3`)

The only surface the harness touches: `reset`, `step`, `getState` (required) plus optional `getCourseSummary`,
`probe`, `frame`, `sprites`, `advance`, `snap`, `restore`. Full contract in [GAME-HOOK.md](GAME-HOOK.md).

## Harness

`harness/tests/*.spec.js` drive the hook; `tools/score.js` aggregates results per group; `iterations/` stores
frozen builds. See [VERIFICATION.md](VERIFICATION.md).
