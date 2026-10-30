import { proxy, wrap, type Remote } from 'comlink';
import { setSetting } from '@/data/settings';
import type { ItemDraft } from '../normalize';
import { draftFromPicks, normalize, pickLabels, type LabelIndex } from './match';

interface WorkerApi {
  load(base: string, onProgress?: (f: number) => void): Promise<{ device: string; dtype: string }>;
  embed(blob: Blob): Promise<Float32Array>;
}

let worker: Worker | null = null;
let remote: Remote<WorkerApi> | null = null;
let loading: Promise<{ device: string; dtype: string }> | null = null;
let labels: Promise<{ index: LabelIndex; matrix: Float32Array }> | null = null;

const base = () => import.meta.env.BASE_URL;

function api(): Remote<WorkerApi> {
  if (!remote) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    remote = wrap<WorkerApi>(worker);
  }
  return remote;
}

/** Label embeddings precomputed by `npm run labels`, shipped with the app. */
export function loadLabels(): Promise<{ index: LabelIndex; matrix: Float32Array }> {
  labels ??= (async () => {
    const [ij, bin] = await Promise.all([fetch(`${base()}models/fashion-labels.json`), fetch(`${base()}models/fashion-labels.bin`)]);
    if (!ij.ok || !bin.ok) throw new Error('The label file is missing. Run "npm run labels" and rebuild.');
    const index = (await ij.json()) as LabelIndex;
    const matrix = new Float32Array(await bin.arrayBuffer());
    if (matrix.length !== index.entries.length * index.dim) throw new Error('The label file is damaged. Run "npm run labels" again.');
    return { index, matrix };
  })().catch((e) => { labels = null; throw e; });
  return labels;
}

/** Downloads (or loads from cache) the FashionSigLIP image model. */
export async function downloadOnDevice(onProgress: (fraction: number) => void): Promise<string> {
  await loadLabels();
  loading = api().load(base(), proxy(onProgress));
  try {
    const r = await loading;
    await setSetting('ondevice.ready', true);
    return r.device === 'webgpu' ? (r.dtype === 'q4f16' ? 'GPU (q4f16, about 54 MB)' : 'GPU (q4, about 61 MB)') : r.dtype === 'cached' ? 'this phone' : 'CPU (q4, about 61 MB)';
  } catch (e) {
    loading = null;
    throw e;
  }
}

export async function tagOnDevice(image: Blob, pixel: { primary?: string; secondary?: string }): Promise<ItemDraft> {
  const { index, matrix } = await loadLabels();
  loading ??= api().load(base());
  await loading;
  const emb = await api().embed(image);
  return draftFromPicks(pickLabels(normalize(emb), index, matrix), pixel);
}

export async function removeOnDevice(): Promise<void> {
  await setSetting('ondevice.ready', false);
  worker?.terminate();
  worker = null; remote = null; loading = null;
  try { await caches.delete('transformers-cache'); } catch { /* no cache API */ }
}
