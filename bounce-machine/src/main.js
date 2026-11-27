// The Bounce Machine — scene setup. Views: #exterior, #cutaway, #plan
import * as THREE from 'three';
import { buildWorld, W, L, COURTS, MEZ, DOOR, DESK, STAIRS } from './world.js';
import { makePerson, setPose, POSES, CAST, randomSpec } from './people.js';
import * as T from './textures.js';

const MODE = (location.hash || '#cutaway').slice(1);
const glc = document.getElementById('gl'), ov = document.getElementById('ov'), octx = ov.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(1920, 1080, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 3000);
function frame(target, dir, height, up = [0, 1, 0]) {
  const a = 1920 / 1080;
  cam.left = -height * a / 2; cam.right = height * a / 2; cam.top = height / 2; cam.bottom = -height / 2;
  cam.updateProjectionMatrix();
  const d = new THREE.Vector3(...dir).normalize();
  cam.position.set(...target).addScaledVector(d, 500); cam.up.set(...up); cam.lookAt(...target);
}

// lights: soft sky + one warm sun with soft shadows
scene.add(new THREE.HemisphereLight('#E6EFFF', '#9C8A70', 1.4));
scene.add(new THREE.AmbientLight('#FFFFFF', 0.25));
const sun = new THREE.DirectionalLight('#FFF3E0', 2.5);
sun.position.set(W / 2 + 45, 95, L / 2 + 35); sun.target.position.set(W / 2, 0, L / 2);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 400 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun, sun.target);

let G, SKY;
const people = [];
function place(spec, pose, x, y, z, faceDeg, extra = {}) {
  const p = makePerson(spec, extra); p.position.set(x, y, z); p.rotation.y = faceDeg * Math.PI / 180;
  setPose(p, POSES[pose], extra); G.interior.add(p); people.push(p); return p;
}

function populate() {
  const R = T.rng(77); let seed = 500;
  const pick = a => a[Math.floor(R() * a.length)];
  // featured cast on specific courts; null = a random member
  const busy = { 1: 4, 2: 4, 4: 2, 5: 4, 6: 4, 7: 2, 8: 4, 9: 4, 10: 4, 11: 2, 13: 4 };
  const featured = { 1: ['tasha', 'kenji'], 9: ['dev', 'marge'], 6: ['walt'], 13: ['jess'] };
  for (const [num, n] of Object.entries(busy)) {
    const c = COURTS[num], f = featured[num] || [];
    for (let k = 0; k < n; k++) {
      const side = k % 2 === 0 ? -1 : 1, lane = n === 2 ? 0 : (k < 2 ? -1 : 1);
      const atNet = R() < 0.6;
      const x = c.cx + lane * 1.5 + (R() - 0.5) * 0.5, z = c.cz + side * (atNet ? 2.6 : 6.0) + (R() - 0.5) * 0.4;
      const pose = atNet ? pick(['ready', 'dink', 'volley', 'dinkBack', 'volleyBack']) : pick(['ready', 'serve', 'ready', 'overhead']);
      const spec = f[k] ? CAST[f[k]] : randomSpec(seed++);
      place(spec, pose, x, 0, z, (side < 0 ? 0 : 180) + (R() - 0.5) * 24);
    }
  }
  // court 3: a clinic — coach by the ball hopper, three students across the net
  const c3 = COURTS[3];
  place(randomSpec(seed++), 'talk', c3.cx + 1.8, 0, c3.cz + 4.6, 200);
  [-1.8, 0, 1.8].forEach(dx => place(randomSpec(seed++), 'ready', c3.cx + dx, 0, c3.cz - 2.8, 0));
  // mezzanine lounge: four on the sofa, people at both railings, two at a high-top
  const lx = 20.5, lz = DOOR.zc, my = MEZ.y;
  [100, 160, 210, 260].forEach((a, i) => {
    const r = 1.32, ang = a * Math.PI / 180, x = lx + Math.cos(ang) * r, z = lz - Math.sin(ang) * r;
    const face = Math.atan2(lx - x, lz - z) * 180 / Math.PI;
    place(randomSpec(seed++), 'sit', x, my, z, face, { seatY: 0.47, paddle: false });
  });
  [[11.5, -1], [16, -1], [23.5, -1], [14.5, 1], [18.5, 1], [26.5, 1]].forEach(([x, s]) =>
    place(randomSpec(seed++), 'rail', x, my, s < 0 ? MEZ.z0 + 0.5 : MEZ.z1 - 0.5, s < 0 ? 180 : 0, { paddle: false }));
  place(randomSpec(seed++), 'talk', 9.6, my, MEZ.z0 + 1.4, 160, { paddle: false });
  place(randomSpec(seed++), 'talk', 8.5, my, MEZ.z0 + 0.9, 40, { paddle: false });
  place(randomSpec(seed++), 'stand', 8.0, my, DOOR.zc + 1.4, -90, { paddle: false });
  // lobby: staff at the front desk, members arriving
  place(randomSpec(seed++), 'talk', DESK.x - 0.75, 0, DESK.z + 0.3, 90, { paddle: false });
  place(randomSpec(seed++), 'walk', W - 1.7, 0, DOOR.zc - 0.8, -90);
  place(randomSpec(seed++), 'wave', W - 2.2, 0, DOOR.zc + 1.1, -90);
}

