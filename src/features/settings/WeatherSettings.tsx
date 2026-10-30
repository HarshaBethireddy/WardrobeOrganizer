import { LocateFixed, MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Section } from '@/components/ui';
import { useSetting } from '@/data/settings';
import { ATTRIBUTION, searchCity, type GeoResult } from '@/weather/weather';

export function WeatherSettings() {
  const [loc, setLoc] = useSetting('weather.location');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [msg, setMsg] = useState('');
  const search = async () => {
    setMsg('');
    try { const r = await searchCity(q); setResults(r); if (!r.length) setMsg('No places found.'); }
    catch { setMsg('Search needs an internet connection.'); }
  };
  const locate = () => {
    if (!navigator.geolocation) { setMsg('Location is not available on this device.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ name: 'Current location', lat: p.coords.latitude, lon: p.coords.longitude }); setMsg(''); },
      () => setMsg('Location permission was denied.'),
      { timeout: 10000, maximumAge: 3600_000 },
    );
  };
  return (
    <Section title="Weather">
      <div id="weather" />
      <Card>
        <p className="flex items-center gap-2"><MapPin size={16} />{loc ? loc.name : 'No location set'}</p>
        <p className="mt-1 text-sm text-muted">Suggestions use the forecast for the day you're dressing for: no jackets on hot days, layers when it's cool.</p>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); search(); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your city" aria-label="Search your city" className="min-h-12 flex-1 rounded-2xl border border-line bg-surface-2 px-4 outline-none" />
          <Button type="submit" aria-label="Search" icon={<Search size={18} />} disabled={q.trim().length < 2} />
        </form>
        {results && results.length > 0 && (
          <ul className="mt-2 overflow-hidden rounded-2xl border border-line">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button type="button" className="flex min-h-12 w-full flex-col justify-center border-b border-line bg-surface-2 px-4 py-2 text-left last:border-b-0"
                  onClick={() => { setLoc({ name: r.name, lat: r.lat, lon: r.lon }); setResults(null); setQ(''); }}>
                  <span>{r.name}</span><span className="text-xs text-faint">{r.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" icon={<LocateFixed size={16} />} onClick={locate}>Use my location</Button>
          {loc && <Button size="sm" onClick={() => setLoc(null)}>Clear</Button>}
        </div>
        {msg && <p className="mt-2 text-sm text-warn">{msg}</p>}
        <p className="mt-3 text-xs text-faint"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">{ATTRIBUTION}</a> (CC BY 4.0). Free for personal use, no key needed.</p>
      </Card>
    </Section>
  );
}
