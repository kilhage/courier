// SPDX-License-Identifier: MIT
/*
 * "Courier" - a browser platformer built to match the SMB3-style physics in physics-spec.json.
 * Original art and sound (drawn/synthesised in code). Level layout is original.
 * Units: positions are integer 1/16-px; velocities are subpx/frame (1/16 px per frame).
 * Deterministic: gameplay never uses Math.random()/Date.now(); advance only via tick().
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------ constants (spec ids in comments)
  const C = {
    WALK_MAX: 24, RUN_MAX: 40, P_MAX: 56, ABS_MAX: 64,          // h.walk_max h.run_max h.pspeed_max h.abs_max
    ACCEL_MAIN: 0, ACCEL_FRAC: 0xE0, SKID_MAIN: 2,               // h.accel_normal d.skid
    FRICTION_FRAC: { small: 0x60, big: 0x20 },                   // d.friction_small / d.friction_big
    WIGGLY_STEP: 0x90,                                           // h.accel_counter
    JUMP_VY: -56, JUMP_BONUS: [0, 2, 4, 8],                      // v.jump_vy v.jump_speed_bonus
    GRAV_HELD: 1, GRAV: 5, GRAV_THRESHOLD: -32, FALL_CAP: 64,    // v.gravity_held v.gravity v.gravity_threshold v.fall_cap
    P_GAIN_RELOAD: 8, P_LOSS_RELOAD: 24, P_FULL_HOLD: 16, FLY_TIME: 0x80, // p.*
    STOMP_VY: -64, STOMP_WINDOW: 13,                             // s.bounce_vy s.stomp_window
    CHAIN: [100, 200, 400, 800, 1000, 2000, 4000, 8000, '1UP'],  // s.chain
    WALKER_VX: 8, OBJ_GRAV: 3, OBJ_MAXFALL: 64,                  // e.walker_vx e.object_gravity
    SHELL_VX: 48, ITEM_VX: 16,                                   // e.shell_kick_vx e.mushroom_vx
    TIMER_START: 300, TIMER_PERIOD: 41,                          // checklist A2/A3
    INVULN: 120, SQUASH: 30, HOP_VY: -48, HOP_EVERY: 50,         // GUESSES (checklist E8 etc.)
    CARD_PERIOD: 8, SWITCH_FRAMES: 480, KICK_GRACE: 8,           // GUESSES (G7, D4)
    PLANT_HIDE: 90, PLANT_UP: 70, PLANT_MOVE: 16, PLANT_H: 24,   // GUESSES (C15)
  };

  const S = 16, T = 16, TS = T * S;
  const SOLID = '#BM?WSULRlr';
  const NO_INPUT = { left: false, right: false, up: false, down: false, A: false, B: false };
  const popcount = (v) => { let c = 0; while (v) { c += v & 1; v >>= 1; } return c; };
  const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

  // ------------------------------------------------------------------ levels
  // Legend: . empty  # ground  B brick  ? coin block  M item block  W wood  S switch brick  = one-way platform
  //         L R pipe top  l r pipe body  o coin  G goal box  P player start
  //         g walker  w winged walker  k green shellback  K red shellback  h hopper  f plant (cell above pipe top-left)
  function grid(w, h) { const g = []; for (let r = 0; r < h; r++) g.push(new Array(w).fill('.')); return g; }
  function flatRows(w, h, floorRow) {
    const g = grid(w, h);
    for (let r = floorRow; r < h; r++) for (let c = 0; c < w; c++) g[r][c] = '#';
    return g.map((r) => r.join(''));
  }

  function courseRows() {
    const w = 132, h = 15, g = grid(w, h);
    const set = (c, r, ch) => { if (g[r] && c >= 0 && c < w) g[r][c] = ch; };
    const fill = (c0, c1, r0, r1, ch) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) set(c, r, ch); };
    const coins = (c0, c1, r) => fill(c0, c1, r, r, 'o');
    const pipe = (c, topRow, withPlant) => {
      set(c, topRow, 'L'); set(c + 1, topRow, 'R');
      for (let r = topRow + 1; r <= 12; r++) { set(c, r, 'l'); set(c + 1, r, 'r'); }
      if (withPlant) set(c, topRow - 1, 'f');
    };
    fill(0, w - 1, 13, 14, '#');
    fill(66, 68, 13, 14, '.');               // pit A (3 wide)
    fill(86, 87, 13, 14, '.');               // pit B (2 wide)
    fill(70, 80, 11, 12, '#');               // raised ledge for the ledge-turning shellbacks
    // start area: coin/item blocks, first walker, one-way platforms
    set(8, 9, '?'); set(9, 9, 'M'); set(10, 9, '?');
    set(18, 12, 'g');
    fill(14, 17, 10, 10, '=');  coins(14, 17, 9);
    fill(19, 22, 7, 7, '=');    coins(19, 22, 6);
    pipe(26, 10, true);
    set(31, 12, 'k');
    set(34, 12, 'M');                        // sits on the ground: only a sliding shell can hit it
    // flat stretch with walkers and a winged walker
    set(44, 12, 'g'); set(47, 12, 'g'); set(50, 12, 'w');
    fill(40, 45, 9, 9, '='); coins(40, 43, 8);
    coins(48, 50, 8);
    set(52, 9, '?'); set(53, 9, '?');
    // brick stack with the switch brick (17 B + 1 S at the corner, plus one extra brick = 18 B)
    fill(56, 61, 10, 12, 'B'); set(56, 10, 'S'); set(55, 12, 'B');
    // pit A, coin arc, ledge with two red shellbacks, item block
    coins(65, 69, 10);
    set(76, 10, 'K'); set(79, 10, 'K'); coins(72, 77, 7);   // shellbacks sit deeper so the landing from the pit is safe
    set(80, 8, 'M');
    // pit B, hoppers
    set(92, 12, 'h'); set(95, 12, 'h'); set(98, 12, 'h'); coins(92, 93, 6);
    set(101, 12, 'g');
    set(100, 8, '?');
    // late section: pipe, coins, wood stairs, goal
    pipe(104, 9, false);
    coins(108, 110, 9); coins(114, 116, 8);
    for (let k = 0; k < 4; k++) fill(112 + k, 112 + k, 12 - k, 12, 'W');
    set(124, 12, 'G');
    return g.map((r) => r.join(''));
  }

  function parseLevel(rowsIn) {
    const rows = rowsIn.length, cols = Math.max.apply(null, rowsIn.map((r) => r.length));
    const L = { cols, rows, grid: [], spawns: [], coins: [], start: null, goal: null };
    for (let r = 0; r < rows; r++) {
      L.grid.push([]);
      for (let c = 0; c < cols; c++) {
        const ch = rowsIn[r][c] || '.';
        let tile = ch;
        if ('owkKhgfGPp'.indexOf(ch) >= 0) {
          tile = '.';
          if (ch === 'o') L.coins.push({ c, r, taken: false, fromBrick: false });
          else if (ch === 'G') L.goal = { c, r };
          else if (ch === 'P') L.start = { c, r };
          else if (ch === 'p') L.spawns.push({ type: 'pswitch', c, r });
          else L.spawns.push({ type: { g: 'walker', w: 'winged_walker', k: 'shellback', K: 'shellback_red', h: 'hopper', f: 'plant' }[ch], c, r });
        }
        L.grid[r].push(tile);
      }
    }
    return L;
  }

  const SCENARIOS = {
    'flat': { rows: () => flatRows(400, 15, 12), player: { x: 32, feetY: 192 } },
    'drop': { rows: () => flatRows(400, 45, 40), player: { x: 32, feetY: 100 } },
    'stomp-walker': { rows: () => flatRows(400, 15, 12), player: { x: 100, feetY: 128 }, enemies: [{ type: 'walker', x: 100, dir: 'left' }] },
    'walker-walk': { rows: () => flatRows(400, 15, 12), player: { x: 32, feetY: 192 }, enemies: [{ type: 'walker', x: 160, dir: 'left' }] },
    'course-1-1': { rows: courseRows },
  };

  // ------------------------------------------------------------------ world
  let W;
  let session = { lives: 4, score: 0, coins: 0 };
  let nextId = 0;

  function mkEnt(type, x, feet, dir) {
    const e = { id: nextId++, type, x, feet, vx: 0, vy: 0, state: 'walking', timer: 0, active: false, winged: type === 'winged_walker' || type === 'hopper', grace: 0, chain: 0, h: 16 };
    if (type === 'plant') { e.state = 'hidden'; e.timer = C.PLANT_HIDE; e.rise = 0; e.baseFeet = feet; e.active = true; return e; }
    e.vx = dir === 'right' ? C.WALKER_VX : -C.WALKER_VX;
    return e;
  }

  function makeWorld(opts) {
    opts = opts || {};
    nextId = 0;
    let rows, sc = null;
    if (opts.level) rows = opts.level;
    else { sc = SCENARIOS[opts.scenario || 'flat']; if (!sc) throw new Error('unknown scenario ' + opts.scenario); rows = sc.rows(); }
    const L = parseLevel(rows);
    const keep = !!opts.keepSession;
    const fresh = { lives: 4, score: 0, coins: 0 };
    const sess = keep ? session : fresh;
    const powerup = opts.powerup || 'small';
    let px, feet;
    if (sc && sc.player) { px = sc.player.x * S; feet = sc.player.feetY * S; }
    else if (L.start) { px = L.start.c * TS; feet = (L.start.r + 1) * TS; }
    else { px = 2 * TS; feet = 13 * TS; }
    const w = {
      frame: 0, wiggly: (opts.wiggly || 0) & 0xF0, level: L, prevPad: Object.assign({}, NO_INPUT),
      camX: 0, time: C.TIMER_START, timeCnt: C.TIMER_PERIOD - 1, lives: sess.lives, coins: sess.coins,
      cleared: false, clearT: 0, card: null, bumps: [], parts: [], pops: [], switchT: 0, deadT: 0, bonusPaid: 0,
      p: {
        x: px, feet, vx: 0, vy: 0, inAir: !(L.rows * TS > feet && supportedAt(L, px, feet)), powerup,
        power: 0, pCnt: 0, runFlag: 0, flyTime: 0, killTally: 0, score: sess.score, dead: false, invuln: 0, facing: 1, anim: 0,
      },
      ents: [],
    };
    W = w;
    for (const sp of L.spawns) {
      const e = mkEnt(sp.type, sp.c * TS, (sp.r + 1) * TS, 'left');
      if (sp.type === 'plant') { e.x = sp.c * TS + 0; e.baseFeet = (sp.r + 1) * TS + 0; e.feet = e.baseFeet; }
      if (sp.type === 'pswitch') { e.state = 'idle'; e.vx = 0; e.active = true; }
      w.ents.push(e);
    }
    if (sc && sc.enemies) for (const s of sc.enemies) {
      const e = mkEnt(s.type, s.x * S, 12 * TS, s.dir); e.active = true; w.ents.push(e);
    }
    if (opts.power === 'full') w.p.power = 0x7F;
    return w;
  }

  function supportedAt(L, x, feet) {
    if (feet % TS) return false;
    const r = feet / TS, c0 = Math.floor(x / TS), c1 = Math.floor((x + 16 * S - 1) / TS);
    for (let c = c0; c <= c1; c++) { const ch = tileAt(L, c, r); if (SOLID.indexOf(ch) >= 0 || ch === '=') return true; }
    return false;
  }
  function tileAt(L, c, r) {
    if (c < 0 || c >= L.cols) return r >= 0 && r < L.rows ? '#' : '.';
    if (r < 0 || r >= L.rows) return '.';
    return L.grid[r][c];
  }
  const solidAt = (c, r) => SOLID.indexOf(tileAt(W.level, c, r)) >= 0;
  const semiAt = (c, r) => tileAt(W.level, c, r) === '=';
  const height = (p) => (p.powerup === 'small' ? 16 : 32);

  // ------------------------------------------------------------------ audio (original, synthesised)
  let actx = null, muted = false;
  function sfx(f0, f1, dur, type, vol) {
    if (muted || W.silent) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = type || 'square'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      g.gain.setValueAtTime(vol || 0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* audio unavailable */ }
  }
  const SFX = {
    jump: () => sfx(300, 700, 0.16), coin: () => { sfx(990, 990, 0.06); setTimeout(() => sfx(1480, 1480, 0.18), 60); },
    stomp: () => sfx(220, 90, 0.12, 'square', 0.06), bump: () => sfx(120, 80, 0.08, 'triangle', 0.08),
    brk: () => sfx(200, 40, 0.2, 'sawtooth', 0.05), item: () => sfx(400, 1200, 0.3, 'triangle', 0.06),
    power: () => sfx(500, 1500, 0.4, 'triangle', 0.06), hurt: () => sfx(400, 100, 0.3, 'sawtooth', 0.05),
    die: () => sfx(500, 60, 0.7, 'square', 0.06), kick: () => sfx(180, 360, 0.1, 'square', 0.05),
    clear: () => sfx(600, 1800, 0.8, 'triangle', 0.06),
  };

  // ------------------------------------------------------------------ player rules (ported from the verified stub)
  function hControl(p, pad, absvx) {
    const B = pad.B;
    let top = C.WALK_MAX;
    if (B) {
      if (!p.inAir && absvx >= C.RUN_MAX) p.runFlag = 1;                 // p.run_condition
      top = p.power === 0x7F ? C.P_MAX : C.RUN_MAX;
    }
    const fr = C.FRICTION_FRAC[p.powerup === 'small' ? 'small' : 'big'];
    const RATES = { F: [-1, fr], N: [C.ACCEL_MAIN, C.ACCEL_FRAC], S: [C.SKID_MAIN, 0] };
    let rate, rightward;
    if (!pad.left && !pad.right) {
      if (p.inAir) return;                                                // d.no_air_friction
      if (p.vx === 0) return;
      rate = 'F'; rightward = p.vx > 0;
    } else {
      const moveLR = p.vx < 0 ? 'left' : p.vx > 0 ? 'right' : null;
      const reversed = (pad.right && moveLR === 'left') || (pad.left && moveLR === 'right');
      if (reversed) rate = 'S';
      else if (absvx === top) return;
      else if (absvx < top) rate = 'N';
      else { if (p.inAir) return; rate = 'F'; }
      rightward = !!pad.right;
      p.facing = pad.right ? 1 : -1;
    }
    const [main, frac] = RATES[rate];
    if (rightward) {
      const carry = (frac + W.wiggly) > 0xFF ? 1 : 0;
      p.vx += main + carry;
    } else {
      const t1 = (0 - frac) & 0xFF;
      let t2 = (~main) & 0xFF;
      if (t1 === 0) t2 = (t2 + 1) & 0xFF;
      const carry = (t1 + W.wiggly) > 0xFF ? 1 : 0;
      p.vx += (t2 >= 128 ? t2 - 256 : t2) + carry;
    }
  }

  function jumpAndGravity(p, pad, prevPad) {
    const newA = pad.A && !prevPad.A;
    if (newA && !p.inAir) {
      p.vy = C.JUMP_VY - C.JUMP_BONUS[Math.min(Math.abs(p.vx) >> 4, 3)];
      p.inAir = true;
      if (p.power === 0x7F && p.flyTime === 0) p.flyTime = C.FLY_TIME;
      SFX.jump();
    }
    if (!p.inAir) { p.flyTime = 0; return; }
    p.vy += (p.vy < C.GRAV_THRESHOLD && pad.A) ? C.GRAV_HELD : C.GRAV;
  }

  function powerUpdate(p) {
    if (p.flyTime) {
      if (W.frame & 1) p.flyTime--;
      if (p.flyTime === 0) p.power = 0;
      p.runFlag = 0;
      return;
    }
    if (p.power === 0x7F && p.runFlag) { p.pCnt = C.P_FULL_HOLD; p.runFlag = 0; return; }
    if (p.pCnt === 0) {
      p.power = p.runFlag ? ((p.power << 1) | 1) & 0x7F : (p.power >> 1);
      if (p.power === 0) p.flyTime = 0;
      else p.pCnt = p.runFlag ? C.P_GAIN_RELOAD : C.P_LOSS_RELOAD;
    }
    p.runFlag = 0;
  }

  function die(p) {
    if (p.dead) return;
    p.dead = true; p.vx = 0; p.vy = 0; W.deadT = 0; SFX.die();
  }
  function hurt(p) {
    if (p.invuln > 0 || p.dead) return;
    if (p.powerup === 'small') die(p);
    else { p.powerup = 'small'; p.invuln = C.INVULN; SFX.hurt(); }
  }

  // ------------------------------------------------------------------ tile collision for the player
  function resolveX(p) {
    const h = height(p) * S, top = p.feet - h;
    const r0 = Math.floor(top / TS), r1 = Math.floor((p.feet - 1) / TS);
    if (p.vx > 0) {
      const c = Math.floor((p.x + 16 * S - 1) / TS);
      for (let r = r0; r <= r1; r++) if (solidAt(c, r)) { p.x = c * TS - 16 * S; p.vx = 0; return; }
    } else if (p.vx < 0) {
      const c = Math.floor(p.x / TS);
      for (let r = r0; r <= r1; r++) if (solidAt(c, r)) { p.x = (c + 1) * TS; p.vx = 0; return; }
    }
  }

  function resolveY(p, feet0) {
    const h = height(p) * S;
    const c0 = Math.floor(p.x / TS), c1 = Math.floor((p.x + 16 * S - 1) / TS);
    const moved = p.feet - feet0;
    if (moved < 0) {                                                   // rising: head bump
      const top = p.feet - h, top0 = feet0 - h;
      for (let r = Math.floor((top0 - 1) / TS); r >= Math.floor(top / TS); r--) {
        let hit = -1; const mid = Math.floor((p.x + 8 * S) / TS);
        if (solidAt(mid, r)) hit = mid; else for (let c = c0; c <= c1; c++) if (solidAt(c, r)) { hit = c; break; }
        if (hit >= 0) { p.feet = (r + 1) * TS + h; p.vy = 0; bump(hit, r, true); return; }
      }
    } else if (p.vy >= 0 && p.inAir) {                                 // falling: land
      const rStart = Math.ceil(feet0 / TS), rEnd = Math.floor(p.feet / TS);
      for (let r = rStart; r <= rEnd; r++)
        for (let c = c0; c <= c1; c++)
          if (solidAt(c, r) || (semiAt(c, r) && feet0 <= r * TS)) {
            p.feet = r * TS; p.vy = 0; p.inAir = false; p.killTally = 0; return;
          }
    }
  }

  // ------------------------------------------------------------------ blocks
  function bump(c, r, byPlayer) {
    const ch = tileAt(W.level, c, r), p = W.p;
    if ('B?MS'.indexOf(ch) < 0) { if (byPlayer && SOLID.indexOf(ch) >= 0) SFX.bump(); return; }
    const big = p.powerup !== 'small';
    if (ch === 'B' && byPlayer && big) { breakBrick(c, r); return; }
    if (ch === 'B' && !byPlayer) { breakBrick(c, r); return; }
    W.bumps.push({ c, r, t: 0 });
    if (ch === 'B') { SFX.bump(); }
    if (ch === '?') { W.level.grid[r][c] = 'U'; addCoin(); W.pops.push({ x: c * T, y: r * T - 8, t: 0 }); SFX.coin(); }
    if (ch === 'M') { W.level.grid[r][c] = 'U'; spawnItem('orb', c, r); SFX.item(); }
    if (ch === 'S') { W.level.grid[r][c] = 'U'; spawnItem('pswitch', c, r); SFX.item(); }
    for (const e of W.ents) {                                          // enemies standing on the bumped block
      if (e.state === 'gone' || e.state === 'flipped' || e.type === 'plant' || e.type === 'orb' || e.type === 'pswitch') continue;
      if (e.feet === r * TS && e.x < (c + 1) * TS && e.x + 16 * S > c * TS) flip(e, 0);
    }
  }
  function breakBrick(c, r) {
    W.level.grid[r][c] = '.'; W.p.score += 50; SFX.brk();
    for (let i = 0; i < 4; i++) W.parts.push({ x: c * T + (i & 1) * 8, y: r * T + (i >> 1) * 8, vx: (i & 1 ? 1 : -1) * (1 + (i >> 1)), vy: -4 - (i >> 1) * 2, t: 0 });
  }
  function spawnItem(type, c, r) {
    const e = mkEnt(type, c * TS, (r + 1) * TS, 'right');
    e.state = 'rising'; e.timer = 16; e.active = true; e.vx = 0;
    e.dir = (W.p.x + 8 * S) < (c * TS + 8 * S) ? 1 : -1;               // E4: direction depends on player's X
    e.targetFeet = r * TS;
    W.ents.push(e);
  }
  function addCoin() {
    W.coins++; W.p.score += 50;
    if (W.coins >= 100) { W.coins -= 100; W.lives++; }
  }

  // ------------------------------------------------------------------ enemies
  function flip(e, dir) { e.state = 'flipped'; e.vy = -32; e.vx = (dir || 1) * 8; }
  function awardChain(p) {
    const a = C.CHAIN[Math.min(p.killTally, C.CHAIN.length - 1)];
    if (a === '1UP') W.lives++; else p.score += a;
    p.killTally++;
  }

  function entTiles(e) {
    return { r0: Math.floor((e.feet - e.h * S) / TS), r1: Math.floor((e.feet - 1) / TS) };
  }
  function walkerStep(e) {
    // vertical
    const grounded = supportedAt(W.level, e.x, e.feet);
    if (e.type === 'shellback_red' && grounded && e.state === 'walking') {            // red shellbacks turn at ledges
      const front = e.vx > 0 ? e.x + 16 * S + 1 : e.x - 1;
      const fc = Math.floor(front / TS), fr = e.feet / TS;
      const ch = tileAt(W.level, fc, fr);
      if (!(SOLID.indexOf(ch) >= 0 || ch === '=')) e.vx = -e.vx;
    }
    // horizontal
    e.x += e.vx;
    const { r0, r1 } = entTiles(e);
    if (e.vx > 0) {
      const c = Math.floor((e.x + 16 * S - 1) / TS);
      for (let r = r0; r <= r1; r++) if (solidAt(c, r)) { e.x = c * TS - 16 * S; wallHit(e, c, r); e.vx = -Math.abs(e.vx); break; }
    } else if (e.vx < 0) {
      const c = Math.floor(e.x / TS);
      for (let r = r0; r <= r1; r++) if (solidAt(c, r)) { e.x = (c + 1) * TS; wallHit(e, c, r); e.vx = Math.abs(e.vx); break; }
    }
    // gravity / landing
    if (!supportedAt(W.level, e.x, e.feet) || e.vy < 0) {
      const f0 = e.feet;
      e.vy = Math.min(e.vy + C.OBJ_GRAV, C.OBJ_MAXFALL);
      e.feet += e.vy;
      if (e.vy >= 0) {
        const c0 = Math.floor(e.x / TS), c1 = Math.floor((e.x + 16 * S - 1) / TS);
        for (let r = Math.ceil(f0 / TS); r <= Math.floor(e.feet / TS); r++)
          for (let c = c0; c <= c1; c++)
            if (solidAt(c, r) || (semiAt(c, r) && f0 <= r * TS)) { e.feet = r * TS; e.vy = 0; if (e.winged) hop(e); return; }
      }
    } else if (e.winged) { hop(e); }
    if (e.feet > (W.level.rows + 3) * TS) e.state = 'gone';
  }
  function hop(e) {
    if (e.type === 'hopper') { e.vy = C.HOP_VY; return; }                       // hops continuously
    if (e.timer-- <= 0) { e.vy = C.HOP_VY; e.timer = C.HOP_EVERY; }
  }
  function wallHit(e, c, r) {
    if (e.state === 'slide') { const ch = tileAt(W.level, c, r); if ('B?MS'.indexOf(ch) >= 0) bump(c, r, false); }
  }

  function updateEntity(e) {
    const p = W.p;
    if (e.state === 'gone') return;
    if (!e.active) { if (e.x < W.camX * S + (256 + 32) * S) e.active = true; else return; }
    if (e.x + 16 * S < W.camX * S - 64 * S && e.type !== 'plant') { e.state = 'gone'; return; }
    if (e.state === 'squashed') { if (--e.timer <= 0) e.state = 'gone'; return; }
    if (e.state === 'flipped') {
      e.vy = Math.min(e.vy + C.OBJ_GRAV, C.OBJ_MAXFALL); e.x += e.vx; e.feet += e.vy;
      if (e.feet > (W.level.rows + 3) * TS) e.state = 'gone';
      return;
    }
    if (e.grace > 0) e.grace--;
    if (e.type === 'plant') return plantStep(e);
    if (e.type === 'pswitch') { if (e.state === 'rising') riseStep(e); else if (e.state === 'idle') { e.vy = 0; } contactSwitch(e); return; }
    if (e.type === 'orb') {
      if (e.state === 'rising') { riseStep(e); if (e.state !== 'rising') e.vx = e.dir * C.ITEM_VX; }
      else walkerStep(e);
      if (e.state !== 'gone') contactOrb(e);
      return;
    }
    if (e.state === 'shell') { shellFall(e); }
    else walkerStep(e);
    if (e.state === 'slide') hitOthers(e);
    contactEnemy(e);
  }
  function riseStep(e) {
    e.feet -= S; e.timer--;
    if (e.timer <= 0) { e.feet = e.targetFeet; e.state = e.type === 'orb' ? 'walking' : 'idle'; }
  }
  function shellFall(e) {
    if (!supportedAt(W.level, e.x, e.feet)) {
      const f0 = e.feet; e.vy = Math.min(e.vy + C.OBJ_GRAV, C.OBJ_MAXFALL); e.feet += e.vy;
      const c0 = Math.floor(e.x / TS), c1 = Math.floor((e.x + 16 * S - 1) / TS);
      for (let r = Math.ceil(f0 / TS); r <= Math.floor(e.feet / TS); r++)
        for (let c = c0; c <= c1; c++) if (solidAt(c, r) || (semiAt(c, r) && f0 <= r * TS)) { e.feet = r * TS; e.vy = 0; return; }
    } else e.vy = 0;
  }
  function plantStep(e) {
    const p = W.p;
    if (e.state === 'hidden') {
      if (--e.timer <= 0) {
        const near = Math.abs((p.x + 8 * S) - (e.x + 16 * S)) < 28 * S;       // stays down when player is on top of the pipe
        if (near) e.timer = 10; else { e.state = 'rising'; e.timer = C.PLANT_MOVE; }
      }
    } else if (e.state === 'rising') {
      e.rise = Math.min(C.PLANT_H * S, e.rise + Math.round(C.PLANT_H * S / C.PLANT_MOVE));
      if (--e.timer <= 0) { e.state = 'up'; e.timer = C.PLANT_UP; e.rise = C.PLANT_H * S; }
    } else if (e.state === 'up') {
      if (--e.timer <= 0) { e.state = 'falling'; e.timer = C.PLANT_MOVE; }
    } else if (e.state === 'falling') {
      e.rise = Math.max(0, e.rise - Math.round(C.PLANT_H * S / C.PLANT_MOVE));
      if (--e.timer <= 0) { e.state = 'hidden'; e.timer = C.PLANT_HIDE; e.rise = 0; }
    }
    e.feet = e.baseFeet - C.PLANT_H * S + e.rise;
    e.h = C.PLANT_H;
    if (e.rise > 4 * S && !p.dead) {
      const pTop = p.feet - height(p) * S, eTop = e.feet - e.h * S;
      const ex = e.x + 8 * S;
      if (p.x < ex + 16 * S && ex < p.x + 16 * S && pTop < e.baseFeet - 0 && eTop < p.feet && p.feet > eTop) hurt(p);
    }
  }
  function overlap(p, e, ex, ew) {
    const pTop = p.feet - height(p) * S, eTop = e.feet - e.h * S;
    return p.x < ex + ew && ex < p.x + 16 * S && pTop < e.feet && eTop < p.feet;
  }
  function contactOrb(e) {
    const p = W.p;
    if (p.dead || e.state === 'rising') return;
    if (overlap(p, e, e.x, 16 * S)) {
      e.state = 'gone'; p.score += 1000; SFX.power();
      if (p.powerup === 'small') p.powerup = 'big';
    }
  }
  function contactSwitch(e) {
    const p = W.p;
    if (p.dead || e.state !== 'idle') return;
    if (overlap(p, e, e.x, 16 * S) && p.vy >= 0 && p.feet <= (e.feet - e.h * S) + C.STOMP_WINDOW * S) {
      e.state = 'pressed'; e.h = 4; p.vy = 0; W.switchT = C.SWITCH_FRAMES; SFX.item(); applySwitch(true);
    }
  }
  function applySwitch(on) {
    const L = W.level;
    for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
      if (on && L.grid[r][c] === 'B') { L.grid[r][c] = '.'; L.coins.push({ c, r, taken: false, fromBrick: true }); }
    }
    if (!on) {
      for (const k of L.coins) if (k.fromBrick) { if (!k.taken) L.grid[k.r][k.c] = 'B'; }
      L.coins = L.coins.filter((k) => !k.fromBrick);
    }
  }

  function hitOthers(s) {
    for (const o of W.ents) {
      if (o === s || o.state === 'gone' || o.state === 'flipped' || o.state === 'squashed' || o.type === 'orb' || o.type === 'pswitch' || o.type === 'plant') continue;
      if (!o.active) continue;
      const oTop = o.feet - o.h * S, sTop = s.feet - s.h * S;
      if (s.x < o.x + 16 * S && o.x < s.x + 16 * S && sTop < o.feet && oTop < s.feet) {
        flip(o, sign(s.vx)); W.p.score += 100; s.chain++; SFX.kick();
        if (o.state === 'flipped' && o.state !== 'slide') { /* victim removed from play */ }
      }
    }
  }

  function contactEnemy(e) {
    const p = W.p;
    if (p.dead || e.state === 'gone' || e.state === 'flipped' || e.state === 'squashed') return;
    const eTop = e.feet - e.h * S;
    if (!overlap(p, e, e.x, 16 * S)) return;
    const fromAbove = (p.vy >= 0 || p.killTally > 0) && p.feet <= eTop + C.STOMP_WINDOW * S;
    if (e.state === 'shell') {                                            // stationary shell: kick it away
      const dir = (p.x + 8 * S) < (e.x + 8 * S) ? 1 : -1;
      e.state = 'slide'; e.grace = C.KICK_GRACE; e.vx = dir * (C.SHELL_VX + ((sign(p.vx) === dir) ? Math.abs(p.vx) >> 1 : 0));
      if (fromAbove) { p.vy = C.STOMP_VY; awardChain(p); }
      SFX.kick(); return;
    }
    if (e.state === 'slide' && e.grace > 0) return;
    if (fromAbove) {
      p.vy = C.STOMP_VY; p.inAir = true; SFX.stomp();
      if (e.state === 'slide') { e.state = 'shell'; e.vx = 0; awardChain(p); return; }
      awardChain(p);
      if (e.winged) { e.winged = false; e.type = e.type === 'winged_walker' ? 'walker' : 'shellback'; e.vy = 0; return; }
      if (e.type === 'walker') { e.state = 'squashed'; e.timer = C.SQUASH; e.vx = 0; return; }
      e.state = 'shell'; e.vx = 0; e.type = e.type === 'shellback_red' ? 'shellback_red' : 'shellback';
    } else hurt(p);
  }

  // ------------------------------------------------------------------ one frame
  function stepFrame(inPad) {
    const p = W.p;
    let pad = inPad;
    if (W.cleared) pad = Object.assign({}, NO_INPUT, { right: true });
    if (p.dead) { deathStep(); W.frame++; W.prevPad = pad; return; }
    W.wiggly = ((W.wiggly & 0xF0) - C.WIGGLY_STEP) & 0xFF;               // h.accel_counter
    if (Math.abs(p.vx) >= C.ABS_MAX) p.vx = sign(p.vx) * C.ABS_MAX;
    p.x += p.vx; resolveX(p);
    if (p.x < W.camX * S) { p.x = W.camX * S; if (p.vx < 0) p.vx = 0; }
    const feet0 = p.feet;
    if (p.vy >= C.FALL_CAP) p.vy = C.FALL_CAP;                           // v.fall_cap
    p.feet += p.vy;
    const absvx = Math.abs(p.vx);
    hControl(p, pad, absvx);
    jumpAndGravity(p, pad, W.prevPad);
    powerUpdate(p);
    resolveY(p, feet0);
    if (!p.inAir && !supportedAt(W.level, p.x, p.feet)) p.inAir = true;  // walked off a ledge
    if (p.feet > (W.level.rows + 3) * TS) die(p);
    if (p.pCnt > 0) p.pCnt--;
    if (p.invuln > 0) p.invuln--;
    p.anim++;
    for (const e of W.ents) updateEntity(e);
    worldStep();
    W.frame++;
    W.prevPad = pad;
  }

  function deathStep() {
    const p = W.p; W.deadT++;
    if (W.deadT === 20) p.vy = -64;
    if (W.deadT > 20) { p.vy = Math.min(p.vy + C.GRAV, 80); p.feet += p.vy; }
  }

  function worldStep() {
    const p = W.p, L = W.level;
    const camTarget = Math.min(p.x / S - 104, L.cols * T - 256);
    if (camTarget > W.camX) W.camX = camTarget;
    if (W.camX < 0) W.camX = 0;
    // coins
    for (const k of L.coins) {
      if (k.taken) continue;
      const kx = k.c * TS + 2 * S, ky = k.r * TS + 2 * S;
      const pTop = p.feet - height(p) * S;
      if (p.x < kx + 12 * S && kx < p.x + 16 * S && pTop < ky + 12 * S && ky < p.feet) { k.taken = true; addCoin(); SFX.coin(); }
    }
    // switch timer
    if (W.switchT > 0 && --W.switchT === 0) applySwitch(false);
    // goal
    if (L.goal && !W.cleared && !p.dead) {
      const gx = L.goal.c * TS, gy = L.goal.r * TS, pTop = p.feet - height(p) * S;
      if (p.x < gx + 16 * S && gx < p.x + 16 * S && pTop < gy + 16 * S && gy < p.feet) {
        W.cleared = true; W.card = ['mushroom', 'flower', 'star'][Math.floor(W.frame / C.CARD_PERIOD) % 3]; SFX.clear();
      }
    }
    if (W.cleared) {
      W.clearT++;
      if (W.clearT > 60 && W.time > 0) { W.time--; p.score += 50; W.bonusPaid++; }
    } else if (!p.dead) {                                                 // timer: 41 frames per unit
      if (W.timeCnt === 0) { W.timeCnt = C.TIMER_PERIOD - 1; if (--W.time <= 0) { W.time = 0; die(p); } } else W.timeCnt--;
    }
    // cosmetic lists
    for (const b of W.bumps) b.t++; W.bumps = W.bumps.filter((b) => b.t < 8);
    for (const q of W.pops) q.t++; W.pops = W.pops.filter((q) => q.t < 30);
    for (const d of W.parts) { d.t++; d.vy += 1; d.x += d.vx * 0.5; d.y += d.vy * 0.5; } W.parts = W.parts.filter((d) => d.t < 60);
  }

  // ------------------------------------------------------------------ state snapshot (GAME-HOOK.md)
  function snapshot() {
    const p = W.p;
    return {
      frame: W.frame,
      player: {
        x: p.x / S, y: (p.feet - height(p) * S) / S, feetY: p.feet / S, vx: p.vx, vy: p.vy,
        onGround: !p.inAir, powerup: p.powerup, pMeter: popcount(p.power), pMeterRaw: p.power,
        facing: p.facing, dead: p.dead, killTally: p.killTally, invuln: p.invuln,
      },
      score: p.score, time: W.time, coins: W.coins, lives: W.lives, cleared: W.cleared, card: W.card, switchActive: W.switchT > 0,
      camX: W.camX,
      entities: W.ents.map((e) => ({ id: e.id, type: e.type, x: e.x / S, y: (e.feet - e.h * S) / S, vx: e.vx, vy: e.vy, state: e.state, winged: !!e.winged })),
      debug: { accelCounter: W.wiggly, pTimer: p.pCnt, flyTime: p.flyTime },
    };
  }

  function summary() {
    const L = W.level, n = (t) => W.ents.filter((e) => e.type === t).length;
    const tiles = (ch) => { let k = 0; for (const row of L.grid) for (const c of row) if (c === ch) k++; return k; };
    return {
      widthPx: L.cols * T, heightPx: L.rows * T, timer: W.time, timerPeriod: C.TIMER_PERIOD,
      enemies: { walker: n('walker'), winged_walker: n('winged_walker'), shellback: n('shellback'), shellback_red: n('shellback_red'), hopper: n('hopper'), plant: n('plant') },
      coinsInAir: L.coins.filter((k) => !k.fromBrick).length, coinBlocks: tiles('?'), itemBlocks: tiles('M'),
      bricks: tiles('B'), switchBricks: tiles('S'), brickCoins: L.coins.filter((k) => k.fromBrick && !k.taken).length, goalX: L.goal ? L.goal.c * T : null,
    };
  }

  // ------------------------------------------------------------------ rendering (original art, drawn with rects)
  const canvas = typeof document !== 'undefined' ? document.getElementById('screen') : null;
  const ctx = canvas ? canvas.getContext('2d') : null;
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  function drawBackground(cam) {
    const goalX = W.level.goal ? W.level.goal.c * T : 1e9;
    const g = ctx.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, '#4e9bf0'); g.addColorStop(1, '#bfe3ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 240);
    // far hills
    for (let i = 0; i < 14; i++) {
      const hx = i * 150 - (cam * 0.4) % 150 - 40, hw = 90 + (i % 3) * 20, hh = 40 + (i % 4) * 14;
      ctx.fillStyle = i % 2 ? '#79c97a' : '#5fb868';
      ctx.beginPath(); ctx.moveTo(hx, 208); ctx.quadraticCurveTo(hx + hw / 2, 208 - hh * 1.6, hx + hw, 208); ctx.fill();
    }
    // clouds
    for (let i = 0; i < 10; i++) {
      const cx = i * 190 - (cam * 0.25) % 190, cy = 28 + (i * 37) % 60;
      R(cx, cy, 34, 8, '#fff'); R(cx + 6, cy - 6, 22, 8, '#fff'); R(cx + 2, cy + 8, 30, 3, '#dfeeff');
    }
    // dark goal area
    const dx = goalX - 80 - cam;
    if (dx < 256) { ctx.fillStyle = 'rgba(10,14,40,0.82)'; ctx.fillRect(Math.max(0, dx), 0, 256, 240); }
  }

  function drawTile(ch, x, y, above) {
    switch (ch) {
      case '#': {
        R(x, y, 16, 16, '#b8702a');
        R(x + 3, y + 7, 2, 2, '#8d5120'); R(x + 10, y + 11, 3, 2, '#8d5120'); R(x + 8, y + 3, 2, 2, '#d48c44');
        if (!above) { R(x, y, 16, 4, '#46c24a'); R(x, y + 4, 16, 1, '#2f8f35'); R(x, y, 16, 1, '#7fe27f'); }
        break;
      }
      case 'B': R(x, y, 16, 16, '#c0502a'); R(x, y + 7, 16, 1, '#6e2a14'); R(x, y + 15, 16, 1, '#6e2a14'); R(x + 7, y, 1, 7, '#6e2a14'); R(x + 3, y + 8, 1, 7, '#6e2a14'); R(x + 11, y + 8, 1, 7, '#6e2a14'); R(x, y, 16, 1, '#e07a4a'); break;
      case '?': case 'M': {
        R(x, y, 16, 16, '#7a4a00'); R(x + 1, y + 1, 14, 14, '#f4b81c'); R(x + 1, y + 1, 14, 2, '#ffe070'); R(x + 1, y + 13, 14, 2, '#c98a00');
        R(x + 6, y + 4, 4, 2, '#7a4a00'); R(x + 9, y + 5, 2, 3, '#7a4a00'); R(x + 7, y + 8, 2, 2, '#7a4a00'); R(x + 7, y + 11, 2, 2, '#7a4a00'); break;
      }
      case 'S': R(x, y, 16, 16, '#c0502a'); R(x, y, 16, 1, '#e07a4a'); R(x + 4, y + 4, 8, 8, '#4aa0ff'); R(x + 6, y + 6, 4, 4, '#cfe8ff'); break;
      case 'U': R(x, y, 16, 16, '#6b5030'); R(x + 1, y + 1, 14, 14, '#8a6a42'); R(x + 3, y + 3, 2, 2, '#4a361e'); R(x + 11, y + 3, 2, 2, '#4a361e'); R(x + 3, y + 11, 2, 2, '#4a361e'); R(x + 11, y + 11, 2, 2, '#4a361e'); break;
      case 'W': R(x, y, 16, 16, '#d9a45a'); R(x, y, 16, 1, '#f0c47a'); R(x, y + 15, 16, 1, '#8c5e26'); R(x + 2, y + 2, 2, 2, '#8c5e26'); R(x + 12, y + 2, 2, 2, '#8c5e26'); R(x + 2, y + 12, 2, 2, '#8c5e26'); R(x + 12, y + 12, 2, 2, '#8c5e26'); R(x + 6, y + 6, 4, 4, '#bd8440'); break;
      case '=': R(x, y, 16, 5, '#ff7a8a'); R(x, y, 16, 1, '#ffc8cf'); R(x, y + 5, 16, 11, 'rgba(255,122,138,0.25)'); R(x + 6, y + 5, 4, 11, 'rgba(160,60,80,0.35)'); break;
      case 'L': R(x, y, 16, 16, '#1f9b2c'); R(x, y, 16, 3, '#6fe27a'); R(x, y + 13, 16, 3, '#127020'); R(x + 3, y + 3, 3, 10, '#4fd05c'); break;
      case 'R': R(x, y, 16, 16, '#1f9b2c'); R(x, y, 16, 3, '#6fe27a'); R(x, y + 13, 16, 3, '#127020'); R(x + 12, y + 3, 4, 10, '#127020'); break;
      case 'l': R(x + 1, y, 14, 16, '#24ad33'); R(x + 3, y, 3, 16, '#58d664'); break;
      case 'r': R(x, y, 15, 16, '#24ad33'); R(x + 11, y, 4, 16, '#147a22'); break;
    }
  }

  function drawHero(x, y, h, facing, anim, hurtBlink, dead) {
    if (hurtBlink && (anim & 4)) return;
    const f = facing >= 0 ? 1 : -1, ox = f > 0 ? 0 : 0;
    const px = (dx, dy, w, hh, col) => R(f > 0 ? x + dx : x + 16 - dx - w, y + dy, w, hh, col);
    const legStep = (anim >> 2) & 1;
    if (h === 16) {
      px(7, 0, 2, 3, '#ffcf3a'); px(6, -1, 4, 2, '#ffe97a');                 // antenna tip
      px(2, 3, 12, 6, '#dfe9f5'); px(8, 4, 5, 3, '#14213d'); px(9, 5, 2, 1, '#6ad3ff'); // head + visor
      px(3, 9, 10, 4, '#e8553a'); px(2, 9, 2, 3, '#ff8a6a');                   // body + scarf
      if (dead) { px(2, 13, 4, 3, '#2f3e66'); px(10, 13, 4, 3, '#2f3e66'); return; }
      px(legStep ? 3 : 4, 13, 4, 3, '#2f3e66'); px(legStep ? 9 : 8, 13, 4, 3, '#2f3e66');
    } else {
      px(7, 0, 2, 3, '#ffcf3a'); px(6, -1, 4, 2, '#ffe97a');
      px(2, 3, 12, 9, '#dfe9f5'); px(8, 5, 5, 4, '#14213d'); px(9, 6, 2, 2, '#6ad3ff');
      px(2, 12, 12, 2, '#ff8a6a');
      px(3, 14, 10, 9, '#e8553a'); px(0, 15, 3, 7, '#9c3a2a');               // torso + backpack
      px(4, 23, 8, 2, '#2f3e66');
      px(legStep ? 3 : 4, 25, 4, 7, '#2f3e66'); px(legStep ? 9 : 8, 25, 4, 7, '#2f3e66');
    }
  }
  function drawEnemy(e, cam, anim) {
    const x = e.x / S - cam, y = e.feet / S - e.h;
    const step = (anim >> 3) & 1;
    if (e.state === 'flipped') { R(x + 1, y + 6, 14, 8, '#a33'); R(x + 3, y + 4, 10, 3, '#c55'); return; }
    switch (e.type) {
      case 'walker': case 'winged_walker':
        if (e.state === 'squashed') { R(x + 1, y + 11, 14, 5, '#8a4a1a'); R(x + 3, y + 12, 3, 1, '#fff'); R(x + 10, y + 12, 3, 1, '#fff'); break; }
        R(x + 2, y + 1, 12, 10, '#a85a22'); R(x + 1, y + 5, 14, 6, '#a85a22'); R(x + 3, y + 3, 10, 2, '#c97a3c');
        R(x + 4, y + 5, 3, 3, '#fff'); R(x + 9, y + 5, 3, 3, '#fff'); R(x + 5, y + 6, 2, 2, '#222'); R(x + 9, y + 6, 2, 2, '#222');
        R(x + 3, y + 4, 4, 1, '#3a1a08'); R(x + 9, y + 4, 4, 1, '#3a1a08');
        R(step ? x + 1 : x + 3, y + 12, 5, 4, '#3a2410'); R(step ? x + 10 : x + 8, y + 12, 5, 4, '#3a2410');
        if (e.winged) { R(x - 3, y, 5, 4, '#fff'); R(x + 14, y, 5, 4, '#fff'); }
        break;
      case 'shellback': case 'shellback_red': case 'hopper': {
        const shell = e.type === 'shellback_red' ? '#d23a3a' : '#2fae4a', dark = e.type === 'shellback_red' ? '#8c1f1f' : '#1c7a32';
        if (e.state === 'shell' || e.state === 'slide') {
          R(x + 1, y + 6, 14, 10, dark); R(x + 2, y + 5, 12, 10, shell); R(x + 6, y + 6, 4, 8, '#fff6c8'); R(x + 3, y + 7, 2, 2, dark); R(x + 11, y + 7, 2, 2, dark);
          if (e.state === 'slide') R(x + (e.vx > 0 ? 0 : 14), y + 8, 2, 4, '#ffe97a');
          break;
        }
        const f = e.vx > 0 ? 1 : -1, px = (dx, dy, w, hh, c) => R(f > 0 ? x + dx : x + 16 - dx - w, y + dy, w, hh, c);
        px(1, 6, 11, 9, dark); px(2, 5, 9, 9, shell); px(4, 6, 3, 6, '#fff6c8');   // shell
        px(9, 1, 6, 7, '#e8d28a'); px(12, 2, 2, 2, '#222'); px(13, 5, 3, 1, '#a58a3a'); // head
        px(step ? 3 : 5, 13, 4, 3, '#a58a3a'); px(step ? 8 : 10, 13, 4, 3, '#a58a3a');
        if (e.winged) { px(0, 3, 5, 3, '#fff'); px(1, 1, 4, 3, '#dfeeff'); }
        break;
      }
      case 'plant': {
        if (e.rise <= 0) break;
        const top = e.feet / S - cam * 0 - e.h, base = e.baseFeet / S;
        ctx.save(); ctx.beginPath(); ctx.rect(x, 0, 32, base); ctx.clip();
        R(x + 15, e.feet / S - 12, 2, 24, '#1a6d28');
        R(x + 8, e.feet / S - e.h, 16, 14, '#e03a8c'); R(x + 10, e.feet / S - e.h - 1, 12, 2, '#ff7ac0'); R(x + 11, e.feet / S - e.h + 6, 10, 3, '#4a0a2a');
        R(x + 12, e.feet / S - e.h + 3, 2, 2, '#fff'); R(x + 18, e.feet / S - e.h + 3, 2, 2, '#fff');
        ctx.restore(); break;
      }
      case 'orb': {
        const t = (anim >> 2) & 1;
        R(x + 3, y + 3, 10, 10, '#19c6d6'); R(x + 5, y + 1, 6, 14, '#19c6d6'); R(x + 1, y + 5, 14, 6, '#19c6d6');
        R(x + 5, y + 5, 4, 4, t ? '#e8ffff' : '#aef2f7'); R(x + 3, y + 3, 2, 2, '#8cf0f8');
        break;
      }
      case 'pswitch':
        if (e.state === 'pressed') R(x + 2, y + 12, 12, 4, '#2a74d8');
        else { R(x + 2, y + 6, 12, 10, '#2a74d8'); R(x + 3, y + 7, 10, 3, '#7fbaff'); R(x + 4, y + 11, 8, 3, '#1a4aa0'); }
        break;
    }
  }
  function drawCard(x, y, kind, anim) {
    R(x, y, 16, 16, '#c42b2b'); R(x + 1, y + 1, 14, 14, '#ffe9a8');
    const c = '#d23a3a';
    if (kind === 'star') { R(x + 7, y + 3, 2, 10, '#f2b01c'); R(x + 3, y + 7, 10, 2, '#f2b01c'); R(x + 5, y + 5, 6, 6, '#f2b01c'); }
    else if (kind === 'flower') { R(x + 6, y + 3, 4, 4, '#ff6a8a'); R(x + 3, y + 6, 4, 4, '#ff6a8a'); R(x + 9, y + 6, 4, 4, '#ff6a8a'); R(x + 6, y + 9, 4, 4, '#ff6a8a'); R(x + 6, y + 6, 4, 4, '#ffd23a'); }
    else { R(x + 3, y + 4, 10, 6, c); R(x + 5, y + 10, 6, 3, '#fff'); R(x + 5, y + 5, 2, 2, '#fff'); R(x + 9, y + 5, 2, 2, '#fff'); }
  }

  function render() {
    if (!ctx) return;
    const p = W.p, cam = Math.round(W.camX), L = W.level;
    drawBackground(cam);
    const c0 = Math.max(0, Math.floor(cam / T) - 1), c1 = Math.min(L.cols - 1, c0 + 19);
    for (let r = 0; r < L.rows; r++) for (let c = c0; c <= c1; c++) {
      const ch = L.grid[r][c];
      if (ch === '.') continue;
      let bump = 0; for (const b of W.bumps) if (b.c === c && b.r === r) bump = Math.round(Math.sin(b.t / 8 * Math.PI) * 5);
      drawTile(ch, c * T - cam, r * T - bump, r > 0 && SOLID.indexOf(L.grid[r - 1][c]) >= 0);
    }
    for (const k of L.coins) if (!k.taken) {
      const x = k.c * T - cam + 4, y = k.r * T + 2, w = ((W.frame >> 3) & 3);
      const ww = [8, 6, 3, 6][w]; R(x + (8 - ww) / 2, y, ww, 12, '#f4c21c'); if (ww > 4) R(x + (8 - ww) / 2 + 1, y + 2, 1, 8, '#fff2a0');
    }
    if (L.goal) drawCard(L.goal.c * T - cam, L.goal.r * T, ['mushroom', 'flower', 'star'][Math.floor(W.frame / C.CARD_PERIOD) % 3], W.frame);
    for (const e of W.ents) if (e.state !== 'gone') drawEnemy(e, cam, W.frame);
    for (const q of W.pops) { R(q.x - cam + 4, q.y - Math.sin(q.t / 30 * Math.PI) * 30, 8, 12, '#f4c21c'); }
    for (const d of W.parts) R(d.x - cam, d.y, 6, 6, '#c0502a');
    if (!(p.dead && W.deadT > 100)) drawHero(p.x / S - cam, p.feet / S - height(p), height(p), p.facing, p.vx ? W.frame : 0, p.invuln > 0, p.dead);
    // HUD
    R(0, 0, 256, 18, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = '#fff'; ctx.font = '8px monospace';
    ctx.fillText('SCORE ' + String(p.score).padStart(7, '0'), 6, 8);
    ctx.fillText('COINS ' + String(W.coins).padStart(2, '0'), 100, 8);
    ctx.fillText('TIME ' + String(W.time).padStart(3, '0'), 170, 8);
    ctx.fillText('LIVES ' + W.lives, 214, 8);
    for (let i = 0; i < 6; i++) R(6 + i * 7, 11, 5, 4, i < popcount(p.power) ? '#ffe45a' : '#555');
    R(48, 10, 14, 6, popcount(p.power) === 7 ? '#ff5a3a' : '#555'); ctx.fillStyle = '#fff'; ctx.fillText('P', 52, 15);
    if (W.switchT > 0) ctx.fillText('SWITCH ' + Math.ceil(W.switchT / 60), 100, 16);
    if (W.cleared && W.clearT > 20) {
      R(40, 80, 176, 56, 'rgba(0,0,0,0.7)'); ctx.fillStyle = '#ffe45a'; ctx.font = '12px monospace';
      ctx.fillText('COURSE CLEAR!', 78, 102); ctx.font = '8px monospace'; ctx.fillStyle = '#fff';
      ctx.fillText('YOU GOT A ' + String(W.card).toUpperCase() + ' CARD', 72, 118); ctx.fillText('ENTER = PLAY AGAIN', 80, 130);
    }
    if (p.dead && W.deadT > 40) { ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText(W.lives <= 1 ? 'GAME OVER' : 'TRY AGAIN', 98, 110); }
    if (params.has('debug')) { ctx.fillStyle = '#000'; ctx.font = '7px monospace'; ctx.fillText(`F${W.frame} vx${p.vx} vy${p.vy} P${popcount(p.power)}`, 4, 232); }
  }

  // ------------------------------------------------------------------ real-time play
  const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const keys = {};
  if (typeof addEventListener !== 'undefined') {
    addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (e.code === 'Enter' && (W.cleared || W.p.dead)) restart(W.cleared);
      if (e.code === 'KeyM') muted = !muted;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    });
    addEventListener('keyup', (e) => { keys[e.code] = false; });
  }
  let realtime = true, acc = 0, last = 0;
  const STEP_MS = 1000 / 60.0988;                                         // A7: fixed 60.0988 Hz step
  function padFromKeys() {
    return {
      left: !!(keys.ArrowLeft || keys.KeyA), right: !!(keys.ArrowRight || keys.KeyD), up: !!keys.ArrowUp, down: !!keys.ArrowDown,
      A: !!(keys.KeyX || keys.Space || keys.KeyK), B: !!(keys.KeyZ || keys.ShiftLeft || keys.ShiftRight || keys.KeyJ),
    };
  }
  function restart(won) {
    if (won) session = { lives: W.lives, score: 0, coins: 0 };
    else session = { lives: W.lives <= 1 ? 4 : W.lives - 1, score: W.lives <= 1 ? 0 : W.p.score, coins: W.lives <= 1 ? 0 : W.coins };
    makeWorld({ scenario: 'course-1-1', keepSession: true });
  }
  function loop(ts) {
    if (!realtime) return;
    if (!last) last = ts; acc += Math.min(100, ts - last); last = ts;
    while (acc >= STEP_MS) { stepFrame(padFromKeys()); acc -= STEP_MS; if (W.p.dead && W.deadT > 150 && !W.cleared) restart(false); }
    render();
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ GAME-HOOK contract (v1 + optional v1.1)
  const normInput = (i) => Object.assign({}, NO_INPUT, i || {});
  const hook = {
    apiVersion: 1, hookMinor: 1, name: 'courier-' + (params.get('build') || 'dev'),
    units: { position: 'px', velocity: 'subpx/frame (1/16 px per frame)' },
    scenarios: Object.keys(SCENARIOS),
    reset(opts) { realtime = false; makeWorld(opts); W.silent = true; render(); return snapshot(); },
    step(frames, input) {
      realtime = false; W.silent = true;
      const trace = [];
      for (let f = 0; f < frames; f++) { stepFrame(normInput(Array.isArray(input) ? input[f] : input)); trace.push(snapshot()); }
      render(); return trace;
    },
    getState() { return snapshot(); },
    getCourseSummary() { return summary(); },
    probe(x, y) { return tileAt(W.level, Math.floor(x / T), Math.floor(y / T)); },
  };
  if (typeof window !== 'undefined') window.__smb3 = hook;

  makeWorld({ scenario: 'course-1-1' });
  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
})();
