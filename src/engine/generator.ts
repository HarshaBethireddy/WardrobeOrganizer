import { TEMPLATES, type TemplateId } from '@/domain/occasions';
import { getType } from '@/domain/taxonomy';
import type { Item, OutfitSlots, Slot } from '@/domain/types';
import { checkItem, COLD_C, HOT_C, inferTemplate, isAthleticShoe, outfitViolations, type Relax } from './filters';
import { computePreferences } from './preferences';
import { indexRejections, piecesOf, rejectionFor, type RejectionIndex } from './rejections';
import { lastWornMap } from './rotation';
import { effectiveTemp, scoreOutfit, type ScoreContext } from './style-rules';
import type { EngineInput, Evaluation, GenerateResult, MissingPiece, ScoredOutfit } from './types';

const PAIR_KEEP = 28;
const SHOE_KEEP = 4;
const LAYER_KEEP = 4;
const DEFAULT_LIMIT = 60;
export const RAIN_PROB = 50;

export const RELAX_LABELS: Record<Exclude<Relax, 'none'>, string> = {
  formality: 'dress level relaxed by one step',
  attrs: 'occasion rules relaxed',
  both: 'occasion rules and dress level relaxed',
};

export function buildContext(input: EngineInput): ScoreContext {
  const byId = new Map(input.items.map((i) => [i.id, i]));
  return {
    occasion: input.occasion,
    byId,
    temp: effectiveTemp(input.weather, input.occasion),
    rainy: (input.weather?.rainProb ?? 0) >= RAIN_PROB,
    date: input.date,
    lastWorn: lastWornMap(input.logEntries, input.date),
    rotationDays: input.settings.rotationDays,
    prefs: input.settings.useHistory ? computePreferences(input.logEntries, input.likes, input.items, input.now ?? Date.now()) : null,
  };
}

const outfitId = (slots: OutfitSlots) => Object.values(slots).filter(Boolean).sort().join(',');

interface Pools { base: Item[]; mid: Item[]; outer: Item[]; bottom: Item[]; shoes: Item[] }

function buildPools(input: EngineInput, ctx: ScoreContext, idx: RejectionIndex, relax: Relax): { pools: Pools; problems: string[] } {
  const occ = input.occasion;
  const exclude = new Set(input.exclude ?? []);
  const include = input.include ?? [];
  const usable = input.items.filter((i) => !i.archived && !idx.items.has(i.id) && !exclude.has(i.id));
  const allowed = usable.filter((i) => include.includes(i.id) || checkItem(i, occ, relax).ok);
  const hot = ctx.temp !== null && ctx.temp >= HOT_C;
  const fill = (slot: Slot) => allowed.filter((i) => getType(i.type).slots.includes(slot));
  const pools: Pools = {
    base: fill('base'),
    mid: fill('mid').filter((i) => !hot || i.type === 'shirt' || i.warmth < 2),
    outer: hot ? fill('outer').filter((i) => include.includes(i.id)) : fill('outer'),
    bottom: fill('bottom'),
    shoes: fill('shoes').filter((i) => !occ.requireAthleticShoes || isAthleticShoe(i)),
  };
  const problems: string[] = [];
  const bySlot = new Map<Slot, Item[]>();
  for (const id of include) {
    const it = ctx.byId.get(id);
    if (!it || it.archived) { problems.push('An item you asked for is no longer in your wardrobe'); continue; }
    const slot = getType(it.type).slots[0];
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), it]);
  }
  for (const [slot, its] of bySlot) {
    if (its.length > 1) problems.push(`${its.map((i) => i.name).join(' and ')} can't be worn together`);
    pools[slot as keyof Pools] = its.slice(0, 1);
  }
  return { pools, problems };
}

interface RunResult { outfits: ScoredOutfit[]; hidden: number; considered: number; pools: Pools; problems: string[] }

