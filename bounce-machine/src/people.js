// Simple 3D players: a jointed rig (hips, spine, neck, shoulders, elbows, wrists, hips, knees, ankles)
// built from capsules and spheres. Figures face +z; root sits on the floor.
import * as THREE from 'three';
import { rng } from './textures.js';

const D = Math.PI / 180;
const MAT = new Map();
const mat = c => { if (!MAT.has(c)) MAT.set(c, new THREE.MeshLambertMaterial({ color: c })); return MAT.get(c); };
const GEO = new Map();
const cached = (k, f) => { if (!GEO.has(k)) GEO.set(k, f()); return GEO.get(k); };
// capsule hanging down from its pivot (top at +0.6r above the pivot)
const limbGeo = (r, len) => cached(`c${r}_${len}`, () => { const g = new THREE.CapsuleGeometry(r, len, 4, 10); g.translate(0, -(len / 2 + r) + r * 0.6, 0); return g; });
const sphereGeo = r => cached(`s${r}`, () => new THREE.SphereGeometry(r, 14, 10));

export const SKIN = ['#F3CDAA', '#E6B48C', '#C98C62', '#9E6845', '#6E4630', '#4B2F22'];
export const CAST = {
  tasha: { skin: SKIN[4], hair: '#1C1410', hairStyle: 'puff', shirt: '#F0657A', bottom: '#1A2030', legs: 'leggings', shoe: '#FFFFFF', paddle: '#11ACDB' },
  walt: { skin: SKIN[0], hair: '#E4E0D8', hairStyle: 'bald', shirt: '#2E6DB4', bottom: '#CDB993', legs: 'shorts', shoe: '#F2F2F0', paddle: '#15181D', build: 1.12 },
  jess: { skin: SKIN[0], hair: '#E0B35C', hairStyle: 'pony', shirt: '#14181F', bottom: '#F7F6F2', legs: 'skirt', shoe: '#FFFFFF', paddle: '#F7F6F2', h: 0.96 },
  dev: { skin: SKIN[3], hair: '#15110E', hairStyle: 'curly', shirt: '#14181F', bottom: '#1F3A5F', legs: 'shorts', shoe: '#C9A84C', paddle: '#C9A84C', h: 1.04 },
  marge: { skin: SKIN[1], hair: '#CFCBC4', hairStyle: 'visor', shirt: '#2BB3A6', bottom: '#161B24', legs: 'leggings', shoe: '#FFFFFF', paddle: '#7B5CD6', h: 0.95 },
  kenji: { skin: SKIN[1], hair: '#121212', hairStyle: 'cap', shirt: '#C9A84C', bottom: '#3A3F47', legs: 'shorts', shoe: '#1B1F26', paddle: '#15181D' },
};
const SHIRTS = ['#11ACDB', '#F0657A', '#2BB3A6', '#C9A84C', '#14181F', '#F7F6F2', '#7B5CD6', '#E8762D', '#2E6DB4', '#9BD0E8', '#D94A4A', '#3E7D4E'];
const BOTTOMS = [['#1A2030', 'shorts'], ['#1F3A5F', 'shorts'], ['#3A3F47', 'shorts'], ['#1A2030', 'leggings'], ['#F7F6F2', 'skirt'], ['#14181F', 'skirt'], ['#CDB993', 'shorts']];
const HAIRS = ['#15110E', '#3B2A1E', '#6B4A2E', '#E0B35C', '#CFCBC4', '#8A3B22', '#121212'];
const STYLES = ['short', 'pony', 'curly', 'bald', 'cap', 'visor', 'bun', 'short'];
const PADDLES = ['#11ACDB', '#15181D', '#C9A84C', '#F0657A', '#7B5CD6', '#F7F6F2', '#2BB3A6', '#FFD100'];
export function randomSpec(seed) {
  const R = rng(seed), p = a => a[Math.floor(R() * a.length)];
  const [bottom, legs] = p(BOTTOMS);
  return { skin: p(SKIN), hair: p(HAIRS), hairStyle: p(STYLES), shirt: p(SHIRTS), bottom, legs, shoe: R() < 0.7 ? '#FFFFFF' : p(['#1B1F26', '#11ACDB', '#C9A84C']), paddle: p(PADDLES), h: 0.94 + R() * 0.12, build: 0.94 + R() * 0.16 };
}

function add(parent, geo, color, x = 0, y = 0, z = 0, s) {
  const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, z); if (s) m.scale.set(...s);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const J = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };

