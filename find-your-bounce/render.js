// Render driver.
//   node render.js stills  <outDir> <t1> [t2 ...]          -> PNG stills at given times (seconds)
//   node render.js video   <out.mkv> <startFrame> <endFrame> -> lossless video segment [start, end)
//   PAGE=character-study.html#poses node render.js stills ...   -> render another page
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

async function open() {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e); process.exitCode = 2; });
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  const [file, hash = ''] = (process.env.PAGE || 'index.html').split('#');
  await page.goto('file://' + path.resolve(__dirname, file) + (hash ? '#' + hash : ''));
  await page.evaluate(() => window.ready);
  return { browser, page };
}

async function shot(page) {
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 }, animations: 'disabled', caret: 'hide' });
}

(async () => {
  const [mode, ...rest] = process.argv.slice(2);
  const { browser, page } = await open();
  if (mode === 'stills') {
    const [outDir, ...times] = rest;
    fs.mkdirSync(outDir, { recursive: true });
    for (const t of times) {
      await page.evaluate(tt => window.renderAt(tt), +t);
      fs.writeFileSync(path.join(outDir, `t_${(+t).toFixed(2).padStart(5, '0')}.png`), await shot(page));
    }
  } else if (mode === 'video') {
    const [out, a, b] = rest;
    const start = +a, end = +b;
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = start; f < end; f++) {
      await page.evaluate(ff => window.renderFrame(ff), f);
      const buf = await shot(page);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - start) % 30 === 0) console.log(`[${out}] frame ${f} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
