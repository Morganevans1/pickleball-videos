// The Bounce Machine — choreography. Every frame is a pure function of t (seconds), so frames
// can render in any order / in parallel. Also emits the sound cues the soundtrack is built from.
import * as THREE from 'three';
import { W, L, COURTS, MEZ, DOOR, DESK, STAIR } from './world.js';
import { makePerson, setPose, POSES, blendPose, CAST, randomSpec, paddlePoint } from './people.js';
import { rng } from './textures.js';

export const DUR = 30, FPS = 30;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (a, b, t) => clamp((t - a) / (b - a));
const E = {
  io: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), out: t => 1 - Math.pow(1 - t, 3), in: t => t * t * t,
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2, smooth: t => t * t * (3 - 2 * t),
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BR = 0.11;            // hero ball radius (stylized so it reads in wide shots)
const D2R = Math.PI / 180;

// ------------------------------------------------------------------ pose tracks
const P = k => (typeof k === 'string' ? POSES[k] : k);
function track(keys, t) {
  if (t <= keys[0][0]) return P(keys[0][1]);
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i], [t1, p1] = keys[i + 1];
    if (t >= t0 && t <= t1) return blendPose(P(p0), P(p1), E.sine((t - t0) / Math.max(1e-6, t1 - t0)));
  }
  return P(keys[keys.length - 1][1]);
}
function swingKeys(hits, o = {}) {
  const rest = o.rest || 'ready', pre = o.pre ?? 0.32, bk = o.back ?? 0.14, th = o.thru ?? 0.12, post = o.post ?? 0.42;
  let keys = [[-100, rest]];
  for (const h of hits) {
    const k = [[h.t - pre, rest], [h.t - bk, h.back], [h.t, h.hit], [h.t + th, h.thru || h.hit], [h.t + post, rest]];
    keys = keys.filter(kk => kk[0] < k[0][0] - 1e-6); keys.push(...k);
  }
  keys.push([1000, rest]);
  return keys;
}
const SETS = { volley: { back: 'volleyBack', hit: 'volley' }, dink: { back: 'dinkBack', hit: 'dink' }, lift: { back: 'dinkBack', hit: 'lift' } };
// blend a reaction pose in and out over a time window
function react(pose, list, t) {
  for (const r of list) {
    const ramp = r.ramp ?? 0.18;
    const w = Math.min(E.smooth(prog(r.t0 - ramp, r.t0, t)), 1 - E.smooth(prog(r.t1, r.t1 + ramp, t)));
    if (w > 0) pose = blendPose(pose, P(r.pose), w);
  }
  return pose;
}

// ------------------------------------------------------------------ ball paths (ballistic arcs between authored contacts)
class Path {
  constructor() { this.k = []; this.hold = 0; }
  add(t, p, o = {}) { this.k.push(Object.assign({ t, p: p.isVector3 ? p.clone() : V(...p) }, o)); return this; }
  get t0() { return this.k[0].t; }
  get t1() { return this.k[this.k.length - 1].t; }
  at(t) {
    const k = this.k;
    if (t < k[0].t || t > this.t1 + this.hold) return null;
    if (t >= this.t1) return k[k.length - 1].p.clone();
    let i = 0; while (i < k.length - 2 && t >= k[i + 1].t) i++;
    const a = k[i], b = k[i + 1], T = b.t - a.t, u = (t - a.t) / T;
    const p = a.p.clone().lerp(b.p, u);
    if (!b.line) p.y += 4 * (b.A ?? (b.g ?? 9.8) * T * T / 8) * u * (1 - u);
    return p;
  }
}

