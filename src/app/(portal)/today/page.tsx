import type { Metadata } from 'next';

import { get } from '@/lib/api';
import { istHour, weekdayOf } from '@/lib/format';
import { serverT } from '@/lib/lang';
import { portal } from '@/lib/portal';
import type { DayBooking, Today, Week } from '@/lib/types';

import { Console } from './console';

export const metadata: Metadata = { title: 'Today' };

/** Today's OPD at the hospital on screen: the console. */
export default async function TodayPage() {
  const t = await serverT();
  const { me, hospital } = await portal();
  if (!hospital) {
    return (
      <div className="empty">
        <b>{t('No hospital yet')}</b>
        <p>{t('The OPflow team adds the hospitals you work at. Please call them.')}</p>
      </div>
    );
  }
  const [today, week] = await Promise.all([
    get<Today>('/v1/doctor/today', { hospital: hospital.id }),
    get<Week>('/v1/doctor/schedule', { hospital: hospital.id }),
  ]);
  // Patients at the doctor's OTHER hospitals today (a doctor may sit at two in one day).
  const all = await get<{ items: DayBooking[] }>('/v1/doctor/bookings', { date: today.date });
  const others = all.items.filter((b) => b.hospital.id !== hospital.id && b.status === 'confirmed' && (!b.queueState || b.queueState === 'not_come'));
  const firstOther = others[0];
  const elsewhere = firstOther
    ? {
        hospitalId: firstOther.hospital.id,
        name: firstOther.hospital.name,
        count: others.filter((b) => b.hospital.id === firstOther.hospital.id).length,
        firstHour: Math.min(...others.filter((b) => b.hospital.id === firstOther.hospital.id).map((b) => istHour(b.startsAt))),
      }
    : null;
  const blocks = week.days.find((d) => d.weekday === weekdayOf(today.date))?.blocks ?? [];

  return (
    <Console
      key={hospital.id}
      initial={today}
      hospitalId={hospital.id}
      hospitalName={hospital.name}
      bookingsPaused={me.bookingsPaused}
      perHour={blocks.map((b) => ({ start: Number(b.start.slice(0, 2)), end: Number(b.end.slice(0, 2)), perHour: b.perHour }))}
      elsewhere={elsewhere}
    />
  );
}
