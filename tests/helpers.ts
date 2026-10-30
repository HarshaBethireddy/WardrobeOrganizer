import { autoName, defaultAttrs, defaultFormality, defaultWarmth } from '@/domain/taxonomy';
import type { Item, ItemAttrs, LogEntry, OutfitSlots } from '@/domain/types';
import { resolveOccasion } from '@/domain/occasions';
import type { EngineInput, WeatherDay } from '@/engine/types';

let n = 0;

/** A made-up item with defaults from the clothing data. */
export function mk(type: string, shade: string, attrs: Partial<ItemAttrs> = {}, extra: Partial<Item> = {}): Item {
  const a: ItemAttrs = { ...defaultAttrs(type), ...attrs };
  const id = extra.id ?? `t${++n}`;
  return {
    id, name: extra.name ?? autoName(type, shade, a), type, primaryShade: shade, attrs: a,
    formality: extra.formality ?? defaultFormality(type, a), warmth: extra.warmth ?? defaultWarmth(type, a),
    quantity: 1, overrides: {}, archived: false, source: 'manual', createdAt: n, updatedAt: n, ...extra,
  };
}

export function input(items: Item[], occasionId = 'office', over: Partial<EngineInput> = {}): EngineInput {
  return {
    items, occasion: resolveOccasion(occasionId), date: '2026-11-02', weather: null, rejections: [], logEntries: [], likes: [],
    settings: { rotationDays: 4, useHistory: true }, now: Date.parse('2026-11-02T08:00:00'), ...over,
  };
}

export function wx(tMax: number, tMin = tMax - 8, rainProb = 0, date = '2026-11-02'): WeatherDay {
  return { date, tMax, tMin, rainProb, code: rainProb > 50 ? 61 : 1 };
}

export function logged(slots: OutfitSlots, date: string, extra: Partial<LogEntry> = {}): LogEntry {
  return { id: `l${++n}`, date, occasionId: 'office', tags: [], slots, source: 'suggestion', createdAt: Date.parse(`${date}T09:00:00`), updatedAt: 0, ...extra };
}

/** The user's example wardrobe. */
export function userWardrobe() {
  const w = {
    blackShirt: mk('shirt', 'black', {}, { name: 'Black shirt', quantity: 2 }),
    whiteShirt: mk('shirt', 'white', {}, { name: 'White shirt' }),
    blackPolo: mk('polo', 'black', { sleeve: 'long' }, { name: 'Black full-sleeve polo' }),
    blackJeans: mk('jeans', 'black', { wash: 'black' }, { name: 'Black jeans' }),
    blueJeans: mk('jeans', 'denim-medium', { wash: 'medium' }, { name: 'Blue jeans' }),
    darkJeans: mk('jeans', 'denim-dark', { wash: 'dark' }, { name: 'Dark blue jeans' }),
    shadedJeans: mk('jeans', 'teal', { wash: 'ombre' }, { name: 'Blue-green shaded jeans' }),
    zipJacket: mk('jacket', 'black', { closure: 'zipper' }, { name: 'Black zip jacket' }),
    beigeJacket: mk('jacket', 'beige', { closure: 'buttons' }, { name: 'Beige button jacket' }),
    whiteTank: mk('tank', 'white', {}, { name: 'White tank top' }),
    blackTank: mk('tank', 'black', {}, { name: 'Black tank top' }),
    whiteSneakers: mk('sneakers', 'white', {}, { name: 'White Nike sneakers' }),
    blackSneakers: mk('sneakers', 'black', {}, { name: 'Black Nike sneakers' }),
  };
  return { ...w, all: Object.values(w) };
}
