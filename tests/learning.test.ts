import { describe, expect, it } from 'vitest';
import { generate } from '@/engine/generator';
import { colorsKey, itemKey, outfitKey, pairKey, rejectOptions } from '@/engine/rejections';
import { PREF_CAP, computePreferences, decay, preferenceAdjustment } from '@/engine/preferences';
import { itemRotationPenalty, ROTATION_PENALTY, ROTATION_SHOE_PENALTY } from '@/engine/rotation';
import type { Rejection } from '@/domain/types';
import { input, logged, userWardrobe } from './helpers';

const rej = (type: Rejection['type'], key: string): Rejection => ({ id: key, type, key, label: key, createdAt: 0 });
const w = userWardrobe();
const outfitsFor = (occ: string, rejections: Rejection[] = [], over = {}) => generate(input(w.all, occ, { rejections, limit: 500, ...over })).outfits;

describe('rejections', () => {
  it('an exact outfit never comes back, but its pieces still appear elsewhere', () => {
    const first = outfitsFor('office')[0];
    const ids = Object.values(first.slots) as string[];
    const after = outfitsFor('office', [rej('outfit', outfitKey(ids))]);
    expect(after.map((o) => o.id)).not.toContain(first.id);
    expect(after.some((o) => o.slots.base === first.slots.base)).toBe(true);
  });
  it('an item pair never appears together in any outfit', () => {
    const r = outfitsFor('casual', [rej('pair', pairKey(w.blackShirt.id, w.shadedJeans.id))]);
    expect(r.some((o) => o.slots.base === w.blackShirt.id && o.slots.bottom === w.shadedJeans.id)).toBe(false);
    expect(r.some((o) => o.slots.base === w.blackShirt.id)).toBe(true);
  });
  it('a color pairing depends on which piece is the top', () => {
    const blackTopTealBottom = rej('colors', colorsKey('base', 'black', 'bottom', 'teal'));
    const r = outfitsFor('casual', [blackTopTealBottom]);
    const fam = (id?: string) => w.all.find((i) => i.id === id)?.primaryShade;
    expect(r.some((o) => fam(o.slots.base) === 'black' && fam(o.slots.bottom) === 'teal')).toBe(false);
    expect(r.some((o) => fam(o.slots.base) === 'white' && fam(o.slots.bottom) === 'teal')).toBe(true);
  });
  it('a banned item is never suggested, and undoing restores it', () => {
    const r = generate(input(w.all, 'office', { rejections: [rej('item', itemKey(w.whiteShirt.id))] }));
    expect(r.outfits.some((o) => Object.values(o.slots).includes(w.whiteShirt.id))).toBe(false);
    expect(r.hiddenByRejections).toBeGreaterThan(0);
    expect(outfitsFor('office').some((o) => Object.values(o.slots).includes(w.whiteShirt.id))).toBe(true);
  });
  it('offers outfit, pair, color and item choices', () => {
    const byId = new Map(w.all.map((i) => [i.id, i]));
    const opts = rejectOptions({ base: w.blackShirt.id, bottom: w.shadedJeans.id, shoes: w.whiteSneakers.id }, byId);
    const labels = opts.map((o) => o.label);
    expect(labels).toContain('This exact outfit');
    expect(labels).toContain('Black shirt + Blue-green shaded jeans together');
    expect(labels).toContain('Black tops with teal bottoms');
    expect(labels).toContain('Never suggest Black shirt');
  });
});

describe('taste learning', () => {
  const now = Date.parse('2026-11-02T08:00:00');
  it('older signals fade with a 90-day half-life and the adjustment is capped', () => {
    expect(decay(90 * 86_400_000)).toBeCloseTo(0.5, 5);
    const slots = { base: w.whiteShirt.id, bottom: w.darkJeans.id, shoes: w.whiteSneakers.id };
    const many = Array.from({ length: 30 }, (_, i) => logged(slots, '2026-11-01', { id: `x${i}`, rating: 5 }));
    const adj = preferenceAdjustment(slots, computePreferences(many, [], w.all, now), new Map(w.all.map((i) => [i.id, i])));
    expect(adj.value).toBe(PREF_CAP);
    expect(adj.reason).toBe('You rated a similar outfit 5\u2605');
  });
  it('ratings move similar outfits up or down', () => {
    const good = { base: w.blackShirt.id, bottom: w.blueJeans.id, shoes: w.whiteSneakers.id };
    const bad = { base: w.whiteShirt.id, bottom: w.blackJeans.id, shoes: w.blackSneakers.id };
    const base = outfitsFor('office');
    const score = (list: typeof base, s: typeof good) => list.find((o) => o.id === Object.values(s).sort().join(','))!.score;
    const after = outfitsFor('office', [], { logEntries: [logged(good, '2026-10-01', { rating: 5 }), logged(bad, '2026-10-01', { rating: 1 })] });
    expect(score(after, good)).toBeGreaterThan(score(base, good));
    expect(score(after, bad)).toBeLessThan(score(base, bad));
  });
  it('history never brings back a hard-filtered outfit', () => {
    const tankOutfit = { base: w.whiteTank.id, bottom: w.darkJeans.id, shoes: w.whiteSneakers.id };
    const r = outfitsFor('office', [], { logEntries: [logged(tankOutfit, '2026-10-20', { rating: 5 })], likes: [{ id: 'k', slots: tankOutfit, createdAt: now }] });
    expect(r.some((o) => o.slots.base === w.whiteTank.id)).toBe(false);
  });
});

describe('rotation', () => {
  it('penalises recent wear, halves it for two identical items and is smaller for shoes', () => {
    expect(itemRotationPenalty(w.whiteShirt, '2026-11-01', '2026-11-02', 4)).toBe(ROTATION_PENALTY);
    expect(itemRotationPenalty(w.blackShirt, '2026-11-01', '2026-11-02', 4)).toBe(ROTATION_PENALTY / 2);
    expect(itemRotationPenalty(w.whiteSneakers, '2026-11-01', '2026-11-02', 4)).toBe(ROTATION_SHOE_PENALTY);
    expect(itemRotationPenalty(w.whiteShirt, '2026-10-20', '2026-11-02', 4)).toBe(0);
    expect(itemRotationPenalty(w.whiteShirt, '2026-10-30', '2026-11-02', 4)).toBeLessThan(ROTATION_PENALTY);
  });
  it('moves an item worn yesterday down the list', () => {
    const slots = { base: w.whiteShirt.id, bottom: w.darkJeans.id, shoes: w.whiteSneakers.id };
    const after = outfitsFor('office', [], { logEntries: [logged(slots, '2026-11-01')], settings: { rotationDays: 4, useHistory: false } });
    const before = outfitsFor('office', [], { settings: { rotationDays: 4, useHistory: false } });
    const pos = (l: typeof after) => l.findIndex((o) => o.slots.base === w.whiteShirt.id);
    expect(pos(after)).toBeGreaterThan(pos(before));
    expect(after.find((o) => o.slots.base === w.whiteShirt.id)!.reasons.some((r) => r.text.includes('worn yesterday'))).toBe(true);
  });
});
