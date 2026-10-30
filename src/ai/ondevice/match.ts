import { autoName, defaultAttrs, defaultFormality, defaultWarmth, findType, relevantAttrs } from '@/domain/taxonomy';
import type { AttrKey, ItemAttrs } from '@/domain/types';
import type { ItemDraft } from '../normalize';

export interface LabelEntry { group: string; value: string; prompt: string }
export interface LabelIndex { model: string; dim: number; dtype: string; entries: LabelEntry[] }

/** Softmax temperature used by FashionSigLIP's own examples. */
export const LOGIT_SCALE = 100;
/** Below these probabilities a field is left blank for the user to fill. */
export const TYPE_UNSURE = 0.25;
export const ATTR_UNSURE = 0.4;
/** The best label must also beat the runner-up by this much. */
export const MIN_MARGIN = 0.15;

export function normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

export interface LabelPick { value: string; prob: number }

/** Picks the closest label per attribute group by cosine similarity; unsure groups come back null. */
export function pickLabels(img: Float32Array, index: LabelIndex, matrix: Float32Array): Record<string, LabelPick | null> {
  const { dim } = index;
  if (img.length !== dim || matrix.length < index.entries.length * dim) throw new Error('Label data does not match the model');
  const groups = new Map<string, { value: string; sim: number }[]>();
  index.entries.forEach((e, row) => {
    let s = 0;
    const off = row * dim;
    for (let i = 0; i < dim; i++) s += img[i] * matrix[off + i];
    groups.set(e.group, [...(groups.get(e.group) ?? []), { value: e.value, sim: s }]);
  });
  const out: Record<string, LabelPick | null> = {};
  for (const [group, list] of groups) {
    const max = Math.max(...list.map((x) => x.sim));
    const exps = list.map((x) => Math.exp(LOGIT_SCALE * (x.sim - max)));
    const sum = exps.reduce((a, b) => a + b, 0);
    let best = 0;
    exps.forEach((v, i) => { if (v > exps[best]) best = i; });
    const prob = exps[best] / sum;
    const second = Math.max(0, ...exps.filter((_, i) => i !== best)) / sum;
    const limit = group === 'type' ? TYPE_UNSURE : ATTR_UNSURE;
    out[group] = prob >= limit && prob - second >= MIN_MARGIN ? { value: list[best].value, prob } : null;
  }
  return out;
}

/** Turns label picks into a draft. Formality, warmth and occasions come from the clothing defaults; colors from pixels. */
export function draftFromPicks(picks: Record<string, LabelPick | null>, pixel: { primary?: string; secondary?: string }): ItemDraft {
  const type = picks.type && findType(picks.type.value) ? picks.type.value : undefined;
  const attrs: ItemAttrs = defaultAttrs(type ?? 'tshirt');
  if (type) {
    const material = picks.material?.value as ItemAttrs['material'] | undefined;
    if (material) attrs.material = material;
    for (const key of relevantAttrs(type, attrs) as AttrKey[]) {
      const p = picks[key];
      if (p && key !== 'material') (attrs as unknown as Record<string, string>)[key] = p.value;
    }
    attrs.canOpen = type === 'shirt';
  }
  return {
    type,
    name: type ? autoName(type, pixel.primary, attrs) : '',
    primaryShade: pixel.primary,
    secondaryShade: pixel.secondary,
    attrs,
    formality: type ? defaultFormality(type, attrs) : 3,
    warmth: type ? defaultWarmth(type, attrs) : 2,
    quantity: 1,
    overrides: {},
    source: 'on-device',
    confidence: picks.type?.prob,
  };
}
