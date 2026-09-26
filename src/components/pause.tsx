'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { setBookingsPaused } from '@/app/(portal)/actions';

import { useConfirm, useT, useToast } from './client-kit';
import { Icon } from './icons';

/** Pause / resume new bookings, with the app's question first and a note after (only when it really worked). */
export function usePauseToggle(paused: boolean) {
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [busy, start] = useTransition();
  const toggle = async () => {
    const pausing = !paused;
    const ok = await confirm(
      pausing ? t('Pause new bookings?') : t('Take bookings again?'),
      pausing
        ? t('Patients will not be able to book you until you resume. Patients who already booked will still come.')
        : t('Patients will be able to book your open times again.'),
      pausing ? t('Yes, pause bookings') : t('Yes, take bookings'),
    );
    if (!ok) return;
    start(async () => {
      const r = await setBookingsPaused(pausing);
      if (r?.ok) {
        toast(pausing ? t('Bookings paused. Patients cannot book you now.') : t('Bookings open again'));
        router.refresh();
      } else if (r) toast(t(r.message), true);
    });
  };
  return { toggle, busy, dialog };
}

/** The "taking bookings / paused" card (Today and My timings). */
export function PauseCard({ paused }: { paused: boolean }) {
  const { t } = useT();
  const { toggle, busy, dialog } = usePauseToggle(paused);
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        background: paused ? 'var(--amber-bg)' : 'var(--mint)',
        borderColor: paused ? 'var(--amber)' : 'var(--fern)',
        boxShadow: 'none',
        marginTop: 14,
      }}
    >
      <span style={{ color: paused ? 'var(--amber)' : 'var(--fern)' }}>
        <Icon name={paused ? 'pause' : 'calendarCheck'} size={28} />
      </span>
      <div style={{ flex: 1 }}>
        <b>{paused ? t('Bookings paused') : t('Taking new bookings')}</b>
        <div className="muted" style={{ fontSize: 13.5 }}>
          {paused ? t('Patients cannot book you until you resume.') : t('Patients can book your open times.')}
        </div>
      </div>
      <button type="button" className={`btn small${paused ? '' : ' ghost'}`} disabled={busy} onClick={toggle}>
        {paused ? t('Resume') : t('Pause')}
      </button>
      {dialog}
    </div>
  );
}
