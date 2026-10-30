/**
 * The style rules: every outfit score comes from this file.
 * Rules use item properties (type, formality, layer, material, shade lightness/chroma/hue), never specific items.
 * Sources for each rule are listed in docs/style-sources.md. Tune the weights below and re-run `npm test`.
 */
import type { OccasionProfile } from '@/domain/occasions';
import { familyLabel, getShade, type Shade } from '@/domain/palette';
import { getType } from '@/domain/taxonomy';
import type { Item, OutfitSlots, Slot } from '@/domain/types';
import { CLEAR_DE, hueDistance, relation, shadeDeltaE, shadeMetrics, type ShadeMetrics } from '@/lib/colorMath';
import { daysBetween } from '@/lib/dates';
import { preferenceAdjustment, type Preferences } from './preferences';
import { itemRotationPenalty, ROTATION_MAX } from './rotation';
import type { Reason, WeatherDay } from './types';

// ---- Weights (named so they are easy to tune) ----
export const WEIGHTS = { color: 0.45, formality: 0.25, shoes: 0.15, layers: 0.15 };

export const PATTERN_SCORES = {
  contrastMin: 72, contrastMax: 90, tonal: 86, monochrome: 78, neutralAccent: 84, neutral: 74, colorWheel: 80, muted: 76, none: 40,
};
/** OKLab lightness difference that counts as clear light/dark contrast. */
export const CONTRAST_L = 0.25;
/** OKLab chroma below this counts as a soft, muted color. */
export const MUTED_C = 0.075;

export const PENALTIES = {
  nearMiss: 45,
  /** Blue denim varies in shade by nature, so a near miss with indigo counts half. */
  nearMissDenim: 22,
  nearMissShoes: 10,
  nearMissMax: 45,
  denimSameWash: 48,
  tooManyAccents: 25,
  perExtraAccent: 10,
  unrelatedAccents: 25,
  boldPatterns: 48,
  brightClash: 48,
  formalitySpread2: 12,
};

/** Families that read as one tonal group (shades of one color story). */
export const TONAL_GROUPS: string[][] = [
  ['white', 'beige', 'brown'],
  ['white', 'grey', 'black'],
  ['blue', 'teal'],
  ['green', 'teal'],
  ['red', 'pink'],
  ['orange', 'brown', 'beige'],
  ['yellow', 'beige'],
];

export const WEATHER = {
  hot: 30, warm: 24, mild: 16, cold: 10,
  warmJacket: -10, warmKnit: -8, mildJacket: 5, coolNoLayer: -12, coolLayered: 6, coldLayered: 8,
  hotSleeveless: 6, hotSleevelessFrom: 28, coolSleeveless: -8, rainSuede: -10, hotWarmBase: -8,
};

const BOLD_PATTERNS = new Set(['stripes', 'checks', 'graphic', 'print', 'floral', 'camo', 'colorblock']);

export interface Piece { slot: Slot; item: Item; shade: Shade; m: ShadeMetrics }

export function toPieces(slots: OutfitSlots, byId: Map<string, Item>): Piece[] {
  const order: Slot[] = ['base', 'mid', 'outer', 'bottom', 'shoes'];
  const out: Piece[] = [];
  for (const slot of order) {
    const id = slots[slot];
    const item = id ? byId.get(id) : undefined;
    if (!item) continue;
    const shade = getShade(item.primaryShade) ?? getShade('grey')!;
    out.push({ slot, item, shade, m: shadeMetrics(shade.id) });
  }
  return out;
}

const bottomWord = (it: Item) => {
  const t = getType(it.type);
  return t.category === 'bottoms' ? t.plural.toLowerCase() : 'bottom';
};

export interface ColorResult { score: number; pattern: string; reason: string; penalties: Reason[] }

const rel = (a: Piece, b: Piece) => relation(shadeDeltaE(a.shade.id, b.shade.id));

function pairs<T>(list: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
  return out;
}

/** Tonal: clearly different shades within one color story (white + cream + beige, light blue + navy). */
export function isTonal(clothes: Piece[]): boolean {
  if (clothes.length < 2) return false;
  const fams = [...new Set(clothes.map((p) => p.shade.family))];
  if (fams.includes('multi')) return false;
  if (fams.length > 1 && !TONAL_GROUPS.some((g) => fams.every((f) => g.includes(f)))) return false;
  let clear = false;
  for (const [a, b] of pairs(clothes)) {
    const r = rel(a, b);
    if (r === 'near' && a.shade.family === b.shade.family) return false;
    if (r === 'clear') clear = true;
  }
  return clear;
}

