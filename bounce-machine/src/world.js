// Bounce Pickleball — Malvern, PA. A stylized but layout-accurate model of the building.
// Units are meters. x = across the building (0 = far long wall, W = main-door wall),
// z = along the building (0 = end wall behind courts 11-14, L = end wall behind 7/5/6/4), y = up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';

export const W = 37, L = 82.6, EAVE = 6.0, RIDGE = 9.6;
// Facing the front desk from the main doors: courts 1-7 are to the right ("WEST"), 8-14 to the left ("EAST"),
// exactly as the sign over the desk says.
export const ROWS = [
  { z0: 0, z1: 18.3, courts: [4, 6, 5, 7], premium: false },
  { z0: 18.3, z1: 38.3, courts: [1, 2, 3], premium: true },
  { z0: 44.3, z1: 64.3, courts: [10, 9, 8], premium: true },
  { z0: 64.3, z1: 82.6, courts: [14, 13, 12, 11], premium: false },
];
export const MEZ = { z0: 38.3, z1: 44.3, x0: 0.3, x1: W - 8.6, y: 3.6, t: 0.35 };
export const DOOR = { z0: 39.3, z1: 43.3, h: 3.0, zc: 41.3 };
export const DESK = { x: W - 2.95, z: 41.3 };
// Stairs: two side flights rise inward (along z) behind the desk wall, meet at a landing,
// then one central flight of 10 steps climbs (toward -x) to the mezzanine.
export const STAIR = { xFront: W - 4.5, xBack: W - 5.8, landY: 1.8, zl0: 40.3, zl1: 42.3, run: 0.24, n: 10, cRun: 0.28 };
export const COURTS = {};
ROWS.forEach(r => {
  const n = r.courts.length, bw = W / n;
  r.courts.forEach((num, i) => {
    COURTS[num] = { num, cx: (i + 0.5) * bw, cz: (r.z0 + r.z1) / 2, x0: i * bw, x1: (i + 1) * bw, z0: r.z0, z1: r.z1, premium: r.premium };
  });
});
export const COLUMN_Z = Array.from({ length: 11 }, (_, k) => k * L / 10);

