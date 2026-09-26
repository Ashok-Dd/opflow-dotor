'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { askNewTime, cancelBooking, opd } from '@/app/(portal)/actions';
import { Sheet, useConfirm, useT, useToast } from '@/components/client-kit';
import { Icon } from '@/components/icons';

const REASONS = ['I have an emergency', 'I am not well', 'Hospital is closed', 'Patient asked to cancel', 'Other reason'];

/** What the doctor can do with one booking (the same as the app's booking page). */
export function BookingActions({
  id,
  name,
  feeText,
  sessionId,
  canMove,
  canNoShow,
  canCancel,
}: {
  id: string;
  name: string;
  feeText: string;
  sessionId: string;
  canMove: boolean;
  canNoShow: boolean;
  canCancel: boolean;
}) {
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const [why, setWhy] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; message?: string } | null>, done: string) =>
    start(async () => {
      const r = await fn();
      if (r?.ok) {
        toast(done);
        router.refresh();
      } else if (r) toast(t(r.message ?? 'Something went wrong. Please try again.'), true);
    });

  return (
    <div className="card grid">
      <h3 style={{ margin: 0 }}>{t('What to do')}</h3>
      {canMove ? (
        <button
          type="button"
          className="btn ghost"
          disabled={pending}
          onClick={async () => {
            if (
              await confirm(
                t('Ask {0} to pick a new time?', [name]),
                t('They get a message to choose another time with you. If they do not choose within 48 hours, they get all their money back.'),
                t('Yes, ask them'),
              )
            )
              run(() => askNewTime(id), t('{0} will pick a new time.', [name]));
          }}
        >
          <Icon name="repeat" /> {t('Ask to pick a new time')}
        </button>
      ) : null}
      {canNoShow ? (
        <button
          type="button"
          className="btn ghost"
          disabled={pending}
          onClick={async () => {
            if (
              await confirm(
                t('Mark {0} as did not come?', [name]),
                t('Use this only when the patient did not come. You can put them back in the line later.'),
                t('Yes, did not come'),
              )
            )
              run(() => opd(sessionId, 'did-not-come', { bookingId: id }), t('Marked as did not come'));
          }}
        >
          <Icon name="userx" /> {t('Mark did not come')}
        </button>
      ) : null}
      {canCancel ? (
        <button type="button" className="btn danger-outline" disabled={pending} onClick={() => setWhy(true)}>
          <Icon name="block" /> {t('Cancel booking')}
        </button>
      ) : null}

      <Sheet open={why} onClose={() => setWhy(false)} label={t('Why cancel?')}>
        <h3>{t('Why cancel?')}</h3>
        <p className="lead">{t('The patient will see this reason.')}</p>
        <div className="rows">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              style={{ border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit', width: '100%' }}
              onClick={async () => {
                setWhy(false);
                if (
                  await confirm(
                    t("Cancel {0}'s booking?", [name]),
                    t('Patient gets full money back: {0}.\nReason: {1}', [feeText, t(r)]),
                    t('Yes, cancel'),
                    true,
                  )
                )
                  run(() => cancelBooking(id, r), t('Cancelled. {0} sent back.', [feeText]));
              }}
            >
              <span className="ico">
                <Icon name="block" />
              </span>
              <span className="txt">
                <b>{t(r)}</b>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
      {dialog}
    </div>
  );
}
