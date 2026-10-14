# Test hook contract (`window.__smb3`)

The harness never waits on wall-clock time and never reads a reference image. It drives the game through one global
object and asserts on the numbers it returns. The reference implementation is the hook at the bottom of
[`game.js`](../game.js).

- **v1** (required): `apiVersion`, `reset`, `step`, `getState`.
- **v1.1** (optional, used by course and visual tests): `getCourseSummary`, `probe`, `frame`, `sprites`.
- **v1.2** (optional, used by the planner): `advance`, `snap`, `restore`.

The game reports `apiVersion: 1` and `hookMinor: 2`.

## Required members

```js
window.__smb3 = {
  apiVersion: 1,
  reset(opts)          -> State,     // stop the realtime loop, build the scenario/level, return frame 0
  step(frames, input)  -> State[],   // exactly `frames` fixed steps; one State per frame, taken at frame end
  getState()           -> State,
};
```

### `reset(opts)`

| Field | Type | Meaning |
|---|---|---|
| `scenario` | string | `flat`, `drop`, `stomp-walker`, `walker-walk`, `course-1-1` |
| `level` | string[] | ad-hoc ASCII level instead of a scenario (legend in [ARCHITECTURE.md](ARCHITECTURE.md)) |
| `powerup` | `'small'` \| `'big'` | starting form (default small) |
| `wiggly`, `power` | number, `'full'` | optional: acceleration-counter phase, preload the P-meter |

Calling it twice with the same options must give identical futures. No `Math.random()` / `Date.now()` in gameplay.

### `step(frames, input)`

`input` is one object applied every frame, or an array of `frames` objects:
`{ left, right, up, down, A, B }` (booleans). `A` jumps (a new press is needed), `B` runs.

### `State`

```js
{
  frame, score, time, coins, lives, cleared, card, switchActive, camX,
  player: { x, y, feetY, vx, vy, onGround, powerup, pMeter, pMeterRaw, facing, dead, killTally, invuln },
  entities: [{ id, type, x, y, vx, vy, state, winged }],
  debug: { accelCounter, pTimer, flyTime }
}
```

**Units:** positions in px (y grows down, `feetY` is the bottom of the box); **velocities in subpixels per frame
(1/16 px per frame)**. Walking speed is `24`, not `1.5`. Velocities are reported at the end of the frame.
During a fall the read-out may reach 69 although displacement is clamped at 64 (spec conflict C3).

## Optional v1.1 members

| Member | Returns |
|---|---|
| `getCourseSummary()` | `{ widthPx, heightPx, timer, timerPeriod, enemies{...}, coinsInAir, coinBlocks, itemBlocks, bricks, switchBricks, brickCoins, goalX }` |
| `probe(x, y)` | the level character at a pixel position (read-only) |
| `frame(opts)` | render the current state; `opts` = `{ hero, enemies, hud }` booleans (default true) so tests can diff frames |
| `sprites()` | per sprite name, per frame: `{ w, h, colors, alphaOk, hash, shape, bbox }` |

## Optional v1.2 members (planning)

| Member | Purpose |
|---|---|
| `advance(frames, input)` | like `step` but returns only the final State and does not render (fast) |
| `snap()` | returns an opaque, deep-cloned copy of the whole game state |
| `restore(snap)` | replaces the game state with a clone of `snap` |

## Rules

- The hook only forwards input and reports state. Do not compute physics in it.
- Do not special-case test scenarios in physics code; scenarios are spawn layouts only.
- The hook may be left out of a production bundle behind a flag.
