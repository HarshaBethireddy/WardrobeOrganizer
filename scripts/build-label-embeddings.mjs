// Embeds the fixed label prompts with the FashionSigLIP text model so the phone only downloads the image half.
// Usage: npm run labels   (optional: LABEL_DTYPE=fp32 for the full-precision text model)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { AutoTokenizer, SiglipTextModel } from '@huggingface/transformers';

const src = JSON.parse(readFileSync('src/ai/ondevice/labels.json', 'utf8'));
const dtype = process.env.LABEL_DTYPE ?? 'int8';
const entries = [];
for (const [group, values] of Object.entries(src.groups)) for (const [value, prompt] of Object.entries(values)) entries.push({ group, value, prompt });
console.log(`Embedding ${entries.length} labels with ${src.model} (${dtype}) ...`);
const tokenizer = await AutoTokenizer.from_pretrained(src.model);
const model = await SiglipTextModel.from_pretrained(src.model, { dtype });
const chunks = [];
let dim = 0;
for (let i = 0; i < entries.length; i += 16) {
  const batch = entries.slice(i, i + 16).map((e) => e.prompt);
  const inputs = tokenizer(batch, { padding: 'max_length', truncation: true });
  const { text_embeds } = await model(inputs);
  const norm = text_embeds.normalize(2, -1);
  dim = norm.dims[1];
  chunks.push(Float32Array.from(norm.data));
}
const matrix = new Float32Array(entries.length * dim);
let off = 0;
for (const c of chunks) { matrix.set(c, off); off += c.length; }
mkdirSync('public/models', { recursive: true });
writeFileSync('public/models/fashion-labels.bin', Buffer.from(matrix.buffer));
writeFileSync('public/models/fashion-labels.json', JSON.stringify({ model: src.model, dim, dtype, entries }, null, 1));
console.log(`Wrote public/models/fashion-labels.bin (${entries.length} x ${dim}) and fashion-labels.json`);
