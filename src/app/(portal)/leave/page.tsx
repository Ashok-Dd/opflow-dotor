import type { Metadata } from 'next';

import { get } from '@/lib/api';
import { istToday } from '@/lib/format';
import { serverT } from '@/lib/lang';
import { portal } from '@/lib/portal';
import type { BookingCounts, Leave, Week } from '@/lib/types';

import { LeaveCalendar } from './calendar';

export const metadata: Metadata = { title: 'Leave and holidays' };

/** Tap the days you will not come. Days with booked patients ask what to do for them first. */
export default async function LeavePage() {
  const t = await serverT();
  const { hospitals } = await portal();
  const today = istToday();
  // Both months on screen, in one call.
  const [leaves, weeks, counts] = await Promise.all([
    get<Leave[]>('/v1/doctor/leaves'),
    Promise.all(hospitals.map((h) => get<Week>('/v1/doctor/schedule', { hospital: h.id }))),
    get<BookingCounts>('/v1/doctor/bookings/counts', { from: today, days: 62 }),
  ]);
  const workdays = [1, 2, 3, 4, 5, 6, 7].filter((wd) => weeks.some((w) => (w.days.find((d) => d.weekday === wd)?.blocks.length ?? 0) > 0));
  const booked = counts.days.filter((c) => c.coming > 0).map((c) => c.date);
  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">{t('My timings')}</div>
          <h1>{t('Leave and holidays')}</h1>
          <p>{t('Tap the days you will not come.')}</p>
        </div>
      </header>
      <LeaveCalendar today={today} initial={leaves.filter((l) => !l.hospitalId).map((l) => l.date)} workdays={workdays} booked={booked} />
    </>
  );
}
