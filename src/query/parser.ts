import { allOccasions, DEFAULT_OCCASION } from '@/domain/occasions';
import { FAMILIES, SHADES, type Family } from '@/domain/palette';
import { ITEM_TYPES } from '@/domain/taxonomy';
import type { AttrKey, Category, CustomOccasion, Item } from '@/domain/types';
import { addDaysStr, todayStr } from '@/lib/dates';
import { findDate } from './dates';
import { queryItems } from './inventory';
import type { Ambiguity, ItemFilter, WardrobeRequest } from './types';

type Effect =
  | { k: 'type'; v: string[] }
  | { k: 'category'; v: Category[] }
  | { k: 'family'; v: Family }
  | { k: 'shade'; v: string }
  | { k: 'attr'; key: AttrKey; v: string[] }
  | { k: 'any' };

interface Entry { phrase: string; effect: Effect }

const ATTR_WORDS: [string[], AttrKey, string[]][] = [
  [['ripped', 'rugged', 'distressed', 'torn', 'destroyed', 'rips'], 'distress', ['ripped', 'heavy']],
  [['faded'], 'distress', ['faded']],
  [['half zip', 'half-zip', 'quarter zip', 'quarter-zip'], 'closure', ['half-zip']],
  [['zip', 'zipper', 'zipped', 'zip-up', 'zip up', 'zippered', 'zips'], 'closure', ['zipper', 'half-zip']],
  [['button', 'buttons', 'buttoned', 'button-up', 'button up'], 'closure', ['buttons']],
  [['sleeveless'], 'sleeve', ['sleeveless']],
  [['full sleeve', 'full sleeves', 'full-sleeve', 'long sleeve', 'long sleeves', 'long-sleeve', 'full hand'], 'sleeve', ['long']],
  [['half sleeve', 'half sleeves', 'half-sleeve', 'short sleeve', 'short sleeves', 'short-sleeve', 'half hand'], 'sleeve', ['short']],
  [['striped', 'stripes', 'stripe', 'stripy'], 'pattern', ['stripes']],
  [['checked', 'checks', 'check', 'plaid', 'checkered', 'chequered', 'tartan'], 'pattern', ['checks']],
  [['graphic', 'printed', 'print', 'prints'], 'pattern', ['graphic', 'print']],
  [['floral', 'flowery'], 'pattern', ['floral']],
  [['plain', 'solid'], 'pattern', ['solid', 'small-logo']],
  [['shaded', 'ombre', 'gradient', 'two-tone', 'two tone'], 'wash', ['ombre']],
  [['acid wash', 'acid-wash', 'stone wash', 'stonewash', 'stone-wash'], 'wash', ['acid']],
  [['light wash', 'light-wash'], 'wash', ['light']],
  [['dark wash', 'dark-wash', 'raw denim'], 'wash', ['dark', 'raw']],
  [['slim', 'slim fit', 'slim-fit'], 'fit', ['slim', 'skinny']],
  [['oversized', 'baggy'], 'fit', ['oversized', 'relaxed']],
  [['linen'], 'material', ['linen']],
  [['leather'], 'material', ['leather']],
  [['suede'], 'material', ['suede']],
  [['wool', 'woollen', 'woolen', 'wollen'], 'material', ['wool']],
  [['knit', 'knitted'], 'material', ['knit']],
  [['fleece'], 'material', ['fleece']],
  [['corduroy', 'cord'], 'material', ['corduroy']],
  [['cotton'], 'material', ['cotton']],
  [['silk', 'silky'], 'material', ['silk']],
  [['denim'], 'material', ['denim']],
];

const CATEGORY_WORDS: [string[], Category[]][] = [
  [['tops', 'top', 'upper wear', 'upperwear'], ['tops', 'layers']],
  [['jackets', 'jacket', 'outerwear', 'outer wear', 'outer layers'], ['outerwear']],
  [['layers', 'layer', 'knitwear', 'warm wear', 'winter wear'], ['layers', 'outerwear']],
  [['pants', 'bottoms', 'bottom', 'bottom wear', 'bottomwear', 'lowers', 'lower'], ['bottoms']],
  [['shoes', 'shoe', 'footwear', 'foot wear'], ['shoes']],
];
const ANY_WORDS = ['clothes', 'stuff', 'things', 'items', 'everything', 'anything', 'clothing', 'pieces', 'garments', 'wardrobe', 'dresses'];
const FAMILY_SHADES = new Set(FAMILIES.map((f) => f.id as string));

