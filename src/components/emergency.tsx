'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { setEmergency } from '@/app/(portal)/actions';
import { clockLabel } from '@/lib/format';
import type { DoctorHospital, EmergencyState } from '@/lib/types';

import { Sheet, useT, useToast } from './client-kit';
import { Icon } from './icons';
import { OpLoadingScreen } from '@/components/op-loader';

const TILL = [20, 22, 24, 6]; // 8 PM, 10 PM, 12 AM, 6 AM
const tillLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h % 24 >= 12 ? 'PM' : 'AM'}`;

/** The next time the IST clock shows `hour:00` (today, or tomorrow if already past), as an ISO time. */
function nextIst(hour: number): string {
  const now = Date.now();
  const ist = new Date(now + 330 * 60_000);
  const base = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), hour % 24) - 330 * 60_000;
  const at = base > now ? base : base + 86_400_000;
  return new Date(at).toISOString();
}

/**
 * The emergency switch, the same as the app's: what patients see in "Emergency help". Off · available now (turns
 * off by itself after 12 hours) · available till a time. Where: at the hospital, or by phone first.
 */
export function EmergencyButton({ state, hospitals, hospitalId }: { state: EmergencyState; hospitals: DoctorHospital[]; hospitalId: string | null }) {
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<EmergencyState['status']>(state.status);
  const [till, setTill] = useState(22);
  const [mode, setMode] = useState<EmergencyState['mode']>(state.mode ?? 'at_hospital');
  const on = state.status !== 'off';
  const where = hospitals.find((h) => h.id === (state.hospitalId ?? hospitalId));

  const label =
    state.status === 'available_now' ? t('On now') : state.status === 'available_till' && state.untilAt ? t('Till {0}', [clockLabel(state.untilAt)]) : t('Off');

  const save = () =>
    start(async () => {
      const r = await setEmergency({
        status,
        ...(status !== 'off' ? { hospitalId: hospitalId ?? undefined, mode } : {}),
        ...(status === 'available_till' ? { untilAt: nextIst(till) } : {}),
      });
      if (r?.ok) {
        setOpen(false);
        toast(status === 'off' ? t('Emergency status is off') : t('Emergency status saved'));
        router.refresh();
      } else if (r) toast(t(r.message), true);
    });

  const options: [EmergencyState['status'], string, string][] = [
    ['off', 'Not available', 'Patients will not see you in emergency help'],
    ['available_now', 'Available now', 'Patients can call and come now. Turns off by itself after 12 hours.'],
    ['available_till', 'Available till a time', 'Goes off on its own after that time'],
  ];

  return (
    <>
      <button
        type="button"
        className={`pillbtn${on ? ' em-on' : ''}`}
        onClick={() => {
          setStatus(state.status);
          setOpen(true);
        }}
        title={where && on ? where.name : undefined}
      >
        <Icon name="emergency" />
        <span style={{ textAlign: 'left' }}>
          <small>{t('EMERGENCY')}</small>
          {label}
        </span>
      </button>
      {pending ? <OpLoadingScreen message={t('Saving…')} /> : null}
      <Sheet open={open} onClose={() => setOpen(false)} label={t('Emergency status')}>
        <h3>{t('Emergency status')}</h3>
        <p className="lead">{t('This shows in the patient emergency screen. Please keep it true.')}</p>
        {options.map(([s, title, text]) => (
          <div
            key={s}
            role="radio"
            aria-checked={status === s}
            tabIndex={0}
            className={`choice${status === s ? ` sel${s === 'off' ? ' calm' : ''}` : ''}`}
            onClick={() => setStatus(s)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setStatus(s)}
          >
            <input type="radio" readOnly checked={status === s} tabIndex={-1} aria-hidden="true" />
            <div>
              <b>{t(title)}</b>
              <span>{t(text)}</span>
            </div>
          </div>
        ))}
        {status === 'available_till' ? (
          <>
            <div className="field" style={{ marginTop: 10 }}>
              <span>{t('Till what time?')}</span>
            </div>
            <div className="chips" style={{ marginTop: -6 }}>
              {TILL.map((h) => (
                <button key={h} type="button" className="chip" aria-pressed={till === h} onClick={() => setTill(h)}>
                  {tillLabel(h)}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {status !== 'off' ? (
          <>
            <div className="field" style={{ marginTop: 14 }}>
              <span>{t('Where?')}</span>
            </div>
            <div className="chips" style={{ marginTop: -6 }}>
              <button type="button" className="chip" aria-pressed={mode === 'at_hospital'} onClick={() => setMode('at_hospital')}>
                {t('At hospital')}
              </button>
              <button type="button" className="chip" aria-pressed={mode === 'phone_first'} onClick={() => setMode('phone_first')}>
                {t('By phone first')}
              </button>
            </div>
          </>
        ) : null}
        <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
            {t('Not now')}
          </button>
          <button type="button" className="btn" onClick={save} disabled={pending || (status !== 'off' && !hospitalId)}>
            {pending ? t('Saving…') : t('Save')}
          </button>
        </div>
      </Sheet>
    </>
  );
}
