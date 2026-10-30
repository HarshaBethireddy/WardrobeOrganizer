import { describe, expect, it } from 'vitest';
import { evaluate, generate, paginate } from '@/engine/generator';
import { input, userWardrobe } from './helpers';
import { ALL_CASES, BAD, BLOCKED, GOOD } from './style-cases';

const run = (c: (typeof ALL_CASES)[number]) => evaluate(input(c.items, c.occasion, { weather: c.weather ?? null }), c.slots);

describe('style test outfits', () => {
  it('has about 60 outfits beyond the user wardrobe', () => expect(ALL_CASES.length).toBeGreaterThanOrEqual(58));
  it.each(GOOD.map((c) => [c.label, c] as const))('good: %s', (_l, c) => {
    const ev = run(c);
    expect(ev.warnings, `${c.label}: ${ev.warnings.join('; ')}`).toEqual([]);
    expect(ev.score, `${c.label} scored ${ev.score}: ${ev.reasons.map((r) => `${r.text} (${Math.round(r.impact)})`).join('; ')}`).toBeGreaterThanOrEqual(70);
    if (c.pattern) expect(ev.pattern).toBe(c.pattern);
  });
  it.each(BAD.map((c) => [c.label, c] as const))('bad: %s', (_l, c) => {
    const ev = run(c);
    expect(ev.score, `${c.label} scored ${ev.score}: ${ev.reasons.map((r) => `${r.text} (${Math.round(r.impact)})`).join('; ')}`).toBeLessThanOrEqual(45);
  });
  it.each(BLOCKED.map((c) => [c.label, c] as const))('blocked: %s', (_l, c) => {
    expect(run(c).warnings.length, c.label).toBeGreaterThan(0);
    const r = generate(input(c.items, c.occasion, { weather: c.weather ?? null, limit: 500 }));
    const key = Object.values(c.slots).sort().join(',');
    expect(r.outfits.filter((o) => !o.warnings).map((o) => o.id)).not.toContain(key);
  });
});

describe('the user wardrobe for the office', () => {
  const w = userWardrobe();
  const top = generate(input(w.all, 'office')).outfits;
  it('shows white shirt + beige jacket + dark jeans + white sneakers on the first page, with a contrast reason', () => {
    const page = paginate(top, 6)[0];
    const idx = page.findIndex((o) => o.slots.base === w.whiteShirt.id && o.slots.outer === w.beigeJacket.id && o.slots.bottom === w.darkJeans.id && o.slots.shoes === w.whiteSneakers.id);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(page[idx].reasons.map((r) => r.text)).toContain('Light top, dark jeans: clean contrast');
  });
  it('shows contrast or tonal harmony in the top 3', () => {
    for (const o of top.slice(0, 3)) expect(['contrast', 'tonal']).toContain(o.pattern);
  });
  it('ranks all-black lower for the office than for a party', () => {
    const allBlack = { base: w.blackPolo.id, outer: w.zipJacket.id, bottom: w.blackJeans.id, shoes: w.blackSneakers.id };
    expect(evaluate(input(w.all, 'office'), allBlack).score).toBeLessThan(evaluate(input(w.all, 'party'), allBlack).score);
  });
  it('ranks the beige button jacket as smarter than the black zip jacket', () => {
    expect(w.beigeJacket.formality).toBeGreaterThan(w.zipJacket.formality);
  });
});
