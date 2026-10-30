export type Slot = 'base' | 'mid' | 'outer' | 'bottom' | 'shoes';
/** Display order for collages: outer layer first, shoes last. */
export const SLOT_ORDER: Slot[] = ['outer', 'mid', 'base', 'bottom', 'shoes'];
export const SLOT_LABELS: Record<Slot, string> = {
  base: 'Top',
  mid: 'Mid layer',
  outer: 'Outer layer',
  bottom: 'Bottom',
  shoes: 'Shoes',
};

export type Category = 'tops' | 'layers' | 'outerwear' | 'bottoms' | 'shoes';

export const CLOSURES = ['none', 'buttons', 'zipper', 'half-zip', 'snaps', 'laces', 'slip-on', 'straps'] as const;
export const SLEEVES = ['na', 'sleeveless', 'short', 'three-quarter', 'long'] as const;
export const NECKS = [
  'na', 'crew', 'v-neck', 'polo-collar', 'button-down', 'spread-collar', 'band-collar', 'hooded', 'turtleneck', 'lapel', 'henley', 'scoop',
] as const;
export const PATTERNS = ['solid', 'stripes', 'checks', 'graphic', 'print', 'floral', 'textured', 'colorblock', 'camo', 'small-logo'] as const;
export const WASHES = ['na', 'raw', 'dark', 'medium', 'light', 'black', 'grey', 'acid', 'ombre', 'bleached'] as const;
export const DISTRESSES = ['none', 'faded', 'ripped', 'heavy'] as const;
export const FITS = ['na', 'slim', 'regular', 'relaxed', 'oversized', 'skinny', 'straight', 'tapered', 'wide'] as const;
export const MATERIALS = [
  'cotton', 'linen', 'denim', 'wool', 'knit', 'leather', 'suede', 'synthetic', 'silk', 'fleece', 'corduroy', 'canvas', 'mesh', 'jersey', 'other',
] as const;

export type Closure = (typeof CLOSURES)[number];
export type Sleeve = (typeof SLEEVES)[number];
export type Neck = (typeof NECKS)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Wash = (typeof WASHES)[number];
export type Distress = (typeof DISTRESSES)[number];
export type Fit = (typeof FITS)[number];
export type Material = (typeof MATERIALS)[number];

export interface ItemAttrs {
  closure: Closure;
  sleeve: Sleeve;
  neck: Neck;
  pattern: Pattern;
  wash: Wash;
  distress: Distress;
  fit: Fit;
  material: Material;
  /** Shirts that can be worn open over a tee or tank top. */
  canOpen: boolean;
}

export type AttrKey = Exclude<keyof ItemAttrs, 'canOpen'>;

export const ATTR_VALUES: Record<AttrKey, readonly string[]> = {
  closure: CLOSURES,
  sleeve: SLEEVES,
  neck: NECKS,
  pattern: PATTERNS,
  wash: WASHES,
  distress: DISTRESSES,
  fit: FITS,
  material: MATERIALS,
};

export type OverrideMode = 'allow' | 'never';
export type ItemSource = 'manual' | 'ai' | 'on-device';

export interface Item {
  id: string;
  name: string;
  type: string;
  primaryShade: string;
  secondaryShade?: string;
  attrs: ItemAttrs;
  /** 1 = lounge/sport, 2 = casual, 3 = smart casual, 4 = business, 5 = formal */
  formality: number;
  /** 1 = light, 2 = medium, 3 = warm */
  warmth: number;
  quantity: number;
  overrides: Record<string, OverrideMode>;
  photoId?: string;
  archived: boolean;
  source: ItemSource;
  formalityManual?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Photo {
  id: string;
  full: ArrayBuffer;
  thumb: ArrayBuffer;
  mime: string;
  width: number;
  height: number;
  kind: 'item' | 'selfie';
  createdAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface WeatherSnapshot {
  tMax: number;
  tMin: number;
  rainProb: number;
  code: number;
  place?: string;
}

export type OutfitSlots = Partial<Record<Slot, string>>;

export interface LogEntry {
  id: string;
  /** Local date, YYYY-MM-DD */
  date: string;
  occasionId: string;
  tags: string[];
  slots: OutfitSlots;
  note?: string;
  selfieId?: string;
  rating?: number;
  source: 'suggestion' | 'check' | 'manual';
  weather?: WeatherSnapshot;
  createdAt: number;
  updatedAt: number;
}

export type RejectionType = 'outfit' | 'pair' | 'colors' | 'item';

export interface Rejection {
  id: string;
  type: RejectionType;
  key: string;
  label: string;
  createdAt: number;
}

export interface Like {
  id: string;
  slots: OutfitSlots;
  occasionId?: string;
  createdAt: number;
}

export interface CacheRow {
  key: string;
  value: unknown;
  expiresAt: number;
}

export interface CustomOccasion {
  id: string;
  name: string;
  baseId: string;
}

export interface GeoLocation {
  name: string;
  lat: number;
  lon: number;
}
