// SPDX-License-Identifier: MIT
/*
 * Courier renderer: original pixel art generated from small painters (no external assets).
 * NES-style discipline: 16x16 grid, hard edges, flat colours, 1px outlines, no alpha, no gradients.
 */
(function () {
  'use strict';
  const PAL = {
    o: '#14182a', W: '#f2f6ff', w: '#a9b9dc', P: '#ffffff', K: '#2b3558',
    V: '#34b8ff', v: '#1459a0', B: '#ee5a3c', b: '#a4331f', Y: '#ffd43b', y: '#c98a00',
    R: '#c4682a', r: '#7a3612', T: '#f2c98a', t: '#b8884a',
    G: '#33b24d', g: '#1a7a33', D: '#e23c3c', d: '#8a1c1c', M: '#e0388c', m: '#8a1a56',
    C: '#2fd0e0', c: '#0d8a9a', L: '#4a8cff', l: '#1f4aa8',
    E: '#b8702a', e: '#8a4f1e', f: '#d99048', h: '#7fe27f',
    N: '#c4502a', n: '#6e2a14', j: '#e2825a', u: '#7a4a00', U: '#8a6a42', X: '#4a361e',
    Q: '#24ad33', q: '#147a22', z: '#6fe27a', A: '#ff7a8a', a: '#ffc8cf', s: '#d9a45a', S: '#8c5e26', k: '#f0c47a',
  };
  const SKY = '#58a8ff', HILL1 = '#4fb35c', HILL2 = '#7fd27a', CLOUD1 = '#ffffff', CLOUD2 = '#b9d9ff', DARK = '#0b1030';

  // ---------------------------------------------------------------- sprite painter
  function mk(w, h, paint, outline) {
    const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill('.'));
    const px = (ch, x, y, ww, hh) => {
      for (let j = 0; j < (hh || 1); j++) for (let i = 0; i < (ww || 1); i++) {
        const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < w && yy < h) g[yy][xx] = ch;
      }
    };
    paint(px);
    if (outline !== false) {
      const o = g.map((r) => r.slice());
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (g[y][x] !== '.') continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = (g[y + dy] || [])[x + dx]; return c && c !== '.'; });
        if (n) o[y][x] = 'o';
      }
      return o;
    }
    return g;
  }
  const flipH = (g) => g.map((r) => r.slice().reverse());
  const flipV = (g) => g.slice().reverse().map((r) => r.slice());
  function toCanvas(g) {
    const h = g.length, w = g[0].length, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = g[j][i]; if (ch !== '.') { x.fillStyle = PAL[ch]; x.fillRect(i, j, 1, 1); } }
    return c;
  }

  // ---------------------------------------------------------------- hero (original robot courier)
  // 12 poses: idle blink walk1 walk2 walk3 run1 run2 skid jump fall crouch dead
  const HERO_POSES = ['idle', 'blink', 'walk1', 'walk2', 'walk3', 'run1', 'run2', 'skid', 'jump', 'fall', 'crouch', 'dead'];
  function legsFor(px, y0, rows, pose) {
    const bot = y0 + rows - 1, half = Math.max(1, Math.ceil(rows / 2));
    const leg = (x, w, r, lift) => { px('v', x, bot - r + 1 - (lift || 0), w, r); px('o', x, bot - (lift || 0), w, 1); };
    switch (pose) {
      case 'walk1': leg(3, 3, rows); leg(10, 3, half, 1); break;
      case 'walk2': leg(5, 3, rows); leg(8, 3, rows); break;
      case 'walk3': leg(3, 3, half, 1); leg(10, 3, rows); break;
      case 'run1': leg(1, 4, half, 1); leg(10, 5, rows); break;
      case 'run2': leg(3, 3, half, 2); leg(9, 4, half, 1); break;
      case 'skid': leg(6, 3, rows); leg(10, 3, rows); break;
      case 'jump': leg(2, 3, half, 1); leg(9, 5, rows); break;
      case 'fall': leg(2, 3, rows); leg(11, 3, rows); break;
      case 'dead': leg(2, 3, half, 1); leg(11, 3, half, 1); break;
      case 'crouch': leg(3, 4, rows); leg(9, 4, rows); break;
      default: leg(4, 3, rows); leg(9, 3, rows);
    }
  }
  function scarf(px, y, pose, dx) {
    const run = pose === 'run1' || pose === 'run2', walk = pose.indexOf('walk') === 0;
    if (run) { px('Y', 0, y, 5, 1); px('Y', 0 + (pose === 'run1' ? 0 : 1), y + 1, 4, 1); }
    else if (walk) { px('Y', 2 + (pose === 'walk2' ? 1 : 0), y, 2, 1); px('Y', 1 + (pose === 'walk1' ? 0 : 1), y + 1, 2, 1); }
    else if (pose === 'jump') { px('Y', 1, y - 1, 3, 1); px('Y', 0, y, 3, 1); }
    else if (pose === 'fall') { px('Y', 1, y, 2, 1); px('Y', 1, y - 1, 2, 1); px('Y', 2, y - 2, 1, 1); }
    else if (pose === 'skid') { px('Y', 11 + dx + 1, y, 3, 1); px('Y', 12 + dx + 1, y + 1, 2, 1); }
    else if (pose !== 'dead') { px('Y', 2, y, 2, 2); }
  }
  function hero(h, pose) {
    return mk(16, h, (px) => {
      const big = h === 32, run = pose === 'run1' || pose === 'run2', lean = pose === 'skid' ? -1 : (run ? 1 : 0);
      const crouch = pose === 'crouch', blink = pose === 'blink', dead = pose === 'dead';
      const by = crouch ? (big ? 12 : 1) : 0;                                  // crouch squashes the figure toward the floor
      if (!big) {
        const hx = 3 + lean;
        px('W', hx + 2, by + 1, 6, 1); px('W', hx, by + 2, 10, 7); px('B', hx + 4, by + 1, 2, 2);
        if (dead) { px('v', hx + 4, by + 4, 6, 4); px('W', hx + 5, by + 4, 1, 1); px('W', hx + 7, by + 5, 1, 1); px('W', hx + 5, by + 6, 1, 1); px('W', hx + 9, by + 4, 1, 1); px('W', hx + 9, by + 6, 1, 1); }
        else { px('v', hx + 4, by + 4, 6, 4); if (!blink) { px('V', hx + 5, by + 4, 4, 3); px('W', hx + 5, by + 4, 1, 1); } else px('V', hx + 5, by + 6, 4, 1); }
        px('Y', hx, by + 6, 1, 2);
        const bt = by + 9;
        px('B', 4 + lean, bt, 8, 3); px('b', 4 + lean, bt + 2, 8, 1); px('Y', 7 + lean, bt, 2, 1); px('b', 3 + lean, bt, 1, 2);
        scarf(px, bt, pose, lean);
        legsFor(px, crouch ? 12 : 13, crouch ? 3 : 2, pose);
        return;
      }
      // big form: wide domed helmet (head is ~40% of the figure), stout torso, short legs, visible arms
      const hx = 2 + lean;
      px('W', hx + 3, by + 1, 6, 1); px('W', hx + 1, by + 2, 10, 1); px('W', hx, by + 3, 12, 9); px('B', hx + 4, by + 1, 3, 2);
      if (dead) { px('v', hx + 5, by + 5, 7, 5); px('W', hx + 6, by + 5, 1, 1); px('W', hx + 8, by + 6, 1, 1); px('W', hx + 6, by + 7, 1, 1); px('W', hx + 10, by + 5, 1, 1); px('W', hx + 10, by + 7, 1, 1); px('W', hx + 8, by + 8, 1, 1); }
      else { px('v', hx + 5, by + 5, 7, 5); if (!blink) { px('V', hx + 6, by + 5, 5, 4); px('W', hx + 6, by + 5, 2, 1); } else px('V', hx + 6, by + 8, 5, 1); }
      px('Y', hx, by + 8, 1, 3); px('b', hx, by + 11, 12, 1);                 // ear light + chin line
      const bt = by + 12, bodyRows = crouch ? 6 : 10;
      px('B', 3 + lean, bt, 10, bodyRows); px('b', 3 + lean, bt + bodyRows - 1, 10, 1);
      px('b', 1 + lean, bt + 1, 3, crouch ? 3 : 6);                              // satchel
      px('Y', 6 + lean, bt + 2, 4, 1); px('Y', 7 + lean, bt + 5, 2, 2);          // belt + emblem
      const swing = pose === 'walk1' || pose === 'run1' ? -1 : pose === 'walk3' || pose === 'run2' ? 1 : 0;
      if (pose === 'jump' || pose === 'fall' || dead) { px('B', 13, bt - 2, 2, 5); px('W', 13, bt - 3, 2, 2); px('B', 0, bt - 2, 2, 5); px('W', 0, bt - 3, 2, 2); }
      else { px('B', 13 + swing, bt + 1, 2, 5); px('W', 13 + swing, bt + 6, 2, 2); }
      scarf(px, bt, pose, lean);
      legsFor(px, bt + bodyRows, crouch ? 4 : 7, pose);
    });
  }

  // ---------------------------------------------------------------- enemies (original designs)
  function wings(px, frame, x) { px('P', x, 1 + frame, 4, 4); px('w', x + 1, 4 + frame, 3, 1); }
  function walker(frame, winged) {
    return mk(16, 16, (px) => {
      px('r', 4, 2, 2, 1); px('r', 7, 1, 2, 2); px('r', 10, 2, 2, 1);
      px('R', 3, 3, 10, 3); px('R', 2, 6, 12, 5); px('r', 2, 10, 12, 1);
      px('r', 4, 5, 3, 1); px('r', 9, 5, 3, 1);
      px('W', 4, 6, 3, 3); px('W', 9, 6, 3, 3); px('o', 6, 7, 1, 2); px('o', 9, 7, 1, 2);
      px('T', 6, 10, 4, 1);
      if (frame) { px('K', 3, 11, 5, 3); px('K', 10, 11, 4, 2); } else { px('K', 2, 11, 4, 2); px('K', 9, 11, 5, 3); }
      if (winged) { wings(px, frame, 0); wings(px, frame, 12); }
    });
  }
  function walkerSquash() {
    return mk(16, 16, (px) => { px('R', 2, 11, 12, 3); px('r', 2, 13, 12, 1); px('W', 4, 12, 3, 1); px('W', 9, 12, 3, 1); px('K', 3, 14, 10, 1); });
  }
  function snail(frame, red, winged) {
    const S = red ? 'D' : 'G', s = red ? 'd' : 'g';
    return mk(16, 16, (px) => {
      px(S, 2, 4, 7, 1); px(S, 1, 5, 9, 6); px(s, 2, 11, 8, 1);
      px('W', 3, 6, 1, 2); px(s, 5, 6, 3, 1); px(s, 5, 6, 1, 3); px(s, 5, 8, 3, 1);
      px('T', 9, 5, 5, 5); px('W', 11, 6, 2, 2); px('o', 12, 7, 1, 1); px('t', 13, 9, 2, 1);
      if (frame) { px('T', 4, 12, 8, 2); px('t', 4, 13, 3, 1); } else { px('T', 3, 12, 9, 2); px('t', 9, 13, 3, 1); }
      if (winged) { px('P', 0, 1 + frame, 4, 4); px('w', 1, 4 + frame, 3, 1); }
    });
  }
  function shell(frame, red) {
    const S = red ? 'D' : 'G', s = red ? 'd' : 'g';
    return mk(16, 16, (px) => {
      px(S, 3, 4, 10, 1); px(S, 1, 5, 14, 8); px(s, 2, 13, 12, 1); px('T', 3, 13, 10, 1);
      px('W', 3 + frame * 4, 6, 2, 5); px(s, 8 - frame * 3, 7, 1, 4); px(s, 12, 6, 1, 6);
    });
  }
  function plant(frame) {
    return mk(16, 24, (px) => {
      px('M', 2, 1, 12, 10); px('M', 4, 0, 8, 1); px('m', 2, 10, 12, 1);
      px('W', 4, 3, 2, 2); px('W', 10, 3, 2, 2);
      if (frame) { px('m', 3, 6, 10, 4); px('W', 4, 6, 2, 1); px('W', 7, 6, 2, 1); px('W', 10, 6, 2, 1); } else { px('m', 3, 7, 10, 2); px('W', 5, 7, 1, 1); px('W', 10, 7, 1, 1); }
      px('G', 7, 11, 2, 13); px('G', 3, 15, 4, 2); px('g', 3, 16, 4, 1); px('G', 9, 18, 4, 2);
    });
  }
  function orb(frame) {
    return mk(16, 16, (px) => {
      px('C', 5, 2, 6, 1); px('C', 3, 3, 10, 2); px('C', 2, 5, 12, 6); px('C', 3, 11, 10, 2); px('C', 5, 13, 6, 1);
      px('c', 3, 11, 10, 2); px('c', 12, 6, 1, 4); px('W', frame ? 8 : 4, 4, 2, 2);
    });
  }
  function coin(wd) {
    return mk(8, 14, (px) => {
      const x = (8 - wd) >> 1; px('Y', x, 1, wd, 12); px('y', x + wd - 1, 2, 1, 10); if (wd > 4) px('P', x + 1, 3, 1, 6);
    });
  }
  function pswitch(pressed) {
    return mk(16, 16, (px) => {
      if (pressed) { px('L', 2, 12, 12, 3); px('l', 2, 14, 12, 1); return; }
      px('L', 2, 6, 12, 9); px('P', 3, 7, 6, 1); px('l', 2, 14, 12, 1); px('l', 4, 10, 8, 3); px('P', 5, 11, 2, 1);
    });
  }
  function card(kind) {
    return mk(16, 16, (px) => {
      px('D', 0, 0, 16, 16); px('T', 1, 1, 14, 14);
      if (kind === 'star') { px('Y', 7, 2, 2, 12); px('Y', 2, 7, 12, 2); px('Y', 4, 4, 8, 8); px('y', 7, 7, 2, 2); }
      else if (kind === 'flower') { px('M', 6, 2, 4, 4); px('M', 2, 6, 4, 4); px('M', 10, 6, 4, 4); px('M', 6, 10, 4, 4); px('Y', 6, 6, 4, 4); }
      else { px('D', 3, 3, 10, 6); px('W', 5, 9, 6, 4); px('W', 5, 4, 2, 2); px('W', 9, 4, 2, 2); }
    }, false);
  }

  // ---------------------------------------------------------------- tiles
  const TILES = {
    ground: () => mk(16, 16, (px) => { px('E', 0, 0, 16, 16); px('e', 3, 7, 2, 2); px('e', 10, 11, 3, 2); px('f', 8, 3, 2, 2); px('e', 1, 13, 2, 1); }, false),
    grass: () => mk(16, 16, (px) => {
      px('E', 0, 0, 16, 16); px('e', 3, 9, 2, 2); px('e', 10, 12, 3, 2); px('f', 9, 7, 2, 2);
      px('G', 0, 0, 16, 5); px('g', 0, 5, 16, 1); px('h', 0, 0, 16, 1); px('g', 2, 4, 1, 3); px('g', 7, 4, 1, 3); px('g', 12, 4, 1, 3);
    }, false),
    brick: () => mk(16, 16, (px) => {
      px('N', 0, 0, 16, 16); px('n', 0, 7, 16, 1); px('n', 0, 15, 16, 1); px('n', 7, 0, 1, 7); px('n', 3, 8, 1, 7); px('n', 11, 8, 1, 7); px('j', 0, 0, 16, 1); px('j', 0, 8, 7, 1);
    }, false),
    q: (f) => mk(16, 16, (px) => {
      px('u', 0, 0, 16, 16); px('Y', 1, 1, 14, 14); px('P', 1, 1, 14, 1); px('y', 1, 14, 14, 1); px('y', 14, 2, 1, 12);
      px('u', 1, 1, 1, 1); px('u', 14, 1, 1, 1); px('u', 1, 14, 1, 1); px('u', 14, 14, 1, 1);
      px('u', 6, 4, 4, 2); px('u', 9, 5, 2, 3); px('u', 7, 8, 2, 2); px('u', 7, 11, 2, 2); if (f) px('P', 3, 3, 2, 2);
    }, false),
    used: () => mk(16, 16, (px) => { px('X', 0, 0, 16, 16); px('U', 1, 1, 14, 14); px('X', 3, 3, 2, 2); px('X', 11, 3, 2, 2); px('X', 3, 11, 2, 2); px('X', 11, 11, 2, 2); }, false),
    wood: () => mk(16, 16, (px) => {
      px('S', 0, 0, 16, 16); px('s', 1, 1, 14, 14); px('k', 1, 1, 14, 1); px('S', 2, 2, 2, 2); px('S', 12, 2, 2, 2); px('S', 2, 12, 2, 2); px('S', 12, 12, 2, 2); px('S', 6, 6, 4, 4);
    }, false),
    sw: () => mk(16, 16, (px) => { px('N', 0, 0, 16, 16); px('j', 0, 0, 16, 1); px('n', 0, 15, 16, 1); px('l', 4, 4, 8, 8); px('L', 5, 5, 6, 6); px('P', 6, 6, 2, 2); }, false),
    semi: () => mk(16, 16, (px) => { px('A', 0, 0, 16, 5); px('a', 0, 0, 16, 1); px('A', 3, 0, 2, 2); px('a', 8, 1, 2, 1); px('S', 0, 5, 16, 1); px('s', 6, 6, 4, 10); px('S', 9, 6, 1, 10); }, false),
    pipeL: () => mk(16, 16, (px) => { px('q', 0, 0, 16, 16); px('Q', 1, 1, 15, 14); px('z', 3, 1, 3, 14); px('q', 0, 0, 16, 1); px('q', 0, 15, 16, 1); }, false),
    pipeR: () => mk(16, 16, (px) => { px('q', 0, 0, 16, 16); px('Q', 0, 1, 15, 14); px('q', 12, 1, 3, 14); px('z', 2, 1, 2, 14); }, false),
    pipel: () => mk(16, 16, (px) => { px('q', 0, 0, 16, 16); px('Q', 1, 0, 15, 16); px('z', 3, 0, 3, 16); px('q', 1, 0, 1, 16); }, false),
    pipeScreen: () => null,
  };
  TILES.piper = () => mk(16, 16, (px) => { px('Q', 0, 0, 15, 16); px('q', 11, 0, 4, 16); px('z', 2, 0, 2, 16); px('q', 15, 0, 1, 16); }, false);

  // ---------------------------------------------------------------- 3x5 bitmap font
  const GLYPHS = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3],
    H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5],
    O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 7, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7],
    V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6], 6: [3, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 6],
    '!': [2, 2, 2, 0, 2], '-': [0, 0, 7, 0, 0], ':': [0, 2, 0, 2, 0], x: [0, 5, 2, 5, 0], ' ': [0, 0, 0, 0, 0], '=': [0, 7, 0, 7, 0],
  };

  // ---------------------------------------------------------------- build the sprite sheet
  const SHEET = {};
  const def = (name, frames) => { SHEET[name] = frames.map((g) => ({ g, c: toCanvas(g), f: toCanvas(flipH(g)), v: toCanvas(flipV(g)) })); };
  def('hero-s', HERO_POSES.map((p) => hero(16, p)));
  def('hero-b', HERO_POSES.map((p) => hero(32, p)));
  def('walker', [walker(0, false), walker(1, false), walkerSquash()]);
  def('walker-winged', [walker(0, true), walker(1, true)]);
  def('snail-green', [snail(0, false, false), snail(1, false, false)]);
  def('snail-red', [snail(0, true, false), snail(1, true, false)]);
  def('snail-winged', [snail(0, false, true), snail(1, false, true)]);
  def('shell-green', [shell(0, false), shell(1, false)]);
  def('shell-red', [shell(0, true), shell(1, true)]);
  def('plant', [plant(0), plant(1)]);
  def('orb', [orb(0), orb(1)]);
  def('coin', [coin(8), coin(6), coin(3), coin(6)]);
  def('switch', [pswitch(false), pswitch(true)]);
  def('card-star', [card('star')]); def('card-flower', [card('flower')]); def('card-mushroom', [card('mushroom')]);
  const TILE_C = {};
  for (const k of Object.keys(TILES)) { if (k === 'q') TILE_C.q = [toCanvas(TILES.q(0)), toCanvas(TILES.q(1))]; else { const g = TILES[k](); if (g) TILE_C[k] = toCanvas(g); } }

  // hills / clouds / bushes as flat-colour sprites
  function hillSprite(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    for (let row = 0; row < h; row++) {
      const half = Math.round((w / 2) * Math.sqrt(1 - Math.pow((h - row - 1) / h, 2)) );
      x.fillStyle = row < h * 0.35 ? HILL2 : HILL1; x.fillRect(w / 2 - half, row, half * 2, 1);
    }
    x.fillStyle = '#2f8a46'; for (let i = 0; i < 3; i++) x.fillRect(Math.round(w * (0.3 + i * 0.2)), Math.round(h * 0.55), 2, 5);
    return c;
  }
  function cloudSprite(w) {
    const c = document.createElement('canvas'); c.width = w; c.height = 16; const x = c.getContext('2d');
    x.fillStyle = CLOUD2; x.fillRect(2, 12, w - 4, 3);
    x.fillStyle = CLOUD1; x.fillRect(2, 6, w - 4, 7); x.fillRect(6, 3, w - 12, 4); x.fillRect(w / 2 - 4, 1, 8, 3);
    return c;
  }
  const HILLS = [hillSprite(96, 40), hillSprite(64, 28), hillSprite(128, 52)];
  const CLOUDS = [cloudSprite(40), cloudSprite(28), cloudSprite(52)];

  // ---------------------------------------------------------------- renderer
  function create(env) {
    const canvas = document.getElementById('screen');
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (ctx) ctx.imageSmoothingEnabled = false;
    const S = env.S, T = env.T, C = env.C, SOLID = env.SOLID;
    const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    const blit = (spr, x, y, flip) => ctx.drawImage(flip === 'h' ? spr.f : flip === 'v' ? spr.v : spr.c, Math.round(x), Math.round(y));

    function text(str, x, y, col, scale) {
      scale = scale || 1; ctx.fillStyle = col;
      for (const chr of String(str).toUpperCase()) {
        const gl = GLYPHS[chr] || GLYPHS[' '];
        for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (gl[r] & (4 >> b)) ctx.fillRect(x + b * scale, y + r * scale, scale, scale);
        x += 4 * scale;
      }
    }

    function drawBackground(W, cam) {
      R(0, 0, 256, 240, SKY);
      for (let i = 0; i < 12; i++) { const sp = HILLS[i % 3]; const x = i * 140 - Math.floor(cam * 0.5) % 1680 + 20; if (x > -140 && x < 256) ctx.drawImage(sp, x, 208 - sp.height); }
      for (let i = 0; i < 14; i++) { const sp = CLOUDS[i % 3]; const x = i * 120 - Math.floor(cam * 0.25) % 1680 + (i * 37) % 50; if (x > -60 && x < 256) ctx.drawImage(sp, x, 24 + (i * 29) % 56); }
      const goal = W.level.goal;
      if (goal) {
        const dx = goal.c * T - 80 - cam;
        if (dx < 256) {
          R(Math.max(0, dx), 0, 256, 240, DARK);
          for (let i = 0; i < 24; i++) { const sx = Math.max(0, dx) + ((i * 53) % 256), sy = 22 + ((i * 41) % 170); if (sx < 256) R(sx, sy, 1, 1, i % 3 ? '#9fb0e8' : '#ffffff'); }
        }
      }
    }

    function tileSprite(ch, above, frame) {
      switch (ch) {
        case '#': return above ? TILE_C.ground : TILE_C.grass;
        case 'B': return TILE_C.brick; case '?': case 'M': return TILE_C.q[frame];
        case 'U': return TILE_C.used; case 'W': return TILE_C.wood; case 'S': return TILE_C.sw; case '=': return TILE_C.semi;
        case 'L': return TILE_C.pipeL; case 'R': return TILE_C.pipeR; case 'l': return TILE_C.pipel; case 'r': return TILE_C.piper;
      }
      return null;
    }

    function heroPose(W) {
      const p = W.p, ad = Math.abs(p.vx), pad = W.prevPad || {};
      if (p.dead) return 11;
      if (p.inAir) return p.vy < 0 ? 8 : 9;
      if (p.vx !== 0 && ((pad.left && p.vx > 0) || (pad.right && p.vx < 0))) return 7;
      if (p.vx === 0 && pad.down && p.powerup !== 'small') return 10;
      if (p.vx !== 0) return ad >= 40 ? 5 + ((p.anim >> 2) & 1) : 2 + (Math.floor(p.anim / (ad >= 24 ? 5 : 8)) % 3);
      return (W.frame % 150) < 5 ? 1 : 0;
    }

    function enemySprite(e, frame) {
      const f = (frame >> 3) & 1;
      switch (e.type) {
        case 'walker': return e.state === 'squashed' ? SHEET.walker[2] : SHEET.walker[f];
        case 'winged_walker': return SHEET['walker-winged'][f];
        case 'shellback': case 'shellback_red': case 'hopper': {
          const red = e.type === 'shellback_red';
          if (e.state === 'shell' || e.state === 'slide') return SHEET[red ? 'shell-red' : 'shell-green'][e.state === 'slide' ? (frame >> 1) & 1 : 0];
          if (e.winged) return SHEET['snail-winged'][f];
          return SHEET[red ? 'snail-red' : 'snail-green'][f];
        }
        case 'plant': return SHEET.plant[(frame >> 4) & 1];
        case 'orb': return SHEET.orb[(frame >> 2) & 1];
        case 'pswitch': return SHEET.switch[e.state === 'pressed' ? 1 : 0];
      }
      return null;
    }

    function render(W, opts) {
      if (!ctx) return;
      opts = opts || {};
      const p = W.p, cam = Math.round(W.camX), L = W.level, h = env.height(p);
      drawBackground(W, cam);
      const c0 = Math.max(0, Math.floor(cam / T) - 1), c1 = Math.min(L.cols - 1, c0 + 19);
      for (let r = 0; r < L.rows; r++) for (let c = c0; c <= c1; c++) {
        const ch = L.grid[r][c]; if (ch === '.') continue;
        let bump = 0; for (const b of W.bumps) if (b.c === c && b.r === r) bump = Math.round(Math.sin(b.t / 8 * Math.PI) * 5);
        const spr = tileSprite(ch, r > 0 && SOLID.indexOf(L.grid[r - 1][c]) >= 0, (W.frame >> 4) & 1);
        if (spr) ctx.drawImage(spr, c * T - cam, r * T - bump);
      }
      for (const k of L.coins) if (!k.taken) ctx.drawImage(SHEET.coin[(W.frame >> 3) & 3].c, k.c * T - cam + 4, k.r * T + 1);
      if (L.goal) ctx.drawImage(SHEET['card-' + ['mushroom', 'flower', 'star'][Math.floor(W.frame / C.CARD_PERIOD) % 3]][0].c, L.goal.c * T - cam, L.goal.r * T);
      if (opts.enemies !== false) for (const e of W.ents) {
        if (e.state === 'gone') continue;
        const sp = enemySprite(e, W.frame); if (!sp) continue;
        const x = e.x / S - cam;
        if (e.type === 'plant') {
          if (e.rise <= 0) continue;
          ctx.save(); ctx.beginPath(); ctx.rect(x, 0, 32, e.baseFeet / S); ctx.clip();
          ctx.drawImage(sp.c, Math.round(x + 8), Math.round(e.feet / S - e.h)); ctx.restore(); continue;
        }
        const y = e.feet / S - (e.type === 'pswitch' ? 16 : 16);
        const face = e.vx > 0 && (e.type === 'shellback' || e.type === 'shellback_red' || e.type === 'hopper') && e.state === 'walking';
        const flipped = e.state === 'flipped';
        blit(sp, x, y, flipped ? 'v' : (e.type === 'shellback' || e.type === 'shellback_red' || e.type === 'hopper') && e.state === 'walking' && !face ? 'h' : null);
      }
      for (const q of W.pops) ctx.drawImage(SHEET.coin[(q.t >> 1) & 3].c, q.x - cam + 4, Math.round(q.y - Math.sin(q.t / 30 * Math.PI) * 30));
      for (const d of W.parts) R(d.x - cam, d.y, 6, 6, '#c4502a');
      if (opts.hero !== false && !(p.dead && W.deadT > 100)) {
        if (!(p.invuln > 0 && (p.anim & 4))) {
          const spr = SHEET[h === 16 ? 'hero-s' : 'hero-b'][heroPose(W)];
          blit(spr, p.x / S - cam, p.feet / S - h, p.facing < 0 ? 'h' : null);
        }
      }
      if (opts.hud !== false) hud(W);
    }

    function hud(W) {
      const p = W.p, n = env.popcount(p.power);
      R(0, 0, 256, 18, '#000000');
      text('SCORE', 6, 3, '#9fb0e8'); text(String(p.score).padStart(7, '0'), 6, 10, '#ffffff');
      text('COINS', 62, 3, '#9fb0e8'); text('x' + String(W.coins).padStart(2, '0'), 62, 10, '#ffd43b');
      text('TIME', 108, 3, '#9fb0e8'); text(String(W.time).padStart(3, '0'), 108, 10, '#ffffff');
      text('LIVES', 140, 3, '#9fb0e8'); text('x' + W.lives, 140, 10, '#ffffff');
      for (let i = 0; i < 6; i++) R(176 + i * 7, 10, 5, 5, i < n ? '#ffd43b' : '#3a3f55');
      R(220, 9, 14, 7, n === 7 ? '#ee5a3c' : '#3a3f55'); text('P', 226, 10, '#ffffff');
      if (W.switchT > 0) text('SWITCH ' + Math.ceil(W.switchT / 60), 176, 3, '#34b8ff');
      if (W.cleared && W.clearT > 20) {
        R(40, 80, 176, 56, '#000000'); R(41, 81, 174, 54, '#1459a0');
        text('COURSE CLEAR!', 62, 94, '#ffd43b', 2); text('YOU GOT A ' + String(W.card).toUpperCase() + ' CARD', 56, 112, '#ffffff', 1); text('ENTER = PLAY AGAIN', 62, 124, '#ffffff', 1);
      }
      if (p.dead && W.deadT > 40) text(W.lives <= 1 ? 'GAME OVER' : 'TRY AGAIN', 98, 110, '#ffffff', 2);
    }

    function sprites() {
      const out = {};
      for (const [name, frames] of Object.entries(SHEET)) {
        out[name] = frames.map((fr) => {
          const cv = fr.c, w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
          const cols = new Set(); let x0 = w, y0 = h, x1 = -1, y1 = -1, alphaOk = true, hash = 7, shape = 11;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4, a = d[i + 3];
            if (a !== 0 && a !== 255) alphaOk = false;
            hash = (hash * 31 + d[i] * 7 + d[i + 1] * 13 + d[i + 2] * 17 + a) >>> 0; shape = (shape * 31 + (a ? 1 : 0)) >>> 0;
            if (a) { cols.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
          }
          return { w, h, colors: cols.size, alphaOk, hash, shape, bbox: { x0, y0, x1, y1 } };
        });
      }
      return out;
    }
    return { render, sprites, text };
  }

  window.CourierRender = { create, PAL, SHEET, HERO_POSES };
})();