function run(input: EngineInput, ctx: ScoreContext, idx: RejectionIndex, relax: Relax): RunResult {
  const occ = input.occasion;
  const { pools, problems } = buildPools(input, ctx, idx, relax);
  const include = input.include ?? [];
  const byId = ctx.byId;
  const needLayer = ctx.temp !== null && ctx.temp <= COLD_C && pools.mid.length + pools.outer.length > 0;
  let hidden = 0, considered = 0;
  const cache = new Map<string, number>();
  const quick = (slots: OutfitSlots) => {
    const key = Object.entries(slots).map(([s, id]) => `${s}=${id}`).sort().join('&');
    let s = cache.get(key);
    if (s === undefined) { s = scoreOutfit(slots, ctx).score; cache.set(key, s); }
    return s;
  };

  const pairs: { base: Item; bottom: Item; s: number }[] = [];
  for (const base of pools.base) {
    for (const bottom of pools.bottom) {
      if (base.id === bottom.id) continue;
      if (Math.abs(base.formality - bottom.formality) > 2) continue;
      if (rejectionFor(piecesOf({ base: base.id, bottom: bottom.id }, byId), idx)) { hidden++; continue; }
      pairs.push({ base, bottom, s: quick({ base: base.id, bottom: bottom.id }) });
    }
  }
  pairs.sort((a, b) => b.s - a.s);
  const best = new Map<string, ScoredOutfit>();
  const top = (cands: Item[], make: (i: Item) => OutfitSlots, n: number) =>
    cands.map((i) => ({ i, s: quick(make(i)) })).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.i);

  for (const { base, bottom } of pairs.slice(0, PAIR_KEEP)) {
    const core: OutfitSlots = { base: base.id, bottom: bottom.id };
    const shoes = top(pools.shoes.filter((s) => s.id !== base.id), (s) => ({ ...core, shoes: s.id }), SHOE_KEEP);
    const knits = top(pools.mid.filter((m) => m.type !== 'shirt' && m.id !== base.id), (m) => ({ ...core, mid: m.id }), LAYER_KEEP);
    const opens = top(pools.mid.filter((m) => m.type === 'shirt' && m.id !== base.id), (m) => ({ ...core, mid: m.id }), 3);
    const outers = top(pools.outer, (o) => ({ ...core, outer: o.id }), LAYER_KEEP);
    const layerSets: [TemplateId, OutfitSlots][] = [];
    for (const t of occ.templates) {
      if (t === 'basic' || t === 'basic-noshoes') layerSets.push([t, {}]);
      if (t === 'outer') outers.forEach((o) => layerSets.push([t, { outer: o.id }]));
      if (t === 'mid') knits.forEach((m) => layerSets.push([t, { mid: m.id }]));
      if (t === 'open-shirt') opens.forEach((m) => layerSets.push([t, { mid: m.id }]));
      if (t === 'mid-outer') knits.slice(0, 2).forEach((m) => outers.slice(0, 3).forEach((o) => layerSets.push([t, { mid: m.id, outer: o.id }])));
    }
    for (const [template, layers] of layerSets) {
      const shoeOptions: (Item | null)[] = TEMPLATES[template].slots.includes('shoes') ? shoes : [null];
      for (const sh of shoeOptions) {
        const slots: OutfitSlots = { ...core, ...layers, ...(sh ? { shoes: sh.id } : {}) };
        considered++;
        if (outfitViolations(slots, byId, occ, template).length) continue;
        if (needLayer && !slots.mid && !slots.outer) continue;
        if (rejectionFor(piecesOf(slots, byId), idx)) { hidden++; continue; }
        const ids = Object.values(slots);
        if (!include.every((id) => ids.includes(id))) continue;
        const id = outfitId(slots);
        const scored = scoreOutfit(slots, ctx);
        const prev = best.get(id);
        if (!prev || prev.score < scored.score) best.set(id, { id, template, slots, ...scored });
      }
    }
  }
  const outfits = [...best.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, input.limit ?? DEFAULT_LIMIT);
  return { outfits, hidden, considered, pools, problems };
}
const GENERIC_HINTS: Record<Slot, string> = { base: 'a top', mid: 'a layer', outer: 'a jacket', bottom: 'a bottom', shoes: 'shoes' };

