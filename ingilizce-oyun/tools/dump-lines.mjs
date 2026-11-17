// Uygulamanın söyleyebildiği bütün İngilizce cümleleri (ABD ve İngiliz) JSON olarak yazar: node dump-lines.mjs > lines.json
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, '..', 'index.html');
const src = fs.readFileSync(file, 'utf8');
// Kaynaktaki sabit ['en', '...'] cümleleri
const fixed = new Set();
for (const m of src.matchAll(/\['en', (?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\]/g)) fixed.add((m[1] ?? m[2]).replace(/\\'/g, "'"));
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(pathToFileURL(file).href);
const out = {};
for (const acc of ['us', 'uk']){
  const L = await p.evaluate(a => window.__bubu.lines(a), acc);
  for (const t of fixed) if (!L[t]) L[t] = 'core';
  out[acc] = L;
}
await b.close();
process.stdout.write(JSON.stringify(out));
