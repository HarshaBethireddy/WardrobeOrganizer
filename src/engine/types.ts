import type { OccasionProfile, TemplateId } from '@/domain/occasions';
import type { Item, Like, LogEntry, OutfitSlots, Rejection, Slot } from '@/domain/types';

export interface WeatherDay {
  date: string;
  tMax: number;
  tMin: number;
  rainProb: number;
  code: number;
}

export interface Outfit {
  /** Sorted item ids joined with commas: the same items make the same outfit. */
  id: string;
  template: TemplateId;
  slots: OutfitSlots;
}

export type ReasonKind = 'color' | 'formality' | 'shoes' | 'layers' | 'weather' | 'rotation' | 'preference' | 'occasion' | 'penalty';

export interface Reason {
  text: string;
  impact: number;
  kind: ReasonKind;
}

export interface ScoredOutfit extends Outfit {
  score: number;
  pattern: string;
  reasons: Reason[];
  /** Set when shown as a closest option with one rule relaxed. */
  warnings?: string[];
  aiReason?: string;
  aiConcern?: string;
}

export interface EngineSettings {
  rotationDays: number;
  useHistory: boolean;
}

export interface EngineInput {
  items: Item[];
  occasion: OccasionProfile;
  date: string;
  weather: WeatherDay | null;
  rejections: Rejection[];
  logEntries: LogEntry[];
  likes: Like[];
  settings: EngineSettings;
  include?: string[];
  exclude?: string[];
  /** Epoch ms used for preference decay; defaults to Date.now(). */
  now?: number;
  limit?: number;
}

export interface MissingPiece {
  slot: Slot;
  hint: string;
}

export interface GenerateResult {
  outfits: ScoredOutfit[];
  hiddenByRejections: number;
  missing: MissingPiece[];
  /** Which rule was relaxed to produce the closest options, if any. */
  relaxed: string | null;
  considered: number;
  includeProblems: string[];
}

export interface Evaluation {
  score: number;
  pattern: string;
  reasons: Reason[];
  warnings: string[];
}
