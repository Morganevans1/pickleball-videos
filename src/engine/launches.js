// The "everything a player could hit" engine.
//
// From one contact point we fly a grid of launches (speed × elevation × spin)
// once per contact height, then sweep every direction. Because spin is
// top/back only, a trajectory is a 2D curve and direction just rotates it,
// which keeps this fast enough to run interactively.
//
// Ease (success probability) comes from blurring the "clears the net and lands
// in" grid with the player's execution error: if most nearby launches also
// succeed, the shot is forgiving.

import { BALL_R, COURT, MPH, netHeight, flyToGround } from './physics.js';

const DEG = Math.PI / 180;

export const GRID = {
  mph: Array.from({ length: 35 }, (_, i) => 6 + 2 * i),          // 6 … 74 mph
  thetaDeg: Array.from({ length: 45 }, (_, i) => -45 + 2.5 * i), // -45° … 65°
  spin: [-1200, 0, 1000, 2000],                                   // rpm
  dMax: 48,
};
const NV = GRID.mph.length, NT = GRID.thetaDeg.length, NS = GRID.spin.length;
const NTRAJ = NV * NT * NS;
const ND = GRID.dMax + 1;
const trajIndex = (is, iv, it) => (is * NV + iv) * NT + it;

const tableCache = new Map();

/**
 * Flight table for one contact height: landing distance/time and the height
 * at every whole foot of ground distance (for the net check).
 */
export function flightTable(zc) {
  const key = Math.round(zc * 4) / 4;
  if (tableCache.has(key)) return tableCache.get(key);
  const landD = new Float32Array(NTRAJ).fill(NaN);
  const landT = new Float32Array(NTRAJ).fill(NaN);
  const zs = new Float32Array(NTRAJ * ND).fill(NaN);
  for (let is = 0; is < NS; is++) {
    for (let iv = 0; iv < NV; iv++) {
      for (let it = 0; it < NT; it++) {
        const k = trajIndex(is, iv, it);
        const base = k * ND;
        zs[base] = key;
        const r = flyToGround(key, GRID.mph[iv] * MPH, GRID.thetaDeg[it] * DEG, GRID.spin[is], GRID.dMax + 2, 4,
          (pd, pz, d, z) => {
            for (let j = Math.floor(pd) + 1; j <= d && j < ND; j++) {
              zs[base + j] = pz + ((j - pd) / (d - pd || 1e-9)) * (z - pz);
            }
          });
        landD[k] = r.landD;
        landT[k] = r.landT;
      }
    }
  }
  const table = { key, landD, landT, zs };
  tableCache.set(key, table);
  if (tableCache.size > 40) tableCache.delete(tableCache.keys().next().value);
  return table;
}

function zAtD(table, k, d) {
  const j = Math.floor(d);
  if (j < 0 || j + 1 >= ND) return NaN;
  const a = table.zs[k * ND + j], b = table.zs[k * ND + j + 1];
  return a + (d - j) * (b - a);
}

// Gaussian kernel, normalised over the infinite line so that anything that
// falls off the grid counts as a miss.
function kernel(sigma) {
  const s = Math.max(0.3, sigma);
  const r = Math.ceil(3 * s);
  const w = new Float32Array(2 * r + 1);
  let norm = 0;
  for (let j = -r; j <= r; j++) { w[j + r] = Math.exp(-0.5 * (j / s) ** 2); norm += w[j + r]; }
  for (let j = 0; j < w.length; j++) w[j] /= norm;
  return { r, w };
}

// Blur one strided line. `kernels[i]` is the kernel for output i.
function blurLine(src, dst, offset, stride, n, kernels) {
  for (let i = 0; i < n; i++) {
    const { r, w } = kernels[i];
    let acc = 0;
    const j0 = Math.max(0, i - r), j1 = Math.min(n - 1, i + r);
    for (let j = j0; j <= j1; j++) acc += w[j - i + r] * src[offset + j * stride];
    dst[offset + i * stride] = acc;
  }
}

/**
 * Evaluate every launch from `contact` toward the other half of the court.
 * @param contact  {x, y, z}
 * @param profile  player profile (ratings.js)
 * @param errScale multiplies execution error (awkward contact = bigger errors)
 * Returns { phis, nPhi, ok (Uint8), pSucc (Float32), landX, landY, clear,
 *           index(is,iv,it,ip), allowed(is,iv) }.
 */
