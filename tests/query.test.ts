import { describe, expect, it } from 'vitest';
import { parseRequest } from '@/query/parser';
import { queryItems } from '@/query/inventory';
import type { WardrobeRequest } from '@/query/types';
import { mk, userWardrobe } from './helpers';

const NOW = new Date(2026, 9, 30, 10, 0); // Friday 30 October 2026
const w = userWardrobe();
const extra = [mk('shirt', 'cream', {}, { name: 'Cream linen shirt' }), mk('shirt', 'off-white'), mk('polo', 'navy'), mk('jeans', 'denim-medium', { distress: 'ripped' }), mk('shirt', 'white', {}, { archived: true })];
const items = [...w.all, ...extra];
const parse = (q: string) => parseRequest(q, { items, now: NOW, knownTags: ['client meeting'] });
type Inv = Extract<WardrobeRequest, { kind: 'inventory' }>;
const inv = (q: string) => { const r = parse(q); expect(r.kind, q).toBe('inventory'); return r as Inv; };

describe('wardrobe questions', () => {
  it.each([
    ['How many white shirts do I have?', 'count', { types: ['shirt'], families: ['white'] }],
    ['how many white or white-shade shirts', 'count', { types: ['shirt'], families: ['white'] }],
    ['any ripped jeans?', 'list', { types: ['jeans'], attrs: { distress: ['ripped', 'heavy'] } }],
    ['show my black stuff', 'list', { families: ['black'] }],
    ['how many tees', 'count', { types: ['tshirt'] }],
    ['list my shoes', 'list', { categories: ['shoes'] }],
    ['how many pants do I have', 'count', { categories: ['bottoms'] }],
    ['how many denims', 'count', { types: ['jeans'] }],
    ['show kicks', 'list', { types: ['sneakers'] }],
    ['my sleeveless tops', 'list', { types: ['tank'] }],
    ['any sleeveless shirts', 'list', { types: ['shirt'], attrs: { sleeve: ['sleeveless'] } }],
    ['cream shirts', 'list', { types: ['shirt'], shades: ['cream'] }],
    ['navy polos', 'list', { types: ['polo'], shades: ['navy'] }],
    ['count my jackets', 'count', { categories: ['outerwear'] }],
    ['do I have any linen shirts', 'list', { types: ['shirt'], attrs: { material: ['linen'] } }],
    ['show striped shirts', 'list', { types: ['shirt'], attrs: { pattern: ['stripes'] } }],
    ['any acid wash jeans', 'list', { types: ['jeans'], attrs: { wash: ['acid'] } }],
    ['shaded jeans', 'list', { types: ['jeans'], attrs: { wash: ['ombre'] } }],
    ['full sleeve polo', 'list', { types: ['polo'], attrs: { sleeve: ['long'] } }],
    ['half-zip t-shirts', 'list', { types: ['tshirt'], attrs: { closure: ['half-zip'] } }],
    ['show my brown leather shoes', 'list', { categories: ['shoes'], families: ['brown'], attrs: { material: ['leather'] } }],
    ['grey stuff', 'list', { families: ['grey'] }],
    ['how many items do I have', 'count', {}],
    ['which shirts can I wear to office', 'list', { types: ['shirt'], occasionId: 'office' }],
    ['do i have a zipper jacket', 'list', { types: ['jacket'] }],
    ['how many off-white shirts', 'count', { types: ['shirt'], shades: ['off-white'] }],
    ['dark blue jeans?', 'list', { types: ['jeans'], shades: ['denim-dark'] }],
    ['show me blue green jeans', 'list', { types: ['jeans'], shades: ['teal'] }],
    ['any buttoned jackets', 'list', { categories: ['outerwear'], attrs: { closure: ['buttons'] } }],
    ['how many white sneakers', 'count', { types: ['sneakers'], families: ['white'] }],
    ['list all my clothes', 'list', {}],
  ] as const)('%s', (q, mode, filter) => {
    const r = inv(q);
    expect(r.mode).toBe(mode);
    for (const [k, v] of Object.entries(filter)) expect(r.filter[k as keyof Inv['filter']], `${q}: ${k}`).toEqual(v);
  });

  it('white shirts returns only shirts, counts quantity, and skips archived items', () => {
    const res = queryItems(items, inv('how many white shirts do I have').filter);
    expect(res.items.every((i) => i.type === 'shirt')).toBe(true);
    expect(res.items.map((i) => i.primaryShade).sort()).toEqual(['cream', 'off-white', 'white']);
    expect(res.count).toBe(3);
    expect(queryItems(items, inv('how many black shirts').filter).count).toBe(2);
  });
  it('a shade also matches very close shades of its family', () => {
    const navy = [mk('polo', 'midnight-navy'), mk('polo', 'navy'), mk('polo', 'royal-blue')];
    expect(queryItems(navy, { shades: ['navy'] }).items.map((i) => i.primaryShade).sort()).toEqual(['midnight-navy', 'navy']);
  });
});
type Out = Extract<WardrobeRequest, { kind: 'outfit' }>;
type Log = Extract<WardrobeRequest, { kind: 'log' }>;
const out = (q: string) => { const r = parse(q); expect(r.kind, q).toBe('outfit'); return r as Out; };
const log = (q: string) => { const r = parse(q); expect(r.kind, q).toBe('log'); return r as Log; };

