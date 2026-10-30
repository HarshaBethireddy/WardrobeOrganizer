import { CalendarDays, MapPin, WifiOff } from 'lucide-react';
import { Link } from 'react-router';
import { OccasionIcon, WeatherIcon } from '@/components/icons';
import { Chip, Skeleton } from '@/components/ui';
import type { OccasionProfile } from '@/domain/occasions';
import { addDaysStr, friendlyDate, todayStr } from '@/lib/dates';
import { ATTRIBUTION, type WeatherState } from '@/weather/weather';

export function OccasionChips({ value, onChange, occasions }: { value: string; onChange: (id: string) => void; occasions: OccasionProfile[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Occasion">
      {occasions.map((o) => (
        <Chip key={o.id} selected={value === o.id} onClick={() => onChange(o.id)}><OccasionIcon occasion={o} size={16} />{o.short}</Chip>
      ))}
    </div>
  );
}

export function DateRow({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const today = todayStr(), tomorrow = addDaysStr(today, 1);
  const other = value !== today && value !== tomorrow;
  return (
    <div className="flex gap-2">
      <Chip selected={value === today} onClick={() => onChange(today)}>Today</Chip>
      <Chip selected={value === tomorrow} onClick={() => onChange(tomorrow)}>Tomorrow</Chip>
      <label className={`relative inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm ${other ? 'border-white bg-white text-black' : 'border-line bg-surface-2'}`}>
        <CalendarDays size={16} />
        {other ? friendlyDate(value) : 'Pick a date'}
        <input type="date" aria-label="Pick a date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="absolute inset-0 opacity-0" />
      </label>
    </div>
  );
}

export function WeatherChip({ state }: { state: WeatherState | null }) {
  if (!state) return <Skeleton className="h-9 w-48 rounded-full" />;
  const base = 'inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-sm';
  if (state.status === 'no-location') return <Link to="/settings#weather" className={`${base} text-muted`}><MapPin size={15} />Set your city for weather</Link>;
  if (state.status === 'unavailable') {
    const text = state.reason === 'offline' ? 'Offline: weather skipped' : state.reason === 'out-of-range' ? 'No forecast that far ahead' : 'Weather unavailable';
    return <span className={`${base} text-muted`}><WifiOff size={15} />{text}</span>;
  }
  const d = state.day;
  return (
    <span className={base} title={ATTRIBUTION}>
      <WeatherIcon code={d.code} />
      {Math.round(d.tMax)}{'\u00b0 / '}{Math.round(d.tMin)}{'\u00b0'}
      {d.rainProb >= 20 && <span className="text-muted">{` \u00b7 ${Math.round(d.rainProb)}% rain`}</span>}
      <span className="text-muted">{` \u00b7 ${state.place}`}</span>
    </span>
  );
}
