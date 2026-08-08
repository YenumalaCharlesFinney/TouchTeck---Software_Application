import React, { useEffect, useRef } from 'react';

/* ============================================================
   Non-pool home backgrounds.

   These are deliberately NOT variations of the water — each is a different
   design language for the same brand. All of them are plain 2D canvas so they
   cost far less than the WebGL pool, and they degrade to a flat background if
   the context is unavailable.

   One canvas + one animation loop serves every mode; the mode only swaps which
   draw function runs, which keeps the per-design code down to the drawing
   itself.
   ============================================================ */

export type CanvasMode = 'grid' | 'signal' | 'particles' | 'scoreboard' | 'aurora' | 'still' | 'binary' | 'binaryFall';

/* Pointer position in canvas space, shared with the designs that react to it. */
type Pointer = { x: number; y: number; active: boolean };

/* A click, recorded where and when, so a ring can be expanded from it. `t` is
   negative until the first press. */
type Pulse = { x: number; y: number; t: number };

const YELLOW = '#fff500';
const CYAN = '#06b6d4';
const BG = '#02060d';

/* ---------------- individual designs ---------------- */

/* Perspective lane grid — the pool reduced to a technical drawing. */
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const horizon = h * 0.42;
  ctx.lineWidth = 1;

  // lane lines converging on a vanishing point
  for (let i = -9; i <= 9; i++) {
    const x = w / 2 + i * (w / 9);
    ctx.strokeStyle = i === 0 ? 'rgba(255,245,0,0.35)' : 'rgba(6,182,212,0.20)';
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * 26, horizon);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // cross rungs sliding toward the viewer, spaced so they bunch at the horizon
  for (let r = 0; r < 22; r++) {
    const p = ((r + (t * 0.16) % 1) / 22) ** 2.6;
    const y = horizon + p * (h - horizon);
    ctx.strokeStyle = `rgba(6,182,212,${0.05 + p * 0.24})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const glow = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, w * 0.5);
  glow.addColorStop(0, 'rgba(6,182,212,0.18)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

/* Oscilloscope traces — what the ARES 21 cable actually carries. */
function drawSignal(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const lanes = 8;
  for (let i = 0; i < lanes; i++) {
    const y = (h / (lanes + 1)) * (i + 1);
    const amp = 12 + (i % 3) * 7;
    const speed = 0.6 + i * 0.08;
    const isHot = i === 3;

    ctx.strokeStyle = isHot ? 'rgba(255,245,0,0.75)' : `rgba(6,182,212,${0.18 + (i % 4) * 0.06})`;
    ctx.lineWidth = isHot ? 2 : 1;
    ctx.beginPath();

    for (let x = 0; x <= w; x += 4) {
      const phase = x * 0.012 - t * speed;
      // a slow carrier with an occasional sharp spike, like a touch event
      const spike = Math.exp(-(((x / w) * 6 - ((t * 0.5 + i) % 6)) ** 2) * 6) * amp * 2.4;
      const v = Math.sin(phase) * amp * 0.35 + Math.sin(phase * 2.3) * amp * 0.18 + spike;
      const py = y - v;
      if (x === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.stroke();
  }
}

/* Constellation of touch points, linked when close. */
type P = { x: number; y: number; vx: number; vy: number };
let pts: P[] = [];
function drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, _t: number) {
  const target = Math.min(90, Math.round((w * h) / 22000));
  if (pts.length !== target) {
    pts = Array.from({ length: target }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.32,
      vy: (Math.random() - 0.5) * 0.32,
    }));
  }

  for (const p of pts) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > w) p.vx *= -1;
    if (p.y < 0 || p.y > h) p.vy *= -1;
  }

  // links first so dots sit on top
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 130 * 130) continue;
      ctx.strokeStyle = `rgba(6,182,212,${(1 - Math.sqrt(d2) / 130) * 0.22})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[j].x, pts[j].y);
      ctx.stroke();
    }
  }

  for (let i = 0; i < pts.length; i++) {
    ctx.fillStyle = i % 11 === 0 ? 'rgba(255,245,0,0.85)' : 'rgba(160,230,255,0.5)';
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, i % 11 === 0 ? 2.2 : 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* Dot-matrix board, the way the results wall reads from the deck — with the
   rain falling down it and the same cursor and click behaviour as Binary. */
const SCORE_CELL = 14;

/* ~6,700 dots a frame, so the same trick as the glyphs: rasterise one dot per
   colour and blit it, rather than an arc + fill per cell. */
let dotCyan: HTMLCanvasElement | null = null;
let dotYellow: HTMLCanvasElement | null = null;

function makeDot(colour: string) {
  const size = SCORE_CELL * 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = colour;
  g.beginPath();
  g.arc(size / 2, size / 2, 4.2, 0, Math.PI * 2);
  g.fill();
  return c;
}

let scoreGlow: Float32Array = new Float32Array(0);
let scoreHeads: Float32Array = new Float32Array(0);
let scoreSpeeds: Float32Array = new Float32Array(0);
let scoreTails: Uint8Array = new Uint8Array(0);
let scoreCols = 0;
let scoreRows = 0;
let lastScoreT = -1;

function drawScoreboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  ptr: Pointer,
  pulse: Pulse,
) {
  const cols = Math.ceil(w / SCORE_CELL);
  const rows = Math.ceil(h / SCORE_CELL);

  if (cols !== scoreCols || rows !== scoreRows) {
    scoreCols = cols;
    scoreRows = rows;
    scoreGlow = new Float32Array(cols * rows);
    scoreHeads = new Float32Array(cols);
    scoreSpeeds = new Float32Array(cols);
    scoreTails = new Uint8Array(cols);
    for (let c = 0; c < cols; c++) {
      scoreHeads[c] = -Math.random() * rows;
      scoreSpeeds[c] = 7 + Math.random() * 14;
      scoreTails[c] = 8 + Math.floor(Math.random() * 14);
    }
  }

  const dt = lastScoreT < 0 ? 0.016 : Math.min(t - lastScoreT, 0.05);
  lastScoreT = t;

  for (let i = 0; i < scoreGlow.length; i++) scoreGlow[i] *= 0.93;

  if (ptr.active) {
    const reach = 68;
    const c0 = Math.max(0, Math.floor((ptr.x - reach) / SCORE_CELL));
    const c1 = Math.min(cols - 1, Math.ceil((ptr.x + reach) / SCORE_CELL));
    const r0 = Math.max(0, Math.floor((ptr.y - reach) / SCORE_CELL));
    const r1 = Math.min(rows - 1, Math.ceil((ptr.y + reach) / SCORE_CELL));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = c * SCORE_CELL + SCORE_CELL / 2 - ptr.x;
        const dy = r * SCORE_CELL + SCORE_CELL / 2 - ptr.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > reach) continue;
        const v = 1 - d / reach;
        if (v > scoreGlow[r * cols + c]) scoreGlow[r * cols + c] = v;
      }
    }
  }

  const PULSE_LIFE = 2.4;
  const age = t - pulse.t;
  if (pulse.t >= 0 && age >= 0 && age < PULSE_LIFE) {
    const radius = age * 430;
    const band = 78;
    const fade = 1 - age / PULSE_LIFE;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = c * SCORE_CELL + SCORE_CELL / 2 - pulse.x;
        const dy = r * SCORE_CELL + SCORE_CELL / 2 - pulse.y;
        const off = Math.abs(Math.sqrt(dx * dx + dy * dy) - radius);
        if (off > band) continue;
        const v = (1 - off / band) * fade;
        if (v > scoreGlow[r * cols + c]) scoreGlow[r * cols + c] = v;
      }
    }
  }

  // falling heads, quickened near the cursor exactly as the rain is
  const headRow = new Int32Array(cols);
  for (let c = 0; c < cols; c++) {
    const colX = c * SCORE_CELL + SCORE_CELL / 2;
    const near = ptr.active ? Math.max(0, 1 - Math.abs(colX - ptr.x) / 190) : 0;
    scoreHeads[c] += scoreSpeeds[c] * (1 + near * 2.2) * dt;
    if (scoreHeads[c] - scoreTails[c] > rows) {
      scoreHeads[c] = -Math.random() * 14;
      scoreSpeeds[c] = 7 + Math.random() * 14;
      scoreTails[c] = 8 + Math.floor(Math.random() * 14);
    }
    headRow[c] = Math.floor(scoreHeads[c]);
  }

  if (!dotCyan) dotCyan = makeDot('#06b6d4');
  if (!dotYellow) dotYellow = makeDot('#fff500');

  for (let c = 0; c < cols; c++) {
    const head = headRow[c];
    const tail = scoreTails[c];
    for (let r = 0; r < rows; r++) {
      // the board's own shimmer underneath everything
      const wave = Math.sin(c * 0.16 - t * 1.5 + r * 0.28);
      let a = 0.06 + (wave + 1) * 0.03;
      let warm = r % 7 === 2 && wave > 0.86;
      if (warm) a = 0.5;

      const k = head - r;
      if (k >= 0 && k < tail) {
        const trail = k === 0 ? 1 : Math.max(0, (1 - k / tail) * 0.8);
        if (trail > a) {
          a = trail;
          warm = true;
        }
      }

      const g = scoreGlow[r * cols + c];
      if (g > 0.05) {
        const lit = 0.25 + g * 0.75;
        if (lit > a) {
          a = lit;
          warm = g > 0.3;
        }
      }

      ctx.globalAlpha = Math.min(a, 1);
      ctx.drawImage(warm ? dotYellow : dotCyan, c * SCORE_CELL, r * SCORE_CELL, SCORE_CELL, SCORE_CELL);
    }
  }

  ctx.globalAlpha = 1;
}

