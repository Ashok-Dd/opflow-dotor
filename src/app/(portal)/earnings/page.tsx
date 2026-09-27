import type { Metadata } from 'next';
import Link from 'next/link';

import { get } from '@/lib/api';
import { dayLabel } from '@/lib/format';
import { getLang, serverT } from '@/lib/lang';
import type { Earnings, Payouts } from '@/lib/types';

export const metadata: Metadata = { title: 'My earnings' };

const RANGES = [7, 30, 90];

/** What really reaches the bank: 90% of each fee, sent 24 hours after the visit is over. */
export default async function EarningsPage({ searchParams }: PageProps<'/earnings'>) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const t = await serverT();
  const lang = await getLang();
  const [e, po] = await Promise.all([get<Earnings>('/v1/doctor/earnings', { days }), get<Payouts>('/v1/doctor/payouts')]);
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
      <h2 className="sec" style={{ marginTop: 28 }}>
        {t('Bank payouts')}
        <small>
          {po.bank
            ? po.bank.active
              ? t('To your account ending {0}. One payout covers many visits.', [po.bank.last4 ?? '····'])
              : t('Your bank account is being checked. Payouts start once it is verified.')
            : t('Your bank account is not added yet. Please call the OPflow team.')}
        </small>
      </h2>
      {po.items.length === 0 ? (
        <div className="empty">
          <b>{t('No payouts yet')}</b>
          <p>{t('Your money is sent to your bank 24 hours after your visits are over.')}</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('Sent on')}</th>
              <th className="num">{t('Visits')}</th>
              <th className="num">{t('Amount')}</th>
              <th>{t('Status')}</th>
              <th>{t('Bank reference')}</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((x) => (
              <tr key={x.id}>
                <td>{dayLabel(lang, x.createdAt.slice(0, 10))}</td>
                <td className="num">{x.visits}</td>
                <td className="num">
                  <b>{x.amount.display}</b>
                  {x.deducted ? (
                    <span className="faint" style={{ display: 'block', fontSize: 12 }}>
                      {t('{0} taken back for a cancelled visit', [x.deducted.display])}
                    </span>
                  ) : null}
                </td>
                <td>
                  {x.status === 'success' ? (
                    <span className="tag good">{t('Reached your bank')}</span>
                  ) : x.status === 'pending' ? (
                    <span className="tag warn">{t('On the way')}</span>
                  ) : (
                    <span className="tag bad">{t('Bank refused · will be sent again')}</span>
                  )}
                </td>
                <td className="mono">{x.bankReference ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
