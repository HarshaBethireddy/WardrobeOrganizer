import { createRepo, type Repo } from '@/data/repo';
import type { GeoLocation, WeatherSnapshot } from '@/domain/types';
import type { WeatherDay } from '@/engine/types';
import { daysBetween, todayStr } from '@/lib/dates';

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const CACHE_MS = 3 * 3600 * 1000;
export const FORECAST_DAYS = 16;
export const ATTRIBUTION = 'Weather data by Open-Meteo.com';

export interface GeoResult extends GeoLocation { detail: string }

export async function searchCity(q: string, fetchImpl: typeof fetch = fetch): Promise<GeoResult[]> {
  const name = q.trim();
  if (name.length < 2) return [];
  const res = await fetchImpl(`${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=6&language=en&format=json`);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const json = await res.json();
  return (json.results ?? []).map((r: any) => ({
    name: String(r.name),
    lat: Number(r.latitude),
    lon: Number(r.longitude),
    detail: [r.admin1, r.country].filter(Boolean).join(', '),
  }));
}

export async function fetchForecast(loc: GeoLocation, fetchImpl: typeof fetch = fetch): Promise<WeatherDay[]> {
  const params = new URLSearchParams({
    latitude: loc.lat.toFixed(4),
    longitude: loc.lon.toFixed(4),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    timezone: 'auto',
    forecast_days: String(FORECAST_DAYS),
  });
  const res = await fetchImpl(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Forecast failed (${res.status})`);
  const d = (await res.json()).daily ?? {};
  const times: string[] = d.time ?? [];
  return times.map((date, i) => ({
    date,
    tMax: Number(d.temperature_2m_max?.[i] ?? NaN),
    tMin: Number(d.temperature_2m_min?.[i] ?? NaN),
    rainProb: Number(d.precipitation_probability_max?.[i] ?? 0) || 0,
    code: Number(d.weather_code?.[i] ?? 0) || 0,
  })).filter((w) => Number.isFinite(w.tMax) && Number.isFinite(w.tMin));
}

const cacheKey = (loc: GeoLocation) => `wx:${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;

/** Forecast for 16 days, cached for 3 hours. */
export async function getForecast(loc: GeoLocation, opts: { repo?: Repo; fetchImpl?: typeof fetch } = {}): Promise<WeatherDay[]> {
  const repo = opts.repo ?? createRepo();
  const hit = await repo.getCache<WeatherDay[]>(cacheKey(loc));
  if (hit?.length) return hit;
  const days = await fetchForecast(loc, opts.fetchImpl);
  await repo.setCache(cacheKey(loc), days, CACHE_MS);
  return days;
}

export type WeatherState =
  | { status: 'ok'; day: WeatherDay; place: string }
  | { status: 'no-location' }
  | { status: 'unavailable'; reason: 'offline' | 'error' | 'out-of-range' };

export async function weatherFor(
  date: string,
  loc: GeoLocation | null,
  opts: { repo?: Repo; fetchImpl?: typeof fetch; online?: boolean; now?: Date } = {},
): Promise<WeatherState> {
  if (!loc) return { status: 'no-location' };
  const ahead = daysBetween(todayStr(opts.now ?? new Date()), date);
  if (ahead < 0 || ahead >= FORECAST_DAYS) return { status: 'unavailable', reason: 'out-of-range' };
  try {
    const days = await getForecast(loc, opts);
    const day = days.find((d) => d.date === date);
    return day ? { status: 'ok', day, place: loc.name } : { status: 'unavailable', reason: 'out-of-range' };
  } catch {
    const offline = opts.online === false || (typeof navigator !== 'undefined' && navigator.onLine === false);
    return { status: 'unavailable', reason: offline ? 'offline' : 'error' };
  }
}

export function snapshot(state: WeatherState): WeatherSnapshot | undefined {
  if (state.status !== 'ok') return undefined;
  const { tMax, tMin, rainProb, code } = state.day;
  return { tMax, tMin, rainProb, code, place: state.place };
}

/** WMO weather codes grouped into a few kinds for icons and labels. */
export function weatherKind(code: number): 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm' {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51) return 'rain';
  return 'cloudy';
}

export const KIND_LABELS = { clear: 'Clear', partly: 'Partly cloudy', cloudy: 'Cloudy', fog: 'Fog', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorm' };