/** Monochrome: one color head to toe in the same shade. */
export function isMonochrome(clothes: Piece[]): boolean {
  if (clothes.length < 2) return false;
  const fam = clothes[0].shade.family;
  if (fam === 'multi' || !clothes.every((p) => p.shade.family === fam)) return false;
  return pairs(clothes).every(([a, b]) => rel(a, b) === 'match');
}

/** Scores the colors: the best-fitting accepted pattern, minus penalties for combinations that look wrong. */
export function colorAnalysis(pieces: Piece[]): ColorResult {
  const clothes = pieces.filter((p) => p.slot !== 'shoes');
  const get = (s: Slot) => pieces.find((p) => p.slot === s);
  const base = get('base'), bottom = get('bottom'), shoes = get('shoes');
  const upper = get('outer') ?? get('mid') ?? base;
  const candidates: { score: number; pattern: string; reason: string }[] = [];
  const penalties: Reason[] = [];

  if (upper && bottom && base) {
    const dl = Math.max(Math.abs(upper.m.L - bottom.m.L), 0.85 * Math.abs(base.m.L - bottom.m.L));
    if (dl >= CONTRAST_L) {
      const t = Math.min(1, (dl - CONTRAST_L) / 0.3);
      const lightTop = (upper.m.L + base.m.L) / 2 > bottom.m.L;
      candidates.push({
        score: PATTERN_SCORES.contrastMin + t * (PATTERN_SCORES.contrastMax - PATTERN_SCORES.contrastMin),
        pattern: 'contrast',
        reason: lightTop ? `Light top, dark ${bottomWord(bottom.item)}: clean contrast` : `Dark top, light ${bottomWord(bottom.item)}: clean contrast`,
      });
    }
  }
  if (isTonal(clothes)) candidates.push({ score: PATTERN_SCORES.tonal, pattern: 'tonal', reason: 'Tonal look: clearly different shades of one color story' });
  if (isMonochrome(clothes)) {
    candidates.push({ score: PATTERN_SCORES.monochrome, pattern: 'monochrome', reason: `All ${familyLabel(clothes[0].shade.family).toLowerCase()}: one color head to toe` });
  }
  const accentPieces = pieces.filter((p) => !p.shade.neutral);
  const accents = [...new Set(accentPieces.map((p) => p.shade.family))];
  const neutralClothes = clothes.filter((p) => p.shade.neutral).length;
  if (accents.length === 0) candidates.push({ score: PATTERN_SCORES.neutral, pattern: 'neutral', reason: 'Neutral palette: easy and classic' });
  if (accents.length === 1 && neutralClothes >= 1 && accentPieces.length <= 2) {
    candidates.push({
      score: PATTERN_SCORES.neutralAccent,
      pattern: 'neutral-accent',
      reason: `Neutral base with one ${accentPieces[0].shade.name.toLowerCase()} accent`,
    });
  }
  if (accents.length === 2) {
    const a = accentPieces.find((p) => p.shade.family === accents[0])!;
    const b = accentPieces.find((p) => p.shade.family === accents[1])!;
    const d = hueDistance(a.m.hslHue, b.m.hslHue);
    const names = `${a.shade.name} and ${b.shade.name.toLowerCase()}`;
    if (d < 75) candidates.push({ score: PATTERN_SCORES.colorWheel, pattern: 'color-wheel', reason: `${names} sit next to each other on the color wheel` });
    else if (d >= 135) candidates.push({ score: PATTERN_SCORES.colorWheel, pattern: 'color-wheel', reason: `${names} are complementary colors` });
    else if (a.m.C < MUTED_C && b.m.C < MUTED_C) candidates.push({ score: PATTERN_SCORES.muted, pattern: 'color-wheel', reason: `Soft, muted ${a.shade.name.toLowerCase()} and ${b.shade.name.toLowerCase()} sit together easily` });
    else penalties.push({ text: `${names} fight each other`, impact: -PENALTIES.unrelatedAccents, kind: 'penalty' });
  }
  // Clashing accents can't be rescued by light/dark contrast.
  const accentConflict = accents.length >= 3 || penalties.some((p) => p.text.endsWith('fight each other'));
  const none = { score: PATTERN_SCORES.none, pattern: 'none', reason: "These colors don't relate to each other" };
  const best = accentConflict ? none : (candidates.sort((x, y) => y.score - x.score)[0] ?? none);

  let nearTotal = 0;
  const nearIdx: number[] = [];
  for (const [a, b] of pairs(clothes)) {
    const de = shadeDeltaE(a.shade.id, b.shade.id);
    if (a.item.attrs.material === 'denim' && b.item.attrs.material === 'denim') {
      if (de < CLEAR_DE) penalties.push({ text: 'Same-wash denim on denim', impact: -PENALTIES.denimSameWash, kind: 'penalty' });
      continue;
    }
    if (a.shade.family === b.shade.family && a.shade.family !== 'multi' && relation(de) === 'near') {
      const blueDenim = a.shade.family === 'blue' && (a.item.attrs.material === 'denim' || b.item.attrs.material === 'denim');
      const p = blueDenim ? PENALTIES.nearMissDenim : PENALTIES.nearMiss;
      nearTotal += p;
      nearIdx.push(penalties.length);
      penalties.push({ text: `${a.item.name} and ${b.item.name} are shades that almost match`, impact: -p, kind: 'penalty' });
    }
  }
  if (shoes && bottom && shoes.shade.family === bottom.shade.family && relation(shadeDeltaE(shoes.shade.id, bottom.shade.id)) === 'near') {
    nearTotal += PENALTIES.nearMissShoes;
    nearIdx.push(penalties.length);
    penalties.push({ text: 'Shoes almost match the bottoms, but not quite', impact: -PENALTIES.nearMissShoes, kind: 'penalty' });
  }
  if (nearTotal > PENALTIES.nearMissMax) {
    const scale = PENALTIES.nearMissMax / nearTotal;
    nearIdx.forEach((i) => (penalties[i].impact = Math.round(penalties[i].impact * scale)));
  }
  if (accents.length >= 3) {
    penalties.push({ text: 'Too many accent colors', impact: -(PENALTIES.tooManyAccents + PENALTIES.perExtraAccent * (accents.length - 3)), kind: 'penalty' });
  }
  if (clothes.filter((p) => BOLD_PATTERNS.has(p.item.attrs.pattern)).length >= 2) {
    penalties.push({ text: 'Two bold patterns compete', impact: -PENALTIES.boldPatterns, kind: 'penalty' });
  }
  const bright = accentPieces.filter((p) => p.m.C >= 0.12 && p.m.L >= 0.45);
  const clash = pairs(bright).some(([a, b]) => a.shade.family !== b.shade.family && hueDistance(a.m.hslHue, b.m.hslHue) > 45);
  if (clash) penalties.push({ text: 'Bright colors clash', impact: -PENALTIES.brightClash, kind: 'penalty' });
  return { ...best, penalties };
}

