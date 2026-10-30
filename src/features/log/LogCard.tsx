import { motion } from 'motion/react';
import { Link } from 'react-router';
import { OccasionIcon } from '@/components/icons';
import { OutfitCollage, Photo } from '@/components/media';
import { Stars } from '@/components/ui';
import { resolveOccasion } from '@/domain/occasions';
import type { CustomOccasion, Item, LogEntry } from '@/domain/types';
import { friendlyDate } from '@/lib/dates';

export function LogCard({ entry, byId, custom, index = 0 }: { entry: LogEntry; byId: Map<string, Item>; custom: CustomOccasion[]; index?: number }) {
  const occ = resolveOccasion(entry.occasionId, custom);
  return (
    <motion.div layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.04 }}>
      <Link to={`/log/${entry.id}`} className="block rounded-[28px] border border-line bg-surface p-3">
        <div className="relative">
          <OutfitCollage slots={entry.slots} byId={byId} className="h-52" />
          {entry.selfieId && (
            <div className="absolute right-2 bottom-2 h-20 w-16 overflow-hidden rounded-xl border-2 border-black">
              <Photo photoId={entry.selfieId} alt="Selfie" className="size-full" />
            </div>
          )}
        </div>
        <div className="flex items-start justify-between gap-2 px-1 pt-3">
          <div className="min-w-0">
            <div className="font-medium">{friendlyDate(entry.date)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
              <span className="inline-flex items-center gap-1"><OccasionIcon occasion={occ} size={14} />{occ.short}</span>
              {entry.tags.map((t) => <span key={t} className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-fg">{t}</span>)}
            </div>
            {entry.note && <p className="mt-1 line-clamp-1 text-sm text-faint">{entry.note}</p>}
          </div>
          {entry.rating !== undefined && <Stars value={entry.rating} size="sm" />}
        </div>
      </Link>
    </motion.div>
  );
}