/* Soft drifting colour fields — the calmest, most "design" option. */
function drawAurora(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const blobs = [
    { c: '6,182,212', x: 0.28, y: 0.32, r: 0.62, sx: 0.11, sy: 0.07 },
    { c: '255,245,0', x: 0.74, y: 0.28, r: 0.5, sx: -0.09, sy: 0.05 },
    { c: '30,90,200', x: 0.5, y: 0.78, r: 0.7, sx: 0.06, sy: -0.08 },
  ];

  for (const b of blobs) {
    const cx = (b.x + Math.sin(t * b.sx) * 0.09) * w;
    const cy = (b.y + Math.cos(t * b.sy) * 0.08) * h;
    const rad = b.r * Math.max(w, h) * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(${b.c},0.26)`);
    g.addColorStop(0.5, `rgba(${b.c},0.08)`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

/* A field of zeros that flips to ones under the cursor, and holds the trail.

   Each cell carries an energy value that the pointer sets to full and that
   decays slowly afterwards, so the path you drew stays readable for a few
   seconds instead of vanishing the moment the cursor leaves. */
let bin: Float32Array = new Float32Array(0);
let binCols = 0;
let binRows = 0;
const BIN_CELL = 22;

/* The field is ~2,800 cells at full screen. Calling fillText that many times a
   frame is far too slow, so each glyph is rasterised once and then blitted;
   per-cell brightness comes from globalAlpha rather than a new fill colour. */
let glyphZero: HTMLCanvasElement | null = null;
let glyphOne: HTMLCanvasElement | null = null;

/* Ones that fall toward the logo from off-screen, in twos and threes, pulled
   harder the closer they get — the field feeding the mark. They light the
   cells they pass over, so each one leaves a burning-in trail behind it. */
type Traveller = { x: number; y: number; vx: number; vy: number; born: number };
let travellers: Traveller[] = [];
let lastSpawn = -1;
let lastBinT = -1;

function makeGlyph(ch: string, colour: string) {
  const size = BIN_CELL * 2; // 2x so it stays crisp on HiDPI displays
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return c;
  g.font = `${Math.round(size * 0.72)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = colour;
  g.fillText(ch, size / 2, size / 2);
  return c;
}

function drawBinary(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  ptr: Pointer,
  pulse: Pulse,
) {
  const cols = Math.ceil(w / BIN_CELL);
  const rows = Math.ceil(h / BIN_CELL);
  if (cols !== binCols || rows !== binRows) {
    binCols = cols;
    binRows = rows;
    bin = new Float32Array(cols * rows);
  }

  for (let i = 0; i < bin.length; i++) bin[i] *= 0.985;

  // light every cell within reach of the cursor
  if (ptr.active) {
    const reach = 62;
    const c0 = Math.max(0, Math.floor((ptr.x - reach) / BIN_CELL));
    const c1 = Math.min(cols - 1, Math.ceil((ptr.x + reach) / BIN_CELL));
    const r0 = Math.max(0, Math.floor((ptr.y - reach) / BIN_CELL));
    const r1 = Math.min(rows - 1, Math.ceil((ptr.y + reach) / BIN_CELL));

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = c * BIN_CELL + BIN_CELL / 2 - ptr.x;
        const dy = r * BIN_CELL + BIN_CELL / 2 - ptr.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > reach) continue;
        const v = 1 - d / reach;
        const idx = r * cols + c;
        if (v > bin[idx]) bin[idx] = v;
      }
    }
  }

  // A press throws a ring of ones outward, the binary answer to the water's
  // start pulse. The band is narrow so it reads as a travelling wavefront
  // rather than the whole field lighting up.
  const PULSE_LIFE = 2.4;
  const age = t - pulse.t;
  if (pulse.t >= 0 && age >= 0 && age < PULSE_LIFE) {
    const radius = age * 430;
    const band = 78;
    const fade = 1 - age / PULSE_LIFE;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = c * BIN_CELL + BIN_CELL / 2 - pulse.x;
        const dy = r * BIN_CELL + BIN_CELL / 2 - pulse.y;
        const off = Math.abs(Math.sqrt(dx * dx + dy * dy) - radius);
        if (off > band) continue;
        const v = (1 - off / band) * fade;
        const idx = r * cols + c;
        if (v > bin[idx]) bin[idx] = v;
      }
    }
  }

  /* ---- ones drawn toward the logo ---- */

  const dt = lastBinT < 0 ? 0.016 : Math.min(t - lastBinT, 0.05);
  lastBinT = t;

  // roughly where the logo sits in the centre stack
  const tx = w / 2;
  const ty = h * 0.34;

  if (lastSpawn < 0 || t - lastSpawn > 0.8) {
    lastSpawn = t;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(w, h) * 0.65;
    const batch = 2 + Math.floor(Math.random() * 2); // twos and threes
    for (let i = 0; i < batch; i++) {
      const spread = (i - (batch - 1) / 2) * 30;
      travellers.push({
        x: tx + Math.cos(angle) * dist + Math.cos(angle + Math.PI / 2) * spread,
        y: ty + Math.sin(angle) * dist + Math.sin(angle + Math.PI / 2) * spread,
        vx: 0,
        vy: 0,
        born: t,
      });
    }
  }

  for (const tr of travellers) {
    const dx = tx - tr.x;
    const dy = ty - tr.y;
    const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    // pull rises as it closes in, so they visibly accelerate at the end
    const pull = 26000 / Math.max(d, 90);
    tr.vx += (dx / d) * pull * dt;
    tr.vy += (dy / d) * pull * dt;
    tr.x += tr.vx * dt;
    tr.y += tr.vy * dt;

    // scorch the cell underneath so the path stays visible in the field
    const cc = Math.floor(tr.x / BIN_CELL);
    const rr = Math.floor(tr.y / BIN_CELL);
    if (cc >= 0 && cc < cols && rr >= 0 && rr < rows) bin[rr * cols + cc] = 1;
  }

  travellers = travellers.filter((tr) => {
    const dx = tx - tr.x;
    const dy = ty - tr.y;
    return dx * dx + dy * dy > 30 * 30 && t - tr.born < 14;
  });

  if (!glyphZero) glyphZero = makeGlyph('0', '#06b6d4');
  if (!glyphOne) glyphOne = makeGlyph('1', '#fff500');

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      // a slow diagonal sweep keeps the field alive when nothing is moving
      const ambient = Math.sin(c * 0.35 + r * 0.22 - t * 0.9) > 0.93 ? 0.5 : 0;
      const e = Math.max(bin[idx], ambient);
      const isOne = e > 0.3;

      ctx.globalAlpha = isOne ? 0.35 + e * 0.65 : 0.1 + e * 0.5;
      ctx.drawImage(isOne ? glyphOne : glyphZero, c * BIN_CELL, r * BIN_CELL, BIN_CELL, BIN_CELL);
    }
  }

  // the incoming ones ride above the field, larger and at full strength so
  // they read as objects rather than lit cells
  for (const tr of travellers) {
    const size = BIN_CELL * 1.5;
    ctx.globalAlpha = 1;
    ctx.drawImage(glyphOne, tr.x - size / 2, tr.y - size / 2, size, size);
  }

  ctx.globalAlpha = 1;
}

