import { t, type Lang } from './i18n';

/**
 * Times and days, as the doctor app says them. All OPD times are Indian time (IST), whatever the computer's
 * own time zone is.
 */
const IST_MS = 330 * 60_000;
const istParts = (iso: string | Date) => {
  const d = new Date(new Date(iso).getTime() + IST_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), wd: (d.getUTCDay() + 6) % 7, h: d.getUTCHours(), min: d.getUTCMinutes() };
};

const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const daysEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const longDaysEn = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const monthsTe = ['జన', 'ఫిబ్ర', 'మార్చి', 'ఏప్రి', 'మే', 'జూన్', 'జూలై', 'ఆగ', 'సెప్టెం', 'అక్టో', 'నవం', 'డిసెం'];
const daysTe = ['సోమ', 'మంగళ', 'బుధ', 'గురు', 'శుక్ర', 'శని', 'ఆది'];
const longDaysTe = ['సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం', 'ఆదివారం'];
const names = (lang: Lang) =>
  lang === 'te' ? { months: monthsTe, days: daysTe, longDays: longDaysTe } : { months: monthsEn, days: daysEn, longDays: longDaysEn };

/** Hour 0–23 in IST of an ISO time. */
export const istHour = (iso: string) => istParts(iso).h;

/** "YYYY-MM-DD" of today in IST. */
export function istToday(): string {
  const p = istParts(new Date());
  return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 1 = Monday … 7 = Sunday, for a YYYY-MM-DD date. */
export function weekdayOf(ymd: string): number {
  return ((new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

/** 9 → "9 AM", 13 → "1 PM". */
export function hourLabel(h: number): string {
  const suffix = h % 24 >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

/** "9:45 AM" of an ISO time (IST). */
export function clockLabel(iso: string | Date): string {
  const p = istParts(iso);
  return `${p.h % 12 === 0 ? 12 : p.h % 12}:${String(p.min).padStart(2, '0')} ${p.h >= 12 ? 'PM' : 'AM'}`;
}

/** "Today", "Tomorrow", "Yesterday" or "Fri, 26 Sep" for YYYY-MM-DD. */
export function dayLabel(lang: Lang, ymd: string): string {
  const today = istToday();
  if (ymd === today) return t(lang, 'Today');
  if (ymd === addDays(today, 1)) return t(lang, 'Tomorrow');
  if (ymd === addDays(today, -1)) return t(lang, 'Yesterday');
  const d = new Date(`${ymd}T00:00:00Z`);
  const n = names(lang);
  return `${n.days[(d.getUTCDay() + 6) % 7]}, ${d.getUTCDate()} ${n.months[d.getUTCMonth()]}`;
}

/** "Friday, 26 Sep 2026" */
export function longDate(lang: Lang, ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const n = names(lang);
  return `${n.longDays[(d.getUTCDay() + 6) % 7]}, ${d.getUTCDate()} ${n.months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function shortDay(lang: Lang, ymd: string): string {
  return names(lang).days[(new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7]!;
}

export function monthName(lang: Lang, monthIndex: number): string {
  return names(lang).months[monthIndex]!;
}

/** "5 min ago", "2 hours ago", "Yesterday", "26 Sep". */
export function agoLabel(lang: Lang, iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return t(lang, 'Just now');
  if (mins < 60) return t(lang, '{0} min ago', [mins]);
  const hours = Math.round(mins / 60);
  if (hours < 24) return t(lang, hours === 1 ? '1 hour ago' : '{0} hours ago', [hours]);
  const p = istParts(iso);
  const ymd = `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  if (ymd === addDays(istToday(), -1)) return t(lang, 'Yesterday');
  const n = names(lang);
  return `${p.day} ${n.months[p.m]}`;
}

export function people(lang: Lang, n: number): string {
  return n === 1 ? t(lang, '1 person') : t(lang, '{0} people', [n]);
}

export function rupees(paise: number): string {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(paise / 100)}`;
}

/** Initials for a name: "Dr. Srinivas Rao" → "SR". */
export function initials(name: string): string {
  return name
    .replace(/^dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
