import type { Metadata } from 'next';

import { get } from '@/lib/api';
import { serverT } from '@/lib/lang';
import type { Messages } from '@/lib/types';

import { Inbox } from './inbox';

export const metadata: Metadata = { title: 'Messages' };

/** New bookings, time changes, emergency patients, OPD reminders, money sent — the same list as the app. */
export default async function MessagesPage() {
  const t = await serverT();
  const first = await get<Messages>('/v1/notifications', { limit: 30 });
  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">{t('OPD')}</div>
          <h1>{t('Messages')}</h1>
          <p>{t('New bookings, time changes and emergency patients will show here.')}</p>
        </div>
      </header>
      <Inbox first={first} />
    </>
  );
}
