// Verifies the production build: manifest, offline service worker, icons, CSP, black theme.
import { existsSync, readFileSync } from 'node:fs';

const fail = [];
const warn = [];
const need = (p) => existsSync(`dist/${p}`) || fail.push(`missing dist/${p}`);
['index.html', 'manifest.webmanifest', 'sw.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'favicon.svg'].forEach(need);
if (existsSync('dist/index.html')) {
  const html = readFileSync('dist/index.html', 'utf8');
  if (!html.includes('Content-Security-Policy')) fail.push('index.html has no Content-Security-Policy');
  if (!html.includes('manifest.webmanifest')) fail.push('index.html does not link the manifest');
}
if (existsSync('dist/manifest.webmanifest')) {
  const m = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
  if (m.theme_color !== '#000000' || m.background_color !== '#000000') fail.push('manifest colors are not black');
  if (m.display !== 'standalone') fail.push('manifest display is not standalone');
}
if (existsSync('dist/sw.js') && !readFileSync('dist/sw.js', 'utf8').includes('index.html')) fail.push('service worker does not precache index.html');
if (!existsSync('dist/models/fashion-labels.bin')) warn.push('on-device label file missing (run "npm run labels")');
if (!existsSync('dist/ort/ort-wasm-simd-threaded.jsep.wasm')) warn.push('ONNX Runtime files missing from dist/ort');
warn.forEach((w) => console.warn(`warning: ${w}`));
if (fail.length) { fail.forEach((f) => console.error(`error: ${f}`)); process.exit(1); }
console.log('dist looks good: manifest, service worker, icons, CSP and black theme present.');
