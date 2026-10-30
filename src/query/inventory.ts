import { resolveOccasion } from '@/domain/occasions';
import { familyOf } from '@/domain/palette';
import { categoryOf, getType } from '@/domain/taxonomy';
import type { CustomOccasion, Item } from '@/domain/types';
import { checkItem } from '@/engine/filters';
import { CLEAR_DE, shadeDeltaE } from '@/lib/colorMath';
import type { ItemFilter } from './types';

/** An exact shade also matches very close shades of the same family (navy includes midnight navy). */
function shadeMatches(itemShade: string, wanted: string[]): boolean {
  return wanted.some((s) => s === itemShade || (familyOf(s) === familyOf(itemShade) && shadeDeltaE(s, itemShade) < CLEAR_DE));
}

export function matchesFilter(item: Item, f: ItemFilter, custom: CustomOccasion[] = []): boolean {
  if (item.archived && !f.includeArchived) return false;
  if (f.categories?.length && !f.categories.includes(categoryOf(item.type))) return false;
  if (f.types?.length && !f.types.includes(item.type)) return false;
  if (f.families?.length && !f.families.includes(familyOf(item.primaryShade))) return false;
  if (f.shades?.length && !shadeMatches(item.primaryShade, f.shades)) return false;
  if (f.attrs) {
    for (const [k, vals] of Object.entries(f.attrs)) {
      if (vals?.length && !vals.includes(String(item.attrs[k as keyof typeof item.attrs]))) return false;
    }
  }
  if (f.occasionId && !checkItem(item, resolveOccasion(f.occasionId, custom)).ok) return false;
  return true;
}

export interface QueryResult {
  items: Item[];
  /** Counts add up quantities: two identical black shirts count as 2. */
  count: number;
}

export function queryItems(items: Item[], f: ItemFilter, custom: CustomOccasion[] = []): QueryResult {
  const found = items.filter((i) => matchesFilter(i, f, custom));
  return { items: found, count: found.reduce((s, i) => s + Math.max(1, i.quantity), 0) };
}

export function isEmptyFilter(f: ItemFilter): boolean {
  return !f.categories?.length && !f.types?.length && !f.families?.length && !f.shades?.length && !Object.values(f.attrs ?? {}).some((v) => v?.length) && !f.occasionId;
}

/** Groups items by category, in wardrobe order. */
export function groupByCategory(items: Item[]): { category: string; items: Item[] }[] {
  const order = ['tops', 'layers', 'outerwear', 'bottoms', 'shoes'];
  return order
    .map((c) => ({ category: c, items: items.filter((i) => getType(i.type).category === c) }))
    .filter((g) => g.items.length > 0);
}