export function makePerson(spec, o = {}) {
  const b = spec.build || 1, hs = spec.h || 1;
  const root = new THREE.Group();
  const body = J(root, 0, 0, 0); body.scale.setScalar(hs);
  const hips = J(body, 0, 0.95, 0);
  add(hips, sphereGeo(0.15), spec.bottom, 0, 0, 0, [1.12 * b, 0.78, 0.82 * b]);
  if (spec.legs === 'skirt') add(hips, cached('skirt', () => new THREE.CylinderGeometry(0.16, 0.25, 0.24, 14, 1, true)), spec.bottom, 0, -0.1, 0);
  const spine = J(hips, 0, 0.05, 0);
  add(spine, cached('torso', () => { const g = new THREE.CapsuleGeometry(0.15, 0.24, 4, 12); g.translate(0, 0.27, 0); return g; }), spec.shirt, 0, 0, 0, [b, 1, 0.74 * b]);
  const neck = J(spine, 0, 0.5, 0);
  add(neck, limbGeo(0.045, 0.06), spec.skin, 0, 0.12, 0);
  const head = J(neck, 0, 0.1, 0);
  add(head, sphereGeo(0.115), spec.skin, 0, 0.11, 0.0);
  add(head, sphereGeo(0.03), spec.skin, 0, 0.1, 0.115); // nose: shows which way they face
  hair(head, spec);
  const arm = side => {
    const sh = J(spine, side * 0.2, 0.44, 0);
    add(sh, limbGeo(0.048, 0.2), spec.skin);
    if (spec.legs !== 'tank') add(sh, limbGeo(0.058, 0.07), spec.shirt);
    const el = J(sh, 0, -0.275, 0);
    add(el, limbGeo(0.042, 0.19), spec.skin);
    const wr = J(el, 0, -0.255, 0);
    add(wr, sphereGeo(0.048), spec.skin);
    return { sh, el, wr };
  };
  const R = arm(-1), Lf = arm(1); // right arm is -x when facing +z
  if (spec.paddle && o.paddle !== false) {
    const pad = J(R.wr, 0, -0.02, 0);
    add(pad, cached('handle', () => { const g = new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8); g.translate(0, -0.07, 0); return g; }), '#1A1E24');
    add(pad, cached('face', () => { const s = new THREE.Shape(); s.moveTo(-0.1, 0); s.lineTo(0.1, 0); s.lineTo(0.1, -0.3); s.quadraticCurveTo(0.1, -0.4, 0, -0.4); s.quadraticCurveTo(-0.1, -0.4, -0.1, -0.3); s.lineTo(-0.1, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: false }); g.translate(0, -0.12, -0.008); return g; }), spec.paddle);
    R.pad = pad;
  }
  const leg = side => {
    const hp = J(hips, side * 0.09, -0.04, 0);
    const legC = spec.legs === 'leggings' ? spec.bottom : spec.skin;
    add(hp, limbGeo(0.068, 0.32), legC);
    if (spec.legs === 'shorts') add(hp, limbGeo(0.08, 0.12), spec.bottom);
    const kn = J(hp, 0, -0.42, 0);
    add(kn, limbGeo(0.054, 0.32), legC);
    const an = J(kn, 0, -0.42, 0);
    add(an, cached('shoe', () => { const g = new THREE.BoxGeometry(0.11, 0.08, 0.27); g.translate(0, -0.03, 0.06); return g; }), spec.shoe);
    return { hp, kn, an };
  };
  const LR = leg(-1), LL = leg(1);
  const rig = { root, body, hips, spine, neck, head, R, L: Lf, LR, LL, hs };
  root.userData.rig = rig;
  return root;
}

function hair(head, spec) {
  const c = spec.hair, st = spec.hairStyle;
  const cap = cached('hcap', () => new THREE.SphereGeometry(0.123, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55));
  if (st !== 'bald') add(head, cap, c, 0, 0.125, -0.008, [1, 1, 1]);
  if (st === 'bald') add(head, cached('fringe', () => new THREE.TorusGeometry(0.105, 0.03, 6, 16, Math.PI * 1.2)), c, 0, 0.08, 0, undefined).rotation.set(Math.PI / 2, 0, Math.PI * 0.9);
  if (st === 'pony') add(head, limbGeo(0.045, 0.16), c, 0, 0.2, -0.12).rotation.x = -0.5;
  if (st === 'bun') add(head, sphereGeo(0.06), c, 0, 0.24, -0.08);
  if (st === 'puff') add(head, sphereGeo(0.1), c, 0, 0.21, -0.09);
  if (st === 'curly') for (let i = 0; i < 6; i++) add(head, sphereGeo(0.05), c, Math.cos(i) * 0.09, 0.2 + (i % 2) * 0.03, Math.sin(i) * 0.09 - 0.02);
  if (st === 'cap') { add(head, cap, '#0B1728', 0, 0.135, -0.008, [1.04, 1, 1.04]); add(head, cached('bill', () => new THREE.BoxGeometry(0.17, 0.015, 0.13)), '#0B1728', 0, 0.16, -0.17); }
  if (st === 'visor') { add(head, cached('band', () => new THREE.CylinderGeometry(0.125, 0.125, 0.05, 16, 1, true)), '#FFFFFF', 0, 0.17, 0); add(head, cached('vbill', () => new THREE.BoxGeometry(0.18, 0.012, 0.13)), '#FFFFFF', 0, 0.15, 0.17); }
}

