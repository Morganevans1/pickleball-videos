// Doubles recovery: where should both players on the student's team be when
// the opponent makes contact?
//
// A reply is covered if *either* player can handle it, so the team value of a
// pair of spots (a, b) for ambition level L is
//     S(a, b) = Σ_r w_r · max(V_you(a, r), V_partner(b, r))
// where V is the same per-player value as in singles (recovery.js). The best
// pair is found by coordinate ascent: place one player, find the partner's
// best spot for that, re-place the first, and repeat until neither moves.
// Each foot either player runs costs MOVE_COST, as in singles.

import { travelTime, paceFor } from './ratings.js';
import { LEVELS, MOVE_COST, NEAR_ENOUGH, RECOVERY_GRID, interceptPoints, spotValues } from './recovery.js';

const G = RECOVERY_GRID;
const NQ = G.nx * G.ny;
const qX = (q) => G.x0 + (q % G.nx) * G.step;
const qY = (q) => G.y0 + Math.floor(q / G.nx) * G.step;

export function cellOf(x, y) {
  const ix = Math.max(0, Math.min(G.nx - 1, Math.round((x - G.x0) / G.step)));
  const iy = Math.max(0, Math.min(G.ny - 1, Math.round((y - G.y0) / G.step)));
  return iy * G.nx + ix;
}

// 3×3 smoothing over the court grid of one level block laid out [q][r],
// written into `out` at the same offset.
function smoothLevel(src, out, off, nR) {
  for (let iy = 0; iy < G.ny; iy++) for (let ix = 0; ix < G.nx; ix++) {
    const o = off + (iy * G.nx + ix) * nR;
    for (let r = 0; r < nR; r++) out[o + r] = 0;
    let ws = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = ix + dx, y = iy + dy;
      if (x < 0 || y < 0 || x >= G.nx || y >= G.ny) continue;
      const w = (dx ? 1 : 2) * (dy ? 1 : 2);
      ws += w;
      const i = off + (y * G.nx + x) * nR;
      for (let r = 0; r < nR; r++) out[o + r] += w * src[i + r];
    }
    for (let r = 0; r < nR; r++) out[o + r] /= ws;
  }
}

/**
 * @param replies  reply set (opponent.js)
 * @param players  [{ profile, start: {x, y}, tMove, quality }] — student first, partner second
 */
