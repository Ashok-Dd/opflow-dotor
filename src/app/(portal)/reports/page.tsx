import type { Metadata } from 'next';
import Link from 'next/link';

import { get } from '@/lib/api';
import { serverT } from '@/lib/lang';
import type { Reports } from '@/lib/types';

export const metadata: Metadata = { title: 'Reports' };

const RANGES = [7, 30, 90];

export default async function ReportsPage({ searchParams }: PageProps<'/reports'>) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const t = await serverT();
  const r = await get<Reports>('/v1/doctor/reports', { days });
  const figs: [string, string | number, string?][] = [
    ['OPDs held', r.sessions],
    ['Patients booked', r.booked],
    ['Patients seen', r.seen, 'fern'],
    ['Did not come', r.missed, 'alarm'],
    ['Cancelled with money back', r.cancelled],
    ['Emergency patients', r.emergency, 'alarm'],
    ['Average time per patient', r.avgConsultMinutes != null ? t('{0} min', [r.avgConsultMinutes]) : '—'],
    ['Came when booked', r.showRate != null ? `${r.showRate}%` : '—', 'fern'],
  ];
  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">{t('My work')}</div>
          <h1>{t('Reports')}</h1>
          <p>{t('Patients, waiting time, did not come')}</p>
        </div>
        <div className="chips">
          {RANGES.map((d) => (
            <Link prefetch={false} key={d} className="chip" href={`/reports?days=${d}`} aria-current={d === days ? 'page' : undefined}>
              {t('{0} days', [d])}
            </Link>
          ))}
        </div>
      </header>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {figs.map(([label, value, tone]) => (
          <div key={label} className="card">
            <div className="faint" style={{ font: '600 11px var(--mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t(label)}
            </div>
            <div style={{ font: '500 34px/1.1 var(--serif)', marginTop: 8, color: tone === 'fern' ? 'var(--fern)' : tone === 'alarm' ? 'var(--alarm)' : 'var(--ink)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
