import { format, startOfMonth } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCatalog } from '@/app/hooks';
import { Sheet } from '@/components/Sheet';
import { Chip, Empty, Segmented, Skeleton } from '@/components/ui';
import { useLogEntries } from '@/data/hooks';
import type { LogEntry } from '@/domain/types';
import { longDate } from '@/lib/dates';
import { createStore, useStore } from '@/lib/store';
import { Calendar } from './Calendar';
import { LogCard } from './LogCard';
import { RateBanner } from './RateBanner';

const view = createStore<{ mode: 'calendar' | 'list'; month: Date; occasion: string | null; tag: string | null }>({ mode: 'calendar', month: startOfMonth(new Date()), occasion: null, tag: null });

export function LogScreen() {
  const navigate = useNavigate();
  const log = useLogEntries();
  const { byId, custom, occasions } = useCatalog();
  const v = useStore(view);
  const set = (p: Partial<typeof v>) => view.set((s) => ({ ...s, ...p }));
  const [day, setDay] = useState<{ date: string; list: LogEntry[] } | null>(null);
  const tags = useMemo(() => [...new Set((log ?? []).flatMap((e) => e.tags))], [log]);
  const usedOcc = useMemo(() => occasions.filter((o) => (log ?? []).some((e) => e.occasionId === o.id)), [occasions, log]);
  const filtered = useMemo(() => (log ?? []).filter((e) => (!v.occasion || e.occasionId === v.occasion) && (!v.tag || e.tags.includes(v.tag))), [log, v.occasion, v.tag]);
  const monthKey = format(v.month, 'yyyy-MM');
  const listed = v.mode === 'list' ? filtered.filter((e) => e.date.startsWith(monthKey)) : filtered;

  return (
    <div className="px-4 pt-safe pb-6">
      <header className="flex items-end justify-between pt-6 pb-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Log</h1>
          <p className="text-sm text-muted">{(log ?? []).length} outfit{(log ?? []).length === 1 ? '' : 's'} saved</p>
        </div>
        <div className="w-44"><Segmented id="log-view" value={v.mode} onChange={(mode) => set({ mode })} options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]} /></div>
      </header>
      <RateBanner />
      {(usedOcc.length > 1 || tags.length > 0) && (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          <Chip selected={!v.occasion && !v.tag} onClick={() => set({ occasion: null, tag: null })}>All</Chip>
          {usedOcc.map((o) => <Chip key={o.id} selected={v.occasion === o.id} onClick={() => set({ occasion: v.occasion === o.id ? null : o.id })}>{o.short}</Chip>)}
          {tags.map((t) => <Chip key={t} selected={v.tag === t} onClick={() => set({ tag: v.tag === t ? null : t })}>#{t}</Chip>)}
        </div>
      )}
      {!log ? (
        <Skeleton className="mt-4 h-80" />
      ) : !log.length ? (
        <Empty icon={<CalendarDays size={26} />} title="Nothing logged yet">Pick an outfit and tap Wear this. It shows up here with the date and tags.</Empty>
      ) : v.mode === 'calendar' ? (
        <div className="mt-4">
          <Calendar month={v.month} onMonth={(month) => set({ month })} entries={filtered} byId={byId}
            onDay={(date, list) => (list.length === 1 ? navigate(`/log/${list[0].id}`) : setDay({ date, list }))} />
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <Chip onClick={() => set({ month: startOfMonth(new Date(v.month.getFullYear(), v.month.getMonth() - 1, 1)) })}>Earlier</Chip>
            <span className="font-medium">{format(v.month, 'MMMM yyyy')}</span>
            <Chip onClick={() => set({ month: startOfMonth(new Date(v.month.getFullYear(), v.month.getMonth() + 1, 1)) })}>Later</Chip>
          </div>
          {!listed.length ? <Empty title={`Nothing in ${format(v.month, 'MMMM')}`} /> : (
            <div className="space-y-3">{listed.map((e, i) => <LogCard key={e.id} entry={e} byId={byId} custom={custom} index={i} />)}</div>
          )}
        </div>
      )}
      <Sheet open={!!day} onClose={() => setDay(null)} title={day ? longDate(day.date) : ''}>
        <div className="space-y-3 pb-2">{day?.list.map((e, i) => <LogCard key={e.id} entry={e} byId={byId} custom={custom} index={i} />)}</div>
      </Sheet>
    </div>
  );
}
