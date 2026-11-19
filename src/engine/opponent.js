// Where and when the opponent can play our shot, and what they hit back.

import { COURT, MPH, trajectory } from './physics.js';
import { travelTime } from './ratings.js';
import { launchSet, percentageWeight, GRID } from './launches.js';
import { toCourt } from './solver.js';

/** How comfortable a contact height is (1 = ideal, waist to chest). */
export function heightComfort(z) {
  const pts = [[0.2, 0.15], [0.6, 0.35], [1.2, 0.6], [2.0, 0.88], [2.6, 1], [4.5, 1], [6.0, 0.85], [7.5, 0.6], [8.5, 0.3]];
  if (z <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (z <= pts[i][0]) {
      const f = (z - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      return pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1]);
    }
  }
  return 0.3;
}

export const MAX_CONTACT_Z = 7.8;
export const MIN_CONTACT_Z = 0.3;
const VOLLEY_LINE = COURT.kitchen - 1.5; // feet behind the line, reaching over it

/**
 * Candidate contact points for a player at `pos` (court coords) receiving the
 * ball travelling along `path` (court coords, times from our contact).
 * `side` is the receiver's half (+1 far, -1 near).
 */
export function contactOptions(path, pos, profile, side, { mustBounce = false } = {}) {
  const cands = [];
  const n = path.n;
  if (path.bounceIdx < 0) return { cands, out: false, noBounce: true };
  const lx = path.landX, ly = path.landY;
  const landsIn = Math.abs(lx) <= COURT.halfW && Math.sign(ly) === side && Math.abs(ly) <= COURT.halfL;
  for (let i = 1; i < n; i++) {
    const y = path.y[i] * side, z = path.z[i];
    if (y <= 0.2) continue;
    if (z < MIN_CONTACT_Z || z > MAX_CONTACT_Z) continue;
    const afterBounce = i > path.bounceIdx;
    if (!afterBounce) {
      if (mustBounce || y < VOLLEY_LINE) continue;
    } else if (!landsIn) continue;
    const dist = Math.hypot(path.x[i] - pos.x, path.y[i] - pos.y);
    const need = profile.reaction + travelTime(Math.max(0, dist - profile.reach), profile);
    const margin = path.t[i] - need;
    if (margin < -0.03) continue;
    const setness = 1 - Math.exp(-Math.max(0, margin + 0.03) / 0.18);
    const score = heightComfort(z) * (0.35 + 0.65 * setness);
    cands.push({ i, t: path.t[i], x: path.x[i], y: path.y[i], z, kind: afterBounce ? 'bounce' : 'volley', margin, score, dist });
  }
  // Players do not like giving up court position or waiting on the ball:
  // backing up costs, and so does every extra moment after the first chance.
  if (cands.length) {
    const t0 = cands[0].t;
    for (const c of cands) {
      const retreat = Math.max(0, Math.abs(c.y) - Math.abs(pos.y));
      c.score *= Math.exp(-retreat / 7) * Math.exp(-(c.t - t0) / 1.6);
    }
  }
  return { cands, out: !landsIn };
}

/**
 * Choose the opponent's likely contact points ("plays the percentages"):
 * their best option, plus the best of the other kind (volley vs. after the
 * bounce) if it is nearly as good.
 */
export function chooseContacts(cands) {
  if (!cands.length) return [];
  const best = cands.reduce((a, b) => (b.score > a.score ? b : a));
  const picks = [best];
  const other = cands.filter((c) => c.kind !== best.kind);
  if (other.length) {
    const alt = other.reduce((a, b) => (b.score > a.score ? b : a));
    if (alt.score >= 0.7 * best.score) picks.push(alt);
  }
  const ws = picks.map((p) => Math.exp(p.score / 0.12));
  const tot = ws.reduce((a, b) => a + b, 0);
  picks.forEach((p, k) => { p.w = ws[k] / tot; });
  return picks;
}

/** Execution error grows when the contact is low or rushed. */
export function errorScale(c) {
  const rushed = c.margin < 0.15 ? (0.15 - c.margin) / 0.15 : 0;
  return 1 + 0.7 * (1 - heightComfort(c.z)) + 0.6 * rushed;
}

// Deterministic pseudo-random numbers so the same scenario always gives the
// same picture.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Build the reply set: every likely reply from every chosen contact point,
 * represented by `nSamples` full trajectories, plus a landing-density grid.
 */
export function buildReplies(contacts, profile, nSamples = 180, { netPressure = false } = {}) {
  const entries = [];
  const density = { x0: -12, y0: -25, nx: 24, ny: 25, cell: 1, w: new Float32Array(24 * 25) };
  let totW = 0;
  for (const c of contacts) {
    // In doubles each contact carries the profile of the opponent who plays it.
    const set = launchSet({ x: c.x, y: c.y, z: c.z }, c.profile || profile, errorScale(c));
    let setW = 0;
    const local = [];
    for (let is = 0; is < set.NS; is++) for (let iv = 0; iv < set.NV; iv++) {
      if (!set.allowed(is, iv)) continue;
      for (let it = 0; it < set.NT; it++) for (let ip = 0; ip < set.nPhi; ip++) {
        const idx = set.index(is, iv, it, ip);
        const w = percentageWeight(set, idx, GRID.mph[iv], { netPressure });
        if (w <= 1e-4) continue;
        local.push({ is, iv, it, ip, idx, w });
        setW += w;
      }
    }
    for (const e of local) {
      const w = (e.w / setW) * c.w;
      const lx = set.landX[e.idx], ly = set.landY[e.idx];
      entries.push({ c, set, ...e, w, lx, ly, p: set.pSucc[e.idx], clear: set.clear[e.idx] });
      totW += w;
      const gx = Math.floor((lx - density.x0) / density.cell), gy = Math.floor((ly - density.y0) / density.cell);
      if (gx >= 0 && gx < density.nx && gy >= 0 && gy < density.ny) density.w[gy * density.nx + gx] += w;
    }
  }
  if (!entries.length) return { replies: [], density, totW: 0 };

  // Systematic resampling into representative trajectories.
  entries.sort((a, b) => a.idx - b.idx || a.c.t - b.c.t);
  const rand = rng(entries.length * 7919 + Math.round(contacts[0].t * 1000));
  const step = totW / nSamples;
  let u = rand() * step, acc = 0;
  const picked = new Map();
  for (const e of entries) {
    acc += e.w;
    while (u < acc) {
      const key = e;
      picked.set(key, (picked.get(key) || 0) + 1);
      u += step;
    }
  }
  const replies = [];
  for (const [e, count] of picked) {
    const v0 = GRID.mph[e.iv] * MPH;
    const theta = (GRID.thetaDeg[e.it] * Math.PI) / 180;
    const spin = GRID.spin[e.is];
    const phi = e.set.phis[e.ip];
    const hx = Math.sin(phi), hy = e.set.side * Math.cos(phi);
    const traj = trajectory(e.c.z, v0, theta, spin, { dtOut: 0.03, tMax: 3.5, dMax: 70 });
    const path = toCourt(traj, e.c, hx, hy, e.c.t);
    replies.push({
      path, w: count / nSamples, contact: e.c, mph: GRID.mph[e.iv], spin, clear: e.clear,
      pSucc: e.p, landX: e.lx, landY: e.ly,
    });
  }
  return { replies, density, totW };
}
