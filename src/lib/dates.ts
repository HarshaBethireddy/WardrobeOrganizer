import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const toDateStr = (d: Date) => format(d, 'yyyy-MM-dd');
export const todayStr = (now = new Date()) => toDateStr(now);
export const fromDateStr = (s: string) => parseISO(s);
export const addDaysStr = (s: string, n: number) => toDateStr(addDays(parseISO(s), n));
export const daysBetween = (from: string, to: string) => differenceInCalendarDays(parseISO(to), parseISO(from));

/** "Today", "Tomorrow", "Yesterday" or e.g. "Tue 14 Oct". */
export function friendlyDate(s: string, now = new Date()): string {
  const diff = daysBetween(todayStr(now), s);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return format(parseISO(s), 'EEE d MMM');
}

export const longDate = (s: string) => format(parseISO(s), 'EEEE, d MMMM yyyy');
