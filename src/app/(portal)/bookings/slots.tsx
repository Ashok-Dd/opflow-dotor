'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { cancelDay } from '@/app/(portal)/actions';
import { useConfirm, useT, useToast } from '@/components/client-kit';
import { ClockRange } from '@/components/clock';
import { Icon } from '@/components/icons';
import { istHour, people, rupees } from '@/lib/format';
import type { DayBooking } from '@/lib/types';

const cap1 = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A booking's state in one word (the same as the app). */
function stateOf(b: DayBooking): { label: string; tone: string } {
  if (b.status === 'cancelled_by_provider') return { label: 'Cancelled', tone: 'bad' };
  if (b.waitingForNewTime) return { label: 'Date changed', tone: '' };
  if (b.status === 'no_show' || b.queueState === 'did_not_come') return { label: 'Did not come', tone: 'bad' };
  if (b.status === 'completed' || b.queueState === 'done') return { label: 'Done', tone: 'good' };
  if (b.queueState === 'with_doctor') return { label: 'With doctor', tone: 'info' };
  if (b.queueState === 'waiting') return { label: 'Waiting', tone: 'warn' };
  return { label: 'Booked', tone: '' };
}

/**
 * The day as a list of hours, grouped by hospital. Closed: the time, how full it is and who is in it at a glance.
 * Click to see the patients; click again to close. "Open all / Close all" at the top.
 */
export function DaySlots({
  date,
  list,
  perHour,
  hospitals,
  isToday,
}: {
  date: string;
  list: DayBooking[];
  perHour: Record<string, number>;
  hospitals: { id: string; name: string }[];
  isToday: boolean;
}) {
  const { t, lang } = useT();
  const byPlace = new Map<string, Map<number, DayBooking[]>>();
  for (const b of list) {
    const hours = byPlace.get(b.hospital.id) ?? new Map<number, DayBooking[]>();
    const h = istHour(b.startsAt);
    hours.set(h, [...(hours.get(h) ?? []), b]);
    byPlace.set(b.hospital.id, hours);
  }
  const places = [...byPlace.keys()].sort((a, b) => Math.min(...byPlace.get(a)!.keys()) - Math.min(...byPlace.get(b)!.keys()));
  const slots = places.flatMap((p) => [...byPlace.get(p)!.keys()].sort((a, b) => a - b).map((h) => `${date}|${p}|${h}`));
  const [open, setOpen] = useState<Set<string>>(new Set());
  const allOpen = slots.length > 0 && slots.every((k) => open.has(k));
  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const nowH = istHour(new Date().toISOString());
  const showPlace = places.length > 1;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost small" onClick={() => setOpen(allOpen ? new Set() : new Set(slots))}>
          {allOpen ? t('Close all') : t('Open all')}
        </button>
      </div>
      {places.map((p) => {
        const hours = byPlace.get(p)!;
        const count = [...hours.values()].reduce((a, l) => a + l.length, 0);
        const name = hospitals.find((h) => h.id === p)?.name ?? list.find((b) => b.hospital.id === p)?.hospital.name ?? '';
        return (
          <section key={p}>
            {showPlace ? (
              <div className="place">
                <i>
                  <Icon name="hospital" size={17} />
                </i>
                {name}
                <span>{people(lang, count)}</span>
              </div>
            ) : (
              <div style={{ height: 10 }} />
            )}
            {[...hours.keys()]
              .sort((a, b) => a - b)
              .map((h) => {
                const key = `${date}|${p}|${h}`;
                const patients = hours.get(h)!;
                const isOpen = open.has(key);
                const cap = perHour[p] ?? 8;
                const booked = patients.filter((b) => !b.emergency && b.status !== 'cancelled_by_provider').length;
                const done = patients.filter((b) => stateOf(b).label === 'Done').length;
                const waiting = patients.filter((b) => ['Waiting', 'With doctor'].includes(stateOf(b).label)).length;
                const em = patients.filter((b) => b.emergency).length;
                const names = patients.map((b) => b.name);
                const now = isToday && nowH === h;
                return (
                  <div key={key} className={`slot${isOpen ? ' open' : ''}${now ? ' now' : ''}`}>
                    <button type="button" aria-expanded={isOpen} onClick={() => toggle(key)}>
                      <div className="when">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <ClockRange start={h} end={h + 1} />
                          {now ? <span className="tag good">{t('Now')}</span> : null}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={`seats${booked >= cap ? ' full' : ''}`}>
                            {Array.from({ length: cap }, (_, i) => (
                              <i key={i} className={i < booked ? 'on' : ''} />
                            ))}
                          </span>
                          <b style={{ fontSize: 13 }}>{t('{0} of {1}', [booked, cap])}</b>
                        </div>
                        {!isOpen ? <span className="glance">{names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ')}</span> : null}
                        {em + waiting + done > 0 ? (
                          <div className="actions">
                            {em ? <span className="tag bad">{t('{0} emergency', [em])}</span> : null}
                            {waiting ? <span className="tag warn">{t('{0} waiting', [waiting])}</span> : null}
                            {done ? <span className="tag good">{t('{0} done', [done])}</span> : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="cnt">
                        {patients.length}
                        <Icon name="chevron" size={18} />
                      </div>
                    </button>
                    {isOpen ? (
                      <div className="body">
                        {patients.map((b) => {
                          const s = stateOf(b);
                          return (
                            <Link prefetch={false} key={b.id} href={`/bookings/${b.id}`} className="brow">
                              <span className={`tk${b.emergency ? ' em' : ''}`}>{b.tokenLabel}</span>
                              <span style={{ minWidth: 0 }}>
                                <b>{b.name}</b>
                                <span>
                                  {[b.age != null ? t('{0} yrs', [b.age]) : null, b.gender ? t(cap1(b.gender)) : null, b.emergency ? t('Emergency') : t('Online'), b.changed ? t('Changed') : null]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </span>
                              <span className={`tag ${s.tone}`}>{t(s.label)}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </section>
        );
      })}
    </div>
  );
}

/** "I can't come on this day": everyone booked gets all their money back and a message. */
export function CancelDayButton({ date, dayText, count, refund }: { date: string; dayText: string; count: number; refund: number }) {
  const { t, lang } = useT();
  const toast = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const go = async () => {
    const ok = await confirm(
      t("Can't come on {0}?", [dayText]),
      count === 0
        ? t('There are no bookings on this day. It will be marked as leave.')
        : t('{0} will get their full money back. Total {1}. Everyone will get a message.', [people(lang, count), rupees(refund)]),
      count === 0 ? t('Mark as leave') : t('Yes, cancel the day'),
      true,
    );
    if (!ok) return;
    start(async () => {
      const r = await cancelDay(date, 'The doctor is not available on this day');
      if (r?.ok) {
        toast(count === 0 ? t('Marked as leave') : t('Cancelled. {0} get {1} back.', [people(lang, r.data?.bookings ?? count), r.data?.refund.display ?? rupees(refund)]));
        router.refresh();
      } else if (r) toast(t(r.message), true);
    });
  };
  return (
    <>
      <button type="button" className="btn danger-outline" onClick={go} disabled={pending}>
        <Icon name="block" /> {pending ? t('Cancelling the day…') : t("I can't come on this day")}
      </button>
      {dialog}
    </>
  );
}