/* The same binary field, raining downward instead of being pulled inward.
   Each column drops a bright head with a fading tail behind it. */
let fallHeads: Float32Array = new Float32Array(0);
let fallSpeeds: Float32Array = new Float32Array(0);
let fallTails: Uint8Array = new Uint8Array(0);
let fallGlow: Float32Array = new Float32Array(0);
let fallCols = 0;
let fallRows = 0;
let lastFallT = -1;

function drawBinaryFall(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  ptr: Pointer,
  pulse: Pulse,
) {
  const cols = Math.ceil(w / BIN_CELL);
  const rows = Math.ceil(h / BIN_CELL);

  if (cols !== fallCols || rows !== fallRows) {
    fallCols = cols;
    fallRows = rows;
    fallHeads = new Float32Array(cols);
    fallSpeeds = new Float32Array(cols);
    fallTails = new Uint8Array(cols);
    fallGlow = new Float32Array(cols * rows);
    for (let c = 0; c < cols; c++) {
      fallHeads[c] = -Math.random() * rows;
      fallSpeeds[c] = 6 + Math.random() * 12; // rows per second
      fallTails[c] = 6 + Math.floor(Math.random() * 12);
    }
  }

  const dt = lastFallT < 0 ? 0.016 : Math.min(t - lastFallT, 0.05);
  lastFallT = t;

  for (let i = 0; i < fallGlow.length; i++) fallGlow[i] *= 0.93;

  // the cursor lights the field it passes over, same as the pull version
  if (ptr.active) {
    const reach = 68;
    const c0 = Math.max(0, Math.floor((ptr.x - reach) / BIN_CELL));
    const c1 = Math.min(cols - 1, Math.ceil((ptr.x + reach) / BIN_CELL));
    const r0 = Math.max(0, Math.floor((ptr.y - reach) / BIN_CELL));
    const r1 = Math.min(rows - 1, Math.ceil((ptr.y + reach) / BIN_CELL));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = c * BIN_CELL + BIN_CELL / 2 - ptr.x;
        const dy = r * BIN_CELL + BIN_CELL / 2 - ptr.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > reach) continue;
        const v = 1 - d / reach;
        const idx = r * cols + c;
        if (v > fallGlow[idx]) fallGlow[idx] = v;
      }
    }
  }

  // a click sends the same expanding ring the pull version uses
  const PULSE_LIFE = 2.4;
  const age = t - pulse.t;
  if (pulse.t >= 0 && age >= 0 && age < PULSE_LIFE) {
    const radius = age * 430;
    const band = 78;
    const fade = 1 - age / PULSE_LIFE;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = c * BIN_CELL + BIN_CELL / 2 - pulse.x;
        const dy = r * BIN_CELL + BIN_CELL / 2 - pulse.y;
        const off = Math.abs(Math.sqrt(dx * dx + dy * dy) - radius);
        if (off > band) continue;
        const v = (1 - off / band) * fade;
        const idx = r * cols + c;
        if (v > fallGlow[idx]) fallGlow[idx] = v;
      }
    }
  }

  if (!glyphZero) glyphZero = makeGlyph('0', '#06b6d4');
  if (!glyphOne) glyphOne = makeGlyph('1', '#fff500');

  // dim substrate of zeros, brightening into ones wherever the cursor has been
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const g = fallGlow[r * cols + c];
      if (g > 0.3) {
        ctx.globalAlpha = 0.35 + g * 0.65;
        ctx.drawImage(glyphOne, c * BIN_CELL, r * BIN_CELL, BIN_CELL, BIN_CELL);
      } else {
        ctx.globalAlpha = 0.09 + g * 0.5;
        ctx.drawImage(glyphZero, c * BIN_CELL, r * BIN_CELL, BIN_CELL, BIN_CELL);
      }
    }
  }

  for (let c = 0; c < cols; c++) {
    // columns near the cursor race — the rain reacts to where you are
    const colX = c * BIN_CELL + BIN_CELL / 2;
    const near = ptr.active ? Math.max(0, 1 - Math.abs(colX - ptr.x) / 190) : 0;
    fallHeads[c] += fallSpeeds[c] * (1 + near * 2.2) * dt;

    const tail = fallTails[c];
    if (fallHeads[c] - tail > rows) {
      fallHeads[c] = -Math.random() * 12;
      fallSpeeds[c] = 6 + Math.random() * 12;
      fallTails[c] = 6 + Math.floor(Math.random() * 12);
    }

    const head = Math.floor(fallHeads[c]);
    for (let k = 0; k < tail; k++) {
      const r = head - k;
      if (r < 0 || r >= rows) continue;
      ctx.globalAlpha = k === 0 ? 1 : Math.max(0, (1 - k / tail) * 0.72);
      ctx.drawImage(glyphOne, c * BIN_CELL, r * BIN_CELL, BIN_CELL, BIN_CELL);
    }
  }

  ctx.globalAlpha = 1;
}

