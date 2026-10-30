import { describe, expect, it, vi } from 'vitest';
import { WardrobeDB } from '@/data/db';
import { createRepo } from '@/data/repo';
import { generate } from '@/engine/generator';
import { fetchForecast, searchCity, snapshot, weatherFor, weatherKind } from '@/weather/weather';
import { input, mk, userWardrobe, wx } from './helpers';

const forecast = (days: { date: string; max: number; min: number; rain?: number; code?: number }[]) => ({
  daily: {
    time: days.map((d) => d.date), temperature_2m_max: days.map((d) => d.max), temperature_2m_min: days.map((d) => d.min),
    precipitation_probability_max: days.map((d) => d.rain ?? 0), weather_code: days.map((d) => d.code ?? 1),
  },
});
const okFetch = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
const loc = { name: 'Bengaluru', lat: 12.97, lon: 77.59 };
let k = 0;

describe('weather service', () => {
  it('parses the daily forecast and caches it for 3 hours', async () => {
    const repo = createRepo(new WardrobeDB(`wx-${++k}-${Date.now()}`));
    const f = okFetch(forecast([{ date: '2026-10-31', max: 33, min: 24 }]));
    const now = new Date(2026, 9, 30, 9);
    const a = await weatherFor('2026-10-31', loc, { repo, fetchImpl: f, now });
    expect(a).toMatchObject({ status: 'ok', place: 'Bengaluru', day: { tMax: 33, tMin: 24 } });
    await weatherFor('2026-10-31', loc, { repo, fetchImpl: f, now });
    expect(f).toHaveBeenCalledTimes(1);
    expect(snapshot(a)).toMatchObject({ tMax: 33, place: 'Bengaluru' });
  });
  it('asks for the right variables and 16 days', async () => {
    const f = okFetch(forecast([]));
    await fetchForecast(loc, f);
    const url = String((f as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]);
    expect(url).toContain('daily=temperature_2m_max%2Ctemperature_2m_min%2Cprecipitation_probability_max%2Cweather_code');
    expect(url).toContain('forecast_days=16');
  });
  it('skips weather when offline, out of range or without a location', async () => {
    const repo = createRepo(new WardrobeDB(`wx-${++k}-${Date.now()}`));
    const failing = vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
    const now = new Date(2026, 9, 30, 9);
    expect(await weatherFor('2026-10-31', loc, { repo, fetchImpl: failing, online: false, now })).toEqual({ status: 'unavailable', reason: 'offline' });
    expect(await weatherFor('2026-12-31', loc, { repo, now })).toEqual({ status: 'unavailable', reason: 'out-of-range' });
    expect(await weatherFor('2026-10-31', null)).toEqual({ status: 'no-location' });
  });
  it('searches cities with the free geocoding API', async () => {
    const f = okFetch({ results: [{ name: 'Hyderabad', latitude: 17.38, longitude: 78.48, admin1: 'Telangana', country: 'India' }] });
    expect(await searchCity('hyder', f)).toEqual([{ name: 'Hyderabad', lat: 17.38, lon: 78.48, detail: 'Telangana, India' }]);
  });
  it('groups weather codes', () => {
    expect([weatherKind(0), weatherKind(2), weatherKind(61), weatherKind(95), weatherKind(71)]).toEqual(['clear', 'partly', 'rain', 'storm', 'snow']);
  });
});

describe('weather rules', () => {
  const w = userWardrobe();
  const jacketOutfits = (t: number) => generate(input(w.all, 'office', { weather: wx(t, t - 8), limit: 500 })).outfits.filter((o) => o.slots.outer);
  it('no jackets at 30\u00b0C or more', () => expect(jacketOutfits(33)).toHaveLength(0));
  it('jacket outfits rank higher on a mild day than a warm one', () => {
    const rank = (t: number) => generate(input(w.all, 'office', { weather: wx(t, t - 6) })).outfits.findIndex((o) => !!o.slots.outer);
    expect(rank(19)).toBeLessThan(rank(27));
  });
  it('requires a layer at 10\u00b0C or less when you own one', () => {
    const r = generate(input(w.all, 'office', { weather: wx(9, 3) }));
    expect(r.outfits.length).toBeGreaterThan(0);
    for (const o of r.outfits) expect(o.slots.outer || o.slots.mid).toBeTruthy();
  });
  it('penalises suede on rainy days and rewards sleeveless when hot', () => {
    const suede = mk('loafers', 'tan', { material: 'suede' }), chinos = mk('chinos', 'navy'), shirt = mk('shirt', 'white');
    const dry = generate(input([suede, chinos, shirt], 'office', { weather: wx(22, 15, 0) })).outfits[0].score;
    const wet = generate(input([suede, chinos, shirt], 'office', { weather: wx(22, 15, 90) })).outfits[0].score;
    expect(wet).toBeLessThan(dry);
    const tank = mk('tank', 'white'), shorts = mk('shorts', 'khaki'), slides = mk('slides', 'black');
    const hot = generate(input([tank, shorts, slides], 'casual', { weather: wx(34, 27) })).outfits[0];
    expect(hot.reasons.some((r) => r.text.includes('sleeveless keeps you cool'))).toBe(true);
  });
  it('uses the day high for day plans and the average for evenings', async () => {
    const { effectiveTemp } = await import('@/engine/style-rules');
    const { resolveOccasion } = await import('@/domain/occasions');
    expect(effectiveTemp(wx(30, 20), resolveOccasion('office'))).toBe(30);
    expect(effectiveTemp(wx(30, 20), resolveOccasion('party'))).toBe(25);
  });
});
