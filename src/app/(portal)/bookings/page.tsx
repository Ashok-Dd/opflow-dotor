import type { Metadata } from 'next';

import { get } from '@/lib/api';
import { addDays, dayLabel, istToday, longDate, people, shortDay, weekdayOf } from '@/lib/format';
import { getLang, serverT } from '@/lib/lang';
import { portal } from '@/lib/portal';
import type { BookingCounts, DayBooking, Leave, Week } from '@/lib/types';

import { BookingsShell, NavLink, Results } from './nav';
import { CancelDayButton, DaySlots } from './slots';

export const metadata: Metadata = { title: 'Bookings' };

const FILTERS = [
  ['all', 'All'],
  ['online', 'Online'],
  ['emergency', 'Emergency'],
  ['changed', 'Changed'],
  ['cancelled', 'Cancelled'],
  ['missed', 'Did not come'],
] as const;

/** Bookings on any of the next 14 days, at every hospital the doctor works at. */
export default async function BookingsPage({ searchParams }: PageProps<'/bookings'>) {
  const sp = await searchParams;
  const t = await serverT();
  const lang = await getLang();
  const today = istToday();
  const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const filter = (typeof sp.f === 'string' ? sp.f : 'all') as (typeof FILTERS)[number][0];
  const { hospitals } = await portal();

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  // One call for the 14 counts, one for the chosen day (not 14 calls: the API limits calls per doctor).
  const [counts, weeks, leaves, dayList] = await Promise.all([
    get<BookingCounts>('/v1/doctor/bookings/counts', { from: today, days: 14 }),
    Promise.all(hospitals.map((h) => get<Week>('/v1/doctor/schedule', { hospital: h.id }))),
    get<Leave[]>('/v1/doctor/leaves'),
    get<{ items: DayBooking[] }>('/v1/doctor/bookings', { date }),
  ]);
  const countOf = new Map(counts.days.map((c) => [c.date, c.total]));
  const worksOn = (ymd: string) => weeks.some((w) => (w.days.find((x) => x.weekday === weekdayOf(ymd))?.blocks.length ?? 0) > 0);
  const onLeave = (ymd: string) => leaves.some((l) => l.date === ymd && !l.hospitalId);
  const all = dayList.items;
  const list = all.filter((b) => {
    switch (filter) {
      case 'online':
        return !b.emergency;
      case 'emergency':
        return b.emergency;
      case 'changed':
        return b.changed || b.waitingForNewTime;
      case 'cancelled':
        return b.status === 'cancelled_by_provider';
      case 'missed':
        return b.status === 'no_show' || b.queueState === 'did_not_come';
      default:
        return true;
    }
  });
  const perHour = Object.fromEntries(
    hospitals.map((h, i) => [h.id, weeks[i]?.days.find((x) => x.weekday === weekdayOf(date))?.blocks[0]?.perHour ?? 8]),
  );
  const live = all.filter((b) => b.status === 'confirmed' && !b.waitingForNewTime);
  const leave = onLeave(date);

  return (
    <BookingsShell>
      <header className="head">
        <div>
          <div className="kicker">{t('Next 14 days')}</div>
          <h1>{t('Bookings')}</h1>
        </div>
        {!leave && (worksOn(date) || all.length > 0) && date >= today ? (
          <CancelDayButton date={date} dayText={dayLabel(lang, date)} count={live.length} refund={live.reduce((a, b) => a + b.fee.paise, 0)} />
        ) : null}
      </header>

      <nav className="days" aria-label={t('Day')}>
        {days.map((d, i) => {
          const n = countOf.get(d) ?? 0;
          const off = n === 0 && (!worksOn(d) || onLeave(d));
          return (
            <NavLink key={d} href={`/bookings?date=${d}${filter !== 'all' ? `&f=${filter}` : ''}`} className={`day${off ? ' off' : ''}`} current={d === date}>
              <small>{i === 0 ? t('Today') : shortDay(lang, d)}</small>
              <b>{Number(d.slice(8))}</b>
              <span>{onLeave(d) ? t('Leave') : off ? t('Off') : n}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="chips" style={{ margin: '12px 0 6px' }}>
        {FILTERS.map(([k, label]) => (
          <NavLink key={k} className="chip" href={`/bookings?date=${date}${k !== 'all' ? `&f=${k}` : ''}`} current={filter === k}>
            {t(label)}
          </NavLink>
        ))}
      </div>

      <Results>
      {leave ? (
        <div className="empty" style={{ marginTop: 14 }}>
          <b>{t('You are on leave')}</b>
          <p>{t('No bookings are taken on this day.')}</p>
        </div>
      ) : list.length === 0 ? (
        <div className="empty" style={{ marginTop: 14 }}>
          <div className="art">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" />
            </svg>
          </div>
          <b>{!worksOn(date) ? t('No OPD on this day') : t('No bookings here')}</b>
          <p>{!worksOn(date) ? t('You can add timings in My timings.') : t('Try a different filter or day.')}</p>
        </div>
      ) : (
        <>
          <p className="muted" style={{ margin: '14px 0 0' }}>
            {longDate(lang, date)} · {people(lang, list.length)}
          </p>
          <DaySlots date={date} list={list} perHour={perHour} hospitals={hospitals.map((h) => ({ id: h.id, name: h.name }))} isToday={date === today} />
        </>
      )}
      </Results>
    </BookingsShell>
  );
}