/** Builds every valid outfit for the occasion, scores it, and explains what's missing if nothing fits. */
export function generate(input: EngineInput): GenerateResult {
  const ctx = buildContext(input);
  const idx = indexRejections(input.rejections);
  const first = run(input, ctx, idx, 'none');
  const bannedItems = input.items.filter((i) => !i.archived && idx.items.has(i.id)).length;
  const missing: MissingPiece[] = [];
  const needsShoes = input.occasion.templates.some((t) => TEMPLATES[t].slots.includes('shoes')) && !input.occasion.templates.includes('basic-noshoes');
  for (const slot of ['base', 'bottom', 'shoes'] as Slot[]) {
    if (slot === 'shoes' && !needsShoes) continue;
    if (first.pools[slot as 'base'].length === 0) missing.push({ slot, hint: input.occasion.missingHints[slot] ?? GENERIC_HINTS[slot] });
  }
  if (first.outfits.length > 0) {
    return { outfits: first.outfits, hiddenByRejections: first.hidden + bannedItems, missing, relaxed: null, considered: first.considered, includeProblems: first.problems };
  }
  for (const relax of ['formality', 'attrs', 'both'] as Relax[]) {
    const r = run({ ...input, limit: 12 }, ctx, idx, relax);
    if (r.outfits.length) {
      const outfits = r.outfits.map((o) => ({
        ...o,
        warnings: piecesOf(o.slots, ctx.byId)
          .map(([, it]) => checkItem(it, input.occasion, 'none'))
          .filter((c) => !c.ok && c.reason)
          .map((c) => c.reason!),
      }));
      return { outfits, hiddenByRejections: r.hidden + bannedItems, missing, relaxed: RELAX_LABELS[relax as Exclude<Relax, 'none'>], considered: r.considered, includeProblems: r.problems };
    }
  }
  return { outfits: [], hiddenByRejections: first.hidden + bannedItems, missing, relaxed: null, considered: first.considered, includeProblems: first.problems };
}

/** Scores an outfit the user put together. Rule breaks become warnings instead of blocking it. */
export function evaluate(input: EngineInput, slots: OutfitSlots): Evaluation {
  const ctx = buildContext(input);
  const idx = indexRejections(input.rejections);
  const byId = ctx.byId;
  const template = inferTemplate(slots, byId);
  const warnings = outfitViolations(slots, byId, input.occasion, template).map((v) => v.text);
  for (const [, it] of piecesOf(slots, byId)) {
    const c = checkItem(it, input.occasion, 'none');
    if (!c.ok && c.reason && c.reason !== 'archived') warnings.push(c.reason);
    if (it.archived) warnings.push(`${it.name} is archived`);
  }
  if (ctx.temp !== null && ctx.temp >= HOT_C && slots.outer) warnings.push(`${Math.round(ctx.temp)}\u00b0C is too hot for a jacket`);
  if (ctx.temp !== null && ctx.temp <= COLD_C && !slots.mid && !slots.outer) warnings.push(`${Math.round(ctx.temp)}\u00b0C: add a layer`);
  const rej = rejectionFor(piecesOf(slots, byId), idx);
  if (rej) warnings.push('You rejected this combination before');
  const s = scoreOutfit(slots, ctx);
  return { score: s.score, pattern: s.pattern, reasons: s.reasons, warnings: [...new Set(warnings)] };
}

/** Pages of outfits where no top + bottom pair repeats within a page. */
export function paginate<T extends { slots: OutfitSlots }>(outfits: T[], size = 6): T[][] {
  const pages: T[][] = [];
  let rest = [...outfits];
  while (rest.length) {
    const page: T[] = [];
    const used = new Set<string>();
    const left: T[] = [];
    for (const o of rest) {
      const key = `${o.slots.base}|${o.slots.bottom}`;
      if (page.length < size && !used.has(key)) { page.push(o); used.add(key); } else left.push(o);
    }
    pages.push(page);
    rest = left;
  }
  return pages;
}