let LEXICON: Entry[] | null = null;
function lexicon(): Entry[] {
  if (LEXICON) return LEXICON;
  const out: Entry[] = [];
  const add = (phrase: string, effect: Effect) => out.push({ phrase: phrase.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim(), effect });
  for (const [words, cats] of CATEGORY_WORDS) words.forEach((w) => add(w, { k: 'category', v: cats }));
  const taken = new Set(out.map((e) => e.phrase));
  for (const t of ITEM_TYPES) {
    for (const w of [t.id, t.label, t.plural, ...t.synonyms]) {
      const p = w.toLowerCase().replace(/-/g, ' ');
      if (!taken.has(p)) { add(p, { k: 'type', v: [t.id] }); taken.add(p); }
    }
  }
  for (const f of FAMILIES) f.words.forEach((w) => add(w, { k: 'family', v: f.id }));
  for (const s of SHADES) {
    for (const w of [s.id.replace(/-/g, ' '), s.name, ...s.aliases]) if (!FAMILY_SHADES.has(w.toLowerCase())) add(w, { k: 'shade', v: s.id });
  }
  for (const [words, key, v] of ATTR_WORDS) words.forEach((w) => add(w, { k: 'attr', key, v }));
  ANY_WORDS.forEach((w) => add(w, { k: 'any' }));
  LEXICON = out.sort((a, b) => b.phrase.length - a.phrase.length);
  return LEXICON;
}