export function analyseTeam({ replies, players }) {
  const nR = replies.length;
  const totW = replies.reduce((a, r) => a + r.w, 0) || 1;
  const w = Float32Array.from(replies, (r) => r.w / totW);
  const vals = new Float32Array(LEVELS);

  // Per-player value of every spot against every reply, at every level.
  // Layout: V[(L * NQ + q) * nR + r], so one spot's replies sit together.
  // Every other sample (0.06 s apart) is plenty for two players and halves the work.
  const replyPts = players.map((pl) => replies.map((r) => interceptPoints(r, pl.quality, 2)));
  const V = players.map((pl, p) => {
    const raw = new Float32Array(LEVELS * NQ * nR);
    for (let q = 0; q < NQ; q++) {
      const x = qX(q), y = qY(q);
      for (let r = 0; r < nR; r++) {
        spotValues(x, y, replyPts[p][r], pl.profile, vals);
        for (let L = 0; L < LEVELS; L++) raw[(L * NQ + q) * nR + r] = vals[L];
      }
    }
    const arr = new Float32Array(raw.length);
    for (let L = 0; L < LEVELS; L++) smoothLevel(raw, arr, L * NQ * nR, nR);
    return arr;
  });

  const dist = players.map((pl) => Float32Array.from({ length: NQ }, (_, q) => Math.hypot(qX(q) - pl.start.x, qY(q) - pl.start.y)));
  const reach = players.map((pl, p) => {
    const m = Uint8Array.from({ length: NQ }, (_, q) => (travelTime(dist[p][q], pl.profile) <= pl.tMove ? 1 : 0));
    m[cellOf(pl.start.x, pl.start.y)] = 1; // standing still is always possible
    return m;
  });

  const S = new Float32Array(NQ);
  const at = (L, q) => (L * NQ + q) * nR;
  const teamScore = (L, qa, qb) => {
    let s = 0;
    const ia = at(L, qa), ib = at(L, qb);
    for (let r = 0; r < nR; r++) {
      const a = V[0][ia + r], b = V[1][ib + r];
      s += w[r] * (a > b ? a : b);
    }
    return s;
  };
  // Score of every spot for `mover`, with the other player fixed at otherQ
  // (otherQ < 0: the mover is on their own). Leaves the result in S.
  const vo = new Float32Array(nR);
  const fill = (L, mover, otherQ) => {
    const Vm = V[mover], Vo = V[1 - mover];
    if (otherQ >= 0) vo.set(Vo.subarray(at(L, otherQ), at(L, otherQ) + nR)); else vo.fill(0);
    for (let q = 0; q < NQ; q++) {
      const i = at(L, q);
      let acc = 0;
      for (let r = 0; r < nR; r++) {
        const v = Vm[i + r], o = vo[r];
        acc += w[r] * (v > o ? v : o);
      }
      S[q] = acc;
    }
  };
  const pick = (mover, mask, ref, cost) => {
    let bq = -1, bu = -Infinity;
    for (let q = 0; q < NQ; q++) {
      if (mask && !mask[q]) continue;
      const u = S[q] / ref - cost * dist[mover][q];
      if (u > bu) { bu = u; bq = q; }
    }
    return bq;
  };
  // Coordinate ascent from where the players stand now, so they keep their
  // sides of the court rather than swapping.
  const startQ = players.map((pl) => cellOf(pl.start.x, pl.start.y));
  const ascend = (L, masks, ref, cost) => {
    let qa = startQ[0], qb = startQ[1];
    for (let it = 0; it < 6; it++) {
      fill(L, 0, qb); const na = pick(0, masks[0], ref, cost);
      fill(L, 1, na); const nb = pick(1, masks[1], ref, cost);
      const same = na === qa && nb === qb;
      qa = na; qb = nb;
      if (same) break;
    }
    return { q: [qa, qb], s: teamScore(L, qa, qb) };
  };

  const best = [], bestReach = [];
  for (let L = 0; L < LEVELS; L++) {
    const peak = ascend(L, [null, null], 1, 0).s || 1e-6;
    const free = ascend(L, [null, null], peak, MOVE_COST);
    const rch = ascend(L, reach, peak, MOVE_COST);
    const made = rch.s >= NEAR_ENOUGH * free.s;
    best.push({ ...(made ? rch : free), made, peak });
    bestReach.push({ ...rch, peak });
  }
  let ceiling = -1;
  for (let L = 0; L < LEVELS; L++) { if (!best[L].made) break; ceiling = L; }

  return { team: true, grid: G, V, w, nR, players, best, bestReach, ceiling, reach, teamScore, fill, S, at };
}

/** Score map for one player with the other fixed at (ox, oy), as a fresh array. */
export function teamHeat(rec, L, who, ox, oy) {
  rec.fill(L, who, cellOf(ox, oy));
  return Float32Array.from(rec.S);
}

/** Team score at level L with the two players at the given spots. */
export function teamScoreAt(rec, L, a, b) {
  return rec.teamScore(L, cellOf(a.x, a.y), cellOf(b.x, b.y));
}

/**
 * Movement plans for both players at level L, shaped like singles movePlan()
 * so the interface can treat them the same way.
 */
export function teamPlan(rec, L) {
  const b = rec.best[L], br = rec.bestReach[L];
  const targetsQ = b.made ? b.q : br.q;
  const tA = { x: qX(targetsQ[0]), y: qY(targetsQ[0]) }, tB = { x: qX(targetsQ[1]), y: qY(targetsQ[1]) };
  const teamNow = rec.teamScore(L, targetsQ[0], targetsQ[1]);
  const getBack = rec.teamScore(0, targetsQ[0], targetsQ[1]);
  const plans = rec.players.map((pl, p) => {
    const ideal = { x: qX(b.q[p]), y: qY(b.q[p]), made: b.made, score: b.s, peak: b.peak };
    const idealDist = Math.hypot(ideal.x - pl.start.x, ideal.y - pl.start.y);
    const idealPace = paceFor(idealDist, pl.tMove, pl.profile);
    const target = p === 0 ? tA : tB;
    const d = Math.hypot(target.x - pl.start.x, target.y - pl.start.y);
    // What the team loses if this player stays put and the other still moves.
    const stayQ = cellOf(pl.start.x, pl.start.y);
    const stay = p === 0 ? rec.teamScore(L, stayQ, targetsQ[1]) : rec.teamScore(L, targetsQ[0], stayQ);
    return {
      start: pl.start, tMove: pl.tMove, profile: pl.profile,
      ideal, target, reachableIdeal: b.made && idealPace.intensity <= 1 + 1e-9,
      idealDist, idealPace, dist: d, pace: paceFor(d, pl.tMove, pl.profile),
      getBack, levelScore: teamNow, idealScore: b.s,
      stayLevel: stay / (b.peak || 1), targetLevel: teamNow / (b.peak || 1),
    };
  });
  return { plans, getBack, made: b.made };
}

