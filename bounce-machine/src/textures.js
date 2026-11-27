// Procedural textures for the Malvern build (all drawn on canvas at load time).
import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export async function loadImage(src) { const im = new Image(); im.src = src; await im.decode(); return im; }
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
}
const LOGO_BOX = [42, 38, 1879, 575]; // visible bbox inside bounce-logo.png

function noise(g, w, h, seed, n, colors, rMax = 2) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(R() * colors.length)];
    const r = 0.5 + R() * rMax;
    g.fillRect(R() * w, R() * h, r, r);
  }
}
export function tinted(img, color, box) {
  const [sx, sy, sw, sh] = box || [0, 0, img.width, img.height];
  const c = canvas(sw, sh), g = c.getContext('2d');
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, sw, sh);
  return c;
}

// ------------------------------------------------------------------ the starfield wall banner (both end walls)
export function starfieldBanner(A, w = 4096, h = 560) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#0D131C'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 96) {
    const gr = g.createLinearGradient(x, 0, x + 96, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.03)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x, 0, 96, h);
  }
  const R = rng(11);
  for (let i = 0; i < 1500; i++) {
    const x = R() * w, y = R() * h, r = 0.7 + Math.pow(R(), 3) * 3.4;
    g.fillStyle = `rgba(255,255,255,${0.35 + R() * 0.65})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const x = R() * w, y = R() * h, s = 6 + R() * 10;
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();
  }
  const lh = h * 0.44, lw = lh * LOGO_BOX[2] / LOGO_BOX[3];
  g.drawImage(A.logo, ...LOGO_BOX, w * 0.62 - lw / 2, h * 0.25, lw, lh);
  const jh = h * 0.11, jw = jh * A.joola.width / A.joola.height;
  g.drawImage(A.joola, w * 0.33 - jw / 2, h * 0.42, jw, jh);
  return tex(c);
}

// ------------------------------------------------------------------ JOOLA barrier panel
export function barrierPanel(A) {
  const c = canvas(1024, 320), g = c.getContext('2d');
  g.fillStyle = '#121418'; g.fillRect(0, 0, 1024, 320);
  g.fillStyle = '#23262C'; g.fillRect(0, 0, 1024, 10); g.fillRect(0, 310, 1024, 10);
  const jh = 130, jw = jh * A.joola.width / A.joola.height;
  g.drawImage(A.joola, 512 - jw / 2, 160 - jh / 2, jw, jh);
  return tex(c);
}

// ------------------------------------------------------------------ building materials
export function corrugated(base = '#CDBF98', seed = 1) {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 10; i++) {
    const x = i * 25.6;
    g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(x, 0, 4, 256);
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x + 6, 0, 3, 256);
  }
  noise(g, 256, 256, seed, 900, ['rgba(0,0,0,0.04)', 'rgba(255,255,255,0.05)']);
  return tex(c, { repeat: [1, 1] });
}
export function roofMetal() {
  const c = canvas(256, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#C5C9CD'); gr.addColorStop(1, '#AEB3B8');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(i * 64, 0, 3, 256); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(i * 64 + 3, 0, 2, 256); }
  return tex(c, { repeat: [1, 1] });
}
export function stone() {
  const c = canvas(256, 256), g = c.getContext('2d'), R = rng(5);
  g.fillStyle = '#5E564C'; g.fillRect(0, 0, 256, 256);
  const cols = ['#9A8F7E', '#8A7F6E', '#A79C88', '#7D7466', '#B0A38C', '#8E8272'];
  for (let y = 0; y < 256; y += 30) for (let x = -20; x < 256; x += 40) {
    g.fillStyle = cols[Math.floor(R() * cols.length)];
    g.beginPath(); g.roundRect(x + R() * 10 + (y / 30 % 2) * 18, y + 3, 30 + R() * 12, 24, 7); g.fill();
  }
  return tex(c, { repeat: [1, 1] });
}
export function grass() {
  const c = canvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#6E9A4C'; g.fillRect(0, 0, 512, 512);
  noise(g, 512, 512, 3, 9000, ['#5F8C40', '#7AA857', '#668F46', '#83B062'], 3);
  return tex(c, { repeat: [60, 60] });
}
export function floorNoise(base, dots, seed, rep) {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, seed, 2500, dots, 1.5);
  return tex(c, { repeat: rep });
}
export function meshGrid(color = 'rgba(20,24,30,0.95)', cell = 8, size = 64) {
  const c = canvas(size, size), g = c.getContext('2d');
  g.strokeStyle = color; g.lineWidth = 1.4;
  for (let i = 0; i <= size; i += cell) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, size); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(size, i); g.stroke(); }
  const t = tex(c, { repeat: [1, 1] }); t.anisotropy = 4; return t;
}
export function skyGradient() {
  const c = canvas(16, 512), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#8EC3E8'); gr.addColorStop(0.65, '#CFE5F3'); gr.addColorStop(1, '#EEF4F2');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  return tex(c);
}

// ------------------------------------------------------------------ signage
export function entranceSign(A) {
  const c = canvas(1200, 210), g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 1200, 210);
  const lh = 150, lw = lh * LOGO_BOX[2] / LOGO_BOX[3];
  g.drawImage(tinted(A.logo, '#1D4AA6', LOGO_BOX), 40, 30, lw, lh);
  g.fillStyle = '#0B1728'; g.fillRect(1200 - 210, 0, 210, 210);
  const mk = tinted(A.mark, '#FFFFFF');
  g.drawImage(mk, 1200 - 190, 22, 170, 170 * A.mark.height / A.mark.width);
  return tex(c);
}
export function markPanel(A, bg = '#FFFFFF', fg = '#11ACDB') {
  const c = canvas(512, 320), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 320);
  const mk = tinted(A.mark, fg), h = 220, w = h * A.mark.width / A.mark.height;
  g.drawImage(mk, 256 - w / 2, 160 - h / 2, w, h);
  return tex(c);
}
export function plaque(n) {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#E4752C'; g.beginPath(); g.roundRect(4, 4, 120, 120, 14); g.fill();
  g.fillStyle = '#FFFFFF'; g.font = '700 78px Jost'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 64, 70);
  return tex(c);
}
export function shopWindow(seed) {
  const c = canvas(256, 192), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = '#2D3440'; g.fillRect(0, 0, 256, 192);
  const cols = ['#11ACDB', '#C9A84C', '#F0657A', '#14181F', '#7B5CD6', '#F7F6F2', '#2BB3A6', '#FFD100'];
  for (let i = 0; i < 9; i++) {
    g.fillStyle = cols[Math.floor(R() * cols.length)];
    g.beginPath(); g.roundRect(14 + i * 26, 40 + R() * 14, 20, 52, [9, 9, 4, 4]); g.fill();
    g.fillStyle = '#111'; g.fillRect(21 + i * 26, 92 + R() * 4, 6, 22);
  }
  const gr = g.createLinearGradient(0, 0, 256, 192);
  gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(255,255,255,0.18)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 192);
  g.strokeStyle = '#F4F4F2'; g.lineWidth = 8; g.strokeRect(0, 0, 256, 192);
  return tex(c);
}
export function glass() {
  const c = canvas(256, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, '#B9CDD8'); gr.addColorStop(0.5, '#7E97A6'); gr.addColorStop(1, '#A8BECB');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.beginPath(); g.moveTo(40, 0); g.lineTo(90, 0); g.lineTo(10, 256); g.lineTo(-40, 256); g.fill();
  return tex(c);
}

// ------------------------------------------------------------------ the front desk (from the club's own photos)
export function shiplap() {
  const c = canvas(512, 512), g = c.getContext('2d'), R = rng(41);
  const cols = ['#DCD5C8', '#E4DFD5', '#D3CBBC', '#E9E5DC', '#CFC6B6'];
  for (let y = 0; y < 512; y += 40) {
    let x = -R() * 300;
    while (x < 512) {
      const w = 260 + R() * 260;
      g.fillStyle = cols[Math.floor(R() * cols.length)]; g.fillRect(x, y, w, 40);
      for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(120,98,76,${0.05 + R() * 0.06})`; g.fillRect(x, y + 4 + R() * 32, w, 1); }
      g.fillStyle = 'rgba(70,60,50,0.35)'; g.fillRect(x + w - 2, y, 2, 40);
      x += w;
    }
    g.fillStyle = 'rgba(60,52,44,0.45)'; g.fillRect(0, y + 38, 512, 2);
  }
  return tex(c, { repeat: [1, 1] });
}
export function woodTop() {
  const c = canvas(512, 128), g = c.getContext('2d'), R = rng(43);
  g.fillStyle = '#6E4C33'; g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '40,26,16' : '150,110,78'},${0.1 + R() * 0.15})`; g.fillRect(0, R() * 128, 512, 1 + R() * 2); }
  return tex(c, { repeat: [1, 1] });
}
function arrowBar(g, x0, x1, y, dir, label, rust, cream) {
  const h = 38, head = 46;
  g.fillStyle = cream; g.beginPath();
  if (dir < 0) { g.moveTo(x0, y); g.lineTo(x0 + head, y - h * 0.9); g.lineTo(x0 + head, y - h / 2); g.lineTo(x1, y - h / 2); g.lineTo(x1, y + h / 2); g.lineTo(x0 + head, y + h / 2); g.lineTo(x0 + head, y + h * 0.9); }
  else { g.moveTo(x1, y); g.lineTo(x1 - head, y - h * 0.9); g.lineTo(x1 - head, y - h / 2); g.lineTo(x0, y - h / 2); g.lineTo(x0, y + h / 2); g.lineTo(x1 - head, y + h / 2); g.lineTo(x1 - head, y + h * 0.9); }
  g.closePath(); g.fill();
  g.fillStyle = rust; g.font = '700 30px "DejaVu Serif"'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, (x0 + x1) / 2 + (dir < 0 ? head / 2 : -head / 2), y + 1);
}
export function deskSign(A) {
  const c = canvas(1600, 470), g = c.getContext('2d');
  const rust = '#B35E2C', blk = '#232629', cream = '#F3E7D3';
  g.fillStyle = '#A3A8AD'; g.fillRect(0, 0, 1600, 470);
  g.fillStyle = blk; g.fillRect(10, 10, 1580, 450);
  for (const [x, top, num, dir, lab] of [[22, 'COURTS', '8 to 14', -1, 'EAST'], [1138, 'COURTS', '1 to 7', 1, 'WEST']]) {
    g.fillStyle = rust; g.fillRect(x, 22, 440, 300);
    g.strokeStyle = cream; g.lineWidth = 4; g.strokeRect(x + 12, 34, 416, 276);
    g.fillStyle = cream; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = '700 70px "DejaVu Serif"'; g.fillText(top, x + 220, 112);
    g.font = '700 104px "DejaVu Serif"'; g.fillText(num, x + 220, 222);
    arrowBar(g, x + 40, x + 400, 272, dir, lab, rust, cream);
  }
  const lh = 230, lw = lh * 1879 / 575;
  const sc = Math.min(1, 600 / lw);
  g.drawImage(A.logo, 42, 38, 1879, 575, 800 - lw * sc / 2, 172 - lh * sc / 2, lw * sc, lh * sc);
  g.fillStyle = cream; g.font = 'italic 700 50px "DejaVu Serif"'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const msg = 'PLEASE CHECK IN HERE BEFORE GOING TO YOUR COURTS', mw = g.measureText(msg).width, k = Math.min(1, 1480 / mw);
  g.save(); g.translate(800, 392); g.scale(k, 1); g.fillText(msg, 0, 0); g.restore();
  return tex(c);
}
export function tvScreen() {
  const c = canvas(320, 180), g = c.getContext('2d'), R = rng(47);
  g.fillStyle = '#0B0C0E'; g.fillRect(0, 0, 320, 180);
  g.fillStyle = '#F4F4F2'; g.fillRect(8, 8, 304, 164);
  const cols = ['#F08A24', '#E23B2E', '#58C34B', '#C33BD6', '#2A5BD7', '#F5B83D'];
  for (let col = 0; col < 14; col++) for (let row = 0; row < 6; row++) if (R() < 0.7) {
    g.fillStyle = cols[Math.floor(R() * cols.length)]; g.fillRect(24 + col * 15, 30 + row * 20, 14, 19);
  }
  g.fillStyle = '#CFD3D8'; for (let i = 0; i < 9; i++) g.fillRect(250, 26 + i * 14, 52, 5);
  return tex(c);
}
export function lobDinkSmash() {
  const c = canvas(160, 220), g = c.getContext('2d');
  [['LOB', '#E6534A'], ['DINK', '#F3A53A'], ['SMASH', '#8BC34A']].forEach(([t, col], i) => {
    g.fillStyle = col; g.fillRect(0, i * 73, 160, 74);
    g.fillStyle = '#FFFFFF'; g.font = '700 40px Jost'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 80, i * 73 + 38);
  });
  return tex(c);
}
