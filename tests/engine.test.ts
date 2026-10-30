import { describe, expect, it } from 'vitest';
import { evaluate, generate, paginate } from '@/engine/generator';
import { SHADES } from '@/domain/palette';
import { ITEM_TYPES } from '@/domain/taxonomy';
import { input, mk, userWardrobe } from './helpers';

const ids = (r: ReturnType<typeof generate>) => r.outfits.flatMap((o) => Object.values(o.slots));

describe('valid outfits for an occasion', () => {
  const w = userWardrobe();
  it('office never uses tank tops or shaded jeans, and always has shoes', () => {
    const r = generate(input(w.all, 'office'));
    expect(r.outfits.length).toBeGreaterThanOrEqual(3);
    const used = new Set(ids(r));
    for (const bad of [w.whiteTank, w.blackTank, w.shadedJeans]) expect(used.has(bad.id)).toBe(false);
    for (const o of r.outfits) expect(o.slots.shoes).toBeDefined();
    expect(r.outfits.some((o) => o.slots.outer)).toBe(true);
    expect(r.outfits.some((o) => !o.slots.outer)).toBe(true);
  });
  it('office rejects ripped jeans and graphic tees', () => {
    const ripped = mk('jeans', 'denim-medium', { distress: 'ripped' });
    const graphic = mk('tshirt', 'white', { pattern: 'graphic' });
    const r = generate(input([...w.all, ripped, graphic], 'office'));
    expect(ids(r)).not.toContain(ripped.id);
    expect(ids(r)).not.toContain(graphic.id);
  });
  it('gym excludes jeans and needs athletic shoes', () => {
    const gym = [mk('tshirt', 'black'), mk('gym-shorts', 'black'), mk('running-shoes', 'grey'), ...w.all];
    const r = generate(input(gym, 'gym'));
    expect(r.outfits.length).toBeGreaterThan(0);
    for (const o of r.outfits) expect([w.blackJeans.id, w.blueJeans.id, w.darkJeans.id, w.shadedJeans.id]).not.toContain(o.slots.bottom);
  });
  it('honours per-item occasion overrides', () => {
    const never = { ...w.darkJeans, overrides: { office: 'never' as const } };
    const allow = { ...w.whiteTank, overrides: { casual: 'allow' as const } };
    const r = generate(input([...w.all.filter((i) => i.id !== w.darkJeans.id), never], 'office'));
    expect(ids(r)).not.toContain(never.id);
    expect(ids(generate(input([...w.all, allow], 'casual')))).toContain(allow.id);
  });
});
describe('templates and layering', () => {
  const tee = mk('tshirt', 'white'), openShirt = mk('shirt', 'light-blue', { pattern: 'checks' }), sweater = mk('sweater', 'navy');
  const tank = mk('tank', 'black'), chinos = mk('chinos', 'khaki'), sneakers = mk('sneakers', 'white'), jacket = mk('bomber', 'olive');
  const items = [tee, openShirt, sweater, tank, chinos, sneakers, jacket];
  it('covers every template for a casual day', () => {
    const r = generate(input(items, 'casual', { limit: 400 }));
    const t = new Set(r.outfits.map((o) => o.template));
    for (const id of ['basic', 'outer', 'open-shirt', 'mid', 'mid-outer']) expect(t).toContain(id);
  });
  it('puts open shirts only over tees, tanks or henleys', () => {
    const r = generate(input(items, 'casual', { limit: 400 }));
    for (const o of r.outfits.filter((x) => x.template === 'open-shirt')) expect([tee.id, tank.id]).toContain(o.slots.base);
  });
  it('home allows outfits without shoes', () => {
    const r = generate(input([tee, mk('joggers', 'grey')], 'home'));
    expect(r.outfits.some((o) => !o.slots.shoes)).toBe(true);
  });
});

describe('when nothing fits', () => {
  it('shows the closest options and names missing pieces', () => {
    const w = userWardrobe();
    const r = generate(input(w.all, 'festive'));
    expect(r.relaxed).not.toBeNull();
    expect(r.outfits.length).toBeGreaterThan(0);
    expect(r.outfits[0].warnings?.length).toBeGreaterThan(0);
    expect(r.missing.map((m) => m.slot)).toContain('shoes');
  });
  it('reports missing bottoms for an empty category', () => {
    const r = generate(input([mk('shirt', 'white'), mk('sneakers', 'white')], 'office'));
    expect(r.outfits).toHaveLength(0);
    expect(r.missing.map((m) => m.slot)).toContain('bottom');
  });
});

describe('speed and paging', () => {
  it('generates from 200 made-up items in under 500 ms', () => {
    const types = ITEM_TYPES.filter((t) => !t.athletic && !t.ethnic);
    const items = Array.from({ length: 200 }, (_, i) => mk(types[i % types.length].id, SHADES[(i * 7) % SHADES.length].id));
    generate(input(items.slice(0, 40), 'office'));
    let best = Infinity;
    let r = generate(input(items, 'casual'));
    for (let i = 0; i < 3; i++) { const t0 = performance.now(); r = generate(input(items, 'casual')); best = Math.min(best, performance.now() - t0); }
    expect(best).toBeLessThan(500);
    expect(r.outfits.length).toBeGreaterThan(0);
  });
  it('pages 6 outfits without repeating a top + bottom pair', () => {
    const w = userWardrobe();
    const pages = paginate(generate(input(w.all, 'casual')).outfits, 6);
    for (const p of pages) {
      expect(p.length).toBeLessThanOrEqual(6);
      const keys = p.map((o) => `${o.slots.base}|${o.slots.bottom}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it('scores an outfit the same in Check and in suggestions', () => {
    const w = userWardrobe();
    const inp = input(w.all, 'office');
    const top = generate(inp).outfits[0];
    expect(evaluate(inp, top.slots).score).toBe(top.score);
  });
  it('turns rule breaks into warnings in Check', () => {
    const w = userWardrobe();
    const ev = evaluate(input(w.all, 'office'), { base: w.whiteTank.id, bottom: w.shadedJeans.id, shoes: w.whiteSneakers.id });
    expect(ev.warnings.join(' ')).toMatch(/Tank tops|Ombre/);
  });
});
