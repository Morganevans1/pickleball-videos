'use strict';
// "Find Your Bounce" — every frame is a pure function of time t (seconds).
(function () {
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  const TL = window.TL;
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');

  // ------------------------------------------------------------------ palette
  const P = {
    night: '#060E16', navy: '#0B1A28', deep: '#11263A',
    court: '#3A6482', court2: '#335B78', courtHi: '#4E7E9E',
    clay: '#B9805A', clayDark: '#9A6443',
    line: '#F2EEE5', paper: '#F1EBDF', ink: '#0E1C2B',
    ball: '#D8EE3A', ballHi: '#F6FFB0', ballLo: '#87A014',
    paddleEdge: '#0A0B0D',
  };
  const FD = '"Inter Display", "Inter", sans-serif';
  const FT = '"Inter", sans-serif';
  const FM = '"JetBrains Mono", monospace';
  const font = (size, weight = 900, fam = FD, italic = false) => `${italic ? 'italic ' : ''}${weight} ${size}px ${fam}`;

  // ------------------------------------------------------------------ math
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (a, b, x) => clamp((x - a) / (b - a));
  const E = {
    inQuad: t => t * t, outQuad: t => 1 - (1 - t) * (1 - t),
    inCubic: t => t * t * t, outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuint: t => 1 - Math.pow(1 - t, 5),
    outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  function makeCam(pos, target, fovDeg) {
    const fw = norm(sub(target, pos));
    const right = norm(cross([0, 1, 0], fw));
    const up = cross(fw, right);
    return { pos, fw, right, up, f: (H / 2) / Math.tan(fovDeg * Math.PI / 360) };
  }
  function proj(cam, p) {
    const d = sub(p, cam.pos);
    const z = Math.max(0.02, dot(d, cam.fw));
    return { x: W / 2 + cam.f * dot(d, cam.right) / z, y: H / 2 - cam.f * dot(d, cam.up) / z, z, s: cam.f / z };
  }
  function poly3(cam, pts, fill, c = ctx) {
    c.beginPath();
    pts.forEach((p, i) => { const q = proj(cam, p); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
    c.closePath(); c.fillStyle = fill; c.fill();
  }
  const groundRect = (cam, x0, x1, z0, z1, fill, c = ctx) =>
    poly3(cam, [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], fill, c);

  // ------------------------------------------------------------------ assets
  const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const OFF = makeCanvas(W, H), octx = OFF.getContext('2d');
  const PAT = {};
  function makeNoise(size, seed, amp) {
    const c = makeCanvas(size, size), x = c.getContext('2d');
    const id = x.createImageData(size, size), R = rng(seed);
    for (let i = 0; i < size * size; i++) {
      const v = R() < 0.5 ? 255 : 0;
      id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v;
      id.data[i * 4 + 3] = Math.floor(R() * amp * 255);
    }
    x.putImageData(id, 0, 0);
    return ctx.createPattern(c, 'repeat');
  }
  function makeCarbon() {
    const s = 32, c = makeCanvas(s, s), x = c.getContext('2d');
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const on = ((i + j) % 4) < 2;
      const g = x.createLinearGradient(i * 4, j * 4, i * 4 + 4, j * 4 + 4);
      g.addColorStop(0, on ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.02)');
      g.addColorStop(1, on ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)');
      x.fillStyle = g; x.fillRect(i * 4, j * 4, 4, 4);
    }
    return ctx.createPattern(c, 'repeat');
  }
  const IMG = [];
  function loadFootage() {
    const jobs = [];
    for (let i = 1; i <= 148; i++) {
      const im = new Image();
      im.src = `assets/footage/f_${String(i).padStart(3, '0')}.jpg`;
      IMG.push(im);
      jobs.push(im.decode().catch(() => {}));
    }
    return Promise.all(jobs);
  }

  // ------------------------------------------------------------------ drawing helpers
  const HOLES = (() => {
    const n = 26, pts = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    return pts;
  })();
  function rot3(v, ax, ay) {
    let [x, y, z] = v;
    let c = Math.cos(ay), s = Math.sin(ay);
    [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(ax); s = Math.sin(ax);
    [y, z] = [y * c - z * s, y * s + z * c];
    return [x, y, z];
  }
  function drawBall(x, y, r, o = {}) {
    if (r < 0.6) return;
    const sq = o.squash || 0;
    ctx.save();
    ctx.translate(x, y);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.glow) {
      const gg = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 2.6);
      gg.addColorStop(0, `rgba(216,238,58,${0.30 * o.glow})`);
      gg.addColorStop(1, 'rgba(216,238,58,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, TAU); ctx.fill();
    }
    if (sq) { const a = o.squashAngle || 0; ctx.rotate(a); ctx.scale(1 + sq * 0.55, 1 - sq); ctx.rotate(-a); }
    let g = ctx.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.04, -r * 0.1, -r * 0.1, r * 1.15);
    g.addColorStop(0, P.ballHi); g.addColorStop(0.42, P.ball); g.addColorStop(1, P.ballLo);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    if (r > 8) {
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
      const hr = r * 0.135;
      for (const h of HOLES) {
        const v = rot3(h, o.spinX || 0, o.spinY || 0);
        if (v[2] < 0.04) continue;
        const cx = v[0] * r, cy = v[1] * r, a = Math.atan2(cy, cx);
        const lit = clamp(0.5 + 0.5 * (-v[0] * 0.45 - v[1] * 0.55 + v[2] * 0.5));
        const fz = Math.max(v[2], 0.05);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.globalAlpha = clamp(v[2] * 2.4) * 0.92;
        ctx.fillStyle = `rgb(${Math.round(96 + 60 * lit)},${Math.round(116 + 64 * lit)},${Math.round(10 + 14 * lit)})`;
        ctx.beginPath(); ctx.ellipse(0, 0, hr * fz, hr, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgb(${Math.round(48 + 30 * lit)},${Math.round(60 + 34 * lit)},6)`;
        ctx.beginPath(); ctx.ellipse(-hr * 0.22 * (1 - fz), 0, hr * fz * 0.72, hr * 0.72, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    g = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
    g.addColorStop(0, 'rgba(30,40,0,0)'); g.addColorStop(1, 'rgba(24,34,0,0.42)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    if (r > 6) {
      ctx.strokeStyle = 'rgba(170,205,255,0.22)'; ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.965, -0.1, 1.55); ctx.stroke();
    }
    g = ctx.createRadialGradient(-r * 0.36, -r * 0.4, 0, -r * 0.36, -r * 0.4, r * 0.46);
    g.addColorStop(0, 'rgba(255,255,255,0.62)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function ghosts(pts, alpha = 0.5) { // pts: oldest..newest, excluding the current ball
    ctx.save();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const q = pts[i], k = (i + 1) / (n + 1);
      ctx.globalAlpha = alpha * k * k;
      ctx.fillStyle = P.ball;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (0.55 + 0.45 * k), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function softShadow(x, y, rx, ry, a) {
    if (a <= 0.002) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.45, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function ring(x, y, r, lw, color, sy = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, sy);
    ctx.strokeStyle = color; ctx.lineWidth = lw / Math.max(sy, 0.05);
    ctx.beginPath(); ctx.arc(0, 0, Math.max(0.1, r), 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function burst(x, y, age, o = {}) {
    const { r0 = 40, r1 = 160, n = 12, lw = 3, dur = 0.18, seed = 1, color = '255,255,250', alpha = 0.9, rot = 0, spread = TAU } = o;
    const p = age / dur;
    if (p < 0 || p > 1) return;
    const R = rng(seed);
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = rot + (spread === TAU ? (i / n) * TAU : (i / (n - 1) - 0.5) * spread) + (R() - 0.5) * 0.25;
      const len = 0.6 + R() * 0.6;
      const ra = lerp(r0, r1 * len, E.outCubic(p)), rb = lerp(r0, r1 * len, E.outCubic(clamp(p * 1.9)));
      ctx.strokeStyle = `rgba(${color},${alpha * (1 - p)})`; ctx.lineWidth = lw * (1 - p * 0.6);
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * ra, y + Math.sin(a) * ra); ctx.lineTo(x + Math.cos(a) * rb, y + Math.sin(a) * rb); ctx.stroke();
    }
    ctx.restore();
  }
  function bokeh(seed, n, y0, y1, shift = 0, mul = 1) {
    const R = rng(seed);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x = R() * W * 1.1 - W * 0.05 + shift * (0.5 + R());
      const y = y0 + R() * (y1 - y0), r = 12 + R() * 48, warm = R() < 0.72, a = (0.035 + R() * 0.11) * mul;
      const c = warm ? '255,226,190' : '175,205,255';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c},${a * 0.65})`); g.addColorStop(0.8, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function motes(seed, n, t, x0, y0, x1, y1, a = 0.5, s = 1, speed = 1) {
    const R = rng(seed), hgt = y1 - y0;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const bx = x0 + R() * (x1 - x0), by = R() * hgt, ph = R() * TAU, sp = 0.2 + R() * 0.6;
      const sz = (0.8 + R() * 2.2) * s, al = (0.25 + R() * 0.75) * a;
      const x = bx + Math.sin(t * sp * speed + ph) * 16;
      const y = y0 + ((((by - t * sp * 10 * speed) % hgt) + hgt) % hgt);
      ctx.fillStyle = `rgba(255,244,225,${al})`;
      ctx.beginPath(); ctx.arc(x, y, sz, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function vignette(a = 0.45) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function blurred(px, fn) {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, W, H);
    octx.setTransform(ctx.getTransform());
    fn(octx);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `blur(${px}px)`;
    ctx.drawImage(OFF, 0, 0); ctx.restore();
  }
  function shake(seed, amp, t) {
    if (amp < 0.05) return [0, 0];
    return [Math.sin(t * 91 + seed) * amp + Math.sin(t * 57 + seed * 2) * amp * 0.5,
            Math.cos(t * 83 + seed * 3) * amp + Math.sin(t * 41 + seed) * amp * 0.5];
  }
  function lastBefore(arr, t) { let k = -1; for (let i = 0; i < arr.length; i++) if (arr[i] <= t) k = i; return k; }

  // text ------------------------------------------------------------------
  function txt(str, x, y, o = {}) {
    const { size = 40, weight = 900, fam = FD, italic = false, color = P.paper, align = 'left', ls = 0, alpha = 1 } = o;
    if (alpha <= 0) return 0;
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.font = font(size, weight, fam, italic); ctx.letterSpacing = ls + 'px';
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }
  function measure(str, size, weight = 900, fam = FD, italic = false, ls = 0) {
    ctx.save(); ctx.font = font(size, weight, fam, italic); ctx.letterSpacing = ls + 'px';
    const w = ctx.measureText(str).width; ctx.restore(); return w;
  }
  // Letter-by-letter reveal from behind a baseline mask.
  function reveal(str, x, y, t, t0, o = {}) {
    const { size = 100, weight = 900, fam = FD, italic = false, color = P.paper, stagger = 0.035, dur = 0.42,
      ls = 0, align = 'left', rise = 1.0, mask = true, alpha = 1, fade = false } = o;
    if (alpha <= 0) return;
    ctx.save();
    ctx.font = font(size, weight, fam, italic); ctx.letterSpacing = ls + 'px';
    ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const total = ctx.measureText(str).width;
    const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    if (mask) { ctx.beginPath(); ctx.rect(x0 - size, y - size * 1.08, total + size * 2, size * 1.34); ctx.clip(); }
    for (let i = 0; i < str.length; i++) {
      const p = E.outExpo(prog(t0 + i * stagger, t0 + i * stagger + dur, t));
      if (p <= 0) continue;
      const cx = x0 + ctx.measureText(str.slice(0, i)).width;
      ctx.globalAlpha = alpha * (fade ? p : 1);
      ctx.fillText(str[i], cx, y + (1 - p) * size * rise);
    }
    ctx.restore();
  }
  function chapter(label, lt) {
    if (!label) return;
    const a = prog(0, 0.05, lt);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = P.ball; ctx.fillRect(112, 985, 28, 3);
    ctx.restore();
    txt(label, 156, 996, { size: 22, weight: 500, fam: FM, ls: 3, alpha: 0.85 * a });
  }
  function label(str, x, y, a, color = P.ball) {
    txt(str, x, y, { size: 22, weight: 600, fam: FM, ls: 4, color, alpha: a });
  }

  // paddles ---------------------------------------------------------------
  function paddleFace(w, h, o = {}) {
    const hl = h * 0.6, hw = w * 0.24;
    ctx.save();
    ctx.fillStyle = '#111316';
    const hp = new Path2D(); hp.roundRect(-hw / 2, h / 2 - 8, hw, hl, [4, 4, hw * 0.3, hw * 0.3]);
    ctx.fill(hp);
    ctx.clip(hp);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = Math.max(1, w * 0.008);
    for (let y = h / 2; y < h / 2 + hl + hw; y += w * 0.04) { ctx.beginPath(); ctx.moveTo(-hw / 2, y); ctx.lineTo(hw / 2, y - w * 0.03); ctx.stroke(); }
    ctx.restore();
    const rt = w * 0.3, rb = w * 0.12;
    const path = new Path2D(); path.roundRect(-w / 2, -h / 2, w, h, [rt, rt, rb, rb]);
    let g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, o.light || '#2C3139'); g.addColorStop(0.55, '#16181C'); g.addColorStop(1, '#0C0D10');
    ctx.fillStyle = g; ctx.fill(path);
    ctx.save(); ctx.clip(path);
    ctx.globalAlpha = 0.6; ctx.fillStyle = PAT.carbon; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
    const s = o.sheen ?? 0.35;
    g = ctx.createLinearGradient(-w * 0.8, -h * 0.6, w * 0.7, h * 0.55);
    g.addColorStop(clamp(s - 0.18), 'rgba(255,255,255,0)'); g.addColorStop(clamp(s), 'rgba(185,205,230,0.13)'); g.addColorStop(clamp(s + 0.18), 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = P.ball; ctx.globalAlpha = 0.9; ctx.fillRect(-w / 2, h / 2 - h * 0.1, w, Math.max(1.5, h * 0.012));
    ctx.restore();
    ctx.lineWidth = w * 0.036; ctx.strokeStyle = P.paddleEdge; ctx.stroke(path);
    ctx.lineWidth = Math.max(1, w * 0.004); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke(path);
  }
  // A paddle seen at an angle: face squeezed horizontally.
  function paddleAngled(x, y, rot, w, h, squeeze, o) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(squeeze, 1);
    paddleFace(w, h, o);
    ctx.restore();
  }

  // court (top-down) ------------------------------------------------------
  function courtTop(c, k, o = {}) {
    const L = 13.41, Wd = 6.1, lw = Math.max(1.2, (o.lw ?? 0.055) * k);
    if (o.court !== null) { c.fillStyle = o.court || P.court; c.fillRect(-L / 2 * k, -Wd / 2 * k, L * k, Wd * k); }
    if (o.grain) { c.save(); c.globalAlpha = o.grain; c.fillStyle = PAT.grain; c.fillRect(-L / 2 * k, -Wd / 2 * k, L * k, Wd * k); c.restore(); }
    c.fillStyle = o.line || P.line;
    c.fillRect(-L / 2 * k, -Wd / 2 * k, L * k, lw); c.fillRect(-L / 2 * k, Wd / 2 * k - lw, L * k, lw);
    c.fillRect(-L / 2 * k, -Wd / 2 * k, lw, Wd * k); c.fillRect(L / 2 * k - lw, -Wd / 2 * k, lw, Wd * k);
    c.fillRect(-2.13 * k - lw / 2, -Wd / 2 * k, lw, Wd * k); c.fillRect(2.13 * k - lw / 2, -Wd / 2 * k, lw, Wd * k);
    c.fillRect(2.13 * k, -lw / 2, (L / 2 - 2.13) * k, lw); c.fillRect(-L / 2 * k, -lw / 2, (L / 2 - 2.13) * k, lw);
    if (o.net !== false) {
      const nh = (Wd + 0.7) * k;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(lw * 1.2, -nh / 2 + lw * 2, lw * 2.2, nh);
      c.fillStyle = '#10151B'; c.fillRect(-lw * 1.1, -nh / 2, lw * 2.2, nh);
      c.fillStyle = P.line; c.fillRect(-lw * 0.45, -nh / 2, lw * 0.9, nh);
      c.fillStyle = '#0A0C0F';
      c.beginPath(); c.arc(0, -nh / 2, lw * 1.9, 0, TAU); c.arc(0, nh / 2, lw * 1.9, 0, TAU); c.fill();
    }
  }

  // ======================================================================
  // SCENE 1 — THE DROP (0:00–0:03)
  // ======================================================================
  function sceneDrop(lt) {
    const t = lt;
    const e = E.inOutSine(clamp(t / 3));
    const cam = makeCam([0.02, 0.17 - 0.025 * e, -0.6 + 0.32 * e], [0.0, 0.205, 4.0], 19);
    const L = [0.22, 0, 1.34], r = 0.037;
    const hz = proj(cam, [0, 0, 400]).y;
    let g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#02060A'); g.addColorStop(1, '#0E1D2B');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    bokeh(11, 24, 20, hz - 30, -e * 30, 1);

    // floor: clay surround, court starts at the near baseline just in front of the ball
    groundRect(cam, -40, 40, 0.45, 300, P.clayDark);
    const BL = 1.08, NET = BL + 0.05 + 6.705, FB = NET + 6.705;
    groundRect(cam, -3.05, 3.05, BL, FB, P.court);
    ctx.save(); ctx.globalAlpha = 0.5;
    poly3(cam, [[-3.05, 0, BL], [3.05, 0, BL], [3.05, 0, FB], [-3.05, 0, FB]], PAT.grain); ctx.restore();
    const lw = 0.05, LC = P.line;
    groundRect(cam, -3.05, 3.05, BL, BL + lw, LC);
    groundRect(cam, -3.05, 3.05, NET - 2.13 - lw, NET - 2.13, LC);
    groundRect(cam, -3.05, 3.05, NET + 2.13, NET + 2.13 + lw, LC);
    groundRect(cam, -3.05, 3.05, FB - lw, FB, LC);
    groundRect(cam, -3.05, -3.0, BL, FB, LC);
    groundRect(cam, 3.0, 3.05, BL, FB, LC);
    groundRect(cam, -lw / 2, lw / 2, BL, NET - 2.13, LC);
    groundRect(cam, -lw / 2, lw / 2, NET + 2.13, FB, LC);
    // light pool around landing point
    const pl = proj(cam, L);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.translate(pl.x, pl.y); ctx.scale(1, 0.2);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, 900);
    g.addColorStop(0, 'rgba(255,238,215,0.16)'); g.addColorStop(1, 'rgba(255,238,215,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 900, 0, TAU); ctx.fill();
    ctx.restore();
    // distance fog
    g = ctx.createLinearGradient(0, hz - 2, 0, hz + 190);
    g.addColorStop(0, 'rgba(8,16,24,0.95)'); g.addColorStop(1, 'rgba(8,16,24,0)');
    ctx.fillStyle = g; ctx.fillRect(0, hz - 2, W, 200);

    // the net — out of focus behind the action
    blurred(3.5, c => {
      const nh = x => 0.865 + 0.045 * Math.pow(Math.abs(x) / 3.35, 2);
      c.strokeStyle = 'rgba(150,170,190,0.30)';
      for (let x = -3.35; x <= 3.351; x += 0.06) {
        const a = proj(cam, [x, 0.03, NET]), b = proj(cam, [x, nh(x) - 0.05, NET]);
        c.lineWidth = Math.max(1, 0.003 * a.s); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      }
      for (let y = 0.06; y < 0.84; y += 0.06) {
        c.beginPath();
        for (let x = -3.35; x <= 3.351; x += 0.335) { const q = proj(cam, [x, Math.min(y, nh(x) - 0.05), NET]); x === -3.35 ? c.moveTo(q.x, q.y) : c.lineTo(q.x, q.y); }
        c.lineWidth = Math.max(1, 0.003 * proj(cam, [0, y, NET]).s); c.stroke();
      }
      c.beginPath();
      for (let i = 0; i <= 40; i++) { const x = -3.35 + i * 6.7 / 40; const q = proj(cam, [x, nh(x), NET]); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }
      for (let i = 40; i >= 0; i--) { const x = -3.35 + i * 6.7 / 40; const q = proj(cam, [x, nh(x) - 0.05, NET]); c.lineTo(q.x, q.y); }
      c.closePath(); c.fillStyle = '#E8E3D8'; c.fill();
      for (const sx of [-3.35, 3.35]) {
        const a = proj(cam, [sx, 0, NET]), b = proj(cam, [sx, 0.92, NET]);
        c.lineWidth = 0.05 * a.s; c.strokeStyle = '#07090B'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      }
    });

    // volumetric light cone
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    g = ctx.createLinearGradient(pl.x - 260, 0, pl.x + 260, 0);
    g.addColorStop(0, 'rgba(255,240,220,0)'); g.addColorStop(0.5, 'rgba(255,240,220,0.05)'); g.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(pl.x - 120, -10); ctx.lineTo(pl.x + 120, -10); ctx.lineTo(pl.x + 300, pl.y); ctx.lineTo(pl.x - 300, pl.y); ctx.closePath(); ctx.fill();
    ctx.restore();
    motes(5, 46, t, pl.x - 420, 0, pl.x + 420, pl.y, 0.35, 1, 0.5);

    // ball motion
    let y, sq = 0;
    if (t < 2.0) { const u = prog(0.55, 2.0, t); y = r + 0.95 * (1 - u * u); }
    else { const s = (t - 2.0) * 0.42; y = r + 2.6 * s - 4.9 * s * s; sq = 0.3 * Math.exp(-(t - 2.0) * 22) * Math.cos((t - 2.0) * 50); }
    const pb = proj(cam, [L[0], y, L[2]]);
    const rp = cam.f * r / pb.z;
    const pg = proj(cam, L);
    const hgt = y - r;
    // shadow
    softShadow(pg.x, pg.y, rp * (1.25 + hgt * 2.2), rp * (0.22 + hgt * 0.3), 0.55 / (1 + hgt * 6));
    // shockwave rings & dust
    if (t >= 2.0) {
      const a = t - 2.0;
      for (const [d, amp] of [[0, 1], [0.1, 0.55]]) {
        const aa = a - d; if (aa < 0) continue;
        const R = 0.04 + 1.5 * (1 - Math.exp(-aa * 2.0));
        const al = 0.65 * amp * Math.exp(-aa * 1.7);
        ctx.save(); ctx.strokeStyle = `rgba(250,246,235,${al})`; ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) { const th = i / 72 * TAU; const q = proj(cam, [L[0] + Math.cos(th) * R, 0.002, L[2] + Math.sin(th) * R]); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
        ctx.stroke(); ctx.restore();
      }
      const Rd = rng(77), s = a * 0.42;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 60; i++) {
        const th = Rd() * TAU, v = 0.3 + Rd() * 1.1, vy = 0.2 + Rd() * 0.9, sz = 0.6 + Rd() * 1.8;
        const py = Math.max(0, vy * s - 3 * s * s);
        const q = proj(cam, [L[0] + Math.cos(th) * v * s, py, L[2] + Math.sin(th) * v * s * 0.6]);
        ctx.fillStyle = `rgba(255,248,235,${0.75 * Math.exp(-a * 1.6)})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, sz * q.s * 0.0011, 0, TAU); ctx.fill();
      }
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      g = ctx.createRadialGradient(pg.x, pg.y - rp, 0, pg.x, pg.y - rp, 420);
      g.addColorStop(0, `rgba(255,250,230,${0.4 * Math.exp(-a * 5)})`); g.addColorStop(1, 'rgba(255,250,230,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    // motion trail while falling
    if (t > 0.55 && t < 2.0) {
      const pts = [];
      for (let k = 4; k >= 1; k--) {
        const tt = t - k * 0.012; const u = prog(0.55, 2.0, tt); const yy = r + 0.95 * (1 - u * u);
        const q = proj(cam, [L[0], yy, L[2]]); pts.push({ x: q.x, y: q.y, r: rp });
      }
      ghosts(pts, 0.25);
    }
    drawBall(pb.x, pb.y + rp * sq, rp, { spinX: t * 1.2, spinY: 0.6 + t * 0.4, squash: sq, glow: 0.25 });

    // fade from black
    ctx.fillStyle = `rgba(0,0,0,${1 - E.outCubic(prog(0, 0.8, t))})`; ctx.fillRect(0, 0, W, H);
  }

  // ======================================================================
  // SCENE 2 — PADDLE MACRO (contact)
  // ======================================================================
  function scenePaddleMacro(lt, p = {}) {
    let g = ctx.createRadialGradient(480, 180, 0, 600, 300, 1500);
    g.addColorStop(0, '#1B3045'); g.addColorStop(1, '#050B11');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    bokeh(p.seed || 21, 16, 0, H, 0, 0.6);
    const w = 640, h = 820;
    const cx = 1010, cy = 600, rot = (p.rot ?? -0.24) + 0.04 * Math.exp(-lt * 9) * Math.sin(lt * 55);
    const sc = 1 - 0.015 * Math.exp(-lt * 12);
    // paddle drop shadow
    ctx.save(); ctx.translate(cx + 40, cy + 50); ctx.rotate(rot); ctx.scale(sc, sc);
    ctx.filter = 'blur(30px)'; ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h * 1.5, 160); ctx.fill(); ctx.filter = 'none';
    ctx.restore();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc);
    paddleFace(w, h, { sheen: 0.3 + lt * 0.15 });
    ctx.restore();
    // contact point (paddle space -> screen)
    const lx = 0, ly = -h * 0.12;
    const px = cx + Math.cos(rot) * lx - Math.sin(rot) * ly, py = cy + Math.sin(rot) * lx + Math.cos(rot) * ly;
    // impact ripple on the face
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
    for (const d of [0, 0.05]) {
      const a = lt - d; if (a < 0) continue;
      const rr = 120 + 420 * E.outCubic(clamp(a / 0.45));
      ctx.strokeStyle = `rgba(230,240,255,${0.35 * (1 - clamp(a / 0.45))})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, rr * 0.5, rr * 0.62, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    burst(px, py, lt, { r0: 140, r1: 330, n: 16, lw: 4, dur: 0.2, seed: 4 });
    // ball flies toward camera
    const r0 = 0.195 * w;
    const pos = s => { const d = 1 - 6.0 * s; const k = 1 / d; return { x: px + 330 * (k - 1) * 0.3, y: py - 240 * (k - 1) * 0.3, r: r0 * k, d }; };
    const b = pos(lt);
    if (b.d > 0.09) {
      const pts = []; for (let k = 4; k >= 1; k--) { const q = pos(Math.max(0, lt - k * 0.008)); pts.push(q); }
      if (lt > 0.01) ghosts(pts, 0.3);
      drawBall(b.x, b.y, b.r, { spinX: 0.4 + lt * 14, spinY: 0.3, squash: 0.16 * Math.exp(-lt * 60), squashAngle: rot });
    }
    // impact flash
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    g = ctx.createRadialGradient(px, py, 0, px, py, 520);
    g.addColorStop(0, `rgba(255,252,235,${0.55 * Math.exp(-lt * 16)})`); g.addColorStop(1, 'rgba(255,252,235,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    motes(31, 40, lt + 3, 0, 0, W, H, 0.3, 1.2, 0.6);
    chapter(p.label, lt);
  }

  // ======================================================================
  // SCENE 3 — NET TAPE
  // ======================================================================
  function sceneNetTape(lt, p = {}) {
    const cam = makeCam([-3.75, 0.97 - 0.01 * lt, -1.05 + 0.05 * lt], [-1.25, 0.84, 0.12], 15);
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#040A10'); g.addColorStop(1, '#0F2131');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    bokeh(41, 22, 0, H * 0.75, lt * 20, 0.9);
    // floor beyond
    groundRect(cam, -3, 14, -1, 16, P.clayDark);
    groundRect(cam, -3.05, 3.05, 0, 6.705, P.court);
    groundRect(cam, -1.5, 3.05, -1, 0, P.court);
    const lw = 0.05;
    groundRect(cam, -3.05, 3.05, 2.13, 2.13 + lw, P.line);
    groundRect(cam, -3.05, 3.05, 6.655, 6.705, P.line);
    groundRect(cam, 3.0, 3.05, -1, 6.705, P.line);
    groundRect(cam, -lw / 2, lw / 2, 2.13, 6.705, P.line);
    const hz = proj(cam, [0, 0, 300]).y;
    g = ctx.createLinearGradient(0, hz - 400, 0, H);
    g.addColorStop(0, 'rgba(6,12,18,0.9)'); g.addColorStop(1, 'rgba(6,12,18,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, hz - 400, W, H);

    const xc = -1.55, r = 0.037;
    const nh0 = x => 0.865 + 0.045 * Math.pow(Math.abs(x) / 3.35, 2);
    const wave = x => {
      const d = x - xc;
      return 0.0065 * Math.exp(-lt * 5) * Math.sin(20 * d - 34 * lt) * Math.exp(-1.5 * Math.abs(d))
        - 0.009 * Math.exp(-lt * 22) * Math.exp(-(d / 0.09) * (d / 0.09));
    };
    const nh = x => nh0(x) + wave(x);
    // ball path
    const s = lt * 0.5;
    const bpos = ss => [xc + 0.12 * ss, nh0(xc) + r + 1.3 * ss - 4.9 * ss * ss, 0.9 * ss];
    const B = bpos(s);
    const behind = B[1] < nh0(B[0]) + r * 0.5;
    const drawTheBall = () => {
      const q = proj(cam, B), rp = cam.f * r / q.z;
      const pts = []; for (let k = 4; k >= 1; k--) { const qq = proj(cam, bpos(Math.max(0, s - k * 0.01))); pts.push({ x: qq.x, y: qq.y, r: rp }); }
      if (lt > 0.02) ghosts(pts, 0.22);
      drawBall(q.x, q.y, rp, { spinX: -lt * 9, spinY: 0.4, squash: 0.2 * Math.exp(-lt * 40), squashAngle: Math.PI / 2, glow: 0.2 });
    };
    if (behind) drawTheBall();
    // mesh
    ctx.save(); ctx.lineCap = 'round';
    for (let x = -3.35; x <= 3.351; x += 0.045) {
      const a = proj(cam, [x, 0.04, 0]), b = proj(cam, [x, nh(x) - 0.05, 0]);
      if (Math.max(a.x, b.x) < -50 || Math.min(a.x, b.x) > W + 50) continue;
      ctx.strokeStyle = 'rgba(14,18,23,0.92)'; ctx.lineWidth = Math.max(0.8, 0.0035 * a.s);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let y = 0.085; y < 0.83; y += 0.045) {
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const x = -3.35 + i * 6.7 / 60;
        const yy = Math.min(y + wave(x) * clamp((y - 0.6) / 0.25), nh(x) - 0.05);
        const q = proj(cam, [x, yy, 0]); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      }
      ctx.strokeStyle = 'rgba(14,18,23,0.92)'; ctx.lineWidth = Math.max(0.8, 0.0035 * proj(cam, [xc, y, 0]).s);
      ctx.stroke();
    }
    // tape
    ctx.beginPath();
    for (let i = 0; i <= 140; i++) { const x = -3.35 + i * 6.7 / 140; const q = proj(cam, [x, nh(x), 0]); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
    for (let i = 140; i >= 0; i--) { const x = -3.35 + i * 6.7 / 140; const q = proj(cam, [x, nh(x) - 0.052, -0.004]); ctx.lineTo(q.x, q.y); }
    ctx.closePath();
    const tc = proj(cam, [xc, nh(xc), 0]);
    g = ctx.createLinearGradient(0, tc.y - 60, 0, tc.y + 120);
    g.addColorStop(0, '#FBF8F1'); g.addColorStop(1, '#CFC9BC');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    // chalk puff at contact
    const R = rng(9);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 28; i++) {
      const th = R() * Math.PI - Math.PI, v = 40 + R() * 160, sz = 1 + R() * 2.5;
      const a = Math.exp(-lt * 4);
      ctx.fillStyle = `rgba(255,255,245,${0.6 * a})`;
      ctx.beginPath(); ctx.arc(tc.x + Math.cos(th) * v * E.outCubic(clamp(lt * 2.2)), tc.y + Math.sin(th) * v * 0.6 * E.outCubic(clamp(lt * 2.2)), sz, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (!behind) drawTheBall();
    burst(tc.x, tc.y, lt, { r0: 70, r1: 200, n: 10, lw: 3, dur: 0.16, seed: 12, rot: -Math.PI / 2, spread: Math.PI * 0.9 });
    chapter(p.label, lt);
  }

  // ======================================================================
  // SCENE 4/6 — LINE CALL (top-down macro)
  // ======================================================================
  function sceneLineCall(lt, p = {}) {
    const k = 2300, lw = 0.05 * k, r = 0.037;
    const zoom = 1 + 0.06 * lt;
    const ang = p.angle ?? -0.38;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.rotate(ang);
    ctx.fillStyle = P.court; ctx.fillRect(-1500, -1500, 3000, 3000);
    ctx.fillStyle = p.clay ? P.clay : P.court2; ctx.fillRect(-1500, -1500, 3000, 1500 - lw / 2);
    ctx.globalAlpha = 0.9; ctx.fillStyle = PAT.grain; ctx.fillRect(-1500, -1500, 3000, 3000); ctx.globalAlpha = 1;
    ctx.fillStyle = P.line; ctx.fillRect(-1500, -lw / 2, 3000, lw);
    ctx.globalAlpha = 0.5; ctx.fillStyle = PAT.grain; ctx.fillRect(-1500, -lw / 2, 3000, lw); ctx.globalAlpha = 1;
    // scuff where the ball kissed the line
    const C = { x: -150, y: lw * 0.28 };
    const sa = clamp(lt * 20);
    ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(0.35);
    let g = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
    g.addColorStop(0, `rgba(120,135,60,${0.32 * sa})`); g.addColorStop(1, 'rgba(120,135,60,0)');
    ctx.scale(1.6, 0.6); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 80, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
    // world (local) -> screen
    const toS = (x, y) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      return { x: W / 2 + zoom * (c * x - s * y), y: H / 2 + zoom * (s * x + c * y) };
    };
    const camH = 0.95;
    const bp = ss => { const s = ss * 0.6; return { x: C.x + 0.85 * s * k, y: C.y + 0.3 * s * k, h: Math.max(0, 1.9 * s - 4.9 * s * s) }; };
    const b = bp(lt);
    const sc = s => camH / (camH - (r + s)) / (camH / (camH - r));
    // shadow
    const shp = toS(b.x, b.y);
    softShadow(shp.x + b.h * k * 0.35 * zoom, shp.y + b.h * k * 0.5 * zoom, r * k * zoom * (1.05 + b.h * 3), r * k * zoom * (1.05 + b.h * 3), 0.5 / (1 + b.h * 10));
    // "in" ring
    const cs = toS(C.x, C.y);
    ring(cs.x, cs.y, r * k * zoom * (1.1 + 1.6 * E.outCubic(clamp(lt / 0.4))), 3, `rgba(216,238,58,${0.85 * (1 - clamp(lt / 0.45))})`);
    const R = rng(p.seed || 3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const th = R() * TAU, v = 60 + R() * 200, sz = 1.2 + R() * 2.4;
      const q = E.outCubic(clamp(lt * 2.5));
      ctx.fillStyle = `rgba(255,255,248,${0.7 * Math.exp(-lt * 4)})`;
      ctx.beginPath(); ctx.arc(cs.x + Math.cos(th) * v * q, cs.y + Math.sin(th) * v * q, sz, 0, TAU); ctx.fill();
    }
    ctx.restore();
    const bs = toS(b.x, b.y);
    const rr = r * k * zoom * sc(b.h);
    const pts = []; for (let j = 4; j >= 1; j--) { const q = bp(Math.max(0, lt - j * 0.012)); const qs = toS(q.x, q.y); pts.push({ x: qs.x, y: qs.y, r: r * k * zoom * sc(q.h) }); }
    if (lt > 0.02) ghosts(pts, 0.25);
    drawBall(bs.x, bs.y, rr, { spinX: lt * 8, spinY: 0.8 + lt * 3, squash: -0.14 * Math.exp(-lt * 45) });
    chapter(p.label, lt);
  }

  // ======================================================================
  // SCENE 5 — BALL MACRO (spin)
  // ======================================================================
  function sceneBallMacro(lt, p = {}) {
    let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1200);
    g.addColorStop(0, '#162C40'); g.addColorStop(1, '#03080D');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const cx = (p.x ?? 960), cy = 540;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx, cy); ctx.rotate(lt * 0.6 + (p.rot || 0));
    for (let i = 0; i < 36; i++) {
      ctx.rotate(TAU / 36);
      ctx.fillStyle = `rgba(216,238,58,${i % 2 ? 0.018 : 0.035})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1400, -60); ctx.lineTo(1400, 60); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const r = 330 * (1 + 0.04 * lt);
    for (const d of [0, 0.06, 0.12]) {
      const a = lt - d; if (a < 0) continue;
      ring(cx, cy, r + 520 * E.outCubic(clamp(a / 0.4)), 3, `rgba(241,235,223,${0.5 * (1 - clamp(a / 0.4))})`);
    }
    const sq = 0.13 * Math.exp(-lt * 12) * Math.cos(lt * 70);
    drawBall(cx, cy, r, { spinX: 0.35 + lt * 1.5, spinY: 0.5 + lt * 8, squash: sq, squashAngle: 0.6, glow: 0.4 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 700);
    g.addColorStop(0, `rgba(255,252,235,${0.5 * Math.exp(-lt * 18)})`); g.addColorStop(1, 'rgba(255,252,235,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    chapter(p.label, lt);
  }

  // ======================================================================
  // SCENE 7 — PADDLE SWING (follow-through)
  // ======================================================================
  function scenePaddleSwing(lt, p = {}) {
    let g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#132A3E'); g.addColorStop(1, '#03080C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    bokeh(61, 18, 0, H, -lt * 60, 0.7);
    const pv = { x: 520, y: 980 };
    const th0 = -1.83, th = th0 + 0.95 * (1 - Math.exp(-lt * 6));
    const drawStick = (ang, alpha) => {
      ctx.save(); ctx.translate(pv.x, pv.y); ctx.rotate(ang); ctx.globalAlpha *= alpha;
      ctx.fillStyle = '#121418'; ctx.beginPath(); ctx.roundRect(-10, -26, 200, 52, 14); ctx.fill();
      ctx.fillStyle = '#1C1F24'; ctx.beginPath(); ctx.roundRect(170, -15, 560, 30, [4, 15, 15, 4]); ctx.fill();
      ctx.fillStyle = P.ball; ctx.fillRect(176, -15, 6, 30);
      ctx.strokeStyle = 'rgba(200,220,240,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(180, -14); ctx.lineTo(720, -14); ctx.stroke();
      ctx.restore();
    };
    // swept smear
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const smear = 0.9 * Math.exp(-lt * 5) + 0.04;
    g = ctx.createRadialGradient(pv.x, pv.y, 160, pv.x, pv.y, 740);
    g.addColorStop(0, 'rgba(190,210,235,0)'); g.addColorStop(0.6, 'rgba(190,210,235,0.10)'); g.addColorStop(1, 'rgba(190,210,235,0.16)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pv.x, pv.y, 735, th - smear, th); ctx.arc(pv.x, pv.y, 170, th, th - smear, true); ctx.closePath(); ctx.fill();
    ctx.restore();
    for (let i = 6; i >= 1; i--) drawStick(th - smear * i / 6, 0.07);
    drawStick(th, 1);
    // ball
    const c0 = { x: pv.x + 470 * Math.cos(th0) + 30, y: pv.y + 470 * Math.sin(th0) };
    const bp = s => ({ x: c0.x + 3000 * s, y: c0.y - 700 * s + 900 * s * s });
    const b = bp(lt);
    const pts = []; for (let k = 10; k >= 1; k--) { const q = bp(Math.max(0, lt - k * 0.006)); pts.push({ x: q.x, y: q.y, r: 46 }); }
    if (lt > 0.01) ghosts(pts, 0.4);
    burst(c0.x, c0.y, lt, { r0: 50, r1: 230, n: 14, lw: 4, dur: 0.18, seed: 33 });
    drawBall(b.x, b.y, 46, { spinX: lt * 20, spinY: 1, glow: 0.5, squash: 0.25 * Math.exp(-lt * 50), squashAngle: -0.25 });
    motes(71, 30, lt + 6.5, 0, 0, W, H, 0.3, 1, 0.8);
    chapter(p.label, lt);
  }

  // ======================================================================
  // 0:07–0:08 — ACCELERATION
  // ======================================================================
  function sceneAccel(lt, p, t) {
    const A = TL.ACCEL, i = Math.max(0, lastBefore(A, t)), a = t - A[i];
    const order = [
      ['paddleMacro', { rot: -0.1, seed: 4 }], ['ballMacro', { rot: 1 }], ['lineCall', { angle: 0.2, clay: true, seed: 5 }],
      ['paddleSwing', {}], ['netTape', {}], ['ballMacro', { rot: 2, x: 900 }], ['paddleMacro', { rot: -0.35, seed: 8 }],
      ['lineCall', { angle: -0.7, clay: false, seed: 9 }],
    ];
    const [name, vp] = order[i];
    const punch = 1 + 0.1 * Math.exp(-a * 16) + 0.08 * prog(7.0, 8.0, t);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(punch * (i % 2 ? -1 : 1), punch); ctx.translate(-W / 2, -H / 2);
    SCENES[name](a, Object.assign({}, vp, { label: null }), t);
    ctx.restore();
    const flash = 0.32 * Math.exp(-a * 24) + Math.pow(prog(7.7, 8.0, t), 2.2) * 0.96;
    ctx.fillStyle = `rgba(255,253,246,${clamp(flash)})`; ctx.fillRect(0, 0, W, H);
  }

  // ======================================================================
  // SCENE — SOFT. (top-down dinks)
  // ======================================================================
  const SOFT_PTS = { A1: [-2.4, -1.45], B2: [2.4, 1.45], b0: [-1.15, 1.0], b1: [1.3, 1.1], b2: [-1.25, -1.05] };
  const SOFT_SEGS = [
    { t0: 7.5, t1: 8.0, p0: SOFT_PTS.b0, h0: 0, p1: SOFT_PTS.A1, h1: 0.55, A: 0.22 },
    { t0: 8.0, t1: 8.5, p0: SOFT_PTS.A1, h0: 0.55, p1: SOFT_PTS.b1, h1: 0, A: 0.6 },
    { t0: 8.5, t1: 9.0, p0: SOFT_PTS.b1, h0: 0, p1: SOFT_PTS.B2, h1: 0.5, A: 0.22 },
    { t0: 9.0, t1: 9.5, p0: SOFT_PTS.B2, h0: 0.5, p1: SOFT_PTS.b2, h1: 0, A: 0.6 },
    { t0: 9.5, t1: 10.0, p0: SOFT_PTS.b2, h0: 0, p1: SOFT_PTS.A1, h1: 0.55, A: 0.22 },
    { t0: 10.0, t1: 10.5, p0: SOFT_PTS.A1, h0: 0.55, p1: SOFT_PTS.b1, h1: 0, A: 0.6 },
  ];
  function softBall(t) {
    const sg = SOFT_SEGS.find(s => t >= s.t0 && t < s.t1) || SOFT_SEGS[SOFT_SEGS.length - 1];
    const u = clamp((t - sg.t0) / (sg.t1 - sg.t0));
    const ue = sg.h1 === 0 ? u : u; // linear ground speed
    return { x: lerp(sg.p0[0], sg.p1[0], ue), y: lerp(sg.p0[1], sg.p1[1], ue), h: lerp(sg.h0, sg.h1, u) + 4 * sg.A * u * (1 - u) };
  }
  function sceneSoft(lt, p, t) {
    ctx.fillStyle = P.clay; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = PAT.grain; ctx.fillRect(0, 0, W, H); ctx.restore();
    const e = E.inOutSine(clamp(lt / 2)), k = 86;
    ctx.save();
    ctx.translate(960, 452); ctx.rotate(-0.025 * e); ctx.scale(1 + 0.045 * e, 1 + 0.045 * e);
    // court shadow
    ctx.fillStyle = 'rgba(70,35,15,0.25)'; ctx.fillRect(-13.41 / 2 * k + 10, -6.1 / 2 * k + 14, 13.41 * k, 6.1 * k);
    courtTop(ctx, k, { grain: 0.7 });
    // ripples
    for (const tb of TL.SOFT.bounces) {
      const a = t - tb; if (a < 0 || a > 0.7) continue;
      const bb = softBall(tb);
      ring(bb.x * k, bb.y * k, 8 + a * 110, 2.5, `rgba(242,238,229,${0.6 * (1 - a / 0.7)})`);
    }
    // trail
    for (let j = 1; j <= 60; j++) {
      const tt = t - j * 0.018; if (tt < 7.5) break;
      const q = softBall(tt);
      ctx.fillStyle = `rgba(216,238,58,${0.75 * (1 - j / 60)})`;
      ctx.beginPath(); ctx.arc(q.x * k, q.y * k, 3.2, 0, TAU); ctx.fill();
    }
    // players
    const players = [[-2.55, -1.5, 1], [-2.55, 1.5, 1], [2.55, -1.5, -1], [2.55, 1.5, -1]];
    const hitters = { 8.0: 0, 9.0: 3, 10.0: 0 };
    players.forEach(([x, y, dir], idx) => {
      let swing = 0;
      for (const [ct, who] of Object.entries(hitters)) if (who === idx) { const a = t - (+ct); swing = Math.max(swing, a > -0.15 && a < 0.3 ? Math.exp(-Math.abs(a) * 9) : 0); }
      const bx = x * k + Math.sin(t * 2 + idx) * 4, by = y * k + Math.cos(t * 1.7 + idx) * 4;
      softShadow(bx + 6, by + 9, 34, 34, 0.35);
      ctx.save(); ctx.translate(bx, by); ctx.rotate((dir > 0 ? 0 : Math.PI) + (y < 0 ? 0.5 : -0.5) * dir * (1 - swing) - swing * 0.2 * dir);
      ctx.fillStyle = '#121418'; ctx.beginPath(); ctx.roundRect(22, -11, 34, 22, [4, 11, 11, 4]); ctx.fill();
      ctx.restore();
      const g = ctx.createRadialGradient(bx - 8, by - 8, 2, bx, by, 27);
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#D9D2C4');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 26, 0, TAU); ctx.fill();
    });
    const b = softBall(t);
    softShadow(b.x * k + b.h * 34, b.y * k + b.h * 46, 12 + b.h * 6, 12 + b.h * 6, 0.45 / (1 + b.h * 1.5));
    drawBall(b.x * k, b.y * k, 11 * (1 + b.h * 0.45), { glow: 0.6 });
    ctx.restore();
    label('THE DINK', 112, 772, prog(8.05, 8.25, t));
    reveal('SOFT.', 104, 1000, t, 8.0, { size: 260, weight: 300, stagger: 0.05, dur: 0.6 });
  }

  // ======================================================================
  // SCENE — FAST. (side-on hands battle)
  // ======================================================================
  const SIDE = { floor: 790, net: 960, netTop: 527 };
  function sideStage(t, o = {}) {
    let g = ctx.createLinearGradient(0, 0, 0, SIDE.floor);
    g.addColorStop(0, o.top || '#081522'); g.addColorStop(1, o.bottom || '#12283B');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, SIDE.floor);
    if (o.bokeh !== false) bokeh(o.seed || 91, 20, 0, SIDE.floor - 100, -t * 40, o.bokehMul ?? 0.8);
    g = ctx.createLinearGradient(0, SIDE.floor, 0, H);
    g.addColorStop(0, '#4A7896'); g.addColorStop(0.25, P.court); g.addColorStop(1, '#1A3346');
    ctx.fillStyle = g; ctx.fillRect(0, SIDE.floor, W, H - SIDE.floor);
    ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = PAT.grain; ctx.fillRect(0, SIDE.floor, W, H - SIDE.floor); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, SIDE.floor, W, 2);
    for (const kx of [SIDE.net - 447, SIDE.net + 447]) {
      ctx.fillStyle = 'rgba(242,238,229,0.85)';
      ctx.beginPath(); ctx.moveTo(kx - 4, SIDE.floor); ctx.lineTo(kx + 4, SIDE.floor);
      ctx.lineTo(SIDE.net + (kx - SIDE.net) * 1.45 + 9, H); ctx.lineTo(SIDE.net + (kx - SIDE.net) * 1.45 - 9, H); ctx.closePath(); ctx.fill();
    }
    softShadow(SIDE.net, SIDE.floor + 18, 120, 20, 0.5);
    ctx.fillStyle = '#0A0D10';
    ctx.fillRect(SIDE.net - 9, SIDE.netTop - 6, 18, SIDE.floor - SIDE.netTop + 6);
    ctx.save(); ctx.beginPath(); ctx.rect(SIDE.net - 34, SIDE.netTop + 10, 68, SIDE.floor - SIDE.netTop - 10); ctx.clip();
    ctx.strokeStyle = 'rgba(20,26,32,0.95)'; ctx.lineWidth = 2;
    for (let y = SIDE.netTop - 80; y < SIDE.floor; y += 14) {
      ctx.beginPath(); ctx.moveTo(SIDE.net - 34, y); ctx.lineTo(SIDE.net + 34, y + 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(SIDE.net - 34, y + 30); ctx.lineTo(SIDE.net + 34, y); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#EEE9DE'; ctx.fillRect(SIDE.net - 36, SIDE.netTop, 72, 14);
  }
  // generic rally along contact times; returns ball pos and paddle states
  function rally(t, times, xs, ys, popUp) {
    const i = lastBefore(times, t);
    const side = j => (j % 2 === 0 ? 0 : 1);
    const pos = tt => {
      const j = lastBefore(times, tt);
      if (j < 0) return { x: xs[0], y: ys[0] };
      if (j === times.length - 1) {
        if (popUp) return popUp(tt - times[j]);
        const dt = (times[j] - times[j - 1]);
        const u = (tt - times[j]) / dt;
        return { x: lerp(xs[side(j)], xs[side(j + 1)], u), y: lerp(ys[j], ys[j], u) - 40 * 4 * u * (1 - u) };
      }
      const u = (tt - times[j]) / (times[j + 1] - times[j]);
      return { x: lerp(xs[side(j)], xs[side(j + 1)], u), y: lerp(ys[j], ys[j + 1], u) - 34 * 4 * u * (1 - u) };
    };
    return { i, pos };
  }
  function sidePaddles(t, times, xs, ys, o = {}) {
    for (const s of [0, 1]) {
      let last = -1, next = -1;
      for (let j = 0; j < times.length; j++) if (j % 2 === s) { if (times[j] <= t) last = j; else if (next < 0) next = j; }
      let y = ys[last >= 0 ? last : next] ?? 470;
      if (next >= 0 && last >= 0) y = lerp(ys[last], ys[next], E.inOutSine(prog(times[last] + 0.05, times[next], t)));
      const a = last >= 0 ? t - times[last] : 9;
      const dir = s === 0 ? 1 : -1;
      const punch = a < 0.3 ? Math.sin(clamp(a / 0.3) * Math.PI) * Math.exp(-a * 4) : 0;
      const x = xs[s] - dir * 40 + dir * 26 * punch;
      const rot = dir * (0.25 - 0.55 * punch) + (o.freeze || 0);
      ctx.save(); ctx.globalAlpha *= o.alpha ?? 1;
      paddleAngled(x, y - 12, rot, 220, 280, 0.36, { sheen: 0.3 });
      ctx.restore();
    }
  }
  function streak(pos, t, t0, n, dt, r, alpha) {
    const pts = [];
    for (let k = n; k >= 1; k--) { const tt = t - k * dt; if (tt < t0) continue; const q = pos(tt); pts.push({ x: q.x, y: q.y, r }); }
    ghosts(pts, alpha);
  }
  function sceneFast(lt, p, t) {
    const times = TL.FAST.concat([12.0]);
    const xs = [600, 1320], ys = [470, 430, 492, 445, 480, 425, 488, 452, 470];
    const lastHit = lastBefore(times, t), a = t - times[Math.max(0, lastHit)];
    const [sx, sy] = shake(3, 9 * Math.exp(-a * 22), t);
    ctx.save(); ctx.translate(sx, sy);
    sideStage(t, { seed: 93 });
    // speed lines
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const R = rng(5);
    for (let i = 0; i < 40; i++) {
      const y = R() * SIDE.floor, len = 200 + R() * 600, sp = 1800 + R() * 2600;
      const x = ((R() * 3000 - t * sp) % 3000 + 3000) % 3000 - 500;
      ctx.fillStyle = `rgba(200,220,255,${0.03 + R() * 0.05})`; ctx.fillRect(x, y, len, 2);
    }
    ctx.restore();
    const { pos } = rally(t, times, xs, ys);
    sidePaddles(t, times, xs, ys);
    streak(pos, t, 10.0, 12, 0.006, 22, 0.5);
    const b = pos(t);
    if (lastHit >= 0) burst(xs[lastHit % 2], ys[lastHit], a, { r0: 26, r1: 110, n: 10, lw: 3, dur: 0.14, seed: lastHit + 1 });
    drawBall(b.x, b.y, 22, { spinX: t * 30, spinY: 1, glow: 0.7 });
    ctx.restore();
    label('THE HANDS BATTLE', 112, 760, prog(10.05, 10.2, t));
    const ent = clamp(lt / 0.3);
    for (const [off, al] of [[-60, 0.22], [-120, 0.12], [-180, 0.06]])
      txt('FAST.', 104 + off * (1 - E.outCubic(ent)) * 2.2, 1010, { size: 300, weight: 800, italic: true, color: P.ball, alpha: al * (1 - ent) });
    reveal('FAST.', 104, 1010, t, 10.0, { size: 300, weight: 800, italic: true, color: P.ball, stagger: 0.025, dur: 0.3, rise: 0.0, mask: false, fade: true });
  }

  // ======================================================================
  // SCENE — FIRST-TIMERS. (hand-drawn diagram)
  // ======================================================================
  function inkPath(pts, lw, color, seed = 1, jitter = 1.5) {
    const R = rng(seed);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((q, i) => { const jx = (R() - 0.5) * jitter, jy = (R() - 0.5) * jitter; i ? ctx.lineTo(q[0] + jx, q[1] + jy) : ctx.moveTo(q[0] + jx, q[1] + jy); });
    ctx.stroke(); ctx.restore();
  }
  function sceneFirst(lt, p, t) {
    ctx.fillStyle = P.paper; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.06; ctx.strokeStyle = P.ink; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
    const FL = 820, NX = 960, NT = 565, ink = P.ink, F = TL.FIRST, r = 20;
    const seg = (x0, x1, y, n = 40) => { const a = []; for (let i = 0; i <= n; i++) a.push([lerp(x0, x1, i / n), y]); return a; };
    inkPath(seg(120, 1800, FL), 4, ink, 2);
    inkPath([[NX - 12, FL], [NX - 12, NT]], 4, ink, 3);
    inkPath([[NX + 12, FL], [NX + 12, NT]], 4, ink, 4);
    ctx.save(); ctx.beginPath(); ctx.rect(NX - 12, NT, 24, FL - NT); ctx.clip();
    for (let y = NT - 30; y < FL; y += 16) inkPath([[NX - 14, y], [NX + 14, y + 22]], 1.5, 'rgba(14,28,43,0.55)', y, 0.6);
    ctx.restore();
    ctx.fillStyle = ink; ctx.fillRect(NX - 18, NT - 8, 36, 12);
    for (const x of [156, 1764]) inkPath([[x, FL - 14], [x, FL + 14]], 4, ink, x);
    for (const x of [704, 1216]) inkPath([[x, FL - 10], [x, FL + 10]], 3, ink, x);
    txt('BASELINE', 156, FL + 52, { size: 18, weight: 500, fam: FM, ls: 3, color: ink, alpha: 0.5, align: 'center' });
    txt('NET', NX, FL + 52, { size: 18, weight: 500, fam: FM, ls: 3, color: ink, alpha: 0.5, align: 'center' });
    // ball paths
    const S1 = tt => {
      if (tt < F.net) { const u = prog(F.serve1, F.net, tt); return { x: lerp(232, NX - 12 - r, u), y: lerp(650, 655, u) - 90 * 4 * u * (1 - u) }; }
      if (tt < F.hop1) { const a = tt - F.net; return { x: NX - 12 - r - 60 * a, y: 655 + 3554 * a * a * ((FL - r - 655) / 172) }; }
      if (tt < F.hop2) { const u = prog(F.hop1, F.hop2, tt); return { x: NX - 12 - r - 13 - 30 * u, y: FL - r - 36 * 4 * u * (1 - u) }; }
      const u = prog(F.hop2, 12.98, tt); return { x: NX - 12 - r - 43 - 14 * clamp(u), y: FL - r - 12 * 4 * clamp(u) * (1 - clamp(u)) };
    };
    const S2 = tt => {
      if (tt < F.land) { const u = prog(F.serve2, F.land, tt); return { x: lerp(232, 1500, u), y: lerp(650, FL - r, u) - 260 * 4 * u * (1 - u) }; }
      const u = prog(F.land, 14.0, tt); return { x: lerp(1500, 1730, u), y: FL - r - 120 * 4 * u * (1 - u) };
    };
    const dashed = (fn, t0, t1) => {
      if (t1 <= t0) return;
      ctx.save(); ctx.setLineDash([10, 12]); ctx.strokeStyle = 'rgba(14,28,43,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let tt = t0, i = 0; tt <= t1 + 1e-6; tt += 0.01, i++) { const q = fn(Math.min(tt, t1)); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
      ctx.stroke(); ctx.restore();
    };
    dashed(S1, F.serve1, Math.min(t, 12.98));
    if (t >= F.serve2) dashed(S2, F.serve2, t);
    // server's paddle
    const lastServe = t >= F.serve2 ? F.serve2 : F.serve1, sa = t - lastServe;
    const sw = sa < 0.35 ? Math.sin(clamp(sa / 0.35) * Math.PI) : 0;
    ctx.save(); ctx.translate(190, 668); ctx.rotate(-0.5 + 0.6 * sw);
    ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.fillStyle = P.paper;
    ctx.beginPath(); ctx.roundRect(-30, -86, 60, 82, [26, 26, 10, 10]); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-8, -4, 16, 46, 5); ctx.fill(); ctx.stroke();
    ctx.restore();
    // oops marks
    if (t >= F.net && t < 13.0) {
      const a = t - F.net;
      for (let i = 0; i < 3; i++) {
        const an = -2.2 + i * 0.5, q = E.outCubic(clamp(a / 0.15));
        inkPath([[NX - 40 + Math.cos(an) * 40, 640 + Math.sin(an) * 40], [NX - 40 + Math.cos(an) * (40 + 30 * q), 640 + Math.sin(an) * (40 + 30 * q)]], 4, ink, 50 + i, 0.5);
      }
      txt('(happens to everyone)', NX + 60, 700, { size: 30, weight: 500, fam: FT, italic: true, color: ink, alpha: 0.7 * prog(12.55, 12.75, t) });
    }
    // check mark
    if (t >= F.land) {
      const a = t - F.land;
      const cp = E.outCubic(clamp(a / 0.22));
      ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(1500, FL - 4, 70, 26, -0.05, -1.2, -1.2 + TAU * cp); ctx.stroke(); ctx.restore();
      const kp = E.outCubic(clamp((a - 0.1) / 0.2));
      if (kp > 0) {
        const pts = [[1470, 700], [1500, 735], [1570, 640]];
        const L1 = Math.hypot(30, 35), L2 = Math.hypot(70, 95), tot = L1 + L2, d = kp * tot;
        const end = d <= L1 ? [lerp(pts[0][0], pts[1][0], d / L1), lerp(pts[0][1], pts[1][1], d / L1)] : [lerp(pts[1][0], pts[2][0], (d - L1) / L2), lerp(pts[1][1], pts[2][1], (d - L1) / L2)];
        const path = d <= L1 ? [pts[0], end] : [pts[0], pts[1], end];
        inkPath(path, 9, '#2E8B57', 70, 0);
      }
    }
    const b = t < F.serve2 ? S1(t) : S2(t);
    softShadow(b.x, FL + 2, r * 1.2, 5, 0.25);
    drawBall(b.x, b.y, r, { spinX: t * 9 });
    ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.stroke(); ctx.restore();
    // headline with highlighter
    const tw = measure('FIRST-TIMERS.', 150);
    const hp = E.outCubic(prog(12.12, 12.45, t));
    ctx.save(); ctx.fillStyle = 'rgba(216,238,58,0.85)';
    ctx.beginPath(); ctx.moveTo(98, 222); ctx.lineTo(98 + (tw + 24) * hp, 214); ctx.lineTo(98 + (tw + 24) * hp, 284); ctx.lineTo(98, 288); ctx.closePath(); ctx.fill(); ctx.restore();
    reveal('FIRST-TIMERS.', 104, 270, t, 12.0, { size: 150, color: ink, stagger: 0.025, dur: 0.4 });
    label('WEEK ONE', 112, 110, prog(12.05, 12.2, t), ink);
  }

  // ======================================================================
  // SCENE — LIFERS. (the endless bounce line)
  // ======================================================================
  function sceneLifers(lt, p, t) {
    ctx.fillStyle = P.navy; ctx.fillRect(0, 0, W, H);
    bokeh(121, 18, 0, 600, -t * 50, 0.6);
    const FL = 700, hop = 0.25, dx = 250, r = 24;
    const X = tt => (tt - 14) / hop * dx;
    const Y = tt => { const i = Math.floor((tt - 14) / hop), u = (tt - 14) / hop - i; const hh = (((i % 2) + 2) % 2) ? 230 : 150; return FL - r - hh * 4 * u * (1 - u); };
    const camX = Math.max(0, X(t) - (1120 - 480));
    const sxOf = tt => 480 + X(tt) - camX;
    ctx.fillStyle = 'rgba(241,235,223,0.22)'; ctx.fillRect(0, FL, W, 2);
    // ticks at every landing
    for (let i = -8; i < 12; i++) {
      const tt = 14 + i * hop; const x = sxOf(tt); if (x < -20 || x > W + 20) continue;
      const on = tt <= t;
      ctx.fillStyle = on ? 'rgba(216,238,58,0.9)' : 'rgba(241,235,223,0.25)'; ctx.fillRect(x - 1.5, FL + 10, 3, on ? 22 : 12);
    }
    // the bounce line
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 1000, 0);
    g.addColorStop(0, 'rgba(216,238,58,0)'); g.addColorStop(1, 'rgba(216,238,58,1)');
    ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(216,238,58,0.6)'; ctx.shadowBlur = 18;
    ctx.beginPath();
    let first = true;
    for (let tt = 12.0; tt <= t; tt += 0.004) { const x = sxOf(tt); if (x < -50) continue; const y = Y(tt); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; }
    ctx.stroke(); ctx.restore();
    // ball
    const i = Math.floor((t - 14) / hop), u = (t - 14) / hop - i;
    const sq = 0.22 * Math.exp(-u * hop * 40);
    softShadow(sxOf(t), FL + 4, r * 1.4, 7, 0.4);
    drawBall(sxOf(t), Y(t) + r * sq, r, { spinX: t * 12, squash: sq, glow: 0.6 });
    // counter
    const n = Math.round(10000 * E.inExpo(prog(14.05, 15.65, t)));
    label('RALLY SHOTS', 1810 - measure('RALLY SHOTS', 22, 600, FM, false, 4), 150, prog(14.05, 14.2, t), P.paper);
    txt(n.toLocaleString('en-US') + (t > 15.65 ? '+' : ''), 1810, 280, { size: 120, weight: 800, fam: FM, color: P.ball, align: 'right', alpha: prog(14.0, 14.12, t) });
    label('SINCE DAY ONE', 112, 772, prog(14.05, 14.2, t));
    reveal('LIFERS.', 104, 1010, t, 14.0, { size: 290, stagger: 0.035, dur: 0.45 });
    vignette(0.35);
  }

  // ======================================================================
  // SCENE — EVERYBODY. (1 -> 64 courts)
  // ======================================================================
  const TILE_COLORS = ['#3A6482', '#2F5D7C', '#41708F', '#355B77', '#3B6A86'];
  function sceneEverybody(lt, p, t) {
    ctx.fillStyle = P.night; ctx.fillRect(0, 0, W, H);
    const n = t < 16.5 ? 1 : t < 17.0 ? 2 : t < 17.5 ? 4 : 8;
    const ls = n === 1 ? 16.0 : n === 2 ? 16.5 : n === 4 ? 17.0 : 17.5;
    const e = E.outExpo(prog(ls, ls + 0.34, t));
    let z, cx, cy;
    if (n === 1) { z = lerp(1.12, 1, E.outCubic(prog(16.0, 16.4, t))); cx = W / 2; cy = H / 2; }
    else { z = lerp(2, 1, e); cx = lerp(W / 4, W / 2, e); cy = lerp(H / 4, H / 2, e); }
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cx, -cy);
    const tw = W / n, th = H / n, gap = 8 / z;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const R = rng(1000 + i * 31 + j * 7 + n * 101);
      const x = j * tw, y = i * th;
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x + gap / 2, y + gap / 2, tw - gap, th - gap, 14 / n); ctx.clip();
      ctx.fillStyle = P.clay; ctx.fillRect(x, y, tw, th);
      const k = Math.min((tw * 0.8) / 13.41, (th * 0.78) / 6.1);
      ctx.translate(x + tw / 2, y + th / 2);
      courtTop(ctx, k, { court: TILE_COLORS[Math.floor(R() * TILE_COLORS.length)], lw: 0.07 });
      let land0;
      if (n <= 2) land0 = ls;
      else if (n === 4) land0 = 17.0 + ((i + j) % 2) * 0.25;
      else land0 = 17.5 + (i + j) * 0.03;
      const v = ((((t - land0) / 0.5) % 1) + 1) % 1;
      const hh = 0.9 * 4 * v * (1 - v);
      const bx = (R() - 0.5) * 9 * k, by = (R() - 0.5) * 4 * k;
      const br = Math.max(2.2, k * 0.12 * (1 + hh * 0.9));
      const since = t - land0;
      if (since >= 0 && since < 0.4) ring(bx, by, br + since * k * 1.6, Math.max(1, 2.5 / n * 2), `rgba(242,238,229,${0.6 * (1 - since / 0.4)})`);
      softShadow(bx + hh * k * 0.35, by + hh * k * 0.5, br * 1.3, br * 1.3, 0.4);
      ctx.restore();
      drawBall(x + tw / 2 + bx, y + th / 2 + by, br, { glow: 0.5, spinX: t * 4 + i });
    }
    ctx.restore();
    // title band
    const s = E.outBack(prog(16.0, 16.35, t));
    const tw2 = measure('EVERYBODY.', 150);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
    ctx.fillStyle = 'rgba(8,20,32,0.94)'; ctx.beginPath(); ctx.roundRect(-tw2 / 2 - 70, -115, tw2 + 140, 230, 30); ctx.fill();
    ctx.restore();
    if (s > 0.5) {
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
      txt('ALL LEVELS · ALL AGES', W / 2, H / 2 - 52, { size: 22, weight: 600, fam: FM, ls: 5, color: P.ball, align: 'center' });
      txt('EVERYBODY.', W / 2, H / 2 + 72, { size: 150, align: 'center' });
      ctx.restore();
    }
    vignette(0.3);
  }

  // ======================================================================
  // SCENE — BUILT FOR PICKLEBALL. (real club footage)
  // ======================================================================
  function sceneBuiltFor(lt, p, t) {
    let g = ctx.createRadialGradient(1300, 500, 0, 1100, 540, 1500);
    g.addColorStop(0, '#16304A'); g.addColorStop(1, '#060E16');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.07; ctx.translate(1250 - lt * 30, 560); ctx.rotate(-0.32);
    courtTop(ctx, 150, { court: null, net: false, lw: 0.04 }); ctx.restore();
    const e = E.outExpo(prog(18.0, 18.5, t));
    const ch = 880, cw = ch * 804 / 1080;
    const cx = 1405 + 760 * (1 - e), cy = 540, rot = 0.07 * (1 - e) - 0.012;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 34;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 30); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 30); ctx.clip();
    const fi = Math.max(0, Math.min(147, Math.round((t - 18 + 0.25) * 30)));
    const im = IMG[fi];
    const kb = 1.1 - 0.06 * lt;
    if (im && im.complete) ctx.drawImage(im, -cw / 2 * kb, -ch / 2 * kb, cw * kb, ch * kb);
    g = ctx.createLinearGradient(0, -ch / 2, 0, ch / 2);
    g.addColorStop(0, 'rgba(6,14,22,0.25)'); g.addColorStop(0.6, 'rgba(6,14,22,0)'); g.addColorStop(1, 'rgba(6,14,22,0.55)');
    ctx.fillStyle = g; ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    ctx.restore();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 30); ctx.stroke();
    ctx.restore();
    label('INDOOR · YEAR-ROUND', 112, 330, prog(18.05, 18.25, t));
    reveal('COURTS BUILT', 104, 470, t, 18.05, { size: 100, stagger: 0.022 });
    reveal('FOR PICKLEBALL.', 104, 590, t, 18.3, { size: 100, stagger: 0.022 });
    reveal('ONLY PICKLEBALL.', 104, 760, t, 18.85, { size: 100, stagger: 0.022, color: P.ball });
    vignette(0.35);
  }

  // ======================================================================
  // SCENE — CLIMAX: the rally, the pop-up, the hang (0:20–0:25)
  // ======================================================================
  const APEX = { x: 962, y: 262 };
  function sceneClimax(lt, p, t) {
    const times = TL.RALLY;
    const xs = [640, 1280], ys = [478, 452, 470, 440, 466, 446, 472];
    const pop = a => { // pop-up off the left paddle frame, decelerating into the hang
      const u = E.outCubic(prog(0, 0.62, a));
      let x = lerp(xs[0] + 40, APEX.x, E.outQuad(u)), y = lerp(ys[6], APEX.y, 1 - (1 - u) * (1 - u));
      const T = times[6] + a;
      if (T > 22.0) y += 6 * Math.sin((T - 22.0) * 1.4);
      if (T > 24.7) y += 3800 * (T - 24.7) * (T - 24.7);
      return { x, y };
    };
    const { pos } = rally(t, times, xs, ys, pop);
    const hang = prog(22.0, 22.6, t);
    // camera
    let z = 1 + 0.05 * prog(20, 22, t), fx = 960, fy = 540;
    const ce = E.outCubic(prog(22.0, 24.0, t)) * 0.9 + 0.1 * E.inOutSine(prog(22.0, 24.7, t));
    z += 2.05 * ce; fx = lerp(960, APEX.x, ce); fy = lerp(540, APEX.y + 62, ce);
    const lastHit = lastBefore(times, t), a = t - times[Math.max(0, lastHit)];
    const amp = t < 22 ? (4 + 10 * prog(20.5, 21.5, t)) * Math.exp(-a * 20) + 3 * prog(21.0, 22.0, t) : 0;
    const [sx, sy] = shake(7, amp, t);
    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(z, z); ctx.translate(-fx, -fy);
    sideStage(t < 22 ? t : 22 + (t - 22) * 0.05, { seed: 97, top: '#050D15', bottom: '#0F2234', bokehMul: 0.9 });
    sidePaddles(Math.min(t, 21.75), times, xs, ys, { alpha: 1 - 0.7 * hang });
    ctx.restore();
    // darken + shaft of light during the hang
    ctx.fillStyle = `rgba(2,6,10,${0.78 * hang})`; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(z, z); ctx.translate(-fx, -fy);
    if (hang > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(APEX.x - 200, 0, APEX.x + 200, 0);
      g.addColorStop(0, 'rgba(255,240,215,0)'); g.addColorStop(0.5, `rgba(255,240,215,${0.12 * hang})`); g.addColorStop(1, 'rgba(255,240,215,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(APEX.x - 70, -400); ctx.lineTo(APEX.x + 70, -400); ctx.lineTo(APEX.x + 230, SIDE.floor); ctx.lineTo(APEX.x - 230, SIDE.floor); ctx.closePath(); ctx.fill();
      ctx.restore();
      motes(131, 70, t * (t > 22 ? 0.25 : 1), APEX.x - 380, -100, APEX.x + 380, 760, 0.45 * hang, 0.8, 0.6);
    }
    if (t < 22.2) streak(pos, t, 20.0, 10, t < 21.5 ? 0.006 : 0.012, 22, 0.5 * (1 - prog(21.9, 22.2, t)));
    if (lastHit >= 0 && t < 22) burst(lastHit === 6 ? xs[0] + 40 : xs[lastHit % 2], ys[lastHit], a, { r0: 26, r1: 120, n: 10, lw: 3, dur: 0.14, seed: lastHit + 20 });
    const b = pos(t);
    const spin = t < 22 ? t * 30 : 22 * 30 + (t - 22) * 0.6;
    drawBall(b.x, b.y, 22, { spinX: spin, spinY: 0.7 + (t > 22 ? (t - 22) * 0.3 : 0), glow: 0.6 + 0.6 * hang });
    ctx.restore();
    // freeze flash
    if (t >= 22.0) { ctx.fillStyle = `rgba(255,252,240,${0.28 * Math.exp(-(t - 22.0) * 9)})`; ctx.fillRect(0, 0, W, H); }
    vignette(0.4 + 0.25 * hang);
    const outA = 1 - prog(24.4, 24.7, t);
    reveal('Everybody’s got a bounce.', W / 2, 935, t, 22.55, { size: 78, weight: 500, align: 'center', stagger: 0.03, dur: 0.6, rise: 0.45, alpha: outA, fade: true });
  }

  // ======================================================================
  // SCENE — THE LAND + LOGO (0:25–0:30)
  // ======================================================================
  let LOGO = null;
  function logoLayout() {
    if (LOGO) return LOGO;
    const size = 230, ls = -4;
    const wB = measure('B', size, 900, FD, false, ls), wU = measure('UNCE', size, 900, FD, false, ls);
    const cap = size * 0.727, d = cap * 1.04, gap = size * 0.04;
    const total = wB + gap + d + gap + wU, x0 = W / 2 - total / 2, baseline = 470;
    LOGO = { size, ls, wB, wU, cap, d, R: d / 2, gap, x0, baseline, ox: x0 + wB + gap + d / 2, oy: baseline - cap / 2, total };
    return LOGO;
  }
  function sceneLogo(lt, p, t) {
    const L = logoLayout();
    let g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H / 2, 1250);
    g.addColorStop(0, '#16304A'); g.addColorStop(1, '#050C13');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.05; ctx.translate(W / 2, H / 2 + 20); courtTop(ctx, 150, { court: null, lw: 0.035, net: false }); ctx.restore();
    const LAND = TL.LAND, S = TL.SETTLE;
    // ball height / position
    let h, bx = L.ox, by = L.oy, sq = 0;
    if (t < LAND) {
      const u = prog(25.0, LAND, t); h = 0.91 * (1 - u * u);
      bx = lerp(1020, L.ox, u * u); by = lerp(640, L.oy, u * u);
    } else {
      const bounds = [LAND].concat(S), amps = [0.17, 0.09, 0.05, 0.025, 0.012];
      h = 0;
      for (let k = 0; k < bounds.length - 1; k++) if (t >= bounds[k] && t < bounds[k + 1]) { const u = (t - bounds[k]) / (bounds[k + 1] - bounds[k]); h = amps[k] * 4 * u * (1 - u); }
      const lastLand = bounds[lastBefore(bounds, t)];
      sq = (lastLand === LAND ? 0.22 : 0.1) * Math.exp(-(t - lastLand) * 26);
    }
    const D = 1.0, R = L.R;
    const r = R * D / (D - h * 0.995);
    // shadow on floor
    softShadow(L.ox + h * 120, L.oy + R * 0.15 + h * 160, R * (1.05 + h * 2.5), R * (1.05 + h * 2.5), 0.55 * (1 - h * 0.85));
    // rings + floor flash
    if (t >= LAND) {
      const a = t - LAND;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      g = ctx.createRadialGradient(L.ox, L.oy, 0, L.ox, L.oy, 900);
      g.addColorStop(0, `rgba(255,250,232,${0.45 * Math.exp(-a * 5)})`); g.addColorStop(1, 'rgba(255,250,232,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      for (const [d, al] of [[0, 0.7], [0.09, 0.45], [0.18, 0.28]]) {
        const aa = a - d; if (aa < 0) continue;
        ring(L.ox, L.oy, R + 1100 * E.outExpo(clamp(aa / 1.4)), 2.5, `rgba(241,235,223,${al * (1 - clamp(aa / 1.2))})`);
      }
      for (const st of S) { const aa = t - st; if (aa < 0 || aa > 0.5) continue; ring(L.ox, L.oy, R + 140 * E.outCubic(aa / 0.5), 2, `rgba(216,238,58,${0.5 * (1 - aa / 0.5)})`); }
    }
    // wordmark letters slide out from behind the ball
    const pB = E.outExpo(prog(25.62, 26.35, t)), pU = E.outExpo(prog(25.66, 26.4, t));
    const bxT = lerp(L.ox - L.wB / 2, L.x0, pB), uxT = lerp(L.ox - L.wU / 2, L.x0 + L.wB + L.gap + L.d + L.gap, pU);
    txt('B', bxT, L.baseline, { size: L.size, ls: L.ls, alpha: prog(25.62, 25.85, t) });
    txt('UNCE', uxT, L.baseline, { size: L.size, ls: L.ls, alpha: prog(25.66, 25.9, t) });
    if (t < LAND) {
      const pts = []; for (let k = 4; k >= 1; k--) { const tt = Math.max(25.0, t - k * 0.012); const u = prog(25.0, LAND, tt); const hh = 0.91 * (1 - u * u); pts.push({ x: lerp(1020, L.ox, u * u), y: lerp(640, L.oy, u * u), r: R * D / (D - hh * 0.995) }); }
      ghosts(pts, 0.2);
    }
    drawBall(bx, by, r, { spinX: 1.0 + (t < LAND ? (t - 25) * 6 : 3 + (t - LAND) * 0.4), spinY: 0.7, squash: -sq, glow: 0.5 });
    // tagline + lockup
    reveal('Come find yours.', W / 2, L.baseline + 128, t, 26.7, { size: 66, weight: 500, align: 'center', stagger: 0.022, dur: 0.55, rise: 0.5, fade: true });
    const dl = E.outCubic(prog(27.15, 27.5, t));
    ctx.fillStyle = P.ball; ctx.fillRect(W / 2 - 40 * dl, L.baseline + 186, 80 * dl, 3);
    txt('INDOOR PICKLEBALL CLUBS', W / 2, L.baseline + 248, { size: 24, weight: 600, fam: FT, ls: 8, align: 'center', alpha: 0.8 * prog(27.25, 27.6, t) });
    txt('bouncepb.com', W / 2, L.baseline + 316, { size: 46, weight: 700, color: P.ball, align: 'center', alpha: prog(27.4, 27.75, t) });
    vignette(0.4);
  }

  // ------------------------------------------------------------------ dispatch
  const SCENES = {
    drop: sceneDrop, paddleMacro: scenePaddleMacro, netTape: sceneNetTape, lineCall: sceneLineCall,
    ballMacro: sceneBallMacro, paddleSwing: scenePaddleSwing, accel: sceneAccel, soft: sceneSoft,
    fast: sceneFast, firstTimers: sceneFirst, lifers: sceneLifers, everybody: sceneEverybody,
    builtFor: sceneBuiltFor, climax: sceneClimax, logo: sceneLogo,
  };
  const VIG = { drop: 0.5, paddleMacro: 0.45, netTape: 0.45, lineCall: 0.3, ballMacro: 0.45, paddleSwing: 0.45, accel: 0.35, soft: 0.28, fast: 0.4 };

  function renderAt(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.letterSpacing = '0px';
    ctx.clearRect(0, 0, W, H);
    const shot = TL.SHOTS.find(s => t >= s.s && t < s.e) || TL.SHOTS[TL.SHOTS.length - 1];
    const lt = t - shot.s;
    SCENES[shot.scene](lt, shot.p || {}, t);
    if (VIG[shot.scene]) { ctx.setTransform(1, 0, 0, 1, 0, 0); vignette(VIG[shot.scene]); }
  }
  window.renderFrame = f => renderAt(f / TL.FPS);
  window.renderAt = renderAt;

  window.ready = (async () => {
    PAT.grain = makeNoise(256, 7, 0.09);
    PAT.carbon = makeCarbon();
    await loadFootage();
    const fonts = ['300 100px "Inter Display"', '500 100px "Inter Display"', '700 100px "Inter Display"', '800 100px "Inter Display"',
      'italic 800 100px "Inter Display"', '900 100px "Inter Display"', '600 30px "Inter"', 'italic 500 30px "Inter"',
      '500 30px "JetBrains Mono"', '600 30px "JetBrains Mono"', '800 30px "JetBrains Mono"'];
    await Promise.all(fonts.map(f => document.fonts.load(f).catch(() => {})));
    for (const f of fonts) { ctx.font = f; ctx.fillText('Bounce 0123', -1000, -1000); }
    renderAt(0);
    return true;
  })();
})();
