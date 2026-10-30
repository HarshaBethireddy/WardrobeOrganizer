import type { CustomOccasion, ItemAttrs, Slot } from './types';

export type TemplateId = 'basic' | 'outer' | 'open-shirt' | 'mid' | 'mid-outer' | 'basic-noshoes';

export interface TemplateDef {
  id: TemplateId;
  label: string;
  slots: Slot[];
  /** For templates with a mid layer: an open button-up shirt, or a knit/sweat layer. */
  midKind?: 'open-shirt' | 'knit';
}

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  basic: { id: 'basic', label: 'Top + bottom + shoes', slots: ['base', 'bottom', 'shoes'] },
  outer: { id: 'outer', label: 'Top + jacket + bottom + shoes', slots: ['base', 'outer', 'bottom', 'shoes'] },
  'open-shirt': { id: 'open-shirt', label: 'Tee + open shirt + bottom + shoes', slots: ['base', 'mid', 'bottom', 'shoes'], midKind: 'open-shirt' },
  mid: { id: 'mid', label: 'Top + knit layer + bottom + shoes', slots: ['base', 'mid', 'bottom', 'shoes'], midKind: 'knit' },
  'mid-outer': { id: 'mid-outer', label: 'Top + knit + jacket + bottom + shoes', slots: ['base', 'mid', 'outer', 'bottom', 'shoes'], midKind: 'knit' },
  'basic-noshoes': { id: 'basic-noshoes', label: 'Top + bottom', slots: ['base', 'bottom'] },
};

export type AttrBans = Partial<{ [K in keyof Omit<ItemAttrs, 'canOpen'>]: string[] }>;

export interface OccasionProfile {
  id: string;
  name: string;
  short: string;
  icon: 'briefcase' | 'coffee' | 'wine' | 'party' | 'sparkles' | 'dumbbell' | 'plane' | 'house';
  description: string;
  /** Target formality (1-5) and the allowed range for each piece. */
  target: number;
  range: [number, number];
  period: 'day' | 'evening';
  /** Casual-class occasions allow sleeveless tops. */
  casualClass: boolean;
  bannedTypes: string[];
  bannedAttrs: AttrBans;
  templates: TemplateId[];
  /** At least one upper piece must reach this formality (e.g. office: a plain tee only under a jacket). */
  minUpperFormality?: number;
  requireAthleticShoes?: boolean;
  /** Score adjustment for all-dark monochrome outfits. */
  monoDarkBonus: number;
  missingHints: Partial<Record<Slot, string>>;
  synonyms: string[];
  builtIn: boolean;
  baseId?: string;
}

const ALL_TEMPLATES: TemplateId[] = ['basic', 'outer', 'open-shirt', 'mid', 'mid-outer'];
const GYM_WEAR = ['gym-shorts', 'track-pants', 'running-shoes', 'track-jacket'];

