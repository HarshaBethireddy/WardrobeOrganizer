import { expose } from 'comlink';
import { AutoProcessor, RawImage, SiglipVisionModel, env } from '@huggingface/transformers';

const MODEL = 'Marqo/marqo-fashionSigLIP';
let processor: any = null;
let model: any = null;

/** Removes model files from earlier versions that this runtime can't use (they took up about 94 MB). */
async function dropUnusableCache() {
  try {
    const c = await caches.open('transformers-cache');
    for (const req of await c.keys()) if (/_(int8|uint8|quantized)\.onnx/.test(req.url)) await c.delete(req);
  } catch { /* no Cache API */ }
}

async function load(base: string, onProgress?: (fraction: number) => void): Promise<{ device: string; dtype: string }> {
  if (model) return { device: 'cached', dtype: 'cached' };
  env.allowLocalModels = false;
  (env.backends.onnx as any).wasm.wasmPaths = `${base}ort/`;
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (p: any) => {
    if (p?.status !== 'progress' || !p.file) return;
    files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
    let l = 0, t = 0;
    files.forEach((f) => { l += f.loaded; t += f.total; });
    onProgress?.(t ? l / t : 0);
  };
  // int8/uint8 builds use ConvInteger, which ONNX Runtime Web cannot run. q4 (4-bit MatMul weights, float conv) runs on CPU and GPU.
  await dropUnusableCache();
  let device = 'wasm', dtype = 'q4';
  const gpu = (self.navigator as any).gpu;
  if (gpu) {
    try {
      const adapter = await gpu.requestAdapter();
      if (adapter) { device = 'webgpu'; dtype = adapter.features?.has('shader-f16') ? 'q4f16' : 'q4'; }
    } catch { /* stay on wasm */ }
  }
  processor = await AutoProcessor.from_pretrained(MODEL, { progress_callback } as any);
  try {
    model = await SiglipVisionModel.from_pretrained(MODEL, { device, dtype, progress_callback } as any);
  } catch (e) {
    if (device === 'wasm') throw e;
    device = 'wasm'; dtype = 'q4';
    model = await SiglipVisionModel.from_pretrained(MODEL, { device, dtype, progress_callback } as any);
  }
  return { device, dtype };
}

async function embed(blob: Blob): Promise<Float32Array> {
  if (!model || !processor) throw new Error('Model not loaded');
  const image = await RawImage.fromBlob(blob);
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  return new Float32Array(image_embeds.data as Float32Array);
}

expose({ load, embed });
