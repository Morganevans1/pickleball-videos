// Recovery position: for every spot on the student's side, how well could a
// player standing there (when the opponent makes contact) handle the reply?
//
// The ambition level λ runs from 0 ("get it back") to 1 ("attack").
//   value(spot, reply) = max over intercept points p of
//                        S((margin_p − λ·T_SET) / s) · Q(p)^λ
// margin_p is the spare time when the student's paddle reaches p, Q(p) is the
// quality of the next shot from p (quality.js) and S is a soft step. At λ = 0
// we only ask "can you get a paddle on it". At λ = 1 you must be there
// T_SET early (feet set, on balance) and take it where you have good options.

import { COURT } from './physics.js';
import { travelTime, paceFor } from './ratings.js';
import { MIN_CONTACT_Z, MAX_CONTACT_Z } from './opponent.js';

export const LEVELS = 11;
export const T_SET = 0.45;
export const MOVE_COST = 0.003;    // share of the peak score per foot moved
export const NEAR_ENOUGH = 0.96;   // a reachable spot this good counts as "made it"
const SOFT = 0.05;
const VOLLEY_LINE = COURT.kitchen - 1.5; // feet behind the line, reaching over it

export const RECOVERY_GRID = { x0: -12, y0: -26, nx: 25, ny: 26, step: 1 };

export const lambdaOf = (L) => L / (LEVELS - 1);
const soft = (x) => 0.5 + (0.5 * x) / (1 + Math.abs(x));

export function interceptPoints(reply, quality, stride = 1) {
  const { path } = reply;
  const tc = reply.contact.t;
  const pts = [];
  for (let k = 1; k < path.n; k += stride) {
    const y = path.y[k], z = path.z[k];
    if (y >= -0.2) continue;
    if (z < MIN_CONTACT_Z || z > MAX_CONTACT_Z) continue;
    if (k < path.bounceIdx && -y < VOLLEY_LINE) continue; // no volleys in the kitchen
    const q = Math.max(0.02, quality.lookup(z, -y));
    const qPow = new Float32Array(LEVELS);
    for (let L = 0; L < LEVELS; L++) qPow[L] = Math.pow(q, lambdaOf(L));
    pts.push({ x: path.x[k], y, z, dt: path.t[k] - tc, qPow, volley: k < path.bounceIdx });
  }
  return pts;
}

/** Value of each ambition level for one spot against one reply. */
export function spotValues(qx, qy, pts, profile, out) {
  out.fill(0);
  for (const p of pts) {
    const dist = Math.hypot(p.x - qx, p.y - qy) - profile.reach;
    const need = profile.reaction + travelTime(Math.max(0, dist), profile);
    const m = p.dt - need;
    if (m < -0.25) continue;
    for (let L = 0; L < LEVELS; L++) {
      const v = soft((m - lambdaOf(L) * T_SET) / SOFT) * p.qPow[L];
      if (v > out[L]) out[L] = v;
    }
  }
}

/**
 * @param replies   reply set from opponent.js
 * @param profile   student profile
 * @param start     where the student is when they hit {x, y}
 * @param timeAvail seconds from the student's contact to the opponent's contact
 * @param quality   options table (quality.js)
 */
