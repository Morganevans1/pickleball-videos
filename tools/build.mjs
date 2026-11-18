// Bundles the app into one self-contained HTML file (no server needed, works
// offline on a tablet). No dependencies: it relies on the source using
// single-line `import { … } from './x.js';` statements and `export` prefixes.
//
//   node tools/build.mjs                  -> dist/recovery-coach.html
//   node tools/build.mjs --artifact out.html   also writes a body-only page

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*['"](.+?)['"];?\s*$/;
const EXPORT_RE = /^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/;

const modules = new Map(); // abs path -> { id, code, deps }
const order = [];

function load(file) {
  if (modules.has(file)) return modules.get(file);
  const src = readFileSync(file, 'utf8');
  const id = `__m${modules.size}`;
  const mod = { id, file, deps: [], code: '' };
  modules.set(file, mod);
  const lines = src.split('\n');
  const head = [], body = [], exports = [];
  for (const line of lines) {
    const im = line.match(IMPORT_RE);
    if (im) {
      const dep = load(resolve(dirname(file), im[2]));
      mod.deps.push(dep);
      const names = im[1].split(',').map((s) => s.trim()).filter(Boolean)
        .map((s) => s.replace(/\s+as\s+/, ': '));
      head.push(`const { ${names.join(', ')} } = ${dep.id};`);
      continue;
    }
    if (/^\s*import\s/.test(line)) throw new Error(`Unsupported import in ${file}: ${line}`);
    if (/^export\s*\{/.test(line)) throw new Error(`Unsupported export list in ${file}: ${line}`);
    const ex = line.match(EXPORT_RE);
    if (ex) { exports.push(ex[1]); body.push(line.replace(/^export\s+/, '')); continue; }
    body.push(line);
  }
  mod.code = `// ${relative(root, file)}\nconst ${id} = (() => {\n${head.join('\n')}\n${body.join('\n')}\nreturn { ${exports.join(', ')} };\n})();\n`;
  order.push(mod);
  return mod;
}

load(resolve(root, 'src/main.js'));
const bundle = `(() => {\n'use strict';\n${order.map((m) => m.code).join('\n')}\n})();`;
const css = readFileSync(resolve(root, 'src/styles.css'), 'utf8');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

const full = html
  .replace('<link rel="stylesheet" href="src/styles.css">', () => `<style>\n${css}</style>`)
  .replace('<script type="module" src="src/main.js"></script>', () => `<script>\n${bundle}\n</script>`);
if (full.includes('src="src/main.js"') || full.includes('href="src/styles.css"')) throw new Error('index.html placeholders not found');

mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/recovery-coach.html'), full);
console.log(`dist/recovery-coach.html  ${(full.length / 1024).toFixed(0)} KB, ${order.length} modules`);

const ai = process.argv.indexOf('--artifact');
if (ai > 0) {
  // Body-only page: the host supplies doctype, charset and viewport.
  const title = full.match(/<title>[\s\S]*?<\/title>/)[0];
  const metas = (full.match(/<meta name="claude:[^>]*>/g) || []).join('\n');
  const links = (full.match(/<link [^>]*>/g) || []).join('\n');
  const style = full.match(/<style>[\s\S]*?<\/style>/)[0];
  const body = full.match(/<body>([\s\S]*)<\/body>/)[1];
  const page = `${title}\n${metas}\n${links}\n${style}\n${body}`;
  writeFileSync(resolve(process.argv[ai + 1]), page);
  console.log(`artifact page -> ${process.argv[ai + 1]}`);
}
