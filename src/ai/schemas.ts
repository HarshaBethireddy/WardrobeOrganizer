import { z } from 'zod';
import { CATEGORIES, TYPE_IDS } from '@/domain/taxonomy';
import { FAMILY_IDS, SHADE_IDS } from '@/domain/palette';
import { CLOSURES, DISTRESSES, FITS, MATERIALS, NECKS, PATTERNS, SLEEVES, WASHES } from '@/domain/types';

const e = <T extends readonly string[]>(v: T) => z.enum(v as unknown as [string, ...string[]]);

/** Strict schema sent to the AI as the response format: enums keep answers on allowed values. */
export const TagSchema = z.object({
  isClothing: z.boolean(),
  itemCount: z.number().int().min(0).max(10),
  type: e(TYPE_IDS),
  name: z.string(),
  primaryShade: e(SHADE_IDS),
  secondaryShade: e(['none', ...SHADE_IDS]),
  closure: e(CLOSURES),
  sleeve: e(SLEEVES),
  neck: e(NECKS),
  pattern: e(PATTERNS),
  wash: e(WASHES),
  distress: e(DISTRESSES),
  fit: e(FITS),
  material: e(MATERIALS),
  canOpen: z.boolean(),
  formality: z.number().int().min(1).max(5),
  warmth: z.number().int().min(1).max(3),
  confidence: z.number().min(0).max(1),
});

/** Lenient schema used to read replies; unknown values are mapped afterwards. */
export const LooseTagSchema = z.object({
  isClothing: z.boolean().catch(true),
  itemCount: z.coerce.number().catch(1),
  type: z.string(),
  name: z.string().catch(''),
  primaryShade: z.string(),
  secondaryShade: z.string().catch('none'),
  closure: z.string().catch('none'),
  sleeve: z.string().catch('na'),
  neck: z.string().catch('na'),
  pattern: z.string().catch('solid'),
  wash: z.string().catch('na'),
  distress: z.string().catch('none'),
  fit: z.string().catch('regular'),
  material: z.string().catch('other'),
  canOpen: z.boolean().catch(false),
  formality: z.coerce.number().catch(3),
  warmth: z.coerce.number().catch(2),
  confidence: z.coerce.number().catch(0.5),
});
export type LooseTag = z.infer<typeof LooseTagSchema>;

export const AiRequestSchema = z.object({
  kind: z.enum(['inventory', 'outfit', 'log', 'unknown']),
  mode: z.enum(['count', 'list']).optional(),
  categories: z.array(e(CATEGORIES.map((c) => c.id))).optional(),
  types: z.array(e(TYPE_IDS)).optional(),
  families: z.array(e(FAMILY_IDS)).optional(),
  shades: z.array(e(SHADE_IDS)).optional(),
  attributes: z.array(z.string()).optional(),
  occasionId: z.string().optional(),
  date: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});
export type AiRequest = z.infer<typeof AiRequestSchema>;

export const ReviewSchema = z.object({
  order: z.array(z.object({ id: z.string(), reason: z.string(), concern: z.string() })),
});
export type ReviewReply = z.infer<typeof ReviewSchema>;

export const CheckSchema = z.object({
  opinion: z.string(),
  swapSlot: z.enum(['none', 'base', 'mid', 'outer', 'bottom', 'shoes']),
  swapItemId: z.string(),
  swapReason: z.string(),
});
export type CheckReply = z.infer<typeof CheckSchema>;

export const PingSchema = z.object({ ok: z.boolean() });

/** Keywords some providers reject in a response schema. Replies are still checked with zod afterwards. */
const DROP_KEYS = new Set(['$schema', '$id', 'additionalProperties', 'propertyNames', 'unevaluatedProperties', 'default', 'examples']);

export function cleanSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(cleanSchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (DROP_KEYS.has(k)) continue;
    out[k] = k === 'properties' && v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([p, s]) => [p, cleanSchema(s)]))
      : cleanSchema(v);
  }
  return out;
}

/** JSON Schema for a response format, limited to widely supported keywords. */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  return cleanSchema(z.toJSONSchema(schema)) as Record<string, unknown>;
}
