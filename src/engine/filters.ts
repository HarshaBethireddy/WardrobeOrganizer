import type { OccasionProfile, TemplateId } from '@/domain/occasions';
import { TEMPLATES } from '@/domain/occasions';
import { ATTR_LABELS, getType } from '@/domain/taxonomy';
import type { AttrKey, Item, OutfitSlots, Slot } from '@/domain/types';

/** Spread between the most and least formal piece above this is filtered out. */
export const MAX_FORMALITY_SPREAD = 2;
export const HOT_C = 30;
export const COLD_C = 10;

export type Relax = 'none' | 'formality' | 'attrs' | 'both';

export interface ItemCheck { ok: boolean; reason?: string }

/** Whether an item may be used for an occasion at all (before building outfits). */
export function checkItem(item: Item, occ: OccasionProfile, relax: Relax = 'none'): ItemCheck {
  if (item.archived) return { ok: false, reason: 'archived' };
  const ov = item.overrides?.[occ.id] ?? (occ.baseId ? item.overrides?.[occ.baseId] : undefined);
  if (ov === 'never') return { ok: false, reason: `${item.name} is marked "never" for ${occ.short}` };
  if (ov === 'allow') return { ok: true };
  const relaxAttrs = relax === 'attrs' || relax === 'both';
  const relaxFormality = relax === 'formality' || relax === 'both';
  if (!relaxAttrs) {
    if (occ.bannedTypes.includes(item.type)) return { ok: false, reason: `${getType(item.type).plural} don't suit ${occ.short}` };
    for (const [k, vals] of Object.entries(occ.bannedAttrs) as [AttrKey, string[]][]) {
      if (vals?.includes(item.attrs[k] as string)) {
        return { ok: false, reason: `${ATTR_LABELS[k].values[item.attrs[k] as string]} ${getType(item.type).label.toLowerCase()} doesn't suit ${occ.short}` };
      }
    }
  }
  const [lo, hi] = occ.range;
  const slack = relaxFormality ? 1 : 0;
  if (item.formality < lo - slack || item.formality > hi + slack) {
    return { ok: false, reason: `${item.name} is ${item.formality < lo ? 'too casual' : 'too dressy'} for ${occ.short}` };
  }
  return { ok: true };
}

export function isAthleticShoe(item: Item) {
  return item.type === 'running-shoes' || item.type === 'sneakers';
}

export function inferTemplate(slots: OutfitSlots, byId: Map<string, Item>): TemplateId {
  const mid = slots.mid ? byId.get(slots.mid) : undefined;
  if (!slots.shoes) return 'basic-noshoes';
  if (mid && slots.outer) return 'mid-outer';
  if (mid) return mid.type === 'shirt' ? 'open-shirt' : 'mid';
  if (slots.outer) return 'outer';
  return 'basic';
}

export interface Violation { rule: string; text: string }

/** Structural rules for a whole outfit: layering, formality spread, shoes, occasion templates. */
export function outfitViolations(slots: OutfitSlots, byId: Map<string, Item>, occ: OccasionProfile, template: TemplateId): Violation[] {
  const v: Violation[] = [];
  const get = (s: Slot) => (slots[s] ? byId.get(slots[s]!) : undefined);
  const base = get('base'), mid = get('mid'), outer = get('outer'), bottom = get('bottom'), shoes = get('shoes');
  if (!base || !bottom) v.push({ rule: 'incomplete', text: 'An outfit needs a top and a bottom' });
  const pieces = [base, mid, outer, bottom, shoes].filter((x): x is Item => !!x);
  if (new Set(pieces.map((p) => p.id)).size !== pieces.length) v.push({ rule: 'duplicate', text: 'The same item is used twice' });
  for (const [s, it] of [['base', base], ['mid', mid], ['outer', outer], ['bottom', bottom], ['shoes', shoes]] as [Slot, Item | undefined][]) {
    if (it && !getType(it.type).slots.includes(s)) v.push({ rule: 'slot', text: `${it.name} can't be worn as ${s === 'base' ? 'a top' : `a ${s}`}` });
  }
  if (!occ.templates.includes(template)) {
    v.push({ rule: 'template', text: `${TEMPLATES[template].label} isn't a ${occ.short.toLowerCase()} look` });
  }
  if (!shoes && template !== 'basic-noshoes') v.push({ rule: 'shoes', text: 'Pick shoes' });
  if (pieces.length >= 2) {
    const fs = pieces.map((p) => p.formality);
    if (Math.max(...fs) - Math.min(...fs) > MAX_FORMALITY_SPREAD) v.push({ rule: 'spread', text: 'Mixes very dressy and very casual pieces' });
  }
  if (occ.minUpperFormality) {
    const upper = Math.max(...[base, mid, outer].filter((x): x is Item => !!x).map((p) => p.formality), 0);
    if (upper < occ.minUpperFormality) v.push({ rule: 'upper', text: `For ${occ.short}, wear a shirt or polo, or add a jacket` });
  }
  if (occ.requireAthleticShoes && shoes && !isAthleticShoe(shoes)) v.push({ rule: 'athletic', text: 'Wear running shoes or sneakers to the gym' });
  if (base?.type === 'kurta') {
    if (mid && mid.type !== 'vest') v.push({ rule: 'layering', text: 'A kurta layers with a waistcoat or Nehru jacket' });
    if (outer && outer.type !== 'blazer') v.push({ rule: 'layering', text: 'A kurta layers with a blazer, not a casual jacket' });
    if (bottom && !['pyjama', 'jeans', 'chinos', 'trousers'].includes(bottom.type)) v.push({ rule: 'layering', text: 'A kurta goes with a pyjama, trousers, chinos or jeans' });
  }
  if (base?.type === 'tank') {
    if (outer && ['blazer', 'coat', 'puffer'].includes(outer.type)) v.push({ rule: 'layering', text: `A tank top under a ${getType(outer.type).label.toLowerCase()} looks off` });
    if (mid && !['shirt', 'hoodie'].includes(mid.type)) v.push({ rule: 'layering', text: 'Over a tank top, layer an open shirt or a hoodie' });
  }
  if (mid?.type === 'shirt') {
    if (!mid.attrs.canOpen) v.push({ rule: 'layering', text: `${mid.name} isn't marked as wearable open` });
    if (base && !['tshirt', 'tank', 'henley'].includes(base.type)) v.push({ rule: 'layering', text: 'Wear an open shirt over a tee, tank or henley' });
  }
  if (mid && mid.type !== 'shirt' && base && ['sweater', 'hoodie', 'sweatshirt'].includes(base.type)) {
    v.push({ rule: 'layering', text: 'Two knit layers on top of each other' });
  }
  return v;
}
