// Copies the ONNX Runtime web files next to the app so on-device AI never loads code from a CDN.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const out = 'public/ort';
const sources = ['node_modules/@huggingface/transformers/dist', 'node_modules/onnxruntime-web/dist'];
const wanted = /^ort-wasm-simd-threaded(\.jsep)?\.(mjs|wasm)$/;
mkdirSync(out, { recursive: true });
let copied = 0;
for (const dir of sources) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!wanted.test(f)) continue;
    const src = join(dir, f), dst = join(out, f);
    if (existsSync(dst) && statSync(dst).size === statSync(src).size) { copied++; continue; }
    copyFileSync(src, dst);
    copied++;
  }
  if (copied) break;
}
console.log(copied ? `ONNX Runtime files ready in ${out} (${copied})` : 'Warning: ONNX Runtime files not found; on-device AI will not load.');
