import { ITEM_TYPES, autoName, defaultAttrs, defaultFormality, defaultWarmth, findType } from '@/domain/taxonomy';
import { SHADES, getShade } from '@/domain/palette';
import { ATTR_VALUES, type AttrKey, type ItemAttrs, type ItemSource } from '@/domain/types';
import type { LooseTag } from './schemas';

export interface ItemDraft {
  type?: string;
  name: string;
  nameEdited?: boolean;
  primaryShade?: string;
  secondaryShade?: string;
  attrs: ItemAttrs;
  formality: number;
  warmth: number;
  formalityManual?: boolean;
  quantity: number;
  overrides: Record<string, 'allow' | 'never'>;
  source: ItemSource;
  confidence?: number;
}

const norm = (s: string) => s.toLowerCase().trim().replace(/[\s_]+/g, '-');

const SYNONYMS: Partial<Record<AttrKey | 'type', Record<string, string>>> = {
  closure: { zip: 'zipper', 'full-zip': 'zipper', zipped: 'zipper', 'zip-up': 'zipper', button: 'buttons', 'button-up': 'buttons', buttoned: 'buttons', pullover: 'none', lace: 'laces', 'lace-up': 'laces', slipon: 'slip-on', velcro: 'straps', snap: 'snaps' },
  sleeve: { 'no-sleeves': 'sleeveless', none: 'sleeveless', half: 'short', 'short-sleeve': 'short', full: 'long', 'long-sleeve': 'long', 'full-sleeve': 'long', '3/4': 'three-quarter' },
  pattern: { plain: 'solid', plaid: 'checks', checked: 'checks', check: 'checks', striped: 'stripes', printed: 'print', logo: 'small-logo', 'color-block': 'colorblock', camouflage: 'camo' },
  wash: { 'dark-wash': 'dark', 'light-wash': 'light', 'medium-wash': 'medium', 'stone-wash': 'acid', stonewash: 'acid', 'acid-wash': 'acid', gradient: 'ombre', shaded: 'ombre', 'two-tone': 'ombre', rinse: 'dark', 'n/a': 'na', none: 'na' },
  distress: { ripped: 'ripped', distressed: 'ripped', torn: 'ripped', destroyed: 'heavy', rugged: 'ripped', clean: 'none' },
  fit: { loose: 'relaxed', baggy: 'relaxed', 'n/a': 'na' },
  material: { polyester: 'synthetic', nylon: 'synthetic', cotton_blend: 'cotton', jersey_knit: 'jersey', wool_blend: 'wool', 'faux-leather': 'leather', velvet: 'other' },
  type: { 't-shirt': 'tshirt', tee: 'tshirt', 'tank-top': 'tank', 'polo-shirt': 'polo', jean: 'jeans', pants: 'trousers', sneaker: 'sneakers', trainers: 'sneakers', 'formal-shoe': 'formal-shoes', oxford: 'formal-shoes', derby: 'formal-shoes', loafer: 'loafers', boot: 'boots', 'zip-jacket': 'jacket', 'nehru-jacket': 'vest', waistcoat: 'vest' },
};

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/** Maps a value to the closest allowed one (exact, synonym, then small spelling distance). */
export function closestAllowed(value: string, allowed: readonly string[], key?: AttrKey | 'type', fallback?: string): string | undefined {
  const v = norm(value ?? '');
  if (allowed.includes(v)) return v;
  const syn = key ? SYNONYMS[key]?.[v] : undefined;
  if (syn && allowed.includes(syn)) return syn;
  let best: string | undefined, bestD = Infinity;
  for (const a of allowed) {
    const d = levenshtein(v, a);
    if (d < bestD) { bestD = d; best = a; }
  }
  return bestD <= 2 ? best : fallback;
}

function closestShade(v: string): string | undefined {
  const n = norm(v);
  const direct = SHADES.find((s) => s.id === n || norm(s.name) === n || s.aliases.map(norm).includes(n));
  return direct?.id ?? closestAllowed(n, SHADES.map((s) => s.id));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/**
 * Turns an AI reply into a draft: unknown values map to the closest allowed one, formality stays within 1 of the type default,
 * and the AI's shade wins over pixel colors when both exist.
 */
export function draftFromTag(tag: LooseTag, pixel: { primary?: string; secondary?: string }, source: ItemSource = 'ai'): ItemDraft {
  const type = closestAllowed(tag.type, ITEM_TYPES.map((t) => t.id), 'type');
  const attrs: ItemAttrs = type ? defaultAttrs(type) : defaultAttrs('tshirt');
  for (const k of Object.keys(ATTR_VALUES) as AttrKey[]) {
    const raw = (tag as Record<string, unknown>)[k];
    if (typeof raw !== 'string') continue;
    const v = closestAllowed(raw, ATTR_VALUES[k], k);
    if (v) (attrs as unknown as Record<string, string>)[k] = v;
  }
  attrs.canOpen = type === 'shirt' ? tag.canOpen !== false : false;
  const aiPrimary = closestShade(tag.primaryShade);
  const aiSecondary = tag.secondaryShade && norm(tag.secondaryShade) !== 'none' ? closestShade(tag.secondaryShade) : undefined;
  const primaryShade = aiPrimary ?? pixel.primary;
  let secondaryShade = aiSecondary ?? pixel.secondary;
  if (secondaryShade === primaryShade) secondaryShade = undefined;
  const def = type ? defaultFormality(type, attrs) : 3;
  const formality = clamp(Number.isFinite(tag.formality) ? tag.formality : def, Math.max(1, def - 1), Math.min(5, def + 1));
  const warmth = clamp(Number.isFinite(tag.warmth) ? tag.warmth : type ? defaultWarmth(type, attrs) : 2, 1, 3);
  const name = tag.name?.trim() ? tag.name.trim().slice(0, 60) : type ? autoName(type, primaryShade, attrs) : '';
  return { type, name, primaryShade, secondaryShade, attrs, formality, warmth, quantity: 1, overrides: {}, source, confidence: tag.confidence };
}

/** A draft with no AI: pixel colors plus defaults. The user picks the type. */
export function manualDraft(pixel: { primary?: string; secondary?: string }, type?: string): ItemDraft {
  const attrs = type ? defaultAttrs(type) : defaultAttrs('tshirt');
  return {
    type,
    name: type ? autoName(type, pixel.primary, attrs) : '',
    primaryShade: pixel.primary,
    secondaryShade: pixel.secondary,
    attrs,
    formality: type ? defaultFormality(type, attrs) : 3,
    warmth: type ? defaultWarmth(type, attrs) : 2,
    quantity: 1,
    overrides: {},
    source: 'manual',
  };
}

export const shadeName = (id?: string) => getShade(id)?.name ?? '';
export const typeKnown = (id?: string) => !!findType(id);
