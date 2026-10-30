import { useEffect, useMemo, useState } from 'react';
import { itemsById, useItems, useLikes, useLogEntries, useRejections } from '@/data/hooks';
import { useSecret, useSetting } from '@/data/settings';
import { allOccasions, resolveOccasion } from '@/domain/occasions';
import type { EngineInput, WeatherDay } from '@/engine/types';
import { aiConfigured } from '@/ai/service';
import { weatherFor, type WeatherState } from '@/weather/weather';

export function useCatalog() {
  const items = useItems();
  const [custom] = useSetting('occasions.custom');
  const byId = useMemo(() => itemsById(items), [items]);
  const active = useMemo(() => (items ?? []).filter((i) => !i.archived), [items]);
  const occasions = useMemo(() => allOccasions(custom), [custom]);
  return { items: items ?? [], active, byId, custom, occasions, loading: items === undefined };
}

/** Everything the outfit engine needs, kept live from the database. */
export function useEngineInput(occasionId: string, date: string, weather: WeatherDay | null, extra: Partial<EngineInput> = {}): EngineInput | null {
  const { items, custom, loading } = useCatalog();
  const rejections = useRejections();
  const logEntries = useLogEntries();
  const likes = useLikes();
  const [rotationDays] = useSetting('prefs.rotationDays');
  const [useHistory] = useSetting('prefs.useHistory');
  const include = extra.include?.join(',') ?? '';
  const exclude = extra.exclude?.join(',') ?? '';
  return useMemo(() => {
    if (loading || !rejections || !logEntries || !likes) return null;
    return {
      items, occasion: resolveOccasion(occasionId, custom), date, weather, rejections, logEntries, likes,
      settings: { rotationDays, useHistory },
      include: include ? include.split(',') : [],
      exclude: exclude ? exclude.split(',') : [],
    };
  }, [items, custom, loading, rejections, logEntries, likes, rotationDays, useHistory, occasionId, date, weather, include, exclude]);
}

export function useWeather(date: string): WeatherState | null {
  const [loc] = useSetting('weather.location');
  const [state, setState] = useState<WeatherState | null>(null);
  const key = `${date}|${loc?.lat ?? ''}|${loc?.lon ?? ''}`;
  useEffect(() => {
    let live = true;
    setState(null);
    weatherFor(date, loc).then((s) => live && setState(s));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useAiReady(): boolean {
  const [primary] = useSetting('ai.primary');
  const [fallback] = useSetting('ai.fallback');
  const [g] = useSecret('secret:gemini');
  const [q] = useSecret('secret:groq');
  const [o] = useSecret('secret:openrouter');
  const [om] = useSetting('ai.openrouterModel');
  const [gm] = useSetting('ai.groqModel');
  const [ready, setReady] = useState(false);
  useEffect(() => { aiConfigured().then(setReady); }, [primary, fallback, g, q, o, om, gm]);
  return ready;
}

export function useOnline(): boolean {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}
