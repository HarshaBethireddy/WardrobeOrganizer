import { Star } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from '@/components/toast';
import { Stars } from '@/components/ui';
import { useLogEntries } from '@/data/hooks';
import { repo } from '@/data/repo';
import { addDaysStr, todayStr } from '@/lib/dates';
import type { LogEntry } from '@/domain/types';

/** The entry the "Rate yesterday's outfit" banner asks about, if any. */
export function unratedYesterday(log: LogEntry[], today = todayStr()): LogEntry | undefined {
  const y = addDaysStr(today, -1);
  return log.filter((e) => e.date === y && e.rating === undefined).sort((a, b) => b.createdAt - a.createdAt)[0];
}

export function RateBanner() {
  const log = useLogEntries();
  const entry = log ? unratedYesterday(log) : undefined;
  if (!entry) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-surface-2 px-4 py-3">
      <div className="flex items-center gap-2 text-sm"><Star size={16} /> How was yesterday's outfit?</div>
      <Stars label="Rate yesterday's outfit" onChange={async (v) => { await repo.updateLogEntry(entry.id, { rating: v }); toast(`Rated ${v}\u2605. Thanks, suggestions will use it.`); }} />
    </motion.div>
  );
}
