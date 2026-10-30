import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Photo } from '@/components/media';
import { IconButton } from '@/components/ui';
import type { Item, LogEntry } from '@/domain/types';
import { toDateStr, todayStr } from '@/lib/dates';
import { cn } from '@/lib/cn';

/** Groups entries by local date (YYYY-MM-DD). */
export function groupByDate(entries: LogEntry[]): Map<string, LogEntry[]> {
  const m = new Map<string, LogEntry[]>();
  for (const e of entries) m.set(e.date, [...(m.get(e.date) ?? []), e]);
  for (const list of m.values()) list.sort((a, b) => a.createdAt - b.createdAt);
  return m;
}

export function thumbOf(e: LogEntry, byId: Map<string, Item>): string | undefined {
  return e.selfieId ?? byId.get(e.slots.base ?? '')?.photoId ?? byId.get(e.slots.outer ?? '')?.photoId;
}

export function Calendar({ month, onMonth, entries, byId, onDay }: { month: Date; onMonth: (d: Date) => void; entries: LogEntry[]; byId: Map<string, Item>; onDay: (date: string, list: LogEntry[]) => void }) {
  const byDate = groupByDate(entries);
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const today = todayStr();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <IconButton label="Previous month" onClick={() => onMonth(addMonths(month, -1))}><ChevronLeft /></IconButton>
        <h2 className="text-lg font-medium">{format(month, 'MMMM yyyy')}</h2>
        <IconButton label="Next month" onClick={() => onMonth(addMonths(month, 1))}><ChevronRight /></IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-faint">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="py-1">{d}</div>)}</div>
      <motion.div key={format(month, 'yyyy-MM')} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const ds = toDateStr(d);
          const list = byDate.get(ds) ?? [];
          const thumb = list[0] ? thumbOf(list[0], byId) : undefined;
          return (
            <button key={ds} type="button" disabled={!list.length} onClick={() => onDay(ds, list)} aria-label={`${format(d, 'd MMMM')}${list.length ? `, ${list.length} outfit${list.length > 1 ? 's' : ''}` : ''}`}
              className={cn('relative aspect-[3/4] overflow-hidden rounded-xl border text-xs', isSameMonth(d, month) ? 'border-line bg-surface' : 'border-transparent opacity-30', ds === today && 'border-white')}>
              {list.length > 0 && <Photo photoId={thumb} alt="" className="absolute inset-0 size-full" />}
              <span className={cn('absolute top-1 left-1.5 font-medium', list.length ? 'rounded bg-black/60 px-1' : 'text-muted')}>{format(d, 'd')}</span>
              {list.length > 1 && <span className="absolute right-1 bottom-1 rounded-full bg-white px-1.5 text-[10px] font-semibold text-black">{list.length}</span>}
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