const MAT = new Map();
export function lam(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!MAT.has(k)) MAT.set(k, new THREE.MeshLambertMaterial(Object.assign({ color }, o)));
  return MAT.get(k);
}
export function basic(o) { return new THREE.MeshBasicMaterial(o); }
function shade(m, cast = true, receive = true) { m.castShadow = cast; m.receiveShadow = receive; return m; }
// Box UVs in meters, so textures tile at real-world scale (texture.repeat = tiles per meter).
function meterUV(g, w, h, d) {
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
  return g;
}
function box(w, h, d, mat, x, y, z, parent, o = {}) {
  const m = shade(new THREE.Mesh(meterUV(new THREE.BoxGeometry(w, h, d), w, h, d), mat), o.cast ?? true, o.receive ?? true);
  m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; parent.add(m); return m;
}
function boxGeo(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }
function quad(p, mat, uvScale = [1, 1]) { // p: 4 corners (counter-clockwise seen from the front)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, uvScale[0], 0, uvScale[0], uvScale[1], 0, 0, uvScale[0], uvScale[1], 0, uvScale[1]], 2));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
function beam(a, b, thick, mat, parent) { // box from point a to point b
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const m = shade(new THREE.Mesh(new THREE.BoxGeometry(thick, len, thick), mat));
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  parent.add(m); return m;
}

// ======================================================================
export async function buildWorld(scene, A) {
  const G = {
    env: new THREE.Group(), shell: new THREE.Group(), nearFull: new THREE.Group(), nearCut: new THREE.Group(),
    end0Full: new THREE.Group(), end0Cut: new THREE.Group(), endLFull: new THREE.Group(), endLCut: new THREE.Group(),
    roof: new THREE.Group(), trusses: new THREE.Group(),
    interior: new THREE.Group(), fgTrees: new THREE.Group(),
  };
  Object.values(G).forEach(g => scene.add(g));
  const TX = {
    banner: T.starfieldBanner(A), panel: T.barrierPanel(A), tan: T.corrugated('#CFC19B', 1), tanDark: T.corrugated('#9C8866', 2),
    roof: T.roofMetal(), stone: T.stone(), grass: T.grass(), sign: T.entranceSign(A), deskMark: T.markPanel(A),
    floor: T.floorNoise('#B3734B', ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)'], 4, [30, 60]),
    court: T.floorNoise('#4C6A7F', ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.045)'], 6, [3, 6]),
    carpet: T.floorNoise('#4D535B', ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.05)'], 8, [0.6, 0.6]),
    concrete: T.floorNoise('#C7C3B9', ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.06)'], 9, [6, 6]),
    net: T.meshGrid('rgba(18,22,28,0.95)', 8, 64), rail: T.meshGrid('rgba(250,250,250,0.9)', 16, 64), glass: T.glass(),
  };
  const M = {
    tan: new THREE.MeshLambertMaterial({ map: TX.tan }), tanDark: new THREE.MeshLambertMaterial({ map: TX.tanDark }),
    lining: lam('#1B2027'), navy: lam('#203E7C'), white: lam('#F2F1EC'), cut: lam('#E9E1CF'),
    black: lam('#121418'), floor: new THREE.MeshLambertMaterial({ map: TX.floor }),
    court: new THREE.MeshLambertMaterial({ map: TX.court, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    line: lam('#F4F2EC', { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    panel: new THREE.MeshLambertMaterial({ map: TX.panel }), banner: basic({ map: TX.banner }),
    carpet: new THREE.MeshLambertMaterial({ map: TX.carpet }), concrete: new THREE.MeshLambertMaterial({ map: TX.concrete }),
    net: new THREE.MeshLambertMaterial({ map: TX.net, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }),
    railMesh: new THREE.MeshLambertMaterial({ map: TX.rail, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
    roof: new THREE.MeshLambertMaterial({ map: TX.roof, side: THREE.DoubleSide }), stone: new THREE.MeshLambertMaterial({ map: TX.stone }),
    glass: new THREE.MeshLambertMaterial({ map: TX.glass }), ball: lam('#D8EE3A', { emissive: '#3A4400' }),
  };
  G.M = M; G.TX = TX;
  TX.tan.repeat.set(0.5, 0.5); TX.tanDark.repeat.set(0.5, 0.5); TX.stone.repeat.set(0.8, 0.8); TX.glass.repeat.set(0.25, 0.34);

  // ------------------------------------------------------------ ground & surroundings
  const ground = shade(new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshLambertMaterial({ map: TX.grass })), false, true);
  ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, -0.03, L / 2); G.env.add(ground);
  const apron = shade(new THREE.Mesh(new THREE.PlaneGeometry(W + 3, L + 3), M.concrete), false, true);
  apron.rotation.x = -Math.PI / 2; apron.position.set(W / 2, -0.01, L / 2); G.env.add(apron);
  const walk = shade(new THREE.Mesh(new THREE.PlaneGeometry(26, 2.4), M.concrete), false, true);
  walk.rotation.x = -Math.PI / 2; walk.position.set(W + 13, -0.005, DOOR.zc); G.env.add(walk);
  // shrubs: hedges along the walk + foundation planting
  const R = T.rng(21), shrubGreens = ['#466E33', '#557F3B', '#4D7636', '#3F6530'];
  const shrub = (x, z, r, parent = G.env) => {
    const m = shade(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), lam(shrubGreens[Math.floor(R() * 4)])));
    m.scale.set(1, 0.72 + R() * 0.2, 1); m.position.set(x, r * 0.55, z); parent.add(m); return m;
  };
  for (let x = W + 2.6; x < W + 20; x += 1.35) { shrub(x, DOOR.zc - 2.2 - R() * 0.3, 0.75 + R() * 0.25); shrub(x, DOOR.zc + 2.2 + R() * 0.3, 0.75 + R() * 0.25); }
  for (let z = 6; z < L - 4; z += 2.3) if (z < DOOR.z0 - 3.4 || z > DOOR.z1 + 3.4) shrub(W + 1.1, z + R() * 0.6, 0.7 + R() * 0.3);
  // picket fence in front of the left lawn
  const picket = new THREE.BoxGeometry(0.07, 1.0, 0.03), nP = 140;
  const fence = new THREE.InstancedMesh(picket, M.white, nP); fence.castShadow = true;
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < nP; i++) { mtx.makeTranslation(W + 4.2, 0.5, 12 + i * 0.16); fence.setMatrixAt(i, mtx); }
  G.env.add(fence);
  box(0.05, 0.07, nP * 0.16, M.white, W + 4.17, 0.75, 12 + nP * 0.08, G.env); box(0.05, 0.07, nP * 0.16, M.white, W + 4.17, 0.3, 12 + nP * 0.08, G.env);
  // trees
  const tree = (x, z, s, parent) => {
    const g = new THREE.Group();
    box(0.5 * s, 3.6 * s, 0.5 * s, lam('#6B4F37'), 0, 1.8 * s, 0, g);
    for (let i = 0; i < 7; i++) {
      const m = shade(new THREE.Mesh(new THREE.IcosahedronGeometry((1.8 + R() * 1.4) * s, 1), lam(['#4E7B37', '#5C8A40', '#476F33', '#66944A'][i % 4], { flatShading: true })));
      m.position.set((R() - 0.5) * 3.4 * s, (4.6 + R() * 2.6) * s, (R() - 0.5) * 3.4 * s); g.add(m);
    }
    g.position.set(x, 0, z); parent.add(g); return g;
  };
  const cone = (x, z, h, parent) => {
    const m = shade(new THREE.Mesh(new THREE.ConeGeometry(0.75, h, 10), lam('#2F5A2E', { flatShading: true })));
    m.position.set(x, h / 2, z); parent.add(m);
  };
  tree(W + 10, 22, 1.25, G.fgTrees); tree(W + 9, 63, 1.1, G.fgTrees); tree(W + 14, 4, 1.0, G.fgTrees);
  tree(-9, 8, 1.3, G.env); tree(-8, 52, 1.2, G.env); tree(-10, 30, 1.0, G.env); tree(12, -10, 1.2, G.env); tree(30, -8, 1.0, G.env); tree(18, L + 10, 1.15, G.env);
  cone(W + 1.5, DOOR.z0 - 2.4, 4.6, G.fgTrees); cone(W + 1.5, DOOR.z1 + 2.4, 4.6, G.fgTrees);

  // ------------------------------------------------------------ shell: far long wall, end walls, columns
  const wallMats = (inside, outside) => [inside, outside, M.lining, M.lining, M.lining, M.lining];
  box(0.3, EAVE, L, wallMats(M.lining, M.tan), -0.15, EAVE / 2, L / 2, G.shell);
  const gable = new THREE.Shape(); gable.moveTo(0, 0); gable.lineTo(W, 0); gable.lineTo(W, EAVE); gable.lineTo(W / 2, RIDGE); gable.lineTo(0, EAVE); gable.lineTo(0, 0);
  const gableGeo = new THREE.ExtrudeGeometry(gable, { depth: 0.3, bevelEnabled: false });
  const tanEnd = new THREE.MeshLambertMaterial({ map: T.corrugated('#CFC19B', 3) }); tanEnd.map.repeat.set(0.5, 0.5);
  const lining = new THREE.Mesh(new THREE.ShapeGeometry(gable), M.lining);
  const endWall = (z, inner) => {
    const g = new THREE.Group();
    g.add(shade(new THREE.Mesh(gableGeo, [tanEnd, tanEnd])));
    const ln = lining.clone(); ln.position.z = inner > 0 ? 0.31 : -0.01; if (inner < 0) ln.rotation.y = Math.PI, ln.position.x = W; g.add(ln);
    const bn = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.0, 4.4), M.banner);
    bn.position.set(W / 2, 3.65, inner > 0 ? 0.33 : -0.03); if (inner < 0) bn.rotation.y = Math.PI; g.add(bn);
    g.position.z = z; return g;
  };
  // both end walls carry the identical starfield banner; each has a full and a cutaway version
  G.end0Full.add(endWall(-0.3, 1));           // z = 0, behind courts 4/6/5/7
  G.endLFull.add(endWall(L, -1));             // z = L, behind courts 14/13/12/11
  box(W, 1.1, 0.3, [M.lining, M.lining, M.cut, M.lining, M.tan, M.lining], W / 2, 0.55, L + 0.15, G.endLCut);
  box(W, 1.1, 0.3, [M.lining, M.lining, M.cut, M.lining, M.lining, M.tan], W / 2, 0.55, -0.15, G.end0Cut);
  { // where the logo (and the ball cut-out in its "B") sits on the z = L banner, in world space
    const w = 4096, h = 560, lh = h * 0.44, lw = lh * 1879 / 575, X0 = w * 0.62 - lw / 2, Y0 = h * 0.25;
    const toX = u => W / 2 - (u / w - 0.5) * (W - 1.0), toY = v => 3.65 + 4.4 * (0.5 - v / h);
    G.holeL = { x: toX(X0 + (303 - 42) / 1879 * lw), y: toY(Y0 + (124 - 38) / 575 * lh), z: L - 0.04, r: 55 / 575 * lh / h * 4.4 };
    G.logoL = { x: toX(X0 + lw / 2), y: toY(Y0 + lh / 2), w: lw / w * (W - 1.0), h: lh / h * 4.4 };
    const lc = T.canvas(1879, 575); lc.getContext('2d').drawImage(A.logo, 42, 38, 1879, 575, 0, 0, 1879, 575);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(G.logoL.w, G.logoL.h), new THREE.MeshBasicMaterial({ map: T.tex(lc), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(G.logoL.x, G.logoL.y, L - 0.06); glow.rotation.y = Math.PI; G.endLFull.add(glow); G.logoGlow = glow;
    G.rings = [0, 1, 2].map(() => {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: '#9FE3F7', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      r.position.set(G.holeL.x, G.holeL.y, L - 0.07); r.rotation.y = Math.PI; G.endLFull.add(r); return r;
    });
  }
  for (const z of COLUMN_Z) {
    const zc = Math.min(Math.max(z, 0.4), L - 0.4), atDoor = zc > DOOR.z0 - 1 && zc < DOOR.z1 + 1;
    box(0.4, EAVE, 0.4, M.navy, 0.35, EAVE / 2, zc, G.shell);
    if (!atDoor) { box(0.4, EAVE, 0.4, M.navy, W - 0.35, EAVE / 2, zc, G.nearFull); box(0.4, 1.1, 0.4, M.navy, W - 0.35, 0.55, zc, G.nearCut); }
    beam([0.35, EAVE, z], [W / 2, RIDGE - 0.45, z], 0.32, M.navy, G.trusses);
    beam([W - 0.35, EAVE, z], [W / 2, RIDGE - 0.45, z], 0.32, M.navy, G.trusses);
  }
  beam([W / 2, RIDGE - 0.45, 0], [W / 2, RIDGE - 0.45, L], 0.3, M.navy, G.trusses);

  // ------------------------------------------------------------ near long wall (main doors) — full and cutaway versions
  const nearMats = [M.tan, M.lining, M.lining, M.lining, M.lining, M.lining];
  box(0.3, EAVE, DOOR.z0, nearMats, W + 0.15, EAVE / 2, DOOR.z0 / 2, G.nearFull);
  box(0.3, EAVE, L - DOOR.z1, nearMats, W + 0.15, EAVE / 2, (L + DOOR.z1) / 2, G.nearFull);
  box(0.3, EAVE - DOOR.h, DOOR.z1 - DOOR.z0, nearMats, W + 0.15, (EAVE + DOOR.h) / 2, DOOR.zc, G.nearFull);
  box(0.06, 1.0, L, M.tanDark, W + 0.33, 0.5, L / 2, G.nearFull);
  // storefront: glass, mullions, double doors
  const glassPane = box(0.06, DOOR.h, DOOR.z1 - DOOR.z0, M.glass, W + 0.1, DOOR.h / 2, DOOR.zc, G.nearFull, { cast: false });
  const bronze = lam('#3A3530');
  for (let z = DOOR.z0; z <= DOOR.z1 + 0.01; z += (DOOR.z1 - DOOR.z0) / 4) box(0.12, DOOR.h, 0.1, bronze, W + 0.16, DOOR.h / 2, z, G.nearFull);
  box(0.12, 0.1, DOOR.z1 - DOOR.z0, bronze, W + 0.16, 2.35, DOOR.zc, G.nearFull);
  box(0.12, 0.12, DOOR.z1 - DOOR.z0, bronze, W + 0.16, DOOR.h - 0.05, DOOR.zc, G.nearFull);
  box(0.14, 0.05, 0.5, lam('#C8C8C8'), W + 0.24, 1.05, DOOR.zc - 0.35, G.nearFull); box(0.14, 0.05, 0.5, lam('#C8C8C8'), W + 0.24, 1.05, DOOR.zc + 0.35, G.nearFull);
  // stone pillars + blue fascia canopy with the sign
  box(1.0, 3.3, 1.0, M.stone, W + 0.45, 1.65, DOOR.z0 - 0.55, G.nearFull); box(1.0, 3.3, 1.0, M.stone, W + 0.45, 1.65, DOOR.z1 + 0.55, G.nearFull);
  box(1.7, 0.85, DOOR.z1 - DOOR.z0 + 3.6, lam('#2352AA'), W + 0.75, 3.62, DOOR.zc, G.nearFull);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.74), basic({ map: TX.sign }));
  sign.position.set(W + 1.61, 3.62, DOOR.zc); sign.rotation.y = Math.PI / 2; G.nearFull.add(sign);
  // cutaway version of the near wall (dollhouse cut at 1.1 m, door gap kept)
  const cutMats = [M.tan, M.lining, M.cut, M.lining, M.lining, M.lining];
  box(0.3, 1.1, DOOR.z0, cutMats, W + 0.15, 0.55, DOOR.z0 / 2, G.nearCut);
  box(0.3, 1.1, L - DOOR.z1, cutMats, W + 0.15, 0.55, (L + DOOR.z1) / 2, G.nearCut);
  box(1.0, 1.1, 1.0, M.stone, W + 0.45, 0.55, DOOR.z0 - 0.55, G.nearCut); box(1.0, 1.1, 1.0, M.stone, W + 0.45, 0.55, DOOR.z1 + 0.55, G.nearCut);

  // ------------------------------------------------------------ roof
  const ov = 0.6, ex = 0.5;
  const left = quad([[-ov, EAVE - 0.12, L + ex], [-ov, EAVE - 0.12, -ex], [W / 2, RIDGE, -ex], [W / 2, RIDGE, L + ex]], M.roof, [L / 1.2, 1]);
  const right = quad([[W + ov, EAVE - 0.12, -ex], [W + ov, EAVE - 0.12, L + ex], [W / 2, RIDGE, L + ex], [W / 2, RIDGE, -ex]], M.roof, [L / 1.2, 1]);
  G.roofL = new THREE.Group(); G.roofR = new THREE.Group(); G.roof.add(G.roofL, G.roofR);
  G.roofL.add(shade(left)); G.roofR.add(shade(right));
  beam([-ov, EAVE - 0.18, -ex], [-ov, EAVE - 0.18, L + ex], 0.22, lam('#E6E6E2'), G.roofL);
  beam([W + ov, EAVE - 0.18, -ex], [W + ov, EAVE - 0.18, L + ex], 0.22, lam('#E6E6E2'), G.roofR);

  // ------------------------------------------------------------ interior floor, courts, lines, nets
  const floor = shade(new THREE.Mesh(new THREE.PlaneGeometry(W, L), M.floor), false, true);
  floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0.002, L / 2); G.interior.add(floor);
  const courtGeos = [], lineGeos = [], lw = 0.075;
  const line = (x, z, w, d) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, 0.012, z); lineGeos.push(g); };
  for (const c of Object.values(COURTS)) {
    const cg = new THREE.PlaneGeometry(6.1 + (c.premium ? 0.0 : 0), 13.41); cg.rotateX(-Math.PI / 2); cg.translate(c.cx, 0.006, c.cz); courtGeos.push(cg);
    line(c.cx - 3.05, c.cz, lw, 13.41); line(c.cx + 3.05, c.cz, lw, 13.41);
    line(c.cx, c.cz - 6.705, 6.1 + lw, lw); line(c.cx, c.cz + 6.705, 6.1 + lw, lw);
    line(c.cx, c.cz - 2.13, 6.1, lw); line(c.cx, c.cz + 2.13, 6.1, lw);
    line(c.cx, c.cz - 4.42, lw, 4.575); line(c.cx, c.cz + 4.42, lw, 4.575);
  }
  G.interior.add(shade(new THREE.Mesh(mergeGeometries(courtGeos), M.court), false, true));
  G.interior.add(shade(new THREE.Mesh(mergeGeometries(lineGeos), M.line), false, true));
  const netGeo = new THREE.PlaneGeometry(6.7, 0.84); TX.net.repeat.set(20, 2.5);
  const tapeGeo = new THREE.BoxGeometry(6.75, 0.07, 0.025), postGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8);
  G.nets = {};
  for (const c of Object.values(COURTS)) {
    const g = new THREE.Group(); g.position.set(c.cx, 0, c.cz);
    const n = new THREE.Mesh(netGeo, M.net); n.position.y = 0.5; g.add(n);
    const tp = shade(new THREE.Mesh(tapeGeo, M.white)); tp.position.y = 0.9; g.add(tp);
    for (const sx of [-3.4, 3.4]) { const p = shade(new THREE.Mesh(postGeo, M.black)); p.position.set(sx, 0.475, 0); g.add(p); box(0.06, 0.05, 0.9, M.black, sx, 0.03, 0, g); }
    box(6.8, 0.04, 0.05, M.black, 0, 0.06, 0, g);
    G.interior.add(g); G.nets[c.num] = g;
  }

  // ------------------------------------------------------------ JOOLA barrier panels (instanced)
  const segs = [];
  const addLine = (x0, z0, x1, z1, gapAt = []) => segs.push({ x0, z0, x1, z1, gapAt });
  for (const r of ROWS) {
    const n = r.courts.length, bw = W / n;
    for (let i = 0; i <= n; i++) { const x = i === 0 ? 0.55 : i === n ? W - 0.75 : i * bw; addLine(x, r.z0 + 0.3, x, r.z1 - 0.3, [r.z0 + 1.4]); }
  }
  for (const z of [0.5, 18.3, 64.3, L - 0.5]) addLine(0.6, z, W - 0.8, z);
  for (const z of [37.6, 45.0]) addLine(0.6, z, MEZ.x1 + 0.4, z, Array.from({ length: 3 }, (_, k) => (k + 0.5) * W / 3));
  const panels = [];
  for (const s of segs) {
    const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0), n = Math.max(1, Math.round(len / 2.45)), pl = len / n;
    const ang = Math.atan2(s.z1 - s.z0, s.x1 - s.x0);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = s.x0 + (s.x1 - s.x0) * u, z = s.z0 + (s.z1 - s.z0) * u;
      if (s.gapAt.some(gp => Math.abs((s.x1 === s.x0 ? z : x) - gp) < pl * 0.6)) continue;
      panels.push({ x, z, ang, len: pl - 0.08 });
    }
  }
  const pGeo = new THREE.BoxGeometry(1, 0.75, 0.05);
  const pMesh = new THREE.InstancedMesh(pGeo, [M.black, M.black, M.black, M.black, M.panel, M.panel], panels.length);
  pMesh.castShadow = true; pMesh.receiveShadow = true;
  const q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  panels.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -p.ang); pos.set(p.x, 0.375, p.z); scl.set(p.len, 1, 1);
    mtx.compose(pos, q, scl); pMesh.setMatrixAt(i, mtx);
  });
  G.interior.add(pMesh);
  G.panelCount = panels.length; G.panels = panels;
  const qy = new THREE.Quaternion(), qx = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3(1, 0, 0);
  G.tiltPanel = (i, a) => { // flex a barrier panel about its base (used as a pinball bumper)
    const p = panels[i]; qy.setFromAxisAngle(UP, -p.ang); qx.setFromAxisAngle(AX, a);
    const off = new THREE.Vector3(0, 0.375 * Math.cos(a), 0.375 * Math.sin(a)).applyQuaternion(qy);
    pos.set(p.x, 0, p.z).add(off); scl.set(p.len, 1, 1); mtx.compose(pos, qy.clone().multiply(qx), scl);
    pMesh.setMatrixAt(i, mtx); pMesh.instanceMatrix.needsUpdate = true;
  };
  G.nearestPanel = (x, z) => { let bi = 0, bd = 1e9; panels.forEach((p, i) => { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; bi = i; } }); return bi; };

  // court number plaques (orange, like the real ones)
  for (const c of Object.values(COURTS)) {
    const g = new THREE.Group(); g.position.set(c.x1 - 0.9, 0, c.z1 - 0.9);
    box(0.06, 2.1, 0.06, M.black, 0, 1.05, 0, g);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), basic({ map: T.plaque(c.num) }));
    pl.position.set(0, 2.2, 0); pl.rotation.y = Math.PI / 4; g.add(pl);
    const bk = pl.clone(); bk.rotation.y = Math.PI / 4 + Math.PI; bk.position.set(-0.004, 2.2, -0.004); g.add(bk);
    G.interior.add(g);
  }

  // ------------------------------------------------------------ mezzanine, lobby, stairs, front desk
  const mz = MEZ, dz = mz.z1 - mz.z0;
  box(mz.x1 - 0.6, mz.y - mz.t, dz - 0.5, [M.lining, M.lining, M.lining, M.lining, lam('#262B33'), lam('#262B33')], (mz.x1 + 0.3) / 2, (mz.y - mz.t) / 2, (mz.z0 + mz.z1) / 2, G.interior);
  const doorMat = lam('#4A505A');
  for (const x of [4, 10.5, 17, 23.5]) for (const z of [mz.z0 + 0.24, mz.z1 - 0.24]) box(1.1, 2.15, 0.03, doorMat, x, 1.08, z, G.interior, { cast: false });
  const chair = lam('#2A5DA8');
  for (const x of [6.5, 7.2, 13.5, 14.2, 20, 20.7]) for (const z of [mz.z0 + 0.05, mz.z1 - 0.05]) box(0.5, 0.45, 0.45, chair, x, 0.23, z, G.interior);
  box(mz.x1 - mz.x0, mz.t, dz, [M.white, M.white, M.carpet, M.white, M.white, M.white], (mz.x0 + mz.x1) / 2, mz.y - mz.t / 2, (mz.z0 + mz.z1) / 2, G.interior);
  // lobby floor + mat
  const lob = shade(new THREE.Mesh(new THREE.PlaneGeometry(W - mz.x1, dz), lam('#5B6168')), false, true);
  lob.rotation.x = -Math.PI / 2; lob.position.set((W + mz.x1) / 2, 0.01, (mz.z0 + mz.z1) / 2); G.interior.add(lob);
  box(1.4, 0.02, 2.6, lam('#2A2D33'), W - 0.9, 0.02, DOOR.zc, G.interior, { cast: false });
  // railings
  const railing = (x0, z0, x1, z1, y, parent) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), n = Math.max(1, Math.round(len / 1.3));
    const g = new THREE.Group(); g.position.set(x0, y, z0); g.rotation.y = -ang;
    for (let i = 0; i <= n; i++) box(0.06, 1.05, 0.06, M.white, i * len / n, 0.52, 0, g);
    box(len, 0.08, 0.09, M.white, len / 2, 1.06, 0, g); box(len, 0.04, 0.04, M.white, len / 2, 0.12, 0, g);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), M.railMesh); mesh.position.set(len / 2, 0.58, 0); g.add(mesh);
    parent.add(g); return g;
  };
  TX.rail.repeat.set(14, 1.5);
  railing(mz.x0, mz.z0 + 0.05, mz.x1, mz.z0 + 0.05, mz.y, G.interior);
  railing(mz.x0, mz.z1 - 0.05, mz.x1, mz.z1 - 0.05, mz.y, G.interior);
  railing(mz.x1 - 0.05, mz.z0 + 0.1, mz.x1 - 0.05, STAIR.zl0 - 0.05, mz.y, G.interior);
  railing(mz.x1 - 0.05, STAIR.zl1 + 0.05, mz.x1 - 0.05, mz.z1 - 0.1, mz.y, G.interior);
  // ---- the staircase: side flights rise inward from left and right, meet behind the desk, last 10 steps go up the middle
  const S = STAIR, stepMat = lam('#D9DADC'), rise = S.landY / S.n, cRise = (mz.y - S.landY) / S.n;
  const sGeos = [];
  for (let i = 0; i < S.n; i++) {
    const top = (i + 1) * rise;
    sGeos.push(boxGeo(S.xFront - S.xBack, top, S.run + 0.01, (S.xFront + S.xBack) / 2, top / 2, S.zl0 - S.n * S.run + (i + 0.5) * S.run));
    sGeos.push(boxGeo(S.xFront - S.xBack, top, S.run + 0.01, (S.xFront + S.xBack) / 2, top / 2, S.zl1 + S.n * S.run - (i + 0.5) * S.run));
  }
  sGeos.push(boxGeo(S.xFront - S.xBack, S.landY, S.zl1 - S.zl0, (S.xFront + S.xBack) / 2, S.landY / 2, (S.zl0 + S.zl1) / 2));
  for (let i = 0; i < S.n; i++) {
    const top = S.landY + (i + 1) * cRise;
    sGeos.push(boxGeo(S.cRun + 0.01, top, S.zl1 - S.zl0, S.xBack - (i + 0.5) * S.cRun, top / 2, (S.zl0 + S.zl1) / 2));
  }
  G.interior.add(shade(new THREE.Mesh(mergeGeometries(sGeos), stepMat)));
  G.stairPath = { // for the animation: bottom of each side flight, the landing, the top
    left: [(S.xFront + S.xBack) / 2, 0, S.zl0 - S.n * S.run], right: [(S.xFront + S.xBack) / 2, 0, S.zl1 + S.n * S.run],
    landing: [(S.xFront + S.xBack) / 2, S.landY, DOOR.zc], top: [mz.x1, mz.y, DOOR.zc],
  };
  const slopeRail = (a, b, parent = G.interior) => {
    const g = new THREE.Group();
    beam([a[0], a[1] + 1.0, a[2]], [b[0], b[1] + 1.0, b[2]], 0.07, M.white, g);
    beam([a[0], a[1] + 0.5, a[2]], [b[0], b[1] + 0.5, b[2]], 0.035, M.white, g);
    const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.8));
    for (let i = 0; i <= n; i++) { const u = i / n; box(0.05, 1.0, 0.05, M.white, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + 0.5, a[2] + (b[2] - a[2]) * u, g); }
    parent.add(g);
  };
  const zLb = S.zl0 - S.n * S.run, zRb = S.zl1 + S.n * S.run;
  for (const x of [S.xFront - 0.04, S.xBack + 0.04]) {
    slopeRail([x, 0, zLb], [x, S.landY, S.zl0]); slopeRail([x, 0, zRb], [x, S.landY, S.zl1]);
  }
  slopeRail([S.xBack, S.landY, S.zl0 + 0.04], [mz.x1, mz.y, S.zl0 + 0.04]); slopeRail([S.xBack, S.landY, S.zl1 - 0.04], [mz.x1, mz.y, S.zl1 - 0.04]);
  // ---- the desk wall: whitewashed shiplap, TV, the check-in sign; its top is the landing's front wall
  const shipTx = T.shiplap(); shipTx.repeat.set(0.52, 0.52);
  const shipM = new THREE.MeshLambertMaterial({ map: shipTx });
  const wallH = S.landY + 1.05, wz0 = S.zl0 - 0.7, wz1 = S.zl1 + 0.7;
  box(0.14, wallH, wz1 - wz0, [shipM, shipM, lam('#2A2D31'), shipM, shipM, shipM], S.xFront + 0.07, wallH / 2, (wz0 + wz1) / 2, G.interior);
  box(0.22, 0.08, wz1 - wz0 + 0.04, lam('#2A2D31'), S.xFront + 0.07, wallH + 0.04, (wz0 + wz1) / 2, G.interior);
  const decal = (w, h, map, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic({ map })); m.position.set(S.xFront + 0.15, y, z); m.rotation.y = Math.PI / 2; G.interior.add(m); return m; };
  decal(3.3, 0.97, T.deskSign(A), wallH - 0.6, DOOR.zc);
  box(0.06, 0.66, 1.12, M.black, S.xFront + 0.17, 1.55, DOOR.zc + 0.15, G.interior);
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.6), basic({ map: T.tvScreen() })); tv.position.set(S.xFront + 0.205, 1.55, DOOR.zc + 0.15); tv.rotation.y = Math.PI / 2; G.interior.add(tv);
  decal(0.36, 0.5, T.lobDinkSmash(), 1.08, wz1 - 0.5);
  decal(0.36, 0.44, TX.deskMark, 1.56, wz1 - 0.5);
  // ---- the front desk: dark front, chunky wood top
  const desk = new THREE.Group(); desk.position.set(DESK.x, 0, DESK.z);
  const woodTx = T.woodTop(); woodTx.repeat.set(0.5, 1);
  box(0.8, 1.02, 3.8, lam('#34373C'), 0, 0.51, 0, desk);
  box(1.0, 0.09, 3.95, new THREE.MeshLambertMaterial({ map: woodTx }), 0.02, 1.07, 0, desk);
  box(0.42, 0.3, 0.6, lam('#2B2E33'), -0.1, 1.27, -0.9, desk);                       // laptop
  const lamp = shade(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), lam('#E23B2E', { emissive: '#7A1010' }))); lamp.position.set(-0.05, 1.2, -1.35); desk.add(lamp);
  box(0.14, 0.24, 0.14, lam('#F08A24'), 0.1, 1.24, -1.65, desk);                     // pumpkin-orange planter
  const bell = new THREE.Group(); bell.position.set(0.12, 1.115, 0.75); desk.add(bell);
  const bellBase = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.02, 20), lam('#2A2A2A'))); bellBase.position.y = 0.01; bell.add(bellBase);
  const dome = shade(new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam('#D8DCE0', { emissive: '#30343A' }))); dome.position.y = 0.02; bell.add(dome);
  const knob = shade(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), lam('#C8CCD0'))); knob.position.y = 0.085; bell.add(knob);
  G.bell = bell; G.bellDome = dome;
  G.interior.add(desk); G.desk = desk;
  // the BOUNCE ball kiosk at the top of the stairs
  const kiosk = new THREE.Group(); kiosk.position.set(mz.x1 - 1.0, mz.y, S.zl1 + 1.0);
  box(0.55, 1.75, 0.55, M.white, 0, 0.875, 0, kiosk);
  const km = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), basic({ map: TX.deskMark })); km.position.set(0.28, 1.0, 0); km.rotation.y = Math.PI / 2; kiosk.add(km);
  for (let i = 0; i < 8; i++) { const b = shade(new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), M.ball)); b.position.set(0.3, 0.25 + (i % 4) * 0.12 + (i > 3 ? 1.2 : 0), -0.12 + (i % 2) * 0.24); kiosk.add(b); }
  G.interior.add(kiosk); G.kiosk = kiosk;
  // lounge: the curved green velvet sofa around a round white table
  const sector = (rIn, rOut, a0, a1, h, mat) => {
    const s = new THREE.Shape(); s.absarc(0, 0, rOut, a0, a1, false); s.absarc(0, 0, rIn, a1, a0, true);
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 40 }); g.rotateX(-Math.PI / 2);
    return shade(new THREE.Mesh(g, mat));
  };
  const lounge = new THREE.Group(); lounge.position.set(20.5, mz.y, DOOR.zc);
  const velvet = lam('#46603F');
  lounge.add(sector(1.05, 1.68, 0.55, Math.PI * 2 - 0.55, 0.45, velvet));
  lounge.add(sector(1.5, 1.78, 0.55, Math.PI * 2 - 0.55, 0.95, lam('#3D553A')));
  const tbl = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 32), M.white)); tbl.position.y = 0.58; lounge.add(tbl);
  box(0.12, 0.55, 0.12, M.white, 0, 0.28, 0, lounge);
  G.cups = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + 0.3, c = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.036, 0.13, 12), lam('#D32F2F')));
    c.position.set(Math.cos(a) * 0.38, 0.61 + 0.065, Math.sin(a) * 0.38); c.userData.base = c.position.clone(); lounge.add(c); G.cups.push(c);
  }
  G.interior.add(lounge); G.lounge = lounge;
  // high-tops along the railings
  for (const x of [9, 13, 25]) for (const z of [mz.z0 + 0.75, mz.z1 - 0.75]) {
    const t = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 20), M.white)); t.position.set(x, mz.y + 1.05, z); G.interior.add(t);
    box(0.06, 1.05, 0.06, M.black, x, mz.y + 0.52, z, G.interior);
  }
  // pro shop booth (white, windowed, paddle wall inside)
  const shop = new THREE.Group(); shop.position.set(6.2, mz.y, DOOR.zc);
  box(5.4, 2.5, 3.9, M.white, 0, 1.25, 0, shop); box(5.7, 0.16, 4.2, M.white, 0, 2.56, 0, shop);
  const win = (w, h, x, y, z, ry, seed) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic({ map: T.shopWindow(seed) })); m.position.set(x, y, z); m.rotation.y = ry; shop.add(m); };
  win(1.4, 1.0, 2.71, 1.5, -1.0, Math.PI / 2, 1); win(1.4, 1.0, 2.71, 1.5, 1.0, Math.PI / 2, 2);
  win(1.4, 1.0, -1.2, 1.5, 1.96, 0, 3); win(1.4, 1.0, 1.2, 1.5, 1.96, 0, 4); win(1.4, 1.0, -1.2, 1.5, -1.96, Math.PI, 5); win(1.4, 1.0, 1.2, 1.5, -1.96, Math.PI, 6);
  G.interior.add(shop);

  // ball hoppers (one is the court-3 avalanche)
  G.hoppers = {};
  const hopper = (x, z, key, nBalls = 34) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.55, 14, 1, true), M.net); basket.position.y = 0.72; g.add(basket);
    const rim = shade(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 20), M.black)); rim.rotation.x = Math.PI / 2; rim.position.y = 1.0; g.add(rim);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(0.03, 0.5, 0.03, M.black, dx, 0.25, dz, g);
    const Rb = T.rng(x * 13 + z);
    for (let i = 0; i < nBalls; i++) {
      const b = shade(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.ball));
      const a = Rb() * Math.PI * 2, r = Math.sqrt(Rb()) * 0.22; b.position.set(Math.cos(a) * r, 0.55 + Rb() * 0.45, Math.sin(a) * r); g.add(b);
    }
    G.interior.add(g); if (key) G.hoppers[key] = g; return g;
  };
  { // court 3's hopper sits just behind the baseline; it tips over onto the front row
    const hp = hopper(COURTS[3].cx + 2.75, COURTS[3].cz - 7.9, 'c3', 40);
    G.interior.remove(hp); const pivot = new THREE.Group(); pivot.position.set(hp.position.x, 0, hp.position.z - 0.26);
    hp.position.set(0, 0, 0.26); pivot.add(hp); G.interior.add(pivot); G.hopperPivot = pivot;
    G.hopperBalls = hp.children.filter(c => c.geometry && c.geometry.type === 'SphereGeometry');
    G.hopperRim = new THREE.Vector3(pivot.position.x, 1.0, pivot.position.z + 0.26);
  }
  hopper(COURTS[9].cx - 4.2, COURTS[9].cz - 6.4, 'c9', 20);
  hopper(COURTS[12].cx + 3.6, COURTS[12].cz + 7.4, 'c12', 20);

  // ------------------------------------------------------------ the fabric ceiling (draped liner; can gather toward the far wall)
  const NX = 90, NZ = 160;
  const cg = new THREE.PlaneGeometry(1, 1, NX, NZ);
  const ceiling = new THREE.Mesh(cg, lam('#F3F3F1', { side: THREE.DoubleSide, emissive: '#2E2E2C' }));
  ceiling.receiveShadow = true; G.interior.add(ceiling); G.ceiling = ceiling;
  G.setCeiling = open => {
    const p = cg.attributes.position, xe = W * (1 - open) + 1.6 * open;
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const u = i / NX, v = j / NZ, idx = j * (NX + 1) + i;
      const x = u * xe, z = v * L;
      const roofY = EAVE + (RIDGE - EAVE) * (1 - Math.abs(x - W / 2) / (W / 2)) - 0.45;
      const bay = (z / (L / 10)) % 1, sag = 0.9 * Math.sin(Math.PI * bay) * (1 - open * 0.6);
      const swag = open * 0.55 * Math.pow(Math.sin(Math.PI * ((z / 2.75) % 1)), 2); // scalloped valance
      p.setXYZ(idx, x + 0.3 * open, roofY - sag - open * (0.25 + 0.8 * u * u) - swag * u, z);
    }
    p.needsUpdate = true; cg.computeVertexNormals();
  };
  G.setCeiling(0);
  return G;
}
