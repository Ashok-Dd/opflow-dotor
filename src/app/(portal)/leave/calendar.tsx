'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { askNewTime, bookingsOn, cancelDay, saveLeaves } from '@/app/(portal)/actions';
import { Sheet, useConfirm, useT, useToast } from '@/components/client-kit';
import { Icon } from '@/components/icons';
import { monthName, people, weekdayOf } from '@/lib/format';
import type { DayBooking } from '@/lib/types';
import { OpLoadingScreen } from '@/components/op-loader';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function LeaveCalendar({ today, initial, workdays, booked }: { today: string; initial: string[]; workdays: number[]; booked: string[] }) {
  const { t, lang } = useT();
  const toast = useToast();
  const router = useRouter();
  const [days, setDays] = useState(() => new Set(initial));
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();
  const [ask, setAsk] = useState<{ open: DayBooking[]; resolve: (c: 'move' | 'cancel' | null) => void } | null>(null);
  const y0 = Number(today.slice(0, 4));
  const m0 = Number(today.slice(5, 7)) - 1;
  const months = [0, 1].map((i) => ({ y: y0 + Math.floor((m0 + i) / 12), m: (m0 + i) % 12 }));
  const future = [...days].filter((d) => d >= today);

  const toggle = (d: string) =>
    setDays((s) => {
      const n = new Set(s);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });

  const save = async () => {
    if (
      !(await confirm(
        t('Save your leave?'),
        t('Patients cannot book you on your leave days. If someone already booked, we ask you what to do next.'),
        t('Yes, save'),
      ))
    )
      return;
    start(async () => {
      const added = future.filter((d) => !initial.includes(d));
      // Wait for each new day's real bookings: a day still loading must never look empty.
      const withPatients: { date: string; list: DayBooking[] }[] = [];
      for (const d of added) {
        const r = await bookingsOn(d);
        if (!r?.ok || !r.data) {
          toast(t(r && !r.ok ? r.message : 'Something went wrong. Please try again.'), true);
          return;
        }
        const open = r.data.items.filter((b) => b.status === 'confirmed' && !b.waitingForNewTime && (!b.queueState || b.queueState === 'not_come'));
        if (open.length) withPatients.push({ date: d, list: open });
      }
      if (withPatients.length) {
        const choice = await new Promise<'move' | 'cancel' | null>((resolve) => setAsk({ open: withPatients.flatMap((x) => x.list), resolve }));
        setAsk(null);
        if (!choice) return;
        for (const x of withPatients) {
          if (choice === 'cancel') {
            const r = await cancelDay(x.date, 'The doctor is on leave on this day');
            if (!r?.ok) return void toast(t(r?.message ?? 'Something went wrong. Please try again.'), true);
          } else {
            for (const b of x.list) {
              if (b.emergency) continue;
              const r = await askNewTime(b.id);
              if (!r?.ok) return void toast(t(r?.message ?? 'Something went wrong. Please try again.'), true);
            }
          }
        }
      }
      const r = await saveLeaves(future);
      if (r?.ok) {
        toast(t('Leave saved'));
        router.refresh();
      } else if (r) toast(t(r.message), true);
    });
  };

  return (
    <>
      {pending && !ask ? <OpLoadingScreen message={t('Saving leave…')} /> : null}
      <div className="months">
        {months.map(({ y, m }) => {
          const first = ymd(y, m, 1);
          const lead = weekdayOf(first) - 1;
          const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
          return (
            <div key={first} className="card">
              <h3>
                {monthName(lang, m)} {y}
              </h3>
              <div className="cal">
                {DOW.map((d) => (
                  <div key={d} className="dow">
                    {t(d)}
                  </div>
                ))}
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`b${i}`} />
                ))}
                {Array.from({ length: count }, (_, i) => {
                  const d = ymd(y, m, i + 1);
                  const past = d < today;
                  const leave = days.has(d);
                  const off = !workdays.includes(weekdayOf(d));
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={past}
                      aria-pressed={leave}
                      aria-label={`${d}${leave ? ` · ${t('Leave')}` : ''}`}
                      className={[leave ? 'leave' : off ? 'off' : '', booked.includes(d) ? 'booked' : ''].join(' ')}
                      onClick={() => toggle(d)}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="actions" style={{ marginTop: 14, gap: 16 }}>
        <span className="actions" style={{ gap: 6 }}>
          <i style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--alarm)', display: 'inline-block' }} /> {t('Leave')}
        </span>
        <span className="actions" style={{ gap: 6 }}>
          <i style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--fern)', display: 'inline-block' }} /> {t('Has bookings')}
        </span>
        <span className="actions" style={{ gap: 6 }}>
          <i style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--paper-deep)', display: 'inline-block' }} /> {t('No OPD')}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" disabled={pending} onClick={save}>
          <Icon name="check" /> {pending ? t('Saving leave…') : t('Save leave ({0} days)', [future.length])}
        </button>
      </div>

      {dialog}
      <Sheet open={!!ask} onClose={() => ask?.resolve(null)} label={t('What should we do for them?')}>
        {ask ? (
          <>
            <h3>{t('{0} booked on these days', [people(lang, ask.open.length)])}</h3>
            <p className="lead">{t('What should we do for them?')}</p>
            <div className="grid">
              <button type="button" className="btn" onClick={() => ask.resolve('move')}>
                <Icon name="repeat" /> {t('Move patients to another day')}
              </button>
              <button type="button" className="btn danger-outline" onClick={() => ask.resolve('cancel')}>
                {t('Cancel and give money back')}
              </button>
              <button type="button" className="btn ghost" onClick={() => ask.resolve(null)}>
                {t('Not now')}
              </button>
            </div>
          </>
        ) : null}
      </Sheet>
    </>
  );
}