export function formalityScore(pieces: Piece[], occ: OccasionProfile): { score: number; reason?: Reason } {
  if (!pieces.length) return { score: 0 };
  const fs = pieces.map((p) => p.item.formality);
  const avg = fs.reduce((a, b) => a + b, 0) / fs.length;
  const spread = Math.max(...fs) - Math.min(...fs);
  const d = Math.abs(avg - occ.target);
  const score = Math.max(0, Math.min(100, 100 - 16 * d - (spread === 2 ? PENALTIES.formalitySpread2 : 0)));
  let reason: Reason | undefined;
  if (d <= 0.6 && spread < 2) reason = { text: `Right level of dress for ${occ.short.toLowerCase()}`, impact: 4, kind: 'formality' };
  else if (avg < occ.target - 1) reason = { text: `A bit too casual for ${occ.short.toLowerCase()}`, impact: -(100 - score) * WEIGHTS.formality, kind: 'formality' };
  else if (avg > occ.target + 1) reason = { text: `Dressier than ${occ.short.toLowerCase()} needs`, impact: -(100 - score) * WEIGHTS.formality, kind: 'formality' };
  else if (spread === 2) reason = { text: 'Mixes dressy and casual pieces', impact: -PENALTIES.formalitySpread2 * WEIGHTS.formality, kind: 'formality' };
  return { score, reason };
}

