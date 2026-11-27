'use strict';
// Bounce cast — rig-based, flat-vector illustrated players.
// Units: 1.0 = a standing adult's height. Canvas coords (y down). Characters face +x;
// mirror with facing = -1. Poses are joint angles, so any pose can blend into any other.
(function (root) {
  const TAU = Math.PI * 2, D = Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (k <= 1) { r *= k; g *= k; b *= k; } else { const t = k - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }

  const SKIN = { s1: '#F3CDAA', s2: '#E6B48C', s3: '#C98C62', s4: '#9E6845', s5: '#6E4630', s6: '#4B2F22' };
  const BRAND = { blue: '#11ACDB', gold: '#C9A84C', slate: '#4F758B', navy: '#0B1728', coral: '#F0657A', teal: '#2BB3A6', white: '#F7F6F2', ink: '#14181F' };

  // ------------------------------------------------------------- the cast
  const CAST = {
    tasha: { name: 'Tasha', note: 'league regular · 40s', skin: SKIN.s5, height: 0.99, build: 1.0, fem: true,
      hair: { style: 'puff', color: '#1C1410', band: BRAND.blue }, top: { style: 'tee', color: BRAND.coral },
      bottom: { style: 'leggings', color: '#1A2030' }, shoe: { color: '#FFFFFF', accent: BRAND.blue, sole: '#E9E6DF' },
      paddle: { face: BRAND.blue, edge: '#0B1728', grip: '#1A1E24' }, acc: ['wristband'], accColor: '#FFFFFF' },
    walt: { name: 'Walt', note: 'morning open play · 70s', skin: SKIN.s1, height: 0.98, build: 1.14, belly: 0.016,
      hair: { style: 'fringe', color: '#E4E0D8' }, top: { style: 'polo', color: '#2E6DB4' },
      bottom: { style: 'shorts', color: '#CDB993' }, shoe: { color: '#F2F2F0', accent: '#7B8594', sole: '#D9D6CF' },
      paddle: { face: '#15181D', edge: BRAND.gold, grip: '#2A2E35' }, acc: ['glasses'], socks: true },
    jess: { name: 'Jess', note: 'clinic grad · 30s', skin: SKIN.s1, height: 0.96, build: 0.92, fem: true,
      hair: { style: 'ponytail', color: '#E0B35C' }, top: { style: 'tank', color: BRAND.ink },
      bottom: { style: 'skirt', color: BRAND.white }, shoe: { color: '#FFFFFF', accent: BRAND.coral, sole: '#F0EDE6' },
      paddle: { face: BRAND.white, edge: BRAND.coral, grip: '#1A1E24' }, acc: ['headband'], accColor: BRAND.coral },
    dev: { name: 'Dev', note: 'after-work hitter · 20s', skin: SKIN.s4, height: 1.04, build: 1.0,
      hair: { style: 'curly', color: '#15110E' }, top: { style: 'tee', color: BRAND.ink },
      bottom: { style: 'shorts', color: '#1F3A5F' }, shoe: { color: BRAND.gold, accent: '#FFFFFF', sole: '#F3F0E8' },
      paddle: { face: BRAND.gold, edge: '#0B1728', grip: '#1A1E24' }, acc: [], logoTee: true },
    marge: { name: 'Marge', note: 'tournament fixture · 60s', skin: SKIN.s2, height: 0.94, build: 1.04, fem: true,
      hair: { style: 'bob', color: '#CFCBC4' }, top: { style: 'tee', color: BRAND.teal },
      bottom: { style: 'leggings', color: '#161B24' }, shoe: { color: '#FFFFFF', accent: BRAND.teal, sole: '#E9E6DF' },
      paddle: { face: '#7B5CD6', edge: '#0B1728', grip: '#1A1E24' }, acc: ['visor'], accColor: '#FFFFFF' },
    kenji: { name: 'Kenji', note: 'competitive 4.0 · 40s', skin: SKIN.s2, height: 1.0, build: 0.98,
      hair: { style: 'short', color: '#121212' }, top: { style: 'tee', color: BRAND.gold },
      bottom: { style: 'shorts', color: '#3A3F47' }, shoe: { color: '#1B1F26', accent: BRAND.blue, sole: '#F0EDE6' },
      paddle: { face: '#15181D', edge: BRAND.blue, grip: '#2A2E35' }, acc: ['cap'], accColor: BRAND.navy },
  };

  // ------------------------------------------------------------- poses
  // fa/ba = front/back arm [shoulder (deg from straight down, + = forward), elbow flex]
  // fl/bl = front/back leg [hip (deg from down, + = forward), knee flex]; pad = paddle angle vs forearm
  const POSES = {
    stand:      { lean: 3, head: 0, fa: [16, 34], ba: [-6, 14], fl: [5, 4], bl: [-5, 6], pad: 24 },
    ready:      { lean: 18, head: -14, fa: [40, 74], ba: [26, 72], fl: [30, 58], bl: [10, 50], pad: 30 },
    dinkBack:   { lean: 26, head: -18, fa: [24, 30], ba: [12, 58], fl: [38, 64], bl: [-22, 26], pad: 18 },
    dink:       { lean: 34, head: -24, fa: [64, 10], ba: [-14, 56], fl: [46, 76], bl: [-26, 22], pad: 26 },
    lift:       { lean: 30, head: -26, fa: [84, 34], ba: [-12, 50], fl: [44, 72], bl: [-26, 22], pad: 42 },
    volleyBack: { lean: 16, head: -10, fa: [46, 112], ba: [30, 80], fl: [30, 56], bl: [10, 50], pad: 24 },
    volley:     { lean: 14, head: -10, fa: [80, 46], ba: [34, 80], fl: [30, 56], bl: [10, 50], pad: 28 },
    overheadBack: { lean: -14, head: -32, fa: [156, 122], ba: [138, 6], fl: [10, 14], bl: [-16, 26], pad: 10, armBack: 1 },
    overhead:   { lean: -6, head: -26, fa: [176, 18], ba: [96, 24], fl: [12, 14], bl: [-22, 26], pad: 0 },
    smash:      { lean: 26, head: -6, fa: [56, 8], ba: [24, 46], fl: [30, 30], bl: [-26, 18], pad: -8, heelB: 1 },
    serveBack:  { lean: 10, head: -8, fa: [-40, 12], ba: [44, 34], fl: [20, 18], bl: [-16, 24], pad: 0 },
    serve:      { lean: 8, head: -10, fa: [96, 24], ba: [28, 40], fl: [26, 10], bl: [-30, 36], pad: -16, heelB: 1 },
    serveHit:   { lean: 14, head: -12, fa: [34, 6], ba: [42, 30], fl: [24, 14], bl: [-24, 30], pad: 14 },
    oops:       { lean: -2, head: -4, fa: [14, 26], ba: [150, 118], fl: [6, 6], bl: [-6, 8], pad: 20 },
    reach:      { lean: 42, head: -22, fa: [100, 6], ba: [-30, 40], fl: [58, 84], bl: [-34, 14], pad: 10 },
    celebrate:  { lean: -4, head: -20, fa: [166, 14], ba: [152, 22], fl: [10, 18], bl: [-8, 22], pad: -6 },
    nod:        { lean: 2, head: -6, fa: [130, 40], ba: [-4, 16], fl: [6, 6], bl: [-6, 8], pad: 0 },
  };

  function blend(a, b, t) {
    const o = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const va = a[k] ?? (Array.isArray(b[k]) ? b[k] : 0), vb = b[k] ?? (Array.isArray(a[k]) ? a[k] : 0);
      o[k] = Array.isArray(va) ? va.map((v, i) => lerp(v, vb[i], t)) : lerp(va, vb, t);
    }
    return o;
  }
  // keyframes: [[t, poseName or pose, opts], ...] -> pose at time t (sine-eased)
  function track(keys, t) {
    const P = k => (typeof k === 'string' ? POSES[k] : k);
    if (t <= keys[0][0]) return P(keys[0][1]);
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, p0] = keys[i], [t1, p1] = keys[i + 1];
      if (t >= t0 && t <= t1) { const u = (t - t0) / (t1 - t0); return blend(P(p0), P(p1), -(Math.cos(Math.PI * u) - 1) / 2); }
    }
    return P(keys[keys.length - 1][1]);
  }

  // ------------------------------------------------------------- skeleton
  const SK = { thigh: 0.245, shin: 0.235, torso: 0.3, neck: 0.036, headR: 0.081, upper: 0.165, fore: 0.15, foot: 0.1, footH: 0.032 };

  function footShape(A, F, Hh, lift) {
    const pts = [[-0.24 * F, Hh], [0.76 * F, Hh], [0.8 * F, Hh * 0.35], [0.55 * F, -Hh * 0.15], [0.12 * F, -Hh * 0.45], [-0.22 * F, -Hh * 0.35]];
    const c = Math.cos(lift), s = Math.sin(lift);
    return pts.map(([x, y]) => ({ x: A.x + x * c - y * s, y: A.y + x * s + y * c }));
  }

  function solve(ch, P) {
    const h = ch.height || 1, L = k => SK[k] * h;
    const lean = P.lean * D, hd = (P.head || 0) * D;
    const up = [Math.sin(lean), -Math.cos(lean)];
    const pel = { x: 0, y: 0 };
    const S = { x: up[0] * L('torso'), y: up[1] * L('torso') };
    const neckA = lean * 0.7 + hd * 0.25;
    const N = { x: S.x + Math.sin(neckA) * L('neck'), y: S.y - Math.cos(neckA) * L('neck') };
    const headA = lean * 0.45 + hd;
    const R = L('headR');
    const Hc = { x: N.x + Math.sin(headA) * R * 0.9, y: N.y - Math.cos(headA) * R * 0.9 };
    const Sf = { x: up[0] * L('torso') * 0.9, y: up[1] * L('torso') * 0.9 };
    const Sb = { x: Sf.x - 0.016 * h, y: Sf.y - 0.006 * h };
    const arm = (B, [a, e]) => {
      const a1 = a * D, a2 = (a + e) * D;
      const E = { x: B.x + Math.sin(a1) * L('upper'), y: B.y + Math.cos(a1) * L('upper') };
      const Wr = { x: E.x + Math.sin(a2) * L('fore'), y: E.y + Math.cos(a2) * L('fore') };
      return { s: B, e: E, w: Wr, ang: a2 };
    };
    const leg = (B, [a, k]) => {
      const a1 = a * D, a2 = (a - k) * D;
      const K = { x: B.x + Math.sin(a1) * L('thigh'), y: B.y + Math.cos(a1) * L('thigh') };
      const A = { x: K.x + Math.sin(a2) * L('shin'), y: K.y + Math.cos(a2) * L('shin') };
      return { h: B, k: K, a: A, ang: a2 };
    };
    const fa = arm(Sf, P.fa), ba = arm(Sb, P.ba);
    const fl = leg({ x: 0.014 * h, y: 0.012 * h }, P.fl), bl = leg({ x: -0.014 * h, y: 0.006 * h }, P.bl);
    fl.foot = footShape(fl.a, L('foot'), L('footH'), (P.heelF || 0) * 38 * D);
    bl.foot = footShape(bl.a, L('foot'), L('footH'), (P.heelB || 0) * 38 * D);
    const lowest = Math.max(...fl.foot.map(p => p.y), ...bl.foot.map(p => p.y));
    const dy = -lowest - (P.air || 0) * h;
    const sh = p => { p.y += dy; };
    [pel, S, N, Hc, Sf, Sb, fa.e, fa.w, ba.e, ba.w, fl.h, fl.k, fl.a, bl.h, bl.k, bl.a, ...fl.foot, ...bl.foot].forEach(sh);
    const padA = fa.ang + (P.pad || 0) * D;
    const padDir = [Math.sin(padA), Math.cos(padA)];
    const padCenter = { x: fa.w.x + padDir[0] * 0.13 * h, y: fa.w.y + padDir[1] * 0.13 * h };
    return { h, lean, headA, R, pel, S, N, Hc, fa, ba, fl, bl, padA, padCenter };
  }

  // ------------------------------------------------------------- drawing primitives
  function limb(c, a, b, r0, r1, color) {
    const dx = b.x - a.x, dy = b.y - a.y, Ln = Math.hypot(dx, dy) || 1e-6, nx = -dy / Ln, ny = dx / Ln;
    c.fillStyle = color;
    // separate fills: a single path would let opposite windings cancel into holes
    c.beginPath();
    c.moveTo(a.x + nx * r0, a.y + ny * r0); c.lineTo(b.x + nx * r1, b.y + ny * r1);
    c.lineTo(b.x - nx * r1, b.y - ny * r1); c.lineTo(a.x - nx * r0, a.y - ny * r0); c.closePath();
    c.fill();
    c.beginPath(); c.arc(a.x, a.y, r0, 0, TAU); c.fill();
    c.beginPath(); c.arc(b.x, b.y, r1, 0, TAU); c.fill();
  }
  const along = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  function smoothClosed(c, pts) {
    const n = pts.length, mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    let m = mid(pts[n - 1], pts[0]);
    c.beginPath(); c.moveTo(m.x, m.y);
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], mm = mid(p, q); c.quadraticCurveTo(p.x, p.y, mm.x, mm.y); }
    c.closePath();
  }
  function torsoPts(pel, S, b, fem, belly, ext0) {
    const ax = S.x - pel.x, ay = S.y - pel.y, T = Math.hypot(ax, ay), ux = ax / T, uy = ay / T;
    const nx = -uy, ny = ux;
    const prof = [[-ext0, 0.06, 0.066], [0.14, 0.056, 0.064], [0.42, 0.05 + belly, 0.05], [0.62, 0.055 + belly * 0.4, 0.052],
      [0.78, 0.058 + (fem ? 0.012 : 0), 0.058], [0.93, 0.05, 0.056], [1.04, 0.026, 0.036]];
    const P = (u, o) => ({ x: pel.x + ux * u * T + nx * o * b, y: pel.y + uy * u * T + ny * o * b });
    const front = prof.map(([u, f]) => P(u, f)), back = prof.map(([u, , k]) => P(u, -k)).reverse();
    return { pts: front.concat(back), ux, uy, nx, ny, T };
  }

  // ------------------------------------------------------------- head & hair
  function drawHead(c, ch, J, opt) {
    const R = J.R, skin = ch.skin, hair = ch.hair, acc = ch.acc || [];
    c.save(); c.translate(J.Hc.x, J.Hc.y); c.rotate(J.headA);
    const hc = hair.color;
    // hair mass that sits behind the head
    if (hair.style === 'puff') { c.fillStyle = hc; c.beginPath(); c.arc(-0.58 * R, -0.78 * R, 0.64 * R, 0, TAU); c.fill(); }
    if (hair.style === 'bun') { c.fillStyle = hc; c.beginPath(); c.arc(-0.42 * R, -0.98 * R, 0.34 * R, 0, TAU); c.fill(); }
    if (hair.style === 'ponytail') {
      // gravity-aware: hangs straight down in world space, swings with motion
      const a = Math.PI / 2 - J.headA + (opt.swing || 0) * D + 0.18;
      const A = { x: -0.84 * R, y: -0.34 * R };
      const pt = (len, off) => ({ x: A.x + Math.cos(a + off) * len * R, y: A.y + Math.sin(a + off) * len * R });
      const M1 = pt(0.55, -0.55), M2 = pt(1.05, -0.2), T = pt(1.5, 0.05);
      c.fillStyle = hc;
      c.beginPath(); c.moveTo(A.x + 0.2 * R, A.y - 0.14 * R);
      c.bezierCurveTo(M1.x + 0.1 * R, M1.y - 0.22 * R, M2.x + 0.16 * R, M2.y, T.x + 0.06 * R, T.y);
      c.quadraticCurveTo(T.x, T.y + 0.14 * R, T.x - 0.08 * R, T.y);
      c.bezierCurveTo(M2.x - 0.22 * R, M2.y, M1.x - 0.3 * R, M1.y, A.x - 0.12 * R, A.y + 0.2 * R);
      c.closePath(); c.fill();
      c.fillStyle = ch.accColor || BRAND.coral; c.beginPath(); c.ellipse(A.x - 0.02 * R, A.y + 0.02 * R, 0.13 * R, 0.17 * R, a, 0, TAU); c.fill();
    }
    if (acc.includes('cap')) { // backwards cap bill
      c.fillStyle = shade(ch.accColor || '#0B1728', 0.85);
      c.beginPath(); c.moveTo(-0.8 * R, -0.42 * R); c.lineTo(-1.62 * R, -0.2 * R); c.quadraticCurveTo(-1.66 * R, -0.08 * R, -1.5 * R, -0.08 * R); c.lineTo(-0.86 * R, -0.16 * R); c.closePath(); c.fill();
    }
    // head + chin + nose as one silhouette
    c.fillStyle = skin;
    c.beginPath();
    c.ellipse(0, 0, 0.96 * R, 1.04 * R, 0, 0, TAU);
    c.moveTo(0.9 * R, 0.52 * R); c.ellipse(0.44 * R, 0.52 * R, 0.46 * R, 0.42 * R, 0, 0, TAU);
    c.moveTo(1.08 * R, 0.16 * R); c.ellipse(0.94 * R, 0.16 * R, 0.15 * R, 0.13 * R, 0, 0, TAU);
    c.fill();
    // hair cap (clipped region of an oversized circle)
    const cap = (poly, rad = 1.08) => {
      c.save(); c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo(x * R, y * R) : c.moveTo(x * R, y * R))); c.closePath(); c.clip();
      c.fillStyle = hc; c.beginPath(); c.arc(0, -0.02 * R, rad * R, 0, TAU); c.fill(); c.restore();
    };
    const SHORT = [[1.4, -1.5], [0.8, -0.5], [0.46, -0.44], [0.22, -0.3], [0.14, 0.08], [-0.02, -0.12], [-0.26, -0.06], [-0.48, 0.56], [-0.8, 0.78], [-1.5, 0.78], [-1.5, -1.5]];
    if (hair.style === 'short' || hair.style === 'ponytail' || hair.style === 'bun' || hair.style === 'curly') cap(SHORT);
    if (hair.style === 'puff') cap([[1.4, -1.5], [0.74, -0.58], [0.4, -0.5], [0.2, -0.32], [0.12, 0.06], [-0.04, -0.12], [-0.3, -0.06], [-0.5, 0.5], [-0.8, 0.7], [-1.5, 0.7], [-1.5, -1.5]]);
    if (hair.style === 'curly') {
      c.fillStyle = hc;
      for (let a = -100; a >= -250; a -= 18) { const r = a * D; c.beginPath(); c.arc(Math.cos(r) * 1.0 * R, Math.sin(r) * 1.0 * R - 0.02 * R, 0.25 * R, 0, TAU); c.fill(); }
    }
    if (hair.style === 'bob') cap([[1.5, -1.5], [0.94, -0.34], [0.56, -0.3], [0.44, 0.18], [0.36, 0.64], [-0.2, 0.9], [-1.5, 0.9], [-1.5, -1.5]], 1.13);
    if (hair.style === 'fringe') {
      cap([[0.18, -0.08], [0.08, 0.3], [-0.42, 0.64], [-1.4, 0.64], [-1.4, -0.22], [-0.22, -0.26]], 1.07);
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(0.05 * R, -0.72 * R, 0.36 * R, 0.16 * R, -0.2, 0, TAU); c.fill();
    }
    if (hair.style === 'puff' && hair.band) { c.fillStyle = hair.band; c.beginPath(); c.ellipse(-0.36 * R, -0.42 * R, 0.1 * R, 0.24 * R, 0.6, 0, TAU); c.fill(); }
    // ear (hidden under a bob)
    if (hair.style !== 'bob') {
      c.fillStyle = shade(skin, 0.9); c.beginPath(); c.ellipse(-0.1 * R, 0.08 * R, 0.14 * R, 0.2 * R, 0, 0, TAU); c.fill();
      c.fillStyle = shade(skin, 0.75); c.beginPath(); c.ellipse(-0.08 * R, 0.1 * R, 0.06 * R, 0.1 * R, 0, 0, TAU); c.fill();
    }
    // face: eye, brow, smile
    c.fillStyle = '#1B1512'; c.beginPath(); c.ellipse(0.6 * R, -0.03 * R, 0.075 * R, 0.09 * R, 0, 0, TAU); c.fill();
    c.strokeStyle = hair.style === 'fringe' ? shade(hc, 0.7) : hc; c.lineCap = 'round'; c.lineWidth = 0.07 * R;
    c.beginPath(); c.moveTo(0.44 * R, -0.24 * R); c.quadraticCurveTo(0.6 * R, -0.31 * R, 0.76 * R, -0.24 * R); c.stroke();
    c.strokeStyle = shade(skin, 0.6); c.lineWidth = 0.055 * R;
    c.beginPath(); c.moveTo(0.62 * R, 0.5 * R); c.quadraticCurveTo(0.74 * R, (0.56 + (opt.smile || 0) * 0.08) * R, 0.84 * R, 0.46 * R); c.stroke();
    // accessories
    if (acc.includes('glasses')) {
      c.strokeStyle = '#2A2F38'; c.lineWidth = 0.065 * R; c.fillStyle = 'rgba(210,235,255,0.28)';
      c.beginPath(); c.roundRect(0.44 * R, -0.2 * R, 0.46 * R, 0.32 * R, 0.08 * R); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(0.44 * R, -0.08 * R); c.lineTo(-0.06 * R, -0.06 * R); c.stroke();
    }
    if (acc.includes('visor')) {
      c.save(); c.beginPath(); c.arc(0, -0.02 * R, 1.11 * R, 0, TAU); c.clip();
      c.fillStyle = ch.accColor || '#FFFFFF'; c.fillRect(-1.3 * R, -0.62 * R, 2.6 * R, 0.24 * R); c.restore();
      c.fillStyle = shade(ch.accColor || '#FFFFFF', 0.86);
      c.beginPath(); c.moveTo(0.82 * R, -0.62 * R); c.lineTo(1.7 * R, -0.5 * R); c.quadraticCurveTo(1.76 * R, -0.4 * R, 1.62 * R, -0.38 * R); c.lineTo(0.9 * R, -0.38 * R); c.closePath(); c.fill();
    }
    if (acc.includes('headband')) {
      c.save(); c.beginPath(); c.arc(0, -0.02 * R, 1.1 * R, 0, TAU); c.clip();
      c.fillStyle = ch.accColor || BRAND.coral; c.save(); c.rotate(-0.12); c.fillRect(-1.3 * R, -0.66 * R, 2.6 * R, 0.2 * R); c.restore(); c.restore();
    }
    if (acc.includes('cap')) {
      c.save(); c.beginPath(); c.arc(0, -0.02 * R, 1.12 * R, 0, TAU); c.clip();
      c.fillStyle = ch.accColor || '#0B1728'; c.save(); c.rotate(0.12); c.fillRect(-1.4 * R, -1.4 * R, 2.8 * R, 1.02 * R); c.restore();
      c.restore();
      c.fillStyle = BRAND.blue; c.beginPath(); c.arc(0.1 * R, -1.08 * R, 0.09 * R, 0, TAU); c.fill();
    }
    c.restore();
  }

  // ------------------------------------------------------------- paddle
  function drawPaddle(c, ch, W, ang, sq = 0.9) {
    const p = ch.paddle, h = ch.height || 1;
    c.save(); c.translate(W.x, W.y); c.rotate(-ang); c.scale(sq, 1);
    c.fillStyle = p.grip; c.beginPath(); c.roundRect(-0.014 * h, -0.02 * h, 0.028 * h, 0.08 * h, 0.008 * h); c.fill();
    const face = new Path2D(); face.roundRect(-0.052 * h, 0.05 * h, 0.104 * h, 0.155 * h, [0.014 * h, 0.014 * h, 0.044 * h, 0.044 * h]);
    c.fillStyle = p.face; c.fill(face);
    c.save(); c.clip(face); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(-0.06 * h, 0.05 * h, 0.035 * h, 0.17 * h); c.restore();
    c.strokeStyle = p.edge; c.lineWidth = 0.009 * h; c.stroke(face);
    c.restore();
  }

  // ------------------------------------------------------------- full character
  function drawChar(c, ch, P, x, y, scale, facing = 1, opt = {}) {
    const J = solve(ch, P), b = ch.build || 1, h = J.h;
    const back = 0.8;
    const col = (hex, isBack) => (isBack ? shade(hex, back) : hex);
    c.save(); c.translate(x, y); c.scale(scale * facing, scale);
    // ground shadow
    if (!opt.noShadow) {
      const fx = (J.fl.a.x + J.bl.a.x) / 2 + 0.03;
      const lift = -Math.max(...J.fl.foot.map(p => p.y), ...J.bl.foot.map(p => p.y));
      const g = c.createRadialGradient(fx, 0, 0, fx, 0, 0.26);
      g.addColorStop(0, `rgba(0,0,0,${0.32 / (1 + lift * 8)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.save(); c.scale(1, 0.16); c.fillStyle = g; c.beginPath(); c.arc(fx, 0, 0.26, 0, TAU); c.fill(); c.restore();
    }
    const bot = ch.bottom, top = ch.top, skin = ch.skin;
    const legDraw = (lg, isBack) => {
      const sk = col(skin, isBack);
      const legCol = bot.style === 'leggings' ? col(bot.color, isBack) : sk;
      limb(c, lg.k, lg.a, 0.026 * b, 0.019 * b, legCol);
      limb(c, lg.h, lg.k, 0.038 * b, 0.027 * b, legCol);
      if (bot.style === 'shorts') limb(c, lg.h, along(lg.h, lg.k, 0.6), 0.047 * b, 0.04 * b, col(bot.color, isBack));
      if (ch.socks || bot.style !== 'leggings') limb(c, along(lg.k, lg.a, 0.86), lg.a, 0.021 * b, 0.021 * b, col('#F4F3EF', isBack));
      // shoe
      const f = lg.foot;
      c.fillStyle = col(ch.shoe.color, isBack);
      smoothClosed(c, f); c.fill();
      c.strokeStyle = col(ch.shoe.sole, isBack); c.lineWidth = 0.014 * h; c.lineCap = 'round';
      c.beginPath(); c.moveTo(f[0].x, f[0].y - 0.004); c.lineTo(f[1].x, f[1].y - 0.004); c.stroke();
      c.strokeStyle = col(ch.shoe.accent, isBack); c.lineWidth = 0.007 * h;
      c.beginPath(); const m1 = along(f[5], f[1], 0.35), m2 = along(f[4], f[2], 0.6); c.moveTo(m1.x, m1.y - 0.008); c.lineTo(m2.x, m2.y + 0.004); c.stroke();
    };
    const armDraw = (ar, isBack, withPaddle) => {
      const sk = col(skin, isBack);
      limb(c, ar.e, ar.w, 0.019 * b, 0.015 * b, sk);
      limb(c, ar.s, ar.e, 0.024 * b, 0.019 * b, sk);
      if (top.style === 'tee' || top.style === 'polo') limb(c, ar.s, along(ar.s, ar.e, 0.5), 0.034 * b, 0.03 * b, col(top.color, isBack));
      if (withPaddle) drawPaddle(c, ch, ar.w, J.padA, opt.paddleSq ?? 0.9);
      c.fillStyle = sk; c.beginPath(); c.arc(ar.w.x, ar.w.y, 0.021 * b, 0, TAU); c.fill();
      if (!isBack && (ch.acc || []).includes('wristband')) limb(c, along(ar.e, ar.w, 0.78), along(ar.e, ar.w, 0.92), 0.019 * b, 0.018 * b, ch.accColor || '#fff');
    };
    legDraw(J.bl, true);
    armDraw(J.ba, true, false);
    legDraw(J.fl, false);
    // hips
    c.fillStyle = bot.style === 'skirt' ? bot.color : bot.color;
    c.save(); c.translate(J.pel.x, J.pel.y); c.rotate(J.lean); c.beginPath(); c.ellipse(0, -0.01, 0.07 * b, 0.06 * b, 0, 0, TAU); c.fill(); c.restore();
    // neck
    limb(c, J.S, J.N, 0.021 * b, 0.02 * b, skin);
    // torso
    const tp = torsoPts(J.pel, J.S, b, ch.fem, ch.belly || 0, top.style === 'tank' ? 0.06 : 0.09);
    c.fillStyle = top.color; smoothClosed(c, tp.pts); c.fill();
    c.save(); smoothClosed(c, tp.pts); c.clip();
    c.translate(J.pel.x, J.pel.y); c.rotate(J.lean);
    c.fillStyle = 'rgba(0,0,0,0.14)'; c.fillRect(-0.2, -0.5, 0.2 - 0.024 * b, 0.7);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0.034 * b, -0.5, 0.2, 0.7);
    if (top.style === 'tank') { c.fillStyle = skin; c.beginPath(); c.ellipse(0, -tp.T * 1.0, 0.05 * b, 0.05, 0, 0, TAU); c.fill(); }
    if (ch.logoTee) { c.fillStyle = BRAND.blue; c.beginPath(); c.arc(0.028 * b, -tp.T * 0.7, 0.014, 0, TAU); c.fill(); }
    c.restore();
    if (top.style === 'polo') {
      c.save(); c.translate(J.S.x, J.S.y); c.rotate(J.lean);
      c.fillStyle = shade(top.color, 1.25);
      c.beginPath(); c.moveTo(0.006, 0.0); c.lineTo(0.05 * b, 0.012); c.lineTo(0.02 * b, 0.05); c.closePath(); c.fill();
      c.restore();
    }
    // skirt
    if (bot.style === 'skirt') {
      const L1 = J.fl.k.x > J.bl.k.x ? J.fl : J.bl, L2 = L1 === J.fl ? J.bl : J.fl;
      const hf = along(L1.h, L1.k, 0.46), hb = along(L2.h, L2.k, 0.46);
      const up = [Math.sin(J.lean), -Math.cos(J.lean)], n = [Math.cos(J.lean), Math.sin(J.lean)];
      const wf = { x: J.pel.x + n[0] * 0.066 * b + up[0] * 0.04, y: J.pel.y + n[1] * 0.066 * b + up[1] * 0.04 };
      const wb = { x: J.pel.x - n[0] * 0.07 * b + up[0] * 0.04, y: J.pel.y - n[1] * 0.07 * b + up[1] * 0.04 };
      c.fillStyle = bot.color;
      c.beginPath(); c.moveTo(wb.x, wb.y); c.lineTo(wf.x, wf.y); c.lineTo(hf.x + 0.05, hf.y + 0.01); c.lineTo(hb.x - 0.05, hb.y + 0.01); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.08)'; c.lineWidth = 0.004;
      for (const t of [0.35, 0.65]) { const a = along(wb, wf, t), e = along({ x: hb.x - 0.05, y: hb.y }, { x: hf.x + 0.05, y: hf.y }, t); c.beginPath(); c.moveTo(a.x, a.y + 0.02); c.lineTo(e.x, e.y); c.stroke(); }
    }
    const behind = (P.armBack || 0) > 0.5;
    if (behind) armDraw(J.fa, false, true);
    drawHead(c, ch, J, opt);
    if (!behind) armDraw(J.fa, false, true);
    c.restore();
    return J;
  }

  // world-space helper: where is a character's paddle face?
  function paddlePoint(ch, P, x, y, scale, facing = 1) {
    const J = solve(ch, P);
    return { x: x + facing * scale * J.padCenter.x, y: y + scale * J.padCenter.y };
  }

  const API = { CAST, POSES, BRAND, SKIN, solve, drawChar, track, blend, paddlePoint, shade };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BOUNCE_CAST = API;
})(typeof window !== 'undefined' ? window : globalThis);
