import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns';
import { toDateStr } from '@/lib/dates';

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_ABBR: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
export const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function monthIndex(w: string): number {
  return MONTHS.findIndex((m) => m.startsWith(w.slice(0, 3)));
}

function weekdayIndex(w: string): number {
  const i = WEEKDAYS.indexOf(w.replace(/s$/, ''));
  if (i >= 0) return i;
  return WEEKDAY_ABBR[w] ?? -1;
}

export interface DateHit { from: string; to: string; single: boolean; text: string }

/**
 * Finds a date or date range in text. `direction` decides plain weekdays and day-month dates:
 * future for outfit requests, past for log requests.
 */
export function findDate(text: string, now: Date, direction: 'future' | 'past'): DateHit | null {
  const t = ` ${text.toLowerCase().replace(/[,?!.]/g, ' ').replace(/\s+/g, ' ')} `;
  const day = (d: Date, label: string): DateHit => ({ from: toDateStr(d), to: toDateStr(d), single: true, text: label });
  const range = (a: Date, b: Date, label: string): DateHit => ({ from: toDateStr(a), to: toDateStr(b), single: false, text: label });
  if (/ day after (tomorrow|tmrw|tmr|tomorow|tommorow|tomorrow's) /.test(t)) return day(addDays(now, 2), 'day after tomorrow');
  if (/ day before yesterday /.test(t)) return day(addDays(now, -2), 'day before yesterday');
  if (/ (tomorrow|tmrw|tmr|tomorow|tommorow|tomorrows|tomorrow's) /.test(t)) return day(addDays(now, 1), 'tomorrow');
  if (/ yesterday('s)? /.test(t)) return day(addDays(now, -1), 'yesterday');
  if (/ (today|tonight|now|today's|this evening|this morning) /.test(t)) return day(now, 'today');
  const week = { weekStartsOn: 1 as const };
  if (/ last week /.test(t)) { const s = startOfWeek(subWeeks(now, 1), week); return range(s, endOfWeek(s, week), 'last week'); }
  if (/ this week /.test(t)) return range(startOfWeek(now, week), endOfWeek(now, week), 'this week');
  if (/ last month /.test(t)) { const s = startOfMonth(subMonths(now, 1)); return range(s, endOfMonth(s), 'last month'); }
  if (/ this month /.test(t)) return range(startOfMonth(now), endOfMonth(now), 'this month');
  const m = t.match(/ last (\d{1,2}) days /);
  if (m) return range(addDays(now, -Number(m[1]) + 1), now, `last ${m[1]} days`);

  const wd = t.match(/ (next|last|this|coming|on)? ?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)s? /);
  if (wd) {
    const target = weekdayIndex(wd[2]);
    const today = now.getDay();
    let diff: number;
    if (wd[1] === 'next') diff = ((target - today + 7) % 7) || 7;
    else if (wd[1] === 'last') diff = -(((today - target + 7) % 7) || 7);
    else if (wd[1] === 'this' || wd[1] === 'coming') diff = (target - today + 7) % 7;
    else diff = direction === 'future' ? (target - today + 7) % 7 : -((today - target + 7) % 7);
    return day(addDays(now, diff), `${wd[1] ? wd[1] + ' ' : ''}${WEEKDAYS[target]}`);
  }
  const monthWords = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const dm = t.match(new RegExp(` (\\d{1,2})(?:st|nd|rd|th)? (?:of )?${monthWords}(?: (\\d{4}))? `)) ?? null;
  const md = dm ? null : t.match(new RegExp(` ${monthWords} (\\d{1,2})(?:st|nd|rd|th)?(?: (\\d{4}))? `));
  if (dm || md) {
    const dayNum = Number(dm ? dm[1] : md![2]);
    const mon = monthIndex((dm ? dm[2] : md![1]).slice(0, 3));
    const yearStr = dm ? dm[3] : md![3];
    return fromParts(dayNum, mon, yearStr ? Number(yearStr) : undefined, now, direction);
  }
  const num = t.match(/ (\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))? /);
  if (num) {
    const y = num[3] ? Number(num[3].length === 2 ? `20${num[3]}` : num[3]) : undefined;
    return fromParts(Number(num[1]), Number(num[2]) - 1, y, now, direction);
  }
  const mo = t.match(new RegExp(` (?:in |during )${monthWords} `));
  if (mo) {
    const idx = monthIndex(mo[1].slice(0, 3));
    let y = now.getFullYear();
    if (direction === 'past' && idx > now.getMonth()) y -= 1;
    const s = new Date(y, idx, 1);
    return range(s, endOfMonth(s), MONTHS[idx]);
  }
  return null;
}

function fromParts(d: number, m: number, y: number | undefined, now: Date, direction: 'future' | 'past'): DateHit | null {
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  let year = y ?? now.getFullYear();
  let date = new Date(year, m, d);
  if (date.getMonth() !== m) return null;
  if (y === undefined) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (direction === 'future' && date < today) date = new Date(++year, m, d);
    if (direction === 'past' && date > today) date = new Date(--year, m, d);
  }
  const s = toDateStr(date);
  return { from: s, to: s, single: true, text: s };
}