/* No motion at all — a flat brand wash. */
function drawStill(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#040b16');
  g.addColorStop(0.55, '#03070f');
  g.addColorStop(1, '#02060d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.55);
  glow.addColorStop(0, 'rgba(6,182,212,0.13)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

/* ---------------- host ---------------- */

export default function CanvasBackground({
  mode,
  interactive = true,
}: {
  mode: CanvasMode;
  /* Off for the app-wide backdrop: the field should not chase the cursor or
     fire a ring every time someone clicks a control while running a meet. */
  interactive?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // read inside the loop so switching designs doesn't restart the animation
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const ptr: Pointer = { x: 0, y: 0, active: false };
    const pulse: Pulse = { x: 0, y: 0, t: -1 };
    const started = performance.now();

    // tracked on the window rather than the canvas, because the logo and
    // buttons sit on top and would otherwise swallow the movement
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
      ptr.active = true;
    };
    const onLeave = () => {
      ptr.active = false;
    };
    const onDown = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pulse.x = e.clientX - r.left;
      pulse.y = e.clientY - r.top;
      pulse.t = (performance.now() - started) / 1000;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = []; // re-seed the constellation for the new size
      binCols = 0; // force the binary grid to be rebuilt at the new size
      fallCols = 0; // and the rain columns
      scoreCols = 0; // and the board's columns and glow
      travellers = [];
    };

    resize();
    window.addEventListener('resize', resize);
    if (interactive) {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerleave', onLeave);
      window.addEventListener('pointerdown', onDown);
    }

    const frame = () => {
      const t = (performance.now() - started) / 1000;

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      switch (modeRef.current) {
        case 'grid': drawGrid(ctx, w, h, t); break;
        case 'signal': drawSignal(ctx, w, h, t); break;
        case 'particles': drawParticles(ctx, w, h, t); break;
        case 'scoreboard': drawScoreboard(ctx, w, h, t, ptr, pulse); break;
        case 'aurora': drawAurora(ctx, w, h, t); break;
        case 'still': drawStill(ctx, w, h); break;
        case 'binary': drawBinary(ctx, w, h, t, ptr, pulse); break;
        case 'binaryFall': drawBinaryFall(ctx, w, h, t, ptr, pulse); break;
      }

      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [interactive]);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

export { YELLOW, CYAN };
