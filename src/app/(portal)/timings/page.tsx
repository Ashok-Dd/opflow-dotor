import type { Metadata } from 'next';
import Link from 'next/link';

import { Icon } from '@/components/icons';
import { PauseCard } from '@/components/pause';
import { get } from '@/lib/api';
import { serverT } from '@/lib/lang';
import { portal } from '@/lib/portal';
import type { Week } from '@/lib/types';

import { WeekEditor } from './week-editor';

export const metadata: Metadata = { title: 'My timings' };

export default async function TimingsPage() {
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
  const week = await get<Week>('/v1/doctor/schedule', { hospital: hospital.id });
  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">{hospital.name}</div>
          <h1>{t('My timings')}</h1>
          <p>{t('You decide the hours and how many patients.')}</p>
        </div>
        <Link prefetch={false} className="btn ghost" href="/leave">
          <Icon name="leave" /> {t('Leave and holidays')}
        </Link>
      </header>
      <PauseCard paused={me.bookingsPaused} />
      <WeekEditor key={hospital.id} initial={week} />
    </>
  );
}
