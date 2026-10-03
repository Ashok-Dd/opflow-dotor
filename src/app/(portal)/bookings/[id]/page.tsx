import type { Metadata } from 'next';
import Link from 'next/link';

import { ClockRange } from '@/components/clock';
import { Icon } from '@/components/icons';
import { load } from '@/lib/api';
import { clockLabel, dayLabel, istHour, istToday, longDate, rupees } from '@/lib/format';
import { getLang, serverT } from '@/lib/lang';
import { portal } from '@/lib/portal';
import type { BookingDetail, Today } from '@/lib/types';

import { BookingActions } from './actions-ui';

export const metadata: Metadata = { title: 'Booking' };

const EVENT: Record<string, string> = {
  held: 'Place kept while paying',
  confirmed: 'Booked online and paid',
  rescheduled: 'Date or time changed',
  moved_by_provider: 'Asked to pick a new time',
  cancelled_by_provider: 'Cancelled, money back sent',
  expired: 'Not paid in time',
};

export default async function BookingPage({ params }: PageProps<'/bookings/[id]'>) {
  const { id } = await params;
  const t = await serverT();
  const lang = await getLang();
  const r = await load<BookingDetail>(`/v1/doctor/bookings/${id}`);
  if (!r.data) {
    return (
      <div className="empty">
        <b>{t('Booking not found')}</b>
        <p>{t('It may have been moved.')}</p>
        <div className="actions" style={{ justifyContent: 'center', marginTop: 14 }}>
          <Link prefetch={false} className="btn ghost" href="/bookings">
            {t('Bookings')}
          </Link>
        </div>
      </div>
    );
  }
  const b = r.data;
  const { hospitals } = await portal();
  const hospital = hospitals.find((h) => h.id === b.hospitalId);
  // "Did not come" only makes sense for today's line once the OPD has started.
  let inRunningLine = false;
  if (b.sessionDate === istToday()) {
    const today = await load<Today>('/v1/doctor/today');
    const s = today.data?.sessions.find((x) => x.sessionId === b.sessionId);
    inRunningLine = !!s && (s.status === 'running' || s.status === 'paused');
  }
  const open = b.status === 'confirmed' && (!b.state || b.state === 'not_come' || b.state === 'waiting') && !b.waitingForNewTime;
  const hour = b.startsAt ? istHour(b.startsAt) : null;
  const stateText =
    b.status === 'cancelled_by_provider' ? ['Cancelled', 'bad'] :
    b.waitingForNewTime ? ['Asked to pick a new time', 'warn'] :
    b.status === 'no_show' || b.state === 'did_not_come' ? ['Did not come', 'bad'] :
    b.status === 'completed' || b.state === 'done' ? ['Done', 'good'] :
    b.state === 'with_doctor' ? ['With doctor', 'info'] :
    b.state === 'waiting' ? ['Waiting', 'warn'] : ['Booked', 'good'];

  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">
            <Link prefetch={false} href={`/bookings?date=${b.sessionDate}`} style={{ textDecoration: 'none' }}>
              ← {t('Bookings')}
            </Link>
          </div>
          <h1>{t('Token {0}', [b.tokenLabel])}</h1>
          <p>
            {dayLabel(lang, b.sessionDate)}
            {hour != null ? ' · ' : ''}
            {hour != null ? <ClockRange start={hour} end={hour + 1} /> : null}
          </p>
        </div>
      </header>
      <div className="cols">
        <div>
          <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="avatar" style={{ width: 64, height: 64, fontSize: 26, borderRadius: 18 }}>
              {b.name.trim().charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ font: '500 26px var(--serif)', margin: 0 }}>{b.name}</h3>
              <div className="muted">
                {[b.age != null ? t('{0} years', [b.age]) : null, b.gender ? t(b.gender[0]!.toUpperCase() + b.gender.slice(1)) : null].filter(Boolean).join(' · ')}
              </div>
            </div>
            <span className={`tag big ${stateText[1]}`}>{t(stateText[0]!)}</span>
          </div>
          <div className="card">
            <dl className="kv">
              {b.phone ? (
                <>
                  <dt>{t('Phone')}</dt>
                  <dd><a href={`tel:${b.phone}`} className="mono">{b.phone}</a></dd>
                </>
              ) : null}
              <dt>{t('Day')}</dt>
              <dd>{longDate(lang, b.sessionDate)}</dd>
              <dt>{t('Time')}</dt>
              <dd>{hour != null ? <ClockRange start={hour} end={hour + 1} /> : t('Emergency')}</dd>
              <dt>{t('Hospital')}</dt>
              <dd>{hospital?.name ?? '—'}</dd>
              <dt>{t('How booked')}</dt>
              <dd>{b.source === 'emergency' ? t('Emergency') : t('Online')}</dd>
              <dt>{t('Booking code')}</dt>
              <dd className="mono">{b.code}</dd>
              <dt>{t('Paid')}</dt>
              <dd className="tnum">{t('{0} online', [rupees(b.fee.paise + (b.emergencyChargePaise ?? 0))])}</dd>
              {b.status === 'cancelled_by_provider' ? (
                <>
                  <dt>{t('Money back')}</dt>
                  <dd>{t('{0} sent', [rupees(b.fee.paise + (b.emergencyChargePaise ?? 0))])}</dd>
                  {b.cancelledReason ? (
                    <>
                      <dt>{t('Reason')}</dt>
                      <dd>{b.cancelledReason}</dd>
                    </>
                  ) : null}
                </>
              ) : null}
            </dl>
          </div>
          {b.note ? (
            <>
              <h2 className="sec">{t('Problem the patient wrote')}</h2>
              <div className="card">{b.note}</div>
            </>
          ) : null}
        </div>
        <div className="grid">
          <div className="card">
            <h3>{t('History')}</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              {b.events
                .filter((e) => e.type !== 'held')
                .map((e, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--fern)', marginTop: 2 }}>
                      <Icon name="check" size={16} />
                    </span>
                    <span style={{ flex: 1 }}>
                      {t(EVENT[e.type] ?? e.type.replace(/_/g, ' '))}
                      <span className="faint" style={{ display: 'block', fontSize: 12.5 }}>
                        {dayLabel(lang, new Date(new Date(e.at).getTime() + 330 * 60_000).toISOString().slice(0, 10))} · {clockLabel(e.at)}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
          {open || (inRunningLine && b.state !== 'did_not_come' && b.state !== 'done') ? (
            <BookingActions id={b.id} name={b.name} feeText={rupees(b.fee.paise + (b.emergencyChargePaise ?? 0))} sessionId={b.sessionId} canMove={open && b.source !== 'emergency'} canNoShow={inRunningLine && open} canCancel={open} />
          ) : null}
        </div>
      </div>
    </>
  );
}