const VIEWS = {
  exterior: () => frame([W + 1, 3.2, DOOR.zc - 3], [1.0, 0.42, 0.55], 24),
  cutaway: () => frame([W / 2 + 1.5, 0, L / 2 - 1.5], [0.95, 1.18, 0.5], 64),
  close: () => frame([24, 2.6, 46], [0.9, 0.75, 0.75], 15),
  plan: () => frame([W / 2, 0, L / 2], [0, 1, 0.00001], 56, [-1, 0, 0]),
};
function applyMode(mode) {
  const ext = mode === 'exterior', plan = mode === 'plan';
  if (mode === 'close') mode = 'cutaway';
  G.roof.visible = ext; G.nearFull.visible = ext; G.endFull.visible = ext;
  G.nearCut.visible = !ext; G.endCut.visible = !ext;
  G.trusses.visible = false; G.fgTrees.visible = ext;
  G.ceiling.visible = mode === 'cutaway'; G.setCeiling(0.94);
  scene.background = plan ? new THREE.Color('#E9E7E2') : SKY;
  VIEWS[MODE]();
}

function label(text, p, o = {}) {
  const v = new THREE.Vector3(...p).project(cam);
  const x = (v.x + 1) / 2 * 1920, y = (1 - v.y) / 2 * 1080;
  octx.save();
  octx.font = `${o.weight || 700} ${o.size || 44}px Jost`; octx.textAlign = 'center'; octx.textBaseline = 'middle';
  octx.lineWidth = o.stroke ?? 8; octx.strokeStyle = 'rgba(8,16,28,0.85)'; octx.fillStyle = o.color || '#FFFFFF';
  octx.letterSpacing = (o.ls || 0) + 'px';
  octx.strokeText(text, x, y); octx.fillText(text, x, y);
  octx.restore();
}
function overlay(mode) {
  octx.clearRect(0, 0, 1920, 1080);
  if (mode !== 'plan') return;
  for (const c of Object.values(COURTS)) label(String(c.num), [c.cx, 0, c.cz], { size: c.premium ? 64 : 54 });
  label('MEZZANINE', [MEZ.x1 / 2 + 2, MEZ.y + 1, DOOR.zc], { size: 30, ls: 6, color: '#9FE3F7' });
  label('FRONT DESK', [DESK.x - 0.2, 1, DESK.z], { size: 20, ls: 2, color: '#FFE08A', stroke: 6 });
  label('STAIRS', [W - 6.6, 1, STAIRS[0].z0 - 1.5], { size: 18, ls: 2, color: '#FFE08A', stroke: 6 });
  label('MAIN DOORS ▼', [W + 3.2, 1, DOOR.zc], { size: 22, ls: 2, color: '#FFFFFF', stroke: 6 });
  label('BOUNCE BANNER', [2, 1, 0.8], { size: 18, ls: 3, color: '#9FE3F7', stroke: 6 });
  label('BOUNCE BANNER', [2, 1, L - 0.8], { size: 18, ls: 3, color: '#9FE3F7', stroke: 6 });
}

window.renderAt = () => { renderer.render(scene, cam); overlay(MODE); };
window.ready = (async () => {
  await Promise.all(['700 40px Jost', '600 40px Jost'].map(f => document.fonts.load(f)));
  const A = {
    logo: await T.loadImage('assets/bounce-logo.png'), mark: await T.loadImage('assets/bounce-mark.png'),
    joola: await T.loadImage('assets/joola-white.png'),
  };
  SKY = T.skyGradient();
  G = await buildWorld(scene, A);
  populate();
  applyMode(MODE);
  renderer.render(scene, cam);
  return { people: people.length, panels: G.panelCount };
})();
