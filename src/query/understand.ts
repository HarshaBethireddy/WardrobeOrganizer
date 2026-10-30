import { allOccasions, resolveOccasion } from '@/domain/occasions';
import { FAMILY_IDS, SHADE_IDS, familyLabel, getShade, type Family } from '@/domain/palette';
import { ATTR_LABELS, CATEGORIES, findType, getType } from '@/domain/taxonomy';
import { ATTR_VALUES, type AttrKey, type Category } from '@/domain/types';
import { AiRequestSchema, type AiRequest } from '@/ai/schemas';
import { PARSE_SYSTEM, parsePrompt } from '@/ai/prompts';
import { runJson, type RunOptions } from '@/ai/service';
import { addDaysStr, friendlyDate, todayStr } from '@/lib/dates';
import { parseRequest, type ParseContext } from './parser';
import type { ItemFilter, WardrobeRequest } from './types';

export const PARSE_TIMEOUT_MS = 5000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const validDate = (s: string | undefined) => (s && DATE_RE.test(s) && !Number.isNaN(Date.parse(s)) ? s : undefined);

/** Converts an AI interpretation into a request, dropping anything that isn't a known value or an owned item. */
export function fromAi(ai: AiRequest, ctx: ParseContext): WardrobeRequest {
  const custom = ctx.custom ?? [];
  const occIds = new Set(allOccasions(custom).map((o) => o.id));
  const owned = new Set(ctx.items.filter((i) => !i.archived).map((i) => i.id));
  const today = todayStr(ctx.now ?? new Date());
  const occasionId = ai.occasionId && occIds.has(ai.occasionId) ? ai.occasionId : undefined;
  if (ai.kind === 'inventory') {
    const attrs: ItemFilter['attrs'] = {};
    for (const a of ai.attributes ?? []) {
      const [k, v] = a.split(':').map((x) => x.trim().toLowerCase());
      if (k in ATTR_VALUES && ATTR_VALUES[k as AttrKey].includes(v)) attrs[k as AttrKey] = [...(attrs[k as AttrKey] ?? []), v];
    }
    const filter: ItemFilter = {
      categories: ai.categories?.filter((c) => CATEGORIES.some((x) => x.id === c)) as Category[] | undefined,
      types: ai.types?.filter((t) => !!findType(t)),
      families: ai.families?.filter((f) => FAMILY_IDS.includes(f as Family)) as Family[] | undefined,
      shades: ai.shades?.filter((s) => SHADE_IDS.includes(s)),
      attrs: Object.keys(attrs).length ? attrs : undefined,
      occasionId,
    };
    return { kind: 'inventory', mode: ai.mode ?? 'list', filter };
  }
  if (ai.kind === 'outfit') {
    return {
      kind: 'outfit',
      occasionId: occasionId ?? 'casual',
      date: validDate(ai.date) ?? today,
      include: [...new Set((ai.include ?? []).filter((id) => owned.has(id)))],
      exclude: [...new Set((ai.exclude ?? []).filter((id) => owned.has(id)))],
      ambiguous: [],
      missing: [],
    };
  }
  if (ai.kind === 'log') {
    const from = validDate(ai.from) ?? validDate(ai.date) ?? addDaysStr(today, -29);
    const to = validDate(ai.to) ?? validDate(ai.date) ?? today;
    return { kind: 'log', from: from <= to ? from : to, to: from <= to ? to : from, occasionId, tags: ai.tags ?? [], itemIds: [] };
  }
  return { kind: 'unknown' };
}

export interface Understood { request: WardrobeRequest; via: 'ai' | 'keywords'; provider?: string }

/**
 * Tries the AI (5 s limit) and falls back to the keyword parser when the AI is off, offline, slow or unclear.
 * Only text is sent: short item names, never photos.
 */
export async function understand(text: string, ctx: ParseContext, opts: RunOptions & { useAi: boolean }): Promise<Understood> {
  const keywords = () => parseRequest(text, ctx);
  if (!opts.useAi) return { request: keywords(), via: 'keywords' };
  const today = todayStr(ctx.now ?? new Date());
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'local';
  try {
    const { value, provider } = await runJson(
      {
        system: PARSE_SYSTEM,
        prompt: parsePrompt(text, today, tz, allOccasions(ctx.custom ?? []), ctx.items.filter((i) => !i.archived)),
        schema: AiRequestSchema,
        timeoutMs: PARSE_TIMEOUT_MS,
      },
      opts,
    );
    const request = fromAi(value, ctx);
    if (request.kind === 'unknown') {
      const kw = keywords();
      return kw.kind === 'unknown' ? { request, via: 'ai', provider } : { request: kw, via: 'keywords' };
    }
    if (request.kind === 'outfit') {
      // Keep the keyword parser's "which one?" questions for vague item references the AI resolved by guessing.
      const kw = keywords();
      if (kw.kind === 'outfit' && kw.ambiguous.length && !request.include.length) return { request: { ...request, ambiguous: kw.ambiguous }, via: 'ai', provider };
    }
    return { request, via: 'ai', provider };
  } catch {
    return { request: keywords(), via: 'keywords' };
  }
}

function filterText(f: ItemFilter): string {
  const color = [...(f.families ?? []).map((x) => familyLabel(x)), ...(f.shades ?? []).map((s) => getShade(s)?.name ?? s)].join(' or ');
  const attrs = Object.entries(f.attrs ?? {}).flatMap(([k, vs]) => (vs ?? []).slice(0, 1).map((v) => ATTR_LABELS[k as AttrKey].values[v]?.toLowerCase() ?? v));
  const what = [
    ...(f.types ?? []).map((t) => getType(t).plural.toLowerCase()),
    ...(f.categories ?? []).map((c) => CATEGORIES.find((x) => x.id === c)?.plural.toLowerCase() ?? c),
  ].join(' or ');
  const s = [color, ...attrs, what || 'items'].filter(Boolean).join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The "Understood as" text shown on the editable chip. */
export function describeRequest(r: WardrobeRequest, custom: Parameters<typeof resolveOccasion>[1] = [], now = new Date()): string {
  if (r.kind === 'inventory') {
    const occ = r.filter.occasionId ? ` for ${resolveOccasion(r.filter.occasionId, custom).short}` : '';
    return `${r.mode === 'count' ? 'Count' : 'Show'} \u00b7 ${filterText(r.filter)}${occ}`;
  }
  if (r.kind === 'outfit') return `${resolveOccasion(r.occasionId, custom).name} \u00b7 ${friendlyDate(r.date, now)}`;
  if (r.kind === 'log') {
    const when = r.from === r.to ? friendlyDate(r.from, now) : `${friendlyDate(r.from, now)} \u2013 ${friendlyDate(r.to, now)}`;
    return `What you wore \u00b7 ${when}${r.occasionId ? ` \u00b7 ${resolveOccasion(r.occasionId, custom).short}` : ''}`;
  }
  return 'Not sure';
}

export { filterText };
