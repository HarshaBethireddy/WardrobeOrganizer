import { describe, expect, it } from 'vitest';
import { FAMILIES, SHADES, familyOf } from '@/domain/palette';
import { ITEM_TYPES, defaultAttrs, defaultFormality, getType, relevantAttrs } from '@/domain/taxonomy';
import { BUILT_IN_OCCASIONS, TEMPLATES, allOccasions } from '@/domain/occasions';
import { ATTR_VALUES } from '@/domain/types';

describe('clothing data', () => {
  it('has unique type ids, valid slots and defaults for every type', () => {
    expect(new Set(ITEM_TYPES.map((t) => t.id)).size).toBe(ITEM_TYPES.length);
    for (const t of ITEM_TYPES) {
      expect(t.slots.length).toBeGreaterThan(0);
      const a = defaultAttrs(t.id);
      for (const [k, vals] of Object.entries(ATTR_VALUES)) expect(vals).toContain(a[k as keyof typeof a]);
      expect(defaultFormality(t.id, a)).toBeGreaterThanOrEqual(1);
      expect(relevantAttrs(t.id, a)).toContain('pattern');
    }
  });
  it('treats ripped, shaded and zip details as less formal', () => {
    const jeans = defaultAttrs('jeans');
    expect(defaultFormality('jeans', { ...jeans, distress: 'ripped' })).toBeLessThan(defaultFormality('jeans', jeans));
    expect(defaultFormality('jeans', { ...jeans, wash: 'ombre' })).toBeLessThan(defaultFormality('jeans', jeans));
    const j = defaultAttrs('jacket');
    expect(defaultFormality('jacket', { ...j, closure: 'zipper' })).toBeLessThan(defaultFormality('jacket', { ...j, closure: 'buttons' }));
  });
  it('has about 50 shades with unique ids and valid hex values', () => {
    expect(SHADES.length).toBeGreaterThanOrEqual(45);
    expect(new Set(SHADES.map((s) => s.id)).size).toBe(SHADES.length);
    for (const s of SHADES) expect(s.hex).toMatch(/^#[0-9A-F]{6}$/i);
    for (const s of SHADES) expect(FAMILIES.map((f) => f.id)).toContain(s.family);
  });
  it('puts off-white, ivory and cream in the white family', () => {
    for (const id of ['white', 'off-white', 'ivory', 'cream']) expect(familyOf(id)).toBe('white');
  });
  it('defines all eight built-in occasions with valid templates', () => {
    expect(BUILT_IN_OCCASIONS.map((o) => o.id)).toEqual(['office', 'casual', 'date', 'party', 'festive', 'gym', 'travel', 'home']);
    for (const o of BUILT_IN_OCCASIONS) for (const t of o.templates) expect(TEMPLATES[t]).toBeDefined();
    for (const o of BUILT_IN_OCCASIONS) for (const t of o.bannedTypes) expect(() => getType(t)).not.toThrow();
  });
  it('builds custom occasions on a built-in one', () => {
    const all = allOccasions([{ id: 'c1', name: 'Temple visit', baseId: 'festive' }]);
    const c = all.find((o) => o.id === 'c1')!;
    expect(c.baseId).toBe('festive');
    expect(c.target).toBe(BUILT_IN_OCCASIONS.find((o) => o.id === 'festive')!.target);
  });
});
