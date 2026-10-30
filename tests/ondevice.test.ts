import { describe, expect, it } from 'vitest';
import labels from '@/ai/ondevice/labels.json';
import { ATTR_UNSURE, draftFromPicks, normalize, pickLabels, type LabelIndex } from '@/ai/ondevice/match';
import { ITEM_TYPES } from '@/domain/taxonomy';
import { ATTR_VALUES, type AttrKey } from '@/domain/types';

const DIM = 8;
function fixture(entries: LabelIndex['entries']) {
  const index: LabelIndex = { model: 'x', dim: DIM, dtype: 'fp32', entries };
  const matrix = new Float32Array(entries.length * DIM);
  entries.forEach((_, i) => { matrix[i * DIM + (i % DIM)] = 1; });
  return { index, matrix };
}
const vec = (hot: number[], weights: number[] = hot.map(() => 1)) => { const v = new Float32Array(DIM); hot.forEach((h, i) => (v[h] = weights[i])); return normalize(v); };

describe('on-device label matching', () => {
  const { index, matrix } = fixture([
    { group: 'type', value: 'jeans', prompt: '' }, { group: 'type', value: 'shirt', prompt: '' },
    { group: 'wash', value: 'ombre', prompt: '' }, { group: 'wash', value: 'dark', prompt: '' },
    { group: 'material', value: 'denim', prompt: '' }, { group: 'material', value: 'cotton', prompt: '' },
  ]);
  it('picks the closest label in each group', () => {
    const picks = pickLabels(vec([0, 2, 4]), index, matrix);
    expect(picks.type?.value).toBe('jeans');
    expect(picks.wash?.value).toBe('ombre');
    expect(picks.material?.value).toBe('denim');
  });
  it('leaves a group blank when it is unsure', () => {
    const picks = pickLabels(vec([0, 2, 3, 4], [1, 0.5, 0.5, 1]), index, matrix);
    expect(picks.wash).toBeNull();
    expect(ATTR_UNSURE).toBeGreaterThan(0.3);
  });
  it('builds a draft with defaults for formality and pixel colors', () => {
    const d = draftFromPicks({ type: { value: 'jeans', prob: 0.9 }, wash: { value: 'ombre', prob: 0.8 }, material: { value: 'denim', prob: 0.9 } }, { primary: 'teal' });
    expect(d).toMatchObject({ type: 'jeans', primaryShade: 'teal', source: 'on-device' });
    expect(d.attrs.wash).toBe('ombre');
    expect(d.formality).toBe(2);
    expect(draftFromPicks({ type: null }, {}).type).toBeUndefined();
  });
  it('rejects label data that does not match the model', () => {
    expect(() => pickLabels(new Float32Array(3), index, matrix)).toThrow();
  });
});

describe('label prompts', () => {
  it('cover every clothing type and every attribute value (except N/A and fit)', () => {
    const groups = labels.groups as Record<string, Record<string, string>>;
    expect(Object.keys(groups.type).sort()).toEqual(ITEM_TYPES.map((t) => t.id).sort());
    for (const key of Object.keys(ATTR_VALUES) as AttrKey[]) {
      if (key === 'fit') continue;
      for (const v of ATTR_VALUES[key]) if (v !== 'na') expect(groups[key], `${key}`).toHaveProperty(v);
    }
  });
});
