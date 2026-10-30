import type { Family } from '@/domain/palette';
import type { AttrKey, Category } from '@/domain/types';

export interface ItemFilter {
  categories?: Category[];
  types?: string[];
  families?: Family[];
  shades?: string[];
  attrs?: Partial<Record<AttrKey, string[]>>;
  /** Only items that fit this occasion. */
  occasionId?: string;
  includeArchived?: boolean;
}

export interface Ambiguity {
  phrase: string;
  role: 'include' | 'exclude';
  candidates: string[];
}

export type WardrobeRequest =
  | { kind: 'inventory'; mode: 'count' | 'list'; filter: ItemFilter }
  | { kind: 'outfit'; occasionId: string; date: string; include: string[]; exclude: string[]; ambiguous: Ambiguity[]; missing: string[] }
  | { kind: 'log'; from: string; to: string; occasionId?: string; tags: string[]; itemIds: string[] }
  | { kind: 'unknown' };
