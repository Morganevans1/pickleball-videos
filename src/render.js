// Canvas drawing for the top-down court and the side view.
// The court is drawn sideways: the student plays from the left, the net runs
// down the middle, and the student's left (−x) is towards the top.

import { COURT, netHeight } from './engine/physics.js';

export function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  return {
    surround: g('--surround'), court: g('--court'), kitchen: g('--kitchen'), line: g('--court-line'),
    net: g('--net'), ball: g('--ball'), you: g('--you'), opp: g('--opp'), onCourt: g('--on-court'),
    sideBg: g('--side-bg'), sideGround: g('--side-ground'), sideInk: g('--side-ink'), ink: g('--ink'),
    accent: g('--accent'), warn: g('--warn'), display: g('--font-display'), body: g('--font-body'),
  };
}

export function courtView(w, h) {
  const scale = Math.min(w / 56, h / 28.5);
  const ox = w / 2, oy = h / 2;
  return {
    w, h, scale, ox, oy,
    sx: (y) => ox + y * scale,
    sy: (x) => oy + x * scale,
    toCourt: (px, py) => ({ x: (py - oy) / scale, y: (px - ox) / scale }),
  };
}

export function sideView(w, h, cv, zMax) {
  const base = h - 20;
  const zs = (base - 16) / zMax;
  return { w, h, base, zs, zMax, sx: cv.sx, sz: (z) => base - z * zs, toZ: (py) => (base - py) / zs, scale: cv.scale };
}

function rgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function label(ctx, th, text, x, y, { color = th.onCourt, size = 13, align = 'center', bg = null, weight = 700 } = {}) {
  ctx.font = `${weight} ${size}px ${th.display}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const t = text.toUpperCase();
  if (bg) {
    const w = ctx.measureText(t).width + 10;
    const x0 = align === 'center' ? x - w / 2 : align === 'left' ? x - 5 : x - w + 5;
    ctx.fillStyle = bg;
    roundRect(ctx, x0, y - size * 0.72, w, size * 1.44, 4);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.fillText(t, x, y + 0.5);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function pathLine(ctx, v, path, i0, i1) {
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const X = v.sx(path.y[i]), Y = v.sy(path.x[i]);
    if (i === i0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
}

function arrowHead(ctx, x0, y0, x1, y1, size) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - size * Math.cos(a - 0.45), y1 - size * Math.sin(a - 0.45));
  ctx.lineTo(x1 - size * Math.cos(a + 0.45), y1 - size * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

/** Index of the last sample at or before time t. */
export function idxAt(path, t) {
  let i = 0;
  while (i + 1 < path.n && path.t[i + 1] <= t) i++;
  return i;
}

export function posAt(path, t) {
  const i = idxAt(path, t);
  if (i + 1 >= path.n) return { x: path.x[path.n - 1], y: path.y[path.n - 1], z: path.z[path.n - 1] };
  const f = Math.max(0, Math.min(1, (t - path.t[i]) / (path.t[i + 1] - path.t[i] || 1e-9)));
  return {
    x: path.x[i] + f * (path.x[i + 1] - path.x[i]),
    y: path.y[i] + f * (path.y[i + 1] - path.y[i]),
    z: path.z[i] + f * (path.z[i + 1] - path.z[i]),
  };
}

function drawSurface(ctx, v, th) {
  ctx.fillStyle = th.surround;
  ctx.fillRect(0, 0, v.w, v.h);
  const L = COURT.halfL, W = COURT.halfW, K = COURT.kitchen;
  ctx.fillStyle = th.court;
  ctx.fillRect(v.sx(-L), v.sy(-W), v.sx(L) - v.sx(-L), v.sy(W) - v.sy(-W));
  ctx.fillStyle = th.kitchen;
  ctx.fillRect(v.sx(-K), v.sy(-W), v.sx(K) - v.sx(-K), v.sy(W) - v.sy(-W));
}

function drawLines(ctx, v, th) {
  const L = COURT.halfL, W = COURT.halfW, K = COURT.kitchen;
  ctx.strokeStyle = th.line;
  ctx.lineWidth = Math.max(1.5, v.scale * 0.17);
  ctx.strokeRect(v.sx(-L), v.sy(-W), v.sx(L) - v.sx(-L), v.sy(W) - v.sy(-W));
  ctx.beginPath();
  for (const y of [-K, K]) { ctx.moveTo(v.sx(y), v.sy(-W)); ctx.lineTo(v.sx(y), v.sy(W)); }
  ctx.moveTo(v.sx(-L), v.sy(0)); ctx.lineTo(v.sx(-K), v.sy(0));
  ctx.moveTo(v.sx(K), v.sy(0)); ctx.lineTo(v.sx(L), v.sy(0));
  ctx.stroke();
  // Net
  ctx.strokeStyle = th.net;
  ctx.lineWidth = Math.max(3, v.scale * 0.35);
  ctx.beginPath(); ctx.moveTo(v.sx(0), v.sy(-COURT.postX)); ctx.lineTo(v.sx(0), v.sy(COURT.postX)); ctx.stroke();
  ctx.strokeStyle = th.line;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(v.sx(0), v.sy(-COURT.postX)); ctx.lineTo(v.sx(0), v.sy(COURT.postX)); ctx.stroke();
  ctx.fillStyle = th.net;
  for (const x of [-COURT.postX, COURT.postX]) { ctx.beginPath(); ctx.arc(v.sx(0), v.sy(x), Math.max(3, v.scale * 0.3), 0, Math.PI * 2); ctx.fill(); }
}

function drawHeat(ctx, v, th, rec, L) {
  const G = rec.grid, s = rec.scores[L];
  let max = 0;
  for (let i = 0; i < s.length; i++) max = Math.max(max, s[i]);
  if (max <= 0) return;
  const cw = v.scale * G.step;
  for (let iy = 0; iy < G.ny; iy++) for (let ix = 0; ix < G.nx; ix++) {
    const rel = s[iy * G.nx + ix] / max;
    const a = Math.pow(Math.max(0, (rel - 0.55) / 0.45), 1.6) * 0.62;
    if (a < 0.02) continue;
    ctx.fillStyle = rgba(th.you, a);
    const x = G.x0 + ix * G.step, y = G.y0 + iy * G.step;
    ctx.fillRect(v.sx(y - G.step / 2), v.sy(x - G.step / 2), cw + 0.5, cw + 0.5);
  }
}

function drawDensity(ctx, v, th, density, fade = 1) {
  let max = 0;
  for (let i = 0; i < density.w.length; i++) max = Math.max(max, density.w[i]);
  if (max <= 0) return;
  const r = v.scale * 0.42;
  for (let gy = 0; gy < density.ny; gy++) for (let gx = 0; gx < density.nx; gx++) {
    const rel = density.w[gy * density.nx + gx] / max;
    if (rel < 0.12) continue;
    const x = density.x0 + (gx + 0.5) * density.cell, y = density.y0 + (gy + 0.5) * density.cell;
    ctx.fillStyle = rgba(th.opp, (0.15 + 0.6 * rel) * fade);
    ctx.beginPath();
    ctx.arc(v.sx(y), v.sy(x), r * (0.45 + 0.55 * Math.sqrt(rel)), 0, Math.PI * 2);
    ctx.fill();
  }
}

function playerDot(ctx, v, th, x, y, color, text, { ghost = false, r = 0.95 } = {}) {
  const X = v.sx(y), Y = v.sy(x), R = Math.max(9, v.scale * r);
  ctx.save();
  if (ghost) {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(8,20,28,.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  if (text) label(ctx, th, text, X, Y + R + 11, { size: 12, color: th.onCourt, bg: 'rgba(8,20,28,.55)' });
}

function crosshair(ctx, v, th, x, y) {
  const X = v.sx(y), Y = v.sy(x), R = Math.max(8, v.scale * 0.8);
  ctx.strokeStyle = th.ball; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2);
  ctx.moveTo(X - R - 5, Y); ctx.lineTo(X - R + 4, Y);
  ctx.moveTo(X + R - 4, Y); ctx.lineTo(X + R + 5, Y);
  ctx.moveTo(X, Y - R - 5); ctx.lineTo(X, Y - R + 4);
  ctx.moveTo(X, Y + R - 4); ctx.lineTo(X, Y + R + 5);
  ctx.stroke();
}

function ball(ctx, v, th, p) {
  const X = v.sx(p.y), Y = v.sy(p.x);
  const r = Math.max(4, v.scale * 0.32) * (1 + Math.min(p.z, 10) * 0.05);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(X + p.z * v.scale * 0.12, Y + p.z * v.scale * 0.12, r * 0.9, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = th.ball; ctx.strokeStyle = 'rgba(30,40,0,.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

/**
 * Draw the court scene. `s` is assembled by main.js:
 * { state, step, layers, incoming, shot, analysis, plan, showAnswer, level,
 *   guess, featured: {likely, danger}, anim, reachRadius }
 */
export function drawCourt(ctx, v, th, s) {
  const { state, step, layers, shot, analysis: an } = s;
  drawSurface(ctx, v, th);
  const rally = an && an.outcome === 'rally';
  if (step >= 4 && s.showAnswer && rally && layers.heat) drawHeat(ctx, v, th, an.rec, s.level);
  if (step >= 3 && rally && layers.zones) drawDensity(ctx, v, th, an.density, step >= 4 && s.showAnswer && layers.heat ? 0.45 : 1);
  drawLines(ctx, v, th);

  // Side labels
  label(ctx, th, 'Your side', v.sx(-COURT.halfL) + 8, v.sy(-COURT.halfW) - 12, { align: 'left', size: 12, color: rgba(th.onCourt, 0.7) });
  label(ctx, th, 'Opponent', v.sx(COURT.halfL) - 8, v.sy(-COURT.halfW) - 12, { align: 'right', size: 12, color: rgba(th.onCourt, 0.7) });

  // Reachable area in the time available
  if (step >= 4 && s.showAnswer && rally && s.reachRadius > 0) {
    ctx.save();
    ctx.strokeStyle = rgba(th.you, 0.85); ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(v.sx(state.student.y), v.sy(state.student.x), s.reachRadius * v.scale, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // Incoming ball
  if (s.incoming && !s.hideIncoming) {
    const p = s.incoming.path;
    ctx.save();
    ctx.strokeStyle = rgba(th.onCourt, step === 1 ? 0.9 : 0.4); ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    pathLine(ctx, v, p, 0, p.n - 1); ctx.stroke();
    ctx.restore();
    if (p.bounceIdx >= 0 && p.bounceIdx < p.n) {
      ctx.strokeStyle = rgba(th.onCourt, 0.6); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(v.sx(p.y[p.bounceIdx]), v.sy(p.x[p.bounceIdx]), 5, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Our shot
  if (step >= 2 && shot && shot.ok) {
    const p = shot.path;
    const endT = rally ? an.main.t : p.t[p.n - 1];
    const iEnd = idxAt(p, endT);
    const b = p.bounceIdx >= 0 ? Math.min(p.bounceIdx, iEnd) : iEnd;
    ctx.strokeStyle = 'rgba(10,16,4,.55)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    pathLine(ctx, v, p, 0, b); ctx.stroke();
    ctx.strokeStyle = th.ball; ctx.lineWidth = 3.5;
    pathLine(ctx, v, p, 0, b); ctx.stroke();
    if (iEnd > b) {
      ctx.save(); ctx.setLineDash([5, 5]); ctx.lineWidth = 2.5;
      pathLine(ctx, v, p, b, iEnd); ctx.stroke(); ctx.restore();
    }
    if (p.bounceIdx >= 0) {
      ctx.strokeStyle = th.ball; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(v.sx(p.landY), v.sy(p.landX), 6, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Their options
  if (step >= 3 && rally) {
    if (layers.fan) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = rgba(th.opp, 0.2);
      for (const r of an.replies) {
        const end = r.path.bounceIdx >= 0 ? r.path.bounceIdx : r.path.n - 1;
        pathLine(ctx, v, r.path, 0, end); ctx.stroke();
      }
    }
    const feat = [[s.featured.likely, 'Most likely', []], [s.featured.danger, 'Most dangerous', [7, 5]]];
    for (const [idx, text, dash] of feat) {
      if (idx == null || idx < 0) continue;
      const r = an.replies[idx];
      const bi = r.path.bounceIdx >= 0 ? r.path.bounceIdx : r.path.n - 1;
      ctx.save();
      ctx.strokeStyle = 'rgba(30,10,0,.5)'; ctx.lineWidth = 5; ctx.setLineDash(dash);
      pathLine(ctx, v, r.path, 0, bi); ctx.stroke();
      ctx.strokeStyle = th.opp; ctx.lineWidth = 2.8;
      pathLine(ctx, v, r.path, 0, bi); ctx.stroke();
      if (bi < r.path.n - 1) {
        ctx.setLineDash([2, 5]); ctx.lineWidth = 1.8;
        pathLine(ctx, v, r.path, bi, r.path.n - 1); ctx.stroke();
      }
      ctx.restore();
      if (r.path.bounceIdx >= 0) {
        const X = v.sx(r.path.landY), Y = v.sy(r.path.landX);
        ctx.fillStyle = th.opp; ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.fill();
        if (v.scale >= 9) label(ctx, th, `${text} · ${Math.round(r.mph)} mph`, X, Y + (r.path.landX > s.state.student.x ? 16 : -16), { size: 12, bg: 'rgba(8,20,28,.7)', color: th.onCourt });
      }
    }
    for (const c of an.contacts) {
      const X = v.sx(c.y), Y = v.sy(c.x);
      ctx.strokeStyle = th.opp; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X, Y, 7 + 6 * c.w, 0, Math.PI * 2); ctx.stroke();
      if (c === an.main) {
        // Opponent's run to the ball
        const dx = state.opponent.x - c.x, dy = state.opponent.y - c.y, d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, s.oppReach / d);
        const bx = c.x + dx * k, by = c.y + dy * k;
        if (d > s.oppReach + 0.5) {
          ctx.save(); ctx.strokeStyle = rgba(th.opp, 0.8); ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(v.sx(state.opponent.y), v.sy(state.opponent.x)); ctx.lineTo(v.sx(by), v.sy(bx)); ctx.stroke(); ctx.restore();
          playerDot(ctx, v, th, bx, by, th.opp, null, { ghost: true, r: 0.8 });
        }
        const txt = `${c.kind === 'volley' ? 'Volley' : 'After bounce'} · ${c.t.toFixed(2)} s`;
        label(ctx, th, txt, X, Y + (c.x < 0 ? -22 : 22), { size: 12, bg: 'rgba(8,20,28,.7)' });
      }
    }
  }

  // Your move
  if (step >= 4 && s.showAnswer && rally && s.plan) {
    const pl = s.plan;
    const st = state.student;
    const X0 = v.sx(st.y), Y0 = v.sy(st.x), X1 = v.sx(pl.target.y), Y1 = v.sy(pl.target.x);
    if (pl.dist > 0.6) {
      ctx.strokeStyle = 'rgba(8,20,28,.6)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke();
      ctx.strokeStyle = th.onCourt; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke();
      ctx.fillStyle = th.onCourt; arrowHead(ctx, X0, Y0, X1, Y1, 14);
      // Footsteps along the path
      const n = pl.pace.steps;
      ctx.fillStyle = th.onCourt;
      for (let k = 1; k < n; k++) {
        const f = k / n;
        ctx.beginPath(); ctx.arc(X0 + (X1 - X0) * f, Y0 + (Y1 - Y0) * f, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (!pl.reachableIdeal) {
      playerDot(ctx, v, th, pl.ideal.x, pl.ideal.y, th.warn, null, { ghost: true });
      const up = pl.ideal.x <= pl.target.x ? -1 : 1;
      label(ctx, th, 'Ideal: out of reach', v.sx(pl.ideal.y), v.sy(pl.ideal.x) + up * (v.scale + 16), { size: 12, bg: 'rgba(8,20,28,.75)' });
      playerDot(ctx, v, th, pl.target.x, pl.target.y, th.you, null, { ghost: true });
      label(ctx, th, 'Best you can reach', X1, Y1 + (pl.ideal.x <= pl.target.x ? 1 : -1) * (v.scale + 16), { size: 12, bg: 'rgba(8,20,28,.75)' });
    } else {
      playerDot(ctx, v, th, pl.target.x, pl.target.y, th.you, null, { ghost: true });
      label(ctx, th, 'Recover here', X1, Y1 + (pl.target.x < st.x ? -1 : 1) * (v.scale + 16), { size: 12, bg: 'rgba(8,20,28,.75)' });
    }
  }

  // Predict guess
  if (s.guess) {
    const X = v.sx(s.guess.y), Y = v.sy(s.guess.x), R = 9;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(X - R, Y - R); ctx.lineTo(X + R, Y + R); ctx.moveTo(X + R, Y - R); ctx.lineTo(X - R, Y + R); ctx.stroke();
    label(ctx, th, 'Your guess', X, Y - 20, { size: 12, bg: 'rgba(8,20,28,.75)' });
  }

  // Players and handles
  const anim = s.anim;
  const youPos = anim ? anim.you : state.student;
  const oppPos = anim ? anim.opp : state.opponent;
  playerDot(ctx, v, th, oppPos.x, oppPos.y, th.opp, 'Opp');
  playerDot(ctx, v, th, youPos.x, youPos.y, th.you, 'You');
  if (anim && anim.ring != null) {
    ctx.strokeStyle = th.ball; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(v.sx(youPos.y), v.sy(youPos.x), Math.max(9, v.scale * 0.95) + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * anim.ring);
    ctx.stroke();
  }
  if (step >= 2 && !anim) crosshair(ctx, v, th, state.target.x, state.target.y);
  if (anim && anim.ball) ball(ctx, v, th, anim.ball);
}

export function drawSide(ctx, sv, th, s) {
  const { state, step, shot, analysis: an } = s;
  ctx.fillStyle = th.sideBg; ctx.fillRect(0, 0, sv.w, sv.h);
  // Height guides
  ctx.font = `600 11px ${th.body}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let z = 3; z < sv.zMax; z += 3) {
    ctx.strokeStyle = rgba(th.sideInk, 0.18); ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(0, sv.sz(z)); ctx.lineTo(sv.w, sv.sz(z)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.sideInk; ctx.fillText(`${z} ft`, 6, sv.sz(z) - 7);
  }
  // Ground and court marks
  ctx.strokeStyle = th.sideGround; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(sv.sx(-COURT.halfL), sv.base); ctx.lineTo(sv.sx(COURT.halfL), sv.base); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, sv.base); ctx.lineTo(sv.w, sv.base); ctx.stroke();
  ctx.fillStyle = th.sideInk; ctx.textAlign = 'center'; ctx.font = `700 10px ${th.display}`;
  for (const [y, t] of [[-COURT.halfL, 'BASELINE'], [-COURT.kitchen, 'KITCHEN'], [COURT.kitchen, 'KITCHEN'], [COURT.halfL, 'BASELINE']]) {
    ctx.fillRect(sv.sx(y) - 1, sv.base - 4, 2, 8);
    ctx.fillText(t, sv.sx(y), sv.base + 12);
  }
  // Net
  const xc = shot && shot.ok ? shot.xCross : 0;
  const nh = netHeight(xc);
  ctx.fillStyle = th.ink; ctx.fillRect(sv.sx(0) - 2, sv.sz(nh), 4, sv.base - sv.sz(nh));
  ctx.fillStyle = rgba(th.sideInk, 0.25); ctx.fillRect(sv.sx(0) - 1, sv.sz(nh), 2, sv.base - sv.sz(nh));

  const line2 = (path, n, color, width, dash = []) => {
    ctx.save(); ctx.setLineDash(dash);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const X = sv.sx(path.y[i]), Y = sv.sz(path.z[i]); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
    ctx.stroke(); ctx.restore();
  };

  if (s.incoming && !s.hideIncoming) line2(s.incoming.path, s.incoming.path.n, rgba(th.sideInk, 0.7), 2, [5, 5]);

  const rally = an && an.outcome === 'rally';
  if (step >= 3 && rally && s.featured.likely >= 0) {
    const r = an.replies[s.featured.likely];
    line2(r.path, r.path.n, th.opp, 2.5);
  }
  if (step >= 2 && shot && shot.ok) {
    const p = shot.path;
    const n = rally ? idxAt(p, an.main.t) + 1 : p.n;
    line2(p, n, 'rgba(40,52,0,.75)', 5);
    line2(p, n, th.ball, 3);
    // Clearance handle at the net
    const X = sv.sx(0), Y = sv.sz(shot.zNet);
    ctx.fillStyle = th.ball; ctx.strokeStyle = 'rgba(40,52,0,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X, Y - 10); ctx.lineTo(X + 10, Y); ctx.lineTo(X, Y + 10); ctx.lineTo(X - 10, Y); ctx.closePath(); ctx.fill(); ctx.stroke();
    label(ctx, th, `Clears by ${shot.clearance.toFixed(1)} ft`, X + 16, Y, { align: 'left', size: 12, color: th.ink, weight: 700 });
    // Speed tag next to the contact
    label(ctx, th, `${Math.round(shot.mph)} mph`, sv.sx(state.student.y) + 16, sv.sz(state.student.z) - 16, { align: 'left', size: 13, color: th.ink });
  }
  // Contact handle
  const cx = sv.sx(state.student.y), cz = sv.sz(state.student.z);
  ctx.fillStyle = th.you; ctx.strokeStyle = th.accent; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cz, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  label(ctx, th, `Contact ${state.student.z.toFixed(1)} ft`, cx - 14, cz, { align: 'right', size: 12, color: th.ink });
  // Animated ball
  if (s.anim && s.anim.ball) {
    const b = s.anim.ball;
    ctx.fillStyle = th.ball; ctx.strokeStyle = 'rgba(40,52,0,.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sv.sx(b.y), sv.sz(b.z), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

