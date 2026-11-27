'use strict';
// Character study pages: #lineup, #poses, #rally (animated: renderAt(t), 0..6 s)
(function () {
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  const { CAST, POSES, BRAND, drawChar, track, paddlePoint } = window.BOUNCE_CAST;
  const cv = document.getElementById('c'), c = cv.getContext('2d');
  const LOGO = new Image(); LOGO.src = 'assets/brand/bounce-logo.png';
  const MARK = new Image(); MARK.src = 'assets/brand/bounce-mark.png';
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  function text(s, x, y, size, o = {}) {
    c.save();
    c.font = `${o.italic ? 'italic ' : ''}${o.weight || 500} ${size}px ${o.fam || 'Jost'}`;
    c.fillStyle = o.color || '#FFFFFF'; c.textAlign = o.align || 'left';
    if (o.ls) c.letterSpacing = o.ls + 'px';
    c.globalAlpha = o.alpha ?? 1;
    c.fillText(s, x, y); c.restore();
  }
  function backdrop() {
    const g = c.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.5, 1300);
    g.addColorStop(0, '#16304A'); g.addColorStop(1, '#07101C');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  function logo(x, y, h) { // logo-1.png content bbox is (42,38)-(1921,613)
    if (!LOGO.complete) return;
    const sx = 42, sy = 38, sw = 1879, sh = 575, w = h * sw / sh;
    c.drawImage(LOGO, sx, sy, sw, sh, x, y, w, h);
    return w;
  }
  function header(title, sub) {
    text(title, 96, 128, 58, { weight: 600 });
    text(sub, 98, 172, 24, { fam: 'Outfit', weight: 300, color: '#9FB6C8' });
    logo(W - 96 - 224, 74, 68);
  }

  // ------------------------------------------------------------ lineup
  function lineup() {
    backdrop();
    header('Meet the players', 'Round 1 · illustrated cast for “Find Your Bounce” · built on a posable rig');
    const order = ['walt', 'jess', 'dev', 'tasha', 'kenji', 'marge'];
    const gy = 800, sc = 480;
    c.fillStyle = 'rgba(79,117,139,0.35)'; c.fillRect(0, gy, W, H - gy);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, gy, W, 2);
    order.forEach((k, i) => {
      const x = 205 + i * 302;
      drawChar(c, CAST[k], POSES.stand, x, gy, sc, 1, { smile: 1 });
      text(CAST[k].name, x + 20, gy + 92, 38, { weight: 600, align: 'center' });
      text(CAST[k].note, x + 20, gy + 130, 21, { fam: 'Outfit', weight: 300, color: '#9FB6C8', align: 'center' });
    });
  }

  // ------------------------------------------------------------ poses
  function poses() {
    backdrop();
    header('Range of motion', 'Same rig, any pose — every swing in the spot blends between poses like these');
    const panels = [
      ['dev', 'ready', 'READY'], ['marge', 'dink', 'DINK'], ['tasha', 'volley', 'HANDS BATTLE'],
      ['kenji', 'overheadBack', 'OVERHEAD'], ['walt', 'serve', 'SERVE'], ['jess', 'celebrate', 'CELEBRATE'],
    ];
    const pw = 560, ph = 388, gx = 96, gy0 = 226, gap = 34;
    panels.forEach(([k, p, label], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = gx + col * (pw + gap), y = gy0 + row * (ph + gap);
      c.save(); c.beginPath(); c.roundRect(x, y, pw, ph, 22); c.clip();
      const g = c.createLinearGradient(0, y, 0, y + ph); g.addColorStop(0, '#13283E'); g.addColorStop(1, '#0D1D2E');
      c.fillStyle = g; c.fillRect(x, y, pw, ph);
      const fy = y + ph - 64;
      c.fillStyle = '#4F758B'; c.fillRect(x, fy, pw, ph); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, fy, pw, 2);
      const pose = Object.assign({}, POSES[p], p === 'celebrate' ? { air: 0.04 } : {});
      drawChar(c, CAST[k], pose, x + pw * 0.44, fy, 248, 1, { smile: p === 'celebrate' ? 1 : 0.4 });
      c.restore();
      text(label, x + 26, fy + 42, 20, { weight: 600, ls: 4, color: '#FFFFFF' });
      const lw = (() => { c.save(); c.font = '600 20px Jost'; c.letterSpacing = '4px'; const w = c.measureText(label).width; c.restore(); return w; })();
      text('\u00B7  ' + CAST[k].name, x + 36 + lw, fy + 42, 22, { fam: 'Outfit', weight: 400, color: '#DDE8EF' });
    });
  }

  // ------------------------------------------------------------ rally motion test
  const RALLY = (() => {
    const swing = (tc, back, hit, thru) => [[tc - 0.36, 'ready'], [tc - 0.16, back], [tc, hit], [tc + 0.14, thru || hit], [tc + 0.46, 'ready']];
    const L = { ch: CAST.tasha, x: 470, f: 1, keys: [[0, 'ready'], ...swing(0.6, 'dinkBack', 'dink'), ...swing(2.6, 'dinkBack', 'dink'),
      [3.9, 'ready'], [4.18, 'overheadBack'], [4.42, 'overheadBack'], [4.5, 'overhead'], [4.62, 'smash'], [4.95, 'ready'], [5.2, 'celebrate'], [6.2, 'celebrate']] };
    const R = { ch: CAST.walt, x: 1450, f: -1, keys: [[0, 'ready'], ...swing(1.6, 'dinkBack', 'dink'), ...swing(3.6, 'dinkBack', 'lift'),
      [4.4, 'ready'], [4.62, 'reach'], [4.9, 'reach'], [5.25, 'stand'], [5.5, 'nod'], [6.2, 'nod']] };
    return { L, R, gy: 905, sc: 455, br: 14 };
  })();
  function pp(P, t) { return paddlePoint(P.ch, track(P.keys, t), P.x, RALLY.gy, RALLY.sc, P.f); }
  let SEGS = null;
  function segs() {
    if (SEGS) return SEGS;
    const { L, R, gy, br } = RALLY, G = x => ({ x, y: gy - br });
    const cL1 = pp(L, 0.6), cR1 = pp(R, 1.6), cL2 = pp(L, 2.6), cR2 = pp(R, 3.6), cL3 = pp(L, 4.5);
    SEGS = [
      [-0.4, 0.2, cR1, G(735), 170], [0.2, 0.6, G(735), cL1, 70],
      [0.6, 1.2, cL1, G(1185), 170], [1.2, 1.6, G(1185), cR1, 70],
      [1.6, 2.2, cR1, G(735), 170], [2.2, 2.6, G(735), cL2, 70],
      [2.6, 3.2, cL2, G(1185), 170], [3.2, 3.6, G(1185), cR2, 70],
      [3.6, 4.5, cR2, cL3, 235],
      [4.5, 4.6, cL3, G(1230), 0], [4.6, 4.95, G(1230), { x: 2060, y: gy - 380 }, 40],
    ];
    return SEGS;
  }
  function ballAt(t) {
    for (const [t0, t1, a, b, A] of segs()) if (t >= t0 && t < t1) {
      const u = (t - t0) / (t1 - t0);
      return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) - 4 * A * u * (1 - u) };
    }
    return null;
  }
  function flatBall(x, y, r) {
    c.fillStyle = '#D8EE3A'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, TAU); c.fill();
    c.fillStyle = '#9DB81B';
    for (const [dx, dy] of [[0.25, 0.1], [-0.2, 0.35], [0.4, -0.35], [-0.45, -0.1]]) { c.beginPath(); c.arc(x + dx * r, y + dy * r, r * 0.13, 0, TAU); c.fill(); }
  }
  function stage(t) {
    const { gy } = RALLY;
    let g = c.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, '#060E18'); g.addColorStop(1, '#12263A');
    c.fillStyle = g; c.fillRect(0, 0, W, gy);
    // ceiling lights
    for (let i = 0; i < 7; i++) {
      const x = 140 + i * 275, gg = c.createRadialGradient(x, 70, 0, x, 70, 160);
      gg.addColorStop(0, 'rgba(255,244,226,0.22)'); gg.addColorStop(1, 'rgba(255,244,226,0)');
      c.fillStyle = gg; c.fillRect(x - 160, 0, 320, 260);
      c.fillStyle = 'rgba(255,248,236,0.85)'; c.fillRect(x - 70, 58, 140, 6);
    }
    // back-wall banner with the real logo
    c.fillStyle = '#0A121C'; c.fillRect(W / 2 - 300, 170, 600, 170);
    logo(W / 2 - 229, 205, 100);
    // barrier wall
    c.fillStyle = '#0D141C'; c.fillRect(0, gy - 120, W, 120);
    c.fillStyle = 'rgba(255,255,255,0.05)'; for (let x = 0; x < W; x += 240) c.fillRect(x, gy - 120, 3, 120);
    // court
    g = c.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, '#6A92A8'); g.addColorStop(0.2, '#4F758B'); g.addColorStop(1, '#2C4656');
    c.fillStyle = g; c.fillRect(0, gy, W, H - gy);
    for (const kx of [960 - 470, 960 + 470]) {
      c.fillStyle = 'rgba(245,243,238,0.85)'; c.beginPath();
      c.moveTo(kx - 3, gy); c.lineTo(kx + 3, gy); c.lineTo(960 + (kx - 960) * 1.4 + 8, H); c.lineTo(960 + (kx - 960) * 1.4 - 8, H); c.closePath(); c.fill();
    }
    // net
    const nt = gy - 0.52 * RALLY.sc;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(960, gy + 10, 90, 12, 0, 0, TAU); c.fill();
    c.fillStyle = '#0A0D10'; c.fillRect(952, nt - 6, 16, gy - nt + 6);
    c.save(); c.beginPath(); c.rect(926, nt + 10, 68, gy - nt - 10); c.clip();
    c.strokeStyle = 'rgba(30,36,44,0.95)'; c.lineWidth = 2;
    for (let y = nt - 60; y < gy; y += 14) { c.beginPath(); c.moveTo(926, y); c.lineTo(994, y + 28); c.stroke(); c.beginPath(); c.moveTo(926, y + 28); c.lineTo(994, y); c.stroke(); }
    c.restore();
    c.fillStyle = '#F1EEE7'; c.fillRect(924, nt, 72, 13);
  }
  function rally(t) {
    stage(t);
    const { L, R, gy, sc, br } = RALLY;
    const poseL = track(L.keys, t), poseR = track(R.keys, t);
    // little celebration hops for the winner
    let hop = 0;
    if (t > 5.25) hop = Math.abs(Math.sin((t - 5.25) * Math.PI * 2.4)) * 0.05 * Math.exp(-(t - 5.25) * 0.8);
    const pL = Object.assign({}, poseL, { air: hop });
    const lean0 = track(L.keys, t - 0.06).lean;
    drawChar(c, R.ch, poseR, R.x, gy, sc, R.f, { smile: t > 5.3 ? 1 : 0.3 });
    // paddle smear: a tapered ribbon along the paddle's actual path
    if (t >= 4.42 && t < 4.8) {
      const t0 = Math.max(4.38, t - 0.16), t1 = Math.min(t, 4.64), fade = 1 - Math.max(0, (t - 4.64) / 0.16);
      if (t1 > t0) {
        const pts = []; for (let k = 0; k <= 40; k++) pts.push(pp(L, t0 + (t1 - t0) * k / 40));
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let k = 1; k < pts.length; k++) {
          const u = k / (pts.length - 1);
          c.strokeStyle = `rgba(220,240,255,${0.16 * u * fade})`; c.lineWidth = 4 + 34 * u; c.lineCap = 'butt';
          c.beginPath(); c.moveTo(pts[k - 1].x, pts[k - 1].y); c.lineTo(pts[k].x, pts[k].y); c.stroke();
        }
        c.restore();
      }
    }
    drawChar(c, L.ch, pL, L.x, gy, sc, L.f, { smile: t > 5.1 ? 1 : 0.3, swing: (poseL.lean - lean0) * 6 });
    const b = ballAt(t);
    if (b) {
      const fast = t >= 4.5 && t < 4.95;
      if (fast) for (let k = 5; k >= 1; k--) { const q = ballAt(t - k * 0.012); if (q) { c.globalAlpha = 0.12 * (6 - k); c.fillStyle = '#D8EE3A'; c.beginPath(); c.arc(q.x, q.y, br * (1 - k * 0.08), 0, TAU); c.fill(); c.globalAlpha = 1; } }
      const hgt = gy - b.y;
      c.fillStyle = `rgba(0,0,0,${0.3 / (1 + hgt / 120)})`; c.beginPath(); c.ellipse(b.x, gy + 3, br * (1.2 + hgt / 300), 4, 0, 0, TAU); c.fill();
      flatBall(b.x, b.y, br);
    }
    text('MOTION TEST', 96, 150, 20, { weight: 600, ls: 5, color: BRAND.blue, alpha: 0.9 });
    text('Tasha vs. Walt — dink rally, pop-up, overhead', 290, 150, 20, { fam: 'Outfit', weight: 300, color: '#C8D6E0' });
  }

  const MODE = (location.hash || '#lineup').slice(1);
  window.renderAt = t => {
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    if (MODE === 'lineup') lineup(); else if (MODE === 'poses') poses(); else rally(t);
  };
  window.renderFrame = f => window.renderAt(f / 30);
  window.ready = (async () => {
    await Promise.all([LOGO.decode().catch(() => {}), MARK.decode().catch(() => {})]);
    await Promise.all(['500 40px Jost', '600 40px Jost', '300 20px Outfit', '400 20px Outfit'].map(f => document.fonts.load(f)));
    window.renderAt(0);
    return true;
  })();
})();