export function shoeScore(pieces: Piece[]): { score: number; reason?: Reason } {
  const shoes = pieces.find((p) => p.slot === 'shoes');
  const bottom = pieces.find((p) => p.slot === 'bottom');
  if (!shoes || !bottom) return { score: 80 };
  const fd = Math.abs(shoes.item.formality - bottom.item.formality);
  let score = [92, 85, 60, 30][Math.min(3, fd)];
  let reason: Reason | undefined;
  if (shoes.shade.neutral) score += 2;
  const casualBottom = ['jeans', 'chinos', 'shorts', 'cargo'].includes(bottom.item.type);
  if (shoes.shade.family === 'white' && ['sneakers', 'running-shoes'].includes(shoes.item.type) && casualBottom) {
    score += 4;
    reason = { text: 'White sneakers keep it clean', impact: 3, kind: 'shoes' };
  }
  if (fd >= 2) reason = { text: "Shoes don't match the bottoms' level of dress", impact: -(100 - score) * WEIGHTS.shoes, kind: 'shoes' };
  return { score: Math.min(100, score), reason };
}

export function layerScore(pieces: Piece[], occ: OccasionProfile): { score: number; reasons: Reason[] } {
  const base = pieces.find((p) => p.slot === 'base');
  const mid = pieces.find((p) => p.slot === 'mid');
  const outer = pieces.find((p) => p.slot === 'outer');
  if (!base || (!mid && !outer)) return { score: 80, reasons: [] };
  const reasons: Reason[] = [];
  const scores: number[] = [];
  const rate = (a: Piece, b: Piece, clear: number, match: number) => {
    const r = relation(shadeDeltaE(a.shade.id, b.shade.id));
    return r === 'clear' ? clear : r === 'match' ? match : 55;
  };
  if (mid) {
    const open = mid.item.type === 'shirt';
    const s = rate(mid, base, 88, open ? 70 : 72);
    scores.push(s);
    if (s >= 85) reasons.push({ text: open ? 'Open shirt over a tee: easy layering' : 'The knit layer adds depth', impact: 3, kind: 'layers' });
  }
  if (outer) {
    const s = rate(outer, mid ?? base, 90, 74);
    scores.push(s);
    if (outer.item.formality >= 3 && occ.target >= 3) reasons.push({ text: `${outer.item.name} adds a smart layer`, impact: 4, kind: 'layers' });
    else if (s >= 85) reasons.push({ text: 'The jacket stands out against the top', impact: 3, kind: 'layers' });
  }
  return { score: scores.reduce((a, b) => a + b, 0) / scores.length, reasons };
}

export function effectiveTemp(w: WeatherDay | null, occ: OccasionProfile): number | null {
  if (!w) return null;
  return occ.period === 'day' ? w.tMax : (w.tMax + w.tMin) / 2;
}

export function weatherReasons(pieces: Piece[], temp: number | null, rainy: boolean): Reason[] {
  const out: Reason[] = [];
  const outer = pieces.find((p) => p.slot === 'outer');
  const mid = pieces.find((p) => p.slot === 'mid');
  const base = pieces.find((p) => p.slot === 'base');
  const layered = !!outer || !!mid;
  if (rainy && pieces.some((p) => p.item.attrs.material === 'suede')) out.push({ text: 'Rain expected: suede may get ruined', impact: WEATHER.rainSuede, kind: 'weather' });
  if (temp === null) return out;
  const t = Math.round(temp);
  if (temp >= WEATHER.hot && base && base.item.warmth >= 3) out.push({ text: `${t}\u00b0C: that top is too warm`, impact: WEATHER.hotWarmBase, kind: 'weather' });
  if (temp >= WEATHER.warm && temp < WEATHER.hot) {
    if (outer) out.push({ text: `Warm day (${t}\u00b0C): a jacket may be too much`, impact: WEATHER.warmJacket, kind: 'weather' });
    if (mid && mid.item.type !== 'shirt' && mid.item.warmth >= 2) out.push({ text: `Warm day (${t}\u00b0C): skip the knit`, impact: WEATHER.warmKnit, kind: 'weather' });
  }
  if (temp >= WEATHER.mild && temp < WEATHER.warm && outer) out.push({ text: `Mild ${t}\u00b0C: a light jacket fits`, impact: WEATHER.mildJacket, kind: 'weather' });
  if (temp < WEATHER.mild) {
    if (!layered) out.push({ text: `Cool day (${t}\u00b0C): add a layer`, impact: WEATHER.coolNoLayer, kind: 'weather' });
    else out.push({ text: `Layered for ${t}\u00b0C`, impact: temp <= WEATHER.cold ? WEATHER.coldLayered : WEATHER.coolLayered, kind: 'weather' });
  }
  if (base?.item.attrs.sleeve === 'sleeveless') {
    if (temp >= WEATHER.hotSleevelessFrom) out.push({ text: `Hot day (${t}\u00b0C): sleeveless keeps you cool`, impact: WEATHER.hotSleeveless, kind: 'weather' });
    else if (temp < 20 && !layered) out.push({ text: 'Too cool for sleeveless', impact: WEATHER.coolSleeveless, kind: 'weather' });
  }
  return out;
}

