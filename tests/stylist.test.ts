import { describe, expect, it, vi } from 'vitest';
import { AiError } from '@/ai/errors';
import type { AiProvider, JsonCall } from '@/ai/provider';
import { RequestQueue } from '@/ai/queue';
import { mergeReview, reviewOutfits, validSwap } from '@/ai/stylist';
import { WardrobeDB } from '@/data/db';
import { createRepo } from '@/data/repo';
import { resolveOccasion } from '@/domain/occasions';
import { generate } from '@/engine/generator';
import { reviewWithCache } from '@/features/suggest/review';
import { fromAi, understand } from '@/query/understand';
import { input, userWardrobe } from './helpers';

const w = userWardrobe();
const byId = new Map(w.all.map((i) => [i.id, i]));
const outfits = generate(input(w.all, 'office')).outfits.slice(0, 6);
const occ = resolveOccasion('office');
let k = 0;
const db = () => new WardrobeDB(`st-${++k}-${Date.now()}`);
const fake = (reply: (c: JsonCall<unknown>) => unknown): AiProvider & { calls: JsonCall<unknown>[] } => {
  const calls: JsonCall<unknown>[] = [];
  return { id: 'gemini', label: 'Gemini', calls, json: async (c) => { calls.push(c as JsonCall<unknown>); return reply(c as JsonCall<unknown>) as never; } };
};
const queue = () => new RequestQueue({ sleep: async () => undefined });

describe('stylist review', () => {
  it('reorders only known outfits, ignores made-up and repeated ids, and keeps skipped ones in rules order', () => {
    const map = new Map(outfits.map((o, i) => [`o${i + 1}`, o.id]));
    const merged = mergeReview(outfits, { order: [{ id: 'o3', reason: 'Sharpest', concern: '' }, { id: 'o99', reason: 'fake', concern: '' }, { id: 'o3', reason: 'again', concern: '' }, { id: 'o1', reason: 'Classic', concern: 'A bit plain' }] }, map);
    expect(merged.map((o) => o.id)).toEqual([outfits[2].id, outfits[0].id, ...outfits.filter((_, i) => i !== 0 && i !== 2).map((o) => o.id)]);
    expect(merged).toHaveLength(outfits.length);
    expect(merged[0].aiReason).toBe('Sharpest');
    expect(merged[1].aiConcern).toBe('A bit plain');
  });
  it('sends short text, never photos', async () => {
    const p = fake(() => ({ order: [{ id: 'o2', reason: 'Good', concern: '' }] }));
    await reviewOutfits(outfits, occ, null, byId, { chain: [p], queue: queue(), db: db() });
    expect(p.calls[0].image).toBeUndefined();
    expect(p.calls[0].prompt).toContain('White shirt');
    expect(p.calls[0].prompt).not.toMatch(/base64|data:image/);
  });
  it('caches the review for 24 hours', async () => {
    const repo = createRepo(db());
    const p = fake(() => ({ order: [{ id: 'o2', reason: 'Good', concern: '' }] }));
    const o = { chain: [p], queue: queue(), db: repo.db, repo };
    const first = await reviewWithCache(outfits, occ, null, byId, o);
    const second = await reviewWithCache(outfits, occ, null, byId, o);
    expect(p.calls).toHaveLength(1);
    expect(second?.[0].id).toBe(first?.[0].id);
    expect(second?.[0].aiReason).toBe('Good');
  });
  it('keeps the rules order when the AI times out', async () => {
    const slow = fake(() => { throw new AiError('timeout', 'slow'); });
    expect(await reviewWithCache(outfits, occ, null, byId, { chain: [slow], queue: queue(), db: db(), repo: createRepo(db()) })).toBeNull();
  });
  it('only accepts swaps to owned items that fit the slot', () => {
    const slots = { base: w.whiteShirt.id, bottom: w.blackJeans.id };
    expect(validSwap('bottom', w.darkJeans.id, w.all, slots)?.itemId).toBe(w.darkJeans.id);
    expect(validSwap('bottom', 'made-up', w.all, slots)).toBeUndefined();
    expect(validSwap('bottom', w.whiteSneakers.id, w.all, slots)).toBeUndefined();
    expect(validSwap('base', w.whiteShirt.id, w.all, slots)).toBeUndefined();
    expect(validSwap('none', '', w.all, slots)).toBeUndefined();
  });
});

describe('understanding requests with AI', () => {
  const ctx = { items: w.all, now: new Date(2026, 9, 30, 10) };
  it('uses a valid AI reply and drops unknown ids and values', async () => {
    const p = fake(() => ({ kind: 'outfit', occasionId: 'office', date: '2026-11-01', include: [w.beigeJacket.id, 'ghost'], exclude: [] }));
    const u = await understand('client lunch day after tomorrow, nothing too formal', ctx, { useAi: true, chain: [p], queue: queue(), db: db() });
    expect(u.via).toBe('ai');
    expect(u.request).toMatchObject({ kind: 'outfit', occasionId: 'office', date: '2026-11-01', include: [w.beigeJacket.id] });
    expect(p.calls[0].image).toBeUndefined();
    expect(p.calls[0].timeoutMs).toBe(5000);
  });
  it('falls back to keywords on invalid or slow replies, or when AI is off', async () => {
    const invalid = fake(() => { throw new AiError('invalid', 'bad'); });
    const slow = fake(() => { throw new AiError('timeout', 'slow'); });
    for (const chain of [[invalid], [slow]]) {
      const u = await understand('office tomorrow', ctx, { useAi: true, chain, queue: queue(), db: db() });
      expect(u).toMatchObject({ via: 'keywords', request: { kind: 'outfit', occasionId: 'office', date: '2026-10-31' } });
    }
    const off = vi.fn();
    const u = await understand('how many white shirts', ctx, { useAi: false, chain: [{ id: 'gemini', label: 'G', json: off }] });
    expect(off).not.toHaveBeenCalled();
    expect(u.request.kind).toBe('inventory');
  });
  it('validates inventory replies', () => {
    const r = fromAi({ kind: 'inventory', mode: 'count', types: ['shirt', 'spaceship'], families: ['white'], attributes: ['distress:ripped', 'color:ultra'] }, ctx);
    expect(r).toEqual({ kind: 'inventory', mode: 'count', filter: { categories: undefined, types: ['shirt'], families: ['white'], shades: undefined, attrs: { distress: ['ripped'] }, occasionId: undefined } });
  });
});
