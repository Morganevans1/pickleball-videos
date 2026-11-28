// Render driver: serves this folder over local HTTP (ES modules need it) and drives headless Chromium.
//   node render.js stills <outDir> <view> [<view> ...]     views: exterior | cutaway | plan
//   node render.js video  <out.mkv> <view> <startFrame> <endFrame>
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}
async function open(view) {
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 2; });
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver/.test(m.text())) console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html#${view}`);
  const info = await page.evaluate(() => window.ready);
  return { srv, browser, page, info };
}
const shot = page => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });

(async () => {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === 'stills') {
    const [outDir, ...views] = rest;
    fs.mkdirSync(outDir, { recursive: true });
    for (const v of views) {
      const t0 = Date.now();
      const { srv, browser, page, info } = await open(v);
      await page.evaluate(() => window.renderAt(0));
      fs.writeFileSync(path.join(outDir, `${v}.png`), await shot(page));
      console.log(v, JSON.stringify(info), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
      await browser.close(); srv.close();
    }
  } else if (mode === 'frames') {           // node render.js frames <outDir> <t1> [t2 ...]   (animation stills)
    const [outDir, ...times] = rest;
    fs.mkdirSync(outDir, { recursive: true });
    const { srv, browser, page, info } = await open('anim'); console.log(JSON.stringify(info));
    for (const t of times) {
      const t0 = Date.now();
      await page.evaluate(tt => window.renderAt(tt), +t);
      fs.writeFileSync(path.join(outDir, `t_${(+t).toFixed(2).padStart(5, '0')}.png`), await shot(page));
      console.log(t, `${((Date.now() - t0) / 1000).toFixed(2)}s`);
    }
    await browser.close(); srv.close();
  } else if (mode === 'cues') {             // node render.js cues <out.json>
    const { srv, browser, page } = await open('anim');
    fs.writeFileSync(rest[0], JSON.stringify(await page.evaluate(() => window.CUES), null, 1));
    await browser.close(); srv.close();
  } else if (mode === 'video') {            // node render.js video <out.mkv> <startFrame> <endFrame>
    const [out, a, b] = rest, start = +a, end = +b;
    const { srv, browser, page } = await open('anim');
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = start; f < end; f++) {
      await page.evaluate(ff => window.renderFrame(ff), f);
      const buf = await shot(page);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - start) % 30 === 0) console.log(`[${path.basename(out)}] frame ${f} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    await browser.close(); srv.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