export const BUILT_IN_OCCASIONS: OccasionProfile[] = [
  {
    id: 'office', name: 'Office', short: 'Office', icon: 'briefcase',
    description: 'Smart casual: shirts and polos, clean dark jeans or chinos, clean sneakers, a jacket on top. No tank tops, ripped or shaded jeans, or graphic tees.',
    target: 3, range: [2, 5], period: 'day', casualClass: false,
    bannedTypes: ['tank', 'hoodie', 'sweatshirt', 'joggers', 'track-pants', 'gym-shorts', 'shorts', 'cargo', 'slides', 'sandals', 'running-shoes', 'windbreaker', 'track-jacket', 'mojari', 'pyjama'],
    bannedAttrs: { sleeve: ['sleeveless'], distress: ['ripped', 'heavy'], wash: ['light', 'acid', 'ombre', 'bleached'], pattern: ['graphic', 'camo'] },
    templates: ['basic', 'outer', 'mid', 'mid-outer'], minUpperFormality: 3, monoDarkBonus: -8,
    missingHints: { base: 'a shirt or polo', bottom: 'chinos or clean dark jeans', shoes: 'clean sneakers, loafers or derbies' },
    synonyms: ['office', 'work', 'meeting', 'meetings', 'client', 'interview', 'presentation', 'workplace', 'business casual', 'smart casual'],
    builtIn: true,
  },
  {
    id: 'casual', name: 'Casual day out', short: 'Casual', icon: 'coffee',
    description: 'Relaxed day out: anything goes, as long as it looks put together.',
    target: 2, range: [1, 4], period: 'day', casualClass: true, bannedTypes: [], bannedAttrs: {},
    templates: ALL_TEMPLATES, monoDarkBonus: 0,
    missingHints: { base: 'a tee or casual shirt', bottom: 'jeans, chinos or shorts', shoes: 'sneakers' },
    synonyms: ['casual', 'day out', 'outing', 'hangout', 'hang out', 'college', 'brunch', 'shopping', 'movie', 'movies', 'mall', 'weekend', 'friends', 'errands'],
    builtIn: true,
  },
  {
    id: 'date', name: 'Date / dinner', short: 'Date', icon: 'wine',
    description: 'Dinner or a date: a step above casual, neat and deliberate.',
    target: 3, range: [2, 5], period: 'evening', casualClass: false,
    bannedTypes: ['tank', 'joggers', 'slides', 'windbreaker', ...GYM_WEAR],
    bannedAttrs: { sleeve: ['sleeveless'], distress: ['heavy'], pattern: ['camo'] },
    templates: ['basic', 'outer', 'mid', 'mid-outer', 'open-shirt'], monoDarkBonus: 4,
    missingHints: { base: 'a shirt or a smart knit', bottom: 'dark jeans or chinos', shoes: 'clean sneakers, loafers or boots' },
    synonyms: ['date', 'dinner', 'lunch', 'restaurant', 'romantic', 'anniversary', 'date night'],
    builtIn: true,
  },
  {
    id: 'party', name: 'Party', short: 'Party', icon: 'party',
    description: 'Night out or party: bolder looks and all-black work well.',
    target: 3, range: [2, 5], period: 'evening', casualClass: false,
    bannedTypes: ['slides', 'windbreaker', ...GYM_WEAR], bannedAttrs: { sleeve: ['sleeveless'] },
    templates: ALL_TEMPLATES, monoDarkBonus: 8,
    missingHints: { base: 'a shirt, polo or smart tee', bottom: 'jeans or chinos', shoes: 'sneakers or boots' },
    synonyms: ['party', 'club', 'clubbing', 'night out', 'birthday', 'celebration', 'pub', 'bar', 'concert'],
    builtIn: true,
  },
  {
    id: 'festive', name: 'Festive / wedding', short: 'Festive', icon: 'sparkles',
    description: 'Festivals, pujas and weddings: kurtas or smart shirts, trousers, and leather or ethnic shoes.',
    target: 4, range: [3, 5], period: 'evening', casualClass: false,
    bannedTypes: ['tank', 'tshirt', 'henley', 'hoodie', 'sweatshirt', 'shorts', 'joggers', 'cargo', 'sneakers', 'slides', 'sandals', 'windbreaker', 'puffer', 'bomber', 'denim-jacket', ...GYM_WEAR],
    bannedAttrs: { sleeve: ['sleeveless'], distress: ['faded', 'ripped', 'heavy'], wash: ['medium', 'light', 'acid', 'ombre', 'bleached'], pattern: ['graphic', 'camo'] },
    templates: ['basic', 'outer', 'mid', 'mid-outer'], minUpperFormality: 3, monoDarkBonus: 0,
    missingHints: { base: 'a kurta or a smart shirt', bottom: 'trousers, chinos or a pyjama/churidar', shoes: 'loafers, formal shoes or mojaris', outer: 'a blazer or Nehru jacket' },
    synonyms: ['festive', 'wedding', 'puja', 'pooja', 'diwali', 'eid', 'holi', 'festival', 'function', 'reception', 'sangeet', 'haldi', 'mehendi', 'engagement', 'ceremony', 'temple', 'navratri', 'christmas'],
    builtIn: true,
  },
  {
    id: 'gym', name: 'Gym', short: 'Gym', icon: 'dumbbell',
    description: 'Workout: athletic tees, tanks, shorts or track pants, and running shoes or sneakers.',
    target: 1, range: [1, 2], period: 'day', casualClass: true,
    bannedTypes: ['shirt', 'polo', 'kurta', 'turtleneck', 'sweater', 'cardigan', 'vest', 'jacket', 'denim-jacket', 'bomber', 'leather-jacket', 'blazer', 'overshirt', 'coat', 'puffer', 'jeans', 'chinos', 'trousers', 'cargo', 'pyjama', 'loafers', 'formal-shoes', 'boots', 'mojari', 'sandals', 'slides'],
    bannedAttrs: { material: ['denim', 'leather', 'suede', 'wool', 'linen', 'silk', 'corduroy'] },
    templates: ['basic', 'outer', 'mid'], requireAthleticShoes: true, monoDarkBonus: 0,
    missingHints: { base: 'a sports tee or tank', bottom: 'gym shorts, joggers or track pants', shoes: 'running shoes' },
    synonyms: ['gym', 'workout', 'work out', 'training', 'exercise', 'run', 'running', 'jog', 'jogging', 'sports', 'yoga', 'cricket', 'football', 'badminton'],
    builtIn: true,
  },
  {
    id: 'travel', name: 'Travel', short: 'Travel', icon: 'plane',
    description: 'Travel days: comfortable layers and easy shoes.',
    target: 2, range: [1, 3], period: 'day', casualClass: true, bannedTypes: ['formal-shoes'], bannedAttrs: { distress: ['heavy'] },
    templates: ALL_TEMPLATES, monoDarkBonus: 0,
    missingHints: { base: 'a tee or polo', bottom: 'joggers, chinos or jeans', shoes: 'sneakers' },
    synonyms: ['travel', 'trip', 'flight', 'airport', 'journey', 'train', 'road trip', 'vacation', 'holiday'],
    builtIn: true,
  },
  {
    id: 'home', name: 'Home', short: 'Home', icon: 'house',
    description: 'At home: comfortable and relaxed. Shoes are optional.',
    target: 1, range: [1, 3], period: 'day', casualClass: true,
    bannedTypes: ['blazer', 'coat', 'formal-shoes', 'loafers', 'boots', 'mojari'], bannedAttrs: {},
    templates: ['basic', 'basic-noshoes', 'mid', 'open-shirt'], monoDarkBonus: 0,
    missingHints: { base: 'a tee or tank top', bottom: 'shorts, joggers or a pyjama' },
    synonyms: ['home', 'lounge', 'lounging', 'relax', 'wfh', 'work from home', 'chill', 'stay in', 'staying in'],
    builtIn: true,
  },
];

export const DEFAULT_OCCASION = 'casual';

export function allOccasions(custom: CustomOccasion[] = []): OccasionProfile[] {
  const extra = custom
    .map((c): OccasionProfile | null => {
      const base = BUILT_IN_OCCASIONS.find((o) => o.id === c.baseId);
      if (!base) return null;
      return { ...base, id: c.id, name: c.name, short: c.name, builtIn: false, baseId: base.id, synonyms: [c.name.toLowerCase()] };
    })
    .filter((o): o is OccasionProfile => o !== null);
  return [...BUILT_IN_OCCASIONS, ...extra];
}

export function resolveOccasion(id: string, custom: CustomOccasion[] = []): OccasionProfile {
  return allOccasions(custom).find((o) => o.id === id) ?? BUILT_IN_OCCASIONS.find((o) => o.id === DEFAULT_OCCASION)!;
}
