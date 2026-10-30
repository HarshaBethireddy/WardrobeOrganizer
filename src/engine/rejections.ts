import type { OutfitSlots, Rejection, Slot } from '@/domain/types';
import type { Item } from '@/domain/types';
import { familyOf, familyLabel } from '@/domain/palette';

export const outfitKey = (itemIds: string[]) => `o:${[...itemIds].sort().join(',')}`;
export const pairKey = (a: string, b: string) => `p:${[a, b].sort().join('|')}`;
export const itemKey = (id: string) => `i:${id}`;
/** Color pairings are tied to slots: a black top with a green bottom differs from a green top with a black bottom. */
export const colorsKey = (slotA: Slot, famA: string, slotB: Slot, famB: string) => {
  const a = `${slotA}:${famA}`, b = `${slotB}:${famB}`;
  return `c:${[a, b].sort().join('|')}`;
};

export interface RejectionIndex {
  outfits: Set<string>;
  pairs: Set<string>;
  colors: Set<string>;
  items: Set<string>;
}

export function indexRejections(rows: Rejection[]): RejectionIndex {
  const idx: RejectionIndex = { outfits: new Set(), pairs: new Set(), colors: new Set(), items: new Set() };
  for (const r of rows) {
    if (r.type === 'outfit') idx.outfits.add(r.key);
    else if (r.type === 'pair') idx.pairs.add(r.key);
    else if (r.type === 'colors') idx.colors.add(r.key);
    else if (r.type === 'item') idx.items.add(r.key.replace(/^i:/, ''));
  }
  return idx;
}

type Pieces = [Slot, Item][];

export function piecesOf(slots: OutfitSlots, byId: Map<string, Item>): Pieces {
  return (Object.entries(slots) as [Slot, string][])
    .map(([s, id]) => [s, byId.get(id)] as [Slot, Item | undefined])
    .filter((p): p is [Slot, Item] => !!p[1]);
}

/** Which rejection (if any) blocks this outfit. */
export function rejectionFor(pieces: Pieces, idx: RejectionIndex): string | null {
  for (const [, it] of pieces) if (idx.items.has(it.id)) return 'item';
  if (idx.outfits.has(outfitKey(pieces.map(([, i]) => i.id)))) return 'outfit';
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const [sa, a] = pieces[i], [sb, b] = pieces[j];
      if (idx.pairs.has(pairKey(a.id, b.id))) return 'pair';
      if (idx.colors.size && idx.colors.has(colorsKey(sa, familyOf(a.primaryShade), sb, familyOf(b.primaryShade)))) return 'colors';
    }
  }
  return null;
}

const SLOT_WORDS: Record<Slot, [string, string]> = {
  base: ['top', 'tops'],
  mid: ['layer', 'layers'],
  outer: ['jacket', 'jackets'],
  bottom: ['bottom', 'bottoms'],
  shoes: ['shoes', 'shoes'],
};

export interface RejectOption {
  type: Rejection['type'];
  key: string;
  label: string;
}

/** The choices offered in the reject sheet for an outfit card. */
export function rejectOptions(slots: OutfitSlots, byId: Map<string, Item>): RejectOption[] {
  const pieces = piecesOf(slots, byId);
  const opts: RejectOption[] = [{ type: 'outfit', key: outfitKey(pieces.map(([, i]) => i.id)), label: 'This exact outfit' }];
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i][1], b = pieces[j][1];
      opts.push({ type: 'pair', key: pairKey(a.id, b.id), label: `${a.name} + ${b.name} together` });
    }
  }
  const get = (s: Slot) => pieces.find(([slot]) => slot === s);
  const bottom = get('bottom');
  for (const upper of ['base', 'outer'] as Slot[]) {
    const u = get(upper);
    if (!u || !bottom) continue;
    const fa = familyOf(u[1].primaryShade), fb = familyOf(bottom[1].primaryShade);
    opts.push({
      type: 'colors',
      key: colorsKey(upper, fa, 'bottom', fb),
      label: `${familyLabel(fa as never)} ${SLOT_WORDS[upper][1]} with ${familyLabel(fb as never).toLowerCase()} bottoms`,
    });
  }
  for (const [, it] of pieces) opts.push({ type: 'item', key: itemKey(it.id), label: `Never suggest ${it.name}` });
  return opts;
}