// ------------------------------------------------------------------ poses (degrees)
// sh: [forward raise, outward], el: elbow flex, hip: thigh forward raise, kn: knee flex, pad: wrist pitch
export const POSES = {
  stand:    { lean: 3, rSh: [8, 6], rEl: 14, lSh: [6, 6], lEl: 10, rHip: 4, rKn: 6, lHip: -2, lKn: 4, pad: 0 },
  ready:    { lean: 22, rSh: [38, 14], rEl: 78, lSh: [32, 12], lEl: 72, rHip: 34, rKn: 60, lHip: 20, lKn: 52, pad: -20 },
  dinkBack: { lean: 30, rSh: [8, 18], rEl: 30, lSh: [20, 14], lEl: 60, rHip: 46, rKn: 72, lHip: -8, lKn: 30, pad: -10 },
  dink:     { lean: 38, rSh: [62, 10], rEl: 12, lSh: [-12, 20], lEl: 40, rHip: 58, rKn: 82, lHip: -16, lKn: 24, pad: -30 },
  volley:   { lean: 15, rSh: [72, 18], rEl: 58, lSh: [36, 14], lEl: 76, rHip: 32, rKn: 52, lHip: 16, lKn: 46, pad: -40 },
  volleyBack: { lean: 18, rSh: [40, 24], rEl: 100, lSh: [30, 14], lEl: 76, rHip: 32, rKn: 52, lHip: 16, lKn: 46, pad: -10 },
  overhead: { lean: -10, rSh: [168, 12], rEl: 30, lSh: [128, -6], lEl: 10, rHip: 12, rKn: 14, lHip: -18, lKn: 24, pad: 0 },
  serve:    { lean: 12, rSh: [70, 8], rEl: 16, lSh: [30, 10], lEl: 40, rHip: 26, rKn: 12, lHip: -26, lKn: 30, pad: -20 },
  celebrate: { lean: -5, rSh: [166, 24], rEl: 10, lSh: [160, 24], lEl: 16, rHip: 6, rKn: 8, lHip: -3, lKn: 6, pad: 0 },
  sit:      { lean: -6, rSh: [28, 8], rEl: 56, lSh: [24, 8], lEl: 56, rHip: 90, rKn: 92, lHip: 88, lKn: 90, pad: 0 },
  rail:     { lean: 26, rSh: [62, 10], rEl: 74, lSh: [62, 10], lEl: 74, rHip: -4, rKn: 4, lHip: 6, lKn: 8, pad: 0 },
  walk:     { lean: 4, rSh: [-16, 6], rEl: 22, lSh: [18, 6], lEl: 22, rHip: 24, rKn: 12, lHip: -18, lKn: 26, pad: 0 },
  talk:     { lean: 0, rSh: [26, 10], rEl: 84, lSh: [6, 6], lEl: 12, rHip: 2, rKn: 4, lHip: -2, lKn: 4, pad: 0 },
  wave:     { lean: 0, rSh: [150, 30], rEl: 30, lSh: [6, 6], lEl: 12, rHip: 2, rKn: 4, lHip: -2, lKn: 4, pad: 0 },
};
export function blendPose(a, b, t) {
  const o = {};
  for (const k of Object.keys(a)) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => v + (b[k][i] - v) * t) : a[k] + ((b[k] ?? a[k]) - a[k]) * t;
  return o;
}
export function setPose(person, P, extra = {}) {
  const r = person.userData.rig;
  r.spine.rotation.set(P.lean * D, (extra.twist || 0) * D, 0);
  r.head.rotation.x = -P.lean * 0.6 * D;
  r.R.sh.rotation.set(-P.rSh[0] * D, 0, -P.rSh[1] * D); r.R.el.rotation.x = -P.rEl * D;
  r.L.sh.rotation.set(-P.lSh[0] * D, 0, P.lSh[1] * D); r.L.el.rotation.x = -P.lEl * D;
  if (r.R.pad) r.R.pad.rotation.x = (P.pad || 0) * D;
  r.LR.hp.rotation.x = -P.rHip * D; r.LR.kn.rotation.x = P.rKn * D; r.LR.an.rotation.x = (P.rHip - P.rKn) * D;
  r.LL.hp.rotation.x = -P.lHip * D; r.LL.kn.rotation.x = P.lKn * D; r.LL.an.rotation.x = (P.lHip - P.lKn) * D;
  // keep the lower foot on the floor
  const drop = (hip, kn) => 0.42 * Math.cos(hip * D) + 0.42 * Math.cos((hip - kn) * D) + 0.04 + 0.07;
  r.hips.position.y = Math.max(drop(P.rHip, P.rKn), drop(P.lHip, P.lKn)) + (extra.air || 0);
  if (extra.seatY != null) r.hips.position.y = extra.seatY / r.hs;
}
// world position of the paddle face center
const _v = new THREE.Vector3();
export function paddlePoint(person) {
  const r = person.userData.rig; person.updateMatrixWorld(true);
  return r.R.pad ? r.R.pad.localToWorld(_v.set(0, -0.32, 0)).clone() : r.R.wr.getWorldPosition(new THREE.Vector3());
}
