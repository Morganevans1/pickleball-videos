// Quality of the student's next shot, measured with the same engine:
// from a given contact height and court depth, how many reliable, punishing
// options does the student have? A ball taken high near the kitchen line opens
// up most of the court at pace; a ball dug out low at the baseline leaves only
// a few soft, risky options.

import { launchSet, GRID } from './launches.js';

export const Q_Z = [0.4, 0.9, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5];
export const Q_DEPTH = [1, 4, 8, 13, 18, 23];

const cache = new Map();

export function optionsTable(profile) {
  const key = `${profile.skill.toFixed(1)}`;
  if (cache.has(key)) return cache.get(key);
  const vals = new Float32Array(Q_Z.length * Q_DEPTH.length);
  let max = 0;
  Q_Z.forEach((z, iz) => {
    Q_DEPTH.forEach((depth, idp) => {
      const set = launchSet({ x: 0, y: -depth, z }, profile, 1, 3);
      let sum = 0;
      for (let is = 0; is < set.NS; is++) for (let iv = 0; iv < set.NV; iv++) {
        if (!set.allowed(is, iv)) continue;
        const pace = 0.3 + 0.7 * Math.min(1, GRID.mph[iv] / profile.maxDrive);
        for (let it = 0; it < set.NT; it++) for (let ip = 0; ip < set.nPhi; ip++) {
          const idx = set.index(is, iv, it, ip);
          if (!set.ok[idx]) continue;
          const p = set.pSucc[idx];
          sum += p * p * pace;
        }
      }
      vals[iz * Q_DEPTH.length + idp] = sum;
      max = Math.max(max, sum);
    });
  });
  // Square root keeps the scale readable: an easy put-away is not 20x better
  // than a solid deep ball, even if it has 20x as many winning targets.
  for (let i = 0; i < vals.length; i++) vals[i] = Math.sqrt(vals[i] / (max || 1));
  const table = { vals, lookup: (z, depth) => bilinear(vals, z, depth) };
  cache.set(key, table);
  return table;
}

function locate(arr, v) {
  if (v <= arr[0]) return [0, 0];
  for (let i = 1; i < arr.length; i++) if (v <= arr[i]) return [i - 1, (v - arr[i - 1]) / (arr[i] - arr[i - 1])];
  return [arr.length - 2, 1];
}

function bilinear(vals, z, depth) {
  const [iz, fz] = locate(Q_Z, z);
  const [id, fd] = locate(Q_DEPTH, depth);
  const n = Q_DEPTH.length;
  const a = vals[iz * n + id], b = vals[iz * n + id + 1];
  const c = vals[(iz + 1) * n + id], d = vals[(iz + 1) * n + id + 1];
  return (a * (1 - fd) + b * fd) * (1 - fz) + (c * (1 - fd) + d * fd) * fz;
}
