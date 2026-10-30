import type { Item, LogEntry } from '@/domain/types';
import { daysBetween } from '@/lib/dates';

export const ROTATION_PENALTY = 12;
export const ROTATION_SHOE_PENALTY = 4;
export const ROTATION_MAX = 25;

/** Most recent date each item was worn on or before the target date. */
export function lastWornMap(log: LogEntry[], targetDate: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of log) {
    if (e.date > targetDate) continue;
    for (const id of Object.values(e.slots)) {
      if (!id) continue;
      const prev = map.get(id);
      if (!prev || e.date > prev) map.set(id, e.date);
    }
  }
  return map;
}

/**
 * Penalty for an item worn within the last N days: full the day after, shrinking with time,
 * divided by quantity and smaller for shoes.
 */
export function itemRotationPenalty(item: Item, lastWorn: string | undefined, targetDate: string, days: number): number {
  if (!lastWorn || days <= 0) return 0;
  const ago = daysBetween(lastWorn, targetDate);
  if (ago < 0 || ago > days) return 0;
  const base = item.type && isShoe(item) ? ROTATION_SHOE_PENALTY : ROTATION_PENALTY;
  const factor = (days + 1 - Math.max(ago, 1)) / days;
  return (base * factor) / Math.max(1, item.quantity);
}

function isShoe(item: Item) {
  return ['sneakers', 'running-shoes', 'loafers', 'formal-shoes', 'boots', 'sandals', 'slides', 'mojari'].includes(item.type);
}
