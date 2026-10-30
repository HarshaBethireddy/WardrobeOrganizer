import type { Item, Like, LogEntry, OutfitSlots, Slot } from '@/domain/types';
import { familyOf } from '@/domain/palette';

/** Preference signals: each logged outfit +1, each rating (rating - 3) x 2, each "I like this" +3. */
export const PREF_LOGGED = 1;
export const PREF_RATING_STEP = 2;
export const PREF_LIKE = 3;
export const PREF_HALF_LIFE_DAYS = 90;
/** The preference adjustment never exceeds this, so it cannot outweigh the style rules or hard filters. */
export const PREF_CAP = 15;
const FAMILY_WEIGHT = 0.5;

const DAY = 86_400_000;

type Source = 'logged' | 'rated-high' | 'rated-low' | 'liked';

interface SourceInfo { src: Source; rating?: number }

export interface Preferences {
  scores: Map<string, number>;
  /** Strongest source per key, for the reason text. */
  sources: Map<string, SourceInfo>;
}

const pairId = (a: string, b: string) => `i:${[a, b].sort().join('|')}`;
const famId = (sa: Slot, fa: string, sb: Slot, fb: string) => {
  const x = `${sa}:${fa}`, y = `${sb}:${fb}`;
  return `f:${[x, y].sort().join('|')}`;
};

function pairsOf(slots: OutfitSlots, byId: Map<string, Item>) {
  const entries = (Object.entries(slots) as [Slot, string][]).filter(([, id]) => byId.has(id));
  const items: string[] = [], fams: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [sa, a] = entries[i], [sb, b] = entries[j];
      items.push(pairId(a, b));
      fams.push(famId(sa, familyOf(byId.get(a)!.primaryShade), sb, familyOf(byId.get(b)!.primaryShade)));
    }
  }
  return { items, fams };
}

export function decay(ageMs: number): number {
  return Math.pow(0.5, Math.max(0, ageMs) / DAY / PREF_HALF_LIFE_DAYS);
}

export function computePreferences(log: LogEntry[], likes: Like[], items: Item[], now = Date.now()): Preferences {
  const byId = new Map(items.map((i) => [i.id, i]));
  const scores = new Map<string, number>();
  const sources = new Map<string, SourceInfo>();
  const strength = new Map<string, number>();
  const add = (key: string, v: number, src: Source, rating?: number) => {
    scores.set(key, (scores.get(key) ?? 0) + v);
    if (Math.abs(v) >= (strength.get(key) ?? 0)) {
      strength.set(key, Math.abs(v));
      sources.set(key, { src, rating });
    }
  };
  for (const e of log) {
    const w = decay(now - (Date.parse(`${e.date}T12:00:00`) || e.createdAt));
    let v = PREF_LOGGED;
    let src: Source = 'logged';
    if (typeof e.rating === 'number') {
      v += (e.rating - 3) * PREF_RATING_STEP;
      if (e.rating >= 4) src = 'rated-high';
      if (e.rating <= 2) src = 'rated-low';
    }
    const { items: ip, fams } = pairsOf(e.slots, byId);
    ip.forEach((k) => add(k, v * w, src, e.rating));
    fams.forEach((k) => add(k, v * w * FAMILY_WEIGHT, src, e.rating));
  }
  for (const l of likes) {
    const w = decay(now - l.createdAt);
    const { items: ip, fams } = pairsOf(l.slots, byId);
    ip.forEach((k) => add(k, PREF_LIKE * w, 'liked'));
    fams.forEach((k) => add(k, PREF_LIKE * w * FAMILY_WEIGHT, 'liked'));
  }
  return { scores, sources };
}

function reasonText(info: SourceInfo): string {
  if (info.src === 'liked') return 'You liked a similar outfit';
  if (info.src === 'rated-high' || info.src === 'rated-low') return `You rated a similar outfit ${info.rating}\u2605`;
  return "You've worn similar outfits before";
}

export function preferenceAdjustment(slots: OutfitSlots, prefs: Preferences, byId: Map<string, Item>): { value: number; reason?: string } {
  const { items: ip, fams } = pairsOf(slots, byId);
  let total = 0, topKey = '', topAbs = 0;
  for (const k of [...ip, ...fams]) {
    const v = prefs.scores.get(k) ?? 0;
    total += v;
    if (Math.abs(v) > topAbs) { topAbs = Math.abs(v); topKey = k; }
  }
  const value = Math.max(-PREF_CAP, Math.min(PREF_CAP, total));
  if (Math.abs(value) < 1 || !topKey) return { value: Math.round(value * 10) / 10 };
  const info = prefs.sources.get(topKey) ?? { src: 'logged' as const };
  return { value, reason: reasonText(info) };
}
