// Shot solver: given a contact point, a target and how high the ball should
// pass over the net, find the launch speed and angle that make it happen.

import { BALL_R, MPH, netHeight, flyToGround, trajectory } from './physics.js';

const DEG = Math.PI / 180;

function probe(z0, v0, theta, spin, dNet, dT, zT) {
  let zNet = NaN, zAtT = NaN;
  const r = flyToGround(z0, v0, theta, spin, Math.max(dT, dNet) + 25, 5, (pd, pz, d, z) => {
    if (pd < dNet && d >= dNet) zNet = pz + ((dNet - pd) / (d - pd || 1e-9)) * (z - pz);
    if (pd < dT && d >= dT) zAtT = pz + ((dT - pd) / (d - pd || 1e-9)) * (z - pz);
  });
  if (dNet <= 0) zNet = z0;
  return { zNet, zAtT, landD: r.landD };
}

// Signed miss for the target: > 0 means the ball goes past / above it.
function targetMiss(p, dT, zT) {
  if (zT <= BALL_R + 1e-3) return Number.isNaN(p.landD) ? 1e3 : p.landD - dT;
  return Number.isNaN(p.zAtT) ? -1e3 : p.zAtT - zT;
}

function speedForTarget(z0, theta, spin, dNet, dT, zT) {
  let lo = 2, hi = 140;
  const pHi = probe(z0, hi, theta, spin, dNet, dT, zT);
  if (targetMiss(pHi, dT, zT) < 0) return null;
  const pLo = probe(z0, lo, theta, spin, dNet, dT, zT);
  if (targetMiss(pLo, dT, zT) >= 0) return { v0: lo, p: pLo };
  let p = pHi;
  for (let i = 0; i < 16; i++) {
    const mid = 0.5 * (lo + hi);
    const pm = probe(z0, mid, theta, spin, dNet, dT, zT);
    if (targetMiss(pm, dT, zT) >= 0) { hi = mid; p = pm; } else lo = mid;
  }
  return { v0: hi, p };
}

/**
 * Solve a shot.
 * @param contact {x,y,z}  ball position at contact (ft)
 * @param target  {x,y,z?} landing point (z omitted = on the ground)
 * @param clearance        gap between ball and net tape at the crossing (ft)
 * @param spinRpm          + topspin / - backspin
 */
export function solveShot(contact, target, clearance, spinRpm) {
  const dx = target.x - contact.x, dy = target.y - contact.y;
  const D = Math.hypot(dx, dy);
  const hx = dx / D, hy = dy / D;
  const zT = target.z ?? BALL_R;
  const crosses = Math.sign(contact.y) !== Math.sign(target.y) && Math.abs(hy) > 1e-6;
  let dNet, xCross, zGoal;
  if (crosses) {
    dNet = -contact.y / hy;
    xCross = contact.x + dNet * hx;
    zGoal = netHeight(xCross) + BALL_R + clearance;
  } else {
    dNet = D / 2; xCross = contact.x + dNet * hx;
    zGoal = Math.max(contact.z, zT) + clearance;
  }

  let lo = -80 * DEG, hi = 80 * DEG, best = null;
  const g = (theta) => {
    const s = speedForTarget(contact.z, theta, spinRpm, dNet, D, zT);
    if (!s || Number.isNaN(s.p.zNet)) return { val: theta > 0 ? 1e3 : -1e3, s };
    return { val: s.p.zNet - zGoal, s };
  };
  const gLo = g(lo);
  if (gLo.val >= 0) best = { theta: lo, ...gLo };
  else {
    for (let i = 0; i < 18; i++) {
      const mid = 0.5 * (lo + hi);
      const gm = g(mid);
      if (gm.val >= 0) { hi = mid; if (gm.s) best = { theta: mid, ...gm }; } else lo = mid;
    }
  }
  if (!best || !best.s) return { ok: false, reason: 'unreachable' };

  const v0 = best.s.v0, theta = best.theta;
  const traj = trajectory(contact.z, v0, theta, spinRpm, { dtOut: 0.02, tMax: 4, dMax: 70 });
  const path = toCourt(traj, contact, hx, hy);
  return {
    ok: true, v0, mph: v0 / MPH, theta, spinRpm,
    hx, hy, D, dNet, xCross,
    zNet: best.s.p.zNet,
    clearance: best.s.p.zNet - netHeight(xCross) - BALL_R,
    traj, path,
  };
}

/** Rotate a plane trajectory into court coordinates. */
export function toCourt(traj, contact, hx, hy, tOffset = 0) {
  const n = traj.t.length;
  const out = { n, t: new Float32Array(n), x: new Float32Array(n), y: new Float32Array(n), z: traj.z, speed: traj.speed, bounceIdx: traj.bounceIdx };
  for (let i = 0; i < n; i++) {
    out.t[i] = traj.t[i] + tOffset;
    out.x[i] = contact.x + traj.d[i] * hx;
    out.y[i] = contact.y + traj.d[i] * hy;
  }
  if (traj.bounceIdx >= 0) {
    out.landX = out.x[traj.bounceIdx];
    out.landY = out.y[traj.bounceIdx];
    out.landT = out.t[traj.bounceIdx];
  }
  return out;
}

// Shot library. Spin is a fraction of the player's max topspin (positive) or
// max backspin (negative). Clearance is the gap over the net tape in feet.
// `target` places the default aim relative to the contact point.
export const SHOTS = [
  { id: 'drive', name: 'Drive', clearance: 1.0, spin: 0.8,
    blurb: 'Low and hard with topspin, aimed deep.',
    target: (c) => ({ x: c.x * 0.4, y: 17 }) },
  { id: 'drop', name: 'Drop', clearance: 1.2, spin: 0.15,
    blurb: 'Soft arc that lands in the kitchen.',
    target: (c) => ({ x: c.x * 0.5, y: 3.5 }) },
  { id: 'dink', name: 'Dink', clearance: 0.5, spin: -0.3,
    blurb: 'Kitchen to kitchen, low over the net.',
    target: (c) => ({ x: c.x > 0 ? -4 : 4, y: 4.5 }) },
  { id: 'lob', name: 'Lob', clearance: 9, spin: 0.6,
    blurb: 'High over the opponent, landing deep.',
    target: (c) => ({ x: c.x * 0.5, y: 19 }) },
  { id: 'reset', name: 'Reset', clearance: 0.7, spin: -0.4,
    blurb: 'Takes pace off a hard ball into the kitchen.',
    target: (c) => ({ x: c.x * 0.6, y: 5 }) },
  { id: 'speedup', name: 'Speed-up', clearance: 0.4, spin: 0.6,
    blurb: 'Fast, flat attack from the kitchen line.',
    target: (c) => ({ x: 2.5, y: 9.5 }) },
  { id: 'overhead', name: 'Overhead', clearance: 3, spin: 0.2,
    blurb: 'Put away a high ball, hit downward.',
    target: (c) => ({ x: c.x > 0 ? -5 : 5, y: 12 }) },
];

export function shotById(id) {
  return SHOTS.find((s) => s.id === id) || SHOTS[0];
}

/** Spin in rpm for a shot preset and a player profile. */
export function shotSpin(shot, profile) {
  return shot.spin >= 0 ? shot.spin * profile.maxTopspin : shot.spin * profile.maxBackspin;
}
