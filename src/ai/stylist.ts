import type { OccasionProfile } from '@/domain/occasions';
import { getShade } from '@/domain/palette';
import { getType } from '@/domain/taxonomy';
import type { Item, OutfitSlots, Slot } from '@/domain/types';
import { SLOT_ORDER } from '@/domain/types';
import type { ScoredOutfit, WeatherDay } from '@/engine/types';
import { CHECK_SYSTEM, REVIEW_SYSTEM, checkPrompt, reviewPrompt } from './prompts';
import { CheckSchema, ReviewSchema, type ReviewReply } from './schemas';
import { runJson, type RunOptions } from './service';

export const REVIEW_COUNT = 15;
export const REVIEW_TTL = 24 * 3600 * 1000;

export function describeItem(i: Item): string {
  return `${i.name} (${getType(i.type).label.toLowerCase()}, ${getShade(i.primaryShade)?.name.toLowerCase() ?? ''}, ${i.attrs.material})`;
}

export function describeOutfit(slots: OutfitSlots, byId: Map<string, Item>): string {
  return SLOT_ORDER.filter((s) => slots[s] && byId.has(slots[s]!))
    .map((s) => describeItem(byId.get(slots[s]!)!))
    .join(' + ');
}

export function weatherText(w: WeatherDay | null): string {
  if (!w) return 'unknown';
  return `high ${Math.round(w.tMax)}\u00b0C, low ${Math.round(w.tMin)}\u00b0C, ${Math.round(w.rainProb)}% chance of rain`;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function reviewCacheKey(outfits: ScoredOutfit[], occ: OccasionProfile, w: WeatherDay | null): string {
  const bucket = w ? `${Math.round(w.tMax / 5) * 5}:${w.rainProb >= 50 ? 'r' : 'd'}` : 'none';
  return `review:${occ.id}:${bucket}:${hash(outfits.slice(0, REVIEW_COUNT).map((o) => o.id).sort().join(';'))}`;
}

/**
 * Applies the stylist's order safely: unknown or repeated ids are ignored, outfits the reply skipped are
 * appended in the rules order, and no new outfit can ever be added.
 */
export function mergeReview(outfits: ScoredOutfit[], reply: ReviewReply, shortToId: Map<string, string>): ScoredOutfit[] {
  const byId = new Map(outfits.map((o) => [o.id, o]));
  const seen = new Set<string>();
  const out: ScoredOutfit[] = [];
  for (const r of reply.order) {
    const id = shortToId.get(r.id) ?? (byId.has(r.id) ? r.id : undefined);
    if (!id || seen.has(id)) continue;
    const o = byId.get(id);
    if (!o) continue;
    seen.add(id);
    out.push({ ...o, aiReason: r.reason.trim().slice(0, 140) || undefined, aiConcern: r.concern.trim().slice(0, 140) || undefined });
  }
  for (const o of outfits) if (!seen.has(o.id)) out.push(o);
  return out;
}

export async function reviewOutfits(
  outfits: ScoredOutfit[],
  occ: OccasionProfile,
  weather: WeatherDay | null,
  byId: Map<string, Item>,
  opts: RunOptions = {},
): Promise<ScoredOutfit[]> {
  const top = outfits.slice(0, REVIEW_COUNT);
  const shortToId = new Map(top.map((o, i) => [`o${i + 1}`, o.id]));
  const prompt = reviewPrompt(occ, weatherText(weather), top.map((o, i) => ({ id: `o${i + 1}`, text: describeOutfit(o.slots, byId) })));
  const { value } = await runJson({ system: REVIEW_SYSTEM, prompt, schema: ReviewSchema, timeoutMs: 25000 }, opts);
  return mergeReview(outfits, value, shortToId);
}

export interface CheckOpinion { opinion: string; swap?: { slot: Slot; itemId: string; reason: string } }

/** Keeps a swap only if it uses an item the user owns that can fill that slot. */
export function validSwap(slot: string, itemId: string, items: Item[], slots: OutfitSlots): CheckOpinion['swap'] {
  if (slot === 'none' || !itemId) return undefined;
  const it = items.find((i) => i.id === itemId && !i.archived);
  if (!it || !getType(it.type).slots.includes(slot as Slot)) return undefined;
  if (Object.values(slots).includes(itemId)) return undefined;
  return { slot: slot as Slot, itemId, reason: '' };
}

export async function checkOutfit(
  slots: OutfitSlots,
  occ: OccasionProfile,
  weather: WeatherDay | null,
  items: Item[],
  opts: RunOptions = {},
): Promise<CheckOpinion> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const alternatives: string[] = [];
  for (const s of SLOT_ORDER) {
    const alts = items.filter((i) => !i.archived && getType(i.type).slots.includes(s) && !Object.values(slots).includes(i.id)).slice(0, 8);
    alts.forEach((a) => alternatives.push(`${s} -> ${a.id}: ${describeItem(a)}`));
  }
  const { value } = await runJson(
    { system: CHECK_SYSTEM, prompt: checkPrompt(occ, weatherText(weather), describeOutfit(slots, byId), alternatives), schema: CheckSchema, timeoutMs: 30000 },
    opts,
  );
  const swap = validSwap(value.swapSlot, value.swapItemId, items, slots);
  return { opinion: value.opinion.trim().slice(0, 400), swap: swap ? { ...swap, reason: value.swapReason.trim().slice(0, 160) } : undefined };
}