/**
 * Who covers each reply when the team stands at spots a and b:
 * 0 = student, 1 = partner, 2 = both could (call it), -1 = nobody.
 */
export function replyOwners(rec, a, b, L = LEVELS - 1) {
  // Judged at a demanding level (be set early, take it well), where the
  // better-placed player stands out; "get it back" alone ties too often.
  const qa = cellOf(a.x, a.y), qb = cellOf(b.x, b.y);
  const out = new Int8Array(rec.nR);
  for (let r = 0; r < rec.nR; r++) {
    const va = rec.V[0][rec.at(L, qa) + r], vb = rec.V[1][rec.at(L, qb) + r];
    const g0 = rec.V[0][rec.at(0, qa) + r], g1 = rec.V[1][rec.at(0, qb) + r];
    if (Math.max(g0, g1) < 0.35) out[r] = -1;
    else if (Math.abs(va - vb) < 0.04 * Math.max(va, vb, 0.05)) out[r] = 2;
    else out[r] = va >= vb ? 0 : 1;
  }
  return out;
}

/**
 * Responsibility zones on the student's side: each 1-ft cell where replies
 * land is tagged by who covers the replies landing nearby.
 * Returns { x0, y0, nx, ny, owner: Int8Array, strength: Float32Array }.
 */
export function coverageZones(replies, owners) {
  const Z = { x0: -11, y0: -24, nx: 22, ny: 24 };
  const n = Z.nx * Z.ny;
  const votes = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  replies.forEach((r, i) => {
    const o = owners[i];
    const k = o === -1 ? 3 : o;
    for (let iy = 0; iy < Z.ny; iy++) {
      const cy = Z.y0 + iy + 0.5;
      if (Math.abs(cy - r.landY) > 3) continue;
      for (let ix = 0; ix < Z.nx; ix++) {
        const cx = Z.x0 + ix + 0.5;
        const d2 = (cx - r.landX) ** 2 + (cy - r.landY) ** 2;
        if (d2 > 9) continue;
        votes[k][iy * Z.nx + ix] += r.w * Math.exp(-d2 / 2.5);
      }
    }
  });
  const owner = new Int8Array(n).fill(-2), strength = new Float32Array(n);
  let max = 0;
  for (let c = 0; c < n; c++) {
    const v = [votes[0][c], votes[1][c], votes[2][c], votes[3][c]];
    const tot = v[0] + v[1] + v[2] + v[3];
    if (tot <= 0) continue;
    let k = 0;
    for (let j = 1; j < 4; j++) if (v[j] > v[k]) k = j;
    // Mixed cells, where the two players are close to a tie, count as "call it".
    if ((k === 0 || k === 1) && Math.min(v[0], v[1]) > 0.6 * Math.max(v[0], v[1])) k = 2;
    owner[c] = k === 3 ? -1 : k;
    strength[c] = tot;
    max = Math.max(max, tot);
  }
  for (let c = 0; c < n; c++) strength[c] = max ? Math.min(1, strength[c] / (0.35 * max)) : 0;
  // Majority filter (3×3) to remove speckle, so the zones read as areas.
  const smooth = Int8Array.from(owner);
  for (let iy = 0; iy < Z.ny; iy++) for (let ix = 0; ix < Z.nx; ix++) {
    const c = iy * Z.nx + ix;
    if (owner[c] === -2) continue;
    const count = new Map();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = ix + dx, y = iy + dy;
      if (x < 0 || y < 0 || x >= Z.nx || y >= Z.ny) continue;
      const o = owner[y * Z.nx + x];
      if (o !== -2) count.set(o, (count.get(o) || 0) + (dx || dy ? 1 : 1.5));
    }
    let best = owner[c], bc = -1;
    for (const [o, k] of count) if (k > bc) { bc = k; best = o; }
    smooth[c] = best;
  }
  return { ...Z, owner: smooth, strength };
}