export function analyseRecovery({ replies, profile, start, timeAvail, quality }) {
  const G = RECOVERY_GRID;
  const nQ = G.nx * G.ny;
  const scores = Array.from({ length: LEVELS }, () => new Float32Array(nQ));
  const reachable = new Uint8Array(nQ);
  const tMove = Math.max(0, timeAvail - profile.followThrough);
  const replyPts = replies.map((r) => interceptPoints(r, quality));
  const totW = replies.reduce((a, r) => a + r.w, 0) || 1;
  const vals = new Float32Array(LEVELS);

  for (let iy = 0; iy < G.ny; iy++) {
    for (let ix = 0; ix < G.nx; ix++) {
      const q = iy * G.nx + ix;
      const qx = G.x0 + ix * G.step, qy = G.y0 + iy * G.step;
      reachable[q] = travelTime(Math.hypot(qx - start.x, qy - start.y), profile) <= tMove ? 1 : 0;
      for (let r = 0; r < replies.length; r++) {
        spotValues(qx, qy, replyPts[r], profile, vals);
        const w = replies[r].w / totW;
        for (let L = 0; L < LEVELS; L++) scores[L][q] += w * vals[L];
      }
    }
  }

  // Light 3×3 smoothing: positions are only meaningful to about a foot, and
  // it stops the chosen spot hopping between near-equal cells.
  for (let L = 0; L < LEVELS; L++) scores[L] = smooth3(scores[L], G.nx, G.ny);

  const spot = (q) => ({ x: G.x0 + (q % G.nx) * G.step, y: G.y0 + Math.floor(q / G.nx) * G.step, q });
  const canReach = (x, y) => travelTime(Math.hypot(x - start.x, y - start.y), profile) <= tMove;
  const best = [], bestReach = [];
  for (let L = 0; L < LEVELS; L++) {
    const s = scores[L];
    let b = 0, br = -1;
    for (let q = 0; q < nQ; q++) {
      if (s[q] > s[b]) b = q;
      if (reachable[q] && (br < 0 || s[q] > s[br])) br = q;
    }
    // The map is often flat near the top, so running further than needed
    // buys almost nothing. Each foot of movement costs MOVE_COST of the peak
    // score; we pick the best spot after that cost, overall and among the
    // spots the student can reach in time.
    let iq = b, bestU = -Infinity, rq = -1, bestRU = -Infinity;
    for (let q = 0; q < nQ; q++) {
      const p = spot(q);
      const u = s[q] / (s[b] || 1) - MOVE_COST * Math.hypot(p.x - start.x, p.y - start.y);
      if (u > bestU) { bestU = u; iq = q; }
      if (reachable[q] && u > bestRU) { bestRU = u; rq = q; }
    }
    const free = { ...spot(iq), score: s[iq], peak: s[b] };
    const reach = rq >= 0 ? { ...spot(rq), score: s[rq], peak: s[b] } : null;
    // If a reachable spot is nearly as good as the free choice, that is the
    // answer; otherwise the ideal is out of reach and `reach` is the fallback.
    const made = reach && reach.score >= NEAR_ENOUGH * free.score;
    best.push(made ? { ...reach, made: true } : { ...free, made: false });
    bestReach.push(reach);
  }

  // Ceiling: the highest ambition level (counting up from "get it back") at
  // which the student can get to a spot nearly as good as the ideal.
  let ceiling = -1;
  for (let L = 0; L < LEVELS; L++) {
    if (!best[L].made) break;
    ceiling = L;
  }

  return { grid: G, scores, reachable, best, bestReach, ceiling, timeAvail, tMove, replyPts, start, profile };
}

function smooth3(src, nx, ny) {
  const out = new Float32Array(src.length);
  const k = [1, 2, 1];
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    let acc = 0, wsum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = ix + dx, y = iy + dy;
      if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
      const w = k[dx + 1] * k[dy + 1];
      acc += w * src[y * nx + x]; wsum += w;
    }
    out[iy * nx + ix] = acc / wsum;
  }
  return out;
}

/** Bilinear lookup of a score map at an arbitrary spot. */
export function scoreAt(rec, L, x, y) {
  return scoreAtRaw(rec.grid, rec.scores[L], x, y);
}

function scoreAtRaw(G, s, x, y) {
  const fx = Math.max(0, Math.min(G.nx - 1.001, (x - G.x0) / G.step));
  const fy = Math.max(0, Math.min(G.ny - 1.001, (y - G.y0) / G.step));
  const ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
  const v = (i, j) => s[j * G.nx + i];
  return (v(ix, iy) * (1 - ax) + v(ix + 1, iy) * ax) * (1 - ay) + (v(ix, iy + 1) * (1 - ax) + v(ix + 1, iy + 1) * ax) * ay;
}

/** Retrieval value of each reply for a student standing at (x, y). */
export function replyValues(rec, x, y, L = 0) {
  const vals = new Float32Array(LEVELS);
  return rec.replyPts.map((pts) => { spotValues(x, y, pts, rec.profile, vals); return vals[L]; });
}

/**
 * Movement plan for an ambition level: the target spot (ideal if reachable,
 * otherwise the best reachable one) and how hard the move is.
 */
export function movePlan(rec, L) {
  const ideal = rec.best[L];
  const idealDist = Math.hypot(ideal.x - rec.start.x, ideal.y - rec.start.y);
  const idealPace = paceFor(idealDist, rec.tMove, rec.profile);
  const reachableIdeal = ideal.made && idealPace.intensity <= 1 + 1e-9;
  const target = reachableIdeal ? ideal : rec.bestReach[L] || ideal;
  const dist = Math.hypot(target.x - rec.start.x, target.y - rec.start.y);
  return {
    start: rec.start, tMove: rec.tMove,
    ideal, target, reachableIdeal, idealDist, idealPace,
    dist, pace: paceFor(dist, rec.tMove, rec.profile),
    getBack: scoreAt(rec, 0, target.x, target.y),
    levelScore: scoreAt(rec, L, target.x, target.y),
    idealScore: ideal.score,
    stayGetBack: scoreAt(rec, 0, rec.start.x, rec.start.y),
    stayLevel: scoreAt(rec, L, rec.start.x, rec.start.y) / (ideal.peak || 1),
    targetLevel: scoreAt(rec, L, target.x, target.y) / (ideal.peak || 1),
  };
}