export function launchSet(contact, profile, errScale = 1, phiStepDeg = 1.5) {
  const table = flightTable(contact.z);
  const side = contact.y > 0 ? -1 : 1; // half we are hitting into
  const cy = Math.abs(contact.y);
  // Direction convention: heading h = (sin φ, side * cos φ).
  const corners = [[-COURT.halfW - 1, COURT.halfL + 1], [COURT.halfW + 1, COURT.halfL + 1], [-COURT.postX, 0.01], [COURT.postX, 0.01]];
  let pmin = Infinity, pmax = -Infinity;
  for (const [px, py] of corners) {
    const a = Math.atan2(px - contact.x, py + cy);
    pmin = Math.min(pmin, a); pmax = Math.max(pmax, a);
  }
  pmin -= 2 * DEG; pmax += 2 * DEG;
  const step = phiStepDeg * DEG;
  const nPhi = Math.max(3, Math.ceil((pmax - pmin) / step) + 1);
  const phis = new Float32Array(nPhi);
  for (let i = 0; i < nPhi; i++) phis[i] = pmin + i * step;

  const N = NTRAJ * nPhi;
  const ok = new Uint8Array(N);
  const landX = new Float32Array(N), landY = new Float32Array(N), clear = new Float32Array(N);
  const index = (is, iv, it, ip) => trajIndex(is, iv, it) * nPhi + ip;

  const allowedSpin = (is) => {
    const s = GRID.spin[is];
    return s >= 0 ? s <= profile.maxTopspin * 1.05 + 1 : -s <= profile.maxBackspin * 1.05 + 1;
  };
  const allowed = (is, iv) => allowedSpin(is) && GRID.mph[iv] <= profile.maxDrive * 1.05;

  for (let ip = 0; ip < nPhi; ip++) {
    const hx = Math.sin(phis[ip]), hyAbs = Math.cos(phis[ip]);
    if (hyAbs < 0.05) continue;
    const dNet = cy / hyAbs;
    const xCross = contact.x + dNet * hx;
    const netZ = netHeight(xCross) + BALL_R;
    for (let k = 0; k < NTRAJ; k++) {
      const D = table.landD[k];
      if (!(D > dNet)) continue;
      const zn = dNet < 1e-3 ? contact.z : zAtD(table, k, dNet);
      if (!(zn > netZ)) continue;
      const lx = contact.x + D * hx;
      const ly = contact.y + side * D * hyAbs;
      const idx = k * nPhi + ip;
      landX[idx] = lx; landY[idx] = ly; clear[idx] = zn - netZ;
      if (Math.abs(lx) <= COURT.halfW && Math.abs(ly) <= COURT.halfL && Math.sign(ly) === side) ok[idx] = 1;
    }
  }

  // Ease: blur success over the player's error in elevation, direction and pace.
  const aim = profile.aimErr * errScale;
  const pace = profile.paceErr * errScale;
  const pSucc = new Float32Array(N);
  const tmp = new Float32Array(N);
  for (let i = 0; i < N; i++) pSucc[i] = ok[i];
  const kPhi = new Array(nPhi).fill(kernel(aim / phiStepDeg));
  const kTheta = new Array(NT).fill(kernel(aim / 2.5));
  const kV = GRID.mph.map((m) => kernel((pace * m) / 2));
  for (let is = 0; is < NS; is++) {
    // along φ (contiguous)
    for (let iv = 0; iv < NV; iv++) for (let it = 0; it < NT; it++) {
      blurLine(pSucc, tmp, index(is, iv, it, 0), 1, nPhi, kPhi);
    }
    // along θ
    for (let iv = 0; iv < NV; iv++) for (let ip = 0; ip < nPhi; ip++) {
      blurLine(tmp, pSucc, index(is, iv, 0, ip), nPhi, NT, kTheta);
    }
    // along speed (error grows with pace)
    for (let it = 0; it < NT; it++) for (let ip = 0; ip < nPhi; ip++) {
      blurLine(pSucc, tmp, index(is, 0, it, ip), NT * nPhi, NV, kV);
    }
  }
  for (let i = 0; i < N; i++) pSucc[i] = tmp[i];

  return { contact, side, table, phis, nPhi, ok, pSucc, landX, landY, clear, index, allowed, NV, NT, NS };
}

/** Weight a launch for a "plays the percentages" player. */
export function percentageWeight(set, idx, mph, { netPressure = false } = {}) {
  if (!set.ok[idx]) return 0;
  const p = set.pSucc[idx];
  const c = set.clear[idx];
  const deep = Math.abs(set.landY[idx]) > 15;
  let prior;
  if (c <= 2.5) prior = 1;
  else if (c > 6 && deep) prior = 0.12;        // a genuine lob
  else prior = Math.exp(-(c - 2.5) / 1.2);       // floaters that sit up are avoided
  if (netPressure && !(c > 6 && deep)) prior *= attackPenalty(set, idx);
  return p * p * prior;
}

// With someone at the net, a ball that reaches their kitchen line above
// about net height gets attacked, so players avoid hitting it.
const ATTACK_Z = 2.4;
function attackPenalty(set, idx) {
  const k = Math.floor(idx / set.nPhi), ip = idx % set.nPhi;
  const cosPhi = Math.cos(set.phis[ip]);
  const dLine = (Math.abs(set.contact.y) + COURT.kitchen + 0.5) / Math.max(cosPhi, 0.05);
  if (!(set.table.landD[k] > dLine)) return 1; // lands in the kitchen first
  const z = zAtD(set.table, k, dLine);
  return z > ATTACK_Z ? Math.exp(-(z - ATTACK_Z) / 0.7) : 1;
}