// ------------------------------------------------------------------ setup
export function setupAnim(scene, G) {
  const people = [];   // { p, pose(t) -> pose, extra(t) -> {...} }
  const R = rng(2024); let seed = 900;
  const add = (spec, x, y, z, face, poseFn, o = {}) => {
    const p = makePerson(spec, o); p.position.set(x, y, z); p.rotation.y = face * D2R; G.interior.add(p);
    const rec = { p, pose: poseFn, extra: o.extra || (() => ({})), react: [], seated: !!o.seated };
    people.push(rec); return rec;
  };
  const idle = (offset = 0) => {
    const period = 1.7 + R() * 0.8, phase = R() * period, set = R() < 0.5 ? SETS.dink : SETS.volley, hits = [];
    for (let t = phase + offset; t < DUR + 2; t += period) hits.push(Object.assign({ t }, set));
    const keys = swingKeys(hits);
    return t => track(keys, t);
  };
  const atHit = (rec, t) => { setPose(rec.p, rec.pose(t)); rec.p.updateMatrixWorld(true); return paddlePoint(rec.p); };

  // ---- heroes
  const heroes = {};
  const hero = (name, spec, court, dx, dz, face, keys) => {
    const c = COURTS[court];
    heroes[name] = add(spec, c.cx + dx, 0, c.cz + dz, face, t => track(keys, t));
    heroes[name].keys = keys;
    return heroes[name];
  };
  hero('tasha', CAST.tasha, 1, 1.4, 2.9, 90, swingKeys([{ t: 10.25, ...SETS.volley }]));
  hero('kenji', CAST.kenji, 2, -1.9, 1.5, 90, swingKeys([{ t: 11.25, ...SETS.volley }]));
  const devFace = Math.atan2(G.hopperRim.x - (COURTS[3].cx - 1.9), G.hopperRim.z - (COURTS[3].cz - 0.7)) / D2R;
  hero('dev', CAST.dev, 3, -1.9, -0.7, devFace, swingKeys([{ t: 12.25, back: 'volleyBack', hit: 'volley', thru: 'smash' }]));
  hero('marge', CAST.marge, 4, 0.8, -2.95, 3, [[-100, 'ready'], [14.2, 'ready'], [14.5, 'dodge'], [15.4, 'celebrate'], [16.3, 'ready'], [17.15, 'lobBack'], [17.5, 'lift'], [17.75, 'lob'], [18.4, 'lob'], [19.2, 'ready'], [1000, 'ready']]);
  hero('walt', CAST.walt, 10, 2.4, -1.9, 90, swingKeys([{ t: 21.0, ...SETS.volley }]));
  const jessKeys = [...swingKeys([21.5, 22.0, 22.5].map(t => ({ t, ...SETS.volley })), { pre: 0.2, back: 0.1, thru: 0.08, post: 0.2, rest: 'volleyBack' }).filter(k => k[0] < 22.9),
    [23.0, 'ready'], [23.75, 'overheadBack'], [24.1, 'overheadBack'], [24.25, 'overhead'], [24.4, 'smash'], [24.9, 'ready'], [1000, 'ready']];
  hero('jess', CAST.jess, 9, -0.9, -1.7, 0, jessKeys);
  hero('q', randomSpec(77), 9, 0.4, 1.7, 180, swingKeys([{ t: 21.75, ...SETS.volley }, { t: 22.25, ...SETS.volley }, { t: 22.75, ...SETS.lift }], { pre: 0.2, back: 0.1, thru: 0.1, post: 0.3, rest: 'volleyBack' }));

  // ---- everyone else on court
  const heroCourts = { 1: 1, 2: 1, 3: 1, 4: 1, 10: 1, 9: 2 };
  const occupancy = { 1: 4, 2: 4, 3: 3, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 2, 13: 4, 14: 2 };
  for (const [num, n] of Object.entries(occupancy)) {
    const c = COURTS[num]; const skip = heroCourts[num] || 0;
    const slots = [[-1.5, -2.6, 0], [1.5, -6.0, 0], [-1.5, 2.6, 180], [1.5, 6.0, 180]].sort(() => R() - 0.5);
    for (let k = 0; k < n - skip; k++) {
      const [dx, dz, face] = slots[k];
      if (num === '9' && Math.abs(dz) < 3) continue; // keep the court-9 net clear for the hands battle
      add(randomSpec(seed++), c.cx + dx + (R() - 0.5) * 0.4, 0, c.cz + dz + (R() - 0.5) * 0.4, face + (R() - 0.5) * 20, idle());
      people[people.length - 1].court = +num;
    }
  }
  // ---- the lobby, the landing, the mezzanine
  const still = name => () => P(name);
  const staff1 = add(randomSpec(seed++), DESK.x - 0.8, 0, DESK.z + 0.5, 90, still('talk'), { paddle: false });
  const staff2 = add(randomSpec(seed++), DESK.x - 0.8, 0, DESK.z - 0.8, 90, still('stand'), { paddle: false });
  staff1.react.push({ t0: 3.05, t1: 3.6, pose: 'dodge' }); staff2.react.push({ t0: 3.1, t1: 3.7, pose: 'celebrate' });
  add(randomSpec(seed++), W - 1.6, 0, DOOR.zc - 1.9, -90, still('walk'));
  add(randomSpec(seed++), W - 1.9, 0, DOOR.zc + 2.6, -110, still('stand'));
  const land1 = add(randomSpec(seed++), STAIR.xBack + 0.55, STAIR.landY, DOOR.zc - 0.45, 90, still('rail'), { paddle: false });
  const land2 = add(randomSpec(seed++), STAIR.xBack + 0.55, STAIR.landY, DOOR.zc + 0.5, 90, still('rail'), { paddle: false });
  land1.react.push({ t0: 4.72, t1: 5.3, pose: 'dodge' }); land2.react.push({ t0: 4.8, t1: 5.4, pose: 'celebrate' });
  const lx = 20.5, lz = DOOR.zc, my = MEZ.y;
  [100, 160, 210, 260].forEach((a, i) => {
    const r = 1.32, ang = a * D2R, x = lx + Math.cos(ang) * r, z = lz - Math.sin(ang) * r;
    const rec = add(randomSpec(seed++), x, my, z, Math.atan2(lx - x, lz - z) / D2R, still('sit'), { paddle: false, seated: true, extra: () => ({ seatY: 0.47 }) });
    rec.react.push({ t0: 7.05 + i * 0.05, t1: 8.3, pose: 'sitCheer' });
  });
  [[11.5, -1], [16, -1], [23.5, -1], [14.5, 1], [18.5, 1], [26.5, 1]].forEach(([x, s]) => {
    const rec = add(randomSpec(seed++), x, my, s < 0 ? MEZ.z0 + 0.5 : MEZ.z1 - 0.5, s < 0 ? 180 : 0, still('rail'), { paddle: false });
    if (s < 0 && x < 18) { const tp = 7.6 + (18.2 - x) / 5.143; rec.react.push({ t0: tp - 0.15, t1: tp + 0.35, pose: 'dodge', ramp: 0.12 }); }
    if (s < 0 && x > 20) rec.react.push({ t0: 7.0, t1: 8.0, pose: 'wave' });
  });
  add(randomSpec(seed++), 9.6, my, MEZ.z0 + 1.4, 160, still('talk'), { paddle: false });
  add(randomSpec(seed++), 8.5, my, MEZ.z0 + 0.9, 40, still('talk'), { paddle: false });
  add(randomSpec(seed++), 9.0, my, DOOR.zc + 1.4, -90, still('stand'), { paddle: false });

  // ---- reactions to the avalanche (front row: courts 4, 6, 5, 7)
  for (const rec of people) if ([4, 6, 5, 7].includes(rec.court)) {
    const t0 = 13.3 + (36 - rec.p.position.x) * 0.045 + R() * 0.25;
    rec.react.push({ t0, t1: t0 + 0.9, pose: 'dodge' }, { t0: t0 + 1.0, t1: t0 + 2.2, pose: 'celebrate' });
  }
  // ---- the finale: everyone celebrates
  for (const rec of people) {
    const t0 = 25.12 + R() * 0.55;
    rec.react.push({ t0, t1: 99, pose: rec.seated ? 'sitCheer' : 'celebrate', ramp: 0.15 });
    rec.celebrateAt = t0;
  }

  // ------------------------------------------------------------------ ball 1: roof -> desk -> stairs -> mezzanine -> relay -> hopper
  const cues = [];
  const b1 = new Path();
  const roofY = x => 9.6 - (x - W / 2) / (W / 2 + 0.6) * (9.6 - 6.0 + 0.12);
  const rx = 30.5, rz = 46.5, ry = roofY(rx) + BR;
  b1.add(0, [rx, ry + 0.5 * 9.8 * 1.44, rz]).add(1.2, [rx, ry, rz], { snd: 'roof' });
  const bellW = G.bell.getWorldPosition(V(0, 0, 0)).add(V(0, 0.09 + BR, 0));
  b1.add(3.0, bellW, { snd: 'bell' });
  b1.add(3.4, [32.9, BR, 45.5], { snd: 'bounce', g: 12 });
  const rise = STAIR.landY / STAIR.n, xs = (STAIR.xFront + STAIR.xBack) / 2;
  for (let i = 0; i < 10; i++) b1.add(3.62 + 0.12 * i, [xs, (i + 1) * rise + BR, STAIR.zl1 + STAIR.n * STAIR.run - (i + 0.5) * STAIR.run], { A: i === 0 ? 0.34 : 0.26, snd: 'step', note: i });
  b1.add(4.84, [xs, STAIR.landY + BR, DOOR.zc + 0.6], { A: 0.26, snd: 'step', note: 10 });
  const cRise = (MEZ.y - STAIR.landY) / STAIR.n;
  for (let j = 0; j < 10; j++) b1.add(4.98 + 0.11 * j, [STAIR.xBack - (j + 0.5) * STAIR.cRun, STAIR.landY + (j + 1) * cRise + BR, DOOR.zc], { A: 0.25, snd: 'step', note: 11 + j });
  b1.add(6.12, [MEZ.x1 - 0.4, MEZ.y + BR, DOOR.zc], { A: 0.28, snd: 'bounce' });
  b1.add(6.55, [25.4, MEZ.y + BR, DOOR.zc - 0.2], { g: 14, snd: 'bounce' });
  const tableTop = G.lounge.position.y + 0.61 + BR;
  b1.add(7.0, [lx + 0.4, tableTop, lz + 0.15], { snd: 'clink' });
  const railTop = MEZ.y + 1.1 + BR;
  b1.add(7.6, [18.2, railTop, MEZ.z0 + 0.05], { snd: 'tick' });
  b1.add(9.0, [11.0, railTop, MEZ.z0 + 0.05], { line: true });
  for (let k = 0; k < 23; k++) { const x = 0.3 + k * (28.1 / 22); if (x < 18.0 && x > 11.2) cues.push({ t: 7.6 + (18.2 - x) / 5.143, type: 'tick', x }); }
  b1.add(9.75, [9.2, BR, 34.4], { snd: 'bounce' });
  b1.add(10.25, atHit(heroes.tasha, 10.25), { snd: 'pock' });
  const pan1 = G.nearestPanel(W / 3, 30.4), pan2 = G.nearestPanel(2 * W / 3, 28.9);
  b1.add(10.75, [W / 3, 0.75 + BR, 30.4], { snd: 'boing' });
  b1.add(11.25, atHit(heroes.kenji, 11.25), { snd: 'pock' });
  b1.add(11.75, [2 * W / 3, 0.75 + BR, 28.9], { snd: 'boing' });
  b1.add(12.25, atHit(heroes.dev, 12.25), { snd: 'pock' });
  b1.add(12.75, G.hopperRim.clone().add(V(0, BR, 0.1)), { snd: 'clang' });

  // ------------------------------------------------------------------ the avalanche (precomputed, deterministic)
  const aval = (() => {
    const Ra = rng(31337), balls = [], hits = [], N = 44, dt = 1 / 240, r = 0.09;
    for (let k = 0; k < N; k++) {
      const ts = 12.88 + 0.7 * (k / N) + Ra() * 0.06;
      const p = V(G.hopperRim.x + (Ra() - 0.5) * 0.3, 0.9 + Ra() * 0.25, G.hopperRim.z - 0.3 + (Ra() - 0.5) * 0.3);
      const v = V(-(0.4 + Ra() * 7.0), 1.0 + Ra() * 3.6, -(2.0 + Ra() * 3.6));
      const frames = [], f0 = Math.ceil(ts * FPS - 1e-9);
      let t = ts, next = f0 / FPS;
      while (t < DUR + 0.5) {
        v.y -= 9.8 * dt; p.addScaledVector(v, dt);
        if (p.y < r) { p.y = r; if (Math.abs(v.y) > 1.2) hits.push({ t, x: p.x, z: p.z, s: Math.abs(v.y) }); v.y = Math.abs(v.y) < 0.4 ? 0 : -v.y * 0.6; v.x *= 0.88; v.z *= 0.88; }
        if (p.y <= r + 1e-4 && v.y === 0) { v.x *= 0.992; v.z *= 0.992; }
        if (p.x < 0.6) { p.x = 0.6; v.x = -v.x * 0.55; } if (p.x > W - 0.6) { p.x = W - 0.6; v.x = -v.x * 0.55; }
        if (p.z < 0.6) { p.z = 0.6; v.z = -v.z * 0.55; }
        t += dt;
        while (t >= next) { frames.push(p.clone()); next += 1 / FPS; }
      }
      balls.push({ ts, f0, frames, r });
    }
    return { balls, hits };
  })();
  const ballGeo = new THREE.SphereGeometry(1, 20, 14);
  const ballMat = new THREE.MeshLambertMaterial({ color: '#D8EE3A', emissive: '#4A5600' });
  const avMeshes = aval.balls.map(b => { const m = new THREE.Mesh(ballGeo, ballMat); m.scale.setScalar(b.r); m.castShadow = true; m.visible = false; G.interior.add(m); return m; });
  aval.hits.sort((a, b) => a.t - b.t).filter((h, i, arr) => i === 0 || h.t - arr[i - 1].t > 0.03).slice(0, 70)
    .forEach(h => cues.push({ t: h.t, type: 'bounce', x: h.x, gain: clamp(h.s / 6, 0.12, 0.6) }));

  // ------------------------------------------------------------------ ball 2: Marge's lob -> court 10 -> court 9 hands battle -> overhead -> the "B"
  const b2 = new Path();
  b2.add(16.3, [21.6, BR, 12.6]).add(16.8, [14.0, BR, 9.6], { snd: 'bounce', g: 12 });
  b2.add(17.5, atHit(heroes.marge, 17.5), { snd: 'pock' });
  b2.add(20.5, [COURTS[10].cx + 1.5, BR, COURTS[10].cz - 3.7], { snd: 'bounce' });
  b2.add(21.0, atHit(heroes.walt, 21.0), { snd: 'pock' });
  [[21.5, 'jess'], [21.75, 'q'], [22.0, 'jess'], [22.25, 'q'], [22.5, 'jess'], [22.75, 'q']].forEach(([t, who], i) =>
    b2.add(t, atHit(heroes[who], t), { snd: i === 5 ? 'frame' : 'pock', A: i === 0 ? 0.35 : 0.12 }));
  b2.add(24.25, atHit(heroes.jess, 24.25), { snd: 'pock' });
  b2.add(25.0, V(G.holeL.x, G.holeL.y, G.holeL.z - BR * 0.6), { snd: 'big' });
  b2.hold = 10;
  for (const [path, which] of [[b1, 1], [b2, 2]]) for (const k of path.k) if (k.snd) cues.push({ t: k.t, type: k.snd, x: k.p.x, note: k.note, ball: which });
  cues.push({ t: 1.55, type: 'whoosh', dur: 0.8 }, { t: 2.0, type: 'billow', dur: 1.2 }, { t: 7.05, type: 'cheer', gain: 0.5 },
    { t: 13.4, type: 'cheer', gain: 0.6 }, { t: 17.5, type: 'whoosh', dur: 1.2 }, { t: 24.25, type: 'whoosh', dur: 0.7 }, { t: 25.15, type: 'cheer', gain: 1.0 });
  cues.sort((a, b) => a.t - b.t);

  // ball meshes + motion trail
  const mkBall = () => {
    const m = new THREE.Mesh(ballGeo, ballMat); m.scale.setScalar(BR); m.castShadow = true; G.interior.add(m);
    const trail = Array.from({ length: 7 }, (_, i) => { const g = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: '#E4F55A', transparent: true, opacity: 0.32 * (1 - i / 7), depthWrite: false })); g.scale.setScalar(BR * (1 - i * 0.09)); G.interior.add(g); return g; });
    return { m, trail };
  };
  const B1 = mkBall(), B2 = mkBall();
  const placeBall = (B, path, t, hideAfter = Infinity) => {
    const p = t <= hideAfter ? path.at(t) : null;
    B.m.visible = !!p; if (p) { B.m.position.copy(p); B.m.rotation.x = t * 9; }
    B.trail.forEach((g, i) => { const q = p ? path.at(t - (i + 1) * 0.016) : null; g.visible = !!q && q.distanceTo(p) > BR * 0.5; if (q) g.position.copy(q); });
    return p;
  };

  // ------------------------------------------------------------------ camera
  const K = [
    [0.0, [W + 1, 3.2, 38.3], [1, 0.42, 0.55], 24], [1.1, [W + 0.4, 4.6, 40.2], [1, 0.52, 0.55], 26],
    [2.35, [33.4, 2.4, 41.8], [1, 0.78, 0.5], 15], [3.05, [33.4, 1.4, 42.3], [1, 0.62, 0.42], 9.5],
    [4.5, [32.0, 1.6, 42.4], [1, 0.62, 0.38], 9.2], [6.1, [28.4, 3.3, 41.5], [1, 0.72, 0.32], 10.5],
    [7.1, [21.6, 3.9, 41.0], [0.95, 0.8, 0.42], 11], [8.4, [15.4, 4.0, 39.6], [0.9, 0.78, 0.5], 12],
    [9.8, [10.8, 1.6, 34.4], [0.9, 0.85, 0.55], 15], [11.25, [18.0, 1.0, 29.6], [0.9, 0.9, 0.55], 17],
    [12.75, [27.5, 0.8, 23.6], [0.9, 0.9, 0.55], 18], [14.6, [20.0, 0, 12.6], [0.9, 1.0, 0.6], 27],
    [16.9, [11.5, 0.6, 9.6], [0.9, 0.95, 0.6], 21], [18.1, [12.5, 3.0, 20.0], [1, 0.95, 0.45], 24],
    [19.4, [12.5, 6.0, 36.0], [1, 0.9, 0.35], 30], [20.6, [10.0, 1.5, 51.2], [0.95, 0.85, 0.4], 18],
    [22.0, [15.2, 1.6, 54.0], [0.95, 0.8, 0.25], 13.5], [23.3, [16.0, 2.2, 56.8], [0.9, 0.7, -0.35], 14],
    [24.3, [16.5, 2.8, 62.5], [0.8, 0.6, -0.75], 17], [25.0, [16.0, 4.0, 79.3], [0.65, 0.42, -1.0], 10.5],
    [26.3, [16.0, 4.0, 79.0], [0.65, 0.44, -1.0], 11.5], [28.2, [31.0, 0.0, 57.5], [0.7, 1.0, -0.8], 82], [30.0, [31.0, 0.0, 57.5], [0.7, 1.0, -0.8], 84],
  ].map(([t, a, d, h]) => ({ t, a: V(...a), d: V(...d).normalize(), h }));
  const herm = (p0, p1, m0, m1, u) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1; };
  const camAt = t => {
    let i = 0; while (i < K.length - 2 && t >= K[i + 1].t) i++;
    const a = K[i], b = K[i + 1], u = clamp((t - a.t) / (b.t - a.t)), T = b.t - a.t;
    const prev = K[Math.max(0, i - 1)], next = K[Math.min(K.length - 1, i + 2)];
    const tan = (k0, k1, sel) => (sel(k1) - sel(k0)) / Math.max(1e-6, k1.t - k0.t) * T;
    const f = sel => herm(sel(a), sel(b), i === 0 ? 0 : tan(prev, b, sel) * 0.8, i + 2 >= K.length ? 0 : tan(a, next, sel) * 0.8, u);
    return {
      a: V(f(k => k.a.x), f(k => k.a.y), f(k => k.a.z)),
      d: V(f(k => k.d.x), f(k => k.d.y), f(k => k.d.z)).normalize(), h: f(k => k.h),
    };
  };
  const follow = t => 0.35 * Math.min(E.smooth(prog(2.9, 3.3, t)), 1 - E.smooth(prog(12.4, 12.9, t))) + 0.22 * Math.min(E.smooth(prog(16.6, 17.2, t)), 1 - E.smooth(prog(24.0, 24.6, t)));

  // ------------------------------------------------------------------ per-frame update
  function update(t, cam) {
    // the opening: roof flies off, the near walls sink, the fabric ceiling gathers away
    const eRoof = E.in(prog(1.55, 2.35, t));
    G.roofL.position.set(-18 * eRoof, 15 * eRoof, 0); G.roofL.rotation.z = 0.5 * eRoof;
    G.roofR.position.set(18 * eRoof, 15 * eRoof, 0); G.roofR.rotation.z = -0.5 * eRoof;
    G.roof.visible = t < 2.35;
    const sink = -6.3 * E.in(prog(1.6, 2.3, t));
    G.nearFull.position.y = sink; G.nearFull.visible = sink > -5.0;
    G.fgTrees.position.y = sink * 1.4; G.fgTrees.visible = sink > -5.0;
    G.nearCut.visible = !G.nearFull.visible;
    const open = t < 1.9 ? 0 : 0.94 * E.io(prog(1.9, 3.3, t));
    G.setCeiling(open); G.ceiling.visible = true;
    // the desk bell
    const bt = t - 3.0; G.bellDome.scale.y = bt > 0 && bt < 0.6 ? 1 - 0.35 * Math.exp(-bt * 14) * Math.cos(bt * 60) : 1;
    // cups on the lounge table jump on the clink
    G.cups.forEach((c, i) => {
      const a = t - 7.0 - i * 0.02; const hop = a > 0 ? Math.max(0, Math.sin(Math.min(a, 0.42) / 0.42 * Math.PI)) * (0.2 + 0.06 * i) : 0;
      c.position.copy(c.userData.base); c.position.y += hop;
      c.rotation.set(a > 0 ? Math.min(a * 9, i === 2 ? Math.PI / 2 : 0.4) * (i % 2 ? 1 : -1) * (i === 2 ? 1 : Math.exp(-Math.max(0, a - 0.4) * 6)) : 0, 0, 0);
    });
    // bumper panels flex
    for (const [idx, th] of [[pan1, 10.75], [pan2, 11.75]]) { const a = t - th; G.tiltPanel(idx, a > 0 && a < 1.2 ? 0.32 * Math.exp(-a * 5) * Math.sin(a * 32) : 0); }
    // the hopper tips over
    const tip = E.in(prog(12.75, 13.12, t)); const settle = t > 13.12 ? 0.06 * Math.exp(-(t - 13.12) * 8) * Math.sin((t - 13.12) * 30) : 0;
    G.hopperPivot.rotation.x = -(Math.PI / 2 + 0.12) * tip + settle;
    G.hopperBalls.forEach(b => { b.visible = t < 12.9; });
    // avalanche balls
    const f = Math.round(t * FPS);
    aval.balls.forEach((b, i) => { const m = avMeshes[i]; const k = f - b.f0; m.visible = k >= 0; if (k >= 0) m.position.copy(b.frames[Math.min(k, b.frames.length - 1)]); });
    // hero balls
    const p1 = placeBall(B1, b1, t, 12.85), p2 = placeBall(B2, b2, t);
    // the banner lights up
    const hit = t - 25.0;
    G.logoGlow.material.opacity = hit > 0 ? 0.25 + 0.75 * Math.exp(-hit * 1.6) + 0.12 * Math.sin(hit * 5) * Math.exp(-hit * 0.6) : 0;
    G.rings.forEach((r, i) => { const a = hit - i * 0.16; const on = a > 0 && a < 1.6; r.visible = on; if (on) { r.scale.setScalar(G.holeL.r * 1.3 + 7 * E.out(a / 1.6)); r.material.opacity = 0.85 * (1 - a / 1.6); } });
    // people
    for (const rec of people) {
      let pose = rec.pose(t); pose = react(pose, rec.react, t);
      const ex = Object.assign({}, rec.extra(t));
      if (!rec.seated && rec.celebrateAt && t > rec.celebrateAt + 0.15) ex.air = 0.08 * Math.abs(Math.sin((t - rec.celebrateAt) * Math.PI * 2.3)) * Math.exp(-(t - rec.celebrateAt) * 0.35);
      setPose(rec.p, pose, ex);
    }
    // camera (with a little ball-follow) and which end walls are cut
    const c = camAt(t), ball = p1 || p2, w = follow(t);
    if (ball && w > 0) c.a.lerp(ball, w);
    // keep the ball readable at any zoom: grow it a little in wide shots (but not once it's inside the logo)
    const s = Math.max(BR, c.h * 0.0075);
    for (const [B, inLogo] of [[B1, false], [B2, hit > 0]]) {
      const k = inLogo ? BR * (1 + 0.18 * Math.exp(-hit * 10) * Math.cos(hit * 40)) : s;
      B.m.scale.setScalar(k); B.m.position.y += inLogo ? 0 : k - BR;
      B.trail.forEach((g, i) => { g.scale.setScalar(k * (1 - i * 0.09)); g.position.y += k - BR; });
    }
    const sa = Math.max(0.09, c.h * 0.0052);
    avMeshes.forEach(m => { if (m.visible) { m.scale.setScalar(sa); m.position.y += sa - 0.09; } });
    const asp = 1920 / 1080;
    cam.left = -c.h * asp / 2; cam.right = c.h * asp / 2; cam.top = c.h / 2; cam.bottom = -c.h / 2; cam.updateProjectionMatrix();
    cam.position.copy(c.a).addScaledVector(c.d, 500); cam.up.set(0, 1, 0); cam.lookAt(c.a);
    const opening = t < 2.3;
    G.endLFull.visible = opening || c.d.z < 0; G.endLCut.visible = !G.endLFull.visible;
    G.end0Full.visible = opening || c.d.z >= 0; G.end0Cut.visible = !G.end0Full.visible;
    return c;
  }
  return { update, cues, people, DUR, FPS };
}