describe('outfit requests', () => {
  it.each([
    ['tomorrow office', 'office', '2026-10-31'],
    ['Office tomorrow', 'office', '2026-10-31'],
    ['what should I wear to work on Monday', 'office', '2026-11-02'],
    ['party on saturday', 'party', '2026-10-31'],
    ['dinner date tonight', 'date', '2026-10-30'],
    ['gym tmrw', 'gym', '2026-10-31'],
    ['outfit for a wedding on 12 December', 'festive', '2026-12-12'],
    ['client lunch day after tomorrow', 'office', '2026-11-01'],
    ['puja next friday', 'festive', '2026-11-06'],
    ['airport on 3/11', 'travel', '2026-11-03'],
    ['what to wear today', 'casual', '2026-10-30'],
    ['work out this sunday', 'gym', '2026-11-01'],
  ] as const)('%s', (q, occ, date) => {
    const r = out(q);
    expect(r.occasionId).toBe(occ);
    expect(r.date).toBe(date);
  });
  it('includes an item named in the request', () => {
    expect(out('what goes with my beige jacket?').include).toEqual([w.beigeJacket.id]);
    expect(out('style my black polo for a party').include).toEqual([w.blackPolo.id]);
  });
  it('leaves out items after "without" or "no"', () => {
    expect(out('office tomorrow without the black shirt').exclude).toEqual([w.blackShirt.id]);
    expect(out('party tonight, no black jeans').exclude).toEqual([w.blackJeans.id]);
  });
  it('asks which one when a reference matches several items', () => {
    const r = out('office tomorrow with my white shirt');
    expect(r.include).toEqual([]);
    expect(r.ambiguous[0].candidates.length).toBeGreaterThan(1);
  });
  it('notes items you do not own', () => {
    expect(out('date tonight with my red jacket').missing).toEqual(['red jacket']);
  });
});

describe('history requests', () => {
  it.each([
    ['what did I wear last Friday?', '2026-10-23', '2026-10-23'],
    ['what did I wear yesterday', '2026-10-29', '2026-10-29'],
    ['what did i wear on 12/10', '2026-10-12', '2026-10-12'],
    ['what did I wear last week', '2026-10-19', '2026-10-25'],
    ['outfits I wore in September', '2026-09-01', '2026-09-30'],
    ['what did I wear on monday', '2026-10-26', '2026-10-26'],
    ['what I wore on 2 March', '2026-03-02', '2026-03-02'],
  ] as const)('%s', (q, from, to) => {
    const r = log(q);
    expect([r.from, r.to]).toEqual([from, to]);
  });
  it('filters by item, occasion and known tags', () => {
    expect(log('when did I last wear my black polo').itemIds).toEqual([w.blackPolo.id]);
    expect(log('what did I wear to office this week').occasionId).toBe('office');
    expect(log('what did I wear for the client meeting').tags).toEqual(['client meeting']);
  });
  it('defaults to the last 30 days', () => {
    expect(log('what have I worn').from).toBe('2026-10-01');
  });
});

describe('unclear requests', () => {
  it.each(['hello there', 'asdfgh', '   '])('%s', (q) => expect(parse(q).kind).toBe('unknown'));
});