export interface ScoreContext {
  occasion: OccasionProfile;
  byId: Map<string, Item>;
  temp: number | null;
  rainy: boolean;
  date: string;
  lastWorn: Map<string, string>;
  rotationDays: number;
  prefs: Preferences | null;
}

export interface ScoreResult { score: number; pattern: string; reasons: Reason[] }

/** The full score (0-100) and the reasons behind it. */
export function scoreOutfit(slots: OutfitSlots, ctx: ScoreContext): ScoreResult {
  const pieces = toPieces(slots, ctx.byId);
  const occ = ctx.occasion;
  const color = colorAnalysis(pieces);
  const form = formalityScore(pieces, occ);
  const shoe = shoeScore(pieces);
  const layer = layerScore(pieces, occ);
  const reasons: Reason[] = [];
  reasons.push({ text: color.reason, impact: (color.score - 60) * WEIGHTS.color, kind: 'color' });
  if (form.reason) reasons.push(form.reason);
  if (shoe.reason) reasons.push(shoe.reason);
  reasons.push(...layer.reasons);
  let total = WEIGHTS.color * color.score + WEIGHTS.formality * form.score + WEIGHTS.shoes * shoe.score + WEIGHTS.layers * layer.score;
  for (const p of color.penalties) { total += p.impact; reasons.push(p); }

  const clothes = pieces.filter((p) => p.slot !== 'shoes');
  if (color.pattern === 'monochrome' && occ.monoDarkBonus && clothes.every((p) => p.m.L < 0.35)) {
    const r: Reason = occ.monoDarkBonus > 0
      ? { text: `All-dark works well for ${occ.short.toLowerCase()}`, impact: occ.monoDarkBonus, kind: 'occasion' }
      : { text: `All-dark is a bit severe for ${occ.short.toLowerCase()}`, impact: occ.monoDarkBonus, kind: 'occasion' };
    total += r.impact; reasons.push(r);
  }
  const festive = occ.id === 'festive' || occ.baseId === 'festive';
  if (festive && pieces.some((p) => p.item.type === 'kurta')) { total += 8; reasons.push({ text: 'A kurta suits the occasion', impact: 8, kind: 'occasion' }); }
  if (festive && (color.pattern === 'neutral-accent' || color.pattern === 'color-wheel')) { total += 3; reasons.push({ text: 'A rich color suits the celebration', impact: 3, kind: 'occasion' }); }

  for (const w of weatherReasons(pieces, ctx.temp, ctx.rainy)) { total += w.impact; reasons.push(w); }

  if (ctx.rotationDays > 0) {
    let sum = 0, top: { item: Item; p: number; ago: number } | null = null;
    for (const p of pieces) {
      const lw = ctx.lastWorn.get(p.item.id);
      const pen = itemRotationPenalty(p.item, lw, ctx.date, ctx.rotationDays);
      sum += pen;
      if (pen > 0 && (!top || pen > top.p)) top = { item: p.item, p: pen, ago: daysBetween(lw!, ctx.date) };
    }
    if (sum > 0 && top) {
      const pen = -Math.min(ROTATION_MAX, sum);
      total += pen;
      const when = top.ago <= 0 ? 'today' : top.ago === 1 ? 'yesterday' : `${top.ago} days ago`;
      reasons.push({ text: `${top.item.name} worn ${when}`, impact: pen, kind: 'rotation' });
    }
  }
  if (ctx.prefs) {
    const adj = preferenceAdjustment(slots, ctx.prefs, ctx.byId);
    if (adj.value) {
      total += adj.value;
      if (adj.reason) reasons.push({ text: adj.reason, impact: adj.value, kind: 'preference' });
    }
  }
  reasons.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  return { score: Math.max(0, Math.min(100, Math.round(total))), pattern: color.pattern, reasons };
}