export const normalizeText = (s: string) =>
  s.toLowerCase().replace(/[\u2019']/g, "'").replace(/(\w)-(\w)/g, '$1 $2').replace(/[^a-z0-9/' ]+/g, ' ').replace(/\s+/g, ' ').trim();

interface Hit { start: number; end: number; effect: Effect; phrase: string }

/** Finds lexicon phrases in text (longest first, no overlaps), with word positions. */
export function scan(text: string): Hit[] {
  const words = normalizeText(text).split(' ').filter(Boolean);
  const used = new Array<boolean>(words.length).fill(false);
  const hits: Hit[] = [];
  for (const entry of lexicon()) {
    const pw = entry.phrase.split(' ');
    for (let i = 0; i + pw.length <= words.length; i++) {
      let ok = true;
      for (let j = 0; j < pw.length; j++) if (used[i + j] || words[i + j] !== pw[j]) { ok = false; break; }
      if (!ok) continue;
      for (let j = 0; j < pw.length; j++) used[i + j] = true;
      hits.push({ start: i, end: i + pw.length, effect: entry.effect, phrase: entry.phrase });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

function addTo<T>(arr: T[] | undefined, v: T | T[]): T[] {
  const next = [...(arr ?? [])];
  for (const x of Array.isArray(v) ? v : [v]) if (!next.includes(x)) next.push(x);
  return next;
}

export function filterFrom(hits: Hit[]): ItemFilter {
  const f: ItemFilter = {};
  for (const h of hits) {
    const e = h.effect;
    if (e.k === 'type') f.types = addTo(f.types, e.v);
    else if (e.k === 'category') f.categories = addTo(f.categories, e.v);
    else if (e.k === 'family') f.families = addTo(f.families, e.v);
    else if (e.k === 'shade') f.shades = addTo(f.shades, e.v);
    else if (e.k === 'attr') f.attrs = { ...f.attrs, [e.key]: addTo(f.attrs?.[e.key], e.v) };
  }
  return f;
}

export interface ParseContext {
  items: Item[];
  custom?: CustomOccasion[];
  now?: Date;
  knownTags?: string[];
}

function findOccasion(text: string, custom: CustomOccasion[]): string | undefined {
  const t = ` ${normalizeText(text)} `;
  let best: { id: string; pos: number; len: number } | undefined;
  for (const o of allOccasions(custom)) {
    for (const syn of [...o.synonyms, o.name.toLowerCase()]) {
      const pos = t.indexOf(` ${syn} `);
      if (pos < 0) continue;
      if (!best || pos < best.pos || (pos === best.pos && syn.length > best.len)) best = { id: o.id, pos, len: syn.length };
    }
  }
  return best?.id;
}

const LOG_CUE = /\b(wore|worn|did i (last |even )?wear|have i (ever )?worn|what i wore|i wore|history|logged|last wore|last wear)\b/;
const COUNT_CUE = /\b(how many|how much|count|number of|total)\b/;
const INVENTORY_CUE = /\b(how many|how much|count|number of|do i (have|own)|have i got|show( me)?|list|which|any|find|what .*(do i have|i have|i own))\b/;
const STRONG_OUTFIT_CUE = /\b(outfit|outfits|goes with|go with|pair|pairing|style|styling|combo|combination|combine|match|matches|suggest|what to wear|what (should|can|do|shall) i wear)\b/;
const OUTFIT_CUE = /\b(wear|outfit|outfits|dress|dressed|suggest|suggestion|style|styling|pair|pairing|match|matches|goes with|go with|combo|combination|combine|look|looks|put on|put together)\b/;
const EXCLUDE_CUE = new Set(['without', 'no', 'not', 'except', 'skip', 'avoid', 'minus', 'excluding', 'dont', "don't", 'other']);

interface Ref { phrase: string; filter: ItemFilter; role: 'include' | 'exclude' }

/** Groups adjacent color/detail/type words into item references like "my beige jacket". */
function itemRefs(text: string): Ref[] {
  const words = normalizeText(text).split(' ').filter(Boolean);
  const hits = scan(text).filter((h) => h.effect.k !== 'any');
  const refs: Ref[] = [];
  let group: Hit[] = [];
  const flush = () => {
    if (group.some((h) => h.effect.k === 'type' || h.effect.k === 'category')) {
      const start = group[0].start;
      const before = words.slice(Math.max(0, start - 3), start);
      refs.push({
        phrase: words.slice(start, group[group.length - 1].end).join(' '),
        filter: filterFrom(group),
        role: before.some((w) => EXCLUDE_CUE.has(w)) ? 'exclude' : 'include',
      });
    }
    group = [];
  };
  for (const h of hits) {
    const prev = group[group.length - 1];
    const gap = prev ? words.slice(prev.end, h.start) : [];
    if (prev && (gap.length > 1 || (gap.length === 1 && !['my', 'the', 'a', 'and', 'with'].includes(gap[0])) || gap.includes('and') || gap.includes('with'))) flush();
    group.push(h);
  }
  flush();
  return refs;
}

/** Understands a typed request offline using keyword lists. */
export function parseRequest(text: string, ctx: ParseContext): WardrobeRequest {
  const now = ctx.now ?? new Date();
  const custom = ctx.custom ?? [];
  const t = normalizeText(text);
  if (!t) return { kind: 'unknown' };
  const today = todayStr(now);
  const occasionId = findOccasion(t, custom);
  const active = ctx.items.filter((i) => !i.archived);

  if (LOG_CUE.test(t)) {
    const hit = findDate(t, now, 'past');
    const refs = itemRefs(t);
    const itemIds = refs.flatMap((r) => queryItems(active, r.filter, custom).items.map((i) => i.id));
    const tags = (ctx.knownTags ?? []).filter((tag) => ` ${t} `.includes(` ${tag.toLowerCase()} `));
    return { kind: 'log', from: hit?.from ?? addDaysStr(today, -29), to: hit?.to ?? today, occasionId, tags, itemIds: [...new Set(itemIds)] };
  }
  const hits = scan(t);
  const filter = filterFrom(hits);
  const hasItemWords = hits.length > 0;
  if (INVENTORY_CUE.test(t) && (hasItemWords || COUNT_CUE.test(t)) && (COUNT_CUE.test(t) || !STRONG_OUTFIT_CUE.test(t))) {
    return { kind: 'inventory', mode: COUNT_CUE.test(t) ? 'count' : 'list', filter: occasionId ? { ...filter, occasionId } : filter };
  }
  if (occasionId || OUTFIT_CUE.test(t)) {
    const date = findDate(t, now, 'future')?.from ?? today;
    const include: string[] = [], exclude: string[] = [], ambiguous: Ambiguity[] = [], missing: string[] = [];
    for (const r of itemRefs(t)) {
      const found = queryItems(active, r.filter, custom).items;
      if (!found.length) missing.push(r.phrase);
      else if (r.role === 'exclude') exclude.push(...found.map((i) => i.id));
      else if (found.length === 1) include.push(found[0].id);
      else ambiguous.push({ phrase: r.phrase, role: 'include', candidates: found.map((i) => i.id) });
    }
    return { kind: 'outfit', occasionId: occasionId ?? DEFAULT_OCCASION, date, include: [...new Set(include)], exclude: [...new Set(exclude)], ambiguous, missing };
  }
  if (hasItemWords) return { kind: 'inventory', mode: 'list', filter };
  if (findDate(t, now, 'future')) return { kind: 'outfit', occasionId: DEFAULT_OCCASION, date: findDate(t, now, 'future')!.from, include: [], exclude: [], ambiguous: [], missing: [] };
  return { kind: 'unknown' };
}

export const EXAMPLE_QUESTIONS = [
  'How many white shirts do I have?',
  'Office tomorrow',
  'What did I wear last Friday?',
  'What goes with my beige jacket?',
  'Any ripped jeans?',
  'Party on Saturday',
];
