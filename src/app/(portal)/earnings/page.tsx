import type { Metadata } from 'next';
import Link from 'next/link';

import { get } from '@/lib/api';
import { dayLabel } from '@/lib/format';
import { getLang, serverT } from '@/lib/lang';
import type { Earnings } from '@/lib/types';

export const metadata: Metadata = { title: 'My earnings' };

const RANGES = [7, 30, 90];

/** What really reaches the bank: 90% of each fee, sent 24 hours after the visit is over. */
export default async function EarningsPage({ searchParams }: PageProps<'/earnings'>) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const t = await serverT();
  const lang = await getLang();
  const e = await get<Earnings>('/v1/doctor/earnings', { days });
  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">{t('My work')}</div>
          <h1>{t('My earnings')}</h1>
          <p>{t('You get 90% of your fee. It reaches your bank 24 hours after the visit is over.')}</p>
        </div>
        <div className="chips">
          {RANGES.map((d) => (
            <Link prefetch={false} key={d} className="chip" href={`/earnings?days=${d}`} aria-current={d === days ? 'page' : undefined}>
              {t('{0} days', [d])}
            </Link>
          ))}
        </div>
      </header>
      <div className="card flat" style={{ padding: 0, marginBottom: 18 }}>
        <div className="stats five">
          <div>
            <b>{e.totals.patients}</b>
            <span>{t('Patients')}</span>
          </div>
          <div className="fern">
            <b>{e.totals.earned.display}</b>
            <span>{t('You earned')}</span>
          </div>
          <div>
            <b>{e.totals.inBank.display}</b>
            <span>{t('In your bank')}</span>
          </div>
          <div className="amber">
            <b>{e.totals.coming.display}</b>
            <span>{t('Coming')}</span>
          </div>
          <div className="alarm">
            <b>{e.totals.moneyBackGiven.display}</b>
            <span>{t('Money back to patients')}</span>
          </div>
        </div>
      </div>
      {e.rows.length === 0 ? (
        <div className="empty">
          <b>{t('No earnings yet')}</b>
          <p>{t('Your earnings show here after your first paid bookings.')}</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('Day')}</th>
              <th className="num">{t('Patients')}</th>
              <th className="num">{t('Fees')}</th>
              <th className="num">{t('OPflow (10%)')}</th>
              <th className="num">{t('Yours (90%)')}</th>
              <th className="num">{t('In your bank')}</th>
              <th className="num">{t('Coming')}</th>
              <th className="num">{t('Money back')}</th>
            </tr>
          </thead>
          <tbody>
            {e.rows.map((r) => (
              <tr key={r.date}>
                <td>{dayLabel(lang, r.date)}</td>
                <td className="num">{r.patients}</td>
                <td className="num">{r.fees.display}</td>
                <td className="num">{r.opflow.display}</td>
                <td className="num">
                  <b>{r.yours.display}</b>
                </td>
                <td className="num">{r.inBank.display}</td>
                <td className="num">{r.coming.display}</td>
                <td className="num">{r.moneyBack.paise ? r.moneyBack.display : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
